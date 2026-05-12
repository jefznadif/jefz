// ========== CHAT MODULE ==========

let chatChannel      = null;
let presenceChannel  = null;
let isChatActive     = false;
let chatLoaded       = false;
let seenMsgIds       = new Set();

let replyTarget         = null;
let emojiPickerOpen     = false;
let activeMsgActionMenu = null;

// Multi-select
let selectedMsgIds     = new Set();
let selectionModeActive = false;

// Presence
let otherUser        = null;
let presenceInterval = null;

// Typing
let typingTimeout    = null;
let isTyping         = false;

// ========== HELPERS ==========
function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtTime(d) {
  return new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function scrollBottom(el, smooth) {
  if (!el) return;
  requestAnimationFrame(() => {
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
  });
}

// ========== TYPING INDICATOR ==========
function ensureTypingIndicator() {
  let el = document.getElementById('typingIndicator');
  if (!el) {
    el = document.createElement('div');
    el.id = 'typingIndicator';
    el.className = 'typing-indicator';
    el.style.display = 'none';
    el.innerHTML =
      '<div class="typing-bubble">' +
        '<span class="typing-name" id="typingName"></span>' +
        '<span class="typing-dots"><span></span><span></span><span></span></span>' +
      '</div>';
    const chatList = document.getElementById('chatList');
    if (chatList && chatList.parentNode) {
      chatList.parentNode.insertBefore(el, chatList.nextSibling);
    }
  }
  return el;
}

function showTypingIndicator(name) {
  const el = ensureTypingIndicator();
  document.getElementById('typingName').textContent = name + ' sedang mengetik';
  el.style.display = 'flex';
  const chatList = document.getElementById('chatList');
  scrollBottom(chatList, true);
}

function hideTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.style.display = 'none';
}

// Handle self typing broadcast
function handleTypingInput() {
  if (!currentAccount) return;

  if (!isTyping) {
    isTyping = true;
    sb.rpc('update_typing', { p_username: currentAccount.name, p_is_typing: true }).catch(() => {});
  }

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    isTyping = false;
    sb.rpc('update_typing', { p_username: currentAccount.name, p_is_typing: false }).catch(() => {});
  }, 2000);
}

// ========== EMOJI DATA ==========
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

// ========== EMOJI PICKER ==========
function buildEmojiPicker() {
  const existing = document.getElementById('emojiPickerPanel');
  if (existing) return existing;

  const panel = document.createElement('div');
  panel.id = 'emojiPickerPanel';
  panel.className = 'emoji-picker-wrap';

  const hint = document.createElement('div');
  hint.className = 'emoji-swipe-hint';
  panel.appendChild(hint);

  const tabs = document.createElement('div');
  tabs.className = 'emoji-cat-tabs';
  const body = document.createElement('div');
  body.className = 'emoji-body';

  EMOJI_CATEGORIES.forEach((cat, idx) => {
    const tab = document.createElement('button');
    tab.className = 'emoji-cat-tab' + (idx === 0 ? ' active' : '');
    tab.title = cat.label;
    tab.textContent = cat.icon;
    tab.onclick = () => {
      document.querySelectorAll('.emoji-cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.emoji-section').forEach(s => s.style.display = 'none');
      document.getElementById('emoji-sec-' + idx).style.display = '';
    };
    tabs.appendChild(tab);

    const sec = document.createElement('div');
    sec.className = 'emoji-section';
    sec.id = 'emoji-sec-' + idx;
    if (idx !== 0) sec.style.display = 'none';
    cat.emojis.forEach(em => {
      const btn = document.createElement('button');
      btn.className = 'emoji-item';
      btn.textContent = em;
      btn.onclick = (e) => { e.stopPropagation(); insertEmoji(em); };
      sec.appendChild(btn);
    });
    body.appendChild(sec);
  });

  panel.appendChild(tabs);
  panel.appendChild(body);
  const chatBar = document.querySelector('.chat-bar');
  if (chatBar) chatBar.appendChild(panel);

  initEmojiSwipe(panel, tabs);
  return panel;
}

function initEmojiSwipe(panel) {
  let startX = 0, startY = 0, swiping = false;
  panel.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    swiping = false;
  }, { passive: true });
  panel.addEventListener('touchmove', (e) => {
    const dx = e.touches[0].clientX - startX;
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (!swiping && Math.abs(dx) > dy && Math.abs(dx) > 14) swiping = true;
  }, { passive: true });
  panel.addEventListener('touchend', (e) => {
    if (!swiping) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) < 50) return;
    const activeCat = document.querySelector('.emoji-cat-tab.active');
    const allCats   = Array.from(document.querySelectorAll('.emoji-cat-tab'));
    const idx  = allCats.indexOf(activeCat);
    const next = dx < 0 ? Math.min(idx + 1, allCats.length - 1) : Math.max(idx - 1, 0);
    if (next !== idx) allCats[next].click();
    swiping = false;
  });
}

function insertEmoji(em) {
  const input = document.getElementById('chatInput');
  if (!input) return;
  const start = input.selectionStart;
  const end   = input.selectionEnd;
  input.value = input.value.slice(0, start) + em + input.value.slice(end);
  const pos = start + em.length;
  input.setSelectionRange(pos, pos);
  input.focus();
}

function toggleEmojiPicker(e) {
  e.stopPropagation();
  const panel = document.getElementById('emojiPickerPanel') || buildEmojiPicker();
  emojiPickerOpen = !emojiPickerOpen;
  panel.style.display = emojiPickerOpen ? 'flex' : 'none';
  document.getElementById('emojiTrigger').classList.toggle('active', emojiPickerOpen);
}

