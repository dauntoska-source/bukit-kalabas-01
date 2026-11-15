import { SceneId, WorldObject } from '../types/game';

export const TILE_SIZE = 48;

export type TileKind =
  | 'GRASS' | 'DARK_GRASS' | 'DIRT_PATH' | 'STONE_ROAD' | 'FARM_ZONE' | 'VOLCANIC_ZONE'
  | 'WATER' | 'RIVER_WATER' | 'RIVER_BANK' | 'WOOD_BRIDGE' | 'MOUNTAIN_ROCK' | 'MOUNTAIN_MOSS'
  | 'CLIFF_HILL' | 'CLIFF_MOSS' | 'PEAK_CLIFF' | 'MYSTERIOUS_CAVE' | 'FENCE' | 'WALL'
  | 'LAB_FLOOR' | 'LAB_WALL' | 'LAB_CONSOLE' | 'HOUSE_ROOF' | 'HOUSE_WALL' | 'DOOR' | 'WELL'
  | 'GATE_LOCKED' | 'PEAK_GATE' | 'WOOD_FLOOR_BED' | 'WOOD_FLOOR_MAIN' | 'WOOD_FLOOR_WORK'
  | 'BATH_FLOOR' | 'RUG' | 'FURNITURE_BED' | 'FURNITURE_PC' | 'FURNITURE_CABINET' | 'FURNITURE_FRIDGE' | 'FURNITURE_SOFA'
  | 'FURNITURE_KITCHEN' | 'FURNITURE_SHELF' | 'FURNITURE_BATH_POOL' | 'FURNITURE_BATH_VANITY' | 'FURNITURE_WC' | 'SIGN';

export interface ScenePortal {
  x1: number; y1: number; x2: number; y2: number; targetScene: SceneId;
  spawnX: number; spawnY: number; requiresOrchardDeed?: boolean; requiresRobot?: boolean; label: string;
}
export interface InteractZone {
  id: 'DOOR_IN' | 'DOOR_OUT' | 'PC' | 'BED' | 'CABINET' | 'FRIDGE' | 'KITCHEN' | 'WELL' | 'STREAM' | 'GATE_SIGN' | 'BATH' | 'WC' | 'LAB_SIGN' | 'LAB_DOOR' | 'LAB_ROAD_SIGN' | 'RIVER_SIGN' | 'RIVER_BANK_SIGN' | 'WEST_RIVER_SIGN' | 'WEST_PEAK_SIGN' | 'MYSTERIOUS_CAVE' | 'PEAK_SIGN' | 'CLIFF_SIGN';
  x1: number; y1: number; x2: number; y2: number; prompt: string;
}
export interface SceneMap {
  id: SceneId; name: string; width: number; height: number; tiles: TileKind[][];
  portals: ScenePortal[]; interactZones: InteractZone[];
}

function createGrid(w: number, h: number, fill: TileKind): TileKind[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
}
function fillRect(g: TileKind[][], x1: number, y1: number, x2: number, y2: number, kind: TileKind) {
  for (let y = Math.max(0, y1); y <= Math.min(g.length - 1, y2); y++)
    for (let x = Math.max(0, x1); x <= Math.min(g[0].length - 1, x2); x++) g[y][x] = kind;
}
export function isTileSolid(tile: TileKind, _orchardUnlocked: boolean, peakGateOpened = false): boolean {
  if (['WATER','FENCE','CLIFF_HILL','CLIFF_MOSS','PEAK_CLIFF','MYSTERIOUS_CAVE','WALL','LAB_WALL','LAB_CONSOLE','HOUSE_ROOF','HOUSE_WALL','WELL','FURNITURE_BED','FURNITURE_PC','FURNITURE_CABINET','FURNITURE_FRIDGE','FURNITURE_SOFA','FURNITURE_KITCHEN','FURNITURE_SHELF','FURNITURE_BATH_POOL','FURNITURE_BATH_VANITY','FURNITURE_WC','SIGN'].includes(tile)) return true;
  return tile === 'PEAK_GATE' && !peakGateOpened;
}
function map(id: SceneId, name: string, w: number, h: number, fill: TileKind): SceneMap {
  return { id, name, width: w, height: h, tiles: createGrid(w, h, fill), portals: [], interactZones: [] };
}

