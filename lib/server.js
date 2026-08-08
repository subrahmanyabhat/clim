const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { WebSocketServer } = require('ws');
const { Bonjour } = require('bonjour-service');
const { ansiToText } = require('./ansi');
const { messageFrom, conversationFrom } = require('./transcript');
const { parseOptions } = require('./options');

const crypto = require('crypto');
const PORT = process.env.PORT || 8787;
const SECRET = process.env.SECRET || crypto.randomBytes(24).toString('hex');
// 8 characters drawn uniformly from a 32-symbol alphabet: exactly 40 bits.
//
// This used to be base64 of 6 random bytes, stripped of +/= and uppercased.
// Two things were wrong with that. Stripping ran before the slice, so roughly
// one PIN in four was shorter than 8 characters and a 4-character PIN was
// reachable. And uppercasing folds base64's lower case onto its upper case,
// leaving 36 skewed symbols worth 5.12 bits each rather than the 48 bits the
// old comment claimed. Measured, not guessed.
//
// I, O, 0 and 1 are left out because this gets read off one screen and typed
// into another.
const PIN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PAIR_PIN = Array.from(
  { length: 8 },
  () => PIN_ALPHABET[crypto.randomInt(PIN_ALPHABET.length)],
).join('');
let pairWindowUntil = Date.now() + 1000 * 60 * 10; // 10 min after boot
const STALE_MS = 1000 * 60 * 30;
// A wrapper that loses its socket reconnects every 2s. Wait past a couple of
// those before calling the session dead, so a WiFi hiccup is not a "closed".
const DISCONNECT_GRACE_MS = 8000;
const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const SCAN_INTERVAL_MS = 5000;
const ACTIVE_WINDOW_MS = 1000 * 60 * 60;

// pair-attempt rate limiting
const pairAttempts = new Map(); // ip -> {count, resetAt}
const PAIR_MAX_ATTEMPTS = 5;
const PAIR_LOCKOUT_MS = 60_000;
let pairFailCount = 0;

const sessions = new Map();
const clients = new Set();
const ptySockets = new Map();
const ptyBuffers = new Map();
const ptyWatchers = new Map();
const ptyMessages = new Map(); // sessionId -> [{role,text,ts}] — real conversation, not PTY frames
const PTY_BUFFER_MAX = 20000;
const PTY_MESSAGES_MAX = 200;

// A transcript is a .jsonl file inside Claude's own projects directory. Anything
// else named as one is a bug at best.
function isTranscriptPath(p) {
  try {
    const full = path.resolve(String(p));
    return full.startsWith(PROJECTS_DIR + path.sep) && full.endsWith('.jsonl');
  } catch { return false; }
}

function timingSafeStrEq(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) { crypto.timingSafeEqual(ba, ba); return false; }
  return crypto.timingSafeEqual(ba, bb);
}

function escapeAppleScript(s) {
  // Escape backslash, quote, and neutralize newlines (prevents multi-line injection)
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, ' ');
}

function sendToTerminal(app, tty, text, tmuxTarget) {
  if (tmuxTarget) {
    try {
      execFileSync('tmux', ['send-keys', '-t', tmuxTarget, '-l', text], { timeout: 2000 });
      execFileSync('tmux', ['send-keys', '-t', tmuxTarget, 'Enter'], { timeout: 2000 });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'tmux send-keys failed: ' + (e.message || 'unknown') };
    }
  }
  const ttyShort = String(tty || '').replace(/^\/dev\//, '');
  const t = escapeAppleScript(text);
  let script;
  if (/iterm/i.test(app)) {
    script = `
      tell application "iTerm"
        repeat with w in windows
          repeat with tb in tabs of w
            repeat with s in sessions of tb
              try
                if tty of s ends with "${ttyShort}" then
                  tell s to write text "${t}"
                  return "ok"
                end if
              end try
            end repeat
          end repeat
        end repeat
        return "notfound"
      end tell`;
  } else {
    // Terminal.app 'do script' runs the payload as a shell command — RCE risk.
    // Only iTerm ('write text' types-not-executes) and tmux are supported.
    return { ok: false, error: `unsupported terminal app: ${app}. Use iTerm, tmux, or the clim PTY wrapper.` };
  }
  try {
    const out = execFileSync('osascript', ['-e', script], { encoding: 'utf-8', timeout: 3000 }).trim();
    if (out === 'ok') return { ok: true };
    return { ok: false, error: `tty ${ttyShort} not found in ${app} windows` };
  } catch (e) {
    return { ok: false, error: e.stderr?.toString() || e.message };
  }
}

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