function closeEmojiPicker() {
  emojiPickerOpen = false;
  const panel = document.getElementById('emojiPickerPanel');
  if (panel) panel.style.display = 'none';
  const trigger = document.getElementById('emojiTrigger');
  if (trigger) trigger.classList.remove('active');
}

// ========== REPLY SYSTEM ==========
function setReply(id, senderName, message) {
  replyTarget = { id, sender_name: senderName, message };
  const banner = document.getElementById('replyBanner');
  if (!banner) return;
  banner.style.display = 'flex';
  document.getElementById('replyBannerName').textContent = senderName;
  const preview = message.length > 60 ? message.slice(0, 60) + '…' : message;
  document.getElementById('replyBannerText').textContent = preview;
  document.getElementById('chatInput').focus();
}

function clearReplyBanner() {
  replyTarget = null;
  const banner = document.getElementById('replyBanner');
  if (banner) banner.style.display = 'none';
}

// ========== MESSAGE ACTION MENU ==========
function closeMsgActionMenu() {
  if (activeMsgActionMenu && activeMsgActionMenu.parentNode) activeMsgActionMenu.remove();
  activeMsgActionMenu = null;
}

function showMsgActionMenu(msgId, senderName, message, anchorEl) {
  closeMsgActionMenu();
  const isAdmin = currentAccount && currentAccount.role === 'admin';
  const isOwner = currentAccount && senderName === currentAccount.name;
  const canDelete = isAdmin || isOwner;

  const menu = document.createElement('div');
  menu.className = 'msg-action-menu';

  const replyBtn = document.createElement('button');
  replyBtn.className = 'msg-action-item';
  replyBtn.innerHTML = '↩ Balas';
  replyBtn.onclick = (e) => { e.stopPropagation(); closeMsgActionMenu(); setReply(msgId, senderName, message); };
  menu.appendChild(replyBtn);

  if (canDelete) {
    const delBtn = document.createElement('button');
    delBtn.className = 'msg-action-item danger';
    delBtn.innerHTML = '✕ Hapus';
    delBtn.onclick = (e) => { e.stopPropagation(); closeMsgActionMenu(); delMsg(msgId); };
    menu.appendChild(delBtn);
  }

  const rect  = anchorEl.getBoundingClientRect();
  const isMe  = currentAccount && senderName === currentAccount.name;
  menu.style.position = 'fixed';
  menu.style.top = (rect.bottom + 4) + 'px';
  if (isMe) menu.style.right = (window.innerWidth - rect.right) + 'px';
  else menu.style.left = rect.left + 'px';
  document.body.appendChild(menu);
  activeMsgActionMenu = menu;
}

async function delMsg(id) {
  const ok = await showConfirm('Hapus pesan ini?', {
    icon: '🗑', title: 'Hapus Pesan', okText: 'Hapus', cancelText: 'Batal'
  });
  if (!ok) return;
  const res = await sb.from('chat_messages').delete().eq('id', id);
  if (res.error) { toast('Gagal hapus', false); return; }
  const el = document.querySelector('[data-msg-id="' + id + '"]');
  if (el) el.remove();
  seenMsgIds.delete(String(id));
  toast('Pesan dihapus');
}

// ========== STATUS ICONS ==========
function getStatusIconHtml(status) {
  switch (status) {
    case 'sent':
      return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" class="status-sent"><polyline points="3.5 8 6.5 11 12.5 4.5"/></svg>';
    case 'delivered':
      return '<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="2" class="status-delivered"><polyline points="2 8 5 11 10.5 5"/><polyline points="7.5 8 10.5 11 16 5"/></svg>';
    case 'read':
      return '<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="2" class="status-read"><polyline points="2 8 5 11 10.5 5"/><polyline points="7.5 8 10.5 11 16 5"/></svg>';
    default:
      return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" class="status-pending"><circle cx="8" cy="8" r="6.5"/><polyline points="8 4.5 8 8 10.5 10"/></svg>';
  }
}

async function getStatusIcon(msgId) {
  try {
    const { data, error } = await sb
      .from('message_status')
      .select('status')
      .eq('message_id', msgId)
      .maybeSingle();
    if (error || !data) return getStatusIconHtml('pending');
    return getStatusIconHtml(data.status);
  } catch {
    return getStatusIconHtml('pending');
  }
}

