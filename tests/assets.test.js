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
  assert.match(source, /PROPELLER_SPIN_MULTIPLIER = 1\.9/);
  assert.match(source, /rotationStep = \([\s\S]*\) \* PROPELLER_SPIN_MULTIPLIER/);
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

test('la portada permite elegir dispositivo y adapta los controles al celular', async () => {
  const [source, html, styles] = await Promise.all([
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../styles.css', import.meta.url), 'utf8')
  ]);
  assert.match(html, /id="experienceSetup"/);
  assert.match(html, /id="journeyIntro"/);
  assert.match(html, /assets\/intro\/el-camino-de-la-investigacion\.png/);
  assert.match(html, /Te proponemos un recorrido interactivo por este mapa con postas/);
  assert.match(html, /CONTINUAR AL RECORRIDO AÉREO/);
  assert.match(html, />VERSIÓN MÓVIL<\/button>/);
  assert.match(html, />ESCRITORIO PC<\/button>/);
  assert.match(html, /posición horizontal para mejorar la experiencia/);
  assert.match(source, /finishExperienceSetup\('desktop'\)/);
  assert.match(source, /finishExperienceSetup\('mobile'\)/);
  assert.match(source, /new URLSearchParams\(window\.location\.search\)\.get\('device'\)/);
  assert.match(source, /requestedExperienceMode === 'desktop'/);
  assert.match(source, /requestedExperienceMode === 'mobile'/);
  assert.match(source, /showMobileOrientationPrompt\(\)/);
  assert.match(source, /journeyIntro\.hidden = false/);
  assert.match(source, /function enterAerialExperience\(\)/);
  assert.match(source, /journeyIntro\.hidden = true/);
  assert.match(source, /journeyIntroContinue\.addEventListener\('click', enterAerialExperience\)/);
  assert.match(styles, /@media \(max-width: 620px\)/);
  assert.match(styles, /flex-direction: column-reverse/);
  assert.match(styles, /\.fullscreen-control \{[\s\S]*?width: 70px;[\s\S]*?min-height: 34px;/);
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
  assert.match(source, /FLIGHT_SPEED_MULTIPLIER = 1\.56/);
  assert.match(source, /INITIAL_LEG_SPEED_MULTIPLIER = 1\.6/);
  assert.match(source, /initialLeg = flightStage === 'departure' \|\| segment === 0/);
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

test('el final habilita vuelo libre con teclado, control táctil y selector de velocidad', async () => {
  const [source, html, styles] = await Promise.all([
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../styles.css', import.meta.url), 'utf8')
  ]);
  assert.match(html, /id="freeModeBtn"[^>]*>ZEPELÍN: MODO LIBRE<\/button>/);
  assert.match(html, /id="freeFlightControls"/);
  assert.match(html, /id="freeJoystick"/);
  assert.match(html, /id="freeSlowerBtn"/);
  assert.match(html, /id="freeFasterBtn"/);
  assert.match(source, /function completeFlight\(\)[\s\S]*freeModeBtn\.hidden = false/);
  assert.match(source, /function enterFreeFlight\(\)/);
  assert.match(source, /function animateFreeFlight\(now\)/);
  assert.match(source, /FREE_FLIGHT_SPEEDS_KMH = \[20, 40, 60, 90, 120\]/);
  assert.match(source, /new Set\(\['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'\]\)/);
  assert.match(source, /freeJoystick\.addEventListener\('pointerdown'/);
  assert.match(styles, /\.free-joystick[\s\S]*border-radius: 50%/);
  assert.match(styles, /html\[data-flight-mode='free'\]/);
});

test('el HUD muestra el título temático y la cuenta regresiva sin revelar la fecha', async () => {
  const [source, html] = await Promise.all([
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8')
  ]);
  assert.match(html, /id="stopTheme"/);
  assert.match(html, /id="countdownDays"/);
  assert.match(html, /id="countdownHours"/);
  assert.match(html, /id="countdownMinutes"/);
  assert.match(html, /PARA OCTUBRE/);
  assert.match(html, /assets\/ui\/el-camino-investigacion\.png/);
  assert.match(source, /2026-10-15T00:00:00-03:00/);
  assert.match(source, /Math\.floor\(remaining \/ DAY_MS\)/);
  assert.match(source, /stopTheme\.textContent = stop\.title\.toUpperCase\(\)/);
  assert.match(source, /materialTitle\.textContent = `POSTA \$\{stop\.id\} · \$\{stop\.title\}`/);
  assert.doesNotMatch(html, /15[\/-]10[\/-]2026|15 de octubre/i);
  const titleBadge = await stat(new URL('../assets/ui/el-camino-investigacion.png', import.meta.url));
  assert.ok(titleBadge.size > 100_000);
  assert.ok(titleBadge.size < 500_000);
});

test('el panel de materiales reserva el alto real del título sin cortar las placas', async () => {
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.material-panel\s*\{[\s\S]*display: flex;[\s\S]*flex-direction: column;/);
  assert.match(styles, /\.material-body\s*\{[\s\S]*flex: 1 1 auto;[\s\S]*height: auto;/);
  assert.match(styles, /\.slide-stage img\s*\{[\s\S]*width: 100%;[\s\S]*height: 100%;[\s\S]*object-fit: contain;/);
});

test('la experiencia inicia en mapa vectorial y ofrece el cambio a satélite', async () => {
  const [source, html] = await Promise.all([
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8')
  ]);
  assert.match(html, /id="stopMeta">UNSAM · CAMPUS MIGUELETE</);
  assert.doesNotMatch(html, /VILLA MAIPÚ \/ VILLA LYNCH/);
  assert.match(html, /id="mapModeBtn"[^>]*aria-pressed="false"[^>]*>SATÉLITE</);
  assert.match(source, /let satelliteEnabled = false/);
  assert.match(source, /layout: \{ visibility: 'none' \}/);
  assert.match(source, /setMapMode\(false\)/);
  assert.match(source, /mapModeBtn\.textContent = satelliteEnabled \? 'MAPA' : 'SATÉLITE'/);
});

test('toda la interfaz usa la familia Rajdhani local en sus cinco pesos', async () => {
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const weights = ['Light', 'Regular', 'Medium', 'SemiBold', 'Bold'];
  for (const weight of weights) {
    const font = await stat(new URL(`../assets/fonts/rajdhani/Rajdhani-${weight}.ttf`, import.meta.url));
    assert.ok(font.size > 300_000, `falta el peso Rajdhani ${weight}`);
    assert.match(styles, new RegExp(`Rajdhani-${weight}\\.ttf`));
  }
  const license = await stat(new URL('../assets/fonts/rajdhani/OFL.txt', import.meta.url));
  assert.ok(license.size > 4_000);
  assert.match(styles, /\*\s*\{[\s\S]*font-family: 'Rajdhani', sans-serif;/);
  assert.doesNotMatch(styles, /\bInter\b|\bArial\b|Georgia|Times New Roman|system-ui/);
});

test('el dirigible lleva publicidad en ambos laterales y admite cámara orbital', async () => {
  const [source, texture] = await Promise.all([
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../assets/textures/airship/ciencia-y-ficcion.webp', import.meta.url))
  ]);
  assert.equal(texture.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(texture.subarray(8, 12).toString('ascii'), 'WEBP');
  assert.ok(texture.length > 100_000 && texture.length < 1_000_000);
  assert.match(source, /function attachAdvertising\(model, orientation = 'gltf'\)/);
  assert.match(source, /group\.add\(sideA, sideB\)/);
  assert.match(source, /function curvedAdvertisingGeometry\(/);
  assert.match(source, /new THREE\.PlaneGeometry\(width, height, 28, 10\)/);
  assert.match(source, /dataset\.airshipAdvertisingShape = 'curved'/);
  assert.match(source, /ciencia-y-ficcion\.webp/);
  assert.match(source, /dataset\.airshipAdvertising = 'ciencia-y-ficcion'/);
  assert.match(source, /dragPan: false/);
  assert.match(source, /touchZoomRotate: false/);
  assert.match(source, /function bindCameraOrbitControls\(\)/);
  assert.match(source, /addEventListener\('pointermove'/);
  assert.match(source, /addEventListener\('wheel'/);
  assert.match(source, /viewBearing = position\.bearing \+ cameraOrbit\.azimuth/);
  assert.match(source, /cameraOrbit = \{ \.\.\.CAMERA_ORBIT_DEFAULT \}/);
});
