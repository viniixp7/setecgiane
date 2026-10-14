'use strict';
// ===== CONFIGURAÇÃO =====
const $=id=>document.getElementById(id), clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), rnd=(a,b)=>a+Math.random()*(b-a);
let seed=12345;const R=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;
const ITEMS={water:['Água','bebidas',.5],soda:['Refrigerante','bebidas',.4],can:['Comida enlatada','comida',.4],bread:['Pão','comida',.3],fruit:['Fruta','comida',.2],meal:['Comida pronta','comida',.5],
bandage:['Bandagem','medicamentos',.1],pills:['Antiviral','medicamentos',.1],medkit:['Kit médico','medicamentos',.6],ammo9:['Munição 9mm','munição',.05],shells:['Cartuchos 12','munição',.08],
bat:['Taco','armas',1.5],knife:['Faca','armas',.5],axe:['Machado','armas',2],pistol:['Pistola','armas',1],shotgun:['Espingarda','armas',3],hammer:['Martelo','ferramentas',1],
wood:['Madeira','materiais',1],nails:['Pregos','materiais',.05],fuel:['Combustível','ferramentas',3],battery:['Bateria','ferramentas',2],key:['Chave do carro','ferramentas',.1]};
const WEAPONS={fists:{d:8,r:2,noise:4,cd:.5},bat:{d:25,r:2.6,noise:10,cd:.6},knife:{d:15,r:2.1,noise:3,cd:.35},axe:{d:40,r:2.6,noise:12,cd:.9},
pistol:{d:35,r:70,mag:12,ammo:'ammo9',rl:1.8,noise:70,cd:.3},shotgun:{d:90,r:28,mag:6,ammo:'shells',rl:2.8,noise:95,cd:.9}};
const SLOTS=['bat','knife','axe','pistol','shotgun'];
const TABLES={house:['water','can','bread','soda','bandage','nails','wood','ammo9','knife','bat','fruit'],super:['water','can','soda','bread','fruit','meal','water','can'],
pharm:['bandage','pills','medkit','bandage','water'],tools:['hammer','wood','nails','wood','axe','nails','battery'],gas:['fuel','soda','hammer','bread','nails'],
rest:['meal','bread','fruit','water','soda'],hosp:['bandage','medkit','pills','bandage','medkit','water'],police:['ammo9','shells','pistol','shotgun','bandage','ammo9','shells'],car:['fuel','battery','nails','ammo9','water'],office:['water','soda','bandage','can','ammo9']};
const GUARANTEE={police:'key',gas:'fuel',tools:'battery',pharm:'pills'};
const RADIO=["...se alguém estiver ouvindo... não vá para o centro da cidade...","Dia 3. Evacuação cancelada. Quem ficou, ficou.","O hospital... foi onde tudo começou. Os pacientes não morreram. Eles acordaram.","Ponto de evacuação: extremo sudeste. Precisa de chave, bateria e combustível para o carro.","A delegacia tem a chave da van. Mas ouvi tiros lá dentro...","Eles ouvem tudo. Tiros atraem hordas. Silêncio é vida."];
const LOT=40,SIZE=24,ELEV=1.7;
// ===== CENA =====
const renderer=new THREE.WebGLRenderer({canvas:$('game'),antialias:true});renderer.shadowMap.enabled=true;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x8a9aa0,.012);
const camera=new THREE.PerspectiveCamera(75,1,.1,260);camera.rotation.order='YXZ';scene.add(camera);
const hemi=new THREE.HemisphereLight(0xaabbcc,0x333322,.6);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff0d0,1);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);const sc=sun.shadow.camera;sc.left=sc.bottom=-50;sc.right=sc.top=50;sc.far=200;scene.add(sun,sun.target);
const moon=new THREE.Mesh(new THREE.SphereGeometry(5,8,8),new THREE.MeshBasicMaterial({color:0xccd6ee}));scene.add(moon);
const sunM=new THREE.Mesh(new THREE.SphereGeometry(7,8,8),new THREE.MeshBasicMaterial({color:0xffe9a0}));scene.add(sunM);
const flash=new THREE.SpotLight(0xfff2cc,0,45,.5,.5,1);flash.position.set(0,0,0);flash.target.position.set(0,0,-5);camera.add(flash,flash.target);
const mat=(c,e)=>new THREE.MeshLambertMaterial({color:c,emissive:e||0});
const boxG=new THREE.BoxGeometry(1,1,1);
const solids=[],colliders=[],acts=[],lots=[];
function box(x,y,z,w,h,d,c,solid,e){const m=new THREE.Mesh(boxG,mat(c,e));m.scale.set(w,h,d);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;scene.add(m);if(solid){const col={minx:x-w/2,maxx:x+w/2,minz:z-d/2,maxz:z+d/2};colliders.push(col);solids.push(m);m.userData.col=col}return m}
// ===== ESTADO =====
let P,Z=[],mode='menu',gameT=0,weather='clear',wTimer=60,evTimer=60,radioI=0,stash={},looted={},stage=0,atkCd=0,reload=0,flashOn=false,stashOpen=false,msgT=0,hudT=0,yaw=0,pitch=0,vy=0,onGround=true;
const keys={};
function newP(){return{x:-80,z:-80,hp:100,hu:90,th:90,st:100,inf:0,inv:{water:1,bread:1,bandage:1},w:'fists',mag:{pistol:0,shotgun:0},t:480,day:1,kills:0,found:0,time:0,noise:0,fw:0,ff:0,flags:{}}}
// ===== MUNDO =====
function buildWorld(){
 seed=12345;const ground=box(0,-.25,0,300,.5,300,0x2b2d2f,false);ground.castShadow=false;
 const types={'0,0':'office','1,0':'hosp','-1,0':'police','0,1':'super','0,-1':'pharm','1,1':'tools','-1,1':'gas','1,-1':'rest'};
 for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++){const t=types[i+','+j]||'house',x=i*LOT,z=j*LOT;
  const lot=box(x,0,z,SIZE,.2,SIZE,t==='house'?0x2f4a2a:0x6b6b66,false);lot.castShadow=false;lots.push({x,z,t});
  const h=t==='office'?26:t==='hosp'?12:t==='house'?5:7,w=t==='house'?10:16,d=t==='house'?9:14,col=t==='hosp'?0xc9c9c4:t==='police'?0x2a3b66:t==='office'?0x4a4d52:t==='house'?[0x7a5b3f,0x8a8a7a,0x6a4a4a][i+2&1?1:0]:0x6a5a4a;
  const b=box(x,h/2,z,w,h,d,col,true);box(x,h+.3,z,w+.6,.6,d+.6,0x222222,false);
  box(x,1.1,z+d/2+.05,1.6,2.2,.2,0x1a1210,false);
  for(let k=-1;k<=1;k+=2)box(x+k*w*.3,h>6?3.5:2.5,z+d/2+.05,1.4,1.2,.15,0x9fc4d8,false,0x0b1a22);
  if(t==='hosp')box(x,h-2,z+d/2+.1,6,1.5,.2,0xcc2222,false,0x440000);
  if(t==='police')box(x,h-1.5,z+d/2+.1,6,1.2,.2,0x2255ff,false,0x001144);
  const n=t==='house'?2:3;for(let c=0;c<n;c++){const a=c/n*6.28+.5,cx=x+Math.cos(a)*(w/2+3),cz=z+Math.sin(a)*(d/2+3);const m=box(cx,.5,cz,1.2,1,1.2,0x6b4a2a,true);m.userData.act={t:'loot',tab:t,id:i+'_'+j+'_'+c,first:c===0};acts.push(m)}
  if(t==='house'&&R()<.5)box(x+w/2+3,.6,z-4,3,1.2,1.6,0x5a5f66,true);
 }
 // Abrigo (casa -2,-2): baú, rádio
 const sx=-80,sz=-80;const ch=box(sx+7,.5,sz+2,1.6,1,1,0x8a5a20,true);ch.userData.act={t:'stash'};acts.push(ch);
 const rd=box(sx+7,.9,sz-2,.8,.5,.4,0x111111,true,0x330000);rd.userData.act={t:'radio'};acts.push(rd);
 P_shelter={x:sx,z:sz};
 // Ponto de evacuação
 const ev=box(80,.4,80,6,.6,10,0x224422,true);const van=box(80,1.2,80,2.4,1.6,5,0xccccbb,true);van.userData.act={t:'evac'};acts.push(van);box(80,6,84,.3,12,.3,0xffaa00,false,0xff8800);
 // Carros, postes, árvores
 for(let k=0;k<22;k++){const horiz=R()<.5,r=Math.floor(R()*4)-2,off=(r+.5)*LOT,p=R()*200-100;const x=horiz?p:off,z=horiz?off:p;if(Math.abs(x)>110||Math.abs(z)>110)continue;
  const c=box(x,.7,z,horiz?4.4:2,1.2,horiz?2:4.4,[0x6a1a1a,0x1a3a5a,0x777777,0x3a3a2a][k&3],true);box(x,1.6,z,horiz?2.2:1.8,.7,horiz?1.8:2.2,0x222a30,false);c.userData.act={t:'loot',tab:'car',id:'car'+k};acts.push(c)}
 for(let k=-110;k<=110;k+=20)for(let r=-2;r<=2;r++){const o=(r+.5)*LOT;[[k,o],[o,k]].forEach(([x,z])=>{box(x,3,z,.25,6,.25,0x222222,false);box(x,6.1,z,.8,.3,.8,0xffeeaa,false,0x998855)})}
 for(let k=0;k<70;k++){const x=R()*220-110,z=R()*220-110;if(lots.some(l=>Math.abs(l.x-x)<SIZE/2+1&&Math.abs(l.z-z)<SIZE/2+1)&&k%2)continue;if(Math.abs(((x+20)%40+40)%40-20)<10||Math.abs(((z+20)%40+40)%40-20)<10)continue;
  const lt=lots.find(l=>Math.abs(l.x-x)<SIZE/2&&Math.abs(l.z-z)<SIZE/2);if(lt&&lt.t!=='house')continue;box(x,1.5,z,.5,3,.5,0x4a3220,true);box(x,3.8,z,2.6,2.4,2.6,0x1e3a1e,false)}
 for(let k=0;k<30;k++){const horiz=R()<.5,off=(Math.floor(R()*4)-2+.5)*LOT+(R()<.5?-5:5),p=R()*200-100;box(horiz?p:off,.5,horiz?off:p,1,1,1,0x444444,true)}
 // muro externo
 [[0,-125,250,2],[0,125,250,2],[-125,0,2,250],[125,0,2,250]].forEach(([x,z,w,d])=>box(x,2,z,w,4,d,0x333333,true));
}
let P_shelter;
// ===== COLISÕES =====
function hit(x,z,r){for(const c of colliders)if(x>c.minx-r&&x<c.maxx+r&&z>c.minz-r&&z<c.maxz+r)return c;return null}
// ===== ZUMBIS =====
const ZT={normal:{hp:60,sp:1.6,dmg:8,cd:1.2,c:0x4a6a4a,sc:1},fast:{hp:35,sp:4.2,dmg:6,cd:.6,c:0x6a7a3a,sc:.9},strong:{hp:200,sp:1.1,dmg:25,cd:1.8,c:0x5a3a3a,sc:1.35}};
function spawnZ(type,x,z){const T=ZT[type],g=new THREE.Group(),m=mat(T.c);
 const b=new THREE.Mesh(boxG,m);b.scale.set(.6,1,.35);b.position.y=1.1;const hd=new THREE.Mesh(boxG,mat(0x8a9a7a));hd.scale.set(.35,.35,.35);hd.position.y=1.8;
 const a1=new THREE.Mesh(boxG,m);a1.scale.set(.15,.15,.7);a1.position.set(.4,1.4,.35);const a2=a1.clone();a2.position.x=-.4;
 const l=new THREE.Mesh(boxG,mat(0x2a2a3a));l.scale.set(.5,.7,.3);l.position.y=.35;g.add(b,hd,a1,a2,l);g.scale.setScalar(T.sc);g.position.set(x,0,z);scene.add(g);
 g.traverse(o=>{o.castShadow=true});const zz={g,type,T,hp:T.hp,s:'IDLE',t:rnd(1,4),tx:x,tz:z,cd:0,ls:null};g.userData.z=zz;Z.push(zz)}
