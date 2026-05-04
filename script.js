// SIMPLE PIN VERIFICATION - LANGSUNG BERFUNGSI
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
