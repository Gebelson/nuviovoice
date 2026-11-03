import React, { useState, useMemo, useRef, useEffect } from 'react';
import { type OfficialWink, type WinkCategory } from '@concord/shared/src/winks';
import { useWinkStore } from '../../stores/winkStore';
import { useUIStore } from '../../stores/uiStore';
import { SparklesIcon } from '../ui/icons';
import { WinkThumbnail } from './WinkThumbnail';

interface WinkPickerPopoverProps {
  onSelect: (wink: OfficialWink) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

const OFFICIAL_ORDER = ['diabravinho', 'bolsogado', 'nikole'];

export function WinkPickerPopover({ onSelect, onClose, anchorRef }: WinkPickerPopoverProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'recents'>('all');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<WinkCategory | 'all'>('all');
  const [previewWink, setPreviewWink] = useState<OfficialWink | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const favoriteWinkIds = useWinkStore((s) => s.favoriteWinkIds);
  const recentWinkIds = useWinkStore((s) => s.recentWinkIds);
  const toggleFavorite = useWinkStore((s) => s.toggleFavorite);
  const fetchFavorites = useWinkStore((s) => s.fetchFavorites);
  const fetchRecents = useWinkStore((s) => s.fetchRecents);
  const publishedWinks = useWinkStore((s) => s.publishedWinks);
  const isLoadingPublished = useWinkStore((s) => s.isLoadingPublished);
  const fetchPublishedWinks = useWinkStore((s) => s.fetchPublishedWinks);

  const storeIsMobile = useUIStore((s) => s.isMobile);
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 || storeIsMobile : false
  );

  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 768 || storeIsMobile);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [storeIsMobile]);

  const isMobile = storeIsMobile || isNarrow;

  // Track live visual viewport height on mobile to adapt dynamically
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!isMobile) return;
    const updateHeight = () => {
      const vv = window.visualViewport;
      const h = vv ? vv.height : window.innerHeight;
      const maxAllowed = Math.max(160, Math.min(460, h - 135));
      setAvailableHeight(maxAllowed);
    };
    updateHeight();
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', updateHeight);
      vv.addEventListener('scroll', updateHeight);
    }
    window.addEventListener('resize', updateHeight);
    window.addEventListener('orientationchange', updateHeight);
    return () => {
      if (vv) {
        vv.removeEventListener('resize', updateHeight);
        vv.removeEventListener('scroll', updateHeight);
      }
      window.removeEventListener('resize', updateHeight);
      window.removeEventListener('orientationchange', updateHeight);
    };
  }, [isMobile]);

  useEffect(() => {
    fetchPublishedWinks();
    fetchFavorites();
    fetchRecents();
  }, [fetchPublishedWinks, fetchFavorites, fetchRecents]);

  // Close on Click Outside or Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: Event) => {
      const target = e.target as Node;
      if (anchorRef.current && anchorRef.current.contains(target)) return;
      if (popoverRef.current && !popoverRef.current.contains(target)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [onClose, anchorRef]);

  // Available official catalog
  const catalogWinks = useMemo(() => {
    return publishedWinks.filter((w) => OFFICIAL_ORDER.includes(w.id));
  }, [publishedWinks]);

  // Map of available Winks by ID (to safely resolve favorites and recents without breaking on removed winks)
  const winkMap = useMemo(() => {
    const map = new Map<string, OfficialWink>();
    for (const w of publishedWinks) {
      map.set(w.id, w);
    }
    return map;
  }, [publishedWinks]);

  // Favorite winks (filtering out unavailable or removed ones)
  const favoriteWinks = useMemo(() => {
    return favoriteWinkIds
      .map((id) => winkMap.get(id))
      .filter((w): w is OfficialWink => w !== undefined);
  }, [favoriteWinkIds, winkMap]);

  // Recent winks (filtering out unavailable or removed ones, up to 20)
  const recentWinks = useMemo(() => {
    const seen = new Set<string>();
    const list: OfficialWink[] = [];
    for (const id of recentWinkIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      const w = winkMap.get(id);
      if (w) list.push(w);
      if (list.length >= 20) break;
    }
    return list;
  }, [recentWinkIds, winkMap]);

  // Filtered winks depending on active tab
  const displayedWinks = useMemo(() => {
    let list: OfficialWink[] = [];
    if (activeTab === 'all') {
      list = catalogWinks;
      if (selectedCategory !== 'all') {
        list = list.filter((w) => w.category === selectedCategory);
      }
    } else if (activeTab === 'favorites') {
      list = favoriteWinks;
    } else {
      list = recentWinks;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.description.toLowerCase().includes(q) ||
          w.id.toLowerCase().includes(q)
      );
    }

    return list.slice().sort((a, b) => {
      if (activeTab === 'recents') return 0; // maintain recent ordering
      const idxA = OFFICIAL_ORDER.indexOf(a.id);
      const idxB = OFFICIAL_ORDER.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [activeTab, catalogWinks, favoriteWinks, recentWinks, selectedCategory, search]);

  const handleSend = (wink: OfficialWink) => {
    onSelect(wink);
    onClose();
  };

  const categories = useMemo(() => {
    const cats = new Set<WinkCategory>();
    for (const w of catalogWinks) {
      if (w.category) {
        cats.add(w.category);
      }
    }
    const catLabels: Record<string, string> = {
      humor: 'Humor',
      fun: 'Diversão',
      reactions: 'Reações',
      emotions: 'Emoções',
      celebration: 'Festa',
      romance: 'Romance',
      love: 'Amor',
      troll: 'Troll',
      drama: 'Drama',
    };
    const list: Array<{ id: WinkCategory | 'all'; label: string }> = [{ id: 'all', label: 'Todos' }];
    for (const cat of cats) {
      list.push({ id: cat, label: catLabels[cat] || cat });
    }
    return list;
  }, [catalogWinks]);

  // Tab Navigation Bar
  const renderTabs = () => (
    <div role="tablist" aria-label="Abas de Winks" className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-xl border border-white/[0.06] mx-3 mb-2 shrink-0">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'all'}
        aria-label="Todos"
        onClick={() => setActiveTab('all')}
        className={`flex-1 py-1 px-2 rounded-lg text-xs font-medium transition-all ${
          activeTab === 'all'
            ? 'bg-accent-primary text-white shadow-sm'
            : 'text-txt-secondary hover:text-white hover:bg-white/[0.04]'
        }`}
      >
        Todos
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'favorites'}
        aria-label="Favoritos"
        onClick={() => setActiveTab('favorites')}
        className={`flex-1 py-1 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
          activeTab === 'favorites'
            ? 'bg-accent-primary text-white shadow-sm'
            : 'text-txt-secondary hover:text-white hover:bg-white/[0.04]'
        }`}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill={activeTab === 'favorites' ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
        <span>Favoritos</span>
        {favoriteWinks.length > 0 && (
          <span className="text-[10px] opacity-80">({favoriteWinks.length})</span>
        )}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'recents'}
        aria-label="Recentes"
        onClick={() => setActiveTab('recents')}
        className={`flex-1 py-1 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
          activeTab === 'recents'
            ? 'bg-accent-primary text-white shadow-sm'
            : 'text-txt-secondary hover:text-white hover:bg-white/[0.04]'
        }`}
      >
        <span>Recentes</span>
        {recentWinks.length > 0 && (
          <span className="text-[10px] opacity-80">({recentWinks.length})</span>
        )}
      </button>
    </div>
  );

  // Heart Favorite Button Component
  const renderHeartButton = (winkId: string) => {
    const isFav = favoriteWinkIds.includes(winkId);
    return (
      <button
        type="button"
        aria-label={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        title={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleFavorite(winkId);
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        className={`absolute top-1 left-1 z-20 p-1.5 rounded-lg transition-all backdrop-blur-md shadow-sm ${
          isFav
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'bg-black/60 text-white/70 hover:text-white hover:bg-black/80'
        }`}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill={isFav ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={isFav ? '1' : '2'}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={isFav ? 'text-red-500 transition-transform active:scale-125' : ''}
        >
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
      </button>
    );
  };

  // ─── Mobile View: Dedicated integrated 2-column panel without keyboard competition ───
  if (isMobile) {
    return (
      <div
        ref={popoverRef}
        role="dialog"
        aria-label="Winks"
        className="absolute bottom-full mb-2 left-0 right-0 w-full flex flex-col rounded-2xl bg-[#14151a]/95 backdrop-blur-2xl border border-white/10 text-txt-primary z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{
          maxHeight: availableHeight
            ? `${availableHeight}px`
            : 'min(460px, calc(100*var(--app-dvh) - 135px - var(--safe-bottom)))',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 20px 50px -10px rgba(0,0,0,0.9)',
        }}
      >
        {/* Compact Mobile Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-accent-primary/20 flex items-center justify-center text-accent-primary">
              <SparklesIcon width="14" height="14" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <h3 className="text-sm font-semibold text-white tracking-wide">Winks</h3>
              <span className="text-[11px] text-txt-secondary">
                ({displayedWinks.length})
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center text-txt-secondary hover:text-white rounded-lg hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 3 Tabs: Todos / Favoritos / Recentes */}
        <div className="pt-2">{renderTabs()}</div>

        {/* Dynamic Categories if 'all' tab selected */}
        {activeTab === 'all' && categories.length > 1 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/[0.04] overflow-x-auto scrollbar-none shrink-0">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-accent-primary text-white shadow-sm'
                    : 'bg-white/[0.04] text-txt-secondary hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable 2-Column Catalog with independent scroll & overscroll-contain */}
        <div
          data-testid="winks-mobile-grid-scroll"
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2.5 scrollbar-thin touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {isLoadingPublished && displayedWinks.length === 0 ? (
            <div className="grid grid-cols-2 gap-2" role="status" aria-label="Carregando Winks">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="animate-pulse flex flex-col items-center p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                >
                  <div className="w-full aspect-[4/3] max-h-[96px] rounded-lg bg-white/[0.05] mb-2" />
                  <div className="w-3/4 h-3 bg-white/[0.05] rounded mb-1" />
                  <div className="w-1/2 h-2.5 bg-white/[0.03] rounded" />
                </div>
              ))}
            </div>
          ) : displayedWinks.length === 0 ? (
            activeTab === 'favorites' ? (
              <div className="py-8 px-4 text-center">
                <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-400 mx-auto mb-2 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-white mb-1">Nenhum Wink favorito</p>
                <p className="text-[11px] text-txt-secondary">
                  Toque no coração de qualquer Wink para marcá-lo como favorito.
                </p>
              </div>
            ) : activeTab === 'recents' ? (
              <div className="py-8 px-4 text-center">
                <div className="w-10 h-10 rounded-full bg-white/[0.05] text-txt-secondary mx-auto mb-2 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-white mb-1">Nenhum Wink recente</p>
                <p className="text-[11px] text-txt-secondary">
                  Os Winks enviados em conversas aparecerão aqui automaticamente.
                </p>
              </div>
            ) : (
              <div className="py-8 px-4 text-center">
                <p className="text-xs text-txt-secondary mb-2">
                  {search ? `Nenhum Wink encontrado para "${search}"` : 'Nenhum Wink disponível'}
                </p>
                <button
                  type="button"
                  onClick={() => fetchPublishedWinks()}
                  className="px-3 py-1.5 bg-white/[0.08] hover:bg-white/[0.12] rounded-lg text-xs text-txt-primary transition-colors"
                >
                  Recarregar Winks
                </button>
              </div>
            )
          ) : (
            <div className="grid grid-cols-2 gap-2" data-testid="winks-mobile-grid">
              {displayedWinks.map((wink) => (
                <button
                  key={wink.id}
                  type="button"
                  onClick={() => handleSend(wink)}
                  className="group flex flex-col items-center p-2 rounded-xl bg-white/[0.03] active:bg-white/[0.08] hover:bg-white/[0.06] border border-white/[0.06] active:border-accent-primary/60 transition-all text-center relative overflow-hidden focus:outline-none w-full"
                >
                  {/* Thumbnail Container & Send Trigger */}
                  <div
                    className="w-full aspect-[4/3] max-h-[96px] rounded-lg bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden mb-1.5 relative shadow-inner cursor-pointer"
                    title={`${wink.name} - Enviar Wink`}
                  >
                    <WinkThumbnail wink={wink} className="w-full h-full object-cover" emojiClassName="text-3xl" />

                    {/* Heart Favorite Button */}
                    {renderHeartButton(wink.id)}

                    {/* Discrete Audio Indicator */}
                    {wink.hasAudio && (
                      <div
                        className="absolute top-1 right-1 px-1 py-0.5 rounded bg-black/75 backdrop-blur-md border border-white/15 flex items-center gap-0.5 text-txt-secondary text-[9px]"
                        title="Possui áudio"
                        aria-label="Possui áudio"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </svg>
                        <span>Áudio</span>
                      </div>
                    )}

                    {/* Discrete Alpha Indicator */}
                    {wink.hasAlpha && (
                      <div
                        className="absolute bottom-1 left-1 px-1 py-0.2 text-[8px] bg-purple-500/30 text-purple-200 rounded border border-purple-500/30 font-medium"
                        title="Fundo transparente"
                      >
                        Alpha
                      </div>
                    )}
                  </div>

                  {/* Name below thumbnail */}
                  <span
                    className="text-xs font-semibold text-txt-primary group-hover:text-white truncate w-full px-0.5"
                  >
                    {wink.name}
                  </span>
                  <span className="text-[10px] text-txt-tertiary truncate w-full mt-0.5">
                    ~{Math.round((wink.durationMs || 5000) / 1000)}s
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Desktop View: Preserved popover layout with Tabs & Heart favorites ───
  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Winks"
      className="absolute bottom-full mb-3 right-0 w-[340px] max-w-[calc(100vw-24px)] desktop:w-[400px] max-h-[520px] flex flex-col rounded-2xl bg-[#14151a]/95 backdrop-blur-2xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.7)] text-txt-primary z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      style={{
        boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 24px 64px -12px rgba(0,0,0,0.8)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent-primary/20 flex items-center justify-center text-accent-primary">
            <SparklesIcon width="16" height="16" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide">Winks</h3>
            <p className="text-[11px] text-txt-secondary">Animações clássicas para mensagens diretas</p>
          </div>
        </div>
        <button
          onClick={onClose}
          type="button"
          aria-label="Fechar"
          className="text-txt-secondary hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 3 Tabs: Todos / Favoritos / Recentes */}
      <div className="pt-2">{renderTabs()}</div>

      {/* Search Input */}
      <div className="px-4 pb-2">
        <div className="relative flex items-center">
          <svg
            className="absolute left-3 w-4 h-4 text-txt-tertiary pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Encontre um Wink..."
            className="w-full pl-9 pr-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.08] focus:bg-white/[0.08] border border-white/10 rounded-xl text-xs text-white placeholder-txt-tertiary focus:outline-none focus:ring-1 focus:ring-accent-primary/60 transition-all"
            autoFocus
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 text-txt-tertiary hover:text-txt-primary p-0.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Dynamic Categories if 'all' tab selected */}
        {activeTab === 'all' && categories.length > 1 && (
          <div className="flex items-center gap-1.5 mt-2 overflow-x-auto scrollbar-none pb-0.5">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-accent-primary text-white shadow-sm'
                    : 'bg-white/[0.04] text-txt-secondary hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable Catalog */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4 max-h-[300px] scrollbar-thin">
        {displayedWinks.length === 0 ? (
          activeTab === 'favorites' ? (
            <div className="py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-400 mx-auto mb-2 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-white mb-1">Nenhum Wink favorito</p>
              <p className="text-[11px] text-txt-secondary max-w-[220px] mx-auto">
                Clique no ícone de coração em qualquer Wink para fixá-lo como favorito.
              </p>
            </div>
          ) : activeTab === 'recents' ? (
            <div className="py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-white/[0.05] text-txt-secondary mx-auto mb-2 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-white mb-1">Nenhum Wink recente</p>
              <p className="text-[11px] text-txt-secondary max-w-[220px] mx-auto">
                Seus envios recentes aparecerão aqui automaticamente.
              </p>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-txt-tertiary">
              Nenhum Wink encontrado para "{search}"
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {displayedWinks.map((wink) => (
              <button
                key={wink.id}
                type="button"
                onClick={() => handleSend(wink)}
                onMouseEnter={() => setPreviewWink(wink)}
                className="group w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-accent-primary/50 transition-all text-left relative cursor-pointer"
              >
                {/* Thumbnail with Heart Favorite Button */}
                <div className="relative w-14 h-14 rounded-xl bg-black/40 border border-white/10 group-hover:border-accent-primary/40 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform shadow-inner">
                  <WinkThumbnail wink={wink} className="w-full h-full object-cover" emojiClassName="text-2xl" />
                  {renderHeartButton(wink.id)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-txt-primary group-hover:text-white truncate flex items-center gap-1.5">
                    <span className="truncate">{wink.name}</span>
                    {wink.hasAlpha && (
                      <span className="px-1.5 py-0.2 text-[9px] bg-purple-500/20 text-purple-300 rounded border border-purple-500/30 shrink-0 font-normal">
                        transparente
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-txt-secondary truncate mt-0.5">
                    {wink.description}
                  </div>
                  <div className="text-[10px] text-txt-tertiary mt-1 flex items-center gap-2">
                    <span>Duração: ~{Math.round((wink.durationMs || 5000) / 1000)}s</span>
                    {wink.hasAudio && <span>• Com áudio</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer Preview Bar */}
      {previewWink && (
        <div className="px-4 py-2.5 bg-black/50 border-t border-white/[0.08] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 truncate mr-2">
            <span className="text-base">{previewWink.previewEmoji}</span>
            <span className="text-white font-medium truncate">{previewWink.name}</span>
            <span className="text-txt-tertiary text-[11px]">({Math.round((previewWink.durationMs || 5000) / 1000)}s)</span>
          </div>
          <button
            onClick={() => handleSend(previewWink)}
            className="px-3 py-1 bg-accent-primary hover:bg-accent-primary-hover text-white rounded-lg text-xs font-semibold shrink-0 transition-colors shadow-sm"
          >
            Enviar
          </button>
        </div>
      )}
    </div>
  );
}
