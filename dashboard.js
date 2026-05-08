// ==================== KONFIGURASI SUPABASE ====================
const SUPABASE_URL = 'https://cxlvnwbfdbymdoddjqwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4bHZud2JmZGJ5bWRvZGRqcXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDUwOTMsImV4cCI6MjA5MzQ4MTA5M30.9jGx6eY7qzvQzW65xD7gVOMP1YZQzKjULginFNwSV-k';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== CEK AUTH ====================
function checkAuth() {
  const isAuth = sessionStorage.getItem('isAuthenticated');
  const authTime = sessionStorage.getItem('authTime');
  if (!isAuth || !authTime) {
    window.location.href = 'index.html';
    return false;
  }
  if (Date.now() - parseInt(authTime) > 3600000) {
    sessionStorage.clear();
    alert('Sesi habis, silakan login kembali.');
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

// ==================== USER ID ====================
let currentUserId = localStorage.getItem('userId');
if (!currentUserId) {
  currentUserId = 'user_' + Math.random().toString(36).substr(2, 8);
  localStorage.setItem('userId', currentUserId);
}

// ==================== REALTIME ====================
let realtimeChannel = null;

function setupRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  realtimeChannel = supabase
    .channel('chat_realtime_' + Date.now())
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages' },
      () => {
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab && activeTab.dataset.tab === 'chat') {
          loadMessages();
        }
      }
    )
    .subscribe();
}

// ==================== TABS ====================
function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(btn => {
    btn.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');

      // Remove active dari semua tab button
      tabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');

      // Hide semua content dulu
      contents.forEach(c => {
        c.classList.remove('active');
        c.style.display = 'none';
      });

      // Show content yang dipilih
      const activeContent = document.getElementById(tabId);
      if (activeContent) {
        activeContent.classList.add('active');
        activeContent.style.display = 'block';
      }

      // Load data sesuai tab
      if (tabId === 'notes') loadNotes();
      if (tabId === 'chat') loadMessages();
      if (tabId === 'gallery') loadGallery();
    });
  });
}

// ==================== FUNGSI CATATAN ====================
async function loadNotes() {
  const notesList = document.getElementById('notesList');
  if (!notesList) return;
  notesList.innerHTML = '<div class="loading">📝 Memuat catatan...</div>';
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      notesList.innerHTML = `<div class="empty-state">❌ Error: ${error.message}</div>`;
      return;
    }
    if (!data || data.length === 0) {
      notesList.innerHTML = '<div class="empty-state">📭 Belum ada catatan. Klik + Tambah Catatan!</div>';
      return;
    }

    notesList.innerHTML = '';
    data.forEach(note => {
      const noteDiv = document.createElement('div');
      noteDiv.className = 'note-item';
      noteDiv.innerHTML = `
        <div class="note-header">
          <div class="note-title">📌 ${escapeHtml(note.title)}</div>
          <div class="note-actions">
            <button class="btn-edit" data-id="${note.id}" data-title="${escapeHtml(note.title)}" data-content="${escapeHtml(note.content || '')}">✏️ Edit</button>
            <button class="btn-rename" data-id="${note.id}" data-title="${escapeHtml(note.title)}">📝 Rename</button>
            <button class="btn-delete" data-id="${note.id}">🗑️ Hapus</button>
          </div>
        </div>
        <div class="note-content">${escapeHtml(note.content || '')}</div>
        <div class="note-date">${new Date(note.created_at).toLocaleString()}</div>
      `;
      notesList.appendChild(noteDiv);
    });

    // Event delegation — tidak menumpuk
    notesList.onclick = (e) => {
      const editBtn = e.target.closest('.btn-edit');
      const renameBtn = e.target.closest('.btn-rename');
      const deleteBtn = e.target.closest('.btn-delete');
      if (editBtn) editNote(editBtn.dataset.id, editBtn.dataset.title, editBtn.dataset.content);
      if (renameBtn) renameNote(renameBtn.dataset.id, renameBtn.dataset.title);
      if (deleteBtn) deleteNote(deleteBtn.dataset.id);
    };

  } catch (err) {
    notesList.innerHTML = `<div class="empty-state">❌ Error: ${err.message}</div>`;
  }
}

