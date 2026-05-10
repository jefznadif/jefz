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

// Chat
let chatChannel = null;
let isChatActive = false;
let chatLoaded = false;
let seenMsgIds = new Set();
let pollTimer = null;

// ========== BOOT ==========
window.onload = function () {
  applyTheme();
  var auth = sessionStorage.getItem('auth');
  var accName = sessionStorage.getItem('accName');
  var t = sessionStorage.getItem('authTime');
  if (auth && accName && t && (Date.now() - parseInt(t)) < 3600000) {
    currentAccount = {
      name: accName,
      role: sessionStorage.getItem('accRole'),
      color: ACCOUNTS[accName] ? ACCOUNTS[accName].color : '#3d5afe'
    };
    showDash();
  }
};

// ========== THEME ==========
function applyTheme() {
  document.body.classList.toggle('dark', dark);
  var icon = document.getElementById('themeBtnIcon');
  var label = document.getElementById('themeBtnLabel');
  if (icon) icon.textContent = dark ? '☀️' : '🌙';
  if (label) label.textContent = dark ? 'Light Mode' : 'Dark Mode';
}
function toggleTheme() {
  dark = !dark;
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  applyTheme();
}

// ========== TOAST ==========
var toastTimer;
function toast(msg, ok) {
  if (ok === undefined) ok = true;
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + (ok ? 'ok' : 'err');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.className = 'toast'; }, 2800);
}

// ========== LOGIN ==========
var pendingAccount = null;

function selectAccount(name, role) {
  pendingAccount = { name: name, role: role, color: ACCOUNTS[name] ? ACCOUNTS[name].color : '#3d5afe' };
  document.getElementById('stepAccount').style.display = 'none';
  document.getElementById('stepPin').style.display = 'block';
  document.getElementById('selectedAccInfo').innerHTML =
    '<div class="sel-acc">' +
      '<div class="acc-avatar-lg" style="background:' + pendingAccount.color + '">' + name.charAt(0).toUpperCase() + '</div>' +
      '<div><div class="sel-name">' + name + '</div>' +
      '<div class="sel-role">' + (role === 'admin' ? '👑 Admin' : '👤 User') + '</div></div>' +
    '</div>';
  setTimeout(function () { document.getElementById('pinInput').focus(); }, 100);
  document.getElementById('pinInput').onkeydown = function(e) { if (e.key === 'Enter') doLogin(); };
}

function backToAccount() {
  pendingAccount = null;
  document.getElementById('stepPin').style.display = 'none';
  document.getElementById('stepAccount').style.display = 'block';
  document.getElementById('pinInput').value = '';
  document.getElementById('loginErr').textContent = '';
}

function doLogin() {
  var pin = document.getElementById('pinInput').value;
  var errEl = document.getElementById('loginErr');
  errEl.textContent = '';
  if (!pin) { errEl.textContent = 'Masukkan PIN terlebih dahulu'; return; }
  if (!pendingAccount) return;
  var acc = ACCOUNTS[pendingAccount.name];
  if (!acc) { errEl.textContent = 'Akun tidak ditemukan'; return; }
  if (pin === acc.pin) {
    currentAccount = pendingAccount;
    sessionStorage.setItem('auth', '1');
    sessionStorage.setItem('authTime', Date.now().toString());
    sessionStorage.setItem('accName', currentAccount.name);
    sessionStorage.setItem('accRole', currentAccount.role);
    sessionStorage.setItem('activeTab', 'Chat');
    document.getElementById('pinInput').value = '';
    showDash();
  } else {
    errEl.textContent = 'PIN salah, coba lagi';
    document.getElementById('pinInput').value = '';
    document.getElementById('pinInput').focus();
  }
}

function doLogout() {
  if (!confirm('Yakin mau logout?')) return;
  stopChatSync();
  sessionStorage.clear();
  currentAccount = null;
  pendingAccount = null;
  chatLoaded = false;
  seenMsgIds.clear();
  document.getElementById('stepPin').style.display = 'none';
  document.getElementById('stepAccount').style.display = 'block';
  document.getElementById('pinInput').value = '';
  document.getElementById('loginErr').textContent = '';
  document.getElementById('dashPage').className = 'page';
  document.getElementById('loginPage').className = 'page active';
}

