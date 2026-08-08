import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList, Pressable, ScrollView, StatusBar, StyleSheet,
  Text, TextInput, TouchableOpacity, View, Vibration, Alert, Platform,
  KeyboardAvoidingView, Keyboard, Modal, Image, BackHandler, Linking,
} from 'react-native';
const GLYPH = require('./glyph.png');
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
let Zeroconf: any = null;
try { Zeroconf = require('react-native-zeroconf').default; } catch {}
let notifee: any = null; let AndroidImportance: any = { HIGH: 4 };
try { const n = require('@notifee/react-native'); notifee = n.default; AndroidImportance = n.AndroidImportance; } catch {}
let nacl: any = null; let naclUtil: any = null;
try { nacl = require('tweetnacl'); naclUtil = require('tweetnacl-util'); } catch {}
let Svg: any = null, Path: any = null, Circle: any = null, Rect: any = null, Line: any = null;
try { const s = require('react-native-svg'); Svg = s.default; Path = s.Path; Circle = s.Circle; Rect = s.Rect; Line = s.Line; } catch {}

// One palette for every screen. Names, not hexes, so a new screen cannot
// quietly introduce a nineteenth grey — which is how this drifted to 55.
const C = {
  bg: '#0a0a0a',
  bar: '#0e0e0e',
  panel: '#111111',
  card: '#151515',
  raised: '#1a1a1a',
  hairline: '#1e1e1e',
  border: '#262626',
  borderMid: '#2a2a2a',
  borderStrong: '#333333',
  faint: '#4a4a4a',
  dim: '#545454',
  mute2: '#5a5a5a',
  tool: '#6f6f6f',
  mute: '#7a7a7a',
  body: '#c8c8c8',
  text: '#e8e8e8',
  white: '#ffffff',
  black: '#000000',
  brand: '#d97757',
  brandInk: '#1a0800',
  ok: '#7ec99f',
  warn: '#e8b45a',
  warnInk: '#1a1000',
  danger: '#e56b6b',
  info: '#6a99ff',
  okBorder: '#2f4a3a',
  okBorder2: '#294f36',
  okBg: '#0f1a13',
  dangerBorder: '#5a2a2a',
  userText: '#b8d8c4',
  codeText: '#c8d8c0',
  toolDim: '#6a6a6a',
  railLive: '#3f6b53',
  railDetached: '#6e4632',
  trafficRed: '#ff5f57',
  trafficAmber: '#febc2e',
  trafficGreen: '#28c840',
};

function Icon({ name, size = 22, color = C.text, stroke = 1.75 }: { name: string; size?: number; color?: string; stroke?: number }) {
  if (!Svg) return <Text style={{ color, fontSize: size }}>{'▢'}</Text>;
  const p = { stroke: color, strokeWidth: stroke, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'back' && <Path {...p} d="M15 18l-6-6 6-6" />}
      {/* The bare prompt. The full window mark is the app icon's job; at the
          size the pairing screen wanted it, the frame and the dots were most of
          the ink and the >_ was lost inside them. */}
      {name === 'prompt' && (<>
        <Path {...p} d="M4 6l6 6-6 6" />
        <Path {...p} d="M13 18h7" />
      </>)}
      {name === 'scan' && (<>
        <Path {...p} d="M3 8V5a2 2 0 0 1 2-2h3" />
        <Path {...p} d="M21 8V5a2 2 0 0 0-2-2h-3" />
        <Path {...p} d="M3 16v3a2 2 0 0 0 2 2h3" />
        <Path {...p} d="M21 16v3a2 2 0 0 1-2 2h-3" />
        <Line {...p} x1="7" y1="12" x2="17" y2="12" />
      </>)}
      {name === 'wifi' && (<>
        <Path {...p} d="M5 12.55a11 11 0 0 1 14 0" />
        <Path {...p} d="M1.42 9a16 16 0 0 1 21.16 0" />
        <Path {...p} d="M8.53 16.11a6 6 0 0 1 6.94 0" />
        <Circle {...p} cx="12" cy="20" r="1" />
      </>)}
      {name === 'cloud' && <Path {...p} d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />}
      {name === 'help' && (<>
        <Circle {...p} cx="12" cy="12" r="10" />
        <Path {...p} d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <Line {...p} x1="12" y1="17" x2="12.01" y2="17" />
      </>)}
      {name === 'check' && <Path {...p} d="M20 6L9 17l-5-5" />}
      {name === 'terminal' && (<>
        <Path {...p} d="M4 17l6-6-6-6" />
        <Line {...p} x1="12" y1="19" x2="20" y2="19" />
      </>)}
      {name === 'shield' && <Path {...p} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
      {name === 'zap' && <Path {...p} d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />}
      {name === 'x' && (<><Line {...p} x1="18" y1="6" x2="6" y2="18" /><Line {...p} x1="6" y1="6" x2="18" y2="18" /></>)}
      {name === 'arrowright' && <Path {...p} d="M5 12h14M13 6l6 6-6 6" />}
      {name === 'gear' && (<>
        <Circle {...p} cx="12" cy="12" r="3" />
        <Path {...p} d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>)}
      {name === 'bell' && (<>
        <Path {...p} d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <Path {...p} d="M13.73 21a2 2 0 0 1-3.46 0" />
      </>)}
      {name === 'bell-off' && (<>
        <Path {...p} d="M18 8a6 6 0 0 0-9.33-5" />
        <Path {...p} d="M6 8c0 7-3 9-3 9h13" />
        <Path {...p} d="M13.73 21a2 2 0 0 1-3.46 0" />
        <Line {...p} x1="3" y1="3" x2="21" y2="21" />
      </>)}
      {name === 'refresh' && (<>
        <Path {...p} d="M23 4v6h-6" />
        <Path {...p} d="M1 20v-6h6" />
        <Path {...p} d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
        <Path {...p} d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
      </>)}
    </Svg>
  );
}
let CameraScreen: any = null;
try { CameraScreen = require('react-native-camera-kit').Camera; } catch {}

function decryptCloud(keyB64: string, cipherB64: string): string | null {
  if (!nacl || !naclUtil) return null;
  try {
    const key = naclUtil.decodeBase64(keyB64);
    const bytes = naclUtil.decodeBase64(cipherB64);
    const nonce = bytes.slice(0, nacl.secretbox.nonceLength);
    const box = bytes.slice(nacl.secretbox.nonceLength);
    const plain = nacl.secretbox.open(box, nonce, key);
    return plain ? naclUtil.encodeUTF8(plain) : null;
  } catch { return null; }
}
function encryptCloud(keyB64: string, plaintext: string): string | null {
  if (!nacl || !naclUtil) return null;
  try {
    const key = naclUtil.decodeBase64(keyB64);
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const msg = naclUtil.decodeUTF8(plaintext);
    const box = nacl.secretbox(msg, nonce, key);
    const out = new Uint8Array(nonce.length + box.length);
    out.set(nonce); out.set(box, nonce.length);
    return naclUtil.encodeBase64(out);
  } catch { return null; }
}

const KEY_HOST = 'cci.host';
const KEY_SECRET = 'cci.secret';
const KEY_CLOUD_URL = 'cci.cloud.url';
const KEY_CLOUD_KEY = 'cci.cloud.key';
const KEY_CLOUD_SID = 'cci.cloud.sid';
const KEY_MODE = 'cci.mode';
const KEY_MUTED = 'cci.muted';
const APP_VERSION = 'v' + (require('./package.json').version || '0.1.0');
const LOADER_WORDS = ['Enchanting','Contemplating','Percolating','Ideating','Musing','Noodling','Pondering','Simmering','Thinking','Brewing','Conjuring','Weaving','Kindling'];

type Msg = { role: string; text: string; ts?: number | string | null };

type Session = {
  sessionId: string; project?: string; title?: string; cwd?: string;
  tool?: string; lines?: string[]; ts?: number; source?: string;
  messages?: Msg[]; raw?: string; screen?: string;
  options?: { type: string; items?: { key: string; label: string }[] } | null;
  transcriptPath?: string | null;
  tty?: string; terminalApp?: string; tmuxTarget?: string; pty?: boolean;
  running?: boolean; thinking?: boolean;
  closed?: boolean; closedReason?: string; exitCode?: number | null;
  sendError?: string;
  // Claude's live "working" line, lifted from the TUI on the Mac.
  status?: string | null;
  // When someone last typed at the Mac. A session you are sitting in front of
  // does not need to buzz your phone.
  attendedAt?: number | null;
};

let zc: any = null;
try { if (Zeroconf) zc = new Zeroconf(); } catch {}

const MSG_MAX = 200;

// Mirror of lib/ansi.js. Cursor-forward (ESC[nC) is how a TUI draws runs of
// spaces — expand it before stripping or every word glues to the next.
function stripAnsi(s: string): string {
  return String(s)
    .replace(/\x1b\[([0-9]*)C/g, (_m, n) => ' '.repeat(Math.min(parseInt(n || '1', 10) || 1, 200)))
    .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b[P^_][\s\S]*?\x1b\\/g, '')
    .replace(/\x1b\[[\x30-\x3f]*[\x20-\x2f]*[\x40-\x7e]/g, '')
    .replace(/\x1b[()][\x20-\x7e]/g, '')
    .replace(/\x1b[@-Z\\-_]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
}

// Does this assistant turn end in something tappable?
function parseOptions(text: string): Session['options'] {
  const nonEmpty = (text || '').split('\n').filter((l) => l.trim());
  const last = nonEmpty[nonEmpty.length - 1] || '';
  const tail = nonEmpty.slice(-8).join('\n');
  if (/\b(y\/n|yes\/no|\(y\/n\)|\(Y\/n\)|\(y\/N\))\b/i.test(last)) return { type: 'yesno' };
  if (/\?\s*$/.test(last) && /(approve|allow|permission|proceed|confirm|shall i|should i)/i.test(last)) return { type: 'approve' };
  const items: { key: string; label: string }[] = [];
  const window = nonEmpty.slice(-9);
  let expected = 1;
  let sawMarker = false;
  let firstIdx = -1;
  for (let i = 0; i < window.length; i++) {
    // A TUI menu marks the highlighted row ("❯ 1. Yes, I trust this folder").
    const m = window[i].match(/^\s*([❯>›»▸*•]\s*)?(\d+)[.)]\s+(.+?)\s*$/);
    if (m && parseInt(m[2], 10) === expected) {
      if (m[1]) sawMarker = true;
      if (firstIdx < 0) firstIdx = i;
      items.push({ key: m[2], label: m[3].slice(0, 80) });
      expected++;
    } else if (items.length > 0) break;
  }
  // Structure, not vocabulary: a question or colon on the line above item 1 is
  // what turns a numbered list into a prompt, whatever words were used.
  const lead = firstIdx > 0 ? window[firstIdx - 1].trim() : '';
  const isMenu = sawMarker || /[?:]\s*$/.test(lead) || /(enter to confirm|esc to cancel|use arrow keys)/i.test(tail);
  if (items.length >= 2 && isMenu) return { type: 'numbered', items };
  return null;
}

// One place where a real conversation message lands, whichever transport carried it.
function withMessage(prev: Record<string, Session>, sid: string, m: Msg, seed?: Partial<Session>): Record<string, Session> {
  const cur: Session = prev[sid] || { sessionId: sid, lines: [], ts: Date.now(), ...seed };
  const msgs = cur.messages || [];
  // The cloud relay stores nothing, so the Mac replays the whole conversation
  // whenever a peer joins or a socket flaps. Comparing only against the last
  // message let every replay append the entire history again.
  if (msgs.some((x) => x.role === m.role && x.text === m.text && x.ts === m.ts)) return prev;
  const messages = [...msgs, m].slice(-MSG_MAX);
  const isAssistant = m.role === 'assistant';
  return {
    ...prev,
    [sid]: {
      ...cur,
      messages,
      lines: isAssistant ? m.text.trim().split('\n').filter(Boolean).slice(-3) : cur.lines,
      options: isAssistant ? parseOptions(m.text) : null,
      thinking: !isAssistant,
      ts: Date.now(),
    },
  };
}

// Does this session have a real conversation behind it? Claude writes a .jsonl
// transcript, so the PTY stream is only the TUI repainting itself — box drawing,
// spinners, the input frame, token counters. That is the "background text": it
// must never reach the phone as content. Tools with no transcript (codex) have
// nothing but the terminal, so there the scrollback IS the conversation.
function isChatSession(s: Session): boolean {
  return !!s.transcriptPath || s.tool === 'claude';
}

// Raw PTY frames. Never rendered as chat — TUI repaints would produce one bubble
// per frame. Kept as terminal scrollback for tools with no transcript (e.g.
// codex), and only until real parsed messages start arriving.
function withRawChunk(prev: Record<string, Session>, sid: string, text: string, seed?: Partial<Session>): Record<string, Session> {
  const cur: Session = prev[sid] || { sessionId: sid, lines: [], ts: Date.now(), ...seed };
  if ((cur.messages || []).length) return { ...prev, [sid]: { ...cur, ts: Date.now() } };
  const raw = (cur.raw || '') + text;
  const trimmed = raw.length > 20000 ? raw.slice(-20000) : raw;
  return {
    ...prev,
    [sid]: { ...cur, raw: trimmed, options: parseOptions(stripAnsi(trimmed.slice(-2000))), ts: Date.now() },
  };
}

// The Mac side went away. Keep the card — "closed 4m ago" is information; a card
// that silently disappears is not — but stop pretending it can still be driven.
function withClosed(prev: Record<string, Session>, sid: string, reason?: string, exitCode?: number | null): Record<string, Session> {
  const cur: Session = prev[sid] || { sessionId: sid, lines: [], ts: Date.now() };
  return {
    ...prev,
    [sid]: { ...cur, closed: true, closedReason: reason || 'exit', exitCode: exitCode ?? null, thinking: false, running: false, options: null, ts: Date.now() },
  };
}

async function setupChannel() {
  try {
    if (!notifee) return;
    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: 'needs-input', name: 'Needs Input', importance: AndroidImportance.HIGH,
        sound: 'default', vibration: true,
      });
    }
  } catch {}
}
// Carry the session id so tapping the notification can land on the session it
// is about, rather than dumping you at the root to hunt for it.
async function notify(title: string, body: string, sessionId?: string) {
  try {
    if (!notifee) return;
    await notifee.requestPermission();
    await notifee.displayNotification({
      title, body,
      data: sessionId ? { sessionId } : undefined,
      android: { channelId: 'needs-input', importance: AndroidImportance.HIGH, pressAction: { id: 'default' } },
      ios: { sound: 'default' },
    });
  } catch {}
}

