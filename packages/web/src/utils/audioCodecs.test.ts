import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSupportedAudioFormat, _resetCachedFormatForTests } from './audioCodecs';

describe('audioCodecs', () => {
  beforeEach(() => {
    _resetCachedFormatForTests();
    vi.restoreAllMocks();
  });

  it('selects webm opus when supported', () => {
    const isTypeSupported = vi.fn((mime: string) => mime === 'audio/webm;codecs=opus');
    vi.stubGlobal('MediaRecorder', { isTypeSupported });

    const format = getSupportedAudioFormat();
    expect(format.mimeType).toBe('audio/webm;codecs=opus');
    expect(format.extension).toBe('.webm');
  });

  it('selects ogg opus when webm opus is not supported', () => {
    const isTypeSupported = vi.fn((mime: string) => mime === 'audio/ogg;codecs=opus');
    vi.stubGlobal('MediaRecorder', { isTypeSupported });

    const format = getSupportedAudioFormat();
    expect(format.mimeType).toBe('audio/ogg;codecs=opus');
    expect(format.extension).toBe('.ogg');
  });

  it('falls back to mp4 / aac on Safari / iOS environments', () => {
    const isTypeSupported = vi.fn((mime: string) => mime === 'audio/mp4');
    vi.stubGlobal('MediaRecorder', { isTypeSupported });

    const format = getSupportedAudioFormat();
    expect(format.mimeType).toBe('audio/mp4');
    expect(format.extension).toBe('.mp4');
  });

  it('handles environment where MediaRecorder is undefined', () => {
    vi.stubGlobal('MediaRecorder', undefined);

    const format = getSupportedAudioFormat();
    expect(format.extension).toBe('.webm');
  });

  it('handles isTypeSupported throwing an exception', () => {
    const isTypeSupported = vi.fn(() => {
      throw new Error('Not supported');
    });
    vi.stubGlobal('MediaRecorder', { isTypeSupported });

    const format = getSupportedAudioFormat();
    expect(format.extension).toBe('.webm');
  });
});
