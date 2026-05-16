// ================================================================
// CHAT MODULE - Fixed: sb.rpc tidak pakai .catch() langsung
// ================================================================

let chatChannel     = null;
let presenceChannel = null;
let isChatActive    = false;
let chatLoaded      = false;
let seenMsgIds      = new Set();
let replyTarget     = null;
let emojiPickerOpen = false;
let activeMsgMenu   = null;
let selectedMsgIds  = new Set();
let selectionActive = false;
let otherUser       = null;
let presenceTimer   = null;
let typingTimer     = null;
let selfTyping      = false;
let pollTimer       = null;
let lastPollTs      = null;

// ===== HELPERS =====
function esc(s) {
  return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') : '';
}
function fmtTime(d) {
  return new Date(d).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
}
function scrollToBottom(el, smooth) {
  if (!el) return;
  requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' }));
}
function showErr(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show err';
  setTimeout(() => { t.className = 'toast'; }, 5000);
}

// ===== RPC HELPER (aman, tanpa .catch() chaining) =====
async function rpc(fn, params) {
  try { await sb.rpc(fn, params); } catch (e) {}
}

// ===== TYPING SELF =====
function onChatInput() {
  if (!currentAccount) return;
  autoResize(document.getElementById('chatInput'));
  if (!selfTyping) {
    selfTyping = true;
    rpc('update_typing', { p_username: currentAccount.name, p_is_typing: true });
  }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    selfTyping = false;
    rpc('update_typing', { p_username: currentAccount.name, p_is_typing: false });
  }, 2000);
}

// ===== TYPING UI =====
function setTypingUI(show, name) {
  let el = document.getElementById('typingBubble');
  if (!show) { if (el) el.style.display = 'none'; return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'typingBubble';
    el.style.cssText = 'display:flex;padding:2px 14px 8px;';
    el.innerHTML =
      '<div style="background:var(--bubble-their);border:1px solid var(--bubble-bt);border-radius:18px;border-bottom-left-radius:5px;padding:8px 14px;display:flex;align-items:center;gap:8px;">' +
      '<span id="typingName" style="font-size:11px;color:var(--text3);font-weight:500;"></span>' +
      '<span class="typing-dots"><span></span><span></span><span></span></span>' +
      '</div>';
    const list = document.getElementById('chatList');
    if (list && list.parentNode) list.parentNode.insertBefore(el, list.nextSibling);
  }
  const n = document.getElementById('typingName');
  if (n) n.textContent = (name || '') + ' mengetik';
  el.style.display = 'flex';
  scrollToBottom(document.getElementById('chatList'), true);
}

// ===== STATUS ICON =====
function statusHtml(s) {
  if (s === 'sent')
    return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14" class="status-sent"><polyline points="3 8 6 11 13 4.5"/></svg>';
  if (s === 'delivered')
    return '<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="2.2" width="16" height="14" class="status-delivered"><polyline points="2 8 5 11 10.5 5"/><polyline points="7.5 8 10.5 11 16 5"/></svg>';
  if (s === 'read')
    return '<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="2.2" width="16" height="14" class="status-read"><polyline points="2 8 5 11 10.5 5"/><polyline points="7.5 8 10.5 11 16 5"/></svg>';
  return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13" class="status-pending"><circle cx="8" cy="8" r="6.5"/><polyline points="8 4.5 8 8 10.5 10"/></svg>';
}
async function fetchStatus(msgId) {
  try {
    const { data } = await sb.from('message_status').select('status').eq('message_id', msgId).maybeSingle();
    return statusHtml(data ? data.status : 'pending');
  } catch { return statusHtml('pending'); }
}

