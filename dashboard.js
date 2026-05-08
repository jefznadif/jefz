// ==================== SUPABASE ====================
const SUPABASE_URL = 'https://cxlvnwbfdbymdoddjqwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4bHZud2JmZGJ5bWRvZGRqcXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDUwOTMsImV4cCI6MjA5MzQ4MTA5M30.9jGx6eY7qzvQzW65xD7gVOMP1YZQzKjULginFNwSV-k';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== AUTH ====================
(function() {
  const isAuth = sessionStorage.getItem('isAuthenticated');
  const authTime = sessionStorage.getItem('authTime');
  if (!isAuth || !authTime) {
    window.location.href = 'index.html';
    return;
  }
  if (Date.now() - parseInt(authTime) > 3600000) {
    sessionStorage.clear();
    alert('Sesi habis, silakan login kembali.');
    window.location.href = 'index.html';
  }
})();

// ==================== USER ID ====================
let currentUserId = localStorage.getItem('userId');
if (!currentUserId) {
  currentUserId = 'user_' + Math.random().toString(36).substr(2, 8);
  localStorage.setItem('userId', currentUserId);
}

// ==================== TAB SWITCH ====================
function switchTab(tabName, btnEl) {
  // Sembunyikan semua tab
  document.querySelectorAll('.tab-content').forEach(function(el) {
    el.style.display = 'none';
  });

  // Non-aktifkan semua tombol tab
  document.querySelectorAll('.tab-btn').forEach(function(el) {
    el.classList.remove('active');
  });

  // Tampilkan tab yang dipilih
  document.getElementById('tab-' + tabName).style.display = 'block';

  // Aktifkan tombol yang diklik
  btnEl.classList.add('active');

  // Load data
  if (tabName === 'notes') loadNotes();
  if (tabName === 'chat') loadMessages();
  if (tabName === 'gallery') loadGallery();
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

// ==================== NOTES ====================
async function loadNotes() {
  const el = document.getElementById('notesList');
  el.innerHTML = '<div class="loading">📝 Memuat...</div>';
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (!data || data.length === 0) {
      el.innerHTML = '<div class="empty-state">📭 Belum ada catatan.</div>';
      return;
    }
    el.innerHTML = '';
    data.forEach(function(note) {
      const div = document.createElement('div');
      div.className = 'note-item';
      div.innerHTML = `
        <div class="note-header">
          <div class="note-title">📌 ${escapeHtml(note.title)}</div>
          <div class="note-actions">
            <button class="btn-edit" onclick="editNote('${note.id}', '${escapeHtml(note.title)}', '${escapeHtml(note.content || '')}')">✏️ Edit</button>
            <button class="btn-rename" onclick="renameNote('${note.id}', '${escapeHtml(note.title)}')">📝 Rename</button>
            <button class="btn-delete" onclick="deleteNote('${note.id}')">🗑️ Hapus</button>
          </div>
        </div>
        <div class="note-content">${escapeHtml(note.content || '')}</div>
        <div class="note-date">${new Date(note.created_at).toLocaleString()}</div>
      `;
      el.appendChild(div);
    });
  } catch (err) {
    el.innerHTML = `<div class="empty-state">❌ ${err.message}</div>`;
  }
}

async function addNote() {
  const titleEl = document.getElementById('noteTitle');
  const contentEl = document.getElementById('noteContent');
  const title = titleEl.value.trim();
  const content = contentEl.value.trim();
  if (!title) { alert('Judul tidak boleh kosong!'); return; }
  try {
    const { error } = await supabase.from('notes').insert([{
      title, content, created_at: new Date().toISOString()
    }]);
    if (error) throw error;
    titleEl.value = '';
    contentEl.value = '';
    await loadNotes();
    alert('✅ Catatan ditambahkan!');
  } catch (err) {
    alert('❌ Gagal: ' + err.message);
  }
}

async function editNote(id, oldTitle, oldContent) {
  const newTitle = prompt('Edit judul:', oldTitle);
  if (!newTitle) return;
  const newContent = prompt('Edit isi:', oldContent);
  if (newContent === null) return;
  try {
    const { error } = await supabase.from('notes')
      .update({ title: newTitle.trim(), content: newContent.trim() })
      .eq('id', id);
    if (error) throw error;
    await loadNotes();
    alert('✅ Catatan diedit!');
  } catch (err) {
    alert('❌ Gagal: ' + err.message);
  }
}

