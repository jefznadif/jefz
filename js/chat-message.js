// ================================================================
// CHAT-MESSAGES.JS
// Build message, send, reply, edit, delete, multiselect, info bubble
// ================================================================

let replyTarget     = null;
let activeMsgMenu   = null;
let selectedMsgIds  = new Set();
let selectionActive = false;
let editingMsgId    = null;
let editingOriginal = '';
let sending         = false;

// ===== BUILD MESSAGE =====
function buildMsg(m) {
  const isMe    = currentAccount && m.sender_name === currentAccount.name;
  const clr     = m.sender_name === "Jef'z" ? '#007aff' : '#e91e8c';
  const roleTag = m.sender_role === 'admin' ? ' 👑' : '';
  const content = m.message || '';
  const isImg   = content.startsWith('[img]');
  const isVid   = content.startsWith('[video]');
  const isVN    = content.startsWith('[voice]');
  const isMedia = isImg || isVid || isVN;

  let mediaUrl = null, vnDuration = 0;
  if (isImg)      mediaUrl = content.slice(5);
  else if (isVid) mediaUrl = content.slice(7);
  else if (isVN) {
    const raw = content.slice(7), sep = raw.lastIndexOf('|');
    if (sep !== -1) { mediaUrl = raw.slice(0, sep); vnDuration = parseFloat(raw.slice(sep+1)) || 0; }
    else mediaUrl = raw;
  }

  const row = document.createElement('div');
  row.className = 'msg-row ' + (isMe ? 'mine' : 'theirs');
  if (m.id) row.dataset.msgId = String(m.id);

  const sw    = document.createElement('div'); sw.className    = 'msg-swipe-wrap';
  const block = document.createElement('div'); block.className = 'msg-block';
  const inner = document.createElement('div'); inner.className = 'msg-block-inner';

  if (!isMe) {
    const sp = document.createElement('span');
    sp.className = 'msg-sender'; sp.style.color = clr;
    sp.textContent = m.sender_name + roleTag;
    inner.appendChild(sp);
  }

  const bubble = document.createElement('div');
  bubble.className = isMedia ? 'bubble bubble-media' : 'bubble';

  const ab = document.createElement('button'); ab.className = 'bubble-action-btn'; ab.textContent = '⋮';
  ab.addEventListener('click', (e) => { e.stopPropagation(); if (selectionActive) return; showMsgMenu(m.id, m.sender_name, content, ab, isMedia); });
  bubble.appendChild(ab);

  if (m.reply_to_name && m.reply_to_text) {
    const rc = m.reply_to_name === "Jef'z" ? '#007aff' : '#e91e8c';
    let rp = m.reply_to_text.length > 50 ? m.reply_to_text.slice(0,50)+'…' : m.reply_to_text;
    if (rp.startsWith('[img]'))   rp = '🖼 Foto';
    if (rp.startsWith('[video]')) rp = '🎬 Video';
    if (rp.startsWith('[voice]')) rp = '🎙 Voice Note';
    const rpEl = document.createElement('div');
    rpEl.className = 'reply-preview'; rpEl.style.borderLeft = '3px solid ' + rc;
    rpEl.innerHTML = '<span class="reply-prev-name" style="color:'+rc+'">'+esc(m.reply_to_name)+'</span><span class="reply-prev-text">'+esc(rp)+'</span>';
    bubble.appendChild(rpEl);
  }

  if (isImg && mediaUrl) {
    const img = document.createElement('img');
    img.src = mediaUrl; img.className = 'bubble-img'; img.loading = 'lazy';
    img.onclick = (e) => { e.stopPropagation(); openLightboxFromChat(mediaUrl); };
    bubble.appendChild(img);
  } else if (isVid && mediaUrl) {
    const vid = document.createElement('video');
    vid.src = mediaUrl; vid.className = 'bubble-vid';
    vid.preload = 'metadata'; vid.controls = true; vid.playsInline = true;
    bubble.appendChild(vid);
  } else if (isVN && mediaUrl) {
    bubble.appendChild(buildVoiceNoteBubble(mediaUrl, vnDuration));
  } else if (!isMedia) {
    bubble.appendChild(document.createTextNode(content));
  }

  // Time + edited + status
  const ts = document.createElement('span');
  ts.style.cssText = 'float:right;margin-left:6px;margin-bottom:-2px;position:relative;top:3px;display:inline-flex;align-items:center;gap:3px;pointer-events:none;white-space:nowrap;';
  if (m.is_edited) {
    const ed = document.createElement('span'); ed.textContent = 'diedit';
    ed.style.cssText = 'font-size:9px;color:var(--text3);font-style:italic;'; ts.appendChild(ed);
  }
  const timeEl = document.createElement('span');
  timeEl.textContent = fmtTime(m.created_at); timeEl.style.cssText = 'font-size:10px;color:var(--text3);';
  ts.appendChild(timeEl);
  if (isMe && m.id) {
    const si = document.createElement('span'); si.className = 'msg-status-icons'; si.dataset.statusMsgId = String(m.id);
    si.innerHTML = statusHtml(statusMap[String(m.id)] || 'sent'); ts.appendChild(si);
  }
  bubble.appendChild(ts);

  inner.appendChild(bubble); block.appendChild(inner); sw.appendChild(block); row.appendChild(sw);
  initLongPress(row, m); initSwipeReply(row, m);
  return row;
}

