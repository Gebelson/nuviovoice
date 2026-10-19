import React, { useState } from 'react';
import { useStoreStore } from '../../stores/storeStore';
import { useNavigate } from 'react-router-dom';

export function SellerApplyModal({ onClose }: { onClose: () => void }) {
  const applySeller = useStoreStore((s) => s.applySeller);
  const navigate = useNavigate();

  const [storeName, setStoreName] = useState('');
  const [bio, setBio] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) return;

    try {
      setLoading(true);
      await applySeller({
        storeName: storeName.trim(),
        bio: bio.trim(),
        contactEmail: contactEmail.trim() || undefined,
      });
      onClose();
      navigate('/store/seller');
    } catch (err: any) {
      alert(err.message || 'Erro ao registrar perfil de vendedor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-hard rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Torne-se um Vendedor</h2>
              <span className="text-xs text-txt-tertiary">Publique seus produtos na comunidade Nuvio</span>
            </div>
          </div>
          <button onClick={onClose} className="text-txt-tertiary hover:text-white">✕</button>
        </div>

        <p className="text-xs text-txt-secondary leading-relaxed">
          Crie seu perfil comercial para anunciar bots, templates, serviços de moderação, design e e-books. Todos os produtos enviados passam por aprovação da moderação antes de irem ao ar.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-txt-tertiary block mb-1 font-medium">Nome da sua Loja ou Marca *</label>
            <input
              type="text"
              required
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Ex: CraftBots Studio"
              className="w-full bg-surface-channel border border-border-hard rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-accent-primary"
            />
          </div>

          <div>
            <label className="text-txt-tertiary block mb-1 font-medium">Apresentação / Bio da Loja</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Conte brevemente o que você cria e vende..."
              className="w-full bg-surface-channel border border-border-hard rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-accent-primary resize-none"
            />
          </div>

          <div>
            <label className="text-txt-tertiary block mb-1 font-medium">E-mail para Contato de Clientes</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="vendas@seuservico.com"
              className="w-full bg-surface-channel border border-border-hard rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-accent-primary"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-surface-channel hover:bg-surface-base text-txt-secondary text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold transition-transform active:scale-95 shadow-lg shadow-accent-primary/20 disabled:opacity-50"
            >
              {loading ? 'Cadastrando...' : 'Criar Perfil de Vendedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
