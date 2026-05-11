// ========== SUPABASE ==========
const SB_URL = 'https://cxlvnwbfdbymdoddjqwn.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4bHZud2JmZGJ5bWRvZGRqcXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDUwOTMsImV4cCI6MjA5MzQ4MTA5M30.9jGx6eY7qzvQzW65xD7gVOMP1YZQzKjULginFNwSV-k';
const sb = window.supabase.createClient(SB_URL, SB_KEY);

// ========== ACCOUNTS ==========
const ACCOUNTS = {
  'Ndifaa': { pin: '1408', role: 'user',  color: '#e91e8c' },
  "Jef'z":  { pin: 'zz',   role: 'admin', color: '#3d5afe' }
};

// ========== STATE ==========
let currentAccount = null;
let dark = localStorage.getItem('theme') === 'dark';
let uid = localStorage.getItem('uid');
if (!uid) { uid = 'u_' + Math.random().toString(36).slice(2,10); localStorage.setItem('uid', uid); }

let chatChannel = null;
let isChatActive = false;
let chatLoaded = false;
let seenMsgIds = new Set();
let pollTimer = null;
let countdownTimer = null;
let notesLoaded = false;
let galleryLoaded = false;

let replyTarget = null;
let emojiPickerOpen = false;

// multi-select (chat)
let selectedMsgIds = new Set();
let selectionModeActive = false;

// multi-select (notes)
let selectedNoteIds = new Set();
let noteSelectionModeActive = false;

// upload
let pendingUploadFile = null;
let uploadXHR = null;

// ========== CUSTOM CONFIRM MODAL ==========
let _confirmResolve = null;

function showConfirm(msg, opts) {
  opts = opts || {};
  return new Promise(function(resolve) {
    _confirmResolve = resolve;
    var el = document.getElementById('confirmModal');
    document.getElementById('confirmIcon').textContent = opts.icon || '⚠️';
    document.getElementById('confirmTitle').textContent = opts.title || 'Konfirmasi';
    document.getElementById('confirmMsg').textContent = msg;
    var okBtn = document.getElementById('confirmOkBtn');
    var cancelBtn = document.getElementById('confirmCancelBtn');
    okBtn.textContent = opts.okText || 'Ya';
    cancelBtn.textContent = opts.cancelText || 'Batal';
    okBtn.className = 'confirm-btn-ok' + (opts.safe ? ' safe' : '');
    okBtn.onclick = function() { el.classList.remove('show'); _confirmResolve && _confirmResolve(true); _confirmResolve = null; };
    cancelBtn.onclick = function() { el.classList.remove('show'); _confirmResolve && _confirmResolve(false); _confirmResolve = null; };
    el.classList.add('show');
  });
}

// ========== ANIMATED ORB BACKGROUND ==========
(function initOrbBg() {
  const bg = document.getElementById('globalBg');
  if (!bg) return;
  const ORB_PALETTES = [
    ['#ff6eb4','#ff3cac'],['#60aaff','#007aff'],['#34d399','#06b6d4'],
    ['#fbbf24','#f97316'],['#c084fc','#8b5cf6'],['#fb7185','#f43f5e'],
    ['#86efac','#22c55e'],['#67e8f9','#38bdf8'],
  ];
  const NUM_ORBS = 8;
  const orbs = [];
  for (let i = 0; i < NUM_ORBS; i++) {
    const el = document.createElement('div');
    el.className = 'g-orb';
    bg.appendChild(el);
    const palette = ORB_PALETTES[i % ORB_PALETTES.length];
    const size = 160 + Math.random() * 220;
    const blur = size * 0.28;
    el.style.cssText = ['width:'+size+'px','height:'+size+'px','filter:blur('+blur+'px)','background:radial-gradient(circle at 40% 40%,'+palette[0]+','+palette[1]+')','will-change:transform,opacity'].join(';');
    const startX = Math.random() * 100, startY = Math.random() * 100;
    const baseOpacity = 0.38 + Math.random() * 0.28;
    orbs.push({ el, x:startX, y:startY, vx:(Math.random()-0.5)*0.16, vy:(Math.random()-0.5)*0.16, scaleBase:1, scaleAmp:0.10+Math.random()*0.12, scaleFreq:0.0012+Math.random()*0.0010, opBase:baseOpacity, opAmp:0.08+Math.random()*0.10, opFreq:0.0010+Math.random()*0.0008, phase:Math.random()*Math.PI*2 });
  }
  let lastTime = performance.now();
  function tick(now) {
    const dt = Math.min(now - lastTime, 50); lastTime = now;
    for (const orb of orbs) {
      orb.x += orb.vx * dt * 0.016; orb.y += orb.vy * dt * 0.016;
      if (orb.x < -5)  { orb.x = -5;  orb.vx =  Math.abs(orb.vx)*(0.7+Math.random()*0.3); }
      if (orb.x > 105) { orb.x = 105; orb.vx = -Math.abs(orb.vx)*(0.7+Math.random()*0.3); }
      if (orb.y < -5)  { orb.y = -5;  orb.vy =  Math.abs(orb.vy)*(0.7+Math.random()*0.3); }
      if (orb.y > 105) { orb.y = 105; orb.vy = -Math.abs(orb.vy)*(0.7+Math.random()*0.3); }
      if (Math.random() < 0.005) {
        orb.vx += (Math.random()-0.5)*0.04; orb.vy += (Math.random()-0.5)*0.04;
        const spd = Math.hypot(orb.vx, orb.vy);
        if (spd > 0.20) { orb.vx *= 0.20/spd; orb.vy *= 0.20/spd; }
      }
      const t = now * orb.scaleFreq + orb.phase;
      const scale = orb.scaleBase + Math.sin(t) * orb.scaleAmp;
      const op    = orb.opBase   + Math.sin(now * orb.opFreq + orb.phase + 1) * orb.opAmp;
      orb.el.style.left      = orb.x + 'vw';
      orb.el.style.top       = orb.y + 'vh';
      orb.el.style.transform = 'translate(-50%,-50%) scale('+scale+')';
      orb.el.style.opacity   = Math.max(0.12, Math.min(0.75, op));
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

// ========== COUNTDOWN ==========
function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  var targetDate = new Date("2024-03-18T00:00:00");
  targetDate.setFullYear(targetDate.getFullYear() + 3);
  function tick() {
    var now = new Date(), isCountdown = now < targetDate;
    var from = isCountdown ? now : targetDate, to = isCountdown ? targetDate : now;
    var years=to.getFullYear()-from.getFullYear(), months=to.getMonth()-from.getMonth();
    var days=to.getDate()-from.getDate(), hours=to.getHours()-from.getHours();
    var minutes=to.getMinutes()-from.getMinutes(), seconds=to.getSeconds()-from.getSeconds();
    if (seconds<0){seconds+=60;minutes--;} if (minutes<0){minutes+=60;hours--;}
    if (hours<0){hours+=24;days--;} if (days<0){var lm=new Date(to.getFullYear(),to.getMonth(),0);days+=lm.getDate();months--;}
    if (months<0){months+=12;years--;}
    var labelEl=document.getElementById('countdownLabel'), valEl=document.getElementById('countdown');
    if (!labelEl||!valEl) return;
    labelEl.textContent = isCountdown ? "Menuju 18 Maret 2027 ♡" : "Sudah bersama selama ♡";
    valEl.innerHTML =
      seg(years,'Thn') + seg(months,'Bln') + seg(days,'Hari') +
      '<br>' +
      seg(hours,'Jam') + seg(minutes,'Mnt') + seg(seconds,'Dtk');
  }
  function seg(n, unit) {
    return '<span class="cd-seg"><span class="cd-num">' + pad(n) + '</span><span class="cd-unit">' + unit + '</span></span>';
  }
  function pad(n) { return n < 10 ? '0'+n : n; }
  tick(); countdownTimer = setInterval(tick, 1000);
}
function stopCountdown() { if (countdownTimer){clearInterval(countdownTimer);countdownTimer=null;} }

// ========== KEYBOARD AWARE MODAL ==========
function getVisibleHeight() { return window.visualViewport ? window.visualViewport.height : window.innerHeight; }
function adjustOpenModals() {
  var vh=getVisibleHeight(), maxH=Math.floor(vh*0.92);
  document.querySelectorAll('.modal-overlay.show:not(#editModal) .modal-box').forEach(function(box){box.style.maxHeight=maxH+'px';});
  if (document.getElementById('editModal').classList.contains('show')) _adjustEditModal();
}
function _adjustEditModal() {
  var overlay=document.getElementById('editModal'), box=document.getElementById('editModalBox');
  if (!overlay||!box) return;
  var vp=window.visualViewport;
  if (vp) {
    overlay.style.position='fixed'; overlay.style.top=vp.offsetTop+'px'; overlay.style.left=vp.offsetLeft+'px';
    overlay.style.width=vp.width+'px'; overlay.style.height=vp.height+'px'; overlay.style.bottom='auto';
    box.style.maxHeight=Math.floor(vp.height*0.94)+'px';
  } else {
    overlay.style.top='0'; overlay.style.height=window.innerHeight+'px';
    box.style.maxHeight=Math.floor(window.innerHeight*0.92)+'px';
  }
}
function _resetEditModalOverlay() {
  var overlay=document.getElementById('editModal'), box=document.getElementById('editModalBox');
  if (overlay){overlay.style.position='';overlay.style.top='';overlay.style.left='';overlay.style.width='';overlay.style.height='';overlay.style.bottom='';}
  if (box) box.style.maxHeight='';
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', function(){
    if (document.getElementById('editModal').classList.contains('show')) _adjustEditModal(); else adjustOpenModals();
  });
  window.visualViewport.addEventListener('scroll', function(){
    if (document.getElementById('editModal').classList.contains('show')) _adjustEditModal();
  });
} else { window.addEventListener('resize', adjustOpenModals); }
document.addEventListener('focusin', function(e){
  var tag=e.target.tagName;
  if (tag!=='INPUT'&&tag!=='TEXTAREA') return;
  if (document.getElementById('editModal').classList.contains('show')){setTimeout(_adjustEditModal,80);setTimeout(_adjustEditModal,320);}
  else if (document.querySelector('.modal-overlay.show')) setTimeout(adjustOpenModals,350);
});
document.addEventListener('focusout', function(){
  setTimeout(function(){
    if (document.getElementById('editModal').classList.contains('show')) _adjustEditModal(); else adjustOpenModals();
  }, 200);
});

// ========== BOOT ==========
window.onload = function() {
  applyTheme();
  var auth=sessionStorage.getItem('auth'), accName=sessionStorage.getItem('accName'), t=sessionStorage.getItem('authTime');
  if (auth&&accName&&t&&(Date.now()-parseInt(t))<3600000) {
    currentAccount={ name:accName, role:sessionStorage.getItem('accRole'), color:ACCOUNTS[accName]?ACCOUNTS[accName].color:'#3d5afe' };
    showDash();
  }
  // Swipe ONLY on bottom nav bar
  initNavbarSwipe();
};

// ========== THEME ==========
function applyTheme() {
  document.body.classList.toggle('dark', dark);
  var gbg=document.getElementById('globalBg'); if (gbg) gbg.classList.toggle('dark', dark);
  var icon=document.getElementById('themeBtnIcon'), label=document.getElementById('themeBtnLabel');
  if (icon) icon.textContent = dark ? '☀️' : '🌙';
  if (label) label.textContent = dark ? 'Light Mode' : 'Dark Mode';
}
function toggleTheme() { dark=!dark; localStorage.setItem('theme',dark?'dark':'light'); applyTheme(); }

// ========== TOAST ==========
var toastTimer;
function toast(msg, ok) {
  if (ok===undefined) ok=true;
  var el=document.getElementById('toast');
  el.textContent=msg;
  el.className='toast show '+(ok?'ok':'err');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){el.className='toast';},2800);
}

