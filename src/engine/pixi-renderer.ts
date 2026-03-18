/**
 * PixiRenderer – Framework-agnostic PixiJS 8 renderer for the simulation grid.
 *
 * Owns the PixiJS Application, viewport container, agent sprite pool,
 * shockwave animations, wobble/glow effects, and death dissolve animations.
 * The Svelte component is a thin wrapper that syncs reactive state into this class.
 */

import {
  Application,
  Container,
  Graphics,
  type ColorSource,
} from 'pixi.js';
import type { Agent, Shockwave } from '../types';
import { FACTION_META } from './factions';

/** Duration of the death dissolve animation in renderer frames. Must match DEATH_ANIM_TICKS in simulation store. */
const DEATH_ANIM_FRAMES = 20;

/** Auto-incrementing ID for tracking unique shockwaves. */
let nextShockwaveId = 0;

/** Internal sprite node representing one agent on the stage. */
interface AgentNode {
  root: Container;
  glow: Graphics;
  body: Graphics;
  selectionRing: Graphics;
  highlightRing: Graphics;
  /** Cached agent color to avoid unnecessary redraws. */
  cachedColor: string;
  /** Cached faction for glow color. */
  cachedFaction: string;
}

/** Internal bookkeeping for an active shockwave animation. */
interface ShockwaveNode {
  id: number;
  graphic: Graphics;
  center: { x: number; y: number };
  maxRadius: number;
  frame: number;
  totalFrames: number;
  /** Hex color for the shockwave ring/fill. */
  color: number;
}

export class PixiRenderer {
  private app: Application | null = null;
  private viewport: Container = new Container();
  private agentNodes: Map<string, AgentNode> = new Map();
  private shockwaves: ShockwaveNode[] = [];
  private crosshair: Graphics = new Graphics();
  private crosshairVisible = false;

  /** Elapsed time counter for wobble oscillation. */
  private elapsedTime = 0;

  /** Camera state mirrored from the Svelte component. */
  private camera = { x: 0, y: 0, zoom: 8 };

  /** Grid dimensions for background rendering. */
  private gridWidth = 100;
  private gridHeight = 100;
  private sectorSize = 25;

  /** Background and grid lines graphics. */
  private background: Graphics = new Graphics();
  private sectorLines: Graphics = new Graphics();

  /**
   * Initialize the PixiJS Application and attach it to the given container element.
   * Uses WebGPU with WebGL2 fallback.
   */
  async init(container: HTMLElement, gridWidth: number, gridHeight: number, sectorSize: number): Promise<void> {
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.sectorSize = sectorSize;

    this.app = new Application();
    await this.app.init({
      preference: 'webgpu',
      background: 0x050508,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      resizeTo: container,
    });

    container.appendChild(this.app.canvas);

    // Build scene graph
    this.app.stage.addChild(this.viewport);

    // Draw static background into viewport
    this.drawBackground();

    // Crosshair lives in the stage (screen space), above everything
    this.crosshair.visible = false;
    this.app.stage.addChild(this.crosshair);

    // Start the render/animation ticker
    this.app.ticker.add((ticker) => {
      this.elapsedTime += ticker.deltaTime / 60; // convert to seconds
      this.tickAnimations();
    });
  }

  /** Resize the renderer to fit its container. */
  resize(width: number, height: number): void {
    if (!this.app) return;
    this.app.renderer.resize(width, height);
    this.drawCrosshair(width, height);
  }

  /** Update camera transform (called on pan/zoom from the Svelte component). */
  setCamera(x: number, y: number, zoom: number): void {
    this.camera = { x, y, zoom };
    this.viewport.position.set(x, y);
    this.viewport.scale.set(zoom, zoom);
  }

  /** Update grid config if it changes (e.g. on re-initialize). */
  setGridConfig(gridWidth: number, gridHeight: number, sectorSize: number): void {
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.sectorSize = sectorSize;
    this.drawBackground();
  }

  /**
   * Synchronize the visual sprite pool with the current agent array.
   * Creates new nodes, updates existing ones, and removes stale ones.
   */
  syncAgents(agents: Agent[]): void {
    const seenIds = new Set<string>();

    for (const agent of agents) {
      seenIds.add(agent.id);
      let node = this.agentNodes.get(agent.id);

      if (!node) {
        node = this.createAgentNode(agent);
        this.agentNodes.set(agent.id, node);
        this.viewport.addChild(node.root);
      }

      this.updateAgentNode(node, agent);
    }

    // Remove stale nodes (agents no longer in the array)
    for (const [id, node] of this.agentNodes) {
      if (!seenIds.has(id)) {
        this.viewport.removeChild(node.root);
        node.root.destroy({ children: true });
        this.agentNodes.delete(id);
      }
    }
  }

  /** Toggle the selection ring on a specific agent. */
  setSelectedAgent(id: string | null): void {
    for (const [agentId, node] of this.agentNodes) {
      node.selectionRing.visible = agentId === id;
    }
  }

  /** Toggle highlight rings on a set of agents. */
  setHighlightedAgents(ids: Set<string>): void {
    for (const [agentId, node] of this.agentNodes) {
      node.highlightRing.visible = ids.has(agentId);
    }
  }

