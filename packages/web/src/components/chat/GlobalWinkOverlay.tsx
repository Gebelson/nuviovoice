import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useWinkStore } from '../../stores/winkStore';
import { SparklesIcon } from '../ui/icons';
import { WinkWebGLRenderer, WinkWebGLRendererHandle } from './WinkWebGLRenderer';

export function GlobalWinkOverlay() {
  let navigate: (to: string) => void = () => {};
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    navigate = useNavigate();
  } catch {
    // Graceful fallback for non-routed tests or environments
  }
  const activeWink = useWinkStore((s) => s.activeWink);
  const queue = useWinkStore((s) => s.queue);
  const dismissActiveWink = useWinkStore((s) => s.dismissActiveWink);
  const startWinkPlaybackTimer = useWinkStore((s) => s.startWinkPlaybackTimer);
  const playAudio = useWinkStore((s) => s.settings.playAudio);
  const volume = useWinkStore((s) => s.settings.volume);
  const reduceMotion = useWinkStore((s) => s.settings.reduceMotion);
  const isAutoplayBlocked = useWinkStore((s) => s.isAutoplayBlocked);
  const setAutoplayBlocked = useWinkStore((s) => s.setAutoplayBlocked);
  const unlockAudio = useWinkStore((s) => s.unlockAudio);
  const audioUnlocked = useWinkStore((s) => s.audioUnlocked);

  const videoRef = useRef<HTMLVideoElement>(null);
  const webglRef = useRef<WinkWebGLRendererHandle>(null);

  // Browser detection: Safari (iOS & macOS) lacks WebM VP9 alpha support and requires WebGL alpha composition
  const isSafari = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return /^((?!chrome|android).)*safari/i.test(ua);
  }, []);

  // Format selection: 'webm' | 'webgl-alpha' | 'mp4-standard'
  const [engine, setEngine] = useState<'webm' | 'webgl-alpha' | 'mp4-standard'>(
    isSafari ? 'webgl-alpha' : 'webm'
  );
  const [hasTriedFallback, setHasTriedFallback] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const wink = activeWink ? useWinkStore.getState().getWink(activeWink.winkId) : null;

  // Reset engine and error states when a new active wink begins
  useEffect(() => {
    setEngine(isSafari ? 'webgl-alpha' : 'webm');
    setHasTriedFallback(false);
    setMediaError(null);
  }, [activeWink?.winkId, activeWink?.startedAt, isSafari]);

  // Audio configuration
  const effectiveVolume = useMemo(() => {
    if (!wink) return 0.8;
    return Math.min(1, Math.max(0, (volume / 100) * (wink.defaultVolume ?? 1.0)));
  }, [wink, volume]);

  const shouldMute = useMemo(() => {
    if (!playAudio || !wink?.hasAudio || effectiveVolume === 0) return true;
    if (isAutoplayBlocked && !audioUnlocked) return true;
    return false;
  }, [playAudio, wink?.hasAudio, effectiveVolume, isAutoplayBlocked, audioUnlocked]);

  // Handle native video playback when using 'webm' or 'mp4-standard'
  useEffect(() => {
    if (engine === 'webgl-alpha') return;
    const video = videoRef.current;
    if (!video || !wink || mediaError) return;

    video.volume = effectiveVolume;
    video.muted = shouldMute;

    video.load();
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        if (err.name === 'NotAllowedError') {
          // Autoplay with audio was blocked by browser
          setAutoplayBlocked(true);
          video.muted = true;
          video.play().catch(() => {});
        } else {
          console.warn('[GlobalWink] Play error:', err);
        }
      });
    }
  }, [wink?.id, activeWink?.startedAt, engine, effectiveVolume, shouldMute, mediaError, setAutoplayBlocked]);

  // Handle WebGL renderer play and autoplay rejection
  useEffect(() => {
    if (engine !== 'webgl-alpha') return;
    const webgl = webglRef.current;
    if (!webgl || !wink || mediaError) return;

    webgl.load();
    const playPromise = webgl.play();
    if (playPromise !== undefined) {
      playPromise.catch((err: any) => {
        if (err?.name === 'NotAllowedError') {
          setAutoplayBlocked(true);
          const v = webgl.getVideo();
          if (v) {
            v.muted = true;
            v.play().catch(() => {});
          }
        }
      });
    }
  }, [wink?.id, activeWink?.startedAt, engine, mediaError, setAutoplayBlocked]);

  if (!activeWink || !wink) return null;

  const handleLoadedMetadata = () => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[GlobalWink] Metadata loaded for ${wink.id} (engine: ${engine})`);
    }
  };

  const handlePlaying = () => {
    // Browser confirmed video playback has started -> start safe duration timer
    startWinkPlaybackTimer(wink.durationMs);
  };

  const handleEnded = () => {
    // Animation reached its natural end
    dismissActiveWink();
  };

  const handleError = () => {
    console.warn(`[GlobalWink] Error on engine ${engine} for ${wink.id}`);

    // If WebM or WebGL-Alpha failed, fallback to standard MP4
    if (engine !== 'mp4-standard' && !hasTriedFallback) {
      console.info(`[GlobalWink] Falling back from ${engine} to standard MP4 for ${wink.id}`);
      setHasTriedFallback(true);
      setEngine('mp4-standard');
      return;
    }

    setMediaError(`Não foi possível carregar a animação "${wink.name}". Verifique sua conexão.`);
  };

  const handleManualUnmute = () => {
    unlockAudio();
    if (engine === 'webgl-alpha') {
      const v = webglRef.current?.getVideo();
      if (v) {
        v.muted = false;
        v.volume = effectiveVolume;
      }
    } else if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = effectiveVolume;
    }
  };

  const handleViewConversation = () => {
    if (activeWink.channelId) {
      dismissActiveWink();
      navigate(`/channels/@me/${activeWink.channelId}`);
    }
  };

  const activeMediaSrc =
    engine === 'webm'
      ? wink.webmUrl || `/winks/${wink.id}.webm`
      : engine === 'webgl-alpha'
      ? wink.alphaMp4Url || `/winks/${wink.id}_alpha.mp4`
      : wink.mp4Url || `/winks/${wink.id}.mp4`;

  const overlayContent = (
    <div
      data-testid="wink-animation-player"
      className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden flex flex-col items-center justify-center select-none"
      style={{
        backgroundColor: 'transparent',
      }}
    >
      {/* Top Banner Indicator with Controls */}
      <div className="absolute top-4 sm:top-6 z-[10000] pointer-events-auto flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#121318]/92 backdrop-blur-2xl border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.7)] text-xs text-white animate-in slide-in-from-top-4 duration-200 max-w-[calc(100vw-32px)]">
        <span className="text-accent-primary animate-pulse shrink-0">
          <SparklesIcon width="16" height="16" />
        </span>

        <span className="font-medium text-txt-secondary truncate">
          <strong className="text-white font-semibold">{activeWink.senderName}</strong> enviou um Wink:
        </span>

        <span className="text-accent-primary font-semibold flex items-center gap-1 shrink-0">
          {wink.previewEmoji} <span className="hidden xs:inline">{wink.name}</span>
        </span>

        {/* Queue counter badge */}
        {queue.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-accent-primary/20 text-accent-primary text-[10px] font-semibold border border-accent-primary/30 shrink-0">
            +{queue.length}
          </span>
        )}

        {/* Audio Unmute Action if browser autoplay blocked it */}
        {isAutoplayBlocked && wink.hasAudio && (
          <button
            type="button"
            onClick={handleManualUnmute}
            className="ml-1 px-2.5 py-1 rounded-full bg-accent-primary hover:bg-accent-primary-hover text-white text-[11px] font-medium transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0 animate-bounce"
            title="Ativar áudio deste Wink"
          >
            <span>🔊</span> Ativar som
          </button>
        )}

        {/* Optional 'Ver conversa' action */}
        {activeWink.channelId && (
          <button
            type="button"
            onClick={handleViewConversation}
            className="hidden sm:flex ml-1 text-txt-secondary hover:text-white transition-colors text-[11px] font-medium items-center gap-1 cursor-pointer shrink-0"
            title="Abrir a conversa privada deste Wink"
          >
            <span>💬</span> Ver conversa
          </button>
        )}

        {/* Close button */}
        <button
          type="button"
          onClick={dismissActiveWink}
          className="ml-2 pl-2 border-l border-white/15 text-txt-tertiary hover:text-white transition-colors text-[11px] font-medium flex items-center gap-1 cursor-pointer shrink-0"
          title="Fechar Wink"
        >
          <span>✕</span> Fechar
        </button>
      </div>

      {/* Error Banner if all sources failed */}
      {mediaError && (
        <div className="absolute top-20 z-[10000] pointer-events-auto px-4 py-2.5 rounded-xl bg-accent-rose/25 backdrop-blur-xl border border-accent-rose/40 text-xs text-white flex items-center gap-2.5 shadow-2xl animate-in fade-in duration-200">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-rose shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{mediaError}</span>
          <button
            onClick={dismissActiveWink}
            className="ml-2 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-medium transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Main Animation Area */}
      <div className="relative w-full h-full flex items-center justify-center p-2 sm:p-6 pointer-events-none">
        {/*
          Adaptive Mobile & Desktop Frame:
          On mobile portrait screens, the active character is centered and enlarged
          to fill 94% of the screen width and 75% of screen height via a 1:1 container
          with 177.78% video width (cropping empty transparent sides without clipping the character).
          On desktop / landscape, the container displays full bounds up to 85vw x 80vh.
        */}
        <div
          className={`relative flex items-center justify-center pointer-events-none transition-all duration-300 ${
            reduceMotion ? 'opacity-80 scale-95' : ''
          } w-[min(94vw,75vh)] h-[min(94vw,75vh)] aspect-square overflow-hidden sm:w-auto sm:h-auto sm:aspect-auto sm:overflow-visible sm:max-w-[85vw] sm:max-h-[80vh]`}
        >
          <div className="w-[177.78%] h-full flex items-center justify-center sm:w-full sm:h-full sm:max-w-[85vw] sm:max-h-[80vh] pointer-events-none">
            {engine === 'webgl-alpha' ? (
              <WinkWebGLRenderer
                ref={webglRef}
                src={activeMediaSrc}
                volume={effectiveVolume}
                muted={shouldMute}
                onLoadedMetadata={handleLoadedMetadata}
                onCanPlay={() => {}}
                onPlaying={handlePlaying}
                onEnded={handleEnded}
                onError={handleError}
                className="w-full h-full object-contain drop-shadow-[0_20px_60px_rgba(0,0,0,0.65)]"
                style={{ backgroundColor: 'transparent' }}
              />
            ) : (
              <video
                ref={videoRef}
                src={activeMediaSrc}
                autoPlay
                playsInline
                crossOrigin="anonymous"
                onLoadedMetadata={handleLoadedMetadata}
                onCanPlay={() => {}}
                onPlaying={handlePlaying}
                onEnded={handleEnded}
                onError={handleError}
                className="w-full h-full max-h-[80vh] object-contain drop-shadow-[0_20px_60px_rgba(0,0,0,0.65)]"
                style={{ backgroundColor: 'transparent' }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(overlayContent, document.body);
}
