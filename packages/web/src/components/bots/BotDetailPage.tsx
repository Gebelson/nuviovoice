import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBotStore } from '../../stores/botStore';
import { useAuthStore } from '../../stores/authStore';
import { resolveUploadUrl } from '../../utils/assetUrls';
import { VisualBlockRenderer } from '../store/VisualBlockRenderer';
import { BotInstallModal } from './BotInstallModal';
import { useFormatters } from '../../i18n/formatters';
import type { Bot, BotReview } from '@concord/shared';

export function BotDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const fmt = useFormatters();

  const loadBot = useBotStore((s) => s.loadBot);
  const loadReviews = useBotStore((s) => s.loadReviews);
  const postReview = useBotStore((s) => s.postReview);
  const currentUser = useAuthStore((s) => s.user);

  const [bot, setBot] = useState<Bot | null>(null);
  const [reviews, setReviews] = useState<BotReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'commands' | 'reviews' | 'layout'>('overview');

  const [installModalOpen, setInstallModalOpen] = useState(false);

  // Review form state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    void loadBot(slug).then(async (data) => {
      setBot(data);
      if (data) {
        const revs = await loadReviews(data.id);
        setReviews(revs);
      }
      setLoading(false);
    });
  }, [slug]);

  const handlePostReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bot) return;
    setSubmittingReview(true);
    setReviewMsg(null);

    const success = await postReview(bot.id, reviewRating, reviewComment);
    if (success) {
      setReviewMsg({ type: 'success', text: 'Avaliação enviada com sucesso!' });
      setReviewComment('');
      const updated = await loadReviews(bot.id);
      setReviews(updated);
    } else {
      setReviewMsg({
        type: 'error',
        text: 'Você só pode avaliar bots instalados em espaços que você participa.',
      });
    }
    setSubmittingReview(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-chat">
        <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-surface-chat text-txt-primary space-y-4">
        <div className="text-4xl">🤖</div>
        <h2 className="text-2xl font-bold text-white">Bot não encontrado</h2>
        <p className="text-sm text-txt-muted max-w-sm">
          O bot solicitado não existe ou foi removido da biblioteca.
        </p>
        <button
          type="button"
          onClick={() => navigate('/store/bots')}
          className="px-5 py-2.5 rounded-xl bg-accent-primary text-white font-semibold text-sm transition-colors shadow-md"
        >
          Voltar para a Biblioteca
        </button>
      </div>
    );
  }

  const hasLayoutBlocks = bot.layoutData && bot.layoutData.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-chat overflow-y-auto no-scrollbar text-txt-primary">
      {/* Panoramic Header Banner */}
      <div className="relative w-full h-64 md:h-80 bg-gradient-to-r from-accent-primary/30 via-indigo-900/40 to-surface-panel overflow-hidden">
        {bot.banner && (
          <img
            src={resolveUploadUrl(bot.banner) ?? undefined}
            alt={bot.name}
            className="w-full h-full object-cover opacity-60"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-chat via-surface-chat/40 to-transparent" />

        {/* Top Navigation */}
        <div className="absolute top-6 left-6 z-10">
          <button
            type="button"
            onClick={() => navigate('/store/bots')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-white text-xs font-semibold backdrop-blur-md transition-all shadow-lg"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Voltar para a Biblioteca
          </button>
        </div>
      </div>

      {/* Main Bot Profile Header (Overlapping Banner) */}
      <div className="max-w-6xl mx-auto w-full px-6 -mt-20 relative z-20 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pb-6 border-b border-white/10">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-surface-panel border-4 border-surface-chat overflow-hidden shadow-2xl flex items-center justify-center">
              {bot.avatar ? (
                <img
                  src={resolveUploadUrl(bot.avatar) ?? undefined}
                  alt={bot.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-5xl">🤖</span>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                  {bot.name}
                </h1>
                {bot.isVerified && (
                  <span
                    className="text-accent-primary"
                    title="Bot Verificado Oficial"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                  </span>
                )}
                {bot.isOfficial && (
                  <span className="px-2.5 py-0.5 rounded-full bg-accent-primary/20 text-accent-primary border border-accent-primary/30 text-xs font-bold uppercase tracking-wider">
                    Oficial Nuvio
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-txt-muted text-xs font-medium">
                  v{bot.version}
                </span>
              </div>

              <p className="text-sm text-txt-secondary max-w-xl">
                {bot.tagline || bot.description}
              </p>

              <div className="flex items-center gap-4 text-xs text-txt-muted pt-1">
                <span>
                  Criado por{' '}
                  <strong className="text-txt-primary">
                    {bot.developer?.displayName || bot.developer?.username || 'Nuvio'}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Prefixo:{' '}
                  <code className="text-accent-primary font-mono bg-white/5 px-1 py-0.5 rounded">
                    {bot.prefix || '/'}
                  </code>
                </span>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setInstallModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-accent-primary hover:bg-accent-primary/90 text-white font-bold text-sm shadow-xl transition-all"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M5 12h14M12 5v14" />
              </svg>
              Adicionar ao Espaço
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-surface-panel/60 border border-white/5 shadow-md flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-primary/10 border border-accent-primary/20 text-accent-primary flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <div className="text-xs text-txt-muted">Instalações</div>
              <div className="text-lg font-bold text-white">
                {bot.installCount}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface-panel/60 border border-white/5 shadow-md flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <span className="text-xl">★</span>
            </div>
            <div>
              <div className="text-xs text-txt-muted">Avaliação Média</div>
              <div className="text-lg font-bold text-white">
                {bot.ratingAverage?.toFixed(1) || '5.0'}{' '}
                <span className="text-xs text-txt-muted font-normal">
                  ({bot.ratingCount})
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface-panel/60 border border-white/5 shadow-md flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m18 16 4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16" />
              </svg>
            </div>
            <div>
              <div className="text-xs text-txt-muted">Comandos</div>
              <div className="text-lg font-bold text-white">
                {bot.commands?.length || 0}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface-panel/60 border border-white/5 shadow-md flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <div className="text-xs text-txt-muted">Status</div>
              <div className="text-lg font-bold text-emerald-400">
                Operacional
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-2 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'overview'
                ? 'border-accent-primary text-white'
                : 'border-transparent text-txt-muted hover:text-white'
            }`}
          >
            Visão Geral
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('commands')}
            className={`pb-3 px-2 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'commands'
                ? 'border-accent-primary text-white'
                : 'border-transparent text-txt-muted hover:text-white'
            }`}
          >
            Comandos ({bot.commands?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reviews')}
            className={`pb-3 px-2 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'reviews'
                ? 'border-accent-primary text-white'
                : 'border-transparent text-txt-muted hover:text-white'
            }`}
          >
            Avaliações ({reviews.length})
          </button>
          {hasLayoutBlocks && (
            <button
              type="button"
              onClick={() => setActiveTab('layout')}
              className={`pb-3 px-2 text-sm font-semibold border-b-2 transition-all ${
                activeTab === 'layout'
                  ? 'border-accent-primary text-white'
                  : 'border-transparent text-txt-muted hover:text-white'
              }`}
            >
              Apresentação Visual
            </button>
          )}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
            <div className="lg:col-span-2 space-y-6">
              <div className="p-6 rounded-2xl bg-surface-panel/60 border border-white/5 space-y-4">
                <h2 className="text-lg font-bold text-white">Sobre o Bot</h2>
                <div className="text-sm text-txt-secondary leading-relaxed whitespace-pre-wrap">
                  {bot.description || 'Nenhuma descrição detalhada disponível.'}
                </div>
              </div>

              {/* Requested Permissions */}
              <div className="p-6 rounded-2xl bg-surface-panel/60 border border-white/5 space-y-4">
                <h2 className="text-lg font-bold text-white">
                  Permissões Necessárias
                </h2>
                <p className="text-xs text-txt-muted">
                  Ao instalar este bot, as seguintes permissões serão solicitadas
                  para garantir o correto funcionamento dos comandos:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(bot.requiredPermissions && bot.requiredPermissions.length > 0
                    ? bot.requiredPermissions
                    : ['VIEW_CHANNEL', 'SEND_MESSAGES']
                  ).map((perm, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-2 text-xs"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-emerald-400"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      <span className="font-semibold text-white">{perm}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar info */}
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-surface-panel/60 border border-white/5 space-y-4 text-xs">
                <h3 className="font-bold text-white text-sm">Informações</h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-txt-muted">Categoria</span>
                    <span className="font-semibold text-white capitalize">
                      {bot.categories?.[0] || 'Utilidades'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-txt-muted">Versão</span>
                    <span className="font-semibold text-white">
                      {bot.version}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-txt-muted">Prefixo padrão</span>
                    <span className="font-mono text-accent-primary">
                      {bot.prefix || '/'}
                    </span>
                  </div>
                </div>

                {/* External links */}
                <div className="pt-2 space-y-2">
                  {bot.websiteUrl && (
                    <a
                      href={bot.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white font-medium transition-colors"
                    >
                      <span>Website Oficial</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                  )}
                  {bot.supportUrl && (
                    <a
                      href={bot.supportUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white font-medium transition-colors"
                    >
                      <span>Servidor de Suporte</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                  )}
                  {bot.privacyPolicyUrl && (
                    <a
                      href={bot.privacyPolicyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white font-medium transition-colors"
                    >
                      <span>Política de Privacidade</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: COMMANDS */}
        {activeTab === 'commands' && (
          <div className="space-y-4 pb-12">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-txt-muted flex items-center gap-2">
              <span className="text-accent-primary font-bold">Dica:</span>
              <span>
                Você pode executar comandos diretamente em qualquer canal onde o
                bot está instalado digitando a barra{' '}
                <code className="text-white font-mono bg-white/10 px-1 py-0.5 rounded">
                  /
                </code>
                .
              </span>
            </div>

            {bot.commands && bot.commands.length > 0 ? (
              <div className="space-y-3">
                {bot.commands.map((cmd, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-surface-panel/60 border border-white/5 space-y-2 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <code className="text-accent-primary font-bold font-mono text-sm bg-accent-primary/10 px-2.5 py-1 rounded-lg border border-accent-primary/20">
                          /{cmd.name}
                        </code>
                        {cmd.usage && (
                          <span className="text-xs text-txt-muted font-mono">
                            {cmd.usage}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-txt-secondary leading-relaxed">
                      {cmd.description}
                    </p>
                    {cmd.options && cmd.options.length > 0 && (
                      <div className="pt-2 pl-2 border-l-2 border-white/10 space-y-1">
                        <div className="text-[11px] font-semibold text-txt-muted">
                          Parâmetros:
                        </div>
                        {cmd.options.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className="text-xs flex items-center gap-2 text-txt-muted"
                          >
                            <span className="font-mono text-white">
                              {opt.name}
                            </span>
                            <span>—</span>
                            <span>{opt.description}</span>
                            {opt.required && (
                              <span className="text-red-400 text-[10px]">
                                (obrigatório)
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-txt-muted text-sm">
                Nenhum comando configurado para este bot.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: REVIEWS */}
        {activeTab === 'reviews' && (
          <div className="space-y-6 pb-12">
            {/* Review Form */}
            <form
              onSubmit={handlePostReview}
              className="p-6 rounded-2xl bg-surface-panel/60 border border-white/5 space-y-4"
            >
              <h3 className="text-base font-bold text-white">
                Avaliar {bot.name}
              </h3>
              <p className="text-xs text-txt-muted">
                Compartilhe sua experiência com a comunidade. Apenas membros de
                espaços onde o bot está instalado podem enviar avaliações.
              </p>

              {reviewMsg && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    reviewMsg.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}
                >
                  {reviewMsg.text}
                </div>
              )}

              {/* Star selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-txt-muted">Nota:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className={`text-xl transition-transform hover:scale-110 ${
                        star <= reviewRating
                          ? 'text-amber-400'
                          : 'text-white/20'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Escreva sua avaliação detalhada sobre a estabilidade, recursos e usabilidade do bot..."
                rows={3}
                className="w-full p-3.5 rounded-xl bg-surface-chat border border-white/10 text-white placeholder:text-txt-muted text-xs focus:outline-none focus:border-accent-primary"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="px-5 py-2 rounded-xl bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-md flex items-center gap-2"
                >
                  {submittingReview ? 'Enviando...' : 'Publicar Avaliação'}
                </button>
              </div>
            </form>

            {/* Reviews List */}
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white">
                Avaliações da Comunidade ({reviews.length})
              </h3>
              {reviews.length === 0 ? (
                <div className="p-8 text-center text-xs text-txt-muted rounded-xl bg-white/[0.01] border border-white/5">
                  Nenhuma avaliação registrada ainda. Seja o primeiro a avaliar!
                </div>
              ) : (
                reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-4 rounded-xl bg-surface-panel/50 border border-white/5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-surface-chat border border-white/10 overflow-hidden flex items-center justify-center font-bold text-xs">
                          {rev.user?.avatar ? (
                            <img
                              src={resolveUploadUrl(rev.user.avatar) ?? undefined}
                              alt={rev.user.username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            rev.user?.username?.slice(0, 2).toUpperCase() || 'U'
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-white">
                            {rev.user?.displayName || rev.user?.username || 'Usuário'}
                          </div>
                          <div className="text-[10px] text-txt-muted">
                            {fmt.formatNumericDate(rev.createdAt)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center text-amber-400 text-xs">
                        {Array.from({ length: rev.rating }).map((_, i) => (
                          <span key={i}>★</span>
                        ))}
                      </div>
                    </div>
                    {rev.comment && (
                      <p className="text-xs text-txt-secondary leading-relaxed pl-10">
                        {rev.comment}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: VISUAL LAYOUT BLOCKS */}
        {activeTab === 'layout' && hasLayoutBlocks && (
          <div className="py-6 pb-16">
            <VisualBlockRenderer
              blocks={bot.layoutData}
              onCtaClick={() => setInstallModalOpen(true)}
            />
          </div>
        )}
      </div>

      {/* Install Modal */}
      {installModalOpen && (
        <BotInstallModal
          bot={bot}
          onClose={() => setInstallModalOpen(false)}
        />
      )}
    </div>
  );
}