export default function App() {
  useEffect(() => { setupChannel(); }, []);
  return <SafeAreaProvider><StatusBar barStyle="light-content" backgroundColor={C.bg} /><SafeAreaView style={s.root} edges={['top','bottom']}><Main/></SafeAreaView></SafeAreaProvider>;
}

function Main() {
  const [host, setHost] = useState('');
  const [secret, setSecret] = useState('');
  const [connected, setConnected] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [sessions, setSessions] = useState<Record<string, Session>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  // devices → sessions → detail. The Mac you are driving is a real step in the
  // hierarchy, so pairing lives at the top and never on a session list.
  const [screen, setScreen] = useState<'devices' | 'sessions' | 'settings'>('devices');
  const [helpFromSettings, setHelpFromSettings] = useState(false);
  const [filter, setFilter] = useState<Bucket | 'all'>('all');
  const [showSetup, setShowSetup] = useState(false);
  const [word, setWord] = useState(LOADER_WORDS[0]);
  const [discovered, setDiscovered] = useState<{name:string;host:string;addr:string;port:number}[]>([]);
  const [lastErr, setLastErr] = useState<string>('');
  const [cloudUrl, setCloudUrl] = useState('');
  const [cloudKey, setCloudKey] = useState('');
  const [cloudSid, setCloudSid] = useState('');
  const [activeMode, setActiveMode] = useState<'lan' | 'cloud'>('lan');
  // Chosen transport for the next connection, while the current one stays up.
  const [pendingMode, setPendingMode] = useState<'lan' | 'cloud' | null>(null);
  // Per-session mute, kept across launches. Two reasons a session stays quiet:
  // you muted it, or someone is typing at that Mac right now.
  const [muted, setMuted] = useState<Record<string, boolean>>({});
  // The socket handlers are built once per connection, so reading `muted`
  // directly captured whatever it was at that moment — muting a session later
  // changed the icon but not the notifications. Read through a ref instead.
  const mutedRef = useRef<Record<string, boolean>>({});
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  const ATTENDED_MS = 60000;
  const shouldNotify = (s?: Session) =>
    !!s && !mutedRef.current[s.sessionId] && !(s.attendedAt && Date.now() - s.attendedAt < ATTENDED_MS);
  async function toggleMute(sessionId: string) {
    setMuted((prev) => {
      const next = { ...prev, [sessionId]: !prev[sessionId] };
      if (!next[sessionId]) delete next[sessionId];
      AsyncStorage.setItem(KEY_MUTED, JSON.stringify(Object.keys(next))).catch(() => {});
      return next;
    });
  }
  const wsRef = useRef<WebSocket | null>(null);
  const cloudWsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<any>(null);
  const cloudReconnectRef = useRef<any>(null);
  // Bumped on every (re)connect and on teardown. A socket whose generation is
  // stale must not schedule a reconnect — otherwise closing one socket spawns a
  // replacement while the new socket is already connecting, and they multiply.
  const genRef = useRef(0);
  const cloudGenRef = useRef(0);

  useEffect(() => {
    (async () => {
      const h = await AsyncStorage.getItem(KEY_HOST);
      const sec = await AsyncStorage.getItem(KEY_SECRET);
      const cu = await AsyncStorage.getItem(KEY_CLOUD_URL);
      const ck = await AsyncStorage.getItem(KEY_CLOUD_KEY);
      const cs = await AsyncStorage.getItem(KEY_CLOUD_SID);
      const m = await AsyncStorage.getItem(KEY_MODE);
      try {
        const raw = await AsyncStorage.getItem(KEY_MUTED);
        if (raw) setMuted(Object.fromEntries(JSON.parse(raw).map((id: string) => [id, true])));
      } catch {}
      if (h) setHost(h);
      if (sec) setSecret(sec);
      if (cu) setCloudUrl(cu);
      if (ck) setCloudKey(ck);
      if (cs) setCloudSid(cs);
      const hasLan = !!(h && sec);
      const hasCloud = !!(cu && ck && cs);
      if (m === 'cloud' || m === 'lan') setActiveMode(m);
      // Nothing paired yet is not a reason to preselect Cloud — that showed a
      // fresh install sitting in "Cloud · anywhere in the world" before any
      // pairing had happened. Cloud only wins when it is the one that IS paired.
      else setActiveMode(!hasLan && hasCloud ? 'cloud' : 'lan');
      if (!hasLan && !hasCloud) setShowSetup(true);
      startDiscovery();
      // trigger LAN permission + auto-fetch secret if empty
      if (h) {
        try {
          const r = await fetch('http://' + h + '/config');
          if (r.ok) {
            const j = await r.json();
            if (j.secret && !sec) { setSecret(j.secret); await AsyncStorage.setItem(KEY_SECRET, j.secret); }
          }
        } catch {}
      }
    })();
    const t = setInterval(() => setWord(LOADER_WORDS[Math.floor(Math.random() * LOADER_WORDS.length)]), 1800);
    return () => clearInterval(t);
  }, []);

  function startDiscovery() {
    try {
      if (!zc) return;
      zc.on('resolved', (svc: any) => {
        setDiscovered((prev) => {
          const port = svc.port;
          // Identify a Mac by the address it answers on, not by its advert name:
          // mDNS renames on conflict, so one Mac that has restarted its relay a
          // few times shows up as "…-4041", "…-4212", "…-2739" — all the same
          // machine, listed several times over.
          const addr = (svc.addresses || []).find((a: string) => /^\d+\.\d+\.\d+\.\d+$/.test(a))
            || (svc.txt && svc.txt.host) || svc.host;
          if (!addr) return prev;
          // One Mac is one entry. A relay restarted on another port is still
          // that same machine, so the address alone decides identity.
          if (prev.some((x) => x.addr === addr)) return prev;
          return [...prev, { name: svc.name, host: svc.host || addr, addr, port }];
        });
      });
      // Without this every relay restart leaves another card behind, all of them
      // claiming "● online" — the list only ever grew.
      zc.on('remove', (name: string) => {
        setDiscovered((prev) => prev.filter((x) => x.name !== name));
      });
      zc.on('error', () => {});
      zc.scan('clim', 'tcp', 'local.');
    } catch {}
  }
  useEffect(() => () => { try { zc && zc.stop(); } catch {} }, []);

  // Tapping a notification should land on the session it is about. Both paths
  // matter: the app already running (foreground event) and the app launched by
  // the tap (initial notification).
  useEffect(() => {
    if (!notifee) return;
    const open = (n: any) => {
      const sid = n?.notification?.data?.sessionId;
      if (!sid) return;
      setScreen('sessions');
      setFilter('all');
      setActiveId(String(sid));
    };
    let unsub: any;
    try {
      const { EventType } = require('@notifee/react-native');
      unsub = notifee.onForegroundEvent(({ type, detail }: any) => {
        if (type === EventType.PRESS) open(detail);
      });
      notifee.getInitialNotification?.().then((n: any) => { if (n) open(n); }).catch(() => {});
    } catch {}
    return () => { try { unsub && unsub(); } catch {} };
  }, []);

  // Android's system back button. Without this it falls through to the OS and
  // quits the app from inside a session or the pairing screen, instead of
  // stepping back one frame the way the on-screen "← back" does.
  useEffect(() => {
    const onBack = () => {
      if (activeId) { setActiveId(null); return true; }
      if (showSetup && (host || cloudUrl)) { setShowSetup(false); return true; }
      if (screen === 'sessions' || screen === 'settings') { setScreen('devices'); return true; }
      return false;   // nothing to go back to — let the system close the app
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => { try { sub.remove(); } catch { BackHandler.removeEventListener?.('hardwareBackPress', onBack); } };
  }, [activeId, showSetup, host, cloudUrl, screen]);

  useEffect(() => {
    const teardown = () => { genRef.current++; try { wsRef.current?.close(); } catch {} clearTimeout(reconnectRef.current); };
    if (activeMode !== 'lan') { teardown(); return; }
    if (!host || !secret) return;
    connect();
    return teardown;
  }, [host, secret, activeMode]);

  useEffect(() => {
    const teardown = () => { cloudGenRef.current++; try { cloudWsRef.current?.close(); } catch {} clearTimeout(cloudReconnectRef.current); };
    if (activeMode !== 'cloud') { teardown(); return; }
    if (!cloudUrl || !cloudKey || !cloudSid) return;
    connectCloud();
    return teardown;
  }, [cloudUrl, cloudKey, cloudSid, activeMode]);

  function connectCloud() {
    clearTimeout(cloudReconnectRef.current);
    const gen = ++cloudGenRef.current;
    if (cloudWsRef.current) try { cloudWsRef.current.close(); } catch {}
    const wss = (cloudUrl || '').replace(/^http/, 'ws').replace(/^wss?$/, 'wss');
    const url = wss + '/relay?session=' + encodeURIComponent(cloudSid) + '&role=phone';
    let ws: WebSocket;
    try { ws = new WebSocket(url); } catch { cloudReconnectRef.current = setTimeout(connectCloud, 2000); return; }
    cloudWsRef.current = ws;
    ws.onopen = () => { if (gen !== cloudGenRef.current) { try { ws.close(); } catch {} return; } setInitialized(true); setConnected(true); flushCloudQueue(); };
    ws.onclose = () => {
      if (gen !== cloudGenRef.current) return;
      setConnected(false);
      cloudReconnectRef.current = setTimeout(connectCloud, 2000);
    };
    ws.onerror = () => { if (gen === cloudGenRef.current) setConnected(false); };
    ws.onmessage = (ev: any) => {
      try {
        const wrap = JSON.parse(ev.data as any);
        // The Mac left the room. Over LAN the relay tells us; over cloud this is
        // the only signal there is — without it a dead session stayed "live" on
        // the phone indefinitely, because the phone's own socket is still fine.
        if (wrap.type === 'peer-left') {
          if (wrap.role === 'mac') {
            setSessions((prev) => {
              const next = { ...prev };
              for (const k of Object.keys(next)) {
                if (next[k].source === 'cloud' && !next[k].closed) {
                  next[k] = { ...next[k], closed: true, closedReason: 'disconnected', pty: false, thinking: false, status: null, options: null, ts: Date.now() };
                }
              }
              return next;
            });
          }
          return;
        }
        if (wrap.type === 'peer') return;
        if (!wrap.c) return;
        const plain = decryptCloud(cloudKey, wrap.c);
        if (!plain) return;
        const msg = JSON.parse(plain);
        // The room is shared by every session on that Mac. Key by the session's
        // own id so each gets its own card — and the same card LAN shows. Older
        // wrappers send no id; fall back to the room id so they still work.
        const sid = msg.sessionId || cloudSid;
        if (msg.type === 'meta') {
          setSessions((prev) => ({ ...prev, [sid]: {
            ...(prev[sid] || {}),
            sessionId: sid, project: msg.project || 'cloud', title: prev[sid]?.title || msg.project,
            cwd: msg.cwd, tool: msg.tool,
            lines: prev[sid]?.lines || [], ts: Date.now(), source: 'cloud', pty: true, closed: false,
          } }));
        } else if (msg.type === 'msg' && typeof msg.text === 'string') {
          // A real conversation turn parsed from the transcript on the Mac.
          setSessions((prev) => {
            const before = prev[sid];
            const next = withMessage(prev, sid, { role: msg.role, text: msg.text, ts: msg.ts },
              { project: 'cloud', source: 'cloud', pty: true });
            const nowOpt = next[sid]?.options;
            if (!before?.options && nowOpt && shouldNotify(next[sid])) {
              try { Vibration.vibrate([180, 80, 180]); } catch {}
              const label = nowOpt.type === 'yesno' ? 'yes/no' : nowOpt.type === 'numbered' ? 'pick one' : 'approval';
              notify(`${next[sid]?.project || 'clim'} needs input`, `${label} • ${msg.text.split('\n').slice(-1)[0]}`.slice(0, 120), sid);
            }
            return next;
          });
        } else if (msg.type === 'transcriptPath' && typeof msg.path === 'string') {
          // Marks this as a Claude session over cloud too, so the TUI frames
          // below stay hidden and only real turns render.
          setSessions((prev) => ({ ...prev, [sid]: { ...(prev[sid] || { sessionId: sid, lines: [], ts: Date.now() }), transcriptPath: msg.path } }));
        } else if (msg.type === 'status') {
          setSessions((prev) => {
            const cur = prev[sid] || { sessionId: sid, lines: [], ts: Date.now(), source: 'cloud', pty: true };
            return { ...prev, [sid]: { ...cur, status: msg.status || null, thinking: !!msg.status, ts: Date.now() } };
          });
        } else if (msg.type === 'options') {
          // A TUI menu (trust folder, permission prompt) exists only in the PTY,
          // never in the transcript. Over LAN the relay parses it; over cloud the
          // Mac does, and sends the result instead of ~8 repaint frames a second.
          setSessions((prev) => {
            const cur = prev[sid] || { sessionId: sid, lines: [], ts: Date.now(), source: 'cloud', pty: true };
            if (!cur.options && msg.options && shouldNotify(cur)) {
              try { Vibration.vibrate([180, 80, 180]); } catch {}
              notify(`${cur.project || 'clim'} needs input`, msg.options.type === 'yesno' ? 'yes/no' : 'pick one', sid);
            }
            return { ...prev, [sid]: { ...cur, options: msg.options || null, ts: Date.now() } };
          });
        } else if (msg.type === 'screen' && typeof msg.text === 'string') {
          // The Mac's reconstructed screen for a tool with no transcript. Held
          // as the whole state, not appended: a repaint replaces what it repaints.
          setSessions((prev) => {
            const cur = prev[sid] || { sessionId: sid, lines: [], ts: Date.now(), source: 'cloud', pty: true };
            return { ...prev, [sid]: { ...cur, screen: msg.text, ts: Date.now() } };
          });
        } else if (msg.type === 'output' && typeof msg.text === 'string' && msg.sessionId) {
          // Unstamped frames come from pre-upgrade wrappers, which stream raw TUI
          // repaints. Without an id they cannot be attributed, and rendering them
          // under the room id produces exactly the wall of noise this hides.
          setSessions((prev) => withRawChunk(prev, sid, msg.text, { project: 'cloud', source: 'cloud', pty: true }));
        } else if (msg.type === 'closed') {
          setSessions((prev) => withClosed(prev, sid, msg.reason, msg.exitCode));
        }
      } catch {}
    };
  }

  const cloudQueueRef = useRef<string[]>([]);
  function cloudSend(text: string, sessionId: string): boolean {
    // Address it: every wrapper on that Mac is listening to this room, and an
    // unaddressed input gets typed into all of them.
    const payload = encryptCloud(cloudKey, JSON.stringify({
      type: 'input', sessionId, text: text.endsWith('\n') ? text : text + '\n',
    }));
    if (!payload) return false;
    const wrapMsg = JSON.stringify({ c: payload });
    const ws = cloudWsRef.current;
    if (ws && ws.readyState === 1) {
      try { ws.send(wrapMsg); return true; } catch {}
    }
    // Queue it. Only kick a reconnect if nothing is already in flight — a socket in
    // CONNECTING will flush the queue on open, and reconnecting under it just thrashes.
    cloudQueueRef.current.push(wrapMsg);
    if (!ws || ws.readyState === 2 || ws.readyState === 3) connectCloud();
    return true;
  }
  function flushCloudQueue() {
    const ws = cloudWsRef.current;
    if (!ws || ws.readyState !== 1) return;
    const q = cloudQueueRef.current;
    while (q.length) { try { ws.send(q.shift() as string); } catch { break; } }
  }

  function connect() {
    clearTimeout(reconnectRef.current);
    const gen = ++genRef.current;
    setConnected(false); setInitialized(false);
    const ws = new WebSocket('ws://' + host + (secret ? '?secret=' + encodeURIComponent(secret) : ''));
    wsRef.current = ws;
    ws.onopen = () => { if (gen !== genRef.current) { try { ws.close(); } catch {} return; } setConnected(true); setLastErr(''); };
    ws.onclose = () => {
      if (gen !== genRef.current) return;
      setConnected(false); setInitialized(false);
      reconnectRef.current = setTimeout(connect, 2000);
    };
    ws.onerror = () => {};
    ws.onmessage = (ev) => {
      if (gen !== genRef.current) return;
      let msg: any; try { msg = JSON.parse(ev.data as any); } catch { return; }
      if (msg.type === 'init') {
        setSessions((prev) => {
          const merged = { ...prev };
          (msg.sessions || []).forEach((x: Session) => { merged[x.sessionId] = { ...(prev[x.sessionId]||{}), ...x }; });
          return merged;
        });
        setInitialized(true);
      } else if (msg.type === 'msg' && msg.sessionId && typeof msg.text === 'string') {
        setSessions((prev) => withMessage(prev, msg.sessionId, { role: msg.role, text: msg.text, ts: msg.ts }));
      } else if (msg.type === 'ptyChunk' && msg.sessionId && typeof msg.text === 'string') {
        // The relay streams live terminal output over LAN too — without this the
        // phone only ever saw the 3-line card summary and a polled transcript.
        setSessions((prev) => withRawChunk(prev, msg.sessionId, msg.text, { source: 'pty', pty: true }));
      } else if (msg.type === 'update' && msg.session) {
        setSessions((prev) => {
          const prevSess = prev[msg.session.sessionId];
          const hadOpt = !!(prevSess && prevSess.options);
          const hasOpt = !!msg.session.options;
          const wasThinking = !!(prevSess && (prevSess.thinking || prevSess.running));
          const isThinking = !!(msg.session.thinking || msg.session.running);
          const quiet = !shouldNotify(msg.session);
          if (quiet) { /* muted, or someone is at that Mac */ }
          else if (msg.session.closed && !prevSess?.closed) {
            notify(`${msg.session.project || 'claude'} session closed`,
              msg.session.closedReason === 'disconnected' ? 'wrapper lost — terminal gone' : 'terminal exited', msg.session.sessionId);
          } else if (!hadOpt && hasOpt) {
            Vibration.vibrate([180, 80, 180]);
            const label = msg.session.options?.type === 'yesno' ? 'yes/no' : msg.session.options?.type === 'numbered' ? 'pick one' : msg.session.options?.type === 'multi' ? 'multi-select' : 'approval';
            notify(`${msg.session.project || 'claude'} needs input`, `${label} • ${(msg.session.lines || []).slice(-1)[0] || ''}`.slice(0,120), msg.session.sessionId);
          } else if (wasThinking && !isThinking && !hasOpt) {
            notify(`${msg.session.project || 'claude'} idle`, (msg.session.lines || []).slice(-1)[0] || 'turn finished', msg.session.sessionId);
          }
          // The server never sends `messages`; keep the locally-accumulated ones.
          return { ...prev, [msg.session.sessionId]: { ...msg.session, messages: prevSess?.messages, raw: prevSess?.raw } };
        });
      }
    };
  }

  function patch(sessionId: string, fields: Partial<Session>) {
    setSessions((prev) => ({ ...prev, [sessionId]: { ...(prev[sessionId] || { sessionId }), ...fields } }));
  }

  async function send(sessionId: string, text: string) {
    if (!text.trim()) return;
    if (sessions[sessionId]?.closed) {
      patch(sessionId, { sendError: 'session closed — reopen it with `clim claude` on your Mac' });
      return;
    }
    patch(sessionId, { options: null, thinking: true, sendError: undefined });
    if (activeMode === 'cloud') { cloudSend(text, sessionId); return; }
    try {
      const r = await fetch('http://' + host + '/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Secret': secret },
        body: JSON.stringify({ sessionId, text, cwd: sessions[sessionId]?.cwd || '' }),
      });
      if (r.status === 401) { setShowSetup(true); return; }
      const b = await r.json().catch(() => ({} as any));
      // A rejected send used to be swallowed here: the composer cleared, the
      // spinner spun, and nothing ever arrived. Say what went wrong instead.
      if (!r.ok) {
        patch(sessionId, {
          thinking: false,
          closed: !!b.closed || undefined,
          sendError: b.error || `send failed (${r.status})`,
        });
        return;
      }
      patch(sessionId, { thinking: true, sendError: undefined });
    } catch (e: any) {
      patch(sessionId, { thinking: false, sendError: 'Mac unreachable — ' + (e?.message || 'network error') });
    }
  }

  // Sorting by last-activity re-sorted on every frame — a card would jump to the
  // top mid-read, every time its spinner ticked. The order is now recomputed
  // only when the set of sessions changes, or every ten minutes; within that,
  // rows hold still and just update in place.
  const REORDER_MS = 600000;
  const [orderEpoch, setOrderEpoch] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setOrderEpoch((e) => e + 1), REORDER_MS);
    return () => clearInterval(t);
  }, []);
  const sessionIds = Object.keys(sessions).sort().join(',');
  const order = useMemo(
    () => Object.values(sessions).sort((a, b) => (b.ts || 0) - (a.ts || 0)).map((s) => s.sessionId),
    // Deliberately not `sessions`: a changing timestamp must not reshuffle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionIds, orderEpoch],
  );
  const list = useMemo(() => {
    const now = Date.now();
    const ranked = order.map((id) => sessions[id]).filter(Boolean);
    // A session that arrived since the last ranking goes on the end until then.
    for (const s of Object.values(sessions)) if (!order.includes(s.sessionId)) ranked.push(s);
    return ranked.filter((s) => connected || (now - (s.ts || 0) < 30000));
  }, [sessions, connected, order]);

  async function saveCloud(url: string, key: string, sid: string) {
    await AsyncStorage.setItem(KEY_CLOUD_URL, url);
    await AsyncStorage.setItem(KEY_CLOUD_KEY, key);
    await AsyncStorage.setItem(KEY_CLOUD_SID, sid);
    setCloudUrl(url); setCloudKey(key); setCloudSid(sid); setShowSetup(false);
  }

  // A transport is a property of a connection, not something you can change
  // underneath one that is already up: flipping it mid-session tore down the
  // working link and took the live sessions off the screen with it. So the
  // toggle records a preference and takes effect on the NEXT connection —
  // immediately if nothing is connected, otherwise when the current link drops.
  async function switchMode(to: 'lan' | 'cloud') {
    if (to === activeMode && !pendingMode) return;
    const hasTarget = to === 'lan' ? !!(host && secret) : !!(cloudUrl && cloudKey && cloudSid);
    // One QR carries both LAN and cloud, so "cloud not paired" almost always
    // means the QR predates cloud or the pairing window had already closed.
    if (!hasTarget) {
      Alert.alert(`${to.toUpperCase()} not paired`,
        'Run `clim pair` on your Mac (or `clim restart` if the pairing window closed) and scan the QR — it pairs LAN and Cloud together.');
      return;
    }
    await AsyncStorage.setItem(KEY_MODE, to);
    if (!connected) { setPendingMode(null); setActiveMode(to); setShowSetup(false); return; }
    setPendingMode(to);
    Alert.alert(`${to.toUpperCase()} set for the next connection`,
      `The ${String(activeMode).toUpperCase()} connection is live, so it keeps running. ${to.toUpperCase()} takes over when it drops — or tap "Switch now" to change immediately.`,
      [{ text: 'OK' },
       { text: 'Switch now', style: 'destructive', onPress: () => { setPendingMode(null); setActiveMode(to); setShowSetup(false); } }]);
  }

  // Tapping a transport is an explicit choice of route. Entering the one already
  // carrying traffic just opens its sessions; choosing the other is the same
  // decision the toggle makes, so it goes through the same rule — a live link is
  // never dropped without being asked.
  function openVia(mode: 'lan' | 'cloud') {
    setFilter('all');
    if (mode === activeMode) { setScreen('sessions'); return; }
    switchMode(mode);
  }

  // The link we were preserving is gone — honour the queued preference.
  useEffect(() => {
    if (!connected && pendingMode && pendingMode !== activeMode) {
      setActiveMode(pendingMode);
      setPendingMode(null);
    }
  }, [connected, pendingMode, activeMode]);

  if (showSetup) {
    return <Setup host={host} secret={secret} discovered={discovered}
      cloudUrl={cloudUrl} cloudKey={cloudKey} cloudSid={cloudSid}
      activeMode={activeMode} pendingMode={pendingMode} onSwitchMode={switchMode}
      onSave={async (h: string, sec: string) => {
        await AsyncStorage.setItem(KEY_HOST, h);
        await AsyncStorage.setItem(KEY_SECRET, sec || '');
        setHost(h); setSecret(sec || '');
      }}
      onSaveCloud={saveCloud}
      onPaired={async (mode: 'lan' | 'cloud') => {
        await AsyncStorage.setItem(KEY_MODE, mode);
        setActiveMode(mode); setShowSetup(false);
      }}
      onCancel={() => setShowSetup(false)}
    />;
  }
  if (activeId) {
    const sess = sessions[activeId] || { sessionId: activeId, project: 'session', lines: [], ts: Date.now(), source: cloudUrl ? 'cloud' : 'pty', pty: true };
    return <Detail session={sess} host={host} secret={secret} onSend={(t: string) => send(activeId, t)}
      onBack={() => setActiveId(null)} word={word}
      muted={!!muted[activeId]} onToggleMute={() => toggleMute(activeId)} />;
  }

  if (screen === 'settings') {
    return (
      <>
        <Settings onBack={() => setScreen('devices')} onHelp={() => setHelpFromSettings(true)}
          host={host} cloudSid={cloudSid} activeMode={activeMode} />
        <Tutorial visible={helpFromSettings} onClose={() => setHelpFromSettings(false)} />
      </>
    );
  }
  if (screen === 'sessions') {
    return <Sessions list={list} filter={filter} onFilter={setFilter} muted={muted} onToggleMute={toggleMute}
      deviceName={macLabel(discovered && discovered.length ? discovered[0].name : '') || (activeMode === 'cloud' ? 'cloud' : host)}
      activeMode={activeMode} connected={connected}
      onOpen={(id: string) => setActiveId(id)} onBack={() => setScreen('devices')} />;
  }

  return <Devices list={list} discovered={discovered} host={host} cloudUrl={cloudUrl} cloudSid={cloudSid}
    activeMode={activeMode} pendingMode={pendingMode} connected={connected}
    onOpen={openVia} onAdd={() => setShowSetup(true)} onSettings={() => setScreen('settings')} />;
}

