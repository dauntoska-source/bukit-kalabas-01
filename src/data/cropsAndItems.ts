import { CropDef, ItemDef, Season, WeatherType } from '../types/game';

export const SEASON_ORDER: Season[] = ['MARENG', 'KEMARAU', 'LABUH', 'PENGHUJAN'];
export const DAYS_PER_SEASON = 14;
export const ORCHARD_PRICE = 1_000_000;
export const ORCHARD_LEFT_PRICE = 3_500_000;
export const ORCHARD_RIGHT_PRICE = 3_750_000;
export const ORCHARD_PLOT_MIN_LEVEL = 5;
export const REAL_SECONDS_PER_DAY = 540; // 1 hari game = 9 menit waktu nyata (540 detik)
export const DAY_START_MINUTES = 360;    // 06:00
export const DAY_MAX_MINUTES = 1440;     // 00:00 (tidur maksimal jam 00.00)

export const MAX_PLAYER_LEVEL = 9;
export const BASE_BAG_SLOTS = 9;
export const SLOTS_PER_BAG_UPGRADE = 3;

export function getPlayerLevel(xp: number): number {
  if (xp < 200) return 1;
  return Math.min(MAX_PLAYER_LEVEL, Math.floor(xp / 100));
}

export function getLevelMinXp(level: number): number {
  if (level <= 1) return 0;
  return level * 100;
}

export function getNextLevelXp(level: number): number | null {
  if (level >= MAX_PLAYER_LEVEL) return null;
  return level === 1 ? 200 : (level + 1) * 100;
}

export function getBagCapacity(bagLevel: number): number {
  const clamped = Math.max(1, Math.min(MAX_PLAYER_LEVEL, bagLevel));
  return BASE_BAG_SLOTS + (clamped - 1) * SLOTS_PER_BAG_UPGRADE;
}

export interface SeasonMeta {
  id: Season;
  name: string;
  subtitle: string;
  description: string;
  rainfallRange: string;
  soilBehavior: string;
  accentHex: string;
  tintHex: string;
  weatherWeights: Record<WeatherType, number>;
}

export const SEASONS: Record<Season, SeasonMeta> = {
  MARENG: {
    id: 'MARENG',
    name: 'Mareng',
    subtitle: 'Peralihan Hujan ke Kemarau',
    description: 'Angin sejuk berhembus dari timur, curah hujan mulai berkurang bertahap. Tanah masih menyimpan kelembapan sisa hujan.',
    rainfallRange: 'Curah hujan sedang (15–35 mm/hari)',
    soilBehavior: 'Tanah cukup lembap di awal musim, mulai mengering menjelang akhir Mareng.',
    accentHex: '#D97706',
    tintHex: 'rgba(217, 119, 6, 0.06)',
    weatherWeights: { CERAH: 35, BERAWAN: 30, GERIMIS: 25, HUJAN_DERAS: 10 },
  },
  KEMARAU: {
    id: 'KEMARAU',
    name: 'Kemarau',
    subtitle: 'Musim Panas & Kering',
    description: 'Matahari bersinar terik sepanjang hari dan hujan sangat jarang turun. Penyiraman rutin wajib dilakukan agar tanaman tidak layu.',
    rainfallRange: 'Curah hujan sangat rendah (0–5 mm/hari)',
    soilBehavior: 'Penguapan tinggi! Tanaman non-tahan kering akan layu jika 2 hari berturut-turut tidak disiram.',
    accentHex: '#EA580C',
    tintHex: 'rgba(234, 88, 12, 0.08)',
    weatherWeights: { CERAH: 72, BERAWAN: 20, GERIMIS: 7, HUJAN_DERAS: 1 },
  },
  LABUH: {
    id: 'LABUH',
    name: 'Labuh',
    subtitle: 'Peralihan Kemarau ke Hujan',
    description: 'Awan mendung mulai menyelimuti langit Nusantara. Hujan rintik turun berkala menyuburkan kembali tanah yang kering.',
    rainfallRange: 'Curah hujan meningkat (20–45 mm/hari)',
    soilBehavior: 'Siklus gerimis membantu mengairi kebun secara alami secara berkala.',
    accentHex: '#0D9488',
    tintHex: 'rgba(13, 148, 136, 0.06)',
    weatherWeights: { CERAH: 22, BERAWAN: 28, GERIMIS: 35, HUJAN_DERAS: 15 },
  },
  PENGHUJAN: {
    id: 'PENGHUJAN',
    name: 'Penghujan',
    subtitle: 'Musim Hujan Lebat',
    description: 'Curah hujan lokal tinggi menyirami seluruh ladang hampir setiap hari. Tanaman sawah dan air tumbuh sangat cepat.',
    rainfallRange: 'Curah hujan tinggi (45–90 mm/hari)',
    soilBehavior: 'Hujan otomatis menyiram kebun. Gunakan Sepatu Boot agar Mood & Speed tetap prima saat hujan deras.',
    accentHex: '#0284C7',
    tintHex: 'rgba(2, 132, 199, 0.08)',
    weatherWeights: { CERAH: 10, BERAWAN: 15, GERIMIS: 35, HUJAN_DERAS: 40 },
  },
};

