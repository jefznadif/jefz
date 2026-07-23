// ================================================================
// CHAT-UI.JS
// Emoji picker, gallery, lightbox, init chat
// ================================================================

// ===== EMOJI =====
const EMOJI_CATEGORIES=[
  {icon:'😀',label:'Smileys',emojis:['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','💫','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖']},
  {icon:'❤️',label:'Hearts',emojis:['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟']},
  {icon:'👋',label:'People',emojis:['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦿','🦶','👂','🦻','👃','🧠','🦷','🦴','👀','👁️','👅','👄','💋','🩸']},
  {icon:'🐱',label:'Animals',emojis:['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🦋','🐌','🐞','🐜','🦟','🕷️','🦂','🐢','🐍','🦎','🐙','🦑','🦐','🦀','🐡','🐠','🐟','🐬','🐳','🦈']},
  {icon:'🍎',label:'Food',emojis:['🍏','🍎','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🌶️','🧄','🥔','🥐','🥯','🍞','🥖','🧀','🥚','🍳','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🌮','🌯','🥗','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🍤','🍙','🍚','🍘','🍥','🥮','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🧃','🥤','🧋','☕','🍵','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🍾']},
  {icon:'⚽',label:'Activity',emojis:['⚽','🏀','🏈','⚾','🥎','🏐','🏉','🎾','🥏','🎱','🏓','🏸','🏒','🥅','⛳','🎯','🎮','🕹️','🎲','🧩','🧸','♟️','🎭','🎨','🎰']},
  {icon:'🌍',label:'Travel',emojis:['🌍','🌎','🌏','🏔️','⛰️','🌋','🏕️','🏖️','🏜️','🏝️','🏠','🏡','🏢','🏥','🏦','🏨','🏪','🏫','🏬','🏯','🏰','⛪','🌃','🏙️','🌄','🌅','🌆','🌇','🌉','🚂','🚄','🚇','🚌','🚑','🚒','🚓','🚕','✈️','🛫','🚀','🛸','🚁','⛵','🚤','🚢']},
  {icon:'💡',label:'Objects',emojis:['⌚','📱','💻','⌨️','🖥️','📷','📸','📹','🎥','📞','☎️','📺','📻','🔋','🔌','💡','🔦','💰','💵','💳','✉️','📧','📝','📁','📂','📅','📈','📉','📊','📋','📌','📍','✂️','🔒','🔓','🔑','🔨','⚙️','🔗','🧰','🧲','💊','🩺','🧪','🧬','🔬','🔭']},
];

let emojiPickerOpen = false;

function buildEmojiPicker() {
  if (document.getElementById('emojiPickerPanel')) return document.getElementById('emojiPickerPanel');
  const panel = document.createElement('div'); panel.id='emojiPickerPanel'; panel.className='emoji-picker-wrap';
  const hint  = document.createElement('div'); hint.className='emoji-swipe-hint'; panel.appendChild(hint);
  const tabs  = document.createElement('div'); tabs.className='emoji-cat-tabs';
  const body  = document.createElement('div'); body.className='emoji-body';
  EMOJI_CATEGORIES.forEach((cat, idx) => {
    const tab = document.createElement('button');
    tab.className='emoji-cat-tab'+(idx===0?' active':''); tab.title=cat.label; tab.textContent=cat.icon;
    tab.onclick=()=>{document.querySelectorAll('.emoji-cat-tab').forEach(t=>t.classList.remove('active'));tab.classList.add('active');document.querySelectorAll('.emoji-section').forEach(s=>s.style.display='none');document.getElementById('emoji-sec-'+idx).style.display='';};
    tabs.appendChild(tab);
    const sec=document.createElement('div'); sec.className='emoji-section'; sec.id='emoji-sec-'+idx; if(idx!==0)sec.style.display='none';
    cat.emojis.forEach(em=>{const b=document.createElement('button');b.className='emoji-item';b.textContent=em;b.onclick=(e)=>{e.stopPropagation();insertEmoji(em);};sec.appendChild(b);});
    body.appendChild(sec);
  });
  panel.appendChild(tabs); panel.appendChild(body);
  const cb=document.querySelector('.chat-bar'); if(cb) cb.appendChild(panel);
  return panel;
}

