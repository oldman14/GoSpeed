import * as THREE from 'three';
import { KinematicVehicle } from '../physics/KinematicVehicle';
import { KartMesh, KartTheme } from '../entities/KartMesh';
import { TrackBuilder } from '../track/TrackBuilder';
import { AIRacer } from '../ai/AIRacer';
import { ChaseCamera } from '../camera/ChaseCamera';
import { InputManager } from '../input/InputManager';
import { SoundSystem } from '../audio/SoundSystem';
import { HUD } from '../ui/HUD';
import { RacerProgress } from '../types';

export enum GameState {
  WAITING = 'WAITING',
  COUNTDOWN = 'COUNTDOWN',
  RACING = 'RACING',
  FINISHED = 'FINISHED'
}

export class Game {
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public camera: ChaseCamera;
  public track: TrackBuilder;
  public inputManager: InputManager;
  public soundSystem: SoundSystem;
  public hud: HUD;

  // Racers
  public playerVehicle!: KinematicVehicle;
  public playerMesh!: KartMesh;

  public aiRacers: AIRacer[] = [];
  public aiMeshes: KartMesh[] = [];

  public racersProgress: RacerProgress[] = [];

  public state: GameState = GameState.WAITING;
  public raceTime: number = 0;
  private totalLaps = 2;

  private lastTime: number = 0;

