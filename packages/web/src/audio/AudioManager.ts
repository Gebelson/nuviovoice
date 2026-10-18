import { NoiseSuppressionController } from './processors/NoiseSuppressionController';
import type { NoiseSuppressionMode, NoiseSuppressionStatus } from './processors/types';

export class AudioManager {
  private static instance: AudioManager | null = null;
  private ctx: AudioContext | null = null;
  private inputGain: GainNode | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private inputDestination: MediaStreamAudioDestinationNode | null = null;
  private silentGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null; // Points to processedAnalyser for backward compatibility
  private rawInputAnalyser: AnalyserNode | null = null;
  private processedAnalyser: AnalyserNode | null = null;
  private testGain: GainNode | null = null;
  private isMicTesting = false;
  private testListenMode: 'original' | 'processed' = 'processed';
  private masterCompressor: DynamicsCompressorNode | null = null;
  private masterBoost: GainNode | null = null;
  
  private currentInputDeviceId: string = 'default';
  private desiredOutputDeviceId: string = 'default';
  private currentStream: MediaStream | null = null;
  private isInitialized = false;
  
  private listeners: Set<() => void> = new Set();
  private soundBuffers: Map<string, AudioBuffer> = new Map();
  private voiceEchoCancellation = true;
  private voiceNoiseSuppression = false;
  private voiceAutoGainControl = true;
  private streamGeneration = 0;
  // Separate from streamGeneration: only leaving capture invalidates pending work.
  private inputReleaseGeneration = 0;
  private inputSwitchChain: Promise<MediaStream | null> = Promise.resolve(null);
  private noiseSuppressionMode: NoiseSuppressionMode = 'smart';
  private noiseSuppressionController = NoiseSuppressionController.getInstance();
  private keepAliveOscillator: OscillatorNode | null = null;

  // Cached `getUserMedia` denial. After a NotAllowedError, subsequent
  // `setInputDevice` calls (e.g. `useLiveKit.syncMic` racing the user's
  // tap on a denial prompt) re-throw the cached error WITHOUT issuing a
  // second `getUserMedia` — iOS Safari otherwise queues a second permission
  // prompt that has lost its user-gesture activation, which on iOS PWA
  // standalone leads to a permanently hung silent prompt. The cache is
  // cleared by `clearInputDenial()` (called from the user-gesture-driven
  // `requestMicPermission` retry path in `utils/voice.ts`) so a fresh user
  // gesture can re-attempt cleanly.
  private inputDenialError: Error | null = null;

  // Subscribers notified when the *upstream* getUserMedia track ends unexpectedly
  // (hardware unplug, OS-level revoke, system audio service crash). Distinct from
  // the published mic track's `onended` — the published track is a clone of the
  // WebAudio destination node, which never ends on upstream loss.
  private inputTrackEndedListeners: Set<(reason: 'unplug' | 'revoke' | 'unknown') => void> = new Set();

  private constructor() {}

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private initContext() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass({ sampleRate: 48000 });
    
    this.inputGain = this.ctx.createGain();
    this.inputDestination = this.ctx.createMediaStreamDestination();
    
    this.rawInputAnalyser = this.ctx.createAnalyser();
    this.rawInputAnalyser.fftSize = 256;

    this.processedAnalyser = this.ctx.createAnalyser();
    this.processedAnalyser.fftSize = 256;
    this.analyser = this.processedAnalyser; // Keep legacy analyser pointing to processed audio

    this.testGain = this.ctx.createGain();
    this.testGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.testGain.connect(this.ctx.destination);
    
    this.silentGain = this.ctx.createGain();
    this.silentGain.gain.value = 0;

