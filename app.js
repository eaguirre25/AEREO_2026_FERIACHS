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

const AIRSHIP_BASE_SCALE = 16.8;
const FLIGHT_SPEED_MULTIPLIER = 1.56;
const INITIAL_LEG_SPEED_MULTIPLIER = 1.6;
const PROPELLER_SPIN_MULTIPLIER = 1.9;
const FREE_FLIGHT_SPEEDS_KMH = [20, 40, 60, 90, 120];
const FREE_FLIGHT_MAP_SPEED_MULTIPLIER = 4.5;
const FREE_FLIGHT_TURN_DEGREES_PER_SECOND = 72;
const TRAIL_MAX_POINTS = 42;
const TRAIL_SAMPLE_MS = 140;
const FAIR_TARGET_TIMESTAMP = Date.parse('2026-10-15T00:00:00-03:00');
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const CAMERA_ORBIT_DEFAULT = Object.freeze({ azimuth: 6, pitchOffset: 0, zoomOffset: 0 });
const POSTA_1_SLIDES = Array.from(
  { length: 2 },
  (_, index) => `./assets/materials/posta-1/slide-${String(index + 1).padStart(2, '0')}.webp`
);
const POSTA_2_SLIDES = Array.from(
  { length: 7 },
  (_, index) => `./assets/materials/posta-2/slide-${String(index + 1).padStart(2, '0')}.webp`
);
const POSTA_SLIDES = new Map([
  [0, POSTA_1_SLIDES],
  [1, POSTA_2_SLIDES]
]);
const LOCALITY_COLORS = [
  '#e53935',
  '#f4d03f',
  '#2f80ed',
  '#8bdc65',
  '#f28c28',
  '#8e5bd9'
];
const POSTA_COLORS = [
  '#ff4d4d',
  '#ffd43b',
  '#3f8cff',
  '#8bdc65',
  '#ff922b',
  '#a56eff',
  '#20c9b0',
  '#ff70b7',
  '#f4eee2'
];

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
  attributionControl: false,
  dragPan: false,
  scrollZoom: false,
  touchZoomRotate: false,
  doubleClickZoom: false,
  keyboard: false
});

map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right');
window.setTimeout(() => {
  map.getContainer()
    .querySelector('.maplibregl-ctrl-attrib')
    ?.classList.remove('maplibregl-compact-show');
}, 0);

const $ = selector => document.querySelector(selector);
const stopName = $('#stopName');
const stopTheme = $('#stopTheme');
const stopMeta = $('#stopMeta');
const fairCountdown = $('#fairCountdown');
const countdownDays = $('#countdownDays');
const countdownHours = $('#countdownHours');
const countdownMinutes = $('#countdownMinutes');
const altitudeEl = $('#altitude');
const statusEl = $('#status');
const satelliteCredit = $('#satelliteCredit');
const mapModeBtn = $('#mapModeBtn');
const prevStopBtn = $('#prevStopBtn');
const nextStopBtn = $('#nextStopBtn');
const startBtn = $('#startBtn');
const restartBtn = $('#restartBtn');
const fullscreenBtn = $('#fullscreenBtn');
const fullscreenLabel = $('#fullscreenLabel');
const stopMaterialBtn = $('#stopMaterialBtn');
const nav = $('#routeNav');
const celebration = $('#celebration');
const confetti = $('#confetti');
const experienceSetup = $('#experienceSetup');
const modeChoice = $('#modeChoice');
const orientationPrompt = $('#orientationPrompt');
const mobileModeBtn = $('#mobileModeBtn');
const desktopModeBtn = $('#desktopModeBtn');
const continueMobileBtn = $('#continueMobileBtn');
const journeyIntro = $('#journeyIntro');
const journeyIntroBack = $('#journeyIntroBack');
const journeyIntroContinue = $('#journeyIntroContinue');
const materialOverlay = $('#materialOverlay');
const materialTitle = $('#materialTitle');
const materialBody = $('#materialBody');
const closeMaterialBtn = $('#closeMaterialBtn');
const freeModeBtn = $('#freeModeBtn');
const freeFlightControls = $('#freeFlightControls');
const freeJoystick = $('#freeJoystick');
const freeJoystickKnob = $('#freeJoystickKnob');
const freeSlowerBtn = $('#freeSlowerBtn');
const freeFasterBtn = $('#freeFasterBtn');
const freeSpeedOutput = $('#freeSpeedOutput');
const exitFreeModeBtn = $('#exitFreeModeBtn');
const postaImpact = $('#postaImpact');
const postaImpactParticles = $('#postaImpactParticles');
const postaImpactLabel = $('#postaImpactLabel');

let flightState = 'ready';
let flightStage = 'departure';
let departurePhase = 0;
let segment = 0;
let segmentStart = 0;
let pausedAt = 0;
let animationFrameId = null;
let planeState = initialPlaneState();
let mapReady = false;
let satelliteEnabled = false;
let vectorFillLayers = [];
let trailHistory = [initialPlaneState()];
let lastTrailSample = 0;
let localitiesData = null;
let activeLocalityId = null;
let currentStopIndex = 0;
let celebrationTimer = null;
let materialReturnState = 'ready';
let materialSlideIndex = 0;
let lastMaterialFocus = null;
let cameraOrbit = { ...CAMERA_ORBIT_DEFAULT };
let freeFlightSpeedIndex = 2;
let freeFlightLastFrame = 0;
const freeFlightKeys = new Set();
const freeFlightInput = { turn: 0, thrust: 0 };
const impactedPostas = new Set();
let airshipImpactStartedAt = -Infinity;
let postaImpactHideTimer = null;
let postaArrivalTimer = null;

STOPS.forEach((stop, index) => {
  const button = document.createElement('button');
  const title = document.createElement('span');
  const locality = document.createElement('small');
  button.type = 'button';
  title.textContent = `POSTA ${stop.id}`;
  locality.textContent = stop.name;
  button.style.setProperty('--posta-color', POSTA_COLORS[index]);
  button.append(title, locality);
  button.setAttribute('aria-label', `Posta ${index + 1}: ${stop.name}`);
  button.addEventListener('click', () => previewStop(index));
  nav.appendChild(button);
});

const navButtons = [...nav.querySelectorAll('button')];

