import { SEASONS } from '../data/cropsAndItems';
import {
  PlotState,
  SceneId,
  Season,
  WeatherType,
  WorldObject,
} from '../types/game';
import { drawCropFoliage, drawLushTreeOrObject, drawSoilBed } from './botanicalRenderer';
import { drawFarmerCharacter, PlayerActionKind } from './characterRenderer';
import {
  drawFarmhouseExterior,
  drawHouseDepthFurniture,
  drawHouseInteriorBase,
  drawHouseTileBase,
  drawLabBuildingExterior,
} from './houseRenderer';
import { SCENE_MAPS, TILE_SIZE, TileKind } from './maps';
import { CombatProjectile, drawBrownRobot, drawCombatProjectile, RobotDrawParams } from './robotRenderer';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: 'DUST' | 'WATER' | 'SPARKLE' | 'LEAF' | 'FIREFLY' | 'TEXT';
  text?: string;
}

export type FacingDir = 'DOWN' | 'UP' | 'LEFT' | 'RIGHT';

export interface RiverFish {
  id: string;
  kind: 'ikan_wader' | 'ikan_lele' | 'ikan_tomang';
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface RenderState {
  scene: SceneId;
  season: Season;
  weather: WeatherType;
  timeMinutes: number;
  playerX: number;
  playerY: number;
  facingDir: FacingDir;
  isMoving: boolean;
  walkCycle: number;
  actionKind: PlayerActionKind;
  actionProgress: number; // 0..1 when performing an action
  isBathing: boolean;
  isWading?: boolean;
  selectedItemId: string;
  hasSteelHoe: boolean;
  hasBigWateringCan: boolean;
  orchardUnlocked: boolean;
  orchardLeftUnlocked?: boolean;
  orchardRightUnlocked?: boolean;
  peakGateOpened?: boolean;
  rainBoots: boolean;
  plots: Record<string, PlotState>;
  worldObjects: WorldObject[];
  particles: Particle[];
  hoveredTile: { tx: number; ty: number } | null;
  moveTarget: { x: number; y: number } | null;
  cameraX: number;
  cameraY: number;
  zoom?: number;
  shakeAmount: number;
  farmerSprite: HTMLCanvasElement | null;
  elapsedTime: number;
  robot?: RobotDrawParams | null;
  projectiles?: CombatProjectile[];
  riverFish?: RiverFish[];
}

function getSkyColorForTime(timeMinutes: number, weather: WeatherType): { overlay: string; nightAlpha: number; sunWarmth: number } {
  let nightAlpha = 0;
  let overlay = 'rgba(0,0,0,0)';
  let sunWarmth = 0;

  if (timeMinutes < 480) {
    const t = (timeMinutes - 360) / 120;
    sunWarmth = 1 - t;
    overlay = `rgba(255, 190, 110, ${(1 - t) * 0.16})`;
  } else if (timeMinutes < 930) {
    overlay = 'rgba(0,0,0,0)';
  } else if (timeMinutes < 1110) {
    const t = (timeMinutes - 930) / 180;
    sunWarmth = Math.sin(t * Math.PI);
    const duskAlpha = t < 0.6 ? (t / 0.6) * 0.24 : 0.24;
    const nightMix = t > 0.6 ? ((t - 0.6) / 0.4) * 0.35 : 0;
    nightAlpha = nightMix;
    overlay = `rgba(234, 88, 12, ${duskAlpha * (1 - nightMix)})`;
  } else {
    const t = Math.min(1, (timeMinutes - 1110) / 150);
    nightAlpha = 0.35 + t * 0.35;
  }

  if (weather === 'HUJAN_DERAS') {
    nightAlpha = Math.max(nightAlpha, 0.24);
  } else if (weather === 'GERIMIS') {
    nightAlpha = Math.max(nightAlpha, 0.12);
  }

  return { overlay, nightAlpha, sunWarmth };
}

function getGrassPalette(season: Season) {
  switch (season) {
    case 'MARENG':
      return { base: '#5B9A42', dark: '#427A2E', accent: '#75B454', light: '#8AD066' };
    case 'KEMARAU':
      return { base: '#8B9B42', dark: '#6E7C2B', accent: '#A8B153', light: '#C2C767' };
    case 'LABUH':
      return { base: '#4E944F', dark: '#377338', accent: '#68B064', light: '#81C87D' };
    case 'PENGHUJAN':
      return { base: '#3A8247', dark: '#276432', accent: '#4FA15D', light: '#68BE77' };
  }
}

function getWorldWind(wx: number, wy: number, t: number): number {
  return (
    Math.sin(t * 1.2 + wx * 0.015 + wy * 0.01) * 1.7 +
    Math.sin(t * 2.9 + wx * 0.045 - wy * 0.025) * 0.65
  );
}

function drawGrassTuft(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  wind: number,
  darkCol: string,
  lightCol: string
) {
  ctx.save();
  ctx.translate(x, y);
  const blades: [number, number, number][] = [
    [-3.2 * scale, -7.2 * scale, -2.2],
    [0, -9.5 * scale, 0.3],
    [3.1 * scale, -6.8 * scale, 2.4],
  ];
  ctx.lineCap = 'round';
  for (let i = 0; i < blades.length; i++) {
    const [tipX, tipY, lean] = blades[i];
    ctx.strokeStyle = i === 1 ? lightCol : darkCol;
    ctx.lineWidth = (i === 1 ? 1.7 : 1.4) * scale;
    ctx.beginPath();
    ctx.moveTo(lean * 0.4, 0);
    ctx.quadraticCurveTo(lean * 0.8 + wind * 0.5, tipY * 0.55, tipX + wind * 1.15, tipY);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTinyMeadowFlower(ctx: CanvasRenderingContext2D, x: number, y: number, wind: number, petalCol: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#365314';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.quadraticCurveTo(wind * 0.4, 0, wind * 0.8, -3);
  ctx.stroke();

  const fx = wind * 0.8;
  const fy = -3;
  ctx.fillStyle = petalCol;
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    ctx.beginPath();
    ctx.ellipse(fx + Math.cos(a) * 2.1, fy + Math.sin(a) * 2.1, 1.8, 1.15, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(fx, fy, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawOrganicStone(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rot: number,
  topCol: string,
  baseCol: string,
  shadowCol: string
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
  ctx.beginPath();
  ctx.ellipse(1.2, 2.1, rx * 1.02, ry * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();

  const g = ctx.createLinearGradient(-rx * 0.6, -ry, rx * 0.7, ry);
  g.addColorStop(0, topCol);
  g.addColorStop(0.55, baseCol);
  g.addColorStop(1, shadowCol);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-rx, 0);
  ctx.bezierCurveTo(-rx, -ry * 0.95, -rx * 0.2, -ry * 1.08, rx * 0.25, -ry * 0.92);
  ctx.bezierCurveTo(rx * 0.98, -ry * 0.75, rx * 1.06, ry * 0.25, rx * 0.72, ry * 0.82);
  ctx.bezierCurveTo(rx * 0.2, ry * 1.06, -rx * 0.85, ry * 0.88, -rx, 0);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-rx * 0.55, -ry * 0.45);
  ctx.quadraticCurveTo(0, -ry * 0.78, rx * 0.5, -ry * 0.42);
  ctx.stroke();
  ctx.restore();
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  tile: TileKind,
  tx: number,
  ty: number,
  px: number,
  py: number,
  state: RenderState
) {
  const s = TILE_SIZE;
  const fillTile = (x: number, y: number, w = s, h = s) => {
    ctx.fillRect(x - 0.35, y - 0.35, w + 0.7, h + 0.7);
  };
  const pal = getGrassPalette(state.season);
  const hash = (tx * 73856093) ^ (ty * 19349663);
  const v = Math.abs(hash % 100);
  const v2 = Math.abs((hash >> 6) % 100);
  const wind = getWorldWind(px + 24, py + 24, state.elapsedTime);

  switch (tile) {
    case 'GRASS': {
      ctx.fillStyle = v % 3 === 0 ? pal.accent : pal.base;
      fillTile(px, py);
      if (v % 4 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
        ctx.beginPath();
        ctx.ellipse(px + 18 + (v % 12), py + 20 + (v2 % 12), 14, 9, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (v < 34) {
        drawGrassTuft(ctx, px + 10 + (v % 26), py + 22 + (v2 % 16), 0.9 + (v % 3) * 0.12, wind, pal.dark, pal.light);
      }
      if (v === 42 || v === 77) {
        drawTinyMeadowFlower(
          ctx,
          px + 14 + (v2 % 20),
          py + 18 + (v % 18),
          wind,
          state.season === 'KEMARAU' ? '#FDE047' : '#FFFBEB'
        );
      }
      break;
    }
    case 'DARK_GRASS': {
      ctx.fillStyle = pal.dark;
      fillTile(px, py);
      if (v % 3 === 0) {
        ctx.fillStyle = 'rgba(10, 32, 16, 0.14)';
        ctx.beginPath();
        ctx.ellipse(px + 24, py + 26, 15, 10, -0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (v < 42) {
        drawGrassTuft(ctx, px + 10 + (v % 26), py + 24 + (v2 % 14), 1.05, wind, '#1E4620', pal.base);
      }
      break;
    }
    case 'DIRT_PATH': {
      const dg = ctx.createLinearGradient(px, py, px + s, py + s);
      dg.addColorStop(0, '#D2AE7D');
      dg.addColorStop(1, '#BE9663');
      ctx.fillStyle = dg;
      fillTile(px, py);
      if (v < 48) {
        drawOrganicStone(
          ctx,
          px + 10 + (v % 26),
          py + 12 + (v2 % 22),
          3.8 + (v % 2),
          2.5,
          (v % 5) * 0.3,
          '#D6B990',
          '#B08956',
          '#876439'
        );
      }
      break;
    }
    case 'STONE_ROAD': {
      ctx.fillStyle = '#857C6E';
      fillTile(px, py);
      // Irregular 2.5D polygonal flagstones with beveled tops & mortar crevices
      const stones: [number, number, number, number, number][] = [
        [px + 13, py + 13, 10.5, 8.5, 0.1],
        [px + 34, py + 14, 9.8, 8.2, -0.15],
        [px + 15, py + 34, 11.2, 8.5, -0.08],
        [px + 36, py + 35, 8.5, 8.2, 0.18],
      ];
      for (let i = 0; i < stones.length; i++) {
        const [sx, sy, rx, ry, rot] = stones[i];
        const shade = (v + i) % 2 === 0;
        drawOrganicStone(
          ctx,
          sx,
          sy,
          rx,
          ry,
          rot,
          shade ? '#D6CFC2' : '#C7BFA9',
          shade ? '#ACA393' : '#9E9484',
          '#575147'
        );
      }
      if (v < 34) {
        ctx.fillStyle = '#4D7C0F';
        ctx.beginPath();
        ctx.ellipse(px + 24, py + 23, 4.5, 2.8, 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'LAB_FLOOR': {
      const cg = ctx.createLinearGradient(px, py, px + s, py + s);
      cg.addColorStop(0, v % 2 === 0 ? '#778599' : '#69778C');
      cg.addColorStop(1, '#526072');
      ctx.fillStyle = cg;
      fillTile(px, py);
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.32)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
      if (v < 36) {
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.26)';
        ctx.beginPath();
        ctx.moveTo(px + 8, py + 14 + (v % 12));
        ctx.lineTo(px + 20, py + 18 + (v % 10));
        ctx.lineTo(px + 28, py + 12 + (v2 % 14));
        ctx.stroke();
        ctx.fillStyle = '#4D7C0F';
        ctx.beginPath();
        ctx.ellipse(px + 14 + (v % 18), py + 16 + (v2 % 16), 5.5, 2.8, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'LAB_WALL': {
      ctx.fillStyle = '#1E293B';
      fillTile(px, py);
      const wg = ctx.createLinearGradient(px, py, px, py + s);
      wg.addColorStop(0, '#64748B');
      wg.addColorStop(0.55, '#475569');
      wg.addColorStop(1, '#1E293B');
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.roundRect(px + 2, py + 2, s - 4, s - 6, 3);
      ctx.fill();
      ctx.fillStyle = '#7C2D12';
      ctx.fillRect(px + 4, py + 7, s - 8, 4);
      // Organic creeping vine tuft on wall
      ctx.strokeStyle = '#365314';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(px + 10, py + 2);
      ctx.quadraticCurveTo(px + 16 + wind * 0.2, py + 18, px + 26, py + 32);
      ctx.stroke();
      ctx.fillStyle = '#4D7C0F';
      ctx.beginPath();
      ctx.ellipse(px + 14 + (v % 14), py + 14, 7, 4.5, 0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'LAB_CONSOLE': {
      ctx.fillStyle = '#5B687A';
      fillTile(px, py);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
      ctx.beginPath();
      ctx.roundRect(px + 7, py + 8, s - 12, s - 9, 4);
      ctx.fill();
      const conG = ctx.createLinearGradient(px, py + 5, px, py + s - 4);
      conG.addColorStop(0, '#334155');
      conG.addColorStop(1, '#0F172A');
      ctx.fillStyle = conG;
      ctx.beginPath();
      ctx.roundRect(px + 6, py + 5, s - 12, s - 9, 4);
      ctx.fill();

      const flicker = Math.sin(state.elapsedTime * 4.5 + tx) > -0.4;
      const scrG = ctx.createLinearGradient(px + 11, py + 10, px + s - 11, py + 23);
      scrG.addColorStop(0, flicker ? '#2DD4BF' : '#334155');
      scrG.addColorStop(1, flicker ? '#0F766E' : '#1E293B');
      ctx.fillStyle = scrG;
      ctx.beginPath();
      ctx.roundRect(px + 11, py + 10, s - 22, 13, 2);
      ctx.fill();
      if (flicker) {
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(px + 13, py + 17);
        ctx.quadraticCurveTo(px + 19, py + 12, px + 24, py + 17);
        ctx.quadraticCurveTo(px + 29, py + 21, px + 34, py + 15);
        ctx.stroke();
      }
      ctx.fillStyle = '#4D7C0F';
      ctx.beginPath();
      ctx.ellipse(px + 13, py + 34, 5, 3.2, -0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'FARM_ZONE': {
      const fg = ctx.createLinearGradient(px, py, px + s, py + s);
      fg.addColorStop(0, '#96764E');
      fg.addColorStop(1, '#82633D');
      ctx.fillStyle = fg;
      fillTile(px, py);
      if (v < 35) {
        ctx.fillStyle = 'rgba(65, 45, 22, 0.22)';
        ctx.beginPath();
        ctx.ellipse(px + 12 + (v % 22), py + 14 + (v2 % 20), 2.8, 1.8, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'VOLCANIC_ZONE': {
      const vg = ctx.createLinearGradient(px, py, px + s, py + s);
      vg.addColorStop(0, '#61483A');
      vg.addColorStop(1, '#4C372B');
      ctx.fillStyle = vg;
      fillTile(px, py);
      if (v < 40) {
        ctx.fillStyle = 'rgba(251, 191, 36, 0.1)';
        ctx.beginPath();
        ctx.ellipse(px + 14 + (v % 20), py + 14 + (v2 % 20), 3, 2, 0.2, 0, Math.PI * 2);
        ctx.fill();
      }

      const isLeftSealed = state.scene === 'ORCHARD' && tx <= 12 && !state.orchardLeftUnlocked;
      const isRightSealed = state.scene === 'ORCHARD' && tx >= 15 && !state.orchardRightUnlocked;
      if (isLeftSealed || isRightSealed) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
        ctx.fillRect(px, py, s, s);
        const isEdge = isLeftSealed
          ? tx === 4 || tx === 11 || ty === 5 || ty === 16
          : tx === 16 || tx === 23 || ty === 5 || ty === 16;
        if (isEdge) {
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.72)';
          ctx.lineWidth = 2.4;
          if ((isLeftSealed && tx === 4) || (isRightSealed && tx === 16)) {
            ctx.beginPath();
            ctx.moveTo(px + 3, py);
            ctx.lineTo(px + 3, py + s);
            ctx.stroke();
          }
          if ((isLeftSealed && tx === 11) || (isRightSealed && tx === 23)) {
            ctx.beginPath();
            ctx.moveTo(px + s - 3, py);
            ctx.lineTo(px + s - 3, py + s);
            ctx.stroke();
          }
          if (ty === 5) {
            ctx.beginPath();
            ctx.moveTo(px, py + 3);
            ctx.lineTo(px + s, py + 3);
            ctx.stroke();
          }
          if (ty === 16) {
            ctx.beginPath();
            ctx.moveTo(px, py + s - 3);
            ctx.lineTo(px + s, py + s - 3);
            ctx.stroke();
          }
          if ((tx === 4 || tx === 11 || tx === 16 || tx === 23) && (ty === 5 || ty === 16 || ty === 10 || ty === 11)) {
            ctx.fillStyle = '#5C3A21';
            ctx.beginPath();
            ctx.roundRect(px + 19, py + 14, 9, 20, 2);
            ctx.fill();
            ctx.fillStyle = '#F59E0B';
            ctx.beginPath();
            ctx.arc(px + 23.5, py + 13, 4.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      break;
    }
    case 'WATER': {
      const wg = ctx.createLinearGradient(px, py, px + s, py + s);
      wg.addColorStop(0, '#0EA5E9');
      wg.addColorStop(1, '#0369A1');
      ctx.fillStyle = wg;
      fillTile(px, py);
      if (state.scene === 'FARM' && tx >= 17 && tx <= 19) {
        if (tx === 17) {
          drawOrganicStone(ctx, px + 3, py + 12, 4.5, 11, 0, '#94A3B8', '#78716C', '#44403C');
          drawOrganicStone(ctx, px + 3, py + 35, 4.5, 12, 0, '#94A3B8', '#78716C', '#44403C');
        } else if (tx === 19 && (ty < 15 || ty > 18)) {
          drawOrganicStone(ctx, px + s - 3, py + 12, 4.5, 11, 0, '#94A3B8', '#78716C', '#44403C');
          drawOrganicStone(ctx, px + s - 3, py + 35, 4.5, 12, 0, '#94A3B8', '#78716C', '#44403C');
        }
      } else if (state.scene === 'FARM' && ty >= 15 && ty <= 18 && tx >= 20) {
        if (ty === 15) {
          drawOrganicStone(ctx, px + 12, py + 3, 11, 4.2, 0, '#94A3B8', '#78716C', '#44403C');
          drawOrganicStone(ctx, px + 35, py + 3, 12, 4.2, 0, '#94A3B8', '#78716C', '#44403C');
        } else if (ty === 18) {
          drawOrganicStone(ctx, px + 12, py + s - 3, 11, 4.2, 0, '#94A3B8', '#78716C', '#44403C');
          drawOrganicStone(ctx, px + 35, py + s - 3, 12, 4.2, 0, '#94A3B8', '#78716C', '#44403C');
        }
      }
      break;
    }
    case 'RIVER_WATER': {
      const isShallowEdge =
        state.scene === 'FOREST'
          ? (tx === 20 && ty < 15) || (ty === 15 && tx < 20)
          : (tx === 14 && ty < 17) || (ty === 17 && tx >= 15);
      const rwg = ctx.createLinearGradient(px, py, px + s, py + s);
      rwg.addColorStop(0, isShallowEdge ? '#67E8F9' : '#38BDF8');
      rwg.addColorStop(1, isShallowEdge ? '#0EA5E9' : '#0284C7');
      ctx.fillStyle = rwg;
      fillTile(px, py);

      if (state.scene === 'FOREST' && tx === 20 && ty < 15) {
        const sg = ctx.createLinearGradient(px, 0, px + 14, 0);
        sg.addColorStop(0, 'rgba(214, 194, 155, 0.56)');
        sg.addColorStop(1, 'rgba(214, 194, 155, 0)');
        ctx.fillStyle = sg;
        ctx.fillRect(px - 0.35, py - 0.35, 14.35, s + 0.7);
      } else if (state.scene === 'FOREST' && ty === 15 && tx < 20) {
        const sg = ctx.createLinearGradient(0, py, 0, py + 14);
        sg.addColorStop(0, 'rgba(214, 194, 155, 0.56)');
        sg.addColorStop(1, 'rgba(214, 194, 155, 0)');
        ctx.fillStyle = sg;
        ctx.fillRect(px - 0.35, py - 0.35, s + 0.7, 14.35);
      }
      if (v < 45) {
        // Submerged smooth river stone
        ctx.fillStyle = 'rgba(12, 74, 110, 0.24)';
        ctx.beginPath();
        ctx.ellipse(px + 12 + (v % 22), py + 16 + (v2 % 18), 6.2, 4.1, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'RIVER_BANK': {
      const bg = ctx.createLinearGradient(px, py, px + s, py + s);
      bg.addColorStop(0, '#D4BF99');
      bg.addColorStop(1, '#B89F74');
      ctx.fillStyle = bg;
      fillTile(px, py);
      if (v < 65) {
        drawOrganicStone(ctx, px + 12 + (v % 20), py + 14 + (v2 % 18), 4.5, 2.9, 0.25, '#D6C6AA', '#A89472', '#78674B');
        drawOrganicStone(ctx, px + 31 - (v % 12), py + 33 - (v2 % 12), 3.6, 2.4, -0.3, '#C7B698', '#988565', '#6E5E44');
      }
      break;
    }
    case 'MOUNTAIN_ROCK': {
      const mg = ctx.createLinearGradient(px, py, px + s, py + s);
      mg.addColorStop(0, '#526277');
      mg.addColorStop(1, '#364354');
      ctx.fillStyle = mg;
      fillTile(px, py);
      if (v < 50) {
        drawOrganicStone(ctx, px + 18 + (v % 14), py + 18 + (v2 % 14), 8.5, 5.2, 0.2, '#7C8CA1', '#526175', '#27313F');
      }
      if (v % 5 === 0) {
        ctx.fillStyle = '#4D7C0F';
        ctx.beginPath();
        ctx.ellipse(px + 12 + (v % 22), py + 28 - (v2 % 12), 4.5, 2.8, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'MOUNTAIN_MOSS': {
      ctx.fillStyle = '#3B485B';
      fillTile(px, py);
      const mossG = ctx.createRadialGradient(px + 18, py + 16, 4, px + 24, py + 24, 24);
      mossG.addColorStop(0, '#84CC16');
      mossG.addColorStop(0.55, '#4D7C0F');
      mossG.addColorStop(1, '#365314');
      ctx.fillStyle = mossG;
      ctx.beginPath();
      ctx.ellipse(px + 22, py + 23, 19, 15, 0.15, 0, Math.PI * 2);
      ctx.ellipse(px + 30, py + 29, 12, 9, -0.25, 0, Math.PI * 2);
      ctx.fill();
      if (v < 45) {
        drawGrassTuft(ctx, px + 20 + (v % 10), py + 20, 0.85, wind * 0.7, '#365314', '#A3E635');
      }
      break;
    }
    case 'CLIFF_HILL': {
      ctx.fillStyle = '#2B3647';
      fillTile(px, py);
      drawOrganicStone(ctx, px + s / 2, py + s / 2 + 2, 20, 14, 0, '#64748B', '#475569', '#1E293B');
      break;
    }
    case 'CLIFF_MOSS': {
      ctx.fillStyle = '#2F4614';
      fillTile(px, py);
      drawOrganicStone(ctx, px + s / 2, py + s / 2 + 2, 20, 14, 0, '#84CC16', '#4D7C0F', '#365314');
      break;
    }
    case 'PEAK_CLIFF': {
      ctx.fillStyle = '#1E293B';
      fillTile(px, py);
      drawOrganicStone(
        ctx,
        px + s / 2,
        py + s / 2 + 2,
        21,
        18,
        0.1,
        state.scene === 'CLIFF' ? '#64748B' : '#4D7C0F',
        '#334155',
        '#0F172A'
      );
      break;
    }
    case 'MYSTERIOUS_CAVE': {
      ctx.fillStyle = '#2B3647';
      fillTile(px, py);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(px + 2, py + 2, s - 4, s - 6);
      break;
    }
    case 'WOOD_BRIDGE': {
      ctx.fillStyle = state.scene === 'FOREST' ? '#0EA5E9' : '#0284C7';
      fillTile(px, py);
      break;
    }
    case 'FENCE': {
      ctx.fillStyle = pal.dark;
      fillTile(px, py);
      // Cast shadow on grass
      ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
      ctx.fillRect(px + 4, py + s - 8, s - 6, 7);
      // Horizontal beveled rails
      for (const ry of [py + 13, py + 28]) {
        const rg = ctx.createLinearGradient(0, ry, 0, ry + 7);
        rg.addColorStop(0, '#925B33');
        rg.addColorStop(1, '#5C3A21');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.roundRect(px + 2, ry, s - 4, 7, 2);
        ctx.fill();
      }
      // Chamfered vertical fence posts
      for (const postX of [px + 7, px + s - 17]) {
        const pg = ctx.createLinearGradient(postX, 0, postX + 10, 0);
        pg.addColorStop(0, '#A47148');
        pg.addColorStop(0.55, '#784A28');
        pg.addColorStop(1, '#432818');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.roundRect(postX, py + 5, 10, s - 8, 3);
        ctx.fill();
      }
      break;
    }
    case 'GATE_LOCKED': {
      ctx.fillStyle = '#9E9484';
      fillTile(px, py);
      break;
    }
    case 'PEAK_GATE': {
      ctx.fillStyle = '#475569';
      ctx.fillRect(px, py, s, s);
      ctx.fillStyle = '#334155';
      ctx.fillRect(px + 4, py + 4, s - 8, s - 8);
      if (state.peakGateOpened) {
        ctx.fillStyle = '#64748B';
        ctx.beginPath();
        ctx.roundRect(px + 8, py, s - 16, 7, 2);
        ctx.roundRect(px + 8, py + s - 7, s - 16, 7, 2);
        ctx.fill();
        ctx.fillStyle = '#22D3EE';
        ctx.fillRect(px + 18, py + 2, 12, 3);
        ctx.fillRect(px + 18, py + s - 5, 12, 3);
      } else {
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.roundRect(px + 10, py, s - 20, s, 3);
        ctx.fill();
        for (const bx of [px + 14, px + 22, px + 30]) {
          const barG = ctx.createLinearGradient(bx, 0, bx + 4, 0);
          barG.addColorStop(0, '#CBD5E1');
          barG.addColorStop(1, '#475569');
          ctx.fillStyle = barG;
          ctx.fillRect(bx, py + 2, 4, s - 4);
        }
        ctx.fillStyle = '#78350F';
        ctx.beginPath();
        ctx.roundRect(px + 8, py + 16, s - 16, 16, 3);
        ctx.fill();
        const pulse = 0.65 + Math.sin(state.elapsedTime * 4.5) * 0.35;
        ctx.fillStyle = `rgba(245, 158, 11, ${pulse})`;
        ctx.beginPath();
        ctx.arc(px + s / 2, py + s / 2, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      break;
    }
    case 'SIGN': {
      ctx.fillStyle = pal.base;
      fillTile(px, py);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
      ctx.beginPath();
      ctx.ellipse(px + 25, py + 41, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5C3A21';
      ctx.beginPath();
      ctx.roundRect(px + 21, py + 24, 6, 18, 2);
      ctx.fill();
      const boardG = ctx.createLinearGradient(px + 8, py + 8, px + 40, py + 28);
      boardG.addColorStop(0, '#D97706');
      boardG.addColorStop(1, '#92400E');
      ctx.fillStyle = boardG;
      ctx.beginPath();
      ctx.roundRect(px + 8, py + 8, 32, 20, 3.5);
      ctx.fill();
      ctx.strokeStyle = '#451A03';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.fillStyle = '#FEF3C7';
      ctx.beginPath();
      ctx.roundRect(px + 12, py + 13, 24, 3, 1);
      ctx.roundRect(px + 12, py + 19, 18, 3, 1);
      ctx.fill();
      break;
    }
    case 'WELL': {
      ctx.fillStyle = '#C9A472';
      fillTile(px, py);
      const cx = px + s / 2;
      const cy = py + s / 2 + 5;
      // Soft ground shadow
      ctx.fillStyle = 'rgba(15, 23, 42, 0.34)';
      ctx.beginPath();
      ctx.ellipse(cx + 3, cy + 4, 21, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      // Cylindrical 2.5D stone well wall skirt
      const wellWallG = ctx.createLinearGradient(cx - 19, cy, cx + 19, cy);
      wellWallG.addColorStop(0, '#94A3B8');
      wellWallG.addColorStop(0.5, '#64748B');
      wellWallG.addColorStop(1, '#334155');
      ctx.fillStyle = wellWallG;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 4, 18.5, 13.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Stone rim blocks
      ctx.fillStyle = '#94A3B8';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 18.5, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      // Shimmering deep well water mirror
      const wG = ctx.createRadialGradient(cx - 2, cy - 1, 2, cx, cy, 12.5);
      wG.addColorStop(0, '#38BDF8');
      wG.addColorStop(0.7, '#0284C7');
      wG.addColorStop(1, '#082F49');
      ctx.fillStyle = wG;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 12.5, 8.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Timber roof posts & pitched terracotta mini-roof
      ctx.fillStyle = '#5C3A21';
      ctx.fillRect(px + 7, py + 5, 5, 22);
      ctx.fillRect(px + s - 12, py + 5, 5, 22);
      // Crossbeam & hanging rope
      ctx.fillStyle = '#92400E';
      ctx.fillRect(px + 8, py + 9, s - 16, 3);
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx, py + 11);
      ctx.lineTo(cx, cy - 1);
      ctx.stroke();
      const roofG = ctx.createLinearGradient(px + 3, py, px + s - 3, py + 10);
      roofG.addColorStop(0, '#EA580C');
      roofG.addColorStop(1, '#7C2D12');
      ctx.fillStyle = roofG;
      ctx.beginPath();
      ctx.moveTo(cx, py - 2);
      ctx.lineTo(px + s - 2, py + 10);
      ctx.lineTo(px + 2, py + 10);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'HOUSE_ROOF':
    case 'HOUSE_WALL': {
      ctx.fillStyle = pal.base;
      fillTile(px, py);
      break;
    }
    case 'DOOR': {
      if (state.scene === 'HOUSE') {
        drawHouseTileBase(ctx, tile, tx, ty, px, py);
      } else {
        ctx.fillStyle = '#C9A472';
        fillTile(px, py);
      }
      break;
    }
    case 'WALL':
    case 'BATH_FLOOR':
    case 'WOOD_FLOOR_BED':
    case 'WOOD_FLOOR_MAIN':
    case 'WOOD_FLOOR_WORK':
    case 'RUG':
    case 'FURNITURE_BED':
    case 'FURNITURE_PC':
    case 'FURNITURE_FRIDGE':
    case 'FURNITURE_CABINET':
    case 'FURNITURE_SOFA':
    case 'FURNITURE_KITCHEN':
    case 'FURNITURE_SHELF':
    case 'FURNITURE_BATH_POOL':
    case 'FURNITURE_BATH_VANITY':
    case 'FURNITURE_WC': {
      drawHouseTileBase(ctx, tile, tx, ty, px, py);
      break;
    }
  }
}

function drawPeakHighlandsAndCave(ctx: CanvasRenderingContext2D, state: RenderState) {
  const s = TILE_SIZE;
  const t = state.elapsedTime;
  const cliffEdgeX = 22 * s;
  const breeze = getWorldWind(cliffEdgeX, 8 * s, t);

  // 1. Towering asymmetric 2.5D granite mountain hills & lush moss blankets (x: 0..21)
  const hills: [number, number, number, number, string, string, string][] = [
    [3.5, 4.2, 130, 74, '#365314', '#4D7C0F', '#84CC16'],
    [10.5, 3.8, 145, 78, '#1E293B', '#334155', '#65A30D'],
    [17.2, 4.6, 135, 76, '#2F4614', '#3F6212', '#84CC16'],
    [6.5, 9.5, 155, 86, '#365314', '#3F6212', '#65A30D'],
    [14.5, 9.8, 150, 82, '#0F172A', '#334155', '#4D7C0F'],
    [18.8, 11.2, 118, 72, '#2F4614', '#365314', '#65A30D'],
    [4.8, 15.2, 145, 82, '#1E293B', '#475569', '#4D7C0F'],
    [12.5, 15.8, 160, 86, '#2F4614', '#3F6212', '#84CC16'],
    [18.4, 16.4, 125, 76, '#1E293B', '#365314', '#65A30D'],
  ];

  for (const [hx, hy, rx, ry, darkCol, midCol, mossCol] of hills) {
    const cx = hx * s;
    const cy = hy * s;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.36)';
    ctx.beginPath();
    ctx.ellipse(cx + 10, cy + 16, rx * 0.96, ry * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();

    const hg = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + 28);
    hg.addColorStop(0, midCol);
    hg.addColorStop(1, darkCol);
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.moveTo(cx - rx, cy + 4);
    ctx.bezierCurveTo(cx - rx * 0.85, cy - ry * 0.85, cx - rx * 0.25, cy - ry * 1.12, cx + rx * 0.08, cy - ry * 0.94);
    ctx.bezierCurveTo(cx + rx * 0.65, cy - ry * 0.82, cx + rx * 0.98, cy - ry * 0.2, cx + rx, cy + 4);
    ctx.quadraticCurveTo(cx, cy + 28, cx - rx, cy + 4);
    ctx.closePath();
    ctx.fill();

    // Thick sunlit alpine moss crest
    const mossG = ctx.createRadialGradient(cx - rx * 0.22, cy - ry * 0.45, 8, cx, cy - ry * 0.25, rx * 0.72);
    mossG.addColorStop(0, '#A3E635');
    mossG.addColorStop(0.55, mossCol);
    mossG.addColorStop(1, 'rgba(54, 83, 20, 0)');
    ctx.fillStyle = mossG;
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.08, cy - ry * 0.32, rx * 0.72, ry * 0.46, -0.06, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Vertical steep cliff escarpment along x = 21..22
  const escShadow = ctx.createLinearGradient(cliffEdgeX, 0, cliffEdgeX + 22, 0);
  escShadow.addColorStop(0, 'rgba(15, 23, 42, 0.42)');
  escShadow.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = escShadow;
  ctx.fillRect(cliffEdgeX, 3 * s, 22, 16 * s);

  const wallGrad = ctx.createLinearGradient(21 * s, 0, cliffEdgeX, 0);
  wallGrad.addColorStop(0, '#475569');
  wallGrad.addColorStop(0.55, '#1E293B');
  wallGrad.addColorStop(1, '#0F172A');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(21 * s, 0, s, 20 * s);

  for (let ty = 0; ty < 20; ty++) {
    const py = ty * s;
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.roundRect(21 * s + 4, py + 6, s - 12, 11, 3);
    ctx.fill();
    // Swaying overhanging cliff moss drapes
    ctx.fillStyle = ty % 2 === 0 ? '#65A30D' : '#4D7C0F';
    ctx.beginPath();
    ctx.ellipse(21 * s + 16 + breeze * 0.25, py + 12, 16, 7.5, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Upper-right secluded valley & Mysterious Cave (x: 24..26, y: 3)
  const caveLeft = 24 * s;
  const caveRight = 26 * s;
  const caveCx = (caveLeft + caveRight) / 2;
  const caveBaseY = 4 * s - 2;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.38)';
  ctx.fillRect(22 * s, 4 * s - 4, 6 * s, 14);

  ctx.fillStyle = '#1E293B';
  ctx.fillRect(22 * s, 2 * s, 2 * s, 2 * s);
  ctx.fillRect(26 * s, 2 * s, 2 * s, 2 * s);
  ctx.fillStyle = '#4D7C0F';
  ctx.beginPath();
  ctx.ellipse(23 * s, 2.2 * s, 38, 16, 0, 0, Math.PI * 2);
  ctx.ellipse(27 * s, 2.2 * s, 38, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  const archGrad = ctx.createLinearGradient(caveLeft - 10, caveBaseY - 100, caveRight + 10, caveBaseY);
  archGrad.addColorStop(0, '#475569');
  archGrad.addColorStop(1, '#1E293B');
  ctx.fillStyle = archGrad;
  ctx.beginPath();
  ctx.moveTo(caveLeft - 10, caveBaseY);
  ctx.lineTo(caveLeft - 4, caveBaseY - 78);
  ctx.quadraticCurveTo(caveCx, caveBaseY - 106, caveRight + 4, caveBaseY - 78);
  ctx.lineTo(caveRight + 10, caveBaseY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.4;
  ctx.stroke();

  ctx.fillStyle = '#4D7C0F';
  ctx.beginPath();
  ctx.ellipse(caveLeft + 10, caveBaseY - 76, 18, 8, -0.25, 0, Math.PI * 2);
  ctx.ellipse(caveRight - 10, caveBaseY - 74, 18, 8, 0.25, 0, Math.PI * 2);
  ctx.fill();

  // Pitch-black cavern interior + eerie mist glow
  ctx.fillStyle = '#030712';
  ctx.beginPath();
  ctx.moveTo(caveLeft + 10, caveBaseY);
  ctx.lineTo(caveLeft + 14, caveBaseY - 52);
  ctx.quadraticCurveTo(caveCx, caveBaseY - 74, caveRight - 14, caveBaseY - 52);
  ctx.lineTo(caveRight - 10, caveBaseY);
  ctx.closePath();
  ctx.fill();

  const caveGlow = 0.24 + Math.sin(t * 2.4) * 0.08;
  const innerGrad = ctx.createRadialGradient(caveCx, caveBaseY - 26, 4, caveCx, caveBaseY - 26, 38);
  innerGrad.addColorStop(0, `rgba(56, 189, 248, ${caveGlow})`);
  innerGrad.addColorStop(1, 'rgba(3, 7, 18, 0)');
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.arc(caveCx, caveBaseY - 26, 38, 0, Math.PI * 2);
  ctx.fill();

  // Forged iron seal bars
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 4;
  for (const bx of [caveLeft + 22, caveLeft + 36, caveCx, caveRight - 36, caveRight - 22]) {
    ctx.beginPath();
    ctx.moveTo(bx, caveBaseY - 54);
    ctx.lineTo(bx, caveBaseY);
    ctx.stroke();
  }
  ctx.fillStyle = '#334155';
  ctx.fillRect(caveLeft + 12, caveBaseY - 34, caveRight - caveLeft - 24, 7);

  const sealPulse = 0.65 + Math.sin(t * 4) * 0.35;
  ctx.fillStyle = `rgba(245, 158, 11, ${sealPulse})`;
  ctx.strokeStyle = '#FEF08A';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(caveCx, caveBaseY - 30, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(caveCx - 2, caveBaseY - 32, 4, 5);

  ctx.fillStyle = `rgba(34, 211, 238, ${0.55 + Math.sin(t * 3) * 0.35})`;
  ctx.beginPath();
  ctx.moveTo(caveCx, caveBaseY - 86);
  ctx.lineTo(caveCx + 6, caveBaseY - 78);
  ctx.lineTo(caveCx, caveBaseY - 70);
  ctx.lineTo(caveCx - 6, caveBaseY - 78);
  ctx.closePath();
  ctx.fill();

  // Flickering stone braziers with wind-bent flames
  for (const bx of [caveLeft - 14, caveRight + 14]) {
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.roundRect(bx - 6, caveBaseY - 18, 12, 18, 2);
    ctx.fill();

    const flameSway = Math.sin(t * 9 + bx) * 2.2 + breeze * 0.4;
    const fHalo = ctx.createRadialGradient(bx, caveBaseY - 22, 2, bx, caveBaseY - 22, 24);
    fHalo.addColorStop(0, 'rgba(251, 146, 60, 0.45)');
    fHalo.addColorStop(1, 'rgba(251, 146, 60, 0)');
    ctx.fillStyle = fHalo;
    ctx.beginPath();
    ctx.arc(bx, caveBaseY - 22, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.moveTo(bx - 5, caveBaseY - 18);
    ctx.quadraticCurveTo(bx - 4, caveBaseY - 27, bx + flameSway, caveBaseY - 31);
    ctx.quadraticCurveTo(bx + 5, caveBaseY - 26, bx + 5, caveBaseY - 18);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(bx + flameSway * 0.3, caveBaseY - 22, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(caveCx - 92, caveBaseY - 122, 184, 24, 7);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#FDE047';
  ctx.fillText('GUA MISTERIUS (TERKUNCI)', caveCx, caveBaseY - 106);
  ctx.restore();
}

function drawRockyHillsCliffScene(ctx: CanvasRenderingContext2D) {
  const s = TILE_SIZE;

  const drawStoneHill = (cx: number, cy: number, rx: number, ry: number, baseCol: string, ridgeCol: string) => {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.36)';
    ctx.beginPath();
    ctx.ellipse(cx + 8, cy + 13, rx * 0.96, ry * 0.54, 0, 0, Math.PI * 2);
    ctx.fill();

    const hg = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + 16);
    hg.addColorStop(0, ridgeCol);
    hg.addColorStop(0.5, baseCol);
    hg.addColorStop(1, '#0F172A');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.moveTo(cx - rx, cy + 6);
    ctx.bezierCurveTo(cx - rx * 0.72, cy - ry * 0.72, cx - rx * 0.34, cy - ry * 1.05, cx - rx * 0.1, cy - ry);
    ctx.bezierCurveTo(cx + rx * 0.25, cy - ry * 0.95, cx + rx * 0.72, cy - ry * 0.55, cx + rx, cy + 6);
    ctx.quadraticCurveTo(cx, cy + 20, cx - rx, cy + 6);
    ctx.closePath();
    ctx.fill();

    // Sunlit granite crest highlight
    ctx.fillStyle = 'rgba(226, 232, 240, 0.14)';
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.52, cy - ry * 0.62);
    ctx.quadraticCurveTo(cx - rx * 0.12, cy - ry + 4, cx + rx * 0.14, cy - ry * 0.36);
    ctx.quadraticCurveTo(cx - rx * 0.2, cy - ry * 0.18, cx - rx * 0.52, cy - ry * 0.62);
    ctx.fill();
  };

  const perimeterHills: [number, number, number, number, string, string][] = [
    [3.5, 1.8, 108, 56, '#334155', '#64748B'],
    [10.0, 1.7, 128, 62, '#3B485B', '#64748B'],
    [17.0, 1.8, 126, 60, '#334155', '#94A3B8'],
    [23.5, 1.9, 118, 62, '#1E293B', '#475569'],
    [26.2, 6.2, 86, 68, '#334155', '#64748B'],
    [26.0, 11.4, 92, 72, '#1E293B', '#475569'],
    [26.1, 16.4, 88, 68, '#334155', '#64748B'],
    [4.5, 18.6, 116, 54, '#334155', '#64748B'],
    [12.5, 18.7, 132, 56, '#1E293B', '#475569'],
    [20.5, 18.6, 118, 54, '#334155', '#64748B'],
  ];
  for (const [hx, hy, rx, ry, baseCol, ridgeCol] of perimeterHills) {
    drawStoneHill(hx * s, hy * s, rx, ry, baseCol, ridgeCol);
  }

  drawStoneHill(8.5 * s, 6.2 * s, 68, 48, '#3B485B', '#64748B');
  drawStoneHill(18.0 * s, 7.1 * s, 96, 58, '#334155', '#94A3B8');
  drawStoneHill(17.0 * s, 14.1 * s, 94, 56, '#334155', '#64748B');

  ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
  ctx.fillRect(1 * s, 3 * s, 23 * s, 10);
  ctx.fillRect(24 * s - 10, 3 * s, 10, 14 * s);
}

function drawContinuousWaterCurrents(
  ctx: CanvasRenderingContext2D,
  tiles: TileKind[][],
  startTx: number,
  endTx: number,
  startTy: number,
  endTy: number,
  state: RenderState
) {
  const s = TILE_SIZE;
  const t = state.elapsedTime;

  const verticalBands: { tx: number; ty: number; px: number; py: number }[] = [];
  const horizontalBands: { tx: number; ty: number; px: number; py: number }[] = [];
  const pondTiles: { tx: number; ty: number; px: number; py: number }[] = [];

  for (let ty = startTy; ty <= endTy; ty++) {
    for (let tx = startTx; tx <= endTx; tx++) {
      const tile = tiles[ty][tx];
      if (tile !== 'WATER' && tile !== 'RIVER_WATER' && tile !== 'WOOD_BRIDGE') continue;
      const entry = { tx, ty, px: tx * s, py: ty * s };

      if (tile === 'RIVER_WATER') {
        const isWestFlow = state.scene === 'FOREST' && ty >= 15 && tx < 20;
        if (isWestFlow) horizontalBands.push(entry);
        else verticalBands.push(entry);
      } else if (tile === 'WOOD_BRIDGE') {
        verticalBands.push(entry);
      } else if (state.scene === 'FARM' && tx >= 17 && tx <= 19) {
        verticalBands.push(entry);
      } else if (state.scene === 'FARM' && ty >= 15 && ty <= 18 && tx >= 20) {
        horizontalBands.push(entry);
      } else {
        pondTiles.push(entry);
      }
    }
  }

  // 1. Vertical flowing sinusoidal current ribbons
  if (verticalBands.length > 0) {
    ctx.save();
    ctx.beginPath();
    for (const b of verticalBands) {
      ctx.rect(b.px - 0.25, b.py - 0.25, s + 0.5, s + 0.5);
    }
    ctx.clip();

    ctx.lineCap = 'round';
    for (const b of verticalBands) {
      const colSeed = Math.abs((b.tx * 73856093) ^ 19349663) % 100;
      const stride = s;
      for (const [laneX, speed, phaseOff, len, alpha, lw] of [
        [12 + (colSeed % 7), 48, (b.tx * 19) % stride, 16, 0.5, 2.5],
        [24 + ((colSeed >> 1) % 6), 56, (b.tx * 31 + 22) % stride, 18, 0.42, 2.0],
        [36 - (colSeed % 5), 42, (b.tx * 13 + 35) % stride, 14, 0.45, 2.2],
      ] as const) {
        const localY = ((t * speed + phaseOff - b.py) % stride + stride) % stride;
        ctx.strokeStyle = `rgba(224, 242, 254, ${alpha})`;
        ctx.lineWidth = lw;
        for (const offset of [-stride, 0, stride]) {
          const yStart = b.py + localY + offset;
          if (yStart + len >= b.py - 2 && yStart <= b.py + s + 2) {
            const x0 = b.px + laneX;
            const sway = Math.sin(t * 3.1 + yStart * 0.08 + b.tx) * 2.4;
            ctx.beginPath();
            ctx.moveTo(x0, yStart);
            ctx.quadraticCurveTo(x0 + sway, yStart + len * 0.5, x0, yStart + len);
            ctx.stroke();
          }
        }
      }
    }
    ctx.restore();
  }

  // 2. Horizontal westward flowing sinusoidal ribbons
  if (horizontalBands.length > 0) {
    ctx.save();
    ctx.beginPath();
    for (const b of horizontalBands) {
      ctx.rect(b.px - 0.25, b.py - 0.25, s + 0.5, s + 0.5);
    }
    ctx.clip();

    ctx.lineCap = 'round';
    for (const b of horizontalBands) {
      const rowSeed = Math.abs((b.ty * 83492791) ^ 2971215073) % 100;
      const stride = s;
      for (const [laneY, speed, phaseOff, len, alpha, lw] of [
        [13 + (rowSeed % 7), 52, (b.ty * 21) % stride, 16, 0.52, 2.5],
        [25 + ((rowSeed >> 1) % 6), 60, (b.ty * 37 + 18) % stride, 18, 0.43, 2.0],
        [37 - (rowSeed % 5), 46, (b.ty * 11 + 30) % stride, 14, 0.46, 2.2],
      ] as const) {
        const raw = ((t * speed + phaseOff + b.px) % stride + stride) % stride;
        const localX = stride - raw;
        ctx.strokeStyle = `rgba(224, 242, 254, ${alpha})`;
        ctx.lineWidth = lw;
        for (const offset of [-stride, 0, stride]) {
          const xStart = b.px + localX + offset;
          if (xStart + len >= b.px - 2 && xStart <= b.px + s + 2) {
            const y0 = b.py + laneY;
            const sway = Math.sin(t * 3.1 + xStart * 0.08 + b.ty) * 2.4;
            ctx.beginPath();
            ctx.moveTo(xStart, y0);
            ctx.quadraticCurveTo(xStart + len * 0.5, y0 + sway, xStart + len, y0);
            ctx.stroke();
          }
        }
      }
    }
    ctx.restore();
  }

  // 3. Calm spring / pond water sinusoidal shimmer
  if (pondTiles.length > 0) {
    ctx.save();
    ctx.beginPath();
    for (const b of pondTiles) {
      ctx.rect(b.px, b.py, s, s);
    }
    ctx.clip();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.42)';
    ctx.lineWidth = 2.2;
    for (const b of pondTiles) {
      const wave = Math.sin(t * 2.4 + b.tx * 0.8 + b.ty * 0.5) * 4;
      ctx.beginPath();
      ctx.moveTo(b.px + 8 + wave, b.py + 15);
      ctx.quadraticCurveTo(b.px + 15 + wave, b.py + 13, b.px + 23 + wave, b.py + 15);
      ctx.moveTo(b.px + 19 - wave, b.py + 33);
      ctx.quadraticCurveTo(b.px + 26 - wave, b.py + 35, b.px + 33 - wave, b.py + 33);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function renderGameWorld(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: RenderState
) {
  const map = SCENE_MAPS[state.scene];
  const worldW = map.width * TILE_SIZE;
  const worldH = map.height * TILE_SIZE;
  const zoom = state.zoom ?? 1;
  const viewW = width / zoom;
  const viewH = height / zoom;
  const dpr = Math.max(1, ctx.getTransform().a || 1);

  const snapStep = state.shakeAmount > 0.01 ? 0 : 1 / Math.max(0.5, zoom * dpr);
  const camX = snapStep > 0 ? Math.round(state.cameraX / snapStep) * snapStep : state.cameraX;
  const camY = snapStep > 0 ? Math.round(state.cameraY / snapStep) * snapStep : state.cameraY;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = state.scene === 'HOUSE' ? '#1C140F' : '#142416';
  ctx.fillRect(0, 0, width, height);

  const shakeX = (Math.random() - 0.5) * state.shakeAmount;
  const shakeY = (Math.random() - 0.5) * state.shakeAmount;
  ctx.translate(Math.round(width / 2 + shakeX), Math.round(height / 2 + shakeY));
  ctx.scale(zoom, zoom);
  ctx.translate(-camX, -camY);

  // 1. Tiles
  const startTx = Math.max(0, Math.floor((camX - viewW / 2) / TILE_SIZE) - 1);
  const endTx = Math.min(map.width - 1, Math.ceil((camX + viewW / 2) / TILE_SIZE) + 1);
  const startTy = Math.max(0, Math.floor((camY - viewH / 2) / TILE_SIZE) - 1);
  const endTy = Math.min(map.height - 1, Math.ceil((camY + viewH / 2) / TILE_SIZE) + 1);

  for (let ty = startTy; ty <= endTy; ty++) {
    for (let tx = startTx; tx <= endTx; tx++) {
      drawTile(ctx, map.tiles[ty][tx], tx, ty, tx * TILE_SIZE, ty * TILE_SIZE, state);
    }
  }

  // 1b. Continuous world-space flowing water currents
  drawContinuousWaterCurrents(ctx, map.tiles, startTx, endTx, startTy, endTy, state);

  // Cohesive architectural & environmental exteriors/interiors
  if (state.scene === 'FARM') {
    drawFarmhouseExterior(ctx, state);
  } else if (state.scene === 'HOUSE') {
    drawHouseInteriorBase(ctx, state);
  } else if (state.scene === 'LAB') {
    drawLabBuildingExterior(ctx, state);
  } else if (state.scene === 'PEAK') {
    drawPeakHighlandsAndCave(ctx, state);
  } else if (state.scene === 'CLIFF') {
    drawRockyHillsCliffScene(ctx);
  }

  // 2. Tilled Soil Beds
  if (state.scene === 'FARM' || state.scene === 'ORCHARD') {
    for (const plot of Object.values(state.plots)) {
      if (plot.scene !== state.scene) continue;
      if (plot.tx < startTx || plot.tx > endTx || plot.ty < startTy || plot.ty > endTy) continue;
      drawSoilBed(ctx, plot, plot.tx * TILE_SIZE, plot.ty * TILE_SIZE);
    }
  }

  // 2b. Sealed Plot Banners on Kebun Atas Left & Right
  if (state.scene === 'ORCHARD') {
    const drawSealBanner = (cx: number, cy: number, title: string, subtitle: string) => {
      ctx.save();
      const boxW = 248;
      const boxH = 54;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH, 10);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#FDE047';
      ctx.fillText(title, cx, cy - 5);

      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText(subtitle, cx, cy + 14);
      ctx.restore();
    };

    if (!state.orchardLeftUnlocked) {
      drawSealBanner(
        8 * TILE_SIZE,
        11 * TILE_SIZE,
        'TERSEGEL — Lahan Kiri Jalan',
        'Min. Lv.5 · 3.500.000 EG (Beli di PC)'
      );
    }
    if (!state.orchardRightUnlocked) {
      drawSealBanner(
        20 * TILE_SIZE,
        11 * TILE_SIZE,
        'TERSEGEL — Lahan Kanan Jalan',
        'Min. Lv.5 · 3.750.000 EG (Beli di PC)'
      );
    }
  }

  // 3c. Animated River Fish with S-Curve Travelling-Wave Spine Kinematics
  if ((state.scene === 'FOREST' || state.scene === 'RIVER') && state.riverFish && state.riverFish.length > 0) {
    for (const fish of state.riverFish) {
      const fx = fish.x * TILE_SIZE;
      const fy = fish.y * TILE_SIZE;
      const phase = state.elapsedTime * 9.5 + fish.y * 2.1 + fish.x * 1.4;
      const tailBend = Math.sin(phase) * 4.5;
      const midBend = Math.sin(phase - 1.1) * 1.8;
      const nearPlayer = Math.hypot(fish.x - state.playerX, fish.y - state.playerY) <= 3.0;
      const ftx = Math.max(0, Math.min(map.width - 1, Math.floor(fish.x)));
      const fty = Math.max(0, Math.min(map.height - 1, Math.floor(fish.y)));
      const underBridge = map.tiles[fty]?.[ftx] === 'WOOD_BRIDGE';

      ctx.save();
      ctx.translate(fx, fy);

      // Water surface ripple ring around fish
      ctx.strokeStyle = nearPlayer ? 'rgba(253, 224, 71, 0.85)' : 'rgba(224, 242, 254, 0.58)';
      ctx.lineWidth = nearPlayer ? 2.0 : 1.3;
      ctx.beginPath();
      ctx.ellipse(0, 0, nearPlayer ? 22 : 16, nearPlayer ? 15 : 11, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Soft underwater refraction shadow
      ctx.fillStyle = 'rgba(8, 47, 73, 0.34)';
      ctx.beginPath();
      ctx.ellipse(2, 5, fish.kind === 'ikan_tomang' ? 15 : 10.5, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();

      const swimAngle = Math.atan2(fish.vy, fish.vx);
      ctx.rotate(swimAngle);

      const drawOrganicFish = (
        len: number,
        wid: number,
        topCol: string,
        bellyCol: string,
        finCol: string,
        eyeCol: string
      ) => {
        // Pectoral fluttering fins
        ctx.fillStyle = finCol;
        const finFlap = Math.sin(phase * 1.2) * 0.25;
        for (const side of [-1, 1]) {
          ctx.save();
          ctx.translate(len * 0.14, side * wid * 0.72);
          ctx.rotate(side * (0.65 + finFlap));
          ctx.beginPath();
          ctx.ellipse(0, side * 2.4, 3.8, 1.8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Forked caudal tail trailing the travelling sine wave
        ctx.fillStyle = finCol;
        ctx.beginPath();
        ctx.moveTo(-len * 0.72, midBend * 0.6);
        ctx.quadraticCurveTo(-len * 1.15, -wid * 0.85 + tailBend, -len * 1.35, -wid * 0.7 + tailBend);
        ctx.lineTo(-len * 1.08, tailBend * 0.7);
        ctx.lineTo(-len * 1.35, wid * 0.7 + tailBend);
        ctx.quadraticCurveTo(-len * 1.15, wid * 0.85 + tailBend, -len * 0.72, midBend * 0.6);
        ctx.closePath();
        ctx.fill();

        // Streamlined S-curved fish body
        const bodyG = ctx.createLinearGradient(0, -wid, 0, wid);
        bodyG.addColorStop(0, topCol);
        bodyG.addColorStop(0.55, bellyCol);
        bodyG.addColorStop(1, topCol);
        ctx.fillStyle = bodyG;
        ctx.beginPath();
        ctx.moveTo(len, 0);
        ctx.bezierCurveTo(len * 0.45, -wid * 1.15, -len * 0.25, -wid * 0.9 + midBend, -len * 0.82, midBend * 0.7);
        ctx.bezierCurveTo(-len * 0.25, wid * 0.9 + midBend, len * 0.45, wid * 1.15, len, 0);
        ctx.closePath();
        ctx.fill();

        // Eye
        ctx.fillStyle = eyeCol;
        ctx.beginPath();
        ctx.arc(len * 0.66, -wid * 0.34, 1.35, 0, Math.PI * 2);
        ctx.fill();
      };

      if (fish.kind === 'ikan_wader') {
        drawOrganicFish(9.5, 4.2, '#94A3B8', '#F1F5F9', '#CBD5E1', '#0F172A');
      } else if (fish.kind === 'ikan_lele') {
        drawOrganicFish(12.5, 5.4, '#1E293B', '#475569', '#0F172A', '#FDE047');
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(11, -2);
        ctx.quadraticCurveTo(14, -4, 16, -6);
        ctx.moveTo(11, 2);
        ctx.quadraticCurveTo(14, 4, 16, 6);
        ctx.stroke();
      } else {
        drawOrganicFish(15.5, 6.6, '#0F766E', '#2DD4BF', '#115E59', '#FDE047');
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (const sx of [-5, 1, 7]) {
          ctx.moveTo(sx, -4 + midBend * 0.3);
          ctx.quadraticCurveTo(sx + 1, 0, sx + 0.5, 4 + midBend * 0.3);
        }
        ctx.stroke();
      }
      ctx.restore();

      if (nearPlayer && !underBridge) {
        ctx.save();
        ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        const label =
          fish.kind === 'ikan_tomang'
            ? 'Tomang (Klik/Spasi)'
            : fish.kind === 'ikan_lele'
            ? 'Lele (Klik/Spasi)'
            : 'Wader (Klik/Spasi)';
        ctx.fillStyle = '#0F172A';
        ctx.fillText(label, fx + 1, fy - 19);
        ctx.fillStyle = fish.kind === 'ikan_tomang' ? '#FDE047' : '#E0F2FE';
        ctx.fillText(label, fx, fy - 20);
        ctx.restore();
      }
    }
  }

  // 3d. 2.5D Weathered Timber Bridge Deck Overlay
  for (let ty = startTy; ty <= endTy; ty++) {
    for (let tx = startTx; tx <= endTx; tx++) {
      if (map.tiles[ty][tx] !== 'WOOD_BRIDGE') continue;
      const px = tx * TILE_SIZE;
      const py = ty * TILE_SIZE;
      const s = TILE_SIZE;
      const isTopEdge = ty === 0 || map.tiles[ty - 1][tx] !== 'WOOD_BRIDGE';
      const isBottomEdge = ty === map.height - 1 || map.tiles[ty + 1][tx] !== 'WOOD_BRIDGE';

      if (isBottomEdge) {
        ctx.fillStyle = 'rgba(8, 47, 73, 0.38)';
        ctx.fillRect(px, py + s - 2, s, 7);
      }

      ctx.fillStyle = '#5C3A21';
      ctx.fillRect(px, py + (isTopEdge ? 2 : 0), s, s - (isTopEdge ? 2 : 0) - (isBottomEdge ? 2 : 0));

      for (let i = 0; i < 4; i++) {
        const plankX = px + i * 12 + 1;
        const plankY = py + (isTopEdge ? 4 : 0);
        const plankH = s - (isTopEdge ? 4 : 0) - (isBottomEdge ? 4 : 0);
        const pg = ctx.createLinearGradient(plankX, plankY, plankX + 10, plankY + plankH);
        pg.addColorStop(0, i % 2 === 0 ? '#D97706' : '#C26709');
        pg.addColorStop(1, '#92400E');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.roundRect(plankX, plankY, 10, plankH, 1.5);
        ctx.fill();
        ctx.fillStyle = '#451A03';
        ctx.beginPath();
        ctx.arc(plankX + 2.5, plankY + 4, 1, 0, Math.PI * 2);
        ctx.arc(plankX + 7.5, plankY + plankH - 4, 1, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#451A03';
      if (isTopEdge) {
        ctx.beginPath();
        ctx.roundRect(px, py + 1, s, 4.5, 1.5);
        ctx.fill();
      }
      if (isBottomEdge) {
        ctx.beginPath();
        ctx.roundRect(px, py + s - 5.5, s, 4.5, 1.5);
        ctx.fill();
      }
    }
  }

  // 3. Hovered / Target Tile Highlight
  if (state.hoveredTile && state.scene !== 'HOUSE') {
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(
      state.hoveredTile.tx * TILE_SIZE + 2,
      state.hoveredTile.ty * TILE_SIZE + 2,
      TILE_SIZE - 4,
      TILE_SIZE - 4,
      5
    );
    ctx.stroke();
  }

  // 3b. Click-to-move destination marker
  if (state.moveTarget) {
    const mx = state.moveTarget.x * TILE_SIZE;
    const my = state.moveTarget.y * TILE_SIZE;
    const pulse = 1 + Math.sin(state.elapsedTime * 8) * 0.14;
    ctx.save();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(mx, my, 12 * pulse, 7 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
    ctx.fill();
    ctx.restore();
  }

  // 4. Unified Painter's-Order Depth Sorting
  const visLeft = camX - viewW / 2 - TILE_SIZE * 4;
  const visRight = camX + viewW / 2 + TILE_SIZE * 4;
  const visTop = camY - viewH / 2 - TILE_SIZE * 4;
  const visBottom = camY + viewH / 2 + TILE_SIZE * 6;
  const sceneObjs = state.worldObjects.filter((o) => {
    if (o.scene !== state.scene) return false;
    const ox = (o.tx + 0.5) * TILE_SIZE;
    const oy = (o.ty + 0.5) * TILE_SIZE;
    return ox >= visLeft && ox <= visRight && oy >= visTop && oy <= visBottom;
  });
  const playerScreenX = state.playerX * TILE_SIZE;
  const playerScreenY = state.playerY * TILE_SIZE;

  const depthQueue: Array<{ sortY: number; order: number; draw: () => void }> = [];

  for (const o of sceneObjs) {
    const baseOffset =
      o.kind === 'TREE' || o.kind === 'FRUIT_TREE'
        ? 0.90
        : o.kind === 'ROCK'
        ? 0.78
        : 0.66;
    depthQueue.push({
      sortY: (o.ty + baseOffset) * TILE_SIZE,
      order: o.tx,
      draw: () => drawLushTreeOrObject(ctx, o, state.elapsedTime),
    });
  }

  if (state.scene === 'FARM' || state.scene === 'ORCHARD') {
    for (const plot of Object.values(state.plots)) {
      if (plot.scene !== state.scene || !plot.tilled || !plot.cropId) continue;
      if (plot.tx < startTx - 1 || plot.tx > endTx + 1 || plot.ty < startTy - 1 || plot.ty > endTy + 1) continue;
      depthQueue.push({
        sortY: (plot.ty + 0.62) * TILE_SIZE,
        order: plot.tx,
        draw: () =>
          drawCropFoliage(ctx, plot, plot.tx * TILE_SIZE, plot.ty * TILE_SIZE, state.elapsedTime),
      });
    }
  }

  if (state.scene === 'HOUSE') {
    depthQueue.push({
      sortY: playerScreenY - 0.1,
      order: -1,
      draw: () => drawHouseDepthFurniture(ctx, state, 'BEHIND_PLAYER'),
    });
    depthQueue.push({
      sortY: playerScreenY + 3.2,
      order: 9999,
      draw: () => drawHouseDepthFurniture(ctx, state, 'IN_FRONT_OF_PLAYER'),
    });
  }

  const robot = state.robot;
  if (robot) {
    depthQueue.push({
      sortY: robot.y * TILE_SIZE + 5,
      order: Math.round(robot.x * 10),
      draw: () => drawBrownRobot(ctx, robot),
    });
  }

  depthQueue.push({
    sortY: playerScreenY + 3,
    order: Math.round(state.playerX * 10),
    draw: () =>
      drawFarmerCharacter(ctx, {
        x: playerScreenX,
        y: playerScreenY,
        facingDir: state.facingDir,
        walkCycle: state.walkCycle,
        isMoving: state.isMoving,
        actionKind: state.actionKind,
        actionProgress: state.actionProgress,
        isBathing: state.isBathing,
        isWading: state.isWading,
        selectedItemId: state.selectedItemId,
        hasSteelHoe: state.hasSteelHoe,
        hasBigWateringCan: state.hasBigWateringCan,
        elapsedTime: state.elapsedTime,
      }),
  });

  depthQueue.sort((a, b) => a.sortY - b.sortY || a.order - b.order);
  for (const item of depthQueue) {
    item.draw();
  }

  // 4b. Combat Energy Projectiles
  if (state.projectiles) {
    for (const proj of state.projectiles) {
      drawCombatProjectile(ctx, proj);
    }
  }

  // 5. Physics-Styled Natural Particles
  for (const p of state.particles) {
    const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.save();
    ctx.globalAlpha = alpha;
    if (p.kind === 'TEXT' && p.text) {
      ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0F172A';
      ctx.fillText(p.text, p.x + 1, p.y + 1);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    } else if (p.kind === 'FIREFLY') {
      const pulse = 0.75 + Math.sin(state.elapsedTime * 7 + p.x) * 0.25;
      const fg = ctx.createRadialGradient(p.x, p.y, 0.5, p.x, p.y, p.size * 3.4);
      fg.addColorStop(0, '#FFFFFF');
      fg.addColorStop(0.35, p.color);
      fg.addColorStop(1, 'rgba(190, 242, 100, 0)');
      ctx.globalAlpha = alpha * pulse;
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'WATER') {
      ctx.translate(p.x, p.y);
      const ang = Math.atan2(p.vy, p.vx);
      ctx.rotate(ang);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * 1.45, p.size * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(p.size * 0.35, -p.size * 0.15, p.size * 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'LEAF') {
      ctx.translate(p.x, p.y);
      ctx.rotate(state.elapsedTime * 3.5 + p.x * 0.05);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(-p.size * 1.4, 0);
      ctx.quadraticCurveTo(0, -p.size * 0.95, p.size * 1.4, 0);
      ctx.quadraticCurveTo(0, p.size * 0.95, -p.size * 1.4, 0);
      ctx.fill();
    } else if (p.kind === 'SPARKLE') {
      ctx.translate(p.x, p.y);
      ctx.rotate(state.elapsedTime * 4 + p.x * 0.1);
      ctx.fillStyle = p.color;
      const r = p.size * 1.65;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.quadraticCurveTo(0, 0, 0, r);
      ctx.quadraticCurveTo(0, 0, -r, 0);
      ctx.quadraticCurveTo(0, 0, 0, -r);
      ctx.fill();
    } else {
      // DUST: soft expanding radial puff
      const r = p.size * (1.5 - alpha * 0.5);
      const dg = ctx.createRadialGradient(p.x, p.y, 0.4, p.x, p.y, r);
      dg.addColorStop(0, p.color);
      dg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 6. Outdoor Weather & Day/Night Lighting
  if (state.scene !== 'HOUSE') {
    const { overlay, nightAlpha } = getSkyColorForTime(state.timeMinutes, state.weather);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, worldW, worldH);
    ctx.clip();

    if (state.weather === 'GERIMIS' || state.weather === 'HUJAN_DERAS') {
      const isHeavy = state.weather === 'HUJAN_DERAS';
      const cellSize = 160;
      const dropsPerCell = isHeavy ? 11 : 4;
      const rainMinX = Math.max(0, Math.floor((camX - viewW / 2 - 40) / cellSize));
      const rainMaxX = Math.min(Math.ceil(worldW / cellSize), Math.ceil((camX + viewW / 2 + 40) / cellSize));
      const rainMinY = Math.max(0, Math.floor((camY - viewH / 2 - 40) / cellSize));
      const rainMaxY = Math.min(Math.ceil(worldH / cellSize), Math.ceil((camY + viewH / 2 + 40) / cellSize));

      const windVx = isHeavy ? -190 : -110;
      const fallVy = isHeavy ? 760 : 540;
      const streakDx = isHeavy ? -6.5 : -4.2;
      const streakDy = isHeavy ? 22 : 14;

      ctx.strokeStyle = isHeavy ? 'rgba(186, 230, 253, 0.56)' : 'rgba(224, 242, 254, 0.42)';
      ctx.lineWidth = (isHeavy ? 1.55 : 1.1) / Math.pow(zoom, 0.35);
      ctx.lineCap = 'round';
      ctx.beginPath();

      for (let cy = rainMinY; cy <= rainMaxY; cy++) {
        for (let cx = rainMinX; cx <= rainMaxX; cx++) {
          for (let i = 0; i < dropsPerCell; i++) {
            const h = Math.abs((cx * 73856093) ^ (cy * 19349663) ^ (i * 83492791));
            const ox = (((h % cellSize) + state.elapsedTime * windVx) % cellSize + cellSize) % cellSize;
            const oy = ((((h >> 8) % cellSize) + state.elapsedTime * fallVy) % cellSize + cellSize) % cellSize;
            const rx = cx * cellSize + ox;
            const ry = cy * cellSize + oy;
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx + streakDx, ry + streakDy);
          }
        }
      }
      ctx.stroke();

      const splashCount = isHeavy ? 2 : 1;
      ctx.lineWidth = 1.1 / Math.pow(zoom, 0.35);
      for (let cy = rainMinY; cy <= rainMaxY; cy++) {
        for (let cx = rainMinX; cx <= rainMaxX; cx++) {
          for (let i = 0; i < splashCount; i++) {
            const h = Math.abs((cx * 49979687) ^ (cy * 67867967) ^ (i * 15485863));
            const phase = (state.elapsedTime * (isHeavy ? 2.4 : 1.6) + (h % 100) / 100) % 1;
            const sx = cx * cellSize + (h % cellSize);
            const sy = cy * cellSize + ((h >> 7) % cellSize);
            const r = 2 + phase * (isHeavy ? 6.5 : 4.5);
            ctx.strokeStyle = `rgba(224, 242, 254, ${(1 - phase) * (isHeavy ? 0.36 : 0.24)})`;
            ctx.beginPath();
            ctx.ellipse(sx, sy, r, r * 0.45, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    }

    ctx.fillStyle = SEASONS[state.season].tintHex;
    ctx.fillRect(0, 0, worldW, worldH);

    if (overlay !== 'rgba(0,0,0,0)') {
      ctx.fillStyle = overlay;
      ctx.fillRect(0, 0, worldW, worldH);
    }

    if (nightAlpha > 0.01) {
      ctx.fillStyle = `rgba(9, 17, 34, ${nightAlpha})`;
      ctx.fillRect(0, 0, worldW, worldH);

      const grad = ctx.createRadialGradient(
        playerScreenX,
        playerScreenY - 24,
        14,
        playerScreenX,
        playerScreenY - 24,
        150
      );
      grad.addColorStop(0, 'rgba(253, 224, 71, 0.24)');
      grad.addColorStop(1, 'rgba(253, 224, 71, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(playerScreenX, playerScreenY - 24, 150, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  ctx.restore();
}
