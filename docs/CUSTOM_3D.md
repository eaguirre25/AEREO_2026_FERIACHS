# Elementos 3D propios sobre el mapa

La aplicación puede incorporar modelos GLB propios —edificios, esculturas,
señalética, hitos o reconstrucciones— mediante capas personalizadas de MapLibre
y Three.js.

Cada elemento debe definirse al menos con:

```js
{
  id: 'hito-unsam',
  model: './assets/models/hitos/unsam.glb',
  lng: -58.526695,
  lat: -34.579839,
  altitude: 0,
  rotation: [0, 0, 90],
  scale: 1
}
```

## Recomendaciones

- usar GLB con texturas incorporadas;
- trabajar en metros y documentar el punto de origen del modelo;
- mantener cada modelo por debajo de 5 MB, preferentemente por debajo de 2 MB;
- reducir polígonos y texturas antes de publicarlo;
- conservar licencia, autoría y fuente junto al asset;
- cargar modelos lejanos solo cuando la cámara se aproxima;
- probar escritorio y móvil porque todos los modelos comparten la misma GPU.

La capa de la Cessna incluida en `app.js` ya demuestra el patrón necesario:
carga asíncrona, conversión geográfica a coordenadas Mercator, escala en metros,
orientación y renderizado dentro del mismo contexto WebGL de MapLibre.