function freeSpot(cx,cz,rad){for(let k=0;k<20;k++){const x=clamp(cx+rnd(-rad,rad),-115,115),z=clamp(cz+rnd(-rad,rad),-115,115);if(!hit(x,z,1))return[x,z]}return[cx,cz]}
function populate(){Z.forEach(z=>scene.remove(z.g));Z=[];
 lots.forEach(l=>{const n=l.t==='hosp'?7:l.t==='office'?6:l.t==='police'?4:l.t==='house'?1:2;if(Math.hypot(l.x-P_shelter.x,l.z-P_shelter.z)<30)return;
  for(let k=0;k<n;k++){const[x,z]=freeSpot(l.x,l.z,22);spawnZ(Math.random()<.2?'fast':Math.random()<.15?'strong':'normal',x,z)}});
 for(let k=0;k<12;k++){const[x,z]=freeSpot(rnd(-100,100),rnd(-100,100),5);spawnZ('normal',x,z)}}
function noise(x,z,r){Z.forEach(q=>{if(Math.hypot(q.g.position.x-x,q.g.position.z-z)<r&&q.s!=='CHASE'&&q.s!=='ATTACK'){q.s='ALERT';q.tx=x+rnd(-3,3);q.tz=z+rnd(-3,3)}})}
function zMove(q,tx,tz,sp,dt){const p=q.g.position,dx=tx-p.x,dz=tz-p.z,d=Math.hypot(dx,dz)||1;if(d<.3)return true;
 q.g.rotation.y=Math.atan2(dx,dz);const vx=dx/d*sp*dt,vz=dz/d*sp*dt;
 let c=hit(p.x+vx,p.z,.45);if(!c)p.x+=vx;let c2=hit(p.x,p.z+vz,.45);if(!c2)p.z+=vz;
 const bc=c||c2;if(bc&&bc.hp!==undefined){bc.hp-=q.T.dmg*dt;if(bc.hp<=0){scene.remove(bc.mesh);colliders.splice(colliders.indexOf(bc),1);solids.splice(solids.indexOf(bc.mesh),1)}}else if(bc){q.t-=dt*2;if(q.s==='PATROL'){q.tx=p.x+rnd(-15,15);q.tz=p.z+rnd(-15,15)}}
 return false}