// ── the Mac you are driving ──────────────────────────────────────────────────
// Pairing belongs here, at the top of the hierarchy — not floating over a list
// of that Mac's sessions, where "+" read as "new session".
function macLabel(name?: string) {
  return String(name || '').replace(/^clim-/, '').replace(/-\d+$/, '').replace(/-/g, ' ').trim() || 'Mac';
}

// One row per way in. LAN and Cloud are listed under their own headings, so the
// question "what can I reach, and how" is answered by reading down the screen.
function TransportCard({ mode, testID, label, endpoint, active, connected, sessionCount, onPress }: any) {
  const tone = mode === 'cloud' ? C.brand : C.ok;
  const liveHere = active && connected;
  const sessions = sessionCount === 1 ? '1 session' : sessionCount + ' sessions';
  return (
    <TouchableOpacity testID={testID} activeOpacity={0.7} onPress={onPress} style={s.deviceCard}>
      <View style={[s.rail, { backgroundColor: liveHere ? tone : C.borderStrong }]} />
      <View style={{ flex: 1, padding: 14, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[s.dot, liveHere ? { backgroundColor: tone } : s.dotDead]} />
          <Text style={s.deviceName} numberOfLines={1}>{label}</Text>
          <Text style={s.ago}>{liveHere ? 'connected' : active ? 'connecting…' : 'standby'}</Text>
        </View>
        <Text style={s.cwd} numberOfLines={1}>{endpoint}</Text>
        <Text style={s.deviceMeta}>{liveHere ? sessions : 'tap to use this route'}</Text>
      </View>
      <Text style={s.chevron}>›</Text>
    </TouchableOpacity>
  );
}

// Everything Apple wants reachable from inside the app — privacy policy, terms,
// a way to contact support — plus the things a curious user looks for.
const LINKS = {
  privacy: 'https://getclim.netlify.app/privacy.html',
  terms: 'https://getclim.netlify.app/terms.html',
  support: 'https://github.com/subrahmanyabhat/clim/issues',
  source: 'https://github.com/subrahmanyabhat/clim',
  coffee: 'https://buymeacoffee.com/subrahmanya',
};

function SettingsRow({ testID, icon, label, hint, onPress, tint }: any) {
  return (
    <TouchableOpacity testID={testID} activeOpacity={0.7} onPress={onPress} style={s.setRow}>
      <Icon name={icon} size={17} color={tint || C.mute} stroke={1.9} />
      <View style={{ flex: 1 }}>
        <Text style={[s.setLabel, tint ? { color: tint } : null]}>{label}</Text>
        {!!hint && <Text style={s.setHint} numberOfLines={1}>{hint}</Text>}
      </View>
      <Text style={s.chevron}>›</Text>
    </TouchableOpacity>
  );
}

// One back button for every screen: same chrome, same label, same hit area.
// `overlay` is the only variant — on the camera it sits on the live preview, so
// it needs its own scrim instead of the header's raised background.
function BackBtn({ testID, onPress, overlay }: { testID?: string; onPress: () => void; overlay?: boolean }) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} style={[s.backBtn, overlay && s.backBtnOverlay]}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
      <Icon name="back" size={16} color={C.text} stroke={2.2} />
      <Text style={s.backLabel}>Back</Text>
    </TouchableOpacity>
  );
}

