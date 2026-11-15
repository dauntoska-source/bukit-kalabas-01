import { readFile, writeFile } from 'node:fs/promises';

const mapsPath = new URL('../src/engine/maps.ts', import.meta.url);
let mapsSource = await readFile(mapsPath, 'utf8');

function replaceCoordinates(startMarker, endMarker, variableName, coordinates) {
  const start = mapsSource.indexOf(startMarker);
  const end = mapsSource.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Could not locate ${startMarker} section in src/engine/maps.ts`);

  const section = mapsSource.slice(start, end);
  // Accept both compact and formatted TypeScript declarations (for example,
  // `coords:[number,number][]=` and `coords: [number, number][] =`).
  const pattern = new RegExp(
    `const\\s+${variableName}\\s*:\\s*\\[\\s*number\\s*,\\s*number\\s*\\]\\s*\\[\\s*\\]\\s*=\\s*\\[[\\s\\S]*?\\];`
  );
  let found = false;
  const updated = section.replace(pattern, () => {
    found = true;
    return `const ${variableName}:[number,number][]=${JSON.stringify(coordinates)};`;
  });
  if (!found) throw new Error(`Could not find ${variableName} coordinate list in ${startMarker}`);
  mapsSource = mapsSource.slice(0, start) + updated + mapsSource.slice(end);
}

// Keep 15 of 31 FARM trees, balanced across both sides while preserving the bridge,
// central road, and crop access. The east side remains especially open by the river.
replaceCoordinates(
  'export function createFarmSceneObjects',
  'export function createKebunAtasObjects',
  'coords',
  [[1,2],[1,6],[1,14],[2,18],[3,11],[5,18],[8,18],[11,2],[21,1],[25,1],[24,3],[23,6],[21,12],[25,12],[24,14]]
);

// Keep 16 of 30 FOREST trees (double the previous 8), adding trees only to the
// upper half of the scene and leaving the lower river bend clear.
replaceCoordinates(
  'export function createForestSceneObjects',
  'export function createRiverSceneObjects',
  'trees',
  [[2,0],[10,0],[18,0],[1,1],[5,1],[14,1],[18,1],[2,3],[6,3],[15,3],[19,3],[1,5],[5,5],[14,5],[18,5],[25,5],[5,11],[14,12]]
);

// Keep 4 of 7 Pinggiran Kali trees (double the previous 2), only in the upper half.
replaceCoordinates(
  'export function createRiverSceneObjects',
  'export function createFarmSceneObjects',
  'trees',
  [[2,2],[4,1],[2,5],[3,9]]
);

// Keep 20 of 40 Kalabas trees in Hutan Kalabas & Lab Penelitian.
replaceCoordinates(
  'export function createLabSceneObjects',
  'export function createPeakSceneObjects',
  'coords',
  [[4,1],[10,1],[16,1],[22,1],[2,3],[8,3],[19,3],[25,3],[3,5],[7,5],[20,5],[24,5],[2,8],[8,8],[19,8],[25,8],[3,11],[24,11],[5,14],[22,14]]
);

await writeFile(mapsPath, mapsSource);

// Remove legacy save-repair logic that would otherwise repopulate the reduced layouts.
// This is idempotent because the dev/build scripts may run this migration repeatedly.
const appPath = new URL('../src/App.tsx', import.meta.url);
let appSource = await readFile(appPath, 'utf8');
const forestRepair = /\s*if \(parsed\.worldObjects\.filter\(\(o\) => o\.scene === 'FOREST' && o\.kind === 'TREE'\)\.length < (?:52|0)\) \{[\s\S]*?\n        \}\n(?=        const hasPeakLayoutClash)/;
const farmRepair = /\n          if \(parsed\.worldObjects\.filter\(\(o\) => o\.scene === 'FARM' && o\.kind === 'TREE'\)\.length < (?:22|0)\) \{[\s\S]*?\n          \}\n(?=        \}\n        if \(parsed\.scene === 'FARM'\))/;
if (forestRepair.test(appSource)) appSource = appSource.replace(forestRepair, '\n');
if (farmRepair.test(appSource)) appSource = appSource.replace(farmRepair, '');
if (/\.scene === '(?:FOREST|FARM)' && o\.kind === 'TREE'\)\.length < (?:52|22|0)/.test(appSource)) {
  throw new Error('Legacy tree-repair logic remains in src/App.tsx and could restore removed trees');
}
await writeFile(appPath, appSource);

console.log('Applied reduced FARM, FOREST, RIVER, and LAB tree layouts.');
