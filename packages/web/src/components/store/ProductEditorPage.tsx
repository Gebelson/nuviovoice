import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { Product, ProductRevision, VisualBlock } from '../../types/store';
import { VisualBlockRenderer } from './VisualBlockRenderer';
import { useStoreStore } from '../../stores/storeStore';

const PRESET_TEMPLATES: Record<string, { name: string; blocks: VisualBlock[] }> = {
  gamer: {
    name: 'Gamer / Tech',
    blocks: [
      {
        id: 'hero-1',
        type: 'hero',
        props: {
          title: 'Domine Suas Partidas',
          subtitle: 'A ferramenta definitiva desenvolvida para comunidades competitivas e streamers.',
          badge: 'Edição Especial',
          align: 'center',
          bgGradient: 'purple',
          ctaText: 'Garantir Acesso',
          ctaLink: '#',
        },
      },
      {
        id: 'features-1',
        type: 'feature_grid',
        props: {
          title: 'Recursos Exclusivos',
          items: [
            { title: 'Ultra Performance', description: 'Otimização com baixa latência e resposta instantânea.', icon: 'Zap' },
            { title: 'Segurança Blindada', description: 'Proteção contra invasões e dados criptografados.', icon: 'Shield' },
            { title: 'Suporte 24/7', description: 'Time dedicado para tirar qualquer dúvida.', icon: 'Clock' },
          ],
        },
      },
      {
        id: 'faq-1',
        type: 'faq',
        props: {
          title: 'Dúvidas Frequentes',
          items: [
            { question: 'Como recebo o acesso?', answer: 'O envio é imediato após a confirmação da compra pelo Nuvio.' },
            { question: 'Funciona no Desktop e no Web?', answer: 'Sim, totalmente compatível com todas as versões do Nuvio.' },
          ],
        },
      },
    ],
  },
  digital: {
    name: 'Produto Digital & E-book',
    blocks: [
      {
        id: 'hero-1',
        type: 'hero',
        props: {
          title: 'Guia Definitivo do Criador',
          subtitle: 'Aprenda do zero as melhores práticas para construir servidores engajados e monetizados.',
          badge: 'Download Digital',
          align: 'left',
          bgGradient: 'blue',
          ctaText: 'Baixar Agora',
          ctaLink: '#',
        },
      },
      {
        id: 'specs-1',
        type: 'specs',
        props: {
          title: 'Detalhes do Material',
          items: [
            { label: 'Formato', value: 'PDF + Acesso à Comunidade VIP' },
            { label: 'Páginas', value: '140 páginas ilustradas' },
            { label: 'Idioma', value: 'Português' },
          ],
        },
      },
      {
        id: 'testimonials-1',
        type: 'testimonials',
        props: {
          title: 'Depoimentos de Leitores',
          items: [
            { author: 'Marcos Silva', role: 'Dono de Comunidade', quote: 'Mudou totalmente a retenção do meu espaço!', avatar: '' },
            { author: 'Camila Rocha', role: 'Streamer', quote: 'Direto ao ponto e com exemplos reais. Recomendo!', avatar: '' },
          ],
        },
      },
    ],
  },
  creative: {
    name: 'Design & Criativo',
    blocks: [
      {
        id: 'hero-1',
        type: 'hero',
        props: {
          title: 'Identidade Visual & Pacote de Emojis',
          subtitle: 'Eleve o padrão visual do seu servidor com ícones, insígnias e banners profissionais.',
          badge: 'Design Exclusivo',
          align: 'center',
          bgGradient: 'emerald',
          ctaText: 'Fazer Pedido',
          ctaLink: '#',
        },
      },
      {
        id: 'features-1',
        type: 'feature_grid',
        props: {
          title: 'O que está incluso',
          items: [
            { title: '50 Emojis Customizados', description: 'Arquivos em alta definição prontos para uso.', icon: 'Smile' },
            { title: 'Banners Animados', description: 'Banners nos padrões oficiais do Nuvio.', icon: 'Star' },
            { title: 'Cores Personalizadas', description: 'Paleta completa alinhada à sua marca.', icon: 'Zap' },
          ],
        },
      },
    ],
  },
};

