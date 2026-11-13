// Iron Requiem — model registry: lazy per-mission loading, cached templates, BVH collision geometry, instancing helpers
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {computeBoundsTree,disposeBoundsTree,acceleratedRaycast} from 'three-mesh-bvh';

THREE.BufferGeometry.prototype.computeBoundsTree=computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree=disposeBoundsTree;
THREE.Mesh.prototype.raycast=acceleratedRaycast;

export const PATH={
  farmhouse:'buildings/farmhouse',barn:'buildings/barn',ruinA:'buildings/ruined_house_a',ruinB:'buildings/ruined_house_b',belgian:'buildings/belgian_house',
  church:'buildings/church',paris:'buildings/paris_building',parisCorner:'buildings/paris_corner',lamp:'buildings/street_lamp',cafe:'buildings/cafe_set',
  wreck:'buildings/wrecked_car',bridge:'buildings/bridge_section',bridgeTower:'buildings/bridge_tower',mgNest:'buildings/mg_nest',foxhole:'buildings/foxhole',
  gate:'buildings/fortress_gate',corridor:'buildings/fortress_corridor',cellDoor:'buildings/cell_door',searchlight:'buildings/searchlight',mapTable:'buildings/map_table',
  panzer:'vehicles/panzer4',tiger:'vehicles/tiger1',halftrack:'vehicles/halftrack',opel:'vehicles/opel_blitz',kubel:'vehicles/kubelwagen',sherman:'vehicles/sherman',
  jeep:'vehicles/jeep',loco:'vehicles/locomotive',freight:'vehicles/freight_car',flak:'vehicles/flak88',pak:'vehicles/pak40',
  oak:'nature/oak_tree',pine:'nature/pine_tree',snowpine:'nature/snow_pine',dead:'nature/dead_tree',hedge:'nature/hedge_bush',rock:'nature/rock_a',rockSnow:'nature/rock_snow',
  ammo:'props/ammo_crate',crates:'props/crate_stack',drum:'props/oil_drum',radio:'props/field_radio',docs:'props/documents',rubble:'props/rubble_pile',chute:'props/supply_chute'
};
// models that get exact mesh collision (walk inside, climb stairs, bullets hit real walls)
const MESHCOL=new Set(['farmhouse','barn','ruinA','ruinB','belgian','church','bridge','bridgeTower','gate','corridor','foxhole','mgNest']);

export const MODELS={};const PENDING={};
export const COLMAT=new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide});

function prep(key,scene){
  scene.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(scene);const size=box.getSize(new THREE.Vector3());
  const isTree=/^(oak|pine|snowpine|dead|hedge)$/.test(key);
  scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=!isTree;const m=o.material;if(m){m.envMapIntensity=.55;if(isTree&&m.transparent){m.transparent=false;m.alphaTest=.45;}if(MESHCOL.has(key))m.side=THREE.DoubleSide;for(const k of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])if(m[k])m[k].anisotropy=16;}}});
  const M={key,scene,box,size,parts:[]};
  // parts: every mesh with its transform relative to the model root (for instancing)
  scene.traverse(o=>{if(o.isMesh)M.parts.push({geo:o.geometry,mat:o.material,mat4:o.matrixWorld.clone(),name:o.name});});
  if(MESHCOL.has(key)){
    const geos=[];for(const p of M.parts){let g=p.geo.clone();for(const k of Object.keys(g.attributes))if(k!=='position')g.deleteAttribute(k);
      // de-quantise to float, bake transform
      const pos=g.attributes.position;const f=new Float32Array(pos.count*3);for(let i=0;i<pos.count;i++){f[i*3]=pos.getX(i);f[i*3+1]=pos.getY(i);f[i*3+2]=pos.getZ(i);}
      g.setAttribute('position',new THREE.BufferAttribute(f,3));g.applyMatrix4(p.mat4);if(!g.index){const idx=[];for(let i=0;i<pos.count;i++)idx.push(i);g.setIndex(idx);}geos.push(g);}
    const merged=mergeGeometries(geos,false);if(merged){merged.computeBoundsTree();merged.computeBoundingSphere();M.colGeo=merged;}}
  MODELS[key]=M;return M;}

export function loadModel(mkLoader,BASE,key){
  if(MODELS[key])return Promise.resolve(MODELS[key]);if(PENDING[key])return PENDING[key];
  return PENDING[key]=mkLoader().loadAsync(BASE+'models/'+PATH[key]+'.glb').then(g=>prep(key,g.scene)).catch(e=>{console.warn('model',key,e&&e.message);return null;});}

export async function ensureModels(mkLoader,BASE,keys,onProg){let n=0;const ks=[...new Set(keys)].filter(k=>PATH[k]);
  await Promise.all(ks.map(k=>loadModel(mkLoader,BASE,k).then(()=>{onProg&&onProg(++n/ks.length);})));}

export const has=k=>!!MODELS[k];
export function clone(key){const M=MODELS[key];if(!M)return null;const c=M.scene.clone(true);c.userData.model=key;return c;}
// node lookup inside a placed model (Turret, Gun, Door, Head…)
export function node(obj,name){let r=null;obj.traverse(o=>{if(!r&&o.name===name)r=o;});return r;}

// collision proxy for a placed instance (shares the BVH geometry)
export function colProxy(key,matrixWorld){const M=MODELS[key];if(!M||!M.colGeo)return null;const m=new THREE.Mesh(M.colGeo,COLMAT);m.matrixAutoUpdate=false;m.matrix.copy(matrixWorld);m.matrixWorld.copy(matrixWorld);
  m.userData.col=true;m.userData.sphere=M.colGeo.boundingSphere.clone().applyMatrix4(matrixWorld);return m;}

// instanced scatter: list of Matrix4 per key -> one InstancedMesh per sub-mesh
export function instance(key,mats,root,{shadow=true}={}){const M=MODELS[key];if(!M||!mats.length)return [];const out=[];const tmp=new THREE.Matrix4();
  for(const p of M.parts){const im=new THREE.InstancedMesh(p.geo,p.mat,mats.length);for(let i=0;i<mats.length;i++){tmp.multiplyMatrices(mats[i],p.mat4);im.setMatrixAt(i,tmp);}
    im.instanceMatrix.needsUpdate=true;im.castShadow=shadow;im.receiveShadow=true;im.computeBoundingSphere&&im.computeBoundingSphere();root.add(im);out.push(im);}
  return out;}
