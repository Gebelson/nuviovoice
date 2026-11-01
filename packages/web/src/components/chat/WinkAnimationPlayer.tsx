import React from 'react';
import { GlobalWinkOverlay } from './GlobalWinkOverlay';

/**
 * WinkAnimationPlayer
 *
 * Backward-compatible wrapper delegating to GlobalWinkOverlay.
 * The visual overlay is mounted globally at AppLayout level so that
 * incoming Winks display across any view (DMs, spaces, store, bots, calls, etc.).
 */
export function WinkAnimationPlayer() {
  return <GlobalWinkOverlay />;
}

export default WinkAnimationPlayer;
