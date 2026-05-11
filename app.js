// ========== SUPABASE ==========
const SB_URL = 'https://cxlvnwbfdbymdoddjqwn.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4bHZud2JmZGJ5bWRvZGRqcXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDUwOTMsImV4cCI6MjA5MzQ4MTA5M30.9jGx6eY7qzvQzW65xD7gVOMP1YZQzKjULginFNwSV-k';
const sb = window.supabase.createClient(SB_URL, SB_KEY);

// ========== ACCOUNTS ==========
const ACCOUNTS = {
  'Ndifaa': { pin: '1408', role: 'user',  color: '#e91e8c' },
  "Jef'z":  { pin: 'zz',   role: 'admin', color: '#3d5afe' }
};

// ========== STATE ==========
let currentAccount = null;
let dark = localStorage.getItem('theme') === 'dark';
let uid = localStorage.getItem('uid');
if (!uid) { uid = 'u_' + Math.random().toString(36).slice(2,10); localStorage.setItem('uid', uid); }

// Chat
let chatChannel = null;
let isChatActive = false;
let chatLoaded = false;
let seenMsgIds = new Set();
let pollTimer = null;

// Countdown
let countdownTimer = null;

// Cache flags — hanya load sekali per sesi, bukan realtime
let notesLoaded = false;
let galleryLoaded = false;

