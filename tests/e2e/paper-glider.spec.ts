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
  flightBook: {
    persistent: {
      version: 1;
      completedGoalIds: Array<'ring-route' | 'clean-archive' | 'room-tour'>;
      unlockedStyleIds: Array<'default' | 'amber-kraft' | 'blueprint-fold' | 'sage-ledger'>;
      selectedStyleId: 'default' | 'amber-kraft' | 'blueprint-fold' | 'sage-ledger';
    };
    run: {
      runId: string | null;
      seed: number | null;
      runSequence: number;
      status: 'idle' | 'active' | 'crashed' | 'ended' | 'restarted';
      ringCount: number;
      lineBonusCount: number;
      cleanLineCount: number;
      families: Record<'offset-gallery' | 'split-loft', {
        stage: 'not-entered' | 'entered' | 'guided' | 'exited';
        roomSequence: number | null;
      }>;
      processedEventIds: string[];
      newlyUnlockedStyleIds: Array<'default' | 'amber-kraft' | 'blueprint-fold' | 'sage-ledger'>;
    };
    notification: {
      styleId: 'amber-kraft' | 'blueprint-fold' | 'sage-ledger' | null;
      remainingSeconds: number;
    };
  };
  resources: {
    proceduralPrimitiveMeshes: number;
    proceduralPrimitiveGeometries: number;
    proceduralPrimitiveMaterials: number;
  };
  rooms: Array<{
    sequence: number;
    archetype: 'procedural' | 'archive-gate';
    z: number;
    colliderLabels: string[];
    encounterPhase: 'none' | 'approach' | 'commit' | 'recovery';
    encounterCommitSequence: number | null;
    cueCount: number;
    familyId: 'classic-room' | 'offset-gallery' | 'split-loft';
    familyVariant: 'classic' | 'left-lane' | 'right-lane' | 'upper-lane' | 'lower-lane';
    familyLabel: string;
    familyPrimitiveCount: number;
    safeLane: {
      axis: 'horizontal' | 'vertical';
      x: number;
      y: number;
      halfWidth: number;
      halfHeight: number;
    } | null;
    reaction: {
      obstacleZ: number;
      earlyCueDistance: number;
      minimumPreviewDistance: number;
      minimumReactionTimeAtReferenceMaxSpeed: number;
    } | null;
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
const ROOM_SET_SEED = '1BADB000';
const SPLIT_LOFT_SEQUENCE = 2;
const ROOM_SET_ARCHIVE_GATE_SEQUENCE = 8;
const OFFSET_GALLERY_SEQUENCE = 11;
const FLIGHT_BOOK_STORAGE_KEY = 'paperGlider.flightBook.v1';
const FLIGHT_BOOK_FULL_SAVE = {
  version: 1,
  completedGoalIds: ['ring-route', 'clean-archive', 'room-tour'],
  unlockedStyleIds: ['default', 'amber-kraft', 'blueprint-fold', 'sage-ledger'],
  selectedStyleId: 'default',
} as const;

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
  try {
    await expect.poll(
      async () => (await snapshot(page)).asset.status,
      { timeout: 8_000 },
    ).toBe('loaded');
  } catch {
    // A long software-WebGL campaign can recycle one boot. Reload once before treating it as an asset failure.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.start-overlay')).toBeVisible({ timeout: 8_000 });
    await expect.poll(
      async () => (await snapshot(page)).asset.status,
      { timeout: 8_000 },
    ).toBe('loaded');
  }
}

async function gotoRoomSet(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(`?seed=${ROOM_SET_SEED}`);
  await expect(page.locator('.start-overlay')).toBeVisible({ timeout: 8_000 });
  await expect.poll(async () => (await snapshot(page)).asset.status).toBe('loaded');
}

async function setFlightBookSave(
  page: import('@playwright/test').Page,
  value: unknown,
): Promise<void> {
  await page.evaluate(({ key, serialized }) => {
    window.localStorage.setItem(key, serialized);
  }, { key: FLIGHT_BOOK_STORAGE_KEY, serialized: typeof value === 'string' ? value : JSON.stringify(value) });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.start-overlay')).toBeVisible({ timeout: 8_000 });
  await expect.poll(async () => (await snapshot(page)).asset.status).toBe('loaded');
}

