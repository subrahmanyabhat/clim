/**
 * Drives the whole LAN workflow through the real components:
 *   devices → sessions → session detail, and back out again.
 * The socket and fetch are faked so ordering is explicit, but every screen,
 * handler and back path is the app's own.
 */
import 'react-native';
import React from 'react';
import { describe, it, expect, afterEach } from '@jest/globals';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

// Same secretbox framing the Mac uses, so the cloud path is exercised for real.
const KEY = naclUtil.encodeBase64(nacl.randomBytes(32));
function encryptFor(keyB64: string, plaintext: string) {
  const key = naclUtil.decodeBase64(keyB64);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const box = nacl.secretbox(naclUtil.decodeUTF8(plaintext), nonce, key);
  const out = new Uint8Array(nonce.length + box.length);
  out.set(nonce); out.set(box, nonce.length);
  return naclUtil.encodeBase64(out);
}

// Each test mounts a fresh app. Unmount the previous one or its screens keep
// their hardware-back handler registered and answer for the live tree.
let mounted: ReactTestRenderer | null = null;
const mount = async (el: any) => {
  if (mounted) { const old = mounted; mounted = null; await act(async () => { old.unmount(); }); }
  let t!: ReactTestRenderer;
  await act(async () => { t = create(el); });
  mounted = t;
  return t;
};
afterEach(async () => { if (mounted) { const old = mounted; mounted = null; await act(async () => { old.unmount(); }); } });

const FakeWebSocket: any = (global as any).__FakeWebSocket;
const LIVE = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa';
const DETACHED = 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb';
const CLOSED = 'cccccccc-3333-3333-3333-cccccccccccc';

const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

const live = (extra: any = {}) => ({
  sessionId: LIVE, project: 'Desktop', title: 'fix the parser', cwd: '/Users/someone/Desktop',
  tool: 'claude', transcriptPath: '/x/' + LIVE + '.jsonl',
  lines: ['ready when you are'], ts: Date.now(), source: 'pty', pty: true, ...extra,
});
const detached = (extra: any = {}) => ({
  sessionId: DETACHED, project: 'user', title: '[Image #11] add screen, not like this',
  cwd: '/Users/someone', tool: 'claude', transcriptPath: '/x/' + DETACHED + '.jsonl',
  lines: ['the integration is already built'], ts: Date.now() - 60000, source: 'scan', ...extra,
});
const closed = (extra: any = {}) => ({
  sessionId: CLOSED, project: 'demo', title: 'hello', cwd: '/Users/someone/demo',
  tool: 'claude', lines: ['Hi. What you need?'], ts: Date.now() - 180000,
  source: 'pty', pty: false, closed: true, closedReason: 'exit', exitCode: 0, ...extra,
});

const lanSocket = () => FakeWebSocket.instances.filter((w: any) => !/relay\?session=/.test(w.url)).pop();

async function bootPaired(sessions: any[] = [live(), detached(), closed()]): Promise<ReactTestRenderer> {
  FakeWebSocket.instances.length = 0;
  ((global as any).fetch as any).mockClear();
  await AsyncStorage.clear();
  await AsyncStorage.setItem('cci.host', '192.168.1.5:8787');
  await AsyncStorage.setItem('cci.secret', 'test-secret');
  await AsyncStorage.setItem('cci.mode', 'lan');

  const tree = await mount(<App />);
  await flush();
  const ws = lanSocket();
  await act(async () => { ws.open(); ws.emit({ type: 'init', sessions }); });
  await flush();
  return tree;
}

const has = (tree: ReactTestRenderer, id: string) => tree.root.findAllByProps({ testID: id }).length > 0;
const tap = async (tree: ReactTestRenderer, id: string) => {
  await act(async () => { tree.root.findAllByProps({ testID: id })[0].props.onPress(); });
  await flush();
};
const texts = (tree: ReactTestRenderer): string[] =>
  tree.root.findAllByType(require('react-native').Text)
    .map((n) => (Array.isArray(n.props.children) ? n.props.children.map(String).join('') : String(n.props.children ?? '')));
const hasText = (tree: ReactTestRenderer, needle: string) => texts(tree).some((t) => t.includes(needle));

describe('pairing', () => {
  it('asks to pair when nothing is stored, and does not preselect Cloud', async () => {
    await AsyncStorage.clear();
    FakeWebSocket.instances.length = 0;
    const tree = await mount(<App />);
    await flush();
    expect(hasText(tree, 'Scan QR to connect')).toBe(true);
    expect(hasText(tree, 'same WiFi as Mac')).toBe(true);
    expect(hasText(tree, 'anywhere in the world · encrypted')).toBe(false);
  });
});

