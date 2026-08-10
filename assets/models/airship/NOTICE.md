# Airship — C2DH/zoomland

`airship.glb` procede de
[`C2DH/zoomland`](https://github.com/C2DH/zoomland), commit
`c7d80ce5c35874b8549579b214de3ad2c4bb48d5`.

- Licencia del repositorio de origen: **GNU AGPL v3.0**.
- La licencia completa está en `LICENSE-AGPL-3.0.txt`.
- El componente original que carga el GLB y anima `Fan` se conserva en
  `UPSTREAM-Airship.jsx`.
- El GLB original se conserva sin modificaciones binarias.

## Adaptación realizada en tiempo de ejecución

- decodificación de `KHR_draco_mesh_compression` con `DRACOLoader`;
- corrección del eje vertical de Three.js al sistema geográfico de MapLibre;
- animación independiente del nodo `Fan`;
- neutralización visual de los materiales `Logo` y `Logo_2`;
- escala y cámara adaptadas al recorrido de las nueve postas.