// ========== HELPERS ==========
function esc(s) { if(!s)return''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function fmtDate(d) { return new Date(d).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function fmtTime(d) { return new Date(d).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}); }
function scrollBottom(el, smooth) { if(!el)return; requestAnimationFrame(function(){el.scrollTo({top:el.scrollHeight,behavior:smooth?'smooth':'instant'});}); }
function autoResize(el) { el.style.height='auto'; el.style.height=el.scrollHeight+'px'; }
function fmtBytes(bytes) { if(bytes<1024)return bytes+' B'; if(bytes<1048576)return(bytes/1024).toFixed(1)+' KB'; return(bytes/1048576).toFixed(2)+' MB'; }

// ========== NAVBAR SWIPE — HANYA DI NAVBAR ==========
// Tab order: Notes(0), Chat(1), Gallery(2)
const TAB_ORDER = ['Notes', 'Chat', 'Gallery'];
const TAB_TITLES = { Notes:'Catatan', Chat:'ChatRoom', Gallery:'Gallery' };

function initNavbarSwipe() {
  // Swipe HANYA pada element bottom-nav, bukan seluruh halaman
  var nav = document.getElementById('bottomNav');
  if (!nav) return;

  var startX = 0, startY = 0, navSwipeActive = false;

  nav.addEventListener('touchstart', function(e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    navSwipeActive = true;
  }, { passive: true });

  nav.addEventListener('touchmove', function(e) {
    if (!navSwipeActive) return;
    var dx = Math.abs(e.touches[0].clientX - startX);
    var dy = Math.abs(e.touches[0].clientY - startY);
    if (dy > dx + 10) { navSwipeActive = false; }
  }, { passive: true });

  nav.addEventListener('touchend', function(e) {
    if (!navSwipeActive) return;
    var dx = e.changedTouches[0].clientX - startX;
    var dy = Math.abs(e.changedTouches[0].clientY - startY);
    navSwipeActive = false;

    if (Math.abs(dx) < 60 || dy > 50) return;

    // Jangan trigger kalau ada modal/lightbox terbuka
    if (document.querySelector('.modal-overlay.show')) return;
    if (document.getElementById('lightbox').classList.contains('show')) return;

    var curTab = sessionStorage.getItem('activeTab') || 'Chat';
    var idx = TAB_ORDER.indexOf(curTab);
    if (idx === -1) return;

    var next = idx;
    if (dx < 0) next = Math.min(idx + 1, TAB_ORDER.length - 1);
    else         next = Math.max(idx - 1, 0);

    if (next !== idx) {
      var newTab = TAB_ORDER[next];
      sessionStorage.setItem('activeTab', newTab);
      activateTab(newTab);
    }
  });
}

// ========== LOGIN ==========
var pendingAccount = null;
function selectAccount(name, role) {
  pendingAccount={name:name,role:role,color:ACCOUNTS[name]?ACCOUNTS[name].color:'#3d5afe'};
  document.getElementById('stepAccount').style.display='none';
  document.getElementById('stepPin').style.display='block';
  document.getElementById('selectedAccInfo').innerHTML=
    '<div class="sel-acc"><div class="acc-avatar-lg" style="background:'+pendingAccount.color+'">'+name.charAt(0).toUpperCase()+'</div>'+
    '<div><div class="sel-name">'+name+'</div><div class="sel-role">'+(role==='admin'?'👑 Admin':'👤 User')+'</div></div></div>';
  setTimeout(function(){document.getElementById('pinInput').focus();},100);
  document.getElementById('pinInput').onkeydown=function(e){if(e.key==='Enter')doLogin();};
}
function backToAccount() {
  pendingAccount=null;
  document.getElementById('stepPin').style.display='none';
  document.getElementById('stepAccount').style.display='block';
  document.getElementById('pinInput').value='';
  document.getElementById('loginErr').textContent='';
}
function doLogin() {
  var pin=document.getElementById('pinInput').value, errEl=document.getElementById('loginErr');
  errEl.textContent='';
  if (!pin){errEl.textContent='Masukkan PIN terlebih dahulu';return;}
  if (!pendingAccount) return;
  var acc=ACCOUNTS[pendingAccount.name];
  if (!acc){errEl.textContent='Akun tidak ditemukan';return;}
  if (pin===acc.pin) {
    currentAccount=pendingAccount;
    sessionStorage.setItem('auth','1'); sessionStorage.setItem('authTime',Date.now().toString());
    sessionStorage.setItem('accName',currentAccount.name); sessionStorage.setItem('accRole',currentAccount.role);
    sessionStorage.setItem('activeTab','Chat');
    document.getElementById('pinInput').value='';
    notesLoaded=false; galleryLoaded=false;
    showDash();
  } else {
    errEl.textContent='PIN salah, coba lagi';
    document.getElementById('pinInput').value='';
    document.getElementById('pinInput').focus();
  }
}
async function doLogout() {
  var ok = await showConfirm('Yakin mau logout?', { icon:'👋', title:'Logout', okText:'Logout', cancelText:'Batal' });
  if (!ok) return;
  stopChatSync(); stopCountdown();
  exitSelectionMode(); exitNoteSelectionMode();
  sessionStorage.clear();
  currentAccount=null; pendingAccount=null;
  chatLoaded=false; notesLoaded=false; galleryLoaded=false;
  seenMsgIds.clear(); replyTarget=null;
  clearReplyBanner(); closeEmojiPicker();
  document.getElementById('stepPin').style.display='none';
  document.getElementById('stepAccount').style.display='block';
  document.getElementById('pinInput').value='';
  document.getElementById('loginErr').textContent='';
  document.getElementById('dashPage').className='page';
  document.getElementById('loginPage').className='page active';
}
function stopChatSync() {
  isChatActive=false;
  if (chatChannel){try{sb.removeChannel(chatChannel);}catch(e){}chatChannel=null;}
  if (pollTimer){clearInterval(pollTimer);pollTimer=null;}
}

// ========== SHOW DASH ==========
function showDash() {
  document.getElementById('loginPage').className='page';
  document.getElementById('dashPage').className='page active';
  var avatarEl=document.getElementById('topbarAvatar');
  avatarEl.textContent=currentAccount.name.charAt(0).toUpperCase();
  avatarEl.style.background=currentAccount.color;
  document.getElementById('topbarUser').textContent=currentAccount.name+(currentAccount.role==='admin'?' 👑':' 👤');
  var galleryFab=document.querySelector('.gallery-fab-wrap');
  if (galleryFab) galleryFab.style.display=currentAccount.role==='admin'?'block':'none';
  var lastTab=sessionStorage.getItem('activeTab')||'Chat';
  activateTab(lastTab);
}

