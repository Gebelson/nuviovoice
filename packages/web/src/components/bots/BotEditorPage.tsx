import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBotStore } from '../../stores/botStore';
import { VisualBlockRenderer } from '../store/VisualBlockRenderer';
import type { Bot, BotCommand } from '@concord/shared';
import type { VisualBlock } from '../../types/store';

export function BotEditorPage() {
  const { botId } = useParams<{ botId: string }>();
  const navigate = useNavigate();

  const loadBot = useBotStore((s) => s.loadBot);
  const updateBot = useBotStore((s) => s.updateBot);

  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'details' | 'commands' | 'blocks' | 'preview'>('details');

  // Form states
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('');
  const [banner, setBanner] = useState('');
  const [prefix, setPrefix] = useState('/');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [supportUrl, setSupportUrl] = useState('');
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [commands, setCommands] = useState<BotCommand[]>([]);
  const [blocks, setBlocks] = useState<VisualBlock[]>([]);

  useEffect(() => {
    if (!botId) return;
    setLoading(true);
    void loadBot(botId).then((data) => {
      if (data) {
        setBot(data);
        setName(data.name || '');
        setTagline(data.tagline || '');
        setDescription(data.description || '');
        setAvatar(data.avatar || '');
        setBanner(data.banner || '');
        setPrefix(data.prefix || '/');
        setWebsiteUrl(data.websiteUrl || '');
        setSupportUrl(data.supportUrl || '');
        setPrivacyPolicyUrl(data.privacyPolicyUrl || '');
        setWebhookUrl(data.webhookUrl || '');
        setCommands(data.commands || []);
        setBlocks(data.layoutData || []);
      }
      setLoading(false);
    });
  }, [botId]);

  const handleSave = async () => {
    if (!bot) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const updated = await updateBot(bot.id, {
        name,
        tagline,
        description,
        avatar: avatar || null,
        banner: banner || null,
        prefix,
        websiteUrl: websiteUrl || null,
        supportUrl: supportUrl || null,
        privacyPolicyUrl: privacyPolicyUrl || null,
        webhookUrl: webhookUrl || null,
        commands,
        layoutData: blocks,
      });
      setBot(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err?.message || 'Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCommand = () => {
    setCommands((prev) => [
      ...prev,
      {
        name: `comando${prev.length + 1}`,
        description: 'Descrição do novo comando',
        usage: `/${`comando${prev.length + 1}`}`,
      },
    ]);
  };

  const handleRemoveCommand = (idx: number) => {
    setCommands((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddBlock = (type: VisualBlock['type']) => {
    const newBlock: VisualBlock = {
      id: `block_${Date.now()}`,
      type,
      props:
        type === 'hero'
          ? {
              title: name || 'Destaques do Bot',
              subtitle: tagline || 'O melhor bot para o seu espaço no Nuvio',
              bgGradient: 'purple',
              badge: 'NOVIDADE',
            }
          : type === 'feature_grid'
          ? {
              title: 'Principais Funcionalidades',
              items: [
                { title: 'Moderação Automática', description: 'Proteja seus canais com regras inteligentes.' },
                { title: 'Alta Performance', description: 'Respostas instantâneas e sem lentidão.' },
                { title: 'Personalizável', description: 'Configure comandos de acordo com seu espaço.' },
              ],
            }
          : type === 'faq'
          ? {
              title: 'Perguntas Frequentes',
              items: [
                { question: 'Como convidar o bot?', answer: 'Clique no botão "Adicionar ao Espaço" na página de detalhes.' },
                { question: 'Quais permissões ele precisa?', answer: 'As permissões variam de acordo com os recursos utilizados.' },
              ],
            }
          : {
              content: 'Texto informativo sobre as capacidades deste bot.',
            },
    };
    setBlocks((prev) => [...prev, newBlock]);
  };

  const handleRemoveBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
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
      <div className="flex-1 flex items-center justify-center bg-surface-chat text-txt-muted text-sm">
        Bot não encontrado.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-chat overflow-hidden text-txt-primary">
      {/* Editor Top Bar */}
      <div className="h-14 px-6 border-b border-white/10 bg-surface-panel/80 backdrop-blur-xl flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/developers')}
            className="p-1.5 rounded-lg text-txt-muted hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">
              Editor de Apresentação: {name || bot.name}
            </h1>
            <p className="text-[10px] text-txt-muted">Personalize a página pública do bot na biblioteca</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="text-xs text-emerald-400 font-medium animate-fade-in">
              Salvo com sucesso!
            </span>
          )}
          <button
            type="button"
            onClick={() => window.open(`/store/bots/${bot.slug}`, '_blank')}
            className="px-3.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-txt-secondary hover:text-white text-xs font-semibold transition-colors"
          >
            Visualizar Página
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-5 py-1.5 rounded-xl bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2"
          >
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      {/* Editor Tabs */}
      <div className="flex items-center gap-4 px-6 border-b border-white/10 bg-surface-panel/40 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('details')}
          className={`py-2.5 border-b-2 transition-all ${
            activeTab === 'details' ? 'border-accent-primary text-white' : 'border-transparent text-txt-muted hover:text-white'
          }`}
        >
          Informações Básicas
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('commands')}
          className={`py-2.5 border-b-2 transition-all ${
            activeTab === 'commands' ? 'border-accent-primary text-white' : 'border-transparent text-txt-muted hover:text-white'
          }`}
        >
          Comandos ({commands.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('blocks')}
          className={`py-2.5 border-b-2 transition-all ${
            activeTab === 'blocks' ? 'border-accent-primary text-white' : 'border-transparent text-txt-muted hover:text-white'
          }`}
        >
          Blocos Visuais ({blocks.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`py-2.5 border-b-2 transition-all ${
            activeTab === 'preview' ? 'border-accent-primary text-white' : 'border-transparent text-txt-muted hover:text-white'
          }`}
        >
          Pré-visualização
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
        {/* DETAILS TAB */}
        {activeTab === 'details' && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-txt-secondary mb-1">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-3 rounded-xl bg-surface-panel border border-white/10 text-white text-sm focus:outline-none focus:border-accent-primary"
                />
              </div>
              <div>
                <label className="block font-semibold text-txt-secondary mb-1">Prefixo de Comandos</label>
                <input
                  type="text"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="w-full p-3 rounded-xl bg-surface-panel border border-white/10 text-white text-sm font-mono focus:outline-none focus:border-accent-primary"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-txt-secondary mb-1">Slogan / Frase Curta</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full p-3 rounded-xl bg-surface-panel border border-white/10 text-white focus:outline-none focus:border-accent-primary"
              />
            </div>

            <div>
              <label className="block font-semibold text-txt-secondary mb-1">Descrição Completa</label>
              <textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 rounded-xl bg-surface-panel border border-white/10 text-white focus:outline-none focus:border-accent-primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-txt-secondary mb-1">URL do Avatar</label>
                <input
                  type="text"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="https://..."
                  className="w-full p-3 rounded-xl bg-surface-panel border border-white/10 text-white focus:outline-none focus:border-accent-primary"
                />
              </div>
              <div>
                <label className="block font-semibold text-txt-secondary mb-1">URL do Banner</label>
                <input
                  type="text"
                  value={banner}
                  onChange={(e) => setBanner(e.target.value)}
                  placeholder="https://..."
                  className="w-full p-3 rounded-xl bg-surface-panel border border-white/10 text-white focus:outline-none focus:border-accent-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-txt-secondary mb-1">Website Oficial</label>
                <input
                  type="text"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full p-3 rounded-xl bg-surface-panel border border-white/10 text-white focus:outline-none focus:border-accent-primary"
                />
              </div>
              <div>
                <label className="block font-semibold text-txt-secondary mb-1">Servidor de Suporte</label>
                <input
                  type="text"
                  value={supportUrl}
                  onChange={(e) => setSupportUrl(e.target.value)}
                  placeholder="https://nuvio.app/..."
                  className="w-full p-3 rounded-xl bg-surface-panel border border-white/10 text-white focus:outline-none focus:border-accent-primary"
                />
              </div>
              <div>
                <label className="block font-semibold text-txt-secondary mb-1">Política de Privacidade</label>
                <input
                  type="text"
                  value={privacyPolicyUrl}
                  onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full p-3 rounded-xl bg-surface-panel border border-white/10 text-white focus:outline-none focus:border-accent-primary"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-txt-secondary mb-1">Webhook URL</label>
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://meuservidor.com/nuvio-webhook"
                className="w-full p-3 rounded-xl bg-surface-panel border border-white/10 text-white font-mono focus:outline-none focus:border-accent-primary"
              />
            </div>
          </div>
        )}

        {/* COMMANDS TAB */}
        {activeTab === 'commands' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Comandos da Aplicação</h3>
                <p className="text-xs text-txt-muted">Estes comandos serão exibidos na página e no menu / do chat</p>
              </div>
              <button
                type="button"
                onClick={handleAddCommand}
                className="px-3.5 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-semibold border border-white/10 flex items-center gap-1.5"
              >
                + Adicionar Comando
              </button>
            </div>

            <div className="space-y-3">
              {commands.map((cmd, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-surface-panel border border-white/10 space-y-3 relative group"
                >
                  <button
                    type="button"
                    onClick={() => handleRemoveCommand(idx)}
                    className="absolute top-3 right-3 text-txt-muted hover:text-red-400 p-1"
                  >
                    ✕
                  </button>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold text-txt-secondary mb-1">Nome do comando</label>
                      <input
                        type="text"
                        value={cmd.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCommands((prev) =>
                            prev.map((c, i) => (i === idx ? { ...c, name: val } : c))
                          );
                        }}
                        className="w-full p-2.5 rounded-lg bg-surface-chat border border-white/10 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-txt-secondary mb-1">Uso de exemplo</label>
                      <input
                        type="text"
                        value={cmd.usage || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCommands((prev) =>
                            prev.map((c, i) => (i === idx ? { ...c, usage: val } : c))
                          );
                        }}
                        placeholder={`/${cmd.name} [opções]`}
                        className="w-full p-2.5 rounded-lg bg-surface-chat border border-white/10 text-white font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-txt-secondary mb-1 text-xs">Descrição</label>
                    <input
                      type="text"
                      value={cmd.description}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCommands((prev) =>
                          prev.map((c, i) => (i === idx ? { ...c, description: val } : c))
                        );
                      }}
                      className="w-full p-2.5 rounded-lg bg-surface-chat border border-white/10 text-white text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BLOCKS TAB */}
        {activeTab === 'blocks' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Blocos da Página de Apresentação</h3>
                <p className="text-xs text-txt-muted">Adicione seções customizadas para enriquecer a apresentação do bot</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAddBlock('hero')}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-xs font-semibold"
                >
                  + Hero
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlock('feature_grid')}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-xs font-semibold"
                >
                  + Recursos
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlock('faq')}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-xs font-semibold"
                >
                  + FAQ
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {blocks.map((block) => (
                <div
                  key={block.id}
                  className="p-4 rounded-xl bg-surface-panel border border-white/10 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-lg bg-accent-primary/20 text-accent-primary font-bold text-xs uppercase">
                      {block.type}
                    </span>
                    <span className="text-xs text-white font-medium">
                      {block.props?.title || block.props?.content || 'Bloco Customizado'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveBlock(block.id)}
                    className="text-txt-muted hover:text-red-400 text-xs px-2 py-1"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PREVIEW TAB */}
        {activeTab === 'preview' && (
          <div className="space-y-4">
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreviewMode('desktop')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  previewMode === 'desktop' ? 'bg-accent-primary text-white' : 'bg-white/5 text-txt-muted'
                }`}
              >
                Desktop
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('mobile')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  previewMode === 'mobile' ? 'bg-accent-primary text-white' : 'bg-white/5 text-txt-muted'
                }`}
              >
                Mobile
              </button>
            </div>
            <div className="p-6 rounded-2xl bg-surface-chat border border-white/10 min-h-[400px]">
              <VisualBlockRenderer blocks={blocks} previewMode={previewMode} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
