import { KinematicVehicle } from '../physics/KinematicVehicle';
import { TrackBuilder } from '../track/TrackBuilder';
import { RacerProgress, BoostEvent } from '../types';

export class HUD {
  private container: HTMLElement;
  private miniMapCanvas!: HTMLCanvasElement;
  private miniMapCtx!: CanvasRenderingContext2D;

  private speedText!: HTMLElement;
  private rankText!: HTMLElement;
  private lapText!: HTMLElement;
  private timeText!: HTMLElement;
  private nitroFillBar!: HTMLElement;
  private nitroBottleCount!: HTMLElement;
  private comboPopup!: HTMLElement;
  private countdownEl!: HTMLElement;

  private comboTimeout: number | null = null;

  constructor() {
    this.container = document.getElementById('hud') || document.body;
    this.buildHUDStructure();
  }

  private buildHUDStructure() {
    this.container.innerHTML = `
      <style>
        .hud-layer {
          position: absolute;
          inset: 0;
          pointer-events: none;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 24px 32px;
          font-family: 'Segoe UI', system-ui, sans-serif;
          color: #ffffff;
        }
        /* Top Bar */
        .hud-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .rank-box {
          background: rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(0, 240, 255, 0.4);
          border-left: 5px solid #00f0ff;
          padding: 10px 24px;
          border-radius: 8px;
          backdrop-filter: blur(8px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }
        .rank-main {
          font-size: 2.6rem;
          font-weight: 900;
          font-style: italic;
          color: #00f0ff;
          letter-spacing: 2px;
          text-shadow: 0 0 20px rgba(0, 240, 255, 0.7);
        }
        .rank-sub {
          font-size: 0.85rem;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .lap-time-box {
          background: rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 8px 20px;
          border-radius: 8px;
          margin-top: 10px;
          font-weight: bold;
          font-size: 1.1rem;
          letter-spacing: 1px;
        }
        /* Mini-map */
        .minimap-container {
          background: rgba(15, 23, 42, 0.8);
          border: 2px solid rgba(56, 189, 248, 0.35);
          border-radius: 12px;
          padding: 6px;
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(6px);
        }
        #minimap-canvas {
          display: block;
          border-radius: 8px;
        }
        /* Center Combo Popup */
        .combo-container {
          position: absolute;
          top: 35%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          opacity: 0;
          transition: all 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          pointer-events: none;
        }
        .combo-text {
          font-size: 3.2rem;
          font-weight: 900;
          font-style: italic;
          letter-spacing: 3px;
          text-transform: uppercase;
          text-shadow: 0 0 35px currentColor, 0 4px 10px rgba(0,0,0,0.8);
          white-space: nowrap;
        }
        /* Countdown */
        .countdown-overlay {
          position: absolute;
          top: 45%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 7rem;
          font-weight: 900;
          font-style: italic;
          color: #ff0055;
          text-shadow: 0 0 50px #ff0055, 0 0 20px #ff0055;
          opacity: 0;
          transition: transform 0.15s ease, opacity 0.15s ease;
        }
        /* Bottom Controls & Speedometer */
        .hud-bottom {
          display: flex;
          justify-content: flex-end;
          align-items: flex-end;
        }
        .gauge-cluster {
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(0, 240, 255, 0.3);
          border-radius: 16px;
          padding: 16px 28px;
          backdrop-filter: blur(8px);
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
        }
        .speedo-num {
          font-size: 4rem;
          font-weight: 900;
          font-style: italic;
          color: #fff;
          line-height: 0.9;
          letter-spacing: 2px;
          text-shadow: 0 0 20px rgba(255, 255, 255, 0.4);
        }
        .speedo-unit {
          font-size: 0.95rem;
          font-weight: bold;
          color: #38bdf8;
          letter-spacing: 2px;
          margin-bottom: 12px;
        }
        /* Nitro bar */
        .nitro-wrapper {
          width: 190px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .nitro-info {
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
          font-weight: bold;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .nitro-bar-track {
          width: 100%;
          height: 12px;
          background: #0f172a;
          border-radius: 6px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.2);
          position: relative;
        }
        .nitro-bar-fill {
          height: 100%;
          width: 0%;
          background: linear-gradient(90deg, #00f0ff 0%, #ff0077 100%);
          box-shadow: 0 0 15px rgba(0, 240, 255, 0.8);
          transition: width 0.05s linear;
        }
      </style>

      <div class="hud-layer">
        <!-- Top Row -->
        <div class="hud-top">
          <div>
            <div class="rank-box">
              <div class="rank-main" id="hud-rank">1ST</div>
              <div class="rank-sub" id="hud-lap">LAP 1 / 2</div>
            </div>
            <div class="lap-time-box" id="hud-time">00:00.00</div>
          </div>

          <div class="minimap-container">
            <canvas id="minimap-canvas" width="180" height="180"></canvas>
          </div>
        </div>

        <!-- Center Alerts -->
        <div class="combo-container" id="hud-combo">
          <div class="combo-text" id="hud-combo-text">CWW BOOST!</div>
        </div>

        <div class="countdown-overlay" id="hud-countdown">3</div>

        <!-- Bottom Row -->
        <div class="hud-bottom">
          <div class="gauge-cluster">
            <div class="speedo-num" id="hud-speed">0</div>
            <div class="speedo-unit">KM / H</div>

            <div class="nitro-wrapper">
              <div class="nitro-info">
                <span>NITRO TANK</span>
                <span id="hud-nitro-count">x1 READY</span>
              </div>
              <div class="nitro-bar-track">
                <div class="nitro-bar-fill" id="hud-nitro-fill"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.miniMapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
    this.miniMapCtx = this.miniMapCanvas.getContext('2d')!;

    this.speedText = document.getElementById('hud-speed')!;
    this.rankText = document.getElementById('hud-rank')!;
    this.lapText = document.getElementById('hud-lap')!;
    this.timeText = document.getElementById('hud-time')!;
    this.nitroFillBar = document.getElementById('hud-nitro-fill')!;
    this.nitroBottleCount = document.getElementById('hud-nitro-count')!;
    this.comboPopup = document.getElementById('hud-combo')!;
    this.countdownEl = document.getElementById('hud-countdown')!;
  }

  public showCombo(event: BoostEvent) {
    const textEl = document.getElementById('hud-combo-text')!;
    textEl.innerText = event.title;
    textEl.style.color = event.color;

    this.comboPopup.style.opacity = '1';
    this.comboPopup.style.transform = 'translate(-50%, -50%) scale(1.25)';

    if (this.comboTimeout) clearTimeout(this.comboTimeout);
    this.comboTimeout = window.setTimeout(() => {
      this.comboPopup.style.opacity = '0';
      this.comboPopup.style.transform = 'translate(-50%, -50%) scale(0.8)';
    }, 1100);
  }

  public showCountdown(value: string) {
    this.countdownEl.innerText = value;
    this.countdownEl.style.opacity = '1';
    this.countdownEl.style.transform = 'translate(-50%, -50%) scale(1.3)';

    setTimeout(() => {
      this.countdownEl.style.opacity = '0';
      this.countdownEl.style.transform = 'translate(-50%, -50%) scale(0.6)';
    }, 800);
  }

  public showAlert(text: string, color: string = '#00f0ff') {
    const textEl = document.getElementById('hud-combo-text');
    if (textEl && this.comboPopup) {
      textEl.innerText = text;
      textEl.style.color = color;

      this.comboPopup.style.opacity = '1';
      this.comboPopup.style.transform = 'translate(-50%, -50%) scale(1.35)';

      if (this.comboTimeout) clearTimeout(this.comboTimeout);
      this.comboTimeout = window.setTimeout(() => {
        this.comboPopup.style.opacity = '0';
        this.comboPopup.style.transform = 'translate(-50%, -50%) scale(0.8)';
      }, 1200);
    }
  }

  public update(
    playerVehicle: KinematicVehicle,
    racersProgress: RacerProgress[],
    track: TrackBuilder,
    elapsedTime: number
  ) {
    // 1. Update Speedometer
    const kmh = playerVehicle.getDisplaySpeed();
    this.speedText.innerText = kmh.toString();

    // 2. Update Nitro Gauge
    const boostSys = playerVehicle.boostSystem;
    const fillPct = Math.round(boostSys.nitroGauge * 100);
    this.nitroFillBar.style.width = `${fillPct}%`;
    this.nitroBottleCount.innerText = `x${boostSys.nitroCount} READY`;
    this.nitroBottleCount.style.color = boostSys.nitroCount > 0 ? '#00f0ff' : '#94a3b8';

    // 3. Update Lap & Rank
    const playerProgress = racersProgress.find(r => r.isPlayer);
    if (playerProgress) {
      const rankSuffix = ['TH', 'ST', 'ND', 'RD', 'TH'][playerProgress.rank] || 'TH';
      this.rankText.innerText = `${playerProgress.rank}${rankSuffix}`;
      this.lapText.innerText = `LAP ${playerProgress.lap} / 2`;
    }

    // 4. Update Time
    const minutes = Math.floor(elapsedTime / 60);
    const seconds = Math.floor(elapsedTime % 60);
    const millis = Math.floor((elapsedTime % 1) * 100);
    this.timeText.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(2, '0')}`;

    // 5. Render Minimap
    this.renderMiniMap(track, racersProgress, playerVehicle);
  }

