const $=s=>document.querySelector(s),D={n:'север',s:'юг',e:'восток',w:'запад'};let ws,S,g,mode,stop=0;
const DEFAULT_SERVER='https://site-fo5n.onrender.com';
const L=JSON.parse(localStorage.getItem('rpg_prefs')||'{}');
$('#srv').value=L.srv||DEFAULT_SERVER;$('#nm').value=L.nm||'';$('#cl').value=L.cl||'war';
const tok=L.tok||crypto.randomUUID();
const norm=u=>{u=u.trim();if(!u)return'';if(/^https?:/.test(u))return u.replace(/^http/,'ws');return/^wss?:/.test(u)?u:'wss://'+u};
const prefs=()=>localStorage.setItem('rpg_prefs',JSON.stringify({srv:$('#srv').value.trim(),nm:$('#nm').value,cl:$('#cl').value,tok}));
const setStatus=(t,k)=>{const e=$('#status');e.textContent=t;e.className=k||'mu'};
function log(m,k=''){const p=document.createElement('p');p.className=k;p.textContent=m;const l=$('#log');l.append(p);while(l.children.length>300)l.firstChild.remove();l.scrollTop=1e9}
function handle(m){if(m.t==='log'){$('#login').style.display='none';$('#game').style.display='flex';log(m.m,m.k)}
 else if(m.t==='st'){S=m;if(mode==='online')setStatus('● Сервер онлайн · игроков: '+m.online,'good');draw()}}
const c=(k,a)=>mode==='local'?g.cmd(tok,k,a):ws&&ws.readyState===1&&ws.send(JSON.stringify({t:'cmd',c:k,a}));
function mapSvg(m){if(!m)return'';const N=Object.fromEntries(m.nodes.map(n=>[n.id,n])),xs=m.nodes.map(n=>n.x),ys=m.nodes.map(n=>n.y),
 x0=Math.min(...xs),y0=Math.min(...ys),w=Math.max(...xs)-x0+1,h=Math.max(...ys)-y0+1,C=80,P=n=>[(n.x-x0)*C+C/2,(n.y-y0)*C+C/2];
 let s=`<svg class="map" viewBox="0 0 ${w*C} ${h*C}">`;
 m.edges.forEach(([a,b])=>{const p=P(N[a]),q=P(N[b]);s+=`<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"/>`});
 m.nodes.forEach(n=>{const[x,y]=P(n);s+=`<g class="${n.id===m.cur?'cur':n.v?'vis':'fog'}"><circle cx="${x}" cy="${y}" r="14"/><text x="${x}" y="${n.v?y+30:y+4}">${n.v?n.n:'?'}</text></g>`});return s+'</svg>'}
// ---- одиночная игра: движок работает прямо в браузере, прогресс в localStorage
function startLocal(){stop=1;mode='local';prefs();let P={};try{P=JSON.parse(localStorage.getItem('rpg_save')||'{}')}catch{}
 g=Game(P);const save=()=>localStorage.setItem('rpg_save',JSON.stringify(P));setStatus('● Одиночная игра · автосохранение в браузере','good');
 g.join(tok,$('#nm').value,$('#cl').value,handle);setInterval(g.tick,2500);setInterval(save,5000);addEventListener('beforeunload',save)}
// ---- онлайн: подключение к серверу (ждёт, пока бесплатный хостинг проснётся)
function startOnline(){const u=norm($('#srv').value);if(!u)return $('#err').textContent='Укажи адрес сервера';
 stop=0;mode='online';prefs();let tries=0;
 const open=()=>{if(stop)return;$('#err').textContent=`Подключаюсь… (попытка ${++tries}, сервер может просыпаться до минуты)`;setStatus('○ Сервер: подключение…','warn');
  ws=new WebSocket(u);let ok=0;
  ws.onopen=()=>{ok=1;ws.send(JSON.stringify({t:'join',name:$('#nm').value||'Герой',cls:$('#cl').value,tok}))};
  ws.onmessage=e=>handle(JSON.parse(e.data));
  ws.onclose=()=>{if(stop)return;setStatus('● Сервер: переподключение…','bad');if(ok)log('Соединение потеряно, переподключаюсь…','bad');setTimeout(open,ok?2000:5000)}};open()}
