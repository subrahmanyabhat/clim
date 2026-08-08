// End-to-end: real relay + real PTY wrapper + a simulated phone.
// Covers the round trip the unit tests cannot: mobile input reaching the shell,
// terminal output reaching the phone, and a closed terminal being reported as
// closed instead of silently falling back to a headless `claude -p`.
//
// Uses `cat` as the wrapped tool: whatever the phone sends comes straight back
// as PTY output, so both directions are observable without Claude installed.

const assert = require('assert');
const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const { WebSocketServer } = require('ws');
const { encrypt, decrypt } = require('./crypto');

const ROOT = path.join(__dirname, '..');
const PORT = 8899;
const SECRET = 'e2e-secret-0123456789';
const BASE = `http://127.0.0.1:${PORT}`;
// Isolated HOME so the relay's ~/.claude/projects scan finds nothing and the
// session list contains only what this test creates.
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'clim-e2e-'));
const HOME2 = fs.mkdtempSync(path.join(os.tmpdir(), 'clim-e2e-cloud-'));
const CLOUD_PORT = 8901;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function post(pathname, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(`${BASE}${pathname}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Secret': SECRET, 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let out = '';
      res.on('data', (c) => (out += c));
      res.on('end', () => { let j = null; try { j = JSON.parse(out); } catch {} resolve({ status: res.statusCode, body: j, raw: out }); });
    });
    req.on('error', reject);
    req.end(data);
  });
}

async function waitFor(label, fn, timeoutMs = 15000) {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for: ${label}`);
    await sleep(100);
  }
}

// A stand-in for the real `claude`: records the --session-id it was handed,
// writes that session's transcript, then drops a DECOY transcript in the same
// project folder with a newer mtime — the exact shape that made the wrapper
// attach the phone to a different conversation than the terminal. Then behaves
// like `cat` so the PTY stays drivable.
const CLAUDE_DECOY_SID = '11111111-2222-3333-4444-555555555555';
function installClaudeShim(binDir) {
  fs.mkdirSync(binDir, { recursive: true });
  const shim = `#!/bin/bash
sid=""
while [ $# -gt 0 ]; do
  case "$1" in
    --session-id) sid="$2"; shift 2 ;;
    *) shift ;;
  esac
done
echo -n "$sid" > "$HOME/claude-session-id.txt"
slug=$(echo "$PWD" | sed 's|/|-|g')
dir="$HOME/.claude/projects/$slug"
mkdir -p "$dir"
# Claude only writes the transcript once a turn is committed — whenever the
# human gets round to typing. The wrapper must still be watching by then.
sleep "\${CLIM_TEST_TRANSCRIPT_DELAY:-0}"
say() {
  printf '{"type":"%s","sessionId":"%s","cwd":"%s","timestamp":"2026-01-01T00:00:00Z","message":{"content":[{"type":"text","text":"%s"}]}}\\n' "$1" "$3" "$PWD" "$2" >> "$dir/$3.jsonl"
}
say user "REAL-USER-TURN" "$sid"
say assistant "REAL-ASSISTANT-TURN" "$sid"
sleep 0.4
# Decoy: same folder, newer mtime, different conversation.
say user "DECOY-USER-TURN" "${CLAUDE_DECOY_SID}"
say assistant "DECOY-ASSISTANT-TURN" "${CLAUDE_DECOY_SID}"
exec node "${binDir}/keyrec.js"
`;
  // Records each read from the PTY as one hex line, so the test can see not just
  // WHAT was typed but how it was delivered — a TUI's submit depends on both.
  fs.writeFileSync(path.join(binDir, 'keyrec.js'), `
    const fs = require('fs');
    try { process.stdin.setRawMode(true); } catch {}
    process.stdin.on('data', (d) => fs.appendFileSync(process.env.HOME + '/keys.hex', d.toString('hex') + '\\n'));
    // Stand in for Claude's spinner, redrawn the way the real TUI redraws it —
    // interleaved with output so the status line keeps scrolling out of view.
    setInterval(() => { process.stdout.write('\\r\\n\\u001b[2m·\\u001b[0m\\r\\nSimmering…\\r\\n'); }, 400);
    setInterval(() => {}, 1000);
  `);
  const p = path.join(binDir, 'claude');
  fs.writeFileSync(p, shim, { mode: 0o755 });
  return p;
}

