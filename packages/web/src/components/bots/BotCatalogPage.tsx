import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBotStore } from '../../stores/botStore';
import { useAuthStore } from '../../stores/authStore';
import { resolveUploadUrl } from '../../utils/assetUrls';
import { BotInstallModal } from './BotInstallModal';
import { StoreNavTabs } from '../store/StoreNavTabs';
import {
  MarketplaceHero,
  MarketplaceSearchBar,
  MarketplaceCategorySelector,
  MarketplaceSegmentedControl,
  MarketplaceEmptyState,
  MarketplaceErrorState,
  MarketplaceLoadingState,
} from '../marketplace';
import type { Bot } from '@concord/shared';

export function BotCatalogPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSpaceId = searchParams.get('spaceId');

  const categories = useBotStore((s) => s.categories);
  const bots = useBotStore((s) => s.bots);
  const total = useBotStore((s) => s.total);
  const search = useBotStore((s) => s.search);
  const setSearch = useBotStore((s) => s.setSearch);
  const selectedCategory = useBotStore((s) => s.selectedCategory);
  const setSelectedCategory = useBotStore((s) => s.setSelectedCategory);
  const selectedSort = useBotStore((s) => s.selectedSort);
  const setSelectedSort = useBotStore((s) => s.setSelectedSort);
  const loadCategories = useBotStore((s) => s.loadCategories);
  const loadBots = useBotStore((s) => s.loadBots);
  const isLoading = useBotStore((s) => s.isLoading);
  const error = useBotStore((s) => s.error);

  const currentUser = useAuthStore((s) => s.user);

  const [installingBot, setInstallingBot] = useState<Bot | null>(null);

  useEffect(() => {
    void loadCategories();
    void loadBots();
  }, []);

  const hasActiveFilters = Boolean(search.trim() || selectedCategory);

  const handleClearFilters = () => {
    setSearch('');
    setSelectedCategory(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-chat overflow-y-auto no-scrollbar text-txt-primary">
      {/* Hero Banner */}
      <MarketplaceHero
        badgeIcon={
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 3v18M3 9h18" />
          </svg>
        }
        badgeText="Biblioteca de Bots & Aplicações"
        title="Biblioteca de Bots"
        description="Automatize tarefas, modere comunidades, gerencie músicas e integre ferramentas poderosas com a biblioteca oficial do Nuvio."
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate('/developers')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold transition-all shadow-lg shadow-accent-primary/20"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              Publicar meu bot
            </button>
            <button
              type="button"
              onClick={() => navigate('/developers')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-panel hover:bg-surface-channel border border-border-hard text-white text-xs font-bold transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m18 16 4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16" />
              </svg>
              Portal do Desenvolvedor
            </button>
          </>
        }
        navTabs={<StoreNavTabs />}
        searchBar={
          <MarketplaceSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Pesquise bots por nome, comandos (ex: /limpar), ou tags (ex: moderação, xp)..."
          />
        }
      />

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto w-full px-6 py-8 space-y-6 flex-1 flex flex-col">
        {/* Category Pills Slider */}
        <MarketplaceCategorySelector
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          allLabel="Todos os Bots"
        />

        {/* Sort and Filters Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-hard pb-4">
          <MarketplaceSegmentedControl
            options={[
              { id: 'featured', label: 'Destaques' },
              { id: 'popular', label: 'Mais Utilizados' },
              { id: 'top_rated', label: 'Mais Bem Avaliados' },
              { id: 'newest', label: 'Novidades' },
            ]}
            selectedId={selectedSort}
            onSelect={(id) => setSelectedSort(id as any)}
          />

          <div className="text-xs text-txt-muted font-medium">
            {total} {total === 1 ? 'bot disponível' : 'bots disponíveis'}
          </div>
        </div>

        {/* Content States */}
        {isLoading ? (
          <MarketplaceLoadingState message="Buscando biblioteca de bots..." />
        ) : error ? (
          <MarketplaceErrorState
            title="Falha ao carregar bots"
            error={error}
            onRetry={() => void loadBots()}
          />
        ) : bots.length === 0 ? (
          <MarketplaceEmptyState
            hasFilters={hasActiveFilters}
            emptyMessage="Nada por aqui ainda. Novidades estão chegando!"
            filteredTitle="Nenhum bot encontrado"
            filteredMessage="Não encontramos bots para os filtros ou busca aplicados. Tente buscar outros termos ou explorar outras categorias."
            onClearFilters={handleClearFilters}
            clearFiltersLabel="Limpar filtros"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bots.map((bot) => (
              <div
                key={bot.id}
                className="group relative rounded-2xl bg-surface-panel/80 hover:bg-surface-panel border border-border-hard hover:border-accent-primary/40 transition-all duration-300 shadow-xl overflow-hidden flex flex-col backdrop-blur-xl"
              >
                {/* Banner or Gradient Header */}
                <div className="h-24 w-full bg-gradient-to-r from-accent-primary/25 via-indigo-600/20 to-purple-800/30 relative overflow-hidden">
                  {bot.banner && (
                    <img
                      src={resolveUploadUrl(bot.banner) ?? undefined}
                      alt={bot.name}
                      className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500"
                    />
                  )}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    {bot.isOfficial && (
                      <span className="px-2.5 py-0.5 rounded-full bg-accent-primary/90 text-white font-bold text-[10px] tracking-wide uppercase shadow-sm">
                        Oficial
                      </span>
                    )}
                  </div>
                </div>

                {/* Bot Profile Details */}
                <div className="p-5 pt-0 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    {/* Avatar overlap */}
                    <div className="flex items-end justify-between -mt-9">
                      <div className="relative w-16 h-16 rounded-2xl bg-surface-chat border-2 border-surface-panel overflow-hidden shadow-lg flex items-center justify-center">
                        {bot.avatar ? (
                          <img
                            src={resolveUploadUrl(bot.avatar) ?? undefined}
                            alt={bot.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-2xl">🤖</span>
                        )}
                      </div>

                      {/* Rating and Installs */}
                      <div className="flex items-center gap-3 text-xs text-txt-muted">
                        <div className="flex items-center gap-1 text-amber-400 font-semibold">
                          <span>★</span>
                          <span>{bot.ratingAverage?.toFixed(1) || '5.0'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                          <span>{bot.installCount}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bot Name and Tagline */}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3
                          onClick={() => navigate(`/store/bots/${bot.slug}`)}
                          className="font-bold text-base text-white hover:text-accent-primary transition-colors cursor-pointer"
                        >
                          {bot.name}
                        </h3>
                        {bot.isVerified && (
                          <span
                            className="text-accent-primary"
                            title="Bot Verificado"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-txt-secondary line-clamp-2 mt-1 leading-relaxed">
                        {bot.tagline || bot.description || 'Nenhuma descrição informada.'}
                      </p>
                    </div>

                    {/* Tags */}
                    {bot.tags && bot.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {bot.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-surface-base text-[10px] text-txt-secondary font-medium border border-border-hard"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3 flex items-center gap-2 border-t border-border-hard">
                    <button
                      type="button"
                      onClick={() => navigate(`/store/bots/${bot.slug}`)}
                      className="flex-1 py-2 rounded-xl bg-surface-base hover:bg-surface-channel border border-border-hard hover:border-accent-primary/30 text-white text-xs font-semibold transition-colors text-center"
                    >
                      Ver Detalhes
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstallingBot(bot)}
                      className="px-4 py-2 rounded-xl bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold transition-transform active:scale-95 shadow-md shadow-accent-primary/20 flex items-center gap-1.5"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M5 12h14M12 5v14" />
                      </svg>
                      Adicionar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Install Modal */}
      {installingBot && (
        <BotInstallModal
          bot={installingBot}
          initialSpaceId={initialSpaceId}
          onClose={() => setInstallingBot(null)}
        />
      )}
    </div>
  );
}
