import React from 'react';

export const INVENTORY_ICON_SCALE = 1.5;

export const scaledInventorySize = (size: number) => Math.max(12, Math.round(size * INVENTORY_ICON_SCALE));

