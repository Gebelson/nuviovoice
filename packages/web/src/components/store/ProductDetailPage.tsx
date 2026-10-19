import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { Product } from '../../types/store';
import { useFormatters } from '../../i18n/formatters';
import { VisualBlockRenderer } from './VisualBlockRenderer';
import { useStoreStore } from '../../stores/storeStore';
import { useAuthStore } from '../../stores/authStore';

export function ProductDetailPage({
  onReportProduct,
}: {
  onReportProduct: (product: Product) => void;
}) {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation(['spaces', 'common']);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const favorites = useStoreStore((s) => s.favorites);
  const toggleFavorite = useStoreStore((s) => s.toggleFavorite);
  const currentUser = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!slug) return;
    loadProduct();
  }, [slug]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.store.getProduct(slug!);
      setProduct(res.product);
    } catch (err: any) {
      setError(err.message || 'Produto não encontrado ou indisponível.');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleBuy = () => {
    if (!product) return;
    if (product.seller?.contactEmail) {
      window.location.href = `mailto:${product.seller.contactEmail}?subject=Interesse%20no%20produto%20${encodeURIComponent(product.title)}`;
    } else {
      alert(`Para adquirir "${product.title}", entre em contato com o vendedor @${product.seller?.storeName} no Nuvio!`);
    }
  };

  const { formatCurrency } = useFormatters();

  const formatPrice = (p: number, curr = 'BRL') => {
    if (p === 0) return 'Gratuito';
    return formatCurrency(p, curr);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-chat">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-txt-tertiary">Carregando detalhes do produto...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-surface-chat p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-panel flex items-center justify-center text-txt-tertiary mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Produto Indisponível</h2>
        <p className="text-sm text-txt-secondary max-w-md mb-6">{error || 'Este produto não existe ou foi suspenso.'}</p>
        <button
          onClick={() => navigate('/store')}
          className="px-5 py-2.5 rounded-xl bg-accent-primary text-white text-xs font-bold hover:bg-accent-primary/90 transition-colors"
        >
          Voltar para a Loja
        </button>
      </div>
    );
  }

  const isFavorited = favorites.has(product.id);
  const isOwner = currentUser?.id === (product.seller as any)?.userId;

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-chat overflow-y-auto no-scrollbar">
      {/* Top Breadcrumb Navigation */}
      <div className="px-6 py-4 border-b border-border-hard bg-surface-base/60 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => navigate('/store')}
            className="text-txt-tertiary hover:text-white transition-colors flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Loja
          </button>
          <span className="text-txt-tertiary">/</span>
          {product.category && (
            <>
              <span className="text-txt-tertiary">{product.category.name}</span>
              <span className="text-txt-tertiary">/</span>
            </>
          )}
          <span className="text-white font-semibold truncate max-w-xs">{product.title}</span>
        </div>

        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              onClick={() => navigate(`/store/editor/${product.id}`)}
              className="px-3 py-1.5 rounded-lg bg-surface-panel hover:bg-surface-channel border border-border-hard text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Editar Página
            </button>
          )}
          <button
            onClick={handleShare}
            className="px-3 py-1.5 rounded-lg bg-surface-panel hover:bg-surface-channel border border-border-hard text-txt-secondary hover:text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            {copiedLink ? 'Link Copiado!' : 'Compartilhar'}
          </button>
        </div>
      </div>

      {/* Main Content: Commercial Authoritative Box + Visual Blocks Layout */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-10 w-full">
        {/* AUTHORITATIVE COMMERCIAL HEADER CARD */}
        <div className="rounded-3xl border border-border-hard bg-surface-panel/50 p-6 md:p-8 backdrop-blur-md shadow-2xl flex flex-col md:flex-row gap-8 items-start">
          {/* Main Cover Image */}
          <div className="w-full md:w-80 aspect-video md:aspect-square rounded-2xl overflow-hidden border border-border-hard bg-surface-base flex-shrink-0 relative">
            {product.thumbnail ? (
              <img src={product.thumbnail} alt={product.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent-primary/20 to-surface-channel">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-tertiary">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                  <path d="M3 6h18" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
              </div>
            )}
            <div className="absolute top-3 left-3 flex items-center gap-1.5">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-black/70 backdrop-blur-sm text-white border border-white/10">
                {product.productType === 'digital' ? 'Digital' : product.productType === 'service' ? 'Serviço' : 'Físico'}
              </span>
            </div>
          </div>

          {/* Details & Commercial Actions */}
          <div className="flex-1 flex flex-col justify-between space-y-6 w-full">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                {product.category && (
                  <span className="text-xs font-bold uppercase tracking-wider text-accent-primary">
                    {product.category.name}
                  </span>
                )}
                <div className="flex items-center gap-1 text-xs text-txt-secondary font-medium">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#eab308" stroke="#eab308" strokeWidth="1">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span className="font-bold text-white">{product.rating.toFixed(1)}</span>
                  <span className="text-txt-tertiary">({product.ratingCount || 1} avaliações)</span>
                </div>
              </div>

              <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
                {product.title}
              </h1>

              {product.shortDescription && (
                <p className="text-sm md:text-base text-txt-secondary leading-relaxed">
                  {product.shortDescription}
                </p>
              )}

              {/* Seller Pill & Link */}
              {product.seller && (
                <div
                  onClick={() => navigate(`/store/seller/${product.seller?.slug}`)}
                  className="inline-flex items-center gap-3 p-2 pr-4 rounded-xl bg-surface-panel border border-border-hard hover:border-accent-primary/50 transition-colors cursor-pointer group"
                >
                  {product.seller.avatar ? (
                    <img src={product.seller.avatar} alt={product.seller.storeName} className="w-8 h-8 rounded-lg object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-accent-primary/20 text-accent-primary font-bold text-sm flex items-center justify-center">
                      {product.seller.storeName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white group-hover:text-accent-primary transition-colors">
                        {product.seller.storeName}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#3b82f6" className="flex-shrink-0">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    </div>
                    <span className="text-[10px] text-txt-tertiary">Vendedor Verificado Nuvio</span>
                  </div>
                </div>
              )}
            </div>

            {/* Commercial Action Bar */}
            <div className="pt-6 border-t border-border-hard flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs text-txt-tertiary block font-medium">Preço Oficial</span>
                <div className="text-2xl md:text-3xl font-extrabold text-white">
                  {formatPrice(product.price, product.currency)}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleFavorite(product.id)}
                  className={`p-3 rounded-xl border transition-colors ${
                    isFavorited
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      : 'bg-surface-panel border-border-hard text-txt-secondary hover:text-white hover:bg-surface-channel'
                  }`}
                  title={isFavorited ? 'Remover dos favoritos' : 'Favoritar produto'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={isFavorited ? '#f43f5e' : 'none'} stroke={isFavorited ? '#f43f5e' : 'currentColor'} strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>

                <button
                  onClick={handleBuy}
                  className="flex-1 sm:flex-initial px-8 py-3.5 rounded-xl bg-accent-primary hover:bg-accent-primary/90 text-white font-extrabold text-sm transition-transform active:scale-95 shadow-xl shadow-accent-primary/25"
                >
                  {product.price === 0 ? 'Adquirir Gratuitamente' : 'Comprar / Adquirir'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CUSTOM VISUAL CONTENT RENDERER */}
        {product.layoutData && product.layoutData.length > 0 ? (
          <div className="py-4">
            <VisualBlockRenderer blocks={product.layoutData} onCtaClick={handleBuy} />
          </div>
        ) : null}

        {/* Bottom Utility Footer: Report product */}
        <div className="pt-8 border-t border-border-hard flex items-center justify-between text-xs text-txt-tertiary">
          <span>ID do Anúncio: {product.id}</span>
          <button
            onClick={() => onReportProduct(product)}
            className="hover:text-red-400 transition-colors flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
            Denunciar este produto
          </button>
        </div>
      </div>
    </div>
  );
}
