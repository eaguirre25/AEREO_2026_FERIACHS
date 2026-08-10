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

test('el logo UNSAM es un GLB web válido', async () => {
  const logoUrl = new URL('../assets/models/landmarks/unsam/logo.glb', import.meta.url);
  const [file, metadata] = await Promise.all([
    readFile(logoUrl, { encoding: null, flag: 'r' }),
    stat(logoUrl),
  ]);

  assert.equal(file.subarray(0, 4).toString('ascii'), 'glTF');
  assert.ok(metadata.size > 10_000);
  assert.ok(metadata.size < 1024 * 1024);
});

test('la capa de localidades contiene ocho polígonos identificados', async () => {
  const geojsonUrl = new URL('../assets/data/san-martin-localidades.geojson', import.meta.url);
  const geojson = JSON.parse(await readFile(geojsonUrl, 'utf8'));

  assert.equal(geojson.type, 'FeatureCollection');
  assert.equal(geojson.features.length, 8);
  geojson.features.forEach(feature => {
    assert.equal(feature.geometry.type, 'MultiPolygon');
    assert.ok(feature.properties.Localidad);
    assert.ok(feature.properties.siglas);
  });
});

test('la escena duplica el dirigible y resalta la localidad activa', async () => {
  const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(source, /AIRSHIP_BASE_SCALE = 16\.8/);
  assert.match(source, /feature-state', 'active'/);
  assert.match(source, /LOCALITY_COLORS/);
});
