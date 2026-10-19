import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useVoiceStore } from '../../stores/voiceStore';
import { useSpaceStore } from '../../stores/spaceStore';
import { useAuthStore } from '../../stores/authStore';
import { Avatar } from '../ui/Avatar';
import { useVoiceParticipantMeta } from '../../hooks/useVoiceParticipantMeta';
import { useActiveDmCall } from '../../hooks/useActiveDmCall';
import { isElectron } from '../../platform/platform';
import {
  handleMuteAction,
  handleDeafenAction,
  handleCameraAction,
  handleDisconnectAction,
} from '../../utils/voiceActions';
import type { ParticipantInfo } from '../../hooks/useLiveKit';

const EMPTY_PARTICIPANT: ParticipantInfo = {
  identity: '',
  userId: '',
  username: '',
  homeUserId: null,
  isMuted: false,
  isDeafened: false,
  isCameraOn: false,
  isScreenSharing: false,
  isLocal: false,
  audioTrack: null,
  videoTrack: null,
  screenTrack: null,
  screenAudioTrack: null,
  lkVideoTrack: null,
  lkScreenTrack: null,
  cachedUser: null,
};

interface PopOutCallWindowProps {
  onClose: () => void;
  onReturnToMain: () => void;
}

/** Single video tile with LiveKit track attachment and speaking indicator */
function VideoTile({
  participant,
  trackType,
  isSpeaking,
  isSpotlighted,
  onClick,
}: {
  participant: ParticipantInfo;
  trackType: 'camera' | 'screen';
  isSpeaking: boolean;
  isSpotlighted?: boolean;
  onClick?: () => void;
}) {
  const { t } = useTranslation(['voice']);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { displayName } = useVoiceParticipantMeta(participant);
  const lkTrack = trackType === 'screen' ? participant.lkScreenTrack : participant.lkVideoTrack;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !lkTrack) return;
    lkTrack.attach(el);
    return () => {
      lkTrack.detach(el);
    };
  }, [lkTrack]);

  return (
    <div
      onClick={onClick}
      className={`relative w-full h-full bg-black/60 rounded-lg overflow-hidden flex items-center justify-center cursor-pointer transition-all ${
        isSpeaking ? 'ring-2 ring-status-online' : 'ring-1 ring-white/10'
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full ${trackType === 'screen' ? 'object-contain' : 'object-cover'}`}
      />
      {/* Name and track tag badge */}
      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[11px] font-medium text-white/90 flex items-center gap-1.5 pointer-events-none">
        {trackType === 'screen' && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-status-online">
            <path d="M20 18C21.1 18 22 17.1 22 16V6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V16C2 17.1 2.9 18 4 18H0V20H24V18H20ZM4 6H20V16H4V6Z" />
          </svg>
        )}
        <span>{displayName}</span>
        {participant.isLocal && <span className="text-white/50 text-[10px]">{t('voice:badges.you', '(você)')}</span>}
      </div>
    </div>
  );
}

