import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { useAuthStore } from '../../../stores/authStore';
import { useSpaceStore } from '../../../stores/spaceStore';
import { useLiveStreamStore } from '../../../stores/liveStreamStore';
import type { StreamPlatform, StreamerChannel } from '@concord/shared';
import {
  PlatformIcon,
  getPlatformBadgeStyle,
  getPlatformColor,
  getPlatformName,
} from '../../live/PlatformIcons';

export function StreamerChannelsSection() {
  const user = useAuthStore((s) => s.user);
  const spaces = useSpaceStore((s) => s.spaces);
  const loadLiveStreams = useLiveStreamStore((s) => s.loadLiveStreams);

  const [channels, setChannels] = useState<StreamerChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const [platform, setPlatform] = useState<StreamPlatform>('twitch');
  const [channelInput, setChannelInput] = useState('');
  const [linkedSpaceId, setLinkedSpaceId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // User's owned public spaces that can be linked to the live stream
  const mySpaces = spaces.filter((s) => s.ownerId === user?.id);

  const fetchMyChannels = async () => {
    try {
      setLoading(true);
      const res = await api.live.getMyChannels();
      setChannels(res.channels || []);
    } catch (err: any) {
      console.error('Failed to load streamer channels:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyChannels();
  }, []);

  const handleLinkChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelInput.trim()) {
      setError('Insira o nome de usuário ou o link do canal');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const res = await api.live.linkChannel({
        platform,
        channelInput: channelInput.trim(),
        linkedSpaceId: linkedSpaceId || undefined,
      });

      setSuccess(`Canal ${res.channel.channelName} vinculado com sucesso!`);
      setChannelInput('');
      setLinkedSpaceId('');
      await fetchMyChannels();
      await loadLiveStreams();
    } catch (err: any) {
      setError(err?.message || 'Falha ao vincular canal. Verifique se o canal existe.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlinkChannel = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja desvincular o canal ${name}?`)) {
      return;
    }

    try {
      await api.live.unlinkChannel(id);
      await fetchMyChannels();
      await loadLiveStreams();
    } catch (err: any) {
      setError(err?.message || 'Falha ao desvincular canal');
    }
  };

  const handleRefreshChannel = async (id: string) => {
    try {
      setRefreshingId(id);
      await api.live.refreshChannel(id);
      await fetchMyChannels();
      await loadLiveStreams();
    } catch (err: any) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshingId(null);
    }
  };

  return (
    <div className="space-y-6 pt-6 border-t border-border-soft/60">
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

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
          {success}
        </div>
      )}

      {/* Linking Form */}
      <form
        onSubmit={handleLinkChannel}
        className="p-4 rounded-xl bg-surface-elevated/60 border border-border-soft/80 space-y-4"
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
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            placeholder={
              platform === 'twitch'
                ? 'Ex: twitch.tv/seucanal ou seucanal'
                : platform === 'kick'
                ? 'Ex: kick.com/seucanal ou seucanal'
                : 'Ex: youtube.com/@seucanal ou @seucanal'
            }
            className="w-full px-3.5 py-2.5 rounded-lg bg-surface-base border border-border-soft text-txt-primary text-xs focus:outline-none focus:border-accent-primary transition-colors"
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
          <span>Vincular Canal</span>
        </button>
      </form>

      {/* Linked Channels List */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-txt-secondary">
          Seus Canais Vinculados
        </h4>

        {loading ? (
          <div className="py-6 flex justify-center">
            <div className="w-6 h-6 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : channels.length === 0 ? (
          <div className="p-4 rounded-xl bg-surface-elevated/30 border border-border-soft/50 text-center text-xs text-txt-secondary">
            Você ainda não vinculou nenhum canal de transmissão.
          </div>
        ) : (
          <div className="space-y-2">
            {channels.map((ch) => {
              const badgeStyle = getPlatformBadgeStyle(ch.platform);
              const pName = getPlatformName(ch.platform);
              const isLive = Boolean(ch.isLive);
              const linkedSpace = mySpaces.find((s) => s.id === ch.linkedSpaceId);

              return (
                <div
                  key={ch.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-surface-elevated/80 border border-border-soft/80 gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      style={{ backgroundColor: getPlatformColor(ch.platform) }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-sm"
                    >
                      <PlatformIcon platform={ch.platform} size={16} />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
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
                            Ao Vivo ({ch.viewerCount} viewers)
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
                    <button
                      onClick={() => handleRefreshChannel(ch.id)}
                      disabled={refreshingId === ch.id}
                      title="Verificar status agora"
                      className="p-1.5 rounded-lg text-txt-secondary hover:text-txt-primary hover:bg-white/[0.04] transition-colors"
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

                    <button
                      onClick={() => handleUnlinkChannel(ch.id, ch.channelName)}
                      title="Desvincular canal"
                      className="p-1.5 rounded-lg text-txt-secondary hover:text-red-400 hover:bg-white/[0.04] transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
