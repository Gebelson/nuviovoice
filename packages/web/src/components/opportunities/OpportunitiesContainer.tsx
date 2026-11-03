import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { OpportunityItem, OpportunityType, WorkModality, ContractType } from '@concord/shared';
import { OPPORTUNITY_CATEGORIES } from '@concord/shared';
import { useOpportunityStore } from '../../stores/opportunityStore';
import { useAuthStore } from '../../stores/authStore';
import { OpportunityCard } from './OpportunityCard';
import { GigCard } from './GigCard';
import { OpportunityDetailModal } from './OpportunityDetailModal';
import { CreateOpportunityModal } from './CreateOpportunityModal';
import { ApplyModal } from './ApplyModal';
import { ProposalsInbox } from './ProposalsInbox';
import { ProfessionalProfileView } from './ProfessionalProfileView';

export function OpportunitiesContainer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUser = useAuthStore((s) => s.user);

  const {
    opportunities,
    myOpportunities,
    favorites,
    favoriteIds,
    applicationCounts,
    isLoading,
    fetchOpportunities,
    fetchMyOpportunities,
    fetchFavorites,
    toggleFavorite,
    receivedApplications,
  } = useOpportunityStore();

  // URL state sync
  const currentTabParam = searchParams.get('tab') || 'explore';
  const targetIdParam = searchParams.get('id');

  const [activeTab, setActiveTab] = useState<string>(currentTabParam);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedModality, setSelectedModality] = useState<WorkModality | 'all'>('all');
  const [selectedContract, setSelectedContract] = useState<ContractType | 'all'>('all');
  const [minSalaryFilter, setMinSalaryFilter] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Modals state
  const [selectedOpportunity, setSelectedOpportunity] = useState<OpportunityItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<OpportunityItem | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyingOpportunity, setApplyingOpportunity] = useState<OpportunityItem | null>(null);

  // Initial loads
  useEffect(() => {
    fetchOpportunities();
    fetchMyOpportunities();
    fetchFavorites();
  }, [fetchOpportunities, fetchMyOpportunities, fetchFavorites]);

  // Sync tab with URL
  useEffect(() => {
    if (currentTabParam && currentTabParam !== activeTab) {
      setActiveTab(currentTabParam);
    }
  }, [currentTabParam]);

  // Sync direct deep-link to opportunity by ?id=...
  useEffect(() => {
    if (targetIdParam && opportunities.length > 0) {
      const match = opportunities.find((o) => o.id === targetIdParam);
      if (match) {
        setSelectedOpportunity(match);
        setShowDetailModal(true);
      }
    }
  }, [targetIdParam, opportunities]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  // Filter opportunities
  const filteredOpportunities = useMemo(() => {
    let list: OpportunityItem[] = [];

    if (activeTab === 'my_listings') {
      list = myOpportunities;
    } else if (activeTab === 'saved') {
      list = favorites;
    } else {
      list = opportunities.filter((o) => {
        if (activeTab === 'jobs' && o.type !== 'job') return false;
        if (activeTab === 'freelance' && o.type !== 'freelance') return false;
        if (activeTab === 'gigs' && o.type !== 'gig') return false;
        return true;
      });
    }

    return list.filter((o) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = o.title.toLowerCase().includes(q);
        const matchesDesc = o.description.toLowerCase().includes(q);
        const matchesCompany = o.companyName?.toLowerCase().includes(q);
        const matchesSkills = o.skills?.some((s) => s.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesCompany && !matchesSkills) return false;
      }

      // Category
      if (selectedCategory !== 'all' && o.category !== selectedCategory) {
        return false;
      }

      // Modality
      if (selectedModality !== 'all' && o.workModality !== selectedModality) {
        return false;
      }

      // Contract
      if (selectedContract !== 'all' && o.contractType !== selectedContract) {
        return false;
      }

      // Min Salary / Budget
      if (minSalaryFilter) {
        const minVal = Number(minSalaryFilter);
        const effectiveVal = o.salaryMin || o.budget || 0;
        if (effectiveVal < minVal) return false;
      }

      return true;
    });
  }, [
    opportunities,
    myOpportunities,
    favorites,
    activeTab,
    searchQuery,
    selectedCategory,
    selectedModality,
    selectedContract,
    minSalaryFilter,
  ]);

  // Unread pending applications counter
  const pendingCount = applicationCounts?.pending || 0;

  const clearFilters = () => {
    setSelectedCategory('all');
    setSelectedModality('all');
    setSelectedContract('all');
    setMinSalaryFilter('');
    setSearchQuery('');
  };

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    selectedModality !== 'all' ||
    selectedContract !== 'all' ||
    minSalaryFilter !== '' ||
    searchQuery !== '';

  // Render subviews for Proposals or Profile
  if (activeTab === 'proposals') {
    return <ProposalsInbox onBack={() => handleTabChange('explore')} />;
  }

  if (activeTab === 'profile') {
    return (
      <div className="flex-1 flex flex-col h-full bg-surface-base overflow-y-auto">
        {/* Profile Nav Bar */}
        <div className="p-4 px-6 border-b border-border-card bg-surface-header flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleTabChange('explore')}
              className="p-1.5 text-txt-tertiary hover:text-txt-primary hover:bg-surface-card rounded-lg transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <h2 className="text-base font-bold text-txt-primary">Meu Perfil Profissional</h2>
          </div>
        </div>
        <div className="flex-1">
          <ProfessionalProfileView />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-base overflow-hidden select-none">
      {/* Top Main Navigation Bar */}
      <div className="p-4 px-6 border-b border-border-card bg-surface-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-txt-primary tracking-tight">Oportunidades</h1>
              <p className="text-xs text-txt-secondary">
                Conecte-se com vagas, freelas, serviços e gerencie propostas com privacidade
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingOpportunity(null);
              setShowCreateModal(true);
            }}
            className="px-4 py-2 rounded-xl bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-all shadow-md shadow-accent-primary/20 flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Publicar Oportunidade</span>
          </button>
        </div>
      </div>

      {/* Tabs navigation row */}
      <div className="px-6 border-b border-border-card bg-surface-header/60 overflow-x-auto no-scrollbar flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 py-1.5">
          {[
            { id: 'explore', label: 'Explorar' },
            { id: 'jobs', label: 'Empregos' },
            { id: 'freelance', label: 'Freelas' },
            { id: 'gigs', label: 'Serviços' },
            { id: 'proposals', label: 'Propostas', badge: pendingCount },
            { id: 'my_listings', label: 'Meus Anúncios' },
            { id: 'saved', label: 'Salvos' },
            { id: 'profile', label: 'Meu Perfil' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 relative whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/30'
                  : 'text-txt-tertiary hover:text-txt-secondary hover:bg-surface-card'
              }`}
            >
              <span>{tab.label}</span>
              {Boolean(tab.badge && tab.badge > 0) && (
                <span className="w-4 h-4 rounded-full bg-accent-primary text-white text-[10px] font-extrabold flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Mobile filter toggle button */}
        <button
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className="md:hidden px-3 py-1.5 rounded-lg border border-border-card text-xs font-semibold text-txt-secondary flex items-center gap-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span>Filtros</span>
        </button>
      </div>

      {/* Main Workspace (Sidebar Filters + Cards Grid) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Left Filter Sidebar */}
        <div
          className={`w-64 border-r border-border-card bg-surface-card/20 p-5 overflow-y-auto space-y-6 flex-shrink-0 ${
            showMobileFilters ? 'block fixed inset-0 z-50 bg-surface-base p-6' : 'hidden md:block'
          }`}
        >
          {showMobileFilters && (
            <div className="flex items-center justify-between pb-3 border-b border-border-card mb-4 md:hidden">
              <span className="text-sm font-bold text-txt-primary">Filtrar Oportunidades</span>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="p-1 text-txt-tertiary hover:text-txt-primary"
              >
                ✕
              </button>
            </div>
          )}

          {/* Search Input */}
          <div>
            <label className="block text-[11px] font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
              Buscar
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ex: React, Designer, CLT..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-surface-base border border-border-card text-txt-primary text-xs focus:outline-none focus:border-accent-primary"
              />
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="absolute left-2.5 top-2.5 text-txt-tertiary"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[11px] font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
              Categoria
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface-base border border-border-card text-txt-primary text-xs focus:outline-none focus:border-accent-primary"
            >
              <option value="all">Todas as categorias</option>
              {OPPORTUNITY_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Modality Filter */}
          <div>
            <label className="block text-[11px] font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
              Modalidade
            </label>
            <div className="space-y-1.5 text-xs">
              {[
                { id: 'all', label: 'Todas as modalidades' },
                { id: 'remote', label: 'Remoto (Home Office)' },
                { id: 'hybrid', label: 'Híbrido' },
                { id: 'onsite', label: 'Presencial' },
              ].map((m) => (
                <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="modality"
                    checked={selectedModality === m.id}
                    onChange={() => setSelectedModality(m.id as any)}
                    className="text-accent-primary focus:ring-accent-primary"
                  />
                  <span className="text-txt-secondary">{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Contract Type (Jobs) */}
          {activeTab !== 'gigs' && (
            <div>
              <label className="block text-[11px] font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
                Contratação
              </label>
              <select
                value={selectedContract}
                onChange={(e) => setSelectedContract(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-surface-base border border-border-card text-txt-primary text-xs focus:outline-none focus:border-accent-primary"
              >
                <option value="all">Todos os regimes</option>
                <option value="clt">CLT</option>
                <option value="pj">PJ</option>
                <option value="internship">Estágio</option>
                <option value="apprentice">Jovem Aprendiz</option>
                <option value="temporary">Temporário</option>
              </select>
            </div>
          )}

          {/* Minimum Salary / Budget */}
          <div>
            <label className="block text-[11px] font-bold text-txt-secondary uppercase tracking-wider mb-1.5">
              Valor Mínimo (R$)
            </label>
            <input
              type="number"
              value={minSalaryFilter}
              onChange={(e) => setMinSalaryFilter(e.target.value)}
              placeholder="Ex: 3000"
              className="w-full px-3 py-2 rounded-xl bg-surface-base border border-border-card text-txt-primary text-xs focus:outline-none focus:border-accent-primary"
            />
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="w-full py-2 rounded-xl border border-border-card bg-surface-card hover:bg-surface-card-hover text-xs font-semibold text-txt-tertiary hover:text-txt-primary transition-colors"
            >
              Limpar Filtros
            </button>
          )}

          {showMobileFilters && (
            <button
              onClick={() => setShowMobileFilters(false)}
              className="w-full py-2.5 rounded-xl bg-accent-primary text-white text-xs font-bold md:hidden"
            >
              Aplicar Filtros
            </button>
          )}
        </div>

        {/* Right Area: Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && opportunities.length === 0 ? (
            <div className="p-12 text-center text-xs text-txt-tertiary">Carregando oportunidades...</div>
          ) : filteredOpportunities.length === 0 ? (
            <div className="p-12 text-center space-y-3 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-surface-card border border-border-card flex items-center justify-center text-txt-tertiary mx-auto shadow-sm">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-txt-primary">Nenhuma oportunidade encontrada</h3>
              <p className="text-xs text-txt-secondary leading-relaxed">
                {hasActiveFilters
                  ? 'Não encontramos anúncios com os filtros selecionados. Tente ajustar ou limpar seus filtros.'
                  : 'Nenhum anúncio publicado nesta seção ainda. Seja o primeiro a anunciar!'}
              </p>
              {hasActiveFilters ? (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 rounded-xl border border-border-card text-xs font-semibold text-accent-primary hover:bg-surface-card"
                >
                  Limpar todos os filtros
                </button>
              ) : (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold shadow-md shadow-accent-primary/20"
                >
                  Publicar Oportunidade
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredOpportunities.map((opp) => {
                const isGig = opp.type === 'gig';
                return isGig ? (
                  <GigCard
                    key={opp.id}
                    opportunity={opp}
                    isFavorite={favoriteIds.has(opp.id)}
                    onToggleFavorite={() => toggleFavorite(opp.id)}
                    onClick={() => {
                      setSelectedOpportunity(opp);
                      setShowDetailModal(true);
                    }}
                  />
                ) : (
                  <OpportunityCard
                    key={opp.id}
                    opportunity={opp}
                    isFavorite={favoriteIds.has(opp.id)}
                    onToggleFavorite={() => toggleFavorite(opp.id)}
                    onClick={() => {
                      setSelectedOpportunity(opp);
                      setShowDetailModal(true);
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <OpportunityDetailModal
        opportunity={selectedOpportunity}
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedOpportunity(null);
        }}
        onApply={(opp) => {
          setApplyingOpportunity(opp);
          setShowApplyModal(true);
        }}
        onEdit={(opp) => {
          setEditingOpportunity(opp);
          setShowCreateModal(true);
        }}
      />

      <CreateOpportunityModal
        isOpen={showCreateModal}
        initialData={editingOpportunity}
        onClose={() => {
          setShowCreateModal(false);
          setEditingOpportunity(null);
        }}
      />

      {applyingOpportunity && (
        <ApplyModal
          opportunity={applyingOpportunity}
          onClose={() => {
            setShowApplyModal(false);
            setApplyingOpportunity(null);
          }}
          onSuccess={() => {
            setShowApplyModal(false);
            setApplyingOpportunity(null);
            handleTabChange('proposals');
          }}
        />
      )}
    </div>
  );
}
