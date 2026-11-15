import { CROPS } from '../data/cropsAndItems';
import { PlotState, WorldObject } from '../types/game';
import { TILE_SIZE } from './maps';

// ============================================================================
// COHERENT WIND FIELD & 2.5D NATURALISTIC BOTANICAL HELPERS
// ============================================================================
function getWindForce(wx: number, wy: number, elapsedTime: number): number {
  const gust = Math.sin(elapsedTime * 1.15 + wx * 0.014 + wy * 0.009);
  const eddy = Math.sin(elapsedTime * 2.85 + wx * 0.042 - wy * 0.031) * 0.38;
  const micro = Math.cos(elapsedTime * 4.4 + wx * 0.08 + wy * 0.05) * 0.14;
  return (gust + eddy + micro) * 2.15;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/**
 * Natural 2.5D gradient-shaded leaf blade with soft tonal rim, midrib vein,
 * and subtle lateral venation (zero rigid cartoon borders).
 */
function drawLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  wid: number,
  angle: number,
  fill: string,
  highlight?: string,
  edgeTone = 'rgba(14, 58, 30, 0.42)'
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const grad = ctx.createLinearGradient(0, -wid, len, wid);
  grad.addColorStop(0, highlight ?? fill);
  grad.addColorStop(0.55, fill);
  grad.addColorStop(1, 'rgba(10, 46, 24, 0.92)');

  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.28, -wid * 1.05, len * 0.72, -wid * 0.68, len, 0);
  ctx.bezierCurveTo(len * 0.72, wid * 0.68, len * 0.28, wid * 1.05, 0, 0);
  ctx.closePath();
  ctx.fill();

  // Soft sunlit lamina gradient overlay
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = edgeTone;
  ctx.lineWidth = 0.7;
  ctx.stroke();

  // Midrib & delicate curved lateral veins
  ctx.strokeStyle = highlight ?? 'rgba(220, 252, 231, 0.52)';
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.moveTo(len * 0.08, 0);
  ctx.quadraticCurveTo(len * 0.5, -wid * 0.08, len * 0.88, 0);
  if (len >= 10) {
    ctx.moveTo(len * 0.35, 0);
    ctx.lineTo(len * 0.52, -wid * 0.42);
    ctx.moveTo(len * 0.35, 0);
    ctx.lineTo(len * 0.52, wid * 0.42);
    ctx.moveTo(len * 0.62, 0);
    ctx.lineTo(len * 0.76, -wid * 0.3);
  }
  ctx.stroke();

  ctx.restore();
}

function drawPlantGroundShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  const grad = ctx.createRadialGradient(cx + 1.5, cy, rx * 0.15, cx + 1.5, cy, rx);
  grad.addColorStop(0, 'rgba(18, 12, 8, 0.34)');
  grad.addColorStop(0.65, 'rgba(18, 12, 8, 0.14)');
  grad.addColorStop(1, 'rgba(18, 12, 8, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx + 1.5, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawSeedStage(
  ctx: CanvasRenderingContext2D,
  cropId: string,
  cx: number,
  cy: number,
  watered: boolean
) {
  // Organic 3D soil mound cradling the planted seeds
  const moundGrad = ctx.createRadialGradient(cx - 2, cy + 5, 2, cx, cy + 7, 13);
  moundGrad.addColorStop(0, watered ? 'rgba(56, 35, 22, 0.75)' : 'rgba(116, 79, 48, 0.72)');
  moundGrad.addColorStop(1, 'rgba(30, 18, 10, 0)');
  ctx.fillStyle = moundGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 7, 13, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (cropId === 'padi_sawah' || cropId === 'kangkung') {
    const puddleGrad = ctx.createRadialGradient(cx - 2, cy + 5, 2, cx, cy + 6, 15);
    puddleGrad.addColorStop(0, 'rgba(125, 211, 252, 0.42)');
    puddleGrad.addColorStop(0.7, 'rgba(14, 165, 233, 0.25)');
    puddleGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');
    ctx.fillStyle = puddleGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 6, 15.5, 6.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cropId === 'padi_sawah' ? '#EAB308' : '#34D399';
    for (const [ox, oy, ang] of [
      [-6, 5, -0.35],
      [0.5, 7, 0.22],
      [6, 4, 0.48],
      [-2, 3, -0.52],
    ]) {
      ctx.save();
      ctx.translate(cx + ox, cy + oy);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.ellipse(0, 0, 2.7, 1.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    return;
  }

  if (cropId === 'singkong') {
    ctx.save();
    ctx.translate(cx, cy + 7);
    ctx.rotate(-0.24);
    const stemGrad = ctx.createLinearGradient(-2.5, 0, 2.5, 0);
    stemGrad.addColorStop(0, '#B45309');
    stemGrad.addColorStop(0.5, '#92400E');
    stemGrad.addColorStop(1, '#451A03');
    ctx.fillStyle = stemGrad;
    roundRect(ctx, -2.5, -11, 5, 13, 1.8);
    ctx.fill();
    ctx.fillStyle = '#84CC16';
    ctx.beginPath();
    ctx.ellipse(2.6, -8.2, 2.4, 1.4, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (cropId === 'bawang_merah' || cropId === 'talas') {
    const bulbColor = cropId === 'bawang_merah' ? '#A21CAF' : '#7C3AED';
    const bulbHi = cropId === 'bawang_merah' ? '#F0ABFC' : '#C4B5FD';
    const tipColor = cropId === 'bawang_merah' ? '#84CC16' : '#4ADE80';
    for (const [bx, by, rx, ry] of [
      [cx - 4, cy + 6, 4.2, 3.6],
      [cx + 4, cy + 6.5, 3.8, 3.3],
    ]) {
      const bGrad = ctx.createRadialGradient(bx - 1, by - 1, 0.5, bx, by, rx);
      bGrad.addColorStop(0, bulbHi);
      bGrad.addColorStop(0.65, bulbColor);
      bGrad.addColorStop(1, '#3B0764');
      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = tipColor;
      ctx.beginPath();
      ctx.moveTo(bx - 1.2, by - ry + 0.5);
      ctx.quadraticCurveTo(bx - 0.5, by - ry - 4.5, bx + 0.5, by - ry - 5);
      ctx.lineTo(bx + 1.4, by - ry + 0.5);
      ctx.fill();
    }
    return;
  }

  const seedColor =
    cropId === 'jagung_manis'
      ? '#FACC15'
      : cropId === 'semangka'
      ? '#1E293B'
      : cropId === 'kacang_tanah'
      ? '#D97706'
      : cropId === 'kedelai'
      ? '#FDE047'
      : '#E7B98A';

  for (const [ox, oy, r] of [
    [-6, 5, 2.2],
    [0, 6.5, 2.4],
    [6, 4.5, 2.1],
    [-1, 2.5, 1.9],
  ]) {
    ctx.fillStyle = seedColor;
    ctx.strokeStyle = 'rgba(69, 26, 3, 0.55)';
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.ellipse(cx + ox, cy + oy, r + 0.4, r - 0.3, ox * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawSproutStage(
  ctx: CanvasRenderingContext2D,
  cropId: string,
  cx: number,
  cy: number,
  sway: number,
  sproutColor: string,
  leafColor: string
) {
  drawPlantGroundShadow(ctx, cx, cy + 8, 8.5, 3.2);

  if (cropId === 'padi_sawah' || cropId === 'kangkung' || cropId === 'bawang_merah') {
    ctx.lineCap = 'round';
    for (const [ox, h] of [
      [-5, 14],
      [-1.5, 16.5],
      [2, 15.5],
      [5.5, 13],
    ]) {
      ctx.strokeStyle = ox < 0 ? leafColor : sproutColor;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(cx + ox, cy + 7.5);
      ctx.quadraticCurveTo(
        cx + ox + sway * 0.45,
        cy + 1,
        cx + ox * 1.25 + sway * 0.8,
        cy + 7.5 - h
      );
      ctx.stroke();
    }
    return;
  }

  if (cropId === 'talas') {
    ctx.strokeStyle = '#15803D';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 8);
    ctx.quadraticCurveTo(cx + sway * 0.25, cy + 2, cx + sway * 0.45, cy - 4);
    ctx.stroke();
    drawLeaf(ctx, cx + sway * 0.45, cy - 4, 8.5, 4.2, -0.35 + sway * 0.03, sproutColor, '#A7F3D0');
    return;
  }

  ctx.strokeStyle = leafColor;
  ctx.lineWidth = 2.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy + 8);
  ctx.quadraticCurveTo(cx + sway * 0.15, cy + 3, cx + sway * 0.35, cy - 1);
  ctx.stroke();

  drawLeaf(ctx, cx + sway * 0.35, cy - 1, 9.5, 3.9, -2.5 + sway * 0.03, sproutColor, '#BEF264');
  drawLeaf(ctx, cx + sway * 0.35, cy - 1, 9.5, 3.9, -0.58 + sway * 0.03, sproutColor, '#BEF264');
}

function drawGrowingCrop(
  ctx: CanvasRenderingContext2D,
  cropId: string,
  cx: number,
  cy: number,
  sway: number,
  sprout: string,
  leaf: string
) {
  drawPlantGroundShadow(ctx, cx, cy + 9, 13, 4.5);

  switch (cropId) {
    case 'jagung_manis': {
      const stalkGrad = ctx.createLinearGradient(cx - 2, cy - 16, cx + 2, cy + 10);
      stalkGrad.addColorStop(0, '#4ADE80');
      stalkGrad.addColorStop(1, '#14532D');
      ctx.strokeStyle = stalkGrad;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 10);
      ctx.quadraticCurveTo(cx + sway * 0.4, cy - 4, cx + sway * 0.85, cy - 17);
      ctx.stroke();
      drawLeaf(ctx, cx, cy + 4, 14.5, 4.3, -2.65 + sway * 0.02, leaf, sprout);
      drawLeaf(ctx, cx, cy + 2, 14.5, 4.3, -0.45 + sway * 0.02, leaf, sprout);
      drawLeaf(ctx, cx + sway * 0.45, cy - 5, 13.5, 3.9, -2.45 + sway * 0.03, sprout, '#D9F99D');
      drawLeaf(ctx, cx + sway * 0.45, cy - 6, 13.5, 3.9, -0.6 + sway * 0.03, sprout, '#D9F99D');
      break;
    }
    case 'padi_sawah': {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.24)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 8, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let i = -3; i <= 3; i++) {
        ctx.strokeStyle = i % 2 === 0 ? leaf : sprout;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(cx + i * 2.9, cy + 9);
        ctx.quadraticCurveTo(
          cx + i * 3.5 + sway * 0.5,
          cy - 2,
          cx + i * 4.8 + sway * 1.0,
          cy - 13 + Math.abs(i)
        );
        ctx.stroke();
      }
      break;
    }
    case 'kangkung': {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 8, 15, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      for (const [ox, ang] of [
        [-7, -2.3],
        [-3, -1.9],
        [2, -1.3],
        [7, -0.8],
      ]) {
        drawLeaf(ctx, cx + ox * 0.5 + sway * 0.3, cy + 6, 14, 3.6, ang + sway * 0.02, leaf, sprout);
      }
      break;
    }
    case 'talas': {
      for (const [ox, oy, sz] of [
        [-7.5, -2, 8.2],
        [7.5, -1, 8.2],
        [0, -8, 10.2],
      ]) {
        ctx.strokeStyle = '#4D7C0F';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(cx, cy + 9);
        ctx.quadraticCurveTo(cx + ox * 0.3, cy + 2, cx + ox + sway * 0.45, cy + oy);
        ctx.stroke();

        const lx = cx + ox + sway * 0.45;
        const ly = cy + oy - 2;
        const leafGrad = ctx.createRadialGradient(lx - sz * 0.25, ly - sz * 0.2, 1, lx, ly, sz);
        leafGrad.addColorStop(0, sprout);
        leafGrad.addColorStop(0.65, leaf);
        leafGrad.addColorStop(1, '#064E3B');
        ctx.fillStyle = leafGrad;
        ctx.beginPath();
        ctx.ellipse(lx, ly, sz, sz * 0.78, ox * 0.03, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'semangka': {
      ctx.strokeStyle = '#15803D';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(cx - 13, cy + 7);
      ctx.bezierCurveTo(cx - 4, cy + 1, cx + 4, cy + 8, cx + 14 + sway * 0.3, cy + 5);
      ctx.stroke();
      drawLeaf(ctx, cx - 7, cy + 4, 10.5, 5.2, -2.2, leaf, sprout);
      drawLeaf(ctx, cx + 2, cy + 3, 10.5, 5.2, -0.9, leaf, sprout);
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(cx + 9 + sway * 0.3, cy + 3, 2.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'tomat_lokal': {
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 10);
      ctx.quadraticCurveTo(cx + 1, cy - 2, cx - 0.5, cy - 16);
      ctx.stroke();
      drawLeaf(ctx, cx, cy + 3, 11.5, 4.6, -2.5 + sway * 0.02, leaf, sprout);
      drawLeaf(ctx, cx, cy + 1, 11.5, 4.6, -0.6 + sway * 0.02, leaf, sprout);
      drawLeaf(ctx, cx + sway * 0.3, cy - 7, 10.5, 4.3, -2.3 + sway * 0.03, sprout);
      drawLeaf(ctx, cx + sway * 0.3, cy - 8, 10.5, 4.3, -0.8 + sway * 0.03, sprout);
      break;
    }
    case 'singkong': {
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 10);
      ctx.quadraticCurveTo(cx + 1, cy + 1, cx + sway * 0.35, cy - 7);
      ctx.stroke();
      for (let a = 0; a < 5; a++) {
        const ang = -Math.PI * 0.9 + (a / 4) * Math.PI * 0.8 + sway * 0.02;
        drawLeaf(ctx, cx + sway * 0.35, cy - 7, 11.5, 2.8, ang, leaf, sprout);
      }
      break;
    }
    case 'bawang_merah': {
      for (let i = -2; i <= 2; i++) {
        ctx.strokeStyle = i % 2 === 0 ? '#16A34A' : '#15803D';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx + i * 3.1, cy + 9);
        ctx.quadraticCurveTo(
          cx + i * 3.8 + sway * 0.4,
          cy,
          cx + i * 4.5 + sway * 0.8,
          cy - 11 + Math.abs(i) * 1.5
        );
        ctx.stroke();
      }
      break;
    }
    default: {
      ctx.strokeStyle = '#14532D';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 9);
      ctx.quadraticCurveTo(cx + sway * 0.15, cy + 2, cx + sway * 0.35, cy - 4);
      ctx.stroke();
      drawLeaf(ctx, cx + sway * 0.2, cy + 3, 11.5, 4.6, -2.6 + sway * 0.02, leaf, sprout);
      drawLeaf(ctx, cx + sway * 0.2, cy + 3, 11.5, 4.6, -0.5 + sway * 0.02, leaf, sprout);
      drawLeaf(ctx, cx + sway * 0.35, cy - 3, 11.5, 4.6, -2.2 + sway * 0.03, sprout, '#BEF264');
      drawLeaf(ctx, cx + sway * 0.35, cy - 3, 11.5, 4.6, -0.9 + sway * 0.03, sprout, '#BEF264');
      ctx.fillStyle = cropId === 'terong_ungu' ? '#C084FC' : '#FEF9C3';
      ctx.beginPath();
      ctx.arc(cx - 5 + sway * 0.3, cy - 5, 2.2, 0, Math.PI * 2);
      ctx.arc(cx + 5 + sway * 0.3, cy - 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawMatureCrop(
  ctx: CanvasRenderingContext2D,
  cropId: string,
  cx: number,
  cy: number,
  sway: number,
  sprout: string,
  leaf: string,
  fruit: string
) {
  drawPlantGroundShadow(ctx, cx, cy + 10, 16, 5.5);

  switch (cropId) {
    case 'jagung_manis': {
      // Curved jointed cornstalk bending with wind
      const stalkGrad = ctx.createLinearGradient(cx - 2, cy - 22, cx + 2, cy + 11);
      stalkGrad.addColorStop(0, '#4ADE80');
      stalkGrad.addColorStop(0.6, '#15803D');
      stalkGrad.addColorStop(1, '#14532D');
      ctx.strokeStyle = stalkGrad;
      ctx.lineWidth = 3.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 11);
      ctx.quadraticCurveTo(cx + sway * 0.45, cy - 6, cx + sway * 0.9, cy - 22);
      ctx.stroke();

      // Swaying feathered golden corn tassel
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 1.5;
      for (const txOff of [-4.5, -1.5, 1.5, 4.5]) {
        ctx.beginPath();
        ctx.moveTo(cx + sway * 0.9, cy - 21);
        ctx.quadraticCurveTo(
          cx + txOff * 0.6 + sway * 1.0,
          cy - 24,
          cx + txOff + sway * 1.15,
          cy - 27 + Math.abs(txOff) * 0.25
        );
        ctx.stroke();
      }

      drawLeaf(ctx, cx, cy + 4, 15.5, 4.6, -2.65 + sway * 0.02, leaf, sprout);
      drawLeaf(ctx, cx, cy + 2, 15.5, 4.6, -0.4 + sway * 0.02, leaf, sprout);
      drawLeaf(ctx, cx + sway * 0.45, cy - 8, 13.5, 4.1, -2.35 + sway * 0.03, sprout, '#D9F99D');
      drawLeaf(ctx, cx + sway * 0.45, cy - 9, 13.5, 4.1, -0.7 + sway * 0.03, sprout, '#D9F99D');

      // 3D-shaded plump golden cobs with multi-row kernels & peeling green husk
      for (const [ox, oy, ang] of [
        [-6, -3, -0.45],
        [6, -6, 0.42],
      ]) {
        ctx.save();
        ctx.translate(cx + ox + sway * 0.5, cy + oy);
        ctx.rotate(ang);
        const cobGrad = ctx.createLinearGradient(-3.5, -8, 3.5, 5);
        cobGrad.addColorStop(0, '#FEF08A');
        cobGrad.addColorStop(0.45, '#FACC15');
        cobGrad.addColorStop(1, '#CA8A04');
        ctx.fillStyle = cobGrad;
        roundRect(ctx, -3.5, -8, 7, 13, 3.2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(133, 77, 14, 0.55)';
        ctx.lineWidth = 0.65;
        ctx.stroke();
        // Kernel rows
        ctx.fillStyle = 'rgba(255, 251, 235, 0.55)';
        for (let ky = -6; ky <= 2; ky += 2.6) {
          ctx.beginPath();
          ctx.arc(-1.2, ky, 0.9, 0, Math.PI * 2);
          ctx.arc(1.1, ky + 0.6, 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#22C55E';
        ctx.beginPath();
        ctx.moveTo(-4, 0);
        ctx.quadraticCurveTo(0, 7.5, 4, 0);
        ctx.quadraticCurveTo(0, 2.5, -4, 0);
        ctx.fill();
        ctx.restore();
      }
      break;
    }

    case 'cabai_rawit': {
      ctx.strokeStyle = '#14532D';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 10);
      ctx.quadraticCurveTo(cx + sway * 0.15, cy + 2, cx + sway * 0.35, cy - 5);
      ctx.stroke();
      drawLeaf(ctx, cx, cy + 3, 12.5, 4.8, -2.55 + sway * 0.02, leaf, sprout);
      drawLeaf(ctx, cx, cy + 3, 12.5, 4.8, -0.5 + sway * 0.02, leaf, sprout);
      drawLeaf(ctx, cx + sway * 0.4, cy - 4, 13.5, 5.1, -2.2 + sway * 0.03, leaf, '#4ADE80');
      drawLeaf(ctx, cx + sway * 0.4, cy - 4, 13.5, 5.1, -0.9 + sway * 0.03, leaf, '#4ADE80');
      drawLeaf(ctx, cx + sway * 0.5, cy - 10, 10.5, 4.1, -1.6 + sway * 0.04, sprout);

      // Gravity-hanging glossy chilies swinging gently
      for (const [ox, oy, ang] of [
        [-7, -2, 0.25 + sway * 0.03],
        [7, -1, -0.22 + sway * 0.03],
        [-2, -9, 0.1 + sway * 0.04],
        [3, 3, -0.15 + sway * 0.02],
      ]) {
        ctx.save();
        ctx.translate(cx + ox + sway * 0.4, cy + oy);
        ctx.rotate(ang);
        const chiliGrad = ctx.createLinearGradient(-2, 0, 2, 9);
        chiliGrad.addColorStop(0, ox === -2 ? '#FB923C' : '#F87171');
        chiliGrad.addColorStop(0.55, ox === -2 ? '#EA580C' : '#DC2626');
        chiliGrad.addColorStop(1, '#7F1D1D');
        ctx.fillStyle = chiliGrad;
        ctx.beginPath();
        ctx.moveTo(-2, 0);
        ctx.bezierCurveTo(2.4, 3, 2.2, 6.5, 0, 9.5);
        ctx.bezierCurveTo(-2.2, 6.5, -2.8, 3, -2, 0);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
        ctx.beginPath();
        ctx.ellipse(-0.6, 3.2, 0.55, 1.8, 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#22C55E';
        ctx.fillRect(-1.4, -1.8, 2.8, 2);
        ctx.restore();
      }
      break;
    }

    case 'kedelai': {
      drawLeaf(ctx, cx - 2, cy + 3, 13.5, 5.2, -2.6 + sway * 0.02, leaf, sprout);
      drawLeaf(ctx, cx + 2, cy + 3, 13.5, 5.2, -0.5 + sway * 0.02, leaf, sprout);
      drawLeaf(ctx, cx + sway * 0.35, cy - 4, 12.5, 5, -2.1 + sway * 0.03, sprout, '#BEF264');
      drawLeaf(ctx, cx + sway * 0.35, cy - 4, 12.5, 5, -1.0 + sway * 0.03, sprout, '#BEF264');
      for (const [ox, oy, ang] of [
        [-7, 0, 0.4],
        [7, -1, -0.35],
        [0, 3, 0.2],
        [-3, -7, -0.25],
      ]) {
        ctx.save();
        ctx.translate(cx + ox + sway * 0.35, cy + oy);
        ctx.rotate(ang);
        const podGrad = ctx.createLinearGradient(-2.4, -5.5, 2.4, 5.5);
        podGrad.addColorStop(0, '#FEF08A');
        podGrad.addColorStop(0.55, '#EAB308');
        podGrad.addColorStop(1, '#A16207');
        ctx.fillStyle = podGrad;
        roundRect(ctx, -2.4, -5.5, 4.8, 11, 2.4);
        ctx.fill();
        ctx.fillStyle = 'rgba(254, 249, 195, 0.65)';
        ctx.beginPath();
        ctx.arc(-0.3, -2.5, 1.2, 0, Math.PI * 2);
        ctx.arc(-0.3, 2.2, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      break;
    }

    case 'bawang_merah': {
      for (const [ox, oy, rx, ry] of [
        [-6, 6, 5.2, 4.5],
        [6, 6.5, 5, 4.3],
        [0, 8, 5.8, 4.8],
      ]) {
        const bGrad = ctx.createRadialGradient(cx + ox - 1.4, cy + oy - 1.4, 0.6, cx + ox, cy + oy, rx);
        bGrad.addColorStop(0, '#F5D0FE');
        bGrad.addColorStop(0.45, '#A21CAF');
        bGrad.addColorStop(1, '#4A044E');
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.ellipse(cx + ox, cy + oy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.ellipse(cx + ox - 1.5, cy + oy - 1.4, 1.4, 0.85, -0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = -2; i <= 2; i++) {
        ctx.strokeStyle = i % 2 === 0 ? '#16A34A' : '#15803D';
        ctx.lineWidth = 2.7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx + i * 3, cy + 4);
        ctx.quadraticCurveTo(
          cx + i * 4 + sway * 0.5,
          cy - 5,
          cx + i * 5.2 + sway * 0.95,
          cy - 15 + Math.abs(i) * 1.5
        );
        ctx.stroke();
      }
      break;
    }

    case 'semangka': {
      ctx.strokeStyle = '#15803D';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy + 5);
      ctx.bezierCurveTo(cx - 5, cy - 5, cx + 4, cy - 3, cx + 15 + sway * 0.2, cy + 5);
      ctx.stroke();
      drawLeaf(ctx, cx - 10, cy + 2, 11.5, 5.2, -2.3 + sway * 0.02, leaf, sprout);
      drawLeaf(ctx, cx + 8, cy - 2, 11.5, 5.2, -0.6 + sway * 0.02, leaf, sprout);

      // 3D spherical shaded melon
      const melonGrad = ctx.createRadialGradient(cx - 2.8, cy + 2, 1.5, cx + 1, cy + 5, 11.5);
      melonGrad.addColorStop(0, '#4ADE80');
      melonGrad.addColorStop(0.55, '#15803D');
      melonGrad.addColorStop(1, '#052E16');
      ctx.fillStyle = melonGrad;
      ctx.beginPath();
      ctx.ellipse(cx + 1, cy + 5, 11.5, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(134, 239, 172, 0.72)';
      ctx.lineWidth = 1.9;
      for (const sx of [-5, 0, 5]) {
        ctx.beginPath();
        ctx.moveTo(cx + 1 + sx, cy - 3);
        ctx.quadraticCurveTo(cx + 1 + sx * 1.32, cy + 5, cx + 1 + sx, cy + 13);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.48)';
      ctx.beginPath();
      ctx.ellipse(cx - 3.2, cy + 1.2, 3.0, 1.5, -0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'singkong': {
      for (const [ox, oy, ang] of [
        [-6, 8, -0.3],
        [5, 8.5, 0.35],
      ]) {
        ctx.save();
        ctx.translate(cx + ox, cy + oy);
        ctx.rotate(ang);
        const tuberGrad = ctx.createLinearGradient(-6, -2.5, 6, 2.5);
        tuberGrad.addColorStop(0, '#B45309');
        tuberGrad.addColorStop(0.6, '#92400E');
        tuberGrad.addColorStop(1, '#451A03');
        ctx.fillStyle = tuberGrad;
        roundRect(ctx, -6, -2.5, 12, 5, 2.5);
        ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 8);
      ctx.quadraticCurveTo(cx + 1, cy, cx + sway * 0.38, cy - 11);
      ctx.stroke();
      for (let a = 0; a < 7; a++) {
        const ang = -Math.PI * 1.05 + (a / 6) * Math.PI * 1.1 + sway * 0.02;
        drawLeaf(ctx, cx + sway * 0.38, cy - 11, 13.5, 3, ang, leaf, sprout);
      }
      break;
    }

    case 'kacang_tanah': {
      for (let a = -2; a <= 2; a++) {
        drawLeaf(ctx, cx + a * 2 + sway * 0.3, cy - 2, 11.5, 4.7, -Math.PI / 2 + a * 0.45 + sway * 0.02, leaf, sprout);
      }
      for (const [ox, oy, ang] of [
        [-6, 7, 0.2],
        [0, 8, -0.15],
        [6, 7, -0.3],
      ]) {
        ctx.save();
        ctx.translate(cx + ox, cy + oy);
        ctx.rotate(ang);
        const shellGrad = ctx.createRadialGradient(-1, -1, 0.5, 0, 0, 5);
        shellGrad.addColorStop(0, '#FDE68A');
        shellGrad.addColorStop(0.55, '#D97706');
        shellGrad.addColorStop(1, '#78350F');
        ctx.fillStyle = shellGrad;
        ctx.beginPath();
        ctx.arc(-2.3, 0, 3, 0, Math.PI * 2);
        ctx.arc(2.3, 0, 2.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      break;
    }

    case 'tomat_lokal': {
      // Natural crooked bamboo stake
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 2.7;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 11);
      ctx.quadraticCurveTo(cx + 1.2, cy - 4, cx - 0.5, cy - 18);
      ctx.stroke();
      drawLeaf(ctx, cx, cy + 2, 12.5, 4.8, -2.5 + sway * 0.02, leaf, sprout);
      drawLeaf(ctx, cx, cy + 2, 12.5, 4.8, -0.6 + sway * 0.02, leaf, sprout);
      drawLeaf(ctx, cx + sway * 0.35, cy - 9, 12.5, 4.5, -2.2 + sway * 0.03, leaf, '#4ADE80');
      drawLeaf(ctx, cx + sway * 0.35, cy - 9, 12.5, 4.5, -0.9 + sway * 0.03, leaf, '#4ADE80');

      for (const [ox, oy] of [
        [-7, -4],
        [7, -2],
        [-4, 5],
        [5, 6],
      ]) {
        const tx = cx + ox + sway * 0.35;
        const ty = cy + oy;
        const tomGrad = ctx.createRadialGradient(tx - 1.6, ty - 1.6, 0.6, tx, ty, 4.8);
        tomGrad.addColorStop(0, '#FCA5A5');
        tomGrad.addColorStop(0.42, '#DC2626');
        tomGrad.addColorStop(1, '#7F1D1D');
        ctx.fillStyle = tomGrad;
        ctx.beginPath();
        ctx.arc(tx, ty, 4.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.52)';
        ctx.beginPath();
        ctx.arc(tx - 1.5, ty - 1.5, 1.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#15803D';
        ctx.fillRect(tx - 1.4, ty - 5.3, 2.8, 1.8);
      }
      break;
    }

    case 'terong_ungu': {
      drawLeaf(ctx, cx - 2, cy - 2, 13.5, 5.5, -2.4 + sway * 0.02, leaf, sprout);
      drawLeaf(ctx, cx + 2, cy - 2, 13.5, 5.5, -0.7 + sway * 0.02, leaf, sprout);
      drawLeaf(ctx, cx + sway * 0.35, cy - 9, 11.5, 4.5, -1.6 + sway * 0.03, sprout, '#A7F3D0');

      for (const [ox, oy, ang] of [
        [-6, 1, 0.25 + sway * 0.02],
        [6, 2, -0.22 + sway * 0.02],
      ]) {
        ctx.save();
        ctx.translate(cx + ox + sway * 0.35, cy + oy);
        ctx.rotate(ang);
        const eggGrad = ctx.createLinearGradient(-3.5, -2, 3.5, 8);
        eggGrad.addColorStop(0, '#A855F7');
        eggGrad.addColorStop(0.5, '#7E22CE');
        eggGrad.addColorStop(1, '#3B0764');
        ctx.fillStyle = eggGrad;
        ctx.beginPath();
        ctx.moveTo(-2.5, -3);
        ctx.quadraticCurveTo(-5, 6, 0, 8.5);
        ctx.quadraticCurveTo(5, 6, 2.5, -3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(243, 232, 255, 0.55)';
        ctx.beginPath();
        ctx.ellipse(-1.2, 2, 0.9, 2.5, 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#22C55E';
        ctx.beginPath();
        ctx.moveTo(-3.5, -2);
        ctx.lineTo(0, -6);
        ctx.lineTo(3.5, -2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      break;
    }

    case 'padi_sawah': {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.32)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 9, 17, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();

      for (let i = -3; i <= 3; i++) {
        const baseX = cx + i * 3.3;
        const tipX = cx + i * 5.2 + sway * 0.95;
        const tipY = cy - 13 + Math.abs(i) * 1.4;
        ctx.strokeStyle = '#16A34A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(baseX, cy + 9);
        ctx.quadraticCurveTo(baseX + sway * 0.4, cy - 4, tipX, tipY);
        ctx.stroke();

        // Gravity-bowed heavy golden grain panicle
        ctx.strokeStyle = '#EAB308';
        ctx.lineWidth = 2.9;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.quadraticCurveTo(tipX + (i < 0 ? -4.5 : 4.5), tipY + 2.2, tipX + (i < 0 ? -6.5 : 6.5), tipY + 7.5);
        ctx.stroke();
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(tipX + (i < 0 ? -4.5 : 4.5), tipY + 4, 1.45, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'kangkung': {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 9, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      for (const [ox, ang, c] of [
        [-9, -2.5, leaf],
        [-5, -2.1, sprout],
        [-1, -1.65, leaf],
        [4, -1.25, sprout],
        [8, -0.7, leaf],
      ] as const) {
        drawLeaf(ctx, cx + ox * 0.45 + sway * 0.35, cy + 6, 16, 4.2, ang + sway * 0.02, c, '#A7F3D0');
      }
      ctx.fillStyle = '#F5F3FF';
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.7)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(cx + 3 + sway * 0.4, cy - 7, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'talas': {
      const cormGrad = ctx.createRadialGradient(cx - 2, cy + 7.5, 1, cx, cy + 9, 7);
      cormGrad.addColorStop(0, '#C4B5FD');
      cormGrad.addColorStop(0.55, '#7C3AED');
      cormGrad.addColorStop(1, '#3B0764');
      ctx.fillStyle = cormGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 9, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      for (const [ox, oy, r] of [
        [-8, -1, 9],
        [8, 0, 9],
        [0, -9, 11],
      ]) {
        ctx.strokeStyle = '#65A30D';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(cx, cy + 7);
        ctx.quadraticCurveTo(cx + ox * 0.3, cy + 1, cx + ox + sway * 0.4, cy + oy);
        ctx.stroke();

        const lx = cx + ox + sway * 0.45;
        const ly = cy + oy - 2;
        const taroGrad = ctx.createRadialGradient(lx - r * 0.25, ly - r * 0.2, 1, lx, ly, r);
        taroGrad.addColorStop(0, sprout);
        taroGrad.addColorStop(0.65, leaf);
        taroGrad.addColorStop(1, '#064E3B');
        ctx.fillStyle = taroGrad;
        ctx.beginPath();
        ctx.ellipse(lx, ly, r, r * 0.82, ox * 0.02, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(167, 243, 208, 0.65)';
        ctx.lineWidth = 0.85;
        ctx.beginPath();
        ctx.moveTo(lx, ly - r * 0.52);
        ctx.lineTo(lx, ly + r * 0.52);
        ctx.moveTo(lx - r * 0.52, ly);
        ctx.lineTo(lx + r * 0.52, ly);
        ctx.stroke();
      }
      break;
    }

    default: {
      drawLeaf(ctx, cx, cy, 13, 5, -2.3 + sway * 0.02, leaf, sprout);
      drawLeaf(ctx, cx, cy, 13, 5, -0.8 + sway * 0.02, leaf, sprout);
      ctx.fillStyle = fruit;
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawSoilBed(
  ctx: CanvasRenderingContext2D,
  plot: PlotState,
  px: number,
  py: number
) {
  const s = TILE_SIZE;
  if (!plot.tilled) return;

  const isVolcanic = plot.scene === 'ORCHARD';
  const hash = Math.abs((plot.tx * 73856093) ^ (plot.ty * 19349663));

  // Soft outer rim blending into ground (less boxy square, organic mounded 2.5D earth)
  const bedGrad = ctx.createLinearGradient(px + 3, py + 3, px + s - 3, py + s - 3);
  if (plot.watered) {
    bedGrad.addColorStop(0, isVolcanic ? '#2F1F18' : '#4E3421');
    bedGrad.addColorStop(1, isVolcanic ? '#1C110D' : '#352214');
  } else {
    bedGrad.addColorStop(0, isVolcanic ? '#5C4233' : '#855E3B');
    bedGrad.addColorStop(1, isVolcanic ? '#422D22' : '#654429');
  }

  ctx.fillStyle = bedGrad;
  roundRect(ctx, px + 3, py + 3, s - 6, s - 6, 10);
  ctx.fill();

  // Beveled sunlit top edge & shadowed bottom rim
  ctx.strokeStyle = plot.watered
    ? 'rgba(12, 8, 5, 0.55)'
    : 'rgba(214, 165, 114, 0.35)';
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // Organic curved furrow ridges with 2.5D top highlight and deep trough shadow
  for (let row = 0; row < 3; row++) {
    const fy = py + 11.5 + row * 11;
    const wave = ((hash >> row) % 3) - 1;
    ctx.fillStyle = plot.watered ? 'rgba(10, 6, 4, 0.45)' : 'rgba(55, 32, 16, 0.34)';
    ctx.beginPath();
    ctx.moveTo(px + 7, fy);
    ctx.quadraticCurveTo(px + s * 0.5, fy + 1.4 + wave * 0.6, px + s - 7, fy);
    ctx.lineTo(px + s - 7, fy + 3.4);
    ctx.quadraticCurveTo(px + s * 0.5, fy + 4.8 + wave * 0.6, px + 7, fy + 3.4);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = plot.watered ? 'rgba(125, 211, 252, 0.22)' : 'rgba(255, 240, 215, 0.14)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(px + 8, fy - 0.6);
    ctx.quadraticCurveTo(px + s * 0.5, fy + 0.8 + wave * 0.6, px + s - 8, fy - 0.6);
    ctx.stroke();
  }

  // Natural scattered dirt clods along mound edges
  ctx.fillStyle = plot.watered ? 'rgba(24, 15, 10, 0.5)' : 'rgba(92, 62, 36, 0.48)';
  for (let c = 0; c < 4; c++) {
    const cxC = px + 9 + ((hash + c * 17) % 30);
    const cyC = py + 8 + ((hash + c * 29) % 32);
    ctx.beginPath();
    ctx.ellipse(cxC, cyC, 1.5, 1.0, c * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (plot.fertilized) {
    for (const [fx, fy, c] of [
      [10, 9, '#FBBF24'],
      [34, 18, '#A3E635'],
      [15, 36, '#FBBF24'],
      [31, 33, '#84CC16'],
    ] as const) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(px + fx, py + fy, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (!plot.watered && plot.dryDays >= 1 && plot.cropId && !plot.wilted) {
    ctx.strokeStyle = 'rgba(254, 215, 170, 0.48)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(px + 9, py + 11);
    ctx.lineTo(px + 16, py + 21);
    ctx.lineTo(px + 13, py + 34);
    ctx.stroke();
  }
}

export function drawCropFoliage(
  ctx: CanvasRenderingContext2D,
  plot: PlotState,
  px: number,
  py: number,
  elapsedTime: number
) {
  if (!plot.tilled || !plot.cropId) return;
  const crop = CROPS[plot.cropId];
  if (!crop) return;

  const s = TILE_SIZE;
  const cx = px + s / 2;
  const cy = py + s / 2 + 2;
  const sway = getWindForce(cx, cy, elapsedTime);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (plot.wilted) {
    ctx.strokeStyle = '#78716C';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 10);
    ctx.quadraticCurveTo(cx + 4, cy - 2, cx + 10, cy + 6);
    ctx.stroke();
    drawLeaf(ctx, cx + 3, cy + 1, 8, 3, 0.75, '#A8A29E', undefined, 'rgba(87,83,78,0.55)');
    drawLeaf(ctx, cx - 1, cy + 3, 7, 2.8, 2.3, '#A8A29E', undefined, 'rgba(87,83,78,0.55)');
    ctx.restore();
    return;
  }

  const ratio = Math.min(1, plot.growthProgress / crop.growthDays);

  if (ratio < 0.22) {
    drawSeedStage(ctx, crop.id, cx, cy, plot.watered);
  } else if (ratio < 0.5) {
    drawSproutStage(ctx, crop.id, cx, cy, sway, crop.colors.sprout, crop.colors.leaf);
  } else if (ratio < 0.99) {
    drawGrowingCrop(ctx, crop.id, cx, cy, sway, crop.colors.sprout, crop.colors.leaf);
  } else {
    const haloGrad = ctx.createRadialGradient(cx, cy + 3, 3, cx, cy + 3, 20);
    haloGrad.addColorStop(0, 'rgba(254, 240, 138, 0.24)');
    haloGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, 20, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    drawMatureCrop(
      ctx,
      crop.id,
      cx,
      cy,
      sway,
      crop.colors.sprout,
      crop.colors.leaf,
      crop.colors.fruit
    );

    const bob = Math.sin(elapsedTime * 4.2 + plot.tx * 1.1) * 2.1;
    const sy = py + 7 + bob;
    ctx.fillStyle = '#FEF08A';
    ctx.strokeStyle = 'rgba(202, 138, 4, 0.7)';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(cx, sy - 4.6);
    ctx.lineTo(cx + 1.4, sy - 1.4);
    ctx.lineTo(cx + 4.6, sy);
    ctx.lineTo(cx + 1.4, sy + 1.4);
    ctx.lineTo(cx, sy + 4.6);
    ctx.lineTo(cx - 1.4, sy + 1.4);
    ctx.lineTo(cx - 4.6, sy);
    ctx.lineTo(cx - 1.4, sy - 1.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export function drawSoilAndCrop(
  ctx: CanvasRenderingContext2D,
  plot: PlotState,
  px: number,
  py: number,
  elapsedTime: number
) {
  drawSoilBed(ctx, plot, px, py);
  drawCropFoliage(ctx, plot, px, py, elapsedTime);
}

// ============================================================================
// VOLUMETRIC 2.5D ORGANIC FOLIAGE CLUSTERS (REPLACING RIGID SCALLOPED RINGS)
// ============================================================================
function drawOrganicCanopyPuff(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  phase: number,
  litHex: string,
  midHex: string,
  shadeHex: string,
  drawEdgeLeaves = true
) {
  const lobes = 16;
  ctx.beginPath();
  for (let i = 0; i <= lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + phase;
    const n1 = Math.sin(a * 3 + phase * 2.1) * 0.08;
    const n2 = Math.cos(a * 5 - phase * 1.4) * 0.055;
    const rMod = 1 + n1 + n2;
    const px = cx + Math.cos(a) * rx * rMod;
    const py = cy + Math.sin(a) * ry * rMod;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      const aPrev = ((i - 0.5) / lobes) * Math.PI * 2 + phase;
      const cMod = 1.07 + Math.sin(aPrev * 4 + phase) * 0.06;
      const cpx = cx + Math.cos(aPrev) * rx * cMod;
      const cpy = cy + Math.sin(aPrev) * ry * cMod;
      ctx.quadraticCurveTo(cpx, cpy, px, py);
    }
  }
  ctx.closePath();

  // Volumetric spherical shading lit from upper-left sunlight
  const grad = ctx.createRadialGradient(
    cx - rx * 0.34,
    cy - ry * 0.38,
    rx * 0.12,
    cx + rx * 0.12,
    cy + ry * 0.18,
    Math.max(rx, ry) * 1.08
  );
  grad.addColorStop(0, litHex);
  grad.addColorStop(0.55, midHex);
  grad.addColorStop(1, shadeHex);

  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = 'rgba(2, 44, 24, 0.35)';
  ctx.lineWidth = 0.85;
  ctx.stroke();

  if (drawEdgeLeaves) {
    // Organic exterior leaf sprig accents breaking circular uniformity
    for (let k = 0; k < 5; k++) {
      const ang = phase + k * 1.26;
      const lx = cx + Math.cos(ang) * rx * 0.84;
      const ly = cy + Math.sin(ang) * ry * 0.84;
      drawLeaf(ctx, lx, ly, 7.5, 2.8, ang, midHex, litHex, 'rgba(2, 44, 24, 0.32)');
    }
  }
}

function drawCoconutPalm(
  ctx: CanvasRenderingContext2D,
  obj: WorldObject,
  cx: number,
  py: number,
  sway: number
) {
  const s = TILE_SIZE;
  const baseY = py + s - 5;
  const ctrlX = cx - 9;
  const ctrlY = baseY - 62;
  const topX = cx + 5 + sway * 1.1;
  const topY = baseY - 125;

  // Directional soft ground shadow cast toward bottom-right
  const shGrad = ctx.createRadialGradient(cx + 12, py + s - 2, 4, cx + 12, py + s - 2, 34);
  shGrad.addColorStop(0, 'rgba(10, 18, 12, 0.32)');
  shGrad.addColorStop(1, 'rgba(10, 18, 12, 0)');
  ctx.fillStyle = shGrad;
  ctx.beginPath();
  ctx.ellipse(cx + 12, py + s - 2, 34, 9.5, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Root collar & grass tuft anchoring palm
  ctx.fillStyle = '#5C3A21';
  ctx.beginPath();
  ctx.ellipse(cx, baseY + 1, 7.5, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tall curved palm trunk with 3D cylindrical light gradient
  ctx.strokeStyle = '#5C2E11';
  ctx.lineWidth = 10.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, baseY);
  ctx.quadraticCurveTo(ctrlX, ctrlY, topX, topY);
  ctx.stroke();

  const trunkGrad = ctx.createLinearGradient(cx - 8, baseY, cx + 8, topY);
  trunkGrad.addColorStop(0, '#B47438');
  trunkGrad.addColorStop(0.5, '#854D27');
  trunkGrad.addColorStop(1, '#5C3016');
  ctx.strokeStyle = trunkGrad;
  ctx.lineWidth = 7.5;
  ctx.beginPath();
  ctx.moveTo(cx - 0.6, baseY - 1);
  ctx.quadraticCurveTo(ctrlX - 0.6, ctrlY, topX - 0.6, topY + 1);
  ctx.stroke();

  // Natural stepped bark rings
  ctx.strokeStyle = 'rgba(69, 26, 3, 0.68)';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  for (let i = 1; i <= 18; i++) {
    const t = i / 19;
    const inv = 1 - t;
    const rx = inv * inv * cx + 2 * inv * t * ctrlX + t * t * topX;
    const ry = inv * inv * baseY + 2 * inv * t * ctrlY + t * t * topY;
    ctx.moveTo(rx - 3.6, ry + 0.5);
    ctx.quadraticCurveTo(rx, ry + 1.6, rx + 3.6, ry - 0.8);
  }
  ctx.stroke();

  // 8 Gravity-drooping feathered 2.5D palm fronds (back shaded layer + front sunlit layer)
  const scaleX = 2.05;
  const scaleY = 2.38;
  const frondAngles = [
    { ang: -2.95, col: '#14532D', hi: '#16A34A' },
    { ang: -2.35, col: '#15803D', hi: '#22C55E' },
    { ang: -1.85, col: '#166534', hi: '#22C55E' },
    { ang: -1.25, col: '#15803D', hi: '#4ADE80' },
    { ang: -0.7, col: '#16A34A', hi: '#4ADE80' },
    { ang: -0.15, col: '#15803D', hi: '#22C55E' },
    { ang: 0.35, col: '#14532D', hi: '#16A34A' },
    { ang: -1.55, col: '#22C55E', hi: '#86EFAC' },
  ];

  for (let idx = 0; idx < frondAngles.length; idx++) {
    const { ang, col, hi } = frondAngles[idx];
    const phaseLag = sway * (0.02 + (idx % 3) * 0.005);
    const rot = ang + phaseLag;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const toCrown = (lx: number, ly: number): [number, number] => {
      const rx = lx * cos - ly * sin;
      const ry = lx * sin + ly * cos;
      return [topX + rx * scaleX, topY + ry * scaleY];
    };

    const [cpx, cpy] = toCrown(14, -7.5);
    const [tipX, tipY] = toCrown(27.5, 5.2);

    // Curved tapering gravity-drooping leaflets along rachis
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let f = 3.5; f <= 26.5; f += 1.35) {
      const t = f / 27.5;
      const fx = f;
      const fy = -7.5 * Math.sin(t * Math.PI) + t * 5.2;
      const taper = 1 - Math.abs(t - 0.42) * 0.78;
      const bladeLen = Math.max(2.6, 7.6 * taper);
      const [p1x, p1y] = toCrown(fx, fy);
      const [c1x, c1y] = toCrown(fx + 0.4, fy + bladeLen * 0.5);
      const [p2x, p2y] = toCrown(fx - 1.4, fy + bladeLen);
      const [u1x, u1y] = toCrown(fx + 0.3, fy - bladeLen * 0.35);
      const [u2x, u2y] = toCrown(fx - 0.8, fy - bladeLen * 0.65);

      ctx.moveTo(p1x, p1y);
      ctx.quadraticCurveTo(c1x, c1y, p2x, p2y);
      ctx.lineTo(p1x + 0.9, p1y + 0.4);
      ctx.closePath();

      ctx.moveTo(p1x, p1y);
      ctx.quadraticCurveTo(u1x, u1y, u2x, u2y);
      ctx.lineTo(p1x + 0.8, p1y - 0.3);
      ctx.closePath();
    }
    ctx.fill();

    // Sunlit spine highlight
    ctx.strokeStyle = hi;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(cpx, cpy, tipX, tipY);
    ctx.stroke();
  }

  // 3D shaded golden-ivory coconuts tucked in crown
  if (obj.harvestReady) {
    for (const [ox, oy] of [
      [-5, 7],
      [5, 8],
    ]) {
      const gx = topX + ox;
      const gy = topY + oy;
      const cocoGrad = ctx.createRadialGradient(gx - 1.5, gy - 1.6, 0.8, gx, gy, 4.6);
      cocoGrad.addColorStop(0, '#FEF9C3');
      cocoGrad.addColorStop(0.55, '#FACC15');
      cocoGrad.addColorStop(1, '#A16207');
      ctx.fillStyle = cocoGrad;
      ctx.beginPath();
      ctx.arc(gx, gy, 4.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawCalabashTree(
  ctx: CanvasRenderingContext2D,
  obj: WorldObject,
  cx: number,
  py: number,
  sway: number
) {
  const s = TILE_SIZE;
  const baseY = py + s - 3;
  const trunkTopY = py - 66;

  // Directional soft ground shadow
  const shGrad = ctx.createRadialGradient(cx + 12, py + s - 1, 6, cx + 12, py + s - 1, 50);
  shGrad.addColorStop(0, 'rgba(8, 16, 10, 0.36)');
  shGrad.addColorStop(0.65, 'rgba(8, 16, 10, 0.16)');
  shGrad.addColorStop(1, 'rgba(8, 16, 10, 0)');
  ctx.fillStyle = shGrad;
  ctx.beginPath();
  ctx.ellipse(cx + 12, py + s - 1, 50, 14, 0.06, 0, Math.PI * 2);
  ctx.fill();

  // Gnarled ancient trunk with flowing root buttresses & 3D cylindrical bark shading
  const trunkGrad = ctx.createLinearGradient(cx - 14, baseY, cx + 14, trunkTopY);
  trunkGrad.addColorStop(0, '#784E32');
  trunkGrad.addColorStop(0.45, '#543520');
  trunkGrad.addColorStop(1, '#2D1A0E');

  ctx.fillStyle = trunkGrad;
  ctx.beginPath();
  ctx.moveTo(cx - 16, baseY);
  ctx.bezierCurveTo(cx - 10, py + 28, cx - 8.5, py + 12, cx - 8, trunkTopY);
  ctx.lineTo(cx + 8, trunkTopY);
  ctx.bezierCurveTo(cx + 8.5, py + 12, cx + 10, py + 28, cx + 16, baseY);
  ctx.quadraticCurveTo(cx + 4, baseY + 2, cx, baseY - 1);
  ctx.quadraticCurveTo(cx - 4, baseY + 2, cx - 16, baseY);
  ctx.closePath();
  ctx.fill();

  // Organic curved bark crevices
  ctx.strokeStyle = 'rgba(30, 16, 8, 0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - 3.5, baseY - 6);
  ctx.quadraticCurveTo(cx - 1.5, py - 10, cx - 3, trunkTopY + 14);
  ctx.moveTo(cx + 3.2, baseY - 10);
  ctx.quadraticCurveTo(cx + 1.5, py - 24, cx + 2.5, trunkTopY + 18);
  ctx.stroke();

  // Mossy roots
  ctx.fillStyle = '#4D7C0F';
  ctx.beginPath();
  ctx.ellipse(cx - 8, py + s - 5.5, 5.5, 2.5, -0.2, 0, Math.PI * 2);
  ctx.ellipse(cx + 9, py + s - 5, 4.5, 2.2, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Crooked organic calabash limbs
  ctx.strokeStyle = '#3F2717';
  ctx.lineWidth = 5.0;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 4, trunkTopY + 26);
  ctx.quadraticCurveTo(cx - 28, trunkTopY + 14, cx - 48 + sway * 0.5, trunkTopY + 2);
  ctx.moveTo(cx + 4, trunkTopY + 24);
  ctx.quadraticCurveTo(cx + 30, trunkTopY + 12, cx + 50 + sway * 0.5, trunkTopY);
  ctx.stroke();

  const phase = (obj.tx * 0.7 + obj.ty * 0.4) % (Math.PI * 2);

  // Volumetric 2.5D multi-tier organic leaf clusters
  for (const [bx, by, rx, ry, phOff] of [
    [cx + sway * 0.85, py - 94, 46, 54, 0],
    [cx - 38 + sway * 0.7, py - 68, 31, 36, 0.6],
    [cx + 38 + sway * 0.7, py - 68, 31, 36, 1.3],
  ] as const) {
    drawOrganicCanopyPuff(ctx, bx, by, rx, ry, phase + phOff, '#15803D', '#065F46', '#022C22', true);
  }

  for (const [mx, my, rx, ry, phOff] of [
    [cx - 28 + sway * 0.82, py - 76, 25, 29, 0.4],
    [cx + 28 + sway * 0.82, py - 74, 25, 29, 1.1],
    [cx + sway * 0.92, py - 100, 33, 39, 1.8],
  ] as const) {
    drawOrganicCanopyPuff(ctx, mx, my, rx, ry, phase + phOff, '#4D7C0F', '#15803D', '#064E3B', false);
  }

  for (const [tx, ty, rx, ry, phOff] of [
    [cx - 12 + sway * 0.98, py - 118, 20, 21, 0.9],
    [cx + 16 + sway * 0.98, py - 101, 16, 17, 1.7],
  ] as const) {
    drawOrganicCanopyPuff(ctx, tx, ty, rx, ry, phase + phOff, '#84CC16', '#4D7C0F', '#15803D', false);
  }

  // Gravity-pendulum hanging vines
  ctx.strokeStyle = '#166534';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx - 42 + sway * 0.65, py - 42);
  ctx.quadraticCurveTo(cx - 43 + sway * 0.9, py - 29, cx - 44 + sway * 1.25, py - 16);
  ctx.moveTo(cx + 42 + sway * 0.65, py - 44);
  ctx.quadraticCurveTo(cx + 43 + sway * 0.9, py - 31, cx + 44 + sway * 1.25, py - 19);
  ctx.stroke();

  if (obj.harvestReady) {
    const gourds: [number, number, number][] = [
      [-28, -42, 5.6],
      [28, -44, 5.7],
    ];
    for (const [fx, fy, r] of gourds) {
      const gx = cx + fx + sway * 0.65;
      const gy = py + fy;
      ctx.strokeStyle = '#365314';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(gx, gy - r - 3);
      ctx.lineTo(gx, gy - r + 1);
      ctx.stroke();

      const gGrad = ctx.createRadialGradient(gx - r * 0.3, gy - r * 0.3, 0.8, gx, gy, r * 1.08);
      gGrad.addColorStop(0, '#D9F99D');
      gGrad.addColorStop(0.5, '#65A30D');
      gGrad.addColorStop(1, '#1A2E05');
      ctx.fillStyle = gGrad;
      ctx.beginPath();
      ctx.ellipse(gx, gy, r, r * 1.08, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawLushTreeOrObject(
  ctx: CanvasRenderingContext2D,
  obj: WorldObject,
  elapsedTime: number
) {
  const s = TILE_SIZE;
  const px = obj.tx * s;
  const py = obj.ty * s;
  const cx = px + s / 2;
  const cy = py + s / 2;
  const sway = getWindForce(cx, cy, elapsedTime);

  if (obj.kind === 'FRUIT_TREE' && obj.itemId === 'kelapa_gading') {
    drawCoconutPalm(ctx, obj, cx, py, sway);
    return;
  }

  if (obj.kind === 'FRUIT_TREE' && obj.itemId === 'buah_kalabas') {
    drawCalabashTree(ctx, obj, cx, py, sway);
    return;
  }

  if (obj.kind === 'TREE' || obj.kind === 'FRUIT_TREE') {
    const isDurian = obj.itemId === 'buah_durian';
    const isMango = obj.itemId === 'buah_mangga';
    const isForestLush = obj.kind === 'TREE';
    const cs = isForestLush ? 1.18 + ((obj.tx * 7 + obj.ty * 3) % 3) * 0.06 : 1.0;

    const baseY = py + s - 4;
    const trunkTopY = py - 58;

    // Directional dappled cast shadow
    const shGrad = ctx.createRadialGradient(cx + 10, baseY + 1, 5, cx + 10, baseY + 1, 46 * cs);
    shGrad.addColorStop(0, 'rgba(8, 16, 10, 0.34)');
    shGrad.addColorStop(0.65, 'rgba(8, 16, 10, 0.14)');
    shGrad.addColorStop(1, 'rgba(8, 16, 10, 0)');
    ctx.fillStyle = shGrad;
    ctx.beginPath();
    ctx.ellipse(cx + 10, baseY + 1, 46 * cs, 12.5, 0.06, 0, Math.PI * 2);
    ctx.fill();

    // Flowing root buttresses + cylindrical bark trunk
    const trunkGrad = ctx.createLinearGradient(cx - 12, baseY, cx + 12, trunkTopY);
    trunkGrad.addColorStop(0, '#855231');
    trunkGrad.addColorStop(0.5, '#5C3A21');
    trunkGrad.addColorStop(1, '#2E180B');
    ctx.fillStyle = trunkGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 14.5, baseY);
    ctx.bezierCurveTo(cx - 8.5, py + 24, cx - 7.5, py + 8, cx - 7, trunkTopY);
    ctx.lineTo(cx + 7, trunkTopY);
    ctx.bezierCurveTo(cx + 7.5, py + 8, cx + 8.5, py + 24, cx + 14.5, baseY);
    ctx.quadraticCurveTo(cx, baseY + 2, cx - 14.5, baseY);
    ctx.closePath();
    ctx.fill();

    // Organic vertical bark furrows
    ctx.strokeStyle = 'rgba(34, 18, 8, 0.55)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(cx - 2.5, baseY - 5);
    ctx.quadraticCurveTo(cx - 1, py - 10, cx - 2.5, trunkTopY + 12);
    ctx.moveTo(cx + 3, baseY - 8);
    ctx.quadraticCurveTo(cx + 1.5, py - 20, cx + 2.5, trunkTopY + 16);
    ctx.stroke();

    ctx.fillStyle = '#4D7C0F';
    ctx.beginPath();
    ctx.ellipse(cx - 6.5, py + s - 6, 5, 2.4, -0.15, 0, Math.PI * 2);
    ctx.ellipse(cx + 7, py + s - 5.5, 4, 2.0, 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Organic bough forks entering canopy
    ctx.strokeStyle = '#4A2E1A';
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 3, trunkTopY + 22);
    ctx.quadraticCurveTo(cx - 22 * cs, trunkTopY + 10, cx - 38 * cs + sway * 0.4, trunkTopY - 4);
    ctx.moveTo(cx + 3, trunkTopY + 20);
    ctx.quadraticCurveTo(cx + 22 * cs, trunkTopY + 8, cx + 38 * cs + sway * 0.4, trunkTopY - 5);
    ctx.stroke();

    const deepShadow = isDurian ? '#052E16' : '#064E3B';
    const baseLeaf = isDurian ? '#14532D' : '#15803D';
    const midLeaf = isDurian ? '#15803D' : '#16A34A';
    const topLeaf = isDurian ? '#65A30D' : isMango ? '#4ADE80' : '#22C55E';
    const phase = (obj.tx * 0.65 + obj.ty * 0.35) % (Math.PI * 2);

    // Volumetric 2.5D layered organic foliage
    for (const [bx, by, rx, ry, phOff] of [
      [cx + sway * 0.85, py - 92, 42 * cs, 46 * cs, 0],
      [cx - 34 * cs + sway * 0.7, py - 66, 30 * cs, 35 * cs, 0.7],
      [cx + 34 * cs + sway * 0.7, py - 66, 30 * cs, 35 * cs, 1.4],
    ] as const) {
      drawOrganicCanopyPuff(ctx, bx, by, rx, ry, phase + phOff, midLeaf, baseLeaf, deepShadow, true);
    }

    for (const [mx, my, rx, ry, phOff] of [
      [cx - 26 * cs + sway * 0.82, py - 72, 25 * cs, 29 * cs, 0.5],
      [cx + 26 * cs + sway * 0.82, py - 71, 24 * cs, 28 * cs, 1.2],
      [cx + sway * 0.92, py - 98, 31 * cs, 36 * cs, 1.9],
    ] as const) {
      drawOrganicCanopyPuff(ctx, mx, my, rx, ry, phase + phOff, topLeaf, midLeaf, baseLeaf, false);
    }

    for (const [tx, ty, rx, ry, phOff] of [
      [cx - 10 * cs + sway * 0.98, py - 114, 19 * cs, 21 * cs, 0.9],
      [cx + 18 * cs + sway * 0.98, py - 96, 15 * cs, 17 * cs, 1.7],
    ] as const) {
      drawOrganicCanopyPuff(ctx, tx, ty, rx, ry, phase + phOff, '#86EFAC', topLeaf, midLeaf, false);
    }

    if (isForestLush) {
      ctx.strokeStyle = '#166534';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 36 * cs + sway * 0.65, py - 42);
      ctx.quadraticCurveTo(cx - 37 * cs + sway * 0.95, py - 30, cx - 38 * cs + sway * 1.2, py - 18);
      ctx.moveTo(cx + 36 * cs + sway * 0.65, py - 43);
      ctx.quadraticCurveTo(cx + 37 * cs + sway * 0.95, py - 31, cx + 38 * cs + sway * 1.2, py - 20);
      ctx.stroke();
    }

    if (obj.kind === 'FRUIT_TREE' && obj.harvestReady) {
      if (isDurian) {
        for (const [fx, fy] of [
          [-24, -56],
          [24, -58],
        ]) {
          const x = cx + fx + sway * 0.75;
          const y = py + fy;
          const durGrad = ctx.createRadialGradient(x - 1.8, y - 1.8, 0.8, x, y, 6.4);
          durGrad.addColorStop(0, '#FEF08A');
          durGrad.addColorStop(0.55, '#CA8A04');
          durGrad.addColorStop(1, '#422006');
          ctx.fillStyle = durGrad;
          ctx.beginPath();
          ctx.ellipse(x, y, 5.6, 6.4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FEF9C3';
          ctx.fillRect(x - 1, y - 3, 1.6, 1.6);
          ctx.fillRect(x + 1.5, y + 1, 1.6, 1.6);
        }
      } else {
        for (const [fx, fy] of [
          [-24, -58],
          [24, -60],
        ]) {
          const x = cx + fx + sway * 0.75;
          const y = py + fy;
          const mGrad = ctx.createRadialGradient(x - 1.5, y - 1.8, 0.6, x, y, 5.6);
          mGrad.addColorStop(0, '#F87171');
          mGrad.addColorStop(0.45, '#F59E0B');
          mGrad.addColorStop(1, '#9A3412');
          ctx.fillStyle = mGrad;
          ctx.beginPath();
          ctx.ellipse(x, y, 4.6, 5.6, 0.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    return;
  }

  if (obj.kind === 'ROCK') {
    // Organic sculpted weathered granite boulder (non-geometric curved facets)
    const shGrad = ctx.createRadialGradient(cx + 2, cy + 12, 3, cx + 2, cy + 12, 17);
    shGrad.addColorStop(0, 'rgba(10, 15, 22, 0.36)');
    shGrad.addColorStop(1, 'rgba(10, 15, 22, 0)');
    ctx.fillStyle = shGrad;
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy + 12, 17, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const rockGrad = ctx.createRadialGradient(cx - 5, cy - 4, 2, cx, cy + 3, 18);
    rockGrad.addColorStop(0, '#94A3B8');
    rockGrad.addColorStop(0.55, '#64748B');
    rockGrad.addColorStop(1, '#334155');

    ctx.fillStyle = rockGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 14.5, cy + 8);
    ctx.bezierCurveTo(cx - 15.5, cy + 1, cx - 12, cy - 6.5, cx - 4, cy - 9.5);
    ctx.bezierCurveTo(cx + 2, cy - 11.5, cx + 10.5, cy - 7, cx + 13.5, cy - 1);
    ctx.bezierCurveTo(cx + 16, cy + 5, cx + 13, cy + 11, cx + 3, cy + 12.5);
    ctx.quadraticCurveTo(cx - 8, cy + 13, cx - 14.5, cy + 8);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.lineWidth = 0.85;
    ctx.stroke();

    // Mineral striation & moss cushion
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 2);
    ctx.quadraticCurveTo(cx - 1, cy - 2, cx + 6, cy + 1);
    ctx.stroke();

    ctx.fillStyle = '#4D7C0F';
    ctx.beginPath();
    ctx.ellipse(cx + 6.5, cy + 6.2, 4.8, 2.5, -0.25, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (obj.kind === 'TWIG') {
    drawPlantGroundShadow(ctx, cx, cy + 10, 14, 4.5);
    ctx.strokeStyle = '#6B3410';
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px + 10, py + 33);
    ctx.quadraticCurveTo(px + 23, py + 23, px + 37, py + 17);
    ctx.moveTo(px + 22, py + 26);
    ctx.quadraticCurveTo(px + 28, py + 29, px + 33, py + 35);
    ctx.stroke();

    ctx.strokeStyle = '#B47438';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px + 12, py + 31);
    ctx.quadraticCurveTo(px + 23, py + 22, px + 35, py + 17);
    ctx.stroke();
    return;
  }

  if (obj.kind === 'WEED') {
    drawPlantGroundShadow(ctx, cx, py + 37, 11, 3.8);
    for (const [ox, len, ang, col, hi] of [
      [-6, 15, -2.15, '#15803D', '#4ADE80'],
      [-2, 18, -1.75, '#16A34A', '#86EFAC'],
      [3, 17, -1.3, '#22C55E', '#86EFAC'],
      [7, 14, -0.95, '#15803D', '#4ADE80'],
    ] as const) {
      drawLeaf(ctx, cx + ox * 0.5 + sway * 0.2, py + 36, len, 3.6, ang + sway * 0.03, col, hi);
    }
    return;
  }

  if (obj.kind === 'FORAGE') {
    const bob = Math.sin(elapsedTime * 2.8 + obj.tx) * 1.6;
    const haloGrad = ctx.createRadialGradient(cx, cy + 7, 2, cx, cy + 7, 16);
    haloGrad.addColorStop(0, 'rgba(254, 240, 138, 0.34)');
    haloGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 7, 16, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (obj.itemId === 'buah_kalabas') {
      const dropQty = obj.quantity ?? 1;
      const fallen: [number, number, number][] =
        dropQty <= 1
          ? [[0, 3, 6.2]]
          : dropQty === 2
          ? [
              [-6, 4, 5.6],
              [6, 2, 5.8],
            ]
          : [
              [-7, 6, 5.5],
              [7, 5, 5.8],
              [0, -2, 6.2],
            ];
      for (const [ox, oy, r] of fallen) {
        const gx = cx + ox;
        const gy = cy + oy + bob * 0.5;
        const gGrad = ctx.createRadialGradient(gx - r * 0.3, gy - r * 0.3, 0.8, gx, gy, r * 1.05);
        gGrad.addColorStop(0, '#D9F99D');
        gGrad.addColorStop(0.5, '#65A30D');
        gGrad.addColorStop(1, '#1A2E05');
        ctx.fillStyle = gGrad;
        ctx.beginPath();
        ctx.ellipse(gx, gy, r, r * 1.05, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(gx, gy - r);
        ctx.quadraticCurveTo(gx + 0.8, gy - r - 1.5, gx + 1.4, gy - r - 2.6);
        ctx.stroke();
      }
      return;
    } else if (obj.itemId === 'jamur_liar') {
      for (const [ox, oy, scale] of [
        [-5, 3, 0.78],
        [4, 0, 1],
      ]) {
        const mx = cx + ox;
        const my = cy + oy + bob;
        const stemGrad = ctx.createLinearGradient(mx - 3 * scale, my, mx + 3 * scale, my);
        stemGrad.addColorStop(0, '#FFFBEB');
        stemGrad.addColorStop(1, '#D6C7A9');
        ctx.fillStyle = stemGrad;
        ctx.beginPath();
        ctx.moveTo(mx - 2.4 * scale, my);
        ctx.quadraticCurveTo(mx - 3.2 * scale, my + 5 * scale, mx - 2.8 * scale, my + 9 * scale);
        ctx.lineTo(mx + 2.8 * scale, my + 9 * scale);
        ctx.quadraticCurveTo(mx + 3.2 * scale, my + 5 * scale, mx + 2.4 * scale, my);
        ctx.closePath();
        ctx.fill();

        const capGrad = ctx.createRadialGradient(mx - 2 * scale, my - 3 * scale, 1, mx, my, 9 * scale);
        capGrad.addColorStop(0, '#FBBF24');
        capGrad.addColorStop(0.55, '#D97706');
        capGrad.addColorStop(1, '#78350F');
        ctx.fillStyle = capGrad;
        ctx.beginPath();
        ctx.ellipse(mx, my + 0.5, 9 * scale, 5.8 * scale, 0, Math.PI, Math.PI * 2);
        ctx.quadraticCurveTo(mx, my + 2.5, mx - 9 * scale, my + 0.5);
        ctx.fill();

        ctx.fillStyle = '#FEF3C7';
        ctx.beginPath();
        ctx.arc(mx - 3 * scale, my - 2.5 * scale, 1.5 * scale, 0, Math.PI * 2);
        ctx.arc(mx + 2.5 * scale, my - 1.8 * scale, 1.2 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (obj.itemId === 'daun_herbal') {
      for (let i = 0; i < 5; i++) {
        const ang = -Math.PI + (i / 4) * Math.PI + sway * 0.02;
        drawLeaf(ctx, cx, cy + 6 + bob, 13.5, 4.9, ang, '#10B981', '#A7F3D0');
      }
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(cx, cy + 4 + bob, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const rootGrad = ctx.createLinearGradient(cx - 3, cy + 2, cx + 3, cy + 13);
      rootGrad.addColorStop(0, '#FBBF24');
      rootGrad.addColorStop(1, '#B45309');
      ctx.fillStyle = rootGrad;
      ctx.beginPath();
      ctx.moveTo(cx - 2.5, cy + 2 + bob);
      ctx.bezierCurveTo(cx - 4, cy + 7 + bob, cx - 2, cy + 11 + bob, cx - 0.5, cy + 13 + bob);
      ctx.bezierCurveTo(cx + 2, cy + 11 + bob, cx + 4, cy + 7 + bob, cx + 2.5, cy + 2 + bob);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#15803D';
      ctx.lineWidth = 1.9;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 2 + bob);
      ctx.quadraticCurveTo(cx + sway * 0.2, cy - 3 + bob, cx + sway * 0.3, cy - 8 + bob);
      ctx.stroke();
      drawLeaf(ctx, cx, cy - 4 + bob, 9.5, 3.3, -2.5, '#22C55E', '#86EFAC');
      drawLeaf(ctx, cx, cy - 4 + bob, 9.5, 3.3, -0.6, '#22C55E', '#86EFAC');
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(cx - 2, cy - 9 + bob, 2.2, 0, Math.PI * 2);
      ctx.arc(cx + 2, cy - 9 + bob, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