// ===== BUILD MESSAGE =====
function buildMsg(m) {
  const isMe    = currentAccount && m.sender_name === currentAccount.name;
  const clr     = m.sender_name === "Jef'z" ? '#007aff' : '#e91e8c';
  const roleTag = m.sender_role === 'admin' ? ' 👑' : '';
  const content = m.message || '';
  const isImg   = content.startsWith('[img]');
  const isVid   = content.startsWith('[video]');
  const media   = (isImg || isVid) ? content.slice(isImg ? 5 : 7) : null;

  const row = document.createElement('div');
  row.className = 'msg-row ' + (isMe ? 'mine' : 'theirs');
  if (m.id) row.dataset.msgId = String(m.id);

  const sw = document.createElement('div');
  sw.className = 'msg-swipe-wrap';

  const block = document.createElement('div');
  block.className = 'msg-block';

  const inner = document.createElement('div');
  inner.className = 'msg-block-inner';

  if (!isMe) {
    const sp = document.createElement('span');
    sp.className = 'msg-sender';
    sp.style.color = clr;
    sp.textContent = m.sender_name + roleTag;
    inner.appendChild(sp);
  }

  const bubble = document.createElement('div');
  bubble.className = media ? 'bubble bubble-media' : 'bubble';

  const ab = document.createElement('button');
  ab.className = 'bubble-action-btn';
  ab.textContent = '⋮';
  ab.addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectionActive) return;
    showMsgMenu(m.id, m.sender_name, content, ab);
  });
  bubble.appendChild(ab);

  if (m.reply_to_name && m.reply_to_text) {
    const rc = m.reply_to_name === "Jef'z" ? '#007aff' : '#e91e8c';
    let rp   = m.reply_to_text.length > 50 ? m.reply_to_text.slice(0, 50) + '…' : m.reply_to_text;
    if (rp.startsWith('[img]'))   rp = '🖼 Foto';
    if (rp.startsWith('[video]')) rp = '🎬 Video';
    const rpEl = document.createElement('div');
    rpEl.className = 'reply-preview';
    rpEl.style.borderLeft = '3px solid ' + rc;
    rpEl.innerHTML = '<span class="reply-prev-name" style="color:' + rc + '">' + esc(m.reply_to_name) + '</span><span class="reply-prev-text">' + esc(rp) + '</span>';
    bubble.appendChild(rpEl);
  }

  if (isImg && media) {
    const img = document.createElement('img');
    img.src = media; img.className = 'bubble-img'; img.loading = 'lazy';
    img.onclick = (e) => { e.stopPropagation(); openLightboxFromChat(media); };
    bubble.appendChild(img);
  } else if (isVid && media) {
    const vid = document.createElement('video');
    vid.src = media; vid.className = 'bubble-vid';
    vid.preload = 'metadata'; vid.controls = true; vid.playsInline = true;
    bubble.appendChild(vid);
  } else {
    bubble.appendChild(document.createTextNode(content));
  }

  const ts = document.createElement('span');
  ts.style.cssText = 'float:right;margin-left:6px;margin-bottom:-2px;position:relative;top:3px;display:inline-flex;align-items:center;gap:3px;pointer-events:none;white-space:nowrap;';
  const timeEl = document.createElement('span');
  timeEl.textContent = fmtTime(m.created_at);
  timeEl.style.cssText = 'font-size:10px;color:var(--text3);';
  ts.appendChild(timeEl);

  if (isMe && m.id) {
    const si = document.createElement('span');
    si.className = 'msg-status-icons';
    si.dataset.statusMsgId = String(m.id);
    si.innerHTML = statusHtml('pending');
    fetchStatus(m.id).then(h => { si.innerHTML = h; });
    ts.appendChild(si);
  }
  bubble.appendChild(ts);

  inner.appendChild(bubble);
  block.appendChild(inner);
  sw.appendChild(block);
  row.appendChild(sw);

  initLongPress(row, m);
  initSwipeReply(row, m);
  return row;
}

// ===== LONG PRESS =====
function initLongPress(row, m) {
  const bubble = row.querySelector('.bubble');
  if (!bubble) return;
  let timer = null, moved = false, sx = 0, sy = 0;
  bubble.addEventListener('touchstart', (e) => {
    if (e.target.closest('.bubble-action-btn') || selectionActive) return;
    moved = false; sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    timer = setTimeout(() => {
      if (!moved && m.id) { if (navigator.vibrate) navigator.vibrate(40); enterSelect(String(m.id)); }
    }, 500);
  }, { passive: true });
  bubble.addEventListener('touchmove', (e) => {
    if (Math.abs(e.touches[0].clientX - sx) > 8 || Math.abs(e.touches[0].clientY - sy) > 8) { moved = true; clearTimeout(timer); }
  }, { passive: true });
  bubble.addEventListener('touchend', (e) => {
    clearTimeout(timer);
    if (selectionActive && !moved && m.id) { e.stopPropagation(); toggleSelect(String(m.id)); }
    moved = false;
  });
  bubble.addEventListener('touchcancel', () => { clearTimeout(timer); moved = false; });
}

// ===== SWIPE REPLY =====
function initSwipeReply(row, m) {
  const sw = row.querySelector('.msg-swipe-wrap');
  let sx = 0, sy = 0, dx = 0, active = false, fired = false;
  sw.addEventListener('touchstart', (e) => {
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; active = false; fired = false;
  }, { passive: true });
  sw.addEventListener('touchmove', (e) => {
    if (selectionActive) return;
    dx = e.touches[0].clientX - sx;
    const dy = Math.abs(e.touches[0].clientY - sy);
    if (!active && Math.abs(dx) > dy && Math.abs(dx) > 8) active = true;
    if (!active) return;
    const cl = Math.min(Math.max(0, dx), 72);
    sw.style.transform = 'translateX(' + cl + 'px)';
    sw.style.transition = 'none';
    if (cl >= 60 && !fired) {
      fired = true;
      row.classList.add('reply-flash');
      setTimeout(() => row.classList.remove('reply-flash'), 200);
    }
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  sw.addEventListener('touchend', () => {
    if (!selectionActive && fired && dx >= 60) setReply(m.id, m.sender_name, m.message || '');
    sw.style.transition = 'transform .25s cubic-bezier(.34,1.56,.64,1)';
    sw.style.transform = 'translateX(0)';
    active = false; fired = false;
  });
}

// ===== APPEND =====
function appendMsg(m, smooth) {
  const list = document.getElementById('chatList');
  if (!list) return;
  const id = String(m.id || '');
  if (id && seenMsgIds.has(id)) return;
  if (id) seenMsgIds.add(id);
  const ph = list.querySelector('.state-msg');
  if (ph) list.innerHTML = '';
  list.appendChild(buildMsg(m));
  scrollToBottom(list, smooth && (list.scrollHeight - list.scrollTop - list.clientHeight) < 400);
}

// ===== INIT CHAT =====
async function initChat() {
  isChatActive = true;

  const inp = document.getElementById('chatInput');
  if (inp && !inp._b) {
    inp._b = true;
    inp.addEventListener('input', onChatInput);
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
    });
  }

  if (!chatLoaded) {
    const list = document.getElementById('chatList');
    list.innerHTML = '<p class="state-msg">Memuat...</p>';

    const { data, error } = await sb.from('chat_messages').select('*').order('created_at', { ascending: true });

    if (error) {
      list.innerHTML = '<p class="state-msg err">Gagal memuat</p>';
      showErr('Load error: ' + error.message);
      return;
    }

    list.innerHTML = '';
    chatLoaded = true;

    if (!data || !data.length) {
      list.innerHTML = '<p class="state-msg">Belum ada pesan 💬</p>';
    } else {
      const frag = document.createDocumentFragment();
      data.forEach(m => { seenMsgIds.add(String(m.id)); frag.appendChild(buildMsg(m)); });
      list.appendChild(frag);
      scrollToBottom(list, false);
      lastPollTs = data[data.length - 1].created_at;
    }
  }

  startRealtime();
  startPresence();
  startPoll();
}

