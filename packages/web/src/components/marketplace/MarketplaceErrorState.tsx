import React from 'react';

interface MarketplaceErrorStateProps {
  title?: string;
  error: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function MarketplaceErrorState({
  title = 'Falha ao carregar conteúdo',
  error,
  onRetry,
  retryLabel = 'Tentar novamente',
}: MarketplaceErrorStateProps) {
  return (
    <div className="py-16 text-center border border-red-500/20 bg-red-500/5 rounded-2xl p-8 space-y-3">
      <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 mx-auto">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h3 className="text-base font-bold text-white">{title}</h3>
      <p className="text-xs text-txt-secondary max-w-sm mx-auto">{error}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 rounded-xl bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold transition-transform active:scale-95 shadow-md"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