// ========== TABS ==========
function goTab(name, title, btn) { sessionStorage.setItem('activeTab',name); activateTab(name); }
function activateTab(name) {
  document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active-tab');});
  document.querySelectorAll('.nav-item').forEach(function(b){
    var lbl=b.querySelector('span')?b.querySelector('span').textContent:'';
    b.classList.toggle('active',(name==='Chat'&&lbl==='Chat')||(name==='Notes'&&lbl==='Catatan')||(name==='Gallery'&&lbl==='Gallery'));
  });
  document.getElementById('tab'+name).classList.add('active-tab');
  document.getElementById('topbarTitle').textContent = TAB_TITLES[name] || name;
  if (name!=='Chat'){isChatActive=false;if(pollTimer){clearInterval(pollTimer);pollTimer=null;}}
  else { isChatActive=true; }
  if (name==='Notes') startCountdown(); else stopCountdown();
  if (name==='Chat') initChat();
  if (name==='Notes'&&!notesLoaded) loadNotes();
  if (name==='Gallery'&&!galleryLoaded) loadGallery();
}

// ========== MULTI-SELECT MODE (CHAT) ==========
function enterSelectionMode(msgId) {
  selectionModeActive = true;
  _addToSelection(msgId);
  _renderSelectionBar();
}
function toggleMsgSelection(msgId) {
  if (!selectionModeActive) return;
  if (selectedMsgIds.has(msgId)) _removeFromSelection(msgId);
  else _addToSelection(msgId);
  if (selectedMsgIds.size === 0) { exitSelectionMode(); return; }
  _renderSelectionBar();
}
function _addToSelection(msgId) {
  selectedMsgIds.add(msgId);
  var row = document.querySelector('[data-msg-id="'+msgId+'"]');
  if (row) row.classList.add('msg-selected');
}
function _removeFromSelection(msgId) {
  selectedMsgIds.delete(msgId);
  var row = document.querySelector('[data-msg-id="'+msgId+'"]');
  if (row) row.classList.remove('msg-selected');
}
function _renderSelectionBar() {
  var bar = document.getElementById('selectionBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'selectionBar';
    bar.className = 'selection-bar';
    document.querySelector('.topbar').appendChild(bar);
  }
  var isAdmin = currentAccount && currentAccount.role === 'admin';
  var canDeleteAll = isAdmin || _allSelectedAreOwn();
  bar.innerHTML =
    '<button class="sel-cancel-btn" onclick="exitSelectionMode()">✕ Batal</button>' +
    '<span class="sel-label">'+selectedMsgIds.size+' dipilih</span>' +
    (canDeleteAll ? '<button class="sel-delete-btn" onclick="delSelectedMsgs()">🗑 Hapus</button>' : '<span style="width:74px"></span>');
  bar.style.display = 'flex';
}
function _allSelectedAreOwn() {
  for (var id of selectedMsgIds) {
    var row = document.querySelector('[data-msg-id="'+id+'"]');
    if (!row || !row.classList.contains('mine')) return false;
  }
  return true;
}
function exitSelectionMode() {
  selectionModeActive = false;
  selectedMsgIds.clear();
  document.querySelectorAll('.msg-selected').forEach(function(el){ el.classList.remove('msg-selected'); });
  var bar = document.getElementById('selectionBar');
  if (bar) bar.style.display = 'none';
}
async function delSelectedMsgs() {
  if (selectedMsgIds.size === 0) return;
  var ids = Array.from(selectedMsgIds);
  var label = ids.length === 1 ? 'pesan ini' : ids.length + ' pesan';
  var ok = await showConfirm('Hapus ' + label + '?', { icon:'🗑', title:'Hapus Pesan', okText:'Hapus', cancelText:'Batal' });
  if (!ok) return;
  exitSelectionMode();
  var res = await sb.from('chat_messages').delete().in('id', ids);
  if (res.error) { toast('Gagal hapus', false); return; }
  ids.forEach(function(id) {
    var el = document.querySelector('[data-msg-id="'+id+'"]');
    if (el) el.remove();
    seenMsgIds.delete(String(id));
  });
  toast(ids.length === 1 ? 'Pesan dihapus' : ids.length + ' pesan dihapus');
}

// ========== MULTI-SELECT MODE (NOTES) ==========
function enterNoteSelectionMode(noteId) {
  noteSelectionModeActive = true;
  _addToNoteSelection(noteId);
  _renderNoteSelectionBar();
}
function toggleNoteSelection(noteId) {
  if (!noteSelectionModeActive) return;
  if (selectedNoteIds.has(noteId)) _removeFromNoteSelection(noteId);
  else _addToNoteSelection(noteId);
  if (selectedNoteIds.size === 0) { exitNoteSelectionMode(); return; }
  _renderNoteSelectionBar();
}
function _addToNoteSelection(noteId) {
  selectedNoteIds.add(noteId);
  var card = document.querySelector('[data-nid="'+noteId+'"]');
  if (card) card.classList.add('note-selected');
}
function _removeFromNoteSelection(noteId) {
  selectedNoteIds.delete(noteId);
  var card = document.querySelector('[data-nid="'+noteId+'"]');
  if (card) card.classList.remove('note-selected');
}
function _renderNoteSelectionBar() {
  var bar = document.getElementById('noteSelectionBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'noteSelectionBar';
    bar.className = 'notes-selection-bar';
    document.getElementById('dashPage').appendChild(bar);
  }
  var isAdmin = currentAccount && currentAccount.role === 'admin';
  var canDeleteAll = isAdmin || _allSelectedNotesOwn();
  bar.innerHTML =
    '<button class="sel-cancel-btn" onclick="exitNoteSelectionMode()">✕ Batal</button>' +
    '<span class="sel-label">'+selectedNoteIds.size+' catatan</span>' +
    (canDeleteAll ? '<button class="sel-delete-btn" onclick="delSelectedNotes()">🗑 Hapus</button>' : '<span style="width:74px"></span>');
  bar.classList.add('show');
}
function _allSelectedNotesOwn() {
  for (var id of selectedNoteIds) {
    var n = notesCache[id];
    if (!n || !currentAccount || n.author !== currentAccount.name) return false;
  }
  return true;
}
function exitNoteSelectionMode() {
  noteSelectionModeActive = false;
  selectedNoteIds.clear();
  document.querySelectorAll('.note-selected').forEach(function(el){ el.classList.remove('note-selected'); });
  var bar = document.getElementById('noteSelectionBar');
  if (bar) bar.classList.remove('show');
}
async function delSelectedNotes() {
  if (selectedNoteIds.size === 0) return;
  var ids = Array.from(selectedNoteIds);
  var label = ids.length === 1 ? 'catatan ini' : ids.length + ' catatan';
  var ok = await showConfirm('Hapus ' + label + '?', { icon:'🗑', title:'Hapus Catatan', okText:'Hapus', cancelText:'Batal' });
  if (!ok) return;
  exitNoteSelectionMode();
  var res = await sb.from('notes').delete().in('id', ids);
  if (res.error) { toast('Gagal hapus', false); return; }
  ids.forEach(function(id) {
    var card = document.querySelector('[data-nid="'+id+'"]');
    if (card) card.remove();
    delete notesCache[id];
  });
  toast(ids.length === 1 ? 'Catatan dihapus' : ids.length + ' catatan dihapus');
}

// ========== NOTES ==========
var notesCache={}, activeNoteOptionMenu=null;
function closeActiveOptionMenu() {
  if (activeNoteOptionMenu&&activeNoteOptionMenu.parentNode) activeNoteOptionMenu.remove();
  activeNoteOptionMenu=null;
}
document.addEventListener('click', function(e){
  if (!e.target.closest('.note-chevron')&&!e.target.closest('.read-author-option')&&!e.target.closest('.note-options-menu')) closeActiveOptionMenu();
  if (!e.target.closest('.emoji-picker-wrap')&&!e.target.closest('.emoji-trigger')) closeEmojiPicker();
  if (!e.target.closest('.msg-action-menu')&&!e.target.closest('.bubble-action-btn')) closeMsgActionMenu();
  if (selectionModeActive && !e.target.closest('[data-msg-id]') && !e.target.closest('#selectionBar')) {
    exitSelectionMode();
  }
  if (noteSelectionModeActive && !e.target.closest('[data-nid]') && !e.target.closest('#noteSelectionBar')) {
    exitNoteSelectionMode();
  }
});

function showNoteOptions(cardElement, noteId, anchorElement) {
  closeActiveOptionMenu();
  var n=notesCache[noteId]; if (!n) return;
  var isAdmin=currentAccount&&currentAccount.role==='admin';
  var isOwner=currentAccount&&n.author===currentAccount.name;
  if (!isAdmin&&!isOwner) return;
  var menu=document.createElement('div'); menu.className='note-options-menu';
  var editBtn=document.createElement('button'); editBtn.textContent='✏ Edit'; editBtn.className='note-option-item edit';
  editBtn.onclick=function(e){e.stopPropagation();closeActiveOptionMenu();openEditModal(noteId);};
  var delBtn=document.createElement('button'); delBtn.textContent='✕ Hapus'; delBtn.className='note-option-item delete';
  delBtn.onclick=function(e){e.stopPropagation();closeActiveOptionMenu();delNote(noteId);};
  menu.appendChild(editBtn); menu.appendChild(delBtn);
  var rect=anchorElement.getBoundingClientRect();
  menu.style.cssText='position:fixed;bottom:'+(window.innerHeight-rect.top+6)+'px;right:'+(window.innerWidth-rect.right)+'px;';
  document.body.appendChild(menu); activeNoteOptionMenu=menu;
}

