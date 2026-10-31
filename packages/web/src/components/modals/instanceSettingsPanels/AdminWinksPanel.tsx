import React, { useState, useEffect, useCallback } from 'react';
import type { OfficialWink, WinkAdminMetrics, WinkCategory } from '@concord/shared/src/winks';
import { api } from '../../../api/client';
import { WinkUploadModal } from './WinkUploadModal';
import { WinkPreviewModal } from './WinkPreviewModal';
import { SparklesIcon } from '../../ui/icons';

export function AdminWinksPanel() {
  const [winks, setWinks] = useState<OfficialWink[]>([]);
  const [metrics, setMetrics] = useState<WinkAdminMetrics>({
    total: 0,
    published: 0,
    processing: 0,
    drafts: 0,
    failed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [previewWink, setPreviewWink] = useState<OfficialWink | null>(null);

  const loadWinks = useCallback(async () => {
    try {
      const res = await api.adminWinks.list({
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: search.trim() || undefined,
      });
      setWinks(res.winks);
      setMetrics(res.metrics);
    } catch (err) {
      console.error('Failed to load admin winks:', err);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, statusFilter, search]);

  useEffect(() => {
    loadWinks();
  }, [loadWinks]);

  // Live polling if any wink is currently in processing or validating state
  useEffect(() => {
    const hasActiveProcessing = winks.some(
      (w) => w.status === 'pending' || w.status === 'validating' || w.status === 'processing'
    );
    if (!hasActiveProcessing) return;

    const timer = setInterval(() => {
      loadWinks();
    }, 3000);

    return () => clearInterval(timer);
  }, [winks, loadWinks]);

  const handleTogglePublish = async (wink: OfficialWink) => {
    try {
      if (wink.published) {
        await api.adminWinks.unpublish(wink.id);
      } else {
        await api.adminWinks.publish(wink.id);
      }
      loadWinks();
    } catch (err: any) {
      alert(err?.message || 'Falha ao alterar estado de publicação.');
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await api.adminWinks.retry(id);
      loadWinks();
    } catch (err: any) {
      alert(err?.message || 'Falha ao reiniciar processamento.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza de que deseja excluir este Wink permanentemente?')) return;
    try {
      await api.adminWinks.delete(id);
      loadWinks();
    } catch (err: any) {
      alert(err?.message || 'Falha ao excluir o Wink.');
    }
  };

  return (
    <div className="space-y-6 text-txt-primary">
      {/* Header with Title and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-primary/20 flex items-center justify-center text-accent-primary">
              <SparklesIcon width="18" height="18" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-wide">Gerenciamento de Winks Oficiais</h1>
          </div>
          <p className="text-xs text-txt-secondary mt-1">
            Biblioteca oficial para mensagens diretas com suporte a vídeos MOV ProRes 4444, transparência alfa e conversão automática.
          </p>
        </div>

        <button
          onClick={() => setUploadModalOpen(true)}
          className="px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover text-white rounded-xl text-xs font-semibold transition-all shadow-md flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <span>+ Adicionar Wink</span>
        </button>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-txt-tertiary uppercase">Publicados</div>
            <div className="text-2xl font-bold text-green-400 mt-0.5">{metrics.published}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 text-lg">
            ✓
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-txt-tertiary uppercase">Em Processamento</div>
            <div className="text-2xl font-bold text-blue-400 mt-0.5 flex items-center gap-1.5">
              <span>{metrics.processing}</span>
              {metrics.processing > 0 && (
                <svg className="animate-spin w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 text-lg">
            ⏳
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-txt-tertiary uppercase">Rascunhos</div>
            <div className="text-2xl font-bold text-amber-400 mt-0.5">{metrics.drafts}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 text-lg">
            📝
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-txt-tertiary uppercase">Falhas</div>
            <div className="text-2xl font-bold text-red-400 mt-0.5">{metrics.failed}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 text-lg">
            ⚠️
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white/[0.02] p-3 rounded-2xl border border-white/[0.06]">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar Winks por nome, descrição ou categoria..."
            className="w-full pl-9 pr-3 py-2 bg-white/[0.05] border border-white/10 rounded-xl text-xs text-white placeholder-txt-tertiary focus:outline-none focus:ring-1 focus:ring-accent-primary/60"
          />
          <svg
            className="absolute left-3 top-2.5 w-4 h-4 text-txt-tertiary pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-[#1a1b22] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent-primary/60 w-full sm:w-auto"
        >
          <option value="all">Todas as Categorias</option>
          <option value="humor">Humor</option>
          <option value="reactions">Reações</option>
          <option value="love">Amor</option>
          <option value="romance">Romance</option>
          <option value="fun">Diversão</option>
          <option value="emotions">Emoções</option>
          <option value="celebration">Comemoração</option>
          <option value="troll">Troll</option>
          <option value="drama">Drama</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-[#1a1b22] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent-primary/60 w-full sm:w-auto"
        >
          <option value="all">Todos os Status</option>
          <option value="published">Publicados</option>
          <option value="draft">Rascunhos</option>
          <option value="processing">Em Processamento</option>
          <option value="failed">Com Falha</option>
        </select>

        <button
          onClick={loadWinks}
          className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-txt-secondary hover:text-white transition-colors"
          title="Recarregar catálogo"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      </div>

      {/* Catalog Table / Grid */}
      <div className="rounded-2xl border border-white/[0.08] overflow-hidden bg-white/[0.01]">
        {loading ? (
          <div className="py-16 text-center text-xs text-txt-secondary flex flex-col items-center gap-3">
            <svg className="animate-spin w-6 h-6 text-accent-primary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>Carregando catálogo de Winks...</span>
          </div>
        ) : winks.length === 0 ? (
          <div className="py-16 text-center text-xs text-txt-secondary">
            Nenhum Wink encontrado com os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02] text-txt-tertiary uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Wink</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Duração</th>
                  <th className="py-3 px-4">Transparência</th>
                  <th className="py-3 px-4">Áudio</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {winks.map((w) => (
                  <tr key={w.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Wink Preview & Name */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                          {w.thumbnailUrl ? (
                            <img src={w.thumbnailUrl} alt={w.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xl">{w.previewEmoji}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate flex items-center gap-1.5">
                            <span className="truncate">{w.name}</span>
                            {w.originalFilename && (
                              <span className="text-[10px] font-mono text-txt-tertiary truncate">
                                ({w.originalFilename})
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-txt-tertiary truncate max-w-xs">{w.description}</div>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-lg bg-white/[0.05] text-txt-secondary font-medium capitalize">
                        {w.category}
                      </span>
                    </td>

                    {/* Duration */}
                    <td className="py-3 px-4 text-txt-secondary font-mono">
                      {(w.durationMs / 1000).toFixed(1)}s
                    </td>

                    {/* Transparency Badge */}
                    <td className="py-3 px-4">
                      {w.hasAlpha ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          ✨ Transparente
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/[0.06] text-txt-tertiary">
                          Opaco
                        </span>
                      )}
                    </td>

                    {/* Audio Badge */}
                    <td className="py-3 px-4">
                      {w.hasAudio ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/25">
                          🔊 Com Áudio
                        </span>
                      ) : (
                        <span className="text-[11px] text-txt-tertiary">Mudo</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4">
                      {w.status === 'completed' && w.published ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
                          Publicado
                        </span>
                      ) : w.status === 'completed' && !w.published ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/25">
                          Rascunho
                        </span>
                      ) : w.status === 'processing' || w.status === 'validating' || w.status === 'pending' ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 inline-flex items-center gap-1">
                          <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Processando
                        </span>
                      ) : (
                        <span
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30 cursor-help"
                          title={w.errorMessage || 'Falha desconhecida'}
                        >
                          Falha
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setPreviewWink(w)}
                          className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-txt-secondary hover:text-white transition-colors"
                          title="Pré-visualizar animação com testes de fundo"
                        >
                          Prévia
                        </button>

                        {w.status === 'completed' && (
                          <button
                            onClick={() => handleTogglePublish(w)}
                            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                              w.published
                                ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300'
                                : 'bg-green-500/15 hover:bg-green-500/25 text-green-300'
                            }`}
                          >
                            {w.published ? 'Despublicar' : 'Publicar'}
                          </button>
                        )}

                        {w.status === 'failed' && (
                          <button
                            onClick={() => handleRetry(w.id)}
                            className="px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 transition-colors"
                            title="Tentar converter novamente"
                          >
                            Reprocessar
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(w.id)}
                          className="px-2 py-1 rounded-lg text-txt-tertiary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Excluir Wink"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <WinkUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => {
          loadWinks();
        }}
      />

      {/* Preview Modal */}
      <WinkPreviewModal
        wink={previewWink}
        onClose={() => setPreviewWink(null)}
      />
    </div>
  );
}
