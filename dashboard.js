// ==================== KONFIGURASI SUPABASE ====================
const SUPABASE_URL = 'https://cxlvnwbfdbymdoddjqwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4bHZud2JmZGJ5bWRvZGRqcXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDUwOTMsImV4cCI6MjA5MzQ4MTA5M30.9jGx6eY7qzvQzW65xD7gVOMP1YZQzKjULginFNwSV-k';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('🚀 Dashboard.js dimuat!');

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
console.log('✅ User ID:', currentUserId);

// ==================== FUNGSI CATATAN ====================
async function loadNotes() {
    console.log('📝 loadNotes() dipanggil');
    const notesList = document.getElementById('notesList');
    if (!notesList) {
        console.error('❌ Element notesList tidak ditemukan!');
        return;
    }
    
    notesList.innerHTML = '<div class="loading">📝 Memuat catatan...</div>';
    
    try {
        const { data, error } = await supabase
            .from('notes')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error load notes:', error);
            notesList.innerHTML = `<div class="empty-state">❌ Error: ${error.message}<br><br>Jalankan SQL di Supabase!</div>`;
            return;
        }
        
        console.log('📝 Data notes:', data);
        
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
        notesList.innerHTML = `<div class="empty-state">❌ Error: ${err.message}</div>`;
    }
}

async function addNote() {
    console.log('➕ addNote() dipanggil');
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
        const { data, error } = await supabase
            .from('notes')
            .insert([{ 
                title: title, 
                content: content, 
                created_at: new Date().toISOString() 
            }]);
        
        if (error) throw error;
        
        console.log('✅ Catatan tersimpan');
        document.getElementById('noteTitle').value = '';
        document.getElementById('noteContent').value = '';
        await loadNotes();
        alert('✅ Catatan berhasil ditambahkan!');
    } catch (err) {
        console.error('Error add note:', err);
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
    console.log('💬 loadMessages() dipanggil');
    const messagesArea = document.getElementById('messagesArea');
    if (!messagesArea) return;
    
    messagesArea.innerHTML = '<div class="loading">💬 Memuat pesan...</div>';
    
    try {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .order('created_at', { ascending: true });
        
        if (error) {
            console.error('Error load messages:', error);
            messagesArea.innerHTML = `<div class="empty-state">❌ Error: ${error.message}</div>`;
            return;
        }
        
        console.log('💬 Data messages:', data);
        
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
        console.error('Error:', err);
        messagesArea.innerHTML = `<div class="empty-state">❌ Error: ${err.message}</div>`;
    }
}

async function sendChatMessage() {
    console.log('💬 sendChatMessage() dipanggil');
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
        
        console.log('✅ Pesan terkirim');
        input.value = '';
        await loadMessages();
    } catch (err) {
        console.error('Error send message:', err);
        alert('❌ Gagal mengirim: ' + err.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
        input.focus();
    }
}

// ==================== FUNGSI GALLERY ====================
async function loadGallery() {
    console.log('🖼️ loadGallery() dipanggil');
    const galleryGrid = document.getElementById('galleryGrid');
    if (!galleryGrid) return;
    
    galleryGrid.innerHTML = '<div class="loading">🖼️ Memuat gallery...</div>';
    
    try {
        const { data, error } = await supabase
            .from('gallery')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error load gallery:', error);
            galleryGrid.innerHTML = `<div class="empty-state">❌ Error: ${error.message}</div>`;
            return;
        }
        
        console.log('🖼️ Data gallery:', data);
        
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
        console.error('Error:', err);
        galleryGrid.innerHTML = `<div class="empty-state">❌ Error: ${err.message}</div>`;
    }
}

async function addGalleryImage() {
    console.log('🖼️ addGalleryImage() dipanggil');
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
        
        console.log('✅ Gambar tersimpan');
        document.getElementById('imageUrl').value = '';
        await loadGallery();
        alert('✅ Gambar berhasil ditambahkan!');
    } catch (err) {
        console.error('Error add image:', err);
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
    console.log('📡 Setup realtime...');
    supabase
        .channel('chat_realtime')
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'chat_messages' }, 
            () => {
                console.log('📨 Pesan baru realtime!');
                const activeTab = document.querySelector('.tab-btn.active');
                if (activeTab && activeTab.dataset.tab === 'chat') {
                    loadMessages();
                }
            }
        )
        .subscribe((status) => {
            console.log('📡 Realtime status:', status);
        });
}

// ==================== TAB NAVIGASI ====================
function setupTabs() {
    console.log('🔘 Setup tabs...');
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    
    for (let i = 0; i < tabs.length; i++) {
        const btn = tabs[i];
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            console.log('🔘 Tab diklik:', tabId);
            
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
    console.log('🚪 Logout');
    sessionStorage.removeItem('isAuthenticated');
    sessionStorage.removeItem('userId');
    window.location.href = 'index.html';
}

// ==================== INIT ====================
async function init() {
    console.log('🚀 Inisialisasi Dashboard...');
    
    // Cek apakah elemen ada
    console.log('🔍 Cek elemen:');
    console.log('- notesList:', document.getElementById('notesList'));
    console.log('- messagesArea:', document.getElementById('messagesArea'));
    console.log('- galleryGrid:', document.getElementById('galleryGrid'));
    console.log('- addNoteBtn:', document.getElementById('addNoteBtn'));
    console.log('- sendChatBtn:', document.getElementById('sendChatBtn'));
    console.log('- addImageBtn:', document.getElementById('addImageBtn'));
    console.log('- logoutBtn:', document.getElementById('logoutBtn'));
    
    setupTabs();
    setupRealtime();
    await loadNotes();
    await loadMessages();
    await loadGallery();
    
    const addNoteBtn = document.getElementById('addNoteBtn');
    const sendChatBtn = document.getElementById('sendChatBtn');
    const addImageBtn = document.getElementById('addImageBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const chatInput = document.getElementById('chatInput');
    
    if (addNoteBtn) addNoteBtn.addEventListener('click', addNote);
    if (sendChatBtn) sendChatBtn.addEventListener('click', sendChatMessage);
    if (addImageBtn) addImageBtn.addEventListener('click', addGalleryImage);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') sendChatMessage();
        });
    }
    
    console.log('✅ Dashboard siap!');
}

// Jalankan init saat halaman siap
init();
