// ================================================================
// CHAT MODULE - dengan Voice Note
// ================================================================

let chatChannel     = null;
let presenceChannel = null;
let isChatActive    = false;
let chatLoaded      = false;
let seenMsgIds      = new Set();
let replyTarget     = null;
let emojiPickerOpen = false;
let activeMsgMenu   = null;
let selectedMsgIds  = new Set();
let selectionActive = false;
let otherUser       = null;
let presenceTimer   = null;
let typingTimer     = null;
let selfTyping      = false;
let pollTimer       = null;
let lastPollTs      = null;
let editingMsgId    = null;
let editingOriginal = '';

const statusMap = {};

// Voice Note state
let vnRecorder    = null;
let vnStream      = null;
let vnChunks      = [];
let vnRecording   = false;
let vnTimer       = null;
let vnSeconds     = 0;
let vnLockActive  = false; // locked mode (tangan bebas)

// ===== HELPERS =====
function esc(s) {
  return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') : '';
}
function fmtTime(d) {
  return new Date(d).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
}
function scrollToBottom(el, smooth) {
  if (!el) return;
  requestAnimationFrame(() => el.scrollTo({ top:el.scrollHeight, behavior:smooth?'smooth':'instant' }));
}
function showErr(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.className = 'toast show err';
  setTimeout(() => { t.className = 'toast'; }, 5000);
}
async function rpc(fn, params) { try { await sb.rpc(fn, params); } catch (e) {} }

// ===== FIX HEADER KEYBOARD =====
function fixHeaderOnKeyboard() {
  if (!window.visualViewport) return;
  const topbar = document.querySelector('.topbar');
  const nav    = document.querySelector('.bottom-nav');
  const tab    = document.getElementById('tabChat');
  function onVP() {
    const vh = window.visualViewport.height, ot = window.visualViewport.offsetTop;
    if (topbar) topbar.style.top = ot + 'px';
    if (tab && tab.classList.contains('active-tab')) { tab.style.top = (ot+62)+'px'; tab.style.bottom = (window.innerHeight-ot-vh+68)+'px'; }
    if (nav) nav.style.bottom = (window.innerHeight-ot-vh)+'px';
  }
  window.visualViewport.addEventListener('resize', onVP);
  window.visualViewport.addEventListener('scroll', onVP);
}

// ===== TYPING =====
function onChatInput() {
  if (!currentAccount) return;
  autoResize(document.getElementById('chatInput'));
  if (editingMsgId) return;
  if (!selfTyping) { selfTyping = true; rpc('update_typing', { p_username:currentAccount.name, p_is_typing:true }); }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => { selfTyping = false; rpc('update_typing', { p_username:currentAccount.name, p_is_typing:false }); }, 2000);
}

function setTypingUI(show, name) {
  let el = document.getElementById('typingBubble');
  if (!show) { if (el) el.style.display = 'none'; return; }
  if (!el) {
    el = document.createElement('div'); el.id = 'typingBubble'; el.style.cssText = 'display:flex;padding:2px 14px 8px;';
    el.innerHTML = '<div style="background:var(--bubble-their);border:1px solid var(--bubble-bt);border-radius:18px;border-bottom-left-radius:5px;padding:8px 14px;display:flex;align-items:center;gap:8px;"><span id="typingName" style="font-size:11px;color:var(--text3);font-weight:500;"></span><span class="typing-dots"><span></span><span></span><span></span></span></div>';
    const list = document.getElementById('chatList');
    if (list && list.parentNode) list.parentNode.insertBefore(el, list.nextSibling);
  }
  const n = document.getElementById('typingName'); if (n) n.textContent = (name||'') + ' mengetik';
  el.style.display = 'flex';
  scrollToBottom(document.getElementById('chatList'), true);
}

// ===== STATUS =====
function statusHtml(s) {
  if (s==='sent')      return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14" class="status-sent"><polyline points="3 8 6 11 13 4.5"/></svg>';
  if (s==='delivered') return '<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="2.2" width="16" height="14" class="status-delivered"><polyline points="2 8 5 11 10.5 5"/><polyline points="7.5 8 10.5 11 16 5"/></svg>';
  if (s==='read')      return '<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="2.2" width="16" height="14" class="status-read"><polyline points="2 8 5 11 10.5 5"/><polyline points="7.5 8 10.5 11 16 5"/></svg>';
  return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13" class="status-pending"><circle cx="8" cy="8" r="6.5"/><polyline points="8 4.5 8 8 10.5 10"/></svg>';
}

async function preloadAllStatuses(msgIds) {
  if (!msgIds.length) return;
  try {
    const { data } = await sb.from('message_status').select('message_id,status').in('message_id', msgIds);
    if (data) data.forEach(r => { statusMap[String(r.message_id)] = r.status; });
  } catch (e) {}
}

function setStatusInDom(msgId, status) {
  statusMap[String(msgId)] = status;
  const ic = document.querySelector('[data-status-msg-id="'+msgId+'"]');
  if (ic) ic.innerHTML = statusHtml(status);
}

async function upsertStatus(msgId, status) {
  if (!currentAccount) return;
  try {
    const row = { message_id:msgId, recipient_name:currentAccount.name, status, updated_at:new Date().toISOString() };
    if (status==='delivered') row.delivered_at = new Date().toISOString();
    if (status==='read')      row.read_at      = new Date().toISOString();
    await sb.from('message_status').upsert(row, { onConflict:'message_id,recipient_name' });
    setStatusInDom(msgId, status);
  } catch (e) {}
}

async function markRead() {
  if (!currentAccount || !otherUser) return;
  try {
    const { data } = await sb.from('chat_messages').select('id').eq('sender_name', otherUser).order('created_at', { ascending:false }).limit(30);
    if (data) for (const m of data) await upsertStatus(m.id, 'read');
  } catch (e) {}
}

// ===== FORMAT DURASI VOICE NOTE =====
function fmtDuration(secs) {
  const m = Math.floor(secs / 60), s = secs % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

// ===== BUILD VOICE NOTE BUBBLE =====
function buildVoiceNoteBubble(url, duration) {
  const wrap = document.createElement('div');
  wrap.className = 'vn-wrap';

  // Play/pause button
  const playBtn = document.createElement('button');
  playBtn.className = 'vn-play-btn';
  playBtn.innerHTML = '▶';

  // Waveform bar (animasi)
  const waveform = document.createElement('div');
  waveform.className = 'vn-waveform';
  for (let i = 0; i < 28; i++) {
    const bar = document.createElement('div');
    bar.className = 'vn-bar';
    bar.style.height = (20 + Math.random() * 60) + '%';
    waveform.appendChild(bar);
  }

  // Progress & durasi
  const progress = document.createElement('div');
  progress.className = 'vn-progress';

  const durEl = document.createElement('span');
  durEl.className = 'vn-duration';
  durEl.textContent = duration ? fmtDuration(Math.round(duration)) : '0:00';

  // Audio element
  const audio = new Audio(url);
  let playing = false;
  let rafId   = null;

  playBtn.onclick = () => {
    if (playing) {
      audio.pause();
      playing = false;
      playBtn.innerHTML = '▶';
      playBtn.classList.remove('playing');
      cancelAnimationFrame(rafId);
      waveform.querySelectorAll('.vn-bar').forEach(b => b.classList.remove('active'));
    } else {
      audio.play();
      playing = true;
      playBtn.innerHTML = '⏸';
      playBtn.classList.add('playing');
      // Animasi bar saat playing
      function animateBars() {
        if (!playing) return;
        waveform.querySelectorAll('.vn-bar').forEach(b => {
          b.style.height = (20 + Math.random() * 60) + '%';
        });
        rafId = requestAnimationFrame(animateBars);
      }
      animateBars();
    }
  };

  audio.ontimeupdate = () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    progress.style.setProperty('--pct', pct + '%');
    durEl.textContent = fmtDuration(Math.round(audio.currentTime));
  };

  audio.onended = () => {
    playing = false;
    playBtn.innerHTML = '▶';
    playBtn.classList.remove('playing');
    cancelAnimationFrame(rafId);
    waveform.querySelectorAll('.vn-bar').forEach(b => { b.style.height = (20 + Math.random() * 60) + '%'; });
    durEl.textContent = duration ? fmtDuration(Math.round(duration)) : '0:00';
    progress.style.setProperty('--pct', '0%');
  };

  // Click waveform untuk seek
  waveform.onclick = (e) => {
    if (!audio.duration) return;
    const rect = waveform.getBoundingClientRect();
    const pct  = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
  };

  wrap.appendChild(playBtn);
  wrap.appendChild(waveform);
  wrap.appendChild(durEl);
  return wrap;
}

