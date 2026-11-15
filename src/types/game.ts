export type Season = 'MARENG' | 'KEMARAU' | 'LABUH' | 'PENGHUJAN';

export type WeatherType = 'CERAH' | 'BERAWAN' | 'GERIMIS' | 'HUJAN_DERAS';

export type SceneId = 'FARM' | 'HOUSE' | 'FOREST' | 'ORCHARD' | 'LAB' | 'RIVER' | 'PEAK' | 'CLIFF';

export type GamePhase =
  | 'DEV_SPLASH'
  | 'INTRO_VIDEO'
  | 'TITLE_MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'PC_OPEN'
  | 'BACKPACK_OPEN'
  | 'CABINET_OPEN'
  | 'FRIDGE_OPEN'
  | 'KITCHEN_OPEN'
  | 'SLEEP_CONFIRM'
  | 'ROBOT_RECRUIT'
  | 'DAY_SUMMARY';

export type ItemCategory = 'TOOL' | 'WEAPON' | 'SEED' | 'CROP' | 'FORAGE' | 'FISH' | 'CONSUMABLE' | 'RESOURCE';

export type ToolKind = 'HOE' | 'WATERING_CAN' | 'AXE' | 'SCYTHE';

export type WeaponKind = 'SWORD' | 'RIFLE';

export interface ItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  description: string;
  buyPrice?: number;
  sellPrice?: number;
  toolKind?: ToolKind;
  weaponKind?: WeaponKind;
  cropId?: string;
  restoreHealth?: number;
  restoreMood?: number;
  boostSpeed?: number;
  iconColor: string;
  accentColor: string;
}

export interface CropDef {
  id: string;
  seedId: string;
  harvestId: string;
  name: string;
  season: Season;
  growthDays: number;
  regrowDays?: number;
  rainPreference: 'RENDAH' | 'SEDANG' | 'TINGGI';
  droughtResistant?: boolean;
  waterLover?: boolean; // grows faster during rain
  seedPrice: number;
  sellPrice: number;
  description: string;
  colors: {
    sprout: string;
    leaf: string;
    fruit: string;
  };
}

export interface PlotState {
  key: string; // `${scene}:${tx}:${ty}`
  scene: 'FARM' | 'ORCHARD';
  tx: number;
  ty: number;
  tilled: boolean;
  watered: boolean;
  fertilized: boolean;
  dryDays: number; // consecutive unwatered days (risk in Kemarau)
  cropId: string | null;
  growthProgress: number; // 0 to crop.growthDays
  readyToHarvest: boolean;
  wilted: boolean;
}

export interface WorldObject {
  id: string;
  scene: SceneId;
  tx: number;
  ty: number;
  kind: 'TREE' | 'FRUIT_TREE' | 'WEED' | 'TWIG' | 'ROCK' | 'FORAGE';
  itemId?: string; // for forage or fruit tree
  quantity?: number; // stack quantity dropped on pickup (e.g. 3 pcs fallen Kalabas)
  hp: number;
  maxHp: number;
  harvestReady?: boolean;
  regrowTimer?: number;
  label?: string;
}

export interface InventorySlot {
  itemId: string;
  quantity: number;
}

export interface PlayerStats {
  health: number; // 0 - 100
  mood: number;   // 0 - 100
  speed: number;  // 0 - 100
}

export interface UpgradesState {
  bigWateringCan: boolean; // 40 capacity + waters 1x3 or faster
  steelHoe: boolean;       // faster till + 1x3 front sweep option
  rainBoots: boolean;      // prevents mood/speed penalty in heavy rain
  orchardDeed: boolean;    // bought for 1,000,000 EG
  orchardLeftDeed: boolean;  // left plot of Kebun Atas (min Lv.5, 3,500,000 EG)
  orchardRightDeed: boolean; // right plot of Kebun Atas (min Lv.5, 3,750,000 EG)
  peakGateOpened: boolean;   // leftmost Puncak Gunung sealed gate unlocked by owned Robot Mecha
}

export interface RobotState {
  owned: boolean;
  defeatedToday: boolean;
  hp: number;
  maxHp: number;
}

export interface DailyOrder {
  itemId: string;
  itemName: string;
  requiredQty: number;
  deliveredQty: number;
  bonusPerUnit: number;
  completed: boolean;
}

export interface DaySummaryData {
  prevDay: number;
  prevSeason: Season;
  nextDay: number;
  nextSeason: Season;
  seasonChanged: boolean;
  fainted: boolean;
  faintPenalty: number;
  cropsGrown: number;
  rainWateredCount: number;
  wiltedCount: number;
  rainfallMm: number;
  weatherNext: WeatherType;
}

export interface SaveData {
  version: number;
  gold: number;
  year: number;
  season: Season;
  dayInSeason: number; // 1..14
  timeMinutes: number; // 360 (06:00) .. 1440 (00:00)
  weather: WeatherType;
  tomorrowWeather: WeatherType;
  rainfallMm: number;
  scene: SceneId;
  playerX: number;
  playerY: number;
  stats: PlayerStats;
  wateringCanCharges: number;
  upgrades: UpgradesState;
  robot: RobotState;
  hotbarSelected: number; // 0..8
  inventory: InventorySlot[]; // first 9 are hotbar (0-3 tools, 4-8 quick items), rest in backpack
  plots: Record<string, PlotState>;
  worldObjects: WorldObject[];
  dailyOrder: DailyOrder | null;
  xp: number;
  xpMoneyRemainder: number;
  bagLevel: number; // 1..9 (9 slots at Lv1, +3 slots per level upgrade)
  kalabasDropDays: number; // counts days until next fallen Kalabas drop (every 2 days)
  kalabasFruitDays?: number; // counts days until next 3-day random half-tree Kalabas fruiting cycle
  homeEatUsedToday?: number; // free home cooked meals used today
  homeDrinkUsedToday?: number; // free home tea drinks used today
  wcUsedToday?: boolean; // morning WC usage once per day
  fridgeSlots?: (InventorySlot | null)[]; // 5x3 slots * 5 pages = 75 food storage slots
  cabinetSlots?: (InventorySlot | null)[]; // 5x3 slots * 5 pages = 75 non-food storage slots
  totalEarned: number;
  totalHarvested: number;
}
