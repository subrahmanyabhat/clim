// Turn a raw PTY byte stream into readable plain text.
//
// The naive approach — regex the escapes away — silently destroys the text. A TUI
// does not emit runs of spaces; it jumps the cursor. Claude Code writes
// "Accessing" then `ESC[12G` then "workspace:", so stripping escapes yields
// "Accessingworkspace:". Every word glues to the next.
//
// So we replay the cursor instead of deleting it: one line buffer, a column, and
// the handful of sequences that actually move things around.
//
// ponytail: line-scoped, not a screen buffer — absolute positioning (ESC[r;cH)
// keeps the column and drops the row, and scroll regions are ignored. Enough for
// reading output; swap in a real emulator only if full-screen apps need rendering.

const CSI = /^\x1b\[([\x30-\x3f]*)([\x20-\x2f]*)([\x40-\x7e])/;
const MAX_PAD = 500; // a bogus huge column must not allocate a huge line

function ansiToText(input) {
  const src = String(input);
  const lines = [];
  let line = '';
  let col = 0;

  const padTo = (n) => { while (line.length < n) line += ' '; };
  const writeAt = (ch) => {
    padTo(col);
    line = line.slice(0, col) + ch + line.slice(col + 1);
    col++;
  };
  const endLine = () => { lines.push(line.replace(/\s+$/, '')); line = ''; col = 0; };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (c === '\x1b') {
      const rest = src.slice(i);
      const m = CSI.exec(rest);
      if (m) {
        i += m[0].length - 1;
        const params = m[1].split(';');
        const n = parseInt(params[0], 10);
        switch (m[3]) {
          case 'G': col = Math.min(Math.max((n || 1) - 1, 0), MAX_PAD); break;          // absolute column
          case 'H': case 'f': col = Math.min(Math.max((parseInt(params[1], 10) || 1) - 1, 0), MAX_PAD); break;
          case 'C': col = Math.min(col + (n || 1), MAX_PAD); break;                     // forward
          case 'D': col = Math.max(col - (n || 1), 0); break;                           // back
          case 'K':                                                                     // erase in line
            if (!n) line = line.slice(0, col);
            else if (n === 1) { padTo(col); line = ' '.repeat(col) + line.slice(col); }
            else { line = ''; }
            break;
          default: break;                                                               // colors, modes, etc.
        }
        continue;
      }
      // OSC / DCS / PM / APC: string sequences, run to ST or BEL
      if (rest[1] === ']' || rest[1] === 'P' || rest[1] === '^' || rest[1] === '_') {
        const bel = rest.indexOf('\x07');
        const st = rest.indexOf('\x1b\\');
        const end = st >= 0 && (bel < 0 || st < bel) ? st + 2 : (bel >= 0 ? bel + 1 : rest.length);
        i += end - 1;
        continue;
      }
      i += 1; // two-char escape: ESC 7, ESC 8, ESC (B, …
      if (rest[1] === '(' || rest[1] === ')' || rest[1] === '#') i += 1;
      continue;
    }

    if (c === '\n') { endLine(); continue; }
    if (c === '\r') { col = 0; continue; }          // in-place redraw, not a new line
    if (c === '\t') { col = Math.min(col + (8 - (col % 8)), MAX_PAD); continue; }
    if (c === '\b') { col = Math.max(col - 1, 0); continue; }
    if (c < ' ' || c === '\x7f') continue;          // remaining control bytes

    writeAt(c);
  }
  if (line) endLine();
  // Keep the trailing newline: callers concatenate consecutive chunks, and losing
  // it would run the last line of one chunk into the first line of the next.
  return lines.join('\n') + (src.endsWith('\n') ? '\n' : '');
}

module.exports = { ansiToText };