// ===== BUILD MESSAGE =====
function buildMsg(m) {
  const isMe    = currentAccount && m.sender_name === currentAccount.name;
  const clr     = m.sender_name === "Jef'z" ? '#007aff' : '#e91e8c';
  const roleTag = m.sender_role === 'admin' ? ' 👑' : '';
  const content = m.message || '';
  const isImg   = content.startsWith('[img]');
  const isVid   = content.startsWith('[video]');
  const isVN    = content.startsWith('[voice]');
  const isAud   = content.startsWith('[audio]');
  const isMedia = isImg || isVid || isVN || isAud;

  let mediaUrl = null, vnDuration = 0;
  if (isImg)       mediaUrl = content.slice(5);
  else if (isVid)  mediaUrl = content.slice(7);
  else if (isVN) {
    // format: [voice]url|duration
    const raw = content.slice(7);
    const sep = raw.lastIndexOf('|');
    if (sep !== -1) { mediaUrl = raw.slice(0, sep); vnDuration = parseFloat(raw.slice(sep+1)) || 0; }
    else mediaUrl = raw;
  }

  const row = document.createElement('div');
  row.className = 'msg-row ' + (isMe ? 'mine' : 'theirs');
  if (m.id) row.dataset.msgId = String(m.id);

  const sw = document.createElement('div'); sw.className = 'msg-swipe-wrap';
  const block = document.createElement('div'); block.className = 'msg-block';
  const inner = document.createElement('div'); inner.className = 'msg-block-inner';

  if (!isMe) {
    const sp = document.createElement('span'); sp.className = 'msg-sender'; sp.style.color = clr;
    sp.textContent = m.sender_name + roleTag; inner.appendChild(sp);
  }

  const bubble = document.createElement('div');
  bubble.className = isMedia ? 'bubble bubble-media' : 'bubble';

  const ab = document.createElement('button'); ab.className = 'bubble-action-btn'; ab.textContent = '⋮';
  ab.addEventListener('click', (e) => { e.stopPropagation(); if (selectionActive) return; showMsgMenu(m.id, m.sender_name, content, ab, isMedia); });
  bubble.appendChild(ab);

  if (m.reply_to_name && m.reply_to_text) {
    const rc = m.reply_to_name === "Jef'z" ? '#007aff' : '#e91e8c';
    let rp   = m.reply_to_text.length > 50 ? m.reply_to_text.slice(0,50)+'…' : m.reply_to_text;
    if (rp.startsWith('[img]'))   rp = '🖼 Foto';
    if (rp.startsWith('[video]')) rp = '🎬 Video';
    if (rp.startsWith('[voice]')) rp = '🎙 Voice Note';
    const rpEl = document.createElement('div'); rpEl.className = 'reply-preview'; rpEl.style.borderLeft = '3px solid '+rc;
    rpEl.innerHTML = '<span class="reply-prev-name" style="color:'+rc+'">'+esc(m.reply_to_name)+'</span><span class="reply-prev-text">'+esc(rp)+'</span>';
    bubble.appendChild(rpEl);
  }

  if (isImg && mediaUrl) {
    const img = document.createElement('img');
    img.src = mediaUrl; img.className = 'bubble-img'; img.loading = 'lazy';
    img.onclick = (e) => { e.stopPropagation(); openLightboxFromChat(mediaUrl); };
    bubble.appendChild(img);
  } else if (isVid && mediaUrl) {
    const vid = document.createElement('video');
    vid.src = mediaUrl; vid.className = 'bubble-vid'; vid.preload = 'metadata'; vid.controls = true; vid.playsInline = true;
    bubble.appendChild(vid);
  } else if (isVN && mediaUrl) {
    bubble.appendChild(buildVoiceNoteBubble(mediaUrl, vnDuration));
  } else if (!isMedia) {
    bubble.appendChild(document.createTextNode(content));
  }

  // Time + edited + status
  const ts = document.createElement('span');
  ts.style.cssText = 'float:right;margin-left:6px;margin-bottom:-2px;position:relative;top:3px;display:inline-flex;align-items:center;gap:3px;pointer-events:none;white-space:nowrap;';
  if (m.is_edited) { const ed = document.createElement('span'); ed.textContent='diedit'; ed.style.cssText='font-size:9px;color:var(--text3);font-style:italic;'; ts.appendChild(ed); }
  const timeEl = document.createElement('span'); timeEl.textContent = fmtTime(m.created_at); timeEl.style.cssText = 'font-size:10px;color:var(--text3);'; ts.appendChild(timeEl);
  if (isMe && m.id) {
    const si = document.createElement('span'); si.className = 'msg-status-icons'; si.dataset.statusMsgId = String(m.id);
    si.innerHTML = statusHtml(statusMap[String(m.id)] || 'sent'); ts.appendChild(si);
  }
  bubble.appendChild(ts);

  inner.appendChild(bubble); block.appendChild(inner); sw.appendChild(block); row.appendChild(sw);
  initLongPress(row, m); initSwipeReply(row, m);
  return row;
}

// ===== LONG PRESS & SWIPE =====
function initLongPress(row, m) {
  const bubble = row.querySelector('.bubble'); if (!bubble) return;
  let timer=null, moved=false, sx=0, sy=0;
  bubble.addEventListener('touchstart',(e)=>{ if(e.target.closest('.bubble-action-btn,.vn-play-btn,.vn-waveform')||selectionActive)return; moved=false;sx=e.touches[0].clientX;sy=e.touches[0].clientY; timer=setTimeout(()=>{if(!moved&&m.id){if(navigator.vibrate)navigator.vibrate(40);enterSelect(String(m.id));}},500); },{passive:true});
  bubble.addEventListener('touchmove',(e)=>{ if(Math.abs(e.touches[0].clientX-sx)>8||Math.abs(e.touches[0].clientY-sy)>8){moved=true;clearTimeout(timer);} },{passive:true});
  bubble.addEventListener('touchend',(e)=>{ clearTimeout(timer);if(selectionActive&&!moved&&m.id){e.stopPropagation();toggleSelect(String(m.id));}moved=false; });
  bubble.addEventListener('touchcancel',()=>{clearTimeout(timer);moved=false;});
}

