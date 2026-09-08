import * as THREE from 'three';
import { KinematicVehicle } from '../physics/KinematicVehicle';
import { BoostType } from '../types';

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
    // 1. Calculate Target Position based on vehicle heading
    const visualYaw = vehicle.heading - vehicle.driftSlipAngle * 0.4;
    const forward = new THREE.Vector3(Math.sin(visualYaw), 0, Math.cos(visualYaw));

    // Follow distance increases slightly with speed
    const speedRatio = vehicle.speed / vehicle.baseMaxSpeed;
    const followDist = 6.8 + speedRatio * 1.6;
    const height = 3.2 + (vehicle.isGrounded ? 0 : 0.8);

    const targetPos = vehicle.position.clone()
      .addScaledVector(forward, -followDist)
      .add(new THREE.Vector3(0, height, 0));

    // Damping position
    this.currentPos.lerp(targetPos, dt * 10);
    this.camera.position.copy(this.currentPos);

    // 2. Look At Target (Ahead of the vehicle)
    const targetLookAt = vehicle.position.clone()
      .addScaledVector(forward, 12)
      .add(new THREE.Vector3(0, 1.2, 0));

    this.currentLookAt.lerp(targetLookAt, dt * 12);
    this.camera.lookAt(this.currentLookAt);

    // 3. Dynamic FOV Warp
    const isBoosting = vehicle.boostSystem.isBoosting();
    const boostType = vehicle.boostSystem.getActiveBoostType();

    if (isBoosting) {
      if (boostType === BoostType.CWW_BOOST) {
        this.targetFov = 86; // Extreme CWW rush!
      } else if (boostType === BoostType.NITRO || boostType === BoostType.WCW_BOOST) {
        this.targetFov = 78;
      } else {
        this.targetFov = 72; // Mini-boost
      }
    } else {
      this.targetFov = this.baseFov + speedRatio * 4;
    }

    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.targetFov, dt * 6);
    this.camera.updateProjectionMatrix();
  }

  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