// ===== LONG PRESS =====
function initLongPress(row, m) {
  const bubble = row.querySelector('.bubble'); if (!bubble) return;
  let timer = null, moved = false, sx = 0, sy = 0;
  bubble.addEventListener('touchstart', (e) => {
    if (e.target.closest('.bubble-action-btn,.vn-play-btn,.vn-waveform') || selectionActive) return;
    moved = false; sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    timer = setTimeout(() => { if (!moved && m.id) { if (navigator.vibrate) navigator.vibrate(40); enterSelect(String(m.id)); } }, 500);
  }, { passive: true });
  bubble.addEventListener('touchmove', (e) => { if (Math.abs(e.touches[0].clientX-sx)>8||Math.abs(e.touches[0].clientY-sy)>8){moved=true;clearTimeout(timer);} }, { passive: true });
  bubble.addEventListener('touchend', (e) => { clearTimeout(timer); if (selectionActive&&!moved&&m.id){e.stopPropagation();toggleSelect(String(m.id));}moved=false; });
  bubble.addEventListener('touchcancel', () => { clearTimeout(timer); moved=false; });
}

// ===== SWIPE REPLY =====
function initSwipeReply(row, m) {
  const sw = row.querySelector('.msg-swipe-wrap');
  let sx=0,sy=0,dx=0,active=false,fired=false;
  sw.addEventListener('touchstart',(e)=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY;dx=0;active=false;fired=false;},{passive:true});
  sw.addEventListener('touchmove',(e)=>{
    if(selectionActive)return; dx=e.touches[0].clientX-sx; const dy=Math.abs(e.touches[0].clientY-sy);
    if(!active&&Math.abs(dx)>dy&&Math.abs(dx)>8)active=true; if(!active)return;
    const cl=Math.min(Math.max(0,dx),72); sw.style.transform='translateX('+cl+'px)';sw.style.transition='none';
    if(cl>=60&&!fired){fired=true;row.classList.add('reply-flash');setTimeout(()=>row.classList.remove('reply-flash'),200);}
    if(e.cancelable)e.preventDefault();
  },{passive:false});
  sw.addEventListener('touchend',()=>{
    if(!selectionActive&&fired&&dx>=60)setReply(m.id,m.sender_name,m.message||'');
    sw.style.transition='transform .25s cubic-bezier(.34,1.56,.64,1)';sw.style.transform='translateX(0)';active=false;fired=false;
  });
}

