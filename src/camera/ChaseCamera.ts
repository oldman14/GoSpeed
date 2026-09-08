import * as THREE from 'three';
import { KinematicVehicle } from '../physics/KinematicVehicle';
import { BoostType, DriftState } from '../types';

export class ChaseCamera {
  public camera: THREE.PerspectiveCamera;
  private currentPos: THREE.Vector3 = new THREE.Vector3();
  private currentLookAt: THREE.Vector3 = new THREE.Vector3();

  private baseFov: number = 64;
  private targetFov: number = 64;
  private trauma: number = 0;

  constructor(fov: number, aspect: number, near: number, far: number) {
    this.baseFov = fov;
    this.targetFov = fov;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  }

  public addTrauma(amount: number) {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  public update(dt: number, vehicle: KinematicVehicle) {
    // In QQ Speed, camera tracks trajectory during drift so player has a clear view ahead
    const camAngle = (vehicle.driftState !== DriftState.NONE)
      ? vehicle.trajectoryHeading + (vehicle.heading - vehicle.trajectoryHeading) * 0.25
      : vehicle.heading;

    const forward = new THREE.Vector3(Math.sin(camAngle), 0, Math.cos(camAngle));

    // Follow distance increases slightly with speed
    const speedRatio = Math.abs(vehicle.speed) / vehicle.baseMaxSpeed;
    const followDist = 7.0 + speedRatio * 1.5;
    const height = 3.3 + (vehicle.isGrounded ? 0 : 0.8);

    const targetPos = vehicle.position.clone()
      .addScaledVector(forward, -followDist)
      .add(new THREE.Vector3(0, height, 0));

    // Smooth camera inertia
    this.currentPos.lerp(targetPos, dt * 6.5);
    this.camera.position.copy(this.currentPos);

    // Apply screen shake trauma
    if (this.trauma > 0) {
      const shake = this.trauma * this.trauma * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * shake;
      this.camera.position.y += (Math.random() - 0.5) * shake;
      this.camera.position.z += (Math.random() - 0.5) * shake;
      this.trauma = Math.max(0, this.trauma - dt * 3.0);
    }

    // Look At Target (Ahead along trajectory)
    const targetLookAt = vehicle.position.clone()
      .addScaledVector(forward, 11)
      .add(new THREE.Vector3(0, 1.2, 0));

    this.currentLookAt.lerp(targetLookAt, dt * 8.0);
    this.camera.lookAt(this.currentLookAt);

    // Dynamic FOV Warp
    const isBoosting = vehicle.boostSystem.isBoosting();
    const boostType = vehicle.boostSystem.getActiveBoostType();

    if (isBoosting) {
      if (boostType === BoostType.CWW_BOOST) {
        this.targetFov = 85;
      } else if (boostType === BoostType.NITRO || boostType === BoostType.WCW_BOOST) {
        this.targetFov = 77;
      } else {
        this.targetFov = 71;
      }
    } else {
      this.targetFov = this.baseFov + speedRatio * 3.5;
    }

    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.targetFov, dt * 5);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Showroom / Garage camera mode:
   * Frames the car in the open area to the right of the 460px sidebar panel.
   * Smoothly pans and zooms to target specific components (Body, Wheels, Spoiler, Exhaust).
   */
  public updateGarage(
    dt: number,
    vehiclePos: THREE.Vector3,
    vehicleHeading: number,
    partFocus: string,
    kartYaw: number
  ) {
    this.targetFov = 50; // Focused, distortion-free showroom FOV
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.targetFov, dt * 6);
    this.camera.updateProjectionMatrix();

    // The car is rotated by kartYaw relative to its base heading
    const totalYaw = vehicleHeading + kartYaw;
    const fwd = new THREE.Vector3(Math.sin(totalYaw), 0, Math.cos(totalYaw));
    const right = new THREE.Vector3(Math.cos(totalYaw), 0, -Math.sin(totalYaw));
    const up = new THREE.Vector3(0, 1, 0);

    // Calculate part center & ideal camera viewpoint relative to kart
    let localTargetOffset = new THREE.Vector3(0, 0.55, 0);
    let camOffset = new THREE.Vector3(2.8, 1.6, 3.8); // 3/4 beauty view default

    switch (partFocus) {
      case 'BODY':
      case 'LIVERY':
        // Close-up on the front hood and livery patterns
        localTargetOffset = new THREE.Vector3(0, 0.5, 0.9);
        camOffset = new THREE.Vector3(1.6, 1.4, 2.8);
        break;
      case 'RIMS':
        // Low-angle close-up of the front-left wheel and rim
        localTargetOffset = new THREE.Vector3(-0.9, 0.38, 0.9);
        camOffset = new THREE.Vector3(-2.2, 0.65, 1.5);
        break;
      case 'SPOILER':
        // High rear-quarter view of the aerodynamic wing
        localTargetOffset = new THREE.Vector3(0, 0.95, -1.2);
        camOffset = new THREE.Vector3(1.8, 1.8, -2.6);
        break;
      case 'EXHAUST':
        // Close-up rear center of the dual thrusters & flame glow
        localTargetOffset = new THREE.Vector3(0, 0.5, -1.5);
        camOffset = new THREE.Vector3(0.3, 0.8, -2.5);
        break;
      case 'NEON':
        // Low ground-level side angle showing glowing underglow and accents
        localTargetOffset = new THREE.Vector3(0, 0.25, 0);
        camOffset = new THREE.Vector3(3.2, 0.5, 1.2);
        break;
      case 'OVERVIEW':
      default:
        // Full overview showcasing the complete car
        localTargetOffset = new THREE.Vector3(0, 0.6, 0);
        camOffset = new THREE.Vector3(3.2, 1.8, 4.2);
        break;
    }

    // World target point
    const worldLookAt = vehiclePos.clone().add(
      fwd.clone().multiplyScalar(localTargetOffset.z)
    ).add(
      right.clone().multiplyScalar(localTargetOffset.x)
    ).add(
      up.clone().multiplyScalar(localTargetOffset.y)
    );

    // Compute world camera position using kart orientation
    const desiredCamPos = vehiclePos.clone().add(
      fwd.clone().multiplyScalar(camOffset.z)
    ).add(
      right.clone().multiplyScalar(camOffset.x)
    ).add(
      up.clone().multiplyScalar(camOffset.y)
    );

    // Now shift the camera so the car is framed to the RIGHT side of the screen
    // (leaving the left 460px sidebar unobstructed)
    const viewDir = desiredCamPos.clone().sub(worldLookAt).normalize();
    const sideDir = new THREE.Vector3().crossVectors(viewDir, up).normalize();
    // Shift camera slightly to the right of the line-of-sight
    desiredCamPos.addScaledVector(sideDir, -0.65);

    this.currentPos.lerp(desiredCamPos, dt * 5.0);
    this.currentLookAt.lerp(worldLookAt, dt * 6.0);

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLookAt);
  }

  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}

