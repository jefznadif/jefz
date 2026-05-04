const SUPABASE_URL = 'https://cxlvnwbfdbymdoddjqwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4bHZud2JmZGJ5bWRvZGRqcXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDUwOTMsImV4cCI6MjA5MzQ4MTA5M30.9jGx6eY7qzvQzW65xD7gVOMP1YZQzKjULginFNwSV-k';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

if (!sessionStorage.getItem('isAuthenticated')) {
    alert('Silakan login terlebih dahulu!');
    window.location.href = 'index.html';
}

let currentUserId = sessionStorage.getItem('userId');
if (!currentUserId) {
    currentUserId = 'user_' + Math.random().toString(36).substr(2, 8);
    sessionStorage.setItem('userId', currentUserId);
}

async function loadNotes() {
    const notesList = document.getElementById('notesList');
    if (!notesList) return;
    
    notesList.innerHTML = '<div class="loading-spinner">📝 Memuat catatan...</div>';
    
    try {
        const { data, error } = await supabase
            .from('notes')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            notesList.innerHTML = '<div class="empty-state">📭 Belum ada catatan</div>';
            return;
        }
        
        notesList.innerHTML = data.map(note => `
            <div class="note-item">
                <div class="note-title">📌 ${escapeHtml(note.title)}</div>
                <div class="note-content">${escapeHtml(note.content || '')}</div>
                <div class="note-date">${new Date(note.created_at).toLocaleString()}</div>
            </div>
        `).join('');
    } catch (err) {
        notesList.innerHTML = `<div class="empty-state">❌ Error: ${err.message}</div>`;
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
    btn.textContent = '⏳ Menyimpan...';
    btn.disabled = true;
    
    try {
        const { error } = await supabase
            .from('notes')
            .insert([{ title, content, created_at: new Date().toISOString() }]);
        
        if (error) throw error;
        
        document.getElementById('noteTitle').value = '';
        document.getElementById('noteContent').value = '';
        await loadNotes();
        alert('✅ Catatan berhasil ditambahkan!');
    } catch (err) {
        alert('❌ Gagal: ' + err.message);
    } finally {
        btn.textContent = '+ Tambah Catatan';
        btn.disabled = false;
    }
}

async function loadMessages() {
    const messagesArea = document.getElementById('messagesArea');
    if (!messagesArea) return;
    
    messagesArea.innerHTML = '<div class="loading-spinner">💬 Memuat pesan...</div>';
    
    try {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            messagesArea.innerHTML = '<div class="empty-state">💬 Belum ada pesan</div>';
            return;
        }
        
        messagesArea.innerHTML = data.map(msg => {
            const isSent = msg.user_id === currentUserId;
            return `
                <div class="message ${isSent ? 'sent' : 'received'}">
                    <div class="bubble">${escapeHtml(msg.message)}</div>
                    <div class="message-time">${new Date(msg.created_at).toLocaleTimeString()}</div>
                </div>
            `;
        }).join('');
        
        messagesArea.scrollTop = messagesArea.scrollHeight;
    } catch (err) {
        messagesArea.innerHTML = `<div class="empty-state">❌ Error: ${err.message}</div>`;
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
        btn.textContent = '📤 Kirim';
        btn.disabled = false;
        input.focus();
    }
}

async function loadGallery() {
    const galleryGrid = document.getElementById('galleryGrid');
    if (!galleryGrid) return;
    
    galleryGrid.innerHTML = '<div class="loading-spinner">🖼️ Memuat gallery...</div>';
    
    try {
        const { data, error } = await supabase
            .from('gallery')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            galleryGrid.innerHTML = '<div class="empty-state">🖼️ Belum ada gambar</div>';
            return;
        }
        
        galleryGrid.innerHTML = data.map(img => `
            <div class="gallery-item">
                <img src="${escapeHtml(img.image_url)}" 
                     onerror="this.src='https://via.placeholder.com/150?text=Gagal+Load'">
                <div class="note-date">${new Date(img.created_at).toLocaleDateString()}</div>
            </div>
        `).join('');
    } catch (err) {
        galleryGrid.innerHTML = `<div class="empty-state">❌ Error: ${err.message}</div>`;
    }
}

async function addGalleryImage() {
    const imageUrl = document.getElementById('imageUrl').value.trim();
    
    if (!imageUrl) {
        alert('Masukkan URL gambar!');
        return;
    }
    
    const btn = document.getElementById('addImageBtn');
    btn.textContent = '⏳ Menyimpan...';
    btn.disabled = true;
    
    try {
        const { error } = await supabase
            .from('gallery')
            .insert([{ image_url: imageUrl, created_at: new Date().toISOString() }]);
        
        if (error) throw error;
        
        document.getElementById('imageUrl').value = '';
        await loadGallery();
        alert('✅ Gambar berhasil ditambahkan!');
    } catch (err) {
        alert('❌ Gagal: ' + err.message);
    } finally {
        btn.textContent = '+ Tambah ke Gallery';
        btn.disabled = false;
    }
}

function setupRealtime() {
    supabase
        .channel('chat_messages_channel')
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

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            tabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            contents.forEach(c => c.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            
            if (tabId === 'notes') loadNotes();
            if (tabId === 'chat') loadMessages();
            if (tabId === 'gallery') loadGallery();
        });
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupRealtime();
    loadNotes();
    loadMessages();
    loadGallery();
    
    document.getElementById('addNoteBtn')?.addEventListener('click', addNote);
    document.getElementById('sendChatBtn')?.addEventListener('click', sendChatMessage);
    document.getElementById('addImageBtn')?.addEventListener('click', addGalleryImage);
    document.getElementById('chatInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('userId');
        window.location.href = 'index.html';
    });
});