// ========== BUILD MESSAGE ELEMENT ==========
function buildMsgEl(m) {
  const isMe      = currentAccount && m.sender_name === currentAccount.name;
  const nameColor = m.sender_name === "Jef'z" ? '#007aff' : '#e91e8c';
  const roleTag   = m.sender_role === 'admin' ? ' 👑' : '';

  const d = document.createElement('div');
  d.className = 'msg-row ' + (isMe ? 'mine' : 'theirs');
  if (m.id) d.dataset.msgId = String(m.id);

  const msgContent = m.message || '';
  const isImgMsg   = msgContent.startsWith('[img]');
  const isVidMsg   = msgContent.startsWith('[video]');
  const mediaUrl   = (isImgMsg || isVidMsg) ? msgContent.slice(isImgMsg ? 5 : 7) : null;

  const actionBtn = document.createElement('button');
  actionBtn.className = 'bubble-action-btn';
  actionBtn.title     = 'Opsi';
  actionBtn.textContent = '⋮';
  actionBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectionModeActive) return;
    showMsgActionMenu(m.id, m.sender_name, m.message || '', actionBtn);
  });

  let replyEl = null;
  if (m.reply_to_name && m.reply_to_text) {
    const rColor = m.reply_to_name === "Jef'z" ? '#007aff' : '#e91e8c';
    let rPreview = m.reply_to_text.length > 50 ? m.reply_to_text.slice(0, 50) + '…' : m.reply_to_text;
    if (rPreview.startsWith('[img]') || rPreview.startsWith('[video]')) {
      rPreview = rPreview.startsWith('[img]') ? '🖼 Foto' : '🎬 Video';
    }
    replyEl = document.createElement('div');
    replyEl.className = 'reply-preview';
    replyEl.style.borderLeft = '3px solid ' + rColor;
    replyEl.innerHTML =
      '<span class="reply-prev-name" style="color:' + rColor + '">' + esc(m.reply_to_name) + '</span>' +
      '<span class="reply-prev-text">' + esc(rPreview) + '</span>';
  }

  const bubble = document.createElement('div');
  bubble.className = mediaUrl ? 'bubble bubble-media' : 'bubble';
  bubble.appendChild(actionBtn);
  if (replyEl) bubble.appendChild(replyEl);

  if (isImgMsg && mediaUrl) {
    const img = document.createElement('img');
    img.src = mediaUrl; img.className = 'bubble-img'; img.loading = 'lazy';
    img.onclick = (e) => { e.stopPropagation(); openLightboxFromChat(mediaUrl); };
    bubble.appendChild(img);
  } else if (isVidMsg && mediaUrl) {
    const vid = document.createElement('video');
    vid.src = mediaUrl; vid.className = 'bubble-vid';
    vid.preload = 'metadata'; vid.controls = true; vid.playsInline = true;
    bubble.appendChild(vid);
  } else {
    bubble.appendChild(document.createTextNode(msgContent));
  }

  // Time + Status
  const timeStatusWrap = document.createElement('span');
  timeStatusWrap.style.cssText =
    'float:right;margin-left:6px;margin-bottom:-2px;position:relative;top:3px;' +
    'display:inline-flex;align-items:center;gap:3px;pointer-events:none;white-space:nowrap;';

  const btime = document.createElement('span');
  btime.textContent = fmtTime(m.created_at);
  btime.style.cssText = 'font-size:10px;color:var(--text3);';
  timeStatusWrap.appendChild(btime);

  if (isMe && m.id) {
    const statusEl = document.createElement('span');
    statusEl.className = 'msg-status-icons';
    statusEl.dataset.statusMsgId = m.id;
    statusEl.innerHTML = getStatusIconHtml('pending');

    // Async fetch real status
    getStatusIcon(m.id).then(html => { statusEl.innerHTML = html; });
    timeStatusWrap.appendChild(statusEl);
  }

  bubble.appendChild(timeStatusWrap);

  const blockInner = document.createElement('div');
  blockInner.className = 'msg-block-inner';

  if (!isMe) {
    const senderSpan = document.createElement('span');
    senderSpan.className = 'msg-sender';
    senderSpan.style.color = nameColor;
    senderSpan.textContent = m.sender_name + roleTag;
    blockInner.appendChild(senderSpan);
  }
  blockInner.appendChild(bubble);

  const msgBlock = document.createElement('div');
  msgBlock.className = 'msg-block';
  msgBlock.appendChild(blockInner);

  const swipeWrap = document.createElement('div');
  swipeWrap.className = 'msg-swipe-wrap';
  swipeWrap.appendChild(msgBlock);

  d.appendChild(swipeWrap);

  initLongPressSelect(d, m);
  initSwipeReply(d, m);
  return d;
}

// ========== LONG PRESS SELECT ==========
function initLongPressSelect(rowEl, m) {
  const bubble = rowEl.querySelector('.bubble');
  if (!bubble) return;
  let pressTimer = null, moved = false, startX = 0, startY = 0;

  bubble.addEventListener('touchstart', (e) => {
    if (e.target.closest('.bubble-action-btn')) return;
    if (selectionModeActive) return;
    moved = false;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    pressTimer = setTimeout(() => {
      if (!moved && m.id) {
        if (navigator.vibrate) navigator.vibrate(40);
        enterSelectionMode(String(m.id));
      }
    }, 500);
  }, { passive: true });

  bubble.addEventListener('touchmove', (e) => {
    const dx = Math.abs(e.touches[0].clientX - startX);
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dx > 8 || dy > 8) { moved = true; clearTimeout(pressTimer); }
  }, { passive: true });

  bubble.addEventListener('touchend', (e) => {
    clearTimeout(pressTimer);
    if (selectionModeActive && !moved && m.id) {
      e.stopPropagation();
      toggleMsgSelection(String(m.id));
    }
    moved = false;
  });

  bubble.addEventListener('touchcancel', () => { clearTimeout(pressTimer); moved = false; });
}

// ========== SWIPE TO REPLY ==========
function initSwipeReply(rowEl, m) {
  const swipeWrap = rowEl.querySelector('.msg-swipe-wrap');
  let startX = 0, startY = 0, dx = 0, swiping = false, triggered = false;

  swipeWrap.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dx = 0; swiping = false; triggered = false;
  }, { passive: true });

  swipeWrap.addEventListener('touchmove', (e) => {
    if (selectionModeActive) return;
    dx = e.touches[0].clientX - startX;
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (!swiping && Math.abs(dx) > dy && Math.abs(dx) > 8) swiping = true;
    if (!swiping) return;
    const clamped = Math.min(Math.max(0, dx), 72);
    swipeWrap.style.transform  = 'translateX(' + clamped + 'px)';
    swipeWrap.style.transition = 'none';
    if (clamped >= 60 && !triggered) {
      triggered = true;
      rowEl.classList.add('reply-flash');
      setTimeout(() => rowEl.classList.remove('reply-flash'), 200);
    }
    if (e.cancelable) e.preventDefault();
  }, { passive: false });

  swipeWrap.addEventListener('touchend', () => {
    if (!selectionModeActive && triggered && dx >= 60) {
      setReply(m.id, m.sender_name, m.message || '');
    }
    swipeWrap.style.transition = 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)';
    swipeWrap.style.transform  = 'translateX(0)';
    swiping = false; triggered = false;
  });
}

