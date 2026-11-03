import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export interface VoiceRecordButtonProps {
  disabled?: boolean;
  onStartRecording: (isLocked?: boolean) => void;
  onLockRecording?: () => void;
  onCancelRecording?: () => void;
  onFinishHold?: () => void;
}

const HOLD_THRESHOLD_MS = 250;
const LOCK_UP_THRESHOLD_PX = 45;
const CANCEL_LEFT_THRESHOLD_PX = 65;

export function VoiceRecordButton({
  disabled = false,
  onStartRecording,
  onLockRecording,
  onCancelRecording,
  onFinishHold,
}: VoiceRecordButtonProps) {
  const { t } = useTranslation(['chat']);

  const [isHolding, setIsHolding] = useState(false);
  const [slideDeltaX, setSlideDeltaX] = useState(0);
  const [slideDeltaY, setSlideDeltaY] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  const startCoordRef = useRef<{ x: number; y: number } | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didTriggerStartRef = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || e.button !== 0) return;

    startCoordRef.current = { x: e.clientX, y: e.clientY };
    didTriggerStartRef.current = false;
    setIsLocked(false);
    setSlideDeltaX(0);
    setSlideDeltaY(0);

    const target = e.currentTarget;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {}

    holdTimerRef.current = setTimeout(() => {
      setIsHolding(true);
      didTriggerStartRef.current = true;
      onStartRecording(false);
    }, HOLD_THRESHOLD_MS);
  }, [disabled, onStartRecording]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!startCoordRef.current || !isHolding || isLocked) return;

    const dx = e.clientX - startCoordRef.current.x;
    const dy = e.clientY - startCoordRef.current.y;
    setSlideDeltaX(dx);
    setSlideDeltaY(dy);

    // Slide up to lock
    if (dy < -LOCK_UP_THRESHOLD_PX) {
      setIsLocked(true);
      setIsHolding(false);
      startCoordRef.current = null;
      if (onLockRecording) {
        onLockRecording();
      }
      return;
    }

    // Slide left to cancel
    if (dx < -CANCEL_LEFT_THRESHOLD_PX) {
      setIsHolding(false);
      startCoordRef.current = null;
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (onCancelRecording) {
        onCancelRecording();
      }
    }
  }, [isHolding, isLocked, onLockRecording, onCancelRecording]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (!didTriggerStartRef.current) {
      // Short click/tap: start hands-free recording directly
      onStartRecording(true);
    } else if (isHolding && !isLocked) {
      // Releasing after hold: switch to preview so user can review and send
      if (onFinishHold) {
        onFinishHold();
      }
    }

    setIsHolding(false);
    startCoordRef.current = null;
    setSlideDeltaX(0);
    setSlideDeltaY(0);
  }, [isHolding, isLocked, onStartRecording, onFinishHold]);

  const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (didTriggerStartRef.current && !isLocked && onCancelRecording) {
      onCancelRecording();
    }
    setIsHolding(false);
    startCoordRef.current = null;
  }, [isLocked, onCancelRecording]);

  return (
    <div className="relative flex items-center justify-center">
      {/* Slide-to-cancel pill indicator during hold */}
      {isHolding && !isLocked && (
        <div
          data-testid="voice-slide-cancel-indicator"
          style={{ transform: `translateX(${Math.min(0, slideDeltaX)}px)` }}
          className="absolute right-12 z-20 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-surface-channel/95 px-3 py-1 text-[12px] font-medium text-txt-secondary shadow-lg backdrop-blur-md border border-white/10 pointer-events-none animate-fadeIn"
        >
          <svg className="h-3.5 w-3.5 text-accent-rose flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
          </svg>
          <span>{t('chat:voice.slideToCancel')}</span>
        </div>
      )}

      {/* Slide-up-to-lock indicator during hold */}
      {isHolding && !isLocked && (
        <div
          data-testid="voice-lock-indicator"
          style={{ transform: `translateY(${Math.min(0, slideDeltaY)}px)` }}
          className="absolute -top-11 z-20 flex flex-col items-center justify-center rounded-full bg-surface-channel/95 p-2 shadow-lg backdrop-blur-md border border-white/10 pointer-events-none animate-bounce"
          title={t('chat:voice.slideUpToLock')}
        >
          <svg className="h-4 w-4 text-accent-primary" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
          </svg>
        </div>
      )}

      {/* Microphone button */}
      <button
        type="button"
        disabled={disabled}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        data-testid="voice-record-trigger"
        aria-label={t('chat:voice.record')}
        title={t('chat:voice.record')}
        className={`flex h-10 w-10 desktop:h-[34px] desktop:w-[34px] flex-shrink-0 items-center justify-center rounded-[6px] transition-all duration-150 select-none touch-none ${
          isHolding
            ? 'scale-110 bg-accent-primary text-white shadow-lg'
            : 'text-txt-tertiary hover:text-accent-primary active:scale-95'
        } disabled:opacity-40`}
      >
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      </button>
    </div>
  );
}
