# clim — security review

Method follows Strix's `source_aware_whitebox` playbook: static triage first,
then every hypothesis validated against the source before it is written down.
Strix itself was not run — it needs Docker (absent on this machine) and a paid
LLM key — so its skill set was used as the checklist and the analysis is mine.

Tools actually run: `semgrep` (496 rules, 142 files, 18 raw findings),
`npm audit --omit=dev` (0 vulnerabilities), plus targeted reading of the auth,
crypto, PTY-input and relay paths.

**Trust model this is judged against:** whoever holds `SECRET` can type into the
terminal, which is equivalent to running commands as the user. So the boundary
worth defending is *getting* the secret — pairing, and the pre-auth surface.
Post-auth findings are defence in depth, and are labelled as such.

---

## Fixed in this pass

### 1. Pairing PIN was weaker and shorter than intended — MEDIUM

`lib/server.js`. The PIN was `randomBytes(6).toString('base64')`, stripped of
`+/=`, sliced to 8, uppercased. Two defects, both measured over 20,000
generations rather than reasoned about:

- **Length was not fixed.** Stripping ran *before* the slice, so 23% of PINs
  were 7 characters or fewer. 4-character PINs occur (~1 in 20,000) — about 20
  bits, brute-forceable inside the 10-minute window even with the rate limit.
- **Alphabet collapsed.** Uppercasing folds base64's lower case onto its upper
  case, leaving 36 skewed symbols at 5.12 bits each. Real entropy for a full
  8-character PIN was **40.9 bits**, not the "~48 bits" the comment claimed.

Now 8 characters drawn uniformly with `crypto.randomInt` from a 32-symbol
alphabet — exactly 40 bits every time, no short PINs, and `I/O/0/1` removed
since this is read off one screen and typed into another.

What already limited the damage, and still does: per-IP lockout, a 10-minute
window, and the pair window closing entirely after 20 failures globally.

### 2. `transcriptPath` was trusted verbatim — LOW (post-auth)

`lib/server.js`. A PTY client announces where its transcript lives, and
`GET /transcript` later reads that path and returns parsed lines. Nothing
constrained it, so a client could name `/etc/passwd` and read back whatever
parses as JSONL.

This sits **behind** the secret, and a secret-holder can already type commands
into a live terminal, so it crosses no boundary. Fixed anyway because a path
outside Claude's projects directory is never legitimate: it must now resolve
inside `~/.claude/projects/` and end in `.jsonl`.

### 3. `Access-Control-Allow-Origin: *` — LOW

`lib/server.js` set a wildcard CORS header and allowed the `X-Secret` header on
every response. Nothing needs it: the phone app is native (CORS does not apply)
and the bundled web UI is same-origin. What it did enable was any page the user
happened to be visiting quietly probing `http://<lan-ip>:8787` and reading
responses — including hammering `/pair` from inside the victim's network.
Header removed.

---

## Reviewed and found sound

- **Cryptography** (`lib/crypto.js`) — NaCl `secretbox`, 24-byte random nonce
  per message prepended to the ciphertext, authenticated. No nonce reuse, no
  home-made constructions, no ECB/CBC. Key never leaves the two devices.
- **Secret comparison** — `crypto.timingSafeEqual` everywhere, with the
  unequal-length case handled instead of throwing.
- **Terminal.app RCE, deliberately closed** — `sendToTerminal` refuses every
  terminal except iTerm and tmux, with a comment explaining why: Terminal.app's
  `do script` *executes* its payload, whereas iTerm's `write text` types it. The
  AppleScript path also escapes backslash, quote and newline.
- **tmux path** uses `execFileSync` with an argument array and `send-keys -l`
  (literal), so there is no shell to inject into.
- **Static file serving** resolves and then checks the path is inside `public/`.
- **PTY message size** is bounded (20 000 char buffer, 200 message cap).
- **`/send` to an unattended session** refuses rather than spawning a headless
  `claude -p`, with a comment explaining that a one-shot would answer into a
  different conversation than the one on screen.
- **Dependencies** — `npm audit --omit=dev`: 0 vulnerabilities.
- **Android cleartext** is now scoped through a network security config rather
  than living only in the debug manifest (see the Android commit).

---

## Accepted risks, with reasoning

**LAN traffic is plaintext HTTP/WS.** By design: both devices are on the same
network, the payload is a terminal session, and TLS on a LAN IP means either a
self-signed certificate the phone must be taught to trust, or no TLS. Anyone
already on your WiFi *and* holding the secret could read a session. Cloud mode
is `wss://` and sealed with NaCl before it reaches the relay, so the relay
operator sees ciphertext only.

**The secret is the whole authorisation model.** There are no per-session
scopes: a paired phone can drive every session on that Mac. Reasonable for a
single-user tool; worth revisiting if clim ever pairs a phone that should only
see one project.

**`/tmp/clim-pin.txt`** is written `0600`, but `/tmp` is shared. On a multi-user
Mac another local user could pre-create that path as a symlink and redirect the
write. Low value to an attacker (the PIN is short-lived and rate-limited) and
it needs a local account, so it is noted rather than fixed.

---

## Semgrep triage

18 raw findings, none exploitable as reported:

| Finding | Count | Verdict |
|---|---|---|
| `detect-insecure-websocket` (`ws://`) | 4 | Expected — LAN mode is `ws://` by design; cloud is `wss://` |
| `using-http-server` / `http-request` | 6 | 4 in tests, 2 in the LAN server. By design |
| `path-join-resolve-traversal` | 4 | 3 in tests. The one in `server.js` is the static handler, which does check containment |
| `react-insecure-request` | 3 | Test files hitting the local test server |
| `exported_activity` (Android) | 1 | `MainActivity` must be exported to be launchable |

---

## Not covered

- **No dynamic testing.** No fuzzing of the WS frame parser, no attempt at the
  relay's room isolation under concurrency, no MITM against the pairing
  exchange. That is what Strix would have added, and it needs Docker plus a
  funded API key.
- **The Cloudflare worker's room isolation** was read, not attacked. Two phones
  claiming the same room id is the interesting case and it deserves a test.
- **The React Native app** was reviewed for how it handles secrets (stored in
  `AsyncStorage`, which is not the Keychain — fine for a LAN token, worth
  revisiting if the threat model grows) but not audited end to end.