async function loadNotes() {
  closeActiveOptionMenu();
  var el=document.getElementById('notesList');
  el.innerHTML='<p class="state-msg">Memuat...</p>';
  var res=await sb.from('notes').select('*').order('created_at',{ascending:true});
  if (res.error){el.innerHTML='<p class="state-msg err">Error: '+res.error.message+'</p>';return;}
  notesLoaded=true;
  if (!res.data||!res.data.length){el.innerHTML='<p class="state-msg">Belum ada catatan.</p>';return;}
  el.innerHTML=''; notesCache={};
  var frag=document.createDocumentFragment();
  res.data.forEach(function(n){
    notesCache[n.id]=n;
    var isAdmin=currentAccount&&currentAccount.role==='admin';
    var isOwner=currentAccount&&n.author===currentAccount.name;
    var canEdit=isAdmin||isOwner;
    var preview=(n.content||'').replace(/\n/g,' ').trim();
    if (preview.length>60) preview=preview.slice(0,60)+'…';
    var authorColor=n.author==="Jef'z"?'#007aff':'#e91e8c';
    var d=document.createElement('div'); d.className='note-card'; d.dataset.nid=n.id;
    var summary=document.createElement('div'); summary.className='note-summary';
    var sumMain=document.createElement('div'); sumMain.className='note-sum-main';
    var ttl=document.createElement('span'); ttl.className='note-ttl'; ttl.textContent=n.title;
    sumMain.appendChild(ttl);
    if (preview){var prev=document.createElement('span');prev.className='note-preview';prev.textContent=preview;sumMain.appendChild(prev);}
    var sumMeta=document.createElement('div'); sumMeta.className='note-sum-meta';
    var authorDot=document.createElement('span'); authorDot.className='note-author-dot'; authorDot.style.background=authorColor;
    var authorName=document.createElement('span'); authorName.className='note-author-name'; authorName.textContent=n.author||'';
    sumMeta.appendChild(authorDot); sumMeta.appendChild(authorName);
    var chevron=document.createElement('span'); chevron.className='note-chevron'; chevron.textContent='›';
    if (canEdit){chevron.style.cursor='pointer';chevron.onclick=function(e){e.stopPropagation();showNoteOptions(d,n.id,chevron);};}
    else chevron.style.opacity='0.3';
    sumMeta.appendChild(chevron);
    summary.appendChild(sumMain); summary.appendChild(sumMeta);
    summary.addEventListener('click',function(e){
      if (e.target===chevron||chevron.contains(e.target)) return;
      if (noteSelectionModeActive) { toggleNoteSelection(String(n.id)); return; }
      openReadModal(n.id);
    });
    initNoteLongPress(d, n.id);
    d.appendChild(summary); frag.appendChild(d);
  });
  el.appendChild(frag);
}

function initNoteLongPress(cardEl, noteId) {
  var pressTimer = null, moved = false;
  var startX = 0, startY = 0;
  cardEl.addEventListener('touchstart', function(e) {
    if (e.target.closest('.note-chevron')) return;
    moved = false;
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    if (noteSelectionModeActive) return;
    pressTimer = setTimeout(function() {
      if (!moved) {
        if (navigator.vibrate) navigator.vibrate(40);
        enterNoteSelectionMode(String(noteId));
      }
    }, 500);
  }, { passive: true });
  cardEl.addEventListener('touchmove', function(e) {
    var dx = Math.abs(e.touches[0].clientX - startX);
    var dy = Math.abs(e.touches[0].clientY - startY);
    if (dx > 8 || dy > 8) { moved = true; clearTimeout(pressTimer); }
  }, { passive: true });
  cardEl.addEventListener('touchend', function() {
    clearTimeout(pressTimer); moved = false;
  });
  cardEl.addEventListener('touchcancel', function() {
    clearTimeout(pressTimer); moved = false;
  });
}

function openReadModal(id) {
  var n=notesCache[id];
  if (n) _renderReadModal(n);
  else sb.from('notes').select('*').eq('id',id).single().then(function(res){if(!res.error&&res.data)_renderReadModal(res.data);});
}
function _renderReadModal(n) {
  document.getElementById('readModalTitle').textContent=n.title;
  var authorColor=n.author==="Jef'z"?'#007aff':'#e91e8c';
  var isAdmin=currentAccount&&currentAccount.role==='admin';
  var isOwner=currentAccount&&n.author===currentAccount.name;
  var canEdit=isAdmin||isOwner;
  var authorHtml='<span class="read-author-dot" style="background:'+authorColor+'"></span>'+esc(n.author||'');
  if (canEdit) authorHtml+='<span class="read-author-option" data-note-id="'+n.id+'">⋮</span>';
  document.getElementById('readModalAuthor').innerHTML=authorHtml;
  document.getElementById('readModalBody').textContent=n.content||'(Tidak ada isi)';
  document.getElementById('readModalTs').textContent=fmtDate(n.created_at);
  document.getElementById('readModal').classList.add('show');
  window.currentReadNoteId=n.id;
  var optionBtn=document.querySelector('#readModalAuthor .read-author-option');
  if (optionBtn) optionBtn.onclick=function(e){e.stopPropagation();showReadModalOption(n.id,e);};
}
function showReadModalOption(noteId, event) {
  event.stopPropagation(); closeActiveOptionMenu();
  var n=notesCache[noteId]; if (!n) return;
  var isAdmin=currentAccount&&currentAccount.role==='admin';
  var isOwner=currentAccount&&n.author===currentAccount.name;
  if (!isAdmin&&!isOwner) return;
  var anchor=event.target, rect=anchor.getBoundingClientRect();
  var menu=document.createElement('div'); menu.className='note-options-menu';
  var editBtn=document.createElement('button'); editBtn.textContent='✏ Edit'; editBtn.className='note-option-item edit';
  editBtn.onclick=function(e){e.stopPropagation();closeActiveOptionMenu();document.getElementById('readModal').classList.remove('show');setTimeout(function(){openEditModal(noteId);},200);};
  var delBtn=document.createElement('button'); delBtn.textContent='✕ Hapus'; delBtn.className='note-option-item delete';
  delBtn.onclick=function(e){e.stopPropagation();closeActiveOptionMenu();document.getElementById('readModal').classList.remove('show');setTimeout(function(){delNote(noteId);},200);};
  menu.appendChild(editBtn); menu.appendChild(delBtn);
  menu.style.cssText='position:fixed;bottom:'+(window.innerHeight-rect.top+6)+'px;right:'+(window.innerWidth-rect.right)+'px;';
  document.body.appendChild(menu); activeNoteOptionMenu=menu;
}
function closeReadModal(e) {
  if (e&&e.target!==document.getElementById('readModal')) return;
  document.getElementById('readModal').classList.remove('show');
  window.currentReadNoteId=null; closeActiveOptionMenu();
}
function openNoteModal() {
  document.getElementById('noteTitleInput').value=''; document.getElementById('noteBodyInput').value='';
  document.getElementById('noteModal').classList.add('show');
  setTimeout(function(){document.getElementById('noteTitleInput').focus();adjustOpenModals();},120);
}
function closeNoteModal(e) {
  if (e&&e.target!==document.getElementById('noteModal')) return;
  document.getElementById('noteModal').classList.remove('show');
}
async function addNote() {
  var title=document.getElementById('noteTitleInput').value.trim();
  var content=document.getElementById('noteBodyInput').value.trim();
  if (!title){toast('Judul tidak boleh kosong!',false);return;}
  var res=await sb.from('notes').insert([{title,content,author:currentAccount?currentAccount.name:''}]);
  if (res.error){toast('Gagal: '+res.error.message,false);return;}
  document.getElementById('noteModal').classList.remove('show');
  toast('Catatan ditambahkan ✓');
  notesLoaded=false; loadNotes();
}
function openEditModal(id) {
  var n=notesCache[id]; if (!n) return;
  var authorColor=n.author==="Jef'z"?'#007aff':'#e91e8c';
  document.getElementById('editAuthorRow').innerHTML='<span class="edit-author-dot" style="background:'+authorColor+'"></span>'+esc(n.author||'');
  var titleEl=document.getElementById('editTitleInput'); titleEl.value=n.title||''; titleEl.oninput=function(){autoResize(this);};
  var bodyEl=document.getElementById('editBodyInput'); bodyEl.value=n.content||''; bodyEl.oninput=function(){autoResize(this);};
  document.getElementById('editNoteId').value=id;
  document.getElementById('editModal').classList.add('show');
  setTimeout(function(){autoResize(titleEl);autoResize(bodyEl);_adjustEditModal();titleEl.focus();},80);
}
function closeEditModal(e) {
  if (e&&e.target!==document.getElementById('editModal')) return;
  document.getElementById('editModal').classList.remove('show');
  _resetEditModalOverlay();
  var titleEl=document.getElementById('editTitleInput'), bodyEl=document.getElementById('editBodyInput');
  if (titleEl) titleEl.style.height=''; if (bodyEl) bodyEl.style.height='';
}
async function saveEditNote() {
  var id=document.getElementById('editNoteId').value;
  var newTitle=document.getElementById('editTitleInput').value.trim();
  var newContent=document.getElementById('editBodyInput').value.trim();
  if (!newTitle){toast('Judul tidak boleh kosong!',false);return;}
  var res=await sb.from('notes').update({title:newTitle,content:newContent}).eq('id',id);
  if (res.error){toast('Gagal edit: '+res.error.message,false);return;}
  closeEditModal(); toast('Catatan diperbarui ✓');
  notesLoaded=false; loadNotes();
}
async function delNote(id) {
  var ok = await showConfirm('Hapus catatan ini?', { icon:'🗑', title:'Hapus Catatan', okText:'Hapus', cancelText:'Batal' });
  if (!ok) return;
  var res=await sb.from('notes').delete().eq('id',id);
  if (res.error){toast('Gagal hapus',false);return;}
  toast('Dihapus'); notesLoaded=false; loadNotes();
}

