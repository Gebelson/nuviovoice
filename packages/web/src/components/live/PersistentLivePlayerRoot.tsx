import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLiveStreamStore } from '../../stores/liveStreamStore';
import { PlatformIcon, getPlatformBadgeStyle, getPlatformName } from './PlatformIcons';
import { Avatar } from '../ui/Avatar';
import { VerificationBadge } from '../ui/VerificationBadge';
import { isMobileViewport } from '../../platform/interfaceScale';

export function PersistentLivePlayerRoot() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    activeStream,
    playerMode,
    floatingPosition,
    floatingSize,
    anchorRect,
    setPlayerMode,
    closeStream,
    minimizeStream,
    restoreStream,
    setFloatingPosition,
    setFloatingSize,
    setAnchorRect,
    toggleNativePip,
    isNativePipActive,
  } = useLiveStreamStore();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number }>({
    mouseX: 0,
    mouseY: 0,
    posX: 0,
    posY: 0,
  });
  const resizeStartRef = useRef<{ mouseX: number; initialWidth: number }>({
    mouseX: 0,
    initialWidth: 0,
  });

  const isLivePage = location.pathname.startsWith('/live/');
  const isMobile = isMobileViewport();

  // Keep anchorRect up-to-date by observing the anchor element on the page
  useEffect(() => {
    if (!isLivePage || playerMode !== 'main') {
      setAnchorRect(null);
      return;
    }

    const updateRect = () => {
      const anchorEl = document.getElementById('live-player-portal-anchor');
      if (anchorEl) {
        const rect = anchorEl.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setAnchorRect({
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          });
        }
      }
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    const interval = setInterval(updateRect, 200);

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
      clearInterval(interval);
    };
  }, [isLivePage, playerMode, setAnchorRect]);

  // When navigating away from /live/:id, transition smoothly to floating mode
  useEffect(() => {
    if (!activeStream) return;
    if (!isLivePage && playerMode === 'main') {
      setPlayerMode('floating');
    } else if (isLivePage && playerMode === 'floating') {
      // User navigated back to /live/:id
      setPlayerMode('main');
    }
  }, [location.pathname, isLivePage, activeStream, playerMode, setPlayerMode]);

  // Pointer drag for floating window
  const handlePointerDownDrag = useCallback(
    (e: React.PointerEvent) => {
      if (playerMode !== 'floating' || e.button !== 0) return;
      e.preventDefault();
      setIsDragging(true);
      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        posX: floatingPosition.x,
        posY: floatingPosition.y,
      };

      const handlePointerMove = (moveEv: PointerEvent) => {
        const dx = moveEv.clientX - dragStartRef.current.mouseX;
        const dy = moveEv.clientY - dragStartRef.current.mouseY;
        const maxX = Math.max(16, window.innerWidth - floatingSize.width - 16);
        const maxY = Math.max(16, window.innerHeight - floatingSize.height - 16);
        const nextX = Math.min(maxX, Math.max(16, dragStartRef.current.posX + dx));
        const nextY = Math.min(maxY, Math.max(16, dragStartRef.current.posY + dy));
        setFloatingPosition({ x: nextX, y: nextY });
      };

      const handlePointerUp = () => {
        setIsDragging(false);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    [playerMode, floatingPosition, floatingSize, setFloatingPosition]
  );

  // Resize handler for bottom-right corner
  const handlePointerDownResize = useCallback(
    (e: React.PointerEvent) => {
      if (playerMode !== 'floating' || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      resizeStartRef.current = {
        mouseX: e.clientX,
        initialWidth: floatingSize.width,
      };

      const handlePointerMove = (moveEv: PointerEvent) => {
        const dx = moveEv.clientX - resizeStartRef.current.mouseX;
        const newWidth = Math.min(
          Math.min(768, window.innerWidth - floatingPosition.x - 16),
          Math.max(280, resizeStartRef.current.initialWidth + dx)
        );
        const newHeight = Math.round((newWidth * 9) / 16);
        setFloatingSize({ width: newWidth, height: newHeight });
      };

      const handlePointerUp = () => {
        setIsResizing(false);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    [playerMode, floatingPosition, floatingSize, setFloatingSize]
  );

  if (!activeStream || playerMode === 'closed' || isNativePipActive) {
    return null;
  }

  const badgeStyle = getPlatformBadgeStyle(activeStream.platform);

  // ─── 1. Minimized View (Floating Capsule) ──────────────────────────────────
  if (playerMode === 'minimized') {
    return (
      <div
        id="persistent-live-player-root"
        ref={containerRef}
        className="fixed z-50 bottom-6 right-6 flex items-center gap-3 bg-surface-elevated/95 backdrop-blur-md border border-border-soft/80 rounded-full px-3.5 py-2 shadow-2xl transition-all duration-200 select-none group"
      >
        {/* Hidden persistent iframe keeping stream and audio playing */}
        <div className="absolute w-[1px] h-[1px] opacity-0 overflow-hidden pointer-events-none">
          <iframe
            src={activeStream.embedUrl}
            title={activeStream.streamTitle || activeStream.channelName}
            className="w-[1px] h-[1px]"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
          />
        </div>

        {/* Live indicator avatar */}
        <div className="relative">
          <Avatar
            src={activeStream.streamer.avatar || undefined}
            name={activeStream.streamer.displayName || activeStream.streamer.username}
            avatarColor={activeStream.streamer.avatarColor || undefined}
            size={32}
            className="ring-2 ring-red-500 animate-pulse"
          />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
        </div>

        <div className="flex flex-col min-w-0 max-w-[160px]">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-xs font-semibold text-txt-primary truncate">
              {activeStream.streamer.displayName || activeStream.streamer.username}
            </span>
            {activeStream.streamer.verification && (
              <VerificationBadge
                category={activeStream.streamer.verification.category}
                size="xs"
                showTooltip={false}
              />
            )}
          </div>
          <span className="text-[10px] text-txt-secondary truncate">
            {activeStream.streamTitle || activeStream.channelName}
          </span>
        </div>

        {/* Capsule actions */}
        <div className="flex items-center gap-1 pl-1">
          <button
            onClick={() => {
              if (isLivePage) {
                restoreStream('main');
              } else {
                restoreStream('floating');
              }
            }}
            title="Expandir player"
            className="p-1 rounded-full text-txt-secondary hover:text-txt-primary hover:bg-white/[0.04] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
          <button
            onClick={closeStream}
            title="Fechar transmissão"
            className="p-1 rounded-full text-txt-secondary hover:text-red-400 hover:bg-white/[0.04] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // ─── 2. Main View Slot / Floating View Geometry ────────────────────────────
  const isMainMode = playerMode === 'main' && isLivePage && anchorRect !== null;
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 360;

  const style: React.CSSProperties = isMainMode
    ? {
        position: 'fixed',
        top: anchorRect.top,
        left: anchorRect.left,
        width: anchorRect.width,
        height: anchorRect.height,
        zIndex: 30,
        borderRadius: '12px',
        transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
        pointerEvents: 'auto',
      }
    : {
        position: 'fixed',
        left: isMobile ? 12 : floatingPosition.x,
        top: isMobile ? undefined : floatingPosition.y,
        bottom: isMobile ? 70 : undefined,
        width: isMobile ? screenWidth - 24 : floatingSize.width,
        height: isMobile ? Math.round(((screenWidth - 24) * 9) / 16) : floatingSize.height,
        zIndex: 50,
        borderRadius: '12px',
        boxShadow: '0 14px 40px -4px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        transition: isDragging || isResizing ? 'none' : 'box-shadow 0.2s ease, border-radius 0.2s ease',
        overflow: 'hidden',
        pointerEvents: 'auto',
      };

  return (
    <div
      id="persistent-live-player-root"
      ref={containerRef}
      style={style}
      className={`bg-black group ${!isMainMode ? 'select-none' : ''}`}
    >
      {/* Floating control bar (visible on hover or drag when in floating mode) */}
      {!isMainMode && (
        <div
          onPointerDown={handlePointerDownDrag}
          className={`absolute top-0 inset-x-0 h-10 px-3 z-20 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/60 to-transparent transition-opacity duration-200 cursor-move ${
            isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {/* Streamer label & Live pulse */}
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <span className="flex h-2 w-2 relative flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-xs font-semibold text-white truncate max-w-[140px]">
              {activeStream.streamer.displayName || activeStream.streamer.username}
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border} uppercase tracking-wider flex items-center gap-1 flex-shrink-0`}
            >
              <PlatformIcon platform={activeStream.platform} size={10} />
              {getPlatformName(activeStream.platform)}
            </span>
          </div>

          {/* Quick controls */}
          <div
            className="flex items-center gap-1 flex-shrink-0"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Return to dedicated main view */}
            <button
              onClick={() => {
                navigate(`/live/${activeStream.id}`);
                setPlayerMode('main');
              }}
              title="Voltar à visualização principal"
              className="p-1.5 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>

            {/* Document Picture-in-Picture */}
            <button
              onClick={() => toggleNativePip(containerRef.current)}
              title="Destacar janela externa (PiP)"
              className="p-1.5 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <rect x="12" y="10" width="8" height="8" rx="1" fill="currentColor" />
              </svg>
            </button>

            {/* External channel link */}
            <a
              href={activeStream.channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`Abrir na ${getPlatformName(activeStream.platform)}`}
              className="p-1.5 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>

            {/* Minimize */}
            <button
              onClick={minimizeStream}
              title="Minimizar player"
              className="p-1.5 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {/* Close */}
            <button
              onClick={closeStream}
              title="Fechar transmissão"
              className="p-1.5 rounded-md text-white/80 hover:text-red-400 hover:bg-white/10 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Persistent Iframe */}
      <iframe
        src={activeStream.embedUrl}
        title={activeStream.streamTitle || activeStream.channelName}
        className="w-full h-full border-0 bg-black block"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
      />

      {/* Resize handle (bottom-right corner) when in floating mode */}
      {!isMainMode && !isMobile && (
        <div
          onPointerDown={handlePointerDownResize}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          title="Redimensionar player"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="rgba(255,255,255,0.6)">
            <circle cx="7" cy="1" r="1" />
            <circle cx="7" cy="4" r="1" />
            <circle cx="4" cy="4" r="1" />
            <circle cx="7" cy="7" r="1" />
            <circle cx="4" cy="7" r="1" />
            <circle cx="1" cy="7" r="1" />
          </svg>
        </div>
      )}
    </div>
  );
}
