import { Application, Container, Graphics } from "pixi.js";
import type { TreeTraits, WorldConfig } from "@/lib/github/types";
import { SEASON_PALETTE } from "@/lib/world/seasons";
import { createRng } from "@/lib/world/rng";
import {
  DECOR_CATALOG,
  PlacedDecor,
  getDecorItem,
  loadCustomDecorSprites,
  loadPlacementsFromStorage,
  savePlacementsToStorage,
  type DecorHit,
  type DecorKind,
  type PlacedDecorData,
} from "./customDecor";
import { loadForestSprites, scatterForestProps, type ForestLamp } from "./decorSprites";
import { WORLD_SKY_RATIO, buildForestFloor } from "./mapDecor";
import { drawFireflies, drawTree } from "./trees";

export type TreeSelectHandler = (tree: TreeTraits | null) => void;
export type DecorSelectHandler = (
  info: { id: string; kind: DecorKind; scale: number } | null
) => void;

export class ForestApp {
  private app: Application;
  private world: Container;
  private groundLayer: Container;
  private treeLayer: Container;
  private fxLayer: Container;
  private weatherLayer: Container;
  private overlayLayer: Container;
  private lightLayer: Container;
  private config: WorldConfig;
  private onSelect: TreeSelectHandler;
  private onDecorSelect: DecorSelectHandler | null = null;
  private keys = new Set<string>();
  private camera = { x: 0, y: 0, zoom: 1 };
  private dragging = false;
  private dragLast = { x: 0, y: 0 };
  private time = 0;
  private dayPhase = 0.35;
  private destroyed = false;
  private ready = false;
  private initPromise: Promise<void> | null = null;
  private particles: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  private wildlife: { x: number; y: number; vx: number; type: "bird" | "bunny" }[] = [];
  private lamps: ForestLamp[] = [];
  private cleanupInput: (() => void) | null = null;

  private customizeMode = false;
  private decorBrush: DecorKind | null = null;
  private placements = new Map<string, PlacedDecor>();
  private selectedDecor: PlacedDecor | null = null;
  private decorDrag: "move" | "resize" | "rotate" | null = null;
  private resizeStartHeight = 0;
  private resizeStartDist = 1;
  private panCandidate = false;

  constructor(config: WorldConfig, onSelect: TreeSelectHandler) {
    this.app = new Application();
    this.world = new Container();
    this.groundLayer = new Container();
    this.treeLayer = new Container();
    this.fxLayer = new Container();
    this.weatherLayer = new Container();
    this.overlayLayer = new Container();
    this.lightLayer = new Container();
    this.config = config;
    this.onSelect = onSelect;
  }

  setDecorSelectHandler(handler: DecorSelectHandler | null): void {
    this.onDecorSelect = handler;
  }

  setCustomizeMode(on: boolean): void {
    this.customizeMode = on;
    if (!on) {
      this.decorBrush = null;
      this.selectDecor(null);
      if (this.ready) this.app.canvas.style.cursor = "default";
    } else {
      this.onSelect(null);
      if (this.ready) {
        this.app.canvas.style.cursor = this.decorBrush ? "crosshair" : "default";
      }
    }
  }

  setDecorBrush(kind: DecorKind | null): void {
    this.decorBrush = kind;
    if (kind) this.selectDecor(null);
    if (this.customizeMode && this.ready) {
      this.app.canvas.style.cursor = kind ? "crosshair" : "default";
    }
  }

  setSelectedDecorScale(scale: number): void {
    if (!this.selectedDecor) return;
    this.selectedDecor.setHeight(scale);
    this.persistPlacements();
    this.emitDecorSelect();
  }

  deleteSelectedDecor(): void {
    if (!this.selectedDecor) return;
    const id = this.selectedDecor.id;
    this.treeLayer.removeChild(this.selectedDecor.root);
    this.selectedDecor.root.destroy({ children: true });
    this.placements.delete(id);
    this.selectedDecor = null;
    this.persistPlacements();
    this.onDecorSelect?.(null);
  }

