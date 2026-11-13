// Iron Requiem — realistic ground: tileable procedural detail (grass/soil/sand/rock packed in RGBA),
// blended by terrain colour + slope, two-scale sampling (no visible tiling), derivative bump normals.
import * as THREE from 'three';

function periodicNoise(N,cells,seed){let s=seed;const r=()=>((s=Math.imul(s^s>>>15,2246822507)+0x9e3779b9|0)>>>0)/4294967296;
  const g=new Float32Array(cells*cells);for(let i=0;i<g.length;i++)g[i]=r();const out=new Float32Array(N*N);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const fx=x/N*cells,fy=y/N*cells,ix=fx|0,iy=fy|0,tx=fx-ix,ty=fy-iy;const sx=tx*tx*(3-2*tx),sy=ty*ty*(3-2*ty);
    const a=g[iy%cells*cells+ix%cells],b=g[iy%cells*cells+(ix+1)%cells],c=g[(iy+1)%cells*cells+ix%cells],d=g[(iy+1)%cells*cells+(ix+1)%cells];
    out[y*N+x]=a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy;}return out;}
function fbm(N,base,oct,seed,gain=.5){const out=new Float32Array(N*N);let amp=1,tot=0;for(let o=0;o<oct;o++){const n=periodicNoise(N,base<<o,seed+o*977);for(let i=0;i<out.length;i++)out[i]+=n[i]*amp;tot+=amp;amp*=gain;}for(let i=0;i<out.length;i++)out[i]/=tot;return out;}
function layer(N,draw){const c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d');x.fillStyle='#808080';x.fillRect(0,0,N,N);
  const wrap=(fn)=>{for(const ox of[-N,0,N])for(const oy of[-N,0,N]){x.save();x.translate(ox,oy);fn();x.restore();}};draw(x,wrap);return x.getImageData(0,0,N,N).data;}
const R=(a,b)=>a+Math.random()*(b-a);

export function makeDetailTexture(N=512){
  const nG=fbm(N,4,6,11),nD=fbm(N,4,6,23),nS=fbm(N,2,6,37,.55),nR=fbm(N,4,7,51,.6);
  // grass: thousands of short blades over mottled base
  const G=layer(N,(x,wrap)=>{for(let i=0;i<9000;i++){const px=R(0,N),py=R(0,N),l=R(3,10),a=R(-.6,.6)-Math.PI/2,v=R(40,220)|0;
      wrap(()=>{x.strokeStyle=`rgba(${v},${v},${v},${R(.35,.75)})`;x.lineWidth=R(.6,1.6);x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.cos(a)*l,py+Math.sin(a)*l);x.stroke();});}});
  // soil: clods + pebbles with light/shadow
  const D=layer(N,(x,wrap)=>{for(let i=0;i<1400;i++){const px=R(0,N),py=R(0,N),r=R(.8,3.4),v=R(70,200)|0;
      wrap(()=>{const g=x.createRadialGradient(px-r*.3,py-r*.3,0,px,py,r);g.addColorStop(0,`rgba(${v+40},${v+40},${v+40},.9)`);g.addColorStop(1,`rgba(${v-50},${v-50},${v-50},.0)`);x.fillStyle=g;x.beginPath();x.arc(px,py,r,0,7);x.fill();});}});
  // sand: wind ripples
  const S=layer(N,(x,wrap)=>{for(let y=0;y<N;y+=1){const v=128+Math.sin(y*.23+Math.sin(y*.031)*6)*26|0;x.fillStyle=`rgba(${v},${v},${v},.55)`;x.fillRect(0,y,N,1);}
      for(let i=0;i<5000;i++){const v=R(60,230)|0;x.fillStyle=`rgba(${v},${v},${v},.5)`;x.fillRect(R(0,N),R(0,N),1,1);}});
  // rock: cracks over high-contrast fbm
  const K=layer(N,(x,wrap)=>{for(let i=0;i<70;i++){let px=R(0,N),py=R(0,N),a=R(0,6.28);const seg=(R(4,12))|0;
      wrap(()=>{x.strokeStyle=`rgba(25,25,25,${R(.35,.7)})`;x.lineWidth=R(.7,1.8);x.beginPath();let qx=px,qy=py,qa=a;x.moveTo(qx,qy);for(let k=0;k<seg;k++){qa+=R(-.7,.7);qx+=Math.cos(qa)*R(4,12);qy+=Math.sin(qa)*R(4,12);x.lineTo(qx,qy);}x.stroke();});}});
  const data=new Uint8Array(N*N*4);
  for(let i=0;i<N*N;i++){const p=i*4;
    data[p]  =Math.max(0,Math.min(255,(G[p]-128)*.9+(nG[i]-.5)*170+128));
    data[p+1]=Math.max(0,Math.min(255,(D[p]-128)*.9+(nD[i]-.5)*190+128));
    data[p+2]=Math.max(0,Math.min(255,(S[p]-128)*.8+(nS[i]-.5)*120+128));
    data[p+3]=Math.max(0,Math.min(255,(K[p]-128)+(nR[i]-.5)*260+128));}
  const t=new THREE.DataTexture(data,N,N,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.colorSpace=THREE.NoColorSpace;t.needsUpdate=true;
  return t;}

