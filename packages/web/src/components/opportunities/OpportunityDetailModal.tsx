import React, { useState } from 'react';
import type { OpportunityItem, GigPackage } from '@concord/shared';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { useAuthStore } from '../../stores/authStore';
import { useOpportunityStore } from '../../stores/opportunityStore';
import { useFormatters } from '../../i18n/formatters';

interface OpportunityDetailModalProps {
  opportunity: OpportunityItem | null;
  isOpen: boolean;
  onClose: () => void;
  onApply: (opportunity: OpportunityItem, selectedPackage?: 'basic' | 'standard' | 'premium' | 'custom') => void;
  onEdit?: (opportunity: OpportunityItem) => void;
}

export function OpportunityDetailModal({
  opportunity,
  isOpen,
  onClose,
  onApply,
  onEdit,
}: OpportunityDetailModalProps) {
  const f = useFormatters();
  const currentUser = useAuthStore((s) => s.user);
  const { toggleFavorite, favorites, updateOpportunityStatus } = useOpportunityStore();

  const [selectedGigTier, setSelectedGigTier] = useState<'basic' | 'standard' | 'premium'>('basic');
  const [copiedLink, setCopiedLink] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');

  if (!isOpen || !opportunity) return null;

  const isAuthor = currentUser?.id === opportunity.userId;
  const isFavorite = favorites.some((fav) => fav.id === opportunity.id);
  const isJob = opportunity.type === 'job';
  const isFreelance = opportunity.type === 'freelance';
  const isGig = opportunity.type === 'gig';

  // Format salary / budget
  const formatSalary = () => {
    if (isFreelance) {
      if (opportunity.budget) {
        return `${f.formatCurrency(opportunity.budget)}${opportunity.budgetType === 'hourly' ? '/hora' : ' (projeto)'}`;
      }
      return opportunity.budgetType === 'negotiable' ? 'Orçamento a combinar' : 'Orçamento não informado';
    }

    if (opportunity.remunerationType === 'range' && opportunity.salaryMin && opportunity.salaryMax) {
      return `${f.formatCurrency(opportunity.salaryMin)} - ${f.formatCurrency(opportunity.salaryMax)}${opportunity.remunerationType ? ` / ${opportunity.remunerationType}` : ' / mês'}`;
    }
    if (opportunity.salaryMin) {
      return `A partir de ${f.formatCurrency(opportunity.salaryMin)}${opportunity.remunerationType ? ` / ${opportunity.remunerationType}` : ' / mês'}`;
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

  const handleCopyLink = () => {
    const url = `${window.location.origin}/opportunities?tab=${opportunity.type === 'job' ? 'jobs' : opportunity.type === 'freelance' ? 'freelance' : 'gigs'}&id=${opportunity.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleToggleStatus = async () => {
    const newStatus = opportunity.status === 'published' ? 'paused' : 'published';
    await updateOpportunityStatus(opportunity.id, newStatus);
  };

  const handleClosePosting = async () => {
    if (window.confirm('Tem certeza que deseja encerrar esta oportunidade?')) {
      await updateOpportunityStatus(opportunity.id, 'closed');
      onClose();
    }
  };

  const renderGigPackageCard = (tierKey: 'basic' | 'standard' | 'premium', title: string, tier?: GigPackage) => {
    if (!tier && tierKey !== 'basic') return null;

    const isSelected = selectedGigTier === tierKey;
    const name = tier?.title || tier?.name || (tierKey === 'basic' ? 'Básico' : tierKey === 'standard' ? 'Padrão' : 'Premium');
    const price = tier?.price ?? (tierKey === 'basic' ? opportunity.budget : undefined);
    const days = tier?.deliveryDays ?? opportunity.deliveryDays;
    const revs = tier?.revisions ?? opportunity.revisionsCount;

    return (
      <div
        onClick={() => setSelectedGigTier(tierKey)}
        className={`flex-1 p-5 rounded-2xl border transition-all cursor-pointer ${
          isSelected
            ? 'bg-accent-primary/15 border-accent-primary shadow-lg shadow-accent-primary/10'
            : 'bg-surface-channel border-border-hard hover:border-border-soft'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-txt-secondary">{title}</span>
          {isSelected && (
            <span className="w-2.5 h-2.5 rounded-full bg-accent-primary shadow-sm" />
          )}
        </div>
        <div className="text-base font-bold text-white mb-1">{name}</div>
        <div className="text-xl font-extrabold text-accent-primary mb-3">
          {price ? f.formatCurrency(price) : 'Sob consulta'}
        </div>

        {tier?.description && (
          <p className="text-xs text-txt-secondary mb-3.5 line-clamp-2 leading-relaxed">{tier.description}</p>
        )}

        <div className="space-y-2 text-xs text-txt-secondary pt-3 border-t border-border-hard">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{days ? `${days} dias de entrega` : 'Prazo a combinar'}</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            <span>{revs !== undefined && revs !== null ? `${revs} revisões incluídas` : 'Revisões a combinar'}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-3xl" mobileStyle="fullscreen">
      <div className="flex flex-col max-h-[85vh] overflow-hidden -m-6 bg-surface-chat">
        {/* Header Bar */}
        <div className="p-6 pb-4 border-b border-border-hard bg-surface-panel/90 flex items-start justify-between gap-4 backdrop-blur-md">
          <div className="flex items-start gap-4 min-w-0">
            {opportunity.companyLogo ? (
              <img
                src={opportunity.companyLogo}
                alt={opportunity.companyName || opportunity.title}
                className="w-14 h-14 rounded-2xl object-cover border border-border-hard flex-shrink-0 shadow-sm"
              />
            ) : (
              <Avatar
                userId={opportunity.userId}
                src={opportunity.author?.avatar}
                name={opportunity.author?.displayName || opportunity.author?.username || 'Anunciante'}
                size={56}
                className="flex-shrink-0 ring-2 ring-border-hard"
              />
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                    isJob
                      ? 'bg-blue-500/15 text-blue-400 border-blue-500/25'
                      : isFreelance
                      ? 'bg-purple-500/15 text-purple-400 border-purple-500/25'
                      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                  }`}
                >
                  {isJob ? 'Vaga de Emprego' : isFreelance ? 'Projeto Freelance' : 'Serviço Profissional'}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${modality.color}`}>
                  {modality.label}
                </span>
                {opportunity.category && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-txt-secondary px-2.5 py-0.5 bg-surface-channel rounded-full border border-border-hard">
                    {opportunity.category}
                  </span>
                )}
                {opportunity.status === 'paused' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 px-2.5 py-0.5 bg-amber-500/15 rounded-full border border-amber-500/25">
                    Pausada
                  </span>
                )}
                {opportunity.status === 'closed' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 px-2.5 py-0.5 bg-rose-500/15 rounded-full border border-rose-500/25">
                    Encerrada
                  </span>
                )}
              </div>

              <h2 className="text-xl font-extrabold text-white tracking-tight truncate">{opportunity.title}</h2>

              <p className="text-xs text-txt-secondary flex items-center gap-2 mt-1">
                <span className="font-semibold text-txt-primary">{opportunity.companyName || opportunity.author?.displayName || opportunity.author?.username || 'Anunciante'}</span>
                {opportunity.locationCity && (
                  <>
                    <span>•</span>
                    <span>{opportunity.locationCity}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-txt-tertiary hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          {/* Cover for Gigs */}
          {isGig && opportunity.coverImage && (
            <div className="w-full h-56 rounded-2xl overflow-hidden border border-border-hard shadow-xl">
              <img src={opportunity.coverImage} alt={opportunity.title} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Key Metrics / Highlights Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-surface-panel/80 border border-border-hard rounded-2xl shadow-xl">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-txt-secondary block font-bold">Remuneração / Valor</span>
              <span className="text-sm font-extrabold text-accent-primary mt-0.5 block">{formatSalary()}</span>
            </div>
            {opportunity.contractType && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-txt-secondary block font-bold">Contratação</span>
                <span className="text-sm font-bold text-white mt-0.5 block">{opportunity.contractType.toUpperCase()}</span>
              </div>
            )}
            {opportunity.experienceLevel && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-txt-secondary block font-bold">Experiência</span>
                <span className="text-sm font-bold text-white mt-0.5 block capitalize">{opportunity.experienceLevel}</span>
              </div>
            )}
            <div>
              <span className="text-[10px] uppercase tracking-wider text-txt-secondary block font-bold">Publicado em</span>
              <span className="text-sm font-bold text-white mt-0.5 block">
                {f.formatShortDate(opportunity.createdAt)}
              </span>
            </div>
          </div>

          {/* Gigs Packages Selector */}
          {isGig && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary mb-3">Escolha o Pacote Ideal</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                {renderGigPackageCard('basic', 'Básico', opportunity.packages?.basic)}
                {opportunity.packages?.standard &&
                  renderGigPackageCard('standard', 'Padrão', opportunity.packages.standard)}
                {opportunity.packages?.premium &&
                  renderGigPackageCard('premium', 'Premium', opportunity.packages.premium)}
              </div>
            </div>
          )}

          {/* Main Description */}
          <div className="p-6 bg-surface-panel/80 border border-border-hard rounded-2xl shadow-xl space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary">Sobre esta Oportunidade</h3>
            <div className="text-xs text-txt-secondary leading-relaxed whitespace-pre-line pt-1">
              {opportunity.description}
            </div>
          </div>

          {/* Responsibilities */}
          {opportunity.responsibilities && (
            <div className="p-6 bg-surface-panel/80 border border-border-hard rounded-2xl shadow-xl space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary">Responsabilidades e Atividades</h3>
              <ul className="space-y-2 text-xs text-txt-secondary pt-1">
                {opportunity.responsibilities.split('\n').map((r, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="text-accent-primary mt-0.5">•</span>
                    <span className="leading-relaxed">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Minimum Qualifications */}
          {opportunity.qualificationsMin && (
            <div className="p-6 bg-surface-panel/80 border border-border-hard rounded-2xl shadow-xl space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary">Qualificações Necessárias</h3>
              <ul className="space-y-2 text-xs text-txt-secondary pt-1">
                {opportunity.qualificationsMin.split('\n').map((q, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400 flex-shrink-0 mt-0.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="leading-relaxed">{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Desired Qualifications */}
          {opportunity.qualificationsPref && (
            <div className="p-6 bg-surface-panel/80 border border-border-hard rounded-2xl shadow-xl space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary">Diferenciais</h3>
              <ul className="space-y-2 text-xs text-txt-secondary pt-1">
                {opportunity.qualificationsPref.split('\n').map((dq, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-primary flex-shrink-0 mt-0.5">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="leading-relaxed">{dq}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Skills Required */}
          {opportunity.skills && opportunity.skills.length > 0 && (
            <div className="p-6 bg-surface-panel/80 border border-border-hard rounded-2xl shadow-xl space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary">Habilidades Desejadas</h3>
              <div className="flex flex-wrap gap-2 pt-1">
                {opportunity.skills.map((skill, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 text-xs font-semibold rounded-lg bg-surface-channel border border-border-hard text-white"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Benefits */}
          {opportunity.benefits && opportunity.benefits.length > 0 && (
            <div className="p-6 bg-surface-panel/80 border border-border-hard rounded-2xl shadow-xl space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary">Benefícios</h3>
              <div className="flex flex-wrap gap-2 pt-1">
                {opportunity.benefits.map((benefit, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {benefit}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Portfolio & Visual References */}
          {opportunity.gallery && opportunity.gallery.length > 0 && (
            <div className="p-6 bg-surface-panel/80 border border-border-hard rounded-2xl shadow-xl space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-txt-secondary">Trabalhos Anteriores & Referências</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                {opportunity.gallery.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3.5 bg-surface-channel hover:bg-surface-elevated border border-border-hard rounded-xl flex items-center justify-between text-xs text-txt-secondary hover:text-white transition-colors"
                  >
                    <span className="truncate">Portfólio #{i + 1}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* External Link */}
          {opportunity.externalLink && (
            <div className="p-4 bg-surface-panel/80 border border-border-hard rounded-2xl flex items-center justify-between">
              <span className="text-xs text-txt-secondary">Informações externas disponíveis</span>
              <a
                href={opportunity.externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-accent-primary hover:underline flex items-center gap-1.5"
              >
                Visitar site oficial
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 border-t border-border-hard bg-surface-panel/90 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleFavorite(opportunity.id)}
              className={`px-3 py-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold ${
                isFavorite
                  ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  : 'bg-surface-channel hover:bg-surface-elevated text-txt-secondary hover:text-white border-border-hard'
              }`}
              title="Salvar nos favoritos"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill={isFavorite ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              <span>{isFavorite ? 'Salvo' : 'Salvar'}</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="px-3 py-2 rounded-xl border border-border-hard bg-surface-channel hover:bg-surface-elevated text-txt-secondary hover:text-white transition-all flex items-center gap-1.5 text-xs font-semibold"
              title="Copiar link"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>{copiedLink ? 'Copiado!' : 'Compartilhar'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isAuthor ? (
              <>
                <button
                  onClick={handleToggleStatus}
                  className="px-4 py-2.5 rounded-xl border border-border-hard bg-surface-channel hover:bg-surface-elevated text-xs font-bold text-white transition-all"
                >
                  {opportunity.status === 'published' ? 'Pausar Publicação' : 'Retomar Publicação'}
                </button>
                {opportunity.status !== 'closed' && (
                  <button
                    onClick={handleClosePosting}
                    className="px-4 py-2.5 rounded-xl border border-rose-500/25 bg-rose-500/15 hover:bg-rose-500/25 text-xs font-bold text-rose-400 transition-all"
                  >
                    Encerrar
                  </button>
                )}
                {onEdit && (
                  <button
                    onClick={() => {
                      onClose();
                      onEdit(opportunity);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold transition-all shadow-lg shadow-accent-primary/20"
                  >
                    Editar Anúncio
                  </button>
                )}
              </>
            ) : (
              <button
                disabled={opportunity.status === 'closed'}
                onClick={() => {
                  onClose();
                  onApply(opportunity, isGig ? selectedGigTier : undefined);
                }}
                className="px-6 py-2.5 rounded-xl bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-lg shadow-accent-primary/25"
              >
                {opportunity.status === 'closed'
                  ? 'Oportunidade Encerrada'
                  : isJob
                  ? 'Candidatar-se à Vaga'
                  : isFreelance
                  ? 'Enviar Proposta'
                  : 'Contratar Serviço'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
