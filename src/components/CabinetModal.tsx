import React, { useState } from 'react';
import { Archive, ArrowDownToLine, ArrowUpFromLine, X } from 'lucide-react';
import { ITEMS } from '../data/cropsAndItems';
import { InventorySlot } from '../types/game';
import { isFridgeFoodItem } from './FridgeModal';
import { ItemIcon } from './ItemIcon';

export const CABINET_COLS = 5;
export const CABINET_ROWS = 3;
export const CABINET_PAGE_SIZE = CABINET_COLS * CABINET_ROWS;
export const CABINET_PAGES = 5;
export const CABINET_TOTAL_SLOTS = CABINET_PAGE_SIZE * CABINET_PAGES;

export function isCabinetNonFoodItem(itemId: string): boolean {
  const def = ITEMS[itemId];
  if (!def) return false;
  return !isFridgeFoodItem(itemId);
}

interface CabinetModalProps {
  cabinetSlots: (InventorySlot | null)[];
  inventory: InventorySlot[];
  onStoreItem: (itemId: string, qty: number, preferredSlotIdx?: number) => void;
  onWithdrawItem: (slotIdx: number, qty: number) => void;
  onSwapCabinetSlots: (idxA: number, idxB: number) => void;
  onClose: () => void;
}

export const CabinetModal: React.FC<CabinetModalProps> = ({ cabinetSlots, inventory, onStoreItem, onWithdrawItem, onSwapCabinetSlots, onClose }) => {
  const [page, setPage] = useState(0);
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number | null>(null);
  const [selectedBagItemId, setSelectedBagItemId] = useState<string | null>(null);

  const normalizedSlots: (InventorySlot | null)[] = Array.from({ length: CABINET_TOTAL_SLOTS }, (_, idx) => cabinetSlots[idx] ?? null);
  const totalFilled = normalizedSlots.filter(Boolean).length;
  const pageStart = page * CABINET_PAGE_SIZE;
  const pageSlots = normalizedSlots.slice(pageStart, pageStart + CABINET_PAGE_SIZE);
  const bagNonFoodSlots = inventory.filter((slot) => isCabinetNonFoodItem(slot.itemId));

  const inspectedSlot = selectedSlotIdx !== null ? normalizedSlots[selectedSlotIdx] : null;
  const inspectedDef = inspectedSlot ? ITEMS[inspectedSlot.itemId] : null;

  const handleCabinetSlotClick = (globalIdx: number) => {
    const clickedSlot = normalizedSlots[globalIdx];

    if (selectedBagItemId) {
      const bagSlot = bagNonFoodSlots.find((s) => s.itemId === selectedBagItemId);
      if (bagSlot && (!clickedSlot || clickedSlot.itemId === selectedBagItemId)) {
        onStoreItem(selectedBagItemId, 1, globalIdx);
        if (bagSlot.quantity <= 1) setSelectedBagItemId(null);
        setSelectedSlotIdx(globalIdx);
        return;
      }
      setSelectedBagItemId(null);
    }

    if (selectedSlotIdx === null) {
      if (clickedSlot) setSelectedSlotIdx(globalIdx);
      return;
    }

    if (selectedSlotIdx === globalIdx) {
      setSelectedSlotIdx(null);
      return;
    }

    if (!clickedSlot) {
      onSwapCabinetSlots(selectedSlotIdx, globalIdx);
      setSelectedSlotIdx(globalIdx);
      return;
    }

    setSelectedSlotIdx(globalIdx);
  };

  return (
    <div className="fixed inset-0 z-40 bg-stone-950/80 flex items-center justify-center p-4">
      <div className="animate-modal-pop w-full max-w-2xl bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-3.5 bg-stone-950 border-b border-stone-800 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0">
              <Archive className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-stone-100 leading-tight truncate">Lemari Penyimpanan Non-Makanan ({totalFilled}/{CABINET_TOTAL_SLOTS} Slot)</h2>
              <p className="text-xs text-stone-400 truncate">5×3 Slot × 5 Halaman · Khusus alat, senjata, bibit, pupuk, kayu, batu &amp; Kalabas</p>
            </div>
          </div>

          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center shrink-0 cursor-pointer" aria-label="Tutup Lemari">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: CABINET_PAGES }).map((_, pageIdx) => {
              const start = pageIdx * CABINET_PAGE_SIZE;
              const filledOnPage = normalizedSlots.slice(start, start + CABINET_PAGE_SIZE).filter(Boolean).length;
              const active = page === pageIdx;

              return (
                <button key={pageIdx} onClick={() => { setPage(pageIdx); setSelectedSlotIdx(null); }} className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-colors flex flex-col items-center gap-0.5 cursor-pointer ${active ? 'bg-amber-500/20 border-amber-400 text-amber-200' : 'bg-stone-950 border-stone-800 hover:border-stone-600 text-stone-400'}`}>
                  <span>Hal {pageIdx + 1}</span>
                  <span className="font-mono-num text-[10px] opacity-80">{filledOnPage}/{CABINET_PAGE_SIZE}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-stone-400 gap-2">
              <span>
                {selectedBagItemId
                  ? `Klik slot kosong atau ${ITEMS[selectedBagItemId]?.name} di bawah untuk menyimpan`
                  : selectedSlotIdx !== null && inspectedSlot
                    ? 'Klik slot kosong untuk memindah, atau gunakan tombol Ambil'
                    : `Rak Halaman ${page + 1} (5×3 Slot) · Khusus item yang tidak dapat dimakan`}
              </span>
              {selectedBagItemId && (
                <button onClick={() => setSelectedBagItemId(null)} className="text-amber-300 hover:text-amber-200 font-semibold shrink-0 cursor-pointer">Batal pilih tas</button>
              )}
            </div>

            <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-3">
              <div className="grid grid-cols-5 gap-2.5">
                {pageSlots.map((slot, localIdx) => {
                  const globalIdx = pageStart + localIdx;
                  const def = slot ? ITEMS[slot.itemId] : null;
                  const isSelected = selectedSlotIdx === globalIdx;
                  const canPlaceBagHere = Boolean(selectedBagItemId) && (!slot || slot.itemId === selectedBagItemId);

                  return (
                    <button key={globalIdx} onClick={() => handleCabinetSlotClick(globalIdx)} title={def ? `${def.name} (×${slot?.quantity ?? 0}) — ${def.description}` : `Rak ${page + 1} Slot ${localIdx + 1} (Kosong)`} className={`relative aspect-square rounded-xl flex items-center justify-center transition-all cursor-pointer ${isSelected ? 'bg-amber-500/25 border-2 border-amber-400 scale-[0.97]' : canPlaceBagHere ? 'bg-emerald-950/40 border border-emerald-400/70 hover:bg-emerald-900/40' : slot ? 'bg-stone-900 border border-stone-700 hover:border-amber-400/70' : 'bg-stone-950/60 border border-dashed border-stone-800 hover:border-stone-600'}`}>
                      <span className="absolute top-1 left-1.5 font-mono-num text-[9px] text-stone-500 leading-none">{localIdx + 1}</span>
                      {slot && <ItemIcon itemId={slot.itemId} size={42} />}
                      {slot && slot.quantity > 1 && <span className="absolute bottom-1 right-1.5 font-mono-num text-[11px] font-bold text-stone-100 leading-none">{slot.quantity}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {inspectedSlot && inspectedDef && selectedSlotIdx !== null && (
            <div className="bg-stone-950 border border-amber-500/35 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-lg bg-stone-900 border border-stone-700 flex items-center justify-center shrink-0">
                  <ItemIcon itemId={inspectedSlot.itemId} size={36} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-stone-100 truncate">{inspectedDef.name}<span className="font-mono-num text-amber-400 ml-1.5">×{inspectedSlot.quantity}</span></div>
                  <p className="text-xs text-stone-400 truncate">{inspectedDef.description}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button onClick={() => onWithdrawItem(selectedSlotIdx, 1)} className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                  <ArrowUpFromLine className="w-3.5 h-3.5" />
                  <span>Ambil 1</span>
                </button>
                {inspectedSlot.quantity > 1 && (
                  <button onClick={() => onWithdrawItem(selectedSlotIdx, inspectedSlot.quantity)} className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-100 text-xs font-bold cursor-pointer">Ambil Semua</button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-stone-400">Item Non-Makanan di Tas</span>
              <span className="text-[11px] text-stone-500">Makanan &amp; minuman disimpan di Kulkas</span>
            </div>

            {bagNonFoodSlots.length === 0 ? (
              <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5 text-xs text-stone-400">Tidak ada item non-makanan di tas Anda saat ini.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                {bagNonFoodSlots.map((slot) => {
                  const def = ITEMS[slot.itemId];
                  if (!def) return null;
                  const isPicked = selectedBagItemId === slot.itemId;
                  return (
                    <div key={slot.itemId} className={`rounded-xl p-2.5 border flex items-center justify-between gap-2 transition-colors ${isPicked ? 'bg-emerald-950/35 border-emerald-500/60' : 'bg-stone-950 border-stone-800'}`}>
                      <button onClick={() => setSelectedBagItemId((prev) => (prev === slot.itemId ? null : slot.itemId))} className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer" title="Klik untuk pilih target slot di rak lemari">
                        <div className="w-10 h-10 rounded-lg bg-stone-900 border border-stone-700 flex items-center justify-center shrink-0">
                          <ItemIcon itemId={slot.itemId} size={30} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-stone-100 truncate">{def.name} <span className="font-mono-num text-amber-400">×{slot.quantity}</span></div>
                          <div className="text-[11px] text-stone-400 truncate">{def.category}</div>
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => { const pageTarget = selectedSlotIdx !== null && !normalizedSlots[selectedSlotIdx] ? selectedSlotIdx : undefined; onStoreItem(slot.itemId, 1, pageTarget); }} className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-[11px] font-bold flex items-center gap-1 cursor-pointer">
                          <ArrowDownToLine className="w-3 h-3" />
                          <span>1</span>
                        </button>
                        {slot.quantity > 1 && (
                          <button onClick={() => { const pageTarget = selectedSlotIdx !== null && !normalizedSlots[selectedSlotIdx] ? selectedSlotIdx : undefined; onStoreItem(slot.itemId, slot.quantity, pageTarget); }} className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 text-[11px] font-bold cursor-pointer">Semua</button>
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

