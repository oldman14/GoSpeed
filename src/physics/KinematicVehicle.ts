import * as THREE from 'three';
import { VehicleInputs, DriftState } from '../types';
import { BoostSystem } from '../mechanics/BoostSystem';

export class KinematicVehicle {
  public position: THREE.Vector3 = new THREE.Vector3();
  public quaternion: THREE.Quaternion = new THREE.Quaternion();
  public velocity: THREE.Vector3 = new THREE.Vector3();

  // Kinematic parameters
  public speed: number = 0; // m/s forward
  public heading: number = 0; // Chassis visual yaw angle in radians
  public trajectoryHeading: number = 0; // Motion direction in radians (QQ Speed decoupled model)
  public driftAngle: number = 0; // Relative visual slip angle between chassis & trajectory
  
  public pitch: number = 0; // suspension dive / squat
  public roll: number = 0; // lateral body lean

  public steerAngle: number = 0; // Front wheels visual steering
  public driftSlipAngle: number = 0; // For particle & HUD systems
  public driftState: DriftState = DriftState.NONE;
  public isGrounded: boolean = true;

  public verticalVelocity: number = 0;

  // Filtered inputs for weight and inertia
  private filteredSteer: number = 0;
  private prevSpeed: number = 0;

  // Base physics constants
  public baseMaxSpeed: number = 52; // ~187 km/h
  public baseAcceleration: number = 34; // m/s^2
  public brakeDeceleration: number = 48;
  public naturalFriction: number = 7.5;
  public baseSteerSensitivity: number = 1.35; // smooth grip steering
  public gravity: number = 32;

  // System
  public boostSystem: BoostSystem;

  // Reusable vectors for zero allocation
  private upVec = new THREE.Vector3(0, 1, 0);

  constructor(initialPosition: THREE.Vector3, initialHeading: number = 0) {
    this.position.copy(initialPosition);
    this.heading = initialHeading;
    this.trajectoryHeading = initialHeading;
    this.boostSystem = new BoostSystem();
    this.updateOrientation();
  }

  public update(
    dt: number,
    inputs: VehicleInputs,
    getGroundHeight: (pos: THREE.Vector3) => { height: number; normal: THREE.Vector3 }
  ) {
    // 1. Check Nitro input
    if (inputs.nitro) {
      this.boostSystem.handleNitroActivate();
    }

    // 2. Input Filtering (Steering Inertia)
    const steerTarget = inputs.steering;
    const steerSpeed = steerTarget !== 0 ? 5.5 : 8.5; // Smooth turn-in, faster recentering
    this.filteredSteer = THREE.MathUtils.lerp(this.filteredSteer, steerTarget, dt * steerSpeed);

    // 3. Speed-Sensitive Steering for Normal Grip Driving
    const speedKmh = this.getSpeedKmh();
    const speedSteerFactor = THREE.MathUtils.clamp(1.0 - (speedKmh / 320) * 0.55, 0.42, 1.0);
    const effectiveSensitivity = this.baseSteerSensitivity * speedSteerFactor;

    // 4. Drift State Machine (QQ Speed / KartRider Style)
    const minDriftSpeed = 12; // ~43 km/h
    const wasDrifting = this.driftState !== DriftState.NONE;
    if (inputs.drift && Math.abs(inputs.steering) > 0.15 && this.speed > minDriftSpeed && this.isGrounded) {
      if (this.driftState === DriftState.NONE) {
        this.driftState = inputs.steering < 0 ? DriftState.DRIFTING_LEFT : DriftState.DRIFTING_RIGHT;
      }
    } else if (!inputs.drift || this.speed < 8) {
      this.driftState = DriftState.NONE;
    }

    // 5. Calculate Steering & Trajectory vs Heading (The Decoupled QQ Speed Drift Formula)
    const targetVisualSteer = -this.filteredSteer * 0.45;
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetVisualSteer, dt * 10);

    if (this.driftState !== DriftState.NONE) {
      const driftDir = this.driftState === DriftState.DRIFTING_LEFT ? 1 : -1;

      // Steer factor relative to drift direction:
      // +1 = holding steering into the turn (tighten arc)
      // -1 = counter-steering against the turn (widen arc / pull nose)
      const steerInto = this.driftState === DriftState.DRIFTING_LEFT 
        ? -this.filteredSteer 
        : this.filteredSteer;

      // Trajectory curve rate: smooth, controlled arc (0.5 to 1.1 rad/s)
      // Player can counter-steer to push car wide or hold into turn to hug the apex!
      const trajectoryArcRate = THREE.MathUtils.clamp(0.75 + steerInto * 0.42, 0.28, 1.15);
      const baseTurnSpeed = 1.05; // rad/s (~60 deg/s)
      const speedFactor = THREE.MathUtils.clamp(this.speed / 36, 0.65, 1.1);

      this.trajectoryHeading += driftDir * baseTurnSpeed * trajectoryArcRate * speedFactor * dt;

      // Target visual chassis drift angle:
      // In QQ Speed, chassis angles inward by 20 to 30 degrees while kart slides forward
      // Pulling the nose (counter-steering) reduces the drift angle
      const targetAngle = THREE.MathUtils.clamp(0.36 + steerInto * 0.22, 0.10, 0.50);
      this.driftAngle = THREE.MathUtils.lerp(this.driftAngle, targetAngle, dt * 5.0);

      // Chassis heading = trajectory direction + visual drift offset
      this.heading = this.trajectoryHeading + driftDir * this.driftAngle;
      this.driftSlipAngle = driftDir * this.driftAngle;

    } else {
      if (wasDrifting) {
        // Exiting drift: preserve the nose heading so it NEVER snaps straight!
        // The movement trajectory seamlessly adopts the vehicle's exit heading.
        this.trajectoryHeading = this.heading;
        this.driftAngle = 0;
        this.driftSlipAngle = 0;
      }

      // Normal Grip Driving: Heading is steered, and Trajectory follows heading
      const gripTurnRate = -this.filteredSteer * effectiveSensitivity * (this.speed / Math.max(this.baseMaxSpeed * 0.4, 15));
      this.heading += gripTurnRate * dt;
      this.trajectoryHeading = this.heading;

      // Drift angle stays zero in grip mode
      this.driftAngle = THREE.MathUtils.lerp(this.driftAngle, 0, dt * 10.0);
      this.driftSlipAngle = THREE.MathUtils.lerp(this.driftSlipAngle, 0, dt * 10.0);
    }

