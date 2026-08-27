import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STOPS,
  SEGMENT_SECONDS,
  CRUISE_ALTITUDE,
  DEPARTURE_PATH,
  DEPARTURE_SECONDS,
  LANDMARKS
} from '../route.js';

test('la ruta tiene una duración por cada tramo', () => {
  assert.equal(STOPS.length, 9);
  assert.equal(SEGMENT_SECONDS.length, STOPS.length - 1);
});

test('la elevación y salida parten de la Posta 1 sin saltos', () => {
  assert.equal(DEPARTURE_PATH.length, DEPARTURE_SECONDS.length + 1);
  assert.ok(DEPARTURE_SECONDS.every(seconds => seconds >= 4 && seconds <= 12));
  assert.equal(DEPARTURE_PATH[0].lat, DEPARTURE_PATH[1].lat);
  assert.equal(DEPARTURE_PATH[0].lng, DEPARTURE_PATH[1].lng);
  assert.ok(DEPARTURE_PATH[1].alt > DEPARTURE_PATH[0].alt);
  assert.ok(DEPARTURE_PATH[2].alt > DEPARTURE_PATH[1].alt);

  DEPARTURE_PATH.forEach(point => {
    assert.ok(point.lat >= -34.541 && point.lat <= -34.521);
    assert.ok(point.lng >= -58.582 && point.lng <= -58.565);
  });
});

test('la salida queda alineada con la dirección de la Posta 2', () => {
  const bearing = (a, b) => {
    const deltaLng = (b.lng - a.lng) * Math.PI / 180;
    const latA = a.lat * Math.PI / 180;
    const latB = b.lat * Math.PI / 180;
    const y = Math.sin(deltaLng) * Math.cos(latB);
    const x = Math.cos(latA) * Math.sin(latB)
      - Math.sin(latA) * Math.cos(latB) * Math.cos(deltaLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  };
  const departureBearing = bearing(DEPARTURE_PATH[1], DEPARTURE_PATH[2]);
  const nextBearing = bearing(DEPARTURE_PATH[2], STOPS[1]);
  const delta = Math.abs(((nextBearing - departureBearing + 540) % 360) - 180);
  assert.ok(delta < 2, `el cambio de rumbo es de ${delta.toFixed(2)}°`);
});

test('las postas tienen identificadores y datos válidos', () => {
  STOPS.forEach((stop, index) => {
    assert.equal(stop.id, index + 1);
    assert.ok(stop.name.length > 0);
    assert.ok(stop.lat >= -34.65 && stop.lat <= -34.48);
    assert.ok(stop.lng >= -58.66 && stop.lng <= -58.48);
    assert.ok(stop.alt >= 0 && stop.alt <= 300);
    assert.ok(stop.zoom >= 14 && stop.zoom <= 18);
  });
  assert.ok(SEGMENT_SECONDS.every(seconds => seconds > 0 && seconds <= 30));
  assert.ok(CRUISE_ALTITUDE > 0 && CRUISE_ALTITUDE <= 300);
});

test('las etapas 6 y 7 se presentan como Paradas A y B', () => {
  const paradaA = STOPS.find(stop => stop.stageLabel === 'PARADA A');
  const paradaB = STOPS.find(stop => stop.stageLabel === 'PARADA B');
  assert.equal(paradaA.markerLabel, 'A');
  assert.equal(paradaB.markerLabel, 'B');
});

test('las etapas metodológicas se presentan como Postas 6 y 7', () => {
  const posta6 = STOPS.find(stop => stop.stageLabel === 'POSTA 6');
  const posta7 = STOPS.find(stop => stop.stageLabel === 'POSTA 7');
  assert.equal(posta6.markerLabel, '6');
  assert.equal(posta7.markerLabel, '7');
});

test('la posta de Billinghurst cae dentro de Villa Billinghurst', () => {
  const billinghurst = STOPS.find(stop => stop.name.includes('Billinghurst'));
  assert.ok(billinghurst);
  assert.ok(billinghurst.lat >= -34.5832543 && billinghurst.lat <= -34.5669104);
  assert.ok(billinghurst.lng >= -58.5846192 && billinghurst.lng <= -58.5646789);
});

test('el estadio 3D coincide con la posta de Chacarita', () => {
  const stadium = LANDMARKS.find(landmark => landmark.id === 'chacarita-stadium');
  const stop = STOPS.find(item => item.place?.includes('Chacarita'));
  assert.ok(stadium);
  assert.ok(stop);
  assert.equal(stadium.lat, stop.lat);
  assert.equal(stadium.lng, stop.lng);
  assert.match(stadium.model, /\.glb$/);
  assert.equal(stadium.palette, 'chacarita');
});

test('el logo UNSAM gira sobre el Campus Miguelete', () => {
  const logo = LANDMARKS.find(landmark => landmark.id === 'unsam-logo');
  assert.ok(logo);
  assert.equal(logo.lat, -34.57850707883743);
  assert.equal(logo.lng, -58.52687013509144);
  assert.equal(logo.altitude, 90);
  assert.equal(logo.scale, 0.54);
  assert.equal(logo.avoidAirship, true);
  assert.ok(logo.clearance >= 200);
  assert.ok(logo.rotationSpeed > 0);
  assert.match(logo.model, /\.glb$/);
});

test('las postas muestran nombres de localidades verificadas', () => {
  assert.deepEqual(
    STOPS.map(stop => stop.name),
    [
      'José L. Suárez',
      'Villa Lynch',
      'San Martín',
      'Villa Maipú',
      'San Andrés',
      'Villa Ballester',
      'Billinghurst',
      'Loma Hermosa',
      'UNSAM'
    ]
  );
  assert.equal(STOPS[0].lat, -34.52213589682376);
  assert.equal(STOPS[0].lng, -58.58094506418298);
  assert.equal(STOPS[0].place, undefined);
  assert.equal(STOPS[8].place, 'Campus Miguelete');
});

test('las etapas usan los títulos de sus materiales', () => {
  assert.deepEqual(STOPS.map(stop => stop.title), [
    'Punto de partida',
    'Mirador: afinar lo que vemos',
    'Situación problemática',
    'Pregunta de investigación',
    'Objetivos',
    'Hipótesis',
    'Antecedentes',
    'Metodología',
    'Conclusiones'
  ]);
});
