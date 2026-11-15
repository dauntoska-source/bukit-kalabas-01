export const FARMER_IMAGE_URL = '/assets/aistudio/image_83e00232_349e8689.jpg';

export interface FarmerSpriteRig {
  full: HTMLCanvasElement;
  torsoHead: HTMLCanvasElement;
  torsoHeadBack: HTMLCanvasElement;
  leftArm: HTMLCanvasElement;
  rightArm: HTMLCanvasElement;
  leftLeg: HTMLCanvasElement;
  rightLeg: HTMLCanvasElement;
  leftUpperLeg: HTMLCanvasElement;
  leftFoot: HTMLCanvasElement;
  leftFootBack: HTMLCanvasElement;
  rightUpperLeg: HTMLCanvasElement;
  rightFoot: HTMLCanvasElement;
  rightFootBack: HTMLCanvasElement;
  width: number;
  height: number;
  leftShoulderX: number;
  rightShoulderX: number;
  shoulderY: number;
  leftHandX: number;
  rightHandX: number;
  handY: number;
  leftHipX: number;
  rightHipX: number;
  hipY: number;
  leftAnkleX: number;
  rightAnkleX: number;
  ankleY: number;
  waistY: number;
  crotchY: number;
  crotchX: number;
  hairColor: string;
  shirtColor: string;
  shirtShadeColor: string;
  pantsColor: string;
}

let cachedFarmerSprite: HTMLCanvasElement | null = null;
let cachedFarmerRig: FarmerSpriteRig | null = null;
let loadingPromise: Promise<HTMLCanvasElement> | null = null;

export function getCachedFarmerSpriteRig(): FarmerSpriteRig | null {
  return cachedFarmerRig;
}

