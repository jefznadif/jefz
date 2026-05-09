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
let chatChannel = null;
let isChatActive = false;
let chatLoaded = false;

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
  var initial = name.charAt(0).toUpperCase();
  document.getElementById('selectedAccInfo').innerHTML =
    '<div class="sel-acc">' +
      '<div class="acc-avatar-lg" style="background:' + pendingAccount.color + '">' + initial + '</div>' +
      '<div>' +
        '<div class="sel-name">' + name + '</div>' +
        '<div class="sel-role">' + (role === 'admin' ? '👑 Admin' : '👤 User') + '</div>' +
      '</div>' +
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
    sessionStorage.setItem('activeTab', 'Chat'); // default tab
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
  sessionStorage.clear();
  currentAccount = null;
  pendingAccount = null;
  isChatActive = false;
  chatLoaded = false;
  if (chatChannel) { sb.removeChannel(chatChannel); chatChannel = null; }
  document.getElementById('stepPin').style.display = 'none';
  document.getElementById('stepAccount').style.display = 'block';
  document.getElementById('pinInput').value = '';
  document.getElementById('loginErr').textContent = '';
  document.getElementById('dashPage').className = 'page';
  document.getElementById('loginPage').className = 'page active';
}

// ========== SHOW DASH ==========
function showDash() {
  document.getElementById('loginPage').className = 'page';
  document.getElementById('dashPage').className = 'page active';

  // Set topbar avatar
  var initial = currentAccount.name.charAt(0).toUpperCase();
  var avatarEl = document.getElementById('topbarAvatar');
  avatarEl.textContent = initial;
  avatarEl.style.background = currentAccount.color;
  document.getElementById('topbarUser').textContent =
    currentAccount.name + (currentAccount.role === 'admin' ? ' 👑' : ' 👤');

  // Upload hanya admin
  var ul = document.getElementById('uploadLabel');
  if (ul) ul.style.display = currentAccount.role === 'admin' ? 'inline-block' : 'none';

  // Setup realtime
  setupRealtime();

  // Restore tab terakhir, default Chat
  var lastTab = sessionStorage.getItem('activeTab') || 'Chat';
  var tabNavMap = { 'Chat': 'Chat', 'Notes': 'Catatan', 'Gallery': 'Gallery' };
  var title = tabNavMap[lastTab] || 'ChatRoom';
  if (lastTab === 'Chat') title = 'ChatRoom';

  // Aktifkan nav button yang sesuai
  document.querySelectorAll('.nav-item').forEach(function(b) {
    var label = b.querySelector('span') ? b.querySelector('span').textContent : '';
    var match = (lastTab === 'Chat' && label === 'Chat') ||
                (lastTab === 'Notes' && label === 'Catatan') ||
                (lastTab === 'Gallery' && label === 'Gallery');
    b.classList.toggle('active', match);
  });

  // Aktifkan tab
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active-tab'); });
  document.getElementById('tab' + lastTab).classList.add('active-tab');
  document.getElementById('topbarTitle').textContent = title;

  isChatActive = (lastTab === 'Chat');
  if (lastTab === 'Chat') loadChat();
  if (lastTab === 'Notes') loadNotes();
  if (lastTab === 'Gallery') loadGallery();
}

// ========== TABS ==========
function goTab(name, title, btn) {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active-tab'); });
  document.querySelectorAll('.nav-item').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('tab' + name).classList.add('active-tab');
  btn.classList.add('active');
  document.getElementById('topbarTitle').textContent = title;

  // Simpan tab aktif ke session
  sessionStorage.setItem('activeTab', name);

  isChatActive = (name === 'Chat');
  if (name === 'Chat') loadChat();
  if (name === 'Notes') loadNotes();
  if (name === 'Gallery') loadGallery();
}

// ========== HELPERS ==========
function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function fmtDate(d) {
  return new Date(d).toLocaleString('id-ID', {
    day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
  });
}
function fmtTime(d) {
  return new Date(d).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
}
function scrollBottom(el, smooth) {
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
}

// ========== NOTES ==========
async function loadNotes() {
  var el = document.getElementById('notesList');
  el.innerHTML = '<p class="state-msg">Memuat...</p>';
  var res = await sb.from('notes').select('*').order('created_at', { ascending: false });
  if (res.error) { el.innerHTML = '<p class="state-msg err">Error: ' + res.error.message + '</p>'; return; }
  if (!res.data || !res.data.length) { el.innerHTML = '<p class="state-msg">Belum ada catatan.</p>'; return; }
  el.innerHTML = '';
  res.data.forEach(function(n) {
    var d = document.createElement('div');
    d.className = 'note-card';
    // encode content untuk onclick attr
    var safeTitle = esc(n.title);
    var safeContent = esc(n.content || '');
    d.innerHTML =
      '<div class="note-header">' +
        '<span class="note-ttl">' + safeTitle + '</span>' +
        '<div class="note-actions">' +
          '<button title="Edit" onclick="openEditModal(\'' + n.id + '\',\'' + safeTitle + '\',\'' + safeContent + '\')">✏</button>' +
          '<button title="Hapus" onclick="delNote(\'' + n.id + '\')">✕</button>' +
        '</div>' +
      '</div>' +
      (n.content ? '<p class="note-content">' + safeContent + '</p>' : '') +
      '<span class="note-ts">' + fmtDate(n.created_at) + '</span>';
    el.appendChild(d);
  });
}

