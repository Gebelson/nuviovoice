import React from 'react';
import type { OpportunityItem } from '@concord/shared';
import { Avatar } from '../ui/Avatar';
import { useFormatters } from '../../i18n/formatters';

interface OpportunityCardProps {
  opportunity: OpportunityItem;
  onClick: () => void;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  isFavorite?: boolean;
}

export function OpportunityCard({ opportunity, onClick, onToggleFavorite, isFavorite }: OpportunityCardProps) {
  const f = useFormatters();
  const isJob = opportunity.type === 'job';

  // Format salary / remuneration / budget
  const formatSalary = () => {
    if (opportunity.type === 'freelance') {
      if (opportunity.budget) {
        return `Orçamento: ${f.formatCurrency(opportunity.budget)}${opportunity.budgetType === 'hourly' ? '/h' : ''}`;
      }
      return opportunity.budgetType === 'negotiable' ? 'Orçamento a combinar' : 'Orçamento não informado';
    }

    if (opportunity.remunerationType === 'range' && opportunity.salaryMin && opportunity.salaryMax) {
      return `${f.formatCurrency(opportunity.salaryMin)} - ${f.formatCurrency(opportunity.salaryMax)}`;
    }
    if (opportunity.salaryMin) {
      return `A partir de ${f.formatCurrency(opportunity.salaryMin)}`;
    }
    if (opportunity.remunerationType === 'negotiable') return 'Salário a combinar';
    return 'Remuneração sob consulta';
  };

  const getModalityBadge = () => {
    switch (opportunity.workModality) {
      case 'remote':
        return { label: 'Remoto', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' };
      case 'hybrid':
        return { label: 'Híbrido', color: 'bg-amber-500/15 text-amber-400 border-amber-500/25' };
      case 'onsite':
        return { label: 'Presencial', color: 'bg-sky-500/15 text-sky-400 border-sky-500/25' };
      default:
        return { label: 'A combinar', color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25' };
    }
  };

  const modality = getModalityBadge();

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col justify-between rounded-2xl bg-surface-panel/80 hover:bg-surface-panel border border-border-hard hover:border-accent-primary/40 transition-all duration-300 shadow-xl overflow-hidden cursor-pointer select-none p-5"
    >
      <div>
        {/* Header row: Company logo / author + Modality badge + Favorite */}
        <div className="flex items-start justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-3 min-w-0">
            {opportunity.companyLogo ? (
              <img
                src={opportunity.companyLogo}
                alt={opportunity.companyName || 'Empresa'}
                className="w-10 h-10 rounded-xl object-cover bg-surface-channel border border-border-hard shadow-sm"
              />
            ) : opportunity.author ? (
              <Avatar
                user={opportunity.author as any}
                name={opportunity.author.displayName || opportunity.author.username || 'Anunciante'}
                size={36}
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-surface-channel border border-border-hard flex items-center justify-center text-txt-tertiary shadow-sm">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </div>
            )}
            <div className="min-w-0">
              <span className="block text-xs font-bold text-txt-primary truncate group-hover:text-accent-primary transition-colors">
                {opportunity.companyName || opportunity.author?.displayName || opportunity.author?.username || 'Anunciante'}
              </span>
              <span className="text-[11px] text-txt-tertiary flex items-center gap-1 mt-0.5">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {opportunity.locationCity ? `${opportunity.locationCity}${opportunity.locationState ? ` - ${opportunity.locationState}` : ''}` : 'Brasil / Global'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${modality.color}`}>
              {modality.label}
            </span>
            {onToggleFavorite && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(e);
                }}
                className={`p-1.5 rounded-full backdrop-blur-md transition-colors ${
                  isFavorite ? 'text-rose-500 bg-rose-500/10' : 'text-txt-tertiary hover:text-txt-secondary hover:bg-white/5'
                }`}
                title={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill={isFavorite ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-white group-hover:text-accent-primary transition-colors line-clamp-2 leading-snug mb-2">
          {opportunity.title}
        </h3>

        {/* Short description */}
        <p className="text-xs text-txt-secondary line-clamp-2 leading-relaxed mb-4">
          {opportunity.description}
        </p>

        {/* Tags (Skills & Contract) */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {isJob && opportunity.contractType && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-channel text-txt-secondary border border-border-hard uppercase tracking-wider">
              {opportunity.contractType}
            </span>
          )}
          {opportunity.skills?.slice(0, 3).map((skill, i) => (
            <span
              key={i}
              className="text-[11px] font-medium px-2.5 py-0.5 rounded-lg bg-surface-channel/80 text-txt-secondary border border-border-hard truncate max-w-[130px]"
            >
              {skill}
            </span>
          ))}
          {opportunity.skills && opportunity.skills.length > 3 && (
            <span className="text-[11px] px-1.5 py-0.5 text-txt-tertiary">
              +{opportunity.skills.length - 3}
            </span>
          )}
        </div>
      </div>

      {/* Footer: Salary / Budget + CTA */}
      <div className="pt-3.5 border-t border-border-hard flex items-center justify-between">
        <span className="text-sm font-extrabold text-accent-primary truncate">
          {formatSalary()}
        </span>
        <span className="text-xs font-semibold text-txt-tertiary group-hover:text-txt-primary flex items-center gap-1 transition-colors">
          Ver detalhes
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </span>
      </div>
    </div>
  );
}
