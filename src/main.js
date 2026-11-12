import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {Sky} from 'three/addons/objects/Sky.js';
import {Water} from 'three/addons/objects/Water.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import '@fontsource/oswald/300.css';import '@fontsource/oswald/400.css';import '@fontsource/oswald/600.css';import '@fontsource/oswald/700.css';import '@fontsource/special-elite/400.css';
const BASE=import.meta.env.BASE_URL;
const $=id=>document.getElementById(id);
const V3=THREE.Vector3;
const isTouch=('ontouchstart' in window)||navigator.maxTouchPoints>0;
if(isTouch) document.body.classList.add('touch');
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, rnd=(a,b)=>a+Math.random()*(b-a);
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;

/* ================= SETTINGS ================= */
const DEF={quality:isTouch?'low':'high',fov:78,brightness:1,grade:true,grain:true,vignette:true,shake:true,fps:false,
 sens:1,adsSens:.65,touchSens:1,invertY:false,adsToggle:false,crouchToggle:true,aimAssist:true,
 master:.8,music:.5,sfx:.9,subs:true,difficulty:'regular',crosshair:true,hitmarkers:true,xpPopups:true};
let S=Object.assign({},DEF);
try{const s=JSON.parse(localStorage.getItem('ir_settings')||'null');if(s)Object.assign(S,s);}catch(e){}
function saveS(){try{localStorage.setItem('ir_settings',JSON.stringify(S))}catch(e){}}
const DIFF={recruit:{acc:.5,dmg:.55,hp:.8},regular:{acc:1,dmg:1,hp:1},hardened:{acc:1.4,dmg:1.4,hp:1.15},veteran:{acc:2,dmg:2.2,hp:1.3}};
const QUAL={low:{pr:.6,sh:0,parts:120,fog:.0105,ocean:0,post:0,bloom:0,grass:0},medium:{pr:.85,sh:1024,parts:260,fog:.009,ocean:1,post:0,bloom:0,grass:4000},high:{pr:1,sh:2048,parts:450,fog:.008,ocean:1,post:1,bloom:1,grass:12000},ultra:{pr:Math.min(devicePixelRatio||1,2),sh:4096,parts:700,fog:.0072,ocean:1,post:1,bloom:1,grass:25000}};

/* ================= AUDIO ================= */
const A={ctx:null};let musicDuck=1;
function audioInit(){
  if(A.ctx){if(A.ctx.state==='suspended')A.ctx.resume();return;}
  try{A.ctx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){return;}
  const c=A.ctx;
  A.master=c.createGain();A.master.connect(c.destination);
  A.sfx=c.createGain();A.sfx.connect(A.master);
  A.mus=c.createGain();A.mus.connect(A.master);
  A.amb=c.createGain();A.amb.connect(A.master);
  const len=c.sampleRate*2;A.noise=c.createBuffer(1,len,c.sampleRate);const d=A.noise.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
  A.brown=c.createBuffer(1,len*2,c.sampleRate);const b=A.brown.getChannelData(0);let last=0;for(let i=0;i<b.length;i++){last=(last+.02*(Math.random()*2-1))/1.02;b[i]=last*3.5;}
  applyVolumes();
  // waves
  const w=c.createBufferSource();w.buffer=A.brown;w.loop=true;const wf=c.createBiquadFilter();wf.type='lowpass';wf.frequency.value=500;const wg=c.createGain();wg.gain.value=.5;
  const lfo=c.createOscillator();lfo.frequency.value=.12;const lg=c.createGain();lg.gain.value=.35;lfo.connect(lg);lg.connect(wg.gain);lfo.start();
  w.connect(wf);wf.connect(wg);wg.connect(A.amb);w.start();
  startMusic();
}
function applyVolumes(){if(!A.ctx)return;A.master.gain.value=S.master;A.sfx.gain.value=S.sfx;A.mus.gain.setTargetAtTime(S.music*musicDuck*.8,A.ctx.currentTime,.5);A.amb.gain.value=S.sfx*.5;}
function sfxN(o){
  if(!A.ctx)return;const c=A.ctx;const dist=o.dist||0;const t=c.currentTime+(o.delay||0)+dist/1200;
  const att=1/(1+dist*.035);const v=(o.vol||1)*att;if(v<.01)return;const d=o.d||.3;
  const s=c.createBufferSource();s.buffer=A.noise;const f=c.createBiquadFilter();f.type=o.type||'lowpass';f.Q.value=o.q||.7;
  const f0=Math.max(150,(o.f0||3000)/(1+dist*.015));f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(Math.max(40,o.f1||300),t+d);
  const g=c.createGain();g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0008,t+d);
  s.connect(f);f.connect(g);g.connect(A.sfx);s.start(t,Math.random()*1.5);s.stop(t+d+.05);
  if(o.thump){const os=c.createOscillator();os.frequency.setValueAtTime(o.tf||110,t);os.frequency.exponentialRampToValueAtTime(30,t+d*.8);const og=c.createGain();og.gain.setValueAtTime(o.thump*att,t);og.gain.exponentialRampToValueAtTime(.0008,t+d);os.connect(og);og.connect(A.sfx);os.start(t);os.stop(t+d+.05);}
}
const SND={
  garand:()=>sfxN({f0:5500,f1:180,d:.5,vol:.9,thump:.9,tf:150}),
  thompson:()=>sfxN({f0:3800,f1:300,d:.2,vol:.75,thump:.55,tf:120}),
  pistol:()=>sfxN({f0:4800,f1:400,d:.22,vol:.6,thump:.4,tf:170}),
  ping:()=>{if(!A.ctx)return;const c=A.ctx,t=c.currentTime+.05;const o=c.createOscillator();o.type='triangle';o.frequency.setValueAtTime(2600,t);o.frequency.exponentialRampToValueAtTime(2200,t+.4);const g=c.createGain();g.gain.setValueAtTime(.18,t);g.gain.exponentialRampToValueAtTime(.001,t+.5);o.connect(g);g.connect(A.sfx);o.start(t);o.stop(t+.55);},
  eRifle:d=>sfxN({f0:4200,f1:200,d:.45,vol:.8,thump:.5,dist:d}),
  mg:d=>sfxN({f0:3200,f1:260,d:.12,vol:.65,thump:.35,dist:d}),
  boom:d=>sfxN({f0:2000,f1:40,d:1.8,vol:1.5,thump:1.8,tf:70,dist:d}),
  click:()=>sfxN({f0:7000,f1:3000,d:.04,vol:.3,type:'highpass'}),
  reload:()=>{sfxN({f0:6000,f1:2000,d:.05,vol:.35,type:'highpass',delay:.15});sfxN({f0:5000,f1:1500,d:.06,vol:.35,type:'highpass',delay:.9});sfxN({f0:6500,f1:2500,d:.05,vol:.4,type:'highpass',delay:1.4});},
  hit:()=>sfxN({f0:9000,f1:5000,d:.05,vol:.3,type:'highpass'}),
  hurt:()=>sfxN({f0:600,f1:80,d:.25,vol:.7,thump:.8,tf:90}),
  whiz:()=>sfxN({f0:2000,f1:7000,d:.14,vol:.3,type:'bandpass',q:5}),
  splash:d=>sfxN({f0:1500,f1:300,d:.45,vol:.35,type:'bandpass',dist:d}),
  knife:()=>sfxN({f0:8000,f1:1200,d:.15,vol:.4,type:'bandpass',q:2}),
  ui:()=>sfxN({f0:3000,f1:1500,d:.06,vol:.25,type:'bandpass',q:3}),
  beep:()=>{if(!A.ctx)return;const c=A.ctx,t=c.currentTime;const o=c.createOscillator();o.frequency.value=1200;const g=c.createGain();g.gain.setValueAtTime(.15,t);g.gain.exponentialRampToValueAtTime(.001,t+.12);o.connect(g);g.connect(A.sfx);o.start(t);o.stop(t+.13);}
};
function startMusic(){
  const c=A.ctx;const chords=[[146.83,174.61,220],[116.54,146.83,174.61],[98,116.54,146.83],[110,138.59,164.81]];
  const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=800;lp.connect(A.mus);
  const vs=[];for(let i=0;i<3;i++)for(let k=0;k<2;k++){const o=c.createOscillator();o.type='sawtooth';o.detune.value=k?8:-8;const g=c.createGain();g.gain.value=.03;o.connect(g);g.connect(lp);o.start();vs.push({o,i});}
  const bo=c.createOscillator();bo.type='triangle';const bg=c.createGain();bg.gain.value=.13;bo.connect(bg);bg.connect(A.mus);bo.start();
  let idx=0;const step=()=>{const t=c.currentTime,ch=chords[idx%4];vs.forEach(v=>v.o.frequency.setTargetAtTime(ch[v.i]*(idx%8>=4&&v.i===2?2:1),t,.5));bo.frequency.setTargetAtTime(ch[0]/2,t,.2);
    const d=c.createOscillator();d.frequency.setValueAtTime(90,t);d.frequency.exponentialRampToValueAtTime(40,t+.6);const dg=c.createGain();dg.gain.setValueAtTime(.35,t);dg.gain.exponentialRampToValueAtTime(.001,t+.8);d.connect(dg);dg.connect(A.mus);d.start(t);d.stop(t+.85);idx++;};
  step();setInterval(step,4000);
}

/* ================= RENDERER ================= */
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:!isTouch,powerPreference:'high-performance'});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.autoClear=false;renderer.setClearColor(0x7a7672);
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x8c8174,.008);
const camera=new THREE.PerspectiveCamera(78,innerWidth/innerHeight,.03,1500);camera.rotation.order='YXZ';scene.add(camera);
function resize(){renderer.setSize(innerWidth,innerHeight,false);try{if(composer)composer.setSize(innerWidth,innerHeight);}catch(e){}camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();try{vmCam.aspect=camera.aspect;vmCam.updateProjectionMatrix();}catch(e){}}
addEventListener('resize',resize);

/* ---- procedural textures ---- */
function ctex(w,h,draw,rep){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');draw(x,w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(rep)t.repeat.set(rep[0],rep[1]);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
function speck(x,w,h,n,cols,sz){for(let i=0;i<n;i++){x.fillStyle=cols[i%cols.length];x.globalAlpha=Math.random()*.5+.2;const s=Math.random()*sz+1;x.fillRect(Math.random()*w,Math.random()*h,s,s);}x.globalAlpha=1;}
const TX={
  sand:ctex(256,256,(x,w,h)=>{x.fillStyle='#bdb3a0';x.fillRect(0,0,w,h);speck(x,w,h,7000,['#9f9582','#d6cdbb','#867c6a','#b0a690'],2);for(let i=0;i<30;i++){x.strokeStyle='rgba(120,110,90,.15)';x.lineWidth=2;x.beginPath();const y=Math.random()*h;x.moveTo(0,y);x.bezierCurveTo(w*.3,y+rnd(-10,10),w*.6,y+rnd(-10,10),w,y);x.stroke();}},[60,45]),
  concrete:ctex(256,256,(x,w,h)=>{x.fillStyle='#8d8a82';x.fillRect(0,0,w,h);speck(x,w,h,5000,['#77746c','#a19e95','#66635c'],3);for(let i=0;i<12;i++){x.fillStyle='rgba(40,35,30,.12)';x.beginPath();x.ellipse(Math.random()*w,Math.random()*h,rnd(10,40),rnd(20,70),0,0,7);x.fill();}x.strokeStyle='rgba(50,50,45,.35)';for(let y=0;y<h;y+=64){x.beginPath();x.moveTo(0,y);x.lineTo(w,y);x.stroke();}},[2,1]),
  bags:ctex(256,128,(x,w,h)=>{x.fillStyle='#4a4232';x.fillRect(0,0,w,h);for(let r=0;r<4;r++)for(let c=-1;c<5;c++){const ox=c*64+(r%2)*32,oy=r*32;const g=x.createRadialGradient(ox+32,oy+14,4,ox+32,oy+16,34);g.addColorStop(0,'#a8987a');g.addColorStop(1,'#5f5440');x.fillStyle=g;x.beginPath();x.ellipse(ox+32,oy+16,30,14,0,0,7);x.fill();}speck(x,w,h,1500,['#3a3426','#c0b090'],1);},[4,1]),
  wood:ctex(128,128,(x,w,h)=>{x.fillStyle='#5a3e26';x.fillRect(0,0,w,h);for(let i=0;i<40;i++){x.strokeStyle=`rgba(${rnd(30,90)|0},${rnd(20,50)|0},10,.4)`;x.beginPath();const y=Math.random()*h;x.moveTo(0,y);x.lineTo(w,y+rnd(-4,4));x.stroke();}}),
  metal:ctex(128,128,(x,w,h)=>{x.fillStyle='#55534d';x.fillRect(0,0,w,h);speck(x,w,h,2000,['#3d3b36','#6d6a62','#5a3a26'],2);})
};
const MAT={
  sand:new THREE.MeshStandardMaterial({map:TX.sand,vertexColors:true,roughness:.95}),
  concrete:new THREE.MeshStandardMaterial({map:TX.concrete,color:0xa8a39a,roughness:.9}),
  bags:new THREE.MeshStandardMaterial({map:TX.bags,roughness:1}),
  steel:new THREE.MeshStandardMaterial({map:TX.metal,color:0x6a6660,roughness:.6,metalness:.5}),
  rust:new THREE.MeshStandardMaterial({map:TX.metal,color:0x6b4a35,roughness:.8,metalness:.3}),
  navy:new THREE.MeshStandardMaterial({map:TX.metal,color:0x7d8a90,roughness:.7,metalness:.3}),
  char:new THREE.MeshStandardMaterial({map:TX.metal,color:0x2f2d29,roughness:.9,metalness:.2}),
  wood:new THREE.MeshStandardMaterial({map:TX.wood,roughness:.8}),
  gunMetal:new THREE.MeshStandardMaterial({color:0x55565a,roughness:.4,metalness:.6}),
  olive:new THREE.MeshStandardMaterial({color:0x6b6744,roughness:.95}),
  feld:new THREE.MeshStandardMaterial({color:0x58604f,roughness:.95}),
  helmUS:new THREE.MeshStandardMaterial({color:0x4f5534,roughness:.6,metalness:.25}),
  helmAx:new THREE.MeshStandardMaterial({color:0x40463c,roughness:.55,metalness:.3}),
  skin:new THREE.MeshStandardMaterial({color:0xc29276,roughness:.8}),
  boot:new THREE.MeshStandardMaterial({color:0x2b2118,roughness:.9}),
  leather:new THREE.MeshStandardMaterial({color:0x4a3522,roughness:.85}),
  tree:new THREE.MeshStandardMaterial({color:0x26301c,roughness:1,flatShading:true}),
  trunk:new THREE.MeshStandardMaterial({color:0x3b2e22,roughness:1})
};
function box(w,h,d,m){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.castShadow=true;o.receiveShadow=true;return o;}

/* ================= TERRAIN ================= */
function H(x,z){
  let h;
  if(z>40)h=-(z-40)*.12;else h=(40-z)*.025;
  if(z<-20){const t=Math.min(1,(-20-z)/22);const s=t*t*(3-2*t);h=1.5+s*8;}
  const ridge=clamp((-12-z)/10,0,1);
  h+=(Math.sin(x*.13)*.5+Math.sin(x*.31+z*.2)*.25)*ridge;
  h+=Math.sin(x*.7+z*.5)*.05+Math.sin(x*.21-z*.37)*.12*clamp((30-z)/20,0,1);
  return h;
}
const terrain=(()=>{
  const g=new THREE.PlaneGeometry(340,260,170,130);g.rotateX(-Math.PI/2);g.translate(0,0,20);
  const p=g.attributes.position,col=new Float32Array(p.count*3);const c=new THREE.Color();
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),y=H(x,z);p.setY(i,y);
    if(y<.25)c.setHex(0x6c6050);else if(z>-16)c.setHex(0xa8946e);else if(y<8.6)c.lerpColors(new THREE.Color(0x8f7d5a),new THREE.Color(0x5d5f3a),clamp((y-2)/7,0,1));else c.setHex(0x4e5a30);
    const n=.9+Math.random()*.15;col[i*3]=c.r*n;col[i*3+1]=c.g*n;col[i*3+2]=c.b*n;}
  g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();
  const m=new THREE.Mesh(g,MAT.sand);m.receiveShadow=true;scene.add(m);return m;
})();