function Settings({ onBack, onHelp, host, cloudSid, activeMode }: any) {
  const open = (url: string) => { try { Linking.openURL(url); } catch {} };
  return (
    <View style={s.root}>
      <View style={s.header}>
        <BackBtn testID="settings-back" onPress={onBack} />
        <Text style={s.screenTitle}>settings</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 12 }}>
        <View style={s.groupHead}><Text style={s.groupLabel}>THIS DEVICE</Text></View>
        <View style={s.setCard}>
          <View style={s.setRow}>
            <Icon name="wifi" size={17} color={C.mute} stroke={1.9} />
            <View style={{ flex: 1 }}>
              <Text style={s.setLabel}>Paired Mac</Text>
              <Text style={s.setHint} numberOfLines={1}>{host || 'not paired over LAN'}</Text>
            </View>
          </View>
          <View style={s.setRow}>
            <Icon name="cloud" size={17} color={C.mute} stroke={1.9} />
            <View style={{ flex: 1 }}>
              <Text style={s.setLabel}>Cloud room</Text>
              <Text style={s.setHint} numberOfLines={1}>
                {cloudSid ? String(cloudSid).slice(0, 8) + '…' : 'not paired'}
              </Text>
            </View>
          </View>
          <View style={[s.setRow, { borderBottomWidth: 0 }]}>
            <Icon name="zap" size={17} color={C.mute} stroke={1.9} />
            <View style={{ flex: 1 }}>
              <Text style={s.setLabel}>Connection</Text>
              <Text style={s.setHint}>{String(activeMode).toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <View style={s.groupHead}><Text style={s.groupLabel}>ABOUT</Text></View>
        <View style={s.setCard}>
          <SettingsRow testID="settings-help" icon="help" label="How clim works"
            hint="the quick tour" onPress={onHelp} />
          <SettingsRow testID="settings-source" icon="terminal" label="Source code"
            hint="github.com/subrahmanyabhat/clim" onPress={() => open(LINKS.source)} />
          <SettingsRow testID="settings-support" icon="help" label="Support"
            hint="report a bug or ask a question" onPress={() => open(LINKS.support)} />
        </View>

        <View style={s.groupHead}><Text style={s.groupLabel}>LEGAL</Text></View>
        <View style={s.setCard}>
          <SettingsRow testID="settings-privacy" icon="shield" label="Privacy Policy"
            hint="no accounts · nothing collected" onPress={() => open(LINKS.privacy)} />
          <SettingsRow testID="settings-terms" icon="shield" label="Terms of Use"
            onPress={() => open(LINKS.terms)} />
        </View>

        <View style={s.groupHead}><Text style={s.groupLabel}>SUPPORT THE PROJECT</Text></View>
        <View style={s.setCard}>
          <SettingsRow testID="settings-coffee" icon="zap" label="Buy me a coffee"
            hint="clim is free — this keeps the relay running" tint={C.brand}
            onPress={() => open(LINKS.coffee)} />
        </View>

        <Text style={s.setVersion}>clim {APP_VERSION} · MIT licence</Text>
      </ScrollView>
    </View>
  );
}

