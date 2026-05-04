// ==================== KONFIGURASI SUPABASE ====================
const SUPABASE_URL = 'https://cxlvnwbfdbymdoddjqwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4bHZud2JmZGJ5bWRvZGRqcXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDUwOTMsImV4cCI6MjA5MzQ4MTA5M30.9jGx6eY7qzvQzW65xD7gVOMP1YZQzKjULginFNwSV-k';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== VERIFIKASI PIN ====================
window.verifyPin = async (pin) => {
    try {
        // Ambil PIN dari tabel 'app_config'
        const { data, error } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', 'access_pin')
            .single();
        
        if (error) {
            console.error('Error mengambil PIN:', error);
            // Fallback: PIN default 123456 jika tabel belum ada
            return pin === '123456';
        }
        
        return data && data.value === pin;
    } catch (err) {
        console.error(err);
        return false;
    }
};

// ==================== FUNGSI CATATAN (NOTES) ====================
async function loadNotes() {
    const notesList = document.getElementById('notesList');
    if (!notesList) return;
    
    notesList.innerHTML = 'Loading...';
    
    const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        notesList.innerHTML = 'Gagal memuat catatan: ' + error.message;
        console.error(error);
        return;
    }
    
    if (!data || data.length === 0) {
        notesList.innerHTML = '<div style="text-align:center;color:#888;">📭 Belum ada catatan. Buat catatan pertama!</div>';
        return;
    }
    
    notesList.innerHTML = data.map(note => `
        <div class="note-item">
            <div class="note-title">📌 ${escapeHtml(note.title)}</div>
            <div class="note-content">${escapeHtml(note.content || '')}</div>
            <div class="note-date">${new Date(note.created_at).toLocaleString()}</div>
        </div>
    `).join('');
}

async function addNote() {
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    
    if (!title) {
        alert('Judul catatan tidak boleh kosong!');
        return;
    }
    
    const { error } = await supabase
        .from('notes')
        .insert([{ 
            title: title, 
            content: content, 
            created_at: new Date().toISOString() 
        }]);
    
    if (error) {
        alert('Gagal menambah catatan: ' + error.message);
        return;
    }
    
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteContent').value = '';
    loadNotes();
}

// ==================== FUNGSI CHAT ROOM ====================
async function loadMessages() {
    const messagesArea = document.getElementById('messagesArea');
    if (!messagesArea) return;
    
    messagesArea.innerHTML = '💬 Loading pesan...';
    
    const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true });
    
    if (error) {
        messagesArea.innerHTML = 'Gagal memuat pesan: ' + error.message;
        console.error(error);
        return;
    }
    
    if (!data || data.length === 0) {
        messagesArea.innerHTML = '<div style="text-align:center;color:#888;">💬 Belum ada pesan. Mulai chatting!</div>';
        return;
    }
    
    // Dapatkan atau buat user ID untuk sesi ini
    let currentUserId = sessionStorage.getItem('userId');
    if (!currentUserId) {
        currentUserId = 'user_' + Math.random().toString(36).substr(2, 8);
        sessionStorage.setItem('userId', currentUserId);
    }
    
    messagesArea.innerHTML = data.map(msg => {
        const isSent = msg.user_id === currentUserId;
        return `
            <div class="message ${isSent ? 'sent' : 'received'}">
                <div class="bubble">${escapeHtml(msg.message)}</div>
                <div style="font-size:0.7rem; margin-top:4px; color:#888;">
                    ${new Date(msg.created_at).toLocaleTimeString()}
                </div>
            </div>
        `;
    }).join('');
    
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;
    
    let currentUserId = sessionStorage.getItem('userId');
    if (!currentUserId) {
        currentUserId = 'user_' + Math.random().toString(36).substr(2, 8);
        sessionStorage.setItem('userId', currentUserId);
    }
    
    const { error } = await supabase
        .from('chat_messages')
        .insert([{
            message: message,
            user_id: currentUserId,
            created_at: new Date().toISOString()
        }]);
    
    if (error) {
        alert('Gagal mengirim pesan: ' + error.message);
        return;
    }
    
    input.value = '';
    loadMessages();
}

// ==================== FUNGSI GALLERY ====================
async function loadGallery() {
    const galleryGrid = document.getElementById('galleryGrid');
    if (!galleryGrid) return;
    
    galleryGrid.innerHTML = '🖼️ Loading gallery...';
    
    const { data, error } = await supabase
        .from('gallery')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        galleryGrid.innerHTML = 'Gagal memuat gallery: ' + error.message;
        console.error(error);
        return;
    }
    
    if (!data || data.length === 0) {
        galleryGrid.innerHTML = '<div style="text-align:center;color:#888; grid-column:1/-1;">🖼️ Belum ada gambar. Tambahkan URL gambar!</div>';
        return;
    }
    
    galleryGrid.innerHTML = data.map(img => `
        <div class="gallery-item">
            <img src="${escapeHtml(img.image_url)}" alt="Gallery" onerror="this.src='https://via.placeholder.com/150?text=Invalid+URL'">
            <div style="font-size:0.7rem; margin-top:5px; color:#888;">${new Date(img.created_at).toLocaleDateString()}</div>
        </div>
    `).join('');
}

async function addGalleryImage() {
    const imageUrl = document.getElementById('imageUrl').value.trim();
    if (!imageUrl) {
        alert('Masukkan URL gambar!');
        return;
    }
    
    // Validasi sederhana URL
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        alert('URL harus dimulai dengan http:// atau https://');
        return;
    }
    
    const { error } = await supabase
        .from('gallery')
        .insert([{
            image_url: imageUrl,
            created_at: new Date().toISOString()
        }]);
    
    if (error) {
        alert('Gagal menambah gambar: ' + error.message);
        return;
    }
    
    document.getElementById('imageUrl').value = '';
    loadGallery();
}

// ==================== REALTIME SUBSCRIBE ====================
window.setupRealtimeSubscription = () => {
    // Subscribe ke perubahan tabel chat_messages
    supabase
        .channel('chat_messages_channel')
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'chat_messages' }, 
            (payload) => {
                console.log('Pesan baru:', payload);
                const activeTab = document.querySelector('.tab-btn.active');
                if (activeTab && activeTab.dataset.tab === 'chat') {
                    loadMessages();
                }
            }
        )
        .subscribe((status) => {
            console.log('Chat subscription status:', status);
        });
    
    // Subscribe ke notes
    supabase
        .channel('notes_channel')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'notes' }, 
            () => {
                const activeTab = document.querySelector('.tab-btn.active');
                if (activeTab && activeTab.dataset.tab === 'notes') loadNotes();
            }
        )
        .subscribe();
    
    // Subscribe ke gallery
    supabase
        .channel('gallery_channel')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'gallery' }, 
            () => {
                const activeTab = document.querySelector('.tab-btn.active');
                if (activeTab && activeTab.dataset.tab === 'gallery') loadGallery();
            }
        )
        .subscribe();
};

// Helper function untuk menghindari XSS
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
