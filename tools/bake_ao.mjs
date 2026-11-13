// Offline ambient-occlusion + interior-openness bake into COLOR_0 (vertex colours) for static models.
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import * as THREE from 'three';import {MeshBVH} from 'three-mesh-bvh';
await MeshoptDecoder.ready;await MeshoptEncoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
const [inp,out,mode='building']=process.argv.slice(2);
const doc=await io.read(inp);const root=doc.getRoot();
// gather world-space triangles of every mesh instance
const items=[];const allPos=[];const allIdx=[];let base=0;
for(const node of root.listNodes()){const mesh=node.getMesh();if(!mesh)continue;const M=new THREE.Matrix4().fromArray(node.getWorldMatrix());const N=new THREE.Matrix3().getNormalMatrix(M);
  for(const prim of mesh.listPrimitives()){const pa=prim.getAttribute('POSITION');const na=prim.getAttribute('NORMAL');const ia=prim.getIndices();const n=pa.getCount();const wp=new Float32Array(n*3),wn=new Float32Array(n*3);const e=[0,0,0],v=new THREE.Vector3();
    for(let i=0;i<n;i++){pa.getElement(i,e);v.set(e[0],e[1],e[2]).applyMatrix4(M);wp.set([v.x,v.y,v.z],i*3);allPos.push(v.x,v.y,v.z);if(na){na.getElement(i,e);v.set(e[0],e[1],e[2]).applyMatrix3(N).normalize();wn.set([v.x,v.y,v.z],i*3);}}
    if(ia){for(let i=0;i<ia.getCount();i++)allIdx.push(base+ia.getScalar(i));}else for(let i=0;i<n;i++)allIdx.push(base+i);
    items.push({prim,n,wp,wn,hasN:!!na,ia});base+=n;}}
const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(allPos,3));g.setIndex(allIdx);g.computeBoundingBox();
const bvh=new MeshBVH(g);const size=g.boundingBox.getSize(new THREE.Vector3()).length();
const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
// fixed cosine-weighted hemisphere directions
const K=mode==='prop'?14:20;const dirs=[];for(let i=0;i<K;i++){const u=(i+.5)/K,a=i*2.399963;const r=Math.sqrt(u);dirs.push([Math.cos(a)*r,Math.sqrt(1-u),Math.sin(a)*r]);}
const ray=new THREE.Ray(),t=new THREE.Vector3(),b=new THREE.Vector3(),nn=new THREE.Vector3(),o=new THREE.Vector3(),d=new THREE.Vector3();
const near=mode==='prop'?Math.max(.15,size*.12):1.6,far=mode==='prop'?size*.6:24;let tot=0;
for(const it of items){const n=it.n;const col=new Float32Array(n*4);
  // pull each sample point toward the centre of its neighbouring triangles (large faces: corners are not representative)
  const cen=new Float32Array(n*3),cnt=new Float32Array(n);const idx=it.ia?Array.from({length:it.ia.getCount()},(_,k)=>it.ia.getScalar(k)):Array.from({length:n},(_,k)=>k);
  for(let f=0;f+2<idx.length;f+=3){const a=idx[f],b=idx[f+1],c=idx[f+2];const cx=(it.wp[a*3]+it.wp[b*3]+it.wp[c*3])/3,cy=(it.wp[a*3+1]+it.wp[b*3+1]+it.wp[c*3+1])/3,cz=(it.wp[a*3+2]+it.wp[b*3+2]+it.wp[c*3+2])/3;for(const v of[a,b,c]){cen[v*3]+=cx;cen[v*3+1]+=cy;cen[v*3+2]+=cz;cnt[v]++;}}
  for(let i=0;i<n;i++){nn.fromArray(it.wn,i*3);if(!it.hasN||nn.lengthSq()<.5)nn.set(0,1,0);t.set(1,0,0);if(Math.abs(nn.x)>.9)t.set(0,0,1);t.cross(nn).normalize();b.crossVectors(nn,t);
    o.fromArray(it.wp,i*3);if(cnt[i]){const cc=new THREE.Vector3(cen[i*3]/cnt[i],cen[i*3+1]/cnt[i],cen[i*3+2]/cnt[i]);const dv=cc.sub(o);const L=dv.length();if(L>.05)o.addScaledVector(dv,Math.min(.6,1.6/L));}o.addScaledVector(nn,.03);let occ=0,open=0;
    for(const D of dirs){d.set(0,0,0).addScaledVector(t,D[0]).addScaledVector(nn,D[1]).addScaledVector(b,D[2]).normalize();ray.set(o,d);
      const h=bvh.raycastFirst(ray,THREE.DoubleSide);if(h){if(h.distance<near)occ+=1-h.distance/near;if(h.distance<far)open+=1;}}
    const ao=1-occ/K;const sky=1-open/K;// sky visibility (interiors -> low)
    let v=mode==='prop'?Math.pow(ao,1.4)*.9+.1:Math.pow(ao,1.15)*(.52+.48*Math.pow(sky,.5));v=Math.max(.28,Math.min(1,v));if(mode!=='prop'&&nn.y>.75)v=.58+.42*v;
    col[i*4]=col[i*4+1]=col[i*4+2]=v;col[i*4+3]=1;tot++;}
  // multiply with any existing colours
  const old=it.prim.getAttribute('COLOR_0');if(old){const e=[0,0,0,1];for(let i=0;i<n;i++){old.getElement(i,e);for(let k=0;k<3;k++)col[i*4+k]*=e[k];}}
  const acc=doc.createAccessor().setType('VEC4').setArray(col).setBuffer(root.listBuffers()[0]);it.prim.setAttribute('COLOR_0',acc);}
await io.write(out,doc);console.log(inp.split('/').pop(),'verts',tot,'size',size.toFixed(1));