// ========== ANIMATED ORB BACKGROUND (lebih cepat) ==========
(function initOrbBg() {
  const bg = document.getElementById('globalBg');
  if (!bg) return;

  const ORB_PALETTES = [
    ['#ff6eb4', '#ff3cac'],
    ['#60aaff', '#007aff'],
    ['#34d399', '#06b6d4'],
    ['#fbbf24', '#f97316'],
    ['#c084fc', '#8b5cf6'],
    ['#fb7185', '#f43f5e'],
    ['#86efac', '#22c55e'],
    ['#67e8f9', '#38bdf8'],
  ];

  const NUM_ORBS = 8;
  const orbs = [];

  for (let i = 0; i < NUM_ORBS; i++) {
    const el = document.createElement('div');
    el.className = 'g-orb';
    bg.appendChild(el);

    const palette = ORB_PALETTES[i % ORB_PALETTES.length];
    const size = 160 + Math.random() * 220;
    const blur = size * 0.28;

    el.style.cssText = [
      'width:' + size + 'px',
      'height:' + size + 'px',
      'filter:blur(' + blur + 'px)',
      'background:radial-gradient(circle at 40% 40%,' + palette[0] + ',' + palette[1] + ')',
      'will-change:transform,opacity',
    ].join(';');

    const startX = Math.random() * 100;
    const startY = Math.random() * 100;
    const baseOpacity = 0.38 + Math.random() * 0.28;

    orbs.push({
      el,
      x: startX, y: startY,
      // Kecepatan 3x lebih cepat dari sebelumnya
      vx: (Math.random() - 0.5) * 0.16,
      vy: (Math.random() - 0.5) * 0.16,
      scaleBase: 1,
      scaleAmp:  0.10 + Math.random() * 0.12,
      scaleFreq: 0.0012 + Math.random() * 0.0010, // lebih cepat
      opBase:    baseOpacity,
      opAmp:     0.08 + Math.random() * 0.10,
      opFreq:    0.0010 + Math.random() * 0.0008, // lebih cepat
      phase:     Math.random() * Math.PI * 2,
    });
  }

  let lastTime = performance.now();

  function tick(now) {
    const dt = Math.min(now - lastTime, 50);
    lastTime = now;

    for (const orb of orbs) {
      orb.x += orb.vx * dt * 0.016;
      orb.y += orb.vy * dt * 0.016;

      if (orb.x < -5)  { orb.x = -5;  orb.vx =  Math.abs(orb.vx) * (0.7 + Math.random() * 0.3); }
      if (orb.x > 105) { orb.x = 105; orb.vx = -Math.abs(orb.vx) * (0.7 + Math.random() * 0.3); }
      if (orb.y < -5)  { orb.y = -5;  orb.vy =  Math.abs(orb.vy) * (0.7 + Math.random() * 0.3); }
      if (orb.y > 105) { orb.y = 105; orb.vy = -Math.abs(orb.vy) * (0.7 + Math.random() * 0.3); }

      if (Math.random() < 0.005) {
        orb.vx += (Math.random() - 0.5) * 0.04;
        orb.vy += (Math.random() - 0.5) * 0.04;
        const spd = Math.hypot(orb.vx, orb.vy);
        if (spd > 0.20) { orb.vx *= 0.20 / spd; orb.vy *= 0.20 / spd; }
      }

      const t = now * orb.scaleFreq + orb.phase;
      const scale = orb.scaleBase + Math.sin(t) * orb.scaleAmp;
      const op    = orb.opBase   + Math.sin(now * orb.opFreq + orb.phase + 1) * orb.opAmp;

      orb.el.style.left      = orb.x + 'vw';
      orb.el.style.top       = orb.y + 'vh';
      orb.el.style.transform = 'translate(-50%,-50%) scale(' + scale + ')';
      orb.el.style.opacity   = Math.max(0.12, Math.min(0.75, op));
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();

// ========== COUNTDOWN ==========
function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);

  var targetDate = new Date("2024-03-18T00:00:00");
  targetDate.setFullYear(targetDate.getFullYear() + 3);

  function tick() {
    var now = new Date();
    var isCountdown = now < targetDate;
    var from = isCountdown ? now : targetDate;
    var to   = isCountdown ? targetDate : now;

    var years   = to.getFullYear() - from.getFullYear();
    var months  = to.getMonth()    - from.getMonth();
    var days    = to.getDate()     - from.getDate();
    var hours   = to.getHours()    - from.getHours();
    var minutes = to.getMinutes()  - from.getMinutes();
    var seconds = to.getSeconds()  - from.getSeconds();

    if (seconds < 0) { seconds += 60; minutes--; }
    if (minutes < 0) { minutes += 60; hours--; }
    if (hours   < 0) { hours   += 24; days--; }
    if (days    < 0) {
      var lastMonth = new Date(to.getFullYear(), to.getMonth(), 0);
      days   += lastMonth.getDate();
      months--;
    }
    if (months  < 0) { months  += 12; years--; }

    var prefix = isCountdown ? "" : "- ";

    var labelEl = document.getElementById('countdownLabel');
    var valEl   = document.getElementById('countdown');
    if (!labelEl || !valEl) return;

    labelEl.textContent = isCountdown ? "Menuju 18 Maret 2027 ♡" : "Sudah bersama selama ♡";
    valEl.textContent =
      prefix +
      years   + " Tahun " +
      months  + " Bulan " +
      days    + " Hari " +
      hours   + " Jam " +
      minutes + " Menit " +
      seconds + " Detik";
  }

  tick();
  countdownTimer = setInterval(tick, 1000);
}

function stopCountdown() {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
}

// ========== KEYBOARD AWARE MODAL ==========
function getVisibleHeight() {
  if (window.visualViewport) return window.visualViewport.height;
  return window.innerHeight;
}

function adjustOpenModals() {
  var vh = getVisibleHeight();
  var maxH = Math.floor(vh * 0.92);
  document.querySelectorAll('.modal-overlay.show:not(#editModal) .modal-box').forEach(function(box) {
    box.style.maxHeight = maxH + 'px';
  });
  if (document.getElementById('editModal').classList.contains('show')) {
    _adjustEditModal();
  }
}

function _adjustEditModal() {
  var overlay = document.getElementById('editModal');
  var box     = document.getElementById('editModalBox');
  if (!overlay || !box) return;

  var vp = window.visualViewport;
  if (vp) {
    var availH = vp.height;
    overlay.style.position = 'fixed';
    overlay.style.top      = vp.offsetTop + 'px';
    overlay.style.left     = vp.offsetLeft + 'px';
    overlay.style.width    = vp.width + 'px';
    overlay.style.height   = availH + 'px';
    overlay.style.bottom   = 'auto';
    box.style.maxHeight = Math.floor(availH * 0.94) + 'px';
  } else {
    overlay.style.top    = '0';
    overlay.style.height = window.innerHeight + 'px';
    box.style.maxHeight  = Math.floor(window.innerHeight * 0.92) + 'px';
  }
}

function _resetEditModalOverlay() {
  var overlay = document.getElementById('editModal');
  var box     = document.getElementById('editModalBox');
  if (overlay) {
    overlay.style.position = '';
    overlay.style.top      = '';
    overlay.style.left     = '';
    overlay.style.width    = '';
    overlay.style.height   = '';
    overlay.style.bottom   = '';
  }
  if (box) box.style.maxHeight = '';
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', function() {
    if (document.getElementById('editModal').classList.contains('show')) {
      _adjustEditModal();
    } else {
      adjustOpenModals();
    }
  });
  window.visualViewport.addEventListener('scroll', function() {
    if (document.getElementById('editModal').classList.contains('show')) {
      _adjustEditModal();
    }
  });
} else {
  window.addEventListener('resize', adjustOpenModals);
}

document.addEventListener('focusin', function(e) {
  var tag = e.target.tagName;
  if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;
  if (document.getElementById('editModal').classList.contains('show')) {
    setTimeout(_adjustEditModal, 80);
    setTimeout(_adjustEditModal, 320);
  } else if (document.querySelector('.modal-overlay.show')) {
    setTimeout(adjustOpenModals, 350);
  }
});
document.addEventListener('focusout', function() {
  setTimeout(function() {
    if (document.getElementById('editModal').classList.contains('show')) {
      _adjustEditModal();
    } else {
      adjustOpenModals();
    }
  }, 200);
});

// ========== BOOT ==========
window.onload = function () {
  applyTheme();
  var auth = sessionStorage.getItem('auth');
  var accName = sessionStorage.getItem('accName');
  var t = sessionStorage.getItem('authTime');
  if (auth && accName && t && (Date.now() - parseInt(t)) < 3600000) {
    currentAccount = {
      name: accName,
      role: sessionStorage.getItem('accRole'),
      color: ACCOUNTS[accName] ? ACCOUNTS[accName].color : '#3d5afe'
    };
    showDash();
  }
};

