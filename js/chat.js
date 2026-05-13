// ========== CHAT MODULE ==========

let chatChannel      = null;
let presenceChannel  = null;
let isChatActive     = false;
let chatLoaded       = false;
let seenMsgIds       = new Set();
let replyTarget      = null;
let emojiPickerOpen  = false;
let activeMsgActionMenu = null;
let selectedMsgIds   = new Set();
let selectionModeActive = false;
let otherUser        = null;
let presenceInterval = null;
let typingTimeout    = null;
let isTyping         = false;
let pollTimer        = null;

// ========== DEBUG: tampil error di layar HP ==========
function dbg(msg) {
  console.error(msg);
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = '⚠ ' + String(msg).slice(0, 120);
  el.className = 'toast show err';
  setTimeout(() => { el.className = 'toast'; }, 6000);
}

// ========== HELPERS ==========
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function fmtTime(d) { return new Date(d).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}); }
function scrollBottom(el, smooth) {
  if (!el) return;
  requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' }));
}

// ========== TYPING INDICATOR ==========
function ensureTypingIndicator() {
  let el = document.getElementById('typingIndicator');
  if (!el) {
    el = document.createElement('div');
    el.id = 'typingIndicator';
    el.className = 'typing-indicator';
    el.style.display = 'none';
    el.innerHTML = '<div class="typing-bubble"><span class="typing-name" id="typingName"></span><span class="typing-dots"><span></span><span></span><span></span></span></div>';
    const chatList = document.getElementById('chatList');
    if (chatList && chatList.parentNode) chatList.parentNode.insertBefore(el, chatList.nextSibling);
  }
  return el;
}
function showTypingIndicator(name) {
  const el = ensureTypingIndicator();
  const n  = document.getElementById('typingName');
  if (n) n.textContent = name + ' mengetik';
  el.style.display = 'flex';
  scrollBottom(document.getElementById('chatList'), true);
}
function hideTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.style.display = 'none';
}
function handleTypingInput() {
  if (!currentAccount) return;
  if (!isTyping) {
    isTyping = true;
    sb.rpc('update_typing', { p_username: currentAccount.name, p_is_typing: true }).catch(()=>{});
  }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    isTyping = false;
    sb.rpc('update_typing', { p_username: currentAccount.name, p_is_typing: false }).catch(()=>{});
  }, 2000);
}

// ========== EMOJI ==========
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
  const existing = document.getElementById('emojiPickerPanel');
  if (existing) return existing;
  const panel = document.createElement('div');
  panel.id = 'emojiPickerPanel'; panel.className = 'emoji-picker-wrap';
  const hint = document.createElement('div'); hint.className = 'emoji-swipe-hint'; panel.appendChild(hint);
  const tabs = document.createElement('div'); tabs.className = 'emoji-cat-tabs';
  const body = document.createElement('div'); body.className = 'emoji-body';
  EMOJI_CATEGORIES.forEach((cat, idx) => {
    const tab = document.createElement('button');
    tab.className = 'emoji-cat-tab' + (idx===0?' active':''); tab.title = cat.label; tab.textContent = cat.icon;
    tab.onclick = () => { document.querySelectorAll('.emoji-cat-tab').forEach(t=>t.classList.remove('active')); tab.classList.add('active'); document.querySelectorAll('.emoji-section').forEach(s=>s.style.display='none'); document.getElementById('emoji-sec-'+idx).style.display=''; };
    tabs.appendChild(tab);
    const sec = document.createElement('div'); sec.className = 'emoji-section'; sec.id = 'emoji-sec-'+idx; if (idx!==0) sec.style.display='none';
    cat.emojis.forEach(em => { const btn=document.createElement('button'); btn.className='emoji-item'; btn.textContent=em; btn.onclick=(e)=>{e.stopPropagation();insertEmoji(em);}; sec.appendChild(btn); });
    body.appendChild(sec);
  });
  panel.appendChild(tabs); panel.appendChild(body);
  const chatBar = document.querySelector('.chat-bar'); if (chatBar) chatBar.appendChild(panel);
  return panel;
}
function insertEmoji(em) {
  const input = document.getElementById('chatInput'); if (!input) return;
  const s = input.selectionStart, e = input.selectionEnd;
  input.value = input.value.slice(0,s) + em + input.value.slice(e);
  input.setSelectionRange(s+em.length, s+em.length); input.focus();
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
  const p = document.getElementById('emojiPickerPanel'); if (p) p.style.display='none';
  const t = document.getElementById('emojiTrigger'); if (t) t.classList.remove('active');
}

// ========== REPLY ==========
function setReply(id, senderName, message) {
  replyTarget = { id, sender_name: senderName, message };
  const banner = document.getElementById('replyBanner'); if (!banner) return;
  banner.style.display = 'flex';
  document.getElementById('replyBannerName').textContent = senderName;
  document.getElementById('replyBannerText').textContent = message.length>60 ? message.slice(0,60)+'…' : message;
  document.getElementById('chatInput').focus();
}
function clearReplyBanner() {
  replyTarget = null;
  const b = document.getElementById('replyBanner'); if (b) b.style.display='none';
}

