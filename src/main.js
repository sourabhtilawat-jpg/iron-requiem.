import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
const MEXT=import.meta.env.VITE_MEXT||'.glb';
const mkLoader=()=>{const l=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);if(MEXT!=='.glb'){const o=l.loadAsync.bind(l);l.loadAsync=(u,...r)=>o(String(u).replace(/\.glb$/,MEXT),...r);}return l;};
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {Sky} from 'three/addons/objects/Sky.js';
import {Water} from 'three/addons/objects/Water.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {Lensflare,LensflareElement} from 'three/addons/objects/Lensflare.js';
import '@fontsource/oswald/300.css';import '@fontsource/oswald/400.css';import '@fontsource/oswald/600.css';import '@fontsource/oswald/700.css';import '@fontsource/special-elite/400.css';
const BASE=import.meta.env.BASE_URL;
import * as AS from './assets.js';
import {makeDetailTexture,makeGroundMaterial} from './ground.js';
import {Haptics} from '@capacitor/haptics';
import {WEAPONS,ATT,ATT_SLOTS,CLASS_NAMES,attAllowed,defaultAtt,effStats,statBars,buildGunVM} from './weapons.js';
const $=id=>document.getElementById(id);
const V3=THREE.Vector3;
const isTouch=('ontouchstart' in window)||navigator.maxTouchPoints>0;
if(isTouch) document.body.classList.add('touch');
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, rnd=(a,b)=>a+Math.random()*(b-a);
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;

/* ================= SETTINGS ================= */
const DEF={quality:isTouch?'low':'high',fov:78,brightness:1,grade:true,grain:true,vignette:true,shake:true,fps:false,
 sens:1,adsSens:.65,touchSens:1,invertY:false,adsToggle:false,crouchToggle:true,aimAssist:true,
 master:.8,music:.5,sfx:.9,subs:true,difficulty:'regular',camMode:'first-person',slowmo:true,crosshair:true,hitmarkers:true,xpPopups:true,surround:'headphones',sky:isTouch?'painted':'physical',shadows:true,res:'auto',bass:true,vibrate:true,vibStrength:1};
let S=Object.assign({},DEF);
try{const s=JSON.parse(localStorage.getItem('ir_settings')||'null');if(s)Object.assign(S,s);}catch(e){}
function saveS(){try{localStorage.setItem('ir_settings',JSON.stringify(S))}catch(e){}}
const DIFF={recruit:{acc:.5,dmg:.55,hp:.8},regular:{acc:1,dmg:1,hp:1},hardened:{acc:1.4,dmg:1.4,hp:1.15},veteran:{acc:2,dmg:2.2,hp:1.3}};
const QUAL={low:{pr:.6,sh:0,parts:120,fog:.0105,ocean:0,post:0,bloom:0,grass:1800},medium:{pr:.85,sh:2048,parts:260,fog:.009,ocean:1,post:0,bloom:0,grass:6000},high:{pr:1,sh:2048,parts:450,fog:.008,ocean:1,post:1,bloom:1,grass:12000},ultra:{pr:Math.min(devicePixelRatio||1,2),sh:4096,parts:700,fog:.0072,ocean:1,post:1,bloom:1,grass:25000}};

/* ================= AUDIO ================= */
const A={ctx:null};let musicDuck=1;
function audioInit(){
  if(A.ctx){if(A.ctx.state==='suspended')A.ctx.resume();return;}
  try{A.ctx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){return;}
  const c=A.ctx;
  A.master=c.createGain();
  // cinematic mastering chain: muffle (shell-shock) -> sub/air EQ -> glue compressor -> brickwall limiter
  A.muffle=c.createBiquadFilter();A.muffle.type='lowpass';A.muffle.frequency.value=20000;A.muffle.Q.value=.5;
  A.sub=c.createBiquadFilter();A.sub.type='lowshelf';A.sub.frequency.value=95;A.air=c.createBiquadFilter();A.air.type='highshelf';A.air.frequency.value=7000;A.air.gain.value=2.5;
  A.comp=c.createDynamicsCompressor();A.comp.threshold.value=-20;A.comp.knee.value=14;A.comp.ratio.value=3.2;A.comp.attack.value=.004;A.comp.release.value=.28;
  A.lim=c.createDynamicsCompressor();A.lim.threshold.value=-2;A.lim.knee.value=0;A.lim.ratio.value=20;A.lim.attack.value=.001;A.lim.release.value=.08;
  A.master.connect(A.muffle);A.muffle.connect(A.sub);A.sub.connect(A.air);A.air.connect(A.comp);A.comp.connect(A.lim);A.lim.connect(c.destination);
  // room/space reverb send (impulse rebuilt per environment)
  A.rev=c.createConvolver();A.revIn=c.createGain();A.revIn.gain.value=.22;A.revOut=c.createGain();A.revOut.gain.value=.9;A.revIn.connect(A.rev);A.rev.connect(A.revOut);A.revOut.connect(A.master);setReverb(!!(typeof ENV_CUR!=='undefined'&&ENV[ENV_CUR]&&ENV[ENV_CUR].inside));
  A.sfx=c.createGain();A.sfx.connect(A.master);A.sfx.connect(A.revIn);
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
function applyVolumes(){if(!A.ctx)return;A.master.gain.value=S.master;if(A.sub)A.sub.gain.value=S.bass?6:0;A.sfx.gain.value=S.sfx;A.mus.gain.setTargetAtTime(S.music*musicDuck*.8,A.ctx.currentTime,.5);A.amb.gain.value=S.sfx*.5;}
function sfxN(o){
  if(!A.ctx)return;const c=A.ctx;const dist=o.dist||0;const t=c.currentTime+(o.delay||0)+dist/1200;
  const att=1/(1+dist*.035);const v=(o.vol||1)*att;if(v<.01)return;const d=o.d||.3;
  const s=c.createBufferSource();s.buffer=A.noise;const f=c.createBiquadFilter();f.type=o.type||'lowpass';f.Q.value=o.q||.7;
  const f0=Math.max(150,(o.f0||3000)/(1+dist*.015));f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(Math.max(40,o.f1||300),t+d);
  const g=c.createGain();g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0008,t+d);
  const out=spatial(o,dist,t,d);s.connect(f);f.connect(g);g.connect(out);s.start(t,Math.random()*1.5);s.stop(t+d+.05);
  if(o.thump){const os=c.createOscillator();os.frequency.setValueAtTime(o.tf||110,t);os.frequency.exponentialRampToValueAtTime(30,t+d*.8);const og=c.createGain();og.gain.setValueAtTime(o.thump*att,t);og.gain.exponentialRampToValueAtTime(.0008,t+d);os.connect(og);og.connect(A.sfx);os.start(t);os.stop(t+d+.05);}
}

// ---- 3D surround: HRTF/equal-power panning per sound, distance-wet reverb, LFE thumps stay centred ----
A.at=null;
function spatial(o,dist,t,d){const c=A.ctx;if(S.surround==='off')return A.sfx;let p=o.pos||A.at;
  if(!p){if(dist<6)return A.sfx;const a=Math.random()*Math.PI*2;p=new V3(camera.position.x+Math.cos(a)*dist,camera.position.y+rnd(0,6),camera.position.z+Math.sin(a)*dist);}
  const pn=c.createPanner();pn.panningModel=S.surround==='headphones'?'HRTF':'equalpower';pn.distanceModel='inverse';pn.refDistance=1;pn.rolloffFactor=0;
  if(pn.positionX){pn.positionX.setValueAtTime(p.x,t);pn.positionY.setValueAtTime(p.y,t);pn.positionZ.setValueAtTime(p.z,t);}else pn.setPosition(p.x,p.y,p.z);
  pn.connect(A.sfx);if(dist>25){const w=c.createGain();w.gain.value=clamp((dist-25)/150,0,.6);pn.connect(w);w.connect(A.revIn);}
  setTimeout(()=>{try{pn.disconnect();}catch(e){}},(t-c.currentTime+d+.4)*1000);return pn;}
function at(p,fn){A.at=p;try{fn();}finally{A.at=null;}}
function setReverb(inside){const c=A.ctx;if(!c||!A.rev)return;const len=c.sampleRate*(inside?1.6:2.6)|0,ir=c.createBuffer(2,len,c.sampleRate);
  for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<len;i++){const tt=i/c.sampleRate;let v=(Math.random()*2-1)*Math.pow(1-i/len,inside?2.2:3.4);
      if(!inside&&tt>.09&&tt<.35&&Math.random()<.004)v*=6;if(inside&&tt<.08&&Math.random()<.01)v*=4;d[i]=v*(tt<.012?tt/.012:1);}}
  A.rev.buffer=ir;A.revIn.gain.value=inside?.34:.2;A.revOut.gain.value=inside?1:.85;}
const _lf=new V3(),_lu=new V3();
function updListener(){if(!A.ctx||S.surround==='off')return;const L=A.ctx.listener,c=camera,t=A.ctx.currentTime;c.getWorldDirection(_lf);_lu.set(0,1,0).applyQuaternion(c.quaternion);
  if(L.positionX){L.positionX.setTargetAtTime(c.position.x,t,.02);L.positionY.setTargetAtTime(c.position.y,t,.02);L.positionZ.setTargetAtTime(c.position.z,t,.02);
    L.forwardX.setTargetAtTime(_lf.x,t,.02);L.forwardY.setTargetAtTime(_lf.y,t,.02);L.forwardZ.setTargetAtTime(_lf.z,t,.02);L.upX.setTargetAtTime(_lu.x,t,.02);L.upY.setTargetAtTime(_lu.y,t,.02);L.upZ.setTargetAtTime(_lu.z,t,.02);}
  else{L.setPosition(c.position.x,c.position.y,c.position.z);L.setOrientation(_lf.x,_lf.y,_lf.z,_lu.x,_lu.y,_lu.z);}}
// shell-shock: muffled world + ear ringing after a close blast or heavy hit
function earShock(k){if(!A.ctx||k<.15)return;const c=A.ctx,t=c.currentTime;const f=A.muffle.frequency;f.cancelScheduledValues(t);f.setValueAtTime(Math.max(380,2400*(1-k)),t);f.exponentialRampToValueAtTime(20000,t+1.2+k*2.4);
  if(k>.45){const o=c.createOscillator();o.frequency.value=3700+rnd(-200,200);const g=c.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.045*k*S.sfx,t+.08);g.gain.exponentialRampToValueAtTime(.0001,t+2.2+k*2);o.connect(g);g.connect(A.lim);o.start(t);o.stop(t+4.6);}}
// ---- haptics: phone vibration (Capacitor/Android, web) + gamepad rumble (PC) ----
let lastRumble=0;
function rumble(ms,str=.6){if(!S.vibrate)return;const now=performance.now();if(now-lastRumble<70)return;lastRumble=now;const k=clamp(str*S.vibStrength,0,1);ms=Math.round(ms*(.5+.5*S.vibStrength));
  try{if(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform())Haptics.vibrate({duration:ms});else if(navigator.vibrate)navigator.vibrate(k>.75?[ms,40,Math.round(ms*.5)]:ms);}catch(e){}
  try{for(const gp of (navigator.getGamepads?navigator.getGamepads():[])){if(gp&&gp.vibrationActuator&&gp.vibrationActuator.playEffect)gp.vibrationActuator.playEffect('dual-rumble',{duration:ms,strongMagnitude:k,weakMagnitude:Math.min(1,k*.7+.2)});}}catch(e){}}
const SND={
  garand:()=>sfxN({f0:5500,f1:180,d:.5,vol:.9,thump:.9,tf:150}),
  thompson:()=>sfxN({f0:3800,f1:300,d:.2,vol:.75,thump:.55,tf:120}),
  carbine:()=>sfxN({f0:5200,f1:300,d:.3,vol:.7,thump:.5,tf:160}),
  bolt:()=>sfxN({f0:6000,f1:150,d:.65,vol:1,thump:1.1,tf:130}),
  smg:()=>sfxN({f0:3600,f1:320,d:.16,vol:.65,thump:.45,tf:130}),
  ar:()=>sfxN({f0:4200,f1:280,d:.22,vol:.75,thump:.6,tf:125}),
  lmg:()=>sfxN({f0:3900,f1:240,d:.26,vol:.8,thump:.7,tf:115}),
  mg42:()=>sfxN({f0:3000,f1:260,d:.12,vol:.7,thump:.5,tf:110}),
  shotgun:()=>sfxN({f0:3000,f1:120,d:.6,vol:1.1,thump:1.3,tf:90}),
  cycle:()=>{sfxN({f0:5000,f1:2000,d:.06,vol:.35,type:'highpass'});sfxN({f0:4500,f1:1800,d:.06,vol:.35,type:'highpass',delay:.18});},
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
  clink:()=>{if(!A.ctx)return;const c=A.ctx,t=c.currentTime;const o=c.createOscillator();o.type='triangle';o.frequency.setValueAtTime(rnd(3800,5200),t);const g=c.createGain();g.gain.setValueAtTime(.06,t);g.gain.exponentialRampToValueAtTime(.001,t+.12);o.connect(g);g.connect(A.sfx);o.start(t);o.stop(t+.13);},
  step:(water)=>water?sfxN({f0:1200,f1:300,d:.22,vol:.22,type:'bandpass',q:1}):sfxN({f0:2400,f1:700,d:.09,vol:.14,type:'bandpass',q:1.4}),
  whistle:(d)=>{if(!A.ctx)return;const c=A.ctx,t=c.currentTime;const o=c.createOscillator();o.type='sine';o.frequency.setValueAtTime(1500,t);o.frequency.exponentialRampToValueAtTime(380,t+1.1);const g=c.createGain();const v=.12/(1+d*.02);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(v,t+.5);g.gain.exponentialRampToValueAtTime(.001,t+1.15);o.connect(g);g.connect(A.sfx);o.start(t);o.stop(t+1.2);},
  heart:()=>{if(!A.ctx)return;const c=A.ctx,t=c.currentTime;for(const [dl,v] of [[0,.5],[.16,.35]]){const o=c.createOscillator();o.frequency.setValueAtTime(60,t+dl);o.frequency.exponentialRampToValueAtTime(35,t+dl+.12);const g=c.createGain();g.gain.setValueAtTime(v,t+dl);g.gain.exponentialRampToValueAtTime(.001,t+dl+.16);o.connect(g);g.connect(A.sfx);o.start(t+dl);o.stop(t+dl+.18);}},
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
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',precision:'highp'});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.autoClear=false;renderer.setClearColor(0x7a7672);
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x8c8174,.008);
const camera=new THREE.PerspectiveCamera(78,innerWidth/innerHeight,.12,1500);camera.rotation.order='YXZ';scene.add(camera);
function resize(){renderer.setSize(innerWidth,innerHeight,false);try{if(composer)composer.setSize(innerWidth,innerHeight);}catch(e){}camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();try{vmCam.aspect=camera.aspect;vmCam.updateProjectionMatrix();}catch(e){}}
addEventListener('resize',resize);

/* ---- procedural textures ---- */
function ctex(w,h,draw,rep){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');draw(x,w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(rep)t.repeat.set(rep[0],rep[1]);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=16;return t;}
function speck(x,w,h,n,cols,sz){for(let i=0;i<n;i++){x.fillStyle=cols[i%cols.length];x.globalAlpha=Math.random()*.5+.2;const s=Math.random()*sz+1;x.fillRect(Math.random()*w,Math.random()*h,s,s);}x.globalAlpha=1;}
let EXPO_BASE=1,EXPO_ENV=1;
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
const MDIFF=[1,1.1,1.2,1.3,1.42,1.55,1.7,1.85,2,2.15,2.4];function MD(){return MDIFF[typeof CUR==='number'?CUR:1]||1;}
let HF=null;function H(x,z){return HF?HF(x,z):beachH(x,z);}
function groundAt(x,z,ry){let g=H(x,z);for(const c of colliders){if(x>c.minx&&x<c.maxx&&z>c.minz&&z<c.maxz&&c.maxy-c.miny<1.05&&c.maxy>g&&c.maxy-g<9)g=c.maxy;}if(LV&&LV.colMeshes&&LV.colMeshes.length){const from=(ry??g)+1.1;const m=meshGround(x,z,from,ry==null?1.8:3.2);if(m>g-.05&&m<from)g=m;}return g;}
function beachH(x,z){
  let h;
  if(z>40)h=-(z-40)*.12;else h=(40-z)*.025;
  if(z<-20){const t=Math.min(1,(-20-z)/22);const s=t*t*(3-2*t);h=1.5+s*8;}
  const ridge=clamp((-12-z)/10,0,1);
  h+=(Math.sin(x*.13)*.5+Math.sin(x*.31+z*.2)*.25)*ridge;
  h+=Math.sin(x*.7+z*.5)*.05+Math.sin(x*.21-z*.37)*.12*clamp((30-z)/20,0,1);
  return h;
}
const GDETAIL=makeDetailTexture(512),GROUND=makeGroundMaterial(GDETAIL,{anisotropy:16}),GROUND_SNOW=makeGroundMaterial(GDETAIL,{snow:true,anisotropy:16,roughness:.8});
const terrain=(()=>{
  const g=new THREE.PlaneGeometry(340,260,170,130);g.rotateX(-Math.PI/2);g.translate(0,0,20);
  const p=g.attributes.position,col=new Float32Array(p.count*3);const c=new THREE.Color();
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),y=H(x,z);p.setY(i,y);
    if(y<.25)c.setHex(0x6c6050);else if(z>-16)c.setHex(0xa8946e);else if(y<8.6)c.lerpColors(new THREE.Color(0x8f7d5a),new THREE.Color(0x5d5f3a),clamp((y-2)/7,0,1));else c.setHex(0x4e5a30);
    const n=.9+Math.random()*.15;col[i*3]=c.r*n;col[i*3+1]=c.g*n;col[i*3+2]=c.b*n;}
  g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();
  const m=new THREE.Mesh(g,GROUND);m.receiveShadow=true;scene.add(m);return m;
})();

/* ================= WORLD ================= */
const statics=[],colliders=[];
function addStatic(m,col=true){scene.add(m);m.updateMatrixWorld(true);statics.push(m);if(col){const b=new THREE.Box3().setFromObject(m);colliders.push({minx:b.min.x,maxx:b.max.x,minz:b.min.z,maxz:b.max.z,miny:b.min.y,maxy:b.max.y});}return m;}
// physical sky
// mobile-safe sky: keep it just inside the far plane (z=w gets clipped on many phone GPUs), draw it first, never depth-test it
function safeSky(sk){sk.material.vertexShader=sk.material.vertexShader.replace('gl_Position.z = gl_Position.w;','gl_Position.z = gl_Position.w * 0.9995;');sk.material.depthTest=false;sk.material.depthWrite=false;sk.renderOrder=-1e6;sk.frustumCulled=false;sk.material.needsUpdate=true;return sk;}
const sky=safeSky(new Sky());sky.scale.setScalar(1000);scene.add(sky);
const SUN_DIR=new V3();{const su=sky.material.uniforms;su.turbidity.value=9;su.rayleigh.value=2.2;su.mieCoefficient.value=.0045;su.mieDirectionalG.value=.8;
 SUN_DIR.setFromSphericalCoords(1,THREE.MathUtils.degToRad(84),THREE.MathUtils.degToRad(-35));su.sunPosition.value.copy(SUN_DIR);}
let FLARE=null;{const ft=(r,stops)=>{const t=ctex(r,r,(x)=>{const g=x.createRadialGradient(r/2,r/2,0,r/2,r/2,r/2);stops.forEach(s=>g.addColorStop(s[0],s[1]));x.fillStyle=g;x.fillRect(0,0,r,r);});t.colorSpace=THREE.SRGBColorSpace;return t;};
 const t0=ft(256,[[0,'rgba(255,250,235,1)'],[.12,'rgba(255,225,170,.8)'],[.4,'rgba(255,170,90,.15)'],[1,'rgba(0,0,0,0)']]),t1=ft(64,[[0,'rgba(255,210,150,.5)'],[.7,'rgba(255,170,90,.15)'],[1,'rgba(0,0,0,0)']]),t2=ft(64,[[.6,'rgba(0,0,0,0)'],[.85,'rgba(150,200,255,.25)'],[1,'rgba(0,0,0,0)']]);
 const lf=new Lensflare();lf.addElement(new LensflareElement(t0,170,0,new THREE.Color(.55,.48,.38)));lf.addElement(new LensflareElement(t1,40,.4,new THREE.Color(.5,.45,.4)));lf.addElement(new LensflareElement(t2,80,.6,new THREE.Color(.45,.5,.6)));lf.addElement(new LensflareElement(t1,50,.8,new THREE.Color(.4,.38,.34)));lf.addElement(new LensflareElement(t2,120,1,new THREE.Color(.35,.4,.5)));
 FLARE=new THREE.Object3D();FLARE.add(lf);scene.add(FLARE);}
const flareScene=new THREE.Scene();

function softDecal(m,hard=.35){m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <alphatest_fragment>',`
  {float r=length(vMapUv-.5)*2.;diffuseColor.a*=1.-smoothstep(${hard.toFixed(2)},1.,r);if(diffuseColor.a<.004)discard;}
  #include <alphatest_fragment>`);};m.customProgramCacheKey=()=>'softdecal'+hard;return m;}
// ---- soft sprites: compute the round, noisy soft edge in the shader (some phone drivers drop texture alpha -> solid rectangles) ----
function softSprite(m,{noise=.35,hard=.15}={}){m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <alphatest_fragment>',`
  {vec2 q=vMapUv-.5;float r=length(q)*2.;float n=fract(sin(dot(floor(vMapUv*7.),vec2(12.9898,78.233)))*43758.5453);
   float edge=1.-smoothstep(${hard.toFixed(2)},1.,r+(n-.5)*${noise.toFixed(2)}*r);diffuseColor.a*=edge;if(diffuseColor.a<.004)discard;}
  #include <alphatest_fragment>`);};m.customProgramCacheKey=()=>'softsprite'+noise+hard;return m;}
const CLOUDS=new THREE.Group();scene.add(CLOUDS);{const ct=ctex(128,128,(x)=>{for(let i=0;i<14;i++){const cx=rnd(30,98),cy=rnd(45,85),r=rnd(14,30);const g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);}});
 for(let i=0;i<40;i++){const m=softSprite(new THREE.SpriteMaterial({map:ct,color:new THREE.Color().setHSL(.07,.12,rnd(.45,.75)),transparent:true,depthWrite:false,fog:false,opacity:rnd(.45,.8)}),{noise:.5,hard:.05});const sp=new THREE.Sprite(m);const a=rnd(0,Math.PI*2),r=rnd(300,600);sp.position.set(Math.cos(a)*r,rnd(80,200),Math.sin(a)*r);sp.scale.set(rnd(180,340),rnd(60,120),1);CLOUDS.add(sp);}}
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

// ---- painted sky: CPU-drawn equirect panorama (no sky shader -> no mobile GPU precision artifacts); also feeds PBR reflections ----
const SKYZ={dawn:0x6a86a6,day:0x4f86c6,overcast:0x868d95,dusk:0x34405e,rain:0x5f676f,snow:0x98a2ac,night:0x070b12,snowNight:0x0e131c};
let PSKY=null,PENV=null,PMG=null;
function paintSky(name){const e=ENV[name];if(PSKY){PSKY.dispose();PSKY=null;}if(!e||e.inside)return null;const W=1024,Hh=512;
  const lift=e.night?1:1.32,z=new THREE.Color(SKYZ[name]??0x5a7aa0).multiplyScalar(lift),h=new THREE.Color(e.fog).multiplyScalar(e.night?1:1.18),sd=SUN_DIR;const su=Math.atan2(sd.z,sd.x)/(2*Math.PI)+.5,sv=Math.asin(clamp(sd.y,-1,1))/Math.PI+.5;
  const t=ctex(W,Hh,(x)=>{const c=new THREE.Color();for(let yy=0;yy<Hh;yy++){const el=(.5-yy/Hh)*Math.PI;if(el<=0)c.copy(h);else c.copy(h).lerp(z,Math.pow(Math.sin(el),.5));x.fillStyle='#'+c.getHexString();x.fillRect(0,yy,W,1);}
    // horizon haze band
    const hz=x.createLinearGradient(0,Hh*.42,0,Hh*.5);hz.addColorStop(0,'rgba(255,255,255,0)');hz.addColorStop(1,'#'+h.getHexString());x.fillStyle=hz;x.fillRect(0,Hh*.42,W,Hh*.08+1);
    if(e.night){for(let i=0;i<700;i++){const a=Math.random();x.fillStyle=`rgba(255,255,255,${a*a*.9})`;const r=Math.random()<.04?1.6:.8;x.fillRect(Math.random()*W,Math.random()*Hh*.46,r,r);}
      const mx=(su*W+W*.35)%W,my=Hh*.2;const mg=x.createRadialGradient(mx,my,0,mx,my,60);mg.addColorStop(0,'rgba(220,230,255,.9)');mg.addColorStop(.08,'rgba(200,215,255,.35)');mg.addColorStop(1,'rgba(120,140,200,0)');x.fillStyle=mg;x.fillRect(mx-60,my-60,120,120);}
    else{const sc=new THREE.Color(e.sun);const sx=su*W,sy=(1-sv)*Hh;for(const ox of[-W,0,W]){const g=x.createRadialGradient(sx+ox,sy,0,sx+ox,sy,Hh*.42);g.addColorStop(0,`rgba(${sc.r*255|0},${sc.g*255|0},${sc.b*255|0},.55)`);g.addColorStop(.06,`rgba(${sc.r*255|0},${sc.g*255|0},${sc.b*255|0},.28)`);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(sx+ox-Hh*.42,sy-Hh*.42,Hh*.84,Hh*.84);
        const d=x.createRadialGradient(sx+ox,sy,0,sx+ox,sy,7);d.addColorStop(0,'rgba(255,250,235,1)');d.addColorStop(1,'rgba(255,240,210,0)');x.fillStyle=d;x.fillRect(sx+ox-8,sy-8,16,16);}
      const cloudy=/overcast|rain|snow/.test(name);const n=cloudy?140:70;for(let i=0;i<n;i++){const cx=Math.random()*W,cy=Hh*(.12+Math.random()*.34),rw=rnd(30,cloudy?160:110),rh=rw*rnd(.18,.35);
        const g=x.createRadialGradient(cx,cy,0,cx,cy,rw);const k=cloudy?rnd(.55,.8):rnd(.8,1);g.addColorStop(0,`rgba(${255*k|0},${250*k|0},${245*k|0},${cloudy?.22:.16})`);g.addColorStop(1,'rgba(255,255,255,0)');x.save();x.translate(cx,cy);x.scale(1,rh/rw);x.translate(-cx,-cy);x.fillStyle=g;x.fillRect(cx-rw,cy-rw,rw*2,rw*2);x.restore();}}});
  t.mapping=THREE.EquirectangularReflectionMapping;t.colorSpace=THREE.SRGBColorSpace;t.wrapS=THREE.RepeatWrapping;PSKY=t;return t;}
function applySkyMode(name){const e=ENV[name];if(S.sky==='painted'){sky.visible=false;CLOUDS.visible=false;const t=paintSky(name);scene.background=t;
    if(t){PMG=PMG||new THREE.PMREMGenerator(renderer);if(PENV)PENV.dispose();PENV=PMG.fromEquirectangular(t);scene.environment=PENV.texture;}}
  else{scene.background=null;sky.visible=!e.inside;CLOUDS.visible=!e.night;}}
// ---- resolution: density-aware pixel ratio + dynamic resolution to hold frame rate ----
const DRS={k:1,slow:0,fast:0,ema:16};
function basePR(){const d=window.devicePixelRatio||1;const r=S.res;if(r==='sharp')return Math.min(d,2.5);if(r==='balanced')return Math.min(d,1.5);if(r==='performance')return Math.min(d,1)*.8;
  return Math.min(d,({low:1.15,medium:1.5,high:2,ultra:2.5})[S.quality]||1.5);}
function updDRS(dt){if(S.res!=='auto'||state!=='play')return;DRS.ema=DRS.ema*.95+dt*1000*.05;if(DRS.ema>24){DRS.slow+=dt;DRS.fast=0;}else if(DRS.ema<17.5){DRS.fast+=dt;DRS.slow=0;}else{DRS.slow=DRS.fast=0;}
  if(DRS.slow>1.5&&DRS.k>.55){DRS.k=Math.max(.55,DRS.k-.1);DRS.slow=0;renderer.setPixelRatio(basePR()*DRS.k);resize();}
  else if(DRS.fast>5&&DRS.k<1){DRS.k=Math.min(1,DRS.k+.1);DRS.fast=0;renderer.setPixelRatio(basePR()*DRS.k);resize();}}
// ---- realistic ocean (medium+) ----
let water2=null;
function buildWater2(){if(water2)return;const tex=new THREE.TextureLoader().load(BASE+'textures/waternormals.jpg',t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;});
  water2=new Water(new THREE.PlaneGeometry(600,260),{textureWidth:512,textureHeight:512,waterNormals:tex,sunDirection:SUN_DIR.clone(),sunColor:0xffd2a0,waterColor:0x1f3a40,distortionScale:2.6,fog:true,alpha:.97});
  water2.rotation.x=-Math.PI/2;water2.position.set(0,-.02,170);scene.add(water2);}
// ---- environment lighting from the sky (PBR reflections) ----
{const pm=new THREE.PMREMGenerator(renderer);const es=new THREE.Scene();const s2=safeSky(new Sky());s2.scale.setScalar(1000);Object.keys(sky.material.uniforms).forEach(k=>s2.material.uniforms[k].value=sky.material.uniforms[k].value);es.add(s2);
  scene.environment=pm.fromScene(es,0,.1,2000).texture;Object.values(MAT).forEach(m=>m.envMapIntensity=.45);}
// ---- grass on the bluff ----
let grass=null;
// ---- grass: tufts of tapered blades in a patch that follows the camera; root-to-tip shading, wind sway, distance fade ----
const GRASS={c:new V3(1e9,0,1e9),R:30,n:0,t:{value:0}};
function tuftGeo(){const blades=7,segs=3,pos=[],hg=[],nor=[],idx=[];let v=0;
  for(let b=0;b<blades;b++){const a=b/blades*Math.PI*2+Math.random()*.6,lean=rnd(.1,.28),h=rnd(.26,.48),w=rnd(.018,.03),ox=Math.cos(a)*.06,oz=Math.sin(a)*.06,cx=Math.cos(a),cz=Math.sin(a),px=-cz,pz=cx;
    for(let k=0;k<=segs;k++){const t=k/segs,ww=w*(1-t*.85),y=h*t,off=lean*t*t;for(const sd of[-1,1]){pos.push(ox+cx*off+px*ww*sd,y,oz+cz*off+pz*ww*sd);hg.push(t);nor.push(cx*.35,1,cz*.35);}}
    for(let k=0;k<segs;k++){const a0=v+k*2;idx.push(a0,a0+1,a0+2,a0+1,a0+3,a0+2);}v+=(segs+1)*2;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('hgt',new THREE.Float32BufferAttribute(hg,1));g.setIndex(idx);g.normalizeNormals();return g;}
function grassOK(x,z){if(LV){if(LV.def.snow)return false;if(LV.noGrass&&LV.noGrass.some(r=>x>r[0]&&x<r[1]&&z>r[2]&&z<r[3]))return false;for(const c of LV.colliders)if(x>c.minx&&x<c.maxx&&z>c.minz&&z<c.maxz&&c.maxy-c.miny>.6)return false;
    const y=H(x,z);if(LV.water&&y<LV.water.position.y+.15)return false;const hx=LV.def.col(x,z,y);const r=hx>>16&255,g=hx>>8&255,b=hx&255;return g>r*1.02&&g>b*1.15;}
  return H(x,z)>=2.6||(z<-16&&z>-90&&Math.random()<.2);}
function buildGrass(n){if(grass){scene.remove(grass);grass.geometry.dispose();grass=null;}if(!n)return;
  const m=new THREE.MeshStandardMaterial({color:0xffffff,side:THREE.DoubleSide,roughness:.92});
  m.onBeforeCompile=sh=>{sh.uniforms.uT=GRASS.t;sh.uniforms.uR={value:GRASS.R};
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float hgt;varying float vH;uniform float uT;uniform float uR;')
     .replace('#include <begin_vertex>',`#include <begin_vertex>
  vH=hgt;vec3 ip=vec3(instanceMatrix[3][0],instanceMatrix[3][1],instanceMatrix[3][2]);
  float fd=1.-smoothstep(uR*.72,uR,distance(ip.xz,cameraPosition.xz));transformed*=fd;
  float ph=uT*1.6+ip.x*.31+ip.z*.23;float sw=(sin(ph)*.6+sin(ph*2.3+1.7)*.25)*hgt*hgt;transformed.x+=sw*.09;transformed.z+=sw*.05;`);
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vH;')
     .replace('#include <color_fragment>','#include <color_fragment>\n diffuseColor.rgb*=mix(.25,1.0,vH);');};
  grass=new THREE.InstancedMesh(tuftGeo(),m,n);grass.instanceMatrix.setUsage(THREE.DynamicDrawUsage);grass.frustumCulled=false;grass.receiveShadow=true;
  GRASS.R=({medium:26,high:38,ultra:52})[S.quality]||28;GRASS.n=n;GRASS.c.set(1e9,0,1e9);scene.add(grass);placeGrass();}
const _gd=new THREE.Object3D(),_gc=new THREE.Color();
function placeGrass(){if(!grass)return;const c=camera.position,R=GRASS.R;GRASS.c.set(c.x,0,c.z);let k=0,t=0;const n=GRASS.n;
  while(k<n&&t<n*3){t++;const x=c.x+rnd(-R,R),z=c.z+rnd(-R,R);if(!grassOK(x,z))continue;_gd.position.set(x,H(x,z)-.03,z);_gd.rotation.set(rnd(-.12,.12),rnd(0,6.3),rnd(-.12,.12));const sc=rnd(.65,1.15);_gd.scale.set(sc,sc*rnd(.8,1.3),sc);_gd.updateMatrix();grass.setMatrixAt(k,_gd.matrix);
    _gc.setHSL(rnd(.17,.27),rnd(.38,.62),rnd(.12,.22));grass.setColorAt(k,_gc);k++;}
  grass.count=k;grass.instanceMatrix.needsUpdate=true;if(grass.instanceColor)grass.instanceColor.needsUpdate=true;}
function updGrass(dt){GRASS.t.value+=dt;if(!grass||!grass.visible)return;const c=camera.position;if(Math.hypot(c.x-GRASS.c.x,c.z-GRASS.c.z)>GRASS.R*.3)placeGrass();}
// ---- sand normal map (ripples) ----
{const N=256;const hc=new Float32Array(N*N);for(let y=0;y<N;y++)for(let x=0;x<N;x++){hc[y*N+x]=Math.sin((x+Math.sin(y*.09)*9)*.35)*.5+Math.sin((x*.7+y*.3)*.11)*.3+Math.random()*.35;}
 const cv=document.createElement('canvas');cv.width=cv.height=N;const cx=cv.getContext('2d');const im=cx.createImageData(N,N);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const l=hc[y*N+(x-1+N)%N],r=hc[y*N+(x+1)%N],u=hc[((y-1+N)%N)*N+x],d=hc[((y+1)%N)*N+x];let nx=(l-r)*1.4,ny=(u-d)*1.4,nz=1;const L=Math.hypot(nx,ny,nz);const i=(y*N+x)*4;im.data[i]=(nx/L*.5+.5)*255;im.data[i+1]=(ny/L*.5+.5)*255;im.data[i+2]=(nz/L*.5+.5)*255;im.data[i+3]=255;}
 cx.putImageData(im,0,0);const nt=new THREE.CanvasTexture(cv);nt.wrapS=nt.wrapT=THREE.RepeatWrapping;nt.repeat.set(140,110);MAT.sand.normalMap=nt;MAT.sand.normalScale.set(.35,.35);MAT.sand.needsUpdate=true;}
