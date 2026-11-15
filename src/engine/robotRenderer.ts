import { TILE_SIZE } from './maps';

export const ROBOT_SPRITE_URL = '/assets/aistudio/robot_tanah-removebg-preview_268d879c.png';

// Player rendered height in characterRenderer.ts is ~60.4px (sandal sole at +2.4 to hair crown at -58.0).
// Setting target height to 181px keeps the robot strictly 3x the player's size.
export const ROBOT_TARGET_HEIGHT = 181;

export interface RobotDrawParams {
  x: number; // world tile X
  y: number; // world tile Y
  hp: number;
  maxHp: number;
  owned: boolean;
  defeatedToday: boolean;
  inCombat: boolean;
  hitFlash: number; // 0..1
  attackAnim: number; // 0..1
  elapsedTime: number;
}

export interface CombatProjectile {
  x: number; // world tile X
  y: number; // world tile Y
  vx: number; // tiles/sec
  vy: number; // tiles/sec
  life: number;
  fromPlayer: boolean;
  damage: number;
  color: string;
}

interface ProcessedRobotSprite {
  cleanCanvas: HTMLCanvasElement;
  flashCanvas: HTMLCanvasElement;
  downedCanvas: HTMLCanvasElement;
  aspectRatio: number;
}

let cachedRobotSprite: ProcessedRobotSprite | null = null;
let robotLoadingPromise: Promise<ProcessedRobotSprite | null> | null = null;

