/**
 * Newsfeed Store – Svelte 5 reactive ring-buffer for simulation events.
 *
 * Capped at MAX_EVENTS entries. Newest events are prepended.
 */

import type { SimulationEvent } from '../../types/hud';

/** Maximum events retained in the feed. */
const MAX_EVENTS = 200;

let nextEventId = 0;

/** Event payload without auto-generated fields. */
type NewEventPayload = {
  [K in SimulationEvent['type']]: Omit<Extract<SimulationEvent, { type: K }>, 'id' | 'timestamp'>;
}[SimulationEvent['type']];

class NewsfeedState {
  events: SimulationEvent[] = $state([]);

  /** Push a new event to the feed (newest first). Trims oldest if over cap. */
  push(payload: NewEventPayload): void {
    const full = {
      ...payload,
      id: `evt-${nextEventId++}`,
      timestamp: Date.now(),
    } as SimulationEvent;

    this.events = [full, ...this.events].slice(0, MAX_EVENTS);
  }

  /** Clear all events. */
  clear(): void {
    this.events = [];
    nextEventId = 0;
  }
}

export const newsfeed = new NewsfeedState();