function Devices({ list, discovered, host, cloudUrl, cloudSid, activeMode, pendingMode, connected, onOpen, onAdd, onSettings }: any) {
  const [showHelp, setShowHelp] = useState(false);
  const lanPaired = !!host;
  const cloudPaired = !!cloudUrl;
  const counts = bucketCounts(list);
  // The Mac you are already paired to is not a discovery result — it is the card
  // above it. Listing it again under whatever name mDNS gave it after the last
  // relay restart ("…-4041", "…-4212") was the confusing part.
  const pairedIp = String(host || '').split(':')[0];
  const unpaired = (discovered || []).filter((d: any) => d.addr && d.addr !== pairedIp);
  const macName = macLabel(discovered && discovered.length ? discovered[0].name : '');

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Image source={GLYPH} style={{ width: 70, height: 26, resizeMode: 'contain' }} />
        <Text style={s.screenTitle}>devices</Text>
        <View style={{ width: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 14 }}>
          <TouchableOpacity testID="devices-help" onPress={() => setShowHelp(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="help" size={20} color={C.brand} />
          </TouchableOpacity>
          <TouchableOpacity testID="devices-settings" onPress={onSettings}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="gear" size={20} color={C.mute} />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 12, paddingTop: 0 }}>
        {!lanPaired && !cloudPaired && (
          <Text style={s.emptyHint}>No Mac paired yet. Tap + and scan the QR from `clim pair`.</Text>
        )}

        {(lanPaired || unpaired.length > 0) && (
          <View>
            <View style={s.groupHead}>
              <Text style={s.groupLabel}>LAN</Text>
              <Text style={s.groupMeta}>same WiFi</Text>
            </View>
            {lanPaired && (
              <TransportCard mode="lan" testID="transport-lan" label={macName || 'your Mac'}
                endpoint={host} active={activeMode === 'lan'} connected={connected}
                sessionCount={list.length} onPress={() => onOpen('lan')} />
            )}
            {unpaired.map((d: any, i: number) => (
              <TouchableOpacity key={i} testID={'discovered-' + i} activeOpacity={0.7} onPress={onAdd} style={s.discCard}>
                <Image source={GLYPH} style={{ width: 34, height: 24, resizeMode: 'contain' }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontFamily: MONO, fontSize: 13 }} numberOfLines={1}>{macLabel(d.name)}</Text>
                  <Text style={s.cwd} numberOfLines={1}>{d.addr}:{d.port}</Text>
                </View>
                <Text style={s.pairHint}>pair</Text>
                <Text style={s.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Cloud is only a way in once a room is paired — an empty "anywhere"
            row promised reachability that did not exist. */}
        {cloudPaired && (
          <View>
            <View style={s.groupHead}>
              <Text style={s.groupLabel}>CLOUD</Text>
              <Text style={s.groupMeta}>anywhere · encrypted</Text>
            </View>
            <TransportCard mode="cloud" testID="transport-cloud" label={macName || 'your Mac'}
              /* The relay host is infrastructure, not something a customer needs
                 to read off their phone. The room is the only identity shown. */
              endpoint={cloudSid ? 'room ' + String(cloudSid).slice(0, 6) + '…' : 'paired'}
              active={activeMode === 'cloud'} connected={connected}
              sessionCount={list.length} onPress={() => onOpen('cloud')} />
          </View>
        )}

        {(lanPaired || cloudPaired) && (
          <Text style={[s.deviceMeta, { marginTop: 12 }]}>
            {counts.live} live · {counts.detached} detached · {counts.closed} closed
            {pendingMode ? '   ·   ' + String(pendingMode).toUpperCase() + ' on next connection' : ''}
          </Text>
        )}
      </ScrollView>
      <TouchableOpacity testID="add-device" onPress={onAdd} style={s.fab}>
        <Text style={{ color: C.brandInk, fontSize: 22, fontWeight: '700' }}>+</Text>
      </TouchableOpacity>
      <Tutorial visible={showHelp} onClose={() => setShowHelp(false)} />
    </View>
  );
}

// ── that Mac's sessions ──────────────────────────────────────────────────────
function Sessions({ list, filter, onFilter, deviceName: name, activeMode, connected, onOpen, onBack, muted, onToggleMute }: any) {
  const counts = bucketCounts(list);
  const shown = list.filter((x: Session) => filter === 'all' || bucketOf(x) === filter);
  const groups: { key: Bucket; label: string; meta: string }[] = [
    { key: 'live', label: 'LIVE', meta: `${counts.live} attached` },
    { key: 'detached', label: 'DETACHED', meta: counts.detached ? ago(latestTs(list, 'detached')) + ' ago' : '' },
    { key: 'closed', label: 'CLOSED', meta: 'read-only' },
  ];
  return (
    <View style={s.root}>
      <View style={s.header}>
        <BackBtn testID="sessions-back" onPress={onBack} />
        <Text style={s.screenTitle} numberOfLines={1}>{name}</Text>
        <View style={{ width: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
          <Text style={{ color: activeMode === 'cloud' ? C.brand : C.ok, fontFamily: MONO, fontSize: 10 }}>{String(activeMode).toUpperCase()}</Text>
          <View style={[s.dot, connected ? s.dotLive : s.dotDead]} />
        </View>
      </View>

      <View style={s.chipRow}>
        <Chip testID="chip-all" label="All" count={list.length} on={filter === 'all'} tone="all" onPress={() => onFilter('all')} />
        <Chip testID="chip-live" label="Live" count={counts.live} on={filter === 'live'} tone="live" onPress={() => onFilter('live')} />
        <Chip testID="chip-detached" label="Detached" count={counts.detached} on={filter === 'detached'} tone="detached" onPress={() => onFilter('detached')} />
        <Chip testID="chip-closed" label="Closed" count={counts.closed} on={filter === 'closed'} tone="closed" onPress={() => onFilter('closed')} />
      </View>

      {shown.length === 0 ? (
        <Text style={s.emptyHint}>
          {list.length === 0 ? 'No sessions yet. Run `clim claude` on your Mac.' : 'Nothing in this group.'}
        </Text>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingTop: 4 }}>
          {groups.map((g) => {
            const items = shown.filter((x: Session) => bucketOf(x) === g.key);
            if (!items.length) return null;
            return (
              <View key={g.key}>
                <View style={s.groupHead}>
                  <Text style={s.groupLabel}>{g.label}</Text>
                  <Text style={s.groupMeta}>{g.meta}</Text>
                </View>
                {items.map((x: Session) => (
                  <SessionCard key={x.sessionId} session={x} muted={!!(muted && muted[x.sessionId])} onToggleMute={onToggleMute} onPress={() => onOpen(x.sessionId)} />
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function Chip({ label, count, on, tone, onPress, testID }: any) {
  const col = tone === 'live' ? C.ok : tone === 'detached' ? C.warn : tone === 'closed' ? C.mute : C.text;
  return (
    <TouchableOpacity testID={testID} onPress={onPress}
      style={[s.chip, on && (tone === 'all' ? s.chipOnAll : { borderColor: col, backgroundColor: 'rgba(255,255,255,0.04)' })]}>
      <Text style={{ fontFamily: MONO, fontSize: 12, color: on && tone === 'all' ? C.panel : col }}>
        {label} {count}
      </Text>
    </TouchableOpacity>
  );
}

function SessionCard({ session, onPress, muted, onToggleMute }: { session: Session; onPress: () => void; muted?: boolean; onToggleMute?: (id: string) => void }) {
  const bucket = bucketOf(session);
  // Muted: the rail is a hint at state, not the loudest thing on the row.
  const rail = bucket === 'live' ? C.railLive : bucket === 'detached' ? C.railDetached : C.borderMid;
  const needsInput = bucket !== 'closed' && !!session.options;
  const thinking = bucket !== 'closed' && !!(session.running || session.thinking);
  const imgs = imageCount(session.title);
  const starting = isStarting(session);
  // The card's two preview lines. For codex and hermes the raw tail is the
  // status bar and the composer — a card that said "[░░░░] -- │ 3s" told you
  // nothing. Their parsed turns are the actual last thing said.
  const preview = useMemo(() => {
    const turns = parseAgentTurns(stripAnsi(session.screen || ''), session.tool);
    if (turns) return turns.slice(-2).map((t) => t.text.split('\n').map((l) => l.trim()).filter(Boolean)[0] || '');
    return (session.lines || []).map((l) => cleanTerminal(l)).filter(Boolean).slice(-2);
  }, [session.screen, session.tool, session.lines]);
  return (
    <TouchableOpacity testID={'card-' + session.sessionId} activeOpacity={0.7} onPress={onPress}
      style={[s.sCard, needsInput && { borderColor: C.brand }, bucket === 'closed' && s.cardClosed]}>
      <View style={[s.rail, { backgroundColor: rail }]} />
      <View style={{ flex: 1, padding: 12, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[s.dot, bucket === 'live' ? s.dotLive : bucket === 'detached' ? s.dotDetached : s.dotDead]} />
          <Text style={[s.sTitle, bucket === 'closed' && s.dimText]} numberOfLines={1}>
            {cleanTitle(session.title) || session.project || 'session'}
          </Text>
          <Text style={s.ago}>{ago(session.ts || Date.now())}</Text>
          <TouchableOpacity testID={'mute-' + session.sessionId} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => onToggleMute && onToggleMute(session.sessionId)}>
            <View style={[s.bellBtn, muted && s.bellBtnOff]}>
              <Icon name={muted ? 'bell-off' : 'bell'} size={13} color={muted ? C.toolDim : C.ok} stroke={1.9} />
            </View>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={s.cwd} numberOfLines={1}>{shortPath(session.cwd)}</Text>
          {/* Which agent — the one badge worth the space when Claude and Codex
              sessions sit in the same list. */}
          <Pill text={toolName(session)} tone={toolName(session) === 'CODEX' ? 'tool' : 'claude'} />
          {/* No badge for a live PTY session: the group header already says
              LIVE and the dot says it again, so it was pure clutter. Only the
              cases that carry information the row does not get a badge. */}
          {session.pty ? null
            : session.tmuxTarget ? <Pill text="TMUX" tone="tool" />
            : bucket === 'closed' ? <Pill text={session.exitCode ? `EXIT ${session.exitCode}` : 'CLOSED'} tone="dead" />
            : <Pill text="DETACHED" tone="warnline" />}
          {imgs > 0 && <Pill text={`${imgs} IMAGE`} tone="tool" />}
          {starting && !thinking && <Pill text="starting…" tone="warn" />}
          {thinking && <Pill text={(session.status || 'thinking').split(/\s*\(/)[0].slice(0, 16)} tone="warn" />}
          {needsInput && !thinking && <Pill text="needs input" tone="claude" />}
        </View>
        {preview.map((l, i) => (
          <Text key={i} style={[s.line, bucket === 'closed' && s.dimText]} numberOfLines={1}>
            <Text style={s.marker}>› </Text>{l}
          </Text>
        ))}
        {starting && (
          <Text style={[s.line, { color: C.warn, fontStyle: 'italic' }]} numberOfLines={1}>clim is connecting…</Text>
        )}
        {bucket === 'closed' && (
          <Text style={[s.line, s.dimText, { fontStyle: 'italic' }]} numberOfLines={1}>
            {session.closedReason === 'disconnected' ? 'wrapper lost — terminal gone' : 'terminal exited · read-only'}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// Claude writes markdown. Rendering it as one flat grey wall loses everything
// it uses emphasis for, so the phone reads the few marks that carry meaning —
// **bold**, `code`, headings and bullets — and nothing else. No parser
// dependency: this is a line pass and one inline split.
const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\n]+\)|https?:\/\/\S+|\*[^*\n]+\*|_[^_\n]+_)/g;

// A markdown table arrives as pipes and dashes. Printed literally it is an
// unreadable smear on a phone — the columns never line up at that width. Pull
// the cells out and lay them out as real rows instead.
const TABLE_ROW = /^\s*\|(.+)\|\s*$/;
const TABLE_RULE = /^[\s|:-]+$/;
function splitRow(line: string): string[] {
  const m = line.match(TABLE_ROW);
  return (m ? m[1] : line).split('|').map((c) => c.trim());
}
type Block = { table: string[][] } | { code: string; lang: string } | { rule: true } | { line: string };

/** Blocks Claude actually emits: fenced code, tables, rules, and plain lines. */
function blocksOf(text: string): Block[] {
  const lines = String(text).split('\n');
  const out: Block[] = [];
  for (let i = 0; i < lines.length; i++) {
    const fence = lines[i].match(/^\s*```+\s*([A-Za-z0-9+#-]*)\s*$/);
    if (fence) {
      // Code is the one thing that must never be reflowed or re-styled.
      const body: string[] = [];
      let j = i + 1;
      for (; j < lines.length && !/^\s*```+\s*$/.test(lines[j]); j++) body.push(lines[j]);
      out.push({ code: body.join('\n'), lang: fence[1] || '' });
      i = j;
      continue;
    }
    // A table needs a header and a --- rule under it, else it is just prose.
    if (TABLE_ROW.test(lines[i]) && i + 1 < lines.length && TABLE_ROW.test(lines[i + 1]) && TABLE_RULE.test(lines[i + 1])) {
      const rows: string[][] = [splitRow(lines[i])];
      let j = i + 2;
      for (; j < lines.length && TABLE_ROW.test(lines[j]); j++) rows.push(splitRow(lines[j]));
      out.push({ table: rows });
      i = j - 1;
      continue;
    }
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(lines[i])) { out.push({ rule: true }); continue; }
    out.push({ line: lines[i] });
  }
  return out;
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  return (
    <View testID="md-code" style={s.codeBlock}>
      {!!lang && <Text style={s.codeLang}>{lang}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text style={s.codeText}>{code}</Text>
      </ScrollView>
    </View>
  );
}

function Table({ rows }: { rows: string[][] }) {
  const cols = Math.max(...rows.map((r) => r.length));
  return (
    <View testID="md-table" style={s.table}>
      {rows.map((row, r) => (
        <View key={r} style={[s.tableRow, r === 0 && s.tableHeadRow]}>
          {Array.from({ length: cols }, (_, c) => (
            <Text key={c} style={[s.tableCell, r === 0 && s.tableHeadCell]}>{row[c] || ''}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function Rich({ text, base }: { text: string; base: any }) {
  const blocks = blocksOf(text);
  return (
    <>
      {blocks.map((b, bi) => 'table' in b ? <Table key={bi} rows={b.table} />
        : 'code' in b ? <CodeBlock key={bi} code={b.code} lang={b.lang} />
        : 'rule' in b ? <View key={bi} style={s.mdRule} />
        : <RichLine key={bi} line={b.line} base={base} />)}
    </>
  );
}

function RichLine({ line, base }: { line: string; base: any }) {
  const quote = line.match(/^\s*>\s?(.*)$/);
  const src = quote ? quote[1] : line;
  const heading = src.match(/^\s*(#{1,6})\s+(.*)$/);
  const task = src.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
  const bullet = task ? null : src.match(/^\s*[-*]\s+(.*)$/);
  const numbered = src.match(/^\s*(\d+)[.)]\s+(.*)$/);
  const body = heading ? heading[2] : task ? task[2] : bullet ? bullet[1] : numbered ? numbered[2] : src;
  const style = [base, heading && s.mdHeading, quote && s.mdQuoteText].filter(Boolean);

  const content = (
    <Text style={style}>
      {task ? <Text style={s.mdMarker}>{/[xX]/.test(task[1]) ? '☑  ' : '☐  '}</Text> : null}
      {bullet ? <Text style={s.mdMarker}>•  </Text> : null}
      {numbered ? <Text style={s.mdMarker}>{numbered[1]}.  </Text> : null}
      {body.split(INLINE).map((part, k) => {
        if (/^\*\*[^*]+\*\*$/.test(part)) return <Text key={k} style={s.mdBold}>{part.slice(2, -2)}</Text>;
        if (/^`[^`]+`$/.test(part)) return <Text key={k} style={s.mdCode}>{part.slice(1, -1)}</Text>;
        if (/^\*[^*]+\*$/.test(part) || /^_[^_]+_$/.test(part)) {
          return <Text key={k} style={s.mdItalic}>{part.slice(1, -1)}</Text>;
        }
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          return (
            <Text key={k} style={s.mdLink} onPress={() => { try { Linking.openURL(link[2]); } catch {} }}>
              {link[1]}
            </Text>
          );
        }
        const bare = part.match(/^(https?:\/\/\S+)$/);
        if (bare) {
          return (
            <Text key={k} style={s.mdLink} onPress={() => { try { Linking.openURL(bare[1]); } catch {} }}>
              {bare[1]}
            </Text>
          );
        }
        return <Text key={k}>{part}</Text>;
      })}
    </Text>
  );

  // A quote gets a rail rather than a stray ">" that reads like a prompt.
  return quote ? <View testID="md-quote" style={s.mdQuote}>{content}</View> : content;
}

// A tool run collapsed to its first line. The command and its output are worth
// having on the phone, but they are machinery — they should not push the actual
// conversation off the screen. Tap to see the rest.
function ToolBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const lines = text.split('\n').filter((l) => l.trim().length);
  if (!lines.length) return null;
  const head = lines[0].trim().slice(0, 80);
  const rest = lines.length - 1;
  return (
    <TouchableOpacity testID="tool-block" activeOpacity={0.7} onPress={() => setOpen((v) => !v)} style={s.toolBlock}>
      <Text style={s.toolText} numberOfLines={open ? undefined : 1}>
        <Text style={s.toolChevron}>{open ? '▾ ' : '▸ '}</Text>
        {open ? text.trim() : head}
      </Text>
      {!open && rest > 0 && <Text style={s.toolMore}>+{rest} line{rest === 1 ? '' : 's'}</Text>}
    </TouchableOpacity>
  );
}

function Detail({ session, host, secret, onSend, onBack, word, muted, onToggleMute }: any) {
  const [input, setInput] = useState('');
  const [multiPicks, setMultiPicks] = useState<Record<string, boolean>>({});
  const [transcript, setTranscript] = useState<any>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  // Messages streamed over the live socket are already the real conversation —
  // no fetch needed, and no waiting on a poll to see the reply appear.
  const live: Msg[] = session.messages || [];

  // Fetch the history once per session. This used to re-run on every update and
  // throw the fetched transcript away as soon as one live turn arrived, so the
  // screen swung between a stale snapshot and "only what arrived since I
  // connected" — which is why new turns seemed to need a trip back and forward.
  useEffect(() => {
    // A Claude session shows its conversation or nothing at all. Falling back to
    // PTY scrollback here is what put half a repainted TUI on the phone.
    // Tools without a transcript (codex, a wrapped shell) are rendered straight
    // from the live scrollback below — fetching for them would only race it.
    if (!isChatSession(session)) { setTranscript({ entries: [] }); return; }
    if (session.source === 'cloud' || !host) { setTranscript({ entries: [] }); return; }
    (async () => {
      const fallback = () => ({
        entries: (session.lines || []).length ? [{ role: 'terminal', text: (session.lines || []).join('\n') }] : [],
      });
      try {
        const r = await fetch(`http://${host}/transcript?sessionId=${session.sessionId}&limit=40`, {
          headers: secret ? { 'X-Secret': secret } : {},
        });
        setTranscript(r.ok ? await r.json() : { ...fallback(), error: r.status === 401 ? null : 'no transcript' });
      } catch {
        setTranscript({ ...fallback(), error: 'offline' });
      }
    })();
  }, [session.sessionId, session.source, host]);

  // History from the relay and turns streamed since we connected are two halves
  // of one conversation, not alternatives. Picking one meant either losing
  // everything older than this app launch, or never seeing anything newer.
  const entries: Msg[] = useMemo(() => {
    // Codex and wrapped shells have no transcript at all — the scrollback IS
    // the conversation, and it grows continuously. Deriving it here rather than
    // in the effect above is the difference between it updating and it being
    // rendered once, empty, at mount and never again.
    if (!isChatSession(session)) {
      // The Mac's screen buffer when it sends one — that is what the terminal
      // actually shows. Accumulated frames are the fallback for an older
      // wrapper, and are a wall of repaints by comparison.
      const src = stripAnsi(session.screen || session.raw || '');
      // Codex and Hermes mark their turns, so they get the same conversation
      // the transcript gives Claude. Anything else stays a terminal block.
      const turns = parseAgentTurns(src, session.tool);
      if (turns) return turns;
      const text = cleanTerminal(src);
      if (text) return [{ role: 'terminal', text }];
      return (transcript?.entries || []) as Msg[];
    }
    const base: Msg[] = (transcript?.entries || []) as Msg[];
    if (!live.length) return base;
    const seen = new Set(base.map((e) => e.role + String.fromCharCode(0) + e.text));
    return [...base, ...live.filter((m) => !seen.has(m.role + String.fromCharCode(0) + m.text))];
  }, [transcript, live, session.screen, session.raw, session.tool, session.transcriptPath]);
  const opts = session.options;

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      <View style={s.header}>
        <BackBtn testID="detail-back" onPress={onBack} />
        <Text style={s.title} numberOfLines={1}>{session.title || session.project}</Text>
        <View style={[s.dot, bucketOf(session) === 'live' ? s.dotLive : bucketOf(session) === 'detached' ? s.dotDetached : s.dotDead]} />
      </View>
      <View style={s.termWrap}>
        <View style={s.termHead}>
          <View style={s.traffic}>
            <View style={[s.trafficDot, { backgroundColor: C.trafficRed }]} />
            <View style={[s.trafficDot, { backgroundColor: C.trafficAmber }]} />
            <View style={[s.trafficDot, { backgroundColor: C.trafficGreen }]} />
          </View>
          <Text style={s.termHeadTitle} numberOfLines={1}>
            {session.title || session.project || 'session'}
          </Text>
          <View style={{ width: 76, alignItems: 'flex-end' }}>
            {(session.thinking || session.running) && (
              <Pill text={(session.status || 'think').split(/\s*\(/)[0].slice(0, 14)} tone="warn" />
            )}
          </View>
        </View>
      <ScrollView ref={scrollRef} style={s.termBody} contentContainerStyle={{ padding: 12 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {!transcript && !live.length ? (
          <View style={{ alignItems: 'center', padding: 20 }}>
            <Image source={GLYPH} style={{ width: 60, height: 40, resizeMode: 'contain', marginBottom: 8 }} />
            <Text style={s.emptyText}>{word}…</Text>
          </View>
        ) : entries.length === 0 ? (
          <View style={{ padding: 12, gap: 8 }}>
            <Text style={{ color: C.ok, fontFamily: MONO, fontSize: 11 }}>● connected</Text>
            <Text style={{ color: C.mute, fontFamily: MONO, fontSize: 11 }}>sid: {String(session.sessionId).slice(0, 12)}…</Text>
            {session.cwd ? <Text style={{ color: C.mute, fontFamily: MONO, fontSize: 11 }}>cwd: {session.cwd}</Text> : null}
            <Text style={{ color: C.warn, fontFamily: MONO, fontSize: 12, marginTop: 12 }}>
              {isStarting(session) ? 'clim is connecting…' : 'waiting for output…'}
            </Text>
            <Text style={{ color: C.dim, fontFamily: MONO, fontSize: 10 }}>type below to send a command</Text>
          </View>
        ) : entries.map((e, i) => (
          e.role === 'tool' || e.role === 'tool-result' ? (
            <ToolBlock key={i} text={(e.role === 'tool-result' ? '⎿  ' : '') + e.text} />
          ) : e.role === 'terminal' ? (
            // No transcript for this tool — raw scrollback, one block, not fake chat.
            <View key={i} style={s.termBlock}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text style={s.termBlockText}>{cleanTerminal(e.text)}</Text>
              </ScrollView>
            </View>
          ) : (
            <View key={i} style={s.msg}>
              <View style={s.iconWrap}><Text style={{ color: e.role === 'assistant' ? C.brand : C.info, fontFamily: MONO, fontSize: 16, lineHeight: 16 }}>{e.role === 'assistant' ? '✱' : '›'}</Text></View>
              <View style={{ flex: 1 }}>
                <Rich text={e.text} base={[s.msgText, e.role === 'user' && s.msgUser]} />
              </View>
            </View>
          )
        ))}
        {(session.thinking || session.running) && (
          <View style={s.msg}>
            <View style={s.iconWrap}><Text style={{ color: C.brand, fontFamily: MONO, fontSize: 16, lineHeight: 16 }}>✱</Text></View>
            {/* The real line off the Mac's screen — elapsed time, tokens and all.
                Falls back to the local spinner word only when none has arrived. */}
            <Text style={[s.msgText, { color: C.brand, fontStyle: 'italic' }]}>{session.status || `${word}…`}</Text>
          </View>
        )}
      </ScrollView>
      <View style={s.modeBar}>
        {session.closed ? (
          <Text style={[s.modeText, { color: C.mute, flex: 1 }]} numberOfLines={1}>
            ○ closed{session.exitCode != null ? ` · exit ${session.exitCode}` : ''}
            {session.closedReason === 'disconnected' ? ' · wrapper lost' : ''}
          </Text>
        ) : (session.pty || session.tmuxTarget || (session.tty && session.terminalApp)) ? (
          <Text style={[s.modeText, { color: C.ok, flex: 1 }]}>● live</Text>
        ) : (
          <Text style={[s.modeText, { color: C.warn, flex: 1 }]} numberOfLines={1}>
            ◌ detached — run `clim claude` in {session.cwd || 'that project'}
          </Text>
        )}
        {/* Same switch as the session list, spelled out — you should not have to
            leave the conversation to silence the one you are reading. */}
        <TouchableOpacity testID="detail-mute" onPress={onToggleMute}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.notifToggle}>
          <Icon name={muted ? 'bell-off' : 'bell'} size={13} color={muted ? C.toolDim : C.ok} stroke={1.9} />
          <Text style={[s.notifLabel, muted && { color: C.toolDim }]}>
            {muted ? 'Notifications off' : 'Notifications on'}
          </Text>
        </TouchableOpacity>
      </View>
      {!!session.sendError && (
        <View style={s.errBar}><Text style={s.errText}>{session.sendError}</Text></View>
      )}
      {opts && !session.closed && (
        <View style={s.opts}>
          {opts.type === 'yesno' && (<>
            <TapBtn k="1" lbl="Yes" onPress={() => onSend('yes')} tone="ok" />
            <TapBtn k="2" lbl="No" onPress={() => onSend('no')} tone="danger" />
          </>)}
          {opts.type === 'approve' && (<>
            <TapBtn k="1" lbl="Approve" onPress={() => onSend('yes, approve')} tone="ok" />
            <TapBtn k="2" lbl="Deny" onPress={() => onSend('no, deny')} tone="danger" />
          </>)}
          {opts.type === 'numbered' && (opts.items || []).map((it: any) => (
            <TapBtn key={it.key} k={it.key} lbl={it.label} onPress={() => onSend(it.key)} />
          ))}
          {opts.type === 'multi' && (<>
            {(opts.items || []).map((it: any) => (
              <Pressable key={it.key} onPress={() => setMultiPicks((p) => ({ ...p, [it.key]: !p[it.key] }))} style={[s.tapRow, multiPicks[it.key] && s.tapRowChecked]}>
                <View style={[s.checkbox, multiPicks[it.key] && s.checkboxOn]} />
                <Text style={[s.tapK, { color: C.brand }]}>{it.key}</Text>
                <Text style={s.tapLbl}>{it.label}</Text>
              </Pressable>
            ))}
            <TouchableOpacity onPress={() => {
              const picks = Object.keys(multiPicks).filter(k => multiPicks[k]);
              if (picks.length === 0) { Alert.alert('pick at least one'); return; }
              const labels = picks.map(k => `${k}) ${(opts.items || []).find((i: any) => i.key === k)?.label}`).join(', ');
              onSend(labels); setMultiPicks({});
            }} style={[s.tapRow, { backgroundColor: C.brand, borderColor: C.brand }]}>
              <Text style={{ color: C.brandInk, fontWeight: '700', fontFamily: MONO }}>send selection</Text>
            </TouchableOpacity>
          </>)}
        </View>
      )}
      {session.closed ? (
        <View style={s.composer}>
          <Text style={{ color: C.mute, fontFamily: MONO, fontSize: 12, flex: 1, paddingVertical: 10 }}>
            session closed — run `clim claude` on your Mac to start a new one
          </Text>
        </View>
      ) : (
      <View style={s.composer}>
        <View style={s.inputWrap}>
          <Text style={s.caret}>&gt;</Text>
          <TextInput testID="composer-input" value={input} onChangeText={setInput} placeholder="type… (Enter = send)" placeholderTextColor={C.dim}
          style={s.input}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={() => { if (input.trim()) { onSend(input); setInput(''); } }}
          autoCorrect={false} autoCapitalize="none" />
        </View>
        <TouchableOpacity onPress={() => { if (input.trim()) { onSend(input); setInput(''); Keyboard.dismiss(); } }} testID="composer-send" style={s.sendBtn}><Text style={s.sendTxt}>send</Text></TouchableOpacity>
      </View>
      )}
      </View>
    </KeyboardAvoidingView>
  );
}

function TapBtn({ k, lbl, onPress, tone }: any) {
  const color = tone === 'ok' ? C.ok : tone === 'danger' ? C.danger : C.brand;
  return (
    <TouchableOpacity onPress={onPress} style={[s.tapRow, { borderColor: color }]}>
      <Text style={[s.tapK, { color }]}>{k}</Text>
      <Text style={s.tapLbl}>{lbl}</Text>
    </TouchableOpacity>
  );
}

function Pill({ text, tone }: { text: string; tone: string }) {
  if (tone === 'dead') {
    return <Text style={{ fontSize: 10, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: C.borderStrong, backgroundColor: C.raised, color: C.mute, fontFamily: MONO, overflow: 'hidden' }}>{text}</Text>;
  }
  if (tone === 'warnline') {
    return <Text style={{ fontSize: 10, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: C.brand, backgroundColor: 'transparent', color: C.brand, fontFamily: MONO, overflow: 'hidden' }}>{text}</Text>;
  }
  const bg = tone === 'warn' ? C.warn : tone === 'ok' ? 'rgba(126,201,159,0.12)' : tone === 'claude' ? 'transparent' : 'rgba(106,153,255,0.12)';
  const col = tone === 'warn' ? C.warnInk : tone === 'ok' ? C.ok : tone === 'claude' ? C.brand : C.info;
  const bd = tone === 'ok' ? C.ok : tone === 'claude' ? C.brand : tone === 'warn' ? C.warn : C.info;
  return <Text style={{ fontSize: 10, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: bd, backgroundColor: bg, color: col, fontFamily: MONO, overflow: 'hidden' }}>{text}</Text>;
}

function Setup({ host, secret, discovered, cloudUrl, cloudKey, cloudSid, activeMode, pendingMode, onSave, onSaveCloud, onPaired, onSwitchMode, onCancel }: any) {
  const [scanning, setScanning] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [invite, setInvite] = useState('');
  const [cloudMsg, setCloudMsg] = useState('');
  const [pairing, setPairing] = useState(false);

  async function onScanned(data: string) {
    setScanning(false);
    try {
      let obj: any = null;
      const t = data.trim();
      if (t.startsWith('{')) obj = JSON.parse(t);
      else if (t.startsWith('clim://')) {
        const u = new URL(t);
        obj = Object.fromEntries(u.searchParams.entries());
      } else if (/^\d+\|/.test(t)) {
        const parts = t.split('|');
        if (parts[0] === '1') obj = { l: parts[1], p: parts[2], k: parts[3], s: parts[4], c: parts[5] };
      }
      if (!obj) { setCloudMsg('unknown QR format'); return; }
      // support short-key format (l/p/c/k/s) — default cloud URL if omitted, restore base64 padding on key
      let keyIn = obj.key || obj.k;
      if (keyIn && !/[=]$/.test(keyIn)) { const m = keyIn.length % 4; if (m) keyIn = keyIn + '='.repeat(4 - m); }
      obj = {
        lan: obj.lan || obj.l,
        pin: obj.pin || obj.p,
        cloud: obj.cloud || obj.c || 'wss://clim-relay.subrahmanya126.workers.dev',
        key: keyIn,
        session: obj.session || obj.s,
      };
      // Pair BOTH when present — LAN when on WiFi, cloud as fallback for remote
      let lanOk = false;
      if (obj.lan && obj.pin) {
        setCloudMsg('trying LAN…');
        const ctl = new AbortController();
        const tm = setTimeout(() => ctl.abort(), 3000);
        try {
          const r = await fetch('http://' + obj.lan + '/pair', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: String(obj.pin).trim() }),
            signal: ctl.signal,
          });
          clearTimeout(tm);
          const j = await r.json().catch(() => ({}));
          if (r.ok && j.secret) {
            await onSave(obj.lan, j.secret);
            lanOk = true;
            setCloudMsg('paired via LAN');
          }
        } catch { clearTimeout(tm); }
      }
      if (obj.cloud && obj.key && obj.session) {
        await onSaveCloud(obj.cloud, obj.key, obj.session);
        setCloudMsg(lanOk ? 'paired LAN + Cloud fallback' : 'paired via Cloud');
        onPaired && onPaired(lanOk ? 'lan' : 'cloud');
        return;
      }
      if (lanOk) { onPaired && onPaired('lan'); return; }
      setCloudMsg(obj.lan ? 'LAN unreachable + no cloud in QR' : 'QR missing fields');
    } catch (e: any) { setCloudMsg('parse failed: ' + (e?.message || 'invalid')); }
  }

  // Same parser as the camera path — the QR just carries this string. Needed
  // whenever the camera can't be used (simulator, denied permission, cracked lens).
  function applyInvite() {
    setCloudMsg('');
    const t = invite.trim();
    if (!t) { setCloudMsg('paste the invite line printed under the QR'); return; }
    onScanned(t);
  }

  const paired = !!(cloudUrl || (host && secret));
  const macName = discovered && discovered.length > 0 ? discovered[0].name : (paired ? 'your Mac' : null);

  if (scanning && CameraScreen) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.black }} edges={['top', 'bottom']}>
        <CameraScreen
          style={{ flex: 1 }}
          cameraType="back"
          scanBarcode showFrame frameColor={C.brand} laserColor={C.brand}
          onReadCode={(e: any) => onScanned(e.nativeEvent?.codeStringValue || '')}
        />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <BackBtn testID="scan-back" onPress={() => setScanning(false)} overlay />
          <Text style={{ color: C.white, fontFamily: MONO, fontSize: 12, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 }}>point at QR</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={s.root}>
      <View style={s.header}>
        {paired ? (
          <BackBtn testID="setup-back" onPress={onCancel} />
        ) : <View style={{ width: 60 }} />}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: C.text, fontFamily: MONO, fontSize: 15, fontWeight: '700' }}>cli<Text style={{ color: C.brand }}>m</Text></Text>
        </View>
        <TouchableOpacity onPress={() => setShowTutorial(true)} style={{ width: 60, alignItems: 'flex-end', padding: 4 }}>
          <Icon name="help" size={20} color={C.brand} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 22 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', paddingTop: 26 }}>
          <Icon name="prompt" size={132} color={C.brand} stroke={2} />
          <Text style={{ color: C.mute, fontFamily: MONO, fontSize: 12, marginTop: 10 }}>terminal in your pocket</Text>
        </View>

        {paired && macName ? (
          <View style={{ padding: 16, borderRadius: 12, backgroundColor: C.okBg, borderWidth: 1, borderColor: C.okBorder2, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name="check" size={22} color={C.ok} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.ok, fontFamily: MONO, fontSize: 13, fontWeight: '600' }}>connected to {macName}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, alignItems: 'center' }}>
                <Icon name={activeMode === 'cloud' ? 'cloud' : 'wifi'} size={12} color={C.mute} />
                <Text style={{ color: C.mute, fontFamily: MONO, fontSize: 11 }}>{activeMode === 'cloud' ? 'Cloud' : 'LAN'} mode</Text>
              </View>
            </View>
          </View>
        ) : null}

        <TouchableOpacity onPress={() => { if (CameraScreen) setScanning(true); else setCloudMsg('camera missing'); }}
          style={[s.saveBtn, { alignItems: 'center', paddingVertical: 20, flexDirection: 'row', justifyContent: 'center', gap: 10 }]}>
          <Icon name="scan" size={22} color={C.brandInk} />
          <Text style={[s.sendTxt, { fontSize: 16 }]}>{paired ? 'Scan new QR' : 'Scan QR to connect'}</Text>
        </TouchableOpacity>

        {/* Toggle: LAN | Cloud — tap opposite to switch (confirms) */}
        <View style={{ flexDirection: 'row', borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, padding: 3, alignSelf: 'center' }}>
          <TouchableOpacity testID="mode-lan" onPress={() => { onSwitchMode && onSwitchMode('lan'); }}
            style={{ paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: activeMode === 'lan' ? 'rgba(126,201,159,0.14)' : 'transparent' }}>
            <Icon name="wifi" size={14} color={activeMode === 'lan' ? C.ok : C.mute} />
            <Text style={{ color: activeMode === 'lan' ? C.ok : C.mute, fontFamily: MONO, fontSize: 12, fontWeight: '600' }}>LAN</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="mode-cloud" onPress={() => { onSwitchMode && onSwitchMode('cloud'); }}
            style={{ paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: activeMode === 'cloud' ? 'rgba(217,119,87,0.14)' : 'transparent' }}>
            <Icon name="cloud" size={14} color={activeMode === 'cloud' ? C.brand : C.mute} />
            <Text style={{ color: activeMode === 'cloud' ? C.brand : C.mute, fontFamily: MONO, fontSize: 12, fontWeight: '600' }}>Cloud</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: C.faint, fontFamily: MONO, fontSize: 11, textAlign: 'center', marginTop: -12 }}>
          {pendingMode && pendingMode !== activeMode
            ? String(pendingMode).toUpperCase() + ' starts on the next connection'
            : activeMode === 'lan' ? 'same WiFi as Mac' : 'anywhere in the world · encrypted'}
        </Text>

        {!!cloudMsg && <Text style={{ color: cloudMsg.includes('paired') ? C.ok : cloudMsg.includes('unreachable') || cloudMsg.includes('trying') ? C.warn : C.danger, fontFamily: MONO, fontSize: 11, textAlign: 'center' }}>{cloudMsg}</Text>}

        {/* No camera? The QR is just this line of text — paste it instead. */}
        <View style={{ gap: 8 }}>
          <Text style={{ color: C.faint, fontFamily: MONO, fontSize: 11, textAlign: 'center' }}>or paste the invite line from your Mac</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={invite} onChangeText={setInvite} placeholder="1|192.168.1.5:8787|PIN|…" placeholderTextColor={C.borderStrong}
              style={[s.setupInput, { flex: 1 }]} autoCapitalize="none" autoCorrect={false} />
            <TouchableOpacity onPress={applyInvite} style={s.cancelBtn}>
              <Text style={{ color: C.brand, fontFamily: MONO, fontWeight: '700' }}>pair</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <Tutorial visible={showTutorial} onClose={() => setShowTutorial(false)} />
    </View>
  );
}

function Tutorial({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const slides = [
    { icon: 'terminal', title: 'What is clim?', body: 'Control Claude Code, Codex and Hermes from your phone — any agent you can run in a terminal. See sessions live, tap Yes/No, send messages, from anywhere.' },
    { icon: 'wifi', title: 'LAN mode', body: 'On the same WiFi as your Mac, phone talks to it directly. Fast, private, no internet needed. Zero packets leave your router.' },
    { icon: 'cloud', title: 'Cloud mode', body: 'When you are elsewhere, packets go through a zero-knowledge relay. End-to-end encrypted with a key only your phone and Mac share.' },
    { icon: 'zap', title: 'Setup on Mac', body: 'Install once:\nnpm install -g @dingalabs/clim\n\nThen run:\nclim claude\n\nA QR pops up. Scan it with clim. Done. LAN or Cloud is auto-detected.' },
    { icon: 'shield', title: 'Live control', body: 'Yes/No prompts become tap buttons. Numbered options 1/2/3 become tap rows. Type any message — it lands in your Mac terminal like you typed it.' },
  ];
  if (!visible) return null;
  const cur = slides[idx];
  const isLast = idx === slides.length - 1;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
            <Text style={{ color: C.mute, fontFamily: MONO, fontSize: 13 }}>← back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
            <Text style={{ color: C.mute, fontFamily: MONO, fontSize: 13 }}>skip</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 1.5, borderColor: C.brand, alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
            <Icon name={cur.icon} size={44} color={C.brand} stroke={1.5} />
          </View>
          <Text style={{ color: C.text, fontFamily: MONO, fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 16 }}>{cur.title}</Text>
          <Text style={{ color: C.body, fontFamily: MONO, fontSize: 14, lineHeight: 22, textAlign: 'center' }}>{cur.body}</Text>
        </View>
        <View style={{ padding: 24, gap: 20 }}>
          <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
            {slides.map((_, i) => (
              <View key={i} style={{ width: i === idx ? 22 : 6, height: 6, borderRadius: 3, backgroundColor: i === idx ? C.brand : C.borderStrong }} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {idx > 0 && (
              <TouchableOpacity onPress={() => setIdx(idx - 1)} style={[s.cancelBtn, { flex: 1, alignItems: 'center' }]}>
                <Text style={{ color: C.text, fontFamily: MONO }}>back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => isLast ? onClose() : setIdx(idx + 1)} style={[s.saveBtn, { flex: 1, alignItems: 'center' }]}>
              <Text style={s.sendTxt}>{isLast ? 'Get started' : 'Next →'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Three states worth separating on a list: driveable now, discovered but with
// nothing listening, and finished. Everything on the sessions screen groups,
// filters and colours off this one function.
// Claude takes a while to come up — trust prompt, auto-update, first paint —
// and until it writes its first turn there is genuinely nothing to show. That
// is "starting", not "empty", and the phone should say so.
// Codex and Hermes draw boxed, 100-column TUIs. On a phone the frame is the
// worst part: border glyphs eat the width and every line wraps into mush. Keep
// the content, drop the decoration.
const BOX_ONLY = /^[\s│┃|╭╮╰╯┌┐└┘├┤┬┴┼─━═╔╗╚╝║╠╣╦╩╬▁▔·]*$/;
function cleanTerminal(text: string): string {
  const out: string[] = [];
  for (const raw of String(text || '').split('\n')) {
    if (BOX_ONLY.test(raw)) { if (out.length && out[out.length - 1] !== '') out.push(''); continue; }
    const line = raw
      .replace(/^\s*[│┃|║]\s?/, '')       // left frame
      .replace(/\s*[│┃|║]\s*$/, '')       // right frame
      .replace(/\s+$/, '');
    if (line.trim()) out.push(line);
    else if (out.length && out[out.length - 1] !== '') out.push('');
  }
  while (out.length && out[0] === '') out.shift();
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

// Codex and Hermes have no transcript, so the screen is all there is — but a
// screen is not a wall of text, it has turns in it. Both mark them:
//
//   codex     "› what the user asked"      "• what the agent answered"
//   hermes    "● what the user asked"      the reply inside a "╭─ ⚕ Hermes ─╮" box
//
// Everything else on those screens is furniture — the startup banner, the tool
// and skill listing, the model/context status bar, the composer at the bottom
// with its placeholder. Rendering the lot as one black block is what made these
// two look unfinished next to Claude.
//
// Returns null when it recognises nothing, and the caller falls back to the
// plain terminal block — a tool we have never seen is better shown raw than
// shown wrong.
const CHROME = [
  /^\s*Welcome to /,                    // hermes greeting
  /^\s*✦ Tip:/,                         // hermes tip line
  /^\s*Initializing agent/,
  /\/help for commands/,
  /^\s*⚠/,                              // update nag
  /^\s*❯/,                              // hermes composer
  /\[[█░]+\]/,                          // hermes context meter
  /·\s+\/\S*$/,                         // codex status: "model default · /path"
];
const BOX_TOP = /^\s*[╭┌]/;
const BOX_BOTTOM = /^\s*[╰└]/;
const HERMES_REPLY = /[╭┌].*⚕\s*Hermes/;   // the reply box, not the "Hermes Agent" banner

export function parseAgentTurns(text: string, tool?: string): Msg[] | null {
  const t = String(tool || '').toLowerCase();
  if (t !== 'codex' && t !== 'hermes') return null;
  const lines = String(text || '').split('\n');
  const out: Msg[] = [];
  let inBox = false, inReply = false;
  const push = (role: string, s: string) => {
    const line = s.replace(/\s+$/, '');
    if (!line.trim()) return;
    const last = out[out.length - 1];
    if (last && last.role === role) last.text += '\n' + line;
    else out.push({ role, text: line });
  };

  for (const raw of lines) {
    if (BOX_TOP.test(raw)) { inBox = true; inReply = HERMES_REPLY.test(raw); continue; }
    if (BOX_BOTTOM.test(raw)) { inBox = false; inReply = false; continue; }
    // Inside the banner or any other box: skip. Inside the reply box: keep,
    // stripping the side frames the way cleanTerminal does.
    if (inBox) {
      if (inReply) push('assistant', raw.replace(/^\s*[│┃|║]\s?/, '').replace(/\s*[│┃|║]\s*$/, ''));
      continue;
    }
    if (BOX_ONLY.test(raw)) continue;                 // rules and separators
    if (CHROME.some((re) => re.test(raw))) continue;

    const user = raw.match(/^\s*[›●]\s+(.*)$/);
    if (user) { push('user', user[1]); continue; }
    const asst = raw.match(/^\s*[•✱]\s+(.*)$/);
    if (asst) { push('assistant', asst[1]); continue; }
    // An unmarked line continues whichever turn is open; before any turn has
    // started it is still banner, so it is dropped.
    if (out.length) push(out[out.length - 1].role, raw);
  }

  // A wrapped line keeps the indent the TUI used to align it under the marker,
  // which on a narrow phone reads as ragged prose. Remove the indent the whole
  // turn shares — relative indentation inside it, like a code block, survives.
  for (const m of out) {
    const [head, ...rest] = m.text.split('\n');
    if (!rest.length) continue;
    const pad = Math.min(...rest.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length));
    m.text = [head, ...rest.map((l) => l.slice(pad))].join('\n');
  }

  // The composer sits at the bottom and looks exactly like a user turn — codex
  // even pre-fills it with "Implement {feature}". If the last thing on screen is
  // a user turn with no reply under it, that is the input box, not a turn.
  if (out.length && out[out.length - 1].role === 'user') out.pop();
  return out.length ? out : null;
}

/** CLAUDE, CODEX, or whatever was wrapped. Scan-found sessions are Claude. */
function toolName(s: Session): string {
  return String(s.tool || 'claude').toUpperCase().slice(0, 10);
}

function isStarting(s: Session): boolean {
  // A codex or hermes session has no transcript and no parsed messages, so it
  // read as "still booting" for its whole life. Its screen is proof it is up.
  return !s.closed && !!(s.pty || s.tmuxTarget)
    && !s.transcriptPath && !(s.messages || []).length && !(s.lines || []).length
    && !(s.screen || '').trim();
}

type Bucket = 'live' | 'detached' | 'closed';
function bucketOf(s: Session): Bucket {
  if (s.closed) return 'closed';
  if (s.pty || s.tmuxTarget || (s.tty && s.terminalApp)) return 'live';
  return 'detached';
}
function bucketCounts(list: Session[]) {
  const c = { live: 0, detached: 0, closed: 0 };
  for (const s of list) c[bucketOf(s)]++;
  return c;
}
function latestTs(list: Session[], bucket: Bucket) {
  return list.filter((s) => bucketOf(s) === bucket).reduce((m, s) => Math.max(m, s.ts || 0), 0) || Date.now();
}
// /Users/someone/Desktop → ~/Desktop. The phone never needs the home prefix.
function shortPath(cwd?: string) {
  if (!cwd) return '~/';
  const m = cwd.match(/^\/(?:private\/)?(?:Users|home)\/[^/]+(\/.*)?$/);
  return m ? '~' + (m[1] || '/') : cwd;
}
function imageCount(title?: string) {
  return title ? (title.match(/\[Image #\d+\]/g) || []).length : 0;
}
function cleanTitle(title?: string) {
  return (title || '').replace(/\[Image #\d+\]\s*/g, '').trim();
}

function ago(ts: number) {
  const d = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (d < 60) return d + 's';
  if (d < 3600) return Math.floor(d / 60) + 'm';
  if (d < 86400) return Math.floor(d / 3600) + 'h';
  return Math.floor(d / 86400) + 'd';
}

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string;
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  brand: { color: C.mute, fontFamily: MONO, fontSize: 13 },
  brandBold: { color: C.brand, fontWeight: '700' },
  title: { color: C.text, fontFamily: MONO, fontSize: 13, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 8, borderWidth: 1, borderColor: C.borderStrong, backgroundColor: C.raised },
  backBtnOverlay: { backgroundColor: 'rgba(0,0,0,0.65)', borderColor: 'rgba(255,255,255,0.25)' },
  backLabel: { color: C.text, fontFamily: MONO, fontSize: 13, fontWeight: '600' },
  status: { fontFamily: MONO, fontSize: 11 },
  statusOk: { color: C.ok }, statusBad: { color: C.brand },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { color: C.text, fontFamily: MONO, fontSize: 14, marginBottom: 6 },
  emptyText: { color: C.brand, fontFamily: MONO, fontStyle: 'italic', fontSize: 14 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 12, marginBottom: 10 },
  screenTitle: { flex: 1, textAlign: 'center', color: C.text, fontFamily: MONO, fontSize: 13, fontWeight: '600' },
  // Devices
  deviceCard: { marginBottom: 10, flexDirection: 'row', alignItems: 'stretch', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, overflow: 'hidden' },
  deviceName: { flex: 1, color: C.text, fontFamily: MONO, fontSize: 15, fontWeight: '700' },
  deviceMeta: { color: C.mute, fontFamily: MONO, fontSize: 11 },
  chevron: { color: C.faint, fontSize: 26, alignSelf: 'center', paddingRight: 12 },
  pairHint: { color: C.brand, fontFamily: MONO, fontSize: 11 },
  fab: { position: 'absolute', right: 16, bottom: 24, backgroundColor: C.brand, width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', shadowColor: C.black, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  setCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, overflow: 'hidden' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.hairline },
  setLabel: { color: C.text, fontFamily: MONO, fontSize: 13 },
  setHint: { color: C.mute, fontFamily: MONO, fontSize: 11, marginTop: 2 },
  setVersion: { color: C.faint, fontFamily: MONO, fontSize: 11, textAlign: 'center', marginTop: 22 },
  emptyHint: { color: C.mute, fontFamily: MONO, fontSize: 12, textAlign: 'center', padding: 24, lineHeight: 20 },
  // Sessions
  chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: C.borderStrong },
  chipOnAll: { backgroundColor: C.white, borderColor: C.white },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 6 },
  groupLabel: { color: C.mute, fontFamily: MONO, fontSize: 11, letterSpacing: 1.5 },
  groupMeta: { color: C.mute2, fontFamily: MONO, fontSize: 11 },
  sCard: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, marginBottom: 10, overflow: 'hidden' },
  rail: { width: 3 },
  sTitle: { flex: 1, color: C.text, fontFamily: MONO, fontSize: 14, fontWeight: '700' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  dotLive: { backgroundColor: C.ok },
  dotDetached: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.brand },
  dotDead: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.mute2 },
  cardOpt: { borderColor: C.brand }, cardRunning: { borderColor: C.warn },
  cardClosed: { opacity: 0.55, borderColor: C.borderMid, backgroundColor: C.panel },
  dimText: { color: C.mute },
  errBar: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(229,107,107,0.10)', borderTopWidth: 1, borderTopColor: C.dangerBorder },
  errText: { color: C.danger, fontFamily: MONO, fontSize: 11 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: C.text, fontFamily: MONO, fontSize: 13, fontWeight: '600', flex: 1, marginRight: 8 },
  cwd: { color: C.dim, fontFamily: MONO, fontSize: 11, flex: 1 },
  ago: { color: C.mute, fontFamily: MONO, fontSize: 11, marginLeft: 4 },
  line: { color: C.body, fontFamily: MONO, fontSize: 12, marginTop: 2 },
  marker: { color: C.brand },
  termWrap: { flex: 1, margin: 8, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 8, overflow: 'hidden' },
  termHead: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bar, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border, gap: 8 },
  traffic: { flexDirection: 'row', gap: 5, width: 60 },
  trafficDot: { width: 11, height: 11, borderRadius: 6 },
  termHeadTitle: { flex: 1, textAlign: 'center', color: C.mute, fontFamily: MONO, fontSize: 11 },
  modeBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.bar, borderTopWidth: 1, borderTopColor: C.border },
  notifToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, borderWidth: 1, borderColor: C.okBorder, backgroundColor: 'rgba(126,201,159,0.08)' },
  notifLabel: { color: C.ok, fontFamily: MONO, fontSize: 10 },
  modeText: { fontFamily: MONO, fontSize: 11 },
  termBody: { flex: 1, backgroundColor: C.panel },
  msg: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'flex-start' },
  iconWrap: { width: 18, alignItems: 'center', paddingTop: 2 },
  icClaude: { color: C.brand, fontSize: 14 },
  icUser: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.ok, marginTop: 4 },
  msgText: { flex: 1, color: C.body, fontFamily: MONO, fontSize: 13, lineHeight: 20 },
  msgUser: { color: C.userText },
  // Tool machinery: present, but clearly not something Claude said.
  bellBtn: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: C.okBorder, backgroundColor: 'rgba(126,201,159,0.10)', alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  bellBtnOff: { borderColor: C.borderStrong, backgroundColor: C.card },
  mdBold: { color: C.white, fontWeight: '700' },
  table: { borderWidth: 1, borderColor: C.borderMid, borderRadius: 6, marginVertical: 6, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.hairline },
  tableHeadRow: { borderTopWidth: 0, backgroundColor: C.card },
  tableCell: { flex: 1, color: C.body, fontFamily: MONO, fontSize: 11, lineHeight: 16, paddingHorizontal: 7, paddingVertical: 5 },
  tableHeadCell: { color: C.text, fontWeight: '700' },
  mdCode: { color: C.warn, backgroundColor: C.raised },
  mdHeading: { color: C.brand, fontWeight: '700', fontSize: 14 },
  mdMarker: { color: C.brand },
  mdItalic: { fontStyle: 'italic', color: C.body },
  mdLink: { color: C.info, textDecorationLine: 'underline' },
  mdRule: { height: 1, backgroundColor: C.borderMid, marginVertical: 8 },
  mdQuote: { borderLeftWidth: 3, borderLeftColor: C.borderStrong, paddingLeft: 8, marginVertical: 3 },
  mdQuoteText: { color: C.mute, fontStyle: 'italic' },
  codeBlock: { backgroundColor: C.bar, borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 8, marginVertical: 6 },
  codeLang: { color: C.mute2, fontFamily: MONO, fontSize: 9, marginBottom: 4, textTransform: 'uppercase' },
  codeText: { color: C.codeText, fontFamily: MONO, fontSize: 11, lineHeight: 16 },
  toolText: { color: C.tool, fontFamily: MONO, fontSize: 11, lineHeight: 16 },
  toolBlock: { backgroundColor: C.panel, borderLeftWidth: 2, borderLeftColor: C.borderMid, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 5, marginVertical: 3 },
  toolChevron: { color: C.faint },
  toolMore: { color: C.faint, fontFamily: MONO, fontSize: 10, marginTop: 2 },
  toolPreview: { color: C.mute2, fontSize: 11 },
  termBlock: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.hairline, borderRadius: 6, padding: 10, marginBottom: 12 },
  termBlockText: { color: C.mute, fontFamily: MONO, fontSize: 11, lineHeight: 16 },
  opts: { padding: 10, gap: 6, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bar },
  tapRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: C.borderStrong },
  tapRowChecked: { backgroundColor: 'rgba(217,119,87,0.12)', borderColor: C.brand },
  tapK: { fontFamily: MONO, fontSize: 16, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  tapLbl: { flex: 1, color: C.text, fontFamily: MONO, fontSize: 13 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: C.brand },
  checkboxOn: { backgroundColor: C.brand },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 8, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bar },
  caret: { color: C.brand, fontFamily: MONO, fontSize: 14, paddingTop: 10, fontWeight: '700' },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.bg, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 8, paddingLeft: 10, minHeight: 40, maxHeight: 160 },
  input: { flex: 1, color: C.text, fontFamily: MONO, fontSize: 13, paddingVertical: 9, paddingRight: 10, paddingLeft: 6, maxHeight: 160 },
  sendBtn: { backgroundColor: C.brand, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  sendTxt: { color: C.brandInk, fontFamily: MONO, fontWeight: '700' },
  lbl: { color: C.mute, fontFamily: MONO, fontSize: 11 },
  setupInput: { color: C.text, fontFamily: MONO, fontSize: 13, padding: 10, backgroundColor: C.panel, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 8 },
  saveBtn: { backgroundColor: C.brand, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: C.borderStrong },
  discRow: { padding: 12, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 8, backgroundColor: C.panel, gap: 4 },
  discCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, marginBottom: 10 },
  tabBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, alignItems: 'center' },
  tabBtnActive: { borderColor: C.brand, backgroundColor: 'rgba(217,119,87,0.10)' },
  tabTxt: { color: C.mute, fontFamily: MONO, fontSize: 12 },
  tabTxtActive: { color: C.brand, fontWeight: '700' },
});