function insertEmoji(em) {
  const i=document.getElementById('chatInput'); if(!i)return;
  const s=i.selectionStart, e=i.selectionEnd;
  i.value=i.value.slice(0,s)+em+i.value.slice(e);
  i.setSelectionRange(s+em.length,s+em.length); i.focus();
  updateSendMicBtn();
}
function toggleEmojiPicker(e) {
  e.stopPropagation();
  const p=document.getElementById('emojiPickerPanel')||buildEmojiPicker();
  emojiPickerOpen=!emojiPickerOpen; p.style.display=emojiPickerOpen?'flex':'none';
  document.getElementById('emojiTrigger').classList.toggle('active',emojiPickerOpen);
}
function closeEmojiPicker() {
  emojiPickerOpen=false;
  const p=document.getElementById('emojiPickerPanel'); if(p)p.style.display='none';
  const t=document.getElementById('emojiTrigger'); if(t)t.classList.remove('active');
}

// ===== GALLERY =====
let galleryItems=[], galleryLoaded=false, lbIdx=-1;

async function loadGallery() {
  const el=document.getElementById('galleryGrid'); el.innerHTML='<p class="state-msg">Memuat...</p>';
  const{data,error}=await sb.from('gallery').select('*').order('created_at',{ascending:false});
  if(error){el.innerHTML='<p class="state-msg err">Error: '+error.message+'</p>';return;}
  galleryLoaded=true; galleryItems=[];
  if(!data||!data.length){el.innerHTML='<p class="state-msg">Belum ada media.</p>';return;}
  el.innerHTML=''; const isAdmin=currentAccount&&currentAccount.role==='admin'; const frag=document.createDocumentFragment();
  data.forEach((f,idx)=>{
    const isVid=/\.(mp4|webm|mov|avi)$/i.test(f.file_name||''); galleryItems.push({url:f.file_url,isVid});
    const d=document.createElement('div'); d.className='g-item';
    if(isVid){const th=document.createElement('div');th.style.cssText='position:relative;width:100%;height:100%;cursor:pointer;';const v=document.createElement('video');v.className='g-media';v.preload='metadata';v.muted=true;v.playsInline=true;v.src=f.file_url+'#t=0.001';const pi=document.createElement('div');pi.className='g-play-icon';pi.innerHTML='<svg viewBox="0 0 24 24" width="28" height="28"><circle cx="12" cy="12" r="12" fill="rgba(0,0,0,0.5)"/><polygon points="10,8 18,12 10,16" fill="white"/></svg>';th.appendChild(v);th.appendChild(pi);((i)=>{th.onclick=()=>openLightbox(i);})(idx);d.appendChild(th);}
    else{const img=document.createElement('img');img.src=f.file_url;img.className='g-media';img.loading='lazy';((i)=>{img.onclick=()=>openLightbox(i);})(idx);d.appendChild(img);}
    if(isAdmin){const db=document.createElement('button');db.className='g-del';db.textContent='✕';db.onclick=(e)=>{e.stopPropagation();delMedia(f.id,f.file_name);};d.appendChild(db);}
    frag.appendChild(d);
  }); el.appendChild(frag);
}

async function delMedia(id,name){
  if(!currentAccount||currentAccount.role!=='admin')return;
  const ok=await showConfirm('Hapus media ini?',{icon:'🗑',title:'Hapus Media',okText:'Hapus',cancelText:'Batal'}); if(!ok)return;
  await sb.storage.from('gallery').remove([name]);
  const{error}=await sb.from('gallery').delete().eq('id',id);
  if(error){toast('Gagal hapus',false);return;}
  toast('Dihapus'); galleryLoaded=false; loadGallery();
}

// ===== GALLERY UPLOAD =====
let pendingFile=null, uploadXHR=null;

function triggerUploadConfirm(input){
  if(!currentAccount||currentAccount.role!=='admin'){toast('Hanya admin yang bisa upload',false);input.value='';return;}
  const file=input.files[0]; if(!file)return; pendingFile=file;
  document.getElementById('uploadFileName').textContent=file.name;
  document.getElementById('uploadFileSize').textContent=fmtBytes(file.size)+' · '+(file.type||'unknown');
  document.getElementById('uploadProgressWrap').style.display='none';
  document.getElementById('uploadProgressFill').style.width='0%';
  document.getElementById('uploadPctLabel').textContent='0%';
  document.getElementById('uploadSpeedLabel').textContent='—';
  document.getElementById('uploadRemainLabel').textContent='—';
  const g=document.getElementById('uploadGoBtn'); g.disabled=false; g.textContent='Upload'; g.onclick=startGalleryUpload;
  document.getElementById('uploadCancelBtn').textContent='Batal';
  document.getElementById('uploadModalCloseBtn').style.display='';
  document.getElementById('uploadConfirmModal').classList.add('show'); input.value='';
}