// ---- post processing ----
let composer=null,bloom=null;
function buildComposer(on,bloomOn){if(composer){composer.dispose();composer=null;}if(FLARE){(on?flareScene:scene).add(FLARE);}if(!on)return;
  const rt=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:4});composer=new EffectComposer(renderer,rt);
  composer.addPass(new RenderPass(scene,camera));if(S.quality==='ultra'){try{const ao=new GTAOPass(scene,camera,innerWidth,innerHeight);ao.blendIntensity=.85;composer.addPass(ao);}catch(e){}}if(bloomOn){bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth/2,innerHeight/2),isTouch?.2:.35,.55,isTouch?.95:.9);composer.addPass(bloom);}composer.addPass(new OutputPass());
  composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight);}

// hedgehogs
let lensDirt=0;const HEDGES=[],SBAGS=[];
function hedgehog(x,z){const g=new THREE.Group();HEDGES.push(g);for(let i=0;i<3;i++){const b=box(.22,.22,2.4,MAT.rust);b.rotation.set(i===0?.6:i===1?-.6:0,i===2?Math.PI/2:0,i===2?.6:0);g.add(b);}g.position.set(x,H(x,z)+.75,z);g.rotation.y=Math.random()*3;g.children.forEach(c=>{c.castShadow=true;});scene.add(g);g.updateMatrixWorld(true);g.children.forEach(c=>statics.push(c));
  colliders.push({minx:x-.8,maxx:x+.8,minz:z-.8,maxz:z+.8,miny:0,maxy:H(x,z)+1.5});}
const HH=[[-6,30],[5,26],[-14,22],[12,18],[-3,16],[20,12],[-22,10],[2,8],[-10,4],[14,2],[26,24],[-26,26],[34,16],[-34,14],[8,34],[-18,34],[30,4],[-30,0],[-1,-2],[18,-5],[-16,-6],[40,8],[-42,20],[44,28]];
HH.forEach(([x,z])=>hedgehog(x,z));
// seawall
for(let x=-66;x<66;x+=13){const w=box(10,1.4,1,MAT.concrete);w.position.set(x+5,H(x+5,-13)+.6,-13);addStatic(w);}
// burnt tank
(()=>{const g=new THREE.Group();const hull=box(3.2,1.3,6,MAT.char);hull.position.y=.75;g.add(hull);const tur=box(2.1,.9,2.6,MAT.char);tur.position.set(0,1.85,-.3);g.add(tur);const bar=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,3,8),MAT.char);bar.rotation.x=Math.PI/2;bar.position.set(0,1.9,-2.8);g.add(bar);
  for(const s of[-1,1]){const tr=box(.6,1,6.2,MAT.char);tr.position.set(s*1.7,.5,0);g.add(tr);}
  g.name='procTank';g.position.set(-19,H(-19,12),12);g.rotation.y=.4;g.rotation.z=.08;scene.add(g);g.updateMatrixWorld(true);g.children.forEach(c=>statics.push(c));colliders.push({minx:-22,maxx:-16,minz:8.5,maxz:15.5,miny:0,maxy:H(-19,12)+2.3});})();
// trench sandbags
const TRENCH_Z=-45;
for(let x=-38;x<44;x+=9){if(Math.abs(x-4)<3)continue;const b=box(7,1,1.1,MAT.bags);b.position.set(x,H(x,TRENCH_Z)+.45,TRENCH_Z);addStatic(b);SBAGS.push({m:b,len:7,h:1});}
for(const [x,z] of [[-8,-33.5],[15,-31.5],[-26,-30]]){const b=box(3.4,.9,.9,MAT.bags);b.position.set(x,H(x,z)+.4,z);addStatic(b);SBAGS.push({m:b,len:3.4,h:.9});}
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
 const cm=softDecal(new THREE.MeshStandardMaterial({map:ct,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,roughness:1}),.4);
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
async function loadCharacters(onProg){const L=mkLoader();
  const list=[['us','models/us_soldier.glb'],['axis','models/axis_soldier.glb'],['axis','models/mg_gunner_a.glb'],['axis','models/mg_gunner_b.glb']];let n=0;
  await Promise.all(list.map(async([k,f])=>{try{const g=await L.loadAsync(BASE+f);const b=new THREE.Box3().setFromObject(g.scene);const h=b.max.y-b.min.y;const sc=1.78/(h||1.78);
      g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;if(o.material)o.material.envMapIntensity=.4;}});
      (CHAR[k]=CHAR[k]||[]).push({scene:g.scene,anims:g.animations,scale:sc,minY:b.min.y,file:f});}catch(e){if(!/404|Not Found|fetch/i.test(String(e)))console.warn('model',f,e);}
    onProg&&onProg(++n/list.length);}));
  for(const k in CHAR)CHAR[k].sort((a,b)=>a.file<b.file?-1:1);}
// ---- prop models (GLB) ----
async function loadProps(){const L=mkLoader();await Promise.all([(async()=>{try{const g=await L.loadAsync(BASE+'models/landing_craft.glb');g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material)o.material.envMapIntensity=.5;}});upgradeBoats(g.scene);}catch(e){console.warn('landing craft model missing',e);}})(),(async()=>{try{const g=await L.loadAsync(BASE+'models/sherman_destroyed.glb');g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material)o.material.envMapIntensity=.3;}});PROPS.sherman=g.scene;upgradeTank(g.scene);}catch(e){}})(),
  ...[...new Set(['garand','thompson','kar98k','mp40','stg44','g43','mg42',LOADOUT.primary,LOADOUT.secondary])].map(id=>loadWeapon(id)),
  (async()=>{try{const g=await L.loadAsync(BASE+'models/fp_arms_us.glb');setupArms(g.scene);}catch(e){console.warn('arms',e);}})(),
  (async()=>{try{const g=await L.loadAsync(BASE+'models/czech_hedgehog.glb');shadowAll(g.scene);PROPS.hedgehog=g.scene;for(const h of HEDGES){h.children.forEach(c=>c.visible=false);const m=g.scene.clone(true);m.position.y=-.75;h.add(m);}}catch(e){}})(),
  (async()=>{try{const g=await L.loadAsync(BASE+'models/sandbag_wall.glb');shadowAll(g.scene);PROPS.sandbag=g.scene;for(const sb of SBAGS){sb.m.visible=false;const n=Math.max(1,Math.round(sb.len/3.5));const sx=sb.len/(n*3.51);for(let i=0;i<n;i++){const m=g.scene.clone(true);m.scale.set(sx,sb.h/.83,1.6);m.position.set(sb.m.position.x-sb.len/2+(i+.5)*sb.len/n,sb.m.position.y-sb.h/2,sb.m.position.z);m.rotation.y=sb.m.rotation.y;scene.add(m);}}}catch(e){}})(),
  (async()=>{try{const g=await L.loadAsync(BASE+'models/concrete_bunker.glb');shadowAll(g.scene);PROPS.bunker=g.scene;let cm=null;g.scene.traverse(o=>{if(!cm&&o.isMesh&&o.material&&o.material.map)cm=o.material;});
     if(cm){for(const k of ['map','normalMap','roughnessMap']){if(cm[k]){const t=cm[k].clone();t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2.5,1);t.needsUpdate=true;MAT.concrete[k]=t;}}MAT.concrete.color.setHex(0xffffff);MAT.concrete.needsUpdate=true;}
     for(const [x,z,ry] of [[-40,-57,.3],[46,-58,-.4],[-75,-60,0]]){const m=g.scene.clone(true);m.position.set(x,H(x,z)-.1,z);m.rotation.y=ry;scene.add(m);m.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(m);colliders.push({minx:b.min.x,maxx:b.max.x,minz:b.min.z,maxz:b.max.z,miny:b.min.y,maxy:b.max.y});m.traverse(o=>{if(o.isMesh)statics.push(o);});}rebuildHit();}catch(e){}})(),
  (async()=>{try{const g=await L.loadAsync(BASE+'models/barbed_wire.glb');shadowAll(g.scene);PROPS.wire=g.scene;const spots=[[-30,-6,.1],[-12,-4,-.05],[10,-5,.08],[28,-7,0],[-40,4,.2],[36,6,-.15],[-24,-41,0],[-6,-41,0],[18,-40.5,.05],[34,-41,0]];
     const n=QUAL[S.quality].grass?spots.length:4;for(let i=0;i<n;i++){const [x,z,ry]=spots[i];const m=g.scene.clone(true);m.position.set(x,H(x,z),z);m.rotation.y=ry;scene.add(m);}}catch(e){}})()
  ]);}
const WMODELS={},WLOAD={};
function loadWeapon(id){if(WLOAD[id])return WLOAD[id];return WLOAD[id]=mkLoader().loadAsync(BASE+'models/weapons/'+id+'.glb').then(g=>{g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;if(o.material)o.material.envMapIntensity=.7;}});WMODELS[id]=g.scene;}).catch(()=>{});}
function shadowAll(o){o.traverse(c=>{if(c.isMesh){c.castShadow=true;c.receiveShadow=true;if(c.material)c.material.envMapIntensity=.45;}});}
const PROPS={};
// normalise a gun model: muzzle toward -z, centred, length in metres kept
function orientGun(src){const wrap=new THREE.Group();const m=src;wrap.add(m);const bb=new THREE.Box3().setFromObject(m);const c=bb.getCenter(new V3());m.position.sub(c);
  let stockZ=0,found=false;m.traverse(o=>{if(o.isMesh&&o.material&&/walnut|wood|stock/i.test(o.material.name||'')){const b2=new THREE.Box3().setFromObject(o);stockZ=b2.getCenter(new V3()).z-c.z;found=true;}});
  if(found&&stockZ<0)wrap.rotation.y=Math.PI;const o=new THREE.Group();o.add(wrap);o.userData.len=bb.max.z-bb.min.z;return o;}
function placeBunkerMG(){const g=PROPS.mg42.clone(true);g.position.set(BK.x,H(BK.x,BK.z)-.2+1.55,BK.z+2.6);g.rotation.y=Math.PI;scene.add(g);}
function upgradeTank(src){const old=scene.getObjectByName('procTank');if(old){old.visible=false;}const g=new THREE.Group();g.add(src);g.position.set(-19,H(-19,12)-.05,12);g.rotation.y=.4;scene.add(g);}
function upgradeBoats(src){for(const b of boats){const keepRot=b.userData.ramp.rotation.x;
  for(const c of [...b.children])if(!(b.userData.dummies||[]).includes(c))b.remove(c);
  const m=src.clone(true);const wrap=new THREE.Group();m.position.set(0,0,-5.33);wrap.add(m);wrap.rotation.y=Math.PI;b.add(wrap);
  const ramp=m.getObjectByName('Ramp'),hinge=m.getObjectByName('RampHinges');const base=ramp.rotation.x;let v=0;
  const set=x=>{v=x;ramp.rotation.x=base-x;if(hinge)hinge.rotation.x=base-x;};
  b.userData.ramp={rotation:{get x(){return v;},set x(x){set(x);}}};set(keepRot);}}
function clipBy(anims,re){return anims.find(a=>re.test(a.name));}
const _q1=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_q3=new THREE.Quaternion(),_v1=new V3(),_v2=new V3(),_v3=new V3();
function aimBone(bone,child,dirW){bone.getWorldPosition(_v1);child.getWorldPosition(_v2);_v2.sub(_v1).normalize();_q1.setFromUnitVectors(_v2,dirW);
  bone.parent.getWorldQuaternion(_q2);_q3.copy(_q2).multiply(bone.quaternion);_q3.premultiply(_q1);bone.quaternion.copy(_q2.invert().multiply(_q3));bone.updateMatrixWorld(true);}
const RIGB=['Hips','Spine','LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand','LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot','Head'];
function findBone(root,name){let r=null;root.traverse(o=>{if(!r&&o.isBone&&(o.name===name||o.name.endsWith(':'+name)||o.name.endsWith('_'+name)))r=o;});return r;}
function makeSoldierGLB(team,variant){const list=CHAR[team];const C=list[variant!=null?variant%list.length:Math.floor(Math.random()*list.length)];
  const g=new THREE.Group(),rig=new THREE.Group();g.add(rig);
  const m=SkeletonUtils.clone(C.scene);m.scale.setScalar(C.scale);m.position.y=-C.minY*C.scale;rig.add(m);
  const hit=[];const hb=(w,h,d,y,part)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),HITMAT);o.position.y=y;o.userData.part=part;rig.add(o);hit.push(o);};
  hb(.5,.75,.35,1.15,'body');hb(.42,.8,.3,.42,'body');hb(.26,.3,.28,1.64,'head');
  const s={g,rig,legs:null,arms:null,hit,glb:true,acts:{},t:Math.random()*10,run:0,crouchK:0};
  if(C.anims.length){const mixer=new THREE.AnimationMixer(m);s.mixer=mixer;setupClips(s,C.anims);mixer.update(Math.random()*2);mixers.push(mixer);}
  else{s.bones={};for(const n of RIGB)s.bones[n]=findBone(m,n);s.rest={};for(const n in s.bones)if(s.bones[n])s.rest[n]=s.bones[n].quaternion.clone();s.proc=!!(s.bones.RightArm&&s.bones.LeftArm&&s.bones.RightUpLeg);}
  // weapon in hands
  const gun=new THREE.Group();rig.add(gun);s.gun=gun;s.handBone=findBone(m,'RightHandWeapon');s.spine=findBone(m,'Spine1')||findBone(m,'Spine');
  const muz=new THREE.Object3D();muz.position.set(-.08,1.3,.95);rig.add(muz);s.muz=muz;
  return s;}

// ---- clip-driven soldier animation: locomotion/stance layer + one-shot actions + death ----
const CLIPRX={idle:/^idle$/i,walk:/^walk$/i,run:/^run$/i,sprint:/^sprint$/i,fire:/^fire$/i,aimWalk:/^aimwalk$/i,cIdle:/^crouchidle$/i,cFire:/^crouchfire$/i,cWalk:/^crouchwalk$/i,prone:/^prone$/i,cover:/^cover$/i,
  pIdle:/^pistolidle$/i,pFire:/^pistolfire$/i,kneel:/^kneel$/i,radio:/^radio$/i,
  reload:/^reload$/i,throw:/^throw$/i,melee:/^melee$/i,hit:/^hitreact$/i,wave:/^wave$/i,stagger:/^stagger$/i,dF:/^deathforward$/i,dB:/^deathback$/i,dH:/^deathhead$/i};
const ONESHOT=new Set(['reload','throw','melee','hit','wave','stagger','dF','dB','dH']);
function setupClips(s,anims){const A={};for(const k in CLIPRX){const c=anims.find(a=>CLIPRX[k].test(a.name.replace(/^.*\|/,'')));if(c)A[k]=s.mixer.clipAction(c);}
  if(!A.idle){const c=clipBy(anims,/idle|stand|aim/i)||anims[0];A.idle=s.mixer.clipAction(c);}if(!A.run){const c=clipBy(anims,/run|sprint/i);if(c)A.run=s.mixer.clipAction(c);}if(!A.walk){const c=clipBy(anims,/walk/i);if(c)A.walk=s.mixer.clipAction(c);}
  if(!A.fire){const c=clipBy(anims,/fire|shoot/i);if(c)A.fire=s.mixer.clipAction(c);}
  s.acts=A;s.full=!!(A.cIdle&&A.dF);s.base='idle';s.W={};
  for(const k in A){const a=A[k];if(ONESHOT.has(k)){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=k[0]==='d'&&k.length===2;a.enabled=false;}else{a.play();const w=k==='idle'?1:0;a.setEffectiveWeight(w);a.enabled=w>0;s.W[k]=w;}}}
// pick the locomotion/stance clip from speed, crouch and firing state
function baseKey(s,spd,crouch,firing){const A=s.acts;if(s.pose&&A[s.pose])return s.pose;const pis=s.pistol&&A.pIdle;
  if(spd>.3){if(crouch>.5&&A.cWalk)return 'cWalk';if(spd<2.7)return firing&&A.aimWalk?'aimWalk':(A.walk?'walk':'run');if(spd>5.2&&A.sprint)return 'sprint';return A.run?'run':'walk';}
  if(crouch>.5&&A.cIdle)return firing&&A.cFire?'cFire':'cIdle';if(firing)return pis&&A.pFire?'pFire':'fire';return pis?'pIdle':'idle';}
function animSet(s,dt,spd,crouch,firing){if(!s.acts||s.dead)return;const A=s.acts;let key=baseKey(s,spd,crouch,firing);if(!A[key])key='idle';s.base=key;
  if(A[key].timeScale!==undefined&&(key==='walk'||key==='run'||key==='cWalk'||key==='aimWalk'))A[key].timeScale=key==='run'?clamp(spd/4.2,.8,1.25):key==='cWalk'?clamp(spd/1.6,.8,1.3):clamp(spd/1.5,.7,1.3);
  let osw=0;if(s.os){s.os.t+=dt;const o=s.os;osw=Math.min(1,o.t/.12,(o.dur-o.t)/.18)*o.max;if(o.t>=o.dur){o.a.enabled=false;o.a.stop();s.os=null;osw=0;}else o.a.setEffectiveWeight(Math.max(0,osw));}
  const k=Math.min(1,dt*9);let tot=0;for(const n in s.W){const tgt=n===key?1:0;s.W[n]=s.W[n]+(tgt-s.W[n])*k;if(s.W[n]<.002&&tgt===0)s.W[n]=0;tot+=s.W[n];}
  for(const n in s.W){const a=A[n],w=tot>0?s.W[n]/tot:(n==='idle'?1:0);const on=w>0;if(on&&!a.enabled){a.enabled=true;}else if(!on&&a.enabled)a.enabled=false;if(on)a.setEffectiveWeight(w*(1-osw));}}
function animOnce(s,key,max=1){if(!s.acts||s.dead)return false;const a=s.acts[key];if(!a)return false;if(s.os&&s.os.a!==a&&s.os.t<s.os.dur*.5&&key==='hit')return false;if(s.os&&s.os.a!==a){s.os.a.enabled=false;s.os.a.stop();}
  a.reset();a.enabled=true;a.setEffectiveWeight(0);a.play();s.os={a,t:0,dur:a.getClip().duration/Math.max(.01,a.timeScale),max};return true;}
function animDie(s,kind){if(!s.acts||!s.full){return false;}const A=s.acts;const a=A[kind]||A.dF;if(s.os){s.os.a.enabled=false;s.os=null;}
  for(const n in s.W){A[n].enabled=false;A[n].setEffectiveWeight(0);}a.reset();a.enabled=true;a.setEffectiveWeight(1);a.play();s.dead=true;s.rig.position.y=0;s.rig.rotation.set(0,0,0);return true;}
function animRevive(s){if(!s.acts)return;s.dead=false;for(const k of ['dF','dB','dH'])if(s.acts[k]){s.acts[k].stop();s.acts[k].enabled=false;}}
function setSoldierGun(s,wid){if(!s.gun)return;s.gun.clear();if(s.handGun){s.handGun.parent&&s.handGun.parent.remove(s.handGun);s.handGun=null;}const w=WEAPONS[wid];if(!w)return;let mdl;
  if(s.handBone){if(!WMODELS[wid]){loadWeapon(wid).then(()=>{if(WMODELS[wid])setSoldierGun(s,wid);});}else{mdl=WMODELS[wid].clone(true);s.handBone.add(mdl);s.handGun=mdl;s.heavy=w.cls==='lmg';const mz=mdl.getObjectByName('Muzzle');if(mz)s.muz=mz;return;}}
  if(WMODELS[wid]){mdl=WMODELS[wid].clone(true);s.gun.add(mdl);s.heavy=false;s.gun.position.set(-.14,1.16,.2);s.gun.rotation.set(-.06,0,0);const mz=mdl.getObjectByName('Muzzle');s.muz.position.set(-.14,1.18+(mz?mz.position.y:0),.2+(mz?mz.position.z:.8));return;}
  if(wid==='mg42'&&PROPS.mg42){mdl=PROPS.mg42.clone(true);}else{const vm=buildGunVM(effStats(wid,{}),{wood:MAT.wood,met:MAT.gunMetal,skin:MAT.skin,sleeve:MAT.olive,blued:MAT.gunMetal});vm.traverse(o=>{if(o.isMesh){if(o.material===MAT.skin||o.material===MAT.olive)o.visible=false;o.renderOrder=0;o.castShadow=true;}});mdl=new THREE.Group();mdl.add(vm);vm.rotation.y=Math.PI;vm.scale.setScalar(1.15);}
  s.gun.add(mdl);s.heavy=w.cls==='lmg';s.gun.position.set(-.1,s.heavy?1.08:1.3,s.heavy?.35:.3);if(!(wid==='mg42'&&PROPS.mg42))s.gun.rotation.y=0;
  s.muz.position.set(-.1,s.heavy?1.1:1.33,s.heavy?1:1);}
// procedural pose for rigs without animation clips (character faces +z, its right side is -x)
const D=(x,y,z)=>new V3(x,y,z).normalize();
function poseProc(s,dt,run,crouch,aim){const B=s.bones;for(const n in s.rest)B[n].quaternion.copy(s.rest[n]);s.g.updateMatrixWorld(true);
  s.t+=dt*(run?9:1.4);const q=new THREE.Quaternion();s.rig.getWorldQuaternion(q);const W=v=>v.clone().applyQuaternion(q);
  const sw=Math.sin(s.t)*run, br=Math.sin(s.t*.5)*.015;
  if(B.Spine&&B.Head)aimBone(B.Spine,B.Head,W(D(0,1,.08+run*.15+crouch*.2)));
  // legs
  const leg=(up,lo,ft,ph)=>{if(!up||!lo||!ft)return;const a=ph*.7*run+crouch*1.2;aimBone(up,lo,W(D(0,-Math.cos(a),Math.sin(a))));const k=a-(run?Math.max(0,-ph)*1.1+.25:0)-crouch*2.3;aimBone(lo,ft,W(D(0,-Math.cos(k),Math.sin(k))));};
  leg(B.LeftUpLeg,B.LeftLeg,B.LeftFoot,sw);leg(B.RightUpLeg,B.RightLeg,B.RightFoot,-sw);
  // arms hold weapon
  const h=s.heavy;if(B.RightArm&&B.RightForeArm&&B.RightHand){aimBone(B.RightArm,B.RightForeArm,W(D(-.35,-.8,h?.25:.35+br)));aimBone(B.RightForeArm,B.RightHand,W(D(.25,h?-.15:.05,1)));}
  if(B.LeftArm&&B.LeftForeArm&&B.LeftHand){aimBone(B.LeftArm,B.LeftForeArm,W(D(.3,-.6,.75)));aimBone(B.LeftForeArm,B.LeftHand,W(D(-.25,h?-.1:.18,1)));}}
const mixers=[];
function makeSoldier(team,variant){const tk=teamKey(team);if(CHAR[tk]&&CHAR[tk].length)return makeSoldierGLB(tk,variant);team=(team==='us'||CHAR_FILES[team]&&/us|ranger|nightjar/.test(team))?'us':'axis';
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
for(let i=0;i<700;i++){const s=new THREE.Sprite(softSprite(new THREE.SpriteMaterial({map:PT.smoke,transparent:true,depthWrite:false}),{noise:.4,hard:.1}));s.visible=false;scene.add(s);PART.pool.push(s);}
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
  msmoke:{tex:'smoke',col:0xb8b4ac,add:0,s0:.06,s1:.55,life:[.5,.9],op:.35,grav:-.6,vel:[.15,.25,.15],drag:2},
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
const pl={pos:new V3(0,0,35.2),vel:new V3(),yaw:0,pitch:0,onG:true,stance:0,eye:1.65,hp:100,lastHurt:-99,ads:0,adsOn:false,sprint:false,cur:0,ws:[],wdef:[],vm:[],reload:0,switchT:0,fireCool:0,nades:4,bob:0,kick:0,melee:0,plant:0,trig:false,lastShot:-9,deaths:0};
const stats={shots:0,hits:0,kills:0,heads:0,start:0,score:0};
const keys={};let mouseL=false,mouseR=false;
const enemies=[],allies=[],nades=[];let hitList=[];
function rebuildHit(){hitList=statics.slice();for(const e of enemies)if(e.alive)hitList.push(...e.s.hit);}

/* ---- viewmodel ---- */
const vmScene=new THREE.Scene();vmScene.environment=scene.environment;const vmCam=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.01,10);vmScene.add(vmCam);
vmScene.add(new THREE.HemisphereLight(0xb4bcc4,0x4a3e30,1.8));{const dl=new THREE.DirectionalLight(0xffcc99,3.2);dl.position.set(-1,2,1.5);vmScene.add(dl);}
const VM=new THREE.Group();vmCam.add(VM);const vms=[];
function vmMat(m){const c=m.clone();c.fog=false;return c;}
const VMMATS={wood:vmMat(MAT.wood),met:vmMat(MAT.gunMetal),skin:vmMat(MAT.skin),sleeve:vmMat(MAT.olive),blued:vmMat(MAT.gunMetal)};VMMATS.sleeve.color.setHex(0x4a4832);VMMATS.blued.color.setHex(0x2e3034);
let LOADOUT={primary:'garand',secondary:'m1911',att:{}};
try{const l=JSON.parse(localStorage.getItem('ir_loadout')||'null');if(l&&WEAPONS[l.primary]&&WEAPONS[l.secondary])LOADOUT=Object.assign(LOADOUT,l);}catch(e){}
function saveLO(){try{localStorage.setItem('ir_loadout',JSON.stringify(LOADOUT))}catch(e){}}
// ---- first-person arms (IK onto the weapon's Grip / SupportHand nodes) ----
let ARMS=null;
function setupArms(src){const wrap=new THREE.Group();wrap.add(src);wrap.scale.set(1.12,1.12,-1.12);wrap.position.set(0,.02,-.12);
  src.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.fog=false;o.castShadow=false;o.receiveShadow=false;o.renderOrder=10;o.frustumCulled=false;}});
  const B={};for(const n of ['RightUpperArm','RightForeArm','RightHand','RightMiddle1','LeftUpperArm','LeftForeArm','LeftHand','LeftMiddle1'])B[n]=src.getObjectByName(n);
  if(!B.RightHand||!B.LeftHand)return;const rest=[];src.traverse(o=>{if(o.isBone)rest.push([o,o.quaternion.clone()]);});
  vmCam.add(wrap);wrap.visible=false;ARMS={wrap,B,rest,root:src};
  // re-equip so guns drop their box hands
  if(pl.wdef[0])for(let s=0;s<2;s++){const w=pl.wdef[s];if(w){const ws=pl.ws[s];equip(s,w.id,w.att,true);pl.ws[s]=ws;}}}
const _fz=v=>v.set(v.x,v.y,-v.z);
function ik2(up,fo,ha,T,pole){const S=up.getWorldPosition(new V3()),E0=fo.getWorldPosition(new V3()),H0=ha.getWorldPosition(new V3());
  const a=S.distanceTo(E0),b=E0.distanceTo(H0);let d=S.distanceTo(T);d=clamp(d,Math.abs(a-b)+1e-3,a+b-1e-3);
  const u=T.clone().sub(S).normalize();const cA=clamp((a*a+d*d-b*b)/(2*a*d),-1,1),sA=Math.sqrt(1-cA*cA);
  const n=pole.clone().sub(u.clone().multiplyScalar(pole.dot(u))).normalize();const E=S.clone().addScaledVector(u,a*cA).addScaledVector(n,a*sA);
  aimBone(up,fo,E.clone().sub(S).normalize());aimBone(fo,ha,S.clone().addScaledVector(u,d).sub(E).normalize());}
const CURL={r:[-.9,-1.0,-.7,-.45],l:[-.8,-.9,-.6,-.4]};window.CURL=CURL;
function curlHand(root,side,c){const i1=root.getObjectByName(side+'Index1'),p1=root.getObjectByName(side+'Pinky1');if(!i1||!p1)return;
  const ax=p1.getWorldPosition(new V3()).sub(i1.getWorldPosition(new V3())).normalize();const sg=c[3]>=0?1:-1;
  for(const f of ['Index','Middle','Ring','Pinky'])for(let j=1;j<=3;j++){const b=root.getObjectByName(side+f+j);if(!b)continue;const ang=(j===1?c[0]:j===2?c[1]:c[2]);
    _q1.setFromAxisAngle(ax,ang*sg);b.parent.getWorldQuaternion(_q2);_q3.copy(_q2).multiply(b.quaternion);_q3.premultiply(_q1);b.quaternion.copy(_q2.invert().multiply(_q3));b.updateMatrixWorld(true);}
  for(let j=1;j<=3;j++){const b=root.getObjectByName(side+'Thumb'+j);if(!b)continue;_q1.setFromAxisAngle(ax,Math.abs(c[3])*sg*.6);b.parent.getWorldQuaternion(_q2);_q3.copy(_q2).multiply(b.quaternion);_q3.premultiply(_q1);b.quaternion.copy(_q2.invert().multiply(_q3));b.updateMatrixWorld(true);}}
function solveArms(){if(!ARMS)return;const g=pl.vm[pl.cur];const ok=state==='play'&&VM.visible&&g&&g.visible&&g.userData.grip;ARMS.wrap.visible=!!ok;if(!ok)return;
  vmCam.updateMatrixWorld(true);const gp=g.userData.grip,sp=g.userData.sup;
  const tR=g.localToWorld(gp.clone().add(new V3(.012,-.03,.075))),tL=g.localToWorld(sp.clone().add(new V3(-.008,-.045,.06)));
  const fwd=new V3(0,-.08,-1).applyQuaternion(VM.quaternion).normalize();
  for(const [o,q] of ARMS.rest)o.quaternion.copy(q);ARMS.wrap.scale.z=1.12;ARMS.wrap.position.z=.12;ARMS.wrap.updateMatrixWorld(true);
  const B=ARMS.B;ik2(B.RightUpperArm,B.RightForeArm,B.RightHand,_fz(tR),_fz(new V3(.9,-1,.35)));
  if(g.userData.pistol){ik2(B.LeftUpperArm,B.LeftForeArm,B.LeftHand,_fz(tR.clone().add(new V3(-.035,-.015,.01))),_fz(new V3(-.8,-1,.3)));}
  else ik2(B.LeftUpperArm,B.LeftForeArm,B.LeftHand,_fz(tL.add(new V3(.025,0,0))),_fz(new V3(-.7,-1,.15)));
  const fz=_fz(fwd.clone());if(B.RightMiddle1)aimBone(B.RightHand,B.RightMiddle1,fz.clone().add(new V3(0,-.25,0)).normalize());if(B.LeftMiddle1)aimBone(B.LeftHand,B.LeftMiddle1,fz.clone().add(new V3(.15,-.1,0)).normalize());
  curlHand(ARMS.root,'Right',CURL.r);curlHand(ARMS.root,'Left',CURL.l);
  ARMS.wrap.scale.z=-1.12;ARMS.wrap.position.z=-.12;}
