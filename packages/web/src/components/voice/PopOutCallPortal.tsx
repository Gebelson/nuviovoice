import React, { useCallback } from 'react';
import { createPortal } from 'react-dom';
import { usePopOutCall } from '../../hooks/usePopOutCall';
import { PopOutCallWindow } from './PopOutCallWindow';
import { isElectron } from '../../platform/platform';

export function PopOutCallPortal() {
  const { isPoppedOut, pipWindow, closePopOut } = usePopOutCall();

  const handleReturnToMain = useCallback(() => {
    if (isElectron()) {
      const api = (window as any).nuvio ?? (window as any).backspace;
      api?.bringMainWindowToFront?.();
    } else {
      window.focus();
    }
    closePopOut();
  }, [closePopOut]);

  if (!isPoppedOut || !pipWindow || !pipWindow.document || !pipWindow.document.body) {
    return null;
  }

  return createPortal(
    <PopOutCallWindow
      onClose={closePopOut}
      onReturnToMain={handleReturnToMain}
    />,
    pipWindow.document.body,
  );
}