async function selectPersistedStyle(
  page: import('@playwright/test').Page,
  selectedStyleId: 'default' | 'amber-kraft' | 'blueprint-fold' | 'sage-ledger',
): Promise<void> {
  await setFlightBookSave(page, { ...FLIGHT_BOOK_FULL_SAVE, selectedStyleId });
  expect((await snapshot(page)).flightBook.persistent.selectedStyleId).toBe(selectedStyleId);
  await expect(page.locator('#app')).toHaveAttribute('data-flight-book-style', selectedStyleId);
}

async function prepareFamilyVisual(
  page: import('@playwright/test').Page,
  familyId: 'offset-gallery' | 'split-loft',
  colliders = false,
  showFlightBook = false,
): Promise<void> {
  await page.evaluate(({ familyId, colliders, offsetSequence, splitSequence }) => {
    const debug = window.__paperGliderDebug;
    if (!debug) throw new Error('Debug API was not installed.');
    debug.restartWithSeed('1BADB000');
    if (familyId === 'offset-gallery') debug.advanceRoomsForTest(72);
    debug.normalizeVisualForTest();
    const sequence = familyId === 'offset-gallery' ? offsetSequence : splitSequence;
    const rooms = debug.getSnapshot().rooms;
    const room = rooms.find((candidate) => candidate.sequence === sequence);
    if (!room || room.familyId !== familyId || room.rings.length < 2) {
      throw new Error(`${familyId} visual room was unavailable.`);
    }
    for (const candidate of rooms) {
      if (candidate.sequence !== sequence) {
        debug.setRoomPositionForTest(candidate.sequence, -120 - candidate.sequence * 18);
      }
    }
    debug.setRoomPositionForTest(sequence, -7.2);
    debug.setFlightStateForTest(room.rings[0].x, room.rings[0].y);
    debug.setColliderDebugVisible(colliders);
    debug.setVisibilityForTest(true);
  }, {
    familyId,
    colliders,
    offsetSequence: OFFSET_GALLERY_SEQUENCE,
    splitSequence: SPLIT_LOFT_SEQUENCE,
  });
  if (!showFlightBook) await hideFlightBookHudForLegacyVisual(page);
  await page.waitForTimeout(120);
}

async function prepareArchiveGateVisual(
  page: import('@playwright/test').Page,
  options: { colliders?: boolean; recycled?: boolean } = {},
  showFlightBook = false,
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
  if (!showFlightBook) await hideFlightBookHudForLegacyVisual(page);
  await page.waitForTimeout(120);
}

