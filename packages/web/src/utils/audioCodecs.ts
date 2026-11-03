/**
 * Runtime audio codec and container detection for MediaRecorder.
 * Prioritizes Opus inside WebM/Ogg containers where available, falling back
 * gracefully to MP4/AAC on Safari/iOS, and generic formats elsewhere.
 */

export interface SupportedAudioFormat {
  mimeType: string;
  extension: string;
}

const CANDIDATES: Array<{ mimeType: string; extension: string }> = [
  { mimeType: 'audio/webm;codecs=opus', extension: '.webm' },
  { mimeType: 'audio/ogg;codecs=opus', extension: '.ogg' },
  { mimeType: 'audio/webm', extension: '.webm' },
  { mimeType: 'audio/mp4;codecs=opus', extension: '.mp4' },
  { mimeType: 'audio/mp4', extension: '.mp4' },
  { mimeType: 'audio/aac', extension: '.aac' },
  { mimeType: 'audio/wav', extension: '.wav' },
];

let cachedFormat: SupportedAudioFormat | null = null;

export function getSupportedAudioFormat(): SupportedAudioFormat {
  if (cachedFormat) return cachedFormat;

  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    cachedFormat = { mimeType: 'audio/webm', extension: '.webm' };
    return cachedFormat;
  }

  for (const candidate of CANDIDATES) {
    try {
      if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(candidate.mimeType)) {
        cachedFormat = candidate;
        return cachedFormat;
      }
    } catch {
      // isTypeSupported can throw on certain restricted environments
    }
  }

  // Fallback if no candidate explicitly matched
  cachedFormat = { mimeType: '', extension: '.webm' };
  return cachedFormat;
}

/** Reset cached format — useful for testing in varying environments */
export function _resetCachedFormatForTests(): void {
  cachedFormat = null;
}
