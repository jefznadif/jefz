// ========== DASHBOARD MODULE ==========

let currentAccount = null;
let dark = localStorage.getItem('theme') === 'dark';
let countdownTimer = null;
let notesLoaded = false;
let notesCache = {};
let activeNoteOptionMenu = null;

// Multi-select state
let selectedNoteIds = new Set();
let noteSelectionModeActive = false;

// Custom confirm state
let _confirmResolve = null;

// ========== SESSION CHECK ==========
function checkSession() {
  const auth = sessionStorage.getItem('auth');
  const accName = sessionStorage.getItem('accName');
  const sessionToken = sessionStorage.getItem('sessionToken');
  const authTime = sessionStorage.getItem('authTime');

  if (!auth || !accName || !sessionToken || !authTime) {
    window.location.href = 'index.html';
    return;
  }

  if (Date.now() - parseInt(authTime) > 86400000) {
    sessionStorage.clear();
    window.location.href = 'index.html';
    return;
  }

  currentAccount = {
    name: accName,
    role: sessionStorage.getItem('accRole') || 'user',
    color: sessionStorage.getItem('accColor') || '#3d5afe',
    displayName: sessionStorage.getItem('accDisplayName') || accName
  };

  showDash();
}

// ========== HELPERS ==========
function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(d) {
  return new Date(d).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function fmtBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}

// ========== ANIMATED BACKGROUND ==========
(function initOrbBg() {
  const bg = document.getElementById('globalBg');
  if (!bg) return;

  const ORB_PALETTES = [
    ['#ff6eb4', '#ff3cac'], ['#60aaff', '#007aff'], ['#34d399', '#06b6d4'],
    ['#fbbf24', '#f97316'], ['#c084fc', '#8b5cf6'], ['#fb7185', '#f43f5e'],
    ['#86efac', '#22c55e'], ['#67e8f9', '#38bdf8'],
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
      'will-change:transform,opacity'
    ].join(';');

    const startX = Math.random() * 100;
    const startY = Math.random() * 100;
    const baseOpacity = 0.38 + Math.random() * 0.28;

    orbs.push({
      el, x: startX, y: startY,
      vx: (Math.random() - 0.5) * 0.16,
      vy: (Math.random() - 0.5) * 0.16,
      scaleBase: 1,
      scaleAmp: 0.10 + Math.random() * 0.12,
      scaleFreq: 0.0012 + Math.random() * 0.0010,
      opBase: baseOpacity,
      opAmp: 0.08 + Math.random() * 0.10,
      opFreq: 0.0010 + Math.random() * 0.0008,
      phase: Math.random() * Math.PI * 2
    });
  }

  let lastTime = performance.now();

  function tick(now) {
    const dt = Math.min(now - lastTime, 50);
    lastTime = now;

    for (const orb of orbs) {
      orb.x += orb.vx * dt * 0.016;
      orb.y += orb.vy * dt * 0.016;

      if (orb.x < -5) { orb.x = -5; orb.vx = Math.abs(orb.vx) * (0.7 + Math.random() * 0.3); }
      if (orb.x > 105) { orb.x = 105; orb.vx = -Math.abs(orb.vx) * (0.7 + Math.random() * 0.3); }
      if (orb.y < -5) { orb.y = -5; orb.vy = Math.abs(orb.vy) * (0.7 + Math.random() * 0.3); }
      if (orb.y > 105) { orb.y = 105; orb.vy = -Math.abs(orb.vy) * (0.7 + Math.random() * 0.3); }

      if (Math.random() < 0.005) {
        orb.vx += (Math.random() - 0.5) * 0.04;
        orb.vy += (Math.random() - 0.5) * 0.04;
        const spd = Math.hypot(orb.vx, orb.vy);
        if (spd > 0.20) { orb.vx *= 0.20 / spd; orb.vy *= 0.20 / spd; }
      }

      const t = now * orb.scaleFreq + orb.phase;
      const scale = orb.scaleBase + Math.sin(t) * orb.scaleAmp;
      const op = orb.opBase + Math.sin(now * orb.opFreq + orb.phase + 1) * orb.opAmp;

      orb.el.style.left = orb.x + 'vw';
      orb.el.style.top = orb.y + 'vh';
      orb.el.style.transform = 'translate(-50%,-50%) scale(' + scale + ')';
      orb.el.style.opacity = Math.max(0.12, Math.min(0.75, op));
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();

// ========== THEME ==========
function applyTheme() {
  document.body.classList.toggle('dark', dark);
  const gbg = document.getElementById('globalBg');
  if (gbg) gbg.classList.toggle('dark', dark);
  const icon = document.getElementById('themeBtnIcon');
  const label = document.getElementById('themeBtnLabel');
  if (icon) icon.textContent = dark ? '☀️' : '🌙';
  if (label) label.textContent = dark ? 'Light Mode' : 'Dark Mode';
}

function toggleTheme() {
  dark = !dark;
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  applyTheme();
}

// ========== TOAST ==========
let toastTimer;

function toast(msg, ok) {
  if (ok === undefined) ok = true;
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + (ok ? 'ok' : 'err');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2800);
}

// ========== CUSTOM CONFIRM MODAL ==========
function showConfirm(msg, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    _confirmResolve = resolve;
    const el = document.getElementById('confirmModal');
    document.getElementById('confirmIcon').textContent = opts.icon || '⚠️';
    document.getElementById('confirmTitle').textContent = opts.title || 'Konfirmasi';
    document.getElementById('confirmMsg').textContent = msg;
    const okBtn = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');
    okBtn.textContent = opts.okText || 'Ya';
    cancelBtn.textContent = opts.cancelText || 'Batal';
    okBtn.className = 'confirm-btn-ok' + (opts.safe ? ' safe' : '');
    okBtn.onclick = () => { el.classList.remove('show'); if (_confirmResolve) { _confirmResolve(true); _confirmResolve = null; } };
    cancelBtn.onclick = () => { el.classList.remove('show'); if (_confirmResolve) { _confirmResolve(false); _confirmResolve = null; } };
    el.classList.add('show');
  });
}