/* ================= WORLD ================= */
const statics=[],colliders=[];
function addStatic(m,col=true){scene.add(m);m.updateMatrixWorld(true);statics.push(m);if(col){const b=new THREE.Box3().setFromObject(m);colliders.push({minx:b.min.x,maxx:b.max.x,minz:b.min.z,maxz:b.max.z,miny:b.min.y,maxy:b.max.y});}return m;}
// physical sky
const sky=new Sky();sky.scale.setScalar(10000);scene.add(sky);
const SUN_DIR=new V3();{const su=sky.material.uniforms;su.turbidity.value=9;su.rayleigh.value=2.2;su.mieCoefficient.value=.008;su.mieDirectionalG.value=.86;
 SUN_DIR.setFromSphericalCoords(1,THREE.MathUtils.degToRad(84),THREE.MathUtils.degToRad(-35));su.sunPosition.value.copy(SUN_DIR);}
const CLOUDS=new THREE.Group();scene.add(CLOUDS);{const ct=ctex(128,128,(x)=>{for(let i=0;i<14;i++){const cx=rnd(30,98),cy=rnd(45,85),r=rnd(14,30);const g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);}});
 for(let i=0;i<40;i++){const m=new THREE.SpriteMaterial({map:ct,color:new THREE.Color().setHSL(.07,.12,rnd(.45,.75)),transparent:true,depthWrite:false,fog:false,opacity:rnd(.45,.8)});const sp=new THREE.Sprite(m);const a=rnd(0,Math.PI*2),r=rnd(300,600);sp.position.set(Math.cos(a)*r,rnd(80,200),Math.sin(a)*r);sp.scale.set(rnd(180,340),rnd(60,120),1);CLOUDS.add(sp);}}
const hemi=new THREE.HemisphereLight(0x9aa6b4,0x4a3e30,1.6);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffbe80,4.2);sun.position.copy(SUN_DIR).multiplyScalar(150);scene.add(sun);scene.add(sun.target);
sun.shadow.camera.left=-45;sun.shadow.camera.right=45;sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;sun.shadow.camera.far=300;sun.shadow.bias=-.0006;sun.shadow.normalBias=.02;
const flashLight=new THREE.PointLight(0xffaa55,0,40,2);scene.add(flashLight);
const muzzleLight=new THREE.PointLight(0xffc070,0,8,2);scene.add(muzzleLight);
// water
const water=(()=>{const g=new THREE.PlaneGeometry(500,220,70,30);g.rotateX(-Math.PI/2);g.translate(0,-.05,150);
  const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x40585e,roughness:.25,metalness:.55,transparent:true,opacity:.93}));m.receiveShadow=true;scene.add(m);
  m.userData.base=Float32Array.from(g.attributes.position.array);return m;})();
const foam=new THREE.Mesh(new THREE.PlaneGeometry(500,2.2),new THREE.MeshBasicMaterial({color:0xdde4e0,transparent:true,opacity:.35,depthWrite:false}));foam.rotation.x=-Math.PI/2;foam.position.set(0,.03,40.6);scene.add(foam);
// ---- realistic ocean (medium+) ----
let water2=null;
function buildWater2(){if(water2)return;const tex=new THREE.TextureLoader().load(BASE+'textures/waternormals.jpg',t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;});
  water2=new Water(new THREE.PlaneGeometry(600,260),{textureWidth:512,textureHeight:512,waterNormals:tex,sunDirection:SUN_DIR.clone(),sunColor:0xffd2a0,waterColor:0x1f3a40,distortionScale:2.6,fog:true,alpha:.97});
  water2.rotation.x=-Math.PI/2;water2.position.set(0,-.02,170);scene.add(water2);}
// ---- environment lighting from the sky (PBR reflections) ----
{const pm=new THREE.PMREMGenerator(renderer);const es=new THREE.Scene();const s2=new Sky();s2.scale.setScalar(1000);Object.keys(sky.material.uniforms).forEach(k=>s2.material.uniforms[k].value=sky.material.uniforms[k].value);es.add(s2);
  scene.environment=pm.fromScene(es,0,.1,2000).texture;Object.values(MAT).forEach(m=>m.envMapIntensity=.45);}
// ---- grass on the bluff ----
let grass=null;
function buildGrass(n){if(grass){scene.remove(grass);grass=null;}if(!n)return;const g=new THREE.PlaneGeometry(.08,.55,1,2);g.translate(0,.27,0);const pa=g.attributes.position;for(let i=0;i<pa.count;i++){if(pa.getY(i)>.5)pa.setX(i,0);}
  const m=new THREE.MeshStandardMaterial({color:0x5d6a36,side:THREE.DoubleSide,roughness:1});
  grass=new THREE.InstancedMesh(g,m,n);const d=new THREE.Object3D();const c=new THREE.Color();let k=0;
  while(k<n){const x=rnd(-90,90),z=rnd(-85,-16);const h=H(x,z);if(h<3&&Math.random()<.85)continue;d.position.set(x,h,z);d.rotation.set(rnd(-.25,.25),rnd(0,6.3),rnd(-.25,.25));d.scale.setScalar(rnd(.6,1.5));d.updateMatrix();grass.setMatrixAt(k,d.matrix);c.setHSL(rnd(.15,.2),rnd(.3,.45),rnd(.22,.38));grass.setColorAt(k,c);k++;}
  grass.receiveShadow=true;scene.add(grass);}
// ---- sand normal map (ripples) ----
{const N=256;const hc=new Float32Array(N*N);for(let y=0;y<N;y++)for(let x=0;x<N;x++){hc[y*N+x]=Math.sin((x+Math.sin(y*.09)*9)*.35)*.5+Math.sin((x*.7+y*.3)*.11)*.3+Math.random()*.35;}
 const cv=document.createElement('canvas');cv.width=cv.height=N;const cx=cv.getContext('2d');const im=cx.createImageData(N,N);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const l=hc[y*N+(x-1+N)%N],r=hc[y*N+(x+1)%N],u=hc[((y-1+N)%N)*N+x],d=hc[((y+1)%N)*N+x];let nx=(l-r)*1.4,ny=(u-d)*1.4,nz=1;const L=Math.hypot(nx,ny,nz);const i=(y*N+x)*4;im.data[i]=(nx/L*.5+.5)*255;im.data[i+1]=(ny/L*.5+.5)*255;im.data[i+2]=(nz/L*.5+.5)*255;im.data[i+3]=255;}
 cx.putImageData(im,0,0);const nt=new THREE.CanvasTexture(cv);nt.wrapS=nt.wrapT=THREE.RepeatWrapping;nt.repeat.set(140,110);MAT.sand.normalMap=nt;MAT.sand.normalScale.set(.35,.35);MAT.sand.needsUpdate=true;}
// ---- post processing ----
let composer=null,bloom=null;
function buildComposer(on,bloomOn){if(composer){composer.dispose();composer=null;}if(!on)return;
  const rt=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:4});composer=new EffectComposer(renderer,rt);
  composer.addPass(new RenderPass(scene,camera));if(bloomOn){bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth/2,innerHeight/2),.35,.6,.9);composer.addPass(bloom);}composer.addPass(new OutputPass());
  composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight);}

// hedgehogs
function hedgehog(x,z){const g=new THREE.Group();for(let i=0;i<3;i++){const b=box(.22,.22,2.4,MAT.rust);b.rotation.set(i===0?.6:i===1?-.6:0,i===2?Math.PI/2:0,i===2?.6:0);g.add(b);}g.position.set(x,H(x,z)+.75,z);g.rotation.y=Math.random()*3;g.children.forEach(c=>{c.castShadow=true;});scene.add(g);g.updateMatrixWorld(true);g.children.forEach(c=>statics.push(c));
  colliders.push({minx:x-.8,maxx:x+.8,minz:z-.8,maxz:z+.8,miny:0,maxy:H(x,z)+1.5});}
const HH=[[-6,30],[5,26],[-14,22],[12,18],[-3,16],[20,12],[-22,10],[2,8],[-10,4],[14,2],[26,24],[-26,26],[34,16],[-34,14],[8,34],[-18,34],[30,4],[-30,0],[-1,-2],[18,-5],[-16,-6],[40,8],[-42,20],[44,28]];
HH.forEach(([x,z])=>hedgehog(x,z));
// seawall
for(let x=-66;x<66;x+=13){const w=box(10,1.4,1,MAT.concrete);w.position.set(x+5,H(x+5,-13)+.6,-13);addStatic(w);}
// burnt tank
(()=>{const g=new THREE.Group();const hull=box(3.2,1.3,6,MAT.char);hull.position.y=.75;g.add(hull);const tur=box(2.1,.9,2.6,MAT.char);tur.position.set(0,1.85,-.3);g.add(tur);const bar=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,3,8),MAT.char);bar.rotation.x=Math.PI/2;bar.position.set(0,1.9,-2.8);g.add(bar);
  for(const s of[-1,1]){const tr=box(.6,1,6.2,MAT.char);tr.position.set(s*1.7,.5,0);g.add(tr);}
  g.position.set(-19,H(-19,12),12);g.rotation.y=.4;g.rotation.z=.08;scene.add(g);g.updateMatrixWorld(true);g.children.forEach(c=>statics.push(c));colliders.push({minx:-22,maxx:-16,minz:8.5,maxz:15.5,miny:0,maxy:H(-19,12)+2.3});})();
// trench sandbags
const TRENCH_Z=-45;
for(let x=-38;x<44;x+=9){if(Math.abs(x-4)<3)continue;const b=box(7,1,1.1,MAT.bags);b.position.set(x,H(x,TRENCH_Z)+.45,TRENCH_Z);addStatic(b);}
for(const [x,z] of [[-8,-33.5],[15,-31.5],[-26,-30]]){const b=box(3.4,.9,.9,MAT.bags);b.position.set(x,H(x,z)+.4,z);addStatic(b);}
// bunker
const BK={x:6,z:-54};
(()=>{const y=H(BK.x,BK.z)-.2,m=MAT.concrete,bx=BK.x,bz=BK.z;
  const parts=[[9,1.4,1,0,.7,3],[9,.6,1,0,2.9,3],[1,3.2,7,-4,1.6,0],[1,3.2,7,4,1.6,0],[3.4,3.2,1,-2.8,1.6,-3],[3.4,3.2,1,2.8,1.6,-3],[9.6,.8,7.8,0,3.6,0]];
  for(const[w,h,d,ox,oy,oz]of parts){const b=box(w,h,d,m);b.position.set(bx+ox,y+oy,bz+oz);addStatic(b);}
  const dark=box(7.6,.01,5.6,new THREE.MeshStandardMaterial({color:0x1a1814}));dark.position.set(bx,y+.05,bz);scene.add(dark);
})();
// trees on bluff
for(let i=0;i<40;i++){const x=rnd(-120,120),z=rnd(-110,-62);if(Math.abs(x-BK.x)<12&&z>-66)continue;const g=new THREE.Group();const t=new THREE.Mesh(new THREE.CylinderGeometry(.2,.3,3,6),MAT.trunk);t.position.y=1.5;g.add(t);const s=rnd(1.8,3.2);for(let k=0;k<3;k++){const f=new THREE.Mesh(new THREE.IcosahedronGeometry(s*(1-k*.2),1),MAT.tree);f.position.set(rnd(-.6,.6),3+k*1.3,rnd(-.6,.6));f.castShadow=true;g.add(f);}g.position.set(x,H(x,z),z);scene.add(g);}
// craters
{const ct=ctex(128,128,(x)=>{const g=x.createRadialGradient(64,64,10,64,64,64);g.addColorStop(0,'rgba(25,20,15,.9)');g.addColorStop(.55,'rgba(45,38,28,.6)');g.addColorStop(.75,'rgba(110,95,70,.35)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,128,128);});
 const cm=new THREE.MeshStandardMaterial({map:ct,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,roughness:1});
 for(let i=0;i<34;i++){const x=rnd(-60,60),z=rnd(-40,38);const r=rnd(1.5,4);const m=new THREE.Mesh(new THREE.CircleGeometry(r,16),cm);m.rotation.x=-Math.PI/2;m.position.set(x,H(x,z)+.04,z);m.receiveShadow=true;scene.add(m);}}
// boats
function makeBoat(){const g=new THREE.Group(),m=MAT.navy;const fl=box(3.4,.2,8,m);fl.position.y=.1;g.add(fl);for(const s of[-1,1]){const w=box(.15,1.9,8,m);w.position.set(s*1.72,1,0);g.add(w);}const bk=box(3.6,2.3,.2,m);bk.position.set(0,1.15,4);g.add(bk);
  const piv=new THREE.Group();piv.position.set(0,.2,-4);const r=box(3.4,1.9,.18,m);r.position.y=.95;piv.add(r);g.add(piv);g.userData.ramp=piv;return g;}
const boats=[];
for(const [x,z,down] of [[0,44.5,0],[-20,52,1],[22,50,1],[-42,60,0],[40,64,0]]){const b=makeBoat();b.position.set(x,0,z);if(down)b.userData.ramp.rotation.x=-1.35;scene.add(b);boats.push(b);}
const myBoat=boats[0];

/* ================= SOLDIERS ================= */
const GEO={helmAx:new THREE.CylinderGeometry(.15,.21,.16,12),helmUS:new THREE.SphereGeometry(.185,12,8,0,Math.PI*2,0,Math.PI/2)};
// ---- realistic character models (GLB). Drop files in public/models/: us_soldier.glb, axis_soldier.glb ----
const CHAR={};const HITMAT=new THREE.MeshBasicMaterial({visible:false});
async function loadCharacters(onProg){const L=new GLTFLoader();const list=[['us','models/us_soldier.glb'],['axis','models/axis_soldier.glb']];let n=0;
  for(const [k,f] of list){try{const g=await L.loadAsync(BASE+f);const b=new THREE.Box3().setFromObject(g.scene);const h=b.max.y-b.min.y;const sc=1.78/(h||1.78);
      g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});CHAR[k]={scene:g.scene,anims:g.animations,scale:sc,minY:b.min.y};}catch(e){}
    onProg&&onProg(++n/list.length);}}
function clipBy(anims,re){return anims.find(a=>re.test(a.name));}
function makeSoldierGLB(team){const C=CHAR[team];const g=new THREE.Group(),rig=new THREE.Group();g.add(rig);
  const m=SkeletonUtils.clone(C.scene);m.scale.setScalar(C.scale);m.position.y=-C.minY*C.scale;rig.add(m);
  const hit=[];const hb=(w,h,d,y,part)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),HITMAT);o.position.y=y;o.userData.part=part;rig.add(o);hit.push(o);};
  hb(.5,.75,.35,1.15,'body');hb(.42,.8,.3,.42,'body');hb(.26,.3,.28,1.64,'head');
  const mixer=new THREE.AnimationMixer(m);const acts={};
  for(const [k,re] of [['idle',/idle|stand|aim/i],['run',/run|sprint/i],['walk',/walk/i]]){const c=clipBy(C.anims,re);if(c){acts[k]=mixer.clipAction(c);acts[k].play();acts[k].setEffectiveWeight(k==='idle'?1:0);}}
  if(!acts.idle&&C.anims[0]){acts.idle=mixer.clipAction(C.anims[0]);acts.idle.play();}
  mixer.update(Math.random()*2);mixers.push(mixer);
  const muz=new THREE.Object3D();muz.position.set(.15,1.35,.8);rig.add(muz);
  return{g,rig,legs:null,arms:null,hit,muz,mixer,acts,glb:true};}
