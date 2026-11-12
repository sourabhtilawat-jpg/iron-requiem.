// Iron Requiem — weapon catalog, gunsmith attachments, stats and first-person gun models
import * as THREE from 'three';

// cls: rifle (semi-auto), bolt, smg, ar, lmg, shotgun, pistol
// mag/res = magazine & reserve; dmg per bullet (per pellet for shotguns); rate = seconds between shots
// spread = hip spread, ads = aimed spread, recoil = vertical kick, rl = reload time, mob = move speed multiplier
// range = metres before damage falls off
export const WEAPONS = {
  // ---- United States ----
  garand:     {name:'M1 GARAND',        nation:'US', cls:'rifle',  mag:8,  res:64,  dmg:65, rate:.2,  auto:false, spread:.02,  ads:.0012, recoil:.032, rl:2.1, zoom:1.6, mob:.95, range:120, snd:'garand',
               m:{recv:.2, barrel:.42, stock:'wood', wood:'full', magT:'internal', r:.009}},
  carbine:    {name:'M1 CARBINE',       nation:'US', cls:'rifle',  mag:15, res:90,  dmg:42, rate:.13, auto:false, spread:.022, ads:.002,  recoil:.018, rl:1.8, zoom:1.5, mob:1,   range:90,  snd:'carbine',
               m:{recv:.16,barrel:.3, stock:'wood', wood:'full', magT:'box', magS:.6, r:.008}},
  springfield:{name:'M1903 SPRINGFIELD',nation:'US', cls:'bolt',   mag:5,  res:40,  dmg:125,rate:1.1, auto:false, spread:.035, ads:.0004, recoil:.06,  rl:2.6, zoom:1.8, mob:.92, range:250, snd:'bolt',
               m:{recv:.2, barrel:.48, stock:'wood', wood:'full', magT:'internal', bolt:true, r:.009}},
  thompson:   {name:'THOMPSON M1A1',    nation:'US', cls:'smg',    mag:30, res:150, dmg:27, rate:.085,auto:true,  spread:.03,  ads:.009,  recoil:.011, rl:2.5, zoom:1.3, mob:1.05,range:45,  snd:'thompson',
               m:{recv:.32,barrel:.2, stock:'wood', wood:'grip', magT:'stick', magS:1, r:.015, fins:true}},
  greasegun:  {name:'M3 GREASE GUN',    nation:'US', cls:'smg',    mag:30, res:150, dmg:30, rate:.12, auto:true,  spread:.028, ads:.008,  recoil:.009, rl:2.3, zoom:1.3, mob:1.07,range:40,  snd:'smg',
               m:{recv:.28,barrel:.14,stock:'wire', wood:'none', magT:'stick', magS:1.1, r:.013, round:true}},
  bar:        {name:'BAR M1918',        nation:'US', cls:'lmg',    mag:20, res:120, dmg:48, rate:.11, auto:true,  spread:.035, ads:.006,  recoil:.022, rl:2.8, zoom:1.45,mob:.82, range:110, snd:'lmg',
               m:{recv:.3, barrel:.46,stock:'wood', wood:'half', magT:'box', magS:1, r:.012, bipod:true}},
  trenchgun:  {name:'M97 TRENCH GUN',   nation:'US', cls:'shotgun',mag:6,  res:36,  dmg:22, pellets:9, rate:.75, auto:false, spread:.075, ads:.055, recoil:.07, rl:3.2, zoom:1.2, mob:1, range:18, snd:'shotgun',
               m:{recv:.2, barrel:.42,stock:'wood', wood:'pump', magT:'tube', r:.013, shroud:true}},
  m1911:      {name:'M1911',            nation:'US', cls:'pistol', mag:7,  res:42,  dmg:38, rate:.14, auto:false, spread:.025, ads:.005,  recoil:.03,  rl:1.5, zoom:1.15,mob:1.1, range:35,  snd:'pistol',
               m:{pistol:true, slide:.17}},
  // ---- Germany ----
  kar98k:     {name:'KARABINER 98K',    nation:'DE', cls:'bolt',   mag:5,  res:40,  dmg:115,rate:1.0, auto:false, spread:.035, ads:.0005, recoil:.058, rl:2.5, zoom:1.8, mob:.93, range:240, snd:'bolt',
               m:{recv:.2, barrel:.45,stock:'wood', wood:'full', magT:'internal', bolt:true, r:.009}},
  g43:        {name:'GEWEHR 43',        nation:'DE', cls:'rifle',  mag:10, res:70,  dmg:58, rate:.19, auto:false, spread:.022, ads:.0015, recoil:.03,  rl:2.2, zoom:1.6, mob:.94, range:130, snd:'garand',
               m:{recv:.22,barrel:.4, stock:'wood', wood:'half', magT:'box', magS:.7, r:.009}},
  mp40:       {name:'MP 40',            nation:'DE', cls:'smg',    mag:32, res:160, dmg:26, rate:.1,  auto:true,  spread:.028, ads:.008,  recoil:.009, rl:2.3, zoom:1.3, mob:1.06,range:42,  snd:'smg',
               m:{recv:.3, barrel:.2, stock:'wire', wood:'none', magT:'stick', magS:1.25, r:.012}},
  stg44:      {name:'STURMGEWEHR 44',   nation:'DE', cls:'ar',     mag:30, res:150, dmg:34, rate:.09, auto:true,  spread:.026, ads:.004,  recoil:.016, rl:2.4, zoom:1.45,mob:.97, range:85,  snd:'ar',
               m:{recv:.34,barrel:.28,stock:'wood', wood:'half', magT:'curved', magS:1, r:.011}},
  mg42:       {name:'MG 42',            nation:'DE', cls:'lmg',    mag:50, res:200, dmg:36, rate:.05, auto:true,  spread:.045, ads:.012,  recoil:.02,  rl:4.2, zoom:1.35,mob:.75, range:100, snd:'mg42',
               m:{recv:.36,barrel:.36,stock:'wood', wood:'none', magT:'drum', magS:1, r:.016, shroud:true, bipod:true}},
  luger:      {name:'LUGER P08',        nation:'DE', cls:'pistol', mag:8,  res:48,  dmg:32, rate:.12, auto:false, spread:.022, ads:.004,  recoil:.024, rl:1.6, zoom:1.15,mob:1.1, range:35,  snd:'pistol',
               m:{pistol:true, slide:.19}},
  // ---- Britain / Soviet Union ----
  enfield:    {name:'LEE-ENFIELD No.4', nation:'UK', cls:'bolt',   mag:10, res:60,  dmg:100,rate:.75, auto:false, spread:.035, ads:.0006, recoil:.052, rl:2.8, zoom:1.75,mob:.93, range:220, snd:'bolt',
               m:{recv:.2, barrel:.42,stock:'wood', wood:'full', magT:'box', magS:.5, bolt:true, r:.009}},
  sten:       {name:'STEN Mk II',       nation:'UK', cls:'smg',    mag:32, res:160, dmg:25, rate:.09, auto:true,  spread:.032, ads:.009,  recoil:.01,  rl:2.2, zoom:1.3, mob:1.08,range:38,  snd:'smg',
               m:{recv:.3, barrel:.12,stock:'wire', wood:'none', magT:'side', magS:1.2, r:.014, round:true}},
  bren:       {name:'BREN Mk I',        nation:'UK', cls:'lmg',    mag:30, res:150, dmg:44, rate:.11, auto:true,  spread:.034, ads:.006,  recoil:.019, rl:3.0, zoom:1.45,mob:.8,  range:115, snd:'lmg',
               m:{recv:.32,barrel:.44,stock:'wood', wood:'none', magT:'top', magS:1, r:.012, bipod:true}},
  ppsh:       {name:'PPSh-41',          nation:'SU', cls:'smg',    mag:71, res:213, dmg:22, rate:.055,auto:true,  spread:.034, ads:.011,  recoil:.009, rl:3.4, zoom:1.3, mob:1.02,range:38,  snd:'smg',
               m:{recv:.3, barrel:.18,stock:'wood', wood:'full', magT:'drum', magS:1, r:.012, shroud:true}},
  mosin:      {name:'MOSIN-NAGANT',     nation:'SU', cls:'bolt',   mag:5,  res:40,  dmg:120,rate:1.15,auto:false, spread:.035, ads:.0004, recoil:.06,  rl:2.7, zoom:1.8, mob:.92, range:250, snd:'bolt',
               m:{recv:.2, barrel:.5, stock:'wood', wood:'full', magT:'internal', bolt:true, r:.009}},
  webley:     {name:'WEBLEY REVOLVER',  nation:'UK', cls:'pistol', mag:6,  res:36,  dmg:52, rate:.32, auto:false, spread:.03,  ads:.005,  recoil:.045, rl:2.2, zoom:1.15,mob:1.1, range:35,  snd:'pistol',
               m:{pistol:true, slide:.2, revolver:true}}
};
export const CLASS_NAMES = {rifle:'Semi-Auto Rifle', bolt:'Bolt-Action Sniper', smg:'Submachine Gun', ar:'Assault Rifle', lmg:'Light Machine Gun', shotgun:'Shotgun', pistol:'Pistol'};