  clearAllCustomDecor(): void {
    for (const decor of this.placements.values()) {
      this.treeLayer.removeChild(decor.root);
      decor.root.destroy({ children: true });
    }
    this.placements.clear();
    this.selectedDecor = null;
    this.persistPlacements();
    this.onDecorSelect?.(null);
  }

  async init(canvasParent: HTMLElement): Promise<void> {
    this.initPromise = this.doInit(canvasParent);
    await this.initPromise;
  }

  private async doInit(canvasParent: HTMLElement): Promise<void> {
    if (this.destroyed) return;

    const palette = SEASON_PALETTE[this.config.season];
    await this.app.init({
      resizeTo: canvasParent,
      background: palette.grass,
      antialias: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });

    if (this.destroyed) {
      this.safeDestroyApp(true);
      return;
    }

    canvasParent.appendChild(this.app.canvas);
    this.app.canvas.style.display = "block";
    this.app.canvas.style.width = "100%";
    this.app.canvas.style.height = "100%";
    this.app.canvas.style.imageRendering = "pixelated";

    this.world.addChild(this.groundLayer);
    this.world.addChild(this.treeLayer);
    this.world.addChild(this.fxLayer);
    this.world.addChild(this.weatherLayer);
    this.app.stage.addChild(this.world);
    this.app.stage.addChild(this.overlayLayer);
    this.app.stage.addChild(this.lightLayer);

    try {
      await loadForestSprites();
      await loadCustomDecorSprites();
    } catch (err) {
      console.warn("Forest decor sprites failed to load", err);
    }

    if (this.destroyed) {
      this.safeDestroyApp(true);
      return;
    }

    this.buildGround();
    this.buildTrees();
    this.restoreCustomDecor();

    if (!this.destroyed) {
      try {
        const horizon = this.config.worldHeight * WORLD_SKY_RATIO;
        const rng = createRng(this.config.seed ^ 0xdec0);
        const points = this.config.trees.map((t) => ({ x: t.x, y: t.y }));
        const { lamps } = scatterForestProps(
          this.treeLayer,
          this.config.worldWidth,
          this.config.worldHeight,
          horizon,
          rng,
          points
        );
        this.lamps = lamps;
      } catch (err) {
        console.warn("Forest decor scatter failed", err);
      }
    }

    if (this.destroyed) {
      this.safeDestroyApp(true);
      return;
    }

    this.seedWildlife();
    this.camera.zoom = this.fitZoom();
    this.centerCamera();
    this.bindInput();

    this.app.ticker.add((ticker) => this.update(ticker.deltaMS));
    this.ready = true;
  }

  private restoreCustomDecor(): void {
    const saved = loadPlacementsFromStorage(this.config.username);
    for (const data of saved) {
      this.addDecorFromData(data);
    }
    this.treeLayer.sortChildren();
  }

  private addDecorFromData(data: PlacedDecorData): PlacedDecor | null {
    if (!DECOR_CATALOG.some((d) => d.id === data.kind)) return null;
    const decor = new PlacedDecor(
      data.kind,
      data.x,
      data.y,
      data.height,
      data.rotation ?? 0,
      data.id
    );
    decor.root.on("pointertap", (e) => {
      if (!this.customizeMode) return;
      e.stopPropagation();
      this.selectDecor(decor);
    });
    this.treeLayer.addChild(decor.root);
    this.placements.set(decor.id, decor);
    return decor;
  }

  private placeDecorAt(worldX: number, worldY: number): void {
    if (!this.decorBrush) return;
    const item = getDecorItem(this.decorBrush);
    const x = clamp(worldX, 8, this.config.worldWidth - 8);
    const y = clamp(worldY, 8, this.config.worldHeight - 8);
    const decor = new PlacedDecor(this.decorBrush, x, y, item.defaultH, 0);
    decor.root.on("pointertap", (e) => {
      if (!this.customizeMode) return;
      e.stopPropagation();
      this.selectDecor(decor);
    });
    this.treeLayer.addChild(decor.root);
    this.placements.set(decor.id, decor);
    this.treeLayer.sortChildren();
    this.selectDecor(decor);
    this.persistPlacements();
  }

