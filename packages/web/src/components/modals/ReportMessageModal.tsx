import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { useUIStore } from '../../stores/uiStore';
import { api } from '../../api';
import type { SafetyReportCategory } from '@concord/shared';

interface CategoryOption {
  value: SafetyReportCategory;
  label: string;
  urgent?: boolean;
}

const CATEGORIES: CategoryOption[] = [
  { value: 'csam_exploitation', label: 'Abuso ou exploração sexual de crianças e adolescentes (ECA)', urgent: true },
  { value: 'threat', label: 'Ameaça à integridade física ou psicológica', urgent: true },
  { value: 'violence', label: 'Incentivo à violência ou atos perigosos', urgent: true },
  { value: 'extortion', label: 'Extorsão ou chantagem' },
  { value: 'harassment', label: 'Assédio, perseguição ou intimidação' },
  { value: 'stalking', label: 'Stalking ou violação de privacidade' },
  { value: 'hate_speech', label: 'Discurso de ódio ou discriminação' },
  { value: 'fraud', label: 'Fraude, golpe ou engenharia social' },
  { value: 'unauthorized_personal_data', label: 'Divulgação indevida de dados pessoais (LGPD / Doxxing)' },
  { value: 'illegal_other', label: 'Outro conteúdo potencialmente ilícito' },
];

export function ReportMessageModal() {
  const activeModal = useUIStore((s) => s.activeModal);
  const modalData = useUIStore((s) => s.modalData);
  const closeModal = useUIStore((s) => s.closeModal);
  const addToast = useUIStore((s) => s.addToast);

  const isOpen = activeModal === 'reportMessage';
  const messageId = modalData.messageId as string | undefined;
  const authorUsername = modalData.authorUsername as string | undefined;
  const messageContent = modalData.content as string | undefined;

  const [category, setCategory] = useState<SafetyReportCategory>('harassment');
  const [description, setDescription] = useState('');
  const [includeContext, setIncludeContext] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !messageId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.reports.reportMessage({
        messageId,
        category,
        description: description.trim() || undefined,
        includeContext,
      });

      closeModal();
      addToast(
        `Denúncia registrada com sucesso! Protocolo: ${res.protocol}`,
        'success',
        6000
      );
    } catch (err: any) {
      setError(err?.message || 'Falha ao registrar denúncia. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title="Denunciar mensagem" maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        {/* Transparency banner */}
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200/90 leading-relaxed">
          <span className="font-semibold text-amber-300 block mb-1">
            Privacidade e Integridade Legal (Marco Civil & LGPD)
          </span>
          Ao denunciar, apenas esta mensagem e sua assinatura criptográfica SHA-256 serão
          enviadas para análise da moderação e eventual cooperação jurídica. O Nuvio não realiza
          varredura arbitrária em suas outras mensagens.
        </div>

        {/* Message preview snippet */}
        <div className="p-3 bg-surface-elevated/60 border border-white/5 rounded-xl space-y-1">
          <div className="text-[11px] font-medium text-txt-secondary">
            Mensagem de <span className="font-semibold text-txt-primary">@{authorUsername || 'usuário'}</span>:
          </div>
          <div className="text-xs text-txt-primary line-clamp-3 italic bg-black/20 p-2 rounded-lg">
            "{messageContent || '[Anexo ou conteúdo multimídia]'}"
          </div>
        </div>

        {/* Category selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-txt-primary block">
            Motivo da denúncia <span className="text-red-400">*</span>
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as SafetyReportCategory)}
            className="w-full bg-surface-elevated border border-white/10 rounded-xl px-3 py-2 text-xs text-txt-primary focus:outline-none focus:border-accent-primary"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.urgent ? '🚨 ' : ''}{cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Include context checkbox */}
        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeContext}
            onChange={(e) => setIncludeContext(e.target.checked)}
            className="mt-0.5 rounded border-white/20 bg-surface-elevated text-accent-primary focus:ring-0"
          />
          <div className="text-xs text-txt-secondary">
            Incluir até 5 mensagens anteriores da mesma conversa como contexto imediato.
          </div>
        </label>

        {/* Description textarea */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-txt-primary block">
            Detalhes adicionais (opcional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Forneça detalhes adicionais que auxiliem a moderação a compreender o ocorrido..."
            className="w-full bg-surface-elevated border border-white/10 rounded-xl p-3 text-xs text-txt-primary focus:outline-none focus:border-accent-primary resize-none placeholder:text-txt-tertiary"
          />
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={closeModal}
            className="px-4 py-1.5 text-xs text-txt-secondary hover:text-txt-primary transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-full transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Enviando...' : 'Enviar denúncia'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
