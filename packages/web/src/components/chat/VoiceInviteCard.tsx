import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { HttpError } from '../../api/client';
import { useVoiceStore } from '../../stores/voiceStore';
import { useSpaceStore } from '../../stores/spaceStore';
import { joinVoiceChannel } from '../../utils/voice';
import { Avatar } from '../ui/Avatar';
import type { VoiceInviteSystemPayload, VoiceInvitePreview } from '@concord/shared';

interface Props {
  payload: VoiceInviteSystemPayload;
  senderName: string;
}

export function VoiceInviteCard({ payload, senderName }: Props) {
  const navigate = useNavigate();
  const currentVoiceChannelId = useVoiceStore((s) => s.currentVoiceChannelId);

  const [live, setLive] = useState<{
    status: 'loading' | 'valid' | 'expired' | 'revoked';
    preview?: VoiceInvitePreview;
  }>({ status: 'loading' });

  const [joining, setJoining] = useState(false);
  const [showSwitchCallConfirm, setShowSwitchCallConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      try {
        const preview = await api.voiceInvites.preview(payload.token);
        if (!cancelled) {
          setLive({ status: 'valid', preview });
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof HttpError) {
            const code = (err as any).code;
            if (code === 'invite_expired' || code === 'max_uses_reached') {
              setLive({ status: 'expired' });
            } else if (code === 'invite_revoked') {
              setLive({ status: 'revoked' });
            } else {
              setLive({ status: 'expired' });
            }
          } else {
            setLive({ status: 'valid' }); // fallback to payload snapshot
          }
        }
      }
    }

    checkStatus();
    return () => {
      cancelled = true;
    };
  }, [payload.token]);

  const executeJoin = async () => {
    setJoining(true);
    setErrorMsg(null);
    try {
      const res = await api.voiceInvites.join(payload.token);
      const spaces = await api.spaces.list();
      useSpaceStore.getState().setSpaces(spaces.map((s) => ({ ...s, _instanceOrigin: '' })));
      navigate(`/channels/${res.space.id}/${res.channel.id}`);
      const connectFn = useVoiceStore.getState().connectFn ?? undefined;
      joinVoiceChannel(res.channel.id, connectFn);
    } catch (err) {
      if (err instanceof HttpError && (err as any).code === 'user_banned') {
        setErrorMsg('Você foi banido deste espaço.');
      } else {
        setErrorMsg('Não foi possível entrar na sala de voz.');
      }
    } finally {
      setJoining(false);
    }
  };

  const handleJoinClick = () => {
    if (currentVoiceChannelId && currentVoiceChannelId !== payload.channelId) {
      setShowSwitchCallConfirm(true);
      return;
    }
    executeJoin();
  };

  const isInvalid = live.status === 'expired' || live.status === 'revoked';
  const participantCount = live.preview?.channel.participantCount ?? 0;

  return (
    <div className="w-full max-w-[420px] rounded-xl bg-surface-elevated border border-border-soft p-4 shadow-elevation-low flex flex-col gap-3">
      {/* Top Space info */}
      <div className="flex items-center gap-2.5">
        <Avatar
          src={payload.snapshot.icon}
          name={payload.snapshot.spaceName}
          size={36}
          avatarColor={payload.snapshot.avatarColor}
          palette="space"
        />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-txt-primary truncate">
            {payload.snapshot.spaceName}
          </p>
          <p className="text-[11px] text-txt-tertiary truncate">
            Convite enviado por @{senderName}
          </p>
        </div>
      </div>

      {/* Voice Channel highlight card */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-surface-base border border-border-soft">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-status-online/15 flex items-center justify-center text-status-online flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11 5L6 9H2V15H6L11 19V5ZM15.54 8.46C16.48 9.4 17 10.67 17 12S16.48 14.6 15.54 15.54L14.12 14.12C14.69 13.55 15 12.79 15 12S14.69 10.45 14.12 9.88L15.54 8.46Z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-txt-primary truncate">
              {payload.channelName}
            </p>
            <p className="text-[11px] text-status-online truncate">
              {participantCount > 0
                ? `${participantCount} na chamada`
                : 'Canal de voz'}
            </p>
          </div>
        </div>

        {/* Join button */}
        {isInvalid ? (
          <span className="text-xs text-txt-tertiary px-3 py-1.5 rounded-md bg-surface-channel">
            {live.status === 'revoked' ? 'Revogado' : 'Expirado'}
          </span>
        ) : (
          <button
            onClick={handleJoinClick}
            disabled={joining || live.status === 'loading'}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-accent-primary hover:bg-accent-primary-hover text-white transition-colors disabled:opacity-50"
          >
            {joining ? 'Conectando...' : 'Entrar na chamada'}
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="text-[11px] text-txt-danger bg-accent-rose/10 p-2 rounded">
          {errorMsg}
        </div>
      )}

      {/* Switch Call Modal */}
      {showSwitchCallConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-surface-elevated border border-border-soft rounded-xl p-5 shadow-elevation-high text-txt-primary">
            <h3 className="text-sm font-bold mb-1.5">Mudar de chamada?</h3>
            <p className="text-xs text-txt-secondary mb-4">
              Você já está em outra sala de voz. Deseja sair da atual e entrar em{' '}
              <strong className="text-txt-primary">{payload.channelName}</strong>?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowSwitchCallConfirm(false)}
                className="flex-1 py-1.5 rounded-lg bg-surface-channel hover:bg-interactive-hover text-txt-primary text-xs font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSwitchCallConfirm(false);
                  executeJoin();
                }}
                className="flex-1 py-1.5 rounded-lg bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-semibold transition-colors"
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
