// DASHBOARD WITH LOCAL STORAGE (LANGSUNG BERFUNGSI)

// Cek autentikasi
if (!sessionStorage.getItem('isAuthenticated')) {
    alert('Silakan login terlebih dahulu!');
    window.location.href = 'index.html';
}

// Inisialisasi data dari Local Storage
let notes = JSON.parse(localStorage.getItem('notes') || '[]');
let messages = JSON.parse(localStorage.getItem('messages') || '[]');
let gallery = JSON.parse(localStorage.getItem('gallery') || '[]');

let currentUserId = sessionStorage.getItem('userId');
if (!currentUserId) {
    currentUserId = 'user_' + Math.random().toString(36).substr(2, 6);
    sessionStorage.setItem('userId', currentUserId);
}

// ==================== FUNGSI CATATAN ====================
function loadNotes() {
    const notesList = document.getElementById('notesList');
    
    if (notes.length === 0) {
        notesList.innerHTML = '<div class="empty-state">📭 Belum ada catatan</div>';
        return;
    }
    
    notesList.innerHTML = notes.map((note, index) => `
        <div class="note-item">
            <div class="note-title">📌 ${escapeHtml(note.title)}</div>
            <div class="note-content">${escapeHtml(note.content)}</div>
            <div class="note-date">${note.date}</div>
        </div>
    `).join('');
}

function addNote() {
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    
    if (!title) {
        alert('Judul catatan tidak boleh kosong!');
        return;
    }
    
    notes.unshift({
        title: title,
        content: content,
        date: new Date().toLocaleString()
    });
    
    localStorage.setItem('notes', JSON.stringify(notes));
    
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteContent').value = '';
    loadNotes();
    alert('✅ Catatan berhasil ditambahkan!');
}

// ==================== FUNGSI CHAT ====================
function loadMessages() {
    const messagesArea = document.getElementById('messagesArea');
    
    if (messages.length === 0) {
        messagesArea.innerHTML = '<div class="empty-state">💬 Belum ada pesan. Mulai chatting!</div>';
        return;
    }
    
    messagesArea.innerHTML = messages.map(msg => {
        const isSent = msg.userId === currentUserId;
        return `
            <div class="message ${isSent ? 'sent' : 'received'}">
                <div class="bubble">${escapeHtml(msg.text)}</div>
                <div class="message-time">${msg.time}</div>
            </div>
        `;
    }).join('');
    
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    
    if (!text) {
        alert('Pesan tidak boleh kosong!');
        return;
    }
    
    messages.push({
        text: text,
        userId: currentUserId,
        time: new Date().toLocaleTimeString()
    });
    
    localStorage.setItem('messages', JSON.stringify(messages));
    
    input.value = '';
    loadMessages();
}

// ==================== FUNGSI GALLERY ====================
function loadGallery() {
    const galleryGrid = document.getElementById('galleryGrid');
    
    if (gallery.length === 0) {
        galleryGrid.innerHTML = '<div class="empty-state">🖼️ Belum ada gambar</div>';
        return;
    }
    
    galleryGrid.innerHTML = gallery.map(img => `
        <div class="gallery-item">
            <img src="${escapeHtml(img.url)}" onerror="this.src='https://via.placeholder.com/150?text=Gagal+Load'">
            <div class="note-date">${img.date}</div>
        </div>
    `).join('');
}

function addImage() {
    const url = document.getElementById('imageUrl').value.trim();
    
    if (!url) {
        alert('Masukkan URL gambar!');
        return;
    }
    
    gallery.unshift({
        url: url,
        date: new Date().toLocaleDateString()
    });
    
    localStorage.setItem('gallery', JSON.stringify(gallery));
    
    document.getElementById('imageUrl').value = '';
    loadGallery();
    alert('✅ Gambar berhasil ditambahkan!');
}

// ==================== TAB NAVIGATION ====================
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

// ==================== HELPER ====================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Dashboard siap!');
    console.log('User ID:', currentUserId);
    
    setupTabs();
    loadNotes();
    loadMessages();
    loadGallery();
    
    document.getElementById('addNoteBtn').addEventListener('click', addNote);
    document.getElementById('sendChatBtn').addEventListener('click', sendMessage);
    document.getElementById('addImageBtn').addEventListener('click', addImage);
    
    document.getElementById('chatInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });
    
    document.getElementById('logoutBtn').addEventListener('click', function() {
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('userId');
        window.location.href = 'index.html';
    });
});