function stopChatSync() {
  isChatActive = false;
  if (chatChannel) { try { sb.removeChannel(chatChannel); } catch(e){} chatChannel = null; }
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

// ========== SHOW DASH ==========
function showDash() {
  document.getElementById('loginPage').className = 'page';
  document.getElementById('dashPage').className = 'page active';
  var avatarEl = document.getElementById('topbarAvatar');
  avatarEl.textContent = currentAccount.name.charAt(0).toUpperCase();
  avatarEl.style.background = currentAccount.color;
  document.getElementById('topbarUser').textContent =
    currentAccount.name + (currentAccount.role === 'admin' ? ' 👑' : ' 👤');
  var ul = document.getElementById('uploadLabel');
  if (ul) ul.style.display = currentAccount.role === 'admin' ? 'inline-block' : 'none';
  var lastTab = sessionStorage.getItem('activeTab') || 'Chat';
  activateTab(lastTab);
}

// ========== TABS ==========
function goTab(name, title, btn) {
  sessionStorage.setItem('activeTab', name);
  activateTab(name);
}

function activateTab(name) {
  var titles = { Chat: 'ChatRoom', Notes: 'Catatan', Gallery: 'Gallery' };
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active-tab'); });
  document.querySelectorAll('.nav-item').forEach(function(b) {
    var lbl = b.querySelector('span') ? b.querySelector('span').textContent : '';
    b.classList.toggle('active',
      (name==='Chat'&&lbl==='Chat') || (name==='Notes'&&lbl==='Catatan') || (name==='Gallery'&&lbl==='Gallery')
    );
  });
  document.getElementById('tab' + name).classList.add('active-tab');
  document.getElementById('topbarTitle').textContent = titles[name] || name;

  if (name !== 'Chat') {
    isChatActive = false;
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  } else {
    isChatActive = true;
  }

  if (name === 'Chat') initChat();
  if (name === 'Notes') loadNotes();
  if (name === 'Gallery') loadGallery();
}

// ========== HELPERS ==========
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function decodeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}
function fmtDate(d) {
  return new Date(d).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function fmtTime(d) {
  return new Date(d).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
}
function scrollBottom(el, smooth) {
  if (!el) return;
  requestAnimationFrame(function() {
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
  });
}

// ========== NOTES ==========
var notesCache = {};
var activeNoteOptionMenu = null;

function closeActiveOptionMenu() {
  if (activeNoteOptionMenu && activeNoteOptionMenu.parentNode) {
    activeNoteOptionMenu.remove();
  }
  activeNoteOptionMenu = null;
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.note-chevron') && !e.target.closest('.read-author-option') && !e.target.closest('.note-options-menu')) {
    closeActiveOptionMenu();
  }
});

function showNoteOptions(cardElement, noteId, anchorElement) {
  closeActiveOptionMenu();
  
  var n = notesCache[noteId];
  if (!n) return;
  
  var isAdmin = currentAccount && currentAccount.role === 'admin';
  var isOwner = currentAccount && n.author === currentAccount.name;
  var canEdit = isAdmin || isOwner;
  
  if (!canEdit) return;
  
  var menu = document.createElement('div');
  menu.className = 'note-options-menu';
  
  var editBtn = document.createElement('button');
  editBtn.textContent = '✏ Edit';
  editBtn.className = 'note-option-item edit';
  editBtn.onclick = function(e) {
    e.stopPropagation();
    closeActiveOptionMenu();
    openEditModal(noteId);
  };
  
  var delBtn = document.createElement('button');
  delBtn.textContent = '✕ Hapus';
  delBtn.className = 'note-option-item delete';
  delBtn.onclick = function(e) {
    e.stopPropagation();
    closeActiveOptionMenu();
    delNote(noteId);
  };
  
  menu.appendChild(editBtn);
  menu.appendChild(delBtn);
  
  var rect = anchorElement.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
  menu.style.right = (window.innerWidth - rect.right) + 'px';
  
  document.body.appendChild(menu);
  activeNoteOptionMenu = menu;
}

