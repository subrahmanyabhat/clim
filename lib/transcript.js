// Claude Code writes one JSON object per line to ~/.claude/projects/<slug>/<sessionId>.jsonl.
// That file — not the PTY stream — is the only clean source of "what was actually said".
// Everything here exists to answer one question: is this entry a real reply, or plumbing?

const NOISE_PREFIXES = [
  '<command-name>', '<command-message>', '<local-command-stdout>', '<local-command-caveat>',
  '<system-reminder>', '<user-prompt-submit-hook>', '<bash-input>', '<bash-stdout>',
  'Caveat: The messages below were generated',
  '[Request interrupted',
  'API Error',
];

function blocksToText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text).join('\n');
}

// Real user/assistant prose only. Tool calls, tool results, hook output, slash-command
// echoes, system reminders and sidechain (subagent) turns are all plumbing.
function messageFrom(entry) {
  if (!entry || (entry.type !== 'assistant' && entry.type !== 'user')) return null;
  if (entry.isMeta || entry.isSidechain) return null;

  let text = blocksToText(entry.message && entry.message.content);
  if (!text) return null;
  text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
  if (!text) return null;
  if (NOISE_PREFIXES.some((p) => text.startsWith(p))) return null;

  return { role: entry.type, text, ts: entry.timestamp || null };
}

// A tool call and what it returned are the other half of what happened. Only
// `text` blocks ever became messages, so the phone showed "I'll run the tests"
// and then, apparently, nothing at all. These come through as their own roles
// so the app can render them collapsed instead of as conversation.
const TOOL_TEXT_MAX = 2000;
const INPUT_KEYS = ['command', 'file_path', 'path', 'pattern', 'url', 'query', 'prompt', 'description'];

function summarizeInput(input) {
  if (!input || typeof input !== 'object') return '';
  for (const k of INPUT_KEYS) {
    if (typeof input[k] === 'string' && input[k].trim()) {
      return input[k].replace(/\s+/g, ' ').trim().slice(0, 160);
    }
  }
  try { return JSON.stringify(input).slice(0, 160); } catch { return ''; }
}

function resultText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n');
}

function toolsFrom(entry) {
  if (!entry || entry.isMeta || entry.isSidechain) return [];
  const content = entry.message && entry.message.content;
  if (!Array.isArray(content)) return [];
  const ts = entry.timestamp || null;
  const out = [];
  for (const b of content) {
    if (!b) continue;
    if (b.type === 'tool_use') {
      out.push({ role: 'tool', text: `${b.name || 'tool'}(${summarizeInput(b.input)})`, ts });
    } else if (b.type === 'tool_result') {
      const t = resultText(b.content).trim();
      if (t) out.push({ role: 'tool-result', text: t.slice(0, TOOL_TEXT_MAX), ts });
    }
  }
  return out;
}

/** Prose and tool activity for one transcript entry, in the order it happened. */
function conversationFrom(entry) {
  const prose = messageFrom(entry);
  return prose ? [prose, ...toolsFrom(entry)] : toolsFrom(entry);
}

function messageFromLine(line) {
  if (!line || !line.trim()) return null;
  try { return messageFrom(JSON.parse(line)); } catch { return null; }
}

// Follow a .jsonl transcript as Claude appends to it, calling back with each new
// real message. Reads from a byte offset rather than re-parsing the file, so a
// long session stays cheap.
function followTranscript(file, onMessage) {
  const fs = require('fs');
  let offset = 0;
  let partial = '';
  let reading = false;

  const pump = () => {
    if (reading) return;
    reading = true;
    try {
      const st = fs.statSync(file);
      if (st.size < offset) { offset = 0; partial = ''; }   // truncated or rotated
      if (st.size > offset) {
        const fd = fs.openSync(file, 'r');
        const buf = Buffer.alloc(st.size - offset);
        fs.readSync(fd, buf, 0, buf.length, offset);
        fs.closeSync(fd);
        offset = st.size;
        const lines = (partial + buf.toString('utf-8')).split('\n');
        partial = lines.pop() || '';                        // hold the incomplete tail
        for (const line of lines) {
          if (!line.trim()) continue;
          let entry; try { entry = JSON.parse(line); } catch { continue; }
          for (const m of conversationFrom(entry)) onMessage(m);
        }
      }
    } catch {} finally { reading = false; }
  };

  pump();
  let watcher = null;
  try { watcher = fs.watch(file, { persistent: false }, pump); } catch {}
  // fs.watch drops events on some filesystems — a cheap poll is the safety net.
  const timer = setInterval(pump, 1000);
  if (timer.unref) timer.unref();

  return () => { try { watcher && watcher.close(); } catch {} clearInterval(timer); };
}

module.exports = { messageFrom, messageFromLine, blocksToText, followTranscript, toolsFrom, conversationFrom };
