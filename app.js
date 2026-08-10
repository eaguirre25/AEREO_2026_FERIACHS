import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import {
  STOPS,
  SEGMENT_SECONDS,
  CRUISE_ALTITUDE,
  DEPARTURE_PATH,
  DEPARTURE_SECONDS,
  LANDMARKS
} from './route.js';

const AIRSHIP_BASE_SCALE = 8.4;
const TRAIL_MAX_POINTS = 42;
const TRAIL_SAMPLE_MS = 140;

const initialPlaneState = () => ({
  lng: DEPARTURE_PATH[0].lng,
  lat: DEPARTURE_PATH[0].lat,
  alt: DEPARTURE_PATH[0].alt,
  bearing: bearing(DEPARTURE_PATH[1], DEPARTURE_PATH[2]),
  bank: 0,
  pitch: 0,
  scale: 0.72,
  throttle: 0.32
});

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: [DEPARTURE_PATH[0].lng, DEPARTURE_PATH[0].lat],
  zoom: 16.4,
  pitch: 58,
  bearing: bearing(DEPARTURE_PATH[1], DEPARTURE_PATH[2]),
  antialias: true,
  attributionControl: false
});

map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right');
window.setTimeout(() => {
  map.getContainer()
    .querySelector('.maplibregl-ctrl-attrib')
    ?.classList.remove('maplibregl-compact-show');
}, 0);

const $ = selector => document.querySelector(selector);
const stopName = $('#stopName');
const stopMeta = $('#stopMeta');
const altitudeEl = $('#altitude');
const statusEl = $('#status');
const satelliteCredit = $('#satelliteCredit');
const mapModeBtn = $('#mapModeBtn');
const startBtn = $('#startBtn');
const pauseBtn = $('#pauseBtn');
const restartBtn = $('#restartBtn');
const nav = $('#routeNav');

let flightState = 'ready';
let flightStage = 'departure';
let departurePhase = 0;
let segment = 0;
let segmentStart = 0;
let pausedAt = 0;
let animationFrameId = null;
let planeState = initialPlaneState();
let mapReady = false;
let satelliteEnabled = true;
let vectorFillLayers = [];
let trailHistory = [initialPlaneState()];
let lastTrailSample = 0;

STOPS.forEach((stop, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = String(index + 1).padStart(2, '0');
  button.setAttribute('aria-label', `Posta ${index + 1}: ${stop.name}`);
  button.addEventListener('click', () => previewStop(index));
  nav.appendChild(button);
});

const navButtons = [...nav.querySelectorAll('button')];

