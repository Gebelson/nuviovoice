/**
 * Procedural synthesis fallback for the 16 official Soundpad presets.
 * Generates an AudioBuffer in-memory for instant playback even offline
 * or if static asset fetch is unavailable.
 */

export function synthesizePresetBuffer(ctx: AudioContext, presetKey: string): AudioBuffer | null {
  const sampleRate = ctx.sampleRate || 48000;
  const key = presetKey.toLowerCase().replace(/[^a-z0-9]/g, '_');

  const createBuffer = (durationSec: number, render: (channel: Float32Array) => void): AudioBuffer => {
    const length = Math.floor(sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    render(data);
    return buffer;
  };

  switch (key) {
    case 'airhorn': {
      // Classic DJ airhorn: 3 chord tones (D5, F#5, A5) + pitch bend + fast attack
      return createBuffer(1.3, (data) => {
        const freqs = [587.33, 739.99, 880.0]; // D major chord
        for (let i = 0; i < data.length; i++) {
          const t = i / sampleRate;
          // Pitch dip at start then stable
          const pitchMod = t < 0.08 ? 1.0 - Math.exp(-t * 80) * 0.15 : 1.0;
          let sample = 0;
          for (const f of freqs) {
            // Sawtooth-like sum of harmonics
            sample += Math.sin(2 * Math.PI * f * pitchMod * t) * 0.35;
            sample += Math.sin(4 * Math.PI * f * pitchMod * t) * 0.2;
            sample += Math.sin(6 * Math.PI * f * pitchMod * t) * 0.1;
          }
          // Envelope: fast burst, slight stutter, decay
          const env = Math.exp(-t * 2.2) * (t < 0.02 ? t / 0.02 : 1.0);
          data[i] = Math.max(-1, Math.min(1, sample * env * 0.8));
        }
      });
    }

    case 'crickets': {
      // Cricket chirps: bursts of high frequency (4500Hz) pulsed noise
      return createBuffer(1.8, (data) => {
        for (let i = 0; i < data.length; i++) {
          const t = i / sampleRate;
          // Chirp cycle every 0.35s, with 3 quick clicks inside
          const cycle = t % 0.45;
          const chirpEnv = cycle < 0.18
            ? Math.sin((cycle / 0.18) * Math.PI * 4) * Math.exp(-cycle * 15)
            : 0;
          const carrier = Math.sin(2 * Math.PI * 4600 * t) + (Math.random() - 0.5) * 0.2;
          data[i] = carrier * chirpEnv * 0.5;
        }
      });
    }

    case 'sad_violin': {
      // Minor slow bowing glide with vibrato
      return createBuffer(2.4, (data) => {
        for (let i = 0; i < data.length; i++) {
          const t = i / sampleRate;
          const vibrato = 1 + 0.02 * Math.sin(2 * Math.PI * 5.5 * t);
          // Tone drops from E4 (329.6) to Eb4 (311.1) to C4 (261.6)
          const baseFreq = t < 1.0 ? 329.6 - t * 18 : 311.1 - (t - 1.0) * 45;
          const freq = baseFreq * vibrato;
          let sample = Math.sin(2 * Math.PI * freq * t) * 0.5;
          sample += Math.sin(4 * Math.PI * freq * t) * 0.25;
          sample += Math.sin(6 * Math.PI * freq * t) * 0.12;
          const env = Math.min(1, t / 0.25) * Math.exp(-t * 0.8);
          data[i] = sample * env * 0.7;
        }
      });
    }

    case 'womp_womp': {
      // 2 comical sliding brass falls: Womp (high to low) ... Womp (lower to lower)
      return createBuffer(1.4, (data) => {
        for (let i = 0; i < data.length; i++) {
          const t = i / sampleRate;
          const hit2 = t >= 0.6;
          const hitTime = hit2 ? t - 0.6 : t;
          if (hitTime < 0.55) {
            const startFreq = hit2 ? 220 : 260;
            const endFreq = hit2 ? 140 : 180;
            const freq = startFreq - (startFreq - endFreq) * (hitTime / 0.55);
            const sample = Math.sin(2 * Math.PI * freq * hitTime) * 0.6 +
              Math.sin(4 * Math.PI * freq * hitTime) * 0.3;
            const env = (hitTime < 0.05 ? hitTime / 0.05 : 1.0) * Math.exp(-hitTime * 4.0);
            data[i] = sample * env * 0.75;
          }
        }
      });
    }

    case 'rimshot': {
      // Drum kick + stick snare + cymbal click: "Ba-dum-tss"
      return createBuffer(0.7, (data) => {
        for (let i = 0; i < data.length; i++) {
          const t = i / sampleRate;
          let sample = 0;
          // Hit 1: Ba (t = 0.0)
          if (t < 0.18) {
            const freq = 160 * Math.exp(-t * 25);
            sample += Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 18) * 0.6;
          }
          // Hit 2: Dum (t = 0.18)
          if (t >= 0.18 && t < 0.36) {
            const t2 = t - 0.18;
            const freq = 140 * Math.exp(-t2 * 25);
            sample += Math.sin(2 * Math.PI * freq * t2) * Math.exp(-t2 * 18) * 0.7;
          }
          // Hit 3: Tsss (t = 0.36)
          if (t >= 0.36) {
            const t3 = t - 0.36;
            const noise = (Math.random() - 0.5) * 2;
            sample += noise * Math.exp(-t3 * 10) * 0.8;
          }
          data[i] = Math.max(-1, Math.min(1, sample));
        }
      });
    }

    case 'sad_trombone': {
      // 4 descending wah wah wah waaaah tones
      return createBuffer(2.2, (data) => {
        const notes = [
          { start: 0.0, dur: 0.45, f: 233.08 }, // Bb3
          { start: 0.45, dur: 0.45, f: 220.00 }, // A3
          { start: 0.9, dur: 0.45, f: 207.65 }, // Ab3
          { start: 1.35, dur: 0.8, f: 196.00, slideTo: 140 }, // G3 slide down
        ];
        for (let i = 0; i < data.length; i++) {
          const t = i / sampleRate;
          for (const n of notes) {
            if (t >= n.start && t < n.start + n.dur) {
              const localT = t - n.start;
              const freq = n.slideTo
                ? n.f - (n.f - n.slideTo) * (localT / n.dur)
                : n.f;
              // Wah effect via harmonic filter
              const wah = 1 + 0.3 * Math.sin(2 * Math.PI * 6 * localT);
              const sample = (Math.sin(2 * Math.PI * freq * localT) +
                0.4 * Math.sin(4 * Math.PI * freq * localT) +
                0.2 * Math.sin(6 * Math.PI * freq * localT)) * wah;
              const env = Math.min(1, localT / 0.04) * Math.exp(-localT * (n.slideTo ? 1.8 : 3.5));
              data[i] = sample * env * 0.7;
              break;
            }
          }
        }
      });
    }

    case 'dun_dun_dun': {
      // 3 suspense hits: Dun... Dun... DUUUUN!
      return createBuffer(2.0, (data) => {
        const hits = [
          { start: 0.0, dur: 0.4, f: 180 },
          { start: 0.45, dur: 0.4, f: 170 },
          { start: 0.95, dur: 1.0, f: 130 },
        ];
        for (let i = 0; i < data.length; i++) {
          const t = i / sampleRate;
          for (const h of hits) {
            if (t >= h.start && t < h.start + h.dur) {
              const dt = t - h.start;
              const sample = Math.sin(2 * Math.PI * h.f * dt) * 0.5 +
                Math.sin(2 * Math.PI * (h.f * 1.5) * dt) * 0.3 +
                Math.sin(2 * Math.PI * (h.f * 2.0) * dt) * 0.2;
              const env = Math.exp(-dt * (h.dur > 0.5 ? 2.0 : 4.0));
              data[i] = sample * env * 0.8;
              break;
            }
          }
        }
      });
    }

    case 'vine_boom': {
      // Heavy deep distorted 808 sub boom + transient punch
      return createBuffer(1.5, (data) => {
        for (let i = 0; i < data.length; i++) {
          const t = i / sampleRate;
          const punch = t < 0.05 ? (Math.random() - 0.5) * Math.exp(-t * 60) * 0.8 : 0;
          const pitch = 110 * Math.exp(-t * 12) + 38;
          let sub = Math.sin(2 * Math.PI * pitch * t);
          // Hard clipping / distortion
          sub = Math.tanh(sub * 2.5) * 0.8;
          const env = Math.exp(-t * 2.2);
          data[i] = (sub + punch) * env * 0.85;
        }
      });
    }

    case 'bruh': {
      // Low formant vocal synthesis for "bruh"
      return createBuffer(0.7, (data) => {
        for (let i = 0; i < data.length; i++) {
          const t = i / sampleRate;
          const pitch = 95 - t * 25;
          const f1 = 500; // vocal vowel 'uh' formant
          const f2 = 1000;
          let s = Math.sin(2 * Math.PI * pitch * t) * 0.4;
          s += Math.sin(2 * Math.PI * f1 * t) * Math.exp(-((t % (1 / pitch)) * pitch * 5)) * 0.3;
          s += Math.sin(2 * Math.PI * f2 * t) * Math.exp(-((t % (1 / pitch)) * pitch * 8)) * 0.2;
          const env = (t < 0.08 ? t / 0.08 : 1.0) * Math.exp(-t * 3.5);
          data[i] = s * env * 0.8;
        }
      });
    }

    case 'oh_no': {
      // 2 rising cartoon chords: Oh... No!
      return createBuffer(0.9, (data) => {
        for (let i = 0; i < data.length; i++) {
          const t = i / sampleRate;
          const hit2 = t >= 0.35;
          const dt = hit2 ? t - 0.35 : t;
          const freq = hit2 ? 520 + dt * 100 : 392 + dt * 80;
          const s = Math.sin(2 * Math.PI * freq * dt) * 0.6 + Math.sin(4 * Math.PI * freq * dt) * 0.2;
          const env = Math.exp(-dt * 6);
          data[i] = s * env * 0.7;
        }
      });
    }

    case 'sheesh': {
      // High frequency rising hiss/whistle
      return createBuffer(1.0, (data) => {
        for (let i = 0; i < data.length; i++) {
          const t = i / sampleRate;
          const freq = 1200 + t * 900;
          const tone = Math.sin(2 * Math.PI * freq * t) * 0.4;
          const breath = (Math.random() - 0.5) * 0.2;
          const env = Math.sin((t / 1.0) * Math.PI) * Math.exp(-t * 0.5);
          data[i] = (tone + breath) * env * 0.8;
        }
      });
    }

    case 'bonk': {
      // Fast wooden cartoon bonk (fast pitch drop from 800Hz to 200Hz in 0.05s)
      return createBuffer(0.5, (data) => {
        for (let i = 0; i < data.length; i++) {
          const t = i / sampleRate;
          const pitch = 700 * Math.exp(-t * 40) + 180;
          const sample = Math.sin(2 * Math.PI * pitch * t) * 0.7 +
            Math.sin(4 * Math.PI * pitch * t) * 0.3;
          const env = Math.exp(-t * 14);
          data[i] = sample * env * 0.85;
        }
      });
    }

    case 'noice': {
      // Tongue click pop + rising "nice" chirp
      return createBuffer(0.7, (data) => {
        for (let i = 0; i < data.length; i++) {
          const t = i / sampleRate;
          let sample = 0;
          // Pop
          if (t < 0.05) {
            sample += Math.sin(2 * Math.PI * (1800 * Math.exp(-t * 80)) * t) * 0.8;
          } else {
            const dt = t - 0.05;
            const freq = 440 + dt * 280;
            sample += Math.sin(2 * Math.PI * freq * dt) * Math.exp(-dt * 5) * 0.6;
          }
          data[i] = sample * 0.8;
        }
      });
    }

    case 'sus': {
      // Among Us 6-note synth arpeggio (C, Eb, F, F#, F, Eb, C)
      return createBuffer(1.3, (data) => {
        const notes = [
          { f: 523.25, start: 0.0, dur: 0.15 },
          { f: 622.25, start: 0.15, dur: 0.15 },
          { f: 698.46, start: 0.3, dur: 0.15 },
          { f: 739.99, start: 0.45, dur: 0.15 },
          { f: 698.46, start: 0.6, dur: 0.15 },
          { f: 622.25, start: 0.75, dur: 0.15 },
          { f: 523.25, start: 0.9, dur: 0.35 },
        ];
        for (let i = 0; i < data.length; i++) {
          const t = i / sampleRate;
          for (const n of notes) {
            if (t >= n.start && t < n.start + n.dur) {
              const dt = t - n.start;
              const sample = Math.sin(2 * Math.PI * n.f * dt) * 0.6 +
                Math.sin(4 * Math.PI * n.f * dt) * 0.2;
              const env = Math.exp(-dt * 5);
              data[i] = sample * env * 0.75;
              break;
            }
          }
        }
      });
    }

    case 'wilhelm': {
      // Classic cinematic modulated scream
      return createBuffer(1.2, (data) => {
        for (let i = 0; i < data.length; i++) {
          const t = i / sampleRate;
          const pitch = 600 - t * 180 + Math.sin(2 * Math.PI * 18 * t) * 35;
          const voice = Math.sin(2 * Math.PI * pitch * t) * 0.5;
          const raspy = (Math.random() - 0.5) * 0.3;
          const env = (t < 0.1 ? t / 0.1 : 1.0) * Math.exp(-t * 2.0);
          data[i] = (voice + raspy) * env * 0.7;
        }
      });
    }

    case 'toot': {
      // Party blowout horn / squeaker
      return createBuffer(0.65, (data) => {
        for (let i = 0; i < data.length; i++) {
          const t = i / sampleRate;
          const pitch = 450 + 20 * Math.sin(2 * Math.PI * 30 * t);
          let s = Math.sin(2 * Math.PI * pitch * t) * 0.4;
          s += Math.sin(4 * Math.PI * pitch * t) * 0.3;
          s += Math.sin(6 * Math.PI * pitch * t) * 0.2;
          const env = (t < 0.03 ? t / 0.03 : 1.0) * Math.exp(-t * 3.5);
          data[i] = s * env * 0.75;
        }
      });
    }

    default:
      return null;
  }
}
