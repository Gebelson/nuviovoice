import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { OpportunityItem, WorkModality, ContractType } from '@concord/shared';
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
import {
  MarketplaceHero,
  MarketplaceSearchBar,
  MarketplaceCategorySelector,
} from '../marketplace';
import { Mascot } from '../ui/Mascot';

type SortOption = 'recent' | 'salary_high' | 'title';

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
  const [selectedSort, setSelectedSort] = useState<SortOption>('recent');
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

  // Categories mapped to MarketplaceCategorySelector format
  const categoryItems = useMemo(() => {
    const iconEmoji: Record<string, string> = {
      development: '💻',
      design: '🎨',
      audio_music: '🎵',
      video_animation: '🎬',
      writing_translation: '✍️',
      marketing_sales: '📢',
      admin_support: '💼',
      engineering_3d: '📐',
      business_consulting: '📊',
      other: '✨',
    };
    return OPPORTUNITY_CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.id,
      icon: iconEmoji[c.id] || '💼',
    }));
  }, []);

  // Filter & sort opportunities
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

    const filtered = list.filter((o) => {
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

    // Sort
    return filtered.sort((a, b) => {
      if (selectedSort === 'recent') {
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      if (selectedSort === 'salary_high') {
        const valA = a.salaryMax || a.salaryMin || a.budget || 0;
        const valB = b.salaryMax || b.salaryMin || b.budget || 0;
        return valB - valA;
      }
      if (selectedSort === 'title') {
        return a.title.localeCompare(b.title);
      }
      return 0;
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
    selectedSort,
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

  const hasActiveFilters = Boolean(
    selectedCategory !== 'all' ||
    selectedModality !== 'all' ||
    selectedContract !== 'all' ||
    minSalaryFilter !== '' ||
    searchQuery.trim() !== ''
  );

  const activeFiltersCount = [
    selectedCategory !== 'all',
    selectedModality !== 'all',
    selectedContract !== 'all',
    minSalaryFilter !== '',
    searchQuery.trim() !== '',
  ].filter(Boolean).length;

  const isListingTab = ['explore', 'jobs', 'freelance', 'gigs', 'my_listings', 'saved'].includes(activeTab);

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-chat overflow-y-auto no-scrollbar text-txt-primary">
      {/* Unified Hero Header */}
      <MarketplaceHero
        badgeIcon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        }
        badgeText="Mural Profissional & Oportunidades"
        title="Oportunidades"
        description="Conecte-se com vagas profissionais, projetos freelancers e contrate serviços especializados criados pela comunidade Nuvio."
        actions={
          <button
            type="button"
            onClick={() => {
              setEditingOpportunity(null);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold transition-all shadow-lg shadow-accent-primary/20"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Publicar Oportunidade</span>
          </button>
        }
        navTabs={
          <div
            role="tablist"
            aria-label="Seções de Oportunidades"
            className="inline-flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-surface-base/80 border border-border-hard backdrop-blur-md shadow-md max-w-full overflow-x-auto no-scrollbar"
          >
            {[
              {
                id: 'explore',
                label: 'Explorar',
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                  </svg>
                ),
              },
              {
                id: 'jobs',
                label: 'Empregos',
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                ),
              },
              {
                id: 'freelance',
                label: 'Freelas',
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                ),
              },
              {
                id: 'gigs',
                label: 'Serviços',
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  </svg>
                ),
              },
              {
                id: 'proposals',
                label: 'Propostas',
                badge: pendingCount,
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                ),
              },
              {
                id: 'my_listings',
                label: 'Meus Anúncios',
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                ),
              },
              {
                id: 'saved',
                label: 'Salvos',
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                  </svg>
                ),
              },
              {
                id: 'profile',
                label: 'Meu Perfil',
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                ),
              },
            ].map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handleTabChange(tab.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    isSelected
                      ? 'bg-accent-primary text-white shadow-md shadow-accent-primary/25'
                      : 'text-txt-secondary hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {Boolean(tab.badge && tab.badge > 0) && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-accent-primary text-white'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        }
        searchBar={
          isListingTab ? (
            <MarketplaceSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Buscar por cargo, habilidades, projetos, serviços ou contratante..."
              onClear={() => setSearchQuery('')}
            />
          ) : undefined
        }
      />

      {/* Main Content Area */}
      {activeTab === 'proposals' ? (
        <div className="flex-1 overflow-hidden">
          <ProposalsInbox onBack={() => handleTabChange('explore')} />
        </div>
      ) : activeTab === 'profile' ? (
        <div className="flex-1 py-8 px-6">
          <ProfessionalProfileView onBack={() => handleTabChange('explore')} />
        </div>
      ) : (
        /* Listing Views (Explorar, Empregos, Freelas, Serviços, Meus Anúncios, Salvos) */
        <div className="max-w-6xl mx-auto px-6 py-8 w-full space-y-6 flex-1">
          {/* Category Chips Bar */}
          <MarketplaceCategorySelector
            categories={categoryItems}
            selectedCategory={selectedCategory === 'all' ? null : selectedCategory}
            onSelectCategory={(slug) => setSelectedCategory(slug || 'all')}
            allLabel="Todas as Categorias"
          />

          {/* Secondary Filter & Sorting Toolbar */}
          <div className="p-3 bg-surface-panel/80 border border-border-hard rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 backdrop-blur-md">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Modality Filter Pills */}
              <div className="inline-flex items-center gap-1 bg-surface-channel/80 p-1 rounded-xl border border-border-hard">
                {[
                  { id: 'all', label: 'Todas' },
                  { id: 'remote', label: 'Remoto' },
                  { id: 'hybrid', label: 'Híbrido' },
                  { id: 'onsite', label: 'Presencial' },
                ].map((m) => {
                  const isSelected = selectedModality === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedModality(m.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-accent-primary text-white shadow-sm'
                          : 'text-txt-secondary hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>

              {/* Contract Type Dropdown */}
              {activeTab !== 'gigs' && (
                <select
                  value={selectedContract}
                  onChange={(e) => setSelectedContract(e.target.value as any)}
                  className="px-3 py-2 rounded-xl bg-surface-channel border border-border-hard hover:border-border-soft text-txt-secondary hover:text-white text-xs font-semibold focus:outline-none focus:border-accent-primary transition-all"
                >
                  <option value="all">Todos os regimes</option>
                  <option value="clt">CLT</option>
                  <option value="pj">PJ</option>
                  <option value="internship">Estágio</option>
                  <option value="apprentice">Jovem Aprendiz</option>
                  <option value="temporary">Temporário</option>
                </select>
              )}

              {/* Min Salary Input */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-tertiary text-xs font-medium">
                  R$
                </span>
                <input
                  type="number"
                  value={minSalaryFilter}
                  onChange={(e) => setMinSalaryFilter(e.target.value)}
                  placeholder="Valor mín."
                  className="pl-8 pr-3 py-2 w-32 rounded-xl bg-surface-channel border border-border-hard hover:border-border-soft text-white placeholder:text-txt-tertiary text-xs focus:outline-none focus:border-accent-primary transition-all"
                />
              </div>
            </div>

            {/* Right side: Sorting & Count */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-txt-tertiary font-medium hidden sm:inline">
                {filteredOpportunities.length} {filteredOpportunities.length === 1 ? 'oportunidade' : 'oportunidades'}
              </span>

              {/* Sort Select */}
              <select
                value={selectedSort}
                onChange={(e) => setSelectedSort(e.target.value as SortOption)}
                className="px-3 py-2 rounded-xl bg-surface-channel border border-border-hard hover:border-border-soft text-txt-secondary hover:text-white text-xs font-semibold focus:outline-none focus:border-accent-primary transition-all"
              >
                <option value="recent">Mais recentes</option>
                <option value="salary_high">Maior remuneração</option>
                <option value="title">Título (A-Z)</option>
              </select>

              {/* Clear Filters Button */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-3.5 py-1.5 rounded-xl bg-surface-channel hover:bg-surface-elevated border border-border-hard hover:border-accent-primary/40 text-xs font-semibold text-accent-primary transition-colors flex items-center gap-1.5"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  <span>Limpar filtros</span>
                </button>
              )}
            </div>
          </div>

          {/* Cards Grid or Empty States */}
          {isLoading && opportunities.length === 0 ? (
            <div className="p-16 text-center text-xs text-txt-tertiary">
              Carregando oportunidades...
            </div>
          ) : filteredOpportunities.length === 0 ? (
            hasActiveFilters ? (
              /* Empty state due to active filters */
              <div className="py-16 text-center border border-dashed border-border-hard rounded-2xl p-8 space-y-3 max-w-md mx-auto">
                <div className="w-12 h-12 rounded-xl bg-surface-panel flex items-center justify-center text-txt-tertiary mx-auto mb-1">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-white mb-1">Nenhum resultado encontrado</h3>
                <p className="text-xs text-txt-secondary max-w-sm mx-auto leading-relaxed">
                  Não encontramos oportunidades com os filtros selecionados. Tente ajustar os termos ou limpar os filtros.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="px-4 py-2 rounded-xl bg-surface-panel hover:bg-surface-channel border border-border-hard hover:border-accent-primary/40 text-xs font-semibold text-white transition-colors"
                  >
                    Limpar filtros
                  </button>
                </div>
              </div>
            ) : (
              /* Empty state when no opportunities exist: exactly matching Friends empty animation */
              <div className="py-16 flex flex-col items-center justify-center text-center select-none opacity-90 max-w-md mx-auto">
                <Mascot state="idle" className="w-32 h-32 -mb-3" />
                <h3 className="text-base font-bold text-white mt-3">
                  {activeTab === 'saved'
                    ? 'Nenhuma oportunidade salva'
                    : activeTab === 'my_listings'
                    ? 'Nenhum anúncio publicado'
                    : 'Nenhuma oportunidade por enquanto'}
                </h3>
                <p className="text-xs text-txt-secondary mt-1 mb-5 max-w-sm leading-relaxed">
                  {activeTab === 'saved'
                    ? 'Você ainda não salvou nenhuma oportunidade. Clique no ícone de coração nos cards para fixar aqui.'
                    : activeTab === 'my_listings'
                    ? 'Você ainda não publicou nenhuma vaga ou serviço. Crie seu primeiro anúncio agora mesmo.'
                    : 'Seja o primeiro a publicar uma vaga, projeto ou serviço no Nuvio.'}
                </p>
                {activeTab === 'saved' ? (
                  <button
                    type="button"
                    onClick={() => handleTabChange('explore')}
                    className="px-5 py-2.5 rounded-xl bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold transition-all shadow-lg shadow-accent-primary/20"
                  >
                    Explorar Oportunidades
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingOpportunity(null);
                      setShowCreateModal(true);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold transition-all shadow-lg shadow-accent-primary/20 flex items-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>Publicar Oportunidade</span>
                  </button>
                )}
              </div>
            )
          ) : (
            /* Responsive Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
      )}

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