function initSwipeReply(row, m) {
  const sw = row.querySelector('.msg-swipe-wrap');
  let sx=0,sy=0,dx=0,active=false,fired=false;
  sw.addEventListener('touchstart',(e)=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY;dx=0;active=false;fired=false;},{passive:true});
  sw.addEventListener('touchmove',(e)=>{ if(selectionActive)return; dx=e.touches[0].clientX-sx; const dy=Math.abs(e.touches[0].clientY-sy); if(!active&&Math.abs(dx)>dy&&Math.abs(dx)>8)active=true; if(!active)return; const cl=Math.min(Math.max(0,dx),72); sw.style.transform='translateX('+cl+'px)';sw.style.transition='none'; if(cl>=60&&!fired){fired=true;row.classList.add('reply-flash');setTimeout(()=>row.classList.remove('reply-flash'),200);} if(e.cancelable)e.preventDefault(); },{passive:false});
  sw.addEventListener('touchend',()=>{ if(!selectionActive&&fired&&dx>=60)setReply(m.id,m.sender_name,m.message||''); sw.style.transition='transform .25s cubic-bezier(.34,1.56,.64,1)';sw.style.transform='translateX(0)';active=false;fired=false; });
}

function appendMsg(m, smooth) {
  const list = document.getElementById('chatList'); if (!list) return;
  const id = String(m.id||'');
  if (id && seenMsgIds.has(id)) return;
  if (id) seenMsgIds.add(id);
  const ph = list.querySelector('.state-msg'); if (ph) list.innerHTML = '';
  list.appendChild(buildMsg(m));
  scrollToBottom(list, smooth && (list.scrollHeight-list.scrollTop-list.clientHeight)<400);
}

function updateMsgInDom(m) {
  const existing = document.querySelector('[data-msg-id="'+m.id+'"]');
  if (!existing) return;
  existing.replaceWith(buildMsg(m));
}

// ================================================================
// VOICE NOTE RECORDING
// ================================================================

function initVoiceNoteBtn() {
  const chatBar = document.querySelector('.chat-bar');
  if (!chatBar || document.getElementById('vnBtn')) return;

  // Tombol mic di chat bar (sebelum tombol send)
  const sendBtn = chatBar.querySelector('.btn-send');

  const vnBtn = document.createElement('button');
  vnBtn.id = 'vnBtn';
  vnBtn.className = 'vn-record-btn';
  vnBtn.title = 'Voice Note';
  vnBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10a7 7 0 0014 0"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>';

  // Pasang di sebelum sendBtn
  if (sendBtn) chatBar.insertBefore(vnBtn, sendBtn);
  else chatBar.appendChild(vnBtn);

  // Events
  initVnEvents(vnBtn);
}

function initVnEvents(btn) {
  let holdTimer = null, longPressed = false;

  // ===== MOUSE (desktop) =====
  btn.addEventListener('mousedown', () => {
    holdTimer = setTimeout(() => { longPressed = true; startVnRecording(); }, 200);
  });
  btn.addEventListener('mouseup', () => {
    clearTimeout(holdTimer);
    if (longPressed) { longPressed = false; if (vnRecording && !vnLockActive) stopVnRecording(true); }
  });
  btn.addEventListener('mouseleave', () => {
    clearTimeout(holdTimer);
    if (longPressed && vnRecording && !vnLockActive) { longPressed = false; stopVnRecording(false); }
  });

  // ===== TOUCH (mobile) =====
  let touchStartY = 0, touchStartX = 0;
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
    holdTimer = setTimeout(() => { longPressed = true; startVnRecording(); }, 200);
  }, { passive: false });

  btn.addEventListener('touchmove', (e) => {
    if (!vnRecording) return;
    const dy = touchStartY - e.touches[0].clientY; // swipe up = lock
    const dx = e.touches[0].clientX - touchStartX; // swipe left = cancel

    // Swipe up > 60px → lock mode
    if (dy > 60 && !vnLockActive) {
      vnLockActive = true;
      updateVnUI('locked');
    }
    // Swipe left > 80px → cancel
    if (dx < -80 && !vnLockActive) {
      clearTimeout(holdTimer); longPressed = false;
      stopVnRecording(false);
    }
  }, { passive: true });

  btn.addEventListener('touchend', () => {
    clearTimeout(holdTimer);
    if (longPressed && vnRecording && !vnLockActive) { longPressed = false; stopVnRecording(true); }
    longPressed = false;
  });
}

async function startVnRecording() {
  if (vnRecording) return;
  try {
    vnStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    showErr('Tidak bisa akses mikrofon'); return;
  }

  vnChunks  = [];
  vnSeconds = 0;
  vnLockActive = false;

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
    ? 'audio/webm'
    : 'audio/ogg';

  vnRecorder = new MediaRecorder(vnStream, { mimeType });
  vnRecorder.ondataavailable = (e) => { if (e.data.size > 0) vnChunks.push(e.data); };
  vnRecorder.onstop = () => { handleVnStop(); };
  vnRecorder.start(100); // collect every 100ms
  vnRecording = true;

  showVnOverlay();
  startVnTimer();
}

function stopVnRecording(send) {
  if (!vnRecording || !vnRecorder) return;
  vnRecording = false;
  vnRecorder._shouldSend = send;
  vnRecorder.stop();
  if (vnStream) { vnStream.getTracks().forEach(t => t.stop()); vnStream = null; }
  clearInterval(vnTimer); vnTimer = null;
  hideVnOverlay();
}

function handleVnStop() {
  const shouldSend = vnRecorder ? vnRecorder._shouldSend : false;
  if (!shouldSend || vnChunks.length === 0) {
    vnChunks = []; vnRecorder = null; vnLockActive = false;
    if (!shouldSend) toast('Voice note dibatalkan', false);
    return;
  }
  const blob = new Blob(vnChunks, { type: vnRecorder.mimeType || 'audio/webm' });
  const dur  = vnSeconds;
  vnChunks   = []; vnRecorder = null; vnLockActive = false;
  uploadVoiceNote(blob, dur);
}

async function uploadVoiceNote(blob, duration) {
  if (!currentAccount) return;
  toast('Mengirim voice note...');
  const ext  = blob.type.includes('ogg') ? 'ogg' : 'webm';
  const name = 'vn_' + Date.now() + '_' + Math.random().toString(36).slice(2,6) + '.' + ext;
  const uploadUrl = SB_URL + '/storage/v1/object/gallery/' + name;

  try {
    await new Promise((res, rej) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl, true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + SB_KEY);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.setRequestHeader('Cache-Control', '3600');
      xhr.setRequestHeader('Content-Type', blob.type);
      xhr.onload  = () => xhr.status >= 200 && xhr.status < 300 ? res() : rej(new Error('HTTP ' + xhr.status));
      xhr.onerror = () => rej(new Error('Network error'));
      xhr.send(blob);
    });
  } catch (err) { showErr('Gagal upload voice note'); return; }

  const url = sb.storage.from('gallery').getPublicUrl(name).data.publicUrl;
  // Format: [voice]url|durasi
  const msgContent = '[voice]' + url + '|' + duration;

  const { error } = await sb.from('chat_messages').insert([{
    message:     msgContent,
    user_id:     typeof USER_ID !== 'undefined' ? USER_ID : 'u',
    sender_name: currentAccount.name,
    sender_role: currentAccount.role || 'user'
  }]);
  if (error) showErr('Gagal kirim voice note'); else toast('Voice note terkirim ✓');
}

