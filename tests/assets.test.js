import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const modelRoot = new URL('../assets/models/c172p/', import.meta.url);

test('el Cessna distribuido es un GLB válido y apto para la web', async () => {
  const modelUrl = new URL('aircraft.glb', modelRoot);
  const [header, metadata] = await Promise.all([
    readFile(modelUrl, { encoding: null, flag: 'r' }),
    stat(modelUrl),
  ]);

  assert.equal(header.subarray(0, 4).toString('ascii'), 'glTF');
  assert.ok(metadata.size > 100_000);
  assert.ok(metadata.size < 6 * 1024 * 1024);
});

test('el modelo conserva licencia, atribución y fuente modificable', async () => {
  const requiredFiles = [
    'LICENSE-GPL-2.0.txt',
    'NOTICE.md',
    'UPSTREAM-AUTHORS.txt',
    'source/c172p-exterior.ac',
  ];

  for (const relativePath of requiredFiles) {
    const metadata = await stat(new URL(relativePath, modelRoot));
    assert.ok(metadata.size > 0, `${relativePath} no puede estar vacío`);
  }
});