// ========== APPEND MESSAGE ==========
function appendMsg(m, smooth) {
  const el = document.getElementById('chatList');
  if (!el) return;
  const id = String(m.id || '');
  if (id && seenMsgIds.has(id)) return;
  if (id) seenMsgIds.add(id);
  const ph = el.querySelector('.state-msg');
  if (ph) el.innerHTML = '';
  el.appendChild(buildMsgEl(m));
  const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
  scrollBottom(el, smooth && dist < 400);
}

// ========== INIT CHAT ==========
async function initChat() {
  isChatActive = true;
  const el = document.getElementById('chatList');

  // Pasang listener typing pada input
  const chatInput = document.getElementById('chatInput');
  if (chatInput && !chatInput._typingBound) {
    chatInput._typingBound = true;
    chatInput.addEventListener('input', () => {
      autoResize(chatInput);
      handleTypingInput();
    });
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
    });
  }

  if (!chatLoaded) {
    el.innerHTML = '<p class="state-msg">Memuat...</p>';
    const res = await sb
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (res.error) {
      el.innerHTML = '<p class="state-msg err">Error: ' + res.error.message + '</p>';
      return;
    }

    el.innerHTML = '';
    chatLoaded = true;

    if (!res.data || !res.data.length) {
      el.innerHTML = '<p class="state-msg">Belum ada pesan. Mulai chat!</p>';
    } else {
      const frag = document.createDocumentFragment();
      res.data.forEach(m => {
        seenMsgIds.add(String(m.id));
        frag.appendChild(buildMsgEl(m));
      });
      el.appendChild(frag);
      scrollBottom(el, false);
    }
  }

  ensureTypingIndicator();
  startChatSync();
  startPresence();
}

// ========== REALTIME SYNC ==========
function startChatSync() {
  if (chatChannel) {
    try { sb.removeChannel(chatChannel); } catch (e) {}
    chatChannel = null;
  }

  chatChannel = sb
    .channel('chat_realtime_' + Date.now())
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages' },
      (payload) => {
        if (!isChatActive || !payload.new) return;
        const newId = String(payload.new.id);

        // Skip jika sudah ada (dari sendMsg langsung)
        if (seenMsgIds.has(newId)) return;

        appendMsg(payload.new, true);

        // Auto mark delivered/read untuk pesan masuk
        if (currentAccount && payload.new.sender_name !== currentAccount.name) {
          const tabActive = document.getElementById('tabChat').classList.contains('active-tab');
          updateMsgStatus(payload.new.id, tabActive ? 'read' : 'delivered');
        }
      }
    )
    .on('postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'chat_messages' },
      (payload) => {
        if (!payload.old || !payload.old.id) return;
        const el = document.querySelector('[data-msg-id="' + payload.old.id + '"]');
        if (el) el.remove();
        seenMsgIds.delete(String(payload.old.id));
      }
    )
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'message_status' },
      (payload) => {
        if (!payload.new || !isChatActive) return;
        const iconEl = document.querySelector('[data-status-msg-id="' + payload.new.message_id + '"]');
        if (iconEl) iconEl.innerHTML = getStatusIconHtml(payload.new.status);
      }
    )
    .subscribe();
}

// ========== PRESENCE & TYPING REALTIME ==========
async function startPresence() {
  if (!currentAccount) return;

  // Tentukan other user
  otherUser = currentAccount.name === "Jef'z" ? 'Ndifaa' : "Jef'z";

  // Set self online
  await sb.rpc('update_presence', { p_username: currentAccount.name, p_is_online: true }).catch(() => {});

  // Stop channel lama
  if (presenceChannel) {
    try { sb.removeChannel(presenceChannel); } catch (e) {}
  }

  // Subscribe perubahan presence other user (online + typing)
  presenceChannel = sb
    .channel('presence_watch_' + Date.now())
    .on('postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_presence',
        filter: 'username=eq.' + otherUser
      },
      (payload) => {
        if (!payload.new) return;
        updateOnlineStatus(payload.new);
      }
    )
    .subscribe();

  // Fetch initial presence langsung
  fetchPresence();

  // Poll setiap 5 detik sebagai fallback
  if (presenceInterval) clearInterval(presenceInterval);
  presenceInterval = setInterval(fetchPresence, 5000);

  // Set offline saat unload
  window.addEventListener('beforeunload', handleUnload);
}

function handleUnload() {
  if (!currentAccount) return;
  // Pakai sendBeacon agar tidak terputus
  const url = 'https://cxlvnwbfdbymdoddjqwn.supabase.co/rest/v1/rpc/update_presence';
  const payload = JSON.stringify({ p_username: currentAccount.name, p_is_online: false });
  try {
    navigator.sendBeacon && navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
    sb.rpc('update_presence', { p_username: currentAccount.name, p_is_online: false });
    sb.rpc('update_typing',   { p_username: currentAccount.name, p_is_typing: false });
  } catch (e) {}
}

