import * as THREE from 'three';
import { Checkpoint } from '../types';

export interface SpeedPadLocation {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  mesh: THREE.Mesh;
}

interface TrackSample {
  x: number;
  y: number;
  z: number;
}

export class TrackBuilder {
  public curve: THREE.CatmullRomCurve3;
  public trackMesh!: THREE.Mesh;
  public curbsMesh!: THREE.Mesh;
  public barriersMesh!: THREE.Mesh;
  public checkpoints: Checkpoint[] = [];
  public speedPads: SpeedPadLocation[] = [];
  public sceneryGroup: THREE.Group = new THREE.Group();

  public trackWidth: number = 24; // meters wide
  public totalLength: number = 0;

  // Optimized ground height look-up table (LUT)
  private samples: TrackSample[] = [];
  private trackWidthSq: number;
  private static readonly upNormal = new THREE.Vector3(0, 1, 0);

  constructor() {
    this.curve = this.createTrackSpline();
    this.totalLength = this.curve.getLength();
    this.trackWidthSq = (this.trackWidth * 0.65) ** 2;
    this.precomputeSamples();
  }

  private createTrackSpline(): THREE.CatmullRomCurve3 {
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 160),
      new THREE.Vector3(45, 0, 260),
      new THREE.Vector3(130, 0, 300),
      new THREE.Vector3(220, 0, 260),
      new THREE.Vector3(260, 0, 150),
      new THREE.Vector3(210, 0, 70),
      new THREE.Vector3(270, 0, -50),
      new THREE.Vector3(250, 0, -180),
      new THREE.Vector3(160, 6, -230),
      new THREE.Vector3(60, 2, -180),
      new THREE.Vector3(-40, 0, -80),
    ];
    return new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.5);
  }

  private precomputeSamples() {
    const count = 150;
    for (let i = 0; i < count; i++) {
      const pt = this.curve.getPointAt(i / count);
      this.samples.push({ x: pt.x, y: pt.y, z: pt.z });
    }
  }

  public buildTrack(scene: THREE.Scene) {
    const sampleCount = 360;
    const points = this.curve.getSpacedPoints(sampleCount);

    const roadGeo = new THREE.BufferGeometry();
    const posArr: number[] = [];
    const normArr: number[] = [];
    const uvArr: number[] = [];
    const indexArr: number[] = [];

    const curbGeo = new THREE.BufferGeometry();
    const curbPos: number[] = [];
    const curbNorm: number[] = [];
    const curbUv: number[] = [];
    const curbIndex: number[] = [];

    const barrierGeo = new THREE.BufferGeometry();
    const barPos: number[] = [];
    const barNorm: number[] = [];
    const barUv: number[] = [];
    const barIndex: number[] = [];

    const halfWidth = this.trackWidth * 0.5;
    const curbWidth = 2.0;
    const barrierHeight = 1.4;

    for (let i = 0; i <= sampleCount; i++) {
      const u = i / sampleCount;
      const pt = points[i % sampleCount];
      const tangent = this.curve.getTangentAt(u % 1.0);
      const normal = new THREE.Vector3(0, 1, 0);
      const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();

      const leftRoad = new THREE.Vector3().copy(pt).addScaledVector(binormal, -halfWidth);
      leftRoad.y += 0.05;
      const rightRoad = new THREE.Vector3().copy(pt).addScaledVector(binormal, halfWidth);
      rightRoad.y += 0.05;

      posArr.push(leftRoad.x, leftRoad.y, leftRoad.z);
      normArr.push(0, 1, 0);
      uvArr.push(0, u * 60);

      posArr.push(rightRoad.x, rightRoad.y, rightRoad.z);
      normArr.push(0, 1, 0);
      uvArr.push(1, u * 60);

      const leftCurbOuter = new THREE.Vector3().copy(leftRoad).addScaledVector(binormal, -curbWidth);
      leftCurbOuter.y += 0.25;
      const rightCurbOuter = new THREE.Vector3().copy(rightRoad).addScaledVector(binormal, curbWidth);
      rightCurbOuter.y += 0.25;

      curbPos.push(leftCurbOuter.x, leftCurbOuter.y, leftCurbOuter.z);
      curbPos.push(leftRoad.x, leftRoad.y, leftRoad.z);
      curbPos.push(rightRoad.x, rightRoad.y, rightRoad.z);
      curbPos.push(rightCurbOuter.x, rightCurbOuter.y, rightCurbOuter.z);

      for (let k = 0; k < 4; k++) curbNorm.push(0, 1, 0);
      curbUv.push(0, u * 90, 1, u * 90, 0, u * 90, 1, u * 90);

      const leftBarTop = new THREE.Vector3().copy(leftCurbOuter);
      leftBarTop.y += barrierHeight;
      const rightBarTop = new THREE.Vector3().copy(rightCurbOuter);
      rightBarTop.y += barrierHeight;

      barPos.push(leftCurbOuter.x, leftCurbOuter.y, leftCurbOuter.z);
      barPos.push(leftBarTop.x, leftBarTop.y, leftBarTop.z);
      barPos.push(rightCurbOuter.x, rightCurbOuter.y, rightCurbOuter.z);
      barPos.push(rightBarTop.x, rightBarTop.y, rightBarTop.z);

      for (let k = 0; k < 4; k++) barNorm.push(binormal.x, 0, binormal.z);
      barUv.push(0, u * 60, 1, u * 60, 0, u * 60, 1, u * 60);

      if (i < sampleCount) {
        const rIdx = i * 2;
        indexArr.push(rIdx, rIdx + 1, rIdx + 2);
        indexArr.push(rIdx + 1, rIdx + 3, rIdx + 2);

        const cIdx = i * 4;
        curbIndex.push(cIdx, cIdx + 1, cIdx + 4);
        curbIndex.push(cIdx + 1, cIdx + 5, cIdx + 4);
        curbIndex.push(cIdx + 2, cIdx + 3, cIdx + 6);
        curbIndex.push(cIdx + 3, cIdx + 7, cIdx + 6);

        const bIdx = i * 4;
        barIndex.push(bIdx, bIdx + 1, bIdx + 4);
        barIndex.push(bIdx + 1, bIdx + 5, bIdx + 4);
        barIndex.push(bIdx + 2, bIdx + 6, bIdx + 3);
        barIndex.push(bIdx + 3, bIdx + 6, bIdx + 7);
      }
    }

    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normArr, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
    roadGeo.setIndex(indexArr);
    roadGeo.computeVertexNormals();

    curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbPos, 3));
    curbGeo.setAttribute('normal', new THREE.Float32BufferAttribute(curbNorm, 3));
    curbGeo.setAttribute('uv', new THREE.Float32BufferAttribute(curbUv, 2));
    curbGeo.setIndex(curbIndex);
    curbGeo.computeVertexNormals();

    barrierGeo.setAttribute('position', new THREE.Float32BufferAttribute(barPos, 3));
    barrierGeo.setAttribute('normal', new THREE.Float32BufferAttribute(barNorm, 3));
    barrierGeo.setAttribute('uv', new THREE.Float32BufferAttribute(barUv, 2));
    barrierGeo.setIndex(barIndex);
    barrierGeo.computeVertexNormals();

    // Road Texture
    const roadCanvas = document.createElement('canvas');
    roadCanvas.width = 512;
    roadCanvas.height = 512;
    const ctx = roadCanvas.getContext('2d')!;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    for (let y = 0; y < 512; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    // Outer Edge Lines
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(14, 512);
    ctx.moveTo(498, 0);
    ctx.lineTo(498, 512);
    ctx.stroke();

    // Center Dashed Line
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 8;
    ctx.setLineDash([48, 36]);
    ctx.beginPath();
    ctx.moveTo(250, 0);
    ctx.lineTo(250, 512);
    ctx.moveTo(262, 0);
    ctx.lineTo(262, 512);
    ctx.stroke();
    ctx.setLineDash([]);

    const roadTex = new THREE.CanvasTexture(roadCanvas);
    roadTex.wrapS = THREE.RepeatWrapping;
    roadTex.wrapT = THREE.RepeatWrapping;

    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.5,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    this.trackMesh = new THREE.Mesh(roadGeo, roadMat);
    scene.add(this.trackMesh);

    // Curbs
    const curbCanvas = document.createElement('canvas');
    curbCanvas.width = 64;
    curbCanvas.height = 64;
    const cCtx = curbCanvas.getContext('2d')!;
    cCtx.fillStyle = '#ff0055';
    cCtx.fillRect(0, 0, 64, 32);
    cCtx.fillStyle = '#ffffff';
    cCtx.fillRect(0, 32, 64, 32);
    const curbTex = new THREE.CanvasTexture(curbCanvas);
    curbTex.wrapS = THREE.RepeatWrapping;
    curbTex.wrapT = THREE.RepeatWrapping;
    curbTex.repeat.set(1, 45);

    const curbMat = new THREE.MeshStandardMaterial({
      map: curbTex,
      roughness: 0.4,
      side: THREE.DoubleSide
    });
    this.curbsMesh = new THREE.Mesh(curbGeo, curbMat);
    scene.add(this.curbsMesh);

    // Barriers
    const barMat = new THREE.MeshBasicMaterial({
      color: 0x00e1ff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });
    this.barriersMesh = new THREE.Mesh(barrierGeo, barMat);
    scene.add(this.barriersMesh);

    // Checkpoints
    const cpCount = 45;
    for (let c = 0; c < cpCount; c++) {
      const u = c / cpCount;
      const pos = this.curve.getPointAt(u);
      const tangent = this.curve.getTangentAt(u);
      this.checkpoints.push({
        index: c,
        position: pos,
        tangent: tangent,
        normal: new THREE.Vector3(0, 1, 0),
        radius: this.trackWidth * 0.75
      });
    }

    this.buildSpeedPads(scene);
    this.buildGantry(scene);
    this.buildFloodlights(scene);
    this.buildCyberCity(scene);
  }

  private buildSpeedPads(scene: THREE.Scene) {
    const padLocations = [0.12, 0.16, 0.76, 0.88];
    const padGeo = new THREE.PlaneGeometry(12, 5);
    padGeo.rotateX(-Math.PI * 0.5);

    const padCanvas = document.createElement('canvas');
    padCanvas.width = 256;
    padCanvas.height = 128;
    const ctx = padCanvas.getContext('2d')!;
    ctx.fillStyle = '#022c22';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#10b981';

    for (let offset = 40; offset < 240; offset += 70) {
      ctx.beginPath();
      ctx.moveTo(offset + 30, 20);
      ctx.lineTo(offset + 60, 64);
      ctx.lineTo(offset + 45, 64);
      ctx.lineTo(offset + 45, 108);
      ctx.lineTo(offset + 15, 108);
      ctx.lineTo(offset + 15, 64);
      ctx.lineTo(offset, 64);
      ctx.closePath();
      ctx.fill();
    }

    const padTex = new THREE.CanvasTexture(padCanvas);
    const padMat = new THREE.MeshBasicMaterial({
      map: padTex,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide
    });

    for (const u of padLocations) {
      const pos = this.curve.getPointAt(u);
      const tangent = this.curve.getTangentAt(u);
      const mesh = new THREE.Mesh(padGeo, padMat);
      mesh.position.copy(pos).add(new THREE.Vector3(0, 0.12, 0));
      mesh.rotation.y = Math.atan2(tangent.x, tangent.z);

      scene.add(mesh);
      this.speedPads.push({ position: pos, tangent, mesh });
    }
  }

  private buildGantry(scene: THREE.Scene) {
    const gantryGroup = new THREE.Group();
    const startPoint = this.curve.getPointAt(0);
    const tangent = this.curve.getTangentAt(0);

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
    const pGeo = new THREE.BoxGeometry(1.6, 12, 1.6);
    const pLeft = new THREE.Mesh(pGeo, pillarMat);
    pLeft.position.set(-15, 6, 0);
    const pRight = new THREE.Mesh(pGeo, pillarMat);
    pRight.position.set(15, 6, 0);

    const bGeo = new THREE.BoxGeometry(32, 3.0, 2.5);
    const beam = new THREE.Mesh(bGeo, pillarMat);
    beam.position.set(0, 11, 0);

    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512;
    signCanvas.height = 128;
    const ctx = signCanvas.getContext('2d')!;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 128);
    ctx.font = '900 italic 56px sans-serif';
    ctx.fillStyle = '#00f0ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡ GOSPEED START ⚡', 256, 64);

    const signTex = new THREE.CanvasTexture(signCanvas);
    const signMat = new THREE.MeshBasicMaterial({ map: signTex });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(20, 4), signMat);
    sign.position.set(0, 11, 1.35);

    gantryGroup.add(pLeft, pRight, beam, sign);
    gantryGroup.position.copy(startPoint);
    gantryGroup.rotation.y = Math.atan2(tangent.x, tangent.z);

    scene.add(gantryGroup);
  }

  private buildFloodlights(scene: THREE.Scene) {
    // Highly efficient static floodlight meshes (Zero dynamic PointLight overhead!)
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (let i = 0; i < 24; i++) {
      const u = (i / 24) % 1.0;
      const pt = this.curve.getPointAt(u);
      const tangent = this.curve.getTangentAt(u);
      const normal = new THREE.Vector3(0, 1, 0);
      const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();

      const side = i % 2 === 0 ? 1 : -1;
      const polePos = pt.clone().addScaledVector(binormal, side * (this.trackWidth * 0.5 + 4.5));

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 14, 6), poleMat);
      pole.position.set(polePos.x, polePos.y + 7, polePos.z);

      const head = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.2, 1.5), lampMat);
      head.position.set(polePos.x, polePos.y + 14, polePos.z);
      head.lookAt(pt.x, pt.y + 2, pt.z);

      scene.add(pole, head);
    }
  }

  private buildCyberCity(scene: THREE.Scene) {
    const buildingMat = new THREE.MeshStandardMaterial({
      color: 0x1e2238,
      roughness: 0.5,
      metalness: 0.3
    });

    const neonColors = [0x00f0ff, 0xf43f5e, 0xf59e0b, 0x38bdf8];

    // Shared geometry for skyscrapers
    for (let b = 0; b < 50; b++) {
      const u = (b / 50) % 1.0;
      const pt = this.curve.getPointAt(u);
      const tangent = this.curve.getTangentAt(u);
      const normal = new THREE.Vector3(0, 1, 0);
      const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();

      const side = b % 2 === 0 ? 1 : -1;
      const dist = 40 + (b % 4) * 22;
      const bPos = new THREE.Vector3().copy(pt).addScaledVector(binormal, side * dist);

      const bWidth = 20 + (b % 3) * 8;
      const bDepth = 20 + (b % 3) * 8;
      const bHeight = 50 + (b % 5) * 20;

      const bGeo = new THREE.BoxGeometry(bWidth, bHeight, bDepth);
      const building = new THREE.Mesh(bGeo, buildingMat);
      building.position.set(bPos.x, bHeight * 0.5 - 2, bPos.z);
      this.sceneryGroup.add(building);

      const borderGeo = new THREE.BoxGeometry(bWidth + 0.6, 2.2, bDepth + 0.6);
      const borderMat = new THREE.MeshBasicMaterial({
        color: neonColors[b % neonColors.length]
      });
      const border = new THREE.Mesh(borderGeo, borderMat);
      border.position.set(bPos.x, bHeight - 1, bPos.z);
      this.sceneryGroup.add(border);
    }

    const groundGeo = new THREE.PlaneGeometry(1200, 1200);
    groundGeo.rotateX(-Math.PI * 0.5);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0c1222,
      roughness: 0.9,
      metalness: 0.1
    });
    const groundPlane = new THREE.Mesh(groundGeo, groundMat);
    groundPlane.position.y = -0.3;
    this.sceneryGroup.add(groundPlane);

    const grid = new THREE.GridHelper(1000, 80, 0x00f0ff, 0x1e293b);
    grid.position.y = -0.1;
    this.sceneryGroup.add(grid);

    scene.add(this.sceneryGroup);
  }

  // Fast O(N) lookup without any runtime object allocations
  public getGroundHeight(pos: THREE.Vector3): { height: number; normal: THREE.Vector3 } {
    let minDistanceSq = Infinity;
    let bestY = 0;
    const px = pos.x;
    const pz = pos.z;
    const samples = this.samples;
    const len = samples.length;

    for (let i = 0; i < len; i++) {
      const s = samples[i];
      const dx = s.x - px;
      const dz = s.z - pz;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDistanceSq) {
        minDistanceSq = dSq;
        bestY = s.y;
      }
    }

    if (minDistanceSq <= this.trackWidthSq) {
      return { height: bestY, normal: TrackBuilder.upNormal };
    }

    return { height: 0, normal: TrackBuilder.upNormal };
  }
}
