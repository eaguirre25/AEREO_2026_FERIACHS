import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.178.0/+esm';
import { STOPS, SEGMENT_SECONDS, CRUISE_ALTITUDE } from './route.js';

const map = new maplibregl.Map({
  container:'map',
  style:'https://tiles.openfreemap.org/styles/liberty',
  center:[STOPS[0].lng,STOPS[0].lat],
  zoom:16.8,
  pitch:67,
  bearing:-18,
  antialias:true,
  attributionControl:true
});

const $=s=>document.querySelector(s);
const stopName=$('#stopName'), stopMeta=$('#stopMeta'), altitudeEl=$('#altitude'), status=$('#status');
const startBtn=$('#startBtn'), pauseBtn=$('#pauseBtn'), restartBtn=$('#restartBtn'), nav=$('#routeNav');
let playing=false, paused=false, segment=0, segmentStart=0, pausedAt=0, planeState={lng:STOPS[0].lng,lat:STOPS[0].lat,alt:8,bearing:0,bank:0};

STOPS.forEach((s,i)=>{const b=document.createElement('button');b.textContent=String(i+1).padStart(2,'0');b.title=s.name;b.addEventListener('click',()=>previewStop(i));nav.appendChild(b)});
const navButtons=[...nav.querySelectorAll('button')];

function setStop(i){const s=STOPS[i];stopName.textContent=s.name.toUpperCase();stopMeta.textContent=`POSTA ${String(s.id).padStart(2,'0')} · ${s.label}`;navButtons.forEach((b,j)=>b.classList.toggle('active',j===i));}
setStop(0);

function previewStop(i){playing=false;paused=false;segment=Math.min(i,STOPS.length-2);pauseBtn.disabled=true;startBtn.disabled=false;startBtn.textContent=i===0?'DESPEGAR':'CONTINUAR';setStop(i);const s=STOPS[i];planeState={...planeState,lng:s.lng,lat:s.lat,alt:s.alt};map.flyTo({center:[s.lng,s.lat],zoom:s.zoom,pitch:67,duration:2600,essential:true});}

function bearing(a,b){const y=Math.sin((b.lng-a.lng)*Math.PI/180)*Math.cos(b.lat*Math.PI/180);const x=Math.cos(a.lat*Math.PI/180)*Math.sin(b.lat*Math.PI/180)-Math.sin(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.cos((b.lng-a.lng)*Math.PI/180);return (Math.atan2(y,x)*180/Math.PI+360)%360;}
const smooth=t=>t*t*(3-2*t);
function interpolate(a,b,t){const e=smooth(t);const arc=Math.sin(Math.PI*t);let alt=a.alt+(b.alt-a.alt)*e+arc*CRUISE_ALTITUDE;if(segment===0) alt=8+(b.alt-8)*e+arc*120;if(segment===STOPS.length-2) alt=a.alt+(b.alt-a.alt)*e+arc*95;return{lng:a.lng+(b.lng-a.lng)*e,lat:a.lat+(b.lat-a.lat)*e,alt,bearing:bearing(a,b),bank:Math.sin(Math.PI*t)*Math.min(13,Math.abs(bearing(a,b)-planeState.bearing)*.18)};}

function cameraFollow(p){const rad=(p.bearing+180)*Math.PI/180;const d=.0032;const center=[p.lng+Math.sin(rad)*d,p.lat+Math.cos(rad)*d];map.jumpTo({center,zoom:p.alt<120?16.5:15.8,pitch:72,bearing:p.bearing});}

function animate(now){if(!playing||paused)return;if(!segmentStart)segmentStart=now;const duration=SEGMENT_SECONDS[segment]*1000;const t=Math.min(1,(now-segmentStart)/duration);planeState=interpolate(STOPS[segment],STOPS[segment+1],t);altitudeEl.textContent=`${Math.round(planeState.alt)} m`;cameraFollow(planeState);map.triggerRepaint();if(t>=1){segment++;segmentStart=now;setStop(segment);if(segment>=STOPS.length-1){playing=false;pauseBtn.disabled=true;startBtn.disabled=false;startBtn.textContent='VOLVER A VOLAR';status.textContent='Recorrido completo · CEAMSE';map.easeTo({zoom:14.7,pitch:62,duration:3500});return;}}requestAnimationFrame(animate);}

function start(){if(segment>=STOPS.length-1)reset();playing=true;paused=false;segmentStart=0;startBtn.disabled=true;pauseBtn.disabled=false;pauseBtn.textContent='PAUSA';status.textContent='Vuelo en curso';requestAnimationFrame(animate);}
function reset(){playing=false;paused=false;segment=0;segmentStart=0;planeState={lng:STOPS[0].lng,lat:STOPS[0].lat,alt:8,bearing:0,bank:0};setStop(0);altitudeEl.textContent='0 m';startBtn.disabled=false;startBtn.textContent='DESPEGAR';pauseBtn.disabled=true;map.flyTo({center:[STOPS[0].lng,STOPS[0].lat],zoom:16.8,pitch:67,bearing:-18,duration:2200});status.textContent='Listo para despegar';}
startBtn.addEventListener('click',start);restartBtn.addEventListener('click',reset);pauseBtn.addEventListener('click',()=>{paused=!paused;pauseBtn.textContent=paused?'SEGUIR':'PAUSA';if(!paused){segmentStart+=performance.now()-pausedAt;requestAnimationFrame(animate)}else pausedAt=performance.now();});

map.on('load',()=>{
  status.textContent='Listo para despegar';
  const layers=map.getStyle().layers||[];const label=layers.find(l=>l.type==='symbol');
  if(map.getSource('openmaptiles')){
    map.addLayer({id:'3d-buildings',source:'openmaptiles','source-layer':'building',type:'fill-extrusion',minzoom:14,paint:{'fill-extrusion-color':'#c9c5bd','fill-extrusion-height':['coalesce',['get','render_height'],['get','height'],8],'fill-extrusion-base':['coalesce',['get','render_min_height'],0],'fill-extrusion-opacity':.78}},label?.id);
  }
  map.addSource('route',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:STOPS.map(s=>[s.lng,s.lat])}}});
  map.addLayer({id:'route-line',type:'line',source:'route',paint:{'line-color':'#ffffff','line-width':2,'line-opacity':.38,'line-dasharray':[2,3]}});
  map.addSource('postas',{type:'geojson',data:{type:'FeatureCollection',features:STOPS.map(s=>({type:'Feature',properties:{name:s.name,id:s.id},geometry:{type:'Point',coordinates:[s.lng,s.lat]}}))}});
  map.addLayer({id:'postas-dot',type:'circle',source:'postas',paint:{'circle-radius':5,'circle-color':'#fff','circle-stroke-color':'#111','circle-stroke-width':2}});
  map.addLayer({id:'postas-label',type:'symbol',source:'postas',layout:{'text-field':['concat',['to-string',['get','id']],' · ',['get','name']],'text-size':11,'text-offset':[0,1.2],'text-anchor':'top'},paint:{'text-color':'#fff','text-halo-color':'#111','text-halo-width':1.5}});
  map.addLayer(makeAircraftLayer());
});

