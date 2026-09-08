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
  public pitch: number = 0;
  public roll: number = 0;

  public steerAngle: number = 0;
  public driftSlipAngle: number = 0;
  public driftState: DriftState = DriftState.NONE;
  public isGrounded: boolean = true;

  public verticalVelocity: number = 0;

  // Base physics constants
  public baseMaxSpeed: number = 52; // ~187 km/h
  public baseAcceleration: number = 38; // m/s^2
  public brakeDeceleration: number = 45;
  public naturalFriction: number = 8;
  public steerSensitivity: number = 2.4;
  public driftTurnMultiplier: number = 1.65;
  public gravity: number = 32;

  // System
  public boostSystem: BoostSystem;

  // Temporary vectors for math
  private forwardVec = new THREE.Vector3();
  private upVec = new THREE.Vector3(0, 1, 0);

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

    // 2. Handle Drift State Transition
    const minDriftSpeed = 12; // ~43 km/h
    if (inputs.drift && inputs.steering !== 0 && this.speed > minDriftSpeed && this.isGrounded) {
      if (this.driftState === DriftState.NONE) {
        this.driftState = inputs.steering < 0 ? DriftState.DRIFTING_LEFT : DriftState.DRIFTING_RIGHT;
      }
    } else if (!inputs.drift || this.speed < 8) {
      this.driftState = DriftState.NONE;
    }

    // 3. Calculate Steering & Drift Angles
    let targetSteer = -inputs.steering * 0.55; // visual wheel steer
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, dt * 14);

    let targetDriftSlip = 0;
    let turnRate = -inputs.steering * this.steerSensitivity;

    if (this.driftState === DriftState.DRIFTING_LEFT) {
      targetDriftSlip = 0.48; // ~27.5 degrees outward yaw slip
      turnRate = (inputs.steering <= 0 ? 1.0 : 0.45) * this.steerSensitivity * this.driftTurnMultiplier;
    } else if (this.driftState === DriftState.DRIFTING_RIGHT) {
      targetDriftSlip = -0.48;
      turnRate = (inputs.steering >= 0 ? -1.0 : -0.45) * this.steerSensitivity * this.driftTurnMultiplier;
    }

    this.driftSlipAngle = THREE.MathUtils.lerp(this.driftSlipAngle, targetDriftSlip, dt * 9);

    // Apply yaw rotation
    this.heading += turnRate * dt * (this.speed / Math.max(this.baseMaxSpeed * 0.4, 15));

    // 4. Boost Multipliers & Terminal Velocity
    const boostMultiplier = this.boostSystem.getBoostMultiplier();
    const effectiveMaxSpeed = this.baseMaxSpeed * boostMultiplier;
    const effectiveAccel = this.baseAcceleration * Math.max(boostMultiplier, 1.2);

    // 5. Longitudinal Acceleration / Braking
    if (inputs.throttle > 0) {
      if (this.speed < effectiveMaxSpeed) {
        this.speed += effectiveAccel * inputs.throttle * dt;
      } else {
        // Naturally decay back to max speed if boost is finishing
        this.speed = THREE.MathUtils.lerp(this.speed, effectiveMaxSpeed, dt * 2.5);
      }
    } else if (inputs.throttle < 0) {
      if (this.speed > 0) {
        this.speed -= this.brakeDeceleration * dt;
      } else {
        this.speed -= this.baseAcceleration * 0.4 * dt;
        if (this.speed < -15) this.speed = -15; // reverse cap
      }
    } else {
      // Coasting friction
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - this.naturalFriction * dt);
      } else if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + this.naturalFriction * dt);
      }
    }

    // Drift slight drag on speed if unboosted
    if (this.driftState !== DriftState.NONE && !this.boostSystem.isBoosting()) {
      this.speed -= dt * 4.5;
    }

    // 6. Calculate Movement Velocity Vector
    // Movement direction is heading + partial drift angle
    const movementHeading = this.heading - this.driftSlipAngle * 0.65;
    this.forwardVec.set(Math.sin(movementHeading), 0, Math.cos(movementHeading));
    this.velocity.x = this.forwardVec.x * this.speed;
    this.velocity.z = this.forwardVec.z * this.speed;

    // Apply horizontal translation
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // 7. Ground Alignment & Vertical Physics (Raycast)
    const groundInfo = getGroundHeight(this.position);
    const targetY = groundInfo.height;

    if (this.position.y > targetY + 0.15) {
      // In the air!
      this.isGrounded = false;
      this.verticalVelocity -= this.gravity * dt;
      this.position.y += this.verticalVelocity * dt;

      if (this.position.y <= targetY) {
        // Landed
        this.position.y = targetY;
        this.verticalVelocity = 0;
        this.isGrounded = true;
      }
    } else {
      // Grounded
      this.isGrounded = true;
      this.position.y = THREE.MathUtils.lerp(this.position.y, targetY, dt * 25);
      this.verticalVelocity = 0;
    }

    // 8. Update Boost System
    this.boostSystem.update(
      dt,
      this.driftState !== DriftState.NONE,
      this.isGrounded,
      this.getSpeedKmh()
    );

    // 9. Update Orientation (Pitch, Roll, Yaw)
    this.updateOrientation(groundInfo.normal);
  }

  private updateOrientation(groundNormal?: THREE.Vector3) {
    // Chassis visual yaw combines heading and full drift slip angle
    const visualYaw = this.heading - this.driftSlipAngle;

    // Dynamic body roll from turning
    const targetRoll = (this.driftState !== DriftState.NONE ? -this.driftSlipAngle * 0.4 : -this.steerAngle * 0.25);
    this.roll = THREE.MathUtils.lerp(this.roll, targetRoll, 0.15);

    const euler = new THREE.Euler(this.pitch, visualYaw, this.roll, 'YXZ');
    this.quaternion.setFromEuler(euler);

    if (groundNormal && this.isGrounded) {
      // Align up-vector slightly with ground slope normal
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
