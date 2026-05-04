// ==================== KONFIGURASI SUPABASE ====================
const SUPABASE_URL = 'https://cxlvnwbfdbymdoddjqwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4bHZud2JmZGJ5bWRvZGRqcXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDUwOTMsImV4cCI6MjA5MzQ4MTA5M30.9jGx6eY7qzvQzW65xD7gVOMP1YZQzKjULginFNwSV-k';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== CEK LOGIN ====================
if (!sessionStorage.getItem('isAuthenticated')) {
    alert('Silakan login terlebih dahulu! PIN: 123456');
    window.location.href = 'index.html';
}

// ==================== USER ID ====================
let currentUserId = sessionStorage.getItem('userId');
if (!currentUserId) {
    currentUserId = 'user_' + Math.random().toString(36).substr(2, 8);
    sessionStorage.setItem('userId', currentUserId);
}

// ==================== FUNGSI MEMBUAT TABEL OTOMATIS ====================
async function createTablesIfNotExist() {
    console.log('🔧 Mengecek tabel di Supabase...');
    
    // Coba buat tabel notes
    try {
        const { error } = await supabase.from('notes').select('count');
        if (error && error.message.includes('relation')) {
            console.log('📝 Membuat tabel notes...');
            await supabase.rpc('create_notes_table');
        }
    } catch (e) {
        console.log('Tabel notes sudah ada atau error:', e.message);
    }
    
    // Coba buat tabel chat_messages
    try {
        const { error } = await supabase.from('chat_messages').select('count');
        if (error && error.message.includes('relation')) {
            console.log('💬 Membuat tabel chat_messages...');
            await supabase.rpc('create_chat_table');
        }
    } catch (e) {
        console.log('Tabel chat_messages sudah ada');
    }
    
    // Coba buat tabel gallery
    try {
        const { error } = await supabase.from('gallery').select('count');
        if (error && error.message.includes('relation')) {
            console.log('🖼️ Membuat tabel gallery...');
            await supabase.rpc('create_gallery_table');
        }
    } catch (e) {
        console.log('Tabel gallery sudah ada');
    }
}

// ==================== FUNGSI CATATAN ====================
async function loadNotes() {
    const notesList = document.getElementById('notesList');
    notesList.innerHTML = '<div class="loading">📝 Memuat catatan...</div>';
    
    try {
        const { data, error } = await supabase
            .from('notes')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            notesList.innerHTML = '<div class="empty-state">📭 Belum ada catatan. Klik + Tambah Catatan!</div>';
            return;
        }
        
        notesList.innerHTML = '';
        for (let i = 0; i < data.length; i++) {
            const note = data[i];
            const noteDiv = document.createElement('div');
            noteDiv.className = 'note-item';
            noteDiv.setAttribute('data-id', note.id);
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
        }
        
        // Event listener untuk tombol edit
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                const title = btn.getAttribute('data-title');
                const content = btn.getAttribute('data-content');
                editNote(id, title, content);
            });
        });
        
        // Event listener untuk tombol rename
        document.querySelectorAll('.btn-rename').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                const title = btn.getAttribute('data-title');
                renameNote(id, title);
            });
        });
        
        // Event listener untuk tombol hapus
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                deleteNote(id);
            });
        });
        
    } catch (err) {
        console.error('Error:', err);
        notesList.innerHTML = `<div class="empty-state">❌ Error: ${err.message}<br><br>📌 Pastikan tabel "notes" sudah dibuat di Supabase!</div>`;
    }
}

