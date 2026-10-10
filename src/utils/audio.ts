// Web Audio API Sound Engine for AI Quiz Master
// Completely independent of external network assets, zero CORS or latency issues.

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Check localStorage for mute preference
    try {
      const saved = localStorage.getItem('quiz_sound_muted');
      if (saved !== null) {
        this.isMuted = saved === 'true';
      }
    } catch {
      this.isMuted = false;
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('quiz_sound_muted', String(this.isMuted));
    } catch {}
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    try {
      localStorage.setItem('quiz_sound_muted', String(muted));
    } catch {}
  }

  /**
   * Sound effect for CORRECT answer:
   * Bright, cheerful 4-note ascending major arpeggio with shimmering harmonics
   */
  public playCorrect() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // Notes: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz), C6 (1046.50Hz)
      const notes = [523.25, 659.25, 783.99, 1046.50];

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        // Envelope
        const startTime = now + idx * 0.08;
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.3, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.36);
      });
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  /**
   * Sound effect for WRONG answer:
   * Low, soft descending buzzer / negative cue
   */
  public playWrong() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      // Pitch drop from 240Hz down to 110Hz
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.3);

      // Low-pass filter to make it softer and not harsh
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(300, now + 0.3);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  /**
   * Victory Fanfare:
   * Triumphant fanfare melody upon completing the quiz
   * (C4 -> E4 -> G4 -> C5 -> E5 -> G5 -> C6 with harmonious chord finish)
   */
  public playVictory() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Melody notes: [freq, startTimeOffset, duration]
      const fanfare = [
        { freq: 261.63, start: 0.0, dur: 0.14 }, // C4
        { freq: 329.63, start: 0.14, dur: 0.14 }, // E4
        { freq: 392.00, start: 0.28, dur: 0.14 }, // G4
        { freq: 523.25, start: 0.42, dur: 0.28 }, // C5
        { freq: 392.00, start: 0.72, dur: 0.14 }, // G4
        { freq: 523.25, start: 0.88, dur: 0.55 }, // C5 (held)
      ];

      fanfare.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + start);

        const s = now + start;
        gain.gain.setValueAtTime(0.001, s);
        gain.gain.exponentialRampToValueAtTime(0.35, s + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, s + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(s);
        osc.stop(s + dur + 0.05);
      });

      // Grand finale chord at 1.45s: C Major chord (C5 + E5 + G5 + C6)
      const chordNotes = [523.25, 659.25, 783.99, 1046.50];
      chordNotes.forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + 1.45);

        const s = now + 1.45;
        gain.gain.setValueAtTime(0.001, s);
        gain.gain.exponentialRampToValueAtTime(0.25, s + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, s + 1.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(s);
        osc.stop(s + 1.55);
      });
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }
}

export const sound = new SoundEngine();
