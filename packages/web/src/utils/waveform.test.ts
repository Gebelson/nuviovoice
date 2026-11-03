import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeWaveform,
  parseWaveformString,
  generateFallbackWaveform,
  getOrExtractWaveform,
  _clearWaveformCacheForTests,
} from './waveform';

describe('waveform utilities', () => {
  beforeEach(() => {
    _clearWaveformCacheForTests();
  });

  it('normalizes raw peaks to exact target bar count and bounds', () => {
    const raw = [0.1, 0.5, 0.8, 0.2, 0.9, 0.4, 0.1, 0.05];
    const bars = normalizeWaveform(raw, 20, 0.12);

    expect(bars.length).toBe(20);
    for (const b of bars) {
      expect(b).toBeGreaterThanOrEqual(0.12);
      expect(b).toBeLessThanOrEqual(1.0);
    }
  });

  it('handles empty peaks with organic fallback', () => {
    const bars = normalizeWaveform([], 38);
    expect(bars.length).toBe(38);
    expect(bars[0]).toBeGreaterThanOrEqual(0.12);
  });

  it('parses valid JSON waveform string', () => {
    const stored = JSON.stringify([0.2, 0.6, 0.9, 0.4]);
    const parsed = parseWaveformString(stored, 10);
    expect(parsed).not.toBeNull();
    expect(parsed!.length).toBe(10);
  });

  it('returns null on invalid or non-array waveform JSON', () => {
    expect(parseWaveformString('not-json')).toBeNull();
    expect(parseWaveformString('{"a":1}')).toBeNull();
    expect(parseWaveformString(null)).toBeNull();
    expect(parseWaveformString(undefined)).toBeNull();
  });

  it('generates consistent deterministic fallback waveforms for a given seed', () => {
    const a = generateFallbackWaveform('audio-key-1', 30);
    const b = generateFallbackWaveform('audio-key-1', 30);
    expect(a).toEqual(b);
    expect(a.length).toBe(30);
  });

  it('caches extracted waveforms and returns cached result on subsequent calls', async () => {
    const stored = JSON.stringify([0.1, 0.5, 0.9]);
    const first = await getOrExtractWaveform('test-audio.ogg', stored, 15);
    const second = await getOrExtractWaveform('test-audio.ogg', null, 15);

    expect(first).toBe(second); // Exact same reference from cache
  });
});
