#!/usr/bin/env node
const net = require('net');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT || 8787);
const PIN_FILE = '/tmp/clim-pin.txt';
const SECRET_FILE = '/tmp/clim-secret.txt';
const SERVER_LOG = '/tmp/clim-server.log';
// Agents that get their own subcommand. Anything else still works through
// `clim wrap <cmd>`; these are just the ones worth typing directly.
const AGENTS = ['claude', 'codex', 'hermes'];
const DEFAULT_CLOUD = 'wss://clim-relay.subrahmanya126.workers.dev';
const CREDS_DIR = path.join(require('os').homedir(), '.clim');
const CREDS_FILE = path.join(CREDS_DIR, 'creds.json');

function loadCreds() {
  try { return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf-8')); } catch { return null; }
}
function saveCreds(c) {
  try { fs.mkdirSync(CREDS_DIR, { recursive: true, mode: 0o700 }); } catch {}
  try { fs.writeFileSync(CREDS_FILE, JSON.stringify(c), { mode: 0o600 }); } catch {}
}

const DIM = '\x1b[2m', RESET = '\x1b[0m', ORANGE = '\x1b[38;5;209m', BOLD = '\x1b[1m';

function isServerUp() {
  return new Promise((resolve) => {
    const sock = net.createConnection({ port: PORT, host: '127.0.0.1' });
    sock.setTimeout(400);
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('error', () => resolve(false));
    sock.once('timeout', () => { sock.destroy(); resolve(false); });
  });
}

function readPin() {
  try {
    const d = JSON.parse(fs.readFileSync(PIN_FILE, 'utf-8'));
    const left = Math.max(0, Math.floor((d.until - Date.now()) / 1000));
    if (left <= 0) return null;
    return { pin: d.pin, minsLeft: Math.floor(left / 60), secsLeft: left % 60 };
  } catch { return null; }
}

function localIp() {
  const os = require('os');
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

async function waitForPin(maxMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const p = readPin();
    if (p) return p;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

// The cloud key and room are long-lived pairing identity, NOT part of the
// 10-minute PIN window. Loading them inside the QR banner meant every session
// started more than 10 minutes after the relay booted returned early here and
// launched with CLIM_KEY unset — so the wrapper's connectCloud() bailed on the
// first line and cloud mode was dead, silently, with no message saying so.
function ensureCloudCreds() {
  const cloud = process.env.CLIM_CLOUD || DEFAULT_CLOUD;
  let key = process.env.CLIM_KEY;
  let sid = process.env.CCI_SESSION_ID;
  if (!key || !sid) {
    const persisted = loadCreds() || {};
    key = key || persisted.key;
    sid = sid || persisted.sid;
  }
  if (!key || !sid) {
    const nacl = require('tweetnacl');
    const util = require('tweetnacl-util');
    key = key || util.encodeBase64(nacl.randomBytes(32));
    sid = sid || require('crypto').randomBytes(16).toString('hex');
    saveCreds({ key, sid });
  }
  process.env.CLIM_KEY = key;
  process.env.CCI_SESSION_ID = sid;
  return { cloud, key, sid };
}

async function printPinBanner() {
  const { cloud, key, sid } = ensureCloudCreds();
  const p = await waitForPin();
  if (!p) {
    // Pairing window closed — cloud still works, the phone is already paired.
    console.log('');
    console.log(`  ${DIM}pairing window closed. Cloud is live (room ${sid.slice(0, 6)}…).${RESET}`);
    console.log(`  ${DIM}To pair a new phone, restart the relay:${RESET} ${BOLD}clim restart${RESET}`);
    console.log('');
    return;
  }
  const ip = localIp();

  // Compact pipe format: v|lan|pin|key|sid|cloud? — ~30% smaller QR than JSON
  const keyCompact = key.replace(/=+$/, '');
  const parts = ['1', `${ip}:${PORT}`, p.pin, keyCompact, sid];
  if (cloud !== DEFAULT_CLOUD) parts.push(cloud);
  const invite = parts.join('|');

  console.log('');
  console.log(`  ${DIM}scan QR from clim phone app:${RESET}`);
  try {
    const qrcode = require('qrcode-terminal');
    qrcode.setErrorLevel('L');
    qrcode.generate(invite, { small: true });
  } catch {}
  console.log(`  ${DIM}PIN:${RESET} ${BOLD}${p.pin}${RESET}    ${DIM}(reshow: 'clim pair')${RESET}`);
  console.log('');
}

async function ensureServer() {
  if (await isServerUp()) {
    // Server already running — load its SECRET from the shared file
    try {
      const sec = fs.readFileSync(SECRET_FILE, 'utf-8').trim();
      if (sec) process.env.CCI_SECRET = sec;
    } catch {}
    return;
  }
  // Reuse the SECRET across relay restarts. Minting a new one orphaned every
  // already-paired phone AND every running wrapper (they hold the old secret in
  // env and get 401 on reconnect) — so restarting the relay silently killed
  // every other session on the machine.
  let persistedSecret = null;
  try { persistedSecret = fs.readFileSync(SECRET_FILE, 'utf-8').trim() || null; } catch {}
  const crypto = require('crypto');
  const SECRET = process.env.SECRET || persistedSecret || crypto.randomBytes(24).toString('hex');
  process.env.SECRET = SECRET;
  process.env.CCI_SECRET = SECRET;
  try { fs.writeFileSync(SECRET_FILE, SECRET, { mode: 0o600 }); } catch {}
  process.stderr.write(`${DIM}▸ starting clim server on :${PORT}…${RESET}\n`);
  const out = fs.openSync(SERVER_LOG, 'a');
  const err = fs.openSync(SERVER_LOG, 'a');
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'lib', 'server.js')], {
    detached: true, stdio: ['ignore', out, err], env: { ...process.env, SECRET },
  });
  child.unref();
  for (let i = 0; i < 50; i++) {
    if (await isServerUp()) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  await new Promise((r) => setTimeout(r, 300));
}

function showPin() {
  const p = readPin();
  if (!p) { console.log('No active PIN. Server not running or expired. Just run: clim claude'); process.exit(1); }
  console.log(`\n  Pairing PIN: ${BOLD}${p.pin}${RESET}   (valid ${p.minsLeft}m ${p.secsLeft}s)\n`);
  process.exit(0);
}

async function main() {
  const cmd = process.argv[2];
  const rest = process.argv.slice(3);

  if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') {
    console.log(`clim — mobile control for Claude Code, Codex and Hermes

Usage:
  clim claude [args...]     Run Claude Code (auto-starts the relay)
  clim codex  [args...]     Run Codex (auto-starts the relay)
  clim hermes [args...]     Run Hermes Agent (auto-starts the relay)
  clim wrap <cmd> [args…]   Wrap any interactive REPL
  clim server               Start LAN relay only (foreground)
  clim pin                  Show current pairing PIN
  clim pair                 Reshow pairing QR (if server running)
  clim restart              Restart the relay and reopen the pairing window
  clim cloud-key            Generate E2E key+session for cloud pairing`);
    process.exit(0);
  }

  if (cmd === 'pin') return showPin();
  if (cmd === 'restart') {
    // The pairing PIN is only valid for 10 minutes after the relay boots, so
    // pairing a new phone later means restarting it. Running wrappers reconnect.
    // Whatever holds the port is the relay — the pid file is only a hint, and a
    // stale one made this silently do nothing and then advise running it again.
    const pids = new Set();
    try {
      const p = Number(fs.readFileSync('/tmp/clim-server.pid', 'utf-8').trim());
      if (p) pids.add(p);
    } catch {}
    try {
      const out = require('child_process')
        .execFileSync('lsof', ['-tiTCP:' + PORT, '-sTCP:LISTEN'], { encoding: 'utf-8', timeout: 3000 });
      for (const line of out.split('\n')) if (line.trim()) pids.add(Number(line.trim()));
    } catch {}
    let stopped = 0;
    for (const pid of pids) {
      try { process.kill(pid, 'SIGTERM'); stopped++; } catch {}
    }
    console.log(stopped ? `${DIM}▸ stopped relay (${[...pids].join(', ')})${RESET}`
                        : `${DIM}▸ no relay was running${RESET}`);
    for (let i = 0; i < 60 && (await isServerUp()); i++) await new Promise((r) => setTimeout(r, 100));
    if (await isServerUp()) { console.error('clim restart: something is still holding port ' + PORT); process.exit(1); }
    await ensureServer();
    await printPinBanner();
    process.exit(0);
  }
  if (cmd === 'pair') {
    if (!(await isServerUp())) { console.log('server not running. start with: clim claude'); process.exit(1); }
    await printPinBanner();
    process.exit(0);
  }
  if (cmd === 'server') { require('../lib/server.js'); return; }
  if (cmd === 'cloud-key') {
    const nacl = require('tweetnacl');
    const util = require('tweetnacl-util');
    const key = util.encodeBase64(nacl.randomBytes(32));
    const sid = require('crypto').randomBytes(16).toString('hex');
    const url = process.env.CLIM_CLOUD || DEFAULT_CLOUD;
    const invite = JSON.stringify({ cloud: url, key, session: sid });
    console.log('');
    console.log('\x1b[2m┌─ clim cloud invite ────────────────┐\x1b[0m');
    console.log('\x1b[2m│  scan this QR from the phone app    │\x1b[0m');
    console.log('\x1b[2m└─────────────────────────────────────┘\x1b[0m');
    console.log('');
    try {
      const qrcode = require('qrcode-terminal');
      qrcode.setErrorLevel('L');
      qrcode.generate(invite, { small: false });
    } catch {}
    console.log('');
    console.log('\x1b[2mOr paste this JSON:\x1b[0m');
    console.log('  ' + invite);
    console.log('');
    console.log('\x1b[2mThen run this on Mac to stream a session:\x1b[0m');
    console.log(`  \x1b[1mCLIM_CLOUD=${url} CLIM_KEY=${key} CCI_SESSION_ID=${sid} clim claude\x1b[0m`);
    console.log('');
    process.exit(0);
  }

  // parse --cloud <url> and --key <key> flags anywhere in argv
  function extractFlag(name) {
    const idx = rest.indexOf(name);
    if (idx >= 0 && rest[idx + 1]) { const v = rest[idx + 1]; rest.splice(idx, 2); return v; }
    return null;
  }
  const cloudFlag = extractFlag('--cloud');
  const keyFlag = extractFlag('--key');
  const sessionFlag = extractFlag('--session');
  if (cloudFlag) process.env.CLIM_CLOUD = cloudFlag;
  if (keyFlag) process.env.CLIM_KEY = keyFlag;
  if (sessionFlag) process.env.CCI_SESSION_ID = sessionFlag;

  let target, args;
  if (AGENTS.includes(cmd)) { target = cmd; args = rest; }
  else if (cmd === 'wrap') {
    if (!rest[0]) { console.error('clim wrap: need a command'); process.exit(2); }
    target = rest[0]; args = rest.slice(1);
  } else {
    console.error(`clim: unknown '${cmd}'. Try 'clim help'.`);
    process.exit(2);
  }

  await ensureServer();
  await printPinBanner();
  require('../lib/wrap.js').wrap(target, args);
}

main().catch((e) => { console.error(e); process.exit(1); });