export function ProductEditorPage() {
  const { t } = useTranslation(['spaces', 'common']);
  const navigate = useNavigate();
  const { productId } = useParams<{ productId: string }>();
  const categories = useStoreStore((s) => s.categories);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Product base metadata
  const [title, setTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [productType, setProductType] = useState<'digital' | 'physical' | 'service'>('digital');
  const [price, setPrice] = useState('0');
  const [currency, setCurrency] = useState('BRL');
  const [thumbnail, setThumbnail] = useState('');
  const [productStatus, setProductStatus] = useState('draft');
  const [revisionNotes, setRevisionNotes] = useState<string | null>(null);

  // Visual layout blocks
  const [blocks, setBlocks] = useState<VisualBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'blocks' | 'settings'>('blocks');
  const [isPreviewOnly, setIsPreviewOnly] = useState(false);

  useEffect(() => {
    if (!productId) return;
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const res = await api.store.getProductForEdit(productId!);
      const p = res.product;
      const rev = res.latestRevision;

      setTitle(p.title || '');
      setShortDescription(p.shortDescription || '');
      setCategoryId(p.categoryId || '');
      setProductType(p.productType || 'digital');
      setPrice(String(p.price || 0));
      setCurrency(p.currency || 'BRL');
      setThumbnail(p.thumbnail || '');
      setProductStatus(p.status);

      if (rev) {
        setBlocks(Array.isArray(rev.layoutData) ? rev.layoutData : []);
        setRevisionNotes(rev.reviewNotes || null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar produto para edição');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBlock = (type: VisualBlock['type']) => {
    const newId = `block-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    let initialProps: Record<string, any> = {};

    switch (type) {
      case 'hero':
        initialProps = {
          title: 'Título Hero Impactante',
          subtitle: 'Uma frase que resume a proposta única de valor do seu produto.',
          badge: 'Destaque',
          align: 'center',
          bgGradient: 'purple',
          ctaText: 'Comprar Agora',
          ctaLink: '#',
        };
        break;
      case 'heading':
        initialProps = { text: 'Subtítulo da Seção', level: 2, align: 'left' };
        break;
      case 'paragraph':
        initialProps = {
          content: 'Descreva os detalhes aqui. Este texto pode ter múltiplos parágrafos e explicações aprofundadas.',
          size: 'base',
          align: 'left',
        };
        break;
      case 'image':
        initialProps = {
          url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
          caption: 'Visual incrível do produto',
          rounded: true,
        };
        break;
      case 'gallery':
        initialProps = {
          images: [
            'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80',
          ],
          columns: 3,
        };
        break;
      case 'feature_grid':
        initialProps = {
          title: 'Principais Benefícios',
          items: [
            { title: 'Rápido & Leve', description: 'Carregamento instantâneo sem travamentos.', icon: 'Zap' },
            { title: 'Confiável', description: 'Garantia total de funcionamento no ecossistema.', icon: 'Shield' },
            { title: 'Fácil de Usar', description: 'Interface intuitiva com configuração em 1 clique.', icon: 'Smile' },
          ],
        };
        break;
      case 'faq':
        initialProps = {
          title: 'Perguntas Frequentes',
          items: [
            { question: 'Como faço para utilizar?', answer: 'Você receberá as instruções detalhadas logo após o pedido.' },
            { question: 'Posso pedir reembolso?', answer: 'Sim, dentro do prazo estipulado nas políticas da loja.' },
          ],
        };
        break;
      case 'testimonials':
        initialProps = {
          title: 'Avaliações de Clientes',
          items: [
            { author: 'Ana Costa', role: 'Membro Verificado', quote: 'Excelente qualidade, superou todas as expectativas!', avatar: '' },
          ],
        };
        break;
      case 'specs':
        initialProps = {
          title: 'Ficha Técnica',
          items: [
            { label: 'Tipo', value: 'Acesso Digital' },
            { label: 'Compatibilidade', value: 'Nuvio Web & Desktop' },
          ],
        };
        break;
      case 'video':
        initialProps = {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          title: 'Vídeo Demonstrativo',
        };
        break;
      case 'button_cta':
        initialProps = {
          text: 'Comprar Agora',
          link: '#',
          variant: 'primary',
          align: 'center',
        };
        break;
      case 'divider':
        initialProps = { style: 'glow' };
        break;
    }

    const newBlock: VisualBlock = { id: newId, type, props: initialProps };
    setBlocks([...blocks, newBlock]);
    setSelectedBlockId(newId);
  };

  const handleApplyTemplate = (key: string) => {
    const tpl = PRESET_TEMPLATES[key];
    if (!tpl) return;
    if (blocks.length > 0 && !confirm('Substituir blocos atuais pelo modelo selecionado?')) return;
    setBlocks(tpl.blocks);
    setSelectedBlockId(tpl.blocks[0]?.id || null);
  };

  const handleUpdateBlockProp = (propName: string, value: any) => {
    if (!selectedBlockId) return;
    setBlocks(
      blocks.map((b) => {
        if (b.id !== selectedBlockId) return b;
        return {
          ...b,
          props: {
            ...b.props,
            [propName]: value,
          },
        };
      })
    );
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    const copy = [...blocks];
    const [moved] = copy.splice(index, 1);
    copy.splice(newIdx, 0, moved!);
    setBlocks(copy);
  };

  const handleDeleteBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const handleDuplicateBlock = (block: VisualBlock) => {
    const clone: VisualBlock = {
      ...block,
      id: `block-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      props: JSON.parse(JSON.stringify(block.props)),
    };
    const idx = blocks.findIndex((b) => b.id === block.id);
    const copy = [...blocks];
    copy.splice(idx + 1, 0, clone);
    setBlocks(copy);
    setSelectedBlockId(clone.id);
  };

  const handleSaveDraft = async () => {
    if (!productId) return;
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.store.updateProduct(productId, {
        title,
        shortDescription,
        categoryId: categoryId || null,
        productType,
        price: parseFloat(price) || 0,
        currency,
        thumbnail: thumbnail || null,
        layoutData: blocks,
      });
      setSuccessMsg('Rascunho salvo com sucesso!');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar rascunho');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!productId) return;
    if (!title.trim()) {
      alert('Por favor informe o título do produto.');
      return;
    }
    if (blocks.length === 0) {
      alert('Adicione pelo menos um bloco na página antes de enviar para aprovação.');
      return;
    }

    if (!confirm('Deseja enviar este produto para aprovação da moderação? Ele será analisado pela equipe do Nuvio antes de ficar visível na loja.')) {
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      // First save latest edits
      await api.store.updateProduct(productId, {
        title,
        shortDescription,
        categoryId: categoryId || null,
        productType,
        price: parseFloat(price) || 0,
        currency,
        thumbnail: thumbnail || null,
        layoutData: blocks,
      });
      // Then submit for moderation
      await api.store.submitProduct(productId);
      setProductStatus('pending_review');
      alert('Produto enviado com sucesso para a moderação! Você será notificado sobre o status da aprovação.');
      navigate('/store/seller');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao enviar para aprovação');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-chat">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-txt-tertiary">Carregando editor visual...</p>
        </div>
      </div>
    );
  }

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-chat overflow-hidden select-none">
      {/* Top Header Bar */}
      <header className="h-14 px-4 border-b border-border-hard bg-surface-base flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/store/seller')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-txt-tertiary hover:text-txt-primary hover:bg-surface-panel transition-colors"
            title="Voltar ao Painel do Vendedor"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="truncate">
            <h1 className="text-sm font-bold text-white truncate max-w-xs md:max-w-md">
              {title || 'Sem título'}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                productStatus === 'published'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : productStatus === 'pending_review'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : productStatus === 'changes_requested'
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : productStatus === 'rejected'
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'bg-white/10 text-txt-secondary border border-border-hard'
              }`}>
                {productStatus === 'published' ? 'Publicado (Live)' : productStatus === 'pending_review' ? 'Em Análise' : productStatus === 'changes_requested' ? 'Ajustes Pedidos' : productStatus === 'rejected' ? 'Rejeitado' : 'Rascunho'}
              </span>
              {revisionNotes && (
                <span className="text-[11px] text-amber-300 truncate max-w-xs" title={revisionNotes}>
                  Nota: {revisionNotes}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Viewport & Preview Controls */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center bg-surface-panel rounded-lg p-0.5 border border-border-hard">
            <button
              onClick={() => setPreviewMode('desktop')}
              className={`p-1.5 rounded-md transition-colors ${previewMode === 'desktop' ? 'bg-surface-channel text-white' : 'text-txt-tertiary hover:text-txt-secondary'}`}
              title="Desktop"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </button>
            <button
              onClick={() => setPreviewMode('tablet')}
              className={`p-1.5 rounded-md transition-colors ${previewMode === 'tablet' ? 'bg-surface-channel text-white' : 'text-txt-tertiary hover:text-txt-secondary'}`}
              title="Tablet"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
            </button>
            <button
              onClick={() => setPreviewMode('mobile')}
              className={`p-1.5 rounded-md transition-colors ${previewMode === 'mobile' ? 'bg-surface-channel text-white' : 'text-txt-tertiary hover:text-txt-secondary'}`}
              title="Mobile"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="6" y="2" width="12" height="20" rx="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
            </button>
          </div>

          <button
            onClick={() => setIsPreviewOnly(!isPreviewOnly)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              isPreviewOnly ? 'bg-accent-primary text-white border-accent-primary' : 'bg-surface-panel text-txt-secondary border-border-hard hover:text-white'
            }`}
          >
            {isPreviewOnly ? 'Modo Edição' : 'Pré-visualizar'}
          </button>

          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="px-3.5 py-1.5 rounded-lg bg-surface-panel hover:bg-surface-channel text-white text-xs font-semibold border border-border-hard transition-colors disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Rascunho'}
          </button>

          <button
            onClick={handleSubmitReview}
            disabled={submitting}
            className="px-4 py-1.5 rounded-lg bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold transition-transform active:scale-95 disabled:opacity-50 shadow-md shadow-accent-primary/20"
          >
            {submitting ? 'Enviando...' : 'Enviar para Aprovação'}
          </button>
        </div>
      </header>

      {/* Notifications banner */}
      {successMsg && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 text-center text-xs text-emerald-400 font-medium">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 text-center text-xs text-red-400 font-medium">
          {errorMsg}
        </div>
      )}

      {/* 3-Pane Editor Layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* LEFT PANE: Block Library & Templates (Hidden in Preview Only) */}
        {!isPreviewOnly && (
          <aside className="w-64 border-r border-border-hard bg-surface-base flex flex-col flex-shrink-0">
            <div className="p-3 border-b border-border-hard flex items-center gap-1">
              <button
                onClick={() => setActiveTab('blocks')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  activeTab === 'blocks' ? 'bg-surface-panel text-white' : 'text-txt-tertiary hover:text-txt-secondary'
                }`}
              >
                Blocos & Modelos
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  activeTab === 'settings' ? 'bg-surface-panel text-white' : 'text-txt-tertiary hover:text-txt-secondary'
                }`}
              >
                Dados da Loja
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-5 no-scrollbar">
              {activeTab === 'blocks' ? (
                <>
                  {/* Preset Templates */}
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-txt-tertiary block mb-2">
                      Modelos Prontos
                    </span>
                    <div className="grid grid-cols-1 gap-1.5">
                      {Object.entries(PRESET_TEMPLATES).map(([key, tpl]) => (
                        <button
                          key={key}
                          onClick={() => handleApplyTemplate(key)}
                          className="w-full text-left px-3 py-2 rounded-lg bg-surface-panel/50 hover:bg-surface-panel border border-border-hard text-xs font-semibold text-txt-secondary hover:text-white transition-colors"
                        >
                          {tpl.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Block Library */}
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-txt-tertiary block mb-2">
                      Biblioteca de Blocos
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <LibraryBlockButton label="Hero Destaque" icon="Layout" onClick={() => handleAddBlock('hero')} />
                      <LibraryBlockButton label="Título" icon="Type" onClick={() => handleAddBlock('heading')} />
                      <LibraryBlockButton label="Parágrafo" icon="AlignLeft" onClick={() => handleAddBlock('paragraph')} />
                      <LibraryBlockButton label="Imagem" icon="Image" onClick={() => handleAddBlock('image')} />
                      <LibraryBlockButton label="Galeria" icon="Grid" onClick={() => handleAddBlock('gallery')} />
                      <LibraryBlockButton label="Benefícios" icon="CheckSquare" onClick={() => handleAddBlock('feature_grid')} />
                      <LibraryBlockButton label="F.A.Q." icon="HelpCircle" onClick={() => handleAddBlock('faq')} />
                      <LibraryBlockButton label="Depoimentos" icon="MessageSquare" onClick={() => handleAddBlock('testimonials')} />
                      <LibraryBlockButton label="Ficha Técnica" icon="List" onClick={() => handleAddBlock('specs')} />
                      <LibraryBlockButton label="Vídeo" icon="Video" onClick={() => handleAddBlock('video')} />
                      <LibraryBlockButton label="Botão CTA" icon="ExternalLink" onClick={() => handleAddBlock('button_cta')} />
                      <LibraryBlockButton label="Divisor" icon="Minus" onClick={() => handleAddBlock('divider')} />
                    </div>
                  </div>

                  {/* Reorder / Outline */}
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-txt-tertiary block mb-2">
                      Estrutura da Página ({blocks.length})
                    </span>
                    <div className="space-y-1">
                      {blocks.map((block, idx) => (
                        <div
                          key={block.id}
                          onClick={() => setSelectedBlockId(block.id)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                            selectedBlockId === block.id
                              ? 'bg-accent-primary/20 border-accent-primary text-white'
                              : 'bg-surface-panel/30 border-border-hard text-txt-secondary hover:bg-surface-panel'
                          }`}
                        >
                          <span className="capitalize font-medium truncate">{block.type.replace('_', ' ')}</span>
                          <div className="flex items-center gap-1 opacity-70 hover:opacity-100">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleMoveBlock(idx, 'up'); }}
                              disabled={idx === 0}
                              className="p-1 hover:text-white disabled:opacity-20"
                            >
                              ↑
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleMoveBlock(idx, 'down'); }}
                              disabled={idx === blocks.length - 1}
                              className="p-1 hover:text-white disabled:opacity-20"
                            >
                              ↓
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block.id); }}
                              className="p-1 hover:text-red-400"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                /* Product Storefront Settings */
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="text-txt-tertiary block mb-1 font-medium">Nome do Produto</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none focus:border-accent-primary"
                      placeholder="Ex: Bot de Moderação Avançado"
                    />
                  </div>

                  <div>
                    <label className="text-txt-tertiary block mb-1 font-medium">Descrição Curta (Card)</label>
                    <textarea
                      value={shortDescription}
                      onChange={(e) => setShortDescription(e.target.value)}
                      rows={3}
                      className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none focus:border-accent-primary resize-none"
                      placeholder="Breve resumo para os resultados de busca..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-txt-tertiary block mb-1 font-medium">Preço</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none focus:border-accent-primary"
                      />
                    </div>
                    <div>
                      <label className="text-txt-tertiary block mb-1 font-medium">Moeda</label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none focus:border-accent-primary"
                      >
                        <option value="BRL">BRL (R$)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-txt-tertiary block mb-1 font-medium">Categoria</label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none focus:border-accent-primary"
                    >
                      <option value="">Selecione uma categoria...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-txt-tertiary block mb-1 font-medium">Tipo de Entrega</label>
                    <select
                      value={productType}
                      onChange={(e) => setProductType(e.target.value as any)}
                      className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none focus:border-accent-primary"
                    >
                      <option value="digital">Digital (Download / Acesso)</option>
                      <option value="service">Serviço / Customização</option>
                      <option value="physical">Físico (Entrega)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-txt-tertiary block mb-1 font-medium">Imagem de Capa (URL)</label>
                    <input
                      type="text"
                      value={thumbnail}
                      onChange={(e) => setThumbnail(e.target.value)}
                      className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none focus:border-accent-primary"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* CENTER PANE: Visual Canvas */}
        <main className="flex-1 bg-surface-chat overflow-y-auto p-4 md:p-8 flex justify-center">
          <div
            className={`transition-all duration-300 w-full ${
              previewMode === 'mobile'
                ? 'max-w-sm border border-border-hard rounded-2xl bg-surface-base shadow-2xl p-4 my-auto min-h-[640px]'
                : previewMode === 'tablet'
                ? 'max-w-2xl border border-border-hard rounded-2xl bg-surface-base shadow-2xl p-6'
                : 'max-w-4xl'
            }`}
          >
            {blocks.length === 0 ? (
              <div className="h-96 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border-hard rounded-2xl">
                <div className="w-12 h-12 rounded-xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-accent-primary mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-white mb-1">Sua página está vazia</h3>
                <p className="text-xs text-txt-secondary max-w-sm mb-4">
                  Adicione blocos na biblioteca à esquerda ou escolha um modelo pré-configurado para começar rapidamente.
                </p>
                <button
                  onClick={() => handleAddBlock('hero')}
                  className="px-4 py-2 rounded-lg bg-accent-primary text-white text-xs font-bold hover:bg-accent-primary/90 transition-colors"
                >
                  Adicionar Bloco Hero
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {blocks.map((block, idx) => (
                  <div
                    key={block.id}
                    onClick={() => setSelectedBlockId(block.id)}
                    className={`relative group rounded-xl transition-all ${
                      !isPreviewOnly && selectedBlockId === block.id
                        ? 'ring-2 ring-accent-primary'
                        : !isPreviewOnly
                        ? 'hover:ring-1 hover:ring-border-hard'
                        : ''
                    }`}
                  >
                    {!isPreviewOnly && (
                      <div className="absolute -top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-surface-base border border-border-hard rounded-lg shadow-lg px-2 py-1 flex items-center gap-2 z-10 text-[11px] text-txt-secondary">
                        <span className="font-semibold capitalize text-white">{block.type}</span>
                        <button onClick={() => handleDuplicateBlock(block)} className="hover:text-white" title="Duplicar">⎘</button>
                        <button onClick={() => handleMoveBlock(idx, 'up')} disabled={idx === 0} className="hover:text-white disabled:opacity-20">↑</button>
                        <button onClick={() => handleMoveBlock(idx, 'down')} disabled={idx === blocks.length - 1} className="hover:text-white disabled:opacity-20">↓</button>
                        <button onClick={() => handleDeleteBlock(block.id)} className="hover:text-red-400" title="Excluir">✕</button>
                      </div>
                    )}
                    <VisualBlockRenderer blocks={[block]} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* RIGHT PANE: Block Inspector / Properties (Hidden in Preview Only) */}
        {!isPreviewOnly && (
          <aside className="w-80 border-l border-border-hard bg-surface-base flex flex-col flex-shrink-0">
            <div className="h-12 px-4 border-b border-border-hard flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Propriedades do Bloco
              </span>
              {selectedBlock && (
                <span className="text-[11px] text-accent-primary font-semibold capitalize">
                  {selectedBlock.type}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs no-scrollbar">
              {selectedBlock ? (
                <BlockInspector
                  block={selectedBlock}
                  onChangeProp={handleUpdateBlockProp}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-txt-tertiary">
                  <p className="text-xs">Clique em qualquer bloco na tela para editar seu conteúdo, cores e alinhamento.</p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function LibraryBlockButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-3 rounded-xl border border-border-hard bg-surface-panel/40 hover:bg-surface-panel hover:border-accent-primary/40 transition-all text-left flex flex-col gap-1.5 group"
    >
      <div className="w-7 h-7 rounded-md bg-white/5 group-hover:bg-accent-primary/20 flex items-center justify-center text-txt-tertiary group-hover:text-accent-primary transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      </div>
      <span className="text-xs font-semibold text-white leading-tight">{label}</span>
    </button>
  );
}

function BlockInspector({
  block,
  onChangeProp,
}: {
  block: VisualBlock;
  onChangeProp: (key: string, value: any) => void;
}) {
  const { type, props } = block;

  switch (type) {
    case 'hero':
      return (
        <div className="space-y-4">
          <div>
            <label className="text-txt-tertiary block mb-1 font-medium">Badge Superior</label>
            <input
              type="text"
              value={props.badge || ''}
              onChange={(e) => onChangeProp('badge', e.target.value)}
              className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none"
              placeholder="Ex: NOVIDADE"
            />
          </div>
          <div>
            <label className="text-txt-tertiary block mb-1 font-medium">Título Principal</label>
            <input
              type="text"
              value={props.title || ''}
              onChange={(e) => onChangeProp('title', e.target.value)}
              className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none"
            />
          </div>
          <div>
            <label className="text-txt-tertiary block mb-1 font-medium">Subtítulo</label>
            <textarea
              value={props.subtitle || ''}
              onChange={(e) => onChangeProp('subtitle', e.target.value)}
              rows={3}
              className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none resize-none"
            />
          </div>
          <div>
            <label className="text-txt-tertiary block mb-1 font-medium">Tema do Gradiente</label>
            <select
              value={props.bgGradient || 'purple'}
              onChange={(e) => onChangeProp('bgGradient', e.target.value)}
              className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none"
            >
              <option value="purple">Roxo Neon (Nuvio)</option>
              <option value="blue">Azul Tecnológico</option>
              <option value="emerald">Verde Esmeralda</option>
              <option value="amber">Âmbar & Ouro</option>
              <option value="dark">Cinza Escuro Minimalista</option>
            </select>
          </div>
          <div>
            <label className="text-txt-tertiary block mb-1 font-medium">Alinhamento</label>
            <select
              value={props.align || 'center'}
              onChange={(e) => onChangeProp('align', e.target.value)}
              className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none"
            >
              <option value="center">Centralizado</option>
              <option value="left">Alinhado à Esquerda</option>
            </select>
          </div>
          <div>
            <label className="text-txt-tertiary block mb-1 font-medium">Texto do Botão CTA</label>
            <input
              type="text"
              value={props.ctaText || ''}
              onChange={(e) => onChangeProp('ctaText', e.target.value)}
              className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none"
              placeholder="Ex: Garantir Meu Acesso"
            />
          </div>
        </div>
      );

    case 'heading':
      return (
        <div className="space-y-4">
          <div>
            <label className="text-txt-tertiary block mb-1 font-medium">Texto do Título</label>
            <input
              type="text"
              value={props.text || ''}
              onChange={(e) => onChangeProp('text', e.target.value)}
              className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none"
            />
          </div>
          <div>
            <label className="text-txt-tertiary block mb-1 font-medium">Tamanho / Nível</label>
            <select
              value={props.level || 2}
              onChange={(e) => onChangeProp('level', parseInt(e.target.value, 10))}
              className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none"
            >
              <option value={1}>H1 (Grande)</option>
              <option value={2}>H2 (Médio)</option>
              <option value={3}>H3 (Pequeno)</option>
            </select>
          </div>
          <div>
            <label className="text-txt-tertiary block mb-1 font-medium">Alinhamento</label>
            <select
              value={props.align || 'left'}
              onChange={(e) => onChangeProp('align', e.target.value)}
              className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none"
            >
              <option value="left">Esquerda</option>
              <option value="center">Centralizado</option>
              <option value="right">Direita</option>
            </select>
          </div>
        </div>
      );

    case 'paragraph':
      return (
        <div className="space-y-4">
          <div>
            <label className="text-txt-tertiary block mb-1 font-medium">Conteúdo do Parágrafo</label>
            <textarea
              value={props.content || ''}
              onChange={(e) => onChangeProp('content', e.target.value)}
              rows={6}
              className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none resize-none"
            />
          </div>
          <div>
            <label className="text-txt-tertiary block mb-1 font-medium">Tamanho da Fonte</label>
            <select
              value={props.size || 'base'}
              onChange={(e) => onChangeProp('size', e.target.value)}
              className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none"
            >
              <option value="sm">Pequena</option>
              <option value="base">Normal</option>
              <option value="lg">Grande</option>
            </select>
          </div>
        </div>
      );

    case 'image':
      return (
        <div className="space-y-4">
          <div>
            <label className="text-txt-tertiary block mb-1 font-medium">URL da Imagem</label>
            <input
              type="text"
              value={props.url || ''}
              onChange={(e) => onChangeProp('url', e.target.value)}
              className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none"
            />
          </div>
          <div>
            <label className="text-txt-tertiary block mb-1 font-medium">Legenda</label>
            <input
              type="text"
              value={props.caption || ''}
              onChange={(e) => onChangeProp('caption', e.target.value)}
              className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none"
            />
          </div>
        </div>
      );

    case 'button_cta':
      return (
        <div className="space-y-4">
          <div>
            <label className="text-txt-tertiary block mb-1 font-medium">Texto do Botão</label>
            <input
              type="text"
              value={props.text || ''}
              onChange={(e) => onChangeProp('text', e.target.value)}
              className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none"
            />
          </div>
          <div>
            <label className="text-txt-tertiary block mb-1 font-medium">Estilo Visual</label>
            <select
              value={props.variant || 'primary'}
              onChange={(e) => onChangeProp('variant', e.target.value)}
              className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none"
            >
              <option value="primary">Primário (Destaque)</option>
              <option value="secondary">Secundário (Neutro)</option>
              <option value="outline">Apenas Contorno</option>
            </select>
          </div>
          <div>
            <label className="text-txt-tertiary block mb-1 font-medium">Alinhamento</label>
            <select
              value={props.align || 'center'}
              onChange={(e) => onChangeProp('align', e.target.value)}
              className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none"
            >
              <option value="center">Centralizado</option>
              <option value="left">Esquerda</option>
              <option value="right">Direita</option>
            </select>
          </div>
        </div>
      );

    case 'video':
      return (
        <div className="space-y-4">
          <div>
            <label className="text-txt-tertiary block mb-1 font-medium">Link do Vídeo (YouTube)</label>
            <input
              type="text"
              value={props.url || ''}
              onChange={(e) => onChangeProp('url', e.target.value)}
              className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none"
              placeholder="https://youtube.com/watch?v=..."
            />
          </div>
          <div>
            <label className="text-txt-tertiary block mb-1 font-medium">Título</label>
            <input
              type="text"
              value={props.title || ''}
              onChange={(e) => onChangeProp('title', e.target.value)}
              className="w-full bg-surface-channel border border-border-hard rounded-lg px-3 py-2 text-white outline-none"
            />
          </div>
        </div>
      );

    default:
      return (
        <div className="text-txt-secondary text-xs">
          Propriedades avançadas salvas diretamente com o bloco.
        </div>
      );
  }
}