function buildFarmMap(): SceneMap {
  const m = map('FARM','Kebun Utama',28,20,'GRASS'), g=m.tiles;
  fillRect(g,0,0,27,0,'FENCE'); fillRect(g,0,19,27,19,'FENCE'); fillRect(g,0,0,0,19,'FENCE'); fillRect(g,27,0,27,19,'FENCE');
  fillRect(g,14,0,15,16,'STONE_ROAD'); fillRect(g,16,9,27,10,'DIRT_PATH');
  fillRect(g,3,2,8,3,'HOUSE_ROOF'); fillRect(g,3,4,8,5,'HOUSE_WALL'); g[5][5]='DOOR';
  fillRect(g,5,6,5,7,'DIRT_PATH'); fillRect(g,5,7,13,7,'DIRT_PATH'); g[4][10]='WELL'; fillRect(g,9,5,11,6,'DIRT_PATH');
  fillRect(g,5,8,12,11,'FARM_ZONE'); fillRect(g,3,12,13,12,'DIRT_PATH'); fillRect(g,3,13,12,16,'FARM_ZONE');
  fillRect(g,0,11,2,12,'DIRT_PATH'); fillRect(g,17,0,19,19,'WATER'); fillRect(g,17,15,27,18,'WATER'); fillRect(g,17,9,19,10,'WOOD_BRIDGE');
  fillRect(g,1,1,2,18,'DARK_GRASS'); fillRect(g,21,1,26,7,'DARK_GRASS'); fillRect(g,21,11,26,14,'DARK_GRASS'); g[2][13]='SIGN'; g[8][25]='SIGN';
  m.portals=[{x1:4.8,y1:5,x2:6.2,y2:5.85,targetScene:'HOUSE',spawnX:15.0,spawnY:12.6,label:'Masuk Rumah'},{x1:0,y1:10.6,x2:.85,y2:13.4,targetScene:'PEAK',spawnX:25.8,spawnY:11.8,label:'Menuju Puncak Gunung'},{x1:27.2,y1:8.6,x2:28,y2:11.4,targetScene:'FOREST',spawnX:1.5,spawnY:9.5,label:'Menuju Hutan & Sungai'},{x1:13.6,y1:0,x2:16.4,y2:.9,targetScene:'ORCHARD',spawnX:14,spawnY:17.6,label:'Menuju Kebun Atas'}];
  m.interactZones=[{id:'DOOR_IN',x1:4.3,y1:5,x2:6.7,y2:6.8,prompt:'Masuk ke Dalam Rumah'},{id:'WELL',x1:9,y1:3.2,x2:11.8,y2:5.9,prompt:'Isi Ember Siram di Sumur'},{id:'GATE_SIGN',x1:12.2,y1:1.1,x2:16.5,y2:3.4,prompt:'Jalan ke Kebun Atas'},{id:'WEST_PEAK_SIGN',x1:1.1,y1:9.2,x2:3.5,y2:11.5,prompt:'Barat: Puncak Gunung'}];
  return m;
}
function buildHouseMap(): SceneMap {
  const m=map('HOUSE','Rumah (3 Ruangan)',30,15,'WALL'),g=m.tiles;
  fillRect(g,1,3,10,13,'BATH_FLOOR'); fillRect(g,5,3,8,4,'FURNITURE_BATH_VANITY'); fillRect(g,2,6,7,9,'FURNITURE_BATH_POOL'); fillRect(g,9,5,10,6,'FURNITURE_WC'); fillRect(g,11,8,11,10,'WOOD_FLOOR_MAIN');
  fillRect(g,12,3,18,13,'WOOD_FLOOR_MAIN'); fillRect(g,12,3,14,4,'FURNITURE_KITCHEN'); fillRect(g,15,3,16,4,'FURNITURE_FRIDGE'); fillRect(g,17,3,18,4,'FURNITURE_CABINET'); fillRect(g,14,6,16,7,'FURNITURE_SOFA'); fillRect(g,13,9,17,11,'RUG'); g[14][14]='DOOR';g[14][15]='DOOR';
  fillRect(g,19,8,19,10,'WOOD_FLOOR_MAIN'); fillRect(g,20,3,28,13,'WOOD_FLOOR_BED'); fillRect(g,21,3,23,8,'FURNITURE_BED'); g[3][24]='FURNITURE_BED'; fillRect(g,25,3,28,4,'FURNITURE_SHELF'); fillRect(g,25,6,27,9,'RUG'); fillRect(g,23,11,26,12,'FURNITURE_PC');
  m.portals=[{x1:13.6,y1:13.65,x2:16.4,y2:15,targetScene:'FARM',spawnX:5.5,spawnY:6.45,label:'Keluar ke Kebun'}];
  m.interactZones=[{id:'BATH',x1:1.2,y1:5.2,x2:8.6,y2:10.6,prompt:'Berendam di Kolam'},{id:'WC',x1:8.3,y1:4.4,x2:11.0,y2:7.8,prompt:'Gunakan WC (BAB Pagi)'},{id:'KITCHEN',x1:11.6,y1:4.2,x2:15.1,y2:6.1,prompt:'Makan & Minum di Dapur'},{id:'FRIDGE',x1:15.0,y1:4.2,x2:17.1,y2:6.1,prompt:'Buka Kulkas (Simpan Makanan)'},{id:'CABINET',x1:17.1,y1:4.2,x2:19.0,y2:6.1,prompt:'Buka Lemari (Item Non-Makanan)'},{id:'BED',x1:20.0,y1:3.0,x2:24.8,y2:9.2,prompt:'Tidur'},{id:'PC',x1:22.0,y1:9.8,x2:27.4,y2:13.6,prompt:'Buka PC TaniNet'},{id:'DOOR_OUT',x1:13.5,y1:12.6,x2:16.5,y2:14.5,prompt:'Keluar ke Kebun'}]; return m;
}
function buildForestMap(): SceneMap {
  const m=map('FOREST','Hutan & Sungai',26,20,'DARK_GRASS'),g=m.tiles;
  fillRect(g,0,8,19,10,'DIRT_PATH');fillRect(g,10,4,13,14,'DIRT_PATH');fillRect(g,20,0,23,18,'RIVER_WATER');fillRect(g,0,15,23,18,'RIVER_WATER');fillRect(g,20,8,23,10,'WOOD_BRIDGE');fillRect(g,24,8,25,10,'DIRT_PATH');g[7][2]='SIGN';g[7][19]='SIGN';g[7][24]='SIGN';
  m.portals=[{x1:0,y1:7.7,x2:.85,y2:11.3,targetScene:'FARM',spawnX:26.2,spawnY:9.5,label:'Kembali ke Kebun'},{x1:25.15,y1:7.7,x2:26,y2:11.3,targetScene:'CLIFF',spawnX:1.5,spawnY:9.5,label:'Menuju Tebing dan Bukit Batu'}];
  m.interactZones=[{id:'STREAM',x1:18.2,y1:6.2,x2:20.5,y2:8.4,prompt:'Sungai Berarus'},{id:'RIVER_SIGN',x1:23,y1:6.4,x2:25.4,y2:8.4,prompt:'Timur: Tebing dan Bukit Batu'}];return m;
}
function buildRiverMap(): SceneMap {
  const m=map('RIVER','Pinggiran Kali',28,20,'RIVER_BANK'),g=m.tiles;
  fillRect(g,0,0,27,0,'FENCE');fillRect(g,0,19,27,19,'FENCE');fillRect(g,0,0,0,19,'FENCE');fillRect(g,27,0,27,19,'FENCE');fillRect(g,1,1,4,18,'DARK_GRASS');fillRect(g,5,1,7,18,'RIVER_BANK');fillRect(g,8,1,14,18,'RIVER_WATER');fillRect(g,8,17,27,18,'RIVER_WATER');fillRect(g,15,11,27,12,'DIRT_PATH');g[10][24]='SIGN';
  m.portals=[{x1:27.1,y1:10.6,x2:28,y2:13.4,targetScene:'FARM',spawnX:1.5,spawnY:12,label:'Kembali ke Kebun Utama'}];m.interactZones=[{id:'RIVER_BANK_SIGN',x1:22.8,y1:9.4,x2:25.8,y2:11.8,prompt:'Masuk ke Sungai & Tunggu Ikan'}];return m;
}
function buildPeakMap(): SceneMap {
  const m=map('PEAK','Lembah & Gua Misterius',28,20,'CLIFF_HILL'),g=m.tiles;fillRect(g,1,1,20,18,'CLIFF_MOSS');fillRect(g,22,4,26,18,'MOUNTAIN_ROCK');fillRect(g,22,6,23,8,'MOUNTAIN_MOSS');fillRect(g,25,13,26,15,'MOUNTAIN_MOSS');fillRect(g,22,16,24,18,'MOUNTAIN_MOSS');fillRect(g,21,0,21,19,'PEAK_CLIFF');fillRect(g,22,0,27,1,'CLIFF_MOSS');fillRect(g,22,2,27,2,'PEAK_CLIFF');g[3][24]='MYSTERIOUS_CAVE';g[3][25]='MYSTERIOUS_CAVE';fillRect(g,27,4,27,10,'PEAK_CLIFF');fillRect(g,27,13,27,19,'PEAK_CLIFF');fillRect(g,22,19,27,19,'PEAK_CLIFF');g[10][25]='SIGN';
  m.portals=[{x1:27.1,y1:10.6,x2:28,y2:13.4,targetScene:'FARM',spawnX:1.5,spawnY:11.8,label:'Kembali ke Kebun'}];m.interactZones=[{id:'MYSTERIOUS_CAVE',x1:23.2,y1:3.5,x2:26.8,y2:5.5,prompt:'Gua Misterius (Terkunci)'},{id:'PEAK_SIGN',x1:23.6,y1:8.8,x2:26.6,y2:11.4,prompt:'Tebing Tinggi & Gua Misterius'}];return m;
}
function buildOrchardMap(): SceneMap {
  const m=map('ORCHARD','Kebun Atas Nusantara',28,20,'GRASS'),g=m.tiles;fillRect(g,0,0,27,0,'FENCE');fillRect(g,0,19,27,19,'FENCE');fillRect(g,0,0,0,19,'FENCE');fillRect(g,27,0,27,19,'FENCE');fillRect(g,1,1,26,4,'DARK_GRASS');fillRect(g,1,5,2,17,'DARK_GRASS');fillRect(g,25,5,26,17,'DARK_GRASS');fillRect(g,13,0,14,19,'STONE_ROAD');g[2][12]='SIGN';fillRect(g,4,5,11,16,'VOLCANIC_ZONE');fillRect(g,16,5,23,16,'VOLCANIC_ZONE');fillRect(g,1,11,2,13,'WATER');
  m.portals=[{x1:12.5,y1:18.8,x2:15.5,y2:20,targetScene:'FARM',spawnX:14.5,spawnY:1.5,label:'Turun ke Kebun Utama'},{x1:12.5,y1:0,x2:15.5,y2:.9,targetScene:'LAB',spawnX:14,spawnY:20,label:'Masuk Hutan Kalabas & Lab'}];m.interactZones=[{id:'STREAM',x1:1,y1:10.2,x2:3.6,y2:14.2,prompt:'Isi Ember di Mata Air Rimba'},{id:'LAB_ROAD_SIGN',x1:11.1,y1:1.4,x2:13.4,y2:3.6,prompt:'Utara: Hutan Kalabas & Lab'}];return m;
}
function buildLabMap(): SceneMap {
  const m=map('LAB','Hutan Kalabas & Lab Penelitian',28,22,'DARK_GRASS'),g=m.tiles;fillRect(g,0,0,27,0,'FENCE');fillRect(g,0,21,27,21,'FENCE');fillRect(g,0,0,0,21,'FENCE');fillRect(g,27,0,27,21,'FENCE');fillRect(g,13,11,14,21,'STONE_ROAD');fillRect(g,10,7,17,11,'STONE_ROAD');fillRect(g,11,7,16,9,'LAB_FLOOR');fillRect(g,11,3,16,4,'HOUSE_ROOF');fillRect(g,11,5,16,6,'HOUSE_WALL');g[11][11]='SIGN';m.portals=[{x1:12.5,y1:21,x2:15.5,y2:22,targetScene:'ORCHARD',spawnX:14,spawnY:1.5,label:'Kembali ke Kebun Atas'}];m.interactZones=[{id:'LAB_DOOR',x1:12.4,y1:6.4,x2:15.6,y2:7.7,prompt:'Pintu Lab Terkunci'},{id:'LAB_SIGN',x1:10.2,y1:10.4,x2:12.4,y2:12.6,prompt:'Lab Penelitian & Robot Mecha'}];return m;
}
function buildCliffMap(): SceneMap {
  const m=map('CLIFF','Tebing dan Bukit Batu',28,20,'MOUNTAIN_ROCK'),g=m.tiles;fillRect(g,0,0,27,1,'CLIFF_HILL');fillRect(g,0,2,27,2,'PEAK_CLIFF');fillRect(g,25,0,27,19,'CLIFF_HILL');fillRect(g,24,2,24,17,'PEAK_CLIFF');fillRect(g,0,18,27,19,'CLIFF_HILL');fillRect(g,0,17,27,17,'PEAK_CLIFF');fillRect(g,0,8,5,10,'DIRT_PATH');fillRect(g,6,8,13,10,'RIVER_BANK');fillRect(g,11,4,13,15,'RIVER_BANK');fillRect(g,14,9,22,10,'RIVER_BANK');g[7][2]='SIGN';m.portals=[{x1:0,y1:7.7,x2:.85,y2:11.3,targetScene:'FOREST',spawnX:24.3,spawnY:9.5,label:'Kembali ke Hutan & Sungai'}];m.interactZones=[{id:'CLIFF_SIGN',x1:1,y1:6.4,x2:3.6,y2:8.6,prompt:'Tebing dan Bukit Batu'}];return m;
}
export const SCENE_MAPS: Record<SceneId, SceneMap> = { FARM:buildFarmMap(),HOUSE:buildHouseMap(),FOREST:buildForestMap(),ORCHARD:buildOrchardMap(),LAB:buildLabMap(),RIVER:buildRiverMap(),PEAK:buildPeakMap(),CLIFF:buildCliffMap() };

