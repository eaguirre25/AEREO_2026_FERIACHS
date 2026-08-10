# AÉREO 2026 — FERIA CHS

Experiencia web 3D guiada por el Partido de General San Martín, Buenos Aires.

## Prototipo funcional

El recorrido usa **MapLibre GL JS + OpenFreeMap/OpenStreetMap + Three.js**. No requiere API key para la base cartográfica. La aeronave principal es una **Cessna 172P de FlightGear**, convertida y optimizada como GLB bajo GPL-2.0. Si el asset no puede cargarse, la aplicación conserva automáticamente una avioneta geométrica liviana como respaldo.

## Las 9 postas

1. **UNSAM — Campus Miguelete** — despegue
2. **Villa Lynch** — sobrevuelo
3. **San Martín centro** — sobrevuelo
4. **Estadio de Chacarita Juniors** — pasada baja
5. **San Andrés** — sobrevuelo
6. **Villa Ballester** — sobrevuelo
7. **Villa Billinghurst** — sobrevuelo
8. **Loma Hermosa** — sobrevuelo
9. **CEAMSE — Complejo Ambiental Norte III** — descenso final

El avión no aterriza en las postas intermedias. La altura y el zoom varían para que el territorio pueda reconocerse. CEAMSE funciona como cierre con descenso progresivo.

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
- `app.js` — mapa 3D, avión, cámara y animación
- `docs/ASSETS_3D.md` — evaluación de aeronaves abiertas
- `docs/CUSTOM_3D.md` — incorporación futura de modelos propios al mapa
- `.github/workflows/pages.yml` — despliegue automático en GitHub Pages desde `main`

El comienzo incluye carreteo, aceleración y rotación sobre la avenida 25 de
Mayo frente al Campus Miguelete. La geometría y duración de esa maniobra se
ajustan con `DEPARTURE_PATH` y `DEPARTURE_SECONDS` dentro de `route.js`.

## Aeronave 3D

La Cessna 172P deriva de `c172p-team/c172p`. Se distribuye con su licencia,
créditos, fuente exterior filtrada y una nota completa de modificaciones en
`assets/models/c172p/`. La conversión puede reproducirse con
`scripts/convert_ac3d_to_glb.py`.

## Publicación

Al fusionar el prototipo a `main`, GitHub Actions despliega automáticamente el sitio mediante GitHub Pages.
