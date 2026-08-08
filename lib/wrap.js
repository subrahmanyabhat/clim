const pty = require('node-pty');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { encrypt, decrypt } = require('./crypto');
const { ansiToText } = require('./ansi');
const { followTranscript } = require('./transcript');
const { parseOptions, parseStatus } = require('./options');
const { Screen } = require('./screen');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Which Claude session is this going to be? Guessing afterwards — "newest .jsonl
// in this folder" — attaches the phone to whichever session in the same
// directory happened to write last, which is how the phone ended up mirroring a
// different conversation than the terminal. Decide the id up front instead.
// Returns { id, args }: id is null only when Claude picks the session itself
// (--continue, or --resume with no value), where guessing is all that is left.
function planClaudeSession(args) {
  const idx = (...names) => args.findIndex((a) => names.includes(a));

  const given = idx('--session-id');
  if (given >= 0) return { id: args[given + 1] || null, args };

  const resume = idx('--resume', '-r');
  if (resume >= 0) {
    const val = args[resume + 1];
    return { id: val && UUID_RE.test(val) ? val : null, args };
  }
  if (idx('--continue', '-c') >= 0) return { id: null, args };

  // Claude accepts --session-id only for a *new* session, which is exactly the
  // case left. Prepend so a trailing prompt argument stays last.
  const id = crypto.randomUUID();
  return { id, args: ['--session-id', id, ...args] };
}

