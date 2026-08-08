# clim

**Control Claude Code and Codex from your phone.**
LAN offline or E2E-encrypted cloud. One command.

```bash
npm install -g @dingalabs/clim
clim claude
```

A QR pops up on your Mac terminal. Scan it with the clim app. Your Claude session streams live to your phone. Tap Yes/No, numbered options, or type — everything lands in the real terminal like you typed it.

---

## Quick start

**1. Install the CLI**

```bash
npm install -g @dingalabs/clim
```

**2. Run Claude (or Codex) inside clim**

```bash
clim claude
# or
clim codex
# or wrap any REPL:
clim wrap python3
```

The CLI auto-starts a local relay in the background, prints a PIN + a QR code, then launches your CLI.

**3. Scan the QR with the clim phone app**

- iOS app: coming to TestFlight
- No camera (simulator, denied permission)? Paste the invite line printed under the QR into the app instead
- The app auto-detects LAN vs Cloud from the QR contents and pairs securely.

**4. Control from your phone**

- Yes/No prompts render as tap buttons
- Numbered lists become tappable rows
- Free text → typed into the live REPL

---

## What shows up as a message

Only real conversation. For `clim claude`, messages are read from Claude Code's own
`.jsonl` transcript — the same file Claude writes for `--resume` — so what reaches
your phone is exactly what was said:

| Shown as a message | Never shown as a message |
|--------------------|--------------------------|
| Assistant prose    | Tool calls and tool results |
| Your own prompts   | Hook output, slash-command echoes |
|                    | System reminders, subagent turns |
|                    | TUI banners, box drawing, status bars |

The terminal stream is still forwarded, but it is scrollback, not chat. A TUI
repaints constantly; rendering those frames as messages is what makes output
appear to arrive fragment by fragment.

For tools with no transcript (`clim codex`, `clim wrap …`) the app shows the
terminal scrollback as a single block instead of faking a conversation.

---

## How it works

Two modes, one QR:

| Mode  | When it's used                    | What travels the wire        |
|-------|-----------------------------------|------------------------------|
| LAN   | Phone on same WiFi as Mac         | Direct, no packets to cloud  |
| Cloud | Phone on cellular / remote WiFi   | E2E-encrypted through relay  |

The phone tries LAN first; if unreachable, it falls back to Cloud automatically.

**Cloud relay is zero-knowledge:**
- Wrapper on Mac generates a 32-byte random key at pair time.
- Every message is authenticated-encrypted with `nacl.secretbox` (XSalsa20-Poly1305) before leaving the device.
- Relay stores nothing. Never sees plaintext.
- Server code is open — the security model does not depend on server secrecy.

---

## Commands

```
clim claude [args…]         Start Claude Code inside the wrapper
clim codex  [args…]         Start Codex inside the wrapper
clim wrap <cmd> [args…]     Wrap any interactive REPL
clim server                 Run the LAN relay in the foreground
clim pair                   Reshow the pairing QR (server must be running)
clim pin                    Print the current pairing PIN
```

## Environment

| Var              | Default                                          | Purpose                                    |
|------------------|--------------------------------------------------|--------------------------------------------|
| `PORT`           | `8787`                                           | LAN relay HTTP/WS port                     |
| `SECRET`         | auto-generated 48-char hex                       | LAN relay auth token                       |
| `CLIM_CLOUD`    | `wss://clim-relay.subrahmanya126.workers.dev`   | Cloud relay WebSocket URL                  |
| `CLIM_KEY`      | auto-generated per session                       | E2E encryption key (base64)                |
| `CCI_SESSION_ID` | auto-generated UUID                              | Cloud session identifier                   |

Set your own cloud relay:

```bash
export CLIM_CLOUD=wss://relay.example.com
```

## Self-hosting the cloud relay

The relay is a Cloudflare Worker + Durable Object (`worker/` in the repo); a single-file Deno equivalent lives in `relay/main.ts`. Deploy to Cloudflare, Deno Deploy, Fly.io, or any host that terminates WebSockets. Source: [github.com/dingalabs/clim](https://github.com/dingalabs/clim).

## Security notes

- Anyone with the pairing key can type into your REPL. Treat the QR like a password.
- PIN pairing is rate-limited (5 attempts / minute / IP) and closes after 20 total failures. PIN window auto-expires 10 minutes after `clim claude` starts.
- The wrapper needs the Mac awake to stream. It doesn't run headless in the cloud.

## FAQ

**Do I need an account?** No.

**Does the cloud relay operator see my code?** No — it only sees encrypted bytes routed by session ID. See [security notes above](#security-notes).

**Does this work with Codex?** Yes: `clim codex`.

**Can I wrap any tool?** Yes: `clim wrap <cmd>`.

**Requirements:** Node ≥ 18, macOS / Linux. Windows not tested.

## License

MIT. See [LICENSE](./LICENSE).