// ===== REALTIME =====
function startRealtime() {
  if (chatChannel) { try { sb.removeChannel(chatChannel); } catch (e) {} chatChannel = null; }

  chatChannel = sb.channel('chat_' + Date.now())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (p) => {
      if (!p.new) return;
      const id = String(p.new.id);
      if (seenMsgIds.has(id)) return;
      appendMsg(p.new, true);
      if (currentAccount && p.new.sender_name !== currentAccount.name) {
        const tabOpen = document.getElementById('tabChat').classList.contains('active-tab');
        upsertStatus(p.new.id, tabOpen ? 'read' : 'delivered');
      }
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (p) => {
      if (!p.old || !p.old.id) return;
      const el = document.querySelector('[data-msg-id="' + p.old.id + '"]');
      if (el) el.remove();
      seenMsgIds.delete(String(p.old.id));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'message_status' }, (p) => {
      if (!p.new) return;
      const ic = document.querySelector('[data-status-msg-id="' + p.new.message_id + '"]');
      if (ic) ic.innerHTML = statusHtml(p.new.status);
    })
    .subscribe();
}

// ===== POLLING FALLBACK =====
function startPoll() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    if (!isChatActive) return;
    try {
      let q = sb.from('chat_messages').select('*').order('created_at', { ascending: true });
      if (lastPollTs) q = q.gt('created_at', lastPollTs);
      const { data } = await q;
      if (data && data.length) {
        data.forEach(m => appendMsg(m, true));
        lastPollTs = data[data.length - 1].created_at;
      }
    } catch (e) {}
  }, 3000);
}

// ===== PRESENCE =====
async function startPresence() {
  if (!currentAccount) return;
  otherUser = currentAccount.name === "Jef'z" ? 'Ndifaa' : "Jef'z";

  await rpc('update_presence', { p_username: currentAccount.name, p_is_online: true });

  if (presenceChannel) { try { sb.removeChannel(presenceChannel); } catch (e) {} }
  presenceChannel = sb.channel('pres_' + Date.now())
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'user_presence',
      filter: 'username=eq.' + otherUser
    }, (p) => { if (p.new) renderPresence(p.new); })
    .subscribe();

  await fetchPresence();

  if (presenceTimer) clearInterval(presenceTimer);
  presenceTimer = setInterval(fetchPresence, 5000);

  window.addEventListener('beforeunload', async () => {
    await rpc('update_presence', { p_username: currentAccount.name, p_is_online: false });
    await rpc('update_typing',   { p_username: currentAccount.name, p_is_typing: false });
  });
}

async function fetchPresence() {
  if (!otherUser) return;
  try {
    const { data } = await sb.from('user_presence').select('*').eq('username', otherUser).maybeSingle();
    if (data) renderPresence(data);
  } catch (e) {}
}

function renderPresence(data) {
  const el = document.getElementById('topbarOnline');
  if (!el || !otherUser) return;
  el.classList.add('show');

  if (data.is_typing) {
    el.className = 'topbar-online show typing';
    el.innerHTML = '<span class="topbar-online-dot"></span>' + esc(otherUser) + ' mengetik…';
    setTypingUI(true, otherUser);
    return;
  }
  setTypingUI(false);

  if (data.is_online) {
    el.className = 'topbar-online show online';
    el.innerHTML = '<span class="topbar-online-dot"></span>Online';
  } else {
    el.className = 'topbar-online show offline';
    const ls   = data.last_seen ? new Date(data.last_seen) : new Date();
    const diff = Date.now() - ls.getTime();
    const mn   = Math.floor(diff / 60000);
    const hr   = Math.floor(diff / 3600000);
    const dy   = Math.floor(diff / 86400000);
    let lbl;
    if (mn < 1)      lbl = 'Baru saja';
    else if (mn < 60) lbl = mn + ' mnt lalu';
    else if (hr < 24) lbl = hr + ' jam lalu';
    else if (dy < 7)  lbl = dy + ' hari lalu';
    else              lbl = ls.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    el.innerHTML = '<span class="topbar-online-dot"></span>Terakhir dilihat ' + lbl;
  }

  if (document.getElementById('tabChat').classList.contains('active-tab')) markRead();
}