// ========== EMOJI PICKER ==========
const EMOJI_CATEGORIES = [
  { icon:'😀', label:'Smileys', emojis:['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','💫','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'] },
  { icon:'❤️', label:'Hearts', emojis:['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟'] },
  { icon:'👋', label:'People', emojis:['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦿','🦶','👂','🦻','👃','🧠','🦷','🦴','👀','👁️','👅','👄','💋','🩸'] },
  { icon:'🐱', label:'Animals', emojis:['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🦋','🐌','🐞','🐜','🦟','🕷️','🦂','🐢','🐍','🦎','🐙','🦑','🦐','🦀','🐡','🐠','🐟','🐬','🐳','🦈'] },
  { icon:'🍎', label:'Food', emojis:['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🌶️','🧄','🥔','🍠','🥐','🥯','🍞','🥖','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🌮','🌯','🥗','🥘','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🍤','🍙','🍚','🍘','🍥','🥮','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🧃','🥤','🧋','☕','🍵','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🍾'] },
  { icon:'⚽', label:'Activity', emojis:['⚽','🏀','🏈','⚾','🥎','🏐','🏉','🎾','🥏','🎱','🏓','🏸','🏒','🥅','⛳','🎯','🎮','🕹️','🎲','🧩','🧸','♟️','🎭','🎨','🎰','🚗','🏎️','🏍️','🛵','🚲','🛴','🛹','🎿','🛷','🥌'] },
  { icon:'🌍', label:'Travel', emojis:['🌍','🌎','🌏','🌐','🗺️','🧭','🏔️','⛰️','🌋','🏕️','🏖️','🏜️','🏝️','🏟️','🏛️','🏗️','🏘️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','⛩️','🕋','⛲','⛺','🌁','🌃','🏙️','🌄','🌅','🌆','🌇','🌉','🎠','🎡','🎢','🎪','🚂','🚃','🚄','🚅','🚇','🚌','🚍','🚎','🚑','🚒','🚓','🚕','✈️','🛫','🛬','💺','🚀','🛸','🚁','🛶','⛵','🚤','🛥️','🛳️','🚢'] },
  { icon:'💡', label:'Objects', emojis:['⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','💽','💾','💿','📀','📷','📸','📹','🎥','📞','☎️','📺','📻','🧭','⏱️','⏰','📡','🔋','🔌','💡','🔦','🕯️','💰','💴','💵','💶','💷','💸','💳','🪙','✉️','📧','📝','📁','📂','📅','📆','📈','📉','📊','📋','📌','📍','✂️','🔒','🔓','🔑','🗝️','🔨','⚒️','🛠️','⚙️','🔗','⛓️','🧰','🧲','💊','🩺','🩻','🧪','🧬','🔬','🔭','📡'] },
];

function buildEmojiPicker() {
  var existing = document.getElementById('emojiPickerPanel');
  if (existing) return existing;
  var panel = document.createElement('div');
  panel.id = 'emojiPickerPanel';
  panel.className = 'emoji-picker-wrap';

  var hint = document.createElement('div');
  hint.className = 'emoji-swipe-hint';
  panel.appendChild(hint);

  var tabs = document.createElement('div');
  tabs.className = 'emoji-cat-tabs';
  var body = document.createElement('div');
  body.className = 'emoji-body';
  EMOJI_CATEGORIES.forEach(function(cat, idx) {
    var tab = document.createElement('button');
    tab.className = 'emoji-cat-tab' + (idx===0?' active':'');
    tab.title = cat.label;
    tab.textContent = cat.icon;
    tab.onclick = function() {
      document.querySelectorAll('.emoji-cat-tab').forEach(function(t){t.classList.remove('active');});
      tab.classList.add('active');
      document.querySelectorAll('.emoji-section').forEach(function(s){s.style.display='none';});
      document.getElementById('emoji-sec-'+idx).style.display='';
    };
    tabs.appendChild(tab);
    var sec = document.createElement('div');
    sec.className = 'emoji-section';
    sec.id = 'emoji-sec-'+idx;
    if (idx!==0) sec.style.display='none';
    cat.emojis.forEach(function(em) {
      var btn = document.createElement('button');
      btn.className = 'emoji-item';
      btn.textContent = em;
      btn.onclick = function(e) { e.stopPropagation(); insertEmoji(em); };
      sec.appendChild(btn);
    });
    body.appendChild(sec);
  });
  panel.appendChild(tabs);
  panel.appendChild(body);
  var chatBar = document.querySelector('.chat-bar');
  if (chatBar) chatBar.appendChild(panel);

  initEmojiSwipe(panel, tabs);
  return panel;
}

function initEmojiSwipe(panel, tabsEl) {
  var startX = 0, startY = 0, swiping = false;
  panel.addEventListener('touchstart', function(e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    swiping = false;
  }, { passive: true });
  panel.addEventListener('touchmove', function(e) {
    var dx = e.touches[0].clientX - startX;
    var dy = Math.abs(e.touches[0].clientY - startY);
    if (!swiping && Math.abs(dx) > dy && Math.abs(dx) > 14) swiping = true;
  }, { passive: true });
  panel.addEventListener('touchend', function(e) {
    if (!swiping) return;
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) < 50) return;
    var activeCat = document.querySelector('.emoji-cat-tab.active');
    var allCats = Array.from(document.querySelectorAll('.emoji-cat-tab'));
    var idx = allCats.indexOf(activeCat);
    var next = dx < 0 ? Math.min(idx+1, allCats.length-1) : Math.max(idx-1, 0);
    if (next !== idx) allCats[next].click();
    swiping = false;
  });
}

function insertEmoji(em) {
  var input = document.getElementById('chatInput');
  if (!input) return;
  var start = input.selectionStart, end = input.selectionEnd;
  var val = input.value;
  input.value = val.slice(0,start) + em + val.slice(end);
  var pos = start + em.length;
  input.setSelectionRange(pos, pos);
  input.focus();
}
function toggleEmojiPicker(e) {
  e.stopPropagation();
  var panel = document.getElementById('emojiPickerPanel') || buildEmojiPicker();
  emojiPickerOpen = !emojiPickerOpen;
  panel.style.display = emojiPickerOpen ? 'flex' : 'none';
  document.getElementById('emojiTrigger').classList.toggle('active', emojiPickerOpen);
}
function closeEmojiPicker() {
  emojiPickerOpen = false;
  var panel = document.getElementById('emojiPickerPanel');
  if (panel) panel.style.display = 'none';
  var trigger = document.getElementById('emojiTrigger');
  if (trigger) trigger.classList.remove('active');
}

// ========== REPLY SYSTEM ==========
function setReply(id, senderName, message) {
  replyTarget = { id, sender_name: senderName, message };
  var banner = document.getElementById('replyBanner');
  if (!banner) return;
  banner.style.display = 'flex';
  document.getElementById('replyBannerName').textContent = senderName;
  var preview = message.length > 60 ? message.slice(0,60)+'…' : message;
  document.getElementById('replyBannerText').textContent = preview;
  document.getElementById('chatInput').focus();
}
function clearReplyBanner() {
  replyTarget = null;
  var banner = document.getElementById('replyBanner');
  if (banner) banner.style.display = 'none';
}

// ========== MESSAGE ACTION MENU ==========
var activeMsgActionMenu = null;
function closeMsgActionMenu() {
  if (activeMsgActionMenu && activeMsgActionMenu.parentNode) activeMsgActionMenu.remove();
  activeMsgActionMenu = null;
}
function showMsgActionMenu(msgId, senderName, message, anchorEl) {
  closeMsgActionMenu();
  var isAdmin = currentAccount && currentAccount.role === 'admin';
  var isOwner = currentAccount && senderName === currentAccount.name;
  var canDelete = isAdmin || isOwner;
  var menu = document.createElement('div');
  menu.className = 'msg-action-menu';
  var replyBtn = document.createElement('button');
  replyBtn.className = 'msg-action-item';
  replyBtn.innerHTML = '↩ Balas';
  replyBtn.onclick = function(e) { e.stopPropagation(); closeMsgActionMenu(); setReply(msgId, senderName, message); };
  menu.appendChild(replyBtn);
  if (canDelete) {
    var delBtn = document.createElement('button');
    delBtn.className = 'msg-action-item danger';
    delBtn.innerHTML = '✕ Hapus';
    delBtn.onclick = function(e) { e.stopPropagation(); closeMsgActionMenu(); delMsg(msgId); };
    menu.appendChild(delBtn);
  }
  var rect = anchorEl.getBoundingClientRect();
  var isMe = currentAccount && senderName === currentAccount.name;
  menu.style.position = 'fixed';
  menu.style.top = (rect.bottom + 4) + 'px';
  if (isMe) menu.style.right = (window.innerWidth - rect.right) + 'px';
  else menu.style.left = rect.left + 'px';
  document.body.appendChild(menu);
  activeMsgActionMenu = menu;
}
async function delMsg(id) {
  var ok = await showConfirm('Hapus pesan ini?', { icon:'🗑', title:'Hapus Pesan', okText:'Hapus', cancelText:'Batal' });
  if (!ok) return;
  var res = await sb.from('chat_messages').delete().eq('id', id);
  if (res.error) { toast('Gagal hapus', false); return; }
  var el = document.querySelector('[data-msg-id="'+id+'"]');
  if (el) el.remove();
  toast('Pesan dihapus');
}

