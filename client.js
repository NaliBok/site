const $=s=>document.querySelector(s),D={n:'север',s:'юг',e:'восток',w:'запад'};let ws,S,g,mode,stop=0;
const L=JSON.parse(localStorage.getItem('rpg_prefs')||'{}');
$('#srv').value=L.srv||'';$('#nm').value=L.nm||'';$('#cl').value=L.cl||'war';
const tok=L.tok||crypto.randomUUID();
const prefs=u=>localStorage.setItem('rpg_prefs',JSON.stringify({srv:u!==undefined?u:L.srv,nm:$('#nm').value,cl:$('#cl').value,tok}));
function log(m,k=''){const p=document.createElement('p');p.className=k;p.textContent=m;const l=$('#log');l.append(p);while(l.children.length>300)l.firstChild.remove();l.scrollTop=1e9}
function handle(m){if(m.t==='log'){$('#login').style.display='none';$('#game').style.display='flex';log(m.m,m.k)}else if(m.t==='st'){S=m;draw()}}
const c=(k,a)=>mode==='local'?g.cmd(tok,k,a):ws&&ws.readyState===1&&ws.send(JSON.stringify({t:'cmd',c:k,a}));
// ---- одиночная игра: движок работает прямо в браузере, прогресс в localStorage
function startLocal(){stop=1;mode='local';prefs();let P={};try{P=JSON.parse(localStorage.getItem('rpg_save')||'{}')}catch{}
 g=Game(P);const save=()=>localStorage.setItem('rpg_save',JSON.stringify(P));
 g.join(tok,$('#nm').value,$('#cl').value,handle);setInterval(g.tick,2500);setInterval(save,5000);addEventListener('beforeunload',save)}
// ---- онлайн: подключение к серверу (ждёт, пока бесплатный хостинг проснётся)
function startOnline(){let u=$('#srv').value.trim();if(!u)return $('#err').textContent='Укажи адрес сервера';
 if(!/^wss?:/.test(u))u='wss://'+u;stop=0;mode='online';prefs(u);let tries=0;
 const open=()=>{if(stop)return;$('#err').textContent=`Подключаюсь… (попытка ${++tries}, сервер может просыпаться до минуты)`;
  ws=new WebSocket(u);let ok=0;
  ws.onopen=()=>{ok=1;ws.send(JSON.stringify({t:'join',name:$('#nm').value||'Герой',cls:$('#cl').value,tok}))};
  ws.onmessage=e=>handle(JSON.parse(e.data));
  ws.onclose=()=>{if(stop)return;if(ok)log('Соединение потеряно, переподключаюсь…','bad');setTimeout(open,ok?2000:5000)}};open()}
const B=(t,f,x='')=>{const b=document.createElement('button');b.textContent=t;b.onclick=f;b.className=x;return b};
const bar=(v,m,col)=>`<div>${v}/${m}</div><div class="bar"><i style="width:${Math.max(0,v/m*100)}%;background:${col}"></i></div>`;
function draw(){const{p,loc,f,shop}=S,s=$('#side');s.innerHTML=`<b>${p.name}</b> — ${p.cls}, ур.${p.lv}<h3>Состояние</h3>HP ${bar(p.hp,p.mhp,'#d04a3a')}MP ${bar(p.mp,p.mmp,'#4a7ad0')}XP ${bar(p.xp,p.nx,'#3a9a4a')}<div>⚔ ${p.atk} 🛡 ${p.def} 💰 ${p.g} ☠ ${p.kills}</div><div class="mu">Оружие: ${p.w||'—'}<br>Броня: ${p.a||'—'}${p.q?`<br>Квест: ${p.kills-p.q.s}/${p.q.k}`:''}</div><h3>${loc.n}</h3><div class="mu">${loc.d}</div>${loc.who.length?`<div>Рядом: ${loc.who.join(', ')}</div>`:''}`;
 const r=document.createElement('div');r.className='row';
 if(f){s.insertAdjacentHTML('beforeend',`<h3>Бой</h3><div class="bad">${f.n} ${bar(f.hp,f.mhp,'#d04a3a')}${f.st.join(' ')}</div>`);[['Атака','atk'],[p.sk,'skill'],['Бежать','flee']].forEach(([t,k])=>r.append(B(t,()=>c(k))))}
 else{loc.e.forEach(d=>r.append(B('→ '+D[d],()=>c('go',d))));if(!loc.safe)r.append(B('Искать',()=>c('explore')));else{r.append(B('Отдых (5)',()=>c('rest')),B('Задание',()=>c('quest')),B('Улучшить ⚔',()=>c('upg','w')),B('Улучшить 🛡',()=>c('upg','a')))}}
 s.append(r);const h=t=>s.insertAdjacentHTML('beforeend',`<h3>${t}</h3>`);h('Инвентарь');
 p.inv.forEach((n,i)=>{const d=document.createElement('div');d.className='it';d.innerHTML=`<span>${n}</span>`;const q=document.createElement('div');q.className='row';q.append(B('исп',()=>c('use',i)));if(loc.safe)q.append(B('прод',()=>c('sell',i)));d.append(q);s.append(d)});
 if(loc.shop){h('Лавка');shop.forEach(([k,n,pr])=>{const d=document.createElement('div');d.className='it';d.innerHTML=`<span>${n} · ${pr}</span>`;d.append(B('купить',()=>c('buy',k)));s.append(d)})}}
$('#solo').onclick=startLocal;$('#online').onclick=startOnline;
const send=()=>{const v=$('#msg').value.trim();if(v)c('say',v);$('#msg').value=''};$('#snd').onclick=send;$('#msg').onkeydown=e=>e.key==='Enter'&&send();