  constructor() {
    // 1. Scene & Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e172a); // Rich twilight blue sky
    this.scene.fog = new THREE.FogExp2(0x0e172a, 0.0007); // Gentle distant horizon fog

    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25)); // Cap to 1.25 for 60fps on Retina
    this.renderer.shadowMap.enabled = false;

    // 2. Camera, Systems & Track
    this.camera = new ChaseCamera(64, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.inputManager = new InputManager();
    this.soundSystem = new SoundSystem();
    this.hud = new HUD();

    this.setupLighting();

    this.track = new TrackBuilder();
    this.track.buildTrack(this.scene);

    // 3. Spawn Racers
    this.spawnRacers();

    // 4. Hook Boost Callbacks
    this.setupCallbacks();

    // 5. Window Resize
    window.addEventListener('resize', () => this.handleResize());

    // 6. Start Loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xb0c4de, 2.0); // Bright ambient fill
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.4); // Stadium sunlight
    dirLight.position.set(120, 180, 90);
    this.scene.add(dirLight);

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x1e293b, 1.2);
    this.scene.add(hemiLight);
  }

  private spawnRacers() {
    const startPoint = this.track.curve.getPointAt(0);
    const tangent = this.track.curve.getTangentAt(0);
    const normal = new THREE.Vector3(0, 1, 0);
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
    const heading = Math.atan2(tangent.x, tangent.z);

    // 1. Spawn Player (Pole Position: Right Front)
    const playerStartPos = startPoint.clone()
      .addScaledVector(binormal, 4.5)
      .addScaledVector(tangent, 12);
    this.playerVehicle = new KinematicVehicle(playerStartPos, heading);

    const playerTheme: KartTheme = {
      primaryColor: 0x06b6d4, // Cyan
      secondaryColor: 0x0f172a,
      neonColor: 0x00f0ff,
      exhaustColor: 0x00f0ff
    };
    this.playerMesh = new KartMesh(this.playerVehicle, playerTheme);
    this.scene.add(this.playerMesh.group);

    this.racersProgress.push({
      racerId: 'player',
      name: 'YOU',
      isPlayer: true,
      lap: 1,
      currentCheckpointIndex: 0,
      distanceAlongTrack: 0,
      rank: 1,
      finished: false,
      finishTime: 0,
      lastLapTime: 0,
      bestLapTime: 0
    });

    // 2. Spawn 3 AI Bots
    const aiConfigs = [
      {
        name: 'Viper-X',
        offsetBinormal: -4.5,
        offsetTangent: 8,
        theme: { primaryColor: 0xe11d48, secondaryColor: 0x18181b, neonColor: 0xff0055, exhaustColor: 0xff0055 },
        laneOffset: -4.5
      },
      {
        name: 'Thunderbolt',
        offsetBinormal: 4.0,
        offsetTangent: -4,
        theme: { primaryColor: 0xf59e0b, secondaryColor: 0x18181b, neonColor: 0xffbb00, exhaustColor: 0xffbb00 },
        laneOffset: 4.0
      },
      {
        name: 'Shadow-9',
        offsetBinormal: -4.0,
        offsetTangent: -8,
        theme: { primaryColor: 0x8b5cf6, secondaryColor: 0x18181b, neonColor: 0xa855f7, exhaustColor: 0xa855f7 },
        laneOffset: -2.0
      }
    ];

    for (let i = 0; i < aiConfigs.length; i++) {
      const cfg = aiConfigs[i];
      const aiPos = startPoint.clone()
        .addScaledVector(binormal, cfg.offsetBinormal)
        .addScaledVector(tangent, cfg.offsetTangent);

      const aiVehicle = new KinematicVehicle(aiPos, heading);
      const aiMesh = new KartMesh(aiVehicle, cfg.theme);
      this.scene.add(aiMesh.group);

      const aiRacer = new AIRacer(aiVehicle, this.track, 0, cfg.laneOffset, cfg.name);
      this.aiRacers.push(aiRacer);
      this.aiMeshes.push(aiMesh);

      this.racersProgress.push({
        racerId: `ai-${i}`,
        name: cfg.name,
        isPlayer: false,
        lap: 1,
        currentCheckpointIndex: 0,
        distanceAlongTrack: 0,
        rank: i + 2,
        finished: false,
        finishTime: 0,
        lastLapTime: 0,
        bestLapTime: 0
      });
    }
  }

  private setupCallbacks() {
    this.playerVehicle.boostSystem.onBoostTriggered = (event) => {
      this.hud.showCombo(event);
      this.soundSystem.playBoostSound(event.type);
    };

    this.playerVehicle.onWallHit = (impact) => {
      this.soundSystem.playWallHitSound(impact);
      this.camera.addTrauma(Math.min(0.5, impact * 0.04));
    };

    this.playerVehicle.onRescued = () => {
      this.hud.showAlert('RESCUED TO TRACK', '#f43f5e');
    };

    this.inputManager.onThrottleTap = () => {
      if (this.state === GameState.RACING) {
        this.playerVehicle.boostSystem.handleThrottleTap(this.playerVehicle.isGrounded);
      }
    };
  }

  public startCountdown() {
    this.soundSystem.init();
    this.soundSystem.resume();
    this.state = GameState.COUNTDOWN;

    const countSteps = ['3', '2', '1', 'GO!'];
    let idx = 0;

    const nextStep = () => {
      if (idx < countSteps.length) {
        const text = countSteps[idx];
        this.hud.showCountdown(text);
        const isFinal = idx === countSteps.length - 1;
        this.soundSystem.playCountdownBeep(isFinal);

        idx++;
        setTimeout(nextStep, 1000);
      } else {
        this.state = GameState.RACING;
      }
    };

    nextStep();
  }

  private loop(timestamp: number) {
    requestAnimationFrame((t) => this.loop(t));

    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    if (this.state === GameState.RACING) {
      this.raceTime += dt;
      this.updateRace(dt);
    } else if (this.state === GameState.COUNTDOWN || this.state === GameState.WAITING) {
      // Idle engine animations
      this.playerMesh.update(dt);
      for (const m of this.aiMeshes) m.update(dt);
      this.camera.update(dt, this.playerVehicle);
    }

    this.renderer.render(this.scene, this.camera.camera);
  }

  private updateRace(dt: number) {
    // 1. Update Player (constrained to track boundaries)
    const playerInputs = this.inputManager.getInputs();
    this.playerVehicle.update(dt, playerInputs, this.track);
    this.playerMesh.update(dt);

    // 2. Check Speed Pads
    this.checkSpeedPads(this.playerVehicle);

    // Check jump ramp elevation (at spline u ≈ 0.82)
    this.checkRamps(this.playerVehicle);

    // 3. Update AI Bots (also constrained to track boundaries)
    for (let i = 0; i < this.aiRacers.length; i++) {
      const bot = this.aiRacers[i];
      const botInputs = bot.update(dt, this.playerVehicle);
      bot.vehicle.update(dt, botInputs, this.track);
      this.aiMeshes[i].update(dt);
      this.checkSpeedPads(bot.vehicle);
      this.checkRamps(bot.vehicle);
    }

    // 4. Update Checkpoints & Positions
    this.updateCheckpoints();

    // 5. Update Camera
    this.camera.update(dt, this.playerVehicle);

    // 6. Update Sound
    this.soundSystem.update(
      this.playerVehicle.getSpeedKmh(),
      this.playerVehicle.driftState !== 'NONE',
      this.playerVehicle.boostSystem.isBoosting()
    );

    // 7. Update HUD
    this.hud.update(this.playerVehicle, this.racersProgress, this.track, this.raceTime);
  }

  private checkSpeedPads(vehicle: KinematicVehicle) {
    for (const pad of this.track.speedPads) {
      if (vehicle.position.distanceTo(pad.position) < 7.0) {
        if (!vehicle.boostSystem.isBoosting()) {
          vehicle.boostSystem.triggerSpeedPadBoost();
        }
      }
    }
  }

  private checkRamps(vehicle: KinematicVehicle) {
    // Jump ramp between z: -210 and -195, x: 130 to 170
    if (vehicle.position.z < -200 && vehicle.position.z > -225 && vehicle.position.x > 110 && vehicle.position.x < 180) {
      if (vehicle.isGrounded && vehicle.speed > 25) {
        vehicle.triggerLaunch(14);
      }
    }
  }

  private updateCheckpoints() {
    const cpCount = this.track.checkpoints.length;

    for (const progress of this.racersProgress) {
      const vehicle = progress.isPlayer
        ? this.playerVehicle
        : this.aiRacers.find(b => b.name === progress.name)?.vehicle;

      if (!vehicle || progress.finished) continue;

      const currentCp = this.track.checkpoints[progress.currentCheckpointIndex];
      const distToCurrent = vehicle.position.distanceTo(currentCp.position);

      if (distToCurrent < currentCp.radius) {
        progress.currentCheckpointIndex = (progress.currentCheckpointIndex + 1) % cpCount;
        if (progress.currentCheckpointIndex === 0) {
          // Completed Lap!
          progress.lap++;
          if (progress.lap > this.totalLaps) {
            progress.finished = true;
            progress.finishTime = this.raceTime;
            if (progress.isPlayer) {
              this.state = GameState.FINISHED;
            }
          }
        }
      }

      // Calculate total race distance
      progress.distanceAlongTrack = (progress.lap - 1) * cpCount + progress.currentCheckpointIndex;
    }

    // Sort rankings
    const sorted = [...this.racersProgress].sort((a, b) => b.distanceAlongTrack - a.distanceAlongTrack);
    for (let r = 0; r < sorted.length; r++) {
      sorted[r].rank = r + 1;
    }
  }

  private handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height);
    this.camera.resize(width, height);
  }
}
