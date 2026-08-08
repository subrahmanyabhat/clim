// Run: node lib/server.test.js
// Boots the relay, fakes a wrapper on /pty and a phone on /, and checks that a
// real conversation message survives the round trip as a message — not as PTY frames.
const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');

const SECRET = 'servertest-secret';
const PORT = '8799';
const SID = 'testsession';
const base = `http://127.0.0.1:${PORT}`;

const srv = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
  env: { ...process.env, SECRET, PORT, HOME: process.env.HOME }, stdio: 'ignore',
});
const done = (code, msg) => { try { srv.kill(); } catch {} if (msg) console.log(msg); process.exit(code); };
process.on('uncaughtException', (e) => { console.error(e); done(1); });
// Never hang: a socket that never opens (relay slow to bind, port held by a
// leftover from an aborted run) used to wedge the whole suite silently.
const deadline = setTimeout(() => { console.error('server.test: timed out'); done(1); }, 60000);
deadline.unref();
process.on('exit', () => { try { srv.kill(); } catch {} });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // Poll, don't guess: a fixed sleep passes on an idle laptop and fails the
  // moment anything else is competing for the CPU.
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/config`)).ok) break; } catch {}
    await wait(100);
  }

  const got = [];
  const phone = new WebSocket(`ws://127.0.0.1:${PORT}?secret=${SECRET}`);
  phone.on('message', (m) => got.push(JSON.parse(m.toString())));
  await new Promise((r) => phone.on('open', r));

  const wrapper = new WebSocket(
    `ws://127.0.0.1:${PORT}/pty?secret=${SECRET}&sessionId=${SID}&tool=claude&project=demo&cwd=/tmp/demo`);
  await new Promise((r) => wrapper.on('open', r));
  await wait(200);

  // Raw PTY noise first — this must never become a chat message.
  wrapper.send(JSON.stringify({ type: 'output', text: '\x1b[2G\x1b[1mAccessing\x1b[12Gworkspace:\x1b[22m\n' }));
  await wait(200);

  wrapper.send(JSON.stringify({ type: 'msg', role: 'user', text: 'run the tests' }));
  wrapper.send(JSON.stringify({ type: 'msg', role: 'assistant', text: 'Which one?\n1. unit\n2. e2e\nEnter to confirm' }));
  wrapper.send(JSON.stringify({ type: 'msg', role: 'assistant', text: 'Which one?\n1. unit\n2. e2e\nEnter to confirm' })); // duplicate
  await wait(400);

  const msgs = got.filter((m) => m.type === 'msg');
  assert.deepStrictEqual(msgs.map((m) => m.role + ':' + m.text.split('\n')[0]),
    ['user:run the tests', 'assistant:Which one?'],
    'both turns broadcast once each — the duplicate is dropped');

  const updates = got.filter((m) => m.type === 'update' && m.session.sessionId === SID);
  const last = updates[updates.length - 1].session;
  assert.deepStrictEqual(last.options, { type: 'numbered', items: [{ key: '1', label: 'unit' }, { key: '2', label: 'e2e' }] },
    'a menu in the reply becomes tappable options');
  assert.ok(!last.lines.some((l) => l.includes('Accessing')), 'PTY frames do not leak into the card preview');

  // Real phrasing, no keyword from any hand-written list — the question mark above item 1 is the signal.
  wrapper.send(JSON.stringify({ type: 'msg', role: 'assistant',
    text: 'Fixed the limit check.\n\nHow do you want to handle files that exceed it?\n\n1. Reject with 413\n2. Chunk client-side\n3. Stream to S3' }));
  await wait(300);
  const afterAsk = got.filter((m) => m.type === 'update' && m.session.sessionId === SID).pop().session;
  assert.strictEqual(afterAsk.options && afterAsk.options.items.length, 3,
    'a plainly-worded question above a numbered list still becomes options');

  // A numbered list in ordinary prose must NOT become tappable options.
  wrapper.send(JSON.stringify({ type: 'msg', role: 'assistant',
    text: 'I changed three things.\n1. Bumped the limit\n2. Moved the check\n3. Added a test\nAll done.' }));
  await wait(300);
  const afterProse = got.filter((m) => m.type === 'update' && m.session.sessionId === SID).pop().session;
  assert.strictEqual(afterProse.options, null, 'a prose list is not a menu');

  const r = await fetch(`${base}/transcript?sessionId=${SID}&limit=10`, { headers: { 'X-Secret': SECRET } });
  const body = await r.json();
  assert.deepStrictEqual(body.entries.map((e) => e.role), ['user', 'assistant', 'assistant', 'assistant'],
    '/transcript returns the conversation, not terminal scrollback');

  // A session with no messages at all falls back to one terminal block, not one bubble per line.
  const w2 = new WebSocket(`ws://127.0.0.1:${PORT}/pty?secret=${SECRET}&sessionId=raw1&tool=codex&project=demo&cwd=/tmp/demo`);
  await new Promise((res) => w2.on('open', res));
  w2.send(JSON.stringify({ type: 'output', text: 'line one\nline two\nline three\n' }));
  await wait(300);
  const r2 = await (await fetch(`${base}/transcript?sessionId=raw1&limit=10`, { headers: { 'X-Secret': SECRET } })).json();
  assert.strictEqual(r2.entries.length, 1, 'terminal scrollback is one block');
  assert.strictEqual(r2.entries[0].role, 'terminal');
  assert.strictEqual(r2.entries[0].text, 'line one\nline two\nline three');

  done(0, 'server: ok');
})();
