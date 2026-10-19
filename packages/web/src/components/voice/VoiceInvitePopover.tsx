import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import { useSocialStore, type TaggedFriend } from '../../stores/socialStore';
import { Avatar } from '../ui/Avatar';
import { parseFederatedUsername } from '../../utils/identity';

interface Props {
  channelId: string;
  channelName: string;
  spaceName?: string;
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}

export function VoiceInvitePopover({
  channelId,
  channelName,
  spaceName,
  isOpen,
  onClose,
  anchorRef,
  className,
}: Props) {
  const { t } = useTranslation(['voice', 'common', 'spaces']);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [inviteUrl, setInviteUrl] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expiresInSeconds, setExpiresInSeconds] = useState<number | null>(86400); // 1 day
  const [maxUses, setMaxUses] = useState<number | null>(null); // no limit
  const [showSettings, setShowSettings] = useState(false);

  const [friendSearch, setFriendSearch] = useState('');
  const [sendingFriendId, setSendingFriendId] = useState<string | null>(null);
  const [sentFriendIds, setSentFriendIds] = useState<Set<string>>(new Set());

  const friends = useSocialStore((s) => s.friends);

  // Generate invite whenever parameters or channelId changes
  useEffect(() => {
    if (!isOpen || !channelId) return;
    let cancelled = false;

    async function generate() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.voiceInvites.create(channelId, {
          expiresInSeconds,
          maxUses,
        });
        if (!cancelled) {
          setInviteUrl(res.inviteUrl);
          setToken(res.token);
        }
      } catch (err) {
        if (!cancelled) {
          setError(t('voice:invite.generateError', 'Não foi possível gerar o convite.'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    generate();

    return () => {
      cancelled = true;
    };
  }, [isOpen, channelId, expiresInSeconds, maxUses, t]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        (!anchorRef?.current || !anchorRef.current.contains(e.target as Node))
      ) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard denied */
    }
  };

  const handleSendFriend = async (friend: TaggedFriend) => {
    if (!token || sendingFriendId) return;
    const friendId = friend.id;
    setSendingFriendId(friendId);
    try {
      await api.voiceInvites.sendDm(friendId, token);
      setSentFriendIds((prev) => new Set(prev).add(friendId));
    } catch {
      /* send failed */
    } finally {
      setSendingFriendId(null);
    }
  };

  const filteredFriends = friends.filter((f) => {
    const name = f.displayName || parseFederatedUsername(f.username).baseName;
    return name.toLowerCase().includes(friendSearch.toLowerCase());
  });

  return (
    <div
      ref={popoverRef}
      className={className || "absolute top-12 right-4 z-50 w-[360px] bg-surface-elevated/95 backdrop-blur-md border border-border-soft rounded-xl shadow-elevation-high p-4 text-txt-primary flex flex-col gap-3.5 animate-in fade-in zoom-in-95 duration-150"}
      role="dialog"
      aria-label="Convidar para voz"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-1 border-b border-border-soft/60">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-txt-tertiary">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11 5L6 9H2V15H6L11 19V5ZM15.54 8.46C16.48 9.4 17 10.67 17 12S16.48 14.6 15.54 15.54L14.12 14.12C14.69 13.55 15 12.79 15 12S14.69 10.45 14.12 9.88L15.54 8.46Z" />
            </svg>
            <span className="truncate">{spaceName || 'Espaço'}</span>
          </div>
          <h3 className="text-sm font-semibold truncate text-txt-primary">
            {channelName}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-md text-txt-tertiary hover:text-txt-primary hover:bg-interactive-hover transition-colors"
          aria-label="Fechar"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Invite link section */}
      <div>
        <label className="block text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider mb-1.5">
          Link do convite de voz
        </label>
        {error ? (
          <div className="text-xs text-txt-danger bg-accent-rose/10 p-2 rounded-md">{error}</div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={loading ? 'Gerando link seguro...' : inviteUrl}
              className="input-standard flex-1 py-1.5 px-2.5 text-xs font-mono bg-surface-base text-txt-primary select-all"
            />
            <button
              onClick={handleCopy}
              disabled={loading || !inviteUrl}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                copied
                  ? 'bg-status-online text-white'
                  : 'bg-accent-primary hover:bg-accent-primary-hover text-white'
              } disabled:opacity-50`}
            >
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        )}
      </div>

      {/* Advanced Settings toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-1 text-[11px] text-accent-primary hover:underline transition-all"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${showSettings ? 'rotate-90' : ''}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          {showSettings ? 'Ocultar configurações' : 'Configurações de validade e usos'}
        </button>

        {showSettings && (
          <div className="mt-2 p-2.5 bg-surface-base rounded-lg border border-border-soft flex flex-col gap-2.5 text-xs animate-in fade-in duration-100">
            <div>
              <label className="block text-[10px] text-txt-tertiary uppercase font-medium mb-1">
                Expiração
              </label>
              <select
                value={expiresInSeconds === null ? 'never' : String(expiresInSeconds)}
                onChange={(e) => setExpiresInSeconds(e.target.value === 'never' ? null : Number(e.target.value))}
                className="input-standard w-full py-1 text-xs"
              >
                <option value="1800">30 minutos</option>
                <option value="3600">1 hora</option>
                <option value="21600">6 horas</option>
                <option value="43200">12 horas</option>
                <option value="86400">1 dia (padrão)</option>
                <option value="604800">7 dias</option>
                <option value="never">Nunca expirar</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-txt-tertiary uppercase font-medium mb-1">
                Limite de usos
              </label>
              <select
                value={maxUses === null ? 'none' : String(maxUses)}
                onChange={(e) => setMaxUses(e.target.value === 'none' ? null : Number(e.target.value))}
                className="input-standard w-full py-1 text-xs"
              >
                <option value="none">Sem limite (padrão)</option>
                <option value="1">Uso único (1 uso)</option>
                <option value="5">5 usos</option>
                <option value="10">10 usos</option>
                <option value="25">25 usos</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Direct friend sharing section */}
      <div className="pt-2 border-t border-border-soft/60 flex flex-col gap-2">
        <label className="block text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider">
          Enviar para um amigo
        </label>

        <input
          type="text"
          value={friendSearch}
          onChange={(e) => setFriendSearch(e.target.value)}
          placeholder="Buscar amigos..."
          className="input-search w-full py-1.5 px-2.5 text-xs"
        />

        <div className="max-h-[160px] overflow-y-auto space-y-1 pr-1">
          {filteredFriends.length === 0 ? (
            <p className="text-center text-txt-tertiary text-xs py-3">
              {friends.length === 0 ? 'Nenhum amigo adicionado' : 'Nenhum amigo encontrado'}
            </p>
          ) : (
            filteredFriends.map((f) => {
              const name = f.displayName || parseFederatedUsername(f.username).baseName;
              const isSent = sentFriendIds.has(f.id);
              const isSending = sendingFriendId === f.id;

              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-1.5 rounded-lg hover:bg-surface-base transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar
                      src={f.avatar || null}
                      name={name}
                      size={28}
                      avatarColor={f.avatarColor}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-txt-primary truncate">{name}</p>
                      <p className="text-[10px] text-txt-tertiary truncate">@{f.username}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSendFriend(f)}
                    disabled={isSent || isSending || !token}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      isSent
                        ? 'bg-status-online/20 text-status-online cursor-default'
                        : 'bg-surface-channel hover:bg-interactive-hover text-txt-primary'
                    } disabled:opacity-50`}
                  >
                    {isSent ? 'Enviado!' : isSending ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
