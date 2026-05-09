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
let currentAccount = null; // { name, role, color }
let dark = localStorage.getItem('theme') === 'dark';
let uid = localStorage.getItem('uid');
if (!uid) { uid = 'u_' + Math.random().toString(36).slice(2,10); localStorage.setItem('uid', uid); }

// ========== BOOT ==========
window.onload = function () {
  applyTheme();
  var auth = sessionStorage.getItem('auth');
  var accName = sessionStorage.getItem('accName');
  var t = sessionStorage.getItem('authTime');
  if (auth && accName && t && (Date.now() - parseInt(t)) < 3600000) {
    currentAccount = { name: accName, role: sessionStorage.getItem('accRole'), color: ACCOUNTS[accName] ? ACCOUNTS[accName].color : '#3d5afe' };
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

// ========== LOGIN FLOW ==========
var pendingAccount = null;

function selectAccount(name, role) {
  pendingAccount = { name: name, role: role, color: ACCOUNTS[name] ? ACCOUNTS[name].color : '#3d5afe' };
  // Tampilkan step PIN
  document.getElementById('stepAccount').style.display = 'none';
  document.getElementById('stepPin').style.display = 'block';
  // Isi info akun yang dipilih
  var initial = name.charAt(0).toUpperCase();
  var color = pendingAccount.color;
  document.getElementById('selectedAccInfo').innerHTML =
    '<div class="sel-acc">' +
      '<div class="acc-avatar-lg" style="background:' + color + '">' + initial + '</div>' +
      '<div>' +
        '<div class="sel-name">' + name + '</div>' +
        '<div class="sel-role">' + (role === 'admin' ? '👑 Admin' : '👤 User') + '</div>' +
      '</div>' +
    '</div>';
  setTimeout(function () { document.getElementById('pinInput').focus(); }, 100);
  document.getElementById('pinInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doLogin();
  });
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
  // Reset ke step pilih akun
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

  // Set topbar info
  var initial = currentAccount.name.charAt(0).toUpperCase();
  var avatarEl = document.getElementById('topbarAvatar');
  avatarEl.textContent = initial;
  avatarEl.style.background = currentAccount.color;
  document.getElementById('topbarUser').textContent = currentAccount.name + (currentAccount.role === 'admin' ? ' 👑' : '');
  document.getElementById('topbarTitle').textContent = 'Catatan';

  // Admin bisa upload, user tidak
  var uploadLabel = document.getElementById('uploadLabel');
  if (uploadLabel) {
    uploadLabel.style.display = currentAccount.role === 'admin' ? 'inline-block' : 'none';
  }

  // Reset tab ke notes
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active-tab'); });
  document.querySelectorAll('.nav-item').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('tabNotes').classList.add('active-tab');
  document.querySelector('.nav-item').classList.add('active');

  loadNotes();
}

// ========== TABS ==========
function goTab(name, title, btn) {
  document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active-tab'); });
  document.querySelectorAll('.nav-item').forEach(function (b) { b.classList.remove('active'); });
  document.getElementById('tab' + name).classList.add('active-tab');
  btn.classList.add('active');
  document.getElementById('topbarTitle').textContent = title;
  if (name === 'Notes') loadNotes();
  if (name === 'Chat') loadChat();
  if (name === 'Gallery') loadGallery();
}

// ========== HELPERS ==========
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function fmtDate(d) {
  return new Date(d).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function fmtTime(d) {
  return new Date(d).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
}

// ========== NOTES ==========
async function loadNotes() {
  var el = document.getElementById('notesList');
  el.innerHTML = '<p class="state-msg">Memuat...</p>';
  var res = await sb.from('notes').select('*').order('created_at', { ascending: false });
  if (res.error) { el.innerHTML = '<p class="state-msg err">Error: ' + res.error.message + '</p>'; return; }
  if (!res.data || !res.data.length) { el.innerHTML = '<p class="state-msg">Belum ada catatan.</p>'; return; }
  el.innerHTML = '';
  res.data.forEach(function (n) {
    var isAdmin = currentAccount && currentAccount.role === 'admin';
    var d = document.createElement('div');
    d.className = 'note-card';
    d.innerHTML =
      '<div class="note-header">' +
        '<span class="note-ttl">' + esc(n.title) + '</span>' +
        (isAdmin ?
          '<div class="note-actions">' +
            '<button onclick="editNote(\'' + n.id + '\',\'' + esc(n.title) + '\',\'' + esc(n.content||'') + '\')">✏</button>' +
            '<button onclick="delNote(\'' + n.id + '\')">✕</button>' +
          '</div>' : '') +
      '</div>' +
      (n.content ? '<p class="note-content">' + esc(n.content) + '</p>' : '') +
      '<span class="note-ts">' + fmtDate(n.created_at) + '</span>';
    el.appendChild(d);
  });

  // Sembunyikan form tambah catatan untuk user
  var form = document.querySelector('.note-form');
  if (form) form.style.display = currentAccount && currentAccount.role === 'admin' ? 'flex' : 'none';
}

async function addNote() {
  if (!currentAccount || currentAccount.role !== 'admin') { toast('Hanya admin yang bisa menambah catatan', false); return; }
  var title = document.getElementById('noteTitle').value.trim();
  var content = document.getElementById('noteBody').value.trim();
  if (!title) { toast('Judul tidak boleh kosong!', false); return; }
  var res = await sb.from('notes').insert([{ title: title, content: content }]);
  if (res.error) { toast('Gagal: ' + res.error.message, false); return; }
  document.getElementById('noteTitle').value = '';
  document.getElementById('noteBody').value = '';
  toast('Catatan ditambahkan ✓');
  loadNotes();
}

async function editNote(id, oldT, oldC) {
  if (!currentAccount || currentAccount.role !== 'admin') return;
  var newT = prompt('Edit judul:', oldT);
  if (newT === null) return;
  var newC = prompt('Edit isi:', oldC);
  if (newC === null) return;
  var res = await sb.from('notes').update({ title: newT.trim(), content: newC.trim() }).eq('id', id);
  if (res.error) { toast('Gagal edit', false); return; }
  toast('Disimpan ✓');
  loadNotes();
}

async function delNote(id) {
  if (!currentAccount || currentAccount.role !== 'admin') return;
  if (!confirm('Hapus catatan ini?')) return;
  var res = await sb.from('notes').delete().eq('id', id);
  if (res.error) { toast('Gagal hapus', false); return; }
  toast('Dihapus');
  loadNotes();
}

// ========== CHAT ==========
async function loadChat() {
  var el = document.getElementById('chatList');
  el.innerHTML = '<p class="state-msg">Memuat...</p>';
  var res = await sb.from('chat_messages').select('*').order('created_at', { ascending: true });
  if (res.error) { el.innerHTML = '<p class="state-msg err">Error: ' + res.error.message + '</p>'; return; }
  if (!res.data || !res.data.length) { el.innerHTML = '<p class="state-msg">Belum ada pesan.</p>'; return; }
  el.innerHTML = '';
  res.data.forEach(function (m) {
    var isMe = m.sender_name === (currentAccount ? currentAccount.name : '');
    var d = document.createElement('div');
    d.className = 'msg-row ' + (isMe ? 'mine' : 'theirs');
    // Warna nama berdasarkan sender
    var nameColor = m.sender_name === "Jef'z" ? '#3d5afe' : '#e91e8c';
    var roleTag = m.sender_role === 'admin' ? ' 👑' : '';
    d.innerHTML =
      '<div class="msg-block">' +
        (!isMe ? '<span class="msg-sender" style="color:' + nameColor + '">' + esc(m.sender_name) + roleTag + '</span>' : '') +
        '<div class="bubble">' + esc(m.message) + '<span class="btime">' + fmtTime(m.created_at) + '</span></div>' +
      '</div>';
    el.appendChild(d);
  });
  el.scrollTop = el.scrollHeight;
}

async function sendMsg() {
  var input = document.getElementById('chatInput');
  var msg = input.value.trim();
  if (!msg || !currentAccount) return;
  input.value = '';
  var res = await sb.from('chat_messages').insert([{
    message: msg,
    user_id: uid,
    sender_name: currentAccount.name,
    sender_role: currentAccount.role
  }]);
  if (res.error) { toast('Gagal kirim', false); return; }
  loadChat();
}

// Realtime chat
sb.channel('chat_live')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, function () {
    var active = document.querySelector('.nav-item.active span');
    if (active && active.textContent === 'Chat') loadChat();
  })
  .subscribe();

// ========== GALLERY ==========
async function loadGallery() {
  var el = document.getElementById('galleryGrid');
  el.innerHTML = '<p class="state-msg">Memuat...</p>';
  var res = await sb.from('gallery').select('*').order('created_at', { ascending: false });
  if (res.error) { el.innerHTML = '<p class="state-msg err">Error: ' + res.error.message + '</p>'; return; }
  if (!res.data || !res.data.length) { el.innerHTML = '<p class="state-msg">Belum ada media.</p>'; return; }
  el.innerHTML = '';
  var isAdmin = currentAccount && currentAccount.role === 'admin';
  res.data.forEach(function (f) {
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
  var name = Date.now() + '_' + file.name.replace(/\s+/g, '_');
  var upRes = await sb.storage.from('gallery').upload(name, file);
  if (upRes.error) { toast('Upload gagal: ' + upRes.error.message, false); return; }
  var pub = sb.storage.from('gallery').getPublicUrl(name);
  var dbRes = await sb.from('gallery').insert([{ file_url: pub.data.publicUrl, file_name: name }]);
  if (dbRes.error) { toast('Simpan gagal', false); return; }
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
