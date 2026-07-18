import { describe, expect, test } from 'vitest';
import {
  FALLBACK_RUN_SEED,
  formatRunSeed,
  parseRunSeed,
  randomUnit,
  resolveRunSeed,
  RUN_SEED_STORAGE_KEY,
} from '../../src/game/simulation/RunSeed';

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('run seed contract', () => {
  test('formats, parses, and reproduces the same deterministic stream', () => {
    expect(parseRunSeed('0x12Ab')).toBe(0x12ab);
    expect(parseRunSeed('12AB')).toBe(0x12ab);
    expect(formatRunSeed(0x12ab)).toBe('000012AB');

    const first = Array.from({ length: 20 }, (_, index) => randomUnit(0x12ab, index, 7));
    const replay = Array.from({ length: 20 }, (_, index) => randomUnit(0x12ab, index, 7));
    const other = Array.from({ length: 20 }, (_, index) => randomUnit(0x12ac, index, 7));
    expect(replay).toEqual(first);
    expect(other).not.toEqual(first);
  });

  test('query wins, storage is reusable, and generation has a wall-clock-free fallback', () => {
    const storage = new MemoryStorage();
    storage.setItem(RUN_SEED_STORAGE_KEY, '00ABCDEF');
    expect(resolveRunSeed('?seed=10203040', storage, null)).toEqual({
      seed: 0x10203040,
      source: 'query',
    });
    expect(storage.getItem(RUN_SEED_STORAGE_KEY)).toBe('10203040');
    expect(resolveRunSeed('', storage, null)).toEqual({ seed: 0x10203040, source: 'storage' });
    expect(resolveRunSeed('', null, null)).toEqual({ seed: FALLBACK_RUN_SEED, source: 'fallback' });
  });
});
