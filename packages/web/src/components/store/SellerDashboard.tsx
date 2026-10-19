import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useStoreStore } from '../../stores/storeStore';
import { useFormatters } from '../../i18n/formatters';
import { api } from '../../api/client';
import type { Product } from '../../types/store';

export function SellerDashboard() {
  const { t } = useTranslation(['spaces', 'common']);
  const navigate = useNavigate();

  const mySeller = useStoreStore((s) => s.mySeller);
  const loadMySeller = useStoreStore((s) => s.loadMySeller);
  const sellerProducts = useStoreStore((s) => s.sellerProducts);
  const loadSellerProducts = useStoreStore((s) => s.loadSellerProducts);
  const categories = useStoreStore((s) => s.categories);
  const loadCategories = useStoreStore((s) => s.loadCategories);
  const createProduct = useStoreStore((s) => s.createProduct);
  const updateSeller = useStoreStore((s) => s.updateSeller);

  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // New product form
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newPrice, setNewPrice] = useState('0');
  const [newCurrency, setNewCurrency] = useState('BRL');
  const [newType, setNewType] = useState<'digital' | 'service' | 'physical'>('digital');
  const [newDesc, setNewDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Profile form
  const [storeName, setStoreName] = useState('');
  const [bio, setBio] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [avatar, setAvatar] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  useEffect(() => {
    void init();
  }, []);

  const init = async () => {
    setLoading(true);
    await loadCategories();
    const seller = await loadMySeller();
    if (seller) {
      setStoreName(seller.storeName || '');
      setBio(seller.bio || '');
      setContactEmail(seller.contactEmail || '');
      setAvatar(seller.avatar || '');
      await loadSellerProducts();
    }
    setLoading(false);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setIsCreating(true);
      const prod = await createProduct({
        title: newTitle.trim(),
        categoryId: newCategory || null,
        price: parseFloat(newPrice) || 0,
        currency: newCurrency,
        productType: newType,
        shortDescription: newDesc.trim(),
      });
      setCreateModalOpen(false);
      setNewTitle('');
      setNewDesc('');
      setNewPrice('0');
      // Navigate to visual editor
      navigate(`/store/editor/${prod.id}`);
    } catch (err: any) {
      alert(err.message || 'Erro ao criar produto');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsUpdatingProfile(true);
      await updateSeller({
        storeName: storeName.trim(),
        bio: bio.trim(),
        contactEmail: contactEmail.trim() || null,
        avatar: avatar.trim() || null,
      });
      setProfileModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar perfil de vendedor');
    } finally {
      setIsUpdatingProfile(false);
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

  if (!mySeller) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-surface-chat p-6 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Você ainda não é um vendedor</h2>
        <p className="text-sm text-txt-secondary mb-6 max-w-sm">
          Crie seu perfil de vendedor para começar a publicar produtos na Loja Nuvio.
        </p>
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
          <span className="text-white font-semibold">Painel do Vendedor</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/store/seller/${mySeller.slug}`)}
            className="px-3 py-1.5 rounded-lg bg-surface-panel hover:bg-surface-channel border border-border-hard text-txt-secondary hover:text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            Ver Perfil Público
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-1.5 rounded-lg bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold transition-transform active:scale-95 shadow-md shadow-accent-primary/20 flex items-center gap-1.5"
          >
            + Novo Produto
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8 w-full flex-1">
        {/* Seller Profile Summary Card */}
        <div className="rounded-2xl border border-border-hard bg-surface-panel/40 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {mySeller.avatar ? (
              <img src={mySeller.avatar} alt={mySeller.storeName} className="w-16 h-16 rounded-2xl object-cover border border-border-hard" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-accent-primary/20 text-accent-primary font-bold text-2xl flex items-center justify-center">
                {mySeller.storeName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">{mySeller.storeName}</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {mySeller.status === 'approved' ? 'Ativo' : mySeller.status}
                </span>
              </div>
              <p className="text-xs text-txt-secondary mt-1 max-w-md">
                {mySeller.bio || 'Adicione uma biografia descrevendo seus produtos e serviços.'}
              </p>
              {mySeller.contactEmail && (
                <p className="text-[11px] text-txt-tertiary mt-1">Contato: {mySeller.contactEmail}</p>
              )}
            </div>
          </div>

          <button
            onClick={() => setProfileModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-surface-panel hover:bg-surface-channel border border-border-hard text-white text-xs font-semibold transition-colors"
          >
            Editar Perfil
          </button>
        </div>

        {/* Products Management List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Meus Produtos ({sellerProducts.length})</h2>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="text-xs text-accent-primary hover:underline font-semibold"
            >
              + Criar novo anúncio
            </button>
          </div>

          {sellerProducts.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-border-hard rounded-2xl p-8">
              <h3 className="text-base font-bold text-white mb-1">Você não possui nenhum produto</h3>
              <p className="text-xs text-txt-secondary mb-4">
                Crie seu primeiro produto e personalize a página com nosso editor visual profissional.
              </p>
              <button
                onClick={() => setCreateModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-accent-primary text-white text-xs font-bold hover:bg-accent-primary/90 transition-colors"
              >
                Criar Primeiro Produto
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {sellerProducts.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-border-hard bg-surface-panel/40 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-border-soft transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-14 h-14 rounded-lg bg-surface-base border border-border-hard overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {p.thumbnail ? (
                        <img src={p.thumbnail} alt={p.title} className="w-full h-full object-cover" />
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-tertiary">
                          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-sm truncate">{p.title}</h3>
                        <StatusPill status={p.status} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-txt-tertiary mt-1">
                        <span className="font-semibold text-white">{formatPrice(p.price, p.currency)}</span>
                        <span>•</span>
                        <span className="capitalize">{p.productType}</span>
                        {p.category && (
                          <>
                            <span>•</span>
                            <span>{p.category.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
                    {p.status === 'published' && (
                      <button
                        onClick={() => navigate(`/store/product/${p.slug}`)}
                        className="px-3 py-1.5 rounded-lg bg-surface-panel hover:bg-surface-channel border border-border-hard text-txt-secondary hover:text-white text-xs font-semibold transition-colors"
                      >
                        Ver Página
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/store/editor/${p.id}`)}
                      className="px-4 py-1.5 rounded-lg bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold transition-transform active:scale-95 shadow-sm shadow-accent-primary/20 flex items-center gap-1.5"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Editor Visual
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CREATE PRODUCT MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-border-hard rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Criar Novo Anúncio</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-txt-tertiary hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              <div>
                <label className="text-txt-tertiary block mb-1 font-medium">Nome do Produto *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Bot Nuvio Music Pro"
                  className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none focus:border-accent-primary"
                />
              </div>

              <div>
                <label className="text-txt-tertiary block mb-1 font-medium">Categoria</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none focus:border-accent-primary"
                >
                  <option value="">Selecione uma categoria...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-txt-tertiary block mb-1 font-medium">Preço</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none focus:border-accent-primary"
                  />
                </div>
                <div>
                  <label className="text-txt-tertiary block mb-1 font-medium">Tipo</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none focus:border-accent-primary"
                  >
                    <option value="digital">Digital</option>
                    <option value="service">Serviço</option>
                    <option value="physical">Físico</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-txt-tertiary block mb-1 font-medium">Resumo do Produto</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={3}
                  placeholder="Breve descrição comercial..."
                  className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none focus:border-accent-primary resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-surface-channel hover:bg-surface-base text-txt-secondary text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 rounded-lg bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold disabled:opacity-50"
                >
                  {isCreating ? 'Criando...' : 'Criar & Abrir Editor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PROFILE MODAL */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-border-hard rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Editar Perfil de Vendedor</h3>
              <button onClick={() => setProfileModalOpen(false)} className="text-txt-tertiary hover:text-white">✕</button>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
              <div>
                <label className="text-txt-tertiary block mb-1 font-medium">Nome da Loja *</label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none focus:border-accent-primary"
                />
              </div>

              <div>
                <label className="text-txt-tertiary block mb-1 font-medium">Biografia / Descrição da Loja</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none focus:border-accent-primary resize-none"
                />
              </div>

              <div>
                <label className="text-txt-tertiary block mb-1 font-medium">E-mail de Contato Público</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none focus:border-accent-primary"
                  placeholder="vendas@exemplo.com"
                />
              </div>

              <div>
                <label className="text-txt-tertiary block mb-1 font-medium">Avatar da Loja (URL)</label>
                <input
                  type="text"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none focus:border-accent-primary"
                  placeholder="https://..."
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-surface-channel hover:bg-surface-base text-txt-secondary text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="px-5 py-2 rounded-lg bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold disabled:opacity-50"
                >
                  {isUpdatingProfile ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  switch (status) {
    case 'published':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Publicado
        </span>
      );
    case 'pending_review':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Em Análise
        </span>
      );
    case 'changes_requested':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
          Ajustes Pedidos
        </span>
      );
    case 'rejected':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
          Rejeitado
        </span>
      );
    case 'suspended':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/30">
          Suspenso
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-txt-secondary border border-border-hard">
          Rascunho
        </span>
      );
  }
}
