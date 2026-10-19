import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useFormatters } from '../../i18n/formatters';
import type { Product, Seller } from '../../types/store';

export function SellerProfilePage() {
  const { sellerSlug } = useParams<{ sellerSlug: string }>();
  const navigate = useNavigate();

  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sellerSlug) return;
    loadProfile();
  }, [sellerSlug]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.store.getSeller(sellerSlug!);
      setSeller(res.seller);
      setProducts(res.products || []);
    } catch (err: any) {
      setError(err.message || 'Perfil de vendedor não encontrado.');
    } finally {
      setLoading(false);
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
        <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !seller) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-surface-chat p-6 text-center">
        <h2 className="text-lg font-bold text-white mb-2">Vendedor Não Encontrado</h2>
        <p className="text-sm text-txt-secondary mb-6">{error || 'Este vendedor não existe ou foi suspenso.'}</p>
        <button
          onClick={() => navigate('/store')}
          className="px-5 py-2.5 rounded-xl bg-accent-primary text-white text-xs font-bold"
        >
          Voltar para a Loja
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-chat overflow-y-auto no-scrollbar">
      {/* Top Breadcrumb */}
      <div className="px-6 py-4 border-b border-border-hard bg-surface-base flex items-center justify-between">
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
          <span className="text-white font-semibold">{seller.storeName}</span>
        </div>
      </div>

      {/* Main Profile View */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8 w-full flex-1">
        {/* Banner & Bio Card */}
        <div className="rounded-3xl border border-border-hard bg-surface-panel/40 p-6 md:p-8 backdrop-blur-md relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {seller.avatar ? (
              <img src={seller.avatar} alt={seller.storeName} className="w-20 h-20 rounded-2xl object-cover border border-border-hard" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-accent-primary/20 text-accent-primary font-bold text-3xl flex items-center justify-center">
                {seller.storeName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-white tracking-tight">{seller.storeName}</h1>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#3b82f6">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent-primary/20 text-accent-primary border border-accent-primary/30">
                  Criador Oficial
                </span>
              </div>
              <p className="text-sm text-txt-secondary mt-1 max-w-lg leading-relaxed">
                {seller.bio || 'Este criador ainda não adicionou uma biografia.'}
              </p>
              <div className="flex items-center gap-4 text-xs text-txt-tertiary mt-2">
                <span>Produtos ativos: {products.length}</span>
                {seller.createdAt && (
                  <span>Na Nuvio desde {new Date(seller.createdAt).getFullYear()}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Public Products Grid */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">Catálogo do Vendedor ({products.length})</h2>

          {products.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-border-hard rounded-2xl p-8">
              <p className="text-sm text-txt-tertiary">Este vendedor ainda não possui produtos publicados na loja.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => navigate(`/store/product/${prod.slug}`)}
                  className="group rounded-2xl border border-border-hard bg-surface-panel/40 hover:bg-surface-panel hover:border-accent-primary/40 transition-all duration-300 flex flex-col overflow-hidden cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-surface-base border-b border-border-hard">
                    {prod.thumbnail ? (
                      <img src={prod.thumbnail} alt={prod.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-surface-channel text-txt-tertiary">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                        </svg>
                      </div>
                    )}
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-black/70 backdrop-blur-sm text-txt-secondary">
                      {prod.productType}
                    </span>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <h3 className="font-bold text-white text-sm line-clamp-2 group-hover:text-accent-primary transition-colors">
                      {prod.title}
                    </h3>
                    <div className="pt-2 border-t border-border-hard/60 flex items-center justify-between text-xs">
                      <span className="font-extrabold text-white">{formatPrice(prod.price, prod.currency)}</span>
                      <span className="text-txt-tertiary">{prod.rating.toFixed(1)} ★</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
