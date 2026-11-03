import React from 'react';

interface MarketplaceLoadingStateProps {
  message?: string;
}

export function MarketplaceLoadingState({
  message = 'Buscando catálogo...',
}: MarketplaceLoadingStateProps) {
  return (
    <div className="py-20 flex flex-col items-center justify-center space-y-3">
      <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-xs text-txt-tertiary">{message}</p>
    </div>
  );
}
