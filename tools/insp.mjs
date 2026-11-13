import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import {MeshoptDecoder} from 'meshoptimizer';
await MeshoptDecoder.ready;const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
for(const f of process.argv.slice(2)){const d=await io.read(f);const r=d.getRoot();const nodes=r.listNodes();const meshes=nodes.filter(n=>n.getMesh());
 let tris=0;for(const m of r.listMeshes())for(const p of m.listPrimitives()){const i=p.getIndices();tris+=(i?i.getCount():p.getAttribute('POSITION').getCount())/3;}
 // bbox
 let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(const n of meshes){const M=n.getWorldMatrix();for(const p of n.getMesh().listPrimitives()){const a=p.getAttribute('POSITION');const lo=a.getMinNormalized([]),hi=a.getMaxNormalized([]);for(const c of [[lo[0],lo[1],lo[2]],[hi[0],hi[1],hi[2]],[lo[0],hi[1],lo[2]],[hi[0],lo[1],hi[2]]]){const w=[0,1,2].map(k=>M[k]*c[0]+M[4+k]*c[1]+M[8+k]*c[2]+M[12+k]);for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],w[k]);mx[k]=Math.max(mx[k],w[k]);}}}}
 console.log(f.padEnd(34),'meshNodes',meshes.length,'mats',r.listMaterials().length,'tris',tris|0,'bbox',mn.map(v=>v.toFixed(1)).join(','),'..',mx.map(v=>v.toFixed(1)).join(','),'|',nodes.map(n=>n.getName()).filter(n=>n).slice(0,14).join(' '));}