function wrap(cmd, args = []) {
  const LOCAL_HTTP = process.env.CCI_RELAY || 'http://localhost:8787';
  const LOCAL_WS = LOCAL_HTTP.replace(/^http/, 'ws');
  const CLOUD_WS = process.env.CLIM_CLOUD || 'wss://clim-relay.subrahmanya126.workers.dev';
  const CLOUD_KEY = process.env.CLIM_KEY;              // base64 shared key for E2E
  const SECRET = process.env.CCI_SECRET || process.env.SECRET;
  if (!SECRET) { console.error('clim wrap: SECRET not set. Run `clim claude` (not this file directly) — the CLI passes SECRET automatically.'); process.exit(2); }
  // LAN sid must be unique per wrapper run — CCI_SESSION_ID is persisted in
  // ~/.clim/creds.json and shared by every session on this Mac, so reusing it
  // makes a second `clim claude` evict the first from the relay's socket map.
  // The cloud room id stays the persisted one: that is what the phone paired to.
  const plan = cmd === 'claude' ? planClaudeSession(args) : { id: null, args };
  args = plan.args;
  // Same id on both sides from the first frame: no rekey, and the card the phone
  // taps is provably the conversation running in this terminal.
  const sessionId = plan.id || crypto.randomUUID();
  const cloudSessionId = process.env.CCI_SESSION_ID || sessionId;
  const cwd = process.cwd();
  const project = path.basename(cwd);

  // Started from a shell that Claude Code itself spawned, the child inherits
  // markers that tell it it is a nested sub-session — and Claude then turns
  // transcript saving OFF ("inherited CLAUDE_CODE_CHILD_SESSION marker"). No
  // .jsonl means no messages on the phone, silently and forever. The wrapper is
  // starting a real top-level session, so drop the inherited identity.
  const childEnv = { ...process.env };
  for (const k of ['CLAUDE_CODE_CHILD_SESSION', 'CLAUDE_CODE_SESSION_ID', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT']) {
    delete childEnv[k];
  }

  const shell = pty.spawn(cmd, args, {
    name: process.env.TERM || 'xterm-256color',
    cols: process.stdout.columns || 100,
    rows: process.stdout.rows || 30,
    cwd, env: childEnv,
  });

  let outBuf = '';
  // The TUI paints by cursor position, so reconstruct the screen rather than
  // flattening the stream — menus were coming out with rows overwritten and
  // options missing entirely.
  const screen = new Screen(process.stdout.columns || 100, process.stdout.rows || 40);
  let localWs = null, cloudWs = null;
  let localOpen = false, cloudOpen = false;
  let flushTimer = null;
  let closedSent = false;
  let lastAnnounceAt = 0;
  // The TUI tells us whether it understands bracketed paste; believe it rather
  // than assuming. Claude Code turns it on, plain shells generally do not.
  let bracketedPaste = false;
  const SUBMIT_DELAY_MS = Number(process.env.CLIM_SUBMIT_DELAY_MS || 250);

  // Remote input is invisible otherwise: the phone types, the PTY consumes the
  // keystrokes, and whoever is sitting at the Mac never learns why the session
  // moved. Echo it into the local terminal before handing it to the shell.
  const MOBILE = '\x1b[38;5;209m', DIM = '\x1b[2m', OFF = '\x1b[0m';
  function remoteInput(text, via) {
    if (typeof text !== 'string') return;
    const body = text.replace(/\r?\n$/, '');
    process.stdout.write(`\r\n${MOBILE}▸ mobile${OFF} ${DIM}(${via})${OFF} ${body.replace(/\n/g, '\\n')}\r\n`);
    // Getting a message to actually SEND took three fixes, in order:
    //   1. Senders append "\n". A terminal sends Return as CR — Claude Code's
    //      TUI reads a bare LF as ctrl+J, "newline in the composer".
    //   2. Text and Return in one write look like a paste, and a Return inside
    //      a paste is content, not submit.
    //   3. A delay alone is a guess: a longer message is a bigger burst, so it
    //      still lands inside the paste window and adds a newline instead of
    //      sending. When the TUI has bracketed paste on (it announces
    //      ESC[?2004h) we can stop guessing — wrap the body in the paste
    //      markers so the terminal is told exactly where it ends, and the CR
    //      that follows is then unambiguously a Return keypress.
    if (bracketedPaste) {
      shell.write('\x1b[200~' + body + '\x1b[201~');
    } else {
      shell.write(body);
    }
    setTimeout(() => { try { shell.write('\r'); } catch {} }, SUBMIT_DELAY_MS);
  }

  function connectLocal() {
    const url = `${LOCAL_WS}/pty?secret=${encodeURIComponent(SECRET)}&sessionId=${sessionId}&tool=${encodeURIComponent(cmd)}&project=${encodeURIComponent(project)}&cwd=${encodeURIComponent(cwd)}`;
    localWs = new WebSocket(url);
    localWs.on('open', () => {
      localOpen = true;
      // Relay may have restarted — it has no memory of this session. Re-announce.
      if (transcriptFile) {
        try {
          localWs.send(JSON.stringify({
            type: 'transcriptPath', path: transcriptFile,
            claudeSessionId: path.basename(transcriptFile, '.jsonl'),
          }));
        } catch {}
      }
      for (const m of sentMessages) emitMsg(m, { localOnly: true });
    });
    localWs.on('message', (m) => {
      try {
        const msg = JSON.parse(m.toString());
        if (msg.type === 'input') remoteInput(msg.text, 'lan');
      } catch {}
    });
    localWs.on('close', () => { localOpen = false; if (!closedSent) setTimeout(connectLocal, 2000); });
    localWs.on('error', () => { localOpen = false; });
  }

  function connectCloud() {
    if (!CLOUD_WS || !CLOUD_KEY) return;
    const url = `${CLOUD_WS}/relay?session=${cloudSessionId}&role=mac`;
    cloudWs = new WebSocket(url);
    // Announce who we are and everything said so far. The cloud relay keeps no
    // history — whoever is not connected at the moment a turn happens never
    // learns about it — so this runs on OUR connect AND on every phone join.
    function announceCloud() {
      sendCloud({ type: 'meta', tool: cmd, project, cwd });
      if (transcriptFile) {
        sendCloud({ type: 'transcriptPath', path: transcriptFile });
      }
      for (const m of sentMessages) sendCloud({ ...m, type: 'msg' });
    }

    cloudWs.on('open', () => { cloudOpen = true; announceCloud(); });
    cloudWs.on('message', (m) => {
      try {
        const payload = JSON.parse(m.toString());
        // A phone just joined a room we were already in. It has no history and
        // the relay has none to give it — so the conversation so far, including
        // the very first turn, was simply missing until something new happened.
        // Throttled: a peer that reconnects in a loop (or an uninvited one that
        // guessed the room) would otherwise make us re-encrypt and re-send the
        // entire transcript on demand.
        if (payload.type === 'peer') {
          if (payload.role === 'mac') return;
          const now = Date.now();
          if (now - lastAnnounceAt < 3000) return;
          lastAnnounceAt = now;
          announceCloud();
          return;
        }
        const plain = decrypt(CLOUD_KEY, payload.c);
        const msg = JSON.parse(plain);
        // Every wrapper on this Mac hears every frame in the shared room. An
        // unaddressed input would be typed into ALL of them at once.
        if (msg.sessionId && msg.sessionId !== sessionId) return;
        if (msg.type === 'input') remoteInput(msg.text, 'cloud');
      } catch {}
    });
    cloudWs.on('close', () => { cloudOpen = false; if (!closedSent) setTimeout(connectCloud, 2000); });
    cloudWs.on('error', () => { cloudOpen = false; });
  }
  function sendCloud(obj) {
    if (!cloudOpen || !CLOUD_KEY) return;
    try {
      // The cloud room is per-Mac (one persisted key+id the phone scanned), so
      // every session on this Mac shares it. Stamping the real session id on
      // every frame is what lets the phone show them as separate cards — and as
      // the SAME card the LAN transport uses, instead of one merged "cloud" blob.
      const c = encrypt(CLOUD_KEY, JSON.stringify({ sessionId, ...obj }));
      cloudWs.send(JSON.stringify({ c }));
    } catch {}
  }

  // ── Real messages ────────────────────────────────────────────────────────────
  // The PTY stream is a redrawing TUI, not a conversation: rendering it as chat
  // produces one bubble per repaint frame. Claude's .jsonl transcript is the
  // actual conversation, so that is what we ship as messages.
  const MSG_HISTORY_MAX = 200;
  const sentMessages = [];
  let transcriptFile = null;

  function emitMsg(m, opts = {}) {
    const payload = { type: 'msg', role: m.role, text: m.text, ts: m.ts };
    if (localOpen) try { localWs.send(JSON.stringify(payload)); } catch {}
    if (!opts.localOnly) sendCloud(payload);
  }

  function tailTranscript(file) {
    followTranscript(file, (m) => {
      // The turn is definitively over once the reply lands — no need to wait
      // out the debounce below.
      if (m.role === 'assistant') { clearTimeout(statusClearTimer); statusClearTimer = null; setStatus(null); }
      sentMessages.push(m);
      if (sentMessages.length > MSG_HISTORY_MAX) sentMessages.shift();
      emitMsg(m);
    });
  }

  connectLocal();
  connectCloud();

  // For `clim claude` — attach to the .jsonl for THIS session and report it to
  // the relay so /transcript + summary parsing work.
  if (cmd === 'claude') {
    const startedAt = Date.now();
    const projDir = path.join(os.homedir(), '.claude', 'projects', cwd.replace(/\//g, '-'));

    function attach(file) {
      transcriptFile = file;
      const payload = JSON.stringify({
        type: 'transcriptPath', path: file,
        claudeSessionId: path.basename(file, '.jsonl'),
      });
      if (localOpen) try { localWs.send(payload); } catch {}
      tailTranscript(file);
    }

    // No deadline. Claude creates the .jsonl only when the first turn is
    // committed — which is whenever the human gets round to typing. The old
    // 2-minute cutoff meant a session left sitting at the prompt attached to
    // nothing, and then never showed a single message on the phone, forever.
    const poll = setInterval(() => {
      if (transcriptFile) { clearInterval(poll); return; }
      // Known id: wait for exactly that file. Nothing else can be mistaken for it.
      if (plan.id) {
        const want = path.join(projDir, `${plan.id}.jsonl`);
        if (fs.existsSync(want)) { clearInterval(poll); attach(want); }
        return;
      }
      // --continue / bare --resume: Claude chose the session, so the newest file
      // written since launch is the only signal available.
      try {
        let best = null, bestMtime = 0;
        for (const f of fs.readdirSync(projDir)) {
          if (!f.endsWith('.jsonl')) continue;
          const p = path.join(projDir, f);
          try {
            const st = fs.statSync(p);
            if (st.mtimeMs > startedAt - 2000 && st.mtimeMs > bestMtime) { best = p; bestMtime = st.mtimeMs; }
          } catch {}
        }
        if (best) { clearInterval(poll); attach(best); }
      } catch {}
    }, 500);
    if (poll.unref) poll.unref();
  }

  // Line-buffered: only emit up to last \n. Partial lines held. Force flush after 2s idle
  // or when buffer exceeds 8KB. `ansiToText` expands cursor-forward back into spaces
  // before stripping — otherwise every word in the TUI arrives glued to the next one.
  const stripCursorNoise = ansiToText;
  // Claude repaints its TUI continuously — spinner, token counter, input frame.
  // Shipping those frames to the phone over the cloud is pure noise: ~8 frames a
  // second of "✻ Nebulizing…", which the app throws away anyway. The one thing
  // worth extracting from them is a menu (trust folder, permission prompts),
  // because that exists ONLY in the TUI and never in the transcript. On LAN the
  // relay does this parsing; over the cloud there is no relay, so do it here.
  const isChat = cmd === 'claude';
  let lastOptionsJson = 'null';
  let lastStatus = null;
  let statusClearTimer = null;
  function setStatus(status) {
    if (status === lastStatus) return;
    lastStatus = status;
    const payload = { type: 'status', status };
    if (localOpen) try { localWs.send(JSON.stringify(payload)); } catch {}
    sendCloud(payload);
  }
  // A full screen is ~4KB, and a streaming TUI redraws far faster than anyone
  // can read. Coalesce to one send per SCREEN_MS, and never resend an identical
  // screen — a still TUI should cost nothing.
  const SCREEN_MS = 300;
  let lastScreen = null, lastScreenAt = 0, screenTimer = null;
  function sendScreen(text) {
    if (text === lastScreen) return;
    const wait = SCREEN_MS - (Date.now() - lastScreenAt);
    if (wait > 0) {
      if (!screenTimer) screenTimer = setTimeout(() => { screenTimer = null; sendScreen(screen.text()); }, wait);
      return;
    }
    lastScreen = text; lastScreenAt = Date.now();
    const payload = { type: 'screen', text };
    if (localOpen) try { localWs.send(JSON.stringify(payload)); } catch {}
    sendCloud(payload);
  }
  function emitChunk(text) {
    if (!text) return;
    if (localOpen) try { localWs.send(JSON.stringify({ type: 'output', text })); } catch {}
    if (!isChat && cloudOpen) sendCloud({ type: 'output', text });

    // Only this side has the screen, so only this side can see a menu. The
    // relay used to parse its own copy from a flattened buffer and get it
    // wrong; now it is simply told. Runs for every tool, not just Claude.
    const clean = screen.text();
    // A tool with no transcript (codex, a wrapped shell) has no conversation to
    // ship, so the phone used to concatenate the raw frames instead — every
    // spinner tick and every repaint, stacked into one wall of text with the
    // turns indistinguishable. The screen buffer already here is what the
    // terminal actually shows, so send that and let repaints overwrite.
    if (!isChat) sendScreen(clean);
    // What Claude is doing right now ("Sock-hopping… 5s") exists only in the
    // TUI. Ship the line itself so the phone shows the real thing instead of a
    // made-up spinner word — and so it stops when the work actually stops.
    // Claude's spinner line scrolls out of view for a frame whenever it streams
    // a burst of output. Reporting that as "not working" made the phone's
    // indicator blink off mid-answer, so a disappearance only counts once it
    // has persisted — a real turn ending is confirmed by the assistant message.
    const status = parseStatus(clean);
    if (status) { clearTimeout(statusClearTimer); setStatus(status); }
    else if (lastStatus && !statusClearTimer) {
      statusClearTimer = setTimeout(() => { statusClearTimer = null; setStatus(null); }, 2500);
    }
    // A menu only ever exists in the TUI, so parsing must not stop once the
    // transcript shows up — that is why every prompt after the first few
    // seconds was invisible on the phone with nothing to tap.
    const options = parseOptions(clean);
    const json = JSON.stringify(options || null);
    if (json !== lastOptionsJson) {
      lastOptionsJson = json;
      const payload = { type: 'options', options };
      if (localOpen) try { localWs.send(JSON.stringify(payload)); } catch {}
      sendCloud(payload);
    }
  }
  function drainLines(force) {
    if (!outBuf) return;
    const lastNl = outBuf.lastIndexOf('\n');
    if (lastNl >= 0) {
      const ship = outBuf.slice(0, lastNl + 1);
      outBuf = outBuf.slice(lastNl + 1);
      const clean = stripCursorNoise(ship);
      if (clean.trim()) emitChunk(clean);
    } else if (force || outBuf.length > 8000) {
      const clean = stripCursorNoise(outBuf); outBuf = '';
      if (clean.trim()) emitChunk(clean);
    }
  }
  shell.onData((data) => {
    process.stdout.write(data);
    // Rolling window of recent frames — enough for a menu to be visible in full,
    // small enough to re-parse on every chunk without thinking about it.
    if (data.includes('\x1b[?2004h')) bracketedPaste = true;
    else if (data.includes('\x1b[?2004l')) bracketedPaste = false;
    screen.write(data);
    outBuf += data;
    if (flushTimer) clearTimeout(flushTimer);
    drainLines(false);
    if (outBuf) flushTimer = setTimeout(() => drainLines(true), 2000);
  });

  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  // Someone is typing at the Mac. The phone uses this to stay quiet: being
  // buzzed about a session you are sitting in front of is pure noise.
  let lastAttentionSent = 0;
  process.stdin.on('data', (d) => {
    const now = Date.now();
    if (now - lastAttentionSent > 5000) {
      lastAttentionSent = now;
      const payload = { type: 'attention', at: now };
      if (localOpen) try { localWs.send(JSON.stringify(payload)); } catch {}
      sendCloud(payload);
    }
    shell.write(d);
  });
  process.stdout.on('resize', () => {
    try { screen.resize(process.stdout.columns, process.stdout.rows); } catch {}
    try { shell.resize(process.stdout.columns, process.stdout.rows); } catch {}
  });

  // The relay can infer a dead wrapper from a dropped socket, but not *why* it
  // died or with what exit code — and a closed terminal window kills us before
  // any TCP teardown is guaranteed to be interpreted correctly. Say it out loud.
  function announceClosed(reason, exitCode) {
    if (closedSent) return;
    closedSent = true;
    drainLines(true);
    const payload = { type: 'closed', reason, exitCode: exitCode ?? null, ts: Date.now() };
    if (localOpen) try { localWs.send(JSON.stringify(payload)); } catch {}
    sendCloud(payload);
  }
  function shutdown(reason, exitCode) {
    announceClosed(reason, exitCode);
    if (process.stdin.isTTY) try { process.stdin.setRawMode(false); } catch {}
    // Give the two sockets a tick to flush the close notice before the process
    // disappears — otherwise the phone keeps showing the session as live.
    setTimeout(() => {
      try { localWs && localWs.close(); } catch {}
      try { cloudWs && cloudWs.close(); } catch {}
      process.exit(exitCode ?? 0);
    }, 150);
  }

  shell.onExit(({ exitCode }) => shutdown('exit', exitCode));

  process.on('SIGINT', () => shell.write('\x03'));
  process.on('SIGHUP', () => { try { shell.kill(); } catch {} shutdown('hangup', 0); });
  process.on('SIGTERM', () => { try { shell.kill(); } catch {} shutdown('terminated', 0); });
}

module.exports = { wrap };
