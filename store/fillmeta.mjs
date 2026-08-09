import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);

const DESC = `Your Mac is running Claude Code. You are not at your Mac.

clim puts that session on your phone. You see what the agent said, you see the question it is stuck on, and you tap the answer. It lands in the real terminal exactly as if you had typed it, in the session that is already open.

ONE COMMAND, NO ACCOUNT
Install the CLI, run clim claude, scan the QR that appears. There is no signup, no dashboard, no email. The pairing key is generated on your Mac and read once by your phone.

ANY AGENT YOU RUN IN A TERMINAL
Claude Code and Codex are first class: clim reads their conversations turn by turn. Hermes works the same way. So does anything else you wrap with clim wrap, such as a REPL, a shell, or a build watcher.

AT HOME IT NEVER LEAVES YOUR NETWORK
On the same WiFi, your phone talks straight to your Mac. No hop, no relay, no company in the middle. Away from home, traffic goes through a zero-knowledge relay that only ever sees ciphertext: the key lives on your two devices and is never sent.

WHAT YOU CAN DO FROM THE PHONE
- See every session across every project, and which one needs you
- Read the conversation as it was actually said, without terminal noise
- Tap numbered options and yes/no prompts instead of typing them
- Send a message into the live session
- Get a notification the moment an agent stops and waits on you
- Mute the sessions you do not want to hear about

WHAT IT IS NOT
clim does not provide the AI. You need your own Claude Code, Codex or Hermes access, and their terms govern how you use them. clim is a remote control for software running on your own computer. It is not affiliated with, endorsed by, or sponsored by Anthropic, OpenAI or Nous Research.

Open source, MIT licensed: github.com/subrahmanyabhat/clim`;

const NOTES = `clim is a remote control for a coding session running on the reviewer's own Mac, so exercising it end to end needs a Mac with Claude Code or Codex installed.

Pairing:
  npm install -g @dingalabs/clim
  clim claude

That prints a QR code and a numeric pair code. In the app, either scan the QR or paste the invite line printed beneath it. Both devices must be on the same WiFi for LAN mode.

There is no account system and no credentials to supply. The app collects nothing and has no server-side state to log into.

Camera access is used only to scan that pairing QR. Declining it leaves the paste-the-invite-line path, which is fully functional.

If a Mac is not available, please contact us at the email on this listing and we will arrange a live session to pair against.`;

const fields = {
  promotionalText: "Now reads Codex and Hermes sessions as real conversations, not raw terminal output. Same tap-to-answer, same zero-knowledge relay.",
  description: DESC,
  // Brand names left out on purpose: Apple rejects metadata that leans on other
  // companies' trademarks for search placement. The description covers them.
  keywords: "terminal,cli,remote,ssh,console,shell,developer,coding,agent,pty,tmux,devtools",
  supportUrl: "https://github.com/subrahmanyabhat/clim/issues",
  marketingUrl: "https://getclim.netlify.app",
  versionString: "1.1.0",
  copyright: "2026 Dinga Labs",
  contactFirstName: "Subrahmanya",
  contactLastName: "Bhat",
  contactEmail: "subrahmanya126@gmail.com",
  notes: NOTES,
};

for (const [id, val] of Object.entries(fields)) {
  const el = p.locator(`#${id}`);
  if (await el.count()) { await el.fill(val).catch(e => console.log(`  ${id}: ${e.message.slice(0,50)}`)); console.log(`  ${id}: ${val.length} chars`); }
  else console.log(`  ${id}: NOT FOUND`);
}
await p.waitForTimeout(2000);
const check = await p.evaluate(() => ({
  keywords: document.querySelector('#keywords')?.value,
  version: document.querySelector('#versionString')?.value,
  desc: (document.querySelector('#description')?.value||'').length,
  notes: (document.querySelector('#notes')?.value||'').length,
  email: document.querySelector('#contactEmail')?.value,
}));
console.log("verify:", JSON.stringify(check));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/meta-filled.png', fullPage: true });
await b.close();