export const WEATHER_LABELS: Record<WeatherType, { label: string; mmRange: [number, number]; watersCrops: boolean }> = {
  CERAH: { label: 'Cerah Terik', mmRange: [0, 0], watersCrops: false },
  BERAWAN: { label: 'Berawan', mmRange: [0, 3], watersCrops: false },
  GERIMIS: { label: 'Gerimis', mmRange: [12, 26], watersCrops: true },
  HUJAN_DERAS: { label: 'Hujan Deras', mmRange: [45, 88], watersCrops: true },
};

// 12 Seasonal Crops (3 per Indonesian season)
export const CROPS: Record<string, CropDef> = {
  // === MARENG (3 tanaman) ===
  cabai_rawit: {
    id: 'cabai_rawit',
    seedId: 'bibit_cabai_rawit',
    harvestId: 'panen_cabai_rawit',
    name: 'Cabai Rawit',
    season: 'MARENG',
    growthDays: 4,
    regrowDays: 2,
    rainPreference: 'SEDANG',
    seedPrice: 70,
    sellPrice: 95,
    description: 'Dapat dipanen berulang setiap 2 hari! Pedas dan sangat dicari pasar online.',
    colors: { sprout: '#4D7C0F', leaf: '#15803D', fruit: '#EF4444' },
  },
  bawang_merah: {
    id: 'bawang_merah',
    seedId: 'bibit_bawang_merah',
    harvestId: 'panen_bawang_merah',
    name: 'Bawang Merah',
    season: 'MARENG',
    growthDays: 3,
    rainPreference: 'RENDAH',
    seedPrice: 65,
    sellPrice: 185,
    description: 'Primadona musim Mareng! Nilai jual tinggi jika disiram rutin di cuaca cerah.',
    colors: { sprout: '#65A30D', leaf: '#166534', fruit: '#A21CAF' },
  },
  bawang_putih: {
    id: 'bawang_putih',
    seedId: 'bibit_bawang_putih',
    harvestId: 'panen_bawang_putih',
    name: 'Bawang Putih',
    season: 'MARENG',
    growthDays: 3,
    rainPreference: 'SEDANG',
    seedPrice: 60,
    sellPrice: 175,
    description: 'Bawang aromatik yang tumbuh baik di musim Mareng dan bernilai jual tinggi.',
    colors: { sprout: '#84CC16', leaf: '#4D7C0F', fruit: '#F5F5DC' },
  },

  // === KEMARAU (3 tanaman) ===
  jagung_manis: {
    id: 'jagung_manis',
    seedId: 'bibit_jagung_manis',
    harvestId: 'panen_jagung_manis',
    name: 'Jagung Manis',
    season: 'KEMARAU',
    growthDays: 3,
    rainPreference: 'SEDANG',
    seedPrice: 40,
    sellPrice: 105,
    description: 'Tumbuh kokoh di musim Kemarau. Tumbuh optimal dengan penyiraman rutin.',
    colors: { sprout: '#65A30D', leaf: '#2E7D32', fruit: '#FACC15' },
  },
  kedelai: {
    id: 'kedelai',
    seedId: 'bibit_kedelai',
    harvestId: 'panen_kedelai',
    name: 'Kedelai Lokal',
    season: 'KEMARAU',
    growthDays: 2,
    rainPreference: 'RENDAH',
    seedPrice: 25,
    sellPrice: 65,
    description: 'Cepat panen dalam 2 hari dan cocok untuk musim Kemarau.',
    colors: { sprout: '#84CC16', leaf: '#4D7C0F', fruit: '#D97706' },
  },
  singkong: {
    id: 'singkong',
    seedId: 'bibit_singkong',
    harvestId: 'panen_singkong',
    name: 'Singkong',
    season: 'KEMARAU',
    growthDays: 3,
    rainPreference: 'RENDAH',
    droughtResistant: true,
    seedPrice: 20,
    sellPrice: 70,
    description: 'Tahan banting! Tidak akan layu meski lupa disiram saat Kemarau terik.',
    colors: { sprout: '#84CC16', leaf: '#3F6212', fruit: '#92400E' },
  },

  // === LABUH (3 tanaman) ===
  kacang_tanah: {
    id: 'kacang_tanah',
    seedId: 'bibit_kacang_tanah',
    harvestId: 'panen_kacang_tanah',
    name: 'Kacang Tanah',
    season: 'LABUH',
    growthDays: 3,
    rainPreference: 'SEDANG',
    seedPrice: 45,
    sellPrice: 120,
    description: 'Cocok ditanam saat hujan awal Labuh membasahi tanah gembur.',
    colors: { sprout: '#65A30D', leaf: '#16A34A', fruit: '#B45309' },
  },
  tomat_lokal: {
    id: 'tomat_lokal',
    seedId: 'bibit_tomat_lokal',
    harvestId: 'panen_tomat_lokal',
    name: 'Tomat Lokal',
    season: 'LABUH',
    growthDays: 4,
    regrowDays: 2,
    rainPreference: 'SEDANG',
    seedPrice: 75,
    sellPrice: 105,
    description: 'Berbuah terus-menerus setiap 2 hari setelah panen pertama.',
    colors: { sprout: '#4D7C0F', leaf: '#15803D', fruit: '#DC2626' },
  },
  terong_ungu: {
    id: 'terong_ungu',
    seedId: 'bibit_terong_ungu',
    harvestId: 'panen_terong_ungu',
    name: 'Terong Ungu',
    season: 'LABUH',
    growthDays: 3,
    rainPreference: 'SEDANG',
    seedPrice: 55,
    sellPrice: 150,
    description: 'Tumbuh subur dengan curah hujan gerimis musim Labuh.',
    colors: { sprout: '#65A30D', leaf: '#14532D', fruit: '#7E22CE' },
  },

  // === PENGHUJAN (3 tanaman) ===
  padi_sawah: {
    id: 'padi_sawah',
    seedId: 'bibit_padi_sawah',
    harvestId: 'panen_padi_sawah',
    name: 'Padi Sawah',
    season: 'PENGHUJAN',
    growthDays: 4,
    rainPreference: 'TINGGI',
    waterLover: true,
    seedPrice: 50,
    sellPrice: 165,
    description: 'Padi unggulan! Tumbuh lebih cepat saat turun hujan deras.',
    colors: { sprout: '#4ADE80', leaf: '#16A34A', fruit: '#EAB308' },
  },
  kangkung: {
    id: 'kangkung',
    seedId: 'bibit_kangkung',
    harvestId: 'panen_kangkung',
    name: 'Kangkung Air',
    season: 'PENGHUJAN',
    growthDays: 2,
    rainPreference: 'TINGGI',
    waterLover: true,
    seedPrice: 25,
    sellPrice: 70,
    description: 'Sayuran super cepat panen yang sangat menyukai limpahan air hujan.',
    colors: { sprout: '#34D399', leaf: '#059669', fruit: '#10B981' },
  },
  talas: {
    id: 'talas',
    seedId: 'bibit_talas',
    harvestId: 'panen_talas',
    name: 'Talas Bogor',
    season: 'PENGHUJAN',
    growthDays: 4,
    rainPreference: 'TINGGI',
    waterLover: true,
    seedPrice: 85,
    sellPrice: 270,
    description: 'Umbi berdaun lebar bernilai jual tinggi di puncak musim Penghujan.',
    colors: { sprout: '#22C55E', leaf: '#047857', fruit: '#7C3AED' },
  },
};

