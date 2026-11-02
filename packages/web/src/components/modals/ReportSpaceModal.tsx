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

const SPACE_CATEGORIES: CategoryOption[] = [
  { value: 'csam_exploitation', label: 'Abuso ou exploração sexual de crianças e adolescentes (ECA)', urgent: true },
  { value: 'violence', label: 'Incentivo à violência ou atos perigosos', urgent: true },
  { value: 'hate_speech', label: 'Discurso de ódio ou discriminação coletiva' },
  { value: 'fraud', label: 'Fraude, pirataria ou disseminação de malware' },
  { value: 'unauthorized_personal_data', label: 'Vazamento ou comercialização de dados pessoais (LGPD)' },
  { value: 'illegal_other', label: 'Outra atividade ilícita no espaço' },
];

export function ReportSpaceModal() {
  const activeModal = useUIStore((s) => s.activeModal);
  const modalData = useUIStore((s) => s.modalData);
  const closeModal = useUIStore((s) => s.closeModal);
  const addToast = useUIStore((s) => s.addToast);

  const isOpen = activeModal === 'reportSpace';
  const spaceId = modalData.spaceId as string | undefined;
  const spaceName = modalData.spaceName as string | undefined;

  const [category, setCategory] = useState<SafetyReportCategory>('fraud');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !spaceId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.reports.reportSpace({
        spaceId,
        category,
        description: description.trim() || undefined,
      });

      closeModal();
      addToast(
        `Denúncia do espaço registrada! Protocolo: ${res.protocol}`,
        'success',
        6000
      );
    } catch (err: any) {
      setError(err?.message || 'Falha ao registrar denúncia do espaço. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title="Denunciar espaço" maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200/90 leading-relaxed">
          <span className="font-semibold text-amber-300 block mb-1">
            Conformidade Legal e Proteção Comunitária
          </span>
          Espaços que promovam crimes, violência, exploração infantil ou violações de dados serão
          investigados pela administração da instância e podem ser suspensos ou reportados às autoridades.
        </div>

        <div className="p-3 bg-surface-elevated/60 border border-white/5 rounded-xl">
          <div className="text-[11px] font-medium text-txt-secondary">Espaço denunciado:</div>
          <div className="text-sm font-semibold text-txt-primary mt-0.5">
            {spaceName || 'Espaço'} <span className="text-[11px] text-txt-tertiary">({spaceId})</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-txt-primary block">
            Motivo da denúncia <span className="text-red-400">*</span>
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as SafetyReportCategory)}
            className="w-full bg-surface-elevated border border-white/10 rounded-xl px-3 py-2 text-xs text-txt-primary focus:outline-none focus:border-accent-primary"
          >
            {SPACE_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.urgent ? '🚨 ' : ''}{cat.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-txt-primary block">
            Descrição detalhada (opcional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Descreva as irregularidades observadas neste espaço..."
            className="w-full bg-surface-elevated border border-white/10 rounded-xl p-3 text-xs text-txt-primary focus:outline-none focus:border-accent-primary resize-none placeholder:text-txt-tertiary"
          />
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">
            {error}
          </div>
        )}

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
