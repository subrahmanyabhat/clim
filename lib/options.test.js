// Run: node lib/options.test.js
// Both parsers read a repainting TUI, so they are checked against frames
// captured from a real Claude session rather than invented strings.
const assert = require('assert');
const { parseOptions, parseStatus } = require('./options');

// ── parseStatus ──────────────────────────────────────────────────────────────
const working = [
  '⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents',
  '✻',
  'Sock-hopping…',
  '────────────────────────────────',
].join('\n');
assert.strictEqual(parseStatus(working), 'Sock-hopping…', 'the gerund line is the status');

assert.strictEqual(
  parseStatus('✽\nIonizing… (5s · ↓ 12 tokens · esc to interrupt)'),
  'Ionizing… (5s · ↓ 12 tokens · esc to interrupt)',
  'the elapsed/token parenthetical is part of the status');

// A finished turn is not a status — the phone must stop showing "working".
assert.strictEqual(parseStatus('❯ Cogitated for 2s'), null, 'finished lines are not a status');
assert.strictEqual(parseStatus('❯ Try "how do I log an error?"'), null, 'the idle placeholder is not a status');
assert.strictEqual(parseStatus(''), null);
assert.strictEqual(parseStatus('✘ Auto-update failed: no write permission'), null);

// The TUI draws at absolute columns, so a flattened frame can glue unrelated
// cells into one line. This exact string reached the phone as a "status".
assert.strictEqual(parseStatus('i  …  7    thinking'), null, 'column debris is not a status');
assert.strictEqual(parseStatus('⏺·Ionizing…   ⎿  Tip: try COLORTERM=truecolor'), null,
  'a status must be alone on its line, not glued to a tip');

// An ellipsis in older prose must not resurrect a status once work is done.
const stale = ['Thinking about it…', 'a', 'b', 'c', 'd', 'e', 'f', '❯ Cogitated for 2s'].join('\n');
assert.strictEqual(parseStatus(stale), null, 'only the tail counts');

// ── parseOptions ─────────────────────────────────────────────────────────────
const trust = [
  'Quick safety check: Is this a project you created or one you trust?',
  '❯ 1. Yes, I trust this folder',
  '2. No, exit',
  'Enter to confirm · Esc to cancel',
].join('\n');
assert.deepStrictEqual(parseOptions(trust), {
  type: 'numbered',
  items: [{ key: '1', label: 'Yes, I trust this folder' }, { key: '2', label: 'No, exit' }],
}, 'the trust prompt becomes two tappable rows');

// Captured from a real AskUserQuestion prompt. Option 1 has scrolled off the
// top, so the visible run starts at 2 — insisting on 1 found nothing at all.
const scrolled = [
  '❯ 2. Natural, calm, balanced.',
  '  3. Blue',
  '  4. Type something.',
  '  5. Chat about this',
  'Enter to select · ↑/↓ to navigate · Esc to cancel',
].join('\n');
const scrolledOpts = parseOptions(scrolled);
assert.ok(scrolledOpts, 'a scrolled menu is still a menu');
assert.deepStrictEqual(scrolledOpts.items.map((i) => i.key), ['2', '3', '4', '5'],
  'keys are what the TUI shows, so tapping sends the right number');

// Checkbox rows mean more than one answer is allowed.
const multi = [
  'Which of these apply?',
  '❯ ◉ 1. First',
  '  ◯ 2. Second',
  '  ◯ 3. Third',
  'Enter to confirm · Esc to cancel',
].join('\n');
assert.strictEqual(parseOptions(multi) && parseOptions(multi).type, 'multi',
  'checkboxes make it a multi-select, not a pick-one');

assert.deepStrictEqual(parseOptions('Delete the branch? (y/n)'), { type: 'yesno' });
assert.strictEqual(
  parseOptions('I changed three things.\n1. Bumped the limit\n2. Moved the check\n3. Added a test\nAll done.'),
  null, 'a prose list is not a menu');

console.log('options: ok');
