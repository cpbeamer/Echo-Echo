/**
 * VibeScoreEngine – Generative ambient soundtrack using the Web Audio API.
 *
 * Synthesizes a continuously evolving soundscape driven by simulation state:
 * - Drone layer: low sine oscillator whose frequency rises with chaos
 * - Pad layer: detuned sawtooth pair through a low-pass filter; cutoff maps to peace ratio
 * - SFX: short envelope-shaped bursts for discrete simulation events
 *
 * Peace mapping:
 *   peace > 0.7 → warm, slow, consonant
 *   peace < 0.3 → harsh, fast LFO, dissonant
 */

export type SfxType = 'data_bomb' | 'agent_death' | 'conflict' | 'meme_swap' | 'birth';

// ── Pure helper functions (exported for testing) ────────────────────────

/** Map peace ratio [0,1] to drone frequency (Hz). More chaos = higher drone. */
export function peaceToFrequency(peace: number): number {
  return 60 + (1 - peace) * 60; // 60 Hz (peaceful) → 120 Hz (chaotic)
}

/** Map peace ratio [0,1] to low-pass filter cutoff (Hz). */
export function peaceToCutoff(peace: number): number {
  return 200 + peace * 600; // chaotic = 200 Hz (dark), peaceful = 800 Hz (warm)
}

/** Map faction diversity to pad detune (cents). More factions = more dissonance. */
export function factionCountToDetune(factionCounts: Record<string, number>): number {
  const activeFactions = Object.values(factionCounts).filter((c) => c > 0).length;
  return activeFactions * 8; // 0–40 cents detune
}

/** Map total alive agents to drone gain. More agents = fuller sound. */
export function populationToGain(totalAlive: number): number {
  return Math.min(1, totalAlive / 200) * 0.15; // caps at 0.15 gain
}

/** Map peace ratio to LFO rate (Hz). Low peace = fast tremolo. */
export function peaceToLfoRate(peace: number): number {
  return 0.5 + (1 - peace) * 4; // 0.5 Hz (calm) → 4.5 Hz (frantic)
}

// ── Engine class ────────────────────────────────────────────────────────

