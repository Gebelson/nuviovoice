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
    <div className="flex flex-col h-full bg-surface-chat">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-hard bg-surface-panel/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-xl text-txt-secondary hover:text-white hover:bg-white/5 transition-colors"
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
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {isRecipient ? (application.applicant?.displayName || application.applicant?.username) : 'Proposta de Contratação'}
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                    isUnlocked
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                      : isPending
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                      : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25'
                  }`}
                >
                  {isUnlocked ? 'Chat Liberado' : isPending ? 'Pendente' : isRejected ? 'Recusado' : 'Retirado'}
                </span>
              </h2>
              <p className="text-xs text-txt-secondary">
                {application.opportunity?.title || 'Oportunidade'} • {f.formatDateTime(application.createdAt)}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isUnlocked && (
            <button
              type="button"
              onClick={() => setShowNegotiationForm(!showNegotiationForm)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-accent-primary/15 text-accent-primary border border-accent-primary/25 hover:bg-accent-primary/25 transition-colors flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v8" />
                <path d="M8 12h8" />
              </svg>
              <span>Propor Termos</span>
            </button>
          )}

          {isApplicant && isPending && (
            <button
              type="button"
              onClick={() => withdrawApplication(application.id)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              Retirar Candidatura
            </button>
          )}

          {onOpenReport && (
            <button
              type="button"
              onClick={() => onOpenReport(application.id)}
              className="p-2 rounded-xl text-txt-tertiary hover:text-txt-secondary hover:bg-white/5 transition-colors"
              title="Denunciar proposta"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Main Conversation Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Initial Proposal Presentation Card */}
        <div className="p-5 rounded-2xl bg-surface-panel/90 border border-border-hard shadow-xl space-y-3.5">
          <div className="flex items-center justify-between border-b border-border-hard pb-3">
            <span className="text-xs font-bold text-txt-secondary uppercase tracking-wider flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Carta de Apresentação / Proposta Inicial
            </span>
            <span className="text-xs text-txt-tertiary font-medium">{f.formatDateTime(application.createdAt)}</span>
          </div>

          <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">
            {application.message}
          </p>

          {/* Proposal Terms Meta (Price, Duration, Selected Package) */}
          <div className="flex flex-wrap gap-3 pt-2 text-xs">
            {application.proposedPrice && (
              <div className="p-2.5 rounded-xl bg-surface-channel border border-border-hard">
                <span className="text-txt-tertiary text-[10px] uppercase font-bold tracking-wider block">Valor Proposto</span>
                <span className="text-sm font-extrabold text-accent-primary">
                  {f.formatCurrency(application.proposedPrice)}
                </span>
              </div>
            )}
            {application.proposedDuration && (
              <div className="p-2.5 rounded-xl bg-surface-channel border border-border-hard">
                <span className="text-txt-tertiary text-[10px] uppercase font-bold tracking-wider block">Prazo Estimado</span>
                <span className="text-xs font-bold text-white">{application.proposedDuration}</span>
              </div>
            )}
            {application.packageTier && (
              <div className="p-2.5 rounded-xl bg-surface-channel border border-border-hard">
                <span className="text-txt-tertiary text-[10px] uppercase font-bold tracking-wider block">Pacote Escolhido</span>
                <span className="text-xs font-bold text-accent-primary uppercase">{application.packageTier}</span>
              </div>
            )}
          </div>

          {/* Attachments / Resume / Portfolio */}
          {(application.resumeUrl || (application.portfolioUrls && application.portfolioUrls.length > 0)) && (
            <div className="pt-3 border-t border-border-hard space-y-2">
              <span className="text-xs font-semibold text-txt-secondary block">Anexos e Portfólio:</span>
              <div className="flex flex-wrap gap-2">
                {application.resumeUrl && (
                  <a
                    href={application.resumeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 rounded-xl bg-surface-channel hover:bg-surface-elevated border border-border-hard text-xs font-semibold text-white flex items-center gap-2 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span>{application.resumeName || 'Currículo Anexo'}</span>
                  </a>
                )}
                {application.portfolioUrls?.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 rounded-xl bg-surface-channel hover:bg-surface-elevated border border-border-hard text-xs font-semibold text-accent-primary flex items-center gap-2 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    <span>Portfólio #{i + 1}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Screening Question Answers */}
          {application.answers && application.answers.length > 0 && (
            <div className="pt-3 border-t border-border-hard space-y-2">
              <span className="text-xs font-semibold text-txt-secondary block">Respostas às Perguntas:</span>
              <div className="space-y-2">
                {application.answers.map((ans, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-surface-channel border border-border-hard text-xs">
                    <span className="font-semibold text-txt-secondary block mb-1">{ans.question}</span>
                    <span className="text-white">{ans.answer}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Negotiations Stream */}
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

        {/* Chat Messages */}
        {activeMessages.map((msg) => {
          const isMe = msg.senderId === currentUser?.id;
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} my-2 select-none`}
            >
              <div
                className={`max-w-[75%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                  isMe
                    ? 'bg-accent-primary text-white shadow-md shadow-accent-primary/20 rounded-tr-sm'
                    : 'bg-surface-panel/90 border border-border-hard text-white rounded-tl-sm'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <span
                  className={`text-[10px] mt-1 block text-right font-medium ${
                    isMe ? 'text-white/70' : 'text-txt-tertiary'
                  }`}
                >
                  {f.formatTime(msg.createdAt)}
                </span>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Negotiation Form Drawer */}
      {showNegotiationForm && (
        <div className="p-5 border-t border-border-hard bg-surface-panel/95 backdrop-blur-md">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Propor Novos Termos de Negociação</h4>
            <button
              type="button"
              onClick={() => setShowNegotiationForm(false)}
              className="text-xs text-txt-secondary hover:text-white"
            >
              Cancelar
            </button>
          </div>
          <form onSubmit={handleCreateNegotiation} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div>
              <label className="block text-txt-secondary font-medium mb-1">Valor (R$)</label>
              <input
                type="number"
                value={negPrice}
                onChange={(e) => setNegPrice(e.target.value)}
                placeholder="Ex: 1200"
                className="w-full px-3.5 py-2 bg-surface-channel border border-border-hard rounded-xl text-white text-xs focus:outline-none focus:border-accent-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-txt-secondary font-medium mb-1">Prazo</label>
              <input
                type="text"
                value={negDeadline}
                onChange={(e) => setNegDeadline(e.target.value)}
                placeholder="Ex: 5 dias"
                className="w-full px-3.5 py-2 bg-surface-channel border border-border-hard rounded-xl text-white text-xs focus:outline-none focus:border-accent-primary transition-all"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-txt-secondary font-medium mb-1">Entregáveis ou Escopo</label>
              <textarea
                value={negDeliverables}
                onChange={(e) => setNegDeliverables(e.target.value)}
                rows={2}
                placeholder="Descrição dos serviços e arquivos a serem entregues..."
                className="w-full px-3.5 py-2 bg-surface-channel border border-border-hard rounded-xl text-white text-xs focus:outline-none focus:border-accent-primary transition-all resize-none"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl font-bold bg-accent-primary hover:bg-accent-primary/90 text-white transition-all shadow-md shadow-accent-primary/20 text-xs"
              >
                Enviar Termos de Negociação
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bottom Area: Input or Lock Notice */}
      <div className="p-4 border-t border-border-hard bg-surface-panel/90 backdrop-blur-md">
        {isUnlocked ? (
          <form onSubmit={handleSendMessage} className="flex items-center gap-3">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Digite uma mensagem profissional..."
              disabled={isSending}
              className="flex-1 px-4 py-3 bg-surface-channel border border-border-hard rounded-xl text-white placeholder:text-txt-tertiary text-xs focus:outline-none focus:border-accent-primary transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={isSending || !messageText.trim()}
              className="px-6 py-3 rounded-xl font-bold bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-50 text-white text-xs transition-all shadow-md shadow-accent-primary/20"
            >
              Enviar
            </button>
          </form>
        ) : (
          /* GATED LOCK NOTICE BANNER */
          <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-center select-none shadow-sm">
            <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-xs mb-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Chat Profissional Bloqueado até Aprovação
            </div>
            <p className="text-xs text-txt-secondary max-w-lg mx-auto leading-relaxed">
              {isRecipient
                ? 'Para sua privacidade e segurança, o chat, envio de arquivos e chamadas permanecem bloqueados até que você aceite a proposta.'
                : 'Sua solicitação foi enviada e está aguardando análise do destinatário. O chat será liberado automaticamente após a aprovação.'}
            </p>

            {isRecipient && (
              <div className="flex items-center justify-center gap-3 mt-3.5">
                <button
                  type="button"
                  onClick={() => acceptApplication(application.id)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/25"
                >
                  Aceitar Proposta & Liberar Chat
                </button>
                <button
                  type="button"
                  onClick={() => rejectApplication(application.id)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
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