function updZ(q,dt){const p=q.g.position,dx=P.x-p.x,dz=P.z-p.z,d=Math.hypot(dx,dz),night=isNight(),sight=(night?9:16)*(weather==='fog'?.6:1);q.cd-=dt;
 if(q.s!=='CHASE'&&q.s!=='ATTACK'&&(d<sight||d<P.noise*.6)){q.s='CHASE'}
 switch(q.s){
 case'IDLE':q.t-=dt;if(q.t<=0){q.s='PATROL';q.tx=p.x+rnd(-20,20);q.tz=p.z+rnd(-20,20);q.t=8}break;
 case'PATROL':q.t-=dt;if(zMove(q,q.tx,q.tz,q.T.sp*.4,dt)||q.t<=0){q.s='IDLE';q.t=rnd(2,6)}break;
 case'ALERT':if(zMove(q,q.tx,q.tz,q.T.sp*.7,dt)){q.s='SEARCH';q.t=6}break;
 case'CHASE':q.ls=[P.x,P.z];zMove(q,P.x,P.z,q.T.sp,dt);if(d<1.4)q.s='ATTACK';else if(d>sight*2+10){q.s='SEARCH';q.t=7;q.tx=q.ls[0];q.tz=q.ls[1]}break;
 case'ATTACK':q.g.rotation.y=Math.atan2(dx,dz);if(d>1.8)q.s='CHASE';else if(q.cd<=0){q.cd=q.T.cd;hurt(q.T.dmg);if(Math.random()<.3)P.inf=Math.min(100,P.inf+rnd(4,10))}break;
 case'SEARCH':q.t-=dt;if(zMove(q,q.tx,q.tz,q.T.sp*.5,dt)){q.tx+=rnd(-6,6);q.tz+=rnd(-6,6)}if(q.t<=0){q.s='PATROL';q.t=8}break}
 if(Math.hypot(P.x-p.x,P.z-p.z)>150){}}
