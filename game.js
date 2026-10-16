// Игровой движок: работает и в браузере (одиночная игра), и в Node (сервер)
(function(root){
const CL={war:{n:'Воин',hp:120,mp:20,atk:8,def:4,sk:'Удар щитом',cost:8},mag:{n:'Маг',hp:80,mp:60,atk:5,def:1,sk:'Огненный шар',cost:12},rog:{n:'Вор',hp:95,mp:35,atk:7,def:2,sk:'Ядовитый клинок',cost:10}};
const IT={sword:{n:'Меч',t:'w',v:6,p:40},axe:{n:'Топор',t:'w',v:9,p:90},staff:{n:'Посох',t:'w',v:8,p:80},dagger:{n:'Кинжал',t:'w',v:7,p:60},blade:{n:'Клинок мрака',t:'w',v:16,p:300},
 leather:{n:'Кожанка',t:'a',v:3,p:40},mail:{n:'Кольчуга',t:'a',v:6,p:110},plate:{n:'Латы',t:'a',v:10,p:280},
 potion:{n:'Зелье лечения',t:'p',v:50,p:25},mana:{n:'Зелье маны',t:'m',v:30,p:25},fang:{n:'Клык',t:'x',p:8},herb:{n:'Трава',t:'x',p:5},ore:{n:'Руда',t:'x',p:12}};
const LOC={town:{x:1,y:2,s:'Город',n:'Город',d:'Тёплые огни таверны. Здесь безопасно.',e:{n:'forest',e:'swamp',s:'mountain'},safe:1},
 forest:{x:1,y:1,s:'Лес',n:'Тёмный лес',d:'Шелест листьев и чьи-то глаза в кустах.',e:{s:'town',n:'cave',e:'ruins'},lv:1},
 swamp:{x:2,y:2,s:'Болото',n:'Гнилое болото',d:'Пузыри газа, вонь и туман.',e:{w:'town',n:'ruins'},lv:3},
 mountain:{x:1,y:3,s:'Перевал',n:'Горный перевал',d:'Холодный ветер и острые камни.',e:{n:'town'},lv:3},
 cave:{x:1,y:0,s:'Пещера',n:'Пещера слизней',d:'Капает вода. Эхо шагов.',e:{s:'forest',e:'dungeon'},lv:5},
 ruins:{x:2,y:1,s:'Руины',n:'Древние руины',d:'Колонны, поросшие мхом.',e:{s:'swamp',w:'forest',n:'dungeon'},lv:6},
 dungeon:{x:2,y:0,s:'Подземелье',n:'Подземелье Тьмы',d:'Здесь пахнет смертью.',e:{w:'cave',s:'ruins'},lv:9}};
const MON={1:[['Волк',30,6,12,6,'fang'],['Гоблин',36,7,15,9,'herb']],3:[['Болотная тварь',70,11,35,20,'herb'],['Горный тролль',90,13,45,26,'ore']],
 5:[['Слизень',120,15,60,30,'ore'],['Летучая тварь',100,18,65,32,'fang']],6:[['Каменный голем',170,20,95,50,'ore'],['Призрак',140,22,100,55,'herb']],9:[['Тёмный рыцарь',280,30,200,110,'ore'],['Демон',350,36,300,160,'fang']]};
const QUESTS=[{k:5,g:60,xp:50},{k:8,g:120,xp:120},{k:12,g:250,xp:250}];
function Game(P){
const F={},on={};
const send=(p,o)=>{const w=on[p.tok];w&&w(o)};
const log=(p,m,k)=>send(p,{t:'log',m,k});
const room=l=>Object.values(P).filter(p=>p.loc===l&&on[p.tok]);
const say=(l,m,k)=>room(l).forEach(p=>log(p,m,k));
const mhp=p=>CL[p.cls].hp+(p.lv-1)*14, mmp=p=>CL[p.cls].mp+(p.lv-1)*6;
const bon=i=>i?IT[i.id].v+i.b:0;
const atk=p=>CL[p.cls].atk+p.lv*2+bon(p.w), def=p=>CL[p.cls].def+p.lv+bon(p.a);
const nm=i=>IT[i.id].n+(i.b?` +${i.b}`:'');
const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
function see(p){if(!p.seen)p.seen=[];if(!p.seen.includes(p.loc))p.seen.push(p.loc)}
function mapOf(p){const ids=new Set(p.seen),edges=[];p.seen.forEach(i=>Object.values(LOC[i].e).forEach(j=>{ids.add(j);edges.push([i,j])}));
 return{cur:p.loc,nodes:[...ids].map(i=>({id:i,x:LOC[i].x,y:LOC[i].y,n:LOC[i].s,v:p.seen.includes(i)})),edges}}
function view(p){see(p);const l=LOC[p.loc],f=F[p.loc];
 send(p,{t:'st',online:Object.keys(on).length,map:mapOf(p),p:{name:p.name,cls:CL[p.cls].n,sk:CL[p.cls].sk,lv:p.lv,xp:p.xp,nx:p.lv*60,hp:p.hp,mhp:mhp(p),mp:p.mp,mmp:mmp(p),g:p.g,atk:atk(p),def:def(p),w:p.w&&nm(p.w),a:p.a&&nm(p.a),inv:p.inv.map(nm),q:p.q,kills:p.kills},
 loc:{n:l.n,d:l.d,e:Object.keys(l.e),safe:!!l.safe,shop:!!l.safe,who:room(p.loc).filter(x=>x!==p).map(x=>`${x.name} (ур.${x.lv})`)},
 f:f&&{n:f.m[0],hp:f.hp,mhp:f.m[1],st:Object.keys(f.st)},shop:Object.entries(IT).filter(([k,v])=>v.t!=='x').map(([k,v])=>[k,v.n,v.p])})}
const viewRoom=l=>room(l).forEach(view);
function loot(p,id){const b=Math.random()<.15?rnd(1,3):0;p.inv.push({id,b:IT[id].t==='w'||IT[id].t==='a'?b:0});}
function gainXp(p,x){p.xp+=x;while(p.xp>=p.lv*60){p.xp-=p.lv*60;p.lv++;p.hp=mhp(p);p.mp=mmp(p);log(p,`★ УРОВЕНЬ ${p.lv}! Силы восстановлены.`,'good')}}
function kill(p,f){const m=f.m;delete F[p.loc];
 const rs=room(p.loc).filter(x=>x.fight);
 rs.forEach(x=>{x.fight=0;const g=Math.floor(m[4]*rnd(8,12)/10);x.g+=g;x.kills++;gainXp(x,m[3]);log(x,`${m[0]} повержен! +${m[3]} опыта, +${g} золота.`,'good');
  if(Math.random()<.6)loot(x,m[5]);if(Math.random()<.12){const w=['sword','axe','staff','dagger','leather','mail','plate','blade'][rnd(0,7)];if(LOC[x.loc].lv>=3||IT[w].p<150)loot(x,w);log(x,'Из туши выпало снаряжение!','good')}
  if(x.q&&x.kills-x.q.s>=x.q.k){const q=x.q;x.g+=q.g;gainXp(x,q.xp);x.q=null;log(x,`✔ Квест выполнен! +${q.g} золота.`,'good')}});}
function die(p){say(p.loc,`${p.name} пал в бою...`,'bad');p.fight=0;p.loc='town';p.hp=mhp(p);p.mp=mmp(p);p.g=Math.floor(p.g*.9);log(p,'Ты очнулся в городе. Потеряно 10% золота.','bad')}
function hurt(m,p){if(Math.random()<def(p)/(def(p)+40)){say(p.loc,`${p.name} уклонился от удара!`);return}
 const d=Math.max(1,rnd(m[2]-3,m[2]+3)-Math.floor(def(p)/2));p.hp-=d;say(p.loc,`${m[0]} бьёт ${p.name}: -${d} HP`,'bad');if(p.hp<=0)die(p)}
function strike(p,f,d,tag){f.hp-=d;say(p.loc,`${p.name} ${tag}: ${d} урона`,'hit');if(f.hp<=0){say(p.loc,`${f.m[0]} падает!`,'good');kill(p,f)}}
const cmds={
 go(p,a){if(p.fight)return log(p,'Нельзя уйти посреди боя!','bad');const to=LOC[p.loc].e[a];if(!to)return;
  const l=LOC[to];if(l.lv&&p.lv<l.lv-2)log(p,`Опасно! Рекомендуемый уровень: ${l.lv}`,'warn');
  say(p.loc,`${p.name} ушёл.`);p.loc=to;say(to,`${p.name} пришёл.`);const old=room(to);viewRoom(to);},
 explore(p){if(LOC[p.loc].safe)return log(p,'В городе искать нечего. Загляни на доску заданий.');if(F[p.loc])return log(p,'Тут уже враг!','bad');
  const r=Math.random();if(r<.65){const L=LOC[p.loc].lv,pool=MON[L],m=pool[rnd(0,pool.length-1)];const sc=1+(room(p.loc).length-1)*.4;
   F[p.loc]={m:[m[0],Math.floor(m[1]*sc),Math.floor(m[2]*(1+(sc-1)/2)),m[3],m[4],m[5]],hp:Math.floor(m[1]*sc),st:{},t:0};room(p.loc).forEach(x=>x.fight=1);say(p.loc,`⚔ Появился ${m[0]}!`,'warn')}
  else if(r<.85){const g=rnd(5,25)*LOC[p.loc].lv;p.g+=g;log(p,`Ты нашёл сундук: +${g} золота.`,'good')}
  else if(r<.95){loot(p,['herb','ore','potion','mana'][rnd(0,3)]);log(p,'Ты нашёл предмет на земле.','good')}
  else{const d=rnd(5,15);p.hp=Math.max(1,p.hp-d);log(p,`Ловушка! -${d} HP`,'bad')}},
 atk(p){const f=F[p.loc];if(!f)return;if(p.cd>Date.now())return;p.cd=Date.now()+1200;p.fight=1;
  let d=rnd(atk(p)-2,atk(p)+3),c=Math.random()<(p.cls==='rog'?.3:.12);if(c)d*=2;strike(p,f,d,c?'КРИТ':'бьёт');viewRoom(p.loc)},
 skill(p){const f=F[p.loc],C=CL[p.cls];if(!f||p.cd>Date.now())return;if(p.mp<C.cost)return log(p,'Не хватает маны!','warn');p.mp-=C.cost;p.cd=Date.now()+1200;p.fight=1;
  if(p.cls==='war'){strike(p,f,Math.floor(atk(p)*1.6),'бьёт щитом');f.st.stun=2}
  else if(p.cls==='mag'){strike(p,f,Math.floor(atk(p)*2.2)+rnd(0,6),'метает огонь');f.st.burn=4}
  else{strike(p,f,Math.floor(atk(p)*1.3),'колет ядом');f.st.poison=5}viewRoom(p.loc)},
 flee(p){const f=F[p.loc];if(!f)return;if(Math.random()<.5){p.fight=0;const t=Object.values(LOC[p.loc].e)[0];say(p.loc,`${p.name} сбежал!`);p.loc=t;viewRoom(t);view(p)}else{log(p,'Не удалось сбежать!','bad');hurt(f.m,p);view(p)}},
 use(p,a){const i=p.inv[a];if(!i)return;const t=IT[i.id];
  if(t.t==='p'){p.hp=Math.min(mhp(p),p.hp+t.v);log(p,`+${t.v} HP`,'good')}else if(t.t==='m'){p.mp=Math.min(mmp(p),p.mp+t.v);log(p,`+${t.v} MP`,'good')}
  else if(t.t==='w'||t.t==='a'){const o=p[t.t];p[t.t]=i;p.inv.splice(a,1);if(o)p.inv.push(o);log(p,`Экипировано: ${nm(i)}`)}else return log(p,'Это материал для улучшения.');
  if(t.t==='p'||t.t==='m')p.inv.splice(a,1);view(p)},
 sell(p,a){const i=p.inv[a];if(!i||!LOC[p.loc].safe)return;const g=Math.floor(IT[i.id].p/2)+i.b*15;p.g+=g;p.inv.splice(a,1);log(p,`Продано за ${g}.`);view(p)},
 buy(p,a){const t=IT[a];if(!t||!LOC[p.loc].safe||t.t==='x')return;if(p.g<t.p)return log(p,'Мало золота.','bad');p.g-=t.p;p.inv.push({id:a,b:0});log(p,`Куплено: ${t.n}`,'good');view(p)},
 upg(p,a){const i=a==='w'?p.w:p.a;if(!i||!LOC[p.loc].safe)return log(p,'Нужна экипировка и кузница (город).');const need=(i.b+1)*3,o=p.inv.filter(x=>x.id==='ore');
  if(o.length<2||p.g<need*20)return log(p,`Нужно 2 руды и ${need*20} золота. Шанс успеха падает с уровнем.`,'warn');
  p.g-=need*20;for(let k=0;k<2;k++)p.inv.splice(p.inv.findIndex(x=>x.id==='ore'),1);
  if(Math.random()<Math.max(.35,.9-i.b*.15)){i.b++;log(p,`Улучшено: ${nm(i)}!`,'good')}else log(p,'Улучшение не удалось. Материалы потеряны.','bad');view(p)},
 rest(p){if(!LOC[p.loc].safe)return log(p,'Отдыхать можно только в городе.');if(p.g<5)return log(p,'Таверна стоит 5 золота.');p.g-=5;p.hp=mhp(p);p.mp=mmp(p);log(p,'Ты выспался. HP и MP восстановлены.','good');view(p)},
 quest(p){if(!LOC[p.loc].safe)return;if(p.q)return log(p,`Задание: убей ${p.q.k} врагов (${p.kills-p.q.s}/${p.q.k}).`);const q={...QUESTS[Math.min(2,Math.floor(p.lv/4))],s:p.kills};p.q=q;log(p,`Новое задание: убей ${q.k} врагов. Награда: ${q.g} золота.`,'warn');view(p)},
 say(p,a){a=String(a||'').slice(0,200);Object.values(P).filter(x=>on[x.tok]).forEach(x=>log(x,`[${p.name}] ${a}`,'chat'))}};
const tick=()=>{for(const l in F){const f=F[l],ps=room(l).filter(x=>x.fight);if(!ps.length){delete F[l];continue}
 for(const s in f.st){if(s==='burn'||s==='poison'){const d=s==='burn'?8:5;f.hp-=d;say(l,`${f.m[0]} страдает (${s==='burn'?'огонь':'яд'}): -${d}`,'hit')}if(--f.st[s]<=0)delete f.st[s]}
 if(f.hp<=0){kill(ps[0],f);viewRoom(l);continue}
 if(f.st.stun)say(l,`${f.m[0]} оглушён!`);else hurt(f.m,ps[rnd(0,ps.length-1)]);viewRoom(l)}
 Object.values(P).forEach(p=>{if(on[p.tok]&&!p.fight&&p.mp<mmp(p)){p.mp++;if(p.hp<mhp(p)&&p.hp>0)p.hp++}})};
function join(tok,name,cls,out){tok=String(tok||'').slice(0,40);if(!tok)return null;
 if(!P[tok]){const c=CL[cls]?cls:'war';name=String(name||'Герой').replace(/[<>]/g,'').slice(0,16)||'Герой';
  P[tok]={tok,name,cls:c,lv:1,xp:0,g:30,kills:0,loc:'town',inv:[{id:'potion',b:0},{id:'potion',b:0}],w:null,a:null,q:null,hp:CL[c].hp,mp:CL[c].mp}}
 const p=P[tok];on[tok]=out;p.fight=0;if(!p.hp)p.hp=1;
 log(p,`Добро пожаловать, ${p.name}! Игроков онлайн: ${Object.keys(on).length}`,'warn');say(p.loc,`${p.name} вошёл в мир.`);viewRoom(p.loc);return p}
function cmd(tok,c,a){const p=P[tok];if(!p||!on[tok]||!cmds[c]||p.hp<=0)return;
 try{cmds[c](p,a);if(!['go','atk','skill','flee'].includes(c))viewRoom(p.loc)}catch(e){console.error(e)}}
function leave(tok,out){const p=P[tok];if(!p||on[tok]!==out)return;delete on[tok];say(p.loc,`${p.name} вышел.`);p.fight=0;viewRoom(p.loc)}
return {join,cmd,leave,tick,P}}
if(typeof module!=='undefined')module.exports=Game;else root.Game=Game;
})(typeof self!=='undefined'?self:globalThis);