// ========== CHAT UPLOAD ==========
async function doChatUpload(input) {
  if (!currentAccount) return;
  var file = input.files[0];
  if (!file) return;
  var isVid = file.type.startsWith('video/');
  var ext = file.name.split('.').pop();
  var name = 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2,6) + '.' + ext;
  var uploadUrl = SB_URL + '/storage/v1/object/gallery/' + name;
  try {
    await new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl, true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + SB_KEY);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.setRequestHeader('Cache-Control', '3600');
      xhr.onload = function(){xhr.status>=200&&xhr.status<300?resolve():reject(new Error(xhr.status));};
      xhr.onerror = function(){reject(new Error('Network error'));};
      xhr.send(file);
    });
  } catch(err) { toast('Upload gagal', false); input.value=''; return; }
  var pub = sb.storage.from('gallery').getPublicUrl(name);
  var mediaUrl = pub.data.publicUrl;
  var msgContent = isVid ? '[video]'+mediaUrl : '[img]'+mediaUrl;
  var res = await sb.from('chat_messages').insert([{
    message: msgContent, user_id: uid,
    sender_name: currentAccount.name, sender_role: currentAccount.role
  }]);
  if (res.error) { toast('Gagal kirim media', false); } else { toast('Media terkirim ✓'); }
  input.value='';
}

// ========== GALLERY UPLOAD CONFIRM ==========
function triggerUploadConfirm(input) {
  if (!currentAccount || currentAccount.role !== 'admin') {
    toast('Hanya admin yang bisa upload', false);
    input.value = ''; return;
  }
  var file = input.files[0];
  if (!file) return;
  pendingUploadFile = file;
  document.getElementById('uploadFileName').textContent = file.name;
  document.getElementById('uploadFileSize').textContent = fmtBytes(file.size) + ' · ' + (file.type || 'unknown');
  document.getElementById('uploadProgressWrap').style.display = 'none';
  document.getElementById('uploadProgressFill').style.width = '0%';
  document.getElementById('uploadPctLabel').textContent = '0%';
  document.getElementById('uploadSpeedLabel').textContent = '—';
  document.getElementById('uploadRemainLabel').textContent = '—';
  var goBtn = document.getElementById('uploadGoBtn');
  var cancelBtn = document.getElementById('uploadCancelBtn');
  var closeBtn = document.getElementById('uploadModalCloseBtn');
  goBtn.disabled = false; goBtn.textContent = 'Upload';
  cancelBtn.textContent = 'Batal'; closeBtn.style.display = '';
  document.getElementById('uploadConfirmModal').classList.add('show');
  input.value = '';
}
function cancelUploadModal() {
  if (uploadXHR) { try { uploadXHR.abort(); } catch(e){} uploadXHR = null; }
  pendingUploadFile = null;
  document.getElementById('uploadConfirmModal').classList.remove('show');
}
async function startGalleryUpload() {
  if (!pendingUploadFile) return;
  var file = pendingUploadFile;
  var goBtn = document.getElementById('uploadGoBtn');
  var cancelBtn = document.getElementById('uploadCancelBtn');
  var closeBtn = document.getElementById('uploadModalCloseBtn');
  goBtn.disabled = true; goBtn.textContent = 'Mengupload...';
  closeBtn.style.display = 'none'; cancelBtn.textContent = 'Batalkan';
  document.getElementById('uploadProgressWrap').style.display = 'flex';
  var ext = file.name.split('.').pop();
  var name = Date.now() + '_' + Math.random().toString(36).slice(2,6) + '.' + ext;
  var uploadUrl = SB_URL + '/storage/v1/object/gallery/' + name;
  var lastLoaded = 0, lastTime = Date.now();
  var success = false;
  try {
    await new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      uploadXHR = xhr;
      xhr.open('POST', uploadUrl, true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + SB_KEY);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.setRequestHeader('Cache-Control', '3600');
      xhr.upload.onprogress = function(e) {
        if (!e.lengthComputable) return;
        var now = Date.now();
        var percent = Math.round((e.loaded / e.total) * 100);
        var elapsed = (now - lastTime) / 1000;
        var speed = elapsed > 0 ? (e.loaded - lastLoaded) / elapsed : 0;
        lastLoaded = e.loaded; lastTime = now;
        document.getElementById('uploadProgressFill').style.width = percent + '%';
        document.getElementById('uploadPctLabel').textContent = percent + '%';
        document.getElementById('uploadSpeedLabel').textContent = speed > 0 ? fmtBytes(speed) + '/s' : '—';
        document.getElementById('uploadRemainLabel').textContent = fmtBytes(e.total - e.loaded) + ' tersisa';
      };
      xhr.onload = function() { uploadXHR = null; if (xhr.status >= 200 && xhr.status < 300) resolve(); else reject(new Error('HTTP ' + xhr.status)); };
      xhr.onerror = function() { uploadXHR = null; reject(new Error('Network error')); };
      xhr.onabort = function() { uploadXHR = null; reject(new Error('Dibatalkan')); };
      xhr.send(file);
    });
    success = true;
  } catch(err) {
    if (err.message === 'Dibatalkan') toast('Upload dibatalkan', false);
    else toast('Upload gagal: ' + err.message, false);
    goBtn.disabled = false; goBtn.textContent = 'Upload';
    cancelBtn.textContent = 'Batal'; closeBtn.style.display = '';
    document.getElementById('uploadProgressWrap').style.display = 'none';
    document.getElementById('uploadConfirmModal').classList.remove('show');
    pendingUploadFile = null; return;
  }
  if (!success) return;
  var pub = sb.storage.from('gallery').getPublicUrl(name);
  var dbRes = await sb.from('gallery').insert([{file_url: pub.data.publicUrl, file_name: name}]);
  if (dbRes.error) toast('Gagal simpan: ' + dbRes.error.message, false);
  else { toast('Berhasil diupload ✓'); galleryLoaded = false; loadGallery(); }
  pendingUploadFile = null; uploadXHR = null;
  document.getElementById('uploadConfirmModal').classList.remove('show');
}

// ========== CHAT ==========
function buildMsgEl(m) {
  var isMe = currentAccount && m.sender_name === currentAccount.name;
  var isAdmin = currentAccount && currentAccount.role === 'admin';
  var isOwner = currentAccount && m.sender_name === currentAccount.name;
  var canDelete = isAdmin || isOwner;

  var d = document.createElement('div');
  d.className = 'msg-row ' + (isMe ? 'mine' : 'theirs');
  if (m.id) d.dataset.msgId = String(m.id);

  var nameColor = m.sender_name === "Jef'z" ? '#3d5afe' : '#e91e8c';
  var roleTag = m.sender_role === 'admin' ? ' 👑' : '';

  var msgContent = m.message || '';
  var isImgMsg = msgContent.startsWith('[img]');
  var isVidMsg = msgContent.startsWith('[video]');
  var mediaUrl = (isImgMsg || isVidMsg) ? msgContent.slice(isImgMsg?5:7) : null;

  var actionBtn = document.createElement('button');
  actionBtn.className = 'bubble-action-btn';
  actionBtn.title = 'Opsi';
  actionBtn.textContent = '⋮';
  actionBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (selectionModeActive) return;
    showMsgActionMenu(m.id, m.sender_name, m.message || '', actionBtn);
  });

  var replyEl = null;
  if (m.reply_to_name && m.reply_to_text) {
    var rColor = m.reply_to_name === "Jef'z" ? '#3d5afe' : '#e91e8c';
    var rPreview = m.reply_to_text.length > 50 ? m.reply_to_text.slice(0,50)+'…' : m.reply_to_text;
    if (rPreview.startsWith('[img]')||rPreview.startsWith('[video]')) rPreview = rPreview.startsWith('[img]')?'🖼 Foto':'🎬 Video';
    replyEl = document.createElement('div');
    replyEl.className = 'reply-preview';
    replyEl.style.borderLeft = '3px solid ' + rColor;
    replyEl.innerHTML =
      '<span class="reply-prev-name" style="color:'+rColor+'">'+esc(m.reply_to_name)+'</span>' +
      '<span class="reply-prev-text">'+esc(rPreview)+'</span>';
  }

  var bubble = document.createElement('div');
  bubble.className = mediaUrl ? 'bubble bubble-media' : 'bubble';
  bubble.appendChild(actionBtn);
  if (replyEl) bubble.appendChild(replyEl);

  if (isImgMsg && mediaUrl) {
    var img = document.createElement('img');
    img.src = mediaUrl; img.className = 'bubble-img'; img.loading = 'lazy';
    img.onclick = function(e) { e.stopPropagation(); openLightboxFromChat(mediaUrl); };
    bubble.appendChild(img);
  } else if (isVidMsg && mediaUrl) {
    var vid = document.createElement('video');
    vid.src = mediaUrl; vid.className = 'bubble-vid'; vid.preload = 'metadata';
    vid.controls = true; vid.playsInline = true;
    bubble.appendChild(vid);
  } else {
    var textNode = document.createTextNode(msgContent);
    bubble.appendChild(textNode);
  }

  var btime = document.createElement('span');
  btime.className = 'btime'; btime.textContent = fmtTime(m.created_at);
  bubble.appendChild(btime);

  var blockInner = document.createElement('div');
  blockInner.className = 'msg-block-inner';
  if (!isMe) {
    var senderSpan = document.createElement('span');
    senderSpan.className = 'msg-sender'; senderSpan.style.color = nameColor;
    senderSpan.textContent = m.sender_name + roleTag;
    blockInner.appendChild(senderSpan);
  }
  blockInner.appendChild(bubble);

  var msgBlock = document.createElement('div');
  msgBlock.className = 'msg-block'; msgBlock.appendChild(blockInner);

  var swipeWrap = document.createElement('div');
  swipeWrap.className = 'msg-swipe-wrap'; swipeWrap.appendChild(msgBlock);
  d.appendChild(swipeWrap);

  initLongPressSelect(d, m, canDelete);
  initSwipeReply(d, m);
  return d;
}