async function addNote() {
  const titleEl = document.getElementById('noteTitle');
  const contentEl = document.getElementById('noteContent');
  const title = titleEl.value.trim();
  const content = contentEl.value.trim();

  if (!title) { alert('Judul catatan tidak boleh kosong!'); return; }

  const btn = document.getElementById('addNoteBtn');
  btn.textContent = '⏳ Menyimpan...';
  btn.disabled = true;

  try {
    const { error } = await supabase.from('notes').insert([{
      title, content, created_at: new Date().toISOString()
    }]);
    if (error) throw error;
    titleEl.value = '';
    contentEl.value = '';
    await loadNotes();
    alert('✅ Catatan berhasil ditambahkan!');
  } catch (err) {
    alert('❌ Gagal: ' + err.message);
  } finally {
    btn.textContent = '+ Tambah Catatan';
    btn.disabled = false;
  }
}

async function editNote(id, oldTitle, oldContent) {
  const newTitle = prompt('Edit judul catatan:', oldTitle);
  if (newTitle === null) return;
  const newContent = prompt('Edit isi catatan:', oldContent);
  if (newContent === null) return;
  if (!newTitle.trim()) { alert('Judul tidak boleh kosong!'); return; }
  try {
    const { error } = await supabase.from('notes')
      .update({ title: newTitle.trim(), content: newContent.trim() })
      .eq('id', id);
    if (error) throw error;
    await loadNotes();
    alert('✅ Catatan berhasil diedit!');
  } catch (err) {
    alert('❌ Gagal edit: ' + err.message);
  }
}

async function renameNote(id, oldTitle) {
  const newTitle = prompt('Masukkan judul baru:', oldTitle);
  if (newTitle === null) return;
  if (!newTitle.trim()) { alert('Judul tidak boleh kosong!'); return; }
  try {
    const { error } = await supabase.from('notes')
      .update({ title: newTitle.trim() })
      .eq('id', id);
    if (error) throw error;
    await loadNotes();
    alert('✅ Judul berhasil diubah!');
  } catch (err) {
    alert('❌ Gagal rename: ' + err.message);
  }
}

async function deleteNote(id) {
  if (!window.confirm('Yakin ingin menghapus catatan ini?')) return;
  try {
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) throw error;
    await loadNotes();
    alert('✅ Catatan berhasil dihapus!');
  } catch (err) {
    alert('❌ Gagal hapus: ' + err.message);
  }
}

// ==================== FUNGSI CHAT ====================
async function loadMessages() {
  const messagesArea = document.getElementById('messagesArea');
  if (!messagesArea) return;
  messagesArea.innerHTML = '<div class="loading">💬 Memuat pesan...</div>';
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      messagesArea.innerHTML = `<div class="empty-state">❌ Error: ${error.message}</div>`;
      return;
    }
    if (!data || data.length === 0) {
      messagesArea.innerHTML = '<div class="empty-state">💬 Belum ada pesan. Kirim pesan pertama!</div>';
      return;
    }

    messagesArea.innerHTML = '';
    data.forEach(msg => {
      const isSent = msg.user_id === currentUserId;
      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
      messageDiv.innerHTML = `
        <div class="bubble">${escapeHtml(msg.message)}</div>
        <div class="message-time">${new Date(msg.created_at).toLocaleTimeString()}</div>
      `;
      messagesArea.appendChild(messageDiv);
    });
    messagesArea.scrollTop = messagesArea.scrollHeight;
  } catch (err) {
    messagesArea.innerHTML = `<div class="empty-state">❌ Error: ${err.message}</div>`;
  }
}

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;
  const btn = document.getElementById('sendChatBtn');
  btn.textContent = '⏳';
  btn.disabled = true;
  try {
    const { error } = await supabase.from('chat_messages').insert([{
      message, user_id: currentUserId, created_at: new Date().toISOString()
    }]);
    if (error) throw error;
    input.value = '';
    await loadMessages();
  } catch (err) {
    alert('❌ Gagal mengirim: ' + err.message);
  } finally {
    btn.textContent = 'Kirim';
    btn.disabled = false;
    input.focus();
  }
}

