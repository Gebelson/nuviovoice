import { pollAllRegisteredChannels } from './liveStreamService.js';

let intervalTimer: NodeJS.Timeout | null = null;
let isPolling = false;

export function startStreamPoller(intervalMs = 60_000): void {
  if (intervalTimer) return;

  const runPoll = async () => {
    if (isPolling) return;
    isPolling = true;
    try {
      await pollAllRegisteredChannels();
    } catch {
      // Ignored
    } finally {
      isPolling = false;
    }
  };

  // Run initial poll after 5 seconds to let the server boot cleanly
  const initialTimer = setTimeout(() => {
    void runPoll();
  }, 5000);
  initialTimer.unref();

  intervalTimer = setInterval(() => {
    void runPoll();
  }, intervalMs);
  intervalTimer.unref();
}

export function stopStreamPoller(): void {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
}
