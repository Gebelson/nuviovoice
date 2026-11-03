/**
 * Global audio playback coordinator.
 * Ensures that only one voice message or audio preview plays at any given time.
 * When playback starts on an audio element, any previously playing element is paused.
 */

type AudioCallback = () => void;

class AudioCoordinator {
  private currentElement: HTMLAudioElement | null = null;
  private currentPauseCallback: AudioCallback | null = null;

  public claimPlayback(element: HTMLAudioElement, onPause?: AudioCallback): void {
    if (this.currentElement && this.currentElement !== element) {
      try {
        this.currentElement.pause();
      } catch {}
      if (this.currentPauseCallback) {
        try {
          this.currentPauseCallback();
        } catch {}
      }
    }
    this.currentElement = element;
    this.currentPauseCallback = onPause ?? null;
  }

  public releasePlayback(element: HTMLAudioElement): void {
    if (this.currentElement === element) {
      this.currentElement = null;
      this.currentPauseCallback = null;
    }
  }

  public pauseActive(): void {
    if (this.currentElement) {
      try {
        this.currentElement.pause();
      } catch {}
      if (this.currentPauseCallback) {
        try {
          this.currentPauseCallback();
        } catch {}
      }
      this.currentElement = null;
      this.currentPauseCallback = null;
    }
  }
}

export const audioCoordinator = new AudioCoordinator();