// ========== SHOW DASHBOARD ==========
function showDash() {
  if (!currentAccount) return;

  const avatarEl = document.getElementById('topbarAvatar');
  avatarEl.textContent = currentAccount.name.charAt(0).toUpperCase();
  avatarEl.style.background = currentAccount.color;
  document.getElementById('topbarUser').textContent = currentAccount.displayName + (currentAccount.role === 'admin' ? ' 👑' : ' 👤');

  const galleryFab = document.querySelector('.gallery-fab-wrap');
  if (galleryFab) galleryFab.style.display = currentAccount.role === 'admin' ? 'block' : 'none';

  applyTheme();

  const lastTab = sessionStorage.getItem('activeTab') || 'Chat';
  activateTab(lastTab);

  initNavbarSwipe();
}

// ========== LOGOUT ==========
async function doLogout() {
  const ok = await showConfirm('Yakin mau logout?', {
    icon: '👋', title: 'Logout', okText: 'Logout', cancelText: 'Batal'
  });
  if (!ok) return;

  stopCountdown();
  sessionStorage.clear();
  window.location.href = 'index.html';
}

// ========== NAVBAR SWIPE ==========
const TAB_ORDER = ['Notes', 'Chat', 'Gallery'];
const TAB_TITLES = { Notes: 'Catatan', Chat: 'ChatRoom', Gallery: 'Gallery' };

function initNavbarSwipe() {
  const nav = document.getElementById('bottomNav');
  if (!nav) return;

  let startX = 0, startY = 0, navSwipeActive = false;

  nav.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    navSwipeActive = true;
  }, { passive: true });

  nav.addEventListener('touchmove', (e) => {
    if (!navSwipeActive) return;
    const dx = Math.abs(e.touches[0].clientX - startX);
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dy > dx + 10) navSwipeActive = false;
  }, { passive: true });

  nav.addEventListener('touchend', (e) => {
    if (!navSwipeActive) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = Math.abs(e.changedTouches[0].clientY - startY);
    navSwipeActive = false;

    if (Math.abs(dx) < 60 || dy > 50) return;
    if (document.querySelector('.modal-overlay.show')) return;
    if (document.getElementById('lightbox').classList.contains('show')) return;

    const curTab = sessionStorage.getItem('activeTab') || 'Chat';
    const idx = TAB_ORDER.indexOf(curTab);
    if (idx === -1) return;

    let next = idx;
    if (dx < 0) next = Math.min(idx + 1, TAB_ORDER.length - 1);
    else next = Math.max(idx - 1, 0);

    if (next !== idx) {
      const newTab = TAB_ORDER[next];
      sessionStorage.setItem('activeTab', newTab);
      activateTab(newTab);
    }
  });
}

