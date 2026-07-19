import { expect, test } from '@playwright/test';

interface DebugSnapshot {
  mode: 'ready' | 'playing' | 'gameover';
  score: number;
  speedMultiplier: number;
  wingFold: number;
  distance: number;
  routeBonus: number;
  player: { x: number; y: number; velocityX: number; velocityY: number };
  nextRing: { x: number; y: number; z: number; travelTime: number } | null;
  runSeed: string;
  visibilityPaused: boolean;
  elapsed: number;
  lastDeltaSeconds: number;
  asset: {
    status: 'loaded' | 'procedural-fallback';
    failureCode: string | null;
    fetchCount: number;
    parseCount: number;
    cloneCount: number;
  };
  cleanLine: {
    phase: 'inactive' | 'approach' | 'commit' | 'recovery';
    commitSequence: number | null;
    commitRingCollected: boolean;
    colliderContact: boolean;
    crashed: boolean;
    lastResolvedCommitSequence: number | null;
    resultVisible: boolean;
    resultRemainingSeconds: number;
    resultSerial: number;
  };
  rooms: Array<{
    sequence: number;
    archetype: 'procedural' | 'archive-gate';
    z: number;
    colliderLabels: string[];
    encounterPhase: 'none' | 'approach' | 'commit' | 'recovery';
    encounterCommitSequence: number | null;
    cueCount: number;
    rings: Array<{
      x: number;
      y: number;
      z: number;
      collected: boolean;
      encounterPhase: 'none' | 'approach' | 'commit' | 'recovery';
    }>;
  }>;
}

const FLIGHT_LINE_SEED = '1BADB068';
const FLIGHT_LINE_APPROACH = 3;
const FLIGHT_LINE_COMMIT = 4;
const FLIGHT_LINE_RECOVERY = 5;

async function snapshot(page: import('@playwright/test').Page): Promise<DebugSnapshot> {
  return page.evaluate(() => {
    if (!window.__paperGliderDebug) throw new Error('Debug API was not installed.');
    return window.__paperGliderDebug.getSnapshot();
  });
}

function collectRuntimeErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function startFlight(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'Take flight' }).click({ force: true });
  await expect.poll(async () => (await snapshot(page)).mode).toBe('playing');
}

async function gotoFlightLine(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(`?seed=${FLIGHT_LINE_SEED}`);
  await expect(page.locator('.start-overlay')).toBeVisible({ timeout: 8_000 });
  await expect.poll(async () => (await snapshot(page)).asset.status).toBe('loaded');
}

async function prepareArchiveGateVisual(
  page: import('@playwright/test').Page,
  options: { colliders?: boolean; recycled?: boolean } = {},
): Promise<void> {
  await page.evaluate(({ colliders, recycled }) => {
    const debug = window.__paperGliderDebug;
    if (!debug) throw new Error('Debug API was not installed.');
    debug.restartWithSeed('1BADB068');
    if (recycled) debug.advanceRoomsForTest(180);
    const sequence = recycled ? 13 : 4;
    if (recycled) {
      for (const room of debug.getSnapshot().rooms) {
        if (room.sequence !== sequence) debug.setRoomPositionForTest(room.sequence, -90 - room.sequence * 18);
      }
    }
    debug.setRoomPositionForTest(sequence, -7.2);
    const room = debug.getSnapshot().rooms.find((candidate) => candidate.sequence === sequence);
    const ring = room?.rings[0];
    if (ring) debug.setFlightStateForTest(ring.x, ring.y);
    debug.setColliderDebugVisible(Boolean(colliders));
    debug.setVisibilityForTest(true);
  }, options);
  await page.waitForTimeout(120);
}

