import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { cropImage } from '../../utils/cropImage';
import { Avatar } from '../ui/Avatar';
import { getSpaceGradient } from '../../utils/gradients';
import type { AvatarColor } from '@concord/shared';

export interface SpaceCoverEditorProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onSave: (blob: Blob) => Promise<void> | void;
  spaceName: string;
  spaceIcon?: string | null;
  avatarColor?: AvatarColor | null;
  description?: string | null;
  visibility?: string;
  isJoined?: boolean;
}

const OFFICIAL_ASPECT_RATIO = 15 / 4; // 3.75
const MIN_WIDTH = 900;
const MIN_HEIGHT = 240;
const MAX_EXPORT_WIDTH = 1800;
const WEBP_QUALITY = 0.85;

export function SpaceCoverEditor({
  isOpen,
  onClose,
  imageSrc,
  onSave,
  spaceName,
  spaceIcon,
  avatarColor,
  description,
  visibility = 'public',
  isJoined = true,
}: SpaceCoverEditorProps) {
  const { t } = useTranslation(['spaces', 'common', 'uploads']);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPercent, setCroppedAreaPercent] = useState<Area | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dimensionError, setDimensionError] = useState<string | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  // Validate image dimensions on load
  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    setDimensionError(null);
    setIsImageLoaded(false);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (img.naturalWidth < MIN_WIDTH || img.naturalHeight < MIN_HEIGHT) {
        setDimensionError(t('spaces:coverEditor.minDimensionsError', {
          width: MIN_WIDTH,
          height: MIN_HEIGHT,
          defaultValue: `Escolha uma imagem com pelo menos ${MIN_WIDTH} × ${MIN_HEIGHT} pixels.`,
        }));
      } else {
        setIsImageLoaded(true);
      }
    };
    img.onerror = () => {
      setDimensionError(t('spaces:coverEditor.loadError', {
        defaultValue: 'Não foi possível carregar a imagem selecionada.',
      }));
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc, t]);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPercent(null);
      setCroppedAreaPixels(null);
      setIsProcessing(false);
      setPreviewMode('desktop');
    }
  }, [isOpen, imageSrc]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCropComplete = useCallback((croppedPercent: Area, croppedPixels: Area) => {
    setCroppedAreaPercent(croppedPercent);
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleResetFraming = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleZoomIn = () => {
    setZoom((z) => Math.min(3, Math.round((z + 0.2) * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(1, Math.round((z - 0.2) * 100) / 100));
  };

  const handleApply = async () => {
    if (!croppedAreaPixels || isProcessing) return;
    setIsProcessing(true);
    try {
      const blob = await cropImage(imageSrc, croppedAreaPixels, 'image/webp', {
        maxDimension: MAX_EXPORT_WIDTH,
        quality: WEBP_QUALITY,
        outputType: 'image/webp',
      });
      await onSave(blob);
      onClose();
    } catch {
      // Allow retry on failure
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  // Real-time CSS mapping for preview banner
  const liveCropStyle: React.CSSProperties = croppedAreaPercent
    ? {
        position: 'absolute',
        width: `${(100 / croppedAreaPercent.width) * 100}%`,
        height: `${(100 / croppedAreaPercent.height) * 100}%`,
        left: `-${(croppedAreaPercent.x / croppedAreaPercent.width) * 100}%`,
        top: `-${(croppedAreaPercent.y / croppedAreaPercent.height) * 100}%`,
        maxWidth: 'none',
        maxHeight: 'none',
        objectFit: 'cover',
      }
    : {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      };

  const fallbackGradient = getSpaceGradient('preview', spaceName || 'Space', avatarColor).gradient;
  const isPublic = visibility === 'public';

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-surface-elevated border border-border-hard rounded-xl shadow-2xl overflow-hidden my-auto animate-scale-in flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft bg-surface-elevated/90 sticky top-0 z-10 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-accent-primary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-txt-primary">
                {t('spaces:coverEditor.title', { defaultValue: 'Editar capa' })}
              </h2>
              <p className="text-[11px] text-txt-tertiary">
                {t('spaces:coverEditor.subtitle', { defaultValue: 'Proporção oficial 15:4 • Alta resolução' })}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-txt-tertiary hover:text-txt-primary hover:bg-surface-interactive transition-colors"
            aria-label={t('common:actions.close')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z" />
            </svg>
          </button>
        </div>

        {/* Dimension Error State */}
        {dimensionError ? (
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full bg-accent-rose/10 border border-accent-rose/30 flex items-center justify-center text-txt-danger mb-4">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-txt-primary mb-1.5">
              {t('spaces:coverEditor.dimensionErrorTitle', { defaultValue: 'Dimensões insuficientes' })}
            </h3>
            <p className="text-sm text-txt-secondary max-w-md mb-6 leading-relaxed">
              {dimensionError}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-surface-interactive hover:bg-surface-interactive/80 text-txt-primary text-sm font-medium rounded-lg transition-colors"
            >
              {t('common:actions.close')}
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Cropper Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-txt-secondary uppercase tracking-wider">
                  {t('spaces:coverEditor.cropAreaLabel', { defaultValue: 'Ajuste de enquadramento' })}
                </span>
                <button
                  type="button"
                  onClick={handleResetFraming}
                  className="flex items-center gap-1.5 text-xs text-accent-primary hover:text-accent-primary/80 transition-colors font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {t('spaces:coverEditor.resetFraming', { defaultValue: 'Restaurar enquadramento' })}
                </button>
              </div>

              {/* Cropper canvas with 15:4 mask */}
              <div
                className="relative h-[260px] sm:h-[300px] rounded-xl overflow-hidden bg-black/60 border border-border-soft shadow-inner"
                style={{ zoom: 'calc(1 / var(--interface-scale, 1))' }}
              >
                {isImageLoaded ? (
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={OFFICIAL_ASPECT_RATIO}
                    cropShape="rect"
                    showGrid={true}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={handleCropComplete}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-8 h-8 text-accent-primary animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Zoom Controls Bar */}
              <div className="flex items-center gap-3 bg-surface-base/60 border border-border-soft px-4 py-2.5 rounded-lg">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoom <= 1}
                  className="p-1 rounded text-txt-tertiary hover:text-txt-primary hover:bg-surface-interactive transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                  title={t('spaces:coverEditor.zoomOut', { defaultValue: 'Reduzir zoom' })}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                  </svg>
                </button>

                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.05}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 min-w-0 h-1.5 rounded-full appearance-none bg-surface-input accent-accent-primary cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-primary shadow-sm"
                  />
                  <span className="text-[11px] font-mono text-txt-tertiary w-10 text-right">
                    {Math.round(zoom * 100)}%
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoom >= 3}
                  className="p-1 rounded text-txt-tertiary hover:text-txt-primary hover:bg-surface-interactive transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                  title={t('spaces:coverEditor.zoomIn', { defaultValue: 'Aumentar zoom' })}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Live Dual Preview Section */}
            <div className="pt-2 border-t border-border-soft">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <span className="text-xs font-semibold text-txt-secondary uppercase tracking-wider block">
                    {t('spaces:coverEditor.livePreviewLabel', { defaultValue: 'Pré-visualização em tempo real' })}
                  </span>
                  <span className="text-[11px] text-txt-tertiary">
                    {previewMode === 'desktop'
                      ? t('spaces:coverEditor.desktopPreviewDesc', { defaultValue: 'Exibição oficial no card de exploração para desktop' })
                      : t('spaces:coverEditor.mobilePreviewDesc', { defaultValue: 'Enquadramento compacto em telas de dispositivos móveis' })}
                  </span>
                </div>

                {/* Desktop / Mobile Switcher */}
                <div className="flex items-center gap-1 bg-surface-base p-1 rounded-lg border border-border-soft self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('desktop')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
                      previewMode === 'desktop'
                        ? 'bg-surface-elevated text-txt-primary shadow-sm border border-border-hard'
                        : 'text-txt-tertiary hover:text-txt-secondary'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {t('spaces:coverEditor.desktopTab', { defaultValue: 'Desktop' })}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewMode('mobile')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
                      previewMode === 'mobile'
                        ? 'bg-surface-elevated text-txt-primary shadow-sm border border-border-hard'
                        : 'text-txt-tertiary hover:text-txt-secondary'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
                    </svg>
                    {t('spaces:coverEditor.mobileTab', { defaultValue: 'Mobile' })}
                  </button>
                </div>
              </div>

              {/* Preview Container */}
              <div className="flex justify-center p-4 bg-surface-base/40 rounded-xl border border-border-soft overflow-hidden">
                <div
                  className={`transition-all duration-300 w-full ${
                    previewMode === 'desktop' ? 'max-w-md' : 'max-w-[310px]'
                  }`}
                >
                  {/* Space Card Replica */}
                  <div className="bg-surface-channel rounded-lg border border-border-soft overflow-hidden flex flex-col shadow-lg pointer-events-none select-none">
                    {/* Official 15:4 Aspect Ratio Banner Area */}
                    <div className="w-full aspect-[15/4] relative overflow-hidden group/cardbanner bg-black/40">
                      {/* Background image dynamically mapped from cropper */}
                      <img
                        src={imageSrc}
                        alt=""
                        style={liveCropStyle}
                        className="transition-none"
                      />

                      {/* Frosted bottom fade */}
                      <div
                        className="absolute bottom-0 inset-x-0 h-16 pointer-events-none"
                        style={{ background: 'linear-gradient(to top, rgba(20,20,26,0.9), transparent)' }}
                      />

                      {/* Joined badge (top-left) */}
                      {isJoined && (
                        <div className="absolute top-2 left-2 z-[2]">
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent-mint/25 text-accent-mint backdrop-blur-sm">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                            {t('spaces:explore.badges.joined', { defaultValue: 'Participando' })}
                          </span>
                        </div>
                      )}

                      {/* Visibility badge (top-right) */}
                      <div className="absolute top-2 right-2 z-[2]">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm ${
                            isPublic ? 'bg-accent-mint/20 text-accent-mint' : 'bg-accent-amber/20 text-accent-amber'
                          }`}
                        >
                          {isPublic
                            ? t('spaces:explore.badges.public', { defaultValue: 'Público' })
                            : t('spaces:explore.badges.request', { defaultValue: 'Solicitação' })}
                        </span>
                      </div>
                    </div>

                    {/* Overlapping icon */}
                    <div className="relative px-4 -mt-8 z-10">
                      <div className="relative inline-block">
                        <Avatar
                          src={spaceIcon}
                          name={spaceName || 'Nuvio'}
                          size={56}
                          avatarColor={avatarColor}
                        />
                        <div
                          className="absolute inset-0 rounded-full border-2 border-surface-channel pointer-events-none"
                        />
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-4 pt-2 flex flex-col flex-1">
                      <h3 className="font-bold text-sm text-txt-primary truncate">
                        {spaceName || t('spaces:coverEditor.defaultSpaceName', { defaultValue: 'Espaço Nuvio' })}
                      </h3>
                      <p className="text-xs text-txt-secondary line-clamp-2 mt-1 mb-3">
                        {description || t('spaces:coverEditor.previewDescPlaceholder', {
                          defaultValue: 'Espaço público da comunidade no Nuvio.',
                        })}
                      </p>

                      <div className="mt-auto pt-2 border-t border-border-soft flex items-center justify-between">
                        <span className="text-[11px] text-txt-tertiary">
                          12 {t('spaces:members.title', { defaultValue: 'membros' })}
                        </span>
                        <div className="px-3 py-1 text-xs font-medium rounded bg-accent-primary/20 text-accent-primary border border-accent-primary/30">
                          {t('spaces:explore.actions.view', { defaultValue: 'Ver espaço' })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {!dimensionError && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border-soft bg-surface-elevated/90 sticky bottom-0 z-10 backdrop-blur-sm">
            <span className="text-[11px] text-txt-tertiary hidden sm:inline">
              {t('spaces:coverEditor.formatNote', { defaultValue: 'Exportação em 1800 × 480 px • WebP 85%' })}
            </span>

            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="px-4 py-2 bg-surface-interactive hover:bg-surface-interactive/80 text-txt-secondary hover:text-txt-primary text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {t('common:actions.cancel')}
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={isProcessing || !croppedAreaPixels || !isImageLoaded}
                className="flex items-center gap-1.5 px-5 py-2 bg-accent-primary hover:bg-accent-primary/80 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>{t('spaces:coverEditor.saving', { defaultValue: 'Salvando...' })}</span>
                  </>
                ) : (
                  <span>{t('spaces:coverEditor.saveAction', { defaultValue: 'Salvar capa' })}</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
