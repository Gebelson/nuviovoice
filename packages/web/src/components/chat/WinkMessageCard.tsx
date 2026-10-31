import React from 'react';
import { useWinkStore } from '../../stores/winkStore';
import { SparklesIcon } from '../ui/icons';

interface WinkMessageCardProps {
  winkId: string;
  senderName?: string;
  channelId?: string | null;
}

export function WinkMessageCard({ winkId, senderName, channelId }: WinkMessageCardProps) {
  const wink = useWinkStore((s) => s.getWink(winkId));
  const triggerWink = useWinkStore((s) => s.triggerWink);

  if (!wink) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-txt-secondary">
        <SparklesIcon width="14" height="14" className="text-accent-primary" />
        <span>Wink ({winkId})</span>
      </div>
    );
  }

  const handleReplay = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerWink({
      winkId: wink.id,
      senderName: senderName || 'Você',
      isLocalReplay: true,
      channelId,
    });
  };

  return (
    <div className="my-1.5 max-w-sm rounded-2xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/10 p-3 shadow-lg backdrop-blur-md transition-all hover:border-white/20">
      {/* Top Tag */}
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-txt-tertiary mb-2">
        <SparklesIcon width="13" height="13" className="text-accent-primary" />
        <span>Wink do Nuvio</span>
      </div>

      {/* Wink info */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-accent-primary/15 border border-accent-primary/30 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
          {wink.thumbnailUrl ? (
            <img src={wink.thumbnailUrl} alt={wink.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl">{wink.previewEmoji}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
            <span className="truncate">{wink.name}</span>
            {wink.hasAlpha && (
              <span className="px-1.5 py-0.5 text-[9px] font-normal bg-purple-500/20 text-purple-300 rounded border border-purple-500/30">
                transparente
              </span>
            )}
          </h4>
          <p className="text-[11px] text-txt-secondary truncate">{wink.description}</p>
        </div>
      </div>

      {/* Action: Reproduzir novamente */}
      <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between">
        <span className="text-[10px] text-txt-tertiary">
          Duração: ~{Math.round(wink.durationMs / 1000)}s
        </span>
        <button
          type="button"
          onClick={handleReplay}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.06] hover:bg-accent-primary hover:text-white text-txt-secondary text-xs font-medium transition-all duration-150 cursor-pointer shadow-sm active:scale-95"
          title="Reproduzir este Wink apenas na sua tela"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          <span>Reproduzir novamente</span>
        </button>
      </div>
    </div>
  );
}
