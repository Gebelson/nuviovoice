import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveStreamStore } from '../../stores/liveStreamStore';
import { useSpaceStore } from '../../stores/spaceStore';
import { PlatformIcon, getPlatformBadgeStyle, getPlatformName } from './PlatformIcons';
import { Avatar } from '../ui/Avatar';
import { VerificationBadge } from '../ui/VerificationBadge';
import { formatters } from '../../i18n/formatters';

export function DedicatedLiveStreamView() {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const {
    activeStream,
    openStreamById,
    setPlayerMode,
    toggleNativePip,
    isLoading,
  } = useLiveStreamStore();

  const spaces = useSpaceStore((s) => s.spaces);
  const [joiningSpace] = useState(false);

  useEffect(() => {
    if (channelId && (!activeStream || (activeStream.id !== channelId && activeStream.channelId !== channelId))) {
      openStreamById(channelId);
    }
  }, [channelId, activeStream, openStreamById]);

  useEffect(() => {
    setPlayerMode('main');
  }, [setPlayerMode]);

  if (isLoading && !activeStream) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface-chat">
        <div className="w-12 h-12 border-4 border-accent-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-txt-secondary text-sm font-medium">Carregando transmissão ao vivo...</p>
      </div>
    );
  }

  if (!activeStream) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface-chat text-center">
        <div className="w-16 h-16 rounded-full bg-surface-elevated flex items-center justify-center text-txt-secondary mb-4 border border-border-soft">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
            <polyline points="17 2 12 7 7 2" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-txt-primary mb-2">Transmissão não encontrada ou offline</h2>
        <p className="text-sm text-txt-secondary max-w-md mb-6">
          Esta live pode ter sido encerrada pelo streamer ou não está mais disponível.
        </p>
        <button
          onClick={() => navigate('/channels/@me')}
          className="px-4 py-2 rounded-lg bg-surface-elevated hover:bg-white/[0.04] text-txt-primary text-sm font-medium transition-colors border border-border-soft"
        >
          Voltar para Amigos
        </button>
      </div>
    );
  }

  const badgeStyle = getPlatformBadgeStyle(activeStream.platform);
  const platformTitle = getPlatformName(activeStream.platform);
  const linkedSpace = activeStream.linkedSpace;
  const isMemberOfLinkedSpace = linkedSpace ? spaces.some((s) => s.id === linkedSpace.id) : false;

  const handleSpaceAction = () => {
    if (!linkedSpace) return;
    navigate(`/channels/${linkedSpace.id}`);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-surface-chat flex flex-col items-center p-4 desktop:p-6">
      <div className="w-full max-w-5xl flex flex-col gap-6">
        {/* Dedicated 16:9 Player Anchor Slot */}
        <div className="w-full flex flex-col">
          <div
            id="live-player-portal-anchor"
            className="w-full aspect-video rounded-xl bg-black border border-border-soft/60 shadow-2xl relative overflow-hidden"
          >
            {/* Fallback placeholder while persistent root positions itself */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-txt-secondary/60 pointer-events-none">
              <span className="flex h-3 w-3 relative mb-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <span className="text-xs font-medium">Carregando player oficial...</span>
            </div>
          </div>
        </div>

        {/* Stream & Streamer Details Banner */}
        <div className="flex flex-col desktop:flex-row desktop:items-start justify-between gap-6 bg-surface-elevated/70 border border-border-soft/70 rounded-xl p-5 backdrop-blur-sm shadow-sm">
          {/* Streamer Avatar + Info */}
          <div className="flex items-start gap-4 min-w-0">
            <div className="relative flex-shrink-0">
              <Avatar
                src={activeStream.streamer.avatar || undefined}
                name={activeStream.streamer.displayName || activeStream.streamer.username}
                avatarColor={activeStream.streamer.avatarColor || undefined}
                size={56}
                className="ring-2 ring-red-500 animate-pulse"
              />
              <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 ring-2 ring-surface-base" />
              </span>
            </div>

            <div className="flex flex-col min-w-0">
              {/* Streamer Name + Badges */}
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-txt-primary truncate">
                  {activeStream.streamer.displayName || activeStream.streamer.username}
                </h2>
                {activeStream.streamer.verification && (
                  <VerificationBadge
                    category={activeStream.streamer.verification.category}
                    size="sm"
                  />
                )}
                <span className="text-xs text-txt-secondary font-medium">
                  @{activeStream.streamer.username}
                </span>

                {/* Platform Badge */}
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border} uppercase tracking-wider flex items-center gap-1.5`}
                >
                  <PlatformIcon platform={activeStream.platform} size={12} />
                  {platformTitle}
                </span>

                {/* Viewer count */}
                {activeStream.viewerCount > 0 && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-txt-secondary bg-surface-base/80 px-2 py-0.5 rounded-full border border-border-soft/50">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    {formatters.formatNumber(activeStream.viewerCount)} espectadores
                  </span>
                )}
              </div>

              {/* Stream Title */}
              <h1 className="text-base font-semibold text-txt-primary line-clamp-2 mt-0.5">
                {activeStream.streamTitle || `Live de ${activeStream.channelName}`}
              </h1>

              {/* Category / Game */}
              {activeStream.streamGame && (
                <div className="flex items-center gap-1.5 text-xs text-txt-secondary mt-1.5 font-medium">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="6" y1="12" x2="10" y2="12" />
                    <line x1="8" y1="10" x2="8" y2="14" />
                    <line x1="15" y1="13" x2="15.01" y2="13" />
                    <line x1="18" y1="11" x2="18.01" y2="11" />
                    <rect x="2" y="6" width="20" height="12" rx="2" />
                  </svg>
                  <span>{activeStream.streamGame}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0 desktop:self-start">
            {/* External Platform Link */}
            <a
              href={activeStream.channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface-base hover:bg-white/[0.04] text-txt-primary text-xs font-semibold transition-colors border border-border-soft shadow-sm"
            >
              <PlatformIcon platform={activeStream.platform} size={14} />
              <span>Ir para {platformTitle}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>

            {/* In-App Floating Mode (PiP) */}
            <button
              onClick={() => {
                setPlayerMode('floating');
                navigate('/channels/@me');
              }}
              title="Continuar assistindo em janela flutuante enquanto navega pelo Nuvio"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary text-xs font-semibold transition-colors border border-accent-primary/30 shadow-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <rect x="12" y="10" width="8" height="8" rx="1" fill="currentColor" />
              </svg>
              <span>Janela Flutuante (PiP)</span>
            </button>

            {/* Native Picture-in-Picture */}
            {'documentPictureInPicture' in window && (
              <button
                onClick={() => {
                  const rootEl = document.getElementById('persistent-live-player-root');
                  toggleNativePip(rootEl);
                }}
                title="Destacar player em janela externa nativa sempre visível"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-base hover:bg-white/[0.04] text-txt-secondary hover:text-txt-primary text-xs font-medium transition-colors border border-border-soft"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h6v6" />
                  <path d="M10 14L21 3" />
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                </svg>
                <span>PiP Nativo</span>
              </button>
            )}
          </div>
        </div>

        {/* Streamer's Public Space Card (if linked) */}
        {linkedSpace && (
          <div className="bg-surface-elevated/70 border border-border-soft/70 rounded-xl p-5 backdrop-blur-sm shadow-sm flex flex-col desktop:flex-row desktop:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <Avatar
                src={linkedSpace.icon || undefined}
                name={linkedSpace.name}
                avatarColor={linkedSpace.avatarColor || undefined}
                size={44}
                className="rounded-2xl flex-shrink-0"
              />
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent-primary bg-accent-primary/10 px-2 py-0.5 rounded-full border border-accent-primary/20">
                    Comunidade Oficial
                  </span>
                </div>
                <h3 className="text-base font-bold text-txt-primary truncate mt-0.5">
                  {linkedSpace.name}
                </h3>
                {linkedSpace.description && (
                  <p className="text-xs text-txt-secondary line-clamp-1 mt-0.5">
                    {linkedSpace.description}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleSpaceAction}
              disabled={joiningSpace}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm flex-shrink-0 flex items-center gap-2 ${
                isMemberOfLinkedSpace
                  ? 'bg-surface-base hover:bg-white/[0.04] text-txt-primary border border-border-soft'
                  : 'bg-accent-primary hover:opacity-90 text-white'
              }`}
            >
              {joiningSpace ? (
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
              )}
              <span>{isMemberOfLinkedSpace ? 'Acessar Espaço' : 'Conhecer ou Participar'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