// ========== ACTION MENU ==========
function closeMsgActionMenu() { if (activeMsgActionMenu&&activeMsgActionMenu.parentNode) activeMsgActionMenu.remove(); activeMsgActionMenu=null; }
function showMsgActionMenu(msgId, senderName, message, anchorEl) {
  closeMsgActionMenu();
  const canDelete = (currentAccount&&currentAccount.role==='admin') || (currentAccount&&senderName===currentAccount.name);
  const menu = document.createElement('div'); menu.className='msg-action-menu';
  const rb = document.createElement('button'); rb.className='msg-action-item'; rb.textContent='↩ Balas';
  rb.onclick=(e)=>{e.stopPropagation();closeMsgActionMenu();setReply(msgId,senderName,message);}; menu.appendChild(rb);
  if (canDelete) { const db=document.createElement('button'); db.className='msg-action-item danger'; db.textContent='✕ Hapus'; db.onclick=(e)=>{e.stopPropagation();closeMsgActionMenu();delMsg(msgId);}; menu.appendChild(db); }
  const rect=anchorEl.getBoundingClientRect(), isMe=currentAccount&&senderName===currentAccount.name;
  menu.style.cssText='position:fixed;top:'+(rect.bottom+4)+'px;'+(isMe?'right:'+(window.innerWidth-rect.right)+'px;':'left:'+rect.left+'px;');
  document.body.appendChild(menu); activeMsgActionMenu=menu;
}
async function delMsg(id) {
  const ok = await showConfirm('Hapus pesan ini?',{icon:'🗑',title:'Hapus Pesan',okText:'Hapus',cancelText:'Batal'}); if (!ok) return;
  const {error} = await sb.from('chat_messages').delete().eq('id',id);
  if (error) { toast('Gagal hapus',false); return; }
  const el=document.querySelector('[data-msg-id="'+id+'"]'); if (el) el.remove();
  seenMsgIds.delete(String(id)); toast('Pesan dihapus');
}

// ========== STATUS ICONS ==========
function getStatusIconHtml(status) {
  switch(status) {
    case 'sent':      return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" class="status-sent"><polyline points="3.5 8 6.5 11 12.5 4.5"/></svg>';
    case 'delivered': return '<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="2" class="status-delivered"><polyline points="2 8 5 11 10.5 5"/><polyline points="7.5 8 10.5 11 16 5"/></svg>';
    case 'read':      return '<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="2" class="status-read"><polyline points="2 8 5 11 10.5 5"/><polyline points="7.5 8 10.5 11 16 5"/></svg>';
    default:          return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" class="status-pending"><circle cx="8" cy="8" r="6.5"/><polyline points="8 4.5 8 8 10.5 10"/></svg>';
  }
}
async function getStatusIcon(msgId) {
  try { const {data}=await sb.from('message_status').select('status').eq('message_id',msgId).maybeSingle(); return getStatusIconHtml(data?data.status:'pending'); } catch { return getStatusIconHtml('pending'); }
}

