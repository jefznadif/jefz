// ========== SUPABASE ==========
const SB_URL = 'https://cxlvnwbfdbymdoddjqwn.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4bHZud2JmZGJ5bWRvZGRqcXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDUwOTMsImV4cCI6MjA5MzQ4MTA5M30.9jGx6eY7qzvQzW65xD7gVOMP1YZQzKjULginFNwSV-k';
const sb = window.supabase.createClient(SB_URL, SB_KEY);

// ========== STATE ==========
let uid = localStorage.getItem('uid');
if (!uid) { uid = 'u_' + Math.random().toString(36).slice(2,10); localStorage.setItem('uid', uid); }
let dark = localStorage.getItem('theme') === 'dark';

// ========== BOOT ==========
window.onload = () => {
  applyTheme();
  // Cek session
  const auth = sessionStorage.getItem('auth');
  const t = sessionStorage.getItem('authTime');
  if (auth && t && Date.now() - parseInt(t) < 3600000) {
    showDash();
  } else {
    document.getElementById('pinInput').focus();
  }

  // Enter key on PIN
  document.getElementById('pinInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
};

// ========== THEME ==========
function applyTheme() {
  document.body.classList.toggle('dark', dark);
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = dark ? '☀️' : '🌙';
}

function toggleTheme() {
  dark = !dark;
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  applyTheme();
}

// ========== TOAST ==========
let toastTimer;
function toast(msg, ok = true) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + (ok ? 'ok' : 'err');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2800);
}

// ========== LOGIN ==========
async function doLogin() {
  const pin = document.getElementById('pinInput').value.trim();
  const errEl = document.getElementById('loginErr');
  errEl.textContent = '';
  if (!pin) { errEl.textContent = 'Masukkan PIN terlebih dahulu'; return; }

  const btn = document.querySelector('.pin-submit');
  btn.textContent = '...';
  btn.disabled = true;

  try {
    // Ambil PIN dari Supabase
    const { data, error } = await sb
      .from('config')
      .select('value')
      .eq('key', 'pin')
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Konfigurasi PIN tidak ditemukan di database');

    if (pin === data.value) {
      sessionStorage.setItem('auth', '1');
      sessionStorage.setItem('authTime', Date.now().toString());
      document.getElementById('pinInput').value = '';
      showDash();
    } else {
      errEl.textContent = 'PIN salah, coba lagi';
      document.getElementById('pinInput').value = '';
      document.getElementById('pinInput').focus();
    }
  } catch (e) {
    errEl.textContent = '⚠ ' + e.message;
  } finally {
    btn.textContent = '→';
    btn.disabled = false;
  }
}

function doLogout() {
  sessionStorage.clear();
  document.getElementById('dashPage').className = 'page';
  document.getElementById('loginPage').className = 'page active';
  setTimeout(() => document.getElementById('pinInput').focus(), 100);
}

function showDash() {
  document.getElementById('loginPage').className = 'page';
  document.getElementById('dashPage').className = 'page active';
  loadNotes();
}

// ========== TABS ==========
function goTab(name, title, btn) {
  // Hide all tabs
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active-tab'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  // Show selected
  document.getElementById('tab' + name).classList.add('active-tab');
  btn.classList.add('active');
  document.getElementById('topbarTitle').textContent = title;
  // Load
  if (name === 'Notes') loadNotes();
  if (name === 'Chat') loadChat();
  if (name === 'Gallery') loadGallery();
}

