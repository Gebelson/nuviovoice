import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useStoreStore } from '../../stores/storeStore';
import { useAuthStore } from '../../stores/authStore';
import { useFormatters } from '../../i18n/formatters';
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

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-chat overflow-y-auto no-scrollbar">
      {/* Store Header & Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-b from-accent-primary/20 via-surface-panel to-surface-chat border-b border-border-hard px-6 py-10 md:py-14">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-primary/20 text-accent-primary border border-accent-primary/30 text-xs font-bold uppercase tracking-wider mb-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                  <path d="M3 6h18" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
                Marketplace Oficial Nuvio
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
                Loja Integrada
              </h1>
              <p className="text-sm md:text-base text-txt-secondary mt-1 max-w-xl">
                Explore bots, serviços de design, modelos de servidores, e-books e produtos criados pela comunidade Nuvio com curadoria oficial.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3 flex-wrap">
              {isAdmin && (
                <button
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
            </div>
          </div>

          {/* Main Store Switcher: Produtos | Bots */}
          <div className="inline-flex p-1 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
            <button
              type="button"
              className="px-5 py-2 rounded-xl text-xs font-bold transition-all bg-accent-primary text-white shadow-md flex items-center gap-2"
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
              onClick={() => navigate('/store/bots')}
              className="px-5 py-2 rounded-xl text-xs font-bold transition-all text-txt-secondary hover:text-white hover:bg-white/5 flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M9 3v18M3 9h18" />
              </svg>
              Biblioteca de Bots
            </button>
          </div>

          {/* Search Box */}
          <div className="relative max-w-2xl">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar bots, pacotes de arte, templates de canais..."
              className="w-full bg-surface-channel/90 border border-border-hard rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white placeholder-txt-tertiary focus:outline-none focus:border-accent-primary shadow-xl"
            />
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-txt-tertiary"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-txt-tertiary hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Catalog Container */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8 w-full flex-1">
        {/* Category Filters Bar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors border ${
              selectedCategory === null
                ? 'bg-accent-primary text-white border-accent-primary shadow-md shadow-accent-primary/20'
                : 'bg-surface-panel/60 text-txt-secondary border-border-hard hover:bg-surface-panel hover:text-white'
            }`}
          >
            Todas as Categorias
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.slug)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors border ${
                selectedCategory === cat.slug
                  ? 'bg-accent-primary text-white border-accent-primary shadow-md shadow-accent-primary/20'
                  : 'bg-surface-panel/60 text-txt-secondary border-border-hard hover:bg-surface-panel hover:text-white'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Filters & Sorting Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-hard pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                activeTab === 'all' ? 'bg-surface-panel text-white' : 'text-txt-tertiary hover:text-txt-secondary'
              }`}
            >
              Catálogo ({products.length})
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
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
              className="bg-surface-panel border border-border-hard rounded-lg px-3 py-1.5 text-xs text-white outline-none"
            >
              <option value="">Todos os Tipos</option>
              <option value="digital">Digital</option>
              <option value="service">Serviço</option>
              <option value="physical">Físico</option>
            </select>

            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value as any)}
              className="bg-surface-panel border border-border-hard rounded-lg px-3 py-1.5 text-xs text-white outline-none"
            >
              <option value="featured">Em Destaque</option>
              <option value="newest">Mais Recentes</option>
              <option value="rating">Melhor Avaliados</option>
              <option value="price_asc">Menor Preço</option>
              <option value="price_desc">Maior Preço</option>
            </select>
          </div>
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-txt-tertiary">Buscando catálogo da loja...</p>
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-border-hard rounded-2xl p-8">
            <div className="w-12 h-12 rounded-xl bg-surface-panel flex items-center justify-center text-txt-tertiary mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-white mb-1">Nenhum produto encontrado</h3>
            <p className="text-xs text-txt-secondary max-w-sm mx-auto">
              {activeTab === 'favorites'
                ? 'Você ainda não favoritou nenhum produto. Clique no ícone de coração nos produtos para salvar aqui.'
                : 'Não encontramos anúncios com os filtros selecionados. Tente buscar outros termos ou limpar a categoria.'}
            </p>
          </div>
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
      className="group rounded-2xl border border-border-hard bg-surface-panel/40 hover:bg-surface-panel hover:border-accent-primary/40 transition-all duration-300 flex flex-col overflow-hidden cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1"
    >
      {/* Thumbnail */}
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-base border-b border-border-hard">
        {product.thumbnail ? (
          <img
            src={product.thumbnail}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent-primary/10 to-surface-channel">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-tertiary">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
        )}

        {/* Favorite button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:scale-110 transition-transform"
          title={isFavorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill={isFavorited ? '#f43f5e' : 'none'}
            stroke={isFavorited ? '#f43f5e' : 'white'}
            strokeWidth="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {/* Tag badge */}
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-black/70 backdrop-blur-sm text-txt-secondary border border-white/10">
            {product.productType === 'digital' ? 'Digital' : product.productType === 'service' ? 'Serviço' : 'Físico'}
          </span>
          {product.category && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-accent-primary/80 backdrop-blur-sm text-white">
              {product.category.name}
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* Seller line */}
          {product.seller && (
            <div className="flex items-center gap-2 mb-1.5">
              {product.seller.avatar ? (
                <img src={product.seller.avatar} alt={product.seller.storeName} className="w-4 h-4 rounded-full object-cover" />
              ) : (
                <div className="w-4 h-4 rounded-full bg-accent-primary/20 text-accent-primary text-[9px] font-bold flex items-center justify-center">
                  {product.seller.storeName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-[11px] font-medium text-txt-tertiary truncate">
                {product.seller.storeName}
              </span>
            </div>
          )}

          <h3 className="font-bold text-white text-sm tracking-tight leading-snug line-clamp-2 group-hover:text-accent-primary transition-colors">
            {product.title}
          </h3>

          {product.shortDescription && (
            <p className="text-xs text-txt-secondary line-clamp-2 mt-1 leading-relaxed">
              {product.shortDescription}
            </p>
          )}
        </div>

        {/* Footer: Price & Rating */}
        <div className="pt-2 border-t border-border-hard/60 flex items-center justify-between">
          <div className="text-sm font-extrabold text-white">
            {formatPrice(product.price, product.currency)}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-txt-secondary font-medium">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#eab308" stroke="#eab308" strokeWidth="1">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span>{product.rating.toFixed(1)}</span>
            {product.salesCount > 0 && (
              <span className="text-txt-tertiary">({product.salesCount})</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