function hurt(d){P.hp-=d;$('vig').style.boxShadow='inset 0 0 120px 30px rgba(180,0,0,.7)';setTimeout(()=>$('vig').style.boxShadow='inset 0 0 0 0 rgba(0,0,0,0)',250);beep(90,.15)}
// ===== INVENTÁRIO =====
const add=(k,n=1)=>{P.inv[k]=(P.inv[k]||0)+n;P.found+=n;if(ITEMS[k][1]==='bebidas')P.fw+=n;if(ITEMS[k][1]==='comida')P.ff+=n;P.flags[k]=1};
const weight=()=>Object.entries(P.inv).reduce((s,[k,n])=>s+ITEMS[k][2]*n,0),MAXW=30;
function use(k){const i=P.inv;if(!i[k])return;
 const eat=(h,t,x)=>{P.hu=clamp(P.hu+h,0,100);P.th=clamp(P.th+t,0,100);P.hp=clamp(P.hp+(x||0),0,100);dec(k);toast(ITEMS[k][0]+' usado')};
 if(k==='water')eat(0,35);else if(k==='soda')eat(3,20);else if(k==='can')eat(30,0);else if(k==='bread')eat(20,0);else if(k==='fruit')eat(12,6);else if(k==='meal')eat(40,5,5);
 else if(k==='bandage')eat(0,0,15);else if(k==='medkit')eat(0,0,50);else if(k==='pills'){P.inf=Math.max(0,P.inf-40);dec(k);toast('Infecção reduzida')}
 else if(WEAPONS[k]){P.w=k;toast('Equipado: '+ITEMS[k][0]);updHud()}
 else toast('Não pode ser usado agora');renderInv()}
function dec(k){P.inv[k]--;if(P.inv[k]<=0)delete P.inv[k]}
function renderInv(){const f=(o,onclick,tag)=>{let h='',cats={};Object.keys(o).forEach(k=>(cats[ITEMS[k][1]]=cats[ITEMS[k][1]]||[]).push(k));
 Object.keys(cats).forEach(c=>{h+='<div class="cat">'+c.toUpperCase()+'</div>';cats[c].forEach(k=>h+='<div class="row" data-k="'+k+'" data-t="'+tag+'"><span>'+ITEMS[k][0]+' x'+o[k]+'</span><span>⇄</span></div>')});return h||'(vazio)'};
 $('invL').innerHTML=f(P.inv,0,'i')+'<div class="cat">PESO '+weight().toFixed(1)+' / '+MAXW+' KG</div>';$('stashL').innerHTML=f(stash,0,'s');$('stashC').style.display=nearStash()?'':'none';
 document.querySelectorAll('.row').forEach(r=>r.onclick=e=>{const k=r.dataset.k,t=r.dataset.t,sw=e.offsetX>r.offsetWidth-40;
  if(t==='i'){if(sw&&nearStash()){dec(k);stash[k]=(stash[k]||0)+1}else use(k)}else if(nearStash()){stash[k]--;if(!stash[k])delete stash[k];P.inv[k]=(P.inv[k]||0)+1}renderInv()})}