  private selectDecor(decor: PlacedDecor | null): void {
    if (this.selectedDecor) this.selectedDecor.setSelected(false);
    this.selectedDecor = decor;
    if (decor) {
      decor.setSelected(true);
      this.decorBrush = null;
      if (this.ready) this.app.canvas.style.cursor = "default";
    }
    this.emitDecorSelect();
  }

  private emitDecorSelect(): void {
    if (!this.selectedDecor) {
      this.onDecorSelect?.(null);
      return;
    }
    this.onDecorSelect?.({
      id: this.selectedDecor.id,
      kind: this.selectedDecor.kind,
      scale: this.selectedDecor.height,
    });
  }

  private persistPlacements(): void {
    const items = [...this.placements.values()].map((d) => d.toData());
    savePlacementsToStorage(this.config.username, items);
  }

  private screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const bounds = this.app.canvas.getBoundingClientRect();
    const sx = clientX - bounds.left;
    const sy = clientY - bounds.top;
    return {
      x: this.camera.x + sx / this.camera.zoom,
      y: this.camera.y + sy / this.camera.zoom,
    };
  }

  private hitDecorAt(worldX: number, worldY: number): { decor: PlacedDecor; hit: DecorHit } | null {
    if (this.selectedDecor) {
      const hit = this.selectedDecor.hitTest(worldX, worldY);
      if (hit) return { decor: this.selectedDecor, hit };
    }
    const list = [...this.placements.values()].sort((a, b) => b.y - a.y);
    for (const decor of list) {
      if (decor === this.selectedDecor) continue;
      const hit = decor.hitTest(worldX, worldY);
      if (hit) return { decor, hit };
    }
    return null;
  }

  private minZoom(): number {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    if (w <= 0 || h <= 0) return 1;
    return Math.max(w / this.config.worldWidth, h / this.config.worldHeight);
  }

  private maxZoom(): number {
    return Math.max(this.minZoom() * 3.2, 2.4);
  }

  private fitZoom(): number {
    return this.minZoom() * 1.1;
  }

  private centerCamera(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    this.camera.zoom = clamp(this.camera.zoom, this.minZoom(), this.maxZoom());
    this.camera.x = this.config.worldWidth / 2 - w / 2 / this.camera.zoom;
    this.camera.y = this.config.worldHeight / 2 - h / 2 / this.camera.zoom;
    this.applyCamera();
  }

  private buildGround(): void {
    const { worldWidth, worldHeight, season, seed } = this.config;
    const rng = createRng(seed ^ 0xabcd);
    const floor = buildForestFloor(worldWidth, worldHeight, season, rng);
    this.groundLayer.addChild(floor);
  }

  private buildTrees(): void {
    this.treeLayer.sortableChildren = true;
    for (const tree of this.config.trees) {
      const sprite = drawTree(tree, this.config.season);
      sprite.zIndex = tree.y;
      sprite.on("pointertap", (e) => {
        if (this.customizeMode) return;
        e.stopPropagation();
        this.onSelect(tree);
      });
      this.treeLayer.addChild(sprite);
    }
    this.treeLayer.sortChildren();

    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on("pointertap", () => {
      if (this.customizeMode) return;
      this.onSelect(null);
    });
  }

  private seedWildlife(): void {
    const rng = createRng(this.config.seed ^ 0x2222);
    const count = Math.min(12, 3 + Math.floor(this.config.trees.length / 8));
    for (let i = 0; i < count; i++) {
      this.wildlife.push({
        x: rng.float(40, this.config.worldWidth - 40),
        y: rng.float(this.config.worldHeight * 0.2, this.config.worldHeight - 40),
        vx: rng.float(-0.4, 0.4),
        type: rng.chance(0.6) ? "bird" : "bunny",
      });
    }
  }

  private applyCamera(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    this.camera.zoom = clamp(this.camera.zoom, this.minZoom(), this.maxZoom());
    const maxX = Math.max(0, this.config.worldWidth - w / this.camera.zoom);
    const maxY = Math.max(0, this.config.worldHeight - h / this.camera.zoom);
    this.camera.x = clamp(this.camera.x, 0, maxX);
    this.camera.y = clamp(this.camera.y, 0, maxY);
    this.world.scale.set(this.camera.zoom);
    this.world.position.set(-this.camera.x * this.camera.zoom, -this.camera.y * this.camera.zoom);
  }

  private bindInput(): void {
    const canvas = this.app.canvas;

    const onKeyDown = (e: KeyboardEvent) => {
      this.keys.add(e.key.toLowerCase());
      if (e.key === "=" || e.key === "+") this.zoomBy(0.1);
      if (e.key === "-" || e.key === "_") this.zoomBy(-0.1);
      // Tilt selected prop in small steps
      if (this.customizeMode && this.selectedDecor) {
        if (e.key === "[" || e.key === "ArrowLeft" && e.altKey) {
          e.preventDefault();
          this.selectedDecor.setRotation(this.selectedDecor.rotation - Math.PI / 36);
          this.persistPlacements();
        }
        if (e.key === "]" || e.key === "ArrowRight" && e.altKey) {
          e.preventDefault();
          this.selectedDecor.setRotation(this.selectedDecor.rotation + Math.PI / 36);
          this.persistPlacements();
        }
      }
      if (this.customizeMode && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        this.deleteSelectedDecor();
      }
      if (e.key === "Escape" && this.customizeMode) {
        if (this.selectedDecor) this.selectDecor(null);
        else this.decorBrush = null;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.zoomBy(e.deltaY > 0 ? -0.08 : 0.08);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const onPointerDown = (e: PointerEvent) => {
      this.dragLast = { x: e.clientX, y: e.clientY };
      this.decorDrag = null;
      this.panCandidate = false;

      if (this.customizeMode) {
        const world = this.screenToWorld(e.clientX, e.clientY);
        const found = this.hitDecorAt(world.x, world.y);
        if (found) {
          this.selectDecor(found.decor);
          if (found.hit === "rotate") {
            this.decorDrag = "rotate";
          } else if (
            found.hit === "tl" ||
            found.hit === "tr" ||
            found.hit === "bl" ||
            found.hit === "br"
          ) {
            this.decorDrag = "resize";
            this.resizeStartHeight = found.decor.height;
            const dist = Math.hypot(world.x - found.decor.x, world.y - found.decor.y);
            this.resizeStartDist = Math.max(8, dist);
          } else {
            this.decorDrag = "move";
          }
          return;
        }
        if (this.decorBrush) {
          this.placeDecorAt(world.x, world.y);
          return;
        }
        this.selectDecor(null);
        this.panCandidate = true;
        this.dragging = true;
        return;
      }

      this.dragging = true;
    };

    const onPointerUp = () => {
      if (this.decorDrag) {
        this.persistPlacements();
        this.treeLayer.sortChildren();
      }
      this.dragging = false;
      this.decorDrag = null;
      this.panCandidate = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      const dx = e.clientX - this.dragLast.x;
      const dy = e.clientY - this.dragLast.y;
      const world = this.screenToWorld(e.clientX, e.clientY);

      if (this.decorDrag && this.selectedDecor) {
        const decor = this.selectedDecor;
        if (this.decorDrag === "move") {
          decor.setPosition(
            clamp(world.x, 8, this.config.worldWidth - 8),
            clamp(world.y, 8, this.config.worldHeight - 8)
          );
        } else if (this.decorDrag === "resize") {
          const dist = Math.hypot(world.x - decor.x, world.y - decor.y);
          const next = this.resizeStartHeight * (dist / this.resizeStartDist);
          decor.setHeight(next);
          this.emitDecorSelect();
        } else if (this.decorDrag === "rotate") {
          decor.setRotation(Math.atan2(world.y - decor.y, world.x - decor.x) + Math.PI / 2);
        }
        this.dragLast = { x: e.clientX, y: e.clientY };
        return;
      }

      if (!this.dragging && !this.panCandidate) return;
      this.dragLast = { x: e.clientX, y: e.clientY };
      this.camera.x -= dx / this.camera.zoom;
      this.camera.y -= dy / this.camera.zoom;
      this.applyCamera();
    };

    let lastW = this.app.screen.width;
    let lastH = this.app.screen.height;
    const onResizeTick = () => {
      if (this.destroyed) return;
      const w = this.app.screen.width;
      const h = this.app.screen.height;
      if (w !== lastW || h !== lastH) {
        lastW = w;
        lastH = h;
        this.applyCamera();
      }
    };
    this.app.ticker.add(onResizeTick);

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointermove", onPointerMove);

    this.cleanupInput = () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
      this.app.ticker.remove(onResizeTick);
    };
  }

  private zoomBy(delta: number): void {
    const prev = this.camera.zoom;
    this.camera.zoom = clamp(prev + delta, this.minZoom(), this.maxZoom());
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const cx = this.camera.x + w / 2 / prev;
    const cy = this.camera.y + h / 2 / prev;
    this.camera.x = cx - w / 2 / this.camera.zoom;
    this.camera.y = cy - h / 2 / this.camera.zoom;
    this.applyCamera();
  }

  private update(deltaMS: number): void {
    if (this.destroyed) return;
    this.time += deltaMS;
    this.dayPhase = (this.dayPhase + deltaMS * 0.000008) % 1;

    const speed = 3.2 / this.camera.zoom;
    if (this.keys.has("w") || this.keys.has("arrowup")) this.camera.y -= speed;
    if (this.keys.has("s") || this.keys.has("arrowdown")) this.camera.y += speed;
    if (this.keys.has("a") || this.keys.has("arrowleft")) this.camera.x -= speed;
    if (this.keys.has("d") || this.keys.has("arrowright")) this.camera.x += speed;
    this.applyCamera();

    this.updateFx();
    this.updateWeather();
    this.updateDayNight();
    this.updateWildlife(deltaMS);
  }

  private updateFx(): void {
    this.clearLayer(this.fxLayer);
    const nightness = dayNightFactor(this.dayPhase);
    if (nightness > 0.35) {
      for (const tree of this.config.trees) {
        drawFireflies(tree, this.fxLayer, this.time);
      }
    }
  }

  private updateWeather(): void {
    this.clearLayer(this.weatherLayer);
    const g = new Graphics();
    const { weather, worldWidth, worldHeight } = this.config;

    if (weather === "rain") {
      g.rect(-50, 0, worldWidth + 100, worldHeight);
      g.fill({ color: 0x4a6a82, alpha: 0.1 });
    } else if (weather === "snow") {
      g.rect(-50, 0, worldWidth + 100, worldHeight);
      g.fill({ color: 0xb8c8d8, alpha: 0.08 });
    } else if (weather === "fog") {
      g.rect(-50, 0, worldWidth + 100, worldHeight);
      g.fill({ color: 0xc8d4dc, alpha: 0.18 });
    } else if (weather === "cloudy") {
      g.rect(-50, 0, worldWidth + 100, worldHeight);
      g.fill({ color: 0xa8b4c0, alpha: 0.1 });
    }

    if (weather === "rain" || weather === "snow") {
      const target = weather === "rain" ? 80 : 70;
      while (this.particles.length < target) {
        this.particles.push({
          x: Math.random() * worldWidth,
          y: Math.random() * worldHeight,
          vx: weather === "snow" ? (Math.random() - 0.5) * 0.35 : 0.45,
          vy: weather === "snow" ? 0.5 + Math.random() * 0.45 : 2.8 + Math.random() * 2.2,
          life: 1,
        });
      }
      if (this.particles.length > target) this.particles.length = target;

      if (weather === "rain") {
        for (const p of this.particles) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.y > worldHeight) {
            p.y = -4;
            p.x = Math.random() * worldWidth;
          }
          g.moveTo(p.x, p.y);
          g.lineTo(p.x + p.vx * 1.5, p.y + 7);
        }
        g.stroke({ width: 1, color: 0xd0e4f5, alpha: 0.55 });
      } else {
        for (const p of this.particles) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.y > worldHeight) {
            p.y = -2;
            p.x = Math.random() * worldWidth;
          }
          g.moveTo(p.x - 1.5, p.y);
          g.lineTo(p.x + 1.5, p.y);
          g.moveTo(p.x, p.y - 1.5);
          g.lineTo(p.x, p.y + 1.5);
        }
        g.stroke({ width: 1, color: 0xffffff, alpha: 0.8 });
      }
    } else {
      this.particles.length = 0;
    }

    this.weatherLayer.addChild(g);
  }

  private updateDayNight(): void {
    this.clearLayer(this.overlayLayer);
    this.clearLayer(this.lightLayer);

    const night = dayNightFactor(this.dayPhase);
    for (const lamp of this.lamps) lamp.setNightFactor(night);

    if (night > 0.02) {
      const g = new Graphics();
      g.rect(0, 0, this.app.screen.width, this.app.screen.height);
      g.fill({ color: 0x0a1628, alpha: night * 0.5 });
      this.overlayLayer.addChild(g);
    }

    const bloom = new Graphics();
    let anyLit = false;
    for (const lamp of this.lamps) {
      if (!lamp.lit) continue;
      anyLit = true;
      const sx = (lamp.bulbX - this.camera.x) * this.camera.zoom;
      const sy = (lamp.bulbY - this.camera.y) * this.camera.zoom;
      const strength = 0.35 + night * 0.65;
      const r = (36 + night * 40) * this.camera.zoom;
      bloom.circle(sx, sy, r * 1.6);
      bloom.fill({ color: 0xffb84a, alpha: 0.1 * strength });
      bloom.circle(sx, sy, r);
      bloom.fill({ color: 0xffd56a, alpha: 0.18 * strength });
      bloom.circle(sx, sy, r * 0.45);
      bloom.fill({ color: 0xfff1b0, alpha: 0.32 * strength });
    }
    if (anyLit) this.lightLayer.addChild(bloom);
  }

  private updateWildlife(deltaMS: number): void {
    const g = new Graphics();
    for (const w of this.wildlife) {
      w.x += w.vx * (deltaMS / 16);
      if (w.x < 20 || w.x > this.config.worldWidth - 20) w.vx *= -1;
      if (w.type === "bird") {
        const flap = Math.sin(this.time * 0.02 + w.x) * 3;
        g.ellipse(w.x, w.y + flap, 5, 2);
        g.fill(0x374151);
        g.moveTo(w.x - 6, w.y + flap);
        g.lineTo(w.x, w.y + flap - 4);
        g.lineTo(w.x + 6, w.y + flap);
        g.stroke({ width: 1.5, color: 0x374151 });
      } else {
        g.ellipse(w.x, w.y, 6, 4);
        g.fill(0xe8dcc8);
        g.circle(w.x + 5, w.y - 3, 3);
        g.fill(0xe8dcc8);
      }
    }
    this.fxLayer.addChild(g);
  }

  private clearLayer(layer: Container): void {
    for (const child of layer.removeChildren()) {
      child.destroy();
    }
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cleanupInput?.();
    this.cleanupInput = null;

    if (this.initPromise) {
      await this.initPromise.catch(() => undefined);
    }

    this.safeDestroyApp();
    this.ready = false;
  }

  private safeDestroyApp(force = false): void {
    try {
      if (force || this.ready) {
        this.app.destroy({ removeView: true }, { children: true });
      }
    } catch {
      // ignore teardown races under React Strict Mode
    }
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function dayNightFactor(phase: number): number {
  if (phase > 0.3 && phase < 0.55) return 0;
  if (phase >= 0.55 && phase < 0.7) return (phase - 0.55) / 0.15;
  if (phase >= 0.7 || phase < 0.15) return 1;
  if (phase >= 0.15 && phase < 0.3) return 1 - (phase - 0.15) / 0.15;
  return 0;
}
