import * as THREE from 'three';
import { KinematicVehicle } from '../physics/KinematicVehicle';
import { TrackBuilder } from '../track/TrackBuilder';
import { VehicleInputs } from '../types';

export class AIRacer {
  public vehicle: KinematicVehicle;
  public track: TrackBuilder;
  public currentU: number = 0;
  public name: string;
  public isPlayer: boolean = false;

  private laneOffset: number; // Stagger AI racers horizontally across track width
  private targetSpeed: number = 46; // m/s
  private driftTriggerThreshold: number = 0.55;

  constructor(
    vehicle: KinematicVehicle,
    track: TrackBuilder,
    initialU: number,
    laneOffset: number,
    name: string
  ) {
    this.vehicle = vehicle;
    this.track = track;
    this.currentU = initialU;
    this.laneOffset = laneOffset;
    this.name = name;
  }

  public update(dt: number, playerVehicle: KinematicVehicle): VehicleInputs {
    // 1. Advance track spline U estimate based on vehicle position
    const lookAheadDistance = 0.04; // look ahead along spline
    const targetU = (this.currentU + lookAheadDistance) % 1.0;
    const centerTarget = this.track.curve.getPointAt(targetU);
    const tangent = this.track.curve.getTangentAt(targetU);
    const normal = new THREE.Vector3(0, 1, 0);
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();

    // Offset across lane so bots don't drive in a single identical line
    const targetPos = centerTarget.clone().addScaledVector(binormal, this.laneOffset);

    // 2. Calculate steering required to reach target
    const currentHeading = this.vehicle.heading;
    const forwardVec = new THREE.Vector3(Math.sin(currentHeading), 0, Math.cos(currentHeading));
    const toTarget = new THREE.Vector3().subVectors(targetPos, this.vehicle.position).normalize();

    // Cross product Y gives signed turn direction
    const crossY = forwardVec.x * toTarget.z - forwardVec.z * toTarget.x;
    let steering = THREE.MathUtils.clamp(-crossY * 2.8, -1, 1);

    // 3. Determine if corner is sharp enough to drift
    const dotForward = forwardVec.dot(toTarget);
    let drift = false;
    if (dotForward < this.driftTriggerThreshold && this.vehicle.speed > 20) {
      drift = true;
    }

    // 4. Update currentU position along track
    // Approximate progress
    const splineLength = this.track.totalLength;
    this.currentU = (this.currentU + (this.vehicle.speed * dt) / splineLength) % 1.0;

    // 5. Rubber-Banding Logic
    const distToPlayer = this.vehicle.position.distanceTo(playerVehicle.position);
    let rubberBandMultiplier = 1.0;

    // Check who is ahead (by comparing distance along track)
    const isBehindPlayer = this.vehicle.position.z < playerVehicle.position.z;
    if (isBehindPlayer && distToPlayer > 30) {
      // Speed up slightly when lagging behind
      rubberBandMultiplier = 1.08;
    } else if (!isBehindPlayer && distToPlayer > 50) {
      // Moderate speed slightly when way ahead
      rubberBandMultiplier = 0.94;
    }

    // 6. Throttle & Nitro decision
    let throttle = 1.0;
    if (this.vehicle.speed > this.targetSpeed * rubberBandMultiplier && !this.vehicle.boostSystem.isBoosting()) {
      throttle = 0.6;
    }

    let nitro = false;
    // Fire nitro on long straights (when dotForward is high and steering is low)
    if (dotForward > 0.92 && Math.abs(steering) < 0.2 && this.vehicle.boostSystem.nitroCount > 0) {
      nitro = Math.random() < 0.05; // natural chance on straightaways
    }

    // Trigger mini boost tap on drift exit
    if (this.vehicle.driftState !== 'NONE' && !drift) {
      this.vehicle.boostSystem.handleThrottleTap(this.vehicle.isGrounded);
    }

    return { throttle, steering, drift, nitro };
  }
}
