// Procedural Web Audio Engine for AtCoder Flow Practice Platform
// Zero audio files — synthesizes tactile mechanical clicks, reel ticks, and euphoric AC chimes.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
  }

  ensureContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  toggleMute(forceState) {
    if (typeof forceState === 'boolean') {
      this.isMuted = forceState;
    } else {
      this.isMuted = !this.isMuted;
    }
    return this.isMuted;
  }

  /**
   * Tactile mechanical keyboard switch click.
   */
  playClick() {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.035);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.Q.setValueAtTime(3.5, t);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.035);
  }

  /**
   * High-speed micro-click for the 350ms digital reel spin.
   */
  playReelTick() {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800 + Math.random() * 400, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.015);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.015);
  }

  /**
   * Deep tactile bass lock-in for the AC verdict.
   */
  playHeavyThud() {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.18);
  }

  /**
   * Euphoric AC chime arpeggio: C5 - E5 - G5 - C6.
   */
  playChime() {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.playHeavyThud();

    const notes = [523.25, 659.25, 783.99, 1046.50];
    const stagger = 0.07;
    const decay = 0.75;

    notes.forEach((freq, idx) => {
      const startTime = ctx.currentTime + (idx * stagger);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + decay);
    });
  }

  /**
   * Subtle tick when rolling up the performance rating counter.
   */
  playOdometerTick() {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.012);

    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.012);
  }

  /**
   * Cleared run / critical solve celebration fanfare arpeggio.
   */
  playJackpot() {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.playHeavyThud();

    const notes = [523.25, 659.25, 783.99, 987.77, 1046.50, 1318.51];
    const stagger = 0.06;
    const decay = 0.85;

    notes.forEach((freq, idx) => {
      const startTime = ctx.currentTime + (idx * stagger);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.16, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + decay);
    });
  }
}

export const audioEngine = new AudioEngine();
