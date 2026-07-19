import type { Group } from 'three';
import {
  findMissingVisualNodes,
  validateWorkbenchRoomManifest,
  WorkbenchRoomAssetLibrary,
} from './WorkbenchRoomManifest';
import type { WorkbenchRoomManifest } from './WorkbenchRoomManifest';

export const ASSET_PRELOAD_TIMEOUT_MS = 5_000;
export const WORKBENCH_ASSET_BASE_PATH = 'assets/workbench/paper-glider-v1/';
export const WORKBENCH_MANIFEST_PATH = `${WORKBENCH_ASSET_BASE_PATH}paper-glider-archive-gate.manifest.json`;
export const PINNED_WORKBENCH_MANIFEST_SHA256 = 'b9c41a053e97d061ac4795c77d8f628e93f0a40adef6f718614e614c861e1bd5';
export const PINNED_WORKBENCH_GLB_SHA256 = 'e91d1a4b87c2c0a7d3c6698c320c13239b3751c03884b3a4c6b5b6853be1d019';

export type WorkbenchAssetFailureCode =
  | 'timeout'
  | 'abort'
  | 'manifest-fetch'
  | 'manifest-hash'
  | 'manifest-parse'
  | 'manifest-structure'
  | 'glb-fetch'
  | 'glb-hash'
  | 'glb-parse'
  | 'missing-node';

export interface WorkbenchAssetFailure {
  readonly code: WorkbenchAssetFailureCode;
  readonly message: string;
}

export type WorkbenchAssetLoadResult =
  | { readonly ok: true; readonly library: WorkbenchRoomAssetLibrary }
  | { readonly ok: false; readonly failure: WorkbenchAssetFailure };

interface ParsedGlb {
  scene: Group;
}

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type GlbParser = (buffer: ArrayBuffer, resourcePath: string) => Promise<ParsedGlb>;
type DigestImplementation = (buffer: ArrayBuffer) => Promise<string>;

export interface WorkbenchAssetLoaderOptions {
  readonly baseUrl: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: FetchImplementation;
  readonly parseGlb?: GlbParser;
  readonly digestImpl?: DigestImplementation;
  readonly expectedManifestSha256?: string;
  readonly expectedGlbSha256?: string;
  readonly setTimeoutImpl?: typeof globalThis.setTimeout;
  readonly clearTimeoutImpl?: typeof globalThis.clearTimeout;
}

class AssetLoadError extends Error {
  constructor(readonly code: WorkbenchAssetFailureCode, message: string) {
    super(message);
  }
}

export function resolveRuntimeAssetUrl(baseUrl: string, relativePath: string): string {
  if (!baseUrl.startsWith('/') || !baseUrl.endsWith('/')) {
    throw new Error('Vite BASE_URL must be a root-relative directory path.');
  }
  if (relativePath.startsWith('/') || relativePath.includes('..') || /^[a-z][a-z\d+.-]*:/i.test(relativePath)) {
    throw new Error('Runtime asset paths must be safe and relative to BASE_URL.');
  }
  return `${baseUrl}${relativePath}`;
}

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function defaultParseGlb(buffer: ArrayBuffer, resourcePath: string): Promise<ParsedGlb> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  return loader.parseAsync(buffer, resourcePath);
}

function asFailure(error: unknown): WorkbenchAssetFailure {
  if (error instanceof AssetLoadError) return { code: error.code, message: error.message };
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { code: 'abort', message: 'Archive Gate preload was aborted.' };
  }
  return {
    code: 'glb-parse',
    message: error instanceof Error ? error.message : 'Archive Gate preload failed.',
  };
}

