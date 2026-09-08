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
    spoilerStyle: 'GT_WING',
    liveryPattern: 'RACING_STRIPES',
    liveryColor: 0xffffff,
    rimStyle: 'SPORT_5SPOKE'
  },
  {
    presetName: 'Shadow Viper',
    primaryColor: 0xe11d48, // Crimson Red
    secondaryColor: 0x18181b, // Jet Black
    neonColor: 0xff0055, // Hot Crimson
    exhaustColor: 0xff3b30,
    spoilerStyle: 'CYBER_FIN',
    liveryPattern: 'CYBER_HEX',
    liveryColor: 0xff0055,
    rimStyle: 'CYBER_TURBINE'
  },
  {
    presetName: 'Golden Phoenix',
    primaryColor: 0xf59e0b, // Amber Gold
    secondaryColor: 0x27272a, // Obsidian
    neonColor: 0xffd700, // Bright Gold
    exhaustColor: 0xffaa00,
    spoilerStyle: 'JET_PODS',
    liveryPattern: 'DRAGON_FLAME',
    liveryColor: 0xff4500,
    rimStyle: 'AERO_DISC'
  },
  {
    presetName: 'Phantom Ghost',
    primaryColor: 0x8b5cf6, // Royal Violet
    secondaryColor: 0x09090b, // Midnight Black
    neonColor: 0xd946ef, // Neon Magenta
    exhaustColor: 0xa855f7,
    spoilerStyle: 'DUCKTAIL',
    liveryPattern: 'LIGHTNING',
    liveryColor: 0x00f0ff,
    rimStyle: 'WIRE_STAR'
  },
  {
    presetName: 'Emerald Pulse',
    primaryColor: 0x10b981, // Emerald Green
    secondaryColor: 0x1e293b, // Gunmetal
    neonColor: 0x34d399, // Toxic Neon Green
    exhaustColor: 0x10b981,
    spoilerStyle: 'CYBER_FIN',
    liveryPattern: 'CARBON_WEAVE',
    liveryColor: 0x0f172a,
    rimStyle: 'SPORT_5SPOKE'
  }
];

export class KartMesh {
  public group: THREE.Group = new THREE.Group();
  public vehicle: KinematicVehicle;
  public customization: KartCustomization;

  // Showroom decoupled rotation root
  public showroomGroup: THREE.Group = new THREE.Group();

  private frontLeftWheelGroup: THREE.Group = new THREE.Group();
  private frontRightWheelGroup: THREE.Group = new THREE.Group();
  private rearLeftWheelGroup: THREE.Group = new THREE.Group();
  private rearRightWheelGroup: THREE.Group = new THREE.Group();

  private wheels: THREE.Mesh[] = [];
  private rimMeshes: THREE.Object3D[] = [];

