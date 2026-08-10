# AÉREO 2026 — FERIA CHS

Experiencia web 3D guiada por el Partido de General San Martín, Buenos Aires.

## Prototipo funcional

El recorrido usa **MapLibre GL JS + OpenFreeMap/OpenStreetMap + Three.js**. No requiere API key para la base cartográfica. La vista inicial es el mapa vectorial; el botón `SATÉLITE` permite alternar con imágenes de Esri conservando calles y referencias actuales. El vehículo principal es el **Airship de C2DH/zoomland**, un dirigible GLB comprimido con Draco bajo AGPL-3.0. Si el asset no puede cargarse, la aplicación conserva automáticamente un dirigible geométrico liviano como respaldo.

## Las 9 postas

1. **UNSAM — Campus Miguelete** — elevación
2. **Villa Lynch** — sobrevuelo
3. **San Martín centro** — sobrevuelo
4. **Estadio de Chacarita Juniors** — pasada baja
5. **San Andrés** — sobrevuelo
6. **Villa Ballester** — sobrevuelo
7. **Villa Billinghurst** — sobrevuelo
8. **Loma Hermosa** — sobrevuelo
9. **José L. Suárez** — cierre del recorrido

El dirigible mantiene un movimiento suave entre las postas y se detiene al llegar a cada una. La altura y el zoom varían para que el territorio pueda reconocerse. José L. Suárez funciona como cierre con descenso progresivo.

Durante la experiencia, el dirigible se detiene en cada posta y conserva la
hélice girando. La persona abre el cartel de la posta para consultar sus
materiales y decide cuándo continuar mediante el botón de cierre. La Posta 2
incluye las siete placas “Mirador: afinar lo que vemos” copiadas del repositorio
`COMOCREAMOS_MAPA_FERIA_2026`; las demás postas quedan preparadas con paneles
oscuros translúcidos hasta recibir contenido.

Cada cartel conserva el título temático de su posta en el recorrido original y
muestra debajo una cuenta regresiva en días hasta la feria, sin revelar la fecha
exacta en pantalla.

La cuenta regresiva reproduce el formato visual del proyecto original y muestra
días, horas y minutos. El tramo de salida desde UNSAM hasta la Posta 2 usa una
aceleración adicional para reducir la espera inicial.

Toda la interfaz usa la familia Rajdhani distribuida localmente en cinco pesos,
por lo que botones, portadas, carteles y paneles mantienen la misma tipografía.

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

El dirigible usa escala 16,8: cuatro veces la escala del primer prototipo y el
doble de la versión anterior. La hélice `Fan` de cola se
amplía y anima según el avance, y una estela tridimensional semitransparente
permanece detrás del vehículo durante el recorrido.

Ambos laterales llevan el cartel “Ciencia y ficción” como publicidad integrada
al modelo. La cámara puede orbitar alrededor del dirigible arrastrando con mouse
o dedo durante el vuelo y en las detenciones; la rueda permite ajustar distancia
y un doble clic recupera la vista posterior inicial.

Las postas muestran la localidad correspondiente al punto geográfico. Durante
el vuelo, la localidad atravesada se resalta suavemente con una paleta roja,
amarilla, azul, verde claro, naranja y violeta. El punto final se ubica en
José L. Suárez, según la coordenada suministrada para la Posta 9.
UNSAM se identifica como límite Villa Maipú/Villa Lynch porque el campus y la
maniobra inicial ocupan ambos lados de esa división.

El logo UNSAM está ubicado en `-34.57850707883743, -58.52687013509144`, a 90 m
de altura y con escala 0,54, tres veces mayor que en la versión anterior.

La interfaz titula cada punto como `POSTA 1` a `POSTA 9` y asigna un color
diferente al título, selector y marcador cartográfico. Los controles
`RETROCEDER` y `AVANZAR` permiten saltar entre postas; `INICIAR/PAUSA/CONTINUAR`
controla la reproducción del recorrido. La interfaz también
permite alternar la experiencia en pantalla completa.

Antes de comenzar se elige entre versión móvil y escritorio. La opción móvil
muestra una recomendación para girar el teléfono. El botón único de vuelo
cambia entre `INICIAR`, `PAUSA` y `CONTINUAR`, y la velocidad general es un 10 %
mayor que en la versión anterior.

La salida sobre la avenida 25 de Mayo está alineada con la dirección de la
Posta 2, evitando la corrección brusca del prototipo anterior. La hélice de cola
usa `aspas_feria_3d.glb`, con cuatro palas azul, roja, verde y amarilla; el centro
y el marco conservan blanco y negro.

El HUD superior, el altímetro y la banda inferior utilizan fondos translúcidos,
desenfoque y brillo tipo neón. Los títulos y nombres de las postas se ampliaron
para mantener la lectura sobre fotografía satelital clara u oscura.

## Publicación

Al fusionar el prototipo a `main`, GitHub Actions despliega automáticamente el sitio mediante GitHub Pages.
