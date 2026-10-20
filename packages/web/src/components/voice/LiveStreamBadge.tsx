import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrackPublication,
  type RemoteParticipant,
} from 'livekit-client';
import { useFloatingPosition } from '../../hooks/useFloatingPosition';
import { usePortalContainer } from '../../hooks/usePortalContainer';
import { useDismissOnEscape } from '../../hooks/useDismissOnEscape';
import { useUIStore } from '../../stores/uiStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { useSpaceStore, getApiForOrigin, getChannelOrigin } from '../../stores/spaceStore';
import { api } from '../../api/client';
import { getActiveRoom, parseIdentity } from '../../hooks/useLiveKit';
import { joinVoiceChannel } from '../../utils/voice';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Avatar } from '../ui/Avatar';

// ─── Single active hover preview coordinator ─────────────────────────────────

type CloseCallback = () => void;
let activePreviewCardId: string | null = null;
let activeCloseCallback: CloseCallback | null = null;

function claimActivePreviewCard(id: string, close: CloseCallback): void {
  if (activePreviewCardId && activePreviewCardId !== id && activeCloseCallback) {
    activeCloseCallback();
  }
  activePreviewCardId = id;
  activeCloseCallback = close;
}

function releaseActivePreviewCard(id: string): void {
  if (activePreviewCardId === id) {
    activePreviewCardId = null;
    activeCloseCallback = null;
  }
}

export interface LiveStreamBadgeProps {
  userId: string;
  displayName: string;
  avatar: string | null;
  avatarColor?: string | null;
  channelId?: string;
  channelName?: string;
  spaceId?: string;
  spaceName?: string;
  className?: string;
}

type PreviewStatus = 'idle' | 'loading' | 'active' | 'ended' | 'forbidden' | 'error';