  /** Spawn a shockwave animation at the given grid coordinates. Returns a unique ID. */
  addShockwave(
    center: { x: number; y: number },
    maxRadius: number,
    totalFrames: number,
    color: number = 0xef4444,
  ): number {
    const id = nextShockwaveId++;
    const graphic = new Graphics();
    this.viewport.addChild(graphic);
    this.shockwaves.push({ id, graphic, center, maxRadius, frame: 0, totalFrames, color });
    return id;
  }

  /**
   * Sync shockwaves from the store — add any new ones. Uses a tracking set
   * to avoid duplicating shockwaves across multiple reactive sync calls.
   */
  private trackedStoreShockwaveCount = 0;

  syncShockwaves(storeShockwaves: Shockwave[]): void {
    // Only process shockwaves beyond what we've already tracked
    for (let i = this.trackedStoreShockwaveCount; i < storeShockwaves.length; i++) {
      const sw = storeShockwaves[i];
      if (sw.frame <= 1) {
        this.addShockwave(sw.center, sw.maxRadius, sw.totalFrames, sw.color);
      }
    }
    this.trackedStoreShockwaveCount = storeShockwaves.length;
  }

  /** Toggle the crosshair overlay (target-pick mode). */
  setTargetPickMode(enabled: boolean): void {
    this.crosshairVisible = enabled;
    this.crosshair.visible = enabled;
    if (enabled && this.app) {
      this.drawCrosshair(this.app.screen.width, this.app.screen.height);
    }
  }

  /** Find the closest alive agent to a grid coordinate. Returns agent ID or null. */
  hitTest(gridX: number, gridY: number, agents: Agent[]): string | null {
    let closest: string | null = null;
    let closestDist = Infinity;

    for (const agent of agents) {
      // Skip dead agents and agents in death animation
      if (agent.energy <= 0 || agent.deathFrame !== null) continue;

      const dx = agent.position.x - gridX;
      const dy = agent.position.y - gridY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < agent.radius * 2 && dist < closestDist) {
        closest = agent.id;
        closestDist = dist;
      }
    }