// ========== LONG-PRESS CHAT ==========
function initLongPressSelect(rowEl, m, canDelete) {
  var bubble = rowEl.querySelector('.bubble');
  if (!bubble) return;
  var pressTimer = null, moved = false;
  var touchStartX = 0, touchStartY = 0;

  bubble.addEventListener('touchstart', function(e) {
    if (e.target.closest('.bubble-action-btn')) return;
    if (selectionModeActive) return;
    moved = false;
    touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
    pressTimer = setTimeout(function() {
      if (!moved && m.id) {
        if (navigator.vibrate) navigator.vibrate(40);
        enterSelectionMode(String(m.id));
      }
    }, 500);
  }, { passive: true });
  bubble.addEventListener('touchmove', function(e) {
    var dx = Math.abs(e.touches[0].clientX - touchStartX);
    var dy = Math.abs(e.touches[0].clientY - touchStartY);
    if (dx > 8 || dy > 8) { moved = true; clearTimeout(pressTimer); }
  }, { passive: true });
  bubble.addEventListener('touchend', function(e) {
    clearTimeout(pressTimer);
    if (selectionModeActive && !moved && m.id) { e.stopPropagation(); toggleMsgSelection(String(m.id)); }
    moved = false;
  });
  bubble.addEventListener('touchcancel', function() { clearTimeout(pressTimer); moved = false; });
}

// ========== SWIPE TO REPLY ==========
function initSwipeReply(rowEl, m) {
  var swipeWrap = rowEl.querySelector('.msg-swipe-wrap');
  var startX = 0, startY = 0, dx = 0, swiping = false, triggered = false;

  swipeWrap.addEventListener('touchstart', function(e) {
    var t = e.touches[0]; startX = t.clientX; startY = t.clientY;
    dx = 0; swiping = false; triggered = false;
  }, { passive: true });
  swipeWrap.addEventListener('touchmove', function(e) {
    if (selectionModeActive) return;
    var t = e.touches[0]; dx = t.clientX - startX;
    var dy = Math.abs(t.clientY - startY);
    if (!swiping && Math.abs(dx) > dy && Math.abs(dx) > 8) swiping = true;
    if (!swiping) return;
    var clamped = Math.min(Math.max(0, dx), 72);
    swipeWrap.style.transform = 'translateX('+clamped+'px)';
    swipeWrap.style.transition = 'none';
    if (clamped >= 60 && !triggered) {
      triggered = true;
      rowEl.classList.add('reply-flash');
      setTimeout(function(){rowEl.classList.remove('reply-flash');}, 200);
    }
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  swipeWrap.addEventListener('touchend', function() {
    if (!selectionModeActive && triggered && dx >= 60) setReply(m.id, m.sender_name, m.message || '');
    swipeWrap.style.transition = 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)';
    swipeWrap.style.transform = 'translateX(0)';
    swiping = false; triggered = false;
  });
}

function appendMsg(m, smooth) {
  var el = document.getElementById('chatList');
  if (!el) return;
  var id = String(m.id || '');
  if (id && seenMsgIds.has(id)) return;
  if (id) seenMsgIds.add(id);
  var ph = el.querySelector('.state-msg'); if (ph) el.innerHTML = '';
  el.appendChild(buildMsgEl(m));
  var dist = el.scrollHeight - el.scrollTop - el.clientHeight;
  scrollBottom(el, smooth && dist < 300);
}
async function initChat() {
  isChatActive = true; chatLoaded = false; seenMsgIds.clear();
  var el = document.getElementById('chatList');
  el.innerHTML = '<p class="state-msg">Memuat...</p>';
  var res = await sb.from('chat_messages').select('*').order('created_at', { ascending: true });
  if (res.error){el.innerHTML='<p class="state-msg err">Error: '+res.error.message+'</p>';return;}
  el.innerHTML = ''; chatLoaded = true;
  if (!res.data||!res.data.length){
    el.innerHTML='<p class="state-msg">Belum ada pesan. Mulai chat!</p>';
  } else {
    var frag=document.createDocumentFragment();
    res.data.forEach(function(m){if(m.id)seenMsgIds.add(String(m.id));frag.appendChild(buildMsgEl(m));});
    el.appendChild(frag); scrollBottom(el, false);
  }
  startChatSync();
}
function startChatSync() {
  if (chatChannel){try{sb.removeChannel(chatChannel);}catch(e){}chatChannel=null;}
  if (pollTimer){clearInterval(pollTimer);pollTimer=null;}
  chatChannel = sb.channel('chat_live_'+Date.now(),{config:{broadcast:{self:false}}})
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_messages'},function(payload){
      if (!isChatActive||!payload.new) return;
      var newId = String(payload.new.id);
      if (seenMsgIds.has(newId)) return;
      if (currentAccount && payload.new.sender_name === currentAccount.name) {
        var el = document.getElementById('chatList');
        var pend = el ? el.querySelector('[data-pending]') : null;
        if (pend) { pend.dataset.msgId = newId; seenMsgIds.add(newId); pend.removeAttribute('data-pending'); return; }
      }
      appendMsg(payload.new, true);
    })
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'chat_messages'},function(payload){
      if (!payload.old||!payload.old.id) return;
      var el2=document.querySelector('[data-msg-id="'+payload.old.id+'"]');
      if (el2) el2.remove();
      seenMsgIds.delete(String(payload.old.id));
    })
    .subscribe();

  pollTimer = setInterval(async function(){
    if (!isChatActive||!chatLoaded) return;
    var res=await sb.from('chat_messages').select('*').order('created_at',{ascending:false}).limit(20);
    if (res.error||!res.data) return;
    res.data.slice().reverse().forEach(function(m){ if (m.id && !seenMsgIds.has(String(m.id))) appendMsg(m, false); });
  }, 4000);
}

var isSending = false;
async function sendMsg() {
  if (isSending) return;
  var input = document.getElementById('chatInput');
  var rawMsg = input.value;
  var msg = rawMsg.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
  if (!msg || !currentAccount) return;
  isSending = true;
  input.value = ''; input.style.height = ''; input.focus();
  var insertData = { message: msg, user_id: uid, sender_name: currentAccount.name, sender_role: currentAccount.role };
  if (replyTarget) {
    insertData.reply_to_id = replyTarget.id;
    insertData.reply_to_name = replyTarget.sender_name;
    insertData.reply_to_text = replyTarget.message;
  }
  var fakeMsg = { message: msg, sender_name: currentAccount.name, sender_role: currentAccount.role, user_id: uid, created_at: new Date().toISOString(), reply_to_name: insertData.reply_to_name, reply_to_text: insertData.reply_to_text };
  clearReplyBanner();
  var el = document.getElementById('chatList');
  var ph = el.querySelector('.state-msg'); if (ph) el.innerHTML = '';
  var msgEl = buildMsgEl(fakeMsg); msgEl.dataset.pending = '1';
  el.appendChild(msgEl); scrollBottom(el, true);
  var res = await sb.from('chat_messages').insert([insertData]);
  isSending = false;
  if (res.error){ var pend = el.querySelector('[data-pending]'); if (pend) pend.remove(); toast('Gagal kirim', false); input.value = msg; return; }
  setTimeout(async function(){
    var pend = el.querySelector('[data-pending]'); if (!pend) return;
    var r = await sb.from('chat_messages').select('id').order('created_at',{ascending:false}).limit(1);
    if (r.data&&r.data[0]){ var newId = String(r.data[0].id); if (!seenMsgIds.has(newId)) seenMsgIds.add(newId); pend.dataset.msgId = newId; pend.removeAttribute('data-pending'); }
  }, 800);
}

// ========== GALLERY ==========
var galleryItems = [];

