// clim Cloudflare Worker relay — WS fan-out via Durable Objects
// Room = single instance per session id → all peers naturally colocate → no cross-isolate issue.

export interface Env { ROOMS: DurableObjectNamespace }

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/health') return new Response('ok-cf-durable');
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    if (url.pathname === '/status') {
      return new Response(`clim relay — zero-knowledge (cloudflare worker + durable objects)`, {
        headers: { 'content-type': 'text/plain' },
      });
    }
    if (url.pathname === '/relay') {
      const sid = url.searchParams.get('session');
      if (!sid || sid.length > 128) return new Response('bad session', { status: 400 });
      const id = env.ROOMS.idFromName(sid);
      const stub = env.ROOMS.get(id);
      return stub.fetch(req);
    }
    return new Response('not found', { status: 404 });
  },
};

// A room is one Mac and its phones. Anyone who learns a room id can open a
// socket to it — the payloads stay unreadable without the shared key, but the
// socket itself is free, so the room caps what an uninvited peer can cost.
const MAX_PEERS = 8;                 // a Mac, its phones, and slack for reconnects
const MAX_FRAME = 256 * 1024;        // matches the LAN relay's maxPayload

export class Room {
  state: DurableObjectState;
  constructor(state: DurableObjectState) { this.state = state; }

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('upgrade') !== 'websocket') return new Response('need websocket', { status: 400 });
    // Without this one room could be held open by unlimited sockets, each one
    // keeping this object resident and amplifying every broadcast.
    if (this.state.getWebSockets().length >= MAX_PEERS) return new Response('room full', { status: 429 });

    const url = new URL(req.url);
    const role = url.searchParams.get('role') === 'mac' ? 'mac' : 'phone';
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Hibernation, not `server.accept()`. A relayed session is idle almost all
    // of the time — someone thinking, or a laptop sitting open overnight — and
    // an accepted socket pins this object in memory for as long as it is open.
    // Hibernating lets the runtime evict the object between messages and bring
    // it back on the next one, so N connected people no longer means N objects
    // resident (and billed for duration) for the whole session.
    this.state.acceptWebSocket(server);
    // Survives eviction: plain instance fields do not.
    server.serializeAttachment({ role });

    // Role only — no timestamp. The relay is meant to know as little as possible.
    this.broadcast(server, JSON.stringify({ type: 'peer', role }));
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string') return;            // binary is never used
    if (message.length > MAX_FRAME) return;             // drop, do not fan out
    this.broadcast(ws, message);
  }

  // Departures matter as much as arrivals: without this a phone whose Mac died
  // kept showing a live session forever, because nothing ever told it.
  webSocketClose(ws: WebSocket) { this.departed(ws); }
  webSocketError(ws: WebSocket) { this.departed(ws); }

  departed(ws: WebSocket) {
    let role = 'phone';
    try { role = ((ws.deserializeAttachment() || {}) as any).role || 'phone'; } catch {}
    this.broadcast(ws, JSON.stringify({ type: 'peer-left', role }));
  }

  // The socket list IS the room's state — nothing else is kept, and nothing is
  // ever written to storage, so there is no per-room memory that can grow.
  broadcast(from: WebSocket, data: string) {
    for (const c of this.state.getWebSockets()) {
      if (c === from) continue;
      try { c.send(data); } catch {}
    }
  }
}

const HTML = `<!doctype html><html><body style="background:#0a0a0a;color:#eee;font-family:monospace;padding:24px"><h2>clim cloud relay</h2><p>WS endpoint: <code>/relay?session=&lt;id&gt;&amp;role=mac|phone</code></p><p>Web UI: use native clim app — download from getclim.netlify.app</p></body></html>`;
