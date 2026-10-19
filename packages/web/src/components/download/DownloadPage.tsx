import React from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { isElectron } from '../../platform/platform';
import { MemberListToggleButton } from '../layout/MemberListToggleButton';

const WINDOWS_DOWNLOAD_URL = 'https://github.com/Gebelson/nuviovoice/releases/latest/download/Nuvio-Setup.exe';

export function DownloadPage() {
  const { t } = useTranslation(['spaces', 'common']);

  // Download page is exclusive to Nuvio Web
  if (isElectron()) {
    return <Navigate to="/channels/@me" replace />;
  }

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
            </div>
          </div>

          {/* Centered Download CTA Button */}
          <div className="mt-10 lg:mt-14 flex flex-col items-center justify-center w-full">
            <a
              href={WINDOWS_DOWNLOAD_URL}
              download="Nuvio-Setup.exe"
              data-testid="download-windows-btn"
              className="inline-flex items-center gap-3 px-8 py-3.5 bg-white text-black font-bold text-[15px] rounded-lg shadow-lg hover:bg-white/90 active:scale-[0.98] transition-all duration-150 group cursor-pointer"
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
          </div>
        </div>
      </div>
    </div>
  );
}
