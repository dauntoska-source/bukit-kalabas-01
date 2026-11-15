import { SceneId, WorldObject } from '../types/game';
import { isTileSolid, SCENE_MAPS } from './maps';

export interface Waypoint {
  x: number;
  y: number;
}

export function isTileWalkable(
  scene: SceneId,
  tx: number,
  ty: number,
  orchardUnlocked: boolean,
  worldObjects: WorldObject[],
  peakGateOpened = false
): boolean {
  const map = SCENE_MAPS[scene];
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return false;
  if (isTileSolid(map.tiles[ty][tx], orchardUnlocked, peakGateOpened)) return false;

  const blocked = worldObjects.some(
    (o) =>
      o.scene === scene &&
      o.tx === tx &&
      o.ty === ty &&
      (o.kind === 'TREE' || o.kind === 'FRUIT_TREE' || o.kind === 'ROCK')
  );
  return !blocked;
}

/**
 * Finds a tile path from player's current position to (goalTx, goalTy).
 * If allowAdjacent is true and goal tile is solid (e.g. Tree, PC, Bed, Well, Door),
 * navigates to the nearest walkable adjacent tile instead.
 */
export function findPathToTile(
  scene: SceneId,
  startX: number,
  startY: number,
  goalTx: number,
  goalTy: number,
  orchardUnlocked: boolean,
  worldObjects: WorldObject[],
  allowAdjacent = true,
  peakGateOpened = false
): Waypoint[] {
  const map = SCENE_MAPS[scene];
  const sTx = Math.max(0, Math.min(map.width - 1, Math.floor(startX)));
  const sTy = Math.max(0, Math.min(map.height - 1, Math.floor(startY)));

  if (goalTx < 0 || goalTy < 0 || goalTx >= map.width || goalTy >= map.height) return [];

  const targetWalkable = isTileWalkable(scene, goalTx, goalTy, orchardUnlocked, worldObjects, peakGateOpened);

  let targetGoals: [number, number][] = [];
  if (targetWalkable && !allowAdjacent) {
    targetGoals = [[goalTx, goalTy]];
  } else if (targetWalkable) {
    targetGoals = [[goalTx, goalTy]];
  } else if (allowAdjacent) {
    const candidates: [number, number][] = [
      [goalTx, goalTy + 1],
      [goalTx, goalTy - 1],
      [goalTx - 1, goalTy],
      [goalTx + 1, goalTy],
    ];
    targetGoals = candidates.filter(([cx, cy]) =>
      isTileWalkable(scene, cx, cy, orchardUnlocked, worldObjects, peakGateOpened)
    );
    if (targetGoals.length === 0) return [];
  } else {
    return [];
  }

  // Already at one of the goals
  if (targetGoals.some(([gx, gy]) => gx === sTx && gy === sTy)) {
    return [{ x: sTx + 0.5, y: sTy + 0.5 }];
  }

  const key = (x: number, y: number) => y * map.width + x;
  const goalSet = new Set(targetGoals.map(([gx, gy]) => key(gx, gy)));

  const queue: [number, number][] = [[sTx, sTy]];
  const visited = new Uint8Array(map.width * map.height);
  const parent = new Int32Array(map.width * map.height).fill(-1);
  visited[key(sTx, sTy)] = 1;

  const dirs = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];

  let foundKey = -1;
  let head = 0;

  while (head < queue.length) {
    const [cx, cy] = queue[head++];
    const cKey = key(cx, cy);
    if (goalSet.has(cKey)) {
      foundKey = cKey;
      break;
    }

    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const nKey = key(nx, ny);
      if (visited[nKey]) continue;
      if (!isTileWalkable(scene, nx, ny, orchardUnlocked, worldObjects, peakGateOpened)) continue;
      visited[nKey] = 1;
      parent[nKey] = cKey;
      queue.push([nx, ny]);
    }
  }

  if (foundKey === -1) return [];

  const path: Waypoint[] = [];
  let cur = foundKey;
  while (cur !== -1 && cur !== key(sTx, sTy)) {
    const px = cur % map.width;
    const py = Math.floor(cur / map.width);
    path.push({ x: px + 0.5, y: py + 0.5 });
    cur = parent[cur];
  }
  path.reverse();
  return path;
}
