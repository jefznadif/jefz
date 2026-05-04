// ==================== KONFIGURASI SUPABASE ====================
const SUPABASE_URL = 'https://cxlvnwbfdbymdoddjqwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4bHZud2JmZGJ5bWRvZGRqcXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDUwOTMsImV4cCI6MjA5MzQ4MTA5M30.9jGx6eY7qzvQzW65xD7gVOMP1YZQzKjULginFNwSV-k';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== VERIFIKASI PIN ====================
async function verifyPin(pin) {
    const statusMsg = document.getElementById('statusMsg');
    
    try {
        statusMsg.innerHTML = '🔄 Menghubungi server...';
        
        // Coba ambil PIN dari database
        const { data, error } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', 'access_pin')
            .single();
        
        if (error) {
            console.log('Tabel belum ada, pakai PIN default');
            statusMsg.innerHTML = '⚠️ Menggunakan PIN default (123456)';
            return pin === '123456';
        }
        
        if (data && data.value === pin) {
            statusMsg.innerHTML = '✅ PIN valid! Mengarahkan...';
            return true;
        }
        
        statusMsg.innerHTML = '❌ PIN salah!';
        return false;
        
    } catch (err) {
        console.error('Error:', err);
        statusMsg.innerHTML = '⚠️ Error: ' + err.message;
        return pin === '123456';
    }
}

// ==================== EVENT HANDLER ====================
document.addEventListener('DOMContentLoaded', () => {
    const pinInput = document.getElementById('pinInput');
    const verifyBtn = document.getElementById('verifyBtn');
    const errorMsg = document.getElementById('errorMsg');
    const statusMsg = document.getElementById('statusMsg');
    
    console.log('✅ Halaman PIN siap!');
    statusMsg.innerHTML = '✅ Siap menerima PIN';
    
    async function handleVerify() {
        const pin = pinInput.value.trim();
        
        if (!pin) {
            errorMsg.textContent = 'PIN tidak boleh kosong!';
            errorMsg.style.display = 'block';
            setTimeout(() => {
                errorMsg.style.display = 'none';
            }, 2000);
            return;
        }
        
        verifyBtn.disabled = true;
        verifyBtn.textContent = '⏳ Memverifikasi...';
        errorMsg.style.display = 'none';
        
        try {
            const isValid = await verifyPin(pin);
            
            if (isValid) {
                sessionStorage.setItem('isAuthenticated', 'true');
                statusMsg.innerHTML = '✅ Berhasil! Mengalihkan...';
                
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 500);
            } else {
                errorMsg.textContent = 'PIN salah! Silakan coba lagi.';
                errorMsg.style.display = 'block';
                pinInput.value = '';
                pinInput.focus();
                statusMsg.innerHTML = '❌ Verifikasi gagal';
            }
        } catch (err) {
            errorMsg.textContent = 'Error: ' + err.message;
            errorMsg.style.display = 'block';
            statusMsg.innerHTML = '❌ Error: ' + err.message;
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verifikasi & Masuk';
        }
    }
    
    verifyBtn.addEventListener('click', handleVerify);
    pinInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleVerify();
    });
    
    pinInput.focus();
});
