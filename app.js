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

// Reply state
let replyTarget = null;

// Emoji picker state
let emojiPickerOpen = false;

// ========== MULTI-SELECT STATE ==========
// selectedMsgIds: Set of string IDs currently selected
let selectedMsgIds = new Set();
// selectionModeActive: true setelah long-press pertama
let selectionModeActive = false;

// Upload state
let pendingUploadFile = null;
let uploadXHR = null;

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
    valEl.textContent = (isCountdown?'':'-')+years+' Tahun '+months+' Bulan '+days+' Hari '+hours+' Jam '+minutes+' Menit '+seconds+' Detik';
  }
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
function doLogout() {
  if (!confirm('Yakin mau logout?')) return;
  stopChatSync(); stopCountdown();
  exitSelectionMode();
  sessionStorage.clear();
  currentAccount=null; pendingAccount=null;
  chatLoaded=false; notesLoaded=false; galleryLoaded=false;
  seenMsgIds.clear(); replyTarget=null;
  clearReplyBanner();
  closeEmojiPicker();
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
  var titles={Chat:'ChatRoom',Notes:'Catatan',Gallery:'Gallery'};
  document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active-tab');});
  document.querySelectorAll('.nav-item').forEach(function(b){
    var lbl=b.querySelector('span')?b.querySelector('span').textContent:'';
    b.classList.toggle('active',(name==='Chat'&&lbl==='Chat')||(name==='Notes'&&lbl==='Catatan')||(name==='Gallery'&&lbl==='Gallery'));
  });
  document.getElementById('tab'+name).classList.add('active-tab');
  document.getElementById('topbarTitle').textContent=titles[name]||name;
  if (name!=='Chat'){isChatActive=false;if(pollTimer){clearInterval(pollTimer);pollTimer=null;}}
  else { isChatActive=true; }
  if (name==='Notes') startCountdown(); else stopCountdown();
  if (name==='Chat') initChat();
  if (name==='Notes'&&!notesLoaded) loadNotes();
  if (name==='Gallery'&&!galleryLoaded) loadGallery();
}

// ========== MULTI-SELECT MODE ==========

/**
 * Masuk ke selection mode & tambah msgId ke set.
 * Dipanggil saat long-press pertama kali.
 */
function enterSelectionMode(msgId) {
  selectionModeActive = true;
  _addToSelection(msgId);
  _renderSelectionBar();
}

/**
 * Toggle select/unselect sebuah bubble saat selection mode aktif.
 * Dipanggil saat klik biasa (tanpa hold) pada bubble.
 */
function toggleMsgSelection(msgId) {
  if (!selectionModeActive) return;
  if (selectedMsgIds.has(msgId)) {
    _removeFromSelection(msgId);
  } else {
    _addToSelection(msgId);
  }
  // Jika semua bubble sudah di-unselect → auto-cancel
  if (selectedMsgIds.size === 0) {
    exitSelectionMode();
    return;
  }
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

  // Cek apakah user boleh hapus semua yg dipilih
  var isAdmin = currentAccount && currentAccount.role === 'admin';
  var canDeleteAll = isAdmin || _allSelectedAreOwn();

  bar.innerHTML =
    '<button class="sel-cancel-btn" onclick="exitSelectionMode()">✕ Batal</button>' +
    '<span class="sel-label">'+selectedMsgIds.size+' dipilih</span>' +
    (canDeleteAll
      ? '<button class="sel-delete-btn" onclick="delSelectedMsgs()">🗑 Hapus</button>'
      : '<span style="width:74px"></span>');
  bar.style.display = 'flex';
}