async function addNote() {
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    
    if (!title) {
        alert('Judul catatan tidak boleh kosong!');
        return;
    }
    
    const btn = document.getElementById('addNoteBtn');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Menyimpan...';
    btn.disabled = true;
    
    try {
        const { error } = await supabase
            .from('notes')
            .insert([{ 
                title: title, 
                content: content, 
                created_at: new Date().toISOString() 
            }]);
        
        if (error) throw error;
        
        document.getElementById('noteTitle').value = '';
        document.getElementById('noteContent').value = '';
        await loadNotes();
        alert('✅ Catatan berhasil ditambahkan!');
    } catch (err) {
        alert('❌ Gagal: ' + err.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

async function editNote(id, oldTitle, oldContent) {
    const newTitle = prompt('Edit judul catatan:', oldTitle);
    if (newTitle === null) return;
    
    const newContent = prompt('Edit isi catatan:', oldContent);
    if (newContent === null) return;
    
    if (!newTitle.trim()) {
        alert('Judul tidak boleh kosong!');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('notes')
            .update({ 
                title: newTitle.trim(), 
                content: newContent.trim()
            })
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
    
    if (!newTitle.trim()) {
        alert('Judul tidak boleh kosong!');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('notes')
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
    const confirm = window.confirm('Apakah Anda yakin ingin menghapus catatan ini?');
    if (!confirm) return;
    
    try {
        const { error } = await supabase
            .from('notes')
            .delete()
            .eq('id', id);
        
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
    messagesArea.innerHTML = '<div class="loading">💬 Memuat pesan...</div>';
    
    try {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            messagesArea.innerHTML = '<div class="empty-state">💬 Belum ada pesan. Kirim pesan pertama!</div>';
            return;
        }
        
        messagesArea.innerHTML = '';
        for (let i = 0; i < data.length; i++) {
            const msg = data[i];
            const isSent = msg.user_id === currentUserId;
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
            messageDiv.innerHTML = `
                <div class="bubble">${escapeHtml(msg.message)}</div>
                <div class="message-time">${new Date(msg.created_at).toLocaleTimeString()}</div>
            `;
            messagesArea.appendChild(messageDiv);
        }
        messagesArea.scrollTop = messagesArea.scrollHeight;
    } catch (err) {
        messagesArea.innerHTML = `<div class="empty-state">❌ Error: ${err.message}<br><br>📌 Pastikan tabel "chat_messages" sudah dibuat di Supabase!</div>`;
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) {
        alert('Pesan tidak boleh kosong!');
        return;
    }
    
    const btn = document.getElementById('sendChatBtn');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Mengirim...';
    btn.disabled = true;
    
    try {
        const { error } = await supabase
            .from('chat_messages')
            .insert([{
                message: message,
                user_id: currentUserId,
                created_at: new Date().toISOString()
            }]);
        
        if (error) throw error;
        
        input.value = '';
        await loadMessages();
    } catch (err) {
        alert('❌ Gagal mengirim: ' + err.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
        input.focus();
    }
}

// ==================== FUNGSI GALLERY ====================
async function loadGallery() {
    const galleryGrid = document.getElementById('galleryGrid');
    galleryGrid.innerHTML = '<div class="loading">🖼️ Memuat gallery...</div>';
    
    try {
        const { data, error } = await supabase
            .from('gallery')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            galleryGrid.innerHTML = '<div class="empty-state">🖼️ Belum ada gambar. Tambahkan URL gambar!</div>';
            return;
        }
        
        galleryGrid.innerHTML = '';
        for (let i = 0; i < data.length; i++) {
            const img = data[i];
            const imgDiv = document.createElement('div');
            imgDiv.className = 'gallery-item';
            imgDiv.setAttribute('data-id', img.id);
            imgDiv.innerHTML = `
                <img src="${escapeHtml(img.image_url)}" onerror="this.src='https://via.placeholder.com/150?text=Gagal+Load'">
                <div class="note-date">${new Date(img.created_at).toLocaleDateString()}</div>
                <button class="btn-delete-gallery" data-id="${img.id}">🗑️ Hapus</button>
            `;
            galleryGrid.appendChild(imgDiv);
        }
        
        document.querySelectorAll('.btn-delete-gallery').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                deleteGalleryImage(id);
            });
        });
    } catch (err) {
        galleryGrid.innerHTML = `<div class="empty-state">❌ Error: ${err.message}<br><br>📌 Pastikan tabel "gallery" sudah dibuat di Supabase!</div>`;
    }
}

async function addGalleryImage() {
    const imageUrl = document.getElementById('imageUrl').value.trim();
    
    if (!imageUrl) {
        alert('Masukkan URL gambar!');
        return;
    }
    
    const btn = document.getElementById('addImageBtn');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Menyimpan...';
    btn.disabled = true;
    
    try {
        const { error } = await supabase
            .from('gallery')
            .insert([{ 
                image_url: imageUrl, 
                created_at: new Date().toISOString() 
            }]);
        
        if (error) throw error;
        
        document.getElementById('imageUrl').value = '';
        await loadGallery();
        alert('✅ Gambar berhasil ditambahkan!');
    } catch (err) {
        alert('❌ Gagal: ' + err.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

async function deleteGalleryImage(id) {
    const confirm = window.confirm('Apakah Anda yakin ingin menghapus gambar ini?');
    if (!confirm) return;
    
    try {
        const { error } = await supabase
            .from('gallery')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        await loadGallery();
        alert('✅ Gambar berhasil dihapus!');
    } catch (err) {
        alert('❌ Gagal hapus: ' + err.message);
    }
}

// ==================== REALTIME CHAT ====================
function setupRealtime() {
    supabase
        .channel('chat_realtime')
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

// ==================== TAB NAVIGASI ====================
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    
    for (let i = 0; i < tabs.length; i++) {
        const btn = tabs[i];
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            for (let j = 0; j < tabs.length; j++) {
                tabs[j].classList.remove('active');
            }
            this.classList.add('active');
            
            for (let j = 0; j < contents.length; j++) {
                contents[j].classList.remove('active');
            }
            
            const activeContent = document.getElementById(tabId);
            if (activeContent) {
                activeContent.classList.add('active');
            }
            
            if (tabId === 'notes') loadNotes();
            if (tabId === 'chat') loadMessages();
            if (tabId === 'gallery') loadGallery();
        });
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
    sessionStorage.removeItem('userId');
    window.location.href = 'index.html';
}

// ==================== INIT ====================
async function init() {
    console.log('🚀 Inisialisasi Dashboard...');
    setupTabs();
    setupRealtime();
    await loadNotes();
    await loadMessages();
    await loadGallery();
    
    document.getElementById('addNoteBtn').addEventListener('click', addNote);
    document.getElementById('sendChatBtn').addEventListener('click', sendChatMessage);
    document.getElementById('addImageBtn').addEventListener('click', addGalleryImage);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    document.getElementById('chatInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendChatMessage();
    });
    
    console.log('✅ Dashboard siap!');
}

init();
