import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import type { Attachment } from '@concord/shared';

// Mock audio element
class MockAudio {
  public src = '';
  public preload = '';
  public playbackRate = 1;
  public currentTime = 0;
  public duration = 12;
  private listeners = new Map<string, Array<() => void>>();

  public addEventListener(event: string, callback: () => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  public removeEventListener(event: string, callback: () => void) {
    const list = this.listeners.get(event);
    if (list) {
      this.listeners.set(event, list.filter(cb => cb !== callback));
    }
  }

  public play() {
    const playCbs = this.listeners.get('play') || [];
    playCbs.forEach(cb => cb());
    return Promise.resolve();
  }

  public pause() {
    const pauseCbs = this.listeners.get('pause') || [];
    pauseCbs.forEach(cb => cb());
  }

  public triggerError() {
    const errCbs = this.listeners.get('error') || [];
    errCbs.forEach(cb => cb());
  }

  public triggerTimeUpdate(time: number) {
    this.currentTime = time;
    const timeCbs = this.listeners.get('timeupdate') || [];
    timeCbs.forEach(cb => cb());
  }
}

describe('VoiceMessagePlayer', () => {
  let originalAudio: typeof Audio;

  beforeEach(() => {
    originalAudio = window.Audio;
    window.Audio = MockAudio as unknown as typeof Audio;
  });

  afterEach(() => {
    window.Audio = originalAudio;
    vi.restoreAllMocks();
  });

  const voiceAttachment: Attachment = {
    id: 'att-voice-1',
    messageId: 'msg-1',
    filename: '123456.ogg',
    originalName: 'voice-message-123456.ogg',
    mimetype: 'audio/ogg;codecs=opus',
    size: 45000,
    duration: 12.5,
    waveform: JSON.stringify(Array(38).fill(0.5)),
    createdAt: Date.now(),
  };

  it('renders voice message player with duration, speed button and waveform', () => {
    render(<VoiceMessagePlayer attachment={voiceAttachment} />);

    expect(screen.getByTestId('voice-message-player')).toBeDefined();
    expect(screen.getByTestId('voice-play-button')).toBeDefined();
    expect(screen.getByTestId('voice-rate-button')).toBeDefined();
    expect(screen.getByTestId('voice-waveform-scrubber')).toBeDefined();
    expect(screen.getByText('0:13')).toBeDefined(); // 12.5s rounded to 13s
  });

  it('toggles playback on play button click', () => {
    render(<VoiceMessagePlayer attachment={voiceAttachment} />);

    const playBtn = screen.getByTestId('voice-play-button');
    fireEvent.click(playBtn);

    // After play, duration display format is current / total (e.g. 0:00 / 0:13)
    expect(screen.getByText(/0:00 \/ 0:13/)).toBeDefined();

    // Clicking again pauses
    fireEvent.click(playBtn);
  });

  it('cycles playback rates: 1x -> 1.5x -> 2x -> 1x', () => {
    render(<VoiceMessagePlayer attachment={voiceAttachment} />);

    const rateBtn = screen.getByTestId('voice-rate-button');
    expect(rateBtn.textContent).toBe('1×');

    fireEvent.click(rateBtn);
    expect(rateBtn.textContent).toBe('1.5×');

    fireEvent.click(rateBtn);
    expect(rateBtn.textContent).toBe('2×');

    fireEvent.click(rateBtn);
    expect(rateBtn.textContent).toBe('1×');
  });

  it('renders regular audio attachment with original filename and size', async () => {
    const musicAttachment: Attachment = {
      id: 'att-music-1',
      messageId: 'msg-2',
      filename: 'song.mp3',
      originalName: 'MySong.mp3',
      mimetype: 'audio/mpeg',
      size: 3500000,
      duration: 180,
      createdAt: Date.now(),
    };

    await act(async () => {
      render(<VoiceMessagePlayer attachment={musicAttachment} />);
    });

    expect(screen.getByText('MySong.mp3')).toBeDefined();
    expect(screen.getByText('3:00')).toBeDefined();
  });

  it('seeks when clicking on waveform scrubber', () => {
    render(<VoiceMessagePlayer attachment={voiceAttachment} />);

    const scrubber = screen.getByTestId('voice-waveform-scrubber');
    scrubber.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 100,
      top: 100,
      width: 200,
      height: 36,
    });

    fireEvent.pointerDown(scrubber, { clientX: 200 }); // middle = 50%
    fireEvent.pointerUp(scrubber);

    // Duration is 12.5s -> 50% is 6.25s -> 0:06
    expect(screen.getByText(/0:06 \/ 0:13/)).toBeDefined();
  });
});
