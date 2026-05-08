// ========== SUPABASE ==========
const _url = 'https://cxlvnwbfdbymdoddjqwn.supabase.co';
const _key = 'eyJhbGciOiJIUzI1NiIsR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4bHZud2JmZGJ5bWRvZGRqcXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDUwOTMsImV4cCI6MjA5MzQ4MTA5M30.9jGx6eY7qzvQzW65xD7gVOMP1YZQzKjULginFNwSV-k';
const sb = window.supabase.createClient(_url, _key);

// ========== STATE ==========
let pinBuffer = '';
let userId = localStorage.getItem('uid') || 'u_' + Math.random().toString(36).slice(2, 10);
localStorage.setItem('uid', userId);
let isDark = localStorage.getItem('theme') === 'dark';

// ========== INIT ==========
window.onload = function () {
  applyTheme();
  const auth = sessionStorage.getItem('auth');
  const authTime = sessionStorage.getItem('authTime');
  if (auth && authTime && Date.now() - parseInt(authTime) < 3600000) {
    showDash();
  }
};

// ========== THEME ==========
function applyTheme() {
  document.body.className = isDark ? 'dark' : '';
  document.getElementById('themeBtn').textContent = isDark ? '☀️' : '🌙';
}

function toggleTheme() {
  isDark = !isDark;
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  applyTheme();
}

// ========== TOAST ==========
function toast(msg, ok) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + (ok ? 'ok' : 'err');
  setTimeout(() => { t.className = 'toast'; }, 2500);
}

// ========== PIN ==========
function inputPin(char) {
  if (pinBuffer.length >= 6) return;
  pinBuffer += char;
  updateDots();
  if (pinBuffer.length >= 1) {
    setTimeout(() => tryLogin(), 300);
  }
}

function deletePin() {
  pinBuffer = pinBuffer.slice(0, -1);
  updateDots();
}

function updateDots() {
  const dots = document.querySelectorAll('.dot');
  dots.forEach((d, i) => {
    d.classList.toggle('filled', i < pinBuffer.length);
  });
}

async function tryLogin() {
  const { data, error } = await sb.from('config').select('value').eq('key', 'pin').single();
  if (error || !data) { toast('Error koneksi', false); pinBuffer = ''; updateDots(); return; }
  if (pinBuffer === data.value) {
    sessionStorage.setItem('auth', '1');
    sessionStorage.setItem('authTime', Date.now().toString());
    pinBuffer = '';
    updateDots();
    showDash();
  } else if (pinBuffer.length >= data.value.length) {
    toast('PIN salah!', false);
    setTimeout(() => { pinBuffer = ''; updateDots(); }, 500);
  }
}

// ========== PAGES ==========
function showDash() {
  document.getElementById('loginPage').className = 'page';
  document.getElementById('dashPage').className = 'page active';
  loadNotes();
}

function doLogout() {
  sessionStorage.clear();
  pinBuffer = '';
  updateDots();
  document.getElementById('loginPage').className = 'page active';
  document.getElementById('dashPage').className = 'page';
  document.getElementById('loginMsg').textContent = '';
}

// ========== TABS ==========
const tabTitles = { notes: '📝 Catatan', chat: '💬 ChatRoom', gallery: '🖼️ Gallery' };

function switchTab(name, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active-tab'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('tab' + name.charAt(0).toUpperCase() + name.slice(1)).classList.add('active-tab');
  btn.classList.add('active');
  document.getElementById('tabTitle').textContent = tabTitles[name];
  if (name === 'notes') loadNotes();
  if (name === 'chat') loadChat();
  if (name === 'gallery') loadGallery();
}

// ========== NOTES ==========
async function loadNotes() {
  const el = document.getElementById('notesList');
  el.innerHTML = '<div class="loading">Memuat...</div>';
  const { data, error } = await sb.from('notes').select('*').order('created_at', { ascending: false });
  if (error) { el.innerHTML = '<div class="empty">❌ ' + error.message + '</div>'; return; }
  if (!data.length) { el.innerHTML = '<div class="empty">Belum ada catatan.</div>'; return; }
  el.innerHTML = '';
  data.forEach(n => {
    const d = document.createElement('div');
    d.className = 'note-card';
    d.innerHTML = `
      <div class="note-top">
        <span class="note-title">${esc(n.title)}</span>
        <div class="note-acts">
          <button class="act-btn edit" onclick="editNote('${n.id}','${esc(n.title)}','${esc(n.content||'')}')">✏️</button>
          <button class="act-btn del" onclick="delNote('${n.id}')">🗑️</button>
        </div>
      </div>
      ${n.content ? `<div class="note-body">${esc(n.content)}</div>` : ''}
      <div class="note-date">${fmtDate(n.created_at)}</div>
    `;
    el.appendChild(d);
  });
}