// ========== THEME ==========
function applyTheme() {
  document.body.classList.toggle('dark', dark);
  var gbg = document.getElementById('globalBg');
  if (gbg) gbg.classList.toggle('dark', dark);
  var icon = document.getElementById('themeBtnIcon');
  var label = document.getElementById('themeBtnLabel');
  if (icon) icon.textContent = dark ? '☀️' : '🌙';
  if (label) label.textContent = dark ? 'Light Mode' : 'Dark Mode';
}
function toggleTheme() {
  dark = !dark;
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  applyTheme();
}

// ========== TOAST ==========
var toastTimer;
function toast(msg, ok) {
  if (ok === undefined) ok = true;
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + (ok ? 'ok' : 'err');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.className = 'toast'; }, 2800);
}

// ========== UPLOAD PROGRESS TOAST ==========
function showUploadProgress(percent, speedStr, remainStr) {
  var el = document.getElementById('toast');
  el.className = 'toast show upload-progress';
  el.innerHTML =
    '<div style="display:flex;flex-direction:column;gap:3px;min-width:180px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px">' +
        '<span>Mengupload...</span>' +
        '<span style="font-weight:700">' + percent + '%</span>' +
      '</div>' +
      '<div style="background:rgba(255,255,255,0.25);border-radius:4px;height:4px;overflow:hidden">' +
        '<div style="background:white;height:100%;width:' + percent + '%;transition:width 0.2s;border-radius:4px"></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;opacity:0.85">' +
        '<span>' + speedStr + '</span>' +
        '<span>' + remainStr + '</span>' +
      '</div>' +
    '</div>';
  clearTimeout(toastTimer);
}

function hideUploadProgress() {
  var el = document.getElementById('toast');
  el.className = 'toast';
  el.innerHTML = '';
}

// ========== LOGIN ==========
var pendingAccount = null;

function selectAccount(name, role) {
  pendingAccount = { name: name, role: role, color: ACCOUNTS[name] ? ACCOUNTS[name].color : '#3d5afe' };
  document.getElementById('stepAccount').style.display = 'none';
  document.getElementById('stepPin').style.display = 'block';
  document.getElementById('selectedAccInfo').innerHTML =
    '<div class="sel-acc">' +
      '<div class="acc-avatar-lg" style="background:' + pendingAccount.color + '">' + name.charAt(0).toUpperCase() + '</div>' +
      '<div><div class="sel-name">' + name + '</div>' +
      '<div class="sel-role">' + (role === 'admin' ? '👑 Admin' : '👤 User') + '</div></div>' +
    '</div>';
  setTimeout(function () { document.getElementById('pinInput').focus(); }, 100);
  document.getElementById('pinInput').onkeydown = function(e) { if (e.key === 'Enter') doLogin(); };
}

function backToAccount() {
  pendingAccount = null;
  document.getElementById('stepPin').style.display = 'none';
  document.getElementById('stepAccount').style.display = 'block';
  document.getElementById('pinInput').value = '';
  document.getElementById('loginErr').textContent = '';
}

function doLogin() {
  var pin = document.getElementById('pinInput').value;
  var errEl = document.getElementById('loginErr');
  errEl.textContent = '';
  if (!pin) { errEl.textContent = 'Masukkan PIN terlebih dahulu'; return; }
  if (!pendingAccount) return;
  var acc = ACCOUNTS[pendingAccount.name];
  if (!acc) { errEl.textContent = 'Akun tidak ditemukan'; return; }
  if (pin === acc.pin) {
    currentAccount = pendingAccount;
    sessionStorage.setItem('auth', '1');
    sessionStorage.setItem('authTime', Date.now().toString());
    sessionStorage.setItem('accName', currentAccount.name);
    sessionStorage.setItem('accRole', currentAccount.role);
    sessionStorage.setItem('activeTab', 'Chat');
    document.getElementById('pinInput').value = '';
    // Reset cache saat login baru
    notesLoaded = false;
    galleryLoaded = false;
    showDash();
  } else {
    errEl.textContent = 'PIN salah, coba lagi';
    document.getElementById('pinInput').value = '';
    document.getElementById('pinInput').focus();
  }
}

function doLogout() {
  if (!confirm('Yakin mau logout?')) return;
  stopChatSync();
  stopCountdown();
  sessionStorage.clear();
  currentAccount = null;
  pendingAccount = null;
  chatLoaded = false;
  notesLoaded = false;
  galleryLoaded = false;
  seenMsgIds.clear();
  document.getElementById('stepPin').style.display = 'none';
  document.getElementById('stepAccount').style.display = 'block';
  document.getElementById('pinInput').value = '';
  document.getElementById('loginErr').textContent = '';
  document.getElementById('dashPage').className = 'page';
  document.getElementById('loginPage').className = 'page active';
}

