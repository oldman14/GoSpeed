import * as THREE from 'three';
import { VehicleInputs, DriftState } from '../types';
import { BoostSystem } from '../mechanics/BoostSystem';

export class KinematicVehicle {
  public position: THREE.Vector3 = new THREE.Vector3();
  public quaternion: THREE.Quaternion = new THREE.Quaternion();
  public velocity: THREE.Vector3 = new THREE.Vector3();

  // Kinematic parameters
  public speed: number = 0; // m/s
  public heading: number = 0; // yaw angle in radians
  public pitch: number = 0; // suspension dive / squat
  public roll: number = 0; // lateral body lean

  public steerAngle: number = 0;
  public driftSlipAngle: number = 0;
  public driftState: DriftState = DriftState.NONE;
  public isGrounded: boolean = true;

  public verticalVelocity: number = 0;

  // Filtered inputs for weight and inertia
  private filteredSteer: number = 0;
  private prevSpeed: number = 0;

  // Base physics constants (tuned for solid arcade weight)
  public baseMaxSpeed: number = 52; // ~187 km/h
  public baseAcceleration: number = 34; // m/s^2
  public brakeDeceleration: number = 48;
  public naturalFriction: number = 7.5;
  public baseSteerSensitivity: number = 1.45; // reduced from 2.4 to eliminate twitchiness
  public gravity: number = 32;

  // System
  public boostSystem: BoostSystem;

  // Reusable vectors for zero allocation
  private upVec = new THREE.Vector3(0, 1, 0);
  private targetVelocity = new THREE.Vector3();

  constructor(initialPosition: THREE.Vector3, initialHeading: number = 0) {
    this.position.copy(initialPosition);
    this.heading = initialHeading;
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

    // 2. Input Filtering (Steering Inertia & Weight)
    const steerTarget = inputs.steering;
    const steerSpeed = steerTarget !== 0 ? 5.5 : 8.5; // Smooth turn-in, faster recentering
    this.filteredSteer = THREE.MathUtils.lerp(this.filteredSteer, steerTarget, dt * steerSpeed);

    // 3. Speed-Sensitive Steering
    // At low speed: full steer authority. At high speed: progressive resistance to prevent twitching
    const speedKmh = this.getSpeedKmh();
    const speedSteerFactor = THREE.MathUtils.clamp(1.0 - (speedKmh / 320) * 0.55, 0.42, 1.0);
    const effectiveSensitivity = this.baseSteerSensitivity * speedSteerFactor;

    // 4. Handle Drift State Transition
    const minDriftSpeed = 12; // ~43 km/h
    if (inputs.drift && Math.abs(inputs.steering) > 0.15 && this.speed > minDriftSpeed && this.isGrounded) {
      if (this.driftState === DriftState.NONE) {
        this.driftState = inputs.steering < 0 ? DriftState.DRIFTING_LEFT : DriftState.DRIFTING_RIGHT;
      }
    } else if (!inputs.drift || this.speed < 8) {
      this.driftState = DriftState.NONE;
    }

    // 5. Calculate Steering & Drift Slip Angles
    const targetVisualSteer = -this.filteredSteer * 0.45;
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetVisualSteer, dt * 10);

    let targetDriftSlip = 0;
    let turnRate = -this.filteredSteer * effectiveSensitivity;

    if (this.driftState === DriftState.DRIFTING_LEFT) {
      targetDriftSlip = 0.42; // ~24 degrees outward drift yaw
      turnRate = (this.filteredSteer <= 0 ? 1.0 : 0.35) * this.baseSteerSensitivity * 1.55;
    } else if (this.driftState === DriftState.DRIFTING_RIGHT) {
      targetDriftSlip = -0.42;
      turnRate = (this.filteredSteer >= 0 ? -1.0 : -0.35) * this.baseSteerSensitivity * 1.55;
    }

    this.driftSlipAngle = THREE.MathUtils.lerp(this.driftSlipAngle, targetDriftSlip, dt * 7.5);

    // Apply yaw rotation
    this.heading += turnRate * dt * (this.speed / Math.max(this.baseMaxSpeed * 0.35, 14));

    // 6. Boost Multipliers & Terminal Velocity
    const boostMultiplier = this.boostSystem.getBoostMultiplier();
    const effectiveMaxSpeed = this.baseMaxSpeed * boostMultiplier;
    const effectiveAccel = this.baseAcceleration * Math.max(boostMultiplier, 1.15);

    // 7. Progressive Acceleration & Inertia Curve
    if (inputs.throttle > 0) {
      if (this.speed < effectiveMaxSpeed) {
        // Torque curve: heavy punch off the line, tapering off near top speed
        const speedRatio = Math.min(1.0, Math.abs(this.speed) / effectiveMaxSpeed);
        const torqueCurve = Math.max(0.35, 1.0 - Math.pow(speedRatio, 1.8));
        this.speed += effectiveAccel * inputs.throttle * torqueCurve * dt;
      } else {
        // Decay back to normal top speed after boost
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
      // Natural rolling friction & wind drag
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - this.naturalFriction * dt);
      } else if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + this.naturalFriction * dt);
      }
    }

    // Drift slight rolling resistance if not boosting
    if (this.driftState !== DriftState.NONE && !this.boostSystem.isBoosting()) {
      this.speed -= dt * 3.8;
    }

    // 8. Lateral Tire Inertia & Centrifugal Momentum
    // Target forward direction according to chassis heading + drift angle
    const movementHeading = this.heading - this.driftSlipAngle * 0.55;
    this.targetVelocity.set(
      Math.sin(movementHeading) * this.speed,
      0,
      Math.cos(movementHeading) * this.speed
    );

    // Lateral grip: normal driving has strong grip (9.5) but gives vehicle mass/momentum;
    // Drifting loosens lateral grip (4.0) so car slides outward naturally!
    const tireGrip = (this.driftState !== DriftState.NONE) ? 4.0 : 9.5;
    this.velocity.lerp(this.targetVelocity, dt * tireGrip);

    // Apply horizontal translation
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // 9. Suspension Weight Transfer (Pitch & Roll)
    const accelForce = (this.speed - this.prevSpeed) / Math.max(dt, 0.001);
    this.prevSpeed = this.speed;

    // Acceleration squats rear (-pitch), braking dives nose (+pitch)
    const targetPitch = THREE.MathUtils.clamp(-accelForce * 0.0024, -0.045, 0.065);
    this.pitch = THREE.MathUtils.lerp(this.pitch, targetPitch, dt * 6.5);

    // Centrifugal body roll: chassis leans into turns
    const lateralG = -this.filteredSteer * (this.speed / this.baseMaxSpeed);
    const targetRoll = (this.driftState !== DriftState.NONE)
      ? -this.driftSlipAngle * 0.35
      : lateralG * 0.16;
    this.roll = THREE.MathUtils.lerp(this.roll, targetRoll, dt * 7.5);

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
    const visualYaw = this.heading - this.driftSlipAngle;
    const euler = new THREE.Euler(this.pitch, visualYaw, this.roll, 'YXZ');
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
