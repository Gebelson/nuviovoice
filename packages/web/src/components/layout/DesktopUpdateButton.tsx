import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { isElectron } from '../../platform/platform';
import { useUpdateStore } from '../../stores/updateStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { CallActiveUpdateModal } from '../modals/CallActiveUpdateModal';

export function DesktopUpdateButton() {
  const { t } = useTranslation(['desktop', 'common']);
  const isDesktop = isElectron();
  const initialize = useUpdateStore((s) => s.initialize);
  const snapshot = useUpdateStore((s) => s.snapshot);
  const install = useUpdateStore((s) => s.install);
  const checkNow = useUpdateStore((s) => s.checkNow);
  const openDownloadPage = useUpdateStore((s) => s.openDownloadPage);

  const inActiveCall = useVoiceStore((s) => Boolean(s.currentVoiceChannelId || s.activeDmCall));
  const [showCallWarning, setShowCallWarning] = useState(false);

  useEffect(() => {
    if (isDesktop) {
      return initialize();
    }
  }, [isDesktop, initialize]);

  if (!isDesktop || !snapshot || snapshot.capability === 'external') {
    return null;
  }

  const { status, capability } = snapshot;
  const phase = status.phase;

  // Only show when there is an active actionable update state
  if (
    phase !== 'available' &&
    phase !== 'downloading' &&
    phase !== 'ready' &&
    phase !== 'failed' &&
    phase !== 'installing'
  ) {
    return null;
  }

  const isInstallFailed = phase === 'failed' && 'stage' in status && status.stage === 'install';

  const handleAction = () => {
    if (phase === 'ready' || isInstallFailed) {
      if (inActiveCall) {
        setShowCallWarning(true);
        return;
      }
      install();
    } else if (phase === 'available') {
      if (capability === 'auto') {
        install();
      } else {
        openDownloadPage();
      }
    } else if (phase === 'failed') {
      checkNow();
    }
  };

  const percent =
    phase === 'downloading' && 'percent' in status
      ? Math.max(0, Math.min(100, Math.round(status.percent)))
      : 0;
  const version = 'version' in status && status.version ? status.version : undefined;

  const isDisabled = phase === 'downloading' || phase === 'installing';

  let label: string;
  let colorClasses: string;

  if (phase === 'ready') {
    label = t('desktop:update.button.ready', 'Reiniciar e atualizar');
    colorClasses = 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-300';
  } else if (phase === 'downloading') {
    label = t('desktop:update.button.downloading', 'Baixando {{percent}}%', { percent });
    colorClasses = 'bg-sky-500/10 border-sky-500/25 text-sky-300 cursor-default';
  } else if (phase === 'installing') {
    label = t('desktop:update.button.installing', 'Instalando...');
    colorClasses = 'bg-accent-primary/20 border-accent-primary/30 text-accent-primary cursor-wait';
  } else if (isInstallFailed) {
    label = t('desktop:update.button.retryInstall', 'Reiniciar para instalar');
    colorClasses = 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-300';
  } else if (phase === 'failed') {
    label = t('desktop:update.button.failed', 'Falha na atualização • Tentar novamente');
    colorClasses = 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/30 text-rose-300';
  } else {
    label = t('desktop:update.button.available', 'Atualizar Nuvio');
    colorClasses = 'bg-accent-primary/20 hover:bg-accent-primary/30 border-accent-primary/30 text-white';
  }

  return (
    <>
      <div className="w-full mb-1.5 px-1 animate-slide-up">
        <button
          type="button"
          onClick={handleAction}
          disabled={isDisabled}
          title={version}
          className={`w-full relative overflow-hidden py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition-all shadow-sm group ${colorClasses}`}
        >
          {/* Progress fill bar for downloading */}
          {phase === 'downloading' && (
            <div
              className="absolute inset-y-0 left-0 bg-sky-500/20 transition-[width] duration-300 pointer-events-none"
              style={{ width: `${percent}%` }}
            />
          )}

          <div className="relative z-10 flex items-center gap-2 truncate">
            {phase === 'ready' || isInstallFailed ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-emerald-400">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19" />
              </svg>
            ) : phase === 'downloading' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-sky-400 animate-pulse">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            ) : phase === 'installing' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0 animate-spin text-accent-primary">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : phase === 'failed' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-rose-400">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-accent-mint group-hover:translate-y-0.5 transition-transform">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}

            <span className="truncate">{label}</span>
          </div>

          {version && (
            <span className="relative z-10 shrink-0 text-[10px] font-mono opacity-80 px-1.5 py-0.5 rounded bg-black/20">
              {version}
            </span>
          )}
        </button>
      </div>

      <CallActiveUpdateModal
        isOpen={showCallWarning}
        onClose={() => setShowCallWarning(false)}
        onConfirm={() => {
          setShowCallWarning(false);
          install();
        }}
      />
    </>
  );
}
