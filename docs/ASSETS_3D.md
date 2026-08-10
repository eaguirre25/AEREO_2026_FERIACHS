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

## Fuentes abiertas localizadas

### FlightGear / FGMEMBERS

Flightradar24 documentó que sus primeros modelos 3D de aeronaves procedían de FlightGear y del repositorio FGMEMBERS. Es una fuente relevante porque contiene numerosos modelos de aviación general, aunque antes de reutilizar un modelo concreto hay que verificar su licencia y convertir el formato si no está en glTF/GLB.

### Khronos glTF Sample Assets

El repositorio oficial de Khronos recomienda varias fuentes externas de modelos glTF y menciona específicamente repositorios de aeronaves. Es útil como referencia técnica y para validar el pipeline GLB/glTF.

### AircraftVerse

Dataset abierto con miles de diseños de vehículos aéreos y modelos 3D/CAD, publicado bajo CC BY-SA. Es más útil como reserva de geometrías que como primera opción estética para una avioneta civil lista para web.

## Decisión provisional

No incorporar todavía un modelo al repositorio hasta verificar simultáneamente:

1. que sea una avioneta civil adecuada visualmente;
2. que el archivo pueda utilizarse directamente o convertirse a GLB;
3. que la licencia permita redistribuirlo dentro de este repositorio;
4. que su peso y complejidad sean razonables para navegador.

Mientras tanto, el proyecto debe mantener desacoplado el modelo (`assets/models/aircraft.glb`) para poder sustituirlo sin modificar la lógica de vuelo.
