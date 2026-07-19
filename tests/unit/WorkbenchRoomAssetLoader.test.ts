import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv from 'ajv';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { describe, expect, test } from 'vitest';
import {
  PINNED_WORKBENCH_GLB_SHA256,
  PINNED_WORKBENCH_MANIFEST_SHA256,
  preloadWorkbenchRoomAsset,
  resolveRuntimeAssetUrl,
} from '../../src/game/assets/WorkbenchRoomAssetLoader';
import {
  ARCHIVE_GATE_REQUIRED_NODE_IDS,
  getArchiveGateObstacleVolumes,
  validateWorkbenchRoomManifest,
} from '../../src/game/assets/WorkbenchRoomManifest';

const bundleDirectory = resolve('public/assets/workbench/paper-glider-v1');
const manifestPath = resolve(bundleDirectory, 'paper-glider-archive-gate.manifest.json');
const schemaPath = resolve(bundleDirectory, 'paper-glider-compat-manifest-v1.schema.json');
const glbPath = resolve(bundleDirectory, 'paper-glider-archive-gate.glb');
const rightsPath = resolve(bundleDirectory, 'RIGHTS.md');
const manifestBytes = readFileSync(manifestPath);
const manifestValue = JSON.parse(manifestBytes.toString('utf8')) as Record<string, unknown>;

function response(body: BodyInit, status = 200): Response {
  return new Response(body, { status });
}

function createValidRoot(): { root: Group; sourceMesh: Mesh } {
  const root = new Group();
  const sourceMesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial());
  sourceMesh.name = ARCHIVE_GATE_REQUIRED_NODE_IDS[0];
  root.add(sourceMesh);
  for (const id of ARCHIVE_GATE_REQUIRED_NODE_IDS.slice(1)) {
    const node = new Group();
    node.name = id;
    root.add(node);
  }
  return { root, sourceMesh };
}

function successfulDigest(): (buffer: ArrayBuffer) => Promise<string> {
  let call = 0;
  return async () => {
    call += 1;
    return call === 1 ? PINNED_WORKBENCH_MANIFEST_SHA256 : PINNED_WORKBENCH_GLB_SHA256;
  };
}

describe('Workbench Archive Gate contract', () => {
  test('validates the complete Draft-07 schema and all pinned copied hashes', () => {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    expect(validate(manifestValue), JSON.stringify(validate.errors)).toBe(true);

    const expected = new Map([
      [manifestPath, PINNED_WORKBENCH_MANIFEST_SHA256],
      [glbPath, PINNED_WORKBENCH_GLB_SHA256],
      [schemaPath, 'abbd570b742de3ae87904069dfd0b27f26a0e223999e1cfa760dec81a26a4e39'],
      [rightsPath, '481eb1980eb1728eefb84c6a5fb5bdf307185e99e7089e511e927ebf49958c9f'],
    ]);
    for (const [path, expectedHash] of expected) {
      expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(expectedHash);
    }
  });

  test('performs the runtime structural validation and pure AABB placement transform', () => {
    const manifest = validateWorkbenchRoomManifest(structuredClone(manifestValue));
    expect(Object.isFrozen(manifest)).toBe(true);
    expect(getArchiveGateObstacleVolumes(manifest)).toEqual([
      {
        id: 'collider-left-pier',
        label: 'archive gate left pier',
        x: -3.65,
        y: 1.68,
        z: 0,
        halfX: 0.55,
        halfY: 2.2,
        halfZ: 0.7,
      },
      {
        id: 'collider-right-pier',
        label: 'archive gate right pier',
        x: 3.65,
        y: 1.68,
        z: 0,
        halfX: 0.55,
        halfY: 2.2,
        halfZ: 0.7,
      },
      {
        id: 'collider-top-beam',
        label: 'archive gate top beam',
        x: 0,
        y: 4.13,
        z: 0,
        halfX: 4.2,
        halfY: 0.275,
        halfZ: 0.7,
      },
    ]);
  });

  test('rejects a collider reference that does not resolve to a visual node', () => {
    const invalid = structuredClone(manifestValue) as {
      colliders: Array<{ visualNodeIds: string[] }>;
    };
    invalid.colliders[0].visualNodeIds = ['missing-node'];
    expect(() => validateWorkbenchRoomManifest(invalid)).toThrow(/references missing visual node/);
  });

  test('builds every runtime URL from the Vite production subpath', () => {
    expect(resolveRuntimeAssetUrl('/paper-glider/', 'assets/workbench/file.glb')).toBe(
      '/paper-glider/assets/workbench/file.glb',
    );
    expect(() => resolveRuntimeAssetUrl('/paper-glider/', '/assets/file.glb')).toThrow();
    expect(() => resolveRuntimeAssetUrl('/paper-glider/', '../file.glb')).toThrow();
  });
});

