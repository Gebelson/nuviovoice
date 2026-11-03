import React from 'react';
import type { OpportunityItem, GigPackages } from '@concord/shared';
import { Avatar } from '../ui/Avatar';
import { useFormatters } from '../../i18n/formatters';

interface GigCardProps {
  opportunity: OpportunityItem;
  onClick: () => void;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  isFavorite?: boolean;
}

export function GigCard({ opportunity, onClick, onToggleFavorite, isFavorite }: GigCardProps) {
  const f = useFormatters();
  const packages: GigPackages | null = opportunity.packages || null;

  // Calculate starting price
  const getStartingPrice = () => {
    if (packages?.basic?.price) {
      return `A partir de ${f.formatCurrency(packages.basic.price)}`;
    }
    if (opportunity.budget) {
      return `A partir de ${f.formatCurrency(opportunity.budget)}`;
    }
    return 'Sob consulta';
  };

  const deliveryDays = packages?.basic?.deliveryDays || opportunity.deliveryDays;

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col justify-between overflow-hidden bg-surface-card hover:bg-surface-card-hover border border-border-card hover:border-accent-primary/40 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-xl hover:shadow-accent-primary/5 select-none"
    >
      <div>
        {/* Cover / Media Area */}
        <div className="relative aspect-[16/10] w-full bg-surface-base overflow-hidden border-b border-border-card">
          {opportunity.coverImage ? (
            <img
              src={opportunity.coverImage}
              alt={opportunity.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-accent-primary/10 via-surface-base to-purple-900/10 text-txt-tertiary">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
              <span className="text-[11px] font-medium mt-1">Serviço Especializado</span>
            </div>
          )}

          {/* Favorite button overlay */}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(e);
              }}
              className={`absolute top-2.5 right-2.5 p-2 rounded-full backdrop-blur-md bg-black/40 hover:bg-black/60 transition-all ${
                isFavorite ? 'text-rose-500' : 'text-white/80 hover:text-white'
              }`}
              title={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill={isFavorite ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            </button>
          )}

          {/* Package count badge */}
          {packages && (
            <div className="absolute bottom-2 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/60 backdrop-blur-md text-white/90 border border-white/10">
              {Object.keys(packages).length} {Object.keys(packages).length === 1 ? 'pacote' : 'pacotes'}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Author row */}
          <div className="flex items-center gap-2 mb-2.5">
            {opportunity.author ? (
              <Avatar
                user={opportunity.author as any}
                name={opportunity.author?.displayName || opportunity.author?.username || 'Profissional'}
                size={24}
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-surface-base" />
            )}
            <span className="text-xs font-semibold text-txt-secondary truncate">
              {opportunity.author?.displayName || opportunity.author?.username || 'Profissional'}
            </span>
          </div>

          {/* Gig Title */}
          <h3 className="text-sm font-semibold text-txt-primary group-hover:text-accent-primary transition-colors line-clamp-2 leading-snug mb-3">
            {opportunity.title}
          </h3>

          {/* Delivery & details meta */}
          <div className="flex items-center gap-3 text-[11px] text-txt-muted mb-2">
            {deliveryDays && (
              <span className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {deliveryDays} {deliveryDays === 1 ? 'dia' : 'dias'}
              </span>
            )}
            {opportunity.revisionsCount !== undefined && opportunity.revisionsCount !== null && (
              <span className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                {opportunity.revisionsCount} {opportunity.revisionsCount === 1 ? 'revisão' : 'revisões'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border-subtle bg-surface-card/40 flex items-center justify-between">
        <span className="text-xs text-txt-muted">A partir de</span>
        <span className="text-sm font-bold text-accent-primary">
          {getStartingPrice()}
        </span>
      </div>
    </div>
  );
}
