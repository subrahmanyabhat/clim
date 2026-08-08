// A minimal terminal screen buffer.
//
// Flattening a PTY byte stream works for output that only ever moves forward.
// A full-screen TUI does not: Claude Code paints by jumping the cursor to a row
// and column and overwriting what is there. Flattened, two cells drawn at the
// same spot end up adjacent — which is how a menu came out as
// "❯ 3. Blueral, calm, easy on eyes." with options 1 and 2 missing entirely.
//
// So keep a grid and apply the movements, then read the rows. Only the sequences
// a TUI actually uses to lay out a screen are handled; colour and style are
// dropped, because nothing here cares what colour a menu row is.

const DEFAULT_COLS = 100;
const DEFAULT_ROWS = 40;

class Screen {
  constructor(cols = DEFAULT_COLS, rows = DEFAULT_ROWS) {
    this.resize(cols, rows);
  }

  resize(cols, rows) {
    this.cols = Math.max(20, cols | 0 || DEFAULT_COLS);
    this.rows = Math.max(5, rows | 0 || DEFAULT_ROWS);
    this.pending = '';
    this.grid = Array.from({ length: this.rows }, () => new Array(this.cols).fill(' '));
    this.cx = 0;
    this.cy = 0;
  }

  clear() {
    for (const row of this.grid) row.fill(' ');
    this.cx = 0; this.cy = 0;
  }

  scroll() {
    this.grid.shift();
    this.grid.push(new Array(this.cols).fill(' '));
    this.cy = this.rows - 1;
  }

  put(ch) {
    if (this.cx >= this.cols) { this.cx = 0; this.cy++; }
    if (this.cy >= this.rows) this.scroll();
    this.grid[this.cy][this.cx] = ch;
    this.cx++;
  }

  write(data) {
    // A PTY hands us arbitrary chunks, so an escape sequence can be split down
    // the middle. Without carrying the tail over, the rest of it lands on screen
    // as literal text — which is why a colour code showed up as ";136mgithub:".
    const s = (this.pending || '') + String(data);
    this.pending = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];

      if (ch === '\x1b') {
        // OSC and other string sequences: skip to their terminator.
        if (s[i + 1] === ']') {
          const end = s.indexOf('\x07', i);
          const st = s.indexOf('\x1b\\', i);
          if (end < 0 && st < 0) { this.pending = s.slice(i); break; }   // incomplete
          i = end >= 0 && (st < 0 || end < st) ? end : st + 1;
          continue;
        }
        if (s[i + 1] === undefined) { this.pending = s.slice(i); break; }
        if (s[i + 1] === '[') {
          // CSI: ESC [ params letter
          let j = i + 2;
          while (j < s.length && /[0-9;?]/.test(s[j])) j++;
          // Intermediate bytes sit between the params and the final letter:
          // "set cursor style" is ESC [ 5 SP q. Stopping at the space left the
          // 'q' to be printed as text, which is how codex's prompt line came
          // out as "/private/tmpq" on the phone.
          while (j < s.length && s[j] >= '\x20' && s[j] <= '\x2f') j++;
          if (j >= s.length) { this.pending = s.slice(i); break; }        // still arriving
          const params = s.slice(i + 2, j).replace(/\?/g, '');
          const cmd = s[j];
          const nums = params.split(';').map((p) => (p === '' ? NaN : parseInt(p, 10)));
          const n = (k, d) => (Number.isNaN(nums[k]) || nums[k] === undefined ? d : nums[k]);
          switch (cmd) {
            case 'H': case 'f':                       // cursor position (1-based)
              this.cy = Math.min(this.rows - 1, Math.max(0, n(0, 1) - 1));
              this.cx = Math.min(this.cols - 1, Math.max(0, n(1, 1) - 1));
              break;
            case 'A': this.cy = Math.max(0, this.cy - n(0, 1)); break;
            case 'B': this.cy = Math.min(this.rows - 1, this.cy + n(0, 1)); break;
            case 'C': this.cx = Math.min(this.cols - 1, this.cx + n(0, 1)); break;
            case 'D': this.cx = Math.max(0, this.cx - n(0, 1)); break;
            case 'G': this.cx = Math.min(this.cols - 1, Math.max(0, n(0, 1) - 1)); break;
            case 'd': this.cy = Math.min(this.rows - 1, Math.max(0, n(0, 1) - 1)); break;
            case 'J': {                               // erase in display
              const mode = n(0, 0);
              if (mode === 2 || mode === 3) this.clear();
              else if (mode === 0) {
                this.grid[this.cy].fill(' ', this.cx);
                for (let r = this.cy + 1; r < this.rows; r++) this.grid[r].fill(' ');
              } else {
                this.grid[this.cy].fill(' ', 0, this.cx + 1);
                for (let r = 0; r < this.cy; r++) this.grid[r].fill(' ');
              }
              break;
            }
            case 'K': {                               // erase in line
              const mode = n(0, 0);
              if (mode === 0) this.grid[this.cy].fill(' ', this.cx);
              else if (mode === 1) this.grid[this.cy].fill(' ', 0, this.cx + 1);
              else this.grid[this.cy].fill(' ');
              break;
            }
            default: break;                           // SGR, modes, everything else
          }
          i = j;
          continue;
        }
        i++;                                          // ESC + one byte (charset, etc.)
        continue;
      }

      if (ch === '\r') { this.cx = 0; continue; }
      if (ch === '\n') { this.cy++; if (this.cy >= this.rows) this.scroll(); continue; }
      if (ch === '\b') { this.cx = Math.max(0, this.cx - 1); continue; }
      if (ch === '\t') { this.cx = Math.min(this.cols - 1, (this.cx + 8) & ~7); continue; }
      if (ch < ' ') continue;                         // other control bytes
      this.put(ch);
    }
    return this;
  }

  /** The screen as text, trailing blanks trimmed, blank rows kept out. */
  text() {
    return this.grid.map((r) => r.join('').replace(/\s+$/, '')).join('\n');
  }
}

module.exports = { Screen };
