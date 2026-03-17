/**
 * Physics Engine – spring-mass brownian drift with soft collision repulsion.
 *
 * Agents move organically via random brownian forces, are damped to prevent
 * runaway velocities, and softly repulse each other to avoid permanent overlaps.
 */

import type { Agent, SimulationConfig } from '../types';
import { DEFAULT_CONFIG } from '../types';

/** Physics tuning constants. */
const BROWNIAN_STRENGTH = 0.3;
const DAMPING = 0.92;
const REPULSION_STRENGTH = 0.5;
const REPULSION_RADIUS_MULTIPLIER = 3; // repulse within N × agent radius

/**
 * Advance the physics simulation by one tick.
 *
 * 1. Apply brownian (random) forces
 * 2. Apply soft collision repulsion between nearby agents
 * 3. Integrate velocity → position
 * 4. Clamp positions to grid bounds
 * 5. Apply velocity damping
 */
export function tickPhysics(
  agents: Agent[],
  dt: number = 1,
  config: SimulationConfig = DEFAULT_CONFIG,
): void {
  const repulsionDist = config.agentRadius * REPULSION_RADIUS_MULTIPLIER;

  // 1. Brownian forces
  for (const agent of agents) {
    if (agent.energy <= 0) continue; // dead agents don't move
    agent.velocity.x += (Math.random() - 0.5) * BROWNIAN_STRENGTH;
    agent.velocity.y += (Math.random() - 0.5) * BROWNIAN_STRENGTH;
  }

  // 2. Collision repulsion (O(n²) — acceptable for ≤500 agents)
  for (let i = 0; i < agents.length; i++) {
    if (agents[i].energy <= 0) continue;
    for (let j = i + 1; j < agents.length; j++) {
      if (agents[j].energy <= 0) continue;

      const dx = agents[j].position.x - agents[i].position.x;
      const dy = agents[j].position.y - agents[i].position.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < repulsionDist * repulsionDist && distSq > 0.001) {
        const dist = Math.sqrt(distSq);
        const overlap = repulsionDist - dist;
        const force = (overlap / repulsionDist) * REPULSION_STRENGTH;

        const nx = dx / dist;
        const ny = dy / dist;

        agents[i].velocity.x -= nx * force;
        agents[i].velocity.y -= ny * force;
        agents[j].velocity.x += nx * force;
        agents[j].velocity.y += ny * force;
      }
    }
  }

  // 3. Integrate + 4. Clamp + 5. Damp
  for (const agent of agents) {
    if (agent.energy <= 0) continue;

    agent.position.x += agent.velocity.x * dt;
    agent.position.y += agent.velocity.y * dt;

    // Clamp to grid bounds with bounce
    if (agent.position.x < agent.radius) {
      agent.position.x = agent.radius;
      agent.velocity.x *= -0.5;
    } else if (agent.position.x > config.gridWidth - agent.radius) {
      agent.position.x = config.gridWidth - agent.radius;
      agent.velocity.x *= -0.5;
    }

    if (agent.position.y < agent.radius) {
      agent.position.y = agent.radius;
      agent.velocity.y *= -0.5;
    } else if (agent.position.y > config.gridHeight - agent.radius) {
      agent.position.y = config.gridHeight - agent.radius;
      agent.velocity.y *= -0.5;
    }

    // Velocity damping
    agent.velocity.x *= DAMPING;
    agent.velocity.y *= DAMPING;
  }
}
