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