// ========== TABS ==========
function goTab(name, title, btn) {
  sessionStorage.setItem('activeTab', name);
  activateTab(name);
}

function activateTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active-tab'));
  document.querySelectorAll('.nav-item').forEach(b => {
    const lbl = b.querySelector('span') ? b.querySelector('span').textContent : '';
    b.classList.toggle('active',
      (name === 'Chat' && lbl === 'Chat') ||
      (name === 'Notes' && lbl === 'Catatan') ||
      (name === 'Gallery' && lbl === 'Gallery')
    );
  });

  document.getElementById('tab' + name).classList.add('active-tab');
  document.getElementById('topbarTitle').textContent = TAB_TITLES[name] || name;

  if (name === 'Notes') startCountdown();
  else stopCountdown();

  if (name === 'Chat' && typeof initChat === 'function') initChat();
  if (name === 'Notes' && !notesLoaded) loadNotes();
  if (name === 'Gallery' && typeof loadGallery === 'function' && typeof galleryLoaded !== 'undefined' && !galleryLoaded) loadGallery();
}

// ========== COUNTDOWN ==========
function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);

  const targetDate = new Date("2024-03-18T00:00:00");
  targetDate.setFullYear(targetDate.getFullYear() + 3);

  const labelEl = document.getElementById('countdownLabel');
  const valEl = document.getElementById('countdown');

  function tick() {
    if (!labelEl || !valEl) return;

    const now = new Date();
    const isCountdown = now < targetDate;
    const from = isCountdown ? now : targetDate;
    const to = isCountdown ? targetDate : now;

    let years = to.getFullYear() - from.getFullYear();
    let months = to.getMonth() - from.getMonth();
    let days = to.getDate() - from.getDate();
    let hours = to.getHours() - from.getHours();
    let minutes = to.getMinutes() - from.getMinutes();
    let seconds = to.getSeconds() - from.getSeconds();

    if (seconds < 0) { seconds += 60; minutes--; }
    if (minutes < 0) { minutes += 60; hours--; }
    if (hours < 0) { hours += 24; days--; }
    if (days < 0) {
      const lm = new Date(to.getFullYear(), to.getMonth(), 0);
      days += lm.getDate();
      months--;
    }
    if (months < 0) { months += 12; years--; }

    function seg(n, unit) {
      return '<span class="cd-seg"><span class="cd-num">' + pad(n) + '</span><span class="cd-unit">' + unit + '</span></span>';
    }
    function pad(n) { return n < 10 ? '0' + n : n; }

    labelEl.textContent = isCountdown ? "Menuju 18 Maret 2027 ♡" : "Sudah bersama selama ♡";
    valEl.innerHTML =
      seg(years, 'Thn') + seg(months, 'Bln') + seg(days, 'Hari') +
      '<br>' +
      seg(hours, 'Jam') + seg(minutes, 'Mnt') + seg(seconds, 'Dtk');
  }

  tick();
  countdownTimer = setInterval(tick, 1000);
}

function stopCountdown() {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
}