// ===== VN OVERLAY UI =====
function showVnOverlay() {
  let overlay = document.getElementById('vnOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'vnOverlay';
    overlay.style.cssText = [
      'position:fixed','bottom:0','left:0','right:0','z-index:400',
      'background:var(--topbar-bg)',
      'backdrop-filter:var(--blur)','-webkit-backdrop-filter:var(--blur)',
      'border-top:1px solid var(--separator)',
      'display:flex','align-items:center','justify-content:space-between',
      'padding:12px 20px',
      'animation:slideUpVn 0.2s ease',
      'height:68px',
    ].join(';');

    overlay.innerHTML =
      // Kiri: tombol cancel
      '<button id="vnCancelBtn" style="background:transparent;border:none;color:var(--danger);font-size:13px;font-weight:600;cursor:pointer;padding:8px;">✕ Batalkan</button>' +
      // Tengah: timer + waveform
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<div id="vnDot" style="width:8px;height:8px;border-radius:50%;background:#ff3b30;animation:recPulse 1s ease infinite;"></div>' +
        '<span id="vnTimerEl" style="font-size:16px;font-weight:700;color:var(--text);font-variant-numeric:tabular-nums;">0:00</span>' +
        '<div id="vnWaveAnim" style="display:flex;align-items:center;gap:2px;height:24px;">' +
          Array.from({length:12},()=>'<div style="width:3px;border-radius:2px;background:var(--accent);animation:vnWave '+(0.4+Math.random()*0.4).toFixed(2)+'s ease infinite alternate;height:'+(30+Math.random()*70)+'%;"></div>').join('') +
        '</div>' +
      '</div>' +
      // Kanan: lock (swipe up hint) + send
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<div id="vnLockHint" style="display:flex;flex-direction:column;align-items:center;gap:2px;opacity:0.5;">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 19V5M12 5l-4 4M12 5l4 4"/></svg>' +
          '<span style="font-size:9px;color:var(--text3);">Geser atas</span>' +
        '</div>' +
        '<button id="vnSendBtn" style="width:44px;height:44px;border-radius:50%;background:var(--accent);border:none;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px var(--accent-glow);">' +
          '<svg viewBox="0 0 24 24" fill="white" width="20" height="20"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>' +
        '</button>' +
      '</div>';

    document.body.appendChild(overlay);

    // Events tombol di overlay
    document.getElementById('vnCancelBtn').onclick = () => stopVnRecording(false);
    document.getElementById('vnSendBtn').onclick   = () => { vnLockActive = false; stopVnRecording(true); };
  }
  overlay.style.display = 'flex';
  updateVnUI('recording');
}

function hideVnOverlay() {
  const overlay = document.getElementById('vnOverlay');
  if (overlay) overlay.style.display = 'none';
}

function updateVnUI(mode) {
  const cancelBtn  = document.getElementById('vnCancelBtn');
  const lockHint   = document.getElementById('vnLockHint');
  const sendBtn    = document.getElementById('vnSendBtn');

  if (mode === 'locked') {
    // Mode lock: tangan bebas dari tombol mic
    if (cancelBtn) cancelBtn.textContent = '✕ Batalkan';
    if (lockHint) {
      lockHint.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" width="18" height="18"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg><span style="font-size:9px;color:var(--accent);">Terkunci</span>';
      lockHint.style.opacity = '1';
    }
    if (sendBtn) sendBtn.style.background = '#34c759';
    toast('🔒 Tekan kirim saat selesai');
  }
}

function startVnTimer() {
  vnSeconds = 0;
  const el  = document.getElementById('vnTimerEl');
  if (el) el.textContent = '0:00';
  clearInterval(vnTimer);
  vnTimer = setInterval(() => {
    vnSeconds++;
    const el = document.getElementById('vnTimerEl');
    if (el) el.textContent = fmtDuration(vnSeconds);
    // Max 3 menit
    if (vnSeconds >= 180) stopVnRecording(true);
  }, 1000);
}

// ===== INIT CHAT =====
async function initChat() {
  isChatActive = true;
  fixHeaderOnKeyboard();

  const inp = document.getElementById('chatInput');
  if (inp && !inp._b) {
    inp._b = true;
    inp.addEventListener('input', onChatInput);
  }

  // Pasang tombol voice note
  initVoiceNoteBtn();

  _updateTopbarUser();

  if (!chatLoaded) {
    const list = document.getElementById('chatList');
    list.innerHTML = '<p class="state-msg">Memuat...</p>';

    const { data, error } = await sb.from('chat_messages').select('*').order('created_at', { ascending:true });
    if (error) { list.innerHTML='<p class="state-msg err">Gagal memuat</p>'; showErr('Load error: '+error.message); return; }

    if (data && data.length && currentAccount) {
      const myIds = data.filter(m => m.sender_name === currentAccount.name).map(m => m.id);
      await preloadAllStatuses(myIds);
    }

    list.innerHTML = ''; chatLoaded = true;
    if (!data || !data.length) { list.innerHTML='<p class="state-msg">Belum ada pesan 💬</p>'; }
    else {
      const frag = document.createDocumentFragment();
      data.forEach(m => { seenMsgIds.add(String(m.id)); frag.appendChild(buildMsg(m)); });
      list.appendChild(frag); scrollToBottom(list, false);
      lastPollTs = data[data.length-1].created_at;
    }
  }

  startRealtime(); startPresence(); startPoll();
}

function _updateTopbarUser() {
  if (!currentAccount) return;
  const their = currentAccount.name === "Jef'z" ? 'Ndifaa' : "Jef'z";
  const el = document.getElementById('topbarUser');
  if (el) el.textContent = their;
}

// ===== REALTIME =====
function startRealtime() {
  if (chatChannel) { try { sb.removeChannel(chatChannel); } catch(e){} chatChannel=null; }
  chatChannel = sb.channel('chat_'+Date.now())
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_messages'},(p)=>{
      if(!p.new)return; const id=String(p.new.id); if(seenMsgIds.has(id))return; appendMsg(p.new,true);
      if(currentAccount&&p.new.sender_name!==currentAccount.name){const open=document.getElementById('tabChat').classList.contains('active-tab');upsertStatus(p.new.id,open?'read':'delivered');}
    })
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'chat_messages'},(p)=>{if(p.new)updateMsgInDom(p.new);})
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'chat_messages'},(p)=>{if(!p.old||!p.old.id)return;const el=document.querySelector('[data-msg-id="'+p.old.id+'"]');if(el)el.remove();seenMsgIds.delete(String(p.old.id));})
    .on('postgres_changes',{event:'*',schema:'public',table:'message_status'},(p)=>{if(!p.new)return;setStatusInDom(p.new.message_id,p.new.status);})
    .subscribe();
}

function startPoll() {
  if (pollTimer) return;
  pollTimer = setInterval(async()=>{
    if(!isChatActive||!lastPollTs)return;
    try{ const{data}=await sb.from('chat_messages').select('*').gt('created_at',lastPollTs).order('created_at',{ascending:true}); if(data&&data.length){data.forEach(m=>appendMsg(m,true));lastPollTs=data[data.length-1].created_at;} }catch(e){}
  },3000);
}

// ===== PRESENCE =====
async function startPresence() {
  if(!currentAccount)return;
  otherUser=currentAccount.name==="Jef'z"?'Ndifaa':"Jef'z";
  await rpc('update_presence',{p_username:currentAccount.name,p_is_online:true});
  if(presenceChannel){try{sb.removeChannel(presenceChannel);}catch(e){}}
  presenceChannel=sb.channel('pres_'+Date.now())
    .on('postgres_changes',{event:'*',schema:'public',table:'user_presence',filter:'username=eq.'+otherUser},(p)=>{if(p.new)renderPresence(p.new);})
    .subscribe();
  await fetchPresence();
  if(presenceTimer)clearInterval(presenceTimer);
  presenceTimer=setInterval(fetchPresence,5000);
  window.addEventListener('beforeunload',()=>{rpc('update_presence',{p_username:currentAccount.name,p_is_online:false});rpc('update_typing',{p_username:currentAccount.name,p_is_typing:false});});
}

