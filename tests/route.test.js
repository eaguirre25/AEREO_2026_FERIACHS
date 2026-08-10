import test from 'node:test';
import assert from 'node:assert/strict';
import { STOPS, SEGMENT_SECONDS, CRUISE_ALTITUDE } from '../route.js';

test('la ruta tiene una duración por cada tramo', () => {
  assert.equal(STOPS.length, 9);
  assert.equal(SEGMENT_SECONDS.length, STOPS.length - 1);
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

test('la posta de Billinghurst cae dentro de Villa Billinghurst', () => {
  const billinghurst = STOPS.find(stop => stop.name.includes('Billinghurst'));
  assert.ok(billinghurst);
  assert.ok(billinghurst.lat >= -34.5832543 && billinghurst.lat <= -34.5669104);
  assert.ok(billinghurst.lng >= -58.5846192 && billinghurst.lng <= -58.5646789);
});
