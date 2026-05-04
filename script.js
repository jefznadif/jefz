const SUPABASE_URL = 'https://cxlvnwbfdbymdoddjqwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4bHZud2JmZGJ5bWRvZGRqcXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDUwOTMsImV4cCI6MjA5MzQ4MTA5M30.9jGx6eY7qzvQzW65xD7gVOMP1YZQzKjULginFNwSV-k';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyPin(pin) {
    const statusMsg = document.getElementById('statusMsg');
    
    try {
        statusMsg.innerHTML = '🔄 Menghubungi server...';
        
        const { data, error } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', 'access_pin')
            .single();
        
        if (error) {
            return pin === '123456';
        }
        
        return data && data.value === pin;
    } catch (err) {
        return pin === '123456';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const pinInput = document.getElementById('pinInput');
    const verifyBtn = document.getElementById('verifyBtn');
    const errorMsg = document.getElementById('errorMsg');
    const statusMsg = document.getElementById('statusMsg');
    
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
        
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verifikasi & Masuk';
    }
    
    verifyBtn.addEventListener('click', handleVerify);
    pinInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleVerify();
    });
    
    pinInput.focus();
});