// ===== APPEND & UPDATE =====
function appendMsg(m, smooth) {
  const list = document.getElementById('chatList'); if (!list) return;
  const id = String(m.id||''); if (id&&seenMsgIds.has(id)) return; if (id) seenMsgIds.add(id);
  const ph = list.querySelector('.state-msg'); if (ph) list.innerHTML = '';
  list.appendChild(buildMsg(m));
  scrollToBottom(list, smooth && (list.scrollHeight-list.scrollTop-list.clientHeight)<400);
}
function updateMsgInDom(m) {
  const e = document.querySelector('[data-msg-id="'+m.id+'"]'); if (!e) return; e.replaceWith(buildMsg(m));
}

// ===== REPLY =====
function setReply(id, sender, msg) {
  replyTarget = { id, sender_name: sender, message: msg };
  const b = document.getElementById('replyBanner'); if (!b) return;
  b.style.display = 'flex';
  document.getElementById('replyBannerName').textContent = sender;
  document.getElementById('replyBannerName').style.color = '';
  document.getElementById('replyBannerText').textContent = msg.length>60?msg.slice(0,60)+'…':msg;
  document.getElementById('chatInput').focus();
}
function clearReplyBanner() {
  replyTarget = null;
  const b = document.getElementById('replyBanner'); if (b) b.style.display='none';
  const n = document.getElementById('replyBannerName'); if (n) n.style.color='';
}

// ===== EDIT =====
function startEdit(msgId, currentText) {
  editingMsgId = msgId; editingOriginal = currentText;
  const inp = document.getElementById('chatInput');
  inp.value = currentText; autoResize(inp); updateSendMicBtn(); inp.focus();
  const b = document.getElementById('replyBanner'); if (b) b.style.display='flex';
  const n = document.getElementById('replyBannerName'); if (n) { n.textContent='✏ Edit Pesan'; n.style.color='#ff9500'; }
  const t = document.getElementById('replyBannerText'); if (t) t.textContent=currentText.length>60?currentText.slice(0,60)+'…':currentText;
}
function cancelEdit() {
  editingMsgId=null; editingOriginal='';
  const inp=document.getElementById('chatInput'); if(inp){inp.value='';inp.style.height='';}
  updateSendMicBtn(); clearReplyBanner();
}
async function saveEdit() {
  if (!editingMsgId||!currentAccount) return;
  const inp=document.getElementById('chatInput');
  const newText=(inp.value||'').replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,'');
  if (!newText||newText===editingOriginal) { cancelEdit(); return; }
  const msgId=editingMsgId; cancelEdit();
  try {
    const{error}=await sb.from('chat_messages').update({message:newText,is_edited:true}).eq('id',msgId).eq('sender_name',currentAccount.name);
    if(error){showErr('Gagal edit: '+error.message);return;}
    const{data}=await sb.from('chat_messages').select('*').eq('id',msgId).single();
    if(data)updateMsgInDom(data);
    toast('Pesan diedit ✓');
  } catch(err){showErr('Error: '+err.message);}
}

// ===== INFO BUBBLE (Admin Only) =====
function parseUA(ua) {
  if (!ua||ua==='—') return '—';
  let os='', browser='';
  if (/iPhone|iPad|iPod/i.test(ua))      os='iOS';
  else if (/Android/i.test(ua))          os='Android';
  else if (/Windows/i.test(ua))          os='Windows';
  else if (/Mac OS X/i.test(ua))         os='macOS';
  else if (/Linux/i.test(ua))            os='Linux';
  if (/Chrome\/(\d+)/i.test(ua)&&!/Chromium|Edg|OPR/i.test(ua)) browser='Chrome '+ua.match(/Chrome\/(\d+)/i)[1];
  else if (/Edg\/(\d+)/i.test(ua))       browser='Edge '+ua.match(/Edg\/(\d+)/i)[1];
  else if (/Firefox\/(\d+)/i.test(ua))   browser='Firefox '+ua.match(/Firefox\/(\d+)/i)[1];
  else if (/OPR\/(\d+)/i.test(ua))       browser='Opera '+ua.match(/OPR\/(\d+)/i)[1];
  else if (/Safari\/(\d+)/i.test(ua)&&/Version\/(\d+)/i.test(ua)) browser='Safari '+ua.match(/Version\/(\d+)/i)[1];
  else browser='Unknown Browser';
  return (os?os+' · ':'')+browser;
}