function decodeProject(dirName) {
  const rest = dirName.startsWith('-') ? dirName.slice(1) : dirName;
  return '/' + rest.replace(/-/g, '/');
}

function extractText(entry) {
  const m = messageFrom(entry);
  return m ? m.text : '';
}

// Newest-first scan, oldest-first result. Only entries `messageFrom` accepts as
// real conversation survive — tool calls, hook output and system reminders never
// reach the phone as messages.
function readTranscriptTail(filePath, maxEntries) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
    const entries = [];
    for (let i = raw.length - 1; i >= 0 && entries.length < maxEntries; i--) {
      try {
        const e = JSON.parse(raw[i]);
        if (conversationFrom(e).length) entries.unshift(e);
      } catch {}
    }
    return entries;
  } catch {
    return [];
  }
}

function summarizeFromTranscript(filePath) {
  const entries = readTranscriptTail(filePath, 200);
  let lastAssistantText = '';
  let lastCwd = '';
  let sessionId = '';
  let firstUserText = '';
  for (const e of entries) {
    if (!sessionId && e.sessionId) sessionId = e.sessionId;
    if (!lastCwd && e.cwd) lastCwd = e.cwd;
    if (!firstUserText && e.type === 'user') {
      const t = extractText(e);
      if (t && !t.startsWith('<') && !t.startsWith('[{')) firstUserText = t;
    }
  }
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.type === 'assistant') {
      const t = extractText(e);
      if (t) { lastAssistantText = t; break; }
    }
  }
  const lines = lastAssistantText.trim().split('\n').filter(Boolean).slice(-6);
  const title = firstUserText.trim().split('\n')[0].slice(0, 80) || null;
  return { sessionId, cwd: lastCwd, lines, options: parseOptions(lastAssistantText), title };
}

function psField(fmt, pid) {
  try { return execFileSync('ps', ['-o', fmt + '=', '-p', String(pid)], { encoding: 'utf-8', timeout: 800 }).trim(); }
  catch { return ''; }
}

function detectTerminalFromPid(startPid) {
  let cur = startPid;
  const chain = [];
  for (let i = 0; i < 15; i++) {
    const ppid = psField('ppid', cur);
    if (!ppid || ppid === '1' || ppid === '0') break;
    const comm = psField('comm', ppid).toLowerCase();
    chain.push(comm);
    if (comm.includes('iterm')) return 'iTerm';
    if (/(^|\/)terminal($|\s)/.test(comm) || comm.endsWith('/terminal')) return 'Terminal';
    if (comm.includes('warp')) return 'Warp';
    if (comm.includes('alacritty')) return 'Alacritty';
    if (comm.includes('kitty')) return 'Kitty';
    if (comm.includes('wezterm')) return 'WezTerm';
    if (comm.includes('ghostty')) return 'Ghostty';
    if (comm.includes('hyper')) return 'Hyper';
    if (comm.includes('vscode') || comm.includes('code helper')) return 'VSCode';
    cur = ppid;
  }
  return null;
}

function pidCwd(pid) {
  try {
    const out = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf-8', timeout: 1500 });
    const m = out.match(/^n(.+)$/m);
    return m ? m[1] : null;
  } catch { return null; }
}

function scanProcesses() {
  let procs;
  try {
    const out = execFileSync('pgrep', ['-x', 'claude'], { encoding: 'utf-8', timeout: 1000 }).trim();
    procs = out.split('\n').filter(Boolean);
  } catch { return; }
  const claudeByCwd = new Map();
  for (const pid of procs) {
    const cwd = pidCwd(pid);
    if (!cwd) continue;
    const tty = psField('tty', pid);
    const app = detectTerminalFromPid(pid);
    if (!claudeByCwd.has(cwd)) claudeByCwd.set(cwd, []);
    claudeByCwd.get(cwd).push({ pid, tty, app });
  }
  for (const [sid, entry] of sessions.entries()) {
    if (!entry.cwd) continue;
    const candidates = claudeByCwd.get(entry.cwd);
    if (!candidates || candidates.length !== 1) continue;
    const c = candidates[0];
    if (entry.tty === c.tty && entry.terminalApp === c.app && entry.pid === c.pid) continue;
    entry.tty = c.tty || entry.tty;
    entry.terminalApp = c.app || entry.terminalApp;
    entry.pid = c.pid;
    sessions.set(sid, entry);
    broadcastSession(sid);
  }
}

function scanProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) return;
  const now = Date.now();
  let dirs;
  try { dirs = fs.readdirSync(PROJECTS_DIR); } catch { return; }
  for (const dir of dirs) {
    const full = path.join(PROJECTS_DIR, dir);
    let files;
    try {
      const stat = fs.statSync(full);
      if (!stat.isDirectory()) continue;
      files = fs.readdirSync(full).filter((f) => f.endsWith('.jsonl'));
    } catch { continue; }
    for (const f of files) {
      const filePath = path.join(full, f);
      let mt;
      try { mt = fs.statSync(filePath).mtimeMs; } catch { continue; }
      if (now - mt > ACTIVE_WINDOW_MS) continue;
      const sid = f.replace(/\.jsonl$/, '');
      const existing = sessions.get(sid);
      // A wrapped session is owned by its wrapper: the PTY socket and the
      // transcript fs.watch keep it current. Re-stamping it from the scan would
      // strip `pty`/`closed` and send /send back down the headless path.
      if (existing && existing.source === 'pty') continue;
      if (existing && existing.ts >= mt - 1000 && existing.source !== 'scan-stub') continue;
      const summary = summarizeFromTranscript(filePath);
      const cwd = decodeProject(dir);
      const project = path.basename(cwd);
      const entry = {
        sessionId: sid,
        project,
        cwd,
        title: summary.title,
        lines: summary.lines.slice(-3),
        options: summary.options,
        transcriptPath: filePath,
        ts: mt,
        source: 'scan',
      };
      const existing0 = sessions.get(sid);
      if (existing0) {
        entry.tty = existing0.tty || entry.tty;
        entry.terminalApp = existing0.terminalApp || entry.terminalApp;
        entry.tmuxTarget = existing0.tmuxTarget || entry.tmuxTarget;
        entry.pid = existing0.pid || entry.pid;
        entry.thinking = existing0.thinking || false;
      }
      const prev = sessions.get(sid);
      sessions.set(sid, entry);
      if (!prev || JSON.stringify(prev.lines) !== JSON.stringify(entry.lines) || prev.ts !== entry.ts) {
        broadcastSession(sid);
      }
    }
  }
}

// A live status line off the Mac's screen is the strongest evidence there is
// that Claude is still working — stronger than `thinking`, which several other
// paths clear (a transcript append, an assistant turn landing). Without this the
// spinner blinked off mid-answer while the TUI was visibly still spinning.
function forClient(s) {
  return { ...s, thinking: s.status ? true : !!s.thinking };
}

function sessionsArray() {
  const now = Date.now();
  return [...sessions.values()]
    .filter((s) => now - s.ts < STALE_MS)
    .filter((s) => s.source === 'pty' || (s.transcriptPath
      && fs.existsSync(s.transcriptPath)
      && path.basename(s.transcriptPath, '.jsonl') === s.sessionId))
    .sort((a, b) => b.ts - a.ts)
    .map(forClient);
}

function broadcast(msg) {
  const payload = JSON.stringify(msg);
  for (const ws of clients) if (ws.readyState === ws.OPEN) ws.send(payload);
}