function makeAircraftLayer(){let renderer,scene,camera,aircraft,propeller;return{id:'aircraft-3d',type:'custom',renderingMode:'3d',onAdd(map,gl){camera=new THREE.Camera();scene=new THREE.Scene();const white=new THREE.MeshStandardMaterial({color:0xf2f2ed,roughness:.55});const dark=new THREE.MeshStandardMaterial({color:0x202a30,roughness:.7});aircraft=new THREE.Group();const body=new THREE.Mesh(new THREE.CapsuleGeometry(1.0,5.8,8,16),white);body.rotation.z=Math.PI/2;aircraft.add(body);const wing=new THREE.Mesh(new THREE.BoxGeometry(1.0,11.5,.18),white);wing.position.set(0,0,1.05);aircraft.add(wing);const tail=new THREE.Mesh(new THREE.BoxGeometry(.7,4.2,.14),white);tail.position.set(-3.2,0,.45);aircraft.add(tail);const fin=new THREE.Mesh(new THREE.BoxGeometry(1.7,.16,1.7),white);fin.position.set(-3.35,0,1.05);fin.rotation.y=-.25;aircraft.add(fin);const nose=new THREE.Mesh(new THREE.CylinderGeometry(.7,.82,1.2,16),dark);nose.rotation.z=Math.PI/2;nose.position.x=3.25;aircraft.add(nose);propeller=new THREE.Group();const blade=new THREE.Mesh(new THREE.BoxGeometry(.12,4.5,.16),dark);propeller.add(blade);propeller.position.x=3.9;aircraft.add(propeller);aircraft.rotation.x=Math.PI/2;aircraft.scale.setScalar(1.6);scene.add(aircraft);scene.add(new THREE.HemisphereLight(0xffffff,0x445566,2.3));const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(20,-20,40);scene.add(sun);renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true});renderer.autoClear=false;},render(gl,args){if(!aircraft)return;propeller.rotation.x+=.55;const mc=maplibregl.MercatorCoordinate.fromLngLat([planeState.lng,planeState.lat],planeState.alt);const scale=mc.meterInMercatorCoordinateUnits();const m=new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);const local=new THREE.Matrix4().makeTranslation(mc.x,mc.y,mc.z).scale(new THREE.Vector3(scale,-scale,scale));const rot=new THREE.Matrix4().makeRotationZ(-planeState.bearing*Math.PI/180);const bank=new THREE.Matrix4().makeRotationX(planeState.bank*Math.PI/180);camera.projectionMatrix=m.multiply(local).multiply(rot).multiply(bank);renderer.resetState();renderer.render(scene,camera);map.triggerRepaint();}};}