// ===== STATUS =====
async function upsertStatus(msgId, status) {
  if (!currentAccount) return;
  try {
    const row = { message_id: msgId, recipient_name: currentAccount.name, status, updated_at: new Date().toISOString() };
    if (status === 'delivered') row.delivered_at = new Date().toISOString();
    if (status === 'read')      row.read_at      = new Date().toISOString();
    await sb.from('message_status').upsert(row, { onConflict: 'message_id,recipient_name' });
    const ic = document.querySelector('[data-status-msg-id="' + msgId + '"]');
    if (ic) ic.innerHTML = statusHtml(status);
  } catch (e) {}
}

async function markRead() {
  if (!currentAccount || !otherUser) return;
  try {
    const { data } = await sb.from('chat_messages').select('id').eq('sender_name', otherUser).order('created_at', { ascending: false }).limit(30);
    if (data) for (const m of data) await upsertStatus(m.id, 'read');
  } catch (e) {}
}

// ===== REPLY =====
function setReply(id, sender, msg) {
  replyTarget = { id, sender_name: sender, message: msg };
  const b = document.getElementById('replyBanner');
  if (!b) return;
  b.style.display = 'flex';
  document.getElementById('replyBannerName').textContent = sender;
  document.getElementById('replyBannerText').textContent = msg.length > 60 ? msg.slice(0, 60) + '…' : msg;
  document.getElementById('chatInput').focus();
}
function clearReplyBanner() {
  replyTarget = null;
  const b = document.getElementById('replyBanner');
  if (b) b.style.display = 'none';
}

// ===== MSG MENU =====
function closeMsgMenu() {
  if (activeMsgMenu && activeMsgMenu.parentNode) activeMsgMenu.remove();
  activeMsgMenu = null;
}
function showMsgMenu(msgId, sender, msg, anchor) {
  closeMsgMenu();
  const canDel = (currentAccount && currentAccount.role === 'admin') || (currentAccount && sender === currentAccount.name);
  const menu = document.createElement('div');
  menu.className = 'msg-action-menu';
  const rb = document.createElement('button');
  rb.className = 'msg-action-item'; rb.textContent = '↩ Balas';
  rb.onclick = (e) => { e.stopPropagation(); closeMsgMenu(); setReply(msgId, sender, msg); };
  menu.appendChild(rb);
  if (canDel) {
    const db = document.createElement('button');
    db.className = 'msg-action-item danger'; db.textContent = '✕ Hapus';
    db.onclick = (e) => { e.stopPropagation(); closeMsgMenu(); deleteMsg(msgId); };
    menu.appendChild(db);
  }
  const rect = anchor.getBoundingClientRect();
  const isMe = currentAccount && sender === currentAccount.name;
  menu.style.cssText = 'position:fixed;top:' + (rect.bottom + 4) + 'px;' + (isMe ? 'right:' + (window.innerWidth - rect.right) + 'px;' : 'left:' + rect.left + 'px;');
  document.body.appendChild(menu);
  activeMsgMenu = menu;
}
async function deleteMsg(id) {
  const ok = await showConfirm('Hapus pesan ini?', { icon: '🗑', title: 'Hapus Pesan', okText: 'Hapus', cancelText: 'Batal' });
  if (!ok) return;
  const { error } = await sb.from('chat_messages').delete().eq('id', id);
  if (error) { toast('Gagal hapus', false); return; }
  const el = document.querySelector('[data-msg-id="' + id + '"]');
  if (el) el.remove();
  seenMsgIds.delete(String(id));
  toast('Pesan dihapus');
}

// ===== SEND =====
let sending = false;
async function sendMsg() {
  if (sending) return;
  if (!currentAccount) { showErr('Session habis, login ulang'); return; }

  const inp = document.getElementById('chatInput');
  const msg = (inp.value || '').replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
  if (!msg) return;

  sending = true;
  inp.value = '';
  inp.style.height = '';
  inp.focus();

  // Stop typing
  if (selfTyping) {
    selfTyping = false;
    clearTimeout(typingTimer);
    await rpc('update_typing', { p_username: currentAccount.name, p_is_typing: false });
  }

  const row = {
    message:     msg,
    user_id:     typeof USER_ID !== 'undefined' ? USER_ID : ('u_' + Date.now()),
    sender_name: currentAccount.name,
    sender_role: currentAccount.role || 'user'
  };
  if (replyTarget) {
    row.reply_to_id   = replyTarget.id;
    row.reply_to_name = replyTarget.sender_name;
    row.reply_to_text = replyTarget.message;
  }
  clearReplyBanner();

  try {
    const { data, error } = await sb.from('chat_messages').insert([row]).select().single();

    if (error) {
      showErr('Gagal kirim: ' + error.message);
      inp.value = msg;
      sending = false;
      return;
    }

    if (data) {
      const id = String(data.id);
      if (!seenMsgIds.has(id)) {
        seenMsgIds.add(id);
        lastPollTs = data.created_at;
        const list = document.getElementById('chatList');
        const ph   = list.querySelector('.state-msg');
        if (ph) list.innerHTML = '';
        list.appendChild(buildMsg(data));
        scrollToBottom(list, true);
      }
      upsertStatus(data.id, 'sent');
    }
  } catch (err) {
    showErr('Error: ' + err.message);
    inp.value = msg;
  }

  sending = false;
}

