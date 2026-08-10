import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  STOPS,
  SEGMENT_SECONDS,
  CRUISE_ALTITUDE,
  DEPARTURE_PATH,
  DEPARTURE_SECONDS
} from './route.js';

const initialPlaneState = () => ({
  lng: DEPARTURE_PATH[0].lng,
  lat: DEPARTURE_PATH[0].lat,
  alt: DEPARTURE_PATH[0].alt,
  bearing: bearing(DEPARTURE_PATH[0], DEPARTURE_PATH[1]),
  bank: 0,
  pitch: 0,
  scale: 0.52,
  throttle: 0.24
});

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: [DEPARTURE_PATH[0].lng, DEPARTURE_PATH[0].lat],
  zoom: 17.3,
  pitch: 72,
  bearing: bearing(DEPARTURE_PATH[0], DEPARTURE_PATH[1]),
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

  setStop(index);
  setAltitude(planeState.alt);
  pauseBtn.disabled = true;
  pauseBtn.textContent = 'PAUSA';
  pauseBtn.setAttribute('aria-pressed', 'false');
  startBtn.disabled = false;
  startBtn.textContent = isLastStop
    ? 'VOLVER A VOLAR'
    : index === 0 ? 'DESPEGAR' : 'CONTINUAR';
  setStatus(isLastStop
    ? 'Recorrido completo · CEAMSE'
    : index === 0 ? 'Lista para carretear por Av. 25 de Mayo' : `Vista previa · ${stop.name}`);

  map.flyTo({
    center: [planeState.lng, planeState.lat],
    zoom: index === 0 ? 17.3 : stop.zoom,
    pitch: 67,
    bearing: planeState.bearing,
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

function interpolate(a, b, progress) {
  const eased = smooth(progress);
  const arc = Math.sin(Math.PI * progress);
  const routeBearing = bearing(a, b);
  let altitude = a.alt + (b.alt - a.alt) * eased + arc * CRUISE_ALTITUDE;

  if (segment === 0) altitude = a.alt + (b.alt - a.alt) * eased + arc * 105;
  if (segment === STOPS.length - 2) {
    altitude = a.alt + (b.alt - a.alt) * eased + arc * 95;
  }

  const incomingBearing = segment === 0
    ? routeBearing
    : bearing(STOPS[segment - 1], a);
  const bank = Math.sin(Math.PI * progress)
    * Math.max(-13, Math.min(13, angleDelta(incomingBearing, routeBearing) * 0.22));

  return {
    lng: a.lng + (b.lng - a.lng) * eased,
    lat: a.lat + (b.lat - a.lat) * eased,
    alt: altitude,
    bearing: routeBearing,
    bank,
    pitch: segment === 0 ? 7 * (1 - eased) : 0,
    scale: 1,
    throttle: 0.86
  };
}

function interpolateDeparture(a, b, progress, phase) {
  const routeBearing = bearing(a, b);
  if (phase === 0) {
    const accelerated = progress * progress;
    return {
      lng: a.lng + (b.lng - a.lng) * accelerated,
      lat: a.lat + (b.lat - a.lat) * accelerated,
      alt: a.alt + Math.sin(progress * Math.PI * 8) * 0.12,
      bearing: routeBearing,
      bank: Math.sin(progress * Math.PI * 6) * 0.25,
      pitch: Math.sin(progress * Math.PI * 8) * 0.3,
      scale: 0.52,
      throttle: 0.24 + progress * 0.34
    };
  }

  const accelerated = smooth(progress);
  const lift = smooth(Math.max(0, Math.min(1, (progress - 0.38) / 0.62)));
  return {
    lng: a.lng + (b.lng - a.lng) * accelerated,
    lat: a.lat + (b.lat - a.lat) * accelerated,
    alt: a.alt + (b.alt - a.alt) * lift,
    bearing: routeBearing,
    bank: 0,
    pitch: lift === 0 ? 0 : 11 * Math.sin(lift * Math.PI * 0.72),
    scale: 0.52 + lift * 0.48,
    throttle: 0.58 + progress * 0.42
  };
}

function cameraFollow(position) {
  const radians = (position.bearing + 180) * Math.PI / 180;
  const distance = flightStage === 'departure' ? 0.00023 : 0.00035;
  const center = [
    position.lng + Math.sin(radians) * distance,
    position.lat + Math.cos(radians) * distance
  ];

  map.jumpTo({
    center,
    zoom: flightStage === 'departure' ? 17.25 : position.alt < 120 ? 16.8 : 16.5,
    pitch: flightStage === 'departure' ? 72 : 68,
    bearing: position.bearing
  });
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
  cameraFollow(planeState);
  map.triggerRepaint();

  if (progress >= 1) {
    if (flightStage === 'departure') {
      departurePhase += 1;
      segmentStart = now;
      if (departurePhase < DEPARTURE_SECONDS.length) {
        setStatus('Carrera de despegue · Av. 25 de Mayo');
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
    ? 'Carreteando por Av. 25 de Mayo'
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
  setStop(0);
  setAltitude(planeState.alt);
  startBtn.disabled = false;
  startBtn.textContent = 'DESPEGAR';
  pauseBtn.disabled = true;
  pauseBtn.textContent = 'PAUSA';
  pauseBtn.setAttribute('aria-pressed', 'false');
  setStatus('Lista para carretear por Av. 25 de Mayo');

  const transition = {
    center: [planeState.lng, planeState.lat],
    zoom: 17.3,
    pitch: 72,
    bearing: planeState.bearing,
    duration: animateMap ? 1600 : 0,
    essential: false
  };
  if (animateMap) map.flyTo(transition);
  else map.jumpTo(transition);
  map.triggerRepaint();
}

startBtn.addEventListener('click', start);
restartBtn.addEventListener('click', () => reset());
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
        ? 'Carreteando por Av. 25 de Mayo'
        : 'Carrera de despegue · Av. 25 de Mayo'
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
  setStatus('Lista para carretear por Av. 25 de Mayo');

  const layers = map.getStyle().layers || [];
  const firstLabel = layers.find(layer => layer.type === 'symbol');
  if (map.getSource('openmaptiles')) {
    map.addLayer({
      id: '3d-buildings',
      source: 'openmaptiles',
      'source-layer': 'building',
      type: 'fill-extrusion',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': '#c9c5bd',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], ['get', 'height'], 8],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.78
      }
    }, firstLabel?.id);
  }

  map.addSource('route', {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          ...DEPARTURE_PATH.map(point => [point.lng, point.lat]),
          ...STOPS.slice(1).map(stop => [stop.lng, stop.lat])
        ]
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
  map.addLayer(makeAircraftLayer());
});

function makeAircraftLayer() {
  let renderer;
  let scene;
  let camera;
  let aircraft;
  let propellers = [];
  let aircraftScale = 4.4;

  return {
    id: 'aircraft-3d',
    type: 'custom',
    renderingMode: '3d',
    onAdd(layerMap, gl) {
      camera = new THREE.Camera();
      scene = new THREE.Scene();
      const fallback = createFallbackAircraft();
      aircraft = fallback.aircraft;
      propellers = fallback.propellers;
      aircraft.scale.setScalar(4.4);
      scene.add(aircraft);
      document.documentElement.dataset.aircraftModel = 'fallback';

      new GLTFLoader().load(
        './assets/models/c172p/aircraft.glb',
        gltf => {
          const loadedAircraft = gltf.scene;
          const loadedPropellers = [];
          loadedAircraft.traverse(object => {
            object.frustumCulled = false;
            if (object.name.startsWith('Propeller')) loadedPropellers.push(object);
            if (object.isMesh && object.material?.color) {
              object.material.color.lerp(new THREE.Color(0xff6a32), 0.28);
            }
          });
          loadedAircraft.scale.setScalar(8);
          scene.remove(aircraft);
          disposeObject(aircraft);
          aircraft = loadedAircraft;
          aircraftScale = 8;
          propellers = loadedPropellers;
          scene.add(aircraft);
          document.documentElement.dataset.aircraftModel = 'c172p';
          if (flightState === 'ready') setStatus('Cessna 172P lista para carretear');
          map.triggerRepaint();
        },
        undefined,
        error => {
          console.error('No se pudo cargar la Cessna 172P; se conserva el modelo de respaldo.', error);
          if (flightState === 'ready') setStatus('Lista para carretear · aeronave de respaldo');
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
      if (!aircraft) return;
      aircraft.scale.setScalar(aircraftScale * (planeState.scale ?? 1));
      propellers.forEach(propeller => {
        propeller.rotation.x += 0.12 + (planeState.throttle ?? 0.8) * 0.62;
      });
      const coordinate = maplibregl.MercatorCoordinate.fromLngLat(
        [planeState.lng, planeState.lat],
        planeState.alt
      );
      const scale = coordinate.meterInMercatorCoordinateUnits();
      const projection = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
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

function createFallbackAircraft() {
  const accent = new THREE.MeshStandardMaterial({ color: 0xff4f2e, roughness: 0.48 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x18262d, roughness: 0.7 });
  const aircraft = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1, 5.8, 8, 16), accent);
  body.rotation.z = Math.PI / 2;
  aircraft.add(body);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(1, 11.5, 0.22), dark);
  wing.position.set(0, 0, 1.05);
  aircraft.add(wing);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.2, 0.18), accent);
  tail.position.set(-3.2, 0, 0.45);
  aircraft.add(tail);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 1.7), accent);
  fin.position.set(-3.35, 0, 1.05);
  fin.rotation.y = -0.25;
  aircraft.add(fin);

  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.82, 1.2, 16), dark);
  nose.rotation.z = Math.PI / 2;
  nose.position.x = 3.25;
  aircraft.add(nose);

  const propeller = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.5, 0.18), dark);
  propeller.add(blade);
  propeller.position.x = 3.9;
  aircraft.add(propeller);
  return { aircraft, propellers: [propeller] };
}

function disposeObject(object) {
  object.traverse(child => {
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach(material => material.dispose());
  });
}