const mixers=[];
function makeSoldier(team){if(CHAR[team])return makeSoldierGLB(team);
  const ax=team==='axis',g=new THREE.Group(),rig=new THREE.Group();g.add(rig);const mU=ax?MAT.feld:MAT.olive;const hit=[];
  const torso=box(.5,.62,.3,mU);torso.position.y=1.17;rig.add(torso);torso.userData.part='body';hit.push(torso);
  const belt=box(.52,.08,.32,MAT.leather);belt.position.y=.87;rig.add(belt);
  const pack=box(.38,.4,.18,ax?MAT.leather:MAT.olive);pack.position.set(0,1.2,-.23);rig.add(pack);
  const head=box(.22,.25,.24,MAT.skin);head.position.y=1.62;rig.add(head);head.userData.part='head';hit.push(head);
  const helm=new THREE.Mesh(ax?GEO.helmAx:GEO.helmUS,ax?MAT.helmAx:MAT.helmUS);helm.position.y=ax?1.75:1.7;helm.castShadow=true;rig.add(helm);helm.userData.part='head';hit.push(helm);
  const legs=[];for(const sx of[-.13,.13]){const p=new THREE.Group();p.position.set(sx,.88,0);const l=box(.19,.82,.22,mU);l.position.y=-.41;p.add(l);const bt=box(.2,.14,.3,MAT.boot);bt.position.set(0,-.8,.04);p.add(bt);rig.add(p);legs.push(p);l.userData.part='body';hit.push(l);}
  const arms=[];for(const sx of[-.31,.31]){const p=new THREE.Group();p.position.set(sx,1.42,0);const a=box(.14,.58,.15,mU);a.position.y=-.29;p.add(a);const hd=box(.1,.1,.1,MAT.skin);hd.position.y=-.6;p.add(hd);p.rotation.x=sx<0?-1.25:-.9;p.rotation.z=sx<0?.35:-.15;rig.add(p);arms.push(p);}
  const rifle=box(.07,.09,1.1,MAT.wood);rifle.position.set(.02,1.25,.45);rig.add(rifle);
  const muz=new THREE.Object3D();muz.position.set(.02,1.27,1.02);rig.add(muz);
  return{g,rig,legs,arms,hit,muz};
}

/* ================= PARTICLES ================= */
function radTex(stops,n){return ctex(64,64,(x,w,h)=>{const g=x.createRadialGradient(32,32,0,32,32,32);stops.forEach(s=>g.addColorStop(s[0],s[1]));x.fillStyle=g;x.fillRect(0,0,w,h);if(n){x.globalCompositeOperation='destination-out';for(let i=0;i<n;i++){x.fillStyle=`rgba(0,0,0,${Math.random()*.25})`;x.beginPath();x.arc(Math.random()*64,Math.random()*64,rnd(2,8),0,7);x.fill();}}});}
const PT={smoke:radTex([[0,'rgba(255,255,255,.85)'],[.45,'rgba(255,255,255,.4)'],[1,'rgba(255,255,255,0)']],40),
  fire:radTex([[0,'rgba(255,255,230,1)'],[.25,'rgba(255,200,90,.9)'],[.6,'rgba(255,90,20,.4)'],[1,'rgba(255,40,0,0)']]),
  flash:ctex(64,64,(x)=>{x.translate(32,32);for(let i=0;i<6;i++){x.rotate(Math.PI/3);const g=x.createLinearGradient(0,0,30,0);g.addColorStop(0,'rgba(255,240,200,1)');g.addColorStop(1,'rgba(255,150,40,0)');x.fillStyle=g;x.beginPath();x.moveTo(0,-5);x.lineTo(32,0);x.lineTo(0,5);x.fill();}const g=x.createRadialGradient(0,0,0,0,0,14);g.addColorStop(0,'#fff');g.addColorStop(1,'rgba(255,200,100,0)');x.fillStyle=g;x.fillRect(-16,-16,32,32);})};
const PART={pool:[],act:[]};
for(let i=0;i<700;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:PT.smoke,transparent:true,depthWrite:false}));s.visible=false;scene.add(s);PART.pool.push(s);}
const PTYPE={
  smoke:{tex:'smoke',col:0x6e675d,add:0,s0:2,s1:8,life:[4,7],op:.5,grav:-.1,vel:[1,1.4,1],drag:.4},
  bsmoke:{tex:'smoke',col:0x2c2925,add:0,s0:2.5,s1:9,life:[4,7],op:.6,grav:-.2,vel:[.6,1.8,.6],drag:.3},
  fire:{tex:'fire',col:0xffffff,add:1,s0:1.6,s1:.3,life:[.4,.9],op:1,grav:-2,vel:[1.5,3,1.5],drag:1},
  dirt:{tex:'smoke',col:0x564835,add:0,s0:.8,s1:3.4,life:[1,1.6],op:.9,grav:9,vel:[5,11,5],drag:.6},
  spark:{tex:'fire',col:0xffcc66,add:1,s0:.25,s1:.05,life:[.25,.5],op:1,grav:9,vel:[9,9,9],drag:.2},
  dust:{tex:'smoke',col:0x9a8a70,add:0,s0:.15,s1:1,life:[.5,.8],op:.7,grav:-.3,vel:[.8,1.2,.8],drag:2},
  blood:{tex:'smoke',col:0x5a0808,add:0,s0:.12,s1:.55,life:[.3,.5],op:.9,grav:3,vel:[1.2,1.5,1.2],drag:2},
  splash:{tex:'smoke',col:0xcfdce0,add:0,s0:.3,s1:1.8,life:[.7,1.1],op:.8,grav:12,vel:[1.5,6,1.5],drag:.5},
  bigsplash:{tex:'smoke',col:0xd8e2e4,add:0,s0:1.2,s1:5,life:[1.4,2],op:.85,grav:9,vel:[3,16,3],drag:.3},
  flash:{tex:'flash',col:0xffffff,add:1,s0:3.5,s1:5,life:[.08,.12],op:1,grav:0,vel:[0,0,0],drag:0},
  mflash:{tex:'flash',col:0xffffff,add:1,s0:.6,s1:.9,life:[.05,.06],op:1,grav:0,vel:[0,0,0],drag:0}
};
let partLimit=450;
function emit(type,pos,n=1,dir){const T=PTYPE[type];for(let i=0;i<n;i++){if(PART.act.length>=partLimit||!PART.pool.length)return;const s=PART.pool.pop();const m=s.material;m.map=PT[T.tex];m.color.setHex(T.col);m.blending=T.add?THREE.AdditiveBlending:THREE.NormalBlending;m.rotation=Math.random()*6.28;m.opacity=T.op;
  s.position.copy(pos);const v=new V3(rnd(-T.vel[0],T.vel[0]),T.vel[1]*(type==='dirt'||type==='splash'||type==='bigsplash'?rnd(.5,1):rnd(.2,1)),rnd(-T.vel[2],T.vel[2]));if(dir)v.addScaledVector(dir,rnd(.5,1));const l=rnd(T.life[0],T.life[1]);
  s.userData={T,v,life:l,max:l};s.scale.setScalar(T.s0);s.visible=true;PART.act.push(s);}}
function updParts(dt){for(let i=PART.act.length-1;i>=0;i--){const s=PART.act[i],u=s.userData;u.life-=dt;if(u.life<=0){s.visible=false;PART.act.splice(i,1);PART.pool.push(s);continue;}
  const k=1-u.life/u.max;u.v.y-=u.T.grav*dt;u.v.multiplyScalar(1-u.T.drag*dt);s.position.addScaledVector(u.v,dt);s.scale.setScalar(lerp(u.T.s0,u.T.s1,Math.sqrt(k)));s.material.opacity=u.T.op*(k<.1?k*10:1)*(1-k);}}
