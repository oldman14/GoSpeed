import * as THREE from 'three';

export interface VehicleInputs {
  throttle: number; // -1 (reverse/brake) to +1 (forward)
  steering: number; // -1 (left) to +1 (right)
  drift: boolean;
  nitro: boolean;
}

export enum DriftState {
  NONE = 'NONE',
  DRIFTING_LEFT = 'DRIFTING_LEFT',
  DRIFTING_RIGHT = 'DRIFTING_RIGHT'
}

export enum BoostType {
  MINI_BOOST = 'MINI_BOOST',
  DOUBLE_BOOST = 'DOUBLE_BOOST',
  NITRO = 'NITRO',
  CWW_BOOST = 'CWW_BOOST',
  WCW_BOOST = 'WCW_BOOST',
  AIR_BOOST = 'AIR_BOOST',
  LAND_BOOST = 'LAND_BOOST',
  SPEED_PAD = 'SPEED_PAD'
}

export interface BoostEvent {
  type: BoostType;
  title: string;
  duration: number;
  powerMultiplier: number;
  color: string;
}

export interface Checkpoint {
  index: number;
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  normal: THREE.Vector3;
  radius: number;
}

export interface RacerProgress {
  racerId: string;
  name: string;
  isPlayer: boolean;
  lap: number;
  currentCheckpointIndex: number;
  distanceAlongTrack: number;
  rank: number;
  finished: boolean;
  finishTime: number;
  lastLapTime: number;
  bestLapTime: number;
}