function setStop(index) {
  const stop = STOPS[index];
  stopName.textContent = stop.name.toUpperCase();
  stopMeta.textContent = `POSTA ${String(stop.id).padStart(2, '0')} · ${stop.label}`;
  navButtons.forEach((button, buttonIndex) => {
    const active = buttonIndex === index;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
}

function setAltitude(altitude) {
  altitudeEl.textContent = `${Math.round(altitude)} m`;
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function setMapMode(useSatellite) {
  if (!map.getLayer('satellite-imagery')) return;
  satelliteEnabled = useSatellite;
  map.setLayoutProperty(
    'satellite-imagery',
    'visibility',
    satelliteEnabled ? 'visible' : 'none'
  );
  vectorFillLayers.forEach(layer => {
    if (map.getLayer(layer.id)) {
      map.setLayoutProperty(
        layer.id,
        'visibility',
        satelliteEnabled ? 'none' : layer.visibility
      );
    }
  });
  mapModeBtn.textContent = satelliteEnabled ? 'SATÉLITE' : 'MAPA';
  mapModeBtn.setAttribute('aria-pressed', String(satelliteEnabled));
  mapModeBtn.setAttribute(
    'aria-label',
    satelliteEnabled ? 'Usar mapa vectorial' : 'Usar vista satelital'
  );
  mapModeBtn.classList.toggle('active', satelliteEnabled);
  satelliteCredit.hidden = !satelliteEnabled;
}

function cancelAnimation() {
  if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
}

function previewStop(index) {
  cancelAnimation();
  const stop = STOPS[index];
  const isLastStop = index === STOPS.length - 1;

  flightState = isLastStop ? 'completed' : 'previewing';
  flightStage = index === 0 ? 'departure' : 'route';
  departurePhase = 0;
  segment = Math.min(index, STOPS.length - 2);
  segmentStart = 0;
  planeState = index === 0
    ? initialPlaneState()
    : {
        ...planeState,
        lng: stop.lng,
        lat: stop.lat,
        alt: stop.alt,
        bearing: isLastStop
          ? bearing(STOPS[index - 1], stop)
          : bearing(stop, STOPS[index + 1]),
        bank: 0,
        pitch: 0,
        scale: 1,
        throttle: 0.82
      };
  trailHistory = [{ lng: planeState.lng, lat: planeState.lat, alt: planeState.alt }];
  lastTrailSample = 0;
  syncTrailSource();

  setStop(index);
  setAltitude(planeState.alt);
  pauseBtn.disabled = true;
  pauseBtn.textContent = 'PAUSA';
  pauseBtn.setAttribute('aria-pressed', 'false');
  startBtn.disabled = false;
  startBtn.textContent = isLastStop
    ? 'VOLVER A VOLAR'
    : index === 0 ? 'ELEVAR' : 'CONTINUAR';
  setStatus(isLastStop
    ? 'Recorrido completo · CEAMSE'
    : index === 0 ? 'Dirigible listo para elevarse desde UNSAM' : `Vista previa · ${stop.name}`);

  map.flyTo({
    ...thirdPersonView(planeState),
    duration: 1800,
    essential: false
  });
  map.triggerRepaint();
}

function bearing(a, b) {
  const deltaLng = (b.lng - a.lng) * Math.PI / 180;
  const latA = a.lat * Math.PI / 180;
  const latB = b.lat * Math.PI / 180;
  const y = Math.sin(deltaLng) * Math.cos(latB);
  const x = Math.cos(latA) * Math.sin(latB)
    - Math.sin(latA) * Math.cos(latB) * Math.cos(deltaLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function angleDelta(from, to) {
  return ((to - from + 540) % 360) - 180;
}

const smooth = value => value * value * (3 - 2 * value);

const catmullRom = (p0, p1, p2, p3, t) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1
    + (-p0 + p2) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
    + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
};

const routePoints = [DEPARTURE_PATH.at(-1), ...STOPS.slice(1)];

function routeCurvePoint(index, progress) {
  const p1 = routePoints[index];
  const p2 = routePoints[index + 1];
  const p0 = routePoints[index - 1] ?? {
    lng: p1.lng * 2 - p2.lng,
    lat: p1.lat * 2 - p2.lat
  };
  const p3 = routePoints[index + 2] ?? {
    lng: p2.lng * 2 - p1.lng,
    lat: p2.lat * 2 - p1.lat
  };
  return {
    lng: catmullRom(p0.lng, p1.lng, p2.lng, p3.lng, progress),
    lat: catmullRom(p0.lat, p1.lat, p2.lat, p3.lat, progress)
  };
}

function sampledRouteCoordinates() {
  const curved = [];
  for (let routeSegment = 0; routeSegment < routePoints.length - 1; routeSegment += 1) {
    for (let sample = 0; sample <= 24; sample += 1) {
      if (routeSegment > 0 && sample === 0) continue;
      const point = routeCurvePoint(routeSegment, sample / 24);
      curved.push([point.lng, point.lat]);
    }
  }
  return [
    ...DEPARTURE_PATH.slice(0, -1).map(point => [point.lng, point.lat]),
    ...curved
  ];
}

function recordTrail(position, now, force = false) {
  if (!force && now - lastTrailSample < TRAIL_SAMPLE_MS) return;
  trailHistory.push({ lng: position.lng, lat: position.lat, alt: position.alt });
  if (trailHistory.length > TRAIL_MAX_POINTS) trailHistory.shift();
  lastTrailSample = now;
  syncTrailSource();
}

function syncTrailSource() {
  if (!mapReady) return;
  const source = map.getSource('airship-trail');
  if (!source) return;
  const coordinates = trailHistory.map(point => [point.lng, point.lat]);
  if (coordinates.length === 1) coordinates.push([...coordinates[0]]);
  source.setData({
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates }
  });
}

function interpolate(a, b, progress) {
  const eased = smooth(progress);
  const arc = Math.sin(Math.PI * progress);
  const current = routeCurvePoint(segment, progress);
  const nextProgress = Math.min(1, progress + 0.002);
  let ahead = routeCurvePoint(segment, nextProgress);
  if (nextProgress === 1 && segment < routePoints.length - 2) {
    ahead = routeCurvePoint(segment + 1, 0.002);
  }
  const routeBearing = bearing(current, ahead);
  let altitude = a.alt + (b.alt - a.alt) * eased + arc * CRUISE_ALTITUDE;

  if (segment === 0) altitude = a.alt + (b.alt - a.alt) * eased + arc * 35;
  if (segment === STOPS.length - 2) {
    altitude = a.alt + (b.alt - a.alt) * eased + arc * 25;
  }

  const incomingBearing = segment === 0
    ? routeBearing
    : bearing(STOPS[segment - 1], a);
  const bank = Math.sin(Math.PI * progress)
    * Math.max(-6, Math.min(6, angleDelta(incomingBearing, routeBearing) * 0.12));

  return {
    lng: current.lng,
    lat: current.lat,
    alt: altitude,
    bearing: routeBearing,
    bank,
    pitch: segment === 0 ? 1.5 * (1 - eased) : 0,
    scale: 1,
    throttle: 0.86
  };
}

function interpolateDeparture(a, b, progress, phase) {
  const routeBearing = phase === 0
    ? bearing(DEPARTURE_PATH[1], DEPARTURE_PATH[2])
    : bearing(a, b);
  if (phase === 0) {
    const accelerated = progress * progress;
    return {
      lng: a.lng + (b.lng - a.lng) * accelerated,
      lat: a.lat + (b.lat - a.lat) * accelerated,
      alt: a.alt + (b.alt - a.alt) * smooth(progress)
        + Math.sin(progress * Math.PI * 4) * 0.35,
      bearing: routeBearing,
      bank: Math.sin(progress * Math.PI * 4) * 0.35,
      pitch: 0,
      scale: 0.72 + smooth(progress) * 0.28,
      throttle: 0.32 + progress * 0.18
    };
  }

  const accelerated = smooth(progress);
  const lift = smooth(progress);
  return {
    lng: a.lng + (b.lng - a.lng) * accelerated,
    lat: a.lat + (b.lat - a.lat) * accelerated,
    alt: a.alt + (b.alt - a.alt) * lift,
    bearing: routeBearing,
    bank: 0,
    pitch: 1.8 * Math.sin(Math.PI * progress),
    scale: 1,
    throttle: 0.5 + progress * 0.18
  };
}

function thirdPersonView(position) {
  const radians = position.bearing * Math.PI / 180;
  const distance = flightStage === 'departure'
    ? 0.00038
    : position.alt < 120 ? 0.00062 : 0.00078;
  const center = [
    position.lng + Math.sin(radians) * distance,
    position.lat + Math.cos(radians) * distance
  ];

  return {
    center,
    zoom: flightStage === 'departure' ? 16.4 : position.alt < 120 ? 16.2 : 15.95,
    pitch: flightStage === 'departure' ? 58 : 56,
    bearing: position.bearing + 6
  };
}

function cameraFollow(position) {
  map.jumpTo(thirdPersonView(position));
}

function completeFlight() {
  cancelAnimation();
  flightState = 'completed';
  pauseBtn.disabled = true;
  pauseBtn.textContent = 'PAUSA';
  pauseBtn.setAttribute('aria-pressed', 'false');
  startBtn.disabled = false;
  startBtn.textContent = 'VOLVER A VOLAR';
  setStatus('Recorrido completo · CEAMSE');
  map.easeTo({ zoom: 14.7, pitch: 62, duration: 2500, essential: false });
}

function animate(now) {
  if (flightState !== 'playing') return;

  const duration = (flightStage === 'departure'
    ? DEPARTURE_SECONDS[departurePhase]
    : SEGMENT_SECONDS[segment]) * 1000;
  const progress = Math.min(1, (now - segmentStart) / duration);
  if (flightStage === 'departure') {
    planeState = interpolateDeparture(
      DEPARTURE_PATH[departurePhase],
      DEPARTURE_PATH[departurePhase + 1],
      progress,
      departurePhase
    );
  } else {
    const origin = segment === 0 ? DEPARTURE_PATH.at(-1) : STOPS[segment];
    planeState = interpolate(origin, STOPS[segment + 1], progress);
  }
  setAltitude(planeState.alt);
  recordTrail(planeState, now);
  cameraFollow(planeState);
  map.triggerRepaint();

  if (progress >= 1) {
    if (flightStage === 'departure') {
      departurePhase += 1;
      segmentStart = now;
      if (departurePhase < DEPARTURE_SECONDS.length) {
        setStatus('Avance inicial sobre Av. 25 de Mayo');
      } else {
        flightStage = 'route';
        departurePhase = DEPARTURE_SECONDS.length - 1;
        setStatus(`En ascenso · rumbo a ${STOPS[1].name}`);
      }
      animationFrameId = requestAnimationFrame(animate);
      return;
    }

    segment += 1;
    setStop(segment);
    if (segment >= STOPS.length - 1) {
      completeFlight();
      return;
    }
    segmentStart = now;
    setStatus(`Rumbo a ${STOPS[segment + 1].name}`);
  }

  animationFrameId = requestAnimationFrame(animate);
}

function start() {
  if (flightState === 'completed' || segment >= STOPS.length - 1) reset(false);
  flightState = 'playing';
  segmentStart = performance.now();
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  pauseBtn.textContent = 'PAUSA';
  pauseBtn.setAttribute('aria-pressed', 'false');
  setStatus(flightStage === 'departure'
    ? 'Elevación suave desde UNSAM'
    : `Rumbo a ${STOPS[segment + 1].name}`);
  cancelAnimation();
  animationFrameId = requestAnimationFrame(animate);
}

function reset(animateMap = true) {
  cancelAnimation();
  flightState = 'ready';
  flightStage = 'departure';
  departurePhase = 0;
  segment = 0;
  segmentStart = 0;
  pausedAt = 0;
  planeState = initialPlaneState();
  trailHistory = [{ lng: planeState.lng, lat: planeState.lat, alt: planeState.alt }];
  lastTrailSample = 0;
  syncTrailSource();
  setStop(0);
  setAltitude(planeState.alt);
  startBtn.disabled = false;
  startBtn.textContent = 'ELEVAR';
  pauseBtn.disabled = true;
  pauseBtn.textContent = 'PAUSA';
  pauseBtn.setAttribute('aria-pressed', 'false');
  setStatus('Dirigible listo para elevarse desde UNSAM');

  const transition = {
    ...thirdPersonView(planeState),
    duration: animateMap ? 1600 : 0,
    essential: false
  };
  if (animateMap) map.flyTo(transition);
  else map.jumpTo(transition);
  map.triggerRepaint();
}

startBtn.addEventListener('click', start);
restartBtn.addEventListener('click', () => reset());
mapModeBtn.addEventListener('click', () => setMapMode(!satelliteEnabled));
pauseBtn.addEventListener('click', () => {
  if (flightState === 'playing') {
    flightState = 'paused';
    pausedAt = performance.now();
    cancelAnimation();
    pauseBtn.textContent = 'SEGUIR';
    pauseBtn.setAttribute('aria-pressed', 'true');
    setStatus('Vuelo en pausa');
    return;
  }

  if (flightState === 'paused') {
    segmentStart += performance.now() - pausedAt;
    flightState = 'playing';
    pauseBtn.textContent = 'PAUSA';
    pauseBtn.setAttribute('aria-pressed', 'false');
    setStatus(flightStage === 'departure'
      ? departurePhase === 0
        ? 'Elevación suave desde UNSAM'
        : 'Avance inicial sobre Av. 25 de Mayo'
      : `Rumbo a ${STOPS[segment + 1].name}`);
    animationFrameId = requestAnimationFrame(animate);
  }
});

setStop(0);
setAltitude(planeState.alt);

const loadTimeout = window.setTimeout(() => {
  if (!mapReady) setStatus('No se pudo cargar el mapa. Verificá tu conexión y reintentá.', true);
}, 15000);

map.on('error', event => {
  console.error('Error de MapLibre:', event.error ?? event);
});

map.on('styleimagemissing', event => {
  if (!map.hasImage(event.id)) {
    map.addImage(event.id, {
      width: 1,
      height: 1,
      data: new Uint8Array([0, 0, 0, 0])
    });
  }
});

map.on('load', () => {
  mapReady = true;
  window.clearTimeout(loadTimeout);
  window.dispatchEvent(new Event('aereo:ready'));
  window.setTimeout(() => {
    map.getContainer()
      .querySelector('.maplibregl-ctrl-attrib')
      ?.classList.remove('maplibregl-compact-show');
  }, 0);
  setStatus('Dirigible listo para elevarse desde UNSAM');

  const layers = map.getStyle().layers || [];
  vectorFillLayers = layers
    .filter(layer => layer.type === 'fill')
    .map(layer => ({
      id: layer.id,
      visibility: layer.layout?.visibility ?? 'visible'
    }));
  const firstLabel = layers.find(layer => layer.type === 'symbol');
  const firstReference = layers.find(layer => layer.type === 'line') ?? firstLabel;
  layers
    .filter(layer => layer.type === 'fill-extrusion')
    .forEach(layer => map.setLayoutProperty(layer.id, 'visibility', 'none'));
  map.addSource('satellite-imagery', {
    type: 'raster',
    tiles: [
      'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    ],
    tileSize: 256,
    maxzoom: 19,
    attribution: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community'
  });
  map.addLayer({
    id: 'satellite-imagery',
    type: 'raster',
    source: 'satellite-imagery',
    layout: { visibility: 'visible' },
    paint: {
      'raster-opacity': 0.9,
      'raster-saturation': -0.12,
      'raster-contrast': 0.08,
      'raster-fade-duration': 0
    }
  }, firstReference?.id);
  mapModeBtn.disabled = false;
  setMapMode(true);
  if (map.getSource('openmaptiles')) {
    map.addLayer({
      id: '3d-buildings',
      source: 'openmaptiles',
      'source-layer': 'building',
      type: 'fill-extrusion',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': [
          'interpolate', ['linear'],
          ['coalesce', ['get', 'render_height'], ['get', 'height'], 8],
          0, '#0d6680',
          24, '#159a9c',
          80, '#69d2c8'
        ],
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], ['get', 'height'], 8],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.78
      }
    }, firstLabel?.id);
  }

  map.addSource('localidades-san-martin', {
    type: 'geojson',
    data: './assets/data/san-martin-localidades.geojson'
  });
  map.addLayer({
    id: 'localidades-fill',
    type: 'fill',
    source: 'localidades-san-martin',
    paint: {
      'fill-color': [
        'match', ['get', 'siglas'],
        'SM', '#ff5a36',
        'VL', '#25b5c5',
        'SA', '#ffc857',
        'VB', '#8ad36b',
        '#9d7adf'
      ],
      'fill-opacity': 0.1
    }
  }, firstLabel?.id);
  map.addLayer({
    id: 'localidades-outline',
    type: 'line',
    source: 'localidades-san-martin',
    paint: {
      'line-color': '#ffd45a',
      'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.2, 16, 3],
      'line-opacity': 0.9
    }
  });
  map.addLayer({
    id: 'localidades-label',
    type: 'symbol',
    source: 'localidades-san-martin',
    minzoom: 11.5,
    layout: {
      'text-field': ['get', 'Localidad'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 12, 11, 16, 15],
      'text-transform': 'uppercase',
      'text-letter-spacing': 0.12
    },
    paint: {
      'text-color': '#fff7d6',
      'text-halo-color': '#14242d',
      'text-halo-width': 2
    }
  });

  map.addSource('route', {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: sampledRouteCoordinates()
      }
    }
  });
  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    paint: {
      'line-color': '#ff5a36',
      'line-width': 3,
      'line-opacity': 0.72,
      'line-dasharray': [2, 3]
    }
  });

  map.addSource('airship-trail', {
    type: 'geojson',
    lineMetrics: true,
    data: {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [] }
    }
  });
  map.addLayer({
    id: 'airship-trail-glow',
    type: 'line',
    source: 'airship-trail',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-width': 12,
      'line-blur': 7,
      'line-opacity': 0.7,
      'line-gradient': [
        'interpolate', ['linear'], ['line-progress'],
        0, 'rgba(141,233,242,0)',
        0.35, 'rgba(141,233,242,0.35)',
        1, 'rgba(221,252,255,0.95)'
      ]
    }
  });
  map.addLayer({
    id: 'airship-trail-core',
    type: 'line',
    source: 'airship-trail',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-width': 3,
      'line-opacity': 0.92,
      'line-gradient': [
        'interpolate', ['linear'], ['line-progress'],
        0, 'rgba(255,255,255,0)',
        0.45, 'rgba(141,233,242,0.65)',
        1, 'rgba(255,255,255,1)'
      ]
    }
  });
  syncTrailSource();

  map.addSource('postas', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: STOPS.map(stop => ({
        type: 'Feature',
        properties: { name: stop.name, id: stop.id },
        geometry: { type: 'Point', coordinates: [stop.lng, stop.lat] }
      }))
    }
  });
  map.addLayer({
    id: 'postas-dot',
    type: 'circle',
    source: 'postas',
    paint: {
      'circle-radius': 5,
      'circle-color': '#ff5a36',
      'circle-stroke-color': '#111',
      'circle-stroke-width': 2
    }
  });
  map.addLayer({
    id: 'postas-label',
    type: 'symbol',
    source: 'postas',
    layout: {
      'text-field': ['concat', ['to-string', ['get', 'id']], ' · ', ['get', 'name']],
      'text-size': 11,
      'text-offset': [0, 1.2],
      'text-anchor': 'top'
    },
    paint: {
      'text-color': '#fff',
      'text-halo-color': '#111',
      'text-halo-width': 1.5
    }
  });
  LANDMARKS.forEach(landmark => {
    map.addLayer(makeLandmarkLayer(landmark), firstLabel?.id);
  });
  map.addLayer(makeAirshipLayer());
});

