/**
 * Audio Store – Svelte 5 reactive state wrapping the VibeScoreEngine.
 *
 * Manages mute/volume state and bridges the simulation tick loop
 * to the generative audio engine. Audio requires a user gesture
 * to initialize (browser policy), so the first interaction triggers init.
 */

import { VibeScoreEngine, type SfxType } from '../../engine/vibe-score';

class AudioState {
  muted: boolean = $state(true);
  volume: number = $state(0.3);
  isInitialized: boolean = $state(false);

  private engine: VibeScoreEngine = new VibeScoreEngine();

  /** Initialize audio on first user interaction. Browser requires a gesture. */
  initialize(): void {
    if (this.isInitialized) return;
    this.engine.init();
    this.isInitialized = true;
    // Start unmuted after first explicit init
    this.muted = false;
    this.engine.setMuted(false);
    this.engine.setVolume(this.volume);
  }

  /** Toggle mute. If not yet initialized, initializes first. */
  toggleMute(): void {
    if (!this.isInitialized) {
      this.initialize();
      return;
    }
    this.muted = !this.muted;
    this.engine.setMuted(this.muted);
  }

  /** Set volume [0, 1]. */
  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.engine.setVolume(this.volume);
  }

  /** Called from the simulation tick loop to update ambient parameters. */
  updateFromSimulation(
    peaceRatio: number,
    factionCounts: Record<string, number>,
    totalAlive: number,
  ): void {
    if (!this.isInitialized) return;
    this.engine.updateAmbient(peaceRatio, factionCounts, totalAlive);
  }

  /** Fire a one-shot SFX for a simulation event. */
  playSfx(type: SfxType): void {
    if (!this.isInitialized) return;
    this.engine.playSfx(type);
  }

  /** Clean up on app teardown. */
  destroy(): void {
    this.engine.destroy();
    this.isInitialized = false;
  }
}

export const audio = new AudioState();