// tracers
const TRC={pool:[],act:[]};const trGeo=new THREE.BoxGeometry(.035,.035,1);
for(let i=0;i<60;i++){const m=new THREE.Mesh(trGeo,new THREE.MeshBasicMaterial({color:0xffd27a,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));m.visible=false;scene.add(m);TRC.pool.push(m);}
function tracer(a,b,col=0xffd27a){const m=TRC.pool.pop();if(!m)return;const d=b.clone().sub(a);const L=d.length();if(L<1){TRC.pool.push(m);return;}m.material.color.setHex(col);m.userData={a:a.clone(),dir:d.normalize(),L,t:0,len:Math.min(5,L*.4)};m.scale.set(1,1,m.userData.len);m.visible=true;TRC.act.push(m);}
function updTracers(dt){for(let i=TRC.act.length-1;i>=0;i--){const m=TRC.act[i],u=m.userData;u.t+=dt*320;if(u.t>u.L+u.len){m.visible=false;TRC.act.splice(i,1);TRC.pool.push(m);continue;}const c=Math.min(u.t,u.L)-u.len/2;m.position.copy(u.a).addScaledVector(u.dir,Math.max(u.len/2,c));m.lookAt(m.position.clone().add(u.dir));}}
// emitters
const emitters=[];function addEmitter(pos,type,rate,ttl=1e9){emitters.push({pos:pos.clone(),type,rate,t:0,ttl});}
addEmitter(new V3(-19,H(-19,12)+2,12),'bsmoke',.35);addEmitter(new V3(-19,H(-19,12)+1.8,12),'fire',.08);
addEmitter(new V3(-40,0,30),'smoke',.6);addEmitter(new V3(35,0,-2),'smoke',.7);addEmitter(new V3(-60,8,-50),'bsmoke',.5);addEmitter(new V3(55,9,-58),'bsmoke',.6);addEmitter(new V3(42,0,64),'bsmoke',.4);for(const [x,z] of [[-50,18],[-28,-6],[48,22],[24,-9],[-8,28],[60,-30],[-45,-35]])addEmitter(new V3(x,H(x,z)+.5,z),'smoke',rnd(.5,.9));addEmitter(new V3(42,1.2,64),'fire',.1);
function updEmitters(dt){for(let i=emitters.length-1;i>=0;i--){const e=emitters[i];e.ttl-=dt;if(e.ttl<=0){emitters.splice(i,1);continue;}e.t-=dt;if(e.t<=0){e.t=e.rate*(.6+Math.random()*.8);emit(e.type,e.pos.clone().add(new V3(rnd(-.8,.8),0,rnd(-.8,.8))));}}}

/* ================= GAME STATE ================= */
let state='menu',time=0,shake=0;
const pl={pos:new V3(0,0,38.5),vel:new V3(),yaw:0,pitch:0,onG:true,stance:0,eye:1.65,hp:100,lastHurt:-99,ads:0,adsOn:false,sprint:false,cur:0,ws:[],reload:0,switchT:0,fireCool:0,nades:4,bob:0,kick:0,melee:0,plant:0,trig:false,lastShot:-9,deaths:0};
const WEAP=[
  {name:'M1 GARAND',mag:8,res:64,dmg:65,rate:.2,auto:false,spread:.02,ads:.0012,recoil:.032,rl:2.1,zoom:1.7,snd:'garand',hip:[.15,-.17,-.34],aim:[0,-.056,-.26]},
  {name:'THOMPSON M1A1',mag:30,res:150,dmg:27,rate:.085,auto:true,spread:.03,ads:.009,recoil:.011,rl:2.5,zoom:1.3,snd:'thompson',hip:[.15,-.15,-.34],aim:[0,-.05,-.26]},
  {name:'M1911 PISTOL',mag:7,res:42,dmg:38,rate:.14,auto:false,spread:.025,ads:.005,recoil:.03,rl:1.5,zoom:1.15,snd:'pistol',hip:[.11,-.11,-.33],aim:[0,-.038,-.3]}];
const stats={shots:0,hits:0,kills:0,heads:0,start:0,score:0};
const keys={};let mouseL=false,mouseR=false;
const enemies=[],allies=[],nades=[];let hitList=[];
function rebuildHit(){hitList=statics.slice();for(const e of enemies)if(e.alive)hitList.push(...e.s.hit);}

/* ---- viewmodel ---- */
const vmScene=new THREE.Scene();const vmCam=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.01,10);vmScene.add(vmCam);
vmScene.add(new THREE.HemisphereLight(0xb4bcc4,0x4a3e30,1.8));{const dl=new THREE.DirectionalLight(0xffcc99,3.2);dl.position.set(-1,2,1.5);vmScene.add(dl);}
const VM=new THREE.Group();vmCam.add(VM);const vms=[];
function vmMat(m){const c=m.clone();c.fog=false;return c;}
(()=>{const wood=vmMat(MAT.wood),met=vmMat(MAT.gunMetal),skin=vmMat(MAT.skin),sleeve=vmMat(MAT.olive);sleeve.color.setHex(0x4a4832);
  const hands=(g,lz,rz)=>{const lh=box(.045,.04,.075,skin);lh.position.set(0,-.025,lz);g.add(lh);const ls=box(.062,.062,.32,sleeve);ls.position.set(-.05,-.075,lz+.15);ls.rotation.set(.22,-.35,0);g.add(ls);
    const rh=box(.045,.05,.06,skin);rh.position.set(.012,-.04,rz);g.add(rh);const rs=box(.068,.068,.3,sleeve);rs.position.set(.045,-.09,rz+.16);rs.rotation.set(.3,.15,0);g.add(rs);};
  const cyl=(r,l,m)=>{const c=new THREE.Mesh(new THREE.CylinderGeometry(r,r,l,10),m);c.rotation.x=Math.PI/2;return c;};
  // garand
  let g=new THREE.Group();let o=box(.045,.06,.5,wood);o.position.set(0,-.015,-.22);g.add(o);o=box(.042,.03,.26,wood);o.position.set(0,.035,-.52);g.add(o);
  o=box(.04,.045,.2,met);o.position.set(0,.025,-.25);g.add(o);o=cyl(.009,.42,met);o.position.set(0,.03,-.66);g.add(o);
  o=box(.006,.025,.006,met);o.position.set(0,.05,-.83);g.add(o);o=box(.022,.02,.015,met);o.position.set(0,.055,-.13);g.add(o);
  hands(g,-.45,-.04);let mz=new THREE.Object3D();mz.position.set(0,.03,-.88);g.add(mz);g.userData.muz=mz;vms.push(g);
  // thompson
  g=new THREE.Group();o=box(.05,.06,.32,met);o.position.set(0,.012,-.2);g.add(o);o=box(.04,.075,.25,wood);o.position.set(0,-.015,.05);g.add(o);
  o=cyl(.015,.2,met);o.position.set(0,.015,-.46);g.add(o);for(let k=0;k<5;k++){const f=cyl(.02,.008,met);f.position.set(0,.015,-.4-k*.025);g.add(f);}
  o=box(.035,.07,.05,wood);o.position.set(0,-.04,-.36);g.add(o);o=box(.03,.16,.045,met);o.position.set(0,-.09,-.2);g.add(o);
  o=box(.035,.08,.035,wood);o.position.set(0,-.055,-.07);o.rotation.x=.3;g.add(o);o=box(.006,.02,.006,met);o.position.set(0,.05,-.5);g.add(o);o=box(.02,.02,.012,met);o.position.set(0,.05,-.07);g.add(o);
  hands(g,-.37,-.07);mz=new THREE.Object3D();mz.position.set(0,.015,-.57);g.add(mz);g.userData.muz=mz;vms.push(g);
  // pistol
  g=new THREE.Group();o=box(.028,.035,.17,met);o.position.set(0,.015,-.08);g.add(o);o=box(.026,.09,.04,wood);o.position.set(0,-.04,0);o.rotation.x=.25;g.add(o);
  o=box(.006,.012,.006,met);o.position.set(0,.038,-.155);g.add(o);
  o=box(.05,.06,.07,skin);o.position.set(.004,-.06,.01);g.add(o);o=box(.04,.055,.07,skin);o.position.set(-.03,-.065,0);g.add(o);
  o=box(.065,.065,.3,sleeve);o.position.set(.03,-.1,.17);o.rotation.x=.3;g.add(o);o=box(.06,.06,.3,sleeve);o.position.set(-.06,-.1,.16);o.rotation.set(.3,-.3,0);g.add(o);
  mz=new THREE.Object3D();mz.position.set(0,.015,-.17);g.add(mz);g.userData.muz=mz;vms.push(g);
  vms.forEach((v,i)=>{v.visible=i===0;v.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;o.renderOrder=10;}});VM.add(v);});
})();
const mflash=new THREE.Sprite(new THREE.SpriteMaterial({map:PT.flash,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,fog:false}));mflash.visible=false;mflash.scale.setScalar(.35);

/* ================= HUD helpers ================= */
let subQ=[],subT=0;
function say(who,text,dur=3.5){subQ.push({who,text,dur});}
function updSubs(dt){if(subT>0){subT-=dt;if(subT<=0)$('subs').innerHTML='';}if(subT<=0&&subQ.length){const s=subQ.shift();subT=s.dur;if(S.subs)$('subs').innerHTML=(s.who?`<b>${s.who}:</b> `:'')+s.text;SND.ui();}}
function feed(html){if(!$('feed'))return;const d=document.createElement('div');d.innerHTML=html;$('feed').prepend(d);setTimeout(()=>d.remove(),4000);while($('feed').children.length>5)$('feed').lastChild.remove();}
function xp(t){if(!S.xpPopups)return;const d=document.createElement('div');d.textContent=t;$('xp').appendChild(d);setTimeout(()=>d.remove(),1400);}
let hitmT=0;function hitmark(kill){if(!S.hitmarkers)return;const h=$('hitm');h.className=kill?'kill':'';h.style.opacity=1;hitmT=.25;SND.hit();}
function dmgDir(src){const dx=src.x-pl.pos.x,dz=src.z-pl.pos.z;const ang=Math.atan2(dx,-dz)*180/Math.PI;const bear=-pl.yaw*180/Math.PI;const rel=ang-bear;const d=document.createElement('div');d.className='dd';d.style.transform=`rotate(${rel}deg)`;$('dmgdir').appendChild(d);d.animate([{opacity:1},{opacity:0}],{duration:1400});setTimeout(()=>d.remove(),1400);}
function setObj(txt){$('obj').innerHTML=`<div class="h">OBJECTIVE</div>${txt}`;$('obj').classList.remove('flash');void $('obj').offsetWidth;$('obj').classList.add('flash');$('pobj').textContent='Objective: '+txt.replace(/<[^>]+>/g,'');}

/* ================= COMBAT ================= */
const ray=new THREE.Raycaster();
function terrainHit(o,d,maxD){let prev=0;for(let t=.5;t<maxD;t+=.6){const y=o.y+d.y*t;if(y<H(o.x+d.x*t,o.z+d.z*t)){let a=prev,b=t;for(let k=0;k<6;k++){const m=(a+b)/2;if(o.y+d.y*m<H(o.x+d.x*m,o.z+d.z*m))b=m;else a=m;}return b;}prev=t;}return Infinity;}
function castShot(o,d,maxD,list){ray.set(o,d);ray.far=maxD;const hs=ray.intersectObjects(list,false);const th=terrainHit(o,d,maxD);let h=hs[0];if(h&&h.distance<th)return{dist:h.distance,obj:h.object,point:h.point};if(th<Infinity)return{dist:th,obj:null,point:o.clone().addScaledVector(d,th),terrain:true};return null;}
function blocked(a,b){const d=b.clone().sub(a);const L=d.length();d.normalize();const r=castShot(a,d,L-.3,statics);return !!r;}
function eyePos(){return new V3(pl.pos.x,pl.pos.y+pl.eye,pl.pos.z);}
function camFwd(){const v=new V3();camera.getWorldDirection(v);return v;}
function impact(p,terr,water){if(water||p.z>40.3){emit('splash',p,4);SND.splash(p.distanceTo(pl.pos));}else{emit('dust',p,terr?5:3);if(!terr)emit('spark',p,3);}}

function fire(){
  const w=WEAP[pl.cur],ws=pl.ws[pl.cur];
  if(pl.reload>0||pl.switchT>0||pl.fireCool>0||pl.melee>0)return;
  if(ws.mag<=0){SND.click();pl.fireCool=.3;if(ws.res>0)startReload();return;}
  pl.sprint=false;ws.mag--;pl.fireCool=w.rate;stats.shots++;pl.lastShot=time;SND[w.snd]();
  const mz=vms[pl.cur].userData.muz;mz.add(mflash);mflash.visible=true;mflash.material.rotation=Math.random()*6;mflash.scale.setScalar(rnd(.25,.45));setTimeout(()=>mflash.visible=false,45);
  const mw=new V3();mz.getWorldPosition(mw);mw.applyMatrix4(camera.matrixWorld);muzzleLight.position.copy(mw);muzzleLight.intensity=25;
  const moving=Math.hypot(pl.vel.x,pl.vel.z)>1;const sp=lerp(w.spread*(moving?1.6:1)*(pl.stance?0.7:1),w.ads,pl.ads);
  const d=camFwd();d.x+=rnd(-sp,sp);d.y+=rnd(-sp,sp);d.z+=rnd(-sp,sp);d.normalize();
  const o=eyePos();const r=castShot(o,d,350,hitList);
  const end=r?r.point:o.clone().addScaledVector(d,300);
  if(pl.cur===1?Math.random()<.4:true)tracer(mw,end,0xffe2a0);
  if(r){const e=r.obj&&r.obj.userData.enemy;
    if(e&&e.alive){const head=r.obj.userData.part==='head';const fall=clamp(1.2-r.dist/180,.6,1);e.hp-=w.dmg*(head?2.6:1)*fall;stats.hits++;emit('blood',r.point,5);
      if(e.hp<=0)killEnemy(e,head,false);else{hitmark(false);e.alert=1;e.stand=0;}}
    else impact(r.point,r.terrain);}
  pl.pitch+=w.recoil*rnd(.7,1.2)*(pl.ads>.5?.55:1)*(pl.stance===2?.5:1);pl.yaw+=rnd(-1,1)*w.recoil*.35;pl.kick=1;
  if(ws.mag===0&&ws.res>0)setTimeout(()=>{if(state==='play'&&pl.ws[pl.cur]===ws&&ws.mag===0)startReload();},250);
}
function startReload(){const w=WEAP[pl.cur],ws=pl.ws[pl.cur];if(pl.reload>0||ws.mag>=w.mag||ws.res<=0||pl.switchT>0)return;pl.reload=w.rl;SND.reload();}
function finishReload(){const w=WEAP[pl.cur],ws=pl.ws[pl.cur];const need=w.mag-ws.mag,take=Math.min(need,ws.res);ws.mag+=take;ws.res-=take;if(pl.cur===0&&take>0){}}
function switchW(i){if(i===pl.cur||i<0||i>2||pl.switchT>0)return;pl.reload=0;pl.switchT=.45;pl.next=i;}
function meleeAtk(){if(pl.melee>0)return;pl.melee=.45;SND.knife();const f=camFwd();f.y=0;f.normalize();for(const e of enemies){if(!e.alive)continue;const d=e.pos.clone().sub(pl.pos);d.y=0;if(d.length()<2.4&&d.normalize().dot(f)>.5){killEnemy(e,false,true);emit('blood',e.pos.clone().add(new V3(0,1.3,0)),10);break;}}}
function throwNade(fromEnemy,e){
  const m=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),MAT.helmUS);m.castShadow=true;scene.add(m);let p,v;
  if(fromEnemy){p=e.pos.clone().add(new V3(0,1.6,0));const tgt=pl.pos.clone().add(new V3(rnd(-2.5,2.5),0,rnd(-2.5,2.5)));const d=tgt.sub(p);const fl=Math.hypot(d.x,d.z);const T=clamp(fl/13,.8,2.2);v=new V3(d.x/T,(d.y+9*T*T)/T,d.z/T);}
  else{if(pl.nades<=0)return;pl.nades--;p=eyePos().addScaledVector(camFwd(),.5);v=camFwd().multiplyScalar(17);v.y+=4;}
  m.position.copy(p);nades.push({m,v,fuse:fromEnemy?3.2:3,enemy:fromEnemy});}
function explode(p,big,owner){
  const dist=p.distanceTo(pl.pos);
  if(p.z>40.3&&p.y<.5){emit('bigsplash',p,big?24:14);emit('flash',p.clone().add(new V3(0,1,0)),1);}
  else{emit('flash',p.clone().add(new V3(0,.6,0)),1);emit('fire',p.clone().add(new V3(0,.6,0)),big?16:9);emit('dirt',p,big?22:12);emit('smoke',p.clone().add(new V3(0,1,0)),big?9:5);emit('spark',p,10);}
  flashLight.position.copy(p).add(new V3(0,2,0));flashLight.intensity=big?2500:1200;SND.boom(dist);
  if(S.shake)shake=Math.max(shake,clamp(1.2-dist/(big?60:35),0,1));
  if(owner){const R=big?9:7;
    if(dist<R&&state==='play'&&!blocked(p.clone().add(new V3(0,.5,0)),eyePos()))hurt((owner==='enemy'?140*DIFF[S.difficulty].dmg:120)*(1-dist/R),p,true);
    if(owner!=='enemy')for(const e of enemies){if(!e.alive)continue;const d=e.pos.distanceTo(p);if(d<R){e.hp-=220*(1-d/R);if(e.hp<=0)killEnemy(e,false,false,true);else hitmark(false);}}}
}
function hurt(dmg,src,raw){if(state!=='play'||!pl.alive)return;pl.hp-=raw?dmg:dmg*DIFF[S.difficulty].dmg;pl.lastHurt=time;dmgDir(src);SND.hurt();if(S.shake)shake=Math.max(shake,.25);if(pl.hp<=0)die();}
function killEnemy(e,head,melee,nade){
  if(!e.alive)return;e.alive=false;e.deathT=0;e.fallDir=Math.random()<.5?1:-1;stats.kills++;if(head)stats.heads++;rebuildHit();hitmark(true);
  let pts=100;let tag='';if(head){pts+=50;tag=' <em>(headshot)</em>';}if(melee){pts+=50;tag=' <em>(knife)</em>';}if(nade)tag=' <em>(grenade)</em>';stats.score+=pts;
  xp(`+${pts}${head?' HEADSHOT':melee?' MELEE':''}`);feed(`<b>Kane</b> ▸ ${e.type==='mg'?'MG42 Gunner':'Rifleman'}${tag}`);
  if(e.counts&&mission.phase==='trench')mission.kills++;
  if(e.type==='mg'&&!mission.bunkerDown)setTimeout(()=>{if(!mission.bunkerDown&&state!=='menu')spawnEnemy(BK.x,BK.z+1.6,'mg');},12000);
}
function die(){pl.alive=false;pl.deaths++;state='dead';exitLock();document.body.classList.remove('play');
  const q=["The beach doesn't care how brave you are. Keep your head down.","Cover is life. Hedgehogs, the tank, the seawall — use them.","Crouched and prone soldiers are much harder to hit.","Grenades clear trenches faster than rifles ever will.","Heads down, keep moving. Standing still in the open gets you killed."];
  $('deadq').textContent=q[Math.floor(Math.random()*q.length)];setTimeout(()=>show('dead'),900);}

