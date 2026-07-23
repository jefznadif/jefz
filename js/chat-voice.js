// ================================================================
// CHAT-VOICE.JS
// Voice Note — WhatsApp style
// Hold mic = record, swipe left = cancel, swipe up = lock
// Fixed: durasi akurat, chunks tidak terpotong
// ================================================================

let vnRecorder    = null;
let vnStream      = null;
let vnChunks      = [];
let vnRecording   = false;
let vnTimer       = null;
let vnSeconds     = 0;
let vnLocked      = false;
let vnCancelled   = false;
let vnTouchId     = null;
let vnTouchStartY = 0;
let vnTouchStartX = 0;
let vnStartTime   = 0; // timestamp mulai rekam

// ===== TOMBOL MIC/SEND (WhatsApp style) =====
function updateSendMicBtn() {
  const inp  = document.getElementById('chatInput');
  const send = document.getElementById('btnSendMain');
  const mic  = document.getElementById('btnMicMain');
  if (!send || !mic) return;
  const hasText = inp && inp.value.trim().length > 0;
  send.style.display = hasText ? 'flex' : 'none';
  mic.style.display  = hasText ? 'none' : 'flex';
}

function initSendMicBtn() {
  const chatBar = document.querySelector('.chat-bar');
  if (!chatBar || document.getElementById('btnSendMain')) return;

  // Hapus send button lama
  const oldSend = chatBar.querySelector('.btn-send');
  if (oldSend) oldSend.remove();

  const btnWrap = document.createElement('div');
  btnWrap.style.cssText = 'position:relative;width:36px;height:36px;flex-shrink:0;';

  // Tombol SEND
  const sendBtn = document.createElement('button');
  sendBtn.id = 'btnSendMain'; sendBtn.className = 'btn-send';
  sendBtn.style.cssText = 'position:absolute;inset:0;display:none;';
  sendBtn.title = 'Kirim';
  sendBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="white"/></svg>';
  sendBtn.onclick = sendMsg;

  // Tombol MIC
  const micBtn = document.createElement('button');
  micBtn.id = 'btnMicMain'; micBtn.className = 'btn-send';
  micBtn.style.cssText = 'position:absolute;inset:0;display:flex;touch-action:none;user-select:none;-webkit-user-select:none;';
  micBtn.title = 'Voice Note';
  micBtn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" width="18" height="18">' +
      '<rect x="9" y="2" width="6" height="13" rx="3" fill="white" stroke="none"/>' +
      '<path d="M5 10a7 7 0 0014 0" stroke="white"/>' +
      '<line x1="12" y1="19" x2="12" y2="22" stroke="white"/>' +
      '<line x1="8" y1="22" x2="16" y2="22" stroke="white"/>' +
    '</svg>';

  btnWrap.appendChild(sendBtn);
  btnWrap.appendChild(micBtn);
  chatBar.appendChild(btnWrap);

  initVnEvents(micBtn);
  updateSendMicBtn();
}

// ===== VN EVENTS =====
function initVnEvents(btn) {
  // ===== TOUCH =====
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    vnTouchId = t.identifier; vnTouchStartY = t.clientY; vnTouchStartX = t.clientX;
    startVnRecording();
  }, { passive: false });

  btn.addEventListener('touchmove', (e) => {
    if (!vnRecording) return;
    const t = Array.from(e.touches).find(t => t.identifier === vnTouchId);
    if (!t) return;
    const dx = t.clientX - vnTouchStartX;  // negatif = kiri = cancel
    const dy = vnTouchStartY - t.clientY;  // positif = atas = lock

    updateVnSlideUI(dy, dx);

    if (dx < -80 && !vnLocked) { cancelVn(); return; }
    if (dy > 80  && !vnLocked) { lockVn(); }
    if (e.cancelable) e.preventDefault();
  }, { passive: false });

  btn.addEventListener('touchend', () => {
    if (!vnRecording) return;
    if (vnLocked) return; // locked mode = tunggu tombol send overlay
    stopVnRecording(true);
  });

  btn.addEventListener('touchcancel', () => { if (vnRecording && !vnLocked) cancelVn(); });

  // ===== MOUSE (desktop) =====
  btn.addEventListener('mousedown', (e) => { e.preventDefault(); startVnRecording(); });

  document.addEventListener('mouseup', () => { if (vnRecording && !vnLocked) stopVnRecording(true); });

  document.addEventListener('mousemove', (e) => {
    if (!vnRecording || vnLocked) return;
    const rect = btn.getBoundingClientRect();
    if (e.clientX < rect.left - 80) cancelVn();
  });
}