function setStop(index) {
  const stop = STOPS[index];
  currentStopIndex = index;
  const postaColor = POSTA_COLORS[index];
  stopName.textContent = `POSTA ${stop.id}`;
  stopTheme.textContent = stop.title.toUpperCase();
  const place = stop.place && stop.place !== stop.name ? ` · ${stop.place}` : '';
  stopMeta.textContent = `${stop.name}${place}`.toUpperCase();
  stopMaterialBtn.setAttribute('aria-label', `Abrir materiales de la Posta ${stop.id}: ${stop.title}`);
  stopName.style.setProperty('--posta-color', postaColor);
  document.documentElement.style.setProperty('--active-posta-color', postaColor);
  prevStopBtn.disabled = index === 0;
  nextStopBtn.disabled = index === STOPS.length - 1;
  prevStopBtn.setAttribute('aria-label', index === 0
    ? 'Ya estás en la primera posta'
    : `Retroceder a Posta ${index}: ${STOPS[index - 1].name}`);
  nextStopBtn.setAttribute('aria-label', index === STOPS.length - 1
    ? 'Ya estás en la última posta'
    : `Avanzar a Posta ${index + 2}: ${STOPS[index + 1].name}`);
  navButtons.forEach((button, buttonIndex) => {
    const active = buttonIndex === index;
    button.classList.toggle('active', active);
    if (active) {
      button.setAttribute('aria-current', 'step');
      window.requestAnimationFrame(() => {
        nav.scrollTo({
          left: button.offsetLeft - (nav.clientWidth - button.clientWidth) / 2,
          behavior: 'smooth'
        });
      });
    }
    else button.removeAttribute('aria-current');
  });
}

function stepToStop(direction) {
  const target = Math.max(0, Math.min(STOPS.length - 1, currentStopIndex + direction));
  if (target !== currentStopIndex) previewStop(target);
}

function setAltitude(altitude) {
  altitudeEl.textContent = `${Math.round(altitude)} m`;
}

