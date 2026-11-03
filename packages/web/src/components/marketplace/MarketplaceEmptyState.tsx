import React from 'react';
import { Mascot } from '../ui/Mascot';

interface MarketplaceEmptyStateProps {
  hasFilters: boolean;
  emptyMessage?: string;
  filteredTitle?: string;
  filteredMessage?: string;
  onClearFilters?: () => void;
  clearFiltersLabel?: string;
}

export function MarketplaceEmptyState({
  hasFilters,
  emptyMessage = 'Nada por aqui ainda. Novidades estão chegando!',
  filteredTitle = 'Nenhum resultado encontrado',
  filteredMessage = 'Não encontramos anúncios com os filtros selecionados. Tente buscar outros termos ou limpar os filtros.',
  onClearFilters,
  clearFiltersLabel = 'Limpar filtros',
}: MarketplaceEmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="py-16 text-center border border-dashed border-border-hard rounded-2xl p-8 space-y-3">
        <div className="w-12 h-12 rounded-xl bg-surface-panel flex items-center justify-center text-txt-tertiary mx-auto mb-1">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-white mb-1">{filteredTitle}</h3>
        <p className="text-xs text-txt-secondary max-w-sm mx-auto">{filteredMessage}</p>
        {onClearFilters && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onClearFilters}
              className="px-4 py-2 rounded-xl bg-surface-panel hover:bg-surface-channel border border-border-hard hover:border-accent-primary/40 text-xs font-semibold text-white transition-colors"
            >
              {clearFiltersLabel}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="py-16 flex flex-col items-center justify-center text-center select-none opacity-90">
      <Mascot state="idle" className="w-32 h-32 -mb-3" />
      <p className="text-txt-tertiary text-sm font-medium mt-3 max-w-sm px-4">
        {emptyMessage}
      </p>
    </div>
  );
}