// ========== HELPERS ==========
function esc(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(d) {
  return new Date(d).toLocaleString('id-ID', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

function fmtTime(d) {
  return new Date(d).toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'});
}

// ========== NOTES ==========
async function loadNotes() {
  const el = document.getElementById('notesList');
  el.innerHTML = '<p class="state-msg">Memuat...</p>';
  const { data, error } = await sb.from('notes').select('*').order('created_at', {ascending: false});
  if (error) { el.innerHTML = `<p class="state-msg err">Error: ${error.message}</p>`; return; }
  if (!data.length) { el.innerHTML = '<p class="state-msg">Belum ada catatan.</p>'; return; }
  el.innerHTML = '';
  data.forEach(n => {
    const d = document.createElement('div');
    d.className = 'note-card';
    d.innerHTML = `
      <div class="note-header">
        <span class="note-ttl">${esc(n.title)}</span>
        <div class="note-actions">
          <button onclick="editNote('${n.id}','${esc(n.title)}','${esc(n.content||'')}')">✏</button>
          <button onclick="delNote('${n.id}')">✕</button>
        </div>
      </div>
      ${n.content ? `<p class="note-content">${esc(n.content)}</p>` : ''}
      <span class="note-ts">${fmtDate(n.created_at)}</span>
    `;
    el.appendChild(d);
  });
}

async function addNote() {
  const t = document.getElementById('noteTitle').value.trim();
  const c = document.getElementById('noteBody').value.trim();
  if (!t) { toast('Judul tidak boleh kosong!', false); return; }
  const { error } = await sb.from('notes').insert([{title:t, content:c}]);
  if (error) { toast('Gagal: ' + error.message, false); return; }
  document.getElementById('noteTitle').value = '';
  document.getElementById('noteBody').value = '';
  toast('Catatan ditambahkan ✓');
  loadNotes();
}

async function editNote(id, oldT, oldC) {
  const newT = prompt('Edit judul:', oldT);
  if (newT === null) return;
  const newC = prompt('Edit isi:', oldC);
  if (newC === null) return;
  const { error } = await sb.from('notes').update({title: newT.trim(), content: newC.trim()}).eq('id', id);
  if (error) { toast('Gagal edit', false); return; }
  toast('Disimpan ✓');
  loadNotes();
}

async function delNote(id) {
  if (!confirm('Hapus catatan ini?')) return;
  const { error } = await sb.from('notes').delete().eq('id', id);
  if (error) { toast('Gagal hapus', false); return; }
  toast('Dihapus');
  loadNotes();
}

// ========== CHAT ==========
async function loadChat() {
  const el = document.getElementById('chatList');
  el.innerHTML = '<p class="state-msg">Memuat...</p>';
  const { data, error } = await sb.from('chat_messages').select('*').order('created_at', {ascending: true});
  if (error) { el.innerHTML = `<p class="state-msg err">Error: ${error.message}</p>`; return; }
  if (!data.length) { el.innerHTML = '<p class="state-msg">Belum ada pesan.</p>'; return; }
  el.innerHTML = '';
  data.forEach(m => {
    const mine = m.user_id === uid;
    const d = document.createElement('div');
    d.className = 'msg-row ' + (mine ? 'mine' : 'theirs');
    d.innerHTML = `<div class="bubble">${esc(m.message)}<span class="btime">${fmtTime(m.created_at)}</span></div>`;
    el.appendChild(d);
  });
  el.scrollTop = el.scrollHeight;
}

async function sendMsg() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  const { error } = await sb.from('chat_messages').insert([{message: msg, user_id: uid}]);
  if (error) { toast('Gagal kirim', false); return; }
  loadChat();
}

// Realtime
sb.channel('chat_live')
  .on('postgres_changes', {event:'INSERT', schema:'public', table:'chat_messages'}, () => {
    const active = document.querySelector('.nav-item.active');
    if (active && active.querySelector('span') && active.querySelector('span').textContent === 'Chat') {
      loadChat();
    }
  }).subscribe();

// ========== GALLERY ==========
async function loadGallery() {
  const el = document.getElementById('galleryGrid');
  el.innerHTML = '<p class="state-msg">Memuat...</p>';
  const { data, error } = await sb.from('gallery').select('*').order('created_at', {ascending: false});
  if (error) { el.innerHTML = `<p class="state-msg err">Error: ${error.message}</p>`; return; }
  if (!data.length) { el.innerHTML = '<p class="state-msg">Belum ada media.</p>'; return; }
  el.innerHTML = '';
  data.forEach(f => {
    const isVid = /\.(mp4|webm|mov|avi)$/i.test(f.file_name || '');
    const d = document.createElement('div');
    d.className = 'g-item';
    d.innerHTML = isVid
      ? `<video src="${esc(f.file_url)}" class="g-media" controls></video>`
      : `<img src="${esc(f.file_url)}" class="g-media" onclick="openLightbox('${esc(f.file_url)}')" loading="lazy"/>`;
    d.innerHTML += `<button class="g-del" onclick="delMedia('${f.id}','${esc(f.file_name)}')">✕</button>`;
    el.appendChild(d);
  });
}

async function doUpload(input) {
  const file = input.files[0];
  if (!file) return;
  toast('Mengupload...', true);
  const name = `${Date.now()}_${file.name.replace(/\s+/g,'_')}`;
  const { error: upErr } = await sb.storage.from('gallery').upload(name, file);
  if (upErr) { toast('Upload gagal: ' + upErr.message, false); return; }
  const { data: pub } = sb.storage.from('gallery').getPublicUrl(name);
  const { error: dbErr } = await sb.from('gallery').insert([{file_url: pub.publicUrl, file_name: name}]);
  if (dbErr) { toast('Simpan gagal', false); return; }
  toast('Berhasil diupload ✓');
  input.value = '';
  loadGallery();
}

async function delMedia(id, name) {
  if (!confirm('Hapus media ini?')) return;
  await sb.storage.from('gallery').remove([name]);
  const { error } = await sb.from('gallery').delete().eq('id', id);
  if (error) { toast('Gagal hapus', false); return; }
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
}