async function fetchPresence() {
  if (!otherUser) return;
  try {
    const { data, error } = await sb
      .from('user_presence')
      .select('*')
      .eq('username', otherUser)
      .maybeSingle();
    if (!error && data) updateOnlineStatus(data);
  } catch (e) {}
}

function updateOnlineStatus(data) {
  const onlineEl = document.getElementById('topbarOnline');
  if (!onlineEl || !otherUser) return;

  // ===== FIX: tampilkan nama other user, bukan mine =====
  onlineEl.classList.add('show');

  // Cek typing dulu
  if (data.is_typing) {
    onlineEl.className = 'topbar-online show typing';
    onlineEl.innerHTML = '<span class="topbar-online-dot"></span>' + esc(otherUser) + ' mengetik…';
    return;
  }

  if (data.is_online) {
    onlineEl.className = 'topbar-online show online';
    onlineEl.innerHTML = '<span class="topbar-online-dot"></span>Online';
  } else {
    onlineEl.className = 'topbar-online show offline';

    const lastSeen  = data.last_seen ? new Date(data.last_seen) : new Date();
    const now       = new Date();
    const diffMs    = now - lastSeen;
    const diffMins  = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays  = Math.floor(diffMs / 86400000);

    let label;
    if (diffMins < 1)       label = 'Baru saja';
    else if (diffMins < 60) label = diffMins + ' mnt lalu';
    else if (diffHours < 24) label = diffHours + ' jam lalu';
    else if (diffDays < 7)  label = diffDays + ' hari lalu';
    else                    label = lastSeen.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

    onlineEl.innerHTML = '<span class="topbar-online-dot"></span>Terakhir dilihat ' + label;
  }

  // Typing indicator di bawah chat list
  if (data.is_typing) showTypingIndicator(otherUser);
  else hideTypingIndicator();

  // Auto mark read
  if (document.getElementById('tabChat').classList.contains('active-tab')) {
    markAllRead();
  }
}

// ========== MESSAGE STATUS ==========
async function updateMsgStatus(msgId, status) {
  if (!currentAccount || !otherUser) return;
  try {
    const updateData = {
      message_id:     msgId,
      recipient_name: currentAccount.name,
      status:         status,
      updated_at:     new Date().toISOString()
    };
    if (status === 'delivered') updateData.delivered_at = new Date().toISOString();
    if (status === 'read')      updateData.read_at      = new Date().toISOString();

    await sb
      .from('message_status')
      .upsert(updateData, { onConflict: 'message_id,recipient_name' });

    // Update icon langsung di UI
    const iconEl = document.querySelector('[data-status-msg-id="' + msgId + '"]');
    if (iconEl) iconEl.innerHTML = getStatusIconHtml(status);
  } catch (e) {}
}

async function markAllRead() {
  if (!currentAccount || !otherUser) return;
  try {
    const { data } = await sb
      .from('chat_messages')
      .select('id')
      .eq('sender_name', otherUser)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data && data.length) {
      for (const msg of data) {
        await updateMsgStatus(msg.id, 'read');
      }
    }
  } catch (e) {}
}

// ========== SEND MESSAGE ==========
let isSending = false;

async function sendMsg() {
  if (isSending) return;
  const input  = document.getElementById('chatInput');
  const rawMsg = input.value;
  const msg    = rawMsg.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
  if (!msg || !currentAccount) return;

  isSending = true;
  input.value = '';
  input.style.height = '';
  input.focus();

  // Stop typing langsung saat kirim
  if (isTyping) {
    isTyping = false;
    clearTimeout(typingTimeout);
    sb.rpc('update_typing', { p_username: currentAccount.name, p_is_typing: false }).catch(() => {});
  }

  const insertData = {
    message:     msg,
    user_id:     USER_ID,
    sender_name: currentAccount.name,
    sender_role: currentAccount.role
  };

  if (replyTarget) {
    insertData.reply_to_id   = replyTarget.id;
    insertData.reply_to_name = replyTarget.sender_name;
    insertData.reply_to_text = replyTarget.message;
  }
  clearReplyBanner();

  const { data, error } = await sb
    .from('chat_messages')
    .insert([insertData])
    .select()
    .single();

  if (error) {
    toast('Gagal kirim', false);
    input.value = msg;
    isSending = false;
    return;
  }

  if (data) {
    const msgId = String(data.id);
    if (!seenMsgIds.has(msgId)) {
      seenMsgIds.add(msgId);
      const el = document.getElementById('chatList');
      const ph = el.querySelector('.state-msg');
      if (ph) el.innerHTML = '';
      el.appendChild(buildMsgEl(data));
      scrollBottom(el, true);
    }
    // Update status to sent
    await updateMsgStatus(data.id, 'sent');
  }

  isSending = false;
}

// ========== CHAT UPLOAD ==========
async function doChatUpload(input) {
  if (!currentAccount) return;
  const file = input.files[0];
  if (!file) return;

  const isVid = file.type.startsWith('video/');
  const ext   = file.name.split('.').pop();
  const name  = 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + '.' + ext;
  const uploadUrl = SB_URL + '/storage/v1/object/gallery/' + name;

  try {
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl, true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + SB_KEY);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.setRequestHeader('Cache-Control', '3600');
      xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.status));
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(file);
    });
  } catch {
    toast('Upload gagal', false);
    input.value = '';
    return;
  }

  const pub        = sb.storage.from('gallery').getPublicUrl(name);
  const mediaUrl   = pub.data.publicUrl;
  const msgContent = isVid ? '[video]' + mediaUrl : '[img]' + mediaUrl;

  const res = await sb.from('chat_messages').insert([{
    message:     msgContent,
    user_id:     USER_ID,
    sender_name: currentAccount.name,
    sender_role: currentAccount.role
  }]);

  if (res.error) toast('Gagal kirim media', false);
  else toast('Media terkirim ✓');
  input.value = '';
}

