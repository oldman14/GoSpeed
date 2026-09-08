import * as THREE from 'three';
import { KinematicVehicle } from '../physics/KinematicVehicle';
import { DriftState, BoostType } from '../types';

export interface KartTheme {
  primaryColor: number;
  secondaryColor: number;
  neonColor: number;
  exhaustColor: number;
}

export class KartMesh {
  public group: THREE.Group = new THREE.Group();
  public vehicle: KinematicVehicle;

  private frontLeftWheelGroup: THREE.Group = new THREE.Group();
  private frontRightWheelGroup: THREE.Group = new THREE.Group();
  private wheels: THREE.Mesh[] = [];

  // Thruster flames
  private leftFlame!: THREE.Mesh;
  private rightFlame!: THREE.Mesh;

  // Drift sparks particles
  private sparkParticles!: THREE.Points;
  private sparkPositions!: Float32Array;
  private sparkColors!: Float32Array;
  private sparkVelocities: THREE.Vector3[] = [];
  private maxSparks = 100;

  constructor(vehicle: KinematicVehicle, theme: KartTheme) {
    this.vehicle = vehicle;
    this.buildKartMesh(theme);
    this.buildDriftSparks();
  }

  private buildKartMesh(theme: KartTheme) {
    // 1. Main Body Group
    const bodyGroup = new THREE.Group();

    // Body Material
    const bodyMat = new THREE.MeshStandardMaterial({
      color: theme.primaryColor,
      metalness: 0.8,
      roughness: 0.25
    });

    const trimMat = new THREE.MeshStandardMaterial({
      color: theme.secondaryColor,
      metalness: 0.9,
      roughness: 0.2
    });

    const neonMat = new THREE.MeshBasicMaterial({
      color: theme.neonColor
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x112233,
      metalness: 0.1,
      roughness: 0.1,
      transmission: 0.9,
      transparent: true,
      opacity: 0.85
    });

    // Main Chassis
    const chassisGeo = new THREE.BoxGeometry(1.5, 0.42, 3.2);
    const chassis = new THREE.Mesh(chassisGeo, bodyMat);
    chassis.position.y = 0.45;
    chassis.castShadow = true;
    bodyGroup.add(chassis);

    // Front Nose / Splitter
    const noseGeo = new THREE.ConeGeometry(0.85, 1.2, 4);
    noseGeo.rotateX(Math.PI * 0.5);
    noseGeo.rotateY(Math.PI * 0.25);
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.position.set(0, 0.38, 1.9);
    nose.scale.set(1.4, 0.4, 1.0);
    bodyGroup.add(nose);

    // Front Neon Splitter Lip
    const lipGeo = new THREE.BoxGeometry(1.6, 0.08, 0.3);
    const lip = new THREE.Mesh(lipGeo, neonMat);
    lip.position.set(0, 0.25, 2.3);
    bodyGroup.add(lip);

    // Forward Headlights
    const hlGeo = new THREE.BoxGeometry(0.3, 0.12, 0.2);
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const leftHl = new THREE.Mesh(hlGeo, hlMat);
    leftHl.position.set(-0.55, 0.38, 2.2);
    const rightHl = new THREE.Mesh(hlGeo, hlMat);
    rightHl.position.set(0.55, 0.38, 2.2);
    bodyGroup.add(leftHl, rightHl);

    // Cockpit / Canopy
    const canopyGeo = new THREE.BoxGeometry(1.0, 0.45, 1.4);
    const canopy = new THREE.Mesh(canopyGeo, glassMat);
    canopy.position.set(0, 0.8, -0.1);
    bodyGroup.add(canopy);

    // Rear Side Pods / Fenders
    const podGeo = new THREE.BoxGeometry(0.35, 0.4, 1.8);
    const leftPod = new THREE.Mesh(podGeo, trimMat);
    leftPod.position.set(-0.9, 0.5, -0.3);
    const rightPod = new THREE.Mesh(podGeo, trimMat);
    rightPod.position.set(0.9, 0.5, -0.3);
    bodyGroup.add(leftPod, rightPod);

    // Neon Accent Side Strips
    const stripGeo = new THREE.BoxGeometry(0.04, 0.05, 1.7);
    const leftStrip = new THREE.Mesh(stripGeo, neonMat);
    leftStrip.position.set(-1.08, 0.52, -0.3);
    const rightStrip = new THREE.Mesh(stripGeo, neonMat);
    rightStrip.position.set(1.08, 0.52, -0.3);
    bodyGroup.add(leftStrip, rightStrip);

    // Rear Spoiler / Wing
    const wingStrutGeo = new THREE.BoxGeometry(0.08, 0.45, 0.15);
    const leftStrut = new THREE.Mesh(wingStrutGeo, trimMat);
    leftStrut.position.set(-0.6, 0.85, -1.5);
    const rightStrut = new THREE.Mesh(wingStrutGeo, trimMat);
    rightStrut.position.set(0.6, 0.85, -1.5);

    const wingGeo = new THREE.BoxGeometry(1.9, 0.08, 0.45);
    const wing = new THREE.Mesh(wingGeo, bodyMat);
    wing.position.set(0, 1.05, -1.55);
    wing.rotation.x = -0.1;
    bodyGroup.add(leftStrut, rightStrut, wing);

    // Underglow LED Strip
    const underglowGeo = new THREE.PlaneGeometry(1.3, 2.4);
    underglowGeo.rotateX(-Math.PI * 0.5);
    const underglowMat = new THREE.MeshBasicMaterial({
      color: theme.neonColor,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    const underglow = new THREE.Mesh(underglowGeo, underglowMat);
    underglow.position.y = 0.12;
    bodyGroup.add(underglow);

    // Twin Exhaust Rockets
    const exhaustGeo = new THREE.CylinderGeometry(0.16, 0.22, 0.55, 16);
    exhaustGeo.rotateX(Math.PI * 0.5);
    const exhaustMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.95,
      roughness: 0.1
    });

    const leftExhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
    leftExhaust.position.set(-0.4, 0.48, -1.65);
    const rightExhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
    rightExhaust.position.set(0.4, 0.48, -1.65);
    bodyGroup.add(leftExhaust, rightExhaust);

    // Thruster Flames
    const flameGeo = new THREE.ConeGeometry(0.2, 1.4, 16);
    flameGeo.rotateX(-Math.PI * 0.5);
    flameGeo.translate(0, 0, -0.7);
    const flameMat = new THREE.MeshBasicMaterial({
      color: theme.exhaustColor,
      transparent: true,
      opacity: 0.85
    });

    this.leftFlame = new THREE.Mesh(flameGeo, flameMat);
    this.leftFlame.position.set(-0.4, 0.48, -1.8);
    this.leftFlame.scale.set(0.1, 0.1, 0.1);

    this.rightFlame = new THREE.Mesh(flameGeo, flameMat.clone());
    this.rightFlame.position.set(0.4, 0.48, -1.8);
    this.rightFlame.scale.set(0.1, 0.1, 0.1);

    bodyGroup.add(this.leftFlame, this.rightFlame);

    // 2. Build Wheels & Steering Knuckles
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.32, 20);
    wheelGeo.rotateZ(Math.PI * 0.5);

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.85
    });

    const rimGeo = new THREE.TorusGeometry(0.24, 0.04, 8, 20);
    rimGeo.rotateY(Math.PI * 0.5);
    const rimMat = new THREE.MeshBasicMaterial({ color: theme.neonColor });

    const createWheel = () => {
      const wGroup = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeo, tireMat);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      wGroup.add(tire, rim);
      this.wheels.push(tire);
      return wGroup;
    };

    // Front Left
    this.frontLeftWheelGroup.position.set(-1.05, 0.36, 1.15);
    const flWheel = createWheel();
    this.frontLeftWheelGroup.add(flWheel);

    // Front Right
    this.frontRightWheelGroup.position.set(1.05, 0.36, 1.15);
    const frWheel = createWheel();
    this.frontRightWheelGroup.add(frWheel);

    // Rear Wheels
    const rlWheel = createWheel();
    rlWheel.position.set(-1.05, 0.38, -1.05);

    const rrWheel = createWheel();
    rrWheel.position.set(1.05, 0.38, -1.05);

    this.group.add(bodyGroup);
    this.group.add(this.frontLeftWheelGroup, this.frontRightWheelGroup, rlWheel, rrWheel);
  }

  private buildDriftSparks() {
    const geo = new THREE.BufferGeometry();
    this.sparkPositions = new Float32Array(this.maxSparks * 3);
    this.sparkColors = new Float32Array(this.maxSparks * 3);

    for (let i = 0; i < this.maxSparks; i++) {
      this.sparkVelocities.push(new THREE.Vector3());
      // Init off-screen
      this.sparkPositions[i * 3 + 1] = -1000;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.sparkColors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.3,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });

    this.sparkParticles = new THREE.Points(geo, mat);
    this.group.add(this.sparkParticles);
  }

  public update(dt: number) {
    // 1. Sync Transform
    this.group.position.copy(this.vehicle.position);
    this.group.quaternion.copy(this.vehicle.quaternion);

    // 2. Steer front wheel knuckles
    this.frontLeftWheelGroup.rotation.y = this.vehicle.steerAngle;
    this.frontRightWheelGroup.rotation.y = this.vehicle.steerAngle;

    // 3. Roll wheels based on distance travelled
    const wheelRotDelta = (this.vehicle.speed * dt) / 0.36;
    for (const w of this.wheels) {
      w.rotation.x += wheelRotDelta;
    }

    // 4. Update Exhaust Flame & Boost Glow
    const isBoosting = this.vehicle.boostSystem.isBoosting();
    const boostType = this.vehicle.boostSystem.getActiveBoostType();

    if (isBoosting) {
      let scaleZ = 1.6 + Math.random() * 0.4;
      let flameColor = 0x00f0ff; // Default cyan

      if (boostType === BoostType.CWW_BOOST) {
        scaleZ = 3.0 + Math.random() * 0.6;
        flameColor = 0xf43f5e; // Blazing hot pink/red
      } else if (boostType === BoostType.DOUBLE_BOOST || boostType === BoostType.WCW_BOOST) {
        scaleZ = 2.4 + Math.random() * 0.5;
        flameColor = 0xf59e0b; // Gold
      } else if (boostType === BoostType.MINI_BOOST) {
        scaleZ = 1.9 + Math.random() * 0.3;
        flameColor = 0xfbbf24;
      }

      this.leftFlame.scale.set(1.2, 1.2, scaleZ);
      this.rightFlame.scale.set(1.2, 1.2, scaleZ);
      (this.leftFlame.material as THREE.MeshBasicMaterial).color.setHex(flameColor);
      (this.rightFlame.material as THREE.MeshBasicMaterial).color.setHex(flameColor);
    } else {
      // Normal throttle exhaust
      const throttle = Math.max(0, this.vehicle.speed / this.vehicle.baseMaxSpeed);
      const idleScale = 0.3 + throttle * 0.5;
      this.leftFlame.scale.lerp(new THREE.Vector3(0.5, 0.5, idleScale), dt * 10);
      this.rightFlame.scale.lerp(new THREE.Vector3(0.5, 0.5, idleScale), dt * 10);
    }

    // 5. Update Drift Sparks
    this.updateSparks(dt);
  }

  private updateSparks(dt: number) {
    const isDrifting = this.vehicle.driftState !== DriftState.NONE;
    const sparkLvl = this.vehicle.boostSystem.sparkLevel;

    // Emit sparks from rear wheels if drifting
    if (isDrifting && this.vehicle.isGrounded && this.vehicle.speed > 10) {
      const spawnCount = sparkLvl === 2 ? 6 : 3;
      const emitColor = sparkLvl === 2 ? [1.0, 0.75, 0.1] : [0.2, 0.6, 1.0]; // Gold vs Blue

      const rearOffset = this.vehicle.driftState === DriftState.DRIFTING_LEFT ? -1.0 : 1.0;

      for (let s = 0; s < spawnCount; s++) {
        const idx = Math.floor(Math.random() * this.maxSparks);
        this.sparkPositions[idx * 3] = rearOffset + (Math.random() - 0.5) * 0.3;
        this.sparkPositions[idx * 3 + 1] = 0.2 + Math.random() * 0.2;
        this.sparkPositions[idx * 3 + 2] = -1.2 + (Math.random() - 0.5) * 0.4;

        this.sparkVelocities[idx].set(
          (Math.random() - 0.5) * 4 + rearOffset * 2,
          Math.random() * 3 + 1,
          -(Math.random() * 5 + 3)
        );

        this.sparkColors[idx * 3] = emitColor[0];
        this.sparkColors[idx * 3 + 1] = emitColor[1];
        this.sparkColors[idx * 3 + 2] = emitColor[2];
      }
    }

    // Age existing particles
    for (let i = 0; i < this.maxSparks; i++) {
      if (this.sparkPositions[i * 3 + 1] > -500) {
        this.sparkPositions[i * 3] += this.sparkVelocities[i].x * dt;
        this.sparkPositions[i * 3 + 1] += this.sparkVelocities[i].y * dt;
        this.sparkPositions[i * 3 + 2] += this.sparkVelocities[i].z * dt;
        this.sparkVelocities[i].y -= 9.8 * dt; // gravity

        if (this.sparkPositions[i * 3 + 1] < 0) {
          this.sparkPositions[i * 3 + 1] = -1000; // recycle
        }
      }
    }

    this.sparkParticles.geometry.attributes.position.needsUpdate = true;
    this.sparkParticles.geometry.attributes.color.needsUpdate = true;
  }
}
