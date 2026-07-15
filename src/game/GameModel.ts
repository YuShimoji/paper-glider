export type GameMode = 'ready' | 'playing' | 'gameover';

export interface GameSnapshot {
  mode: GameMode;
  score: number;
  best: number;
  speed: number;
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
  private distance = 0;
  private elapsed = 0;

  start(): void {
    this.mode = 'playing';
    this.score = 0;
    this.speed = 9.5;
    this.distance = 0;
    this.elapsed = 0;
  }

  update(deltaSeconds: number): void {
    if (this.mode !== 'playing') return;

    this.elapsed += deltaSeconds;
    this.speed = Math.min(22, 9.5 + this.elapsed * 0.12 + this.score * 0.52);
    this.distance += this.speed * deltaSeconds;
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
}
