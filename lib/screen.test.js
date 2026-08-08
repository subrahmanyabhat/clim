// Run: node lib/screen.test.js
const assert = require('assert');
const { Screen } = require('./screen');
const { parseOptions } = require('./options');

// ── the thing flattening got wrong ───────────────────────────────────────────
// Two writes to the same row: the second must overwrite, not append.
{
  const s = new Screen(40, 5);
  s.write('\x1b[1;1HCool, calm, most common favourite.');
  s.write('\x1b[1;1HBlue');
  assert.strictEqual(s.text().split('\n')[0], 'Blue, calm, most common favourite.',
    'a redraw overwrites the cells it lands on');
}

// Absolute positioning puts rows where the TUI put them.
{
  const s = new Screen(30, 6);
  s.write('\x1b[3;1H  2. green');
  s.write('\x1b[2;1H❯ 1. red');
  s.write('\x1b[4;1H  3. blue');
  assert.deepStrictEqual(s.text().split('\n').slice(1, 4), ['❯ 1. red', '  2. green', '  3. blue']);
}

// Erase-line clears the rest of the row, so stale text does not linger.
{
  const s = new Screen(20, 3);
  s.write('\x1b[1;1Hthinking hard…');
  s.write('\x1b[1;1Hdone\x1b[K');
  assert.strictEqual(s.text().split('\n')[0], 'done');
}

// Erase-display wipes the frame between repaints.
{
  const s = new Screen(20, 3);
  s.write('old content');
  s.write('\x1b[2J\x1b[1;1Hnew');
  assert.strictEqual(s.text().split('\n')[0], 'new');
  assert.ok(!s.text().includes('old'));
}

// ── the menu that started this ───────────────────────────────────────────────
// A real AskUserQuestion frame: drawn out of order, with the spinner and token
// counter painted into the middle of the screen between the option rows.
{
  const s = new Screen(60, 12);
  s.write('\x1b[2J');
  s.write('\x1b[2;1HWhich colour do you prefer?');
  s.write('\x1b[8;1H  3. Blue');
  s.write('\x1b[4;1H❯ 1. Red');
  s.write('\x1b[6;1H  2. Green');
  s.write('\x1b[5;22H(2s · ↓ 23 tokens)');   // spinner debris mid-frame
  s.write('\x1b[10;1HEnter to select · ↑/↓ to navigate · Esc to cancel');

  const opts = parseOptions(s.text());
  assert.ok(opts, 'the menu is found even though it was painted out of order');
  assert.strictEqual(opts.type, 'numbered');
  assert.deepStrictEqual(opts.items.map((i) => i.key), ['1', '2', '3'],
    'all three rows survive — flattening lost 1 and 2 entirely');
  assert.deepStrictEqual(opts.items.map((i) => i.label), ['Red', 'Green', 'Blue']);
}

// Scrolling past the bottom keeps the newest rows.
{
  const s = new Screen(10, 3);
  for (let i = 1; i <= 5; i++) s.write('line' + i + '\r\n');
  const rows = s.text().split('\n').filter(Boolean);
  assert.ok(rows.includes('line5'), 'newest line kept');
  assert.ok(!rows.includes('line1'), 'oldest scrolled off');
}

console.log('screen: ok');

// A PTY splits writes wherever it likes. An escape cut in half used to have its
// tail printed as text — a real capture showed ";136mgithub:" on screen.
{
  const s = new Screen(40, 3);
  s.write('\x1b[38;5;');          // chunk ends mid-sequence
  s.write('136mgithub: ok');      // …and resumes here
  assert.strictEqual(s.text().split('\n')[0], 'github: ok', 'a split escape is still an escape');
}
{
  const s = new Screen(40, 3);
  s.write('one\x1b');             // bare ESC at the boundary
  s.write('[2Ktwo');
  assert.ok(!s.text().includes('['), 'no escape debris on screen');
}
console.log('screen: split-escape ok');

// DECSCUSR — "ESC [ 5 SP q" — has an intermediate byte before its final letter.
// Scanning only digits stopped at the space and printed the 'q', which is how
// codex's status line reached the phone as "/private/tmpq".
{
  const s = new Screen(40, 2);
  s.write('/private/tmp\x1b[5 q');
  assert.strictEqual(s.text().split('\n')[0], '/private/tmp', 'cursor-style sequence must leave no debris');
}
console.log('screen: cursor-style intermediate ok');
