document.addEventListener('DOMContentLoaded', function() {
    const pinInput = document.getElementById('pinInput');
    const verifyBtn = document.getElementById('verifyBtn');
    const messageBox = document.getElementById('messageBox');
    
    function showMessage(text, type) {
        messageBox.textContent = text;
        messageBox.className = 'message-box ' + type;
    }
    
    function verifyPin() {
        const pin = pinInput.value.trim();
        
        if (!pin) {
            showMessage('PIN tidak boleh kosong!', 'error');
            return;
        }
        
        if (pin === '123456') {
            showMessage('✅ PIN benar! Mengalihkan...', 'success');
            sessionStorage.setItem('isAuthenticated', 'true');
            
            setTimeout(function() {
                window.location.href = 'dashboard.html';
            }, 500);
        } else {
            showMessage('❌ PIN salah! Gunakan PIN: 123456', 'error');
            pinInput.value = '';
            pinInput.focus();
        }
    }
    
    verifyBtn.addEventListener('click', verifyPin);
    pinInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') verifyPin();
    });
    
    pinInput.focus();
});