/** Cek apakah semua bubble yang dipilih milik currentAccount sendiri */
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
  var label = ids.length === 1 ? 'pesan ini' : ids.length + ' pesan ini';
  if (!confirm('Hapus ' + label + '?')) return;
  exitSelectionMode();
  // Hapus dari DB semua sekaligus
  var res = await sb.from('chat_messages').delete().in('id', ids);
  if (res.error) { toast('Gagal hapus', false); return; }
  ids.forEach(function(id) {
    var el = document.querySelector('[data-msg-id="'+id+'"]');
    if (el) el.remove();
    seenMsgIds.delete(String(id));
  });
  toast(ids.length === 1 ? 'Pesan dihapus' : ids.length + ' pesan dihapus');
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
  // Klik di luar bubble saat selection mode → exit
  if (selectionModeActive && !e.target.closest('[data-msg-id]') && !e.target.closest('#selectionBar')) {
    exitSelectionMode();
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
    summary.addEventListener('click',function(e){if(e.target===chevron||chevron.contains(e.target))return;openReadModal(n.id);});
    d.appendChild(summary); frag.appendChild(d);
  });
  el.appendChild(frag);
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
  if (!confirm('Hapus catatan ini?')) return;
  var res=await sb.from('notes').delete().eq('id',id);
  if (res.error){toast('Gagal hapus',false);return;}
  toast('Dihapus'); notesLoaded=false; loadNotes();
}

// ========== EMOJI PICKER ==========
const EMOJI_CATEGORIES = [
  { icon:'😀', label:'Smileys', emojis:['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','💫','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'] },
  { icon:'❤️', label:'Hearts', emojis:['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','✡️','🔯','🕎','☯️','☦️','🛐'] },
  { icon:'👋', label:'People', emojis:['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦿','🦶','👂','🦻','👃','🧠','🦷','🦴','👀','👁️','👅','👄','💋','🩸'] },
  { icon:'🐱', label:'Animals', emojis:['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🐙','🦑','🦐','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈'] },
  { icon:'🍎', label:'Food', emojis:['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🌶️','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🌮','🌯','🥗','🥘','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🍤','🍙','🍚','🍘','🍥','🥮','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🧃','🥤','🧋','☕','🍵','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🍾'] },
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
  return panel;
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
  replyBtn.onclick = function(e) {
    e.stopPropagation();
    closeMsgActionMenu();
    setReply(msgId, senderName, message);
  };
  menu.appendChild(replyBtn);
  if (canDelete) {
    var delBtn = document.createElement('button');
    delBtn.className = 'msg-action-item danger';
    delBtn.innerHTML = '✕ Hapus';
    delBtn.onclick = function(e) {
      e.stopPropagation();
      closeMsgActionMenu();
      delMsg(msgId);
    };
    menu.appendChild(delBtn);
  }
  var rect = anchorEl.getBoundingClientRect();
  var isMe = currentAccount && senderName === currentAccount.name;
  menu.style.position = 'fixed';
  menu.style.top = (rect.bottom + 4) + 'px';
  if (isMe) {
    menu.style.right = (window.innerWidth - rect.right) + 'px';
  } else {
    menu.style.left = rect.left + 'px';
  }
  document.body.appendChild(menu);
  activeMsgActionMenu = menu;
}

async function delMsg(id) {
  if (!confirm('Hapus pesan ini?')) return;
  var res = await sb.from('chat_messages').delete().eq('id', id);
  if (res.error) { toast('Gagal hapus', false); return; }
  var el = document.querySelector('[data-msg-id="'+id+'"]');
  if (el) el.remove();
  toast('Pesan dihapus');
}

// ========== CHAT UPLOAD (via chat bar - no confirm modal) ==========
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
  } catch(err) {
    toast('Upload gagal', false); input.value=''; return;
  }
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