function makePartCanvas(w: number, h: number, data: Uint8ClampedArray): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) {
    const imgData = new ImageData(new Uint8ClampedArray(data), w, h);
    ctx.putImageData(imgData, 0, 0);
  }
  return c;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function buildFarmerSpriteRig(full: HTMLCanvasElement): FarmerSpriteRig {
  const w = full.width;
  const h = full.height;
  const ctx = full.getContext('2d');
  if (!ctx || w < 16 || h < 32) {
    const empty = makePartCanvas(w, h, new Uint8ClampedArray(w * h * 4));
    return {
      full,
      torsoHead: full,
      torsoHeadBack: full,
      leftArm: empty,
      rightArm: empty,
      leftLeg: empty,
      rightLeg: empty,
      leftUpperLeg: empty,
      leftFoot: empty,
      leftFootBack: empty,
      rightUpperLeg: empty,
      rightFoot: empty,
      rightFootBack: empty,
      width: w,
      height: h,
      leftShoulderX: 0.16,
      rightShoulderX: 0.84,
      shoulderY: 0.43,
      leftHandX: 0.1,
      rightHandX: 0.9,
      handY: 0.62,
      leftHipX: 0.35,
      rightHipX: 0.65,
      hipY: 0.58,
      leftAnkleX: 0.25,
      rightAnkleX: 0.75,
      ankleY: 0.89,
      waistY: 0.55,
      crotchY: 0.64,
      crotchX: 0.5,
      hairColor: '#1E242E',
      shirtColor: '#F3F6FA',
      shirtShadeColor: '#CBD5E1',
      pantsColor: '#1C1F26',
    };
  }

  const src = ctx.getImageData(0, 0, w, h).data;
  const isOpaque = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 32;

  // 1. Locate exact crotchY & crotchX
  let crotchY = Math.round(h * 0.64);
  let crotchX = Math.round(w * 0.5);
  const cxStart = Math.round(w * 0.43);
  const cxEnd = Math.round(w * 0.57);
  for (let y = Math.round(h * 0.5); y <= Math.round(h * 0.74); y++) {
    let gapRun = 0;
    let gapMid = crotchX;
    for (let x = cxStart; x <= cxEnd; x++) {
      if (!isOpaque(x, y)) {
        gapRun++;
        gapMid = x - Math.floor(gapRun / 2);
      } else {
        if (gapRun >= 3) break;
        gapRun = 0;
      }
    }
    if (gapRun >= 3) {
      crotchY = y;
      crotchX = gapMid;
      break;
    }
  }

  // 2. Locate exact waistY (white t-shirt hem -> dark jeans transition)
  let waistY = Math.round(crotchY - h * 0.085);
  let seenWhiteShirt = false;
  for (let y = Math.round(h * 0.38); y < crotchY; y++) {
    let lumSum = 0;
    let cnt = 0;
    for (let x = Math.round(w * 0.44); x <= Math.round(w * 0.56); x++) {
      const p = (y * w + x) * 4;
      if (src[p + 3] > 120) {
        lumSum += (src[p] + src[p + 1] + src[p + 2]) / 3;
        cnt++;
      }
    }
    if (cnt > 0) {
      const avgLum = lumSum / cnt;
      if (avgLum > 175) {
        seenWhiteShirt = true;
      } else if (seenWhiteShirt && avgLum < 100) {
        waistY = y;
        break;
      }
    }
  }

  // 3. Locate exact sleeve-cuff Y per column x where white sleeve meets bare tan arm skin (~0.427..0.445*h)
  const isSkinPx = (p: number) => src[p + 3] > 80 && src[p] > 170 && src[p] - src[p + 2] > 28;
  const fallbackLeftCuffY = Math.round(h * 0.432);
  const fallbackRightCuffY = Math.round(h * 0.432);

  const findColumnCuffY = (x: number, fallback: number): number => {
    let seenWhite = false;
    for (let y = Math.round(h * 0.35); y <= Math.round(h * 0.48); y++) {
      const p = (y * w + x) * 4;
      if (src[p + 3] < 60) continue;
      const lum = (src[p] + src[p + 1] + src[p + 2]) / 3;
      if (lum > 180 && Math.max(src[p], src[p + 1], src[p + 2]) - Math.min(src[p], src[p + 1], src[p + 2]) < 26) {
        seenWhite = true;
      } else if (seenWhite && isSkinPx(p)) {
        return y;
      }
    }
    return fallback;
  };

  const leftCuffYByX = new Int32Array(w).fill(fallbackLeftCuffY);
  const rightCuffYByX = new Int32Array(w).fill(fallbackRightCuffY);
  let lastLCuff = fallbackLeftCuffY;
  for (let x = Math.round(w * 0.06); x <= Math.round(w * 0.27); x++) {
    const c = findColumnCuffY(x, -1);
    if (c > 0) lastLCuff = c;
    leftCuffYByX[x] = lastLCuff;
  }
  let lastRCuff = fallbackRightCuffY;
  for (let x = Math.round(w * 0.94); x >= Math.round(w * 0.73); x--) {
    const c = findColumnCuffY(x, -1);
    if (c > 0) lastRCuff = c;
    rightCuffYByX[x] = lastRCuff;
  }

  const leftCuffY = leftCuffYByX[Math.round(w * 0.14)];
  const rightCuffY = rightCuffYByX[Math.round(w * 0.86)];

  // 4. Locate transparent gaps separating arms from torso/legs below sleeve cuffs
  const findArmGapOuterX = (y: number, side: 'LEFT' | 'RIGHT'): number | null => {
    const step = side === 'LEFT' ? -1 : 1;
    let inBody = false;
    let gapStart: number | null = null;
    for (let x = crotchX; x >= 0 && x < w; x += step) {
      const op = isOpaque(x, y);
      if (op) {
        if (gapStart !== null) {
          return Math.round((gapStart + x) / 2);
        }
        inBody = true;
      } else if (inBody && gapStart === null) {
        gapStart = x;
      }
    }
    return null;
  };

  const leftSplitX = new Int32Array(h);
  const rightSplitX = new Int32Array(h);
  let prevLeftGap = Math.round(w * 0.22);
  let prevRightGap = Math.round(w * 0.78);
  const initL = findArmGapOuterX(Math.round(h * 0.48), 'LEFT');
  if (initL !== null) prevLeftGap = initL;
  const initR = findArmGapOuterX(Math.round(h * 0.48), 'RIGHT');
  if (initR !== null) prevRightGap = initR;

  for (let y = 0; y < h; y++) {
    const lGap = findArmGapOuterX(y, 'LEFT');
    if (lGap !== null) prevLeftGap = lGap;
    leftSplitX[y] = y >= Math.round(h * 0.415) && y <= Math.round(h * 0.72) ? prevLeftGap : -1;

    const rGap = findArmGapOuterX(y, 'RIGHT');
    if (rGap !== null) prevRightGap = rGap;
    rightSplitX[y] = y >= Math.round(h * 0.415) && y <= Math.round(h * 0.72) ? prevRightGap : w;
  }

  // 5. Locate ankle cuff Y where black jeans meet tan ankle/navy sandal (~0.892*h)
  let ankleY = Math.round(h * 0.892);
  for (let y = Math.round(h * 0.83); y <= Math.round(h * 0.95); y++) {
    let footPx = 0;
    for (let x = Math.round(w * 0.16); x <= Math.round(w * 0.37); x++) {
      if (isOpaque(x, y)) {
        const p = (y * w + x) * 4;
        const r = src[p];
        const b = src[p + 2];
        if ((r > 150 && r - b > 24) || b > r + 18) footPx++;
      }
    }
    if (footPx > Math.max(8, w * 0.025)) {
      ankleY = y;
      break;
    }
  }

  const sampleColor = (x0: number, y0: number, x1: number, y1: number, fallback: string) => {
    let r = 0;
    let g = 0;
    let b = 0;
    let c = 0;
    for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y += 2) {
      for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x += 2) {
        const p = (y * w + x) * 4;
        if (src[p + 3] > 200) {
          r += src[p];
          g += src[p + 1];
          b += src[p + 2];
          c++;
        }
      }
    }
    return c > 0 ? rgbToHex(r / c, g / c, b / c) : fallback;
  };

  const hairColor = sampleColor(
    Math.round(w * 0.42),
    Math.round(h * 0.03),
    Math.round(w * 0.58),
    Math.round(h * 0.09),
    '#1E242E'
  );
  const shirtColor = sampleColor(
    Math.round(w * 0.42),
    Math.round(waistY - h * 0.14),
    Math.round(w * 0.58),
    Math.round(waistY - h * 0.04),
    '#F3F6FA'
  );
  const pantsColor = sampleColor(
    Math.round(w * 0.34),
    Math.round(crotchY + h * 0.02),
    Math.round(w * 0.44),
    Math.round(crotchY + h * 0.12),
    '#1C1F26'
  );

  // Partition pixels cleanly:
  // - torsoHead keeps ENTIRE head, white t-shirt, AND BOTH short sleeves intact!
  // - leftArm/rightArm contain ONLY the bare arms emerging below the sloped sleeve cuffs!
  const torsoData = new Uint8ClampedArray(w * h * 4);
  const leftArmData = new Uint8ClampedArray(w * h * 4);
  const rightArmData = new Uint8ClampedArray(w * h * 4);
  const leftLegData = new Uint8ClampedArray(w * h * 4);
  const rightLegData = new Uint8ClampedArray(w * h * 4);
  const leftUpperLegData = new Uint8ClampedArray(w * h * 4);
  const leftFootData = new Uint8ClampedArray(w * h * 4);
  const rightUpperLegData = new Uint8ClampedArray(w * h * 4);
  const rightFootData = new Uint8ClampedArray(w * h * 4);

  const legTopY = waistY + 1;
  const torsoBottomY = waistY + 4;

  for (let y = 0; y < h; y++) {
    const lSplit = leftSplitX[y];
    const rSplit = rightSplitX[y];
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const a = src[p + 3];
      if (a === 0) continue;

      const copyTo = (dst: Uint8ClampedArray) => {
        dst[p] = src[p];
        dst[p + 1] = src[p + 1];
        dst[p + 2] = src[p + 2];
        dst[p + 3] = a;
      };

      const isBareSkinBelowLeftCuff = lSplit >= 0 && x <= lSplit && y >= leftCuffYByX[x];
      const isBareSkinBelowRightCuff = rSplit < w && x >= rSplit && y >= rightCuffYByX[x];

      if (isBareSkinBelowLeftCuff && y <= Math.round(h * 0.72)) {
        copyTo(leftArmData);
      } else if (isBareSkinBelowRightCuff && y <= Math.round(h * 0.72)) {
        copyTo(rightArmData);
      } else if (y < legTopY) {
        copyTo(torsoData);
      } else {
        if (y <= torsoBottomY) {
          copyTo(torsoData);
        }
        if (x < crotchX) {
          copyTo(leftLegData);
          if (y <= ankleY + 3) copyTo(leftUpperLegData);
          if (y >= ankleY - 2) copyTo(leftFootData);
        } else {
          copyTo(rightLegData);
          if (y <= ankleY + 3) copyTo(rightUpperLegData);
          if (y >= ankleY - 2) copyTo(rightFootData);
        }
      }
    }
  }

  const measureRowCenter = (limbData: Uint8ClampedArray, rowY: number, fallbackX: number) => {
    let minX = w;
    let maxX = -1;
    const y0 = Math.max(0, rowY - 3);
    const y1 = Math.min(h - 1, rowY + 3);
    for (let y = y0; y <= y1; y++) {
      for (let x = 0; x < w; x++) {
        if (limbData[(y * w + x) * 4 + 3] > 60) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }
    if (maxX < minX) return { x: fallbackX, r: Math.max(4, Math.round(w * 0.05)) };
    return { x: (minX + maxX) * 0.5, r: Math.max(4, (maxX - minX) * 0.5 + 1) };
  };

  const leftCuffCenter = measureRowCenter(leftArmData, leftCuffY + 6, Math.round(w * 0.14));
  const rightCuffCenter = measureRowCenter(rightArmData, rightCuffY + 6, Math.round(w * 0.86));
  const hipPivotY = waistY + Math.round(h * 0.032);
  const leftHipCenter = measureRowCenter(leftLegData, hipPivotY, Math.round(crotchX - w * 0.13));
  const rightHipCenter = measureRowCenter(rightLegData, hipPivotY, Math.round(crotchX + w * 0.13));
  const leftAnkleCenter = measureRowCenter(leftLegData, ankleY, Math.round(w * 0.25));
  const rightAnkleCenter = measureRowCenter(rightLegData, ankleY, Math.round(w * 0.75));

  // Add subtle shaded tan bicep cap tucked deep under white sleeve cuff so arms never expose a seam
  const leftArmCanvas = makePartCanvas(w, h, leftArmData);
  const rightArmCanvas = makePartCanvas(w, h, rightArmData);
  const skinColor = sampleColor(
    Math.round(leftCuffCenter.x - 6),
    leftCuffY + 6,
    Math.round(leftCuffCenter.x + 6),
    leftCuffY + 20,
    '#E5A177'
  );

  for (const [armCanvas, cx, cy, r] of [
    [leftArmCanvas, leftCuffCenter.x, leftCuffY, leftCuffCenter.r * 0.92],
    [rightArmCanvas, rightCuffCenter.x, rightCuffY, rightCuffCenter.r * 0.92],
  ] as const) {
    const aCtx = armCanvas.getContext('2d');
    if (aCtx) {
      aCtx.save();
      aCtx.globalCompositeOperation = 'destination-over';
      aCtx.fillStyle = skinColor;
      aCtx.beginPath();
      aCtx.ellipse(cx, cy - h * 0.012, r, h * 0.025, 0, 0, Math.PI * 2);
      aCtx.fill();
      aCtx.restore();
    }
  }

  const torsoCanvas = makePartCanvas(w, h, torsoData);
  const tCtx = torsoCanvas.getContext('2d');
  if (tCtx) {
    tCtx.save();
    tCtx.globalCompositeOperation = 'destination-over';
    tCtx.fillStyle = pantsColor;
    tCtx.beginPath();
    tCtx.ellipse(
      crotchX,
      hipPivotY + h * 0.014,
      w * 0.21,
      Math.max(4, crotchY - waistY + h * 0.014),
      0,
      0,
      Math.PI * 2
    );
    tCtx.fill();
    tCtx.restore();
  }

  const findHandAnchor = (armData: Uint8ClampedArray, fallbackX: number) => {
    let minX = w;
    let maxX = 0;
    let maxY = 0;
    for (let y = Math.round(h * 0.45); y < Math.round(h * 0.72); y++) {
      for (let x = 0; x < w; x++) {
        if (armData[(y * w + x) * 4 + 3] > 80) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxY === 0) return { x: fallbackX, y: Math.round(h * 0.62) };
    return { x: Math.round((minX + maxX) / 2), y: Math.round(maxY - h * 0.03) };
  };

  const leftHand = findHandAnchor(leftArmData, Math.round(w * 0.1));
  const rightHand = findHandAnchor(rightArmData, Math.round(w * 0.9));

  // Build clean back-facing torsoHeadBack masked strictly to torsoHead silhouette
  const torsoHeadBack = document.createElement('canvas');
  torsoHeadBack.width = w;
  torsoHeadBack.height = h;
  const bCtx = torsoHeadBack.getContext('2d');
  if (bCtx) {
    bCtx.drawImage(torsoCanvas, 0, 0);
    bCtx.save();
    bCtx.globalCompositeOperation = 'source-atop';

    // Full-width back-hair coverage so zero front jaw/cheek/eyes show through on UP view
    const hairGrad = bCtx.createLinearGradient(0, h * 0.02, 0, h * 0.305);
    hairGrad.addColorStop(0, hairColor);
    hairGrad.addColorStop(0.55, '#1B2029');
    hairGrad.addColorStop(1, '#12161E');
    bCtx.fillStyle = hairGrad;
    bCtx.beginPath();
    bCtx.ellipse(w * 0.5, h * 0.168, w * 0.39, h * 0.145, 0, 0, Math.PI * 2);
    bCtx.fill();

    // Subtle back-of-ear skin accents
    bCtx.fillStyle = '#CE8A60';
    bCtx.beginPath();
    bCtx.ellipse(w * 0.24, h * 0.205, w * 0.035, h * 0.026, -0.2, 0, Math.PI * 2);
    bCtx.ellipse(w * 0.76, h * 0.205, w * 0.035, h * 0.026, 0.2, 0, Math.PI * 2);
    bCtx.fill();

    // Smooth curved cel-shaded hair crown highlight
    bCtx.strokeStyle = 'rgba(84, 100, 125, 0.42)';
    bCtx.lineWidth = Math.max(2.5, w * 0.015);
    bCtx.lineCap = 'round';
    bCtx.beginPath();
    bCtx.moveTo(w * 0.30, h * 0.125);
    bCtx.quadraticCurveTo(w * 0.50, h * 0.095, w * 0.70, h * 0.125);
    bCtx.stroke();

    // Tapered nape locks over neck
    bCtx.fillStyle = '#CE8A60';
    bCtx.fillRect(w * 0.38, h * 0.285, w * 0.24, h * 0.045);
    bCtx.fillStyle = '#151921';
    bCtx.beginPath();
    bCtx.moveTo(w * 0.34, h * 0.27);
    bCtx.lineTo(w * 0.41, h * 0.302);
    bCtx.lineTo(w * 0.46, h * 0.285);
    bCtx.lineTo(w * 0.50, h * 0.305);
    bCtx.lineTo(w * 0.54, h * 0.285);
    bCtx.lineTo(w * 0.59, h * 0.302);
    bCtx.lineTo(w * 0.66, h * 0.27);
    bCtx.closePath();
    bCtx.fill();

    // Clean white t-shirt back + high crew neck collar (covers front chest shadows)
    const backShirtGrad = bCtx.createLinearGradient(w * 0.22, h * 0.31, w * 0.78, waistY);
    backShirtGrad.addColorStop(0, '#E3E9F2');
    backShirtGrad.addColorStop(0.5, shirtColor);
    backShirtGrad.addColorStop(1, '#D5DEE9');
    bCtx.fillStyle = backShirtGrad;
    bCtx.beginPath();
    bCtx.roundRect(w * 0.20, h * 0.315, w * 0.60, waistY - h * 0.32, w * 0.06);
    bCtx.fill();

    bCtx.strokeStyle = '#BAC4D4';
    bCtx.lineWidth = Math.max(2.5, w * 0.013);
    bCtx.beginPath();
    bCtx.ellipse(w * 0.5, h * 0.314, w * 0.125, h * 0.014, 0, 0, Math.PI);
    bCtx.stroke();
    bCtx.restore();
  }

  // Build heel-view sandal backs for UP facing (contoured navy heel strap & rubber sole)
  const makeFootBack = (footData: Uint8ClampedArray) => {
    const srcCanvas = makePartCanvas(w, h, footData);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const oCtx = out.getContext('2d');
    if (oCtx) {
      oCtx.drawImage(srcCanvas, 0, 0);
      oCtx.save();
      oCtx.globalCompositeOperation = 'source-atop';
      // Exposed heel skin at ankle
      oCtx.fillStyle = '#CE8A60';
      oCtx.fillRect(0, Math.round(h * 0.89), w, Math.round(h * 0.032));
      // Navy cushioned heel strap with lighter bevel
      oCtx.fillStyle = '#294C82';
      oCtx.fillRect(0, Math.round(h * 0.918), w, Math.round(h * 0.042));
      oCtx.fillStyle = '#4772B5';
      oCtx.fillRect(0, Math.round(h * 0.922), w, Math.round(h * 0.010));
      // Dark textured sole
      oCtx.fillStyle = '#1E2838';
      oCtx.fillRect(0, Math.round(h * 0.958), w, Math.round(h * 0.05));
      oCtx.restore();
    }
    return out;
  };

  const leftFootBack = makeFootBack(leftFootData);
  const rightFootBack = makeFootBack(rightFootData);

  return {
    full,
    torsoHead: torsoCanvas,
    torsoHeadBack,
    leftArm: leftArmCanvas,
    rightArm: rightArmCanvas,
    leftLeg: makePartCanvas(w, h, leftLegData),
    rightLeg: makePartCanvas(w, h, rightLegData),
    leftUpperLeg: makePartCanvas(w, h, leftUpperLegData),
    leftFoot: makePartCanvas(w, h, leftFootData),
    leftFootBack,
    rightUpperLeg: makePartCanvas(w, h, rightUpperLegData),
    rightFoot: makePartCanvas(w, h, rightFootData),
    rightFootBack,
    width: w,
    height: h,
    leftShoulderX: leftCuffCenter.x / w,
    rightShoulderX: rightCuffCenter.x / w,
    shoulderY: ((leftCuffY + rightCuffY) * 0.5) / h,
    leftHandX: leftHand.x / w,
    rightHandX: rightHand.x / w,
    handY: Math.max(leftHand.y, rightHand.y) / h,
    leftHipX: leftHipCenter.x / w,
    rightHipX: rightHipCenter.x / w,
    hipY: hipPivotY / h,
    leftAnkleX: leftAnkleCenter.x / w,
    rightAnkleX: rightAnkleCenter.x / w,
    ankleY: ankleY / h,
    waistY: waistY / h,
    crotchY: crotchY / h,
    crotchX: crotchX / w,
    hairColor,
    shirtColor,
    shirtShadeColor: '#CBD5E1',
    pantsColor,
  };
}

/**
 * Loads the uploaded farmer image, removes near-white background via border flood-fill
 * (preserving the white t-shirt inside the dark outline), tight-crops it, and builds
 * an articulated sprite rig for walking limb animation.
 */
export function loadCleanFarmerSprite(): Promise<HTMLCanvasElement> {
  if (cachedFarmerSprite) return Promise.resolve(cachedFarmerSprite);
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const ctx = temp.getContext('2d');
      if (!ctx) {
        resolve(temp);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      const visited = new Uint8Array(w * h);
      const queue = new Int32Array(w * h);
      let head = 0;
      let tail = 0;

      const isNearWhite = (idx: number) => {
        const p = idx * 4;
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        return min > 218 && max - min < 28;
      };

      const push = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const idx = y * w + x;
        if (visited[idx]) return;
        if (!isNearWhite(idx)) return;
        visited[idx] = 1;
        queue[tail++] = idx;
      };

      // Seed flood-fill along all 4 image borders
      for (let x = 0; x < w; x++) {
        push(x, 0);
        push(x, h - 1);
      }
      for (let y = 0; y < h; y++) {
        push(0, y);
        push(w - 1, y);
      }

      while (head < tail) {
        const idx = queue[head++];
        const p = idx * 4;
        data[p + 3] = 0;

        const x = idx % w;
        const y = (idx / w) | 0;
        push(x + 1, y);
        push(x - 1, y);
        push(x, y + 1);
        push(x, y - 1);
      }

      // Soften 1px fringe around removed background pixels
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = y * w + x;
          if (visited[idx]) continue;
          const p = idx * 4;
          const r = data[p];
          const g = data[p + 1];
          const b = data[p + 2];
          if (Math.min(r, g, b) > 195 && Math.max(r, g, b) - Math.min(r, g, b) < 30) {
            const hasBgNeighbor =
              visited[idx - 1] || visited[idx + 1] || visited[idx - w] || visited[idx + w];
            if (hasBgNeighbor) {
              data[p + 3] = Math.min(data[p + 3], 90);
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);

      // Tight-crop to exact opaque character bounds
      let minX = w;
      let minY = h;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] > 20) {
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
        maxX = w - 1;
        maxY = h - 1;
      }

      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;
      const clean = document.createElement('canvas');
      clean.width = cropW;
      clean.height = cropH;
      const cCtx = clean.getContext('2d');
      if (cCtx) {
        cCtx.imageSmoothingEnabled = false;
        cCtx.drawImage(temp, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
      }

      cachedFarmerSprite = clean;
      cachedFarmerRig = buildFarmerSpriteRig(clean);
      resolve(clean);
    };
    img.onerror = () => {
      const fallback = document.createElement('canvas');
      fallback.width = 64;
      fallback.height = 128;
      cachedFarmerSprite = fallback;
      resolve(fallback);
    };
    img.src = FARMER_IMAGE_URL;
  });

  return loadingPromise;
}

