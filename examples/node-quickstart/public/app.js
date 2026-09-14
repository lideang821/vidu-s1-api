import { t, label } from './i18n.js';

const mode = document.body.dataset.demo;
const $ = selector => document.querySelector(selector);
const form = $('#createForm');
const localVideo = $('#localVideo');
const remoteVideo = $('#remoteVideo');
let active = null;
let configured = false;
let ending = false;
const editingPresets = {
  style_transfer: {
    url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1024&q=85',
    label: 'sampleStyle'
  },
  virtual_tryon: {
    url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=1024&q=85',
    label: 'sampleOutfit'
  },
  subject_replacement: {
    url: 'https://scene.vidu.zone/media-asset/083014-Qww8rvO5sOtAKZW8.png',
    label: 'sampleSubject'
  },
  background_replacement: {
    url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1280&q=85',
    label: 'sampleBackground'
  }
};
const images = mode === 'editing' ? {
  initial: imageInput('image', form.elements.editing_type),
  next: imageInput('switchImage', $('#switchEditingType'))
} : {};

boot();

async function boot() {
  try {
    const config = await requestJson('/api/config');
    configured = config.has_api_key;
    $('#hostLabel').textContent = config.host;
    label($('#apiKeyState'), configured ? 'ready' : 'missingKey');
    $('#apiKeyState').classList.add(configured ? 'ready' : 'missing');
    const defaults = config.defaults[mode];
    if (mode === 'avatar') {
      for (const [key, value] of Object.entries({ call_mode: defaults.call_mode, character_id: defaults.character_id, ...defaults.avatar })) {
        const input = form.elements.namedItem(key);
        if (!input) continue;
        if (input.type === 'checkbox') input.checked = Boolean(value);
        else input.value = value;
      }
      updateCallMode();
    } else {
      form.elements.editing_type.value = defaults.editing_type;
      $('#switchEditingType').value = defaults.editing_type;
      images.initial.setUrl(defaults.image_url);
      images.next.update();
    }
    if (!configured) notice(t('keyHint'));
    $('#startButton').disabled = !configured;
  } catch (error) { notice(error.message); }
}

function updateCallMode() {
  form.elements.persona_enhance.disabled = form.elements.call_mode.value !== 'video';
}
form.elements.call_mode?.addEventListener('change', updateCallMode);
form.addEventListener('submit', event => { event.preventDefault(); startCall(); });
$('#hangupButton').addEventListener('click', () => endSession(active));
$('#clearLog').addEventListener('click', () => { $('#eventLog').replaceChildren(); });

async function startCall() {
  if (active || ending) return;
  const session = { ended: false, controlReady: false, rtcReady: false };
  active = session;
  $('#createFields').disabled = true;
  notice('');
  status('creating');
  try {
    const payload = mode === 'avatar' ? {
      call_mode: form.elements.call_mode.value,
      character_id: form.elements.character_id.value,
      avatar: {
        image_uri: form.elements.image_uri.value.trim(), persona: form.elements.persona.value.trim(),
        name: form.elements.name.value.trim(), voice: form.elements.voice.value.trim(),
        persona_enhance: form.elements.call_mode.value === 'video' && form.elements.persona_enhance.checked
      }
    } : { image_url: images.initial.value(), editing_type: form.elements.editing_type.value };
    session.callMode = payload.call_mode || 'video';
    const data = await requestJson(`/api/${mode}/lives`, { method: 'POST', body: JSON.stringify(payload) });
    session.data = data;
    $('#sessionOutput').textContent = JSON.stringify({
      live: data.live, rtc: { ...data.rtc, token: `[${String(data.rtc.token).length} characters]` },
      ...(data.render_uid ? { render_uid: data.render_uid } : {})
    }, null, 2);
    log('live_created', { live_id: data.live.id, render_uid: data.render_uid });
    const ready = connectControl(session);
    const join = () => { session.joinTask = joinRtc(session); return session.joinTask; };
    // Audio starts publishing while control initializes; video waits for the renderer first.
    if (session.callMode === 'audio') await Promise.all([ready, join()]);
    else { await ready; await join(); }
    ensureActive(session);
    session.rtcReady = true;
    status('live');
    $('#interactionFields').disabled = false;
    if (mode === 'editing') {
      $('#switchEditingType').value = payload.editing_type;
      images.next.update();
    }
  } catch (error) {
    if (active === session) {
      notice(error.message);
      log('start_failed', { message: error.message });
      await endSession(session, 'failed');
    }
  }
}

