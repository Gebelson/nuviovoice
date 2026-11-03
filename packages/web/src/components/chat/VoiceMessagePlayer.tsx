import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Attachment } from '@concord/shared';
import { attUrlOf } from './AttachmentRenderer';
import { getOrExtractWaveform } from '../../utils/waveform';
import { audioCoordinator } from '../../utils/audioCoordinator';
import { useFormatters } from '../../i18n/formatters';

interface VoiceMessagePlayerProps {
  attachment: Attachment;
  attUrl?: string;
  federationInlineBadge?: React.ReactNode;
}

const PLAYBACK_RATES = [1, 1.5, 2] as const;
type PlaybackRate = (typeof PLAYBACK_RATES)[number];
const BAR_COUNT = 38;

/** Format a duration in seconds as `m:ss` (or `h:mm:ss` for long clips). */
function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '0:00';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VoiceMessagePlayer({
  attachment,
  attUrl: passedUrl,
  federationInlineBadge,
}: VoiceMessagePlayerProps) {
  const { t } = useTranslation(['chat', 'common']);
  const { formatBytes } = useFormatters();

  const attUrl = passedUrl ?? attUrlOf(attachment.filename);
  const isVoiceNote = attachment.originalName.startsWith('voice-message');

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(attachment.duration ?? 0);
  const [rate, setRate] = useState<PlaybackRate>(1);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [waveformBars, setWaveformBars] = useState<number[]>(() => {
    if (attachment.waveform) {
      try {
        const parsed = JSON.parse(attachment.waveform);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return [];
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformContainerRef = useRef<HTMLDivElement | null>(null);

  // Load waveform data if not already present in attachment
  useEffect(() => {
    let mounted = true;
    if (waveformBars.length === 0) {
      void getOrExtractWaveform(attUrl, attachment.waveform, BAR_COUNT).then((bars) => {
        if (mounted && bars && bars.length > 0) {
          setWaveformBars(bars);
        }
      });
    }
    return () => {
      mounted = false;
    };
  }, [attUrl, attachment.waveform, waveformBars.length]);

  // Cleanup on unmount
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) {
        audioCoordinator.releasePlayback(audio);
        audio.pause();
        audio.src = '';
      }
    };
  }, []);

  const handleAudioInit = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.src = attUrl;
      audio.playbackRate = rate;

      audio.addEventListener('play', () => {
        setIsPlaying(true);
        audioCoordinator.claimPlayback(audio, () => {
          setIsPlaying(false);
        });
      });

      audio.addEventListener('pause', () => {
        setIsPlaying(false);
      });

      audio.addEventListener('waiting', () => {
        setIsLoading(true);
      });

      audio.addEventListener('playing', () => {
        setIsLoading(false);
      });

      audio.addEventListener('canplay', () => {
        setIsLoading(false);
      });

      audio.addEventListener('timeupdate', () => {
        if (!isScrubbing) {
          setCurrentTime(audio.currentTime);
        }
      });

      audio.addEventListener('loadedmetadata', () => {
        if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
          setDuration(audio.duration);
        }
      });

      audio.addEventListener('durationchange', () => {
        if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
          setDuration(audio.duration);
        }
      });

      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setCurrentTime(0);
        audioCoordinator.releasePlayback(audio);
      });

      audio.addEventListener('error', () => {
        setIsLoading(false);
        setIsPlaying(false);
        setHasError(true);
      });

      audioRef.current = audio;
    }
    return audioRef.current;
  }, [attUrl, rate, isScrubbing]);

  const togglePlay = useCallback(() => {
    if (hasError) {
      setHasError(false);
      if (audioRef.current) {
        audioRef.current.load();
      }
    }

    const audio = handleAudioInit();
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.warn('[VoicePlayer] playback failed:', err);
        setHasError(true);
        setIsPlaying(false);
      });
    }
  }, [isPlaying, hasError, handleAudioInit]);

  const toggleRate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIdx = (PLAYBACK_RATES.indexOf(rate) + 1) % PLAYBACK_RATES.length;
    const nextRate = PLAYBACK_RATES[nextIdx] ?? 1;
    setRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  }, [rate]);

  // Waveform click / scrub interaction
  const calculateScrubFraction = useCallback((clientX: number): number => {
    const container = waveformContainerRef.current;
    if (!container) return 0;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const fraction = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(1, fraction));
  }, []);

  const seekToFraction = useCallback((fraction: number) => {
    const targetDuration = duration || attachment.duration || 0;
    const newTime = fraction * targetDuration;
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  }, [duration, attachment.duration]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsScrubbing(true);

    const fraction = calculateScrubFraction(e.clientX);
    seekToFraction(fraction);

    const target = e.currentTarget as HTMLElement;
    if (typeof target.setPointerCapture === 'function') {
      try {
        target.setPointerCapture(e.pointerId);
      } catch {}
    }
  }, [calculateScrubFraction, seekToFraction]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isScrubbing) return;
    e.preventDefault();
    e.stopPropagation();
    const fraction = calculateScrubFraction(e.clientX);
    seekToFraction(fraction);
  }, [isScrubbing, calculateScrubFraction, seekToFraction]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isScrubbing) return;
    setIsScrubbing(false);
    const target = e.currentTarget as HTMLElement;
    if (typeof target.releasePointerCapture === 'function') {
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {}
    }
  }, [isScrubbing]);

  // Derived progress fraction
  const effectiveDuration = duration || attachment.duration || 1;
  const progressFraction = Math.max(0, Math.min(1, currentTime / effectiveDuration));
  const activeBarIndex = Math.floor(progressFraction * (waveformBars.length || BAR_COUNT));

  // Default bars if not ready
  const bars = useMemo(() => {
    if (waveformBars.length > 0) return waveformBars;
    return Array.from({ length: BAR_COUNT }, (_, i) => 0.25 + 0.5 * Math.sin((i / BAR_COUNT) * Math.PI));
  }, [waveformBars]);

  return (
    <div
      data-testid="voice-message-player"
      className="mt-1 w-full max-w-[420px] select-none rounded-2xl border border-border-hard/70 bg-surface-channel/70 p-3 shadow-sm transition-all hover:bg-surface-channel/90 group/voice"
    >
      {/* Top Row: Play/Pause button, Waveform scrubber, Rate toggle */}
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          disabled={hasError}
          data-testid="voice-play-button"
          aria-label={isPlaying ? t('chat:voice.pausePlayback') : t('chat:voice.play')}
          title={isPlaying ? t('chat:voice.pausePlayback') : t('chat:voice.play')}
          className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent-primary text-white shadow-md transition-all duration-150 hover:bg-accent-primary-hover active:scale-95 disabled:opacity-50"
        >
          {isLoading ? (
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : hasError ? (
            <svg className="h-5 w-5 text-accent-rose" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
          ) : isPlaying ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="ml-0.5 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Waveform Scrubber */}
        <div
          ref={waveformContainerRef}
          data-testid="voice-waveform-scrubber"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative flex h-9 flex-1 cursor-pointer touch-none items-center gap-[2.5px] px-1 py-1"
          role="slider"
          aria-label={t('chat:voice.voiceMessage')}
          aria-valuemin={0}
          aria-valuemax={effectiveDuration}
          aria-valuenow={currentTime}
        >
          {bars.map((peak, idx) => {
            const isPlayed = idx <= activeBarIndex && (isPlaying || currentTime > 0);
            const heightPercent = Math.max(15, Math.round(peak * 100));

            return (
              <div
                key={idx}
                className="flex h-full flex-1 items-center justify-center pointer-events-none"
              >
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full max-w-[3.5px] rounded-full transition-colors duration-100 ${
                    isPlayed
                      ? 'bg-accent-primary'
                      : 'bg-white/20 group-hover/voice:bg-white/25'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Playback Speed Button */}
        <button
          type="button"
          onClick={toggleRate}
          data-testid="voice-rate-button"
          aria-label={t('chat:voice.playbackSpeed')}
          title={t('chat:voice.playbackSpeed')}
          className="flex h-7 flex-shrink-0 items-center justify-center rounded-full border border-border-hard/70 bg-surface-base/80 px-2.5 text-[11px] font-semibold tabular-nums text-txt-secondary transition-colors hover:border-accent-primary/60 hover:text-txt-primary"
        >
          {rate}×
        </button>
      </div>

      {/* Bottom Row: Metadata label, federation badge, and timer */}
      <div className="flex items-center justify-between pt-0.5 text-[12px] text-txt-tertiary">
        <div className="flex min-w-0 items-center gap-1.5">
          {hasError ? (
            <span className="font-medium text-accent-rose">{t('chat:voice.unavailable')}</span>
          ) : isVoiceNote ? (
            <div className="flex items-center gap-1.5 text-txt-secondary">
              <svg className="h-3.5 w-3.5 text-accent-primary flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
              <span className="font-medium truncate">{t('chat:voice.voiceMessage')}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 truncate">
              <span className="truncate font-medium text-txt-primary">{attachment.originalName}</span>
              <span>·</span>
              <span>{formatBytes(attachment.size)}</span>
            </div>
          )}
          {federationInlineBadge}
        </div>

        {/* Time display: 0:00 / 0:12 while playing, or 0:12 when idle */}
        <div className="tabular-nums font-mono text-[11px] text-txt-tertiary flex-shrink-0">
          {isPlaying || currentTime > 0
            ? `${formatDuration(currentTime)} / ${formatDuration(effectiveDuration)}`
            : formatDuration(effectiveDuration)}
        </div>
      </div>
    </div>
  );
}
