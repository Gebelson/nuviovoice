import React, { useEffect, useState } from 'react';
import { useWinkStore } from '../../stores/winkStore';
import { useChatStore } from '../../stores/chatStore';
import { getOfficialWink } from '@concord/shared/src/winks';
import { SparklesIcon } from '../ui/icons';

export function WinkAnimationPlayer() {
  const activeWink = useWinkStore((s) => s.activeWink);
  const dismissActiveWink = useWinkStore((s) => s.dismissActiveWink);
  const reduceMotion = useWinkStore((s) => s.settings.reduceMotion);
  const playAudio = useWinkStore((s) => s.settings.playAudio);
  const volume = useWinkStore((s) => s.settings.volume);
  const currentChannelId = useChatStore((s) => s.currentChannelId);
  const [screenShake, setScreenShake] = useState(false);

  const wink = activeWink ? useWinkStore.getState().getWink(activeWink.winkId) : null;

  // Screen shake effect for knocking-screen wink
  useEffect(() => {
    if (activeWink?.winkId === 'knocking-screen' && !reduceMotion) {
      const t1 = setTimeout(() => setScreenShake(true), 200);
      const t2 = setTimeout(() => setScreenShake(false), 500);
      const t3 = setTimeout(() => setScreenShake(true), 800);
      const t4 = setTimeout(() => setScreenShake(false), 1200);
      const t5 = setTimeout(() => setScreenShake(true), 1500);
      const t6 = setTimeout(() => setScreenShake(false), 1900);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
        clearTimeout(t5);
        clearTimeout(t6);
      };
    }
    setScreenShake(false);
  }, [activeWink?.winkId, reduceMotion]);

  if (!activeWink || !wink) return null;
  if (activeWink.channelId && currentChannelId && activeWink.channelId !== currentChannelId) return null;

  return (
    <div
      data-testid="wink-animation-player"
      className={`absolute inset-0 pointer-events-none z-40 overflow-hidden flex flex-col items-center justify-center select-none ${
        screenShake ? 'animate-bounce translate-x-1' : ''
      }`}
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

      {/* Main Animation Arena */}
      <div className="relative w-full h-full flex items-center justify-center p-6">
        {wink.webmUrl || wink.mp4Url ? (
          <div className="relative max-w-[85vw] max-h-[75vh] flex items-center justify-center pointer-events-none">
            <video
              ref={(el) => {
                if (el) {
                  el.volume = Math.min(1, Math.max(0, (volume / 100) * (wink.defaultVolume ?? 1.0)));
                }
              }}
              autoPlay
              playsInline
              muted={!playAudio || !wink.hasAudio}
              onEnded={dismissActiveWink}
              onError={() => dismissActiveWink()}
              className="max-w-full max-h-[75vh] object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
              style={{ backgroundColor: 'transparent' }}
            >
              {wink.webmUrl && <source src={wink.webmUrl} type="video/webm" />}
              {wink.mp4Url && <source src={wink.mp4Url} type="video/mp4" />}
            </video>
          </div>
        ) : (
          renderWinkVisual(wink.id, reduceMotion)
        )}
      </div>
    </div>
  );
}