// ===== START RECORDING =====
async function startVnRecording() {
  if (vnRecording) return;
  try {
    vnStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 } });
  } catch (e) { showErr('Tidak bisa akses mikrofon'); return; }

  vnChunks = []; vnSeconds = 0; vnLocked = false; vnCancelled = false; vnStartTime = Date.now();

  // Pilih mime type terbaik
  const mimes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4'];
  const mime  = mimes.find(m => MediaRecorder.isTypeSupported(m)) || '';

  const opts = mime ? { mimeType: mime } : {};
  // Gunakan timeslice kecil (250ms) agar chunks sering dan akurat
  try {
    vnRecorder = new MediaRecorder(vnStream, opts);
  } catch (e) {
    vnRecorder = new MediaRecorder(vnStream);
  }

  vnRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) vnChunks.push(e.data);
  };

  vnRecorder.onstop = onVnStop;
  vnRecorder.start(250); // collect setiap 250ms = akurat
  vnRecording = true;

  if (navigator.vibrate) navigator.vibrate(30);
  showVnUI();
  startVnTimer();
}

// ===== STOP =====
function stopVnRecording(send) {
  if (!vnRecording || !vnRecorder) return;
  vnRecording  = false;
  vnCancelled  = !send;

  // Paksa flush chunk terakhir sebelum stop
  if (vnRecorder.state === 'recording') {
    vnRecorder.requestData();
    // Tunggu sedikit agar requestData selesai sebelum stop
    setTimeout(() => {
      if (vnRecorder && vnRecorder.state !== 'inactive') vnRecorder.stop();
    }, 150);
  } else if (vnRecorder.state !== 'inactive') {
    vnRecorder.stop();
  }

  if (vnStream) { vnStream.getTracks().forEach(t => t.stop()); vnStream = null; }
  clearInterval(vnTimer); vnTimer = null;
  hideVnUI();
}

function cancelVn() {
  if (navigator.vibrate) navigator.vibrate([20, 10, 20]);
  stopVnRecording(false);
}

function lockVn() {
  vnLocked = true;
  if (navigator.vibrate) navigator.vibrate(40);
  updateVnLockUI();
}

// ===== ON STOP =====
function onVnStop() {
  if (vnCancelled || vnChunks.length === 0) {
    vnChunks = []; vnRecorder = null; vnLocked = false; vnCancelled = false;
    return;
  }

  // Hitung durasi dari timestamp (lebih akurat dari vnSeconds)
  const realDuration = Math.round((Date.now() - vnStartTime) / 1000);
  const dur = Math.max(vnSeconds, realDuration);

  const mimeType = vnRecorder ? (vnRecorder.mimeType || 'audio/webm') : 'audio/webm';
  const blob = new Blob(vnChunks, { type: mimeType });
  vnChunks = []; vnRecorder = null; vnLocked = false; vnCancelled = false;

  if (blob.size < 1000) { showErr('Rekaman terlalu pendek'); return; }
  uploadVoiceNote(blob, dur);
}