export const ITEMS: Record<string, ItemDef> = {
  // Tools (Slots 1-4)
  tool_hoe: {
    id: 'tool_hoe',
    name: 'Cangkul',
    category: 'TOOL',
    toolKind: 'HOE',
    description: 'Menggemburkan tanah kebun untuk ditanami bibit.',
    iconColor: '#94A3B8',
    accentColor: '#78350F',
  },
  tool_watering_can: {
    id: 'tool_watering_can',
    name: 'Ember Siram',
    category: 'TOOL',
    toolKind: 'WATERING_CAN',
    description: 'Menyiram tanah & tanaman. Isi ulang di Sumur atau Sungai Hutan.',
    iconColor: '#38BDF8',
    accentColor: '#0284C7',
  },
  tool_axe: {
    id: 'tool_axe',
    name: 'Kapak',
    category: 'TOOL',
    toolKind: 'AXE',
    description: 'Menebang pohon kayu di Hutan & membersihkan ranting.',
    iconColor: '#CBD5E1',
    accentColor: '#92400E',
  },
  tool_scythe: {
    id: 'tool_scythe',
    name: 'Sabit',
    category: 'TOOL',
    toolKind: 'SCYTHE',
    description: 'Memanen tanaman siap panen & membabat rumput liar.',
    iconColor: '#E2E8F0',
    accentColor: '#B45309',
  },

  // Resources & Forageables
  kayu_hutan: {
    id: 'kayu_hutan',
    name: 'Kayu Hutan',
    category: 'RESOURCE',
    sellPrice: 25,
    description: 'Kayu keras hasil tebangan dari Hutan sebelah kanan.',
    iconColor: '#92400E',
    accentColor: '#D97706',
  },
  batu_alam: {
    id: 'batu_alam',
    name: 'Batu Alam',
    category: 'RESOURCE',
    sellPrice: 20,
    description: 'Batu kali dari ladang dan tepi hutan.',
    iconColor: '#64748B',
    accentColor: '#94A3B8',
  },
  jamur_liar: {
    id: 'jamur_liar',
    name: 'Jamur Hutan',
    category: 'FORAGE',
    sellPrice: 65,
    restoreHealth: 15,
    restoreMood: 8,
    description: 'Jamur segar dari Hutan. Bisa dimakan atau dijual online.',
    iconColor: '#FDE68A',
    accentColor: '#B45309',
  },
  daun_herbal: {
    id: 'daun_herbal',
    name: 'Daun Herbal',
    category: 'FORAGE',
    sellPrice: 90,
    restoreHealth: 22,
    restoreMood: 12,
    description: 'Tanaman obat hutan tropis berkhasiat memulihkan stamina.',
    iconColor: '#34D399',
    accentColor: '#065F46',
  },
  akar_ginseng: {
    id: 'akar_ginseng',
    name: 'Akar Ginseng Jawa',
    category: 'FORAGE',
    sellPrice: 280,
    restoreHealth: 40,
    restoreMood: 20,
    boostSpeed: 15,
    description: 'Temuan langka di dalam Hutan! Bernilai tinggi di Pasar Online.',
    iconColor: '#FBBF24',
    accentColor: '#78350F',
  },

  // Kebun Atas Orchard Fruits
  buah_mangga: {
    id: 'buah_mangga',
    name: 'Mangga Harum Manis',
    category: 'CROP',
    sellPrice: 450,
    restoreHealth: 25,
    restoreMood: 25,
    description: 'Mangga premium dari pohon abadi di Kebun Atas.',
    iconColor: '#F59E0B',
    accentColor: '#16A34A',
  },
  buah_durian: {
    id: 'buah_durian',
    name: 'Durian Nusantara',
    category: 'CROP',
    sellPrice: 1200,
    restoreHealth: 45,
    restoreMood: 35,
    description: 'Raja buah dari Kebun Atas! Harga jual sangat tinggi di pasar online.',
    iconColor: '#CA8A04',
    accentColor: '#713F12',
  },
  kelapa_gading: {
    id: 'kelapa_gading',
    name: 'Kelapa Gading',
    category: 'CROP',
    sellPrice: 380,
    restoreHealth: 20,
    restoreMood: 20,
    boostSpeed: 20,
    description: 'Kelapa muda menyegarkan dari Kebun Atas.',
    iconColor: '#FACC15',
    accentColor: '#15803D',
  },
  buah_kalabas: {
    id: 'buah_kalabas',
    name: 'Buah Kalabas (Berenuk)',
    category: 'CROP',
    sellPrice: 320,
    description: 'Buah keras dari pohon kalabas tua di sekitar Lab (tidak dapat dimakan). Kumpulkan 100 pcs (+1 Juta EG di Lv.7) untuk memiliki Robot Mecha!',
    iconColor: '#4D7C0F',
    accentColor: '#BEF264',
  },

  // Pinggiran Kali Fish (hanya 3 jenis: wader paling murah, lele sedang, tomang paling mahal)
  ikan_wader: {
    id: 'ikan_wader',
    name: 'Ikan Wader',
    category: 'FISH',
    sellPrice: 85,
    restoreHealth: 10,
    restoreMood: 8,
    description: 'Ikan kecil lincah yang hanyut di arus sungai Pinggiran Kali. Harga jual paling terjangkau.',
    iconColor: '#94A3B8',
    accentColor: '#E2E8F0',
  },
  ikan_lele: {
    id: 'ikan_lele',
    name: 'Ikan Lele',
    category: 'FISH',
    sellPrice: 240,
    restoreHealth: 22,
    restoreMood: 15,
    description: 'Ikan berkumis khas sungai Nusantara dengan nilai jual menengah di TaniNet.',
    iconColor: '#334155',
    accentColor: '#64748B',
  },
  ikan_tomang: {
    id: 'ikan_tomang',
    name: 'Ikan Tomang',
    category: 'FISH',
    sellPrice: 680,
    restoreHealth: 40,
    restoreMood: 25,
    description: 'Ikan predator sungai besar bercorak loreng. Ikan tangkapan paling mahal dari Pinggiran Kali!',
    iconColor: '#0F766E',
    accentColor: '#F59E0B',
  },

  // Anti-Robot Lab Weapons (Rewards from defeating the Brown Robot)
  weapon_sword: {
    id: 'weapon_sword',
    name: 'Pedang Baja Lab',
    category: 'WEAPON',
    weaponKind: 'SWORD',
    sellPrice: 50_000,
    description: 'Pedang tajam peninggalan laboratorium penelitian. Memberikan tebasan kuat (38 Dmg) untuk mengalahkan Robot Coklat.',
    iconColor: '#38BDF8',
    accentColor: '#F59E0B',
  },
  weapon_rifle: {
    id: 'weapon_rifle',
    name: 'Senapan Energi Lab',
    category: 'WEAPON',
    weaponKind: 'RIFLE',
    sellPrice: 75_000,
    description: 'Senapan jarak jauh peninggalan laboratorium penelitian. Menembakkan peluru energi (45 Dmg) ke Robot Coklat dari jauh.',
    iconColor: '#F59E0B',
    accentColor: '#92400E',
  },

  // Consumables (Bought via PC Online Shop)
  paket_sarapan: {
    id: 'paket_sarapan',
    name: 'Sarapan Pagi Online',
    category: 'CONSUMABLE',
    buyPrice: 45,
    sellPrice: 20,
    restoreHealth: 25,
    boostSpeed: 20,
    description: 'Sarapan hangat via online untuk mengawali pagi: Health (+25) & Speed (+20).',
    iconColor: '#FBBF24',
    accentColor: '#EA580C',
  },
  kopi_tubruk: {
    id: 'kopi_tubruk',
    name: 'Kopi Tubruk',
    category: 'CONSUMABLE',
    buyPrice: 60,
    sellPrice: 25,
    restoreHealth: 10,
    restoreMood: 30,
    boostSpeed: 30,
    description: 'Meningkatkan Speed (+30) & Mood (+30) secara instan!',
    iconColor: '#451A03',
    accentColor: '#D97706',
  },
  jamu_kencur: {
    id: 'jamu_kencur',
    name: 'Jamu Beras Kencur',
    category: 'CONSUMABLE',
    buyPrice: 95,
    sellPrice: 40,
    restoreHealth: 45,
    restoreMood: 20,
    boostSpeed: 15,
    description: 'Minuman tradisional memulihkan Health (+45), Mood (+20) & Speed (+15).',
    iconColor: '#F59E0B',
    accentColor: '#FEF3C7',
  },
  nasi_uduk: {
    id: 'nasi_uduk',
    name: 'Nasi Uduk Komplit',
    category: 'CONSUMABLE',
    buyPrice: 140,
    sellPrice: 60,
    restoreHealth: 70,
    restoreMood: 35,
    boostSpeed: 10,
    description: 'Makanan mengenyangkan untuk memulihkan Health (+70) dan Mood (+35).',
    iconColor: '#F8FAFC',
    accentColor: '#DC2626',
  },
  es_kelapa: {
    id: 'es_kelapa',
    name: 'Es Kelapa Muda',
    category: 'CONSUMABLE',
    buyPrice: 80,
    sellPrice: 30,
    restoreHealth: 25,
    restoreMood: 40,
    boostSpeed: 25,
    description: 'Penyegar dahaga di musim Kemarau! Mood (+40), Speed (+25).',
    iconColor: '#E0F2FE',
    accentColor: '#22C55E',
  },
  pupuk_kompos: {
    id: 'pupuk_kompos',
    name: 'Pupuk Organik',
    category: 'CONSUMABLE',
    buyPrice: 35,
    sellPrice: 15,
    description: 'Taburkan di tanah cangkulan agar nilai jual panen berlipat 1.5x!',
    iconColor: '#78350F',
    accentColor: '#84CC16',
  },
};