// ========== GALLERY UPLOAD CONFIRM MODAL ==========
function triggerUploadConfirm(input) {
  if (!currentAccount || currentAccount.role !== 'admin') {
    toast('Hanya admin yang bisa upload', false);
    input.value = '';
    return;
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
  goBtn.disabled = false;
  goBtn.textContent = 'Upload';
  cancelBtn.textContent = 'Batal';
  closeBtn.style.display = '';

  document.getElementById('uploadConfirmModal').classList.add('show');
  input.value = '';
}

function cancelUploadModal() {
  if (uploadXHR) {
    try { uploadXHR.abort(); } catch(e){}
    uploadXHR = null;
  }
  pendingUploadFile = null;
  document.getElementById('uploadConfirmModal').classList.remove('show');
}

async function startGalleryUpload() {
  if (!pendingUploadFile) return;
  var file = pendingUploadFile;

  var goBtn = document.getElementById('uploadGoBtn');
  var cancelBtn = document.getElementById('uploadCancelBtn');
  var closeBtn = document.getElementById('uploadModalCloseBtn');

  goBtn.disabled = true;
  goBtn.textContent = 'Mengupload...';
  closeBtn.style.display = 'none';
  cancelBtn.textContent = 'Batalkan';

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

      xhr.onload = function() {
        uploadXHR = null;
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error('HTTP ' + xhr.status));
      };
      xhr.onerror = function() { uploadXHR = null; reject(new Error('Network error')); };
      xhr.onabort = function() { uploadXHR = null; reject(new Error('Dibatalkan')); };
      xhr.send(file);
    });
    success = true;
  } catch(err) {
    if (err.message === 'Dibatalkan') {
      toast('Upload dibatalkan', false);
    } else {
      toast('Upload gagal: ' + err.message, false);
    }
    goBtn.disabled = false;
    goBtn.textContent = 'Upload';
    cancelBtn.textContent = 'Batal';
    closeBtn.style.display = '';
    document.getElementById('uploadProgressWrap').style.display = 'none';
    document.getElementById('uploadConfirmModal').classList.remove('show');
    pendingUploadFile = null;
    return;
  }

  if (!success) return;

  var pub = sb.storage.from('gallery').getPublicUrl(name);
  var dbRes = await sb.from('gallery').insert([{file_url: pub.data.publicUrl, file_name: name}]);

  if (dbRes.error) {
    toast('Gagal simpan: ' + dbRes.error.message, false);
  } else {
    toast('Berhasil diupload ✓');
    galleryLoaded = false;
    loadGallery();
  }

  pendingUploadFile = null;
  uploadXHR = null;
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

  // Action button (inside bubble, center-vertical)
  var actionBtn = document.createElement('button');
  actionBtn.className = 'bubble-action-btn';
  actionBtn.title = 'Opsi';
  actionBtn.textContent = '⋮';
  actionBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    // Jangan tampilkan menu saat selection mode
    if (selectionModeActive) return;
    showMsgActionMenu(m.id, m.sender_name, m.message || '', actionBtn);
  });

  // Reply preview
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

  // Build bubble
  var bubble = document.createElement('div');
  if (mediaUrl) {
    bubble.className = 'bubble bubble-media';
  } else {
    bubble.className = 'bubble';
  }

  // Action button (absolutely positioned, vertical center)
  bubble.appendChild(actionBtn);

  // Reply preview
  if (replyEl) bubble.appendChild(replyEl);

  // Content
  if (isImgMsg && mediaUrl) {
    var img = document.createElement('img');
    img.src = mediaUrl;
    img.className = 'bubble-img';
    img.loading = 'lazy';
    img.onclick = function(e) { e.stopPropagation(); openLightbox(mediaUrl); };
    bubble.appendChild(img);
  } else if (isVidMsg && mediaUrl) {
    var vid = document.createElement('video');
    vid.src = mediaUrl;
    vid.className = 'bubble-vid';
    vid.preload = 'metadata';
    vid.controls = true;
    vid.playsInline = true;
    bubble.appendChild(vid);
  } else {
    // PENTING: gunakan textContent untuk preserve newline.
    // CSS `white-space: pre-wrap` di .bubble akan merender \n dengan benar.
    var textNode = document.createTextNode(msgContent);
    bubble.appendChild(textNode);
  }

  // Time
  var btime = document.createElement('span');
  btime.className = 'btime';
  btime.textContent = fmtTime(m.created_at);
  bubble.appendChild(btime);

  // Sender label (theirs only)
  var blockInner = document.createElement('div');
  blockInner.className = 'msg-block-inner';
  if (!isMe) {
    var senderSpan = document.createElement('span');
    senderSpan.className = 'msg-sender';
    senderSpan.style.color = nameColor;
    senderSpan.textContent = m.sender_name + roleTag;
    blockInner.appendChild(senderSpan);
  }
  blockInner.appendChild(bubble);

  var msgBlock = document.createElement('div');
  msgBlock.className = 'msg-block';
  msgBlock.appendChild(blockInner);

  var swipeWrap = document.createElement('div');
  swipeWrap.className = 'msg-swipe-wrap';
  swipeWrap.appendChild(msgBlock);

  d.appendChild(swipeWrap);

  // Touch interactions
  initLongPressSelect(d, m, canDelete);
  initSwipeReply(d, m);

  return d;
}

