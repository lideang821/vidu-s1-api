import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';

const EXAMPLE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_ROOT = path.join(EXAMPLE_ROOT, 'public');
const EDITING_TYPES = ['style_transfer', 'virtual_tryon', 'subject_replacement', 'background_replacement'];
const ROUTES = { avatar: '/live/s_avatar/realtime', editing: '/live/s_editing/realtime' };
const MAX_SIGNAL_BYTES = 6 * 1024 * 1024; // A 4 MB editing image grows to ~5.4 MB in base64.

export function createQuickstartServer({
  host = 'api.vidu.cn', apiKey = '', defaults = {},
  httpOrigin = `https://${host}`, wsOrigin = `wss://${host}`,
  retryMs = 2000, initTimeoutMs = 120000
} = {}) {
  const sessions = new Map();
  const token = apiKey.trim().replace(/^Token\s+/, '');
  const hasApiKey = token.startsWith('vda_') && !token.includes('your_api_key_here');
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_SIGNAL_BYTES });
  const config = {
    host, has_api_key: hasApiKey,
    defaults: {
      avatar: {
        call_mode: defaults.call_mode || 'video', character_id: '1',
        avatar: {
          image_uri: defaults.image_uri || '',
          persona: defaults.persona || 'You are Sweet Tina, a warm and friendly digital character.',
          name: defaults.name || 'Tina', voice: defaults.voice || 'Tina', persona_enhance: false
        }
      },
      editing: { image_url: defaults.editing_image_url || '', editing_type: defaults.editing_type || 'style_transfer' }
    }
  };

  function authorization() {
    if (!hasApiKey) throw httpError(503, 'Set VIDU_API_KEY to your region’s vda_... API key in .env.');
    return `Token ${token}`;
  }

  async function viduFetch(route, options = {}) {
    const response = await fetch(`${httpOrigin}${route}`, {
      ...options, signal: AbortSignal.timeout(60000),
      headers: { Authorization: authorization(), 'Content-Type': 'application/json', Accept: 'application/json' }
    });
    const body = await response.text();
    const data = safeJson(body);
    if (!response.ok) throw httpError(response.status, data?.error?.message || data?.message || `Vidu API returned HTTP ${response.status}.`);
    if (!data) throw httpError(502, 'Vidu API returned invalid JSON.');
    return data;
  }

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (request.method === 'GET' && url.pathname === '/health') {
        sendJson(response, 200, { ok: true, host, has_api_key: hasApiKey });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/config') {
        sendJson(response, 200, config);
        return;
      }
      const createMatch = url.pathname.match(/^\/api\/(avatar|editing)\/lives$/);
      if (request.method === 'POST' && createMatch) {
        authorization();
        const mode = createMatch[1];
        const body = await readJsonBody(request);
        const payload = buildPayload(mode, body, config.defaults[mode]);
        const data = await viduFetch(ROUTES[mode], { method: 'POST', body: JSON.stringify(payload) });
        const id = data.live?.id;
        if (typeof id !== 'string' || !id || !data.rtc?.token || (mode === 'editing' && !data.render_uid)) {
          throw httpError(502, 'Vidu response is missing live.id (string), RTC credentials, or editing render_uid.');
        }
        const session = { id, mode, callMode: payload.call_mode || 'video', clientSecret: data.client_secret, proxy: null };
        const duration = Number(data.live.live_duration);
        session.timer = setTimeout(() => {
          session.proxy?.shutdown(true);
          sessions.delete(id);
        }, ((duration > 0 ? duration : 7200) + 120) * 1000);
        session.timer.unref();
        sessions.set(id, session);
        // The reusable API key and editing control credential stay on the server.
        sendJson(response, 200, { live: data.live, rtc: data.rtc, ...(mode === 'editing' ? { render_uid: data.render_uid } : {}) });
        return;
      }
      const queryMatch = url.pathname.match(/^\/api\/avatar\/lives\/([^/]+)$/);
      if (request.method === 'GET' && queryMatch) {
        const id = decodeURIComponent(queryMatch[1]);
        const data = await viduFetch(`/live/v1/lives/${encodeURIComponent(id)}`);
        sendJson(response, 200, data);
        return;
      }
      if (request.method === 'GET' && !url.pathname.startsWith('/api/')) {
        await serveStatic(url.pathname, response);
        return;
      }
      sendJson(response, 404, { error: 'Not found.' });
    } catch (error) {
      sendJson(response, error.statusCode || 500, { error: error.message });
    }
  });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, 'http://localhost');
    const session = sessions.get(url.searchParams.get('live_id'));
    if (url.pathname !== '/ws/live' || !session || session.proxy) {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      return;
    }
    wss.handleUpgrade(request, socket, head, client => {
      const proxy = new LiveControlProxy(client, session, {
        wsOrigin, authorization: authorization(), retryMs,
        initTimeoutMs: session.mode === 'avatar' ? Math.min(initTimeoutMs, 60000) : initTimeoutMs,
        onClose: () => { clearTimeout(session.timer); sessions.delete(session.id); }
      });
      session.proxy = proxy;
      proxy.start();
    });
  });
  server.on('close', () => {
    for (const session of sessions.values()) {
      clearTimeout(session.timer);
      session.proxy?.shutdown(true);
    }
    sessions.clear();
    wss.close();
  });
  return server;
}

