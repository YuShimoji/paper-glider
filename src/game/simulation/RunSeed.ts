export const RUN_SEED_STORAGE_KEY = 'paper-glider-run-seed';
export const RUN_SEED_QUERY_KEY = 'seed';
export const FALLBACK_RUN_SEED = 0x50a6e123;

export type RunSeedSource = 'query' | 'storage' | 'generated' | 'fallback';

export interface SeedStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ResolvedRunSeed {
  seed: number;
  source: RunSeedSource;
}

function mix(value: number): number {
  let mixed = value >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb352d);
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846ca68b);
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}

export function normalizeRunSeed(seed: number): number {
  return Number.isFinite(seed) ? seed >>> 0 : FALLBACK_RUN_SEED;
}

export function formatRunSeed(seed: number): string {
  return normalizeRunSeed(seed).toString(16).padStart(8, '0').toUpperCase();
}

export function parseRunSeed(value: string | null | undefined): number | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  const parsed = /^(?:0x)?[\da-f]+$/i.test(candidate)
    ? Number.parseInt(candidate.replace(/^0x/i, ''), 16)
    : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 0xffffffff ? parsed >>> 0 : null;
}

export function randomUnit(seed: number, ...coordinates: number[]): number {
  let value = mix(normalizeRunSeed(seed) ^ 0x9e3779b9);
  for (const coordinate of coordinates) {
    value = mix(value ^ mix(Math.round(coordinate * 1000)));
  }
  return value / 0x1_0000_0000;
}

export function generateRunSeed(cryptoSource: Pick<Crypto, 'getRandomValues'> | null): ResolvedRunSeed {
  if (!cryptoSource) return { seed: FALLBACK_RUN_SEED, source: 'fallback' };

  const values = new Uint32Array(1);
  cryptoSource.getRandomValues(values);
  return { seed: normalizeRunSeed(values[0]), source: 'generated' };
}

export function resolveRunSeed(
  search: string,
  storage: SeedStorage | null,
  cryptoSource: Pick<Crypto, 'getRandomValues'> | null,
): ResolvedRunSeed {
  const querySeed = parseRunSeed(new URLSearchParams(search).get(RUN_SEED_QUERY_KEY));
  const storedSeed = parseRunSeed(storage?.getItem(RUN_SEED_STORAGE_KEY));
  const resolved = querySeed !== null
    ? { seed: querySeed, source: 'query' as const }
    : storedSeed !== null
      ? { seed: storedSeed, source: 'storage' as const }
      : generateRunSeed(cryptoSource);

  try {
    storage?.setItem(RUN_SEED_STORAGE_KEY, formatRunSeed(resolved.seed));
  } catch {
    // Storage is an optional convenience; the resolved seed remains authoritative for this run.
  }
  return resolved;
}
