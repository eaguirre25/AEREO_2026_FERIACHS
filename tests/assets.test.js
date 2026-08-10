import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const modelRoot = new URL('../assets/models/airship/', import.meta.url);

test('el dirigible distribuido es un GLB Draco válido y apto para la web', async () => {
  const modelUrl = new URL('airship.glb', modelRoot);
  const [file, metadata] = await Promise.all([
    readFile(modelUrl, { encoding: null, flag: 'r' }),
    stat(modelUrl),
  ]);

  assert.equal(file.subarray(0, 4).toString('ascii'), 'glTF');
  assert.ok(metadata.size > 20_000);
  assert.ok(metadata.size < 100_000);

  const jsonLength = file.readUInt32LE(12);
  const gltf = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8'));
  assert.ok(gltf.extensionsUsed.includes('KHR_draco_mesh_compression'));
  assert.ok(gltf.nodes.some(node => node.name === 'Fan'));
});

test('el modelo conserva licencia, atribución y fuente modificable', async () => {
  const requiredFiles = [
    'LICENSE-AGPL-3.0.txt',
    'NOTICE.md',
    'UPSTREAM-Airship.jsx',
  ];

  for (const relativePath of requiredFiles) {
    const metadata = await stat(new URL(relativePath, modelRoot));
    assert.ok(metadata.size > 0, `${relativePath} no puede estar vacío`);
  }
});

test('el estadio de Chacarita es un GLB web válido', async () => {
  const stadiumUrl = new URL('../assets/models/landmarks/chacarita/stadium.glb', import.meta.url);
  const [file, metadata] = await Promise.all([
    readFile(stadiumUrl, { encoding: null, flag: 'r' }),
    stat(stadiumUrl),
  ]);

  assert.equal(file.subarray(0, 4).toString('ascii'), 'glTF');
  assert.ok(metadata.size > 10_000);
  assert.ok(metadata.size < 1024 * 1024);
});