function stopChatSync() {
  isChatActive = false;
  if (chatChannel) { try { sb.removeChannel(chatChannel); } catch(e){} chatChannel = null; }
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

// ========== SHOW DASH ==========
function showDash() {
  document.getElementById('loginPage').className = 'page';
  document.getElementById('dashPage').className = 'page active';
  var avatarEl = document.getElementById('topbarAvatar');
  avatarEl.textContent = currentAccount.name.charAt(0).toUpperCase();
  avatarEl.style.background = currentAccount.color;
  document.getElementById('topbarUser').textContent =
    currentAccount.name + (currentAccount.role === 'admin' ? ' 👑' : ' 👤');

  // Gallery upload FAB: hanya admin yang bisa upload
  var galleryFab = document.querySelector('.gallery-fab-wrap');
  if (galleryFab) galleryFab.style.display = currentAccount.role === 'admin' ? 'block' : 'none';

  var lastTab = sessionStorage.getItem('activeTab') || 'Chat';
  activateTab(lastTab);
}

// ========== TABS ==========
function goTab(name, title, btn) {
  sessionStorage.setItem('activeTab', name);
  activateTab(name);
}

function activateTab(name) {
  var titles = { Chat: 'ChatRoom', Notes: 'Catatan', Gallery: 'Gallery' };
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active-tab'); });
  document.querySelectorAll('.nav-item').forEach(function(b) {
    var lbl = b.querySelector('span') ? b.querySelector('span').textContent : '';
    b.classList.toggle('active',
      (name==='Chat'&&lbl==='Chat') || (name==='Notes'&&lbl==='Catatan') || (name==='Gallery'&&lbl==='Gallery')
    );
  });
  document.getElementById('tab' + name).classList.add('active-tab');
  document.getElementById('topbarTitle').textContent = titles[name] || name;

  if (name !== 'Chat') {
    isChatActive = false;
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  } else {
    isChatActive = true;
  }

  // Countdown: jalan hanya saat di tab Notes
  if (name === 'Notes') {
    startCountdown();
  } else {
    stopCountdown();
  }

  if (name === 'Chat') initChat();
  // Notes & Gallery: hanya load jika belum pernah load (tidak realtime)
  if (name === 'Notes' && !notesLoaded) loadNotes();
  if (name === 'Gallery' && !galleryLoaded) loadGallery();
}

// ========== HELPERS ==========
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function decodeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}
function fmtDate(d) {
  return new Date(d).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function fmtTime(d) {
  return new Date(d).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
}
function scrollBottom(el, smooth) {
  if (!el) return;
  requestAnimationFrame(function() {
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
  });
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function fmtBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// ========== NOTES ==========
var notesCache = {};
var activeNoteOptionMenu = null;

function closeActiveOptionMenu() {
  if (activeNoteOptionMenu && activeNoteOptionMenu.parentNode) {
    activeNoteOptionMenu.remove();
  }
  activeNoteOptionMenu = null;
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.note-chevron') && !e.target.closest('.read-author-option') && !e.target.closest('.note-options-menu')) {
    closeActiveOptionMenu();
  }
});

function showNoteOptions(cardElement, noteId, anchorElement) {
  closeActiveOptionMenu();
  
  var n = notesCache[noteId];
  if (!n) return;
  
  var isAdmin = currentAccount && currentAccount.role === 'admin';
  var isOwner = currentAccount && n.author === currentAccount.name;
  var canEdit = isAdmin || isOwner;
  
  if (!canEdit) return;
  
  var menu = document.createElement('div');
  menu.className = 'note-options-menu';
  
  var editBtn = document.createElement('button');
  editBtn.textContent = '✏ Edit';
  editBtn.className = 'note-option-item edit';
  editBtn.onclick = function(e) {
    e.stopPropagation();
    closeActiveOptionMenu();
    openEditModal(noteId);
  };
  
  var delBtn = document.createElement('button');
  delBtn.textContent = '✕ Hapus';
  delBtn.className = 'note-option-item delete';
  delBtn.onclick = function(e) {
    e.stopPropagation();
    closeActiveOptionMenu();
    delNote(noteId);
  };
  
  menu.appendChild(editBtn);
  menu.appendChild(delBtn);
  
  var rect = anchorElement.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
  menu.style.right = (window.innerWidth - rect.right) + 'px';
  
  document.body.appendChild(menu);
  activeNoteOptionMenu = menu;
}