// ---- проверка сервера на экране входа (заодно будит спящий хостинг)
function ping(){const u=norm($('#srv').value).replace(/^ws/,'http'),e=$('#ping');if(!u)return e.textContent='';
 e.className='mu';e.textContent='Сервер: проверяю…';const ac=new AbortController(),t=setTimeout(()=>ac.abort(),15000);
 fetch(u,{signal:ac.signal}).then(r=>{if(!r.ok)throw 0;e.textContent='● Сервер доступен';e.className='good'}).catch(()=>{e.textContent='○ Сервер не отвечает (возможно, просыпается). Можно играть одному.';e.className='warn'}).finally(()=>clearTimeout(t))}
const B=(t,f,x='')=>{const b=document.createElement('button');b.textContent=t;b.onclick=f;b.className=x;return b};
const bar=(v,m,col)=>`<div>${v}/${m}</div><div class="bar"><i style="width:${Math.max(0,v/m*100)}%;background:${col}"></i></div>`;
function draw(){const{p,loc,f,shop}=S,s=$('#side');s.innerHTML=`<b>${p.name}</b> — ${p.cls}, ур.${p.lv}<h3>Состояние</h3>HP ${bar(p.hp,p.mhp,'#d04a3a')}MP ${bar(p.mp,p.mmp,'#4a7ad0')}XP ${bar(p.xp,p.nx,'#3a9a4a')}<div>⚔ ${p.atk} 🛡 ${p.def} 💰 ${p.g} ☠ ${p.kills}</div><div class="mu">Оружие: ${p.w||'—'}<br>Броня: ${p.a||'—'}${p.q?`<br>Квест: ${p.kills-p.q.s}/${p.q.k}`:''}</div><h3>${loc.n}</h3>${mapSvg(S.map)}<div class="mu">${loc.d}</div>${loc.who.length?`<div>Рядом: ${loc.who.join(', ')}</div>`:''}`;
 const r=document.createElement('div');r.className='row';
 if(f){s.insertAdjacentHTML('beforeend',`<h3>Бой</h3><div class="bad">${f.n} ${bar(f.hp,f.mhp,'#d04a3a')}${f.st.join(' ')}</div>`);[['Атака','atk'],[p.sk,'skill'],['Бежать','flee']].forEach(([t,k])=>r.append(B(t,()=>c(k))))}
 else{loc.e.forEach(d=>r.append(B('→ '+D[d],()=>c('go',d))));if(!loc.safe)r.append(B('Искать',()=>c('explore')));else{r.append(B('Отдых (5)',()=>c('rest')),B('Задание',()=>c('quest')),B('Улучшить ⚔',()=>c('upg','w')),B('Улучшить 🛡',()=>c('upg','a')))}}
 s.append(r);const h=t=>s.insertAdjacentHTML('beforeend',`<h3>${t}</h3>`);h('Инвентарь');
 p.inv.forEach((n,i)=>{const d=document.createElement('div');d.className='it';d.innerHTML=`<span>${n}</span>`;const q=document.createElement('div');q.className='row';q.append(B('исп',()=>c('use',i)));if(loc.safe)q.append(B('прод',()=>c('sell',i)));d.append(q);s.append(d)});
 if(loc.shop){h('Лавка');shop.forEach(([k,n,pr])=>{const d=document.createElement('div');d.className='it';d.innerHTML=`<span>${n} · ${pr}</span>`;d.append(B('купить',()=>c('buy',k)));s.append(d)})}}
$('#solo').onclick=startLocal;$('#online').onclick=startOnline;$('#srv').onchange=ping;ping();
$('#menu').onclick=()=>{stop=1;if(mode==='local'){g.leave(tok,handle);localStorage.setItem('rpg_save',JSON.stringify(g.P))}else if(ws)ws.close();location.reload()};
const send=()=>{const v=$('#msg').value.trim();if(v)c('say',v);$('#msg').value=''};$('#snd').onclick=send;$('#msg').onkeydown=e=>e.key==='Enter'&&send();