async function showMsgInfo(msgId, senderName) {
  // Ambil status — user_agent tersimpan dari PENERIMA saat delivered/read
  let statusData = null;
  try {
    const { data } = await sb.from('message_status').select('*').eq('message_id', msgId).maybeSingle();
    statusData = data;
  } catch(e) {}

  let msgData = null;
  try {
    const { data } = await sb.from('chat_messages').select('created_at,sender_name').eq('id', msgId).single();
    msgData = data;
  } catch(e) {}

  const senderColor = senderName === "Jef'z" ? '#007aff' : '#e91e8c';

  // user_agent disimpan saat pihak PENERIMA update status (delivered/read)
  // Jadi ini adalah device penerima (their device)
  const recipientUA    = statusData && statusData.user_agent ? statusData.user_agent : null;
  const recipientName  = statusData && statusData.recipient_name ? statusData.recipient_name : otherUser;
  const deviceInfo     = recipientUA ? parseUA(recipientUA) : '—';
  const deviceFull     = recipientUA || '—';

  const rows = [
    { icon:'📤', label:'Dikirim',   time: msgData    ? msgData.created_at       : null, color:'var(--text3)' },
    { icon:'✓',  label:'Terkirim',  time: statusData ? statusData.sent_at        : null, color:'var(--text3)' },
    { icon:'✓✓', label:'Diterima',  time: statusData ? statusData.delivered_at   : null, color:'var(--text3)' },
    { icon:'👁',  label:'Dibaca',    time: statusData ? statusData.read_at        : null, color:'#34c759'      },
  ];

  const rowsHtml = rows.map(r =>
    '<div style="display:flex;align-items:center;gap:12px;padding:11px 20px;border-bottom:1px solid var(--separator);">' +
      '<span style="font-size:15px;width:24px;text-align:center;color:'+r.color+'">'+r.icon+'</span>' +
      '<div><div style="font-size:13px;font-weight:600;color:var(--text);">'+r.label+'</div>' +
      '<div style="font-size:11px;color:var(--text3);">'+(r.time?fmtDateTime(r.time):'—')+'</div></div>' +
    '</div>'
  ).join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show'; overlay.style.zIndex = '9500';

  const box = document.createElement('div');
  box.className = 'modal-box confirm-modal-box';
  box.style.cssText = 'max-width:340px;padding:0;overflow:hidden;';
  box.innerHTML =
    '<div style="padding:16px 20px 12px;border-bottom:1px solid var(--separator);display:flex;align-items:center;gap:8px;">' +
      '<div style="width:8px;height:8px;border-radius:50%;background:'+senderColor+';"></div>' +
      '<span style="font-size:16px;font-weight:700;color:var(--text);">Info Pesan</span>' +
      '<span style="font-size:11px;color:var(--text3);margin-left:auto;">'+esc(senderName)+'</span>' +
    '</div>' +
    rowsHtml +
    '<div style="padding:12px 20px;border-bottom:1px solid var(--separator);">' +
      '<div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Device '+esc(recipientName||'Penerima')+'</div>' +
      '<div style="font-size:13px;color:var(--text);font-weight:600;margin-bottom:3px;">'+esc(deviceInfo)+'</div>' +
      '<div style="font-size:10px;color:var(--text3);line-height:1.5;word-break:break-all;">'+esc(deviceFull)+'</div>' +
    '</div>' +
    '<button onclick="this.closest(\'.modal-overlay\').remove()" style="width:100%;padding:14px;border:none;background:transparent;font-size:15px;font-weight:600;color:var(--accent);cursor:pointer;">Tutup</button>';

  overlay.appendChild(box);
  overlay.addEventListener('click', (e) => { if (e.target===overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// ===== MSG MENU =====
function closeMsgMenu() { if (activeMsgMenu&&activeMsgMenu.parentNode) activeMsgMenu.remove(); activeMsgMenu=null; }
function showMsgMenu(msgId, sender, msg, anchor, isMedia) {
  closeMsgMenu();
  const isMe    = currentAccount && sender===currentAccount.name;
  const isAdmin = currentAccount && currentAccount.role==='admin';
  const menu = document.createElement('div'); menu.className='msg-action-menu';

  // Balas
  const rb=document.createElement('button');rb.className='msg-action-item';rb.textContent='↩ Balas';
  rb.onclick=(e)=>{e.stopPropagation();closeMsgMenu();setReply(msgId,sender,msg);};menu.appendChild(rb);

  // Edit (hanya teks milik sendiri)
  if (isMe&&!isMedia) {
    const eb=document.createElement('button');eb.className='msg-action-item';eb.textContent='✏ Edit';
    eb.onclick=(e)=>{e.stopPropagation();closeMsgMenu();startEdit(msgId,msg);};menu.appendChild(eb);
  }

  // Info (admin only)
  if (isAdmin) {
    const ib=document.createElement('button');ib.className='msg-action-item';ib.textContent='ℹ Info';
    ib.onclick=(e)=>{e.stopPropagation();closeMsgMenu();showMsgInfo(msgId,sender);};menu.appendChild(ib);
  }

  // Hapus
  if (isMe||isAdmin) {
    const db=document.createElement('button');db.className='msg-action-item danger';db.textContent='✕ Hapus';
    db.onclick=(e)=>{e.stopPropagation();closeMsgMenu();deleteMsg(msgId);};menu.appendChild(db);
  }

  const rect=anchor.getBoundingClientRect();
  menu.style.cssText='position:fixed;top:'+(rect.bottom+4)+'px;'+(isMe?'right:'+(window.innerWidth-rect.right)+'px;':'left:'+rect.left+'px;');
  document.body.appendChild(menu); activeMsgMenu=menu;
}

async function deleteMsg(id) {
  const ok=await showConfirm('Hapus pesan ini?',{icon:'🗑',title:'Hapus Pesan',okText:'Hapus',cancelText:'Batal'});
  if(!ok)return;
  const{error}=await sb.from('chat_messages').delete().eq('id',id);
  if(error){toast('Gagal hapus',false);return;}
  const el=document.querySelector('[data-msg-id="'+id+'"]');if(el)el.remove();
  seenMsgIds.delete(String(id));toast('Pesan dihapus');
}

// ===== SEND =====
async function sendMsg() {
  if (editingMsgId) { await saveEdit(); return; }
  if (sending) return;
  if (!currentAccount) { showErr('Session habis, login ulang'); return; }

  const inp = document.getElementById('chatInput');
  const msg = (inp.value||'').replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,'');
  if (!msg) return;

  sending=true; inp.value=''; inp.style.height=''; updateSendMicBtn(); inp.focus();

  if (selfTyping) { selfTyping=false; clearTimeout(typingTimer); rpc('update_typing',{p_username:currentAccount.name,p_is_typing:false}); }

  const row={message:msg,user_id:typeof USER_ID!=='undefined'?USER_ID:('u_'+Date.now()),sender_name:currentAccount.name,sender_role:currentAccount.role||'user'};
  if (replyTarget) { row.reply_to_id=replyTarget.id; row.reply_to_name=replyTarget.sender_name; row.reply_to_text=replyTarget.message; }
  clearReplyBanner();

  // Optimistic UI
  const tempId='temp_'+Date.now(); statusMap[tempId]='pending';
  const tempMsg={id:tempId,message:msg,sender_name:currentAccount.name,sender_role:currentAccount.role||'user',created_at:new Date().toISOString(),reply_to_name:replyTarget?replyTarget.sender_name:null,reply_to_text:replyTarget?replyTarget.message:null,is_edited:false};
  const list=document.getElementById('chatList'); const ph=list.querySelector('.state-msg');if(ph)list.innerHTML='';
  list.appendChild(buildMsg(tempMsg)); scrollToBottom(list,true);

  try {
    const{data,error}=await sb.from('chat_messages').insert([row]).select().single();
    if(error){showErr('Gagal kirim: '+error.message);const t=document.querySelector('[data-msg-id="'+tempId+'"]');if(t)t.remove();seenMsgIds.delete(tempId);delete statusMap[tempId];inp.value=msg;sending=false;return;}
    if(data){
      const id=String(data.id); const t=document.querySelector('[data-msg-id="'+tempId+'"]');
      seenMsgIds.delete(tempId);delete statusMap[tempId];statusMap[id]='sent';seenMsgIds.add(id);lastPollTs=data.created_at;
      const realEl=buildMsg(data);if(t)t.replaceWith(realEl);else list.appendChild(realEl);
      upsertStatus(data.id,'sent');
    }
  } catch(err){showErr('Error: '+err.message);inp.value=msg;}
  sending=false;
}

// ===== CHAT UPLOAD =====
let pendingChatFile=null;
function doChatUpload(input){
  if(!currentAccount)return; const file=input.files[0];if(!file)return; pendingChatFile=file;input.value='';
  document.getElementById('uploadFileName').textContent=file.name;
  document.getElementById('uploadFileSize').textContent=fmtBytes(file.size)+' · '+(file.type||'unknown');
  document.getElementById('uploadProgressWrap').style.display='none';
  document.getElementById('uploadProgressFill').style.width='0%';
  document.getElementById('uploadPctLabel').textContent='0%';
  document.getElementById('uploadSpeedLabel').textContent='—';
  document.getElementById('uploadRemainLabel').textContent='—';
  const g=document.getElementById('uploadGoBtn');g.disabled=false;g.textContent='Kirim';g.onclick=startChatFileUpload;
  document.getElementById('uploadCancelBtn').textContent='Batal';
  document.getElementById('uploadModalCloseBtn').style.display='';
  document.getElementById('uploadConfirmModal').classList.add('show');
}
async function startChatFileUpload(){
  if(!pendingChatFile||!currentAccount)return;
  const file=pendingChatFile,isVid=file.type.startsWith('video/'),ext=file.name.split('.').pop();
  const name='chat_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)+'.'+ext;
  const g=document.getElementById('uploadGoBtn'),cl=document.getElementById('uploadModalCloseBtn'),cn=document.getElementById('uploadCancelBtn');
  g.disabled=true;g.textContent='Mengirim...';cl.style.display='none';cn.textContent='Batalkan';
  document.getElementById('uploadProgressWrap').style.display='flex';
  let ll=0,lt=Date.now(),ok=false;
  try{
    await new Promise((res,rej)=>{
      const xhr=new XMLHttpRequest();xhr.open('POST',SB_URL+'/storage/v1/object/gallery/'+name,true);
      xhr.setRequestHeader('Authorization','Bearer '+SB_KEY);xhr.setRequestHeader('x-upsert','false');xhr.setRequestHeader('Cache-Control','3600');
      xhr.upload.onprogress=(e)=>{if(!e.lengthComputable)return;const now=Date.now(),pct=Math.round(e.loaded/e.total*100),el2=(now-lt)/1000,sp=el2>0?(e.loaded-ll)/el2:0;ll=e.loaded;lt=now;document.getElementById('uploadProgressFill').style.width=pct+'%';document.getElementById('uploadPctLabel').textContent=pct+'%';document.getElementById('uploadSpeedLabel').textContent=sp>0?fmtBytes(sp)+'/s':'—';document.getElementById('uploadRemainLabel').textContent=fmtBytes(e.total-e.loaded)+' tersisa';};
      xhr.onload=()=>{xhr.status>=200&&xhr.status<300?res():rej(new Error('HTTP '+xhr.status));};xhr.onerror=()=>rej(new Error('Network error'));xhr.send(file);
    });ok=true;
  }catch(err){toast(err.message==='Dibatalkan'?'Dibatalkan':'Upload gagal',false);g.disabled=false;g.textContent='Kirim';cn.textContent='Batal';cl.style.display='';document.getElementById('uploadProgressWrap').style.display='none';document.getElementById('uploadConfirmModal').classList.remove('show');g.onclick=startGalleryUpload;pendingChatFile=null;return;}
  if(!ok)return;
  const url=sb.storage.from('gallery').getPublicUrl(name).data.publicUrl;
  const content=(isVid?'[video]':'[img]')+url;
  const{error}=await sb.from('chat_messages').insert([{message:content,user_id:typeof USER_ID!=='undefined'?USER_ID:'u',sender_name:currentAccount.name,sender_role:currentAccount.role}]);
  if(error)toast('Gagal kirim',false);else toast('Media terkirim ✓');
  document.getElementById('uploadConfirmModal').classList.remove('show');document.getElementById('uploadGoBtn').onclick=startGalleryUpload;pendingChatFile=null;
}

// ===== MULTISELECT =====
function enterSelect(id){selectionActive=true;addSel(id);renderSelBar();}
function toggleSelect(id){if(!selectionActive)return;if(selectedMsgIds.has(id))remSel(id);else addSel(id);if(!selectedMsgIds.size){exitSelect();return;}renderSelBar();}
function addSel(id){selectedMsgIds.add(id);const r=document.querySelector('[data-msg-id="'+id+'"]');if(r)r.classList.add('msg-selected');}
function remSel(id){selectedMsgIds.delete(id);const r=document.querySelector('[data-msg-id="'+id+'"]');if(r)r.classList.remove('msg-selected');}
function allOwn(){for(const id of selectedMsgIds){const r=document.querySelector('[data-msg-id="'+id+'"]');if(!r||!r.classList.contains('mine'))return false;}return true;}
function renderSelBar(){
  let bar=document.getElementById('selectionBar');
  if(!bar){bar=document.createElement('div');bar.id='selectionBar';bar.className='selection-bar';document.querySelector('.topbar').appendChild(bar);}
  const canDel=(currentAccount&&currentAccount.role==='admin')||allOwn();
  bar.innerHTML='<button class="sel-cancel-btn" onclick="exitSelect()">✕ Batal</button><span class="sel-label">'+selectedMsgIds.size+' dipilih</span>'+(canDel?'<button class="sel-delete-btn" onclick="delSelected()">🗑 Hapus</button>':'<span style="width:74px"></span>');
  bar.style.display='flex';
}
function exitSelect(){selectionActive=false;selectedMsgIds.clear();document.querySelectorAll('.msg-selected').forEach(e=>e.classList.remove('msg-selected'));const b=document.getElementById('selectionBar');if(b)b.style.display='none';}
function exitSelectionMode(){exitSelect();}
async function delSelected(){
  if(!selectedMsgIds.size)return;
  const ids=Array.from(selectedMsgIds);
  const ok=await showConfirm('Hapus '+(ids.length===1?'pesan ini':ids.length+' pesan')+'?',{icon:'🗑',title:'Hapus Pesan',okText:'Hapus',cancelText:'Batal'});
  if(!ok)return; exitSelect();
  await sb.from('chat_messages').delete().in('id',ids);
  ids.forEach(id=>{const e=document.querySelector('[data-msg-id="'+id+'"]');if(e)e.remove();seenMsgIds.delete(String(id));});
  toast(ids.length===1?'Pesan dihapus':ids.length+' pesan dihapus');
}
async function delSelectedMsgs(){await delSelected();}