async function loadNotes() {
  closeActiveOptionMenu();
  var el = document.getElementById('notesList');
  el.innerHTML = '<p class="state-msg">Memuat...</p>';
  var res = await sb.from('notes').select('*').order('created_at', { ascending: true });
  if (res.error) { el.innerHTML = '<p class="state-msg err">Error: ' + res.error.message + '</p>'; return; }

  notesLoaded = true; // tandai sudah di-load

  if (!res.data || !res.data.length) { el.innerHTML = '<p class="state-msg">Belum ada catatan.</p>'; return; }

  el.innerHTML = '';
  notesCache = {};

  // Gunakan DocumentFragment biar tidak reflow berkali-kali
  var frag = document.createDocumentFragment();

  res.data.forEach(function(n) {
    notesCache[n.id] = n;

    var isAdmin = currentAccount && currentAccount.role === 'admin';
    var isOwner = currentAccount && n.author === currentAccount.name;
    var canEdit = isAdmin || isOwner;

    var preview = (n.content || '').replace(/\n/g,' ').trim();
    if (preview.length > 60) preview = preview.slice(0, 60) + '…';
    var authorColor = n.author === "Jef'z" ? '#007aff' : '#e91e8c';

    var d = document.createElement('div');
    d.className = 'note-card';
    d.dataset.nid = n.id;

    var summary = document.createElement('div');
    summary.className = 'note-summary';

    var sumMain = document.createElement('div');
    sumMain.className = 'note-sum-main';

    var ttl = document.createElement('span');
    ttl.className = 'note-ttl';
    ttl.textContent = n.title;
    sumMain.appendChild(ttl);

    if (preview) {
      var prev = document.createElement('span');
      prev.className = 'note-preview';
      prev.textContent = preview;
      sumMain.appendChild(prev);
    }

    var sumMeta = document.createElement('div');
    sumMeta.className = 'note-sum-meta';
    
    var authorDot = document.createElement('span');
    authorDot.className = 'note-author-dot';
    authorDot.style.background = authorColor;
    
    var authorName = document.createElement('span');
    authorName.className = 'note-author-name';
    authorName.textContent = n.author || '';
    
    sumMeta.appendChild(authorDot);
    sumMeta.appendChild(authorName);
    
    var chevron = document.createElement('span');
    chevron.className = 'note-chevron';
    chevron.textContent = '›';
    if (canEdit) {
      chevron.style.cursor = 'pointer';
      chevron.onclick = function(e) {
        e.stopPropagation();
        showNoteOptions(d, n.id, chevron);
      };
    } else {
      chevron.style.opacity = '0.3';
    }
    sumMeta.appendChild(chevron);

    summary.appendChild(sumMain);
    summary.appendChild(sumMeta);

    summary.addEventListener('click', function(e) {
      if (e.target === chevron || chevron.contains(e.target)) return;
      openReadModal(n.id);
    });

    d.appendChild(summary);
    frag.appendChild(d);
  });

  el.appendChild(frag);
}

function openReadModal(id) {
  var n = notesCache[id];
  if (n) {
    _renderReadModal(n);
  } else {
    sb.from('notes').select('*').eq('id', id).single().then(function(res) {
      if (res.error || !res.data) return;
      _renderReadModal(res.data);
    });
  }
}

function _renderReadModal(n) {
  document.getElementById('readModalTitle').textContent = n.title;
  var authorColor = n.author === "Jef'z" ? '#007aff' : '#e91e8c';
  var authorHtml = '<span class="read-author-dot" style="background:' + authorColor + '"></span>' + esc(n.author || '');
  
  var isAdmin = currentAccount && currentAccount.role === 'admin';
  var isOwner = currentAccount && n.author === currentAccount.name;
  var canEdit = isAdmin || isOwner;
  
  if (canEdit) {
    authorHtml += '<span class="read-author-option" data-note-id="' + n.id + '">⋮</span>';
  }
  
  document.getElementById('readModalAuthor').innerHTML = authorHtml;
  document.getElementById('readModalBody').textContent = n.content || '(Tidak ada isi)';
  document.getElementById('readModalTs').textContent = fmtDate(n.created_at);
  document.getElementById('readModal').classList.add('show');
  
  window.currentReadNoteId = n.id;
  
  var optionBtn = document.querySelector('#readModalAuthor .read-author-option');
  if (optionBtn) {
    optionBtn.onclick = function(e) {
      e.stopPropagation();
      showReadModalOption(n.id, e);
    };
  }
}

function showReadModalOption(noteId, event) {
  event.stopPropagation();
  closeActiveOptionMenu();
  
  var n = notesCache[noteId];
  if (!n) return;
  
  var isAdmin = currentAccount && currentAccount.role === 'admin';
  var isOwner = currentAccount && n.author === currentAccount.name;
  var canEdit = isAdmin || isOwner;
  
  if (!canEdit) return;
  
  var anchor = event.target;
  var rect = anchor.getBoundingClientRect();
  
  var menu = document.createElement('div');
  menu.className = 'note-options-menu';
  
  var editBtn = document.createElement('button');
  editBtn.textContent = '✏ Edit';
  editBtn.className = 'note-option-item edit';
  editBtn.onclick = function(e) {
    e.stopPropagation();
    closeActiveOptionMenu();
    document.getElementById('readModal').classList.remove('show');
    setTimeout(function() {
      openEditModal(noteId);
    }, 200);
  };
  
  var delBtn = document.createElement('button');
  delBtn.textContent = '✕ Hapus';
  delBtn.className = 'note-option-item delete';
  delBtn.onclick = function(e) {
    e.stopPropagation();
    closeActiveOptionMenu();
    document.getElementById('readModal').classList.remove('show');
    setTimeout(function() {
      delNote(noteId);
    }, 200);
  };
  
  menu.appendChild(editBtn);
  menu.appendChild(delBtn);
  
  menu.style.position = 'fixed';
  menu.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
  menu.style.right = (window.innerWidth - rect.right) + 'px';
  
  document.body.appendChild(menu);
  activeNoteOptionMenu = menu;
}