async function enterFlightLinePhase(
  page: import('@playwright/test').Page,
  phase: 'approach' | 'commit' | 'recovery',
): Promise<void> {
  await page.evaluate(({ phase, approachSequence, commitSequence, recoverySequence }) => {
    const debug = window.__paperGliderDebug;
    if (!debug) throw new Error('Debug API was not installed.');
    debug.setVisibilityForTest(true);
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
  await page.evaluate(() => window.__paperGliderDebug?.setVisibilityForTest(false));
  await expect.poll(async () => (await snapshot(page)).cleanLine.phase).toBe(phase);
  await page.evaluate(() => window.__paperGliderDebug?.setVisibilityForTest(true));
}

async function completeCleanLine(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate((seed) => {
    const debug = window.__paperGliderDebug;
    if (!debug) throw new Error('Debug API was not installed.');
    debug.setVisibilityForTest(true);
    debug.restartWithSeed(seed);
  }, FLIGHT_LINE_SEED);
  await enterFlightLinePhase(page, 'approach');
  await expect.poll(async () => (await snapshot(page)).score).toBeGreaterThanOrEqual(1);
  await enterFlightLinePhase(page, 'commit');
  await expect.poll(async () => (await snapshot(page)).cleanLine.commitRingCollected).toBe(true);
  await enterFlightLinePhase(page, 'recovery');
  await expect.poll(async () => (await snapshot(page)).score).toBeGreaterThanOrEqual(3);
  await page.evaluate((recoverySequence) => {
    const debug = window.__paperGliderDebug;
    debug?.setVisibilityForTest(true);
    debug?.setRoomPositionForTest(recoverySequence, 10);
  }, FLIGHT_LINE_RECOVERY);
  await page.evaluate(() => window.__paperGliderDebug?.setVisibilityForTest(false));
  await expect.poll(async () => (await snapshot(page)).cleanLine.resultVisible).toBe(true);
  await page.evaluate(() => window.__paperGliderDebug?.setVisibilityForTest(true));
}

async function completeFamilyRoom(
  page: import('@playwright/test').Page,
  familyId: 'offset-gallery' | 'split-loft',
  sequence: number,
  isolate = false,
): Promise<void> {
  await page.evaluate(({ familyId, sequence, isolate }) => {
    const debug = window.__paperGliderDebug;
    if (!debug) throw new Error('Debug API was not installed.');
    debug.setVisibilityForTest(false);
    const rooms = debug.getSnapshot().rooms;
    const room = rooms.find((candidate) => candidate.sequence === sequence);
    const guide = room?.rings[0];
    if (!room || room.familyId !== familyId || !guide) {
      throw new Error(`${familyId} room was unavailable.`);
    }
    if (isolate) {
      for (const candidate of rooms) {
        if (candidate.sequence !== sequence) {
          debug.setRoomPositionForTest(candidate.sequence, -120 - candidate.sequence * 18);
        }
      }
    }
    debug.setRoomPositionForTest(sequence, 0.62 - guide.z - 0.35);
    debug.setFlightStateForTest(guide.x, guide.y);
  }, { familyId, sequence, isolate });
  await expect.poll(
    async () => (await snapshot(page)).flightBook.run.families[familyId].stage,
  ).toBe('guided');
  await page.evaluate((roomSequence) => {
    window.__paperGliderDebug?.setRoomPositionForTest(roomSequence, 10);
  }, sequence);
  await expect.poll(
    async () => (await snapshot(page)).flightBook.run.families[familyId].stage,
  ).toBe('exited');
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
  // The production hint expires after 5.2 s; keep the intended visual fixture stable on slow CI runners.
  await page.locator('.controls-hint').evaluate((element) => element.classList.add('is-visible'));
  await hideFlightBookHudForLegacyVisual(page);
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

async function captureVisual(
  page: import('@playwright/test').Page,
  name: string,
): Promise<void> {
  const captured = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  expect(captured).toMatchSnapshot(name, {
    threshold: 0.22,
    maxDiffPixelRatio: 0.012,
  });
}

async function hideFlightBookHudForLegacyVisual(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.locator('.flight-book-live').evaluate((element) => {
    element.style.visibility = 'hidden';
  });
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('?seed=1BADB002');
  const startOverlay = page.locator('.start-overlay');
  try {
    await expect(startOverlay).toBeVisible({ timeout: 8_000 });
  } catch {
    // Software WebGL can recycle one context during a long Chromium campaign.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(startOverlay).toBeVisible({ timeout: 8_000 });
  }
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
  expect(stillPaused.flightBook).toEqual(paused.flightBook);

  await setDocumentHidden(page, false);
  await page.waitForTimeout(80);
  const afterResume = await snapshot(page);
  expect(afterResume.lastDeltaSeconds).toBeLessThanOrEqual(0.05);
  const resumedSimulationTime = afterResume.elapsed - paused.elapsed;
  expect(afterResume.distance - paused.distance).toBeLessThanOrEqual(
    resumedSimulationTime * 30 + 0.01,
  );
  expect(afterResume.score).toBe(paused.score);
  expect(afterResume.flightBook.run.ringCount).toBe(paused.flightBook.run.ringCount);
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

test('unlocks Blueprint Fold through the real CLEAN LINE route and persists selection', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'One real runtime unlock route is sufficient.');
  const errors = collectRuntimeErrors(page);
  await gotoFlightLine(page);
  await startFlight(page);
  await completeCleanLine(page);
  const unlocked = await snapshot(page);
  expect(unlocked.flightBook.persistent.completedGoalIds).toContain('clean-archive');
  expect(unlocked.flightBook.persistent.unlockedStyleIds).toContain('blueprint-fold');
  expect(unlocked.flightBook.run.cleanLineCount).toBe(1);
  await expect(page.locator('.flight-book-toast')).toContainText('Blueprint Fold');

  await page.evaluate(() => window.__paperGliderDebug?.setVisibilityForTest(false));
  await page.evaluate(() => window.__paperGliderDebug?.aimAtWall());
  await expect.poll(async () => (await snapshot(page)).mode, { timeout: 6_000 }).toBe('gameover');
  await expect(page.locator('.gameover-overlay')).toBeVisible();
  await expect(page.locator('.gameover-overlay .flight-book-run-unlocks')).toContainText('Blueprint Fold');
  const blueprint = page.locator(
    '.gameover-overlay .flight-book-style-button[data-flight-book-style="blueprint-fold"]',
  );
  await expect(blueprint).toBeEnabled();
  await blueprint.click();
  await expect(page.locator('#app')).toHaveAttribute('data-flight-book-style', 'blueprint-fold');

  await page.getByRole('button', { name: 'Fly again' }).click();
  await expect.poll(async () => (await snapshot(page)).mode).toBe('playing');
  expect((await snapshot(page)).flightBook.persistent.selectedStyleId).toBe('blueprint-fold');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.start-overlay')).toBeVisible({ timeout: 8_000 });
  expect((await snapshot(page)).flightBook.persistent).toMatchObject({
    completedGoalIds: ['clean-archive'],
    unlockedStyleIds: ['default', 'blueprint-fold'],
    selectedStyleId: 'blueprint-fold',
  });
  await expect(page.locator('#app')).toHaveAttribute('data-flight-book-style', 'blueprint-fold');
  expect(errors).toEqual([]);
});

test('recovers corrupt saves, rejects locked styles, and renders all completed goals', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Storage contract is viewport-independent.');
  const errors = collectRuntimeErrors(page);
  await setFlightBookSave(page, '{broken');
  expect((await snapshot(page)).flightBook.persistent).toEqual({
    version: 1,
    completedGoalIds: [],
    unlockedStyleIds: ['default'],
    selectedStyleId: 'default',
  });
  await expect(page.locator('.start-overlay .flight-book-style-button:disabled')).toHaveCount(3);

  await setFlightBookSave(page, {
    version: 1,
    completedGoalIds: [],
    unlockedStyleIds: ['default', 'sage-ledger'],
    selectedStyleId: 'sage-ledger',
  });
  await expect(page.locator('#app')).toHaveAttribute('data-flight-book-style', 'default');
  await page.locator(
    '.start-overlay .flight-book-style-button[data-flight-book-style="sage-ledger"]',
  ).evaluate((button: HTMLButtonElement) => button.click());
  expect((await snapshot(page)).flightBook.persistent.selectedStyleId).toBe('default');

  await setFlightBookSave(page, FLIGHT_BOOK_FULL_SAVE);
  await expect(page.locator('.start-overlay .flight-book-goal.is-complete')).toHaveCount(3);
  await expect(page.locator('.start-overlay .flight-book-style-button:enabled')).toHaveCount(4);
  await page.locator(
    '.start-overlay .flight-book-style-button[data-flight-book-style="amber-kraft"]',
  ).click();
  await expect(page.locator('#app')).toHaveAttribute('data-flight-book-style', 'amber-kraft');
  const persisted = await page.evaluate((key) => window.localStorage.getItem(key), FLIGHT_BOOK_STORAGE_KEY);
  expect(JSON.parse(persisted ?? '{}')).toMatchObject({ selectedStyleId: 'amber-kraft' });
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
    debug?.checkCollisionsForTest();
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
    debug?.checkCollisionsForTest();
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

test('exposes the fixed room-set sequence with both families and Archive Gate', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await gotoRoomSet(page);
  const initial = await snapshot(page);
  expect(initial.runSeed).toBe(ROOM_SET_SEED);
  expect(initial.rooms.find((room) => room.sequence === SPLIT_LOFT_SEQUENCE)).toMatchObject({
    familyId: 'split-loft',
    familyVariant: 'upper-lane',
    encounterPhase: 'none',
  });
  expect(initial.rooms.find((room) => room.sequence === ROOM_SET_ARCHIVE_GATE_SEQUENCE)).toMatchObject({
    archetype: 'archive-gate',
    familyId: 'classic-room',
    encounterPhase: 'commit',
  });
  expect(initial.rooms.find((room) => room.sequence === ROOM_SET_ARCHIVE_GATE_SEQUENCE - 1)).toMatchObject({
    encounterPhase: 'approach',
    familyId: 'classic-room',
  });
  expect(initial.resources).toMatchObject({
    proceduralPrimitiveGeometries: 1,
  });

  await page.evaluate(() => window.__paperGliderDebug?.advanceRoomsForTest(72));
  const recycled = await snapshot(page);
  expect(recycled.rooms.find((room) => room.sequence === ROOM_SET_ARCHIVE_GATE_SEQUENCE + 1)).toMatchObject({
    encounterPhase: 'recovery',
    familyId: 'classic-room',
  });
  expect(recycled.rooms.find((room) => room.sequence === ROOM_SET_ARCHIVE_GATE_SEQUENCE + 2)).toMatchObject({
    familyId: 'classic-room',
  });
  expect(recycled.rooms.find((room) => room.sequence === OFFSET_GALLERY_SEQUENCE)).toMatchObject({
    familyId: 'offset-gallery',
    familyVariant: 'left-lane',
    encounterPhase: 'none',
  });
  expect(recycled.resources.proceduralPrimitiveGeometries).toBeLessThanOrEqual(1);
  expect(recycled.resources.proceduralPrimitiveMaterials).toBeLessThanOrEqual(4);
  expect(errors).toEqual([]);
});

test('records ordered guide-ring exits for both room families in one real run', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'One real room-tour route is sufficient.');
  const errors = collectRuntimeErrors(page);
  await gotoRoomSet(page);
  await startFlight(page);
  await completeFamilyRoom(page, 'split-loft', SPLIT_LOFT_SEQUENCE);
  await page.evaluate(() => window.__paperGliderDebug?.advanceRoomsForTest(72));
  await completeFamilyRoom(page, 'offset-gallery', OFFSET_GALLERY_SEQUENCE, true);
  const completed = await snapshot(page);
  expect(completed.flightBook.run.families).toEqual({
    'offset-gallery': { stage: 'exited', roomSequence: OFFSET_GALLERY_SEQUENCE },
    'split-loft': { stage: 'exited', roomSequence: SPLIT_LOFT_SEQUENCE },
  });
  expect(completed.flightBook.persistent.completedGoalIds).toContain('room-tour');
  expect(completed.flightBook.persistent.unlockedStyleIds).toContain('sage-ledger');
  expect(errors).toEqual([]);
});

