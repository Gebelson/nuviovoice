import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useStoreStore } from '../../stores/storeStore';
import { useBotStore } from '../../stores/botStore';
import { useFormatters } from '../../i18n/formatters';
import { resolveUploadUrl } from '../../utils/assetUrls';
import { VisualBlockRenderer } from './VisualBlockRenderer';
import type { ProductRevision, ProductReport } from '../../types/store';
import type { Bot } from '@concord/shared';

export function StoreAdminQueue() {
  const { t } = useTranslation(['spaces', 'common']);
  const navigate = useNavigate();

  const adminQueue = useStoreStore((s) => s.adminQueue);
  const loadAdminQueue = useStoreStore((s) => s.loadAdminQueue);
  const reviewRevision = useStoreStore((s) => s.reviewRevision);
  const resolveReport = useStoreStore((s) => s.resolveReport);

  const botQueue = useBotStore((s) => s.adminQueue);
  const loadBotQueue = useBotStore((s) => s.loadAdminQueue);
  const adminReviewBot = useBotStore((s) => s.adminReview);
  const adminVerifyBot = useBotStore((s) => s.adminVerify);

  const [loading, setLoading] = useState(true);
  const [selectedRevision, setSelectedRevision] = useState<ProductRevision | null>(null);
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'revisions' | 'bots' | 'reports'>('revisions');
  const { formatMediumDate } = useFormatters();

  useEffect(() => {
    void init();
  }, []);

  const init = async () => {
    setLoading(true);
    await Promise.all([
      loadAdminQueue(),
      loadBotQueue(),
    ]);
    setLoading(false);
  };

  const handleReview = async (action: 'approve' | 'reject' | 'changes_requested') => {
    if (!selectedRevision) return;
    try {
      setProcessing(true);
      const ok = await reviewRevision(selectedRevision.id, action, reviewNotes);
      if (ok) {
        setSelectedRevision(null);
        setReviewNotes('');
        alert(`Ação de moderação "${action}" realizada com sucesso!`);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleBotReview = async (botId: string, action: 'published' | 'approved' | 'rejected' | 'changes_requested') => {
    try {
      setProcessing(true);
      const ok = await adminReviewBot(botId, action as any);
      if (ok) {
        setSelectedBot(null);
        setReviewNotes('');
        alert(`Moderação de bot concluída com status "${action}"!`);
        await loadBotQueue();
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleBotVerify = async (bot: Bot) => {
    try {
      setProcessing(true);
      const ok = await adminVerifyBot(bot.id, !bot.isVerified);
      if (ok) {
        await loadBotQueue();
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleReportAction = async (reportId: string, action: 'dismiss' | 'suspend_product') => {
    if (!confirm(`Confirmar ação "${action === 'dismiss' ? 'Descartar denúncia' : 'Suspender produto'}"?`)) return;
    await resolveReport(reportId, action);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-chat">
        <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const revisions = adminQueue?.revisions || [];
  const reports = adminQueue?.reports || [];

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-chat overflow-y-auto no-scrollbar">
      {/* Top Breadcrumb & Tabs */}
      <div className="px-6 py-4 border-b border-border-hard bg-surface-base flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => navigate('/store')}
            className="text-txt-tertiary hover:text-white transition-colors flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Loja
          </button>
          <span className="text-txt-tertiary">/</span>
          <span className="text-white font-semibold">Administração & Moderação</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('revisions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'revisions' ? 'bg-accent-primary text-white' : 'bg-surface-panel text-txt-secondary hover:text-white'
            }`}
          >
            Produtos Pendentes ({revisions.length})
          </button>
          <button
            onClick={() => setActiveTab('bots')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'bots' ? 'bg-accent-primary text-white' : 'bg-surface-panel text-txt-secondary hover:text-white'
            }`}
          >
            Bots Pendentes ({botQueue.length})
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'reports' ? 'bg-accent-primary text-white' : 'bg-surface-panel text-txt-secondary hover:text-white'
            }`}
          >
            Denúncias ({reports.length})
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8 w-full flex-1">
        {activeTab === 'revisions' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white">Produtos Aguardando Aprovação</h1>
                <p className="text-xs text-txt-secondary mt-0.5">
                  Nenhum produto enviado por vendedores fica público sem aprovação da equipe.
                </p>
              </div>
            </div>

            {revisions.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-border-hard rounded-2xl p-8">
                <p className="text-sm text-txt-tertiary">Não há produtos pendentes de revisão no momento. Tudo limpo!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {revisions.map((rev) => (
                  <div
                    key={rev.id}
                    className="rounded-2xl border border-border-hard bg-surface-panel/40 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-16 h-16 rounded-xl bg-surface-base border border-border-hard overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {rev.thumbnail ? (
                          <img src={rev.thumbnail} alt={rev.title} className="w-full h-full object-cover" />
                        ) : (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-txt-tertiary">
                            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-base truncate">{rev.title}</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Versão {rev.version}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-txt-tertiary mt-1">
                          <span className="text-white font-medium">Vendedor: {rev.seller?.storeName}</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-semibold">{rev.currency} {rev.price}</span>
                          <span>•</span>
                          <span>{Array.isArray(rev.layoutData) ? rev.layoutData.length : 0} blocos visuais</span>
                        </div>
                        {rev.shortDescription && (
                          <p className="text-xs text-txt-secondary line-clamp-1 mt-1">{rev.shortDescription}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 w-full md:w-auto justify-end">
                      <button
                        onClick={() => setSelectedRevision(rev)}
                        className="px-4 py-2 rounded-xl bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold transition-transform active:scale-95"
                      >
                        Avaliar & Inspecionar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'bots' ? (
          /* Bots Queue Tab */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white">Bots Aguardando Aprovação</h1>
                <p className="text-xs text-txt-secondary mt-0.5">
                  Aplicações e integrações precisam de aprovação de permissões e segurança antes da listagem pública.
                </p>
              </div>
            </div>

            {botQueue.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-border-hard rounded-2xl p-8">
                <p className="text-sm text-txt-tertiary">Não há bots pendentes de aprovação no momento. Tudo limpo!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {botQueue.map((bot) => (
                  <div
                    key={bot.id}
                    className="rounded-2xl border border-border-hard bg-surface-panel/40 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-16 h-16 rounded-xl bg-surface-base border border-border-hard overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {bot.avatar ? (
                          <img src={resolveUploadUrl(bot.avatar) ?? undefined} alt={bot.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl">🤖</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-base truncate">{bot.name}</h3>
                          {bot.isVerified && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent-primary/20 text-accent-primary border border-accent-primary/30">
                              Verificado
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {bot.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-txt-tertiary mt-1">
                          <span className="text-white font-medium">Dev: @{bot.developer?.username || bot.developerId}</span>
                          <span>•</span>
                          <span>v{bot.version}</span>
                          <span>•</span>
                          <span>{bot.requiredPermissions?.length || 0} permissões</span>
                          <span>•</span>
                          <span>{bot.commands?.length || 0} comandos</span>
                        </div>
                        {bot.tagline && (
                          <p className="text-xs text-txt-secondary line-clamp-1 mt-1">{bot.tagline}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 w-full md:w-auto justify-end flex-wrap">
                      <button
                        onClick={() => handleToggleBotVerify(bot)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                          bot.isVerified
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                            : 'bg-surface-panel border-border-hard text-txt-secondary hover:text-white'
                        }`}
                      >
                        {bot.isVerified ? 'Remover Selo' : 'Dar Selo Verificado'}
                      </button>
                      <button
                        onClick={() => setSelectedBot(bot)}
                        className="px-4 py-2 rounded-xl bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold transition-transform active:scale-95"
                      >
                        Avaliar & Inspecionar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Reports Tab */
          <div className="space-y-4">
            <h1 className="text-xl font-bold text-white">Denúncias de Produtos</h1>
            {reports.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-border-hard rounded-2xl p-8">
                <p className="text-sm text-txt-tertiary">Nenhuma denúncia aberta pendente de resolução.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Motivo: {rep.reason}</span>
                        <span className="text-xs text-txt-tertiary">• Denunciado por @{rep.reporter?.username}</span>
                      </div>
                      <h3 className="font-bold text-white text-sm">Produto: {rep.product?.title}</h3>
                      {rep.details && <p className="text-xs text-txt-secondary mt-1">{rep.details}</p>}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReportAction(rep.id, 'dismiss')}
                        className="px-3 py-1.5 rounded-lg bg-surface-panel hover:bg-surface-channel text-xs font-semibold text-txt-secondary hover:text-white"
                      >
                        Descartar
                      </button>
                      <button
                        onClick={() => handleReportAction(rep.id, 'suspend_product')}
                        className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-bold text-white"
                      >
                        Suspender Produto
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* INSPECTION / REVIEW MODAL - PRODUCT */}
      {selectedRevision && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface-base border border-border-hard rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border-hard flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Inspeção de Revisão: {selectedRevision.title}</h2>
                <span className="text-xs text-txt-tertiary">Vendedor: {selectedRevision.seller?.storeName}</span>
              </div>
              <button onClick={() => setSelectedRevision(null)} className="text-txt-tertiary hover:text-white">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-surface-panel border border-border-hard text-xs">
                <div>
                  <span className="text-txt-tertiary block">Preço</span>
                  <span className="font-bold text-white">{selectedRevision.currency} {selectedRevision.price}</span>
                </div>
                <div>
                  <span className="text-txt-tertiary block">Versão</span>
                  <span className="font-bold text-white">Revisão #{selectedRevision.version}</span>
                </div>
                <div>
                  <span className="text-txt-tertiary block">Data de Envio</span>
                  <span className="font-bold text-white">{formatMediumDate(selectedRevision.submittedAt || Date.now())}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-txt-tertiary uppercase tracking-wider block mb-3">
                  Pré-visualização da Página Visual
                </span>
                <div className="p-6 rounded-2xl border border-border-hard bg-surface-chat">
                  {Array.isArray(selectedRevision.layoutData) && selectedRevision.layoutData.length > 0 ? (
                    <VisualBlockRenderer blocks={selectedRevision.layoutData} />
                  ) : (
                    <p className="text-xs text-txt-tertiary italic">Nenhum bloco visual configurado nesta revisão.</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs text-txt-tertiary block mb-1 font-medium">Notas / Justificativa da Moderação</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Informe orientações ao criador caso solicite ajustes ou rejeite o produto..."
                  rows={3}
                  className="w-full bg-surface-channel border border-border-hard rounded-xl p-3 text-xs text-white outline-none focus:border-accent-primary resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border-hard bg-surface-panel/50 flex items-center justify-between">
              <button
                onClick={() => setSelectedRevision(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-txt-secondary hover:text-white"
              >
                Fechar
              </button>

              <div className="flex items-center gap-2">
                <button
                  disabled={processing}
                  onClick={() => handleReview('reject')}
                  className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-bold border border-red-500/30 transition-colors disabled:opacity-50"
                >
                  Rejeitar
                </button>
                <button
                  disabled={processing}
                  onClick={() => handleReview('changes_requested')}
                  className="px-4 py-2 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-xs font-bold border border-blue-500/30 transition-colors disabled:opacity-50"
                >
                  Solicitar Ajustes
                </button>
                <button
                  disabled={processing}
                  onClick={() => handleReview('approve')}
                  className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition-transform active:scale-95 shadow-lg shadow-emerald-600/30 disabled:opacity-50"
                >
                  Aprovar & Publicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INSPECTION / REVIEW MODAL - BOT */}
      {selectedBot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface-base border border-border-hard rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border-hard flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-panel border border-border-hard overflow-hidden flex items-center justify-center">
                  {selectedBot.avatar ? (
                    <img src={resolveUploadUrl(selectedBot.avatar) ?? undefined} alt={selectedBot.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>🤖</span>
                  )}
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Inspeção de Bot: {selectedBot.name}</h2>
                  <span className="text-xs text-txt-tertiary">Desenvolvedor: @{selectedBot.developer?.username || selectedBot.developerId}</span>
                </div>
              </div>
              <button onClick={() => setSelectedBot(null)} className="text-txt-tertiary hover:text-white">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-surface-panel border border-border-hard text-xs">
                <div>
                  <span className="text-txt-tertiary block">Slug</span>
                  <span className="font-bold text-white">{selectedBot.slug}</span>
                </div>
                <div>
                  <span className="text-txt-tertiary block">Versão</span>
                  <span className="font-bold text-white">v{selectedBot.version}</span>
                </div>
                <div>
                  <span className="text-txt-tertiary block">Prefixo</span>
                  <span className="font-bold text-white">{selectedBot.prefix || '/'}</span>
                </div>
                <div>
                  <span className="text-txt-tertiary block">Status Atual</span>
                  <span className="font-bold text-amber-400">{selectedBot.status}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-txt-tertiary uppercase tracking-wider block mb-1">Descrição Curta</span>
                <p className="text-sm text-txt-secondary bg-surface-panel p-3 rounded-xl border border-border-hard">{selectedBot.tagline || 'Sem descrição curta informada.'}</p>
              </div>

              <div>
                <span className="text-xs font-bold text-txt-tertiary uppercase tracking-wider block mb-2">Permissões Solicitadas</span>
                {selectedBot.requiredPermissions && selectedBot.requiredPermissions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedBot.requiredPermissions.map((perm) => (
                      <span key={perm} className="px-2.5 py-1 rounded-lg bg-surface-channel border border-border-hard text-xs text-txt-secondary font-mono">
                        {perm}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-txt-tertiary italic">Nenhuma permissão especial solicitada.</p>
                )}
              </div>

              <div>
                <span className="text-xs font-bold text-txt-tertiary uppercase tracking-wider block mb-2">Comandos Registrados ({selectedBot.commands?.length || 0})</span>
                {selectedBot.commands && selectedBot.commands.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 no-scrollbar">
                    {selectedBot.commands.map((cmd) => (
                      <div key={cmd.name} className="p-2.5 rounded-xl bg-surface-channel border border-border-hard flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-accent-primary">/{cmd.name}</span>
                        <span className="text-txt-secondary">{cmd.description}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-txt-tertiary italic">Nenhum comando registrado.</p>
                )}
              </div>

              <div>
                <span className="text-xs font-bold text-txt-tertiary uppercase tracking-wider block mb-1">Descrição Completa</span>
                <div className="p-4 rounded-xl bg-surface-panel border border-border-hard text-xs text-txt-secondary whitespace-pre-wrap">
                  {selectedBot.description || 'Sem descrição detalhada.'}
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => navigate(`/store/bots/${selectedBot.slug || selectedBot.id}`)}
                  className="text-xs text-accent-primary hover:underline flex items-center gap-1 font-semibold"
                >
                  Abrir página pública do bot ↗
                </button>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border-hard bg-surface-panel/50 flex items-center justify-between">
              <button
                onClick={() => setSelectedBot(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-txt-secondary hover:text-white"
              >
                Fechar
              </button>

              <div className="flex items-center gap-2">
                <button
                  disabled={processing}
                  onClick={() => handleBotReview(selectedBot.id, 'rejected')}
                  className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-bold border border-red-500/30 transition-colors disabled:opacity-50"
                >
                  Rejeitar
                </button>
                <button
                  disabled={processing}
                  onClick={() => handleBotReview(selectedBot.id, 'changes_requested')}
                  className="px-4 py-2 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-xs font-bold border border-blue-500/30 transition-colors disabled:opacity-50"
                >
                  Solicitar Ajustes
                </button>
                <button
                  disabled={processing}
                  onClick={() => handleBotReview(selectedBot.id, 'published')}
                  className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition-transform active:scale-95 shadow-lg shadow-emerald-600/30 disabled:opacity-50"
                >
                  Aprovar & Publicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
