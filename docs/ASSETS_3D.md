# Vehículo aéreo 3D

## Decisión implementada

El prototipo utiliza el **Airship de C2DH/zoomland** como vehículo principal.
Es un dirigible moderno reconocible, suficientemente compacto para la cámara en
tercera persona y adecuado para desplazamientos lentos sobre las nueve postas.

## Fuente verificada

- Repositorio: [`C2DH/zoomland`](https://github.com/C2DH/zoomland).
- Commit fijado: `c7d80ce5c35874b8549579b214de3ad2c4bb48d5`.
- Asset original: `public/assets/models/Airship.glb`.
- Licencia declarada por el repositorio: **GNU AGPL v3.0**.
- Tamaño: aproximadamente 29 KB.
- Compresión: `KHR_draco_mesh_compression`.
- Mallas principales: `Airship` y `Fan`.
- Materiales: `White`, `Red`, `Material`, `Metal`, `Logo` y `Logo_2`.

El componente original `Airship.jsx` carga ese archivo y anima el nodo `Fan` de
forma independiente. Tanto dicho componente como la licencia completa se
conservan junto al asset en `assets/models/airship/`.

## Adaptación al simulador

1. el GLB se conserva sin modificaciones binarias;
2. `DRACOLoader` decodifica la geometría Draco en el navegador;
3. el eje Y vertical del modelo original se transforma al eje Z del mapa;
4. el dirigible se orienta según el rumbo geográfico de cada tramo;
5. `Fan` gira de manera independiente y varía suavemente con el avance;
6. `Logo` y `Logo_2` se neutralizan en tiempo de ejecución;
7. una versión geométrica de respaldo evita que el recorrido quede sin vehículo;
8. la cámara se sitúa detrás y ligeramente por encima del dirigible.

## Perfil de vuelo

La salida comienza con una elevación vertical desde UNSAM y continúa con un
avance suave sobre la avenida 25 de Mayo. El recorrido trabaja principalmente
entre 80 y 150 metros, reduce su velocidad en los extremos de cada tramo y hace
una pasada lenta sobre el estadio de Chacarita sin detener la animación.

## Alternativas evaluadas

- **Steampunk Blimp de APercy**: licencia del modelo explícita CC BY-SA 3.0,
  pero requiere conversión de B3D a GLB.
- **Cessna 172P de FlightGear**: se utilizó durante la fase inicial del
  prototipo y fue retirada al adoptar el dirigible.