for (const familyId of ['offset-gallery', 'split-loft'] as const) {
  test(`${familyId} safe lane passes and planned AABB collides`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'One deterministic collision proof is sufficient.');
    const errors = collectRuntimeErrors(page);
    await gotoRoomSet(page);
    await page.evaluate(({ familyId, offsetSequence, splitSequence }) => {
      const debug = window.__paperGliderDebug;
      if (!debug) throw new Error('Debug API was not installed.');
      debug.restartWithSeed('1BADB000');
      debug.start();
      if (familyId === 'offset-gallery') debug.advanceRoomsForTest(72);
      const sequence = familyId === 'offset-gallery' ? offsetSequence : splitSequence;
      const rooms = debug.getSnapshot().rooms;
      const room = rooms.find((candidate) => candidate.sequence === sequence);
      if (!room?.safeLane || !room.reaction) throw new Error(`${familyId} plan was unavailable.`);
      for (const candidate of rooms) {
        if (candidate.sequence !== sequence) {
          debug.setRoomPositionForTest(candidate.sequence, -120 - candidate.sequence * 18);
        }
      }
      debug.setFlightStateForTest(room.safeLane.x, room.safeLane.y);
      debug.setRoomPositionForTest(sequence, 0.62 - room.reaction.obstacleZ);
      debug.checkCollisionsForTest();
      debug.setVisibilityForTest(true);
    }, { familyId, offsetSequence: OFFSET_GALLERY_SEQUENCE, splitSequence: SPLIT_LOFT_SEQUENCE });
    await page.waitForTimeout(100);
    expect((await snapshot(page)).mode).toBe('playing');
    expect((await snapshot(page)).rooms.some((room) => room.familyId === familyId)).toBe(true);

    await page.evaluate(({ familyId, offsetSequence, splitSequence }) => {
      const debug = window.__paperGliderDebug;
      if (!debug) throw new Error('Debug API was not installed.');
      const sequence = familyId === 'offset-gallery' ? offsetSequence : splitSequence;
      const room = debug.getSnapshot().rooms.find((candidate) => candidate.sequence === sequence);
      if (!room?.safeLane || !room.reaction) throw new Error(`${familyId} plan was unavailable.`);
      const unsafeX = familyId === 'offset-gallery'
        ? -Math.sign(room.safeLane.x) * 3.05
        : 0;
      const unsafeY = familyId === 'split-loft'
        ? (room.familyVariant === 'upper-lane' ? 1 : 5)
        : 2.35;
      debug.setFlightStateForTest(unsafeX, unsafeY);
      debug.setRoomPositionForTest(sequence, 0.62 - room.reaction.obstacleZ);
      debug.checkCollisionsForTest();
    }, { familyId, offsetSequence: OFFSET_GALLERY_SEQUENCE, splitSequence: SPLIT_LOFT_SEQUENCE });
    await expect.poll(async () => (await snapshot(page)).mode).toBe('gameover');
    await expect(page.locator('.gameover-copy')).toContainText(familyId.replace('-', ' '));
    expect(errors).toEqual([]);
  });
}

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

