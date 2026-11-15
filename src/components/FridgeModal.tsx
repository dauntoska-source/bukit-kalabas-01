import React, { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Snowflake, Utensils, X } from 'lucide-react';
import { ITEMS } from '../data/cropsAndItems';
import { InventorySlot, PlayerStats } from '../types/game';
import { ItemIcon } from './ItemIcon';

export const FRIDGE_COLS = 5;
export const FRIDGE_ROWS = 3;
export const FRIDGE_PAGE_SIZE = FRIDGE_COLS * FRIDGE_ROWS; // 15 slots per page
export const FRIDGE_PAGES = 5;
export const FRIDGE_TOTAL_SLOTS = FRIDGE_PAGE_SIZE * FRIDGE_PAGES; // 75 slots total

export function isFridgeFoodItem(itemId: string): boolean {
  const def = ITEMS[itemId];
  if (!def || def.id === 'buah_kalabas') return false;
  return (
    (def.restoreHealth ?? 0) > 0 ||
    (def.restoreMood ?? 0) > 0 ||
    (def.boostSpeed ?? 0) > 0
  );
}

interface FridgeModalProps {
  fridgeSlots: (InventorySlot | null)[];
  inventory: InventorySlot[];
  stats: PlayerStats;
  onStoreItem: (itemId: string, qty: number, preferredSlotIdx?: number) => void;
  onWithdrawItem: (slotIdx: number, qty: number) => void;
  onEatFromFridge: (slotIdx: number) => void;
  onSwapFridgeSlots: (idxA: number, idxB: number) => void;
  onClose: () => void;
}