function closeReadModal(e) {
  if (e && e.target !== document.getElementById('readModal')) return;
  document.getElementById('readModal').classList.remove('show');
  window.currentReadNoteId = null;
  closeActiveOptionMenu();
}

function openNoteModal() {
  document.getElementById('noteTitleInput').value = '';
  document.getElementById('noteBodyInput').value = '';
  document.getElementById('noteModal').classList.add('show');
  setTimeout(function() {
    document.getElementById('noteTitleInput').focus();
    adjustOpenModals();
  }, 120);
}
function closeNoteModal(e) {
  if (e && e.target !== document.getElementById('noteModal')) return;
  document.getElementById('noteModal').classList.remove('show');
}

async function addNote() {
  var title = document.getElementById('noteTitleInput').value.trim();
  var content = document.getElementById('noteBodyInput').value.trim();
  if (!title) { toast('Judul tidak boleh kosong!', false); return; }
  var res = await sb.from('notes').insert([{ title: title, content: content, author: currentAccount ? currentAccount.name : '' }]);
  if (res.error) { toast('Gagal: ' + res.error.message, false); return; }
  document.getElementById('noteModal').classList.remove('show');
  toast('Catatan ditambahkan ✓');
  // Setelah tambah catatan baru: reload paksa
  notesLoaded = false;
  loadNotes();
}

// ========== EDIT MODAL ==========
function openEditModal(id) {
  var n = notesCache[id];
  if (!n) return;

  var authorColor = n.author === "Jef'z" ? '#007aff' : '#e91e8c';
  document.getElementById('editAuthorRow').innerHTML =
    '<span class="edit-author-dot" style="background:' + authorColor + '"></span>' +
    esc(n.author || '');

  var titleEl = document.getElementById('editTitleInput');
  titleEl.value = n.title || '';
  titleEl.oninput = function() { autoResize(this); };

  var bodyEl = document.getElementById('editBodyInput');
  bodyEl.value = n.content || '';
  bodyEl.oninput = function() { autoResize(this); };

  document.getElementById('editNoteId').value = id;
  document.getElementById('editModal').classList.add('show');

  setTimeout(function() {
    autoResize(titleEl);
    autoResize(bodyEl);
    _adjustEditModal();
    titleEl.focus();
  }, 80);
}

function closeEditModal(e) {
  if (e && e.target !== document.getElementById('editModal')) return;
  document.getElementById('editModal').classList.remove('show');
  _resetEditModalOverlay();

  var titleEl = document.getElementById('editTitleInput');
  var bodyEl  = document.getElementById('editBodyInput');
  if (titleEl) titleEl.style.height = '';
  if (bodyEl)  bodyEl.style.height  = '';
}

async function saveEditNote() {
  var id = document.getElementById('editNoteId').value;
  var newTitle = document.getElementById('editTitleInput').value.trim();
  var newContent = document.getElementById('editBodyInput').value.trim();
  if (!newTitle) { toast('Judul tidak boleh kosong!', false); return; }
  var res = await sb.from('notes').update({ title: newTitle, content: newContent }).eq('id', id);
  if (res.error) { toast('Gagal edit: ' + res.error.message, false); return; }
  closeEditModal();
  toast('Catatan diperbarui ✓');
  // Reload notes setelah edit
  notesLoaded = false;
  loadNotes();
}

async function delNote(id) {
  if (!confirm('Hapus catatan ini?')) return;
  var res = await sb.from('notes').delete().eq('id', id);
  if (res.error) { toast('Gagal hapus', false); return; }
  toast('Dihapus');
  // Reload notes setelah hapus
  notesLoaded = false;
  loadNotes();
}

// ========== CHAT ==========
function buildMsgEl(m) {
  var isMe = currentAccount && m.sender_name === currentAccount.name;
  var d = document.createElement('div');
  d.className = 'msg-row ' + (isMe ? 'mine' : 'theirs');
  if (m.id) d.dataset.msgId = String(m.id);
  var nameColor = m.sender_name === "Jef'z" ? '#3d5afe' : '#e91e8c';
  var roleTag = m.sender_role === 'admin' ? ' 👑' : '';
  d.innerHTML =
    '<div class="msg-block">' +
      (!isMe ? '<span class="msg-sender" style="color:' + nameColor + '">' + esc(m.sender_name) + roleTag + '</span>' : '') +
      '<div class="bubble">' + esc(m.message) + '<span class="btime">' + fmtTime(m.created_at) + '</span></div>' +
    '</div>';
  return d;
}

function appendMsg(m, smooth) {
  var el = document.getElementById('chatList');
  if (!el) return;
  var id = String(m.id || '');
  if (id && seenMsgIds.has(id)) return;
  if (id) seenMsgIds.add(id);

  var ph = el.querySelector('.state-msg');
  if (ph) el.innerHTML = '';

  el.appendChild(buildMsgEl(m));
  var dist = el.scrollHeight - el.scrollTop - el.clientHeight;
  scrollBottom(el, smooth && dist < 300);
}

