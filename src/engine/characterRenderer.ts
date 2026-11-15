import { FacingDir } from './renderer';
import { TILE_SIZE } from './maps';
import { FarmerSpriteRig, getCachedFarmerSpriteRig } from '../utils/spriteLoader';

export type PlayerActionKind =
  | 'NONE'
  | 'HOE'
  | 'AXE'
  | 'SCYTHE'
  | 'SWORD'
  | 'RIFLE'
  | 'WATER'
  | 'PLANT'
  | 'HARVEST'
  | 'CONSUME';

export interface FarmerDrawParams {
  x: number;
  y: number;
  facingDir: FacingDir;
  walkCycle: number;
  isMoving: boolean;
  actionKind: PlayerActionKind;
  actionProgress: number; // 0 when idle/walking, 0..1 during active action
  selectedItemId: string;
  hasSteelHoe?: boolean;
  hasBigWateringCan?: boolean;
  isBathing?: boolean;
  isWading?: boolean;
  elapsedTime: number;
}

// ============================================================================
// 5x SUPERSAMPLED OFFSCREEN BUFFER FOR ULTRA-SMOOTH 2.5D REALISM AT ALL ZOOMS
// ============================================================================
const SS_SCALE = 5;
const SS_W = 92; // world-space width covered (-46 .. +46)
const SS_H = 98; // world-space height covered (-78 .. +20)
const SS_ORIGIN_X = 46;
const SS_ORIGIN_Y = 78;

let ssCanvas: HTMLCanvasElement | null = null;
let ssCtx: CanvasRenderingContext2D | null = null;

function getSupersampleBuffer(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  if (!ssCanvas) {
    ssCanvas = document.createElement('canvas');
    ssCanvas.width = SS_W * SS_SCALE;
    ssCanvas.height = SS_H * SS_SCALE;
    ssCtx = ssCanvas.getContext('2d');
  }
  if (!ssCtx) return null;
  return { canvas: ssCanvas, ctx: ssCtx };
}

// ============================================================================
// NATURALISTIC 2.5D PALETTE (painterly tonal edges, zero thick black cartoon ink)
// ============================================================================
const EDGE_SKIN = 'rgba(92, 46, 26, 0.42)';
const EDGE_CLOTH = 'rgba(71, 85, 105, 0.46)';
const EDGE_DENIM = 'rgba(9, 13, 22, 0.56)';
const EDGE_HAIR = 'rgba(10, 12, 18, 0.52)';
const EDGE_TOOL = 'rgba(20, 26, 38, 0.62)';

const SKIN_SPECULAR = '#FFE3CE';
const SKIN_HIGHLIGHT = '#F6C5A1';
const SKIN_LIGHT = '#EBAE84';
const SKIN = '#DD976C';
const SKIN_MID = '#CA8055';
const SKIN_SHADE = '#AE6740';
const SKIN_DEEP = '#874B2C';
const SKIN_AO = 'rgba(96, 42, 22, 0.26)';
const SKIN_WARMTH = 'rgba(214, 86, 74, 0.14)';
const LIP_UPPER = '#AF6854';
const LIP_LOWER = '#D98E75';

const HAIR_DEEP = '#0C0F15';
const HAIR_SHADE = '#141821';
const HAIR_BASE = '#1E2430';
const HAIR_MID = '#2B3344';
const HAIR_LIGHT = '#47546B';
const HAIR_SPECULAR = 'rgba(196, 214, 238, 0.34)';

const SHIRT_HIGHLIGHT = '#FFFFFF';
const SHIRT_LIT = '#F7FAFC';
const SHIRT = '#EAEFF5';
const SHIRT_MID = '#D8E0EA';
const SHIRT_SHADE = '#BEC8D6';
const SHIRT_DEEP = '#94A3B8';

const BELT_LIGHT = '#6B442A';
const BELT = '#4A2D1A';
const BELT_DARK = '#2B180C';
const BUCKLE_LIGHT = '#E2E8F0';
const BUCKLE = '#94A3B8';
const BUCKLE_DARK = '#475569';

// Dark charcoal denim twill
const JEANS_HIGHLIGHT = '#414A5C';
const JEANS_LIGHT = '#313846';
const JEANS = '#212630';
const JEANS_SHADE = '#151921';
const JEANS_DEEP = '#0B0E14';
const JEANS_STITCH = 'rgba(148, 163, 184, 0.42)';

// Navy athletic trekking sandals
const SANDAL_OUTSOLE = '#111620';
const SANDAL_MIDSOLE = '#3E4B5E';
const SANDAL_FOOTBED = '#526175';
const SANDAL_BLUE_LIGHT = '#4371B2';
const SANDAL_BLUE = '#294E84';
const SANDAL_BLUE_DARK = '#172F54';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - c, 3);
}

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

function easeOutBack(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(c - 1, 3) + c1 * Math.pow(c - 1, 2);
}

interface ActionPose {
  squatY: number;
  torsoLean: number;
  headTilt: number;
  stanceSpread: number;
  armForward: number;
  wristAngle: number;
  frontArcArm: number;
  sweepSide: number;
  slashAlpha: number;
  pourAlpha: number;
  seedAlpha: number;
}

function computeActionPose(kind: PlayerActionKind, p: number): ActionPose {
  const neutral: ActionPose = {
    squatY: 0,
    torsoLean: 0,
    headTilt: 0,
    stanceSpread: 0,
    armForward: 0,
    wristAngle: 0,
    frontArcArm: 0,
    sweepSide: 0,
    slashAlpha: 0,
    pourAlpha: 0,
    seedAlpha: 0,
  };

  if (kind === 'NONE' || p <= 0) return neutral;

  if (kind === 'HOE' || kind === 'AXE') {
    const heavy = kind === 'AXE' ? 1.15 : 1.0;
    if (p < 0.30) {
      const t = easeOutCubic(p / 0.30);
      return {
        ...neutral,
        squatY: lerp(0, -0.7, t),
        torsoLean: lerp(0, -0.18 * heavy, t),
        headTilt: lerp(0, -0.07, t),
        stanceSpread: lerp(0, 2.0, t),
        armForward: lerp(-0.15, -2.5 * (kind === 'AXE' ? 1.04 : 1.0), t),
        wristAngle: lerp(0, -0.45, t),
        frontArcArm: lerp(0, -1.0, t),
      };
    } else if (p < 0.58) {
      const t = easeInOutCubic((p - 0.30) / 0.28);
      return {
        ...neutral,
        squatY: lerp(-0.7, 3.8 * heavy, t),
        torsoLean: lerp(-0.18 * heavy, 0.28 * heavy, t),
        headTilt: lerp(-0.07, 0.13, t),
        stanceSpread: 2.0 + t * 0.55,
        armForward: lerp(-2.5, kind === 'AXE' ? -0.78 : -0.52, t),
        wristAngle: lerp(-0.45, 0.38, t),
        frontArcArm: lerp(-1.0, 0.95, t),
        slashAlpha: Math.sin(t * Math.PI) * 0.85,
      };
    } else {
      const t = easeOutCubic((p - 0.58) / 0.42);
      const strikeArm = kind === 'AXE' ? -0.78 : -0.52;
      return {
        ...neutral,
        squatY: lerp(3.8 * heavy, 0, t),
        torsoLean: lerp(0.28 * heavy, 0, t),
        headTilt: lerp(0.13, 0, t),
        stanceSpread: lerp(2.55, 0, t),
        armForward: lerp(strikeArm, 0, t),
        wristAngle: lerp(0.38, 0, t),
        frontArcArm: lerp(0.95, 0, t),
      };
    }
  }

  if (kind === 'SCYTHE' || kind === 'SWORD') {
    const isSword = kind === 'SWORD';
    if (p < 0.25) {
      const t = easeOutCubic(p / 0.25);
      return {
        ...neutral,
        squatY: lerp(0, isSword ? 2.0 : 2.8, t),
        torsoLean: lerp(0, isSword ? -0.09 : 0.13, t),
        stanceSpread: lerp(0, 2.5, t),
        armForward: lerp(0, isSword ? -2.15 : 0.55, t),
        sweepSide: lerp(0, -1.0, t),
      };
    } else if (p < 0.62) {
      const t = easeInOutCubic((p - 0.25) / 0.37);
      return {
        ...neutral,
        squatY: lerp(isSword ? 2.0 : 2.8, isSword ? 3.0 : 3.8, t),
        torsoLean: lerp(isSword ? -0.09 : 0.13, 0.26, t),
        headTilt: 0.09,
        stanceSpread: 2.5,
        armForward: lerp(isSword ? -2.15 : 0.55, -1.55, t),
        wristAngle: lerp(-0.2, 0.42, t),
        sweepSide: lerp(-1.0, 1.0, t),
        slashAlpha: Math.sin(t * Math.PI),
      };
    } else {
      const t = easeOutCubic((p - 0.62) / 0.38);
      return {
        ...neutral,
        squatY: lerp(isSword ? 3.0 : 3.8, 0, t),
        torsoLean: lerp(0.26, 0, t),
        headTilt: lerp(0.09, 0, t),
        stanceSpread: lerp(2.5, 0, t),
        armForward: lerp(-1.55, 0, t),
        wristAngle: lerp(0.42, 0, t),
        sweepSide: lerp(1.0, 0, t),
      };
    }
  }

  if (kind === 'RIFLE') {
    if (p < 0.25) {
      const t = easeOutCubic(p / 0.25);
      return {
        ...neutral,
        squatY: lerp(0, 1.3, t),
        torsoLean: lerp(0, -0.05, t),
        stanceSpread: lerp(0, 2.0, t),
        armForward: lerp(0, -1.5, t),
      };
    } else if (p < 0.65) {
      const t = (p - 0.25) / 0.40;
      const recoil = Math.sin(t * Math.PI) * 0.22;
      return {
        ...neutral,
        squatY: 1.3,
        torsoLean: -0.07 - recoil * 0.35,
        headTilt: 0.04,
        stanceSpread: 2.0,
        armForward: -1.52 - recoil,
        wristAngle: -recoil * 0.35,
      };
    } else {
      const t = easeOutCubic((p - 0.65) / 0.35);
      return {
        ...neutral,
        squatY: lerp(1.3, 0, t),
        torsoLean: lerp(-0.07, 0, t),
        headTilt: lerp(0.04, 0, t),
        stanceSpread: lerp(2.0, 0, t),
        armForward: lerp(-1.52, 0, t),
      };
    }
  }

  if (kind === 'WATER') {
    if (p < 0.22) {
      const t = easeOutCubic(p / 0.22);
      return {
        ...neutral,
        squatY: lerp(0, 1.6, t),
        torsoLean: lerp(0, 0.13, t),
        headTilt: lerp(0, 0.09, t),
        stanceSpread: lerp(0, 1.6, t),
        armForward: lerp(0, -1.02, t),
        wristAngle: lerp(0, 0.12, t),
      };
    } else if (p < 0.78) {
      const t = (p - 0.22) / 0.56;
      const tip = Math.sin(t * Math.PI * 2) * 0.08;
      return {
        ...neutral,
        squatY: 1.6 + Math.sin(t * Math.PI) * 0.7,
        torsoLean: 0.15,
        headTilt: 0.11,
        stanceSpread: 1.6,
        armForward: -1.1 + tip,
        wristAngle: 0.54 + tip,
        pourAlpha: Math.sin(t * Math.PI),
      };
    } else {
      const t = easeOutCubic((p - 0.78) / 0.22);
      return {
        ...neutral,
        squatY: lerp(1.6, 0, t),
        torsoLean: lerp(0.15, 0, t),
        headTilt: lerp(0.11, 0, t),
        stanceSpread: lerp(1.6, 0, t),
        armForward: lerp(-1.1, 0, t),
        wristAngle: lerp(0.54, 0, t),
      };
    }
  }

  if (kind === 'PLANT') {
    if (p < 0.28) {
      const t = easeOutCubic(p / 0.28);
      return {
        ...neutral,
        squatY: lerp(0, 4.2, t),
        torsoLean: lerp(0, 0.26, t),
        headTilt: lerp(0, 0.16, t),
        stanceSpread: lerp(0, 2.0, t),
        armForward: lerp(0, -0.76, t),
      };
    } else if (p < 0.76) {
      const t = (p - 0.28) / 0.48;
      const sow = Math.sin(t * Math.PI * 3) * 0.22;
      return {
        ...neutral,
        squatY: 4.2,
        torsoLean: 0.26,
        headTilt: 0.16,
        stanceSpread: 2.0,
        armForward: -0.66 + sow,
        seedAlpha: 1,
      };
    } else {
      const t = easeOutCubic((p - 0.76) / 0.24);
      return {
        ...neutral,
        squatY: lerp(4.2, 0, t),
        torsoLean: lerp(0.26, 0, t),
        headTilt: lerp(0.16, 0, t),
        stanceSpread: lerp(2.0, 0, t),
        armForward: lerp(-0.66, 0, t),
      };
    }
  }

  if (kind === 'HARVEST') {
    if (p < 0.34) {
      const t = easeOutCubic(p / 0.34);
      return {
        ...neutral,
        squatY: lerp(0, 3.2, t),
        torsoLean: lerp(0, 0.24, t),
        headTilt: lerp(0, 0.13, t),
        stanceSpread: lerp(0, 1.8, t),
        armForward: lerp(0, -1.14, t),
      };
    } else if (p < 0.68) {
      const t = easeOutBack((p - 0.34) / 0.34);
      return {
        ...neutral,
        squatY: lerp(3.2, 0.35, Math.min(1, t)),
        torsoLean: lerp(0.24, -0.05, Math.min(1, t)),
        headTilt: lerp(0.13, -0.03, Math.min(1, t)),
        stanceSpread: 1.8,
        armForward: lerp(-1.14, -0.40, Math.min(1, t)),
      };
    } else {
      const t = easeOutCubic((p - 0.68) / 0.32);
      return {
        ...neutral,
        squatY: lerp(0.35, 0, t),
        torsoLean: lerp(-0.05, 0, t),
        headTilt: lerp(-0.03, 0, t),
        stanceSpread: lerp(1.8, 0, t),
        armForward: lerp(-0.40, 0, t),
      };
    }
  }

  // CONSUME
  if (p < 0.26) {
    const t = easeOutCubic(p / 0.26);
    return {
      ...neutral,
      torsoLean: lerp(0, -0.04, t),
      headTilt: lerp(0, -0.12, t),
      armForward: lerp(0, -2.05, t),
    };
  } else if (p < 0.78) {
    const t = (p - 0.26) / 0.52;
    const chew = Math.sin(t * Math.PI * 4) * 0.08;
    return {
      ...neutral,
      squatY: Math.abs(chew) * 3.5,
      torsoLean: -0.05,
      headTilt: -0.13 + chew,
      armForward: -2.08 + chew,
    };
  } else {
    const t = easeOutCubic((p - 0.78) / 0.22);
    return {
      ...neutral,
      torsoLean: lerp(-0.05, 0, t),
      headTilt: lerp(-0.13, 0, t),
      armForward: lerp(-2.08, 0, t),
    };
  }
}