// ===== CHAT UPLOAD =====
async function doChatUpload(input) {
  if (!currentAccount) return;
  const file = input.files[0];
  if (!file) return;
  const isVid = file.type.startsWith('video/');
  const ext   = file.name.split('.').pop();
  const name  = 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + '.' + ext;
  try {
    await new Promise((res, rej) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', SB_URL + '/storage/v1/object/gallery/' + name, true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + SB_KEY);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.setRequestHeader('Cache-Control', '3600');
      xhr.onload  = () => xhr.status >= 200 && xhr.status < 300 ? res() : rej(new Error(xhr.status));
      xhr.onerror = () => rej(new Error('network'));
      xhr.send(file);
    });
  } catch { toast('Upload gagal', false); input.value = ''; return; }
  const url = sb.storage.from('gallery').getPublicUrl(name).data.publicUrl;
  const { error } = await sb.from('chat_messages').insert([{
    message: (isVid ? '[video]' : '[img]') + url,
    user_id: typeof USER_ID !== 'undefined' ? USER_ID : 'u',
    sender_name: currentAccount.name,
    sender_role: currentAccount.role
  }]);
  if (error) toast('Gagal kirim', false); else toast('Terkirim ✓');
  input.value = '';
}

// ===== MULTISELECT =====
function enterSelect(id) { selectionActive = true; addSel(id); renderSelBar(); }
function toggleSelect(id) {
  if (!selectionActive) return;
  if (selectedMsgIds.has(id)) remSel(id); else addSel(id);
  if (!selectedMsgIds.size) { exitSelect(); return; }
  renderSelBar();
}
function addSel(id) { selectedMsgIds.add(id); const r = document.querySelector('[data-msg-id="' + id + '"]'); if (r) r.classList.add('msg-selected'); }
function remSel(id) { selectedMsgIds.delete(id); const r = document.querySelector('[data-msg-id="' + id + '"]'); if (r) r.classList.remove('msg-selected'); }
function allOwn() { for (const id of selectedMsgIds) { const r = document.querySelector('[data-msg-id="' + id + '"]'); if (!r || !r.classList.contains('mine')) return false; } return true; }
function renderSelBar() {
  let bar = document.getElementById('selectionBar');
  if (!bar) { bar = document.createElement('div'); bar.id = 'selectionBar'; bar.className = 'selection-bar'; document.querySelector('.topbar').appendChild(bar); }
  const canDel = (currentAccount && currentAccount.role === 'admin') || allOwn();
  bar.innerHTML = '<button class="sel-cancel-btn" onclick="exitSelect()">✕ Batal</button><span class="sel-label">' + selectedMsgIds.size + ' dipilih</span>' + (canDel ? '<button class="sel-delete-btn" onclick="delSelected()">🗑 Hapus</button>' : '<span style="width:74px"></span>');
  bar.style.display = 'flex';
}
function exitSelect() {
  selectionActive = false; selectedMsgIds.clear();
  document.querySelectorAll('.msg-selected').forEach(e => e.classList.remove('msg-selected'));
  const b = document.getElementById('selectionBar'); if (b) b.style.display = 'none';
}
function exitSelectionMode() { exitSelect(); }
async function delSelected() {
  if (!selectedMsgIds.size) return;
  const ids = Array.from(selectedMsgIds);
  const ok  = await showConfirm('Hapus ' + (ids.length === 1 ? 'pesan ini' : ids.length + ' pesan') + '?', { icon: '🗑', title: 'Hapus Pesan', okText: 'Hapus', cancelText: 'Batal' });
  if (!ok) return;
  exitSelect();
  await sb.from('chat_messages').delete().in('id', ids);
  ids.forEach(id => { const e = document.querySelector('[data-msg-id="' + id + '"]'); if (e) e.remove(); seenMsgIds.delete(String(id)); });
  toast(ids.length === 1 ? 'Pesan dihapus' : ids.length + ' pesan dihapus');
}
async function delSelectedMsgs() { await delSelected(); }

