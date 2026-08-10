# AÉREO 2026 — FERIA CHS

Experiencia web 3D guiada por el Partido de General San Martín, Buenos Aires.

## Prototipo funcional

El recorrido usa **MapLibre GL JS + OpenFreeMap/OpenStreetMap + Three.js**. No requiere API key para la base cartográfica. La aeronave actual es un modelo 3D liviano generado con geometrías Three.js para validar vuelo, cámara, escala y rendimiento. Está preparado para sustituirse por la Cessna abierta definitiva cuando terminemos la conversión a GLB.

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
- `.github/workflows/pages.yml` — despliegue automático en GitHub Pages desde `main`

## Próximo reemplazo de aeronave

Prioridad actual: **Cessna 172P de FlightGear**, seguida por Cessna 182S. El modelo exterior se convertirá/optimizará a glTF/GLB conservando atribución y licencia correspondiente. Hasta entonces el prototipo no depende de ningún asset binario externo.

## Publicación

Al fusionar el prototipo a `main`, GitHub Actions despliega automáticamente el sitio mediante GitHub Pages.
