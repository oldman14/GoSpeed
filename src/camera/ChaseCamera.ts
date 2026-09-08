import * as THREE from 'three';
import { KinematicVehicle } from '../physics/KinematicVehicle';
import { BoostType, DriftState } from '../types';

export class ChaseCamera {
  public camera: THREE.PerspectiveCamera;
  private currentPos: THREE.Vector3 = new THREE.Vector3();
  private currentLookAt: THREE.Vector3 = new THREE.Vector3();

  private baseFov: number = 64;
  private targetFov: number = 64;

  constructor(fov: number, aspect: number, near: number, far: number) {
    this.baseFov = fov;
    this.targetFov = fov;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
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

  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
