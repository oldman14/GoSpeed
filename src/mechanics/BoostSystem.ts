import { BoostType, BoostEvent } from '../types';

export class BoostSystem {
  // Nitro tank
  public nitroGauge: number = 0; // 0 to 1
  public nitroCount: number = 1; // Start with 1 full nitro bottle
  public maxNitroCount: number = 2;

  // Active boosts
  private activeBoostMultiplier: number = 1.0;
  private activeBoostTimer: number = 0;
  private activeBoostType: BoostType | null = null;

  // Drift spark tracking
  public driftDuration: number = 0;
  public sparkLevel: number = 0; // 0: none, 1: blue, 2: gold

  // Combo detection timing windows
  private miniBoostWindowTimer: number = 0;
  private miniBoostTapCount: number = 0;
  private nitroActiveTimer: number = 0;
  private airTime: number = 0;
  private landBoostWindowTimer: number = 0;
  private recentBoostTimestamps: { type: BoostType; time: number }[] = [];

  public onBoostTriggered?: (event: BoostEvent) => void;

  constructor() {}

  public update(
    dt: number,
    isDrifting: boolean,
    isGrounded: boolean,
    currentSpeed: number
  ) {
    const now = performance.now();

    // 1. Air & Land Boost Windows
    if (!isGrounded) {
      this.airTime += dt;
    } else {
      if (this.airTime > 0.25) {
        // Just landed!
        this.landBoostWindowTimer = 0.6; // 600ms window
      }
      this.airTime = 0;
    }

    if (this.landBoostWindowTimer > 0) {
      this.landBoostWindowTimer -= dt;
    }

    // 2. Drift spark & Nitro charging
    if (isDrifting && isGrounded && currentSpeed > 15) {
      this.driftDuration += dt;
      // Charging spark stages
      if (this.driftDuration > 0.6) {
        this.sparkLevel = 2; // Gold sparks!
      } else if (this.driftDuration > 0.25) {
        this.sparkLevel = 1; // Blue sparks
      }

      // Charge nitro gauge
      if (this.nitroCount < this.maxNitroCount) {
        this.nitroGauge += dt * 0.38; // ~2.6s of drift gives 1 full bottle
        if (this.nitroGauge >= 1.0) {
          this.nitroCount++;
          this.nitroGauge = 0;
        }
      }
    } else {
      // Drift ended
      if (this.driftDuration > 0.28) {
        // Trigger mini boost availability window upon exiting drift!
        this.miniBoostWindowTimer = 0.85; // 850ms window to tap boost
        this.miniBoostTapCount = 0;
      }
      this.driftDuration = 0;
      this.sparkLevel = 0;
    }

    if (this.miniBoostWindowTimer > 0) {
      this.miniBoostWindowTimer -= dt;
    }

    // 3. Update active boost timer
    if (this.activeBoostTimer > 0) {
      this.activeBoostTimer -= dt;
      if (this.activeBoostTimer <= 0) {
        this.activeBoostMultiplier = 1.0;
        this.activeBoostType = null;
      }
    }

    if (this.nitroActiveTimer > 0) {
      this.nitroActiveTimer -= dt;
    }

    // Clean up old timestamps (older than 3 seconds)
    this.recentBoostTimestamps = this.recentBoostTimestamps.filter(
      b => now - b.time < 3000
    );
  }

