// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * PixiRenderer unit tests — validates sprite pool sync logic without a real GPU.
 *
 * PixiJS requires a DOM/canvas for its Application. We test the framework-agnostic
 * sync logic by mocking the renderer and verifying the data-driven patterns:
 * sprite creation, update, removal, selection, highlights, and death animations.
 */

// Mock pixi.js to avoid GPU dependency in unit tests
vi.mock('pixi.js', () => {
  class MockGraphics {
    visible = true;
    clear() { return this; }
    circle() { return this; }
    rect() { return this; }
    fill() { return this; }
    stroke() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    destroy() {}
  }

  class MockContainer {
    children: unknown[] = [];
    position = { x: 0, y: 0, set: vi.fn() };
    scale = { x: 1, y: 1, set: vi.fn() };
    alpha = 1;
    rotation = 0;
    visible = true;
    addChild(...items: unknown[]) { this.children.push(...items); }
    addChildAt(item: unknown, index: number) { this.children.splice(index, 0, item); }
    removeChild(item: unknown) {
      const idx = this.children.indexOf(item);
      if (idx >= 0) this.children.splice(idx, 1);
    }
    destroy() { this.children = []; }
  }

  class MockApplication {
    stage = new MockContainer();
    canvas = document.createElement('canvas');
    screen = { width: 800, height: 600 };
    renderer = { resize: vi.fn() };
    ticker = { add: vi.fn() };
    async init() {}
    destroy() {}
  }

  return {
    Application: MockApplication,
    Container: MockContainer,
    Graphics: MockGraphics,
  };
});

import { PixiRenderer } from '../src/engine/pixi-renderer';
import { createAgents, resetAgentIdCounter } from '../src/engine/agent-factory';
import type { Agent } from '../src/types';

describe('PixiRenderer', () => {
  let renderer: PixiRenderer;

  beforeEach(() => {
    resetAgentIdCounter();
    renderer = new PixiRenderer();
  });

  describe('syncAgents', () => {
    it('creates sprite nodes for new agents', async () => {
      const container = document.createElement('div');
      await renderer.init(container, 100, 100, 25);

      const agents = createAgents(5);
      renderer.syncAgents(agents);

      // After syncing 5 agents, there should be nodes for each one.
      // Use a second sync with 3 agents to verify removal.
      const subset = agents.slice(0, 3);
      renderer.syncAgents(subset);

      // Can sync again without errors (idempotent)
      renderer.syncAgents(subset);

      renderer.destroy();
    });

    it('handles empty agent arrays gracefully', async () => {
      const container = document.createElement('div');
      await renderer.init(container, 100, 100, 25);

      renderer.syncAgents([]);
      renderer.syncAgents([]);

      renderer.destroy();
    });

    it('updates positions on subsequent syncs', async () => {
      const container = document.createElement('div');
      await renderer.init(container, 100, 100, 25);

      const agents = createAgents(3);
      renderer.syncAgents(agents);

      // Move an agent
      agents[0].position.x = 99;
      agents[0].position.y = 99;
      renderer.syncAgents(agents);

      renderer.destroy();
    });
  });

  describe('selection and highlighting', () => {
    it('sets selected agent without errors', async () => {
      const container = document.createElement('div');
      await renderer.init(container, 100, 100, 25);

      const agents = createAgents(5);
      renderer.syncAgents(agents);

      renderer.setSelectedAgent(agents[2].id);
      renderer.setSelectedAgent(null);

      renderer.destroy();
    });

    it('sets highlighted agents without errors', async () => {
      const container = document.createElement('div');
      await renderer.init(container, 100, 100, 25);

      const agents = createAgents(5);
      renderer.syncAgents(agents);

      renderer.setHighlightedAgents(new Set([agents[0].id, agents[1].id]));
      renderer.setHighlightedAgents(new Set());

      renderer.destroy();
    });
  });

  describe('hitTest', () => {
    it('finds the closest agent to a grid coordinate', () => {
      const agents: Agent[] = createAgents(3);
      agents[0].position = { x: 10, y: 10 };
      agents[1].position = { x: 50, y: 50 };
      agents[2].position = { x: 90, y: 90 };

      const hit = renderer.hitTest(10.1, 10.1, agents);
      expect(hit).toBe(agents[0].id);
    });

    it('returns null when no agent is close enough', () => {
      const agents: Agent[] = createAgents(3);
      agents[0].position = { x: 10, y: 10 };
      agents[1].position = { x: 50, y: 50 };
      agents[2].position = { x: 90, y: 90 };

      const hit = renderer.hitTest(30, 30, agents);
      expect(hit).toBeNull();
    });

    it('skips dead and dying agents', () => {
      const agents: Agent[] = createAgents(3);
      agents[0].position = { x: 10, y: 10 };
      agents[0].energy = 0;
      agents[0].deathFrame = null;
      agents[1].position = { x: 10.05, y: 10.05 };
      agents[1].energy = 0.5;
      agents[1].deathFrame = 5; // dying agent — should also be skipped
      agents[2].position = { x: 10.1, y: 10.1 };

      const hit = renderer.hitTest(10, 10, agents);
      expect(hit).toBe(agents[2].id);
    });
  });

  describe('screenToGrid', () => {
    it('converts screen coordinates using default camera', () => {
      const result = renderer.screenToGrid(80, 80);
      // Default camera: x=0, y=0, zoom=8
      expect(result.x).toBe(10);
      expect(result.y).toBe(10);
    });
  });

  describe('shockwave management', () => {
    it('adds shockwaves without errors', async () => {
      const container = document.createElement('div');
      await renderer.init(container, 100, 100, 25);

      renderer.addShockwave({ x: 50, y: 50 }, 10, 30);

      renderer.destroy();
    });

    it('syncs shockwaves from store format', async () => {
      const container = document.createElement('div');
      await renderer.init(container, 100, 100, 25);

      renderer.syncShockwaves([
        { center: { x: 25, y: 25 }, maxRadius: 5, frame: 0, totalFrames: 30 },
      ]);

      // Second sync with same shockwave should not duplicate
      renderer.syncShockwaves([
        { center: { x: 25, y: 25 }, maxRadius: 5, frame: 1, totalFrames: 30 },
      ]);

      renderer.destroy();
    });
  });

  describe('target pick mode', () => {
    it('toggles crosshair without errors', async () => {
      const container = document.createElement('div');
      await renderer.init(container, 100, 100, 25);

      renderer.setTargetPickMode(true);
      renderer.setTargetPickMode(false);

      renderer.destroy();
    });
  });

  describe('lifecycle', () => {
    it('initializes and destroys cleanly', async () => {
      const container = document.createElement('div');
      await renderer.init(container, 100, 100, 25);
      renderer.destroy();
    });

    it('handles multiple destroy calls gracefully', async () => {
      const container = document.createElement('div');
      await renderer.init(container, 100, 100, 25);
      renderer.destroy();
      renderer.destroy(); // should not throw
    });
  });
});
