import { flightTuning } from './FlightTuning';

export type GameMode = 'ready' | 'playing' | 'gameover';

export interface GameSnapshot {
  mode: GameMode;
  score: number;
  best: number;
  speed: number;
  speedMultiplier: number;
  wingFold: number;
  folding: boolean;
  distance: number;
}

const BEST_SCORE_KEY = 'paper-glider-best';

function readBestScore(): number {
  try {
    const saved = Number.parseInt(window.localStorage.getItem(BEST_SCORE_KEY) ?? '0', 10);
    return Number.isFinite(saved) && saved > 0 ? saved : 0;
  } catch {
    return 0;
  }
}

export class GameModel {
  private mode: GameMode = 'ready';
  private score = 0;
  private best = readBestScore();
  private speed = 9.5;
  private speedMultiplier = 1;
  private wingFold = 0;
  private folding = false;
  private distance = 0;
  private elapsed = 0;

  start(): void {
    this.mode = 'playing';
    this.score = 0;
    this.speed = 9.5;
    this.speedMultiplier = 1;
    this.wingFold = 0;
    this.folding = false;
    this.distance = 0;
    this.elapsed = 0;
  }

  update(deltaSeconds: number, folding: boolean): void {
    if (this.mode !== 'playing') return;

    this.elapsed += deltaSeconds;
    this.folding = folding;
    if (folding) {
      this.wingFold = Math.min(1, this.wingFold + deltaSeconds * flightTuning.wing.foldPerSecond);
    }

    this.speedMultiplier = this.getWingSpeedMultiplier();
    const cruiseSpeed = Math.min(22, 9.5 + this.elapsed * 0.12 + this.score * 0.52);
    this.speed = cruiseSpeed * this.speedMultiplier;
    this.distance += this.speed * deltaSeconds;
  }

  unfoldWings(amount = flightTuning.wing.unfoldStep): boolean {
    if (this.mode !== 'playing' || this.wingFold <= 0) return false;

    this.wingFold = Math.max(0, this.wingFold - amount);
    this.speedMultiplier = this.getWingSpeedMultiplier();
    return true;
  }

  collectRing(): boolean {
    if (this.mode !== 'playing') return false;

    this.score += 1;
    if (this.score > this.best) {
      this.best = this.score;
      this.persistBest();
    }
    return true;
  }

  crash(): boolean {
    if (this.mode !== 'playing') return false;

    this.mode = 'gameover';
    this.persistBest();
    return true;
  }

  getSnapshot(): GameSnapshot {
    return {
      mode: this.mode,
      score: this.score,
      best: this.best,
      speed: this.speed,
      speedMultiplier: this.speedMultiplier,
      wingFold: this.wingFold,
      folding: this.folding,
      distance: this.distance,
    };
  }

  private persistBest(): void {
    try {
      window.localStorage.setItem(BEST_SCORE_KEY, String(this.best));
    } catch {
      // The game still runs normally when storage is blocked by the browser.
    }
  }

  private getWingSpeedMultiplier(): number {
    return (
      1 +
      Math.pow(this.wingFold, flightTuning.wing.speedBoostCurve) * flightTuning.wing.speedBoostMaximum
    );
  }
}
