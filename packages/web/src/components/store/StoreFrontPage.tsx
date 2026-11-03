import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useStoreStore } from '../../stores/storeStore';
import { useAuthStore } from '../../stores/authStore';
import { useFormatters } from '../../i18n/formatters';
import { StoreNavTabs } from './StoreNavTabs';
import {
  MarketplaceHero,
  MarketplaceSearchBar,
  MarketplaceCategorySelector,
  MarketplaceEmptyState,
  MarketplaceErrorState,
  MarketplaceLoadingState,
} from '../marketplace';
import type { Product } from '../../types/store';

export function StoreFrontPage({
  onOpenSellerModal,
  onOpenAdminQueue,
}: {
  onOpenSellerModal: () => void;
  onOpenAdminQueue?: () => void;
}) {
  const { t } = useTranslation(['spaces', 'common']);
  const navigate = useNavigate();

  const categories = useStoreStore((s) => s.categories);
  const products = useStoreStore((s) => s.products);
  const search = useStoreStore((s) => s.search);
  const setSearch = useStoreStore((s) => s.setSearch);
  const selectedCategory = useStoreStore((s) => s.selectedCategory);
  const setSelectedCategory = useStoreStore((s) => s.setSelectedCategory);
  const selectedProductType = useStoreStore((s) => s.selectedProductType);
  const setSelectedProductType = useStoreStore((s) => s.setSelectedProductType);
  const selectedSort = useStoreStore((s) => s.selectedSort);
  const setSelectedSort = useStoreStore((s) => s.setSelectedSort);
  const favorites = useStoreStore((s) => s.favorites);
  const toggleFavorite = useStoreStore((s) => s.toggleFavorite);
  const mySeller = useStoreStore((s) => s.mySeller);
  const loadMySeller = useStoreStore((s) => s.loadMySeller);
  const loadCategories = useStoreStore((s) => s.loadCategories);
  const loadProducts = useStoreStore((s) => s.loadProducts);
  const loadFavorites = useStoreStore((s) => s.loadFavorites);
  const isLoading = useStoreStore((s) => s.isLoading);
  const error = useStoreStore((s) => s.error);

  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = Boolean(currentUser?.isAdmin);

  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');

  useEffect(() => {
    void loadCategories();
    void loadProducts();
    void loadFavorites();
    void loadMySeller();
  }, []);

  const displayedProducts =
    activeTab === 'favorites'
      ? products.filter((p) => favorites.has(p.id))
      : products;

  const hasActiveFilters = Boolean(
    search.trim() ||
    selectedCategory !== null ||
    selectedProductType !== null ||
    activeTab === 'favorites'
  );

  const handleClearFilters = () => {
    setSearch('');
    setSelectedCategory(null);
    setSelectedProductType(null);
    setActiveTab('all');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-chat overflow-y-auto no-scrollbar">
      {/* Store Header & Hero Banner */}
      <MarketplaceHero
        badgeIcon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        }
        badgeText="Marketplace Oficial Nuvio"
        title="Loja de Produtos"
        description="Explore pacotes de arte, templates de servidores, plugins, temas e produtos criados pela comunidade Nuvio com curadoria oficial."
        actions={
          <>
            {isAdmin && (
              <button
                type="button"
                onClick={onOpenAdminQueue}
                className="px-4 py-2.5 rounded-xl bg-surface-panel hover:bg-surface-channel border border-amber-500/30 text-amber-300 text-xs font-bold transition-colors flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Fila de Moderação
              </button>
            )}

            {mySeller ? (
              <button
                type="button"
                onClick={() => navigate('/store/seller')}
                className="px-4 py-2.5 rounded-xl bg-surface-panel hover:bg-surface-channel border border-border-hard text-white text-xs font-bold transition-colors flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                Painel do Vendedor
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenSellerModal}
                className="px-5 py-2.5 rounded-xl bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold transition-transform active:scale-95 shadow-lg shadow-accent-primary/20 flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                Vender na Nuvio
              </button>
            )}
          </>
        }
        navTabs={<StoreNavTabs />}
        searchBar={
          <MarketplaceSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar produtos, templates, pacotes de arte..."
          />
        }
      />

      {/* Main Catalog Container */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6 w-full flex-1 flex flex-col">
        {/* Category Filters Bar */}
        <MarketplaceCategorySelector
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          allLabel="Todas as Categorias"
        />

        {/* Filters & Sorting Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-hard pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                activeTab === 'all' ? 'bg-surface-panel text-white' : 'text-txt-tertiary hover:text-txt-secondary'
              }`}
            >
              Catálogo ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('favorites')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'favorites' ? 'bg-surface-panel text-white' : 'text-txt-tertiary hover:text-txt-secondary'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={activeTab === 'favorites' ? '#f43f5e' : 'none'} stroke={activeTab === 'favorites' ? '#f43f5e' : 'currentColor'} strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              Favoritos ({favorites.size})
            </button>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedProductType || ''}
              onChange={(e) => setSelectedProductType(e.target.value || null)}
              className="bg-surface-panel border border-border-hard rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-accent-primary"
            >
              <option value="">Todos os Tipos</option>
              <option value="digital">Digital</option>
              <option value="service">Serviço</option>
              <option value="physical">Físico</option>
            </select>

            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value as any)}
              className="bg-surface-panel border border-border-hard rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-accent-primary"
            >
              <option value="featured">Em Destaque</option>
              <option value="newest">Mais Recentes</option>
              <option value="rating">Melhor Avaliados</option>
              <option value="price_asc">Menor Preço</option>
              <option value="price_desc">Maior Preço</option>
            </select>
          </div>
        </div>

        {/* Content States */}
        {isLoading ? (
          <MarketplaceLoadingState message="Buscando catálogo da loja..." />
        ) : error ? (
          <MarketplaceErrorState
            title="Falha ao carregar produtos"
            error={error}
            onRetry={() => void loadProducts()}
          />
        ) : displayedProducts.length === 0 ? (
          <MarketplaceEmptyState
            hasFilters={hasActiveFilters}
            emptyMessage="Nada por aqui ainda. Novidades estão chegando!"
            filteredTitle={activeTab === 'favorites' ? 'Nenhum produto favoritado' : 'Nenhum produto encontrado'}
            filteredMessage={
              activeTab === 'favorites'
                ? 'Você ainda não favoritou nenhum produto. Clique no ícone de coração nos produtos para salvar aqui.'
                : 'Não encontramos anúncios com os filtros selecionados. Tente buscar outros termos ou limpar os filtros.'
            }
            onClearFilters={handleClearFilters}
            clearFiltersLabel={activeTab === 'favorites' ? 'Ver catálogo completo' : 'Limpar filtros'}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {displayedProducts.map((prod) => (
              <ProductCard
                key={prod.id}
                product={prod}
                isFavorited={favorites.has(prod.id)}
                onToggleFavorite={() => toggleFavorite(prod.id)}
                onClick={() => navigate(`/store/product/${prod.slug}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductCard({
  product,
  isFavorited,
  onToggleFavorite,
  onClick,
}: {
  product: Product;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onClick: () => void;
}) {
  const { formatCurrency } = useFormatters();

  const formatPrice = (p: number, curr = 'BRL') => {
    if (p === 0) return 'Gratuito';
    return formatCurrency(p, curr);
  };

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col justify-between rounded-2xl bg-surface-panel/80 hover:bg-surface-panel border border-border-hard hover:border-accent-primary/40 transition-all duration-300 shadow-xl overflow-hidden cursor-pointer"
    >
      <div>
        {/* Cover Image or Gradient */}
        <div className="h-44 w-full bg-surface-channel relative overflow-hidden">
          {product.thumbnail ? (
            <img
              src={product.thumbnail}
              alt={product.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-tr from-accent-primary/20 via-surface-panel to-surface-channel flex items-center justify-center text-txt-tertiary">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
          )}

          {/* Badge: Type */}
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-md text-white border border-white/10">
            {product.productType}
          </span>

          {/* Favorite Toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className="absolute top-3 right-3 p-2 rounded-xl bg-black/50 hover:bg-black/80 backdrop-blur-md text-white transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={isFavorited ? '#f43f5e' : 'none'}
              stroke={isFavorited ? '#f43f5e' : 'currentColor'}
              strokeWidth="2"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>

        {/* Content Info */}
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-txt-tertiary">
            <span className="font-semibold text-accent-primary">@{product.seller?.storeName}</span>
            {product.category && (
              <>
                <span>•</span>
                <span>{product.category.name}</span>
              </>
            )}
          </div>

          <h3 className="text-base font-bold text-white group-hover:text-accent-primary transition-colors line-clamp-1">
            {product.title}
          </h3>

          <p className="text-xs text-txt-secondary line-clamp-2 leading-relaxed">
            {product.shortDescription || 'Sem descrição fornecida.'}
          </p>
        </div>
      </div>

      {/* Footer Info & Pricing */}
      <div className="px-4 py-3 bg-surface-base/40 border-t border-border-hard flex items-center justify-between">
        <div className="text-sm font-extrabold text-white">
          {formatPrice(product.price, product.currency)}
        </div>

        <div className="flex items-center gap-1 text-xs text-amber-400 font-bold">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span>{product.rating > 0 ? product.rating.toFixed(1) : 'Novo'}</span>
        </div>
      </div>
    </div>
  );
}
