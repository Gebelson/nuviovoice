import React, { useState, useRef } from 'react';
import type { OfficialWink, WinkCategory } from '@concord/shared/src/winks';
import { api } from '../../../api/client';
import { SparklesIcon } from '../../ui/icons';

interface WinkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (wink: OfficialWink) => void;
}

const CATEGORIES: Array<{ id: WinkCategory; label: string }> = [
  { id: 'humor', label: 'Humor' },
  { id: 'reactions', label: 'Reações' },
  { id: 'love', label: 'Amor' },
  { id: 'romance', label: 'Romance' },
  { id: 'fun', label: 'Diversão' },
  { id: 'emotions', label: 'Emoções' },
  { id: 'celebration', label: 'Comemoração' },
  { id: 'troll', label: 'Troll' },
  { id: 'drama', label: 'Drama' },
];

export function WinkUploadModal({ isOpen, onClose, onSuccess }: WinkUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<WinkCategory>('humor');
  const [emoji, setEmoji] = useState('✨');
  const [description, setDescription] = useState('');
  const [defaultVolume, setDefaultVolume] = useState(100);
  const [autoPublish, setAutoPublish] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (selected: File) => {
    const ext = selected.name.split('.').pop()?.toLowerCase();
    if (!ext || !['mov', 'mp4', 'webm'].includes(ext)) {
      setError('Formato inválido. Por favor, selecione um arquivo MOV, MP4 ou WebM.');
      return;
    }
    if (selected.size > 500 * 1024 * 1024) {
      setError('Arquivo muito grande. O limite máximo para vídeos é 500 MB.');
      return;
    }
    setError(null);
    setFile(selected);
    if (!name.trim()) {
      const baseName = selected.name.replace(/\.[^/.]+$/, '');
      setName(baseName);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Selecione um arquivo de vídeo para enviar.');
      return;
    }
    if (!name.trim()) {
      setError('Informe um nome para o Wink.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name.trim());
      formData.append('category', category);
      formData.append('emoji', emoji.trim() || '✨');
      formData.append('description', description.trim());
      formData.append('defaultVolume', (defaultVolume / 100).toString());
      formData.append('autoPublish', autoPublish ? 'true' : 'false');

      const created = await api.adminWinks.upload(formData);
      onSuccess(created);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Falha ao enviar o Wink. Verifique os dados e tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onMouseDown={(e) => {
        // Only close if clicking the direct backdrop
        if (e.target === e.currentTarget && !isUploading) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-[#14151a]/95 border border-white/10 shadow-[0_25px_70px_rgba(0,0,0,0.8)] text-txt-primary overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-primary/20 flex items-center justify-center text-accent-primary">
              <SparklesIcon width="18" height="18" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-wide">Adicionar Novo Wink</h2>
              <p className="text-xs text-txt-secondary">Upload de vídeo oficial com conversão e transparência</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="text-txt-secondary hover:text-white p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Drag & Drop Area */}
          <div>
            <label className="block text-xs font-medium text-txt-secondary mb-1.5">
              Arquivo de Vídeo (MOV ProRes 4444, MP4 ou WebM)
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                file
                  ? 'border-accent-primary/60 bg-accent-primary/10'
                  : 'border-white/15 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mov,.mp4,.webm"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              <div className="flex flex-col items-center justify-center gap-1.5">
                <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center text-accent-primary text-xl">
                  {file ? '🎬' : '⬆️'}
                </div>
                {file ? (
                  <div>
                    <div className="text-xs font-semibold text-white truncate max-w-xs">{file.name}</div>
                    <div className="text-[11px] text-txt-tertiary">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB • Clique para trocar
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs font-medium text-white">Arraste seu vídeo ou clique para selecionar</div>
                    <div className="text-[11px] text-txt-tertiary">
                      Formatos aceitos: MOV (com canal alfa), MP4, WebM (Máx. 500 MB, até 30s)
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Nome e Emoji */}
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3">
              <label className="block text-xs font-medium text-txt-secondary mb-1">Nome do Wink *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Explosão de Risada"
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-xl text-xs text-white placeholder-txt-tertiary focus:outline-none focus:ring-1 focus:ring-accent-primary/60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-txt-secondary mb-1">Emoji</label>
              <input
                type="text"
                maxLength={4}
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="w-full px-3 py-2 text-center bg-white/[0.05] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent-primary/60"
              />
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-xs font-medium text-txt-secondary mb-1">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as WinkCategory)}
              className="w-full px-3 py-2 bg-[#1a1b22] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent-primary/60"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-medium text-txt-secondary mb-1">Descrição</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição da animação e contexto..."
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-xl text-xs text-white placeholder-txt-tertiary focus:outline-none focus:ring-1 focus:ring-accent-primary/60 resize-none"
            />
          </div>

          {/* Volume padrão */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-txt-secondary">Volume Padrão</label>
              <span className="text-xs text-txt-tertiary">{defaultVolume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="150"
              value={defaultVolume}
              onChange={(e) => setDefaultVolume(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent-primary"
            />
          </div>

          {/* Publicar imediatamente */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="autoPublish"
              checked={autoPublish}
              onChange={(e) => setAutoPublish(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-accent-primary focus:ring-accent-primary"
            />
            <label htmlFor="autoPublish" className="text-xs text-txt-secondary cursor-pointer select-none">
              Publicar automaticamente assim que o processamento terminar
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-white/[0.08] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 rounded-xl text-xs font-medium text-txt-secondary hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isUploading || !file}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-accent-primary hover:bg-accent-primary-hover text-white transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Enviando Vídeo...</span>
                </>
              ) : (
                <span>Confirmar Envio</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
