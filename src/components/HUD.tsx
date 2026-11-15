import React from 'react';
import { Backpack, CloudRain, CloudSun, Coins, Heart, Pause, Smile, Sun, Volume2, VolumeX, Wind, Zap, ZoomIn, ZoomOut } from 'lucide-react';
import {
  getBagCapacity,
  getNextLevelXp,
  getPlayerLevel,
  ITEMS,
  SEASONS,
  WEATHER_LABELS,
} from '../data/cropsAndItems';
import { InventorySlot, PlayerStats, SceneId, Season, WeatherType } from '../types/game';
import { SCENE_MAPS } from '../engine/maps';
import { FARMER_IMAGE_URL } from '../utils/spriteLoader';
import { ItemIcon } from './ItemIcon';

interface HUDProps {
  gold: number;
  xp: number;
  bagLevel: number;
  year: number;
  season: Season;
  dayInSeason: number;
  timeMinutes: number;
  weather: WeatherType;
  rainfallMm: number;
  scene: SceneId;
  stats: PlayerStats;
  wateringCanCharges: number;
  maxWaterCharges: number;
  inventory: InventorySlot[];
  selectedSlot: number;
  contextPrompt: string | null;
  toastMessage: string | null;
  muted: boolean;
  zoom: number;
  onSelectSlot: (idx: number) => void;
  onOpenBackpack: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  onTriggerContext: () => void;
  onChangeZoom: (nextZoom: number) => void;
}

export const ZOOM_PRESETS = [0.5, 0.75, 1, 1.5, 2] as const;