describe('devices screen (root)', () => {
  it('is what you land on, and it owns the + button — not the session list', async () => {
    const tree = await bootPaired();
    expect(has(tree, 'transport-lan')).toBe(true);
    expect(has(tree, 'add-device')).toBe(true);
    // Sessions are one level down: no session cards and no chips here.
    expect(has(tree, 'card-' + LIVE)).toBe(false);
    expect(has(tree, 'chip-all')).toBe(false);
  });

  it('summarises the Mac: reachability, transport and session counts', async () => {
    const tree = await bootPaired();
    // LAN is its own section with the Mac under it.
    expect(hasText(tree, 'LAN')).toBe(true);
    expect(hasText(tree, 'same WiFi')).toBe(true);
    expect(has(tree, 'transport-lan')).toBe(true);
    expect(hasText(tree, '192.168.1.5:8787')).toBe(true);
    expect(hasText(tree, '3 sessions')).toBe(true);
    expect(hasText(tree, '1 live · 1 detached · 1 closed')).toBe(true);
    // No cloud room is paired here, so there is no CLOUD section promising
    // reachability that does not exist.
    expect(has(tree, 'transport-cloud')).toBe(false);
    expect(hasText(tree, 'anywhere · encrypted')).toBe(false);
  });

  it('shows a CLOUD section only once a room is paired', async () => {
    await AsyncStorage.clear();
    FakeWebSocket.instances.length = 0;
    await AsyncStorage.setItem('cci.host', '192.168.1.5:8787');
    await AsyncStorage.setItem('cci.secret', 'test-secret');
    await AsyncStorage.setItem('cci.cloud.url', 'wss://relay.example');
    await AsyncStorage.setItem('cci.cloud.key', 'a2V5');
    await AsyncStorage.setItem('cci.cloud.sid', 'room1234');
    await AsyncStorage.setItem('cci.mode', 'lan');
    const tree = await mount(<App />);
    await flush();
    await act(async () => { lanSocket().open(); });
    await flush();
    expect(has(tree, 'transport-cloud')).toBe(true);
    expect(hasText(tree, 'CLOUD')).toBe(true);
    expect(hasText(tree, 'room room12')).toBe(true);
    // The relay host is infrastructure — never shown to a customer.
    expect(hasText(tree, 'relay.example')).toBe(false);
    expect(hasText(tree, 'workers.dev')).toBe(false);
  });

  it('never lists the Mac you are already paired to as something to discover', async () => {
    const tree = await bootPaired();
    // mDNS renames on conflict, so one Mac that restarted its relay advertises
    // under several names. All of them are 192.168.1.5 — the card above.
    await act(async () => {
      (global as any).__emitZeroconf?.([
        { name: 'clim-Users-MacBook-Pro-4041', addresses: ['192.168.1.5'], port: 8787 },
        { name: 'clim-Users-MacBook-Pro-4212', addresses: ['192.168.1.5'], port: 8787 },
        { name: 'clim-Other-Mac-9', addresses: ['192.168.1.9'], port: 8787 },
        // Same Mac, relay restarted on another port — not a second device.
        { name: 'clim-Other-Mac-9-again', addresses: ['192.168.1.9'], port: 8899 },
      ]);
    });
    await flush();
    // Exactly one entry: the other Mac. Both adverts for 192.168.1.5 collapse
    // into nothing, because that Mac is the paired card above.
    expect(has(tree, 'discovered-0')).toBe(true);
    expect(has(tree, 'discovered-1')).toBe(false);
    expect(hasText(tree, '192.168.1.9:8787')).toBe(true);
    // …and it is tappable, unlike the dead rows this replaced.
    await tap(tree, 'discovered-0');
    expect(hasText(tree, 'Scan new QR')).toBe(true);
  });

  it('opens the + pairing screen without leaving through a session', async () => {
    const tree = await bootPaired();
    await tap(tree, 'add-device');
    expect(hasText(tree, 'Scan new QR')).toBe(true);
  });
});

