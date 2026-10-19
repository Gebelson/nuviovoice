import React, { useState } from 'react';
import { api } from '../../api/client';
import type { Product } from '../../types/store';

export function ReportProductModal({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('Conteúdo enganoso ou golpe');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.store.reportProduct(product.id, { reason, details });
      alert('Denúncia enviada à moderação do Nuvio. Obrigado por manter a plataforma segura!');
      onClose();
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar denúncia');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-hard rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Denunciar Produto</h3>
          <button onClick={onClose} className="text-txt-tertiary hover:text-white">✕</button>
        </div>

        <p className="text-xs text-txt-secondary">
          Você está denunciando o produto <strong className="text-white">"{product.title}"</strong>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-txt-tertiary block mb-1 font-medium">Motivo Principal</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none focus:border-accent-primary"
            >
              <option value="Conteúdo enganoso ou golpe">Conteúdo enganoso ou golpe</option>
              <option value="Violação de direitos autorais ou plágio">Violação de direitos autorais ou plágio</option>
              <option value="Conteúdo malicioso / vírus">Conteúdo malicioso / vírus</option>
              <option value="Spam ou anúncio abusivo">Spam ou anúncio abusivo</option>
              <option value="Outro motivo grave">Outro motivo grave</option>
            </select>
          </div>

          <div>
            <label className="text-txt-tertiary block mb-1 font-medium">Detalhes Adicionais</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              placeholder="Explique o que há de errado com este anúncio..."
              className="w-full bg-surface-channel border border-border-hard rounded-lg p-3 text-white outline-none focus:border-accent-primary resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-surface-channel hover:bg-surface-base text-txt-secondary text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold disabled:opacity-50"
            >
              {submitting ? 'Enviando...' : 'Confirmar Denúncia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
