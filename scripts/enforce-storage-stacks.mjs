import { readFile, writeFile } from 'node:fs/promises';

const appPath = new URL('../src/App.tsx', import.meta.url);
let source = await readFile(appPath, 'utf8');

function replaceSection(startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Could not locate ${startMarker} section in src/App.tsx`);
  }
  source = source.slice(0, start) + replacement + source.slice(end);
}

const sharedStorageHelper = `  const MAX_STORAGE_STACK_SIZE = 99;

  const storeItemsAcrossSlots = (
    currentSlots: (InventorySlot | null)[],
    itemId: string,
    requestedQty: number,
    preferredSlotIdx: number | undefined,
    totalSlots: number
  ): { slots: (InventorySlot | null)[]; storedQty: number } => {
    const slots = currentSlots.map((slot) => slot ? { ...slot } : null);
    let remaining = Math.max(0, Math.floor(requestedQty));
    const candidates: number[] = [];
    const addCandidate = (idx: number) => {
      if (idx >= 0 && idx < totalSlots && !candidates.includes(idx)) candidates.push(idx);
    };

    if (preferredSlotIdx !== undefined) addCandidate(preferredSlotIdx);
    slots.forEach((slot, idx) => {
      if (slot?.itemId === itemId) addCandidate(idx);
    });
    slots.forEach((slot, idx) => {
      if (!slot) addCandidate(idx);
    });

    let storedQty = 0;
    for (const idx of candidates) {
      if (remaining <= 0) break;
      const slot = slots[idx];
      if (slot && slot.itemId !== itemId) continue;
      const currentQty = slot?.quantity ?? 0;
      const amount = Math.min(remaining, MAX_STORAGE_STACK_SIZE - currentQty);
      if (amount <= 0) continue;
      slots[idx] = { itemId, quantity: currentQty + amount };
      storedQty += amount;
      remaining -= amount;
    }

    return { slots, storedQty };
  };

  const ensureNormalizedFridge = (sim: SaveData): (InventorySlot | null)[] => {
    const raw = sim.fridgeSlots ?? [];
    return Array.from({ length: FRIDGE_TOTAL_SLOTS }, (_, idx) => {
      const slot = raw[idx];
      return slot && slot.quantity > 0 ? { itemId: slot.itemId, quantity: slot.quantity } : null;
    });
  };

  const handleStoreToFridge = (itemId: string, qty: number, preferredSlotIdx?: number) => {
    const sim = simRef.current;
    if (!isFridgeFoodItem(itemId)) {
      soundEngine.playError();
      showToast('Hanya makanan/minuman yang bisa dimakan yang dapat disimpan di kulkas!');
      return;
    }

    const bagQty = sim.inventory.find((slot) => slot.itemId === itemId)?.quantity ?? 0;
    const requestedQty = Math.min(Math.max(0, Math.floor(qty)), bagQty);
    if (requestedQty <= 0) return;

    const result = storeItemsAcrossSlots(
      ensureNormalizedFridge(sim), itemId, requestedQty, preferredSlotIdx, FRIDGE_TOTAL_SLOTS
    );
    if (result.storedQty <= 0) {
      soundEngine.playError();
      showToast('Kulkas penuh atau semua slot item ini sudah mencapai batas 99 pcs.');
      return;
    }

    sim.fridgeSlots = result.slots;
    sim.inventory = removeInventoryItem(sim.inventory, itemId, result.storedQty);
    if (sim.hotbarSelected >= sim.inventory.length && sim.inventory.length > 0) {
      sim.hotbarSelected = Math.max(0, sim.inventory.length - 1);
    }
    soundEngine.playPlant();
    showToast(
      result.storedQty < requestedQty
        ? `Menyimpan ${result.storedQty}× ${ITEMS[itemId]?.name ?? itemId}; kulkas penuh, sisa tetap di tas.`
        : `Menyimpan ${result.storedQty}× ${ITEMS[itemId]?.name ?? itemId} ke kulkas.`
    );
    saveToStorage();
    syncHud();
  };

`;

replaceSection(
  '  const ensureNormalizedFridge =',
  '  const handleWithdrawFromFridge =',
  sharedStorageHelper
);

const cabinetSection = `  const ensureNormalizedCabinet = (sim: SaveData): (InventorySlot | null)[] => {
    const raw = sim.cabinetSlots ?? [];
    return Array.from({ length: CABINET_TOTAL_SLOTS }, (_, idx) => {
      const slot = raw[idx];
      return slot && slot.quantity > 0 ? { itemId: slot.itemId, quantity: slot.quantity } : null;
    });
  };

  const handleStoreToCabinet = (itemId: string, qty: number, preferredSlotIdx?: number) => {
    const sim = simRef.current;
    if (!isCabinetNonFoodItem(itemId)) {
      soundEngine.playError();
      showToast('Lemari serbaguna hanya untuk item yang tidak dapat dimakan.');
      return;
    }

    const bagQty = sim.inventory.find((slot) => slot.itemId === itemId)?.quantity ?? 0;
    const requestedQty = Math.min(Math.max(0, Math.floor(qty)), bagQty);
    if (requestedQty <= 0) return;

    const result = storeItemsAcrossSlots(
      ensureNormalizedCabinet(sim), itemId, requestedQty, preferredSlotIdx, CABINET_TOTAL_SLOTS
    );
    if (result.storedQty <= 0) {
      soundEngine.playError();
      showToast('Lemari penuh atau semua slot item ini sudah mencapai batas 99 pcs.');
      return;
    }

    sim.cabinetSlots = result.slots;
    sim.inventory = removeInventoryItem(sim.inventory, itemId, result.storedQty);
    if (sim.hotbarSelected >= sim.inventory.length && sim.inventory.length > 0) {
      sim.hotbarSelected = Math.max(0, sim.inventory.length - 1);
    }
    soundEngine.playPlant();
    showToast(
      result.storedQty < requestedQty
        ? `Menyimpan ${result.storedQty}× ${ITEMS[itemId]?.name ?? itemId}; lemari penuh, sisa tetap di tas.`
        : `Menyimpan ${result.storedQty}× ${ITEMS[itemId]?.name ?? itemId} ke lemari.`
    );
    saveToStorage();
    syncHud();
  };

`;

replaceSection(
  '  const ensureNormalizedCabinet =',
  '  const handleWithdrawFromCabinet =',
  cabinetSection
);

await writeFile(appPath, source);
console.log('Applied fridge/cabinet item rules and 99-item stack limit.');