    // 6. Boost Multipliers & Terminal Velocity
    const boostMultiplier = this.boostSystem.getBoostMultiplier();
    const effectiveMaxSpeed = this.baseMaxSpeed * boostMultiplier;
    const effectiveAccel = this.baseAcceleration * Math.max(boostMultiplier, 1.15);

    // 7. Longitudinal Acceleration & Engine Inertia
    if (inputs.throttle > 0) {
      if (this.speed < effectiveMaxSpeed) {
        const speedRatio = Math.min(1.0, Math.abs(this.speed) / effectiveMaxSpeed);
        const torqueCurve = Math.max(0.35, 1.0 - Math.pow(speedRatio, 1.8));
        this.speed += effectiveAccel * inputs.throttle * torqueCurve * dt;
      } else {
        this.speed = THREE.MathUtils.lerp(this.speed, effectiveMaxSpeed, dt * 2.0);
      }
    } else if (inputs.throttle < 0) {
      if (this.speed > 0) {
        this.speed -= this.brakeDeceleration * dt;
      } else {
        this.speed -= this.baseAcceleration * 0.4 * dt;
        if (this.speed < -14) this.speed = -14;
      }
    } else {
      // Coasting friction
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - this.naturalFriction * dt);
      } else if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + this.naturalFriction * dt);
      }
    }

    // QQ Speed momentum retention in drift (only minor speed scrub)
    if (this.driftState !== DriftState.NONE && !this.boostSystem.isBoosting()) {
      this.speed -= dt * 2.2;
    }

    // 8. Velocity calculation along Trajectory Heading
    // The velocity vector follows trajectoryHeading smoothly
    this.velocity.set(
      Math.sin(this.trajectoryHeading) * this.speed,
      0,
      Math.cos(this.trajectoryHeading) * this.speed
    );

    // Apply translation
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // 9. Suspension Weight Transfer (Pitch & Roll)
    const accelForce = (this.speed - this.prevSpeed) / Math.max(dt, 0.001);
    this.prevSpeed = this.speed;

    const targetPitch = THREE.MathUtils.clamp(-accelForce * 0.0024, -0.045, 0.065);
    this.pitch = THREE.MathUtils.lerp(this.pitch, targetPitch, dt * 6.5);

    // Subtle body lean: in drift, kart rolls outward against centrifugal force
    const lateralG = -this.filteredSteer * (this.speed / this.baseMaxSpeed);
    const targetRoll = (this.driftState !== DriftState.NONE)
      ? -this.driftSlipAngle * 0.25
      : lateralG * 0.16;
    this.roll = THREE.MathUtils.lerp(this.roll, targetRoll, dt * 7.0);

    // 10. Ground Raycast & Vertical Physics
    const groundInfo = getGroundHeight(this.position);
    const targetY = groundInfo.height;

    if (this.position.y > targetY + 0.15) {
      this.isGrounded = false;
      this.verticalVelocity -= this.gravity * dt;
      this.position.y += this.verticalVelocity * dt;

      if (this.position.y <= targetY) {
        this.position.y = targetY;
        this.verticalVelocity = 0;
        this.isGrounded = true;
      }
    } else {
      this.isGrounded = true;
      this.position.y = THREE.MathUtils.lerp(this.position.y, targetY, dt * 25);
      this.verticalVelocity = 0;
    }

    // 11. Update Boost System
    this.boostSystem.update(
      dt,
      this.driftState !== DriftState.NONE,
      this.isGrounded,
      this.getSpeedKmh()
    );

    // 12. Update Orientation Matrix
    this.updateOrientation(groundInfo.normal);
  }

  private updateOrientation(groundNormal?: THREE.Vector3) {
    const euler = new THREE.Euler(this.pitch, this.heading, this.roll, 'YXZ');
    this.quaternion.setFromEuler(euler);

    if (groundNormal && this.isGrounded) {
      const normalQuat = new THREE.Quaternion().setFromUnitVectors(this.upVec, groundNormal);
      this.quaternion.premultiply(normalQuat);
    }
  }

  public triggerLaunch(upwardForce: number = 18) {
    this.verticalVelocity = upwardForce;
    this.isGrounded = false;
  }

  public getSpeedKmh(): number {
    return Math.abs(Math.round(this.speed * 3.6));
  }

  public getDisplaySpeed(): number {
    return Math.round(this.speed * 3.6);
  }
}
