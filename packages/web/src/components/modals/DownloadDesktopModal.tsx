import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../ui/Modal';
import { useUIStore } from '../../stores/uiStore';
import { api } from '../../api/client';
import { RELEASES_URL } from '../../platform/desktopDownload';

const GITHUB_LATEST_RELEASE_API = 'https://api.github.com/repos/Gebelson/nuviovoice/releases/latest';
const LATEST_WINDOWS_INSTALLER_URL = `${RELEASES_URL}/latest/download/Nuvio-Setup.exe`;

interface GitHubReleaseAsset {
  name?: string;
  browser_download_url?: string;
}

interface GitHubReleaseResponse {
  tag_name?: string;
  assets?: GitHubReleaseAsset[];
}

export function DownloadDesktopModal() {
  const { t } = useTranslation(['spaces', 'settings', 'common']);
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);

  const isOpen = activeModal === 'downloadDesktop';

  const [version, setVersion] = useState<string>('1.12.0');
  const [installerUrl, setInstallerUrl] = useState<string>(LATEST_WINDOWS_INSTALLER_URL);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    api.instance
      .info()
      .then((info) => {
        if (!cancelled && info?.version) {
          setVersion(info.version.replace(/^v/i, ''));
        }
      })
      .catch(() => {});

    fetch(GITHUB_LATEST_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as GitHubReleaseResponse;
      })
      .then((release) => {
        if (cancelled || !release) return;
        if (typeof release.tag_name === 'string' && release.tag_name.trim()) {
          setVersion(release.tag_name.replace(/^v/i, ''));
        }
        const exeAsset =
          release.assets?.find(
            (a) =>
              typeof a.name === 'string' &&
              typeof a.browser_download_url === 'string' &&
              /^Nuvio-Setup\.exe$/i.test(a.name),
          ) ??
          release.assets?.find(
            (a) =>
              typeof a.name === 'string' &&
              typeof a.browser_download_url === 'string' &&
              a.name.toLowerCase().endsWith('.exe'),
          );
        if (exeAsset?.browser_download_url) {
          setInstallerUrl(exeAsset.browser_download_url);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title={t('spaces:sidebar.dmList.downloadNuvio')}
    >
      <div className="space-y-5">
        {/* Hero Card */}
        <div className="rounded-xl border border-accent-primary/25 bg-white/[0.03] p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-accent-primary/15 border border-accent-primary/30 flex items-center justify-center flex-shrink-0">
            <img
              src="/icons/logo-mark.svg"
              alt={t('common:appName')}
              className="w-8 h-auto select-none pointer-events-none"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-txt-primary">
                {t('settings:desktop.updates.appName')}
              </h3>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-mint/15 border border-accent-mint/30 px-2.5 py-0.5 text-[11px] font-semibold text-accent-mint">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-mint" />
                {t('settings:desktopDownload.version', { version })}
              </span>
            </div>
            <p className="text-xs text-txt-secondary mt-1">
              {t('settings:desktopDownload.name.windows')} • {t('settings:desktopDownload.covers.windows')}
            </p>
            <p className="text-xs text-txt-tertiary mt-1.5">
              {t('settings:desktopDownload.intro')}
            </p>
          </div>
        </div>

        {/* Download CTA & Footer */}
        <div className="pt-2 border-t border-border-soft flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-txt-tertiary hover:text-txt-primary transition-colors text-center sm:text-left"
          >
            {t('settings:desktopDownload.allReleases')}
          </a>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 rounded-lg text-xs font-medium text-txt-secondary hover:text-txt-primary hover:bg-surface-interactive transition-colors"
            >
              {t('common:actions.close')}
            </button>
            <a
              href={installerUrl}
              target="_blank"
              rel="noopener noreferrer"
              download="Nuvio-Setup.exe"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-accent-primary hover:bg-accent-primary-hover transition-colors shadow-sm"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>{t('settings:desktopDownload.download.windows')}</span>
            </a>
          </div>
        </div>
      </div>
    </Modal>
  );
}