function vmFromModel(w,src){const g=new THREE.Group();const m=src.clone(true);m.rotation.y=Math.PI;const P=new V3(.012,-.04,-.04);m.position.copy(P);
  m.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.fog=false;o.castShadow=false;o.receiveShadow=false;o.renderOrder=10;}});g.add(m);g.updateMatrixWorld(true);
  const node=n=>{const o=m.getObjectByName(n);return o?o.getWorldPosition(new V3()):null;};const sup=node('SupportHand')||new V3(0,-.02,-.4),muzP=node('Muzzle')||new V3(0,.03,-.8),sr=node('SightRear'),sf=node('SightFront');
  const pistol=w.cls==='pistol';g.userData.grip=node('Grip')||P.clone();g.userData.sup=sup.clone();g.userData.pistol=pistol;const add=(o,x,y,z)=>{o.position.set(x,y,z);if(ARMS&&o.isMesh&&(o.material===VMMATS.skin||o.material===VMMATS.sleeve))return o;g.add(o);return o;};const S1=VMMATS.skin,S2=VMMATS.sleeve;const bx=(a,b,c,mt)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(a,b,c),mt);o.renderOrder=10;return o;};
  add(bx(.045,.055,.065,S1),P.x,P.y-.01,P.z);const rs=add(bx(.068,.068,.3,S2),P.x+.035,P.y-.06,P.z+.16);rs.rotation.set(.3,.15,0);
  if(pistol){add(bx(.04,.05,.07,S1),P.x-.03,P.y-.02,P.z+.005);const ls=add(bx(.06,.06,.3,S2),P.x-.06,P.y-.07,P.z+.16);ls.rotation.set(.3,-.3,0);}
  else{add(bx(.045,.04,.075,S1),sup.x,sup.y-.035,sup.z);const ls=add(bx(.062,.062,.32,S2),sup.x-.05,sup.y-.085,sup.z+.15);ls.rotation.set(.22,-.35,0);}
  if(w.scoped&&sr&&sf){const len=w.att.optic==='scope4'?.3:.2;const c=new THREE.Mesh(new THREE.CylinderGeometry(.019,.019,len,12),VMMATS.blued);c.rotation.x=Math.PI/2;c.renderOrder=10;add(c,0,Math.max(sr.y,sf.y)+.035,(sr.z+sf.z)/2+.08);}
  const mz=new THREE.Object3D();mz.position.copy(muzP);g.add(mz);g.userData.muz=mz;
  const sy=sr&&sf?(sr.y+(w.scoped?.035:0)*0+(sf.y-sr.y)*.5):.05;w.aim=[sr&&sf&&!w.scoped?-(sr.x+sf.x)/2:0,-(w.scoped?Math.max(sr.y,sf.y)+.035:sy),pistol?-.32:-.3];return g;}
function equip(slot,wid,att,full=true){const w=effStats(wid,att);pl.wdef[slot]=w;if(pl.vm[slot])VM.remove(pl.vm[slot]);const g=WMODELS[wid]?vmFromModel(w,WMODELS[wid]):buildGunVM(w,VMMATS);
  if(!WMODELS[wid])loadWeapon(wid).then(()=>{if(WMODELS[wid]&&pl.wdef[slot]&&pl.wdef[slot].id===wid){const ws=pl.ws[slot];equip(slot,wid,att,true);pl.ws[slot]=ws;}});
  if(wid==='mg42'&&PROPS.mg42&&!WMODELS[wid]){g.children.forEach(c=>{if(c.isMesh&&c.material!==VMMATS.skin&&c.material!==VMMATS.sleeve)c.visible=false;});const mm=PROPS.mg42.clone(true);mm.scale.setScalar(.72);mm.position.set(0,-.005,-.56);mm.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.fog=false;o.castShadow=false;o.renderOrder=10;}});g.add(mm);g.userData.muz.position.set(0,.02,-.56-(PROPS.mg42.userData.len||1.2)*.36);}g.visible=slot===pl.cur;VM.add(g);pl.vm[slot]=g;pl.ws[slot]={mag:w.mag,res:full?w.res:w.mag*3};}
const mflash=new THREE.Sprite(softSprite(new THREE.SpriteMaterial({map:PT.flash,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,fog:false}),{noise:.2,hard:.2}));mflash.visible=false;mflash.scale.setScalar(.35);

/* ================= HUD helpers ================= */
let subQ=[],subT=0;
function say(who,text,dur=3.5,id){subQ.push({who,text,dur});playVoice(id||vkey(text));}
function vkey(t){let h=0x811c9dc5;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return 'v'+h.toString(16).padStart(8,'0');}
function updSubs(dt){if(subT>0){subT-=dt;if(subT<=0)$('subs').innerHTML='';}if(subT<=0&&subQ.length){const s=subQ.shift();subT=s.dur;if(S.subs)$('subs').innerHTML=(s.who?`<b>${s.who}:</b> `:'')+s.text;SND.ui();}}
function feed(html){if(!$('feed'))return;const d=document.createElement('div');d.innerHTML=html;$('feed').prepend(d);setTimeout(()=>d.remove(),4000);while($('feed').children.length>5)$('feed').lastChild.remove();}
function xp(t){if(!S.xpPopups)return;const d=document.createElement('div');d.textContent=t;$('xp').appendChild(d);setTimeout(()=>d.remove(),1400);}
let hitmT=0;function hitmark(kill){if(!S.hitmarkers)return;const h=$('hitm');h.className=kill?'kill':'';h.style.opacity=1;hitmT=.25;SND.hit();}
function dmgDir(src){const dx=src.x-pl.pos.x,dz=src.z-pl.pos.z;const ang=Math.atan2(dx,-dz)*180/Math.PI;const bear=-pl.yaw*180/Math.PI;const rel=ang-bear;const d=document.createElement('div');d.className='dd';d.style.transform=`rotate(${rel}deg)`;$('dmgdir').appendChild(d);d.animate([{opacity:1},{opacity:0}],{duration:1400});setTimeout(()=>d.remove(),1400);}
function setObj(txt){$('obj').innerHTML=`<div class="h">OBJECTIVE</div>${txt}`;$('obj').classList.remove('flash');void $('obj').offsetWidth;$('obj').classList.add('flash');$('pobj').textContent='Objective: '+txt.replace(/<[^>]+>/g,'');}

/* ================= COMBAT ================= */
const ray=new THREE.Raycaster();
function terrainHit(o,d,maxD){let prev=0;for(let t=.5;t<maxD;t+=.6){const y=o.y+d.y*t;if(y<H(o.x+d.x*t,o.z+d.z*t)){let a=prev,b=t;for(let k=0;k<6;k++){const m=(a+b)/2;if(o.y+d.y*m<H(o.x+d.x*m,o.z+d.z*m))b=m;else a=m;}return b;}prev=t;}return Infinity;}
function castShot(o,d,maxD,list){ray.set(o,d);ray.far=maxD;const hs=ray.intersectObjects(list,false);const th=terrainHit(o,d,maxD);let h=hs[0];if(h&&h.distance<th)return{dist:h.distance,obj:h.object,point:h.point,n:h.face?h.face.normal.clone().transformDirection(h.object.matrixWorld):null};if(th<Infinity){const pt=o.clone().addScaledVector(d,th);const e=.2;return{dist:th,obj:null,point:pt,terrain:true,n:new V3(H(pt.x-e,pt.z)-H(pt.x+e,pt.z),2*e,H(pt.x,pt.z-e)-H(pt.x,pt.z+e)).normalize()};}return null;}
function blocked(a,b){const d=b.clone().sub(a);const L=d.length();d.normalize();const r=castShot(a,d,L-.3,statics);return !!r;}
function eyePos(){return new V3(pl.pos.x,pl.pos.y+pl.eye,pl.pos.z);}
function camFwd(){const v=new V3();camera.getWorldDirection(v);return v;}
function impact(p,terr,water,n){if(water||p.z>40.3){emit('splash',p,4);SND.splash(p.distanceTo(pl.pos));}else{emit('dust',p,terr?5:3);if(!terr)emit('spark',p,3);if(n)bulletHole(p,n,terr);}}
// ---- bullet hole decals ----
const HOLES=[];let holeI=0;const holeTex=ctex(64,64,(x)=>{const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(10,8,6,.95)');g.addColorStop(.25,'rgba(25,20,15,.85)');g.addColorStop(.5,'rgba(60,50,40,.35)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,64,64);});
const holeMat=softDecal(new THREE.MeshBasicMaterial({map:holeTex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4}),.3);
for(let i=0;i<70;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),holeMat);m.visible=false;scene.add(m);HOLES.push(m);}
function bulletHole(p,n,terr){const m=HOLES[holeI++%HOLES.length];m.visible=true;m.position.copy(p).addScaledVector(n,.012);m.lookAt(p.clone().add(n));m.rotateZ(Math.random()*6.28);m.scale.setScalar(terr?rnd(.18,.3):rnd(.07,.11));}
// ---- shell casings ----
const SHELLS=[];const shellMat=new THREE.MeshStandardMaterial({color:0xb8862f,metalness:.9,roughness:.3});const shellGeo=new THREE.CylinderGeometry(.0055,.0055,.03,6);
for(let i=0;i<36;i++){const m=new THREE.Mesh(shellGeo,shellMat);m.visible=false;scene.add(m);SHELLS.push({m,v:new V3(),life:0,b:0,spin:new V3()});}let shellI=0;
function ejectShell(w){if(w.id==='webley')return;const s=SHELLS[shellI++%SHELLS.length];const right=new V3(Math.cos(pl.yaw),0,-Math.sin(pl.yaw)),f=camFwd();
  const base=TP&&pModel?pModel.muz.getWorldPosition(new V3()).addScaledVector(f,-.45):camera.position.clone().addScaledVector(right,.13).addScaledVector(f,.32).add(new V3(0,-.1,0));
  s.m.position.copy(base);s.v.copy(right).multiplyScalar(rnd(1.6,2.6)).add(new V3(0,rnd(1.8,2.8),0)).addScaledVector(f,rnd(-.4,.2)).add(pl.vel);s.life=4;s.b=0;s.spin.set(rnd(-20,20),rnd(-20,20),rnd(-20,20));s.m.visible=true;
  if(w.cls==='shotgun'){s.m.scale.set(2.2,1.6,2.2);shellMat.color.setHex(0xb8862f);}else s.m.scale.set(1,w.cls==='pistol'||w.cls==='smg'?.7:1,1);}
function updShells(dt){for(const s of SHELLS){if(!s.m.visible)continue;s.life-=dt;if(s.life<=0){s.m.visible=false;continue;}s.v.y-=9.8*dt;s.m.position.addScaledVector(s.v,dt);s.m.rotation.x+=s.spin.x*dt;s.m.rotation.y+=s.spin.y*dt;s.m.rotation.z+=s.spin.z*dt;
  const g=H(s.m.position.x,s.m.position.z)+.01;if(s.m.position.y<g){s.m.position.y=g;if(s.v.y<-1&&s.b<2){s.b++;if(s.m.position.distanceTo(camera.position)<6)SND.clink();}s.v.y*=-.3;s.v.x*=.5;s.v.z*=.5;s.spin.multiplyScalar(.4);}}}

function fire(){
  const w=pl.wdef[pl.cur],ws=pl.ws[pl.cur];
  if(pl.reload>0||pl.switchT>0||pl.fireCool>0||pl.melee>0)return;
  if(ws.mag<=0){SND.click();pl.fireCool=.3;if(ws.res>0)startReload();return;}
  pl.sprint=false;ws.mag--;pl.fireCool=w.rate;stats.shots++;pl.lastShot=time;SND[w.snd]();
  const mw=new V3();if(TP&&pModel){pModel.muz.getWorldPosition(mw);emit('mflash',mw,1);pModel.fireT=.3;}else{const mz=pl.vm[pl.cur].userData.muz;mz.add(mflash);mflash.visible=true;mflash.material.rotation=Math.random()*6;mflash.scale.setScalar(rnd(.25,.45));setTimeout(()=>mflash.visible=false,45);
  mz.getWorldPosition(mw);mw.applyMatrix4(camera.matrixWorld);}emit('msmoke',mw,1);ejectShell(w);muzzleLight.position.copy(mw);muzzleLight.intensity=25;
  const moving=Math.hypot(pl.vel.x,pl.vel.z)>1;const sp=lerp(w.spread*(moving?1.6:1)*(pl.stance?0.7:1),w.ads,pl.ads);
  const o=eyePos();let anyHit=false,killed=false;
  for(let pi=0;pi<(w.pellets||1);pi++){
  let d=camFwd();d.x+=rnd(-sp,sp);d.y+=rnd(-sp,sp);d.z+=rnd(-sp,sp);d.normalize();
  if(TP){const c0=camera.position.clone();const r0=castShot(c0,d,400,hitList);const tg=r0?r0.point:c0.addScaledVector(d,400);d=tg.sub(o).normalize();}
  const r=castShot(o,d,350,hitList);
  const end=r?r.point:o.clone().addScaledVector(d,300);
  if(pi===0&&(w.cls==='smg'||w.cls==='lmg'?Math.random()<.4:true))tracer(mw,end,0xffe2a0);
  if(r){const e=r.obj&&r.obj.userData.enemy;
    if(e&&e.alive){const head=r.obj.userData.part==='head';const fall=clamp(1.15-(r.dist/w.range)*.45,.35,1);e.hp-=w.dmg*(head?(w.cls==='bolt'?3:2.4):1)*fall;if(pi===0)stats.hits++;anyHit=true;emit('blood',r.point,4);
      if(e.hp<=0){killEnemy(e,head,false);killed=true;}else{e.alert=1;e.flinch=1;if(e.s.full)animOnce(e.s,e.boss&&e.s.acts.stagger&&Math.random()<.4?'stagger':'hit',.8);}}
    else impact(r.point,r.terrain,false,r.n);}
  }
  if(anyHit&&!killed)hitmark(false);
  if(w.cls==='bolt'||w.cls==='shotgun')setTimeout(()=>SND.cycle&&SND.cycle(),Math.min(450,w.rate*500));
  pl.pitch+=w.recoil*rnd(.7,1.2)*(pl.ads>.5?.55:1)*(pl.stance===2?.5:1);pl.yaw+=rnd(-1,1)*w.recoil*.35;pl.kick=1;
  if(ws.mag===0&&ws.res>0)setTimeout(()=>{if(state==='play'&&pl.ws[pl.cur]===ws&&ws.mag===0)startReload();},250);
}
function startReload(){const w=pl.wdef[pl.cur],ws=pl.ws[pl.cur];if(pl.reload>0||ws.mag>=w.mag||ws.res<=0||pl.switchT>0)return;pl.reload=w.rl;SND.reload();}
function finishReload(){const w=pl.wdef[pl.cur],ws=pl.ws[pl.cur];const need=w.mag-ws.mag,take=Math.min(need,ws.res);ws.mag+=take;ws.res-=take;if(pl.cur===0&&take>0){}}
function switchW(i){if(i===pl.cur||i<0||i>1||pl.switchT>0)return;pl.reload=0;pl.switchT=.45;pl.next=i;}
function meleeAtk(){if(pl.melee>0)return;pl.melee=.45;SND.knife();const f=camFwd();f.y=0;f.normalize();for(const e of enemies){if(!e.alive)continue;const d=e.pos.clone().sub(pl.pos);d.y=0;if(d.length()<(pl.wdef[pl.cur]&&pl.wdef[pl.cur].bayonet?3.4:2.4)&&d.normalize().dot(f)>.5){killEnemy(e,false,true);emit('blood',e.pos.clone().add(new V3(0,1.3,0)),10);break;}}}
function throwNade(fromEnemy,e){
  const m=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),MAT.helmUS);m.castShadow=true;scene.add(m);let p,v;
  if(fromEnemy){p=e.pos.clone().add(new V3(0,1.6,0));const tgt=pl.pos.clone().add(new V3(rnd(-2.5,2.5),0,rnd(-2.5,2.5)));const d=tgt.sub(p);const fl=Math.hypot(d.x,d.z);const T=clamp(fl/13,.8,2.2);v=new V3(d.x/T,(d.y+9*T*T)/T,d.z/T);}
  else{if(pl.nades<=0)return;pl.nades--;p=eyePos().addScaledVector(camFwd(),.5);v=camFwd().multiplyScalar(17);v.y+=4;}
  m.position.copy(p);nades.push({m,v,fuse:fromEnemy?3.2:3,enemy:fromEnemy});}
function explode(p,big,owner){if(state==='play'){const dd=p.distanceTo(pl.pos);if(dd<(big?16:11))lensDirt=Math.max(lensDirt,clamp(1.3-dd/(big?16:11),0,1));}
  const dist=p.distanceTo(pl.pos);
  if(p.z>40.3&&p.y<.5){emit('bigsplash',p,big?24:14);emit('flash',p.clone().add(new V3(0,1,0)),1);}
  else{emit('flash',p.clone().add(new V3(0,.6,0)),1);emit('fire',p.clone().add(new V3(0,.6,0)),big?16:9);emit('dirt',p,big?22:12);emit('smoke',p.clone().add(new V3(0,1,0)),big?9:5);emit('spark',p,10);}
  flashLight.position.copy(p).add(new V3(0,2,0));flashLight.intensity=big?2500:1200;at(p,()=>SND.boom(dist));if(state==='play'&&dist<(big?40:28)){const k=clamp(1-dist/(big?40:28),0,1);rumble(120+k*380,.3+k*.7);earShock(k*(big?1:.8));}
  if(S.shake)shake=Math.max(shake,clamp(1.2-dist/(big?60:35),0,1));
  if(owner){const R=big?9:7;
    if(dist<R&&state==='play'&&!blocked(p.clone().add(new V3(0,.5,0)),eyePos()))hurt((owner==='enemy'?140*DIFF[S.difficulty].dmg:120)*(1-dist/R),p,true);
    if(owner!=='enemy')damageTanks(p,big);
    if(owner!=='enemy')for(const e of enemies){if(!e.alive)continue;const d=e.pos.distanceTo(p);if(d<R){e.hp-=220*(1-d/R);if(e.hp<=0)killEnemy(e,false,false,true);else hitmark(false);}}}
}
function hurt(dmg,src,raw){if(state!=='play'||!pl.alive)return;const _d=raw?dmg:dmg*DIFF[S.difficulty].dmg;pl.hp-=_d;rumble(clamp(60+_d*5,70,420),clamp(.35+_d/60,.35,1));if(_d>=30)earShock(clamp(_d/90,0,.8));pl.lastHurt=time;dmgDir(src);SND.hurt();if(S.shake)shake=Math.max(shake,.25);if(pl.hp<=0)die();}
function killEnemy(e,head,melee,nade){
  if(!e.alive)return;e.alive=false;e.deathT=0;e.fallDir=Math.random()<.5?1:-1;if(animDie(e.s,head?'dH':nade?'dB':(Math.random()<.55?'dF':'dB')))e.deathT=1;stats.kills++;if(head)stats.heads++;rebuildHit();hitmark(true);
  let pts=100;let tag='';if(head){pts+=50;tag=' <em>(headshot)</em>';if(S.slowmo&&Math.random()<.5)slowT=.45;}if(melee){pts+=50;tag=' <em>(knife)</em>';}if(nade)tag=' <em>(grenade)</em>';stats.score+=pts;
  xp(`+${pts}${head?' HEADSHOT':melee?' MELEE':''}`);feed(`<b>Kane</b> ▸ ${e.type==='mg'?'MG42 Gunner':'Rifleman'}${tag}`);
  if(e.counts&&mission.phase==='trench')mission.kills++;
  if(CUR===1&&e.type==='mg'&&!mission.bunkerDown)setTimeout(()=>{if(!mission.bunkerDown&&state!=='menu')spawnEnemy(BK.x,BK.z+1.6,'mg');},12000);
}
function die(){rumble(650,1);$('dead').querySelector('h1').textContent='K.I.A.';if(pModel&&TP){let t=0;const f=()=>{t+=.06;pModel.rig.rotation.x=-Math.PI/2*ease(Math.min(1,t));pModel.rig.position.y=0;if(t<1)setTimeout(f,16);};f();}pl.alive=false;pl.deaths++;state='dead';exitLock();document.body.classList.remove('play');
  const q=["The beach doesn't care how brave you are. Keep your head down.","Cover is life. Hedgehogs, the tank, the seawall — use them.","Crouched and prone soldiers are much harder to hit.","Grenades clear trenches faster than rifles ever will.","Heads down, keep moving. Standing still in the open gets you killed."];
  $('deadq').textContent=q[Math.floor(Math.random()*q.length)];setTimeout(()=>show('dead'),900);}

/* ================= ENEMIES / ALLIES ================= */
function spawnEnemy(x,z,type='rifle',o={}){
  const s=makeSoldier(o.model||(type!=='mg'&&!o.boss&&CUR>=3&&CHAR.officer&&Math.random()<.07?'officer':'axis'),type==='mg'?0:undefined);if(o.model==='kessler')s.pistol=true;s.g.position.set(x,groundAt(x,z),z);scene.add(s.g);
  const e={s,g:s.g,pos:s.g.position,type,group:o.group,boss:o.boss,name:o.name,hp:(o.hp||(type==='mg'?110:100))*DIFF[S.difficulty].hp*(o.boss?1+(MD()-1)*.4:1+(MD()-1)*.3),alive:true,cool:rnd(1.5,4),stand:0,crouch:o.trench?1:0,trench:!!o.trench,counts:o.counts!==false,target:o.target||null,wid:o.wid||type==='mg'?(o.wid||'mg42'):(()=>{const r=Math.random();return r<.55?'kar98k':r<.8?'mp40':r<.93?'stg44':'g43';})(),lastFire:-9,gren:rnd(8,18),burst:0,burstOn:true,deathT:0,looted:false,run:0};
  if(type==='mg'){e.s.rifle=null;}
  if(s.glb)setSoldierGun(s,e.wid);s.hit.forEach(m=>m.userData.enemy=e);enemies.push(e);rebuildHit();return e;}
function spawnAlly(x,z,tx,tz,delay=0,doomed=false,o={}){const s=makeSoldier(o.model||(CUR!==1&&(CUR===5||CUR===9)&&CHAR.ranger&&Math.random()<.5?'ranger':'us'));if(s.glb)setSoldierGun(s,o.wid||(Math.random()<.65?'garand':'thompson'));if(o.wid==='m1911')s.pistol=true;s.g.position.set(x,Math.max(H(x,z),-.3),z);scene.add(s.g);const a={s,g:s.g,pos:s.g.position,target:new V3(tx,0,tz),delay,doomed,alive:true,deathT:0,cool:rnd(1,3),run:0,crouch:0};allies.push(a);return a;}
const _v=new V3();
function animRun(s,run,dt,spd,crouch){if(s.glb&&s.proc){s._run=run;return;}if(s.glb){if(!s.acts||!s.acts.idle)return;s.fireT=Math.max(0,(s.fireT||0)-dt);animSet(s,dt,run>0?(spd||4):0,crouch??s._crouch??0,s.fireT>0);return;}s.run=(s.run||0)+dt*spd*2.2;const a=Math.sin(s.run)*.75*run;s.legs[0].rotation.x=a;s.legs[1].rotation.x=-a;s.rig.rotation.x=.12*run;}
let nearDrop=null,nearDropD=9;
function tryPickup(){const e=nearDrop;if(!e||state!=='play')return;const nw=WEAPONS[e.wid];let slot=nw.cls==='pistol'?1:pl.cur;if(nw.cls!=='pistol'&&pl.wdef[1].cls==='pistol'&&slot===1)slot=0;
  const old=pl.wdef[slot].id;equip(slot,e.wid,{},false);e.wid=old;if(slot!==pl.cur)switchW(slot);SND.reload();xp('PICKED UP '+nw.name);}
function updProcRigs(dt){const cp=camera.position;for(const e of enemies){const s=e.s;if(!s.proc||!e.alive)continue;if(s.g.position.distanceToSquared(cp)>140*140)continue;poseProc(s,dt,s._run||0,s.proc?(e.crouch||0):0);}
  for(const a of allies){const s=a.s;if(!s.proc||!a.alive)continue;if(s.g.position.distanceToSquared(cp)>140*140)continue;poseProc(s,dt,s._run||0,a.crouch||0);}}
function pointFree(x,z){for(const c of colliders){if(x>c.minx-.4&&x<c.maxx+.4&&z>c.minz-.4&&z<c.maxz+.4&&c.maxy-groundAt(x,z)>.5)return false;}return true;}
function tacticalSpot(e,dist,dx,dz){const ux=dx/(dist||1),uz=dz/(dist||1),px=-uz,pz=ux;const flank=Math.random()<.25+.06*MD();
  for(let k=0;k<4;k++){let fwd,side;if(dist>38){fwd=rnd(6,11);side=rnd(-7,7);}else if(dist<10){fwd=-rnd(4,8);side=rnd(-6,6);}else if(flank){fwd=rnd(2,6);side=(Math.random()<.5?-1:1)*rnd(7,12);}else{fwd=rnd(-2,4);side=(Math.random()<.5?-1:1)*rnd(3,7);}
    const x=e.pos.x+ux*fwd+px*side,z=e.pos.z+uz*fwd+pz*side;if(!pointFree(x,z))continue;const a=e.pos.clone().add(new V3(0,.6,0)),b=new V3(x,groundAt(x,z)+.6,z);if(blocked(a,b))continue;
    if(CUR===1&&(z>-8||z<-80))continue;return new V3(x,0,z);}return null;}
function updEnemies(dt){nearDrop=null;nearDropD=9;
  for(const e of enemies){
    if(!e.alive){if(e.deathT<1&&!e.s.dead){e.deathT+=dt*2.2;e.s.rig.rotation.x=e.fallDir*-Math.PI/2*ease(Math.min(1,e.deathT));e.s.rig.position.y=-.1*Math.min(1,e.deathT);}
      if(state==='play'&&e.wid&&!pl.wdef.some(w=>w.id===e.wid)){const dd=e.pos.distanceTo(pl.pos);if(dd<2.4&&dd<nearDropD){nearDrop=e;nearDropD=dd;}}
      if(!e.looted&&state==='play'&&e.pos.distanceTo(pl.pos)<1.8){e.looted=true;const w=pl.wdef[pl.cur];pl.ws[pl.cur].res=Math.min(pl.ws[pl.cur].res+w.mag*2,w.res*1.5|0);xp('+AMMO');SND.click();}continue;}
    const dx=pl.pos.x-e.pos.x,dz=pl.pos.z-e.pos.z,dist=Math.hypot(dx,dz);
    if(e.target){_v.set(e.target.x-e.pos.x,0,e.target.z-e.pos.z);const L=_v.length();if(L<.6){e.target=null;e.crouch=1;e.trench=true;}else{_v.normalize();e.pos.x+=_v.x*3.6*dt;e.pos.z+=_v.z*3.6*dt;e.pos.y=groundAt(e.pos.x,e.pos.z);e.g.rotation.y=Math.atan2(_v.x,_v.z);animRun(e.s,1,dt,3.6,0);continue;}}
    animRun(e.s,0,dt,0,e.crouch);if(e.flinch>0&&!e.s.full){e.flinch=Math.max(0,e.flinch-dt*5);e.s.rig.rotation.x=-Math.sin(e.flinch*Math.PI)*.22;e.s.rig.rotation.z=Math.sin(e.flinch*Math.PI)*.08;}
    const fy=Math.atan2(dx,dz);e.g.rotation.y+=((fy-e.g.rotation.y+Math.PI*3)%(Math.PI*2)-Math.PI)*Math.min(1,dt*4);
    if(state==='play'&&e.type!=='mg'&&!e.perch&&pl.alive){e.tac=(e.tac??rnd(2,6))-dt*(1+.25*(MD()-1));if(e.flinch>.8&&Math.random()<.02*MD())e.tac=0;
      if(e.tac<=0){e.tac=rnd(3.5,7)/Math.sqrt(MD());const t=tacticalSpot(e,dist,dx,dz);if(t){e.target=t;e.trench=false;e.crouch=0;e.s.rig.position.y=0;continue;}}}
    const range=e.type==='mg'?150:88;e.cool-=dt;
    if(e.trench){const want=(e.cool<.9||e.stand>0)?0:1;e.stand-=dt;e.crouch=lerp(e.crouch,want,Math.min(1,dt*6));e.s.rig.position.y=e.s.full?0:-e.crouch*(e.s.proc?.38:.72);}
    if(e.type==='mg'){e.burst-=dt;if(e.burst<=0){e.burstOn=!e.burstOn;e.burst=e.burstOn?rnd(1.2,2):rnd(.8,1.6);}if(!e.burstOn)continue;}
    if(e.cool<=0&&(state==='play'||state==='cine')){
      {const c=WEAPONS[e.wid].cls;e.cool=(1/(1+.3*(MD()-1)))*e.type==='mg'?.095:(c==='bolt'?rnd(2.2,3.4):c==='smg'?rnd(.35,.6)*(Math.random()<.25?4:1):c==='ar'?rnd(.5,.9)*(Math.random()<.3?3:1):rnd(1.4,2.4))/Math.pow(DIFF[S.difficulty].acc,.3);}e.stand=.6;
      const from=new V3();e.s.muz.getWorldPosition(from);e.s.fireT=e.type==='mg'?.25:.4;if(e.type==='mg'&&!e.s.handBone)from.set(e.pos.x+Math.sin(e.g.rotation.y)*1,e.pos.y+1.45,e.pos.z+Math.cos(e.g.rotation.y)*1);
      const real=state==='play'&&dist<range&&pl.alive;let tgt;
      if(real)tgt=eyePos().add(new V3(0,-.35,0));else tgt=new V3(rnd(-30,30),0,rnd(0,40));if(!real)tgt.y=H(tgt.x,tgt.z);
      if(!real&&e.type!=='mg'&&Math.random()<.6)continue;
      emit('mflash',from,1);e.lastFire=time;if(e.type!=='mg'&&e.s.full&&(e.shots=(e.shots||0)+1)>=({bolt:5,rifle:8,smg:4,ar:4})[WEAPONS[e.wid].cls]&&Math.random()<.7){e.shots=0;if(animOnce(e.s,'reload'))e.cool+=2.4;}
      const los=real&&!blocked(from,tgt);
      const p=(e.type==='mg'?.065:.24)*DIFF[S.difficulty].acc*(.85+.3*(MD()-1))*clamp(1.25-dist/70,.07,1)*(pl.stance===1?.6:pl.stance===2?.4:1)*(pl.sprint?.7:1);
      const hit=los&&Math.random()<p;let end=tgt.clone();
      if(!hit){end.add(new V3(rnd(-2,2),rnd(-1.2,1.5),rnd(-2,2)));const d=end.clone().sub(from).normalize();const r=castShot(from,d,dist+30,statics);end=r?r.point:from.clone().addScaledVector(d,dist+30);if(r)impact(r.point,r.terrain);
        if(real&&los&&Math.random()<.35){SND.whiz();}}
      tracer(from,end,e.type==='mg'?0xffb060:0xffd27a);
      at(from,()=>{if(e.type==='mg')SND.mg(dist);else SND.eRifle(dist);});
      if(hit)hurt((e.type==='mg'?10:({bolt:34,rifle:20,smg:9,ar:12})[WEAPONS[e.wid].cls]||18)*(.9+.35*(MD()-1))*(e.boss?1.4:1),e.pos);
    }
    if(e.type!=='mg'&&state==='play'&&dist<30&&dist>9&&pl.alive){e.gren-=dt*(1+.35*(MD()-1));if(e.gren<=0){e.gren=rnd(14,24);if(e.s.full)animOnce(e.s,'throw');setTimeout(()=>{if(e.alive)throwNade(true,e);},e.s.full?600:0);}}
  }
}
function updAllies(dt){for(const a of allies){
  if(!a.alive){if(!a.s.dead&&a.s.full)animDie(a.s,Math.random()<.5?'dF':'dB');if(a.deathT<1&&!a.s.dead){a.deathT+=dt*2;a.s.rig.rotation.x=-Math.PI/2*ease(Math.min(1,a.deathT));}continue;}
  if(a.delay>0){a.delay-=dt;continue;}
  if(a.hero&&state==='play'){const d=a.pos.distanceTo(pl.pos);if(d>45){a.pos.set(pl.pos.x+2,groundAt(pl.pos.x+2,pl.pos.z+2),pl.pos.z+2);a.target=null;}else if(d>8&&!a.target){a.target=new V3(pl.pos.x+rnd(-3,3),0,pl.pos.z+rnd(-3,3));a.crouch=0;}}
  if(a.target){_v.set(a.target.x-a.pos.x,0,a.target.z-a.pos.z);const L=_v.length();if(L<.6){a.target=null;a.crouch=1;}else{_v.normalize();const sp=a.pos.z>39?3:4.6;a.pos.x+=_v.x*sp*dt;a.pos.z+=_v.z*sp*dt;a.pos.y=Math.max(groundAt(a.pos.x,a.pos.z),-.35);a.g.rotation.y=Math.atan2(_v.x,_v.z);animRun(a.s,1,dt,sp,0);a.s.rig.position.y=0;
    if(a.doomed&&a.pos.z<a.doomed){a.alive=false;explode(a.pos.clone(),false,null);}continue;}}
  animRun(a.s,0,dt,0,a.crouch);a.s.rig.position.y=a.s.full?0:lerp(a.s.rig.position.y,-a.crouch*(a.s.proc?.38:.65),dt*5);
  a.cool-=dt;const tg=enemies.find(e=>e.alive&&e.pos.distanceTo(a.pos)<90);
  if(tg){a.g.rotation.y=Math.atan2(tg.pos.x-a.pos.x,tg.pos.z-a.pos.z);if(a.cool<=0){a.cool=rnd(1.5,3.5);if(!a.s.full)a.s.rig.position.y=0;a.s.fireT=.4;const f=new V3();a.s.muz.getWorldPosition(f);const t=tg.pos.clone().add(new V3(rnd(-1.5,1.5),rnd(.5,2.5),rnd(-1.5,1.5)));tracer(f,t);emit('mflash',f,1);at(f,()=>SND.eRifle(a.pos.distanceTo(pl.pos)));
    if(Math.random()<.035&&!(mission.phase==='trench'&&tg.counts&&mission.kills>=mission.need-2)){killEnemy(tg,false,false);stats.kills--;stats.score-=100;}}}
}}
function updNades(dt){for(let i=nades.length-1;i>=0;i--){const n=nades[i];n.fuse-=dt;n.v.y-=18*dt;n.m.position.addScaledVector(n.v,dt);const p=n.m.position;const g=H(p.x,p.z)+.07;
  if(p.y<g){p.y=g;n.v.y*=-.3;n.v.x*=.55;n.v.z*=.55;}
  for(const c of colliders){if(p.x>c.minx&&p.x<c.maxx&&p.z>c.minz&&p.z<c.maxz&&p.y<c.maxy&&p.y>c.miny){n.v.x*=-.4;n.v.z*=-.4;p.addScaledVector(n.v,dt*2);break;}}
  if(n.fuse<=0){explode(p.clone(),false,n.enemy?'enemy':'player');scene.remove(n.m);nades.splice(i,1);
    if(!n.enemy&&!mission.bunkerDown&&Math.hypot(p.x-BK.x,p.z-BK.z)<4.5)for(const e of enemies)if(e.alive&&e.type==='mg')killEnemy(e,false,false,true);}}}

