import React, { useState, useMemo, useRef, useEffect } from 'react';
import { OFFICIAL_WINKS, type OfficialWink, type WinkCategory } from '@concord/shared/src/winks';
import { useWinkStore } from '../../stores/winkStore';
import { SparklesIcon } from '../ui/icons';

interface WinkPickerPopoverProps {
  onSelect: (wink: OfficialWink) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export function WinkPickerPopover({ onSelect, onClose, anchorRef }: WinkPickerPopoverProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<WinkCategory | 'all'>('all');
  const [previewWink, setPreviewWink] = useState<OfficialWink | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const recentWinkIds = useWinkStore((s) => s.recentWinkIds);

  // Close on Click Outside or Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current && anchorRef.current.contains(target)) return;
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
  }, [onClose, anchorRef]);

  const recentWinks = useMemo(() => {
    return recentWinkIds
      .map((id) => OFFICIAL_WINKS.find((w) => w.id === id))
      .filter((w): w is OfficialWink => w !== undefined);
  }, [recentWinkIds]);

  const filteredWinks = useMemo(() => {
    let list = OFFICIAL_WINKS;
    if (selectedCategory !== 'all') {
      list = list.filter((w) => w.category === selectedCategory);
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
    return list;
  }, [search, selectedCategory]);

  const handleSend = (wink: OfficialWink) => {
    useWinkStore.getState().recordRecentWink(wink.id);
    onSelect(wink);
    onClose();
  };

  const categories: Array<{ id: WinkCategory | 'all'; label: string }> = [
    { id: 'all', label: 'Todos' },
    { id: 'romance', label: 'Romance' },
    { id: 'fun', label: 'Diversão' },
    { id: 'emotions', label: 'Emoções' },
    { id: 'celebration', label: 'Festa' },
  ];

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-full mb-3 right-0 w-[340px] max-w-[calc(100vw-24px)] sm:w-[380px] max-h-[480px] flex flex-col rounded-2xl bg-[#14151a]/95 backdrop-blur-2xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.7)] text-txt-primary z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      style={{
        boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 24px 64px -12px rgba(0,0,0,0.8)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-white/[0.08]">
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

      {/* Search Input */}
      <div className="px-4 py-2.5">
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

        {/* Category Pills */}
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
      </div>

      {/* Scrollable Catalog */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4 max-h-[320px] scrollbar-thin">
        {/* Recents Section */}
        {!search && selectedCategory === 'all' && recentWinks.length > 0 && (
          <div>
            <div className="text-[11px] font-medium text-txt-tertiary uppercase tracking-wider mb-2">
              Utilizados recentemente
            </div>
            <div className="grid grid-cols-4 gap-2">
              {recentWinks.map((wink) => (
                <button
                  key={`recent-${wink.id}`}
                  onClick={() => handleSend(wink)}
                  onMouseEnter={() => setPreviewWink(wink)}
                  className="group relative flex flex-col items-center p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-accent-primary/50 transition-all text-center"
                  title={`${wink.name} - Clique para enviar`}
                >
                  <span className="text-2xl mb-1 group-hover:scale-125 transition-transform duration-200">
                    {wink.previewEmoji}
                  </span>
                  <span className="text-[11px] text-txt-secondary group-hover:text-white truncate w-full">
                    {wink.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* All Winks Section */}
        <div>
          <div className="text-[11px] font-medium text-txt-tertiary uppercase tracking-wider mb-2">
            Todos os Winks ({filteredWinks.length})
          </div>
          {filteredWinks.length === 0 ? (
            <div className="py-8 text-center text-xs text-txt-tertiary">
              Nenhum Wink encontrado para "{search}"
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredWinks.map((wink) => (
                <button
                  key={wink.id}
                  onClick={() => handleSend(wink)}
                  onMouseEnter={() => setPreviewWink(wink)}
                  className="group flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-accent-primary/50 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-white/[0.06] group-hover:bg-accent-primary/20 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
                    {wink.previewEmoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-txt-primary group-hover:text-white truncate">
                      {wink.name}
                    </div>
                    <div className="text-[10px] text-txt-tertiary truncate">
                      {wink.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Preview Bar */}
      {previewWink && (
        <div className="px-4 py-2 bg-black/40 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 truncate mr-2">
            <span className="text-sm">{previewWink.previewEmoji}</span>
            <span className="text-white font-medium truncate">{previewWink.name}</span>
            <span className="text-txt-tertiary text-[10px]">({Math.round(previewWink.durationMs / 1000)}s)</span>
          </div>
          <button
            onClick={() => handleSend(previewWink)}
            className="px-2.5 py-1 bg-accent-primary hover:bg-accent-primary-hover text-white rounded-lg text-xs font-medium shrink-0 transition-colors shadow-sm"
          >
            Enviar
          </button>
        </div>
      )}
    </div>
  );
}