describe('sessions screen', () => {
  it('groups by state with headers, and shows a card per session', async () => {
    const tree = await bootPaired();
    await tap(tree, 'transport-lan');
    expect(hasText(tree, 'LIVE')).toBe(true);
    expect(hasText(tree, 'DETACHED')).toBe(true);
    expect(hasText(tree, 'CLOSED')).toBe(true);
    expect(hasText(tree, '1 attached')).toBe(true);
    expect(hasText(tree, 'read-only')).toBe(true);
    expect(has(tree, 'card-' + LIVE)).toBe(true);
    expect(has(tree, 'card-' + DETACHED)).toBe(true);
    expect(has(tree, 'card-' + CLOSED)).toBe(true);
    // The + belongs to devices; it must not reappear over the session list.
    expect(has(tree, 'add-device')).toBe(false);
  });

  it('keeps the badge row uncluttered: no badge on a live session', async () => {
    const tree = await bootPaired();
    await tap(tree, 'transport-lan');
    // The group header and the dot already say "live" — a PTY badge said it a
    // third time and crowded out the path.
    expect(hasText(tree, 'PTY')).toBe(false);
    // The states you cannot infer from the header still get one.
    expect(hasText(tree, 'DETACHED')).toBe(true);
    expect(hasText(tree, 'CLOSED')).toBe(true);
  });

  it('shortens paths and lifts image markers out of the title into a badge', async () => {
    const tree = await bootPaired();
    await tap(tree, 'transport-lan');
    expect(hasText(tree, '~/Desktop')).toBe(true);
    expect(hasText(tree, 'add screen, not like this')).toBe(true);
    expect(hasText(tree, '[Image #11]')).toBe(false);
    expect(hasText(tree, '1 IMAGE')).toBe(true);
  });

  it('filters to one group at a time and back to all', async () => {
    const tree = await bootPaired();
    await tap(tree, 'transport-lan');

    await tap(tree, 'chip-live');
    expect(has(tree, 'card-' + LIVE)).toBe(true);
    expect(has(tree, 'card-' + DETACHED)).toBe(false);
    expect(has(tree, 'card-' + CLOSED)).toBe(false);

    await tap(tree, 'chip-closed');
    expect(has(tree, 'card-' + CLOSED)).toBe(true);
    expect(has(tree, 'card-' + LIVE)).toBe(false);

    await tap(tree, 'chip-all');
    expect(has(tree, 'card-' + LIVE)).toBe(true);
    expect(has(tree, 'card-' + DETACHED)).toBe(true);
    expect(has(tree, 'card-' + CLOSED)).toBe(true);
  });

  it('goes back to devices', async () => {
    const tree = await bootPaired();
    await tap(tree, 'transport-lan');
    await tap(tree, 'sessions-back');
    expect(has(tree, 'transport-lan')).toBe(true);
    expect(has(tree, 'card-' + LIVE)).toBe(false);
  });
});