async function fetchBytes(
  fetchImpl: FetchImplementation,
  url: string,
  signal: AbortSignal,
  code: 'manifest-fetch' | 'glb-fetch',
): Promise<ArrayBuffer> {
  let response: Response;
  try {
    response = await fetchImpl(url, { signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new AssetLoadError(code, `${url} could not be fetched.`);
  }
  if (!response.ok) throw new AssetLoadError(code, `${url} returned HTTP ${response.status}.`);
  return response.arrayBuffer();
}

async function loadAsset(
  options: WorkbenchAssetLoaderOptions,
  controller: AbortController,
): Promise<WorkbenchRoomAssetLibrary> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const digestImpl = options.digestImpl ?? sha256Hex;
  const parseGlb = options.parseGlb ?? defaultParseGlb;
  const expectedManifest = options.expectedManifestSha256 ?? PINNED_WORKBENCH_MANIFEST_SHA256;
  const expectedGlb = options.expectedGlbSha256 ?? PINNED_WORKBENCH_GLB_SHA256;
  let fetchCount = 0;

  const manifestUrl = resolveRuntimeAssetUrl(options.baseUrl, WORKBENCH_MANIFEST_PATH);
  const manifestBytes = await fetchBytes(fetchImpl, manifestUrl, controller.signal, 'manifest-fetch');
  fetchCount += 1;
  if ((await digestImpl(manifestBytes)) !== expectedManifest) {
    throw new AssetLoadError('manifest-hash', 'Archive Gate manifest SHA-256 did not match the pinned value.');
  }

  let parsedManifest: unknown;
  try {
    parsedManifest = JSON.parse(new TextDecoder().decode(manifestBytes));
  } catch {
    throw new AssetLoadError('manifest-parse', 'Archive Gate manifest JSON could not be parsed.');
  }

  let manifest: WorkbenchRoomManifest;
  try {
    manifest = validateWorkbenchRoomManifest(parsedManifest);
  } catch (error) {
    throw new AssetLoadError(
      'manifest-structure',
      error instanceof Error ? error.message : 'Archive Gate manifest structure is invalid.',
    );
  }
  if (manifest.files.glb.sha256 !== `sha256:${expectedGlb}`) {
    throw new AssetLoadError('manifest-structure', 'Manifest GLB hash does not match the pinned runtime contract.');
  }

  const glbUrl = resolveRuntimeAssetUrl(options.baseUrl, manifest.integration.relativeGlbPath);
  const glbBytes = await fetchBytes(fetchImpl, glbUrl, controller.signal, 'glb-fetch');
  fetchCount += 1;
  if ((await digestImpl(glbBytes)) !== expectedGlb) {
    throw new AssetLoadError('glb-hash', 'Archive Gate GLB SHA-256 did not match the pinned value.');
  }

  let root: Group;
  try {
    const resourcePath = glbUrl.slice(0, glbUrl.lastIndexOf('/') + 1);
    root = (await parseGlb(glbBytes, resourcePath)).scene;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new AssetLoadError(
      'glb-parse',
      error instanceof Error ? error.message : 'Archive Gate GLB could not be parsed.',
    );
  }

  const missingNodes = findMissingVisualNodes(root);
  if (missingNodes.length > 0) {
    throw new AssetLoadError('missing-node', `Archive Gate GLB is missing ${missingNodes.join(', ')}.`);
  }

  return new WorkbenchRoomAssetLibrary(manifest, root, fetchCount, 1);
}

export async function preloadWorkbenchRoomAsset(
  options: WorkbenchAssetLoaderOptions,
): Promise<WorkbenchAssetLoadResult> {
  const controller = new AbortController();
  const setTimeoutImpl = options.setTimeoutImpl ?? globalThis.setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? globalThis.clearTimeout;
  const timeoutMs = options.timeoutMs ?? ASSET_PRELOAD_TIMEOUT_MS;
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeoutImpl(() => {
      controller.abort();
      reject(new AssetLoadError('timeout', `Archive Gate preload exceeded ${timeoutMs} ms.`));
    }, timeoutMs);
  });

  try {
    const library = await Promise.race([loadAsset(options, controller), timeout]);
    return { ok: true, library };
  } catch (error) {
    return { ok: false, failure: asFailure(error) };
  } finally {
    if (timer !== undefined) clearTimeoutImpl(timer);
  }
}