    // Master compressor/limiter — prevents clipping when multiple
    // audio sources (voice + stream) sum at the output.
    this.masterCompressor = this.ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.value = -1;    // only engage near digital clipping
    this.masterCompressor.knee.value = 0.5;        // hard knee — transparent below threshold
    this.masterCompressor.ratio.value = 4;         // gentle limiting, no ducking
    this.masterCompressor.attack.value = 0.0005;   // 0.5ms — catch transient peaks
    this.masterCompressor.release.value = 0.01;    // 10ms — recover quickly
    // +3dB boost before the limiter — drives a hotter signal into the
    // compressor, raising perceived loudness while peaks are still caught.
    this.masterBoost = this.ctx.createGain();
    this.masterBoost.gain.value = 1.41; // +3dB
    this.masterBoost.connect(this.masterCompressor);
    this.masterCompressor.connect(this.ctx.destination);

    this.processedAnalyser.connect(this.inputGain);
    this.inputGain.connect(this.inputDestination);
    this.inputGain.connect(this.silentGain);
    this.silentGain.connect(this.ctx.destination);

    this.inputGain.gain.setValueAtTime(1, this.ctx.currentTime);

    // Safari suspends the AudioContext when it detects no audible output,
    // even while WebRTC audio is flowing through the pipeline. A sub-bass
    // oscillator at near-zero gain keeps the rendering thread alive without
    // producing audible sound.
    this.keepAliveOscillator = this.ctx.createOscillator();
    this.keepAliveOscillator.frequency.value = 20;
    const keepAliveGain = this.ctx.createGain();
    keepAliveGain.gain.value = 0.00001;
    this.keepAliveOscillator.connect(keepAliveGain);
    keepAliveGain.connect(this.ctx.destination);
    this.keepAliveOscillator.start();

    this.ctx.onstatechange = () => {
      console.log(`[AudioManager] Context state: ${this.ctx?.state}`);
      if (this.ctx?.state === 'running') {
        this.notifyResumed();
      }
    };

    this.isInitialized = true;