function updateFairCountdown(now = Date.now()) {
  const remaining = Math.max(0, FAIR_TARGET_TIMESTAMP - now);
  const days = Math.floor(remaining / DAY_MS);
  const hours = Math.floor((remaining % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((remaining % HOUR_MS) / MINUTE_MS);
  countdownDays.textContent = String(days);
  countdownHours.textContent = String(hours).padStart(2, '0');
  countdownMinutes.textContent = String(minutes).padStart(2, '0');
  fairCountdown.setAttribute(
    'aria-label',
    `Faltan ${days} días, ${hours} horas y ${minutes} minutos para la feria`
  );
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
  mapModeBtn.textContent = satelliteEnabled ? 'MAPA' : 'SATÉLITE';
  mapModeBtn.setAttribute('aria-pressed', String(satelliteEnabled));
  mapModeBtn.setAttribute(
    'aria-label',
    satelliteEnabled ? 'Usar mapa vectorial' : 'Usar vista satelital'
  );
  mapModeBtn.classList.toggle('active', satelliteEnabled);
  satelliteCredit.hidden = !satelliteEnabled;
  document.documentElement.dataset.mapMode = satelliteEnabled ? 'satellite' : 'map';
}

function syncFullscreenButton() {
  const active = Boolean(document.fullscreenElement);
  fullscreenLabel.textContent = active
    ? 'SALIR DE PANTALLA COMPLETA'
    : 'PANTALLA COMPLETA';
  fullscreenBtn.setAttribute('aria-pressed', String(active));
  window.requestAnimationFrame(() => map.resize());
}

async function toggleFullscreen() {
  if (!document.fullscreenEnabled) {
    setStatus('La pantalla completa no está disponible en este navegador.', true);
    return;
  }

  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (error) {
    console.error('No se pudo cambiar el modo de pantalla completa.', error);
    setStatus('No se pudo activar la pantalla completa.', true);
  }
}

function finishExperienceSetup(mode) {
  document.documentElement.dataset.experienceMode = mode;
  experienceSetup.hidden = true;
  experienceSetup.setAttribute('aria-hidden', 'true');
  const returnUrl = new URL('https://eaguirre25.github.io/COMOCREAMOS_MAPA_FERIA_2026/');
  returnUrl.searchParams.set('choose', 'transport');
  returnUrl.searchParams.set('device', mode);
  journeyIntroBack.href = returnUrl.href;
  journeyIntro.hidden = false;
  journeyIntro.setAttribute('aria-hidden', 'false');
  window.requestAnimationFrame(() => journeyIntroContinue.focus());
}

function enterAerialExperience() {
  journeyIntro.hidden = true;
  journeyIntro.setAttribute('aria-hidden', 'true');
  window.requestAnimationFrame(() => {
    map.resize();
    startBtn.focus();
  });
}

function showMobileOrientationPrompt() {
  document.documentElement.dataset.experienceMode = 'mobile';
  modeChoice.hidden = true;
  orientationPrompt.hidden = false;
  continueMobileBtn.focus();
}

mobileModeBtn.addEventListener('click', showMobileOrientationPrompt);

desktopModeBtn.addEventListener('click', () => finishExperienceSetup('desktop'));
continueMobileBtn.addEventListener('click', () => finishExperienceSetup('mobile'));
journeyIntroContinue.addEventListener('click', enterAerialExperience);

const requestedExperienceMode = new URLSearchParams(window.location.search).get('device');
if (requestedExperienceMode === 'desktop') {
  finishExperienceSetup('desktop');
} else if (requestedExperienceMode === 'mobile') {
  showMobileOrientationPrompt();
}

function cancelAnimation() {
  if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
}

function cancelCelebration() {
  window.clearTimeout(celebrationTimer);
  celebrationTimer = null;
  celebration.classList.remove('active');
  celebration.setAttribute('aria-hidden', 'true');
}

function triggerCelebration() {
  cancelCelebration();
  confetti.replaceChildren();
  const reach = Math.hypot(window.innerWidth, window.innerHeight);

  for (let index = 0; index < 110; index += 1) {
    const piece = document.createElement('i');
    const angle = Math.random() * Math.PI * 2;
    const distance = reach * (0.28 + Math.random() * 0.46);
    piece.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    piece.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
    piece.style.setProperty('--turn', `${360 + Math.random() * 1080}deg`);
    piece.style.setProperty('--delay', `${Math.random() * 0.42}s`);
    piece.style.setProperty('--duration', `${2.2 + Math.random() * 1.8}s`);
    piece.style.setProperty('--piece-color', POSTA_COLORS[index % POSTA_COLORS.length]);
    confetti.appendChild(piece);
  }

  void celebration.offsetWidth;
  celebration.classList.add('active');
  celebration.setAttribute('aria-hidden', 'false');
  celebrationTimer = window.setTimeout(cancelCelebration, 6500);
}

function cancelPostaImpact() {
  window.clearTimeout(postaImpactHideTimer);
  window.clearTimeout(postaArrivalTimer);
  postaImpactHideTimer = null;
  postaArrivalTimer = null;
  postaImpact.classList.remove('active');
  postaImpact.setAttribute('aria-hidden', 'true');
}

function triggerPostaImpact(index) {
  window.clearTimeout(postaImpactHideTimer);
  const stop = STOPS[index];
  const color = POSTA_COLORS[index];
  const projected = map.project([stop.lng, stop.lat]);
  const target = stopMaterialBtn.getBoundingClientRect();
  const targetX = target.left + Math.min(target.width * 0.34, 150);
  const targetY = target.top + Math.min(target.height * 0.3, 55);
  const originX = Math.max(140, Math.min(window.innerWidth - 140, projected.x));
  const originY = Math.max(85, Math.min(window.innerHeight - 85, projected.y));

  impactedPostas.add(index);
  airshipImpactStartedAt = performance.now();
  postaImpactLabel.textContent = `POSTA ${stop.id}`;
  postaImpact.style.setProperty('--impact-color', color);
  postaImpact.style.setProperty('--impact-x', `${originX}px`);
  postaImpact.style.setProperty('--impact-y', `${originY}px`);
  postaImpact.style.setProperty('--impact-dx', `${targetX - originX}px`);
  postaImpact.style.setProperty('--impact-dy', `${targetY - originY}px`);
  postaImpactParticles.replaceChildren();
  for (let particleIndex = 0; particleIndex < 30; particleIndex += 1) {
    const particle = document.createElement('i');
    const angle = particleIndex / 30 * Math.PI * 2 + Math.random() * 0.18;
    const reach = 85 + Math.random() * 150;
    particle.style.setProperty('--particle-x', `${Math.cos(angle) * reach}px`);
    particle.style.setProperty('--particle-y', `${Math.sin(angle) * reach}px`);
    particle.style.setProperty('--particle-turn', `${360 + Math.random() * 720}deg`);
    particle.style.setProperty('--particle-delay', `${Math.random() * 90}ms`);
    particle.style.setProperty('--particle-color', POSTA_COLORS[
      (index + particleIndex) % POSTA_COLORS.length
    ]);
    postaImpactParticles.appendChild(particle);
  }

  postaImpact.classList.remove('active');
  void postaImpact.offsetWidth;
  postaImpact.classList.add('active');
  postaImpact.setAttribute('aria-hidden', 'false');
  document.documentElement.dataset.lastPostaImpact = String(stop.id);
  document.documentElement.dataset.airshipImpact = 'burst';
  map.triggerRepaint();
  postaImpactHideTimer = window.setTimeout(() => {
    postaImpact.classList.remove('active');
    postaImpact.setAttribute('aria-hidden', 'true');
    document.documentElement.dataset.airshipImpact = 'complete';
  }, 1320);
}

function schedulePostaImpact(index, delay = 0) {
  window.clearTimeout(postaArrivalTimer);
  postaArrivalTimer = window.setTimeout(() => triggerPostaImpact(index), delay);
}

function setFlightButton(label, pressed = false) {
  startBtn.textContent = label;
  startBtn.disabled = false;
  startBtn.setAttribute('aria-pressed', String(pressed));
}

function renderPostaSlide() {
  const slides = POSTA_SLIDES.get(currentStopIndex);
  if (!slides?.length) return;
  materialBody.replaceChildren();
  const viewer = document.createElement('div');
  const stage = document.createElement('div');
  const previous = document.createElement('button');
  const image = document.createElement('img');
  const next = document.createElement('button');
  const counter = document.createElement('div');

  viewer.className = 'slide-viewer';
  stage.className = 'slide-stage';
  previous.className = 'slide-nav prev';
  next.className = 'slide-nav next';
  counter.className = 'slide-counter';
  previous.type = 'button';
  next.type = 'button';
  previous.textContent = '‹';
  next.textContent = '›';
  previous.setAttribute('aria-label', 'Placa anterior');
  next.setAttribute('aria-label', 'Placa siguiente');
  previous.disabled = materialSlideIndex === 0;
  next.disabled = materialSlideIndex === slides.length - 1;
  image.src = slides[materialSlideIndex];
  image.alt = `Material de la Posta ${currentStopIndex + 1}, placa ${materialSlideIndex + 1} de ${slides.length}`;
  counter.textContent = `${materialSlideIndex + 1} / ${slides.length}`;

  previous.addEventListener('click', () => {
    materialSlideIndex = Math.max(0, materialSlideIndex - 1);
    renderPostaSlide();
  });
  next.addEventListener('click', () => {
    materialSlideIndex = Math.min(slides.length - 1, materialSlideIndex + 1);
    renderPostaSlide();
  });
  let touchStartX = null;
  stage.addEventListener('touchstart', event => {
    touchStartX = event.changedTouches[0]?.clientX ?? null;
  }, { passive: true });
  stage.addEventListener('touchend', event => {
    if (touchStartX === null) return;
    const deltaX = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
    touchStartX = null;
    if (Math.abs(deltaX) >= 48) stepMaterialSlide(deltaX < 0 ? 1 : -1);
  }, { passive: true });
  stage.append(previous, image, next);
  viewer.append(stage, counter);
  materialBody.appendChild(viewer);
}

function renderMaterial(index) {
  const stop = STOPS[index];
  materialTitle.textContent = `POSTA ${stop.id} · ${stop.title}`;
  if (POSTA_SLIDES.has(index)) {
    materialSlideIndex = 0;
    renderPostaSlide();
    return;
  }
  const empty = document.createElement('div');
  empty.className = 'empty-material';
  empty.setAttribute('aria-label', `Espacio reservado para los materiales de la Posta ${stop.id}`);
  materialBody.replaceChildren(empty);
}

function openMaterial(index = currentStopIndex) {
  if (materialOverlay.classList.contains('open')) return;
  lastMaterialFocus = document.activeElement;
  materialReturnState = flightState;
  if (flightState === 'playing') {
    pausedAt = performance.now();
    cancelAnimation();
  }
  flightState = 'material';
  renderMaterial(index);
  const continuesRoute = materialReturnState === 'playing' || materialReturnState === 'stopped';
  closeMaterialBtn.textContent = continuesRoute ? '✕ CERRAR Y CONTINUAR' : '✕ CERRAR';
  materialOverlay.classList.add('open');
  materialOverlay.setAttribute('aria-hidden', 'false');
  closeMaterialBtn.focus();
  map.triggerRepaint();
}

function closeMaterial() {
  if (!materialOverlay.classList.contains('open')) return;
  materialOverlay.classList.remove('open');
  materialOverlay.setAttribute('aria-hidden', 'true');

  if (materialReturnState === 'stopped') {
    resumeFlight(true);
  } else if (materialReturnState === 'playing') {
    resumeFlight(false);
  } else {
    flightState = materialReturnState;
    if (flightState === 'paused') setFlightButton('CONTINUAR', true);
    else if (flightState === 'ready') setFlightButton('INICIAR');
    else if (flightState === 'completed') setFlightButton('VOLVER A VOLAR');
  }
  lastMaterialFocus?.focus?.();
}

function stepMaterialSlide(direction) {
  const slides = POSTA_SLIDES.get(currentStopIndex);
  if (!slides?.length || !materialOverlay.classList.contains('open')) return;
  materialSlideIndex = Math.max(
    0,
    Math.min(slides.length - 1, materialSlideIndex + direction)
  );
  renderPostaSlide();
}

function previewStop(index) {
  cancelAnimation();
  const stop = STOPS[index];
  const isLastStop = index === STOPS.length - 1;

  window.clearTimeout(postaArrivalTimer);
  impactedPostas.delete(index);
  resetFreeFlightInput();
  freeFlightControls.hidden = true;
  freeModeBtn.hidden = !isLastStop;
  document.documentElement.dataset.flightMode = 'route';

  flightState = isLastStop ? 'completed' : index === 0 ? 'ready' : 'stopped';
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
  updateActiveLocality(planeState);

  setStop(index);
  setAltitude(planeState.alt);
  setFlightButton(isLastStop
    ? 'VOLVER A VOLAR'
    : index === 0 ? 'INICIAR' : 'CONTINUAR');
  setStatus(isLastStop
    ? 'Recorrido completo · José L. Suárez'
    : index === 0 ? 'Dirigible listo para elevarse desde UNSAM' : `Vista previa · ${stop.name}`);
  if (isLastStop) triggerCelebration();
  else cancelCelebration();

  map.flyTo({
    ...thirdPersonView(planeState),
    duration: 1800,
    essential: false
  });
  schedulePostaImpact(index, 900);
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

function pointInRing([x, y], ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [currentX, currentY] = ring[index];
    const [previousX, previousY] = ring[previous];
    const crosses = (currentY > y) !== (previousY > y)
      && x < (previousX - currentX) * (y - currentY) / (previousY - currentY) + currentX;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point, polygon) {
  return pointInRing(point, polygon[0])
    && !polygon.slice(1).some(ring => pointInRing(point, ring));
}

function featureContainsPosition(feature, position) {
  const point = [position.lng, position.lat];
  const polygons = feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;
  return polygons.some(polygon => pointInPolygon(point, polygon));
}

function updateActiveLocality(position) {
  if (!mapReady || !localitiesData || !map.getSource('localidades-san-martin')) return;
  const activeFeature = localitiesData.features.find(feature =>
    featureContainsPosition(feature, position)
  );
  const nextId = activeFeature?.properties.id ?? null;
  if (nextId === activeLocalityId) return;
  if (activeLocalityId !== null) {
    map.setFeatureState(
      { source: 'localidades-san-martin', id: activeLocalityId },
      { active: false }
    );
  }
  if (nextId !== null) {
    map.setFeatureState(
      { source: 'localidades-san-martin', id: nextId },
      { active: true }
    );
  }
  activeLocalityId = nextId;
  document.documentElement.dataset.activeLocality = activeFeature?.properties.Localidad ?? 'outside';
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
  const viewBearing = position.bearing + cameraOrbit.azimuth;
  const radians = viewBearing * Math.PI / 180;
  const distance = flightStage === 'departure'
    ? 0.00038
    : position.alt < 120 ? 0.00062 : 0.00078;
  const center = [
    position.lng + Math.sin(radians) * distance,
    position.lat + Math.cos(radians) * distance
  ];

  return {
    center,
    zoom: (flightStage === 'departure' ? 16.4 : position.alt < 120 ? 16.2 : 15.95)
      + cameraOrbit.zoomOffset,
    pitch: Math.max(22, Math.min(76,
      (flightStage === 'departure' ? 58 : 56) + cameraOrbit.pitchOffset
    )),
    bearing: viewBearing
  };
}

function cameraFollow(position) {
  map.jumpTo(thirdPersonView(position));
}

function bindCameraOrbitControls() {
  const canvas = map.getCanvas();
  let activePointerId = null;
  let lastX = 0;
  let lastY = 0;

  canvas.style.touchAction = 'none';
  const syncOrbitState = () => {
    document.documentElement.dataset.cameraAzimuth = cameraOrbit.azimuth.toFixed(2);
    document.documentElement.dataset.cameraZoom = cameraOrbit.zoomOffset.toFixed(2);
  };
  syncOrbitState();
  canvas.setAttribute(
    'aria-description',
    'Arrastrá para girar alrededor del dirigible y usá la rueda para acercar o alejar.'
  );

  canvas.addEventListener('pointerdown', event => {
    if (activePointerId !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    activePointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('orbiting');
    event.preventDefault();
  });

  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== activePointerId) return;
    const deltaX = event.clientX - lastX;
    const deltaY = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    cameraOrbit.azimuth = ((cameraOrbit.azimuth + deltaX * 0.32 + 540) % 360) - 180;
    cameraOrbit.pitchOffset = Math.max(-32, Math.min(20,
      cameraOrbit.pitchOffset - deltaY * 0.24
    ));
    syncOrbitState();
    cameraFollow(planeState);
    map.triggerRepaint();
    event.preventDefault();
  });

  const endOrbit = event => {
    if (event.pointerId !== activePointerId) return;
    activePointerId = null;
    canvas.classList.remove('orbiting');
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener('pointerup', endOrbit);
  canvas.addEventListener('pointercancel', endOrbit);

  canvas.addEventListener('wheel', event => {
    cameraOrbit.zoomOffset = Math.max(-1.1, Math.min(1.25,
      cameraOrbit.zoomOffset - event.deltaY * 0.0018
    ));
    syncOrbitState();
    cameraFollow(planeState);
    map.triggerRepaint();
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener('dblclick', event => {
    cameraOrbit = { ...CAMERA_ORBIT_DEFAULT };
    syncOrbitState();
    cameraFollow(planeState);
    map.triggerRepaint();
    event.preventDefault();
  });
}

function stopAtPost(index) {
  cancelAnimation();
  flightState = 'stopped';
  planeState = { ...planeState, throttle: 0.28, bank: 0, pitch: 0 };
  triggerPostaImpact(index);
  setFlightButton('CONTINUAR');
  setStatus(`Posta ${index + 1} · hacé click en el cartel para ver los materiales`);
  map.triggerRepaint();
}

function completeFlight() {
  cancelAnimation();
  flightState = 'completed';
  planeState = { ...planeState, throttle: 0.28, bank: 0, pitch: 0 };
  setFlightButton('VOLVER A VOLAR');
  setStatus('Recorrido completo · José L. Suárez');
  freeModeBtn.hidden = false;
  triggerPostaImpact(STOPS.length - 1);
  triggerCelebration();
  map.easeTo({ zoom: 14.7, pitch: 62, duration: 2500, essential: false });
}

function updateFreeFlightSpeed(change = 0) {
  freeFlightSpeedIndex = Math.max(
    0,
    Math.min(FREE_FLIGHT_SPEEDS_KMH.length - 1, freeFlightSpeedIndex + change)
  );
  const speed = FREE_FLIGHT_SPEEDS_KMH[freeFlightSpeedIndex];
  freeSpeedOutput.textContent = `${speed} KM/H`;
  freeSlowerBtn.disabled = freeFlightSpeedIndex === 0;
  freeFasterBtn.disabled = freeFlightSpeedIndex === FREE_FLIGHT_SPEEDS_KMH.length - 1;
  document.documentElement.dataset.freeFlightSpeed = String(speed);
}

function syncFreeFlightState() {
  document.documentElement.dataset.freeFlightLng = planeState.lng.toFixed(7);
  document.documentElement.dataset.freeFlightLat = planeState.lat.toFixed(7);
  document.documentElement.dataset.freeFlightBearing = planeState.bearing.toFixed(2);
}

function resetFreeFlightInput() {
  freeFlightKeys.clear();
  freeFlightInput.turn = 0;
  freeFlightInput.thrust = 0;
  freeJoystickKnob.style.transform = 'translate(0px, 0px)';
}

function animateFreeFlight(now) {
  if (flightState !== 'free') return;

  const elapsedSeconds = Math.min(0.05, Math.max(0, (now - freeFlightLastFrame) / 1000));
  freeFlightLastFrame = now;
  const keyboardTurn = (freeFlightKeys.has('ArrowRight') ? 1 : 0)
    - (freeFlightKeys.has('ArrowLeft') ? 1 : 0);
  const keyboardThrust = (freeFlightKeys.has('ArrowUp') ? 1 : 0)
    - (freeFlightKeys.has('ArrowDown') ? 1 : 0);
  const turn = Math.max(-1, Math.min(1, keyboardTurn + freeFlightInput.turn));
  const thrust = Math.max(-1, Math.min(1, keyboardThrust + freeFlightInput.thrust));
  const nextBearing = (
    planeState.bearing + turn * FREE_FLIGHT_TURN_DEGREES_PER_SECOND * elapsedSeconds + 360
  ) % 360;
  const distanceMeters = thrust
    * (FREE_FLIGHT_SPEEDS_KMH[freeFlightSpeedIndex] / 3.6)
    * FREE_FLIGHT_MAP_SPEED_MULTIPLIER
    * elapsedSeconds;
  const radians = nextBearing * Math.PI / 180;
  const northMeters = Math.cos(radians) * distanceMeters;
  const eastMeters = Math.sin(radians) * distanceMeters;
  const latitudeRadians = planeState.lat * Math.PI / 180;
  const longitudeMetersPerDegree = 111320 * Math.max(0.2, Math.cos(latitudeRadians));

  planeState = {
    ...planeState,
    lng: planeState.lng + eastMeters / longitudeMetersPerDegree,
    lat: planeState.lat + northMeters / 111320,
    alt: Math.max(120, planeState.alt),
    bearing: nextBearing,
    bank: -turn * 6,
    pitch: thrust * 1.5,
    scale: 1,
    throttle: 0.5 + Math.abs(thrust) * (
      0.28 + 0.22 * freeFlightSpeedIndex / (FREE_FLIGHT_SPEEDS_KMH.length - 1)
    )
  };
  setAltitude(planeState.alt);
  recordTrail(planeState, now);
  updateActiveLocality(planeState);
  cameraFollow(planeState);
  syncFreeFlightState();
  map.triggerRepaint();
  animationFrameId = requestAnimationFrame(animateFreeFlight);
}

function enterFreeFlight() {
  cancelAnimation();
  cancelCelebration();
  resetFreeFlightInput();
  flightState = 'free';
  flightStage = 'route';
  planeState = {
    ...planeState,
    alt: Math.max(120, planeState.alt),
    bank: 0,
    pitch: 0,
    scale: 1,
    throttle: 0.62
  };
  cameraOrbit = { ...CAMERA_ORBIT_DEFAULT };
  freeModeBtn.hidden = true;
  freeFlightControls.hidden = false;
  document.documentElement.dataset.flightMode = 'free';
  updateFreeFlightSpeed();
  syncFreeFlightState();
  setStatus('Modo libre · usá los controles para pilotear el zepelín');
  freeFlightLastFrame = performance.now();
  animationFrameId = requestAnimationFrame(animateFreeFlight);
}

function exitFreeFlight() {
  cancelAnimation();
  resetFreeFlightInput();
  flightState = 'completed';
  planeState = { ...planeState, throttle: 0.28, bank: 0, pitch: 0 };
  freeFlightControls.hidden = true;
  freeModeBtn.hidden = false;
  document.documentElement.dataset.flightMode = 'route';
  setFlightButton('VOLVER A VOLAR');
  setStatus('Modo libre finalizado · podés volver a activarlo');
  map.triggerRepaint();
}

function bindFreeFlightControls() {
  const flightKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  window.addEventListener('keydown', event => {
    if (flightState !== 'free' || !flightKeys.has(event.key)) return;
    freeFlightKeys.add(event.key);
    event.preventDefault();
  });
  window.addEventListener('keyup', event => {
    if (!flightKeys.has(event.key)) return;
    freeFlightKeys.delete(event.key);
    if (flightState === 'free') event.preventDefault();
  });
  window.addEventListener('blur', resetFreeFlightInput);

  let joystickPointerId = null;
  const moveJoystick = event => {
    if (event.pointerId !== joystickPointerId) return;
    const bounds = freeJoystick.getBoundingClientRect();
    const radius = Math.max(1, Math.min(bounds.width, bounds.height) / 2 - 22);
    let x = event.clientX - (bounds.left + bounds.width / 2);
    let y = event.clientY - (bounds.top + bounds.height / 2);
    const distance = Math.hypot(x, y);
    if (distance > radius) {
      x *= radius / distance;
      y *= radius / distance;
    }
    freeFlightInput.turn = x / radius;
    freeFlightInput.thrust = -y / radius;
    freeJoystickKnob.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    event.preventDefault();
  };
  const releaseJoystick = event => {
    if (event.pointerId !== joystickPointerId) return;
    if (freeJoystick.hasPointerCapture(event.pointerId)) {
      freeJoystick.releasePointerCapture(event.pointerId);
    }
    joystickPointerId = null;
    freeFlightInput.turn = 0;
    freeFlightInput.thrust = 0;
    freeJoystickKnob.style.transform = 'translate(0px, 0px)';
  };
  freeJoystick.addEventListener('pointerdown', event => {
    if (flightState !== 'free' || joystickPointerId !== null) return;
    joystickPointerId = event.pointerId;
    freeJoystick.setPointerCapture(event.pointerId);
    moveJoystick(event);
  });
  freeJoystick.addEventListener('pointermove', moveJoystick);
  freeJoystick.addEventListener('pointerup', releaseJoystick);
  freeJoystick.addEventListener('pointercancel', releaseJoystick);
}

function animate(now) {
  if (flightState !== 'playing') return;

  const initialLeg = flightStage === 'departure' || segment === 0;
  const speedMultiplier = FLIGHT_SPEED_MULTIPLIER
    * (initialLeg ? INITIAL_LEG_SPEED_MULTIPLIER : 1);
  const duration = ((flightStage === 'departure'
    ? DEPARTURE_SECONDS[departurePhase]
    : SEGMENT_SECONDS[segment]) * 1000) / speedMultiplier;
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
  updateActiveLocality(planeState);
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
    stopAtPost(segment);
    return;
  }

  animationFrameId = requestAnimationFrame(animate);
}

function resumeFlight(fromStop = false) {
  const now = performance.now();
  if (fromStop) segmentStart = now;
  else if (pausedAt) segmentStart += now - pausedAt;
  else segmentStart = now;
  pausedAt = 0;
  flightState = 'playing';
  planeState = { ...planeState, throttle: Math.max(0.72, planeState.throttle ?? 0) };
  setFlightButton('PAUSA');
  setStatus(flightStage === 'departure'
    ? departurePhase === 0
      ? 'Elevación suave desde UNSAM'
      : 'Avance inicial sobre Av. 25 de Mayo'
    : `Rumbo a ${STOPS[segment + 1].name}`);
  cancelAnimation();
  animationFrameId = requestAnimationFrame(animate);
}

function pauseFlight() {
  flightState = 'paused';
  pausedAt = performance.now();
  cancelAnimation();
  planeState = { ...planeState, throttle: 0.28 };
  setFlightButton('CONTINUAR', true);
  setStatus('Vuelo en pausa');
  map.triggerRepaint();
}

function start() {
  if (flightState === 'playing') {
    pauseFlight();
    return;
  }
  if (flightState === 'paused') {
    resumeFlight(false);
    return;
  }
  if (flightState === 'stopped') {
    openMaterial(currentStopIndex);
    return;
  }
  if (flightState === 'material') return;
  if (flightState === 'completed' || segment >= STOPS.length - 1) reset(false);
  if (flightState === 'ready' && segment === 0 && !impactedPostas.has(0)) {
    triggerPostaImpact(0);
  }
  resumeFlight(true);
}

function reset(animateMap = true) {
  cancelAnimation();
  cancelCelebration();
  cancelPostaImpact();
  impactedPostas.clear();
  airshipImpactStartedAt = -Infinity;
  document.documentElement.dataset.airshipImpact = 'idle';
  resetFreeFlightInput();
  freeModeBtn.hidden = true;
  freeFlightControls.hidden = true;
  document.documentElement.dataset.flightMode = 'route';
  materialOverlay.classList.remove('open');
  materialOverlay.setAttribute('aria-hidden', 'true');
  flightState = 'ready';
  flightStage = 'departure';
  departurePhase = 0;
  segment = 0;
  segmentStart = 0;
  pausedAt = 0;
  cameraOrbit = { ...CAMERA_ORBIT_DEFAULT };
  planeState = initialPlaneState();
  trailHistory = [{ lng: planeState.lng, lat: planeState.lat, alt: planeState.alt }];
  lastTrailSample = 0;
  syncTrailSource();
  updateActiveLocality(planeState);
  setStop(0);
  setAltitude(planeState.alt);
  setFlightButton('INICIAR');
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
prevStopBtn.addEventListener('click', () => stepToStop(-1));
nextStopBtn.addEventListener('click', () => stepToStop(1));
mapModeBtn.addEventListener('click', () => setMapMode(!satelliteEnabled));
fullscreenBtn.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', syncFullscreenButton);
document.addEventListener('fullscreenerror', () => {
  setStatus('No se pudo activar la pantalla completa.', true);
});
stopMaterialBtn.addEventListener('click', () => openMaterial(currentStopIndex));
closeMaterialBtn.addEventListener('click', closeMaterial);
freeModeBtn.addEventListener('click', enterFreeFlight);
exitFreeModeBtn.addEventListener('click', exitFreeFlight);
freeSlowerBtn.addEventListener('click', () => updateFreeFlightSpeed(-1));
freeFasterBtn.addEventListener('click', () => updateFreeFlightSpeed(1));
materialOverlay.addEventListener('click', event => {
  if (event.target === materialOverlay) closeMaterial();
});
document.addEventListener('keydown', event => {
  if (!materialOverlay.classList.contains('open')) return;
  if (event.key === 'Escape') closeMaterial();
  if (event.key === 'ArrowLeft') stepMaterialSlide(-1);
  if (event.key === 'ArrowRight') stepMaterialSlide(1);
});

bindCameraOrbitControls();
bindFreeFlightControls();
updateFreeFlightSpeed();
setStop(0);
setAltitude(planeState.alt);
updateFairCountdown();
window.setInterval(updateFairCountdown, 1000);

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
    layout: { visibility: 'none' },
    paint: {
      'raster-opacity': 0.9,
      'raster-saturation': -0.12,
      'raster-contrast': 0.08,
      'raster-fade-duration': 0
    }
  }, firstReference?.id);
  mapModeBtn.disabled = false;
  setMapMode(false);
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
    data: './assets/data/san-martin-localidades.geojson',
    promoteId: 'id'
  });
  map.addLayer({
    id: 'localidades-fill',
    type: 'fill',
    source: 'localidades-san-martin',
    paint: {
      'fill-color': [
        'match', ['get', 'id'],
        1, LOCALITY_COLORS[0],
        2, LOCALITY_COLORS[1],
        3, LOCALITY_COLORS[2],
        4, LOCALITY_COLORS[3],
        5, LOCALITY_COLORS[4],
        6, LOCALITY_COLORS[5],
        7, LOCALITY_COLORS[0],
        8, LOCALITY_COLORS[1],
        LOCALITY_COLORS[2]
      ],
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'active'], false],
        0.24,
        0.045
      ],
      'fill-opacity-transition': { duration: 900, delay: 0 }
    }
  }, firstLabel?.id);
  map.addLayer({
    id: 'localidades-outline',
    type: 'line',
    source: 'localidades-san-martin',
    paint: {
      'line-color': [
        'case',
        ['boolean', ['feature-state', 'active'], false],
        '#fff4c2',
        'rgba(255,255,255,0.48)'
      ],
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'active'], false],
        3.2,
        1.2
      ],
      'line-opacity': 0.82,
      'line-width-transition': { duration: 900, delay: 0 },
      'line-color-transition': { duration: 900, delay: 0 }
    }
  });
  fetch('./assets/data/san-martin-localidades.geojson')
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      localitiesData = data;
      updateActiveLocality(planeState);
    })
    .catch(error => console.error('No se pudo activar el seguimiento de localidades.', error));
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
      features: STOPS.map((stop, index) => ({
        type: 'Feature',
        properties: { name: stop.name, id: stop.id, color: POSTA_COLORS[index] },
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
      'circle-color': ['get', 'color'],
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
      'text-color': ['get', 'color'],
      'text-halo-color': '#111',
      'text-halo-width': 1.5
    }
  });
  LANDMARKS.forEach(landmark => {
    map.addLayer(makeLandmarkLayer(landmark), firstLabel?.id);
  });
  map.addLayer(makePostaNumbersLayer());
  map.addLayer(makeAirshipLayer());
});

