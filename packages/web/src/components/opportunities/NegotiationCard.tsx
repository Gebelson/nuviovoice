import React, { useState } from 'react';
import type { OpportunityNegotiation } from '@concord/shared';
import { useFormatters } from '../../i18n/formatters';

interface NegotiationCardProps {
  negotiation: OpportunityNegotiation;
  isReceiver: boolean;
  onAccept: (id: string) => Promise<void>;
  onDecline: (id: string) => Promise<void>;
  onCounterOffer: (terms: { price?: number; deadline?: string; scope?: string; revisions?: number; notes?: string }) => void;
}

export function NegotiationCard({ negotiation, isReceiver, onAccept, onDecline, onCounterOffer }: NegotiationCardProps) {
  const f = useFormatters();
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [counterPrice, setCounterPrice] = useState(negotiation.price ? String(negotiation.price) : '');
  const [counterDeadline, setCounterDeadline] = useState(negotiation.deadline || '');
  const [counterRevisions, setCounterRevisions] = useState(negotiation.revisions !== undefined && negotiation.revisions !== null ? String(negotiation.revisions) : '');
  const [counterNotes, setCounterNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getStatusBadge = () => {
    switch (negotiation.status) {
      case 'accepted':
        return { label: 'Termos Aceitos', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      case 'declined':
        return { label: 'Recusado', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
      case 'countered':
        return { label: 'Contraproposta', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
      default:
        return { label: 'Aguardando Resposta', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    }
  };

  const status = getStatusBadge();

  const handleSendCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      onCounterOffer({
        price: counterPrice ? Number(counterPrice) : undefined,
        deadline: counterDeadline.trim() || undefined,
        revisions: counterRevisions ? Number(counterRevisions) : undefined,
        notes: counterNotes.trim() || undefined,
      });
      setShowCounterModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="my-3 p-4 bg-surface-card border border-border-card rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-3 border-b border-border-subtle pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-txt-tertiary">
            Negociação #{negotiation.version}
          </span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${status.color}`}>
            {status.label}
          </span>
        </div>
        <span className="text-[11px] text-txt-muted">
          {f.formatDateTime(negotiation.createdAt)}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3 text-xs">
        {negotiation.price !== null && negotiation.price !== undefined && (
          <div className="p-2 rounded bg-surface-base border border-border-subtle">
            <span className="block text-txt-muted text-[10px] uppercase font-bold">Valor Proposto</span>
            <span className="text-sm font-bold text-accent-primary">
              {f.formatCurrency(negotiation.price)}
            </span>
          </div>
        )}
        {negotiation.deadline && (
          <div className="p-2 rounded bg-surface-base border border-border-subtle">
            <span className="block text-txt-muted text-[10px] uppercase font-bold">Prazo Estimado</span>
            <span className="text-xs font-semibold text-txt-primary">{negotiation.deadline}</span>
          </div>
        )}
        {negotiation.revisions !== null && negotiation.revisions !== undefined && (
          <div className="p-2 rounded bg-surface-base border border-border-subtle">
            <span className="block text-txt-muted text-[10px] uppercase font-bold">Revisões</span>
            <span className="text-xs font-semibold text-txt-primary">{negotiation.revisions}</span>
          </div>
        )}
      </div>

      {negotiation.deliverables && (
        <div className="mb-2 text-xs">
          <span className="font-semibold text-txt-secondary block mb-0.5">Entregáveis:</span>
          <p className="text-txt-primary bg-surface-base p-2 rounded border border-border-subtle text-[12px]">
            {negotiation.deliverables}
          </p>
        </div>
      )}

      {negotiation.notes && (
        <div className="mb-3 text-xs">
          <span className="font-semibold text-txt-secondary block mb-0.5">Observações:</span>
          <p className="text-txt-muted text-[12px]">{negotiation.notes}</p>
        </div>
      )}

      {/* Action buttons when pending */}
      {negotiation.status === 'pending' && isReceiver && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-subtle">
          <button
            type="button"
            onClick={() => onAccept(negotiation.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Aceitar Termos
          </button>

          <button
            type="button"
            onClick={() => setShowCounterModal(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-hover hover:bg-white/10 text-txt-primary border border-border-card transition-colors flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m3 16 4 4 4-4" />
              <path d="M7 20V4" />
              <path d="m21 8-4-4-4 4" />
              <path d="M17 4v16" />
            </svg>
            Contraproposta
          </button>

          <button
            type="button"
            onClick={() => onDecline(negotiation.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            Recusar
          </button>
        </div>
      )}

      {/* Counter offer inline modal */}
      {showCounterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface-card border border-border-card rounded-xl p-5 shadow-2xl">
            <h4 className="text-sm font-bold text-txt-primary mb-3">Enviar Contraproposta</h4>
            <form onSubmit={handleSendCounter} className="space-y-3 text-xs">
              <div>
                <label className="block text-txt-secondary mb-1">Novo Valor Proposto (R$)</label>
                <input
                  type="number"
                  value={counterPrice}
                  onChange={(e) => setCounterPrice(e.target.value)}
                  placeholder="Ex: 850"
                  className="w-full px-3 py-2 bg-surface-base border border-border-card rounded-lg text-txt-primary focus:outline-none focus:border-accent-primary"
                />
              </div>

              <div>
                <label className="block text-txt-secondary mb-1">Prazo Estimado</label>
                <input
                  type="text"
                  value={counterDeadline}
                  onChange={(e) => setCounterDeadline(e.target.value)}
                  placeholder="Ex: 4 dias úteis"
                  className="w-full px-3 py-2 bg-surface-base border border-border-card rounded-lg text-txt-primary focus:outline-none focus:border-accent-primary"
                />
              </div>

              <div>
                <label className="block text-txt-secondary mb-1">Revisões Incluídas</label>
                <input
                  type="number"
                  value={counterRevisions}
                  onChange={(e) => setCounterRevisions(e.target.value)}
                  placeholder="Ex: 2"
                  className="w-full px-3 py-2 bg-surface-base border border-border-card rounded-lg text-txt-primary focus:outline-none focus:border-accent-primary"
                />
              </div>

              <div>
                <label className="block text-txt-secondary mb-1">Justificativa ou Detalhes</label>
                <textarea
                  value={counterNotes}
                  onChange={(e) => setCounterNotes(e.target.value)}
                  rows={3}
                  placeholder="Explique o motivo do ajuste de valor ou prazo..."
                  className="w-full px-3 py-2 bg-surface-base border border-border-card rounded-lg text-txt-primary focus:outline-none focus:border-accent-primary resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCounterModal(false)}
                  className="px-3 py-1.5 rounded-lg text-txt-secondary hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg font-semibold bg-accent-primary hover:bg-accent-primary-hover text-white transition-colors"
                >
                  {isSubmitting ? 'Enviando...' : 'Enviar Contraproposta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
