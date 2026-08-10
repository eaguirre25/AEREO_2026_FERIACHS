# Búsqueda de aeronave 3D

## Objetivo

Encontrar una **avioneta civil ligera**, preferentemente de ala alta (estética Cessna 152/172), apta para verse en tercera persona durante un recorrido aéreo guiado por General San Martín.

## Requisitos

- GLB/glTF preferido;
- licencia abierta verificable;
- suficientemente liviana para navegador y móvil;
- hélice visible; idealmente separada o animable;
- materiales/texturas incluidos;
- geometría legible desde cámara posterior a distancia media.

## Candidatas verificadas

### 1. Cessna 172P — FlightGear / c172p-team

- Tipo: avioneta civil ligera, monomotor, ala alta.
- Repositorio público: `c172p-team/c172p` en GitHub.
- Estado: proyecto activo; GitHub lo describe como una versión altamente detallada de la Cessna 172P para FlightGear.
- Licencia: el ecosistema oficial FlightGear exige contribuciones GPLv2+ compatibles; la Cessna 172P figura entre las aeronaves GPL de FlightGear.
- Formato original: assets de FlightGear, no GLB directo; requiere extraer la geometría relevante y convertirla a glTF/GLB.
- Adecuación visual: **muy alta**. Es exactamente el tipo de avioneta civil que se busca para una cámara de persecución.
- Riesgo técnico: el modelo completo incluye cockpit, sistemas y recursos que no necesitamos; conviene generar una versión web simplificada conservando fuselaje, alas, tren, hélice y texturas externas.

**Prioridad: ALTA. Primera candidata para prototipo.**

### 2. Cessna 182S Skylane — FlightGear

- Tipo: avioneta civil utilitaria, cuatro plazas, monomotor, ala alta.
- Licencia: **GPLv2+**, explicitada por la documentación de FlightGear.
- Estado: FlightGear la cataloga como un modelo 3D avanzado y muy detallado.
- Formato original: FlightGear; requiere conversión/optimización a GLB.
- Adecuación visual: **muy alta**. Algo más robusta que una C172 y probablemente más visible desde cámara posterior.
- Riesgo técnico: el modelo es detallado; debe reducirse antes de cargarlo en navegador.

**Prioridad: ALTA. Segunda candidata.**

### 3. Otras aeronaves civiles del hangar oficial FlightGear

El catálogo oficial incluye numerosas aeronaves civiles GPL adecuadas como reserva: Piper PA-28 Warrior II, Piper J3 Cub, Robin DR400, Cessna 182S, entre otras. Pueden evaluarse si la C172P o C182S resultan demasiado pesadas o complejas para convertir.

## Fuentes descartadas como primera opción

### AircraftVerse

Dataset abierto con 27.714 diseños de vehículos aéreos bajo CC BY-SA. Incluye STL y CAD, pero gran parte del corpus está orientado a diseños experimentales/UAV y no ofrece necesariamente una avioneta civil texturizada lista para navegador. Se mantiene como reserva de geometrías.

### Khronos glTF Sample Assets

Es excelente para validar el pipeline GLB/glTF y ofrece modelos con licencias individuales claramente documentadas, pero no apareció una avioneta civil adecuada dentro del catálogo oficial.

## Decisión actual

Para el primer prototipo del recorrido se adopta esta prioridad:

1. **Cessna 172P**;
2. **Cessna 182S**;
3. Piper/Robin civiles del hangar FlightGear como alternativas.

La licencia GPL permite usar, modificar y redistribuir estos assets respetando sus obligaciones de licencia y atribución. Si se genera una versión derivada simplificada o convertida a GLB, debe conservarse la información de licencia y autores correspondiente junto al archivo.

## Pipeline previsto

1. obtener la geometría exterior de la aeronave elegida;
2. eliminar cockpit y componentes invisibles desde tercera persona;
3. conservar hélice como nodo separado si es posible;
4. convertir a glTF/GLB;
5. reducir geometría y texturas para web;
6. guardar como `assets/models/aircraft.glb`;
7. incluir `assets/models/LICENSE-aircraft.txt` con fuente, autores, licencia y modificaciones realizadas.