  private cachedTrackPoints: { x: number; y: number }[] | null = null;

  private renderMiniMap(
    track: TrackBuilder,
    racersProgress: RacerProgress[],
    playerVehicle: KinematicVehicle
  ) {
    const ctx = this.miniMapCtx;
    const w = this.miniMapCanvas.width;
    const h = this.miniMapCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const minX = -60, maxX = 300;
    const minZ = -260, maxZ = 330;

    const mapX = (x: number) => ((x - minX) / (maxX - minX)) * (w - 24) + 12;
    const mapY = (z: number) => ((z - minZ) / (maxZ - minZ)) * (h - 24) + 12;

    // Precalculate track outline points once
    if (!this.cachedTrackPoints) {
      this.cachedTrackPoints = [];
      const sampleCount = 60;
      for (let i = 0; i <= sampleCount; i++) {
        const pt = track.curve.getPointAt(i / sampleCount);
        this.cachedTrackPoints.push({ x: mapX(pt.x), y: mapY(pt.z) });
      }
    }

    // Draw Track Line from cached points
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < this.cachedTrackPoints.length; i++) {
      const p = this.cachedTrackPoints[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();

    // Draw AI Racers
    for (const r of racersProgress) {
      if (!r.isPlayer) {
        // Find approximate position
        const pt = track.curve.getPointAt(r.distanceAlongTrack % 1.0);
        const mx = mapX(pt.x);
        const my = mapY(pt.z);

        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(mx, my, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw Player (Glowing Cyan Icon)
    const px = mapX(playerVehicle.position.x);
    const py = mapY(playerVehicle.position.z);

    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