    // Apply pending output device selection (user preference loaded before context creation)
    this.applyOutputDevice();
  }

  /**
   * Routes all Web Audio output to the specified device via AudioContext.setSinkId().
   * This is the ONLY correct way to switch output devices when using a custom Web Audio
   * pipeline — LiveKit's switchActiveDevice('audiooutput') targets <audio> elements
   * which we deliberately kill via MutationObserver.
   */
  async setOutputDevice(deviceId: string): Promise<void> {
    this.desiredOutputDeviceId = deviceId;
    await this.applyOutputDevice();
  }

  private async applyOutputDevice(): Promise<void> {
    if (!this.ctx || !('setSinkId' in this.ctx)) return;
    try {
      const sinkId = this.desiredOutputDeviceId === 'default' ? '' : this.desiredOutputDeviceId;
      await (this.ctx as any).setSinkId(sinkId);
      console.log(`[AudioManager] Output device set to: ${this.desiredOutputDeviceId}`);
    } catch (err) {
      console.error('[AudioManager] Failed to set output device:', err);
    }
  }

  onResumed(cb: () => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notifyResumed() {
    this.listeners.forEach(cb => cb());
  }

  async resumeContext() {
    if (!this.ctx) this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
        console.log('[AudioManager] AudioContext resumed.');
      } catch (err) {
        console.error('[AudioManager] Failed to resume context:', err);
      }
    }
  }

  async loadSound(name: string): Promise<AudioBuffer | null> {
    if (this.soundBuffers.has(name)) {
      return this.soundBuffers.get(name)!;
    }

    if (!this.ctx) this.initContext();
    
    try {
      const response = await fetch(`/sounds/${name}.ogg`);
      if (!response.ok) throw new Error(`Failed to load sound: ${name}`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);
      this.soundBuffers.set(name, audioBuffer);
      return audioBuffer;
    } catch (err) {
      console.error(`[AudioManager] Error loading sound ${name}:`, err);
      return null;
    }
  }

  async playSound(name: string, options: { loop?: boolean; volume?: number } = {}): Promise<AudioBufferSourceNode | null> {
    await this.resumeContext();
    const buffer = await this.loadSound(name);
    if (!buffer || !this.ctx) return null;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = options.loop || false;

    const gainNode = this.ctx.createGain();
    const targetVolume = options.volume ?? 0.8;

    // Short attack/release envelope to avoid the click/pop that occurs when a
    // buffer starts (or ends) at a non-zero sample amplitude. Without this the
    // waveform's first sample jumps from silence instantly, producing an
    // audible pop — most noticeable on the looping call cues. Mirrors the
    // envelope used by playTestTone().
    const now = this.ctx.currentTime;
    const attack = 0.01; // 10ms fade-in — kills the start pop, imperceptible
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(targetVolume, now + attack);

    // Tail fade-out for one-shots so they don't pop at the natural end of the
    // buffer. Looping cues are stopped explicitly by the caller, so they ramp
    // in once and hold; no tail ramp is scheduled for them.
    if (!source.loop) {
      const release = 0.01; // 10ms fade-out
      const dur = buffer.duration;
      if (dur > attack + release) {
        gainNode.gain.setValueAtTime(targetVolume, now + dur - release);
        gainNode.gain.linearRampToValueAtTime(0, now + dur);
      }
    }

    source.connect(gainNode);
    gainNode.connect(this.masterBoost!);

    source.start(now);
    return source;
  }

  /**
   * Serialized input device switch.
   * Multiple callers (store, syncMic, UI) may trigger this concurrently.
   * Chaining ensures only one getUserMedia runs at a time, and the second
   * call short-circuits if the first already set the same device.
   */
  async setInputDevice(deviceId: string): Promise<MediaStream | null> {
    const generation = this.inputReleaseGeneration;
    const job = this.inputSwitchChain.then(() => generation === this.inputReleaseGeneration
      ? this._setInputDeviceImpl(deviceId, generation) : null);
    this.inputSwitchChain = job.catch(() => null);
    return job;
  }

  private async _setInputDeviceImpl(deviceId: string, generation: number): Promise<MediaStream | null> {
    if (!this.isInitialized) this.initContext();

    // Skip if already set and stream is active
    if (this.currentInputDeviceId === deviceId && this.currentStream?.active) {
      return this.currentStream;
    }

    // Re-throw cached denial without firing a second `getUserMedia`.
    // See the `inputDenialError` field comment for rationale.
    if (this.inputDenialError) {
      throw this.inputDenialError;
    }

    try {
      if (this.currentStream) {
        // Detach our `onended` handlers BEFORE stopping. `.stop()` synchronously
        // queues an `ended` event on each track; by clearing the listener first
        // we guarantee the deliberate-replace path never notifies subscribers,
        // regardless of microtask/task ordering.
        const oldTracks = this.currentStream.getTracks();
        oldTracks.forEach(t => { t.onended = null; });
        oldTracks.forEach(t => t.stop());
        // Drop the reference immediately so any stray handler that survived
        // (e.g. attached by external code) sees `currentStream` no longer
        // pointing to the old stream and bails out via the identity check.
        this.currentStream = null;
      }

      // Chrome AEC stays on during screen share — headphone users unaffected,
      // speaker users get proper echo cancellation.

      // When smart or advanced AI suppression is active, force browser NS off — running both degrades quality.
      // In standard mode, WebRTC native noise suppression is active.
      const effectiveNoiseSuppression = this.noiseSuppressionMode === 'standard';

      const constraints = {
        audio: {
          deviceId: deviceId === 'default' ? undefined : { exact: deviceId },
          echoCancellation: this.voiceEchoCancellation,
          noiseSuppression: effectiveNoiseSuppression,
          autoGainControl: this.voiceAutoGainControl,
          // Chromium-specific constraints — belt-and-suspenders to ensure
          // Chrome's internal audio engine respects the standard constraints.
          googEchoCancellation: this.voiceEchoCancellation,
          googAutoGainControl: this.voiceAutoGainControl,
          googNoiseSuppression: effectiveNoiseSuppression,
          googHighpassFilter: false,
          googTypingNoiseDetection: false,
        } as any
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      // Permission prompts cannot be cancelled. Stop a late result immediately
      // instead of reconnecting capture after the user has left the call.
      if (generation !== this.inputReleaseGeneration) {
        newStream.getTracks().forEach(track => track.stop());
        return null;
      }
      // Successful acquisition — clear any cached denial so next swap is
      // unimpeded. (Most commonly hit when the user grants permission via
      // the explicit `requestMicPermission` retry path, but also covers
      // OS-level grants between calls.)
      this.inputDenialError = null;
      this.currentStream = newStream;
      this.currentInputDeviceId = deviceId;
      this.streamGeneration++;

      // Attach upstream-loss detection to every track in the new stream. If the
      // OS / hardware ends a track (unplug, revoke, audio-service crash), the
      // `ended` event fires and we notify subscribers — provided the stream is
      // still the active one (identity check guards against later replacements).
      this.attachInputEndedListeners(newStream);

      if (this.ctx && this.inputGain) {
        if (this.inputSource) {
          try { this.inputSource.disconnect(); } catch {}
        }
        this.inputSource = this.ctx.createMediaStreamSource(this.currentStream);
        this.rewireInputGraph();
      }

      return this.currentStream;
    } catch (err) {
      if (generation !== this.inputReleaseGeneration) return null;
      console.error('[AudioManager] Failed to set input device:', err);
      // Cache permission denials so syncMic's racing call doesn't fire a
      // second `getUserMedia` while the user is still resolving the first
      // prompt (or on iOS PWA where the second prompt would silently
      // never surface).
      if (err instanceof Error && err.name === 'NotAllowedError') {
        this.inputDenialError = err;
      }
      throw err;
    }
  }

  /**
   * Clears the cached `getUserMedia` denial so the next `setInputDevice`
   * call attempts a fresh acquisition. Called from
   * `utils/voice.requestMicPermission` (always invoked from a user
   * gesture) to re-arm the path after a denial. Without this, the cache
   * would suppress the retry and the user would be stuck in listener
   * mode for the rest of the session.
   */
  clearInputDenial(): void {
    this.inputDenialError = null;
  }

  /**
   * Releases the upstream `getUserMedia` capture stream and detaches it from the
   * Web Audio graph. Call this when leaving voice — `Room.disconnect()` only
   * stops the cloned destination-node track published to the room, never the raw mic
   * capture this manager owns, so without this the browser tab / OS keeps the
   * microphone flagged as in-use after the user has left the call.
   *
   * The AudioContext and the rest of the graph are left intact so sound effects
   * (join/leave cues, notifications) keep working. The next `setInputDevice`
   * call re-acquires a fresh stream and rebuilds `inputSource` — the bumped
   * `streamGeneration` guarantees the mic effect republishes rather than
   * short-circuiting on a stale generation match.
   */
  releaseInputStream(): void {
    this.inputReleaseGeneration++;
    if (this.inputSource) {
      this.inputSource.disconnect();
      this.inputSource = null;
    }
    if (this.currentStream) {
      // Detach our `onended` handlers BEFORE stopping so the deliberate-release
      // path never notifies upstream-loss subscribers (see `_setInputDeviceImpl`).
      const tracks = this.currentStream.getTracks();
      tracks.forEach(t => { t.onended = null; });
      tracks.forEach(t => t.stop());
      this.currentStream = null;
    }
    // Clear runtime device identity, not the user's persisted preference.
    // The missing currentStream makes the next join acquire a fresh stream.
    this.currentInputDeviceId = 'default';
    this.streamGeneration++;
  }

  /**
   * Attaches an `onended` listener to every audio track in the supplied stream.
   * The listener identity-checks against `this.currentStream` so it only fires
   * for *unexpected* track loss — deliberate replacement clears the listener and
   * nulls `currentStream` BEFORE stopping, so neither path can leak a false
   * positive into subscribers.
   */
  private attachInputEndedListeners(stream: MediaStream): void {
    for (const track of stream.getTracks()) {
      track.onended = () => {
        // Stream has been replaced (deliberate device change, RNNoise toggle,
        // setVoiceProcessing reset) — this is not a hardware-loss event.
        if (this.currentStream !== stream) return;
        // Drop our reference so any subsequent `hasActiveStream()` check
        // reflects reality, and so a downstream re-acquire attempt via
        // `setInputDevice` does not short-circuit on the stale-but-non-null
        // currentStream.
        this.currentStream = null;
        // Reason classification is the consumer's responsibility — they probe
        // `getUserMedia` to distinguish unplug vs revoke vs unavailable. We
        // emit `'unknown'` so the type is still informative if a future caller
        // wires reason inference at this layer.
        const reason: 'unplug' | 'revoke' | 'unknown' = 'unknown';
        // Snapshot listeners before iteration: a subscriber that synchronously
        // unsubscribes during notification (e.g. cleanup-on-disconnect) would
        // otherwise mutate the set mid-iteration.
        const snapshot = Array.from(this.inputTrackEndedListeners);
        for (const cb of snapshot) {
          try { cb(reason); } catch (err) {
            console.error('[AudioManager] inputTrackEnded listener threw:', err);
          }
        }
      };
    }
  }

  /**
   * Subscribe to upstream input-track-end events. Returns an unsubscribe.
   * Callers should treat `reason` as a hint and probe `getUserMedia` themselves
   * to distinguish unplug from revoke.
   */
  onInputTrackEnded(cb: (reason: 'unplug' | 'revoke' | 'unknown') => void): () => void {
    this.inputTrackEndedListeners.add(cb);
    return () => { this.inputTrackEndedListeners.delete(cb); };
  }

  private inVoiceCall = false;

  setInVoiceCall(inCall: boolean): void {
    this.inVoiceCall = inCall;
  }

  private rewireInputGraph(): void {
    if (!this.ctx || !this.inputSource) return;

    try {
      this.inputSource.disconnect();
    } catch {}

    // 1. Raw input analyser: always receives unfiltered mic audio for the Input meter
    if (this.rawInputAnalyser) {
      try {
        this.inputSource.connect(this.rawInputAnalyser);
      } catch (err) {
        console.error('[AudioManager] Error connecting rawInputAnalyser:', err);
      }
    }

    // 2. Route through noise suppressor worklet if active
    const activeNode = this.noiseSuppressionController.getActiveNode();
    const effectiveMode = this.noiseSuppressionController.getStatus().effectiveMode;

    if (activeNode && (effectiveMode === 'smart' || effectiveMode === 'advanced')) {
      try {
        this.inputSource.connect(activeNode);
        try { activeNode.disconnect(); } catch {}
        if (this.processedAnalyser) {
          activeNode.connect(this.processedAnalyser);
        }
      } catch (err) {
        console.error('[AudioManager] Error wiring noise suppressor worklet node:', err);
        if (this.processedAnalyser) {
          try { this.inputSource.connect(this.processedAnalyser); } catch {}
        }
      }
    } else {
      // Disabled or Standard (native WebRTC noise suppression)
      if (this.processedAnalyser) {
        try {
          this.inputSource.connect(this.processedAnalyser);
        } catch (err) {
          console.error('[AudioManager] Error connecting processedAnalyser:', err);
        }
      }
    }

    // 3. Processed analyser feeds inputGain -> inputDestination (published track)
    if (this.processedAnalyser && this.inputGain) {
      try {
        this.processedAnalyser.disconnect();
        this.processedAnalyser.connect(this.inputGain);
      } catch {}
    }

    this.updateMicTestRouting();
  }

  private updateMicTestRouting(): void {
    if (!this.ctx || !this.testGain) return;
    try {
      if (this.rawInputAnalyser) this.rawInputAnalyser.disconnect(this.testGain);
      if (this.processedAnalyser) this.processedAnalyser.disconnect(this.testGain);
    } catch {}

    if (this.isMicTesting && this.testGain.gain.value > 0) {
      try {
        if (this.testListenMode === 'original' && this.rawInputAnalyser) {
          this.rawInputAnalyser.connect(this.testGain);
        } else if (this.processedAnalyser) {
          this.processedAnalyser.connect(this.testGain);
        }
      } catch (err) {
        console.error('[AudioManager] Error updating mic test routing:', err);
      }
    }
  }

  async setNoiseSuppressionMode(mode: NoiseSuppressionMode): Promise<void> {
    this.noiseSuppressionMode = mode;
    if (!this.isInitialized) this.initContext();

    await this.noiseSuppressionController.setMode(mode, this.ctx);
    this.rewireInputGraph();

    // Dynamically adjust WebRTC constraints on active tracks if supported
    const effectiveNoiseSuppression = this.noiseSuppressionController.getStatus().effectiveMode === 'standard';
    if (this.currentStream) {
      const audioTrack = this.currentStream.getAudioTracks()[0];
      if (audioTrack && typeof audioTrack.applyConstraints === 'function') {
        try {
          await audioTrack.applyConstraints({
            noiseSuppression: effectiveNoiseSuppression,
            echoCancellation: this.voiceEchoCancellation,
            autoGainControl: this.voiceAutoGainControl,
          } as any);
        } catch (err) {
          console.warn('[AudioManager] Failed to apply track constraints:', err);
        }
      }
    }
  }

  getNoiseSuppressionMode(): NoiseSuppressionMode {
    return this.noiseSuppressionMode;
  }

  getNoiseSuppressionStatus(): NoiseSuppressionStatus {
    return this.noiseSuppressionController.getStatus();
  }

  // Backward-compatibility aliases
  async setRnnoiseEnabled(enabled: boolean): Promise<void> {
    await this.setNoiseSuppressionMode(enabled ? 'smart' : 'disabled');
  }

  isRnnoiseEnabled(): boolean {
    return this.noiseSuppressionMode === 'smart';
  }

  // Microphone Test methods for Settings panel
  async startMicTest(): Promise<void> {
    await this.resumeContext();
    this.isMicTesting = true;
    if (!this.currentStream || !this.currentStream.active) {
      await this.setInputDevice(this.currentInputDeviceId);
    }
    this.updateMicTestRouting();
  }

  setMicTestListening(listening: boolean, mode: 'original' | 'processed' = 'processed'): void {
    this.testListenMode = mode;
    if (this.testGain && this.ctx) {
      this.testGain.gain.setValueAtTime(listening ? 0.8 : 0, this.ctx.currentTime);
    }
    this.updateMicTestRouting();
  }

  stopMicTest(): void {
    this.isMicTesting = false;
    if (this.testGain && this.ctx) {
      this.testGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    this.updateMicTestRouting();
    if (!this.inVoiceCall) {
      this.releaseInputStream();
    }
  }

  getRawInputAnalyser(): AnalyserNode {
    if (!this.isInitialized) this.initContext();
    return this.rawInputAnalyser!;
  }

  getProcessedAnalyser(): AnalyserNode {
    if (!this.isInitialized) this.initContext();
    return this.processedAnalyser!;
  }

  setInputVolume(volume: number) {
    if (!this.isInitialized) this.initContext();
    if (this.inputGain && this.ctx) {
      const gainValue = volume / 100;
      this.inputGain.gain.setTargetAtTime(gainValue, this.ctx.currentTime, 0.1);
    }
  }

  setVoiceProcessing(opts: { echoCancellation?: boolean; noiseSuppression?: boolean; autoGainControl?: boolean }) {
    let changed = false;
    if (opts.echoCancellation !== undefined && opts.echoCancellation !== this.voiceEchoCancellation) {
      this.voiceEchoCancellation = opts.echoCancellation;
      changed = true;
    }
    if (opts.noiseSuppression !== undefined && opts.noiseSuppression !== this.voiceNoiseSuppression) {
      this.voiceNoiseSuppression = opts.noiseSuppression;
      changed = true;
    }
    if (opts.autoGainControl !== undefined && opts.autoGainControl !== this.voiceAutoGainControl) {
      this.voiceAutoGainControl = opts.autoGainControl;
      changed = true;
    }
    if (changed && this.currentStream) {
      // Detach listeners before stopping (see `_setInputDeviceImpl`).
      const tracks = this.currentStream.getTracks();
      tracks.forEach(t => { t.onended = null; });
      tracks.forEach(t => t.stop());
      this.currentStream = null;
    }
  }

  getStreamGeneration(): number {
    return this.streamGeneration;
  }

  /**
   * CRITICAL: Always returns a CLONE of the destination track.
   * This prevents LiveKit's cleanup from killing the main singleton track
   * when switching rooms.
   */
  getFreshTrack(): MediaStreamTrack | null {
    if (!this.isInitialized) this.initContext();
    const isIOSDevice = typeof navigator !== 'undefined' && (
      /\b(?:iPhone|iPad|iPod)\b/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
    // On iOS Safari, if the context is suspended or not ready, fallback to raw capture track
    if (isIOSDevice && this.currentStream) {
      if (!this.ctx || this.ctx.state !== 'running') {
        const rawTrack = this.currentStream.getAudioTracks()[0];
        if (rawTrack && rawTrack.readyState === 'live') {
          return rawTrack.clone();
        }
      }
    }
    const track = this.inputDestination?.stream.getAudioTracks()[0];
    if (track && track.readyState === 'live') {
      return track.clone();
    }
    if (this.currentStream) {
      const rawTrack = this.currentStream.getAudioTracks()[0];
      if (rawTrack && rawTrack.readyState === 'live') {
        return rawTrack.clone();
      }
    }
    return null;
  }

  getAnalyserNode(): AnalyserNode {
    if (!this.isInitialized) this.initContext();
    return this.analyser!;
  }

  /**
   * Ensures the AudioContext exists and returns it.
   * Unlike getContext(), this will never return null — it lazily
   * creates the context if it hasn't been initialised yet.
   * The context may be in 'suspended' state but Web Audio nodes
   * can be created and connected regardless; audio will flow
   * once the context resumes.
   */
  ensureContext(): AudioContext {
    if (!this.ctx) this.initContext();
    return this.ctx!;
  }

  /**
   * Returns the master output bus (masterBoost → masterCompressor → ctx.destination).
   * All audio (remote voice, streams, effects) routes through this node.
   * The +3dB boost raises perceived loudness; the compressor catches peaks.
   * Output device is controlled via setSinkId on the underlying AudioContext.
   */
  getMasterOutput(): AudioNode {
    if (!this.ctx) this.initContext();
    return this.masterBoost!;
  }

  /**
   * Returns the deviceId of the currently active mic stream (the one being
   * captured by getUserMedia). May differ from the persisted store value when
   * the store says 'default' but Chromium has resolved that to a concrete ID.
   */
  getCurrentInputDeviceId(): string {
    return this.currentInputDeviceId;
  }

  /**
   * True if a live mic stream is currently captured. Used by the global
   * devicechange handler to decide whether to force-reacquire on OS-default
   * change.
   */
  hasActiveStream(): boolean {
    return !!this.currentStream?.active;
  }

  /**
   * Plays a short test tone through the master output bus, exercising the
   * current setSinkId binding. Used by the "Test Sound" button in audio
   * settings to confirm that audio is reaching the chosen output device.
   */
  async playTestTone(): Promise<void> {
    await this.resumeContext();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.frequency.value = 440;
    const gain = this.ctx.createGain();
    // Soft envelope to avoid pop on start/stop.
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
    gain.gain.linearRampToValueAtTime(0, now + 0.4);
    osc.connect(gain);
    gain.connect(this.masterBoost!);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }
}
