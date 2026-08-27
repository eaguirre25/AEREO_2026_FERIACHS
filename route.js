export const STOPS = [
  {id:1,name:'UNSAM',title:'Punto de partida',place:'Campus Miguelete',lng:-58.5266950692,lat:-34.5798390695,alt:55,zoom:17.2},
  {id:2,name:'Villa Lynch',title:'Mirador: afinar lo que vemos',label:'SOBREVUELO',place:'Villa Lynch',lng:-58.523437722,lat:-34.590146441,alt:135,zoom:15.7},
  {id:3,name:'San Martín',title:'Situación problemática',label:'CENTRO · SOBREVUELO',place:'San Martín centro',lng:-58.542014482,lat:-34.579698685,alt:120,zoom:16.0},
  {id:4,name:'Villa Maipú',title:'Pregunta de investigación',label:'CHACARITA · PASADA LENTA',place:'Estadio de Chacarita Juniors',lng:-58.52820,lat:-34.56734,alt:95,zoom:16.4},
  {id:5,name:'San Andrés',title:'Objetivos',label:'SOBREVUELO',lng:-58.54448,lat:-34.56521,alt:125,zoom:15.9},
  {id:6,name:'Villa Ballester',title:'Hipótesis',stageLabel:'PARADA A',markerLabel:'A',label:'SOBREVUELO',lng:-58.5580651,lat:-34.5492309,alt:135,zoom:15.8},
  {id:7,name:'Billinghurst',title:'Antecedentes',stageLabel:'PARADA B',markerLabel:'B',label:'SOBREVUELO',place:'Villa Billinghurst',lng:-58.5747487,lat:-34.5752034,alt:120,zoom:15.8},
  {id:8,name:'Loma Hermosa',title:'Equipaje metodológico',label:'SOBREVUELO',lng:-58.5993659,lat:-34.5492367,alt:145,zoom:15.4},
  {id:9,name:'José L. Suárez',title:'Conclusiones',lng:-58.58094506418298,lat:-34.52213589682376,alt:70,zoom:15.5}
];

export const SEGMENT_SECONDS = [18,22,22,20,22,24,28,26];
export const CRUISE_ALTITUDE = 45;

// Salida desde la avenida 25 de Mayo frente al Campus Miguelete.
// El avance inicial queda alineado con la Posta 2 para evitar un giro abrupto.
export const DEPARTURE_PATH = [
  {lng:-58.52685,lat:-34.57961,alt:14},
  {lng:-58.52685,lat:-34.57961,alt:55},
  {lng:-58.525895,lat:-34.582560,alt:90}
];
export const DEPARTURE_SECONDS = [7,10];

export const LANDMARKS = [
  {
    id: 'unsam-logo',
    model: './assets/models/landmarks/unsam/logo.glb',
    lng: -58.52687013509144,
    lat: -34.57850707883743,
    altitude: 90,
    rotation: 0,
    rotationSpeed: 18,
    scale: 0.54,
    avoidAirship: true,
    clearance: 230
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