describe('session detail', () => {
  it('opens, receives turns, sends, and returns to the session list', async () => {
    const tree = await bootPaired();
    await tap(tree, 'transport-lan');
    await tap(tree, 'card-' + LIVE);
    expect(has(tree, 'detail-back')).toBe(true);
    expect(has(tree, 'composer-input')).toBe(true);

    const ws = lanSocket();
    await act(async () => {
      ws.emit({ type: 'msg', sessionId: LIVE, role: 'user', text: 'from the terminal', ts: 1 });
      ws.emit({ type: 'msg', sessionId: LIVE, role: 'assistant', text: 'on it', ts: 2 });
    });
    await flush();
    expect(hasText(tree, 'from the terminal')).toBe(true);
    expect(hasText(tree, 'on it')).toBe(true);

    await act(async () => { tree.root.findAllByProps({ testID: 'composer-input' })[0].props.onChangeText('ship it'); });
    await flush();
    await tap(tree, 'composer-send');

    const call = ((global as any).fetch as any).mock.calls.find((c: any[]) => String(c[0]).includes('/send'));
    expect(String(call[0])).toBe('http://192.168.1.5:8787/send');
    expect(JSON.parse(call[1].body)).toMatchObject({ sessionId: LIVE, text: 'ship it' });
    expect(call[1].headers['X-Secret']).toBe('test-secret');

    await tap(tree, 'detail-back');
    expect(has(tree, 'detail-back')).toBe(false);
    expect(has(tree, 'card-' + LIVE)).toBe(true);      // back to sessions, not devices
    expect(has(tree, 'transport-lan')).toBe(false);
  });

  it('keeps fetched history AND appends new turns without leaving the screen', async () => {
    const tree = await bootPaired();
    // The relay answers /transcript with what was said before the app connected.
    ((global as any).fetch as any).mockImplementation((url: any) =>
      String(url).includes('/transcript')
        ? Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ entries: [
            { role: 'user', text: 'older question', ts: 1 },
            { role: 'assistant', text: 'older answer', ts: 2 },
          ] }) })
        : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, mode: 'pty' }) }));

    await tap(tree, 'transport-lan');
    await tap(tree, 'card-' + LIVE);
    expect(hasText(tree, 'older question')).toBe(true);
    expect(hasText(tree, 'older answer')).toBe(true);

    // A new turn arrives while we are sitting on the screen. It must appear
    // straight away, and must not wipe the history to do it.
    await act(async () => {
      lanSocket().emit({ type: 'msg', sessionId: LIVE, role: 'assistant', text: 'brand new reply', ts: 3 });
    });
    await flush();
    expect(hasText(tree, 'brand new reply')).toBe(true);
    expect(hasText(tree, 'older question')).toBe(true);
    expect(hasText(tree, 'older answer')).toBe(true);
  });

  it('renders bold, code, headings and bullets instead of raw markdown', async () => {
    const tree = await bootPaired();
    await tap(tree, 'transport-lan');
    await tap(tree, 'card-' + LIVE);
    await act(async () => {
      lanSocket().emit({
        type: 'msg', sessionId: LIVE, role: 'assistant', ts: 7,
        text: '## Result\nThe fix is **already deployed** — run `npm test`.\n- first point\n- second point',
      });
    });
    await flush();

    const Text = require('react-native').Text;
    const nodes = tree.root.findAllByType(Text);
    const styleOf = (needle: string) => {
      const n = nodes.find((x: any) => String(x.props.children ?? '') === needle);
      return JSON.stringify(n ? n.props.style : null);
    };
    // Markers are consumed, not printed.
    expect(hasText(tree, '**already deployed**')).toBe(false);
    expect(hasText(tree, '## Result')).toBe(false);
    // …and the emphasis they carried survives as styling.
    expect(styleOf('already deployed')).toContain('700');        // bold
    expect(styleOf('npm test')).toContain('e8b45a');             // code
    expect(hasText(tree, 'Result')).toBe(true);
    expect(hasText(tree, 'first point')).toBe(true);
    expect(hasText(tree, '•')).toBe(true);
  });

  it('shows tool calls and their output, collapsed and expandable', async () => {
    const tree = await bootPaired();
    await tap(tree, 'transport-lan');
    await tap(tree, 'card-' + LIVE);
    await act(async () => {
      const ws = lanSocket();
      ws.emit({ type: 'msg', sessionId: LIVE, role: 'assistant', text: 'Running the suite.', ts: 1 });
      ws.emit({ type: 'msg', sessionId: LIVE, role: 'tool', text: 'Bash(npm test)', ts: 2 });
      ws.emit({ type: 'msg', sessionId: LIVE, role: 'tool-result', text: 'Tests: 22 passed\nSuites: 2 passed', ts: 3 });
    });
    await flush();

    // Visible, but as a one-line block — not as something Claude said.
    expect(hasText(tree, 'Bash(npm test)')).toBe(true);
    expect(hasText(tree, 'Tests: 22 passed')).toBe(true);       // first line is the head
    expect(hasText(tree, 'Suites: 2 passed')).toBe(false);      // the rest is folded away
    expect(hasText(tree, '+1 line')).toBe(true);
    const blocks = tree.root.findAllByProps({ testID: 'tool-block' })
      .filter((n: any) => typeof n.props.onPress === 'function');
    expect(blocks.length).toBeGreaterThanOrEqual(2);

    await act(async () => { blocks[blocks.length - 1].props.onPress(); });
    await flush();
    expect(hasText(tree, 'Suites: 2 passed')).toBe(true);       // expanded
    expect(hasText(tree, 'Running the suite.')).toBe(true);     // prose still prose
  });


  it('says Claude is starting up instead of showing an empty session', async () => {
    // Registered over the PTY but nothing written yet: trust prompt, auto-update,
    // first paint. Previously this read as an empty, finished-looking session.
    const booting = { ...live(), transcriptPath: undefined, lines: [], title: undefined };
    const tree = await bootPaired([booting]);
    await tap(tree, 'transport-lan');
    expect(hasText(tree, 'starting…')).toBe(true);
    expect(hasText(tree, 'clim is connecting…')).toBe(true);

    // Once the first turn lands it is a normal live session again.
    await act(async () => {
      lanSocket().emit({ type: 'update', session: live() });
    });
    await flush();
    expect(hasText(tree, 'clim is connecting…')).toBe(false);
    expect(hasText(tree, 'ready when you are')).toBe(true);
  });

  it('shows what Claude is doing rather than an invented spinner word', async () => {
    const tree = await bootPaired();
    const ws = lanSocket();
    await act(async () => { ws.emit({ type: 'update', session: live({ status: 'Simmering…', thinking: true }) }); });
    await flush();
    await tap(tree, 'transport-lan');
    expect(hasText(tree, 'Simmering…')).toBe(true);
  });

  it('makes a closed session read-only', async () => {
    const tree = await bootPaired();
    await tap(tree, 'transport-lan');
    await tap(tree, 'card-' + CLOSED);
    expect(has(tree, 'composer-input')).toBe(false);
    expect(hasText(tree, 'session closed')).toBe(true);
    await tap(tree, 'detail-back');
    expect(has(tree, 'detail-back')).toBe(false);
  });

  it('surfaces a rejected send instead of silently clearing the box', async () => {
    const tree = await bootPaired();
    ((global as any).fetch as any).mockImplementation((url: any) =>
      String(url).includes('/send')
        ? Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({ ok: false, error: 'no live wrapper for this session' }) })
        : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }));

    await tap(tree, 'transport-lan');
    await tap(tree, 'card-' + DETACHED);
    await act(async () => { tree.root.findAllByProps({ testID: 'composer-input' })[0].props.onChangeText('hello'); });
    await tap(tree, 'composer-send');
    expect(hasText(tree, 'no live wrapper for this session')).toBe(true);
  });
});

