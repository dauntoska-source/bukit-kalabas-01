import { TILE_SIZE } from './maps';
import { RenderState } from './renderer';
import {
  getCachedCabinetSprite,
  getCachedFridgeSprite,
  preloadCabinetSprite,
  preloadFridgeSprite,
} from '../utils/spriteLoader';

function getWindowSkyPalette(timeMinutes: number) {
  if (timeMinutes < 450) {
    return { sky: '#FDBA74', skyDeep: '#FB923C', glow: 'rgba(253, 186, 116, 0.16)', isNight: false };
  }
  if (timeMinutes < 1000) {
    return { sky: '#BAE6FD', skyDeep: '#38BDF8', glow: 'rgba(254, 249, 195, 0.15)', isNight: false };
  }
  if (timeMinutes < 1120) {
    return { sky: '#FDBA74', skyDeep: '#EA580C', glow: 'rgba(251, 146, 60, 0.16)', isNight: false };
  }
  return { sky: '#0F172A', skyDeep: '#020617', glow: 'rgba(253, 224, 71, 0)', isNight: true };
}

function getBreeze(wx: number, t: number): number {
  return Math.sin(t * 1.4 + wx * 0.025) * 1.8 + Math.cos(t * 2.9 + wx * 0.05) * 0.65;
}

