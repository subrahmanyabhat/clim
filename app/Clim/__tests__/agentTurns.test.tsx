/**
 * Codex and Hermes have no transcript, so their screen is parsed into turns.
 * The two fixtures below are real screens, captured off the real CLIs through
 * lib/screen.js — not hand-written approximations of them.
 */
import { describe, it, expect } from '@jest/globals';
import { parseAgentTurns } from '../App';

const CODEX_SCREEN = [
  '',
  '╭─────────────────────────────────────────────╮',
  '│ >_ OpenAI Codex (v0.147.0)                  │',
  '│                                             │',
  '│ model:     gpt-5.6-terra   /model to change │',
  '│ directory: /private/tmp                     │',
  '╰─────────────────────────────────────────────╯',
  '',
  '› reply with exactly: hello',
  '',
  '',
  '• hello',
  '',
  '',
  '› Implement {feature}',
  '',
  '  gpt-5.6-terra default · /private/tmp',
].join('\n');

const HERMES_SCREEN = [
  '╭─── Hermes Agent v0.19.1 (2026.7.30) · upstream 2ddd24ec ────╮',
  '│                       Available Tools                        │',
  '│  browser: browser_back, browser_click, ...                   │',
  '│  34 tools · 71 skills · /help for commands                   │',
  '╰──────────────────────────────────────────────────────────────╯',
  '',
  'Welcome to Hermes Agent! Type your message or /help for commands.',
  '✦ Tip: /voice on enables voice mode in the CLI.',
  '',
  '────────────────────────────────────────',
  '● reply with exactly: hello',
  'Initializing agent...',
  '────────────────────────────────────────',
  '',
  '╭─ ⚕ Hermes ───────────────────────────────────────────────────╮',
  'hello',
  '╰──────────────────────────────────────────────────────────────╯',
  ' ⚕ hy3:free │ 19.9K/262.1K │ [█░░░░░░░░░] 8% │ 12s │ ⏲ 6s │ ✓ 0s',
  '────────────────────────────────────────',
  '❯',
].join('\n');

describe('parseAgentTurns', () => {
  it('reads codex turns and drops the banner, composer and status line', () => {
    const turns = parseAgentTurns(CODEX_SCREEN, 'codex');
    expect(turns).toEqual([
      { role: 'user', text: 'reply with exactly: hello' },
      { role: 'assistant', text: 'hello' },
    ]);
  });

  it('reads hermes turns and drops the banner, tip, meter and composer', () => {
    const turns = parseAgentTurns(HERMES_SCREEN, 'hermes');
    expect(turns).toEqual([
      { role: 'user', text: 'reply with exactly: hello' },
      { role: 'assistant', text: 'hello' },
    ]);
  });

  it('never invents turns for a tool it does not know', () => {
    expect(parseAgentTurns(CODEX_SCREEN, 'bash')).toBeNull();
    expect(parseAgentTurns(CODEX_SCREEN, undefined)).toBeNull();
  });

  it('returns null for a screen with nothing but furniture on it', () => {
    const idle = ['╭────────╮', '│ Codex  │', '╰────────╯', '', '› Implement {feature}'].join('\n');
    expect(parseAgentTurns(idle, 'codex')).toBeNull();
  });
});

describe('parseAgentTurns wrapping', () => {
  it('drops the indent a wrapped turn shares, keeping relative indent', () => {
    const screen = [
      '› ship it',
      '',
      '• Done. The exporter now writes',
      '    one object per record, and',
      '    the table stays the default.',
      '',
      '› Implement {feature}',
      '  gpt-5.6-terra default · /tmp',
    ].join('\n');
    const turns = parseAgentTurns(screen, 'codex')!;
    expect(turns[1].text).toBe(
      'Done. The exporter now writes\none object per record, and\nthe table stays the default.');
  });
});
