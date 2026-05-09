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
let seenMsgIds = new Set(); // track semua id yg sudah dirender
let pollTimer = null;

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
  var btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = dark ? '☀️' : '🌙';
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
  sessionStorage.clear();
  currentAccount = null;
  pendingAccount = null;
  chatLoaded = false;
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
  var ul = document.getElementById('uploadLabel');
  if (ul) ul.style.display = currentAccount.role === 'admin' ? 'inline-block' : 'none';
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

  if (name === 'Chat') initChat();
  if (name === 'Notes') loadNotes();
  if (name === 'Gallery') loadGallery();
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

// ========== NOTES ==========
async function loadNotes() {
  var el = document.getElementById('notesList');
  el.innerHTML = '<p class="state-msg">Memuat...</p>';
  var res = await sb.from('notes').select('*').order('created_at', { ascending: true });
  if (res.error) { el.innerHTML = '<p class="state-msg err">Error: ' + res.error.message + '</p>'; return; }
  if (!res.data || !res.data.length) { el.innerHTML = '<p class="state-msg">Belum ada catatan.</p>'; return; }
  el.innerHTML = '';
  res.data.forEach(function(n) {
    var isAdmin = currentAccount && currentAccount.role === 'admin';
    var isOwner = currentAccount && n.author === currentAccount.name;
    var canEdit = isAdmin || isOwner;

    var preview = (n.content || '').replace(/\n/g,' ').trim();
    if (preview.length > 60) preview = preview.slice(0,60) + '…';
    var authorColor = n.author === "Jef'z" ? '#3d5afe' : '#e91e8c';

    var d = document.createElement('div');
    d.className = 'note-card';
    d.innerHTML =
      '<div class="note-summary" onclick="openReadModal(\'' + n.id + '\')">' +
        '<div class="note-sum-main">' +
          '<span class="note-ttl">' + esc(n.title) + '</span>' +
          (preview ? '<span class="note-preview">' + esc(preview) + '</span>' : '') +
        '</div>' +
        '<div class="note-sum-meta">' +
          '<span class="note-author-dot" style="background:' + authorColor + '"></span>' +
          '<span class="note-author-name">' + esc(n.author || '') + '</span>' +
          '<span class="note-chevron">›</span>' +
        '</div>' +
      '</div>' +
      (canEdit ?
        '<div class="note-action-row">' +
          '<button class="note-act-btn edit-btn" onclick="openEditModal(\'' + n.id + '\',\'' + esc(n.title) + '\',\'' + esc(n.content||'') + '\')">✏ Edit</button>' +
          '<button class="note-act-btn del-btn" onclick="delNote(\'' + n.id + '\')">✕ Hapus</button>' +
        '</div>' : '');
    el.appendChild(d);
  });
  setTimeout(function() { el.scrollTop = el.scrollHeight; }, 50);
}

function openReadModal(id) {
  sb.from('notes').select('*').eq('id', id).single().then(function(res) {
    if (res.error || !res.data) return;
    var n = res.data;
    document.getElementById('readModalTitle').textContent = n.title;
    var authorColor = n.author === "Jef'z" ? '#3d5afe' : '#e91e8c';
    document.getElementById('readModalAuthor').innerHTML =
      '<span class="read-author-dot" style="background:' + authorColor + '"></span>' + esc(n.author || '');
    document.getElementById('readModalBody').textContent = n.content || '(Tidak ada isi)';
    document.getElementById('readModalTs').textContent = fmtDate(n.created_at);
    document.getElementById('readModal').classList.add('show');
  });
}
function closeReadModal(e) {
  if (e && e.target !== document.getElementById('readModal')) return;
  document.getElementById('readModal').classList.remove('show');
}

function openNoteModal() {
  document.getElementById('noteTitleInput').value = '';
  document.getElementById('noteBodyInput').value = '';
  document.getElementById('noteModal').classList.add('show');
  setTimeout(function() { document.getElementById('noteTitleInput').focus(); }, 120);
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
  loadNotes();
}

function openEditModal(id, oldTitle, oldContent) {
  document.getElementById('editNoteId').value = id;
  document.getElementById('editTitleInput').value = decodeHtml(oldTitle);
  document.getElementById('editBodyInput').value = decodeHtml(oldContent);
  document.getElementById('editModal').classList.add('show');
  setTimeout(function() { document.getElementById('editTitleInput').focus(); }, 120);
}
function closeEditModal(e) {
  if (e && e.target !== document.getElementById('editModal')) return;
  document.getElementById('editModal').classList.remove('show');
}

async function saveEditNote() {
  var id = document.getElementById('editNoteId').value;
  var newTitle = document.getElementById('editTitleInput').value.trim();
  var newContent = document.getElementById('editBodyInput').value.trim();
  if (!newTitle) { toast('Judul tidak boleh kosong!', false); return; }
  var res = await sb.from('notes').update({ title: newTitle, content: newContent }).eq('id', id);
  if (res.error) { toast('Gagal edit: ' + res.error.message, false); return; }
  document.getElementById('editModal').classList.remove('show');
  toast('Catatan diperbarui ✓');
  loadNotes();
}

async function delNote(id) {
  if (!confirm('Hapus catatan ini?')) return;
  var res = await sb.from('notes').delete().eq('id', id);
  if (res.error) { toast('Gagal hapus', false); return; }
  toast('Dihapus');
  loadNotes();
}

// ========== CHAT — ULTRA RESPONSIVE ==========
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

