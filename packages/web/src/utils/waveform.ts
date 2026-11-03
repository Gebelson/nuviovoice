/**
 * Audio waveform utilities: normalization, offline decoding, and in-memory caching.
 * Ensures consistent, high-performance rendering across voice message recorders and players.
 */

const waveformCache = new Map<string, number[]>();

/**
 * Normalizes an array of arbitrary amplitude samples into exactly `targetBars`
 * floats between `minHeight` and 1.0.
 */
export function normalizeWaveform(
  rawPeaks: number[],
  targetBars = 38,
  minHeight = 0.12,
): number[] {
  if (!rawPeaks || rawPeaks.length === 0) {
    return generateFallbackWaveform('default', targetBars);
  }

  // Find max peak for scaling
  let max = 0;
  for (const p of rawPeaks) {
    if (p > max) max = p;
  }
  if (max <= 0.001) max = 1;

  const result: number[] = [];
  const step = rawPeaks.length / targetBars;

  for (let i = 0; i < targetBars; i++) {
    const start = Math.floor(i * step);
    const end = Math.min(rawPeaks.length, Math.floor((i + 1) * step) || start + 1);

    let binMax = 0;
    for (let j = start; j < end; j++) {
      const val = rawPeaks[j] ?? 0;
      if (val > binMax) binMax = val;
    }

    // Scale between minHeight and 1.0
    const normalized = Math.max(minHeight, Math.min(1, binMax / max));
    // Round to 3 decimal places for compact serialization
    result.push(Math.round(normalized * 1000) / 1000);
  }

  return result;
}

/**
 * Safely parses a stored waveform JSON string.
 */
export function parseWaveformString(stored?: string | null, targetBars = 38): number[] | null {
  if (!stored || typeof stored !== 'string') return null;
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'number') {
      return normalizeWaveform(parsed, targetBars);
    }
  } catch {}
  return null;
}

/**
 * Deterministic, pleasant-looking fallback waveform for audio attachments
 * without precomputed waveform data.
 */
export function generateFallbackWaveform(seedInput: string | number, targetBars = 38): number[] {
  const seedStr = String(seedInput);
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }

  const bars: number[] = [];
  for (let i = 0; i < targetBars; i++) {
    const angle = (i / targetBars) * Math.PI * 4;
    const wave1 = (Math.sin(angle) + 1) / 2;
    const wave2 = (Math.cos(angle * 1.7 + hash) + 1) / 2;
    const val = 0.15 + (wave1 * 0.45 + wave2 * 0.4);
    bars.push(Math.round(Math.max(0.12, Math.min(1, val)) * 1000) / 1000);
  }
  return bars;
}

/**
 * Extracts normalized waveform from an AudioBuffer.
 */
export function extractWaveformFromAudioBuffer(
  audioBuffer: AudioBuffer,
  targetBars = 38,
): number[] {
  const rawData = audioBuffer.getChannelData(0);
  const samples = rawData.length;
  const blockSize = Math.floor(samples / targetBars) || 1;
  const peaks: number[] = [];

  for (let i = 0; i < targetBars; i++) {
    const start = i * blockSize;
    let sum = 0;
    const end = Math.min(samples, start + blockSize);
    for (let j = start; j < end; j++) {
      sum += Math.abs(rawData[j] ?? 0);
    }
    peaks.push(sum / (end - start || 1));
  }

  return normalizeWaveform(peaks, targetBars);
}

/**
 * Retrieves a waveform from cache, stored metadata, or extracts it via Web Audio API.
 * Never decodes or calculates the same audio URL more than once.
 */
export async function getOrExtractWaveform(
  url: string,
  storedWaveform?: string | null,
  targetBars = 38,
): Promise<number[]> {
  // 1. Check in-memory cache
  if (waveformCache.has(url)) {
    return waveformCache.get(url)!;
  }

  // 2. Check stored metadata
  const parsed = parseWaveformString(storedWaveform, targetBars);
  if (parsed) {
    waveformCache.set(url, parsed);
    return parsed;
  }

  // 3. Fallback to offline extraction if browser Web Audio is available
  if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
    try {
      const response = await fetch(url, { method: 'GET', credentials: 'same-origin' });
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          try {
            const decoded = await audioCtx.decodeAudioData(arrayBuffer);
            const extracted = extractWaveformFromAudioBuffer(decoded, targetBars);
            waveformCache.set(url, extracted);
            return extracted;
          } finally {
            try {
              void audioCtx.close();
            } catch {}
          }
        }
      }
    } catch {
      // Fetch or decode failed (CORS, offline, network, mock environment)
    }
  }

  // 4. Procedural fallback
  const fallback = generateFallbackWaveform(url, targetBars);
  waveformCache.set(url, fallback);
  return fallback;
}

export function _clearWaveformCacheForTests(): void {
  waveformCache.clear();
}
