import * as THREE from 'three';
import { KinematicVehicle } from '../physics/KinematicVehicle';
import { DriftState, BoostType, KartCustomization, SpoilerStyle } from '../types';

export interface KartTheme {
  primaryColor: number;
  secondaryColor: number;
  neonColor: number;
  exhaustColor: number;
}

export const KART_PRESETS: KartCustomization[] = [
  {
    presetName: 'Cyber Sonic',
    primaryColor: 0x06b6d4, // Cyan
    secondaryColor: 0x0f172a, // Deep Slate
    neonColor: 0x00f0ff, // Electric Cyan
    exhaustColor: 0x00f0ff,
    spoilerStyle: 'GT_WING'
  },
  {
    presetName: 'Shadow Viper',
    primaryColor: 0xe11d48, // Crimson Red
    secondaryColor: 0x18181b, // Jet Black
    neonColor: 0xff0055, // Hot Crimson
    exhaustColor: 0xff3b30,
    spoilerStyle: 'CYBER_FIN'
  },
  {
    presetName: 'Golden Phoenix',
    primaryColor: 0xf59e0b, // Amber Gold
    secondaryColor: 0x27272a, // Obsidian
    neonColor: 0xffd700, // Bright Gold
    exhaustColor: 0xffaa00,
    spoilerStyle: 'JET_PODS'
  },
  {
    presetName: 'Phantom Ghost',
    primaryColor: 0x8b5cf6, // Royal Violet
    secondaryColor: 0x09090b, // Midnight Black
    neonColor: 0xd946ef, // Neon Magenta
    exhaustColor: 0xa855f7,
    spoilerStyle: 'DUCKTAIL'
  },
  {
    presetName: 'Emerald Pulse',
    primaryColor: 0x10b981, // Emerald Green
    secondaryColor: 0x1e293b, // Gunmetal
    neonColor: 0x34d399, // Toxic Neon Green
    exhaustColor: 0x10b981,
    spoilerStyle: 'CYBER_FIN'
  }
];

export class KartMesh {
  public group: THREE.Group = new THREE.Group();
  public vehicle: KinematicVehicle;
  public customization: KartCustomization;

  private frontLeftWheelGroup: THREE.Group = new THREE.Group();
  private frontRightWheelGroup: THREE.Group = new THREE.Group();
  private wheels: THREE.Mesh[] = [];

  // Dynamic Materials for live customization
  private bodyMat!: THREE.MeshStandardMaterial;
  private trimMat!: THREE.MeshStandardMaterial;
  private neonMat!: THREE.MeshBasicMaterial;
  private underglowMat!: THREE.MeshBasicMaterial;
  private rimMat!: THREE.MeshBasicMaterial;
  private spoilerGroup: THREE.Group = new THREE.Group();

  // Thruster flames
  private leftFlame!: THREE.Mesh;
  private rightFlame!: THREE.Mesh;

  // Drift sparks particles
  private sparkParticles!: THREE.Points;
  private sparkPositions!: Float32Array;
  private sparkColors!: Float32Array;
  private sparkVelocities: THREE.Vector3[] = [];
  private maxSparks = 100;

  constructor(vehicle: KinematicVehicle, themeOrCustom?: KartTheme | KartCustomization) {
    this.vehicle = vehicle;
    if (themeOrCustom && 'spoilerStyle' in themeOrCustom) {
      this.customization = { ...themeOrCustom };
    } else if (themeOrCustom) {
      this.customization = {
        presetName: 'Custom',
        primaryColor: themeOrCustom.primaryColor,
        secondaryColor: themeOrCustom.secondaryColor,
        neonColor: themeOrCustom.neonColor,
        exhaustColor: themeOrCustom.exhaustColor,
        spoilerStyle: 'GT_WING',
      };
    } else {
      this.customization = { ...KART_PRESETS[0] };
    }

    this.buildKartMesh();
    this.buildDriftSparks();
  }