function cancelUploadModal(){
  if(uploadXHR){try{uploadXHR.abort();}catch(e){}uploadXHR=null;}
  pendingFile=null; pendingChatFile=null;
  document.getElementById('uploadGoBtn').onclick=startGalleryUpload;
  document.getElementById('uploadConfirmModal').classList.remove('show');
}

async function startGalleryUpload(){
  if(!pendingFile)return; const file=pendingFile;
  const g=document.getElementById('uploadGoBtn'); g.disabled=true; g.textContent='Mengupload...';
  document.getElementById('uploadModalCloseBtn').style.display='none';
  document.getElementById('uploadCancelBtn').textContent='Batalkan';
  document.getElementById('uploadProgressWrap').style.display='flex';
  const ext=file.name.split('.').pop(); const name=Date.now()+'_'+Math.random().toString(36).slice(2,6)+'.'+ext;
  let ll=0,lt=Date.now(),ok=false;
  try{
    await new Promise((res,rej)=>{
      const xhr=new XMLHttpRequest(); uploadXHR=xhr;
      xhr.open('POST',SB_URL+'/storage/v1/object/gallery/'+name,true);
      xhr.setRequestHeader('Authorization','Bearer '+SB_KEY); xhr.setRequestHeader('x-upsert','false'); xhr.setRequestHeader('Cache-Control','3600');
      xhr.upload.onprogress=(e)=>{if(!e.lengthComputable)return;const now=Date.now(),pct=Math.round(e.loaded/e.total*100),el2=(now-lt)/1000,sp=el2>0?(e.loaded-ll)/el2:0;ll=e.loaded;lt=now;document.getElementById('uploadProgressFill').style.width=pct+'%';document.getElementById('uploadPctLabel').textContent=pct+'%';document.getElementById('uploadSpeedLabel').textContent=sp>0?fmtBytes(sp)+'/s':'—';document.getElementById('uploadRemainLabel').textContent=fmtBytes(e.total-e.loaded)+' tersisa';};
      xhr.onload=()=>{uploadXHR=null;xhr.status>=200&&xhr.status<300?res():rej(new Error('HTTP '+xhr.status));};
      xhr.onerror=()=>{uploadXHR=null;rej(new Error('Network error'));};
      xhr.onabort=()=>{uploadXHR=null;rej(new Error('Dibatalkan'));};
      xhr.send(file);
    }); ok=true;
  }catch(err){
    toast(err.message==='Dibatalkan'?'Upload dibatalkan':'Upload gagal: '+err.message,false);
    g.disabled=false;g.textContent='Upload';document.getElementById('uploadCancelBtn').textContent='Batal';
    document.getElementById('uploadModalCloseBtn').style.display='';document.getElementById('uploadProgressWrap').style.display='none';
    document.getElementById('uploadConfirmModal').classList.remove('show'); pendingFile=null; return;
  }
  if(!ok)return;
  const url=sb.storage.from('gallery').getPublicUrl(name).data.publicUrl;
  const{error}=await sb.from('gallery').insert([{file_url:url,file_name:name,uploaded_by:currentAccount?currentAccount.name:null}]);
  if(error)toast('Gagal simpan: '+error.message,false);
  else{toast('Berhasil diupload ✓');galleryLoaded=false;loadGallery();}
  pendingFile=null;uploadXHR=null;document.getElementById('uploadConfirmModal').classList.remove('show');
}