// Append satu pesan baru ke UI, skip kalau sudah ada
function appendMsg(m, smooth) {
  var el = document.getElementById('chatList');
  if (!el) return;
  var id = String(m.id || '');
  if (id && seenMsgIds.has(id)) return; // deduplicate
  if (id) seenMsgIds.add(id);

  // Hapus placeholder
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

  // Load semua pesan
  var res = await sb.from('chat_messages').select('*').order('created_at', { ascending: true });
  if (res.error) { el.innerHTML = '<p class="state-msg err">Error: ' + res.error.message + '</p>'; return; }

  el.innerHTML = '';
  chatLoaded = true;

  if (!res.data || !res.data.length) {
    el.innerHTML = '<p class="state-msg">Belum ada pesan. Mulai chat!</p>';
  } else {
    res.data.forEach(function(m) {
      if (m.id) seenMsgIds.add(String(m.id));
      el.appendChild(buildMsgEl(m));
    });
    scrollBottom(el, false);
  }

  // Start sync setelah data loaded
  startChatSync();
}

function startChatSync() {
  // Bersihkan yang lama
  if (chatChannel) { try { sb.removeChannel(chatChannel); } catch(e){} chatChannel = null; }
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }

  // ======== REALTIME — Primary ========
  // Buat channel fresh setiap kali
  chatChannel = sb.channel('chat_live_' + Date.now(), {
    config: { broadcast: { self: false } }
  })
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'chat_messages' },
    function(payload) {
      if (!isChatActive || !payload.new) return;
      // Kalau ini pesan dari diri sendiri & ada optimistic bubble, replace
      if (currentAccount && payload.new.sender_name === currentAccount.name) {
        var el = document.getElementById('chatList');
        var pend = el.querySelector('[data-pending]');
        if (pend) {
          // Update id di optimistic bubble
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

  // ======== POLLING — Fallback setiap 3 detik ========
  pollTimer = setInterval(async function() {
    if (!isChatActive || !chatLoaded) return;
    // Ambil pesan yang belum ada di seenMsgIds
    // Pakai query berdasarkan jumlah — cukup ambil 20 terbaru dan cek
    var res = await sb.from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (res.error || !res.data) return;
    // Balik urutan (terlama dulu)
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

  // Optimistic UI langsung
  var fakeMsg = {
    message: msg,
    sender_name: currentAccount.name,
    sender_role: currentAccount.role,
    user_id: uid,
    created_at: new Date().toISOString()
    // id sengaja tidak ada supaya tidak masuk seenMsgIds
  };
  var el = document.getElementById('chatList');
  var ph = el.querySelector('.state-msg');
  if (ph) el.innerHTML = '';
  var msgEl = buildMsgEl(fakeMsg);
  msgEl.dataset.pending = '1';
  el.appendChild(msgEl);
  scrollBottom(el, true);

  // Kirim ke DB
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

  // Insert berhasil — kalau realtime belum fire dalam 1 detik, poll manual
  setTimeout(async function() {
    var pend = el.querySelector('[data-pending]');
    if (!pend) return; // sudah dihandle realtime
    // Realtime belum datang, ambil dari DB
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
  if (!res.data || !res.data.length) { el.innerHTML = '<p class="state-msg">Belum ada media.</p>'; return; }
  el.innerHTML = '';
  var isAdmin = currentAccount && currentAccount.role === 'admin';
  res.data.forEach(function(f) {
    var isVid = /\.(mp4|webm|mov|avi)$/i.test(f.file_name || '');
    var d = document.createElement('div');
    d.className = 'g-item';
    d.innerHTML = isVid
      ? '<video src="' + esc(f.file_url) + '" class="g-media" controls></video>'
      : '<img src="' + esc(f.file_url) + '" class="g-media" onclick="openLightbox(\'' + esc(f.file_url) + '\')" loading="lazy"/>';
    if (isAdmin) {
      d.innerHTML += '<button class="g-del" onclick="delMedia(\'' + f.id + '\',\'' + esc(f.file_name) + '\')">✕</button>';
    }
    el.appendChild(d);
  });
}

async function doUpload(input) {
  if (!currentAccount || currentAccount.role !== 'admin') { toast('Hanya admin yang bisa upload', false); return; }
  var file = input.files[0];
  if (!file) return;
  toast('Mengupload...');
  var ext = file.name.split('.').pop();
  var name = Date.now() + '_' + Math.random().toString(36).slice(2,6) + '.' + ext;
  var upRes = await sb.storage.from('gallery').upload(name, file, { cacheControl: '3600', upsert: false });
  if (upRes.error) { toast('Upload gagal: ' + upRes.error.message, false); input.value = ''; return; }
  var pub = sb.storage.from('gallery').getPublicUrl(name);
  var dbRes = await sb.from('gallery').insert([{ file_url: pub.data.publicUrl, file_name: name }]);
  if (dbRes.error) { toast('Gagal simpan: ' + dbRes.error.message, false); input.value = ''; return; }
  toast('Berhasil diupload ✓');
  input.value = '';
  loadGallery();
}

async function delMedia(id, name) {
  if (!currentAccount || currentAccount.role !== 'admin') return;
  if (!confirm('Hapus media ini?')) return;
  await sb.storage.from('gallery').remove([name]);
  var res = await sb.from('gallery').delete().eq('id', id);
  if (res.error) { toast('Gagal hapus', false); return; }
  toast('Dihapus');
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
}