    return closest;
  }

  /** Convert screen coordinates to grid coordinates using current camera. */
  screenToGrid(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.camera.x) / this.camera.zoom,
      y: (screenY - this.camera.y) / this.camera.zoom,
    };
  }

  /** Clean up all PixiJS resources. */
  destroy(): void {
    if (this.app) {
      this.app.destroy(true, { children: true });
      this.app = null;
    }
    this.agentNodes.clear();
    this.shockwaves = [];
  }

  // ── Private Helpers ──────────────────────────────────────────────────

  /** Draw the grid background and sector lines. Safe to call before or after init. */
  private drawBackground(): void {
    // Safely remove old graphics before rebuilding
    if (this.background.parent) {
      this.viewport.removeChild(this.background);
    }
    this.background.destroy();
    this.background = new Graphics();
    this.background.rect(0, 0, this.gridWidth, this.gridHeight).fill(0x0a0a0f);
    this.viewport.addChildAt(this.background, 0);

    if (this.sectorLines.parent) {
      this.viewport.removeChild(this.sectorLines);
    }
    this.sectorLines.destroy();
    this.sectorLines = new Graphics();

    const sectorStroke = { color: 0xffffff, alpha: 0.06, width: 0.1 };
    for (let x = 0; x <= this.gridWidth; x += this.sectorSize) {
      this.sectorLines.moveTo(x, 0).lineTo(x, this.gridHeight).stroke(sectorStroke);
    }
    for (let y = 0; y <= this.gridHeight; y += this.sectorSize) {
      this.sectorLines.moveTo(0, y).lineTo(this.gridWidth, y).stroke(sectorStroke);
    }

    this.viewport.addChildAt(this.sectorLines, 1);
  }

  /** Create a new agent node (sprite group) for the given agent. */
  private createAgentNode(agent: Agent): AgentNode {
    const root = new Container();

    // Glow halo — larger, semi-transparent circle behind the body
    const glow = new Graphics();
    this.drawGlow(glow, agent);

    // Body — main filled circle
    const body = new Graphics();
    this.drawBody(body, agent);

    // Selection ring — white stroke, hidden by default
    const selectionRing = new Graphics();
    selectionRing
      .circle(0, 0, agent.radius * 1.4)
      .stroke({ color: 0xffffff, width: 0.15 });
    selectionRing.visible = false;

    // Highlight ring — red stroke, hidden by default
    const highlightRing = new Graphics();
    highlightRing
      .circle(0, 0, agent.radius * 1.4)
      .stroke({ color: 0xef4444, width: 0.12 });
    highlightRing.visible = false;

    root.addChild(glow, body, selectionRing, highlightRing);

    return {
      root,
      glow,
      body,
      selectionRing,
      highlightRing,
      cachedColor: agent.color,
      cachedFaction: agent.faction,
    };
  }

  /** Update an existing agent node to match current agent state. */
  private updateAgentNode(node: AgentNode, agent: Agent): void {
    // Position
    node.root.position.set(agent.position.x, agent.position.y);

    // Redraw body if color changed
    if (node.cachedColor !== agent.color) {
      node.body.clear();
      this.drawBody(node.body, agent);
      node.cachedColor = agent.color;
    }

    // Redraw glow if faction changed
    if (node.cachedFaction !== agent.faction) {
      node.glow.clear();
      this.drawGlow(node.glow, agent);
      node.cachedFaction = agent.faction;
    }

    // Death dissolve animation
    if (agent.deathFrame !== null) {
      const progress = agent.deathFrame / DEATH_ANIM_FRAMES;
      const scale = 1 - progress * 0.6; // shrink to 40%
      const alpha = 1 - progress;
      const rotation = progress * 0.8; // slight spin

      node.root.scale.set(scale, scale);
      node.root.alpha = Math.max(0, alpha);
      node.root.rotation = rotation;
      return; // skip wobble for dying agents
    }

    // Wobble: scale oscillation driven by activityLevel
    const wobbleFreq = 3 + agent.activityLevel * 6; // idle=3Hz, thinking=9Hz
    const wobbleAmp = 0.03 + agent.activityLevel * 0.12; // idle=subtle, thinking=visible
    const scale = 1 + Math.sin(this.elapsedTime * wobbleFreq * Math.PI * 2) * wobbleAmp;
    node.root.scale.set(scale, scale);
    node.root.alpha = 1;
    node.root.rotation = 0;
  }

  /** Draw the glow halo graphic for an agent. */
  private drawGlow(glow: Graphics, agent: Agent): void {
    const factionMeta = FACTION_META[agent.faction];
    const glowColor = this.parseColor(factionMeta.glowColor);
    glow
      .circle(0, 0, agent.radius * 2.5)
      .fill({ color: glowColor, alpha: 0.25 });
  }

  /** Draw the body circle graphic for an agent. */
  private drawBody(body: Graphics, agent: Agent): void {
    const color = this.hslToHex(agent.color);
    body
      .circle(0, 0, agent.radius)
      .fill(color);
  }

  /** Draw the crosshair overlay in screen space. */
  private drawCrosshair(width: number, height: number): void {
    this.crosshair.clear();
    if (!this.crosshairVisible) return;

    const dashLen = 8;
    const gapLen = 6;

    // Vertical dashed line through center
    for (let y = 0; y < height; y += dashLen + gapLen) {
      this.crosshair
        .moveTo(width / 2, y)
        .lineTo(width / 2, Math.min(y + dashLen, height))
        .stroke({ color: 0xef4444, alpha: 0.5, width: 1 });
    }

    // Horizontal dashed line through center
    for (let x = 0; x < width; x += dashLen + gapLen) {
      this.crosshair
        .moveTo(x, height / 2)
        .lineTo(Math.min(x + dashLen, width), height / 2)
        .stroke({ color: 0xef4444, alpha: 0.5, width: 1 });
    }
  }

  /** Advance all per-frame animations (shockwaves only — wobble/glow handled in syncAgents). */
  private tickAnimations(): void {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.frame++;

      if (sw.frame >= sw.totalFrames) {
        this.viewport.removeChild(sw.graphic);
        sw.graphic.destroy();
        this.shockwaves.splice(i, 1);
        continue;
      }

      const progress = sw.frame / sw.totalFrames;
      const currentRadius = sw.maxRadius * progress;
      const alpha = (1 - progress) * 0.8;
      const lineWidth = 0.2 + (1 - progress) * 0.2;

      sw.graphic.clear();
      sw.graphic
        .circle(sw.center.x, sw.center.y, currentRadius)
        .stroke({ color: sw.color, alpha, width: lineWidth });

      // Inner fill that fades quickly
      if (progress < 0.3) {
        sw.graphic
          .circle(sw.center.x, sw.center.y, currentRadius)
          .fill({ color: sw.color, alpha: (0.3 - progress) * 0.15 });
      }
    }
  }

  /** Parse an rgba() or hex color string to a numeric hex value. */
  private parseColor(color: string): ColorSource {
    // Handle `rgba(r, g, b, a)` format
    const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbaMatch && rgbaMatch[1] && rgbaMatch[2] && rgbaMatch[3]) {
      const r = parseInt(rgbaMatch[1], 10);
      const g = parseInt(rgbaMatch[2], 10);
      const b = parseInt(rgbaMatch[3], 10);
      return (r << 16) | (g << 8) | b;
    }
    // Handle hex format
    if (color.startsWith('#') && color.length >= 4) {
      return parseInt(color.slice(1), 16);
    }
    return 0x666666; // fallback gray
  }

  /** Convert an HSL color string to hex number. */
  private hslToHex(hsl: string): number {
    const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!match) return 0x888888;

    const h = parseInt(match[1]) / 360;
    const s = parseInt(match[2]) / 100;
    const l = parseInt(match[3]) / 100;

    // HSL → RGB conversion
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    let r: number, g: number, b: number;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    const ri = Math.round(r * 255);
    const gi = Math.round(g * 255);
    const bi = Math.round(b * 255);
    return (ri << 16) | (gi << 8) | bi;
  }
}