/* ================= ENEMIES / ALLIES ================= */
function spawnEnemy(x,z,type='rifle',o={}){
  const s=makeSoldier('axis');s.g.position.set(x,H(x,z),z);scene.add(s.g);
  const e={s,g:s.g,pos:s.g.position,type,hp:(type==='mg'?110:100)*DIFF[S.difficulty].hp,alive:true,cool:rnd(1.5,4),stand:0,crouch:o.trench?1:0,trench:!!o.trench,counts:o.counts!==false,target:o.target||null,lastFire:-9,gren:rnd(8,18),burst:0,burstOn:true,deathT:0,looted:false,run:0};
  if(type==='mg'){e.s.rifle=null;}
  s.hit.forEach(m=>m.userData.enemy=e);enemies.push(e);rebuildHit();return e;}
function spawnAlly(x,z,tx,tz,delay=0,doomed=false){const s=makeSoldier('us');s.g.position.set(x,Math.max(H(x,z),-.3),z);scene.add(s.g);const a={s,g:s.g,pos:s.g.position,target:new V3(tx,0,tz),delay,doomed,alive:true,deathT:0,cool:rnd(1,3),run:0,crouch:0};allies.push(a);return a;}
const _v=new V3();
function animRun(s,run,dt,spd){if(s.glb){const a=s.acts;const r=run>0?1:0;if(a.run){a.run.setEffectiveWeight(lerp(a.run.getEffectiveWeight(),r,Math.min(1,dt*8)));}if(a.idle)a.idle.setEffectiveWeight(1-(a.run?a.run.getEffectiveWeight():0));return;}s.run=(s.run||0)+dt*spd*2.2;const a=Math.sin(s.run)*.75*run;s.legs[0].rotation.x=a;s.legs[1].rotation.x=-a;s.rig.rotation.x=.12*run;}
function updEnemies(dt){
  for(const e of enemies){
    if(!e.alive){if(e.deathT<1){e.deathT+=dt*2.2;e.s.rig.rotation.x=e.fallDir*-Math.PI/2*ease(Math.min(1,e.deathT));e.s.rig.position.y=-.1*Math.min(1,e.deathT);}
      if(!e.looted&&state==='play'&&e.pos.distanceTo(pl.pos)<1.8){e.looted=true;const w=WEAP[pl.cur];pl.ws[pl.cur].res=Math.min(pl.ws[pl.cur].res+w.mag*2,w.res*1.5|0);xp('+AMMO');SND.click();}continue;}
    const dx=pl.pos.x-e.pos.x,dz=pl.pos.z-e.pos.z,dist=Math.hypot(dx,dz);
    if(e.target){_v.set(e.target.x-e.pos.x,0,e.target.z-e.pos.z);const L=_v.length();if(L<.6){e.target=null;e.crouch=1;e.trench=true;}else{_v.normalize();e.pos.x+=_v.x*3.6*dt;e.pos.z+=_v.z*3.6*dt;e.pos.y=H(e.pos.x,e.pos.z);e.g.rotation.y=Math.atan2(_v.x,_v.z);animRun(e.s,1,dt,3.6);continue;}}
    animRun(e.s,0,dt,0);
    const fy=Math.atan2(dx,dz);e.g.rotation.y+=((fy-e.g.rotation.y+Math.PI*3)%(Math.PI*2)-Math.PI)*Math.min(1,dt*4);
    const range=e.type==='mg'?150:88;e.cool-=dt;
    if(e.trench){const want=(e.cool<.9||e.stand>0)?0:1;e.stand-=dt;e.crouch=lerp(e.crouch,want,Math.min(1,dt*6));e.s.rig.position.y=-e.crouch*.72;}
    if(e.type==='mg'){e.burst-=dt;if(e.burst<=0){e.burstOn=!e.burstOn;e.burst=e.burstOn?rnd(1.2,2):rnd(.8,1.6);}if(!e.burstOn)continue;}
    if(e.cool<=0&&(state==='play'||state==='cine')){
      e.cool=e.type==='mg'?.095:rnd(1.5,2.8)/Math.pow(DIFF[S.difficulty].acc,.3);e.stand=.6;
      const from=new V3();e.s.muz.getWorldPosition(from);if(e.type==='mg')from.set(e.pos.x+Math.sin(e.g.rotation.y)*1,e.pos.y+1.45,e.pos.z+Math.cos(e.g.rotation.y)*1);
      const real=state==='play'&&dist<range&&pl.alive;let tgt;
      if(real)tgt=eyePos().add(new V3(0,-.35,0));else tgt=new V3(rnd(-30,30),0,rnd(0,40));if(!real)tgt.y=H(tgt.x,tgt.z);
      if(!real&&e.type!=='mg'&&Math.random()<.6)continue;
      emit('mflash',from,1);e.lastFire=time;
      const los=real&&!blocked(from,tgt);
      const p=(e.type==='mg'?.065:.24)*DIFF[S.difficulty].acc*clamp(1.25-dist/70,.07,1)*(pl.stance===1?.6:pl.stance===2?.4:1)*(pl.sprint?.7:1);
      const hit=los&&Math.random()<p;let end=tgt.clone();
      if(!hit){end.add(new V3(rnd(-2,2),rnd(-1.2,1.5),rnd(-2,2)));const d=end.clone().sub(from).normalize();const r=castShot(from,d,dist+30,statics);end=r?r.point:from.clone().addScaledVector(d,dist+30);if(r)impact(r.point,r.terrain);
        if(real&&los&&Math.random()<.35){SND.whiz();}}
      tracer(from,end,e.type==='mg'?0xffb060:0xffd27a);
      if(e.type==='mg')SND.mg(dist);else SND.eRifle(dist);
      if(hit)hurt(e.type==='mg'?10:19,e.pos);
    }
    if(e.type!=='mg'&&state==='play'&&dist<30&&dist>9&&pl.alive){e.gren-=dt;if(e.gren<=0){e.gren=rnd(14,24);throwNade(true,e);}}
  }
}
function updAllies(dt){for(const a of allies){
  if(!a.alive){if(a.deathT<1){a.deathT+=dt*2;a.s.rig.rotation.x=-Math.PI/2*ease(Math.min(1,a.deathT));}continue;}
  if(a.delay>0){a.delay-=dt;continue;}
  if(a.target){_v.set(a.target.x-a.pos.x,0,a.target.z-a.pos.z);const L=_v.length();if(L<.6){a.target=null;a.crouch=1;}else{_v.normalize();const sp=a.pos.z>39?3:4.6;a.pos.x+=_v.x*sp*dt;a.pos.z+=_v.z*sp*dt;a.pos.y=Math.max(H(a.pos.x,a.pos.z),-.35);a.g.rotation.y=Math.atan2(_v.x,_v.z);animRun(a.s,1,dt,sp);a.s.rig.position.y=0;
    if(a.doomed&&a.pos.z<a.doomed){a.alive=false;explode(a.pos.clone(),false,null);}continue;}}
  animRun(a.s,0,dt,0);a.s.rig.position.y=lerp(a.s.rig.position.y,-a.crouch*.65,dt*5);
  a.cool-=dt;const tg=enemies.find(e=>e.alive&&e.pos.distanceTo(a.pos)<90);
  if(tg){a.g.rotation.y=Math.atan2(tg.pos.x-a.pos.x,tg.pos.z-a.pos.z);if(a.cool<=0){a.cool=rnd(1.5,3.5);a.s.rig.position.y=0;const f=new V3();a.s.muz.getWorldPosition(f);const t=tg.pos.clone().add(new V3(rnd(-1.5,1.5),rnd(.5,2.5),rnd(-1.5,1.5)));tracer(f,t);emit('mflash',f,1);SND.eRifle(a.pos.distanceTo(pl.pos));
    if(Math.random()<.035&&!(mission.phase==='trench'&&tg.counts&&mission.kills>=mission.need-2)){killEnemy(tg,false,false);stats.kills--;stats.score-=100;}}}
}}
function updNades(dt){for(let i=nades.length-1;i>=0;i--){const n=nades[i];n.fuse-=dt;n.v.y-=18*dt;n.m.position.addScaledVector(n.v,dt);const p=n.m.position;const g=H(p.x,p.z)+.07;
  if(p.y<g){p.y=g;n.v.y*=-.3;n.v.x*=.55;n.v.z*=.55;}
  for(const c of colliders){if(p.x>c.minx&&p.x<c.maxx&&p.z>c.minz&&p.z<c.maxz&&p.y<c.maxy&&p.y>c.miny){n.v.x*=-.4;n.v.z*=-.4;p.addScaledVector(n.v,dt*2);break;}}
  if(n.fuse<=0){explode(p.clone(),false,n.enemy?'enemy':'player');scene.remove(n.m);nades.splice(i,1);
    if(!n.enemy&&!mission.bunkerDown&&Math.hypot(p.x-BK.x,p.z-BK.z)<4.5)for(const e of enemies)if(e.alive&&e.type==='mg')killEnemy(e,false,false,true);}}}

/* ================= MISSION ================= */
const mission={phase:'none',kills:0,need:0,cp:null,bunkerDown:false,timer:0,art:3};
function clearDynamic(){mixers.length=0;for(const e of enemies)scene.remove(e.g);enemies.length=0;for(const a of allies)scene.remove(a.g);allies.length=0;for(const n of nades)scene.remove(n.m);nades.length=0;rebuildHit();}
function resetPlayer(pos,yaw){pl.pos.copy(pos);pl.pos.y=H(pos.x,pos.z);pl.vel.set(0,0,0);pl.yaw=yaw;pl.pitch=0;pl.hp=100;pl.alive=true;pl.stance=0;pl.eye=1.65;pl.ads=0;pl.adsOn=false;pl.reload=0;pl.switchT=0;pl.plant=0;
  pl.ws=WEAP.map(w=>({mag:w.mag,res:w.res}));pl.nades=4;pl.cur=0;vms.forEach((v,i)=>v.visible=i===0);}
function setupMission(){clearDynamic();
  mission.phase='intro';mission.kills=0;mission.bunkerDown=false;mission.timer=0;mission.cp={pos:new V3(0,0,38.5),yaw:0,phase:'beach'};
  const T=[[-30,-47],[-21,-47.5],[-12,-47],[-3,-47.2],[12,-47.3],[21,-47],[30,-47.5],[38,-47],[-8,-35],[15,-33]];
  T.forEach(([x,z],i)=>spawnEnemy(x,z,'rifle',{trench:true}));mission.need=T.length;
  spawnEnemy(BK.x,BK.z+1.6,'mg',{counts:false});
  // boat dummies
  myBoat.userData.dummies=[];for(let i=0;i<6;i++){const s=makeSoldier('us');s.g.position.set(i%2?.8:-.8,.2,-2.6+Math.floor(i/2)*1.5);s.rig.position.y=-.45;myBoat.add(s.g);myBoat.userData.dummies.push(s.g);}
  myBoat.userData.ramp.rotation.x=0;
  stats.shots=stats.hits=stats.kills=stats.heads=stats.score=0;pl.deaths=0;
}
function startGameplay(){
  if(myBoat.userData.dummies){myBoat.userData.dummies.forEach(d=>myBoat.remove(d));myBoat.userData.dummies=null;}
  myBoat.position.z=44.5;myBoat.userData.ramp.rotation.x=-1.35;
  resetPlayer(new V3(0,0,38.6),0);
  const tg=[[-9,-11.8],[-4,-11.8],[4,-11.8],[9,-11.8],[14,-11.8],[-14,-11.8]];
  tg.forEach(([x,z],i)=>spawnAlly((i%2?1:-1)*rnd(1.6,2.8),40.5+i*.6,x,z,i*.35,i===2?24:i===4?8:0));
  for(let i=0;i<5;i++)spawnAlly(-20+rnd(-1,1),46+i,-24+i*3,-11.8,i*.5+1,i===1?16:0);
  for(let i=0;i<5;i++)spawnAlly(22+rnd(-1,1),45+i,20+i*3,-11.8,i*.5+1.5,i===3?20:0);
  mission.phase='beach';setObj('Get off the beach — reach the <b>seawall</b>');stats.start=time;
  say('LT. HAYES (radio)','Kane! Get your men across the sand — the seawall, now!',3.5);say('SGT. MILLER','Use the hedgehogs for cover! Move, move!',3);
  enterPlay();
}
function objTarget(){if(mission.phase==='beach')return new V3(0,H(0,-12.5)+1,-12.5);if(mission.phase==='trench'){const e=enemies.find(e=>e.alive&&e.counts);return e?e.pos.clone().add(new V3(0,2,0)):new V3(0,10,-46);}if(mission.phase==='bunker')return new V3(BK.x,H(BK.x,BK.z-4.2)+1.2,BK.z-4.2);if(mission.phase==='clear')return null;return null;}
function updMission(dt){
  // artillery
  mission.art-=dt;if(mission.art<=0&&mission.phase!=='end'){mission.art=mission.phase==='beach'||mission.phase==='intro'?rnd(1.8,4):rnd(5,9);let p;for(let k=0;k<8;k++){p=new V3(rnd(-55,55),0,rnd(-8,70));if(p.distanceTo(pl.pos)>11)break;}p.y=Math.max(H(p.x,p.z),0);explode(p,Math.random()<.4,null);}
  if(state!=='play')return;
  if(mission.phase==='beach'&&pl.pos.z<-11.5){mission.phase='trench';mission.cp={pos:pl.pos.clone(),yaw:pl.yaw,phase:'trench'};setObj(`Clear the trench line on the bluff <b>(${mission.kills}/${mission.need})</b>`);
    say('LT. HAYES (radio)','Good work! Now get up that draw and clear those trenches!',3.5);say('KANE','Ruiz, Miller — on me! We go up together!',3);xp('CHECKPOINT');
    allies.forEach((a,i)=>{if(a.alive&&i<6){a.target=new V3(rnd(-18,18),0,rnd(-30,-24));a.delay=rnd(2,6);a.crouch=0;}});}
  if(mission.phase==='trench'){$('obj').lastChild&&($('obj').innerHTML=`<div class="h">OBJECTIVE</div>Clear the trench line on the bluff <b>(${Math.min(mission.kills,mission.need)}/${mission.need})</b>`);
    if(mission.kills>=mission.need){mission.phase='bunker';mission.cp={pos:pl.pos.clone(),yaw:pl.yaw,phase:'bunker'};playCine(midCine(),()=>{setObj('Plant a charge on the <b>MG42 bunker</b>');enterPlay();});
      for(let i=0;i<5;i++)spawnEnemy(rnd(-14,26),-78-rnd(0,6),'rifle',{target:new V3(BK.x+rnd(-14,14),0,BK.z-rnd(4,12)),counts:false});}}
  if(mission.phase==='bunker'){const dp=new V3(BK.x,0,BK.z-4.2);const d=Math.hypot(pl.pos.x-dp.x,pl.pos.z-dp.z);const near=d<3.2;
    $('prompt').style.display=near?'block':'none';$('tAct').style.display=near&&isTouch?'flex':'none';$('ptxt').innerHTML=isTouch?'Hold <kbd>HOLD</kbd> to plant explosive charge':'Hold <kbd>E</kbd> to plant explosive charge';
    const holding=keys['KeyE']||tState.act;if(near&&holding){pl.plant+=dt;if(Math.floor(pl.plant*4)!==Math.floor((pl.plant-dt)*4))SND.beep();}else pl.plant=Math.max(0,pl.plant-dt*2);
    $('pbar').firstChild.style.width=(pl.plant/2.5*100)+'%';
    if(pl.plant>=2.5){mission.phase='clear';mission.timer=6;$('prompt').style.display='none';$('tAct').style.display='none';setObj('Charge set — <b>get clear!</b>');say('KANE','Charge is set! Fire in the hole!',2.5);}}
  if(mission.phase==='clear'){mission.timer-=dt;$('timer').style.display='block';$('timer').textContent=mission.timer.toFixed(1);if(Math.floor(mission.timer*2)!==Math.floor((mission.timer+dt)*2))SND.beep();
    if(mission.timer<=0){$('timer').style.display='none';mission.phase='end';mission.bunkerDown=true;const bp=new V3(BK.x,H(BK.x,BK.z)+1.5,BK.z);
      for(const e of enemies)if(e.alive&&e.pos.distanceTo(bp)<10)killEnemy(e,false,false,true);
      const dd=pl.pos.distanceTo(bp);explode(bp,true,null);if(dd<9)hurt(160*(1-dd/9),bp,true);
      if(pl.alive){stats.score+=500;xp('+500 BUNKER DESTROYED');addEmitter(bp.clone().add(new V3(0,2,0)),'bsmoke',.2);addEmitter(bp.clone().add(new V3(0,1,0)),'fire',.06);
        setTimeout(()=>{if(state==='play')playCine(endCineShots(),missionComplete);},1800);}}}
}
function missionComplete(){state='complete';document.body.classList.remove('play','cine');exitLock();
  const t=Math.round((stats.endT||time)-stats.start);const acc=stats.shots?Math.round(stats.hits/stats.shots*100):0;const sc=stats.score+acc*10;
  $('stats').innerHTML=`<span>Time</span><span>${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}</span><span>Enemies killed</span><span>${stats.kills}</span><span>Headshots</span><span>${stats.heads}</span><span>Accuracy</span><span>${acc}%</span><span>Deaths</span><span>${pl.deaths}</span><span>Difficulty</span><span>${S.difficulty.toUpperCase()}</span><span><b>SCORE</b></span><span><b>${sc}</b></span>`;show('complete');}
