import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import { useFormatters } from '../../../i18n/formatters';
import { VerificationBadge } from '../../ui/VerificationBadge';
import type {
  VerificationStatus,
  VerificationInfo,
  VerificationRequestData,
} from '@concord/shared';
import { ShieldIcon, CheckCircleIcon, ClockIcon, AlertTriangleIcon, GlobeIcon, HelpCircleIcon } from '../../ui/VerificationIcons';

export function SpaceVerificationSection({ spaceId }: { spaceId: string }) {
  const { formatMediumDate } = useFormatters();
  const addToast = useUIStore((s) => s.addToast);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<VerificationStatus>('none');
  const [verification, setVerification] = useState<VerificationInfo | null>(null);
  const [activeRequest, setActiveRequest] = useState<VerificationRequestData | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<'space' | 'organization'>('space');
  const [publicName, setPublicName] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [domainName, setDomainName] = useState('');
  const [socialLinks, setSocialLinks] = useState([{ platform: '', url: '' }]);

  // Domain check
  const [checkingDomain, setCheckingDomain] = useState(false);
  const [domainCheckResult, setDomainCheckResult] = useState<{ verified: boolean; message: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.verifications.getSpaceVerification(spaceId);
      setStatus(res.status);
      setVerification(res.verification);
      setActiveRequest(res.activeRequest);
    } catch (err: any) {
      console.error('Failed to load space verification', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [spaceId]);

  const handleAddSocial = () => {
    if (socialLinks.length < 5) {
      setSocialLinks([...socialLinks, { platform: '', url: '' }]);
    }
  };

  const handleRemoveSocial = (idx: number) => {
    setSocialLinks(socialLinks.filter((_, i) => i !== idx));
  };

  const handleSocialChange = (idx: number, field: 'platform' | 'url', val: string) => {
    const updated = [...socialLinks];
    const curr = updated[idx] || { platform: '', url: '' };
    updated[idx] = { platform: curr.platform, url: curr.url, [field]: val };
    setSocialLinks(updated);
  };

  const handleTestDomain = async () => {
    if (!domainName) return;
    setCheckingDomain(true);
    setDomainCheckResult(null);
    try {
      const res = await api.verifications.verifyDomain({ domain: domainName, method: 'dns_txt', requestId: activeRequest?.id });
      setDomainCheckResult({ verified: res.verified, message: res.message });
    } catch (err: any) {
      setDomainCheckResult({ verified: false, message: err?.message || 'Erro ao consultar domínio.' });
    } finally {
      setCheckingDomain(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicName.trim()) {
      setError('Informe o nome oficial do espaço.');
      return;
    }
    if (!description.trim() || description.length < 15) {
      setError('A descrição deve conter no mínimo 15 caracteres.');
      return;
    }

    const filteredSocials = socialLinks.filter(s => s.platform.trim() && s.url.trim());

    setSubmitting(true);
    setError(null);
    try {
      await api.verifications.createSpaceRequest(spaceId, {
        category,
        publicName: publicName.trim(),
        description: description.trim(),
        website: website.trim() || undefined,
        domainName: domainName.trim() || undefined,
        socialLinks: filteredSocials.length > 0 ? filteredSocials : undefined,
      });

      addToast('Solicitação de verificação do espaço enviada!', 'success');
      setShowForm(false);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Erro ao enviar solicitação.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-3 text-xs text-txt-tertiary">
        Carregando informações de autenticidade...
      </div>
    );
  }

  return (
    <div className="pt-4 border-t border-border-soft space-y-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
            <ShieldIcon size={18} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-txt-primary">
                Selo de Verificação do Espaço
              </span>
              {verification?.status === 'verified' && (
                <VerificationBadge category={verification.category || 'space'} size="sm" />
              )}
            </div>
            <p className="text-[11px] text-txt-secondary mt-0.5">
              Destaque seu espaço no Explorar com um selo oficial de legitimidade e autenticidade.
            </p>
          </div>
        </div>

        {status === 'verified' && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            <CheckCircleIcon size={12} />
            Verificado
          </span>
        )}
      </div>

      {/* Verified state */}
      {status === 'verified' && verification && (
        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-txt-tertiary">Status do Espaço:</span>
            <span className="font-medium text-txt-primary">
              {verification.category === 'organization' ? 'Organização Verificada' : 'Espaço Público Verificado'}
            </span>
          </div>
          {verification.verifiedAt && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-txt-tertiary">Data de verificação:</span>
              <span className="text-txt-secondary">
                {formatMediumDate(verification.verifiedAt)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Pending / Under review / Info requested */}
      {(status === 'pending' || status === 'under_review' || status === 'info_requested') && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-amber-400 font-medium">
            <ClockIcon size={15} />
            <span>
              {status === 'info_requested'
                ? 'Mais Informações Solicitadas para o Espaço'
                : 'Solicitação do Espaço em Análise'}
            </span>
          </div>
          <p className="text-txt-secondary leading-relaxed text-[11px]">
            {status === 'info_requested'
              ? activeRequest?.infoRequestNotes || 'A equipe de moderação solicitou informações complementares sobre a autenticidade do espaço.'
              : 'A equipe do Nuvio está analisando as credenciais e conformidade do espaço com as diretrizes da comunidade.'}
          </p>
        </div>
      )}

      {/* Rejected state */}
      {status === 'rejected' && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-rose-400 font-medium">
            <AlertTriangleIcon size={15} />
            <span>Solicitação Anterior Não Aprovada</span>
          </div>
          <p className="text-txt-secondary text-[11px]">
            {activeRequest?.rejectionReason || 'O espaço não cumpriu os requisitos mínimos de atividade ou legitimidade.'}
          </p>
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="px-3 py-1 text-xs font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg transition-colors"
            >
              Nova Solicitação
            </button>
          )}
        </div>
      )}

      {/* Call to action */}
      {status === 'none' && !showForm && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-txt-secondary">
            Este espaço ainda não possui solicitação de verificação enviada.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-primary hover:bg-accent-primary/80 text-white transition-colors"
          >
            Solicitar Selo
          </button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 pt-2 animate-in fade-in duration-150">
          {error && (
            <div className="p-2 rounded bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-txt-secondary">Tipo de Verificação do Espaço</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCategory('space')}
                className={`p-2 rounded-lg border text-left text-xs ${
                  category === 'space'
                    ? 'border-sky-500/50 bg-sky-500/10 text-white'
                    : 'border-white/5 bg-surface-base text-txt-secondary'
                }`}
              >
                <div className="font-semibold">Espaço da Comunidade</div>
                <div className="text-[10px] text-txt-tertiary">Comunidade pública reconhecida</div>
              </button>

              <button
                type="button"
                onClick={() => setCategory('organization')}
                className={`p-2 rounded-lg border text-left text-xs ${
                  category === 'organization'
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                    : 'border-white/5 bg-surface-base text-txt-secondary'
                }`}
              >
                <div className="font-semibold">Espaço de Organização</div>
                <div className="text-[10px] text-txt-tertiary">Canal oficial de empresa ou projeto</div>
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-txt-secondary">Nome Oficial para Exibição *</label>
            <input
              type="text"
              value={publicName}
              onChange={(e) => setPublicName(e.target.value)}
              placeholder="Nome público oficial do espaço ou comunidade"
              className="w-full px-3 py-1.5 rounded-lg bg-surface-base border border-white/10 text-txt-primary text-xs focus:outline-none"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-txt-secondary">Justificativa e Relevância *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o propósito da comunidade, histórico e evidências de notoriedade (mínimo 15 caracteres)."
              rows={2}
              className="w-full px-3 py-1.5 rounded-lg bg-surface-base border border-white/10 text-txt-primary text-xs focus:outline-none resize-none"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-txt-secondary">Website Oficial</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://suacomunidade.org"
              className="w-full px-3 py-1.5 rounded-lg bg-surface-base border border-white/10 text-txt-primary text-xs focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
              className="px-3 py-1 text-xs text-txt-tertiary hover:text-txt-secondary transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3.5 py-1 text-xs font-medium rounded-lg bg-accent-primary hover:bg-accent-primary/80 text-white transition-colors disabled:opacity-50"
            >
              {submitting ? 'Enviando...' : 'Enviar Solicitação'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
