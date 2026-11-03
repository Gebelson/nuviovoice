import React, { useState, useRef, useEffect } from 'react';
import { useOpportunityStore } from '../../stores/opportunityStore';
import { useAuthStore } from '../../stores/authStore';
import { Avatar } from '../ui/Avatar';
import { NegotiationCard } from './NegotiationCard';
import { useFormatters } from '../../i18n/formatters';
import type { OpportunityApplication } from '@concord/shared';

interface ProposalThreadViewProps {
  application: OpportunityApplication;
  onBack?: () => void;
  onOpenReport?: (targetId: string) => void;
}

export function ProposalThreadView({ application, onBack, onOpenReport }: ProposalThreadViewProps) {
  const f = useFormatters();
  const currentUser = useAuthStore((s) => s.user);
  const {
    activeMessages,
    activeNegotiations,
    activeOpportunity,
    activeApplicantProfile,
    isMessagesLoading,
    acceptApplication,
    rejectApplication,
    withdrawApplication,
    sendApplicationMessage,
    proposeNegotiation,
    acceptNegotiation,
    declineNegotiation,
  } = useOpportunityStore();

  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showNegotiationForm, setShowNegotiationForm] = useState(false);
  const [negPrice, setNegPrice] = useState('');
  const [negDeadline, setNegDeadline] = useState('');
  const [negDeliverables, setNegDeliverables] = useState('');
  const [negNotes, setNegNotes] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isRecipient = currentUser?.id === application.targetUserId;
  const isApplicant = currentUser?.id === application.applicantId;
  const isUnlocked = application.status === 'chat_unlocked';
  const isPending = application.status === 'submitted' || application.status === 'viewed';
  const isRejected = application.status === 'rejected';
  const isWithdrawn = application.status === 'withdrawn';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [activeMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !isUnlocked || isSending) return;

    setIsSending(true);
    try {
      await sendApplicationMessage(messageText.trim());
      setMessageText('');
    } finally {
      setIsSending(false);
    }
  };

  const handleCreateNegotiation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await proposeNegotiation({
        price: negPrice ? Number(negPrice) : undefined,
        deadline: negDeadline.trim() || undefined,
        deliverables: negDeliverables.trim() || undefined,
        notes: negNotes.trim() || undefined,
      });
      setShowNegotiationForm(false);
    } catch {}
  };

  return (
    <div className="flex flex-col h-full bg-surface-base">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-card bg-surface-card/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg text-txt-secondary hover:text-txt-primary hover:bg-white/5 transition-colors"
              title="Voltar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </svg>
            </button>
          )}

          <div className="flex items-center gap-3">
            {isRecipient ? (
              <Avatar
                user={application.applicant as any}
                name={application.applicant?.displayName || application.applicant?.username || 'Candidato'}
                size={40}
              />
            ) : (
              <Avatar
                user={application.targetUser as any}
                name={application.targetUser?.displayName || application.targetUser?.username || 'Contratante'}
                size={40}
              />
            )}
            <div>
              <h2 className="text-base font-bold text-txt-primary flex items-center gap-2">
                {isRecipient ? (application.applicant?.displayName || application.applicant?.username) : 'Proposta de Contratação'}
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    isUnlocked
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : isPending
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                  }`}
                >
                  {isUnlocked ? 'Chat Liberado' : isPending ? 'Pendente' : isRejected ? 'Recusado' : 'Retirado'}
                </span>
              </h2>
              <span className="text-xs text-txt-tertiary">
                Referente a: <strong className="text-txt-secondary">{activeOpportunity?.title || application.opportunity?.title || 'Oportunidade'}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          {isUnlocked && (
            <button
              onClick={() => setShowNegotiationForm(!showNegotiationForm)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary border border-accent-primary/30 transition-colors flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              Negociar Termos
            </button>
          )}

          {onOpenReport && (
            <button
              onClick={() => onOpenReport(application.id)}
              className="p-2 rounded-lg text-txt-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Denunciar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Proposal Summary Details Banner */}
      <div className="px-6 py-3 bg-surface-card border-b border-border-card text-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-txt-secondary">
          {application.proposedPrice && (
            <div>
              <span className="text-txt-muted">Valor Proposto: </span>
              <strong className="text-accent-primary font-bold">{f.formatCurrency(application.proposedPrice)}</strong>
            </div>
          )}
          {application.proposedDuration && (
            <div>
              <span className="text-txt-muted">Prazo: </span>
              <strong className="text-txt-primary">{application.proposedDuration}</strong>
            </div>
          )}
          {application.packageTier && (
            <div>
              <span className="text-txt-muted">Pacote: </span>
              <span className="uppercase font-semibold text-txt-primary">{application.packageTier}</span>
            </div>
          )}
          {application.resumeUrl && (
            <a
              href={application.resumeUrl}
              target="_blank"
              rel="noreferrer"
              className="text-accent-primary hover:underline flex items-center gap-1 font-semibold"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              {application.resumeName || 'Ver Currículo / Anexo'}
            </a>
          )}
        </div>

        {/* If pending and recipient: Quick Accept / Reject */}
        {isPending && isRecipient && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => acceptApplication(application.id)}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors flex items-center gap-1"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Aceitar Chat
            </button>
            <button
              onClick={() => rejectApplication(application.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              Recusar
            </button>
          </div>
        )}

        {isPending && isApplicant && (
          <button
            onClick={() => withdrawApplication(application.id)}
            className="text-xs text-txt-muted hover:text-rose-400 underline transition-colors"
          >
            Retirar Proposta
          </button>
        )}
      </div>

      {/* Main Messages & Negotiations Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Applicant Profile Card summary (if recipient) */}
        {isRecipient && activeApplicantProfile && (
          <div className="p-4 bg-surface-card/70 border border-border-card rounded-xl text-xs space-y-2">
            <span className="font-bold text-txt-tertiary uppercase tracking-wider block text-[10px]">
              Perfil do Candidato
            </span>
            <div className="font-semibold text-txt-primary text-sm">
              {activeApplicantProfile.headline || 'Profissional Nuvio'}
            </div>
            {activeApplicantProfile.bio && (
              <p className="text-txt-secondary text-[12px] leading-relaxed">{activeApplicantProfile.bio}</p>
            )}
            {activeApplicantProfile.skills?.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {activeApplicantProfile.skills.map((s: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-surface-base text-txt-secondary border border-border-subtle text-[11px]">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Initial Proposal Message / Cover Letter */}
        {application.message && (
          <div className="p-4 bg-surface-card border border-border-card rounded-xl text-xs space-y-2">
            <span className="font-bold text-txt-tertiary uppercase tracking-wider block text-[10px]">
              Mensagem da Proposta / Apresentação
            </span>
            <p className="text-txt-primary leading-relaxed whitespace-pre-wrap">
              {application.message}
            </p>
          </div>
        )}

        {/* Screening Questions & Answers (if job) */}
        {application.answers && application.answers.length > 0 && (
          <div className="p-4 bg-surface-card border border-border-card rounded-xl text-xs space-y-2">
            <span className="font-bold text-txt-tertiary uppercase tracking-wider block text-[10px]">
              Respostas do Candidato
            </span>
            {application.answers.map((ans, idx) => (
              <div key={idx} className="border-t border-border-subtle pt-2 first:border-0 first:pt-0">
                <span className="font-semibold text-txt-secondary block">{ans.question}</span>
                <p className="text-txt-primary mt-0.5">{ans.answer}</p>
              </div>
            ))}
          </div>
        )}

        {/* Negotiations cards */}
        {activeNegotiations.map((neg) => (
          <NegotiationCard
            key={neg.id}
            negotiation={neg}
            isReceiver={currentUser?.id === neg.receiverId}
            onAccept={acceptNegotiation}
            onDecline={declineNegotiation}
            onCounterOffer={(terms) => proposeNegotiation(terms)}
          />
        ))}

        {/* Message Thread */}
        {isMessagesLoading ? (
          <div className="flex justify-center py-8 text-txt-tertiary text-xs">Carregando conversa...</div>
        ) : (
          activeMessages.map((msg) => {
            const isMe = msg.senderId === currentUser?.id;
            const isSystem = msg.messageType === 'system';

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-3">
                  <div className="px-4 py-1.5 rounded-full bg-surface-card border border-border-card text-txt-tertiary text-[11px] font-medium text-center">
                    {msg.content}
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                <Avatar
                  user={msg.sender as any}
                  name={msg.sender?.displayName || msg.sender?.username || 'Usuário'}
                  size={32}
                />
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-sm ${
                  isMe
                    ? 'bg-accent-primary text-white rounded-tr-none'
                    : 'bg-surface-card border border-border-card text-txt-primary rounded-tl-none'
                }`}>
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <span className={`block text-[10px] mt-1 ${isMe ? 'text-white/70 text-right' : 'text-txt-muted'}`}>
                    {f.formatTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Negotiation Builder Form Modal */}
      {showNegotiationForm && (
        <div className="p-4 bg-surface-card border-t border-border-card text-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-txt-primary">Propor Novos Termos de Contratação</span>
            <button
              onClick={() => setShowNegotiationForm(false)}
              className="text-txt-muted hover:text-txt-primary text-xs"
            >
              Cancelar
            </button>
          </div>
          <form onSubmit={handleCreateNegotiation} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-txt-secondary mb-1">Valor (R$)</label>
              <input
                type="number"
                value={negPrice}
                onChange={(e) => setNegPrice(e.target.value)}
                placeholder="Ex: 1200"
                className="w-full px-3 py-2 bg-surface-base border border-border-card rounded-lg text-txt-primary focus:outline-none focus:border-accent-primary text-xs"
              />
            </div>
            <div>
              <label className="block text-txt-secondary mb-1">Prazo</label>
              <input
                type="text"
                value={negDeadline}
                onChange={(e) => setNegDeadline(e.target.value)}
                placeholder="Ex: 5 dias"
                className="w-full px-3 py-2 bg-surface-base border border-border-card rounded-lg text-txt-primary focus:outline-none focus:border-accent-primary text-xs"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-txt-secondary mb-1">Entregáveis ou Escopo</label>
              <textarea
                value={negDeliverables}
                onChange={(e) => setNegDeliverables(e.target.value)}
                rows={2}
                placeholder="Descrição dos serviços e arquivos a serem entregues..."
                className="w-full px-3 py-2 bg-surface-base border border-border-card rounded-lg text-txt-primary focus:outline-none focus:border-accent-primary text-xs resize-none"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg font-bold bg-accent-primary hover:bg-accent-primary-hover text-white transition-colors text-xs"
              >
                Enviar Termos de Negociação
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bottom Area: Input or Lock Notice */}
      <div className="p-4 border-t border-border-card bg-surface-card">
        {isUnlocked ? (
          <form onSubmit={handleSendMessage} className="flex items-center gap-3">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Digite uma mensagem profissional..."
              disabled={isSending}
              className="flex-1 px-4 py-2.5 bg-surface-base border border-border-card rounded-xl text-txt-primary placeholder:text-txt-muted text-xs focus:outline-none focus:border-accent-primary transition-all"
            />
            <button
              type="submit"
              disabled={isSending || !messageText.trim()}
              className="px-5 py-2.5 rounded-xl font-bold bg-accent-primary hover:bg-accent-primary-hover disabled:opacity-50 text-white text-xs transition-colors shadow-sm"
            >
              Enviar
            </button>
          </form>
        ) : (
          /* GATED LOCK NOTICE BANNER */
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center select-none">
            <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-xs mb-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Chat Profissional Bloqueado até Aprovação
            </div>
            <p className="text-[11px] text-txt-secondary max-w-lg mx-auto leading-relaxed">
              {isRecipient
                ? 'Para sua privacidade e segurança, o chat, envio de arquivos e chamadas permanecem bloqueados até que você aceite a proposta.'
                : 'Sua solicitação foi enviada e está aguardando análise do destinatário. O chat será liberado automaticamente após a aprovação.'}
            </p>

            {isRecipient && (
              <div className="flex items-center justify-center gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => acceptApplication(application.id)}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
                >
                  Aceitar Proposta & Liberar Chat
                </button>
                <button
                  type="button"
                  onClick={() => rejectApplication(application.id)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  Recusar Proposta
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