function restartCP(){hideAll();const cp=mission.cp;resetPlayer(cp.pos,cp.yaw);pl.alive=true;
  if(cp.phase==='bunker'){mission.phase='bunker';setObj('Plant a charge on the <b>MG42 bunker</b>');}else if(cp.phase==='trench'){mission.phase='trench';}else{mission.phase='beach';setObj('Get off the beach — reach the <b>seawall</b>');}
  for(const n of nades)scene.remove(n.m);nades.length=0;enterPlay();}

/* ================= CINEMATICS ================= */
let cine=null;
function playCine(shots,done){cine={shots,i:0,t:0,done,fired:{}};state='cine';exitLock();document.body.classList.add('cine');document.body.classList.remove('play');musicDuck=1;applyVolumes();VM.visible=false;subQ=[];subT=0;$('subs').innerHTML='';if(shots[0].start)shots[0].start();}
function endCine(skip){if(!cine)return;const d=cine.done;const sh=cine.shots;if(skip){for(let i=cine.i;i<sh.length;i++){if(i>cine.i&&sh[i].start)sh[i].start();if(sh[i].end)sh[i].end();}}cine=null;document.body.classList.remove('cine');$('title').style.opacity=0;subQ=[];subT=0;$('subs').innerHTML='';VM.visible=true;d&&d();}
function updCine(dt){const sh=cine.shots[cine.i];cine.t+=dt;const k=clamp(cine.t/sh.dur,0,1);
  if(sh.cam){const r=sh.cam(k,cine.t);camera.position.copy(r.p);camera.lookAt(r.l);}
  if(sh.subs)sh.subs.forEach((s,j)=>{const key=cine.i+'_'+j;if(!cine.fired[key]&&cine.t>=s[0]){cine.fired[key]=1;say(s[1],s[2],s[3]||3);}});
  if(sh.upd)sh.upd(dt,k,cine.t);
  if(cine.t>=sh.dur){if(sh.end)sh.end();cine.i++;cine.t=0;if(cine.i>=cine.shots.length){endCine(false);}else if(cine.shots[cine.i].start)cine.shots[cine.i].start();}}
const lp=(a,b,k)=>new V3().lerpVectors(a,b,k);
function boatZ(T){return 44.5+(1-ease(clamp(T/16,0,1)))*62;}
let introT=0;
function introCine(){introT=0;const bob=()=>{myBoat.position.z=boatZ(introT);myBoat.rotation.x=Math.sin(introT*1.3)*.04;myBoat.rotation.z=Math.sin(introT*.9)*.03;myBoat.position.y=Math.sin(introT*1.1)*.12;};
  return[
  {dur:5,start:()=>{camera.fov=50;camera.updateProjectionMatrix();titleCard();},cam:k=>({p:lp(new V3(48,14,125),new V3(30,9,108),ease(k)),l:new V3(0,4,-20)}),upd:dt=>{introT+=dt;bob();},end:()=>{$('title').style.opacity=0;}},
  {dur:6,cam:k=>{const b=myBoat.position;return{p:new V3(b.x+4-k*2,b.y+2.6,b.z+11-k*2),l:new V3(b.x,1.5,b.z-30)}},upd:dt=>{introT+=dt;bob();},
   subs:[[.4,'SGT. MILLER','Thirty seconds! Keep your heads down!',2.8],[3.2,'PVT. RUIZ','Holy Mary, mother of God...',2.6]]},
  {dur:5.5,cam:(k,t)=>{const b=myBoat.position;return{p:new V3(b.x+Math.sin(t*9)*.02,b.y+1.55+Math.sin(t*2)*.05,b.z+3),l:new V3(b.x,1.3,b.z-20)}},
   upd:(dt,k,t)=>{introT+=dt;bob();if(t>2.6){myBoat.userData.ramp.rotation.x=-1.35*ease(clamp((t-2.6)/.7,0,1));}if(t>2.9&&t<5&&Math.random()<.5){const p=new V3(rnd(-2,2),.1,myBoat.position.z-rnd(5,12));tracer(new V3(BK.x,12,BK.z+3),p,0xffb060);emit('splash',p,2);}},
   subs:[[.3,'KANE','Stay close to me. Don\'t stop for anything.',2.4],[2.6,'SGT. MILLER','Ramp\'s going down! GO, GO, GO!',2.5]]}
  ];}
function titleCard(){const L=['<div class="l">OPERATION OVERLORD</div>','<div class="l big">DAWN AT OMAHA</div>','<div class="l">Sgt. Elias Kane — 2nd Ranger Battalion</div>','<div class="l">June 6, 1944 — 06:31</div>','<div class="l">Omaha Beach, Normandy, France</div>'];
  const t=$('title');t.innerHTML=L.join('');t.style.opacity=1;const ls=[...t.children];const txt=ls.map(l=>l.textContent);ls.forEach(l=>l.textContent='');let li=0,ci=0;
  const tick=()=>{if(!cine||li>=ls.length)return;ls[li].textContent=txt[li].slice(0,++ci);if(ci%2)SND.click();if(ci>=txt[li].length){li++;ci=0;}setTimeout(tick,li===1&&ci===0?250:38);};setTimeout(tick,500);}
function midCine(){const s=eyePos(),bp=new V3(BK.x,H(BK.x,BK.z)+2,BK.z);
  return[{dur:4,start:()=>{camera.fov=55;camera.updateProjectionMatrix();},cam:k=>({p:lp(s,s.clone().add(new V3(-6,4,4)),ease(k)),l:lp(s.clone().add(camFwdFlat().multiplyScalar(10)),bp,ease(k))}),subs:[[.2,'LT. HAYES (radio)','Trenches are clear — but that MG42 is chewing up the second wave!',3.6]]},
    {dur:4.5,cam:k=>({p:lp(new V3(BK.x+14,H(BK.x,BK.z)+5,BK.z+16),new V3(BK.x+9,H(BK.x,BK.z)+3.5,BK.z+12),ease(k)),l:bp}),subs:[[.2,'LT. HAYES (radio)','Kane, get a charge on that bunker. Rear entrance. Now!',3],[3.2,'KANE','On it.',1.5]]}];}
function camFwdFlat(){return new V3(-Math.sin(pl.yaw),0,-Math.cos(pl.yaw));}
const endCineShots=()=>{const bp=new V3(BK.x,H(BK.x,BK.z)+1.5,BK.z);stats.endT=time;return[
  {dur:5,start:()=>{camera.fov=50;camera.updateProjectionMatrix();for(let i=0;i<4;i++)setTimeout(()=>explode(bp.clone().add(new V3(rnd(-3,3),rnd(0,2),rnd(-3,3))),i===0,null),i*500);},cam:k=>{const a=.6+k*.9;return{p:new V3(bp.x+Math.sin(a)*18,bp.y+5+k*2,bp.z+Math.cos(a)*18),l:bp}},
   subs:[[.8,'LT. HAYES (radio)','Bunker\'s down! All units, move up — move up!',3]]},
  {dur:7,start:()=>{allies.forEach(a=>{if(a.alive){a.target=new V3(rnd(-20,20),0,rnd(-50,-44));a.delay=rnd(0,1.5);a.crouch=0;}});for(let i=0;i<8;i++)spawnAlly(rnd(-25,25),rnd(-10,0),rnd(-25,25),rnd(-48,-40),rnd(0,1.5));},
   cam:k=>({p:lp(new V3(-8,3,-4),new V3(-4,4.5,-14),ease(k)),l:new V3(4,8,-40)}),
   subs:[[.5,'PVT. RUIZ','We made it, Sarge... we actually made it.',2.8],[3.5,'KANE','Not all of us. Keep moving — this war\'s just getting started.',3.4]]}];};

/* ================= INPUT ================= */
let locked=false,lockWanted=false;
function reqLock(){if(isTouch)return;try{const p=canvas.requestPointerLock();if(p&&p.catch)p.catch(()=>{});}catch(e){}}
function exitLock(){lockWanted=false;try{if(document.pointerLockElement)document.exitPointerLock();}catch(e){}}
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas;if(!locked&&state==='play'&&lockWanted)pauseGame();if(locked)lockWanted=true;});
canvas.addEventListener('mousedown',e=>{if(state!=='play')return;if(!locked&&!isTouch){reqLock();}if(e.button===0){mouseL=true;pl.trig=true;}if(e.button===2){if(S.adsToggle)pl.adsOn=!pl.adsOn;else mouseR=true;}});
addEventListener('mouseup',e=>{if(e.button===0)mouseL=false;if(e.button===2)mouseR=false;});
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('mousemove',e=>{if(state!=='play'||isTouch)return;if(!locked&&!(e.buttons))return;const s=.0022*S.sens*(pl.ads>.5?S.adsSens:1);pl.yaw-=e.movementX*s;pl.pitch-=e.movementY*s*(S.invertY?-1:1);});
addEventListener('wheel',e=>{if(state==='play')switchW((pl.cur+(e.deltaY>0?1:2))%3);});
addEventListener('keydown',e=>{keys[e.code]=true;
  if(state==='cine'&&(e.code==='Enter'||e.code==='Escape'||e.code==='Space')){endCine(true);return;}
  if(e.code==='Escape'||e.code==='KeyP'){if(state==='play')pauseGame();else if(state==='pause')resume();return;}
  if(state!=='play')return;
  if(e.code==='KeyR')startReload();if(e.code==='Digit1')switchW(0);if(e.code==='Digit2')switchW(1);if(e.code==='Digit3')switchW(2);
  if(e.code==='KeyG')throwNade(false);if(e.code==='KeyV')meleeAtk();
  if(e.code==='Space'&&pl.onG){if(pl.stance)pl.stance=0;else{pl.vel.y=5.2;pl.onG=false;}}
  if(e.code==='KeyC'||e.code==='ControlLeft'){pl.stance=pl.stance===1?0:1;}
  if(e.code==='KeyZ'){pl.stance=pl.stance===2?0:2;}
  if(e.code==='KeyQ'){switchW((pl.cur+1)%3);}
});
addEventListener('keyup',e=>{keys[e.code]=false;if(!S.crouchToggle&&(e.code==='KeyC'||e.code==='ControlLeft'))pl.stance=0;});
// touch
const tState={jid:null,jx:0,jy:0,ox:0,oy:0,lid:null,lx:0,ly:0,fid:null,fx:0,fy:0,fire:false,act:false,sprint:false};
const tl=$('tlayer');
tl.addEventListener('touchstart',e=>{e.preventDefault();for(const t of e.changedTouches){if(t.clientX<innerWidth*.42&&tState.jid===null){tState.jid=t.identifier;tState.ox=t.clientX;tState.oy=t.clientY;tState.jx=tState.jy=0;const b=$('joyB');b.style.display='block';b.style.left=t.clientX+'px';b.style.top=t.clientY+'px';}else if(tState.lid===null){tState.lid=t.identifier;tState.lx=t.clientX;tState.ly=t.clientY;}}},{passive:false});
function tmove(e){for(const t of e.changedTouches){if(t.identifier===tState.jid){let dx=t.clientX-tState.ox,dy=t.clientY-tState.oy;const L=Math.hypot(dx,dy),M=55;if(L>M){dx*=M/L;dy*=M/L;}tState.jx=dx/M;tState.jy=dy/M;$('joyK').style.transform=`translate(${dx}px,${dy}px)`;}
  const look=(px,py,id)=>{const s=.0055*S.touchSens*(pl.ads>.5?S.adsSens:1);pl.yaw-=(t.clientX-px)*s;pl.pitch-=(t.clientY-py)*s*(S.invertY?-1:1);};
  if(t.identifier===tState.lid){look(tState.lx,tState.ly);tState.lx=t.clientX;tState.ly=t.clientY;}
  if(t.identifier===tState.fid){look(tState.fx,tState.fy);tState.fx=t.clientX;tState.fy=t.clientY;}}}