// ===== UPLOAD =====
async function uploadVoiceNote(blob, duration) {
  if (!currentAccount) return;
  toast('Mengirim voice note...');
  const ext  = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'mp4' : 'webm';
  const name = 'vn_' + Date.now() + '_' + Math.random().toString(36).slice(2,6) + '.' + ext;
  const uploadUrl = SB_URL + '/storage/v1/object/gallery/' + name;

  try {
    await new Promise((res, rej) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl, true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + SB_KEY);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.setRequestHeader('Cache-Control', '3600');
      xhr.setRequestHeader('Content-Type', blob.type || 'audio/webm');
      xhr.onload  = () => xhr.status >= 200 && xhr.status < 300 ? res() : rej(new Error('HTTP ' + xhr.status));
      xhr.onerror = () => rej(new Error('Network error'));
      xhr.send(blob);
    });
  } catch (e) { showErr('Gagal upload voice note: ' + e.message); return; }

  const url = sb.storage.from('gallery').getPublicUrl(name).data.publicUrl;
  const msgContent = '[voice]' + url + '|' + duration;

  const { data, error } = await sb.from('chat_messages').insert([{
    message:     msgContent,
    user_id:     typeof USER_ID !== 'undefined' ? USER_ID : 'u',
    sender_name: currentAccount.name,
    sender_role: currentAccount.role || 'user'
  }]).select().single();

  if (error) { showErr('Gagal kirim voice note'); return; }
  if (data) {
    const id = String(data.id);
    if (!seenMsgIds.has(id)) {
      seenMsgIds.add(id); statusMap[id] = 'sent'; lastPollTs = data.created_at;
      const list = document.getElementById('chatList');
      const ph   = list.querySelector('.state-msg'); if (ph) list.innerHTML = '';
      list.appendChild(buildMsg(data)); scrollToBottom(list, true);
    }
    upsertStatus(data.id, 'sent');
  }
}

// ===== VN UI =====
function showVnUI() {
  let el = document.getElementById('vnOverlay');
  if (!el) { el = document.createElement('div'); el.id = 'vnOverlay'; document.body.appendChild(el); }
  el.className = 'vn-overlay';
  el.style.display = 'flex';
  el.innerHTML =
    '<div class="vn-cancel-hint" id="vnCancelHint">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '<span>Geser kiri</span>' +
    '</div>' +
    '<div class="vn-center">' +
      '<div class="vn-rec-dot"></div>' +
      '<span class="vn-timer" id="vnTimerEl">0:00</span>' +
      '<div class="vn-wave-wrap">' +
        Array.from({length:12}, () => '<div class="vn-wave-bar" style="animation-duration:' + (0.4+Math.random()*0.5).toFixed(2) + 's;"></div>').join('') +
      '</div>' +
    '</div>' +
    '<div class="vn-lock-hint" id="vnLockHint">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 19V5M12 5l-4 4M12 5l4 4"/></svg>' +
      '<span>Geser atas</span>' +
    '</div>';
}

function hideVnUI() {
  const el = document.getElementById('vnOverlay');
  if (el) el.style.display = 'none';
  // Reset posisi mic button
  const mic = document.getElementById('btnMicMain');
  if (mic) mic.style.transform = '';
}

function updateVnSlideUI(dy, dx) {
  const cancelHint = document.getElementById('vnCancelHint');
  const lockHint   = document.getElementById('vnLockHint');
  const mic        = document.getElementById('btnMicMain');

  if (dx < -20) {
    const pct = Math.min(1, Math.abs(dx + 20) / 60);
    if (cancelHint) { cancelHint.style.opacity = String(pct); cancelHint.style.color = 'var(--danger)'; }
    if (mic) mic.style.transform = 'translateX(' + Math.max(-60, dx) + 'px)';
  } else {
    if (cancelHint) { cancelHint.style.opacity = '0.4'; cancelHint.style.color = ''; }
    if (mic) mic.style.transform = '';
  }

  if (dy > 20) {
    const pct = Math.min(1, (dy - 20) / 60);
    if (lockHint) { lockHint.style.opacity = String(0.4 + pct * 0.6); lockHint.style.color = 'var(--accent)'; }
    if (mic) mic.style.transform = 'translateY(' + Math.max(-60, -dy) + 'px)';
  } else {
    if (lockHint) { lockHint.style.opacity = '0.4'; lockHint.style.color = ''; }
  }
}