async function enterFlightLinePhase(
  page: import('@playwright/test').Page,
  phase: 'approach' | 'commit' | 'recovery',
): Promise<void> {
  await page.evaluate(({ phase, approachSequence, commitSequence, recoverySequence }) => {
    const debug = window.__paperGliderDebug;
    if (!debug) throw new Error('Debug API was not installed.');
    const rooms = debug.getSnapshot().rooms;
    const sequence = phase === 'approach'
      ? approachSequence
      : phase === 'commit'
        ? commitSequence
        : recoverySequence;
    const room = rooms.find((candidate) => candidate.sequence === sequence);
    const ring = room?.rings[0];
    if (!room || !ring) throw new Error(`${phase} room or ring was unavailable.`);

    for (const candidate of rooms) {
      if (![approachSequence, commitSequence, recoverySequence].includes(candidate.sequence)) {
        debug.setRoomPositionForTest(candidate.sequence, -120 - candidate.sequence * 18);
      }
    }

    const capturePosition = 0.62 - ring.z - 0.35;
    debug.setRoomPositionForTest(approachSequence, phase === 'approach' ? capturePosition : 18);
    debug.setRoomPositionForTest(commitSequence, phase === 'commit' ? capturePosition : phase === 'approach' ? -18 : 18);
    debug.setRoomPositionForTest(recoverySequence, phase === 'recovery' ? capturePosition : -36);
    debug.setFlightStateForTest(ring.x, ring.y);
  }, {
    phase,
    approachSequence: FLIGHT_LINE_APPROACH,
    commitSequence: FLIGHT_LINE_COMMIT,
    recoverySequence: FLIGHT_LINE_RECOVERY,
  });
  await expect.poll(async () => (await snapshot(page)).cleanLine.phase).toBe(phase);
}

async function completeCleanLine(page: import('@playwright/test').Page): Promise<void> {
  await enterFlightLinePhase(page, 'approach');
  await expect.poll(async () => (await snapshot(page)).score).toBeGreaterThanOrEqual(1);
  await enterFlightLinePhase(page, 'commit');
  await expect.poll(async () => (await snapshot(page)).cleanLine.commitRingCollected).toBe(true);
  await enterFlightLinePhase(page, 'recovery');
  await expect.poll(async () => (await snapshot(page)).score).toBeGreaterThanOrEqual(3);
  await page.evaluate((recoverySequence) => {
    window.__paperGliderDebug?.setRoomPositionForTest(recoverySequence, 10);
  }, FLIGHT_LINE_RECOVERY);
  await expect.poll(async () => (await snapshot(page)).cleanLine.resultVisible).toBe(true);
}

async function prepareFlightLineVisual(
  page: import('@playwright/test').Page,
  phase: 'approach' | 'commit' | 'recovery',
): Promise<void> {
  await page.evaluate(({ phase, approachSequence, commitSequence, recoverySequence }) => {
    const debug = window.__paperGliderDebug;
    if (!debug) throw new Error('Debug API was not installed.');
    debug.restartWithSeed('1BADB068');
    const rooms = debug.getSnapshot().rooms;
    const sequence = phase === 'approach'
      ? approachSequence
      : phase === 'commit'
        ? commitSequence
        : recoverySequence;
    const room = rooms.find((candidate) => candidate.sequence === sequence);
    const ring = room?.rings[0];
    if (!ring) throw new Error(`${phase} visual ring was unavailable.`);
    if (phase === 'approach') {
      debug.setRoomPositionForTest(approachSequence, -7.2);
      debug.setRoomPositionForTest(commitSequence, -25.2);
      debug.setRoomPositionForTest(recoverySequence, -43.2);
    } else if (phase === 'commit') {
      debug.setRoomPositionForTest(approachSequence, 10.8);
      debug.setRoomPositionForTest(commitSequence, -7.2);
      debug.setRoomPositionForTest(recoverySequence, -25.2);
    } else {
      debug.setRoomPositionForTest(approachSequence, 28.8);
      debug.setRoomPositionForTest(commitSequence, 10.8);
      debug.setRoomPositionForTest(recoverySequence, -7.2);
    }
    debug.setFlightStateForTest(ring.x, ring.y);
    debug.setVisibilityForTest(true);
  }, {
    phase,
    approachSequence: FLIGHT_LINE_APPROACH,
    commitSequence: FLIGHT_LINE_COMMIT,
    recoverySequence: FLIGHT_LINE_RECOVERY,
  });
  await page.waitForTimeout(120);
}

async function pointerDown(
  page: import('@playwright/test').Page,
  pointerId: number,
): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('Viewport is unavailable.');
  await page.locator('.game-canvas').dispatchEvent('pointerdown', {
    pointerId,
    pointerType: 'mouse',
    button: 0,
    buttons: 1,
    clientX: viewport.width / 2,
    clientY: viewport.height / 2,
  });
}

