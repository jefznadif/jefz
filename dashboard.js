// ==================== CEK LOGIN ====================
if (!sessionStorage.getItem('isAuthenticated')) {
    alert('Silakan login terlebih dahulu!');
    window.location.href = 'index.html';
}

console.log('✅ Dashboard dimulai!');

// ==================== AMBIL ELEMEN ====================
const notesList = document.getElementById('notesList');
const messagesArea = document.getElementById('messagesArea');
const galleryGrid = document.getElementById('galleryGrid');

const noteTitle = document.getElementById('noteTitle');
const noteContent = document.getElementById('noteContent');
const chatInput = document.getElementById('chatInput');
const imageUrl = document.getElementById('imageUrl');

const addNoteBtn = document.getElementById('addNoteBtn');
const sendChatBtn = document.getElementById('sendChatBtn');
const addImageBtn = document.getElementById('addImageBtn');
const logoutBtn = document.getElementById('logoutBtn');

// ==================== DATA LOCAL (Pake Local Storage dulu biar pasti jalan) ====================
let notes = JSON.parse(localStorage.getItem('notes') || '[]');
let messages = JSON.parse(localStorage.getItem('messages') || '[]');
let gallery = JSON.parse(localStorage.getItem('gallery') || '[]');

let currentUserId = localStorage.getItem('userId');
if (!currentUserId) {
    currentUserId = 'user_' + Math.random().toString(36).substr(2, 6);
    localStorage.setItem('userId', currentUserId);
}

// ==================== FUNGSI CATATAN ====================
function loadNotes() {
    console.log('📝 Load notes, jumlah:', notes.length);
    
    if (notes.length === 0) {
        notesList.innerHTML = '<div class="empty-state">📭 Belum ada catatan. Klik + Tambah Catatan!</div>';
        return;
    }
    
    notesList.innerHTML = '';
    for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        const noteDiv = document.createElement('div');
        noteDiv.className = 'note-item';
        noteDiv.innerHTML = `
            <div class="note-title">📌 ${escapeHtml(note.title)}</div>
            <div class="note-content">${escapeHtml(note.content || '')}</div>
            <div class="note-date">${note.date || new Date().toLocaleString()}</div>
        `;
        notesList.appendChild(noteDiv);
    }
}

function addNote() {
    const title = noteTitle.value.trim();
    const content = noteContent.value.trim();
    
    console.log('📝 Menambah catatan:', title);
    
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
    
    noteTitle.value = '';
    noteContent.value = '';
    loadNotes();
    alert('✅ Catatan berhasil ditambahkan!');
}

// ==================== FUNGSI CHAT ====================
function loadMessages() {
    console.log('💬 Load messages, jumlah:', messages.length);
    
    if (messages.length === 0) {
        messagesArea.innerHTML = '<div class="empty-state">💬 Belum ada pesan. Kirim pesan pertama!</div>';
        return;
    }
    
    messagesArea.innerHTML = '';
    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const isSent = msg.userId === currentUserId;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
        messageDiv.innerHTML = `
            <div class="bubble">${escapeHtml(msg.text)}</div>
            <div class="message-time">${msg.time || new Date().toLocaleTimeString()}</div>
        `;
        messagesArea.appendChild(messageDiv);
    }
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function sendMessage() {
    const text = chatInput.value.trim();
    
    console.log('💬 Mengirim pesan:', text);
    
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
    
    chatInput.value = '';
    loadMessages();
}

// ==================== FUNGSI GALLERY ====================
function loadGallery() {
    console.log('🖼️ Load gallery, jumlah:', gallery.length);
    
    if (gallery.length === 0) {
        galleryGrid.innerHTML = '<div class="empty-state">🖼️ Belum ada gambar. Tambahkan URL gambar!</div>';
        return;
    }
    
    galleryGrid.innerHTML = '';
    for (let i = 0; i < gallery.length; i++) {
        const img = gallery[i];
        const imgDiv = document.createElement('div');
        imgDiv.className = 'gallery-item';
        imgDiv.innerHTML = `
            <img src="${escapeHtml(img.url)}" onerror="this.src='https://via.placeholder.com/150?text=Gagal+Load'">
            <div class="note-date">${img.date || new Date().toLocaleDateString()}</div>
        `;
        galleryGrid.appendChild(imgDiv);
    }
}

function addImage() {
    const url = imageUrl.value.trim();
    
    console.log('🖼️ Menambah gambar:', url);
    
    if (!url) {
        alert('Masukkan URL gambar!');
        return;
    }
    
    gallery.unshift({
        url: url,
        date: new Date().toLocaleDateString()
    });
    
    localStorage.setItem('gallery', JSON.stringify(gallery));
    
    imageUrl.value = '';
    loadGallery();
    alert('✅ Gambar berhasil ditambahkan!');
}

// ==================== TAB NAVIGASI ====================
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    
    console.log('🔘 Setup tabs, jumlah:', tabs.length);
    
    for (let i = 0; i < tabs.length; i++) {
        const btn = tabs[i];
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            console.log('🔘 Tab diklik:', tabId);
            
            // Hapus active dari semua tab
            for (let j = 0; j < tabs.length; j++) {
                tabs[j].classList.remove('active');
            }
            this.classList.add('active');
            
            // Sembunyikan semua content
            for (let j = 0; j < contents.length; j++) {
                contents[j].classList.remove('active');
            }
            
            // Tampilkan content yang dipilih
            const activeContent = document.getElementById(tabId);
            if (activeContent) {
                activeContent.classList.add('active');
            }
            
            // Refresh data
            if (tabId === 'notes') loadNotes();
            if (tabId === 'chat') loadMessages();
            if (tabId === 'gallery') loadGallery();
        });
    }
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

// ==================== LOGOUT ====================
function logout() {
    console.log('🚪 Logout');
    sessionStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userId');
    window.location.href = 'index.html';
}

// ==================== INIT ====================
function init() {
    console.log('🚀 Inisialisasi Dashboard...');
    setupTabs();
    loadNotes();
    loadMessages();
    loadGallery();
    
    addNoteBtn.addEventListener('click', addNote);
    sendChatBtn.addEventListener('click', sendMessage);
    addImageBtn.addEventListener('click', addImage);
    logoutBtn.addEventListener('click', logout);
    
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });
    
    console.log('✅ Dashboard siap!');
}

// Jalankan init saat halaman siap
init();
