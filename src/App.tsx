import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Fish, Sword, Waves } from 'lucide-react';
import { BackpackModal } from './components/BackpackModal';
import {
  CABINET_TOTAL_SLOTS,
  CabinetModal,
  isCabinetNonFoodItem,
} from './components/CabinetModal';
import {
  FRIDGE_TOTAL_SLOTS,
  FridgeModal,
  isFridgeFoodItem,
} from './components/FridgeModal';
import { HUD, ZOOM_PRESETS } from './components/HUD';
import {
  DaySummaryModal,
  KitchenModal,
  PauseModal,
  RobotRecruitModal,
  SleepConfirmModal,
} from './components/Overlays';
import { PCModal } from './components/PCModal';
import { DevIntroSplash } from './components/DevIntroSplash';
import { IntroCutscene } from './components/IntroCutscene';
import { TitleScreen } from './components/TitleScreen';
import {
  CROPS,
  DAY_MAX_MINUTES,
  DAY_START_MINUTES,
  DAYS_PER_SEASON,
  getBagCapacity,
  getLevelMinXp,
  getPlayerLevel,
  ITEMS,
  MAX_PLAYER_LEVEL,
  ORCHARD_LEFT_PRICE,
  ORCHARD_PLOT_MIN_LEVEL,
  ORCHARD_RIGHT_PRICE,
  REAL_SECONDS_PER_DAY,
  rollWeatherForSeason,
  SEASON_ORDER,
  SEASONS,
  SLOTS_PER_BAG_UPGRADE,
  WEATHER_LABELS,
} from './data/cropsAndItems';
import {
  createCliffSceneObjects,
  createFarmSceneObjects,
  createForestSceneObjects,
  createInitialWorldObjects,
  createKebunAtasObjects,
  createLabSceneObjects,
  createPeakSceneObjects,
  createRiverSceneObjects,
  InteractZone,
  isTileSolid,
  randomizeHalfKalabasFruiting,
  SCENE_MAPS,
  spawnFallenKalabasDrops,
  TILE_SIZE,
} from './engine/maps';
import { findPathToTile, Waypoint } from './engine/pathfinding';
import { PlayerActionKind } from './engine/characterRenderer';
import { FacingDir, Particle, renderGameWorld, RiverFish } from './engine/renderer';
import { CombatProjectile, preloadRobotSprite } from './engine/robotRenderer';
import {
  DailyOrder,
  DaySummaryData,
  GamePhase,
  InventorySlot,
  PlotState,
  SaveData,
  SceneId,
  Season,
  UpgradesState,
  WorldObject,
} from './types/game';
import { soundEngine } from './utils/audio';
import { markCodeUsed, validateRedeemCode } from './utils/redeemCode';
import { loadCleanFarmerSprite, preloadCabinetSprite, preloadFridgeSprite } from './utils/spriteLoader';

const SAVE_KEY = 'nusa_tani_save_v1';
const GAME_MINUTES_PER_REAL_SEC = (DAY_MAX_MINUTES - DAY_START_MINUTES) / REAL_SECONDS_PER_DAY; // 2.0 game mins per real sec

function generateDailyOrder(season: Season): DailyOrder {
  const seasonCrops = Object.values(CROPS).filter((c) => c.season === season);
  const picked = seasonCrops[Math.floor(Math.random() * seasonCrops.length)] || Object.values(CROPS)[0];
  const qty = 3 + Math.floor(Math.random() * 5);
  return {
    itemId: picked.harvestId,
    itemName: picked.name,
    requiredQty: qty,
    deliveredQty: 0,
    bonusPerUnit: Math.round(picked.sellPrice * 0.6),
    completed: false,
  };
}

function createInitialSaveData(): SaveData {
  const w1 = rollWeatherForSeason('MARENG');
  const w2 = rollWeatherForSeason('MARENG');
  return {
    version: 1,
    gold: 500,
    year: 1,
    season: 'MARENG',
    dayInSeason: 1,
    timeMinutes: DAY_START_MINUTES,
    weather: w1.weather,
    tomorrowWeather: w2.weather,
    rainfallMm: w1.rainfallMm,
    scene: 'HOUSE',
    playerX: 25.5,
    playerY: 7.0,
    stats: { health: 50, mood: 50, speed: 50 },
    wateringCanCharges: 20,
    upgrades: {
      bigWateringCan: false,
      steelHoe: false,
      rainBoots: false,
      orchardDeed: false,
      orchardLeftDeed: false,
      orchardRightDeed: false,
      peakGateOpened: false,
    },
    hotbarSelected: 0,
    inventory: [
      { itemId: 'tool_hoe', quantity: 1 },
      { itemId: 'tool_watering_can', quantity: 1 },
      { itemId: 'tool_axe', quantity: 1 },
      { itemId: 'tool_scythe', quantity: 1 },
      { itemId: 'bibit_jagung_manis', quantity: 6 },
      { itemId: 'kopi_tubruk', quantity: 1 },
    ],
    plots: {},
    worldObjects: createInitialWorldObjects(),
    wcUsedToday: false,
    dailyOrder: generateDailyOrder('MARENG'),
    totalEarned: 0,
    totalHarvested: 0,
    xp: 0,
    xpMoneyRemainder: 0,
    bagLevel: 1,
    kalabasDropDays: 0,
    kalabasFruitDays: 0,
    homeEatUsedToday: 0,
    homeDrinkUsedToday: 0,
    fridgeSlots: Array.from({ length: FRIDGE_TOTAL_SLOTS }, () => null),
    cabinetSlots: Array.from({ length: CABINET_TOTAL_SLOTS }, () => null),
    robot: {
      owned: false,
      defeatedToday: false,
      hp: 120,
      maxHp: 120,
    },
  };
}

function tryAddInventoryItem(
  inv: InventorySlot[],
  itemId: string,
  qty: number,
  bagLevel: number
): InventorySlot[] | null {
  const next = inv.map((s) => ({ ...s }));
  const existing = next.find((s) => s.itemId === itemId);
  if (existing) {
    existing.quantity += qty;
    return next;
  }
  if (next.length >= getBagCapacity(bagLevel)) {
    return null;
  }
  next.push({ itemId, quantity: qty });
  return next;
}

function grantGoldWithXp(
  sim: SaveData,
  earned: number
): { xpGained: number; leveledUpTo: number | null } {
  if (earned <= 0) return { xpGained: 0, leveledUpTo: null };
  const prevLevel = getPlayerLevel(sim.xp);
  sim.gold += earned;
  sim.totalEarned += earned;
  sim.xpMoneyRemainder += earned;
  const chunks = Math.floor(sim.xpMoneyRemainder / 100_000);
  if (chunks > 0) {
    sim.xpMoneyRemainder %= 100_000;
    sim.xp += chunks * 10;
  }
  const nextLevel = getPlayerLevel(sim.xp);
  return {
    xpGained: chunks * 10,
    leveledUpTo: nextLevel > prevLevel ? nextLevel : null,
  };
}