async function addNote() {
  const title = document.getElementById('noteTitle').value.trim();
  const content = document.getElementById('noteBody').value.trim();
  if (!title) { toast('Judul tidak boleh kosong!', false); return; }
  const { error } = await sb.from('notes').insert([{ title, content }]);
  if (error) { toast('Gagal: ' + error.message, false); return; }
  document.getElementById('noteTitle').value = '';
  document.getElementById('noteBody').value = '';
  toast('✅ Catatan ditambahkan!', true);
  loadNotes();
}

async function editNote(id, oldTitle, oldContent) {
  const newTitle = prompt('Edit judul:', oldTitle);
  if (!newTitle) return;
  const newContent = prompt('Edit isi:', oldContent);
  if (newContent === null) return;
  const { error } = await sb.from('notes').update({ title: newTitle, content: newContent }).eq('id', id);
  if (error) { toast('Gagal edit', false); return; }
  toast('✅ Diedit!', true);
  loadNotes();
}

async function delNote(id) {
  if (!confirm('Hapus catatan ini?')) return;
  const { error } = await sb.from('notes').delete().eq('id', id);
  if (error) { toast('Gagal hapus', false); return; }
  toast('🗑️ Dihapus!', true);
  loadNotes();
}

// ========== CHAT ==========
async function loadChat() {
  const el = document.getElementById('chatMessages');
  el.innerHTML = '<div class="loading">Memuat...</div>';
  const { data, error } = await sb.from('chat_messages').select('*').order('created_at', { ascending: true });
  if (error) { el.innerHTML = '<div class="empty">❌ ' + error.message + '</div>'; return; }
  if (!data.length) { el.innerHTML = '<div class="empty">Belum ada pesan.</div>'; return; }
  el.innerHTML = '';
  data.forEach(m => {
    const isMine = m.user_id === userId;
    const d = document.createElement('div');
    d.className = 'msg-wrap ' + (isMine ? 'mine' : 'theirs');
    d.innerHTML = `
      <div class="bubble">${esc(m.message)}</div>
      <div class="msg-time">${fmtTime(m.created_at)}</div>
    `;
    el.appendChild(d);
  });
  el.scrollTop = el.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  const { error } = await sb.from('chat_messages').insert([{ message: msg, user_id: userId }]);
  if (error) { toast('Gagal kirim', false); return; }
  loadChat();
}

// Realtime chat
sb.channel('chat').on('postgres_changes',
  { event: 'INSERT', schema: 'public', table: 'chat_messages' },
  () => {
    const active = document.querySelector('.nav-btn.active');
    if (active && active.textContent.includes('Chat')) loadChat();
  }
).subscribe();

// ========== GALLERY ==========
async function loadGallery() {
  const el = document.getElementById('galleryGrid');
  el.innerHTML = '<div class="loading">Memuat...</div>';
  const { data, error } = await sb.from('gallery').select('*').order('created_at', { ascending: false });
  if (error) { el.innerHTML = '<div class="empty">❌ ' + error.message + '</div>'; return; }
  if (!data.length) { el.innerHTML = '<div class="empty">Belum ada media.</div>'; return; }
  el.innerHTML = '';
  data.forEach(f => {
    const d = document.createElement('div');
    d.className = 'gallery-item';
    const isVideo = f.file_name && /\.(mp4|webm|mov)$/i.test(f.file_name);
    d.innerHTML = `
      ${isVideo
        ? `<video src="${f.file_url}" class="gallery-media" controls></video>`
        : `<img src="${f.file_url}" class="gallery-media" onclick="openImg('${f.file_url}')">`
      }
      <button class="del-media" onclick="delMedia('${f.id}','${f.file_name}')">✕</button>
    `;
    el.appendChild(d);
  });
}

async function uploadFile(input) {
  const file = input.files[0];
  if (!file) return;
  toast('⏳ Mengupload...', true);
  const fileName = Date.now() + '_' + file.name.replace(/\s/g, '_');
  const { error: upErr } = await sb.storage.from('gallery').upload(fileName, file);
  if (upErr) { toast('Gagal upload: ' + upErr.message, false); return; }
  const { data: urlData } = sb.storage.from('gallery').getPublicUrl(fileName);
  const { error: dbErr } = await sb.from('gallery').insert([{
    file_url: urlData.publicUrl,
    file_name: fileName
  }]);
  if (dbErr) { toast('Gagal simpan', false); return; }
  toast('✅ Berhasil diupload!', true);
  input.value = '';
  loadGallery();
}

async function delMedia(id, fileName) {
  if (!confirm('Hapus media ini?')) return;
  await sb.storage.from('gallery').remove([fileName]);
  const { error } = await sb.from('gallery').delete().eq('id', id);
  if (error) { toast('Gagal hapus', false); return; }
  toast('🗑️ Dihapus!', true);
  loadGallery();
}

function openImg(url) {
  window.open(url, '_blank');
}

// ========== HELPERS ==========
function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function fmtDate(d) {
  return new Date(d).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function fmtTime(d) {
  return new Date(d).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
}
