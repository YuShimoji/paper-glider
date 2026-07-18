import { describe, expect, test } from 'vitest';
import { FlightDynamics } from '../../src/game/FlightDynamics';
import { GameModel } from '../../src/game/GameModel';
import { RingPathPlanner } from '../../src/game/simulation/RingPath';

function replay(seed: number) {
  const planner = new RingPathPlanner(seed);
  const model = new GameModel(null);
  const dynamics = new FlightDynamics();
  const rooms = Array.from({ length: 14 }, (_, sequence) => planner.planRoom(sequence, 16));
  const rings = rooms.flatMap((room) => room.rings);
  model.start();

  for (const [ringIndex, ring] of rings.entries()) {
    let elapsed = 0;
    while (elapsed < ring.envelope.travelTime) {
      const delta = Math.min(1 / 120, ring.envelope.travelTime - elapsed);
      const folding = ringIndex % 3 === 1 && elapsed > ring.envelope.reactionReserve;
      model.update(delta, folding);
      const snapshot = model.getSnapshot();
      dynamics.update(delta, ring.x, ring.y, snapshot.wingFold, snapshot.speedMultiplier);
      elapsed += delta;
    }
    model.collectRing(ring.challengeBonus);
    if (ringIndex % 4 === 3) model.unfoldWings();
  }

  return {
    route: rings.map((ring) => [ring.x, ring.y, ring.z, ring.challengeBonus]),
    model: model.getSnapshot(),
    flight: dynamics.getSnapshot(),
  };
}

describe('deterministic run replay', () => {
  test('same seed, input sequence, and time steps produce the same complete run', () => {
    expect(replay(0x1badb002)).toEqual(replay(0x1badb002));
  });

  test('a different seed changes the route and resulting flight state', () => {
    const first = replay(0x1badb002);
    const other = replay(0x1badb003);
    expect(other.route).not.toEqual(first.route);
    expect(other.flight).not.toEqual(first.flight);
  });
});