async function renameNote(id, oldTitle) {
  const newTitle = prompt('Judul baru:', oldTitle);
  if (!newTitle) return;
  try {
    const { error } = await supabase.from('notes')
      .update({ title: newTitle.trim() })
      .eq('id', id);
    if (error) throw error;
    await loadNotes();
    alert('✅ Judul diubah!');
  } catch (err) {
    alert('❌ Gagal: ' + err.message);
  }
}

async function deleteNote(id) {
  if (!confirm('Yakin hapus catatan ini?')) return;
  try {
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) throw error;
    await loadNotes();
    alert('✅ Catatan dihapus!');
  } catch (err) {
    alert('❌ Gagal: ' + err.message);
  }
}

// ==================== CHAT ====================
async function loadMessages() {
  const el = document.getElementById('messagesArea');
  el.innerHTML = '<div class="loading">💬 Memuat...</div>';
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) {
      el.innerHTML = '<div class="empty-state">💬 Belum ada pesan.</div>';
      return;
    }
    el.innerHTML = '';
    data.forEach(function(msg) {
      const div = document.createElement('div');
      div.className = 'message ' + (msg.user_id === currentUserId ? 'sent' : 'received');
      div.innerHTML = `
        <div class="bubble">${escapeHtml(msg.message)}</div>
        <div class="message-time">${new Date(msg.created_at).toLocaleTimeString()}</div>
      `;
      el.appendChild(div);
    });
    el.scrollTop = el.scrollHeight;
  } catch (err) {
    el.innerHTML = `<div class="empty-state">❌ ${err.message}</div>`;
  }
}

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;
  try {
    const { error } = await supabase.from('chat_messages').insert([{
      message, user_id: currentUserId, created_at: new Date().toISOString()
    }]);
    if (error) throw error;
    input.value = '';
    await loadMessages();
  } catch (err) {
    alert('❌ Gagal kirim: ' + err.message);
  }
}

// ==================== GALLERY ====================
async function loadGallery() {
  const el = document.getElementById('galleryGrid');
  el.innerHTML = '<div class="loading">🖼️ Memuat...</div>';
  try {
    const { data, error } = await supabase
      .from('gallery')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (!data || data.length === 0) {
      el.innerHTML = '<div class="empty-state">🖼️ Belum ada gambar.</div>';
      return;
    }
    el.innerHTML = '';
    data.forEach(function(img) {
      const div = document.createElement('div');
      div.className = 'gallery-item';
      div.innerHTML = `
        <img src="${escapeHtml(img.image_url)}" onerror="this.src='https://placehold.co/150x120?text=Error'">
        <div class="note-date">${new Date(img.created_at).toLocaleDateString()}</div>
        <button class="btn-delete-gallery" onclick="deleteGalleryImage('${img.id}')">🗑️ Hapus</button>
      `;
      el.appendChild(div);
    });
  } catch (err) {
    el.innerHTML = `<div class="empty-state">❌ ${err.message}</div>`;
  }
}

async function addGalleryImage() {
  const imageUrl = document.getElementById('imageUrl').value.trim();
  if (!imageUrl) { alert('Masukkan URL gambar!'); return; }
  if (!/^https?:\/\/.+/i.test(imageUrl)) {
    alert('URL harus dimulai dengan http:// atau https://');
    return;
  }
  try {
    const { error } = await supabase.from('gallery').insert([{
      image_url: imageUrl, created_at: new Date().toISOString()
    }]);
    if (error) throw error;
    document.getElementById('imageUrl').value = '';
    await loadGallery();
    alert('✅ Gambar ditambahkan!');
  } catch (err) {
    alert('❌ Gagal: ' + err.message);
  }
}

async function deleteGalleryImage(id) {
  if (!confirm('Yakin hapus gambar ini?')) return;
  try {
    const { error } = await supabase.from('gallery').delete().eq('id', id);
    if (error) throw error;
    await loadGallery();
    alert('✅ Gambar dihapus!');
  } catch (err) {
    alert('❌ Gagal: ' + err.message);
  }
}

// ==================== REALTIME ====================
supabase
  .channel('chat_live')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'chat_messages' },
    function() {
      const activeTab = document.querySelector('.tab-btn.active');
      if (activeTab && activeTab.getAttribute('onclick').includes('chat')) {
        loadMessages();
      }
    }
  )
  .subscribe();

// ==================== LOGOUT ====================
function logout() {
  sessionStorage.clear();
  window.location.href = 'index.html';
}

// ==================== INIT ====================
window.onload = function() {
  loadNotes();
};
