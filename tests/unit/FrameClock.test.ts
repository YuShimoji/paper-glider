import { describe, expect, test } from 'vitest';
import { FrameClock } from '../../src/game/simulation/FrameClock';

describe('FrameClock visibility lifecycle', () => {
  test('returns no delta while paused and rebases after a long hidden interval', () => {
    const clock = new FrameClock(0.05);
    clock.resume();
    expect(clock.tick(1_000)).toBe(0);
    expect(clock.tick(1_016)).toBeCloseTo(0.016);

    clock.pause();
    expect(clock.tick(91_016)).toBe(0);
    clock.resume();
    expect(clock.tick(91_016)).toBe(0);
    expect(clock.tick(91_032)).toBeCloseTo(0.016);
  });

  test('clamps a late visible frame to the simulation ceiling', () => {
    const clock = new FrameClock(0.05);
    expect(clock.tick(0)).toBe(0);
    expect(clock.tick(2_000)).toBe(0.05);
  });
});