async function pointerUp(page: import('@playwright/test').Page, pointerId: number): Promise<void> {
  await page.evaluate((id) => {
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, pointerType: 'mouse' }));
  }, pointerId);
}

async function setDocumentHidden(page: import('@playwright/test').Page, hidden: boolean): Promise<void> {
  await page.evaluate((nextHidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: nextHidden });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('?seed=1BADB002');
  await expect(page.locator('.start-overlay')).toBeVisible();
  await page.waitForTimeout(350);
});

test('starts, tucks, double-opens, collects a ring, crashes, and restarts', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await startFlight(page);
  await expect.poll(
    async () => page.evaluate(() => {
      window.__paperGliderDebug?.aimAtNextRing();
      return window.__paperGliderDebug?.getSnapshot().score ?? 0;
    }),
    { timeout: 12_000 },
  ).toBeGreaterThan(0);

  await page.evaluate(() => window.__paperGliderDebug?.restartWithSeed('1BADB002'));
  await pointerDown(page, 41);
  await expect.poll(async () => (await snapshot(page)).wingFold).toBeGreaterThan(0.14);
  const tucked = (await snapshot(page)).wingFold;
  await pointerUp(page, 41);
  await page.waitForTimeout(460);
  const canvas = page.locator('.game-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Game canvas has no bounds.');
  await canvas.dblclick({
    force: true,
    position: { x: box.width / 2, y: box.height / 2 },
  });
  await expect.poll(async () => (await snapshot(page)).wingFold).toBeLessThan(tucked);

  await page.evaluate(() => window.__paperGliderDebug?.aimAtWall());
  await expect.poll(async () => (await snapshot(page)).mode, { timeout: 5_000 }).toBe('gameover');
  await expect(page.getByRole('button', { name: 'Fly again' })).toBeVisible();
  await page.getByRole('button', { name: 'Fly again' }).click();
  await expect.poll(async () => (await snapshot(page)).mode).toBe('playing');
  expect((await snapshot(page)).score).toBe(0);
  expect(errors).toEqual([]);
});

test('freezes all run state while hidden and rebases the first resumed frame', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await startFlight(page);
  await page.evaluate(() => window.__paperGliderDebug?.aimAtNextRing());
  await page.waitForTimeout(250);
  await setDocumentHidden(page, true);
  const paused = await snapshot(page);
  expect(paused.visibilityPaused).toBe(true);
  await page.waitForTimeout(750);
  const stillPaused = await snapshot(page);
  expect(stillPaused.distance).toBe(paused.distance);
  expect(stillPaused.elapsed).toBe(paused.elapsed);
  expect(stillPaused.score).toBe(paused.score);
  expect(stillPaused.player).toEqual(paused.player);
  expect(stillPaused.nextRing).toEqual(paused.nextRing);

  await setDocumentHidden(page, false);
  await page.waitForTimeout(80);
  const afterResume = await snapshot(page);
  expect(afterResume.lastDeltaSeconds).toBeLessThanOrEqual(0.05);
  const resumedSimulationTime = afterResume.elapsed - paused.elapsed;
  expect(afterResume.distance - paused.distance).toBeLessThanOrEqual(
    resumedSimulationTime * 30 + 0.01,
  );
  expect(afterResume.score).toBe(paused.score);
  expect(afterResume.mode).toBe('playing');
  expect(errors).toEqual([]);
});

