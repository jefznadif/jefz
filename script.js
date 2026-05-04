const SUPABASE_URL = 'https://cxlvnwbfdbymdoddjqwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4bHZud2JmZGJ5bWRvZGRqcXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDUwOTMsImV4cCI6MjA5MzQ4MTA5M30.9jGx6eY7qzvQzW65xD7gVOMP1YZQzKjULginFNwSV-k';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Langsung verifikasi tanpa cek database dulu
async function verifyPin(pin) {
    const statusMsg = document.getElementById('statusMsg');
    
    // TAMPILKAN PESAN
    statusMsg.innerHTML = '🔄 Memverifikasi PIN...';
    statusMsg.style.color = '#f39c12';
    
    // PIN yang valid (default 123456)
    const validPin = '123456';
    
    // Simulasi delay biar keliatan prosesny// SIMPLE PIN VERIFICATION - LANGSUNG BERFUNGSI
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Halaman PIN siap!');
    
    const pinInput = document.getElementById('pinInput');
    const verifyBtn = document.getElementById('verifyBtn');
    const messageBox = document.getElementById('messageBox');
    
    function showMessage(text, type) {
        messageBox.textContent = text;
        messageBox.className = 'message-box ' + type;
    }
    
    function verifyPin() {
        const pin = pinInput.value.trim();
        
        console.log('PIN yang dimasukkan:', pin);
        
        if (!pin) {
            showMessage('PIN tidak boleh kosong!', 'error');
            return;
        }
        
        // PIN yang benar adalah 123456
        if (pin === '123456') {
            showMessage('✅ PIN benar! Mengalihkan...', 'success');
            
            // Simpan status login
            sessionStorage.setItem('isAuthenticated', 'true');
            
            // Redirect ke dashboard
            setTimeout(function() {
                window.location.href = 'dashboard.html';
            }, 1000);
        } else {
            showMessage('❌ PIN salah! Gunakan PIN: 123456', 'error');
            pinInput.value = '';
            pinInput.focus();
        }
    }
    
    verifyBtn.addEventListener('click', verifyPin);
    pinInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            verifyPin();
        }
    });
    
    pinInput.focus();
});
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (pin === validPin) {
        statusMsg.innerHTML = '✅ PIN benar! Mengalihkan...';
        statusMsg.style.color = '#27ae60';
        return true;
    } else {
        statusMsg.innerHTML = '❌ PIN salah! Coba 123456';
        statusMsg.style.color = '#e74c3c';
        return false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Halaman PIN siap!');
    
    const pinInput = document.getElementById('pinInput');
    const verifyBtn = document.getElementById('verifyBtn');
    const errorMsg = document.getElementById('errorMsg');
    const statusMsg = document.getElementById('statusMsg');
    
    // Set status awal
    statusMsg.innerHTML = '✅ Masukkan PIN: 123456';
    statusMsg.style.color = '#27ae60';
    
    async function handleVerify() {
        const pin = pinInput.value.trim();
        
        // Reset pesan error
        errorMsg.style.display = 'none';
        
        if (!pin) {
            errorMsg.textContent = 'PIN tidak boleh kosong!';
            errorMsg.style.display = 'block';
            return;
        }
        
        // Disable button
        verifyBtn.disabled = true;
        verifyBtn.textContent = '⏳ Memverifikasi...';
        
        const isValid = await verifyPin(pin);
        
        if (isValid) {
            // Simpan session
            sessionStorage.setItem('isAuthenticated', 'true');
            
            // Redirect ke dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 800);
        } else {
            errorMsg.textContent = 'PIN salah! Gunakan PIN: 123456';
            errorMsg.style.display = 'block';
            pinInput.value = '';
            pinInput.focus();
        }
        
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verifikasi & Masuk';
    }
    
    // Event listeners
    verifyBtn.addEventListener('click', handleVerify);
    pinInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleVerify();
    });
    
    // Auto focus
    pinInput.focus();
});