export const FridgeModal: React.FC<FridgeModalProps> = ({
  fridgeSlots,
  inventory,
  stats,
  onStoreItem,
  onWithdrawItem,
  onEatFromFridge,
  onSwapFridgeSlots,
  onClose,
}) => {
  const [page, setPage] = useState(0);
  const [selectedFridgeIdx, setSelectedFridgeIdx] = useState<number | null>(null);
  const [selectedBagItemId, setSelectedBagItemId] = useState<string | null>(null);

  const normalizedSlots: (InventorySlot | null)[] = Array.from(
    { length: FRIDGE_TOTAL_SLOTS },
    (_, idx) => fridgeSlots[idx] ?? null
  );

  const totalFilled = normalizedSlots.filter(Boolean).length;
  const pageStart = page * FRIDGE_PAGE_SIZE;
  const pageSlots = normalizedSlots.slice(pageStart, pageStart + FRIDGE_PAGE_SIZE);
  const bagFoodSlots = inventory.filter((slot) => isFridgeFoodItem(slot.itemId));

  const inspectedFridgeSlot =
    selectedFridgeIdx !== null ? normalizedSlots[selectedFridgeIdx] : null;
  const inspectedFridgeDef = inspectedFridgeSlot
    ? ITEMS[inspectedFridgeSlot.itemId]
    : null;

  const handleFridgeSlotClick = (globalIdx: number) => {
    const clickedSlot = normalizedSlots[globalIdx];

    if (selectedBagItemId) {
      const bagSlot = bagFoodSlots.find((s) => s.itemId === selectedBagItemId);
      if (bagSlot && (!clickedSlot || clickedSlot.itemId === selectedBagItemId)) {
        onStoreItem(selectedBagItemId, 1, globalIdx);
        if (bagSlot.quantity <= 1) {
          setSelectedBagItemId(null);
        }
        setSelectedFridgeIdx(globalIdx);
        return;
      }
      setSelectedBagItemId(null);
    }

    if (selectedFridgeIdx === null) {
      if (clickedSlot) {
        setSelectedFridgeIdx(globalIdx);
      }
      return;
    }

    if (selectedFridgeIdx === globalIdx) {
      setSelectedFridgeIdx(null);
      return;
    }

    // Move or swap within fridge if user clicks another slot after selecting one
    if (!clickedSlot) {
      onSwapFridgeSlots(selectedFridgeIdx, globalIdx);
      setSelectedFridgeIdx(globalIdx);
      return;
    }

    setSelectedFridgeIdx(globalIdx);
  };

  const formatEffects = (itemId: string) => {
    const def = ITEMS[itemId];
    if (!def) return '';
    const effects: string[] = [];
    if (def.restoreHealth) effects.push(`+${def.restoreHealth} HP`);
    if (def.restoreMood) effects.push(`+${def.restoreMood} Mood`);
    if (def.boostSpeed) effects.push(`+${def.boostSpeed} Speed`);
    return effects.join(' · ');
  };

  return (
    <div className="fixed inset-0 z-40 bg-stone-950/80 flex items-center justify-center p-4">
      <div className="animate-modal-pop w-full max-w-2xl bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-stone-950 border-b border-stone-800 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/35 flex items-center justify-center text-sky-400 shrink-0">
              <Snowflake className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-stone-100 leading-tight truncate">
                Kulkas Penyimpanan Makanan ({totalFilled}/{FRIDGE_TOTAL_SLOTS} Slot)
              </h2>
              <p className="text-xs text-stone-400 truncate">
                5×3 Slot × 5 Halaman · Health {Math.round(stats.health)} · Mood {Math.round(stats.mood)} · Speed {Math.round(stats.speed)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="Tutup Kulkas"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {/* 5 Page Selector Tabs */}
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: FRIDGE_PAGES }).map((_, pageIdx) => {
              const start = pageIdx * FRIDGE_PAGE_SIZE;
              const filledOnPage = normalizedSlots
                .slice(start, start + FRIDGE_PAGE_SIZE)
                .filter(Boolean).length;
              const active = page === pageIdx;

              return (
                <button
                  key={pageIdx}
                  onClick={() => {
                    setPage(pageIdx);
                    setSelectedFridgeIdx(null);
                  }}
                  className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-colors flex flex-col items-center gap-0.5 cursor-pointer ${
                    active
                      ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                      : 'bg-stone-950 border-stone-800 hover:border-stone-600 text-stone-400'
                  }`}
                >
                  <span>Hal {pageIdx + 1}</span>
                  <span className="font-mono-num text-[10px] opacity-80">
                    {filledOnPage}/{FRIDGE_PAGE_SIZE}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 5x3 Fridge Grid (15 Slots per Page) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-stone-400 gap-2">
              <span>
                {selectedBagItemId
                  ? `Klik slot kosong atau ${ITEMS[selectedBagItemId]?.name} di bawah untuk menyimpan`
                  : selectedFridgeIdx !== null && inspectedFridgeSlot
                  ? 'Klik slot kosong untuk memindah, atau gunakan tombol Ambil / Santap'
                  : `Rak Halaman ${page + 1} (5×3 Slot) · Khusus makanan & minuman`}
              </span>
              {selectedBagItemId && (
                <button
                  onClick={() => setSelectedBagItemId(null)}
                  className="text-amber-300 hover:text-amber-200 font-semibold shrink-0 cursor-pointer"
                >
                  Batal pilih tas
                </button>
              )}
            </div>

            <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-3">
              <div className="grid grid-cols-5 gap-2.5">
                {pageSlots.map((slot, localIdx) => {
                  const globalIdx = pageStart + localIdx;
                  const def = slot ? ITEMS[slot.itemId] : null;
                  const isSelected = selectedFridgeIdx === globalIdx;
                  const canPlaceBagHere =
                    Boolean(selectedBagItemId) &&
                    (!slot || slot.itemId === selectedBagItemId);

                  return (
                    <button
                      key={globalIdx}
                      onClick={() => handleFridgeSlotClick(globalIdx)}
                      title={
                        def
                          ? `${def.name} (×${slot?.quantity ?? 0}) — ${formatEffects(def.id)}`
                          : `Rak ${page + 1} Slot ${localIdx + 1} (Kosong)`
                      }
                      className={`relative aspect-square rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-sky-500/25 border-2 border-sky-400 scale-[0.97]'
                          : canPlaceBagHere
                          ? 'bg-emerald-950/40 border border-emerald-400/70 hover:bg-emerald-900/40'
                          : slot
                          ? 'bg-stone-900 border border-stone-700 hover:border-sky-400/70'
                          : 'bg-stone-950/60 border border-dashed border-stone-800 hover:border-stone-600'
                      }`}
                    >
                      <span className="absolute top-1 left-1.5 font-mono-num text-[9px] text-stone-500 leading-none">
                        {localIdx + 1}
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
          </div>

          {/* Selected Fridge Slot Inspector */}
          {inspectedFridgeSlot && inspectedFridgeDef && selectedFridgeIdx !== null && (
            <div className="bg-stone-950 border border-sky-500/35 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-stone-900 border border-stone-700 flex items-center justify-center shrink-0">
                  <ItemIcon itemId={inspectedFridgeSlot.itemId} size={24} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-stone-100 truncate">
                    {inspectedFridgeDef.name}
                    <span className="font-mono-num text-sky-400 ml-1.5">
                      ×{inspectedFridgeSlot.quantity}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-300 truncate">
                    {formatEffects(inspectedFridgeDef.id)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => onEatFromFridge(selectedFridgeIdx)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Utensils className="w-3.5 h-3.5" />
                  <span>Santap 1</span>
                </button>
                <button
                  onClick={() => onWithdrawItem(selectedFridgeIdx, 1)}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowUpFromLine className="w-3.5 h-3.5" />
                  <span>Ambil 1</span>
                </button>
                {inspectedFridgeSlot.quantity > 1 && (
                  <button
                    onClick={() =>
                      onWithdrawItem(selectedFridgeIdx, inspectedFridgeSlot.quantity)
                    }
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold cursor-pointer"
                  >
                    Ambil Semua
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Bag Food Items Ready to Store */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-stone-400">
                Makanan &amp; Minuman di Tas
              </span>
              <span className="text-[11px] text-stone-500">
                Hanya item makanan/minuman yang dapat disimpan
              </span>
            </div>

            {bagFoodSlots.length === 0 ? (
              <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5 text-xs text-stone-400">
                Tidak ada makanan atau minuman di tas Anda saat ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                {bagFoodSlots.map((slot) => {
                  const def = ITEMS[slot.itemId];
                  if (!def) return null;
                  const isPicked = selectedBagItemId === slot.itemId;
                  return (
                    <div
                      key={slot.itemId}
                      className={`rounded-xl p-2.5 border flex items-center justify-between gap-2 transition-colors ${
                        isPicked
                          ? 'bg-emerald-950/35 border-emerald-500/60'
                          : 'bg-stone-950 border-stone-800'
                      }`}
                    >
                      <button
                        onClick={() =>
                          setSelectedBagItemId((prev) =>
                            prev === slot.itemId ? null : slot.itemId
                          )
                        }
                        className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                        title="Klik untuk pilih target slot di rak kulkas"
                      >
                        <div className="w-8 h-8 rounded-lg bg-stone-900 border border-stone-700 flex items-center justify-center shrink-0">
                          <ItemIcon itemId={slot.itemId} size={20} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-stone-100 truncate">
                            {def.name}{' '}
                            <span className="font-mono-num text-amber-400">
                              ×{slot.quantity}
                            </span>
                          </div>
                          <div className="text-[11px] text-emerald-300 truncate">
                            {formatEffects(def.id)}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            const pageTarget =
                              selectedFridgeIdx !== null && !normalizedSlots[selectedFridgeIdx]
                                ? selectedFridgeIdx
                                : undefined;
                            onStoreItem(slot.itemId, 1, pageTarget);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowDownToLine className="w-3 h-3" />
                          <span>1</span>
                        </button>
                        {slot.quantity > 1 && (
                          <button
                            onClick={() => {
                              const pageTarget =
                                selectedFridgeIdx !== null && !normalizedSlots[selectedFridgeIdx]
                                  ? selectedFridgeIdx
                                  : undefined;
                              onStoreItem(slot.itemId, slot.quantity, pageTarget);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 text-[11px] font-bold cursor-pointer"
                          >
                            Semua
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
