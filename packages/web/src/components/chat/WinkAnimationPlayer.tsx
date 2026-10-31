import React from 'react';
import { useWinkStore } from '../../stores/winkStore';
import { useChatStore } from '../../stores/chatStore';
import { SparklesIcon } from '../ui/icons';

export function WinkAnimationPlayer() {
  const activeWink = useWinkStore((s) => s.activeWink);
  const dismissActiveWink = useWinkStore((s) => s.dismissActiveWink);
  const playAudio = useWinkStore((s) => s.settings.playAudio);
  const volume = useWinkStore((s) => s.settings.volume);
  const currentChannelId = useChatStore((s) => s.currentChannelId);

  const wink = activeWink ? useWinkStore.getState().getWink(activeWink.winkId) : null;

  if (!activeWink || !wink) return null;
  if (activeWink.channelId && currentChannelId && activeWink.channelId !== currentChannelId) return null;
  if (!wink.webmUrl && !wink.mp4Url) return null;

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
          className="ml-2 pl-2 border-l border-white/10 text-txt-tertiary hover:text-white transition-colors text-[11px] font-medium flex items-center gap-1"
          title="Fechar Wink"
        >
          <span>✕</span> Fechar
        </button>
      </div>

      {/* Main Animation Area */}
      <div className="relative w-full h-full flex items-center justify-center p-4">
        <div className="relative max-w-[90vw] max-h-[80vh] flex items-center justify-center pointer-events-none">
          <video
            ref={(el) => {
              if (el) {
                // Sincronização do volume de áudio com as configurações do Nuvio
                const effectiveVolume = Math.min(1, Math.max(0, (volume / 100) * (wink.defaultVolume ?? 1.0)));
                el.volume = effectiveVolume;
                if (!playAudio || !wink.hasAudio || effectiveVolume === 0) {
                  el.muted = true;
                } else {
                  el.muted = false;
                }
                // Try playing and handle autoplay restrictions gracefully
                const playPromise = el.play();
                if (playPromise !== undefined) {
                  playPromise.catch(() => {
                    // Autoplay with audio was prevented by browser; mute and play visual
                    el.muted = true;
                    el.play().catch(() => {});
                  });
                }
              }
            }}
            autoPlay
            playsInline
            onEnded={dismissActiveWink}
            onError={() => dismissActiveWink()}
            className="max-w-full max-h-[80vh] object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
            style={{ backgroundColor: 'transparent' }}
          >
            {wink.webmUrl && <source src={wink.webmUrl} type="video/webm" />}
            <source src={`/winks/${wink.id}.webm`} type="video/webm" />
            {wink.mp4Url && <source src={wink.mp4Url} type="video/mp4" />}
            <source src={`/winks/${wink.id}.mp4`} type="video/mp4" />
          </video>
        </div>
      </div>
    </div>
  );
}