function buildPayload(mode, body, defaults) {
  if (mode === 'editing') {
    const image = body.image_url ?? defaults.image_url;
    validateImage(image, true);
    const editingType = body.editing_type ?? defaults.editing_type;
    validateEditingType(editingType);
    return { image_url: image, editing_type: editingType };
  }
  const callMode = body.call_mode ?? defaults.call_mode;
  if (!['audio', 'video'].includes(callMode)) throw httpError(400, 'call_mode must be audio or video.');
  if (body.avatar !== undefined && (!body.avatar || typeof body.avatar !== 'object' || Array.isArray(body.avatar))) {
    throw httpError(400, 'avatar must be an object.');
  }
  const avatar = { ...defaults.avatar, ...body.avatar };
  validateImage(avatar.image_uri);
  if (typeof avatar.persona !== 'string' || !avatar.persona.trim() || avatar.persona.length > 50000) {
    throw httpError(400, 'avatar.persona must contain 1–50,000 characters.');
  }
  if (avatar.persona_enhance !== undefined && typeof avatar.persona_enhance !== 'boolean') {
    throw httpError(400, 'avatar.persona_enhance must be a boolean.');
  }
  const characterId = body.character_id ?? defaults.character_id;
  if (typeof characterId !== 'string' || !/^\d+$/.test(characterId)) throw httpError(400, 'character_id must be a numeric string.');
  const result = { persona: avatar.persona, image_uri: avatar.image_uri };
  for (const key of ['name', 'voice']) {
    if (avatar[key] !== undefined && typeof avatar[key] !== 'string') throw httpError(400, `avatar.${key} must be a string.`);
    if (avatar[key]) result[key] = avatar[key];
  }
  if (callMode === 'video') result.persona_enhance = Boolean(avatar.persona_enhance);
  return { call_mode: callMode, character_id: characterId, avatar: result };
}

function validateImage(value, editing = false) {
  if (typeof value !== 'string' || !( /^https?:\/\/\S+$/i.test(value) || /^data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=\s]+$/.test(value) || (editing && /^ssupload:\?id=\S+/.test(value)))) {
    throw httpError(400, 'Provide an image URL or base64 image data URI. Editing also accepts a platform upload URI.');
  }
}

function validateEditingType(value) {
  if (!EDITING_TYPES.includes(value)) throw httpError(400, `editing_type must be one of: ${EDITING_TYPES.join(', ')}.`);
}

class LiveControlProxy {
  constructor(client, session, options) {
    Object.assign(this, { client, session, ...options });
    this.connId = randomUUID();
    this.seqId = 0;
    this.ready = false;
    this.closed = false;
    this.hangupSent = false;
  }

  start() {
    const query = new URLSearchParams({ live_id: this.session.id, conn_id: this.connId });
    if (this.session.clientSecret) query.set('client_secret', this.session.clientSecret);
    this.remote = new WebSocket(`${this.wsOrigin}/live/ws/live/connect?${query}`, {
      headers: { Authorization: this.authorization }, handshakeTimeout: 15000, maxPayload: MAX_SIGNAL_BYTES
    });
    this.client.on('message', data => this.handleClientMessage(data));
    this.client.on('close', () => this.shutdown());
    this.client.on('error', () => this.shutdown());
    this.initTimer = setTimeout(() => this.fail('Initialization timed out. Create a new session.'), this.initTimeoutMs);
    this.remote.on('open', () => {
      if (this.closed) return;
      this.sendClient({ event: 'remote_open' });
      this.sendSignal(1, { conn_init: { version: 1 } });
    });
    this.remote.on('message', data => {
      if (this.closed) return;
      const message = safeJson(data.toString());
      if (!message) return;
      this.sendClient({ event: 'vidu_message', message });
      const ack = message.payload?.conn_init_ack;
      if (message.type === 2 && ack) {
        if (ack.success === true) {
          clearTimeout(this.initTimer);
          clearTimeout(this.retryTimer);
          this.ready = true;
          this.sendClient({ event: 'on_live', live_id: this.session.id });
        } else if (ack.error_code === 'NOT_READY') {
          this.sendClient({ event: 'not_ready' });
          // Editing pushes a success ack when ready. Avatar needs conn_init retried on this socket.
          if (this.session.mode === 'avatar' && !this.ready) {
            clearTimeout(this.retryTimer);
            this.retryTimer = setTimeout(() => this.sendSignal(1, { conn_init: { version: 1 } }), this.retryMs);
          }
        } else {
          this.fail(ack.error_msg || ack.error_code || 'Initialization failed.');
        }
      }
      if (message.type === 6) {
        this.sendClient({ event: 'server_hangup', reason: message.payload?.hangup?.hangup_reason || 'unknown' });
        this.shutdown(true, false);
      }
    });
    // ws automatically responds to upstream ping frames with pong frames.
    this.remote.on('error', () => this.fail('Vidu WebSocket connection failed. Check the API key, region, and connection.'));
    this.remote.on('close', (code) => {
      if (!this.closed) {
        this.sendClient({ event: 'remote_closed', code });
        this.shutdown(true, false);
      }
    });
  }