test('replays a named seed and reaches the high-speed wing state', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  expect((await snapshot(page)).runSeed).toBe('1BADB002');
  const restarted = await page.evaluate(() => window.__paperGliderDebug?.restartWithSeed('1BADB002'));
  expect(restarted).toBe(true);
  await pointerDown(page, 51);
  await expect.poll(
    async () => page.evaluate(() => {
      window.__paperGliderDebug?.aimAtNextRing();
      return window.__paperGliderDebug?.getSnapshot().speedMultiplier ?? 1;
    }),
    { timeout: 12_000 },
  ).toBeGreaterThan(1.3);
  await pointerUp(page, 51);
  const highSpeed = await snapshot(page);
  expect(highSpeed.runSeed).toBe('1BADB002');
  expect(highSpeed.nextRing?.travelTime).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('loads Archive Gate once and preserves deterministic room and ring replay', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await gotoFlightLine(page);
  const first = await snapshot(page);
  expect(first.asset).toEqual({
    status: 'loaded',
    failureCode: null,
    fetchCount: 2,
    parseCount: 1,
    cloneCount: 1,
  });
  expect(first.rooms[FLIGHT_LINE_APPROACH]).toMatchObject({
    sequence: FLIGHT_LINE_APPROACH,
    archetype: 'procedural',
    encounterPhase: 'approach',
    encounterCommitSequence: FLIGHT_LINE_COMMIT,
    cueCount: 2,
  });
  expect(first.rooms[FLIGHT_LINE_COMMIT]).toMatchObject({
    sequence: FLIGHT_LINE_COMMIT,
    archetype: 'archive-gate',
    encounterPhase: 'commit',
    encounterCommitSequence: FLIGHT_LINE_COMMIT,
    colliderLabels: [
      'archive gate left pier',
      'archive gate right pier',
      'archive gate top beam',
    ],
  });
  expect(first.rooms[FLIGHT_LINE_RECOVERY]).toMatchObject({
    sequence: FLIGHT_LINE_RECOVERY,
    archetype: 'procedural',
    encounterPhase: 'recovery',
    encounterCommitSequence: FLIGHT_LINE_COMMIT,
    cueCount: 2,
  });
  const firstRoute = first.rooms.map((room) => ({
    sequence: room.sequence,
    archetype: room.archetype,
    rings: room.rings.map(({ x, y, z }) => ({ x, y, z })),
  }));
  await page.evaluate(() => window.__paperGliderDebug?.restartWithSeed('1BADB068'));
  const replay = await snapshot(page);
  expect(replay.rooms.map((room) => ({
    sequence: room.sequence,
    archetype: room.archetype,
    rings: room.rings.map(({ x, y, z }) => ({ x, y, z })),
  }))).toEqual(firstRoute);
  expect(replay.asset.fetchCount).toBe(2);
  expect(replay.asset.parseCount).toBe(1);
  expect(replay.asset.cloneCount).toBe(2);
  expect(errors).toEqual([]);
});

test('completes Approach, Gate Commit, Recovery, and one visibility-safe CLEAN LINE', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await gotoFlightLine(page);
  await startFlight(page);
  await completeCleanLine(page);
  const completed = await snapshot(page);
  expect(completed.cleanLine).toMatchObject({
    phase: 'inactive',
    lastResolvedCommitSequence: FLIGHT_LINE_COMMIT,
    resultVisible: true,
    resultSerial: 1,
  });
  await expect(page.locator('.clean-line-result')).toContainText('CLEAN LINE');
  await expect(page.locator('.clean-line-result')).toBeVisible();

  await setDocumentHidden(page, true);
  const paused = await snapshot(page);
  await page.waitForTimeout(700);
  const stillPaused = await snapshot(page);
  expect(stillPaused.cleanLine.resultRemainingSeconds).toBe(paused.cleanLine.resultRemainingSeconds);
  expect(stillPaused.cleanLine.resultSerial).toBe(1);
  await setDocumentHidden(page, false);
  await page.waitForTimeout(100);
  expect((await snapshot(page)).cleanLine.resultRemainingSeconds).toBeLessThan(
    paused.cleanLine.resultRemainingSeconds,
  );

  await page.evaluate((recoverySequence) => {
    window.__paperGliderDebug?.setRoomPositionForTest(recoverySequence, 10);
  }, FLIGHT_LINE_RECOVERY);
  expect((await snapshot(page)).cleanLine.resultSerial).toBe(1);
  await page.evaluate(() => window.__paperGliderDebug?.restartWithSeed('1BADB068'));
  expect((await snapshot(page)).cleanLine).toMatchObject({
    phase: 'inactive',
    resultVisible: false,
    resultSerial: 0,
  });
  expect(errors).toEqual([]);
});