// ========== BUILD MSG ==========
function buildMsgEl(m) {
  const isMe = currentAccount && m.sender_name === currentAccount.name;
  const nameColor = m.sender_name==="Jef'z"?'#007aff':'#e91e8c';
  const roleTag   = m.sender_role==='admin'?' 👑':'';
  const d = document.createElement('div');
  d.className = 'msg-row '+(isMe?'mine':'theirs');
  if (m.id) d.dataset.msgId = String(m.id);
  const msgContent=m.message||'', isImg=msgContent.startsWith('[img]'), isVid=msgContent.startsWith('[video]');
  const mediaUrl = (isImg||isVid)?msgContent.slice(isImg?5:7):null;
  const actionBtn=document.createElement('button'); actionBtn.className='bubble-action-btn'; actionBtn.textContent='⋮';
  actionBtn.addEventListener('click',(e)=>{e.stopPropagation();if(selectionModeActive)return;showMsgActionMenu(m.id,m.sender_name,m.message||'',actionBtn);});
  let replyEl=null;
  if (m.reply_to_name&&m.reply_to_text) {
    const rColor=m.reply_to_name==="Jef'z"?'#007aff':'#e91e8c';
    let rPrev=m.reply_to_text.length>50?m.reply_to_text.slice(0,50)+'…':m.reply_to_text;
    if (rPrev.startsWith('[img]')) rPrev='🖼 Foto'; if (rPrev.startsWith('[video]')) rPrev='🎬 Video';
    replyEl=document.createElement('div'); replyEl.className='reply-preview'; replyEl.style.borderLeft='3px solid '+rColor;
    replyEl.innerHTML='<span class="reply-prev-name" style="color:'+rColor+'">'+esc(m.reply_to_name)+'</span><span class="reply-prev-text">'+esc(rPrev)+'</span>';
  }
  const bubble=document.createElement('div'); bubble.className=mediaUrl?'bubble bubble-media':'bubble';
  bubble.appendChild(actionBtn); if (replyEl) bubble.appendChild(replyEl);
  if (isImg&&mediaUrl) { const img=document.createElement('img'); img.src=mediaUrl; img.className='bubble-img'; img.loading='lazy'; img.onclick=(e)=>{e.stopPropagation();openLightboxFromChat(mediaUrl);}; bubble.appendChild(img); }
  else if (isVid&&mediaUrl) { const vid=document.createElement('video'); vid.src=mediaUrl; vid.className='bubble-vid'; vid.preload='metadata'; vid.controls=true; vid.playsInline=true; bubble.appendChild(vid); }
  else bubble.appendChild(document.createTextNode(msgContent));
  const tsWrap=document.createElement('span');
  tsWrap.style.cssText='float:right;margin-left:6px;margin-bottom:-2px;position:relative;top:3px;display:inline-flex;align-items:center;gap:3px;pointer-events:none;white-space:nowrap;';
  const btime=document.createElement('span'); btime.textContent=fmtTime(m.created_at); btime.style.cssText='font-size:10px;color:var(--text3);'; tsWrap.appendChild(btime);
  if (isMe&&m.id) { const st=document.createElement('span'); st.className='msg-status-icons'; st.dataset.statusMsgId=m.id; st.innerHTML=getStatusIconHtml('pending'); getStatusIcon(m.id).then(h=>{st.innerHTML=h;}); tsWrap.appendChild(st); }
  bubble.appendChild(tsWrap);
  const blockInner=document.createElement('div'); blockInner.className='msg-block-inner';
  if (!isMe) { const sp=document.createElement('span'); sp.className='msg-sender'; sp.style.color=nameColor; sp.textContent=m.sender_name+roleTag; blockInner.appendChild(sp); }
  blockInner.appendChild(bubble);
  const msgBlock=document.createElement('div'); msgBlock.className='msg-block'; msgBlock.appendChild(blockInner);
  const swipeWrap=document.createElement('div'); swipeWrap.className='msg-swipe-wrap'; swipeWrap.appendChild(msgBlock);
  d.appendChild(swipeWrap);
  initLongPressSelect(d,m); initSwipeReply(d,m);
  return d;
}

// ========== LONG PRESS & SWIPE ==========
function initLongPressSelect(rowEl,m) {
  const bubble=rowEl.querySelector('.bubble'); if (!bubble) return;
  let pt=null,moved=false,sx=0,sy=0;
  bubble.addEventListener('touchstart',(e)=>{if(e.target.closest('.bubble-action-btn')||selectionModeActive)return;moved=false;sx=e.touches[0].clientX;sy=e.touches[0].clientY;pt=setTimeout(()=>{if(!moved&&m.id){if(navigator.vibrate)navigator.vibrate(40);enterSelectionMode(String(m.id));}},500);},{passive:true});
  bubble.addEventListener('touchmove',(e)=>{if(Math.abs(e.touches[0].clientX-sx)>8||Math.abs(e.touches[0].clientY-sy)>8){moved=true;clearTimeout(pt);}},{passive:true});
  bubble.addEventListener('touchend',(e)=>{clearTimeout(pt);if(selectionModeActive&&!moved&&m.id){e.stopPropagation();toggleMsgSelection(String(m.id));}moved=false;});
  bubble.addEventListener('touchcancel',()=>{clearTimeout(pt);moved=false;});
}
function initSwipeReply(rowEl,m) {
  const sw=rowEl.querySelector('.msg-swipe-wrap'); let sx=0,sy=0,dx=0,swiping=false,triggered=false;
  sw.addEventListener('touchstart',(e)=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY;dx=0;swiping=false;triggered=false;},{passive:true});
  sw.addEventListener('touchmove',(e)=>{if(selectionModeActive)return;dx=e.touches[0].clientX-sx;const dy=Math.abs(e.touches[0].clientY-sy);if(!swiping&&Math.abs(dx)>dy&&Math.abs(dx)>8)swiping=true;if(!swiping)return;const cl=Math.min(Math.max(0,dx),72);sw.style.transform='translateX('+cl+'px)';sw.style.transition='none';if(cl>=60&&!triggered){triggered=true;rowEl.classList.add('reply-flash');setTimeout(()=>rowEl.classList.remove('reply-flash'),200);}if(e.cancelable)e.preventDefault();},{passive:false});
  sw.addEventListener('touchend',()=>{if(!selectionModeActive&&triggered&&dx>=60)setReply(m.id,m.sender_name,m.message||'');sw.style.transition='transform .25s cubic-bezier(.34,1.56,.64,1)';sw.style.transform='translateX(0)';swiping=false;triggered=false;});
}

