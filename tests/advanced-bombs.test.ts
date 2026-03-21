import { describe, it, expect, beforeEach } from 'vitest';
import { detonateDataBomb } from '../src/engine/blast-radius';
import { createAgent, resetAgentIdCounter } from '../src/engine/agent-factory';
import type { DataBomb, Shockwave } from '../src/types';

describe('Advanced Data Bombs', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  describe('Manifesto bomb — 2× mutation delta', () => {
    it('applies stronger mutation with a custom delta', () => {
      const agents = [createAgent(50, 50)];
      // Set known midpoint to avoid clamping near boundaries
      agents[0].vector.order_chaos = 0.5;

      const bomb: DataBomb = {
        text: 'Order, law, structure, discipline, rules, control, system',
        target: { x: 50, y: 50 },
        radius: 5,
        type: 'manifesto',
      };

      // Standard delta = 0.05, manifesto delta = 0.10 (2×)
      detonateDataBomb(agents, bomb, 0.1);

      // With delta=0.10 and 7 order keywords, the shift = 7 × 0.10 = 0.70
      // Starting from 0.5, shifted toward 0: 0.5 - 0.70 = -0.20, clamped to 0 → shift = 0.5
      const shift = Math.abs(agents[0].vector.order_chaos - 0.5);
      expect(shift).toBeGreaterThan(0.3);
    });

    it('manifesto mutation is strictly stronger than standard for the same text', () => {
      // Standard bomb — pin starting DNA to midpoint for deterministic comparison
      const standardAgent = createAgent(50, 50);
      standardAgent.vector.order_chaos = 0.5;
      const standardBomb: DataBomb = {
        text: 'chaos freedom anarchy rebellion revolution',
        target: { x: 50, y: 50 },
        radius: 5,
        type: 'standard',
      };
      detonateDataBomb([standardAgent], standardBomb);
      const standardShift = Math.abs(standardAgent.vector.order_chaos - 0.5);

      // Manifesto bomb with 2× delta — same starting DNA
      resetAgentIdCounter();
      const manifestoAgent = createAgent(50, 50);
      manifestoAgent.vector.order_chaos = 0.5;
      const manifestoBomb: DataBomb = {
        text: 'chaos freedom anarchy rebellion revolution',
        target: { x: 50, y: 50 },
        radius: 5,
        type: 'manifesto',
      };
      detonateDataBomb([manifestoAgent], manifestoBomb, 0.1);
      const manifestoShift = Math.abs(manifestoAgent.vector.order_chaos - 0.5);

      expect(manifestoShift).toBeGreaterThan(standardShift);
    });
  });

  describe('PDF/URL bomb types use standard mutation', () => {
    it('pdf bomb type detonates with standard mutation', () => {
      const agents = [createAgent(50, 50)];

      const bomb: DataBomb = {
        text: 'freedom chaos revolution anarchy',
        target: { x: 50, y: 50 },
        radius: 5,
        type: 'pdf',
      };

      const originalOC = agents[0].vector.order_chaos;
      const affectedIds = detonateDataBomb(agents, bomb);

      expect(affectedIds).toHaveLength(1);
      expect(agents[0].vector.order_chaos).not.toBe(originalOC);
    });

    it('url bomb type detonates with standard mutation', () => {
      const agents = [createAgent(50, 50)];

      const bomb: DataBomb = {
        text: 'logic reason data evidence science',
        target: { x: 50, y: 50 },
        radius: 5,
        type: 'url',
      };

      const originalAE = agents[0].vector.analytical_emotional;
      const affectedIds = detonateDataBomb(agents, bomb);

      expect(affectedIds).toHaveLength(1);
      expect(agents[0].vector.analytical_emotional).not.toBe(originalAE);
    });
  });

  describe('Shockwave color support', () => {
    it('Shockwave interface accepts optional color field', () => {
      const shockwave: Shockwave = {
        center: { x: 50, y: 50 },
        maxRadius: 10,
        frame: 0,
        totalFrames: 30,
        color: 0xff2222,
      };

      expect(shockwave.color).toBe(0xff2222);
    });

    it('Shockwave without color defaults gracefully', () => {
      const shockwave: Shockwave = {
        center: { x: 50, y: 50 },
        maxRadius: 10,
        frame: 0,
        totalFrames: 30,
      };

      expect(shockwave.color).toBeUndefined();
    });
  });

  describe('Blast radius with custom delta', () => {
    it('passes delta through to mutation', () => {
      const agents = [createAgent(50, 50), createAgent(50, 51)];

      // Set known midpoint values to avoid clamping near boundaries
      agents[0].vector.altruistic_selfish = 0.5;
      agents[1].vector.altruistic_selfish = 0.5;

      const bomb: DataBomb = {
        text: 'share help community together give cooperate',
        target: { x: 50, y: 50 },
        radius: 5,
        type: 'standard',
      };

      // Use a large delta so the mutation is clearly visible
      // 6 altruism keywords × 0.20 = -1.2, clamped from 0.5 → 0.0 = shift of 0.5
      detonateDataBomb(agents, bomb, 0.2);

      const shift0 = Math.abs(agents[0].vector.altruistic_selfish - 0.5);
      const shift1 = Math.abs(agents[1].vector.altruistic_selfish - 0.5);

      expect(shift0).toBeGreaterThan(0.3);
      expect(shift1).toBeGreaterThan(0.3);
    });
  });
});