test('flies the central passage and collides with both manifest pier and top beam', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await gotoFlightLine(page);
  await startFlight(page);
  await enterFlightLinePhase(page, 'approach');
  await enterFlightLinePhase(page, 'commit');
  await expect.poll(async () => (await snapshot(page)).cleanLine.commitRingCollected).toBe(true);
  expect((await snapshot(page)).mode).toBe('playing');

  await page.evaluate((commitSequence) => {
    const debug = window.__paperGliderDebug;
    debug?.setFlightStateForTest(-3.65, 1.68);
    debug?.setRoomPositionForTest(commitSequence, 0.62);
  }, FLIGHT_LINE_COMMIT);
  await expect.poll(async () => (await snapshot(page)).mode).toBe('gameover');
  await expect(page.locator('.gameover-copy')).toHaveText(/archive gate left pier/i);
  expect((await snapshot(page)).cleanLine).toMatchObject({
    colliderContact: true,
    crashed: true,
    resultVisible: false,
    resultSerial: 0,
  });

  await page.evaluate(() => {
    const debug = window.__paperGliderDebug;
    debug?.restartWithSeed('1BADB068');
  });
  await enterFlightLinePhase(page, 'approach');
  await enterFlightLinePhase(page, 'commit');
  await page.evaluate((commitSequence) => {
    const debug = window.__paperGliderDebug;
    debug?.setFlightStateForTest(0, 4.13);
    debug?.setRoomPositionForTest(commitSequence, 0.62);
  }, FLIGHT_LINE_COMMIT);
  await expect.poll(async () => (await snapshot(page)).mode).toBe('gameover');
  await expect(page.locator('.gameover-copy')).toHaveText(/archive gate top beam/i);
  expect((await snapshot(page)).cleanLine.resultSerial).toBe(0);
  expect(errors).toEqual([]);
});

test('recycles the nine-room pool and recreates Archive Gate without refetch or reparse', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await gotoFlightLine(page);
  await page.evaluate(() => window.__paperGliderDebug?.advanceRoomsForTest(180));
  const recycled = await snapshot(page);
  expect(recycled.rooms.every((room) => room.sequence >= 9)).toBe(true);
  expect(recycled.rooms.some((room) => room.sequence === 13 && room.archetype === 'archive-gate')).toBe(true);
  expect(recycled.asset).toEqual({
    status: 'loaded',
    failureCode: null,
    fetchCount: 2,
    parseCount: 1,
    cloneCount: 2,
  });
  expect(errors).toEqual([]);
});

test('times out asset preload and starts the procedural fallback', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'One real-browser timeout proof is sufficient.');
  const errors = collectRuntimeErrors(page);
  await page.route('**/paper-glider-archive-gate.manifest.json', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 6_000));
    try {
      await route.continue();
    } catch {
      // The AbortController intentionally cancels this delayed request at five seconds.
    }
  });
  await page.goto(`?seed=${FLIGHT_LINE_SEED}`);
  await expect(page.locator('.start-overlay')).toBeVisible({ timeout: 8_000 });
  const fallback = await snapshot(page);
  expect(fallback.asset).toEqual({
    status: 'procedural-fallback',
    failureCode: 'timeout',
    fetchCount: 0,
    parseCount: 0,
    cloneCount: 0,
  });
  expect(fallback.rooms.every((room) => room.archetype === 'procedural')).toBe(true);
  expect(fallback.rooms.every((room) => room.encounterPhase === 'none')).toBe(true);
  expect(fallback.cleanLine.phase).toBe('inactive');
  await startFlight(page);
  expect(errors).toEqual([]);
});

test('@visual fixed gameplay frame', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  // Headless Chromium can perform one early software-WebGL context recycle. Reset only after it settles.
  await page.waitForTimeout(1_200);
  await page.evaluate(() => window.__paperGliderDebug?.prepareVisualForTest());
  await page.waitForTimeout(120);
  await expect(page.locator('.hud')).toBeVisible();
  const captured = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  expect(captured).toMatchSnapshot('gameplay.png', {
    threshold: 0.22,
    maxDiffPixelRatio: 0.012,
  });
  expect(errors).toEqual([]);
});

test('@visual Archive Gate flight camera and mobile portrait', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await gotoFlightLine(page);
  await prepareArchiveGateVisual(page);
  await expect(page.locator('.hud')).toBeVisible();
  const captured = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  expect(captured).toMatchSnapshot('archive-gate-flight.png', {
    threshold: 0.22,
    maxDiffPixelRatio: 0.012,
  });
  expect(errors).toEqual([]);
});

