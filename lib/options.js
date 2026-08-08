// Turning a TUI menu back into something tappable. Shared by the relay and the
// wrapper, and fed from a real screen buffer (lib/screen.js) rather than a
// flattened byte stream — a menu is laid out by cursor position, not by order.
function parseOptions(text) {
  if (!text) return null;
  const nonEmpty = text.split('\n').filter((l) => l.trim());
  // Wide enough to hold a whole menu. The old six-line window cut the top off
  // any list longer than a few rows, which is most of them.
  const tailLines = nonEmpty.slice(-30);
  const tail = tailLines.join('\n');
  const lastLine = nonEmpty[nonEmpty.length - 1] || '';

  if (/\b(y\/n|yes\/no|\(y\/n\)|\(Y\/n\)|\(y\/N\))\b/i.test(lastLine)) {
    return { type: 'yesno' };
  }
  if (/\?\s*$/.test(lastLine) && /(approve|allow|permission|proceed|confirm|shall i|should i)/i.test(lastLine)) {
    return { type: 'approve' };
  }

  const ROW = /^\s*([❯>›»▸*•]\s*)?(?:[◉◯☑☐\[\]x ]{1,4}\s*)?(\d+)[.)]\s+(.+?)\s*$/;
  const numbered = [];
  // A long menu scrolls: the visible run can start at 2 or 5, not always 1.
  // Insisting on 1 meant a scrolled menu parsed as nothing at all. Anchor on
  // the first row seen and require the rest to follow it.
  let expected = null;
  let sawMarker = false;
  let firstIdx = -1;
  for (let i = 0; i < tailLines.length; i++) {
    const m = tailLines[i].match(ROW);
    if (!m) continue;                       // spinners and token counts get painted between rows
    const k = parseInt(m[2], 10);
    if (expected === null) expected = k;
    if (k !== expected) continue;
    if (m[1]) sawMarker = true;
    if (firstIdx < 0) firstIdx = i;
    numbered.push({ key: m[2], label: m[3].slice(0, 80) });
    expected++;
    if (numbered.length >= 9) break;
  }
  if (numbered.length < 2) return null;

  // A menu always tells you how to answer it. Prose that merely contains a
  // numbered list never does, which is what keeps "I changed three things…"
  // from turning into buttons.
  const hint = /(enter to (confirm|select)|esc to cancel|use arrow keys|↑\/↓|to navigate)/i.test(tail);
  const checkboxes = /[◉◯☑☐]|\[[ xX]\]/.test(tail);
  const multiRe = /(select all|check all|choose all|multiple|all that apply|any of these|tick all)/i;
  if (checkboxes || multiRe.test(tail)) return { type: 'multi', items: numbered };

  const lead = firstIdx > 0 ? tailLines[firstIdx - 1].trim() : '';
  const asksAbove = /[?:]\s*$/.test(lead);
  if (sawMarker || asksAbove || hint) {
    return { type: 'numbered', items: numbered };
  }
  return null;
}

// Claude's "working" line, e.g. "Sock-hopping… (5s · ↓ 12 tokens · esc to
// interrupt)". It lives only in the TUI — never in the transcript — so without
// lifting it out here the phone can only show a made-up spinner word while the
// Mac is busy. Returns null when nothing is in flight ("Cogitated for 2s" is a
// finished line, not a status).
const SPINNER = /^[✻✽✳✢✶·⏺⠐*❯>\s]+/;
// One word ending in an ellipsis ("Sock-hopping…", "Ionizing…"), optionally
// followed by the elapsed/token parenthetical. Anything looser matches debris:
// the TUI draws at absolute columns, so flattening a frame readily produces
// fragments like "i  …  7    thinking" that are not a status at all.
const STATUS_RE = /^([A-Za-z][A-Za-z'’-]*…)(\s*\([^)]*\))?$/;
function parseStatus(text) {
  if (!text) return null;
  const lines = String(text).split('\n').map((l) => l.trim()).filter(Boolean);
  // Only the tail: an ellipsis inside older assistant prose is not a status.
  // Wide enough that a burst of streamed output does not push the spinner line
  // out of view for a frame — STATUS_RE is strict, so widening is safe.
  for (const raw of lines.slice(-12).reverse()) {
    const m = raw.replace(SPINNER, '').trim().match(STATUS_RE);
    if (m) return (m[1] + (m[2] || '')).slice(0, 80);
  }
  return null;
}

module.exports = { parseOptions, parseStatus };
