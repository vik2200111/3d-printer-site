"use client";

class CyberSoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private lastSliderTime: number = 0;

  constructor() {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("voxel_forge_sound_muted");
      if (saved === "true") {
        this.muted = true;
      }
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === "undefined" || this.muted) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("voxel_forge_sound_muted", String(mute));
    }
    if (!mute) {
      this.playToggle(true);
    }
  }

  /** Mechanical tactile keyswitch click for standard buttons */
  public playClick(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.032);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.036);

    const chirp = ctx.createOscillator();
    const chirpGain = ctx.createGain();
    chirp.type = "square";
    chirp.frequency.setValueAtTime(1450, now);
    chirp.frequency.exponentialRampToValueAtTime(2100, now + 0.014);

    chirpGain.gain.setValueAtTime(0.035, now);
    chirpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

    chirp.connect(chirpGain);
    chirpGain.connect(ctx.destination);
    chirp.start(now);
    chirp.stop(now + 0.016);
  }

  /** Rotary encoder detent tick for range sliders */
  public playSliderTick(percent: number): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const nowMs = performance.now();
    if (nowMs - this.lastSliderTime < 32) return;
    this.lastSliderTime = nowMs;

    const now = ctx.currentTime;
    const clamped = Math.max(0, Math.min(100, percent));
    const baseFreq = 420 + (clamped / 100) * 620;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, now + 0.014);

    gain.gain.setValueAtTime(0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.016);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.018);
  }

  /** Toggle switch snap */
  public playToggle(on: boolean): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    if (on) {
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.setValueAtTime(760, now + 0.025);
    } else {
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.setValueAtTime(390, now + 0.025);
    }

    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  /** Cyber laser mesh scan sweep when a 3D model is dropped or loaded */
  public playModelScan(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sawtooth";
    osc2.type = "triangle";

    osc1.frequency.setValueAtTime(220, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.16);

    osc2.frequency.setValueAtTime(440, now);
    osc2.frequency.exponentialRampToValueAtTime(1320, now + 0.16);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.19);
    osc2.stop(now + 0.19);
  }

  /** 3-note ascending phosphor terminal chime */
  public playSuccess(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 1046.5];
    notes.forEach((freq, idx) => {
      const start = ctx.currentTime + idx * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.09, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.15);
    });
  }

  /** Low damped terminal error buzz */
  public playError(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.16);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.19);
  }
}

export const soundEngine = new CyberSoundEngine();