async function fetchPresence(){
  if(!otherUser)return;
  try{const{data}=await sb.from('user_presence').select('*').eq('username',otherUser).maybeSingle();if(data)renderPresence(data);}catch(e){}
}

function renderPresence(data){
  const onlineEl=document.getElementById('topbarOnline'); if(!onlineEl||!otherUser)return;
  onlineEl.classList.add('show');
  const userEl=document.getElementById('topbarUser'); if(userEl)userEl.textContent=otherUser;
  if(data.is_typing){onlineEl.className='topbar-online show typing';onlineEl.innerHTML='<span class="topbar-online-dot"></span>'+esc(otherUser)+' mengetik…';setTypingUI(true,otherUser);return;}
  setTypingUI(false);
  if(data.is_online){onlineEl.className='topbar-online show online';onlineEl.innerHTML='<span class="topbar-online-dot"></span>Online';}
  else{
    onlineEl.className='topbar-online show offline';
    const ls=data.last_seen?new Date(data.last_seen):new Date(),diff=Date.now()-ls.getTime();
    const mn=Math.floor(diff/60000),hr=Math.floor(diff/3600000),dy=Math.floor(diff/86400000);
    let lbl; if(mn<1)lbl='Baru saja';else if(mn<60)lbl=mn+' mnt lalu';else if(hr<24)lbl=hr+' jam lalu';else if(dy<7)lbl=dy+' hari lalu';else lbl=ls.toLocaleDateString('id-ID',{day:'numeric',month:'short'});
    onlineEl.innerHTML='<span class="topbar-online-dot"></span>Terakhir dilihat '+lbl;
  }
  if(document.getElementById('tabChat').classList.contains('active-tab'))markRead();
}

// ===== REPLY =====
function setReply(id,sender,msg){replyTarget={id,sender_name:sender,message:msg};const b=document.getElementById('replyBanner');if(!b)return;b.style.display='flex';document.getElementById('replyBannerName').textContent=sender;document.getElementById('replyBannerName').style.color='';document.getElementById('replyBannerText').textContent=msg.length>60?msg.slice(0,60)+'…':msg;document.getElementById('chatInput').focus();}
function clearReplyBanner(){replyTarget=null;const b=document.getElementById('replyBanner');if(b)b.style.display='none';const n=document.getElementById('replyBannerName');if(n)n.style.color='';}

// ===== EDIT =====
function startEdit(msgId,currentText){editingMsgId=msgId;editingOriginal=currentText;const inp=document.getElementById('chatInput');inp.value=currentText;autoResize(inp);inp.focus();const b=document.getElementById('replyBanner');if(b)b.style.display='flex';const n=document.getElementById('replyBannerName');if(n){n.textContent='✏ Edit Pesan';n.style.color='#ff9500';}const t=document.getElementById('replyBannerText');if(t)t.textContent=currentText.length>60?currentText.slice(0,60)+'…':currentText;}
function cancelEdit(){editingMsgId=null;editingOriginal='';const inp=document.getElementById('chatInput');if(inp){inp.value='';inp.style.height='';}clearReplyBanner();}
async function saveEdit(){
  if(!editingMsgId||!currentAccount)return;
  const inp=document.getElementById('chatInput');const newText=(inp.value||'').replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,'');
  if(!newText||newText===editingOriginal){cancelEdit();return;}
  const msgId=editingMsgId;cancelEdit();
  try{const{error}=await sb.from('chat_messages').update({message:newText,is_edited:true}).eq('id',msgId).eq('sender_name',currentAccount.name);if(error){showErr('Gagal edit: '+error.message);return;}const{data}=await sb.from('chat_messages').select('*').eq('id',msgId).single();if(data)updateMsgInDom(data);toast('Pesan diedit ✓');}catch(err){showErr('Error: '+err.message);}
}

// ===== MSG MENU =====
function closeMsgMenu(){if(activeMsgMenu&&activeMsgMenu.parentNode)activeMsgMenu.remove();activeMsgMenu=null;}
function showMsgMenu(msgId,sender,msg,anchor,isMedia){
  closeMsgMenu();
  const isMe=currentAccount&&sender===currentAccount.name, isAdmin=currentAccount&&currentAccount.role==='admin';
  const menu=document.createElement('div');menu.className='msg-action-menu';
  const rb=document.createElement('button');rb.className='msg-action-item';rb.textContent='↩ Balas';rb.onclick=(e)=>{e.stopPropagation();closeMsgMenu();setReply(msgId,sender,msg);};menu.appendChild(rb);
  if(isMe&&!isMedia){const eb=document.createElement('button');eb.className='msg-action-item';eb.textContent='✏ Edit';eb.onclick=(e)=>{e.stopPropagation();closeMsgMenu();startEdit(msgId,msg);};menu.appendChild(eb);}
  if(isMe||isAdmin){const db=document.createElement('button');db.className='msg-action-item danger';db.textContent='✕ Hapus';db.onclick=(e)=>{e.stopPropagation();closeMsgMenu();deleteMsg(msgId);};menu.appendChild(db);}
  const rect=anchor.getBoundingClientRect();
  menu.style.cssText='position:fixed;top:'+(rect.bottom+4)+'px;'+(isMe?'right:'+(window.innerWidth-rect.right)+'px;':'left:'+rect.left+'px;');
  document.body.appendChild(menu);activeMsgMenu=menu;
}
async function deleteMsg(id){const ok=await showConfirm('Hapus pesan ini?',{icon:'🗑',title:'Hapus Pesan',okText:'Hapus',cancelText:'Batal'});if(!ok)return;const{error}=await sb.from('chat_messages').delete().eq('id',id);if(error){toast('Gagal hapus',false);return;}const el=document.querySelector('[data-msg-id="'+id+'"]');if(el)el.remove();seenMsgIds.delete(String(id));toast('Pesan dihapus');}

// ===== SEND =====
let sending=false;
async function sendMsg(){
  if(editingMsgId){await saveEdit();return;}
  if(sending)return;
  if(!currentAccount){showErr('Session habis, login ulang');return;}
  const inp=document.getElementById('chatInput');
  const msg=(inp.value||'').replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,'');
  if(!msg)return;
  sending=true;inp.value='';inp.style.height='';inp.focus();
  if(selfTyping){selfTyping=false;clearTimeout(typingTimer);rpc('update_typing',{p_username:currentAccount.name,p_is_typing:false});}
  const row={message:msg,user_id:typeof USER_ID!=='undefined'?USER_ID:('u_'+Date.now()),sender_name:currentAccount.name,sender_role:currentAccount.role||'user'};
  if(replyTarget){row.reply_to_id=replyTarget.id;row.reply_to_name=replyTarget.sender_name;row.reply_to_text=replyTarget.message;}
  clearReplyBanner();
  // Tampil langsung (optimistic)
  const tempId='temp_'+Date.now();
  statusMap[tempId]='pending';
  const tempMsg={id:tempId,message:msg,sender_name:currentAccount.name,sender_role:currentAccount.role||'user',created_at:new Date().toISOString(),reply_to_name:replyTarget?replyTarget.sender_name:null,reply_to_text:replyTarget?replyTarget.message:null,is_edited:false};
  const list=document.getElementById('chatList');const ph=list.querySelector('.state-msg');if(ph)list.innerHTML='';
  const tempEl=buildMsg(tempMsg);list.appendChild(tempEl);scrollToBottom(list,true);
  try{
    const{data,error}=await sb.from('chat_messages').insert([row]).select().single();
    if(error){showErr('Gagal kirim: '+error.message);const t=document.querySelector('[data-msg-id="'+tempId+'"]');if(t)t.remove();seenMsgIds.delete(tempId);delete statusMap[tempId];inp.value=msg;sending=false;return;}
    if(data){const id=String(data.id);const t=document.querySelector('[data-msg-id="'+tempId+'"]');seenMsgIds.delete(tempId);delete statusMap[tempId];statusMap[id]='sent';seenMsgIds.add(id);lastPollTs=data.created_at;const realEl=buildMsg(data);if(t)t.replaceWith(realEl);else list.appendChild(realEl);upsertStatus(data.id,'sent');}
  }catch(err){showErr('Error: '+err.message);inp.value=msg;}
  sending=false;
}

