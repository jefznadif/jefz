// ================================================================
// CHAT-CORE.JS
// State, helpers, status, presence, realtime sync
// ================================================================

// ===== STATE =====
let chatChannel     = null;
let presenceChannel = null;
let isChatActive    = false;
let chatLoaded      = false;
let seenMsgIds      = new Set();
let otherUser       = null;
let presenceTimer   = null;
let typingTimer     = null;
let selfTyping      = false;
let pollTimer       = null;
let lastPollTs      = null;
const statusMap     = {};

// ===== HELPERS =====
function esc(s) {
  return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') : '';
}
function fmtTime(d) {
  return new Date(d).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
}
function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' });
}
function fmtDuration(s) {
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s / 60), sc = s % 60;
  return m + ':' + (sc < 10 ? '0' : '') + sc;
}
function fmtBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(2) + ' MB';
}
function scrollToBottom(el, smooth) {
  if (!el) return;
  requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' }));
}
function showErr(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.className = 'toast show err';
  setTimeout(() => { t.className = 'toast'; }, 5000);
}
async function rpc(fn, params) { try { await sb.rpc(fn, params); } catch (e) {} }

function autoResize(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

// ===== FIX HEADER KEYBOARD =====
function fixHeaderOnKeyboard() {
  if (!window.visualViewport) return;
  const topbar = document.querySelector('.topbar');
  const nav    = document.querySelector('.bottom-nav');
  const tab    = document.getElementById('tabChat');
  function onVP() {
    const vh = window.visualViewport.height, ot = window.visualViewport.offsetTop;
    if (topbar) topbar.style.top = ot + 'px';
    if (tab && tab.classList.contains('active-tab')) {
      tab.style.top    = (ot + 62) + 'px';
      tab.style.bottom = (window.innerHeight - ot - vh + 68) + 'px';
    }
    if (nav) nav.style.bottom = (window.innerHeight - ot - vh) + 'px';
  }
  window.visualViewport.addEventListener('resize', onVP);
  window.visualViewport.addEventListener('scroll', onVP);
}

// ===== TYPING =====
function onChatInput() {
  if (!currentAccount) return;
  const inp = document.getElementById('chatInput');
  autoResize(inp);
  updateSendMicBtn();
  if (typeof editingMsgId !== 'undefined' && editingMsgId) return;
  if (!selfTyping) { selfTyping = true; rpc('update_typing', { p_username: currentAccount.name, p_is_typing: true }); }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => { selfTyping = false; rpc('update_typing', { p_username: currentAccount.name, p_is_typing: false }); }, 2000);
}

function setTypingUI(show, name) {
  let el = document.getElementById('typingBubble');
  if (!show) { if (el) el.style.display = 'none'; return; }
  if (!el) {
    el = document.createElement('div'); el.id = 'typingBubble'; el.style.cssText = 'display:flex;padding:2px 14px 8px;';
    el.innerHTML = '<div style="background:var(--bubble-their);border:1px solid var(--bubble-bt);border-radius:18px;border-bottom-left-radius:5px;padding:8px 14px;display:flex;align-items:center;gap:8px;"><span id="typingName" style="font-size:11px;color:var(--text3);font-weight:500;"></span><span class="typing-dots"><span></span><span></span><span></span></span></div>';
    const list = document.getElementById('chatList');
    if (list && list.parentNode) list.parentNode.insertBefore(el, list.nextSibling);
  }
  const n = document.getElementById('typingName'); if (n) n.textContent = (name || '') + ' mengetik';
  el.style.display = 'flex';
  scrollToBottom(document.getElementById('chatList'), true);
}

// ===== STATUS =====
function statusHtml(s) {
  if (s === 'sent')      return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14" class="status-sent"><polyline points="3 8 6 11 13 4.5"/></svg>';
  if (s === 'delivered') return '<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="2.2" width="16" height="14" class="status-delivered"><polyline points="2 8 5 11 10.5 5"/><polyline points="7.5 8 10.5 11 16 5"/></svg>';
  if (s === 'read')      return '<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="2.2" width="16" height="14" class="status-read"><polyline points="2 8 5 11 10.5 5"/><polyline points="7.5 8 10.5 11 16 5"/></svg>';
  return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13" class="status-pending"><circle cx="8" cy="8" r="6.5"/><polyline points="8 4.5 8 8 10.5 10"/></svg>';
}

function setStatusInDom(msgId, status) {
  statusMap[String(msgId)] = status;
  const ic = document.querySelector('[data-status-msg-id="' + msgId + '"]');
  if (ic) ic.innerHTML = statusHtml(status);
}

async function preloadAllStatuses(msgIds) {
  if (!msgIds.length) return;
  try {
    const { data } = await sb.from('message_status').select('message_id,status').in('message_id', msgIds);
    if (data) data.forEach(r => { statusMap[String(r.message_id)] = r.status; });
  } catch (e) {}
}

