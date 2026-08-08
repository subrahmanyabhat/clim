# clim — store listing copy

Everything App Store Connect and Play Console ask for, written to their limits.
Character counts are given as `used/limit` and were counted, not estimated.

---

## Apple App Store

**Name** (21/30)
```
clim: terminal remote
```

**Subtitle** (26/30)
```
Drive Claude Code by phone
```

**Promotional text** (130/170 — editable without review, use it for news)
```
Now reads Codex and Hermes sessions as real conversations, not raw terminal output. Same tap-to-answer, same zero-knowledge relay.
```

**Description**
```
Your Mac is running Claude Code. You are not at your Mac.

clim puts that session on your phone. You see what the agent said, you see the
question it is stuck on, and you tap the answer. It lands in the real terminal
exactly as if you had typed it, in the session that is already open — not a
separate headless run that answers into the void.

ONE COMMAND, NO ACCOUNT
Install the CLI, run `clim claude`, scan the QR that appears. There is no
signup, no dashboard, no email. The pairing key is generated on your Mac and
read once by your phone.

ANY AGENT YOU RUN IN A TERMINAL
Claude Code and Codex are first class: clim reads their conversations turn by
turn. Hermes works the same way. So does anything else you wrap with
`clim wrap <command>` — a REPL, a shell, a build watcher.

AT HOME IT NEVER LEAVES YOUR NETWORK
On the same WiFi, your phone talks straight to your Mac. No hop, no relay, no
company in the middle. Away from home, traffic goes through a zero-knowledge
relay that only ever sees ciphertext: the key lives on your two devices and is
never sent.

WHAT YOU CAN DO FROM THE PHONE
• See every session across every project, and which one needs you
• Read the conversation as it was actually said, without terminal noise
• Tap numbered options and yes/no prompts instead of typing them
• Send a message, or a whole instruction, into the live session
• Get a notification the moment an agent stops and waits on you
• Mute the sessions you do not want to hear about

WHAT IT IS NOT
clim does not provide the AI. You need your own Claude Code, Codex or Hermes
access, and their terms govern how you use them. clim is a remote control for
software running on your own computer.

Open source, MIT licensed. Read every line before you trust it with a session:
github.com/subrahmanyabhat/clim
```

**Keywords** (90/100 — comma separated, no spaces after commas)
```
claude,code,codex,hermes,terminal,cli,remote,ssh,agent,ai,developer,tmux,pty,console,shell
```

**Support URL**
```
https://github.com/subrahmanyabhat/clim/issues
```

**Marketing URL**
```
https://getclim.netlify.app
```

**Privacy Policy URL**
```
https://getclim.netlify.app/privacy.html
```

**Category** — Primary: Developer Tools · Secondary: Productivity

**Age rating** — 4+

**App Privacy** — "Data Not Collected". No analytics SDK, no crash reporter, no
account. If that changes, this answer has to change with it.

**Review notes**
```
clim is a remote control for a coding session running on the reviewer's own
computer, so exercising it end to end needs a Mac with Claude Code or Codex
installed. The pairing step is:

  npm install -g @dingalabs/clim
  clim claude

That prints a QR code and a numeric pair code. In the app, either scan the QR
or paste the invite line printed beneath it. Both devices must be on the same
WiFi for LAN mode.

There is no account system and no credentials to supply. The app collects
nothing and has no server-side state to log into.

Camera access is used only to scan that pairing QR. Declining it leaves the
paste-the-invite-line path, which is fully functional.

If a Mac is not available to the reviewer, please contact us at the address on
this listing and we will arrange a live session to pair against.
```


---

## Google Play

**App name** (21/30)
```
clim: terminal remote
```

**Short description** (75/80)
```
Drive Claude Code, Codex and Hermes from your phone. LAN first, no account.
```

**Full description** (limit 4000)
Use the App Store description above; it is within Play's limit. Play renders
plain text only — the bullet characters survive, headings do not become bold.

**Category** — Tools · Tags: developer tools, productivity

**Content rating** — Everyone (fill the questionnaire; no user content, no ads,
no purchases)

**Data safety** — No data collected, no data shared. Declare the camera
permission as used for QR scanning only, not collected or transmitted.

**Contact email** — subrahmanya126@gmail.com

---

## Asset checklist

| Asset | Where | Status |
|---|---|---|
| iPhone 6.9" 1320×2868 ×5 | `export/iphone/ios/iphone/1320x2868/en/` | ready |
| iPhone 6.5" 1284×2778 ×5 | `export/iphone/ios/iphone/1284x2778/en/` | ready |
| iPhone 6.3" 1206×2622 ×5 | `export/iphone/ios/iphone/1206x2622/en/` | ready |
| iPhone 6.1" 1125×2436 ×5 | `export/iphone/ios/iphone/1125x2436/en/` | ready |
| Play phone 1080×1920 ×5 | `export/android/android/android/1080x1920/en/` | ready |
| Play feature graphic 1024×500 | `export/feature-graphic/...` | ready |
| App icon 1024×1024 | `app/Clim/ios/Clim/Images.xcassets/AppIcon.appiconset/icon-1024.png` | ready |
| Play icon 512×512 | `site/icon.png` | ready |
| iPad screenshots | — | **missing — Apple requires these if the app ships for iPad** |

The iPad deck is empty because nothing has been captured on an iPad yet. Either
capture on an iPad simulator and add an `ipad` deck, or set the target to
iPhone-only before submitting.