function createTintedMask(
  source: HTMLCanvasElement,
  color: string
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = source.width;
  c.height = source.height;
  const g = c.getContext('2d');
  if (!g) return c;
  g.drawImage(source, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

/**
 * Loads the custom mech PNG, tightly crops transparent outer margins so the tires
 * sit flush on the ground anchor, softens any residual 1px cutout fringe, and
 * prepares silhouette masks for smooth hit-flash and downed rendering.
 */
export function preloadRobotSprite(): Promise<ProcessedRobotSprite | null> {
  if (cachedRobotSprite) return Promise.resolve(cachedRobotSprite);
  if (robotLoadingPromise) return robotLoadingPromise;

  robotLoadingPromise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const srcW = img.naturalWidth || img.width;
      const srcH = img.naturalHeight || img.height;
      const temp = document.createElement('canvas');
      temp.width = srcW;
      temp.height = srcH;
      const tCtx = temp.getContext('2d');
      if (!tCtx) {
        resolve(null);
        return;
      }

      tCtx.drawImage(img, 0, 0);
      const raw = tCtx.getImageData(0, 0, srcW, srcH);
      const d = raw.data;

      // Locate tight non-transparent bounding box
      let minX = srcW;
      let minY = srcH;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < srcH; y++) {
        for (let x = 0; x < srcW; x++) {
          const a = d[(y * srcW + x) * 4 + 3];
          if (a > 10) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (maxX < minX || maxY < minY) {
        minX = 0;
        minY = 0;
        maxX = srcW - 1;
        maxY = srcH - 1;
      }

      // Soften any light cutout fringe pixels on the silhouette boundary
      for (let y = Math.max(1, minY); y <= Math.min(srcH - 2, maxY); y++) {
        for (let x = Math.max(1, minX); x <= Math.min(srcW - 2, maxX); x++) {
          const idx = y * srcW + x;
          const p = idx * 4;
          const a = d[p + 3];
          if (a === 0 || a > 220) continue;

          const hasTransparentNeighbor =
            d[(idx - 1) * 4 + 3] <= 12 ||
            d[(idx + 1) * 4 + 3] <= 12 ||
            d[(idx - srcW) * 4 + 3] <= 12 ||
            d[(idx + srcW) * 4 + 3] <= 12;

          if (hasTransparentNeighbor) {
            const r = d[p];
            const g = d[p + 1];
            const b = d[p + 2];
            const minC = Math.min(r, g, b);
            const maxC = Math.max(r, g, b);
            if (minC > 185 && maxC - minC < 36) {
              // Blend residual bright cutout fringe smoothly into dark mech outline
              d[p] = Math.round(r * 0.25);
              d[p + 1] = Math.round(g * 0.22);
              d[p + 2] = Math.round(b * 0.18);
              d[p + 3] = Math.round(a * 0.65);
            }
          }
        }
      }
      tCtx.putImageData(raw, 0, 0);

      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;
      const cleanCanvas = document.createElement('canvas');
      cleanCanvas.width = cropW;
      cleanCanvas.height = cropH;
      const cCtx = cleanCanvas.getContext('2d');
      if (cCtx) {
        cCtx.imageSmoothingEnabled = true;
        cCtx.imageSmoothingQuality = 'high';
        cCtx.drawImage(temp, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
      }

      const processed: ProcessedRobotSprite = {
        cleanCanvas,
        flashCanvas: createTintedMask(cleanCanvas, '#FEF3C7'),
        downedCanvas: createTintedMask(cleanCanvas, '#0F172A'),
        aspectRatio: cropW / Math.max(1, cropH),
      };
      cachedRobotSprite = processed;
      resolve(processed);
    };

    img.onerror = () => {
      resolve(null);
    };

    img.src = ROBOT_SPRITE_URL;
  });

  return robotLoadingPromise;
}

/**
 * Renders the Lab guardian mech using the high-detail custom sprite scaled to
 * 3× the player's height, with high-quality smoothing, grounded shadows,
 * hydraulic suspension motion, headlight glow, and combat feedback.
 */
export function drawBrownRobot(ctx: CanvasRenderingContext2D, params: RobotDrawParams) {
  if (!cachedRobotSprite && !robotLoadingPromise) {
    void preloadRobotSprite();
  }

  const px = params.x * TILE_SIZE;
  const py = params.y * TILE_SIZE;
  const isDowned = params.defeatedToday && !params.owned;

  const drawH = ROBOT_TARGET_HEIGHT;
  const aspect = cachedRobotSprite?.aspectRatio ?? 534 / 467;
  const drawW = drawH * aspect;

  const pulseSpeed = params.inCombat ? 7.6 : 3.2;
  const wave = Math.sin(params.elapsedTime * pulseSpeed);
  const bob = isDowned ? 5 : wave * (params.inCombat ? 3.2 : 2.1);

  // Subtle hydraulic squash & stretch + combat lunge tilt
  const attackWave = params.attackAnim > 0 ? Math.sin(params.attackAnim * Math.PI) : 0;
  const scaleX = isDowned
    ? 1.02
    : 1 + attackWave * 0.045 - wave * 0.008;
  const scaleY = isDowned
    ? 0.96
    : 1 - attackWave * 0.03 + wave * 0.008;
  const tilt = isDowned
    ? 0.075
    : attackWave * 0.055 * (Math.cos(params.elapsedTime * 5) >= 0 ? 1 : -1);

  const glowColor = params.owned
    ? '#10B981'
    : isDowned
    ? '#38BDF8'
    : params.inCombat
    ? '#EF4444'
    : '#FDE047';

  ctx.save();
  ctx.translate(px, py + 5); // ground plane anchor at tire bottoms
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Soft wide ambient ground shadow
  const groundGrad = ctx.createRadialGradient(0, 0, drawW * 0.08, 0, 0, drawW * 0.46);
  groundGrad.addColorStop(0, 'rgba(0, 0, 0, 0.44)');
  groundGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.22)');
  groundGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = groundGrad;
  ctx.beginPath();
  ctx.ellipse(0, 1, drawW * 0.46, 21, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dual heavy tractor-tire contact shadows
  ctx.fillStyle = 'rgba(0, 0, 0, 0.46)';
  ctx.beginPath();
  ctx.ellipse(-drawW * 0.215, 0, 26, 8, 0, 0, Math.PI * 2);
  ctx.ellipse(drawW * 0.22, 0, 26, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Apply mechanical suspension & attack lunge transform around base center
  ctx.save();
  ctx.translate(0, bob);
  ctx.rotate(tilt);
  ctx.scale(scaleX, scaleY);

  if (cachedRobotSprite) {
    const sprite = cachedRobotSprite;
    const x0 = -drawW / 2;
    const y0 = -drawH;

    // Subtle soft headlight ground illumination cone when active
    if (!isDowned) {
      const lampAlpha = params.inCombat
        ? 0.22 + Math.sin(params.elapsedTime * 11) * 0.06
        : 0.14 + Math.sin(params.elapsedTime * 2.5) * 0.03;
      for (const lx of [x0 + drawW * 0.36, x0 + drawW * 0.66]) {
        const ly = y0 + drawH * 0.44;
        const beam = ctx.createRadialGradient(lx, ly, 2, lx, ly + 44, 58);
        beam.addColorStop(
          0,
          params.inCombat
            ? `rgba(248, 113, 113, ${lampAlpha * 1.4})`
            : params.owned
            ? `rgba(52, 211, 153, ${lampAlpha * 1.3})`
            : `rgba(254, 240, 138, ${lampAlpha * 1.35})`
        );
        beam.addColorStop(1, 'rgba(254, 240, 138, 0)');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.arc(lx, ly + 18, 52, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Main high-resolution smoothed mech sprite
    ctx.drawImage(sprite.cleanCanvas, x0, y0, drawW, drawH);

    // Subtle smooth glass cockpit specular sheen
    if (!isDowned) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, y0 + drawH * 0.27, drawW * 0.145, drawH * 0.12, -0.18, 0, Math.PI * 2);
      ctx.clip();
      const sheenX = Math.sin(params.elapsedTime * 0.9) * drawW * 0.12;
      const sheenGrad = ctx.createLinearGradient(sheenX - 24, y0, sheenX + 24, y0 + drawH * 0.4);
      sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      sheenGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.14)');
      sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = sheenGrad;
      ctx.fillRect(x0, y0, drawW, drawH * 0.45);
      ctx.restore();
    }

    // Glowing dual headlight bloom overlays aligned to the mech's lamps
    const lampPulse = 0.65 + Math.sin(params.elapsedTime * (params.inCombat ? 12 : 3.6)) * 0.25;
    for (const lx of [x0 + drawW * 0.362, x0 + drawW * 0.662]) {
      const ly = y0 + drawH * 0.435;
      const halo = ctx.createRadialGradient(lx, ly, 1, lx, ly, isDowned ? 9 : 16);
      halo.addColorStop(0, glowColor);
      halo.addColorStop(0.45, params.inCombat ? 'rgba(239, 68, 68, 0.45)' : params.owned ? 'rgba(16, 185, 129, 0.4)' : 'rgba(253, 224, 71, 0.42)');
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.save();
      ctx.globalAlpha = isDowned ? 0.35 : lampPulse;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(lx, ly, isDowned ? 9 : 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Downed cool-slate overlay + electric sparks
    if (isDowned) {
      ctx.save();
      ctx.globalAlpha = 0.46;
      ctx.drawImage(sprite.downedCanvas, x0, y0, drawW, drawH);
      ctx.restore();

      const sparkPhase = Math.floor(params.elapsedTime * 7) % 3;
      ctx.save();
      ctx.strokeStyle = '#7DD3FC';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.78;
      const sx = sparkPhase === 0 ? -drawW * 0.14 : sparkPhase === 1 ? drawW * 0.16 : 0;
      const sy = y0 + drawH * (sparkPhase === 2 ? 0.52 : 0.34);
      ctx.beginPath();
      ctx.moveTo(sx - 8, sy - 4);
      ctx.lineTo(sx - 1, sy + 2);
      ctx.lineTo(sx + 5, sy - 5);
      ctx.lineTo(sx + 10, sy + 3);
      ctx.stroke();
      ctx.restore();
    }

    // Smooth silhouette hit-flash on damage
    if (params.hitFlash > 0.02) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.85, params.hitFlash * 0.85);
      ctx.drawImage(sprite.flashCanvas, x0, y0, drawW, drawH);
      ctx.restore();
    }
  } else {
    // Brief proportional fallback only while image loads
    ctx.fillStyle = '#D99B26';
    ctx.beginPath();
    ctx.roundRect(-drawW * 0.34, -drawH * 0.92, drawW * 0.68, drawH * 0.85, 28);
    ctx.fill();
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.roundRect(-drawW * 0.2, -drawH * 0.8, drawW * 0.4, drawH * 0.28, 16);
    ctx.fill();
  }

  ctx.restore(); // end suspension/tilt transform

  // Nameplate & HP Bar floating cleanly above the 3× mech
  ctx.save();
  const barY = -drawH - 18 + (isDowned ? 4 : bob * 0.4);
  ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';

  const label = params.owned
    ? 'Robot Mecha (Milikmu)'
    : isDowned
    ? 'Robot Mecha (Reset 03:00)'
    : `Robot Mecha Penjaga · ${Math.max(0, Math.ceil(params.hp))}/${params.maxHp}`;

  const textW = ctx.measureText(label).width;
  const pillW = Math.max(132, textW + 18);
  ctx.fillStyle = 'rgba(12, 10, 9, 0.84)';
  ctx.strokeStyle = params.owned
    ? 'rgba(16, 185, 129, 0.55)'
    : isDowned
    ? 'rgba(56, 189, 248, 0.5)'
    : params.inCombat
    ? 'rgba(239, 68, 68, 0.65)'
    : 'rgba(245, 158, 11, 0.5)';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.roundRect(-pillW / 2, barY - 16, pillW, 20, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = params.owned ? '#6EE7B7' : isDowned ? '#7DD3FC' : '#FDE68A';
  ctx.fillText(label, 0, barY - 2);

  if (!params.owned && !isDowned) {
    const bw = 116;
    const bh = 7;
    ctx.fillStyle = 'rgba(17, 15, 13, 0.92)';
    ctx.beginPath();
    ctx.roundRect(-bw / 2, barY + 6, bw, bh, 3.5);
    ctx.fill();

    const ratio = Math.max(0, Math.min(1, params.hp / params.maxHp));
    if (ratio > 0) {
      const fillW = Math.max(4, (bw - 2) * ratio);
      const hpGrad = ctx.createLinearGradient(-bw / 2, barY + 7, bw / 2, barY + 7);
      if (ratio > 0.45) {
        hpGrad.addColorStop(0, '#D97706');
        hpGrad.addColorStop(1, '#FBBF24');
      } else {
        hpGrad.addColorStop(0, '#DC2626');
        hpGrad.addColorStop(1, '#F87171');
      }
      ctx.fillStyle = hpGrad;
      ctx.beginPath();
      ctx.roundRect(-bw / 2 + 1, barY + 7, fillW, bh - 2, 2.5);
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.restore();
}

export function drawCombatProjectile(ctx: CanvasRenderingContext2D, proj: CombatProjectile) {
  const px = proj.x * TILE_SIZE;
  const py = proj.y * TILE_SIZE - 18;
  ctx.save();
  ctx.translate(px, py);
  const angle = Math.atan2(proj.vy, proj.vx);
  ctx.rotate(angle);

  // Outer soft glow aura
  const aura = ctx.createRadialGradient(0, 0, 1, 0, 0, 13);
  aura.addColorStop(0, proj.color);
  aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.ellipse(-2, 0, 13, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tapered energy bolt
  ctx.fillStyle = proj.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(2, 0, 4.2, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