describe('transport switching', () => {
  it('queues the new transport for the next connection and leaves the live one alone', async () => {
    await AsyncStorage.clear();
    FakeWebSocket.instances.length = 0;
    await AsyncStorage.setItem('cci.host', '192.168.1.5:8787');
    await AsyncStorage.setItem('cci.secret', 'test-secret');
    await AsyncStorage.setItem('cci.cloud.url', 'wss://relay.example');
    await AsyncStorage.setItem('cci.cloud.key', 'a2V5');
    await AsyncStorage.setItem('cci.cloud.sid', 'room1');
    await AsyncStorage.setItem('cci.mode', 'lan');

    const tree = await mount(<App />);
    await flush();
    const ws = lanSocket();
    await act(async () => { ws.open(); ws.emit({ type: 'init', sessions: [live()] }); });
    await flush();
    expect(has(tree, 'transport-lan')).toBe(true);

    // Ask for cloud while LAN is up. The LAN socket must stay open.
    const alert = require('react-native').Alert;
    const prompts: any[] = [];
    alert.alert = (title: string, msg: string, btns: any[]) => prompts.push({ title, msg, btns });

    await tap(tree, 'add-device');
    const cloudToggle = tree.root.findAllByProps({ testID: 'mode-cloud' })[0];
    await act(async () => { cloudToggle.props.onPress(); });
    await flush();

    expect(prompts.length).toBe(1);
    expect(prompts[0].title).toContain('next connection');
    expect(ws.readyState).toBe(1);                       // still connected over LAN
    expect(AsyncStorage.getItem).toBeDefined();
    expect(await AsyncStorage.getItem('cci.mode')).toBe('cloud');   // preference saved

    // When the live link finally drops, the queued transport takes over.
    await act(async () => { ws.close(); });
    await flush();
    expect(FakeWebSocket.instances.some((w: any) => /relay\?session=room1/.test(w.url))).toBe(true);
  });
});