test('@visual Flight Book start panel and locked default collection', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await expect(page.locator('.start-overlay .flight-book-goal')).toHaveCount(3);
  await expect(page.locator('.start-overlay .flight-book-style-button:disabled')).toHaveCount(3);
  await captureVisual(page, 'flight-book-start.png');
  expect(errors).toEqual([]);
});

test('@visual Flight Book one-line running progress', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await startFlight(page);
  await page.evaluate(() => {
    const debug = window.__paperGliderDebug;
    if (!debug) throw new Error('Debug API was not installed.');
    const room = debug.getSnapshot().rooms.find(({ sequence }) => sequence === 0);
    const ring = room?.rings[0];
    if (!room || !ring) throw new Error('Room-zero progress ring was unavailable.');
    debug.setRoomPositionForTest(0, 0.62 - ring.z - 0.35);
    debug.setFlightStateForTest(ring.x, ring.y);
  });
  await expect.poll(
    async () => (await snapshot(page)).flightBook.run.ringCount,
  ).toBe(1);
  await page.evaluate(() => {
    const debug = window.__paperGliderDebug;
    if (!debug) throw new Error('Debug API was not installed.');
    for (const room of debug.getSnapshot().rooms) {
      debug.setRoomPositionForTest(
        room.sequence,
        room.sequence === 0 ? -7.2 : -120 - room.sequence * 18,
      );
    }
    debug.normalizeVisualForTest();
    debug.setVisibilityForTest(true);
  });
  await page.locator('.controls-hint').evaluate((element) => element.classList.add('is-visible'));
  await expect(page.locator('.flight-book-live')).toContainText('1/8 rings');
  await captureVisual(page, 'flight-book-running-progress.png');
  expect(errors).toEqual([]);
});