function broadcastSession(sessionId) {
  const entry = sessions.get(sessionId);
  if (!entry) return;
  broadcast({ type: 'update', session: forClient(entry) });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  const rel = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(__dirname, '..', 'public', rel);
  if (!filePath.startsWith(path.join(__dirname, '..', 'public'))) {
    res.writeHead(403); res.end('forbidden'); return true;
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
  const ext = path.extname(filePath);
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  // No CORS headers. The phone app is native and the bundled web UI is served
  // from this same origin, so nothing legitimate needs them — and echoing
  // Allow-Origin: * invited any page the user happened to be visiting to probe
  // this port and hammer /pair from the victim's own network position.
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, 'http://x');

  if (req.method === 'GET' && url.pathname === '/latest') {
    if (!timingSafeStrEq(req.headers['x-secret'], SECRET)) { res.writeHead(401); res.end('unauthorized'); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sessionsArray()));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ pairRequired: Date.now() <= pairWindowUntil }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/pair') {
    const ip = req.socket.remoteAddress || 'unknown';
    const rec = pairAttempts.get(ip);
    const now = Date.now();
    if (rec && now < rec.resetAt && rec.count >= PAIR_MAX_ATTEMPTS) {
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil((rec.resetAt - now) / 1000)) });
      res.end(JSON.stringify({ ok: false, error: 'too many attempts, try again later' }));
      return;
    }
    try {
      const body = await readBody(req);
      const { pin } = JSON.parse(body);
      if (Date.now() > pairWindowUntil) {
        res.writeHead(410, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'pair window expired — restart server' }));
        return;
      }
      if (!timingSafeStrEq(pin, PAIR_PIN)) {
        pairFailCount++;
        const cur = pairAttempts.get(ip) || { count: 0, resetAt: now + PAIR_LOCKOUT_MS };
        cur.count++;
        if (cur.count === 1) cur.resetAt = now + PAIR_LOCKOUT_MS;
        pairAttempts.set(ip, cur);
        // Kill pair window after 20 total failed attempts across all IPs (blast radius cap)
        if (pairFailCount >= 20) {
          pairWindowUntil = 0;
          console.log('[SEC] too many pair failures — pair window closed. Restart to reopen.');
        }
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'wrong pin' }));
        return;
      }
      pairAttempts.delete(ip);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, secret: SECRET }));
    } catch { res.writeHead(400); res.end('bad json'); }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/transcript') {
    if (!timingSafeStrEq(req.headers['x-secret'], SECRET)) { res.writeHead(401); res.end('unauthorized'); return; }
    const sid = url.searchParams.get('sessionId');
    const entry = sessions.get(sid);
    if (!entry) { res.writeHead(404); res.end('no session'); return; }
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '30', 10), 100);
    if (entry.transcriptPath) {
      // Prose AND the tool activity between it — the app collapses the latter.
      const entries = readTranscriptTail(entry.transcriptPath, limit)
        .flatMap((e) => conversationFrom(e));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sessionId: sid, entries, cost: entry.cost || null }));
      return;
    }
    const msgs = ptyMessages.get(sid);
    if (msgs && msgs.length) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sessionId: sid, entries: msgs.slice(-limit), cost: null }));
      return;
    }
    // A Claude session whose transcript has not been located yet: answer empty
    // rather than shipping TUI repaint frames the phone would render as content.
    if (entry.tool === 'claude') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sessionId: sid, entries: [], cost: null }));
      return;
    }
    // No transcript and no parsed messages (e.g. `clim codex`) — the raw terminal
    // scrollback is all we have. Ship it as ONE block, not one bubble per line.
    const buf = stripAnsi(ptyBuffers.get(sid) || '');
    const text = buf.split('\n').map((t) => t.trimEnd()).filter(Boolean).slice(-limit).join('\n');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ sessionId: sid, entries: text ? [{ role: 'terminal', text, ts: null }] : [], cost: null }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/ingest') {
    if (!timingSafeStrEq(req.headers['x-secret'], SECRET)) { res.writeHead(401); res.end('unauthorized'); return; }
    try {
      const body = await readBody(req);
      const parsed = JSON.parse(body);
      const sessionId = parsed.sessionId || 'unknown-session';
      const prev = sessions.get(sessionId) || {};
      const fullText = parsed.text || (Array.isArray(parsed.lines) ? parsed.lines.join('\n') : '');
      const entry = {
        ...prev,
        sessionId,
        project: parsed.project || prev.project || 'unknown-project',
        cwd: parsed.cwd || prev.cwd || '',
        lines: parsed.lines || prev.lines || [],
        options: parseOptions(fullText) || prev.options || null,
        transcriptPath: parsed.transcriptPath || prev.transcriptPath || null,
        tty: parsed.tty || prev.tty || null,
        terminalApp: parsed.terminalApp || prev.terminalApp || null,
        tmuxTarget: parsed.tmuxTarget || prev.tmuxTarget || null,
        pid: parsed.pid || prev.pid || null,
        thinking: false,
        ts: Date.now(),
        source: 'ingest',
      };
      sessions.set(sessionId, entry);
      broadcastSession(sessionId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch {
      res.writeHead(400); res.end('bad json');
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/send') {
    if (!timingSafeStrEq(req.headers['x-secret'], SECRET)) {
      console.log('[SEND] 401 — bad secret from', req.socket.remoteAddress);
      res.writeHead(401); res.end('unauthorized'); return;
    }
    let parsed;
    try { parsed = JSON.parse(await readBody(req)); }
    catch { res.writeHead(400); res.end('bad json'); return; }
    const { sessionId, text, cwd } = parsed;
    if (!text) { res.writeHead(400); res.end('missing text'); return; }

    const entry = sessions.get(sessionId);
    const ptyWs = ptySockets.get(sessionId);
    if (ptyWs && ptyWs.readyState === 1) {
      try {
        ptyWs.send(JSON.stringify({ type: 'input', text: text.endsWith('\n') ? text : text + '\n' }));
        if (entry) {
          entry.options = null; entry.thinking = true; entry.ts = Date.now();
          try {
            const s = entry.transcriptPath ? summarizeFromTranscript(entry.transcriptPath) : null;
            entry.ackedAssistant = s ? (s.lines || []).join('\n') : '';
          } catch { entry.ackedAssistant = ''; }
          broadcastSession(sessionId);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, mode: 'pty' }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
      return;
    }
    // The wrapper owns this session and is not on the socket right now.
    if (entry && (entry.pty || entry.source === 'pty')) {
      const closed = !!entry.closed;
      res.writeHead(closed ? 409 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: false, closed,
        error: closed
          ? 'session closed — the terminal running it exited'
          : 'wrapper offline — reconnecting',
      }));
      return;
    }
    const mode = entry && entry.tmuxTarget ? 'tmux' : entry && entry.tty && entry.terminalApp ? 'applescript' : 'unattached';
    // Never log what the user typed. This line used to write the first 60 chars
    // of every message into /tmp/clim-server.log, append-only and never rotated.
    console.log(`[SEND] sid=${(sessionId||'?').slice(0,8)} mode=${mode} tty=${entry?.tty} app=${entry?.terminalApp} chars=${text.length}`);

    if (entry && (entry.tmuxTarget || (entry.tty && entry.terminalApp))) {
      const result = sendToTerminal(entry.terminalApp, entry.tty, text, entry.tmuxTarget);
      console.log(`[SEND] result:`, result);
      if (result.ok) {
        entry.ts = Date.now();
        broadcastSession(sessionId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, mode: entry.tmuxTarget ? 'tmux' : 'terminal', app: entry.terminalApp, tty: entry.tty, tmuxTarget: entry.tmuxTarget }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: result.error }));
      }
      return;
    }

    // No wrapper, no tmux target, no scriptable terminal. Spawning `claude -p`
    // here used to be the fallback, but a headless one-shot is a *different*
    // conversation from the one on screen: it answers into the same transcript
    // file the interactive process owns, nothing is echoed in the terminal, and
    // the reply the phone is waiting for never appears in the session it tapped.
    res.writeHead(409, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: false, unattached: true,
      error: `no live wrapper for this session — run \`clim claude\` in ${entry?.cwd || 'that project'} to control it`,
    }));
    return;
  }

  if (req.method === 'GET' && serveStatic(req, res)) return;
  res.writeHead(404); res.end('not found');
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
server.on('upgrade', (req, sock, head) => {
  const u = new URL(req.url, 'http://x');
  const q = u.searchParams.get('secret');
  if (!q || !timingSafeStrEq(q, SECRET)) { sock.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); sock.destroy(); return; }
  if (u.pathname === '/pty') {
    wss.handleUpgrade(req, sock, head, (ws) => handlePtyConn(ws, u));
  } else {
    wss.handleUpgrade(req, sock, head, (ws) => handleClientConn(ws));
  }
});