// ========== MULTI-SELECT ==========
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
  const row = document.querySelector('[data-msg-id="' + msgId + '"]');
  if (row) row.classList.add('msg-selected');
}

function _removeFromSelection(msgId) {
  selectedMsgIds.delete(msgId);
  const row = document.querySelector('[data-msg-id="' + msgId + '"]');
  if (row) row.classList.remove('msg-selected');
}

function _renderSelectionBar() {
  let bar = document.getElementById('selectionBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'selectionBar';
    bar.className = 'selection-bar';
    document.querySelector('.topbar').appendChild(bar);
  }
  const isAdmin    = currentAccount && currentAccount.role === 'admin';
  const canDelAll  = isAdmin || _allSelectedAreOwn();
  bar.innerHTML =
    '<button class="sel-cancel-btn" onclick="exitSelectionMode()">✕ Batal</button>' +
    '<span class="sel-label">' + selectedMsgIds.size + ' dipilih</span>' +
    (canDelAll ? '<button class="sel-delete-btn" onclick="delSelectedMsgs()">🗑 Hapus</button>' : '<span style="width:74px"></span>');
  bar.style.display = 'flex';
}

function _allSelectedAreOwn() {
  for (const id of selectedMsgIds) {
    const row = document.querySelector('[data-msg-id="' + id + '"]');
    if (!row || !row.classList.contains('mine')) return false;
  }
  return true;
}

function exitSelectionMode() {
  selectionModeActive = false;
  selectedMsgIds.clear();
  document.querySelectorAll('.msg-selected').forEach(el => el.classList.remove('msg-selected'));
  const bar = document.getElementById('selectionBar');
  if (bar) bar.style.display = 'none';
}

async function delSelectedMsgs() {
  if (selectedMsgIds.size === 0) return;
  const ids   = Array.from(selectedMsgIds);
  const label = ids.length === 1 ? 'pesan ini' : ids.length + ' pesan';
  const ok    = await showConfirm('Hapus ' + label + '?', {
    icon: '🗑', title: 'Hapus Pesan', okText: 'Hapus', cancelText: 'Batal'
  });
  if (!ok) return;
  exitSelectionMode();
  const res = await sb.from('chat_messages').delete().in('id', ids);
  if (res.error) { toast('Gagal hapus', false); return; }
  ids.forEach(id => {
    const el = document.querySelector('[data-msg-id="' + id + '"]');
    if (el) el.remove();
    seenMsgIds.delete(String(id));
  });
  toast(ids.length === 1 ? 'Pesan dihapus' : ids.length + ' pesan dihapus');
}

// ========== GALLERY ==========
let galleryItems  = [];
let galleryLoaded = false;
let lbCurrentIdx  = -1;

async function loadGallery() {
  const el = document.getElementById('galleryGrid');
  el.innerHTML = '<p class="state-msg">Memuat...</p>';

  const res = await sb.from('gallery').select('*').order('created_at', { ascending: false });
  if (res.error) { el.innerHTML = '<p class="state-msg err">Error: ' + res.error.message + '</p>'; return; }

  galleryLoaded = true;
  galleryItems  = [];

  if (!res.data || !res.data.length) {
    el.innerHTML = '<p class="state-msg">Belum ada media.</p>';
    return;
  }

  el.innerHTML = '';
  const isAdmin = currentAccount && currentAccount.role === 'admin';
  const frag    = document.createDocumentFragment();

  res.data.forEach((f, idx) => {
    const isVid = /\.(mp4|webm|mov|avi)$/i.test(f.file_name || '');
    galleryItems.push({ url: f.file_url, isVid });

    const d = document.createElement('div');
    d.className = 'g-item';

    if (isVid) {
      const thumb = document.createElement('div');
      thumb.className = 'g-video-thumb';
      thumb.style.cssText = 'position:relative;width:100%;height:100%;';
      const vid = document.createElement('video');
      vid.className  = 'g-media g-video-preview';
      vid.preload    = 'metadata';
      vid.muted      = true;
      vid.playsInline = true;
      vid.src        = f.file_url + '#t=0.001';
      const playIcon = document.createElement('div');
      playIcon.className = 'g-play-icon';
      playIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="white" width="28" height="28"><circle cx="12" cy="12" r="12" fill="rgba(0,0,0,0.5)"/><polygon points="10,8 18,12 10,16" fill="white"/></svg>';
      thumb.appendChild(vid);
      thumb.appendChild(playIcon);
      ((i) => { thumb.onclick = () => openLightbox(i); })(idx);
      d.appendChild(thumb);
    } else {
      const img = document.createElement('img');
      img.src       = f.file_url;
      img.className = 'g-media';
      img.loading   = 'lazy';
      img.decoding  = 'async';
      ((i) => { img.onclick = () => openLightbox(i); })(idx);
      d.appendChild(img);
    }

    if (isAdmin) {
      const delBtn = document.createElement('button');
      delBtn.className   = 'g-del';
      delBtn.textContent = '✕';
      delBtn.onclick = (e) => { e.stopPropagation(); delMedia(f.id, f.file_name); };
      d.appendChild(delBtn);
    }

    frag.appendChild(d);
  });

  el.appendChild(frag);
}