const DIGIT_SEGMENTS = Object.freeze({
  1: ['b', 'c'],
  2: ['a', 'b', 'g', 'e', 'd'],
  3: ['a', 'b', 'g', 'c', 'd'],
  4: ['f', 'g', 'b', 'c'],
  5: ['a', 'f', 'g', 'c', 'd'],
  6: ['a', 'f', 'g', 'e', 'c', 'd'],
  7: ['a', 'b', 'c'],
  8: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  9: ['a', 'b', 'c', 'd', 'f', 'g']
});

function createPostaDigit(number, color) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.48,
    metalness: 0.42,
    roughness: 0.24
  });
  const segmentTransforms = {
    a: [0, 0, 10, 10, 2.4, 2],
    b: [5, 0, 5, 2, 2.4, 9],
    c: [5, 0, -5, 2, 2.4, 9],
    d: [0, 0, -10, 10, 2.4, 2],
    e: [-5, 0, -5, 2, 2.4, 9],
    f: [-5, 0, 5, 2, 2.4, 9],
    g: [0, 0, 0, 10, 2.4, 2]
  };

  DIGIT_SEGMENTS[number].forEach(segmentName => {
    const [x, y, z, width, depth, height] = segmentTransforms[segmentName];
    const segment = new THREE.Mesh(
      new THREE.BoxGeometry(width, depth, height),
      material.clone()
    );
    segment.position.set(x, y, z);
    segment.castShadow = true;
    segment.frustumCulled = false;
    group.add(segment);
  });

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(8.2, 0.65, 10, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.52, depthWrite: false })
  );
  halo.position.z = -12;
  halo.frustumCulled = false;
  group.add(halo);
  return group;
}