const nearStash=()=>Math.hypot(P.x-P_shelter.x,P.z-P_shelter.z)<14;
// ===== LOOT / INTERAÇÃO =====
let searching=null;
const ray=new THREE.Raycaster();
function target(){ray.setFromCamera({x:0,y:0},camera);ray.far=3.8;const h=ray.intersectObjects(acts,false)[0];return h&&h.object.userData.act&&!h.object.userData.act.done?h.object:null}
function interact(){const o=target();if(!o)return;const a=o.userData.act;
 if(a.t==='loot'){if(looted[a.id])return;searching={o,a,t:0};noise(P.x,P.z,10)}
 else if(a.t==='stash'){toggleInv(true)}
 else if(a.t==='radio'){toast('📻 '+RADIO[radioI%RADIO.length]);radioI++;beep(300,.3)}
 else if(a.t==='evac'){if(P.flags.key&&P.flags.fuel&&P.flags.battery&&P.inv.key&&P.inv.fuel&&P.inv.battery)endGame(true);else toast('A van precisa de CHAVE, BATERIA e COMBUSTÍVEL (na mochila).')}}
function doLoot(a){looted[a.id]=1;const tab=a.tab,tb=TABLES[tab],out=[];
 if(a.first&&GUARANTEE[tab]&&!P.flags[GUARANTEE[tab]]&&!P.inv[GUARANTEE[tab]])out.push(GUARANTEE[tab]);
 if(Math.random()<(tab==='car'?.5:.75)){const n=1+Math.floor(Math.random()*3);for(let k=0;k<n;k++)out.push(tb[Math.floor(Math.random()*tb.length)])}
 if(!out.length){toast('Vazio...');return}
 const sum={};out.forEach(k=>sum[k]=(sum[k]||0)+1);let s='Você encontrou:\n';
 for(const k in sum){const n=sum[k];if(weight()+ITEMS[k][2]*n>MAXW+6){s+='(sem espaço) '+ITEMS[k][0]+'\n';continue}add(k,n);s+=ITEMS[k][0]+' x'+n+'\n'}toast(s)}
// ===== ARMAS =====
function attack(){if(atkCd>0||reload>0)return;const W=WEAPONS[P.w];atkCd=W.cd;
 if(W.mag){if(!P.mag[P.w]){toast('Sem munição no carregador! (R)');beep(200,.05);return}P.mag[P.w]--;beep(P.w==='pistol'?600:400,.1)}
 noise(P.x,P.z,W.noise);P.noise=Math.max(P.noise,W.noise);
 ray.setFromCamera({x:0,y:0},camera);ray.far=W.r;const zs=Z.map(q=>q.g),hs=ray.intersectObjects(zs.concat(solids),true);
 const reps=P.w==='shotgun'?4:1;let done=false;
 for(let n=0;n<reps;n++){if(n>0)ray.setFromCamera({x:rnd(-.08,.08),y:rnd(-.08,.08)},camera);const hh=n?ray.intersectObjects(zs.concat(solids),true):hs;if(!hh.length)continue;
  let o=hh[0].object;while(o&&!o.userData.z&&o.parent!==scene)o=o.parent;const q=o&&o.userData.z;if(q){q.hp-=W.d/(P.w==='shotgun'?2:1);q.s='CHASE';done=true;if(q.hp<=0){scene.remove(q.g);Z.splice(Z.indexOf(q),1);P.kills++}}}
 if(W.mag===undefined)P.st=Math.max(0,P.st-4);vm.position.z=-.3}
function doReload(){const W=WEAPONS[P.w];if(!W.mag||reload>0)return;const have=P.inv[W.ammo]||0,need=W.mag-P.mag[P.w];if(!have||!need){toast(have?'Carregador cheio':'Sem munição na mochila');return}
 reload=W.rl;$('rl').classList.remove('hide');reload=W.rl;P._rl=Math.min(have,need);beep(250,.2)}
function finishReload(){const W=WEAPONS[P.w];P.mag[P.w]+=P._rl;P.inv[W.ammo]-=P._rl;if(P.inv[W.ammo]<=0)delete P.inv[W.ammo];$('rl').classList.add('hide')}
const vm=new THREE.Mesh(boxG,mat(0x333333));vm.scale.set(.08,.1,.5);vm.position.set(.3,-.28,-.6);camera.add(vm);
// ===== BARRICADA =====
function barricade(){if((P.inv.wood||0)<4||(P.inv.nails||0)<8){toast('Precisa de 4 Madeira e 8 Pregos');return}
 const fx=-Math.sin(yaw),fz=-Math.cos(yaw),x=P.x+fx*2.2,z=P.z+fz*2.2;if(hit(x,z,.5)){toast('Sem espaço aqui');return}
 P.inv.wood-=4;P.inv.nails-=8;if(!P.inv.wood)delete P.inv.wood;if(!P.inv.nails)delete P.inv.nails;
 const alongX=Math.abs(fx)<Math.abs(fz),m=box(x,1.1,z,alongX?3:.4,2.2,alongX?.4:3,0x6a4a28,true);const c=m.userData.col;c.hp=120;c.mesh=m;toast('Barricada construída')}