test('@visual Flight Book new fold notice through CLEAN LINE', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await gotoFlightLine(page);
  await startFlight(page);
  await completeCleanLine(page);
  await page.evaluate(() => {
    const debug = window.__paperGliderDebug;
    if (!debug) throw new Error('Debug API was not installed.');
    for (const room of debug.getSnapshot().rooms) {
      debug.setRoomPositionForTest(
        room.sequence,
        room.sequence === 6 ? -7.2 : -120 - room.sequence * 18,
      );
    }
    debug.normalizeVisualForTest();
    debug.setVisibilityForTest(true);
  });
  await page.locator('.controls-hint').evaluate((element) => element.classList.add('is-visible'));
  await expect(page.locator('.flight-book-toast')).toContainText('Blueprint Fold');
  await expect(page.locator('.flight-book-toast')).toBeVisible();
  await captureVisual(page, 'flight-book-new-fold.png');
  expect(errors).toEqual([]);
});

test('@visual Amber Kraft with Offset Gallery', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await selectPersistedStyle(page, 'amber-kraft');
  await prepareFamilyVisual(page, 'offset-gallery', false, true);
  await captureVisual(page, 'amber-kraft-offset-gallery.png');
  expect(errors).toEqual([]);
});

test('@visual Blueprint Fold with Archive Gate', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await selectPersistedStyle(page, 'blueprint-fold');
  await prepareArchiveGateVisual(page, {}, true);
  await captureVisual(page, 'blueprint-fold-archive-gate.png');
  expect(errors).toEqual([]);
});