function makePostaNumbersLayer() {
  let renderer;
  let scene;
  let camera;
  let numberGroups = [];

  return {
    id: 'postas-numeros-3d',
    type: 'custom',
    renderingMode: '3d',
    onAdd(layerMap, gl) {
      camera = new THREE.Camera();
      scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x17313b, 2.7));
      const light = new THREE.DirectionalLight(0xffffff, 3.1);
      light.position.set(-20, -30, 60);
      scene.add(light);
      numberGroups = STOPS.map((stop, index) => {
        const group = createPostaDigit(stop.id, POSTA_COLORS[index]);
        group.userData.postaIndex = index;
        scene.add(group);
        return group;
      });
      renderer = new THREE.WebGLRenderer({
        canvas: layerMap.getCanvas(),
        context: gl,
        antialias: true
      });
      renderer.autoClear = false;
      document.documentElement.dataset.postaNumbers3d = 'ready';
      layerMap.triggerRepaint();
    },
    render(gl, args) {
      const now = performance.now();
      const projection = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
      const faceCamera = -map.getBearing() * Math.PI / 180;
      numberGroups.forEach((group, index) => {
        group.visible = !impactedPostas.has(index) && flightState !== 'free';
        if (!group.visible) return;
        const stop = STOPS[index];
        const floatingAltitude = stop.alt + 36 + Math.sin(now / 520 + index * 0.9) * 4.5;
        const coordinate = maplibregl.MercatorCoordinate.fromLngLat(
          [stop.lng, stop.lat],
          floatingAltitude
        );
        const units = coordinate.meterInMercatorCoordinateUnits();
        group.position.set(coordinate.x, coordinate.y, coordinate.z);
        group.scale.setScalar(units * 2.25);
        group.rotation.z = faceCamera + Math.sin(now / 1100 + index) * 0.06;
      });
      camera.projectionMatrix.copy(projection);
      renderer.resetState();
      renderer.render(scene, camera);
      map.triggerRepaint();
    }
  };
}