export const FRIDGE_IMAGE_URL = '/assets/aistudio/image_7843d006_732b1e25.jpg';
export const CABINET_IMAGE_URL = '/assets/aistudio/image_d94e271_8fa47976.jpg';

let cachedFridgeSprite: HTMLCanvasElement | null = null;
let fridgeLoadingPromise: Promise<HTMLCanvasElement | null> | null = null;
let cachedCabinetSprite: HTMLCanvasElement | null = null;
let cabinetLoadingPromise: Promise<HTMLCanvasElement | null> | null = null;

function loadWhiteStrippedCroppedSprite(url: string): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d');
      if (!tCtx) {
        resolve(null);
        return;
      }
      tCtx.drawImage(img, 0, 0);
      const imgData = tCtx.getImageData(0, 0, w, h);
      const data = imgData.data;

      const visited = new Uint8Array(w * h);
      const queue = new Int32Array(w * h);
      let head = 0;
      let tail = 0;

      const isNearWhite = (idx: number) => {
        const p = idx * 4;
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        return min > 224 && max - min < 26;
      };

      const push = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const idx = y * w + x;
        if (visited[idx] || !isNearWhite(idx)) return;
        visited[idx] = 1;
        queue[tail++] = idx;
      };

      for (let x = 0; x < w; x++) {
        push(x, 0);
        push(x, h - 1);
      }
      for (let y = 0; y < h; y++) {
        push(0, y);
        push(w - 1, y);
      }

      while (head < tail) {
        const idx = queue[head++];
        data[idx * 4 + 3] = 0;
        const x = idx % w;
        const y = (idx / w) | 0;
        push(x + 1, y);
        push(x - 1, y);
        push(x, y + 1);
        push(x, y - 1);
      }

      // Soften 1px fringe around removed white background
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = y * w + x;
          if (visited[idx]) continue;
          const p = idx * 4;
          const min = Math.min(data[p], data[p + 1], data[p + 2]);
          const max = Math.max(data[p], data[p + 1], data[p + 2]);
          if (min > 195 && max - min < 28) {
            const hasBgNeighbor =
              visited[idx - 1] || visited[idx + 1] || visited[idx - w] || visited[idx + w];
            if (hasBgNeighbor) {
              data[p + 3] = Math.min(data[p + 3], 100);
            }
          }
        }
      }

      tCtx.putImageData(imgData, 0, 0);

      // Tight crop around opaque sprite pixels
      let minX = w;
      let minY = h;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] > 15) {
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
        maxX = w - 1;
        maxY = h - 1;
      }

      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;
      const clean = document.createElement('canvas');
      clean.width = cropW;
      clean.height = cropH;
      const cCtx = clean.getContext('2d');
      if (cCtx) {
        cCtx.imageSmoothingEnabled = false;
        cCtx.drawImage(temp, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
      }

      resolve(clean);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function getCachedFridgeSprite(): HTMLCanvasElement | null {
  return cachedFridgeSprite;
}

export function preloadFridgeSprite(): Promise<HTMLCanvasElement | null> {
  if (cachedFridgeSprite) return Promise.resolve(cachedFridgeSprite);
  if (fridgeLoadingPromise) return fridgeLoadingPromise;
  fridgeLoadingPromise = loadWhiteStrippedCroppedSprite(FRIDGE_IMAGE_URL).then((clean) => {
    cachedFridgeSprite = clean;
    return clean;
  });
  return fridgeLoadingPromise;
}

export function getCachedCabinetSprite(): HTMLCanvasElement | null {
  return cachedCabinetSprite;
}

export function preloadCabinetSprite(): Promise<HTMLCanvasElement | null> {
  if (cachedCabinetSprite) return Promise.resolve(cachedCabinetSprite);
  if (cabinetLoadingPromise) return cabinetLoadingPromise;
  cabinetLoadingPromise = loadWhiteStrippedCroppedSprite(CABINET_IMAGE_URL).then((clean) => {
    cachedCabinetSprite = clean;
    return clean;
  });
  return cabinetLoadingPromise;
}