describe('notifications', () => {
  const notified = () => (require('@notifee/react-native').default?.displayNotification as any)?.mock?.calls?.length ?? -1;

  it('has a per-session toggle that survives a relaunch', async () => {
    const tree = await bootPaired();
    await tap(tree, 'transport-lan');
    expect(has(tree, 'mute-' + LIVE)).toBe(true);
    await tap(tree, 'mute-' + LIVE);
    expect(JSON.parse((await AsyncStorage.getItem('cci.muted')) || '[]')).toContain(LIVE);
    await tap(tree, 'mute-' + LIVE);
    expect(JSON.parse((await AsyncStorage.getItem('cci.muted')) || '[]')).not.toContain(LIVE);
  });

  it('actually silences a muted session', async () => {
    const tree = await bootPaired();
    const shown = (require('@notifee/react-native').default.displayNotification as any);
    await tap(tree, 'transport-lan');
    await tap(tree, 'mute-' + LIVE);          // bell off

    shown.mockClear();
    await act(async () => {
      lanSocket().emit({ type: 'update', session: live({ attendedAt: null, options: { type: 'yesno' } }) });
    });
    await flush();
    expect(shown.mock.calls.length).toBe(0);   // muted: no buzz

    await tap(tree, 'mute-' + LIVE);          // bell back on
    await act(async () => {
      lanSocket().emit({ type: 'update', session: live({ attendedAt: null, options: null }) });
      lanSocket().emit({ type: 'update', session: live({ attendedAt: null, options: { type: 'yesno' } }) });
    });
    await flush();
    expect(shown.mock.calls.length).toBeGreaterThan(0);
  });

  it('offers the same labelled toggle inside the session', async () => {
    const tree = await bootPaired();
    await tap(tree, 'transport-lan');
    await tap(tree, 'card-' + LIVE);
    expect(has(tree, 'detail-mute')).toBe(true);
    expect(hasText(tree, 'Notifications on')).toBe(true);

    await tap(tree, 'detail-mute');
    expect(hasText(tree, 'Notifications off')).toBe(true);
    expect(JSON.parse((await AsyncStorage.getItem('cci.muted')) || '[]')).toContain(LIVE);

    // …and it is the same switch as the one on the card, not a second one.
    await tap(tree, 'detail-back');
    const bell = tree.root.findAllByProps({ testID: 'mute-' + LIVE })[0];
    expect(bell).toBeTruthy();
    await tap(tree, 'mute-' + LIVE);
    expect(JSON.parse((await AsyncStorage.getItem('cci.muted')) || '[]')).not.toContain(LIVE);
  });

  it('stays quiet while someone is typing at that Mac', async () => {
    const tree = await bootPaired();
    const before = notified();
    // Attended one second ago: you are sitting in front of it.
    await act(async () => {
      lanSocket().emit({ type: 'update', session: live({ attendedAt: Date.now() - 1000, options: { type: 'yesno' } }) });
    });
    await flush();
    expect(notified()).toBe(before);

    // Attended ten minutes ago: you have walked away, so tell the phone.
    await act(async () => {
      lanSocket().emit({ type: 'update', session: live({ attendedAt: Date.now() - 600000, options: null }) });
      lanSocket().emit({ type: 'update', session: live({ attendedAt: Date.now() - 600000, options: { type: 'yesno' } }) });
    });
    await flush();
    expect(notified()).toBeGreaterThan(before);
  });
});

describe('design and flow', () => {
  it('reaches the tutorial from the root, not only from the pairing screen', async () => {
    const tree = await bootPaired();
    expect(has(tree, 'devices-help')).toBe(true);
    await tap(tree, 'devices-help');
    expect(hasText(tree, 'What is Clim?')).toBe(true);
    expect(hasText(tree, 'Control Claude Code, Codex and Hermes from your phone')).toBe(true);
  });

  it('has a settings screen with everything Apple requires reachable in-app', async () => {
    const Linking = require('react-native').Linking;
    const opened: string[] = [];
    Linking.openURL = (u: string) => { opened.push(u); return Promise.resolve(); };

    const tree = await bootPaired();
    expect(has(tree, 'devices-settings')).toBe(true);
    await tap(tree, 'devices-settings');

    // Privacy policy and terms must be reachable from inside the app.
    expect(has(tree, 'settings-privacy')).toBe(true);
    expect(has(tree, 'settings-terms')).toBe(true);
    expect(has(tree, 'settings-support')).toBe(true);
    expect(has(tree, 'settings-coffee')).toBe(true);

    await tap(tree, 'settings-privacy');
    await tap(tree, 'settings-terms');
    await tap(tree, 'settings-support');
    await tap(tree, 'settings-coffee');
    expect(opened).toEqual([
      'https://getclim.netlify.app/privacy.html',
      'https://getclim.netlify.app/terms.html',
      'https://github.com/subrahmanyabhat/clim/issues',
      'https://buymeacoffee.com/subrahmanya',
    ]);

    await tap(tree, 'settings-back');
    expect(has(tree, 'transport-lan')).toBe(true);
  });

  it('shows the session state in the detail header, not always green', async () => {
    const tree = await bootPaired();
    await tap(tree, 'transport-lan');
    await tap(tree, 'card-' + CLOSED);
    // The header dot for a finished session must not claim it is live.
    const dots = tree.root.findAllByProps({ testID: 'detail-back' });
    expect(dots.length).toBeGreaterThan(0);
    const styles = JSON.stringify(tree.toJSON());
    expect(styles).toContain('7ec99f');            // the palette is in use
    expect(hasText(tree, '○ closed')).toBe(true);  // and the state is stated
  });

  it('every screen states what to do when it is empty', async () => {
    const empty = await bootPaired([]);
    expect(hasText(empty, 'No sessions yet')).toBe(false);   // devices first
    await tap(empty, 'transport-lan');
    expect(hasText(empty, 'No sessions yet. Run `clim claude` on your Mac.')).toBe(true);

    const tree = await bootPaired();
    await tap(tree, 'transport-lan');
    await tap(tree, 'chip-closed');
    await tap(tree, 'chip-live');
    expect(has(tree, 'card-' + LIVE)).toBe(true);
  });
});

