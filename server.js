const http=require('http'),fs=require('fs'),{WebSocketServer}=require('ws'),Game=require('./game.js');
const SAVE='players.json';let P={};try{P=JSON.parse(fs.readFileSync(SAVE))}catch{}
const g=Game(P);setInterval(g.tick,2500);setInterval(()=>fs.writeFile(SAVE,JSON.stringify(P),()=>{}),30000);
const srv=http.createServer((q,r)=>{r.writeHead(200,{'Access-Control-Allow-Origin':'*'});r.end('ok')});
new WebSocketServer({server:srv}).on('connection',ws=>{let tok=null;
 const out=o=>ws.readyState===1&&ws.send(JSON.stringify(o));
 ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}
  if(m.t==='join'){const t=String(m.tok||'').slice(0,40);if(t&&g.join(t,m.name,m.cls,out))tok=t}else if(tok)g.cmd(tok,m.c,m.a)});
 ws.on('close',()=>tok&&g.leave(tok,out))});
srv.listen(process.env.PORT||3000,()=>console.log('server up'));