async function delMedia(id, name) {
  if (!currentAccount || currentAccount.role !== 'admin') return;
  const ok = await showConfirm('Hapus media ini?', { icon: '🗑', title: 'Hapus Media', okText: 'Hapus', cancelText: 'Batal' });
  if (!ok) return;
  await sb.storage.from('gallery').remove([name]);
  const res = await sb.from('gallery').delete().eq('id', id);
  if (res.error) { toast('Gagal hapus', false); return; }
  toast('Dihapus');
  galleryLoaded = false;
  loadGallery();
}

// ========== GALLERY UPLOAD ==========
let pendingUploadFile = null;
let uploadXHR         = null;

function triggerUploadConfirm(input) {
  if (!currentAccount || currentAccount.role !== 'admin') {
    toast('Hanya admin yang bisa upload', false);
    input.value = '';
    return;
  }
  const file = input.files[0];
  if (!file) return;

  pendingUploadFile = file;
  document.getElementById('uploadFileName').textContent = file.name;
  document.getElementById('uploadFileSize').textContent = fmtBytes(file.size) + ' · ' + (file.type || 'unknown');
  document.getElementById('uploadProgressWrap').style.display = 'none';
  document.getElementById('uploadProgressFill').style.width   = '0%';
  document.getElementById('uploadPctLabel').textContent       = '0%';
  document.getElementById('uploadSpeedLabel').textContent     = '—';
  document.getElementById('uploadRemainLabel').textContent    = '—';

  const goBtn     = document.getElementById('uploadGoBtn');
  const cancelBtn = document.getElementById('uploadCancelBtn');
  const closeBtn  = document.getElementById('uploadModalCloseBtn');
  goBtn.disabled  = false;
  goBtn.textContent    = 'Upload';
  cancelBtn.textContent = 'Batal';
  closeBtn.style.display = '';
  document.getElementById('uploadConfirmModal').classList.add('show');
  input.value = '';
}

function cancelUploadModal() {
  if (uploadXHR) { try { uploadXHR.abort(); } catch (e) {} uploadXHR = null; }
  pendingUploadFile = null;
  document.getElementById('uploadConfirmModal').classList.remove('show');
}

async function startGalleryUpload() {
  if (!pendingUploadFile) return;
  const file    = pendingUploadFile;
  const goBtn   = document.getElementById('uploadGoBtn');
  const cancelBtn = document.getElementById('uploadCancelBtn');
  const closeBtn  = document.getElementById('uploadModalCloseBtn');
  goBtn.disabled  = true;
  goBtn.textContent     = 'Mengupload...';
  closeBtn.style.display = 'none';
  cancelBtn.textContent  = 'Batalkan';

  document.getElementById('uploadProgressWrap').style.display = 'flex';
  const ext  = file.name.split('.').pop();
  const name = Date.now() + '_' + Math.random().toString(36).slice(2, 6) + '.' + ext;
  const uploadUrl = SB_URL + '/storage/v1/object/gallery/' + name;

  let lastLoaded = 0, lastTime = Date.now(), success = false;

  try {
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      uploadXHR = xhr;
      xhr.open('POST', uploadUrl, true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + SB_KEY);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.setRequestHeader('Cache-Control', '3600');
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const now     = Date.now();
        const pct     = Math.round((e.loaded / e.total) * 100);
        const elapsed = (now - lastTime) / 1000;
        const speed   = elapsed > 0 ? (e.loaded - lastLoaded) / elapsed : 0;
        lastLoaded = e.loaded; lastTime = now;
        document.getElementById('uploadProgressFill').style.width = pct + '%';
        document.getElementById('uploadPctLabel').textContent     = pct + '%';
        document.getElementById('uploadSpeedLabel').textContent   = speed > 0 ? fmtBytes(speed) + '/s' : '—';
        document.getElementById('uploadRemainLabel').textContent  = fmtBytes(e.total - e.loaded) + ' tersisa';
      };
      xhr.onload  = () => { uploadXHR = null; xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('HTTP ' + xhr.status)); };
      xhr.onerror = () => { uploadXHR = null; reject(new Error('Network error')); };
      xhr.onabort = () => { uploadXHR = null; reject(new Error('Dibatalkan')); };
      xhr.send(file);
    });
    success = true;
  } catch (err) {
    if (err.message === 'Dibatalkan') toast('Upload dibatalkan', false);
    else toast('Upload gagal: ' + err.message, false);
    goBtn.disabled = false;
    goBtn.textContent     = 'Upload';
    cancelBtn.textContent = 'Batal';
    closeBtn.style.display = '';
    document.getElementById('uploadProgressWrap').style.display = 'none';
    document.getElementById('uploadConfirmModal').classList.remove('show');
    pendingUploadFile = null;
    return;
  }

  if (!success) return;

  const pub   = sb.storage.from('gallery').getPublicUrl(name);
  const dbRes = await sb.from('gallery').insert([{
    file_url:    pub.data.publicUrl,
    file_name:   name,
    uploaded_by: currentAccount ? currentAccount.name : null
  }]);

  if (dbRes.error) toast('Gagal simpan: ' + dbRes.error.message, false);
  else { toast('Berhasil diupload ✓'); galleryLoaded = false; loadGallery(); }

  pendingUploadFile = null;
  uploadXHR         = null;
  document.getElementById('uploadConfirmModal').classList.remove('show');
}