// A wrapped session, as `clim wrap cat` would create it. stdout is captured
// because it is exactly what a person sitting at the terminal would see.
function startWrapper(env = {}, tool = 'cat', cwd = ROOT) {
  const child = spawn(process.execPath, ['-e', `require(process.argv[1]).wrap('${tool}', [])`, path.join(ROOT, 'lib', 'wrap.js')], {
    cwd,
    env: { ...process.env, HOME, CCI_SECRET: SECRET, CCI_RELAY: BASE, CLIM_KEY: '', CLIM_CLOUD: '', ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const w = { child, stdout: '', stderr: '' };
  child.stdout.on('data', (d) => (w.stdout += d.toString()));
  child.stderr.on('data', (d) => (w.stderr += d.toString()));
  return w;
}

async function main() {
  const server = spawn(process.execPath, [path.join(ROOT, 'lib', 'server.js')], {
    env: { ...process.env, HOME, PORT: String(PORT), SECRET },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  server.stdout.on('data', (d) => (serverLog += d.toString()));
  server.stderr.on('data', (d) => (serverLog += d.toString()));

  const cleanup = [];
  const kill = (p) => { try { p.kill('SIGKILL'); } catch {} };

  try {
    await waitFor('relay listening', () => new Promise((r) => {
      http.get(`${BASE}/config`, (res) => { res.resume(); r(res.statusCode === 200); }).on('error', () => r(false));
    }));

    // ── 0. pairing, from a phone that has never seen this Mac ────────────────
    // This is the first thing a new install does, and nothing covered it.
    const pin = JSON.parse(fs.readFileSync('/tmp/clim-pin.txt', 'utf-8')).pin;
    const wrongPin = await post('/pair', { pin: 'WRONGPIN' });
    assert.strictEqual(wrongPin.status, 401, 'a bad PIN must be rejected');
    assert.ok(!wrongPin.body.secret, 'a bad PIN must never hand out the secret');

    const paired = await post('/pair', { pin });
    assert.strictEqual(paired.status, 200, `pairing should succeed, got ${paired.status} ${paired.raw}`);
    assert.strictEqual(paired.body.secret, SECRET, 'pairing returns the secret the phone then stores');
    console.log('  ✓ clean pair: wrong PIN rejected, right PIN returns the secret');

    // ── the phone ────────────────────────────────────────────────────────────
    const events = [];
    const phone = new WebSocket(`ws://127.0.0.1:${PORT}/?secret=${SECRET}`);
    cleanup.push(() => { try { phone.close(); } catch {} });
    phone.on('message', (m) => { try { events.push(JSON.parse(m.toString())); } catch {} });
    await waitFor('phone connected', () => phone.readyState === 1);
    const sessionOf = (sid) => {
      let found = null;
      for (const e of events) {
        if (e.type === 'update' && e.session?.sessionId === sid) found = e.session;
        if (e.type === 'init') for (const s of e.sessions || []) if (s.sessionId === sid) found = s;
      }
      return found;
    };

    // ── 1. a wrapped session registers as a live PTY session ─────────────────
    const w1 = startWrapper();
    cleanup.push(() => kill(w1.child));
    const sid = await waitFor('pty session announced', () => {
      const e = events.find((x) => x.type === 'update' && x.session?.source === 'pty');
      return e ? e.session.sessionId : null;
    });
    assert.strictEqual(sessionOf(sid).pty, true, 'session should be live pty');
    console.log('  ✓ wrapped session registers (source=pty)');

    // ── 2. phone → terminal, and the terminal shows what the phone sent ──────
    const marker = 'hello-from-phone-42';
    const sendRes = await post('/send', { sessionId: sid, text: marker });
    assert.strictEqual(sendRes.status, 200, `send should succeed, got ${sendRes.status} ${sendRes.raw}`);
    assert.strictEqual(sendRes.body.mode, 'pty', 'send must route through the PTY, never headless');
    await waitFor('terminal echoes mobile input', () => w1.stdout.includes('▸ mobile') && w1.stdout.includes(marker));
    console.log('  ✓ terminal prints what mobile sent ("▸ mobile …")');

    // ── 3. terminal → phone, live ────────────────────────────────────────────
    await waitFor('phone receives pty output', () =>
      events.some((e) => e.type === 'ptyChunk' && e.sessionId === sid && e.text.includes(marker)));
    console.log('  ✓ phone receives live terminal output (ptyChunk)');

    // ── 3b. a tool with no transcript ships a screen, not a pile of frames ────
    // Codex and wrapped shells have no conversation to parse, so the phone used
    // to concatenate every repaint — spinner frames and all — into one blob.
    // The wrapper already reconstructs the screen; this is that screen arriving.
    await waitFor('phone gets the reconstructed screen', () =>
      (sessionOf(sid)?.screen || '').includes(marker));
    const screenText = sessionOf(sid).screen;
    assert.ok(screenText.split('\n').length <= 60,
      `screen must be one screen, not accumulated frames (got ${screenText.split('\n').length} lines)`);
    console.log('  ✓ non-chat session ships a screen, repaints overwrite');

    // input typed at the Mac must reach the phone too — the other half of "two-way"
    const typed = 'typed-at-the-mac-77';
    w1.child.stdin.write(typed + '\n');
    await waitFor('phone sees locally-typed output', () =>
      events.some((e) => e.type === 'ptyChunk' && e.sessionId === sid && e.text.includes(typed)));
    console.log('  ✓ phone receives output typed locally at the Mac');

    // ── 4. concurrent sessions get distinct ids ──────────────────────────────
    // CCI_SESSION_ID is persisted per-Mac in ~/.clim/creds.json; when the LAN
    // sid reused it, a second wrapper evicted the first from the socket map.
    const w2 = startWrapper({ CCI_SESSION_ID: 'persisted-shared-id' });
    cleanup.push(() => kill(w2.child));
    const sid2 = await waitFor('second pty session', () => {
      const e = [...events].reverse().find((x) => x.type === 'update' && x.session?.source === 'pty' && x.session.sessionId !== sid);
      return e ? e.session.sessionId : null;
    });
    assert.notStrictEqual(sid2, sid, 'two wrappers must not share a session id');
    const stillLive = await post('/send', { sessionId: sid, text: 'still-here' });
    assert.strictEqual(stillLive.status, 200, 'first session must survive a second wrapper starting');
    console.log('  ✓ concurrent wrappers get distinct session ids');
    kill(w2.child);

    // ── 5. closing the terminal reports the session closed ───────────────────
    w1.child.kill('SIGTERM');
    const closed = await waitFor('session marked closed', () => {
      const s = sessionOf(sid);
      return s && s.closed ? s : null;
    });
    assert.strictEqual(closed.closed, true);
    assert.strictEqual(closed.pty, false, 'a closed session is not live');
    assert.ok(['terminated', 'exit', 'disconnected'].includes(closed.closedReason), `unexpected reason ${closed.closedReason}`);
    console.log(`  ✓ closed terminal reported to server (reason=${closed.closedReason})`);

    // still listed, so the phone can show it as obsolete rather than losing it
    const listed = await waitFor('closed session still listed', () => new Promise((r) => {
      http.get(`${BASE}/latest`, { headers: { 'X-Secret': SECRET } }, (res) => {
        let o = ''; res.on('data', (c) => (o += c));
        res.on('end', () => { try { r(JSON.parse(o).find((x) => x.sessionId === sid)); } catch { r(null); } });
      }).on('error', () => r(null));
    }));
    assert.strictEqual(listed.closed, true, 'closed session must stay in /latest, marked');
    console.log('  ✓ closed session stays listed as obsolete');

    // ── 6. sending to a closed session errors — it must NOT spawn `claude -p` ─
    const after = await post('/send', { sessionId: sid, text: 'anyone there?' });
    assert.strictEqual(after.status, 409, `expected 409, got ${after.status} ${after.raw}`);
    assert.strictEqual(after.body.closed, true);
    assert.ok(/closed/i.test(after.body.error), 'error should say the session is closed');
    console.log('  ✓ send to closed session → 409, no headless claude spawn');

    // ── 7. an unwrapped (scan-discovered) session is rejected, not shelled out ─
    await post('/ingest', { sessionId: 'scan-only-session', project: 'demo', cwd: '/tmp/demo', lines: ['hi'] });
    const unattached = await post('/send', { sessionId: 'scan-only-session', text: 'hello' });
    assert.strictEqual(unattached.status, 409, `expected 409, got ${unattached.status} ${unattached.raw}`);
    assert.ok(unattached.body.unattached, 'should be flagged unattached');
    assert.ok(/clim claude/.test(unattached.body.error), 'error should tell the user how to attach');
    console.log('  ✓ send to unwrapped session → 409 with instructions');

    // ── 8. same session, same messages, no terminal noise ────────────────────
    const binDir = path.join(HOME, 'bin');
    installClaudeShim(binDir);
    const projCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'clim-proj-'));
    const before = events.length;
    // Nothing to attach to for the first 6 seconds. A poll that gives up early
    // (it used to stop after 2 minutes) leaves the session showing no messages
    // for the rest of its life.
    const w3 = startWrapper({ PATH: `${binDir}:${process.env.PATH}`, CLIM_TEST_TRANSCRIPT_DELAY: '6' }, 'claude', projCwd);
    cleanup.push(() => kill(w3.child));

    const claudeSid = await waitFor('claude received a --session-id', () => {
      try { return fs.readFileSync(path.join(HOME, 'claude-session-id.txt'), 'utf8').trim() || null; } catch { return null; }
    });
    assert.ok(/^[0-9a-f-]{36}$/i.test(claudeSid), `expected a uuid, got "${claudeSid}"`);

    // The relay's session id IS Claude's session id — not the decoy that was
    // written to the same folder afterwards.
    const relaySid = await waitFor('relay adopts the claude session id', () => {
      const e = [...events].slice(before).reverse()
        .find((x) => x.type === 'update' && x.session?.source === 'pty' && x.session.transcriptPath);
      return e ? e.session.sessionId : null;
    });
    assert.strictEqual(relaySid, claudeSid, 'phone must be on the terminal\'s session');
    assert.notStrictEqual(relaySid, CLAUDE_DECOY_SID, 'the newer decoy transcript must not win');
    console.log('  ✓ phone session id == the terminal\'s claude session id');

    const texts = events.filter((e) => e.type === 'msg' && e.sessionId === claudeSid).map((e) => e.text);
    await waitFor('real conversation reaches the phone', () =>
      events.some((e) => e.type === 'msg' && e.sessionId === claudeSid && e.text === 'REAL-ASSISTANT-TURN'));
    const claudeMsgs = events.filter((e) => e.type === 'msg' && e.sessionId === claudeSid);
    assert.deepStrictEqual(claudeMsgs.map((m) => `${m.role}:${m.text}`),
      ['user:REAL-USER-TURN', 'assistant:REAL-ASSISTANT-TURN'],
      `phone shows this session's turns only, got ${JSON.stringify(texts)}`);
    assert.ok(!claudeMsgs.some((m) => /DECOY/.test(m.text)), 'no turns from the other session');
    console.log('  ✓ phone shows exactly the terminal\'s messages, both roles');

    // Terminal noise must never reach the phone for a session that has a transcript.
    w3.child.stdin.write('\x1b[2J\x1b[H\x1b[1m box-drawing noise \x1b[0m\n');
    await sleep(1200);
    assert.ok(!events.some((e) => e.type === 'ptyChunk' && e.sessionId === claudeSid),
      'a claude session must not stream raw PTY frames to the phone');
    const card = sessionOf(claudeSid);
    assert.ok(!/box-drawing noise/.test((card.lines || []).join('\n')),
      'terminal frames must not leak into the card preview');
    console.log('  ✓ background terminal frames hidden — messages only');

    // What Claude is doing right now, on the phone — its own word, not an
    // invented spinner, and marked as working rather than idle.
    const statusSeen = await waitFor('claude status reaches the phone', () => {
      const e = [...events].reverse().find((x) => x.type === 'update' && x.session?.sessionId === claudeSid && x.session.status);
      return e ? e.session : null;
    });
    assert.strictEqual(statusSeen.status, 'Simmering…', 'the spinner word is passed through verbatim');
    assert.strictEqual(statusSeen.thinking, true, 'a live status means the session is working');
    console.log('  ✓ live "what Claude is doing" status shown on the phone');

    // …and the phone can still drive it, with the terminal showing what it sent.
    await post('/send', { sessionId: claudeSid, text: 'from-the-phone' });
    await waitFor('mobile input echoed in the claude terminal', () =>
      w3.stdout.includes('▸ mobile') && w3.stdout.includes('from-the-phone'));
    console.log('  ✓ phone → same session, echoed in that terminal');

    // How the message is delivered decides whether a TUI submits it at all.
    const keysFile = path.join(HOME, 'keys.hex');
    const body = Buffer.from('from-the-phone').toString('hex');
    const reads = await waitFor('keystrokes recorded', () => {
      try {
        const lines = fs.readFileSync(keysFile, 'utf8').split('\n').filter(Boolean);
        const i = lines.indexOf(body);
        return i >= 0 && lines.length > i + 1 ? lines : null;
      } catch { return null; }
    });
    const bodyIdx = reads.findIndex((r) => r === body);
    assert.ok(bodyIdx >= 0, `message must arrive as its own write, got ${JSON.stringify(reads)}`);
    assert.strictEqual(reads[bodyIdx + 1], '0d',
      'Return must be CR, delivered separately — bundled with the text it reads as a paste and never submits');
    assert.ok(!reads.some((r) => r === body + '0a' || r === body + '0d'),
      'text and Return must not share one write');
    console.log('  ✓ submit is a separate CR — not LF, not bundled into a paste');

    // ── 9. cloud mode: same session, replayed history, addressed input ───────
    // Stand-in for the Cloudflare Room: fan out every frame to the other peers
    // and announce joins. Same contract as worker/src/index.ts, no network.
    const room = new WebSocketServer({ port: CLOUD_PORT });
    cleanup.push(() => { try { room.close(); } catch {} });
    room.on('connection', (sock, req) => {
      const role = new URL(req.url, 'http://x').searchParams.get('role') || 'unknown';
      for (const p of room.clients) if (p !== sock && p.readyState === 1) p.send(JSON.stringify({ type: 'peer', role }));
      sock.on('message', (d) => {
        for (const p of room.clients) if (p !== sock && p.readyState === 1) p.send(d.toString());
      });
    });

    const cloudKey = require('tweetnacl-util').encodeBase64(require('tweetnacl').randomBytes(32));
    const cloudRoom = 'room-under-test';
    const w4 = startWrapper({
      PATH: `${binDir}:${process.env.PATH}`,
      CLIM_CLOUD: `ws://127.0.0.1:${CLOUD_PORT}`,
      CLIM_KEY: cloudKey,
      CCI_SESSION_ID: cloudRoom,
      HOME: HOME2,
    }, 'claude', fs.mkdtempSync(path.join(os.tmpdir(), 'clim-cloud-')));
    cleanup.push(() => kill(w4.child));

    // Join LATE, after the Mac has already had its conversation — the case where
    // the phone used to see an empty session and miss the first turn entirely.
    await waitFor('mac produced turns before the phone joined', () => {
      try { return fs.existsSync(path.join(HOME2, 'claude-session-id.txt')); } catch { return false; }
    });
    await sleep(1500);

    const cloudSeen = [];
    const phoneCloud = new WebSocket(`ws://127.0.0.1:${CLOUD_PORT}/relay?session=${cloudRoom}&role=phone`);
    cleanup.push(() => { try { phoneCloud.close(); } catch {} });
    phoneCloud.on('message', (m) => {
      try {
        const w = JSON.parse(m.toString());
        if (!w.c) return;
        cloudSeen.push(JSON.parse(decrypt(cloudKey, w.c)));
      } catch {}
    });
    await waitFor('cloud phone connected', () => phoneCloud.readyState === 1);

    const cloudSid = fs.readFileSync(path.join(HOME2, 'claude-session-id.txt'), 'utf8').trim();
    await waitFor('history replayed to the late-joining phone', () =>
      cloudSeen.some((m) => m.type === 'msg' && m.text === 'REAL-USER-TURN') &&
      cloudSeen.some((m) => m.type === 'msg' && m.text === 'REAL-ASSISTANT-TURN'));
    console.log('  ✓ cloud: late-joining phone gets the conversation from turn one');

    assert.ok(cloudSeen.every((m) => m.sessionId), 'every cloud frame must be stamped with its session');
    assert.ok(cloudSeen.some((m) => m.type === 'meta' && m.sessionId === cloudSid),
      'cloud session id must be the claude session id, not the room id');
    assert.notStrictEqual(cloudSid, cloudRoom, 'room id and session id are different things');
    console.log('  ✓ cloud: card keyed by the claude session id — same card as LAN');

    // Addressed input reaches this session; input for another session does not.
    const sendCloud = (obj) => phoneCloud.send(JSON.stringify({ c: encrypt(cloudKey, JSON.stringify(obj)) }));
    sendCloud({ type: 'input', sessionId: 'some-other-session', text: 'MUST-NOT-ARRIVE\n' });
    await sleep(800);
    assert.ok(!w4.stdout.includes('MUST-NOT-ARRIVE'), 'input addressed elsewhere must be ignored');
    sendCloud({ type: 'input', sessionId: cloudSid, text: 'cloud-typed-this\n' });
    await waitFor('cloud input reaches the right terminal', () =>
      w4.stdout.includes('▸ mobile') && w4.stdout.includes('cloud-typed-this'));
    console.log('  ✓ cloud: input routed to the addressed session only, echoed there');

    assert.ok(!/mode=headless/.test(serverLog), 'relay must never take the headless path');
    console.log('e2e: ok');
  } catch (e) {
    console.error('\ne2e FAILED:', e.message);
    console.error('\n--- relay log ---\n' + serverLog.slice(-3000));
    process.exitCode = 1;
  } finally {
    for (const fn of cleanup) fn();
    kill(server);
    try { fs.rmSync(HOME, { recursive: true, force: true }); } catch {}
    await sleep(200);
    process.exit(process.exitCode || 0);
  }
}

main();