function removeInventoryItem(inv: InventorySlot[], itemId: string, qty: number): InventorySlot[] {
  const next: InventorySlot[] = [];
  for (const s of inv) {
    if (s.itemId === itemId) {
      const rem = s.quantity - qty;
      if (rem > 0) next.push({ itemId: s.itemId, quantity: rem });
    } else {
      next.push({ ...s });
    }
  }
  return next;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [hasSave, setHasSave] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem(SAVE_KEY));
    } catch {
      return false;
    }
  });

  const [phase, setPhase] = useState<GamePhase>('DEV_SPLASH');
  const phaseRef = useRef<GamePhase>('DEV_SPLASH');
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(() => soundEngine.getVolume());
  const [musicVolume, setMusicVolume] = useState(() => soundEngine.getMusicVolume());
  const [daySummary, setDaySummary] = useState<DaySummaryData | null>(null);
  const [contextPrompt, setContextPrompt] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [riverStatus, setRiverStatus] = useState({ inRiver: false, waitSec: 0, nearbyCount: 0 });
  const [zoom, setZoom] = useState<number>(1);

  // Authoritative simulation state stored in ref for 60fps canvas loop, synced to React HUD state on discrete changes
  const simRef = useRef<SaveData>(createInitialSaveData());
  const [hudState, setHudState] = useState<SaveData>(() => simRef.current);

  const runtimeRef = useRef({
    facingDir: 'DOWN' as FacingDir,
    isMoving: false,
    walkCycle: 0,
    actionKind: 'NONE' as PlayerActionKind,
    actionProgress: 0,
    hitstopTimer: 0,
    shakeAmount: 0,
    cameraX: 5.5 * TILE_SIZE,
    cameraY: 6.8 * TILE_SIZE,
    targetZoom: 1,
    renderZoom: 1,
    elapsedTime: 0,
    hoveredTile: null as { tx: number; ty: number } | null,
    moveTarget: null as { x: number; y: number } | null,
    pathQueue: [] as Waypoint[],
    pendingAction: null as {
      tx: number;
      ty: number;
      kind: 'TILE' | 'PC' | 'BED' | 'CABINET' | 'FRIDGE' | 'BATH' | 'WC' | 'KITCHEN' | 'GATE_SIGN' | 'MYSTERIOUS_CAVE';
    } | null,
    isBathing: false,
    bathTimer: 0,
    bathStartTime: 0,
    bathStartHealth: 0,
    bathStartMood: 0,
    bathStartSpeed: 0,
    pointerDrag: {
      active: false,
      dragging: false,
      downX: 0,
      downY: 0,
      curClientX: 0,
      curClientY: 0,
    },
    particles: [] as Particle[],
    farmerSprite: null as HTMLCanvasElement | null,
    heldKeys: new Set<string>(),
    lastHudSync: 0,
    activeInteract: null as InteractZone | null,
    portalCooldown: 0,
    robotX: 14.0,
    robotY: 8.6,
    robotAggro: false,
    robotHitFlash: 0,
    robotAttackAnim: 0,
    robotAttackCd: 0,
    robotPlayerSwingCd: 0,
    projectiles: [] as CombatProjectile[],
    riverFish: [] as RiverFish[],
    riverWaitTimer: 0,
  });

  const toastTimerRef = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

  const syncHud = useCallback(() => {
    setHudState({ ...simRef.current, stats: { ...simRef.current.stats } });
  }, []);

  const saveToStorage = useCallback(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(simRef.current));
      setHasSave(true);
    } catch {
      // ignore storage quota errors
    }
  }, []);

  const spawnParticleText = useCallback((wx: number, wy: number, text: string, color: string) => {
    runtimeRef.current.particles.push({
      x: wx,
      y: wy,
      vx: (Math.random() - 0.5) * 18,
      vy: -36,
      life: 1.0,
      maxLife: 1.0,
      size: 13,
      color,
      kind: 'TEXT',
      text,
    });
  }, []);

  const spawnBurst = useCallback((wx: number, wy: number, color: string, count: number, kind: Particle['kind'] = 'DUST') => {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 25 + Math.random() * 65;
      runtimeRef.current.particles.push({
        x: wx,
        y: wy,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 15,
        life: 0.45 + Math.random() * 0.3,
        maxLife: 0.75,
        size: 2.5 + Math.random() * 3,
        color,
        kind,
      });
    }
  }, []);

  // Load processed user-uploaded farmer, robot, fridge & cabinet sprites once
  useEffect(() => {
    loadCleanFarmerSprite().then((sprite) => {
      runtimeRef.current.farmerSprite = sprite;
    });
    void preloadRobotSprite();
    void preloadFridgeSprite();
    void preloadCabinetSprite();
  }, []);

  // Start looping background music once dev splash & intro video end (or on first user gesture afterwards)
  useEffect(() => {
    if (phase !== 'DEV_SPLASH' && phase !== 'INTRO_VIDEO') {
      soundEngine.startBgm();
    }
    const resumeBgm = () => {
      if (phaseRef.current !== 'DEV_SPLASH' && phaseRef.current !== 'INTRO_VIDEO') {
        soundEngine.startBgm();
      }
    };
    window.addEventListener('pointerdown', resumeBgm, { passive: true });
    window.addEventListener('keydown', resumeBgm, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', resumeBgm);
      window.removeEventListener('keydown', resumeBgm);
    };
  }, [phase]);

  // Update rain ambience whenever weather/scene/phase changes
  useEffect(() => {
    if (phase === 'PLAYING' && hudState.scene !== 'HOUSE') {
      if (hudState.weather === 'HUJAN_DERAS') soundEngine.updateRainAmbience('HEAVY');
      else if (hudState.weather === 'GERIMIS') soundEngine.updateRainAmbience('LIGHT');
      else soundEngine.updateRainAmbience('NONE');
    } else {
      soundEngine.updateRainAmbience('NONE');
    }
  }, [phase, hudState.scene, hudState.weather, muted]);

  const endDayAndSleep = useCallback(
    (fainted: boolean) => {
      const sim = simRef.current;
      soundEngine.playSleep();

      const prevDay = sim.dayInSeason;
      const prevSeason = sim.season;
      let nextDay = prevDay + 1;
      let nextSeason = prevSeason;
      let nextYear = sim.year;
      let seasonChanged = false;

      if (nextDay > DAYS_PER_SEASON) {
        nextDay = 1;
        seasonChanged = true;
        const idx = SEASON_ORDER.indexOf(prevSeason);
        nextSeason = SEASON_ORDER[(idx + 1) % SEASON_ORDER.length];
        if (nextSeason === 'MARENG') nextYear += 1;
      }

      const nextWeather = sim.tomorrowWeather;
      const [minMm, maxMm] = WEATHER_LABELS[nextWeather].mmRange;
      const nextRainfallMm = minMm === maxMm ? minMm : Math.round(minMm + Math.random() * (maxMm - minMm));
      const futureRoll = rollWeatherForSeason(nextSeason);
      const isRainingToday = WEATHER_LABELS[sim.weather].watersCrops;
      const isRainingTomorrow = WEATHER_LABELS[nextWeather].watersCrops;

      let cropsGrown = 0;
      let rainWateredCount = 0;
      let wiltedCount = 0;

      const updatedPlots: Record<string, PlotState> = {};
      for (const [key, plot] of Object.entries(sim.plots)) {
        const p = { ...plot };
        if (p.cropId && !p.wilted) {
          const crop = CROPS[p.cropId];
          if (crop) {
            if (seasonChanged && p.scene === 'FARM' && crop.season !== nextSeason) {
              p.wilted = true;
              wiltedCount++;
            } else {
              const hadWater = p.watered || isRainingToday;
              if (hadWater) {
                p.dryDays = 0;
                if (!p.readyToHarvest) {
                  let growthStep = p.scene === 'ORCHARD' ? 1.25 : 1.0;
                  if (crop.waterLover && isRainingToday) growthStep += 0.5;
                  p.growthProgress += growthStep;
                  cropsGrown++;
                  if (p.growthProgress >= crop.growthDays) {
                    p.readyToHarvest = true;
                  }
                }
              } else {
                p.dryDays += 1;
                if (prevSeason === 'KEMARAU' && !crop.droughtResistant && p.dryDays >= 2) {
                  p.wilted = true;
                  wiltedCount++;
                }
              }
            }
          }
        }

        // Next morning moisture state (owned robot auto-waters all tilled plots)
        const robotWaters = Boolean(sim.robot?.owned);
        p.watered = isRainingTomorrow || robotWaters;
        if ((isRainingTomorrow || robotWaters) && p.tilled) rainWateredCount++;
        updatedPlots[key] = p;
      }

      // Perennial non-Kalabas fruit trees regrow every 2 days; Kalabas trees only fruit half randomly every 3 days
      const updatedObjs: WorldObject[] = sim.worldObjects.map((obj) => {
        if (obj.kind === 'FRUIT_TREE' && obj.itemId !== 'buah_kalabas' && !obj.harvestReady) {
          const nextT = (obj.regrowTimer ?? 0) + 1;
          if (nextT >= 2) return { ...obj, harvestReady: true, regrowTimer: 0 };
          return { ...obj, regrowTimer: nextT };
        }
        return obj;
      });

      const nextDropDays = (sim.kalabasDropDays ?? 0) + 1;
      let finalObjs = updatedObjs;
      if (nextDropDays >= 2) {
        finalObjs = spawnFallenKalabasDrops(updatedObjs, Date.now() % 100000);
        sim.kalabasDropDays = 0;
      } else {
        sim.kalabasDropDays = nextDropDays;
      }

      const nextFruitDays = (sim.kalabasFruitDays ?? 0) + 1;
      if (nextFruitDays >= 3) {
        finalObjs = randomizeHalfKalabasFruiting(finalObjs);
        sim.kalabasFruitDays = 0;
      } else {
        sim.kalabasFruitDays = nextFruitDays;
      }

      // Respawn forage in Forest up to 5 items
      const forestForageCount = finalObjs.filter((o) => o.scene === 'FOREST' && o.kind === 'FORAGE').length;
      if (forestForageCount < 5) {
        const spots: [number, number, string][] = [
          [4, 4, 'jamur_liar'],
          [17, 4, 'daun_herbal'],
          [7, 15, 'jamur_liar'],
          [19, 12, 'daun_herbal'],
          [20, 4, 'akar_ginseng'],
        ];
        for (const [fx, fy, itemId] of spots) {
          if (!finalObjs.some((o) => o.scene === 'FOREST' && o.tx === fx && o.ty === fy)) {
            finalObjs.push({
              id: `forage_${Date.now()}_${fx}_${fy}`,
              scene: 'FOREST',
              tx: fx,
              ty: fy,
              kind: 'FORAGE',
              itemId,
              hp: 1,
              maxHp: 1,
            });
          }
        }
      }

      const faintPenalty = fainted ? Math.min(sim.gold, 50) : 0;

      sim.year = nextYear;
      sim.season = nextSeason;
      sim.dayInSeason = nextDay;
      sim.timeMinutes = DAY_START_MINUTES;
      sim.weather = nextWeather;
      sim.tomorrowWeather = futureRoll.weather;
      sim.rainfallMm = nextRainfallMm;
      sim.plots = updatedPlots;
      sim.worldObjects = finalObjs;
      sim.wcUsedToday = false;
      sim.homeEatUsedToday = 0;
      sim.homeDrinkUsedToday = 0;
      sim.dailyOrder = generateDailyOrder(nextSeason);
      sim.gold -= faintPenalty;
      sim.scene = 'HOUSE';
      sim.playerX = 25.5;
      sim.playerY = 7.0;
      if (!sim.robot) {
        sim.robot = { owned: false, defeatedToday: false, hp: 120, maxHp: 120 };
      }
      // Robot HP resets to full every morning at 03:00 AM
      sim.robot.defeatedToday = false;
      sim.robot.hp = sim.robot.maxHp;
      runtimeRef.current.robotAggro = false;
      runtimeRef.current.robotX = 14.0;
      runtimeRef.current.robotY = 8.6;
      runtimeRef.current.projectiles = [];
      runtimeRef.current.facingDir = 'DOWN';
      runtimeRef.current.cameraX = 25.5 * TILE_SIZE;
      runtimeRef.current.cameraY = 7.0 * TILE_SIZE;

      sim.stats = { health: 50, mood: 50, speed: 50 };

      setDaySummary({
        prevDay,
        prevSeason,
        nextDay,
        nextSeason,
        seasonChanged,
        fainted,
        faintPenalty,
        cropsGrown,
        rainWateredCount,
        wiltedCount,
        rainfallMm: nextRainfallMm,
        weatherNext: nextWeather,
      });

      saveToStorage();
      syncHud();
      setPhase('DAY_SUMMARY');
    },
    [saveToStorage, syncHud]
  );

  const handleSceneChange = useCallback(
    (targetScene: SceneId, spawnX: number, spawnY: number, label?: string) => {
      const sim = simRef.current;
      sim.scene = targetScene;
      sim.playerX = spawnX;
      sim.playerY = spawnY;
      runtimeRef.current.cameraX = spawnX * TILE_SIZE;
      runtimeRef.current.cameraY = spawnY * TILE_SIZE;
      runtimeRef.current.portalCooldown = 0.55;
      soundEngine.playDoor();
      if (label) showToast(label);
      saveToStorage();
      syncHud();
    },
    [saveToStorage, showToast, syncHud]
  );

  const startBathSoak = useCallback(() => {
    const sim = simRef.current;
    const rt = runtimeRef.current;
    if (rt.isBathing) return;

    if (sim.timeMinutes + 60 >= DAY_MAX_MINUTES) {
      soundEngine.playError();
      showToast('Sudah terlalu malam (mendekati jam 00.00)! Segera tidur agar tidak pingsan.');
      return;
    }

    rt.pathQueue = [];
    rt.moveTarget = null;
    rt.pendingAction = null;
    rt.heldKeys.clear();
    rt.pointerDrag.active = false;
    rt.pointerDrag.dragging = false;

    sim.playerX = 5.0;
    sim.playerY = 7.9;
    rt.facingDir = 'DOWN';
    rt.isMoving = false;
    rt.actionKind = 'NONE';
    rt.actionProgress = 0;

    rt.isBathing = true;
    rt.bathTimer = 0;
    rt.bathStartTime = sim.timeMinutes;
    rt.bathStartHealth = sim.stats.health;
    rt.bathStartMood = sim.stats.mood;
    rt.bathStartSpeed = sim.stats.speed;

    soundEngine.playWater();
    spawnBurst(5.0 * TILE_SIZE, 7.6 * TILE_SIZE, '#BAE6FD', 16, 'WATER');
    showToast('Berendam di kolam hangat... (1 jam)');
  }, [showToast, spawnBurst]);

  const handleUseWc = useCallback(() => {
    const sim = simRef.current;
    if (sim.wcUsedToday) {
      soundEngine.playError();
      showToast('Anda sudah menggunakan WC pagi ini! Bisa digunakan lagi besok pagi.');
      return;
    }
    sim.wcUsedToday = true;
    sim.stats.speed = Math.min(100, sim.stats.speed + 10);
    sim.stats.mood = Math.min(100, sim.stats.mood + 10);
    sim.stats.health = Math.min(100, sim.stats.health + 10);
    soundEngine.playWater();
    spawnBurst(10.0 * TILE_SIZE, 6.2 * TILE_SIZE, '#BAE6FD', 12, 'WATER');
    spawnParticleText(10.0 * TILE_SIZE, 5.4 * TILE_SIZE, '+10 Kecepatan  +10 Mood  +10 Kesehatan', '#38BDF8');
    showToast('Lega di WC pagi hari! +10 Kecepatan, +10 Mood, +10 Kesehatan!');
    saveToStorage();
    syncHud();
  }, [saveToStorage, showToast, spawnBurst, spawnParticleText, syncHud]);

  const triggerInteractionZone = useCallback(
    (zone: InteractZone) => {
      const sim = simRef.current;
      if (zone.id === 'PC') {
        setPhase('PC_OPEN');
        return;
      }
      if (zone.id === 'BED') {
        setPhase('SLEEP_CONFIRM');
        return;
      }
      if (zone.id === 'BATH') {
        startBathSoak();
        return;
      }
      if (zone.id === 'WC') {
        handleUseWc();
        return;
      }
      if (zone.id === 'KITCHEN') {
        setPhase('KITCHEN_OPEN');
        return;
      }
      if (zone.id === 'FRIDGE') {
        setPhase('FRIDGE_OPEN');
        return;
      }
      if (zone.id === 'CABINET') {
        setPhase('CABINET_OPEN');
        return;
      }
      if (zone.id === 'DOOR_IN') {
        handleSceneChange('HOUSE', 15.0, 12.6, 'Masuk ke Dalam Rumah (3 Ruangan)');
        return;
      }
      if (zone.id === 'DOOR_OUT') {
        handleSceneChange('FARM', 5.5, 6.5, 'Keluar ke Kebun Utama');
        return;
      }
      if (zone.id === 'WELL' || zone.id === 'STREAM') {
        const maxCharges = sim.upgrades.bigWateringCan ? 45 : 20;
        sim.wateringCanCharges = maxCharges;
        runtimeRef.current.actionKind = 'WATER';
        runtimeRef.current.actionProgress = 0.01;
        soundEngine.playWater();
        spawnBurst(sim.playerX * TILE_SIZE, sim.playerY * TILE_SIZE - 16, '#38BDF8', 10, 'WATER');
        if (zone.id === 'STREAM' && sim.scene === 'FOREST') {
          showToast(
            `Ember Siram penuh (${maxCharges}/${maxCharges})! Tangkap ikan langsung dari jembatan atau turun ke sungai berarus.`
          );
        } else {
          showToast(`Ember Siram terisi penuh (${maxCharges}/${maxCharges})!`);
        }
        syncHud();
        return;
      }
      if (zone.id === 'GATE_SIGN') {
        showToast('Jalan batu menuju Kebun Atas & Hutan Kalabas terbuka! Berjalanlah ke utara.');
        return;
      }
      if (zone.id === 'LAB_ROAD_SIGN') {
        showToast('Lanjutkan ke utara melewati jalan batu untuk memasuki Hutan Kalabas & Lab Penelitian!');
        return;
      }
      if (zone.id === 'LAB_DOOR') {
        soundEngine.playError();
        showToast('Pintu Laboratorium Penelitian terkunci rapat dan tidak dapat dimasuki.');
        return;
      }
      if (zone.id === 'LAB_SIGN') {
        showToast('Lab Penelitian: Lawan Robot Mecha Coklat (HP reset 03.00 pagi). Kalabas jatuh 1 pcs tiap 2 hari & separo pohon berbuah acak tiap 3 hari!');
        return;
      }
      if (zone.id === 'RIVER_SIGN') {
        showToast('Timur menuju Tebing dan Bukit Batu! Tangkap ikan dari atas jembatan atau turun ke sungai berarus.');
        return;
      }
      if (zone.id === 'WEST_RIVER_SIGN') {
        showToast('Jalan barat menuju Pinggiran Kali: banyak batu & sungai berarus dengan ikan Wader, Lele, dan Tomang!');
        return;
      }
      if (zone.id === 'WEST_PEAK_SIGN') {
        showToast('Barat: Puncak Gunung (akses hingga 1/5 area di depan tebing tinggi) & Gua Misterius yang terkunci.');
        return;
      }
      if (zone.id === 'MYSTERIOUS_CAVE') {
        soundEngine.playError();
        spawnBurst(25 * TILE_SIZE, 3.6 * TILE_SIZE, '#F59E0B', 10, 'SPARKLE');
        spawnBurst(25 * TILE_SIZE, 3.6 * TILE_SIZE, '#22D3EE', 8, 'SPARKLE');
        showToast('Gua Misterius masih terkunci rapat oleh segel batu kuno!');
        return;
      }
      if (zone.id === 'PEAK_SIGN') {
        showToast('Area ini hanya bisa dijelajahi 1/5 bagian; selebihnya tebing tinggi penuh bukit & lumut hijau. Di atas kanan ada Gua Misterius yang terkunci.');
        return;
      }
      if (zone.id === 'CLIFF_SIGN') {
        showToast('Tebing dan Bukit Batu: dataran tinggi berbatu di sebelah timur Hutan & Sungai. Berjalan ke barat untuk kembali.');
        return;
      }
      if (zone.id === 'RIVER_BANK_SIGN') {
        showToast('Masuklah ke sungai berarus & tunggu tiap 5 detik hingga ikan Wader, Lele, atau Tomang hanyut mendekat!');
      }
    },
    [handleSceneChange, showToast, spawnBurst, startBathSoak, syncHud]
  );

  const getFacingFromDelta = (dx: number, dy: FacingDir | number): FacingDir => {
    const numDy = typeof dy === 'number' ? dy : 0;
    if (Math.abs(numDy) >= Math.abs(dx)) {
      return numDy < 0 ? 'UP' : 'DOWN';
    }
    return dx < 0 ? 'LEFT' : 'RIGHT';
  };

  const getFacingStep = (dir: FacingDir): [number, number] => {
    if (dir === 'UP') return [0, -1];
    if (dir === 'DOWN') return [0, 1];
    if (dir === 'LEFT') return [-1, 0];
    return [1, 0];
  };

  const grantRobotVictoryReward = useCallback(() => {
    const sim = simRef.current;
    const rt = runtimeRef.current;
    if (sim.robot.defeatedToday) return;

    sim.robot.hp = 0;
    sim.robot.defeatedToday = true;
    rt.robotAggro = false;
    rt.robotHitFlash = 0;
    soundEngine.playRobotDefeat();
    spawnBurst(rt.robotX * TILE_SIZE, rt.robotY * TILE_SIZE - 85, '#F59E0B', 26, 'SPARKLE');
    sim.stats.mood = Math.min(100, sim.stats.mood + 5);

    const giveItemOrFallbackGold = (itemId: string, qty: number, label: string) => {
      const nextInv = tryAddInventoryItem(sim.inventory, itemId, qty, sim.bagLevel);
      if (nextInv) {
        sim.inventory = nextInv;
        spawnParticleText(rt.robotX * TILE_SIZE, rt.robotY * TILE_SIZE - 175, label, '#FDE047');
        showToast(`Robot Mecha dikalahkan! Hadiah acak: ${label}!`);
      } else {
        const { leveledUpTo } = grantGoldWithXp(sim, 100_000);
        spawnParticleText(rt.robotX * TILE_SIZE, rt.robotY * TILE_SIZE - 175, '+100.000 EG', '#FBBF24');
        showToast(
          `Robot dikalahkan! Tas penuh sehingga hadiah dikonversi menjadi +100.000 EG${
            leveledUpTo ? ` · Naik Level ${leveledUpTo}!` : '!'
          }`
        );
      }
    };

    const roll = Math.floor(Math.random() * 5);
    if (roll === 0) {
      const seasonalCrops = Object.values(CROPS).filter((c) => c.season === sim.season);
      const picked =
        seasonalCrops[Math.floor(Math.random() * seasonalCrops.length)] ?? Object.values(CROPS)[0];
      const seedDef = ITEMS[picked.seedId];
      giveItemOrFallbackGold(picked.seedId, 10, `10× ${seedDef?.name ?? `Bibit ${picked.name}`}`);
    } else if (roll === 1) {
      const { xpGained, leveledUpTo } = grantGoldWithXp(sim, 100_000);
      soundEngine.playCoin();
      spawnParticleText(rt.robotX * TILE_SIZE, rt.robotY * TILE_SIZE - 175, '+100.000 EG', '#FBBF24');
      showToast(
        `Robot Mecha dikalahkan! Hadiah acak: Uang 100.000 EG (+${xpGained} XP)${
          leveledUpTo ? ` · NAIK LEVEL ${leveledUpTo}!` : '!'
        }`
      );
    } else if (roll === 2) {
      giveItemOrFallbackGold('weapon_sword', 1, '1× Pedang Baja Lab');
    } else if (roll === 3) {
      giveItemOrFallbackGold('weapon_rifle', 1, '1× Senapan Energi Lab');
    } else {
      giveItemOrFallbackGold('buah_kalabas', 20, '20× Buah Kalabas');
    }

    saveToStorage();
    syncHud();
  }, [saveToStorage, showToast, spawnBurst, spawnParticleText, syncHud]);

  const attackRobot = useCallback(() => {
    const sim = simRef.current;
    const rt = runtimeRef.current;
    if (sim.scene !== 'LAB' || sim.robot.owned) return;
    if (sim.robot.defeatedToday) {
      showToast('Robot Mecha Coklat sudah dikalahkan hari ini! HP akan reset penuh pukul 03.00 pagi.');
      return;
    }
    if (rt.robotPlayerSwingCd > 0) return;

    const selectedSlot = sim.inventory[sim.hotbarSelected];
    const itemDef = selectedSlot ? ITEMS[selectedSlot.itemId] : null;
    const distToRobot = Math.hypot(rt.robotX - sim.playerX, rt.robotY - sim.playerY);
    rt.facingDir = getFacingFromDelta(rt.robotX - sim.playerX, rt.robotY - sim.playerY);
    rt.robotAggro = true;

    if (itemDef?.weaponKind === 'RIFLE') {
      if (distToRobot > 11.5) {
        showToast('Robot terlalu jauh untuk bidikan Senapan! Mendekatlah sedikit.');
        return;
      }
      rt.actionKind = 'RIFLE';
      rt.actionProgress = 0.01;
      rt.robotPlayerSwingCd = 0.36;
      soundEngine.playGunshot();

      const dx = rt.robotX - sim.playerX;
      const dy = rt.robotY - 0.55 - sim.playerY;
      const len = Math.max(0.01, Math.hypot(dx, dy));
      const ux = dx / len;
      const uy = dy / len;
      rt.projectiles.push({
        x: sim.playerX + ux * 0.45,
        y: sim.playerY + uy * 0.45,
        vx: ux * 14,
        vy: uy * 14,
        fromPlayer: true,
        damage: 45,
        life: 1.0,
        color: '#F59E0B',
      });
      spawnBurst(
        (sim.playerX + ux * 0.55) * TILE_SIZE,
        (sim.playerY + uy * 0.55) * TILE_SIZE - 16,
        '#FDE047',
        5,
        'SPARKLE'
      );
      return;
    }

    let dmg = 15;
    if (itemDef?.weaponKind === 'SWORD') {
      if (distToRobot > 3.45) {
        showToast('Terlalu jauh untuk tebasan Pedang! Mendekatlah ke Robot Mecha.');
        return;
      }
      dmg = 38;
      rt.actionKind = 'SWORD';
      rt.actionProgress = 0.01;
      rt.robotPlayerSwingCd = 0.34;
      soundEngine.playSword();
    } else {
      if (distToRobot > 3.05) {
        showToast('Terlalu jauh! Mendekatlah untuk menyerang (atau gunakan Senapan).');
        return;
      }
      rt.actionKind = itemDef?.toolKind === 'AXE' ? 'AXE' : itemDef?.toolKind === 'SCYTHE' ? 'SCYTHE' : 'HOE';
      rt.actionProgress = 0.01;
      rt.robotPlayerSwingCd = 0.44;
      soundEngine.playChop();
    }

    sim.robot.hp = Math.max(0, sim.robot.hp - dmg);
    rt.robotHitFlash = 0.25;
    rt.hitstopTimer = 0.035;
    rt.shakeAmount = 4;
    soundEngine.playRobotHit();
    spawnBurst(rt.robotX * TILE_SIZE, rt.robotY * TILE_SIZE - 85, '#FBBF24', 12, 'SPARKLE');
    spawnParticleText(rt.robotX * TILE_SIZE, rt.robotY * TILE_SIZE - 165, `-${dmg} HP`, '#F87171');
    if (sim.robot.hp <= 0) {
      grantRobotVictoryReward();
    } else {
      syncHud();
    }
  }, [grantRobotVictoryReward, showToast, spawnBurst, spawnParticleText, syncHud]);

  const catchRiverFish = useCallback(
    (preferredFishId?: string) => {
      const sim = simRef.current;
      const rt = runtimeRef.current;
      if (sim.scene !== 'FOREST' && sim.scene !== 'RIVER') return;

      const map = SCENE_MAPS[sim.scene];
      const ptx = Math.max(0, Math.min(map.width - 1, Math.floor(sim.playerX)));
      const pty = Math.max(0, Math.min(map.height - 1, Math.floor(sim.playerY)));
      const curTile = map.tiles[pty]?.[ptx];
      const isAtRiverOrBridge = curTile === 'RIVER_WATER' || curTile === 'WOOD_BRIDGE';

      let target: RiverFish | null = null;
      if (preferredFishId) {
        const match = rt.riverFish.find((f) => f.id === preferredFishId);
        if (match && Math.hypot(match.x - sim.playerX, match.y - sim.playerY) <= 3.1) {
          target = match;
        }
      }
      if (!target) {
        let bestDist = 3.0;
        for (const f of rt.riverFish) {
          const d = Math.hypot(f.x - sim.playerX, f.y - sim.playerY);
          if (d <= bestDist) {
            bestDist = d;
            target = f;
          }
        }
      }

      if (!target) {
        soundEngine.playError();
        if (!isAtRiverOrBridge) {
          showToast('Berdirilah di atas jembatan atau turun ke aliran sungai & tunggu 5 detik hingga ikan datang!');
        } else {
          showToast('Belum ada ikan dalam jangkauan! Tunggu di jembatan atau sungai (ikan datang setiap 5 detik).');
        }
        return;
      }

      const fishDef = ITEMS[target.kind];
      const nextInv = tryAddInventoryItem(sim.inventory, target.kind, 1, sim.bagLevel);
      if (!nextInv) {
        soundEngine.playError();
        showToast(`Tas penuh (${getBagCapacity(sim.bagLevel)} slot)! Upgrade tas atau jual barang di PC.`);
        return;
      }

      sim.inventory = nextInv;
      sim.totalHarvested += 1;
      sim.stats.mood = Math.min(100, sim.stats.mood + 2);
      rt.riverFish = rt.riverFish.filter((f) => f.id !== target!.id);
      rt.facingDir = getFacingFromDelta(target.x - sim.playerX, target.y - sim.playerY);
      rt.actionKind = 'HARVEST';
      rt.actionProgress = 0.01;
      soundEngine.playWater();
      soundEngine.playHarvest();
      spawnBurst(target.x * TILE_SIZE, target.y * TILE_SIZE, '#38BDF8', 14, 'WATER');
      spawnBurst(target.x * TILE_SIZE, target.y * TILE_SIZE - 8, '#FDE047', 6, 'SPARKLE');
      spawnParticleText(
        target.x * TILE_SIZE,
        target.y * TILE_SIZE - 26,
        `+1 ${fishDef?.name ?? 'Ikan'}`,
        target.kind === 'ikan_tomang' ? '#FBBF24' : target.kind === 'ikan_lele' ? '#67E8F9' : '#E0F2FE'
      );
      showToast(`Berhasil menangkap ${fishDef?.name ?? 'Ikan'}! (Harga jual: ${fishDef?.sellPrice ?? 0} EG)`);
      setRiverStatus((prev) => ({
        ...prev,
        nearbyCount: rt.riverFish.filter((f) => Math.hypot(f.x - sim.playerX, f.y - sim.playerY) <= 2.75).length,
      }));
      saveToStorage();
      syncHud();
    },
    [saveToStorage, showToast, spawnBurst, spawnParticleText, syncHud]
  );

  const performTileAction = useCallback(
    (targetTx: number, targetTy: number) => {
      const sim = simRef.current;
      const rt = runtimeRef.current;

      if (sim.scene === 'HOUSE') {
        const heldSlot = sim.inventory[sim.hotbarSelected];
        const heldDef = heldSlot ? ITEMS[heldSlot.itemId] : null;
        if (heldDef?.id === 'buah_kalabas') {
          soundEngine.playError();
          showToast('Buah Kalabas tidak bisa dimakan!');
          return;
        }
        if (
          heldDef &&
          ((heldDef.restoreHealth ?? 0) > 0 ||
            (heldDef.restoreMood ?? 0) > 0 ||
            (heldDef.boostSpeed ?? 0) > 0)
        ) {
          rt.actionKind = 'CONSUME';
          rt.actionProgress = 0.01;
          sim.stats.health = Math.min(100, sim.stats.health + (heldDef.restoreHealth ?? 0));
          sim.stats.mood = Math.min(100, sim.stats.mood + (heldDef.restoreMood ?? 0));
          sim.stats.speed = Math.min(100, sim.stats.speed + (heldDef.boostSpeed ?? 0));
          sim.inventory = removeInventoryItem(sim.inventory, heldDef.id, 1);
          if (sim.hotbarSelected >= sim.inventory.length && sim.inventory.length > 0) {
            sim.hotbarSelected = Math.max(0, sim.inventory.length - 1);
          }
          soundEngine.playEat();
          spawnParticleText(
            sim.playerX * TILE_SIZE,
            sim.playerY * TILE_SIZE - 42,
            `Minum/Makan ${heldDef.name}!`,
            '#4ADE80'
          );
          saveToStorage();
          syncHud();
          return;
        }
        if (rt.activeInteract) {
          triggerInteractionZone(rt.activeInteract);
        }
        return;
      }

      const map = SCENE_MAPS[sim.scene];
      if (targetTx < 0 || targetTy < 0 || targetTx >= map.width || targetTy >= map.height) return;

      const dist = Math.hypot(targetTx + 0.5 - sim.playerX, targetTy + 0.5 - sim.playerY);
      if (dist > 2.5) {
        showToast('Terlalu jauh! Klik petak atau objek untuk berjalan mendekat.');
        return;
      }

      rt.facingDir = getFacingFromDelta(targetTx + 0.5 - sim.playerX, targetTy + 0.5 - sim.playerY);
      const triggerAction = (kind: PlayerActionKind) => {
        rt.actionKind = kind;
        rt.actionProgress = 0.01;
      };

      const selectedSlot = sim.inventory[sim.hotbarSelected];
      const itemDef = selectedSlot ? ITEMS[selectedSlot.itemId] : null;

      // Check world object at tile
      const objIdx = sim.worldObjects.findIndex(
        (o) => o.scene === sim.scene && o.tx === targetTx && o.ty === targetTy
      );
      const obj = objIdx >= 0 ? sim.worldObjects[objIdx] : null;

      // 1. Forageable pickup (works with any slot!)
      if (obj && obj.kind === 'FORAGE' && obj.itemId) {
        const fItem = ITEMS[obj.itemId];
        const dropQty = obj.quantity ?? 1;
        const nextInv = tryAddInventoryItem(sim.inventory, obj.itemId, dropQty, sim.bagLevel);
        if (!nextInv) {
          soundEngine.playError();
          showToast('Tas penuh! Jual barang di PC atau upgrade slot Tas.');
          return;
        }
        triggerAction('HARVEST');
        sim.inventory = nextInv;
        sim.worldObjects.splice(objIdx, 1);
        sim.stats.mood = Math.min(100, sim.stats.mood + 3);
        soundEngine.playHarvest();
        spawnBurst(targetTx * TILE_SIZE + 24, targetTy * TILE_SIZE + 24, '#FDE047', 10, 'SPARKLE');
        spawnParticleText(
          targetTx * TILE_SIZE + 24,
          targetTy * TILE_SIZE,
          `+${dropQty} ${fItem?.name ?? 'Hasil Hutan'}`,
          '#FDE047'
        );
        syncHud();
        return;
      }

      // 2. Perennial Fruit Tree harvest in Kebun Atas / Hutan Kalabas
      if (obj && obj.kind === 'FRUIT_TREE') {
        if (obj.harvestReady && obj.itemId) {
          const fItem = ITEMS[obj.itemId];
          const harvestQty = 1;
          const nextInv = tryAddInventoryItem(sim.inventory, obj.itemId, harvestQty, sim.bagLevel);
          if (!nextInv) {
            soundEngine.playError();
            showToast('Tas penuh! Jual barang di PC atau upgrade slot Tas.');
            return;
          }
          triggerAction('HARVEST');
          sim.inventory = nextInv;
          obj.harvestReady = false;
          obj.regrowTimer = 0;
          sim.stats.mood = Math.min(100, sim.stats.mood + 5);
          soundEngine.playHarvest();
          spawnBurst(targetTx * TILE_SIZE + 24, targetTy * TILE_SIZE + 18, '#FACC15', 14, 'SPARKLE');
          spawnParticleText(
            targetTx * TILE_SIZE + 24,
            targetTy * TILE_SIZE,
            `+${harvestQty} ${fItem?.name ?? 'Buah'}`,
            '#FACC15'
          );
          syncHud();
        } else if (obj.itemId === 'buah_kalabas') {
          showToast('Pohon Kalabas hanya berbuah separo secara acak tiap 3 hari sekali.');
        } else {
          showToast(`${obj.label ?? 'Pohon Buah'} sedang menumbuhkan buah baru (2 hari).`);
        }
        return;
      }

      const plotKey = `${sim.scene}:${targetTx}:${targetTy}`;
      const existingPlot = sim.plots[plotKey];

      // 3. Harvest mature crop easily when clicking/acting on ready crop (unless holding Hoe/Axe)
      if (
        existingPlot &&
        existingPlot.cropId &&
        existingPlot.readyToHarvest &&
        itemDef?.toolKind !== 'AXE'
      ) {
        const crop = CROPS[existingPlot.cropId];
        if (crop) {
          const yieldQty = existingPlot.fertilized || sim.scene === 'ORCHARD' ? 2 : 1;
          const nextInv = tryAddInventoryItem(sim.inventory, crop.harvestId, yieldQty, sim.bagLevel);
          if (!nextInv) {
            soundEngine.playError();
            showToast('Tas penuh! Jual barang di PC atau upgrade slot Tas.');
            return;
          }
          triggerAction('HARVEST');
          sim.inventory = nextInv;
          sim.totalHarvested += yieldQty;
          sim.stats.mood = Math.min(100, sim.stats.mood + 4);
          if (crop.regrowDays) {
            existingPlot.readyToHarvest = false;
            existingPlot.growthProgress = Math.max(0, crop.growthDays - crop.regrowDays);
          } else {
            existingPlot.cropId = null;
            existingPlot.growthProgress = 0;
            existingPlot.readyToHarvest = false;
            existingPlot.fertilized = false;
          }
          soundEngine.playHarvest();
          spawnBurst(targetTx * TILE_SIZE + 24, targetTy * TILE_SIZE + 20, crop.colors.fruit, 12, 'SPARKLE');
          spawnParticleText(targetTx * TILE_SIZE + 24, targetTy * TILE_SIZE, `+${yieldQty} ${crop.name}`, '#4ADE80');
          syncHud();
          return;
        }
      }

      // 4. Water refill if clicking/acting on Water or Well
      const targetTileKind = map.tiles[targetTy][targetTx];
      if (targetTileKind === 'WELL' || targetTileKind === 'WATER' || targetTileKind === 'RIVER_WATER') {
        const maxCharges = sim.upgrades.bigWateringCan ? 45 : 20;
        sim.wateringCanCharges = maxCharges;
        triggerAction('WATER');
        soundEngine.playWater();
        spawnBurst(targetTx * TILE_SIZE + 24, targetTy * TILE_SIZE + 24, '#38BDF8', 10, 'WATER');
        showToast(`Ember Siram diisi penuh (${maxCharges}/${maxCharges})!`);
        syncHud();
        return;
      }

      if (!itemDef) return;

      const getSealedOrchardSide = (tx: number, tk: string): 'LEFT' | 'RIGHT' | null => {
        if (sim.scene !== 'ORCHARD' || tk !== 'VOLCANIC_ZONE') return null;
        if (tx <= 12 && !sim.upgrades.orchardLeftDeed) return 'LEFT';
        if (tx >= 15 && !sim.upgrades.orchardRightDeed) return 'RIGHT';
        return null;
      };

      const sealedMessage = (side: 'LEFT' | 'RIGHT') =>
        side === 'LEFT'
          ? `Kebun Atas sebelah kiri jalan masih tersegel! Beli di PC (Syarat: Min. Lv.${ORCHARD_PLOT_MIN_LEVEL}, Harga ${ORCHARD_LEFT_PRICE.toLocaleString('id-ID')} EG).`
          : `Kebun Atas sebelah kanan jalan masih tersegel! Beli di PC (Syarat: Min. Lv.${ORCHARD_PLOT_MIN_LEVEL}, Harga ${ORCHARD_RIGHT_PRICE.toLocaleString('id-ID')} EG).`;

      // 5. Tool Actions
      if (itemDef.toolKind === 'HOE') {
        triggerAction('HOE');
        const [stepDx, stepDy] = getFacingStep(rt.facingDir);
        const targets: [number, number][] = [[targetTx, targetTy]];
        if (sim.upgrades.steelHoe) {
          targets.push([targetTx + stepDx, targetTy + stepDy], [targetTx + stepDx * 2, targetTy + stepDy * 2]);
        }
        let tilledAny = false;
        let hitSealedSide: 'LEFT' | 'RIGHT' | null = null;
        for (const [tx, ty] of targets) {
          if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) continue;
          const tk = map.tiles[ty][tx];
          if (tk !== 'FARM_ZONE' && tk !== 'VOLCANIC_ZONE') continue;
          const sealedSide = getSealedOrchardSide(tx, tk);
          if (sealedSide) {
            if (!hitSealedSide) hitSealedSide = sealedSide;
            continue;
          }
          const hasObj = sim.worldObjects.some((o) => o.scene === sim.scene && o.tx === tx && o.ty === ty);
          if (hasObj) continue;
          const k = `${sim.scene}:${tx}:${ty}`;
          if (!sim.plots[k]?.tilled) {
            sim.plots[k] = {
              key: k,
              scene: sim.scene as 'FARM' | 'ORCHARD',
              tx,
              ty,
              tilled: true,
              watered: WEATHER_LABELS[sim.weather].watersCrops,
              fertilized: false,
              dryDays: 0,
              cropId: null,
              growthProgress: 0,
              readyToHarvest: false,
              wilted: false,
            };
            tilledAny = true;
            spawnBurst(tx * TILE_SIZE + 24, ty * TILE_SIZE + 24, '#92400E', 7, 'DUST');
          }
        }
        if (tilledAny) {
          sim.stats.health = Math.max(5, sim.stats.health - (sim.upgrades.steelHoe ? 1 : 2));
          soundEngine.playHoe();
          syncHud();
        } else if (hitSealedSide) {
          soundEngine.playError();
          showToast(sealedMessage(hitSealedSide));
        } else {
          showToast('Cangkul hanya dapat digunakan pada petak lahan kebun kosong.');
        }
        return;
      }

      if (itemDef.toolKind === 'WATERING_CAN') {
        if (sim.wateringCanCharges <= 0) {
          soundEngine.playError();
          showToast('Air di Ember Siram habis! Klik Sumur atau Sungai Hutan untuk mengisi.');
          return;
        }
        triggerAction('WATER');
        const [stepDx, stepDy] = getFacingStep(rt.facingDir);
        const targets: [number, number][] = [[targetTx, targetTy]];
        if (sim.upgrades.bigWateringCan) {
          targets.push([targetTx + stepDx, targetTy + stepDy], [targetTx + stepDx * 2, targetTy + stepDy * 2]);
        }
        let wateredAny = false;
        for (const [tx, ty] of targets) {
          if (sim.wateringCanCharges <= 0) break;
          const k = `${sim.scene}:${tx}:${ty}`;
          const pl = sim.plots[k];
          if (pl && pl.tilled) {
            pl.watered = true;
            pl.dryDays = 0;
            wateredAny = true;
            sim.wateringCanCharges = Math.max(0, sim.wateringCanCharges - 1);
            spawnBurst(tx * TILE_SIZE + 24, ty * TILE_SIZE + 24, '#38BDF8', 8, 'WATER');
          }
        }
        if (wateredAny) {
          sim.stats.health = Math.max(5, sim.stats.health - 1);
          soundEngine.playWater();
          syncHud();
        } else {
          showToast('Siramkan pada tanah yang sudah dicangkul.');
        }
        return;
      }

      if (itemDef.toolKind === 'AXE') {
        triggerAction('AXE');
        if (obj && (obj.kind === 'TREE' || obj.kind === 'TWIG' || obj.kind === 'ROCK')) {
          obj.hp -= 1;
          sim.stats.health = Math.max(5, sim.stats.health - 2.5);
          rt.shakeAmount = 5;
          rt.hitstopTimer = 0.045;
          soundEngine.playChop();
          spawnBurst(targetTx * TILE_SIZE + 24, targetTy * TILE_SIZE + 24, '#B45309', 8, 'DUST');
          if (obj.hp <= 0) {
            const dropId = obj.kind === 'ROCK' ? 'batu_alam' : 'kayu_hutan';
            const dropQty =
              obj.kind === 'TREE'
                ? 3 + Math.floor(Math.random() * 2)
                : obj.kind === 'TWIG'
                ? 1
                : 2;
            const nextInv = tryAddInventoryItem(sim.inventory, dropId, dropQty, sim.bagLevel);
            if (!nextInv) {
              obj.hp = 1;
              soundEngine.playError();
              showToast('Tas penuh! Jual barang di PC atau upgrade slot Tas.');
              syncHud();
              return;
            }
            sim.inventory = nextInv;
            sim.worldObjects.splice(objIdx, 1);
            if (obj.kind === 'TREE') {
              spawnParticleText(targetTx * TILE_SIZE + 24, targetTy * TILE_SIZE, `+${dropQty} Kayu Hutan`, '#FDE68A');
            } else if (obj.kind === 'TWIG') {
              spawnParticleText(targetTx * TILE_SIZE + 24, targetTy * TILE_SIZE, '+1 Kayu', '#FDE68A');
            } else {
              spawnParticleText(targetTx * TILE_SIZE + 24, targetTy * TILE_SIZE, '+2 Batu Alam', '#CBD5E1');
            }
          }
          syncHud();
        } else {
          showToast('Gunakan Kapak pada pohon, ranting, atau batu.');
        }
        return;
      }

      if (itemDef.toolKind === 'SCYTHE') {
        triggerAction('SCYTHE');
        if (obj && obj.kind === 'WEED') {
          sim.worldObjects.splice(objIdx, 1);
          soundEngine.playChop();
          spawnBurst(targetTx * TILE_SIZE + 24, targetTy * TILE_SIZE + 24, '#22C55E', 7, 'DUST');
          syncHud();
        } else if (existingPlot && existingPlot.wilted) {
          existingPlot.cropId = null;
          existingPlot.wilted = false;
          existingPlot.growthProgress = 0;
          existingPlot.readyToHarvest = false;
          soundEngine.playChop();
          showToast('Tanaman layu dibersihkan.');
          syncHud();
        }
        return;
      }

      // 6. Seed Planting
      if (itemDef.category === 'SEED' && itemDef.cropId) {
        const sealedSide = getSealedOrchardSide(targetTx, targetTileKind);
        if (sealedSide) {
          soundEngine.playError();
          showToast(sealedMessage(sealedSide));
          return;
        }
        const crop = CROPS[itemDef.cropId];
        if (!crop) return;
        if (crop.season !== sim.season) {
          soundEngine.playError();
          showToast(`${crop.name} hanya tumbuh di musim ${SEASONS[crop.season].name}! Sekarang musim ${SEASONS[sim.season].name}.`);
          return;
        }
        if (!existingPlot || !existingPlot.tilled) {
          soundEngine.playError();
          showToast('Cangkul tanah terlebih dahulu sebelum menanam bibit!');
          return;
        }
        if (existingPlot.cropId) {
          showToast('Petak tanah ini sudah terisi tanaman.');
          return;
        }
        triggerAction('PLANT');
        existingPlot.cropId = crop.id;
        existingPlot.growthProgress = 0;
        existingPlot.readyToHarvest = false;
        existingPlot.wilted = false;
        existingPlot.dryDays = 0;
        sim.inventory = removeInventoryItem(sim.inventory, itemDef.id, 1);
        soundEngine.playPlant();
        spawnBurst(targetTx * TILE_SIZE + 24, targetTy * TILE_SIZE + 24, '#84CC16', 6, 'DUST');
        syncHud();
        return;
      }

      // 7. Fertilizer or Consumable
      if (itemDef.id === 'pupuk_kompos') {
        const sealedSide = getSealedOrchardSide(targetTx, targetTileKind);
        if (sealedSide) {
          soundEngine.playError();
          showToast(sealedMessage(sealedSide));
          return;
        }
        if (!existingPlot || !existingPlot.tilled) {
          showToast('Taburkan Pupuk Organik pada tanah yang sudah dicangkul.');
          return;
        }
        if (existingPlot.fertilized) {
          showToast('Petak ini sudah diberi pupuk.');
          return;
        }
        triggerAction('PLANT');
        existingPlot.fertilized = true;
        sim.inventory = removeInventoryItem(sim.inventory, itemDef.id, 1);
        soundEngine.playPlant();
        spawnBurst(targetTx * TILE_SIZE + 24, targetTy * TILE_SIZE + 24, '#FBBF24', 8, 'SPARKLE');
        syncHud();
        return;
      }

      if (itemDef.id === 'buah_kalabas') {
        soundEngine.playError();
        showToast('Buah Kalabas tidak bisa dimakan!');
        return;
      }

      if (
        (itemDef.restoreHealth ?? 0) > 0 ||
        (itemDef.restoreMood ?? 0) > 0 ||
        (itemDef.boostSpeed ?? 0) > 0
      ) {
        triggerAction('CONSUME');
        sim.stats.health = Math.min(100, sim.stats.health + (itemDef.restoreHealth ?? 0));
        sim.stats.mood = Math.min(100, sim.stats.mood + (itemDef.restoreMood ?? 0));
        sim.stats.speed = Math.min(100, sim.stats.speed + (itemDef.boostSpeed ?? 0));
        sim.inventory = removeInventoryItem(sim.inventory, itemDef.id, 1);
        soundEngine.playEat();
        spawnParticleText(sim.playerX * TILE_SIZE, sim.playerY * TILE_SIZE - 42, `Minum/Makan ${itemDef.name}!`, '#4ADE80');
        syncHud();
        return;
      }

      // 8. Weapon swing/shot (if used near robot or open air)
      if (itemDef.category === 'WEAPON') {
        if (sim.scene === 'LAB' && !sim.robot.owned && !sim.robot.defeatedToday) {
          attackRobot();
        } else if (itemDef.weaponKind === 'RIFLE') {
          triggerAction('RIFLE');
          soundEngine.playGunshot();
        } else {
          triggerAction('SWORD');
          soundEngine.playSword();
        }
        return;
      }
    },
    [attackRobot, showToast, spawnBurst, spawnParticleText, syncHud, triggerInteractionZone]
  );

  // Keyboard Listeners (Separate held movement from edge-triggered actions + clear on blur)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();

      if (e.key === 'Escape') {
        if (phaseRef.current === 'PLAYING') {
          setPhase('PAUSED');
        } else if (
          phaseRef.current === 'PAUSED' ||
          phaseRef.current === 'PC_OPEN' ||
          phaseRef.current === 'BACKPACK_OPEN' ||
          phaseRef.current === 'CABINET_OPEN' ||
          phaseRef.current === 'KITCHEN_OPEN' ||
          phaseRef.current === 'FRIDGE_OPEN' ||
          phaseRef.current === 'SLEEP_CONFIRM' ||
          phaseRef.current === 'ROBOT_RECRUIT'
        ) {
          setPhase('PLAYING');
        }
        return;
      }

      if (phaseRef.current !== 'PLAYING' || runtimeRef.current.isBathing) return;

      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        runtimeRef.current.heldKeys.add(k);
        return;
      }

      if (e.repeat) return;

      if (k >= '1' && k <= '9') {
        const idx = parseInt(k, 10) - 1;
        simRef.current.hotbarSelected = idx;
        syncHud();
        return;
      }

      if (e.key === '=' || e.key === '+') {
        setZoom((prev) => {
          const idx = ZOOM_PRESETS.indexOf(prev as (typeof ZOOM_PRESETS)[number]);
          const next = idx >= 0 && idx < ZOOM_PRESETS.length - 1 ? ZOOM_PRESETS[idx + 1] : ZOOM_PRESETS[ZOOM_PRESETS.length - 1];
          runtimeRef.current.targetZoom = next;
          return next;
        });
        return;
      }

      if (e.key === '-' || e.key === '_') {
        setZoom((prev) => {
          const idx = ZOOM_PRESETS.indexOf(prev as (typeof ZOOM_PRESETS)[number]);
          const next = idx > 0 ? ZOOM_PRESETS[idx - 1] : ZOOM_PRESETS[0];
          runtimeRef.current.targetZoom = next;
          return next;
        });
        return;
      }

      if (k === '0') {
        runtimeRef.current.targetZoom = 1;
        setZoom(1);
        return;
      }

      if (k === 'i' || k === 'b') {
        setPhase('BACKPACK_OPEN');
        return;
      }

      if (k === 'e') {
        if (runtimeRef.current.activeInteract) {
          triggerInteractionZone(runtimeRef.current.activeInteract);
        } else {
          const sim = simRef.current;
          const rt = runtimeRef.current;
          const rDist = Math.hypot(rt.robotX - sim.playerX, rt.robotY - sim.playerY);
          const sel = sim.inventory[sim.hotbarSelected];
          const selDef = sel ? ITEMS[sel.itemId] : null;
          if (
            sim.scene === 'LAB' &&
            !sim.robot.owned &&
            !sim.robot.defeatedToday &&
            ((selDef?.weaponKind === 'RIFLE' && rDist <= 11.5) || rDist <= 2.75)
          ) {
            attackRobot();
            return;
          }
          if (
            (sim.scene === 'FOREST' || sim.scene === 'RIVER') &&
            rt.riverFish.some((f) => Math.hypot(f.x - sim.playerX, f.y - sim.playerY) <= 3.0)
          ) {
            catchRiverFish();
            return;
          }
          const [dx, dy] = getFacingStep(rt.facingDir);
          const tx = Math.floor(sim.playerX + dx * 0.85);
          const ty = Math.floor(sim.playerY + dy * 0.85);
          performTileAction(tx, ty);
        }
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        const sim = simRef.current;
        const rt = runtimeRef.current;
        if (sim.scene === 'PEAK' && rt.activeInteract?.id === 'MYSTERIOUS_CAVE') {
          triggerInteractionZone(rt.activeInteract);
          return;
        }
        const rDist = Math.hypot(rt.robotX - sim.playerX, rt.robotY - sim.playerY);
        const sel = sim.inventory[sim.hotbarSelected];
        const selDef = sel ? ITEMS[sel.itemId] : null;
        if (
          sim.scene === 'LAB' &&
          !sim.robot.owned &&
          !sim.robot.defeatedToday &&
          ((selDef?.weaponKind === 'RIFLE' && rDist <= 11.5) || rDist <= 2.75)
        ) {
          attackRobot();
          return;
        }
        if (
          (sim.scene === 'FOREST' || sim.scene === 'RIVER') &&
          rt.riverFish.some((f) => Math.hypot(f.x - sim.playerX, f.y - sim.playerY) <= 3.0)
        ) {
          catchRiverFish();
          return;
        }
        const [dx, dy] = getFacingStep(rt.facingDir);
        const tx = Math.floor(sim.playerX + dx * 0.85);
        const ty = Math.floor(sim.playerY + dy * 0.85);
        performTileAction(tx, ty);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      runtimeRef.current.heldKeys.delete(e.key.toLowerCase());
    };

    const onBlur = () => {
      runtimeRef.current.heldKeys.clear();
      runtimeRef.current.pointerDrag.active = false;
      runtimeRef.current.pointerDrag.dragging = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [attackRobot, catchRiverFish, performTileAction, syncHud, triggerInteractionZone]);

  // Isolated 60fps Game Loop (Canvas never re-renders React on frame ticks)
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const tick = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      const sim = simRef.current;
      const rt = runtimeRef.current;
      const currentPhase = phaseRef.current;

      rt.elapsedTime += dt;

      if (currentPhase === 'TITLE_MENU') {
        // Gentle live-world scenic camera pan on Title Screen
        const map = SCENE_MAPS['FARM'];
        const worldW = map.width * TILE_SIZE;
        const worldH = map.height * TILE_SIZE;
        const viewW = window.innerWidth;
        const viewH = window.innerHeight;
        const targetCx = worldW / 2 + Math.sin(rt.elapsedTime * 0.18) * Math.max(80, worldW / 2 - viewW / 2);
        const targetCy = worldH / 2 + Math.cos(rt.elapsedTime * 0.14) * 60;
        rt.cameraX = targetCx;
        rt.cameraY = targetCy;
      } else if (currentPhase === 'PLAYING') {
        if (rt.isBathing) {
          const BATH_DURATION = 2.4;
          rt.bathTimer += dt;
          const p = Math.min(1, rt.bathTimer / BATH_DURATION);
          sim.timeMinutes = rt.bathStartTime + 60 * p;
          sim.stats.health = Math.min(100, rt.bathStartHealth + 20 * p);
          sim.stats.mood = Math.min(100, rt.bathStartMood + 15 * p);
          sim.stats.speed = Math.min(100, rt.bathStartSpeed + 10 * p);
          rt.isMoving = false;

          if (Math.random() < dt * 7) {
            rt.particles.push({
              x: (5.0 + (Math.random() - 0.5) * 3.2) * TILE_SIZE,
              y: (7.5 + (Math.random() - 0.5) * 1.4) * TILE_SIZE,
              vx: (Math.random() - 0.5) * 10,
              vy: -18 - Math.random() * 14,
              life: 0.9,
              maxLife: 0.9,
              size: 4.2,
              color: 'rgba(224, 242, 254, 0.85)',
              kind: 'WATER',
            });
          }

          if (rt.bathTimer >= BATH_DURATION) {
            rt.isBathing = false;
            rt.bathTimer = 0;
            sim.timeMinutes = Math.min(DAY_MAX_MINUTES - 1, rt.bathStartTime + 60);
            sim.stats.health = Math.min(100, rt.bathStartHealth + 20);
            sim.stats.mood = Math.min(100, rt.bathStartMood + 15);
            sim.stats.speed = Math.min(100, rt.bathStartSpeed + 10);
            sim.playerX = 5.0;
            sim.playerY = 10.6;
            rt.facingDir = 'DOWN';
            soundEngine.playHarvest();
            spawnParticleText(5.0 * TILE_SIZE, 7.2 * TILE_SIZE, '+20 Health  +15 Mood  +10 Speed', '#38BDF8');
            showToast('Selesai mandi berendam (1 jam): +20 Health, +15 Mood, +10 Speed!');
            saveToStorage();
            syncHud();
          }
        } else if (rt.hitstopTimer > 0) {
          rt.hitstopTimer = Math.max(0, rt.hitstopTimer - dt);
        } else {
          // 1. Time progression (1 day = 9 real minutes)
          sim.timeMinutes += dt * GAME_MINUTES_PER_REAL_SEC;
          if (sim.timeMinutes >= DAY_MAX_MINUTES) {
            endDayAndSleep(true);
          }

          // Weather effect on Mood/Speed outdoors in Heavy Rain without Rain Boots
          if (sim.scene !== 'HOUSE' && sim.weather === 'HUJAN_DERAS' && !sim.upgrades.rainBoots) {
            sim.stats.mood = Math.max(10, sim.stats.mood - dt * 0.45);
            sim.stats.speed = Math.max(30, sim.stats.speed - dt * 0.35);
          }

          // Collapse if Health reaches 0
          if (sim.stats.health <= 0) {
            endDayAndSleep(true);
          }

          // 2. Movement with Speed stat scaling (Mouse/Touch Drag, Click-to-Move Pathfinding, or optional Keyboard)
          let mx = 0;
          let my = 0;
          if (rt.heldKeys.has('w') || rt.heldKeys.has('arrowup')) my -= 1;
          if (rt.heldKeys.has('s') || rt.heldKeys.has('arrowdown')) my += 1;
          if (rt.heldKeys.has('a') || rt.heldKeys.has('arrowleft')) mx -= 1;
          if (rt.heldKeys.has('d') || rt.heldKeys.has('arrowright')) mx += 1;

          const speedFactor = 0.72 + 0.55 * (sim.stats.speed / 100);
          const moveTilesPerSec = 4.4 * speedFactor;

          const map = SCENE_MAPS[sim.scene];
          const hasRobotBody =
            (sim.scene === 'LAB' && !sim.robot.owned) ||
            (sim.scene === 'FARM' && sim.robot.owned);
          const canStand = (nx: number, ny: number) => {
            const r = 0.28;
            const corners = [
              [nx - r, ny - r],
              [nx + r, ny - r],
              [nx - r, ny + r],
              [nx + r, ny + r],
            ];
            for (const [cx, cy] of corners) {
              const tx = Math.floor(cx);
              const ty = Math.floor(cy);
              if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return false;
              if (isTileSolid(map.tiles[ty][tx], sim.upgrades.orchardDeed, sim.upgrades.peakGateOpened)) return false;
              const blockingObj = sim.worldObjects.some(
                (o) =>
                  o.scene === sim.scene &&
                  o.tx === tx &&
                  o.ty === ty &&
                  (o.kind === 'TREE' || o.kind === 'FRUIT_TREE' || o.kind === 'ROCK')
              );
              if (blockingObj) return false;
            }
            if (hasRobotBody) {
              const rx = 0.86;
              const ry = 0.34;
              const nextNorm = Math.hypot((nx - rt.robotX) / rx, (ny - rt.robotY) / ry);
              const curNorm = Math.hypot((sim.playerX - rt.robotX) / rx, (sim.playerY - rt.robotY) / ry);
              if (nextNorm < 1 && nextNorm < curNorm) return false;
            }
            return true;
          };

          const actionLocked = rt.actionKind !== 'NONE' && rt.actionProgress > 0 && rt.actionProgress < 0.56;

          if (mx !== 0 || my !== 0) {
            // Optional keyboard cancels click path
            rt.pathQueue = [];
            rt.moveTarget = null;
            rt.pendingAction = null;
          } else if (!actionLocked && rt.pointerDrag.active && rt.pointerDrag.dragging) {
            // Hold & drag mouse/touch steers continuously toward pointer
            const zoomNow = rt.renderZoom || 1;
            const worldX = ((rt.pointerDrag.curClientX - window.innerWidth / 2) / zoomNow + rt.cameraX) / TILE_SIZE;
            const worldY = ((rt.pointerDrag.curClientY - window.innerHeight / 2) / zoomNow + rt.cameraY) / TILE_SIZE;
            const dx = worldX - sim.playerX;
            const dy = worldY - sim.playerY;
            if (Math.hypot(dx, dy) > 0.22) {
              mx = dx;
              my = dy;
            }
          } else if (!actionLocked && rt.pathQueue.length > 0) {
            const nextWp = rt.pathQueue[0];
            const dx = nextWp.x - sim.playerX;
            const dy = nextWp.y - sim.playerY;
            const d = Math.hypot(dx, dy);
            const maxStep = moveTilesPerSec * dt;
            if (d <= maxStep + 0.05) {
              if (canStand(nextWp.x, nextWp.y)) {
                sim.playerX = nextWp.x;
                sim.playerY = nextWp.y;
              }
              rt.facingDir = getFacingFromDelta(dx, dy);
              rt.pathQueue.shift();
              if (rt.pathQueue.length === 0) {
                rt.moveTarget = null;
                if (rt.pendingAction) {
                  const act = rt.pendingAction;
                  rt.pendingAction = null;
                  rt.facingDir = getFacingFromDelta(act.tx + 0.5 - sim.playerX, act.ty + 0.5 - sim.playerY);
                  if (act.kind === 'PC') setPhase('PC_OPEN');
                  else if (act.kind === 'BED') setPhase('SLEEP_CONFIRM');
                  else if (act.kind === 'BATH') startBathSoak();
                  else if (act.kind === 'WC') handleUseWc();
                  else if (act.kind === 'KITCHEN') setPhase('KITCHEN_OPEN');
                  else if (act.kind === 'FRIDGE') setPhase('FRIDGE_OPEN');
                  else if (act.kind === 'CABINET') setPhase('CABINET_OPEN');
                  else if (act.kind === 'GATE_SIGN') {
                    const signZone = SCENE_MAPS.FARM.interactZones.find((z) => z.id === 'GATE_SIGN');
                    if (signZone) triggerInteractionZone(signZone);
                  } else if (act.kind === 'MYSTERIOUS_CAVE') {
                    const caveZone = SCENE_MAPS.PEAK.interactZones.find((z) => z.id === 'MYSTERIOUS_CAVE');
                    if (caveZone) triggerInteractionZone(caveZone);
                  } else {
                    performTileAction(act.tx, act.ty);
                  }
                }
              }
              rt.isMoving = true;
              rt.walkCycle += dt;
            } else {
              mx = dx;
              my = dy;
            }
          }

          if (!actionLocked && (mx !== 0 || my !== 0)) {
            const len = Math.hypot(mx, my);
            mx /= len;
            my /= len;
            rt.facingDir = getFacingFromDelta(mx, my);
            rt.isMoving = true;
            rt.walkCycle += dt;
            if (rt.actionKind !== 'NONE' && rt.actionProgress >= 0.56) {
              rt.actionKind = 'NONE';
              rt.actionProgress = 0;
            }

            const stepX = mx * moveTilesPerSec * dt;
            const stepY = my * moveTilesPerSec * dt;

            if (canStand(sim.playerX + stepX, sim.playerY)) sim.playerX += stepX;
            if (canStand(sim.playerX, sim.playerY + stepY)) sim.playerY += stepY;
          } else if (actionLocked || rt.pathQueue.length === 0) {
            rt.isMoving = false;
          }

          // 3. Portals & Interactive Zones
          if (rt.portalCooldown > 0) {
            rt.portalCooldown = Math.max(0, rt.portalCooldown - dt);
          } else {
            const map = SCENE_MAPS[sim.scene];
            for (const portal of map.portals) {
              if (
                sim.playerX >= portal.x1 &&
                sim.playerX <= portal.x2 &&
                sim.playerY >= portal.y1 &&
                sim.playerY <= portal.y2
              ) {
                if (portal.requiresOrchardDeed && !sim.upgrades.orchardDeed) {
                  showToast('Kebun Atas terkunci! Kumpulkan 1.000.000 EG dan beli sertifikat lewat PC di rumah.');
                  sim.playerY += 0.35;
                } else if (portal.requiresRobot && !sim.robot.owned) {
                  soundEngine.playError();
                  showToast('Puncak Gunung belum bisa diakses! Miliki Robot Mecha terlebih dahulu untuk mendaki.');
                  sim.playerX = portal.x1 - 0.55;
                  rt.pathQueue = [];
                  rt.moveTarget = null;
                } else {
                  handleSceneChange(portal.targetScene, portal.spawnX, portal.spawnY, portal.label);
                }
                break;
              }
            }
          }

          // Check nearby interact zones
          const curMap = SCENE_MAPS[sim.scene];
          let foundZone: InteractZone | null = null;
          for (const z of curMap.interactZones) {
            if (sim.playerX >= z.x1 && sim.playerX <= z.x2 && sim.playerY >= z.y1 && sim.playerY <= z.y2) {
              foundZone = z;
              break;
            }
          }
          if (foundZone?.id !== rt.activeInteract?.id) {
            rt.activeInteract = foundZone;
            setContextPrompt(foundZone ? foundZone.prompt : null);
          }
        }

        // Smooth zoom interpolation
        if (Math.abs(rt.targetZoom - rt.renderZoom) > 0.002) {
          rt.renderZoom += (rt.targetZoom - rt.renderZoom) * Math.min(1, dt * 14);
        } else {
          rt.renderZoom = rt.targetZoom;
        }

        // Camera smooth follow clamped to map (scaled by active zoom)
        const map = SCENE_MAPS[sim.scene];
        const worldW = map.width * TILE_SIZE;
        const worldH = map.height * TILE_SIZE;
        const activeZoom = rt.renderZoom || 1;
        const vw = window.innerWidth / activeZoom;
        const vh = window.innerHeight / activeZoom;
        let targetX = sim.playerX * TILE_SIZE;
        let targetY = sim.playerY * TILE_SIZE;
        if (worldW > vw) targetX = Math.max(vw / 2, Math.min(worldW - vw / 2, targetX));
        else targetX = worldW / 2;
        if (worldH > vh) targetY = Math.max(vh / 2, Math.min(worldH - vh / 2, targetY));
        else targetY = worldH / 2;

        rt.cameraX += (targetX - rt.cameraX) * Math.min(1, dt * 10);
        rt.cameraY += (targetY - rt.cameraY) * Math.min(1, dt * 10);

        // Ambient dusk fireflies & gentle wind-blown leaves outdoors
        if (sim.scene !== 'HOUSE' && sim.timeMinutes >= 1020 && Math.random() < dt * 3) {
          rt.particles.push({
            x: (sim.playerX + (Math.random() - 0.5) * 14) * TILE_SIZE,
            y: (sim.playerY + (Math.random() - 0.5) * 10) * TILE_SIZE,
            vx: (Math.random() - 0.5) * 16,
            vy: -8 - Math.random() * 12,
            life: 2.2,
            maxLife: 2.2,
            size: 2.4,
            color: '#BEF264',
            kind: 'FIREFLY',
          });
        } else if (
          (sim.scene === 'FARM' || sim.scene === 'FOREST' || sim.scene === 'ORCHARD') &&
          sim.timeMinutes < 1050 &&
          Math.random() < dt * 1.4
        ) {
          const leafColors = sim.season === 'KEMARAU' ? ['#D97706', '#84CC16', '#A16207'] : ['#22C55E', '#4ADE80', '#84CC16'];
          rt.particles.push({
            x: (sim.playerX - 7 + Math.random() * 14) * TILE_SIZE,
            y: (sim.playerY - 6 + Math.random() * 6) * TILE_SIZE,
            vx: 14 + Math.random() * 18,
            vy: 14 + Math.random() * 12,
            life: 2.6,
            maxLife: 2.6,
            size: 3.1 + Math.random() * 1.4,
            color: leafColors[Math.floor(Math.random() * leafColors.length)],
            kind: 'LEAF',
          });
        }

        // Robot AI & Combat Projectiles in Lab Penelitian / Owned Robot in Kebun Utama
        if (rt.robotHitFlash > 0) rt.robotHitFlash = Math.max(0, rt.robotHitFlash - dt);
        if (rt.robotAttackAnim > 0) rt.robotAttackAnim = Math.max(0, rt.robotAttackAnim - dt * 2.5);
        if (rt.robotAttackCd > 0) rt.robotAttackCd = Math.max(0, rt.robotAttackCd - dt);
        if (rt.robotPlayerSwingCd > 0) rt.robotPlayerSwingCd = Math.max(0, rt.robotPlayerSwingCd - dt);

        if (sim.scene === 'LAB' && !sim.robot.owned && !sim.robot.defeatedToday) {
          const rDist = Math.hypot(sim.playerX - rt.robotX, sim.playerY - rt.robotY);
          if (sim.playerY < 13.5 && rDist < 7.2) {
            rt.robotAggro = true;
          }
          if (rt.robotAggro) {
            const labMap = SCENE_MAPS.LAB;
            const canRobotStand = (nx: number, ny: number) => {
              if (ny < 8.0) return false;
              const r = 0.45;
              const corners = [
                [nx - r, ny - r],
                [nx + r, ny - r],
                [nx - r, ny + r],
                [nx + r, ny + r],
              ];
              for (const [cx, cy] of corners) {
                const tx = Math.floor(cx);
                const ty = Math.floor(cy);
                if (tx < 1 || ty < 1 || tx >= labMap.width - 1 || ty >= labMap.height - 2) return false;
                if (isTileSolid(labMap.tiles[ty][tx], sim.upgrades.orchardDeed, sim.upgrades.peakGateOpened)) return false;
                const blocking = sim.worldObjects.some(
                  (o) =>
                    o.scene === 'LAB' &&
                    o.tx === tx &&
                    o.ty === ty &&
                    (o.kind === 'TREE' || o.kind === 'FRUIT_TREE' || o.kind === 'ROCK')
                );
                if (blocking) return false;
              }
              return true;
            };

            if (rDist > 1.95) {
              const dx = (sim.playerX - rt.robotX) / rDist;
              const dy = (sim.playerY - rt.robotY) / rDist;
              const step = 2.05 * dt;
              if (canRobotStand(rt.robotX + dx * step, rt.robotY)) rt.robotX += dx * step;
              if (canRobotStand(rt.robotX, rt.robotY + dy * step)) rt.robotY += dy * step;
            }

            if (rDist <= 2.3 && rt.robotAttackCd <= 0) {
              rt.robotAttackCd = 1.9;
              rt.robotAttackAnim = 1;
              rt.shakeAmount = 4;
              soundEngine.playRobotHit();
              sim.stats.health = Math.max(0, sim.stats.health - 8);
              spawnBurst(sim.playerX * TILE_SIZE, sim.playerY * TILE_SIZE - 18, '#EF4444', 8, 'DUST');
              spawnParticleText(sim.playerX * TILE_SIZE, sim.playerY * TILE_SIZE - 42, '-8 HP', '#F87171');
            } else if (rDist > 2.6 && rDist <= 8.4 && rt.robotAttackCd <= 0) {
              rt.robotAttackCd = 2.4;
              rt.robotAttackAnim = 1;
              const originX = rt.robotX;
              const originY = rt.robotY - 0.85;
              const pLen = Math.max(0.01, Math.hypot(sim.playerX - originX, sim.playerY - originY));
              const ux = (sim.playerX - originX) / pLen;
              const uy = (sim.playerY - originY) / pLen;
              rt.projectiles.push({
                x: originX + ux * 0.75,
                y: originY + uy * 0.75,
                vx: ux * 6.2,
                vy: uy * 6.2,
                fromPlayer: false,
                damage: 6,
                life: 1.5,
                color: '#D97706',
              });
            }
          } else {
            rt.robotX = 14.0 + Math.sin(rt.elapsedTime * 0.85) * 1.1;
            rt.robotY = 9.7 + Math.cos(rt.elapsedTime * 0.55) * 0.25;
          }
        } else if (sim.robot.owned && sim.scene === 'FARM') {
          rt.robotX = 14.2 + Math.sin(rt.elapsedTime * 0.65) * 0.9;
          rt.robotY = 7.4;
        } else if (sim.scene === 'PEAK' && sim.robot.owned) {
          const targetRx = Math.max(22.4, Math.min(26.4, sim.playerX + 0.9));
          const targetRy = Math.max(4.4, Math.min(18.2, sim.playerY + 0.35));
          const d = Math.hypot(targetRx - rt.robotX, targetRy - rt.robotY);
          if (d > 0.25) {
            const step = Math.min(d, 3.2 * dt);
            const nx = rt.robotX + ((targetRx - rt.robotX) / d) * step;
            const ny = rt.robotY + ((targetRy - rt.robotY) / d) * step;
            const ntx = Math.floor(nx);
            const nty = Math.floor(ny);
            const peakMap = SCENE_MAPS.PEAK;
            if (
              ntx >= 22 &&
              nty >= 4 &&
              ntx < peakMap.width - 1 &&
              nty < peakMap.height - 1 &&
              !isTileSolid(peakMap.tiles[nty][ntx], sim.upgrades.orchardDeed, sim.upgrades.peakGateOpened)
            ) {
              rt.robotX = nx;
              rt.robotY = ny;
            }
          }
        }

        if (rt.projectiles.length > 0) {
          const mapNow = SCENE_MAPS[sim.scene];
          const nextProjs: CombatProjectile[] = [];
          for (const pr of rt.projectiles) {
            pr.x += pr.vx * dt;
            pr.y += pr.vy * dt;
            pr.life -= dt;
            if (pr.life <= 0) continue;
            const ptx = Math.floor(pr.x);
            const pty = Math.floor(pr.y);
            if (ptx < 0 || pty < 0 || ptx >= mapNow.width || pty >= mapNow.height) continue;
            if (isTileSolid(mapNow.tiles[pty][ptx], sim.upgrades.orchardDeed, sim.upgrades.peakGateOpened)) {
              spawnBurst(pr.x * TILE_SIZE, pr.y * TILE_SIZE, pr.color, 5, 'SPARKLE');
              continue;
            }
            if (pr.fromPlayer && sim.scene === 'LAB' && !sim.robot.owned && !sim.robot.defeatedToday) {
              const hitsRobotBody =
                Math.abs(pr.x - rt.robotX) <= 1.6 &&
                pr.y >= rt.robotY - 3.1 &&
                pr.y <= rt.robotY + 0.55;
              if (hitsRobotBody) {
                rt.robotAggro = true;
                sim.robot.hp = Math.max(0, sim.robot.hp - pr.damage);
                rt.robotHitFlash = 0.25;
                rt.shakeAmount = 4;
                soundEngine.playRobotHit();
                spawnBurst(rt.robotX * TILE_SIZE, rt.robotY * TILE_SIZE - 85, '#F59E0B', 12, 'SPARKLE');
                spawnParticleText(rt.robotX * TILE_SIZE, rt.robotY * TILE_SIZE - 165, `-${pr.damage} HP`, '#F87171');
                if (sim.robot.hp <= 0) {
                  grantRobotVictoryReward();
                } else {
                  syncHud();
                }
                continue;
              }
            } else if (!pr.fromPlayer && sim.scene === 'LAB') {
              if (Math.hypot(pr.x - sim.playerX, pr.y - sim.playerY) <= 0.58) {
                sim.stats.health = Math.max(0, sim.stats.health - pr.damage);
                rt.shakeAmount = 3.5;
                soundEngine.playRobotHit();
                spawnBurst(sim.playerX * TILE_SIZE, sim.playerY * TILE_SIZE - 18, '#EF4444', 7, 'DUST');
                spawnParticleText(sim.playerX * TILE_SIZE, sim.playerY * TILE_SIZE - 42, `-${pr.damage} HP`, '#F87171');
                syncHud();
                continue;
              }
            }
            nextProjs.push(pr);
          }
          rt.projectiles = nextProjs;
        }

        // Flowing River Fish Spawning & Downstream Drift (Sungai Hutan — bisa dari jembatan atau turun ke sungai)
        const forestMap = SCENE_MAPS.FOREST;
        const fptx = Math.max(0, Math.min(forestMap.width - 1, Math.floor(sim.playerX)));
        const fpty = Math.max(0, Math.min(forestMap.height - 1, Math.floor(sim.playerY)));
        const forestTile = forestMap.tiles[fpty]?.[fptx];
        const standingAtFishingRiver =
          sim.scene === 'FOREST' && (forestTile === 'RIVER_WATER' || forestTile === 'WOOD_BRIDGE');

        if (sim.scene === 'FOREST') {
          if (standingAtFishingRiver) {
            rt.riverWaitTimer += dt;
            if (rt.riverWaitTimer >= 5.0) {
              rt.riverWaitTimer -= 5.0;
              const roll = Math.random();
              const fishKind: RiverFish['kind'] =
                roll < 0.54 ? 'ikan_wader' : roll < 0.87 ? 'ikan_lele' : 'ikan_tomang';
              const inBottomBend = sim.playerY >= 14.8 && sim.playerX < 20;
              const spawnX = inBottomBend
                ? Math.min(22.6, sim.playerX + 4.5)
                : Math.max(20.4, Math.min(23.35, sim.playerX + (Math.random() - 0.5) * 1.6));
              const spawnY = inBottomBend
                ? 15.55 + Math.random() * 2.85
                : Math.max(1.1, sim.playerY - 4.2);
              rt.riverFish.push({
                id: `fish_${Math.round(rt.elapsedTime * 1000)}_${Math.random().toString(36).slice(2, 6)}`,
                kind: fishKind,
                x: spawnX,
                y: spawnY,
                vx: inBottomBend ? -1.55 : 0,
                vy: inBottomBend ? 0 : 1.38 + Math.random() * 0.35,
              });
              if (rt.riverFish.length > 10) {
                rt.riverFish.shift();
              }
              soundEngine.playWater();
              spawnBurst(spawnX * TILE_SIZE, spawnY * TILE_SIZE, '#7DD3FC', 6, 'WATER');
            }
          } else {
            rt.riverWaitTimer = 0;
          }

          if (rt.riverFish.length > 0) {
            const nextFish: RiverFish[] = [];
            for (const f of rt.riverFish) {
              if (f.y < 15.45) {
                // Flowing downstream (+Y) in the main vertical river channel (x: 20..23), passing UNDER WOOD_BRIDGE
                const targetXDrift =
                  standingAtFishingRiver && sim.playerX >= 19.5 && sim.playerY < 15.2
                    ? Math.max(-0.55, Math.min(0.55, (sim.playerX - f.x) * 0.45))
                    : 0;
                f.vx = Math.sin(rt.elapsedTime * 2.4 + f.y * 0.9) * 0.32 + targetXDrift;
                f.vy = Math.max(1.25, f.vy || 1.45);
                f.x = Math.max(20.3, Math.min(23.4, f.x + f.vx * dt));
                f.y += f.vy * dt;
              } else {
                // At bottom bend: turn right-to-left (-X) along 2x widened y: 15..18 to connect seamlessly into Sungai Irigasi at Kebun Utama!
                f.vx = -1.65;
                f.vy = Math.sin(rt.elapsedTime * 2.4 + f.x * 0.9) * 0.24;
                f.x += f.vx * dt;
                f.y = Math.max(15.45, Math.min(18.55, f.y + f.vy * dt));
              }
              if (f.x >= -0.3 && f.y <= 18.85) {
                nextFish.push(f);
              }
            }
            rt.riverFish = nextFish;
          }
        }

        // Sync HUD every 0.45s for smooth clock & meters without 60fps React churn
        if (now - rt.lastHudSync > 450) {
          rt.lastHudSync = now;
          if (sim.scene === 'FOREST') {
            setRiverStatus({
              inRiver: standingAtFishingRiver,
              waitSec: rt.riverWaitTimer,
              nearbyCount: rt.riverFish.filter(
                (f) => Math.hypot(f.x - sim.playerX, f.y - sim.playerY) <= 3.0
              ).length,
            });
          }
          syncHud();
        }
      }

      // Action animation progression (paced naturally per action kind)
      if (rt.actionKind !== 'NONE' && rt.actionProgress > 0) {
        const rate =
          rt.actionKind === 'WATER'
            ? 2.3
            : rt.actionKind === 'CONSUME'
            ? 2.1
            : rt.actionKind === 'SCYTHE' || rt.actionKind === 'SWORD'
            ? 3.6
            : rt.actionKind === 'RIFLE'
            ? 3.8
            : rt.actionKind === 'PLANT' || rt.actionKind === 'HARVEST'
            ? 2.8
            : 2.9;
        rt.actionProgress += dt * rate;
        if (rt.actionProgress >= 1) {
          rt.actionProgress = 0;
          rt.actionKind = 'NONE';
        }
      }
      if (rt.shakeAmount > 0) {
        rt.shakeAmount = Math.max(0, rt.shakeAmount - dt * 28);
      }

      // Update particles with Newtonian gravity, aerodynamic flutter, & air drag
      rt.particles = rt.particles.filter((p) => {
        if (p.kind === 'WATER') {
          p.vy += 260 * dt;
          p.vx *= Math.max(0, 1 - dt * 1.2);
        } else if (p.kind === 'LEAF') {
          p.vx += Math.sin(rt.elapsedTime * 4.2 + p.y * 0.05) * 32 * dt;
          p.vy = Math.min(34, p.vy + 18 * dt);
        } else if (p.kind === 'FIREFLY') {
          p.vx += Math.sin(rt.elapsedTime * 3.1 + p.y * 0.04) * 14 * dt;
          p.vy += Math.cos(rt.elapsedTime * 2.6 + p.x * 0.04) * 10 * dt;
        } else if (p.kind === 'TEXT') {
          p.vx *= Math.max(0, 1 - dt * 3);
          p.vy *= Math.max(0, 1 - dt * 2.2);
        } else {
          // DUST & SPARKLE drag + gentle buoyant rise
          p.vx *= Math.max(0, 1 - dt * 2.4);
          p.vy = p.vy * Math.max(0, 1 - dt * 2.4) - 8 * dt;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        return p.life > 0;
      });

      // Render Canvas
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const selectedSlot = sim.inventory[sim.hotbarSelected];
        const showLabRobot = sim.scene === 'LAB' && !sim.robot.owned;
        const showFarmRobot = sim.scene === 'FARM' && sim.robot.owned;
        const showPeakRobot = sim.scene === 'PEAK' && sim.robot.owned;
        const curSceneMap = SCENE_MAPS[sim.scene];
        const ptx = Math.max(0, Math.min(curSceneMap.width - 1, Math.floor(sim.playerX)));
        const pty = Math.max(0, Math.min(curSceneMap.height - 1, Math.floor(sim.playerY)));
        const isWading = (sim.scene === 'FOREST' || sim.scene === 'RIVER') && curSceneMap.tiles[pty]?.[ptx] === 'RIVER_WATER';
        const robotParam =
          showLabRobot || showFarmRobot || showPeakRobot
            ? {
                x: rt.robotX,
                y: rt.robotY,
                hp: sim.robot.hp,
                maxHp: sim.robot.maxHp,
                owned: sim.robot.owned,
                defeatedToday: sim.robot.defeatedToday,
                inCombat: rt.robotAggro,
                hitFlash: Math.min(1, rt.robotHitFlash * 4),
                attackAnim: rt.robotAttackAnim,
                elapsedTime: rt.elapsedTime,
              }
            : null;
        renderGameWorld(ctx, window.innerWidth, window.innerHeight, {
          scene: sim.scene,
          season: sim.season,
          weather: sim.weather,
          timeMinutes: sim.timeMinutes,
          playerX: sim.playerX,
          playerY: sim.playerY,
          facingDir: rt.facingDir,
          isMoving: rt.isMoving,
          walkCycle: rt.walkCycle,
          actionKind: rt.actionKind,
          actionProgress: rt.actionProgress,
          isBathing: rt.isBathing,
          isWading,
          selectedItemId: selectedSlot?.itemId ?? '',
          hasSteelHoe: sim.upgrades.steelHoe,
          hasBigWateringCan: sim.upgrades.bigWateringCan,
          orchardUnlocked: sim.upgrades.orchardDeed,
          orchardLeftUnlocked: sim.upgrades.orchardLeftDeed,
          orchardRightUnlocked: sim.upgrades.orchardRightDeed,
          peakGateOpened: sim.upgrades.peakGateOpened,
          rainBoots: sim.upgrades.rainBoots,
          plots: sim.plots,
          worldObjects: sim.worldObjects,
          particles: rt.particles,
          hoveredTile: rt.hoveredTile,
          moveTarget: rt.moveTarget,
          cameraX: rt.cameraX,
          cameraY: rt.cameraY,
          zoom: currentPhase === 'TITLE_MENU' ? 1 : rt.renderZoom,
          shakeAmount: rt.shakeAmount,
          farmerSprite: rt.farmerSprite,
          elapsedTime: rt.elapsedTime,
          robot: robotParam,
          projectiles: sim.scene === 'LAB' ? rt.projectiles : [],
          riverFish: (sim.scene === 'FOREST' || sim.scene === 'RIVER') ? rt.riverFish : [],
        });
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [endDayAndSleep, grantRobotVictoryReward, handleSceneChange, performTileAction, saveToStorage, showToast, spawnBurst, spawnParticleText, startBathSoak, syncHud, triggerInteractionZone]);

  // Clear pathing, projectiles & river fish whenever changing scenes
  useEffect(() => {
    runtimeRef.current.pathQueue = [];
    runtimeRef.current.moveTarget = null;
    runtimeRef.current.pendingAction = null;
    runtimeRef.current.projectiles = [];
    runtimeRef.current.riverFish = [];
    runtimeRef.current.riverWaitTimer = 0;
    setRiverStatus({ inRiver: false, waitSec: 0, nearbyCount: 0 });
    if (hudState.scene === 'LAB') {
      runtimeRef.current.robotX = 14.0;
      runtimeRef.current.robotY = 9.7;
      runtimeRef.current.robotAggro = false;
    } else if (hudState.scene === 'FARM' && simRef.current.robot.owned) {
      runtimeRef.current.robotX = 14.2;
      runtimeRef.current.robotY = 7.4;
    } else if (hudState.scene === 'PEAK' && simRef.current.robot.owned) {
      runtimeRef.current.robotX = Math.max(22.5, Math.min(26.2, simRef.current.playerX + 0.9));
      runtimeRef.current.robotY = 12.2;
    }
  }, [hudState.scene]);

  // Canvas Mouse & Touch Controls (Zero-Keyboard Stardew-style Tap-to-Move + Hold-Drag)
  const screenToTile = (clientX: number, clientY: number) => {
    const rt = runtimeRef.current;
    const zoomNow = rt.renderZoom || 1;
    const worldX = (clientX - window.innerWidth / 2) / zoomNow + rt.cameraX;
    const worldY = (clientY - window.innerHeight / 2) / zoomNow + rt.cameraY;
    return {
      tx: Math.floor(worldX / TILE_SIZE),
      ty: Math.floor(worldY / TILE_SIZE),
      worldTileX: worldX / TILE_SIZE,
      worldTileY: worldY / TILE_SIZE,
    };
  };

  const handleTapOnWorld = (tx: number, ty: number, worldTileX = tx + 0.5, worldTileY = ty + 0.5) => {
    const sim = simRef.current;
    const rt = runtimeRef.current;
    if (rt.isBathing) return;
    const map = SCENE_MAPS[sim.scene];
    if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return;

    const tile = map.tiles[ty][tx];
    const dist = Math.hypot(tx + 0.5 - sim.playerX, ty + 0.5 - sim.playerY);
    const selectedSlot = sim.inventory[sim.hotbarSelected];
    const itemDef = selectedSlot ? ITEMS[selectedSlot.itemId] : null;

    // Clicking on the player while holding a consumable eats/drinks it (Kalabas is inedible)
    if (dist < 0.85 && itemDef?.id === 'buah_kalabas') {
      soundEngine.playError();
      showToast('Buah Kalabas tidak bisa dimakan!');
      return;
    }
    if (
      dist < 0.85 &&
      itemDef &&
      ((itemDef.restoreHealth ?? 0) > 0 ||
        (itemDef.restoreMood ?? 0) > 0 ||
        (itemDef.boostSpeed ?? 0) > 0)
    ) {
      performTileAction(tx, ty);
      return;
    }

    // House Interactions (PC, Bed, Bath Pool, WC, Kitchen, Fridge, Cabinet, Exit Door, or Walk inside rooms)
    if (sim.scene === 'HOUSE') {
      if (tile === 'FURNITURE_PC') {
        if (dist <= 2.3) {
          rt.facingDir = getFacingFromDelta(tx + 0.5 - sim.playerX, ty + 0.5 - sim.playerY);
          setPhase('PC_OPEN');
        } else {
          const path = findPathToTile('HOUSE', sim.playerX, sim.playerY, tx, ty, sim.upgrades.orchardDeed, sim.worldObjects, true);
          if (path.length > 0) {
            rt.pathQueue = path;
            rt.moveTarget = { x: tx + 0.5, y: ty + 0.5 };
            rt.pendingAction = { tx, ty, kind: 'PC' };
          }
        }
        return;
      }
      if (tile === 'FURNITURE_BED') {
        if (dist <= 2.4) {
          setPhase('SLEEP_CONFIRM');
        } else {
          const path = findPathToTile('HOUSE', sim.playerX, sim.playerY, tx, ty, sim.upgrades.orchardDeed, sim.worldObjects, true);
          if (path.length > 0) {
            rt.pathQueue = path;
            rt.moveTarget = { x: tx + 0.5, y: ty + 0.5 };
            rt.pendingAction = { tx, ty, kind: 'BED' };
          }
        }
        return;
      }
      if (tile === 'FURNITURE_BATH_POOL') {
        if (dist <= 2.6) {
          startBathSoak();
        } else {
          const path = findPathToTile('HOUSE', sim.playerX, sim.playerY, tx, ty, sim.upgrades.orchardDeed, sim.worldObjects, true);
          if (path.length > 0) {
            rt.pathQueue = path;
            rt.moveTarget = { x: tx + 0.5, y: ty + 0.5 };
            rt.pendingAction = { tx, ty, kind: 'BATH' };
          }
        }
        return;
      }
      if (tile === 'FURNITURE_WC') {
        if (dist <= 2.3) {
          rt.facingDir = getFacingFromDelta(tx + 0.5 - sim.playerX, ty + 0.5 - sim.playerY);
          handleUseWc();
        } else {
          const path = findPathToTile('HOUSE', sim.playerX, sim.playerY, tx, ty, sim.upgrades.orchardDeed, sim.worldObjects, true);
          if (path.length > 0) {
            rt.pathQueue = path;
            rt.moveTarget = { x: tx + 0.5, y: ty + 0.5 };
            rt.pendingAction = { tx, ty, kind: 'WC' };
          }
        }
        return;
      }
      if (tile === 'FURNITURE_FRIDGE') {
        if (dist <= 2.3) {
          rt.facingDir = getFacingFromDelta(tx + 0.5 - sim.playerX, ty + 0.5 - sim.playerY);
          setPhase('FRIDGE_OPEN');
        } else {
          const path = findPathToTile('HOUSE', sim.playerX, sim.playerY, tx, ty, sim.upgrades.orchardDeed, sim.worldObjects, true);
          if (path.length > 0) {
            rt.pathQueue = path;
            rt.moveTarget = { x: tx + 0.5, y: ty + 0.5 };
            rt.pendingAction = { tx, ty, kind: 'FRIDGE' };
          }
        }
        return;
      }
      if (tile === 'FURNITURE_CABINET') {
        if (dist <= 2.3) {
          rt.facingDir = getFacingFromDelta(tx + 0.5 - sim.playerX, ty + 0.5 - sim.playerY);
          setPhase('CABINET_OPEN');
        } else {
          const path = findPathToTile('HOUSE', sim.playerX, sim.playerY, tx, ty, sim.upgrades.orchardDeed, sim.worldObjects, true);
          if (path.length > 0) {
            rt.pathQueue = path;
            rt.moveTarget = { x: tx + 0.5, y: ty + 0.5 };
            rt.pendingAction = { tx, ty, kind: 'CABINET' };
          }
        }
        return;
      }
      if (tile === 'FURNITURE_KITCHEN') {
        if (dist <= 2.4) {
          rt.facingDir = getFacingFromDelta(tx + 0.5 - sim.playerX, ty + 0.5 - sim.playerY);
          setPhase('KITCHEN_OPEN');
        } else {
          const path = findPathToTile('HOUSE', sim.playerX, sim.playerY, tx, ty, sim.upgrades.orchardDeed, sim.worldObjects, true);
          if (path.length > 0) {
            rt.pathQueue = path;
            rt.moveTarget = { x: tx + 0.5, y: ty + 0.5 };
            rt.pendingAction = { tx, ty, kind: 'KITCHEN' };
          }
        }
        return;
      }

      const path = findPathToTile('HOUSE', sim.playerX, sim.playerY, tx, ty, sim.upgrades.orchardDeed, sim.worldObjects, true);
      if (path.length > 0) {
        rt.pathQueue = path;
        rt.moveTarget = path[path.length - 1];
        rt.pendingAction = null;
      }
      return;
    }

    // Outdoor scenes: Check if tapped tile is an interactive target
    const obj = sim.worldObjects.find((o) => o.scene === sim.scene && o.tx === tx && o.ty === ty);
    const plotKey = `${sim.scene}:${tx}:${ty}`;
    const plot = sim.plots[plotKey];

    const isDoorClick = tile === 'DOOR' || (sim.scene === 'FARM' && tile === 'HOUSE_WALL' && tx >= 4 && tx <= 6 && ty >= 4);
    if (isDoorClick && sim.scene === 'FARM') {
      const path = findPathToTile('FARM', sim.playerX, sim.playerY, 5, 5, sim.upgrades.orchardDeed, sim.worldObjects, false);
      if (path.length > 0) {
        rt.pathQueue = path;
        rt.moveTarget = { x: 5.5, y: 5.5 };
        rt.pendingAction = null;
      }
      return;
    }

    if (sim.scene === 'LAB' && (tile === 'DOOR' || tile === 'HOUSE_WALL' || tile === 'HOUSE_ROOF')) {
      soundEngine.playError();
      showToast('Laboratorium Penelitian terkunci rapat — bangunan ini tidak dapat dimasuki.');
      return;
    }

    // Clicking directly on the 3x Mecha Robot sprite (or firing rifle toward it in LAB)
    if (
      (sim.scene === 'LAB' && !sim.robot.owned) ||
      ((sim.scene === 'FARM' || sim.scene === 'PEAK') && sim.robot.owned)
    ) {
      const clickedRobot =
        Math.abs(worldTileX - rt.robotX) <= 1.95 &&
        worldTileY >= rt.robotY - 3.6 &&
        worldTileY <= rt.robotY + 0.55;
      if (clickedRobot) {
        if (sim.robot.owned || sim.robot.defeatedToday) {
          setPhase('ROBOT_RECRUIT');
          return;
        }
        const rDist = Math.hypot(rt.robotX - sim.playerX, rt.robotY - sim.playerY);
        if ((itemDef?.weaponKind === 'RIFLE' && rDist <= 11.5) || rDist <= 3.35) {
          attackRobot();
        } else {
          rt.robotAggro = true;
          const rtx = Math.max(1, Math.min(map.width - 2, Math.round(rt.robotX)));
          const rty = Math.max(1, Math.min(map.height - 2, Math.round(rt.robotY)));
          const path = findPathToTile(sim.scene, sim.playerX, sim.playerY, rtx, rty, sim.upgrades.orchardDeed, sim.worldObjects, true);
          if (path.length > 0) {
            rt.pathQueue = path;
            rt.moveTarget = path[path.length - 1];
            rt.pendingAction = null;
          }
          showToast('Mendekati Robot Mecha Penjaga... Klik Robot atau tekan Spasi untuk menyerang!');
        }
        return;
      }
      if (
        sim.scene === 'LAB' &&
        !sim.robot.owned &&
        !sim.robot.defeatedToday &&
        itemDef?.weaponKind === 'RIFLE' &&
        Math.abs(worldTileX - rt.robotX) <= 2.45 &&
        worldTileY >= rt.robotY - 3.9 &&
        worldTileY <= rt.robotY + 0.85
      ) {
        attackRobot();
        return;
      }
    }

    if (sim.scene === 'PEAK' && tile === 'MYSTERIOUS_CAVE') {
      const caveZone = SCENE_MAPS.PEAK.interactZones.find((z) => z.id === 'MYSTERIOUS_CAVE');
      if (dist <= 2.7 && caveZone) {
        triggerInteractionZone(caveZone);
      } else {
        const path = findPathToTile('PEAK', sim.playerX, sim.playerY, tx, 4, sim.upgrades.orchardDeed, sim.worldObjects, false, sim.upgrades.peakGateOpened);
        if (path.length > 0) {
          rt.pathQueue = path;
          rt.moveTarget = { x: tx + 0.5, y: 4.5 };
          rt.pendingAction = { tx, ty, kind: 'MYSTERIOUS_CAVE' };
        }
      }
      return;
    }

    if (sim.scene === 'FARM' && (tile === 'GATE_LOCKED' || (tile === 'SIGN' && tx === 13 && ty === 2))) {
      if (dist <= 2.4) {
        const signZone = SCENE_MAPS.FARM.interactZones.find((z) => z.id === 'GATE_SIGN');
        if (signZone) triggerInteractionZone(signZone);
      } else {
        const path = findPathToTile('FARM', sim.playerX, sim.playerY, tx, ty, sim.upgrades.orchardDeed, sim.worldObjects, true);
        if (path.length > 0) {
          rt.pathQueue = path;
          rt.moveTarget = { x: tx + 0.5, y: ty + 0.5 };
          rt.pendingAction = { tx, ty, kind: 'GATE_SIGN' };
        }
      }
      return;
    }

    // Clicking on a swimming fish in Hutan & Sungai (or Pinggiran Kali)
    if (sim.scene === 'FOREST' || sim.scene === 'RIVER') {
      const clickedFish = rt.riverFish.find(
        (f) => Math.hypot(worldTileX - f.x, worldTileY - f.y) <= 1.25
      );
      if (clickedFish) {
        const fDist = Math.hypot(clickedFish.x - sim.playerX, clickedFish.y - sim.playerY);
        if (fDist <= 3.1) {
          catchRiverFish(clickedFish.id);
        } else {
          const ftx = Math.max(1, Math.min(map.width - 2, Math.floor(clickedFish.x)));
          const fty = Math.max(1, Math.min(map.height - 2, Math.floor(clickedFish.y)));
          const path = findPathToTile(sim.scene, sim.playerX, sim.playerY, ftx, fty, sim.upgrades.orchardDeed, sim.worldObjects, true);
          if (path.length > 0) {
            rt.pathQueue = path;
            rt.moveTarget = path[path.length - 1];
            rt.pendingAction = null;
          }
          showToast('Mendekati ikan di arus sungai... Klik ikan atau tekan Spasi dari jembatan/sungai!');
        }
        return;
      }
    }

    const isReadyCrop = Boolean(plot && plot.cropId && plot.readyToHarvest);
    const isFarmToolOrSeed =
      itemDef?.toolKind === 'HOE' ||
      itemDef?.toolKind === 'WATERING_CAN' ||
      itemDef?.toolKind === 'SCYTHE' ||
      itemDef?.category === 'SEED' ||
      itemDef?.id === 'pupuk_kompos';
    const isFarmSoil = tile === 'FARM_ZONE' || tile === 'VOLCANIC_ZONE';
    if (
      sim.scene === 'ORCHARD' &&
      tile === 'VOLCANIC_ZONE' &&
      isFarmToolOrSeed &&
      ((tx <= 12 && !sim.upgrades.orchardLeftDeed) || (tx >= 15 && !sim.upgrades.orchardRightDeed))
    ) {
      soundEngine.playError();
      showToast(
        tx <= 12
          ? `Kebun Atas sebelah kiri jalan masih tersegel! Beli di PC (Syarat: Min. Lv.${ORCHARD_PLOT_MIN_LEVEL}, Harga ${ORCHARD_LEFT_PRICE.toLocaleString('id-ID')} EG).`
          : `Kebun Atas sebelah kanan jalan masih tersegel! Beli di PC (Syarat: Min. Lv.${ORCHARD_PLOT_MIN_LEVEL}, Harga ${ORCHARD_RIGHT_PRICE.toLocaleString('id-ID')} EG).`
      );
      return;
    }
    const isWaterSource = tile === 'WELL' || tile === 'WATER';
    const isActionTarget =
      Boolean(obj) ||
      isReadyCrop ||
      isWaterSource ||
      (isFarmSoil && isFarmToolOrSeed);

    if (isActionTarget) {
      if (dist <= 2.15) {
        rt.pathQueue = [];
        rt.moveTarget = null;
        rt.pendingAction = null;
        performTileAction(tx, ty);
      } else {
        // Walk adjacent to target tile, then auto-execute!
        const adjCandidates: [number, number][] = [
          [tx, ty + 1],
          [tx, ty - 1],
          [tx - 1, ty],
          [tx + 1, ty],
        ];
        let bestPath: Waypoint[] = [];
        for (const [ax, ay] of adjCandidates) {
          const p = findPathToTile(sim.scene, sim.playerX, sim.playerY, ax, ay, sim.upgrades.orchardDeed, sim.worldObjects, false, sim.upgrades.peakGateOpened);
          if (p.length > 0 && (bestPath.length === 0 || p.length < bestPath.length)) {
            bestPath = p;
          }
        }
        if (bestPath.length === 0) {
          bestPath = findPathToTile(sim.scene, sim.playerX, sim.playerY, tx, ty, sim.upgrades.orchardDeed, sim.worldObjects, true, sim.upgrades.peakGateOpened);
        }
        if (bestPath.length > 0) {
          rt.pathQueue = bestPath;
          rt.moveTarget = { x: tx + 0.5, y: ty + 0.5 };
          rt.pendingAction = { tx, ty, kind: 'TILE' };
        }
      }
      return;
    }

    // Otherwise, plain click-to-walk to destination tile
    const path = findPathToTile(sim.scene, sim.playerX, sim.playerY, tx, ty, sim.upgrades.orchardDeed, sim.worldObjects, true, sim.upgrades.peakGateOpened);
    if (path.length > 0) {
      rt.pathQueue = path;
      rt.moveTarget = path[path.length - 1];
      rt.pendingAction = null;
    }
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== 'PLAYING' || runtimeRef.current.isBathing || e.button !== 0) return;
    const drag = runtimeRef.current.pointerDrag;
    drag.active = true;
    drag.dragging = false;
    drag.downX = e.clientX;
    drag.downY = e.clientY;
    drag.curClientX = e.clientX;
    drag.curClientY = e.clientY;
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== 'PLAYING' || runtimeRef.current.isBathing) return;
    const { tx, ty } = screenToTile(e.clientX, e.clientY);
    runtimeRef.current.hoveredTile = { tx, ty };

    const drag = runtimeRef.current.pointerDrag;
    if (drag.active) {
      drag.curClientX = e.clientX;
      drag.curClientY = e.clientY;
      if (!drag.dragging && Math.hypot(e.clientX - drag.downX, e.clientY - drag.downY) > 14) {
        drag.dragging = true;
        runtimeRef.current.pathQueue = [];
        runtimeRef.current.moveTarget = null;
        runtimeRef.current.pendingAction = null;
      }
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== 'PLAYING' || runtimeRef.current.isBathing) return;
    const drag = runtimeRef.current.pointerDrag;
    const wasDragging = drag.dragging;
    drag.active = false;
    drag.dragging = false;

    if (!wasDragging) {
      const { tx, ty, worldTileX, worldTileY } = screenToTile(e.clientX, e.clientY);
      handleTapOnWorld(tx, ty, worldTileX, worldTileY);
    }
  };

  const handleCanvasPointerLeave = () => {
    runtimeRef.current.pointerDrag.active = false;
    runtimeRef.current.pointerDrag.dragging = false;
    runtimeRef.current.hoveredTile = null;
  };

  // PC Online Transaction Handlers
  const handleBuyItem = (itemId: string, qty: number) => {
    const sim = simRef.current;
    const def = ITEMS[itemId];
    if (!def || !def.buyPrice) return;
    const cost = def.buyPrice * qty;
    if (sim.gold < cost) {
      soundEngine.playError();
      showToast('Emas Game (EG) tidak cukup!');
      return;
    }
    const nextInv = tryAddInventoryItem(sim.inventory, itemId, qty, sim.bagLevel);
    if (!nextInv) {
      soundEngine.playError();
      showToast(`Tas penuh (${getBagCapacity(sim.bagLevel)} slot)! Jual barang atau upgrade Tas dulu.`);
      return;
    }
    sim.gold -= cost;
    sim.inventory = nextInv;
    soundEngine.playCoin();
    showToast(`Membeli ${qty}× ${def.name} via PC!`);
    saveToStorage();
    syncHud();
  };

  const handleBuyAndConsume = (itemId: string) => {
    const sim = simRef.current;
    const def = ITEMS[itemId];
    if (!def || !def.buyPrice) return;
    if (sim.gold < def.buyPrice) {
      soundEngine.playError();
      showToast('Emas Game (EG) tidak cukup!');
      return;
    }
    sim.gold -= def.buyPrice;
    sim.stats.health = Math.min(100, sim.stats.health + (def.restoreHealth ?? 0));
    sim.stats.mood = Math.min(100, sim.stats.mood + (def.restoreMood ?? 0));
    sim.stats.speed = Math.min(100, sim.stats.speed + (def.boostSpeed ?? 0));
    runtimeRef.current.actionKind = 'CONSUME';
    runtimeRef.current.actionProgress = 0.01;
    soundEngine.playEat();
    const parts: string[] = [];
    if (def.restoreHealth) parts.push(`+${def.restoreHealth} Health`);
    if (def.restoreMood) parts.push(`+${def.restoreMood} Mood`);
    if (def.boostSpeed) parts.push(`+${def.boostSpeed} Speed`);
    showToast(`Pesan & santap ${def.name}! (${parts.join(', ')})`);
    saveToStorage();
    syncHud();
  };

  const handleSellItem = (itemId: string, qty: number) => {
    const sim = simRef.current;
    const def = ITEMS[itemId];
    if (!def || !def.sellPrice) return;
    const owned = sim.inventory.find((s) => s.itemId === itemId)?.quantity ?? 0;
    const sellQty = Math.min(owned, qty);
    if (sellQty <= 0) return;

    const earned = def.sellPrice * sellQty;
    const { xpGained, leveledUpTo } = grantGoldWithXp(sim, earned);
    sim.inventory = removeInventoryItem(sim.inventory, itemId, sellQty);
    if (sim.hotbarSelected >= sim.inventory.length && sim.inventory.length > 0) {
      sim.hotbarSelected = Math.max(0, sim.inventory.length - 1);
    }
    if (leveledUpTo) {
      soundEngine.playHarvest();
      showToast(`Menjual ${sellQty}× ${def.name} (+${earned.toLocaleString('id-ID')} EG, +${xpGained} XP) • NAIK LEVEL ${leveledUpTo}! Tas siap di-upgrade!`);
    } else if (xpGained > 0) {
      soundEngine.playCoin();
      showToast(`Menjual ${sellQty}× ${def.name} (+${earned.toLocaleString('id-ID')} EG, +${xpGained} XP)`);
    } else {
      soundEngine.playCoin();
      showToast(`Menjual ${sellQty}× ${def.name} (+${earned.toLocaleString('id-ID')} EG)`);
    }
    saveToStorage();
    syncHud();
  };

  const handleBuyUpgrade = (key: keyof UpgradesState, cost: number) => {
    const sim = simRef.current;
    if (sim.upgrades[key]) {
      soundEngine.playError();
      return;
    }
    if (key === 'orchardLeftDeed' || key === 'orchardRightDeed') {
      const playerLevel = getPlayerLevel(sim.xp);
      if (playerLevel < ORCHARD_PLOT_MIN_LEVEL) {
        soundEngine.playError();
        showToast(`Minimal Level ${ORCHARD_PLOT_MIN_LEVEL} untuk membeli lahan Kebun Atas! (Level Anda: Lv.${playerLevel})`);
        return;
      }
    }
    if (sim.gold < cost) {
      soundEngine.playError();
      showToast('Emas Game (EG) tidak cukup!');
      return;
    }
    sim.gold -= cost;
    sim.upgrades[key] = true;
    if (key === 'bigWateringCan') {
      sim.wateringCanCharges = 45;
    }
    soundEngine.playHarvest();
    if (key === 'orchardDeed') {
      showToast('Selamat! Sertifikat Akses Kebun Atas telah dibeli. Gerbang Utara kini terbuka!');
    } else if (key === 'orchardLeftDeed') {
      showToast('Segel Kebun Atas sebelah kiri jalan terbuka! Lahan siap dicangkul & ditanami.');
    } else if (key === 'orchardRightDeed') {
      showToast('Segel Kebun Atas sebelah kanan jalan terbuka! Lahan siap dicangkul & ditanami.');
    } else {
      showToast('Pembelian peralatan berhasil dikirim!');
    }
    saveToStorage();
    syncHud();
  };

  const handleDeliverOrder = () => {
    const sim = simRef.current;
    const order = sim.dailyOrder;
    if (!order || order.completed) return;
    const owned = sim.inventory.find((s) => s.itemId === order.itemId)?.quantity ?? 0;
    const needed = order.requiredQty - order.deliveredQty;
    const sendQty = Math.min(owned, needed);
    if (sendQty <= 0) return;

    const basePrice = ITEMS[order.itemId]?.sellPrice ?? 0;
    const earned = (basePrice + order.bonusPerUnit) * sendQty;
    const { xpGained, leveledUpTo } = grantGoldWithXp(sim, earned);
    sim.inventory = removeInventoryItem(sim.inventory, order.itemId, sendQty);
    if (sim.hotbarSelected >= sim.inventory.length && sim.inventory.length > 0) {
      sim.hotbarSelected = Math.max(0, sim.inventory.length - 1);
    }
    order.deliveredQty += sendQty;
    if (order.deliveredQty >= order.requiredQty) {
      order.completed = true;
      sim.stats.mood = Math.min(100, sim.stats.mood + 10);
    }
    if (leveledUpTo) {
      soundEngine.playHarvest();
      showToast(`Kontrak Ekspor: +${earned.toLocaleString('id-ID')} EG (+${xpGained} XP) • LEVEL ${leveledUpTo}!`);
    } else if (xpGained > 0) {
      soundEngine.playCoin();
      showToast(`Kontrak Ekspor: +${earned.toLocaleString('id-ID')} EG (+${xpGained} XP)!`);
    } else {
      soundEngine.playCoin();
      showToast(`Kontrak Ekspor: +${earned.toLocaleString('id-ID')} EG!`);
    }
    saveToStorage();
    syncHud();
  };

  const handleSwapBagSlots = (idxA: number, idxB: number) => {
    const sim = simRef.current;
    const inv = [...sim.inventory];
    const maxSlots = getBagCapacity(sim.bagLevel);
    if (idxA < 0 || idxB < 0 || idxA >= inv.length || idxB >= maxSlots || idxA === idxB) return;

    if (idxB < inv.length) {
      const temp = inv[idxA];
      inv[idxA] = inv[idxB];
      inv[idxB] = temp;
    } else {
      // Move item toward end of filled slots
      const [moved] = inv.splice(idxA, 1);
      inv.push(moved);
    }
    sim.inventory = inv;
    saveToStorage();
    syncHud();
  };

  const handleUpgradeBag = () => {
    const sim = simRef.current;
    const playerLevel = getPlayerLevel(sim.xp);
    if (sim.bagLevel >= MAX_PLAYER_LEVEL || sim.bagLevel >= playerLevel) {
      soundEngine.playError();
      showToast(`Naikkan level player ke Lv.${sim.bagLevel + 1} untuk upgrade Tas!`);
      return;
    }
    sim.bagLevel += 1;
    const newCap = getBagCapacity(sim.bagLevel);
    soundEngine.playHarvest();
    showToast(`Tas di-upgrade ke Lv.${sim.bagLevel}! Kapasitas bertambah +${SLOTS_PER_BAG_UPGRADE} menjadi ${newCap} slot.`);
    saveToStorage();
    syncHud();
  };

  const handleConsumeFromBackpack = (itemId: string) => {
    const sim = simRef.current;
    const def = ITEMS[itemId];
    if (!def) return;
    if (def.id === 'buah_kalabas') {
      soundEngine.playError();
      showToast('Buah Kalabas tidak bisa dimakan!');
      return;
    }
    runtimeRef.current.actionKind = 'CONSUME';
    runtimeRef.current.actionProgress = 0.01;
    sim.stats.health = Math.min(100, sim.stats.health + (def.restoreHealth ?? 0));
    sim.stats.mood = Math.min(100, sim.stats.mood + (def.restoreMood ?? 0));
    sim.stats.speed = Math.min(100, sim.stats.speed + (def.boostSpeed ?? 0));
    sim.inventory = removeInventoryItem(sim.inventory, itemId, 1);
    if (sim.hotbarSelected >= sim.inventory.length && sim.inventory.length > 0) {
      sim.hotbarSelected = Math.max(0, sim.inventory.length - 1);
    }
    soundEngine.playEat();
    showToast(`Mengonsumsi ${def.name}! Health/Mood/Speed pulih.`);
    saveToStorage();
    syncHud();
  };

  const handleKitchenDrinkWater = () => {
    const sim = simRef.current;
    runtimeRef.current.actionKind = 'CONSUME';
    runtimeRef.current.actionProgress = 0.01;
    sim.stats.health = Math.min(100, sim.stats.health + 8);
    sim.stats.mood = Math.min(100, sim.stats.mood + 6);
    sim.stats.speed = Math.min(100, sim.stats.speed + 8);
    soundEngine.playWater();
    spawnParticleText(sim.playerX * TILE_SIZE, sim.playerY * TILE_SIZE - 42, '+8 HP +6 Mood +8 Spd', '#38BDF8');
    showToast('Minum Air Putih Segar di Dapur: +8 Health, +6 Mood, +8 Speed!');
    saveToStorage();
    syncHud();
  };

  const handleKitchenDrinkTea = () => {
    const sim = simRef.current;
    const used = sim.homeDrinkUsedToday ?? 0;
    if (used >= 2) {
      soundEngine.playError();
      showToast('Jatah Teh Hangat Nusantara hari ini sudah habis (2/2).');
      return;
    }
    runtimeRef.current.actionKind = 'CONSUME';
    runtimeRef.current.actionProgress = 0.01;
    sim.homeDrinkUsedToday = used + 1;
    sim.stats.health = Math.min(100, sim.stats.health + 18);
    sim.stats.mood = Math.min(100, sim.stats.mood + 18);
    sim.stats.speed = Math.min(100, sim.stats.speed + 14);
    soundEngine.playEat();
    spawnParticleText(sim.playerX * TILE_SIZE, sim.playerY * TILE_SIZE - 42, '+18 HP +18 Mood +14 Spd', '#34D399');
    showToast('Minum Teh Hangat Nusantara di rumah: +18 Health, +18 Mood, +14 Speed!');
    saveToStorage();
    syncHud();
  };

  const handleKitchenEatMeal = () => {
    const sim = simRef.current;
    const used = sim.homeEatUsedToday ?? 0;
    if (used >= 1) {
      soundEngine.playError();
      showToast('Anda sudah menyantap Masakan Hangat Dapur hari ini (1/1).');
      return;
    }
    runtimeRef.current.actionKind = 'CONSUME';
    runtimeRef.current.actionProgress = 0.01;
    sim.homeEatUsedToday = used + 1;
    sim.stats.health = Math.min(100, sim.stats.health + 35);
    sim.stats.mood = Math.min(100, sim.stats.mood + 25);
    sim.stats.speed = Math.min(100, sim.stats.speed + 15);
    soundEngine.playEat();
    spawnParticleText(sim.playerX * TILE_SIZE, sim.playerY * TILE_SIZE - 42, '+35 HP +25 Mood +15 Spd', '#FBBF24');
    showToast('Makan Masakan Hangat Dapur di rumah: +35 Health, +25 Mood, +15 Speed!');
    saveToStorage();
    syncHud();
  };

  const ensureNormalizedFridge = (sim: SaveData): (InventorySlot | null)[] => {
    const raw = sim.fridgeSlots ?? [];
    return Array.from({ length: FRIDGE_TOTAL_SLOTS }, (_, idx) => {
      const s = raw[idx];
      return s && s.quantity > 0 ? { itemId: s.itemId, quantity: s.quantity } : null;
    });
  };

  const handleStoreToFridge = (itemId: string, qty: number, preferredSlotIdx?: number) => {
    const sim = simRef.current;
    if (!isFridgeFoodItem(itemId)) {
      soundEngine.playError();
      showToast('Hanya makanan dan minuman yang bisa disimpan di dalam kulkas!');
      return;
    }
    const bagSlot = sim.inventory.find((s) => s.itemId === itemId);
    const storeQty = Math.min(qty, bagSlot?.quantity ?? 0);
    if (storeQty <= 0) return;

    const slots = ensureNormalizedFridge(sim);
    let targetIdx = -1;

    if (
      preferredSlotIdx !== undefined &&
      preferredSlotIdx >= 0 &&
      preferredSlotIdx < FRIDGE_TOTAL_SLOTS
    ) {
      const target = slots[preferredSlotIdx];
      if (!target || target.itemId === itemId) {
        targetIdx = preferredSlotIdx;
      }
    }

    if (targetIdx === -1) {
      targetIdx = slots.findIndex((s) => s?.itemId === itemId);
    }
    if (targetIdx === -1) {
      targetIdx = slots.findIndex((s) => s === null);
    }

    if (targetIdx === -1) {
      soundEngine.playError();
      showToast('Semua 75 slot kulkas (5 halaman) sudah penuh!');
      return;
    }

    const existing = slots[targetIdx];
    if (existing && existing.itemId === itemId) {
      slots[targetIdx] = { itemId, quantity: existing.quantity + storeQty };
    } else {
      slots[targetIdx] = { itemId, quantity: storeQty };
    }

    sim.fridgeSlots = slots;
    sim.inventory = removeInventoryItem(sim.inventory, itemId, storeQty);
    if (sim.hotbarSelected >= sim.inventory.length && sim.inventory.length > 0) {
      sim.hotbarSelected = Math.max(0, sim.inventory.length - 1);
    }
    soundEngine.playPlant();
    showToast(`Menyimpan ${storeQty}× ${ITEMS[itemId]?.name ?? itemId} ke kulkas.`);
    saveToStorage();
    syncHud();
  };

  const handleWithdrawFromFridge = (slotIdx: number, qty: number) => {
    const sim = simRef.current;
    const slots = ensureNormalizedFridge(sim);
    const slot = slots[slotIdx];
    if (!slot) return;

    const takeQty = Math.min(qty, slot.quantity);
    if (takeQty <= 0) return;

    const nextInv = tryAddInventoryItem(sim.inventory, slot.itemId, takeQty, sim.bagLevel);
    if (!nextInv) {
      soundEngine.playError();
      showToast('Tas penuh! Kosongkan 1 slot tas terlebih dahulu.');
      return;
    }

    sim.inventory = nextInv;
    const rem = slot.quantity - takeQty;
    slots[slotIdx] = rem > 0 ? { itemId: slot.itemId, quantity: rem } : null;
    sim.fridgeSlots = slots;

    soundEngine.playPlant();
    showToast(`Mengambil ${takeQty}× ${ITEMS[slot.itemId]?.name ?? slot.itemId} dari kulkas.`);
    saveToStorage();
    syncHud();
  };

  const handleEatFromFridge = (slotIdx: number) => {
    const sim = simRef.current;
    const slots = ensureNormalizedFridge(sim);
    const slot = slots[slotIdx];
    if (!slot) return;

    const def = ITEMS[slot.itemId];
    if (!def || !isFridgeFoodItem(slot.itemId)) {
      soundEngine.playError();
      return;
    }

    runtimeRef.current.actionKind = 'CONSUME';
    runtimeRef.current.actionProgress = 0.01;
    sim.stats.health = Math.min(100, sim.stats.health + (def.restoreHealth ?? 0));
    sim.stats.mood = Math.min(100, sim.stats.mood + (def.restoreMood ?? 0));
    sim.stats.speed = Math.min(100, sim.stats.speed + (def.boostSpeed ?? 0));

    const rem = slot.quantity - 1;
    slots[slotIdx] = rem > 0 ? { itemId: slot.itemId, quantity: rem } : null;
    sim.fridgeSlots = slots;

    soundEngine.playEat();
    showToast(`Menyantap ${def.name} dari kulkas!`);
    saveToStorage();
    syncHud();
  };

  const handleSwapFridgeSlots = (idxA: number, idxB: number) => {
    const sim = simRef.current;
    if (
      idxA < 0 ||
      idxB < 0 ||
      idxA >= FRIDGE_TOTAL_SLOTS ||
      idxB >= FRIDGE_TOTAL_SLOTS ||
      idxA === idxB
    ) {
      return;
    }
    const slots = ensureNormalizedFridge(sim);
    const tmp = slots[idxA];
    slots[idxA] = slots[idxB];
    slots[idxB] = tmp;
    sim.fridgeSlots = slots;
    saveToStorage();
    syncHud();
  };

  const ensureNormalizedCabinet = (sim: SaveData): (InventorySlot | null)[] => {
    const raw = sim.cabinetSlots ?? [];
    return Array.from({ length: CABINET_TOTAL_SLOTS }, (_, idx) => {
      const s = raw[idx];
      return s && s.quantity > 0 ? { itemId: s.itemId, quantity: s.quantity } : null;
    });
  };

  const handleStoreToCabinet = (itemId: string, qty: number, preferredSlotIdx?: number) => {
    const sim = simRef.current;
    if (!isCabinetNonFoodItem(itemId)) {
      soundEngine.playError();
      showToast('Lemari hanya untuk item non-makanan! Makanan & minuman disimpan di kulkas.');
      return;
    }
    const bagSlot = sim.inventory.find((s) => s.itemId === itemId);
    const storeQty = Math.min(qty, bagSlot?.quantity ?? 0);
    if (storeQty <= 0) return;

    const slots = ensureNormalizedCabinet(sim);
    let targetIdx = -1;

    if (
      preferredSlotIdx !== undefined &&
      preferredSlotIdx >= 0 &&
      preferredSlotIdx < CABINET_TOTAL_SLOTS
    ) {
      const target = slots[preferredSlotIdx];
      if (!target || target.itemId === itemId) {
        targetIdx = preferredSlotIdx;
      }
    }

    if (targetIdx === -1) {
      targetIdx = slots.findIndex((s) => s?.itemId === itemId);
    }
    if (targetIdx === -1) {
      targetIdx = slots.findIndex((s) => s === null);
    }

    if (targetIdx === -1) {
      soundEngine.playError();
      showToast('Semua 75 slot lemari (5 halaman) sudah penuh!');
      return;
    }

    const existing = slots[targetIdx];
    if (existing && existing.itemId === itemId) {
      slots[targetIdx] = { itemId, quantity: existing.quantity + storeQty };
    } else {
      slots[targetIdx] = { itemId, quantity: storeQty };
    }

    sim.cabinetSlots = slots;
    sim.inventory = removeInventoryItem(sim.inventory, itemId, storeQty);
    if (sim.hotbarSelected >= sim.inventory.length && sim.inventory.length > 0) {
      sim.hotbarSelected = Math.max(0, sim.inventory.length - 1);
    }
    soundEngine.playPlant();
    showToast(`Menyimpan ${storeQty}× ${ITEMS[itemId]?.name ?? itemId} ke lemari.`);
    saveToStorage();
    syncHud();
  };

  const handleWithdrawFromCabinet = (slotIdx: number, qty: number) => {
    const sim = simRef.current;
    const slots = ensureNormalizedCabinet(sim);
    const slot = slots[slotIdx];
    if (!slot) return;

    const takeQty = Math.min(qty, slot.quantity);
    if (takeQty <= 0) return;

    const nextInv = tryAddInventoryItem(sim.inventory, slot.itemId, takeQty, sim.bagLevel);
    if (!nextInv) {
      soundEngine.playError();
      showToast('Tas penuh! Kosongkan 1 slot tas terlebih dahulu.');
      return;
    }

    sim.inventory = nextInv;
    const rem = slot.quantity - takeQty;
    slots[slotIdx] = rem > 0 ? { itemId: slot.itemId, quantity: rem } : null;
    sim.cabinetSlots = slots;

    soundEngine.playPlant();
    showToast(`Mengambil ${takeQty}× ${ITEMS[slot.itemId]?.name ?? slot.itemId} dari lemari.`);
    saveToStorage();
    syncHud();
  };

  const handleSwapCabinetSlots = (idxA: number, idxB: number) => {
    const sim = simRef.current;
    if (
      idxA < 0 ||
      idxB < 0 ||
      idxA >= CABINET_TOTAL_SLOTS ||
      idxB >= CABINET_TOTAL_SLOTS ||
      idxA === idxB
    ) {
      return;
    }
    const slots = ensureNormalizedCabinet(sim);
    const tmp = slots[idxA];
    slots[idxA] = slots[idxB];
    slots[idxB] = tmp;
    sim.cabinetSlots = slots;
    saveToStorage();
    syncHud();
  };

  const handleNewGame = () => {
    soundEngine.startBgm();
    const fresh = createInitialSaveData();
    simRef.current = fresh;
    runtimeRef.current.facingDir = 'DOWN';
    runtimeRef.current.cameraX = fresh.playerX * TILE_SIZE;
    runtimeRef.current.cameraY = fresh.playerY * TILE_SIZE;
    syncHud();
    setPhase('PLAYING');
    showToast('Pagi di Kamar Tidur! BAB di WC (+10 Speed/Mood/Health), berendam di kolam (+15 Mood, +20 Health, +10 Speed), atau beli sarapan di PC!');
  };

  const handleContinueGame = () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const rawParsed = JSON.parse(raw) as Partial<SaveData>;
        const parsed: SaveData = {
          ...createInitialSaveData(),
          ...rawParsed,
          upgrades: {
            ...createInitialSaveData().upgrades,
            ...(rawParsed.upgrades ?? {}),
          },
          xp: rawParsed.xp ?? 0,
          xpMoneyRemainder: rawParsed.xpMoneyRemainder ?? 0,
          bagLevel: Math.max(1, Math.min(MAX_PLAYER_LEVEL, rawParsed.bagLevel ?? 1)),
          kalabasDropDays: rawParsed.kalabasDropDays ?? 0,
          kalabasFruitDays: rawParsed.kalabasFruitDays ?? 0,
          homeEatUsedToday: rawParsed.homeEatUsedToday ?? 0,
          homeDrinkUsedToday: rawParsed.homeDrinkUsedToday ?? 0,
          wcUsedToday: Boolean(rawParsed.wcUsedToday),
          fridgeSlots: Array.from({ length: FRIDGE_TOTAL_SLOTS }, (_, idx) => {
            const s = rawParsed.fridgeSlots?.[idx];
            return s && s.quantity > 0 ? { itemId: s.itemId, quantity: s.quantity } : null;
          }),
          cabinetSlots: Array.from({ length: CABINET_TOTAL_SLOTS }, (_, idx) => {
            const s = rawParsed.cabinetSlots?.[idx];
            return s && s.quantity > 0 ? { itemId: s.itemId, quantity: s.quantity } : null;
          }),
          robot: rawParsed.robot ?? { owned: false, defeatedToday: false, hp: 120, maxHp: 120 },
        };
        if (!parsed.worldObjects.some((o) => o.scene === 'LAB')) {
          parsed.worldObjects = [
            ...parsed.worldObjects.filter((o) => o.scene !== 'ORCHARD' && o.scene !== 'LAB'),
            ...createKebunAtasObjects(1000),
            ...createLabSceneObjects(2000),
          ];
        }
        // Migrate fallen Kalabas drops to 1 pc (1/3) & orchard non-Kalabas trees to 4 trees (1/3 total fruit)
        parsed.worldObjects = parsed.worldObjects.map((o) =>
          o.scene === 'LAB' && o.kind === 'FORAGE' && o.itemId === 'buah_kalabas' && (o.quantity ?? 1) > 1
            ? { ...o, quantity: 1, label: 'Buah Kalabas Jatuh' }
            : o
        );
        const orchardFruitCount = parsed.worldObjects.filter(
          (o) => o.scene === 'ORCHARD' && o.kind === 'FRUIT_TREE' && o.itemId !== 'buah_kalabas'
        ).length;
        if (orchardFruitCount > 4) {
          const freshOrchardNonKalabas = createKebunAtasObjects(1000).filter(
            (o) => o.kind === 'FRUIT_TREE' && o.itemId !== 'buah_kalabas'
          );
          parsed.worldObjects = [
            ...parsed.worldObjects.filter(
              (o) => !(o.scene === 'ORCHARD' && o.kind === 'FRUIT_TREE' && o.itemId !== 'buah_kalabas')
            ),
            ...freshOrchardNonKalabas,
          ];
        }
        const readyKalabasCount = parsed.worldObjects.filter(
          (o) => o.kind === 'FRUIT_TREE' && o.itemId === 'buah_kalabas' && o.harvestReady
        ).length;
        if (readyKalabasCount > 24) {
          parsed.worldObjects = randomizeHalfKalabasFruiting(parsed.worldObjects);
        }
        const hasPeakLayoutClash = parsed.worldObjects.some(
          (o) =>
            o.scene === 'PEAK' &&
            (o.tx < 22 || o.ty < 4 || (o.tx >= 23 && o.ty >= 9 && o.ty <= 14))
        );
        if (!parsed.worldObjects.some((o) => o.scene === 'PEAK') || hasPeakLayoutClash) {
          parsed.worldObjects = [
            ...parsed.worldObjects.filter((o) => o.scene !== 'PEAK'),
            ...createPeakSceneObjects(4500),
          ];
        }
        if (!parsed.worldObjects.some((o) => o.scene === 'CLIFF')) {
          parsed.worldObjects = [
            ...parsed.worldObjects,
            ...createCliffSceneObjects(5500),
          ];
        }
        // Migrate Pinggiran Kali objects to the relocated river layout (west of FARM) if missing or from old east layout
        if (
          !parsed.worldObjects.some((o) => o.scene === 'RIVER') ||
          parsed.worldObjects.some((o) => o.scene === 'RIVER' && o.tx >= 8 && o.tx <= 14)
        ) {
          parsed.worldObjects = [
            ...parsed.worldObjects.filter((o) => o.scene !== 'RIVER'),
            ...createRiverSceneObjects(3500),
          ];
        }
        {
          const farmMap = SCENE_MAPS.FARM;
          for (const [k, pl] of Object.entries(parsed.plots)) {
            if (pl.scene === 'FARM' && farmMap.tiles[pl.ty]?.[pl.tx] !== 'FARM_ZONE') {
              delete parsed.plots[k];
            }
          }
          parsed.worldObjects = parsed.worldObjects.filter((o) => {
            if (o.scene !== 'FARM') return true;
            const tk = farmMap.tiles[o.ty]?.[o.tx];
            return tk === 'GRASS' || tk === 'DARK_GRASS';
          });        }
        if (parsed.scene === 'FARM') {
          const farmMap = SCENE_MAPS.FARM;
          const ftx = Math.floor(parsed.playerX);
          const fty = Math.floor(parsed.playerY);
          const blockedByObj = parsed.worldObjects.some(
            (o) => o.scene === 'FARM' && o.tx === ftx && o.ty === fty
          );
          if (
            ftx < 0 ||
            fty < 0 ||
            ftx >= farmMap.width ||
            fty >= farmMap.height ||
            isTileSolid(farmMap.tiles[fty][ftx], parsed.upgrades.orchardDeed, parsed.upgrades.peakGateOpened) ||
            blockedByObj
          ) {
            parsed.playerX = 5.5;
            parsed.playerY = 6.5;
          }
        } else if (parsed.scene === 'HOUSE') {
          const houseMap = SCENE_MAPS.HOUSE;
          const htx = Math.floor(parsed.playerX);
          const hty = Math.floor(parsed.playerY);
          if (
            htx < 0 ||
            hty < 0 ||
            htx >= houseMap.width ||
            hty >= houseMap.height ||
            isTileSolid(houseMap.tiles[hty][htx], parsed.upgrades.orchardDeed, parsed.upgrades.peakGateOpened)
          ) {
            parsed.playerX = 15.0;
            parsed.playerY = 12.6;
          }
        } else if (parsed.scene === 'ORCHARD') {
          const orchardMap = SCENE_MAPS.ORCHARD;
          const otx = Math.floor(parsed.playerX);
          const oty = Math.floor(parsed.playerY);
          if (
            otx < 0 ||
            oty < 0 ||
            otx >= orchardMap.width ||
            oty >= orchardMap.height ||
            isTileSolid(orchardMap.tiles[oty][otx], parsed.upgrades.orchardDeed, parsed.upgrades.peakGateOpened)
          ) {
            parsed.playerX = 14.0;
            parsed.playerY = 17.6;
          }
        } else if (parsed.scene === 'LAB') {
          const labMap = SCENE_MAPS.LAB;
          const ltx = Math.floor(parsed.playerX);
          const lty = Math.floor(parsed.playerY);
          if (
            ltx < 0 ||
            lty < 0 ||
            ltx >= labMap.width ||
            lty >= labMap.height ||
            isTileSolid(labMap.tiles[lty][ltx], parsed.upgrades.orchardDeed, parsed.upgrades.peakGateOpened)
          ) {
            parsed.playerX = 14.0;
            parsed.playerY = 20.0;
          }
        }
        {
          const forestMap = SCENE_MAPS.FOREST;
          const hasInvalidForestObj = parsed.worldObjects.some((o) => {
            if (o.scene !== 'FOREST') return false;
            const tk = forestMap.tiles[o.ty]?.[o.tx];
            return tk === 'RIVER_WATER' || tk === 'WOOD_BRIDGE' || tk === 'FENCE' || tk === 'DIRT_PATH';
          });
          if (hasInvalidForestObj) {
            parsed.worldObjects = [
              ...parsed.worldObjects.filter((o) => o.scene !== 'FOREST'),
              ...createForestSceneObjects(200),
            ];
          }
        }
        if (parsed.scene === 'RIVER') {
          parsed.scene = 'FOREST';
          parsed.playerX = 21.5;
          parsed.playerY = 9.5;
        } else if (parsed.scene === 'FOREST') {
          const forestMap = SCENE_MAPS.FOREST;
          const ftx = Math.floor(parsed.playerX);
          const fty = Math.floor(parsed.playerY);
          const blockedByObj = parsed.worldObjects.some(
            (o) => o.scene === 'FOREST' && o.tx === ftx && o.ty === fty
          );
          if (
            ftx < 0 ||
            fty < 0 ||
            ftx >= forestMap.width ||
            fty >= forestMap.height ||
            isTileSolid(forestMap.tiles[fty][ftx], parsed.upgrades.orchardDeed, parsed.upgrades.peakGateOpened) ||
            blockedByObj
          ) {
            parsed.playerX = 2.0;
            parsed.playerY = 9.5;
          }
        } else if (parsed.scene === 'PEAK') {
          const peakMap = SCENE_MAPS.PEAK;
          const ptx = Math.floor(parsed.playerX);
          const pty = Math.floor(parsed.playerY);
          const blockedByObj = parsed.worldObjects.some(
            (o) => o.scene === 'PEAK' && o.tx === ptx && o.ty === pty
          );
          if (
            parsed.playerX < 22.3 ||
            parsed.playerY < 4.2 ||
            ptx < 0 ||
            pty < 0 ||
            ptx >= peakMap.width ||
            pty >= peakMap.height ||
            isTileSolid(peakMap.tiles[pty][ptx], parsed.upgrades.orchardDeed, parsed.upgrades.peakGateOpened) ||
            blockedByObj
          ) {
            parsed.playerX = 25.8;
            parsed.playerY = 11.8;
          }
        } else if (parsed.scene === 'CLIFF') {
          const cliffMap = SCENE_MAPS.CLIFF;
          const ctxTile = Math.floor(parsed.playerX);
          const ctyTile = Math.floor(parsed.playerY);
          const blockedByObj = parsed.worldObjects.some(
            (o) => o.scene === 'CLIFF' && o.tx === ctxTile && o.ty === ctyTile
          );
          if (
            ctxTile < 0 ||
            ctyTile < 0 ||
            ctxTile >= cliffMap.width ||
            ctyTile >= cliffMap.height ||
            isTileSolid(cliffMap.tiles[ctyTile][ctxTile], parsed.upgrades.orchardDeed, parsed.upgrades.peakGateOpened) ||
            blockedByObj
          ) {
            parsed.playerX = 1.8;
            parsed.playerY = 9.5;
          }
        }
        simRef.current = parsed;
        runtimeRef.current.cameraX = parsed.playerX * TILE_SIZE;
        runtimeRef.current.cameraY = parsed.playerY * TILE_SIZE;
        soundEngine.startBgm();
        syncHud();
        setPhase('PLAYING');
        return;
      }
    } catch {
      // fallback to new game
    }
    handleNewGame();
  };

  const handleRecruitRobot = () => {
    const sim = simRef.current;
    if (sim.robot.owned) return;
    const lv = getPlayerLevel(sim.xp);
    const kalabasQty = sim.inventory.find((s) => s.itemId === 'buah_kalabas')?.quantity ?? 0;
    if (lv < 7 || kalabasQty < 100 || sim.gold < 1_000_000) {
      soundEngine.playError();
      showToast('Syarat belum terpenuhi (Lv.7, 100 Buah Kalabas, 1.000.000 EG)!');
      return;
    }
    sim.gold -= 1_000_000;
    sim.inventory = removeInventoryItem(sim.inventory, 'buah_kalabas', 100);
    if (sim.hotbarSelected >= sim.inventory.length && sim.inventory.length > 0) {
      sim.hotbarSelected = Math.max(0, sim.inventory.length - 1);
    }
    sim.robot.owned = true;
    sim.robot.defeatedToday = false;
    sim.robot.hp = sim.robot.maxHp;
    runtimeRef.current.robotAggro = false;
    soundEngine.playHarvest();
    showToast('Selamat! Robot Coklat Lab kini resmi menjadi milikmu dan menjaga Kebun Utama!');
    saveToStorage();
    syncHud();
    setPhase('PLAYING');
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
  };

  const handleChangeVolume = (nextVol: number) => {
    const clamped = Math.max(0, Math.min(1, nextVol));
    soundEngine.setVolume(clamped);
    setVolume(clamped);
    if (clamped > 0 && muted) {
      setMuted(false);
      soundEngine.setMuted(false);
    } else if (clamped === 0 && !muted) {
      setMuted(true);
      soundEngine.setMuted(true);
    }
  };

  const handleChangeMusicVolume = (nextVol: number) => {
    const clamped = Math.max(0, Math.min(1, nextVol));
    soundEngine.setMusicVolume(clamped);
    setMusicVolume(clamped);
    if (clamped > 0 && muted) {
      setMuted(false);
      soundEngine.setMuted(false);
    }
  };

  const handleRedeemCode = (rawCode: string): { ok: boolean; message: string } => {
    const parsed = validateRedeemCode(rawCode);
    if (!parsed.valid || !parsed.normalized) {
      soundEngine.playError();
      return { ok: false, message: 'Kode tidak valid! Periksa kembali kode yang Anda masukkan.' };
    }
    if (parsed.alreadyUsed) {
      soundEngine.playError();
      return { ok: false, message: 'Kode ini sudah pernah digunakan.' };
    }

    const sim = simRef.current;
    const curLevel = getPlayerLevel(sim.xp);
    const messages: string[] = [];

    if (parsed.targetLevel) {
      const targetLevel = Math.min(MAX_PLAYER_LEVEL, parsed.targetLevel);
      if (curLevel < targetLevel) {
        sim.xp = Math.max(sim.xp, getLevelMinXp(targetLevel));
        messages.push(`Level naik ke Lv.${targetLevel}`);
      } else {
        messages.push(`Level sudah maksimal (Lv.${MAX_PLAYER_LEVEL})`);
      }
    } else if ((parsed.levelDelta ?? 0) > 0) {
      if (curLevel < MAX_PLAYER_LEVEL) {
        const targetLevel = Math.min(MAX_PLAYER_LEVEL, curLevel + (parsed.levelDelta ?? 1));
        sim.xp = Math.max(sim.xp, getLevelMinXp(targetLevel));
        messages.push(`Level naik ke Lv.${targetLevel}`);
      } else {
        messages.push('Level sudah maksimal (Lv.9)');
      }
    }

    if ((parsed.goldDelta ?? 0) > 0) {
      const addGold = parsed.goldDelta ?? 0;
      sim.gold += addGold;
      sim.totalEarned += addGold;
      messages.push(`+${addGold.toLocaleString('id-ID')} EG`);
    }

    if (parsed.singleUse !== false) {
      markCodeUsed(parsed.normalized);
    }
    soundEngine.playHarvest();
    const summaryText = `Kode berhasil digunakan: ${messages.join(' & ')}!`;
    showToast(summaryText);
    saveToStorage();
    syncHud();
    return { ok: true, message: summaryText };
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-stone-950">
      {/* Isolated 60fps Canvas Viewport */}
      <canvas
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerLeave}
        onPointerLeave={handleCanvasPointerLeave}
        onWheel={(e) => {
          if (phase !== 'PLAYING') return;
          setZoom((prev) => {
            const idx = ZOOM_PRESETS.indexOf(prev as (typeof ZOOM_PRESETS)[number]);
            if (idx < 0) return 1;
            const next =
              e.deltaY < 0
                ? ZOOM_PRESETS[Math.min(ZOOM_PRESETS.length - 1, idx + 1)]
                : ZOOM_PRESETS[Math.max(0, idx - 1)];
            runtimeRef.current.targetZoom = next;
            return next;
          });
        }}
        className="block w-full h-full cursor-pointer touch-none"
      />

      {phase === 'DEV_SPLASH' && (
        <DevIntroSplash onFinish={() => setPhase('INTRO_VIDEO')} />
      )}

      {phase === 'INTRO_VIDEO' && (
        <IntroCutscene
          volume={volume}
          muted={muted}
          onFinish={() => {
            soundEngine.startBgm();
            setPhase('TITLE_MENU');
          }}
        />
      )}

      {phase === 'TITLE_MENU' && (
        <TitleScreen
          hasSave={hasSave}
          onContinue={handleContinueGame}
          onNewGame={handleNewGame}
        />
      )}

      {phase !== 'TITLE_MENU' && phase !== 'INTRO_VIDEO' && phase !== 'DEV_SPLASH' && (
        <HUD
          gold={hudState.gold}
          xp={hudState.xp}
          bagLevel={hudState.bagLevel}
          year={hudState.year}
          season={hudState.season}
          dayInSeason={hudState.dayInSeason}
          timeMinutes={hudState.timeMinutes}
          weather={hudState.weather}
          rainfallMm={hudState.rainfallMm}
          scene={hudState.scene}
          stats={hudState.stats}
          wateringCanCharges={hudState.wateringCanCharges}
          maxWaterCharges={hudState.upgrades.bigWateringCan ? 45 : 20}
          inventory={hudState.inventory}
          selectedSlot={hudState.hotbarSelected}
          contextPrompt={phase === 'PLAYING' ? contextPrompt : null}
          toastMessage={toastMessage}
          muted={muted}
          zoom={zoom}
          onSelectSlot={(idx) => {
            simRef.current.hotbarSelected = idx;
            syncHud();
          }}
          onOpenBackpack={() => setPhase('BACKPACK_OPEN')}
          onToggleMute={toggleMute}
          onPause={() => setPhase('PAUSED')}
          onTriggerContext={() => {
            if (runtimeRef.current.activeInteract) {
              triggerInteractionZone(runtimeRef.current.activeInteract);
            }
          }}
          onChangeZoom={(nextZoom) => {
            runtimeRef.current.targetZoom = nextZoom;
            setZoom(nextZoom);
          }}
        />
      )}

      {phase === 'PC_OPEN' && (
        <PCModal
          gold={hudState.gold}
          playerLevel={getPlayerLevel(hudState.xp)}
          season={hudState.season}
          dayInSeason={hudState.dayInSeason}
          weather={hudState.weather}
          tomorrowWeather={hudState.tomorrowWeather}
          rainfallMm={hudState.rainfallMm}
          inventory={hudState.inventory}
          upgrades={hudState.upgrades}
          dailyOrder={hudState.dailyOrder}
          onBuyItem={handleBuyItem}
          onBuyAndConsume={handleBuyAndConsume}
          onSellItem={handleSellItem}
          onBuyUpgrade={handleBuyUpgrade}
          onDeliverOrder={handleDeliverOrder}
          onClose={() => setPhase('PLAYING')}
        />
      )}

      {phase === 'BACKPACK_OPEN' && (
        <BackpackModal
          inventory={hudState.inventory}
          xp={hudState.xp}
          bagLevel={hudState.bagLevel}
          selectedHotbarSlot={hudState.hotbarSelected}
          onSelectHotbarSlot={(idx) => {
            simRef.current.hotbarSelected = idx;
            syncHud();
          }}
          onSwapSlots={handleSwapBagSlots}
          onConsumeItem={handleConsumeFromBackpack}
          onUpgradeBag={handleUpgradeBag}
          onClose={() => setPhase('PLAYING')}
        />
      )}

      {phase === 'CABINET_OPEN' && (
        <CabinetModal
          cabinetSlots={hudState.cabinetSlots ?? []}
          inventory={hudState.inventory}
          onStoreItem={handleStoreToCabinet}
          onWithdrawItem={handleWithdrawFromCabinet}
          onSwapCabinetSlots={handleSwapCabinetSlots}
          onClose={() => setPhase('PLAYING')}
        />
      )}

      {phase === 'KITCHEN_OPEN' && (
        <KitchenModal
          homeEatUsedToday={hudState.homeEatUsedToday ?? 0}
          homeDrinkUsedToday={hudState.homeDrinkUsedToday ?? 0}
          stats={hudState.stats}
          inventory={hudState.inventory}
          onHomeWater={handleKitchenDrinkWater}
          onHomeTea={handleKitchenDrinkTea}
          onHomeMeal={handleKitchenEatMeal}
          onConsumeInventoryItem={handleConsumeFromBackpack}
          onClose={() => setPhase('PLAYING')}
        />
      )}

      {phase === 'FRIDGE_OPEN' && (
        <FridgeModal
          fridgeSlots={hudState.fridgeSlots ?? []}
          inventory={hudState.inventory}
          stats={hudState.stats}
          onStoreItem={handleStoreToFridge}
          onWithdrawItem={handleWithdrawFromFridge}
          onEatFromFridge={handleEatFromFridge}
          onSwapFridgeSlots={handleSwapFridgeSlots}
          onClose={() => setPhase('PLAYING')}
        />
      )}

      {phase === 'PAUSED' && (
        <PauseModal
          muted={muted}
          volume={volume}
          musicVolume={musicVolume}
          onChangeVolume={handleChangeVolume}
          onChangeMusicVolume={handleChangeMusicVolume}
          onToggleMute={toggleMute}
          onRedeemCode={handleRedeemCode}
          onResume={() => setPhase('PLAYING')}
          onSaveNow={() => {
            saveToStorage();
            showToast('Progres permainan tersimpan!');
            setPhase('PLAYING');
          }}
          onExitToTitle={() => {
            saveToStorage();
            setPhase('TITLE_MENU');
          }}
        />
      )}

      {phase === 'SLEEP_CONFIRM' && (
        <SleepConfirmModal
          timeMinutes={hudState.timeMinutes}
          onConfirmSleep={() => endDayAndSleep(false)}
          onCancel={() => setPhase('PLAYING')}
        />
      )}

      {phase === 'PLAYING' && hudState.scene === 'LAB' && (
        <div className="fixed bottom-4 right-4 z-30 bg-stone-900/95 border border-stone-700/85 rounded-xl p-2.5 shadow-xl flex flex-col gap-2 max-w-xs">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-bold text-amber-300 flex items-center gap-1.5">
              <Bot className="w-4 h-4 shrink-0" />
              <span>Robot Mecha Penjaga</span>
            </span>
            <span className="font-mono-num text-stone-200 font-semibold">
              {hudState.robot.owned
                ? 'Milikmu'
                : hudState.robot.defeatedToday
                ? 'Reset 03:00'
                : `HP ${hudState.robot.hp}/${hudState.robot.maxHp}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!hudState.robot.owned && !hudState.robot.defeatedToday && (
              <button
                onClick={attackRobot}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
              >
                <Sword className="w-3.5 h-3.5" />
                <span>Serang Robot</span>
              </button>
            )}
            <button
              onClick={() => setPhase('ROBOT_RECRUIT')}
              className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-100 font-semibold text-xs whitespace-nowrap cursor-pointer transition-colors"
            >
              {hudState.robot.owned ? 'Status Robot' : 'Miliki Robot (Lv.7)'}
            </button>
          </div>
        </div>
      )}

      {phase === 'PLAYING' && hudState.scene === 'FOREST' && (riverStatus.inRiver || riverStatus.nearbyCount > 0) && (
        <div className="fixed bottom-4 right-4 z-30 bg-stone-900/95 border border-sky-700/70 rounded-xl p-3 shadow-xl flex flex-col gap-2 min-w-[235px] max-w-xs">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-bold text-sky-300 flex items-center gap-1.5">
              <Waves className="w-4 h-4 shrink-0" />
              <span>Sungai Hutan</span>
            </span>
            <span className="font-mono-num text-stone-300 font-semibold">
              Wader · Lele · Tomang
            </span>
          </div>

          {riverStatus.inRiver ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] text-sky-200">
                <span>Menunggu ikan (jembatan / sungai)...</span>
                <span className="font-mono-num font-bold">
                  {riverStatus.waitSec.toFixed(1)} / 5.0s
                </span>
              </div>
              <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, (riverStatus.waitSec / 5) * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-stone-300 leading-snug">
              Berdiri di jembatan atau turun ke sungai &amp; tunggu tiap 5 detik untuk menangkap ikan.
            </div>
          )}

          <button
            onClick={() => catchRiverFish()}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
              riverStatus.nearbyCount > 0
                ? 'bg-sky-500 hover:bg-sky-400 text-stone-950 animate-pulse'
                : 'bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-200'
            }`}
          >
            <Fish className="w-3.5 h-3.5" />
            <span>
              {riverStatus.nearbyCount > 0
                ? `Tangkap Ikan (${riverStatus.nearbyCount})`
                : 'Tangkap Ikan (Spasi)'}
            </span>
          </button>
        </div>
      )}

      {phase === 'ROBOT_RECRUIT' && (
        <RobotRecruitModal
          playerLevel={getPlayerLevel(hudState.xp)}
          kalabasCount={hudState.inventory.find((s) => s.itemId === 'buah_kalabas')?.quantity ?? 0}
          gold={hudState.gold}
          robotOwned={hudState.robot.owned}
          onRecruit={handleRecruitRobot}
          onClose={() => setPhase('PLAYING')}
        />
      )}

      {phase === 'DAY_SUMMARY' && daySummary && (
        <DaySummaryModal
          summary={daySummary}
          onNextDay={() => {
            setDaySummary(null);
            setPhase('PLAYING');
          }}
        />
      )}
    </div>
  );
}