// ===== LIGHTBOX =====
function openLightbox(idx){lbIdx=idx;lbRender(idx);lbNavUpdate();document.getElementById('lightbox').classList.add('show');document.body.style.overflow='hidden';}
function openLightboxFromChat(url){lbIdx=-1;const w=document.getElementById('lightboxMediaWrap');lbClear(w);const img=document.getElementById('lightboxImg');img.src=url;img.style.display='';document.getElementById('lightboxCounter').innerHTML='';document.getElementById('lightboxPrev').style.display='none';document.getElementById('lightboxNext').style.display='none';document.getElementById('lightbox').classList.add('show');document.body.style.overflow='hidden';}
function lbClear(w){if(!w)w=document.getElementById('lightboxMediaWrap');const v=w.querySelector('video');if(v){try{v.pause();v.src='';}catch(e){}v.remove();}const img=document.getElementById('lightboxImg');if(img){img.src='';img.style.display='none';}}
function lbRender(idx){const w=document.getElementById('lightboxMediaWrap');lbClear(w);if(idx<0||!galleryItems[idx])return;const item=galleryItems[idx],img=document.getElementById('lightboxImg');if(item.isVid){img.style.display='none';const v=document.createElement('video');v.src=item.url;v.controls=true;v.playsInline=true;v.style.cssText='max-width:100%;max-height:76vh;width:auto;height:auto;object-fit:contain;display:block;';w.appendChild(v);}else{img.src=item.url;img.style.display='';}lbCounter(idx);}
function lbNavUpdate(){const p=document.getElementById('lightboxPrev'),n=document.getElementById('lightboxNext');if(lbIdx<0||galleryItems.length<=1){if(p)p.style.display='none';if(n)n.style.display='none';return;}if(p)p.style.display=lbIdx>0?'':'none';if(n)n.style.display=lbIdx<galleryItems.length-1?'':'none';}
function lbCounter(idx){const c=document.getElementById('lightboxCounter');if(!c)return;if(galleryItems.length<=1){c.innerHTML='';return;}const s=Math.max(0,idx-5),e=Math.min(galleryItems.length-1,s+11);c.innerHTML=Array.from({length:e-s+1},(_,i)=>'<span class="lb-dot'+(s+i===idx?' active':'')+'"></span>').join('');}
function lightboxNav(dir){if(lbIdx<0)return;const n=lbIdx+dir;if(n<0||n>=galleryItems.length)return;lbIdx=n;const w=document.getElementById('lightboxMediaWrap');w.style.transition='opacity .15s,transform .15s';w.style.opacity='0';w.style.transform='translateX('+(dir>0?'24px':'-24px')+')';setTimeout(()=>{lbRender(lbIdx);lbNavUpdate();w.style.transition='opacity .2s,transform .2s';w.style.opacity='1';w.style.transform='translateX(0)';},120);}
function closeLightbox(){document.getElementById('lightbox').classList.remove('show');const w=document.getElementById('lightboxMediaWrap');lbClear(w);const img=document.getElementById('lightboxImg');if(img){img.src='';img.style.display='';}document.getElementById('lightboxCounter').innerHTML='';lbIdx=-1;document.body.style.overflow='';if(w){w.style.opacity='';w.style.transform='';w.style.transition='';}}

// Swipe lightbox
(function(){document.addEventListener('DOMContentLoaded',()=>{const lb=document.getElementById('lightbox');if(!lb)return;let sx=0,sw=false;lb.addEventListener('touchstart',(e)=>{if(e.target.closest('.lightbox-close,.lightbox-prev,.lightbox-next'))return;sx=e.touches[0].clientX;sw=false;},{passive:true});lb.addEventListener('touchmove',(e)=>{if(Math.abs(e.touches[0].clientX-sx)>12)sw=true;},{passive:true});lb.addEventListener('touchend',(e)=>{if(!sw)return;const dx=e.changedTouches[0].clientX-sx;sw=false;if(Math.abs(dx)>60)lightboxNav(dx<0?1:-1);});});})();

// ===== INIT CHAT =====
async function initChat() {
  isChatActive = true;
  fixHeaderOnKeyboard();

  const inp = document.getElementById('chatInput');
  if (inp && !inp._b) {
    inp._b = true;
    inp.addEventListener('input', onChatInput);
  }

  initSendMicBtn();
  _updateTopbarUser();

  if (!chatLoaded) {
    const list = document.getElementById('chatList');
    list.innerHTML = '<p class="state-msg">Memuat...</p>';
    const { data, error } = await sb.from('chat_messages').select('*').order('created_at', { ascending: true });
    if (error) { list.innerHTML='<p class="state-msg err">Gagal memuat</p>'; showErr('Load error: '+error.message); return; }
    if (data && data.length && currentAccount) {
      const myIds = data.filter(m => m.sender_name===currentAccount.name).map(m=>m.id);
      await preloadAllStatuses(myIds);
    }
    list.innerHTML = ''; chatLoaded = true;
    if (!data || !data.length) {
      list.innerHTML = '<p class="state-msg">Belum ada pesan 💬</p>';
    } else {
      const frag = document.createDocumentFragment();
      data.forEach(m => { seenMsgIds.add(String(m.id)); frag.appendChild(buildMsg(m)); });
      list.appendChild(frag); scrollToBottom(list, false);
      lastPollTs = data[data.length-1].created_at;
    }
  }

  startRealtime();
  startPresence();
  startPoll();
}

