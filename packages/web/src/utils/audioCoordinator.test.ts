import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audioCoordinator } from './audioCoordinator';

describe('audioCoordinator', () => {
  let audio1: HTMLAudioElement;
  let audio2: HTMLAudioElement;

  beforeEach(() => {
    audioCoordinator.pauseActive();
    audio1 = { pause: vi.fn() } as unknown as HTMLAudioElement;
    audio2 = { pause: vi.fn() } as unknown as HTMLAudioElement;
  });

  it('claims playback and pauses previous audio element', () => {
    const onPause1 = vi.fn();
    audioCoordinator.claimPlayback(audio1, onPause1);

    expect(audio1.pause).not.toHaveBeenCalled();

    audioCoordinator.claimPlayback(audio2);

    expect(audio1.pause).toHaveBeenCalledTimes(1);
    expect(onPause1).toHaveBeenCalledTimes(1);
  });

  it('pauses active audio when pauseActive is called', () => {
    const onPause = vi.fn();
    audioCoordinator.claimPlayback(audio1, onPause);
    audioCoordinator.pauseActive();

    expect(audio1.pause).toHaveBeenCalledTimes(1);
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('releases playback without pausing when already claimed element is released', () => {
    audioCoordinator.claimPlayback(audio1);
    audioCoordinator.releasePlayback(audio1);
    audioCoordinator.pauseActive();

    expect(audio1.pause).not.toHaveBeenCalled();
  });
});
