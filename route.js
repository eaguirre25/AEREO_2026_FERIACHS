export const STOPS = [
  {id:1,name:'UNSAM · Campus Miguelete',label:'ELEVACIÓN',lng:-58.5266950692,lat:-34.5798390695,alt:55,zoom:17.2},
  {id:2,name:'Villa Lynch',label:'SOBREVUELO',lng:-58.523437722,lat:-34.590146441,alt:135,zoom:15.7},
  {id:3,name:'San Martín centro',label:'SOBREVUELO',lng:-58.542014482,lat:-34.579698685,alt:120,zoom:16.0},
  {id:4,name:'Estadio de Chacarita Juniors',label:'PASADA LENTA',lng:-58.52820,lat:-34.56734,alt:95,zoom:16.4},
  {id:5,name:'San Andrés',label:'SOBREVUELO',lng:-58.54448,lat:-34.56521,alt:125,zoom:15.9},
  {id:6,name:'Villa Ballester',label:'SOBREVUELO',lng:-58.5580651,lat:-34.5492309,alt:135,zoom:15.8},
  {id:7,name:'Villa Billinghurst',label:'SOBREVUELO',lng:-58.5747487,lat:-34.5752034,alt:120,zoom:15.8},
  {id:8,name:'Loma Hermosa',label:'SOBREVUELO',lng:-58.5993659,lat:-34.5492367,alt:145,zoom:15.4},
  {id:9,name:'CEAMSE · Complejo Ambiental Norte III',label:'DESCENSO FINAL',lng:-58.612613,lat:-34.530323,alt:70,zoom:15.2}
];

export const SEGMENT_SECONDS = [18,22,22,20,22,24,28,26];
export const CRUISE_ALTITUDE = 45;

// Eje de la avenida 25 de Mayo frente al Campus Miguelete (oeste → sudeste).
// El primer tramo representa la elevación vertical y el segundo, el avance inicial.
export const DEPARTURE_PATH = [
  {lng:-58.52685,lat:-34.57961,alt:14},
  {lng:-58.52685,lat:-34.57961,alt:55},
  {lng:-58.52375,lat:-34.58103,alt:90}
];
export const DEPARTURE_SECONDS = [7,10];

export const LANDMARKS = [
  {
    id: 'unsam-logo',
    model: './assets/models/landmarks/unsam/logo.glb',
    lng: -58.5266950692,
    lat: -34.5798390695,
    altitude: 48,
    rotation: 0,
    rotationSpeed: 18,
    scale: 0.18
  },
  {
    id: 'chacarita-stadium',
    model: './assets/models/landmarks/chacarita/stadium.glb',
    lng: -58.52820,
    lat: -34.56734,
    altitude: 0.8,
    rotation: -45,
    scale: 1,
    palette: 'chacarita'
  }
];
