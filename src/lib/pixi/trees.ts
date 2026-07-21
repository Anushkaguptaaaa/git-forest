import { Container, Graphics } from "pixi.js";
import type { Season, TreeSpecies, TreeTraits } from "@/lib/github/types";
import { SEASON_PALETTE } from "@/lib/world/seasons";

const CANOPY: Record<TreeSpecies, number> = {
  oak: 0x3d8b37,
  pine: 0x2d6a3e,
  birch: 0x7cb342,
  willow: 0x689f38,
  maple: 0xc45c26,
  cherry: 0xe891a8,
  cedar: 0x1b5e3a,
  dead: 0x6b5e4f,
  sapling: 0x81c784,
};

const TRUNK: Record<TreeSpecies, number> = {
  oak: 0x5d4037,
  pine: 0x4e342e,
  birch: 0xe8e0d5,
  willow: 0x6d4c41,
  maple: 0x5d4037,
  cherry: 0x6d4c41,
  cedar: 0x3e2723,
  dead: 0x4a4038,
  sapling: 0x8d6e63,
};

function autumnTint(species: TreeSpecies, season: Season): number {
  if (season !== "autumn" || species === "dead" || species === "pine" || species === "cedar") {
    return CANOPY[species];
  }
  const autumns: Partial<Record<TreeSpecies, number>> = {
    oak: 0xd97706,
    maple: 0xc2410c,
    birch: 0xeab308,
    willow: 0xca8a04,
    cherry: 0xdc2626,
    sapling: 0xf59e0b,
  };
  return autumns[species] ?? CANOPY[species];
}

function winterCanopy(species: TreeSpecies, season: Season): number {
  if (season !== "winter" || species === "dead") return autumnTint(species, season);
  if (species === "pine" || species === "cedar") return 0x2d5a3e;
  return 0xdce5dc;
}

export function drawTree(tree: TreeTraits, season: Season): Container {
  const root = new Container();
  root.x = tree.x;
  root.y = tree.y;
  root.eventMode = "static";
  root.cursor = "pointer";
  (root as Container & { treeData?: TreeTraits }).treeData = tree;

  const g = new Graphics();
  const h = tree.height;
  const canopyR = Math.max(14, h * 0.38);
  const trunkW = Math.max(4, h * 0.08);
  const trunkH = h * 0.45;
  const canopyColor = winterCanopy(tree.species, season);
  const trunkColor = TRUNK[tree.species];

  // shadow
  g.ellipse(0, 4, canopyR * 0.7, canopyR * 0.25);
  g.fill({ color: 0x000000, alpha: 0.18 });

  // trunk
  g.roundRect(-trunkW / 2, -trunkH, trunkW, trunkH + 2, 1);
  g.fill(trunkColor);

  if (tree.species === "dead") {
    // bare branches
    g.moveTo(0, -trunkH * 0.7);
    g.lineTo(-canopyR * 0.6, -trunkH - canopyR * 0.4);
    g.stroke({ width: 2, color: trunkColor });
    g.moveTo(0, -trunkH * 0.5);
    g.lineTo(canopyR * 0.55, -trunkH - canopyR * 0.2);
    g.stroke({ width: 2, color: trunkColor });
    g.moveTo(0, -trunkH * 0.85);
    g.lineTo(canopyR * 0.3, -trunkH - canopyR * 0.6);
    g.stroke({ width: 1.5, color: trunkColor });
  } else if (tree.species === "pine" || tree.species === "cedar") {
    // layered triangles
    const layers = 3;
    for (let i = 0; i < layers; i++) {
      const ly = -trunkH * 0.3 - i * (canopyR * 0.55);
      const lw = canopyR * (1.1 - i * 0.25);
      g.moveTo(0, ly - canopyR * 0.7);
      g.lineTo(-lw, ly + canopyR * 0.15);
      g.lineTo(lw, ly + canopyR * 0.15);
      g.closePath();
      g.fill(canopyColor);
    }
  } else if (tree.species === "sapling") {
    g.circle(0, -trunkH - 6, 8);
    g.fill(canopyColor);
  } else {
    // rounded canopy blobs
    g.circle(0, -trunkH - canopyR * 0.3, canopyR);
    g.fill(canopyColor);
    g.circle(-canopyR * 0.45, -trunkH - canopyR * 0.1, canopyR * 0.55);
    g.fill(canopyColor);
    g.circle(canopyR * 0.4, -trunkH - canopyR * 0.15, canopyR * 0.5);
    g.fill(canopyColor);
    if (tree.species === "willow") {
      for (let i = -2; i <= 2; i++) {
        g.moveTo(i * 6, -trunkH);
        g.quadraticCurveTo(i * 8, -trunkH + canopyR * 0.5, i * 5, -trunkH + canopyR * 0.9);
        g.stroke({ width: 2, color: canopyColor, alpha: 0.85 });
      }
    }
  }

  // flowers (stars)
  if (tree.flowers > 0 && !tree.isDead) {
    const flowerColor = tree.species === "cherry" ? 0xfff0f5 : SEASON_PALETTE[season].accent;
    for (let i = 0; i < tree.flowers; i++) {
      const angle = (i / tree.flowers) * Math.PI * 2;
      const fx = Math.cos(angle) * canopyR * 0.55;
      const fy = -trunkH - canopyR * 0.3 + Math.sin(angle) * canopyR * 0.4;
      g.circle(fx, fy, 2.5);
      g.fill(flowerColor);
    }
  }

  // bird nests (issues)
  for (let i = 0; i < tree.nests; i++) {
    const nx = -canopyR * 0.3 + i * 8;
    const ny = -trunkH - canopyR * 0.1;
    g.ellipse(nx, ny, 4, 2.5);
    g.fill(0x5d4037);
  }

  // saplings (forks) at base
  for (let i = 0; i < tree.saplings; i++) {
    const sx = -18 + i * 8;
    g.roundRect(sx - 1, -6, 2, 8, 0.5);
    g.fill(0x8d6e63);
    g.circle(sx, -8, 4);
    g.fill(0x66bb6a);
  }

  root.addChild(g);

  // hit area
  root.hitArea = {
    contains(x: number, y: number) {
      return x * x + (y + h * 0.4) * (y + h * 0.4) < (canopyR + 12) * (canopyR + 12);
    },
  };

  return root;
}

export function drawFireflies(
  tree: TreeTraits,
  container: Container,
  time: number
): void {
  if (tree.fireflies <= 0 || tree.isDead) return;
  const g = new Graphics();
  for (let i = 0; i < tree.fireflies; i++) {
    const phase = time * 0.002 + i * 1.7 + tree.id * 0.01;
    const ox = Math.sin(phase) * 28 + Math.cos(phase * 0.7) * 10;
    const oy = -tree.height * 0.5 + Math.cos(phase * 1.3) * 20;
    const alpha = 0.4 + 0.6 * ((Math.sin(phase * 3) + 1) / 2);
    g.circle(tree.x + ox, tree.y + oy, 2);
    g.fill({ color: 0xfff59d, alpha });
  }
  container.addChild(g);
}