function makeLandmarkLayer(config) {
  let renderer;
  let scene;
  let camera;
  let model;

  return {
    id: `landmark-3d-${config.id}`,
    type: 'custom',
    renderingMode: '3d',
    onAdd(layerMap, gl) {
      camera = new THREE.Camera();
      scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x59636b, 2.2));
      const sun = new THREE.DirectionalLight(0xffffff, 2.4);
      sun.position.set(80, -50, 120);
      scene.add(sun);

      new GLTFLoader().load(
        config.model,
        gltf => {
          model = gltf.scene;
          model.scale.setScalar(config.scale ?? 1);
          model.traverse(object => {
            object.frustumCulled = false;
          });
          if (config.palette === 'chacarita') styleChacaritaModel(model);
          scene.add(model);
          document.documentElement.dataset[config.id.replaceAll('-', '')] = 'loaded';
          layerMap.triggerRepaint();
        },
        undefined,
        error => console.error(`No se pudo cargar el hito 3D ${config.id}.`, error)
      );

      renderer = new THREE.WebGLRenderer({
        canvas: layerMap.getCanvas(),
        context: gl,
        antialias: true
      });
      renderer.autoClear = false;
    },
    render(gl, args) {
      if (!model) return;
      const coordinate = maplibregl.MercatorCoordinate.fromLngLat(
        [config.lng, config.lat],
        config.altitude ?? 0
      );
      const units = coordinate.meterInMercatorCoordinateUnits();
      const projection = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
      const local = new THREE.Matrix4()
        .makeTranslation(coordinate.x, coordinate.y, coordinate.z)
        .scale(new THREE.Vector3(units, -units, units));
      const animatedRotation = (config.rotation ?? 0)
        + (config.rotationSpeed ?? 0) * performance.now() / 1000;
      const rotation = new THREE.Matrix4()
        .makeRotationZ(animatedRotation * Math.PI / 180);
      camera.projectionMatrix = projection.multiply(local).multiply(rotation);
      renderer.resetState();
      renderer.render(scene, camera);
    }
  };
}