  private buildKartMesh() {
    // 1. Main Body Group
    const bodyGroup = new THREE.Group();

    // Body Material
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: this.customization.primaryColor,
      metalness: 0.8,
      roughness: 0.25
    });

    this.trimMat = new THREE.MeshStandardMaterial({
      color: this.customization.secondaryColor,
      metalness: 0.9,
      roughness: 0.2
    });

    this.neonMat = new THREE.MeshBasicMaterial({
      color: this.customization.neonColor
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
    const chassis = new THREE.Mesh(chassisGeo, this.bodyMat);
    chassis.position.y = 0.45;
    chassis.castShadow = true;
    bodyGroup.add(chassis);

    // Front Nose / Splitter
    const noseGeo = new THREE.ConeGeometry(0.85, 1.2, 4);
    noseGeo.rotateX(Math.PI * 0.5);
    noseGeo.rotateY(Math.PI * 0.25);
    const nose = new THREE.Mesh(noseGeo, this.bodyMat);
    nose.position.set(0, 0.38, 1.9);
    nose.scale.set(1.4, 0.4, 1.0);
    bodyGroup.add(nose);

    // Front Neon Splitter Lip
    const lipGeo = new THREE.BoxGeometry(1.6, 0.08, 0.3);
    const lip = new THREE.Mesh(lipGeo, this.neonMat);
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
    const leftPod = new THREE.Mesh(podGeo, this.trimMat);
    leftPod.position.set(-0.9, 0.5, -0.3);
    const rightPod = new THREE.Mesh(podGeo, this.trimMat);
    rightPod.position.set(0.9, 0.5, -0.3);
    bodyGroup.add(leftPod, rightPod);

    // Neon Accent Side Strips
    const stripGeo = new THREE.BoxGeometry(0.04, 0.05, 1.7);
    const leftStrip = new THREE.Mesh(stripGeo, this.neonMat);
    leftStrip.position.set(-1.08, 0.52, -0.3);
    const rightStrip = new THREE.Mesh(stripGeo, this.neonMat);
    rightStrip.position.set(1.08, 0.52, -0.3);
    bodyGroup.add(leftStrip, rightStrip);

    // Modular Rear Spoiler Wing
    bodyGroup.add(this.spoilerGroup);
    this.buildSpoiler(this.customization.spoilerStyle);

    // Underglow LED Strip
    const underglowGeo = new THREE.PlaneGeometry(1.3, 2.4);
    underglowGeo.rotateX(-Math.PI * 0.5);
    this.underglowMat = new THREE.MeshBasicMaterial({
      color: this.customization.neonColor,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    const underglow = new THREE.Mesh(underglowGeo, this.underglowMat);
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
      color: this.customization.exhaustColor,
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
    this.rimMat = new THREE.MeshBasicMaterial({ color: this.customization.neonColor });

    const createWheel = () => {
      const wGroup = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeo, tireMat);
      const rim = new THREE.Mesh(rimGeo, this.rimMat);
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

  public buildSpoiler(style: SpoilerStyle) {
    while (this.spoilerGroup.children.length > 0) {
      this.spoilerGroup.remove(this.spoilerGroup.children[0]);
    }

    if (style === 'GT_WING') {
      const wingStrutGeo = new THREE.BoxGeometry(0.08, 0.45, 0.15);
      const leftStrut = new THREE.Mesh(wingStrutGeo, this.trimMat);
      leftStrut.position.set(-0.6, 0.85, -1.5);
      const rightStrut = new THREE.Mesh(wingStrutGeo, this.trimMat);
      rightStrut.position.set(0.6, 0.85, -1.5);

      const wingGeo = new THREE.BoxGeometry(1.9, 0.08, 0.45);
      const wing = new THREE.Mesh(wingGeo, this.bodyMat);
      wing.position.set(0, 1.05, -1.55);
      wing.rotation.x = -0.1;

      const endplateGeo = new THREE.BoxGeometry(0.04, 0.25, 0.5);
      const leftEp = new THREE.Mesh(endplateGeo, this.neonMat);
      leftEp.position.set(-0.95, 1.05, -1.55);
      const rightEp = new THREE.Mesh(endplateGeo, this.neonMat);
      rightEp.position.set(0.95, 1.05, -1.55);

      this.spoilerGroup.add(leftStrut, rightStrut, wing, leftEp, rightEp);
    } else if (style === 'CYBER_FIN') {
      const finGeo = new THREE.BoxGeometry(0.06, 0.65, 0.7);
      const leftFin = new THREE.Mesh(finGeo, this.bodyMat);
      leftFin.position.set(-0.6, 0.95, -1.4);
      leftFin.rotation.z = 0.15;

      const rightFin = new THREE.Mesh(finGeo, this.bodyMat);
      rightFin.position.set(0.6, 0.95, -1.4);
      rightFin.rotation.z = -0.15;

      const tipGeo = new THREE.BoxGeometry(0.08, 0.06, 0.65);
      const leftTip = new THREE.Mesh(tipGeo, this.neonMat);
      leftTip.position.set(-0.65, 1.28, -1.4);
      const rightTip = new THREE.Mesh(tipGeo, this.neonMat);
      rightTip.position.set(0.65, 1.28, -1.4);

      this.spoilerGroup.add(leftFin, rightFin, leftTip, rightTip);
    } else if (style === 'JET_PODS') {
      const podGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.8, 16);
      podGeo.rotateX(Math.PI * 0.5);
      const leftPod = new THREE.Mesh(podGeo, this.trimMat);
      leftPod.position.set(-0.5, 0.85, -1.5);
      const rightPod = new THREE.Mesh(podGeo, this.trimMat);
      rightPod.position.set(0.5, 0.85, -1.5);

      const ringGeo = new THREE.TorusGeometry(0.23, 0.03, 8, 16);
      const leftRing = new THREE.Mesh(ringGeo, this.neonMat);
      leftRing.position.set(-0.5, 0.85, -1.9);
      const rightRing = new THREE.Mesh(ringGeo, this.neonMat);
      rightRing.position.set(0.5, 0.85, -1.9);

      const foilGeo = new THREE.BoxGeometry(1.4, 0.06, 0.35);
      const foil = new THREE.Mesh(foilGeo, this.bodyMat);
      foil.position.set(0, 0.88, -1.5);

      this.spoilerGroup.add(leftPod, rightPod, leftRing, rightRing, foil);
    } else if (style === 'DUCKTAIL') {
      const tailGeo = new THREE.BoxGeometry(1.65, 0.16, 0.4);
      const tail = new THREE.Mesh(tailGeo, this.bodyMat);
      tail.position.set(0, 0.72, -1.6);
      tail.rotation.x = -0.35;

      const stripGeo = new THREE.BoxGeometry(1.68, 0.05, 0.08);
      const strip = new THREE.Mesh(stripGeo, this.neonMat);
      strip.position.set(0, 0.8, -1.78);

      this.spoilerGroup.add(tail, strip);
    }
  }

  public applyCustomization(customization: KartCustomization) {
    this.customization = { ...customization };
    this.bodyMat.color.setHex(customization.primaryColor);
    this.trimMat.color.setHex(customization.secondaryColor);
    this.neonMat.color.setHex(customization.neonColor);
    this.underglowMat.color.setHex(customization.neonColor);
    this.rimMat.color.setHex(customization.neonColor);

    if (this.leftFlame && this.leftFlame.material) {
      (this.leftFlame.material as THREE.MeshBasicMaterial).color.setHex(customization.exhaustColor);
    }
    if (this.rightFlame && this.rightFlame.material) {
      (this.rightFlame.material as THREE.MeshBasicMaterial).color.setHex(customization.exhaustColor);
    }

    this.buildSpoiler(customization.spoilerStyle);
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