async function initChat() {
  isChatActive = true;
  chatLoaded = false;
  seenMsgIds.clear();
  var el = document.getElementById('chatList');
  el.innerHTML = '<p class="state-msg">Memuat...</p>';

  var res = await sb.from('chat_messages').select('*').order('created_at', { ascending: true });
  if (res.error) { el.innerHTML = '<p class="state-msg err">Error: ' + res.error.message + '</p>'; return; }

  el.innerHTML = '';
  chatLoaded = true;

  if (!res.data || !res.data.length) {
    el.innerHTML = '<p class="state-msg">Belum ada pesan. Mulai chat!</p>';
  } else {
    // Gunakan DocumentFragment untuk performa
    var frag = document.createDocumentFragment();
    res.data.forEach(function(m) {
      if (m.id) seenMsgIds.add(String(m.id));
      frag.appendChild(buildMsgEl(m));
    });
    el.appendChild(frag);
    scrollBottom(el, false);
  }

  startChatSync();
}

function startChatSync() {
  if (chatChannel) { try { sb.removeChannel(chatChannel); } catch(e){} chatChannel = null; }
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }

  chatChannel = sb.channel('chat_live_' + Date.now(), {
    config: { broadcast: { self: false } }
  })
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'chat_messages' },
    function(payload) {
      if (!isChatActive || !payload.new) return;
      if (currentAccount && payload.new.sender_name === currentAccount.name) {
        var el = document.getElementById('chatList');
        var pend = el.querySelector('[data-pending]');
        if (pend) {
          pend.dataset.msgId = String(payload.new.id);
          seenMsgIds.add(String(payload.new.id));
          pend.removeAttribute('data-pending');
          return;
        }
      }
      appendMsg(payload.new, true);
    }
  )
  .subscribe();

  // Poll sebagai fallback realtime
  pollTimer = setInterval(async function() {
    if (!isChatActive || !chatLoaded) return;
    var res = await sb.from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (res.error || !res.data) return;
    var msgs = res.data.slice().reverse();
    msgs.forEach(function(m) {
      appendMsg(m, false);
    });
  }, 3000);
}

async function sendMsg() {
  var input = document.getElementById('chatInput');
  var msg = input.value.trim();
  if (!msg || !currentAccount) return;

  input.value = '';
  input.focus();

  var fakeMsg = {
    message: msg,
    sender_name: currentAccount.name,
    sender_role: currentAccount.role,
    user_id: uid,
    created_at: new Date().toISOString()
  };
  var el = document.getElementById('chatList');
  var ph = el.querySelector('.state-msg');
  if (ph) el.innerHTML = '';
  var msgEl = buildMsgEl(fakeMsg);
  msgEl.dataset.pending = '1';
  el.appendChild(msgEl);
  scrollBottom(el, true);

  var res = await sb.from('chat_messages').insert([{
    message: msg,
    user_id: uid,
    sender_name: currentAccount.name,
    sender_role: currentAccount.role
  }]);

  if (res.error) {
    var pend = el.querySelector('[data-pending]');
    if (pend) pend.remove();
    toast('Gagal kirim', false);
    input.value = msg;
    return;
  }

  setTimeout(async function() {
    var pend = el.querySelector('[data-pending]');
    if (!pend) return;
    var r = await sb.from('chat_messages')
      .select('*').order('created_at', { ascending: false }).limit(1);
    if (r.data && r.data[0]) {
      pend.dataset.msgId = String(r.data[0].id);
      seenMsgIds.add(String(r.data[0].id));
      pend.removeAttribute('data-pending');
    }
  }, 1200);
}

// ========== GALLERY ==========
async function loadGallery() {
  var el = document.getElementById('galleryGrid');
  el.innerHTML = '<p class="state-msg">Memuat...</p>';
  var res = await sb.from('gallery').select('*').order('created_at', { ascending: false });
  if (res.error) { el.innerHTML = '<p class="state-msg err">Error: ' + res.error.message + '</p>'; return; }

  galleryLoaded = true; // tandai sudah di-load

  if (!res.data || !res.data.length) { el.innerHTML = '<p class="state-msg">Belum ada media.</p>'; return; }
  el.innerHTML = '';
  var isAdmin = currentAccount && currentAccount.role === 'admin';

  var frag = document.createDocumentFragment();

  res.data.forEach(function(f) {
    var isVid = /\.(mp4|webm|mov|avi)$/i.test(f.file_name || '');
    var d = document.createElement('div');
    d.className = 'g-item';

    if (isVid) {
      // Tampilkan thumbnail video — gunakan poster dari frame pertama
      // Video TIDAK autoplay, TIDAK preload (hanya metadata)
      // Klik buka lightbox video
      var thumb = document.createElement('div');
      thumb.className = 'g-video-thumb';
      thumb.innerHTML =
        '<video class="g-media g-video-preview" preload="metadata" muted playsinline' +
          ' src="' + esc(f.file_url) + '#t=0.001"' +
          ' onclick="openVideoLightbox(\'' + esc(f.file_url) + '\')">' +
        '</video>' +
        '<div class="g-play-icon"><svg viewBox="0 0 24 24" fill="white" width="28" height="28"><circle cx="12" cy="12" r="12" fill="rgba(0,0,0,0.5)"/><polygon points="10,8 18,12 10,16" fill="white"/></svg></div>';
      thumb.style.position = 'relative';
      thumb.style.width = '100%';
      thumb.style.height = '100%';
      thumb.onclick = function() { openVideoLightbox(f.file_url); };
      d.appendChild(thumb);
    } else {
      // Gambar: lazy load
      var img = document.createElement('img');
      img.src = f.file_url;
      img.className = 'g-media';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.onclick = function() { openLightbox(f.file_url); };
      d.appendChild(img);
    }

    if (isAdmin) {
      var delBtn = document.createElement('button');
      delBtn.className = 'g-del';
      delBtn.textContent = '✕';
      delBtn.onclick = function(e) {
        e.stopPropagation();
        delMedia(f.id, f.file_name);
      };
      d.appendChild(delBtn);
    }

    frag.appendChild(d);
  });

  el.appendChild(frag);
}

