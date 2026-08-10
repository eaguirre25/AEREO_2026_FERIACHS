export const STOPS = [
  {id:1,name:'UNSAM · Campus Miguelete',label:'DESPEGUE',lng:-58.5266950692,lat:-34.5798390695,alt:18,zoom:17.2},
  {id:2,name:'Villa Lynch',label:'SOBREVUELO',lng:-58.523437722,lat:-34.590146441,alt:180,zoom:15.7},
  {id:3,name:'San Martín centro',label:'SOBREVUELO',lng:-58.542014482,lat:-34.579698685,alt:155,zoom:16.0},
  {id:4,name:'Estadio de Chacarita Juniors',label:'PASADA',lng:-58.52820,lat:-34.56734,alt:125,zoom:16.4},
  {id:5,name:'San Andrés',label:'SOBREVUELO',lng:-58.54448,lat:-34.56521,alt:165,zoom:15.9},
  {id:6,name:'Villa Ballester',label:'SOBREVUELO',lng:-58.5580651,lat:-34.5492309,alt:175,zoom:15.8},
  {id:7,name:'Villa Billinghurst',label:'SOBREVUELO',lng:-58.5747487,lat:-34.5752034,alt:165,zoom:15.8},
  {id:8,name:'Loma Hermosa',label:'SOBREVUELO',lng:-58.5993659,lat:-34.5492367,alt:210,zoom:15.4},
  {id:9,name:'CEAMSE · Complejo Ambiental Norte III',label:'DESCENSO FINAL',lng:-58.612613,lat:-34.530323,alt:85,zoom:15.2}
];

export const SEGMENT_SECONDS = [12,14,14,13,14,15,18,18];
export const CRUISE_ALTITUDE = 230;

// Eje de la avenida 25 de Mayo frente al Campus Miguelete (oeste → sudeste).
// El primer tramo representa el carreteo y el segundo, la carrera y rotación.
export const DEPARTURE_PATH = [
  {lng:-58.52930,lat:-34.57805,alt:5},
  {lng:-58.52685,lat:-34.57961,alt:5},
  {lng:-58.52375,lat:-34.58103,alt:72}
];
export const DEPARTURE_SECONDS = [6,8];

export const LANDMARKS = [
  {
    id: 'chacarita-stadium',
    model: './assets/models/landmarks/chacarita/stadium.glb',
    lng: -58.52820,
    lat: -34.56734,
    altitude: 0.8,
    rotation: -45,
    scale: 1
  }
];