// ==================== FUNGSI GALLERY ====================
async function loadGallery() {
  const galleryGrid = document.getElementById('galleryGrid');
  if (!galleryGrid) return;
  galleryGrid.innerHTML = '<div class="loading">🖼️ Memuat gallery...</div>';
  try {
    const { data, error } = await supabase
      .from('gallery')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      galleryGrid.innerHTML = `<div class="empty-state">❌ Error: ${error.message}</div>`;
      return;
    }
    if (!data || data.length === 0) {
      galleryGrid.innerHTML = '<div class="empty-state">🖼️ Belum ada gambar. Tambahkan URL gambar!</div>';
      return;
    }

    galleryGrid.innerHTML = '';
    data.forEach(img => {
      const imgDiv = document.createElement('div');
      imgDiv.className = 'gallery-item';
      imgDiv.innerHTML = `
        <img src="${escapeHtml(img.image_url)}" onerror="this.src='https://placehold.co/150x120?text=Gagal+Load'">
        <div class="note-date">${new Date(img.created_at).toLocaleDateString()}</div>
        <button class="btn-delete-gallery" data-id="${img.id}">🗑️ Hapus</button>
      `;
      galleryGrid.appendChild(imgDiv);
    });

    // Event delegation
    galleryGrid.onclick = (e) => {
      const deleteBtn = e.target.closest('.btn-delete-gallery');
      if (deleteBtn) deleteGalleryImage(deleteBtn.dataset.id);
    };

  } catch (err) {
    galleryGrid.innerHTML = `<div class="empty-state">❌ Error: ${err.message}</div>`;
  }
}

async function addGalleryImage() {
  const imageUrl = document.getElementById('imageUrl').value.trim();
  if (!imageUrl) { alert('Masukkan URL gambar!'); return; }

  const validUrl = /^https?:\/\/.+/i;
  if (!validUrl.test(imageUrl)) {
    alert('URL harus dimulai dengan http:// atau https://');
    return;
  }

  const btn = document.getElementById('addImageBtn');
  btn.textContent = '⏳ Menyimpan...';
  btn.disabled = true;
  try {
    const { error } = await supabase.from('gallery').insert([{
      image_url: imageUrl, created_at: new Date().toISOString()
    }]);
    if (error) throw error;
    document.getElementById('imageUrl').value = '';
    await loadGallery();
    alert('✅ Gambar berhasil ditambahkan!');
  } catch (err) {
    alert('❌ Gagal: ' + err.message);
  } finally {
    btn.textContent = '+ Tambah Gambar';
    btn.disabled = false;
  }
}

async function deleteGalleryImage(id) {
  if (!window.confirm('Yakin ingin menghapus gambar ini?')) return;
  try {
    const { error } = await supabase.from('gallery').delete().eq('id', id);
    if (error) throw error;
    await loadGallery();
    alert('✅ Gambar berhasil dihapus!');
  } catch (err) {
    alert('❌ Gagal hapus: ' + err.message);
  }
}

// ==================== HELPER ====================
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ==================== LOGOUT ====================
function logout() {
  sessionStorage.removeItem('isAuthenticated');
  sessionStorage.removeItem('authTime');
  sessionStorage.removeItem('userId');
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  window.location.href = 'index.html';
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', async function() {
  if (!checkAuth()) return;

  // Setup tabs PERTAMA sebelum apapun
  setupTabs();
  setupRealtime();

  // Pasang semua event listener tombol di sini
  document.getElementById('addNoteBtn').addEventListener('click', addNote);
  document.getElementById('sendChatBtn').addEventListener('click', sendChatMessage);
  document.getElementById('addImageBtn').addEventListener('click', addGalleryImage);
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('chatInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') sendChatMessage();
  });

  // Load hanya tab yang aktif saat pertama (Notes)
  await loadNotes();
});