// Gunsmith attachments
export const ATT = {
  optic: {label:'OPTIC', opts:{
    iron:  {name:'Iron Sights'},
    scope2:{name:'2.5x Scope', cls:['rifle','ar','bolt','lmg'], zoom:2.5, adsTime:1.15},
    scope4:{name:'4x Sniper Scope', cls:['bolt','rifle'], zoom:4.2, adsTime:1.3, mob:-.03}}},
  barrel:{label:'BARREL', opts:{
    std:  {name:'Standard'},
    long: {name:'Long Barrel', cls:['rifle','bolt','ar','lmg','shotgun','smg'], range:1.35, acc:.8, mob:-.04},
    short:{name:'Short Barrel', cls:['rifle','bolt','ar','lmg','shotgun','smg'], range:.8, acc:1.15, mob:.04}}},
  mag:   {label:'MAGAZINE', opts:{
    std:{name:'Standard'},
    ext:{name:'Extended Mag', cls:['rifle','smg','ar','lmg','pistol','shotgun'], magX:1.5, rl:1.2, mob:-.02},
    fast:{name:'Fast Reload', cls:['rifle','smg','ar','lmg','pistol','bolt','shotgun'], rl:.75}}},
  stock: {label:'STOCK', opts:{
    std:{name:'Standard'},
    padded:{name:'Padded Stock', cls:['rifle','bolt','smg','ar','lmg','shotgun'], recoil:.75, mob:-.02},
    light:{name:'Lightweight Stock', cls:['rifle','bolt','smg','ar','shotgun'], recoil:1.15, mob:.05}}},
  under: {label:'UNDERBARREL', opts:{
    none:{name:'None'},
    grip:{name:'Foregrip', cls:['smg','ar','lmg'], recoil:.8, acc:.9},
    bayonet:{name:'Bayonet', cls:['rifle','bolt','shotgun'], melee:true, mob:-.01}}}
};
export const ATT_SLOTS = Object.keys(ATT);
export function attAllowed(wid, slot, opt){const o=ATT[slot].opts[opt];return !o.cls||o.cls.includes(WEAPONS[wid].cls);}
export function defaultAtt(){return {optic:'iron',barrel:'std',mag:'std',stock:'std',under:'none'};}