// ===== DIA E NOITE / CLIMA =====
const isNight=()=>{const h=P.t/60;return h<6||h>=20};
const rain=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:0x99aabb,size:.15}));const rp=new Float32Array(900);for(let i=0;i<900;i+=3){rp[i]=rnd(-25,25);rp[i+1]=rnd(0,25);rp[i+2]=rnd(-25,25)}rain.geometry.setAttribute('position',new THREE.BufferAttribute(rp,3));rain.visible=false;rain.frustumCulled=false;scene.add(rain);
const cD=new THREE.Color(0x8fa5ad),cN=new THREE.Color(0x04060c),col=new THREE.Color();
function updTime(dt){P.t+=dt*2;if(P.t>=1440){P.t-=1440;P.day++;toast('DIA '+P.day)}
 const ang=(P.t-360)/1440*6.283,sh=Math.sin(ang),df=clamp(sh*2+.4,0,1),gl=weather==='clear'?1:weather==='cloud'?.7:.5;
 sun.position.set(P.x+Math.cos(ang)*80,Math.max(sh*100,-20)+5,P.z+30);sun.target.position.set(P.x,0,P.z);sun.intensity=df*gl*1.1;hemi.intensity=.12+df*.55*gl;
 sunM.position.set(P.x+Math.cos(ang)*200,sh*200,P.z-100);moon.position.set(P.x-Math.cos(ang)*200,-sh*200,P.z-100);
 col.copy(cN).lerp(cD,df*gl);scene.background=col;scene.fog.color.copy(col);scene.fog.density=(weather==='fog'?.045:weather==='rain'?.02:.011)+(1-df)*.012;
 rain.visible=weather==='rain';if(rain.visible){rain.position.set(P.x,0,P.z);const a=rain.geometry.attributes.position;for(let i=1;i<900;i+=3){rp[i]-=30*dt;if(rp[i]<0)rp[i]=25}a.needsUpdate=true}
 wTimer-=dt;if(wTimer<=0){weather=['clear','cloud','rain','fog'][Math.floor(Math.random()*4)];wTimer=rnd(60,150)}}
// ===== EVENTOS =====
function events(dt){evTimer-=dt;if(evTimer>0)return;evTimer=rnd(50,110);const r=Math.random();
 if(r<.3){toast('Você ouve uma horda se aproximando...');const a=rnd(0,6.28);for(let k=0;k<5+P.day;k++){const[x,z]=freeSpot(P.x+Math.cos(a)*50,P.z+Math.sin(a)*50,6);spawnZ('normal',x,z);const q=Z[Z.length-1];q.s='ALERT';q.tx=P.x+rnd(-8,8);q.tz=P.z+rnd(-8,8)}}
 else if(r<.55)toast('Uma porta bate ao longe...');else if(r<.75){toast('📻 Estática no rádio do abrigo: '+RADIO[radioI%RADIO.length]);radioI++}
 else{const a=rnd(0,6.28),[x,z]=freeSpot(P.x+Math.cos(a)*14,P.z+Math.sin(a)*14,2);spawnZ(Math.random()<.4?'fast':'normal',x,z);toast('Algo se move atrás de você!')}}
// ===== MISSÕES =====
function objectives(){const dS=Math.hypot(P.x-P_shelter.x,P.z-P_shelter.z);
 if(stage===0&&P.fw>=2&&P.ff>=2){stage=1;toast('Objetivo cumprido!')}if(stage===1&&dS<10){stage=2;toast('Abrigo encontrado! Guarde itens no baú.')}
 if(stage===2&&P.flags.pills){stage=3}if(stage===3&&P.flags.fuel&&P.flags.battery&&P.flags.key)stage=4;
 return['Encontre água e comida.\nÁgua: '+Math.min(2,P.fw)+'/2  Comida: '+Math.min(2,P.ff)+'/2','Encontre um abrigo seguro (casa verde, canto sudoeste).','Encontre medicamentos (Farmácia/Hospital).','Encontre combustível (posto), bateria (loja) e chave (delegacia).','Chegue à van no extremo sudeste e escape da cidade!'][stage]}
// ===== SAVE =====
function save(){const s={P:{...P,x:P.x,z:P.z},stash,looted,stage,radioI};localStorage.setItem('deadcity',JSON.stringify(s));toast('Jogo salvo')}
function load(){const s=JSON.parse(localStorage.getItem('deadcity')||'null');if(!s)return false;P={...newP(),...s.P};stash=s.stash;looted=s.looted;stage=s.stage;radioI=s.radioI||0;return true}
// ===== HUD =====
const mc=$('mini').getContext('2d');
function toast(s){$('msg').textContent=s;msgT=4}
function updHud(){const W=WEAPONS[P.w];$('hp').textContent=Math.ceil(P.hp)+'%';$('hu').textContent=Math.ceil(P.hu)+'%';$('th').textContent=Math.ceil(P.th)+'%';$('st').textContent=Math.ceil(P.st)+'%';$('inf').textContent=Math.floor(P.inf)+'%';$('wt').textContent=weight().toFixed(1)+' / '+MAXW+' KG';
 $('wep').innerHTML='🔫 '+(P.w==='fists'?'PUNHOS':ITEMS[P.w][0].toUpperCase())+(W.mag?'<br>MUNIÇÃO: '+P.mag[P.w]+' / '+(P.inv[W.ammo]||0):'');
 const h=Math.floor(P.t/60),m=Math.floor(P.t%60);$('clock').innerHTML='📅 DIA '+P.day+'<br>'+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+' · '+{clear:'☀',cloud:'☁',rain:'🌧',fog:'🌫'}[weather];$('obj').innerHTML='<b>OBJETIVO:</b><br>'+objectives().replace(/\n/g,'<br>')}