test('@visual Archive Gate collider and ring-clearance overlay', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Collider evidence uses the desktop camera.');
  const errors = collectRuntimeErrors(page);
  await gotoFlightLine(page);
  await prepareArchiveGateVisual(page, { colliders: true });
  const captured = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  expect(captured).toMatchSnapshot('archive-gate-colliders.png', {
    threshold: 0.22,
    maxDiffPixelRatio: 0.012,
  });
  expect(errors).toEqual([]);
});

test('@visual Archive Gate after nine-room recycling', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'One recycled visual proof is sufficient.');
  const errors = collectRuntimeErrors(page);
  await gotoFlightLine(page);
  await prepareArchiveGateVisual(page, { recycled: true });
  const recycled = await snapshot(page);
  expect(recycled.rooms.every((room) => room.sequence >= 9)).toBe(true);
  const captured = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  expect(captured).toMatchSnapshot('archive-gate-recycled.png', {
    threshold: 0.22,
    maxDiffPixelRatio: 0.012,
  });
  expect(errors).toEqual([]);
});

test('@visual Flight Line Approach cue and mobile portrait', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await gotoFlightLine(page);
  await prepareFlightLineVisual(page, 'approach');
  const approach = (await snapshot(page)).rooms.find((room) => room.sequence === FLIGHT_LINE_APPROACH);
  expect(approach).toMatchObject({ encounterPhase: 'approach', cueCount: 2 });
  const captured = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  expect(captured).toMatchSnapshot('flight-line-approach.png', {
    threshold: 0.22,
    maxDiffPixelRatio: 0.012,
  });
  expect(errors).toEqual([]);
});

test('@visual Flight Line Recovery path', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Recovery evidence uses the desktop camera.');
  const errors = collectRuntimeErrors(page);
  await gotoFlightLine(page);
  await prepareFlightLineVisual(page, 'recovery');
  const recovery = (await snapshot(page)).rooms.find((room) => room.sequence === FLIGHT_LINE_RECOVERY);
  expect(recovery).toMatchObject({ encounterPhase: 'recovery', cueCount: 2 });
  const captured = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  expect(captured).toMatchSnapshot('flight-line-recovery.png', {
    threshold: 0.22,
    maxDiffPixelRatio: 0.012,
  });
  expect(errors).toEqual([]);
});

test('@visual Flight Line CLEAN LINE result and mobile portrait', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await gotoFlightLine(page);
  await page.evaluate(() => window.__paperGliderDebug?.prepareCleanLineVisualForTest());
  await page.waitForTimeout(120);
  expect((await snapshot(page)).cleanLine).toMatchObject({ resultVisible: true, resultSerial: 1 });
  expect((await snapshot(page)).score).toBe(3);
  await expect(page.locator('.clean-line-result')).toBeVisible();
  const captured = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  expect(captured).toMatchSnapshot('flight-line-clean.png', {
    threshold: 0.22,
    maxDiffPixelRatio: 0.012,
  });
  expect(errors).toEqual([]);
});

test('@visual procedural fallback remains playable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'One procedural fallback visual proof is sufficient.');
  const errors = collectRuntimeErrors(page);
  await page.route('**/paper-glider-archive-gate.manifest.json', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '{}',
  }));
  await page.goto('?seed=1BADB00F');
  await expect(page.locator('.start-overlay')).toBeVisible({ timeout: 8_000 });
  await expect.poll(async () => (await snapshot(page)).asset.status).toBe('procedural-fallback');
  await page.evaluate(() => {
    window.__paperGliderDebug?.prepareVisualForTest();
    window.__paperGliderDebug?.setRoomPositionForTest(0, -7.2);
  });
  await page.waitForTimeout(120);
  const fallback = await snapshot(page);
  expect(fallback.rooms.every((room) => room.archetype === 'procedural')).toBe(true);
  const captured = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  expect(captured).toMatchSnapshot('procedural-fallback.png', {
    threshold: 0.22,
    maxDiffPixelRatio: 0.012,
  });
  expect(errors).toEqual([]);
});