// ========== NOTES ==========
async function loadNotes() {
  closeActiveOptionMenu();
  const el = document.getElementById('notesList');
  el.innerHTML = '<p class="state-msg">Memuat...</p>';

  const res = await sb.from('notes').select('*').order('created_at', { ascending: true });
  if (res.error) {
    el.innerHTML = '<p class="state-msg err">Error: ' + res.error.message + '</p>';
    return;
  }

  notesLoaded = true;
  if (!res.data || !res.data.length) {
    el.innerHTML = '<p class="state-msg">Belum ada catatan.</p>';
    return;
  }

  el.innerHTML = '';
  notesCache = {};
  const frag = document.createDocumentFragment();

  res.data.forEach(n => {
    notesCache[n.id] = n;
    const isAdmin = currentAccount && currentAccount.role === 'admin';
    const isOwner = currentAccount && n.author === currentAccount.name;
    const canEdit = isAdmin || isOwner;

    let preview = (n.content || '').replace(/\n/g, ' ').trim();
    if (preview.length > 60) preview = preview.slice(0, 60) + '…';

    const authorColor = n.author === "Jef'z" ? '#007aff' : '#e91e8c';

    const card = document.createElement('div');
    card.className = 'note-card';
    card.dataset.nid = n.id;

    const summary = document.createElement('div');
    summary.className = 'note-summary';

    const sumMain = document.createElement('div');
    sumMain.className = 'note-sum-main';

    const ttl = document.createElement('span');
    ttl.className = 'note-ttl';
    ttl.textContent = n.title;
    sumMain.appendChild(ttl);

    if (preview) {
      const prev = document.createElement('span');
      prev.className = 'note-preview';
      prev.textContent = preview;
      sumMain.appendChild(prev);
    }

    const sumMeta = document.createElement('div');
    sumMeta.className = 'note-sum-meta';

    const authorDot = document.createElement('span');
    authorDot.className = 'note-author-dot';
    authorDot.style.background = authorColor;
    sumMeta.appendChild(authorDot);

    const authorName = document.createElement('span');
    authorName.className = 'note-author-name';
    authorName.textContent = n.author || '';
    sumMeta.appendChild(authorName);

    const chevron = document.createElement('span');
    chevron.className = 'note-chevron';
    chevron.textContent = '›';
    if (canEdit) {
      chevron.style.cursor = 'pointer';
      chevron.onclick = (e) => { e.stopPropagation(); showNoteOptions(card, n.id, chevron); };
    } else {
      chevron.style.opacity = '0.3';
    }
    sumMeta.appendChild(chevron);

    summary.appendChild(sumMain);
    summary.appendChild(sumMeta);

    summary.addEventListener('click', (e) => {
      if (e.target === chevron || chevron.contains(e.target)) return;
      if (noteSelectionModeActive) {
        toggleNoteSelection(String(n.id));
        return;
      }
      openReadModal(n.id);
    });

    initNoteLongPress(card, n.id);
    card.appendChild(summary);
    frag.appendChild(card);
  });

  el.appendChild(frag);
}

function initNoteLongPress(cardEl, noteId) {
  let pressTimer = null, moved = false;
  let startX = 0, startY = 0;

  cardEl.addEventListener('touchstart', (e) => {
    if (e.target.closest('.note-chevron')) return;
    moved = false;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    if (noteSelectionModeActive) return;
    pressTimer = setTimeout(() => {
      if (!moved) {
        if (navigator.vibrate) navigator.vibrate(40);
        enterNoteSelectionMode(String(noteId));
      }
    }, 500);
  }, { passive: true });

  cardEl.addEventListener('touchmove', (e) => {
    const dx = Math.abs(e.touches[0].clientX - startX);
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dx > 8 || dy > 8) { moved = true; clearTimeout(pressTimer); }
  }, { passive: true });

  cardEl.addEventListener('touchend', () => { clearTimeout(pressTimer); moved = false; });
  cardEl.addEventListener('touchcancel', () => { clearTimeout(pressTimer); moved = false; });
}

function showNoteOptions(cardElement, noteId, anchorElement) {
  closeActiveOptionMenu();
  const n = notesCache[noteId];
  if (!n) return;

  const isAdmin = currentAccount && currentAccount.role === 'admin';
  const isOwner = currentAccount && n.author === currentAccount.name;
  if (!isAdmin && !isOwner) return;

  const menu = document.createElement('div');
  menu.className = 'note-options-menu';

  const editBtn = document.createElement('button');
  editBtn.textContent = '✏ Edit';
  editBtn.className = 'note-option-item edit';
  editBtn.onclick = (e) => { e.stopPropagation(); closeActiveOptionMenu(); openEditModal(noteId); };
  menu.appendChild(editBtn);

  const delBtn = document.createElement('button');
  delBtn.textContent = '✕ Hapus';
  delBtn.className = 'note-option-item delete';
  delBtn.onclick = (e) => { e.stopPropagation(); closeActiveOptionMenu(); delNote(noteId); };
  menu.appendChild(delBtn);

  const rect = anchorElement.getBoundingClientRect();
  menu.style.cssText = 'position:fixed;bottom:' + (window.innerHeight - rect.top + 6) + 'px;right:' + (window.innerWidth - rect.right) + 'px;';
  document.body.appendChild(menu);
  activeNoteOptionMenu = menu;
}