// ========== LONG-PRESS → ENTER SELECTION MODE ==========
function initLongPressSelect(rowEl, m, canDelete) {
  var bubble = rowEl.querySelector('.bubble');
  if (!bubble) return;
  var pressTimer = null;
  var moved = false;
  var touchStartX = 0, touchStartY = 0;

  bubble.addEventListener('touchstart', function(e) {
    // Abaikan klik di action button
    if (e.target.closest('.bubble-action-btn')) return;

    // Jika selection mode sudah aktif → klik biasa = toggle
    if (selectionModeActive) {
      // Tidak handle di sini — akan di-handle di touchend
      return;
    }

    moved = false;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;

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
    if (dx > 8 || dy > 8) {
      moved = true;
      clearTimeout(pressTimer);
    }
  }, { passive: true });

  bubble.addEventListener('touchend', function(e) {
    clearTimeout(pressTimer);

    // Jika selection mode aktif & tidak bergerak → toggle select
    if (selectionModeActive && !moved && m.id) {
      // Cegah event lain (mis. swipe)
      e.stopPropagation();
      toggleMsgSelection(String(m.id));
    }
    moved = false;
  });

  bubble.addEventListener('touchcancel', function() {
    clearTimeout(pressTimer);
    moved = false;
  });
}

// ========== SWIPE TO REPLY ==========
function initSwipeReply(rowEl, m) {
  var swipeWrap = rowEl.querySelector('.msg-swipe-wrap');
  var startX = 0, startY = 0, dx = 0, swiping = false, triggered = false;

  swipeWrap.addEventListener('touchstart', function(e) {
    var t = e.touches[0];
    startX = t.clientX; startY = t.clientY;
    dx = 0; swiping = false; triggered = false;
  }, { passive: true });

  swipeWrap.addEventListener('touchmove', function(e) {
    // Disable swipe saat selection mode
    if (selectionModeActive) return;
    var t = e.touches[0];
    dx = t.clientX - startX;
    var dy = Math.abs(t.clientY - startY);
    if (!swiping && Math.abs(dx) > dy && Math.abs(dx) > 8) { swiping = true; }
    if (!swiping) return;
    var swipeDist = Math.max(0, dx);
    var clamped = Math.min(swipeDist, 72);
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
    if (!selectionModeActive && triggered && dx >= 60) {
      setReply(m.id, m.sender_name, m.message || '');
    }
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
  var ph = el.querySelector('.state-msg');
  if (ph) el.innerHTML = '';
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
        if (pend) {
          pend.dataset.msgId = newId;
          seenMsgIds.add(newId);
          pend.removeAttribute('data-pending');
          return;
        }
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
    res.data.slice().reverse().forEach(function(m){
      if (m.id && !seenMsgIds.has(String(m.id))) appendMsg(m, false);
    });
  }, 4000);
}

var isSending = false;

async function sendMsg() {
  if (isSending) return;
  var input = document.getElementById('chatInput');
  // PENTING: ambil value SEBELUM trim untuk menjaga newline.
  // Hanya trim whitespace di awal & akhir, bukan di tengah.
  var rawMsg = input.value;
  var msg = rawMsg.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, ''); // trim awal & akhir saja
  if (!msg || !currentAccount) return;
  isSending = true;
  input.value = '';
  input.style.height = '';
  input.focus();

  var insertData = {
    message: msg, user_id: uid,
    sender_name: currentAccount.name, sender_role: currentAccount.role
  };
  if (replyTarget) {
    insertData.reply_to_id = replyTarget.id;
    insertData.reply_to_name = replyTarget.sender_name;
    insertData.reply_to_text = replyTarget.message;
  }

  var fakeMsg = {
    message: msg, sender_name: currentAccount.name, sender_role: currentAccount.role,
    user_id: uid, created_at: new Date().toISOString(),
    reply_to_name: insertData.reply_to_name, reply_to_text: insertData.reply_to_text
  };
  clearReplyBanner();

  var el = document.getElementById('chatList');
  var ph = el.querySelector('.state-msg'); if (ph) el.innerHTML = '';
  var msgEl = buildMsgEl(fakeMsg); msgEl.dataset.pending = '1';
  el.appendChild(msgEl); scrollBottom(el, true);

  var res = await sb.from('chat_messages').insert([insertData]);
  isSending = false;
  if (res.error){
    var pend = el.querySelector('[data-pending]'); if (pend) pend.remove();
    toast('Gagal kirim', false); input.value = msg; return;
  }
  setTimeout(async function(){
    var pend = el.querySelector('[data-pending]'); if (!pend) return;
    var r = await sb.from('chat_messages').select('id').order('created_at',{ascending:false}).limit(1);
    if (r.data&&r.data[0]){
      var newId = String(r.data[0].id);
      if (!seenMsgIds.has(newId)) seenMsgIds.add(newId);
      pend.dataset.msgId = newId;
      pend.removeAttribute('data-pending');
    }
  }, 800);
}

