/**
 * Web Audio procedural sound synthesizer for Nuvio Winks.
 *
 * All sound effects are generated locally using procedural Web Audio synthesis:
 * - 0% external asset dependency (no 404s, no CDN latency, 100% offline & desktop compatible)
 * - Zero clipping, gentle dynamic range compression
 * - Volume control (0 - 100%) and mute respect
 * - Autoplay policy compliance with resume() on user interaction
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playWinkSound(soundType: string, volumePercent: number = 80): void {
  if (volumePercent <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  // Safe volume level: max 0.35 to avoid any clipping
  const baseVolume = (Math.max(0, Math.min(100, volumePercent)) / 100) * 0.35;
  masterGain.gain.setValueAtTime(baseVolume, now);
  masterGain.connect(ctx.destination);

  switch (soundType) {
    case 'kiss': {
      // Smooch sound: bandpass noise burst + upward sweep pop
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(750, now + 0.12);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.25);
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.7, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.35);

      // Mini pop after kiss
      const popOsc = ctx.createOscillator();
      const popGain = ctx.createGain();
      popOsc.type = 'triangle';
      popOsc.frequency.setValueAtTime(800, now + 0.18);
      popOsc.frequency.exponentialRampToValueAtTime(220, now + 0.28);
      popGain.gain.setValueAtTime(0.5, now + 0.18);
      popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      popOsc.connect(popGain);
      popGain.connect(masterGain);
      popOsc.start(now + 0.18);
      popOsc.stop(now + 0.32);
      break;
    }

    case 'heartbeat': {
      // Double low-frequency resonant thumps (thump-thump)
      [0, 0.28, 0.85, 1.13, 1.7, 1.98].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(95, now + offset);
        osc.frequency.exponentialRampToValueAtTime(38, now + offset + 0.15);
        gain.gain.setValueAtTime(0.8, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.2);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + offset);
        osc.stop(now + offset + 0.22);
      });
      break;
    }

    case 'sparkle': {
      // Cascading high-frequency chimes
      const freqs = [1046, 1318, 1567, 1760, 2093, 2637, 3135];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);
        gain.gain.setValueAtTime(0.25, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.5);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.55);
      });
      break;
    }

    case 'party': {
      // Party horn slide whistle up + pop
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.35);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.48);
      break;
    }

    case 'pop': {
      // Inflating wobble then loud balloon pop
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.linearRampToValueAtTime(440, now + 0.6);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.5, now + 0.58);
      gain.gain.setValueAtTime(0.001, now + 0.61);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.62);

      // Sharp burst pop
      const popOsc = ctx.createOscillator();
      const popGain = ctx.createGain();
      popOsc.type = 'triangle';
      popOsc.frequency.setValueAtTime(950, now + 0.61);
      popOsc.frequency.exponentialRampToValueAtTime(80, now + 0.72);
      popGain.gain.setValueAtTime(0.8, now + 0.61);
      popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      popOsc.connect(popGain);
      popGain.connect(masterGain);
      popOsc.start(now + 0.61);
      popOsc.stop(now + 0.76);
      break;
    }

    case 'laugh': {
      // Bouncing melodic giggle notes
      const notes = [587, 740, 880, 740, 880, 988, 880, 988, 1174];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        gain.gain.setValueAtTime(0.4, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.14);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.16);
      });
      break;
    }

    case 'cry': {
      // Comical descending wah-wah slide
      [0, 0.45, 0.9].forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        const startFreq = 480 - idx * 40;
        osc.frequency.setValueAtTime(startFreq, now + offset);
        osc.frequency.exponentialRampToValueAtTime(startFreq * 0.65, now + offset + 0.35);
        gain.gain.setValueAtTime(0.3, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.4);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + offset);
        osc.stop(now + offset + 0.42);
      });
      break;
    }

    case 'angry': {
      // Steaming cartoon whistle + low grumble
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(780, now);
      osc.frequency.linearRampToValueAtTime(1450, now + 0.5);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.65);
      break;
    }

    case 'chime': {
      // Celestial shooting stars harp
      const freqs = [784, 988, 1175, 1396, 1568, 1976, 2349];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.15);
        gain.gain.setValueAtTime(0.28, now + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.6);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.65);
      });
      break;
    }

    case 'bloom': {
      // Pleasant floral glissando
      const freqs = [440, 554, 659, 880, 1108, 1318];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.13);
        gain.gain.setValueAtTime(0.3, now + i * 0.13);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.13 + 0.5);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + i * 0.13);
        osc.stop(now + i * 0.13 + 0.55);
      });
      break;
    }

    case 'hug': {
      // Warm major 7th chord swell
      const freqs = [261.63, 329.63, 392.0, 493.88];
      freqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 1.25);
      });
      break;
    }

    case 'dance': {
      // 4-beat funky bass bounce
      const bassNotes = [110, 130.8, 146.8, 164.8];
      bassNotes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + i * 0.22);
        gain.gain.setValueAtTime(0.3, now + i * 0.22);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.22 + 0.18);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + i * 0.22);
        osc.stop(now + i * 0.22 + 0.2);
      });
      break;
    }

    case 'fireworks': {
      // Whistle up then detonate
      const whistle = ctx.createOscillator();
      const wGain = ctx.createGain();
      whistle.type = 'sine';
      whistle.frequency.setValueAtTime(350, now);
      whistle.frequency.exponentialRampToValueAtTime(1400, now + 0.4);
      wGain.gain.setValueAtTime(0.2, now);
      wGain.gain.linearRampToValueAtTime(0.001, now + 0.42);
      whistle.connect(wGain);
      wGain.connect(masterGain);
      whistle.start(now);
      whistle.stop(now + 0.43);

      // Multi-burst detonate
      [0.42, 0.72, 1.05].forEach((offset) => {
        const boom = ctx.createOscillator();
        const bGain = ctx.createGain();
        boom.type = 'triangle';
        boom.frequency.setValueAtTime(160, now + offset);
        boom.frequency.exponentialRampToValueAtTime(40, now + offset + 0.3);
        bGain.gain.setValueAtTime(0.7, now + offset);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.35);
        boom.connect(bGain);
        bGain.connect(masterGain);
        boom.start(now + offset);
        boom.stop(now + offset + 0.38);
      });
      break;
    }

    case 'love': {
      // Warm romantic harp flutter
      const freqs = [523, 659, 784, 1046, 1318];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.3, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.4);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.45);
      });
      break;
    }

    case 'knock': {
      // Screen knock: 3 sharp wooden/glass taps (knock-knock-knock)
      [0, 0.18, 0.4].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, now + offset);
        osc.frequency.exponentialRampToValueAtTime(80, now + offset + 0.08);
        gain.gain.setValueAtTime(0.9, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + offset);
        osc.stop(now + offset + 0.12);
      });
      break;
    }

    case 'gift': {
      // Surprise gift fanfare chime
      const fanfare = [392, 523, 659, 784];
      fanfare.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);
        gain.gain.setValueAtTime(0.4, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.4);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.45);
      });
      break;
    }

    default:
      break;
  }
}