function drawOrganicFoliageCluster(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  sway: number,
  darkTone: string,
  midTone: string,
  lightTone: string
) {
  ctx.save();
  ctx.translate(cx, cy);
  const lobes = [
    [-rx * 0.48, ry * 0.08, rx * 0.56, ry * 0.62, -0.25],
    [rx * 0.48, ry * 0.1, rx * 0.54, ry * 0.6, 0.25],
    [sway * 0.45, -ry * 0.18, rx * 0.66, ry * 0.72, 0],
  ];
  for (const [lx, ly, lrx, lry, rot] of lobes) {
    const g = ctx.createRadialGradient(lx - lrx * 0.3, ly - lry * 0.35, 1, lx, ly, Math.max(lrx, lry));
    g.addColorStop(0, lightTone);
    g.addColorStop(0.55, midTone);
    g.addColorStop(1, darkTone);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(lx, ly, lrx, lry, rot, 0, Math.PI * 2);
    ctx.fill();
  }
  // Delicate outer leaf tips
  ctx.fillStyle = lightTone;
  for (let i = -2; i <= 2; i++) {
    const ang = -Math.PI / 2 + i * 0.42 + sway * 0.05;
    const tipX = Math.cos(ang) * rx * 0.82 + sway * 0.3;
    const tipY = Math.sin(ang) * ry * 0.85;
    ctx.save();
    ctx.translate(tipX, tipY);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(3.5, -2.6, 7, 0);
    ctx.quadraticCurveTo(3.5, 2.6, 0, 0);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawBlossom(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, petalCol: string, centerCol = '#FDE047') {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = petalCol;
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.55, r * 0.36, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = centerCol;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRiverStoneCourse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  baseHex: string,
  lightHex: string,
  darkHex: string
) {
  ctx.save();
  // Mortar bed
  ctx.fillStyle = darkHex;
  ctx.fillRect(x, y, w, h);

  const rowH = h * 0.52;
  for (let row = 0; row < 2; row++) {
    let curX = x + (row === 1 ? -6 : 0);
    let idx = 0;
    while (curX < x + w - 2) {
      const sw = 15 + ((idx * 13 + row * 7) % 10);
      const drawW = Math.min(sw, x + w - curX - 1.5);
      const ry = y + row * (h * 0.48) + 1;
      const rh = rowH - 2;
      if (drawW > 5) {
        const sg = ctx.createLinearGradient(curX, ry, curX, ry + rh);
        sg.addColorStop(0, lightHex);
        sg.addColorStop(0.5, baseHex);
        sg.addColorStop(1, darkHex);
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.roundRect(Math.max(x + 1, curX), ry, drawW, rh, 3.2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(Math.max(x + 2, curX + 2), ry + 1.2);
        ctx.lineTo(Math.max(x + 2, curX + drawW - 2), ry + 1.2);
        ctx.stroke();
      }
      curX += sw + 2;
      idx++;
    }
  }
  ctx.restore();
}

function drawCreepingIvy(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  ctrlX: number,
  ctrlY: number,
  sway: number
) {
  ctx.save();
  ctx.strokeStyle = '#365314';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.quadraticCurveTo(ctrlX + sway * 0.4, ctrlY, endX + sway * 0.7, endY);
  ctx.stroke();

  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    const t = i / (steps + 1);
    const inv = 1 - t;
    const lx = inv * inv * startX + 2 * inv * t * (ctrlX + sway * 0.4) + t * t * (endX + sway * 0.7);
    const ly = inv * inv * startY + 2 * inv * t * ctrlY + t * t * endY;
    const side = i % 2 === 0 ? 1 : -1;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(side * 0.7 + sway * 0.04);
    ctx.fillStyle = i % 3 === 0 ? '#65A30D' : '#4D7C0F';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(3.5, -3, 7, 0);
    ctx.quadraticCurveTo(3.5, 3, 0, 0);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawVolumetricSmoke(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  elapsedTime: number,
  puffCount: number,
  riseHeight: number,
  baseRadius: number,
  tint = '241, 245, 249'
) {
  const windDir = 10 + Math.sin(elapsedTime * 0.7) * 5;
  for (let i = 0; i < puffCount; i++) {
    const prog = (elapsedTime * 0.34 + i / puffCount) % 1;
    const curl = Math.sin(prog * 6.5 + i * 1.9 + elapsedTime * 1.4) * (4 + prog * 9);
    const px = originX + prog * windDir + curl;
    const py = originY - prog * riseHeight;
    const r = baseRadius + prog * baseRadius * 1.75;
    const alpha = Math.sin(prog * Math.PI) * 0.38;
    const g = ctx.createRadialGradient(px - r * 0.25, py - r * 0.25, r * 0.1, px, py, r);
    g.addColorStop(0, `rgba(${tint}, ${alpha})`);
    g.addColorStop(0.65, `rgba(${tint}, ${alpha * 0.52})`);
    g.addColorStop(1, `rgba(${tint}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Renders the cohesive Indonesian Farmhouse Exterior on the FARM map
 * occupying collision footprint tx: 3..8, ty: 2..5 (door at tx=5, ty=5).
 */
export function drawFarmhouseExterior(ctx: CanvasRenderingContext2D, state: RenderState) {
  const s = TILE_SIZE;
  const x0 = 3 * s; // 144
  const y0 = 2 * s; // 96
  const w = 6 * s; // 288
  const h = 4 * s; // 192
  const isDark = state.timeMinutes >= 1020;
  const t = state.elapsedTime;
  const breeze = getBreeze(x0, t);

  ctx.save();

  // 1. Directional ground shadow (cast bottom-right from top-left sunlight)
  const ambGrad = ctx.createRadialGradient(x0 + w * 0.52, y0 + h - 4, w * 0.12, x0 + w * 0.52, y0 + h, w * 0.62);
  ambGrad.addColorStop(0, 'rgba(15, 23, 42, 0.36)');
  ambGrad.addColorStop(0.75, 'rgba(15, 23, 42, 0.18)');
  ambGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = ambGrad;
  ctx.beginPath();
  ctx.ellipse(x0 + w * 0.52, y0 + h + 2, w * 0.58, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Beveled Timber Front Porch Step & Braided Coir Doormat (tx=5, ty=5)
  const doorX = 5 * s;
  const doorBaseY = 6 * s;
  // Step shadow
  ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
  ctx.beginPath();
  ctx.roundRect(doorX - 10, doorBaseY + 3, s + 24, 11, 4);
  ctx.fill();

  // Timber tread & dark front riser for 2.5D thickness
  ctx.fillStyle = '#4A2812';
  ctx.beginPath();
  ctx.roundRect(doorX - 10, doorBaseY + 1, s + 20, 11, 3);
  ctx.fill();
  const stepGrad = ctx.createLinearGradient(0, doorBaseY - 5, 0, doorBaseY + 6);
  stepGrad.addColorStop(0, '#A16236');
  stepGrad.addColorStop(1, '#783F1A');
  ctx.fillStyle = stepGrad;
  ctx.beginPath();
  ctx.roundRect(doorX - 10, doorBaseY - 5, s + 20, 11, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(254, 243, 199, 0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(doorX - 7, doorBaseY - 3.5);
  ctx.lineTo(doorX + s + 7, doorBaseY - 3.5);
  ctx.stroke();

  // Braided Coir Doormat
  const matGrad = ctx.createLinearGradient(doorX + 6, doorBaseY - 2, doorX + s - 6, doorBaseY + 6);
  matGrad.addColorStop(0, '#D97706');
  matGrad.addColorStop(1, '#92400E');
  ctx.fillStyle = matGrad;
  ctx.beginPath();
  ctx.roundRect(doorX + 6, doorBaseY - 2, s - 12, 8, 2.5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.55)';
  ctx.lineWidth = 0.9;
  ctx.strokeRect(doorX + 8.5, doorBaseY, s - 17, 4);

  // 3. Main Farmhouse Walls (ty=4..5)
  const wallY = 4 * s;
  const wallH = 2 * s;
  const wallGrad = ctx.createLinearGradient(x0, wallY, x0 + w, wallY + wallH);
  wallGrad.addColorStop(0, '#FBF4E4');
  wallGrad.addColorStop(0.55, '#EFE3CB');
  wallGrad.addColorStop(1, '#DFD0B2');
  ctx.fillStyle = wallGrad;
  ctx.beginPath();
  ctx.roundRect(x0 + 2, wallY, w - 4, wallH, [0, 0, 3, 3]);
  ctx.fill();

  // Subtle horizontal plaster weathering streaks
  ctx.fillStyle = 'rgba(146, 114, 72, 0.08)';
  ctx.fillRect(x0 + 18, wallY + 28, 36, 4);
  ctx.fillRect(x0 + w - 66, wallY + 54, 42, 3);

  // Natural River-Stone Masonry Foundation
  drawRiverStoneCourse(ctx, x0 + 2, wallY + wallH - 16, w - 4, 16, '#878077', '#A8A29E', '#44403C');

  // Chamfered Dark Teak Framing Posts (Soko Guru) with wood highlight & cast shadow
  const beamXs = [x0, x0 + w - 10, doorX - 8, doorX + s + 2];
  for (const bx of beamXs) {
    ctx.fillStyle = 'rgba(20, 12, 6, 0.22)';
    ctx.fillRect(bx + 8, wallY + 6, 4, wallH - 6);
    const beamGrad = ctx.createLinearGradient(bx, 0, bx + 9, 0);
    beamGrad.addColorStop(0, '#7C4D2B');
    beamGrad.addColorStop(0.45, '#5C3A21');
    beamGrad.addColorStop(1, '#3B1E0D');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(bx, wallY - 3, 9, wallH + 3);
  }
  // Horizontal beveled timber belt beam + carved corbel brackets
  const midGrad = ctx.createLinearGradient(0, wallY + 42, 0, wallY + 49);
  midGrad.addColorStop(0, '#784A28');
  midGrad.addColorStop(1, '#3B1E0D');
  ctx.fillStyle = midGrad;
  ctx.fillRect(x0, wallY + 42, w, 7);

  // 4. Recessed Carved Front Door (tx=5, ty=5)
  ctx.fillStyle = '#2B170A';
  ctx.beginPath();
  ctx.roundRect(doorX + 2, doorBaseY - 48, s - 4, 48, [4, 4, 0, 0]);
  ctx.fill();

  const doorWood = ctx.createLinearGradient(doorX + 6, 0, doorX + s - 6, 0);
  doorWood.addColorStop(0, '#B45309');
  doorWood.addColorStop(0.5, '#92400E');
  doorWood.addColorStop(1, '#682C09');
  ctx.fillStyle = doorWood;
  ctx.beginPath();
  ctx.roundRect(doorX + 5, doorBaseY - 44, s - 10, 44, [3, 3, 0, 0]);
  ctx.fill();

  // Door glass pane with sunlit sky/cozy interior reflection
  const sky = getWindowSkyPalette(state.timeMinutes);
  const glassGrad = ctx.createLinearGradient(doorX + 12, doorBaseY - 38, doorX + s - 12, doorBaseY - 24);
  glassGrad.addColorStop(0, isDark ? '#FEF08A' : sky.sky);
  glassGrad.addColorStop(1, isDark ? '#F59E0B' : sky.skyDeep);
  ctx.fillStyle = glassGrad;
  ctx.beginPath();
  ctx.roundRect(doorX + 11, doorBaseY - 38, s - 22, 14, 2.5);
  ctx.fill();
  ctx.strokeStyle = '#451A03';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Carved lower door panel + brass handle
  ctx.fillStyle = '#78350F';
  ctx.beginPath();
  ctx.roundRect(doorX + 10, doorBaseY - 20, s - 20, 15, 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(doorX + 12, doorBaseY - 18, s - 24, 11);

  const knobGrad = ctx.createRadialGradient(doorX + s - 13.5, doorBaseY - 21.5, 0.5, doorX + s - 13, doorBaseY - 21, 3.2);
  knobGrad.addColorStop(0, '#FEF08A');
  knobGrad.addColorStop(1, '#B45309');
  ctx.fillStyle = knobGrad;
  ctx.beginPath();
  ctx.arc(doorX + s - 13, doorBaseY - 21, 3, 0, Math.PI * 2);
  ctx.fill();

  // Warm Hanging Wrought-Iron Porch Lantern
  const lanternX = doorX + s + 11;
  const lanternY = doorBaseY - 35;
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(lanternX - 8, lanternY - 6);
  ctx.quadraticCurveTo(lanternX, lanternY - 10, lanternX, lanternY - 2);
  ctx.stroke();

  const lanGrad = ctx.createRadialGradient(lanternX - 1, lanternY + 4, 1, lanternX, lanternY + 4, 7);
  lanGrad.addColorStop(0, '#FFFFFF');
  lanGrad.addColorStop(0.5, isDark ? '#FDE047' : '#FEF3C7');
  lanGrad.addColorStop(1, '#D97706');
  ctx.fillStyle = lanGrad;
  ctx.beginPath();
  ctx.roundRect(lanternX - 4.5, lanternY, 9, 11, 2.5);
  ctx.fill();
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  if (isDark) {
    const flicker = 0.44 + Math.sin(t * 7.5) * 0.05;
    const glow = ctx.createRadialGradient(lanternX, lanternY + 5, 4, lanternX, lanternY + 5, 58);
    glow.addColorStop(0, `rgba(253, 224, 71, ${flicker})`);
    glow.addColorStop(0.5, 'rgba(251, 146, 60, 0.16)');
    glow.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(lanternX, lanternY + 5, 58, 0, Math.PI * 2);
    ctx.fill();
  }

  // 5. Louvered Nusantara Windows + Beveled Flower Boxes
  const drawExteriorWindow = (wx: number, wy: number) => {
    const winBreeze = getBreeze(wx, t);
    // Cast shutter shadows onto plaster
    ctx.fillStyle = 'rgba(28, 25, 23, 0.18)';
    ctx.fillRect(wx - 7, wy + 2, 10, 29);
    ctx.fillRect(wx + 31, wy + 2, 10, 29);

    // Louvered green wooden shutters
    for (const sx of [wx - 9, wx + 31]) {
      const shGrad = ctx.createLinearGradient(sx, wy, sx + 8, wy + 28);
      shGrad.addColorStop(0, '#22C55E');
      shGrad.addColorStop(1, '#14532D');
      ctx.fillStyle = shGrad;
      ctx.beginPath();
      ctx.roundRect(sx, wy, 8, 28, 1.5);
      ctx.fill();
      ctx.strokeStyle = '#052E16';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(20, 83, 45, 0.75)';
      ctx.beginPath();
      for (let ly = wy + 5; ly < wy + 26; ly += 4.5) {
        ctx.moveTo(sx + 1.5, ly);
        ctx.lineTo(sx + 6.5, ly + 1);
      }
      ctx.stroke();
    }

    // Recessed window glass
    const paneGrad = ctx.createLinearGradient(wx, wy, wx + 30, wy + 28);
    paneGrad.addColorStop(0, isDark ? '#FDE047' : sky.sky);
    paneGrad.addColorStop(1, isDark ? '#EA580C' : sky.skyDeep);
    ctx.fillStyle = paneGrad;
    ctx.fillRect(wx, wy, 30, 28);
    if (!isDark) {
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      ctx.beginPath();
      ctx.moveTo(wx + 4, wy + 24);
      ctx.lineTo(wx + 17, wy + 4);
      ctx.lineTo(wx + 23, wy + 4);
      ctx.lineTo(wx + 10, wy + 24);
      ctx.fill();
    }
    ctx.strokeStyle = '#4A2C18';
    ctx.lineWidth = 2.4;
    ctx.strokeRect(wx, wy, 30, 28);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(wx + 15, wy);
    ctx.lineTo(wx + 15, wy + 28);
    ctx.moveTo(wx, wy + 14);
    ctx.lineTo(wx + 30, wy + 14);
    ctx.stroke();

    // Wooden flower box with 2.5D bevel & swaying blossoms
    const boxGrad = ctx.createLinearGradient(0, wy + 28, 0, wy + 38);
    boxGrad.addColorStop(0, '#92400E');
    boxGrad.addColorStop(1, '#451A03');
    ctx.fillStyle = boxGrad;
    ctx.beginPath();
    ctx.roundRect(wx - 3, wy + 28, 36, 9.5, 2);
    ctx.fill();
    drawOrganicFoliageCluster(ctx, wx + 15, wy + 26, 17, 7, winBreeze * 0.5, '#14532D', '#16A34A', '#4ADE80');
    drawBlossom(ctx, wx + 6 + winBreeze * 0.3, wy + 24, 3.3, '#FB7185');
    drawBlossom(ctx, wx + 15 + winBreeze * 0.35, wy + 22, 3.6, '#FACC15', '#EA580C');
    drawBlossom(ctx, wx + 24 + winBreeze * 0.3, wy + 25, 3.2, '#F43F5E');
  };

  drawExteriorWindow(4 * s + 7, wallY + 26);
  drawExteriorWindow(7 * s + 9, wallY + 26);

  // Sculpted 2.5D Terracotta Yard Pots beside porch
  const drawYardPot = (px: number, py: number) => {
    const potBreeze = getBreeze(px, t);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
    ctx.beginPath();
    ctx.ellipse(px + 2, py + 2, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const potGrad = ctx.createLinearGradient(px - 8, py - 9, px + 8, py + 2);
    potGrad.addColorStop(0, '#EA580C');
    potGrad.addColorStop(0.55, '#B45309');
    potGrad.addColorStop(1, '#7C2D12');
    ctx.fillStyle = potGrad;
    ctx.beginPath();
    ctx.moveTo(px - 8, py - 9);
    ctx.lineTo(px + 8, py - 9);
    ctx.lineTo(px + 6, py + 2);
    ctx.lineTo(px - 6, py + 2);
    ctx.closePath();
    ctx.fill();
    // Pot rim lip
    ctx.fillStyle = '#C2410C';
    ctx.beginPath();
    ctx.roundRect(px - 9.5, py - 11.5, 19, 4, 2);
    ctx.fill();

    drawOrganicFoliageCluster(ctx, px, py - 16, 12, 9, potBreeze * 0.65, '#14532D', '#15803D', '#4ADE80');
    drawBlossom(ctx, px - 4 + potBreeze * 0.35, py - 18, 3, '#FB7185');
    drawBlossom(ctx, px + 4 + potBreeze * 0.4, py - 15, 2.8, '#FDE047', '#EA580C');
  };
  drawYardPot(x0 + 18, doorBaseY - 2);
  drawYardPot(x0 + w - 18, doorBaseY - 2);

  // 6. Brick Chimney & Volumetric Wind-Drifted Smoke
  const chimX = 7.55 * s;
  const chimY = y0 - 20;
  const chimGrad = ctx.createLinearGradient(chimX, chimY, chimX + 24, chimY);
  chimGrad.addColorStop(0, '#B91C1C');
  chimGrad.addColorStop(0.65, '#991B1B');
  chimGrad.addColorStop(1, '#450A0A');
  ctx.fillStyle = chimGrad;
  ctx.beginPath();
  ctx.roundRect(chimX, chimY, 24, 40, 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(254, 202, 202, 0.2)';
  ctx.lineWidth = 1;
  for (let by = chimY + 8; by < chimY + 34; by += 8) {
    ctx.beginPath();
    ctx.moveTo(chimX + 2, by);
    ctx.lineTo(chimX + 22, by);
    ctx.stroke();
  }
  ctx.fillStyle = '#7F1D1D';
  ctx.beginPath();
  ctx.roundRect(chimX - 3, chimY - 4, 30, 7, 2);
  ctx.fill();

  drawVolumetricSmoke(ctx, chimX + 12, chimY - 6, t, 5, 42, 6);

  // 7. Pitched 2.5D Terracotta Genteng Roof
  const roofLeft = x0 - 12;
  const roofRight = x0 + w + 12;
  const roofTop = y0 - 14;
  const roofBottom = wallY + 8;

  // Deep under-eave soffit shadow
  const eaveShadow = ctx.createLinearGradient(0, wallY, 0, wallY + 14);
  eaveShadow.addColorStop(0, 'rgba(15, 10, 6, 0.42)');
  eaveShadow.addColorStop(1, 'rgba(15, 10, 6, 0)');
  ctx.fillStyle = eaveShadow;
  ctx.fillRect(x0 + 1, wallY, w - 2, 14);

  // Main angled roof body with top-left sunlit warmth
  const roofGrad = ctx.createLinearGradient(roofLeft, roofTop, roofRight, roofBottom);
  roofGrad.addColorStop(0, '#EA580C');
  roofGrad.addColorStop(0.45, '#C2410C');
  roofGrad.addColorStop(1, '#7C2D12');
  ctx.fillStyle = roofGrad;
  ctx.beginPath();
  ctx.moveTo(roofLeft + 26, roofTop);
  ctx.lineTo(roofRight - 26, roofTop);
  ctx.lineTo(roofRight, roofBottom);
  ctx.lineTo(roofLeft, roofBottom);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#431407';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Overlapping 2.5D curved terracotta genteng kodok shingle rows
  for (let row = 0; row < 6; row++) {
    const ry = roofTop + 14 + row * 15;
    if (ry >= roofBottom - 5) break;
    const progress = (ry - roofTop) / (roofBottom - roofTop);
    const rowLeft = roofLeft + (1 - progress) * 24 + 4;
    const rowRight = roofRight - (1 - progress) * 24 - 4;

    // Shadow crevice under each shingle course
    ctx.strokeStyle = 'rgba(67, 20, 7, 0.55)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let rx = rowLeft; rx < rowRight - 8; rx += 16) {
      ctx.moveTo(rx, ry);
      ctx.quadraticCurveTo(rx + 8, ry + 7.5, rx + 16, ry);
    }
    ctx.stroke();

    // Sunlit terracotta highlight rim
    ctx.strokeStyle = 'rgba(254, 215, 170, 0.34)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let rx = rowLeft; rx < rowRight - 8; rx += 16) {
      ctx.moveTo(rx + 2, ry - 2);
      ctx.quadraticCurveTo(rx + 8, ry + 3, rx + 14, ry - 2);
    }
    ctx.stroke();
  }

  // Sculpted Ridge Cap (Wuwungan) with terracotta crest highlights
  const ridgeGrad = ctx.createLinearGradient(0, roofTop - 5, 0, roofTop + 6);
  ridgeGrad.addColorStop(0, '#C2410C');
  ridgeGrad.addColorStop(0.5, '#9A3412');
  ridgeGrad.addColorStop(1, '#431407');
  ctx.fillStyle = ridgeGrad;
  ctx.beginPath();
  ctx.roundRect(roofLeft + 22, roofTop - 4, roofRight - roofLeft - 44, 10, 4);
  ctx.fill();

  // Front Porch Gable Dormer over entrance
  const gableCx = doorX + s / 2;
  ctx.fillStyle = 'rgba(20, 10, 4, 0.26)';
  ctx.beginPath();
  ctx.moveTo(gableCx + 3, roofTop + 21);
  ctx.lineTo(gableCx + 52, wallY + 15);
  ctx.lineTo(gableCx - 45, wallY + 15);
  ctx.closePath();
  ctx.fill();

  const gableGrad = ctx.createLinearGradient(gableCx - 48, roofTop + 18, gableCx + 48, wallY + 12);
  gableGrad.addColorStop(0, '#EA580C');
  gableGrad.addColorStop(1, '#9A3412');
  ctx.fillStyle = gableGrad;
  ctx.beginPath();
  ctx.moveTo(gableCx, roofTop + 18);
  ctx.lineTo(gableCx + 48, wallY + 12);
  ctx.lineTo(gableCx - 48, wallY + 12);
  ctx.closePath();
  ctx.fill();

  // Cream plaster inlay + wooden carved fascia trim
  ctx.fillStyle = '#F5ECD7';
  ctx.beginPath();
  ctx.moveTo(gableCx, roofTop + 30);
  ctx.lineTo(gableCx + 34, wallY + 10);
  ctx.lineTo(gableCx - 34, wallY + 10);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#5C3A21';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(gableCx - 48, wallY + 12);
  ctx.lineTo(gableCx, roofTop + 18);
  ctx.lineTo(gableCx + 48, wallY + 12);
  ctx.stroke();

  // Turned Javanese Crown Finial (Mahkota)
  const finGrad = ctx.createRadialGradient(gableCx - 1.5, roofTop + 14.5, 1, gableCx, roofTop + 16, 5.5);
  finGrad.addColorStop(0, '#FEF08A');
  finGrad.addColorStop(0.5, '#D97706');
  finGrad.addColorStop(1, '#78350F');
  ctx.fillStyle = finGrad;
  ctx.beginPath();
  ctx.arc(gableCx, roofTop + 16, 4.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Renders the Research Laboratory Building Exterior on the LAB map
 * occupying collision footprint tx: 11..16, ty: 3..6 — weathered botanical station.
 */
export function drawLabBuildingExterior(ctx: CanvasRenderingContext2D, state: RenderState) {
  const s = TILE_SIZE;
  const x0 = 11 * s;
  const y0 = 3 * s;
  const w = 6 * s; // 288
  const h = 4 * s; // 192
  const isDark = state.timeMinutes >= 1020;
  const t = state.elapsedTime;
  const breeze = getBreeze(x0, t);

  ctx.save();

  // 1. Directional ground shadow & stone lab threshold
  const ambGrad = ctx.createRadialGradient(x0 + w * 0.52, y0 + h - 4, w * 0.14, x0 + w * 0.52, y0 + h, w * 0.62);
  ambGrad.addColorStop(0, 'rgba(15, 23, 42, 0.4)');
  ambGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = ambGrad;
  ctx.beginPath();
  ctx.ellipse(x0 + w * 0.52, y0 + h + 2, w * 0.58, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  const doorX = 13.5 * s;
  const doorBaseY = 7 * s;
  ctx.fillStyle = '#292524';
  ctx.beginPath();
  ctx.roundRect(doorX - s / 2 - 10, doorBaseY + 1, s + 20, 11, 3);
  ctx.fill();
  const stepGrad = ctx.createLinearGradient(0, doorBaseY - 4, 0, doorBaseY + 6);
  stepGrad.addColorStop(0, '#78716C');
  stepGrad.addColorStop(1, '#44403C');
  ctx.fillStyle = stepGrad;
  ctx.beginPath();
  ctx.roundRect(doorX - s / 2 - 10, doorBaseY - 4, s + 20, 10, 3);
  ctx.fill();

  // Treaded steel threshold plate
  ctx.fillStyle = '#334155';
  ctx.fillRect(doorX - 18, doorBaseY - 1, 36, 6);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 1;
  for (let tx = doorX - 14; tx <= doorX + 14; tx += 7) {
    ctx.beginPath();
    ctx.moveTo(tx, doorBaseY);
    ctx.lineTo(tx + 3, doorBaseY + 4);
    ctx.stroke();
  }

  // 2. Main Weathered Lab Walls (ty=5..6)
  const wallY = 5 * s;
  const wallH = 2 * s;
  const wallGrad = ctx.createLinearGradient(x0, wallY, x0 + w, wallY + wallH);
  wallGrad.addColorStop(0, '#ECE7DA');
  wallGrad.addColorStop(0.55, '#DDD7C7');
  wallGrad.addColorStop(1, '#C6BFAE');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(x0 + 2, wallY, w - 4, wallH);

  // Organic creeping ivy vines replacing old rigid moss rectangles
  drawCreepingIvy(ctx, x0 + 8, wallY + wallH - 14, x0 + 42, wallY + 46, x0 + 18, wallY + 64, breeze * 0.35);
  drawCreepingIvy(ctx, x0 + w - 10, wallY + 4, x0 + w - 46, wallY + 40, x0 + w - 22, wallY + 28, breeze * 0.35);

  // Heavy river-stone masonry foundation
  drawRiverStoneCourse(ctx, x0 + 2, wallY + wallH - 16, w - 4, 16, '#64748B', '#94A3B8', '#334155');

  // Dark bronze-walnut structural beams with bevel
  const beamXs = [x0, x0 + w - 10, doorX - s / 2 - 6, doorX + s / 2 - 3];
  for (const bx of beamXs) {
    const bg = ctx.createLinearGradient(bx, 0, bx + 9, 0);
    bg.addColorStop(0, '#6B4226');
    bg.addColorStop(0.5, '#4A2C18');
    bg.addColorStop(1, '#261409');
    ctx.fillStyle = bg;
    ctx.fillRect(bx, wallY - 3, 9, wallH + 3);
  }
  ctx.fillStyle = '#3B2212';
  ctx.fillRect(x0, wallY + 42, w, 7);

  // 3. Sealed Double Lab Door + Heavy Steel Hasp & 3D Brass Padlock
  const dLeft = doorX - s / 2 + 2;
  const dW = s - 4;
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.roundRect(dLeft, doorBaseY - 48, dW, 48, [3, 3, 0, 0]);
  ctx.fill();

  const steelGrad = ctx.createLinearGradient(dLeft + 3, 0, dLeft + dW - 3, 0);
  steelGrad.addColorStop(0, '#64748B');
  steelGrad.addColorStop(0.5, '#475569');
  steelGrad.addColorStop(1, '#334155');
  ctx.fillStyle = steelGrad;
  ctx.fillRect(dLeft + 3, doorBaseY - 44, dW / 2 - 4, 44);
  ctx.fillRect(dLeft + dW / 2 + 1, doorBaseY - 44, dW / 2 - 4, 44);

  // Glowing bio-teal observation glass slits
  for (const gx of [dLeft + 7, dLeft + dW / 2 + 5]) {
    const bioGrad = ctx.createLinearGradient(gx, doorBaseY - 38, gx, doorBaseY - 24);
    bioGrad.addColorStop(0, isDark ? '#5EEAD4' : '#2DD4BF');
    bioGrad.addColorStop(1, '#0F766E');
    ctx.fillStyle = bioGrad;
    ctx.beginPath();
    ctx.roundRect(gx, doorBaseY - 38, dW / 2 - 12, 13, 2);
    ctx.fill();
  }

  // Brass padlock bar
  ctx.fillStyle = '#92400E';
  ctx.fillRect(doorX - 11, doorBaseY - 21, 22, 4);
  const lockGrad = ctx.createLinearGradient(doorX - 5, doorBaseY - 20, doorX + 5, doorBaseY - 10);
  lockGrad.addColorStop(0, '#FDE047');
  lockGrad.addColorStop(1, '#B45309');
  ctx.fillStyle = lockGrad;
  ctx.beginPath();
  ctx.roundRect(doorX - 5, doorBaseY - 20, 10, 10, 2.5);
  ctx.fill();
  ctx.strokeStyle = '#451A03';
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // Flanking bio-amber porch lanterns
  for (const lx of [dLeft - 7, dLeft + dW + 7]) {
    const ly = doorBaseY - 33;
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(lx - 2, ly - 6, 4, 6);
    const lGlow = ctx.createRadialGradient(lx, ly + 4, 1, lx, ly + 4, 6);
    lGlow.addColorStop(0, '#FFFFFF');
    lGlow.addColorStop(0.5, isDark ? '#2DD4BF' : '#FDE68A');
    lGlow.addColorStop(1, isDark ? '#0D9488' : '#D97706');
    ctx.fillStyle = lGlow;
    ctx.beginPath();
    ctx.roundRect(lx - 4, ly, 8, 9.5, 2);
    ctx.fill();
    if (isDark) {
      const aura = ctx.createRadialGradient(lx, ly + 4, 2, lx, ly + 4, 34);
      aura.addColorStop(0, 'rgba(45, 212, 191, 0.34)');
      aura.addColorStop(1, 'rgba(45, 212, 191, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(lx, ly + 4, 34, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 4. Lab Windows with Botanical Specimen Glow & Kalabas Research Vines
  const drawLabWindow = (wx: number, wy: number) => {
    const winBreeze = getBreeze(wx, t);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
    ctx.fillRect(wx - 6, wy + 2, 9, 28);
    ctx.fillRect(wx + 31, wy + 2, 9, 28);

    for (const sx of [wx - 8, wx + 30]) {
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(sx, wy, 7.5, 28, 1.5);
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const specGrad = ctx.createLinearGradient(wx, wy, wx + 30, wy + 28);
    specGrad.addColorStop(0, isDark ? '#2DD4BF' : '#A5F3FC');
    specGrad.addColorStop(1, isDark ? '#0F766E' : '#0891B2');
    ctx.fillStyle = specGrad;
    ctx.fillRect(wx, wy, 30, 28);

    // Subtle specimen cylinder silhouettes inside window
    ctx.fillStyle = 'rgba(15, 118, 110, 0.35)';
    ctx.fillRect(wx + 5, wy + 6, 6, 18);
    ctx.fillRect(wx + 19, wy + 8, 6, 16);

    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.beginPath();
    ctx.moveTo(wx + 4, wy + 24);
    ctx.lineTo(wx + 17, wy + 4);
    ctx.lineTo(wx + 23, wy + 4);
    ctx.lineTo(wx + 10, wy + 24);
    ctx.fill();

    ctx.strokeStyle = '#4A2C18';
    ctx.lineWidth = 2.4;
    ctx.strokeRect(wx, wy, 30, 28);

    // Planter box with Kalabas research foliage
    ctx.fillStyle = '#44403C';
    ctx.beginPath();
    ctx.roundRect(wx - 3, wy + 28, 36, 8.5, 2);
    ctx.fill();
    drawOrganicFoliageCluster(ctx, wx + 15, wy + 26, 16, 6.5, winBreeze * 0.45, '#14532D', '#15803D', '#84CC16');
  };

  drawLabWindow(11 * s + 16, wallY + 26);
  drawLabWindow(15 * s + 8, wallY + 26);

  // 5. Rooftop Exhaust Pipe with Steam + Telemetry Dish
  const pipeX = 15.6 * s;
  const pipeY = y0 - 22;
  const pipeGrad = ctx.createLinearGradient(pipeX, 0, pipeX + 18, 0);
  pipeGrad.addColorStop(0, '#64748B');
  pipeGrad.addColorStop(0.6, '#475569');
  pipeGrad.addColorStop(1, '#1E293B');
  ctx.fillStyle = pipeGrad;
  ctx.fillRect(pipeX, pipeY, 18, 40);
  ctx.fillStyle = '#B45309';
  ctx.beginPath();
  ctx.roundRect(pipeX - 3, pipeY - 4, 24, 7, 2);
  ctx.fill();

  drawVolumetricSmoke(ctx, pipeX + 9, pipeY - 6, t + 1.7, 4, 34, 4.5, '207, 250, 254');

  // Telemetry Dish on left slope
  const dishX = x0 + 48;
  const dishY = y0 - 24;
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(dishX, y0 - 2);
  ctx.lineTo(dishX, dishY + 4);
  ctx.stroke();
  ctx.fillStyle = '#CBD5E1';
  ctx.beginPath();
  ctx.ellipse(dishX + Math.sin(t * 0.8) * 2, dishY + 2, 10, 4.5, -0.35, 0, Math.PI * 2);
  ctx.fill();
  const beaconPulse = 0.6 + Math.sin(t * 4) * 0.4;
  ctx.fillStyle = `rgba(45, 212, 191, ${beaconPulse})`;
  ctx.beginPath();
  ctx.arc(dishX, dishY - 3, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // 6. Pitched Weathered Slate-Bronze Lab Roof
  const roofLeft = x0 - 12;
  const roofRight = x0 + w + 12;
  const roofTop = y0 - 14;
  const roofBottom = wallY + 8;

  const eaveShadow = ctx.createLinearGradient(0, wallY, 0, wallY + 14);
  eaveShadow.addColorStop(0, 'rgba(15, 23, 42, 0.42)');
  eaveShadow.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = eaveShadow;
  ctx.fillRect(x0 + 1, wallY, w - 2, 14);

  const roofGrad = ctx.createLinearGradient(roofLeft, roofTop, roofRight, roofBottom);
  roofGrad.addColorStop(0, '#64748B');
  roofGrad.addColorStop(0.5, '#475569');
  roofGrad.addColorStop(1, '#1E293B');
  ctx.fillStyle = roofGrad;
  ctx.beginPath();
  ctx.moveTo(roofLeft + 26, roofTop);
  ctx.lineTo(roofRight - 26, roofTop);
  ctx.lineTo(roofRight, roofBottom);
  ctx.lineTo(roofLeft, roofBottom);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Slate tile courses
  for (let ry = roofTop + 14; ry < roofBottom - 6; ry += 15) {
    const progress = (ry - roofTop) / (roofBottom - roofTop);
    const rowLeft = roofLeft + (1 - progress) * 24 + 4;
    const rowRight = roofRight - (1 - progress) * 24 - 4;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let rx = rowLeft; rx < rowRight - 8; rx += 16) {
      ctx.moveTo(rx, ry);
      ctx.quadraticCurveTo(rx + 8, ry + 6.5, rx + 16, ry);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.24)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rowLeft, ry - 2);
    ctx.lineTo(rowRight, ry - 2);
    ctx.stroke();
  }

  // Velvety organic moss cushions on weathered roof
  drawOrganicFoliageCluster(ctx, x0 + 54, roofTop + 34, 16, 6, 0, '#365314', '#4D7C0F', '#84CC16');
  drawOrganicFoliageCluster(ctx, x0 + w - 50, roofTop + 50, 14, 5, 0, '#365314', '#4D7C0F', '#65A30D');

  // Ridge cap (Wuwungan)
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.roundRect(roofLeft + 22, roofTop - 4, roofRight - roofLeft - 44, 10, 4);
  ctx.fill();

  // Front Lab Porch Gable + Brass Plaque "LAB PENELITIAN"
  const gableCx = doorX;
  const gGrad = ctx.createLinearGradient(gableCx - 50, roofTop + 18, gableCx + 50, wallY + 12);
  gGrad.addColorStop(0, '#475569');
  gGrad.addColorStop(1, '#1E293B');
  ctx.fillStyle = gGrad;
  ctx.beginPath();
  ctx.moveTo(gableCx, roofTop + 18);
  ctx.lineTo(gableCx + 50, wallY + 12);
  ctx.lineTo(gableCx - 50, wallY + 12);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ECE7DA';
  ctx.beginPath();
  ctx.moveTo(gableCx, roofTop + 30);
  ctx.lineTo(gableCx + 36, wallY + 10);
  ctx.lineTo(gableCx - 36, wallY + 10);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#4A2C18';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(gableCx - 50, wallY + 12);
  ctx.lineTo(gableCx, roofTop + 18);
  ctx.lineTo(gableCx + 50, wallY + 12);
  ctx.stroke();

  const orbGrad = ctx.createRadialGradient(gableCx - 1.5, roofTop + 14.5, 1, gableCx, roofTop + 16, 5);
  orbGrad.addColorStop(0, '#FEF08A');
  orbGrad.addColorStop(1, '#B45309');
  ctx.fillStyle = orbGrad;
  ctx.beginPath();
  ctx.arc(gableCx, roofTop + 16, 4.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0F172A';
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(gableCx - 54, wallY + 1, 108, 16, 3.5);
  ctx.fill();
  ctx.stroke();
  ctx.font = '700 9px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FDE68A';
  ctx.fillText('LAB PENELITIAN', gableCx, wallY + 12);

  ctx.restore();
}

/**
 * Renders individual hardwood parquet floors & structural walls for the HOUSE map
 * before unified multi-tile furniture and room decor are layered on top.
 */
export function drawHouseTileBase(
  ctx: CanvasRenderingContext2D,
  tile: string,
  tx: number,
  ty: number,
  px: number,
  py: number
) {
  const s = TILE_SIZE;
  if (tile === 'WALL') {
    ctx.fillStyle = '#1E140D';
    ctx.fillRect(px, py, s, s);
    const wg = ctx.createLinearGradient(px, py, px + s, py + s);
    wg.addColorStop(0, '#4A3324');
    wg.addColorStop(1, '#2B1D14');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.roundRect(px + 2, py + 2, s - 4, s - 5, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(254, 243, 199, 0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 2.5, py + 2.5, s - 5, s - 6);
    return;
  }

  if (tile === 'BATH_FLOOR') {
    const sub = s / 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const alt = (tx * 3 + c + ty * 3 + r) % 2 === 0;
        const cx = px + c * sub;
        const cy = py + r * sub;
        const tg = ctx.createLinearGradient(cx, cy, cx + sub, cy + sub);
        tg.addColorStop(0, alt ? '#E2F5F3' : '#CFECE9');
        tg.addColorStop(1, alt ? '#C0E2DF' : '#AED6D2');
        ctx.fillStyle = tg;
        ctx.fillRect(cx, cy, sub, sub);
        ctx.strokeStyle = 'rgba(15, 118, 110, 0.2)';
        ctx.lineWidth = 0.9;
        ctx.strokeRect(cx + 0.5, cy + 0.5, sub - 1, sub - 1);
      }
    }
    if (ty === 3) {
      const sh = ctx.createLinearGradient(0, py, 0, py + 18);
      sh.addColorStop(0, 'rgba(15, 45, 42, 0.3)');
      sh.addColorStop(1, 'rgba(15, 45, 42, 0)');
      ctx.fillStyle = sh;
      ctx.fillRect(px, py, s, 18);
    }
    return;
  }

  let base = '#CEA372';
  let plankAlt = '#BF9260';
  let highlight = 'rgba(255, 245, 224, 0.14)';
  const seam = 'rgba(66, 38, 16, 0.24)';
  if (tx >= 20) {
    base = '#C19262';
    plankAlt = '#B38353';
    highlight = 'rgba(255, 240, 215, 0.12)';
  }

  ctx.fillStyle = base;
  ctx.fillRect(px, py, s, s);

  const plankH = s / 3;
  for (let i = 0; i < 3; i++) {
    const pyStrip = py + i * plankH;
    if ((tx + ty + i) % 2 === 0) {
      ctx.fillStyle = plankAlt;
      ctx.fillRect(px, pyStrip, s, plankH);
    }
    // Subtle top bevel & wood grain curve
    ctx.fillStyle = highlight;
    ctx.fillRect(px, pyStrip + 1, s, 1.2);
    ctx.fillStyle = seam;
    ctx.fillRect(px, pyStrip, s, 1);

    ctx.strokeStyle = 'rgba(82, 47, 20, 0.12)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(px + 2, pyStrip + plankH * 0.55);
    ctx.quadraticCurveTo(px + s * 0.5, pyStrip + plankH * (0.35 + ((tx + i) % 2) * 0.3), px + s - 2, pyStrip + plankH * 0.55);
    ctx.stroke();

    const jointX = px + (((tx * 17 + ty * 31 + i * 23) % 32) + 8);
    ctx.fillStyle = seam;
    ctx.fillRect(jointX, pyStrip, 1.2, plankH);
  }

  if (ty === 3) {
    const sh = ctx.createLinearGradient(0, py, 0, py + 18);
    sh.addColorStop(0, 'rgba(28, 18, 10, 0.34)');
    sh.addColorStop(1, 'rgba(28, 18, 10, 0)');
    ctx.fillStyle = sh;
    ctx.fillRect(px, py, s, 18);
  }
}

function drawWovenRug(
  ctx: CanvasRenderingContext2D,
  xTile: number,
  yTile: number,
  wTiles: number,
  hTiles: number,
  mainHex: string,
  darkHex: string,
  borderHex: string,
  accentHex: string
) {
  const s = TILE_SIZE;
  const rx = xTile * s + 6;
  const ry = yTile * s + 6;
  const rw = wTiles * s - 12;
  const rh = hTiles * s - 12;

  ctx.save();
  // Soft shadow under rug
  ctx.fillStyle = 'rgba(20, 12, 6, 0.24)';
  ctx.beginPath();
  ctx.roundRect(rx + 2, ry + 4, rw, rh, 6);
  ctx.fill();

  // Slightly organic tasseled fringes
  ctx.strokeStyle = '#F5E6C8';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let fy = ry + 8; fy < ry + rh - 6; fy += 7) {
    const jitter = Math.sin(fy * 0.7) * 1.2;
    ctx.moveTo(rx - 5.5, fy + jitter);
    ctx.lineTo(rx + 1, fy);
    ctx.moveTo(rx + rw - 1, fy);
    ctx.lineTo(rx + rw + 5.5, fy - jitter);
  }
  ctx.stroke();

  // Main woven fabric body with warm light falloff
  const rugGrad = ctx.createLinearGradient(rx, ry, rx + rw, ry + rh);
  rugGrad.addColorStop(0, mainHex);
  rugGrad.addColorStop(1, darkHex);
  ctx.fillStyle = rugGrad;
  ctx.beginPath();
  ctx.roundRect(rx, ry, rw, rh, 5);
  ctx.fill();

  // Subtle woven weft texture
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let ly = ry + 10; ly < ry + rh - 8; ly += 6) {
    ctx.moveTo(rx + 6, ly);
    ctx.lineTo(rx + rw - 6, ly);
  }
  ctx.stroke();

  // Double Nusantara woven border
  ctx.strokeStyle = borderHex;
  ctx.lineWidth = 4.5;
  ctx.strokeRect(rx + 7, ry + 7, rw - 14, rh - 14);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(rx + 12, ry + 12, rw - 24, rh - 24);

  // Center Batik diamond medallion
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  ctx.fillStyle = borderHex;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 22);
  ctx.lineTo(cx + 30, cy);
  ctx.lineTo(cx, cy + 22);
  ctx.lineTo(cx - 30, cy);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = accentHex;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 9);
  ctx.lineTo(cx + 12, cy);
  ctx.lineTo(cx, cy + 9);
  ctx.lineTo(cx - 12, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawInteriorWallDecor(ctx: CanvasRenderingContext2D, state: RenderState) {
  const s = TILE_SIZE;
  const sky = getWindowSkyPalette(state.timeMinutes);
  const wallY = 1 * s; // 48
  const wallH = 2 * s; // 96 (2x taller upper wall spanning ty: 1..2)
  const wainsH = 30;

  // Room 1: Kamar Mandi (tx: 1..10)
  const bathX = 1 * s;
  const bathW = 10 * s;
  const bathWallGrad = ctx.createLinearGradient(0, wallY, 0, wallY + wallH);
  bathWallGrad.addColorStop(0, '#F0FDFC');
  bathWallGrad.addColorStop(1, '#CFECE9');
  ctx.fillStyle = bathWallGrad;
  ctx.fillRect(bathX, wallY, bathW, wallH - wainsH);

  // Subtle vertical ceramic wall tiles in Kamar Mandi
  ctx.strokeStyle = 'rgba(15, 118, 110, 0.08)';
  ctx.lineWidth = 1;
  for (let tx = bathX + 24; tx < bathX + bathW; tx += 24) {
    ctx.beginPath();
    ctx.moveTo(tx, wallY);
    ctx.lineTo(tx, wallY + wallH - wainsH);
    ctx.stroke();
  }

  ctx.fillStyle = '#0F766E';
  ctx.fillRect(bathX, wallY + wallH - wainsH, bathW, wainsH);
  ctx.fillStyle = '#2DD4BF';
  ctx.fillRect(bathX, wallY + wallH - wainsH - 2, bathW, 4);
  ctx.fillStyle = '#134E4A';
  ctx.fillRect(bathX, wallY + wallH - 5, bathW, 5);

  // Room 2 (tx: 12..18) & Room 3 (tx: 20..28): Warm plaster + 2x carved teak wainscoting
  const woodRoomSpans: [number, number][] = [
    [12, 18],
    [20, 28],
  ];

  for (const [x1, x2] of woodRoomSpans) {
    const wx = x1 * s;
    const ww = (x2 - x1 + 1) * s;

    const plasterGrad = ctx.createLinearGradient(0, wallY, 0, wallY + wallH - wainsH);
    plasterGrad.addColorStop(0, '#FAF3E3');
    plasterGrad.addColorStop(1, '#E5D5B8');
    ctx.fillStyle = plasterGrad;
    ctx.fillRect(wx, wallY, ww, wallH - wainsH);

    // Subtle timber crown molding along top of 2x wall
    ctx.fillStyle = '#5C3A21';
    ctx.fillRect(wx, wallY, ww, 5);
    ctx.fillStyle = '#A47148';
    ctx.fillRect(wx, wallY + 4, ww, 2);

    ctx.fillStyle = 'rgba(180, 140, 95, 0.08)';
    for (let sx = wx + 14; sx < wx + ww; sx += 28) {
      ctx.fillRect(sx, wallY + 6, 7, wallH - wainsH - 6);
    }

    const wainsGrad = ctx.createLinearGradient(0, wallY + wallH - wainsH, 0, wallY + wallH);
    wainsGrad.addColorStop(0, '#8B5E3C');
    wainsGrad.addColorStop(0.35, '#6E472B');
    wainsGrad.addColorStop(1, '#3E2514');
    ctx.fillStyle = wainsGrad;
    ctx.fillRect(wx, wallY + wallH - wainsH, ww, wainsH);
    ctx.fillStyle = '#A47148';
    ctx.fillRect(wx, wallY + wallH - wainsH - 2, ww, 4);

    // Carved wainscoting panel grooves
    ctx.strokeStyle = 'rgba(46, 26, 12, 0.35)';
    ctx.lineWidth = 1.4;
    for (let px = wx + 8; px < wx + ww - 22; px += 36) {
      ctx.strokeRect(px, wallY + wallH - wainsH + 6, 26, wainsH - 12);
    }
  }

  // Carved Room Header Plaques (2x larger on top timber header band)
  const drawRoomPlaque = (centerTileX: number, title: string) => {
    const cx = centerTileX * s;
    ctx.save();
    ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
    const textW = ctx.measureText(title).width;
    const boxW = textW + 34;
    const boxH = 30;
    const boxY = 10;
    ctx.fillStyle = 'rgba(15, 10, 6, 0.42)';
    ctx.beginPath();
    ctx.roundRect(cx - boxW / 2 + 2, boxY + 3, boxW, boxH, 7);
    ctx.fill();

    const pGrad = ctx.createLinearGradient(0, boxY, 0, boxY + boxH);
    pGrad.addColorStop(0, '#784828');
    pGrad.addColorStop(1, '#3B1E0D');
    ctx.fillStyle = pGrad;
    ctx.strokeStyle = '#C98A52';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(cx - boxW / 2, boxY, boxW, boxH, 7);
    ctx.fill();
    ctx.stroke();

    // Brass corner rivets
    ctx.fillStyle = '#FACC15';
    for (const rx of [cx - boxW / 2 + 7, cx + boxW / 2 - 7]) {
      ctx.beginPath();
      ctx.arc(rx, boxY + boxH / 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#FEF3C7';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, cx, boxY + boxH / 2 + 0.5);
    ctx.restore();
  };

  drawRoomPlaque(6.0, 'Kamar Mandi · Kolam');
  drawRoomPlaque(15.5, 'Ruang Tengah & Dapur');
  drawRoomPlaque(24.5, 'Kamar Tidur & PC');

  // Sunlit Glass Windows 2x larger with draped pleated curtains
  const drawInteriorWindow = (tileX: number, curtainColor: string, curtainDark: string, frosted = false) => {
    const wx = tileX * s + 6;
    const wy = wallY + 10;
    const ww = 72; // 2x (was 36)
    const wh = 56; // ~2x (was 30)

    // Curtain rod above window
    ctx.fillStyle = '#4A2C18';
    ctx.beginPath();
    ctx.roundRect(wx - 12, wy - 6, ww + 24, 5, 2.5);
    ctx.fill();

    const wGrad = ctx.createLinearGradient(wx, wy, wx, wy + wh);
    wGrad.addColorStop(0, frosted ? '#E0F2FE' : sky.sky);
    wGrad.addColorStop(1, frosted ? '#BAE6FD' : sky.skyDeep);
    ctx.fillStyle = wGrad;
    ctx.fillRect(wx, wy, ww, wh);
    if (!frosted && sky.isNight) {
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(wx + 14, wy + 15, 2.0, 0, Math.PI * 2);
      ctx.arc(wx + 48, wy + 24, 2.2, 0, Math.PI * 2);
      ctx.arc(wx + 32, wy + 12, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Diagonal glass sheen
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.beginPath();
    ctx.moveTo(wx + 8, wy + wh - 3);
    ctx.lineTo(wx + 36, wy + 3);
    ctx.lineTo(wx + 46, wy + 3);
    ctx.lineTo(wx + 18, wy + wh - 3);
    ctx.fill();

    ctx.strokeStyle = '#5C3A21';
    ctx.lineWidth = 4;
    ctx.strokeRect(wx, wy, ww, wh);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(wx + ww / 2, wy);
    ctx.lineTo(wx + ww / 2, wy + wh);
    ctx.moveTo(wx, wy + wh / 2);
    ctx.lineTo(wx + ww, wy + wh / 2);
    ctx.stroke();

    // Window sill
    ctx.fillStyle = '#7C4A26';
    ctx.beginPath();
    ctx.roundRect(wx - 6, wy + wh - 1, ww + 12, 7, 2);
    ctx.fill();

    // Draped organic side curtains (2x scaled)
    for (const [cx, flip] of [
      [wx - 8, 1],
      [wx + ww - 10, -1],
    ] as const) {
      const cg = ctx.createLinearGradient(cx, wy, cx + 18, wy);
      cg.addColorStop(0, curtainColor);
      cg.addColorStop(1, curtainDark);
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(cx, wy - 3);
      ctx.lineTo(cx + 18, wy - 3);
      ctx.quadraticCurveTo(cx + 18 - flip * 5, wy + wh * 0.5, cx + 20, wy + wh + 3);
      ctx.lineTo(cx - 2, wy + wh + 3);
      ctx.quadraticCurveTo(cx + flip * 4, wy + wh * 0.5, cx, wy - 3);
      ctx.fill();
    }

    if (!sky.isNight) {
      ctx.save();
      const beamGrad = ctx.createLinearGradient(wx, wallY + wallH, wx + ww * 0.6, wallY + wallH + 2.5 * s);
      beamGrad.addColorStop(0, sky.glow);
      beamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(wx, wallY + wallH);
      ctx.lineTo(wx + ww, wallY + wallH);
      ctx.lineTo(wx + ww + 28, wallY + wallH + 2.5 * s);
      ctx.lineTo(wx - 18, wallY + wallH + 2.5 * s);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  };

  drawInteriorWindow(1.55, '#14B8A6', '#0F766E', true);
  drawInteriorWindow(13.65, '#EF4444', '#991B1B');
  drawInteriorWindow(26.1, '#3B82F6', '#1E40AF');

  // Kamar Mandi Towel Rack (2x larger at tx=3.65)
  const trX = 3.65 * s;
  const trY = wallY + 20;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
  ctx.beginPath();
  ctx.roundRect(trX + 2, trY + 4, 68, 8, 4);
  ctx.fill();
  ctx.fillStyle = '#5C3A21';
  ctx.beginPath();
  ctx.roundRect(trX, trY, 68, 8, 4);
  ctx.fill();
  for (const [tx, c1, c2] of [
    [trX + 6, '#FFFFFF', '#CBD5E1'],
    [trX + 36, '#5EEAD4', '#0D9488'],
  ] as const) {
    const tg = ctx.createLinearGradient(tx, 0, tx + 24, 0);
    tg.addColorStop(0, c1);
    tg.addColorStop(1, c2);
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.roundRect(tx, trY + 4, 24, 34, [0, 0, 5, 5]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.14)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Bathroom Vanity Mirror & Warm Brass Wall Sconces (2x above Vanity at tx: 5.5..8.5)
  const mirX = 5.95 * s;
  const mirY = wallY + 10;
  const mirW = 92;
  const mirH = 52;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
  ctx.beginPath();
  ctx.roundRect(mirX + 2, mirY + 3, mirW, mirH, 14);
  ctx.fill();
  ctx.fillStyle = '#5C3A21';
  ctx.beginPath();
  ctx.roundRect(mirX, mirY, mirW, mirH, 14);
  ctx.fill();
  const mirGlass = ctx.createLinearGradient(mirX, mirY, mirX + mirW, mirY + mirH);
  mirGlass.addColorStop(0, '#E0F2FE');
  mirGlass.addColorStop(0.55, '#BAE6FD');
  mirGlass.addColorStop(1, '#7DD3FC');
  ctx.fillStyle = mirGlass;
  ctx.beginPath();
  ctx.roundRect(mirX + 5, mirY + 5, mirW - 10, mirH - 10, 10);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.beginPath();
  ctx.moveTo(mirX + 14, mirY + mirH - 6);
  ctx.lineTo(mirX + 36, mirY + 6);
  ctx.lineTo(mirX + 46, mirY + 6);
  ctx.lineTo(mirX + 24, mirY + mirH - 6);
  ctx.fill();

  for (const sx of [mirX - 16, mirX + mirW + 16]) {
    ctx.fillStyle = '#B45309';
    ctx.beginPath();
    ctx.arc(sx, mirY + 26, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(sx, mirY + 20, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Kitchen Spice Shelf & Glass Spice Jars (2x larger above Dapur at tx=12)
  const spX = 12 * s + 6;
  const spY = wallY + 46;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.roundRect(spX + 2, spY + 3, 66, 9, 3);
  ctx.fill();
  ctx.fillStyle = '#5C3A21';
  ctx.beginPath();
  ctx.roundRect(spX, spY, 66, 9, 3);
  ctx.fill();
  const jarColors = ['#DC2626', '#FACC15', '#16A34A', '#EA580C'];
  jarColors.forEach((c, idx) => {
    const jx = spX + 5 + idx * 15;
    const jy = spY - 22;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.roundRect(jx, jy, 12, 22, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.fillRect(jx + 2.5, jy + 4, 2.5, 13);
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.roundRect(jx + 1, jy - 4, 10, 5, 1.5);
    ctx.fill();
  });

  // Animated Brass Wall Clock (2x larger at tx=16.2, high above Fridge)
  const clockX = 16.2 * s;
  const clockY = wallY + 28;
  const clockR = 20;
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  ctx.beginPath();
  ctx.arc(clockX + 2, clockY + 3, clockR + 1, 0, Math.PI * 2);
  ctx.fill();
  const clkGrad = ctx.createRadialGradient(clockX - 5, clockY - 5, 3, clockX, clockY, clockR);
  clkGrad.addColorStop(0, '#D97706');
  clkGrad.addColorStop(0.55, '#B45309');
  clkGrad.addColorStop(1, '#451A03');
  ctx.fillStyle = clkGrad;
  ctx.beginPath();
  ctx.arc(clockX, clockY, clockR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFBEB';
  ctx.beginPath();
  ctx.arc(clockX, clockY, clockR - 4.5, 0, Math.PI * 2);
  ctx.fill();
  // Clock hour ticks
  ctx.fillStyle = '#78350F';
  for (let h = 0; h < 12; h++) {
    const a = (h * Math.PI) / 6;
    ctx.beginPath();
    ctx.arc(clockX + Math.cos(a) * (clockR - 7), clockY + Math.sin(a) * (clockR - 7), 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  const minAng = (state.timeMinutes / 60) * Math.PI * 2 - Math.PI / 2;
  const hrAng = (state.timeMinutes / 720) * Math.PI * 2 - Math.PI / 2;
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(clockX, clockY);
  ctx.lineTo(clockX + Math.cos(hrAng) * 8.5, clockY + Math.sin(hrAng) * 8.5);
  ctx.moveTo(clockX, clockY);
  ctx.lineTo(clockX + Math.cos(minAng) * 12.5, clockY + Math.sin(minAng) * 12.5);
  ctx.stroke();

  // Certificate & Calendar (2x larger at tx=20.2)
  const certX = 20 * s + 10;
  const certY = wallY + 14;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(certX + 2, certY + 3, 38, 42);
  ctx.fillStyle = '#FEF3C7';
  ctx.strokeStyle = '#78350F';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.roundRect(certX, certY, 38, 42, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#DC2626';
  ctx.fillRect(certX + 6, certY + 7, 26, 6);
  ctx.fillStyle = '#92400E';
  ctx.fillRect(certX + 7, certY + 18, 24, 3);
  ctx.fillRect(certX + 7, certY + 25, 18, 3);
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  ctx.arc(certX + 29, certY + 33, 4.5, 0, Math.PI * 2);
  ctx.fill();

  const calX = certX + 48;
  const calY = wallY + 16;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(calX + 2, calY + 3, 32, 38);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(calX, calY, 32, 38, 4);
  ctx.fill();
  ctx.fillStyle = '#0284C7';
  ctx.beginPath();
  ctx.roundRect(calX, calY, 32, 11, [4, 4, 0, 0]);
  ctx.fill();
  ctx.fillStyle = '#334155';
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      ctx.fillRect(calX + 4 + c * 6.5, calY + 15 + r * 6.5, 4, 4);
    }
  }

  // Framed Nusantara Mountain Painting (2x larger at tx=22.6 above wide bed)
  const artX = 22.6 * s;
  const artY = wallY + 10;
  const artW = 74;
  const artH = 48;
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  ctx.fillRect(artX + 3, artY + 4, artW, artH);
  ctx.fillStyle = '#5C3A21';
  ctx.beginPath();
  ctx.roundRect(artX, artY, artW, artH, 4);
  ctx.fill();
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(artX + 3, artY + 3, artW - 6, artH - 6);
  const canvasGrad = ctx.createLinearGradient(artX, artY + 6, artX, artY + artH - 6);
  canvasGrad.addColorStop(0, '#7DD3FC');
  canvasGrad.addColorStop(1, '#FDE68A');
  ctx.fillStyle = canvasGrad;
  ctx.fillRect(artX + 6, artY + 6, artW - 12, artH - 12);
  ctx.fillStyle = '#15803D';
  ctx.beginPath();
  ctx.moveTo(artX + 6, artY + artH - 6);
  ctx.quadraticCurveTo(artX + 22, artY + 18, artX + 34, artY + 26);
  ctx.quadraticCurveTo(artX + 50, artY + 34, artX + 62, artY + 18);
  ctx.lineTo(artX + artW - 6, artY + artH - 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  ctx.arc(artX + artW - 18, artY + 15, 5.2, 0, Math.PI * 2);
  ctx.fill();

  // Room Divider Archway Trim (doorways at tx=11 & tx=19, ty: 8..10)
  for (const dx of [11 * s, 19 * s]) {
    const postGrad = ctx.createLinearGradient(dx, 0, dx + 8, 0);
    postGrad.addColorStop(0, '#925B33');
    postGrad.addColorStop(1, '#4A2C18');
    ctx.fillStyle = postGrad;
    ctx.fillRect(dx + 2, 8 * s, 7, 3 * s);
    ctx.fillRect(dx + s - 9, 8 * s, 7, 3 * s);
    ctx.fillStyle = 'rgba(60, 35, 16, 0.28)';
    ctx.fillRect(dx + 9, 8 * s, s - 18, 3 * s);
  }
}

/**
 * Draws floor-level interior elements, upper 2x wall, rugs, 2x bathroom fixtures,
 * kitchen, fridge, cabinet, 2x wider & 3x longer bed, 2x bookcase, and 2x tall detailed exit door.
 */
export function drawHouseInteriorBase(ctx: CanvasRenderingContext2D, state: RenderState) {
  const s = TILE_SIZE;
  const isDark = state.timeMinutes >= 1050;
  const t = state.elapsedTime;
  const sky = getWindowSkyPalette(state.timeMinutes);

  drawInteriorWallDecor(ctx, state);

  // Bamboo slatted bath mat 2x larger (tx: 2..7, ty: 10..11)
  const bmX = 2 * s + 10;
  const bmY = 10 * s + 10;
  const bmW = 6 * s - 20;
  const bmH = 2 * s - 20;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.roundRect(bmX + 2, bmY + 5, bmW, bmH, 7);
  ctx.fill();
  ctx.fillStyle = '#78350F';
  ctx.beginPath();
  ctx.roundRect(bmX, bmY, bmW, bmH, 7);
  ctx.fill();
  for (let slat = bmX + 10; slat < bmX + bmW - 10; slat += 16) {
    const sg = ctx.createLinearGradient(slat, bmY + 7, slat, bmY + bmH - 7);
    sg.addColorStop(0, '#F59E0B');
    sg.addColorStop(1, '#B45309');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.roundRect(slat, bmY + 7, 10, bmH - 14, 3);
    ctx.fill();
  }

  drawWovenRug(ctx, 13, 9, 5, 3, '#B91C1C', '#7F1D1D', '#DC2626', '#FDE047');
  drawWovenRug(ctx, 25, 6, 3, 4, '#1D4ED8', '#1E3A8A', '#2563EB', '#FDE047');

  // KAMAR MANDI: Kolam Rendam Air Hangat 2x larger (tx: 2..7, ty: 6..9 -> 282 x 186px)
  const pxPool = 2 * s + 3;
  const pyPool = 6 * s + 3;
  const pwPool = 6 * s - 6;
  const phPool = 4 * s - 6;

  // Soft floor shadow around stone pool
  ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
  ctx.beginPath();
  ctx.roundRect(pxPool + 4, pyPool + 7, pwPool, phPool, 18);
  ctx.fill();

  // Carved stone pool coping blocks (2x thicker rim)
  const rimGrad = ctx.createLinearGradient(pxPool, pyPool, pxPool + pwPool, pyPool + phPool);
  rimGrad.addColorStop(0, '#64748B');
  rimGrad.addColorStop(0.5, '#475569');
  rimGrad.addColorStop(1, '#334155');
  ctx.fillStyle = rimGrad;
  ctx.beginPath();
  ctx.roundRect(pxPool, pyPool, pwPool, phPool, 18);
  ctx.fill();
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2.6;
  ctx.stroke();

  // Stone coping seam joints around perimeter
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
  ctx.lineWidth = 1.6;
  for (let sx = pxPool + 44; sx < pxPool + pwPool - 24; sx += 48) {
    ctx.beginPath();
    ctx.moveTo(sx, pyPool + 2);
    ctx.lineTo(sx, pyPool + 16);
    ctx.moveTo(sx + 10, pyPool + phPool - 16);
    ctx.lineTo(sx + 10, pyPool + phPool - 2);
    ctx.stroke();
  }

  // Deep translucent turquoise water depth
  const waterGrad = ctx.createRadialGradient(
    pxPool + pwPool * 0.42,
    pyPool + phPool * 0.42,
    16,
    pxPool + pwPool * 0.5,
    pyPool + phPool * 0.5,
    pwPool * 0.65
  );
  waterGrad.addColorStop(0, '#67E8F9');
  waterGrad.addColorStop(0.55, '#06B6D4');
  waterGrad.addColorStop(1, '#0E7490');
  ctx.fillStyle = waterGrad;
  ctx.beginPath();
  ctx.roundRect(pxPool + 16, pyPool + 16, pwPool - 32, phPool - 32, 12);
  ctx.fill();

  // Sinusoidal caustic ribbons & concentric splash ripples under pancuran (2x scale)
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pxPool + 16, pyPool + 16, pwPool - 32, phPool - 32, 12);
  ctx.clip();

  ctx.strokeStyle = 'rgba(224, 242, 254, 0.52)';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  for (let row = 0; row < 4; row++) {
    const baseY = pyPool + 42 + row * 34;
    const shift = Math.sin(t * 2.1 + row * 1.4) * 9;
    ctx.beginPath();
    ctx.moveTo(pxPool + 38 + shift, baseY);
    ctx.bezierCurveTo(
      pxPool + 92 + shift,
      baseY - 7,
      pxPool + 150 + shift,
      baseY + 7,
      pxPool + 218 + shift,
      baseY
    );
    ctx.stroke();
  }

  // Concentric ripple under falling bamboo spout (2x scale)
  const ripPhase = (t * 1.4) % 1;
  ctx.strokeStyle = `rgba(224, 242, 254, ${(1 - ripPhase) * 0.7})`;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(pxPool + 54, pyPool + 38, 8 + ripPhase * 26, 4 + ripPhase * 14, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Bamboo Pancuran curved water spout (2x) + thick parabolic water stream
  const bamGrad = ctx.createLinearGradient(pxPool + 18, pyPool - 6, pxPool + 18, pyPool + 12);
  bamGrad.addColorStop(0, '#84CC16');
  bamGrad.addColorStop(1, '#3F6212');
  ctx.fillStyle = bamGrad;
  ctx.beginPath();
  ctx.roundRect(pxPool + 18, pyPool - 6, 38, 17, 6);
  ctx.fill();
  ctx.strokeStyle = '#365314';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pxPool + 52, pyPool + 6);
  ctx.quadraticCurveTo(pxPool + 58, pyPool + 20, pxPool + 54, pyPool + 38);
  ctx.stroke();

  // Wooden bath bucket (Ember & Gayung) 2x larger
  const bktX = pxPool + pwPool - 32;
  const bktY = pyPool + phPool - 26;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
  ctx.beginPath();
  ctx.arc(bktX + 2, bktY + 3, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#92400E';
  ctx.beginPath();
  ctx.arc(bktX, bktY, 13.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#38BDF8';
  ctx.beginPath();
  ctx.arc(bktX, bktY, 8.6, 0, Math.PI * 2);
  ctx.fill();
  // Wooden gayung handle
  ctx.strokeStyle = '#B45309';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(bktX + 4, bktY - 4);
  ctx.lineTo(bktX + 16, bktY - 14);
  ctx.stroke();

  drawVolumetricSmoke(ctx, pxPool + pwPool * 0.45, pyPool + 84, t * 0.85, 6, 48, 9, '255, 255, 255');

  // Ceramic Sink Vanity 2x larger (Meja Kamar Mandi at tx: 5..8, ty: 3..4 -> 176 x 80px)
  const vx = 5 * s + 8;
  const vy = 3 * s + 4;
  const vw = 4 * s - 16;
  const vh = 2 * s - 16;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
  ctx.beginPath();
  ctx.roundRect(vx + 3, vy + 7, vw, vh, 8);
  ctx.fill();
  const vanGrad = ctx.createLinearGradient(vx, vy, vx, vy + vh);
  vanGrad.addColorStop(0, '#F8FAFC');
  vanGrad.addColorStop(0.75, '#E2E8F0');
  vanGrad.addColorStop(1, '#94A3B8');
  ctx.fillStyle = vanGrad;
  ctx.beginPath();
  ctx.roundRect(vx, vy, vw, vh, 8);
  ctx.fill();
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Vanity front drawer seams & chrome pulls
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(vx + 10, vy + vh - 16, 72, 11);
  ctx.strokeRect(vx + 92, vy + vh - 16, 72, 11);

  // Large oval porcelain basin & chrome gooseneck tap (2x)
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(vx + 56, vy + 34, 30, 19, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  const sinkWater = ctx.createRadialGradient(vx + 52, vy + 32, 2, vx + 56, vy + 34, 20);
  sinkWater.addColorStop(0, '#BAE6FD');
  sinkWater.addColorStop(1, '#0284C7');
  ctx.fillStyle = sinkWater;
  ctx.beginPath();
  ctx.ellipse(vx + 56, vy + 34, 20, 11.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(vx + 56, vy + 18, 7.5, Math.PI, Math.PI * 2);
  ctx.stroke();

  // Soap pump, ceramic tumbler & folded hand towel stack (2x)
  ctx.fillStyle = '#0D9488';
  ctx.beginPath();
  ctx.roundRect(vx + 106, vy + 18, 16, 24, 4);
  ctx.fill();
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(vx + 112, vy + 12, 4, 6);
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.roundRect(vx + 132, vy + 22, 16, 20, 4);
  ctx.fill();
  ctx.fillStyle = '#5EEAD4';
  ctx.beginPath();
  ctx.roundRect(vx + 14, vy + 18, 16, 36, 4);
  ctx.fill();

  // Porcelain WC / Toilet 2x larger (tx: 9..10, ty: 5..6 -> 76 x 88px near bath pool)
  const wcX = 9 * s + 10;
  const wcY = 5 * s + 4;
  const wcW = 76;
  const wcCx = wcX + wcW * 0.5;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.26)';
  ctx.beginPath();
  ctx.ellipse(wcCx + 2, wcY + 66, 30, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Toilet cistern tank (2x)
  const tankGrad = ctx.createLinearGradient(wcX + 6, wcY, wcX + wcW - 6, wcY + 28);
  tankGrad.addColorStop(0, '#FFFFFF');
  tankGrad.addColorStop(1, '#CBD5E1');
  ctx.fillStyle = tankGrad;
  ctx.beginPath();
  ctx.roundRect(wcX + 6, wcY, wcW - 12, 28, 6);
  ctx.fill();
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Chrome dual-flush top button (2x)
  ctx.fillStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.arc(wcCx, wcY + 10, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Porcelain bowl & seat (2x)
  const bowlGrad = ctx.createLinearGradient(wcCx - 27, wcY + 26, wcCx + 27, wcY + 82);
  bowlGrad.addColorStop(0, '#FFFFFF');
  bowlGrad.addColorStop(1, '#CBD5E1');
  ctx.fillStyle = bowlGrad;
  ctx.beginPath();
  ctx.ellipse(wcCx, wcY + 54, 27, 29, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Inner toilet seat ring & clear water (2x)
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.ellipse(wcCx, wcY + 52, 21.5, 23, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.stroke();
  const wcWater = ctx.createRadialGradient(wcCx - 2, wcY + 50, 2, wcCx, wcY + 52, 14);
  wcWater.addColorStop(0, '#BAE6FD');
  wcWater.addColorStop(1, '#0EA5E9');
  ctx.fillStyle = wcWater;
  ctx.beginPath();
  ctx.ellipse(wcCx, wcY + 52, 13.5, 14.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Toilet tissue roll holder on right side (2x)
  ctx.fillStyle = '#94A3B8';
  ctx.fillRect(wcX + wcW - 5, wcY + 16, 10, 5);
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.roundRect(wcX + wcW - 3, wcY + 20, 12, 16, 3);
  ctx.fill();
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Redesigned & 2x Heightened Interior Exit Double Door + Braided Doormat (tx=14..15, ty=14)
  const doorX = 14 * s;
  const doorBaseY = 15 * s - 2; // 718
  const doorH = 54; // >2x taller than previous 22px door
  const doorTopY = doorBaseY - doorH; // 664
  const doorW = s * 2; // 96

  // Interior sunlight / lantern spill onto floor
  const spillGrad = ctx.createLinearGradient(0, doorTopY - 40, 0, doorTopY);
  spillGrad.addColorStop(0, 'rgba(254, 243, 199, 0)');
  spillGrad.addColorStop(1, isDark ? 'rgba(251, 191, 36, 0.16)' : sky.glow);
  ctx.fillStyle = spillGrad;
  ctx.beginPath();
  ctx.moveTo(doorX - 18, doorTopY - 40);
  ctx.lineTo(doorX + doorW + 18, doorTopY - 40);
  ctx.lineTo(doorX + doorW - 2, doorTopY + 2);
  ctx.lineTo(doorX + 2, doorTopY + 2);
  ctx.closePath();
  ctx.fill();

  // Braided Nusantara Coir Doormat inside doorway (ty=13)
  const matX = doorX + 6;
  const matY = doorTopY - 26;
  const matW = doorW - 12;
  const matH = 22;
  ctx.fillStyle = 'rgba(20, 12, 6, 0.26)';
  ctx.beginPath();
  ctx.roundRect(matX + 2, matY + 3, matW, matH, 4);
  ctx.fill();
  const matGrad = ctx.createLinearGradient(matX, matY, matX + matW, matY + matH);
  matGrad.addColorStop(0, '#D97706');
  matGrad.addColorStop(0.5, '#B45309');
  matGrad.addColorStop(1, '#78350F');
  ctx.fillStyle = matGrad;
  ctx.beginPath();
  ctx.roundRect(matX, matY, matW, matH, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.65)';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(matX + 5, matY + 4, matW - 10, matH - 8);

  // Carved stone/granite interior threshold sill
  ctx.fillStyle = '#57534E';
  ctx.beginPath();
  ctx.roundRect(doorX - 4, doorTopY - 4, doorW + 8, 8, 2);
  ctx.fill();
  ctx.fillStyle = '#A8A29E';
  ctx.fillRect(doorX - 2, doorTopY - 3, doorW + 4, 2);

  // Deep Teak Architrave Door Surround Frame (54px tall)
  ctx.fillStyle = 'rgba(15, 10, 6, 0.35)';
  ctx.beginPath();
  ctx.roundRect(doorX - 4, doorTopY + 2, doorW + 8, doorH, 3);
  ctx.fill();
  const frameGrad = ctx.createLinearGradient(doorX, doorTopY, doorX, doorBaseY);
  frameGrad.addColorStop(0, '#5C3A21');
  frameGrad.addColorStop(1, '#2B170A');
  ctx.fillStyle = frameGrad;
  ctx.beginPath();
  ctx.roundRect(doorX, doorTopY, doorW, doorH, [4, 4, 0, 0]);
  ctx.fill();

  // Carved wooden top architrave lintel & recessed dark reveal
  ctx.fillStyle = '#7C4A26';
  ctx.beginPath();
  ctx.roundRect(doorX - 3, doorTopY - 2, doorW + 6, 7, 2);
  ctx.fill();
  ctx.fillStyle = '#1E1108';
  ctx.fillRect(doorX + 5, doorTopY + 5, doorW - 10, doorH - 6);

  // Two Tall Solid Jati Door Leaves (46px tall each)
  const leafW = (doorW - 14) / 2;
  const leafH = doorH - 8;
  const leafY = doorTopY + 6;
  for (const [idx, lx] of [
    [0, doorX + 6],
    [1, doorX + 8 + leafW],
  ] as const) {
    const leafGrad = ctx.createLinearGradient(lx, leafY, lx + leafW, leafY + leafH);
    leafGrad.addColorStop(0, '#B4621C');
    leafGrad.addColorStop(0.5, '#8F4812');
    leafGrad.addColorStop(1, '#5E2C0A');
    ctx.fillStyle = leafGrad;
    ctx.beginPath();
    ctx.roundRect(lx, leafY, leafW, leafH, 2);
    ctx.fill();

    // Fine vertical teak wood planks
    ctx.strokeStyle = 'rgba(43, 23, 10, 0.32)';
    ctx.lineWidth = 1;
    for (let gx = lx + 10; gx < lx + leafW - 4; gx += 10) {
      ctx.beginPath();
      ctx.moveTo(gx, leafY + 2);
      ctx.lineTo(gx, leafY + leafH - 2);
      ctx.stroke();
    }

    // Upper glowing leaded glass transom window (reflecting exterior sky or lantern glow)
    const paneX = lx + 6;
    const paneY = leafY + 5;
    const paneW = leafW - 12;
    const paneH = 16;
    const gGrad = ctx.createLinearGradient(paneX, paneY, paneX, paneY + paneH);
    gGrad.addColorStop(0, isDark ? '#FEF08A' : sky.sky);
    gGrad.addColorStop(1, isDark ? '#F59E0B' : sky.skyDeep);
    ctx.fillStyle = gGrad;
    ctx.beginPath();
    ctx.roundRect(paneX, paneY, paneW, paneH, 2);
    ctx.fill();
    ctx.strokeStyle = '#3B1E0D';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // Glass muntin cross-bars
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(paneX + paneW / 2, paneY);
    ctx.lineTo(paneX + paneW / 2, paneY + paneH);
    ctx.moveTo(paneX, paneY + paneH / 2);
    ctx.lineTo(paneX + paneW, paneY + paneH / 2);
    ctx.stroke();

    // Beveled raised lower Jati wood panel
    const panX = lx + 6;
    const panY = leafY + 25;
    const panW = leafW - 12;
    const panH = leafH - 30;
    ctx.fillStyle = '#6E350C';
    ctx.beginPath();
    ctx.roundRect(panX, panY, panW, panH, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(253, 230, 138, 0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(panX + 2, panY + 2, panW - 4, panH - 4);

    // Forged brass hinges
    const hingeX = idx === 0 ? lx - 1 : lx + leafW - 2.5;
    ctx.fillStyle = '#D97706';
    ctx.fillRect(hingeX, leafY + 7, 3.5, 6);
    ctx.fillRect(hingeX, leafY + leafH - 12, 3.5, 6);
  }

  // Central astragal trim & antique brass lever handles + key plates
  ctx.fillStyle = '#4A240A';
  ctx.fillRect(doorX + doorW / 2 - 1.5, leafY, 3, leafH);
  for (const hx of [doorX + doorW / 2 - 6, doorX + doorW / 2 + 6]) {
    ctx.fillStyle = '#B45309';
    ctx.beginPath();
    ctx.roundRect(hx - 2, leafY + 21, 4, 10, 1.5);
    ctx.fill();
    const knobG = ctx.createRadialGradient(hx - 0.5, leafY + 24, 0.5, hx, leafY + 24.5, 3.2);
    knobG.addColorStop(0, '#FEF08A');
    knobG.addColorStop(1, '#B45309');
    ctx.fillStyle = knobG;
    ctx.beginPath();
    ctx.arc(hx, leafY + 24.5, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Flanking warm brass interior sconces beside exit door
  for (const scX of [doorX - 14, doorX + doorW + 14]) {
    const scY = doorTopY + 14;
    ctx.fillStyle = '#78350F';
    ctx.fillRect(scX - 2, scY - 2, 4, 8);
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(scX, scY - 4, 4.5, 0, Math.PI * 2);
    ctx.fill();
    const scGlow = ctx.createRadialGradient(scX, scY - 4, 2, scX, scY - 4, 24);
    scGlow.addColorStop(0, 'rgba(253, 224, 71, 0.32)');
    scGlow.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = scGlow;
    ctx.beginPath();
    ctx.arc(scX, scY - 4, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  // Double Teak Bed 2x wider (132px) & 3x longer (258px) across tx: 21..23, ty: 3..8
  const bx = 21 * s + 6;
  const by = 3 * s + 4;
  const bw = 132; // 2x wider (was 66)
  const bh = (s * 2 - 10) * 3; // 258 (3x length)

  ctx.fillStyle = 'rgba(15, 10, 6, 0.28)';
  ctx.beginPath();
  ctx.roundRect(bx + 3, by + 6, bw, bh, 8);
  ctx.fill();

  const bedFrameGrad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
  bedFrameGrad.addColorStop(0, '#7C4A26');
  bedFrameGrad.addColorStop(1, '#4A2812');
  ctx.fillStyle = bedFrameGrad;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 7);
  ctx.fill();

  // Carved wide headboard highlight & decorative inlay
  ctx.fillStyle = '#925B33';
  ctx.beginPath();
  ctx.roundRect(bx + 4, by + 3, bw - 8, 16, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(253, 230, 138, 0.25)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(bx + 10, by + 6, bw - 20, 10);

  // Crisp fitted sheet
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.roundRect(bx + 7, by + 19, bw - 14, bh - 27, 4);
  ctx.fill();

  // Two large wide plush pillows (scaled cleanly to bw=132)
  for (const pxOff of [12, 70]) {
    const pGrad = ctx.createLinearGradient(bx + pxOff, by + 23, bx + pxOff, by + 48);
    pGrad.addColorStop(0, '#FFFFFF');
    pGrad.addColorStop(1, '#CBD5E1');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.roundRect(bx + pxOff, by + 23, 50, 24, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Wide folded crimson Batik duvet along the 2x-wide 3x-long bed
  const duvetTop = by + 54;
  const duvetH = bh - 64;
  const duvetGrad = ctx.createLinearGradient(bx + 7, duvetTop, bx + bw - 7, duvetTop + duvetH);
  duvetGrad.addColorStop(0, '#DC2626');
  duvetGrad.addColorStop(0.55, '#B91C1C');
  duvetGrad.addColorStop(1, '#7F1D1D');
  ctx.fillStyle = duvetGrad;
  ctx.beginPath();
  ctx.roundRect(bx + 7, duvetTop, bw - 14, duvetH, 5);
  ctx.fill();
  ctx.fillStyle = '#FDE68A';
  ctx.fillRect(bx + 7, duvetTop, bw - 14, 8);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1.6;
  for (let fy = duvetTop + 32; fy < duvetTop + duvetH - 18; fy += 38) {
    ctx.beginPath();
    ctx.moveTo(bx + 16, fy);
    ctx.quadraticCurveTo(bx + bw * 0.5, fy + 8, bx + bw - 16, fy - 2);
    ctx.stroke();
  }

  // Nightstand & warm lampshade beside bed (tx=24, ty=3)
  const nx = 24 * s + 6;
  const ny = by + 8;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.roundRect(nx + 2, ny + 4, 34, 38, 5);
  ctx.fill();
  ctx.fillStyle = '#6E4224';
  ctx.beginPath();
  ctx.roundRect(nx, ny, 34, 38, 5);
  ctx.fill();
  ctx.fillStyle = '#D97706';
  ctx.fillRect(nx + 14, ny + 18, 6, 9);
  ctx.fillStyle = isDark ? '#FDE047' : '#FEF3C7';
  ctx.beginPath();
  ctx.moveTo(nx + 6, ny + 18);
  ctx.lineTo(nx + 28, ny + 18);
  ctx.lineTo(nx + 22, ny + 5);
  ctx.lineTo(nx + 12, ny + 5);
  ctx.closePath();
  ctx.fill();
  if (isDark) {
    const lampGlow = ctx.createRadialGradient(nx + 17, ny + 12, 4, nx + 17, ny + 12, 68);
    lampGlow.addColorStop(0, 'rgba(253, 224, 71, 0.38)');
    lampGlow.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = lampGlow;
    ctx.beginPath();
    ctx.arc(nx + 17, ny + 12, 68, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dapur Nusantara 2x (tx: 12..14, ty: 3..4)
  const kx = 12 * s + 2;
  const ky = 3 * s - 4;
  const kw = 152;
  const kh = 84;

  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.beginPath();
  ctx.roundRect(kx + 2, ky + 6, kw, kh, 6);
  ctx.fill();
  const cabGrad = ctx.createLinearGradient(0, ky, 0, ky + kh);
  cabGrad.addColorStop(0, '#78716C');
  cabGrad.addColorStop(0.7, '#57534E');
  cabGrad.addColorStop(1, '#292524');
  ctx.fillStyle = cabGrad;
  ctx.beginPath();
  ctx.roundRect(kx, ky, kw, kh, 5);
  ctx.fill();

  const stoneTop = ctx.createLinearGradient(kx + 5, ky + 5, kx + kw - 5, ky + kh - 18);
  stoneTop.addColorStop(0, '#F5F5F4');
  stoneTop.addColorStop(1, '#D6D3D1');
  ctx.fillStyle = stoneTop;
  ctx.beginPath();
  ctx.roundRect(kx + 5, ky + 5, kw - 10, kh - 20, 4);
  ctx.fill();

  // Cabinet front drawer seams
  ctx.strokeStyle = 'rgba(28, 25, 23, 0.45)';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(kx + 8, ky + kh - 13, 42, 9);
  ctx.strokeRect(kx + 56, ky + kh - 13, 42, 9);
  ctx.strokeRect(kx + 104, ky + kh - 13, 40, 9);

  // Enlarged Stainless Sink & Chrome Faucet
  ctx.fillStyle = '#94A3B8';
  ctx.beginPath();
  ctx.roundRect(kx + 12, ky + 12, 46, 40, 4);
  ctx.fill();
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.roundRect(kx + 17, ky + 17, 36, 30, 3);
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(kx + 35, ky + 15, 6, Math.PI, Math.PI * 2);
  ctx.stroke();

  // Enlarged Cutting board & shallots
  ctx.fillStyle = '#B45309';
  ctx.beginPath();
  ctx.roundRect(kx + 65, ky + 16, 22, 32, 3);
  ctx.fill();
  ctx.fillStyle = '#A21CAF';
  ctx.beginPath();
  ctx.arc(kx + 76, ky + 30, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Enlarged 2-Burner Stove & Simmering Copper Pot
  ctx.fillStyle = '#1C1917';
  ctx.beginPath();
  ctx.roundRect(kx + 94, ky + 10, 50, 46, 4);
  ctx.fill();
  ctx.strokeStyle = '#78716C';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(kx + 108, ky + 34, 9.5, 0, Math.PI * 2);
  ctx.arc(kx + 131, ky + 34, 9.5, 0, Math.PI * 2);
  ctx.stroke();

  const potGrad = ctx.createRadialGradient(kx + 129, ky + 31, 2, kx + 131, ky + 34, 11);
  potGrad.addColorStop(0, '#FDBA74');
  potGrad.addColorStop(0.6, '#EA580C');
  potGrad.addColorStop(1, '#7C2D12');
  ctx.fillStyle = potGrad;
  ctx.beginPath();
  ctx.arc(kx + 131, ky + 34, 10.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FED7AA';
  ctx.beginPath();
  ctx.arc(kx + 131, ky + 33, 3.8, 0, Math.PI * 2);
  ctx.fill();

  drawVolumetricSmoke(ctx, kx + 131, ky + 20, t * 1.4, 4, 24, 3.5, '255, 255, 255');

  // Refrigerator 2x larger & next to Dapur (tx: 15..16, ty: 3..4)
  const fridgeSprite = getCachedFridgeSprite();
  if (!fridgeSprite) {
    void preloadFridgeSprite();
  }
  const fridgeBottomY = ky + kh; // aligned flush with front edge of Dapur
  const fridgeCenterX = 16 * s + 8;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(fridgeCenterX + 2, fridgeBottomY + 2, 34, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  if (fridgeSprite) {
    const targetH = 122;
    const aspect = fridgeSprite.width / Math.max(1, fridgeSprite.height);
    const drawW = Math.min(82, Math.round(targetH * aspect));
    const drawH = Math.round(drawW / Math.max(0.1, aspect));
    ctx.drawImage(
      fridgeSprite,
      Math.round(fridgeCenterX - drawW * 0.5),
      Math.round(fridgeBottomY - drawH),
      drawW,
      drawH
    );
  } else {
    const fw = 72;
    const fh = 114;
    const fx = fridgeCenterX - fw * 0.5;
    const fy = fridgeBottomY - fh;
    const fGrad = ctx.createLinearGradient(fx, fy, fx + fw, fy);
    fGrad.addColorStop(0, '#E2E8F0');
    fGrad.addColorStop(0.5, '#CBD5E1');
    fGrad.addColorStop(1, '#94A3B8');
    ctx.fillStyle = fGrad;
    ctx.beginPath();
    ctx.roundRect(fx, fy, fw, fh, 6);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Cabinet (Lemari) 2x larger & flush against Room 2/3 divider wall (tx: 17..18, ty: 3..4)
  const cabinetSprite = getCachedCabinetSprite();
  if (!cabinetSprite) {
    void preloadCabinetSprite();
  }
  const cabRightX = 19 * s - 2; // flush against divider wall at tx=19
  const cabBottomY = fridgeBottomY;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(cabRightX - 42, cabBottomY + 2, 38, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  if (cabinetSprite) {
    const targetH = 122;
    const aspect = cabinetSprite.width / Math.max(1, cabinetSprite.height);
    const drawW = Math.min(86, Math.round(targetH * aspect));
    const drawH = Math.round(drawW / Math.max(0.1, aspect));
    ctx.drawImage(
      cabinetSprite,
      Math.round(cabRightX - drawW),
      Math.round(cabBottomY - drawH),
      drawW,
      drawH
    );
  } else {
    const cw = 78;
    const ch = 114;
    const cx = cabRightX - cw;
    const cy = cabBottomY - ch;
    ctx.fillStyle = '#92400E';
    ctx.beginPath();
    ctx.roundRect(cx, cy, cw, ch, 5);
    ctx.fill();
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Bookcase & Farm Archive 2x larger (tx: 25..28, ty: 3..4 -> 176 x 88px)
  const shX = 25 * s + 6;
  const shY = 3 * s + 2;
  const shW = 176; // 2x (was 88)
  const shH = 88; // 2x (was 44)
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.roundRect(shX + 2, shY + 6, shW, shH, 5);
  ctx.fill();
  const shGrad = ctx.createLinearGradient(shX, shY, shX + shW, shY + shH);
  shGrad.addColorStop(0, '#7C4A26');
  shGrad.addColorStop(1, '#4A2812');
  ctx.fillStyle = shGrad;
  ctx.beginPath();
  ctx.roundRect(shX, shY, shW, shH, 5);
  ctx.fill();

  // Carved top crown cornice
  ctx.fillStyle = '#925B33';
  ctx.beginPath();
  ctx.roundRect(shX - 3, shY - 2, shW + 6, 7, 2);
  ctx.fill();

  const bookColors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#A855F7', '#06B6D4', '#EC4899', '#84CC16'];
  for (let row = 0; row < 3; row++) {
    const sy = shY + 8 + row * 25;
    ctx.fillStyle = '#2B170A';
    ctx.fillRect(shX + 7, sy, shW - 14, 20);
    for (let b = 0; b < 14; b++) {
      // Leave small gap on shelf 2 for golden globe/decor
      if (row === 0 && b >= 11) continue;
      ctx.fillStyle = bookColors[(b + row * 3) % bookColors.length];
      const bhBook = 13 + ((b * 2 + row) % 4) * 1.6;
      ctx.beginPath();
      ctx.roundRect(shX + 10 + b * 11, sy + (20 - bhBook), 8.5, bhBook, 1.5);
      ctx.fill();
    }
  }
  // Golden desk globe & rolled parchment on top shelf right
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  ctx.arc(shX + shW - 22, shY + 19, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#92400E';
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

/**
 * Draws Sofa (tx: 14..16, ty: 6..7) and PC Workstation (tx: 23..26, ty: 11..12) depth-sorted against playerY
 * so walking behind them vs in front of them feels genuinely 2.5D!
 */
export function drawHouseDepthFurniture(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  layer: 'BEHIND_PLAYER' | 'IN_FRONT_OF_PLAYER'
) {
  const s = TILE_SIZE;
  const playerTy = state.playerY;
  const t = state.elapsedTime;

  const drawSofa = () => {
    const sx = 14 * s + 3;
    const sy = 6 * s + 4;
    const sw = s * 3 - 6; // horizontal length unchanged
    const sh = s * 2 - 10; // widened downward 2x (ty: 6..7)

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.roundRect(sx + 2, sy + sh - 4, sw, 11, 6);
    ctx.fill();

    // Extruded walnut base
    const baseGrad = ctx.createLinearGradient(0, sy, 0, sy + sh);
    baseGrad.addColorStop(0, '#925B33');
    baseGrad.addColorStop(1, '#4A2812');
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.roundRect(sx, sy, sw, sh, 8);
    ctx.fill();

    // Plush backrest cushion
    const backGrad = ctx.createLinearGradient(0, sy + 2, 0, sy + 22);
    backGrad.addColorStop(0, '#D97706');
    backGrad.addColorStop(1, '#92400E');
    ctx.fillStyle = backGrad;
    ctx.beginPath();
    ctx.roundRect(sx + 8, sy + 2, sw - 16, 19, 6);
    ctx.fill();

    // 3 sculpted mustard seat cushions deepened 2x downward
    const seatW = (sw - 22) / 3;
    for (let i = 0; i < 3; i++) {
      const cx = sx + 10 + i * (seatW + 1);
      const seatGrad = ctx.createLinearGradient(cx, sy + 19, cx, sy + sh - 5);
      seatGrad.addColorStop(0, '#F59E0B');
      seatGrad.addColorStop(1, '#B45309');
      ctx.fillStyle = seatGrad;
      ctx.beginPath();
      ctx.roundRect(cx, sy + 19, seatW - 1, sh - 24, 6);
      ctx.fill();
      ctx.fillStyle = 'rgba(120, 53, 15, 0.35)';
      ctx.beginPath();
      ctx.arc(cx + seatW * 0.5, sy + 42, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rounded cushioned armrests
    for (const ax of [sx + 1, sx + sw - 11]) {
      const armGrad = ctx.createLinearGradient(ax, sy + 4, ax + 10, sy + sh - 2);
      armGrad.addColorStop(0, '#B45309');
      armGrad.addColorStop(1, '#78350F');
      ctx.fillStyle = armGrad;
      ctx.beginPath();
      ctx.roundRect(ax, sy + 4, 10, sh - 6, 5);
      ctx.fill();
    }

    // Angled accent throw pillows
    ctx.save();
    ctx.translate(sx + 20, sy + 20);
    ctx.rotate(-0.18);
    ctx.fillStyle = '#0D9488';
    ctx.beginPath();
    ctx.roundRect(-8, -6.5, 16, 13, 4);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(sx + sw - 20, sy + 20);
    ctx.rotate(0.18);
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.roundRect(-8, -6.5, 16, 13, 4);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  };

  const drawPCWorkstation = () => {
    const dx = 23 * s + 4;
    const dy = 11 * s + 18;
    const dw = s * 4 - 8;
    const dh = s * 1.5 - 6;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.roundRect(dx + 3, dy + 8, dw, dh + 5, 8);
    ctx.fill();

    // Ergonomic swivel chair
    const chairX = dx + dw * 0.44;
    const chairY = dy + dh - 2;
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.roundRect(chairX - 24, chairY - 6, 48, 22, 9);
    ctx.fill();
    const seatCush = ctx.createLinearGradient(0, chairY + 1, 0, chairY + 15);
    seatCush.addColorStop(0, '#475569');
    seatCush.addColorStop(1, '#1E293B');
    ctx.fillStyle = seatCush;
    ctx.beginPath();
    ctx.roundRect(chairX - 20, chairY + 2, 40, 13, 6);
    ctx.fill();
    ctx.fillStyle = '#0EA5E9';
    ctx.beginPath();
    ctx.roundRect(chairX - 10, chairY + 5, 20, 4, 2);
    ctx.fill();

    // Wide Executive Walnut Desk with 2.5D bevel & front apron
    const deskGrad = ctx.createLinearGradient(dx, dy, dx + dw, dy + dh);
    deskGrad.addColorStop(0, '#8B5E3C');
    deskGrad.addColorStop(0.55, '#6E472B');
    deskGrad.addColorStop(1, '#4A2812');
    ctx.fillStyle = deskGrad;
    ctx.beginPath();
    ctx.roundRect(dx, dy, dw, dh, 7);
    ctx.fill();
    ctx.fillStyle = '#3B1E0D';
    ctx.fillRect(dx + 3, dy + dh - 9, dw - 6, 7);

    // Desk Mat + Backlit Mechanical Keyboard + Mouse
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.roundRect(dx + 36, dy + 32, 84, 24, 4);
    ctx.fill();

    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.roundRect(dx + 42, dy + 36, 52, 15, 2.5);
    ctx.fill();
    ctx.fillStyle = '#334155';
    for (let r = 0; r < 3; r++) {
      ctx.fillRect(dx + 45, dy + 38 + r * 4, 46, 2.5);
    }
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(dx + 44, dy + 49, 48, 2);

    ctx.fillStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.ellipse(dx + 107, dy + 44, 5.5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(dx + 106, dy + 39, 2, 4);

    // Studio Speakers
    for (const spX of [dx + 24, dx + 124]) {
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.roundRect(spX, dy + 8, 13, 20, 3);
      ctx.fill();
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(spX + 6.5, dy + 19, 3.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ultra-Wide TaniNet Monitor
    const monW = 88;
    const monH = 44;
    const monX = dx + 36;
    const monY = dy - 16;

    ctx.fillStyle = '#334155';
    ctx.fillRect(monX + monW / 2 - 8, monY + monH - 2, 16, 12);
    ctx.beginPath();
    ctx.roundRect(monX + monW / 2 - 20, monY + monH + 7, 40, 6, 2);
    ctx.fill();

    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(monX, monY, monW, monH, 5);
    ctx.fill();
    ctx.stroke();

    const screenGrad = ctx.createLinearGradient(monX + 4, monY + 4, monX + monW - 4, monY + monH - 5);
    screenGrad.addColorStop(0, '#0284C7');
    screenGrad.addColorStop(1, '#0C4A6E');
    ctx.fillStyle = screenGrad;
    ctx.fillRect(monX + 4, monY + 4, monW - 8, monH - 9);
    ctx.fillStyle = '#082F49';
    ctx.fillRect(monX + 4, monY + 4, monW - 8, 7);
    ctx.fillStyle = '#34D399';
    ctx.beginPath();
    ctx.roundRect(monX + 8, monY + 14, 30, 10, 2);
    ctx.fill();
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.roundRect(monX + 42, monY + 14, 34, 10, 2);
    ctx.fill();
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.roundRect(monX + 8, monY + 27, 48, 8, 2);
    ctx.fill();
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.roundRect(monX + 60, monY + 27, 16, 8, 2);
    ctx.fill();

    const scrGlow = 0.16 + Math.sin(t * 2.5) * 0.04;
    const deskAura = ctx.createRadialGradient(monX + monW / 2, dy + 34, 6, monX + monW / 2, dy + 34, 52);
    deskAura.addColorStop(0, `rgba(56, 189, 248, ${scrGlow})`);
    deskAura.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = deskAura;
    ctx.beginPath();
    ctx.ellipse(monX + monW / 2, dy + 34, 52, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // RGB Workstation PC Tower with spinning fans
    const twX = dx + dw - 38;
    const twY = dy - 4;
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.roundRect(twX, twY, 30, 52, 4);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(twX + 4, twY + 5, 22, 38);
    ctx.fillStyle = '#22D3EE';
    ctx.fillRect(twX + 5, twY + 6, 3, 36);
    ctx.strokeStyle = '#34D399';
    ctx.lineWidth = 1.6;
    for (const fy of [twY + 15, twY + 31]) {
      ctx.beginPath();
      ctx.arc(twX + 17, fy, 5.5, 0, Math.PI * 2);
      ctx.stroke();
      const spin = t * 6;
      ctx.beginPath();
      ctx.moveTo(twX + 17 + Math.cos(spin) * 4, fy + Math.sin(spin) * 4);
      ctx.lineTo(twX + 17 - Math.cos(spin) * 4, fy - Math.sin(spin) * 4);
      ctx.stroke();
    }

    // Steaming Kopi Mug & Warm Desk Lamp
    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.arc(dx + 15, dy + 44, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#451A03';
    ctx.beginPath();
    ctx.arc(dx + 15, dy + 44, 3.8, 0, Math.PI * 2);
    ctx.fill();
    drawVolumetricSmoke(ctx, dx + 15, dy + 38, t * 1.1, 2, 14, 2, '248, 250, 252');

    const dLamp = ctx.createRadialGradient(dx + 12, dy + 14, 1, dx + 13, dy + 15, 8);
    dLamp.addColorStop(0, '#FEF08A');
    dLamp.addColorStop(1, '#D97706');
    ctx.fillStyle = dLamp;
    ctx.beginPath();
    ctx.arc(dx + 13, dy + 15, 7.5, 0, Math.PI * 2);
    ctx.fill();
    const lHalo = ctx.createRadialGradient(dx + 13, dy + 15, 3, dx + 13, dy + 15, 22);
    lHalo.addColorStop(0, 'rgba(253, 224, 71, 0.28)');
    lHalo.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = lHalo;
    ctx.beginPath();
    ctx.arc(dx + 13, dy + 15, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  const pcFront = playerTy < 12.75;
  if ((layer === 'IN_FRONT_OF_PLAYER') === pcFront) {
    drawPCWorkstation();
  }

  const sofaFront = playerTy < 7.85;
  if ((layer === 'IN_FRONT_OF_PLAYER') === sofaFront) {
    drawSofa();
  }

  // Front stone pool rim & water shimmer over lower torso when player is bathing in 2x pool
  if (layer === 'IN_FRONT_OF_PLAYER' && state.isBathing) {
    const pxPool = 2 * s + 3;
    const pyPool = 6 * s + 3;
    const pwPool = 6 * s - 6;
    const phPool = 4 * s - 6;
    ctx.save();
    const frontWater = ctx.createLinearGradient(0, pyPool + phPool - 84, 0, pyPool + phPool - 18);
    frontWater.addColorStop(0, 'rgba(34, 211, 238, 0.35)');
    frontWater.addColorStop(1, 'rgba(14, 116, 144, 0.8)');
    ctx.fillStyle = frontWater;
    ctx.fillRect(pxPool + 16, pyPool + phPool - 84, pwPool - 32, 66);
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(pxPool, pyPool + phPool - 18, pwPool, 18, [0, 0, 18, 18]);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
