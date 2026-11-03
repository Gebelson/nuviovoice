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
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-surface-panel/80 hover:bg-surface-panel border border-border-hard hover:border-accent-primary/40 transition-all duration-300 shadow-xl cursor-pointer select-none"
    >
      <div>
        {/* Cover / Media Area */}
        <div className="relative h-44 w-full bg-surface-channel overflow-hidden border-b border-border-hard">
          {opportunity.coverImage ? (
            <img
              src={opportunity.coverImage}
              alt={opportunity.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-accent-primary/20 via-surface-panel to-surface-channel text-txt-tertiary">
              <div className="w-12 h-12 rounded-2xl bg-surface-base/80 border border-border-hard flex items-center justify-center text-accent-primary shadow-sm mb-1">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                </svg>
              </div>
              <span className="text-[11px] font-semibold text-txt-secondary">Serviço Especializado</span>
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
              className={`absolute top-2.5 right-2.5 p-2 rounded-full backdrop-blur-md bg-black/50 hover:bg-black/70 transition-all ${
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
            <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-md text-white/90 border border-white/10">
              {Object.keys(packages).length} {Object.keys(packages).length === 1 ? 'pacote' : 'pacotes'}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Author row */}
          <div className="flex items-center gap-2.5 mb-3">
            {opportunity.author ? (
              <Avatar
                user={opportunity.author as any}
                name={opportunity.author?.displayName || opportunity.author?.username || 'Profissional'}
                size={26}
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-surface-channel border border-border-hard" />
            )}
            <span className="text-xs font-bold text-txt-secondary truncate group-hover:text-txt-primary transition-colors">
              {opportunity.author?.displayName || opportunity.author?.username || 'Profissional'}
            </span>
          </div>

          {/* Gig Title */}
          <h3 className="text-base font-bold text-white group-hover:text-accent-primary transition-colors line-clamp-2 leading-snug mb-3">
            {opportunity.title}
          </h3>

          {/* Delivery & details meta */}
          <div className="flex items-center gap-3 text-[11px] text-txt-tertiary mb-2">
            {deliveryDays && (
              <span className="flex items-center gap-1 font-medium">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {deliveryDays} {deliveryDays === 1 ? 'dia' : 'dias'}
              </span>
            )}
            {opportunity.revisionsCount !== undefined && opportunity.revisionsCount !== null && (
              <span className="flex items-center gap-1 font-medium">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
      <div className="px-5 py-3.5 border-t border-border-hard bg-surface-channel/40 flex items-center justify-between">
        <span className="text-xs text-txt-tertiary font-medium">A partir de</span>
        <span className="text-sm font-extrabold text-accent-primary">
          {getStartingPrice()}
        </span>
      </div>
    </div>
  );
}
