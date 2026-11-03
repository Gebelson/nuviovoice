import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores/uiStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { getSupportedAudioFormat } from '../../utils/audioCodecs';
import { normalizeWaveform } from '../../utils/waveform';
import { uploadVoiceAttachment } from '../../utils/voiceUpload';
import type { Attachment } from '@concord/shared';

export interface VoiceRecorderBarProps {
  channelId: string;
  origin?: string;
  onCancel: () => void;
  onSendVoice: (attachment: Attachment) => Promise<void>;
  /** Optional initial recording stream and recorder when initiated via hold gesture */
  initialMediaStream?: MediaStream | null;
  initialMediaRecorder?: MediaRecorder | null;
  initialAudioContext?: AudioContext | null;
  initialAnalyser?: AnalyserNode | null;
}

type RecorderState = 'recording' | 'paused' | 'preview' | 'sending';

const LIVE_BARS_COUNT = 28;
const MIN_RECORDING_DURATION_SEC = 0.5;

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VoiceRecorderBar({
  channelId,
  origin,
  onCancel,
  onSendVoice,
  initialMediaStream,
  initialMediaRecorder,
  initialAudioContext,
  initialAnalyser,
}: VoiceRecorderBarProps) {
  const { t } = useTranslation(['chat', 'common']);
  const addToast = useUIStore((s) => s.addToast);
  const inputDeviceId = useVoiceStore((s) => s.inputDeviceId);

  const [state, setState] = useState<RecorderState>('recording');
  const [durationSec, setDurationSec] = useState<number>(0);
  const [liveBars, setLiveBars] = useState<number[]>(() => Array(LIVE_BARS_COUNT).fill(0.15));

  // Preview state
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [finalWaveform, setFinalWaveform] = useState<number[]>([]);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewRate, setPreviewRate] = useState<1 | 1.5 | 2>(1);

  // Refs for audio hardware
  const streamRef = useRef<MediaStream | null>(initialMediaStream ?? null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(initialMediaRecorder ?? null);
  const audioContextRef = useRef<AudioContext | null>(initialAudioContext ?? null);
  const analyserRef = useRef<AnalyserNode | null>(initialAnalyser ?? null);
  const animFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rawPeaksRef = useRef<number[]>([]);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const isCleaningUpRef = useRef(false);

  // Tear down all audio tracks and contexts safely
  const cleanupHardware = useCallback(() => {
    isCleaningUpRef.current = true;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    mediaRecorderRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        void audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupHardware();
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.src = '';
      }
    };
  }, [cleanupHardware, previewUrl]);

  // Visualizer loop for live animated bars
  const startVisualizer = useCallback((analyser: AnalyserNode) => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateWave = () => {
      if (isCleaningUpRef.current) return;
      analyser.getByteFrequencyData(dataArray);

      // Compute RMS volume of current frame
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i]! * dataArray[i]!;
      }
      const rms = Math.sqrt(sum / dataArray.length) / 255;
      const normalizedPeak = Math.max(0.12, Math.min(1, rms * 2.8));

      // Record peak for final waveform
      rawPeaksRef.current.push(normalizedPeak);

      // Update live sliding window of bars
      setLiveBars((prev) => {
        const next = [...prev.slice(1), normalizedPeak];
        return next;
      });

      animFrameRef.current = requestAnimationFrame(updateWave);
    };

    animFrameRef.current = requestAnimationFrame(updateWave);
  }, []);

  // Initialize recording stream if not passed in
  useEffect(() => {
    if (initialMediaRecorder && initialMediaStream) {
      // Already initialized via hold gesture
      mediaRecorderRef.current = initialMediaRecorder;
      streamRef.current = initialMediaStream;
      initialMediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      if (initialAnalyser) {
        startVisualizer(initialAnalyser);
      }
      timerIntervalRef.current = setInterval(() => {
        setDurationSec((prev) => prev + 1);
      }, 1000);
      return;
    }

    let isMounted = true;

    async function initRecorder() {
      try {
        const audioConstraints: MediaTrackConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        };
        if (inputDeviceId && inputDeviceId !== 'default') {
          audioConstraints.deviceId = { ideal: inputDeviceId };
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        } catch {
          // Fallback to unconstrained audio
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        // Web Audio Analyser
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;
          startVisualizer(analyser);
        }

        // MediaRecorder setup
        const format = getSupportedAudioFormat();
        const recorderOpts = format.mimeType ? { mimeType: format.mimeType } : undefined;
        const recorder = new MediaRecorder(stream, recorderOpts);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        recorder.start(100); // 100ms chunks

        // Timer
        timerIntervalRef.current = setInterval(() => {
          setDurationSec((prev) => prev + 1);
        }, 1000);
      } catch (err: unknown) {
        if (!isMounted) return;
        console.error('[VoiceRecorder] getUserMedia error:', err);
        const name = err instanceof Error ? err.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          addToast(t('chat:voice.permissionDenied'), 'warning');
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          addToast(t('chat:voice.notFound'), 'warning');
        } else {
          addToast(t('chat:voice.error'), 'warning');
        }
        onCancel();
      }
    }

    void initRecorder();

    return () => {
      isMounted = false;
    };
  }, [inputDeviceId, initialMediaRecorder, initialMediaStream, initialAnalyser, startVisualizer, addToast, t, onCancel]);

  // Pause recording
  const handlePause = useCallback(() => {
    if (state !== 'recording' || !mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setState('paused');
  }, [state]);

  // Resume recording
  const handleResume = useCallback(() => {
    if (state !== 'paused' || !mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
    }
    if (analyserRef.current) {
      startVisualizer(analyserRef.current);
    }
    timerIntervalRef.current = setInterval(() => {
      setDurationSec((prev) => prev + 1);
    }, 1000);
    setState('recording');
  }, [state, startVisualizer]);

  // Stop recording and transition to Preview mode
  const handleReview = useCallback(() => {
    if (durationSec < MIN_RECORDING_DURATION_SEC) {
      addToast(t('chat:voice.tooShort'), 'warning');
      cleanupHardware();
      onCancel();
      return;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    recorder.onstop = () => {
      const format = getSupportedAudioFormat();
      const mime = recorder.mimeType || format.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mime });
      const url = URL.createObjectURL(blob);

      const normalized = normalizeWaveform(rawPeaksRef.current, 38);
      setPreviewBlob(blob);
      setPreviewUrl(url);
      setFinalWaveform(normalized);
      setState('preview');

      // Stop mic streams
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        try { void audioContextRef.current.close(); } catch {}
        audioContextRef.current = null;
      }
    };

    recorder.stop();
  }, [durationSec, cleanupHardware, onCancel, addToast, t]);

  // Discard and cancel
  const handleDiscard = useCallback(() => {
    cleanupHardware();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    onCancel();
  }, [cleanupHardware, previewUrl, onCancel]);

  // Send voice message
  const handleSend = useCallback(async () => {
    if (durationSec < MIN_RECORDING_DURATION_SEC && !previewBlob) {
      addToast(t('chat:voice.tooShort'), 'warning');
      cleanupHardware();
      onCancel();
      return;
    }

    setState('sending');

    let blobToSend = previewBlob;
    let waveformToSend = finalWaveform;
    const finalDuration = durationSec;

    // If still recording, stop and extract blob
    if (!blobToSend && mediaRecorderRef.current) {
      const recorder = mediaRecorderRef.current;
      await new Promise<void>((resolve) => {
        recorder.onstop = () => {
          const format = getSupportedAudioFormat();
          const mime = recorder.mimeType || format.mimeType || 'audio/webm';
          blobToSend = new Blob(chunksRef.current, { type: mime });
          waveformToSend = normalizeWaveform(rawPeaksRef.current, 38);
          resolve();
        };
        recorder.stop();
      });
    }

    cleanupHardware();

    if (!blobToSend || (blobToSend as Blob).size === 0) {
      addToast(t('chat:voice.tooShort'), 'warning');
      onCancel();
      return;
    }

    try {
      const format = getSupportedAudioFormat();
      const ext = format.extension || '.webm';
      const file = new File([blobToSend], `voice-message-${Date.now()}${ext}`, {
        type: (blobToSend as Blob).type,
      });

      const attachment = await uploadVoiceAttachment(file, {
        channelId,
        duration: finalDuration,
        waveform: waveformToSend,
        origin,
      });

      await onSendVoice(attachment);
    } catch (err) {
      console.error('[VoiceRecorderBar] send failed:', err);
      addToast(t('chat:voice.error'), 'warning');
      setState('preview');
    }
  }, [durationSec, previewBlob, finalWaveform, channelId, origin, cleanupHardware, onSendVoice, onCancel, addToast, t]);

  // Preview playback controls
  const handleTogglePreviewPlay = useCallback(() => {
    if (!previewUrl) return;

    if (!previewAudioRef.current) {
      const audio = new Audio(previewUrl);
      audio.playbackRate = previewRate;

      audio.addEventListener('play', () => setPreviewPlaying(true));
      audio.addEventListener('pause', () => setPreviewPlaying(false));
      audio.addEventListener('ended', () => {
        setPreviewPlaying(false);
        setPreviewTime(0);
      });
      audio.addEventListener('timeupdate', () => {
        setPreviewTime(audio.currentTime);
      });

      previewAudioRef.current = audio;
    }

    const audio = previewAudioRef.current;
    if (previewPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => setPreviewPlaying(false));
    }
  }, [previewUrl, previewPlaying, previewRate]);

  const handleTogglePreviewRate = useCallback(() => {
    const rates: Array<1 | 1.5 | 2> = [1, 1.5, 2];
    const nextIdx = (rates.indexOf(previewRate) + 1) % rates.length;
    const next = rates[nextIdx] ?? 1;
    setPreviewRate(next);
    if (previewAudioRef.current) {
      previewAudioRef.current.playbackRate = next;
    }
  }, [previewRate]);

  const handlePreviewScrub = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const target = fraction * durationSec;
    setPreviewTime(target);
    if (previewAudioRef.current) {
      previewAudioRef.current.currentTime = target;
    }
  }, [durationSec]);

  // Render: Preview Mode
  if (state === 'preview' || state === 'sending') {
    const progress = Math.max(0, Math.min(1, previewTime / (durationSec || 1)));
    const activeIndex = Math.floor(progress * finalWaveform.length);

    return (
      <div
        data-testid="voice-recorder-preview"
        className="flex w-full items-center gap-2 px-2 py-1 select-none animate-fadeIn"
      >
        {/* Discard button */}
        <button
          type="button"
          onClick={handleDiscard}
          disabled={state === 'sending'}
          data-testid="voice-discard-button"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-txt-tertiary transition-colors hover:bg-surface-base hover:text-accent-rose disabled:opacity-50"
          title={t('chat:voice.discard')}
          aria-label={t('chat:voice.discard')}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
          </svg>
        </button>

        {/* Play/Pause Preview */}
        <button
          type="button"
          onClick={handleTogglePreviewPlay}
          disabled={state === 'sending'}
          data-testid="voice-preview-play-button"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent-primary text-white shadow-sm transition-transform active:scale-95 disabled:opacity-50"
          title={previewPlaying ? t('chat:voice.pausePlayback') : t('chat:voice.play')}
          aria-label={previewPlaying ? t('chat:voice.pausePlayback') : t('chat:voice.play')}
        >
          {previewPlaying ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="ml-0.5 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Preview Waveform Scrubber */}
        <div
          onPointerDown={handlePreviewScrub}
          className="flex h-8 flex-1 cursor-pointer touch-none items-center gap-[2.5px] px-1 py-1"
        >
          {finalWaveform.map((peak, idx) => {
            const isPlayed = idx <= activeIndex && (previewPlaying || previewTime > 0);
            const heightPercent = Math.max(15, Math.round(peak * 100));
            return (
              <div key={idx} className="flex h-full flex-1 items-center justify-center pointer-events-none">
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full max-w-[3px] rounded-full transition-colors duration-100 ${
                    isPlayed ? 'bg-accent-primary' : 'bg-white/20'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Speed toggle */}
        <button
          type="button"
          onClick={handleTogglePreviewRate}
          disabled={state === 'sending'}
          className="flex h-7 flex-shrink-0 items-center justify-center rounded-full border border-border-hard/70 bg-surface-base px-2 text-[11px] font-semibold tabular-nums text-txt-secondary transition-colors hover:text-txt-primary"
        >
          {previewRate}×
        </button>

        {/* Timer */}
        <span className="tabular-nums font-mono text-[12px] text-txt-tertiary flex-shrink-0">
          {previewPlaying || previewTime > 0
            ? `${formatTimer(previewTime)} / ${formatTimer(durationSec)}`
            : formatTimer(durationSec)}
        </span>

        {/* Send button */}
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={state === 'sending'}
          data-testid="voice-send-button"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-accent-primary text-white shadow-md transition-all hover:bg-accent-primary-hover active:scale-95 disabled:opacity-50"
          title={t('chat:voice.send')}
          aria-label={t('chat:voice.send')}
        >
          {state === 'sending' ? (
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.993.993 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
            </svg>
          )}
        </button>
      </div>
    );
  }

  // Render: Recording / Paused Mode
  return (
    <div
      data-testid="voice-recorder-bar"
      className="flex w-full items-center gap-2.5 px-2 py-1 select-none animate-fadeIn"
    >
      {/* Delete / Cancel button */}
      <button
        type="button"
        onClick={handleDiscard}
        data-testid="voice-discard-button"
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-txt-tertiary transition-colors hover:bg-surface-base hover:text-accent-rose"
        title={t('chat:voice.cancel')}
        aria-label={t('chat:voice.cancel')}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
        </svg>
      </button>

      {/* Recording dot & Timer */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            state === 'recording'
              ? 'bg-accent-rose animate-pulse'
              : 'bg-accent-amber'
          }`}
        />
        <span className="font-mono text-[13px] font-medium tabular-nums text-txt-primary">
          {formatTimer(durationSec)}
        </span>
      </div>

      {/* Live Animated Waveform */}
      <div className="flex h-7 flex-1 items-center gap-[3px] px-1 overflow-hidden pointer-events-none">
        {liveBars.map((peak, idx) => {
          const heightPercent = Math.max(14, Math.round(peak * 100));
          return (
            <div key={idx} className="flex h-full flex-1 items-center justify-center">
              <div
                style={{ height: `${heightPercent}%` }}
                className={`w-full max-w-[3px] rounded-full transition-all duration-75 ${
                  state === 'recording' ? 'bg-accent-primary' : 'bg-accent-amber/70'
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* Pause / Resume Button */}
      <button
        type="button"
        onClick={state === 'recording' ? handlePause : handleResume}
        data-testid="voice-pause-button"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-txt-secondary transition-colors hover:bg-surface-base hover:text-txt-primary"
        title={state === 'recording' ? t('chat:voice.pause') : t('chat:voice.resume')}
        aria-label={state === 'recording' ? t('chat:voice.pause') : t('chat:voice.resume')}
      >
        {state === 'recording' ? (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg className="h-4 w-4 text-accent-amber" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Stop & Review Button */}
      <button
        type="button"
        onClick={handleReview}
        data-testid="voice-review-button"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-txt-secondary transition-colors hover:bg-surface-base hover:text-txt-primary"
        title={t('chat:voice.review')}
        aria-label={t('chat:voice.review')}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 6h12v12H6z" />
        </svg>
      </button>

      {/* Direct Send Button */}
      <button
        type="button"
        onClick={() => void handleSend()}
        data-testid="voice-send-button"
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-accent-primary text-white shadow-md transition-all hover:bg-accent-primary-hover active:scale-95"
        title={t('chat:voice.send')}
        aria-label={t('chat:voice.send')}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.993.993 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
        </svg>
      </button>
    </div>
  );
}