export function formatGameClock(timeMinutes: number): string {
  const clamped = Math.min(1440, Math.max(360, Math.floor(timeMinutes)));
  const displayTotal = Math.floor(clamped / 10) * 10;
  const hh = Math.floor(displayTotal / 60) % 24;
  const mm = displayTotal % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export const HUD: React.FC<HUDProps> = ({
  gold,
  xp,
  bagLevel,
  year,
  season,
  dayInSeason,
  timeMinutes,
  weather,
  rainfallMm,
  scene,
  stats,
  wateringCanCharges,
  maxWaterCharges,
  inventory,
  selectedSlot,
  contextPrompt,
  toastMessage,
  muted,
  zoom,
  onSelectSlot,
  onOpenBackpack,
  onToggleMute,
  onPause,
  onTriggerContext,
  onChangeZoom,
}) => {
  const seasonMeta = SEASONS[season];
  const weatherMeta = WEATHER_LABELS[weather];
  const selectedItem = inventory[selectedSlot] ? ITEMS[inventory[selectedSlot].itemId] : null;
  const isLateNight = timeMinutes >= 1320;

  const playerLevel = getPlayerLevel(xp);
  const nextLevelXp = getNextLevelXp(playerLevel);
  const maxBagSlots = getBagCapacity(bagLevel);
  const hasBagUpgradeReady = playerLevel > bagLevel;

  const renderWeatherIcon = () => {
    if (weather === 'HUJAN_DERAS' || weather === 'GERIMIS') return <CloudRain className="w-4 h-4 text-sky-400" />;
    if (weather === 'BERAWAN') return <CloudSun className="w-4 h-4 text-stone-300" />;
    return <Sun className="w-4 h-4 text-amber-400" />;
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-20 flex flex-col justify-between p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col items-start gap-2.5">
          <div className="pointer-events-auto bg-stone-900/95 border border-stone-700/80 rounded-xl p-2.5 shadow-lg flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-800 border border-stone-600 shrink-0">
              <img src={FARMER_IMAGE_URL} alt="Petani" referrerPolicy="no-referrer" className="w-full h-full object-cover object-top" />
            </div>
            <div className="flex flex-col gap-1 min-w-[168px]">
              <div className="flex items-center justify-between text-[11px] pb-0.5 border-b border-stone-800">
                <span className="font-bold text-amber-300">Level {playerLevel}/9</span>
                <span className="font-mono-num text-stone-400">{nextLevelXp ? `${xp}/${nextLevelXp} XP` : `${xp} XP (Maks)`}</span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <Heart className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="text-stone-300 w-11 shrink-0 font-medium">Health</span>
                <div className="flex-1 h-1.5 bg-stone-800 rounded-sm overflow-hidden">
                  <div className="h-full bg-rose-500 transition-transform duration-150 origin-left" style={{ transform: `scaleX(${Math.max(0, Math.min(1, stats.health / 100))})` }} />
                </div>
                <span className="font-mono-num text-[11px] text-stone-200 w-7 text-right">{Math.round(stats.health)}</span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <Smile className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-stone-300 w-11 shrink-0 font-medium">Mood</span>
                <div className="flex-1 h-1.5 bg-stone-800 rounded-sm overflow-hidden">
                  <div className="h-full bg-amber-400 transition-transform duration-150 origin-left" style={{ transform: `scaleX(${Math.max(0, Math.min(1, stats.mood / 100))})` }} />
                </div>
                <span className="font-mono-num text-[11px] text-stone-200 w-7 text-right">{Math.round(stats.mood)}</span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-stone-300 w-11 shrink-0 font-medium">Speed</span>
                <div className="flex-1 h-1.5 bg-stone-800 rounded-sm overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-transform duration-150 origin-left" style={{ transform: `scaleX(${Math.max(0, Math.min(1, stats.speed / 100))})` }} />
                </div>
                <span className="font-mono-num text-[11px] text-stone-200 w-7 text-right">{Math.round(stats.speed)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="pointer-events-auto bg-stone-900/95 border border-stone-700/80 rounded-xl p-1.5 shadow-xl flex flex-col items-center gap-1">
              <button
                onClick={onOpenBackpack}
                title={`Buka Semua Inventori Tas (${inventory.length}/${maxBagSlots} slot)`}
                className={`w-14 py-1.5 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                  hasBagUpgradeReady
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 hover:bg-amber-500/30'
                    : 'bg-stone-800 hover:bg-stone-700 border-stone-600 text-amber-300'
                }`}
              >
                <Backpack className="w-6 h-6" />
                <span className="font-mono-num text-[10px] font-bold leading-none">{inventory.length}/{maxBagSlots}</span>
              </button>

              <div className="w-8 h-px bg-stone-700 my-0.5" />

              {Array.from({ length: 9 }).map((_, idx) => {
                const slot = inventory[idx];
                const isSelected = selectedSlot === idx;
                const item = slot ? ITEMS[slot.itemId] : null;
                return (
                  <button
                    key={idx}
                    onClick={() => onSelectSlot(idx)}
                    title={item ? `${item.name} — ${item.description}` : `Slot ${idx + 1}`}
                    className={`relative w-14 h-14 rounded-lg flex items-center justify-center transition-transform cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/20 border-2 border-amber-400 translate-x-0.5'
                        : 'bg-stone-800/90 border border-stone-700 hover:border-stone-500'
                    }`}
                  >
                    <span className="absolute top-1 left-1.5 font-mono-num text-[10px] text-stone-400 leading-none">{idx + 1}</span>
                    {slot && <ItemIcon itemId={slot.itemId} size={34} />}
                    {slot && slot.quantity > 1 && (
                      <span className="absolute bottom-1 right-1.5 font-mono-num text-[10px] font-bold text-stone-100 leading-none drop-shadow">{slot.quantity}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-1.5 mt-1">
              {hasBagUpgradeReady && (
                <button onClick={onOpenBackpack} className="pointer-events-auto bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs px-2.5 py-1 rounded-lg shadow-md cursor-pointer text-left">
                  Upgrade Tas Tersedia!
                </button>
              )}
              {selectedItem && (
                <div className="text-xs font-medium text-stone-200 bg-stone-900/92 border border-stone-700/70 px-2.5 py-1 rounded-md shadow">
                  {selectedItem.name}
                  {selectedItem.toolKind === 'WATERING_CAN' && (
                    <span className="font-mono-num text-sky-300 ml-1.5">({wateringCanCharges}/{maxWaterCharges})</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-1.5">
          <div className="flex items-start gap-2">
            <div className="bg-stone-900/95 border border-stone-700/80 rounded-xl px-3.5 py-2.5 shadow-lg flex flex-col gap-1 text-right">
              <div className="flex items-center justify-end gap-2 text-xs text-stone-300">
                <span className="font-semibold text-amber-300">{SCENE_MAPS[scene].name}</span>
                <span aria-hidden="true">·</span>
                <span>Tahun {year}</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold" style={{ color: seasonMeta.accentHex }}>{seasonMeta.name} Hari {dayInSeason}/14</span>
              </div>
              <div className="flex items-center justify-end gap-3 text-sm">
                <div className="flex items-center gap-1.5 text-stone-200">
                  {renderWeatherIcon()}
                  <span className="text-xs font-medium">{weatherMeta.label}</span>
                  <span className="font-mono-num text-xs text-sky-300">{rainfallMm}mm</span>
                </div>
                <span aria-hidden="true" className="text-stone-600">|</span>
                <div className={`font-mono-num font-bold ${isLateNight ? 'text-rose-400' : 'text-stone-100'}`}>{formatGameClock(timeMinutes)}</div>
                <span aria-hidden="true" className="text-stone-600">|</span>
                <div className="flex items-center gap-1.5 font-mono-num font-bold text-amber-400">
                  <Coins className="w-4 h-4" />
                  <span>{gold.toLocaleString('id-ID')} EG</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <button onClick={onPause} title="Jeda" className="w-10 h-10 rounded-xl bg-stone-900/95 border border-stone-700/80 hover:border-amber-400 text-stone-200 flex items-center justify-center transition-colors cursor-pointer">
                <Pause className="w-4 h-4" />
              </button>
              <button onClick={onToggleMute} title={muted ? 'Nyalakan Suara' : 'Matikan Suara'} className="w-10 h-10 rounded-xl bg-stone-900/95 border border-stone-700/80 hover:border-amber-400 text-stone-200 flex items-center justify-center transition-colors cursor-pointer">
                {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="bg-stone-900/95 border border-stone-700/80 rounded-xl p-1 shadow-lg flex items-center gap-1">
            <button
              onClick={() => {
                const idx = ZOOM_PRESETS.indexOf(zoom as (typeof ZOOM_PRESETS)[number]);
                if (idx > 0) onChangeZoom(ZOOM_PRESETS[idx - 1]);
              }}
              disabled={zoom <= ZOOM_PRESETS[0]}
              title="Zoom Out (Perkecil)"
              aria-label="Zoom Out"
              className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-40 disabled:hover:bg-stone-800 text-stone-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            {ZOOM_PRESETS.map((preset) => {
              const active = Math.abs(zoom - preset) < 0.01;
              return (
                <button
                  key={preset}
                  onClick={() => onChangeZoom(preset)}
                  title={preset > 1 ? `Zoom In ${preset}×` : preset < 1 ? `Zoom Out ${preset}×` : 'Zoom Normal 1×'}
                  className={`px-2 h-7 rounded-lg font-mono-num text-[11px] font-bold transition-colors cursor-pointer ${
                    active ? 'bg-amber-500 text-stone-950 shadow-sm' : 'bg-stone-800/80 hover:bg-stone-700 text-stone-300'
                  }`}
                >
                  {preset}×
                </button>
              );
            })}

            <button
              onClick={() => {
                const idx = ZOOM_PRESETS.indexOf(zoom as (typeof ZOOM_PRESETS)[number]);
                if (idx >= 0 && idx < ZOOM_PRESETS.length - 1) onChangeZoom(ZOOM_PRESETS[idx + 1]);
              }}
              disabled={zoom >= ZOOM_PRESETS[ZOOM_PRESETS.length - 1]}
              title="Zoom In (Perbesar)"
              aria-label="Zoom In"
              className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-40 disabled:hover:bg-stone-800 text-stone-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        {toastMessage && (
          <div className="bg-stone-900/95 border border-amber-500/60 text-amber-100 text-xs sm:text-sm font-medium px-4 py-2 rounded-lg shadow-lg">{toastMessage}</div>
        )}

        {isLateNight && !toastMessage && (
          <div className="bg-rose-950/95 border border-rose-500/60 text-rose-200 text-xs font-medium px-3.5 py-1.5 rounded-lg flex items-center gap-2">
            <Wind className="w-3.5 h-3.5" />
            <span>Sudah larut malam! Tidur maksimal pukul 00:00 di kamar tidur.</span>
          </div>
        )}

        {contextPrompt && (
          <button onClick={onTriggerContext} className="pointer-events-auto bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs sm:text-sm px-4 py-1.5 rounded-lg shadow-lg transition-colors cursor-pointer">
            {contextPrompt}
          </button>
        )}
      </div>
    </div>
  );
};