async function loadNotes() {
  closeActiveOptionMenu();
  var el = document.getElementById('notesList');
  el.innerHTML = '<p class="state-msg">Memuat...</p>';
  var res = await sb.from('notes').select('*').order('created_at', { ascending: true });
  if (res.error) { el.innerHTML = '<p class="state-msg err">Error: ' + res.error.message + '</p>'; return; }
  if (!res.data || !res.data.length) { el.innerHTML = '<p class="state-msg">Belum ada catatan.</p>'; return; }

  el.innerHTML = '';
  notesCache = {};

  res.data.forEach(function(n) {
    notesCache[n.id] = n;

    var isAdmin = currentAccount && currentAccount.role === 'admin';
    var isOwner = currentAccount && n.author === currentAccount.name;
    var canEdit = isAdmin || isOwner;

    var preview = (n.content || '').replace(/\n/g,' ').trim();
    if (preview.length > 60) preview = preview.slice(0, 60) + '…';
    var authorColor = n.author === "Jef'z" ? '#007aff' : '#e91e8c';

    var d = document.createElement('div');
    d.className = 'note-card';
    d.dataset.nid = n.id;

    var summary = document.createElement('div');
    summary.className = 'note-summary';

    var sumMain = document.createElement('div');
    sumMain.className = 'note-sum-main';

    var ttl = document.createElement('span');
    ttl.className = 'note-ttl';
    ttl.textContent = n.title;
    sumMain.appendChild(ttl);

    if (preview) {
      var prev = document.createElement('span');
      prev.className = 'note-preview';
      prev.textContent = preview;
      sumMain.appendChild(prev);
    }

    var sumMeta = document.createElement('div');
    sumMeta.className = 'note-sum-meta';
    
    var authorDot = document.createElement('span');
    authorDot.className = 'note-author-dot';
    authorDot.style.background = authorColor;
    
    var authorName = document.createElement('span');
    authorName.className = 'note-author-name';
    authorName.textContent = n.author || '';
    
    sumMeta.appendChild(authorDot);
    sumMeta.appendChild(authorName);
    
    var chevron = document.createElement('span');
    chevron.className = 'note-chevron';
    chevron.textContent = '›';
    if (canEdit) {
      chevron.style.cursor = 'pointer';
      chevron.onclick = function(e) {
        e.stopPropagation();
        showNoteOptions(d, n.id, chevron);
      };
    } else {
      chevron.style.opacity = '0.3';
    }
    sumMeta.appendChild(chevron);

    summary.appendChild(sumMain);
    summary.appendChild(sumMeta);

    summary.addEventListener('click', function(e) {
      if (e.target === chevron || chevron.contains(e.target)) return;
      openReadModal(n.id);
    });

    d.appendChild(summary);
    el.appendChild(d);
  });

  setTimeout(function() {
    el.scrollTop = el.scrollHeight;
  }, 60);
}

function openReadModal(id) {
  var n = notesCache[id];
  if (n) {
    _renderReadModal(n);
  } else {
    sb.from('notes').select('*').eq('id', id).single().then(function(res) {
      if (res.error || !res.data) return;
      _renderReadModal(res.data);
    });
  }
}

function _renderReadModal(n) {
  document.getElementById('readModalTitle').textContent = n.title;
  var authorColor = n.author === "Jef'z" ? '#007aff' : '#e91e8c';
  var authorHtml = '<span class="read-author-dot" style="background:' + authorColor + '"></span>' + esc(n.author || '');
  
  var isAdmin = currentAccount && currentAccount.role === 'admin';
  var isOwner = currentAccount && n.author === currentAccount.name;
  var canEdit = isAdmin || isOwner;
  
  if (canEdit) {
    authorHtml += '<span class="read-author-option" data-note-id="' + n.id + '" style="margin-left:auto; font-size:18px; color:var(--text3); cursor:pointer; padding:4px 0 4px 12px; line-height:1;">⋮</span>';
  }
  
  document.getElementById('readModalAuthor').innerHTML = authorHtml;
  document.getElementById('readModalBody').textContent = n.content || '(Tidak ada isi)';
  document.getElementById('readModalTs').textContent = fmtDate(n.created_at);
  document.getElementById('readModal').classList.add('show');
  
  window.currentReadNoteId = n.id;
  
  var optionBtn = document.querySelector('#readModalAuthor .read-author-option');
  if (optionBtn) {
    optionBtn.onclick = function(e) {
      e.stopPropagation();
      showReadModalOption(n.id, e);
    };
  }
}