  // Called when player taps throttle or boost key
  public handleThrottleTap(isGrounded: boolean) {
    // Check Air-Boost
    if (!isGrounded && this.airTime > 0.15) {
      this.triggerBoost({
        type: BoostType.AIR_BOOST,
        title: 'AIR BOOST!',
        duration: 0.6,
        powerMultiplier: 1.35,
        color: '#38bdf8'
      });
      this.airTime = 0;
      return;
    }

    // Check Land-Boost
    if (this.landBoostWindowTimer > 0) {
      this.triggerBoost({
        type: BoostType.LAND_BOOST,
        title: 'LAND BOOST!',
        duration: 0.7,
        powerMultiplier: 1.45,
        color: '#34d399'
      });
      this.landBoostWindowTimer = 0;
      return;
    }

    // Check Mini-Boost & Double-Boost window
    if (this.miniBoostWindowTimer > 0) {
      if (this.miniBoostTapCount === 0) {
        // First mini-boost
        this.miniBoostTapCount = 1;
        this.recordBoost(BoostType.MINI_BOOST);

        // Check if Nitro is currently active -> CWW combo!
        if (this.nitroActiveTimer > 0) {
          this.triggerBoost({
            type: BoostType.CWW_BOOST,
            title: 'CWW SUPER BOOST!',
            duration: 3.2,
            powerMultiplier: 2.1,
            color: '#ec4899'
          });
          this.miniBoostWindowTimer = 0;
          return;
        }

        this.triggerBoost({
          type: BoostType.MINI_BOOST,
          title: 'MINI BOOST!',
          duration: 0.75,
          powerMultiplier: 1.4,
          color: '#fbbf24'
        });
        // Extend window slightly for double-boost tap
        this.miniBoostWindowTimer = 0.55;
      } else if (this.miniBoostTapCount === 1) {
        // Second tap -> Double-Boost!
        this.miniBoostTapCount = 2;
        this.recordBoost(BoostType.DOUBLE_BOOST);

        // Check if Nitro is active -> CWW Boost!
        if (this.nitroActiveTimer > 0) {
          this.triggerBoost({
            type: BoostType.CWW_BOOST,
            title: 'CWW SUPER BOOST!',
            duration: 3.5,
            powerMultiplier: 2.2,
            color: '#f43f5e'
          });
        } else {
          // Check WCW sequence: Mini -> Nitro -> Mini
          const lastMini = this.recentBoostTimestamps.find(b => b.type === BoostType.MINI_BOOST);
          const lastNitro = this.recentBoostTimestamps.find(b => b.type === BoostType.NITRO);
          if (lastMini && lastNitro && lastNitro.time > lastMini.time) {
            this.triggerBoost({
              type: BoostType.WCW_BOOST,
              title: 'WCW BOOST!',
              duration: 3.0,
              powerMultiplier: 1.95,
              color: '#a855f7'
            });
          } else {
            this.triggerBoost({
              type: BoostType.DOUBLE_BOOST,
              title: 'DOUBLE BOOST!!',
              duration: 1.1,
              powerMultiplier: 1.65,
              color: '#f59e0b'
            });
          }
        }
        this.miniBoostWindowTimer = 0;
      }
    }
  }

  // Called when player activates Nitro
  public handleNitroActivate(): boolean {
    if (this.nitroCount <= 0) return false;

    this.nitroCount--;
    this.recordBoost(BoostType.NITRO);
    this.nitroActiveTimer = 3.2;

    // Check if Mini-Boost or Double-Boost was active or recently fired within 400ms -> CWW!
    const recentMini = this.recentBoostTimestamps.find(
      b => (b.type === BoostType.MINI_BOOST || b.type === BoostType.DOUBLE_BOOST) &&
           performance.now() - b.time < 500
    );

    if (recentMini) {
      this.triggerBoost({
        type: BoostType.CWW_BOOST,
        title: 'CWW SUPER BOOST!',
        duration: 3.6,
        powerMultiplier: 2.2,
        color: '#f43f5e'
      });
    } else {
      this.triggerBoost({
        type: BoostType.NITRO,
        title: 'NITRO BOOST!',
        duration: 3.2,
        powerMultiplier: 1.8,
        color: '#00f0ff'
      });
    }

    return true;
  }

  public triggerSpeedPadBoost() {
    this.triggerBoost({
      type: BoostType.SPEED_PAD,
      title: 'SPEED PAD!',
      duration: 1.4,
      powerMultiplier: 1.85,
      color: '#10b981'
    });
  }

  private triggerBoost(event: BoostEvent) {
    this.activeBoostMultiplier = Math.max(this.activeBoostMultiplier, event.powerMultiplier);
    this.activeBoostTimer = Math.max(this.activeBoostTimer, event.duration);
    this.activeBoostType = event.type;
    this.onBoostTriggered?.(event);
  }

  private recordBoost(type: BoostType) {
    this.recentBoostTimestamps.push({ type, time: performance.now() });
  }

  public getBoostMultiplier(): number {
    return this.activeBoostMultiplier;
  }

  public isBoosting(): boolean {
    return this.activeBoostTimer > 0;
  }

  public getActiveBoostType(): BoostType | null {
    return this.activeBoostType;
  }
}