// Effective stats after attachments
export function effStats(wid, att){
  const b=WEAPONS[wid];const w={...b, id:wid, att:{...defaultAtt(),...(att||{})}};
  let mob=0;
  for(const s of ATT_SLOTS){const o=ATT[s].opts[w.att[s]];if(!o||!attAllowed(wid,s,w.att[s])){w.att[s]=Object.keys(ATT[s].opts)[0];continue;}
    if(o.zoom)w.zoom=o.zoom;if(o.range)w.range*=o.range;if(o.acc){w.spread*=o.acc;w.ads*=o.acc;}if(o.magX)w.mag=Math.round(w.mag*o.magX);
    if(o.rl)w.rl*=o.rl;if(o.recoil)w.recoil*=o.recoil;if(o.mob)mob+=o.mob;if(o.melee)w.bayonet=true;if(o.adsTime)w.adsTime=o.adsTime;}
  w.mob=b.mob+mob;w.scoped=w.att.optic!=='iron';
  if(w.att.mag==='ext')w.res=Math.round(w.res*1.3);
  // first-person pose
  const P=b.m.pistol;w.hip=P?[.1,-.12,-.3]:[.12,-.17,-.27];
  return w;
}
// 0..1 values for the stat bars
export function statBars(w){
  const dps=w.dmg*(w.pellets||1)/w.rate;
  return {
    Damage: Math.min(1,(w.dmg*(w.pellets||1))/140),
    'Fire Rate': Math.min(1,(1/w.rate)/18),
    Accuracy: Math.min(1,1-w.ads*40),
    Range: Math.min(1,w.range/250),
    Control: Math.min(1,1-w.recoil*12),
    Mobility: Math.min(1,(w.mob-.7)/.42),
    DPS: Math.min(1,dps/650)
  };
}