function tend(e){for(const t of e.changedTouches){if(t.identifier===tState.jid){tState.jid=null;tState.jx=tState.jy=0;$('joyB').style.display='none';$('joyK').style.transform='';}if(t.identifier===tState.lid)tState.lid=null;if(t.identifier===tState.fid){tState.fid=null;tState.fire=false;$('tFire').classList.remove('act');}}}
addEventListener('touchmove',e=>{if(state==='play'){e.preventDefault();tmove(e);}},{passive:false});
addEventListener('touchend',tend);addEventListener('touchcancel',tend);
function tbtn(id,down,up){const el=$(id);el.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();el.classList.add('act');down&&down(e);},{passive:false});el.addEventListener('touchend',e=>{e.preventDefault();if(id!=='tAds'&&id!=='tSprint')el.classList.remove('act');up&&up(e);},{passive:false});}
tbtn('tFire',e=>{const t=e.changedTouches[0];tState.fid=t.identifier;tState.fx=t.clientX;tState.fy=t.clientY;tState.fire=true;pl.trig=true;});
tbtn('tAds',()=>{pl.adsOn=!pl.adsOn;$('tAds').classList.toggle('act',pl.adsOn);if(pl.adsOn&&S.aimAssist)aimAssist();});
tbtn('tJump',()=>{if(pl.onG){if(pl.stance)pl.stance=0;else{pl.vel.y=5.2;pl.onG=false;}}});
tbtn('tCrouch',()=>{pl.stance=pl.stance===1?0:1;});
tbtn('tReload',()=>startReload());tbtn('tNade',()=>throwNade(false));tbtn('tMelee',()=>meleeAtk());tbtn('tSwap',()=>switchW((pl.cur+1)%3));
tbtn('tAct',()=>{tState.act=true;},()=>{tState.act=false;});
tbtn('tPause',()=>pauseGame());
tbtn('tSprint',()=>{tState.sprint=!tState.sprint;$('tSprint').classList.toggle('act',tState.sprint);});
function aimAssist(){let best=null,ba=.16;const o=eyePos(),f=camFwd();for(const e of enemies){if(!e.alive)continue;const tp=e.pos.clone().add(new V3(0,1.3-(e.crouch||0)*.7,0));const d=tp.clone().sub(o);const L=d.length();if(L>70)continue;d.normalize();const a=Math.acos(clamp(d.dot(f),-1,1));if(a<ba&&!blocked(o,tp)){ba=a;best=d;}}
  if(best){pl.aaT={yaw:Math.atan2(-best.x,-best.z),pitch:Math.asin(best.y),t:.15};}}

/* ================= PLAYER UPDATE ================= */
function updPlayer(dt){
  if(!pl.alive)return;
  let f=(keys.KeyW?1:0)-(keys.KeyS?1:0)-tState.jy,r=(keys.KeyD?1:0)-(keys.KeyA?1:0)+tState.jx;
  const L=Math.hypot(f,r);if(L>1){f/=L;r/=L;}
  const sprintIn=keys.ShiftLeft||keys.ShiftRight||tState.sprint||tState.jy<-.92;
  if(sprintIn&&f>.5&&pl.stance!==2&&pl.reload<=0){if(pl.stance===1)pl.stance=0;pl.sprint=true;}else pl.sprint=false;
  const adsWant=(S.adsToggle||isTouch)?pl.adsOn:mouseR;
  if(adsWant&&pl.sprint)pl.sprint=false;
  const firing=(mouseL||tState.fire);
  if(firing&&pl.sprint)pl.sprint=false;
  pl.ads=lerp(pl.ads,(adsWant&&!pl.sprint&&pl.switchT<=0&&pl.reload<=0)?1:0,Math.min(1,dt*12));
  if(pl.aaT){pl.aaT.t-=dt;const k=Math.min(1,dt*14);pl.yaw+=((pl.aaT.yaw-pl.yaw+Math.PI*3)%(Math.PI*2)-Math.PI)*k;pl.pitch=lerp(pl.pitch,pl.aaT.pitch,k);if(pl.aaT.t<=0)pl.aaT=null;}
  let sp=pl.sprint?7:pl.stance===1?2.4:pl.stance===2?1.1:4.4;sp*=lerp(1,.55,pl.ads);if(pl.pos.z>39)sp*=.65;
  const sy=Math.sin(pl.yaw),cy=Math.cos(pl.yaw);const wx=-sy*f+cy*r,wz=-cy*f-sy*r;
  const ac=pl.onG?1-Math.exp(-12*dt):1-Math.exp(-2*dt);pl.vel.x=lerp(pl.vel.x,wx*sp,ac);pl.vel.z=lerp(pl.vel.z,wz*sp,ac);
  pl.vel.y-=18*dt;pl.pos.addScaledVector(pl.vel,dt);
  // collisions
  const R=.38,hgt=pl.eye+.15;let ground=H(pl.pos.x,pl.pos.z);
  for(const c of colliders){if(pl.pos.x+R>c.minx&&pl.pos.x-R<c.maxx&&pl.pos.z+R>c.minz&&pl.pos.z-R<c.maxz){
    if(pl.pos.y>=c.maxy-.45){if(pl.pos.x>c.minx&&pl.pos.x<c.maxx&&pl.pos.z>c.minz&&pl.pos.z<c.maxz)ground=Math.max(ground,c.maxy);continue;}
    if(pl.pos.y+hgt<c.miny)continue;
    const o1=pl.pos.x+R-c.minx,o2=c.maxx-(pl.pos.x-R),o3=pl.pos.z+R-c.minz,o4=c.maxz-(pl.pos.z-R);const m=Math.min(o1,o2,o3,o4);
    if(m===o1)pl.pos.x-=o1;else if(m===o2)pl.pos.x+=o2;else if(m===o3)pl.pos.z-=o3;else pl.pos.z+=o4;}}
  for(const e of enemies){if(!e.alive)continue;const dx=pl.pos.x-e.pos.x,dz=pl.pos.z-e.pos.z,d=Math.hypot(dx,dz);if(d<.7&&d>0){pl.pos.x+=dx/d*(.7-d);pl.pos.z+=dz/d*(.7-d);}}
  if(pl.pos.y<=ground){pl.pos.y=ground;pl.vel.y=0;pl.onG=true;}else if(pl.pos.y-ground>.3)pl.onG=false;else if(pl.vel.y<=0){pl.pos.y=ground;pl.vel.y=0;pl.onG=true;}
  pl.pos.x=clamp(pl.pos.x,-75,75);pl.pos.z=clamp(pl.pos.z,-82,42);
  const hs=Math.hypot(pl.vel.x,pl.vel.z);if(pl.pos.z>39.5&&hs>1&&Math.random()<dt*8)emit('splash',pl.pos.clone().add(new V3(0,.1,0)),1);
  pl.eye=lerp(pl.eye,[1.65,1.05,.45][pl.stance],Math.min(1,dt*10));
  pl.pitch=clamp(pl.pitch,-1.45,1.45);
  // weapons
  pl.fireCool-=dt;pl.kick=Math.max(0,pl.kick-dt*9);if(pl.melee>0)pl.melee-=dt;
  if(pl.reload>0){pl.reload-=dt;if(pl.reload<=0)finishReload();}
  if(pl.switchT>0){const prev=pl.switchT;pl.switchT-=dt;if(prev>.22&&pl.switchT<=.22){pl.cur=pl.next;vms.forEach((v,i)=>v.visible=i===pl.cur);}}
  const w=WEAP[pl.cur];if(firing&&(w.auto||pl.trig)){fire();}pl.trig=false;
  if(time-pl.lastHurt>4&&pl.hp<100)pl.hp=Math.min(100,pl.hp+28*dt);
  muzzleLight.intensity*=Math.exp(-dt*35);
  // camera
  if(pl.onG&&hs>.5)pl.bob+=dt*hs*1.7;
  const bobA=(pl.sprint?.07:.04)*(1-pl.ads*.85)*Math.min(1,hs/4);
  shake=Math.max(0,shake-dt*1.4);const sk=shake*shake*.25;
  camera.position.set(pl.pos.x+rnd(-sk,sk),pl.pos.y+pl.eye+Math.sin(pl.bob*2)*bobA+rnd(-sk,sk),pl.pos.z);
  camera.rotation.set(pl.pitch+pl.kick*.012+rnd(-sk,sk)*.1,pl.yaw,Math.sin(pl.bob)*bobA*.15);
  const fov=S.fov/lerp(1,w.zoom,pl.ads);if(Math.abs(camera.fov-fov)>.01){camera.fov=fov;camera.updateProjectionMatrix();}
  // viewmodel
  const hp=w.hip,ap=w.aim,a=pl.ads;let vx=lerp(hp[0],ap[0],a),vy=lerp(hp[1],ap[1],a),vz=lerp(hp[2],ap[2],a);
  vx+=Math.cos(pl.bob)*bobA*.3;vy+=Math.abs(Math.sin(pl.bob))*bobA*.25;vz+=pl.kick*.06;
  let rx=0,ry=0,rz=0;if(pl.sprint){rx=-.5;ry=.7;vx+=.05;vy-=.05;}
  if(pl.reload>0){const k=Math.sin(clamp(1-pl.reload/w.rl,0,1)*Math.PI);rx-=k*.6;rz+=k*.4;vy-=k*.08;}
  if(pl.switchT>0){const k=Math.sin((1-pl.switchT/.45)*Math.PI);vy-=k*.35;rx-=k*.6;}
  if(pl.melee>0){const k=Math.sin((1-pl.melee/.45)*Math.PI);vx-=k*.15;vz-=k*.25;ry+=k*.8;}
  VM.position.lerp(new V3(vx,vy,vz),Math.min(1,dt*18));VM.rotation.set(lerp(VM.rotation.x,rx+pl.kick*.08,dt*14),lerp(VM.rotation.y,ry,dt*12),lerp(VM.rotation.z,rz,dt*12));
}

/* ================= HUD UPDATE ================= */
const cctx=$('compass').getContext('2d'),mctx=$('mini').getContext('2d');
function updHUD(dt){
  const w=WEAP[pl.cur],ws=pl.ws[pl.cur];
  $('wname').textContent=w.name;$('mag').innerHTML=`${ws.mag}<small> / ${ws.res}</small>`;$('nades').textContent='● '.repeat(pl.nades).trim()||'—';
  $('ammo').classList.toggle('low',ws.mag<=Math.ceil(w.mag*.25));
  $('reloadTxt').style.display=pl.reload>0?'block':(ws.mag===0&&ws.res===0?'block':'none');if(ws.mag===0&&ws.res===0&&pl.reload<=0)$('reloadTxt').textContent='NO AMMO — SWAP WEAPON';else $('reloadTxt').textContent='RELOADING';
  const moving=Math.hypot(pl.vel.x,pl.vel.z);const spr=(8+moving*2.2+pl.kick*14)*(pl.stance?0.75:1);const xh=$('xh');xh.style.opacity=(S.crosshair&&pl.ads<.4&&!pl.sprint)?1:0;
  xh.children[0].style.top=(-spr-9)+'px';xh.children[1].style.top=spr+'px';xh.children[2].style.left=(-spr-9)+'px';xh.children[3].style.left=spr+'px';
  if(hitmT>0){hitmT-=dt;$('hitm').style.opacity=clamp(hitmT*5,0,1);}
  $('blood').style.opacity=Math.pow(1-pl.hp/100,1.4)*1.1;
  // marker
  const ot=objTarget();const mk=$('marker');if(ot){const p=ot.clone().project(camera);let x=(p.x*.5+.5)*innerWidth,y=(-p.y*.5+.5)*innerHeight;if(p.z>1){x=innerWidth-x;y=innerHeight-40;}x=clamp(x,30,innerWidth-30);y=clamp(y,60,innerHeight-60);mk.style.display='block';mk.style.left=x+'px';mk.style.top=y+'px';mk.lastChild.textContent=Math.round(ot.distanceTo(pl.pos))+'m';}else mk.style.display='none';
  // compass
  const W=380,cw=cctx;cw.clearRect(0,0,W,34);const bear=((-pl.yaw*180/Math.PI)%360+360)%360;cw.fillStyle='rgba(0,0,0,.35)';cw.fillRect(0,6,W,22);cw.textAlign='center';cw.font='600 13px Oswald';
  for(let d=-100;d<=100;d+=5){const ab=Math.round((bear+d)/5)*5;const off=(ab-bear)*W/200;const x=W/2+off;if(x<0||x>W)continue;const n=((ab%360)+360)%360;const lab={0:'N',45:'NE',90:'E',135:'SE',180:'S',225:'SW',270:'W',315:'NW'}[n];cw.fillStyle=lab?'#fff':'rgba(255,255,255,.5)';if(lab)cw.fillText(lab,x,22);else if(n%15===0)cw.fillRect(x-.5,14,1,8);else cw.fillRect(x-.5,18,1,4);}
  if(ot){const ob=((Math.atan2(ot.x-pl.pos.x,-(ot.z-pl.pos.z))*180/Math.PI)+360)%360;let dd=((ob-bear+540)%360)-180;dd=clamp(dd,-98,98);cw.fillStyle='#f2cc5a';const x=W/2+dd*W/200;cw.beginPath();cw.moveTo(x,28);cw.lineTo(x-5,34);cw.lineTo(x+5,34);cw.fill();}
  cw.fillStyle='#c0503a';cw.fillRect(W/2-1,4,2,6);
  // minimap
  const m=mctx,R=75,sc=1.4;m.clearRect(0,0,150,150);m.save();m.beginPath();m.arc(R,R,R-1,0,7);m.clip();m.fillStyle='rgba(38,40,30,.6)';m.fillRect(0,0,150,150);m.translate(R,R);m.rotate(pl.yaw);
  const P=(x,z)=>[(x-pl.pos.x)*sc,(z-pl.pos.z)*sc];
  m.fillStyle='rgba(60,90,110,.6)';let [ax,az]=P(-200,40.5);m.fillRect(ax,az,400*sc,200*sc);m.fillStyle='rgba(150,150,140,.7)';for(const c of colliders){const[a1,b1]=P(c.minx,c.minz);m.fillRect(a1,b1,Math.max(1.5,(c.maxx-c.minx)*sc),Math.max(1.5,(c.maxz-c.minz)*sc));}
  m.strokeStyle='rgba(200,190,150,.25)';m.beginPath();[ax,az]=P(-200,-42);m.moveTo(ax,az);m.lineTo(ax+400*sc,az);m.stroke();
  for(const a of allies){if(!a.alive)continue;const[x,z]=P(a.pos.x,a.pos.z);m.fillStyle='#7fd36a';m.beginPath();m.arc(x,z,2.5,0,7);m.fill();}
  for(const e of enemies){if(!e.alive||time-e.lastFire>1.6)continue;const[x,z]=P(e.pos.x,e.pos.z);m.fillStyle='#ff4a3a';m.beginPath();m.arc(x,z,3.2,0,7);m.fill();}
  if(ot){const[x,z]=P(ot.x,ot.z);const L=Math.hypot(x,z),k=L>R-8?(R-8)/L:1;m.fillStyle='#f2cc5a';m.save();m.translate(x*k,z*k);m.rotate(Math.PI/4);m.fillRect(-4,-4,8,8);m.restore();}
  m.restore();m.fillStyle='#fff';m.beginPath();m.moveTo(R,R-7);m.lineTo(R-5,R+5);m.lineTo(R,R+2);m.lineTo(R+5,R+5);m.fill();
  // nade indicator
  let nn=null;for(const n of nades){if(!n.enemy)continue;const d=n.m.position.distanceTo(pl.pos);if(d<9){nn=n;break;}}
  const ni=$('nadeInd');if(nn){ni.style.display='block';const ang=Math.atan2(nn.m.position.x-pl.pos.x,-(nn.m.position.z-pl.pos.z))*180/Math.PI;ni.firstChild.style.transform=`rotate(${ang-bear}deg)`;}else ni.style.display='none';
}