async function loadGallery() {
  var el=document.getElementById('galleryGrid');
  el.innerHTML='<p class="state-msg">Memuat...</p>';
  var res=await sb.from('gallery').select('*').order('created_at',{ascending:false});
  if (res.error){el.innerHTML='<p class="state-msg err">Error: '+res.error.message+'</p>';return;}
  galleryLoaded=true;
  galleryItems = [];
  if (!res.data||!res.data.length){el.innerHTML='<p class="state-msg">Belum ada media.</p>';return;}
  el.innerHTML='';
  var isAdmin=currentAccount&&currentAccount.role==='admin';
  var frag=document.createDocumentFragment();
  res.data.forEach(function(f, idx){
    var isVid=/\.(mp4|webm|mov|avi)$/i.test(f.file_name||'');
    galleryItems.push({ url: f.file_url, isVid: isVid });
    var d=document.createElement('div'); d.className='g-item';
    if (isVid){
      var thumb=document.createElement('div'); thumb.className='g-video-thumb';
      thumb.style.cssText='position:relative;width:100%;height:100%;';
      var vid=document.createElement('video'); vid.className='g-media g-video-preview';
      vid.preload='metadata'; vid.muted=true; vid.playsInline=true; vid.src=f.file_url+'#t=0.001';
      var playIcon=document.createElement('div'); playIcon.className='g-play-icon';
      playIcon.innerHTML='<svg viewBox="0 0 24 24" fill="white" width="28" height="28"><circle cx="12" cy="12" r="12" fill="rgba(0,0,0,0.5)"/><polygon points="10,8 18,12 10,16" fill="white"/></svg>';
      thumb.appendChild(vid); thumb.appendChild(playIcon);
      (function(i){ thumb.onclick=function(){openLightbox(i);}; })(idx);
      d.appendChild(thumb);
    } else {
      var img=document.createElement('img'); img.src=f.file_url; img.className='g-media';
      img.loading='lazy'; img.decoding='async';
      (function(i){ img.onclick=function(){openLightbox(i);}; })(idx);
      d.appendChild(img);
    }
    if (isAdmin){
      var delBtn=document.createElement('button'); delBtn.className='g-del'; delBtn.textContent='✕';
      delBtn.onclick=function(e){e.stopPropagation();delMedia(f.id,f.file_name);};
      d.appendChild(delBtn);
    }
    frag.appendChild(d);
  });
  el.appendChild(frag);
}

async function delMedia(id, name) {
  if (!currentAccount||currentAccount.role!=='admin') return;
  var ok = await showConfirm('Hapus media ini?', { icon:'🗑', title:'Hapus Media', okText:'Hapus', cancelText:'Batal' });
  if (!ok) return;
  await sb.storage.from('gallery').remove([name]);
  var res=await sb.from('gallery').delete().eq('id',id);
  if (res.error){toast('Gagal hapus',false);return;}
  toast('Dihapus'); galleryLoaded=false; loadGallery();
}

// ========== LIGHTBOX — MODAL STYLE, NO LAG ==========
// Pakai modal overlay sama seperti modal lainnya
// Navbar TIDAK akan ikut gerak karena lightbox di z-index atas, fixed fullscreen
var lbCurrentIdx = -1;
var lbSwipeStartX = 0, lbSwiping = false;

function openLightbox(idx) {
  lbCurrentIdx = typeof idx === 'number' ? idx : -1;
  var lb = document.getElementById('lightbox');
  _renderLightboxItem(lbCurrentIdx);
  _updateLightboxNav();
  lb.classList.add('show');
  // Lock body scroll
  document.body.style.overflow = 'hidden';
}

function openLightboxFromChat(url) {
  // Single image from chat, no index
  lbCurrentIdx = -1;
  var lb = document.getElementById('lightbox');
  var wrap = document.getElementById('lightboxMediaWrap');
  _clearLightboxMedia(wrap);
  var img = document.getElementById('lightboxImg');
  img.src = url; img.style.display = '';
  document.getElementById('lightboxCounter').innerHTML = '';
  document.getElementById('lightboxPrev').style.display = 'none';
  document.getElementById('lightboxNext').style.display = 'none';
  lb.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function _clearLightboxMedia(wrap) {
  if (!wrap) wrap = document.getElementById('lightboxMediaWrap');
  var oldVid = wrap.querySelector('video');
  if (oldVid) { try { oldVid.pause(); oldVid.src = ''; } catch(e){} oldVid.remove(); }
  var img = document.getElementById('lightboxImg');
  if (img) { img.src = ''; img.style.display = 'none'; }
}

function _renderLightboxItem(idx) {
  var wrap = document.getElementById('lightboxMediaWrap');
  _clearLightboxMedia(wrap);
  var img = document.getElementById('lightboxImg');

  if (idx < 0 || !galleryItems[idx]) return;
  var item = galleryItems[idx];

  if (item.isVid) {
    img.style.display = 'none';
    var vid = document.createElement('video');
    vid.id = 'lightboxVideo';
    vid.src = item.url;
    vid.controls = true;
    vid.playsInline = true;
    vid.autoplay = false;
    // Style inline agar tidak kena override
    vid.style.cssText = 'max-width:100%;max-height:76vh;width:auto;height:auto;object-fit:contain;display:block;border-radius:0;background:transparent;';
    wrap.appendChild(vid);
  } else {
    img.src = item.url;
    img.style.display = '';
  }
  _updateLightboxCounter(idx);
}

function _updateLightboxNav() {
  var prev = document.getElementById('lightboxPrev');
  var next = document.getElementById('lightboxNext');
  if (lbCurrentIdx < 0 || galleryItems.length <= 1) {
    if (prev) prev.style.display = 'none';
    if (next) next.style.display = 'none';
    return;
  }
  if (prev) prev.style.display = lbCurrentIdx > 0 ? '' : 'none';
  if (next) next.style.display = lbCurrentIdx < galleryItems.length - 1 ? '' : 'none';
}

function _updateLightboxCounter(idx) {
  var counter = document.getElementById('lightboxCounter');
  if (!counter) return;
  if (galleryItems.length <= 1) { counter.innerHTML = ''; return; }
  var dots = '';
  var total = Math.min(galleryItems.length, 12);
  var start = Math.max(0, idx - 5);
  var end = Math.min(galleryItems.length - 1, start + total - 1);
  for (var i = start; i <= end; i++) {
    dots += '<span class="lb-dot' + (i === idx ? ' active' : '') + '"></span>';
  }
  counter.innerHTML = dots;
}

function lightboxNav(dir) {
  if (lbCurrentIdx < 0) return;
  var next = lbCurrentIdx + dir;
  if (next < 0 || next >= galleryItems.length) return;
  lbCurrentIdx = next;
  var wrap = document.getElementById('lightboxMediaWrap');

  // Animasi slide ringan
  wrap.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
  wrap.style.opacity = '0';
  wrap.style.transform = 'translateX(' + (dir > 0 ? '24px' : '-24px') + ')';

  setTimeout(function() {
    _renderLightboxItem(lbCurrentIdx);
    _updateLightboxNav();
    wrap.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    wrap.style.opacity = '1';
    wrap.style.transform = 'translateX(0)';
  }, 120);
}

function closeLightbox() {
  var lb = document.getElementById('lightbox');
  lb.classList.remove('show');
  var wrap = document.getElementById('lightboxMediaWrap');
  _clearLightboxMedia(wrap);
  var img = document.getElementById('lightboxImg');
  if (img) { img.src = ''; img.style.display = ''; }
  document.getElementById('lightboxCounter').innerHTML = '';
  lbCurrentIdx = -1;
  lbSwiping = false;
  // Restore body scroll
  document.body.style.overflow = '';
  // Reset wrap style
  if (wrap) { wrap.style.opacity = ''; wrap.style.transform = ''; wrap.style.transition = ''; }
}

// Swipe di lightbox overlay untuk navigasi
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    var lb = document.getElementById('lightbox');
    if (!lb) return;

    lb.addEventListener('touchstart', function(e) {
      // Jangan handle kalau klik tombol close/nav
      if (e.target.closest('.lightbox-close') || e.target.closest('.lightbox-prev') || e.target.closest('.lightbox-next')) return;
      lbSwipeStartX = e.touches[0].clientX;
      lbSwiping = false;
    }, { passive: true });

    lb.addEventListener('touchmove', function(e) {
      var dx = Math.abs(e.touches[0].clientX - lbSwipeStartX);
      var dy = Math.abs(e.touches[0].clientY - (e.touches[0].clientY)); // just dx check
      if (dx > 12) lbSwiping = true;
    }, { passive: true });

    lb.addEventListener('touchend', function(e) {
      if (!lbSwiping) return;
      var dx = e.changedTouches[0].clientX - lbSwipeStartX;
      lbSwiping = false;
      if (Math.abs(dx) > 60) lightboxNav(dx < 0 ? 1 : -1);
    });
  });
})();

// ========== KEY EVENTS ==========
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    if (document.getElementById('lightbox').classList.contains('show')) { closeLightbox(); return; }
    exitSelectionMode(); exitNoteSelectionMode();
  }
  if (e.key === 'ArrowLeft' && document.getElementById('lightbox').classList.contains('show')) lightboxNav(-1);
  if (e.key === 'ArrowRight' && document.getElementById('lightbox').classList.contains('show')) lightboxNav(1);
});