// ========== GALLERY ==========
async function loadGallery() {
  var el=document.getElementById('galleryGrid');
  el.innerHTML='<p class="state-msg">Memuat...</p>';
  var res=await sb.from('gallery').select('*').order('created_at',{ascending:false});
  if (res.error){el.innerHTML='<p class="state-msg err">Error: '+res.error.message+'</p>';return;}
  galleryLoaded=true;
  if (!res.data||!res.data.length){el.innerHTML='<p class="state-msg">Belum ada media.</p>';return;}
  el.innerHTML='';
  var isAdmin=currentAccount&&currentAccount.role==='admin';
  var frag=document.createDocumentFragment();
  res.data.forEach(function(f){
    var isVid=/\.(mp4|webm|mov|avi)$/i.test(f.file_name||'');
    var d=document.createElement('div'); d.className='g-item';
    if (isVid){
      var thumb=document.createElement('div'); thumb.className='g-video-thumb';
      thumb.style.cssText='position:relative;width:100%;height:100%;';
      var vid=document.createElement('video');
      vid.className='g-media g-video-preview';
      vid.preload='metadata'; vid.muted=true; vid.playsInline=true;
      vid.src=f.file_url+'#t=0.001';
      var playIcon=document.createElement('div'); playIcon.className='g-play-icon';
      playIcon.innerHTML='<svg viewBox="0 0 24 24" fill="white" width="28" height="28"><circle cx="12" cy="12" r="12" fill="rgba(0,0,0,0.5)"/><polygon points="10,8 18,12 10,16" fill="white"/></svg>';
      thumb.appendChild(vid); thumb.appendChild(playIcon);
      thumb.onclick=function(){openVideoLightbox(f.file_url);};
      d.appendChild(thumb);
    } else {
      var img=document.createElement('img'); img.src=f.file_url; img.className='g-media';
      img.loading='lazy'; img.decoding='async'; img.onclick=function(){openLightbox(f.file_url);};
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
  if (!confirm('Hapus media ini?')) return;
  await sb.storage.from('gallery').remove([name]);
  var res=await sb.from('gallery').delete().eq('id',id);
  if (res.error){toast('Gagal hapus',false);return;}
  toast('Dihapus'); galleryLoaded=false; loadGallery();
}

// ========== LIGHTBOX ==========
function openLightbox(url) {
  document.getElementById('lightboxImg').src = url;
  document.getElementById('lightboxImg').style.display = '';
  var vl = document.getElementById('lightboxVideo');
  if (vl) { vl.pause(); vl.src=''; vl.remove(); }
  document.getElementById('lightbox').classList.add('show');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('show');
  document.getElementById('lightboxImg').src = '';
  document.getElementById('lightboxImg').style.display = '';
  var vl = document.getElementById('lightboxVideo');
  if (vl) { vl.pause(); vl.src=''; vl.remove(); }
}

function openVideoLightbox(url) {
  var lb = document.getElementById('lightbox');
  document.getElementById('lightboxImg').style.display = 'none';
  var vl = document.getElementById('lightboxVideo');
  if (!vl) {
    vl = document.createElement('video');
    vl.id = 'lightboxVideo';
    vl.controls = true;
    vl.style.cssText = 'max-width:94vw;max-height:88vh;border-radius:10px;object-fit:contain;';
    lb.appendChild(vl);
  }
  vl.src = url;
  vl.play();
  lb.classList.add('show');
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeLightbox();
    exitSelectionMode();
  }
});