// ========== APPEND ==========
function appendMsg(m, smooth) {
  const el=document.getElementById('chatList'); if (!el) return;
  const id=String(m.id||''); if (id&&seenMsgIds.has(id)) return; if (id) seenMsgIds.add(id);
  const ph=el.querySelector('.state-msg'); if (ph) el.innerHTML='';
  el.appendChild(buildMsgEl(m));
  scrollBottom(el, smooth && (el.scrollHeight-el.scrollTop-el.clientHeight)<400);
}

// ========== INIT CHAT ==========
async function initChat() {
  isChatActive = true;

  // Bind input events
  const chatInput = document.getElementById('chatInput');
  if (chatInput && !chatInput._bound) {
    chatInput._bound = true;
    chatInput.addEventListener('input', () => { autoResize(chatInput); handleTypingInput(); });
    chatInput.addEventListener('keydown', (e) => { if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg();} });
  }

  if (!chatLoaded) {
    const el = document.getElementById('chatList');
    el.innerHTML = '<p class="state-msg">Memuat...</p>';

    const {data, error} = await sb.from('chat_messages').select('*').order('created_at',{ascending:true});
    if (error) { el.innerHTML='<p class="state-msg err">Gagal: '+error.message+'</p>'; dbg('initChat: '+error.message); return; }

    el.innerHTML = '';
    chatLoaded = true;
    if (!data||!data.length) { el.innerHTML='<p class="state-msg">Belum ada pesan. Mulai chat!</p>'; }
    else { const frag=document.createDocumentFragment(); data.forEach(m=>{seenMsgIds.add(String(m.id));frag.appendChild(buildMsgEl(m));}); el.appendChild(frag); scrollBottom(el,false); }
  }

  ensureTypingIndicator();
  startChatSync();
  startPresence();
}

// ========== REALTIME + POLLING FALLBACK ==========
function startChatSync() {
  if (chatChannel) { try{sb.removeChannel(chatChannel);}catch(e){} chatChannel=null; }

  chatChannel = sb.channel('chat_'+Date.now())
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_messages'},(payload)=>{
      if (!isChatActive||!payload.new) return;
      const id=String(payload.new.id); if (seenMsgIds.has(id)) return;
      appendMsg(payload.new,true);
      if (currentAccount&&payload.new.sender_name!==currentAccount.name) {
        updateMsgStatus(payload.new.id, document.getElementById('tabChat').classList.contains('active-tab')?'read':'delivered');
      }
    })
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'chat_messages'},(payload)=>{
      if (!payload.old||!payload.old.id) return;
      const el=document.querySelector('[data-msg-id="'+payload.old.id+'"]'); if (el) el.remove();
      seenMsgIds.delete(String(payload.old.id));
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'message_status'},(payload)=>{
      if (!payload.new||!isChatActive) return;
      const ic=document.querySelector('[data-status-msg-id="'+payload.new.message_id+'"]');
      if (ic) ic.innerHTML=getStatusIconHtml(payload.new.status);
    })
    .subscribe((status)=>{
      if (status==='CHANNEL_ERROR'||status==='TIMED_OUT') {
        dbg('Realtime '+status+' - pakai polling');
        startPolling();
      }
    });

  // Selalu jalankan polling ringan sebagai backup
  startPolling();
}

let lastPollTs = null;
function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(async()=>{
    if (!isChatActive) return;
    try {
      let q = sb.from('chat_messages').select('*').order('created_at',{ascending:true});
      if (lastPollTs) q = q.gt('created_at', lastPollTs);
      const {data} = await q;
      if (data&&data.length) { data.forEach(m=>appendMsg(m,true)); lastPollTs=data[data.length-1].created_at; }
    } catch(e){}
  }, 3000);
}

// ========== PRESENCE ==========
async function startPresence() {
  if (!currentAccount) return;
  otherUser = currentAccount.name==="Jef'z" ? 'Ndifaa' : "Jef'z";
  await sb.rpc('update_presence',{p_username:currentAccount.name,p_is_online:true}).catch(()=>{});
  if (presenceChannel) { try{sb.removeChannel(presenceChannel);}catch(e){} }
  presenceChannel = sb.channel('pres_'+Date.now())
    .on('postgres_changes',{event:'*',schema:'public',table:'user_presence',filter:'username=eq.'+otherUser},(payload)=>{ if(payload.new) updateOnlineStatus(payload.new); })
    .subscribe();
  fetchPresence();
  if (presenceInterval) clearInterval(presenceInterval);
  presenceInterval = setInterval(fetchPresence, 5000);
  window.addEventListener('beforeunload',()=>{
    sb.rpc('update_presence',{p_username:currentAccount.name,p_is_online:false}).catch(()=>{});
    sb.rpc('update_typing',  {p_username:currentAccount.name,p_is_typing:false}).catch(()=>{});
  });
}
async function fetchPresence() {
  if (!otherUser) return;
  try { const {data}=await sb.from('user_presence').select('*').eq('username',otherUser).maybeSingle(); if(data) updateOnlineStatus(data); } catch(e){}
}
function updateOnlineStatus(data) {
  const el=document.getElementById('topbarOnline'); if (!el||!otherUser) return;
  el.classList.add('show');
  if (data.is_typing) {
    el.className='topbar-online show typing';
    el.innerHTML='<span class="topbar-online-dot"></span>'+esc(otherUser)+' mengetik…';
    showTypingIndicator(otherUser); return;
  }
  hideTypingIndicator();
  if (data.is_online) {
    el.className='topbar-online show online';
    el.innerHTML='<span class="topbar-online-dot"></span>Online';
  } else {
    el.className='topbar-online show offline';
    const ls=data.last_seen?new Date(data.last_seen):new Date(), diff=Date.now()-ls;
    const mins=Math.floor(diff/60000), hours=Math.floor(diff/3600000), days=Math.floor(diff/86400000);
    let lbl; if(mins<1)lbl='Baru saja'; else if(mins<60)lbl=mins+' mnt lalu'; else if(hours<24)lbl=hours+' jam lalu'; else if(days<7)lbl=days+' hari lalu'; else lbl=ls.toLocaleDateString('id-ID',{day:'numeric',month:'short'});
    el.innerHTML='<span class="topbar-online-dot"></span>Terakhir dilihat '+lbl;
  }
  if (document.getElementById('tabChat').classList.contains('active-tab')) markAllRead();
}

