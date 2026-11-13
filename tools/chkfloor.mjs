import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import {MeshoptDecoder} from 'meshoptimizer';
await MeshoptDecoder.ready;const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const doc=await io.read(process.argv[2]);
for(const node of doc.getRoot().listNodes()){const m=node.getMesh();if(!m)continue;const W=node.getWorldMatrix();for(const p of m.listPrimitives()){const P=p.getAttribute('POSITION'),N=p.getAttribute('NORMAL'),C=p.getAttribute('COLOR_0');const e=[0,0,0],n=[0,0,0],c=[0,0,0,0];
 const bins={};for(let i=0;i<P.getCount();i++){P.getElement(i,e);const y=W[1]*e[0]+W[5]*e[1]+W[9]*e[2]+W[13];N&&N.getElement(i,n);const ny=N?(W[1]*n[0]+W[5]*n[1]+W[9]*n[2]):0;C&&C.getElement(i,c);
  const key=(ny>.8?'up':ny<-.8?'down':'side')+'_y'+Math.round(y);(bins[key]=bins[key]||[]).push(c[0]);}
 console.log(node.getName(),p.getMaterial()&&p.getMaterial().getName(),'colors?',!!C,Object.entries(bins).filter(([k])=>/y0|y1|y3/.test(k)).map(([k,v])=>k+':'+v.length+':'+(v.reduce((a,b)=>a+b,0)/v.length).toFixed(2)).join(' '));}}