/* ================= MISSION ================= */
const artQ=[];const mission={phase:'none',kills:0,need:0,cp:null,bunkerDown:false,timer:0,art:3};
function clearDynamic(){mixers.length=0;if(pModel&&pModel.mixer)mixers.push(pModel.mixer);for(const e of enemies)scene.remove(e.g);enemies.length=0;for(const a of allies)scene.remove(a.g);allies.length=0;for(const n of nades)scene.remove(n.m);nades.length=0;rebuildHit();}
function resetPlayer(pos,yaw){pl.pos.copy(pos);pl.pos.y=H(pos.x,pos.z);pl.vel.set(0,0,0);pl.yaw=yaw;pl.pitch=0;pl.hp=100;pl.alive=true;pl.stance=0;pl.eye=1.65;pl.ads=0;pl.adsOn=false;pl.reload=0;pl.switchT=0;pl.plant=0;
  pl.cur=0;equip(0,LOADOUT.primary,LOADOUT.att[LOADOUT.primary]);equip(1,LOADOUT.secondary,LOADOUT.att[LOADOUT.secondary]);pl.nades=4;}
function setupMission(){clearDynamic();
  mission.phase='intro';mission.kills=0;mission.bunkerDown=false;mission.timer=0;mission.cp={pos:new V3(0,0,35.2),yaw:0,phase:"beach"};
  const T=[[-30,-47],[-21,-47.5],[-12,-47],[-3,-47.2],[12,-47.3],[21,-47],[30,-47.5],[38,-47],[-8,-35],[15,-33]];
  T.forEach(([x,z],i)=>spawnEnemy(x,z,'rifle',{trench:true}));mission.need=T.length;
  spawnEnemy(BK.x,BK.z+1.6,'mg',{counts:false});
  // boat dummies
  myBoat.userData.dummies=[];for(let i=0;i<6;i++){const s=makeSoldier('us');s.g.position.set(i%2?.8:-.8,.2,-2.6+Math.floor(i/2)*1.5);myBoat.add(s.g);myBoat.userData.dummies.push(s.g);if(s.glb){setSoldierGun(s,'garand');s.g.rotation.y=Math.PI;if(s.proc){s.rig.position.y=-.3;myBoat.updateMatrixWorld(true);poseProc(s,0,0,.55);}}else s.rig.position.y=-.45;}
  myBoat.userData.ramp.rotation.x=0;
  stats.shots=stats.hits=stats.kills=stats.heads=stats.score=0;pl.deaths=0;
}
function startGameplay(){
  if(myBoat.userData.dummies){myBoat.userData.dummies.forEach(d=>myBoat.remove(d));myBoat.userData.dummies=null;}
  myBoat.position.z=44.5;myBoat.userData.ramp.rotation.x=-1.35;
  resetPlayer(new V3(0,0,35.2),0);
  const tg=[[-9,-11.8],[-4,-11.8],[4,-11.8],[9,-11.8],[14,-11.8],[-14,-11.8]];
  tg.forEach(([x,z],i)=>spawnAlly((i%2?1:-1)*rnd(1.6,2.8),40.5+i*.6,x,z,i*.35,i===2?24:i===4?8:0));
  for(let i=0;i<5;i++)spawnAlly(-20+rnd(-1,1),46+i,-24+i*3,-11.8,i*.5+1,i===1?16:0);
  for(let i=0;i<5;i++)spawnAlly(22+rnd(-1,1),45+i,20+i*3,-11.8,i*.5+1.5,i===3?20:0);
  mission.phase='beach';setObj('Get off the beach — reach the <b>seawall</b>');stats.start=time;
  say('LT. HAYES (radio)','Kane! Get your men across the sand — the seawall, now!',3.5);say('SGT. MILLER','Use the hedgehogs for cover! Move, move!',3);
  enterPlay();
}
function objTarget(){if(CUR!==1)return lvTarget();if(mission.phase==='beach')return new V3(0,H(0,-12.5)+1,-12.5);if(mission.phase==='trench'){const e=enemies.find(e=>e.alive&&e.counts);return e?e.pos.clone().add(new V3(0,2,0)):new V3(0,10,-46);}if(mission.phase==='bunker')return new V3(BK.x,H(BK.x,BK.z-4.2)+1.2,BK.z-4.2);if(mission.phase==='clear')return null;return null;}
function updMission(dt){if(CUR!==1){if(LV)updLevel(dt);return;}
  // artillery
  mission.art-=dt;if(mission.art<=0&&mission.phase!=='end'){mission.art=mission.phase==='beach'||mission.phase==='intro'?rnd(1.8,4):rnd(5,9);let p;for(let k=0;k<8;k++){p=new V3(rnd(-55,55),0,rnd(-8,70));if(p.distanceTo(pl.pos)>11)break;}p.y=Math.max(H(p.x,p.z),0);artQ.push({p,t:1.1,big:Math.random()<.4});SND.whistle(p.distanceTo(pl.pos));}
  for(let i=artQ.length-1;i>=0;i--){const a=artQ[i];a.t-=dt;if(a.t<=0){explode(a.p,a.big,null);artQ.splice(i,1);}}
  mission.amb=(mission.amb||0)-dt;if(mission.amb<=0){mission.amb=rnd(.6,2.6);const d=rnd(140,320);if(Math.random()<.55){const n=(rnd(4,11))|0;for(let k=0;k<n;k++)setTimeout(()=>SND.mg(d),k*rnd(70,95));}else SND.eRifle(d);}
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
function missionComplete(){PROGRESS.done[CUR]=1;saveProgress();renderMissions();const nx=LEVELS[CUR+1];$('nextTxt').innerHTML=nx?`NEXT: Mission ${CUR+1} — ${nx.title}`:'Campaign complete';$('nextBtn').style.display=nx?'':'none';state='complete';document.body.classList.remove('play','cine');exitLock();
  const t=Math.round((stats.endT||time)-stats.start);const acc=stats.shots?Math.round(stats.hits/stats.shots*100):0;const sc=stats.score+acc*10;
  $('stats').innerHTML=`<span>Time</span><span>${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}</span><span>Enemies killed</span><span>${stats.kills}</span><span>Headshots</span><span>${stats.heads}</span><span>Accuracy</span><span>${acc}%</span><span>Deaths</span><span>${pl.deaths}</span><span>Difficulty</span><span>${S.difficulty.toUpperCase()}</span><span><b>SCORE</b></span><span><b>${sc}</b></span>`;show('complete');}
function restartCP(){$('dead').querySelector('h1').textContent='K.I.A.';if(CUR!==1){levelRestart();return;}hideAll();const cp=mission.cp;resetPlayer(cp.pos,cp.yaw);pl.alive=true;
  if(cp.phase==='bunker'){mission.phase='bunker';setObj('Plant a charge on the <b>MG42 bunker</b>');}else if(cp.phase==='trench'){mission.phase='trench';}else{mission.phase='beach';setObj('Get off the beach — reach the <b>seawall</b>');}
  for(const n of nades)scene.remove(n.m);nades.length=0;enterPlay();}

/* ================= CINEMATICS ================= */
let cine=null;
function playCine(shots,done){if(pModel)pModel.g.visible=false;cine={shots,i:0,t:0,done,fired:{}};state='cine';exitLock();document.body.classList.add('cine');document.body.classList.remove('play');musicDuck=1;applyVolumes();VM.visible=false;subQ=[];subT=0;$('subs').innerHTML='';if(shots[0].start)shots[0].start();}
function endCine(skip){if(!cine)return;const d=cine.done;const sh=cine.shots;if(skip){for(let i=cine.i;i<sh.length;i++){if(i>cine.i&&sh[i].start)sh[i].start();if(sh[i].end)sh[i].end();}}cine=null;document.body.classList.remove('cine');$('title').style.opacity=0;subQ=[];subT=0;$('subs').innerHTML='';VM.visible=true;d&&d();}
function updCine(dt){const sh=cine.shots[cine.i];cine.t+=dt;const k=clamp(cine.t/sh.dur,0,1);
  if(sh.cam){const r=sh.cam(k,cine.t);camera.position.copy(r.p);camera.lookAt(r.l);}
  if(sh.subs)sh.subs.forEach((s,j)=>{const key=cine.i+'_'+j;if(!cine.fired[key]&&cine.t>=s[0]){cine.fired[key]=1;say(s[1],s[2],s[3]||3,s[4]);}});
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
addEventListener('wheel',e=>{if(state==='play')switchW((pl.cur+1)%2);});
addEventListener('keydown',e=>{keys[e.code]=true;
  if(state==='cine'&&(e.code==='Enter'||e.code==='Escape'||e.code==='Space')){endCine(true);return;}
  if(e.code==='Escape'||e.code==='KeyP'){if(state==='play')pauseGame();else if(state==='pause')resume();return;}
  if(state!=='play')return;
  if(e.code==='KeyR')startReload();if(e.code==='Digit1')switchW(0);if(e.code==='Digit2')switchW(1);if(e.code==='KeyF')tryPickup();if(e.code==='KeyB')toggleCam();
  if(e.code==='KeyG')throwNade(false);if(e.code==='KeyV')meleeAtk();
  if(e.code==='Space'&&pl.onG){if(pl.stance)pl.stance=0;else{pl.vel.y=5.2;pl.onG=false;}}
  if(e.code==='KeyC'||e.code==='ControlLeft'){pl.stance=pl.stance===1?0:1;}
  if(e.code==='KeyZ'){pl.stance=pl.stance===2?0:2;}
  if(e.code==='KeyQ'){switchW((pl.cur+1)%2);}
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
tbtn('tReload',()=>startReload());tbtn('tNade',()=>throwNade(false));tbtn('tMelee',()=>meleeAtk());tbtn('tSwap',()=>switchW((pl.cur+1)%2));tbtn('tPick',()=>tryPickup());tbtn('tCam',()=>toggleCam());
tbtn('tAct',()=>{tState.act=true;},()=>{tState.act=false;});
tbtn('tPause',()=>pauseGame());
tbtn('tSprint',()=>{tState.sprint=!tState.sprint;$('tSprint').classList.toggle('act',tState.sprint);});
function aimAssist(){let best=null,ba=.16;const o=eyePos(),f=camFwd();for(const e of enemies){if(!e.alive)continue;const tp=e.pos.clone().add(new V3(0,1.3-(e.crouch||0)*.7,0));const d=tp.clone().sub(o);const L=d.length();if(L>70)continue;d.normalize();const a=Math.acos(clamp(d.dot(f),-1,1));if(a<ba&&!blocked(o,tp)){ba=a;best=d;}}
  if(best){pl.aaT={yaw:Math.atan2(-best.x,-best.z),pitch:Math.asin(best.y),t:.15};}}

/* ================= THIRD-PERSON (CINEMATIC) CAMERA ================= */
let TP=false,pModel=null;const tpCam={pos:new V3(),init:false};
function ensurePlayerModel(){if(pModel)return pModel;if(!CHAR.us||!CHAR.us.length)return null;pModel=makeSoldier('us',0);scene.add(pModel.g);pModel.g.visible=false;return pModel;}
function updPlayerModel(dt,hs){const s=pModel;s.g.position.copy(pl.pos);s.g.rotation.y=pl.yaw+Math.PI;
  const wid=pl.wdef[pl.cur].id;if(s.wid!==wid){setSoldierGun(s,wid);s.wid=wid;}
  s.pose=pl.stance===2&&s.full?'prone':null;s.pistol=WEAPONS[wid].cls==='pistol';
  if(s.full){if(pl.reload>0&&!(s._rl>0))animOnce(s,'reload');if(pl.melee>0&&!(s._ml>0))animOnce(s,'melee');if(pl.nades<(s._nd??pl.nades))animOnce(s,'throw');}s._rl=pl.reload;s._ml=pl.melee;s._nd=pl.nades;
  animRun(s,hs>.3?1:0,dt,hs,pl.stance===1?1:0);
  const ty=s.full?0:pl.stance===2?.16:pl.stance===1?-.12:0,tr=s.full?0:pl.stance===2?1.42:pl.stance===1?.22:0;s.rig.position.y=lerp(s.rig.position.y,ty,Math.min(1,dt*8));s.rig.rotation.x=lerp(s.rig.rotation.x,tr,Math.min(1,dt*8));
  if(s.spine){s.g.updateMatrixWorld(true);const ax=new V3(Math.cos(pl.yaw),0,-Math.sin(pl.yaw));_q1.setFromAxisAngle(ax,clamp(pl.pitch,-1,1)*.75*(pl.stance===2?.3:1));s.spine.parent.getWorldQuaternion(_q2);_q3.copy(_q2).multiply(s.spine.quaternion);_q3.premultiply(_q1);s.spine.quaternion.copy(_q2.invert().multiply(_q3));}}
function tpCamera(dt,sk,hs){const a=pl.ads;const back=lerp(pl.stance===2?2.3:3.0,1.45,a),side=lerp(.6,.48,a),up=lerp(pl.stance===2?.15:.3,.16,a);
  const eye=new V3(pl.pos.x,pl.pos.y+pl.eye+.04,pl.pos.z);const cp=Math.cos(pl.pitch);
  const fwd=new V3(-Math.sin(pl.yaw)*cp,Math.sin(pl.pitch),-Math.cos(pl.yaw)*cp),right=new V3(Math.cos(pl.yaw),0,-Math.sin(pl.yaw));
  let want=eye.clone().addScaledVector(right,side).add(new V3(0,up,0)).addScaledVector(fwd,-back);
  const dir=want.clone().sub(eye);const L=dir.length();dir.normalize();const hit=castShot(eye,dir,L+.3,statics);
  if(hit)want=eye.clone().addScaledVector(dir,Math.max(.25,hit.dist-.3));const gh=H(want.x,want.z)+.2;if(want.y<gh)want.y=gh;
  if(!tpCam.init){tpCam.pos.copy(want);tpCam.init=true;}
  if(hit)tpCam.pos.copy(want);else tpCam.pos.lerp(want,1-Math.exp(-dt*(a>.5?24:11)));
  camera.position.copy(tpCam.pos).add(new V3(rnd(-sk,sk),rnd(-sk,sk)*.6,0));
  const strafe=right.dot(pl.vel)/7;pl.tpRoll=lerp(pl.tpRoll||0,-strafe*.03,Math.min(1,dt*4));
  camera.rotation.set(pl.pitch+pl.kick*.014,pl.yaw,pl.tpRoll+Math.sin(pl.bob)*.003*Math.min(1,hs/4));}
function toggleCam(){S.camMode=S.camMode==='cinematic'?'first-person':'cinematic';saveS();xp(S.camMode==='cinematic'?'CINEMATIC CAMERA':'FIRST-PERSON');}

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
  const cw=pl.wdef[pl.cur];pl.ads=lerp(pl.ads,(adsWant&&!pl.sprint&&pl.switchT<=0&&pl.reload<=0)?1:0,Math.min(1,dt*12/((cw.adsTime||1)*(cw.cls==='lmg'?1.4:cw.cls==='bolt'?1.2:1))));
  if(pl.aaT){pl.aaT.t-=dt;const k=Math.min(1,dt*14);pl.yaw+=((pl.aaT.yaw-pl.yaw+Math.PI*3)%(Math.PI*2)-Math.PI)*k;pl.pitch=lerp(pl.pitch,pl.aaT.pitch,k);if(pl.aaT.t<=0)pl.aaT=null;}
  let sp=pl.sprint?7:pl.stance===1?2.4:pl.stance===2?1.1:4.4;sp*=lerp(1,.55,pl.ads)*cw.mob;if(pl.pos.z>39)sp*=.65;
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
  if(LV&&LV.colMeshes&&LV.colMeshes.length)ground=meshCollidePlayer(R,hgt,ground,dt);
  for(const e of enemies){if(!e.alive)continue;const dx=pl.pos.x-e.pos.x,dz=pl.pos.z-e.pos.z,d=Math.hypot(dx,dz);if(d<.7&&d>0){pl.pos.x+=dx/d*(.7-d);pl.pos.z+=dz/d*(.7-d);}}
  if(pl.pos.y<=ground){if(!pl.onG&&pl.vel.y<-4){pl.land=1;SND.step(false);SND.step(false);}pl.pos.y=ground;pl.vel.y=0;pl.onG=true;}else if(pl.pos.y-ground>.3)pl.onG=false;else if(pl.vel.y<=0){pl.pos.y=ground;pl.vel.y=0;pl.onG=true;}
  if(CUR===1){pl.pos.x=clamp(pl.pos.x,-75,75);pl.pos.z=clamp(pl.pos.z,-82,42);}else{pl.pos.x=clamp(pl.pos.x,-135,135);pl.pos.z=clamp(pl.pos.z,-135,135);}
  const hs=Math.hypot(pl.vel.x,pl.vel.z);if(pl.pos.z>39.5&&hs>1&&Math.random()<dt*8)emit('splash',pl.pos.clone().add(new V3(0,.1,0)),1);
  pl.eye=lerp(pl.eye,[1.65,1.05,.45][pl.stance],Math.min(1,dt*10));
  pl.pitch=clamp(pl.pitch,-1.45,1.45);
  // weapons
  pl.fireCool-=dt;pl.kick=Math.max(0,pl.kick-dt*9);if(pl.melee>0)pl.melee-=dt;
  if(pl.reload>0){pl.reload-=dt;if(pl.reload<=0)finishReload();}
  if(pl.switchT>0){const prev=pl.switchT;pl.switchT-=dt;if(prev>.22&&pl.switchT<=.22){pl.cur=pl.next;pl.vm.forEach((v,i)=>v.visible=i===pl.cur);}}
  const w=pl.wdef[pl.cur];if((firing&&w.auto)||pl.trig){if(pl.fireCool<=0||!pl.trig)fire();if(pl.fireCool>0&&pl.trig&&!firing){pl.trigQ=.25;}}if(pl.trigQ>0){pl.trigQ-=dt;if(pl.fireCool<=0){fire();pl.trigQ=0;}}pl.trig=false;
  if(time-pl.lastHurt>4+(MD()-1)*1.4&&pl.hp<100)pl.hp=Math.min(100,pl.hp+28/MD()*dt);
  muzzleLight.intensity*=Math.exp(-dt*35);
  {const sc=cw.scoped&&pl.ads>.85;TP=S.camMode==='cinematic'&&!(cw.scoped&&pl.ads>.5)&&!!ensurePlayerModel();if(pModel){pModel.g.visible=TP;if(TP)updPlayerModel(dt,Math.hypot(pl.vel.x,pl.vel.z));}$('scope').style.display=sc?'block':'none';VM.visible=!sc&&!TP;if(sc&&pl.stance!==2){pl.yaw+=Math.sin(time*1.3)*.00035;pl.pitch+=Math.cos(time*1.7)*.00025;}}
  // camera
  if(pl.onG&&hs>.5){const ob=pl.bob;pl.bob+=dt*hs*1.7;if(Math.floor(ob/Math.PI)!==Math.floor(pl.bob/Math.PI)&&pl.stance!==2)SND.step(pl.pos.z>39.3);}
  const bobA=(pl.sprint?.07:.04)*(1-pl.ads*.85)*Math.min(1,hs/4);
  shake=Math.max(0,shake-dt*1.4);const sk=shake*shake*.25;
  pl.land=Math.max(0,(pl.land||0)-dt*4);
  if(!TP){tpCam.init=false;camera.position.set(pl.pos.x+rnd(-sk,sk),pl.pos.y+pl.eye+Math.sin(pl.bob*2)*bobA+rnd(-sk,sk)-Math.sin(pl.land*Math.PI)*.07,pl.pos.z);
  camera.rotation.set(pl.pitch+pl.kick*.012+rnd(-sk,sk)*.1,pl.yaw,Math.sin(pl.bob)*bobA*.15);}else tpCamera(dt,sk,hs);
  let fov=S.fov/lerp(1,TP?1+(w.zoom-1)*.5:w.zoom,pl.ads);if(TP&&pl.sprint)fov+=7;fov=TP?lerp(camera.fov,fov,Math.min(1,dt*8)):fov;if(Math.abs(camera.fov-fov)>.01){camera.fov=fov;camera.updateProjectionMatrix();}
  // viewmodel
  const hp=w.hip,ap=w.aim,a=pl.ads;let vx=lerp(hp[0],ap[0],a),vy=lerp(hp[1],ap[1],a),vz=lerp(hp[2],ap[2],a);
  vx+=Math.cos(pl.bob)*bobA*.3;vy+=Math.abs(Math.sin(pl.bob))*bobA*.25;vz+=pl.kick*.06;
  let rx=0,ry=0,rz=0;if(pl.sprint){rx=-.5;ry=.7;vx+=.05;vy-=.05;}
  if(pl.reload>0){const k=Math.sin(clamp(1-pl.reload/w.rl,0,1)*Math.PI);rx-=k*.6;rz+=k*.4;vy-=k*.08;}
  if(pl.switchT>0){const k=Math.sin((1-pl.switchT/.45)*Math.PI);vy-=k*.35;rx-=k*.6;}
  if(pl.melee>0){const k=Math.sin((1-pl.melee/.45)*Math.PI);vx-=k*.15;vz-=k*.25;ry+=k*.8;}
  const dyw=((pl.yaw-(pl.lyaw??pl.yaw)+Math.PI*3)%(Math.PI*2))-Math.PI,dpt=pl.pitch-(pl.lpit??pl.pitch);pl.lyaw=pl.yaw;pl.lpit=pl.pitch;const swK=(1-pl.ads*.75);
  pl.swx=lerp(pl.swx||0,clamp(dyw*1.6,-.05,.05)*swK,Math.min(1,dt*9));pl.swy=lerp(pl.swy||0,clamp(-dpt*1.6,-.04,.04)*swK,Math.min(1,dt*9));vx+=pl.swx;vy+=pl.swy;ry+=pl.swx*4;rx+=pl.swy*3;
  VM.position.lerp(new V3(vx,vy,vz),Math.min(1,dt*18));VM.rotation.set(lerp(VM.rotation.x,rx+pl.kick*.08,dt*14),lerp(VM.rotation.y,ry,dt*12),lerp(VM.rotation.z,rz,dt*12));
}

/* ================= HUD UPDATE ================= */
const cctx=$('compass').getContext('2d'),mctx=$('mini').getContext('2d');
function updHUD(dt){
  const w=pl.wdef[pl.cur],ws=pl.ws[pl.cur];
  $('wname').textContent=w.name;$('mag').innerHTML=`${ws.mag}<small> / ${ws.res}</small>`;$('nades').textContent='● '.repeat(pl.nades).trim()||'—';
  $('ammo').classList.toggle('low',ws.mag<=Math.ceil(w.mag*.25));
  $('reloadTxt').style.display=pl.reload>0?'block':(ws.mag===0&&ws.res===0?'block':'none');if(ws.mag===0&&ws.res===0&&pl.reload<=0)$('reloadTxt').textContent='NO AMMO — SWAP WEAPON';else $('reloadTxt').textContent='RELOADING';
  const moving=Math.hypot(pl.vel.x,pl.vel.z);const spr=(4+w.spread*260+moving*2.2+pl.kick*14)*(pl.stance?0.75:1);const xh=$('xh');xh.style.opacity=(S.crosshair&&(TP||pl.ads<.4)&&!pl.sprint)?1:0;
  xh.children[0].style.top=(-spr-9)+'px';xh.children[1].style.top=spr+'px';xh.children[2].style.left=(-spr-9)+'px';xh.children[3].style.left=spr+'px';
  if(hitmT>0){hitmT-=dt;$('hitm').style.opacity=clamp(hitmT*5,0,1);}
  $('blood').style.opacity=Math.pow(1-pl.hp/100,1.4)*1.1;lensDirt=Math.max(0,lensDirt-dt*.35);$('dirt').style.opacity=lensDirt;
  if(pl.hp<35&&pl.alive){pl.hb=(pl.hb||0)-dt;if(pl.hb<=0){pl.hb=.55+pl.hp/60;SND.heart();}}
  {const pk=$('pick');if(nearDrop){pk.style.display='block';pk.innerHTML=(isTouch?'Tap <kbd>PICK UP</kbd>':'Press <kbd>F</kbd>')+' to swap for <b>'+WEAPONS[nearDrop.wid].name+'</b>';}else pk.style.display='none';$('tPick').style.display=nearDrop&&isTouch?'flex':'none';}
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
  let [ax,az]=P(-200,40.5);if(CUR===1){m.fillStyle='rgba(60,90,110,.6)';m.fillRect(ax,az,400*sc,200*sc);}m.fillStyle='rgba(150,150,140,.7)';for(const c of colliders){const[a1,b1]=P(c.minx,c.minz);m.fillRect(a1,b1,Math.max(1.5,(c.maxx-c.minx)*sc),Math.max(1.5,(c.maxz-c.minz)*sc));}
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
const screens=['choice','credits','loadout','menu','missions','briefing','settings','controls','pause','dead','complete','loading'];
let settingsFrom='menu';
function show(id){screens.forEach(s=>$(s).classList.toggle('on',s===id));}
function hideAll(){screens.forEach(s=>$(s).classList.remove('on'));}
let SELECTED=1;
function renderMissions(){$('mislist').innerHTML=Object.keys(LEVELS).map(Number).sort((a,b)=>a-b).map(n=>{const L=LEVELS[n];return `<div class="mis" data-m="${n}"><div class="n">${n}</div><div class="d"><b>${L.title}</b><small>${L.place} · ${L.date}</small></div><div>${PROGRESS.done[n]?'✓':'▸'}</div></div>`;}).join('');}
$('mislist').addEventListener('click',e=>{const d=e.target.closest('.mis');if(!d)return;SND.ui();SELECTED=+d.dataset.m;briefing();});
const BRIEF1=['Allied forces are landing across five beaches along the Normandy coast. Your company of the 2nd Rangers has been assigned Sector Dog Green, Omaha.','The naval bombardment has failed to destroy the German positions on the bluffs. An MG42 bunker is covering the draw — the only way off the beach.','Your orders: get off the sand, clear the trench line, and silence that gun. If it keeps firing, the second wave dies in the surf.'];
let briefTok=0;
function briefing(){show('briefing');const L=LEVELS[SELECTED];const BRIEF=SELECTED===1?BRIEF1:L.brief;$('briefing').querySelector('h3').textContent=`MISSION ${SELECTED} — ${L.title}`;$('briefing').querySelector('p').textContent=`${L.date.toUpperCase()} · ${L.place.toUpperCase()}`;
  $('bobj').innerHTML=SELECTED===1?'<li>Get off the beach — reach the seawall</li><li>Clear the German trench line on the bluff</li><li>Destroy the MG42 bunker covering the draw</li>':L.objectives.filter(o=>o.text&&o.type!=='choice').map(o=>`<li>${o.text}</li>`).join('');
  const tok=++briefTok;const el=$('btext');el.innerHTML=BRIEF.map(()=>'<p></p>').join('');$('bobj').style.display='none';let pi=0,ci=0;const ps=[...el.children];
  const tick=()=>{if(tok!==briefTok)return;if(pi>=ps.length){$('bobj').style.display='block';return;}ps[pi].textContent=BRIEF[pi].slice(0,ci+=2);if(ci%6===0)SND.click();if(ci>=BRIEF[pi].length){pi++;ci=0;setTimeout(tick,300);}else setTimeout(tick,14);};tick();}
function deploy(){briefTok++;show('loading');$('lbar').style.width='0';setTimeout(()=>$('lbar').style.width='60%',50);setTimeout(()=>{$('lbar').style.width='100%';},500);
  if(SELECTED!==1){const tok=briefTok;ensureLevelAssets(SELECTED,f=>{$('lbar').style.width=(20+f*78)+'%';}).then(()=>setTimeout(()=>{if(tok!==briefTok)return;hideAll();startLevel(SELECTED);},250));return;}
  setTimeout(()=>{hideAll();switchWorld(1);setupMission();playCine(introCine(),startGameplay);},1000);}
function enterPlay(){hideAll();state='play';document.body.classList.add('play');document.body.classList.remove('cine');musicDuck=.3;applyVolumes();VM.visible=true;camera.fov=S.fov;camera.updateProjectionMatrix();if(!isTouch)reqLock();}
function pauseGame(){if(state!=='play')return;state='pause';exitLock();document.body.classList.remove('play');show('pause');mouseL=mouseR=false;tState.fire=false;}
function resume(){hideAll();state='play';document.body.classList.add('play');if(!isTouch)reqLock();}
function toMenu(){switchWorld(1);$('bossbar').style.display='none';$('dead').querySelector('h1').textContent='K.I.A.';if(pModel)pModel.g.visible=false;exitLock();state='menu';cine=null;document.body.classList.remove('play','cine');clearDynamic();musicDuck=1;applyVolumes();$('timer').style.display='none';$('prompt').style.display='none';$('subs').innerHTML='';subQ=[];show('menu');VM.visible=false;camera.fov=55;camera.updateProjectionMatrix();
  myBoat.position.set(0,0,62);myBoat.rotation.set(0,0,0);myBoat.userData.ramp.rotation.x=0;if(myBoat.userData.dummies){myBoat.userData.dummies.forEach(d=>myBoat.remove(d));myBoat.userData.dummies=null;}}
document.addEventListener('click',e=>{audioInit();const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a;SND.ui();
  if(a==='campaign')show('missions');else if(a==='settings'){settingsFrom='menu';openSettings();}else if(a==='controls')show('controls');
  else if(a==='back'||a==='cback')show('menu');else if(a==='back2'){briefTok++;show('missions');}else if(a==='deploy'){saveLO();deploy();}else if(a==='loadout'){openLoadout(false);}else if(a==='toLoadout'){briefTok++;openLoadout(true);}else if(a==='loBack'){saveLO();show(loFromBrief?'briefing':'menu');}
  else if(a==='sback'){saveS();show(settingsFrom);}else if(a==='sreset'){S=Object.assign({},DEF);applySettings();renderSettings();saveS();}
  else if(a==='resume')resume();else if(a==='psettings'){settingsFrom='pause';openSettings();}else if(a==='restartcp')restartCP();else if(a==='quit')toMenu();
  else if(a==='replay'){hideAll();deploy();}else if(a==='next'){SELECTED=CUR+1;briefing();}else if(a==='credBack'){toMenu();}});
$('skip').addEventListener('click',e=>{e.stopPropagation();endCine(true);});
$('skip').addEventListener('touchend',e=>{e.preventDefault();e.stopPropagation();endCine(true);});
// settings UI
const SUI={GRAPHICS:[['quality','Quality Preset','sel',['low','medium','high','ultra']],['res','Resolution','sel',['auto','sharp','balanced','performance']],['sky','Sky Renderer','sel',['painted','physical']],['shadows','Shadows','tg'],['fov','Field of View','rng',60,110,1],['brightness','Brightness','rng',.6,1.6,.05],['grade','Cinematic Color Grade','tg'],['grain','Film Grain','tg'],['vignette','Vignette','tg'],['shake','Camera Shake','tg'],['fps','FPS Counter','tg']],
  CONTROLS:[['sens','Mouse Sensitivity','rng',.2,3,.05],['adsSens','ADS Sensitivity Multiplier','rng',.2,1.5,.05],['touchSens','Touch Look Sensitivity','rng',.3,3,.05],['invertY','Invert Look (Y-Axis)','tg'],['adsToggle','Toggle ADS (off = hold)','tg'],['crouchToggle','Toggle Crouch','tg'],['aimAssist','Aim Assist (touch)','tg']],
  AUDIO:[['master','Master Volume','rng',0,1,.05],['music','Music Volume','rng',0,1,.05],['sfx','Effects Volume','rng',0,1,.05],['surround','3D Surround Sound','sel',['headphones','speakers','off']],['bass','Cinematic Bass Boost','tg'],['vibrate','Vibration / Rumble','tg'],['vibStrength','Vibration Strength','rng',.2,1,.1],['subs','Subtitles','tg']],
  GAMEPLAY:[['camMode','Camera Mode','sel',['first-person','cinematic']],['slowmo','Cinematic Slow-Motion Kills','tg'],['difficulty','Difficulty','sel',['recruit','regular','hardened','veteran']],['crosshair','Crosshair','tg'],['hitmarkers','Hit Markers','tg'],['xpPopups','Score Popups','tg']]};
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
let curQ=null,curSky=null;function applySettings(){try{if(curSky!==S.sky&&ENV_CUR){curSky=S.sky;applyEnv(ENV_CUR);}}catch(e){}const q=QUAL[S.quality];renderer.setPixelRatio(basePR());DRS.k=1;
  if(curQ!==S.quality){curQ=S.quality;if(q.ocean)buildWater2();if(water2)water2.visible=!!q.ocean;water.visible=!q.ocean;buildGrass(q.grass);buildComposer(q.post,q.bloom);}
  resize();scene.fog.density=q.fog*(typeof ENV_FOGK==='number'?ENV_FOGK:1);partLimit=q.parts;EXPO_BASE=S.brightness*EXPO_ENV;renderer.toneMappingExposure=EXPO_BASE;
  const qsh=S.shadows?q.sh:0;
  if(curShadow!==qsh){curShadow=qsh;renderer.shadowMap.enabled=qsh>0;sun.castShadow=qsh>0;if(qsh){sun.shadow.mapSize.set(qsh,qsh);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}}scene.traverse(o=>{if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.needsUpdate=true);}});}
  canvas.classList.toggle('grade',S.grade);$('grain').style.display=S.grain?'block':'none';$('vig').style.display=S.vignette?'block':'none';$('fps').style.display=S.fps?'block':'none';
  if(state==='play'){camera.fov=S.fov;camera.updateProjectionMatrix();}applyVolumes();}

/* ================= LOADOUT / GUNSMITH ================= */
let loSlot='primary',loFromBrief=false,loR=null,loScene,loCam,loGun=null,loSpin=0;
function openLoadout(fromBrief){loFromBrief=fromBrief;$('loDeploy').style.display=fromBrief?'':'none';show('loadout');
  if(!loR){loR=new THREE.WebGLRenderer({canvas:$('loPrev'),antialias:true,alpha:true});loR.outputColorSpace=THREE.SRGBColorSpace;loR.toneMapping=THREE.ACESFilmicToneMapping;loR.setPixelRatio(Math.min(2,devicePixelRatio||1));
    loScene=new THREE.Scene();loScene.add(new THREE.HemisphereLight(0xdfe6ee,0x3a3226,1.6));const d=new THREE.DirectionalLight(0xffd8a8,3.5);d.position.set(2,3,2);loScene.add(d);const d2=new THREE.DirectionalLight(0x88aaff,1.2);d2.position.set(-3,1,-2);loScene.add(d2);
    loScene.environment=scene.environment;loCam=new THREE.PerspectiveCamera(30,2,.01,20);loCam.position.set(0,.1,1.25);loCam.lookAt(0,0,0);}
  renderLoadout();}
const isPri=c=>c!=='pistol';
function renderLoadout(){
  $('loTabs').innerHTML=['primary','secondary'].map(s=>`<button data-s="${s}" class="${s===loSlot?'on':''}">${s.toUpperCase()}: ${WEAPONS[LOADOUT[s]].name}</button>`).join('');
  const wid=LOADOUT[loSlot];const att=LOADOUT.att[wid]=Object.assign(defaultAtt(),LOADOUT.att[wid]||{});const w=effStats(wid,att);const base=effStats(wid,{});
  $('loInfo').innerHTML=`<small>${CLASS_NAMES[w.cls].toUpperCase()} · ${({US:'UNITED STATES',DE:'GERMANY',UK:'BRITAIN',SU:'SOVIET UNION'})[w.nation]}</small><b>${w.name}</b><span style="font-size:12px;color:#9c957d">${w.mag} rounds · ${w.pellets?w.pellets+' pellets · ':''}${w.auto?'Full-auto':w.cls==='bolt'?'Bolt-action':w.cls==='shotgun'?'Pump-action':'Semi-auto'}</span>`;
  const sb=statBars(w),bb=statBars(base);
  $('loBars').innerHTML=Object.keys(sb).map(k=>{const v=sb[k],b=bb[k];const lo=Math.min(v,b),d=v-b;return`<div class="bar"><span>${k}</span><div class="t"><i style="width:${Math.max(0,lo*100)}%"></i>${Math.abs(d)>.005?`<em class="${d<0?'neg':''}" style="left:${lo*100}%;width:${Math.abs(d)*100}%"></em>`:''}</div><span>${Math.round(Math.max(0,v)*100)}</span></div>`;}).join('');
  const groups={};for(const id in WEAPONS){const c=WEAPONS[id].cls;if((loSlot==='primary')!==isPri(c)&&!(loSlot==='secondary'&&c==='shotgun'))continue;(groups[c]=groups[c]||[]).push(id);}
  $('loList').innerHTML=Object.keys(groups).map(c=>`<div class="wcls">${CLASS_NAMES[c].toUpperCase()}</div>`+groups[c].map(id=>`<div class="witem ${id===wid?'on':''}" data-w="${id}"><span>${WEAPONS[id].name}</span><small>${WEAPONS[id].nation}</small></div>`).join('')).join('');
  $('loSmith').innerHTML='<div class="wcls" style="margin-top:0">GUNSMITH</div>'+ATT_SLOTS.map(s=>`<div class="att"><div class="l">${ATT[s].label}</div><div class="opts">${Object.keys(ATT[s].opts).map(o=>`<button data-as="${s}" data-ao="${o}" class="${att[s]===o?'on':''}" ${attAllowed(wid,s,o)?'':'disabled'}>${ATT[s].opts[o].name}</button>`).join('')}</div></div>`).join('');
  if(!WMODELS[wid])loadWeapon(wid).then(()=>{if(WMODELS[wid]&&$('loadout').classList.contains('on')&&LOADOUT[loSlot]===wid)renderLoadout();});
  if(loGun)loScene.remove(loGun);const vm=WMODELS[wid]?(()=>{const m=WMODELS[wid].clone(true);m.rotation.y=Math.PI;const gg=new THREE.Group();gg.add(m);if(w.scoped){const c=new THREE.Mesh(new THREE.CylinderGeometry(.019,.019,.28,12),MAT.gunMetal);c.rotation.x=Math.PI/2;c.position.set(0,.17,-.35);gg.add(c);}return gg;})():buildGunVM(w,VMMATS);vm.traverse(o=>{if(o.isMesh&&(o.material===VMMATS.skin||o.material===VMMATS.sleeve))o.visible=false;});
  loGun=new THREE.Group();const bx=new THREE.Box3().setFromObject(vm);const c=bx.getCenter(new V3());vm.position.sub(c);loGun.add(vm);const sz=bx.getSize(new V3());loGun.scale.setScalar(1/Math.max(sz.z,.35));loScene.add(loGun);}
$('loTabs').addEventListener('click',e=>{const b=e.target.closest('[data-s]');if(b){loSlot=b.dataset.s;SND.ui();renderLoadout();}});
$('loList').addEventListener('click',e=>{const b=e.target.closest('[data-w]');if(b){LOADOUT[loSlot]=b.dataset.w;SND.ui();renderLoadout();saveLO();}});
$('loSmith').addEventListener('click',e=>{const b=e.target.closest('[data-as]');if(b&&!b.disabled){const wid=LOADOUT[loSlot];LOADOUT.att[wid][b.dataset.as]=b.dataset.ao;SND.click();renderLoadout();saveLO();}});
function updLoadoutPreview(dt){if(!loR||!$('loadout').classList.contains('on')||!loGun)return;loSpin+=dt*.5;loGun.rotation.y=Math.PI/2+Math.sin(loSpin)*.6;loGun.rotation.x=.12;
  const cv=$('loPrev');const w=cv.clientWidth|0,h=cv.clientHeight|0;if(w&&h&&(cv.width!==w*loR.getPixelRatio()|0)){loR.setSize(w,h,false);loCam.aspect=w/h;loCam.updateProjectionMatrix();}loR.render(loScene,loCam);}

/* ================= CAMPAIGN ENGINE (missions 2-10) ================= */
let CUR=1,LV=null,M1W=null;
let PROGRESS={done:{}};try{const p=JSON.parse(localStorage.getItem('ir_progress')||'null');if(p)PROGRESS=p;}catch(e){}
function saveProgress(){try{localStorage.setItem('ir_progress',JSON.stringify(PROGRESS))}catch(e){}}

// ---------- materials ----------
const CMAT={};
function cmat(){if(CMAT.ok)return CMAT;CMAT.ok=1;
  const plain=(base,cols,n,sz,rep)=>ctex(256,256,(x,w,h)=>{x.fillStyle=base;x.fillRect(0,0,w,h);speck(x,w,h,n,cols,sz);},rep);
  CMAT.plaster=new THREE.MeshStandardMaterial({map:plain('#b9ab8f',['#9c8f74','#cfc2a6','#8a7e66'],3000,3),roughness:.95});
  CMAT.plasterDark=new THREE.MeshStandardMaterial({map:plain('#8d8475',['#6f685c','#a29a8a'],3000,3),roughness:.95});
  CMAT.brick=new THREE.MeshStandardMaterial({map:ctex(256,256,(x,w,h)=>{x.fillStyle='#6b3b2a';x.fillRect(0,0,w,h);for(let r=0;r<16;r++)for(let c=0;c<9;c++){x.fillStyle=`hsl(${12+rnd(-4,4)},${35+rnd(-8,8)}%,${26+rnd(-5,6)}%)`;x.fillRect(c*32+(r%2)*16-16,r*16+1,30,14);}}),roughness:.9});
  CMAT.roof=new THREE.MeshStandardMaterial({map:ctex(256,256,(x,w,h)=>{x.fillStyle='#5a3226';x.fillRect(0,0,w,h);for(let r=0;r<16;r++)for(let c=0;c<16;c++){x.fillStyle=`hsl(${10+rnd(-4,4)},40%,${22+rnd(-5,5)}%)`;x.fillRect(c*16+(r%2)*8,r*16,15,15);}}),roughness:.85});
  CMAT.slate=new THREE.MeshStandardMaterial({color:0x3d4148,roughness:.7});
  CMAT.stone=new THREE.MeshStandardMaterial({map:plain('#7d7a72',['#5f5c55','#9a968c'],4000,4),roughness:.95});
  CMAT.cobble=new THREE.MeshStandardMaterial({map:ctex(256,256,(x,w,h)=>{x.fillStyle='#3e3d3a';x.fillRect(0,0,w,h);for(let i=0;i<500;i++){x.fillStyle=`hsl(30,5%,${22+rnd(-6,8)}%)`;x.beginPath();x.ellipse(rnd(0,w),rnd(0,h),rnd(5,9),rnd(4,7),rnd(0,3),0,7);x.fill();}},[40,40]),roughness:.85});
  CMAT.wood=MAT.wood;CMAT.metal=MAT.gunMetal;CMAT.rust=MAT.rust;CMAT.concrete=MAT.concrete;
  CMAT.hedge=new THREE.MeshStandardMaterial({color:0x2f4a1f,roughness:1,flatShading:true});
  CMAT.pine=new THREE.MeshStandardMaterial({color:0x1f3322,roughness:1,flatShading:true});
  CMAT.snow=new THREE.MeshStandardMaterial({color:0xe9eef2,roughness:.9});
  CMAT.snowPine=new THREE.MeshStandardMaterial({color:0x8fa39a,roughness:1,flatShading:true});
  CMAT.rock=new THREE.MeshStandardMaterial({map:plain('#6e6a63',['#4f4c47','#8a857c'],4000,5,[3,3]),roughness:1,flatShading:true});
  CMAT.dark=new THREE.MeshStandardMaterial({color:0x1a1916,roughness:1});
  CMAT.train=new THREE.MeshStandardMaterial({color:0x22252a,roughness:.6,metalness:.4});
  CMAT.glow=new THREE.MeshBasicMaterial({color:0xffd9a0});
  CMAT.crate=new THREE.MeshStandardMaterial({map:ctex(128,128,(x,w,h)=>{x.fillStyle='#6b5434';x.fillRect(0,0,w,h);x.strokeStyle='#3e2f1c';x.lineWidth=6;x.strokeRect(3,3,w-6,h-6);x.beginPath();x.moveTo(0,0);x.lineTo(w,h);x.stroke();speck(x,w,h,400,['#5a4529','#7d6440'],2);}),roughness:.9});
  for(const [k,s] of [['plaster',1.2],['plasterDark',1.2],['brick',2.4],['roof',2],['stone',1.6],['cobble',2.6],['rock',2],['crate',1.4]]){const m=CMAT[k];if(m&&m.map){m.normalMap=texNormal(m.map,s);m.normalScale.set(.8,.8);m.needsUpdate=true;}}
  CMAT.frame=new THREE.MeshStandardMaterial({color:0x4a3a28,roughness:.8});CMAT.shutters=[0x3f5a45,0x46586a,0x6a4632,0x5c5a50].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.85}));
  CMAT.scorch=softDecal(new THREE.MeshBasicMaterial({map:ctex(128,128,(x)=>{const g=x.createRadialGradient(64,64,4,64,64,64);g.addColorStop(0,'rgba(8,6,4,.85)');g.addColorStop(.6,'rgba(20,16,12,.4)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,128,128);}),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3}),.35);
  CMAT.puddle=new THREE.MeshStandardMaterial({color:0x1c2226,roughness:.05,metalness:.9,transparent:true,opacity:.85,polygonOffset:true,polygonOffsetFactor:-2});
  CMAT.water=new THREE.MeshStandardMaterial({color:0x2f4148,roughness:.2,metalness:.6,transparent:true,opacity:.92});
  return CMAT;}

function texNormal(tex,strength=1.5){const src=tex.image;const w=src.width,h=src.height;const cx=src.getContext?src.getContext('2d'):null;if(!cx)return null;const d=cx.getImageData(0,0,w,h).data;
  const L=(x,y)=>{x=(x+w)%w;y=(y+h)%h;const i=(y*w+x)*4;return (d[i]*.3+d[i+1]*.59+d[i+2]*.11)/255;};const c=document.createElement('canvas');c.width=w;c.height=h;const o=c.getContext('2d');const im=o.createImageData(w,h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const nx=(L(x-1,y)-L(x+1,y))*strength,ny=(L(x,y-1)-L(x,y+1))*strength,nz=1/Math.hypot(nx,ny,1);const i=(y*w+x)*4;im.data[i]=(nx*nz*.5+.5)*255;im.data[i+1]=(ny*nz*.5+.5)*255;im.data[i+2]=(nz*.5+.5)*255;im.data[i+3]=255;}
  o.putImageData(im,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.copy(tex.repeat);return t;}
// ---------- environment presets ----------
const ENV={
  dawn:   {elev:84,az:-35,turb:9,ray:2.2,sun:0xffbe80,sunI:4.2,hemiS:0x9aa6b4,hemiG:0x4a3e30,hemiI:1.6,fog:0x8c8174,fogK:1,exp:1},
  day:    {elev:55,az:40,turb:6,ray:1.4,sun:0xfff2dc,sunI:4.6,hemiS:0xa9bccc,hemiG:0x4e4a3c,hemiI:1.8,fog:0x9aa4a6,fogK:.8,exp:.88},
  overcast:{elev:50,az:20,turb:18,ray:.6,sun:0xdfe4ea,sunI:2.6,hemiS:0xb8c0c8,hemiG:0x56544c,hemiI:2.2,fog:0x8e969a,fogK:1.5,exp:1},
  dusk:   {elev:86,az:120,turb:12,ray:3,sun:0xff9a55,sunI:3.6,hemiS:0x8a7f8c,hemiG:0x4a3a2e,hemiI:1.4,fog:0x8a6f5e,fogK:1.1,exp:1},
  rain:   {elev:45,az:0,turb:20,ray:.4,sun:0xc8d0d4,sunI:1.8,hemiS:0x8c9696,hemiG:0x3e4236,hemiI:1.9,fog:0x5e6660,fogK:2.6,exp:1.05},
  snow:   {elev:60,az:10,turb:20,ray:.5,sun:0xeef2ff,sunI:2.4,hemiS:0xd6dde6,hemiG:0x9aa0a8,hemiI:2.4,fog:0xc4ccd4,fogK:2,exp:.95},
  night:  {elev:100,az:30,turb:2,ray:.2,sun:0x7f93c8,sunI:.55,hemiS:0x2c3650,hemiG:0x101010,hemiI:.32,fog:0x0a0e15,fogK:2.4,exp:1,night:1},
  snowNight:{elev:100,az:30,turb:2,ray:.2,sun:0x9aaee0,sunI:.75,hemiS:0x3e4a66,hemiG:0x22262e,hemiI:.55,fog:0x141b26,fogK:2.2,exp:1.05,night:1},
  interior:{elev:100,az:0,turb:2,ray:.1,sun:0x000000,sunI:0,hemiS:0x6b6458,hemiG:0x2a2620,hemiI:.9,fog:0x14120f,fogK:2.6,exp:1.2,night:1,inside:1}
};
let ENV_CUR='dawn';
function applyEnv(name){ENV_CUR=name;const e=ENV[name];setReverb(!!(e&&e.inside));const su=sky.material.uniforms;
  su.turbidity.value=e.turb;su.rayleigh.value=e.ray;SUN_DIR.setFromSphericalCoords(1,THREE.MathUtils.degToRad(e.elev),THREE.MathUtils.degToRad(e.az));su.sunPosition.value.copy(SUN_DIR);
  applySkyMode(name);if(FLARE)FLARE.visible=!e.night&&!e.inside&&name!=='overcast'&&name!=='rain'&&name!=='snow';
  sun.color.setHex(e.sun);sun.intensity=e.sunI;if(e.night){SUN_DIR.set(.3,.8,.4).normalize();}
  hemi.color.setHex(e.hemiS);hemi.groundColor.setHex(e.hemiG);hemi.intensity=e.hemiI;
  scene.fog.color.setHex(e.fog);renderer.setClearColor(e.fog);ENV_FOGK=e.fogK;scene.fog.density=QUAL[S.quality].fog*e.fogK;
  EXPO_ENV=e.exp;EXPO_BASE=S.brightness*e.exp;renderer.toneMappingExposure=EXPO_BASE;Object.values(MAT).forEach(m=>m.envMapIntensity=e.night?.08:.45);}
let ENV_FOGK=1;

// ---------- weather ----------
let WX=null;
function setWeather(kind){if(WX){scene.remove(WX.pts);WX=null;}if(!kind)return;const n=kind==='rain'?(isTouch?1500:3500):(isTouch?1200:2600);
  const g=new THREE.BufferGeometry();const p=new Float32Array(n*3);for(let i=0;i<n;i++){p[i*3]=rnd(-30,30);p[i*3+1]=rnd(0,25);p[i*3+2]=rnd(-30,30);}g.setAttribute('position',new THREE.BufferAttribute(p,3));
  const m=new THREE.PointsMaterial({color:kind==='rain'?0xaab4c0:0xffffff,size:kind==='rain'?.05:.09,transparent:true,opacity:kind==='rain'?.55:.85,depthWrite:false});
  const pts=new THREE.Points(g,m);pts.frustumCulled=false;scene.add(pts);WX={pts,kind,n};}
function updWeather(dt){if(!WX)return;WX.pts.visible=!(CUR===10&&camera.position.z<-47&&Math.abs(camera.position.x)<52);const a=WX.pts.geometry.attributes.position.array;const c=camera.position;const sp=WX.kind==='rain'?22:1.6;
  for(let i=0;i<WX.n;i++){let x=a[i*3],y=a[i*3+1],z=a[i*3+2];y-=sp*dt;if(WX.kind==='snow'){x+=Math.sin(time*.8+i)*dt*.6;z+=Math.cos(time*.6+i*.3)*dt*.4;}
    if(y<-2){y=25;x=rnd(-30,30);z=rnd(-30,30);}a[i*3]=x;a[i*3+1]=y;a[i*3+2]=z;}
  WX.pts.position.set(c.x,c.y-8,c.z);WX.pts.geometry.attributes.position.needsUpdate=true;}

// ---------- level builder ----------
function makeBuilder(root,stat,coll){const C=cmat();
  const reg=(m,col=true)=>{root.add(m);m.updateMatrixWorld(true);m.traverse(o=>{if(o.isMesh)stat.push(o);});if(col){const b=new THREE.Box3().setFromObject(m);coll.push({minx:b.min.x,maxx:b.max.x,minz:b.min.z,maxz:b.max.z,miny:b.min.y,maxy:b.max.y});}return m;};
  const bx=(w,h,d,mat,x,y,z,ry=0,col=true)=>{const m=box(w,h,d,mat);m.position.set(x,y,z);m.rotation.y=ry;return reg(m,col);};
  const B={root,reg,bx,
    house(x,z,w,d,o={}){const h=o.h||(3.2*(o.floors||1)),y=H(x,z)-.1,mat=o.mat||C.plaster,t=.35,rot=o.rot||0;const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;
      const wall=(ww,hh,dd,px,py,pz)=>{const m=box(ww,hh,dd,mat);m.position.set(px,py,pz);g.add(m);};
      const door=1.5,dh=2.3;wall((w-door)/2,h,t,-(w+door)/4,h/2,d/2);wall((w-door)/2,h,t,(w+door)/4,h/2,d/2);wall(door,h-dh,t,0,dh+(h-dh)/2,d/2);
      if(o.backDoor){wall((w-door)/2,h,t,-(w+door)/4,h/2,-d/2);wall((w-door)/2,h,t,(w+door)/4,h/2,-d/2);wall(door,h-dh,t,0,dh+(h-dh)/2,-d/2);}else wall(w,h,t,0,h/2,-d/2);
      wall(t,h,d,-w/2,h/2,0);wall(t,h,d,w/2,h/2,0);
      const shut=C.shutters[(Math.random()*C.shutters.length)|0];
      for(const sx of[-1,1])for(let f=0;f<(o.floors||1);f++)for(const sz of[1,-1]){const wx=sx*w*.3,wy=1.6+f*3.2,wz=sz*(d/2+.19);const win=box(.9,1.1,.05,C.dark);win.position.set(wx,wy,wz);g.add(win);
        for(const [fw,fh,fx,fy] of [[1.1,.1,0,.6],[1.1,.14,0,-.6],[.1,1.2,-.5,0],[.1,1.2,.5,0]]){const fr=box(fw,fh,.12,C.frame);fr.position.set(wx+fx,wy+fy,wz+sz*.03);g.add(fr);}
        if(!o.ruined&&Math.random()<.75)for(const s2 of[-1,1]){const sh=box(.48,1.15,.05,shut);sh.position.set(wx+s2*.78,wy,wz+sz*.12);sh.rotation.y=s2*sz*rnd(.1,.9);g.add(sh);}}
      {const df=box(1.7,.15,.14,C.frame);df.position.set(0,dh+.05,d/2+.12);g.add(df);for(const s2 of[-1,1]){const dp=box(.12,dh,.14,C.frame);dp.position.set(s2*.8,dh/2,d/2+.12);g.add(dp);}
        if(!o.ruined){const leaf=box(1.4,dh-.05,.07,C.frame);leaf.geometry.translate(.7,0,0);leaf.position.set(-.72,dh/2,d/2+.1);leaf.rotation.y=-rnd(.6,1.4);g.add(leaf);}}
      {const sk=(ww,dd,px,pz)=>{const b=box(ww,.55,dd,C.stone);b.position.set(px,.27,pz);g.add(b);};sk(t+.1,d+.12,-w/2,0);sk(t+.1,d+.12,w/2,0);sk((w-door)/2,t+.1,-(w+door)/4,d/2);sk((w-door)/2,t+.1,(w+door)/4,d/2);if(!o.backDoor)sk(w+.12,t+.1,0,-d/2);}
      if(o.ruined){for(let i=0;i<5;i++){const s=box(rnd(.6,1.6),rnd(.3,1.2),t+.05,mat);const side=i%2?1:-1;s.position.set(rnd(-w/2+.5,w/2-.5),h+rnd(.1,.5),side*d/2);g.add(s);}
        for(let i=0;i<3;i++){const bm=box(.18,.18,rnd(2,4),C.frame);bm.position.set(rnd(-w/3,w/3),h-.3,rnd(-d/4,d/4));bm.rotation.set(rnd(-.5,.5),rnd(0,3),rnd(-.4,.4));g.add(bm);}
        for(let i=0;i<2;i++){const sc=new THREE.Mesh(new THREE.PlaneGeometry(2.4,2.4),C.scorch);sc.position.set(rnd(-w/3,w/3),rnd(1.4,h-.5),d/2+.2);g.add(sc);}}
      if(o.ruined){for(let i=0;i<6;i++){const r=box(rnd(.4,1.4),rnd(.3,.8),rnd(.4,1.2),C.stone);r.position.set(rnd(-w/2,w/2),.3,rnd(-d/2,d/2)+d/2+1.2);r.rotation.set(rnd(0,1),rnd(0,3),0);g.add(r);}}
      else if(o.flat){const r=box(w+.4,.3,d+.4,C.stone);r.position.y=h+.15;g.add(r);}
      else{const rh=Math.min(w,d)*.38,rl=Math.hypot(d/2+.4,rh);{const ch=box(.7,rh+1.4,.7,C.brick);ch.position.set(w*.28,h+rh/2+.4,-d*.15);g.add(ch);}for(const s of[-1,1]){const r=box(w+.6,.2,rl,o.roofMat||C.roof);r.position.set(0,h+rh/2,s*(d/4+.1));r.rotation.x=s*Math.atan2(rh,d/2+.4);g.add(r);}}
      if(o.floor2!==false&&(o.floors||1)>1){const fl=box(w-.7,.2,d-.7,C.wood);fl.position.y=3.2;g.add(fl);}
      g.traverse(c=>{if(c.isMesh){c.castShadow=true;c.receiveShadow=true;}});root.add(g);g.updateMatrixWorld(true);
      g.traverse(c=>{if(c.isMesh&&c.material!==C.dark){stat.push(c);const b=new THREE.Box3().setFromObject(c);if(b.max.y-b.min.y>1.2||c.position.y>h-0.5&&false)coll.push({minx:b.min.x,maxx:b.max.x,minz:b.min.z,maxz:b.max.z,miny:b.min.y,maxy:b.max.y});}});return g;},
    block(x,z,w,d,h,mat){const y=H(x,z);const m=bx(w,h,d,mat||C.plasterDark,x,y+h/2-.1,z);for(let f=0;f<Math.floor(h/3.3);f++)for(let i=0;i<Math.floor(w/3);i++){const wi=box(.9,1.2,.05,C.dark);wi.position.set(x-w/2+1.5+i*3,y+1.8+f*3.3,z+d/2+.03);root.add(wi);const w2=wi.clone();w2.position.z=z-d/2-.03;root.add(w2);}const r=box(w+.3,.4,d+.3,C.slate);r.position.set(x,y+h+.1,z);root.add(r);return m;},
    hedge(x1,z1,x2,z2,gaps=[]){const L=Math.hypot(x2-x1,z2-z1),n=Math.ceil(L/1.5),ux=(x2-x1)/L,uz=(z2-z1)/L;const geo=new THREE.IcosahedronGeometry(1,1);let segStart=0;
      const inGap=t=>gaps.some(g=>Math.abs(t-g)<2.4);
      for(let i=0;i<=n;i++){const t=i/n*L;if(inGap(t))continue;const x=x1+ux*t,z=z1+uz*t;const m=new THREE.Mesh(geo,C.hedge);const s=rnd(1.1,1.6);m.scale.set(s,rnd(1.1,1.5),s);m.position.set(x+rnd(-.3,.3),H(x,z)+1,z+rnd(-.3,.3));m.castShadow=true;m.receiveShadow=true;root.add(m);stat.push(m);}
      let t0=0;const ts=[...gaps.map(g=>[g-2.4,g+2.4])].sort((a,b)=>a[0]-b[0]);const segs=[];for(const [a,b] of ts){if(a>t0)segs.push([t0,a]);t0=Math.max(t0,b);}if(t0<L)segs.push([t0,L]);
      for(const [a,b] of segs){const xa=x1+ux*a,za=z1+uz*a,xb=x1+ux*b,zb=z1+uz*b;coll.push({minx:Math.min(xa,xb)-1,maxx:Math.max(xa,xb)+1,minz:Math.min(za,zb)-1,maxz:Math.max(za,zb)+1,miny:-50,maxy:H((xa+xb)/2,(za+zb)/2)+2.4});}},
    tree(x,z,kind='oak',s=1){const g=new THREE.Group();const y=H(x,z);g.position.set(x,y,z);
      if(kind==='pine'||kind==='snowpine'){const t=new THREE.Mesh(new THREE.CylinderGeometry(.18*s,.3*s,3*s,6),MAT.trunk);t.position.y=1.5*s;g.add(t);for(let k=0;k<4;k++){const c=new THREE.Mesh(new THREE.ConeGeometry((2.4-k*.45)*s,2.6*s,7),kind==='snowpine'?C.snowPine:C.pine);c.position.y=(2.6+k*1.5)*s;g.add(c);if(kind==='snowpine'){const sc=new THREE.Mesh(new THREE.ConeGeometry((2.1-k*.45)*s,.7*s,7),C.snow);sc.position.y=(3.2+k*1.5)*s;g.add(sc);}}}
      else{const t=new THREE.Mesh(new THREE.CylinderGeometry(.22*s,.35*s,3.4*s,6),MAT.trunk);t.position.y=1.7*s;g.add(t);for(let k=0;k<3;k++){const f=new THREE.Mesh(new THREE.IcosahedronGeometry((2.4-k*.4)*s,1),C.hedge);f.position.set(rnd(-.6,.6),(3.6+k*1.1)*s,rnd(-.6,.6));g.add(f);}}
      g.traverse(c=>{if(c.isMesh){c.castShadow=true;}});root.add(g);g.updateMatrixWorld(true);stat.push(g.children[0]);coll.push({minx:x-.35*s,maxx:x+.35*s,minz:z-.35*s,maxz:z+.35*s,miny:y-1,maxy:y+3*s});return g;},
    forest(n,x0,z0,x1,z1,kind,avoid){for(let i=0;i<n;i++){const x=rnd(x0,x1),z=rnd(z0,z1);if(avoid&&avoid(x,z))continue;B.tree(x,z,kind,rnd(.8,1.3));}},
    sandbags(x,z,len=3.5,ry=0){const y=H(x,z);if(PROPS.sandbag){const n=Math.max(1,Math.round(len/3.5));for(let i=0;i<n;i++){const m=PROPS.sandbag.clone(true);const off=(i-(n-1)/2)*3.5;m.position.set(x+Math.cos(ry)*off,y-.02,z-Math.sin(ry)*off);m.rotation.y=ry;m.scale.z=1.5;reg(m);}}else bx(len,1,1,MAT.bags,x,y+.45,z,ry);},
    foxhole(x,z){for(let i=0;i<4;i++){const a=i*Math.PI/2;B.sandbags(x+Math.sin(a)*2.2,z+Math.cos(a)*2.2,3.5,a);}},
    wire(x,z,ry=0){if(!PROPS.wire)return;const m=PROPS.wire.clone(true);m.position.set(x,H(x,z),z);m.rotation.y=ry;root.add(m);},
    hedgehog(x,z){if(PROPS.hedgehog){const m=PROPS.hedgehog.clone(true);m.position.set(x,H(x,z),z);m.rotation.y=rnd(0,3);reg(m);}},
    crates(x,z,n=3){for(let i=0;i<n;i++){const s=rnd(.8,1.1);bx(s,s,s,C.crate,x+(i%2)*1.1+rnd(-.1,.1),H(x,z)+s/2+(i>1?1:0),z+rnd(-.2,.2),rnd(0,.3));}},
    barrel(x,z,fire){const m=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,.95,10),C.rust);m.position.set(x,H(x,z)+.47,z);m.castShadow=true;reg(m);if(fire){LV.emit.push({pos:new V3(x,H(x,z)+1.1,z),type:'fire',rate:.09,t:0,ttl:1e9});const l=new THREE.PointLight(0xff8a3a,30,14,2);l.userData={fire:1,base:30};l.position.set(x,H(x,z)+1.6,z);root.add(l);LV.lights.push(l);}},
    tank(x,z,ry=0){if(PROPS.sherman){const m=PROPS.sherman.clone(true);m.position.set(x,H(x,z)-.05,z);m.rotation.y=ry;reg(m);LV.emit.push({pos:new V3(x,H(x,z)+2.4,z),type:'bsmoke',rate:.45,t:0,ttl:1e9});}},
    truck(x,z,ry=0){const g=new THREE.Group();const add=(w,h,d,m,px,py,pz)=>{const b=box(w,h,d,m);b.position.set(px,py,pz);g.add(b);};add(2.2,1.2,6,C.train,0,1,0);add(2.1,1.4,1.8,C.train,0,1.7,2.3);add(2.3,.15,3.8,MAT.olive,0,2.6,-.9);
      for(const [wx,wz] of [[-1.1,2],[1.1,2],[-1.1,-1.6],[1.1,-1.6]]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,.3,10),C.dark);w.rotation.z=Math.PI/2;w.position.set(wx,.45,wz);g.add(w);}g.position.set(x,H(x,z),z);g.rotation.y=ry;reg(g);},
    atgun(x,z,ry=0){const g=new THREE.Group();const add=(m,px,py,pz)=>{m.position.set(px,py,pz);g.add(m);return m;};add(box(2.2,1.3,.12,MAT.feld),0,1.1,0);const b=add(new THREE.Mesh(new THREE.CylinderGeometry(.08,.11,3.6,8),C.metal),0,1.15,1.7);b.rotation.x=Math.PI/2;
      add(box(.5,.5,1.4,MAT.feld),0,.9,.3);for(const sx of[-1,1]){const w=add(new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.2,12),C.dark),sx*1,.5,-.1);w.rotation.z=Math.PI/2;const tr=add(box(.12,.12,2.4,MAT.feld),sx*.5,.35,-1.4);tr.rotation.y=sx*.25;}
      g.position.set(x,H(x,z),z);g.rotation.y=ry;g.traverse(c=>{if(c.isMesh)c.castShadow=true;});reg(g);return g;},
    bridge(x,z0,z1,w,y){const L=Math.abs(z1-z0),zc=(z0+z1)/2;bx(w,.6,L,C.concrete,x,y-.3,zc);for(const s of[-1,1]){bx(.3,1.1,L,C.rust,x+s*(w/2-.15),y+.55,zc);
        for(let k=0;k<=L/6;k++){const zz=Math.min(z0,z1)+k*6;const v=box(.25,4,.25,C.rust);v.position.set(x+s*(w/2-.1),y+2,zz);root.add(v);stat.push(v);}const top=box(.3,.3,L,C.rust);top.position.set(x+s*(w/2-.1),y+4,zc);root.add(top);}
      for(let k=1;k<4;k++){const zz=Math.min(z0,z1)+k*L/4;bx(3,Math.max(1,y+6),3,C.stone,x,(y-6)/2,zz,0,false);}
      for(const zz of[z0,z1]){for(const s of[-1,1])bx(2.2,9,2.2,C.stone,x+s*(w/2+1.3),y+4.5,zz);}},
    rails(x,z0,z1){const L=Math.abs(z1-z0),zc=(z0+z1)/2;for(const s of[-.72,.72]){const r=box(.08,.12,L,C.metal);r.position.set(x+s,H(x,zc)+.06,zc);root.add(r);}for(let k=0;k<L;k+=1.2){const t=box(2.4,.08,.25,C.wood);t.position.set(x,H(x,z0)+.03,Math.min(z0,z1)+k);root.add(t);}},
    traincar(x,z,len=12,loco=false){const g=new THREE.Group();const add=(m,px,py,pz)=>{m.position.set(px,py,pz);g.add(m);return m;};
      if(loco){const b=add(new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.25,len*.65,14),C.train),0,2.4,-len*.12);b.rotation.x=Math.PI/2;add(box(3,3.2,len*.3,C.train),0,2.5,len*.32);add(new THREE.Mesh(new THREE.CylinderGeometry(.35,.45,1.3,10),C.train),0,4,-len*.36);}
      else{add(box(2.9,2.8,len,C.train),0,2.3,0);add(box(3.1,.2,len+.2,C.slate),0,3.8,0);const st=add(box(2.95,.5,1.4,MAT.feld),0,2.6,0);}
      for(let k=-1;k<=1;k+=2)for(let j=0;j<3;j++){const w=add(new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.2,12),C.dark),k*1.3,.5,(j-1)*len*.32);w.rotation.z=Math.PI/2;}
      g.position.set(x,H(x,z),z);g.traverse(c=>{if(c.isMesh)c.castShadow=true;});reg(g);return g;},
    lamp(x,z,light=true){bx(.12,4.2,.12,C.metal,x,H(x,z)+2.1,z,0,false);const b=new THREE.Mesh(new THREE.SphereGeometry(.2,8,6),C.glow);b.position.set(x,H(x,z)+4.2,z);root.add(b);if(light&&LV.lights.length<8){const l=new THREE.PointLight(0xffc88a,40,18,2);l.position.set(x,H(x,z)+4,z);root.add(l);LV.lights.push(l);}},
    church(x,z){B.house(x,z,10,16,{h:7,mat:C.stone,roofMat:C.slate});bx(4,16,4,C.stone,x,H(x,z)+8,z-9);const sp=new THREE.Mesh(new THREE.ConeGeometry(2.8,6,4),C.slate);sp.position.set(x,H(x,z)+19,z-9);sp.rotation.y=Math.PI/4;root.add(sp);},
    rock(x,z,s=4){const m=new THREE.Mesh(new THREE.DodecahedronGeometry(s,0),C.rock);m.position.set(x,H(x,z)+s*.3,z);m.rotation.set(rnd(0,3),rnd(0,3),0);m.scale.y=rnd(.6,1);m.castShadow=true;m.receiveShadow=true;return reg(m);},
    bunker(x,z,ry=0){if(PROPS.bunker){const m=PROPS.bunker.clone(true);m.position.set(x,H(x,z)-.1,z);m.rotation.y=ry;reg(m);}else bx(6,3.5,6,C.concrete,x,H(x,z)+1.7,z);},
    water(y,x0,z0,x1,z1){const m=new THREE.Mesh(new THREE.PlaneGeometry(x1-x0,z1-z0,30,30),C.water);m.rotation.x=-Math.PI/2;m.position.set((x0+x1)/2,y,(z0+z1)/2);m.receiveShadow=true;root.add(m);LV.water=m;},
    marker(x,z,col=0xe9c46a){const m=new THREE.Mesh(new THREE.TorusGeometry(.6,.05,6,24),new THREE.MeshBasicMaterial({color:col}));m.rotation.x=-Math.PI/2;m.position.set(x,H(x,z)+.05,z);root.add(m);return m;},
    item(x,z){const g=new THREE.Group();const c=box(.5,.12,.35,MAT.leather);c.position.y=.06;g.add(c);const p=box(.36,.02,.26,new THREE.MeshStandardMaterial({color:0xd8cfb0}));p.position.y=.13;g.add(p);g.position.set(x,H(x,z)+.9,z);root.add(g);return g;},
    gridRooms(map,ox,oz,cell=4,h=4,mat){const rows=map.trim().split('\n').map(r=>r.trim());const y=0;const C2=mat||C.concrete;
      rows.forEach((r,j)=>{let i=0;while(i<r.length){if(r[i]==='#'){let k=i;while(k<r.length&&r[k]==='#')k++;const w=(k-i)*cell;bx(w,h,cell,C2,ox+(i*cell)+w/2,y+h/2,oz+j*cell+cell/2);i=k;}else i++;}});
      const W=rows[0].length*cell,D=rows.length*cell;const ceil=box(W,.5,D,C2);ceil.position.set(ox+W/2,h+.25,oz+D/2);root.add(ceil);stat.push(ceil);
      const fl=box(W,.2,D,C.stone);fl.position.set(ox+W/2,-.05,oz+D/2);fl.receiveShadow=true;root.add(fl);
      rows.forEach((r,j)=>{for(let i=0;i<r.length;i++){if(r[i]==='L'&&LV.lights.length<10){const l=new THREE.PointLight(0xffd7a0,25,16,2);l.position.set(ox+i*cell+cell/2,h-.4,oz+j*cell+cell/2);root.add(l);LV.lights.push(l);const b=box(.8,.1,.3,C.glow);b.position.copy(l.position).add(new V3(0,.3,0));root.add(b);}}});}
  };return B;}