// ========== MSG STATUS ==========
async function updateMsgStatus(msgId, status) {
  if (!currentAccount) return;
  try {
    const row={message_id:msgId,recipient_name:currentAccount.name,status,updated_at:new Date().toISOString()};
    if(status==='delivered') row.delivered_at=new Date().toISOString();
    if(status==='read')      row.read_at=new Date().toISOString();
    await sb.from('message_status').upsert(row,{onConflict:'message_id,recipient_name'});
    const ic=document.querySelector('[data-status-msg-id="'+msgId+'"]'); if(ic) ic.innerHTML=getStatusIconHtml(status);
  } catch(e){}
}
async function markAllRead() {
  if (!currentAccount||!otherUser) return;
  try { const {data}=await sb.from('chat_messages').select('id').eq('sender_name',otherUser).order('created_at',{ascending:false}).limit(50); if(data) for(const m of data) await updateMsgStatus(m.id,'read'); } catch(e){}
}

// ========== SEND ==========
let isSending = false;
async function sendMsg() {
  if (isSending) return;

  if (!currentAccount) { dbg('ERROR: currentAccount null'); return; }
  if (typeof sb === 'undefined') { dbg('ERROR: Supabase tidak terhubung'); return; }

  const input = document.getElementById('chatInput');
  const msg   = (input.value||'').replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,'');
  if (!msg) return;

  isSending = true;
  input.value = ''; input.style.height = ''; input.focus();

  if (isTyping) { isTyping=false; clearTimeout(typingTimeout); sb.rpc('update_typing',{p_username:currentAccount.name,p_is_typing:false}).catch(()=>{}); }

  const row = {
    message:     msg,
    user_id:     typeof USER_ID!=='undefined' ? USER_ID : ('u_'+Date.now()),
    sender_name: currentAccount.name,
    sender_role: currentAccount.role || 'user'
  };
  if (replyTarget) { row.reply_to_id=replyTarget.id; row.reply_to_name=replyTarget.sender_name; row.reply_to_text=replyTarget.message; }
  clearReplyBanner();

  const {data, error} = await sb.from('chat_messages').insert([row]).select().single();

  if (error) {
    dbg('INSERT ERROR: '+error.message+' ('+error.code+')');
    input.value = msg;
    isSending = false;
    return;
  }

  if (data) {
    const id = String(data.id);
    if (!seenMsgIds.has(id)) {
      seenMsgIds.add(id);
      const el=document.getElementById('chatList');
      const ph=el.querySelector('.state-msg'); if(ph) el.innerHTML='';
      el.appendChild(buildMsgEl(data));
      scrollBottom(el,true);
    }
    updateMsgStatus(data.id,'sent');
  }

  isSending = false;
}

// ========== CHAT UPLOAD ==========
async function doChatUpload(input) {
  if (!currentAccount) return;
  const file=input.files[0]; if (!file) return;
  const isVid=file.type.startsWith('video/'), ext=file.name.split('.').pop();
  const name='chat_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)+'.'+ext;
  const uploadUrl=SB_URL+'/storage/v1/object/gallery/'+name;
  try {
    await new Promise((resolve,reject)=>{ const xhr=new XMLHttpRequest(); xhr.open('POST',uploadUrl,true); xhr.setRequestHeader('Authorization','Bearer '+SB_KEY); xhr.setRequestHeader('x-upsert','false'); xhr.setRequestHeader('Cache-Control','3600'); xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(new Error(xhr.status)); xhr.onerror=()=>reject(new Error('Network error')); xhr.send(file); });
  } catch { toast('Upload gagal',false); input.value=''; return; }
  const pub=sb.storage.from('gallery').getPublicUrl(name);
  const {error}=await sb.from('chat_messages').insert([{message:(isVid?'[video]':'[img]')+pub.data.publicUrl,user_id:USER_ID,sender_name:currentAccount.name,sender_role:currentAccount.role}]);
  if (error) toast('Gagal kirim media',false); else toast('Media terkirim ✓');
  input.value='';
}