function handleClientConn(ws) {
  clients.add(ws);
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.send(JSON.stringify({ type: 'init', sessions: sessionsArray() }));
  ws.on('message', (m) => {
    try {
      const msg = JSON.parse(m.toString());
      if (msg.type === 'ptyBufferReq' && msg.sessionId) {
        ws.send(JSON.stringify({ type: 'ptyBuffer', sessionId: msg.sessionId, text: ptyBuffers.get(msg.sessionId) || '' }));
      }
    } catch {}
  });
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
}

function handlePtyConn(ws, u) {
  let sid = u.searchParams.get('sessionId');
  const tool = u.searchParams.get('tool') || 'shell';
  const project = u.searchParams.get('project') || 'wrapped';
  const cwd = u.searchParams.get('cwd') || '';
  if (!sid) { try { ws.close(); } catch {} return; }
  ptySockets.set(sid, ws);
  ptyBuffers.set(sid, '');
  const entry = {
    sessionId: sid,
    project,
    cwd,
    tool,
    title: `${tool} — ${project}`,
    lines: [],
    options: null,
    ts: Date.now(),
    source: 'pty',
    pty: true,
  };
  sessions.set(sid, entry);
  broadcastSession(sid);

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (m) => {
    try {
      const msg = JSON.parse(m.toString());
      if (msg.type === 'transcriptPath' && typeof msg.path === 'string') {
        // The wrapper names its own transcript, and /transcript later reads
        // whatever is named here. Holding the secret already means being able
        // to type into the terminal, so this is not a trust boundary — but a
        // path that is not a Claude transcript is never legitimate, and
        // accepting one turns a compromised wrapper into a file reader.
        if (!isTranscriptPath(msg.path)) {
          console.log('[SEC] refused transcriptPath outside the projects dir');
          return;
        }
        const claudeSid = msg.claudeSessionId;
        // Rekey pty session to Claude's real sessionId so /send routes here (not to `claude -p`)
        // and card list shows one merged entry (not one pty + one scan).
        if (claudeSid && claudeSid !== sid) {
          const oldSid = sid;
          const cur = sessions.get(oldSid) || {};
          const scanned = sessions.get(claudeSid) || {};
          const merged = {
            ...scanned, ...cur,
            sessionId: claudeSid,
            transcriptPath: msg.path,
            pty: true, source: 'pty',
            ts: Date.now(),
          };
          sessions.set(claudeSid, merged);
          sessions.delete(oldSid);
          ptySockets.set(claudeSid, ws);
          ptySockets.delete(oldSid);
          const oldBuf = ptyBuffers.get(oldSid); if (oldBuf) { ptyBuffers.set(claudeSid, oldBuf); ptyBuffers.delete(oldSid); }
          const oldMsgs = ptyMessages.get(oldSid); if (oldMsgs) { ptyMessages.set(claudeSid, oldMsgs); ptyMessages.delete(oldSid); }
          sid = claudeSid;
        }
        const cur = sessions.get(sid);
        if (cur) {
          cur.transcriptPath = msg.path;
          try {
            const sum = summarizeFromTranscript(msg.path);
            if (sum.lines && sum.lines.length) cur.lines = sum.lines.slice(-3);
            if (sum.title) cur.title = sum.title;
            if (sum.options !== undefined) cur.options = sum.options;
          } catch {}
          cur.ts = Date.now();
          sessions.set(sid, cur);
          broadcastSession(sid);
        }
        try {
          const key = 'w:' + sid;
          if (!ptyWatchers.has(key)) {
            const w = fs.watch(msg.path, { persistent: false }, () => {
              const c = sessions.get(sid);
              if (!c) return;
              try {
                const s2 = summarizeFromTranscript(msg.path);
                if (s2.lines && s2.lines.length) c.lines = s2.lines.slice(-3);
                const cur2 = (s2.lines || []).join('\n');
                const isAcked = c.ackedAssistant && cur2 === c.ackedAssistant;
                if (!isAcked) {
                  if (s2.options !== undefined) c.options = s2.options;
                  c.thinking = false;
                  c.ackedAssistant = null;
                }
                c.ts = Date.now();
                sessions.set(sid, c);
                broadcastSession(sid);
              } catch {}
            });
            ptyWatchers.set(key, w);
          }
        } catch {}
        return;
      }
      // What Claude is doing right now, lifted from the TUI by the wrapper.
      // Not a message and not a card line — a live status the phone can show
      // instead of inventing a spinner word.
      // The human is at the Mac's keyboard right now.
      // Parsed by the wrapper from a real screen buffer, not guessed here.
      if (msg.type === 'options') {
        const cur = sessions.get(sid);
        if (cur && JSON.stringify(cur.options || null) !== JSON.stringify(msg.options || null)) {
          cur.options = msg.options || null;
          cur.ts = Date.now();
          sessions.set(sid, cur);
          broadcastSession(sid);
        }
        return;
      }
      // The wrapper's reconstructed screen for a tool with no transcript. This
      // replaces the session's previous screen rather than appending to it —
      // that is the whole point, a repaint is not new content.
      if (msg.type === 'screen' && typeof msg.text === 'string') {
        const cur = sessions.get(sid);
        if (cur && cur.screen !== msg.text) {
          cur.screen = msg.text;
          cur.ts = Date.now();
          sessions.set(sid, cur);
          broadcastSession(sid);
        }
        return;
      }
      if (msg.type === 'attention') {
        const cur = sessions.get(sid);
        if (cur) { cur.attendedAt = Date.now(); sessions.set(sid, cur); broadcastSession(sid); }
        return;
      }
      if (msg.type === 'status') {
        const cur = sessions.get(sid);
        if (cur && cur.status !== msg.status) {
          cur.status = msg.status || null;
          cur.thinking = !!msg.status;
          cur.ts = Date.now();
          sessions.set(sid, cur);
          broadcastSession(sid);
        }
        return;
      }
      // The wrapper is going away on purpose (shell exited, terminal window
      // closed, SIGTERM). Distinguishable from a network blip, so say so.
      if (msg.type === 'closed') {
        markClosed(sid, msg.reason || 'exit', msg.exitCode);
        return;
      }
      // A parsed conversation message from the wrapper's transcript tail.
      if (msg.type === 'msg' && typeof msg.text === 'string') {
        const list = ptyMessages.get(sid) || [];
        const last = list[list.length - 1];
        // fs.watch + the 1s poll can both deliver the same append — drop the echo.
        if (last && last.role === msg.role && last.text === msg.text) return;
        list.push({ role: msg.role, text: msg.text, ts: msg.ts || null });
        while (list.length > PTY_MESSAGES_MAX) list.shift();
        ptyMessages.set(sid, list);

        const cur = sessions.get(sid);
        if (cur) {
          if (msg.role === 'assistant') {
            cur.lines = msg.text.trim().split('\n').filter(Boolean).slice(-3);
            cur.options = parseOptions(msg.text);
            cur.thinking = false;
          } else {
            cur.thinking = true;   // user turn just landed — Claude is working on it
            cur.options = null;
          }
          cur.ts = Date.now();
          sessions.set(sid, cur);
        }
        for (const client of clients) {
          if (client.readyState === client.OPEN) {
            client.send(JSON.stringify({ type: 'msg', sessionId: sid, role: msg.role, text: msg.text, ts: msg.ts || null }));
          }
        }
        broadcastSession(sid);
        return;
      }
      if (msg.type === 'output') {
        const prev = ptyBuffers.get(sid) || '';
        let next = prev + msg.text;
        if (next.length > PTY_BUFFER_MAX) next = next.slice(next.length - PTY_BUFFER_MAX);
        ptyBuffers.set(sid, next);
        const cur = sessions.get(sid);
        const isChat = cur && cur.tool === 'claude';
        if (cur) {
          // Only fall back to raw PTY frames when there is no real conversation to show.
          if (!isChat && !cur.transcriptPath && !(ptyMessages.get(sid) || []).length) {
            const cleaned = stripAnsi(next).split('\n').filter(Boolean).slice(-3);
            if (cleaned.length) cur.lines = cleaned;
          }
          cur.ts = Date.now();
          sessions.set(sid, cur);
        }
        // Chat sessions ship parsed messages, never frames — so the phone cannot
        // render terminal noise even by accident, and the LAN link stays quiet.
        if (!isChat) {
          for (const client of clients) {
            if (client.readyState === client.OPEN) {
              client.send(JSON.stringify({ type: 'ptyChunk', sessionId: sid, text: msg.text }));
            }
          }
        }
        broadcastSession(sid);
      }
    } catch {}
  });
  ws.on('close', () => {
    // Only tear down if this socket is still the one registered for `sid` — a
    // reconnecting wrapper installs its replacement before the old close fires,
    // and an announced close already detached it.
    if (!detachPty(sid, ws)) return;
    // No `closed` notice arrived — the process died without a chance to speak
    // (kill -9, crash, laptop asleep). A dropped socket is not proof of death,
    // so give it a grace period to reconnect before declaring the session gone.
    const cur = sessions.get(sid);
    if (cur) { cur.pty = false; cur.ts = Date.now(); sessions.set(sid, cur); broadcastSession(sid); }
    setTimeout(() => {
      if (ptySockets.has(sid)) return;               // came back — still live
      markClosed(sid, 'disconnected', null);
    }, DISCONNECT_GRACE_MS);
  });
  ws.on('error', () => {});
}