export function LiveStreamBadge({
  userId,
  displayName,
  avatar,
  avatarColor,
  channelId,
  channelName,
  spaceId,
  spaceName,
  className = '',
}: LiveStreamBadgeProps) {
  const { t } = useTranslation(['voice', 'common']);
  const navigate = useNavigate();
  const isMobile = useUIStore((s) => s.isMobile);

  const anchorRef = useRef<HTMLButtonElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRoomRef = useRef<Room | null>(null);

  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPending, setIsPending] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [rawMediaStreamTrack, setRawMediaStreamTrack] = useState<MediaStreamTrack | null>(null);
  const [showSwitchCallConfirm, setShowSwitchCallConfirm] = useState(false);

  const currentVoiceChannelId = useVoiceStore((s) => s.currentVoiceChannelId);
  const activeDmCall = useVoiceStore((s) => s.activeDmCall);
  const isLiveKitConnected = useVoiceStore((s) => s.isLiveKitConnected);
  const connectFn = useVoiceStore((s) => s.connectFn);
  const currentParticipants = useVoiceStore((s) => s.participants);

  const cardKey = useMemo(() => `${channelId || 'ch'}:${userId}`, [channelId, userId]);

  const clearTimers = useCallback(() => {
    if (openTimerRef.current !== null) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const forceClose = useCallback(() => {
    clearTimers();
    setIsPending(false);
    setIsVisible(false);
    setStatus('idle');
    releaseActivePreviewCard(cardKey);
  }, [clearTimers, cardKey]);

  // Open with debounce (250ms) to avoid triggering on casual mouse pass
  const handleOpen = useCallback(() => {
    if (isMobile || !channelId) return;
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (isVisible) return;

    claimActivePreviewCard(cardKey, forceClose);
    setIsPending(true);

    if (openTimerRef.current !== null) clearTimeout(openTimerRef.current);
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null;
      setIsPending(false);
      setIsVisible(true);
    }, 250);
  }, [isMobile, channelId, isVisible, cardKey, forceClose]);

  // Schedule close with grace period (250ms) so moving cursor into the popover keeps it open
  const handleScheduleClose = useCallback(() => {
    if (openTimerRef.current !== null) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
      setIsPending(false);
    }
    if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      forceClose();
    }, 250);
  }, [forceClose]);

  useEffect(() => {
    return () => {
      clearTimers();
      releaseActivePreviewCard(cardKey);
    };
  }, [clearTimers, cardKey]);

  useDismissOnEscape(!isMobile && (isPending || isVisible), forceClose);

  // Auto-close after 2.5s when transmission has ended
  useEffect(() => {
    if (status === 'ended' && isVisible) {
      const timer = setTimeout(() => {
        forceClose();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [status, isVisible, forceClose]);

  // ─── LiveKit preview subscription & room management ────────────────────────
  const fetchAndConnectPreview = useCallback(async () => {
    if (!channelId) return;
    setStatus('loading');
    setActiveTrack(null);
    setRawMediaStreamTrack(null);

    const inSameChannel = currentVoiceChannelId === channelId && isLiveKitConnected;
    const activeRoom = getActiveRoom();

    // 1. REUSE ACTIVE ROOM if we are in the same channel
    if (inSameChannel && activeRoom) {
      // Local participant (self sharing screen)
      if (activeRoom.localParticipant.identity.startsWith(`${userId}:`) || activeRoom.localParticipant.identity === userId) {
        const localPub = activeRoom.localParticipant.getTrackPublication(Track.Source.ScreenShare);
        const localPartInfo = currentParticipants.find((p) => p.isLocal);
        if (localPub?.track) {
          setActiveTrack(localPub.track);
          setStatus('active');
          return;
        } else if (localPartInfo?.screenTrack) {
          setRawMediaStreamTrack(localPartInfo.screenTrack);
          setStatus('active');
          return;
        }
      }

      // Remote participant in current room
      let foundPub: RemoteTrackPublication | undefined;
      for (const rp of activeRoom.remoteParticipants.values()) {
        if (parseIdentity(rp.identity).userId === userId) {
          for (const pub of rp.trackPublications.values()) {
            if (pub.source === Track.Source.ScreenShare) {
              foundPub = pub as RemoteTrackPublication;
              break;
            }
          }
          break;
        }
      }

      if (foundPub) {
        foundPub.setSubscribed(true);
        if (foundPub.track) {
          setActiveTrack(foundPub.track);
          setStatus('active');
        }
      } else {
        // Fallback: check if voiceStore already cached participant info with screenTrack
        const pInfo = currentParticipants.find((p) => p.userId === userId);
        if (pInfo?.lkScreenTrack) {
          setActiveTrack(pInfo.lkScreenTrack);
          setStatus('active');
        } else if (pInfo?.screenTrack) {
          setRawMediaStreamTrack(pInfo.screenTrack);
          setStatus('active');
        }
      }

      const handleSubscribed = (track: Track, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (parseIdentity(participant.identity).userId === userId && pub.source === Track.Source.ScreenShare) {
          setActiveTrack(track);
          setStatus('active');
        }
      };
      const handleUnsubscribed = (_track: Track, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (parseIdentity(participant.identity).userId === userId && pub.source === Track.Source.ScreenShare) {
          setActiveTrack(null);
          setRawMediaStreamTrack(null);
          setStatus('ended');
        }
      };

      activeRoom.on(RoomEvent.TrackSubscribed, handleSubscribed);
      activeRoom.on(RoomEvent.TrackUnsubscribed, handleUnsubscribed);

      return () => {
        activeRoom.off(RoomEvent.TrackSubscribed, handleSubscribed);
        activeRoom.off(RoomEvent.TrackUnsubscribed, handleUnsubscribed);
      };
    }

    // 2. CONNECT ISOLATED SPECTATOR ROOM if outside channel
    let cancelled = false;
    try {
      const origin = getChannelOrigin(channelId);
      const targetApi = origin ? getApiForOrigin(origin) : api;
      const res = await targetApi.livekit.previewToken(channelId);

      if (cancelled) return;

      const previewRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      previewRoomRef.current = previewRoom;

      previewRoom.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
        if (cancelled) return;
        if (parseIdentity(participant.identity).userId === userId && pub.source === Track.Source.ScreenShare) {
          setActiveTrack(track);
          setStatus('active');
        }
      });

      previewRoom.on(RoomEvent.TrackUnsubscribed, (_track, pub, participant) => {
        if (cancelled) return;
        if (parseIdentity(participant.identity).userId === userId && pub.source === Track.Source.ScreenShare) {
          setActiveTrack(null);
          setRawMediaStreamTrack(null);
          setStatus('ended');
        }
      });

      previewRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        if (cancelled) return;
        if (parseIdentity(participant.identity).userId === userId) {
          setActiveTrack(null);
          setRawMediaStreamTrack(null);
          setStatus('ended');
        }
      });

      previewRoom.on(RoomEvent.Disconnected, () => {
        if (!cancelled) {
          setActiveTrack(null);
          setRawMediaStreamTrack(null);
        }
      });

      // autoSubscribe: false ensures we only subscribe to the target participant's screen share
      await previewRoom.connect(res.url, res.token, { autoSubscribe: false });
      if (cancelled) {
        previewRoom.disconnect();
        return;
      }

      // Find target participant among connected remote participants
      let targetPub: RemoteTrackPublication | undefined;
      for (const rp of previewRoom.remoteParticipants.values()) {
        if (parseIdentity(rp.identity).userId === userId) {
          for (const pub of rp.trackPublications.values()) {
            if (pub.source === Track.Source.ScreenShare) {
              targetPub = pub as RemoteTrackPublication;
              break;
            }
          }
          break;
        }
      }

      if (targetPub) {
        targetPub.setSubscribed(true);
        if (targetPub.track) {
          setActiveTrack(targetPub.track);
          setStatus('active');
        }
      } else {
        // If not immediately present, listen for TrackPublished
        const handlePublished = (pub: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (parseIdentity(participant.identity).userId === userId && pub.source === Track.Source.ScreenShare) {
            pub.setSubscribed(true);
            if (pub.track) {
              setActiveTrack(pub.track);
              setStatus('active');
            }
          }
        };
        previewRoom.on(RoomEvent.TrackPublished, handlePublished);
      }
    } catch (err: any) {
      if (cancelled) return;
      if (err?.status === 403 || err?.code === 'voice_connect_forbidden') {
        setStatus('forbidden');
      } else {
        setStatus('error');
      }
    }

    return () => {
      cancelled = true;
      if (previewRoomRef.current) {
        previewRoomRef.current.disconnect();
        previewRoomRef.current = null;
      }
      setActiveTrack(null);
      setRawMediaStreamTrack(null);
    };
  }, [channelId, userId, currentVoiceChannelId, isLiveKitConnected, currentParticipants]);

  useEffect(() => {
    if (!isVisible) {
      if (previewRoomRef.current) {
        previewRoomRef.current.disconnect();
        previewRoomRef.current = null;
      }
      setActiveTrack(null);
      setRawMediaStreamTrack(null);
      setStatus('idle');
      return;
    }

    let cleanupPromise: Promise<(() => void) | undefined> | (() => void) | undefined;
    const run = async () => {
      const cleanup = await fetchAndConnectPreview();
      cleanupPromise = cleanup;
    };
    run();

    return () => {
      if (typeof cleanupPromise === 'function') {
        cleanupPromise();
      } else if (cleanupPromise) {
        cleanupPromise.then((fn) => fn?.());
      }
    };
  }, [isVisible, fetchAndConnectPreview]);

  // Attach active video track to <video> element
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (activeTrack) {
      activeTrack.attach(videoEl);
      return () => {
        activeTrack.detach(videoEl);
      };
    } else if (rawMediaStreamTrack) {
      const stream = new MediaStream([rawMediaStreamTrack]);
      videoEl.srcObject = stream;
      return () => {
        videoEl.srcObject = null;
      };
    } else {
      videoEl.srcObject = null;
    }
  }, [activeTrack, rawMediaStreamTrack]);

  // Floating placement next to badge
  const { style } = useFloatingPosition(anchorRef, floatingRef, {
    placement: 'right',
    offset: 12,
    enabled: isVisible && !isMobile,
  });

  const portalContainer = usePortalContainer();

  // ─── "Assistir transmissão" action ─────────────────────────────────────────
  const executeJoinAndWatch = useCallback(() => {
    forceClose();
    if (!channelId) return;

    if (currentVoiceChannelId !== channelId) {
      joinVoiceChannel(channelId, connectFn ?? undefined);
    }
    if (spaceId) {
      navigate(`/channels/${spaceId}/${channelId}`);
    }
  }, [forceClose, channelId, currentVoiceChannelId, connectFn, spaceId, navigate]);

  const handleWatchStreamClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!channelId) return;

    const inAnotherCall = Boolean(
      (currentVoiceChannelId && currentVoiceChannelId !== channelId) || activeDmCall,
    );

    if (inAnotherCall) {
      setShowSwitchCallConfirm(true);
    } else {
      executeJoinAndWatch();
    }
  }, [channelId, currentVoiceChannelId, activeDmCall, executeJoinAndWatch]);

  const handleConfirmSwitchCall = useCallback(() => {
    setShowSwitchCallConfirm(false);
    executeJoinAndWatch();
  }, [executeJoinAndWatch]);

  const handleCancelSwitchCall = useCallback(() => {
    setShowSwitchCallConfirm(false);
  }, []);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onMouseEnter={handleOpen}
        onMouseLeave={handleScheduleClose}
        onFocus={handleOpen}
        onBlur={handleScheduleClose}
        onClick={handleWatchStreamClick}
        title={displayName}
        aria-label={`${displayName} - ${t('voice:badges.live')}`}
        className={`bg-accent-rose text-white text-[9px] font-bold px-1 rounded leading-[14px] flex items-center gap-1 cursor-pointer hover:brightness-110 transition-all select-none focus:outline-none focus:ring-1 focus:ring-accent-rose/50 ${className}`}
      >
        <span>{t('voice:badges.live')}</span>
      </button>

      {/* Floating Preview Popover */}
      {isVisible && !isMobile && createPortal(
        <div
          ref={floatingRef}
          role="dialog"
          aria-label={displayName}
          style={style}
          onMouseEnter={handleOpen}
          onMouseLeave={handleScheduleClose}
          className="w-[360px] max-w-[calc(100vw-32px)] glass bg-[#121316]/95 backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl p-3.5 z-[1000] animate-in fade-in zoom-in-95 duration-150 select-none text-txt-primary flex flex-col gap-3"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Avatar
                src={avatar}
                name={displayName}
                userId={userId}
                avatarColor={avatarColor ?? undefined}
                size={26}
              />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[13px] font-semibold text-txt-primary truncate leading-tight">
                  {displayName}
                </span>
                <span className="text-[11px] text-txt-secondary truncate leading-tight mt-0.5">
                  {channelName ? `# ${channelName}` : ''}
                  {spaceName ? ` · ${spaceName}` : ''}
                </span>
              </div>
            </div>

            <span className="bg-accent-rose text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 flex-shrink-0 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
              {t('voice:badges.live')}
            </span>
          </div>

          {/* Central Video Viewport (16:9 strictly preserved) */}
          <div className="relative w-full aspect-video bg-black/80 rounded-xl overflow-hidden border border-white/[0.06] flex items-center justify-center">
            {/* Real Live Video */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-contain ${status === 'active' ? 'block' : 'hidden'}`}
            />

            {/* State: Loading */}
            {status === 'loading' && (
              <div className="flex flex-col items-center justify-center gap-2 text-txt-secondary text-xs p-4 animate-pulse">
                <svg className="animate-spin text-accent-primary" width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{t('voice:preview.loading')}</span>
              </div>
            )}

            {/* State: Ended */}
            {status === 'ended' && (
              <div className="flex flex-col items-center justify-center gap-2 text-txt-tertiary text-xs p-4 text-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                  <line x1="2" y1="2" x2="22" y2="22" strokeWidth="2" />
                </svg>
                <span>{t('voice:preview.ended')}</span>
              </div>
            )}

            {/* State: Forbidden */}
            {status === 'forbidden' && (
              <div className="flex flex-col items-center justify-center gap-2 text-accent-rose text-xs p-4 text-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                </svg>
                <span>{t('voice:preview.noPermission')}</span>
              </div>
            )}

            {/* State: Error */}
            {status === 'error' && (
              <div className="flex flex-col items-center justify-center gap-2 text-txt-secondary text-xs p-4 text-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-amber">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{t('voice:preview.failed')}</span>
                <button
                  type="button"
                  onClick={fetchAndConnectPreview}
                  className="mt-1 px-2.5 py-1 text-[11px] rounded bg-white/10 hover:bg-white/15 text-txt-primary transition-colors cursor-pointer"
                >
                  {t('voice:preview.retry')}
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.06]">
            {/* Audio Indicator */}
            <div className="flex items-center gap-1.5 text-[11px] text-txt-tertiary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
              <span>{t('voice:preview.noAudio')}</span>
            </div>

            {/* Action: Assistir transmissão */}
            <button
              type="button"
              onClick={handleWatchStreamClick}
              className="px-3 py-1.5 rounded-lg bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer hover:shadow-md active:scale-95"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>{t('voice:preview.watchStream')}</span>
            </button>
          </div>
        </div>,
        portalContainer,
      )}

      {/* Switch Call Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showSwitchCallConfirm}
        onClose={handleCancelSwitchCall}
        onConfirm={handleConfirmSwitchCall}
        title={t('voice:preview.switchCallTitle')}
        description={t('voice:preview.switchCallDesc')}
        confirmLabel={t('voice:preview.switchCallConfirm')}
        variant="warning"
      />
    </>
  );
}