  handleClientMessage(data) {
    if (this.closed) return;
    try {
      const message = safeJson(data.toString());
      if (message?.action === 'hangup') {
        this.shutdown(true);
        return;
      }
      if (!this.ready) throw httpError(409, 'Wait for the session to become ready.');
      if (message?.action === 'text' && this.session.mode === 'avatar') {
        if (typeof message.content !== 'string' || !message.content.trim()) throw httpError(400, 'Text is required.');
        this.sendSignal(99, { text_msg: { msg_id: randomUUID(), content: message.content.trim(), timestamp: Date.now() } });
        this.sendClient({ event: 'text_sent' });
        return;
      }
      if (message?.action === 'switch_prompt' && this.session.mode === 'editing') {
        const prompt = {};
        if (message.image_url) {
          validateImage(message.image_url, true);
          prompt.prompts = [{ type: 'image', content: message.image_url }];
        }
        if (message.editing_type !== undefined) {
          validateEditingType(message.editing_type);
          prompt.editing_type = message.editing_type;
        }
        if (!Object.keys(prompt).length) throw httpError(400, 'Provide a new image or editing type.');
        this.sendSignal(13, { switch_prompt: prompt });
        this.sendClient({ event: 'switch_prompt_sent' });
        return;
      }
      throw httpError(400, 'Unsupported action for this session.');
    } catch (error) {
      this.sendClient({ event: 'action_error', message: error.message });
    }
  }

  sendSignal(type, payload) {
    if (this.remote?.readyState === WebSocket.OPEN) {
      this.remote.send(JSON.stringify({ type, live_id: this.session.id, conn_id: this.connId, seq_id: ++this.seqId, payload }));
    }
  }

  sendClient(message) {
    if (this.client.readyState === WebSocket.OPEN) this.client.send(JSON.stringify(message));
  }

  fail(message) {
    if (this.closed) return;
    this.sendClient({ event: 'fatal', message });
    this.shutdown(true);
  }

  shutdown(closeClient = false, hangup = true) {
    if (this.closed) return;
    if (hangup && !this.hangupSent) {
      this.sendSignal(5, { hangup: { hangup_reason: 'user_end' } });
      this.hangupSent = true;
    }
    this.closed = true;
    clearTimeout(this.initTimer);
    clearTimeout(this.retryTimer);
    if (this.remote?.readyState < WebSocket.CLOSING) this.remote.close(1000, 'session ended');
    if (closeClient && this.client.readyState < WebSocket.CLOSING) this.client.close(1000, 'session ended');
    this.onClose();
  }
}

async function serveStatic(pathname, response) {
  const aliases = { '/': '/index.html', '/avatar': '/avatar.html', '/editing': '/editing.html' };
  const filePath = path.resolve(PUBLIC_ROOT, `.${decodeURIComponent(aliases[pathname] || pathname)}`);
  if (!filePath.startsWith(`${PUBLIC_ROOT}${path.sep}`)) throw httpError(403, 'Forbidden.');
  try {
    const body = await readFile(filePath);
    const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
    response.writeHead(200, { 'Content-Type': `${types[path.extname(filePath)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' });
    response.end(body);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') throw httpError(404, 'Not found.');
    throw error;
  }
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 28 * 1024 * 1024) throw httpError(413, 'Request body is too large.');
    chunks.push(chunk);
  }
  const data = safeJson(Buffer.concat(chunks).toString());
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw httpError(400, 'Request body must be a JSON object.');
  return data;
}

function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

function httpError(statusCode, message) { return Object.assign(new Error(message), { statusCode }); }
function safeJson(text) { try { return JSON.parse(text); } catch { return null; } }

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const raw = match[2].trim();
    process.env[match[1]] = /^(".*"|'.*')$/.test(raw) ? raw.slice(1, -1) : raw;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadDotEnv(path.resolve(EXAMPLE_ROOT, '../../.env'));
  loadDotEnv(path.join(EXAMPLE_ROOT, '.env'));
  const host = (process.env.VIDU_HOST || 'api.vidu.cn').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const port = Number(process.env.NODE_QUICKSTART_PORT || process.env.PORT || 8787);
  createQuickstartServer({
    host, apiKey: process.env.VIDU_API_KEY || process.env.VIDU_TOKEN || '',
    defaults: {
      call_mode: process.env.VIDU_CALL_MODE, image_uri: process.env.VIDU_AVATAR_IMAGE_URI,
      persona: process.env.VIDU_AVATAR_PERSONA, name: process.env.VIDU_AVATAR_NAME, voice: process.env.VIDU_AVATAR_VOICE,
      editing_image_url: process.env.VIDU_EDITING_IMAGE_URL, editing_type: process.env.VIDU_EDITING_TYPE
    }
  }).listen(port, '127.0.0.1', () => {
    console.log(`Vidu S2 Node quickstart: http://localhost:${port} (Avatar / Editing)`);
    console.log(`Using Vidu host ${host}`);
  });
}