function makeAirshipLayer() {
  let renderer;
  let scene;
  let camera;
  let trailScene;
  let trailCamera;
  let trailMeshes = [];
  let airship;
  let fans = [];
  const airshipScale = AIRSHIP_BASE_SCALE;

  return {
    id: 'airship-3d',
    type: 'custom',
    renderingMode: '3d',
    onAdd(layerMap, gl) {
      camera = new THREE.Camera();
      scene = new THREE.Scene();
      trailCamera = new THREE.Camera();
      trailScene = new THREE.Scene();
      const trailGeometry = new THREE.SphereGeometry(1, 10, 7);
      trailMeshes = Array.from({ length: TRAIL_MAX_POINTS }, (_, index) => {
        const material = new THREE.MeshBasicMaterial({
          color: index % 3 === 0 ? 0xffffff : 0x8de9f2,
          transparent: true,
          opacity: 0,
          depthWrite: false
        });
        const particle = new THREE.Mesh(trailGeometry, material);
        particle.visible = false;
        trailScene.add(particle);
        return particle;
      });
      const fallback = createFallbackAirship();
      airship = fallback.airship;
      fans = fallback.fans;
      airship.scale.setScalar(airshipScale);
      scene.add(airship);
      document.documentElement.dataset.airshipModel = 'fallback';

      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.178.0/examples/jsm/libs/draco/');
      dracoLoader.setWorkerLimit(1);
      const loader = new GLTFLoader();
      loader.setDRACOLoader(dracoLoader);
      loader.load(
        './assets/models/airship/airship.glb',
        gltf => {
          const loadedAirship = gltf.scene;
          const loadedFans = [];
          loadedAirship.rotation.x = Math.PI / 2;
          loadedAirship.traverse(object => {
            object.frustumCulled = false;
            if (object.name === 'Fan') {
              object.scale.setScalar(1.7);
              loadedFans.push(object);
            }
            if (object.isMesh) {
              const materials = Array.isArray(object.material) ? object.material : [object.material];
              materials.filter(Boolean).forEach(material => {
                if (material.name.startsWith('Logo')) {
                  material.map = null;
                  material.emissiveMap = null;
                  material.color?.set(material.name === 'Logo' ? 0xff6a32 : 0xf5f2e8);
                  material.needsUpdate = true;
                }
              });
            }
          });
          loadedAirship.scale.setScalar(airshipScale);
          scene.remove(airship);
          disposeObject(airship);
          airship = loadedAirship;
          fans = loadedFans;
          scene.add(airship);
          document.documentElement.dataset.airshipModel = 'zoomland';
          if (flightState === 'ready') setStatus('Dirigible listo para elevarse desde UNSAM');
          dracoLoader.dispose();
          map.triggerRepaint();
        },
        undefined,
        error => {
          dracoLoader.dispose();
          console.error('No se pudo cargar el dirigible; se conserva el modelo de respaldo.', error);
          if (flightState === 'ready') setStatus('Dirigible de respaldo listo para elevarse');
        }
      );
      scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.3));
      const sun = new THREE.DirectionalLight(0xffffff, 2);
      sun.position.set(20, -20, 40);
      scene.add(sun);

      renderer = new THREE.WebGLRenderer({
        canvas: layerMap.getCanvas(),
        context: gl,
        antialias: true
      });
      renderer.autoClear = false;
    },
    render(gl, args) {
      if (!airship) return;
      airship.scale.setScalar(airshipScale * (planeState.scale ?? 1));
      fans.forEach(fan => {
        fan.rotation.x += 0.035 + (planeState.throttle ?? 0.6) * 0.11;
      });
      const coordinate = maplibregl.MercatorCoordinate.fromLngLat(
        [planeState.lng, planeState.lat],
        planeState.alt
      );
      const scale = coordinate.meterInMercatorCoordinateUnits();
      const projection = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
      const visibleTrail = Math.min(trailHistory.length, trailMeshes.length);
      trailMeshes.forEach((particle, index) => {
        const point = trailHistory[trailHistory.length - 1 - index];
        particle.visible = Boolean(point);
        if (!point) return;
        const particleCoordinate = maplibregl.MercatorCoordinate.fromLngLat(
          [point.lng, point.lat],
          point.alt
        );
        const age = index / Math.max(1, visibleTrail - 1);
        particle.position.set(particleCoordinate.x, particleCoordinate.y, particleCoordinate.z);
        particle.scale.setScalar(
          particleCoordinate.meterInMercatorCoordinateUnits() * (7.2 - age * 5.2)
        );
        particle.material.opacity = 0.62 * (1 - age) ** 1.2;
      });
      trailCamera.projectionMatrix.copy(projection);
      renderer.resetState();
      renderer.render(trailScene, trailCamera);
      const local = new THREE.Matrix4()
        .makeTranslation(coordinate.x, coordinate.y, coordinate.z)
        .scale(new THREE.Vector3(scale, -scale, scale));
      const rotation = new THREE.Matrix4()
        .makeRotationZ((-planeState.bearing + 90) * Math.PI / 180);
      const bank = new THREE.Matrix4()
        .makeRotationX(planeState.bank * Math.PI / 180);
      const pitch = new THREE.Matrix4()
        .makeRotationY(-(planeState.pitch ?? 0) * Math.PI / 180);
      camera.projectionMatrix = projection.multiply(local).multiply(rotation).multiply(bank).multiply(pitch);
      renderer.resetState();
      renderer.render(scene, camera);
      map.triggerRepaint();
    }
  };
}