// ---------- first-person model builder ----------
export function buildGunVM(w, mats){
  const {wood,met,skin,sleeve,blued}=mats;const m=w.m;const g=new THREE.Group();
  const box=(x,y,z,mt)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(x,y,z),mt);return o;};
  const cyl=(r,l,mt,seg=12)=>{const c=new THREE.Mesh(new THREE.CylinderGeometry(r,r,l,seg),mt);c.rotation.x=Math.PI/2;return c;};
  const add=(o,x,y,z,rx=0)=>{o.position.set(x,y,z);o.rotation.x+=rx;g.add(o);return o;};
  let muzZ, sightY=.05, gripZ=-.04, foreZ=-.4;
  if(m.pistol){
    add(box(.028,.035,m.slide,blued),0,.015,-m.slide/2+.01);
    if(m.revolver){add(cyl(.022,.045,met),0,.01,-.03);add(cyl(.008,m.slide*.7,met),0,.022,-m.slide*.65);}
    add(box(.026,.09,.04,wood),0,-.04,0,.25);add(box(.006,.012,.006,met),0,.038,-m.slide+.015);add(box(.012,.01,.008,met),0,.038,-.005);
    add(box(.05,.06,.07,skin),.004,-.06,.01);add(box(.04,.055,.07,skin),-.03,-.065,0);
    const r1=add(box(.065,.065,.3,sleeve),.03,-.1,.17,.3);const r2=add(box(.06,.06,.3,sleeve),-.06,-.1,.16,.3);r2.rotation.y=-.3;
    muzZ=-m.slide-.005;sightY=.04;
  } else {
    const L=m.recv, B=m.barrel*(w.att.barrel==='long'?1.25:w.att.barrel==='short'?.75:1);
    const rz=-.12-L/2; // receiver centre
    add(box(.042,.05,L,blued),0,.022,rz);                       // receiver
    if(m.round){add(cyl(.024,L,blued),0,.022,rz);}
    const bEnd=-.12-L-B;add(cyl(m.r,B,met),0,.03,-.12-L-B/2);   // barrel
    if(m.shroud){const s=add(cyl(m.r*1.9,B*.8,blued,8),0,.03,-.12-L-B*.4);s.material=blued;}
    if(m.fins){for(let k=0;k<5;k++)add(cyl(m.r*1.4,.008,met),0,.03,-.12-L-.02-k*.025);}
    // stock
    if(m.stock==='wood'){add(box(.045,.07,.3,wood),0,-.02,.04,-.08);}
    else if(m.stock==='wire'){add(box(.008,.008,.28,met),.016,0,.06);add(box(.008,.008,.28,met),-.016,0,.06);add(box(.04,.05,.01,met),0,-.01,.2);}
    // furniture
    if(m.wood==='full'){add(box(.044,.035,B*.85+L*.3,wood),0,.006,-.12-L*.6-B*.4);}
    else if(m.wood==='half'){add(box(.044,.035,B*.45,wood),0,.012,-.12-L-B*.2);}
    else if(m.wood==='grip'){add(box(.035,.07,.05,wood),0,-.04,-.12-L*.85);}
    else if(m.wood==='pump'){add(box(.04,.04,.14,wood),0,-.002,-.12-L-B*.35);}
    if(m.magT==='tube')add(cyl(.011,B*.8,blued),0,.002,-.12-L-B*.4);
    // pistol grip
    add(box(.035,.08,.035,wood),0,-.055,-.07,.3);
    // magazine
    const ms=(m.magS||1)*(w.att.mag==='ext'?1.35:1);const mz=-.12-L*.45;
    if(m.magT==='box')add(box(.03,.09*ms,.06,blued),0,-.03-.045*ms,mz);
    else if(m.magT==='stick')add(box(.026,.17*ms,.04,blued),0,-.01-.085*ms,mz,.08);
    else if(m.magT==='curved'){add(box(.028,.1*ms,.05,blued),0,-.05*ms,mz,.15);add(box(.028,.08*ms,.05,blued),0,-.12*ms,mz+.02,.4);}
    else if(m.magT==='drum'){const d=cyl(.06,.05,blued,16);d.rotation.set(0,0,Math.PI/2);add(d,0,-.06,mz);}
    else if(m.magT==='side'){const s=box(.17*ms,.026,.04,blued);add(s,-.1*ms,.02,mz);}
    else if(m.magT==='top'){add(box(.028,.12*ms,.05,blued),0,.1,mz,-.25);}
    if(m.bolt){add(cyl(.006,.05,met),.035,.035,-.16).rotation.set(0,0,Math.PI/2);add(new THREE.Mesh(new THREE.SphereGeometry(.011,8,6),met),.06,.035,-.16);}
    if(m.bipod){add(box(.006,.006,.12,met),.012,-.01,bEnd+.06,.4);add(box(.006,.006,.12,met),-.012,-.01,bEnd+.06,.4);}
    // sights / optics
    add(box(.006,.022,.006,met),0,.05,bEnd+.03);add(box(.02,.018,.012,met),0,.053,-.13);
    if(w.scoped){const len=w.att.optic==='scope4'?.3:.2;const sc=add(cyl(.019,len,blued),0,.085,-.12-L*.5);add(cyl(.026,.05,blued),0,.085,-.12-L*.5-len/2);add(cyl(.024,.04,blued),0,.085,-.12-L*.5+len/2);
      add(box(.012,.03,.012,met),0,.06,-.12-L*.5-.05);add(box(.012,.03,.012,met),0,.06,-.12-L*.5+.05);sightY=.085;}
    if(w.att.under==='grip'&&m.wood!=='grip')add(box(.03,.07,.035,wood),0,-.04,-.12-L-B*.15);
    if(w.att.under==='bayonet'){const bl=add(box(.004,.018,.22,met),0,.008,bEnd-.09);}
    muzZ=bEnd-.01;foreZ=-.12-L-Math.min(B*.3,.15);
    // hands
    add(box(.045,.04,.075,skin),0,-.025,foreZ);const ls=add(box(.062,.062,.32,sleeve),-.05,-.075,foreZ+.15,.22);ls.rotation.y=-.35;
    add(box(.045,.05,.06,skin),.012,-.04,gripZ);const rs=add(box(.068,.068,.3,sleeve),.045,-.09,gripZ+.16,.3);rs.rotation.y=.15;
  }
  const muz=new THREE.Object3D();muz.position.set(0,.03,muzZ);g.add(muz);g.userData.muz=muz;
  w.aim=[0,-sightY,m.pistol?-.3:-.26];
  g.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;o.renderOrder=10;}});
  return g;
}

// third-person rifle silhouette for soldiers holding this weapon
export function weaponLength(wid){const m=WEAPONS[wid].m;return m.pistol?.25:(m.recv+m.barrel+.35);}
