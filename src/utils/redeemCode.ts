export type CodeRewardType = 'COMBO' | 'LEVEL' | 'GOLD';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SALT = 'NUSATANI2026';
const USED_CODES_KEY = 'nusa_tani_used_codes_v1';

const TYPE_CHAR: Record<CodeRewardType, string> = {
  COMBO: 'C',
  LEVEL: 'L',
  GOLD: 'G',
};

const CHAR_TO_TYPE: Record<string, CodeRewardType> = {
  C: 'COMBO',
  L: 'LEVEL',
  G: 'GOLD',
};

function computeChecksum(body: string): string {
  let h1 = 17;
  let h2 = 31;
  const full = `${body}:${SALT}`;
  for (let i = 0; i < full.length; i++) {
    const code = full.charCodeAt(i);
    h1 = (h1 * 37 + code) % 997;
    h2 = (h2 * 53 + code + i) % 991;
  }
  return ALPHABET[h1 % ALPHABET.length] + ALPHABET[h2 % ALPHABET.length];
}

export function generateRedeemCode(rewardType: CodeRewardType): string {
  const prefix = TYPE_CHAR[rewardType];
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  const body = `${prefix}${rand}`;
  const chk = computeChecksum(body);
  return `TANI-${body}-${chk}`;
}

export interface ParsedRedeemCode {
  valid: boolean;
  alreadyUsed?: boolean;
  normalized?: string;
  rewardType?: CodeRewardType;
  targetLevel?: number;
  levelDelta?: number;
  goldDelta?: number;
  singleUse?: boolean;
}

function getUsedCodes(): Set<string> {
  try {
    const raw = localStorage.getItem(USED_CODES_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function markCodeUsed(normalizedCode: string) {
  try {
    const set = getUsedCodes();
    set.add(normalizedCode);
    localStorage.setItem(USED_CODES_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore storage errors
  }
}

export function validateRedeemCode(rawInput: string): ParsedRedeemCode {
  const normalized = rawInput.trim().toUpperCase();

  if (normalized === '78907890') {
    return {
      valid: true,
      alreadyUsed: false,
      normalized,
      rewardType: 'LEVEL',
      targetLevel: 9,
      goldDelta: 0,
      singleUse: false,
    };
  }

  if (normalized === '99990000') {
    return {
      valid: true,
      alreadyUsed: false,
      normalized,
      rewardType: 'GOLD',
      goldDelta: 999_000,
      singleUse: false,
    };
  }

  const match = normalized.match(/^TANI-([CLG][A-Z2-9]{4})-([A-Z2-9]{2})$/);
  if (!match) {
    return { valid: false };
  }
  const body = match[1];
  const chk = match[2];
  if (computeChecksum(body) !== chk) {
    return { valid: false };
  }

  const used = getUsedCodes();
  if (used.has(normalized)) {
    return { valid: true, alreadyUsed: true, normalized };
  }

  const rewardType = CHAR_TO_TYPE[body[0]];
  if (!rewardType) {
    return { valid: false };
  }

  return {
    valid: true,
    alreadyUsed: false,
    normalized,
    rewardType,
    levelDelta: rewardType === 'LEVEL' || rewardType === 'COMBO' ? 1 : 0,
    goldDelta: rewardType === 'GOLD' ? 500_000 : rewardType === 'COMBO' ? 250_000 : 0,
    singleUse: true,
  };
}