/* ================= MENUS ================= */
const screens=['menu','missions','briefing','settings','controls','pause','dead','complete','loading'];
let settingsFrom='menu';
function show(id){screens.forEach(s=>$(s).classList.toggle('on',s===id));}
function hideAll(){screens.forEach(s=>$(s).classList.remove('on'));}
const MIS=[['1','DAWN AT OMAHA','Normandy · June 1944 — Storm the beach and silence the guns.',1],['2','HEDGEROW HELL','Normandy · June 1944 — First contact with Nightjar.',0],['3','GHOSTS OF PARIS','Paris · August 1944 — Night sabotage with the Resistance.',0],['4','BRIDGE AT NIJMEGEN','Netherlands · Sept 1944 — Hold the bridge against armor.',0],['5','FROZEN FOREST','Ardennes · Dec 1944 — Cut off, outnumbered, freezing.',0],['6','GÖTTERDÄMMERUNG','Germany · 1945 — End the operation. End Kessler.',0]];
$('mislist').innerHTML=MIS.map(m=>`<div class="mis ${m[3]?'':'lock'}" data-m="${m[0]}"><div class="n">${m[0]}</div><div class="d"><b>${m[1]}</b><small>${m[2]}</small></div><div>${m[3]?'▸':'🔒'}</div></div>`).join('');
$('mislist').addEventListener('click',e=>{const d=e.target.closest('.mis');if(!d||d.classList.contains('lock'))return;SND.ui();briefing();});
const BRIEF=['Allied forces are landing across five beaches along the Normandy coast. Your company of the 2nd Rangers has been assigned Sector Dog Green, Omaha.','The naval bombardment has failed to destroy the German positions on the bluffs. An MG42 bunker is covering the draw — the only way off the beach.','Your orders: get off the sand, clear the trench line, and silence that gun. If it keeps firing, the second wave dies in the surf.'];
let briefTok=0;
function briefing(){show('briefing');const tok=++briefTok;const el=$('btext');el.innerHTML=BRIEF.map(()=>'<p></p>').join('');$('bobj').style.display='none';let pi=0,ci=0;const ps=[...el.children];
  const tick=()=>{if(tok!==briefTok)return;if(pi>=ps.length){$('bobj').style.display='block';return;}ps[pi].textContent=BRIEF[pi].slice(0,ci+=2);if(ci%6===0)SND.click();if(ci>=BRIEF[pi].length){pi++;ci=0;setTimeout(tick,300);}else setTimeout(tick,14);};tick();}
function deploy(){briefTok++;show('loading');$('lbar').style.width='0';setTimeout(()=>$('lbar').style.width='60%',50);setTimeout(()=>{$('lbar').style.width='100%';},500);
  setTimeout(()=>{hideAll();setupMission();playCine(introCine(),startGameplay);},1000);}
function enterPlay(){hideAll();state='play';document.body.classList.add('play');document.body.classList.remove('cine');musicDuck=.3;applyVolumes();VM.visible=true;camera.fov=S.fov;camera.updateProjectionMatrix();if(!isTouch)reqLock();}
function pauseGame(){if(state!=='play')return;state='pause';exitLock();document.body.classList.remove('play');show('pause');mouseL=mouseR=false;tState.fire=false;}
function resume(){hideAll();state='play';document.body.classList.add('play');if(!isTouch)reqLock();}
function toMenu(){exitLock();state='menu';cine=null;document.body.classList.remove('play','cine');clearDynamic();musicDuck=1;applyVolumes();$('timer').style.display='none';$('prompt').style.display='none';$('subs').innerHTML='';subQ=[];show('menu');VM.visible=false;camera.fov=55;camera.updateProjectionMatrix();
  myBoat.position.set(0,0,62);myBoat.rotation.set(0,0,0);myBoat.userData.ramp.rotation.x=0;if(myBoat.userData.dummies){myBoat.userData.dummies.forEach(d=>myBoat.remove(d));myBoat.userData.dummies=null;}}
document.addEventListener('click',e=>{audioInit();const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a;SND.ui();
  if(a==='campaign')show('missions');else if(a==='settings'){settingsFrom='menu';openSettings();}else if(a==='controls')show('controls');
  else if(a==='back'||a==='cback')show('menu');else if(a==='back2'){briefTok++;show('missions');}else if(a==='deploy')deploy();
  else if(a==='sback'){saveS();show(settingsFrom);}else if(a==='sreset'){S=Object.assign({},DEF);applySettings();renderSettings();saveS();}
  else if(a==='resume')resume();else if(a==='psettings'){settingsFrom='pause';openSettings();}else if(a==='restartcp')restartCP();else if(a==='quit')toMenu();
  else if(a==='replay'){hideAll();deploy();}});
$('skip').addEventListener('click',e=>{e.stopPropagation();endCine(true);});
$('skip').addEventListener('touchend',e=>{e.preventDefault();e.stopPropagation();endCine(true);});
// settings UI
const SUI={GRAPHICS:[['quality','Quality Preset','sel',['low','medium','high','ultra']],['fov','Field of View','rng',60,110,1],['brightness','Brightness','rng',.6,1.6,.05],['grade','Cinematic Color Grade','tg'],['grain','Film Grain','tg'],['vignette','Vignette','tg'],['shake','Camera Shake','tg'],['fps','FPS Counter','tg']],
  CONTROLS:[['sens','Mouse Sensitivity','rng',.2,3,.05],['adsSens','ADS Sensitivity Multiplier','rng',.2,1.5,.05],['touchSens','Touch Look Sensitivity','rng',.3,3,.05],['invertY','Invert Look (Y-Axis)','tg'],['adsToggle','Toggle ADS (off = hold)','tg'],['crouchToggle','Toggle Crouch','tg'],['aimAssist','Aim Assist (touch)','tg']],
  AUDIO:[['master','Master Volume','rng',0,1,.05],['music','Music Volume','rng',0,1,.05],['sfx','Effects Volume','rng',0,1,.05],['subs','Subtitles','tg']],
  GAMEPLAY:[['difficulty','Difficulty','sel',['recruit','regular','hardened','veteran']],['crosshair','Crosshair','tg'],['hitmarkers','Hit Markers','tg'],['xpPopups','Score Popups','tg']]};
let sTab='GRAPHICS';
function openSettings(){show('settings');renderSettings();}
function renderSettings(){$('stabs').innerHTML=Object.keys(SUI).map(t=>`<button class="${t===sTab?'on':''}" data-t="${t}">${t}</button>`).join('');
  $('srows').innerHTML=SUI[sTab].map(([k,l,t,a,b,st])=>{if(t==='tg')return`<div class="row"><label>${l}</label><button class="tg ${S[k]?'on':''}" data-k="${k}"></button></div>`;
    if(t==='sel')return`<div class="row"><label>${l}</label><select data-k="${k}">${a.map(o=>`<option ${S[k]===o?'selected':''}>${o}</option>`).join('')}</select></div>`;
    return`<div class="row"><label>${l}</label><span style="display:flex;align-items:center;gap:8px"><input type="range" min="${a}" max="${b}" step="${st}" value="${S[k]}" data-k="${k}"><span class="val">${(+S[k]).toFixed(st<1?2:0)}</span></span></div>`;}).join('')+(sTab==='GRAPHICS'&&S.difficulty&&S.difficulty?'':'');}
$('stabs').addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(b){sTab=b.dataset.t;renderSettings();}});
$('srows').addEventListener('click',e=>{const b=e.target.closest('.tg');if(b){S[b.dataset.k]=!S[b.dataset.k];b.classList.toggle('on');applySettings();}});
$('srows').addEventListener('input',e=>{const el=e.target;if(!el.dataset.k)return;S[el.dataset.k]=el.type==='range'?+el.value:el.value;if(el.type==='range')el.nextElementSibling.textContent=(+el.value).toFixed(+el.step<1?2:0);applySettings();});
let curShadow=-1;
let curQ=null;function applySettings(){const q=QUAL[S.quality];renderer.setPixelRatio(q.pr);
  if(curQ!==S.quality){curQ=S.quality;if(q.ocean)buildWater2();if(water2)water2.visible=!!q.ocean;water.visible=!q.ocean;buildGrass(q.grass);buildComposer(q.post,q.bloom);}
  resize();scene.fog.density=q.fog;partLimit=q.parts;renderer.toneMappingExposure=S.brightness;
  if(curShadow!==q.sh){curShadow=q.sh;renderer.shadowMap.enabled=q.sh>0;sun.castShadow=q.sh>0;if(q.sh){sun.shadow.mapSize.set(q.sh,q.sh);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}}scene.traverse(o=>{if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.needsUpdate=true);}});}
  canvas.classList.toggle('grade',S.grade);$('grain').style.display=S.grain?'block':'none';$('vig').style.display=S.vignette?'block':'none';$('fps').style.display=S.fps?'block':'none';
  if(state==='play'){camera.fov=S.fov;camera.updateProjectionMatrix();}applyVolumes();}

/* ================= LOOP ================= */
const gctx=$('grain').getContext('2d');const gimg=gctx.createImageData(320,180);let gT=0;
function updGrain(dt){if(!S.grain)return;gT-=dt;if(gT>0)return;gT=.05;const d=gimg.data;for(let i=0;i<d.length;i+=4){const v=Math.random()*255;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255;}gctx.putImageData(gimg,0,0);}
let wT=0;function updWater(dt){wT+=dt;if(!water.visible){foam.material.opacity=.25+Math.sin(wT*1.7)*.12;foam.position.z=40.6+Math.sin(wT*.8)*.5;return;}const p=water.geometry.attributes.position,b=water.userData.base;for(let i=0;i<p.count;i++){const x=b[i*3],z=b[i*3+2];p.array[i*3+1]=b[i*3+1]+Math.sin(x*.12+wT*1.3)*.18+Math.sin(z*.2-wT*1.7)*.22;}p.needsUpdate=true;if((wT*20|0)%3===0)water.geometry.computeVertexNormals();foam.material.opacity=.25+Math.sin(wT*1.7)*.12;foam.position.z=40.6+Math.sin(wT*.8)*.5;}
let last=performance.now(),fpsA=0,fpsN=0,menuT=0;
function loop(now){requestAnimationFrame(loop);let dt=Math.min(.05,(now-last)/1000);last=now;
  if(state!=='pause')time+=dt;
  fpsA+=dt;fpsN++;if(fpsA>.5){if(S.fps)$('fps').textContent=Math.round(fpsN/fpsA)+' FPS';fpsA=fpsN=0;}
  if(state!=='pause'&&state!=='dead'){for(const mx of mixers)mx.update(dt);updWater(dt);updParts(dt);updTracers(dt);updEmitters(dt);updSubs(dt);updAllies(dt);updEnemies(dt);updNades(dt);updMission(dt);}
  if(state==='play'){updPlayer(dt);updHUD(dt);}
  else if(state==='cine'&&cine){updCine(dt);}
  else if(state==='menu'||state==='complete'){menuT+=dt*.04;camera.position.set(Math.sin(menuT)*30+10,5+Math.sin(menuT*.7)*1.5,52+Math.cos(menuT)*8);camera.lookAt(0,6,-30);}
  flashLight.intensity*=Math.exp(-dt*9);
  const fp=state==='play'?pl.pos:camera.position;sun.target.position.set(fp.x,0,fp.z-10);sun.position.set(fp.x+SUN_DIR.x*150,SUN_DIR.y*150,fp.z+SUN_DIR.z*150);
  CLOUDS.position.set(camera.position.x,0,camera.position.z);CLOUDS.rotation.y+=dt*.002;
  updGrain(dt);if(water2)water2.material.uniforms.time.value+=dt*.6;
  if(composer){composer.render();}else{renderer.clear();renderer.render(scene,camera);}if(VM.visible&&state==='play'){renderer.clearDepth();vmCam.fov=lerp(52,40,pl.ads);vmCam.updateProjectionMatrix();renderer.render(vmScene,vmCam);}}
applySettings();resize();camera.fov=55;camera.updateProjectionMatrix();VM.visible=false;show('loading');requestAnimationFrame(loop);
loadCharacters(p=>{$('lbar').style.width=(p*100)+'%';}).then(()=>setTimeout(()=>show('menu'),300));
window.__game={VM,vms,camera,scene,pl,mission,enemies,allies,stats,get state(){return state},setState:s=>state=s,startGameplay,setupMission,playCine,introCine,deploy,killEnemy};
