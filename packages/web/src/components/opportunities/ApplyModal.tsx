import React, { useState } from 'react';
import type { OpportunityItem } from '@concord/shared';
import { api } from '../../api/client';
import { useOpportunityStore } from '../../stores/opportunityStore';

interface ApplyModalProps {
  opportunity: OpportunityItem;
  onClose: () => void;
  onSuccess: () => void;
}

export function ApplyModal({ opportunity, onClose, onSuccess }: ApplyModalProps) {
  const { applyToOpportunity } = useOpportunityStore();

  const [message, setMessage] = useState('');
  const [proposedPrice, setProposedPrice] = useState(
    opportunity.type === 'freelance' && opportunity.budget ? String(opportunity.budget) : ''
  );
  const [proposedDuration, setProposedDuration] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [resumeName, setResumeName] = useState('');
  const [portfolioLink, setPortfolioLink] = useState('');
  const [portfolioUrls, setPortfolioUrls] = useState<string[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<'basic' | 'standard' | 'premium' | 'custom'>('basic');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isJob = opportunity.type === 'job';
  const isFreelance = opportunity.type === 'freelance';
  const isGig = opportunity.type === 'gig';

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.opportunities.upload(formData);
      setResumeUrl(res.url);
      setResumeName(res.originalName);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao enviar arquivo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddPortfolio = () => {
    if (!portfolioLink.trim()) return;
    setPortfolioUrls([...portfolioUrls, portfolioLink.trim()]);
    setPortfolioLink('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setErrorMessage('Por favor, escreva uma mensagem de apresentação.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const formattedAnswers = opportunity.questions?.map((q) => ({
      questionId: q.id,
      question: q.question,
      answer: answers[q.id] || '',
    })) || [];

    try {
      await applyToOpportunity(opportunity.id, {
        message: message.trim(),
        proposedPrice: proposedPrice ? Number(proposedPrice) : undefined,
        proposedDuration: proposedDuration.trim() || undefined,
        packageTier: isGig ? selectedPackage : undefined,
        resumeUrl: resumeUrl || undefined,
        resumeName: resumeName || undefined,
        portfolioUrls: portfolioUrls.length > 0 ? portfolioUrls : undefined,
        answers: formattedAnswers.length > 0 ? formattedAnswers : undefined,
      });
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Não foi possível enviar a proposta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col bg-surface-panel border border-border-hard rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-hard bg-surface-panel/90">
          <div>
            <h3 className="text-base font-bold text-white">
              {isJob ? 'Candidatura à Vaga' : isFreelance ? 'Enviar Proposta de Freelance' : 'Solicitar Serviço'}
            </h3>
            <p className="text-xs text-txt-secondary truncate max-w-sm mt-0.5">
              {opportunity.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-txt-tertiary hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs no-scrollbar">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/25 text-rose-400 text-xs font-semibold">
              {errorMessage}
            </div>
          )}

          {/* Gig Package Selection (if gig) */}
          {isGig && opportunity.packages && (
            <div>
              <label className="block text-txt-secondary font-semibold mb-2">Selecione o Pacote de Serviço</label>
              <div className="grid grid-cols-3 gap-2">
                {(['basic', 'standard', 'premium'] as const).map((tierKey) => {
                  const pkg = opportunity.packages?.[tierKey];
                  if (!pkg && tierKey !== 'basic') return null;
                  const isSelected = selectedPackage === tierKey;
                  return (
                    <button
                      key={tierKey}
                      type="button"
                      onClick={() => setSelectedPackage(tierKey)}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'bg-accent-primary/15 border-accent-primary text-white shadow-sm'
                          : 'bg-surface-channel border-border-hard text-txt-secondary hover:text-white'
                      }`}
                    >
                      <span className="block font-bold text-xs capitalize">{pkg?.name || tierKey}</span>
                      <span className="block text-accent-primary font-extrabold text-xs mt-1">
                        {pkg?.price ? `R$ ${pkg.price}` : 'Sob consulta'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Price & Duration for freelance */}
          {isFreelance && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-txt-secondary font-semibold mb-1">Valor Proposto (R$)</label>
                <input
                  type="number"
                  value={proposedPrice}
                  onChange={(e) => setProposedPrice(e.target.value)}
                  placeholder="Ex: 1500"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-channel border border-border-hard hover:border-border-soft text-white text-xs focus:outline-none focus:border-accent-primary transition-all"
                />
              </div>
              <div>
                <label className="block text-txt-secondary font-semibold mb-1">Prazo Estimado</label>
                <input
                  type="text"
                  value={proposedDuration}
                  onChange={(e) => setProposedDuration(e.target.value)}
                  placeholder="Ex: 10 dias úteis"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-channel border border-border-hard hover:border-border-soft text-white text-xs focus:outline-none focus:border-accent-primary transition-all"
                />
              </div>
            </div>
          )}

          {/* Presentation message */}
          <div>
            <label className="block text-txt-secondary font-semibold mb-1">
              Carta de Apresentação / Mensagem Inicial <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Apresente sua experiência, por que você é o profissional ideal e como pretende entregar o melhor resultado..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-channel border border-border-hard hover:border-border-soft text-white text-xs focus:outline-none focus:border-accent-primary transition-all resize-none leading-relaxed"
              required
            />
          </div>

          {/* Questions (if job has screening questions) */}
          {opportunity.questions && opportunity.questions.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-border-hard">
              <span className="text-txt-secondary font-semibold block">Perguntas do Contratante:</span>
              {opportunity.questions.map((q) => (
                <div key={q.id}>
                  <label className="block text-txt-secondary mb-1">{q.question}</label>
                  <input
                    type="text"
                    value={answers[q.id] || ''}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    placeholder="Sua resposta..."
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-channel border border-border-hard hover:border-border-soft text-white text-xs focus:outline-none focus:border-accent-primary transition-all"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Resume Upload */}
          <div>
            <label className="block text-txt-secondary font-semibold mb-1">Currículo ou Anexo (PDF, DOCX)</label>
            {resumeUrl ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-channel border border-border-hard">
                <span className="text-accent-primary font-medium truncate">{resumeName}</span>
                <button
                  type="button"
                  onClick={() => {
                    setResumeUrl('');
                    setResumeName('');
                  }}
                  className="text-rose-400 hover:text-rose-300 text-[11px] font-bold"
                >
                  Remover
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-5 border border-dashed border-border-hard hover:border-accent-primary/50 rounded-2xl cursor-pointer bg-surface-channel/50 transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-tertiary mb-1">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span className="text-xs text-txt-secondary font-medium">
                  {isUploading ? 'Enviando arquivo...' : 'Clique para selecionar arquivo do seu computador'}
                </span>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.zip,.png,.jpg"
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Portfolio links */}
          <div>
            <label className="block text-txt-secondary font-semibold mb-1">Links de Portfólio / GitHub / Behance</label>
            <div className="flex gap-2 mb-2">
              <input
                type="url"
                value={portfolioLink}
                onChange={(e) => setPortfolioLink(e.target.value)}
                placeholder="https://..."
                className="flex-1 px-3.5 py-2 bg-surface-channel border border-border-hard hover:border-border-soft rounded-xl text-white text-xs focus:outline-none focus:border-accent-primary transition-all"
              />
              <button
                type="button"
                onClick={handleAddPortfolio}
                className="px-4 py-2 rounded-xl bg-surface-channel hover:bg-surface-elevated text-white border border-border-hard font-semibold transition-colors"
              >
                Adicionar
              </button>
            </div>
            {portfolioUrls.length > 0 && (
              <div className="space-y-1">
                {portfolioUrls.map((url, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] text-txt-secondary px-3 py-1.5 bg-surface-channel rounded-lg border border-border-hard">
                    <span className="truncate max-w-xs">{url}</span>
                    <button
                      type="button"
                      onClick={() => setPortfolioUrls(portfolioUrls.filter((_, idx) => idx !== i))}
                      className="text-rose-400 hover:text-rose-300 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Privacy Note */}
          <div className="p-3.5 rounded-xl bg-surface-channel/80 border border-border-hard text-[11px] text-txt-secondary flex items-start gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-accent-primary mt-0.5">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className="leading-relaxed">
              <strong className="text-white">Chat Protegido:</strong> o contratante poderá analisar sua proposta com privacidade. Novas mensagens e chamadas só serão liberadas após a aprovação inicial.
            </span>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-hard">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-txt-secondary hover:text-white transition-colors font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              className="px-6 py-2.5 rounded-xl font-bold bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-50 text-white transition-all shadow-lg shadow-accent-primary/20"
            >
              {isSubmitting ? 'Enviando...' : 'Enviar Proposta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