// Drop a wrapper's socket and the transcript watcher that went with it. Returns
// false when `ws` is stale (a newer socket owns this sid), so the caller knows
// not to run teardown that belongs to the live connection.
function detachPty(sid, ws) {
  if (ws && ptySockets.get(sid) !== ws) return false;
  ptySockets.delete(sid);
  const wkey = 'w:' + sid;
  const w = ptyWatchers.get(wkey);
  if (w) { try { w.close(); } catch {} ptyWatchers.delete(wkey); }
  return true;
}

// A session the phone can no longer drive. Kept in the list (marked) rather than
// dropped: "closed 4m ago" is information, a card that silently vanishes is not.
function markClosed(sid, reason, exitCode) {
  const cur = sessions.get(sid);
  if (!cur || cur.closed) return;
  // Stop routing /send here the moment closure is known — the socket lingers
  // for a beat while the wrapper flushes, and a send in that window is lost.
  detachPty(sid, null);
  cur.closed = true;
  cur.closedReason = reason;
  cur.closedAt = Date.now();
  cur.exitCode = exitCode ?? null;
  cur.pty = false;
  cur.thinking = false;
  cur.options = null;
  cur.ts = Date.now();
  sessions.set(sid, cur);
  broadcastSession(sid);
  console.log(`[CLOSED] sid=${String(sid).slice(0, 8)} reason=${reason} exit=${exitCode ?? '-'}`);
}

