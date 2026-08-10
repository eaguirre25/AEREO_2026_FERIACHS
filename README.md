# AÉREO 2026 — FERIA CHS

Experiencia web 3D guiada por el Partido de General San Martín, Buenos Aires.

## Prototipo funcional

El recorrido usa **MapLibre GL JS + OpenFreeMap/OpenStreetMap + Three.js**. No requiere API key para la base cartográfica. El modo híbrido combina imágenes satelitales de Esri con las calles y referencias vectoriales actuales; puede alternarse con el mapa tradicional. El vehículo principal es el **Airship de C2DH/zoomland**, un dirigible GLB comprimido con Draco bajo AGPL-3.0. Si el asset no puede cargarse, la aplicación conserva automáticamente un dirigible geométrico liviano como respaldo.

## Las 9 postas

1. **UNSAM — Campus Miguelete** — elevación
2. **Villa Lynch** — sobrevuelo
3. **San Martín centro** — sobrevuelo
4. **Estadio de Chacarita Juniors** — pasada baja
5. **San Andrés** — sobrevuelo
6. **Villa Ballester** — sobrevuelo
7. **Villa Billinghurst** — sobrevuelo
8. **Loma Hermosa** — sobrevuelo
9. **CEAMSE — Complejo Ambiental Norte III** — descenso final

El dirigible mantiene un movimiento continuo mediante una curva suave que atraviesa todas las postas sin detenerse. La altura y el zoom varían para que el territorio pueda reconocerse. CEAMSE funciona como cierre con descenso progresivo.

## Ejecutar localmente

Como `app.js` usa módulos ES, servir la carpeta con un servidor HTTP simple:

```bash
python -m http.server 8000
```

Abrir `http://localhost:8000`.

## Verificación

Con Node.js 24 o posterior:

```bash
npm test
```

La verificación controla la sintaxis, la estructura de la ruta y que la posta de
Villa Billinghurst permanezca dentro de sus límites cartográficos.

## Archivos

- `index.html` — interfaz y HUD
- `styles.css` — estética del recorrido
- `boot.js` — diagnóstico de carga y mensaje de recuperación
- `route.js` — coordenadas, alturas y tiempos de las postas
- `app.js` — mapa 3D, dirigible, cámara y animación
- `docs/ASSETS_3D.md` — procedencia y evaluación del vehículo 3D
- `docs/CUSTOM_3D.md` — incorporación de modelos propios al mapa
- `.github/workflows/pages.yml` — despliegue automático en GitHub Pages desde `main`

El comienzo incluye elevación vertical desde UNSAM y avance suave sobre la
avenida 25 de Mayo. La geometría y duración de esa maniobra se ajustan con
`DEPARTURE_PATH` y `DEPARTURE_SECONDS` dentro de `route.js`.

La posta 04 incorpora el estadio de Chacarita como hito GLB georreferenciado.
El estadio se representa con la paleta blanca, roja y negra del club. Sobre el
Campus Miguelete se conserva el volumen urbano y gira el logo 3D de UNSAM. Los
hitos adicionales se registran en `LANDMARKS`, dentro de `route.js`.

La capa `assets/data/san-martin-localidades.geojson` delimita y rotula las ocho
localidades incluidas. Los edificios vectoriales usan una paleta azul y turquesa
para distinguirse del gris habitual, incluso sobre la imagen satelital.

## Dirigible 3D

El Airship procede de `C2DH/zoomland`, conserva el GLB original, la licencia
AGPL-3.0, el componente fuente que anima `Fan` y una nota completa de adaptación
en `assets/models/airship/`. Los logos originales se neutralizan al cargar el
modelo, sin alterar el archivo de origen.

El dirigible se muestra al doble de la escala inicial. La hélice `Fan` de cola se
amplía y anima según el avance, y una estela tridimensional semitransparente
permanece detrás del vehículo durante el recorrido.

## Publicación

Al fusionar el prototipo a `main`, GitHub Actions despliega automáticamente el sitio mediante GitHub Pages.