export class VibeScoreEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Drone layer
  private droneOsc: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;

  // Pad layer
  private padOsc1: OscillatorNode | null = null;
  private padOsc2: OscillatorNode | null = null;
  private padFilter: BiquadFilterNode | null = null;
  private padGain: GainNode | null = null;

  // LFO (tremolo)
  private lfoOsc: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;

  private _muted: boolean = true;
  private _volume: number = 0.3;

  get muted(): boolean {
    return this._muted;
  }

  /** Initialize the AudioContext and start oscillators. Must be called from a user gesture. */
  init(): void {
    if (this.ctx) return;

    this.ctx = new AudioContext();

    // Master gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this._muted ? 0 : this._volume;
    this.masterGain.connect(this.ctx.destination);

    // ── Drone layer ──
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.1;
    this.droneGain.connect(this.masterGain);

    this.droneOsc = this.ctx.createOscillator();
    this.droneOsc.type = 'sine';
    this.droneOsc.frequency.value = 80;
    this.droneOsc.connect(this.droneGain);
    this.droneOsc.start();

    // ── Pad layer (detuned sawtooth pair → filter) ──
    this.padFilter = this.ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 500;
    this.padFilter.Q.value = 1;

    this.padGain = this.ctx.createGain();
    this.padGain.gain.value = 0.06;
    this.padFilter.connect(this.padGain);
    this.padGain.connect(this.masterGain);

    this.padOsc1 = this.ctx.createOscillator();
    this.padOsc1.type = 'sawtooth';
    this.padOsc1.frequency.value = 130;
    this.padOsc1.connect(this.padFilter);
    this.padOsc1.start();

    this.padOsc2 = this.ctx.createOscillator();
    this.padOsc2.type = 'sawtooth';
    this.padOsc2.frequency.value = 130.5; // slight detune
    this.padOsc2.connect(this.padFilter);
    this.padOsc2.start();

    // ── LFO (amplitude tremolo on pad) ──
    this.lfoOsc = this.ctx.createOscillator();
    this.lfoOsc.type = 'sine';
    this.lfoOsc.frequency.value = 1;

    this.lfoGain = this.ctx.createGain();
    this.lfoGain.gain.value = 0.03;
    this.lfoOsc.connect(this.lfoGain);
    this.lfoGain.connect(this.padGain.gain);
    this.lfoOsc.start();
  }

  /** Tear down all audio nodes. */
  destroy(): void {
    if (!this.ctx) return;

    this.droneOsc?.stop();
    this.padOsc1?.stop();
    this.padOsc2?.stop();
    this.lfoOsc?.stop();

    void this.ctx.close();

    this.ctx = null;
    this.masterGain = null;
    this.droneOsc = null;
    this.droneGain = null;
    this.padOsc1 = null;
    this.padOsc2 = null;
    this.padFilter = null;
    this.padGain = null;
    this.lfoOsc = null;
    this.lfoGain = null;
  }

  /**
   * Update the ambient soundtrack based on simulation state.
   * Smoothly transitions parameters using exponential ramps.
   */
  updateAmbient(
    peaceRatio: number,
    factionCounts: Record<string, number>,
    totalAlive: number,
  ): void {
    if (!this.ctx || this._muted) return;

    const now = this.ctx.currentTime;
    const rampTime = 2; // seconds for smooth transitions

    // Drone frequency: chaos → higher pitch
    if (this.droneOsc) {
      this.droneOsc.frequency.exponentialRampToValueAtTime(
        peaceToFrequency(peaceRatio),
        now + rampTime,
      );
    }

    // Drone gain: scales with population
    if (this.droneGain) {
      this.droneGain.gain.linearRampToValueAtTime(populationToGain(totalAlive), now + rampTime);
    }

    // Pad filter cutoff: peace → warmer
    if (this.padFilter) {
      this.padFilter.frequency.exponentialRampToValueAtTime(
        peaceToCutoff(peaceRatio),
        now + rampTime,
      );
    }

    // Pad detune: faction diversity → dissonance
    const detune = factionCountToDetune(factionCounts);
    if (this.padOsc2) {
      this.padOsc2.detune.linearRampToValueAtTime(detune, now + rampTime);
    }

    // LFO rate: low peace → fast tremolo
    if (this.lfoOsc) {
      this.lfoOsc.frequency.exponentialRampToValueAtTime(
        peaceToLfoRate(peaceRatio),
        now + rampTime,
      );
    }
  }

  /** Fire-and-forget SFX for a simulation event. */
  playSfx(type: SfxType): void {
    if (!this.ctx || this._muted || !this.masterGain) return;

    const now = this.ctx.currentTime;

    switch (type) {
      case 'data_bomb':
        this.playDescendingSweep(now);
        break;
      case 'agent_death':
        this.playNoiseBurst(now);
        break;
      case 'conflict':
        this.playSquarePing(now);
        break;
      case 'meme_swap':
        this.playChime(now);
        break;
      case 'birth':
        this.playArpeggio(now);
        break;
    }
  }

  /** Toggle mute state. */
  setMuted(muted: boolean): void {
    this._muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(
        muted ? 0 : this._volume,
        this.ctx.currentTime + 0.1,
      );
    }
  }

  /** Set master volume [0, 1]. */
  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx && !this._muted) {
      this.masterGain.gain.linearRampToValueAtTime(this._volume, this.ctx.currentTime + 0.1);
    }
  }

  // ── SFX implementations ──────────────────────────────────────────────

  /** Data bomb: descending frequency sweep. */
  private playDescendingSweep(now: number): void {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.4);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  /** Agent death: quick noise-like burst using detuned square waves. */
  private playNoiseBurst(now: number): void {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(50, now + 0.15);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /** Conflict: distorted square wave ping. */
  private playSquarePing(now: number): void {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(440, now);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  /** Meme swap: ascending chime (sine). */
  private playChime(now: number): void {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  /** Birth: bright two-note arpeggio. */
  private playArpeggio(now: number): void {
    if (!this.ctx || !this.masterGain) return;

    const notes = [523, 659]; // C5, E5

    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = notes[i];

      const start = now + i * 0.1;
      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.2);
    }
  }
}
