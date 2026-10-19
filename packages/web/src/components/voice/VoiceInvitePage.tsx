import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import { HttpError } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { useSpaceStore } from '../../stores/spaceStore';
import { joinVoiceChannel } from '../../utils/voice';
import { Avatar } from '../ui/Avatar';
import type { VoiceInvitePreview } from '@concord/shared';

export function VoiceInvitePage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation(['voice', 'auth', 'common', 'spaces']);
  const navigate = useNavigate();

  const authToken = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const currentVoiceChannelId = useVoiceStore((s) => s.currentVoiceChannelId);

  const [preview, setPreview] = useState<VoiceInvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [errorKind, setErrorKind] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSwitchCallConfirm, setShowSwitchCallConfirm] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function fetchPreview() {
      setLoading(true);
      setErrorKind(null);
      setErrorMessage(null);
      try {
        const res = await api.voiceInvites.preview(token!);
        if (!cancelled) setPreview(res);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof HttpError) {
          const code = (err as any).code;
          if (code === 'invite_expired') {
            setErrorKind('expired');
          } else if (code === 'invite_revoked') {
            setErrorKind('revoked');
          } else if (code === 'max_uses_reached') {
            setErrorKind('max_uses');
          } else {
            setErrorKind('not_found');
          }
        } else {
          setErrorKind('network');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPreview();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const executeJoin = async () => {
    if (!token || !preview) return;
    setJoining(true);
    setErrorMessage(null);

    try {
      // 1. Join space & validate channel access
      const res = await api.voiceInvites.join(token);

      // Refresh spaces list in store
      const spaces = await api.spaces.list();
      useSpaceStore.getState().setSpaces(spaces.map((s) => ({ ...s, _instanceOrigin: '' })));

      // 2. Navigate to channel
      navigate(`/channels/${res.space.id}/${res.channel.id}`);

      // 3. Connect to voice channel directly
      const connectFn = useVoiceStore.getState().connectFn ?? undefined;
      joinVoiceChannel(res.channel.id, connectFn);
    } catch (err) {
      if (err instanceof HttpError) {
        const code = (err as any).code;
        if (code === 'user_banned') {
          setErrorMessage('Você foi banido deste espaço.');
        } else if (code === 'voice_connect_forbidden') {
          setErrorMessage('Você não possui permissão para conectar neste canal de voz.');
        } else {
          setErrorMessage('Falha ao entrar na chamada. Tente novamente.');
        }
      } else {
        setErrorMessage('Erro de conexão ao entrar na chamada.');
      }
    } finally {
      setJoining(false);
    }
  };

  const handleJoinClick = () => {
    if (!preview) return;
    // Check if user is already in another voice channel
    if (currentVoiceChannelId && currentVoiceChannelId !== preview.channel.id) {
      setShowSwitchCallConfirm(true);
      return;
    }
    executeJoin();
  };

  const redirectUrl = `/voice/invite/${encodeURIComponent(token ?? '')}`;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-base">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-accent-primary border-t-transparent animate-spin" />
          <p className="text-sm text-txt-tertiary">Carregando convite de voz...</p>
        </div>
      </div>
    );
  }

  if (errorKind || !preview) {
    const errorTitles: Record<string, string> = {
      expired: 'Convite expirado',
      revoked: 'Convite revogado',
      max_uses: 'Limite de usos atingido',
      not_found: 'Convite não encontrado',
      network: 'Erro de conexão',
    };

    const errorDescriptions: Record<string, string> = {
      expired: 'Este link de convite para o canal de voz expirou.',
      revoked: 'Este link de convite foi cancelado pelo criador ou administrador.',
      max_uses: 'Este convite já atingiu a quantidade máxima de utilizações permitidas.',
      not_found: 'O convite não existe ou o canal de voz foi excluído.',
      network: 'Não foi possível conectar aos servidores do Nuvio. Verifique sua conexão.',
    };

    return (
      <div className="h-full flex items-center justify-center bg-surface-base p-4">
        <div className="w-full max-w-md bg-surface-elevated border border-border-soft rounded-2xl p-8 text-center shadow-elevation-high">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-accent-rose/10 flex items-center justify-center text-accent-rose">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-txt-primary mb-2">
            {errorTitles[errorKind || 'not_found']}
          </h2>
          <p className="text-sm text-txt-secondary mb-6">
            {errorDescriptions[errorKind || 'not_found']}
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-2.5 bg-surface-channel hover:bg-interactive-hover text-txt-primary font-medium rounded-lg transition-colors"
          >
            Voltar ao Nuvio
          </button>
        </div>
      </div>
    );
  }

  const { space, channel, inviter } = preview;
  const isDesktop = !!(window as unknown as { backspace?: unknown }).backspace;

  return (
    <div className="h-full overflow-y-auto flex flex-col items-center justify-center bg-surface-base relative p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(var(--accent-primary)/0.08)_0%,transparent_60%)] pointer-events-none" />

      <div className="w-full max-w-[460px] bg-surface-elevated border border-border-soft rounded-2xl shadow-elevation-high relative z-10 overflow-hidden flex flex-col">
        {/* Banner if available */}
        {space.banner && (
          <div className="h-28 w-full relative overflow-hidden flex-shrink-0">
            <img src={space.banner} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-elevated to-transparent" />
          </div>
        )}

        <div className={`p-8 ${space.banner ? 'pt-2' : ''} flex flex-col items-center text-center`}>
          {/* Space Avatar */}
          <div className="mb-4">
            <Avatar
              src={space.icon}
              name={space.name}
              size={64}
              avatarColor={space.avatarColor ?? undefined}
              palette="space"
            />
          </div>

          <p className="text-xs uppercase tracking-wider text-txt-tertiary font-semibold mb-1">
            Convite para canal de voz
          </p>

          <h1 className="text-2xl font-bold text-txt-primary mb-1">{space.name}</h1>
          {space.description && (
            <p className="text-xs text-txt-secondary line-clamp-2 mb-3">{space.description}</p>
          )}

          {/* Voice Channel Card Box */}
          <div className="w-full my-4 p-4 rounded-xl bg-surface-base border border-border-soft flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-status-online/15 flex items-center justify-center text-status-online flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11 5L6 9H2V15H6L11 19V5ZM15.54 8.46C16.48 9.4 17 10.67 17 12S16.48 14.6 15.54 15.54L14.12 14.12C14.69 13.55 15 12.79 15 12S14.69 10.45 14.12 9.88L15.54 8.46Z" />
                </svg>
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-bold text-txt-primary truncate">{channel.name}</p>
                <div className="flex items-center gap-1.5 text-xs text-status-online">
                  <span className="w-2 h-2 rounded-full bg-status-online animate-pulse" />
                  <span>
                    {channel.participantCount > 0
                      ? `${channel.participantCount} pessoa${channel.participantCount > 1 ? 's' : ''} na sala`
                      : 'Ninguém na sala no momento'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-txt-tertiary mb-6">
            Enviado por <strong className="text-txt-secondary">@{inviter.username}</strong>
          </p>

          {/* Desktop Deep Link Button if in Browser */}
          {!isDesktop && (
            <div className="mb-4">
              <a
                href={`nuvio://voice/invite/${encodeURIComponent(token ?? '')}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-accent-primary bg-accent-primary/10 hover:bg-accent-primary/20 transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                Abrir no aplicativo Nuvio
              </a>
            </div>
          )}

          {errorMessage && (
            <div className="w-full mb-4 p-3 bg-accent-rose/10 border border-accent-rose/30 rounded-lg text-txt-danger text-xs text-left">
              {errorMessage}
            </div>
          )}

          {/* Auth Check */}
          {authToken && user ? (
            <button
              onClick={handleJoinClick}
              disabled={joining}
              className="w-full py-3 bg-accent-primary hover:bg-accent-primary-hover text-white font-semibold rounded-xl transition-all shadow-[0_4px_20px_rgb(var(--accent-primary)/0.3)] disabled:opacity-50"
            >
              {joining ? 'Conectando...' : 'Entrar na chamada'}
            </button>
          ) : (
            <div className="w-full space-y-2.5">
              <Link
                to={`/login?redirect=${encodeURIComponent(redirectUrl)}`}
                className="block w-full py-3 bg-accent-primary hover:bg-accent-primary-hover text-white font-semibold rounded-xl transition-colors text-center shadow-[0_4px_20px_rgb(var(--accent-primary)/0.3)]"
              >
                Entrar com minha conta
              </Link>
              <Link
                to={`/register?redirect=${encodeURIComponent(redirectUrl)}`}
                className="block w-full py-2.5 bg-surface-channel hover:bg-interactive-hover text-txt-primary font-medium rounded-xl transition-colors text-center text-sm"
              >
                Criar uma nova conta
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal when already in another voice call */}
      {showSwitchCallConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-surface-elevated border border-border-soft rounded-xl p-6 shadow-elevation-high text-txt-primary">
            <h3 className="text-base font-bold mb-2">Trocar de chamada?</h3>
            <p className="text-sm text-txt-secondary mb-6">
              Você já está em uma chamada. Deseja sair da chamada atual e entrar em{' '}
              <strong className="text-txt-primary">{channel.name}</strong>?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowSwitchCallConfirm(false)}
                className="flex-1 py-2 rounded-lg bg-surface-channel hover:bg-interactive-hover text-txt-primary text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSwitchCallConfirm(false);
                  executeJoin();
                }}
                className="flex-1 py-2 rounded-lg bg-accent-primary hover:bg-accent-primary-hover text-white text-sm font-semibold transition-colors"
              >
                Mudar de chamada
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
