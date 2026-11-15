import React, { useState } from 'react';
import { ArrowUpCircle, Backpack, Lock, Utensils, X } from 'lucide-react';
import {
  getBagCapacity,
  getLevelMinXp,
  getNextLevelXp,
  getPlayerLevel,
  ITEMS,
  MAX_PLAYER_LEVEL,
  SLOTS_PER_BAG_UPGRADE,
} from '../data/cropsAndItems';
import { InventorySlot } from '../types/game';
import { ItemIcon } from './ItemIcon';

interface BackpackModalProps {
  inventory: InventorySlot[];
  xp: number;
  bagLevel: number;
  selectedHotbarSlot: number;
  onSelectHotbarSlot: (idx: number) => void;
  onSwapSlots: (idxA: number, idxB: number) => void;
  onConsumeItem: (itemId: string) => void;
  onUpgradeBag: () => void;
  onClose: () => void;
}

export const BackpackModal: React.FC<BackpackModalProps> = ({
  inventory,
  xp,
  bagLevel,
  selectedHotbarSlot,
  onSelectHotbarSlot,
  onSwapSlots,
  onConsumeItem,
  onUpgradeBag,
  onClose,
}) => {
  const [pickedSlotIdx, setPickedSlotIdx] = useState<number | null>(null);

  const playerLevel = getPlayerLevel(xp);
  const minXp = getLevelMinXp(playerLevel);
  const nextXp = getNextLevelXp(playerLevel);
  const maxSlots = getBagCapacity(bagLevel);
  const canUpgradeBag = bagLevel < playerLevel && bagLevel < MAX_PLAYER_LEVEL;
  const nextCapacity = getBagCapacity(bagLevel + 1);

  const xpRatio = nextXp
    ? Math.max(0, Math.min(1, (xp - minXp) / (nextXp - minXp)))
    : 1;

  const inspectedIdx = pickedSlotIdx ?? selectedHotbarSlot;
  const inspectedSlot = inventory[inspectedIdx];
  const inspectedDef = inspectedSlot ? ITEMS[inspectedSlot.itemId] : null;
  const isEdible =
    inspectedDef &&
    inspectedDef.id !== 'buah_kalabas' &&
    ((inspectedDef.restoreHealth ?? 0) > 0 ||
      (inspectedDef.restoreMood ?? 0) > 0 ||
      (inspectedDef.boostSpeed ?? 0) > 0);

  const handleSlotClick = (idx: number) => {
    if (pickedSlotIdx === null) {
      if (inventory[idx]) {
        setPickedSlotIdx(idx);
        if (idx < 9) onSelectHotbarSlot(idx);
      }
      return;
    }

    if (pickedSlotIdx === idx) {
      setPickedSlotIdx(null);
      return;
    }

    if (idx < inventory.length) {
      onSwapSlots(pickedSlotIdx, idx);
    }
    setPickedSlotIdx(null);
  };

  return (
    <div className="fixed inset-0 z-40 bg-stone-950/80 flex items-center justify-center p-4 sm:p-6">
      <div className="animate-modal-pop w-full max-w-4xl bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 bg-stone-950 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <Backpack className="w-6 h-6 text-amber-400" />
            <div>
              <h2 className="font-display text-xl font-bold text-stone-100 leading-tight">
                Tas Petani ({inventory.length}/{maxSlots} Slot)
              </h2>
              <p className="text-sm text-stone-400">
                Semua inventori tersimpan dalam 1 tas · Slot 1–9 tampil di bilah kiri
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center cursor-pointer"
            aria-label="Tutup inventori"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="bg-stone-950 border border-stone-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-bold text-amber-300 text-base">
                  Level Player {playerLevel} / {MAX_PLAYER_LEVEL}
                </span>
                <span className="font-mono-num text-stone-300">
                  {nextXp ? `${xp} / ${nextXp} XP` : `${xp} XP (Level Maksimal)`}
                </span>
              </div>
              <div className="h-2.5 bg-stone-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-transform duration-200 origin-left"
                  style={{ transform: `scaleX(${xpRatio})` }}
                />
              </div>
              <p className="text-xs text-stone-400">
                XP bertambah +10 setiap pemasukan 100.000 EG · Kapasitas Tas saat ini: {maxSlots} slot
              </p>
            </div>

            <div className="shrink-0">
              {bagLevel >= MAX_PLAYER_LEVEL ? (
                <div className="text-sm font-semibold text-emerald-400 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  Tas Maksimal ({maxSlots} Slot)
                </div>
              ) : canUpgradeBag ? (
                <button
                  onClick={onUpgradeBag}
                  className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm flex items-center gap-2 shadow cursor-pointer"
                >
                  <ArrowUpCircle className="w-5 h-5" />
                  <span>Upgrade Tas → {nextCapacity} Slot (+{SLOTS_PER_BAG_UPGRADE})</span>
                </button>
              ) : (
                <div className="px-4 py-2.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  <span>Upgrade +{SLOTS_PER_BAG_UPGRADE} Slot di Level {bagLevel + 1}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm text-stone-400">
              <span>Klik item untuk memilih atau menukar posisi dengan slot lain</span>
              {pickedSlotIdx !== null && (
                <span className="text-amber-300 font-semibold">Pilih slot tujuan untuk ditukar</span>
              )}
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-9 gap-3">
              {Array.from({ length: maxSlots }).map((_, idx) => {
                const slot = inventory[idx];
                const def = slot ? ITEMS[slot.itemId] : null;
                const isPicked = pickedSlotIdx === idx;
                const isQuickSlot = idx < 9;

                return (
                  <button
                    key={idx}
                    onClick={() => handleSlotClick(idx)}
                    title={def ? `${def.name} — ${def.description}` : `Slot Kosong ${idx + 1}`}
                    className={`relative aspect-square min-w-0 rounded-xl flex items-center justify-center transition-transform cursor-pointer ${
                      isPicked
                        ? 'bg-amber-500/25 border-2 border-amber-400 scale-95'
                        : slot
                          ? 'bg-stone-950 border border-stone-700 hover:border-amber-400/70'
                          : 'bg-stone-950/40 border border-dashed border-stone-800'
                    }`}
                  >
                    <span
                      className={`absolute top-2 left-2 font-mono-num text-xs leading-none ${
                        isQuickSlot ? 'text-amber-400/80 font-bold' : 'text-stone-600'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    {slot && <ItemIcon itemId={slot.itemId} size={28} />}
                    {slot && slot.quantity > 1 && (
                      <span className="absolute bottom-2 right-2 font-mono-num text-sm font-bold text-stone-100 leading-none drop-shadow">
                        {slot.quantity}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {inspectedSlot && inspectedDef && (
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-16 h-16 rounded-xl bg-stone-900 border border-stone-700 flex items-center justify-center shrink-0">
                  <ItemIcon itemId={inspectedSlot.itemId} size={40} />
                </div>
                <div className="min-w-0">
                  <div className="text-base font-bold text-stone-100 truncate">
                    {inspectedDef.name}
                    {inspectedSlot.quantity > 1 && (
                      <span className="font-mono-num text-amber-400 ml-1.5">×{inspectedSlot.quantity}</span>
                    )}
                  </div>
                  <p className="text-sm text-stone-400">{inspectedDef.description}</p>
                </div>
              </div>

              {isEdible && (
                <button
                  onClick={() => {
                    onConsumeItem(inspectedSlot.itemId);
                    setPickedSlotIdx(null);
                  }}
                  className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2 shrink-0 cursor-pointer"
                >
                  <Utensils className="w-4 h-4" />
                  <span>Pakai</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

