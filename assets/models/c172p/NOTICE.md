# Cessna 172P — procedencia y modificaciones

El archivo `aircraft.glb` deriva del modelo Cessna 172P de
[`c172p-team/c172p`](https://github.com/c172p-team/c172p), commit
`a15d83d1d56b5ecd9117ce83f5808c5a095f56c1`.

- Licencia del modelo original y de este derivado: **GNU GPL v2.0**.
- La licencia completa se conserva en `LICENSE-GPL-2.0.txt`.
- Los créditos del proyecto original se conservan en `UPSTREAM-AUTHORS.txt`.
- La fuente preferida para modificar este derivado está en `source/`.

## Modificaciones realizadas

- se conservaron únicamente fuselaje y elementos exteriores;
- se eliminaron cockpit, paneles, hotspots y accesorios de tierra;
- se omitió el disco de hélice rápida y se conservó la hélice física separada;
- se convirtieron los ejes de FlightGear/AC3D a los ejes usados por Three.js;
- se redujeron texturas a un máximo de 1024 píxeles;
- se convirtió el conjunto a glTF binario (`GLB`) para uso web.

La conversión es reproducible con `scripts/convert_ac3d_to_glb.py`.
