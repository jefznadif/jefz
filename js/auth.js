// ========== AUTHENTICATION MODULE ==========

let currentAccount = null;
let pendingAccount = null;

// ========== ANIMATED ORB BACKGROUND ==========
(function initOrbBg() {
  const bg = document.getElementById('globalBg');
  if (!bg) return;
  const ORB_PALETTES = [
    ['#ff6eb4','#ff3cac'],['#60aaff','#007aff'],['#34d399','#06b6d4'],
    ['#fbbf24','#f97316'],['#c084fc','#8b5cf6'],['#fb7185','#f43f5e'],
    ['#86efac','#22c55e'],['#67e8f9','#38bdf8'],
  ];
  const NUM_ORBS = 8, orbs = [];
  for (let i = 0; i < NUM_ORBS; i++) {
    const el = document.createElement('div');
    el.className = 'g-orb'; bg.appendChild(el);
    const palette = ORB_PALETTES[i % ORB_PALETTES.length];
    const size = 160 + Math.random() * 220, blur = size * 0.28;
    el.style.cssText = ['width:'+size+'px','height:'+size+'px','filter:blur('+blur+'px)','background:radial-gradient(circle at 40% 40%,'+palette[0]+','+palette[1]+')','will-change:transform,opacity'].join(';');
    const startX = Math.random()*100, startY = Math.random()*100, baseOpacity = 0.38+Math.random()*0.28;
    orbs.push({ el, x:startX, y:startY, vx:(Math.random()-0.5)*0.16, vy:(Math.random()-0.5)*0.16, scaleBase:1, scaleAmp:0.10+Math.random()*0.12, scaleFreq:0.0012+Math.random()*0.0010, opBase:baseOpacity, opAmp:0.08+Math.random()*0.10, opFreq:0.0010+Math.random()*0.0008, phase:Math.random()*Math.PI*2 });
  }
  let lastTime = performance.now();
  function tick(now) {
    const dt = Math.min(now - lastTime, 50); lastTime = now;
    for (const orb of orbs) {
      orb.x += orb.vx*dt*0.016; orb.y += orb.vy*dt*0.016;
      if (orb.x < -5)  { orb.x = -5;   orb.vx =  Math.abs(orb.vx)*(0.7+Math.random()*0.3); }
      if (orb.x > 105) { orb.x = 105;  orb.vx = -Math.abs(orb.vx)*(0.7+Math.random()*0.3); }
      if (orb.y < -5)  { orb.y = -5;   orb.vy =  Math.abs(orb.vy)*(0.7+Math.random()*0.3); }
      if (orb.y > 105) { orb.y = 105;  orb.vy = -Math.abs(orb.vy)*(0.7+Math.random()*0.3); }
      if (Math.random() < 0.005) { orb.vx += (Math.random()-0.5)*0.04; orb.vy += (Math.random()-0.5)*0.04; const spd=Math.hypot(orb.vx,orb.vy); if(spd>0.20){orb.vx*=0.20/spd;orb.vy*=0.20/spd;} }
      const t = now*orb.scaleFreq+orb.phase;
      const scale = orb.scaleBase+Math.sin(t)*orb.scaleAmp;
      const op    = orb.opBase+Math.sin(now*orb.opFreq+orb.phase+1)*orb.opAmp;
      orb.el.style.left      = orb.x + 'vw';
      orb.el.style.top       = orb.y + 'vh';
      orb.el.style.transform = 'translate(-50%,-50%) scale('+scale+')';
      orb.el.style.opacity   = Math.max(0.12, Math.min(0.75, op));
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

// ========== ACCOUNT SELECTION - LANGSUNG TANPA DELAY ==========
function selectAccount(name, role) {
  // Langsung tampilkan step PIN tanpa fetch dulu
  pendingAccount = { name, role, color: name === "Jef'z" ? '#007aff' : '#e91e8c' };

  const avatarColor = pendingAccount.color;

  document.getElementById('stepAccount').style.display = 'none';
  document.getElementById('stepPin').style.display     = 'block';

  document.getElementById('selectedAccInfo').innerHTML =
    '<div class="sel-acc">' +
    '<div class="acc-avatar-lg" style="background:' + avatarColor + '">' + name.charAt(0).toUpperCase() + '</div>' +
    '<div><div class="sel-name">' + name + '</div>' +
    '<div class="sel-role">' + (role === 'admin' ? '👑 Admin' : '👤 User') + '</div></div></div>';

  const pinInput = document.getElementById('pinInput');
  pinInput.value = '';
  document.getElementById('loginErr').textContent = '';
  setTimeout(() => pinInput.focus(), 80);

  pinInput.onkeydown = function(e) { if (e.key === 'Enter') doLogin(); };

  // Fetch warna asli dari Supabase di background (tidak blocking UI)
  getAccountColor(name).then(color => {
    if (pendingAccount && pendingAccount.name === name) {
      pendingAccount.color = color;
      // Update avatar kalau warna berbeda
      const avatarEl = document.querySelector('.acc-avatar-lg');
      if (avatarEl) avatarEl.style.background = color;
    }
  });
}

function backToAccount() {
  pendingAccount = null;
  document.getElementById('stepPin').style.display    = 'none';
  document.getElementById('stepAccount').style.display = 'block';
  document.getElementById('pinInput').value = '';
  document.getElementById('loginErr').textContent = '';
}

// ========== GET ACCOUNT COLOR ==========
async function getAccountColor(username) {
  try {
    const { data, error } = await sb.from('accounts').select('avatar_color').eq('username', username).single();
    if (error || !data) return username === "Jef'z" ? '#007aff' : '#e91e8c';
    return data.avatar_color;
  } catch { return '#3d5afe'; }
}

// ========== LOGIN - dengan indikator "Memeriksa PIN..." ==========
async function doLogin() {
  const pin   = document.getElementById('pinInput').value;
  const errEl = document.getElementById('loginErr');
  errEl.textContent = '';

  if (!pin)           { errEl.textContent = 'Masukkan PIN terlebih dahulu'; return; }
  if (!pendingAccount) return;

  // Tampilkan indikator checking
  const submitBtn = document.querySelector('.pin-submit');
  const originalContent = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span style="font-size:12px">...</span>'; }
  errEl.textContent = 'Memeriksa PIN...';
  errEl.style.color = 'var(--text3)';

  try {
    const { data: isValid, error } = await sb.rpc('verify_pin', {
      p_username: pendingAccount.name,
      p_pin:      pin
    });

    if (error) {
      errEl.textContent = 'Terjadi kesalahan. Coba lagi.';
      errEl.style.color = '';
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalContent; }
      return;
    }

    if (isValid === true) {
      errEl.textContent = '✓ PIN benar, masuk...';
      errEl.style.color = '#34c759';

      // Buat session
      const { data: tokenData, error: sessionError } = await sb.rpc('create_session', { p_username: pendingAccount.name });
      if (sessionError) { errEl.textContent = 'Gagal membuat session'; errEl.style.color = ''; if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalContent; } return; }

      // Ambil data akun
      const { data: accountData } = await sb.from('accounts').select('*').eq('username', pendingAccount.name).single();

      currentAccount = {
        name:        pendingAccount.name,
        role:        accountData ? accountData.role        : pendingAccount.role,
        color:       accountData ? accountData.avatar_color : pendingAccount.color,
        displayName: accountData ? accountData.display_name : pendingAccount.name
      };

      sessionStorage.setItem('auth',         '1');
      sessionStorage.setItem('authTime',     Date.now().toString());
      sessionStorage.setItem('accName',      currentAccount.name);
      sessionStorage.setItem('accRole',      currentAccount.role);
      sessionStorage.setItem('accColor',     currentAccount.color);
      sessionStorage.setItem('accDisplayName', currentAccount.displayName);
      sessionStorage.setItem('sessionToken', tokenData);
      sessionStorage.setItem('activeTab',    'Chat');

      document.getElementById('pinInput').value = '';
      window.location.href = 'dashboard.html';

    } else {
      errEl.textContent = 'PIN salah, coba lagi';
      errEl.style.color = '';
      document.getElementById('pinInput').value = '';
      document.getElementById('pinInput').focus();
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalContent; }
    }
  } catch (err) {
    errEl.textContent = 'Terjadi kesalahan. Coba lagi.';
    errEl.style.color = '';
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalContent; }
  }
}

// ========== CHECK EXISTING SESSION ==========
async function checkSession() {
  const auth         = sessionStorage.getItem('auth');
  const accName      = sessionStorage.getItem('accName');
  const sessionToken = sessionStorage.getItem('sessionToken');
  const authTime     = sessionStorage.getItem('authTime');

  if (!auth || !accName || !sessionToken || !authTime) return;
  if (Date.now() - parseInt(authTime) > 86400000) { sessionStorage.clear(); return; }

  try {
    const { data, error } = await sb
      .from('user_sessions')
      .select('id')
      .eq('session_token', sessionToken)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (data && !error) window.location.href = 'dashboard.html';
    else sessionStorage.clear();
  } catch { sessionStorage.clear(); }
}

// ========== INIT ==========
window.onload = function() { checkSession(); };
