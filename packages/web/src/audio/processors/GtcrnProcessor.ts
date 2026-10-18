import type { Track, AudioProcessorOptions } from 'livekit-client';
import type { INoiseSuppressorProcessor, NoiseSuppressionMode } from './types';

const registeredContexts = new WeakSet<AudioContext>();
let cachedGtcrnWasmBinary: ArrayBuffer | null = null;

export class GtcrnProcessor implements INoiseSuppressorProcessor {
  readonly id = 'gtcrn';
  readonly name = 'nuvio-gtcrn';
  readonly mode: NoiseSuppressionMode = 'advanced';

  private node: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private destNode: MediaStreamAudioDestinationNode | null = null;
  processedTrack?: MediaStreamTrack;

  async initNode(ctx: AudioContext): Promise<AudioNode> {
    if (this.node) {
      return this.node;
    }

    if (ctx.sampleRate !== 48000 && ctx.sampleRate !== 16000) {
      throw new Error(`GTCRN requires 48kHz or 16kHz sample rate (current: ${ctx.sampleRate}Hz)`);
    }

    if (!registeredContexts.has(ctx)) {
      await ctx.audioWorklet.addModule('/worklets/gtcrn-worklet.js');
      registeredContexts.add(ctx);
    }

    if (!cachedGtcrnWasmBinary) {
      const res = await fetch('/wasm/gtcrn.wasm');
      if (!res.ok) {
        throw new Error(`Failed to load GTCRN WASM from /wasm/gtcrn.wasm (status ${res.status})`);
      }
      cachedGtcrnWasmBinary = await res.arrayBuffer();
    }

    this.node = new AudioWorkletNode(ctx, 'nuvio-gtcrn-processor', {
      processorOptions: {
        maxChannels: 1,
        wasmBinary: cachedGtcrnWasmBinary,
      },
      channelCount: 1,
      channelCountMode: 'explicit',
    });

    return this.node;
  }

  getNode(): AudioNode | null {
    return this.node;
  }

  // LiveKit TrackProcessor implementation
  async init(opts: AudioProcessorOptions): Promise<void> {
    await this.initNode(opts.audioContext);
    if (!this.node) throw new Error('GTCRN worklet node failed to initialize');

    this.sourceNode = opts.audioContext.createMediaStreamSource(new MediaStream([opts.track]));
    this.destNode = opts.audioContext.createMediaStreamDestination();

    this.sourceNode.connect(this.node);
    this.node.connect(this.destNode);

    this.processedTrack = this.destNode.stream.getAudioTracks()[0];
  }

  async restart(opts: AudioProcessorOptions): Promise<void> {
    await this.destroy();
    await this.init(opts);
  }

  async destroy(): Promise<void> {
    if (this.node) {
      try {
        this.node.port.postMessage('destroy');
      } catch {}
      try {
        this.node.disconnect();
      } catch {}
      this.node = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }

    if (this.destNode) {
      try {
        this.destNode.disconnect();
      } catch {}
      this.destNode = null;
    }

    if (this.processedTrack) {
      try {
        this.processedTrack.stop();
      } catch {}
      this.processedTrack = undefined;
    }
  }
}
