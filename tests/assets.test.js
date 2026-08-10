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

test('la hélice de feria conserva cuatro aspas de colores', async () => {
  const propellerUrl = new URL('aspas_feria_3d.glb', modelRoot);
  const [file, metadata] = await Promise.all([
    readFile(propellerUrl, { encoding: null, flag: 'r' }),
    stat(propellerUrl),
  ]);
  assert.equal(file.subarray(0, 4).toString('ascii'), 'glTF');
  assert.ok(metadata.size > 50_000 && metadata.size < 1024 * 1024);
  const jsonLength = file.readUInt32LE(12);
  const gltf = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8'));
  const nodeNames = gltf.nodes.map(node => node.name);
  ['aspa_azul', 'aspa_rojo', 'aspa_verde', 'aspa_amarillo', 'aspas_rotativas']
    .forEach(name => assert.ok(nodeNames.includes(name), `falta ${name}`));
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

test('la interfaz permite avanzar y retroceder entre nueve postas coloreadas', async () => {
  const [source, html] = await Promise.all([
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8')
  ]);
  assert.match(html, /id="prevStopBtn"[^>]*>← RETROCEDER<\/button>/);
  assert.match(html, /id="nextStopBtn"[^>]*>AVANZAR →<\/button>/);
  assert.match(source, /const POSTA_COLORS = \[/);
  assert.match(source, /stepToStop\(-1\)/);
  assert.match(source, /stepToStop\(1\)/);
  assert.match(source, /stopName\.textContent = `POSTA \$\{stop\.id\}`/);
});

test('la escena carga y anima la hélice de feria', async () => {
  const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(source, /aspas_feria_3d\.glb/);
  assert.match(source, /getObjectByName\('aspas_rotativas'\)/);
  assert.match(source, /dataset\.propellerModel = 'feria'/);
});

test('la pantalla omite rótulos de vuelo y celebra la Posta 9', async () => {
  const [source, html] = await Promise.all([
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8')
  ]);
  assert.doesNotMatch(html, /AÉREO 2026 · GENERAL SAN MARTÍN/);
  assert.doesNotMatch(source, /stopMeta\.textContent\s*=.*stop\.label/);
  assert.match(html, /id="celebration"/);
  assert.match(html, /¡RECORRIDO COMPLETADO!/);
  assert.doesNotMatch(html, /POSTA 9 · JOSÉ L\. SUÁREZ/);
  assert.match(source, /function triggerCelebration\(\)/);
  assert.match(source, /if \(isLastStop\) triggerCelebration\(\)/);
  assert.match(source, /function completeFlight\(\)[\s\S]*triggerCelebration\(\)/);
});

test('los controles usan un único botón de vuelo y recuperan la esquina derecha', async () => {
  const [source, html, styles] = await Promise.all([
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../styles.css', import.meta.url), 'utf8')
  ]);
  assert.match(html, /id="startBtn"[^>]*>INICIAR<\/button>/);
  assert.doesNotMatch(html, /id="pauseBtn"/);
  assert.match(html, /flight-controls[\s\S]*step-controls[\s\S]*utility-controls/);
  assert.match(html, /class="control-group utility-controls"[\s\S]*mapModeBtn[\s\S]*restartBtn/);
  assert.match(html, /class="top-tools"[\s\S]*fullscreenBtn[\s\S]*class="altimeter"/);
  assert.match(styles, /\.controls\s*\{[\s\S]*right: 24px;[\s\S]*justify-content: flex-end/);
  assert.match(styles, /button\.step-control\s*\{[\s\S]*background: #fff;[\s\S]*color: #173442/);
  assert.match(source, /setFlightButton\('PAUSA'\)/);
  assert.match(source, /setFlightButton\('CONTINUAR'/);
  assert.match(source, /requestFullscreen\(\)/);
  assert.match(source, /document\.exitFullscreen\(\)/);
  assert.match(source, /fullscreenchange/);
});

test('la portada permite elegir dispositivo y recomienda usar el celular horizontal', async () => {
  const [source, html] = await Promise.all([
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8')
  ]);
  assert.match(html, /id="experienceSetup"/);
  assert.match(html, />VERSIÓN MÓVIL<\/button>/);
  assert.match(html, />ESCRITORIO PC<\/button>/);
  assert.match(html, /posición horizontal para mejorar la experiencia/);
  assert.match(source, /finishExperienceSetup\('desktop'\)/);
  assert.match(source, /finishExperienceSetup\('mobile'\)/);
});

test('cada posta abre un panel y la Posta 2 conserva sus siete placas', async () => {
  const [source, html] = await Promise.all([
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8')
  ]);
  assert.match(html, /\(HACÉ CLICK AQUÍ\)/);
  assert.match(html, /id="materialOverlay"/);
  assert.match(html, /id="closeMaterialBtn"/);
  assert.match(source, /function stopAtPost\(index\)/);
  assert.match(source, /materialReturnState === 'stopped'/);
  assert.match(source, /resumeFlight\(true\)/);
  assert.match(source, /FLIGHT_SPEED_MULTIPLIER = 1\.1/);
  assert.match(source, /function stopAtPost\(index\)[\s\S]*throttle: 0\.28/);
  assert.match(source, /fans\.forEach\(fan => \{[\s\S]*fan\.rotation/);
  assert.match(source, /empty\.className = 'empty-material'/);

  for (let index = 1; index <= 7; index += 1) {
    const file = await stat(new URL(
      `../assets/materials/posta-2/slide-${String(index).padStart(2, '0')}.webp`,
      import.meta.url
    ));
    assert.ok(file.size > 50_000, `la placa ${index} no puede estar vacía`);
  }
  const sourceNote = await stat(new URL('../assets/materials/posta-2/SOURCE.md', import.meta.url));
  assert.ok(sourceNote.size > 0);
});
