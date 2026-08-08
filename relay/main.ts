// clim cloud relay + web client — zero-knowledge WS fan-out
const rooms = new Map<string, Set<WebSocket>>();

function join(sid: string, ws: WebSocket) {
  if (!rooms.has(sid)) rooms.set(sid, new Set());
  rooms.get(sid)!.add(ws);
}
function leave(sid: string, ws: WebSocket) {
  const r = rooms.get(sid); if (!r) return;
  r.delete(ws); if (r.size === 0) rooms.delete(sid);
}
function forward(sid: string, from: WebSocket, data: string) {
  const r = rooms.get(sid); if (!r) return;
  for (const peer of r) {
    if (peer !== from && peer.readyState === 1) {
      try { peer.send(data); } catch {}
    }
  }
}

const HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<meta name="theme-color" content="#0a0a0a" />
<title>clim — cloud web</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/tweetnacl@1.0.3/nacl.min.js" integrity="sha384-LMUiUHpaYNGZFzWFRjsADnCSqae1Mk5llcUOHOLDhCxkyF2cdsWAueTZAzV+swW/" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/tweetnacl-util@0.15.1/nacl-util.min.js" integrity="sha384-qpU3wxGxaAPcz02pOLeZTv5B0rNzsh3CETsUqdHxRBP70bO0kHoBopr+f9AcGj04" crossorigin="anonymous"></script>
<style>
:root {
  --bg:#0a0a0a; --panel:#131315; --border:#26262c; --border-2:#2b2b30;
  --text:#f0eee6; --muted:#7a776e; --dim:#4a4842;
  --claude:#d97757; --green:#6be675; --danger:#e56b6b;
  --mono:'JetBrains Mono',ui-monospace,Menlo,monospace;
}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
body{background:var(--bg);color:var(--text);font-family:var(--mono);font-size:13px;line-height:1.55;min-height:100vh}
header{padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--bg);z-index:10}
.brand{color:var(--text);font-weight:700;font-size:14px}
.brand span{color:var(--claude)}
.status{font-size:11px;color:var(--muted)}
.status.ok{color:var(--green)}
.status.err{color:var(--danger)}
main{padding:16px;max-width:800px;margin:0 auto}
.card{background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:12px;cursor:pointer}
.card.opt{border-color:var(--claude)}
.card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.title{font-weight:700}
.pill{font-size:10px;padding:2px 7px;border-radius:999px;border:1px solid var(--claude);color:var(--claude);text-transform:lowercase}
.lines{color:#c8c8c8;font-size:12px;white-space:pre-wrap;word-break:break-word}
.lines>div{padding:2px 0}
.marker{color:var(--claude);margin-right:6px}
.setup{padding:18px;background:var(--panel);border:1px solid var(--border);border-radius:8px}
.setup h3{margin-bottom:8px}
.setup p{color:var(--muted);font-size:12px;margin-bottom:14px}
.setup label{color:var(--muted);font-size:11px;display:block;margin-bottom:6px}
.setup textarea{width:100%;min-height:120px;padding:10px;background:var(--bg);color:var(--text);border:1px solid var(--border-2);border-radius:6px;font-family:var(--mono);font-size:12px}
button{font-family:var(--mono);font-size:13px;padding:10px 14px;border:1px solid var(--border-2);background:transparent;color:var(--text);border-radius:6px;cursor:pointer}
button.primary{background:var(--claude);color:#1a0800;border-color:var(--claude);font-weight:700}
button.small{padding:6px 10px;font-size:11px}
.detail{position:fixed;inset:0;background:var(--bg);display:flex;flex-direction:column;z-index:20}
.detail-head{padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;background:#0e0e10}
.detail-body{flex:1;overflow-y:auto;padding:14px;background:#111}
.msg{margin-bottom:14px;display:flex;gap:10px;align-items:flex-start}
.msg .ic{width:14px;font-size:14px;color:var(--claude);flex-shrink:0}
.msg .txt{white-space:pre-wrap;word-break:break-word;color:#d6d6d6;font-size:12.5px;line-height:1.7;flex:1}
.composer{padding:10px;border-top:1px solid var(--border);background:#0e0e10;display:flex;gap:8px}
.composer input{flex:1;padding:10px;background:var(--bg);border:1px solid var(--border-2);border-radius:6px;color:var(--text);font-family:var(--mono);font-size:13px}
.opts-row{padding:10px;display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--border);background:#0e0e10}
.tap-row{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border-2);border-radius:8px;cursor:pointer;color:var(--text);text-align:left;background:transparent;font-family:var(--mono);font-size:13px}
.tap-row.ok{border-color:var(--green);color:var(--green)}
.tap-row.danger{border-color:var(--danger);color:var(--danger)}
.tap-row .k{color:var(--claude);font-weight:700;min-width:24px}
.empty{padding:40px 20px;text-align:center;color:var(--muted)}
.empty b{color:var(--text);display:block;margin-bottom:6px}
code{background:rgba(217,119,87,.12);padding:1px 5px;border-radius:3px;color:var(--claude);font-size:11px}
::selection{background:var(--claude);color:#1a0800}
</style>
</head><body>
<header>
  <div class="brand">✻ cli<span>m</span></div>
  <div class="status" id="status">disconnected</div>
</header>
<main id="main"></main>
<script>
const state={cloud:null,key:null,session:null,sessions:{},active:null,ws:null,connected:false};
const $=id=>document.getElementById(id);
const KEY='clim.cloud.v1';
try{const s=localStorage.getItem(KEY);if(s){Object.assign(state,JSON.parse(s))}}catch{}

function save(){localStorage.setItem(KEY,JSON.stringify({cloud:state.cloud,key:state.key,session:state.session}))}
function setStatus(t,cls){const el=$('status');el.textContent=t;el.className='status '+(cls||'')}
function esc(s){return (s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function b64d(s){return nacl.util.decodeBase64(s)}
function b64e(a){return nacl.util.encodeBase64(a)}
function decrypt(k,c){try{const key=b64d(k);const b=b64d(c);const n=b.slice(0,nacl.secretbox.nonceLength);const box=b.slice(nacl.secretbox.nonceLength);const p=nacl.secretbox.open(box,n,key);return p?nacl.util.encodeUTF8(p):null}catch{return null}}
function encrypt(k,p){try{const key=b64d(k);const n=nacl.randomBytes(nacl.secretbox.nonceLength);const m=nacl.util.decodeUTF8(p);const box=nacl.secretbox(m,n,key);const out=new Uint8Array(n.length+box.length);out.set(n);out.set(box,n.length);return b64e(out)}catch{return null}}

function stripAnsi(s){return s.replace(new RegExp("\\x1b\\][^\\x07\\x1b]*(?:\\x07|\\x1b\\\\)","g"),"").replace(new RegExp("\\x1b\\[[0-9;?]*[a-zA-Z]","g"),"")}

function connectCloud(){
  if(!state.cloud||!state.key||!state.session){render();return}
  setStatus('connecting…');
  const wss=state.cloud.replace(/^http/,'ws');
  const url=wss+'/relay?session='+encodeURIComponent(state.session)+'&role=phone';
  const ws=new WebSocket(url);state.ws=ws;
  ws.onopen=()=>{state.connected=true;setStatus('live','ok');render()};
  ws.onclose=()=>{state.connected=false;setStatus('offline','err');setTimeout(connectCloud,2000);render()};
  ws.onerror=()=>setStatus('ws error','err');
  ws.onmessage=(ev)=>{
    try{
      const wrap=JSON.parse(ev.data);
      if(wrap.type==='peer')return;
      if(!wrap.c)return;
      const plain=decrypt(state.key,wrap.c);if(!plain)return;
      const msg=JSON.parse(plain);
      const sid=state.session;
      const cur=state.sessions[sid]||{id:sid,project:'cloud',lines:[],ts:Date.now()};
      if(msg.type==='meta'){cur.project=msg.project||cur.project;cur.cwd=msg.cwd;cur.tool=msg.tool}
      else if(msg.type==='output'&&msg.text){
        const stripped=stripAnsi(msg.text);
        cur.lines=[...(cur.lines||[]),...stripped.split('\\n')].filter(Boolean).slice(-200);
        cur.ts=Date.now();
        cur.options=parseOptions(cur.lines.slice(-8).join('\\n'));
      }
      state.sessions[sid]=cur;
      render();
    }catch{}
  };
}

function parseOptions(text){
  const nonEmpty=text.split('\\n').filter(l=>l.trim());
  const last=nonEmpty[nonEmpty.length-1]||'';
  if(/\\b(y\\/n|yes\\/no)\\b/i.test(last))return{type:'yesno'};
  if(/\\?\\s*$/.test(last)&&/(approve|allow|permission|proceed|confirm|shall i|should i)/i.test(last))return{type:'approve'};
  const numbered=[];let expected=1;
  const tail=nonEmpty.slice(-6);
  for(const l of tail){const m=l.match(/^\\s*(\\d+)[.)]\\s+(.+?)\\s*$/);if(m){const k=parseInt(m[1],10);if(k===expected){numbered.push({key:m[1],label:m[2].slice(0,80)});expected++}else if(numbered.length>0)break}else if(numbered.length>0)break;if(numbered.length>=9)break}
  if(numbered.length<2)return null;
  if(/(select|choose|pick|which|option)[^\\n]{0,80}[?:]/i.test(text))return{type:'numbered',items:numbered};
  return null;
}

function send(text){
  if(!text||!text.trim())return;
  if(!state.ws||state.ws.readyState!==1||!state.key)return alert('not connected');
  const p=encrypt(state.key,JSON.stringify({type:'input',text:text.endsWith('\\n')?text:text+'\\n'}));
  if(!p)return alert('encrypt failed');
  state.ws.send(JSON.stringify({c:p}));
}

function unpair(){if(!confirm('unpair?'))return;localStorage.removeItem(KEY);Object.assign(state,{cloud:null,key:null,session:null,sessions:{},active:null});if(state.ws)state.ws.close();render()}

function renderSetup(){
  return \`
  <div class="setup">
    <h3>Pair with your Mac</h3>
    <p>On your Mac terminal, run <code>clim claude</code>. Copy the JSON printed after "Cloud QR" and paste it below.</p>
    <label>invite JSON</label>
    <textarea id="inv" placeholder='{"cloud":"wss://…","key":"…","session":"…"}' autocapitalize="none" autocorrect="off"></textarea>
    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="primary" onclick="doPair()">pair &amp; connect</button>
    </div>
    <div id="pmsg" style="margin-top:10px;color:var(--danger);font-size:11px"></div>
  </div>\`;
}
function renderList(){
  const list=Object.values(state.sessions).sort((a,b)=>(b.ts||0)-(a.ts||0));
  if(list.length===0)return '<div class="empty"><b>waiting for session…</b>run <code>clim claude</code> on your Mac</div>';
  return list.map(s=>{
    const lines=(s.lines||[]).slice(-2).map(l=>\`<div><span class="marker">›</span>\${esc(l)}</div>\`).join('');
    const pill=s.options?'<span class="pill">needs input</span>':'';
    return \`<div class="card \${s.options?'opt':''}" onclick="open_('\${esc(s.id)}')">
      <div class="card-head"><div class="title">\${esc(s.project)}</div>\${pill}</div>
      <div class="lines">\${lines||'<span class="marker">›</span><span style="color:var(--dim)">(no output)</span>'}</div>
    </div>\`;
  }).join('');
}
function renderDetail(sid){
  const s=state.sessions[sid];if(!s)return '';
  const msgs=(s.lines||[]).map(l=>\`<div class="msg"><span class="ic">✻</span><span class="txt">\${esc(l)}</span></div>\`).join('');
  let opts='';
  if(s.options){
    if(s.options.type==='yesno')opts=\`<div class="opts-row"><button class="tap-row ok" onclick="send('yes')"><span class="k">1</span><span>Yes</span></button><button class="tap-row danger" onclick="send('no')"><span class="k">2</span><span>No</span></button></div>\`;
    else if(s.options.type==='approve')opts=\`<div class="opts-row"><button class="tap-row ok" onclick="send('yes, approve')"><span class="k">1</span><span>Approve</span></button><button class="tap-row danger" onclick="send('no, deny')"><span class="k">2</span><span>Deny</span></button></div>\`;
    else if(s.options.type==='numbered')opts='<div class="opts-row">'+s.options.items.map(it=>\`<button class="tap-row" onclick="send('\${esc(it.key)}')"><span class="k">\${esc(it.key)}</span><span>\${esc(it.label)}</span></button>\`).join('')+'</div>';
  }
  return \`<div class="detail">
    <div class="detail-head">
      <button class="small" onclick="close_()">← back</button>
      <div style="flex:1;text-align:center;color:var(--muted)">\${esc(s.project||'')}</div>
      <button class="small" onclick="unpair()">unpair</button>
    </div>
    <div class="detail-body">\${msgs||'<div class="empty">no output yet</div>'}</div>
    \${opts}
    <div class="composer">
      <input id="composer-input" placeholder="type…" onkeydown="if(event.key==='Enter'){send(this.value);this.value=''}" />
      <button class="primary" onclick="var i=document.getElementById('composer-input');send(i.value);i.value=''">send</button>
    </div>
  </div>\`;
}
function render(){
  if(!state.cloud||!state.key||!state.session){$('main').innerHTML=renderSetup();return}
  $('main').innerHTML=renderList()+(state.active?renderDetail(state.active):'');
}
function open_(sid){state.active=sid;render()}
function close_(){state.active=null;render()}
function doPair(){
  const t=document.getElementById('inv').value.trim();
  try{
    let obj;
    if(t.startsWith('{'))obj=JSON.parse(t);
    else if(t.startsWith('clim://')){const u=new URL(t);obj=Object.fromEntries(u.searchParams.entries())}
    else throw new Error('paste JSON invite from clim claude output');
    const cloud=obj.cloud||obj.c||location.origin.replace(/^http/,'ws'), key=obj.key||obj.k, session=obj.session||obj.s;
    if(!cloud||!key||!session)throw new Error('missing fields');
    state.cloud=cloud;state.key=key;state.session=session;
    save();connectCloud();render();
  }catch(e){document.getElementById('pmsg').textContent='pair failed: '+(e.message||'invalid')}
}
window.doPair=doPair;window.send=send;window.open_=open_;window.close_=close_;window.unpair=unpair;

render();
if(state.cloud&&state.key&&state.session)connectCloud();
</script></body></html>`;

Deno.serve((req: Request) => {
  const url = new URL(req.url);
  if (url.pathname === '/health') return new Response('ok-v2-bcast');
  if (url.pathname === '/' || url.pathname === '/index.html') {
    return new Response(HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  if (url.pathname === '/status') {
    return new Response(`clim relay — zero-knowledge. rooms: ${rooms.size}`, {
      headers: { 'content-type': 'text/plain' },
    });
  }
  if (url.pathname === '/relay' && req.headers.get('upgrade') === 'websocket') {
    const sid = url.searchParams.get('session');
    const role = url.searchParams.get('role') || 'unknown';
    if (!sid || sid.length > 128) return new Response('bad session', { status: 400 });
    const { socket, response } = Deno.upgradeWebSocket(req);
    socket.onopen = () => {
      join(sid, socket);
      forward(sid, socket, JSON.stringify({ type: 'peer', role, at: Date.now() }));
    };
    socket.onmessage = (ev) => { if (typeof ev.data === 'string') forward(sid, socket, ev.data); };
    socket.onclose = () => leave(sid, socket);
    socket.onerror = () => leave(sid, socket);
    return response;
  }
  return new Response('not found', { status: 404 });
});
