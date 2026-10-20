import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBotStore } from '../../stores/botStore';
import { useAuthStore } from '../../stores/authStore';
import { resolveUploadUrl } from '../../utils/assetUrls';
import { BotInstallModal } from './BotInstallModal';
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

  const currentUser = useAuthStore((s) => s.user);

  const [installingBot, setInstallingBot] = useState<Bot | null>(null);

  useEffect(() => {
    void loadCategories();
    void loadBots();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-chat overflow-y-auto no-scrollbar text-txt-primary">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-b from-indigo-900/30 via-surface-panel to-surface-chat border-b border-white/10 px-6 py-10 md:py-14">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-primary/20 text-accent-primary border border-accent-primary/30 text-xs font-bold uppercase tracking-wider mb-3">
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
                Biblioteca de Bots & Aplicações
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
                Descubra Bots para seu Espaço
              </h1>
              <p className="text-sm md:text-base text-txt-secondary mt-1 max-w-xl">
                Automatize tarefas, modere comunidades, gerencie músicas e integre
                ferramentas poderosas com a biblioteca oficial do Nuvio.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/developers')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 text-white text-sm font-semibold transition-all shadow-md backdrop-blur-md"
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
            </div>
          </div>

          {/* Main Store Switcher: Produtos | Bots */}
          <div className="inline-flex p-1 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
            <button
              type="button"
              onClick={() => navigate('/store')}
              className="px-5 py-2 rounded-xl text-xs font-bold transition-all text-txt-secondary hover:text-white hover:bg-white/5 flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              Produtos & Serviços
            </button>
            <button
              type="button"
              className="px-5 py-2 rounded-xl text-xs font-bold transition-all bg-accent-primary text-white shadow-md flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M9 3v18M3 9h18" />
              </svg>
              Biblioteca de Bots
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-2xl">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquise bots por nome, comandos (ex: /limpar), ou tags (ex: moderação, xp)..."
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-surface-panel/80 border border-white/10 text-white placeholder:text-txt-muted text-sm shadow-xl focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 backdrop-blur-xl transition-all"
            />
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-txt-muted pointer-events-none"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-txt-muted hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto w-full px-6 py-8 space-y-6 flex-1">
        {/* Category Pills Slider */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
              selectedCategory === null
                ? 'bg-accent-primary text-white border-accent-primary shadow-md'
                : 'bg-white/[0.04] text-txt-secondary border-white/5 hover:bg-white/[0.08] hover:text-white'
            }`}
          >
            Todos os Bots
          </button>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.slug;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(isSelected ? null : cat.slug)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-accent-primary text-white border-accent-primary shadow-md'
                    : 'bg-white/[0.04] text-txt-secondary border-white/5 hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* Sort and Filters Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/5">
            <button
              type="button"
              onClick={() => setSelectedSort('featured')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedSort === 'featured'
                  ? 'bg-accent-primary text-white shadow-sm'
                  : 'text-txt-muted hover:text-white'
              }`}
            >
              Destaques
            </button>
            <button
              type="button"
              onClick={() => setSelectedSort('popular')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedSort === 'popular'
                  ? 'bg-accent-primary text-white shadow-sm'
                  : 'text-txt-muted hover:text-white'
              }`}
            >
              Mais Utilizados
            </button>
            <button
              type="button"
              onClick={() => setSelectedSort('top_rated')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedSort === 'top_rated'
                  ? 'bg-accent-primary text-white shadow-sm'
                  : 'text-txt-muted hover:text-white'
              }`}
            >
              Mais Bem Avaliados
            </button>
            <button
              type="button"
              onClick={() => setSelectedSort('newest')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedSort === 'newest'
                  ? 'bg-accent-primary text-white shadow-sm'
                  : 'text-txt-muted hover:text-white'
              }`}
            >
              Novidades
            </button>
          </div>

          <div className="text-xs text-txt-muted">
            {total} {total === 1 ? 'bot disponível' : 'bots disponíveis'}
          </div>
        </div>

        {/* Bots Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-64 rounded-2xl bg-surface-panel/40 border border-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : bots.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.01] space-y-3">
            <div className="text-4xl">🤖</div>
            <h3 className="text-lg font-bold text-white">
              Nenhum bot encontrado
            </h3>
            <p className="text-sm text-txt-muted max-w-sm mx-auto">
              Tente buscar por outros termos ou explore outras categorias.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {bots.map((bot) => (
              <div
                key={bot.id}
                className="group relative rounded-2xl bg-surface-panel/80 hover:bg-surface-panel border border-white/10 hover:border-white/20 transition-all duration-300 shadow-xl overflow-hidden flex flex-col backdrop-blur-xl"
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
                      <span className="px-2 py-0.5 rounded-full bg-accent-primary/90 text-white font-bold text-[10px] tracking-wide uppercase shadow-sm">
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
                      <p className="text-xs text-txt-muted line-clamp-2 mt-1">
                        {bot.tagline || bot.description || 'Nenhuma descrição informada.'}
                      </p>
                    </div>

                    {/* Tags */}
                    {bot.tags && bot.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {bot.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-white/[0.04] text-[10px] text-txt-muted font-medium"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex items-center gap-2 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => navigate(`/store/bots/${bot.slug}`)}
                      className="flex-1 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-txt-primary text-xs font-semibold transition-colors text-center"
                    >
                      Ver Detalhes
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstallingBot(bot)}
                      className="px-4 py-2 rounded-xl bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-semibold transition-colors shadow-md flex items-center gap-1.5"
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