async function upsertStatus(msgId, status) {
  if (!currentAccount) return;
  try {
    const row = {
      message_id:     msgId,
      recipient_name: currentAccount.name,
      status,
      updated_at:     new Date().toISOString(),
      // Simpan user_agent PENERIMA (their device)
      // Ini diisi oleh pihak yang menerima pesan (delivered/read = their device)
      user_agent:     status === 'sent' ? null : navigator.userAgent
    };
    if (status === 'sent')      row.sent_at      = new Date().toISOString();
    if (status === 'delivered') row.delivered_at  = new Date().toISOString();
    if (status === 'read')      row.read_at       = new Date().toISOString();
    await sb.from('message_status').upsert(row, { onConflict: 'message_id,recipient_name' });
    setStatusInDom(msgId, status);
  } catch (e) {}
}

async function markRead() {
  if (!currentAccount || !otherUser) return;
  try {
    const { data } = await sb.from('chat_messages').select('id').eq('sender_name', otherUser).order('created_at', { ascending: false }).limit(30);
    if (data) for (const m of data) await upsertStatus(m.id, 'read');
  } catch (e) {}
}

// ===== TOPBAR USER =====
function _updateTopbarUser() {
  if (!currentAccount) return;
  const their = currentAccount.name === "Jef'z" ? 'Ndifaa' : "Jef'z";
  const el = document.getElementById('topbarUser');
  if (el) el.textContent = their;
}

// ===== REALTIME =====
function startRealtime() {
  if (chatChannel) { try { sb.removeChannel(chatChannel); } catch (e) {} chatChannel = null; }
  chatChannel = sb.channel('chat_' + Date.now())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (p) => {
      if (!p.new) return;
      const id = String(p.new.id); if (seenMsgIds.has(id)) return;
      appendMsg(p.new, true);
      if (currentAccount && p.new.sender_name !== currentAccount.name) {
        const open = document.getElementById('tabChat').classList.contains('active-tab');
        upsertStatus(p.new.id, open ? 'read' : 'delivered');
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, (p) => { if (p.new) updateMsgInDom(p.new); })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (p) => {
      if (!p.old || !p.old.id) return;
      const el = document.querySelector('[data-msg-id="' + p.old.id + '"]'); if (el) el.remove();
      seenMsgIds.delete(String(p.old.id));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'message_status' }, (p) => {
      if (!p.new) return; setStatusInDom(p.new.message_id, p.new.status);
    })
    .subscribe();
}

function startPoll() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    if (!isChatActive || !lastPollTs) return;
    try {
      const { data } = await sb.from('chat_messages').select('*').gt('created_at', lastPollTs).order('created_at', { ascending: true });
      if (data && data.length) { data.forEach(m => appendMsg(m, true)); lastPollTs = data[data.length-1].created_at; }
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
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence', filter: 'username=eq.' + otherUser }, (p) => { if (p.new) renderPresence(p.new); })
    .subscribe();
  await fetchPresence();
  if (presenceTimer) clearInterval(presenceTimer);
  presenceTimer = setInterval(fetchPresence, 5000);
  window.addEventListener('beforeunload', () => {
    rpc('update_presence', { p_username: currentAccount.name, p_is_online: false });
    rpc('update_typing',   { p_username: currentAccount.name, p_is_typing: false });
  });
}

async function fetchPresence() {
  if (!otherUser) return;
  try { const { data } = await sb.from('user_presence').select('*').eq('username', otherUser).maybeSingle(); if (data) renderPresence(data); } catch (e) {}
}

function renderPresence(data) {
  const onlineEl = document.getElementById('topbarOnline'); if (!onlineEl || !otherUser) return;
  onlineEl.classList.add('show');
  const userEl = document.getElementById('topbarUser'); if (userEl) userEl.textContent = otherUser;
  if (data.is_typing) { onlineEl.className = 'topbar-online show typing'; onlineEl.innerHTML = '<span class="topbar-online-dot"></span>' + esc(otherUser) + ' mengetik…'; setTypingUI(true, otherUser); return; }
  setTypingUI(false);
  if (data.is_online) { onlineEl.className = 'topbar-online show online'; onlineEl.innerHTML = '<span class="topbar-online-dot"></span>Online'; }
  else {
    onlineEl.className = 'topbar-online show offline';
    const ls = data.last_seen ? new Date(data.last_seen) : new Date(), diff = Date.now() - ls.getTime();
    const mn = Math.floor(diff/60000), hr = Math.floor(diff/3600000), dy = Math.floor(diff/86400000);
    let lbl; if (mn<1) lbl='Baru saja'; else if (mn<60) lbl=mn+' mnt lalu'; else if (hr<24) lbl=hr+' jam lalu'; else if (dy<7) lbl=dy+' hari lalu'; else lbl=ls.toLocaleDateString('id-ID',{day:'numeric',month:'short'});
    onlineEl.innerHTML = '<span class="topbar-online-dot"></span>Terakhir dilihat ' + lbl;
  }
  if (document.getElementById('tabChat').classList.contains('active-tab')) markRead();
}