describe('WorkbenchRoomAssetLoader', () => {
  test('loads once, validates nodes, and creates resource-sharing room clones without refetching', async () => {
    const requested: string[] = [];
    const { root, sourceMesh } = createValidRoot();
    const result = await preloadWorkbenchRoomAsset({
      baseUrl: '/paper-glider/',
      fetchImpl: async (input) => {
        requested.push(String(input));
        return String(input).endsWith('.json')
          ? response(manifestBytes)
          : response(new Uint8Array([1, 2, 3]));
      },
      digestImpl: successfulDigest(),
      parseGlb: async () => ({ scene: root }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const first = result.library.createArchiveGateClone();
    const second = result.library.createArchiveGateClone();
    const firstMesh = first.getObjectByName(ARCHIVE_GATE_REQUIRED_NODE_IDS[0]) as Mesh;
    const secondMesh = second.getObjectByName(ARCHIVE_GATE_REQUIRED_NODE_IDS[0]) as Mesh;
    expect(firstMesh.geometry).toBe(sourceMesh.geometry);
    expect(secondMesh.geometry).toBe(sourceMesh.geometry);
    expect(firstMesh.material).toBe(sourceMesh.material);
    expect(secondMesh.material).toBe(sourceMesh.material);
    expect(result.library.getMetrics()).toEqual({ fetchCount: 2, parseCount: 1, cloneCount: 2 });
    expect(requested).toEqual([
      '/paper-glider/assets/workbench/paper-glider-v1/paper-glider-archive-gate.manifest.json',
      '/paper-glider/assets/workbench/paper-glider-v1/paper-glider-archive-gate.glb',
    ]);
  });

  test.each([
    ['manifest fetch failure', 'manifest-fetch', async () => response('missing', 404), successfulDigest(), async () => ({ scene: createValidRoot().root })],
    ['AbortError', 'abort', async () => { throw new DOMException('aborted', 'AbortError'); }, successfulDigest(), async () => ({ scene: createValidRoot().root })],
    ['manifest hash mismatch', 'manifest-hash', async () => response(manifestBytes), async () => '0'.repeat(64), async () => ({ scene: createValidRoot().root })],
    ['manifest parse failure', 'manifest-parse', async () => response('not-json'), async () => PINNED_WORKBENCH_MANIFEST_SHA256, async () => ({ scene: createValidRoot().root })],
  ])('returns fallback for %s', async (_name, code, fetchImpl, digestImpl, parseGlb) => {
    const result = await preloadWorkbenchRoomAsset({
      baseUrl: '/paper-glider/',
      fetchImpl,
      digestImpl,
      parseGlb,
    });
    expect(result).toMatchObject({ ok: false, failure: { code } });
  });

  test('returns fallback for GLB fetch and hash failures', async () => {
    let call = 0;
    const glbFetchFailure = await preloadWorkbenchRoomAsset({
      baseUrl: '/paper-glider/',
      fetchImpl: async () => {
        call += 1;
        return call === 1 ? response(manifestBytes) : response('missing', 404);
      },
      digestImpl: async () => PINNED_WORKBENCH_MANIFEST_SHA256,
      parseGlb: async () => ({ scene: createValidRoot().root }),
    });
    expect(glbFetchFailure).toMatchObject({ ok: false, failure: { code: 'glb-fetch' } });

    call = 0;
    const glbHashFailure = await preloadWorkbenchRoomAsset({
      baseUrl: '/paper-glider/',
      fetchImpl: async () => {
        call += 1;
        return call === 1 ? response(manifestBytes) : response(new Uint8Array([1]));
      },
      digestImpl: async () => {
        call += 1;
        return call === 2 ? PINNED_WORKBENCH_MANIFEST_SHA256 : '0'.repeat(64);
      },
      parseGlb: async () => ({ scene: createValidRoot().root }),
    });
    expect(glbHashFailure).toMatchObject({ ok: false, failure: { code: 'glb-hash' } });
  });

  test('returns fallback for GLB parse and required-node failures', async () => {
    const common = {
      baseUrl: '/paper-glider/',
      fetchImpl: async (input: RequestInfo | URL) => String(input).endsWith('.json')
        ? response(manifestBytes)
        : response(new Uint8Array([1])),
      digestImpl: successfulDigest(),
    };
    const parseFailure = await preloadWorkbenchRoomAsset({
      ...common,
      parseGlb: async () => { throw new Error('bad glb'); },
    });
    expect(parseFailure).toMatchObject({ ok: false, failure: { code: 'glb-parse' } });

    const missingNode = await preloadWorkbenchRoomAsset({
      ...common,
      digestImpl: successfulDigest(),
      parseGlb: async () => ({ scene: new Group() }),
    });
    expect(missingNode).toMatchObject({ ok: false, failure: { code: 'missing-node' } });
  });

  test('aborts a finite preload timeout and ignores a late network completion', async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    const result = await preloadWorkbenchRoomAsset({
      baseUrl: '/paper-glider/',
      timeoutMs: 5,
      fetchImpl: () => new Promise<Response>((resolveResponse) => {
        resolveFetch = resolveResponse;
      }),
      parseGlb: async () => ({ scene: createValidRoot().root }),
    });
    expect(result).toMatchObject({ ok: false, failure: { code: 'timeout' } });
    resolveFetch?.(response(manifestBytes));
  });
});