// ===== EMOJI =====
const EMOJI_CATEGORIES = [
  { icon:'😀', label:'Smileys', emojis:['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','💫','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'] },
  { icon:'❤️', label:'Hearts', emojis:['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟'] },
  { icon:'👋', label:'People', emojis:['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦿','🦶','👂','🦻','👃','🧠','🦷','🦴','👀','👁️','👅','👄','💋','🩸'] },
  { icon:'🐱', label:'Animals', emojis:['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🦋','🐌','🐞','🐜','🦟','🕷️','🦂','🐢','🐍','🦎','🐙','🦑','🦐','🦀','🐡','🐠','🐟','🐬','🐳','🦈'] },
  { icon:'🍎', label:'Food', emojis:['🍏','🍎','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🌶️','🧄','🥔','🥐','🥯','🍞','🥖','🧀','🥚','🍳','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🌮','🌯','🥗','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🍤','🍙','🍚','🍘','🍥','🥮','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🧃','🥤','🧋','☕','🍵','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🍾'] },
  { icon:'⚽', label:'Activity', emojis:['⚽','🏀','🏈','⚾','🥎','🏐','🏉','🎾','🥏','🎱','🏓','🏸','🏒','🥅','⛳','🎯','🎮','🕹️','🎲','🧩','🧸','♟️','🎭','🎨','🎰'] },
  { icon:'🌍', label:'Travel', emojis:['🌍','🌎','🌏','🏔️','⛰️','🌋','🏕️','🏖️','🏜️','🏝️','🏠','🏡','🏢','🏥','🏦','🏨','🏪','🏫','🏬','🏯','🏰','⛪','🌃','🏙️','🌄','🌅','🌆','🌇','🌉','🚂','🚄','🚇','🚌','🚑','🚒','🚓','🚕','✈️','🛫','🚀','🛸','🚁','⛵','🚤','🚢'] },
  { icon:'💡', label:'Objects', emojis:['⌚','📱','💻','⌨️','🖥️','📷','📸','📹','🎥','📞','☎️','📺','📻','🔋','🔌','💡','🔦','💰','💵','💳','✉️','📧','📝','📁','📂','📅','📈','📉','📊','📋','📌','📍','✂️','🔒','🔓','🔑','🔨','⚙️','🔗','🧰','🧲','💊','🩺','🧪','🧬','🔬','🔭'] },
];
function buildEmojiPicker() {
  if (document.getElementById('emojiPickerPanel')) return document.getElementById('emojiPickerPanel');
  const panel = document.createElement('div'); panel.id = 'emojiPickerPanel'; panel.className = 'emoji-picker-wrap';
  const hint = document.createElement('div'); hint.className = 'emoji-swipe-hint'; panel.appendChild(hint);
  const tabs = document.createElement('div'); tabs.className = 'emoji-cat-tabs';
  const body = document.createElement('div'); body.className = 'emoji-body';
  EMOJI_CATEGORIES.forEach((cat, idx) => {
    const tab = document.createElement('button'); tab.className = 'emoji-cat-tab' + (idx === 0 ? ' active' : ''); tab.title = cat.label; tab.textContent = cat.icon;
    tab.onclick = () => { document.querySelectorAll('.emoji-cat-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); document.querySelectorAll('.emoji-section').forEach(s => s.style.display = 'none'); document.getElementById('emoji-sec-' + idx).style.display = ''; };
    tabs.appendChild(tab);
    const sec = document.createElement('div'); sec.className = 'emoji-section'; sec.id = 'emoji-sec-' + idx; if (idx !== 0) sec.style.display = 'none';
    cat.emojis.forEach(em => { const b = document.createElement('button'); b.className = 'emoji-item'; b.textContent = em; b.onclick = (e) => { e.stopPropagation(); insertEmoji(em); }; sec.appendChild(b); });
    body.appendChild(sec);
  });
  panel.appendChild(tabs); panel.appendChild(body);
  const cb = document.querySelector('.chat-bar'); if (cb) cb.appendChild(panel);
  return panel;
}
function insertEmoji(em) {
  const i = document.getElementById('chatInput'); if (!i) return;
  const s = i.selectionStart, e = i.selectionEnd;
  i.value = i.value.slice(0, s) + em + i.value.slice(e);
  i.setSelectionRange(s + em.length, s + em.length); i.focus();
}
function toggleEmojiPicker(e) {
  e.stopPropagation();
  const p = document.getElementById('emojiPickerPanel') || buildEmojiPicker();
  emojiPickerOpen = !emojiPickerOpen;
  p.style.display = emojiPickerOpen ? 'flex' : 'none';
  document.getElementById('emojiTrigger').classList.toggle('active', emojiPickerOpen);
}
function closeEmojiPicker() {
  emojiPickerOpen = false;
  const p = document.getElementById('emojiPickerPanel'); if (p) p.style.display = 'none';
  const t = document.getElementById('emojiTrigger'); if (t) t.classList.remove('active');
}

// ===== GALLERY =====
let galleryItems = [], galleryLoaded = false, lbIdx = -1;
async function loadGallery() {
  const el = document.getElementById('galleryGrid');
  el.innerHTML = '<p class="state-msg">Memuat...</p>';
  const { data, error } = await sb.from('gallery').select('*').order('created_at', { ascending: false });
  if (error) { el.innerHTML = '<p class="state-msg err">Error: ' + error.message + '</p>'; return; }
  galleryLoaded = true; galleryItems = [];
  if (!data || !data.length) { el.innerHTML = '<p class="state-msg">Belum ada media.</p>'; return; }
  el.innerHTML = '';
  const isAdmin = currentAccount && currentAccount.role === 'admin';
  const frag    = document.createDocumentFragment();
  data.forEach((f, idx) => {
    const isVid = /\.(mp4|webm|mov|avi)$/i.test(f.file_name || '');
    galleryItems.push({ url: f.file_url, isVid });
    const d = document.createElement('div'); d.className = 'g-item';
    if (isVid) {
      const th = document.createElement('div'); th.style.cssText = 'position:relative;width:100%;height:100%;cursor:pointer;';
      const v = document.createElement('video'); v.className = 'g-media'; v.preload = 'metadata'; v.muted = true; v.playsInline = true; v.src = f.file_url + '#t=0.001';
      const pi = document.createElement('div'); pi.className = 'g-play-icon';
      pi.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28"><circle cx="12" cy="12" r="12" fill="rgba(0,0,0,0.5)"/><polygon points="10,8 18,12 10,16" fill="white"/></svg>';
      th.appendChild(v); th.appendChild(pi); ((i) => { th.onclick = () => openLightbox(i); })(idx); d.appendChild(th);
    } else {
      const img = document.createElement('img'); img.src = f.file_url; img.className = 'g-media'; img.loading = 'lazy';
      ((i) => { img.onclick = () => openLightbox(i); })(idx); d.appendChild(img);
    }
    if (isAdmin) { const db = document.createElement('button'); db.className = 'g-del'; db.textContent = '✕'; db.onclick = (e) => { e.stopPropagation(); delMedia(f.id, f.file_name); }; d.appendChild(db); }
    frag.appendChild(d);
  });
  el.appendChild(frag);
}
async function delMedia(id, name) {
  if (!currentAccount || currentAccount.role !== 'admin') return;
  const ok = await showConfirm('Hapus media ini?', { icon: '🗑', title: 'Hapus Media', okText: 'Hapus', cancelText: 'Batal' });
  if (!ok) return;
  await sb.storage.from('gallery').remove([name]);
  const { error } = await sb.from('gallery').delete().eq('id', id);
  if (error) { toast('Gagal hapus', false); return; }
  toast('Dihapus'); galleryLoaded = false; loadGallery();
}

// ===== GALLERY UPLOAD =====
let pendingFile = null, uploadXHR = null;
function triggerUploadConfirm(input) {
  if (!currentAccount || currentAccount.role !== 'admin') { toast('Hanya admin yang bisa upload', false); input.value = ''; return; }
  const file = input.files[0]; if (!file) return;
  pendingFile = file;
  document.getElementById('uploadFileName').textContent  = file.name;
  document.getElementById('uploadFileSize').textContent  = fmtBytes(file.size) + ' · ' + (file.type || 'unknown');
  document.getElementById('uploadProgressWrap').style.display = 'none';
  document.getElementById('uploadProgressFill').style.width   = '0%';
  document.getElementById('uploadPctLabel').textContent   = '0%';
  document.getElementById('uploadSpeedLabel').textContent = '—';
  document.getElementById('uploadRemainLabel').textContent = '—';
  document.getElementById('uploadGoBtn').disabled = false;
  document.getElementById('uploadGoBtn').textContent     = 'Upload';
  document.getElementById('uploadCancelBtn').textContent = 'Batal';
  document.getElementById('uploadModalCloseBtn').style.display = '';
  document.getElementById('uploadConfirmModal').classList.add('show');
  input.value = '';
}
function cancelUploadModal() {
  if (uploadXHR) { try { uploadXHR.abort(); } catch (e) {} uploadXHR = null; }
  pendingFile = null; document.getElementById('uploadConfirmModal').classList.remove('show');
}
async function startGalleryUpload() {
  if (!pendingFile) return;
  const file = pendingFile;
  document.getElementById('uploadGoBtn').disabled = true;
  document.getElementById('uploadGoBtn').textContent = 'Mengupload...';
  document.getElementById('uploadModalCloseBtn').style.display = 'none';
  document.getElementById('uploadCancelBtn').textContent = 'Batalkan';
  document.getElementById('uploadProgressWrap').style.display = 'flex';
  const ext = file.name.split('.').pop();
  const name = Date.now() + '_' + Math.random().toString(36).slice(2, 6) + '.' + ext;
  let ll = 0, lt = Date.now(), ok = false;
  try {
    await new Promise((res, rej) => {
      const xhr = new XMLHttpRequest(); uploadXHR = xhr;
      xhr.open('POST', SB_URL + '/storage/v1/object/gallery/' + name, true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + SB_KEY);
      xhr.setRequestHeader('x-upsert', 'false'); xhr.setRequestHeader('Cache-Control', '3600');
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const now = Date.now(), pct = Math.round(e.loaded / e.total * 100), el2 = (now - lt) / 1000, sp = el2 > 0 ? (e.loaded - ll) / el2 : 0;
        ll = e.loaded; lt = now;
        document.getElementById('uploadProgressFill').style.width = pct + '%';
        document.getElementById('uploadPctLabel').textContent = pct + '%';
        document.getElementById('uploadSpeedLabel').textContent = sp > 0 ? fmtBytes(sp) + '/s' : '—';
        document.getElementById('uploadRemainLabel').textContent = fmtBytes(e.total - e.loaded) + ' tersisa';
      };
      xhr.onload  = () => { uploadXHR = null; xhr.status >= 200 && xhr.status < 300 ? res() : rej(new Error('HTTP ' + xhr.status)); };
      xhr.onerror = () => { uploadXHR = null; rej(new Error('Network error')); };
      xhr.onabort = () => { uploadXHR = null; rej(new Error('Dibatalkan')); };
      xhr.send(file);
    }); ok = true;
  } catch (err) {
    toast(err.message === 'Dibatalkan' ? 'Upload dibatalkan' : 'Upload gagal: ' + err.message, false);
    document.getElementById('uploadGoBtn').disabled = false;
    document.getElementById('uploadGoBtn').textContent = 'Upload';
    document.getElementById('uploadCancelBtn').textContent = 'Batal';
    document.getElementById('uploadModalCloseBtn').style.display = '';
    document.getElementById('uploadProgressWrap').style.display = 'none';
    document.getElementById('uploadConfirmModal').classList.remove('show');
    pendingFile = null; return;
  }
  if (!ok) return;
  const url = sb.storage.from('gallery').getPublicUrl(name).data.publicUrl;
  const { error } = await sb.from('gallery').insert([{ file_url: url, file_name: name, uploaded_by: currentAccount ? currentAccount.name : null }]);
  if (error) toast('Gagal simpan: ' + error.message, false);
  else { toast('Berhasil diupload ✓'); galleryLoaded = false; loadGallery(); }
  pendingFile = null; uploadXHR = null;
  document.getElementById('uploadConfirmModal').classList.remove('show');
}

// ===== LIGHTBOX =====
function openLightbox(idx) { lbIdx = idx; lbRender(idx); lbNavUpdate(); document.getElementById('lightbox').classList.add('show'); document.body.style.overflow = 'hidden'; }
function openLightboxFromChat(url) {
  lbIdx = -1; const w = document.getElementById('lightboxMediaWrap'); lbClear(w);
  const img = document.getElementById('lightboxImg'); img.src = url; img.style.display = '';
  document.getElementById('lightboxCounter').innerHTML = '';
  document.getElementById('lightboxPrev').style.display = 'none';
  document.getElementById('lightboxNext').style.display = 'none';
  document.getElementById('lightbox').classList.add('show'); document.body.style.overflow = 'hidden';
}
function lbClear(w) {
  if (!w) w = document.getElementById('lightboxMediaWrap');
  const v = w.querySelector('video'); if (v) { try { v.pause(); v.src = ''; } catch (e) {} v.remove(); }
  const img = document.getElementById('lightboxImg'); if (img) { img.src = ''; img.style.display = 'none'; }
}
function lbRender(idx) {
  const w = document.getElementById('lightboxMediaWrap'); lbClear(w);
  if (idx < 0 || !galleryItems[idx]) return;
  const item = galleryItems[idx], img = document.getElementById('lightboxImg');
  if (item.isVid) {
    img.style.display = 'none';
    const v = document.createElement('video'); v.src = item.url; v.controls = true; v.playsInline = true;
    v.style.cssText = 'max-width:100%;max-height:76vh;width:auto;height:auto;object-fit:contain;display:block;';
    w.appendChild(v);
  } else { img.src = item.url; img.style.display = ''; }
  lbCounter(idx);
}
function lbNavUpdate() {
  const p = document.getElementById('lightboxPrev'), n = document.getElementById('lightboxNext');
  if (lbIdx < 0 || galleryItems.length <= 1) { if (p) p.style.display = 'none'; if (n) n.style.display = 'none'; return; }
  if (p) p.style.display = lbIdx > 0 ? '' : 'none';
  if (n) n.style.display = lbIdx < galleryItems.length - 1 ? '' : 'none';
}
function lbCounter(idx) {
  const c = document.getElementById('lightboxCounter'); if (!c) return;
  if (galleryItems.length <= 1) { c.innerHTML = ''; return; }
  const s = Math.max(0, idx - 5), e = Math.min(galleryItems.length - 1, s + 11);
  c.innerHTML = Array.from({ length: e - s + 1 }, (_, i) => '<span class="lb-dot' + (s + i === idx ? ' active' : '') + '"></span>').join('');
}
function lightboxNav(dir) {
  if (lbIdx < 0) return;
  const n = lbIdx + dir; if (n < 0 || n >= galleryItems.length) return;
  lbIdx = n; const w = document.getElementById('lightboxMediaWrap');
  w.style.transition = 'opacity .15s,transform .15s'; w.style.opacity = '0'; w.style.transform = 'translateX(' + (dir > 0 ? '24px' : '-24px') + ')';
  setTimeout(() => { lbRender(lbIdx); lbNavUpdate(); w.style.transition = 'opacity .2s,transform .2s'; w.style.opacity = '1'; w.style.transform = 'translateX(0)'; }, 120);
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('show');
  const w = document.getElementById('lightboxMediaWrap'); lbClear(w);
  const img = document.getElementById('lightboxImg'); if (img) { img.src = ''; img.style.display = ''; }
  document.getElementById('lightboxCounter').innerHTML = '';
  lbIdx = -1; document.body.style.overflow = '';
  if (w) { w.style.opacity = ''; w.style.transform = ''; w.style.transition = ''; }
}
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const lb = document.getElementById('lightbox'); if (!lb) return;
    let sx = 0, sw = false;
    lb.addEventListener('touchstart', (e) => { if (e.target.closest('.lightbox-close,.lightbox-prev,.lightbox-next')) return; sx = e.touches[0].clientX; sw = false; }, { passive: true });
    lb.addEventListener('touchmove',  (e) => { if (Math.abs(e.touches[0].clientX - sx) > 12) sw = true; }, { passive: true });
    lb.addEventListener('touchend',   (e) => { if (!sw) return; const dx = e.changedTouches[0].clientX - sx; sw = false; if (Math.abs(dx) > 60) lightboxNav(dx < 0 ? 1 : -1); });
  });
})();

// ===== CLEANUP =====
window.addEventListener('beforeunload', () => {
  if (presenceTimer) clearInterval(presenceTimer);
  if (pollTimer)     clearInterval(pollTimer);
  if (chatChannel)     { try { sb.removeChannel(chatChannel);     } catch (e) {} }
  if (presenceChannel) { try { sb.removeChannel(presenceChannel); } catch (e) {} }
  if (currentAccount) {
    rpc('update_presence', { p_username: currentAccount.name, p_is_online: false });
    rpc('update_typing',   { p_username: currentAccount.name, p_is_typing: false  });
  }
});
