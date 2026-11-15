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
    <div className="fixed inset-0 z-40 bg-stone-950/80 flex items-center justify-center p-4">
      <div className="animate-modal-pop w-full max-w-2xl bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-stone-950 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <Backpack className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-display text-lg font-bold text-stone-100 leading-tight">
                Tas Petani ({inventory.length}/{maxSlots} Slot)
              </h2>
              <p className="text-xs text-stone-400">
                Semua inventori tersimpan dalam 1 tas · Slot 1–9 tampil di bilah kiri
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {/* Player Level, XP & Bag Upgrade Panel */}
          <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-300 text-sm">
                  Level Player {playerLevel} / {MAX_PLAYER_LEVEL}
                </span>
                <span className="font-mono-num text-stone-300">
                  {nextXp ? `${xp} / ${nextXp} XP` : `${xp} XP (Level Maksimal)`}
                </span>
              </div>
              <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-transform duration-200 origin-left"
                  style={{ transform: `scaleX(${xpRatio})` }}
                />
              </div>
              <p className="text-[11px] text-stone-400">
                XP bertambah +10 setiap pemasukan 100.000 EG · Kapasitas Tas saat ini: {maxSlots} slot
              </p>
            </div>

            <div className="shrink-0">
              {bagLevel >= MAX_PLAYER_LEVEL ? (
                <div className="text-xs font-semibold text-emerald-400 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  Tas Maksimal ({maxSlots} Slot)
                </div>
              ) : canUpgradeBag ? (
                <button
                  onClick={onUpgradeBag}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-2 shadow cursor-pointer"
                >
                  <ArrowUpCircle className="w-4 h-4" />
                  <span>Upgrade Tas → {nextCapacity} Slot (+{SLOTS_PER_BAG_UPGRADE})</span>
                </button>
              ) : (
                <div className="px-3.5 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 text-xs flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Upgrade +{SLOTS_PER_BAG_UPGRADE} Slot di Level {bagLevel + 1}</span>
                </div>
              )}
            </div>
          </div>

          {/* 1-Tas Slot Grid (All unlocked slots 1..maxSlots) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-stone-400">
              <span>Klik item untuk memilih atau menukar posisi dengan slot lain</span>
              {pickedSlotIdx !== null && (
                <span className="text-amber-300 font-semibold">
                  Pilih slot tujuan untuk ditukar
                </span>
              )}
            </div>

            <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
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
                    className={`relative aspect-square rounded-xl flex items-center justify-center transition-transform cursor-pointer ${
                      isPicked
                        ? 'bg-amber-500/25 border-2 border-amber-400 scale-95'
                        : slot
                        ? 'bg-stone-950 border border-stone-700 hover:border-amber-400/70'
                        : 'bg-stone-950/40 border border-dashed border-stone-800'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1.5 font-mono-num text-[9px] leading-none ${
                        isQuickSlot ? 'text-amber-400/80 font-bold' : 'text-stone-600'
                      }`}
                    >
                      {idx + 1}
                    </span>

                    {slot && <ItemIcon itemId={slot.itemId} size={28} />}

                    {slot && slot.quantity > 1 && (
                      <span className="absolute bottom-1 right-1.5 font-mono-num text-[11px] font-bold text-stone-100 leading-none">
                        {slot.quantity}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Item Inspector & Consume Action */}
          {inspectedSlot && inspectedDef && (
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-stone-900 border border-stone-700 flex items-center justify-center shrink-0">
                  <ItemIcon itemId={inspectedSlot.itemId} size={24} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-stone-100 truncate">
                    {inspectedDef.name}
                    {inspectedSlot.quantity > 1 && (
                      <span className="font-mono-num text-amber-400 ml-1.5">×{inspectedSlot.quantity}</span>
                    )}
                  </div>
                  <p className="text-xs text-stone-400 truncate">{inspectedDef.description}</p>
                </div>
              </div>

              {isEdible && (
                <button
                  onClick={() => {
                    onConsumeItem(inspectedSlot.itemId);
                    setPickedSlotIdx(null);
                  }}
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Utensils className="w-3.5 h-3.5" />
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