function closeActiveOptionMenu() {
  if (activeNoteOptionMenu && activeNoteOptionMenu.parentNode) activeNoteOptionMenu.remove();
  activeNoteOptionMenu = null;
}

function openReadModal(id) {
  const n = notesCache[id];
  if (n) _renderReadModal(n);
  else {
    sb.from('notes').select('*').eq('id', id).single().then(res => {
      if (!res.error && res.data) _renderReadModal(res.data);
    });
  }
}

function _renderReadModal(n) {
  document.getElementById('readModalTitle').textContent = n.title;
  const authorColor = n.author === "Jef'z" ? '#007aff' : '#e91e8c';
  const isAdmin = currentAccount && currentAccount.role === 'admin';
  const isOwner = currentAccount && n.author === currentAccount.name;
  const canEdit = isAdmin || isOwner;

  let authorHtml = '<span class="read-author-dot" style="background:' + authorColor + '"></span>' + esc(n.author || '');
  if (canEdit) authorHtml += '<span class="read-author-option" data-note-id="' + n.id + '">⋮</span>';
  document.getElementById('readModalAuthor').innerHTML = authorHtml;
  document.getElementById('readModalBody').textContent = n.content || '(Tidak ada isi)';
  document.getElementById('readModalTs').textContent = fmtDate(n.created_at);
  document.getElementById('readModal').classList.add('show');
  window.currentReadNoteId = n.id;

  const optionBtn = document.querySelector('#readModalAuthor .read-author-option');
  if (optionBtn) {
    optionBtn.onclick = (e) => { e.stopPropagation(); showReadModalOption(n.id, e); };
  }
}

function showReadModalOption(noteId, event) {
  event.stopPropagation();
  closeActiveOptionMenu();
  const n = notesCache[noteId];
  if (!n) return;

  const isAdmin = currentAccount && currentAccount.role === 'admin';
  const isOwner = currentAccount && n.author === currentAccount.name;
  if (!isAdmin && !isOwner) return;

  const anchor = event.target;
  const rect = anchor.getBoundingClientRect();

  const menu = document.createElement('div');
  menu.className = 'note-options-menu';

  const editBtn = document.createElement('button');
  editBtn.textContent = '✏ Edit';
  editBtn.className = 'note-option-item edit';
  editBtn.onclick = (e) => {
    e.stopPropagation(); closeActiveOptionMenu();
    document.getElementById('readModal').classList.remove('show');
    setTimeout(() => openEditModal(noteId), 200);
  };
  menu.appendChild(editBtn);

  const delBtn = document.createElement('button');
  delBtn.textContent = '✕ Hapus';
  delBtn.className = 'note-option-item delete';
  delBtn.onclick = (e) => {
    e.stopPropagation(); closeActiveOptionMenu();
    document.getElementById('readModal').classList.remove('show');
    setTimeout(() => delNote(noteId), 200);
  };
  menu.appendChild(delBtn);

  menu.style.cssText = 'position:fixed;bottom:' + (window.innerHeight - rect.top + 6) + 'px;right:' + (window.innerWidth - rect.right) + 'px;';
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
  setTimeout(() => document.getElementById('noteTitleInput').focus(), 120);
}

function closeNoteModal(e) {
  if (e && e.target !== document.getElementById('noteModal')) return;
  document.getElementById('noteModal').classList.remove('show');
}

async function addNote() {
  const title = document.getElementById('noteTitleInput').value.trim();
  const content = document.getElementById('noteBodyInput').value.trim();
  if (!title) { toast('Judul tidak boleh kosong!', false); return; }

  const res = await sb.from('notes').insert([{
    title, content,
    author: currentAccount ? currentAccount.name : ''
  }]);

  if (res.error) { toast('Gagal: ' + res.error.message, false); return; }
  document.getElementById('noteModal').classList.remove('show');
  toast('Catatan ditambahkan ✓');
  notesLoaded = false;
  loadNotes();
}

