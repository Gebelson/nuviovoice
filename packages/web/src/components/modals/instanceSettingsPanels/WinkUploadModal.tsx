import React, { useState, useRef, useEffect } from 'react';
import type { OfficialWink, WinkCategory } from '@concord/shared/src/winks';
import { Upload } from 'tus-js-client';
import { api } from '../../../api/client';
import { SparklesIcon } from '../../ui/icons';
import { winkTusEndpoint } from '../../../utils/tusUrl';
import { useAuthStore } from '../../../stores/authStore';

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

type UploadStatus = 'idle' | 'uploading' | 'paused' | 'processing' | 'completed' | 'error';

export function WinkUploadModal({ isOpen, onClose, onSuccess }: WinkUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<WinkCategory>('humor');
  const [emoji, setEmoji] = useState('✨');
  const [description, setDescription] = useState('');
  const [defaultVolume, setDefaultVolume] = useState(100);
  const [autoPublish, setAutoPublish] = useState(true);
  const [allowDuplicate, setAllowDuplicate] = useState(false);

  // Upload progress & state
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [bytesUploaded, setBytesUploaded] = useState(0);
  const [bytesTotal, setBytesTotal] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState<string>('');
  const [remainingTime, setRemainingTime] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const tusUploadRef = useRef<Upload | null>(null);
  const speedTrackerRef = useRef<{ lastLoaded: number; lastTime: number }>({ lastLoaded: 0, lastTime: 0 });

  useEffect(() => {
    return () => {
      // Abort upload if component unmounts while uploading
      if (tusUploadRef.current) {
        tusUploadRef.current.abort(false);
      }
    };
  }, []);

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
    setAllowDuplicate(false);
    setBytesUploaded(0);
    setBytesTotal(selected.size);
    setUploadStatus('idle');
    if (!name.trim()) {
      const baseName = selected.name.replace(/\.[^/.]+$/, '');
      setName(baseName);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploadStatus === 'uploading' || uploadStatus === 'processing') return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const handlePause = () => {
    if (tusUploadRef.current && uploadStatus === 'uploading') {
      tusUploadRef.current.abort(false);
      setUploadStatus('paused');
      setStatusMessage('Upload pausado pelo usuário');
    }
  };

  const handleCancel = () => {
    if (tusUploadRef.current) {
      tusUploadRef.current.abort(true);
      tusUploadRef.current = null;
    }
    setUploadStatus('idle');
    setBytesUploaded(0);
    setUploadSpeed('');
    setRemainingTime('');
    setStatusMessage('');
    setError(null);
  };

  const startUpload = () => {
    if (!file) {
      setError('Selecione um arquivo de vídeo para enviar.');
      return;
    }
    if (!name.trim()) {
      setError('Informe um nome para o Wink.');
      return;
    }

    const token =
      useAuthStore.getState().token ??
      (typeof localStorage !== 'undefined' ? localStorage.getItem('backspace_token') : null);

    if (!token) {
      setError('Sessão expirada. Faça login novamente.');
      return;
    }

    setError(null);
    setUploadStatus('uploading');
    setStatusMessage('Iniciando envio fragmentado...');
    speedTrackerRef.current = { lastLoaded: bytesUploaded, lastTime: Date.now() };

    const endpoint = winkTusEndpoint();

    const upload = new Upload(file, {
      endpoint,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      chunkSize: 2.5 * 1024 * 1024, // 2.5 MB safe chunks (strictly below Vercel 4.5MB limit)
      headers: {
        Authorization: `Bearer ${token}`,
      },
      metadata: {
        filename: file.name,
        originalName: file.name,
        filetype: file.type || (file.name.endsWith('.mov') ? 'video/quicktime' : 'video/mp4'),
        allowDuplicate: allowDuplicate ? 'true' : 'false',
      },
      onProgress: (loaded: number, total: number) => {
        setBytesUploaded(loaded);
        setBytesTotal(total);

        // Speed & ETA estimation
        const now = Date.now();
        const timeDiff = (now - speedTrackerRef.current.lastTime) / 1000;
        if (timeDiff >= 0.5) {
          const bytesDiff = loaded - speedTrackerRef.current.lastLoaded;
          const bytesPerSec = bytesDiff / timeDiff;
          speedTrackerRef.current = { lastLoaded: loaded, lastTime: now };

          if (bytesPerSec > 0) {
            setUploadSpeed(`${formatBytes(bytesPerSec)}/s`);
            const remainingSec = Math.max(0, Math.round((total - loaded) / bytesPerSec));
            setRemainingTime(remainingSec > 60 ? `~${Math.round(remainingSec / 60)} min` : `~${remainingSec}s restante`);
          }
        }

        const pct = Math.round((loaded / total) * 100);
        setStatusMessage(`Enviando fragmentos (${pct}%)...`);
      },
      onSuccess: async (payload) => {
        setUploadStatus('processing');
        setStatusMessage('Vídeo recebido! Processando com FFmpeg (preservando transparência e áudio)...');

        let uploadId = '';
        try {
          const bodyText = payload.lastResponse?.getBody?.() || '';
          if (bodyText) {
            const parsed = JSON.parse(bodyText);
            uploadId = parsed.uploadId || '';
          }
        } catch { /* ignore */ }

        if (!uploadId && upload.url) {
          uploadId = upload.url.split('/').filter(Boolean).pop() || '';
        }

        try {
          const created = await api.adminWinks.upload({
            uploadId,
            name: name.trim(),
            category,
            emoji: emoji.trim() || '✨',
            description: description.trim(),
            defaultVolume: defaultVolume / 100,
            autoPublish,
            allowDuplicate,
          });

          setUploadStatus('completed');
          setStatusMessage('Wink cadastrado e processado com sucesso!');
          setTimeout(() => {
            onSuccess(created);
            onClose();
          }, 600);
        } catch (err: any) {
          setUploadStatus('error');
          const status = err?.status || err?.statusCode;
          const msg = err?.message || 'Falha ao salvar o Wink no servidor.';

          if (status === 409 || msg.includes('duplicate_wink') || msg.includes('Já existe um Wink')) {
            setError('Já existe um Wink cadastrado com este mesmo arquivo. Marque "Permitir duplicata" se deseja prosseguir.');
          } else if (status === 507 || msg.includes('insufficient_storage')) {
            setError('Espaço em disco insuficiente no servidor para processar este vídeo.');
          } else if (status === 413) {
            setError('Arquivo muito grande. O limite máximo é de 500 MB.');
          } else {
            setError(msg);
          }
        }
      },
      onError: (err: Error) => {
        const msg = err?.message || 'Falha na conexão de upload.';
        setUploadStatus('error');
        setUploadSpeed('');
        setRemainingTime('');

        if (msg.includes('409') || msg.includes('duplicate_wink') || msg.includes('Já existe um Wink')) {
          setError('Já existe um Wink cadastrado com este arquivo. Marque "Permitir duplicata" se deseja prosseguir.');
        } else if (msg.includes('507') || msg.includes('insufficient_storage') || msg.includes('Espaço em disco')) {
          setError('Espaço em disco insuficiente no servidor para processar este vídeo.');
        } else if (msg.includes('413') || msg.includes('muito grande')) {
          setError('Arquivo muito grande. O limite máximo é de 500 MB.');
        } else if (msg.includes('400') || msg.includes('unsupported_file_format')) {
          setError('Formato não suportado. Apenas arquivos MOV, MP4 e WebM são aceitos.');
        } else if (msg.includes('403')) {
          setError('Permissão negada. Apenas administradores podem enviar Winks.');
        } else {
          setError(`Falha no upload: ${msg}. O progresso foi mantido; clique em Retomar para continuar.`);
        }
      },
    });

    tusUploadRef.current = upload;
    upload.start();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadStatus === 'uploading' || uploadStatus === 'processing') return;
    startUpload();
  };

  const isBusy = uploadStatus === 'uploading' || uploadStatus === 'processing';
  const progressPct = bytesTotal > 0 ? Math.min(100, Math.round((bytesUploaded / bytesTotal) * 100)) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isBusy) {
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
              <p className="text-xs text-txt-secondary">Upload com envio fragmentado, transparência e áudio</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="text-txt-secondary hover:text-white p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors disabled:opacity-30"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex flex-col gap-1.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-red-400">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span className="font-medium">{error}</span>
              </div>
              {error.includes('duplicat') && (
                <div className="flex items-center gap-2 mt-1 pt-1 border-t border-red-500/20">
                  <input
                    type="checkbox"
                    id="allowDupCheck"
                    checked={allowDuplicate}
                    onChange={(e) => setAllowDuplicate(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-red-400 bg-red-950 text-accent-primary"
                  />
                  <label htmlFor="allowDupCheck" className="text-[11px] text-red-200 cursor-pointer select-none">
                    Permitir duplicata e continuar mesmo já existindo um arquivo com este nome
                  </label>
                </div>
              )}
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
              onClick={() => {
                if (!isBusy) fileInputRef.current?.click();
              }}
              className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
                isBusy ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
              } ${
                file
                  ? 'border-accent-primary/60 bg-accent-primary/10'
                  : 'border-white/15 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mov,.mp4,.webm"
                disabled={isBusy}
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
                      {formatBytes(file.size)} • {file.name.endsWith('.mov') ? 'MOV (ProRes 4444 / Transparência)' : 'Vídeo'} • {!isBusy && 'Clique para trocar'}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs font-medium text-white">Arraste seu vídeo ou clique para selecionar</div>
                    <div className="text-[11px] text-txt-tertiary">
                      Formatos aceitos: MOV (ProRes 4444 com alpha), MP4, WebM (Máx. 500 MB, até 30s)
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Upload Progress & Controls */}
          {(uploadStatus !== 'idle') && (
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {uploadStatus === 'uploading' && (
                    <span className="w-2 h-2 rounded-full bg-accent-primary animate-pulse" />
                  )}
                  {uploadStatus === 'processing' && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  )}
                  {uploadStatus === 'paused' && (
                    <span className="w-2 h-2 rounded-full bg-yellow-400" />
                  )}
                  {uploadStatus === 'completed' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  )}
                  <span className="font-medium text-white">{statusMessage || 'Progresso do envio'}</span>
                </div>
                <span className="text-txt-secondary font-mono text-[11px]">
                  {formatBytes(bytesUploaded)} / {formatBytes(bytesTotal)} ({progressPct}%)
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden relative">
                <div
                  className={`h-full transition-all duration-200 rounded-full ${
                    uploadStatus === 'processing'
                      ? 'bg-gradient-to-r from-amber-500 to-accent-primary animate-pulse'
                      : uploadStatus === 'completed'
                      ? 'bg-emerald-500'
                      : 'bg-gradient-to-r from-accent-primary to-accent-primary-hover'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Stats & Actions */}
              <div className="flex items-center justify-between pt-0.5 text-[11px] text-txt-tertiary">
                <div className="flex items-center gap-3">
                  {uploadSpeed && <span>{uploadSpeed}</span>}
                  {remainingTime && <span>{remainingTime}</span>}
                  <span className="text-white/40">Fragmentos de 2.5 MB</span>
                </div>

                <div className="flex items-center gap-2">
                  {uploadStatus === 'uploading' && (
                    <button
                      type="button"
                      onClick={handlePause}
                      className="px-2 py-0.5 rounded text-[11px] bg-white/10 hover:bg-white/20 text-txt-primary transition-colors"
                    >
                      Pausar
                    </button>
                  )}
                  {uploadStatus === 'paused' && (
                    <button
                      type="button"
                      onClick={() => startUpload()}
                      className="px-2 py-0.5 rounded text-[11px] bg-accent-primary hover:bg-accent-primary-hover text-white transition-colors"
                    >
                      Retomar
                    </button>
                  )}
                  {(uploadStatus === 'uploading' || uploadStatus === 'paused') && (
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-2 py-0.5 rounded text-[11px] bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors"
                    >
                      Cancelar Envio
                    </button>
                  )}
                  {uploadStatus === 'error' && (
                    <button
                      type="button"
                      onClick={() => startUpload()}
                      className="px-2 py-0.5 rounded text-[11px] bg-accent-primary hover:bg-accent-primary-hover text-white transition-colors"
                    >
                      Tentar Novamente
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Nome e Emoji */}
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3">
              <label className="block text-xs font-medium text-txt-secondary mb-1">Nome do Wink *</label>
              <input
                type="text"
                required
                disabled={isBusy}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: iHazar Explosão"
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-xl text-xs text-white placeholder-txt-tertiary focus:outline-none focus:ring-1 focus:ring-accent-primary/60 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-txt-secondary mb-1">Emoji</label>
              <input
                type="text"
                maxLength={4}
                disabled={isBusy}
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="w-full px-3 py-2 text-center bg-white/[0.05] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent-primary/60 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-xs font-medium text-txt-secondary mb-1">Categoria</label>
            <select
              value={category}
              disabled={isBusy}
              onChange={(e) => setCategory(e.target.value as WinkCategory)}
              className="w-full px-3 py-2 bg-[#1a1b22] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent-primary/60 disabled:opacity-50"
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
              disabled={isBusy}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição da animação e contexto..."
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-xl text-xs text-white placeholder-txt-tertiary focus:outline-none focus:ring-1 focus:ring-accent-primary/60 resize-none disabled:opacity-50"
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
              disabled={isBusy}
              value={defaultVolume}
              onChange={(e) => setDefaultVolume(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent-primary disabled:opacity-50"
            />
          </div>

          {/* Publicar imediatamente */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="autoPublish"
              disabled={isBusy}
              checked={autoPublish}
              onChange={(e) => setAutoPublish(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-accent-primary focus:ring-accent-primary disabled:opacity-50"
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
              disabled={isBusy}
              className="px-4 py-2 rounded-xl text-xs font-medium text-txt-secondary hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-30"
            >
              Fechar
            </button>
            <button
              type="submit"
              disabled={isBusy || !file}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-accent-primary hover:bg-accent-primary-hover text-white transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploadStatus === 'uploading' ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Enviando ({progressPct}%)...</span>
                </>
              ) : uploadStatus === 'processing' ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Processando FFmpeg...</span>
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
