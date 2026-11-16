import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Fish, Sword, Waves } from 'lucide-react';
import { BackpackModal } from './components/BackpackModal';
import {
  CABINET_TOTAL_SLOTS,
  CabinetModal,
  isCabinetNonFoodItem,
} from './components/CabinetModal';
import {
  FRIDGE_TOTAL_SLOTS,
  FridgeModal,
  isFridgeFoodItem,
} from './components/FridgeModal';
import { HUD, ZOOM_PRESETS } from './components/HUD';
import {
  DaySummaryModal,
  KitchenModal,
  PauseModal,
  RobotRecruitModal,
  SleepConfirmModal,
} from './components/Overlays';
import { PCModal } from './components/PCModal';
import { DevIntroSplash } from './components/DevIntroSplash';
import { IntroCutscene } from './components/IntroCutscene';
import { TitleScreen } from './components/TitleScreen';
import {
  CROPS,
  DAY_MAX_MINUTES,
  DAY_START_MINUTES,
  DAYS_PER_SEASON,
  getBagCapacity,
  getLevelMinXp,
  getPlayerLevel,
  ITEMS,
  MAX_PLAYER_LEVEL,
  ORCHARD_LEFT_PRICE,
  ORCHARD_PLOT_MIN_LEVEL,
  ORCHARD_RIGHT_PRICE,
  REAL_SECONDS_PER_DAY,
  rollWeatherForSeason,
  SEASON_ORDER,
  SEASONS,
  SLOTS_PER_BAG_UPGRADE,
  WEATHER_LABELS,
} from './data/cropsAndItems';
import {
  createCliffSceneObjects,
  createFarmSceneObjects,
  createForestSceneObjects,
  createInitialWorldObjects,
  createKebunAtasObjects,
  createLabSceneObjects,
  createPeakSceneObjects,
  createRiverSceneObjects,
  InteractZone,
  isTileSolid,
  randomizeHalfKalabasFruiting,
  SCENE_MAPS,
  spawnFallenKalabasDrops,
  TILE_SIZE,
} from './engine/maps';
import { findPathToTile, Waypoint } from './engine/pathfinding';
import { PlayerActionKind } from './engine/characterRenderer';
import { FacingDir, Particle, renderGameWorld, RiverFish } from './engine/renderer';
import { CombatProjectile, preloadRobotSprite } from './engine/robotRenderer';
import {
  DailyOrder,
  DaySummaryData,
  GamePhase,
  InventorySlot,
  PlotState,
  SaveData,
  SceneId,
  Season,
  UpgradesState,
  WorldObject,
} from './types/game';
import { soundEngine } from './utils/audio';
import { markCodeUsed, validateRedeemCode } from './utils/redeemCode';
import { loadCleanFarmerSprite, preloadCabinetSprite, preloadFridgeSprite } from './utils/spriteLoader';

const SAVE_KEY = 'nusa_tani_save_v1';
const GAME_MINUTES_PER_REAL_SEC = (DAY_MAX_MINUTES - DAY_START_MINUTES) / REAL_SECONDS_PER_DAY; // 2.0 game mins per real sec