function openEditModal(id) {
  const n = notesCache[id];
  if (!n) return;

  const authorColor = n.author === "Jef'z" ? '#007aff' : '#e91e8c';
  document.getElementById('editAuthorRow').innerHTML = '<span class="edit-author-dot" style="background:' + authorColor + '"></span>' + esc(n.author || '');

  const titleEl = document.getElementById('editTitleInput');
  titleEl.value = n.title || '';
  titleEl.oninput = function() { autoResize(this); };

  const bodyEl = document.getElementById('editBodyInput');
  bodyEl.value = n.content || '';
  bodyEl.oninput = function() { autoResize(this); };

  document.getElementById('editNoteId').value = id;
  document.getElementById('editModal').classList.add('show');

  setTimeout(() => {
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
  const titleEl = document.getElementById('editTitleInput');
  const bodyEl = document.getElementById('editBodyInput');
  if (titleEl) titleEl.style.height = '';
  if (bodyEl) bodyEl.style.height = '';
}

function getVisibleHeight() {
  return window.visualViewport ? window.visualViewport.height : window.innerHeight;
}

function adjustOpenModals() {
  const vh = getVisibleHeight();
  const maxH = Math.floor(vh * 0.92);
  document.querySelectorAll('.modal-overlay.show:not(#editModal) .modal-box').forEach(box => {
    box.style.maxHeight = maxH + 'px';
  });
  if (document.getElementById('editModal').classList.contains('show')) _adjustEditModal();
}

function _adjustEditModal() {
  const overlay = document.getElementById('editModal');
  const box = document.getElementById('editModalBox');
  if (!overlay || !box) return;
  const vp = window.visualViewport;
  if (vp) {
    overlay.style.position = 'fixed';
    overlay.style.top = vp.offsetTop + 'px';
    overlay.style.left = vp.offsetLeft + 'px';
    overlay.style.width = vp.width + 'px';
    overlay.style.height = vp.height + 'px';
    overlay.style.bottom = 'auto';
    box.style.maxHeight = Math.floor(vp.height * 0.94) + 'px';
  } else {
    overlay.style.top = '0';
    overlay.style.height = window.innerHeight + 'px';
    box.style.maxHeight = Math.floor(window.innerHeight * 0.92) + 'px';
  }
}

function _resetEditModalOverlay() {
  const overlay = document.getElementById('editModal');
  const box = document.getElementById('editModalBox');
  if (overlay) {
    overlay.style.position = '';
    overlay.style.top = '';
    overlay.style.left = '';
    overlay.style.width = '';
    overlay.style.height = '';
    overlay.style.bottom = '';
  }
  if (box) box.style.maxHeight = '';
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    if (document.getElementById('editModal').classList.contains('show')) _adjustEditModal();
    else adjustOpenModals();
  });
  window.visualViewport.addEventListener('scroll', () => {
    if (document.getElementById('editModal').classList.contains('show')) _adjustEditModal();
  });
} else {
  window.addEventListener('resize', adjustOpenModals);
}

async function saveEditNote() {
  const id = document.getElementById('editNoteId').value;
  const newTitle = document.getElementById('editTitleInput').value.trim();
  const newContent = document.getElementById('editBodyInput').value.trim();
  if (!newTitle) { toast('Judul tidak boleh kosong!', false); return; }

  const res = await sb.from('notes').update({ title: newTitle, content: newContent }).eq('id', id);
  if (res.error) { toast('Gagal edit: ' + res.error.message, false); return; }

  closeEditModal();
  toast('Catatan diperbarui ✓');
  notesLoaded = false;
  loadNotes();
}

async function delNote(id) {
  const ok = await showConfirm('Hapus catatan ini?', {
    icon: '🗑', title: 'Hapus Catatan', okText: 'Hapus', cancelText: 'Batal'
  });
  if (!ok) return;

  const res = await sb.from('notes').delete().eq('id', id);
  if (res.error) { toast('Gagal hapus', false); return; }

  toast('Dihapus');
  notesLoaded = false;
  loadNotes();
}

// ========== NOTE MULTI-SELECT ==========
function enterNoteSelectionMode(noteId) {
  noteSelectionModeActive = true;
  _addToNoteSelection(noteId);
  _renderNoteSelectionBar();
}

function toggleNoteSelection(noteId) {
  if (!noteSelectionModeActive) return;
  if (selectedNoteIds.has(noteId)) _removeFromNoteSelection(noteId);
  else _addToNoteSelection(noteId);
  if (selectedNoteIds.size === 0) { exitNoteSelectionMode(); return; }
  _renderNoteSelectionBar();
}