// ========== MULTISELECT ==========
function enterSelectionMode(msgId){selectionModeActive=true;_addToSelection(msgId);_renderSelectionBar();}
function toggleMsgSelection(msgId){if(!selectionModeActive)return;if(selectedMsgIds.has(msgId))_removeFromSelection(msgId);else _addToSelection(msgId);if(!selectedMsgIds.size){exitSelectionMode();return;}_renderSelectionBar();}
function _addToSelection(id){selectedMsgIds.add(id);const r=document.querySelector('[data-msg-id="'+id+'"]');if(r)r.classList.add('msg-selected');}
function _removeFromSelection(id){selectedMsgIds.delete(id);const r=document.querySelector('[data-msg-id="'+id+'"]');if(r)r.classList.remove('msg-selected');}
function _renderSelectionBar(){let bar=document.getElementById('selectionBar');if(!bar){bar=document.createElement('div');bar.id='selectionBar';bar.className='selection-bar';document.querySelector('.topbar').appendChild(bar);}const canDel=(currentAccount&&currentAccount.role==='admin')||_allSelectedAreOwn();bar.innerHTML='<button class="sel-cancel-btn" onclick="exitSelectionMode()">✕ Batal</button><span class="sel-label">'+selectedMsgIds.size+' dipilih</span>'+(canDel?'<button class="sel-delete-btn" onclick="delSelectedMsgs()">🗑 Hapus</button>':'<span style="width:74px"></span>');bar.style.display='flex';}
function _allSelectedAreOwn(){for(const id of selectedMsgIds){const r=document.querySelector('[data-msg-id="'+id+'"]');if(!r||!r.classList.contains('mine'))return false;}return true;}
function exitSelectionMode(){selectionModeActive=false;selectedMsgIds.clear();document.querySelectorAll('.msg-selected').forEach(el=>el.classList.remove('msg-selected'));const bar=document.getElementById('selectionBar');if(bar)bar.style.display='none';}
async function delSelectedMsgs(){if(!selectedMsgIds.size)return;const ids=Array.from(selectedMsgIds);const ok=await showConfirm('Hapus '+(ids.length===1?'pesan ini':ids.length+' pesan')+'?',{icon:'🗑',title:'Hapus Pesan',okText:'Hapus',cancelText:'Batal'});if(!ok)return;exitSelectionMode();const{error}=await sb.from('chat_messages').delete().in('id',ids);if(error){toast('Gagal hapus',false);return;}ids.forEach(id=>{const el=document.querySelector('[data-msg-id="'+id+'"]');if(el)el.remove();seenMsgIds.delete(String(id));});toast(ids.length===1?'Pesan dihapus':ids.length+' pesan dihapus');}

// ========== GALLERY ==========
let galleryItems=[],galleryLoaded=false,lbCurrentIdx=-1;
async function loadGallery(){const el=document.getElementById('galleryGrid');el.innerHTML='<p class="state-msg">Memuat...</p>';const{data,error}=await sb.from('gallery').select('*').order('created_at',{ascending:false});if(error){el.innerHTML='<p class="state-msg err">Error: '+error.message+'</p>';return;}galleryLoaded=true;galleryItems=[];if(!data||!data.length){el.innerHTML='<p class="state-msg">Belum ada media.</p>';return;}el.innerHTML='';const isAdmin=currentAccount&&currentAccount.role==='admin';const frag=document.createDocumentFragment();data.forEach((f,idx)=>{const isVid=/\.(mp4|webm|mov|avi)$/i.test(f.file_name||'');galleryItems.push({url:f.file_url,isVid});const d=document.createElement('div');d.className='g-item';if(isVid){const th=document.createElement('div');th.style.cssText='position:relative;width:100%;height:100%;cursor:pointer;';const v=document.createElement('video');v.className='g-media';v.preload='metadata';v.muted=true;v.playsInline=true;v.src=f.file_url+'#t=0.001';const pi=document.createElement('div');pi.className='g-play-icon';pi.innerHTML='<svg viewBox="0 0 24 24" width="28" height="28"><circle cx="12" cy="12" r="12" fill="rgba(0,0,0,0.5)"/><polygon points="10,8 18,12 10,16" fill="white"/></svg>';th.appendChild(v);th.appendChild(pi);((i)=>{th.onclick=()=>openLightbox(i);})(idx);d.appendChild(th);}else{const img=document.createElement('img');img.src=f.file_url;img.className='g-media';img.loading='lazy';((i)=>{img.onclick=()=>openLightbox(i);})(idx);d.appendChild(img);}if(isAdmin){const db=document.createElement('button');db.className='g-del';db.textContent='✕';db.onclick=(e)=>{e.stopPropagation();delMedia(f.id,f.file_name);};d.appendChild(db);}frag.appendChild(d);});el.appendChild(frag);}
async function delMedia(id,name){if(!currentAccount||currentAccount.role!=='admin')return;const ok=await showConfirm('Hapus media ini?',{icon:'🗑',title:'Hapus Media',okText:'Hapus',cancelText:'Batal'});if(!ok)return;await sb.storage.from('gallery').remove([name]);const{error}=await sb.from('gallery').delete().eq('id',id);if(error){toast('Gagal hapus',false);return;}toast('Dihapus');galleryLoaded=false;loadGallery();}