function showReadModalOption(noteId, event) {
  event.stopPropagation();
  closeActiveOptionMenu();
  
  var n = notesCache[noteId];
  if (!n) return;
  
  var isAdmin = currentAccount && currentAccount.role === 'admin';
  var isOwner = currentAccount && n.author === currentAccount.name;
  var canEdit = isAdmin || isOwner;
  
  if (!canEdit) return;
  
  var anchor = event.target;
  var rect = anchor.getBoundingClientRect();
  
  var menu = document.createElement('div');
  menu.className = 'note-options-menu';
  
  var editBtn = document.createElement('button');
  editBtn.textContent = '✏ Edit';
  editBtn.className = 'note-option-item edit';
  editBtn.onclick = function(e) {
    e.stopPropagation();
    closeActiveOptionMenu();
    document.getElementById('readModal').classList.remove('show');
    setTimeout(function() {
      openEditModal(noteId);
    }, 200);
  };
  
  var delBtn = document.createElement('button');
  delBtn.textContent = '✕ Hapus';
  delBtn.className = 'note-option-item delete';
  delBtn.onclick = function(e) {
    e.stopPropagation();
    closeActiveOptionMenu();
    document.getElementById('readModal').classList.remove('show');
    setTimeout(function() {
      delNote(noteId);
    }, 200);
  };
  
  menu.appendChild(editBtn);
  menu.appendChild(delBtn);
  
  menu.style.position = 'fixed';
  menu.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
  menu.style.right = (window.innerWidth - rect.right) + 'px';
  
  document.body.appendChild(menu);
  activeNoteOptionMenu = menu;
}

function closeReadModal(e) {
  if (e && e.target !== document.getElementById('readModal')) return;
  document.getElementById('readModal').classList.remove('show');
  window.currentReadNoteId = null;
  closeActiveOptionMenu();
}

function openNoteModal() {
  document.getElementById('noteTitleInput').value = '';
  document.getElementById('noteBodyInput').value = '';
  document.getElementById('noteModal').classList.add('show');
  setTimeout(function() { document.getElementById('noteTitleInput').focus(); }, 120);
}
function closeNoteModal(e) {
  if (e && e.target !== document.getElementById('noteModal')) return;
  document.getElementById('noteModal').classList.remove('show');
}

async function addNote() {
  var title = document.getElementById('noteTitleInput').value.trim();
  var content = document.getElementById('noteBodyInput').value.trim();
  if (!title) { toast('Judul tidak boleh kosong!', false); return; }
  var res = await sb.from('notes').insert([{ title: title, content: content, author: currentAccount ? currentAccount.name : '' }]);
  if (res.error) { toast('Gagal: ' + res.error.message, false); return; }
  document.getElementById('noteModal').classList.remove('show');
  toast('Catatan ditambahkan ✓');
  loadNotes();
}

function openEditModal(id) {
  var n = notesCache[id];
  if (!n) return;
  
  // Set nilai ke input
  document.getElementById('editTitleInput').value = n.title || '';
  document.getElementById('editBodyInput').value = n.content || '';
  document.getElementById('editNoteId').value = id;
  
  // Siapkan modal edit dengan tampilan sama persis seperti read modal
  var editModal = document.getElementById('editModal');
  var modalContent = editModal.querySelector('.modal-box');
  
  // Tambahkan class modal-read dan modal-edit untuk styling yang sama
  editModal.classList.add('modal-edit');
  if (modalContent) modalContent.classList.add('modal-read');
  
  var modalTitle = editModal.querySelector('.modal-title');
  if (modalTitle) modalTitle.textContent = 'Edit Catatan';
  
  // Tampilkan modal edit
  editModal.classList.add('show');
  setTimeout(function() { document.getElementById('editTitleInput').focus(); }, 120);
}

