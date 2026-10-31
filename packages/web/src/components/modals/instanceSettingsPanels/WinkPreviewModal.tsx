import React, { useState, useRef, useEffect } from 'react';
import type { OfficialWink } from '@concord/shared/src/winks';

interface WinkPreviewModalProps {
  wink: OfficialWink | null;
  onClose: () => void;
}

type BackdropMode = 'checkerboard' | 'dark' | 'chat';

export function WinkPreviewModal({ wink, onClose }: WinkPreviewModalProps) {
  const [backdrop, setBackdrop] = useState<BackdropMode>('checkerboard');
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = (volume / 100) * (wink?.defaultVolume ?? 1.0);
    }
  }, [volume, wink]);

  if (!wink) return null;

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleRestart = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play();
    setIsPlaying(true);
  };

  const isVideo = !!(wink.webmUrl || wink.mp4Url);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-4xl rounded-2xl bg-[#14151a]/95 border border-white/10 shadow-[0_25px_80px_rgba(0,0,0,0.85)] text-txt-primary overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-primary/20 flex items-center justify-center text-xl">
              {wink.previewEmoji}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">{wink.name}</h2>
                {wink.hasAlpha ? (
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-purple-500/20 text-purple-300 rounded border border-purple-500/30">
                    Transparência Alfa
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-white/10 text-txt-secondary rounded">
                    Opaco
                  </span>
                )}
              </div>
              <p className="text-xs text-txt-secondary">
                {wink.category} • Duração: {(wink.durationMs / 1000).toFixed(1)}s
              </p>
            </div>
          </div>

          {/* Backdrop Mode Switcher */}
          <div className="flex items-center gap-2 bg-white/[0.04] p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setBackdrop('checkerboard')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                backdrop === 'checkerboard'
                  ? 'bg-accent-primary text-white shadow-sm'
                  : 'text-txt-secondary hover:text-white'
              }`}
              title="Fundo quadriculado para testar transparência alfa"
            >
              🏁 Quadriculado
            </button>
            <button
              onClick={() => setBackdrop('dark')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                backdrop === 'dark'
                  ? 'bg-accent-primary text-white shadow-sm'
                  : 'text-txt-secondary hover:text-white'
              }`}
              title="Fundo escuro padrão"
            >
              🌑 Escuro
            </button>
            <button
              onClick={() => setBackdrop('chat')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                backdrop === 'chat'
                  ? 'bg-accent-primary text-white shadow-sm'
                  : 'text-txt-secondary hover:text-white'
              }`}
              title="Simulação visual de conversa no chat (sem envio de mensagens reais)"
            >
              💬 Visualizar no Chat
            </button>
          </div>

          <button
            onClick={onClose}
            className="text-txt-secondary hover:text-white p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors ml-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video Canvas Arena */}
        <div
          className="relative w-full h-[400px] flex items-center justify-center overflow-hidden border-b border-white/[0.08]"
          style={
            backdrop === 'checkerboard'
              ? {
                  backgroundColor: '#15161c',
                  backgroundImage:
                    'linear-gradient(45deg, #20222a 25%, transparent 25%), linear-gradient(-45deg, #20222a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #20222a 75%), linear-gradient(-45deg, transparent 75%, #20222a 75%)',
                  backgroundSize: '24px 24px',
                  backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0px',
                }
              : backdrop === 'dark'
              ? { backgroundColor: '#0e0f12' }
              : { backgroundColor: '#13141a' }
          }
        >
          {/* Simulated Chat Background when backdrop === 'chat' */}
          {backdrop === 'chat' && (
            <div className="absolute inset-0 p-6 flex flex-col justify-end space-y-3 opacity-40 pointer-events-none select-none">
              <div className="flex items-start gap-2.5 max-w-sm">
                <div className="w-8 h-8 rounded-full bg-blue-500/30 border border-blue-400/40 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  G
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.06] border border-white/10 text-xs text-txt-primary">
                  <div className="font-semibold text-white mb-0.5">Gabriel</div>
                  <div>E aí! Tudo certo com a exportação da nova animação em MOV?</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5 max-w-sm self-end flex-row-reverse">
                <div className="w-8 h-8 rounded-full bg-accent-primary/30 border border-accent-primary/40 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  V
                </div>
                <div className="p-3 rounded-2xl bg-accent-primary/20 border border-accent-primary/30 text-xs text-white">
                  <div>Exportei com ProRes 4444 e canal alfa preservado! Veja como fica:</div>
                </div>
              </div>
            </div>
          )}

          {/* Video or Procedural Preview */}
          {isVideo ? (
            <video
              ref={videoRef}
              autoPlay
              loop
              playsInline
              muted={isMuted}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="max-h-[360px] max-w-[90%] object-contain drop-shadow-[0_15px_35px_rgba(0,0,0,0.6)]"
              style={{ backgroundColor: 'transparent' }}
            >
              {wink.webmUrl && <source src={wink.webmUrl} type="video/webm" />}
              {wink.mp4Url && <source src={wink.mp4Url} type="video/mp4" />}
            </video>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-6">
              <span className="text-8xl mb-3">{wink.previewEmoji}</span>
              <div className="text-lg font-bold text-white">{wink.name}</div>
              <div className="text-xs text-txt-secondary mt-1">Animação procedural padrão do Nuvio</div>
            </div>
          )}
        </div>

        {/* Video Controls Bar */}
        {isVideo && (
          <div className="px-6 py-2.5 bg-black/30 border-b border-white/[0.06] flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={handleTogglePlay}
                className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/15 text-white font-medium flex items-center gap-1.5 transition-colors"
              >
                {isPlaying ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    <span>Reproduzir</span>
                  </>
                )}
              </button>

              <button
                onClick={handleRestart}
                className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/15 text-white font-medium flex items-center gap-1.5 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                <span>Reiniciar</span>
              </button>
            </div>

            {/* Audio Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-1.5 rounded-lg transition-colors ${
                  isMuted ? 'text-red-400 hover:text-red-300' : 'text-txt-secondary hover:text-white'
                }`}
                title={isMuted ? 'Desmutar áudio' : 'Mutar áudio'}
              >
                {isMuted ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                )}
              </button>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-txt-tertiary">Vol:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(parseInt(e.target.value, 10))}
                  className="w-20 h-1 bg-white/20 rounded appearance-none cursor-pointer accent-accent-primary"
                />
                <span className="text-[11px] text-txt-secondary w-7">{volume}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Technical Inspector Specs */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="text-xs font-semibold text-txt-secondary uppercase tracking-wider">
            Informações Técnicas & Compatibilidade
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-txt-tertiary text-[11px]">Resolução</div>
              <div className="font-semibold text-white mt-0.5">
                {wink.width && wink.height ? `${wink.width} × ${wink.height}` : 'Automático'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-txt-tertiary text-[11px]">FPS</div>
              <div className="font-semibold text-white mt-0.5">{wink.fps ? `${wink.fps} fps` : '30 fps'}</div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-txt-tertiary text-[11px]">Canal Alfa (Transparência)</div>
              <div className="font-semibold mt-0.5">
                {wink.hasAlpha ? (
                  <span className="text-green-400">Ativo (Transparente)</span>
                ) : (
                  <span className="text-txt-secondary">Não (Opaco)</span>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-txt-tertiary text-[11px]">Áudio Integrado</div>
              <div className="font-semibold mt-0.5">
                {wink.hasAudio ? (
                  <span className="text-blue-400">Sim ({wink.audioCodec || 'Opus/AAC'})</span>
                ) : (
                  <span className="text-txt-secondary">Sem áudio</span>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-txt-tertiary text-[11px]">Codec de Origem</div>
              <div className="font-semibold text-white mt-0.5">{wink.videoCodec || 'ProRes / H.264'}</div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-txt-tertiary text-[11px]">Tamanho Original</div>
              <div className="font-semibold text-white mt-0.5">
                {wink.originalSize ? `${(wink.originalSize / (1024 * 1024)).toFixed(2)} MB` : '-'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-txt-tertiary text-[11px]">Versão WebM VP9</div>
              <div className="font-semibold text-white mt-0.5 truncate">
                {wink.webmUrl ? (
                  <a
                    href={wink.webmUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent-primary hover:underline"
                  >
                    Abrir WebM
                  </a>
                ) : (
                  '-'
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-txt-tertiary text-[11px]">Versão MP4 Fallback</div>
              <div className="font-semibold text-white mt-0.5 truncate">
                {wink.mp4Url ? (
                  <a
                    href={wink.mp4Url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent-primary hover:underline"
                  >
                    Abrir MP4
                  </a>
                ) : (
                  '-'
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