function _addToNoteSelection(noteId) {
  selectedNoteIds.add(noteId);
  const card = document.querySelector('[data-nid="' + noteId + '"]');
  if (card) card.classList.add('note-selected');
}

function _removeFromNoteSelection(noteId) {
  selectedNoteIds.delete(noteId);
  const card = document.querySelector('[data-nid="' + noteId + '"]');
  if (card) card.classList.remove('note-selected');
}

function _renderNoteSelectionBar() {
  let bar = document.getElementById('noteSelectionBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'noteSelectionBar';
    bar.className = 'notes-selection-bar';
    document.getElementById('dashPage').appendChild(bar);
  }

  const isAdmin = currentAccount && currentAccount.role === 'admin';
  const canDeleteAll = isAdmin || _allSelectedNotesOwn();

  bar.innerHTML =
    '<button class="sel-cancel-btn" onclick="exitNoteSelectionMode()">✕ Batal</button>' +
    '<span class="sel-label">' + selectedNoteIds.size + ' catatan</span>' +
    (canDeleteAll ? '<button class="sel-delete-btn" onclick="delSelectedNotes()">🗑 Hapus</button>' : '<span style="width:74px"></span>');
  bar.classList.add('show');
}

function _allSelectedNotesOwn() {
  for (const id of selectedNoteIds) {
    const n = notesCache[id];
    if (!n || !currentAccount || n.author !== currentAccount.name) return false;
  }
  return true;
}

function exitNoteSelectionMode() {
  noteSelectionModeActive = false;
  selectedNoteIds.clear();
  document.querySelectorAll('.note-selected').forEach(el => el.classList.remove('note-selected'));
  const bar = document.getElementById('noteSelectionBar');
  if (bar) bar.classList.remove('show');
}

async function delSelectedNotes() {
  if (selectedNoteIds.size === 0) return;
  const ids = Array.from(selectedNoteIds);
  const label = ids.length === 1 ? 'catatan ini' : ids.length + ' catatan';
  const ok = await showConfirm('Hapus ' + label + '?', {
    icon: '🗑', title: 'Hapus Catatan', okText: 'Hapus', cancelText: 'Batal'
  });
  if (!ok) return;

  exitNoteSelectionMode();
  const res = await sb.from('notes').delete().in('id', ids);
  if (res.error) { toast('Gagal hapus', false); return; }

  ids.forEach(id => {
    const card = document.querySelector('[data-nid="' + id + '"]');
    if (card) card.remove();
    delete notesCache[id];
  });

  toast(ids.length === 1 ? 'Catatan dihapus' : ids.length + ' catatan dihapus');
}

// ========== GLOBAL CLICK LISTENER ==========
document.addEventListener('click', (e) => {
  if (!e.target.closest('.note-chevron') && !e.target.closest('.read-author-option') && !e.target.closest('.note-options-menu')) {
    closeActiveOptionMenu();
  }
  if (!e.target.closest('.emoji-picker-wrap') && !e.target.closest('.emoji-trigger') && typeof closeEmojiPicker === 'function') {
    closeEmojiPicker();
  }
  if (!e.target.closest('.msg-action-menu') && !e.target.closest('.bubble-action-btn') && typeof closeMsgActionMenu === 'function') {
    closeMsgActionMenu();
  }
  if (noteSelectionModeActive && !e.target.closest('[data-nid]') && !e.target.closest('#noteSelectionBar')) {
    exitNoteSelectionMode();
  }
});

// ========== KEY EVENTS ==========
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (document.getElementById('lightbox').classList.contains('show')) {
      if (typeof closeLightbox === 'function') closeLightbox();
      return;
    }
    if (typeof exitSelectionMode === 'function') exitSelectionMode();
    exitNoteSelectionMode();
  }
  if (e.key === 'ArrowLeft' && document.getElementById('lightbox').classList.contains('show') && typeof lightboxNav === 'function') lightboxNav(-1);
  if (e.key === 'ArrowRight' && document.getElementById('lightbox').classList.contains('show') && typeof lightboxNav === 'function') lightboxNav(1);
});

// ========== INIT ==========
window.onload = function() {
  checkSession();
};