function renderWinkVisual(winkId: string, reduceMotion: boolean) {
  if (reduceMotion) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-3xl bg-black/60 backdrop-blur-xl border border-white/10 text-center animate-in fade-in duration-300">
        <div className="text-7xl mb-3 animate-pulse">{getEmojiForWink(winkId)}</div>
        <div className="text-xl font-bold text-white mb-1">{getNameForWink(winkId)}</div>
        <div className="text-xs text-txt-secondary">Animação reproduzida</div>
      </div>
    );
  }

  switch (winkId) {
    case 'kiss':
      return (
        <div className="relative flex flex-col items-center justify-center">
          {/* Giant Flying Kiss Lips */}
          <div className="text-9xl animate-in zoom-in-50 duration-500 scale-125 transition-transform animate-pulse drop-shadow-[0_0_50px_rgba(244,63,94,0.8)]">
            💋
          </div>
          {/* Imprint stamp */}
          <div className="absolute inset-0 flex items-center justify-center opacity-80 animate-ping duration-1000">
            <span className="text-8xl">💋</span>
          </div>
          {/* Floating mini hearts */}
          <div className="absolute -top-12 left-1/4 text-3xl animate-bounce">💖</div>
          <div className="absolute -top-8 right-1/4 text-4xl animate-bounce delay-150">💕</div>
          <div className="absolute -bottom-10 text-3xl animate-pulse">✨</div>
        </div>
      );

    case 'giant-heart':
      return (
        <div className="relative flex items-center justify-center">
          <div className="w-56 h-56 rounded-full bg-pink-500/20 blur-3xl absolute animate-ping duration-1000" />
          <div className="text-[140px] leading-none animate-bounce duration-300 drop-shadow-[0_0_60px_rgba(236,72,153,0.9)]">
            💖
          </div>
          <div className="absolute text-5xl -top-6 -right-6 animate-pulse">✨</div>
          <div className="absolute text-4xl -bottom-4 -left-6 animate-pulse delay-200">💗</div>
        </div>
      );

    case 'heart-rain':
      return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(24)].map((_, i) => (
            <div
              key={i}
              className="absolute text-3xl sm:text-4xl animate-in slide-in-from-top-full duration-1000"
              style={{
                left: `${(i * 100) / 24}%`,
                top: `${((i * 37) % 85) + 5}%`,
                animationDelay: `${(i * 0.15).toFixed(2)}s`,
                opacity: 0.85,
                transform: `scale(${0.7 + (i % 5) * 0.15})`,
              }}
            >
              {['💖', '💕', '💗', '💓', '💘', '💝'][i % 6]}
            </div>
          ))}
        </div>
      );

    case 'confetti':
      return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
          <div className="text-8xl mb-6 animate-bounce">🎉</div>
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-sm animate-spin"
              style={{
                width: `${8 + (i % 4) * 4}px`,
                height: `${12 + (i % 3) * 6}px`,
                backgroundColor: ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][i % 6],
                left: `${(i * 73) % 95}%`,
                top: `${(i * 47) % 90}%`,
                transform: `rotate(${i * 45}deg)`,
                opacity: 0.9,
              }}
            />
          ))}
        </div>
      );

    case 'popping-balloon':
      return (
        <div className="relative flex flex-col items-center justify-center">
          <div className="text-[120px] leading-none animate-in zoom-in-0 duration-700 hover:scale-125 transition-transform drop-shadow-[0_0_40px_rgba(239,68,68,0.7)]">
            🎈
          </div>
          <div className="text-4xl mt-2 animate-ping">💥</div>
        </div>
      );

    case 'laughing-face':
      return (
        <div className="relative flex items-center justify-center">
          <div className="text-[130px] leading-none animate-spin duration-1000 drop-shadow-[0_0_50px_rgba(234,179,8,0.8)]">
            😂
          </div>
          <div className="absolute -left-12 text-5xl animate-bounce">💦</div>
          <div className="absolute -right-12 text-5xl animate-bounce delay-100">💦</div>
        </div>
      );

    case 'crying-face':
      return (
        <div className="relative flex flex-col items-center justify-center">
          <div className="text-[130px] leading-none animate-pulse drop-shadow-[0_0_50px_rgba(59,130,246,0.8)]">
            😭
          </div>
          <div className="flex gap-16 mt-2 text-4xl animate-bounce">
            <span>🌊</span>
            <span>🌊</span>
          </div>
        </div>
      );

    case 'angry-face':
      return (
        <div className="relative flex items-center justify-center">
          <div className="w-48 h-48 rounded-full bg-red-600/30 blur-2xl absolute animate-pulse" />
          <div className="text-[130px] leading-none animate-bounce drop-shadow-[0_0_60px_rgba(220,38,38,0.9)]">
            😡
          </div>
          <div className="absolute -top-10 text-4xl animate-pulse">💨</div>
          <div className="absolute -bottom-8 text-4xl animate-pulse">⚡</div>
        </div>
      );

    case 'shooting-stars':
      return (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          <div className="text-[120px] animate-pulse drop-shadow-[0_0_60px_rgba(250,204,21,0.9)]">
            🌠
          </div>
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute text-3xl animate-ping"
              style={{
                left: `${(i * 63) % 90}%`,
                top: `${(i * 81) % 80}%`,
                animationDelay: `${i * 0.2}s`,
              }}
            >
              ⭐
            </div>
          ))}
        </div>
      );

    case 'blooming-flower':
      return (
        <div className="relative flex items-center justify-center">
          <div className="text-[130px] leading-none animate-in zoom-in-0 spin-in-180 duration-1000 drop-shadow-[0_0_50px_rgba(244,114,182,0.8)]">
            🌸
          </div>
          <div className="absolute -top-8 -right-8 text-4xl animate-bounce">🦋</div>
          <div className="absolute -bottom-6 -left-6 text-3xl animate-pulse">✨</div>
        </div>
      );

    case 'warm-hug':
      return (
        <div className="relative flex items-center justify-center">
          <div className="text-[130px] leading-none animate-pulse drop-shadow-[0_0_50px_rgba(251,191,36,0.8)]">
            🤗
          </div>
          <div className="absolute inset-x-[-40px] flex justify-between text-5xl animate-in slide-in-from-left-8 duration-500">
            <span>💛</span>
            <span>💛</span>
          </div>
        </div>
      );

    case 'funky-dance':
      return (
        <div className="relative flex flex-col items-center justify-center">
          <div className="text-[130px] leading-none animate-bounce duration-200 drop-shadow-[0_0_60px_rgba(168,85,247,0.9)]">
            🕺
          </div>
          <div className="flex gap-4 text-3xl mt-2 animate-pulse">
            <span>🪩</span>
            <span>🎶</span>
            <span>✨</span>
          </div>
        </div>
      );

    case 'fireworks':
      return (
        <div className="relative flex items-center justify-center">
          <div className="text-[140px] leading-none animate-ping duration-700 drop-shadow-[0_0_80px_rgba(236,72,153,0.9)]">
            🎆
          </div>
          <div className="absolute text-5xl -top-12 -left-12 animate-pulse">✨</div>
          <div className="absolute text-5xl -bottom-12 -right-12 animate-pulse delay-200">🎇</div>
        </div>
      );

    case 'in-love':
      return (
        <div className="relative flex items-center justify-center">
          <div className="text-[130px] leading-none animate-pulse drop-shadow-[0_0_60px_rgba(244,63,94,0.9)]">
            😍
          </div>
          <div className="absolute -top-10 text-5xl animate-bounce">💕</div>
          <div className="absolute -bottom-8 text-4xl animate-bounce delay-150">💖</div>
        </div>
      );

    case 'knocking-screen':
      return (
        <div className="relative flex flex-col items-center justify-center">
          {/* Glass impact ripples */}
          <div className="w-64 h-64 rounded-full border-4 border-white/60 animate-ping duration-700 absolute" />
          <div className="w-48 h-48 rounded-full border-2 border-accent-primary/80 animate-ping duration-500 absolute delay-150" />
          {/* Knocking Fist */}
          <div className="text-[130px] leading-none animate-bounce duration-150 drop-shadow-[0_0_60px_rgba(255,255,255,0.9)]">
            ✊
          </div>
          <div className="text-xl font-black text-white bg-black/60 px-4 py-1 rounded-full mt-4 border border-white/20 animate-pulse tracking-widest">
            *TOC TOC TOC*
          </div>
        </div>
      );

    case 'surprise-gift':
      return (
        <div className="relative flex flex-col items-center justify-center">
          <div className="text-[130px] leading-none animate-bounce duration-300 drop-shadow-[0_0_60px_rgba(234,179,8,0.9)]">
            🎁
          </div>
          <div className="absolute -top-12 text-6xl animate-in zoom-in-0 duration-500">🥳</div>
          <div className="absolute -bottom-6 text-4xl animate-pulse">✨</div>
        </div>
      );

    default:
      return (
        <div className="text-9xl animate-pulse">✨</div>
      );
  }
}

function getEmojiForWink(id: string): string {
  const w = getOfficialWink(id);
  return w?.previewEmoji ?? '✨';
}

function getNameForWink(id: string): string {
  const w = getOfficialWink(id);
  return w?.name ?? 'Wink';
}
