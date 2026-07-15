import { Vector2 } from 'three';

const X_LIMIT = 4.72;
const Y_MIN = 0.18;
const Y_MAX = 5.55;

export class InputController {
  readonly target = new Vector2(0, 2.35);
  private readonly keys = new Set<string>();
  private readonly element: HTMLElement;
  private enabled = false;

  constructor(element: HTMLElement) {
    this.element = element;
    this.element.addEventListener('pointerdown', this.onPointer, { passive: true });
    this.element.addEventListener('pointermove', this.onPointer, { passive: true });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.keys.clear();
  }

  reset(): void {
    this.target.set(0, 2.35);
    this.keys.clear();
  }

  update(deltaSeconds: number): void {
    if (!this.enabled) return;

    const keyboardSpeed = 4.8 * deltaSeconds;
    if (this.keys.has('arrowleft') || this.keys.has('a')) this.target.x -= keyboardSpeed;
    if (this.keys.has('arrowright') || this.keys.has('d')) this.target.x += keyboardSpeed;
    if (this.keys.has('arrowup') || this.keys.has('w')) this.target.y += keyboardSpeed;
    if (this.keys.has('arrowdown') || this.keys.has('s')) this.target.y -= keyboardSpeed;
    this.clampTarget();
  }

  setWorldTarget(x: number, y: number): void {
    this.target.set(x, y);
    this.clampTarget();
  }

  private readonly onPointer = (event: PointerEvent): void => {
    if (!this.enabled) return;
    if (event.type === 'pointermove' && event.pointerType === 'touch' && event.buttons === 0) return;

    const bounds = this.element.getBoundingClientRect();
    const normalizedX = (event.clientX - bounds.left) / bounds.width;
    const normalizedY = (event.clientY - bounds.top) / bounds.height;
    this.target.x = (normalizedX * 2 - 1) * X_LIMIT;
    this.target.y = Y_MAX - normalizedY * (Y_MAX - Y_MIN);
    this.clampTarget();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(key)) {
      this.keys.add(key);
      event.preventDefault();
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.key.toLowerCase());
  };

  private clampTarget(): void {
    this.target.x = Math.max(-X_LIMIT, Math.min(X_LIMIT, this.target.x));
    this.target.y = Math.max(Y_MIN, Math.min(Y_MAX, this.target.y));
  }
}