export const LAB_KALABAS_DROP_SPOTS: [number,number][] = [[4,4],[6,6],[9,6],[4,9],[7,12],[9,15],[21,4],[18,6],[23,9],[21,12],[18,15],[11,14]];
function makeObj(scene: SceneId, tx: number, ty: number, kind: WorldObject['kind'], id: string, itemId?: string, label?: string): WorldObject {
  return { id, scene, tx, ty, kind, ...(itemId ? {itemId} : {}), hp:kind==='FRUIT_TREE'?99:kind==='TREE'?4:kind==='ROCK'?3:1, maxHp:kind==='FRUIT_TREE'?99:kind==='TREE'?4:kind==='ROCK'?3:1, ...(kind==='FRUIT_TREE'?{harvestReady:true,regrowTimer:0}:{}), ...(label?{label}:{}) };
}
export function createForestSceneObjects(startSeq=200): WorldObject[] {
  const objs:WorldObject[]=[];let seq=startSeq;
  // Forest upper tree cover reduced by about half; lower cover reduced to about 30%.
  const trees:[number,number][]=[[2,0],[10,0],[18,0],[1,1],[5,1],[14,1],[18,1],[2,3],[6,3],[15,3],[19,3],[1,5],[5,5],[14,5],[18,5],[25,5],[5,11],[14,12]];
  for(const [x,y] of trees)objs.push(makeObj('FOREST',x,y,'TREE',`obj_${seq++}`,'','Pohon Hutan Rimbun'));
  const rocks:[number,number][]=[[5,12],[15,14],[19,4],[8,4],[19,14],[18,2],[18,6],[18,13],[17,14],[24,2],[24,13],[24,16],[21,15],[22,14],[23,15],[24,15],[19,15],[17,16],[5,15],[6,15],[7,15],[8,15],[9,15]];
  for(const [x,y] of rocks)objs.push(makeObj('FOREST',x,y,'ROCK',`obj_${seq++}`));
  const forage:[number,number,string][]=[[4,4,'jamur_liar'],[17,4,'daun_herbal'],[7,14,'jamur_liar'],[19,12,'daun_herbal'],[16,3,'akar_ginseng'],[5,15,'jamur_liar'],[7,15,'jamur_liar'],[20,15,'jamur_liar'],[22,15,'daun_herbal'],[17,13,'daun_herbal']];
  for(const [x,y,id] of forage)objs.push(makeObj('FOREST',x,y,'FORAGE',`obj_${seq++}`,id));
  const extras:[number,number,'WEED'|'TWIG'][]=[[6,14,'WEED'],[7,13,'TWIG'],[9,13,'WEED'],[18,15,'WEED'],[20,14,'TWIG'],[22,13,'WEED'],[12,15,'TWIG'],[15,15,'WEED'],[23,17,'TWIG']];
  for(const [x,y,k] of extras)objs.push(makeObj('FOREST',x,y,k,`obj_${seq++}`));
  return objs;
}
export function createRiverSceneObjects(startSeq=3500): WorldObject[] {
  const objs:WorldObject[]=[];let n=startSeq;const rocks:[number,number][]=[[16,2],[18,1],[20,2],[22,1],[24,2],[15,4],[17,4],[19,3],[21,4],[23,4],[25,3],[16,6],[18,6],[20,6],[22,6],[24,6],[15,8],[17,8],[19,8],[21,8],[23,8],[26,7],[16,14],[18,15],[20,14],[22,15],[24,14],[26,15],[6,3],[5,7],[6,11],[5,15],[7,14]];for(const [x,y] of rocks)objs.push(makeObj('RIVER',x,y,'ROCK',`river_rock_${n++}`,'','Batu Kali'));const trees:[number,number][]=[[2,2],[4,1],[2,5],[3,9]];for(const [x,y] of trees)objs.push(makeObj('RIVER',x,y,'TREE',`river_tree_${n++}`,'','Pohon Pinggir Kali'));return objs;
}
export function createFarmSceneObjects(startSeq=1): WorldObject[] {const coords:[number,number][]=[[1,2],[1,6],[1,14],[2,18],[3,11],[5,18],[8,18],[11,2],[21,1],[25,1],[24,3],[23,6],[21,12],[25,12],[24,14]];return coords.map(([x,y],i)=>makeObj('FARM',x,y,'TREE',`obj_${startSeq+i}`,'','Pohon Kayu Kebun'));}
export function createKebunAtasObjects(startSeq=500): WorldObject[] {const out:WorldObject[]=[];let n=startSeq;for(const [x,y] of [[3,2],[8,2],[18,2],[24,2]] as [number,number][])out.push(makeObj('ORCHARD',x,y,'FRUIT_TREE',`obj_${n++}`,'buah_kalabas','Pohon Kalabas Tua'));for(const [x,y,item] of [[5,3,'buah_mangga'],[10,3,'buah_durian'],[22,3,'buah_mangga'],[25,11,'kelapa_gading']] as [number,number,string][])out.push(makeObj('ORCHARD',x,y,'FRUIT_TREE',`obj_${n++}`,item));return out;}
export function spawnFallenKalabasDrops(existingObjs:WorldObject[],startSeq=3000):WorldObject[]{const out=[...existingObjs];let n=startSeq;for(const [x,y] of LAB_KALABAS_DROP_SPOTS)if(!out.some(o=>o.scene==='LAB'&&o.tx===x&&o.ty===y))out.push({...makeObj('LAB',x,y,'FORAGE',`kalabas_drop_${n++}_${x}_${y}`,'buah_kalabas','Buah Kalabas Jatuh'),quantity:1});return out;}
export function createLabSceneObjects(startSeq=2000):WorldObject[]{const coords:[number,number][]=[[4,1],[10,1],[16,1],[22,1],[2,3],[8,3],[19,3],[25,3],[3,5],[7,5],[20,5],[24,5],[2,8],[8,8],[19,8],[25,8],[3,11],[24,11],[5,14],[22,14]];const trees=coords.map(([x,y],i)=>makeObj('LAB',x,y,'FRUIT_TREE',`obj_${startSeq+i}`,'buah_kalabas','Pohon Kalabas Tua Rimbun'));return spawnFallenKalabasDrops(trees,startSeq+100);}
export function createPeakSceneObjects(startSeq=4500):WorldObject[]{return [[22,15],[23,17],[25,17],[22,6]].map(([x,y],i)=>makeObj('PEAK',x,y,'ROCK',`peak_rock_${startSeq+i}`,'','Batu Lembah'));}
export function createCliffSceneObjects(startSeq=5500):WorldObject[]{const coords:[number,number][]=[[3,4],[5,4],[5,6],[10,4],[14,4],[21,4],[23,5],[20,6],[22,7],[6,12],[8,13],[4,14],[6,15],[9,15],[14,15],[19,13],[21,12],[22,14],[20,15],[16,8],[20,8],[22,11]];return coords.map(([x,y],i)=>makeObj('CLIFF',x,y,'ROCK',`cliff_rock_${startSeq+i}`,'','Batu Bukit'));}
export function randomizeHalfKalabasFruiting(objs:WorldObject[]):WorldObject[]{const ids=objs.map((o,i)=>o.kind==='FRUIT_TREE'&&o.itemId==='buah_kalabas'?i:-1).filter(i=>i>=0);for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}const ready=new Set(ids.slice(0,Math.floor(ids.length/2)));return objs.map((o,i)=>o.kind==='FRUIT_TREE'&&o.itemId==='buah_kalabas'?{...o,harvestReady:ready.has(i),regrowTimer:0}:o);}
export function createInitialWorldObjects():WorldObject[]{return randomizeHalfKalabasFruiting([...createFarmSceneObjects(),...createForestSceneObjects(),...createKebunAtasObjects(),...createLabSceneObjects(),...createRiverSceneObjects(),...createPeakSceneObjects(),...createCliffSceneObjects()]);}