const stripAnsi = ansiToText;

setInterval(() => {
  for (const ws of clients) {
    if (ws.isAlive === false) { try { ws.terminate(); } catch {} clients.delete(ws); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
  // Same for wrappers: a half-open PTY socket silently swallows /send. Two
  // missed pings is 50s of silence — the Mac is gone (asleep, killed, off the
  // network), so retire the session instead of leaving a card that looks live.
  for (const [sid, ws] of ptySockets) {
    if (ws.isAlive === false) {
      try { ws.terminate(); } catch {}
      detachPty(sid, ws);
      markClosed(sid, 'unresponsive', null);
      continue;
    }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
}, 25000);

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIp();
  const url = `http://${ip}:${PORT}`;
  try {
    const bj = new Bonjour();
    // Leaving the advert registered on exit is why restarts pile up as
    // "clim-…-1824, -1876, -1972" — mDNS renames around the ghost each time.
    let goodbyeSent = false;
    const unpublish = (done) => {
      if (goodbyeSent) return done && done();
      goodbyeSent = true;
      try { bj.unpublishAll(() => { try { bj.destroy(); } catch {} done && done(); }); }
      catch { done && done(); }
    };
    process.on('exit', () => unpublish());
    for (const sig of ['SIGINT', 'SIGTERM']) {
      // Exiting immediately kills the mDNS goodbye mid-flight, which is what
      // left a trail of ghost "clim-…-2739, -2832, -2887" Macs, all "online".
      process.on(sig, () => {
        const bail = setTimeout(() => process.exit(0), 700);
        unpublish(() => { clearTimeout(bail); process.exit(0); });
      });
    }
    bj.publish({
      name: `clim-${os.hostname()}`.replace(/\.local$/, ''),
      type: 'clim',
      protocol: 'tcp',
      port: Number(PORT),
      txt: { version: '0.4.0', host: ip },
    });
    console.log(`Bonjour advertising _clim._tcp.local on port ${PORT}`);
  } catch (e) { console.log('bonjour advertise failed:', e.message); }
  console.log('\n=== clim ===');
  console.log(`Local URL:  ${url}`);
  console.log(`WebSocket:  ws://${ip}:${PORT}`);
  console.log('');
  const bigPin = PAIR_PIN.split('').join(' ');
  console.log('\x1b[2m┌─ clim pairing PIN ─────────────────┐\x1b[0m');
  console.log('\x1b[2m│                                     │\x1b[0m');
  console.log(`\x1b[2m│\x1b[0m     \x1b[1;97m${bigPin}\x1b[0m         \x1b[2m│\x1b[0m`);
  console.log('\x1b[2m│                                     │\x1b[0m');
  console.log('\x1b[2m│  Valid 10 min · `clim pin` any time│\x1b[0m');
  console.log('\x1b[2m└─────────────────────────────────────┘\x1b[0m');
  console.log('');
  try {
    fs.writeFileSync('/tmp/clim-pin.txt', JSON.stringify({ pin: PAIR_PIN, until: pairWindowUntil }), { mode: 0o600 });
    // So `clim restart` can reopen the pairing window without hunting for a PID.
    fs.writeFileSync('/tmp/clim-server.pid', String(process.pid), { mode: 0o600 });
  } catch {}
  // SECRET intentionally NOT printed. Use `clim pair` to reshow PIN + QR.
  // A QR of the bare URL used to be printed here; the app cannot pair from one
  // (no PIN, no key) and rejects it as "unknown QR format". The pairing QR is
  // the invite line printed by `clim claude` / `clim pair`.
  console.log(`\nTo pair a phone: ${'\x1b[1m'}clim pair${'\x1b[0m'}\n`);

  // Deliberately after listen(): the first sweep shells out to pgrep/lsof/ps
  // once per running Claude and reads every recent transcript, which took
  // multiple seconds on a busy machine — all of it before the port was open,
  // so `clim claude` sat waiting and the wrapper connected late.
  setImmediate(() => { scanProjects(); scanProcesses(); });
  setInterval(() => { scanProjects(); scanProcesses(); }, SCAN_INTERVAL_MS);
});