function minimap(){mc.clearRect(0,0,150,150);mc.save();mc.beginPath();mc.arc(75,75,75,0,7);mc.clip();const S=1.1,c=Math.cos(yaw),s=Math.sin(yaw);
 const pt=(x,z)=>{const dx=x-P.x,dz=z-P.z;return[75+(dx*c-dz*s)*S,75+(dx*s+dz*c)*S]};
 const dot=(x,z,col,r)=>{const[a,b]=pt(x,z);mc.fillStyle=col;mc.fillRect(a-r,b-r,r*2,r*2)};
 lots.forEach(l=>dot(l.x,l.z,l.t==='house'?'#2f4a2a':l.t==='hosp'?'#ddd':l.t==='police'?'#36f':'#777',10));
 dot(P_shelter.x,P_shelter.z,'#3f3',5);dot(80,80,'#fa0',5);Z.forEach(q=>{if(Math.hypot(q.g.position.x-P.x,q.g.position.z-P.z)<45)dot(q.g.position.x,q.g.position.z,'#f22',2)});
 mc.restore();mc.fillStyle='#fff';mc.beginPath();mc.moveTo(75,66);mc.lineTo(70,82);mc.lineTo(80,82);mc.fill()}
// ===== SOM =====
let AC;function beep(f,d){try{AC=AC||new AudioContext();const o=AC.createOscillator(),g=AC.createGain();o.frequency.value=f;o.type='square';g.gain.value=.05;o.connect(g);g.connect(AC.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+d);o.stop(AC.currentTime+d)}catch(e){}}
// ===== MENU / ESTADOS =====
const show=(id,v)=>$(id).classList.toggle('hide',!v);
function lock(){$('game').requestPointerLock&&$('game').requestPointerLock()}
function startGame(cont){if(cont){if(!load()){alert('Nenhum save encontrado');return}}else{P=newP();stash={};looted={};stage=0;radioI=0}
 P.t0=Date.now();if(!cont){P.x=P_shelter.x+3;P.z=P_shelter.z+6}populate();['menu','death','pause'].forEach(i=>show(i,0));show('hud',1);mode='play';lock();toast(cont?'Jogo carregado':'Você acorda sozinho... a cidade está em silêncio.\nProcure água e comida.')}
function pause(){if(mode!=='play')return;mode='pause';show('pause',1);document.exitPointerLock()}
function toggleInv(open){if(mode==='play'&&open!==false){mode='inv';show('inv',1);renderInv();document.exitPointerLock()}else if(mode==='inv'){mode='play';show('inv',0);lock()}}
function endGame(win){mode='end';document.exitPointerLock();$('endT').textContent=win?'VOCÊ SOBREVIVEU!':'VOCÊ MORREU';
 const tt=new Date(P.time*1000).toISOString().substr(11,8);$('endS').textContent=(win?'PARABÉNS!\nVocê conseguiu escapar da cidade.\n\n':'')+'DIAS SOBREVIVIDOS: '+P.day+'\nZUMBIS ELIMINADOS: '+P.kills+'\nITENS ENCONTRADOS: '+P.found+'\nTEMPO DE JOGO: '+tt;show('death',1);show('hud',0);if(win||true)localStorage.removeItem('deadcity')}
$('bPlay').onclick=()=>startGame(false);$('bCont').onclick=()=>startGame(true);$('bCtrl').onclick=()=>$('ctrl').classList.toggle('hide');
$('bResume').onclick=()=>{mode='play';show('pause',0);lock()};$('bSave').onclick=save;$('bQuit').onclick=()=>{mode='menu';show('pause',0);show('hud',0);show('menu',1)};
$('bRetry').onclick=()=>startGame(false);$('bMenu2').onclick=()=>{mode='menu';show('death',0);show('menu',1)};
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&mode==='play')pause()});
addEventListener('mousemove',e=>{if(mode!=='play'||!document.pointerLockElement)return;yaw-=e.movementX*.0022;pitch=clamp(pitch-e.movementY*.0022,-1.5,1.5)});
addEventListener('mousedown',e=>{if(mode==='play'&&document.pointerLockElement&&e.button===0)attack()});
addEventListener('keydown',e=>{const k=e.code;keys[k]=true;if(mode==='inv'&&(k==='KeyI'||k==='Escape')){toggleInv(false);return}if(mode!=='play')return;
 if(k==='Space'&&onGround){vy=6.5;onGround=false;e.preventDefault()}else if(k==='KeyE')interact();else if(k==='KeyF')attack();else if(k==='KeyR')doReload();else if(k==='KeyI')toggleInv(true);
 else if(k==='KeyL'){flashOn=!flashOn}else if(k==='KeyB')barricade();else if(k.startsWith('Digit')){const w=SLOTS[+k[5]-1];if(w&&P.inv[w])use(w)}});