export function makeGroundMaterial(detail,{snow=false,anisotropy=8,roughness=.94}={}){
  detail.anisotropy=anisotropy;
  const m=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness,metalness:0});
  m.userData.ground={uDetail:{value:detail},uSnow:{value:snow?1:0},uBump:{value:1}};
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,m.userData.ground);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vGWPos;varying vec3 vGWN;')
      .replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvGWPos=(modelMatrix*vec4(transformed,1.0)).xyz;vGWN=normalize(mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D uDetail;uniform float uSnow;uniform float uBump;varying vec3 vGWPos;varying vec3 vGWN;')
      .replace('#include <color_fragment>',`#include <color_fragment>
  float gDet=.5;float gRock=0.;
  {vec3 gc=diffuseColor.rgb;vec2 wuv=vGWPos.xz;
   vec4 d1=texture2D(uDetail,wuv*.30);vec4 d2=texture2D(uDetail,wuv*.067+vec2(.37,.11));vec4 dd=mix(d1,d2,.42);
   float lum=dot(gc,vec3(.299,.587,.114));float slope=1.-clamp(vGWN.y,0.,1.);
   gRock=smoothstep(.30,.55,slope);
   float wG=clamp((gc.g-max(gc.r,gc.b)*.92)*30.,0.,1.);
   float wSn=uSnow*smoothstep(.30,.55,lum);
   float wSa=(1.-uSnow)*smoothstep(.26,.40,lum)*(1.-wG);
   float wD=max(0.,1.-wG-wSa-wSn);
   vec4 w=vec4(wG,wD,max(wSa,wSn),0.)*(1.-gRock);w.a=gRock;
   float det=dot(dd,w)/max(.001,dot(w,vec4(1.)));det=mix(det,.5+(det-.5)*.35,wSn);gDet=det;
   float macro=texture2D(uDetail,wuv*.009+vec2(.5)).g;
   vec3 c=gc*(.52+det*.96)*(.82+macro*.36);
   c=mix(c,vec3(lum)*(.55+det*.9)*vec3(1.,.97,.92),gRock*.55);
   c*=mix(vec3(1.),vec3(1.10,1.05,.80),wG*smoothstep(.45,.75,macro));
   c*=mix(1.,.82,wSn);
   diffuseColor.rgb=c;}`)
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n roughnessFactor=clamp(roughnessFactor*(.9+gDet*.2)-gRock*.08,.35,1.);')
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
  {float bs=(.55+gRock*1.6-uSnow*.25)*uBump*1.6;vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition);vec3 n0=normal;vec3 r1=cross(sy,n0),r2=cross(n0,sx);float fd=dot(sx,r1);
   float bx=dFdx(gDet)*bs,by=dFdy(gDet)*bs;vec3 gr=sign(fd)*(bx*r1+by*r2);normal=normalize(abs(fd)*n0-gr);}`);
  };
  m.customProgramCacheKey=()=>'ground'+(snow?1:0);
  return m;}