function createFallbackAirship() {
  const accent = new THREE.MeshStandardMaterial({ color: 0xff6a32, roughness: 0.52 });
  const light = new THREE.MeshStandardMaterial({ color: 0xf5f2e8, roughness: 0.65 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x18262d, roughness: 0.72 });
  const airship = new THREE.Group();

  const envelope = new THREE.Mesh(new THREE.SphereGeometry(4, 32, 18), light);
  envelope.scale.set(2.5, 1, 1);
  airship.add(envelope);

  const stripe = new THREE.Mesh(new THREE.SphereGeometry(4.04, 32, 18, 0, Math.PI * 2, 1.34, 0.46), accent);
  stripe.scale.set(2.5, 1, 1);
  airship.add(stripe);

  const gondola = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2, 1.5), dark);
  gondola.position.set(0.8, 0, -4.2);
  airship.add(gondola);

  const horizontalTail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 6, 0.22), accent);
  horizontalTail.position.x = -8.6;
  airship.add(horizontalTail);
  const verticalTail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, 4.6), accent);
  verticalTail.position.x = -8.6;
  airship.add(verticalTail);

  const fan = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.2, 0.3), light);
  fan.add(blade);
  const crossBlade = blade.clone();
  crossBlade.rotation.x = Math.PI / 2;
  fan.add(crossBlade);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.7, 16), dark);
  hub.rotation.z = Math.PI / 2;
  fan.add(hub);
  fan.position.set(-10.4, 0, 0);
  airship.add(fan);
  return { airship, fans: [fan] };
}

function styleChacaritaModel(model) {
  const palette = [0xf5f2e8, 0xd71920, 0x111111];
  let standIndex = 0;
  model.traverse(object => {
    if (!object.isMesh) return;
    const name = object.name.toLowerCase();
    let color;
    if (name === 'pitch') color = 0x151515;
    else if (/touchline|goalline|halfway|luces/.test(name)) color = 0xffffff;
    else if (/tribuna|esquina/.test(name)) color = palette[standIndex++ % palette.length];
    else if (/torre|cubierta/.test(name)) color = 0x111111;
    else if (name === 'base') color = 0xd71920;
    else color = palette[standIndex++ % palette.length];

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const styled = materials.filter(Boolean).map(material => {
      const next = material.clone();
      next.map = null;
      next.color?.set(color);
      next.vertexColors = false;
      next.roughness = 0.62;
      next.metalness = 0.05;
      next.needsUpdate = true;
      return next;
    });
    object.material = Array.isArray(object.material) ? styled : styled[0];
  });
}

function disposeObject(object) {
  object.traverse(child => {
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach(material => material.dispose());
  });
}