  // Dynamic Materials & Textures
  private bodyMat!: THREE.MeshStandardMaterial;
  private trimMat!: THREE.MeshStandardMaterial;
  private neonMat!: THREE.MeshBasicMaterial;
  private underglowMat!: THREE.MeshBasicMaterial;
  private rimMat!: THREE.MeshBasicMaterial;
  private liveryTexture!: THREE.CanvasTexture;
  private liveryCanvas!: HTMLCanvasElement;

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
        liveryPattern: 'RACING_STRIPES',
        liveryColor: 0xffffff,
        rimStyle: 'SPORT_5SPOKE'
      };
    } else {
      this.customization = { ...KART_PRESETS[0] };
    }

    this.group.add(this.showroomGroup);
    this.buildKartMesh();
    this.buildDriftSparks();
  }


  private createLiveryTexture(): THREE.CanvasTexture {
    if (!this.liveryCanvas) {
      this.liveryCanvas = document.createElement('canvas');
      this.liveryCanvas.width = 1024;
      this.liveryCanvas.height = 1024;
    }
    this.drawLivery();
    const tex = new THREE.CanvasTexture(this.liveryCanvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  private drawLivery() {
    if (!this.liveryCanvas) return;
    const ctx = this.liveryCanvas.getContext('2d')!;
    const w = this.liveryCanvas.width;
    const h = this.liveryCanvas.height;

    // Base chassis color
    const baseHex = '#' + this.customization.primaryColor.toString(16).padStart(6, '0');
    const liveryHex = '#' + this.customization.liveryColor.toString(16).padStart(6, '0');
    const neonHex = '#' + this.customization.neonColor.toString(16).padStart(6, '0');

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, w, h);

    const pattern = this.customization.liveryPattern;

    if (pattern === 'RACING_STRIPES') {
      // Twin Center Racing Stripes with thin neon outer borders
      const centerX = w / 2;
      const stripeW = 100;
      const gap = 36;

      // Outer accent lines
      ctx.strokeStyle = neonHex;
      ctx.lineWidth = 12;
      ctx.strokeRect(centerX - stripeW - gap / 2 - 16, 0, 0, h);
      ctx.strokeRect(centerX + gap / 2 + stripeW + 16, 0, 0, h);

      // Main Stripes
      ctx.fillStyle = liveryHex;
      ctx.fillRect(centerX - stripeW - gap / 2, 0, stripeW, h);
      ctx.fillRect(centerX + gap / 2, 0, stripeW, h);

      // Race numbers badge on hood
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(centerX, h * 0.35, 110, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 120px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('07', centerX, h * 0.35);

    } else if (pattern === 'CYBER_HEX') {
      // High-tech honeycomb neon grid
      ctx.strokeStyle = liveryHex;
      ctx.lineWidth = 5;
      const hexR = 48;
      const hDist = hexR * Math.sqrt(3);
      const vDist = hexR * 1.5;

      for (let row = -1; row < h / vDist + 2; row++) {
        for (let col = -1; col < w / hDist + 2; col++) {
          const x = col * hDist + (row % 2 === 0 ? 0 : hDist / 2);
          const y = row * vDist;

          ctx.beginPath();
          for (let a = 0; a < 6; a++) {
            const angle = (Math.PI / 3) * a + Math.PI / 6;
            const hx = x + hexR * Math.cos(angle);
            const hy = y + hexR * Math.sin(angle);
            if (a === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
          }
          ctx.closePath();
          ctx.stroke();

          // Highlight some glowing centers
          if ((row + col) % 5 === 0) {
            ctx.fillStyle = neonHex;
            ctx.fill();
          }
        }
      }

      // Cyber angular arrow chevrons down the spine
      ctx.fillStyle = liveryHex;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.1);
      ctx.lineTo(w * 0.7, h * 0.3);
      ctx.lineTo(w * 0.6, h * 0.3);
      ctx.lineTo(w * 0.5, h * 0.2);
      ctx.lineTo(w * 0.4, h * 0.3);
      ctx.lineTo(w * 0.3, h * 0.3);
      ctx.closePath();
      ctx.fill();

    } else if (pattern === 'LIGHTNING') {
      // High-voltage electric lightning forks
      ctx.shadowColor = neonHex;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = liveryHex;
      ctx.lineWidth = 14;

      const drawBolt = (x1: number, y1: number, x2: number, y2: number, steps: number) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        let currX = x1;
        let currY = y1;
        const dx = (x2 - x1) / steps;
        const dy = (y2 - y1) / steps;

        for (let s = 1; s < steps; s++) {
          currX += dx + (Math.sin(s * 1.8) * 60);
          currY += dy + (Math.cos(s * 2.3) * 30);
          ctx.lineTo(currX, currY);
        }
        ctx.lineTo(x2, y2);
        ctx.stroke();
      };

      drawBolt(w * 0.5, 0, w * 0.15, h * 0.7, 9);
      drawBolt(w * 0.5, 0, w * 0.85, h * 0.7, 9);
      drawBolt(w * 0.5, h * 0.3, w * 0.5, h, 8);

      ctx.shadowBlur = 0; // reset

    } else if (pattern === 'DRAGON_FLAME') {
      // Hot dragon flames shooting along side pods and hood
      ctx.fillStyle = liveryHex;
      ctx.beginPath();
      ctx.moveTo(w * 0.2, h);
      ctx.bezierCurveTo(w * 0.1, h * 0.6, w * 0.35, h * 0.45, w * 0.25, h * 0.15);
      ctx.bezierCurveTo(w * 0.35, h * 0.35, w * 0.45, h * 0.2, w * 0.5, 0);
      ctx.bezierCurveTo(w * 0.55, h * 0.2, w * 0.65, h * 0.35, w * 0.75, h * 0.15);
      ctx.bezierCurveTo(w * 0.65, h * 0.45, w * 0.9, h * 0.6, w * 0.8, h);
      ctx.closePath();
      ctx.fill();

      // Inner flame core
      ctx.fillStyle = neonHex;
      ctx.beginPath();
      ctx.moveTo(w * 0.35, h);
      ctx.bezierCurveTo(w * 0.3, h * 0.7, w * 0.45, h * 0.5, w * 0.5, h * 0.25);
      ctx.bezierCurveTo(w * 0.55, h * 0.5, w * 0.7, h * 0.7, w * 0.65, h);
      ctx.closePath();
      ctx.fill();

    } else if (pattern === 'CARBON_WEAVE') {
      // Realistic carbon fiber twill pattern
      const size = 16;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      for (let y = 0; y < h; y += size * 2) {
        for (let x = 0; x < w; x += size * 2) {
          ctx.fillRect(x, y, size, size);
          ctx.fillRect(x + size, y + size, size, size);
        }
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      for (let y = 0; y < h; y += size * 2) {
        for (let x = 0; x < w; x += size * 2) {
          ctx.fillRect(x + size, y, size, size);
          ctx.fillRect(x, y + size, size, size);
        }
      }
      // Dual subtle racing pinstripes
      ctx.strokeStyle = neonHex;
      ctx.lineWidth = 8;
      ctx.strokeRect(w * 0.48, 0, 0, h);
      ctx.strokeRect(w * 0.52, 0, 0, h);
    }

    if (this.liveryTexture) {
      this.liveryTexture.needsUpdate = true;
    }
  }

  private buildKartMesh() {
    // Main Body Group added to showroomGroup so rotation rotates everything together
    const bodyGroup = new THREE.Group();

    this.liveryTexture = this.createLiveryTexture();

    // Body Material with Livery Map
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, // Tint with white so livery colors show true
      map: this.liveryTexture,
      metalness: 0.75,
      roughness: 0.28
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

    // 2. Build Modular Wheels & Rims
    this.rimMat = new THREE.MeshBasicMaterial({ color: this.customization.neonColor });
    this.buildWheels();

    // Attach all visual elements inside showroomGroup so 360 showroom rotates together
    this.showroomGroup.add(
      bodyGroup,
      this.frontLeftWheelGroup,
      this.frontRightWheelGroup,
      this.rearLeftWheelGroup,
      this.rearRightWheelGroup
    );
  }

  private buildWheels() {
    // Clear existing wheels
    while (this.frontLeftWheelGroup.children.length > 0) this.frontLeftWheelGroup.remove(this.frontLeftWheelGroup.children[0]);
    while (this.frontRightWheelGroup.children.length > 0) this.frontRightWheelGroup.remove(this.frontRightWheelGroup.children[0]);
    while (this.rearLeftWheelGroup.children.length > 0) this.rearLeftWheelGroup.remove(this.rearLeftWheelGroup.children[0]);
    while (this.rearRightWheelGroup.children.length > 0) this.rearRightWheelGroup.remove(this.rearRightWheelGroup.children[0]);

    this.wheels = [];
    this.rimMeshes = [];

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.85
    });

    const createWheelAssembly = (isFront: boolean) => {
      const wGroup = new THREE.Group();
      const radius = isFront ? 0.36 : 0.38;
      const width = isFront ? 0.32 : 0.36;

      const wheelGeo = new THREE.CylinderGeometry(radius, radius, width, 24);
      wheelGeo.rotateZ(Math.PI * 0.5);
      const tire = new THREE.Mesh(wheelGeo, tireMat);
      wGroup.add(tire);
      this.wheels.push(tire);

      // Build rim model according to customization
      const rimGroup = this.createRimModel(radius * 0.75, width + 0.02);
      wGroup.add(rimGroup);
      this.rimMeshes.push(rimGroup);

      return wGroup;
    };

    // Front Left
    this.frontLeftWheelGroup.position.set(-1.05, 0.36, 1.15);
    this.frontLeftWheelGroup.add(createWheelAssembly(true));

    // Front Right
    this.frontRightWheelGroup.position.set(1.05, 0.36, 1.15);
    this.frontRightWheelGroup.add(createWheelAssembly(true));

    // Rear Left
    this.rearLeftWheelGroup.position.set(-1.05, 0.38, -1.05);
    this.rearLeftWheelGroup.add(createWheelAssembly(false));

    // Rear Right
    this.rearRightWheelGroup.position.set(1.05, 0.38, -1.05);
    this.rearRightWheelGroup.add(createWheelAssembly(false));
  }

  private createRimModel(radius: number, width: number): THREE.Group {
    const group = new THREE.Group();
    const style = this.customization.rimStyle;

    // Outer Rim Ring
    const outerRingGeo = new THREE.TorusGeometry(radius, 0.035, 8, 24);
    outerRingGeo.rotateY(Math.PI * 0.5);
    const outerRing = new THREE.Mesh(outerRingGeo, this.rimMat);
    group.add(outerRing);

    // Center Hub
    const hubGeo = new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, width * 0.8, 12);
    hubGeo.rotateZ(Math.PI * 0.5);
    const hub = new THREE.Mesh(hubGeo, this.trimMat);
    group.add(hub);

    if (style === 'SPORT_5SPOKE') {
      // 5-Spoke Star Design
      for (let i = 0; i < 5; i++) {
        const spokeAngle = (Math.PI * 2 / 5) * i;
        const spokeGeo = new THREE.BoxGeometry(0.04, radius * 0.85, 0.08);
        const spoke = new THREE.Mesh(spokeGeo, this.rimMat);
        spoke.position.set(0, (radius * 0.45) * Math.cos(spokeAngle), (radius * 0.45) * Math.sin(spokeAngle));
        spoke.rotation.x = -spokeAngle;
        group.add(spoke);
      }
    } else if (style === 'CYBER_TURBINE') {
      // Curved Turbine Blades
      for (let i = 0; i < 8; i++) {
        const spokeAngle = (Math.PI * 2 / 8) * i;
        const bladeGeo = new THREE.BoxGeometry(0.03, radius * 0.8, 0.06);
        const blade = new THREE.Mesh(bladeGeo, this.neonMat);
        blade.position.set(0, (radius * 0.45) * Math.cos(spokeAngle), (radius * 0.45) * Math.sin(spokeAngle));
        blade.rotation.x = -spokeAngle + 0.35;
        group.add(blade);
      }
    } else if (style === 'AERO_DISC') {
      // Solid Racing Aero Disc with aerodynamic cooling slots
      const discGeo = new THREE.CylinderGeometry(radius * 0.95, radius * 0.95, 0.05, 24);
      discGeo.rotateZ(Math.PI * 0.5);
      const disc = new THREE.Mesh(discGeo, this.trimMat);
      group.add(disc);

      // Neon circular accent ring
      const innerRingGeo = new THREE.TorusGeometry(radius * 0.6, 0.02, 6, 20);
      innerRingGeo.rotateY(Math.PI * 0.5);
      const innerRing = new THREE.Mesh(innerRingGeo, this.neonMat);
      group.add(innerRing);
    } else if (style === 'WIRE_STAR') {
      // Wire Mesh multi-spoke (10 spokes)
      for (let i = 0; i < 10; i++) {
        const spokeAngle = (Math.PI * 2 / 10) * i;
        const wireGeo = new THREE.CylinderGeometry(0.015, 0.015, radius * 0.9, 6);
        const wire = new THREE.Mesh(wireGeo, this.rimMat);
        wire.position.set(0, (radius * 0.45) * Math.cos(spokeAngle), (radius * 0.45) * Math.sin(spokeAngle));
        wire.rotation.x = -spokeAngle;
        group.add(wire);
      }
    }

    return group;
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
    const oldRim = this.customization.rimStyle;
    this.customization = { ...customization };

    // Redraw livery pattern on canvas
    this.drawLivery();

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

    if (oldRim !== customization.rimStyle) {
      this.buildWheels();
    }
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