function closeEditModal(e) {
  if (e && e.target !== document.getElementById('editModal')) return;
  var editModal = document.getElementById('editModal');
  var modalContent = editModal.querySelector('.modal-box');
  
  editModal.classList.remove('show');
  editModal.classList.remove('modal-edit');
  if (modalContent) modalContent.classList.remove('modal-read');
}

async function saveEditNote() {
  var id = document.getElementById('editNoteId').value;
  var newTitle = document.getElementById('editTitleInput').value.trim();
  var newContent = document.getElementById('editBodyInput').value.trim();
  if (!newTitle) { toast('Judul tidak boleh kosong!', false); return; }
  var res = await sb.from('notes').update({ title: newTitle, content: newContent }).eq('id', id);
  if (res.error) { toast('Gagal edit: ' + res.error.message, false); return; }
  closeEditModal();
  toast('Catatan diperbarui ✓');
  loadNotes();
}

async function delNote(id) {
  if (!confirm('Hapus catatan ini?')) return;
  var res = await sb.from('notes').delete().eq('id', id);
  if (res.error) { toast('Gagal hapus', false); return; }
  toast('Dihapus');
  loadNotes();
}

// ========== CHAT ==========
function buildMsgEl(m) {
  var isMe = currentAccount && m.sender_name === currentAccount.name;
  var d = document.createElement('div');
  d.className = 'msg-row ' + (isMe ? 'mine' : 'theirs');
  if (m.id) d.dataset.msgId = String(m.id);
  var nameColor = m.sender_name === "Jef'z" ? '#3d5afe' : '#e91e8c';
  var roleTag = m.sender_role === 'admin' ? ' 👑' : '';
  d.innerHTML =
    '<div class="msg-block">' +
      (!isMe ? '<span class="msg-sender" style="color:' + nameColor + '">' + esc(m.sender_name) + roleTag + '</span>' : '') +
      '<div class="bubble">' + esc(m.message) + '<span class="btime">' + fmtTime(m.created_at) + '</span></div>' +
    '</div>';
  return d;
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
  isChatActive = true;
  chatLoaded = false;
  seenMsgIds.clear();
  var el = document.getElementById('chatList');
  el.innerHTML = '<p class="state-msg">Memuat...</p>';

  var res = await sb.from('chat_messages').select('*').order('created_at', { ascending: true });
  if (res.error) { el.innerHTML = '<p class="state-msg err">Error: ' + res.error.message + '</p>'; return; }

  el.innerHTML = '';
  chatLoaded = true;

  if (!res.data || !res.data.length) {
    el.innerHTML = '<p class="state-msg">Belum ada pesan. Mulai chat!</p>';
  } else {
    res.data.forEach(function(m) {
      if (m.id) seenMsgIds.add(String(m.id));
      el.appendChild(buildMsgEl(m));
    });
    scrollBottom(el, false);
  }

  startChatSync();
}

function startChatSync() {
  if (chatChannel) { try { sb.removeChannel(chatChannel); } catch(e){} chatChannel = null; }
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }

  chatChannel = sb.channel('chat_live_' + Date.now(), {
    config: { broadcast: { self: false } }
  })
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'chat_messages' },
    function(payload) {
      if (!isChatActive || !payload.new) return;
      if (currentAccount && payload.new.sender_name === currentAccount.name) {
        var el = document.getElementById('chatList');
        var pend = el.querySelector('[data-pending]');
        if (pend) {
          pend.dataset.msgId = String(payload.new.id);
          seenMsgIds.add(String(payload.new.id));
          pend.removeAttribute('data-pending');
          return;
        }
      }
      appendMsg(payload.new, true);
    }
  )
  .subscribe();

  pollTimer = setInterval(async function() {
    if (!isChatActive || !chatLoaded) return;
    var res = await sb.from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (res.error || !res.data) return;
    var msgs = res.data.slice().reverse();
    msgs.forEach(function(m) {
      appendMsg(m, false);
    });
  }, 3000);
}