// ========== LIGHTBOX ==========
function openLightbox(idx) {
  lbCurrentIdx = typeof idx === 'number' ? idx : -1;
  _renderLightboxItem(lbCurrentIdx);
  _updateLightboxNav();
  document.getElementById('lightbox').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function openLightboxFromChat(url) {
  lbCurrentIdx = -1;
  const wrap = document.getElementById('lightboxMediaWrap');
  _clearLightboxMedia(wrap);
  const img = document.getElementById('lightboxImg');
  img.src = url;
  img.style.display = '';
  document.getElementById('lightboxCounter').innerHTML = '';
  document.getElementById('lightboxPrev').style.display = 'none';
  document.getElementById('lightboxNext').style.display = 'none';
  document.getElementById('lightbox').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function _clearLightboxMedia(wrap) {
  if (!wrap) wrap = document.getElementById('lightboxMediaWrap');
  const oldVid = wrap.querySelector('video');
  if (oldVid) { try { oldVid.pause(); oldVid.src = ''; } catch (e) {} oldVid.remove(); }
  const img = document.getElementById('lightboxImg');
  if (img) { img.src = ''; img.style.display = 'none'; }
}

function _renderLightboxItem(idx) {
  const wrap = document.getElementById('lightboxMediaWrap');
  _clearLightboxMedia(wrap);
  const img = document.getElementById('lightboxImg');
  if (idx < 0 || !galleryItems[idx]) return;
  const item = galleryItems[idx];
  if (item.isVid) {
    img.style.display = 'none';
    const vid = document.createElement('video');
    vid.id       = 'lightboxVideo';
    vid.src      = item.url;
    vid.controls = true;
    vid.playsInline = true;
    vid.style.cssText = 'max-width:100%;max-height:76vh;width:auto;height:auto;object-fit:contain;display:block;';
    wrap.appendChild(vid);
  } else {
    img.src = item.url;
    img.style.display = '';
  }
  _updateLightboxCounter(idx);
}

function _updateLightboxNav() {
  const prev = document.getElementById('lightboxPrev');
  const next = document.getElementById('lightboxNext');
  if (lbCurrentIdx < 0 || galleryItems.length <= 1) {
    if (prev) prev.style.display = 'none';
    if (next) next.style.display = 'none';
    return;
  }
  if (prev) prev.style.display = lbCurrentIdx > 0 ? '' : 'none';
  if (next) next.style.display = lbCurrentIdx < galleryItems.length - 1 ? '' : 'none';
}

function _updateLightboxCounter(idx) {
  const counter = document.getElementById('lightboxCounter');
  if (!counter || galleryItems.length <= 1) { if (counter) counter.innerHTML = ''; return; }
  const start = Math.max(0, idx - 5);
  const end   = Math.min(galleryItems.length - 1, start + 11);
  let dots = '';
  for (let i = start; i <= end; i++) {
    dots += '<span class="lb-dot' + (i === idx ? ' active' : '') + '"></span>';
  }
  counter.innerHTML = dots;
}

function lightboxNav(dir) {
  if (lbCurrentIdx < 0) return;
  const next = lbCurrentIdx + dir;
  if (next < 0 || next >= galleryItems.length) return;
  lbCurrentIdx = next;
  const wrap = document.getElementById('lightboxMediaWrap');
  wrap.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
  wrap.style.opacity    = '0';
  wrap.style.transform  = 'translateX(' + (dir > 0 ? '24px' : '-24px') + ')';
  setTimeout(() => {
    _renderLightboxItem(lbCurrentIdx);
    _updateLightboxNav();
    wrap.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    wrap.style.opacity    = '1';
    wrap.style.transform  = 'translateX(0)';
  }, 120);
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('show');
  const wrap = document.getElementById('lightboxMediaWrap');
  _clearLightboxMedia(wrap);
  const img = document.getElementById('lightboxImg');
  if (img) { img.src = ''; img.style.display = ''; }
  document.getElementById('lightboxCounter').innerHTML = '';
  lbCurrentIdx = -1;
  document.body.style.overflow = '';
  if (wrap) { wrap.style.opacity = ''; wrap.style.transform = ''; wrap.style.transition = ''; }
}

// Lightbox swipe
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const lb = document.getElementById('lightbox');
    if (!lb) return;
    let lbSwipeStartX = 0, lbSwiping = false;
    lb.addEventListener('touchstart', (e) => {
      if (e.target.closest('.lightbox-close,.lightbox-prev,.lightbox-next')) return;
      lbSwipeStartX = e.touches[0].clientX;
      lbSwiping = false;
    }, { passive: true });
    lb.addEventListener('touchmove', (e) => {
      if (Math.abs(e.touches[0].clientX - lbSwipeStartX) > 12) lbSwiping = true;
    }, { passive: true });
    lb.addEventListener('touchend', (e) => {
      if (!lbSwiping) return;
      const dx = e.changedTouches[0].clientX - lbSwipeStartX;
      lbSwiping = false;
      if (Math.abs(dx) > 60) lightboxNav(dx < 0 ? 1 : -1);
    });
  });
})();

// ========== CLEANUP ==========
window.addEventListener('beforeunload', () => {
  if (presenceInterval) clearInterval(presenceInterval);
  if (chatChannel)      { try { sb.removeChannel(chatChannel); } catch (e) {} }
  if (presenceChannel)  { try { sb.removeChannel(presenceChannel); } catch (e) {} }
  // Stop typing
  if (isTyping && currentAccount) {
    sb.rpc('update_typing', { p_username: currentAccount.name, p_is_typing: false }).catch(() => {});
  }
});