// Dynamically register all 12 seeds and 12 harvested crops into ITEMS
Object.values(CROPS).forEach((crop) => {
  ITEMS[crop.seedId] = {
    id: crop.seedId,
    name: `Bibit ${crop.name}`,
    category: 'SEED',
    cropId: crop.id,
    buyPrice: crop.seedPrice,
    sellPrice: Math.floor(crop.seedPrice * 0.5),
    description: `Musim ${SEASONS[crop.season].name} · Panen ${crop.growthDays} hari${crop.regrowDays ? ` (panen ulang ${crop.regrowDays}h)` : ''}.`,
    iconColor: crop.colors.leaf,
    accentColor: crop.colors.fruit,
  };

  ITEMS[crop.harvestId] = {
    id: crop.harvestId,
    name: crop.name,
    category: 'CROP',
    cropId: crop.id,
    sellPrice: crop.sellPrice,
    restoreHealth: 12,
    restoreMood: 10,
    description: `Hasil panen ${crop.name} berkualitas dari ladang Nusantara.`,
    iconColor: crop.colors.fruit,
    accentColor: crop.colors.leaf,
  };
});

export function rollWeatherForSeason(season: Season): { weather: WeatherType; rainfallMm: number } {
  const weights = SEASONS[season].weatherWeights;
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let picked: WeatherType = 'CERAH';
  for (const [w, weight] of Object.entries(weights) as [WeatherType, number][]) {
    r -= weight;
    if (r <= 0) {
      picked = w;
      break;
    }
  }
  const [minMm, maxMm] = WEATHER_LABELS[picked].mmRange;
  const rainfallMm = minMm === maxMm ? minMm : Math.round(minMm + Math.random() * (maxMm - minMm));
  return { weather: picked, rainfallMm };
}