async function sendMsg() {
  var input = document.getElementById('chatInput');
  var msg = input.value.trim();
  if (!msg || !currentAccount) return;

  input.value = '';
  input.focus();

  var fakeMsg = {
    message: msg,
    sender_name: currentAccount.name,
    sender_role: currentAccount.role,
    user_id: uid,
    created_at: new Date().toISOString()
  };
  var el = document.getElementById('chatList');
  var ph = el.querySelector('.state-msg');
  if (ph) el.innerHTML = '';
  var msgEl = buildMsgEl(fakeMsg);
  msgEl.dataset.pending = '1';
  el.appendChild(msgEl);
  scrollBottom(el, true);

  var res = await sb.from('chat_messages').insert([{
    message: msg,
    user_id: uid,
    sender_name: currentAccount.name,
    sender_role: currentAccount.role
  }]);

  if (res.error) {
    var pend = el.querySelector('[data-pending]');
    if (pend) pend.remove();
    toast('Gagal kirim', false);
    input.value = msg;
    return;
  }

  setTimeout(async function() {
    var pend = el.querySelector('[data-pending]');
    if (!pend) return;
    var r = await sb.from('chat_messages')
      .select('*').order('created_at', { ascending: false }).limit(1);
    if (r.data && r.data[0]) {
      pend.dataset.msgId = String(r.data[0].id);
      seenMsgIds.add(String(r.data[0].id));
      pend.removeAttribute('data-pending');
    }
  }, 1200);
}

// ========== GALLERY ==========
async function loadGallery() {
  var el = document.getElementById('galleryGrid');
  el.innerHTML = '<p class="state-msg">Memuat...</p>';
  var res = await sb.from('gallery').select('*').order('created_at', { ascending: false });
  if (res.error) { el.innerHTML = '<p class="state-msg err">Error: ' + res.error.message + '</p>'; return; }
  if (!res.data || !res.data.length) { el.innerHTML = '<p class="state-msg">Belum ada media.</p>'; return; }
  el.innerHTML = '';
  var isAdmin = currentAccount && currentAccount.role === 'admin';
  res.data.forEach(function(f) {
    var isVid = /\.(mp4|webm|mov|avi)$/i.test(f.file_name || '');
    var d = document.createElement('div');
    d.className = 'g-item';
    d.innerHTML = isVid
      ? '<video src="' + esc(f.file_url) + '" class="g-media" controls></video>'
      : '<img src="' + esc(f.file_url) + '" class="g-media" onclick="openLightbox(\'' + esc(f.file_url) + '\')" loading="lazy"/>';
    if (isAdmin) {
      d.innerHTML += '<button class="g-del" onclick="delMedia(\'' + f.id + '\',\'' + esc(f.file_name) + '\')">✕</button>';
    }
    el.appendChild(d);
  });
}

async function doUpload(input) {
  if (!currentAccount || currentAccount.role !== 'admin') { toast('Hanya admin yang bisa upload', false); return; }
  var file = input.files[0];
  if (!file) return;
  toast('Mengupload...');
  var ext = file.name.split('.').pop();
  var name = Date.now() + '_' + Math.random().toString(36).slice(2,6) + '.' + ext;
  var upRes = await sb.storage.from('gallery').upload(name, file, { cacheControl: '3600', upsert: false });
  if (upRes.error) { toast('Upload gagal: ' + upRes.error.message, false); input.value = ''; return; }
  var pub = sb.storage.from('gallery').getPublicUrl(name);
  var dbRes = await sb.from('gallery').insert([{ file_url: pub.data.publicUrl, file_name: name }]);
  if (dbRes.error) { toast('Gagal simpan: ' + dbRes.error.message, false); input.value = ''; return; }
  toast('Berhasil diupload ✓');
  input.value = '';
  loadGallery();
}

async function delMedia(id, name) {
  if (!currentAccount || currentAccount.role !== 'admin') return;
  if (!confirm('Hapus media ini?')) return;
  await sb.storage.from('gallery').remove([name]);
  var res = await sb.from('gallery').delete().eq('id', id);
  if (res.error) { toast('Gagal hapus', false); return; }
  toast('Dihapus');
  loadGallery();
}

// ========== LIGHTBOX ==========
function openLightbox(url) {
  document.getElementById('lightboxImg').src = url;
  document.getElementById('lightbox').classList.add('show');
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('show');
  document.getElementById('lightboxImg').src = '';
}