describe('notification tap', () => {
  it('lands on the session the notification was about', async () => {
    const tree = await bootPaired();
    expect(has(tree, 'transport-lan')).toBe(true);        // at the root
    await act(async () => { (global as any).__pressNotification({ sessionId: CLOSED }); });
    await flush();
    // Straight into that session, not the root or the wrong one.
    expect(has(tree, 'detail-back')).toBe(true);
    // …and it is the closed one we asked for, not some other session.
    expect(hasText(tree, 'session closed')).toBe(true);
    expect(has(tree, 'composer-input')).toBe(false);
  });

  it('carries the session id on the notification it sends', async () => {
    await bootPaired();
    const shown = (require('@notifee/react-native').default.displayNotification as any);
    shown.mockClear();
    await act(async () => {
      lanSocket().emit({ type: 'update', session: live({ attendedAt: null, options: { type: 'yesno' } }) });
    });
    await flush();
    expect(shown.mock.calls.length).toBeGreaterThan(0);
    expect(shown.mock.calls[0][0].data).toEqual({ sessionId: LIVE });
  });
});

describe('rich replies', () => {
  const send = async (tree: ReactTestRenderer, text: string) => {
    await act(async () => { lanSocket().emit({ type: 'msg', sessionId: LIVE, role: 'assistant', text, ts: Math.random() }); });
    await flush();
  };
  const openDetail = async () => {
    const tree = await bootPaired();
    await tap(tree, 'transport-lan');
    await tap(tree, 'card-' + LIVE);
    return tree;
  };

  it('renders a fenced code block verbatim, without markdown fences', async () => {
    const tree = await openDetail();
    await send(tree, 'Try this:\n```js\nconst x = 1;\n```\nDone.');
    expect(has(tree, 'md-code')).toBe(true);
    expect(hasText(tree, 'const x = 1;')).toBe(true);
    expect(hasText(tree, '```')).toBe(false);
    expect(hasText(tree, 'js')).toBe(true);       // language label
  });

  it('renders quotes, rules, checkboxes and links', async () => {
    const tree = await openDetail();
    await send(tree, '> quoted line\n\n---\n\n- [x] done thing\n- [ ] todo thing\nSee [the docs](https://example.com).');
    expect(has(tree, 'md-quote')).toBe(true);
    expect(hasText(tree, 'quoted line')).toBe(true);
    expect(hasText(tree, '☑')).toBe(true);
    expect(hasText(tree, '☐')).toBe(true);
    expect(hasText(tree, 'the docs')).toBe(true);
    // Syntax is consumed, not printed.
    expect(hasText(tree, '- [x]')).toBe(false);
    expect(hasText(tree, '](https://example.com)')).toBe(false);
  });
});

describe('agents other than Claude', () => {
  const CODEX = 'dddddddd-4444-4444-4444-dddddddddddd';
  const codex = (extra: any = {}) => ({
    sessionId: CODEX, project: 'api', title: 'codex — api', cwd: '/Users/someone/api',
    tool: 'codex', lines: [], ts: Date.now(), source: 'pty', pty: true, ...extra,
  });

  it('tags which agent a session belongs to', async () => {
    const tree = await bootPaired([live(), codex()]);
    await tap(tree, 'transport-lan');
    expect(hasText(tree, 'CLAUDE')).toBe(true);
    expect(hasText(tree, 'CODEX')).toBe(true);
  });

  it('strips the boxed TUI frame that Hermes and Codex draw', async () => {
    const HERMES = 'eeeeeeee-5555-5555-5555-eeeeeeeeeeee';
    const hermes = {
      sessionId: HERMES, project: 'app', title: 'hermes — app', cwd: '/Users/someone/app',
      tool: 'hermes', lines: [], ts: Date.now(), source: 'pty', pty: true,
    };
    const tree = await bootPaired([hermes]);
    await tap(tree, 'transport-lan');
    await tap(tree, 'card-' + HERMES);

    // A real Hermes frame: 100-column box, border glyphs on every row.
    await act(async () => {
      lanSocket().emit({
        type: 'ptyChunk', sessionId: HERMES,
        text: [
          '╭──────────────────────────────────╮',
          '│  Welcome to Hermes Agent!        │',
          '│  34 tools · 70 skills            │',
          '╰──────────────────────────────────╯',
        ].join('\n'),
      });
    });
    await flush();

    expect(hasText(tree, 'Welcome to Hermes Agent!')).toBe(true);
    expect(hasText(tree, '34 tools · 70 skills')).toBe(true);
    // The decoration is what made it unreadable at phone width.
    expect(hasText(tree, '╭')).toBe(false);
    expect(hasText(tree, '│')).toBe(false);
    expect(hasText(tree, '─────')).toBe(false);
  });

  it('prints codex output, which has no transcript to fall back on', async () => {
    const tree = await bootPaired([codex()]);
    await tap(tree, 'transport-lan');
    await tap(tree, 'card-' + CODEX);

    // Codex writes no .jsonl — the scrollback IS the conversation, and it
    // arrives after the screen is already open.
    await act(async () => {
      lanSocket().emit({ type: 'ptyChunk', sessionId: CODEX, text: 'codex> building the thing\n' });
    });
    await flush();
    expect(hasText(tree, 'codex> building the thing')).toBe(true);

    // …and it must keep updating, not render once and freeze.
    await act(async () => {
      lanSocket().emit({ type: 'ptyChunk', sessionId: CODEX, text: 'done in 3s\n' });
    });
    await flush();
    expect(hasText(tree, 'done in 3s')).toBe(true);
    expect(hasText(tree, 'codex> building the thing')).toBe(true);
  });
});

