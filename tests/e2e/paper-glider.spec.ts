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
  rooms: Array<{
    sequence: number;
    archetype: 'procedural' | 'archive-gate';
    z: number;
    colliderLabels: string[];
    rings: Array<{ x: number; y: number; z: number; collected: boolean }>;
  }>;
}

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

async function gotoArchiveGate(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('?seed=1BADB00F');
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
    debug.restartWithSeed('1BADB00F');
    if (recycled) debug.advanceRoomsForTest(180);
    const sequence = recycled ? 9 : 0;
    debug.setRoomPositionForTest(sequence, -7.2);
    const room = debug.getSnapshot().rooms.find((candidate) => candidate.sequence === sequence);
    const ring = room?.rings[0];
    if (ring) debug.setFlightStateForTest(ring.x, ring.y);
    debug.setColliderDebugVisible(Boolean(colliders));
    debug.setVisibilityForTest(true);
  }, options);
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
  await gotoArchiveGate(page);
  const first = await snapshot(page);
  expect(first.asset).toEqual({
    status: 'loaded',
    failureCode: null,
    fetchCount: 2,
    parseCount: 1,
    cloneCount: 1,
  });
  expect(first.rooms[0]).toMatchObject({
    sequence: 0,
    archetype: 'archive-gate',
    colliderLabels: [
      'archive gate left pier',
      'archive gate right pier',
      'archive gate top beam',
    ],
  });
  const firstRoute = first.rooms.map((room) => ({
    sequence: room.sequence,
    archetype: room.archetype,
    rings: room.rings.map(({ x, y, z }) => ({ x, y, z })),
  }));
  await page.evaluate(() => window.__paperGliderDebug?.restartWithSeed('1BADB00F'));
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

test('flies the central passage and collides with both manifest pier and top beam', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await gotoArchiveGate(page);
  await startFlight(page);
  await page.evaluate(() => {
    const debug = window.__paperGliderDebug;
    const gate = debug?.getSnapshot().rooms.find((room) => room.sequence === 0);
    const ring = gate?.rings[0];
    if (!debug || !ring) throw new Error('Archive Gate ring was unavailable.');
    debug.setFlightStateForTest(ring.x, ring.y);
    debug.setRoomPositionForTest(0, 0.62);
  });
  await expect.poll(async () => (await snapshot(page)).score).toBe(1);
  expect((await snapshot(page)).mode).toBe('playing');

  await page.evaluate(() => {
    const debug = window.__paperGliderDebug;
    debug?.restartWithSeed('1BADB00F');
    debug?.setFlightStateForTest(-3.65, 1.68);
    debug?.setRoomPositionForTest(0, 0.62);
  });
  await expect.poll(async () => (await snapshot(page)).mode).toBe('gameover');
  await expect(page.locator('.gameover-copy')).toHaveText(/archive gate left pier/i);

  await page.evaluate(() => {
    const debug = window.__paperGliderDebug;
    debug?.restartWithSeed('1BADB00F');
    debug?.setFlightStateForTest(0, 4.13);
    debug?.setRoomPositionForTest(0, 0.62);
  });
  await expect.poll(async () => (await snapshot(page)).mode).toBe('gameover');
  await expect(page.locator('.gameover-copy')).toHaveText(/archive gate top beam/i);
  expect(errors).toEqual([]);
});

test('recycles the nine-room pool and recreates Archive Gate without refetch or reparse', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await gotoArchiveGate(page);
  await page.evaluate(() => window.__paperGliderDebug?.advanceRoomsForTest(180));
  const recycled = await snapshot(page);
  expect(recycled.rooms.every((room) => room.sequence >= 9)).toBe(true);
  expect(recycled.rooms.some((room) => room.sequence === 9 && room.archetype === 'archive-gate')).toBe(true);
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
  await page.goto('?seed=1BADB00F');
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
  await gotoArchiveGate(page);
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
  await gotoArchiveGate(page);
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
  await gotoArchiveGate(page);
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
