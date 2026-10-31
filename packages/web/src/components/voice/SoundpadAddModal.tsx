import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSoundpadStore } from '../../stores/soundpadStore';
import { AudioManager } from '../../audio/AudioManager';
import type { SoundScope } from '@concord/shared';

interface SoundpadAddModalProps {
  open: boolean;
  onClose: () => void;
  spaceId?: string | null;
  canManageSoundpad?: boolean;
}

const QUICK_EMOJIS = ['📢', '💥', '🎺', '🗿', '😱', '🥶', '🔨', '👌', '👁️', '🗣️', '🥁', '🎻', '🦗', '⚡', '🎉', '🎵', '🎮', '💣'];
const DEFAULT_CATEGORIES = ['Memes', 'Jogos', 'Música', 'Reações', 'Efeitos', 'Personalizados'];

export function SoundpadAddModal({ open, onClose, spaceId, canManageSoundpad }: SoundpadAddModalProps) {
  const { t } = useTranslation(['voice', 'common']);
  const createSound = useSoundpadStore((s) => s.createSound);

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🎵');
  const [category, setCategory] = useState('Personalizados');
  const [scope, setScope] = useState<SoundScope>('personal');
  const [volume, setVolume] = useState(1.0);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio preview state
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const stopPreview = useCallback(() => {
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
        previewSourceRef.current.disconnect();
      } catch {}
      previewSourceRef.current = null;
    }
    setIsPlayingPreview(false);
  }, []);

  // Reset on open
  useEffect(() => {
    if (open) {
      setFile(null);
      setName('');
      setEmoji('🎵');
      setCategory('Personalizados');
      setScope('personal');
      setVolume(1.0);
      setDuration(0);
      setStartTime(0);
      setEndTime(0);
      setIsSubmitting(false);
      setError(null);
      setAudioBuffer(null);
      setIsPlayingPreview(false);
    }
  }, [open]);

  // Stop preview on unmount/close
  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, []);

  if (!open) return null;

  const handleFileChange = async (selectedFile: File) => {
    setError(null);
    stopPreview();

    // Max 10MB
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('O arquivo deve ter no máximo 10 MB.');
      return;
    }

    setFile(selectedFile);
    if (!name) {
      const cleanName = selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setName(cleanName.slice(0, 32));
    }

    try {
      const arrayBuf = await selectedFile.arrayBuffer();
      const audioCtx = AudioManager.getInstance().ensureContext();
      const decoded = await audioCtx.decodeAudioData(arrayBuf);
      setAudioBuffer(decoded);
      const dur = decoded.duration;
      setDuration(dur);
      setStartTime(0);
      setEndTime(Math.min(30, dur));
      drawWaveform(decoded);
    } catch (err) {
      console.error('[SoundpadAddModal] Failed to decode audio file:', err);
      setError('Formato de áudio não suportado ou arquivo corrompido.');
    }
  };

  const drawWaveform = (buffer: AudioBuffer) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = buffer.getChannelData(0);
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.fillStyle = '#6366f1'; // accent indigo
    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j] ?? 0;
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      const y1 = (1 + min) * amp;
      const y2 = Math.max(y1 + 1, (1 + max) * amp);
      ctx.fillRect(i, y1, 1, y2 - y1);
    }
  };


  const togglePreview = () => {
    if (isPlayingPreview) {
      stopPreview();
      return;
    }

    if (!audioBuffer) return;
    const audioCtx = AudioManager.getInstance().ensureContext();
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);

    source.connect(gain);
    gain.connect(audioCtx.destination);

    const playDuration = Math.max(0.1, endTime - startTime);
    source.start(0, startTime, playDuration);
    previewSourceRef.current = source;
    setIsPlayingPreview(true);

    source.onended = () => {
      setIsPlayingPreview(false);
      previewSourceRef.current = null;
    };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !audioBuffer) {
      setError('Selecione um arquivo de áudio válido.');
      return;
    }
    if (!name.trim()) {
      setError('Informe um nome para o som.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    stopPreview();

    try {
      // If trimmed, slice the AudioBuffer and encode as WAV
      const audioCtx = AudioManager.getInstance().ensureContext();
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor(startTime * sampleRate);
      const endSample = Math.min(audioBuffer.length, Math.floor(endTime * sampleRate));
      const frameCount = Math.max(1, endSample - startSample);

      const trimmedBuffer = audioCtx.createBuffer(
        audioBuffer.numberOfChannels,
        frameCount,
        sampleRate
      );

      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const srcData = audioBuffer.getChannelData(ch);
        const dstData = trimmedBuffer.getChannelData(ch);
        dstData.set(srcData.subarray(startSample, endSample));
      }

      // Convert to WAV base64
      const wavBase64 = bufferToWavBase64(trimmedBuffer);

      await createSound({
        name: name.trim(),
        audioBase64: wavBase64,
        format: 'wav',
        scope,
        spaceId: scope === 'space' ? spaceId : null,
        category: category.trim() || 'Personalizados',
        emoji: emoji || '🎵',
        defaultVolume: volume,
        durationMs: Math.round((endTime - startTime) * 1000),
      });

      onClose();
    } catch (err: any) {
      console.error('[SoundpadAddModal] Upload failed:', err);
      setError(err?.message || 'Falha ao enviar som. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div
        className="w-full max-w-lg bg-surface-chat border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto no-scrollbar text-txt-primary"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{emoji}</span>
            <h2 className="text-lg font-bold text-white">Adicionar Som ao Soundpad</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-txt-tertiary hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 mt-4">
          {/* File input / dropzone */}
          <div>
            <label className="text-xs font-bold text-txt-tertiary uppercase tracking-wider block mb-1.5">
              Arquivo de Áudio (MP3, WAV, OGG, WebM - Max 10MB, 30s)
            </label>
            <div className="relative border border-dashed border-white/15 hover:border-accent-primary/60 rounded-2xl p-4 text-center bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer">
              <input
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.webm,.m4a,.aac"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFileChange(f);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-2xl">📁</span>
                <span className="text-xs font-semibold text-white">
                  {file ? file.name : 'Clique ou arraste um arquivo de áudio'}
                </span>
                <span className="text-[11px] text-txt-tertiary">
                  {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB • ${(duration).toFixed(1)}s` : 'MP3, WAV, OGG até 30 segundos'}
                </span>
              </div>
            </div>
          </div>

          {/* Waveform and Trimmer (when audio is loaded) */}
          {audioBuffer && (
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>✂️</span> Editor e Corte do Efeito
                </span>
                <button
                  type="button"
                  onClick={togglePreview}
                  className="px-3 py-1 rounded-lg bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  {isPlayingPreview ? '⏹ Parar' : '▶ Ouvir Prévia'}
                </button>
              </div>

              <div className="relative w-full h-16 bg-surface-base rounded-xl overflow-hidden border border-white/5">
                <canvas ref={canvasRef} width={420} height={64} className="w-full h-full" />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-txt-tertiary block mb-1">Início: {startTime.toFixed(2)}s</span>
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    step={0.05}
                    value={startTime}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setStartTime(Math.min(val, endTime - 0.1));
                    }}
                    className="w-full accent-accent-primary"
                  />
                </div>
                <div>
                  <span className="text-txt-tertiary block mb-1">Fim: {endTime.toFixed(2)}s (Duração: {(endTime - startTime).toFixed(2)}s)</span>
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    step={0.05}
                    value={endTime}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setEndTime(Math.max(val, startTime + 0.1));
                    }}
                    className="w-full accent-accent-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sound Name & Emoji */}
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3">
              <label className="text-xs font-bold text-txt-tertiary uppercase tracking-wider block mb-1.5">
                Nome do Som
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Risada Épica"
                maxLength={48}
                className="w-full bg-surface-channel border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-txt-tertiary focus:outline-none focus:border-accent-primary"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-txt-tertiary uppercase tracking-wider block mb-1.5">
                Emoji
              </label>
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                maxLength={4}
                className="w-full bg-surface-channel border border-white/10 rounded-xl px-3 py-2 text-center text-lg text-white focus:outline-none focus:border-accent-primary"
              />
            </div>
          </div>

          {/* Quick Emoji selection */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {QUICK_EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => setEmoji(em)}
                className={`w-7 h-7 rounded-lg text-base flex items-center justify-center transition-all ${
                  emoji === em ? 'bg-accent-primary text-white scale-110 shadow' : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                {em}
              </button>
            ))}
          </div>

          {/* Category & Scope */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="font-bold text-txt-tertiary uppercase tracking-wider block mb-1.5">
                Categoria
              </label>
              <input
                type="text"
                list="soundpad-categories-list"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-surface-channel border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-accent-primary"
              />
              <datalist id="soundpad-categories-list">
                {DEFAULT_CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="font-bold text-txt-tertiary uppercase tracking-wider block mb-1.5">
                Destino
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as SoundScope)}
                className="w-full bg-surface-channel border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-accent-primary"
              >
                <option value="personal">Minha biblioteca pessoal</option>
                {spaceId && canManageSoundpad && (
                  <option value="space">Biblioteca do espaço</option>
                )}
              </select>
            </div>
          </div>

          {/* Volume slider */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-txt-tertiary uppercase tracking-wider">Volume Padrão</span>
              <span className="font-bold text-white">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full accent-accent-primary"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-txt-secondary hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !file}
              className="px-6 py-2 rounded-xl bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-accent-primary/20 active:scale-95 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                'Adicionar Som'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Encodes an AudioBuffer into standard 16-bit PCM WAV base64 string
 */
function bufferToWavBase64(buffer: AudioBuffer): string {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const numSamples = buffer.length;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // Write RIFF header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels
  let offset = 44;
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = channels[ch];
      const val = channelData ? (channelData[i] ?? 0) : 0;
      const sample = Math.max(-1, Math.min(1, val));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  // Convert arrayBuffer to base64
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    const b = bytes[i] ?? 0;
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}
