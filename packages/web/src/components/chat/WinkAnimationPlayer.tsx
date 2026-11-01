import React, { useState, useEffect, useRef } from 'react';
import { useWinkStore } from '../../stores/winkStore';
import { useChatStore } from '../../stores/chatStore';
import { SparklesIcon } from '../ui/icons';

export function WinkAnimationPlayer() {
  const activeWink = useWinkStore((s) => s.activeWink);
  const dismissActiveWink = useWinkStore((s) => s.dismissActiveWink);
  const startWinkPlaybackTimer = useWinkStore((s) => s.startWinkPlaybackTimer);
  const playAudio = useWinkStore((s) => s.settings.playAudio);
  const volume = useWinkStore((s) => s.settings.volume);
  const currentChannelId = useChatStore((s) => s.currentChannelId);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentFormat, setCurrentFormat] = useState<'webm' | 'mp4'>('webm');
  const [hasTriedFallback, setHasTriedFallback] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const wink = activeWink ? useWinkStore.getState().getWink(activeWink.winkId) : null;

  // Reset format and error states on new wink
  useEffect(() => {
    setCurrentFormat('webm');
    setHasTriedFallback(false);
    setMediaError(null);
  }, [activeWink?.winkId, activeWink?.startedAt]);

  // Determine active media URL based on current format
  const currentMediaSrc = React.useMemo(() => {
    if (!wink) return '';
    if (currentFormat === 'webm') {
      return wink.webmUrl || `/winks/${wink.id}.webm`;
    }
    return wink.mp4Url || `/winks/${wink.id}.mp4`;
  }, [wink, currentFormat]);

  // Handle stable video playback lifecycle and volume
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !wink || !currentMediaSrc || mediaError) return;

    // Volume and audio synchronization
    const effectiveVolume = Math.min(1, Math.max(0, (volume / 100) * (wink.defaultVolume ?? 1.0)));
    video.volume = effectiveVolume;
    video.muted = !playAudio || !wink.hasAudio || effectiveVolume === 0;

    // Load and initiate playback
    video.load();
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // Autoplay policy: try unmuting/muting fallback if browser blocked audio autoplay
        if (video && !video.muted) {
          video.muted = true;
          video.play().catch(() => {});
        }
      });
    }
  }, [wink?.id, activeWink?.startedAt, currentMediaSrc, volume, playAudio, mediaError]);

  if (!activeWink || !wink) return null;
  if (activeWink.channelId && currentChannelId && activeWink.channelId !== currentChannelId) return null;
  if (!wink.webmUrl && !wink.mp4Url) return null;

  const handleLoadedMetadata = () => {
    if (process.env.NODE_ENV !== 'production') {
      const v = videoRef.current;
      console.log(`[WinkPlayer] Metadata loaded: ${wink.id} (${currentFormat}), ${v?.videoWidth}x${v?.videoHeight}`);
    }
  };

  const handleCanPlay = () => {
    // Ready for playback
  };

  const handlePlaying = () => {
    // Browser confirmed video playback has started
    startWinkPlaybackTimer(wink.durationMs);
  };

  const handleEnded = () => {
    // Video reached natural end
    dismissActiveWink();
  };

  const handleStalled = () => {
    console.warn(`[WinkPlayer] Playback stalled: ${wink.id} (${currentFormat})`);
  };

  const handleError = () => {
    const video = videoRef.current;
    const err = video?.error;
    console.warn(`[WinkPlayer] Media error on ${wink.id} (${currentFormat}): code=${err?.code}, msg=${err?.message}`);

    // If WebM failed and MP4 alternative is available, try MP4 fallback
    if (currentFormat === 'webm' && !hasTriedFallback) {
      console.info(`[WinkPlayer] Falling back to MP4 for ${wink.id}`);
      setHasTriedFallback(true);
      setCurrentFormat('mp4');
      return;
    }

    // Both formats or MP4 failed
    setMediaError(`Não foi possível carregar a animação "${wink.name}". Verifique sua conexão.`);
  };

  return (
    <div
      data-testid="wink-animation-player"
      className="absolute inset-0 pointer-events-none z-40 overflow-hidden flex flex-col items-center justify-center select-none"
    >
      {/* Top Banner Indicator with Close Button */}
      <div className="absolute top-4 z-50 pointer-events-auto flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#121318]/90 backdrop-blur-xl border border-white/15 shadow-2xl text-xs text-white animate-in slide-in-from-top-4 duration-200">
        <span className="text-accent-primary animate-pulse">
          <SparklesIcon width="15" height="15" />
        </span>
        <span className="font-medium text-txt-secondary">
          <strong className="text-white font-semibold">{activeWink.senderName}</strong> enviou um Wink:
        </span>
        <span className="text-accent-primary font-semibold flex items-center gap-1">
          {wink.previewEmoji} {wink.name}
        </span>
        <button
          onClick={dismissActiveWink}
          className="ml-2 pl-2 border-l border-white/10 text-txt-tertiary hover:text-white transition-colors text-[11px] font-medium flex items-center gap-1 cursor-pointer"
          title="Fechar Wink"
        >
          <span>✕</span> Fechar
        </button>
      </div>

      {/* Error Banner if all sources failed */}
      {mediaError && (
        <div className="absolute top-16 z-50 pointer-events-auto px-4 py-2 rounded-xl bg-accent-rose/20 backdrop-blur-md border border-accent-rose/40 text-xs text-white flex items-center gap-2 shadow-xl animate-in fade-in duration-200">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-rose">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{mediaError}</span>
          <button
            onClick={dismissActiveWink}
            className="ml-2 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[11px] font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Main Animation Area */}
      <div className="relative w-full h-full flex items-center justify-center p-4">
        <div className="relative max-w-[90vw] max-h-[80vh] flex items-center justify-center pointer-events-none">
          <video
            ref={videoRef}
            src={currentMediaSrc}
            autoPlay
            playsInline
            onLoadedMetadata={handleLoadedMetadata}
            onCanPlay={handleCanPlay}
            onPlaying={handlePlaying}
            onEnded={handleEnded}
            onStalled={handleStalled}
            onError={handleError}
            className="max-w-full max-h-[80vh] object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
            style={{ backgroundColor: 'transparent' }}
          />
        </div>
      </div>
    </div>
  );
}