// ========== GALLERY UPLOAD ==========
let pendingUploadFile=null,uploadXHR=null;
function triggerUploadConfirm(input){if(!currentAccount||currentAccount.role!=='admin'){toast('Hanya admin yang bisa upload',false);input.value='';return;}const file=input.files[0];if(!file)return;pendingUploadFile=file;document.getElementById('uploadFileName').textContent=file.name;document.getElementById('uploadFileSize').textContent=fmtBytes(file.size)+' · '+(file.type||'unknown');document.getElementById('uploadProgressWrap').style.display='none';document.getElementById('uploadProgressFill').style.width='0%';document.getElementById('uploadPctLabel').textContent='0%';document.getElementById('uploadSpeedLabel').textContent='—';document.getElementById('uploadRemainLabel').textContent='—';document.getElementById('uploadGoBtn').disabled=false;document.getElementById('uploadGoBtn').textContent='Upload';document.getElementById('uploadCancelBtn').textContent='Batal';document.getElementById('uploadModalCloseBtn').style.display='';document.getElementById('uploadConfirmModal').classList.add('show');input.value='';}
function cancelUploadModal(){if(uploadXHR){try{uploadXHR.abort();}catch(e){}uploadXHR=null;}pendingUploadFile=null;document.getElementById('uploadConfirmModal').classList.remove('show');}
async function startGalleryUpload(){if(!pendingUploadFile)return;const file=pendingUploadFile;document.getElementById('uploadGoBtn').disabled=true;document.getElementById('uploadGoBtn').textContent='Mengupload...';document.getElementById('uploadModalCloseBtn').style.display='none';document.getElementById('uploadCancelBtn').textContent='Batalkan';document.getElementById('uploadProgressWrap').style.display='flex';const ext=file.name.split('.').pop();const name=Date.now()+'_'+Math.random().toString(36).slice(2,6)+'.'+ext;const uploadUrl=SB_URL+'/storage/v1/object/gallery/'+name;let ll=0,lt=Date.now(),success=false;try{await new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();uploadXHR=xhr;xhr.open('POST',uploadUrl,true);xhr.setRequestHeader('Authorization','Bearer '+SB_KEY);xhr.setRequestHeader('x-upsert','false');xhr.setRequestHeader('Cache-Control','3600');xhr.upload.onprogress=(e)=>{if(!e.lengthComputable)return;const now=Date.now(),pct=Math.round(e.loaded/e.total*100),el=(now-lt)/1000,sp=el>0?(e.loaded-ll)/el:0;ll=e.loaded;lt=now;document.getElementById('uploadProgressFill').style.width=pct+'%';document.getElementById('uploadPctLabel').textContent=pct+'%';document.getElementById('uploadSpeedLabel').textContent=sp>0?fmtBytes(sp)+'/s':'—';document.getElementById('uploadRemainLabel').textContent=fmtBytes(e.total-e.loaded)+' tersisa';};xhr.onload=()=>{uploadXHR=null;xhr.status>=200&&xhr.status<300?resolve():reject(new Error('HTTP '+xhr.status));};xhr.onerror=()=>{uploadXHR=null;reject(new Error('Network error'));};xhr.onabort=()=>{uploadXHR=null;reject(new Error('Dibatalkan'));};xhr.send(file);});success=true;}catch(err){toast(err.message==='Dibatalkan'?'Upload dibatalkan':'Upload gagal: '+err.message,false);document.getElementById('uploadGoBtn').disabled=false;document.getElementById('uploadGoBtn').textContent='Upload';document.getElementById('uploadCancelBtn').textContent='Batal';document.getElementById('uploadModalCloseBtn').style.display='';document.getElementById('uploadProgressWrap').style.display='none';document.getElementById('uploadConfirmModal').classList.remove('show');pendingUploadFile=null;return;}if(!success)return;const pub=sb.storage.from('gallery').getPublicUrl(name);const{error}=await sb.from('gallery').insert([{file_url:pub.data.publicUrl,file_name:name,uploaded_by:currentAccount?currentAccount.name:null}]);if(error)toast('Gagal simpan: '+error.message,false);else{toast('Berhasil diupload ✓');galleryLoaded=false;loadGallery();}pendingUploadFile=null;uploadXHR=null;document.getElementById('uploadConfirmModal').classList.remove('show');}

