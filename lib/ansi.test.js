// Run: node lib/ansi.test.js
const assert = require('assert');
const { ansiToText } = require('./ansi');

// The bug that started this: cursor jumps are how a TUI draws spaces.
assert.strictEqual(ansiToText('\x1b[2G\x1b[1mAccessing\x1b[12Gworkspace:\x1b[22m'), ' Accessing workspace:');
assert.strictEqual(ansiToText('a\x1b[3Cb'), 'a   b');
assert.strictEqual(ansiToText('abcdef\x1b[3Dxyz'), 'abcxyz');

// \r is an in-place redraw, not a new line.
assert.strictEqual(ansiToText('loading\rdone   '), 'done');
assert.strictEqual(ansiToText('line1\r\nline2'), 'line1\nline2');
assert.strictEqual(ansiToText('a\nb\n'), 'a\nb\n', 'trailing newline survives for chunk concatenation');

// Escapes that carry no text.
assert.strictEqual(ansiToText('\x1b[38;5;220mred\x1b[39m'), 'red');
assert.strictEqual(ansiToText('\x1b]0;window title\x07visible'), 'visible');
assert.strictEqual(ansiToText('\x1b7\x1b[r\x1b8\x1b[>0q\x1b(Btext'), 'text');
assert.strictEqual(ansiToText('\x1b[?25lhidden\x1b[?25h'), 'hidden');

// Erase-in-line.
assert.strictEqual(ansiToText('abcdef\x1b[3G\x1b[K'), 'ab');
assert.strictEqual(ansiToText('abcdef\x1b[2K!'), '      !', 'erase clears text but not the cursor column');

// Numbered options stay parseable — glued text ("1.Yes") breaks option detection.
assert.match(ansiToText('\x1b[2G1.\x1b[6GYes, I trust this folder'), /^\s*1\.\s+Yes/);

// A huge column must not blow up memory.
assert.ok(ansiToText('a\x1b[99999Gb').length < 600);

console.log('ansi: ok');