// Modal Tambah
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
  var res = await sb.from('notes').insert([{ title: title, content: content }]);
  if (res.error) { toast('Gagal: ' + res.error.message, false); return; }
  document.getElementById('noteModal').classList.remove('show');
  toast('Catatan ditambahkan ✓');
  loadNotes();
}

// Modal Edit — judul + isi
function openEditModal(id, oldTitle, oldContent) {
  document.getElementById('editNoteId').value = id;
  // decode html entities kembali untuk ditampilkan di input
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

function decodeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}

// ========== CHAT ==========
function buildMsgEl(m) {
  var isMe = currentAccount && m.sender_name === currentAccount.name;
  var d = document.createElement('div');
  d.className = 'msg-row ' + (isMe ? 'mine' : 'theirs');
  var nameColor = m.sender_name === "Jef'z" ? '#3d5afe' : '#e91e8c';
  var roleTag = m.sender_role === 'admin' ? ' 👑' : '';
  d.innerHTML =
    '<div class="msg-block">' +
      (!isMe ? '<span class="msg-sender" style="color:' + nameColor + '">' + esc(m.sender_name) + roleTag + '</span>' : '') +
      '<div class="bubble">' + esc(m.message) + '<span class="btime">' + fmtTime(m.created_at) + '</span></div>' +
    '</div>';
  return d;
}

async function loadChat() {
  var el = document.getElementById('chatList');
  if (!chatLoaded) el.innerHTML = '<p class="state-msg">Memuat...</p>';

  var res = await sb.from('chat_messages').select('*').order('created_at', { ascending: true });
  if (res.error) { el.innerHTML = '<p class="state-msg err">Error: ' + res.error.message + '</p>'; return; }

  chatLoaded = true;

  if (!res.data || !res.data.length) {
    el.innerHTML = '<p class="state-msg">Belum ada pesan. Mulai chat!</p>';
    return;
  }

  el.innerHTML = '';
  res.data.forEach(function(m) { el.appendChild(buildMsgEl(m)); });
  scrollBottom(el, false);
}

async function sendMsg() {
  var input = document.getElementById('chatInput');
  var msg = input.value.trim();
  if (!msg || !currentAccount) return;

  // Kosongkan input DULU sebelum insert
  input.value = '';
  input.focus();

  // OPTIMISTIC: langsung append ke UI tanpa tunggu DB
  var fakeMsg = {
    message: msg,
    sender_name: currentAccount.name,
    sender_role: currentAccount.role,
    user_id: uid,
    created_at: new Date().toISOString()
  };
  var el = document.getElementById('chatList');
  var placeholder = el.querySelector('.state-msg');
  if (placeholder) el.innerHTML = '';
  var msgEl = buildMsgEl(fakeMsg);
  msgEl.setAttribute('data-pending', '1');
  el.appendChild(msgEl);
  scrollBottom(el, true);

  // Kirim ke Supabase
  var res = await sb.from('chat_messages').insert([{
    message: msg,
    user_id: uid,
    sender_name: currentAccount.name,
    sender_role: currentAccount.role
  }]);

  if (res.error) {
    // Hapus optimistic message jika gagal
    var pending = el.querySelector('[data-pending="1"]');
    if (pending) pending.remove();
    toast('Gagal kirim', false);
    input.value = msg;
    return;
  }

  // Hapus flag pending (realtime akan handle deduplikasi)
  var pending = el.querySelector('[data-pending="1"]');
  if (pending) pending.removeAttribute('data-pending');
}

// ========== REALTIME — append tanpa reload ==========
function setupRealtime() {
  if (chatChannel) { sb.removeChannel(chatChannel); chatChannel = null; }

  chatChannel = sb.channel('chat_room_' + Date.now())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' },
      function(payload) {
        if (!isChatActive) return;
        var el = document.getElementById('chatList');

        // Jika pesan dari diri sendiri, cek apakah sudah ada optimistic message
        var isMe = currentAccount && payload.new.sender_name === currentAccount.name;
        if (isMe) {
          // Sudah ada optimistic bubble, tidak perlu tambah lagi
          var pending = el.querySelector('[data-pending]');
          if (pending) return; // sudah di-handle
        }

        // Hapus placeholder jika ada
        var placeholder = el.querySelector('.state-msg');
        if (placeholder) el.innerHTML = '';

        // Append pesan baru
        el.appendChild(buildMsgEl(payload.new));

        // Scroll smooth jika dekat bawah
        var distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        scrollBottom(el, distFromBottom < 200);
      }
    )
    .subscribe();
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
  if (!currentAccount || currentAccount.role !== 'admin') {
    toast('Hanya admin yang bisa upload', false); return;
  }
  var file = input.files[0];
  if (!file) return;

  toast('Mengupload...');

  // Upload ke storage
  var ext = file.name.split('.').pop();
  var name = Date.now() + '_' + Math.random().toString(36).slice(2,6) + '.' + ext;

  var upRes = await sb.storage.from('gallery').upload(name, file, {
    cacheControl: '3600',
    upsert: false
  });

  if (upRes.error) {
    toast('Upload gagal: ' + upRes.error.message, false);
    input.value = '';
    return;
  }

  // Ambil public URL
  var pub = sb.storage.from('gallery').getPublicUrl(name);
  var fileUrl = pub.data.publicUrl;

  // Simpan ke tabel gallery
  var dbRes = await sb.from('gallery').insert([{
    file_url: fileUrl,
    file_name: name
  }]);

  if (dbRes.error) {
    toast('Gagal simpan ke DB: ' + dbRes.error.message, false);
    input.value = '';
    return;
  }

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
