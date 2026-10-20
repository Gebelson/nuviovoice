import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import { useSocialStore, type TaggedFriend } from '../../stores/socialStore';
import { Avatar } from '../ui/Avatar';
import { parseFederatedUsername } from '../../utils/identity';
import { useFloatingPosition } from '../../hooks/useFloatingPosition';
import { usePortalContainer } from '../../hooks/usePortalContainer';

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
  const portalContainer = usePortalContainer();

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

  const hasAnchor = Boolean(anchorRef?.current);
  const { style: floatingStyle } = useFloatingPosition(
    anchorRef ?? { current: null },
    popoverRef,
    {
      placement: 'bottom',
      align: 'start',
      offset: 8,
      enabled: isOpen && hasAnchor,
    },
  );

  const generate = useCallback(async () => {
    if (!channelId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.voiceInvites.create(channelId, {
        expiresInSeconds,
        maxUses,
      });
      setInviteUrl(res.inviteUrl);
      setToken(res.token);
    } catch {
      setError(t('voice:invite.failedDesc', 'Houve um problema ao criar o link desta sala de voz. Tente novamente.'));
    } finally {
      setLoading(false);
    }
  }, [channelId, expiresInSeconds, maxUses, t]);

  // Generate invite whenever isOpen or settings change
  useEffect(() => {
    if (!isOpen || !channelId) return;
    generate();
  }, [isOpen, channelId, expiresInSeconds, maxUses, generate]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (anchorRef?.current && anchorRef.current.contains(target)) {
        return;
      }
      if (popoverRef.current && !popoverRef.current.contains(target)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
    return (
      name.toLowerCase().includes(friendSearch.toLowerCase()) ||
      f.username.toLowerCase().includes(friendSearch.toLowerCase())
    );
  });

  const positionClasses = className
    ? className
    : hasAnchor
    ? ''
    : 'fixed top-16 right-6';

  const elementStyle = hasAnchor ? floatingStyle : undefined;

  const popoverContent = (
    <div
      ref={popoverRef}
      style={elementStyle}
      className={`glass-modal rounded-2xl w-[380px] max-w-[calc(100vw-32px)] p-4 text-txt-primary flex flex-col gap-3.5 shadow-2xl border border-white/10 z-[200] animate-in fade-in zoom-in-95 duration-150 ${positionClasses}`}
      role="dialog"
      aria-label={t('voice:invite.title', 'Convidar para voz')}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-accent-primary/15 border border-accent-primary/25 flex items-center justify-center text-accent-primary flex-shrink-0 shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-medium text-txt-tertiary block truncate leading-tight">
              {spaceName || t('voice:invite.subtitle', 'Canal de voz')}
            </span>
            <h3 className="text-[15px] font-bold text-txt-primary truncate leading-snug">
              {channelName}
            </h3>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-txt-tertiary hover:text-txt-primary hover:bg-white/[0.08] transition-colors"
          aria-label={t('voice:invite.close', 'Fechar')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Invite link section */}
      <div>
        <label className="block text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider mb-1.5">
          {t('voice:invite.linkLabel', 'Link do convite de voz')}
        </label>

        {error ? (
          <div className="p-3.5 rounded-xl bg-accent-rose/10 border border-accent-rose/25 flex flex-col gap-2.5">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-accent-rose/20 text-accent-rose flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-semibold text-accent-rose">
                  {t('voice:invite.failedTitle', 'Não foi possível gerar o convite')}
                </h4>
                <p className="text-[11px] text-txt-secondary mt-0.5 leading-relaxed">
                  {error}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-accent-rose/15">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 text-xs text-txt-secondary hover:text-txt-primary transition-colors"
              >
                {t('voice:invite.close', 'Fechar')}
              </button>
              <button
                type="button"
                onClick={() => generate()}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-accent-rose hover:bg-accent-rose/90 text-white transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 4v6h-6" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                <span>{t('voice:invite.retry', 'Tentar novamente')}</span>
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-black/25 border border-white/[0.08]">
            <div className="w-4 h-4 rounded-full border-2 border-accent-primary border-t-transparent animate-spin flex-shrink-0" />
            <span className="text-xs text-txt-secondary animate-pulse">
              {t('voice:invite.generating', 'Gerando link seguro...')}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/25 border border-white/[0.08] focus-within:border-accent-primary/40 focus-within:ring-1 focus-within:ring-accent-primary/20 transition-all">
            <input
              type="text"
              readOnly
              value={inviteUrl}
              className="bg-transparent flex-1 py-1.5 px-2.5 text-xs font-mono text-txt-primary outline-none select-all truncate"
              aria-label={t('voice:invite.linkLabel', 'Link do convite de voz')}
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={handleCopy}
              disabled={!inviteUrl}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0 shadow-sm ${
                copied
                  ? 'bg-status-online text-white scale-[1.02]'
                  : 'bg-accent-primary hover:bg-accent-primary-hover text-white active:scale-95'
              } disabled:opacity-50`}
            >
              {copied ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{t('voice:invite.copied', 'Copiado!')}</span>
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <span>{t('voice:invite.copy', 'Copiar link')}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Advanced Settings toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-accent-primary hover:text-accent-primary-hover transition-colors group"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform duration-200 ${showSettings ? 'rotate-90' : ''}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span>
            {showSettings
              ? t('voice:invite.hideSettings', 'Ocultar configurações')
              : t('voice:invite.showSettings', 'Configurações de validade e usos')}
          </span>
        </button>

        {showSettings && (
          <div className="mt-2.5 p-3 bg-black/20 rounded-xl border border-white/[0.08] flex flex-col gap-2.5 text-xs animate-in fade-in duration-100">
            <div>
              <label className="block text-[10px] text-txt-tertiary uppercase font-medium mb-1">
                {t('voice:invite.expiration', 'Expiração')}
              </label>
              <select
                value={expiresInSeconds === null ? 'never' : String(expiresInSeconds)}
                onChange={(e) =>
                  setExpiresInSeconds(e.target.value === 'never' ? null : Number(e.target.value))
                }
                className="w-full bg-surface-base/80 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-xs text-txt-primary border border-white/10 outline-none focus:border-accent-primary/40 focus:ring-1 focus:ring-accent-primary/30 transition-colors"
              >
                <option value="1800">{t('voice:invite.exp30m', '30 minutos')}</option>
                <option value="3600">{t('voice:invite.exp1h', '1 hora')}</option>
                <option value="21600">{t('voice:invite.exp6h', '6 horas')}</option>
                <option value="43200">{t('voice:invite.exp12h', '12 horas')}</option>
                <option value="86400">{t('voice:invite.exp1d', '1 dia (padrão)')}</option>
                <option value="604800">{t('voice:invite.exp7d', '7 dias')}</option>
                <option value="never">{t('voice:invite.expNever', 'Nunca expirar')}</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-txt-tertiary uppercase font-medium mb-1">
                {t('voice:invite.maxUses', 'Limite de usos')}
              </label>
              <select
                value={maxUses === null ? 'none' : String(maxUses)}
                onChange={(e) =>
                  setMaxUses(e.target.value === 'none' ? null : Number(e.target.value))
                }
                className="w-full bg-surface-base/80 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-xs text-txt-primary border border-white/10 outline-none focus:border-accent-primary/40 focus:ring-1 focus:ring-accent-primary/30 transition-colors"
              >
                <option value="none">{t('voice:invite.usesNone', 'Sem limite (padrão)')}</option>
                <option value="1">{t('voice:invite.uses1', 'Uso único (1 uso)')}</option>
                <option value="5">{t('voice:invite.uses5', '5 usos')}</option>
                <option value="10">{t('voice:invite.uses10', '10 usos')}</option>
                <option value="25">{t('voice:invite.uses25', '25 usos')}</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Direct friend sharing section */}
      <div className="pt-2 border-t border-white/[0.08] flex flex-col gap-2">
        <label className="block text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider">
          {t('voice:invite.sendToFriend', 'Enviar para um amigo')}
        </label>

        <div className="relative">
          <input
            type="text"
            value={friendSearch}
            onChange={(e) => setFriendSearch(e.target.value)}
            placeholder={t('voice:invite.searchFriends', 'Buscar amigos...')}
            className="w-full bg-black/20 border border-white/[0.08] rounded-xl pl-8 pr-3 py-1.5 text-xs text-txt-primary placeholder:text-txt-tertiary outline-none focus:border-accent-primary/40 focus:ring-1 focus:ring-accent-primary/20 transition-all"
          />
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-tertiary pointer-events-none"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>

        <div className="max-h-[160px] overflow-y-auto space-y-1 pr-1 scrollbar-thin">
          {filteredFriends.length === 0 ? (
            <p className="text-center text-txt-tertiary text-xs py-3">
              {friends.length === 0
                ? t('voice:invite.noFriendsAdded', 'Nenhum amigo adicionado')
                : t('voice:invite.noFriendsFound', 'Nenhum amigo encontrado')}
            </p>
          ) : (
            filteredFriends.map((f) => {
              const name = f.displayName || parseFederatedUsername(f.username).baseName;
              const isSent = sentFriendIds.has(f.id);
              const isSending = sendingFriendId === f.id;

              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-1.5 rounded-xl hover:bg-white/[0.06] transition-colors"
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
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      isSent
                        ? 'bg-status-online/15 text-status-online border border-status-online/25 cursor-default'
                        : isSending
                        ? 'bg-accent-primary/20 text-accent-primary animate-pulse'
                        : 'bg-white/[0.08] hover:bg-accent-primary hover:text-white text-txt-secondary border border-white/[0.06]'
                    } disabled:opacity-50`}
                  >
                    {isSent
                      ? t('voice:invite.sent', 'Enviado!')
                      : isSending
                      ? t('voice:invite.sending', 'Enviando...')
                      : t('voice:invite.send', 'Enviar')}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  return portalContainer ? createPortal(popoverContent, portalContainer) : popoverContent;
}
