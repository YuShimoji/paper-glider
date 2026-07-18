import { describe, expect, test } from 'vitest';
import { GameModel } from '../../src/game/GameModel';

class ScoreStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function simulateModel(): ReturnType<GameModel['getSnapshot']> {
  const model = new GameModel(new ScoreStorage());
  model.start();
  for (let index = 0; index < 360; index += 1) {
    model.update(1 / 120, index >= 40 && index < 260);
    if (index === 180) model.unfoldWings();
  }
  model.collectRing(1);
  model.collectRing(1);
  model.collectRing(0);
  return model.getSnapshot();
}

describe('GameModel deterministic update and reward compatibility', () => {
  test('replays the same explicit delta and input sequence exactly', () => {
    expect(simulateModel()).toEqual(simulateModel());
  });

  test('keeps Rings and Best as ring counts while tracking line bonus separately', () => {
    const snapshot = simulateModel();
    expect(snapshot.score).toBe(3);
    expect(snapshot.best).toBe(3);
    expect(snapshot.routeBonus).toBe(2);
    expect(snapshot.boostChain).toBe(0);
    expect(snapshot.lastReward).toBe(1);
  });
});