function makeLandmarkLayer(config) {
  let renderer;
  let scene;
  let camera;
  let model;
  let renderedAltitude = config.altitude ?? 0;

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
      let targetAltitude = config.altitude ?? 0;
      if (config.avoidAirship) {
        const averageLatitude = (config.lat + planeState.lat) * Math.PI / 360;
        const metersPerLongitudeDegree = Math.cos(averageLatitude) * 111320;
        const distance = Math.hypot(
          (config.lng - planeState.lng) * metersPerLongitudeDegree,
          (config.lat - planeState.lat) * 111320
        );
        const proximity = 1 - Math.min(1, Math.max(0, (distance - 120) / 520));
        targetAltitude = Math.max(
          targetAltitude,
          planeState.alt + (config.clearance ?? 220) * proximity
        );
      }
      renderedAltitude += (targetAltitude - renderedAltitude) * 0.08;
      const coordinate = maplibregl.MercatorCoordinate.fromLngLat(
        [config.lng, config.lat],
        renderedAltitude
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
  let loadedAirshipModel = null;
  let originalFans = [];
  let fairPropeller = null;
  let advertisingTexture = null;
  const airshipScale = AIRSHIP_BASE_SCALE;

  function curvedAdvertisingGeometry(side, orientation, size, center, width, height, verticalCenter) {
    const geometry = new THREE.PlaneGeometry(width, height, 28, 10);
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const verticalRadius = Math.max(
      (orientation === 'gltf' ? size.y : size.z) * 0.5,
      height * 0.8
    );
    const lengthRadius = Math.max(size.x * 0.5, width * 0.6);
    const sideRadius = (orientation === 'gltf' ? size.z : size.y) * 0.5;
    const verticalOrigin = orientation === 'gltf' ? center.y : center.z;

    for (let index = 0; index < position.count; index += 1) {
      const localX = position.getX(index);
      const localVertical = position.getY(index);
      const normalizedX = localX / lengthRadius;
      const normalizedVertical = (verticalCenter + localVertical - verticalOrigin) / verticalRadius;
      const envelopeFactor = Math.sqrt(Math.max(
        0.06,
        1 - normalizedX * normalizedX - normalizedVertical * normalizedVertical
      ));
      const surfaceOffset = side * (sideRadius * envelopeFactor + 0.025);

      if (orientation === 'gltf') {
        position.setXYZ(index, localX, localVertical, surfaceOffset);
        if (side < 0) uv.setX(index, 1 - uv.getX(index));
      } else {
        position.setXYZ(index, localX, surfaceOffset, localVertical);
      }
    }

    position.needsUpdate = true;
    uv.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  function attachAdvertising(model, orientation = 'gltf') {
    if (!model || !advertisingTexture) return;
    const previous = model.getObjectByName('publicidad-ciencia-y-ficcion');
    if (previous) {
      model.remove(previous);
      disposeObject(previous);
    }

    const savedPosition = model.position.clone();
    const savedQuaternion = model.quaternion.clone();
    const savedScale = model.scale.clone();
    model.position.set(0, 0, 0);
    model.quaternion.identity();
    model.scale.set(1, 1, 1);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.copy(savedPosition);
    model.quaternion.copy(savedQuaternion);
    model.scale.copy(savedScale);

    const verticalSize = orientation === 'gltf' ? size.y : size.z;
    const aspect = advertisingTexture.image.width / advertisingTexture.image.height;
    let width = size.x * 0.58;
    let height = width / aspect;
    const maxHeight = verticalSize * 0.52;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspect;
    }
    const verticalCenter = orientation === 'gltf'
      ? center.y + size.y * 0.22
      : center.z + size.z * 0.18;

    const group = new THREE.Group();
    group.name = 'publicidad-ciencia-y-ficcion';
    const material = new THREE.MeshBasicMaterial({
      map: advertisingTexture,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    const sideA = new THREE.Mesh(
      curvedAdvertisingGeometry(1, orientation, size, center, width, height, verticalCenter),
      material
    );
    const sideB = new THREE.Mesh(
      curvedAdvertisingGeometry(-1, orientation, size, center, width, height, verticalCenter),
      material.clone()
    );
    sideA.renderOrder = 4;
    sideB.renderOrder = 4;

    if (orientation === 'gltf') {
      sideA.position.set(center.x, verticalCenter, center.z);
      sideB.position.set(center.x, verticalCenter, center.z);
    } else {
      sideA.position.set(center.x, center.y, verticalCenter);
      sideB.position.set(center.x, center.y, verticalCenter);
    }

    group.add(sideA, sideB);
    model.add(group);
    model.userData.advertisingSides = [sideA, sideB];
    model.updateMatrixWorld(true);
    document.documentElement.dataset.airshipAdvertising = 'ciencia-y-ficcion';
    document.documentElement.dataset.airshipAdvertisingShape = 'curved';
    map.triggerRepaint();
  }

  function attachFairPropeller() {
    if (!loadedAirshipModel || !fairPropeller) return;
    originalFans.forEach(fan => {
      fan.visible = false;
    });
    if (fairPropeller.parent !== loadedAirshipModel) loadedAirshipModel.add(fairPropeller);
    const rotatingBlades = fairPropeller.getObjectByName('aspas_rotativas');
    if (rotatingBlades) {
      rotatingBlades.userData.spinAxis = 'z';
      fans = [rotatingBlades];
    }
    document.documentElement.dataset.propellerModel = 'feria';
    map.triggerRepaint();
  }

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
      airship.userData.advertisingOrientation = 'fallback';
      fans = fallback.fans;
      airship.scale.setScalar(airshipScale);
      scene.add(airship);
      document.documentElement.dataset.airshipModel = 'fallback';

      new THREE.TextureLoader().load(
        './assets/textures/airship/ciencia-y-ficcion.webp',
        texture => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(8, renderer?.capabilities.getMaxAnisotropy() ?? 1);
          advertisingTexture = texture;
          attachAdvertising(airship, airship.userData.advertisingOrientation);
        },
        undefined,
        error => console.error('No se pudo cargar la publicidad lateral del dirigible.', error)
      );

      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.178.0/examples/jsm/libs/draco/');
      dracoLoader.setWorkerLimit(1);
      const loader = new GLTFLoader();
      loader.setDRACOLoader(dracoLoader);
      loader.load(
        './assets/models/airship/airship.glb',
        gltf => {
          const loadedAirship = gltf.scene;
          loadedAirship.userData.advertisingOrientation = 'gltf';
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
          loadedAirshipModel = loadedAirship;
          originalFans = loadedFans;
          fans = loadedFans;
          attachFairPropeller();
          attachAdvertising(loadedAirship, 'gltf');
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
      new GLTFLoader().load(
        './assets/models/airship/aspas_feria_3d.glb',
        gltf => {
          fairPropeller = gltf.scene;
          fairPropeller.name = 'helice-feria-color';
          fairPropeller.position.set(-9.45, 0, 0);
          fairPropeller.rotation.y = -Math.PI / 2;
          fairPropeller.scale.setScalar(1.65);
          const propellerColors = {
            aspa_azul: 0x168cff,
            aspa_rojo: 0xff334f,
            aspa_verde: 0x35d06f,
            aspa_amarillo: 0xffdc3a,
            centro_blanco_original: 0xffffff,
            aro_eje_negro: 0x10151a,
            tapa_central_blanca: 0xffffff
          };
          const frame = fairPropeller.getObjectByName('marco');
          if (frame) frame.visible = false;
          fairPropeller.traverse(object => {
            object.frustumCulled = false;
            if (!object.isMesh) return;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            const styledMaterials = materials.filter(Boolean).map(material => {
              const styled = material.clone();
              const color = propellerColors[object.name];
              styled.vertexColors = color === undefined;
              if (color !== undefined) {
                styled.color?.set(color);
                styled.emissive?.set(color);
                styled.emissiveIntensity = 0.18;
              }
              styled.side = THREE.DoubleSide;
              styled.needsUpdate = true;
              return styled;
            });
            object.material = Array.isArray(object.material) ? styledMaterials : styledMaterials[0];
          });
          attachFairPropeller();
        },
        undefined,
        error => console.error('No se pudo cargar la hélice de feria; se conserva la original.', error)
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
      const impactElapsed = performance.now() - airshipImpactStartedAt;
      const impactActive = impactElapsed >= 0 && impactElapsed < 680;
      const impactPulse = impactActive
        ? 1 + Math.sin(Math.min(1, impactElapsed / 360) * Math.PI) * 0.3
        : 1;
      airship.visible = !impactActive || impactElapsed > 390 || Math.floor(impactElapsed / 58) % 2 === 0;
      airship.scale.setScalar(airshipScale * (planeState.scale ?? 1) * impactPulse);
      const cameraSide = Math.sin(cameraOrbit.azimuth * Math.PI / 180);
      const advertisingSides = airship.userData.advertisingSides ?? [];
      if (advertisingSides.length === 2) {
        advertisingSides[0].visible = cameraSide < 0;
        advertisingSides[1].visible = cameraSide >= 0;
      }
      fans.forEach(fan => {
        const rotationStep = (
          0.035 + (planeState.throttle ?? 0.6) * 0.11
        ) * PROPELLER_SPIN_MULTIPLIER;
        if (fan.userData.spinAxis === 'z') fan.rotation.z -= rotationStep;
        else fan.rotation.x += rotationStep;
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