test('@visual Sage Ledger with Split Loft', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await selectPersistedStyle(page, 'sage-ledger');
  await prepareFamilyVisual(page, 'split-loft', false, true);
  await captureVisual(page, 'sage-ledger-split-loft.png');
  expect(errors).toEqual([]);
});

test('@visual Flight Book result panel with all folds', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await selectPersistedStyle(page, 'sage-ledger');
  await startFlight(page);
  await page.evaluate(() => window.__paperGliderDebug?.aimAtWall());
  await expect.poll(async () => (await snapshot(page)).mode, { timeout: 6_000 }).toBe('gameover');
  await expect(page.locator('.gameover-overlay')).toBeVisible();
  await page.evaluate(() => window.__paperGliderDebug?.setVisibilityForTest(true));
  await expect(page.locator('.gameover-overlay .flight-book-goal.is-complete')).toHaveCount(3);
  await captureVisual(page, 'flight-book-result.png');
  expect(errors).toEqual([]);
});

test('@visual fixed gameplay frame', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  // Headless Chromium can perform one early software-WebGL context recycle. Reset only after it settles.
  await page.waitForTimeout(1_200);
  await page.evaluate(() => window.__paperGliderDebug?.prepareVisualForTest());
  await page.waitForTimeout(120);
  await hideFlightBookHudForLegacyVisual(page);
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

test('@visual Offset Gallery room and safe lane', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Offset Gallery overview uses the desktop camera.');
  const errors = collectRuntimeErrors(page);
  await gotoRoomSet(page);
  await prepareFamilyVisual(page, 'offset-gallery');
  expect((await snapshot(page)).rooms.find((room) => room.sequence === OFFSET_GALLERY_SEQUENCE)).toMatchObject({
    familyId: 'offset-gallery',
    familyVariant: 'left-lane',
  });
  const captured = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  expect(captured).toMatchSnapshot('offset-gallery.png', {
    threshold: 0.22,
    maxDiffPixelRatio: 0.012,
  });
  expect(errors).toEqual([]);
});

test('@visual Offset Gallery planned collider overlay', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Collider evidence uses the desktop camera.');
  const errors = collectRuntimeErrors(page);
  await gotoRoomSet(page);
  await prepareFamilyVisual(page, 'offset-gallery', true);
  const captured = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  expect(captured).toMatchSnapshot('offset-gallery-collider.png', {
    threshold: 0.22,
    maxDiffPixelRatio: 0.012,
  });
  expect(errors).toEqual([]);
});

test('@visual Split Loft room and mobile portrait', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await gotoRoomSet(page);
  await prepareFamilyVisual(page, 'split-loft');
  expect((await snapshot(page)).rooms.find((room) => room.sequence === SPLIT_LOFT_SEQUENCE)).toMatchObject({
    familyId: 'split-loft',
    familyVariant: 'upper-lane',
  });
  const captured = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  expect(captured).toMatchSnapshot('split-loft.png', {
    threshold: 0.22,
    maxDiffPixelRatio: 0.012,
  });
  expect(errors).toEqual([]);
});

test('@visual Split Loft planned collider overlay', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Collider evidence uses the desktop camera.');
  const errors = collectRuntimeErrors(page);
  await gotoRoomSet(page);
  await prepareFamilyVisual(page, 'split-loft', true);
  const captured = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  expect(captured).toMatchSnapshot('split-loft-collider.png', {
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
  await hideFlightBookHudForLegacyVisual(page);
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
  await hideFlightBookHudForLegacyVisual(page);
  const fallback = await snapshot(page);
  expect(fallback.rooms.every((room) => room.archetype === 'procedural')).toBe(true);
  const captured = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  expect(captured).toMatchSnapshot('procedural-fallback.png', {
    threshold: 0.22,
    maxDiffPixelRatio: 0.012,
  });
  expect(errors).toEqual([]);
});
