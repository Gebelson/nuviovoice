import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AttachmentRenderer, isAudioAttachment } from './AttachmentRenderer';
import type { Attachment } from '@concord/shared';

// Mock MockAudio for VoiceMessagePlayer
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
    return Promise.resolve();
  }

  public pause() {}
}

describe('AttachmentRenderer - Voice Message & Media Routing', () => {
  let originalAudio: typeof Audio;

  beforeEach(() => {
    originalAudio = window.Audio;
    window.Audio = MockAudio as unknown as typeof Audio;
  });

  afterEach(() => {
    window.Audio = originalAudio;
    vi.restoreAllMocks();
  });

  it('routes voice-message with video/webm mimetype to VoiceMessagePlayer, NOT VideoAttachment', () => {
    const voiceAtt: Attachment = {
      id: 'att-1',
      messageId: 'msg-1',
      filename: 'voice-1.webm',
      originalName: 'voice-message-1793721105816.webm',
      mimetype: 'video/webm',
      size: 42000,
      createdAt: Date.now(),
      waveform: JSON.stringify(Array(38).fill(0.5)),
    };

    render(<AttachmentRenderer attachment={voiceAtt} />);

    // Should render the dedicated VoiceMessagePlayer
    expect(screen.getByTestId('voice-message-player')).toBeDefined();
    expect(screen.getByTestId('voice-waveform-scrubber')).toBeDefined();
    // Must NOT render a <video> element
    expect(document.querySelector('video')).toBeNull();
  });

  it('routes standard audio attachments to VoiceMessagePlayer', () => {
    const audioAtt: Attachment = {
      id: 'att-2',
      messageId: 'msg-2',
      filename: 'audio-1.ogg',
      originalName: 'clip.ogg',
      mimetype: 'audio/ogg',
      size: 25000,
      createdAt: Date.now(),
    };

    render(<AttachmentRenderer attachment={audioAtt} />);

    expect(screen.getByTestId('voice-message-player')).toBeDefined();
    expect(document.querySelector('video')).toBeNull();
  });

  it('routes real video files to VideoAttachment (<video>)', () => {
    const videoAtt: Attachment = {
      id: 'att-3',
      messageId: 'msg-3',
      filename: 'video-1.mp4',
      originalName: 'screencast.mp4',
      mimetype: 'video/mp4',
      size: 1500000,
      width: 1280,
      height: 720,
      createdAt: Date.now(),
    };

    render(<AttachmentRenderer attachment={videoAtt} />);

    expect(document.querySelector('video')).toBeDefined();
    expect(screen.queryByTestId('voice-message-player')).toBeNull();
  });
});