// ============================================================================
// REALISTIC 2.5D ANATOMICAL TREKKING SANDAL & FOOT
// ============================================================================
function drawRealisticSandalFoot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  facingSide: boolean,
  isBackView = false,
  showHeelLift = false,
  isShadedLeg = false,
  sideSign = 1
) {
  ctx.save();
  ctx.translate(x, y);
  if (!facingSide && !isBackView) {
    ctx.rotate(sideSign * 0.055);
  }
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (isBackView) {
    const heelH = showHeelLift ? 3.8 : 3.0;
    // Exposed Achilles tendon & heel skin
    const heelSkin = ctx.createLinearGradient(-w * 0.3, -2.2, w * 0.3, 0.8);
    heelSkin.addColorStop(0, isShadedLeg ? SKIN_DEEP : SKIN_SHADE);
    heelSkin.addColorStop(0.5, isShadedLeg ? SKIN_SHADE : SKIN);
    heelSkin.addColorStop(1, isShadedLeg ? SKIN_DEEP : SKIN_SHADE);

    ctx.fillStyle = heelSkin;
    ctx.strokeStyle = EDGE_SKIN;
    ctx.lineWidth = 0.38;
    ctx.beginPath();
    ctx.roundRect(-w * 0.31, -2.1, w * 0.62, 2.5, 0.9);
    ctx.fill();
    ctx.stroke();

    // Outsole rubber tread
    ctx.fillStyle = SANDAL_OUTSOLE;
    ctx.strokeStyle = EDGE_DENIM;
    ctx.lineWidth = 0.38;
    ctx.beginPath();
    ctx.roundRect(-w * 0.44, 0.1, w * 0.88, heelH, [1.0, 1.0, 1.7, 1.7]);
    ctx.fill();
    ctx.stroke();

    // Midsole bevel
    ctx.fillStyle = SANDAL_MIDSOLE;
    ctx.beginPath();
    ctx.roundRect(-w * 0.41, 0.1, w * 0.82, 0.85, 0.4);
    ctx.fill();

    if (showHeelLift) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 0.35;
      for (let g = 1.25; g <= 3.1; g += 0.8) {
        ctx.beginPath();
        ctx.moveTo(-w * 0.3, g);
        ctx.lineTo(w * 0.3, g);
        ctx.stroke();
      }
    }

    // Padded navy heel strap
    ctx.fillStyle = isShadedLeg ? SANDAL_BLUE_DARK : SANDAL_BLUE;
    ctx.strokeStyle = EDGE_DENIM;
    ctx.lineWidth = 0.36;
    ctx.beginPath();
    ctx.roundRect(-w * 0.4, -0.85, w * 0.8, 1.45, 0.65);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = SANDAL_BLUE_LIGHT;
    ctx.lineWidth = 0.32;
    ctx.beginPath();
    ctx.moveTo(-w * 0.28, -0.25);
    ctx.lineTo(w * 0.28, -0.25);
    ctx.stroke();

    ctx.restore();
    return;
  }

  if (facingSide) {
    // 2.5D side-profile foot (+X forward)
    const halfL = w * 0.52;

    // Anatomical rubber outsole with arch curve
    ctx.fillStyle = SANDAL_OUTSOLE;
    ctx.strokeStyle = EDGE_DENIM;
    ctx.lineWidth = 0.38;
    ctx.beginPath();
    ctx.moveTo(-halfL, 2.2);
    ctx.quadraticCurveTo(0, 2.5, halfL + 0.5, 1.9);
    ctx.quadraticCurveTo(halfL + 0.7, 3.3, halfL - 0.6, 3.6);
    ctx.lineTo(-halfL + 0.5, 3.6);
    ctx.quadraticCurveTo(-halfL - 0.2, 3.3, -halfL, 2.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cushioned EVA midsole
    ctx.fillStyle = SANDAL_MIDSOLE;
    ctx.beginPath();
    ctx.roundRect(-halfL + 0.25, 1.4, halfL * 2 + 0.1, 1.0, 0.45);
    ctx.fill();

    // Sculpted instep & toes
    const footGrad = ctx.createLinearGradient(-halfL, -1.6, halfL, 1.8);
    footGrad.addColorStop(0, isShadedLeg ? SKIN_DEEP : SKIN_SHADE);
    footGrad.addColorStop(0.55, isShadedLeg ? SKIN_SHADE : SKIN);
    footGrad.addColorStop(1, isShadedLeg ? SKIN : SKIN_HIGHLIGHT);

    ctx.fillStyle = footGrad;
    ctx.strokeStyle = EDGE_SKIN;
    ctx.lineWidth = 0.36;
    ctx.beginPath();
    ctx.moveTo(-halfL * 0.68, -2.0);
    ctx.bezierCurveTo(-halfL * 0.1, -1.8, halfL * 0.48, -0.1, halfL - 0.1, 0.55);
    ctx.bezierCurveTo(halfL + 0.45, 1.0, halfL + 0.25, 1.75, halfL - 0.8, 1.75);
    ctx.lineTo(-halfL * 0.74, 1.75);
    ctx.quadraticCurveTo(-halfL * 0.88, 0.3, -halfL * 0.68, -2.0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Toe nail highlight
    ctx.fillStyle = 'rgba(255, 238, 228, 0.55)';
    ctx.beginPath();
    ctx.ellipse(halfL - 0.65, 0.95, 0.6, 0.32, 0.18, 0, Math.PI * 2);
    ctx.fill();

    // Dual trekking straps
    ctx.fillStyle = isShadedLeg ? SANDAL_BLUE_DARK : SANDAL_BLUE;
    ctx.strokeStyle = EDGE_DENIM;
    ctx.lineWidth = 0.35;

    ctx.beginPath();
    ctx.moveTo(-halfL * 0.82, -0.8);
    ctx.quadraticCurveTo(-halfL * 0.15, -1.1, 0.2, 1.45);
    ctx.lineTo(-0.95, 1.5);
    ctx.quadraticCurveTo(-halfL * 0.45, 0.0, -halfL * 0.78, 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-0.15, -1.1);
    ctx.lineTo(halfL * 0.44, -0.05);
    ctx.lineTo(halfL * 0.32, 1.6);
    ctx.lineTo(-1.15, 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = BUCKLE_LIGHT;
    ctx.beginPath();
    ctx.roundRect(-0.2, -0.2, 1.1, 1.25, 0.25);
    ctx.fill();

    ctx.restore();
    return;
  }

  // 2.5D Front-tilted foreshortened sandal
  const halfW = w * 0.5;

  // Rubber grip outsole
  ctx.fillStyle = SANDAL_OUTSOLE;
  ctx.strokeStyle = EDGE_DENIM;
  ctx.lineWidth = 0.38;
  ctx.beginPath();
  ctx.moveTo(-halfW, 1.8);
  ctx.quadraticCurveTo(0, 1.45, halfW, 1.8);
  ctx.bezierCurveTo(halfW + 0.25, 3.1, halfW * 0.7, 3.85, 0, 3.85);
  ctx.bezierCurveTo(-halfW * 0.7, 3.85, -halfW - 0.25, 3.1, -halfW, 1.8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cushioned midsole & footbed rim
  ctx.fillStyle = SANDAL_FOOTBED;
  ctx.beginPath();
  ctx.ellipse(0, 1.75, halfW - 0.32, 0.95, 0, 0, Math.PI * 2);
  ctx.fill();

  // Exposed ankle + dorsal foot skin
  const footGrad = ctx.createLinearGradient(0, -2.4, 0, 2.3);
  footGrad.addColorStop(0, isShadedLeg ? SKIN_MID : SKIN_HIGHLIGHT);
  footGrad.addColorStop(0.55, isShadedLeg ? SKIN_SHADE : SKIN);
  footGrad.addColorStop(1, isShadedLeg ? SKIN_DEEP : SKIN_SHADE);

  ctx.fillStyle = footGrad;
  ctx.strokeStyle = EDGE_SKIN;
  ctx.lineWidth = 0.36;
  ctx.beginPath();
  ctx.moveTo(-halfW * 0.68, -1.9);
  ctx.quadraticCurveTo(0, -2.35, halfW * 0.68, -1.9);
  ctx.bezierCurveTo(halfW * 0.88, -0.2, halfW * 0.84, 2.15, 0, 2.25);
  ctx.bezierCurveTo(-halfW * 0.84, 2.15, -halfW * 0.88, -0.2, -halfW * 0.68, -1.9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Subtle toe separations & nails
  ctx.strokeStyle = 'rgba(135, 75, 44, 0.55)';
  ctx.lineWidth = 0.32;
  const toeOffsets = [-1.6, -0.55, 0.55, 1.55];
  for (const txOff of toeOffsets) {
    ctx.beginPath();
    ctx.moveTo(txOff, 0.85);
    ctx.lineTo(txOff * 1.04, 2.08);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255, 238, 228, 0.5)';
  for (const nx of [-1.05, 0, 1.05]) {
    ctx.beginPath();
    ctx.ellipse(nx, 1.42, 0.38, 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Contact shadow under webbing strap
  ctx.fillStyle = SKIN_AO;
  ctx.beginPath();
  ctx.ellipse(0, 0.35, halfW * 0.72, 0.75, 0, 0, Math.PI * 2);
  ctx.fill();

  // Primary navy trekking instep strap
  const strapGrad = ctx.createLinearGradient(-halfW, -1.1, halfW, 0.9);
  strapGrad.addColorStop(0, isShadedLeg ? SANDAL_BLUE_DARK : SANDAL_BLUE);
  strapGrad.addColorStop(0.5, isShadedLeg ? SANDAL_BLUE : SANDAL_BLUE_LIGHT);
  strapGrad.addColorStop(1, isShadedLeg ? SANDAL_BLUE_DARK : SANDAL_BLUE);

  ctx.fillStyle = strapGrad;
  ctx.strokeStyle = EDGE_DENIM;
  ctx.lineWidth = 0.36;
  ctx.beginPath();
  ctx.moveTo(-halfW + 0.35, -0.85);
  ctx.quadraticCurveTo(0, -1.35, halfW - 0.35, -0.85);
  ctx.lineTo(halfW - 0.15, 0.6);
  ctx.quadraticCurveTo(0, 0.2, -halfW + 0.15, 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Webbing stitch line & buckle
  ctx.strokeStyle = 'rgba(191, 219, 254, 0.45)';
  ctx.lineWidth = 0.28;
  ctx.beginPath();
  ctx.moveTo(-halfW + 0.9, -0.25);
  ctx.quadraticCurveTo(0, -0.68, halfW - 0.9, -0.25);
  ctx.stroke();

  ctx.fillStyle = BUCKLE_LIGHT;
  ctx.strokeStyle = EDGE_DENIM;
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.roundRect(halfW - 1.85, -0.75, 1.0, 1.15, 0.22);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

// ============================================================================
// REALISTIC 2.5D HEAD, FACE & LAYERED HAIR (HUMAN SCALE — ~12.8px x 10.0px)
// ============================================================================
function drawRealisticHairBackLayer(
  ctx: CanvasRenderingContext2D,
  headCenterY: number,
  hairBounce: number
) {
  ctx.save();
  ctx.translate(0, hairBounce);

  const grad = ctx.createLinearGradient(-4, headCenterY - 8.5, 4, headCenterY + 5.5);
  grad.addColorStop(0, HAIR_MID);
  grad.addColorStop(0.5, HAIR_BASE);
  grad.addColorStop(1, HAIR_DEEP);

  ctx.fillStyle = grad;
  ctx.strokeStyle = EDGE_HAIR;
  ctx.lineWidth = 0.36;
  ctx.lineJoin = 'round';

  // Sleek natural back hair peeking subtly around jaw/ears (not puffy cartoon spikes)
  ctx.beginPath();
  ctx.moveTo(-4.8, headCenterY + 3.2);
  ctx.quadraticCurveTo(-6.1, headCenterY + 1.8, -6.3, headCenterY + 0.2);
  ctx.quadraticCurveTo(-5.6, headCenterY - 0.3, -5.4, headCenterY - 1.5);
  ctx.bezierCurveTo(-6.2, headCenterY - 3.6, -5.7, headCenterY - 6.6, -3.5, headCenterY - 7.8);
  ctx.bezierCurveTo(-2.1, headCenterY - 8.6, -1.2, headCenterY - 9.0, -0.9, headCenterY - 9.7);
  ctx.bezierCurveTo(0.2, headCenterY - 8.7, 2.8, headCenterY - 8.6, 4.4, headCenterY - 7.2);
  ctx.bezierCurveTo(6.1, headCenterY - 5.6, 6.2, headCenterY - 2.6, 5.4, headCenterY - 0.9);
  ctx.quadraticCurveTo(6.0, headCenterY + 0.4, 6.3, headCenterY + 0.9);
  ctx.quadraticCurveTo(5.7, headCenterY + 2.3, 4.7, headCenterY + 3.2);
  ctx.quadraticCurveTo(0, headCenterY + 4.3, -4.8, headCenterY + 3.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

/**
 * Photorealistic 2.5D front face with sculpted skull, cheekbones, jaw, almond eyes,
 * dimensional nose bridge/tip, natural shaded lips, and finely layered hair strands.
 */
function drawRealisticFrontFace(
  ctx: CanvasRenderingContext2D,
  headTopY: number,
  isBlinking: boolean,
  isHappyClosed: boolean,
  hairBounce: number
) {
  const cy = headTopY + 5.75; // eye level (~middle of 12.6px tall head)

  // 1. Realistic Ears (outer helix, antihelix, tragus & inner shadow)
  for (const sign of [-1, 1]) {
    const ex = sign * 4.85;
    const ey = cy + 0.65;
    ctx.fillStyle = sign < 0 ? SKIN : SKIN_MID;
    ctx.strokeStyle = EDGE_SKIN;
    ctx.lineWidth = 0.34;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 0.95, 1.55, sign * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = SKIN_SHADE;
    ctx.beginPath();
    ctx.ellipse(ex - sign * 0.12, ey + 0.08, 0.48, 0.88, sign * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Sculpted Anatomical Cranium, Zygomatic Cheekbones & Tapered Chin
  const faceGrad = ctx.createRadialGradient(-1.1, headTopY + 4.2, 0.8, 0.2, headTopY + 6.4, 7.6);
  faceGrad.addColorStop(0, SKIN_SPECULAR);
  faceGrad.addColorStop(0.35, SKIN_HIGHLIGHT);
  faceGrad.addColorStop(0.72, SKIN);
  faceGrad.addColorStop(1, SKIN_SHADE);

  ctx.fillStyle = faceGrad;
  ctx.strokeStyle = EDGE_SKIN;
  ctx.lineWidth = 0.38;
  ctx.beginPath();
  ctx.moveTo(-4.72, headTopY + 3.8);
  ctx.bezierCurveTo(-4.85, headTopY + 0.8, -2.9, headTopY - 0.35, 0, headTopY - 0.35);
  ctx.bezierCurveTo(2.9, headTopY - 0.35, 4.85, headTopY + 0.8, 4.72, headTopY + 3.8);
  // Subtle cheekbone flare then crisp jaw taper to chin
  ctx.bezierCurveTo(4.82, headTopY + 5.8, 4.55, headTopY + 8.1, 3.35, headTopY + 9.8);
  ctx.bezierCurveTo(2.35, headTopY + 11.2, 1.25, headTopY + 12.15, 0, headTopY + 12.3);
  ctx.bezierCurveTo(-1.25, headTopY + 12.15, -2.35, headTopY + 11.2, -3.35, headTopY + 9.8);
  ctx.bezierCurveTo(-4.55, headTopY + 8.1, -4.82, headTopY + 5.8, -4.72, headTopY + 3.8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Right-side jaw plane core shadow (3D form turning away from top-left key light)
  const jawShadow = ctx.createLinearGradient(1.2, cy + 1.0, 4.8, cy + 5.0);
  jawShadow.addColorStop(0, 'rgba(135, 75, 44, 0)');
  jawShadow.addColorStop(1, 'rgba(135, 75, 44, 0.24)');
  ctx.fillStyle = jawShadow;
  ctx.beginPath();
  ctx.moveTo(0, headTopY + 12.2);
  ctx.bezierCurveTo(1.8, headTopY + 11.6, 3.8, headTopY + 9.4, 4.5, headTopY + 6.0);
  ctx.lineTo(2.0, headTopY + 6.8);
  ctx.quadraticCurveTo(1.1, headTopY + 10.0, 0, headTopY + 12.2);
  ctx.fill();

  // Ambient occlusion cast by hair bangs on forehead
  ctx.fillStyle = 'rgba(120, 62, 34, 0.16)';
  ctx.beginPath();
  ctx.ellipse(0, headTopY + 2.35, 4.2, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Subtle orbital brow-bone shadow (creates deep 3D eye sockets)
  ctx.fillStyle = 'rgba(135, 75, 44, 0.16)';
  ctx.beginPath();
  ctx.ellipse(-2.1, cy - 0.55, 1.45, 0.65, 0.08, 0, Math.PI * 2);
  ctx.ellipse(2.1, cy - 0.55, 1.45, 0.65, -0.08, 0, Math.PI * 2);
  ctx.fill();

  // Cheekbone subsurface warmth & specular highlight
  ctx.fillStyle = SKIN_WARMTH;
  ctx.beginPath();
  ctx.ellipse(-2.65, cy + 1.9, 1.2, 0.68, 0.12, 0, Math.PI * 2);
  ctx.ellipse(2.65, cy + 1.9, 1.2, 0.68, -0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 244, 232, 0.34)';
  ctx.beginPath();
  ctx.ellipse(-2.4, cy + 1.3, 0.72, 0.28, -0.15, 0, Math.PI * 2);
  ctx.ellipse(2.4, cy + 1.3, 0.72, 0.28, 0.15, 0, Math.PI * 2);
  ctx.fill();

  // 3. Dimensional Nose (soft bridge highlight + lateral nose shadow + sculpted tip/nostrils)
  ctx.fillStyle = 'rgba(135, 75, 44, 0.22)';
  ctx.beginPath();
  ctx.moveTo(0.15, cy - 0.35);
  ctx.lineTo(0.78, cy + 1.75);
  ctx.quadraticCurveTo(0.25, cy + 2.15, -0.35, cy + 1.9);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 245, 236, 0.50)';
  ctx.beginPath();
  ctx.ellipse(-0.18, cy + 0.75, 0.28, 0.9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 240, 228, 0.42)';
  ctx.beginPath();
  ctx.ellipse(-0.08, cy + 1.72, 0.42, 0.26, 0, 0, Math.PI * 2);
  ctx.fill();

  // Subtle nostril & tip underside curve
  ctx.strokeStyle = 'rgba(115, 60, 34, 0.58)';
  ctx.lineWidth = 0.34;
  ctx.beginPath();
  ctx.moveTo(-0.55, cy + 1.82);
  ctx.quadraticCurveTo(0, cy + 2.18, 0.55, cy + 1.82);
  ctx.stroke();

  // 4. Natural Human Eyes (proportional almond eyes — NOT huge cartoon circles)
  if (isHappyClosed) {
    ctx.strokeStyle = 'rgba(42, 24, 18, 0.85)';
    ctx.lineWidth = 0.58;
    ctx.beginPath();
    ctx.moveTo(-3.1, cy + 0.1);
    ctx.quadraticCurveTo(-2.15, cy - 0.75, -1.2, cy + 0.1);
    ctx.moveTo(1.2, cy + 0.1);
    ctx.quadraticCurveTo(2.15, cy - 0.75, 3.1, cy + 0.1);
    ctx.stroke();
  } else if (isBlinking) {
    ctx.strokeStyle = 'rgba(42, 24, 18, 0.85)';
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(-3.1, cy + 0.1);
    ctx.quadraticCurveTo(-2.15, cy + 0.55, -1.2, cy + 0.1);
    ctx.moveTo(1.2, cy + 0.1);
    ctx.quadraticCurveTo(2.15, cy + 0.55, 3.1, cy + 0.1);
    ctx.stroke();
  } else {
    for (const sign of [-1, 1]) {
      const ex = sign * 2.15;
      const ey = cy - 0.05;

      // Upper eyelid crease
      ctx.strokeStyle = 'rgba(135, 75, 44, 0.46)';
      ctx.lineWidth = 0.28;
      ctx.beginPath();
      ctx.moveTo(ex - sign * 1.05, ey - 0.65);
      ctx.quadraticCurveTo(ex, ey - 1.15, ex + sign * 1.05, ey - 0.5);
      ctx.stroke();

      // Almond sclera (natural warm off-white, not blinding neon white)
      ctx.fillStyle = '#F6F7F9';
      ctx.beginPath();
      ctx.moveTo(ex - sign * 1.05, ey + 0.05);
      ctx.quadraticCurveTo(ex, ey - 0.82, ex + sign * 1.08, ey + 0.02);
      ctx.quadraticCurveTo(ex, ey + 0.72, ex - sign * 1.05, ey + 0.05);
      ctx.closePath();
      ctx.fill();

      // Upper sclera lash shadow
      ctx.fillStyle = 'rgba(100, 116, 139, 0.25)';
      ctx.beginPath();
      ctx.ellipse(ex, ey - 0.38, 0.9, 0.28, 0, 0, Math.PI * 2);
      ctx.fill();

      // Clip iris cleanly inside almond opening
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ex - sign * 1.05, ey + 0.05);
      ctx.quadraticCurveTo(ex, ey - 0.82, ex + sign * 1.08, ey + 0.02);
      ctx.quadraticCurveTo(ex, ey + 0.72, ex - sign * 1.05, ey + 0.05);
      ctx.closePath();
      ctx.clip();

      // Detailed warm dark-brown iris + limbal ring
      const irisGrad = ctx.createRadialGradient(ex, ey + 0.05, 0.12, ex, ey, 0.68);
      irisGrad.addColorStop(0, '#5B3D2E');
      irisGrad.addColorStop(0.55, '#2A1F1B');
      irisGrad.addColorStop(1, '#11131A');
      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.arc(ex - sign * 0.05, ey, 0.62, 0, Math.PI * 2);
      ctx.fill();

      // Pupil
      ctx.fillStyle = '#07090D';
      ctx.beginPath();
      ctx.arc(ex - sign * 0.05, ey, 0.28, 0, Math.PI * 2);
      ctx.fill();

      // Crisp specular catchlight
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex - 0.22, ey - 0.22, 0.19, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Soft upper lash line
      ctx.strokeStyle = 'rgba(22, 24, 32, 0.88)';
      ctx.lineWidth = 0.46;
      ctx.beginPath();
      ctx.moveTo(ex - sign * 1.06, ey + 0.02);
      ctx.quadraticCurveTo(ex, ey - 0.84, ex + sign * 1.1, ey - 0.02);
      ctx.stroke();

      // Delicate lower waterline shadow
      ctx.strokeStyle = 'rgba(135, 75, 44, 0.32)';
      ctx.lineWidth = 0.25;
      ctx.beginPath();
      ctx.moveTo(ex - sign * 0.8, ey + 0.22);
      ctx.quadraticCurveTo(ex, ey + 0.62, ex + sign * 0.85, ey + 0.2);
      ctx.stroke();
    }
  }

  // 5. Realistic Sculpted Eyebrows
  ctx.fillStyle = HAIR_SHADE;
  for (const sign of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sign * 0.92, cy - 1.25);
    ctx.quadraticCurveTo(sign * 2.15, cy - 1.65, sign * 3.35, cy - 1.25);
    ctx.quadraticCurveTo(sign * 3.22, cy - 1.62, sign * 2.15, cy - 2.02);
    ctx.quadraticCurveTo(sign * 1.15, cy - 1.78, sign * 0.92, cy - 1.25);
    ctx.closePath();
    ctx.fill();
  }

  // 6. Anatomical Lips, Philtrum & Chin Shadow
  ctx.fillStyle = 'rgba(135, 75, 44, 0.20)';
  ctx.beginPath();
  ctx.ellipse(0, cy + 2.45, 0.35, 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // Upper lip subtle tint
  ctx.fillStyle = LIP_UPPER;
  ctx.beginPath();
  ctx.moveTo(-1.35, cy + 3.25);
  ctx.quadraticCurveTo(-0.45, cy + 2.85, 0, cy + 3.02);
  ctx.quadraticCurveTo(0.45, cy + 2.85, 1.35, cy + 3.25);
  ctx.quadraticCurveTo(0, cy + 3.45, -1.35, cy + 3.25);
  ctx.fill();

  // Lower lip fullness highlight
  ctx.fillStyle = LIP_LOWER;
  ctx.beginPath();
  ctx.ellipse(0, cy + 3.65, 0.92, 0.36, 0, 0, Math.PI * 2);
  ctx.fill();

  // Natural mouth crease
  ctx.strokeStyle = 'rgba(92, 42, 32, 0.72)';
  ctx.lineWidth = 0.36;
  ctx.beginPath();
  ctx.moveTo(-1.42, cy + 3.25);
  ctx.quadraticCurveTo(0, cy + 3.55, 1.42, cy + 3.22);
  ctx.stroke();

  // Chin cleft shadow
  ctx.fillStyle = 'rgba(135, 75, 44, 0.24)';
  ctx.beginPath();
  ctx.ellipse(0, cy + 4.35, 0.75, 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  // 7. Layered Swept Natural Hair (faithful silhouette, 2x strand texture, zero cartoon spikes)
  ctx.save();
  ctx.translate(0, hairBounce);

  const hairGrad = ctx.createLinearGradient(-3, headTopY - 4.5, 4, headTopY + 5.5);
  hairGrad.addColorStop(0, HAIR_MID);
  hairGrad.addColorStop(0.48, HAIR_BASE);
  hairGrad.addColorStop(1, HAIR_DEEP);

  ctx.fillStyle = hairGrad;
  ctx.strokeStyle = EDGE_HAIR;
  ctx.lineWidth = 0.38;
  ctx.lineJoin = 'round';

  ctx.beginPath();
  // Left temple sideburn curving smoothly in front of ear
  ctx.moveTo(-4.9, headTopY + 5.3);
  ctx.bezierCurveTo(-5.5, headTopY + 3.1, -5.6, headTopY + 0.4, -4.3, headTopY - 1.8);
  // Crown + slight natural cowlick
  ctx.bezierCurveTo(-3.1, headTopY - 3.3, -1.6, headTopY - 3.6, -1.1, headTopY - 4.4);
  ctx.bezierCurveTo(-0.3, headTopY - 3.5, 1.8, headTopY - 3.6, 3.4, headTopY - 2.7);
  // Right sweeping temple sideburn
  ctx.bezierCurveTo(5.2, headTopY - 1.4, 5.7, headTopY + 1.3, 5.4, headTopY + 4.0);
  ctx.quadraticCurveTo(5.1, headTopY + 5.0, 4.85, headTopY + 5.3);
  ctx.quadraticCurveTo(4.4, headTopY + 3.6, 4.3, headTopY + 1.9);
  // Feathered parted bangs cleanly framing brow
  ctx.quadraticCurveTo(3.55, headTopY + 3.4, 2.75, headTopY + 3.8);
  ctx.quadraticCurveTo(2.2, headTopY + 2.3, 1.5, headTopY + 1.5);
  ctx.quadraticCurveTo(0.85, headTopY + 3.6, -0.05, headTopY + 4.1);
  ctx.quadraticCurveTo(-0.7, headTopY + 2.6, -1.0, headTopY + 1.6);
  ctx.quadraticCurveTo(-1.8, headTopY + 3.3, -2.75, headTopY + 3.7);
  ctx.quadraticCurveTo(-3.45, headTopY + 2.4, -3.9, headTopY + 1.9);
  ctx.quadraticCurveTo(-4.35, headTopY + 3.6, -4.65, headTopY + 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Individual layered strand separations (2x detail)
  ctx.strokeStyle = HAIR_DEEP;
  ctx.lineWidth = 0.28;
  ctx.beginPath();
  ctx.moveTo(-1.25, headTopY - 2.6);
  ctx.quadraticCurveTo(-1.05, headTopY - 0.2, -0.95, headTopY + 1.5);
  ctx.moveTo(1.1, headTopY - 2.5);
  ctx.quadraticCurveTo(1.4, headTopY - 0.3, 1.5, headTopY + 1.4);
  ctx.moveTo(-3.4, headTopY - 1.2);
  ctx.quadraticCurveTo(-3.7, headTopY + 0.4, -3.85, headTopY + 1.8);
  ctx.moveTo(3.3, headTopY - 1.1);
  ctx.quadraticCurveTo(3.8, headTopY + 0.4, 4.2, headTopY + 1.8);
  ctx.moveTo(-0.35, headTopY - 2.9);
  ctx.quadraticCurveTo(-0.1, headTopY + 0.5, -0.05, headTopY + 3.8);
  ctx.stroke();

  // Anisotropic silky hair highlight arc across crown
  ctx.strokeStyle = HAIR_LIGHT;
  ctx.lineWidth = 0.72;
  ctx.beginPath();
  ctx.moveTo(-3.1, headTopY - 0.8);
  ctx.quadraticCurveTo(-1.3, headTopY - 1.95, 0.15, headTopY - 1.45);
  ctx.quadraticCurveTo(1.5, headTopY - 2.0, 3.1, headTopY - 0.7);
  ctx.stroke();

  ctx.strokeStyle = HAIR_SPECULAR;
  ctx.lineWidth = 0.42;
  ctx.beginPath();
  ctx.moveTo(-2.3, headTopY - 1.15);
  ctx.quadraticCurveTo(-0.2, headTopY - 2.05, 2.2, headTopY - 1.05);
  ctx.stroke();

  ctx.restore();
}

/**
 * Realistic 2.5D Back Head & Tapered Nape Hair (UP)
 */
function drawRealisticBackHead(
  ctx: CanvasRenderingContext2D,
  headCenterY: number,
  hairBounce: number
) {
  // Back of ears subtly visible
  for (const sign of [-1, 1]) {
    ctx.fillStyle = sign < 0 ? SKIN_MID : SKIN_SHADE;
    ctx.strokeStyle = EDGE_SKIN;
    ctx.lineWidth = 0.34;
    ctx.beginPath();
    ctx.ellipse(sign * 4.8, headCenterY + 0.75, 0.9, 1.45, sign * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  drawRealisticHairBackLayer(ctx, headCenterY, hairBounce);

  ctx.save();
  ctx.translate(0, hairBounce);

  const backGrad = ctx.createLinearGradient(-3, headCenterY - 9, 4, headCenterY + 6);
  backGrad.addColorStop(0, HAIR_MID);
  backGrad.addColorStop(0.5, HAIR_BASE);
  backGrad.addColorStop(1, HAIR_DEEP);

  ctx.fillStyle = backGrad;
  ctx.strokeStyle = EDGE_HAIR;
  ctx.lineWidth = 0.38;
  ctx.lineJoin = 'round';

  // Contoured back cranium & tapered nape locks
  ctx.beginPath();
  ctx.moveTo(-5.05, headCenterY - 1.0);
  ctx.bezierCurveTo(-5.4, headCenterY - 5.2, -3.4, headCenterY - 8.6, -1.0, headCenterY - 8.8);
  ctx.lineTo(-0.7, headCenterY - 9.6);
  ctx.bezierCurveTo(0.5, headCenterY - 8.6, 3.6, headCenterY - 8.2, 5.05, headCenterY - 1.0);
  ctx.bezierCurveTo(5.1, headCenterY + 2.2, 4.3, headCenterY + 4.3, 3.0, headCenterY + 4.8);
  ctx.quadraticCurveTo(2.0, headCenterY + 3.9, 1.35, headCenterY + 3.65);
  ctx.quadraticCurveTo(0.6, headCenterY + 4.95, 0, headCenterY + 5.1);
  ctx.quadraticCurveTo(-0.6, headCenterY + 4.95, -1.35, headCenterY + 3.65);
  ctx.quadraticCurveTo(-2.0, headCenterY + 3.9, -3.0, headCenterY + 4.8);
  ctx.bezierCurveTo(-4.3, headCenterY + 4.3, -5.1, headCenterY + 2.2, -5.05, headCenterY - 1.0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Layered hair flow strands
  ctx.strokeStyle = HAIR_DEEP;
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(-3.0, headCenterY + 0.8);
  ctx.quadraticCurveTo(-2.4, headCenterY + 3.0, -1.5, headCenterY + 3.7);
  ctx.moveTo(3.0, headCenterY + 0.8);
  ctx.quadraticCurveTo(2.4, headCenterY + 3.0, 1.5, headCenterY + 3.7);
  ctx.moveTo(0, headCenterY - 1.0);
  ctx.quadraticCurveTo(0.1, headCenterY + 2.2, 0, headCenterY + 4.9);
  ctx.moveTo(-1.9, headCenterY - 3.6);
  ctx.quadraticCurveTo(-2.5, headCenterY - 0.8, -2.7, headCenterY + 2.0);
  ctx.moveTo(1.9, headCenterY - 3.6);
  ctx.quadraticCurveTo(2.5, headCenterY - 0.8, 2.7, headCenterY + 2.0);
  ctx.stroke();

  // Crown sheen
  ctx.strokeStyle = HAIR_LIGHT;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.arc(0, headCenterY - 2.6, 3.4, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();

  ctx.strokeStyle = HAIR_SPECULAR;
  ctx.lineWidth = 0.42;
  ctx.beginPath();
  ctx.arc(0, headCenterY - 2.8, 2.9, Math.PI * 1.24, Math.PI * 1.76);
  ctx.stroke();

  ctx.restore();
}

/**
 * Realistic 2.5D 3/4-Profile Head & Swept Hair (LEFT / RIGHT; +X is forward)
 */
function drawRealisticProfileHead(
  ctx: CanvasRenderingContext2D,
  isBlinking: boolean,
  hairBounce: number
) {
  // Subtle brow/nose/lips/chin anatomical profile scaled to ~12.5px tall
  const profGrad = ctx.createLinearGradient(-4.5, -12, 5.5, 0);
  profGrad.addColorStop(0, SKIN_SHADE);
  profGrad.addColorStop(0.45, SKIN);
  profGrad.addColorStop(1, SKIN_HIGHLIGHT);

  ctx.fillStyle = profGrad;
  ctx.strokeStyle = EDGE_SKIN;
  ctx.lineWidth = 0.38;
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(-4.6, -7.8);
  ctx.bezierCurveTo(-4.7, -11.3, -2.0, -12.1, 1.0, -11.8);
  ctx.bezierCurveTo(3.6, -11.5, 4.8, -9.4, 4.85, -7.2); // forehead & brow ridge
  ctx.quadraticCurveTo(5.0, -6.2, 5.75, -5.2); // natural nose bridge
  ctx.quadraticCurveTo(5.95, -4.55, 4.95, -4.3); // nose tip & alar curve
  ctx.lineTo(4.9, -3.45); // philtrum
  ctx.quadraticCurveTo(5.2, -2.95, 4.75, -2.55); // upper lip
  ctx.quadraticCurveTo(4.95, -2.05, 4.5, -1.7); // lower lip
  ctx.bezierCurveTo(3.9, -0.3, 2.0, 0.25, -0.4, 0.05); // sculpted jaw & chin
  ctx.bezierCurveTo(-3.1, -0.15, -4.6, -2.6, -4.6, -7.8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cheek warmth & jaw shadow
  ctx.fillStyle = SKIN_WARMTH;
  ctx.beginPath();
  ctx.ellipse(2.35, -4.2, 1.15, 0.65, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(135, 75, 44, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0.6, -1.0, 2.2, 0.7, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Proportional recessed 2.5D eye
  const ex = 3.25;
  const ey = -6.45;
  if (isBlinking) {
    ctx.strokeStyle = 'rgba(42, 24, 18, 0.85)';
    ctx.lineWidth = 0.52;
    ctx.beginPath();
    ctx.moveTo(2.15, ey);
    ctx.quadraticCurveTo(3.35, ey + 0.42, 4.35, ey - 0.05);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#F6F7F9';
    ctx.beginPath();
    ctx.ellipse(ex, ey, 0.92, 0.65, 0, 0, Math.PI * 2);
    ctx.fill();

    const irisGrad = ctx.createRadialGradient(ex + 0.2, ey, 0.1, ex + 0.2, ey, 0.55);
    irisGrad.addColorStop(0, '#5B3D2E');
    irisGrad.addColorStop(0.6, '#2A1F1B');
    irisGrad.addColorStop(1, '#11131A');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.ellipse(ex + 0.25, ey + 0.02, 0.48, 0.58, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#07090D';
    ctx.beginPath();
    ctx.arc(ex + 0.28, ey, 0.23, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(22, 24, 32, 0.88)';
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(2.25, ey - 0.15);
    ctx.quadraticCurveTo(3.35, ey - 0.82, 4.35, ey - 0.18);
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ex + 0.08, ey - 0.22, 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tapered profile brow
  ctx.fillStyle = HAIR_SHADE;
  ctx.beginPath();
  ctx.moveTo(2.0, -7.85);
  ctx.quadraticCurveTo(3.3, -8.3, 4.55, -7.75);
  ctx.quadraticCurveTo(4.35, -8.08, 3.25, -8.52);
  ctx.quadraticCurveTo(2.25, -8.32, 2.0, -7.85);
  ctx.closePath();
  ctx.fill();

  // Natural profile mouth crease
  ctx.strokeStyle = 'rgba(92, 42, 32, 0.72)';
  ctx.lineWidth = 0.34;
  ctx.beginPath();
  ctx.moveTo(3.35, -2.45);
  ctx.quadraticCurveTo(4.15, -2.28, 4.72, -2.55);
  ctx.stroke();

  // Layered Profile Hair
  ctx.save();
  ctx.translate(0, hairBounce);

  const profHairGrad = ctx.createLinearGradient(-6, -15, 4, -2);
  profHairGrad.addColorStop(0, HAIR_DEEP);
  profHairGrad.addColorStop(0.45, HAIR_BASE);
  profHairGrad.addColorStop(1, HAIR_MID);

  ctx.fillStyle = profHairGrad;
  ctx.strokeStyle = EDGE_HAIR;
  ctx.lineWidth = 0.38;
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(-4.1, -1.3);
  ctx.bezierCurveTo(-5.8, -2.9, -6.4, -6.2, -5.6, -9.6);
  ctx.bezierCurveTo(-4.7, -12.7, -2.2, -14.4, -0.7, -15.1);
  ctx.bezierCurveTo(0.6, -14.0, 3.8, -14.0, 5.5, -9.0);
  ctx.quadraticCurveTo(4.2, -8.1, 2.8, -8.5);
  ctx.quadraticCurveTo(1.8, -6.9, 0.9, -6.5);
  ctx.quadraticCurveTo(0.7, -4.6, 0.1, -3.7);
  ctx.quadraticCurveTo(-0.5, -5.1, -0.7, -6.3);
  ctx.quadraticCurveTo(-2.1, -3.0, -4.1, -1.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Fine hair strand flow lines
  ctx.strokeStyle = HAIR_DEEP;
  ctx.lineWidth = 0.28;
  ctx.beginPath();
  ctx.moveTo(-2.1, -12.1);
  ctx.quadraticCurveTo(-3.4, -8.5, -3.6, -4.9);
  ctx.moveTo(0.85, -11.6);
  ctx.quadraticCurveTo(1.9, -9.8, 2.65, -8.5);
  ctx.moveTo(-3.8, -9.5);
  ctx.quadraticCurveTo(-4.8, -6.4, -4.3, -3.2);
  ctx.stroke();

  // Detailed Ear in profile
  ctx.fillStyle = SKIN;
  ctx.strokeStyle = EDGE_SKIN;
  ctx.lineWidth = 0.34;
  ctx.beginPath();
  ctx.ellipse(-0.95, -4.8, 0.98, 1.5, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = SKIN_SHADE;
  ctx.beginPath();
  ctx.ellipse(-1.02, -4.78, 0.45, 0.8, -0.08, 0, Math.PI * 2);
  ctx.fill();

  // Silky crown highlight
  ctx.strokeStyle = HAIR_LIGHT;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-3.2, -10.5);
  ctx.quadraticCurveTo(-0.3, -12.5, 2.9, -10.6);
  ctx.stroke();

  ctx.strokeStyle = HAIR_SPECULAR;
  ctx.lineWidth = 0.42;
  ctx.beginPath();
  ctx.moveTo(-2.1, -10.9);
  ctx.quadraticCurveTo(0.1, -12.1, 2.1, -10.7);
  ctx.stroke();

  ctx.restore();
}

// ============================================================================
// 2x DETAILED HELD TOOLS & WEAPONS
// ============================================================================
function drawHeldToolAtHand(
  ctx: CanvasRenderingContext2D,
  kind: PlayerActionKind,
  wristAngle: number,
  pose: ActionPose,
  params: FarmerDrawParams
) {
  ctx.save();
  ctx.rotate(wristAngle);
  ctx.strokeStyle = EDGE_TOOL;
  ctx.lineWidth = 0.42;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (kind === 'HOE') {
    const shaftGrad = ctx.createLinearGradient(-1.8, 0, 1.8, 0);
    shaftGrad.addColorStop(0, '#6B2E0D');
    shaftGrad.addColorStop(0.45, '#B45309');
    shaftGrad.addColorStop(1, '#78350F');
    ctx.fillStyle = shaftGrad;
    ctx.beginPath();
    ctx.roundRect(-1.55, -4.5, 3.1, 24.5, 1.2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#451A03';
    ctx.beginPath();
    ctx.roundRect(-1.65, -3.2, 3.3, 5.5, 0.7);
    ctx.fill();

    const bladeGrad = ctx.createLinearGradient(-1.2, 16.5, 8.8, 21.5);
    bladeGrad.addColorStop(0, params.hasSteelHoe ? '#BAE6FD' : '#E2E8F0');
    bladeGrad.addColorStop(0.55, params.hasSteelHoe ? '#38BDF8' : '#94A3B8');
    bladeGrad.addColorStop(1, params.hasSteelHoe ? '#0284C7' : '#64748B');
    ctx.fillStyle = bladeGrad;
    ctx.beginPath();
    ctx.moveTo(-1.2, 16.8);
    ctx.lineTo(8.5, 17.0);
    ctx.quadraticCurveTo(9.0, 19.4, 7.9, 21.4);
    ctx.lineTo(-1.2, 20.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = params.hasSteelHoe ? '#F0F9FF' : '#F8FAFC';
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(3.8, 17.7);
    ctx.lineTo(7.9, 17.9);
    ctx.stroke();
  } else if (kind === 'AXE') {
    const shaftGrad = ctx.createLinearGradient(-1.8, 0, 1.8, 0);
    shaftGrad.addColorStop(0, '#6B2F0C');
    shaftGrad.addColorStop(0.5, '#9A4B16');
    shaftGrad.addColorStop(1, '#5C2609');
    ctx.fillStyle = shaftGrad;
    ctx.beginPath();
    ctx.roundRect(-1.6, -4.5, 3.2, 23.5, 1.2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#451A03';
    ctx.beginPath();
    ctx.roundRect(-1.7, -3.0, 3.4, 5.2, 0.7);
    ctx.fill();

    const axeGrad = ctx.createLinearGradient(1, 11, 11, 20);
    axeGrad.addColorStop(0, '#64748B');
    axeGrad.addColorStop(0.6, '#CBD5E1');
    axeGrad.addColorStop(1, '#F8FAFC');
    ctx.fillStyle = axeGrad;
    ctx.beginPath();
    ctx.moveTo(1.0, 11.8);
    ctx.lineTo(9.8, 9.8);
    ctx.quadraticCurveTo(11.8, 15.2, 9.8, 20.8);
    ctx.lineTo(1.0, 18.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.moveTo(9.1, 10.8);
    ctx.quadraticCurveTo(10.7, 15.2, 9.1, 19.8);
    ctx.stroke();
  } else if (kind === 'SCYTHE') {
    ctx.fillStyle = '#92400E';
    ctx.beginPath();
    ctx.roundRect(-1.55, -3.5, 3.1, 14.0, 1.1);
    ctx.fill();
    ctx.stroke();

    const scytheGrad = ctx.createLinearGradient(0, 10, 13, 22);
    scytheGrad.addColorStop(0, '#94A3B8');
    scytheGrad.addColorStop(0.6, '#E2E8F0');
    scytheGrad.addColorStop(1, '#FFFFFF');
    ctx.fillStyle = scytheGrad;
    ctx.beginPath();
    ctx.moveTo(-0.7, 9.8);
    ctx.quadraticCurveTo(11.6, 10.6, 12.8, 21.6);
    ctx.quadraticCurveTo(6.6, 15.2, 0.9, 13.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'SWORD') {
    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.roundRect(-1.55, -4.5, 3.1, 6.8, 1.0);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.roundRect(-4.6, 1.6, 9.2, 2.6, 0.9);
    ctx.fill();
    ctx.stroke();

    const bladeGrad = ctx.createLinearGradient(-2.1, 4.4, 2.1, 24.5);
    bladeGrad.addColorStop(0, '#0284C7');
    bladeGrad.addColorStop(0.45, '#38BDF8');
    bladeGrad.addColorStop(1, '#E0F2FE');
    ctx.fillStyle = bladeGrad;
    ctx.beginPath();
    ctx.moveTo(-2.0, 4.2);
    ctx.lineTo(2.0, 4.2);
    ctx.lineTo(1.6, 20.8);
    ctx.lineTo(0, 24.5);
    ctx.lineTo(-1.6, 20.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#F0F9FF';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, 5.8);
    ctx.lineTo(0, 20.8);
    ctx.stroke();
  } else if (kind === 'RIFLE') {
    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.roundRect(-2.5, -2.5, 5.0, 7.8, 1.2);
    ctx.fill();
    ctx.stroke();

    const barrelGrad = ctx.createLinearGradient(-1.9, 4.5, 1.9, 19);
    barrelGrad.addColorStop(0, '#1E293B');
    barrelGrad.addColorStop(0.5, '#475569');
    barrelGrad.addColorStop(1, '#334155');
    ctx.fillStyle = barrelGrad;
    ctx.beginPath();
    ctx.roundRect(-1.9, 4.5, 3.8, 14.2, 0.9);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.roundRect(-1.25, 7.0, 2.5, 4.6, 0.5);
    ctx.fill();

    if (params.actionProgress > 0.22 && params.actionProgress < 0.44) {
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(0, 20.5, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'WATER') {
    ctx.rotate(-Math.PI * 0.35);
    const bodyColor = params.hasBigWateringCan ? '#D97706' : '#0284C7';
    const lightColor = params.hasBigWateringCan ? '#FDE68A' : '#7DD3FC';

    ctx.strokeStyle = EDGE_TOOL;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 1, 4.3, Math.PI * 0.9, Math.PI * 2.1);
    ctx.stroke();

    const canGrad = ctx.createLinearGradient(-4.6, 1.8, 4.6, 11.8);
    canGrad.addColorStop(0, lightColor);
    canGrad.addColorStop(0.45, bodyColor);
    canGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = canGrad;
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.roundRect(-4.6, 1.8, 9.2, 9.4, 2.1);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(3.8, 8.0);
    ctx.lineTo(11.8, 2.5);
    ctx.lineTo(12.6, 5.2);
    ctx.lineTo(4.6, 10.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (pose.pourAlpha > 0.15) {
      ctx.save();
      ctx.globalAlpha = pose.pourAlpha;
      ctx.fillStyle = '#7DD3FC';
      for (let i = 0; i < 4; i++) {
        const dropT = (params.elapsedTime * 7 + i * 0.25) % 1;
        const dx = 13 + dropT * 7;
        const dy = 4.5 + dropT * 16;
        ctx.beginPath();
        ctx.ellipse(dx, dy, 1.3, 2.1, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  } else if (kind === 'PLANT') {
    ctx.fillStyle = '#B45309';
    ctx.beginPath();
    ctx.roundRect(-2.4, -1.8, 4.8, 5.4, 1.2);
    ctx.fill();
    ctx.stroke();

    if (pose.seedAlpha > 0) {
      ctx.fillStyle = '#BEF264';
      for (let i = 0; i < 3; i++) {
        const st = (params.elapsedTime * 6 + i * 0.33) % 1;
        ctx.beginPath();
        ctx.arc((i - 1) * 2.8, 5.0 + st * 10, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (kind === 'CONSUME') {
    const isCoffee = params.selectedItemId.includes('kopi');
    const isJamuOrWater =
      params.selectedItemId.includes('jamu') || params.selectedItemId.includes('kelapa');
    if (isCoffee || isJamuOrWater) {
      ctx.fillStyle = isCoffee ? '#78350F' : '#F59E0B';
      ctx.beginPath();
      ctx.roundRect(-2.6, -0.8, 5.2, 6.2, 1.3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.roundRect(-2.5, -0.8, 5.0, 1.6, 0.5);
      ctx.fill();
    } else {
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(0, 1.8, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ============================================================================
// SCULPTED 2.5D ARM (DELTOID CAP, BICEP/FOREARM MUSCLE, ANATOMICAL HAND)
// ============================================================================
function drawRealisticArm(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  upperRot: number,
  elbowBend: number,
  isBackLayer: boolean,
  sideMirror: number,
  heldAction?: {
    kind: PlayerActionKind;
    wristAngle: number;
    pose: ActionPose;
    params: FarmerDrawParams;
  }
) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(upperRot);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 1. Tailored 2.5D short sleeve with cylindrical cuff rim
  const sleeveGrad = ctx.createLinearGradient(-2.8, -1, 2.8, 4.8);
  sleeveGrad.addColorStop(0, isBackLayer ? SHIRT_SHADE : SHIRT_HIGHLIGHT);
  sleeveGrad.addColorStop(0.55, isBackLayer ? SHIRT_DEEP : SHIRT_LIT);
  sleeveGrad.addColorStop(1, isBackLayer ? SHIRT_DEEP : SHIRT_SHADE);

  ctx.fillStyle = sleeveGrad;
  ctx.strokeStyle = EDGE_CLOTH;
  ctx.lineWidth = 0.36;
  ctx.beginPath();
  ctx.moveTo(-2.15, -1.3);
  ctx.quadraticCurveTo(0, -2.55, 2.15, -1.3);
  ctx.bezierCurveTo(2.7, 0.9, 2.8, 2.8, 2.65, 4.35);
  ctx.quadraticCurveTo(0, 5.05, -2.65, 4.35);
  ctx.bezierCurveTo(-2.8, 2.8, -2.7, 0.9, -2.15, -1.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner sleeve opening shadow
  ctx.fillStyle = 'rgba(100, 116, 139, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 4.3, 2.35, 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  // Double-stitched cotton hem
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
  ctx.lineWidth = 0.28;
  ctx.beginPath();
  ctx.moveTo(-2.45, 3.6);
  ctx.quadraticCurveTo(0, 4.2, 2.45, 3.6);
  ctx.stroke();

  // 2. Sculpted upper arm (bicep/tricep curve + sleeve cast shadow)
  const upperGrad = ctx.createLinearGradient(-2.0, 4.2, 2.0, 9.2);
  upperGrad.addColorStop(0, isBackLayer ? SKIN_SHADE : SKIN_HIGHLIGHT);
  upperGrad.addColorStop(0.55, isBackLayer ? SKIN_DEEP : SKIN);
  upperGrad.addColorStop(1, isBackLayer ? SKIN_DEEP : SKIN_SHADE);

  ctx.fillStyle = upperGrad;
  ctx.strokeStyle = EDGE_SKIN;
  ctx.lineWidth = 0.34;
  ctx.beginPath();
  ctx.moveTo(-1.85, 4.3);
  ctx.bezierCurveTo(-2.15, 5.9, -1.95, 7.6, -1.55, 9.1);
  ctx.lineTo(1.55, 9.1);
  ctx.bezierCurveTo(1.95, 7.6, 2.15, 5.9, 1.85, 4.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Sleeve rim ambient occlusion on upper bicep
  ctx.fillStyle = SKIN_AO;
  ctx.beginPath();
  ctx.ellipse(0, 4.65, 1.75, 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!isBackLayer) {
    ctx.strokeStyle = 'rgba(135, 75, 44, 0.32)';
    ctx.lineWidth = 0.32;
    ctx.beginPath();
    ctx.moveTo(sideMirror * 0.55, 5.3);
    ctx.quadraticCurveTo(sideMirror * 0.72, 6.8, sideMirror * 0.35, 8.2);
    ctx.stroke();
  }

  // 3. Elbow -> Tapered Forearm & Anatomical Hand
  ctx.save();
  ctx.translate(0, 8.6);
  ctx.rotate(elbowBend);

  const foreGrad = ctx.createLinearGradient(-1.8, 0, 1.8, 5.8);
  foreGrad.addColorStop(0, isBackLayer ? SKIN_SHADE : SKIN_HIGHLIGHT);
  foreGrad.addColorStop(0.55, isBackLayer ? SKIN_DEEP : SKIN);
  foreGrad.addColorStop(1, isBackLayer ? SKIN_DEEP : SKIN_SHADE);

  ctx.fillStyle = foreGrad;
  ctx.strokeStyle = EDGE_SKIN;
  ctx.lineWidth = 0.34;
  ctx.beginPath();
  ctx.moveTo(-1.72, -0.2);
  ctx.bezierCurveTo(-1.95, 1.8, -1.55, 4.1, -1.15, 6.0);
  ctx.lineTo(1.15, 6.0);
  ctx.bezierCurveTo(1.55, 4.1, 1.95, 1.8, 1.72, -0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (!isBackLayer) {
    ctx.strokeStyle = 'rgba(135, 75, 44, 0.28)';
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(-sideMirror * 0.45, 1.0);
    ctx.quadraticCurveTo(-sideMirror * 0.52, 3.1, -sideMirror * 0.22, 4.9);
    ctx.stroke();
  }

  // Anatomical Hand (palm + fingers + thumb)
  ctx.fillStyle = isBackLayer ? SKIN_SHADE : SKIN;
  ctx.strokeStyle = EDGE_SKIN;
  ctx.lineWidth = 0.34;
  ctx.beginPath();
  ctx.moveTo(-1.22, 5.8);
  ctx.bezierCurveTo(-1.82, 6.45, -1.78, 7.95, -0.92, 8.45);
  ctx.quadraticCurveTo(0, 8.8, 0.92, 8.45);
  ctx.bezierCurveTo(1.78, 7.95, 1.82, 6.45, 1.22, 5.8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (!isBackLayer) {
    ctx.fillStyle = SKIN_LIGHT;
    ctx.strokeStyle = EDGE_SKIN;
    ctx.lineWidth = 0.28;
    ctx.beginPath();
    ctx.ellipse(-sideMirror * 0.88, 6.45, 0.6, 0.82, sideMirror * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(135, 75, 44, 0.42)';
    ctx.lineWidth = 0.26;
    ctx.beginPath();
    ctx.moveTo(-0.42, 7.3);
    ctx.lineTo(-0.42, 8.3);
    ctx.moveTo(0.35, 7.3);
    ctx.lineTo(0.35, 8.3);
    ctx.stroke();
  }

  if (heldAction) {
    ctx.save();
    ctx.translate(0, 6.7);
    drawHeldToolAtHand(
      ctx,
      heldAction.kind,
      heldAction.wristAngle,
      heldAction.pose,
      heldAction.params
    );
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}

// ============================================================================
// CORE 2.5D CHARACTER RIG RENDERER (RUNS INSIDE 5x SUPERSAMPLED BUFFER)
// ============================================================================
function renderFarmerRig(
  ctx: CanvasRenderingContext2D,
  params: FarmerDrawParams,
  pose: ActionPose,
  phase: number,
  stride: number,
  idleBreath: number,
  isBlinking: boolean,
  bob: number,
  hairBounce: number
) {
  const { facingDir, isMoving, actionKind, actionProgress, isBathing, elapsedTime } = params;
  const isActing = actionKind !== 'NONE' && actionProgress > 0;

  if (isBathing) {
    const floatBob = Math.sin(elapsedTime * 2.4) * 1.05;
    ctx.save();
    ctx.translate(0, floatBob);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.strokeStyle = 'rgba(224, 242, 254, 0.72)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(0, -10.5, 14.5 + Math.sin(elapsedTime * 3) * 1.8, 5.2, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Anatomical bare shoulders & sculpted collarbone/chest
    const chestGrad = ctx.createLinearGradient(-8, -21, 8, -9);
    chestGrad.addColorStop(0, SKIN_HIGHLIGHT);
    chestGrad.addColorStop(0.5, SKIN);
    chestGrad.addColorStop(1, SKIN_SHADE);
    ctx.fillStyle = chestGrad;
    ctx.strokeStyle = EDGE_SKIN;
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(-9.2, -11.5);
    ctx.bezierCurveTo(-9.4, -16.2, -7.1, -18.8, -2.5, -20.2);
    ctx.lineTo(2.5, -20.2);
    ctx.bezierCurveTo(7.1, -18.8, 9.4, -16.2, 9.2, -11.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sculpted collarbone & pectoral curve
    ctx.strokeStyle = 'rgba(135, 75, 44, 0.55)';
    ctx.lineWidth = 0.36;
    ctx.beginPath();
    ctx.moveTo(-5.2, -17.3);
    ctx.quadraticCurveTo(-2.6, -16.4, -0.8, -16.9);
    ctx.moveTo(5.2, -17.3);
    ctx.quadraticCurveTo(2.6, -16.4, 0.8, -16.9);
    ctx.stroke();

    ctx.fillStyle = 'rgba(56, 189, 248, 0.52)';
    ctx.beginPath();
    ctx.ellipse(0, -10.5, 13.0, 4.0, 0, 0, Math.PI * 2);
    ctx.fill();

    // Neck + chin AO
    const neckGrad = ctx.createLinearGradient(-2, -23.8, 2, -19.5);
    neckGrad.addColorStop(0, SKIN_SHADE);
    neckGrad.addColorStop(0.5, SKIN);
    neckGrad.addColorStop(1, SKIN_SHADE);
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.roundRect(-2.1, -24.2, 4.2, 4.5, 1.1);
    ctx.fill();

    ctx.fillStyle = SKIN_AO;
    ctx.beginPath();
    ctx.ellipse(0, -23.0, 2.2, 0.9, 0, 0, Math.PI);
    ctx.fill();

    drawRealisticHairBackLayer(ctx, -29.6, 0);
    drawRealisticFrontFace(ctx, -35.2, false, true, 0);

    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(0, -bob);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Ground anchor at y = 0; feet sit at ~ +2.4, hair crown reaches ~ -58.0 (total ~60.4px)
  const hipY = -23.0 + pose.squatY;

  if (facingDir === 'DOWN' || facingDir === 'UP') {
    const isFront = facingDir === 'DOWN';
    const stepL = isMoving && !isActing ? stride : 0;
    const stepR = isMoving && !isActing ? -stride : 0;
    const liftL = isMoving && !isActing ? Math.max(0, -stepL) * 3.6 : 0;
    const liftR = isMoving && !isActing ? Math.max(0, -stepR) * 3.6 : 0;
    const fwdDropL = isMoving && !isActing ? Math.max(0, stepL) * 1.15 : 0;
    const fwdDropR = isMoving && !isActing ? Math.max(0, stepR) * 1.15 : 0;

    const armSwingL = isMoving && !isActing ? stride * 0.28 : idleBreath * 0.02;
    const armSwingR = isMoving && !isActing ? -stride * 0.28 : -idleBreath * 0.02;
    const elbowWalkL = isMoving && !isActing ? Math.max(0, stride) * 0.22 + 0.08 : 0.08;
    const elbowWalkR = isMoving && !isActing ? Math.max(0, -stride) * 0.22 + 0.08 : 0.08;
    const walkTilt = isMoving && !isActing ? stride * 0.02 : 0;
    const walkSwayX = isMoving && !isActing ? stride * 0.55 : 0;

    // --- 1. ANATOMICAL CHARCOAL DENIM LEGS & SANDALS (~23.5px long) ---
    const footSpread = pose.stanceSpread;

    const drawFrontBackLeg = (
      side: 'L' | 'R',
      lift: number,
      fwdDrop: number,
      isAdvancing: boolean
    ) => {
      const sign = side === 'L' ? -1 : 1;
      const xCenter = sign * (3.65 + footSpread * 0.48);
      const ankleY = -1.6 - lift + fwdDrop;
      const legHeight = Math.max(12.0, ankleY - hipY + 1.2);
      const isShaded = !isAdvancing && isMoving;

      const legGrad = ctx.createLinearGradient(xCenter - 3.3, hipY, xCenter + 3.3, hipY);
      legGrad.addColorStop(0, isShaded ? JEANS_DEEP : JEANS_SHADE);
      legGrad.addColorStop(0.42, isShaded ? JEANS_SHADE : JEANS_LIGHT);
      legGrad.addColorStop(0.75, isShaded ? JEANS_SHADE : JEANS);
      legGrad.addColorStop(1, JEANS_DEEP);

      // Sculpted quad thigh -> knee taper -> athletic calf -> tapered ankle
      ctx.fillStyle = legGrad;
      ctx.strokeStyle = EDGE_DENIM;
      ctx.lineWidth = 0.38;
      ctx.beginPath();
      ctx.moveTo(xCenter - 3.35, hipY);
      ctx.bezierCurveTo(
        xCenter - 3.5,
        hipY + legHeight * 0.32,
        xCenter - 2.95,
        hipY + legHeight * 0.58,
        xCenter - 2.35,
        ankleY - 1.1
      );
      ctx.lineTo(xCenter + 2.35, ankleY - 1.1);
      ctx.bezierCurveTo(
        xCenter + 2.95,
        hipY + legHeight * 0.58,
        xCenter + 3.5,
        hipY + legHeight * 0.32,
        xCenter + 3.35,
        hipY
      );
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Subtle thigh/knee denim fade & crease
      ctx.fillStyle = isShaded ? 'rgba(34, 39, 49, 0.3)' : 'rgba(71, 85, 105, 0.24)';
      ctx.beginPath();
      ctx.ellipse(xCenter, hipY + legHeight * 0.44, 1.25, 2.9, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = JEANS_DEEP;
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.moveTo(xCenter - 1.35, hipY + legHeight * 0.48);
      ctx.quadraticCurveTo(xCenter, hipY + legHeight * 0.51, xCenter + 1.35, hipY + legHeight * 0.48);
      ctx.stroke();

      // Vertical denim outseam stitch
      ctx.strokeStyle = JEANS_STITCH;
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.moveTo(xCenter + sign * 2.1, hipY + 2.2);
      ctx.quadraticCurveTo(xCenter + sign * 1.9, hipY + legHeight * 0.5, xCenter + sign * 1.65, ankleY - 2.2);
      ctx.stroke();

      // 2.5D curved cuff hem
      ctx.fillStyle = JEANS_SHADE;
      ctx.strokeStyle = EDGE_DENIM;
      ctx.lineWidth = 0.34;
      ctx.beginPath();
      ctx.roundRect(xCenter - 2.55, ankleY - 2.2, 5.1, 1.65, 0.6);
      ctx.fill();
      ctx.stroke();

      drawRealisticSandalFoot(
        ctx,
        xCenter,
        ankleY,
        isAdvancing ? 6.8 : 6.5,
        false,
        !isFront,
        !isFront && lift > 1.8,
        isShaded,
        sign
      );
    };

    if (stepL >= stepR) {
      drawFrontBackLeg('R', liftR, fwdDropR, false);
      drawFrontBackLeg('L', liftL, fwdDropL, true);
    } else {
      drawFrontBackLeg('L', liftL, fwdDropL, false);
      drawFrontBackLeg('R', liftR, fwdDropR, true);
    }

    // --- Arm kinematics ---
    let leftArmRot = armSwingL + 0.08;
    let rightArmRot = armSwingR - 0.08;
    let leftElbow = elbowWalkL;
    let rightElbow = -elbowWalkR;
    let showToolInRightHand = false;
    let toolWristAngle = pose.wristAngle;

    const passiveWeaponKind: PlayerActionKind | null =
      params.selectedItemId === 'weapon_sword'
        ? 'SWORD'
        : params.selectedItemId === 'weapon_rifle'
        ? 'RIFLE'
        : null;

    if (!isActing && passiveWeaponKind) {
      showToolInRightHand = true;
      toolWristAngle = passiveWeaponKind === 'RIFLE' ? -0.35 : 0.1;
    }

    if (isActing) {
      if (actionKind === 'HOE' || actionKind === 'AXE') {
        showToolInRightHand = true;
        if (isFront) {
          const p = pose.frontArcArm;
          const mag = p < 0 ? lerp(0.25, 2.65, -p) : lerp(0.25, 0.38, p);
          leftArmRot = p < 0 ? -mag : -0.35;
          rightArmRot = p < 0 ? mag : 0.35;
          leftElbow = 0.15;
          rightElbow = -0.15;
          toolWristAngle = p < 0 ? -0.6 : 0.15;
        } else {
          const p = pose.frontArcArm;
          if (p < 0) {
            const mag = lerp(0.3, 2.75, -p);
            leftArmRot = -mag;
            rightArmRot = mag;
            toolWristAngle = 0.2;
          } else {
            leftArmRot = -2.4;
            rightArmRot = 2.65 - p * 0.35;
            toolWristAngle = -0.35;
          }
        }
      } else if (actionKind === 'SCYTHE' || actionKind === 'SWORD') {
        showToolInRightHand = true;
        rightArmRot = lerp(-1.45, 1.25, (pose.sweepSide + 1) * 0.5);
        leftArmRot = -0.25;
        rightElbow = -0.25;
        toolWristAngle = isFront ? -0.45 : -Math.PI + 0.45;
      } else if (actionKind === 'RIFLE') {
        showToolInRightHand = true;
        rightArmRot = isFront ? 0.15 : -2.6;
        leftArmRot = isFront ? -0.35 : 2.3;
        rightElbow = isFront ? 0.25 : -0.25;
        toolWristAngle = 0;
      } else if (actionKind === 'WATER') {
        showToolInRightHand = true;
        rightArmRot = isFront ? 0.55 : -2.25;
        leftArmRot = isFront ? -0.18 : 0.18;
        rightElbow = isFront ? 0.22 : -0.15;
        toolWristAngle = isFront ? 0.25 : -0.2;
      } else if (actionKind === 'PLANT' || actionKind === 'HARVEST') {
        showToolInRightHand = actionKind === 'PLANT';
        leftArmRot = isFront ? -0.42 : -2.45;
        rightArmRot = isFront ? 0.42 : 2.45;
      } else if (actionKind === 'CONSUME') {
        showToolInRightHand = true;
        rightArmRot = isFront ? 2.25 : -2.1;
        leftArmRot = 0.08;
        rightElbow = isFront ? 0.25 : -0.2;
        toolWristAngle = isFront ? -2.2 : 1.9;
      }
    }

    // --- 2. 2.5D UPPER BODY RIG ---
    ctx.save();
    ctx.translate(walkSwayX, hipY);
    ctx.rotate(walkTilt);

    // Sculpted Pelvis & Jeans Waistband (2.5D curved elliptical front)
    const pelvisGrad = ctx.createLinearGradient(-7.2, -1.5, 7.2, 3.2);
    pelvisGrad.addColorStop(0, JEANS_SHADE);
    pelvisGrad.addColorStop(0.4, JEANS_LIGHT);
    pelvisGrad.addColorStop(1, JEANS_DEEP);

    ctx.fillStyle = pelvisGrad;
    ctx.strokeStyle = EDGE_DENIM;
    ctx.lineWidth = 0.38;
    ctx.beginPath();
    ctx.moveTo(-7.15, -1.6);
    ctx.quadraticCurveTo(0, -0.75, 7.15, -1.6);
    ctx.lineTo(7.25, 2.2);
    ctx.quadraticCurveTo(0, 3.45, -7.25, 2.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Full-grain leather belt wrapping in 2.5D arc
    const beltGrad = ctx.createLinearGradient(-7, -1.5, 7, 0);
    beltGrad.addColorStop(0, BELT_DARK);
    beltGrad.addColorStop(0.45, BELT_LIGHT);
    beltGrad.addColorStop(1, BELT_DARK);
    ctx.fillStyle = beltGrad;
    ctx.beginPath();
    ctx.moveTo(-6.95, -1.4);
    ctx.quadraticCurveTo(0, -0.55, 6.95, -1.4);
    ctx.lineTo(6.95, 0.05);
    ctx.quadraticCurveTo(0, 0.9, -6.95, 0.05);
    ctx.closePath();
    ctx.fill();

    // Belt loops
    ctx.fillStyle = JEANS_SHADE;
    ctx.beginPath();
    ctx.roundRect(-4.5, -1.35, 0.95, 2.0, 0.25);
    ctx.roundRect(3.55, -1.35, 0.95, 2.0, 0.25);
    ctx.fill();

    if (isFront) {
      // Brushed metal belt buckle + fly seam + riveted curved front pockets
      ctx.fillStyle = BUCKLE;
      ctx.strokeStyle = BUCKLE_DARK;
      ctx.lineWidth = 0.32;
      ctx.beginPath();
      ctx.roundRect(-1.35, -0.95, 2.7, 1.85, 0.4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = BUCKLE_LIGHT;
      ctx.beginPath();
      ctx.roundRect(-0.85, -0.55, 0.9, 0.9, 0.2);
      ctx.fill();

      ctx.strokeStyle = JEANS_STITCH;
      ctx.lineWidth = 0.32;
      ctx.beginPath();
      ctx.moveTo(0, 0.9);
      ctx.lineTo(0, 2.95);
      ctx.quadraticCurveTo(0, 3.4, 0.65, 3.4);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-6.6, 1.15);
      ctx.quadraticCurveTo(-4.8, 2.45, -3.55, 0.7);
      ctx.moveTo(6.6, 1.15);
      ctx.quadraticCurveTo(4.8, 2.45, 3.55, 0.7);
      ctx.stroke();

      ctx.fillStyle = '#94A3B8';
      ctx.beginPath();
      ctx.arc(-3.55, 0.85, 0.34, 0, Math.PI * 2);
      ctx.arc(3.55, 0.85, 0.34, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = JEANS_STITCH;
      ctx.lineWidth = 0.32;
      ctx.beginPath();
      ctx.roundRect(-5.5, 0.8, 3.3, 2.25, 0.4);
      ctx.roundRect(2.2, 0.8, 3.3, 2.25, 0.4);
      ctx.stroke();
    }

    const drawArmsBehind =
      !isFront &&
      isActing &&
      (actionKind === 'PLANT' ||
        actionKind === 'HARVEST' ||
        actionKind === 'WATER' ||
        actionKind === 'SCYTHE' ||
        actionKind === 'SWORD' ||
        actionKind === 'RIFLE' ||
        ((actionKind === 'HOE' || actionKind === 'AXE') && pose.frontArcArm >= 0));

    const frontBackHeldAction = showToolInRightHand
      ? {
          kind: isActing ? actionKind : (passiveWeaponKind ?? actionKind),
          wristAngle: toolWristAngle,
          pose,
          params,
        }
      : undefined;

    if (drawArmsBehind) {
      drawRealisticArm(ctx, -8.5, -14.8, leftArmRot, leftElbow, false, -1);
      drawRealisticArm(ctx, 8.5, -14.8, rightArmRot, rightElbow, false, 1, frontBackHeldAction);
    }

    const torsoSquash = 1 - Math.abs(pose.torsoLean) * 0.14;
    ctx.save();
    ctx.scale(1, torsoSquash);

    if (!drawArmsBehind && !isActing) {
      drawRealisticArm(ctx, -8.5, -14.8, leftArmRot, leftElbow, false, -1);
      drawRealisticArm(ctx, 8.5, -14.8, rightArmRot, rightElbow, false, 1, frontBackHeldAction);
    }

    // --- 3. 2.5D ATHLETIC V-TAPER WHITE CREWNECK T-SHIRT (SHOULDERS ~19px WIDE!) ---
    const shirtGrad = ctx.createLinearGradient(-8.5, -17.5, 8.5, -1.0);
    shirtGrad.addColorStop(0, SHIRT_LIT);
    shirtGrad.addColorStop(0.28, SHIRT_HIGHLIGHT);
    shirtGrad.addColorStop(0.68, SHIRT);
    shirtGrad.addColorStop(1, SHIRT_SHADE);

    ctx.fillStyle = shirtGrad;
    ctx.strokeStyle = EDGE_CLOTH;
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    // Broad realistic shoulders sloping gently from trapezius down to deltoid seam
    ctx.moveTo(-8.45, -15.3);
    ctx.quadraticCurveTo(-5.4, -17.1, -2.2, -17.6);
    ctx.lineTo(2.2, -17.6);
    ctx.quadraticCurveTo(5.4, -17.1, 8.45, -15.3);
    // Athletic V-taper ribcage -> narrow waist -> gentle hip hem flare
    ctx.bezierCurveTo(8.1, -11.0, 7.2, -6.5, 7.15, -1.25);
    ctx.quadraticCurveTo(0, 0.35, -7.15, -1.25);
    ctx.bezierCurveTo(-7.2, -6.5, -8.1, -11.0, -8.45, -15.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Soft hem underside fold & ambient occlusion
    ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.beginPath();
    ctx.moveTo(-7.05, -3.5);
    ctx.quadraticCurveTo(0, -1.9, 7.05, -3.5);
    ctx.lineTo(7.1, -1.25);
    ctx.quadraticCurveTo(0, 0.25, -7.1, -1.25);
    ctx.closePath();
    ctx.fill();

    if (isFront) {
      // Sculpted pectoral planes + sternum shadow + oblique fabric folds
      ctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
      ctx.beginPath();
      ctx.ellipse(-3.1, -11.4, 2.7, 1.35, 0.15, 0, Math.PI);
      ctx.ellipse(3.1, -11.4, 2.7, 1.35, -0.15, 0, Math.PI);
      ctx.fill();

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.42)';
      ctx.lineWidth = 0.34;
      ctx.beginPath();
      ctx.moveTo(-5.5, -10.9);
      ctx.quadraticCurveTo(-2.8, -9.8, -0.65, -11.0);
      ctx.moveTo(5.5, -10.9);
      ctx.quadraticCurveTo(2.8, -9.8, 0.65, -11.0);
      // Natural waist tension drapes
      ctx.moveTo(-5.6, -6.4);
      ctx.quadraticCurveTo(-3.2, -5.4, -1.6, -5.0);
      ctx.moveTo(5.6, -6.4);
      ctx.quadraticCurveTo(3.2, -5.4, 1.6, -5.0);
      ctx.stroke();
    } else {
      // Scapula / upper back contour & shoulder yoke creases
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = 0.34;
      ctx.beginPath();
      ctx.moveTo(-6.4, -13.0);
      ctx.quadraticCurveTo(0, -11.8, 6.4, -13.0);
      ctx.moveTo(-4.5, -7.2);
      ctx.quadraticCurveTo(0, -6.0, 4.5, -7.2);
      ctx.stroke();
    }

    // 2.5D Ribbed Crewneck Collar & Clavicle Skin
    ctx.fillStyle = isFront ? SKIN_SHADE : SHIRT_SHADE;
    ctx.strokeStyle = EDGE_CLOTH;
    ctx.lineWidth = 0.36;
    ctx.beginPath();
    ctx.ellipse(0, -17.3, 3.05, 1.35, 0, 0, Math.PI * (isFront ? 1 : 2));
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = SHIRT_MID;
    ctx.lineWidth = 0.72;
    ctx.beginPath();
    ctx.ellipse(0, -17.15, 3.3, 1.55, 0, 0.08, Math.PI - 0.08);
    ctx.stroke();

    // --- 4. SCULPTED ANATOMICAL NECK & REALISTIC 2.5D HEAD ---
    const headShiftY = pose.headTilt * 6 + idleBreath * 0.18;
    const neckGrad = ctx.createLinearGradient(-2.1, -21.2, 2.1, -16.8);
    neckGrad.addColorStop(0, SKIN_SHADE);
    neckGrad.addColorStop(0.5, SKIN);
    neckGrad.addColorStop(1, SKIN_SHADE);

    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.roundRect(-1.95, -21.2, 3.9, 4.4, 0.9);
    ctx.fill();

    // Chin ambient occlusion shadow onto neck
    ctx.fillStyle = SKIN_AO;
    ctx.beginPath();
    ctx.ellipse(0, -19.8, 2.05, 0.85, 0, 0, Math.PI);
    ctx.fill();

    ctx.save();
    ctx.translate(0, headShiftY);

    if (isFront) {
      // Head spans y = -31.3 to -19.0 relative to hipY (-23.0) -> clean 2.2px neck gap above collar (-16.8)
      drawRealisticHairBackLayer(ctx, -25.6, hairBounce);
      drawRealisticFrontFace(ctx, -31.3, isBlinking, false, hairBounce);
    } else {
      drawRealisticBackHead(ctx, -25.6, hairBounce);
    }
    ctx.restore(); // end head

    if (!drawArmsBehind && isActing) {
      drawRealisticArm(ctx, -8.5, -14.8, leftArmRot, leftElbow, false, -1);
      drawRealisticArm(ctx, 8.5, -14.8, rightArmRot, rightElbow, false, 1, frontBackHeldAction);
    }

    if (pose.slashAlpha > 0.05) {
      ctx.save();
      ctx.globalAlpha = pose.slashAlpha * 0.72;
      ctx.strokeStyle =
        actionKind === 'SWORD' ? '#38BDF8' : actionKind === 'SCYTHE' ? '#F8FAFC' : '#FDE047';
      ctx.lineWidth = actionKind === 'SWORD' ? 3.5 : 2.9;
      ctx.beginPath();
      if (actionKind === 'SCYTHE' || actionKind === 'SWORD') {
        const arcY = isFront ? 4 : -34;
        ctx.arc(
          0,
          arcY,
          actionKind === 'SWORD' ? 24 : 20,
          isFront ? 0.25 : Math.PI + 0.25,
          isFront ? Math.PI - 0.25 : Math.PI * 2 - 0.25
        );
      } else {
        ctx.arc(0, isFront ? -5 : -42, 17.5, -Math.PI * 0.8, -Math.PI * 0.2);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore(); // end torsoSquash
    ctx.restore(); // end hipY
  } else {
    // --- 2.5D 3/4-PROFILE SIDE VIEW (LEFT / RIGHT; +X is forward) ---
    const dir = facingDir === 'LEFT' ? -1 : 1;
    ctx.scale(dir, 1);

    const drawSideLeg = (isFrontLeg: boolean, phaseOffset: number) => {
      const legPhase = isMoving && !isActing ? phase + phaseOffset : 0;
      const swing = isMoving && !isActing ? Math.sin(legPhase) : 0;
      const cosP = isMoving && !isActing ? Math.cos(legPhase) : 0;

      const thighAngle = isActing
        ? isFrontLeg
          ? -0.20 - pose.stanceSpread * 0.04
          : 0.18 + pose.stanceSpread * 0.04
        : -swing * 0.40;

      const kneeAngle = isActing
        ? pose.squatY * 0.10
        : isMoving
        ? Math.max(0, cosP * 0.50 + (swing > 0 ? 0.12 : 0))
        : 0.03;

      const thighLen = Math.max(7.8, 12.0 - pose.squatY * 0.45);
      const shinLen = Math.max(7.6, 11.4 - pose.squatY * 0.4);
      const footTilt = isActing ? 0 : isMoving ? -swing * 0.14 : 0;

      // Subtle 2.5D depth offset between far leg and near leg
      const legDepthX = isFrontLeg ? -0.35 : 0.95;
      const legDepthY = isFrontLeg ? 0 : -0.65;

      ctx.save();
      ctx.translate(
        legDepthX + (isActing ? (isFrontLeg ? pose.stanceSpread * 0.4 : -pose.stanceSpread * 0.4) : 0),
        hipY + legDepthY
      );
      ctx.rotate(thighAngle);

      const thighGrad = ctx.createLinearGradient(-3.1, 0, 3.1, 0);
      thighGrad.addColorStop(0, isFrontLeg ? JEANS_SHADE : JEANS_DEEP);
      thighGrad.addColorStop(0.55, isFrontLeg ? JEANS_LIGHT : JEANS_SHADE);
      thighGrad.addColorStop(1, isFrontLeg ? JEANS : JEANS_DEEP);

      ctx.fillStyle = thighGrad;
      ctx.strokeStyle = EDGE_DENIM;
      ctx.lineWidth = 0.38;
      ctx.beginPath();
      ctx.moveTo(-2.95, 0);
      ctx.bezierCurveTo(-3.15, thighLen * 0.4, -2.65, thighLen * 0.78, -2.2, thighLen + 0.9);
      ctx.lineTo(2.2, thighLen + 0.9);
      ctx.bezierCurveTo(2.75, thighLen * 0.75, 3.1, thighLen * 0.35, 2.85, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Knee -> Calf -> Sandal
      ctx.save();
      ctx.translate(0, thighLen - 0.5);
      ctx.rotate(kneeAngle);

      ctx.fillStyle = isFrontLeg ? JEANS : JEANS_SHADE;
      ctx.beginPath();
      ctx.moveTo(-2.2, 0);
      ctx.bezierCurveTo(-2.7, shinLen * 0.32, -2.25, shinLen * 0.68, -1.85, shinLen);
      ctx.lineTo(1.95, shinLen);
      ctx.bezierCurveTo(2.25, shinLen * 0.65, 2.45, shinLen * 0.3, 2.15, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (isFrontLeg) {
        ctx.strokeStyle = JEANS_STITCH;
        ctx.lineWidth = 0.3;
        ctx.beginPath();
        ctx.moveTo(0.15, 0.5);
        ctx.lineTo(0.1, shinLen - 2.0);
        ctx.stroke();
      }

      ctx.fillStyle = JEANS_SHADE;
      ctx.strokeStyle = EDGE_DENIM;
      ctx.lineWidth = 0.34;
      ctx.beginPath();
      ctx.roundRect(-2.15, shinLen - 1.9, 4.3, 1.65, 0.55);
      ctx.fill();
      ctx.stroke();

      ctx.save();
      ctx.translate(1.15, shinLen - 0.8);
      ctx.rotate(footTilt);
      drawRealisticSandalFoot(ctx, 0, 0, isFrontLeg ? 7.8 : 7.4, true, false, false, !isFrontLeg);
      ctx.restore();

      ctx.restore();
      ctx.restore();
    };

    drawSideLeg(false, Math.PI);
    drawSideLeg(true, 0);

    // --- 2.5D SIDE UPPER BODY RIG ---
    ctx.save();
    ctx.translate(0, hipY);
    const bodyLean = isActing
      ? pose.torsoLean
      : isMoving
      ? 0.045 + Math.abs(stride) * 0.02
      : idleBreath * 0.01;
    ctx.rotate(bodyLean);

    const walkArmSwingF = isMoving && !isActing ? stride * 0.42 : idleBreath * 0.025;
    const walkArmSwingB = isMoving && !isActing ? -stride * 0.42 : -idleBreath * 0.025;
    const walkElbowF = isMoving && !isActing ? (stride < 0 ? -0.34 : -0.10) : -0.08;
    const walkElbowB = isMoving && !isActing ? (stride > 0 ? -0.34 : -0.10) : -0.08;

    const backArmRot = isActing
      ? pose.armForward - (actionKind === 'CONSUME' ? -1.85 : 0.14)
      : walkArmSwingB;
    const frontArmRot = isActing ? pose.armForward : walkArmSwingF;

    // Far shoulder shifted slightly forward/up in 2.5D 3/4 space
    drawRealisticArm(
      ctx,
      1.6,
      -15.2,
      backArmRot,
      isActing ? -0.12 : walkElbowB,
      true,
      1
    );

    // Sculpted 2.5D Profile Torso (rounded chest projecting forward, natural upper back curve, tapered waist)
    const profShirtGrad = ctx.createLinearGradient(-5.5, -17.5, 5.5, -1.0);
    profShirtGrad.addColorStop(0, SHIRT_SHADE);
    profShirtGrad.addColorStop(0.45, SHIRT);
    profShirtGrad.addColorStop(1, SHIRT_HIGHLIGHT);

    ctx.fillStyle = profShirtGrad;
    ctx.strokeStyle = EDGE_CLOTH;
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(-4.9, -15.3);
    ctx.quadraticCurveTo(0.2, -17.4, 4.9, -15.2);
    // Natural chest projection (+5.55) tapering softly to waist (+4.5)
    ctx.bezierCurveTo(5.65, -11.4, 5.2, -6.8, 4.65, -1.1);
    ctx.quadraticCurveTo(0, 0.35, -4.75, -1.1);
    // Natural upper back shoulder-blade curve -> lumbar curve
    ctx.bezierCurveTo(-5.3, -6.2, -5.6, -11.2, -4.9, -15.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Subtle chest contour crease & hem shadow
    ctx.fillStyle = 'rgba(148, 163, 184, 0.24)';
    ctx.beginPath();
    ctx.roundRect(-4.5, -2.8, 9.0, 1.85, 0.45);
    ctx.fill();

    // Waistband & leather belt
    ctx.fillStyle = JEANS;
    ctx.strokeStyle = EDGE_DENIM;
    ctx.lineWidth = 0.36;
    ctx.beginPath();
    ctx.roundRect(-4.85, -1.45, 9.7, 3.6, 1.15);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = BELT;
    ctx.beginPath();
    ctx.roundRect(-4.6, -0.95, 9.2, 1.5, 0.38);
    ctx.fill();
    ctx.fillStyle = BUCKLE;
    ctx.beginPath();
    ctx.roundRect(3.2, -1.1, 1.35, 1.8, 0.35);
    ctx.fill();

    // Crewneck collar rim
    ctx.strokeStyle = SHIRT_MID;
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.ellipse(0.3, -16.8, 2.7, 1.05, 0.1, 0, Math.PI);
    ctx.stroke();

    // Neck & Profile Head
    const neckGrad = ctx.createLinearGradient(-1.8, -21.0, 1.8, -16.8);
    neckGrad.addColorStop(0, SKIN_SHADE);
    neckGrad.addColorStop(0.55, SKIN);
    neckGrad.addColorStop(1, SKIN_HIGHLIGHT);
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.roundRect(-1.75, -21.0, 3.6, 4.3, 0.85);
    ctx.fill();

    ctx.save();
    ctx.translate(0.3, -19.7 + idleBreath * 0.16);
    ctx.rotate(pose.headTilt);

    drawRealisticProfileHead(ctx, isBlinking, hairBounce);

    ctx.restore(); // end head

    const sideHeldWeaponKind: PlayerActionKind | null =
      params.selectedItemId === 'weapon_sword'
        ? 'SWORD'
        : params.selectedItemId === 'weapon_rifle'
        ? 'RIFLE'
        : null;

    // Near arm anchored slightly back on shoulder joint (-0.5) for natural 3/4 depth
    drawRealisticArm(
      ctx,
      -0.5,
      -14.6,
      !isActing && sideHeldWeaponKind === 'RIFLE' ? -0.95 : frontArmRot,
      isActing ? -0.14 : walkElbowF,
      false,
      1,
      isActing && actionKind !== 'HARVEST'
        ? { kind: actionKind, wristAngle: pose.wristAngle, pose, params }
        : sideHeldWeaponKind
        ? { kind: sideHeldWeaponKind, wristAngle: sideHeldWeaponKind === 'RIFLE' ? -0.55 : -0.25, pose, params }
        : undefined
    );

    if (pose.slashAlpha > 0.05) {
      ctx.save();
      ctx.globalAlpha = pose.slashAlpha * 0.72;
      ctx.strokeStyle =
        actionKind === 'SWORD' ? '#38BDF8' : actionKind === 'SCYTHE' ? '#F8FAFC' : '#FDE047';
      ctx.lineWidth = actionKind === 'SWORD' ? 3.5 : 2.9;
      ctx.beginPath();
      ctx.arc(8, -10, actionKind === 'SWORD' ? 26 : 22, -Math.PI * 0.48, Math.PI * 0.18);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore(); // end upper body rig
  }

  ctx.restore();
}

// Dedicated 4x supersample buffer sized cleanly for 96px-tall (2-tile) side-profile character
const SIDE_SS_SCALE = 4;
const SIDE_SS_W = 104; // covers -52 .. +52
const SIDE_SS_H = 128; // covers -112 .. +16
const SIDE_SS_ORIGIN_X = 52;
const SIDE_SS_ORIGIN_Y = 112;
let sideSsCanvas: HTMLCanvasElement | null = null;
let sideSsCtx: CanvasRenderingContext2D | null = null;

function getSideSupersampleBuffer(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  if (!sideSsCanvas) {
    sideSsCanvas = document.createElement('canvas');
    sideSsCanvas.width = SIDE_SS_W * SIDE_SS_SCALE;
    sideSsCanvas.height = SIDE_SS_H * SIDE_SS_SCALE;
    sideSsCtx = sideSsCanvas.getContext('2d');
  }
  if (!sideSsCtx) return null;
  return { canvas: sideSsCanvas, ctx: sideSsCtx };
}

function drawRigPart(
  ctx: CanvasRenderingContext2D,
  part: HTMLCanvasElement,
  drawW: number,
  drawH: number,
  pivotNormX: number,
  pivotNormY: number,
  rot: number,
  offsetX = 0,
  offsetY = 0,
  scaleX = 1,
  scaleY = 1
) {
  const px = -drawW * 0.5 + pivotNormX * drawW;
  const py = -drawH + pivotNormY * drawH;
  ctx.save();
  ctx.translate(px + offsetX, py + offsetY);
  if (rot !== 0) ctx.rotate(rot);
  if (scaleX !== 1 || scaleY !== 1) ctx.scale(scaleX, scaleY);
  ctx.drawImage(part, -pivotNormX * drawW, -pivotNormY * drawH, drawW, drawH);
  ctx.restore();
}

// ============================================================================
// MATCHED 2.5D SIDE-PROFILE CEL-SHADED CHARACTER (1:1 WITH UPLOADED SPRITE)
// Total standing height = 96px (2 farm plot tiles), feet locked to y = 0
// ============================================================================
interface SideLegKinematics {
  hipA: number;
  kneeRelA: number;
  ankleRelA: number;
  maxDropY: number;
}

function drawSideProfileLeg(
  ctx: CanvasRenderingContext2D,
  hipX: number,
  hipY: number,
  thighL: number,
  shinL: number,
  kin: SideLegKinematics,
  isFar: boolean
) {
  const jeansBase = isFar ? '#14171D' : '#1E2129';
  const jeansHighlight = isFar ? '#1E222B' : '#2E3442';
  const jeansShade = isFar ? '#0E1015' : '#15181F';
  const ink = '#0E1015';
  const skinBase = isFar ? '#C98359' : '#EEAA7E';
  const skinShade = isFar ? '#AD6B45' : '#D2875C';
  const strapMain = isFar ? '#213D69' : '#2F5591';
  const strapHi = isFar ? '#365C99' : '#537EC4';
  const soleBase = isFar ? '#141A26' : '#1E2738';

  const shinWorld = kin.hipA + kin.kneeRelA;
  const footWorld = shinWorld + kin.ankleRelA;

  // Compute exact 2-bone joint coordinates in parent space for seamless bezier silhouette
  const hx = hipX;
  const hy = hipY;
  const kx = hx - Math.sin(kin.hipA) * thighL;
  const ky = hy + Math.cos(kin.hipA) * thighL;
  const ax = kx - Math.sin(shinWorld) * shinL;
  const ay = ky + Math.cos(shinWorld) * shinL;

  // Outward perpendiculars (+X right/front normal, -X back normal)
  const fnHx = Math.cos(kin.hipA);
  const fnHy = Math.sin(kin.hipA);
  const fnSx = Math.cos(shinWorld);
  const fnSy = Math.sin(shinWorld);
  // Smoothed knee normal bisector
  const knxRaw = fnHx + fnSx;
  const knyRaw = fnHy + fnSy;
  const knLen = Math.hypot(knxRaw, knyRaw) || 1;
  const fnKx = knxRaw / knLen;
  const fnKy = knyRaw / knLen;

  // Midpoint anchors along thigh and shin
  const midThighX = (hx + kx) * 0.5;
  const midThighY = (hy + ky) * 0.5;
  const midShinX = (kx + ax) * 0.5;
  const midShinY = (ky + ay) * 0.5;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 1. Continuous anatomical charcoal jeans pant-leg (ZERO overlapping pill seams at knee!)
  const fHipX = hx + fnHx * 6.0;
  const fHipY = hy + fnHy * 6.0;
  const fThighX = midThighX + fnHx * 5.7;
  const fThighY = midThighY + fnHy * 5.7;
  const fKneeX = kx + fnKx * 4.9;
  const fKneeY = ky + fnKy * 4.9;
  const fCalfX = midShinX + fnSx * 4.4;
  const fCalfY = midShinY + fnSy * 4.4;
  const fCuffX = ax + fnSx * 3.9;
  const fCuffY = ay + fnSy * 3.9;

  const bHipX = hx - fnHx * 5.8;
  const bHipY = hy - fnHy * 5.8;
  const bThighX = midThighX - fnHx * 5.4;
  const bThighY = midThighY - fnHy * 5.4;
  const bKneeX = kx - fnKx * 4.1;
  const bKneeY = ky - fnKy * 4.1;
  const bCalfX = midShinX - fnSx * 4.8;
  const bCalfY = midShinY - fnSy * 4.8;
  const bCuffX = ax - fnSx * 3.9;
  const bCuffY = ay - fnSy * 3.9;

  ctx.fillStyle = jeansBase;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.15;
  ctx.beginPath();
  ctx.moveTo(bHipX, bHipY);
  ctx.quadraticCurveTo(hx, hy - 3.5, fHipX, fHipY);
  ctx.quadraticCurveTo(fThighX, fThighY, fKneeX, fKneeY);
  ctx.quadraticCurveTo(fCalfX, fCalfY, fCuffX, fCuffY);
  ctx.quadraticCurveTo(ax, ay + 1.1, bCuffX, bCuffY);
  ctx.quadraticCurveTo(bCalfX, bCalfY, bKneeX, bKneeY);
  ctx.quadraticCurveTo(bThighX, bThighY, bHipX, bHipY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Denim highlight strip + subtle knee crease + cuffed hem
  if (!isFar) {
    ctx.strokeStyle = jeansHighlight;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(hx + fnHx * 3.2, hy + fnHy * 3.2 + 1.5);
    ctx.quadraticCurveTo(midThighX + fnHx * 3.2, midThighY + fnHy * 3.2, kx + fnKx * 2.6, ky + fnKy * 2.6);
    ctx.quadraticCurveTo(midShinX + fnSx * 2.2, midShinY + fnSy * 2.2, ax + fnSx * 1.9, ay + fnSy * 1.9 - 1.5);
    ctx.stroke();

    // Subtle knee fold lines
    ctx.strokeStyle = jeansShade;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(bKneeX + fnKx * 1.2, bKneeY + fnKy * 1.2);
    ctx.quadraticCurveTo(kx, ky + 0.5, kx + fnKx * 2.0, ky + fnKy * 2.0);
    ctx.stroke();
  }

  // Jeans cuff hem fold
  ctx.strokeStyle = isFar ? '#0B0D12' : '#363E4D';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(bCuffX + fnSx * 0.4, bCuffY + fnSy * 0.4 - 1.4);
  ctx.quadraticCurveTo(ax, ay - 0.8, fCuffX - fnSx * 0.4, fCuffY - fnSy * 0.4 - 1.4);
  ctx.stroke();

  // 2. Pivoting Ankle + Exposed Foot + Navy 2-Strap Trekking Sandal (sole bottom at local y = +10.0)
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(footWorld);

  // Bare ankle & contoured instep/toes
  ctx.fillStyle = skinBase;
  ctx.strokeStyle = '#4A271B';
  ctx.lineWidth = 0.95;
  ctx.beginPath();
  ctx.moveTo(-3.4, -1.0);
  ctx.lineTo(3.2, -1.0);
  ctx.bezierCurveTo(5.6, 2.2, 8.6, 3.8, 10.2, 5.2);
  ctx.quadraticCurveTo(10.8, 7.2, 8.8, 7.8);
  ctx.lineTo(-4.8, 7.8);
  ctx.quadraticCurveTo(-5.8, 4.4, -3.4, -1.0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Heel/instep subtle shadow
  ctx.fillStyle = skinShade;
  ctx.beginPath();
  ctx.ellipse(-1.4, 5.6, 2.6, 1.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dark rubber outsole with contoured arch (bottom at y = 10.0)
  ctx.fillStyle = soleBase;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.05;
  ctx.beginPath();
  ctx.moveTo(-5.8, 7.1);
  ctx.quadraticCurveTo(2.0, 7.3, 10.5, 6.8);
  ctx.quadraticCurveTo(11.3, 9.6, 9.4, 10.0);
  ctx.lineTo(-4.8, 10.0);
  ctx.quadraticCurveTo(-6.2, 9.5, -5.8, 7.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Midsole grey bevel
  ctx.fillStyle = isFar ? '#2B3648' : '#45546B';
  ctx.beginPath();
  ctx.roundRect(-5.0, 6.9, 15.0, 1.05, 0.5);
  ctx.fill();

  // Navy 2-strap athletic sandal upper
  ctx.fillStyle = strapMain;
  ctx.strokeStyle = '#13233F';
  ctx.lineWidth = 0.85;
  // Front toe strap
  ctx.beginPath();
  ctx.moveTo(2.6, 2.3);
  ctx.lineTo(5.8, 2.9);
  ctx.lineTo(7.4, 7.1);
  ctx.lineTo(3.8, 7.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Ankle/heel strap
  ctx.beginPath();
  ctx.moveTo(-4.5, 1.8);
  ctx.lineTo(0.9, 2.7);
  ctx.lineTo(1.8, 7.1);
  ctx.lineTo(-5.1, 7.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (!isFar) {
    ctx.strokeStyle = strapHi;
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(3.2, 3.4);
    ctx.lineTo(5.3, 3.7);
    ctx.moveTo(-3.4, 2.8);
    ctx.lineTo(0.2, 3.4);
    ctx.stroke();
  }

  ctx.restore();
  ctx.restore();
}

function drawSideProfileArm(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  shoulderA: number,
  elbowRelA: number,
  isFar: boolean,
  heldAction?: {
    kind: PlayerActionKind;
    wristAngle: number;
    pose: ActionPose;
    params: FarmerDrawParams;
  }
) {
  const upperL = 11.4;
  const foreL = 10.6;
  const sleeveBase = isFar ? '#D8E0EB' : '#F4F7FB';
  const sleeveShade = isFar ? '#B8C4D4' : '#CFD9E6';
  const skinBase = isFar ? '#CE875D' : '#F2AE83';
  const skinShade = isFar ? '#B16D47' : '#D68B60';

  const foreWorld = shoulderA + elbowRelA;
  const ex = sx - Math.sin(shoulderA) * upperL;
  const ey = sy + Math.cos(shoulderA) * upperL;
  const hx = ex - Math.sin(foreWorld) * foreL;
  const hy = ey + Math.cos(foreWorld) * foreL;

  const fnUx = Math.cos(shoulderA);
  const fnUy = Math.sin(shoulderA);
  const fnFx = Math.cos(foreWorld);
  const fnFy = Math.sin(foreWorld);
  const enxRaw = fnUx + fnFx;
  const enyRaw = fnUy + fnFy;
  const enLen = Math.hypot(enxRaw, enyRaw) || 1;
  const fnEx = enxRaw / enLen;
  const fnEy = enyRaw / enLen;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 1. Continuous anatomical bare arm (bicep -> elbow -> tapered forearm, zero pill seam!)
  ctx.fillStyle = skinBase;
  ctx.strokeStyle = '#4A271B';
  ctx.lineWidth = 0.98;
  ctx.beginPath();
  ctx.moveTo(sx - fnUx * 3.1, sy - fnUy * 3.1 + 3.0);
  ctx.quadraticCurveTo(sx, sy + 0.5, sx + fnUx * 3.1, sy + fnUy * 3.1 + 3.0);
  ctx.quadraticCurveTo(
    (sx + ex) * 0.5 + fnUx * 3.2,
    (sy + ey) * 0.5 + fnUy * 3.2,
    ex + fnEx * 2.9,
    ey + fnEy * 2.9
  );
  ctx.quadraticCurveTo(
    (ex + hx) * 0.5 + fnFx * 2.8,
    (ey + hy) * 0.5 + fnFy * 2.8,
    hx + fnFx * 2.3,
    hy + fnFy * 2.3
  );
  ctx.lineTo(hx - fnFx * 2.3, hy - fnFy * 2.3);
  ctx.quadraticCurveTo(
    (ex + hx) * 0.5 - fnFx * 2.6,
    (ey + hy) * 0.5 - fnFy * 2.6,
    ex - fnEx * 2.7,
    ey - fnEy * 2.7
  );
  ctx.quadraticCurveTo(
    (sx + ex) * 0.5 - fnUx * 3.0,
    (sy + ey) * 0.5 - fnUy * 3.0,
    sx - fnUx * 3.1,
    sy - fnUy * 3.1 + 3.0
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (!isFar) {
    ctx.strokeStyle = skinShade;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(sx - fnUx * 1.9, sy - fnUy * 1.9 + 5.5);
    ctx.quadraticCurveTo(ex - fnEx * 1.6, ey - fnEy * 1.6, hx - fnFx * 1.3, hy - fnFy * 1.3 - 1.5);
    ctx.stroke();
  }

  // 2. White short sleeve anchored at shoulder (only subtle cuff follow ~35% of shoulderA!)
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(shoulderA * 0.36);
  ctx.fillStyle = sleeveBase;
  ctx.strokeStyle = '#36404F';
  ctx.lineWidth = 1.05;
  ctx.beginPath();
  ctx.moveTo(-4.6, -1.6);
  ctx.quadraticCurveTo(0, -4.1, 4.6, -1.6);
  ctx.lineTo(5.2, 6.2);
  ctx.quadraticCurveTo(0, 7.1, -5.0, 6.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = sleeveShade;
  ctx.beginPath();
  ctx.roundRect(-4.3, 4.3, 8.6, 1.5, 0.75);
  ctx.fill();
  ctx.restore();

  // 3. Hand / Fist + Held Tool
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(foreWorld);
  ctx.fillStyle = skinBase;
  ctx.strokeStyle = '#4A271B';
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.roundRect(-3.1, -0.8, 6.4, 6.0, 2.6);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#9C5B39';
  ctx.lineWidth = 0.85;
  ctx.beginPath();
  ctx.moveTo(-1.0, 2.7);
  ctx.lineTo(2.2, 2.7);
  ctx.stroke();

  if (heldAction) {
    ctx.save();
    ctx.translate(0.5, 2.2);
    ctx.scale(1.42, 1.42);
    drawHeldToolAtHand(ctx, heldAction.kind, heldAction.wristAngle, heldAction.pose, heldAction.params);
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}

function drawMatchedSideCharacter(
  ctx: CanvasRenderingContext2D,
  params: FarmerDrawParams,
  pose: ActionPose,
  phase: number,
  idleBreath: number,
  isBlinking: boolean
) {
  const { facingDir, isMoving, actionKind, actionProgress } = params;
  const isActing = actionKind !== 'NONE' && actionProgress > 0;

  if (facingDir === 'LEFT') {
    ctx.scale(-1, 1);
  }

  // Proportions matched 1:1 to uploaded sprite (96px = 2 * TILE_SIZE total standing height):
  // Legs = 39.0px | Torso = 24.5px | Head + Spiky Hair = 32.5px -> 96.0px total!
  const thighL = 15.5;
  const shinL = 13.5;
  const ankleToSole = 10.0;

  const solveSideLeg = (legPhase: number): SideLegKinematics => {
    if (!isMoving && !isActing) {
      return { hipA: 0, kneeRelA: 0, ankleRelA: 0, maxDropY: thighL + shinL + ankleToSole };
    }
    if (isActing) {
      const spread = pose.stanceSpread * 0.08;
      const a = legPhase === phase ? -spread : spread;
      return {
        hipA: a,
        kneeRelA: Math.max(0, -a * 0.3),
        ankleRelA: -a * 0.7,
        maxDropY: thighL * Math.cos(a) + shinL * Math.cos(a * 0.7) + ankleToSole,
      };
    }

    const s = Math.sin(legPhase); // +1 heel strike (+X), -1 toe-off (-X)
    const c = Math.cos(legPhase); // +1 mid-swing (foot lifts), -1 mid-stance (vertical support)
    const swing = Math.pow(Math.max(0, c), 0.78);
    const heelStrikeT = Math.max(0, s) * (1 - swing);
    const toeOffT = Math.max(0, -s) * (1 - swing);

    const hipA = -s * 0.35 - swing * 0.14;
    const kneeRelA = 0.04 + swing * 0.60 + toeOffT * 0.16;
    const shinWorld = hipA + kneeRelA;
    // Heel-to-toe ankle rollover: toes up at heel strike, flat at mid-stance, heel lifts at toe-off
    const desiredFootWorld = -heelStrikeT * 0.19 + toeOffT * 0.33 - swing * 0.13;
    const ankleRelA = desiredFootWorld - shinWorld;

    const kx = -Math.sin(hipA) * thighL;
    const ky = Math.cos(hipA) * thighL;
    const ax = kx - Math.sin(shinWorld) * shinL;
    const ay = ky + Math.cos(shinWorld) * shinL;
    const cosF = Math.cos(desiredFootWorld);
    const sinF = Math.sin(desiredFootWorld);
    const heelY = ay + (-5.6) * sinF + ankleToSole * cosF;
    const toeY = ay + 10.2 * sinF + ankleToSole * cosF;

    return {
      hipA,
      kneeRelA,
      ankleRelA,
      maxDropY: Math.max(heelY, toeY),
    };
  };

  const farLeg = solveSideLeg(phase + Math.PI);
  const nearLeg = solveSideLeg(phase);

  // Lock stance sole strictly to ground plane y = 0 (zero floating, zero sinking!)
  const stanceDrop = Math.max(farLeg.maxDropY, nearLeg.maxDropY);
  const squatPx = isActing ? pose.squatY * 1.35 : 0;
  const hipY = -stanceDrop + squatPx;

  // Counter-swinging arms with natural elbow flexion
  let farArmA = idleBreath * 0.02;
  let farElbowA = -0.14;
  let nearArmA = -idleBreath * 0.02;
  let nearElbowA = -0.14;

  const sidePassiveWeapon: PlayerActionKind | null =
    params.selectedItemId === 'weapon_sword'
      ? 'SWORD'
      : params.selectedItemId === 'weapon_rifle'
      ? 'RIFLE'
      : null;

  if (isActing) {
    nearArmA = pose.armForward * 0.72 - 0.18;
    nearElbowA = -0.25;
    farArmA = 0.24;
    farElbowA = -0.22;
  } else if (isMoving) {
    const farAs = Math.sin(phase); // opposite farLeg (phase + PI)
    const nearAs = Math.sin(phase + Math.PI); // opposite nearLeg (phase)
    farArmA = -farAs * 0.38;
    farElbowA = -(0.12 + Math.max(0, farAs) * 0.34);
    nearArmA = sidePassiveWeapon === 'RIFLE' ? -0.55 : -nearAs * 0.38;
    nearElbowA = sidePassiveWeapon === 'RIFLE' ? -0.45 : -(0.12 + Math.max(0, nearAs) * 0.34);
  } else if (sidePassiveWeapon === 'RIFLE') {
    nearArmA = -0.48;
    nearElbowA = -0.5;
  }

  const torsoLean = isActing
    ? pose.torsoLean * 0.55
    : isMoving
    ? 0.055 + (1 - Math.abs(Math.sin(phase))) * 0.015
    : idleBreath * 0.008;

  // 1. Far arm behind torso
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(torsoLean);
  drawSideProfileArm(ctx, 1.4, -20.5, farArmA, farElbowA, true);
  ctx.restore();

  // 2. Far leg then Near leg (subtle 2.5D depth separation)
  drawSideProfileLeg(ctx, 1.3, hipY, thighL, shinL, farLeg, true);
  drawSideProfileLeg(ctx, -1.0, hipY, thighL, shinL, nearLeg, false);

  // 3. Torso (White Crewneck T-Shirt + Pelvis Jeans Blend)
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(torsoLean);
  const breathY = !isMoving && !isActing ? -idleBreath * 0.45 : 0;
  ctx.translate(0, breathY);

  // Jeans pelvis connecting cleanly to legs
  ctx.fillStyle = '#1C1F27';
  ctx.strokeStyle = '#0E1015';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.roundRect(-8.2, -3.5, 16.4, 7.6, 3.6);
  ctx.fill();
  ctx.stroke();

  // White Crewneck T-Shirt
  ctx.fillStyle = '#F4F7FB';
  ctx.strokeStyle = '#36404F';
  ctx.lineWidth = 1.15;
  ctx.beginPath();
  ctx.moveTo(-8.8, -2.0);
  ctx.quadraticCurveTo(-9.4, -14.2, -7.0, -23.5);
  ctx.lineTo(6.8, -23.5);
  ctx.quadraticCurveTo(9.2, -14.2, 8.6, -2.0);
  ctx.quadraticCurveTo(0, 0.5, -8.8, -2.0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Soft cel shadow along back & shirt hem (matches uploaded sprite #D5DFEC folds)
  ctx.fillStyle = '#D5DFEC';
  ctx.beginPath();
  ctx.moveTo(-8.2, -2.2);
  ctx.quadraticCurveTo(-8.6, -13.0, -6.6, -22.5);
  ctx.lineTo(-2.6, -22.5);
  ctx.quadraticCurveTo(-4.0, -12.0, -3.2, -2.2);
  ctx.closePath();
  ctx.fill();

  // Subtle hem fold curve
  ctx.strokeStyle = '#B8C4D4';
  ctx.lineWidth = 0.85;
  ctx.beginPath();
  ctx.moveTo(-7.2, -3.6);
  ctx.quadraticCurveTo(0, -1.8, 7.2, -3.6);
  ctx.stroke();

  // 4. Neck + 1:1 Cel-Shaded 3/4-Profile Head & Swept Charcoal Hair (Crown reaches exact y = -96.0!)
  ctx.save();
  ctx.translate(0.4, -24.0);
  ctx.rotate(isActing ? pose.headTilt * 0.4 : isMoving ? -torsoLean * 0.45 : 0);

  // Neck
  ctx.fillStyle = '#DDA076';
  ctx.strokeStyle = '#4A271B';
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.roundRect(-3.5, -4.5, 7.0, 6.4, 2.0);
  ctx.fill();
  ctx.stroke();

  // Crewneck collar rim
  ctx.fillStyle = '#E8EEF5';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 0.95;
  ctx.beginPath();
  ctx.ellipse(0.4, 0.5, 5.4, 1.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Smooth S-curved back hair locks behind ear/nape
  ctx.fillStyle = '#1E242E';
  ctx.strokeStyle = '#0F1218';
  ctx.lineWidth = 1.1;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-6.5, -17.5);
  ctx.bezierCurveTo(-13.8, -16.5, -15.6, -11.5, -14.8, -8.5);
  ctx.quadraticCurveTo(-12.2, -8.8, -11.2, -9.8);
  ctx.quadraticCurveTo(-13.4, -6.2, -12.6, -4.4);
  ctx.quadraticCurveTo(-9.6, -5.0, -8.6, -6.2);
  ctx.quadraticCurveTo(-9.2, -3.2, -7.8, -2.0);
  ctx.quadraticCurveTo(-4.8, -2.8, -4.2, -4.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Smooth cel-shaded face silhouette (warm tan skin matching uploaded sprite)
  ctx.fillStyle = '#F2AF84';
  ctx.strokeStyle = '#4A271B';
  ctx.lineWidth = 1.05;
  ctx.beginPath();
  ctx.moveTo(-7.2, -18.5);
  ctx.bezierCurveTo(-8.8, -9.2, -5.2, -2.8, 2.4, -2.5);
  ctx.bezierCurveTo(9.2, -2.3, 11.1, -8.0, 10.9, -14.8);
  ctx.bezierCurveTo(10.7, -21.2, 5.8, -25.8, -0.5, -25.8);
  ctx.bezierCurveTo(-5.8, -25.8, -7.6, -22.2, -7.2, -18.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Soft cel chin/jaw shadow & hair cast shadow on forehead
  ctx.fillStyle = 'rgba(186, 108, 68, 0.28)';
  ctx.beginPath();
  ctx.ellipse(1.4, -4.3, 5.8, 1.6, -0.08, 0, Math.PI);
  ctx.fill();

  // Ear (helix + inner crease)
  ctx.fillStyle = '#E8A074';
  ctx.strokeStyle = '#4A271B';
  ctx.lineWidth = 0.95;
  ctx.beginPath();
  ctx.ellipse(-5.8, -11.0, 2.1, 3.0, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Subtle nose & relaxed smirk matching uploaded sprite
  ctx.strokeStyle = '#7C3F28';
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.moveTo(9.4, -10.8);
  ctx.quadraticCurveTo(11.1, -9.4, 9.2, -8.6);
  ctx.stroke();

  ctx.strokeStyle = '#6B3423';
  ctx.lineWidth = 0.98;
  ctx.beginPath();
  ctx.moveTo(4.0, -6.0);
  ctx.quadraticCurveTo(7.1, -5.5, 8.6, -6.6);
  ctx.stroke();

  // Expressive proportional anime eye & bold black eyebrow
  if (isBlinking) {
    ctx.strokeStyle = '#181C24';
    ctx.lineWidth = 1.45;
    ctx.beginPath();
    ctx.moveTo(3.4, -12.8);
    ctx.quadraticCurveTo(6.0, -11.9, 8.5, -12.9);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(5.9, -13.0, 2.6, 2.75, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1B2028';
    ctx.beginPath();
    ctx.ellipse(6.4, -13.0, 1.8, 2.25, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(6.9, -13.8, 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#13161D';
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.arc(5.9, -12.8, 2.7, Math.PI * 1.1, Math.PI * 1.94);
    ctx.stroke();
  }

  // Bold tapered black eyebrow
  ctx.fillStyle = '#141820';
  ctx.beginPath();
  ctx.moveTo(2.4, -16.8);
  ctx.quadraticCurveTo(6.1, -18.5, 9.3, -16.8);
  ctx.quadraticCurveTo(6.2, -17.3, 2.4, -16.2);
  ctx.closePath();
  ctx.fill();

  // Smooth Swept Charcoal Hair Crown & Parted Bangs (Top cowlick at local -33.0 => exact world y = -96.0!)
  ctx.fillStyle = '#1E242E';
  ctx.strokeStyle = '#0F1218';
  ctx.lineWidth = 1.1;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-8.2, -15.2);
  // Curved sideburn in front of ear
  ctx.quadraticCurveTo(-5.8, -12.4, -4.6, -9.8);
  ctx.quadraticCurveTo(-4.4, -13.4, -3.6, -15.8);
  // Swept curved bangs framing forehead & brow
  ctx.quadraticCurveTo(-1.2, -17.2, 0.8, -14.2);
  ctx.quadraticCurveTo(2.6, -17.2, 4.4, -18.4);
  ctx.quadraticCurveTo(6.8, -16.6, 8.2, -17.0);
  ctx.quadraticCurveTo(10.6, -17.2, 11.4, -17.8);
  // Outer sweeping front hair lock
  ctx.bezierCurveTo(12.2, -21.8, 10.2, -24.5, 9.6, -25.2);
  ctx.quadraticCurveTo(12.0, -25.8, 12.6, -26.8);
  ctx.bezierCurveTo(8.6, -29.8, 2.8, -30.2, -0.8, -29.8);
  // Top cowlick tuft reaching exact y = -33.0 (world -96.0)
  ctx.quadraticCurveTo(-2.0, -32.2, -3.2, -33.0);
  ctx.quadraticCurveTo(-4.0, -31.2, -4.4, -29.8);
  ctx.bezierCurveTo(-10.2, -29.4, -13.2, -24.8, -13.4, -23.8);
  ctx.quadraticCurveTo(-11.4, -23.0, -10.4, -22.8);
  ctx.quadraticCurveTo(-12.6, -20.5, -13.0, -19.2);
  ctx.quadraticCurveTo(-10.2, -17.6, -8.2, -15.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Smooth curved specular hair highlight (no zig-zag!)
  ctx.strokeStyle = 'rgba(84, 100, 126, 0.48)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-7.2, -23.2);
  ctx.quadraticCurveTo(0.2, -27.2, 7.6, -23.2);
  ctx.stroke();

  ctx.restore(); // end head

  // 5. Near arm (white short sleeve + tan forearm + fist + tool/weapon)
  const sideHeld = isActing
    ? { kind: actionKind, wristAngle: pose.wristAngle, pose, params }
    : sidePassiveWeapon
    ? { kind: sidePassiveWeapon, wristAngle: sidePassiveWeapon === 'RIFLE' ? -0.35 : 0.15, pose, params }
    : undefined;

  drawSideProfileArm(ctx, -0.5, -20.5, nearArmA, nearElbowA, false, sideHeld);

  if (isActing && pose.slashAlpha > 0.05 && (actionKind === 'HOE' || actionKind === 'AXE' || actionKind === 'SCYTHE' || actionKind === 'SWORD')) {
    ctx.save();
    ctx.globalAlpha = pose.slashAlpha * 0.72;
    ctx.strokeStyle = actionKind === 'SWORD' ? '#38BDF8' : actionKind === 'SCYTHE' ? '#F8FAFC' : '#FDE047';
    ctx.lineWidth = actionKind === 'SWORD' ? 4.2 : 3.4;
    ctx.beginPath();
    ctx.arc(10, -14, actionKind === 'SWORD' ? 32 : 27, -Math.PI * 0.48, Math.PI * 0.18);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore(); // end torso
}

// ============================================================================
// FRONT & BACK UPLOADED SPRITE RENDERER (DOWN & UP)
// Exact 96px height, zero ankle gap/crash, accurate 3D UP/DOWN limb occlusion!
// ============================================================================
function drawFrontBackSpriteFarmer(
  ctx: CanvasRenderingContext2D,
  rig: FarmerSpriteRig,
  params: FarmerDrawParams,
  pose: ActionPose,
  phase: number,
  idleBreath: number
) {
  const { facingDir, isMoving, actionKind, actionProgress, isBathing, elapsedTime } = params;
  const isActing = actionKind !== 'NONE' && actionProgress > 0;

  // Exact height = 2 farm plot tiles (2 * 48 = 96px), width proportional
  const drawH = TILE_SIZE * 2;
  const drawW = drawH * (rig.width / Math.max(1, rig.height));

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (isBathing) {
    const floatBob = Math.sin(elapsedTime * 2.4) * 1.8;
    const waterY = -20;

    ctx.strokeStyle = 'rgba(224, 242, 254, 0.78)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, waterY, 22 + Math.sin(elapsedTime * 3) * 2.6, 7.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.rect(-drawW, -drawH - 20, drawW * 2, drawH + 20 + waterY);
    ctx.clip();
    ctx.translate(0, 32 + floatBob);
    ctx.drawImage(rig.torsoHead, -drawW * 0.5, -drawH, drawW, drawH);
    ctx.restore();

    ctx.fillStyle = 'rgba(56, 189, 248, 0.54)';
    ctx.beginPath();
    ctx.ellipse(0, waterY, 19, 5.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const isUp = facingDir === 'UP';
  const torsoSprite = isUp ? rig.torsoHeadBack : rig.torsoHead;
  const leftFootSprite = isUp ? rig.leftFootBack : rig.leftFoot;
  const rightFootSprite = isUp ? rig.rightFootBack : rig.rightFoot;
  const squatPx = isActing ? pose.squatY * 1.35 : 0;

  // Gait parameters for DOWN / UP
  let leftLift = 0;
  let rightLift = 0;
  let leftFwd = 0;
  let rightFwd = 0;
  let leftArmFwd = 0;
  let rightArmFwd = 0;
  let weightShiftX = 0;
  let bodyDropY = squatPx;
  let torsoSway = idleBreath * 0.005;

  if (isActing) {
    torsoSway = pose.torsoLean * 0.22;
  } else if (isMoving) {
    const c = Math.cos(phase);
    const s = Math.sin(phase);
    // Swing lift cleanly alternates; opposite stance leg remains firmly grounded at y = 0
    leftLift = Math.pow(Math.max(0, c), 0.75);
    rightLift = Math.pow(Math.max(0, -c), 0.75);
    leftFwd = s;
    rightFwd = -s;
    // Arms swing opposite to legs
    leftArmFwd = -s;
    rightArmFwd = s;
    // Lateral CoM shifts slightly over stance foot + natural double-support pelvic dip
    weightShiftX = c * 1.15;
    bodyDropY = (1 - Math.abs(c)) * 1.35;
    torsoSway = s * 0.02;
  }

  // Accurate 3D Z-order occlusion:
  // - Facing DOWN (+Z camera): forward-swinging arm (fwd >= 0) is closest to camera (in front of torso)
  // - Facing UP (-Z into screen): backward-swinging arm (fwd < 0) is closest to camera (in front of back torso)
  const passiveWeapon: PlayerActionKind | null =
    params.selectedItemId === 'weapon_sword'
      ? 'SWORD'
      : params.selectedItemId === 'weapon_rifle'
      ? 'RIFLE'
      : null;

  const leftArmInFront = isActing ? !isUp : isUp ? leftArmFwd < 0 : leftArmFwd >= 0;
  const rightArmInFront = isActing
    ? !isUp
    : isUp
    ? rightArmFwd < 0
    : rightArmFwd >= 0 || Boolean(passiveWeapon);

  // Perspective-consistent arm transforms locked strictly inside white short sleeves (ZERO downward detachment!)
  const getArmTransform = (fwd: number, sideSign: number, isPrimaryActingArm: boolean) => {
    if (isActing && isPrimaryActingArm) {
      return {
        rot: pose.armForward * 0.65 - 0.12,
        offsetX: 0,
        offsetY: 0,
        scaleX: 1,
        scaleY: 1,
      };
    }
    if (isActing) {
      return { rot: sideSign * 0.08, offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 };
    }
    if (!isMoving) {
      return {
        rot: sideSign * idleBreath * 0.012,
        offsetX: 0,
        offsetY: -idleBreath * 0.35,
        scaleX: 1,
        scaleY: 1,
      };
    }
    const f = Math.max(0, fwd);
    const b = Math.max(0, -fwd);
    // Perspective foreshortening: upper arm never drops below cuff (offsetY <= 0), bends subtly in depth
    return {
      rot: -sideSign * (f * 0.075 - b * 0.11),
      offsetX: -sideSign * (f * 0.45 + b * 0.75),
      offsetY: -f * 0.45,
      scaleX: 1 + f * 0.025 - b * 0.03,
      scaleY: 1 - f * 0.08 - b * 0.11,
    };
  };

  const lArmTx = getArmTransform(leftArmFwd, -1, false);
  const rArmTx = getArmTransform(rightArmFwd, 1, true);

  ctx.translate(weightShiftX, bodyDropY);

  const hipAnchorY = -drawH * (1 - rig.hipY);
  const legLenPx = (rig.ankleY - rig.hipY) * drawH;

  // 1. Far/occluded arms behind torso
  ctx.save();
  ctx.translate(0, hipAnchorY);
  ctx.rotate(torsoSway);
  ctx.translate(0, -hipAnchorY);
  if (!leftArmInFront) {
    drawRigPart(
      ctx,
      rig.leftArm,
      drawW,
      drawH,
      rig.leftShoulderX,
      rig.shoulderY,
      lArmTx.rot,
      lArmTx.offsetX,
      lArmTx.offsetY,
      lArmTx.scaleX,
      lArmTx.scaleY
    );
  }
  if (!rightArmInFront) {
    drawRigPart(
      ctx,
      rig.rightArm,
      drawW,
      drawH,
      rig.rightShoulderX,
      rig.shoulderY,
      rArmTx.rot,
      rArmTx.offsetX,
      rArmTx.offsetY,
      rArmTx.scaleX,
      rArmTx.scaleY
    );
  }
  ctx.restore();

  // 2. Legs: Foot transforms track the EXACT ankle position of scaled upperPart -> zero gap, zero ankle collision!
  const drawFrontLeg = (
    upperPart: HTMLCanvasElement,
    footPart: HTMLCanvasElement,
    hipX: number,
    lift: number,
    fwd: number,
    sideSign: number
  ) => {
    const legCompress = 1 - lift * 0.13;
    const hipStepRot = sideSign * lift * 0.028;
    const pushDownY = Math.max(0, -fwd) * (1 - lift) * 0.55;
    // Exact ankle coordinates after upperPart scaleY + hipStepRot around (hipX, rig.hipY)
    const exactAnkleDeltaY = legLenPx * (legCompress - 1) + pushDownY;
    const exactAnkleShiftX = -Math.sin(hipStepRot) * legLenPx * legCompress;
    const footScale = 1 + fwd * 0.025;

    drawRigPart(ctx, upperPart, drawW, drawH, hipX, rig.hipY, hipStepRot, 0, pushDownY * 0.35, 1, legCompress);
    drawRigPart(
      ctx,
      footPart,
      drawW,
      drawH,
      hipX,
      rig.ankleY,
      hipStepRot * 0.4,
      exactAnkleShiftX,
      exactAnkleDeltaY,
      footScale,
      1
    );
  };

  // Accurate depth sort: forward-stepping leg is in front when facing DOWN, behind when facing UP
  const drawLeftFirst = isUp ? leftLift >= rightLift : leftLift <= rightLift;
  if (drawLeftFirst) {
    drawFrontLeg(rig.leftUpperLeg, leftFootSprite, rig.leftHipX, leftLift, leftFwd, -1);
    drawFrontLeg(rig.rightUpperLeg, rightFootSprite, rig.rightHipX, rightLift, rightFwd, 1);
  } else {
    drawFrontLeg(rig.rightUpperLeg, rightFootSprite, rig.rightHipX, rightLift, rightFwd, 1);
    drawFrontLeg(rig.leftUpperLeg, leftFootSprite, rig.leftHipX, leftLift, leftFwd, -1);
  }

  // 3. Intact Torso + Head + Sleeves + Front Arms + Held Tool/Weapon
  ctx.save();
  ctx.translate(0, hipAnchorY);
  ctx.rotate(torsoSway);
  ctx.translate(0, -hipAnchorY);

  const idleTorsoY = !isMoving && !isActing ? -idleBreath * 0.35 : 0;
  drawRigPart(ctx, torsoSprite, drawW, drawH, 0.5, rig.hipY, 0, 0, idleTorsoY, 1, 1);

  if (leftArmInFront) {
    drawRigPart(
      ctx,
      rig.leftArm,
      drawW,
      drawH,
      rig.leftShoulderX,
      rig.shoulderY,
      lArmTx.rot,
      lArmTx.offsetX,
      lArmTx.offsetY,
      lArmTx.scaleX,
      lArmTx.scaleY
    );
  }
  if (rightArmInFront) {
    drawRigPart(
      ctx,
      rig.rightArm,
      drawW,
      drawH,
      rig.rightShoulderX,
      rig.shoulderY,
      rArmTx.rot,
      rArmTx.offsetX,
      rArmTx.offsetY,
      rArmTx.scaleX,
      rArmTx.scaleY
    );
  }

  const activeOrPassiveKind = isActing ? actionKind : passiveWeapon;
  if (activeOrPassiveKind) {
    const sx = -drawW * 0.5 + rig.rightShoulderX * drawW + rArmTx.offsetX;
    const sy = -drawH + rig.shoulderY * drawH + rArmTx.offsetY;
    const hx = -drawW * 0.5 + rig.rightHandX * drawW + rArmTx.offsetX;
    const hy = -drawH + rig.handY * drawH + rArmTx.offsetY;
    const dx = (hx - sx) * rArmTx.scaleX;
    const dy = (hy - sy) * rArmTx.scaleY;
    const cosA = Math.cos(rArmTx.rot);
    const sinA = Math.sin(rArmTx.rot);
    const rotHx = sx + dx * cosA - dy * sinA;
    const rotHy = sy + dx * sinA + dy * cosA;
    const weaponWrist = isActing
      ? rArmTx.rot + pose.wristAngle
      : activeOrPassiveKind === 'RIFLE'
      ? -0.35
      : 0.1;

    ctx.save();
    ctx.translate(rotHx, rotHy);
    ctx.scale(1.45, 1.45);
    drawHeldToolAtHand(ctx, activeOrPassiveKind, weaponWrist, pose, params);
    ctx.restore();

    if (isActing && pose.slashAlpha > 0.05 && (actionKind === 'HOE' || actionKind === 'AXE' || actionKind === 'SCYTHE' || actionKind === 'SWORD')) {
      ctx.save();
      ctx.globalAlpha = pose.slashAlpha * 0.72;
      ctx.strokeStyle = actionKind === 'SWORD' ? '#38BDF8' : actionKind === 'SCYTHE' ? '#F8FAFC' : '#FDE047';
      ctx.lineWidth = actionKind === 'SWORD' ? 4.2 : 3.4;
      ctx.beginPath();
      ctx.arc(10, -drawH * 0.45, actionKind === 'SWORD' ? 32 : 27, -Math.PI * 0.48, Math.PI * 0.18);
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.restore();
  ctx.restore();
}

export function drawFarmerCharacter(ctx: CanvasRenderingContext2D, params: FarmerDrawParams) {
  const {
    x: playerScreenX,
    y: playerScreenY,
    facingDir,
    walkCycle,
    isMoving,
    actionKind,
    actionProgress,
    isBathing,
    elapsedTime,
  } = params;

  const isActing = actionKind !== 'NONE' && actionProgress > 0;
  const pose = computeActionPose(actionKind, actionProgress);

  const phase = isMoving && !isActing ? walkCycle * 9.8 : 0;
  const stride = isMoving && !isActing ? Math.sin(phase) : 0;
  const idleBreath = !isMoving && !isActing ? Math.sin(elapsedTime * 2.2) : 0;

  const blinkMod = elapsedTime % 3.85;
  const isBlinking = blinkMod > 3.71 && !isActing;

  const bob =
    isMoving && !isActing
      ? Math.abs(Math.cos(phase)) * 2.0
      : isActing
      ? 0
      : idleBreath * 0.45;

  const hairBounce = isMoving && !isActing ? -Math.abs(Math.cos(phase)) * 0.55 : idleBreath * 0.14;

  const rig = getCachedFarmerSpriteRig();
  const isSide = facingDir === 'LEFT' || facingDir === 'RIGHT';

  ctx.save();
  ctx.translate(playerScreenX, playerScreenY);

  // 1. Ground-locked contact shadow (tracks lateral weight shift & stride length on ground plane)
  if (!isBathing) {
    const shadowY = params.isWading ? -2.0 : 1.2;
    const shadowShiftX = isMoving && !isActing && !isSide ? Math.cos(phase) * 1.25 : 0;
    const strideStretch = isMoving && !isActing ? Math.abs(stride) * (isSide ? 4.5 : 1.2) : 0;
    const shadowRx = (isSide ? 15.5 : 18.5) + strideStretch + pose.stanceSpread * 1.1;
    const shadowRy = 5.6 + pose.stanceSpread * 0.2;
    const shadowGrad = ctx.createRadialGradient(shadowShiftX, shadowY, 2.5, shadowShiftX, shadowY, shadowRx + 2);
    shadowGrad.addColorStop(0, params.isWading ? 'rgba(8, 47, 73, 0.36)' : 'rgba(0, 0, 0, 0.36)');
    shadowGrad.addColorStop(0.65, params.isWading ? 'rgba(8, 47, 73, 0.16)' : 'rgba(0, 0, 0, 0.16)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(shadowShiftX, shadowY, Math.max(8, shadowRx), shadowRy, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Render character at exact 2 farm tiles height (96px):
  //    - LEFT/RIGHT: 4x supersampled true side-profile rig matched 1:1 to uploaded character
  //    - DOWN/UP: Clean un-squashed uploaded sprite rig with intact sleeves & sandals
  if (isSide && !isBathing) {
    const sideSs = getSideSupersampleBuffer();
    if (sideSs) {
      const { canvas: offscreen, ctx: oCtx } = sideSs;
      oCtx.setTransform(1, 0, 0, 1, 0, 0);
      oCtx.clearRect(0, 0, offscreen.width, offscreen.height);

      oCtx.save();
      oCtx.scale(SIDE_SS_SCALE, SIDE_SS_SCALE);
      oCtx.translate(SIDE_SS_ORIGIN_X, SIDE_SS_ORIGIN_Y);
      oCtx.imageSmoothingEnabled = true;
      oCtx.imageSmoothingQuality = 'high';
      drawMatchedSideCharacter(oCtx, params, pose, phase, idleBreath, isBlinking);
      oCtx.restore();

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(offscreen, -SIDE_SS_ORIGIN_X, -SIDE_SS_ORIGIN_Y, SIDE_SS_W, SIDE_SS_H);
      ctx.restore();
    } else {
      drawMatchedSideCharacter(ctx, params, pose, phase, idleBreath, isBlinking);
    }
  } else if (rig && rig.width > 16 && rig.height > 32) {
    drawFrontBackSpriteFarmer(ctx, rig, params, pose, phase, idleBreath);
  } else {
    // Frame-0 fallback scaled cleanly to 96px while uploaded sprite decodes
    const fallbackScale = (TILE_SIZE * 2) / 60.4;
    ctx.save();
    ctx.scale(fallbackScale, fallbackScale);
    const ss = getSupersampleBuffer();
    if (ss) {
      const { canvas: offscreen, ctx: oCtx } = ss;
      oCtx.setTransform(1, 0, 0, 1, 0, 0);
      oCtx.clearRect(0, 0, offscreen.width, offscreen.height);

      oCtx.save();
      oCtx.scale(SS_SCALE, SS_SCALE);
      oCtx.translate(SS_ORIGIN_X, SS_ORIGIN_Y);
      oCtx.imageSmoothingEnabled = true;
      oCtx.imageSmoothingQuality = 'high';
      renderFarmerRig(oCtx, params, pose, phase, stride, idleBreath, isBlinking, bob * 0.5, hairBounce);
      oCtx.restore();

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(offscreen, -SS_ORIGIN_X, -SS_ORIGIN_Y, SS_W, SS_H);
      ctx.restore();
    } else {
      renderFarmerRig(ctx, params, pose, phase, stride, idleBreath, isBlinking, bob * 0.5, hairBounce);
    }
    ctx.restore();
  }

  // 3. River wading waterline & animated ripples over submerged ankles
  if (params.isWading && !isBathing) {
    const pulse = Math.sin(elapsedTime * 4.5) * 2.2;
    const ripple2 = (elapsedTime * 0.75) % 1;

    const wadeGrad = ctx.createLinearGradient(0, -12, 0, 7);
    wadeGrad.addColorStop(0, 'rgba(56, 189, 248, 0.56)');
    wadeGrad.addColorStop(0.45, 'rgba(14, 165, 233, 0.78)');
    wadeGrad.addColorStop(1, 'rgba(2, 132, 199, 0.86)');
    ctx.fillStyle = wadeGrad;
    ctx.beginPath();
    ctx.ellipse(0, -2.5, 21.0 + pulse * 0.5, 9.0, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(224, 242, 254, 0.88)';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.ellipse(0, -7.5, 18.0 + pulse * 0.55, 5.5, 0, 0.15, Math.PI - 0.15);
    ctx.stroke();

    ctx.strokeStyle = `rgba(224, 242, 254, ${(1 - ripple2) * 0.72})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, -5.0, 20.0 + ripple2 * 11.0, 6.8 + ripple2 * 4.0, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
