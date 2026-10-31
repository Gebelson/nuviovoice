import React, { useRef, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useFloatingPosition } from '../../hooks/useFloatingPosition';
import { usePortalContainer } from '../../hooks/usePortalContainer';
import { useSoundpadStore } from '../../stores/soundpadStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { SoundpadAddModal } from './SoundpadAddModal';
import type { SoundpadSound } from '@concord/shared';

interface SoundpadPopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  spaceId?: string | null;
  channelId?: string | null;
  canManageSoundpad?: boolean;
}

export function SoundpadPopover({
  open,
  onClose,
  anchorRef,
  spaceId,
  channelId,
  canManageSoundpad = false,
}: SoundpadPopoverProps) {
  const { t } = useTranslation(['voice', 'common']);
  const popoverRef = useRef<HTMLDivElement>(null);
  const portalContainer = usePortalContainer();
  const isMobile = useUIStore((s) => s.isMobile);

  const sounds = useSoundpadStore((s) => s.sounds);
  const favorites = useSoundpadStore((s) => s.favorites);
  const playingSoundId = useSoundpadStore((s) => s.playingSoundId);
  const searchQuery = useSoundpadStore((s) => s.searchQuery);
  const setSearchQuery = useSoundpadStore((s) => s.setSearchQuery);
  const activeCategory = useSoundpadStore((s) => s.activeCategory);
  const setActiveCategory = useSoundpadStore((s) => s.setActiveCategory);
  const expandedSections = useSoundpadStore((s) => s.expandedSections);
  const toggleSection = useSoundpadStore((s) => s.toggleSection);
  const loadSounds = useSoundpadStore((s) => s.loadSounds);
  const playSound = useSoundpadStore((s) => s.playSound);
  const stopCurrentSound = useSoundpadStore((s) => s.stopCurrentSound);
  const toggleFavorite = useSoundpadStore((s) => s.toggleFavorite);
  const deleteSound = useSoundpadStore((s) => s.deleteSound);
  const user = useAuthStore((s) => s.user);
  const addToast = useUIStore((s) => s.addToast);

  const soundpadVolume = useVoiceStore((s) => s.soundpadVolume);
  const setSoundpadVolume = useVoiceStore((s) => s.setSoundpadVolume);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const handleDeleteSound = async (soundId: string) => {
    try {
      const ok = await deleteSound(soundId);
      if (ok) {
        addToast(t('voice:soundpad.soundDeleted', 'Som excluído com sucesso'), 'info', 2000);
      }
    } catch {
      addToast(t('voice:soundpad.soundDeleteError', 'Erro ao excluir som'), 'warning', 3000);
    }
  };

  // Desktop floating position
  const { style } = useFloatingPosition(anchorRef, popoverRef, {
    placement: 'top',
    align: 'center',
    offset: 12,
    enabled: open && !isMobile,
  });

  // Load sounds on open or spaceId change
  useEffect(() => {
    if (open) {
      void loadSounds(spaceId);
    }
  }, [open, spaceId]);

  // Click outside and Esc handling
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;

      // Se o modal de adicionar som estiver aberto, fechar apenas ele
      if (addModalOpen) {
        e.preventDefault();
        e.stopPropagation();
        setAddModalOpen(false);
        return;
      }

      // Se o popover de volume estiver aberto, fechar apenas ele
      if (showVolumeSlider) {
        e.preventDefault();
        setShowVolumeSlider(false);
        return;
      }

      onClose();
    };

    const handleClickOutside = (e: MouseEvent) => {
      // Enquanto o modal de adicionar som estiver aberto, ele controla seu próprio ciclo de fechamento
      if (addModalOpen) return;

      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (popoverRef.current && !popoverRef.current.contains(target)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, addModalOpen, showVolumeSlider, onClose, anchorRef]);

  // Filtered sounds calculation
  const filteredSounds = useMemo(() => {
    let result = sounds;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (activeCategory === 'favorites') {
      result = result.filter((s) => favorites.has(s.id));
    } else if (activeCategory === 'personal') {
      result = result.filter((s) => s.scope === 'personal');
    } else if (activeCategory === 'official') {
      result = result.filter((s) => s.scope === 'official');
    } else if (activeCategory === 'space') {
      result = result.filter((s) => s.scope === 'space');
    }

    return result;
  }, [sounds, favorites, searchQuery, activeCategory]);

  const frequentSounds = useMemo(() => {
    return sounds
      .filter((s) => (s.playCount || 0) > 0)
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, 6);
  }, [sounds]);

  const personalSounds = useMemo(() => {
    return filteredSounds.filter((s) => s.scope === 'personal');
  }, [filteredSounds]);

  const officialSounds = useMemo(() => {
    return filteredSounds.filter((s) => s.scope === 'official');
  }, [filteredSounds]);

  const spaceSounds = useMemo(() => {
    return filteredSounds.filter((s) => s.scope === 'space');
  }, [filteredSounds]);

  if (!open) return null;

  const content = (
    <>
      <div
        ref={popoverRef}
        style={!isMobile ? style : undefined}
        className={
          isMobile
            ? 'fixed inset-x-0 bottom-0 max-h-[85vh] z-50 rounded-t-3xl border-t border-white/10 bg-surface-chat/95 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden text-txt-primary p-4'
            : 'w-[390px] max-h-[530px] rounded-2xl border border-white/10 bg-surface-chat/95 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden z-50 text-txt-primary'
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile handle */}
        {isMobile && (
          <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-3 flex-shrink-0" />
        )}

        {/* HEADER */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between flex-shrink-0 gap-2">
          <div className="flex items-center gap-2">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent-primary"
            >
              <path d="m3 11 18-5v12L3 14v-3z" />
              <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
            </svg>
            <h3 className="text-sm font-bold text-white tracking-wide">Soundpad</h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Volume Toggle & Slider */}
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => setShowVolumeSlider(!showVolumeSlider)}
                className={`p-1.5 rounded-lg text-txt-tertiary hover:text-white transition-colors ${
                  showVolumeSlider ? 'bg-white/10 text-white' : 'hover:bg-white/5'
                }`}
                title="Volume do Soundpad"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77zm-2.5-1.73L6.47 6H2v12h4.47l5.03 4.5V1.5z" />
                </svg>
              </button>

              {showVolumeSlider && (
                <div className="absolute right-0 top-8 z-20 p-2.5 rounded-xl bg-surface-base border border-white/10 shadow-xl flex items-center gap-2 w-44">
                  <span className="text-[10px] text-txt-tertiary font-bold w-7">{soundpadVolume}%</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={soundpadVolume}
                    onChange={(e) => setSoundpadVolume(parseInt(e.target.value, 10))}
                    className="w-full accent-accent-primary h-1.5 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Add Sound button */}
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-accent-primary hover:bg-accent-primary/90 text-white text-[11px] font-bold flex items-center gap-1 transition-all shadow-sm active:scale-95"
            >
              <span className="text-xs">+</span> Som
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-txt-tertiary hover:text-white hover:bg-white/5 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* SEARCH BOX */}
        <div className="px-4 pt-3 pb-2 flex-shrink-0">
          <div className="relative">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-tertiary"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Encontre o som perfeito"
              className="w-full bg-surface-base/80 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-txt-tertiary focus:outline-none focus:border-accent-primary transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-txt-tertiary hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* CATEGORY FILTER CHIPS */}
        <div className="px-4 pb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'favorites', label: '★ Favoritos' },
            { id: 'personal', label: 'Meus Sons' },
            { id: 'official', label: 'Nuvio' },
            ...(spaceId ? [{ id: 'space', label: 'Espaço' }] : []),
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                activeCategory === cat.id
                  ? 'bg-accent-primary text-white shadow'
                  : 'bg-white/5 hover:bg-white/10 text-txt-secondary hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* SCROLLABLE SOUND LIST */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4 no-scrollbar">
          {/* ─── SECTION 1: FREQUENT SOUNDS ─── */}
          {frequentSounds.length > 0 && activeCategory === 'all' && !searchQuery && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => toggleSection('recent')}
                className="w-full flex items-center justify-between text-[11px] font-bold text-txt-tertiary hover:text-white uppercase tracking-wider transition-colors"
              >
                <span>Utilizados com frequência ({frequentSounds.length})</span>
                <span>{expandedSections.recent ? '▾' : '▸'}</span>
              </button>

              {expandedSections.recent && (
                <div className="grid grid-cols-2 gap-2">
                  {frequentSounds.map((s) => (
                    <SoundItem
                      key={s.id}
                      sound={s}
                      isPlaying={playingSoundId === s.id}
                      isFavorite={favorites.has(s.id)}
                      onPlay={() => void playSound(s, spaceId, channelId)}
                      onStop={stopCurrentSound}
                      onToggleFavorite={() => void toggleFavorite(s.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── SECTION 2: PERSONAL SOUNDS ─── */}
          {(activeCategory === 'all' || activeCategory === 'personal') && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => toggleSection('personal')}
                className="w-full flex items-center justify-between text-[11px] font-bold text-txt-tertiary hover:text-white uppercase tracking-wider transition-colors"
              >
                <span>Meus Sons ({personalSounds.length})</span>
                <span>{expandedSections.personal ? '▾' : '▸'}</span>
              </button>

              {expandedSections.personal && (
                <>
                  {personalSounds.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-white/10 text-center space-y-2 bg-white/[0.01]">
                      <p className="text-xs text-txt-tertiary">
                        {searchQuery
                          ? 'Nenhum som pessoal encontrado para a busca.'
                          : 'Você ainda não adicionou nenhum som.'}
                      </p>
                      {!searchQuery && (
                        <button
                          type="button"
                          onClick={() => setAddModalOpen(true)}
                          className="px-3 py-1.5 rounded-lg bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold transition-all inline-flex items-center gap-1 shadow-md"
                        >
                          + Adicionar som
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {personalSounds.map((s) => (
                        <SoundItem
                          key={s.id}
                          sound={s}
                          isPlaying={playingSoundId === s.id}
                          isFavorite={favorites.has(s.id)}
                          canDelete={s.ownerId === user?.id}
                          onPlay={() => void playSound(s, spaceId, channelId)}
                          onStop={stopCurrentSound}
                          onToggleFavorite={() => void toggleFavorite(s.id)}
                          onDelete={() => void handleDeleteSound(s.id)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ─── SECTION 3: SPACE SOUNDS (IF IN SPACE) ─── */}
          {spaceId && (activeCategory === 'all' || activeCategory === 'space') && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => toggleSection('space')}
                className="w-full flex items-center justify-between text-[11px] font-bold text-txt-tertiary hover:text-white uppercase tracking-wider transition-colors"
              >
                <span>Sons do Espaço ({spaceSounds.length})</span>
                <span>{expandedSections.space ? '▾' : '▸'}</span>
              </button>

              {expandedSections.space && (
                <>
                  {spaceSounds.length === 0 ? (
                    <div className="p-3 rounded-xl border border-dashed border-white/10 text-center text-xs text-txt-tertiary bg-white/[0.01]">
                      Nenhum som compartilhado neste espaço ainda.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {spaceSounds.map((s) => (
                        <SoundItem
                          key={s.id}
                          sound={s}
                          isPlaying={playingSoundId === s.id}
                          isFavorite={favorites.has(s.id)}
                          canDelete={canManageSoundpad || s.ownerId === user?.id}
                          onPlay={() => void playSound(s, spaceId, channelId)}
                          onStop={stopCurrentSound}
                          onToggleFavorite={() => void toggleFavorite(s.id)}
                          onDelete={() => void handleDeleteSound(s.id)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ─── SECTION 4: OFFICIAL NUVIO SOUNDS ─── */}
          {(activeCategory === 'all' || activeCategory === 'official' || activeCategory === 'favorites') && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => toggleSection('official')}
                className="w-full flex items-center justify-between text-[11px] font-bold text-txt-tertiary hover:text-white uppercase tracking-wider transition-colors"
              >
                <span>Sons do Nuvio ({officialSounds.length})</span>
                <span>{expandedSections.official ? '▾' : '▸'}</span>
              </button>

              {expandedSections.official && (
                <div className="grid grid-cols-2 gap-2">
                  {officialSounds.map((s) => (
                    <SoundItem
                      key={s.id}
                      sound={s}
                      isPlaying={playingSoundId === s.id}
                      isFavorite={favorites.has(s.id)}
                      onPlay={() => void playSound(s, spaceId, channelId)}
                      onStop={stopCurrentSound}
                      onToggleFavorite={() => void toggleFavorite(s.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* No results for query */}
          {filteredSounds.length === 0 && (
            <div className="py-8 text-center text-xs text-txt-tertiary space-y-1">
              <div className="text-2xl">🔍</div>
              <p>Nenhum som encontrado para "{searchQuery}".</p>
            </div>
          )}
        </div>

        {/* FOOTER BAR */}
        <div className="px-4 py-2 border-t border-white/10 bg-black/20 flex items-center justify-between text-[11px] text-txt-tertiary flex-shrink-0">
          <span>{filteredSounds.length} sons disponíveis</span>
          {playingSoundId && (
            <button
              type="button"
              onClick={stopCurrentSound}
              className="text-accent-rose hover:underline font-bold flex items-center gap-1"
            >
              ■ Parar som atual
            </button>
          )}
        </div>
      </div>

      {/* Add Sound Modal */}
      <SoundpadAddModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        spaceId={spaceId}
        canManageSoundpad={canManageSoundpad}
      />
    </>
  );

  return createPortal(content, portalContainer || document.body);
}

interface SoundItemProps {
  sound: SoundpadSound;
  isPlaying: boolean;
  isFavorite: boolean;
  canDelete?: boolean;
  onPlay: () => void;
  onStop: () => void;
  onToggleFavorite: () => void;
  onDelete?: () => void;
}

function SoundItem({
  sound,
  isPlaying,
  isFavorite,
  canDelete,
  onPlay,
  onStop,
  onToggleFavorite,
  onDelete,
}: SoundItemProps) {
  return (
    <button
      type="button"
      onClick={isPlaying ? onStop : onPlay}
      className={`group relative flex items-center gap-2.5 p-2 rounded-xl border transition-all text-left overflow-hidden ${
        isPlaying
          ? 'bg-accent-primary/20 border-accent-primary ring-1 ring-accent-primary/50 scale-[1.02] shadow-lg shadow-accent-primary/10'
          : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/5 active:scale-95'
      }`}
    >
      {/* Playing equalizer wave animation */}
      {isPlaying && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-accent-primary animate-pulse" />
      )}

      {/* Emoji or Icon */}
      <span className="text-xl flex-shrink-0 select-none">
        {sound.emoji || '🎵'}
      </span>

      {/* Details */}
      <div className="min-w-0 flex-1 pr-6">
        <span
          className={`block text-xs font-bold truncate leading-tight ${
            isPlaying ? 'text-accent-primary' : 'text-white'
          }`}
          title={sound.name}
        >
          {sound.name}
        </span>
        <span className="block text-[10px] text-txt-tertiary truncate leading-tight mt-0.5">
          {sound.category}
        </span>
      </div>

      {/* Action buttons (Delete & Favorite) */}
      <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5">
        {canDelete && onDelete && (
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                onDelete();
              }
            }}
            className="w-5 h-5 flex items-center justify-center rounded-md transition-all text-[11px] text-txt-tertiary opacity-0 group-hover:opacity-100 hover:text-accent-rose hover:bg-white/10"
            title="Excluir som"
          >
            🗑️
          </div>
        )}

        {/* Favorite heart icon */}
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onToggleFavorite();
            }
          }}
          className={`w-5 h-5 flex items-center justify-center rounded-md transition-all text-[11px] ${
            isFavorite
              ? 'text-red-400 opacity-100'
              : 'text-txt-tertiary opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-white/10'
          }`}
          title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
          {isFavorite ? '❤️' : '🤍'}
        </div>
      </div>
    </button>
  );
}
