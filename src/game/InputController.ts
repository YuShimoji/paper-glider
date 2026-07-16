import { Vector2 } from 'three';
import { flightTuning } from './FlightTuning';

const X_LIMIT = 4.72;
const Y_MIN = 0.18;
const Y_MAX = 5.55;

export class InputController {
  readonly target = new Vector2(0, 2.35);
  private readonly keys = new Set<string>();
  private readonly element: HTMLElement;
  private enabled = false;
  private folding = false;
  private unfoldRequested = false;
  private activeHoldPointer: number | null = null;
  private lastPressTime = Number.NEGATIVE_INFINITY;
  private lastPressX = 0;
  private lastPressY = 0;
  private lastPressButton = '';

  constructor(element: HTMLElement) {
    this.element = element;
    this.element.addEventListener('pointerdown', this.onPointer, { passive: true });
    this.element.addEventListener('pointermove', this.onPointer, { passive: true });
    this.element.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('pointerup', this.onPointerEnd);
    window.addEventListener('pointercancel', this.onPointerEnd);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.keys.clear();
      this.folding = false;
      this.activeHoldPointer = null;
    }
  }

  reset(): void {
    this.target.set(0, 2.35);
    this.keys.clear();
    this.folding = false;
    this.unfoldRequested = false;
    this.activeHoldPointer = null;
    this.lastPressTime = Number.NEGATIVE_INFINITY;
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

  isFolding(): boolean {
    return this.enabled && this.folding;
  }

  consumeUnfoldRequest(): boolean {
    const requested = this.unfoldRequested;
    this.unfoldRequested = false;
    return requested;
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

    if (event.type === 'pointerdown') this.beginWingGesture(event);
  };

  private beginWingGesture(event: PointerEvent): void {
    const isFoldButton = event.pointerType === 'touch' || event.button === 0 || event.button === 2;
    if (!isFoldButton) return;

    const buttonKey = event.pointerType === 'touch' ? 'touch' : String(event.button);
    const isDoublePress =
      buttonKey === this.lastPressButton &&
      event.timeStamp - this.lastPressTime <= flightTuning.gesture.doublePressWindowMs &&
      Math.hypot(event.clientX - this.lastPressX, event.clientY - this.lastPressY) <=
        flightTuning.gesture.doublePressDistancePixels;

    this.lastPressTime = event.timeStamp;
    this.lastPressX = event.clientX;
    this.lastPressY = event.clientY;
    this.lastPressButton = buttonKey;

    if (isDoublePress) {
      this.folding = false;
      this.activeHoldPointer = null;
      this.unfoldRequested = true;
      this.lastPressTime = Number.NEGATIVE_INFINITY;
      return;
    }

    this.folding = true;
    this.activeHoldPointer = event.pointerId;
  }

  private readonly onPointerEnd = (event: PointerEvent): void => {
    if (this.activeHoldPointer !== event.pointerId) return;
    this.folding = false;
    this.activeHoldPointer = null;
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    if (this.enabled) event.preventDefault();
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
