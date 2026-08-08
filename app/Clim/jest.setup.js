// Native modules the app talks to, replaced with the shapes the UI depends on.
// Everything the app already guards with try/catch (zeroconf, notifee, camera,
// svg) is left alone — it degrades on its own.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const passthrough = ({ children }) => React.createElement(View, null, children);
  return {
    SafeAreaProvider: passthrough,
    SafeAreaView: passthrough,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// react-native-svg resolves under jest but its exports are not renderable
// components there, which blows up every screen that draws an icon.
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const stub = (name) => {
    const C = ({ children }) => React.createElement(View, null, children);
    C.displayName = name;
    return C;
  };
  return {
    __esModule: true,
    default: stub('Svg'),
    Svg: stub('Svg'), Path: stub('Path'), Circle: stub('Circle'),
    Rect: stub('Rect'), Line: stub('Line'), G: stub('G'),
  };
});

// Push notifications, so a test can count what would actually have buzzed.
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(() => Promise.resolve()),
    requestPermission: jest.fn(() => Promise.resolve()),
    displayNotification: jest.fn(() => Promise.resolve()),
    onForegroundEvent: jest.fn((fn) => { global.__pressNotification = (data) => fn({ type: 1, detail: { notification: { data } } }); return () => {}; }),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
  },
  AndroidImportance: { HIGH: 4 },
  EventType: { PRESS: 1 },
}));

// Bonjour discovery, driven by hand so a test can feed the exact adverts a Mac
// produces after a few relay restarts.
jest.mock('react-native-zeroconf', () => {
  const listeners = {};
  class Zeroconf {
    on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
    scan() {}
    stop() {}
  }
  global.__emitZeroconf = (services) => {
    for (const svc of services) for (const fn of listeners.resolved || []) fn(svc);
  };
  return { __esModule: true, default: Zeroconf };
});

// Keep the registered hardware-back handlers so a test can press the Android
// back button the way the OS does, and see whether it was consumed.
jest.mock('react-native/Libraries/Utilities/BackHandler', () => {
  const handlers = [];
  return {
    addEventListener: (_evt, fn) => {
      handlers.push(fn);
      return { remove: () => { const i = handlers.indexOf(fn); if (i >= 0) handlers.splice(i, 1); } };
    },
    removeEventListener: (_evt, fn) => { const i = handlers.indexOf(fn); if (i >= 0) handlers.splice(i, 1); },
    exitApp: () => {},
    __handlers: handlers,
  };
});
// true = a screen handled it; false = the OS would close the app.
global.__pressAndroidBack = () => {
  const { __handlers } = require('react-native/Libraries/Utilities/BackHandler');
  return __handlers.slice().reverse().some((fn) => fn() === true);
};

// One socket at a time is all the app opens per transport; the test drives it
// by hand so message ordering is explicit rather than timing-dependent.
class FakeWebSocket {
  static last = null;
  static instances = [];
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    FakeWebSocket.last = this;
    FakeWebSocket.instances.push(this);
  }
  send(data) { this.sent.push(data); }
  close() { this.readyState = 3; if (this.onclose) this.onclose({}); }
  // — test controls —
  open() { this.readyState = 1; if (this.onopen) this.onopen({}); }
  emit(obj) { if (this.onmessage) this.onmessage({ data: JSON.stringify(obj) }); }
}
global.WebSocket = FakeWebSocket;
global.__FakeWebSocket = FakeWebSocket;

global.fetch = jest.fn(() =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, mode: 'pty' }) }));
