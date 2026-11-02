import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useUpdateStore,
  shouldPrompt,
  canRestartToInstall,
  statusVersion,
} from '../../stores/updateStore';
import { useUIStore } from '../../stores/uiStore';
import { useVoiceStore } from '../../stores/voiceStore';

export function UpdateToast() {
  const { t } = useTranslation(['desktop', 'common']);
  const initialize = useUpdateStore((s) => s.initialize);
  const snapshot = useUpdateStore((s) => s.snapshot);
  const currentVersion = useUpdateStore((s) => s.currentVersion);
  const dismiss = useUpdateStore((s) => s.dismiss);
  const install = useUpdateStore((s) => s.install);
  const openDownloadPage = useUpdateStore((s) => s.openDownloadPage);
  const addToast = useUIStore((s) => s.addToast);
  const inActiveCall = useVoiceStore((s) => Boolean(s.currentVoiceChannelId));
  const [confirmedInCall, setConfirmedInCall] = useState(false);

  useEffect(() => initialize(), [initialize]);

  useEffect(() => {
    if (!inActiveCall) setConfirmedInCall(false);
  }, [inActiveCall]);

  if (!shouldPrompt(snapshot) || snapshot === null) return null;

  const version = statusVersion(snapshot.status);
  if (version === null) return null;

  const canRestart = canRestartToInstall(snapshot);
  const phase = snapshot.status.phase;
  const isDownloading = phase === 'downloading';
  const failed = phase === 'failed';
  const isInstallFailed =
    failed && 'stage' in snapshot.status && snapshot.status.stage === 'install';

  const percent =
    isDownloading && 'percent' in snapshot.status
      ? Math.max(0, Math.min(100, Math.round(snapshot.status.percent)))
      : 0;

  const handleLater = () => {
    dismiss();
    addToast(t('desktop:update.laterHint'), 'info', 5000);
  };

  const handleInstallClick = () => {
    if (inActiveCall && !confirmedInCall) {
      setConfirmedInCall(true);
      addToast(t('desktop:update.laterHint'), 'warning', 5000);
      return;
    }
    install();
  };

  let title: string;
  let body: string;
  if (isInstallFailed) {
    title = t('desktop:update.installFailed.title', 'Não foi possível instalar a atualização');
    body = t(
      'desktop:update.installFailed.body',
      'O Nuvio {{version}} foi baixado, mas não pôde ser instalado automaticamente. Você pode tentar reiniciar novamente ou instalá-lo manualmente.',
      { version }
    );
  } else if (failed) {
    title = t('desktop:update.failed.title');
    body = t('desktop:update.failed.body', { version });
  } else if (isDownloading) {
    title = t('desktop:update.downloading.title', 'Nova atualização disponível — Nuvio {{version}}', { version });
    body = t(
      'desktop:update.downloading.body',
      'Baixando atualização ({{percent}}%). O Nuvio continuará funcionando normalmente.',
      { version, percent }
    );
  } else if (canRestart) {
    title = t('desktop:update.ready.title');
    body = t('desktop:update.ready.body', { version });
  } else {
    title = t('desktop:update.available.title', { version });
    body = currentVersion
      ? t('desktop:update.available.bodyWithCurrent', { currentVersion })
      : t('desktop:update.available.body');
  }

  return (
    <div className="fixed bottom-6 left-6 z-[300] animate-slide-up max-w-[calc(calc(100*var(--app-vw))-3rem)]">
      <div className="glass-bubble rounded-2xl p-4 w-[380px] max-w-full">
        <div className="flex items-start gap-3">
          <div
            className={`shrink-0 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center ${
              failed
                ? 'bg-accent-rose/15 text-accent-rose'
                : isDownloading
                ? 'bg-sky-500/15 text-sky-400'
                : 'bg-accent-primary/15 text-accent-primary'
            }`}
            aria-hidden="true"
          >
            {failed ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              </svg>
            ) : isDownloading ? (
              <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0 4-4m-4 4-4-4M4 20h16" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0 4-4m-4 4-4-4M4 20h16" />
              </svg>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-txt-primary">{title}</p>
              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-accent-primary/15 text-accent-primary">
                {version}
              </span>
            </div>
            <p className="text-xs text-txt-secondary mt-1 leading-relaxed">{body}</p>
          </div>

          <button
            onClick={handleLater}
            className="shrink-0 -mt-1 -mr-1 p-1.5 rounded-lg text-txt-tertiary hover:text-txt-secondary hover:bg-white/[0.06] transition-colors"
            aria-label={t('desktop:update.dismiss')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress bar for downloading */}
        {isDownloading && (
          <div className="mt-2.5 pl-11 pr-2">
            <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
              <div
                className="h-full bg-accent-primary transition-[width] duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-txt-tertiary mt-1">
              <span>{percent}%</span>
              {'bytesPerSecond' in snapshot.status && snapshot.status.bytesPerSecond > 0 && (
                <span>{t('desktop:update.rateKilobytes', { value: Math.round(snapshot.status.bytesPerSecond / 1024), defaultValue: '{{value}} KB/s' })}</span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 mt-3.5 pl-11">
          {canRestart ? (
            <button
              onClick={handleInstallClick}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-primary hover:bg-accent-primary/80 text-white transition-colors"
            >
              {t('desktop:update.restartNow')}
            </button>
          ) : isInstallFailed ? (
            <>
              <button
                onClick={handleInstallClick}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-primary hover:bg-accent-primary/80 text-white transition-colors"
              >
                {t('desktop:update.restartNow')}
              </button>
              <button
                onClick={openDownloadPage}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-txt-secondary hover:text-txt-primary hover:bg-white/[0.06] transition-colors"
              >
                {t('desktop:update.download')}
              </button>
            </>
          ) : isDownloading ? (
            <div className="px-2.5 py-1 text-xs text-txt-tertiary italic">
              {t('desktop:update.downloadingProgress', 'Baixando nos bastidores...')}
            </div>
          ) : (
            <button
              onClick={openDownloadPage}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-primary hover:bg-accent-primary/80 text-white transition-colors"
            >
              {t('desktop:update.download')}
            </button>
          )}
          <button
            onClick={handleLater}
            className="px-3 py-1.5 text-xs font-medium rounded-lg text-txt-secondary hover:text-txt-primary hover:bg-white/[0.06] transition-colors"
          >
            {t('desktop:update.later')}
          </button>
        </div>
      </div>
    </div>
  );
}