/** Voice-only participant avatar card */
function VoiceParticipantTile({
  participant,
  isSpeaking,
}: {
  participant: ParticipantInfo;
  isSpeaking: boolean;
}) {
  const { displayName, avatar, user } = useVoiceParticipantMeta(participant);

  return (
    <div className="flex flex-col items-center justify-center p-2 transition-transform">
      <div className="relative">
        <div
          className={`rounded-full transition-all duration-200 ${
            isSpeaking ? 'ring-[3px] ring-status-online ring-offset-2 ring-offset-[#0E1015] scale-105' : ''
          }`}
        >
          <Avatar
            src={avatar ?? undefined}
            userId={user?.id ?? participant.userId}
            name={displayName}
            size={48}
          />
        </div>
        {participant.isMuted && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-accent-rose text-white flex items-center justify-center shadow">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>
      <span className="text-xs font-medium text-white/90 mt-1.5 max-w-[90px] truncate text-center">
        {displayName}
      </span>
    </div>
  );
}

export function PopOutCallWindow({ onClose, onReturnToMain }: PopOutCallWindowProps) {
  const { t } = useTranslation(['voice', 'common', 'settings']);

  // Voice store
  const participants = useVoiceStore((s) => s.participants);
  const speakingParticipantIds = useVoiceStore((s) => s.speakingParticipantIds);
  const watchingStreams = useVoiceStore((s) => s.watchingStreams);
  const currentVoiceChannelId = useVoiceStore((s) => s.currentVoiceChannelId);
  const activeDmCall = useVoiceStore((s) => s.activeDmCall);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isDeafened = useVoiceStore((s) => s.isDeafened);
  const isCameraOn = useVoiceStore((s) => s.isCameraOn);
  const pipAlwaysOnTop = useVoiceStore((s) => s.pipAlwaysOnTop);
  const setPipAlwaysOnTop = useVoiceStore((s) => s.setPipAlwaysOnTop);

  // Space & channel metadata
  const channels = useSpaceStore((s) => s.channels);
  const { title: dmTitle } = useActiveDmCall();

  // Selected spotlight participant/stream ID
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);

  // Controls auto-hide timer for video / screen modes
  const [controlsRevealed, setControlsRevealed] = useState(true);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetHideTimer = useCallback(() => {
    setControlsRevealed(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      setControlsRevealed(false);
    }, 2800);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [resetHideTimer]);

  // Determine current channel / DM call name
  const callTitle = useMemo(() => {
    if (currentVoiceChannelId) {
      const ch = channels.find((c) => c.id === currentVoiceChannelId);
      return ch ? `# ${ch.name}` : t('voice:status.voiceChannel');
    }
    if (activeDmCall) {
      return dmTitle ? `@ ${dmTitle}` : t('voice:status.dmCall');
    }
    return 'Nuvio';
  }, [currentVoiceChannelId, channels, activeDmCall, dmTitle, t]);

  // Identify active streams
  const screenSharers = useMemo(
    () => participants.filter((p) => p.screenTrack !== null && watchingStreams.has(p.userId)),
    [participants, watchingStreams],
  );

  const cameraSharers = useMemo(
    () => participants.filter((p) => p.videoTrack !== null),
    [participants],
  );

  // Determine active visual mode:
  // C: Screen share (if any screen share exists)
  // B: Video call (if any camera exists and no screen share)
  // A: Voice call (only audio/avatars)
  const mode: 'screen' | 'video' | 'voice' =
    screenSharers.length > 0 ? 'screen' : cameraSharers.length > 0 ? 'video' : 'voice';

  // Active screen share participant
  const activeScreenParticipant = useMemo(() => {
    if (screenSharers.length === 0) return null;
    if (selectedStreamId) {
      const match = screenSharers.find((p) => p.identity === selectedStreamId);
      if (match) return match;
    }
    return screenSharers[0];
  }, [screenSharers, selectedStreamId]);

  // Active camera spotlight participant
  const activeCameraParticipant = useMemo(() => {
    if (cameraSharers.length === 0) return null;
    if (selectedStreamId) {
      const match = cameraSharers.find((p) => p.identity === selectedStreamId);
      if (match) return match;
    }
    return cameraSharers[0];
  }, [cameraSharers, selectedStreamId]);

  const toggleAlwaysOnTop = useCallback(() => {
    setPipAlwaysOnTop(!pipAlwaysOnTop);
  }, [pipAlwaysOnTop, setPipAlwaysOnTop]);

  const handleMute = useCallback(() => {
    handleMuteAction(false, false);
  }, []);

  const handleDeafen = useCallback(() => {
    handleDeafenAction(false);
  }, []);

  const handleCamera = useCallback(() => {
    handleCameraAction();
  }, []);

  const handleDisconnect = useCallback(() => {
    handleDisconnectAction();
    onClose();
  }, [onClose]);

  return (
    <div
      onMouseMove={resetHideTimer}
      className="w-screen h-screen bg-[#0E1015] text-white flex flex-col select-none overflow-hidden font-sans relative"
    >
      {/* ── Top Window Bar (Header & Quick Actions) ── */}
      <div
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        className="h-10 px-3 bg-[#12141A]/90 border-b border-white/[0.08] flex items-center justify-between flex-shrink-0 z-30 backdrop-blur-md"
      >
        {/* Left: Connection dot & Call title */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-status-online animate-pulse flex-shrink-0" />
          <span className="text-xs font-semibold text-white/90 truncate tracking-tight">
            {callTitle}
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/[0.06] text-white/60 font-medium uppercase tracking-wider">
            {mode === 'screen'
              ? t('voice:controls.shareScreen')
              : mode === 'video'
              ? t('voice:camera.selected')
              : t('voice:status.connected')}
          </span>
        </div>

        {/* Right: Window Controls (Pin, Return, Close) */}
        <div
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="flex items-center gap-1 flex-shrink-0"
        >
          {/* Pin / Always on top toggle */}
          <button
            type="button"
            onClick={toggleAlwaysOnTop}
            className={`p-1.5 rounded transition-colors ${
              pipAlwaysOnTop
                ? 'text-status-online bg-status-online/10 hover:bg-status-online/20'
                : 'text-white/60 hover:text-white hover:bg-white/[0.08]'
            }`}
            title={
              pipAlwaysOnTop
                ? t('voice:controls.unpinAlwaysOnTop', 'Desafixar janela')
                : t('voice:controls.pinAlwaysOnTop', 'Fixar sempre no topo')
            }
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={pipAlwaysOnTop ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M12 2v8m0 0l4 4m-4-4l-4 4m4-4H4m8 0h8M12 18v4" />
            </svg>
          </button>

          {/* Return to main window */}
          <button
            type="button"
            onClick={onReturnToMain}
            className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
            title={t('voice:controls.returnToMain', 'Voltar ao Nuvio')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>

          {/* Close floating window (preserves call!) */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-white/60 hover:text-accent-rose hover:bg-accent-rose/10 transition-colors"
            title={t('voice:controls.closeFloatingWindow', 'Fechar janela flutuante')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Main Viewport Content Area ── */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center p-2 overflow-hidden bg-[#0A0C10]">
        {/* MODE C: SCREEN SHARE */}
        {mode === 'screen' && activeScreenParticipant && (
          <div className="w-full h-full flex flex-col items-center justify-center relative">
            <VideoTile
              participant={activeScreenParticipant}
              trackType="screen"
              isSpeaking={speakingParticipantIds.has(activeScreenParticipant.identity)}
            />

            {/* Stream switcher if multiple screen shares are active */}
            {screenSharers.length > 1 && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full z-10">
                {screenSharers.map((p) => (
                  <button
                    key={p.identity}
                    type="button"
                    onClick={() => setSelectedStreamId(p.identity)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                      p.identity === activeScreenParticipant.identity
                        ? 'bg-status-online text-black font-semibold'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {p.username}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MODE B: VIDEO CALL */}
        {mode === 'video' && activeCameraParticipant && (
          <div className="w-full h-full relative">
            {cameraSharers.length === 1 ? (
              <VideoTile
                participant={activeCameraParticipant}
                trackType="camera"
                isSpeaking={speakingParticipantIds.has(activeCameraParticipant.identity)}
              />
            ) : cameraSharers.length === 2 ? (
              <div className="grid grid-cols-2 gap-1.5 w-full h-full">
                {cameraSharers.map((p) => (
                  <VideoTile
                    key={p.identity}
                    participant={p}
                    trackType="camera"
                    isSpeaking={speakingParticipantIds.has(p.identity)}
                    onClick={() => setSelectedStreamId(p.identity)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 w-full h-full">
                {cameraSharers.slice(0, 4).map((p) => (
                  <VideoTile
                    key={p.identity}
                    participant={p}
                    trackType="camera"
                    isSpeaking={speakingParticipantIds.has(p.identity)}
                    onClick={() => setSelectedStreamId(p.identity)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* MODE A: VOICE CALL (AVATARS) */}
        {mode === 'voice' && (
          <div className="w-full h-full flex items-center justify-center p-3">
            {participants.length === 0 ? (
              <div className="text-center text-xs text-white/50">
                {t('voice:grid.waitingForOthers')}
              </div>
            ) : participants.length === 1 && participants[0] ? (
              <div className="flex flex-col items-center">
                <VoiceParticipantTile
                  participant={participants[0]}
                  isSpeaking={speakingParticipantIds.has(participants[0].identity)}
                />
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-3 max-w-full max-h-full overflow-y-auto no-scrollbar">
                {participants.map((p) => (
                  <VoiceParticipantTile
                    key={p.identity}
                    participant={p}
                    isSpeaking={speakingParticipantIds.has(p.identity)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Bottom Floating Controls Bar ── */}
        <div
          className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-30 transition-all duration-200 ${
            mode === 'voice' || controlsRevealed
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#161820]/90 border border-white/[0.12] shadow-2xl backdrop-blur-md">
            {/* Microphone */}
            <button
              type="button"
              onClick={handleMute}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
                isMuted
                  ? 'bg-accent-rose text-white shadow-lg'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              title={isMuted ? t('voice:controls.unmuteShortcut') : t('voice:controls.muteShortcut')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                {isMuted && (
                  <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                )}
              </svg>
            </button>

            {/* Deafen (Áudio) */}
            <button
              type="button"
              onClick={handleDeafen}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
                isDeafened
                  ? 'bg-accent-rose text-white shadow-lg'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              title={isDeafened ? t('voice:controls.undeafen') : t('voice:controls.deafen')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3c-4.97 0-9 4.03-9 9v7c0 1.1.9 2 2 2h2v-7H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-2v7h2c1.1 0 2-.9 2-2v-7c0-4.97-4.03-9-9-9z" />
                {isDeafened && (
                  <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                )}
              </svg>
            </button>

            {/* Camera */}
            <button
              type="button"
              onClick={handleCamera}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
                isCameraOn
                  ? 'bg-status-online text-black shadow-lg'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              title={isCameraOn ? t('voice:controls.cameraOff') : t('voice:controls.cameraOn')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 10.5V7C17 6.45 16.55 6 16 6H4C3.45 6 3 6.45 3 7V17C3 17.55 3.45 18 4 18H16C16.55 18 17 17.55 17 17V13.5L21 17.5V6.5L17 10.5Z" />
                {!isCameraOn && (
                  <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                )}
              </svg>
            </button>

            {/* Disconnect */}
            <button
              type="button"
              onClick={handleDisconnect}
              className="w-8 h-8 rounded-full bg-accent-rose text-white hover:bg-accent-rose/80 flex items-center justify-center transition-transform active:scale-95 shadow"
              title={t('voice:controls.disconnect')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 9C10.4 9 8.85 9.25 7.4 9.72V12.82C7.4 13.22 7.17 13.56 6.84 13.72C5.86 14.21 4.97 14.84 4.18 15.57C4 15.75 3.75 15.85 3.48 15.85C3.2 15.85 2.95 15.74 2.77 15.56L0.29 13.08C0.11 12.9 0 12.65 0 12.38C0 12.1 0.11 11.85 0.29 11.67C3.34 8.78 7.46 7 12 7S20.66 8.78 23.71 11.67C23.89 11.85 24 12.1 24 12.38C24 12.65 23.89 12.9 23.71 13.08L21.23 15.56C21.05 15.74 20.8 15.85 20.52 15.85C20.25 15.85 20 15.75 19.82 15.57C19.03 14.84 18.14 14.21 17.16 13.72C16.83 13.56 16.6 13.22 16.6 12.82V9.72C15.15 9.25 13.6 9 12 9Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
