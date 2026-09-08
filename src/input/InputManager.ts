import { VehicleInputs } from '../types';

export class InputManager {
  private keys: Map<string, boolean> = new Map();
  private touchInputs = {
    left: false,
    right: false,
    gas: false,
    drift: false,
    nitro: false
  };

  public onThrottleTap?: () => void;
  public onNitroTap?: () => void;
  public onDriftTap?: () => void;

  constructor() {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    this.setupTouchControls();
  }

  private handleKeyDown(e: KeyboardEvent) {
    const code = e.code;
    const wasPressed = this.keys.get(code) || false;
    this.keys.set(code, true);

    if (!wasPressed) {
      if (code === 'KeyW' || code === 'ArrowUp') {
        this.onThrottleTap?.();
      }
      if (code === 'KeyE' || code === 'ControlLeft' || code === 'ControlRight') {
        this.onNitroTap?.();
      }
      if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'Space') {
        this.onDriftTap?.();
      }
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    this.keys.set(e.code, false);
  }

  private setupTouchControls() {
    const bindTouch = (id: string, prop: keyof typeof this.touchInputs, onTap?: () => void) => {
      const el = document.getElementById(id);
      if (!el) return;

      const activate = (e: Event) => {
        e.preventDefault();
        const wasActive = this.touchInputs[prop];
        this.touchInputs[prop] = true;
        if (!wasActive) onTap?.();
      };
      const deactivate = (e: Event) => {
        e.preventDefault();
        this.touchInputs[prop] = false;
      };

      el.addEventListener('touchstart', activate, { passive: false });
      el.addEventListener('touchend', deactivate, { passive: false });
      el.addEventListener('touchcancel', deactivate, { passive: false });
      el.addEventListener('mousedown', activate);
      el.addEventListener('mouseup', deactivate);
      el.addEventListener('mouseleave', deactivate);
    };

    bindTouch('btn-left', 'left');
    bindTouch('btn-right', 'right');
    bindTouch('btn-gas', 'gas', () => this.onThrottleTap?.());
    bindTouch('btn-drift', 'drift', () => this.onDriftTap?.());
    bindTouch('btn-nitro', 'nitro', () => this.onNitroTap?.());
  }

  public getInputs(): VehicleInputs {
    // 1. Keyboard
    let throttle = 0;
    if (this.keys.get('KeyW') || this.keys.get('ArrowUp') || this.touchInputs.gas) throttle += 1;
    if (this.keys.get('KeyS') || this.keys.get('ArrowDown')) throttle -= 1;

    let steering = 0;
    if (this.keys.get('KeyA') || this.keys.get('ArrowLeft') || this.touchInputs.left) steering -= 1;
    if (this.keys.get('KeyD') || this.keys.get('ArrowRight') || this.touchInputs.right) steering += 1;

    let drift = Boolean(
      this.keys.get('ShiftLeft') || 
      this.keys.get('ShiftRight') || 
      this.keys.get('Space') || 
      this.touchInputs.drift
    );

    let nitro = Boolean(
      this.keys.get('KeyE') || 
      this.keys.get('ControlLeft') || 
      this.keys.get('ControlRight') || 
      this.touchInputs.nitro
    );

    // 2. Gamepad API support
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[0];
    if (gp) {
      // Left stick or D-pad
      const stickX = gp.axes[0];
      if (Math.abs(stickX) > 0.15) steering = Math.max(-1, Math.min(1, stickX));
      if (gp.buttons[14]?.pressed) steering -= 1; // D-pad left
      if (gp.buttons[15]?.pressed) steering += 1; // D-pad right

      // Triggers or Face buttons
      const r2 = gp.buttons[7]?.value || (gp.buttons[0]?.pressed ? 1 : 0);
      const l2 = gp.buttons[6]?.value || (gp.buttons[1]?.pressed ? 1 : 0);
      if (r2 > 0.1) throttle = r2;
      if (l2 > 0.1) throttle = -l2;

      // Drift (X/Square or L1)
      if (gp.buttons[2]?.pressed || gp.buttons[4]?.pressed) drift = true;
      // Nitro (Y/Triangle or R1)
      if (gp.buttons[3]?.pressed || gp.buttons[5]?.pressed) nitro = true;
    }

    return { throttle, steering, drift, nitro };
  }
}