// ===== CSS VN (inject sekali) =====
(function injectVnCss(){
  if (document.getElementById('vnCssStyle')) return;
  const style = document.createElement('style');
  style.id = 'vnCssStyle';
  style.textContent = `
    /* Voice Note Overlay */
    .vn-overlay {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 400;
      height: 68px; display: flex; align-items: center; justify-content: space-between;
      padding: 0 16px; gap: 10px;
      background: var(--topbar-bg); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur);
      border-top: 1px solid var(--separator);
      animation: slideUpVn 0.2s ease;
    }
    @keyframes slideUpVn { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
    .vn-cancel-hint { display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text3);opacity:0.4;transition:all 0.15s;white-space:nowrap; }
    .vn-lock-hint   { display:flex;flex-direction:column;align-items:center;gap:2px;font-size:10px;color:var(--text3);opacity:0.4;transition:all 0.15s; }
    .vn-center { display:flex;align-items:center;gap:8px;flex:1;justify-content:center; }
    .vn-rec-dot { width:8px;height:8px;border-radius:50%;background:#ff3b30;animation:recPulse 1s ease infinite;flex-shrink:0; }
    @keyframes recPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.7)} }
    .vn-timer { font-size:17px;font-weight:700;color:var(--text);font-variant-numeric:tabular-nums;min-width:38px;text-align:center; }
    .vn-wave-wrap { display:flex;align-items:center;gap:2px;height:22px; }
    .vn-wave-bar { width:3px;border-radius:2px;background:var(--accent);animation:vnWave 0.5s ease infinite alternate; }
    @keyframes vnWave { from{height:20%} to{height:90%} }
    .vn-del-btn { width:40px;height:40px;border-radius:50%;border:none;background:rgba(255,59,48,0.12);color:var(--danger);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
    .vn-del-btn:active { background:rgba(255,59,48,0.25); }
    .vn-send-locked-btn { width:44px;height:44px;border-radius:50%;border:none;background:#34c759;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(52,199,89,0.4);flex-shrink:0; }
    .vn-send-locked-btn svg { width:18px;height:18px; }
    .vn-send-locked-btn:active { transform:scale(0.93); }

    /* Voice Note Bubble */
    .vn-wrap { display:flex;align-items:center;gap:8px;padding:2px 0;min-width:180px;max-width:240px; }
    .vn-play-btn { width:36px;height:36px;border-radius:50%;border:none;background:var(--accent);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s; }
    .vn-play-btn.playing { background:#34c759; }
    .vn-play-btn:active { transform:scale(0.9); }
    .vn-waveform { display:flex;align-items:center;gap:2px;height:28px;flex:1;cursor:pointer; }
    .vn-bar { width:3px;border-radius:2px;background:var(--text3);transition:height 0.1s,background 0.15s;min-height:4px; }
    .vn-duration { font-size:11px;color:var(--text3);font-weight:600;min-width:28px;text-align:right;flex-shrink:0; }

    /* Monitor animations */
    @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
    @keyframes monitorIn { from{opacity:0;transform:scale(0.8) translateY(20px)} to{opacity:1;transform:scale(1) translateY(0)} }
    @keyframes overlayOut { from{opacity:1} to{opacity:0} }
    @keyframes lbCardIn  { from{opacity:0;transform:scale(0.92) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
  `;
  document.head.appendChild(style);
})();

// ===== CLEANUP =====
window.addEventListener('beforeunload', () => {
  if (presenceTimer) clearInterval(presenceTimer);
  if (pollTimer)     clearInterval(pollTimer);
  if (chatChannel)     { try { sb.removeChannel(chatChannel);     } catch (e) {} }
  if (presenceChannel) { try { sb.removeChannel(presenceChannel); } catch (e) {} }
  if (currentAccount) {
    rpc('update_presence', { p_username: currentAccount.name, p_is_online: false });
    rpc('update_typing',   { p_username: currentAccount.name, p_is_typing: false });
  }
  if (typeof vnRecording !== 'undefined' && vnRecording) stopVnRecording(false);
});