function connectControl(session) {
  status('connecting');
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${location.host}/ws/live?live_id=${encodeURIComponent(session.data.live.id)}`);
  session.socket = socket;
  $('#hangupButton').disabled = false;
  return new Promise((resolve, reject) => {
    session.rejectReady = reject;
    session.controlTimer = setTimeout(() => terminate('Control initialization timed out.'), mode === 'editing' ? 125000 : 65000);
    function terminate(message) {
      reject(new Error(message));
      if (active === session) {
        notice(message);
        endSession(session, 'ended', false);
      }
    }
    socket.addEventListener('message', event => {
      if (active !== session) return;
      let envelope;
      try { envelope = JSON.parse(event.data); } catch { return; }
      log(envelope.event, envelope.message || envelope.reason);
      if (envelope.event === 'on_live') {
        clearTimeout(session.controlTimer);
        session.controlReady = true;
        resolve();
      } else if (envelope.event === 'not_ready') status('warmingUp');
      else if (envelope.event === 'fatal') terminate(envelope.message);
      else if (envelope.event === 'server_hangup') terminate(`Session ended: ${envelope.reason}`);
      else if (envelope.event === 'remote_closed') terminate(t('closed'));
      else if (envelope.event === 'action_error') notice(envelope.message);
      else if (envelope.event === 'text_sent') notice(t('textSent'));
      else if (envelope.event === 'switch_prompt_sent') notice(t('switchSent'));
      const ack = envelope.message?.payload?.switch_prompt_ack;
      if (envelope.message?.type === 14 && ack?.success === false) notice(`${ack.error_code}: ${ack.error_msg || ''}`);
    });
    socket.addEventListener('close', () => terminate(t('closed')));
    socket.addEventListener('error', () => terminate(t('closed')));
  });
}

async function joinRtc(session) {
  ensureActive(session);
  const Engine = window.AliRtcEngine;
  if (!Engine?.getInstance) throw new Error(t('sdkMissing'));
  const support = await Engine.isSupported();
  ensureActive(session);
  if (!support.support) throw new Error(t('unsupported'));
  status('joining');
  const engine = Engine.getInstance();
  session.engine = engine;
  bindRtc(session);
  await engine.setChannelProfile('communication');
  await engine.setAudioOnlyMode(session.callMode === 'audio');
  ensureActive(session);
  await engine.setDefaultSubscribeAllRemoteAudioStreams(true);
  await engine.setDefaultSubscribeAllRemoteVideoStreams(true);
  ensureActive(session);
  const rtc = session.data.rtc;
  await engine.joinChannel(rtc.token, rtc.user_id);
  ensureActive(session);
  if (session.callMode === 'video') {
    await engine.setLocalViewConfig(localVideo, 1);
    await engine.startPreview(1);
    ensureActive(session);
    await engine.publishLocalVideoStream(true);
  }
  ensureActive(session);
  await engine.publishLocalAudioStream(true);
  ensureActive(session);
  log('rtc_joined', { user_id: rtc.user_id, channel_id: rtc.channel_id });
}

function bindRtc(session) {
  const engine = session.engine;
  const on = (name, callback) => engine.on(name, (...args) => { if (active === session && !session.ended) callback(...args); });
  on('remoteUserOnLineNotify', userId => log('rtc_remote_online', { user_id: userId }));
  on('remoteUserOffLineNotify', userId => {
    if (session.remoteUserId === userId) { remoteVideo.srcObject = null; session.remoteUserId = ''; }
    log('rtc_remote_offline', { user_id: userId });
  });
  const subscribe = (userId, oldState, newState, streamType) => {
    log('rtc_subscription', { user_id: userId, old_state: oldState, state: newState, stream_type: streamType });
    if (mode === 'editing' && (userId !== session.data.render_uid || streamType !== 1)) return;
    if (mode === 'avatar' && !/^live-(bot|video-push)-/.test(userId)) return;
    if (newState === 3) {
      session.remoteUserId = userId;
      engine.setRemoteViewConfig(remoteVideo, userId, streamType);
      remoteVideo.play().catch(error => {
        if (active !== session) return;
        if (error.name === 'NotAllowedError') notice(t('playback'), 'playback');
        else log('rtc_playback_interrupted', { name: error.name });
      });
    }
  };
  on('videoSubscribeStateChanged', (userId, oldState, newState) => subscribe(userId, oldState, newState, 1));
  on('screenShareSubscribeStateChanged', (userId, oldState, newState) => subscribe(userId, oldState, newState, 2));
  on('bye', code => { log('rtc_bye', { code }); endSession(session); });
  on('authInfoWillExpire', () => log('rtc_credentials_expiring'));
  on('authInfoExpired', () => { notice(t('expired')); endSession(session); });
}

$('#interactionForm').addEventListener('submit', event => {
  event.preventDefault();
  if (!active?.rtcReady || !active.controlReady) return;
  try {
    const message = mode === 'avatar' ? { action: 'text', content: $('#textInput').value.trim() } : {
      action: 'switch_prompt', image_url: images.next.value(), editing_type: $('#switchEditingType').value
    };
    if (mode === 'avatar' && !message.content) return;
    send(active, message);
    if (mode === 'avatar') $('#textInput').value = '';
  } catch (error) { notice(error.message); }
});
$('#textInput')?.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    $('#interactionForm').requestSubmit();
  }
});

function send(session, message) {
  if (session.socket?.readyState !== WebSocket.OPEN) throw new Error(t('closed'));
  session.socket.send(JSON.stringify(message));
}

async function endSession(session, finalStatus = 'ended', hangup = true) {
  if (!session || session.ended) return;
  session.ended = true;
  ending = true;
  active = null;
  status('ending');
  clearTimeout(session.controlTimer);
  session.rejectReady?.(new Error('Session ended.'));
  $('#hangupButton').disabled = true;
  $('#interactionFields').disabled = true;
  if (hangup && session.socket?.readyState === WebSocket.OPEN) send(session, { action: 'hangup' });
  if (session.socket?.readyState === WebSocket.CONNECTING) {
    session.socket.addEventListener('open', () => { send(session, { action: 'hangup' }); session.socket.close(); }, { once: true });
  } else session.socket?.close();
  // Finish the pending join before destroying the SDK singleton or allowing another call.
  await session.joinTask?.catch(() => {});
  await cleanupRtc(session);
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  $('#createFields').disabled = false;
  $('#startButton').disabled = !configured;
  if (mode === 'avatar') updateCallMode();
  ending = false;
  status(finalStatus);
}

async function cleanupRtc(session) {
  if (!session.engine) return;
  const engine = session.engine;
  for (const method of ['stopPreview', 'leaveChannel', 'destroy']) {
    try { await engine[method]?.(); } catch (error) { log(`rtc_${method}_failed`, { message: error.message }); }
  }
  session.engine = null;
}

window.addEventListener('pagehide', () => {
  if (active?.socket?.readyState === WebSocket.OPEN) send(active, { action: 'hangup' });
  active?.socket?.close();
});

function imageInput(prefix, scenario) {
  const source = $(`#${prefix}Source`), url = $(`#${prefix}Url`), file = $(`#${prefix}File`), preview = $(`#${prefix}Preview`);
  const hint = $(`#${prefix}Hint`);
  let dataUri = '', customUrl = url.value, reading = false, generation = 0;
  function update() {
    const preset = editingPresets[scenario.value];
    const isPreset = source.value === 'preset';
    url.hidden = source.value !== 'url' && !isPreset;
    url.readOnly = isPreset;
    url.value = isPreset ? preset.url : customUrl;
    file.hidden = source.value !== 'file';
    hint.hidden = !isPreset;
    label(hint, preset.label);
    const image = isPreset || source.value === 'url' ? url.value.trim() : source.value === 'file' ? dataUri : '';
    preview.hidden = !image;
    if (image) {
      if (preview.getAttribute('src') !== image) preview.src = image;
    } else preview.removeAttribute('src');
  }
  source.addEventListener('change', update);
  scenario.addEventListener('change', update);
  url.addEventListener('input', () => { if (source.value === 'url') customUrl = url.value; });
  url.addEventListener('change', update);
  preview.addEventListener('error', () => { preview.hidden = true; });
  file.addEventListener('change', async () => {
    const current = ++generation;
    dataUri = '';
    reading = false;
    const selected = file.files[0];
    try {
      if (!selected) return;
      if (!selected.type.startsWith('image/')) throw new Error(t('imageInvalid'));
      if (selected.size > 4 * 1024 * 1024) throw new Error(t('imageLarge'));
      reading = true;
      const value = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(t('imageInvalid')));
        reader.readAsDataURL(selected);
      });
      if (current === generation) dataUri = value;
    } catch (error) { notice(error.message); }
    finally { if (current === generation) { reading = false; update(); } }
  });
  update();
  return { update, setUrl(value) {
    customUrl = value || '';
    source.value = customUrl ? 'url' : 'preset';
    update();
  }, value() {
    if (source.value === 'keep') return '';
    if (source.value === 'file' && reading) throw new Error(t('imageReading'));
    const value = source.value === 'file' ? dataUri : url.value.trim();
    if (!value) throw new Error(t('imageRequired'));
    return value;
  } };
}

function ensureActive(session) { if (active !== session || session.ended) throw new Error('Session ended.'); }
function status(key) { label($('#sessionState'), key); }
function notice(message, kind = '') {
  $('#notice').textContent = message;
  $('#notice').hidden = !message;
  $('#notice').dataset.kind = kind;
}
remoteVideo.addEventListener('playing', () => {
  if ($('#notice').dataset.kind === 'playback') notice('');
});
function log(event, data) {
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString()} ${event}${data ? ` ${JSON.stringify(data)}` : ''}`;
  $('#eventLog').prepend(li);
  if ($('#eventLog').children.length > 200) $('#eventLog').lastChild.remove();
}
async function requestJson(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json' } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