// ===== CHAT UPLOAD =====
let pendingChatFile=null;
function doChatUpload(input){if(!currentAccount)return;const file=input.files[0];if(!file)return;pendingChatFile=file;input.value='';document.getElementById('uploadFileName').textContent=file.name;document.getElementById('uploadFileSize').textContent=fmtBytes(file.size)+' · '+(file.type||'unknown');document.getElementById('uploadProgressWrap').style.display='none';document.getElementById('uploadProgressFill').style.width='0%';document.getElementById('uploadPctLabel').textContent='0%';document.getElementById('uploadSpeedLabel').textContent='—';document.getElementById('uploadRemainLabel').textContent='—';const g=document.getElementById('uploadGoBtn');g.disabled=false;g.textContent='Kirim';g.onclick=startChatFileUpload;document.getElementById('uploadCancelBtn').textContent='Batal';document.getElementById('uploadModalCloseBtn').style.display='';document.getElementById('uploadConfirmModal').classList.add('show');}
async function startChatFileUpload(){if(!pendingChatFile||!currentAccount)return;const file=pendingChatFile,isVid=file.type.startsWith('video/'),ext=file.name.split('.').pop(),name='chat_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)+'.'+ext;const g=document.getElementById('uploadGoBtn'),cl=document.getElementById('uploadModalCloseBtn'),cn=document.getElementById('uploadCancelBtn');g.disabled=true;g.textContent='Mengirim...';cl.style.display='none';cn.textContent='Batalkan';document.getElementById('uploadProgressWrap').style.display='flex';let ll=0,lt=Date.now(),ok=false;try{await new Promise((res,rej)=>{const xhr=new XMLHttpRequest();xhr.open('POST',SB_URL+'/storage/v1/object/gallery/'+name,true);xhr.setRequestHeader('Authorization','Bearer '+SB_KEY);xhr.setRequestHeader('x-upsert','false');xhr.setRequestHeader('Cache-Control','3600');xhr.upload.onprogress=(e)=>{if(!e.lengthComputable)return;const now=Date.now(),pct=Math.round(e.loaded/e.total*100),el2=(now-lt)/1000,sp=el2>0?(e.loaded-ll)/el2:0;ll=e.loaded;lt=now;document.getElementById('uploadProgressFill').style.width=pct+'%';document.getElementById('uploadPctLabel').textContent=pct+'%';document.getElementById('uploadSpeedLabel').textContent=sp>0?fmtBytes(sp)+'/s':'—';document.getElementById('uploadRemainLabel').textContent=fmtBytes(e.total-e.loaded)+' tersisa';};xhr.onload=()=>{xhr.status>=200&&xhr.status<300?res():rej(new Error('HTTP '+xhr.status));};xhr.onerror=()=>rej(new Error('Network error'));xhr.onabort=()=>rej(new Error('Dibatalkan'));xhr.send(file);});ok=true;}catch(err){toast(err.message==='Dibatalkan'?'Dibatalkan':'Upload gagal',false);g.disabled=false;g.textContent='Kirim';cn.textContent='Batal';cl.style.display='';document.getElementById('uploadProgressWrap').style.display='none';document.getElementById('uploadConfirmModal').classList.remove('show');g.onclick=startGalleryUpload;pendingChatFile=null;return;}if(!ok)return;const url=sb.storage.from('gallery').getPublicUrl(name).data.publicUrl;const content=(isVid?'[video]':'[img]')+url;const{error}=await sb.from('chat_messages').insert([{message:content,user_id:typeof USER_ID!=='undefined'?USER_ID:'u',sender_name:currentAccount.name,sender_role:currentAccount.role}]);if(error)toast('Gagal kirim',false);else toast('Media terkirim ✓');document.getElementById('uploadConfirmModal').classList.remove('show');document.getElementById('uploadGoBtn').onclick=startGalleryUpload;pendingChatFile=null;}

// ===== MULTISELECT =====
function enterSelect(id){selectionActive=true;addSel(id);renderSelBar();}
function toggleSelect(id){if(!selectionActive)return;if(selectedMsgIds.has(id))remSel(id);else addSel(id);if(!selectedMsgIds.size){exitSelect();return;}renderSelBar();}
function addSel(id){selectedMsgIds.add(id);const r=document.querySelector('[data-msg-id="'+id+'"]');if(r)r.classList.add('msg-selected');}
function remSel(id){selectedMsgIds.delete(id);const r=document.querySelector('[data-msg-id="'+id+'"]');if(r)r.classList.remove('msg-selected');}
function allOwn(){for(const id of selectedMsgIds){const r=document.querySelector('[data-msg-id="'+id+'"]');if(!r||!r.classList.contains('mine'))return false;}return true;}
function renderSelBar(){let bar=document.getElementById('selectionBar');if(!bar){bar=document.createElement('div');bar.id='selectionBar';bar.className='selection-bar';document.querySelector('.topbar').appendChild(bar);}const canDel=(currentAccount&&currentAccount.role==='admin')||allOwn();bar.innerHTML='<button class="sel-cancel-btn" onclick="exitSelect()">✕ Batal</button><span class="sel-label">'+selectedMsgIds.size+' dipilih</span>'+(canDel?'<button class="sel-delete-btn" onclick="delSelected()">🗑 Hapus</button>':'<span style="width:74px"></span>');bar.style.display='flex';}
function exitSelect(){selectionActive=false;selectedMsgIds.clear();document.querySelectorAll('.msg-selected').forEach(e=>e.classList.remove('msg-selected'));const b=document.getElementById('selectionBar');if(b)b.style.display='none';}
function exitSelectionMode(){exitSelect();}
async function delSelected(){if(!selectedMsgIds.size)return;const ids=Array.from(selectedMsgIds);const ok=await showConfirm('Hapus '+(ids.length===1?'pesan ini':ids.length+' pesan')+'?',{icon:'🗑',title:'Hapus Pesan',okText:'Hapus',cancelText:'Batal'});if(!ok)return;exitSelect();await sb.from('chat_messages').delete().in('id',ids);ids.forEach(id=>{const e=document.querySelector('[data-msg-id="'+id+'"]');if(e)e.remove();seenMsgIds.delete(String(id));});toast(ids.length===1?'Pesan dihapus':ids.length+' pesan dihapus');}
async function delSelectedMsgs(){await delSelected();}

// ===== EMOJI =====
const EMOJI_CATEGORIES=[{icon:'😀',label:'Smileys',emojis:['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','💫','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖']},{icon:'❤️',label:'Hearts',emojis:['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟']},{icon:'👋',label:'People',emojis:['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦿','🦶','👂','🦻','👃','🧠','🦷','🦴','👀','👁️','👅','👄','💋','🩸']},{icon:'🐱',label:'Animals',emojis:['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🦋','🐌','🐞','🐜','🦟','🕷️','🦂','🐢','🐍','🦎','🐙','🦑','🦐','🦀','🐡','🐠','🐟','🐬','🐳','🦈']},{icon:'🍎',label:'Food',emojis:['🍏','🍎','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🌶️','🧄','🥔','🥐','🥯','🍞','🥖','🧀','🥚','🍳','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🌮','🌯','🥗','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🍤','🍙','🍚','🍘','🍥','🥮','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🧃','🥤','🧋','☕','🍵','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🍾']},{icon:'⚽',label:'Activity',emojis:['⚽','🏀','🏈','⚾','🥎','🏐','🏉','🎾','🥏','🎱','🏓','🏸','🏒','🥅','⛳','🎯','🎮','🕹️','🎲','🧩','🧸','♟️','🎭','🎨','🎰']},{icon:'🌍',label:'Travel',emojis:['🌍','🌎','🌏','🏔️','⛰️','🌋','🏕️','🏖️','🏜️','🏝️','🏠','🏡','🏢','🏥','🏦','🏨','🏪','🏫','🏬','🏯','🏰','⛪','🌃','🏙️','🌄','🌅','🌆','🌇','🌉','🚂','🚄','🚇','🚌','🚑','🚒','🚓','🚕','✈️','🛫','🚀','🛸','🚁','⛵','🚤','🚢']},{icon:'💡',label:'Objects',emojis:['⌚','📱','💻','⌨️','🖥️','📷','📸','📹','🎥','📞','☎️','📺','📻','🔋','🔌','💡','🔦','💰','💵','💳','✉️','📧','📝','📁','📂','📅','📈','📉','📊','📋','📌','📍','✂️','🔒','🔓','🔑','🔨','⚙️','🔗','🧰','🧲','💊','🩺','🧪','🧬','🔬','🔭']}];
function buildEmojiPicker(){if(document.getElementById('emojiPickerPanel'))return document.getElementById('emojiPickerPanel');const panel=document.createElement('div');panel.id='emojiPickerPanel';panel.className='emoji-picker-wrap';const hint=document.createElement('div');hint.className='emoji-swipe-hint';panel.appendChild(hint);const tabs=document.createElement('div');tabs.className='emoji-cat-tabs';const body=document.createElement('div');body.className='emoji-body';EMOJI_CATEGORIES.forEach((cat,idx)=>{const tab=document.createElement('button');tab.className='emoji-cat-tab'+(idx===0?' active':'');tab.title=cat.label;tab.textContent=cat.icon;tab.onclick=()=>{document.querySelectorAll('.emoji-cat-tab').forEach(t=>t.classList.remove('active'));tab.classList.add('active');document.querySelectorAll('.emoji-section').forEach(s=>s.style.display='none');document.getElementById('emoji-sec-'+idx).style.display='';};tabs.appendChild(tab);const sec=document.createElement('div');sec.className='emoji-section';sec.id='emoji-sec-'+idx;if(idx!==0)sec.style.display='none';cat.emojis.forEach(em=>{const b=document.createElement('button');b.className='emoji-item';b.textContent=em;b.onclick=(e)=>{e.stopPropagation();insertEmoji(em);};sec.appendChild(b);});body.appendChild(sec);});panel.appendChild(tabs);panel.appendChild(body);const cb=document.querySelector('.chat-bar');if(cb)cb.appendChild(panel);return panel;}
function insertEmoji(em){const i=document.getElementById('chatInput');if(!i)return;const s=i.selectionStart,e=i.selectionEnd;i.value=i.value.slice(0,s)+em+i.value.slice(e);i.setSelectionRange(s+em.length,s+em.length);i.focus();}
function toggleEmojiPicker(e){e.stopPropagation();const p=document.getElementById('emojiPickerPanel')||buildEmojiPicker();emojiPickerOpen=!emojiPickerOpen;p.style.display=emojiPickerOpen?'flex':'none';document.getElementById('emojiTrigger').classList.toggle('active',emojiPickerOpen);}
function closeEmojiPicker(){emojiPickerOpen=false;const p=document.getElementById('emojiPickerPanel');if(p)p.style.display='none';const t=document.getElementById('emojiTrigger');if(t)t.classList.remove('active');}

// ===== GALLERY =====
let galleryItems=[],galleryLoaded=false,lbIdx=-1;
async function loadGallery(){const el=document.getElementById('galleryGrid');el.innerHTML='<p class="state-msg">Memuat...</p>';const{data,error}=await sb.from('gallery').select('*').order('created_at',{ascending:false});if(error){el.innerHTML='<p class="state-msg err">Error: '+error.message+'</p>';return;}galleryLoaded=true;galleryItems=[];if(!data||!data.length){el.innerHTML='<p class="state-msg">Belum ada media.</p>';return;}el.innerHTML='';const isAdmin=currentAccount&&currentAccount.role==='admin';const frag=document.createDocumentFragment();data.forEach((f,idx)=>{const isVid=/\.(mp4|webm|mov|avi)$/i.test(f.file_name||'');galleryItems.push({url:f.file_url,isVid});const d=document.createElement('div');d.className='g-item';if(isVid){const th=document.createElement('div');th.style.cssText='position:relative;width:100%;height:100%;cursor:pointer;';const v=document.createElement('video');v.className='g-media';v.preload='metadata';v.muted=true;v.playsInline=true;v.src=f.file_url+'#t=0.001';const pi=document.createElement('div');pi.className='g-play-icon';pi.innerHTML='<svg viewBox="0 0 24 24" width="28" height="28"><circle cx="12" cy="12" r="12" fill="rgba(0,0,0,0.5)"/><polygon points="10,8 18,12 10,16" fill="white"/></svg>';th.appendChild(v);th.appendChild(pi);((i)=>{th.onclick=()=>openLightbox(i);})(idx);d.appendChild(th);}else{const img=document.createElement('img');img.src=f.file_url;img.className='g-media';img.loading='lazy';((i)=>{img.onclick=()=>openLightbox(i);})(idx);d.appendChild(img);}if(isAdmin){const db=document.createElement('button');db.className='g-del';db.textContent='✕';db.onclick=(e)=>{e.stopPropagation();delMedia(f.id,f.file_name);};d.appendChild(db);}frag.appendChild(d);});el.appendChild(frag);}
async function delMedia(id,name){if(!currentAccount||currentAccount.role!=='admin')return;const ok=await showConfirm('Hapus media ini?',{icon:'🗑',title:'Hapus Media',okText:'Hapus',cancelText:'Batal'});if(!ok)return;await sb.storage.from('gallery').remove([name]);const{error}=await sb.from('gallery').delete().eq('id',id);if(error){toast('Gagal hapus',false);return;}toast('Dihapus');galleryLoaded=false;loadGallery();}

// ===== GALLERY UPLOAD =====
let pendingFile=null,uploadXHR=null;
function triggerUploadConfirm(input){if(!currentAccount||currentAccount.role!=='admin'){toast('Hanya admin yang bisa upload',false);input.value='';return;}const file=input.files[0];if(!file)return;pendingFile=file;document.getElementById('uploadFileName').textContent=file.name;document.getElementById('uploadFileSize').textContent=fmtBytes(file.size)+' · '+(file.type||'unknown');document.getElementById('uploadProgressWrap').style.display='none';document.getElementById('uploadProgressFill').style.width='0%';document.getElementById('uploadPctLabel').textContent='0%';document.getElementById('uploadSpeedLabel').textContent='—';document.getElementById('uploadRemainLabel').textContent='—';const g=document.getElementById('uploadGoBtn');g.disabled=false;g.textContent='Upload';g.onclick=startGalleryUpload;document.getElementById('uploadCancelBtn').textContent='Batal';document.getElementById('uploadModalCloseBtn').style.display='';document.getElementById('uploadConfirmModal').classList.add('show');input.value='';}
function cancelUploadModal(){if(uploadXHR){try{uploadXHR.abort();}catch(e){}uploadXHR=null;}pendingFile=null;pendingChatFile=null;document.getElementById('uploadGoBtn').onclick=startGalleryUpload;document.getElementById('uploadConfirmModal').classList.remove('show');}
async function startGalleryUpload(){if(!pendingFile)return;const file=pendingFile;const g=document.getElementById('uploadGoBtn');g.disabled=true;g.textContent='Mengupload...';document.getElementById('uploadModalCloseBtn').style.display='none';document.getElementById('uploadCancelBtn').textContent='Batalkan';document.getElementById('uploadProgressWrap').style.display='flex';const ext=file.name.split('.').pop();const name=Date.now()+'_'+Math.random().toString(36).slice(2,6)+'.'+ext;let ll=0,lt=Date.now(),ok=false;try{await new Promise((res,rej)=>{const xhr=new XMLHttpRequest();uploadXHR=xhr;xhr.open('POST',SB_URL+'/storage/v1/object/gallery/'+name,true);xhr.setRequestHeader('Authorization','Bearer '+SB_KEY);xhr.setRequestHeader('x-upsert','false');xhr.setRequestHeader('Cache-Control','3600');xhr.upload.onprogress=(e)=>{if(!e.lengthComputable)return;const now=Date.now(),pct=Math.round(e.loaded/e.total*100),el2=(now-lt)/1000,sp=el2>0?(e.loaded-ll)/el2:0;ll=e.loaded;lt=now;document.getElementById('uploadProgressFill').style.width=pct+'%';document.getElementById('uploadPctLabel').textContent=pct+'%';document.getElementById('uploadSpeedLabel').textContent=sp>0?fmtBytes(sp)+'/s':'—';document.getElementById('uploadRemainLabel').textContent=fmtBytes(e.total-e.loaded)+' tersisa';};xhr.onload=()=>{uploadXHR=null;xhr.status>=200&&xhr.status<300?res():rej(new Error('HTTP '+xhr.status));};xhr.onerror=()=>{uploadXHR=null;rej(new Error('Network error'));};xhr.onabort=()=>{uploadXHR=null;rej(new Error('Dibatalkan'));};xhr.send(file);});ok=true;}catch(err){toast(err.message==='Dibatalkan'?'Upload dibatalkan':'Upload gagal: '+err.message,false);g.disabled=false;g.textContent='Upload';document.getElementById('uploadCancelBtn').textContent='Batal';document.getElementById('uploadModalCloseBtn').style.display='';document.getElementById('uploadProgressWrap').style.display='none';document.getElementById('uploadConfirmModal').classList.remove('show');pendingFile=null;return;}if(!ok)return;const url=sb.storage.from('gallery').getPublicUrl(name).data.publicUrl;const{error}=await sb.from('gallery').insert([{file_url:url,file_name:name,uploaded_by:currentAccount?currentAccount.name:null}]);if(error)toast('Gagal simpan: '+error.message,false);else{toast('Berhasil diupload ✓');galleryLoaded=false;loadGallery();}pendingFile=null;uploadXHR=null;document.getElementById('uploadConfirmModal').classList.remove('show');}

// ===== LIGHTBOX =====
function openLightbox(idx){lbIdx=idx;lbRender(idx);lbNavUpdate();document.getElementById('lightbox').classList.add('show');document.body.style.overflow='hidden';}
function openLightboxFromChat(url){lbIdx=-1;const w=document.getElementById('lightboxMediaWrap');lbClear(w);const img=document.getElementById('lightboxImg');img.src=url;img.style.display='';document.getElementById('lightboxCounter').innerHTML='';document.getElementById('lightboxPrev').style.display='none';document.getElementById('lightboxNext').style.display='none';document.getElementById('lightbox').classList.add('show');document.body.style.overflow='hidden';}
function lbClear(w){if(!w)w=document.getElementById('lightboxMediaWrap');const v=w.querySelector('video');if(v){try{v.pause();v.src='';}catch(e){}v.remove();}const img=document.getElementById('lightboxImg');if(img){img.src='';img.style.display='none';}}
function lbRender(idx){const w=document.getElementById('lightboxMediaWrap');lbClear(w);if(idx<0||!galleryItems[idx])return;const item=galleryItems[idx],img=document.getElementById('lightboxImg');if(item.isVid){img.style.display='none';const v=document.createElement('video');v.src=item.url;v.controls=true;v.playsInline=true;v.style.cssText='max-width:100%;max-height:76vh;width:auto;height:auto;object-fit:contain;display:block;';w.appendChild(v);}else{img.src=item.url;img.style.display='';}lbCounter(idx);}
function lbNavUpdate(){const p=document.getElementById('lightboxPrev'),n=document.getElementById('lightboxNext');if(lbIdx<0||galleryItems.length<=1){if(p)p.style.display='none';if(n)n.style.display='none';return;}if(p)p.style.display=lbIdx>0?'':'none';if(n)n.style.display=lbIdx<galleryItems.length-1?'':'none';}
function lbCounter(idx){const c=document.getElementById('lightboxCounter');if(!c)return;if(galleryItems.length<=1){c.innerHTML='';return;}const s=Math.max(0,idx-5),e=Math.min(galleryItems.length-1,s+11);c.innerHTML=Array.from({length:e-s+1},(_,i)=>'<span class="lb-dot'+(s+i===idx?' active':'')+'"></span>').join('');}
function lightboxNav(dir){if(lbIdx<0)return;const n=lbIdx+dir;if(n<0||n>=galleryItems.length)return;lbIdx=n;const w=document.getElementById('lightboxMediaWrap');w.style.transition='opacity .15s,transform .15s';w.style.opacity='0';w.style.transform='translateX('+(dir>0?'24px':'-24px')+')';setTimeout(()=>{lbRender(lbIdx);lbNavUpdate();w.style.transition='opacity .2s,transform .2s';w.style.opacity='1';w.style.transform='translateX(0)';},120);}
function closeLightbox(){document.getElementById('lightbox').classList.remove('show');const w=document.getElementById('lightboxMediaWrap');lbClear(w);const img=document.getElementById('lightboxImg');if(img){img.src='';img.style.display='';}document.getElementById('lightboxCounter').innerHTML='';lbIdx=-1;document.body.style.overflow='';if(w){w.style.opacity='';w.style.transform='';w.style.transition='';}}
(function(){document.addEventListener('DOMContentLoaded',()=>{const lb=document.getElementById('lightbox');if(!lb)return;let sx=0,sw=false;lb.addEventListener('touchstart',(e)=>{if(e.target.closest('.lightbox-close,.lightbox-prev,.lightbox-next'))return;sx=e.touches[0].clientX;sw=false;},{passive:true});lb.addEventListener('touchmove',(e)=>{if(Math.abs(e.touches[0].clientX-sx)>12)sw=true;},{passive:true});lb.addEventListener('touchend',(e)=>{if(!sw)return;const dx=e.changedTouches[0].clientX-sx;sw=false;if(Math.abs(dx)>60)lightboxNav(dx<0?1:-1);});});})();

// ===== CLEANUP =====
window.addEventListener('beforeunload',()=>{if(presenceTimer)clearInterval(presenceTimer);if(pollTimer)clearInterval(pollTimer);if(chatChannel){try{sb.removeChannel(chatChannel);}catch(e){}}if(presenceChannel){try{sb.removeChannel(presenceChannel);}catch(e){}}if(currentAccount){rpc('update_presence',{p_username:currentAccount.name,p_is_online:false});rpc('update_typing',{p_username:currentAccount.name,p_is_typing:false});}if(vnRecording)stopVnRecording(false);});
