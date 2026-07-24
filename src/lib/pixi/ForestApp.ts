import { Application, Container, Graphics } from "pixi.js";
import type { Season, TreeTraits, Weather, WorldConfig } from "@/lib/github/types";
import { SEASON_PALETTE } from "@/lib/world/seasons";
import { createRng } from "@/lib/world/rng";
import { saveTreePositions } from "@/lib/world/treePositions";
import {
  loadLayoutSpread,
  loadZoomRatio,
  saveLayoutSpread,
  saveZoomRatio,
  MAX_SPREAD,
  MIN_SPREAD,
} from "@/lib/world/viewState";
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
import { loadWoodPanel } from "./treeSign";
import { WORLD_SKY_RATIO, buildForestFloor } from "./mapDecor";
import { drawAmbientFireflies, drawTree } from "./trees";

export type TreeSelectHandler = (tree: TreeTraits | null) => void;
export type DecorSelectHandler = (
  info: { id: string; kind: DecorKind; scale: number } | null
) => void;
export type SpreadChangeHandler = (spread: number) => void;

export class ForestApp {
  private app: Application;
  private world: Container;
  private groundLayer: Container;
  private treeLayer: Container;
  private signLayer: Container;
  private fxLayer: Container;
  private weatherLayer: Container;
  private overlayLayer: Container;
  private lightLayer: Container;
  private config: WorldConfig;
  private onSelect: TreeSelectHandler;
  private onDecorSelect: DecorSelectHandler | null = null;
  private onSpreadChange: SpreadChangeHandler | null = null;
  private keys = new Set<string>();
  private camera = { x: 0, y: 0, zoom: 1 };
  private dragging = false;
  private dragLast = { x: 0, y: 0 };
  private time = 0;
  private dayPhase = 0.35;
  private destroyed = false;
  private ready = false;
  private initPromise: Promise<void> | null = null;
  /** Meadow size + tree layout before user spread-zoom (grassy expand). */
  private baseWorldW = 0;
  private baseWorldH = 0;
  private baseTreePos = new Map<number, { x: number; y: number }>();
  /** 1 = default density; higher = bigger grassy meadow with trees spread out. */
  private layoutSpread = MIN_SPREAD;
  private particles: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  private butterflies: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: number;
    phase: number;
  }[] = [];
  private lamps: ForestLamp[] = [];
  private cleanupInput: (() => void) | null = null;
  private selectedTreeId: number | null = null;
  private treeNodes = new Map<number, Container>();
  private treeSigns = new Map<
    number,
    { sign: Container; ox: number; oy: number; treeX: number; treeY: number }
  >();

  private customizeMode = false;
  private decorBrush: DecorKind | null = null;
  private placements = new Map<string, PlacedDecor>();
  private selectedDecor: PlacedDecor | null = null;
  private decorDrag: "move" | "resize" | "rotate" | null = null;
  private resizeStartHeight = 0;
  private resizeStartDist = 1;
  private panCandidate = false;
  private treeDragId: number | null = null;
  private treeDragMoved = false;

  constructor(config: WorldConfig, onSelect: TreeSelectHandler) {
    this.app = new Application();
    this.world = new Container();
    this.groundLayer = new Container();
    this.treeLayer = new Container();
    this.signLayer = new Container();
    this.fxLayer = new Container();
    this.weatherLayer = new Container();
    this.overlayLayer = new Container();
    this.lightLayer = new Container();
    // FX / overlays must never steal clicks from trees & lamps
    this.fxLayer.eventMode = "none";
    this.weatherLayer.eventMode = "none";
    this.overlayLayer.eventMode = "none";
    this.lightLayer.eventMode = "none";
    this.groundLayer.eventMode = "none";
    this.fxLayer.interactiveChildren = false;
    this.weatherLayer.interactiveChildren = false;
    this.overlayLayer.interactiveChildren = false;
    this.lightLayer.interactiveChildren = false;
    this.groundLayer.interactiveChildren = false;
    this.config = config;
    this.onSelect = onSelect;
  }

  setDecorSelectHandler(handler: DecorSelectHandler | null): void {
    this.onDecorSelect = handler;
  }

  setSpreadChangeHandler(handler: SpreadChangeHandler | null): void {
    this.onSpreadChange = handler;
  }

  setCustomizeMode(on: boolean): void {
    this.customizeMode = on;
    if (!on) {
      this.decorBrush = null;
      this.selectDecor(null);
      if (this.ready) this.app.canvas.style.cursor = "default";
    } else {
      this.selectTreeNode(null);
      if (this.ready) {
        this.app.canvas.style.cursor = this.decorBrush ? "crosshair" : "default";
      }
    }
  }

  /** Called when UI (repo popup) clears the selection. */
  clearTreeSelection(): void {
    this.selectTreeNode(null);
  }

  getLayoutSpread(): number {
    return this.layoutSpread;
  }

  /** UI scale bar — expands grassy meadow and spreads trees (persists across seasons). */
  setLayoutSpreadFromUi(spread: number): void {
    if (!this.ready || this.destroyed || this.baseWorldW <= 0) return;
    const next = clamp(spread, MIN_SPREAD, MAX_SPREAD);
    if (Math.abs(next - this.layoutSpread) < 0.001) return;
    // Keep customize moves — remap from current layout, not the original spawn
    this.syncBaseFromCurrentTrees();
    this.applyLayoutSpread(next);
    this.rebuildAfterSpread();
  }

  setDecorBrush(kind: DecorKind | null): void {
    this.decorBrush = kind;
    if (kind) this.selectDecor(null);
    if (this.customizeMode && this.ready) {
      this.app.canvas.style.cursor = kind ? "crosshair" : "default";
    }
  }

  /** Rebuild seasonal visuals in place (keeps camera, world size, and tree layout). */
  setSeason(season: Season, weather: Weather): void {
    if (!this.ready || this.destroyed) return;
    if (this.config.season === season && this.config.weather === weather) return;

    this.config = { ...this.config, season, weather };
    this.app.renderer.background.color = SEASON_PALETTE[season].grass;

    this.persistPlacements();
    this.selectedDecor = null;
    this.onDecorSelect?.(null);
    this.decorDrag = null;
    this.selectTreeNode(null);

    this.clearLayer(this.groundLayer);
    this.destroyLayerChildren(this.treeLayer);
    this.destroyLayerChildren(this.signLayer);
    this.clearLayer(this.fxLayer);
    this.placements.clear();
    this.lamps = [];
    this.particles = [];

    // Do NOT rematch/resize the world here — keep spread + camera across seasons
    this.buildGround();
    this.buildTrees();
    this.scatterMapProps();
    this.restoreCustomDecor();
    this.seedButterflies();
    // Restore the same overview/zoom level the user had
    const ratio = loadZoomRatio(this.config.username);
    if (ratio != null) {
      this.camera.zoom = clamp(
        ratio * this.containZoom(),
        this.minZoom(),
        this.maxZoom()
      );
    }
    this.applyCamera();
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
    // Signs sit above every tree so foliage never covers a hovered/selected plank
    this.signLayer.sortableChildren = true;
    this.signLayer.eventMode = "none";
    this.signLayer.interactiveChildren = false;
    this.world.addChild(this.signLayer);
    this.world.addChild(this.fxLayer);
    this.world.addChild(this.weatherLayer);
    this.app.stage.addChild(this.world);
    this.app.stage.addChild(this.overlayLayer);
    this.app.stage.addChild(this.lightLayer);

    try {
      await loadForestSprites();
      await loadCustomDecorSprites();
      await loadWoodPanel();
    } catch (err) {
      console.warn("Forest decor sprites failed to load", err);
    }

    if (this.destroyed) {
      this.safeDestroyApp(true);
      return;
    }

    // Expand meadow to the viewport aspect so contain-zoom fills the screen (no green bars)
    this.matchWorldToViewport();
    this.captureBaseLayout();
    this.layoutSpread = loadLayoutSpread(this.config.username);
    if (this.layoutSpread > MIN_SPREAD + 0.001) {
      this.applyLayoutSpread(this.layoutSpread);
    }

    this.buildGround();
    this.buildTrees();
    this.restoreCustomDecor();

    if (!this.destroyed) {
      this.scatterMapProps();
    }

    if (this.destroyed) {
      this.safeDestroyApp(true);
      return;
    }

    this.seedButterflies();
    // Prefer a full-grove view so every tree is on screen.
    // Only restore a mild saved zoom-in — old close-up ratios hid half the forest.
    this.camera.zoom = this.fitZoom();
    const savedRatio = loadZoomRatio(this.config.username);
    if (savedRatio != null && savedRatio <= 1.2) {
      this.camera.zoom = clamp(
        savedRatio * this.containZoom(),
        this.minZoom(),
        this.maxZoom()
      );
    } else if (savedRatio != null && savedRatio > 1.2) {
      saveZoomRatio(this.config.username, 1);
    }
    this.centerCamera();
    this.bindInput();
    this.bindStageSelection();

    this.app.ticker.add((ticker) => this.update(ticker.deltaMS));
    this.ready = true;
  }

  private scatterMapProps(): void {
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

  private bindStageSelection(): void {
    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on("pointertap", () => {
      if (this.customizeMode) return;
      this.selectTreeNode(null);
    });
    this.app.renderer.on("resize", () => {
      this.app.stage.hitArea = this.app.screen;
    });
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
    const prev = this.selectedDecor;
    // Drop the reference first so rebuild/click handlers never touch a dead decor
    this.selectedDecor = decor && decor.isAlive() ? decor : null;

    if (prev && prev !== this.selectedDecor) {
      try {
        if (prev.isAlive()) prev.setSelected(false);
      } catch {
        /* ignore */
      }
    }
    if (this.selectedDecor) {
      this.selectedDecor.setSelected(true);
      this.decorBrush = null;
      if (this.ready) this.app.canvas.style.cursor = "default";
    }
    this.emitDecorSelect();
  }

  private emitDecorSelect(): void {
    if (!this.selectedDecor || !this.selectedDecor.isAlive()) {
      this.selectedDecor = null;
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
    const items = [...this.placements.values()]
      .filter((d) => d.isAlive())
      .map((d) => d.toData());
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
    if (this.selectedDecor && !this.selectedDecor.isAlive()) {
      this.selectedDecor = null;
    }
    if (this.selectedDecor) {
      const hit = this.selectedDecor.hitTest(worldX, worldY);
      if (hit) return { decor: this.selectedDecor, hit };
    }
    const list = [...this.placements.values()]
      .filter((d) => d.isAlive())
      .sort((a, b) => b.y - a.y);
    for (const decor of list) {
      if (decor === this.selectedDecor) continue;
      const hit = decor.hitTest(worldX, worldY);
      if (hit) return { decor, hit };
    }
    return null;
  }

  private minZoom(): number {
    // Full-meadow fit — grass always edge-to-edge (spread expands the meadow instead)
    return this.containZoom();
  }

  private maxZoom(): number {
    return Math.max(this.containZoom() * 4.5, 2.8);
  }

  private containZoom(): number {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    if (w <= 0 || h <= 0) return 1;
    return Math.min(w / this.config.worldWidth, h / this.config.worldHeight);
  }

  private fitZoom(): number {
    // Full-meadow fit — Scale bar changes meadow size instead of camera zoom
    return this.containZoom();
  }

  private captureBaseLayout(): void {
    this.baseWorldW = this.config.worldWidth;
    this.baseWorldH = this.config.worldHeight;
    this.baseTreePos.clear();
    for (const t of this.config.trees) {
      this.baseTreePos.set(t.id, { x: t.x, y: t.y });
    }
  }

  /**
   * Fold current (possibly spread + customized) positions back into the
   * spread=1 base map so the next scale change keeps rearrange moves.
   */
  private syncBaseFromCurrentTrees(): void {
    if (this.baseWorldW <= 0 || this.baseWorldH <= 0) return;
    const margin = 90;
    const baseSpanX = Math.max(1, this.baseWorldW - margin * 2);
    const baseSpanY = Math.max(1, this.baseWorldH - margin * 2);
    const spanX = Math.max(1, this.config.worldWidth - margin * 2);
    const spanY = Math.max(1, this.config.worldHeight - margin * 2);

    for (const t of this.config.trees) {
      const nx = clamp((t.x - margin) / spanX, 0, 1);
      const ny = clamp((t.y - margin) / spanY, 0, 1);
      this.baseTreePos.set(t.id, {
        x: margin + nx * baseSpanX,
        y: margin + ny * baseSpanY,
      });
    }
  }

  /**
   * Expand/shrink the grassy meadow from the captured base layout.
   * Trees spread with it so zooming out never shows empty non-grass bars.
   */
  private applyLayoutSpread(spread: number): void {
    if (this.baseWorldW <= 0 || this.baseWorldH <= 0) return;
    this.layoutSpread = clamp(spread, MIN_SPREAD, MAX_SPREAD);

    const margin = 90;
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    const aspect = sw > 0 && sh > 0 ? sw / sh : this.baseWorldW / this.baseWorldH;

    let ww = Math.round(
      margin * 2 + (this.baseWorldW - margin * 2) * this.layoutSpread
    );
    let wh = Math.round(
      margin * 2 + (this.baseWorldH - margin * 2) * this.layoutSpread
    );

    if (ww / wh < aspect) ww = Math.round(wh * aspect);
    else wh = Math.round(ww / aspect);

    const baseSpanX = Math.max(1, this.baseWorldW - margin * 2);
    const baseSpanY = Math.max(1, this.baseWorldH - margin * 2);
    const spanX = Math.max(1, ww - margin * 2);
    const spanY = Math.max(1, wh - margin * 2);

    const trees = this.config.trees
      .map((t) => {
        const base = this.baseTreePos.get(t.id) ?? { x: t.x, y: t.y };
        const nx = clamp((base.x - margin) / baseSpanX, 0, 1);
        const ny = clamp((base.y - margin) / baseSpanY, 0, 1);
        return {
          ...t,
          x: margin + nx * spanX,
          y: margin + ny * spanY,
        };
      })
      .sort((a, b) => a.y - b.y);

    this.config = { ...this.config, worldWidth: ww, worldHeight: wh, trees };
  }

  private rebuildAfterSpread(): void {
    // Drop selection without touching display objects — they are about to be destroyed
    this.selectedDecor = null;
    this.onDecorSelect?.(null);
    this.decorDrag = null;
    this.clearLayer(this.groundLayer);
    this.destroyLayerChildren(this.treeLayer);
    this.destroyLayerChildren(this.signLayer);
    this.placements.clear();
    this.lamps = [];
    this.buildGround();
    this.buildTrees();
    this.scatterMapProps();
    this.restoreCustomDecor();
    this.camera.zoom = this.containZoom();
    this.centerCamera();
    this.persistViewState();
    this.onSpreadChange?.(this.layoutSpread);
  }

  private persistViewState(): void {
    saveLayoutSpread(this.config.username, this.layoutSpread);
    const contain = this.containZoom();
    if (contain > 0) {
      saveZoomRatio(this.config.username, this.camera.zoom / contain);
    }
  }

  private centerCamera(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    this.camera.zoom = clamp(this.camera.zoom, this.minZoom(), this.maxZoom());
    this.camera.x = this.config.worldWidth / 2 - w / 2 / this.camera.zoom;
    this.camera.y = this.config.worldHeight / 2 - h / 2 / this.camera.zoom;
    this.applyCamera();
  }

  /** True when the whole world fits in the view at the current zoom (no room to pan). */
  private worldFitsInView(): boolean {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const viewW = w / this.camera.zoom;
    const viewH = h / this.camera.zoom;
    return viewW >= this.config.worldWidth - 0.5 && viewH >= this.config.worldHeight - 0.5;
  }

  /**
   * Grow worldWidth/Height so the meadow aspect matches the screen.
   * Always stretch tree positions when the meadow grows so the grove stays
   * filled — growing without remap left a tiny forest in a huge empty field.
   */
  private matchWorldToViewport(): boolean {
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    if (sw <= 0 || sh <= 0) return false;

    const aspect = sw / sh;
    const oldW = this.config.worldWidth;
    const oldH = this.config.worldHeight;
    let ww = oldW;
    let wh = oldH;

    // Keep room for every tree (saved positions may sit near edges)
    let needW = ww;
    let needH = wh;
    for (const t of this.config.trees) {
      needW = Math.max(needW, t.x + 80);
      needH = Math.max(needH, t.y + 80);
    }
    ww = Math.max(ww, needW);
    wh = Math.max(wh, needH);

    if (ww / wh < aspect) {
      ww = Math.round(wh * aspect);
    } else {
      wh = Math.round(ww / aspect);
    }

    if (ww === oldW && wh === oldH) return false;

    const margin = 90;
    const oldSpanX = Math.max(1, oldW - margin * 2);
    const oldSpanY = Math.max(1, oldH - margin * 2);
    const scaleX = (ww - margin * 2) / oldSpanX;
    const scaleY = (wh - margin * 2) / oldSpanY;

    const trees =
      scaleX > 1.001 || scaleY > 1.001
        ? this.config.trees
            .map((t) => ({
              ...t,
              x: margin + (t.x - margin) * scaleX,
              y: margin + (t.y - margin) * scaleY,
            }))
            .sort((a, b) => a.y - b.y)
        : this.config.trees;

    this.config = { ...this.config, worldWidth: ww, worldHeight: wh, trees };
    return true;
  }

  private rebuildGroundOnly(): void {
    this.clearLayer(this.groundLayer);
    this.buildGround();
  }

  private buildGround(): void {
    const { worldWidth, worldHeight, season, seed } = this.config;
    const rng = createRng(seed ^ 0xabcd);
    const floor = buildForestFloor(worldWidth, worldHeight, season, rng);
    this.groundLayer.addChild(floor);
  }

  private buildTrees(): void {
    this.treeLayer.sortableChildren = true;
    this.treeNodes.clear();
    this.treeSigns.clear();
    this.signLayer.removeChildren();
    this.selectedTreeId = null;

    for (const tree of this.config.trees) {
      const sprite = drawTree(tree, this.config.season);
      sprite.zIndex = tree.y;
      this.treeNodes.set(tree.id, sprite);

      const withSign = sprite as Container & { repoSign?: Container };
      if (withSign.repoSign) {
        const sign = withSign.repoSign;
        const ox = sign.x;
        const oy = sign.y;
        // Reparent onto the dedicated sign layer (world-space coords)
        this.signLayer.addChild(sign);
        sign.x = tree.x + ox;
        sign.y = tree.y + oy;
        sign.zIndex = tree.y;
        this.treeSigns.set(tree.id, {
          sign,
          ox,
          oy,
          treeX: tree.x,
          treeY: tree.y,
        });
      }

      sprite.on("pointerover", () => {
        if (this.customizeMode) return;
        this.setTreeSignVisible(tree.id, true);
      });
      sprite.on("pointerout", () => {
        if (this.customizeMode) return;
        if (this.selectedTreeId !== tree.id) {
          this.setTreeSignVisible(tree.id, false);
        }
      });
      sprite.on("pointertap", (e) => {
        if (this.customizeMode) return;
        e.stopPropagation();
        this.selectTreeNode(tree);
      });
      this.treeLayer.addChild(sprite);
    }
    this.treeLayer.sortChildren();
  }

  private selectTreeNode(tree: TreeTraits | null): void {
    const prevId = this.selectedTreeId;
    this.selectedTreeId = tree?.id ?? null;

    if (prevId != null && prevId !== this.selectedTreeId) {
      this.setTreeSignVisible(prevId, false);
    }
    if (this.selectedTreeId != null) {
      this.setTreeSignVisible(this.selectedTreeId, true);
    }

    this.onSelect(tree);
  }

  private setTreeSignVisible(treeId: number, visible: boolean): void {
    const entry = this.treeSigns.get(treeId);
    if (!entry) return;
    entry.sign.visible = visible;
    // Keep visible signs stacked above each other by tree depth
    entry.sign.zIndex = visible ? 1_000_000 + entry.treeY : entry.treeY;
    this.signLayer.sortChildren();
  }

  private hitTreeAt(worldX: number, worldY: number): TreeTraits | null {
    const sorted = [...this.config.trees].sort((a, b) => b.y - a.y);
    for (const tree of sorted) {
      const h = tree.height;
      const canopyR =
        tree.form === "legendary" ? h * 0.55 : Math.max(14, h * 0.4);
      const dx = worldX - tree.x;
      const dy = worldY - tree.y;
      if (Math.abs(dx) <= canopyR + 12 && dy <= 14 && dy >= -h - 16) {
        return tree;
      }
    }
    return null;
  }

  private setTreeWorldPosition(treeId: number, x: number, y: number): void {
    const tree = this.config.trees.find((t) => t.id === treeId);
    const sprite = this.treeNodes.get(treeId);
    if (!tree || !sprite) return;

    const nx = clamp(x, 40, this.config.worldWidth - 40);
    const ny = clamp(y, 40, this.config.worldHeight - 40);
    tree.x = nx;
    tree.y = ny;
    sprite.x = nx;
    sprite.y = ny;
    sprite.zIndex = ny;

    const sign = this.treeSigns.get(treeId);
    if (sign) {
      sign.treeX = nx;
      sign.treeY = ny;
      sign.sign.x = nx + sign.ox;
      sign.sign.y = ny + sign.oy;
      const boosted = sign.sign.visible;
      sign.sign.zIndex = boosted ? 1_000_000 + ny : ny;
    }

    this.treeLayer.sortChildren();
    this.signLayer.sortChildren();
  }

  private persistTreePositions(): void {
    this.syncBaseFromCurrentTrees();
    // Persist base-space coords so reload + scale keeps customize moves
    const payload = this.config.trees.map((t) => {
      const b = this.baseTreePos.get(t.id);
      return { id: t.id, x: b?.x ?? t.x, y: b?.y ?? t.y };
    });
    saveTreePositions(this.config.username, payload);
  }

  private seedButterflies(): void {
    const rng = createRng(this.config.seed ^ 0xb17f);
    this.butterflies = [];
    if (this.config.season === "winter") return;

    const palette = [0xff6b9d, 0xffc857, 0x7ec8ff, 0xc9a0ff, 0xff8c5a, 0xffffff];
    const boost =
      this.config.season === "summer" || this.config.season === "monsoon" ? 1.4 : 1;
    const count = Math.min(
      18,
      Math.round((4 + this.config.trees.length / 6) * boost)
    );

    for (let i = 0; i < count; i++) {
      this.butterflies.push({
        x: rng.float(50, this.config.worldWidth - 50),
        y: rng.float(this.config.worldHeight * 0.15, this.config.worldHeight * 0.85),
        vx: rng.float(-0.55, 0.55),
        vy: rng.float(-0.35, 0.35),
        color: rng.pick(palette),
        phase: rng.float(0, Math.PI * 2),
      });
    }
  }

  private applyCamera(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    // Camera zoom is locked to a full-meadow fit; Scale bar changes meadow size instead
    this.camera.zoom = this.containZoom();
    const viewW = w / this.camera.zoom;
    const viewH = h / this.camera.zoom;
    // If the view is larger than the meadow, center it — don't pin to (0,0)
    if (viewW >= this.config.worldWidth) {
      this.camera.x = (this.config.worldWidth - viewW) / 2;
    } else {
      this.camera.x = clamp(this.camera.x, 0, this.config.worldWidth - viewW);
    }
    if (viewH >= this.config.worldHeight) {
      this.camera.y = (this.config.worldHeight - viewH) / 2;
    } else {
      this.camera.y = clamp(this.camera.y, 0, this.config.worldHeight - viewH);
    }
    this.world.scale.set(this.camera.zoom);
    this.world.position.set(-this.camera.x * this.camera.zoom, -this.camera.y * this.camera.zoom);
  }

  private bindInput(): void {
    const canvas = this.app.canvas;

    const onKeyDown = (e: KeyboardEvent) => {
      this.keys.add(e.key.toLowerCase());
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
      // Scale is only via the Scale bar — block scroll-zoom on the meadow
      e.preventDefault();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const onPointerDown = (e: PointerEvent) => {
      this.dragLast = { x: e.clientX, y: e.clientY };
      this.decorDrag = null;
      this.panCandidate = false;
      this.treeDragId = null;
      this.treeDragMoved = false;

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

        const tree = this.hitTreeAt(world.x, world.y);
        if (tree) {
          this.selectDecor(null);
          this.treeDragId = tree.id;
          this.setTreeSignVisible(tree.id, true);
          if (this.ready) this.app.canvas.style.cursor = "grabbing";
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
      if (this.treeDragId != null) {
        if (this.treeDragMoved) this.persistTreePositions();
        if (this.customizeMode && this.ready) {
          this.app.canvas.style.cursor = this.decorBrush ? "crosshair" : "default";
        }
      }
      this.dragging = false;
      this.decorDrag = null;
      this.panCandidate = false;
      this.treeDragId = null;
      this.treeDragMoved = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      const dx = e.clientX - this.dragLast.x;
      const dy = e.clientY - this.dragLast.y;
      const world = this.screenToWorld(e.clientX, e.clientY);

      if (this.treeDragId != null) {
        if (Math.hypot(dx, dy) > 2 || this.treeDragMoved) {
          this.treeDragMoved = true;
          this.setTreeWorldPosition(this.treeDragId, world.x, world.y);
        }
        this.dragLast = { x: e.clientX, y: e.clientY };
        return;
      }

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
      // No pan when the whole forest already fits (unless zoomed in)
      if (this.worldFitsInView()) {
        this.dragLast = { x: e.clientX, y: e.clientY };
        return;
      }
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
        // Re-apply spread from the fixed base so grass stays filled on resize
        if (this.baseWorldW > 0) {
          const ratio = this.camera.zoom / Math.max(1e-6, this.containZoom());
          this.syncBaseFromCurrentTrees();
          this.applyLayoutSpread(this.layoutSpread);
          this.selectedDecor = null;
          this.onDecorSelect?.(null);
          this.decorDrag = null;
          this.clearLayer(this.groundLayer);
          this.destroyLayerChildren(this.treeLayer);
          this.destroyLayerChildren(this.signLayer);
          this.placements.clear();
          this.lamps = [];
          this.buildGround();
          this.buildTrees();
          this.scatterMapProps();
          this.restoreCustomDecor();
          this.camera.zoom = clamp(
            ratio * this.containZoom(),
            this.minZoom(),
            this.maxZoom()
          );
          if (this.worldFitsInView() || this.camera.zoom <= this.containZoom() * 1.02) {
            this.camera.zoom = this.fitZoom();
            this.centerCamera();
          } else {
            this.applyCamera();
          }
          this.persistViewState();
        } else if (this.matchWorldToViewport()) {
          this.captureBaseLayout();
          this.selectedDecor = null;
          this.onDecorSelect?.(null);
          this.decorDrag = null;
          this.rebuildGroundOnly();
          this.destroyLayerChildren(this.treeLayer);
          this.destroyLayerChildren(this.signLayer);
          this.placements.clear();
          this.lamps = [];
          this.buildTrees();
          this.scatterMapProps();
          this.restoreCustomDecor();
          this.camera.zoom = this.fitZoom();
          this.centerCamera();
        } else {
          this.applyCamera();
        }
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

  private update(deltaMS: number): void {
    if (this.destroyed) return;
    this.time += deltaMS;
    this.dayPhase = (this.dayPhase + deltaMS * 0.000008) % 1;

    const speed = 3.2 / this.camera.zoom;
    if (!this.worldFitsInView()) {
      if (this.keys.has("w") || this.keys.has("arrowup")) this.camera.y -= speed;
      if (this.keys.has("s") || this.keys.has("arrowdown")) this.camera.y += speed;
      if (this.keys.has("a") || this.keys.has("arrowleft")) this.camera.x -= speed;
      if (this.keys.has("d") || this.keys.has("arrowright")) this.camera.x += speed;
    }
    this.applyCamera();

    this.updateFx();
    this.updateWeather();
    this.updateDayNight();
    this.updateButterflies(deltaMS);
  }

  private updateFx(): void {
    this.clearLayer(this.fxLayer);
    // Only deep night — skip dusk so they don't show in daylight-looking scenes
    const nightness = dayNightFactor(this.dayPhase);
    if (nightness < 0.75) return;
    drawAmbientFireflies(
      this.fxLayer,
      this.config.worldWidth,
      this.config.worldHeight,
      this.time,
      this.config.seed
    );
  }

  private updateWeather(): void {
    this.clearLayer(this.weatherLayer);
    const g = new Graphics();
    g.eventMode = "none";
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
      const area = worldWidth * worldHeight;
      const rainTarget = Math.min(220, Math.max(100, Math.floor(area / 14000)));
      const target = weather === "rain" ? rainTarget : 70;
      while (this.particles.length < target) {
        this.particles.push({
          x: Math.random() * worldWidth,
          y: Math.random() * worldHeight,
          vx: weather === "snow" ? (Math.random() - 0.5) * 0.35 : 0.55,
          vy: weather === "snow" ? 0.5 + Math.random() * 0.45 : 3.2 + Math.random() * 2.8,
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
          g.lineTo(p.x + p.vx * 1.8, p.y + 9);
        }
        g.stroke({ width: 1.25, color: 0xd8eaf8, alpha: 0.7 });
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
      g.eventMode = "none";
      g.rect(0, 0, this.app.screen.width, this.app.screen.height);
      g.fill({ color: 0x0a1628, alpha: night * 0.5 });
      this.overlayLayer.addChild(g);
    }

    const bloom = new Graphics();
    bloom.eventMode = "none";
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

  private updateButterflies(deltaMS: number): void {
    if (this.butterflies.length === 0) return;
    const night = dayNightFactor(this.dayPhase);
    if (night > 0.55) return;

    const g = new Graphics();
    g.eventMode = "none";
    const dt = deltaMS / 16;

    for (const b of this.butterflies) {
      b.phase += dt * 0.35;
      b.x += (b.vx + Math.sin(b.phase * 1.7) * 0.25) * dt;
      b.y += (b.vy + Math.cos(b.phase * 2.1) * 0.3) * dt;

      if (b.x < 30 || b.x > this.config.worldWidth - 30) b.vx *= -1;
      if (b.y < 40 || b.y > this.config.worldHeight - 30) b.vy *= -1;
      b.x = clamp(b.x, 30, this.config.worldWidth - 30);
      b.y = clamp(b.y, 40, this.config.worldHeight - 30);

      const flap = 0.4 + Math.abs(Math.sin(this.time * 0.028 + b.phase)) * 0.6;
      const wingW = 5 * flap;
      const wingH = 3.4;
      g.ellipse(b.x - wingW * 0.55, b.y, wingW, wingH);
      g.fill({ color: b.color, alpha: 0.95 });
      g.ellipse(b.x + wingW * 0.55, b.y, wingW, wingH);
      g.fill({ color: b.color, alpha: 0.95 });
      g.ellipse(b.x, b.y, 1.1, 2.2);
      g.fill(0x2c1810);
    }

    this.fxLayer.addChild(g);
  }

  private clearLayer(layer: Container): void {
    for (const child of layer.removeChildren()) {
      child.destroy();
    }
  }

  private destroyLayerChildren(layer: Container): void {
    for (const child of layer.removeChildren()) {
      child.destroy({ children: true });
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