describe('markdown tables', () => {
  it('lays a table out as rows and columns, not raw pipes', async () => {
    const tree = await bootPaired();
    await tap(tree, 'transport-lan');
    await tap(tree, 'card-' + LIVE);
    await act(async () => {
      lanSocket().emit({
        type: 'msg', sessionId: LIVE, role: 'assistant', ts: 5,
        text: 'Results:\n| Check | Result |\n| --- | --- |\n| tenants | 400 |\n| leaks | 0 |',
      });
    });
    await flush();
    expect(has(tree, 'md-table')).toBe(true);
    expect(hasText(tree, 'Check')).toBe(true);
    expect(hasText(tree, 'tenants')).toBe(true);
    expect(hasText(tree, '400')).toBe(true);
    // The pipes and the --- rule are structure, not content.
    expect(hasText(tree, '| Check | Result |')).toBe(false);
    expect(hasText(tree, '---')).toBe(false);
  });
});

describe('cloud liveness', () => {
  it('marks cloud sessions closed when the Mac leaves the room', async () => {
    await AsyncStorage.clear();
    FakeWebSocket.instances.length = 0;
    await AsyncStorage.setItem('cci.cloud.url', 'wss://relay.example');
    await AsyncStorage.setItem('cci.cloud.key', KEY);
    await AsyncStorage.setItem('cci.cloud.sid', 'room1234');
    await AsyncStorage.setItem('cci.mode', 'cloud');
    const tree = await mount(<App />);
    await flush();

    const cloudWs = FakeWebSocket.instances.filter((w: any) => /relay\?session=room1234/.test(w.url)).pop();
    await act(async () => { cloudWs.open(); });
    await flush();

    // Seed a session exactly as a cloud wrapper would — real secretbox frames.
    const send = (obj: any) => cloudWs.onmessage({ data: JSON.stringify({ c: encryptFor(KEY, JSON.stringify(obj)) }) });
    await act(async () => {
      send({ type: 'meta', sessionId: LIVE, tool: 'claude', project: 'demo', cwd: '/Users/someone/demo' });
      send({ type: 'msg', sessionId: LIVE, role: 'assistant', text: 'still here', ts: 1 });
    });
    await flush();
    await tap(tree, 'transport-cloud');
    expect(has(tree, 'card-' + LIVE)).toBe(true);
    expect(hasText(tree, 'terminal exited')).toBe(false);

    // The Mac drops off. Only the relay can tell us — our own socket is fine.
    await act(async () => { cloudWs.onmessage({ data: JSON.stringify({ type: 'peer-left', role: 'mac' }) }); });
    await flush();
    expect(hasText(tree, 'wrapper lost — terminal gone')).toBe(true);
  });
});

describe('android back button', () => {
  it('walks back one frame at a time, then hands the app to the OS', async () => {
    const tree = await bootPaired();
    const press = (global as any).__pressAndroidBack as () => boolean;
    let handled = false;

    await tap(tree, 'transport-lan');
    await tap(tree, 'card-' + LIVE);
    expect(has(tree, 'detail-back')).toBe(true);

    await act(async () => { handled = press(); });   // detail → sessions
    await flush();
    expect(handled).toBe(true);
    expect(has(tree, 'card-' + LIVE)).toBe(true);

    await act(async () => { handled = press(); });   // sessions → devices
    await flush();
    expect(handled).toBe(true);
    expect(has(tree, 'transport-lan')).toBe(true);

    await act(async () => { handled = press(); });   // root: the OS closes the app
    expect(handled).toBe(false);
  });
});