// ========== UPLOAD DENGAN PROGRESS ==========
async function doUpload(input) {
  if (!currentAccount || currentAccount.role !== 'admin') { toast('Hanya admin yang bisa upload', false); return; }
  var file = input.files[0];
  if (!file) return;

  var ext = file.name.split('.').pop();
  var name = Date.now() + '_' + Math.random().toString(36).slice(2,6) + '.' + ext;
  var totalBytes = file.size;

  // Upload menggunakan XMLHttpRequest agar bisa track progress
  var signed = null;
  try {
    // Dapatkan signed URL dari Supabase storage untuk upload langsung
    // Supabase JS SDK tidak expose progress natively, jadi kita pakai XHR manual
    var uploadUrl = SB_URL + '/storage/v1/object/gallery/' + name;
    
    var startTime = Date.now();
    var lastLoaded = 0;
    var lastTime = Date.now();

    await new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl, true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + SB_KEY);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.setRequestHeader('Cache-Control', '3600');

      xhr.upload.onprogress = function(e) {
        if (!e.lengthComputable) return;
        var now = Date.now();
        var loaded = e.loaded;
        var total = e.total;
        var percent = Math.round((loaded / total) * 100);

        // Hitung kecepatan
        var elapsed = (now - lastTime) / 1000;
        var speedBytes = elapsed > 0 ? (loaded - lastLoaded) / elapsed : 0;
        lastLoaded = loaded;
        lastTime = now;

        var speedStr = speedBytes > 0 ? fmtBytes(speedBytes) + '/s' : '—';
        var remainBytes = total - loaded;
        var remainStr = fmtBytes(remainBytes) + ' tersisa';

        showUploadProgress(percent, speedStr, remainStr);
      };

      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.responseText);
        } else {
          reject(new Error('Upload failed: ' + xhr.status + ' ' + xhr.responseText));
        }
      };
      xhr.onerror = function() { reject(new Error('Network error')); };

      // Kirim sebagai binary (file langsung)
      xhr.send(file);
    });

  } catch(err) {
    hideUploadProgress();
    toast('Upload gagal: ' + err.message, false);
    input.value = '';
    return;
  }

  // Dapatkan public URL
  var pub = sb.storage.from('gallery').getPublicUrl(name);
  var dbRes = await sb.from('gallery').insert([{ file_url: pub.data.publicUrl, file_name: name }]);
  if (dbRes.error) {
    hideUploadProgress();
    toast('Gagal simpan: ' + dbRes.error.message, false);
    input.value = '';
    return;
  }

  hideUploadProgress();
  toast('Berhasil diupload ✓');
  input.value = '';
  // Reload gallery setelah upload baru
  galleryLoaded = false;
  loadGallery();
}

async function delMedia(id, name) {
  if (!currentAccount || currentAccount.role !== 'admin') return;
  if (!confirm('Hapus media ini?')) return;
  await sb.storage.from('gallery').remove([name]);
  var res = await sb.from('gallery').delete().eq('id', id);
  if (res.error) { toast('Gagal hapus', false); return; }
  toast('Dihapus');
  // Reload setelah hapus
  galleryLoaded = false;
  loadGallery();
}

// ========== LIGHTBOX ==========
function openLightbox(url) {
  document.getElementById('lightboxImg').src = url;
  document.getElementById('lightbox').classList.add('show');
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('show');
  document.getElementById('lightboxImg').src = '';
  // Juga hapus video lightbox jika ada
  var vl = document.getElementById('lightboxVideo');
  if (vl) { vl.pause(); vl.src = ''; vl.remove(); }
}

function openVideoLightbox(url) {
  var lb = document.getElementById('lightbox');
  // Sembunyikan img, tampilkan video
  var img = document.getElementById('lightboxImg');
  img.style.display = 'none';

  var vl = document.getElementById('lightboxVideo');
  if (!vl) {
    vl = document.createElement('video');
    vl.id = 'lightboxVideo';
    vl.controls = true;
    vl.style.cssText = 'max-width:94vw;max-height:88vh;border-radius:10px;object-fit:contain;';
    lb.appendChild(vl);
  }
  vl.src = url;
  vl.play();
  lb.classList.add('show');
}

// Override closeLightbox agar restore img juga
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeLightbox();
});
