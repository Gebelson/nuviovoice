import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { useAuthStore } from '../../../stores/authStore';
import { useSpaceStore } from '../../../stores/spaceStore';
import { useLiveStreamStore } from '../../../stores/liveStreamStore';
import {
  type StreamPlatform,
  type StreamerChannel,
  validateChannelInput,
} from '@concord/shared';
import {
  PlatformIcon,
  getPlatformBadgeStyle,
  getPlatformColor,
  getPlatformName,
} from '../../live/PlatformIcons';

export type ChannelLoadErrorType = 'auth' | 'network' | 'backend' | 'unknown';

export interface ChannelLoadErrorInfo {
  type: ChannelLoadErrorType;
  title: string;
  message: string;
}

/**
 * Normalizes any error object or message into a structured, user-friendly Portuguese error info.
 * Explicitly prevents raw technical strings such as "Not found" or "HTTP 404" from ever surfacing.
 */
export function formatChannelError(err: unknown): ChannelLoadErrorInfo {
  const status = typeof err === 'object' && err !== null && 'status' in err ? (err as any).status : undefined;
  const rawMsg = typeof err === 'object' && err !== null && 'message' in err ? String((err as any).message) : String(err || '');
  const normalized = rawMsg.trim().toLowerCase();

  if (status === 401 || normalized.includes('unauthorized') || normalized.includes('sessão expirada')) {
    return {
      type: 'auth',
      title: 'Autenticação necessária',
      message: 'Sua sessão expirou ou não foi reconhecida. Faça login novamente para gerenciar seus canais de transmissão.',
    };
  }

  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('network') ||
    normalized.includes('offline') ||
    normalized.includes('econnrefused') ||
    normalized.includes('timed out') ||
    normalized.includes('timeout')
  ) {
    return {
      type: 'network',
      title: 'Falha de conexão',
      message: 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.',
    };
  }

  if (
    status === 404 ||
    status === 502 ||
    status === 503 ||
    normalized === 'not found' ||
    normalized.includes('not found') ||
    normalized.includes('404')
  ) {
    return {
      type: 'backend',
      title: 'Serviço Nuvio Ao Vivo indisponível',
      message: 'O serviço Nuvio Ao Vivo está temporariamente indisponível no servidor ou em fase de atualização.',
    };
  }

  return {
    type: 'unknown',
    title: 'Falha na operação',
    message: rawMsg || 'Ocorreu um erro ao comunicar com o servidor. Tente novamente.',
  };
}