// ========== LIGHTBOX ==========
function openLightbox(idx){lbCurrentIdx=idx;_renderLightboxItem(idx);_updateLightboxNav();document.getElementById('lightbox').classList.add('show');document.body.style.overflow='hidden';}
function openLightboxFromChat(url){lbCurrentIdx=-1;const wrap=document.getElementById('lightboxMediaWrap');_clearLightboxMedia(wrap);const img=document.getElementById('lightboxImg');img.src=url;img.style.display='';document.getElementById('lightboxCounter').innerHTML='';document.getElementById('lightboxPrev').style.display='none';document.getElementById('lightboxNext').style.display='none';document.getElementById('lightbox').classList.add('show');document.body.style.overflow='hidden';}
function _clearLightboxMedia(wrap){if(!wrap)wrap=document.getElementById('lightboxMediaWrap');const v=wrap.querySelector('video');if(v){try{v.pause();v.src='';}catch(e){}v.remove();}const img=document.getElementById('lightboxImg');if(img){img.src='';img.style.display='none';}}
function _renderLightboxItem(idx){const wrap=document.getElementById('lightboxMediaWrap');_clearLightboxMedia(wrap);if(idx<0||!galleryItems[idx])return;const item=galleryItems[idx],img=document.getElementById('lightboxImg');if(item.isVid){img.style.display='none';const v=document.createElement('video');v.src=item.url;v.controls=true;v.playsInline=true;v.style.cssText='max-width:100%;max-height:76vh;width:auto;height:auto;object-fit:contain;display:block;';wrap.appendChild(v);}else{img.src=item.url;img.style.display='';}  _updateLightboxCounter(idx);}
function _updateLightboxNav(){const p=document.getElementById('lightboxPrev'),n=document.getElementById('lightboxNext');if(lbCurrentIdx<0||galleryItems.length<=1){if(p)p.style.display='none';if(n)n.style.display='none';return;}if(p)p.style.display=lbCurrentIdx>0?'':'none';if(n)n.style.display=lbCurrentIdx<galleryItems.length-1?'':'none';}
function _updateLightboxCounter(idx){const c=document.getElementById('lightboxCounter');if(!c)return;if(galleryItems.length<=1){c.innerHTML='';return;}const s=Math.max(0,idx-5),e=Math.min(galleryItems.length-1,s+11);c.innerHTML=Array.from({length:e-s+1},(_,i)=>'<span class="lb-dot'+(s+i===idx?' active':'')+'"></span>').join('');}
function lightboxNav(dir){if(lbCurrentIdx<0)return;const n=lbCurrentIdx+dir;if(n<0||n>=galleryItems.length)return;lbCurrentIdx=n;const w=document.getElementById('lightboxMediaWrap');w.style.transition='opacity .15s,transform .15s';w.style.opacity='0';w.style.transform='translateX('+(dir>0?'24px':'-24px')+')';setTimeout(()=>{_renderLightboxItem(lbCurrentIdx);_updateLightboxNav();w.style.transition='opacity .2s,transform .2s';w.style.opacity='1';w.style.transform='translateX(0)';},120);}
function closeLightbox(){document.getElementById('lightbox').classList.remove('show');const w=document.getElementById('lightboxMediaWrap');_clearLightboxMedia(w);const img=document.getElementById('lightboxImg');if(img){img.src='';img.style.display='';}document.getElementById('lightboxCounter').innerHTML='';lbCurrentIdx=-1;document.body.style.overflow='';if(w){w.style.opacity='';w.style.transform='';w.style.transition='';}}
(function(){document.addEventListener('DOMContentLoaded',()=>{const lb=document.getElementById('lightbox');if(!lb)return;let sx=0,sw=false;lb.addEventListener('touchstart',(e)=>{if(e.target.closest('.lightbox-close,.lightbox-prev,.lightbox-next'))return;sx=e.touches[0].clientX;sw=false;},{passive:true});lb.addEventListener('touchmove',(e)=>{if(Math.abs(e.touches[0].clientX-sx)>12)sw=true;},{passive:true});lb.addEventListener('touchend',(e)=>{if(!sw)return;const dx=e.changedTouches[0].clientX-sx;sw=false;if(Math.abs(dx)>60)lightboxNav(dx<0?1:-1);});});})();

// ========== CLEANUP ==========
window.addEventListener('beforeunload',()=>{if(presenceInterval)clearInterval(presenceInterval);if(pollTimer)clearInterval(pollTimer);if(chatChannel){try{sb.removeChannel(chatChannel);}catch(e){}}if(presenceChannel){try{sb.removeChannel(presenceChannel);}catch(e){}}if(currentAccount){sb.rpc('update_presence',{p_username:currentAccount.name,p_is_online:false}).catch(()=>{});sb.rpc('update_typing',{p_username:currentAccount.name,p_is_typing:false}).catch(()=>{});}});
