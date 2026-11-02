import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import { useFormatters } from '../../../i18n/formatters';
import { VerificationBadge } from '../../ui/VerificationBadge';
import type {
  VerificationCategory,
  VerificationStatus,
  VerificationInfo,
  VerificationRequestData,
} from '@concord/shared';
import { ShieldIcon, CheckCircleIcon, ClockIcon, AlertTriangleIcon, GlobeIcon, ExternalLinkIcon, HelpCircleIcon } from '../../ui/VerificationIcons';

export function VerificationSection() {
  const { t } = useTranslation(['settings', 'common']);
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

  const [category, setCategory] = useState<VerificationCategory>('personal');
  const [publicName, setPublicName] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [domainName, setDomainName] = useState('');
  const [socialLinks, setSocialLinks] = useState([{ platform: '', url: '' }]);

  // Domain verification helper
  const [checkingDomain, setCheckingDomain] = useState(false);
  const [domainCheckResult, setDomainCheckResult] = useState<{ verified: boolean; message: string; token: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.verifications.getMyVerification();
      setStatus(res.status);
      setVerification(res.verification);
      setActiveRequest(res.activeRequest);
    } catch (err: any) {
      console.error('Failed to load verification status', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
      setDomainCheckResult({ verified: res.verified, message: res.message, token: res.token });
    } catch (err: any) {
      setDomainCheckResult({ verified: false, message: err?.message || 'Erro ao consultar domínio.', token: '' });
    } finally {
      setCheckingDomain(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicName.trim()) {
      setError('Informe o nome público ou oficial.');
      return;
    }
    if (!description.trim() || description.length < 15) {
      setError('A descrição de autenticidade deve conter pelo menos 15 caracteres.');
      return;
    }

    const filteredSocials = socialLinks.filter(s => s.platform.trim() && s.url.trim());

    setSubmitting(true);
    setError(null);
    try {
      await api.verifications.createRequest({
        category,
        entityType: 'user',
        publicName: publicName.trim(),
        description: description.trim(),
        website: website.trim() || undefined,
        domainName: domainName.trim() || undefined,
        socialLinks: filteredSocials.length > 0 ? filteredSocials : undefined,
      });

      addToast('Solicitação de verificação enviada para análise!', 'success');
      setShowForm(false);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível enviar a solicitação.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl bg-surface-card border border-white/5 p-4 flex items-center justify-center text-txt-tertiary text-sm">
        {t('common:states.loading', { defaultValue: 'Carregando...' })}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface-card border border-white/5 p-4.5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
            <ShieldIcon size={20} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-txt-primary">
                Verificação e Autenticidade
              </h3>
              {verification?.status === 'verified' && (
                <VerificationBadge category={verification.category} size="md" />
              )}
            </div>
            <p className="text-xs text-txt-secondary mt-0.5">
              Identificação oficial de contas autênticas, criadores de conteúdo e organizações.
            </p>
          </div>
        </div>

        {status === 'verified' && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            <CheckCircleIcon size={13} />
            Verificado
          </span>
        )}
      </div>

      {/* Verified State */}
      {status === 'verified' && verification && (
        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-txt-tertiary">Categoria:</span>
            <span className="font-medium text-txt-primary capitalize">
              {verification.category === 'personal' && 'Conta Pessoal Verificada'}
              {verification.category === 'creator' && 'Criador ou Figura Pública'}
              {verification.category === 'organization' && 'Organização ou Empresa'}
              {verification.category === 'official' && 'Equipe Oficial Nuvio'}
            </span>
          </div>
          {verification.verifiedAt && (
            <div className="flex items-center justify-between">
              <span className="text-txt-tertiary">Verificado em:</span>
              <span className="text-txt-secondary">
                {formatMediumDate(verification.verifiedAt)}
              </span>
            </div>
          )}
          <p className="text-[11px] text-txt-tertiary pt-1 border-t border-white/5">
            Sua conta possui selo de autenticidade ativo. O selo atesta identidade legítima no ecossistema Nuvio.
          </p>
        </div>
      )}

      {/* Under Review / Pending / Info Requested State */}
      {(status === 'pending' || status === 'under_review' || status === 'info_requested') && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3.5 space-y-2.5 text-xs">
          <div className="flex items-center gap-2 text-amber-400 font-medium">
            <ClockIcon size={16} />
            <span>
              {status === 'info_requested'
                ? 'Mais Informações Solicitadas pela Equipe'
                : 'Solicitação em Análise'}
            </span>
          </div>
          <p className="text-txt-secondary leading-relaxed">
            {status === 'info_requested'
              ? activeRequest?.infoRequestNotes || 'A equipe de análise solicitou dados complementares para validar a autenticidade da sua conta.'
              : 'Sua solicitação de verificação está sendo examinada pela moderação de autenticidade. O processo garante conformidade legal e veracidade cadastral.'}
          </p>
          {activeRequest && (
            <div className="pt-2 border-t border-amber-500/10 text-[11px] text-txt-tertiary flex items-center justify-between">
              <span>Nome solicitado: <strong className="text-txt-secondary">{activeRequest.publicName}</strong></span>
              <span>Enviado em: {formatMediumDate(activeRequest.createdAt)}</span>
            </div>
          )}
        </div>
      )}

      {/* Rejected State */}
      {status === 'rejected' && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3.5 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-rose-400 font-medium">
            <AlertTriangleIcon size={16} />
            <span>Solicitação Não Aprovada</span>
          </div>
          <p className="text-txt-secondary">
            {activeRequest?.rejectionReason || 'A solicitação anterior não atendeu aos critérios mínimos de autenticidade ou notoriedade pública.'}
          </p>
          {!showForm && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="px-3 py-1.5 text-xs font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg transition-colors"
              >
                Enviar Nova Solicitação
              </button>
            </div>
          )}
        </div>
      )}

      {/* None State: Call to Action */}
      {status === 'none' && !showForm && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-txt-secondary">
            Sua conta não possui solicitação de verificação em andamento.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-accent-primary hover:bg-accent-primary/80 text-white transition-colors"
          >
            Solicitar Verificação
          </button>
        </div>
      )}

      {/* Verification Request Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3.5 pt-2 border-t border-white/5 animate-in fade-in duration-150">
          <div className="text-xs font-semibold text-txt-primary">
            Formulário de Solicitação de Selo
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
              {error}
            </div>
          )}

          {/* Category selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-txt-secondary">Categoria de Verificação</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCategory('personal')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  category === 'personal'
                    ? 'border-sky-500/50 bg-sky-500/10 text-white'
                    : 'border-white/5 bg-surface-base text-txt-secondary hover:border-white/10'
                }`}
              >
                <div className="text-xs font-semibold">Pessoa Física</div>
                <div className="text-[11px] text-txt-tertiary mt-0.5 leading-tight">Autenticidade individual ou profissional</div>
              </button>

              <button
                type="button"
                onClick={() => setCategory('creator')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  category === 'creator'
                    ? 'border-sky-500/50 bg-sky-500/10 text-white'
                    : 'border-white/5 bg-surface-base text-txt-secondary hover:border-white/10'
                }`}
              >
                <div className="text-xs font-semibold">Criador / Notório</div>
                <div className="text-[11px] text-txt-tertiary mt-0.5 leading-tight">Criador público, artista ou comunicador</div>
              </button>

              <button
                type="button"
                onClick={() => setCategory('organization')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  category === 'organization'
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                    : 'border-white/5 bg-surface-base text-txt-secondary hover:border-white/10'
                }`}
              >
                <div className="text-xs font-semibold">Organização</div>
                <div className="text-[11px] text-txt-tertiary mt-0.5 leading-tight">Empresa, instituição ou coletivo oficial</div>
              </button>
            </div>
          </div>

          {/* Public Name */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-txt-secondary">Nome Público, Artístico ou Razão Social *</label>
            <input
              type="text"
              value={publicName}
              onChange={(e) => setPublicName(e.target.value)}
              placeholder="Ex: João da Silva, Estúdio Aurora, TechCorp"
              className="w-full px-3 py-2 rounded-lg bg-surface-base border border-white/10 text-txt-primary text-xs focus:outline-none focus:border-sky-500/50"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-txt-secondary">Descrição e Justificativa de Notoriedade / Autenticidade *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explique sua atuação, referências públicas ou por que o perfil deve possuir verificação oficial (mínimo 15 caracteres)."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-surface-base border border-white/10 text-txt-primary text-xs focus:outline-none focus:border-sky-500/50 resize-none"
              required
            />
          </div>

          {/* Website */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-txt-secondary">Website Oficial</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://suaempresa.com.br"
              className="w-full px-3 py-2 rounded-lg bg-surface-base border border-white/10 text-txt-primary text-xs focus:outline-none focus:border-sky-500/50"
            />
          </div>

          {/* Domain name check */}
          <div className="space-y-1 p-3 rounded-lg bg-surface-base/50 border border-white/5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-txt-secondary flex items-center gap-1.5">
                <GlobeIcon size={13} className="text-txt-tertiary" />
                Validação Técnica de Domínio (Opcional, altamente recomendada)
              </label>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={domainName}
                onChange={(e) => setDomainName(e.target.value)}
                placeholder="exemplo.com.br"
                className="flex-1 px-3 py-1.5 rounded-lg bg-surface-base border border-white/10 text-txt-primary text-xs focus:outline-none focus:border-sky-500/50"
              />
              <button
                type="button"
                onClick={handleTestDomain}
                disabled={checkingDomain || !domainName}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-txt-primary text-xs font-medium disabled:opacity-40 transition-colors"
              >
                {checkingDomain ? 'Checando...' : 'Testar DNS'}
              </button>
            </div>
            {domainCheckResult && (
              <div className={`mt-2 p-2 rounded text-xs leading-relaxed ${
                domainCheckResult.verified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-300'
              }`}>
                {domainCheckResult.message}
              </div>
            )}
            <div className="text-[11px] text-txt-tertiary mt-1 leading-tight">
              Permite validar controle do domínio inserindo registro TXT com chave de verificação.
            </div>
          </div>

          {/* Social Links */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-txt-secondary">Perfis Sociais e Evidências Públicas</label>
            {socialLinks.map((s, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Plataforma (ex: YouTube, X, GitHub)"
                  value={s.platform}
                  onChange={(e) => handleSocialChange(idx, 'platform', e.target.value)}
                  className="w-1/3 px-2.5 py-1.5 rounded-lg bg-surface-base border border-white/10 text-txt-primary text-xs focus:outline-none"
                />
                <input
                  type="url"
                  placeholder="https://..."
                  value={s.url}
                  onChange={(e) => handleSocialChange(idx, 'url', e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-surface-base border border-white/10 text-txt-primary text-xs focus:outline-none"
                />
                {socialLinks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveSocial(idx)}
                    className="p-1.5 text-txt-tertiary hover:text-rose-400 transition-colors"
                    title="Remover link"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {socialLinks.length < 5 && (
              <button
                type="button"
                onClick={handleAddSocial}
                className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
              >
                + Adicionar outro link
              </button>
            )}
          </div>

          {/* Privacy & Legal disclaimer */}
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-[11px] text-txt-tertiary space-y-1">
            <div className="font-semibold text-txt-secondary flex items-center gap-1.5">
              <HelpCircleIcon size={13} />
              Privacidade e Conformidade Legal (LGPD)
            </div>
            <p>
              As informações fornecidas serão utilizadas exclusivamente pela administração para atestar a legitimidade da conta. Documentos e dados de contato internos nunca serão exibidos publicamente. O selo não confere privilégios de moderação.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
              className="px-3.5 py-1.5 text-xs text-txt-tertiary hover:text-txt-secondary transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-accent-primary hover:bg-accent-primary/80 text-white transition-colors disabled:opacity-50"
            >
              {submitting ? 'Enviando...' : 'Enviar Solicitação'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