function updateVnLockUI() {
  const el = document.getElementById('vnOverlay'); if (!el) return;
  const mic = document.getElementById('btnMicMain'); if (mic) mic.style.transform = '';
  el.innerHTML =
    '<button class="vn-del-btn" onclick="cancelVnLocked()">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>' +
    '</button>' +
    '<div class="vn-center">' +
      '<div class="vn-rec-dot"></div>' +
      '<span class="vn-timer" id="vnTimerEl">' + fmtDuration(vnSeconds) + '</span>' +
      '<div class="vn-wave-wrap">' +
        Array.from({length:12}, () => '<div class="vn-wave-bar" style="animation-duration:' + (0.4+Math.random()*0.5).toFixed(2) + 's;"></div>').join('') +
      '</div>' +
    '</div>' +
    '<button class="vn-send-locked-btn" onclick="sendVnLocked()">' +
      '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="white"/></svg>' +
    '</button>';
}

function cancelVnLocked() { vnLocked = false; cancelVn(); }
function sendVnLocked()   { vnLocked = false; stopVnRecording(true); }

function startVnTimer() {
  vnSeconds = 0;
  const el = document.getElementById('vnTimerEl'); if (el) el.textContent = '0:00';
  clearInterval(vnTimer);
  vnTimer = setInterval(() => {
    vnSeconds++;
    const el = document.getElementById('vnTimerEl'); if (el) el.textContent = fmtDuration(vnSeconds);
    if (vnSeconds >= 180) stopVnRecording(true); // max 3 menit
  }, 1000);
}

// ===== BUILD VOICE NOTE BUBBLE =====
function buildVoiceNoteBubble(url, duration) {
  const wrap = document.createElement('div');
  wrap.className = 'vn-wrap';

  const playBtn = document.createElement('button');
  playBtn.className = 'vn-play-btn';
  playBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="5,3 19,12 5,21"/></svg>';

  const waveform = document.createElement('div');
  waveform.className = 'vn-waveform';
  const bars = Array.from({length: 30}, () => {
    const b = document.createElement('div');
    b.className = 'vn-bar';
    const h = 20 + Math.random() * 60;
    b.style.height = h + '%'; b.dataset.h = h;
    waveform.appendChild(b); return b;
  });

  const durEl = document.createElement('span');
  durEl.className  = 'vn-duration';
  durEl.textContent = duration > 0 ? fmtDuration(duration) : '0:00';

  const audio = new Audio(url);
  audio.preload = 'metadata';
  let playing = false, rafId = null;

  // Seek on waveform click
  waveform.onclick = (e) => {
    if (!audio.duration) return;
    const rect = waveform.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
  };

  playBtn.onclick = () => {
    if (playing) {
      audio.pause(); playing = false;
      playBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="5,3 19,12 5,21"/></svg>';
      playBtn.classList.remove('playing');
      cancelAnimationFrame(rafId);
    } else {
      // Stop semua audio lain
      document.querySelectorAll('audio[data-vn]').forEach(a => { if (!a.paused) { a.pause(); const b = a._playBtn; if(b){b.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="5,3 19,12 5,21"/></svg>';b.classList.remove('playing');} } });
      audio.play().then(() => {
        playing = true;
        playBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
        playBtn.classList.add('playing');
        function anim() { if(!playing)return; bars.forEach(b=>{b.style.height=(20+Math.random()*60)+'%';}); rafId=requestAnimationFrame(anim); }
        anim();
      }).catch(() => {});
    }
  };
  audio.dataset.vn = '1'; audio._playBtn = playBtn;

  audio.ontimeupdate = () => {
    if (!audio.duration) return;
    const pct = audio.currentTime / audio.duration;
    const passed = Math.floor(pct * bars.length);
    bars.forEach((b, i) => { b.style.background = i < passed ? 'var(--accent)' : ''; b.style.height = i < passed ? '60%' : b.dataset.h + '%'; });
    durEl.textContent = fmtDuration(Math.round(audio.currentTime));
  };

  audio.onended = () => {
    playing = false;
    playBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="5,3 19,12 5,21"/></svg>';
    playBtn.classList.remove('playing');
    cancelAnimationFrame(rafId);
    bars.forEach(b => { b.style.height = b.dataset.h + '%'; b.style.background = ''; });
    durEl.textContent = duration > 0 ? fmtDuration(duration) : '0:00';
  };

  wrap.appendChild(playBtn);
  wrap.appendChild(waveform);
  wrap.appendChild(durEl);
  return wrap;
}
