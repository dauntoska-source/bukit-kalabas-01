import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { createFarmSceneObjects, createForestSceneObjects, createLabSceneObjects, createRiverSceneObjects } from './engine/maps';
import './index.css';

// One-time migration: update old browser saves to the reduced FARM/FOREST/RIVER/LAB tree layout
// without deleting the player's inventory, crops, upgrades, or other progress.
const SAVE_KEY = 'nusa_tani_save_v1';
const TREE_LAYOUT_VERSION = 3;
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    const save = JSON.parse(raw) as {
      treeLayoutVersion?: number;
      worldObjects?: Array<{ scene: string; kind: string; tx?: number; ty?: number }>;
    };
    if (save.treeLayoutVersion !== TREE_LAYOUT_VERSION && Array.isArray(save.worldObjects)) {
      const farmTrees = createFarmSceneObjects(1).filter((object) => object.kind === 'TREE');
      const forestTrees = createForestSceneObjects(200).filter((object) => object.kind === 'TREE');
      const riverTrees = createRiverSceneObjects(3500).filter((object) => object.kind === 'TREE');
      const labTrees = createLabSceneObjects(2000).filter((object) => object.kind === 'FRUIT_TREE');
      const labTreePositions = new Set(labTrees.map((object) => `${object.tx}:${object.ty}`));
      const savedLabTrees = new Map(
        save.worldObjects
          .filter(
            (object) =>
              object.scene === 'LAB' &&
              object.kind === 'FRUIT_TREE' &&
              labTreePositions.has(`${object.tx}:${object.ty}`)
          )
          .map((object) => [`${object.tx}:${object.ty}`, object])
      );
      const migratedLabTrees = labTrees.map((tree) => savedLabTrees.get(`${tree.tx}:${tree.ty}`) ?? tree);

      save.worldObjects = [
        ...save.worldObjects.filter(
          (object) =>
            !(['FARM', 'FOREST', 'RIVER'].includes(object.scene) && object.kind === 'TREE') &&
            !(object.scene === 'LAB' && object.kind === 'FRUIT_TREE')
        ),
        ...farmTrees,
        ...forestTrees,
        ...riverTrees,
        ...migratedLabTrees,
      ];
      save.treeLayoutVersion = TREE_LAYOUT_VERSION;
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    }
  }
} catch (error) {
  console.error('Could not update saved FARM/FOREST/RIVER/LAB tree layout:', error);
}

createRoot(document.getElementById('root')!).render(<App />);