addEventListener('keyup',e=>keys[e.code]=false);
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()});
// ===== JOGADOR / MOVIMENTO =====
function updPlayer(dt){const run=keys.ShiftLeft||keys.ShiftRight,fw=(keys.KeyW?1:0)-(keys.KeyS?1:0),sd=(keys.KeyD?1:0)-(keys.KeyA?1:0),moving=fw||sd;
 const heavy=weight()>MAXW,starving=P.hu<10||P.th<10;let sp=4*(heavy?.7:1)*(starving?.75:1),running=false;
 if(run&&moving&&P.st>0&&!P._tired){sp*=1.8;running=true;P.st-=(heavy?20:12)*dt}else P.st=Math.min(100,P.st+(moving?6:14)*dt*(starving?.4:1));
 if(P.st<=0)P._tired=true;if(P.st>25)P._tired=false;
 let vx=0,vz=0;if(moving){const l=Math.hypot(fw,sd),f=fw/l,s=sd/l;vx=(-Math.sin(yaw)*f+Math.cos(yaw)*s)*sp*dt;vz=(-Math.cos(yaw)*f-Math.sin(yaw)*s)*sp*dt}
 if(!hit(P.x+vx,P.z,.4))P.x+=vx;if(!hit(P.x,P.z+vz,.4))P.z+=vz;
 vy-=18*dt;P.y=(P.y===undefined?ELEV:P.y)+vy*dt;if(P.y<=ELEV){P.y=ELEV;vy=0;onGround=true}
 P.noise=Math.max(0,P.noise-30*dt);const nz=running?22:moving?7:0;P.noise=Math.max(P.noise,nz);if(running&&Math.random()<.04)noise(P.x,P.z,22);
 camera.position.set(P.x,P.y+(moving&&onGround?Math.sin(performance.now()*.01*(running?1.4:1))*.05:0),P.z);camera.rotation.set(pitch,yaw,0);
 flash.intensity=flashOn?2.2:0;vm.position.z+=(-.6-vm.position.z)*.2;vm.visible=P.w!=='fists';
 // sobrevivência
 P.hu=Math.max(0,P.hu-.035*dt*(running?2:1));P.th=Math.max(0,P.th-.06*dt*(running?2:1));
 if(P.hu<=0||P.th<=0)P.hp-=.8*dt;else if(P.hu>60&&P.th>60&&P.hp<100&&P.inf<1)P.hp=Math.min(100,P.hp+.1*dt);
 if(P.inf>0)P.inf=Math.min(100,P.inf+.04*dt);
 if(P.inf>=100){endGame(false);$('endT').textContent='VOCÊ FOI INFECTADO'}
 if(P.hp<=0)endGame(false)}
// ===== GAME LOOP =====
let last=performance.now(),spawnT=0;
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.05,(now-last)/1000);last=now;
 if(mode==='play'){P.time+=dt;atkCd-=dt;updPlayer(dt);updTime(dt);events(dt);
  if(reload>0){reload-=dt;if(reload<=0)finishReload()}
  if(searching){const o=target();if(o===searching.o){searching.t+=dt;$('prompt').textContent='PROCURANDO... '+Math.floor(searching.t/1.5*100)+'%';$('prompt').style.display='block';if(searching.t>=1.5){doLoot(searching.a);searching.o.material.color.setHex(0x333333);searching=null}}else searching=null}
  else{const o=target(),a=o&&o.userData.act;$('prompt').style.display=a?'block':'none';if(a)$('prompt').textContent=a.t==='loot'?(looted[a.id]?'Vazio':a.tab==='car'?'PRESSIONE E PARA PROCURAR NO CARRO':'PRESSIONE E PARA PROCURAR'):a.t==='stash'?'E — ABRIR BAÚ':a.t==='radio'?'E — OUVIR RÁDIO':'E — ESCAPAR (precisa de chave, bateria e combustível)'}
  const night=isNight(),cap=Math.min(70,30+P.day*4+(night?15:0));spawnT-=dt;
  if(spawnT<=0){spawnT=night?6:18;if(Z.length<cap){const a=rnd(0,6.28),[x,z]=freeSpot(P.x+Math.cos(a)*55,P.z+Math.sin(a)*55,4);spawnZ(Math.random()<.2+P.day*.03?'fast':Math.random()<.12?'strong':'normal',x,z)}}
  for(const q of Z){const d=Math.hypot(q.g.position.x-P.x,q.g.position.z-P.z);q.g.visible=d<110;if(d<130)updZ(q,dt);else if(q.s==='CHASE')q.s='IDLE'}
  if(msgT>0){msgT-=dt;if(msgT<=0)$('msg').textContent=''}hudT-=dt;if(hudT<=0){hudT=.15;updHud();minimap()}}
 renderer.render(scene,camera)}
// ===== INÍCIO =====
buildWorld();P=newP();renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();updTime(0);
if(!localStorage.getItem('deadcity'))$('bCont').style.opacity=.5;
requestAnimationFrame(loop);