export function StreamerChannelsSection() {
  const user = useAuthStore((s) => s.user);
  const spaces = useSpaceStore((s) => s.spaces);
  const loadLiveStreams = useLiveStreamStore((s) => s.loadLiveStreams);

  const [channels, setChannels] = useState<StreamerChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ChannelLoadErrorInfo | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [confirmUnlinkId, setConfirmUnlinkId] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const [platform, setPlatform] = useState<StreamPlatform>('twitch');
  const [channelInput, setChannelInput] = useState('');
  const [linkedSpaceId, setLinkedSpaceId] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // User's owned public spaces that can be linked to the live stream
  const mySpaces = spaces.filter((s) => s.ownerId === user?.id);

  const fetchMyChannels = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.live.getMyChannels();
      setChannels(res.channels || []);
    } catch (err: unknown) {
      console.error('Failed to load streamer channels:', err);
      setLoadError(formatChannelError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyChannels();
  }, []);

  const handleLinkChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setSuccess(null);

    const validation = validateChannelInput(channelInput, platform);
    if (!validation.valid || !validation.parsed) {
      setActionError(validation.error || 'Formato de canal inválido.');
      return;
    }

    const { platform: validPlatform, channelName } = validation.parsed;

    // Check if channel is already present in user's loaded channels
    if (channels.some((c) => c.platform === validPlatform && c.channelName.toLowerCase() === channelName.toLowerCase())) {
      setActionError(`Você já vinculou este canal da ${getPlatformName(validPlatform)}.`);
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.live.linkChannel({
        platform: validPlatform,
        channelInput: channelInput.trim(),
        linkedSpaceId: linkedSpaceId || undefined,
      });

      if ((res as any)?.alreadyLinked) {
        setActionError(`Este canal já estava vinculado à sua conta.`);
      } else {
        setSuccess(`Canal ${res.channel.channelName} (${getPlatformName(res.channel.platform)}) vinculado com sucesso!`);
        setChannelInput('');
        setLinkedSpaceId('');
      }

      await fetchMyChannels();
      await loadLiveStreams();
    } catch (err: any) {
      const formatted = formatChannelError(err);
      if (err?.status === 409 || err?.message?.includes('outra conta')) {
        setActionError('Este canal já está vinculado a outra conta no Nuvio.');
      } else if (formatted.type === 'backend') {
        setActionError('O serviço Nuvio Ao Vivo está temporariamente indisponível no servidor ou em atualização. Tente novamente em instantes.');
      } else {
        setActionError(formatted.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlinkChannel = async (id: string, name: string) => {
    setActionError(null);
    setSuccess(null);
    try {
      setUnlinkingId(id);
      await api.live.unlinkChannel(id);
      setConfirmUnlinkId(null);
      setSuccess(`Canal ${name} desvinculado com sucesso.`);
      await fetchMyChannels();
      await loadLiveStreams();
    } catch (err: unknown) {
      const formatted = formatChannelError(err);
      setActionError(formatted.type === 'backend' ? 'Não foi possível desvincular o canal: serviço temporariamente indisponível.' : formatted.message);
    } finally {
      setUnlinkingId(null);
    }
  };

  const handleRefreshChannel = async (id: string, name: string) => {
    setActionError(null);
    try {
      setRefreshingId(id);
      const res = await api.live.refreshChannel(id);
      if (res.channel.isLive) {
        setSuccess(`O canal ${name} está AO VIVO agora com ${res.channel.viewerCount || 0} espectadores!`);
      }
      await fetchMyChannels();
      await loadLiveStreams();
    } catch (err: unknown) {
      const formatted = formatChannelError(err);
      setActionError(formatted.type === 'backend' ? 'Serviço de verificação indisponível no momento.' : formatted.message);
    } finally {
      setRefreshingId(null);
    }
  };

  return (
    <div className="space-y-6 pt-6 border-t border-border-soft/60" data-testid="streamer-channels-section">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <h3 className="text-base font-semibold text-txt-primary">
            Nuvio Ao Vivo — Canais de Transmissão
          </h3>
        </div>
        <p className="text-xs text-txt-secondary leading-relaxed">
          Vincule seu canal da Twitch, Kick ou YouTube. Quando você iniciar uma transmissão na sua plataforma, o Nuvio detectará automaticamente e colocará seu avatar na barra lateral para toda a comunidade assistir e interagir diretamente pelo app!
        </p>
      </div>

      {/* Action / Submit Feedback */}
      {actionError && (
        <div
          data-testid="channel-action-error"
          className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium flex items-start gap-2.5 shadow-sm"
        >
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="flex-1 leading-relaxed">{actionError}</div>
        </div>
      )}

      {success && (
        <div
          data-testid="channel-action-success"
          className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-start gap-2.5 shadow-sm"
        >
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <div className="flex-1 leading-relaxed">{success}</div>
        </div>
      )}

      {/* Linking Form (Always accessible to user) */}
      <form
        onSubmit={handleLinkChannel}
        className="p-4 rounded-xl bg-surface-elevated/60 border border-border-soft/80 space-y-4 shadow-sm"
        data-testid="channel-link-form"
      >
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-txt-secondary">
            Selecione a Plataforma
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['twitch', 'kick', 'youtube'] as StreamPlatform[]).map((p) => {
              const active = platform === p;
              const pColor = getPlatformColor(p);
              return (
                <button
                  key={p}
                  type="button"
                  data-testid={`platform-btn-${p}`}
                  onClick={() => setPlatform(p)}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                    active
                      ? 'border-transparent text-white shadow-md'
                      : 'border-border-soft/80 bg-surface-base hover:bg-white/[0.04] text-txt-secondary'
                  }`}
                  style={{ backgroundColor: active ? pColor : undefined }}
                >
                  <PlatformIcon platform={p} size={14} />
                  <span>{getPlatformName(p)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-txt-secondary">
            Canal ou Link da Live ({getPlatformName(platform)})
          </label>
          <input
            type="text"
            data-testid="channel-input"
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            placeholder={
              platform === 'twitch'
                ? 'Ex: twitch.tv/seucanal ou seucanal'
                : platform === 'kick'
                ? 'Ex: kick.com/seucanal ou seucanal'
                : 'Ex: youtube.com/@seucanal ou @seucanal'
            }
            className="w-full px-3.5 py-2.5 rounded-lg bg-surface-base border border-border-soft text-txt-primary text-xs focus:outline-none focus:border-accent-primary transition-colors placeholder:text-txt-secondary/50"
          />
        </div>

        {mySpaces.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-txt-secondary">
              Divulgar Espaço Público na Live (Opcional)
            </label>
            <select
              value={linkedSpaceId}
              onChange={(e) => setLinkedSpaceId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-soft text-txt-primary text-xs focus:outline-none focus:border-accent-primary transition-colors"
            >
              <option value="">Nenhum espaço vinculado</option>
              {mySpaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-txt-secondary block">
              Seus espectadores verão um card para conhecer e entrar no seu espaço público enquanto assistem à live.
            </span>
          </div>
        )}

        <button
          type="submit"
          data-testid="submit-channel-btn"
          disabled={submitting || !channelInput.trim()}
          className="w-full py-2.5 rounded-lg bg-accent-primary hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          {submitting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          )}
          <span>{submitting ? 'Vinculando canal...' : 'Vincular Canal'}</span>
        </button>
      </form>

      {/* Linked Channels List Area */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-txt-secondary">
            Seus Canais Vinculados
          </h4>
          {!loading && (
            <button
              onClick={() => fetchMyChannels()}
              className="text-[11px] text-txt-secondary hover:text-txt-primary flex items-center gap-1 transition-colors"
              title="Recarregar canais"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              <span>Atualizar</span>
            </button>
          )}
        </div>

        {/* State 1: Carregando canais */}
        {loading && (
          <div data-testid="channels-loading" className="py-8 flex flex-col items-center justify-center gap-2.5">
            <div className="w-6 h-6 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-txt-secondary font-medium">Carregando canais vinculados...</span>
          </div>
        )}

        {/* State 2: Erro no carregamento (Erro de autenticação, Erro de conexão, Backend indisponível) */}
        {!loading && loadError && (
          <div
            data-testid="channels-load-error"
            className="p-5 rounded-xl bg-surface-elevated/40 border border-red-500/30 flex flex-col items-center text-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <h5 className="text-xs font-bold text-txt-primary mb-1">{loadError.title}</h5>
              <p className="text-xs text-txt-secondary max-w-md leading-relaxed">{loadError.message}</p>
            </div>
            <button
              type="button"
              data-testid="retry-channels-btn"
              onClick={() => fetchMyChannels()}
              className="px-4 py-2 rounded-lg bg-surface-base hover:bg-white/[0.04] text-txt-primary text-xs font-semibold border border-border-soft transition-colors flex items-center gap-2 shadow-sm"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              <span>Tentar novamente</span>
            </button>
          </div>
        )}

        {/* State 3: Nenhum canal vinculado */}
        {!loading && !loadError && channels.length === 0 && (
          <div
            data-testid="channels-empty"
            className="p-6 rounded-xl bg-surface-elevated/30 border border-border-soft/60 flex flex-col items-center text-center gap-2"
          >
            <div className="w-10 h-10 rounded-full bg-surface-base flex items-center justify-center text-txt-secondary border border-border-soft">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
                <polyline points="17 2 12 7 7 2" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-txt-primary">
              Você ainda não vinculou nenhum canal de transmissão.
            </p>
            <p className="text-[11px] text-txt-secondary max-w-sm">
              Selecione uma plataforma acima e informe seu link ou nome de usuário para que o Nuvio mostre suas lives na barra lateral.
            </p>
          </div>
        )}

        {/* State 4: Canais carregados */}
        {!loading && !loadError && channels.length > 0 && (
          <div data-testid="channels-list" className="space-y-2">
            {channels.map((ch) => {
              const badgeStyle = getPlatformBadgeStyle(ch.platform);
              const pName = getPlatformName(ch.platform);
              const isLive = Boolean(ch.isLive);
              const linkedSpace = mySpaces.find((s) => s.id === ch.linkedSpaceId);
              const isUnlinkConfirming = confirmUnlinkId === ch.id;

              return (
                <div
                  key={ch.id}
                  data-testid={`channel-card-${ch.id}`}
                  className="flex flex-col p-3.5 rounded-xl bg-surface-elevated/80 border border-border-soft/80 gap-3 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        style={{ backgroundColor: getPlatformColor(ch.platform) }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-sm"
                      >
                        <PlatformIcon platform={ch.platform} size={16} />
                      </div>

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-txt-primary truncate">
                            {ch.channelName}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border} uppercase tracking-wider`}
                          >
                            {pName}
                          </span>
                          {isLive ? (
                            <span className="flex items-center gap-1 text-[10px] text-red-400 font-bold uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                              Ao Vivo ({ch.viewerCount} espectadores)
                            </span>
                          ) : (
                            <span className="text-[10px] text-txt-secondary font-medium">Offline</span>
                          )}
                        </div>

                        {ch.streamTitle && isLive && (
                          <span className="text-[11px] text-txt-secondary truncate mt-0.5">
                            {ch.streamTitle}
                          </span>
                        )}

                        {linkedSpace && (
                          <span className="text-[10px] text-accent-primary font-medium mt-0.5">
                            Espaço vinculado: {linkedSpace.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* External channel link */}
                      {ch.channelUrl && (
                        <a
                          href={ch.channelUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Abrir canal na ${pName}`}
                          className="p-1.5 rounded-lg text-txt-secondary hover:text-txt-primary hover:bg-white/[0.04] transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      )}

                      {/* Manual status refresh */}
                      <button
                        onClick={() => handleRefreshChannel(ch.id, ch.channelName)}
                        disabled={refreshingId === ch.id}
                        title="Verificar status da live agora"
                        className="p-1.5 rounded-lg text-txt-secondary hover:text-txt-primary hover:bg-white/[0.04] transition-colors disabled:opacity-50"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className={refreshingId === ch.id ? 'animate-spin' : ''}
                        >
                          <polyline points="23 4 23 10 17 10" />
                          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                        </svg>
                      </button>

                      {/* Unlink button */}
                      <button
                        onClick={() => setConfirmUnlinkId(isUnlinkConfirming ? null : ch.id)}
                        disabled={unlinkingId === ch.id}
                        title="Desvincular canal"
                        className={`p-1.5 rounded-lg transition-colors ${
                          isUnlinkConfirming
                            ? 'text-red-400 bg-red-500/10'
                            : 'text-txt-secondary hover:text-red-400 hover:bg-white/[0.04]'
                        }`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Inline Unlink Confirmation */}
                  {isUnlinkConfirming && (
                    <div
                      data-testid={`confirm-unlink-${ch.id}`}
                      className="pt-2 border-t border-border-soft/60 flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="text-txt-secondary">
                        Tem certeza que deseja desvincular <strong className="text-txt-primary">{ch.channelName}</strong>?
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setConfirmUnlinkId(null)}
                          className="px-2.5 py-1 rounded-md text-txt-secondary hover:text-txt-primary hover:bg-white/[0.04] transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          data-testid={`btn-confirm-unlink-${ch.id}`}
                          onClick={() => handleUnlinkChannel(ch.id, ch.channelName)}
                          disabled={unlinkingId === ch.id}
                          className="px-2.5 py-1 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold border border-red-500/30 transition-colors flex items-center gap-1.5"
                        >
                          {unlinkingId === ch.id ? (
                            <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          ) : null}
                          <span>Desvincular</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
