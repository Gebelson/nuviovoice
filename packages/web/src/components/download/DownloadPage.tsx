import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { isElectron } from '../../platform/platform';
import { MemberListToggleButton } from '../layout/MemberListToggleButton';

const DEFAULT_WINDOWS_DOWNLOAD_ENDPOINT = '/api/download/windows';
const GITHUB_LATEST_RELEASE_API = 'https://api.github.com/repos/Gebelson/nuviovoice/releases/latest';

export function DownloadPage() {
  const { t } = useTranslation(['spaces', 'common']);
  const [downloadUrl, setDownloadUrl] = useState<string>(DEFAULT_WINDOWS_DOWNLOAD_ENDPOINT);
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [version, setVersion] = useState<string | null>(null);

  // Download page is exclusive to Nuvio Web
  if (isElectron()) {
    return <Navigate to="/channels/@me" replace />;
  }

  useEffect(() => {
    let active = true;

    async function checkAvailability() {
      try {
        // 1. Try internal backend route first
        const res = await fetch('/api/download/info');
        if (res.ok) {
          const data = await res.json();
          if (active) {
            if (data.available && data.downloadUrl) {
              setIsAvailable(true);
              setDownloadUrl(data.downloadUrl || DEFAULT_WINDOWS_DOWNLOAD_ENDPOINT);
              if (data.version) setVersion(data.version);
              setIsChecking(false);
              return;
            } else if (data.available === false) {
              setIsAvailable(false);
              setIsChecking(false);
              return;
            }
          }
        }
      } catch {
        // fallback to public GitHub Releases API
      }

      // 2. Fallback to public GitHub Releases check
      try {
        const ghRes = await fetch(GITHUB_LATEST_RELEASE_API, {
          headers: { Accept: 'application/vnd.github.v3+json' },
        });
        if (ghRes.ok) {
          const release = await ghRes.json();
          const winAsset = (release.assets || []).find((a: any) =>
            typeof a.name === 'string' && a.name.endsWith('.exe'),
          );
          if (active) {
            if (winAsset && !release.draft && !release.prerelease) {
              setIsAvailable(true);
              setDownloadUrl(winAsset.browser_download_url || DEFAULT_WINDOWS_DOWNLOAD_ENDPOINT);
              setVersion(release.tag_name ? release.tag_name.replace(/^v/, '') : null);
            } else {
              setIsAvailable(false);
            }
          }
        } else {
          if (active) setIsAvailable(false);
        }
      } catch {
        // In case of complete network failure, keep available with endpoint
        if (active) setIsAvailable(true);
      } finally {
        if (active) setIsChecking(false);
      }
    }

    checkAvailability();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-surface-chat h-full min-w-0 select-none">
      {/* Header bar */}
      <div className="h-12 px-5 flex items-center justify-between border-b border-border-hard flex-shrink-0 z-10 bg-surface-chat">
        <div className="flex items-center gap-2">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-txt-primary"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span
            data-testid="download-header-title"
            className="font-bold text-[15px] tracking-[-0.02em] text-txt-primary"
          >
            {t('spaces:downloadPage.headerTitle')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <MemberListToggleButton />
        </div>
      </div>

      {/* Main hero body */}
      <div className="flex-1 overflow-y-auto flex flex-col justify-center items-center px-6 py-8 sm:px-10 lg:px-16 no-scrollbar">
        <div className="w-full max-w-[1120px] mx-auto my-auto flex flex-col items-center">
          {/* Two-column layout: Mockup (left) and Text (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center w-full">
            {/* Left: Laptop and Monitor mockup */}
            <div className="flex items-center justify-center relative w-full">
              <img
                src="/images/mockup-laptop-monitor.png"
                alt={t('spaces:downloadPage.mockupAlt')}
                className="w-full max-w-[540px] h-auto object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.55)] transition-transform duration-300 hover:scale-[1.01]"
                loading="eager"
              />
            </div>

            {/* Right: Title & Supporting Text */}
            <div className="flex flex-col justify-center text-left space-y-6 max-w-xl mx-auto lg:mx-0">
              <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-black tracking-tight text-white uppercase leading-[1.1] whitespace-pre-line">
                {t('spaces:downloadPage.heroTitle')}
              </h1>
              <p className="text-base sm:text-lg text-txt-secondary leading-relaxed font-normal">
                {t('spaces:downloadPage.heroSubtitle')}
              </p>
              {version && (
                <div className="inline-flex items-center gap-2 text-xs font-medium text-txt-tertiary">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>{t('spaces:downloadPage.versionLabel', { version })}</span>
                </div>
              )}
            </div>
          </div>

          {/* Centered Download CTA Button or Coming Soon Banner */}
          <div className="mt-10 lg:mt-14 flex flex-col items-center justify-center w-full gap-4">
            {isAvailable ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full max-w-lg">
                <a
                  href={downloadUrl}
                  download="Nuvio-Setup.exe"
                  data-testid="download-windows-btn"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-3.5 bg-white text-black font-bold text-[15px] rounded-lg shadow-lg hover:bg-white/90 active:scale-[0.98] transition-all duration-150 group cursor-pointer"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-black group-hover:translate-y-0.5 transition-transform"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>{t('spaces:downloadPage.downloadForWindows')}</span>
                </a>

                {import.meta.env.VITE_MICROSOFT_STORE_URL && (
                  <a
                    href={import.meta.env.VITE_MICROSOFT_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="download-msstore-btn"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-surface-base border border-border-hard text-txt-primary hover:text-white font-semibold text-[14px] rounded-lg shadow hover:bg-interactive-hover active:scale-[0.98] transition-all duration-150"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M0 0h11.377v11.372H0zM12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zM12.623 12.623H24V24H12.623z" />
                    </svg>
                    <span>{t('spaces:downloadPage.installFromStore')}</span>
                  </a>
                )}
              </div>
            ) : (
              <div
                data-testid="download-unavailable-msg"
                className="px-6 py-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-center max-w-md"
              >
                <p className="text-[15px] text-txt-secondary font-medium">
                  {t('spaces:downloadPage.comingSoon')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