function terrainMesh(Hf,colFn,size=320,seg=150,cx=0,cz=0){const g=new THREE.PlaneGeometry(size,size,seg,seg);g.rotateX(-Math.PI/2);g.translate(cx,0,cz);const p=g.attributes.position,col=new Float32Array(p.count*3),c=new THREE.Color();
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),y=Hf(x,z);p.setY(i,y);c.setHex(colFn(x,z,y));const n=.9+Math.random()*.15;col[i*3]=c.r*n;col[i*3+1]=c.g*n;col[i*3+2]=c.b*n;}
  g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();const m=new THREE.Mesh(g,GROUND);m.receiveShadow=true;return m;}
const nz=(x,z,a=1)=>(Math.sin(x*.05+z*.03)*1.2+Math.sin(x*.11-z*.07)*.6+Math.sin(x*.023+z*.051)*1.5)*a;

// ---------- level dressing: scatter, craters, puddles, smoke columns, mist ----------
function levelDressing(def,root){const C=cmat();const q=QUAL[S.quality];const k=q.grass?1:.4;const inside=(x,z)=>!pointFreeRaw(x,z);
  const inst=(geo,mat,n,place)=>{const m=new THREE.InstancedMesh(geo,mat,n);const o=new THREE.Object3D();let i=0,t=0;while(i<n&&t<n*4){t++;const r=place(o);if(!r)continue;o.updateMatrix();m.setMatrixAt(i++,o.matrix);}m.count=i;m.castShadow=true;m.receiveShadow=true;root.add(m);return m;};
  const R=()=>[rnd(-120,120),rnd(-120,120)];
  inst(new THREE.DodecahedronGeometry(1,0),def.snow?C.snow:C.stone,(600*k)|0,o=>{const [x,z]=R();if(inside(x,z))return false;const s=rnd(.08,.35);o.position.set(x,H(x,z)+s*.3,z);o.rotation.set(rnd(0,3),rnd(0,3),rnd(0,3));o.scale.set(s,s*rnd(.5,.9),s*rnd(.7,1.2));return true;});
  if(!def.snow)inst(new THREE.BoxGeometry(1,1,1),C.frame,(140*k)|0,o=>{const [x,z]=R();if(inside(x,z))return false;o.position.set(x,H(x,z)+.03,z);o.rotation.set(0,rnd(0,3),rnd(-.1,.1));o.scale.set(rnd(.08,.16),.05,rnd(.6,1.8));return true;});
  if(def.ground!=='cobble'&&!def.objectives.some(()=>false)){const cm=new THREE.MeshStandardMaterial({map:ctex(128,128,(x)=>{const g=x.createRadialGradient(64,64,10,64,64,64);g.addColorStop(0,'rgba(25,20,15,.9)');g.addColorStop(.55,'rgba(45,38,28,.55)');g.addColorStop(.78,'rgba(110,95,70,.3)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,128,128);}),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,roughness:1,color:def.snow?0x8a8f94:0xffffff});
    for(let i=0;i<22;i++){const [x,z]=R();if(inside(x,z)||(CUR===10&&z<-47))continue;const m=new THREE.Mesh(new THREE.CircleGeometry(rnd(1.5,3.8),18),cm);m.rotation.x=-Math.PI/2;m.position.set(x,H(x,z)+.05,z);root.add(m);}}
  if(def.weather==='rain'){for(let i=0;i<40;i++){const [x,z]=R();if(inside(x,z))continue;const m=new THREE.Mesh(new THREE.CircleGeometry(rnd(.6,2.2),16),C.puddle);m.scale.y=rnd(.5,1);m.rotation.x=-Math.PI/2;m.position.set(x,H(x,z)+.04,z);root.add(m);}}
  if(!(ENV[def.env]&&ENV[def.env].inside))for(let i=0;i<5;i++){const a=rnd(0,6.28),r=rnd(95,140);LV.emit.push({pos:new V3(Math.cos(a)*r,H(Math.cos(a)*r,Math.sin(a)*r)+2,Math.sin(a)*r),type:'bsmoke',rate:.35,t:0,ttl:1e9});}
  if(def.weather||ENV[def.env].night||def.env==='rain'){const mt=softSprite(new THREE.SpriteMaterial({map:PT.smoke,color:def.snow?0xdfe6ee:ENV[def.env].night?0x2a3240:0x8a9088,transparent:true,opacity:.14,depthWrite:false}),{noise:.5,hard:.05});LV.mist=[];
    for(let i=0;i<14;i++){const s=new THREE.Sprite(mt);s.scale.set(rnd(18,30),rnd(4,7),1);s.position.set(rnd(-60,60),1.5,rnd(-60,60));root.add(s);LV.mist.push(s);}}}
function pointFreeRaw(x,z){for(const c of LV.colliders){if(x>c.minx-.6&&x<c.maxx+.6&&z>c.minz-.6&&z<c.maxz+.6)return false;}if(LV.noGrass)for(const r of LV.noGrass)if(x>r[0]-.6&&x<r[1]+.6&&z>r[2]-.6&&z<r[3]+.6)return false;return true;}
function updDressing(dt){if(!LV)return;if(LV.lods&&LV.lods.length){LV.lodT=(LV.lodT||0)-dt;if(LV.lodT<=0){LV.lodT=.35;for(const L of LV.lods)updLOD(L);}}const c=camera.position;if(LV.mist)for(const s of LV.mist){s.position.x+=dt*.6;if(Math.abs(s.position.x-c.x)>60)s.position.x=c.x+(s.position.x>c.x?-58:58);if(Math.abs(s.position.z-c.z)>60)s.position.z=c.z+rnd(-55,55);s.position.y=H(s.position.x,s.position.z)+1.4;}
  for(const l of LV.lights)if(l.userData.fire)l.intensity=l.userData.base*(.75+Math.random()*.5);
  if(ENV[ENV_CUR].night&&!ENV[ENV_CUR].inside&&state==='play'){LV.flT=(LV.flT??rnd(3,8))-dt;if(LV.flT<=0){LV.flT=rnd(3,9);LV.flash=.22;SND.boom(rnd(500,900));}
    if(LV.flash>0){LV.flash-=dt;hemi.intensity=ENV[ENV_CUR].hemiI+Math.max(0,LV.flash)*4;hemi.color.setHex(0xffa860);}else{hemi.intensity=ENV[ENV_CUR].hemiI;hemi.color.setHex(ENV[ENV_CUR].hemiS);}}}
// ================= REAL MODELS: per-mission assets, builder skins, LOD scatter =================
const CHAR_FILES={axisW:'chars/german_winter',usW:'chars/us_winter',ranger:'chars/us_ranger',officer:'chars/german_officer',nightjar:'chars/nightjar',kessler:'chars/kessler'};
const CHLOAD={};
function loadCharKey(k){if(CHLOAD[k])return CHLOAD[k];return CHLOAD[k]=mkLoader().loadAsync(BASE+'models/'+CHAR_FILES[k]+'.glb').then(g=>{const b=new THREE.Box3().setFromObject(g.scene);const h=b.max.y-b.min.y;const tall=k==='kessler'?1.86:k==='nightjar'?1.7:1.78;const sc=tall/(h||tall);
  g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;if(o.material)o.material.envMapIntensity=.4;}});CHAR[k]=[{scene:g.scene,anims:g.animations,scale:sc,minY:b.min.y,file:k}];}).catch(e=>console.warn('char',k,e&&e.message));}
const LV_ASSETS={
  2:{m:['farmhouse','barn','hedge','oak','mgNest','opel','crates','ammo','drum','rock','jeep','sherman','radio'],c:['nightjar']},
  3:{m:['paris','lamp','cafe','wreck','loco','freight','opel','kubel','crates','drum','rubble','ammo'],c:['nightjar','officer']},
  4:{m:['ruinA','ruinB','church','oak','dead','panzer','flak','opel','halftrack','crates','drum','rubble','ammo'],c:['officer']},
  5:{m:['bridge','bridgeTower','oak','farmhouse','ruinA','ruinB','opel','halftrack','sherman','jeep','crates','ammo','radio'],c:['ranger']},
  6:{m:['pine','dead','rock','barn','crates','ammo','docs','drum','radio'],c:['officer']},
  7:{m:['snowpine','rockSnow','tiger','opel','kubel','halftrack','crates','drum','ammo'],c:['axisW','usW','nightjar'],arms:1},
  8:{m:['belgian','ruinA','church','snowpine','chute','opel','jeep','sherman','panzer','lamp','crates','drum','ammo'],c:['axisW','usW'],arms:1},
  9:{m:['bridge','bridgeTower','ruinB','rock','oak','loco','freight','flak','opel','halftrack','sherman','crates','ammo'],c:['ranger','officer']},
  10:{m:['snowpine','rockSnow','cellDoor','mapTable','searchlight','opel','kubel','lamp','crates','ammo','radio','docs','drum'],c:['axisW','officer','kessler','nightjar'],arms:1}};
const LV_TEAM={7:{axis:'axisW',us:'usW'},8:{axis:'axisW',us:'usW'},10:{axis:'axisW'}};
function teamKey(team){if(team!=='us'&&team!=='axis')return CHAR[team]&&CHAR[team].length?team:(CHAR_FILES[team]?(team==='kessler'||team==='officer'||team==='axisW'?'axis':'us'):team);
  const m=CUR!==1&&LV_TEAM[CUR]&&LV_TEAM[CUR][team];return m&&CHAR[m]&&CHAR[m].length?m:team;}
async function ensureLevelAssets(n,onProg){const a=LV_ASSETS[n];if(!a)return;let done=0;const tot=a.m.length+a.c.length+(a.arms?1:0);const step=()=>{onProg&&onProg(++done/tot);};
  await Promise.all([...a.m.map(k=>AS.loadModel(mkLoader,BASE,k).then(step)),...a.c.map(k=>loadCharKey(k).then(step)),a.arms?loadWinterArms().then(step):null]);}
// winter gloves/sleeves for the first-person arms (same rig, swap materials)
let ARMS_W=null,ARMS_MATS=null;
function loadWinterArms(){if(ARMS_W)return Promise.resolve();return mkLoader().loadAsync(BASE+'models/fp_arms_us_winter.glb').then(g=>{ARMS_W=[];g.scene.traverse(o=>{if(o.isMesh){const m=o.material.clone();m.fog=false;ARMS_W.push(m);}});}).catch(()=>{ARMS_W=[];});}
function setArmsSkin(winter){if(!ARMS||!ARMS.root)return;const ms=[];ARMS.root.traverse(o=>{if(o.isMesh)ms.push(o);});if(!ARMS_MATS)ARMS_MATS=ms.map(m=>m.material);
  ms.forEach((m,i)=>{m.material=winter&&ARMS_W&&ARMS_W[i]?ARMS_W[i]:ARMS_MATS[i];});}

const TRUNK_GEO=new THREE.CylinderGeometry(.32,.4,5,6);
const LODG={};function lodGeo(k){if(LODG[k])return LODG[k];const C=cmat();let g,m;
  const lm=c=>new THREE.MeshStandardMaterial({color:c,roughness:1,flatShading:true});
  if(k==='pine'){g=new THREE.ConeGeometry(4.2,15.5,7);g.translate(0,10.3,0);m=lm(0x223020);}
  else if(k==='snowpine'){g=new THREE.ConeGeometry(3.6,12.5,7);g.translate(0,8.4,0);m=lm(0x46554c);}
  else if(k==='oak'){g=new THREE.IcosahedronGeometry(4.4,1);g.scale(1,.75,1);g.translate(0,6.8,0);m=lm(0x2f3d1d);}
  else if(k==='dead'){g=new THREE.CylinderGeometry(.15,.35,6.5,5);g.translate(0,3.2,0);m=MAT.trunk;}
  else{g=new THREE.IcosahedronGeometry(1.45,1);g.scale(1,.85,.8);g.translate(0,1.2,0);m=C.hedge;}
  return LODG[k]={g,m};}
function lodDist(){return ({low:38,medium:60,high:90,ultra:140})[S.quality]||60;}
function makeLOD(key,mats,root){if(!mats.length)return;const hi=AS.instance(key,mats,root);if(!hi.length)return;const {g,m}=lodGeo(key);const lo=new THREE.InstancedMesh(g,m,mats.length);mats.forEach((M,i)=>lo.setMatrixAt(i,M));lo.computeBoundingSphere();lo.castShadow=true;lo.receiveShadow=true;root.add(lo);
  const L={key,mats,hi,lo,pos:mats.map(M=>new V3().setFromMatrixPosition(M))};LV.lods.push(L);updLOD(L,true);}
const _lm=new THREE.Matrix4();
function updLOD(L){const c=camera.position,d2=lodDist()**2;const parts=AS.MODELS[L.key].parts;let h=0,l=0;
  for(let i=0;i<L.mats.length;i++){const dx=L.pos[i].x-c.x,dz=L.pos[i].z-c.z;if(dx*dx+dz*dz<d2){for(let p=0;p<parts.length;p++){_lm.multiplyMatrices(L.mats[i],parts[p].mat4);L.hi[p].setMatrixAt(h,_lm);}h++;}else L.lo.setMatrixAt(l++,L.mats[i]);}
  for(const im of L.hi){im.count=h;im.instanceMatrix.needsUpdate=true;}L.lo.count=l;L.lo.instanceMatrix.needsUpdate=true;}
function flushLODs(){for(const k in LV.inst)makeLOD(k,LV.inst[k],LV.root);LV.inst={};}

// mesh collision helpers (buildings with interiors, stairs, upper floors)
const _rc=new THREE.Raycaster();_rc.firstHitOnly=true;const _ro=new V3(),_rn=new V3();const DOWN=new V3(0,-1,0),UP=new V3(0,1,0);
const DIR8=[...Array(8)].map((_,i)=>new V3(Math.cos(i*Math.PI/4),0,Math.sin(i*Math.PI/4)));
function nearCols(x,y,z,r){const out=[];if(!LV||!LV.colMeshes)return out;for(const m of LV.colMeshes){const s=m.userData.sphere;const dx=s.center.x-x,dy=s.center.y-y,dz=s.center.z-z;if(dx*dx+dy*dy+dz*dz<(s.radius+r)**2)out.push(m);}return out;}
function hitN(h){return _rn.copy(h.face.normal).transformDirection(h.object.matrixWorld);}
function meshGround(x,z,fromY,far,L){L=L||nearCols(x,fromY,z,2);if(!L.length)return -Infinity;_rc.set(_ro.set(x,fromY,z),DOWN);_rc.far=far;const hs=_rc.intersectObjects(L,false);hs.sort((a,b)=>a.distance-b.distance);for(const h of hs){if(hitN(h).y>.5)return h.point.y;}return -Infinity;}
function meshCollidePlayer(R,hgt,ground,dt){const L=nearCols(pl.pos.x,pl.pos.y+1,pl.pos.z,3);if(!L.length)return ground;
  for(const hh of [.62,Math.max(.7,Math.min(1.45,hgt-.15))]){for(const d of DIR8){_rc.set(_ro.set(pl.pos.x,pl.pos.y+hh,pl.pos.z),d);_rc.far=R;const hs=_rc.intersectObjects(L,false);let best=null;for(const h of hs)if(!best||h.distance<best.distance)best=h;
      if(best){const n=hitN(best);if(Math.abs(n.y)<.65){const pen=R-best.distance;pl.pos.x-=d.x*pen;pl.pos.z-=d.z*pen;const vn=pl.vel.x*d.x+pl.vel.z*d.z;if(vn>0){pl.vel.x-=d.x*vn;pl.vel.z-=d.z*vn;}}}}}
  const g=meshGround(pl.pos.x,pl.pos.z,pl.pos.y+.62,.62+Math.max(.45,-pl.vel.y*dt*2),L);if(g>ground)ground=g;
  if(pl.vel.y>0){_rc.set(_ro.set(pl.pos.x,pl.pos.y+.5,pl.pos.z),UP);_rc.far=hgt;if(_rc.intersectObjects(L,false).length)pl.vel.y=0;}
  return ground;}

// skin the procedural builder: same gameplay layout, real models on top
function skinBuilder(B,root,stat,coll){const C=cmat();LV.colMeshes=[];LV.noGrass=[];LV.inst={};LV.lods=[];LV.tanks=[];LV.doors=[];
  const unstat=g=>{const set=new Set();g.traverse(o=>{if(o.isMesh)set.add(o);});for(let i=stat.length-1;i>=0;i--)if(set.has(stat[i]))stat.splice(i,1);};
  const hide=g=>g.traverse(o=>{if(o.isMesh){o.visible=false;o.castShadow=false;}});
  const newKids=(n0)=>root.children.slice(n0);
  const put=(key,x,y,z,ry=0,s=1,opt={})=>{const m=AS.clone(key);if(!m)return null;const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=ry;g.add(m);
    if(typeof s==='number')m.scale.setScalar(s);else m.scale.set(s[0],s[1],s[2]);
    if(opt.center){const M=AS.MODELS[key];const c=M.box.getCenter(new V3());m.position.set(-c.x*m.scale.x,-M.box.min.y*m.scale.y,-c.z*m.scale.z);}
    m.traverse(o=>{if(/^Door/.test(o.name)&&opt.openDoors!==false){o.rotation.y+=(o.name==='Door_Right'?-1:1)*1.45;}});
    root.add(g);g.updateMatrixWorld(true);
    if(opt.mesh){const p=AS.colProxy(key,m.matrixWorld);if(p){stat.push(p);if(opt.walk!==false){LV.colMeshes.push(p);const b=new THREE.Box3().setFromObject(m);LV.noGrass.push([b.min.x,b.max.x,b.min.z,b.max.z]);}}}
    else if(opt.stat!==false)m.traverse(o=>{if(o.isMesh)stat.push(o);});
    if(opt.box){const b=new THREE.Box3().setFromObject(m);const sh=opt.box===true?0:opt.box;coll.push({minx:b.min.x+sh,maxx:b.max.x-sh,minz:b.min.z+sh,maxz:b.max.z-sh,miny:b.min.y,maxy:b.max.y});}
    return g;};
  B.put=put;
  const skin=(fn,after)=>(...a)=>{const n0=root.children.length,s0=stat.length,c0=coll.length;const r=fn(...a);const kids=newKids(n0);return after(r,kids,a,{s0,c0})??r;};
  // --- trees & hedges -> LOD instancing ---
  const tree0=B.tree;
  B.tree=(x,z,kind='oak',s=1)=>{let k=kind==='snowpine'?'snowpine':kind==='pine'?'pine':'oak';if(k==='oak'&&AS.has('dead')&&(CUR===4||CUR===6)&&Math.random()<.22)k='dead';if(k==='pine'&&AS.has('dead')&&CUR===6&&Math.random()<.12)k='dead';
    if(!AS.has(k))return tree0(x,z,kind,s);const y=H(x,z);const sc=s*rnd(.88,1.12)*(k==='oak'?.85:k==='pine'?.82:k==='dead'?1.1:.95);
    (LV.inst[k]=LV.inst[k]||[]).push(new THREE.Matrix4().compose(new V3(x,y-.2,z),new THREE.Quaternion().setFromAxisAngle(UP,rnd(0,6.28)),new V3(sc,sc*rnd(.92,1.1),sc)));
    const t=new THREE.Mesh(TRUNK_GEO,AS.COLMAT);t.position.set(x,y+2.5*sc,z);t.scale.set(sc,sc,sc);root.add(t);t.updateMatrixWorld(true);stat.push(t);
    coll.push({minx:x-.38*sc,maxx:x+.38*sc,minz:z-.38*sc,maxz:z+.38*sc,miny:y-1,maxy:y+4.5*sc});};
  const hedge0=B.hedge;
  B.hedge=(x1,z1,x2,z2,gaps=[])=>{if(!AS.has('hedge'))return hedge0(x1,z1,x2,z2,gaps);const n0=root.children.length;hedge0(x1,z1,x2,z2,gaps);for(const o of root.children.slice(n0)){o.visible=false;o.castShadow=false;}
    const L=Math.hypot(x2-x1,z2-z1),ux=(x2-x1)/L,uz=(z2-z1)/L,ry=Math.atan2(ux,uz)+Math.PI/2;const sp=2.55;
    for(let t=0;t<=L;t+=sp){if(gaps.some(g=>Math.abs(t-g)<2.6))continue;const x=x1+ux*t+rnd(-.25,.25),z=z1+uz*t+rnd(-.25,.25);const s=rnd(.95,1.2);
      (LV.inst.hedge=LV.inst.hedge||[]).push(new THREE.Matrix4().compose(new V3(x,H(x,z)-.1,z),new THREE.Quaternion().setFromAxisAngle(UP,ry+rnd(-.25,.25)+(Math.random()<.5?Math.PI:0)),new V3(s,s*rnd(.95,1.2),s)));}};
  // --- houses -> farmhouse / barn / ruins / Belgian townhouse with walkable interiors ---
  const house0=B.house;let hc=0;
  B.house=(x,z,w,d,o={})=>{const key=o.ruined?(hc++%2?'ruinB':'ruinA'):(CUR===7||CUR===8)?'belgian':o.flat?'barn':'farmhouse';if(!AS.has(key))return house0(x,z,w,d,o);
    const M=AS.MODELS[key];const c0=coll.length;const g=house0(x,z,w,d,o);hide(g);unstat(g);coll.length=c0;
    const s=clamp(Math.min(w/M.size.x,d/M.size.z)*1.06,.72,1.3);let gy=-1e9,ga=0;for(const [ax,az] of [[0,0],[-.45,-.45],[.45,-.45],[-.45,.45],[.45,.45]]){const h=H(x+ax*w,z+az*d);gy=Math.max(gy,h);ga+=h/5;}put(key,x,(gy+ga)/2-.02,z,o.rot||0,s,{center:true,mesh:true});
    if(o.ruined&&AS.has('rubble')&&Math.random()<.7)put('rubble',x+rnd(-w/2,w/2),H(x,z),z+rnd(-d/2,d/2),rnd(0,6),rnd(.9,1.4));return g;};
  // --- church: real nave + bell tower (sniper balcony) ---
  const church0=B.church;
  B.church=(x,z)=>{if(!AS.has('church'))return church0(x,z);const g=put('church',x,H(x,z)-.18,z-4,0,1,{center:true,mesh:true});LV.church=g;
    const t=AS.node(g,'BellTower');if(t){const b=new THREE.Box3().setFromObject(t);LV.tower=b;}return g;};
  // --- city blocks -> Parisian apartment facades ---
  const block0=B.block;
  B.block=(x,z,w,d,h,mat)=>{if(!AS.has('paris'))return block0(x,z,w,d,h,mat);const n0=root.children.length;const r=block0(x,z,w,d,h,mat);for(const o of root.children.slice(n0)){o.visible=false;o.castShadow=false;}
    const M=AS.MODELS.paris;const front=x>0?-1:1;const ry=front>0?Math.PI/2:-Math.PI/2;const along=d,deep=w;const n=Math.max(1,Math.round(along/M.size.x));const sx=along/(n*M.size.x),sz=deep/M.size.z,sy=clamp((sx+sz)/2*(h<11?.62:.82),.5,1.1);
    for(let i=0;i<n;i++){const zz=z-along/2+(i+.5)*along/n;put('paris',x,H(x,zz)-.1,zz,ry,[sx,sy,sz],{center:true,stat:false});}return r;};
  // --- vehicles ---
  const truck0=B.truck;let tc=0;
  B.truck=(x,z,ry=0)=>{const key=(CUR===5||CUR===9)&&tc%2===1&&AS.has('halftrack')?'halftrack':CUR===10&&tc%2===1&&AS.has('kubel')?'kubel':'opel';tc++;if(!AS.has(key))return truck0(x,z,ry);return put(key,x,H(x,z)-.03,z,ry,1,{box:.15});};
  const train0=B.traincar;
  B.traincar=(x,z,len=12,loco=false)=>{const key=loco?'loco':'freight';if(!AS.has(key))return train0(x,z,len,loco);const M=AS.MODELS[key];return put(key,x,H(x,z),z,0,loco?1:[1,1,len/M.size.z],{center:true,box:.1});};
  const atgun0=B.atgun;
  B.atgun=(x,z,ry=0)=>{const key=CUR===4&&AS.has('flak')?'flak':'pak';if(!AS.has(key))return atgun0(x,z,ry);return put(key,x,H(x,z)-.02,z,ry,1,{box:.4});};
  // --- props ---
  const lamp0=B.lamp;
  B.lamp=(x,z,light=true)=>{if(!AS.has('lamp'))return lamp0(x,z,light);const n0=root.children.length;lamp0(x,z,light);for(const o of root.children.slice(n0))if(o.isMesh){o.visible=false;o.castShadow=false;}put('lamp',x,H(x,z),z,rnd(0,6.28),.9,{box:.25});};
  const crates0=B.crates;
  B.crates=(x,z,n=3)=>{if(!AS.has('crates'))return crates0(x,z,n);put('crates',x,H(x,z),z,rnd(0,6.28),1.15,{box:true});if(n>3&&AS.has('ammo'))put('ammo',x+rnd(-2,2),H(x,z),z+rnd(1.2,2),rnd(0,6.28),1.2,{});};
  const barrel0=B.barrel;
  B.barrel=(x,z,fire)=>{if(!AS.has('drum'))return barrel0(x,z,fire);const n0=root.children.length;barrel0(x,z,fire);for(const o of root.children.slice(n0))if(o.isMesh){o.visible=false;o.castShadow=false;}put('drum',x,H(x,z),z,rnd(0,6.28),1.05,{stat:false});};
  const rock0=B.rock;
  B.rock=(x,z,s=4)=>{const key=(CUR===7||CUR===10)&&AS.has('rockSnow')?'rockSnow':'rock';if(!AS.has(key))return rock0(x,z,s);const m=rock0(x,z,s);m.visible=false;m.castShadow=false;
    const g=put(key,x,H(x,z)-s*.18,z,rnd(0,6.28),[s*1.05,s*rnd(.75,1.05),s*1.05],{stat:false});return m;};
  const item0=B.item;
  B.item=(x,z)=>skinItem(item0(x,z));
  const bridge0=B.bridge;
  B.bridge=(x,z0,z1,w,y)=>{if(!AS.has('bridge'))return bridge0(x,z0,z1,w,y);const n0=root.children.length;bridge0(x,z0,z1,w,y);for(const o of root.children.slice(n0))if(o.isMesh){o.visible=false;o.castShadow=false;}
    const M=AS.MODELS.bridge;const L=Math.abs(z1-z0),n=Math.max(1,Math.round(L/M.size.z)),sz=L/(n*M.size.z),sx=(w+1.2)/M.size.x;
    for(let i=0;i<n;i++){const zz=Math.min(z0,z1)+(i+.5)*L/n;put('bridge',x,y-3*1,zz,0,[sx,1,sz],{mesh:true,walk:false});}
    if(AS.has('bridgeTower'))for(const zz of[z0,z1]){put('bridgeTower',x,y-3,zz+(zz>0?3:-3),zz>0?0:Math.PI,[(w+5)/12,1,1],{mesh:true,walk:false});}};
}
function skinItem(g){const key=CUR===8?'chute':CUR===6||CUR===10?'docs':'ammo';if(AS.has(key)){g.children.forEach(c=>c.visible=false);const m=AS.clone(key);m.scale.setScalar(key==='chute'?1:1.3);m.position.y=key==='chute'?-.9:-.45;g.add(m);}return g;}

// ---- eye adaptation: step inside a building and exposure slowly opens up; step out and bright daylight blooms back ----
const FILL=new THREE.AmbientLight(0xe0d6c4,0);scene.add(FILL);
const EYE={k:1,t:0,inside:0},_ed=new V3(),EYED=[[0,1,0],[.6,.8,0],[-.6,.8,0],[0,.8,.6],[0,.8,-.6],[1,.12,0],[-1,.12,0],[0,.12,1],[0,.12,-1]];
function updEye(dt){if(!LV||!LV.colMeshes||!LV.colMeshes.length||(ENV[ENV_CUR]&&ENV[ENV_CUR].inside)){if(EYE.k!==1){EYE.k=1;renderer.toneMappingExposure=EXPO_BASE;FILL.intensity=0;}return;}
  EYE.t-=dt;if(EYE.t<=0){EYE.t=.15;const c=camera.position;const L=nearCols(c.x,c.y,c.z,6);let b=0;if(L.length)for(const d of EYED){_rc.set(c,_ed.set(d[0],d[1],d[2]).normalize());_rc.far=16;if(_rc.intersectObjects(L,false).length)b++;}EYE.inside=b/EYED.length;}
  const tgt=1+Math.pow(EYE.inside,1.3)*1.2;EYE.k+=(tgt-EYE.k)*Math.min(1,dt*(tgt>EYE.k?.7:1.8));renderer.toneMappingExposure=EXPO_BASE*EYE.k;FILL.intensity=(EYE.k-1)*1.1*hemi.intensity;}
// ---- clutter: debris, crates and drums gathered along building walls ----
function clutter(B,n){if(!LV.noGrass||!LV.noGrass.length)return;const keys=[];if([3,4,5,9].includes(CUR))keys.push('rubble','rubble');keys.push('crates','drum','ammo');if(CUR>=3)keys.push('rubble');
  let placed=0,tries=0;while(placed<n&&tries<n*8){tries++;const r=LV.noGrass[(Math.random()*LV.noGrass.length)|0];const side=(Math.random()*4)|0;const off=rnd(.9,2.2);
    let x,z;if(side<2){x=rnd(r[0],r[1]);z=side?r[3]+off:r[2]-off;}else{z=rnd(r[2],r[3]);x=side===2?r[1]+off:r[0]-off;}
    if(!pointFreeRaw(x,z))continue;const k=keys[(Math.random()*keys.length)|0];if(!AS.has(k))continue;B.put(k,x,H(x,z),z,rnd(0,6.28),k==='rubble'?rnd(.8,1.5):k==='ammo'?1.2:1,{stat:k!=='rubble',box:k==='crates'?true:false});placed++;}}
// extra set dressing per mission (vehicles, props, nests, searchlights)
const DECOR={
  2:B=>{B.put('jeep',7,H(7,80),78,.5,1,{box:.1});B.put('sherman',-9,H(-9,76),74,.15,1,{box:.2});B.put('radio',2,H(2,-70)+.05,-70.5,0,1,{});for(const x of[-20,26])B.put('mgNest',x,H(x,35.2)-.05,35.2,Math.PI,1,{mesh:true});B.put('ammo',-12,H(-12,36),35.6,.3,1.2,{});},
  3:B=>{for(const [x,z,r] of [[-6,58,.4],[5,38,-2.6],[-4,-2,1.2]])B.put('wreck',x,H(x,z),z,r,1,{box:.1});for(const [x,z] of [[-8,64],[8,22],[-9,-8]])B.put('cafe',x,H(x,z),z,rnd(0,6),1,{});for(const [x,z] of [[9,48],[-10,30],[2,-14],[-14,-36]])B.put('rubble',x,H(x,z),z,rnd(0,6),rnd(1,1.6),{});B.put('kubel',4,H(4,6),6,1.4,1,{box:.1});},
  4:B=>{B.put('halftrack',-12,H(-12,-6),-6,.9,1,{box:.15});for(let i=0;i<8;i++){const x=rnd(-40,40),z=rnd(-60,60);B.put('rubble',x,H(x,z),z,rnd(0,6),rnd(1,1.8),{});}},
  5:B=>{B.put('sherman',-4,H(-4,74),74,.1,1,{box:.2});B.put('jeep',8,H(8,78),78,-.4,1,{box:.1});B.put('ammo',-5,H(-5,41),41,0,1.2,{});B.put('radio',3,H(3,43),43,0,1,{});},
  6:B=>{B.put('radio',-2,H(-2,-90)+.05,-89,0,1,{});B.put('ammo',-8,H(-8,-81),-81,.3,1.2,{});B.put('drum',7,H(7,-84),-84,0,1,{});},
  7:B=>{B.put('kubel',-14,H(-14,30),30,2.4,1,{box:.1});B.put('halftrack',18,H(18,-30),-30,.4,1,{box:.15});for(const [x,z] of [[16,-48],[26,-50],[20,-58]])B.put('ammo',x+1,H(x+1,z),z+1.3,rnd(0,6),1.2,{});},
  8:B=>{B.put('jeep',-6,H(-6,22),22,.8,1,{box:.1});B.put('sherman',14,H(14,26),26,2.6,1,{box:.2});},
  9:B=>{B.put('flak',-18,H(-18,-48),-48,Math.PI,1,{box:.4});B.put('halftrack',4,H(4,-70),-70,.2,1,{box:.15});B.put('sherman',-4,H(-4,70),70,.2,1,{box:.2});B.put('loco',-30,H(-30,-75),-75,0,1,{center:true,box:.1});},
  10:B=>{for(const x of[-22,22])B.put('searchlight',x,H(x,-36),-36,x<0?.5:-.5,1.1,{box:.2});if(LV.cell)B.put('cellDoor',LV.cell[0],0,LV.cell[1]+2,0,1,{box:.05});B.put('mapTable',-46,0,-96,0,1,{box:.1});B.put('radio',-40,0,-98.6,0,1,{});B.put('docs',-46,1.42,-96,0,1,{});}};

// ================= ARMOUR: hostile tanks that track, fire and can be destroyed =================
// def.tanks=[{oi,key,at:[x,z],ry,hp}] spawn when that objective starts
function spawnTank(t){const key=AS.has(t.key)?t.key:AS.has('panzer')?'panzer':null;if(!key||!LV)return null;const [x,z]=t.at;const g=AS.clone(key);g.position.set(x,H(x,z)-.05,z);g.rotation.y=t.ry||0;LV.root.add(g);g.updateMatrixWorld(true);
  g.traverse(o=>{if(o.isMesh){o.material=o.material.clone();statics.push(o);}});const b=new THREE.Box3().setFromObject(g);const c={minx:b.min.x+.2,maxx:b.max.x-.2,minz:b.min.z+.2,maxz:b.max.z-.2,miny:b.min.y,maxy:b.max.y};colliders.push(c);
  const T={g,key,turret:AS.node(g,'Turret'),gun:AS.node(g,'Gun'),hp:(t.hp||(key==='tiger'?4:3))*(1+(MD()-1)*.35),alive:true,cool:rnd(5,8),aim:0,col:c,warned:false};T.maxhp=T.hp;LV.tanks.push(T);rebuildHit();
  feed('<b>⚠ ENEMY ARMOR</b> ▸ '+(key==='tiger'?'Tiger I':'Panzer IV'));return T;}
function tankMuzzle(T){const p=new V3(0,0,3.2);if(T.gun){T.gun.updateMatrixWorld(true);const gb=new THREE.Box3().setFromObject(T.gun);const gc=gb.getCenter(new V3());const yaw=T.g.rotation.y+(T.turret?T.turret.rotation.y:0);return gc.add(new V3(Math.sin(yaw)*2.4,.05,Math.cos(yaw)*2.4));}return T.g.localToWorld(p);}
function updTanks(dt){if(!LV||!LV.tanks)return;for(const T of LV.tanks){if(!T.alive)continue;const dx=pl.pos.x-T.g.position.x,dz=pl.pos.z-T.g.position.z,dist=Math.hypot(dx,dz);
    const want=Math.atan2(dx,dz)-T.g.rotation.y;const cur=T.turret?T.turret.rotation.y:0;let df=((want-cur+Math.PI*3)%(Math.PI*2))-Math.PI;const rate=(T.key==='tiger'?.32:.42)*dt;df=clamp(df,-rate,rate);if(T.turret)T.turret.rotation.y=cur+df;
    if(T.gun)T.gun.rotation.x=lerp(T.gun.rotation.x,-clamp(Math.atan2(pl.pos.y+1-T.g.position.y-2.2,dist),-.15,.25),dt*2);
    if(state!=='play'||!pl.alive)continue;if(!T.warned&&dist<120){T.warned=true;sayV('SGT. MILLER','Panzer! Rifles won\'t scratch it — hit it with grenades!',3.2,'m_tank');}
    T.cool-=dt;if(T.cool<=0&&dist<150&&Math.abs(((want-(T.turret?T.turret.rotation.y:0)+Math.PI*3)%(Math.PI*2))-Math.PI)<.12){const from=tankMuzzle(T);const eye=eyePos();if(blocked(from,eye)){T.cool=1.2;continue;}
      T.cool=rnd(6.5,9.5)/Math.sqrt(MD());emit('mflash',from,1);emit('smoke',from,6);emit('dirt',T.g.position.clone(),6);at(from,()=>SND.boom(dist*.6));rumble(90,.25);if(S.shake)shake=Math.max(shake,clamp(1-dist/80,0,.6));
      const spread=clamp(dist*.075,1.6,9)/Math.sqrt(MD())*(pl.stance===2?1.4:1)*(pl.sprint?1.5:1);const tgt=pl.pos.clone().add(new V3(rnd(-spread,spread),0,rnd(-spread,spread)));tgt.y=groundAt(tgt.x,tgt.z);
      tracer(from,tgt,0xffc070);setTimeout(()=>{if(state==='play'||state==='pause')explode(tgt,true,'enemy');},Math.min(900,dist*4));}}}
function damageTanks(p,big){if(!LV||!LV.tanks)return;for(const T of LV.tanks){if(!T.alive)continue;const d=p.distanceTo(T.g.position);if(d>(big?7:5.5))continue;T.hp-=big?2:1.15*(1-d/7)+.35;hitmark(false);
    if(T.hp<=0){T.alive=false;const c=T.g.position.clone().add(new V3(0,1.5,0));explode(c,true,null);setTimeout(()=>explode(c.clone().add(new V3(0,1,0)),true,null),350);
      T.g.traverse(o=>{if(o.isMesh){o.material.color.multiplyScalar(.28);o.material.roughness=1;}});if(T.turret){T.turret.rotation.z=rnd(-.2,.2);T.turret.position.y+=.15;}
      LV.emit.push({pos:c.clone().add(new V3(0,1,0)),type:'bsmoke',rate:.35,t:0,ttl:1e9},{pos:c.clone(),type:'fire',rate:.08,t:0,ttl:40});emitters.length=0;emitters.push(...LV.emit);
      stats.score+=500;xp('+500 TANK DESTROYED');feed('<b>Kane</b> ▸ '+(T.key==='tiger'?'Tiger I':'Panzer IV')+' <em>(destroyed)</em>');}}}
// tanks added to missions (spawn with the objective index)
const TANKS={4:[{oi:2,key:'panzer',at:[-8,-78],ry:0},{oi:2,key:'panzer',at:[30,-92],ry:-.3}],7:[{oi:0,key:'tiger',at:[-36,28],ry:1.9},{oi:3,key:'tiger',at:[46,-104],ry:-.4}],8:[{oi:3,key:'panzer',at:[2,-82],ry:0},{oi:3,key:'panzer',at:[-70,30],ry:1.6}],10:[{oi:0,key:'panzer',at:[22,-30],ry:-.9}]};
// heroes: Nightjar fights beside you (cannot die); Kessler gets his own model
function spawnNightjar(x,z){if(!CHAR.nightjar||!LV)return null;if(LV.nj&&LV.nj.alive)return LV.nj;const a=spawnAlly(x,z,x,z,0,false,{model:'nightjar',wid:'m1911'});a.hero=true;a.name='NIGHTJAR';LV.nj=a;return a;}

// ---------- the nine new missions ----------
const LEVELS={};
const riverH=(x,z)=>{const d=Math.abs(z);const bank=d<26?-4+(d/26)*2:d<32?-2+(d-26)/6*5:3+nz(x,z,.25);return bank;};
const riverCol=(x,z,y)=>y<-1?0x3b3a33:y<2.6?0x6b6250:0x5a6438;
LEVELS[2]={title:'HEDGEROW HELL',op:'OPERATION OVERLORD',place:'Bocage country, Normandy',date:'June 12, 1944 — 14:10',env:'day',grass:18000,artillery:false,
  brief:['Six days after D-Day, the advance has stalled in the bocage — a maze of ancient hedgerows, each one a natural fortress.','A Resistance radio operator, code-named Nightjar, has asked for an American unit at a farmhouse south of Saint-Lô. She says she has information worth dying for.','Break through the hedgerows, reach the farm, and keep her alive.'],
  H:(x,z)=>nz(x,z,.9),col:(x,z,y)=>y>1.5?0x55663a:0x4c5a32,start:[0,85,0],
  build(B){B.hedge(-110,40,110,40,[110-20,110+25]);B.hedge(-110,0,110,0,[110+5]);B.hedge(-110,-40,110,-40,[110-30,110+30]);B.hedge(-60,90,-60,-100);B.hedge(60,90,60,-100);
    B.house(0,-75,12,9,{floors:2,backDoor:true});B.house(-22,-80,8,6,{mat:cmat().stone});B.house(20,-72,7,10,{mat:cmat().stone,flat:true});B.truck(10,-60,.4);B.crates(-8,-62,4);B.sandbags(-20,36,7);B.sandbags(26,36,7);B.barrel(-5,-58,true);
    B.forest(26,-110,-130,110,-95,'oak');B.forest(12,-100,60,-65,100,'oak');B.forest(12,65,60,100,100,'oak');for(let i=0;i<5;i++)B.tree(rnd(-50,50),rnd(-30,-10),'oak');},
  objectives:[
    {type:'clear',text:'Break through the first hedgerow',spawn:[{g:'f1',type:'mg',wid:'mg42',at:[[-20,36.5],[26,36.5]]},{g:'f1',at:[[-35,37],[0,37],[12,38],[40,36]],trench:true}],
      lines:[['LT. HAYES (radio)','Kane, these hedgerows are death traps. Every field is a fortress.','h2_1'],['SGT. MILLER','Stay off the open ground! Hug the hedges!','m2_1']]},
    {type:'clear',text:'Push through the second field',checkpoint:true,spawn:[{g:'f2',at:[[-30,-3],[-10,-2],[5,-3],[22,-2],[38,-3],[0,-20],[-25,-25]],trench:true}],lines:[['PVT. RUIZ','Krauts behind the next hedge!','r2_1']]},
    {type:'reach',text:'Reach the farmhouse',pos:[0,-66],r:6,checkpoint:true,spawn:[{g:'f3',at:[[-20,-45],[20,-48],[0,-52]]}],lines:[['LT. HAYES (radio)','Your contact is at that farm. Code name Nightjar.','h2_2']]},
    {type:'talk',lines:[['NIGHTJAR (radio)','Sergeant Kane. They told me you would come.','n2_1',3.4],['KANE','Nightjar? Where are you?','k2_1',2.4],['NIGHTJAR (radio)','Watching you. The Germans are coming back for this house. Hold it, or we both die here.','n2_2',4.6]]},
    {type:'defend',text:'Hold the farmhouse',pos:[0,-70],checkpoint:true,waves:[{n:6,from:[[-50,-110],[0,-115],[50,-110]]},{n:7,from:[[-70,-60],[-70,-90]]},{n:8,from:[[70,-60],[70,-95],[0,-115]],smg:true}]}
  ],
  outro:[['NIGHTJAR (radio)','You fight well, Americans. Come to Paris. I will show you what they are hiding.','n2_3',4.4],['KANE','Hiding what?','k2_2',2],['NIGHTJAR (radio)','Not on the radio, Sergeant. Paris.','n2_4',3]]};

LEVELS[3]={title:'GHOSTS OF PARIS',op:'THE LIBERATION OF PARIS',place:'Rail yards, northern Paris',date:'August 19, 1944 — 23:40',env:'night',grass:0,artillery:false,
  brief:['Paris is rising. The Resistance is fighting in the streets, and the Germans are pulling out everything they can by rail.','Nightjar has located supply trains loaded with crates stamped with a single word: Götterdämmerung.','Move through the city with her network, reach the rail yard, and burn those trains.'],
  H:(x,z)=>0,col:()=>0x34332f,ground:'cobble',start:[0,85,0],
  build(B){const C=cmat();for(const sx of[-1,1])for(let k=0;k<6;k++){const z=70-k*22;if(z<-20)continue;B.block(sx*16,z,12,16,rnd(10,16),k%2?C.plasterDark:C.plaster);if(k%2===0)B.lamp(sx*8,z+8);}
    B.block(-40,40,14,30,14,C.brick);B.block(40,30,14,30,12,C.plasterDark);B.truck(-5,50,.2);B.crates(6,30,4);B.barrel(-6,20,true);B.sandbags(0,12,7);
    for(const x of[-25,-10,10,25])B.rails(x,-20,-110);B.traincar(-25,-55,12,true);B.traincar(-25,-70,12);B.traincar(-25,-84,12);B.traincar(10,-70,12,true);B.traincar(10,-86,12);B.traincar(25,-50,12);
    B.block(-55,-60,16,40,9,C.brick);B.block(55,-70,16,30,9,C.brick);for(const z of[-40,-80])B.lamp(0,z);B.lamp(40,-12);B.crates(-5,-45,4);B.crates(18,-40,3);B.barrel(30,-30,true);},
  objectives:[
    {type:'reach',text:'Follow Nightjar\'s route to the rail yard',pos:[0,30],r:6,lines:[['NIGHTJAR (radio)','Stay in the shadows. Patrols pass every block.','n3_1',3.4]]},
    {type:'clear',text:'Eliminate the patrol at the barricade',spawn:[{g:'p1',at:[[-3,9],[3,9],[8,6],[-8,5],[0,-2]],trench:true}],lines:[['KANE','Barricade ahead. We go through it.','k3_1',2.6]]},
    {type:'reach',text:'Enter the rail yard',pos:[-2,-30],r:6,checkpoint:true},
    {type:'plant',text:'Plant charges on the supply trains',targets:[[-25,-46],[10,-61]],fuse:5,spawn:[{g:'y1',at:[[-15,-60],[0,-75],[20,-55],[-30,-90],[15,-95],[30,-80]]}],lines:[['NIGHTJAR (radio)','Those trains carry the crates. Burn them all.','n3_2',3.2]]},
    {type:'reach',text:'Escape to the rendezvous',pos:[40,-12],r:5,checkpoint:true,spawn:[{g:'y2',at:[[-20,-100],[0,-105],[25,-100],[45,-60],[-45,-40]],target:[0,-40]}],lines:[['KANE','Charges are hot! Go, go!','k3_2',2.2],['NIGHTJAR (radio)','The alley east of the yard. Run!','n3_3',2.8]]}
  ],
  outro:[['NIGHTJAR','Götterdämmerung. The twilight of the gods.','n3_4',3.4],['KANE','A weapon?','k3_3',1.6],['NIGHTJAR','A plan. I do not know yet. But one name is on every crate. Oberst Wolfram Kessler.','n3_5',5]]};

LEVELS[4]={title:'IRON CORRIDOR',op:'THE FALAISE POCKET',place:'Ruined village near Chambois',date:'August 20, 1944 — 19:05',env:'dusk',grass:9000,artillery:true,
  brief:['The German Seventh Army is trapped in the Falaise Pocket. Its last escape route runs through a ruined crossroads village.','Two 88mm anti-tank guns are stopping our armor from closing the gap.','Clear the village, destroy the guns, and hold the crossroads until the tanks arrive.'],
  H:(x,z)=>nz(x,z,.45),col:(x,z,y)=>Math.abs(x)<5||Math.abs(z)<5?0x6b5f4c:0x5b5f3a,start:[0,85,0],
  build(B){const C=cmat();const spots=[[-18,40],[18,45],[-20,18],[20,20],[-30,-8],[30,-6],[-18,-30],[16,-34],[-34,-48],[34,-50],[-12,62],[14,64]];
    spots.forEach(([x,z],i)=>B.house(x,z,rnd(7,10),rnd(7,9),{ruined:i%3!==0,floors:i%4===0?2:1,mat:i%2?C.stone:C.plaster,rot:x<0?Math.PI/2:-Math.PI/2}));
    B.church(-38,-80);B.tank(6,30,.8);B.tank(-6,-55,2.2);B.truck(8,-12,.3);B.crates(-6,6,4);B.sandbags(-8,-4,7);B.sandbags(10,4,7,Math.PI/2);B.barrel(4,-20,true);B.barrel(-25,35,true);
    LV.atguns=[B.atgun(-25,-20,Math.PI),B.atgun(26,-28,Math.PI)];B.forest(20,-110,-110,110,-95,'oak');B.forest(14,-110,-90,-70,90,'oak');B.forest(14,70,-90,110,90,'oak');},
  objectives:[
    {type:'clear',text:'Clear the village outskirts',spawn:[{g:'v1',at:[[-18,35],[18,40],[-20,14],[22,15],[0,25],[-5,48]]}],lines:[['LT. HAYES (radio)','The whole German Seventh Army is trying to squeeze through that village. Slam the door.','h4_1',4.4]]},
    {type:'plant',text:'Destroy the 88mm anti-tank guns',targets:[[-25,-17],[26,-25]],fuse:4,checkpoint:true,spawn:[{g:'v2',at:[[-28,-14],[-20,-25],[30,-24],[22,-33],[0,-30],[-30,-8],[30,-6]]}],lines:[['LT. HAYES (radio)','Our armor can\'t move until those 88s are gone.','h4_2',3.2]]},
    {type:'defend',text:'Hold the crossroads until the tanks arrive',pos:[0,0],checkpoint:true,waves:[{n:7,from:[[-60,-90],[0,-100],[60,-90]]},{n:8,from:[[-95,-20],[95,-25]],smg:true},{n:9,from:[[-50,-100],[50,-100],[0,-105]]}],lines:[['SGT. MILLER','Here they come! Every gun on that road!','m4_1',3]]}
  ],
  outro:[['LT. HAYES (radio)','Armor\'s through. The pocket is closing. Good work, Kane.','h4_3',3.6],['SGT. MILLER','Funny thing, Sarge. Kessler\'s outfit pulled out east before the trap shut.','m4_2',4],['KANE','Like they knew.','k4_1',1.8]]};

LEVELS[5]={title:'BRIDGE AT NIJMEGEN',op:'OPERATION MARKET GARDEN',place:'River Waal, Nijmegen',date:'September 20, 1944 — 15:30',env:'overcast',grass:6000,artillery:true,
  brief:['Market Garden depends on bridges. The great road bridge at Nijmegen must be taken intact.','German engineers have wired it with demolition charges.','Clear the southern approach, cut the charges, and hold the far end against the counterattack.'],
  H:riverH,col:riverCol,start:[0,85,0],
  build(B){const C=cmat();B.water(-.4,-160,-30,160,30);B.bridge(0,32,-32,8,3);for(const [x,z] of [[-20,50],[22,48],[-35,70],[35,72],[-20,-50],[24,-52],[-38,-70],[40,-72]])B.house(x,z,9,8,{floors:2,mat:x<0?C.brick:C.plaster,rot:x<0?Math.PI/2:-Math.PI/2,ruined:Math.random()<.4});
    B.sandbags(-6,40,7);B.sandbags(6,42,7);B.tank(-12,60,.4);B.truck(12,58,-.3);B.sandbags(0,-40,7);B.sandbags(-8,-42,3.5,Math.PI/2);B.crates(8,-44,3);B.wire(-12,38);B.wire(12,38);B.forest(16,-120,-110,120,-90,'oak');B.forest(12,-120,90,120,110,'oak');},
  objectives:[
    {type:'clear',text:'Clear the southern approach',spawn:[{g:'b1',at:[[-6,38],[6,40],[-20,44],[22,42],[0,34],[-30,60]],trench:true}],lines:[['LT. HAYES (radio)','That bridge is the whole operation, Kane. We need it in one piece.','h5_1',3.8]]},
    {type:'interact',text:'Cut the demolition charges',targets:[[2.5,18],[-2.5,0],[2.5,-18]],hold:2,timeLimit:150,checkpoint:true,label:'cut the demolition charge',spawn:[{g:'b2',at:[[-2,-28],[2,-30],[0,-45],[-8,-44]]}],lines:[['LT. HAYES (radio)','Engineers say the bridge is wired. Cut those charges before they blow it!','h5_2',4]]},
    {type:'clear',text:'Take the north end of the bridge',spawn:[{g:'b3',at:[[-20,-46],[24,-48],[0,-55],[-10,-60],[12,-62]]}]},
    {type:'defend',text:'Hold the bridge against the counterattack',pos:[0,-40],checkpoint:true,waves:[{n:7,from:[[-50,-100],[50,-100]]},{n:8,from:[[0,-110],[-70,-60],[70,-60]],smg:true},{n:9,from:[[-40,-105],[40,-105]]}],lines:[['PVT. RUIZ','Panzergrenadiers! Coming down the road!','r5_1',2.8]]}
  ],
  outro:[['LT. HAYES (radio)','The bridge is ours.','h5_3',2],['PVT. RUIZ','For now, right Sarge?','r5_2',2],['KANE','For now.','k5_1',1.4]]};

LEVELS[6]={title:'THE GREEN HELL',op:'BATTLE OF HÜRTGEN FOREST',place:'Hürtgen Forest, Germany',date:'November 16, 1944 — 08:15',env:'rain',weather:'rain',grass:5000,artillery:true,treeBursts:true,
  brief:['The Hürtgen is a dark, freezing pine forest where the trees themselves become weapons — artillery bursts in the canopy and rains splinters down.','A German courier carrying Kessler\'s orders was last seen at a forest command post.','Push through the bunker line and recover those documents.'],
  H:(x,z)=>nz(x,z,1.6),col:(x,z,y)=>Math.abs(x+Math.sin(z*.05)*8)<4?0x3e3628:0x2f3424,start:[0,85,0],
  build(B){const path=(x,z)=>Math.abs(x+Math.sin(z*.05)*8)<6;B.forest(260,-120,-120,120,120,'pine',(x,z)=>path(x,z)||Math.hypot(x+20,z+30)<10||Math.hypot(x-25,z+60)<10||Math.hypot(x,z+85)<14||Math.hypot(x,z-85)<8);
    B.bunker(-20,-30,0);B.bunker(25,-60,0);B.house(0,-90,8,6,{mat:cmat().wood,flat:true});B.sandbags(-6,-80,7);B.sandbags(6,-80,7);B.crates(4,-92,3);B.wire(-15,-20);B.wire(18,-48);for(let i=0;i<10;i++)B.rock(rnd(-60,60),rnd(-100,60),rnd(1,2.5));},
  objectives:[
    {type:'reach',text:'Advance through the forest',pos:[-6,20],r:7,spawn:[{g:'h1',at:[[-15,25],[12,15],[-25,5],[20,0]]}],lines:[['SGT. MILLER','Tree bursts! Don\'t lie flat — hug a trunk!','m6_1',3.2]]},
    {type:'plant',text:'Destroy the bunkers',targets:[[-20,-25],[25,-55]],fuse:4,checkpoint:true,spawn:[{g:'h2',type:'mg',wid:'mg42',at:[[-20,-27],[25,-57]]},{g:'h2',at:[[-28,-35],[-12,-36],[18,-66],[32,-64],[0,-45]]}]},
    {type:'clear',text:'Clear the command post',checkpoint:true,spawn:[{g:'h3',at:[[-6,-82],[6,-82],[0,-95],[-12,-90],[12,-92],[0,-75]],trench:true}]},
    {type:'pickup',text:'Recover the courier\'s documents',pos:[2,-91],label:'take the documents'}
  ],
  outro:[['KANE','Hayes. These are orders signed by Kessler. Operation Götterdämmerung.','k6_1',3.8],['LT. HAYES (radio)','Then it is real. Get those back to headquarters.','h6_1',3.2]]};

LEVELS[7]={title:'FROZEN FOREST',op:'THE BATTLE OF THE BULGE',place:'The Ardennes, Belgium',date:'December 17, 1944 — 06:50',env:'snow',weather:'snow',grass:0,artillery:true,
  brief:['Hitler has thrown everything he has left into a surprise offensive through the Ardennes.','Your company has been overrun. Survivors are scattered through the frozen forest.','Survive the ambush, regroup, and hold the foxhole line until dawn.'],
  H:(x,z)=>nz(x,z,1.1),col:()=>0xe6ebef,snow:true,start:[0,70,0],
  build(B){B.forest(200,-120,-120,120,120,'snowpine',(x,z)=>Math.hypot(x,z-60)<12||Math.hypot(x+30,z+10)<10||Math.hypot(x-20,z+50)<14||Math.abs(x)<4);
    B.foxhole(16,-48);B.foxhole(26,-50);B.foxhole(20,-58);B.truck(-4,50,.6);B.tank(8,62,2);B.crates(-30,-8,3);B.barrel(-28,-12,true);for(let i=0;i<8;i++)B.rock(rnd(-60,60),rnd(-90,60),rnd(1,2));},
  objectives:[
    {type:'survive',text:'Survive the ambush',time:50,pos:[0,60],from:[[-40,20],[40,25],[-50,60],[50,70]],every:5,max:8,lines:[['PVT. RUIZ','Tanks! Krauts everywhere!','r7_1',2.4],['SGT. MILLER','Find cover and hold on!','m7_1',2.2]]},
    {type:'reach',text:'Regroup with the stragglers',pos:[-30,-10],r:6,checkpoint:true,allies:[[-32,-8],[-28,-12],[-30,-14]]},
    {type:'reach',text:'Reach the foxhole line',pos:[20,-50],r:6,spawn:[{g:'s2',at:[[0,-25],[30,-30],[-10,-40]]}]},
    {type:'defend',text:'Hold the line until dawn',pos:[20,-52],checkpoint:true,waves:[{n:6,from:[[-40,-110],[40,-110]]},{n:7,from:[[-70,-60],[0,-115]]},{n:8,from:[[70,-70],[30,-115]],smg:true},{n:9,from:[[-50,-110],[50,-110],[0,-118]]}]},
    {type:'talk',lines:[['NIGHTJAR (radio)','Kane... they found us... Kessler is taking me to the—','n7_1',3.6],['KANE','Nightjar? Nightjar! Come in!','k7_1',2.4]]}
  ],
  outro:[['LT. HAYES (radio)','We have lost contact with her cell. I am sorry, Kane.','h7_1',3.4],['KANE','Then we go and get her.','k7_2',2]]};

LEVELS[8]={title:'SIEGE OF BASTOGNE',op:'THE BATTLE OF THE BULGE',place:'Bastogne, Belgium',date:'December 23, 1944 — 22:30',env:'snowNight',weather:'snow',grass:0,artillery:true,
  brief:['Bastogne is surrounded. Seven roads meet here — whoever holds the town holds the Ardennes.','You are low on ammunition, food and hope. A supply drop is coming in tonight.','Hold the square, recover the drop, and silence the sniper in the church tower.'],
  H:(x,z)=>0,col:()=>0xdfe4ea,snow:true,start:[0,30,0],
  build(B){const C=cmat();const ring=[[-22,22],[22,22],[-22,-22],[22,-22],[-40,0],[40,0],[0,40],[-45,35],[45,-38],[-45,-40]];ring.forEach(([x,z],i)=>B.house(x,z,10,9,{floors:2,mat:i%2?C.stone:C.plaster,rot:Math.abs(x)>Math.abs(z)?(x<0?Math.PI/2:-Math.PI/2):(z<0?0:Math.PI),ruined:i%4===1}));
    B.church(-30,-60);if(!AS.has('church'))B.bx(3,.3,1.6,cmat().stone,-30,12.4,-66.2);B.foxhole(0,0);B.sandbags(-8,8,7);B.sandbags(8,-8,7);B.truck(10,10,.8);B.crates(30,-32,4);B.barrel(-4,4,true);B.barrel(12,-4,true);B.tank(-12,-14,1.1);for(const [x,z] of [[-10,0],[10,0],[0,-12],[0,12]])B.lamp(x*1.6,z*1.6,false);B.forest(30,-120,-120,120,-80,'snowpine');},
  objectives:[
    {type:'defend',text:'Defend the town square',pos:[0,0],waves:[{n:6,from:[[0,-80],[-80,0]]},{n:7,from:[[80,0],[0,80]],smg:true}],lines:[['SGT. MILLER','They have us surrounded, the poor bastards.','m8_1',3]]},
    {type:'pickup',text:'Recover the supply drop',pos:[30,-30],label:'take the supplies',refill:true,checkpoint:true,lines:[['LT. HAYES (radio)','Supply drop is down near the east road. Get those crates!','h8_1',3.4]]},
    {type:'clear',text:'Take out the sniper in the church tower',spawn:[{g:'c1',at:[[-30,-51],[-35,-62],[-25,-62]]},{g:'c1',at:[[-30,-66.2]],y:12.7,hp:120,wid:'kar98k'}],checkpoint:true,lines:[['PVT. RUIZ','Sniper! The church tower!','r8_1',2.2]]},
    {type:'defend',text:'Hold Bastogne',pos:[0,0],checkpoint:true,waves:[{n:8,from:[[-80,-60],[80,-60]]},{n:9,from:[[0,-90],[-90,20],[90,20]],smg:true},{n:10,from:[[-60,80],[60,80],[0,-90]]}]}
  ],
  outro:[['SGT. MILLER','They asked the General to surrender. He sent back one word. Nuts.','m8_2',4],['KANE','Patton is coming. We hold a little longer.','k8_1',2.8]]};

LEVELS[9]={title:'BRIDGE AT REMAGEN',op:'CROSSING THE RHINE',place:'Ludendorff Bridge, Remagen',date:'March 7, 1945 — 15:50',env:'day',grass:9000,artillery:true,
  brief:['The Germans have blown every bridge over the Rhine — except one. The Ludendorff railway bridge at Remagen still stands.','It is wired for demolition and the detonators could fire at any moment.','Rush the bridge, cut the wires, and clear the tunnel on the east bank. Intelligence says Kessler crossed here.'],
  H:riverH,col:riverCol,start:[0,85,0],
  build(B){const C=cmat();B.water(-.4,-160,-30,160,30);B.bridge(0,32,-32,9,3);B.rails(0,30,-30);for(const [x,z] of [[-24,48],[24,50],[-36,66]])B.house(x,z,9,8,{mat:C.stone,rot:Math.PI/2,ruined:true});
    for(let i=0;i<12;i++)B.rock(rnd(-100,100)+(Math.random()<.5?0:0),-rnd(70,110),rnd(5,10));B.bx(14,8,4,C.stone,0,H(0,-58)+4,-60);B.bx(6,5,2,cmat().dark,0,H(0,-58)+2.5,-57.9,0,false);B.sandbags(-6,-42,7);B.sandbags(6,-44,7);B.tank(14,58,-.3);B.truck(-12,56,.4);B.forest(10,-120,90,120,110,'oak');},
  objectives:[
    {type:'clear',text:'Clear the west bank',spawn:[{g:'r1',at:[[-20,44],[22,46],[0,38],[-8,55],[30,60]]}],lines:[['LT. HAYES (radio)','It is still standing. Take it before they blow it!','h9_1',3]]},
    {type:'reach',text:'Rush the bridge',pos:[0,30],r:5},
    {type:'interact',text:'Cut the demolition wires',targets:[[-3,16],[3,0],[-3,-16]],hold:1.6,timeLimit:90,checkpoint:true,label:'cut the wire',spawn:[{g:'r2',at:[[-4,-36],[4,-38],[0,-48]]}],lines:[['KANE','Wires! Cut every wire you see!','k9_1',2.4]]},
    {type:'clear',text:'Clear the railway tunnel',checkpoint:true,spawn:[{g:'r3',at:[[-6,-46],[6,-48],[0,-54],[-3,-56],[3,-55]],trench:true}]}
  ],
  outro:[['LT. HAYES (radio)','We have a bridge across the Rhine. And Kane — Kessler\'s convoy went south. Into the Alps.','h9_2',4.6],['KANE','Nightjar is with him.','k9_2',2]]};

const BASE_MAP=`
##########################
#L....#......L......#...L#
#.....#.............#....#
#.....D......####...D....#
#.....#......#..#...#....#
###D###......#L.#...###D##
#L............D..........#
#........###.........L...#
#........#L#.............#
####D#####.#####D#########
#L.....................L.#
#........................#
###########..#############`;
LEVELS[10]={title:'GÖTTERDÄMMERUNG',op:'TWILIGHT OF THE GODS',place:'Alpine fortress, Bavaria',date:'April 29, 1945 — 04:20',env:'snowNight',weather:'snow',grass:0,artillery:false,final:true,
  brief:['The war is almost over. Kessler is not finished.','His Alpine fortress holds the last of the Götterdämmerung material — and Nightjar.','Breach the gate, find her, and end this.'],
  H:(x,z)=>{const r=z<-48?Math.min(40,(-48-z)*3):0;const s=Math.abs(x)>60?Math.min(30,(Math.abs(x)-60)*2):0;return Math.max(r*(Math.abs(x)<52?0:1),s)+(z>-48?nz(x,z,.4):0);},col:(x,z,y)=>y>2?0x8a8d92:0xdfe4ea,snow:true,start:[0,80,0],
  build(B){const C=cmat();B.forest(60,-120,10,120,120,'snowpine',(x,z)=>Math.abs(x)<10||Math.hypot(x,z-80)<10);for(let i=0;i<30;i++)B.rock(rnd(-120,120),-rnd(50,120),rnd(6,14));
    for(const s of[-1,1])B.bx(40,30,6,C.rock,s*32,15,-50);B.bx(24,26,6,C.rock,0,17,-50);
    B.sandbags(-8,-38,7);B.sandbags(8,-38,7);B.wire(-16,-32);B.wire(16,-32);B.truck(-14,-20,.2);B.truck(12,-14,-.4);B.lamp(-6,-44);B.lamp(6,-44);B.crates(18,-30,4);
    B.gridRooms(BASE_MAP,-52,-100,4,4,C.concrete);LV.cell=[-52+14*4+2,-100+3*4+2];},
  objectives:[
    {type:'clear',text:'Breach the fortress gate',spawn:[{g:'g1',at:[[-8,-40],[8,-40],[-14,-24],[12,-18],[0,-44],[-18,-34]],trench:true}],lines:[['LT. HAYES (radio)','This is it, Kane. End it.','h10_1',2.2]]},
    {type:'reach',text:'Infiltrate the fortress',pos:[-4,-50],r:4,checkpoint:true},
    {type:'clear',text:'Fight through the lower corridors',spawn:[{g:'g2',at:[[-40,-60],[-20,-60],[10,-58],[30,-60],[-30,-72],[20,-70]]}]},
    {type:'interact',text:'Free Nightjar',targets:[[6,-82]],hold:2.5,label:'break the cell lock',checkpoint:true,spawn:[{g:'g3',at:[[-30,-88],[-40,-80],[10,-92]]}]},
    {type:'talk',lines:[['NIGHTJAR','Kane! You came.','n10_1',2],['KANE','Told you I would. Can you walk?','k10_1',2.6],['NIGHTJAR','I can shoot. Give me a gun. Kessler is in the command room.','n10_2',3.6]]},
    {type:'boss',text:'Defeat Oberst Kessler',spawnAt:[-42,-96],hp:1600,guards:[[-36,-90],[-46,-90],[-30,-94]],lines:[['OBERST KESSLER','You are too late, Sergeant. The fire has already been lit.','x10_1',4]]},
    {type:'choice',text:'Kessler is escaping to his plane — but the prisoners below will die if the fortress is destroyed.',options:[['SAVE THE PRISONERS','save'],['CHASE KESSLER','chase']]}
  ],
  outro:[]};
LEVELS[10].endings={
  save:[['KANE','Get them out. All of them.','k10_2',2.4],['NIGHTJAR','You let him go, for strangers.','n10_3',3],['KANE','They are not strangers. They are why we came.','k10_3',3],['LT. HAYES (radio)','Kessler\'s plane is gone. But every prisoner is alive. The war is over, Kane. Come home.','h10_2',5]],
  chase:[['KANE','Nightjar, get the prisoners out! I am going after him!','k10_4',3],['OBERST KESSLER','You cannot stop the twilight, Sergeant!','x10_2',3],['KANE','Watch me.','k10_5',1.4],['LT. HAYES (radio)','Kessler is dead. The fortress is coming down. Kane... we lost some of the prisoners.','h10_3',5]]};
LEVELS[1]={title:'DAWN AT OMAHA',place:'Omaha Beach, Normandy',date:'June 6, 1944'};

// ---------- world switching ----------
function captureM1(){const glob=new Set([camera,sky,CLOUDS,hemi,sun,sun.target,flashLight,muzzleLight,FLARE,grass,...PART.pool,...TRC.pool,...HOLES.map(h=>h),...SHELLS.map(s=>s.m)]);
  const dyn=new Set([...enemies.map(e=>e.g),...allies.map(a=>a.g),...nades.map(n=>n.m)]);if(pModel)dyn.add(pModel.g);
  M1W={objs:scene.children.filter(o=>!glob.has(o)&&!dyn.has(o)&&!(o.isPoints)),statics:statics.slice(),colliders:colliders.slice(),emitters:emitters.slice()};}
function disposeLevel(){if(!LV)return;scene.remove(LV.root);LV=null;}
function switchWorld(n){if(n===CUR&&(n===1?!LV:LV))return;
  if(n===1){disposeLevel();setWeather(null);setArmsSkin(false);if(M1W){M1W.objs.forEach(o=>o.visible=o.userData._vis!==false);statics.length=0;statics.push(...M1W.statics);colliders.length=0;colliders.push(...M1W.colliders);emitters.length=0;emitters.push(...M1W.emitters);}
    HF=null;CUR=1;applyEnv('dawn');buildGrass(QUAL[S.quality].grass);rebuildHit();return;}
  if(CUR===1&&!LV){if(!M1W)captureM1();M1W.objs.forEach(o=>{o.userData._vis=o.visible;o.visible=false;});}
  disposeLevel();const def=LEVELS[n];CUR=n;HF=def.H;setArmsSkin(!!(LV_ASSETS[n]&&LV_ASSETS[n].arms));
  const root=new THREE.Group();scene.add(root);const st=[],co=[];LV={def,root,statics:st,colliders:co,emit:[],lights:[],oi:-1};
  const terr=terrainMesh(def.H,def.col);if(def.ground==='cobble'){terr.material=cmat().cobble;}else if(def.snow){terr.material=GROUND_SNOW;}
  root.add(terr);const B=makeBuilder(root,st,co);skinBuilder(B,root,st,co);def.build(B);if(DECOR[n])DECOR[n](B);clutter(B,({3:40,4:34,5:20,6:12,7:10,8:26,9:30,10:16})[n]||14);flushLODs();levelDressing(def,root);
  statics.length=0;statics.push(...st);colliders.length=0;colliders.push(...co);emitters.length=0;emitters.push(...LV.emit);
  applyEnv(def.env);setWeather(def.weather||null);buildGrass(def.grass?Math.min(def.grass,QUAL[S.quality].grass*1.5|0):0);if(grass&&def.snow)grass.visible=false;rebuildHit();}

// ---------- mission runtime ----------
function lvObj(){return LV&&LV.def.objectives[LV.oi];}
function spawnGroup(sp){for(const s of sp||[]){const extra=s.y||s.type==='mg'?0:Math.round((MD()-1)*s.at.length*.45);const at=s.at.concat(Array.from({length:extra},(_,i)=>{const b=s.at[i%s.at.length];return [b[0]+rnd(-5,5),b[1]+rnd(-5,5)];}));for(const [x,z] of at){const e=spawnEnemy(x+(s.y?0:rnd(-.5,.5)),z+(s.y?0:rnd(-.5,.5)),s.type||'rifle',{group:s.g,trench:!!s.trench,wid:s.wid||(s.smg?(Math.random()<.6?'mp40':'stg44'):undefined),hp:s.hp,counts:false,target:s.target?new V3(s.target[0]+rnd(-6,6),0,s.target[1]+rnd(-6,6)):null});if(s.y){e.pos.y=s.y;e.perch=true;if(CUR===8&&LV.tower){const t=LV.tower;const tx=(t.min.x+t.max.x)/2,tz=t.max.z-.9;e.pos.set(tx,H(tx,tz)+12.65,tz);}}}}}
function sayLines(lines){for(const l of lines||[])sayV(l[0],l[1],l[3]||Math.max(2.2,l[1].length/14),l[2]);}
function startLevelObjective(i){LV.oi=i;const o=lvObj();if(!o){levelComplete();return;}o.st={t:0,done:false,wave:-1,planted:[],cut:[],timer:o.timeLimit||0,spawned:0,spT:0};
  if(o.checkpoint)LV.cp={pos:pl.pos.clone(),yaw:pl.yaw,oi:i};
  spawnGroup(o.spawn);sayLines(o.lines);for(const t of (TANKS[CUR]||[]))if(t.oi===i&&!(LV.tanksSpawned=LV.tanksSpawned||{})[TANKS[CUR].indexOf(t)]){LV.tanksSpawned[TANKS[CUR].indexOf(t)]=1;spawnTank(t);}
  {const nj=({2:{oi:3,at:[2,-71]},3:{oi:0,at:[3,80]},10:{oi:4,at:[6,-84]}})[CUR];if(nj&&i>=nj.oi)spawnNightjar(nj.at[0],nj.at[1]);}if(o.allies)o.allies.forEach(([x,z])=>spawnAlly(x,z,x+rnd(-3,3),z+rnd(-3,3)));
  if(o.type==='talk'){o.st.dur=(o.lines||[]).reduce((a,l)=>a+(l[3]||Math.max(2.2,l[1].length/14)),0)+.5;}
  if(o.type==='pickup'){o.st.item=LV.root.children.includes(o._item)?o._item:(o._item=skinItem(makeBuilder(LV.root,[],[]).item(o.pos[0],o.pos[1])));}
  if(o.type==='boss'){const b=spawnEnemy(o.spawnAt[0],o.spawnAt[1],'rifle',{group:'boss',hp:o.hp,wid:CHAR.kessler?'m1911':'mp40',boss:true,name:'OBERST KESSLER',counts:false,model:CHAR.kessler?'kessler':undefined});b.maxhp=b.hp;LV.boss=b;spawnGroup([{g:'boss',at:o.guards,smg:true}]);}
  if(o.type==='choice'){showChoice(o);}
  if(o.type==='defend'||o.type==='survive'){o.st.wave=-1;o.st.gap=2;}
  if(o.text)setObj(o.text+progressText(o));if(o.timeLimit){$('timer').style.display='block';}
  if(i>0&&o.checkpoint)xp('CHECKPOINT');}
function progressText(o){if(o.type==='clear'){const a=enemies.filter(e=>e.group===o.spawn[0].g);const alive=a.filter(e=>e.alive).length;return ` <b>(${a.length-alive}/${a.length})</b>`;}
  if(o.type==='plant')return ` <b>(${o.st?o.st.planted.length:0}/${o.targets.length})</b>`;if(o.type==='interact')return o.targets.length>1?` <b>(${o.st?o.st.cut.length:0}/${o.targets.length})</b>`:'';
  if(o.type==='defend')return o.st&&o.st.wave>=0?` <b>(wave ${Math.min(o.st.wave+1,o.waves.length)}/${o.waves.length})</b>`:'';return '';}
function lvTarget(){const o=lvObj();if(!o||!o.st)return null;const P=(x,z,dy=1.2)=>new V3(x,groundAt(x,z)+dy,z);
  switch(o.type){case 'reach':case 'pickup':case 'defend':case 'survive':return o.pos?P(o.pos[0],o.pos[1]):null;
    case 'clear':{const e=enemies.find(e=>e.alive&&e.group===o.spawn[0].g);return e?e.pos.clone().add(new V3(0,2,0)):null;}
    case 'plant':{const t=o.targets.find((t,i)=>!o.st.planted.includes(i));return t?P(t[0],t[1]):null;}
    case 'interact':{const t=o.targets.find((t,i)=>!o.st.cut.includes(i));return t?P(t[0],t[1]):null;}
    case 'boss':return LV.boss&&LV.boss.alive?LV.boss.pos.clone().add(new V3(0,2.2,0)):null;}return null;}
function holdPrompt(near,label,need,dt,key){const holding=keys['KeyE']||tState.act;$('prompt').style.display=near?'block':'none';$('tAct').style.display=near&&isTouch?'flex':'none';
  $('ptxt').innerHTML=(isTouch?'Hold <kbd>HOLD</kbd> to ':'Hold <kbd>E</kbd> to ')+label;if(near&&holding){pl.plant+=dt;if(Math.floor(pl.plant*4)!==Math.floor((pl.plant-dt)*4))SND.beep();}else pl.plant=Math.max(0,pl.plant-dt*2);
  $('pbar').firstChild.style.width=(pl.plant/need*100)+'%';if(pl.plant>=need){pl.plant=0;$('prompt').style.display='none';$('tAct').style.display='none';return true;}return false;}
function updLevel(dt){const def=LV.def;
  if(def.artillery){mission.art-=dt;if(mission.art<=0){mission.art=rnd(4,9);let p;for(let k=0;k<8;k++){p=new V3(pl.pos.x+rnd(-45,45),0,pl.pos.z+rnd(-45,45));if(p.distanceTo(pl.pos)>14)break;}p.y=H(p.x,p.z);if(def.treeBursts&&Math.random()<.5)p.y+=rnd(8,12);artQ.push({p,t:1.1,big:Math.random()<.3});SND.whistle(p.distanceTo(pl.pos));}}
  for(let i=artQ.length-1;i>=0;i--){const a=artQ[i];a.t-=dt;if(a.t<=0){explode(a.p,a.big,null);if(a.p.y-H(a.p.x,a.p.z)>4&&a.p.distanceTo(pl.pos)<9)hurt(25,a.p,true);artQ.splice(i,1);}}
  mission.amb=(mission.amb||0)-dt;if(mission.amb<=0){mission.amb=rnd(1,3.5);const d=rnd(150,320);if(Math.random()<.5){const n=(rnd(4,10))|0;for(let k=0;k<n;k++)setTimeout(()=>SND.mg(d),k*rnd(70,95));}else SND.eRifle(d);}
  if(LV.water){const p=LV.water.geometry.attributes.position;}
  if(state!=='play')return;const o=lvObj();if(!o||!o.st||o.st.done)return;o.st.t+=dt;const dist=(x,z)=>Math.hypot(pl.pos.x-x,pl.pos.z-z);
  if(o.timeLimit){o.st.timer-=dt;$('timer').style.display='block';$('timer').textContent=Math.max(0,o.st.timer).toFixed(0)+'s';if(o.st.timer<=0){$('timer').style.display='none';missionFailed('Time ran out.');return;}}
  let done=false;
  switch(o.type){
    case 'reach':done=dist(o.pos[0],o.pos[1])<(o.r||5);break;
    case 'talk':done=o.st.t>=o.st.dur;break;
    case 'clear':{const a=enemies.filter(e=>e.group===o.spawn[0].g);done=a.length>0&&a.every(e=>!e.alive);setObjQuiet(o);break;}
    case 'plant':{let near=-1;o.targets.forEach((t,i)=>{if(!o.st.planted.includes(i)&&dist(t[0],t[1])<3.2)near=i;});
      if(holdPrompt(near>=0,'plant explosive charge',2.5,dt)){o.st.planted.push(near);SND.beep();say('KANE','Charge set!',1.6);const t=o.targets[near];setTimeout(()=>{const p=new V3(t[0],H(t[0],t[1])+1,t[1]);explode(p,true,'player');if(dist(t[0],t[1])<8)hurt(150*(1-dist(t[0],t[1])/8),p,true);LV.emit.push({pos:p.clone(),type:'bsmoke',rate:.25,t:0,ttl:1e9});emitters.push(LV.emit[LV.emit.length-1]);stats.score+=250;xp('+250 TARGET DESTROYED');},(o.fuse||4)*1000);setObjQuiet(o);}
      done=o.st.planted.length>=o.targets.length&&o.st.t>(o.st.lastT||0);if(o.st.planted.length>=o.targets.length&&!o.st.lastT)o.st.lastT=o.st.t+(o.fuse||4)+.5;break;}
    case 'interact':{let near=-1;o.targets.forEach((t,i)=>{if(!o.st.cut.includes(i)&&dist(t[0],t[1])<2.8)near=i;});
      if(holdPrompt(near>=0,o.label||'interact',o.hold||2,dt)){o.st.cut.push(near);SND.click();xp('+100');stats.score+=100;setObjQuiet(o);}done=o.st.cut.length>=o.targets.length;break;}
    case 'pickup':{const near=dist(o.pos[0],o.pos[1])<2.4;if(o.st.item)o.st.item.rotation.y+=dt;if(holdPrompt(near,o.label||'pick up',.8,dt)){if(o.st.item)o.st.item.visible=false;xp(o.refill?'AMMO RESUPPLIED':'DOCUMENTS RECOVERED');if(o.refill){pl.ws.forEach((ws,i)=>ws.res=pl.wdef[i].res);pl.nades=4;pl.hp=100;}done=true;}break;}
    case 'defend':case 'survive':{const alive=enemies.filter(e=>e.alive&&e.group==='w').length;
      if(o.type==='defend'){if(alive===0){o.st.gap-=dt;if(o.st.gap<=0){o.st.wave++;if(o.st.wave>=o.waves.length){done=true;break;}const w=o.waves[o.st.wave];const wn=Math.round(w.n*(1+(MD()-1)*.45));for(let k=0;k<wn;k++){const f=w.from[k%w.from.length];spawnEnemy(f[0]+rnd(-6,6),f[1]+rnd(-4,4),'rifle',{group:'w',counts:false,wid:w.smg&&Math.random()<.6?(Math.random()<.5?'mp40':'stg44'):undefined,target:new V3(o.pos[0]+rnd(-14,14),0,o.pos[1]+rnd(-14,14))});}
          if(o.st.wave>0)xp('WAVE '+(o.st.wave+1));o.st.gap=4;setObjQuiet(o);}}}
      else{o.st.spT-=dt;if(o.st.spT<=0&&alive<o.max){o.st.spT=o.every;const f=o.from[(Math.random()*o.from.length)|0];spawnEnemy(f[0]+rnd(-4,4),f[1]+rnd(-4,4),'rifle',{group:'w',counts:false,target:new V3(o.pos[0]+rnd(-12,12),0,o.pos[1]+rnd(-12,12))});}
        const left=Math.max(0,o.time-o.st.t);$('timer').style.display='block';$('timer').textContent=left.toFixed(0)+'s';if(left<=0){$('timer').style.display='none';done=true;}}break;}
    case 'boss':{const b=LV.boss;$('bossbar').style.display=b&&b.alive?'block':'none';if(b){$('bossbar').firstElementChild.lastChild.style.width=(Math.max(0,b.hp)/b.maxhp*100)+'%';if(b.alive&&b.hp<b.maxhp*.25&&!o.st.fled){o.st.fled=true;b.alive=false;b.g.visible=false;rebuildHit();say('OBERST KESSLER','This is not over, Sergeant!',2.6);done=true;}}break;}
    case 'choice':done=!!o.st.pick;break;}
  if(done){o.st.done=true;$('prompt').style.display='none';$('tAct').style.display='none';if(o.type==='boss')$('bossbar').style.display='none';if(o.timeLimit)$('timer').style.display='none';
    if(o.type==='defend'||o.type==='survive'){$('timer').style.display='none';for(const e of enemies)if(e.alive&&e.group==='w'&&e.pos.distanceTo(pl.pos)>40){e.alive=false;e.g.visible=false;}rebuildHit();}
    setTimeout(()=>{if(LV&&LV.oi===LV.def.objectives.indexOf(o)&&(state==='play'))startLevelObjective(LV.oi+1);},o.type==='talk'?100:900);}}
function setObjQuiet(o){$('obj').innerHTML=`<div class="h">OBJECTIVE</div>${o.text}${progressText(o)}`;$('pobj').textContent='Objective: '+o.text;}
function showChoice(o){const el=$('choice');el.querySelector('p').textContent=o.text;el.querySelector('.btns').innerHTML=o.options.map(([t,v])=>`<button class="btn" data-choice="${v}">${t}</button>`).join('');exitLock();show('choice');state='pause';
  el.onclick=e=>{const b=e.target.closest('[data-choice]');if(!b)return;o.st.pick=b.dataset.choice;LV.ending=o.st.pick;hideAll();state='play';document.body.classList.add('play');if(!isTouch)reqLock();};}
function levelIntroCine(def){const s=new V3(def.start[0],0,def.start[1]);s.y=H(s.x,s.z);const a=s.clone().add(new V3(-30,18,30)),b=s.clone().add(new V3(10,6,12)),look=s.clone().add(new V3(0,1,-40));
  return[{dur:6,start:()=>{camera.fov=50;camera.updateProjectionMatrix();levelTitleCard(def);},cam:k=>({p:lp(a,b,ease(k)),l:lp(look.clone().add(new V3(0,10,0)),look,k)}),end:()=>{$('title').style.opacity=0;}},
    {dur:Math.max(3,(def.introLines||[]).length*3),cam:k=>({p:lp(b,s.clone().add(new V3(1.5,2.2,3)),ease(k)),l:look}),subs:(def.introLines||[]).map((l,i)=>[.3+i*3,l[0],l[1],2.9,l[2]])}];}
function levelTitleCard(def){const L=[def.op,def.title,'Sgt. Elias Kane — 2nd Ranger Battalion',def.date,def.place];const t=$('title');t.innerHTML=L.map((s,i)=>`<div class="l${i===1?' big':''}"></div>`).join('');t.style.opacity=1;const ls=[...t.children];let li=0,ci=0;
  const tick=()=>{if(!cine||li>=ls.length)return;ls[li].textContent=L[li].slice(0,++ci);if(ci%2)SND.click();if(ci>=L[li].length){li++;ci=0;}setTimeout(tick,38);};setTimeout(tick,400);}
function levelOutroCine(def,lines){const c=pl.pos.clone();return[{dur:Math.max(5,lines.reduce((a,l)=>a+(l[3]||Math.max(2.2,l[1].length/14)),0)+1),start:()=>{camera.fov=50;camera.updateProjectionMatrix();stats.endT=time;},
  cam:k=>{const a=.3+k*.8;return{p:new V3(c.x+Math.sin(a)*9,c.y+3.5+k*2,c.z+Math.cos(a)*9),l:c.clone().add(new V3(0,1.4,0))};},subs:lines.reduce((acc,l)=>{const t=acc.t;acc.list.push([t,l[0],l[1],(l[3]||Math.max(2.2,l[1].length/14))]);acc.t+=(l[3]||Math.max(2.2,l[1].length/14));return acc;},{t:.4,list:[]}).list}];}
function startLevel(n){hideAll();switchWorld(n);clearDynamic();const def=LEVELS[n];mission.phase='level';mission.art=4;
  stats.shots=stats.hits=stats.kills=stats.heads=stats.score=0;pl.deaths=0;LV.cp=null;
  playCine(levelIntroCine(def),()=>{resetPlayer(new V3(def.start[0],0,def.start[1]),def.start[2]||0);stats.start=time;LV.cp={pos:pl.pos.clone(),yaw:pl.yaw,oi:0};
    for(let i=0;i<4;i++)spawnAlly(def.start[0]+rnd(-6,6),def.start[1]+rnd(2,6),def.start[0]+rnd(-10,10),def.start[1]-rnd(8,16),i*.4);
    startLevelObjective(0);enterPlay();});}
function levelComplete(){const def=LV.def;let lines=def.outro;if(def.endings)lines=def.endings[LV.ending||'save'];
  playCine(levelOutroCine(def,lines),()=>{if(def.final){showCredits();}else missionComplete();});}
function levelRestart(){hideAll();const cp=LV.cp||{pos:new V3(LV.def.start[0],0,LV.def.start[1]),yaw:0,oi:0};
  for(const e of enemies){if(e.alive){e.alive=false;e.g.visible=false;}}rebuildHit();for(const n of nades)scene.remove(n.m);nades.length=0;
  resetPlayer(cp.pos,cp.yaw);pl.alive=true;$('timer').style.display='none';$('bossbar').style.display='none';startLevelObjective(cp.oi);enterPlay();}
function missionFailed(msg){pl.alive=false;state='dead';exitLock();document.body.classList.remove('play');$('dead').querySelector('h1').textContent='MISSION FAILED';$('deadq').textContent=msg;setTimeout(()=>show('dead'),600);}
function showCredits(){state='complete';document.body.classList.remove('play','cine');exitLock();PROGRESS.done[10]=1;saveProgress();show('credits');const r=$('credroll');r.style.animation='none';void r.offsetWidth;r.style.animation='';}
// voiced subtitles: plays audio/<id>.mp3 when present
const VOICE={};function sayV(who,text,dur,id){say(who,text,dur,id);}
let VMAN=null;fetch(BASE+'audio/index.json').then(r=>r.ok?r.json():[]).then(j=>{VMAN=new Set(j);}).catch(()=>{VMAN=new Set();});
function playVoice(id){if(!id||!A.ctx||!VMAN||!VMAN.has(id))return;const url=BASE+'audio/'+id+'.mp3';
  const play=buf=>{if(!buf)return;const s=A.ctx.createBufferSource();s.buffer=buf;const g=A.ctx.createGain();g.gain.value=1.4;s.connect(g);g.connect(A.sfx);s.start(A.ctx.currentTime+.05);};
  if(VOICE[id]!==undefined){VOICE[id].then(play);return;}VOICE[id]=fetch(url).then(r=>r.ok?r.arrayBuffer():null).then(b=>b?A.ctx.decodeAudioData(b):null).catch(()=>null);VOICE[id].then(play);}

/* ================= LOOP ================= */
const gctx=$('grain').getContext('2d');const gimg=gctx.createImageData(320,180);let gT=0;
function updGrain(dt){if(!S.grain)return;gT-=dt;if(gT>0)return;gT=.05;const d=gimg.data;for(let i=0;i<d.length;i+=4){const v=Math.random()*255;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255;}gctx.putImageData(gimg,0,0);}
let wT=0;const WAVES=[];for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(500,1.4),new THREE.MeshBasicMaterial({color:0xe8eeea,transparent:true,opacity:0,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.06;scene.add(m);WAVES.push({m,ph:i/3});}
function updWater(dt){wT+=dt;for(const w of WAVES){const k=(wT*.09+w.ph)%1;w.m.position.z=52-k*11.5;w.m.material.opacity=Math.sin(k*Math.PI)*.38;w.m.scale.y=1+k*1.5;}if(!water.visible){foam.material.opacity=.25+Math.sin(wT*1.7)*.12;foam.position.z=40.6+Math.sin(wT*.8)*.5;return;}const p=water.geometry.attributes.position,b=water.userData.base;for(let i=0;i<p.count;i++){const x=b[i*3],z=b[i*3+2];p.array[i*3+1]=b[i*3+1]+Math.sin(x*.12+wT*1.3)*.18+Math.sin(z*.2-wT*1.7)*.22;}p.needsUpdate=true;if((wT*20|0)%3===0)water.geometry.computeVertexNormals();foam.material.opacity=.25+Math.sin(wT*1.7)*.12;foam.position.z=40.6+Math.sin(wT*.8)*.5;}
let last=performance.now(),fpsA=0,fpsN=0,menuT=0;
let slowT=0;
function loop(now){requestAnimationFrame(loop);updListener();let dt=Math.min(.05,(now-last)/1000);updDRS(dt);updGrass(dt);updEye(dt);last=now;if(slowT>0&&state==='play'){slowT-=dt;dt*=.33;}
  if(state!=='pause')time+=dt;
  fpsA+=dt;fpsN++;if(fpsA>.5){if(S.fps)$('fps').textContent=Math.round(fpsN/fpsA)+' FPS';fpsA=fpsN=0;}
  if(state!=='pause'&&state!=='dead'){for(const mx of mixers)mx.update(dt);updWater(dt);updParts(dt);updTracers(dt);updEmitters(dt);updSubs(dt);updAllies(dt);updEnemies(dt);updTanks(dt);updProcRigs(dt);updNades(dt);updMission(dt);}
  if(state==='play'){updPlayer(dt);updHUD(dt);}
  else if(state==='cine'&&cine){updCine(dt);}
  else if(state==='menu'||state==='complete'){menuT+=dt*.04;camera.position.set(Math.sin(menuT)*30+10,5+Math.sin(menuT*.7)*1.5,52+Math.cos(menuT)*8);camera.lookAt(0,6,-30);}
  flashLight.intensity*=Math.exp(-dt*9);
  const fp0=state==='play'?pl.pos:camera.position;const sts=90/(sun.shadow.mapSize.x||1024);const fp={x:Math.round(fp0.x/sts)*sts,z:Math.round(fp0.z/sts)*sts};sun.target.position.set(fp.x,0,fp.z-10);sun.position.set(fp.x+SUN_DIR.x*150,SUN_DIR.y*150,fp.z+SUN_DIR.z*150);
  CLOUDS.position.set(camera.position.x,0,camera.position.z);CLOUDS.rotation.y+=dt*.002;
  updShells(dt);updWeather(dt);updDressing(dt);if(FLARE){FLARE.position.copy(camera.position).addScaledVector(SUN_DIR,900);}
  updLoadoutPreview(dt);updGrain(dt);if(water2)water2.material.uniforms.time.value+=dt*.6;
  if(composer){composer.render();if(FLARE)renderer.render(flareScene,camera);}else{renderer.clear();renderer.render(scene,camera);}if(state==='play')solveArms();else if(ARMS)ARMS.wrap.visible=false;
  if(VM.visible&&state==='play'){renderer.clearDepth();vmCam.fov=lerp(52,40,pl.ads);vmCam.updateProjectionMatrix();renderer.render(vmScene,vmCam);}}
renderMissions();applySettings();resize();camera.fov=55;camera.updateProjectionMatrix();VM.visible=false;show('loading');requestAnimationFrame(loop);
Promise.all([loadProps(),loadCharacters(p=>{$('lbar').style.width=(p*100)+'%';})]).then(()=>setTimeout(()=>show('menu'),300));
window.__game={H,AS,THREE,get EYE(){return EYE},FILL,get cine(){return cine},get LV(){return LV},get CUR(){return CUR},LEVELS,startLevel,startLevelObjective,switchWorld,lvTarget,WMODELS,mixers,get pModel(){return pModel},get TP(){return TP},hurt,spawnEnemy,CHAR,PROPS,VM,equip,LOADOUT:()=>LOADOUT,camera,scene,pl,mission,enemies,allies,stats,get state(){return state},setState:s=>state=s,startGameplay,setupMission,playCine,introCine,deploy,killEnemy};
