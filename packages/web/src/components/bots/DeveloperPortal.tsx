import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBotStore } from '../../stores/botStore';
import { useAuthStore } from '../../stores/authStore';
import { resolveUploadUrl } from '../../utils/assetUrls';
import { useFormatters } from '../../i18n/formatters';
import type { Bot } from '@concord/shared';

export function DeveloperPortal() {
  const navigate = useNavigate();
  const fmt = useFormatters();
  const myBots = useBotStore((s) => s.myBots);
  const loadMyBots = useBotStore((s) => s.loadMyBots);
  const createBot = useBotStore((s) => s.createBot);
  const regenerateToken = useBotStore((s) => s.regenerateToken);
  const submitForReview = useBotStore((s) => s.submitForReview);
  const getStats = useBotStore((s) => s.getStats);
  const categories = useBotStore((s) => s.categories);
  const loadCategories = useBotStore((s) => s.loadCategories);

  const currentUser = useAuthStore((s) => s.user);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [revealedTokens, setRevealedTokens] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New bot form
  const [newName, setNewName] = useState('');
  const [newTagline, setNewTagline] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('utilidades');
  const [newPrefix, setNewPrefix] = useState('/');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stats modal
  const [activeStatsBot, setActiveStatsBot] = useState<Bot | null>(null);
  const [statsData, setStatsData] = useState<any>(null);

  useEffect(() => {
    void loadMyBots();
    void loadCategories();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleReveal = (botId: string) => {
    setRevealedTokens((prev) => ({
      ...prev,
      [botId]: !prev[botId],
    }));
  };

  const handleRegenToken = async (botId: string) => {
    if (
      !window.confirm(
        'Tem certeza que deseja regenerar o token do bot? Qualquer aplicação externa deixará de funcionar até que o novo token seja atualizado.'
      )
    ) {
      return;
    }
    await regenerateToken(botId);
  };

  const handleSubmitReview = async (botId: string) => {
    const success = await submitForReview(botId);
    if (success) {
      alert('Bot enviado para análise da equipe com sucesso!');
    }
  };

  const handleOpenStats = async (bot: Bot) => {
    setActiveStatsBot(bot);
    const data = await getStats(bot.id);
    setStatsData(data);
  };

  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsSubmitting(true);
    try {
      const created = await createBot({
        name: newName.trim(),
        tagline: newTagline.trim(),
        description: newDescription.trim(),
        categories: [newCategory],
        prefix: newPrefix.trim() || '/',
      });
      setCreateModalOpen(false);
      setNewName('');
      setNewTagline('');
      setNewDescription('');
      navigate(`/store/bots/editor/${created.id}`);
    } catch (err: any) {
      alert(err?.message || 'Erro ao criar bot');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-chat overflow-y-auto no-scrollbar text-txt-primary">
      {/* Top Header */}
      <div className="relative overflow-hidden bg-gradient-to-b from-purple-950/40 via-surface-panel to-surface-chat border-b border-white/10 px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-accent-primary uppercase tracking-wider">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m18 16 4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16" />
              </svg>
              Nuvio Developer Portal
            </div>
            <h1 className="text-3xl font-extrabold text-white">Suas Aplicações & Bots</h1>
            <p className="text-sm text-txt-secondary max-w-xl">
              Gerencie suas credenciais de API, tokens de autenticação, comandos e páginas personalizadas de catálogo.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/store/bots')}
              className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-txt-secondary hover:text-white text-xs font-semibold transition-all border border-white/10"
            >
              Explorar Catálogo
            </button>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold transition-all shadow-lg"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5v14" />
              </svg>
              Nova Aplicação
            </button>
          </div>
        </div>
      </div>

      {/* Main List */}
      <div className="max-w-6xl mx-auto w-full px-6 py-8 space-y-6 flex-1">
        {myBots.length === 0 ? (
          <div className="text-center py-20 px-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.01] space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-accent-primary/10 border border-accent-primary/20 text-accent-primary mx-auto flex items-center justify-center text-3xl shadow-lg">
              🤖
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">Nenhum bot cadastrado</h3>
              <p className="text-sm text-txt-muted max-w-sm mx-auto">
                Crie seu primeiro bot para receber um token de API e integrá-lo aos espaços do Nuvio.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="px-6 py-2.5 rounded-xl bg-accent-primary text-white font-semibold text-xs transition-colors shadow-md"
            >
              Criar Primeiro Bot
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {myBots.map((bot) => {
              const isRevealed = Boolean(revealedTokens[bot.id]);
              return (
                <div
                  key={bot.id}
                  className="p-6 rounded-2xl bg-surface-panel/70 border border-white/10 shadow-xl space-y-6 backdrop-blur-xl"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-surface-chat border border-white/10 overflow-hidden flex items-center justify-center font-bold text-xl shadow-md">
                        {bot.avatar ? (
                          <img
                            src={resolveUploadUrl(bot.avatar) ?? undefined}
                            alt={bot.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          '🤖'
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-white">{bot.name}</h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              bot.status === 'published' || bot.status === 'approved'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : bot.status === 'pending_review'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-white/5 text-txt-muted border-white/10'
                            }`}
                          >
                            {bot.status === 'published'
                              ? 'Publicado'
                              : bot.status === 'pending_review'
                              ? 'Em Revisão'
                              : bot.status === 'approved'
                              ? 'Aprovado'
                              : 'Rascunho'}
                          </span>
                          {bot.isVerified && (
                            <span className="text-accent-primary" title="Verificado">
                              ✓
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-txt-muted mt-0.5">
                          ID: <code className="font-mono text-txt-secondary">{bot.id}</code> • Prefixo:{' '}
                          <code className="font-mono text-accent-primary">{bot.prefix || '/'}</code>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => handleOpenStats(bot)}
                        className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-txt-secondary hover:text-white text-xs font-semibold transition-colors border border-white/5"
                      >
                        Estatísticas
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/store/bots/editor/${bot.id}`)}
                        className="px-3.5 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-semibold transition-colors border border-white/10"
                      >
                        Editar Página
                      </button>
                      {bot.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => handleSubmitReview(bot.id)}
                          className="px-4 py-1.5 rounded-xl bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-semibold transition-colors shadow-sm"
                        >
                          Enviar p/ Aprovação
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Token & Secrets Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-surface-chat/60 border border-white/5 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-txt-muted">
                        <span>Token do Bot (Nuvio Bot API)</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleReveal(bot.id)}
                            className="text-accent-primary hover:underline"
                          >
                            {isRevealed ? 'Ocultar' : 'Revelar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRegenToken(bot.id)}
                            className="text-red-400 hover:underline"
                          >
                            Regenerar
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type={isRevealed ? 'text' : 'password'}
                          readOnly
                          value={bot.botToken || 'nbot_token_not_available'}
                          className="flex-1 font-mono text-xs bg-black/40 border border-white/5 px-3 py-2 rounded-lg text-txt-secondary select-all"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopy(bot.botToken || '', bot.id)}
                          className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-colors border border-white/10"
                        >
                          {copiedId === bot.id ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                      <p className="text-[11px] text-txt-muted">
                        Use este token no header <code>Authorization: Bot &lt;token&gt;</code> para enviar mensagens via API.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-surface-chat/60 border border-white/5 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-txt-muted">
                        <span>Segredo de Webhook (Assinatura HMAC)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="password"
                          readOnly
                          value={bot.webhookSecret || 'whsec_secret_key'}
                          className="flex-1 font-mono text-xs bg-black/40 border border-white/5 px-3 py-2 rounded-lg text-txt-secondary select-all"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopy(bot.webhookSecret || '', `wh_${bot.id}`)}
                          className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-colors border border-white/10"
                        >
                          {copiedId === `wh_${bot.id}` ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                      <p className="text-[11px] text-txt-muted">
                        Assinatura utilizada para validar payloads enviados para a URL do seu webhook.
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Bot Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-surface-panel border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-lg font-bold text-white">Criar Nova Aplicação / Bot</h2>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="text-txt-muted hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBot} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-txt-secondary mb-1">Nome do Bot</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Nuvio Sentinel, Welcome Bot..."
                  className="w-full p-3 rounded-xl bg-surface-chat border border-white/10 text-white text-sm focus:outline-none focus:border-accent-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-txt-secondary mb-1">Slogan / Frase Curta</label>
                <input
                  type="text"
                  value={newTagline}
                  onChange={(e) => setNewTagline(e.target.value)}
                  placeholder="Ex: Moderação automática e segurança para o seu espaço"
                  className="w-full p-3 rounded-xl bg-surface-chat border border-white/10 text-white text-xs focus:outline-none focus:border-accent-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-txt-secondary mb-1">Categoria Principal</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full p-3 rounded-xl bg-surface-chat border border-white/10 text-white text-xs focus:outline-none focus:border-accent-primary"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-txt-secondary mb-1">Prefixo de Comandos</label>
                <input
                  type="text"
                  value={newPrefix}
                  onChange={(e) => setNewPrefix(e.target.value)}
                  placeholder="/"
                  className="w-full p-3 rounded-xl bg-surface-chat border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-accent-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-txt-secondary mb-1">Descrição</label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Descreva o propósito e as funções do bot..."
                  className="w-full p-3 rounded-xl bg-surface-chat border border-white/10 text-white text-xs focus:outline-none focus:border-accent-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-txt-muted hover:text-white font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newName.trim()}
                  className="px-5 py-2 rounded-xl bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-50 text-white font-bold transition-all shadow-md"
                >
                  {isSubmitting ? 'Criando...' : 'Criar Aplicação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {activeStatsBot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg bg-surface-panel border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-lg font-bold text-white">
                Estatísticas: {activeStatsBot.name}
              </h2>
              <button
                type="button"
                onClick={() => setActiveStatsBot(null)}
                className="text-txt-muted hover:text-white"
              >
                ✕
              </button>
            </div>

            {statsData ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                    <div className="text-txt-muted">Instalações</div>
                    <div className="text-lg font-bold text-white mt-1">
                      {statsData.installCount}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                    <div className="text-txt-muted">Avaliação</div>
                    <div className="text-lg font-bold text-amber-400 mt-1">
                      ★ {statsData.ratingAverage?.toFixed(1) || '5.0'}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                    <div className="text-txt-muted">Avaliações</div>
                    <div className="text-lg font-bold text-white mt-1">
                      {statsData.ratingCount}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-white mb-2">Espaços Ativos</h4>
                  {statsData.activeInstallations && statsData.activeInstallations.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {statsData.activeInstallations.map((inst: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5"
                        >
                          <div className="font-semibold text-white">
                            {inst.spaceName || 'Espaço Nuvio'}
                          </div>
                          <div className="text-txt-muted">
                            Instalado em {fmt.formatNumericDate(inst.installedAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-txt-muted text-center py-4">
                      Ainda não instalado em nenhum espaço.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-txt-muted">Carregando métricas...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
