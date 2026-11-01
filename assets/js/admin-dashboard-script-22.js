/* ===== Notices + Documents panel — same markup, styling and behaviour as the public index page ===== */
(function(){
  'use strict';
  var $=function(id){return document.getElementById(id);};
  var panel=$('rightPanel'), overlay=$('rpOverlay'), slider=$('panelSlider');
  if(!panel||!slider||!overlay) return;
  var viewport=panel.querySelector('.panel-viewport');
  var noticeBox=$('noticeContainer'), docBox=$('documentsContainer');
  var docSearch=$('docSearchInput'), docBar=$('docToolbar'), docFilters=$('docFilters'), docScroll=$('docToolbarScroll');
  var iconEl=$('rightPanelIcon'), titleEl=$('rightPanelTitle'), subEl=$('rightPanelSubtitle');
  var noticeBtn=$('noticeHeadBtn'), headBadge=$('noticeBadge'), tabNoticeBadge=$('noticeTabBadge'), tabDocBadge=$('docTabBadge');
  var CFG=(typeof ADMIN_CONFIG!=='undefined')?ADMIN_CONFIG:{};
  var TAB_KEY=CFG.RIGHT_PANEL_TAB_KEY||'psbs_right_panel_tab';
  var READ_KEY=CFG.NOTICE_READ_IDS_KEY||'psbs_notice_read_ids';
  var DL_KEY='psbs_admin_downloads';
  var SWIPE=CFG.PANEL_SWIPE_THRESHOLD||55;
  var S={notices:[],docs:[],query:'',filter:'all',loaded:false,loading:false,sigN:'',sigD:'',shown:[]};
  var clamp=function(v,a,b){return Math.max(a,Math.min(b,v));};

  /* ---------- helpers (same logic as the public index page) ---------- */
  function esc(v){ return Helpers.sanitize(v); }
  function toast(m,t){ try{ Toast.show(m,t||'info'); }catch(e){} }
  function isDateOnly(v){ var s=String(v==null?'':v).trim(); return /^\d{4}-\d{2}-\d{2}$/.test(s)||/^\d{4}-\d{2}-\d{2}[T ]00:00(:00(\.0+)?)?$/.test(s); }
  function parseTs(v){
    if(v==null||v==='') return NaN;
    if(v instanceof Date) return v.getTime();
    var s=String(v).trim();
    if(isDateOnly(s)){ var p=s.slice(0,10).split('-'); return new Date(+p[0],+p[1]-1,+p[2]).getTime(); }
    if(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s)&&!/(Z|[+-]\d{2}(:?\d{2})?)$/.test(s)) s=s.replace(' ','T')+'Z';
    return new Date(s).getTime();
  }
  function fmtDate(v){
    try{ var d=new Date(parseTs(v)); if(isNaN(d.getTime())) return v||''; return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }catch(e){ return v||''; }
  }
  function timeAgo(v){
    var then=parseTs(v); if(isNaN(then)) return '';
    if(isDateOnly(v)){
      var t0=new Date(); t0.setHours(0,0,0,0);
      var days=Math.round((t0.getTime()-then)/86400000);
      if(days<=0) return 'Today'; if(days===1) return 'Yesterday'; if(days<7) return days+'d ago';
      return new Date(then).toLocaleDateString();
    }
    var diff=Math.floor((Date.now()-then)/1000);
    if(diff<60) return 'just now'; if(diff<3600) return Math.floor(diff/60)+'m ago';
    if(diff<86400) return Math.floor(diff/3600)+'h ago'; if(diff<604800) return Math.floor(diff/86400)+'d ago';
    return new Date(then).toLocaleDateString();
  }
  function fmtBytes(b){
    var n=Number(b); if(!n||n<=0||isNaN(n)) return '';
    var u=['B','KB','MB','GB'],i=0,v=n; while(v>=1024&&i<u.length-1){ v/=1024; i++; }
    return (v>=10?Math.round(v):v.toFixed(1))+' '+u[i];
  }
  function tok(){ try{ return localStorage.getItem(tokenKey)||sessionStorage.getItem(tokenKey); }catch(e){ return null; } }
  function rows(d){ return Array.isArray(d)?d:(d&&(d.records||d.data))||[]; }

  /* ---------- notices ---------- */
  var LABELS={urgent:'🔴 URGENT',event:'🎉 EVENT',announcement:'📢 ANNOUNCEMENT',achievement:'🏆 ACHIEVEMENT',exam:'📝 EXAM',holiday:'🎊 HOLIDAY'};
  function readIds(){ try{ var d=localStorage.getItem(READ_KEY); return d?JSON.parse(d):[]; }catch(e){ return []; } }
  function saveReadIds(ids){ try{ localStorage.setItem(READ_KEY,JSON.stringify(ids.slice(-500))); }catch(e){} }
  function unreadCount(){ var r=readIds(); return S.notices.filter(function(n){ return r.indexOf(String(n.id))<0; }).length; }
  function updateBadge(){
    var c=unreadCount(), txt=c>99?'99+':String(c);
    if(headBadge){
      if(c>0){ headBadge.textContent=txt; headBadge.classList.remove('hidden-badge'); headBadge.classList.add('pop'); setTimeout(function(){ headBadge.classList.remove('pop'); },400); }
      else headBadge.classList.add('hidden-badge');
    }
    if(tabNoticeBadge){ if(c>0){ tabNoticeBadge.textContent=txt; tabNoticeBadge.classList.remove('hidden-badge'); } else tabNoticeBadge.classList.add('hidden-badge'); }
  }
  function updateDocBadge(){
    if(!tabDocBadge) return;
    var c=S.docs.length;
    if(c>0){ tabDocBadge.textContent=c>99?'99+':String(c); tabDocBadge.classList.remove('hidden-badge'); } else tabDocBadge.classList.add('hidden-badge');
  }
  function markAllAsRead(){
    saveReadIds(S.notices.map(function(n){ return String(n.id); }));
    updateBadge();
    noticeBox.querySelectorAll('.update-card.notice-unread').forEach(function(el){ el.classList.remove('notice-unread'); });
  }
  function markNoticeAsRead(id){
    id=String(id); var r=readIds();
    if(r.indexOf(id)<0){ r.push(id); saveReadIds(r); updateBadge(); }
    var card=noticeBox.querySelector('.update-card[data-notice-id="'+id.replace(/"/g,'')+'"]'); if(card) card.classList.remove('notice-unread');
  }
  function renderNotices(){
    var list=S.notices;
    if(!list.length){ noticeBox.innerHTML='<div class="doc-empty"><span class="doc-empty-icon">📭</span><h4>No notices available</h4><p>Please check back later.</p></div>'; return; }
    var seen=readIds(), html='';
    for(var i=0;i<list.length;i++){
      var n=list[i], id=String(n.id), raw=String(n.label||'').toLowerCase().trim(), lab=LABELS[raw]?raw:'announcement';
      html+='<div class="update-card '+(seen.indexOf(id)<0?'notice-unread':'')+'" data-notice-id="'+esc(id)+'" style="animation-delay:'+Math.min(i*50,350)+'ms">'
        +'<span class="update-label '+lab+'">'+LABELS[lab]+'</span>'
        +'<h3>'+esc(n.title)+'</h3><p>'+esc(n.description)+'</p>'
        +'<div class="update-date">📅 '+fmtDate(n.date)+' • '+timeAgo(n.created_at||n.date)+'</div></div>';
    }
    noticeBox.innerHTML=html;
  }
  noticeBox.addEventListener('click',function(e){
    var c=e.target.closest('.update-card'); if(!c) return;
    var id=c.getAttribute('data-notice-id'); if(id) markNoticeAsRead(id);
  });

  /* ---------- documents ---------- */
  var FT={pdf:{cls:'pdf',label:'PDF'},doc:{cls:'doc',label:'DOC'},docx:{cls:'doc',label:'DOC'},ppt:{cls:'ppt',label:'PPT'},pptx:{cls:'ppt',label:'PPT'},xls:{cls:'xls',label:'XLS'},xlsx:{cls:'xls',label:'XLS'},csv:{cls:'xls',label:'CSV'},txt:{cls:'other',label:'TXT'},zip:{cls:'zip',label:'ZIP'},rar:{cls:'zip',label:'RAR'},png:{cls:'img',label:'IMG'},jpg:{cls:'img',label:'IMG'},jpeg:{cls:'img',label:'IMG'},webp:{cls:'img',label:'IMG'}};
  function docExt(d){
    var e=String(d.file_type||'').toLowerCase().replace(/^\./,'').trim();
    if(!e&&d.file_url){ var parts=String(d.file_url).split('?')[0].split('.'); if(parts.length>1) e=parts.pop().toLowerCase(); }
    return e;
  }
  function typeInfo(e){ return FT[e]||{cls:'other',label:(e||'FILE').toUpperCase().slice(0,4)}; }
  function bucket(e){
    if(e==='pdf') return 'pdf';
    if(e==='doc'||e==='docx') return 'doc';
    return 'other'; /* PPT/PPTX and other files are grouped under Other */
  }
  function docKey(d){ return String(d.id!=null?d.id:(d.file_url||'')); }
  function dlGet(){ try{ var r=localStorage.getItem(DL_KEY); return r?JSON.parse(r):[]; }catch(e){ return []; } }
  function dlAdd(k){ k=String(k); var l=dlGet(); if(l.indexOf(k)!==-1) return; l.push(k); try{ localStorage.setItem(DL_KEY,JSON.stringify(l)); }catch(e){} }
  function setDocSubtitle(n){ if(RP.current==='documents') subEl.textContent=n?(n+' file'+(n===1?'':'s')+' available'):'Notes • PDFs • Slides'; }
  function renderDocs(){
    var q=S.query.trim().toLowerCase(), f=S.filter;
    var list=S.docs.filter(function(d){
      var e=docExt(d);
      if(f!=='all'&&bucket(e)!==f) return false;
      if(!q) return true;
      return ((d.title||'')+' '+(d.subject||'')+' '+(d.description||'')+' '+e).toLowerCase().indexOf(q)!==-1;
    });
    S.shown=list; setDocSubtitle(list.length);
    if(!list.length){
      var filtering=q||f!=='all';
      docBox.innerHTML='<div class="doc-empty"><span class="doc-empty-icon">'+(filtering?'🔍':'📂')+'</span><h4>'+(filtering?'No matching documents':'No documents yet')+'</h4><p>'+(filtering?'Try a different search or filter.':'Files uploaded by the school will appear here.')+'</p></div>';
      return;
    }
    var saved=dlGet(), html='';
    for(var i=0;i<list.length;i++){
      var d=list[i], e=docExt(d), info=typeInfo(e), key=docKey(d), isDl=saved.indexOf(key)!==-1;
      var title=d.title||(d.file_url?decodeURIComponent(String(d.file_url).split('/').pop()):'Document');
      var size=fmtBytes(d.file_size), date=d.created_at?fmtDate(d.created_at):(d.date?fmtDate(d.date):'');
      html+='<div class="doc-card'+(isDl?' doc-downloaded':'')+'" data-doc-index="'+i+'" data-doc-key="'+esc(key)+'" style="animation-delay:'+Math.min(i*50,350)+'ms">'
        +'<div class="doc-file-icon '+info.cls+'" aria-hidden="true">'+info.label+'</div>'
        +'<div class="doc-info"><h4 title="'+esc(title)+'">'+esc(title)+'</h4><div class="doc-meta">'
        +(size?'<span>'+size+'</span><span class="dot"></span>':'')+(date?'<span>'+date+'</span>':'')+((!size&&!date)?'<span>Tap to open</span>':'')
        +(isDl?'<span class="downloaded-tag"><i class="ri-checkbox-circle-fill"></i> Saved</span>':'')
        +'</div>'+(d.subject?'<span class="doc-subject-tag">'+esc(d.subject)+'</span>':'')+'</div>'
        +'<div class="doc-actions"><div class="doc-menu-wrap" data-doc-menu><button class="doc-menu-btn" type="button" aria-label="More options" aria-haspopup="true" aria-expanded="false"><i class="ri-more-2-fill"></i></button></div></div></div>';
    }
    docBox.innerHTML=html;
  }
  function viewDocument(d){
    var url=Helpers.safeUrl(d.file_url); if(!url){ toast('File link is not available or is invalid.','error'); return; }
    var e=docExt(d), office=['doc','docx','ppt','pptx','xls','xlsx'].indexOf(e)!==-1, imgs=['png','jpg','jpeg','webp','gif','svg'].indexOf(e)!==-1;
    if(office){ toast('📄 Opening preview...'); var w=window.open('https://docs.google.com/viewer?url='+encodeURIComponent(url)+'&embedded=true','_blank','noopener,noreferrer'); if(!w) toast('Popup blocked. Please allow popups to preview files.','warning'); }
    else if(imgs){ window.open(url,'_blank','noopener'); }
    else { toast('📂 Opening file...'); var w2=window.open(url,'_blank','noopener,noreferrer'); if(!w2) toast('Popup blocked. Please allow popups to view files.','warning'); }
  }
  async function downloadDocument(d){
    var url=Helpers.safeUrl(d.file_url); if(!url){ toast('File link is not available or is invalid.','error'); return false; }
    var raw=d.title||decodeURIComponent(String(url).split('/').pop().split('?')[0])||'document', e=docExt(d);
    var name=/\.[a-z0-9]{2,5}$/i.test(raw)?raw:(raw+(e?'.'+e:''));
    toast('⏳ Preparing download...');
    try{
      var r=await fetch(url,{mode:'cors'}); if(!r.ok) throw new Error('bad response');
      var b=await r.blob(), bu=URL.createObjectURL(b), a=document.createElement('a');
      a.href=bu; a.download=name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(bu); },15000); toast('📥 Downloaded: '+name,'success'); return true;
    }catch(err){
      var a2=document.createElement('a'); a2.href=url; a2.download=name; a2.target='_blank'; a2.rel='noopener noreferrer';
      document.body.appendChild(a2); a2.click(); a2.remove(); toast('📂 Opening file for download...'); return true;
    }
  }
  function markCardAsDownloaded(key){
    docBox.querySelectorAll('.doc-card').forEach(function(card){
      if(card.getAttribute('data-doc-key')!==key) return;
      card.classList.add('doc-downloaded');
      var meta=card.querySelector('.doc-meta');
      if(meta&&!meta.querySelector('.downloaded-tag')){ var t=document.createElement('span'); t.className='downloaded-tag'; t.innerHTML='<i class="ri-checkbox-circle-fill"></i> Saved'; meta.appendChild(t); }
    });
  }
  function closeMenus(){
    document.querySelectorAll('.doc-menu').forEach(function(m){ m.remove(); });
    docBox.querySelectorAll('.doc-card.menu-active').forEach(function(c){ c.classList.remove('menu-active'); });
    docBox.querySelectorAll('.doc-menu-btn[aria-expanded="true"]').forEach(function(b){ b.setAttribute('aria-expanded','false'); });
  }
  function openMenu(btn,d){
    var was=btn.getAttribute('aria-expanded')==='true'; closeMenus(); if(was) return;
    var m=document.createElement('div'); m.className='doc-menu open'; m.setAttribute('role','menu');
    m.innerHTML='<button class="doc-menu-item" type="button" data-action="view" role="menuitem"><i class="ri-eye-line"></i> View</button>'
      +'<button class="doc-menu-item" type="button" data-action="download" role="menuitem"><i class="ri-download-2-line"></i> Download</button>';
    document.body.appendChild(m);
    var r=btn.getBoundingClientRect(), mr=m.getBoundingClientRect(), w=mr.width||165, h=mr.height||88, g=8, vw=window.innerWidth, vh=window.innerHeight;
    var left=r.right-w; if(left<g) left=g; if(left+w>vw-g) left=vw-w-g;
    var top=r.bottom+6; if(top+h>vh-g) top=r.top-h-6; if(top<g) top=g;
    m.style.top=top+'px'; m.style.left=left+'px';
    var card=btn.closest('.doc-card'); if(card) card.classList.add('menu-active'); btn.setAttribute('aria-expanded','true');
    m.querySelector('[data-action="view"]').addEventListener('click',function(e){ e.stopPropagation(); closeMenus(); viewDocument(d); });
    m.querySelector('[data-action="download"]').addEventListener('click',function(e){
      e.stopPropagation(); closeMenus();
      downloadDocument(d).then(function(ok){ if(ok){ dlAdd(docKey(d)); markCardAsDownloaded(docKey(d)); } });
    });
  }
  docBox.addEventListener('click',function(e){
    var c=e.target.closest('.doc-card'); if(!c) return;
    var d=S.shown[parseInt(c.getAttribute('data-doc-index'),10)]; if(!d) return;
    var mb=e.target.closest('.doc-menu-btn');
    if(mb){ e.stopPropagation(); openMenu(mb,d); return; }
    if(e.target.closest('.doc-menu-wrap')) return;
    viewDocument(d);
  });
  docBox.addEventListener('scroll',closeMenus,{passive:true});
  window.addEventListener('resize',closeMenus,{passive:true});
  document.addEventListener('click',function(e){ if(!e.target.closest('.doc-menu,.doc-menu-btn')) closeMenus(); });

  if(docSearch){
    docSearch.addEventListener('input',Helpers.debounce(function(){ S.query=docSearch.value||''; renderDocs(); },200));
    docSearch.addEventListener('focus',function(){ setTimeout(function(){ try{ docSearch.select(); }catch(e){} },50); });
  }
  if(docFilters){
    docFilters.addEventListener('click',function(e){
      var btn=e.target.closest('.doc-filter'); if(!btn) return;
      docFilters.querySelectorAll('.doc-filter').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      S.filter=btn.getAttribute('data-filter')||'all';
      renderDocs();
      var target=btn.offsetLeft-(docScroll.clientWidth-btn.offsetWidth)/2, max=docScroll.scrollWidth-docScroll.clientWidth, left=Math.max(0,Math.min(target,max));
      try{ docScroll.scrollTo({left:left,behavior:'smooth'}); }catch(err){ docScroll.scrollLeft=left; }
      lockViewport();
    });
  }

  /* ---------- data: loaded once, re-rendered only when something changed ---------- */
  function sig(list){ return list.map(function(r){ return [r.id,r.updated_at,r.created_at,r.title,r.label,r.date,r.description,r.file_url,r.file_size,r.subject].join('~'); }).join('|'); }
  function ts(v){ var t=parseTs(v); return isNaN(t)?0:t; }
  async function load(){
    if(S.loading) return; var t=tok(); if(!t) return; S.loading=true;
    try{
      var res=await Promise.allSettled([
        rpc(ADMIN_CONFIG.rpc.list,{p_session_token:t,p_table:'notices',p_limit:200}),
        rpc(ADMIN_CONFIG.rpc.list,{p_session_token:t,p_table:'documents',p_limit:200})
      ]);
      if(res[0].status==='fulfilled'){
        var n=rows(res[0].value).filter(function(x){ return x&&x.title; }).sort(function(a,b){ return (ts(b.date)-ts(a.date))||(ts(b.created_at)-ts(a.created_at)); });
        var sn=sig(n); S.notices=n;
        if(sn!==S.sigN||!S.loaded){ S.sigN=sn; renderNotices(); }
      }else if(!S.loaded) noticeBox.innerHTML='<div class="doc-empty"><span class="doc-empty-icon">📭</span><h4>Could not load notices</h4><p>Please check your connection and try again.</p></div>';
      if(res[1].status==='fulfilled'){
        var d=rows(res[1].value).filter(function(x){ return x&&x.title; }).sort(function(a,b){ return (ts(b.created_at)-ts(a.created_at))||String(b.id||'').localeCompare(String(a.id||'')); });
        var sd=sig(d); S.docs=d;
        if(sd!==S.sigD||!S.loaded){ S.sigD=sd; renderDocs(); }
      }else if(!S.loaded) docBox.innerHTML='<div class="doc-empty"><span class="doc-empty-icon">⚠️</span><h4>Unable to load documents</h4><p>Please check your connection and try again.</p></div>';
      S.loaded=true;
    }catch(e){ console.warn('Panel load error:',e); }
    S.loading=false; updateBadge(); updateDocBadge();
    if(RP._isOpen&&RP.current==='notice') markAllAsRead();
  }
  var rtOn=false, rtTimer=0;
  function reloadSoon(){ clearTimeout(rtTimer); rtTimer=setTimeout(load,400); }
  window.__psbsReloadPanel=function(){ reloadSoon(); setTimeout(load,2000); }; /* called after admin saves/deletes */
  function startRealtime(){
    if(rtOn||typeof db==='undefined'||!db||!db.channel) return; rtOn=true;
    try{ ['notices','documents'].forEach(function(t){ db.channel('admin_panel_'+t).on('postgres_changes',{event:'*',schema:'public',table:t},reloadSoon).subscribe(); }); }
    catch(e){ console.warn('realtime unavailable',e); }
  }

  /* ---------- RightPanel (same as index) ---------- */
  function lockViewport(){
    if(!viewport) return;
    if(viewport.scrollLeft!==0) viewport.scrollLeft=0;
    if(viewport.scrollTop!==0) viewport.scrollTop=0;
  }
  if(viewport) viewport.addEventListener('scroll',lockViewport,{passive:true});

  var RP={
    current:null, _isOpen:false,
    getLast:function(){ try{ return localStorage.getItem(TAB_KEY)==='documents'?'documents':'notice'; }catch(e){ return 'notice'; } },
    setLast:function(w){ try{ localStorage.setItem(TAB_KEY,w); }catch(e){} },
    setTab:function(which,animate){
      which=(which==='documents')?'documents':'notice';
      if(this.current===which) return;
      if(!animate) slider.style.transition='none';
      slider.style.transform='';
      slider.setAttribute('data-active',which);
      panel.setAttribute('data-active-tab',which);
      if(!animate){ void slider.offsetWidth; requestAnimationFrame(function(){ slider.style.transition=''; }); }
      if(which==='notice'){
        iconEl.innerHTML='<i class="ri-notification-3-line"></i>'; titleEl.textContent='Notice Board'; subEl.textContent='Stay updated';
      }else{
        iconEl.innerHTML='<i class="ri-folder-open-line"></i>'; titleEl.textContent='Documents';
        var c=S.docs.length; subEl.textContent=c?(c+' file'+(c===1?'':'s')+' available'):'Notes • PDFs • Slides';
      }
      panel.querySelectorAll('.panel-tab').forEach(function(btn){
        var on=btn.getAttribute('data-panel-tab')===which;
        btn.classList.toggle('active',on); btn.setAttribute('aria-selected',on?'true':'false');
      });
      this.current=which; this.setLast(which);
      if(which==='notice') markAllAsRead(); else if(docSearch) docSearch.blur();
      closeMenus();
      Helpers.vibrate(8);
    },
    open:function(which){
      which=(which==='documents')?'documents':'notice';
      if(typeof closeAllPanels==='function') closeAllPanels();
      var wasOpen=this._isOpen;
      panel.classList.add('active'); overlay.classList.add('active'); panel.setAttribute('aria-hidden','false');
      document.body.style.overflow='hidden'; document.body.classList.add('rp-open');
      this._isOpen=true;
      this.setTab(which,wasOpen&&this.current!==which);
      if(noticeBtn) noticeBtn.setAttribute('aria-expanded','true');
      startRealtime();
      if(!S.loaded) load();
      if(which==='notice') markAllAsRead();
    },
    close:function(){
      if(!this._isOpen) return;
      panel.classList.remove('active','dragging'); overlay.classList.remove('active'); panel.setAttribute('aria-hidden','true');
      document.body.classList.remove('rp-open');
      this._isOpen=false; this.current=null;
      if(docSearch) docSearch.blur();
      closeMenus();
      var b=document.body.classList;
      if(!b.contains('search-open')&&!b.contains('modal-active')) document.body.style.overflow='';
      if(noticeBtn) noticeBtn.setAttribute('aria-expanded','false');
    }
  };
  function norm(t){ return t==='documents'?'documents':'notice'; }
  window.psbsPanel={
    open:function(t){ RP.open(norm(t)); },
    close:function(){ RP.close(); },
    toggle:function(t){ if(RP._isOpen) RP.close(); else RP.open(t?norm(t):RP.getLast()); },
    reload:function(){ return load(); }
  };

  overlay.addEventListener('click',function(){ RP.close(); });
  $('rightPanelClose').addEventListener('click',function(){ RP.close(); });
  document.addEventListener('keydown',function(e){
    if(e.key!=='Escape'||!RP._isOpen) return;
    if(document.querySelector('.doc-menu')){ closeMenus(); return; }
    RP.close();
  });

  /* ---------- bottom tab switcher ---------- */
  var tabs=[].slice.call(panel.querySelectorAll('.panel-tab'));
  tabs.forEach(function(btn,i){
    btn.addEventListener('click',function(e){
      e.preventDefault(); e.stopPropagation();
      var target=btn.getAttribute('data-panel-tab');
      if(target!=='notice'&&target!=='documents') return;
      if(!RP._isOpen) RP.open(target); else if(RP.current!==target) RP.setTab(target,true);
      requestAnimationFrame(lockViewport); setTimeout(lockViewport,360);
    });
    btn.addEventListener('keydown',function(e){
      if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight') return;
      var step=e.key==='ArrowLeft'?-1:1, next=tabs[(i+step+tabs.length)%tabs.length];
      next.focus(); next.click(); e.preventDefault();
    });
  });

  /* ---------- swipe between Notices ⇄ Documents (finger-following, same as index) ---------- */
  (function(){
    var sx=0, sy=0, dx=0, tracking=false, decided=false, horizontal=false, settleTimer=null;
    /* close-by-swipe: the whole panel (not its contents) follows the finger */
    var panelDrag=false, panelW=360, dragDist=0, dragRaf=0, t0=0, ov=$('sidebarOverlay');
    function applyPanelDrag(){
      dragRaf=0;
      var tx=dragDist<0?0:(dragDist>panelW?panelW:dragDist), pr=1-tx/panelW;
      panel.style.transform='translateX('+tx.toFixed(1)+'px)';
      if(ov) ov.style.opacity=(0.85*pr).toFixed(3);
    }
    function dragPanel(dist){
      if(!panelDrag){
        panelDrag=true;
        panel.style.setProperty('transition','none','important');
        if(ov){ ov.style.transition='none'; ov.style.visibility='visible'; }
      }
      dragDist=dist;
      if(!dragRaf) dragRaf=requestAnimationFrame(applyPanelDrag);
    }
    function clearPanelDrag(){
      if(dragRaf){ cancelAnimationFrame(dragRaf); dragRaf=0; }
      panelDrag=false;
      panel.style.transition=''; panel.style.transform='';
      if(ov){ ov.style.transition=''; ov.style.opacity=''; ov.style.visibility=''; }
    }
    function tabBtn(w){ return panel.querySelector('.panel-tab[data-panel-tab="'+w+'"]'); }
    function clearSettle(){ if(settleTimer){ clearTimeout(settleTimer); settleTimer=null; } }
    function resetTabFill(){
      panel.classList.remove('tabs-dragging');
      var n=tabBtn('notice'), d=tabBtn('documents');
      if(n) n.style.removeProperty('--swipe-p'); if(d) d.style.removeProperty('--swipe-p');
      tabs.forEach(function(b){ var on=b.getAttribute('data-panel-tab')===(RP.current||'notice'); b.classList.toggle('active',on); b.setAttribute('aria-selected',on?'true':'false'); });
    }
    function resetSlider(){ clearSettle(); slider.style.transition=''; slider.style.transform=''; void slider.offsetWidth; lockViewport(); resetTabFill(); }
    function updateTabFill(cur,dragDx,limit){
      if(!limit) return;
      var p=clamp(Math.abs(dragDx)/limit,0,1), toward=null;
      if(cur==='notice'&&dragDx<0) toward='documents'; if(cur==='documents'&&dragDx>0) toward='notice';
      var n=tabBtn('notice'), d=tabBtn('documents'); if(!n||!d) return;
      if(!toward){ n.style.setProperty('--swipe-p',cur==='notice'?'1':'0'); d.style.setProperty('--swipe-p',cur==='documents'?'1':'0'); return; }
      n.style.setProperty('--swipe-p',(cur==='notice'?1-p:p).toFixed(4));
      d.style.setProperty('--swipe-p',(cur==='documents'?1-p:p).toFixed(4));
      var vis=p>=.5?toward:cur;
      tabs.forEach(function(b){ var on=b.getAttribute('data-panel-tab')===vis; b.classList.toggle('active',on); b.setAttribute('aria-selected',on?'true':'false'); });
    }
    panel.addEventListener('touchstart',function(e){
      if(!RP._isOpen||e.touches.length!==1){ tracking=false; return; }
      if(e.target.closest('input, textarea, .doc-menu, .doc-menu-btn, .doc-filter, .doc-search-wrap, .doc-toolbar-scroll, .panel-tab')){ tracking=false; return; }
      clearSettle(); panelW=panel.offsetWidth||360; t0=Date.now(); sx=e.touches[0].clientX; sy=e.touches[0].clientY; dx=0; tracking=true; decided=false; horizontal=false;
    },{passive:true});
    panel.addEventListener('touchmove',function(e){
      if(!tracking) return;
      var t=e.touches[0]; dx=t.clientX-sx; var dy=t.clientY-sy;
      if(!decided){
        if(Math.abs(dx)<8&&Math.abs(dy)<8) return;
        decided=true; horizontal=Math.abs(dx)>Math.abs(dy)*1.15;
        if(horizontal) slider.style.transition='none';
      }
      if(!horizontal) return;
      e.preventDefault();
      var cur=RP.current||'notice', d=dx;
      if(cur==='notice'&&dx>0){ dragPanel(dx); return; }
      if(panelDrag) clearPanelDrag();
      if(cur==='documents'&&d<0) d*=.3;
      var limit=panel.offsetWidth||360; d=clamp(d,-limit,limit);
      slider.style.transform='translateX(calc('+(cur==='documents'?'-50%':'0%')+' + '+d.toFixed(1)+'px))';
      updateTabFill(cur,dx,limit);
    },{passive:false});
    panel.addEventListener('touchend',function(){
      if(!tracking) return;
      var was=horizontal, total=dx; tracking=false; decided=false; horizontal=false; dx=0;
      if(panelDrag){
        var flick=(Date.now()-t0)<300&&total>30;
        if(total>panelW*0.28||flick){
          if(dragRaf){ cancelAnimationFrame(dragRaf); dragRaf=0; }
          panelDrag=false;
          panel.style.transition=''; if(ov){ ov.style.transition=''; }
          void panel.offsetWidth;
          panel.style.transform='';
          if(ov){ ov.style.opacity=''; ov.style.visibility=''; }
          RP.close(); clearSettle();
          settleTimer=setTimeout(resetSlider,480);
        }else{ clearPanelDrag(); resetSlider(); }
        return;
      }
      if(!was) return;
      var cur=RP.current||'notice', target=null;
      if(total<0&&Math.abs(total)>=SWIPE&&cur==='notice') target='documents';
      else if(total>0&&total>=SWIPE&&cur==='documents') target='notice';
      if(target&&target!==cur){
        slider.style.transition=''; slider.style.transform='';
        RP.setTab(target,true); resetTabFill(); lockViewport(); clearSettle();
        settleTimer=setTimeout(function(){ slider.style.transition=''; slider.style.transform=''; lockViewport(); settleTimer=null; },500);
      }else resetSlider();
    },{passive:true});
    panel.addEventListener('touchcancel',function(){ if(panelDrag) clearPanelDrag(); if(!tracking) return; tracking=false; decided=false; horizontal=false; dx=0; resetSlider(); },{passive:true});
  })();

  /* ---------- swipe left on the page: the panel follows the finger ---------- */
  (function(){
    var x0=0,y0=0,t0=0,on=false,lock=false,pdx=0;
    var blocked='input,textarea,select,.editor-sheet,.table-wrap,.quick-notice-row,.right-panel,.sidebar,[contenteditable="true"]';
    function canStart(e){
      if(RP._isOpen||window.innerWidth>=1200) return false;
      var app=$('app'); if(app&&app.hidden) return false;
      var b=document.body.classList;
      if(b.contains('search-open')||b.contains('modal-active')||b.contains('rp-open')) return false;
      var sb=document.querySelector('.sidebar'); if(sb&&sb.classList.contains('active')) return false;
      var ed=$('editor'); if(ed&&ed.classList.contains('open')) return false;
      return !(e.target.closest&&e.target.closest(blocked));
    }
    function clearDrag(){
      panel.classList.remove('dragging'); panel.style.transform='';
      overlay.style.transition=''; overlay.style.opacity=''; overlay.style.visibility='';
    }
    document.addEventListener('touchstart',function(e){
      on=false; lock=false; pdx=0;
      if(!e.touches[0]||!canStart(e)) return;
      x0=e.touches[0].clientX; y0=e.touches[0].clientY; t0=Date.now(); on=true;
    },{passive:true});
    document.addEventListener('touchmove',function(e){
      if(!on) return;
      var t=e.touches[0], mx=t.clientX-x0, my=t.clientY-y0;
      if(!lock){
        if(Math.abs(my)>Math.abs(mx)*1.2&&Math.abs(my)>8){ on=false; return; }
        if(mx>12){ on=false; return; }
        if(mx<-14){ lock=true; if(!S.loaded) load(); } else return;
      }
      pdx=mx;
      var W=panel.offsetWidth||360, p=clamp(-pdx/W,0,1);
      panel.classList.add('dragging'); panel.style.transform='translateX('+(W*(1-p)).toFixed(1)+'px)';
      overlay.style.transition='none'; overlay.style.visibility='visible'; overlay.style.opacity=String(p);
      if(e.cancelable) e.preventDefault();
    },{passive:false});
    function end(){
      if(!on||!lock){ on=false; return; }
      on=false; lock=false;
      var W=panel.offsetWidth||360, p=-pdx/W, fast=(-pdx)/Math.max(1,Date.now()-t0)>.55;
      clearDrag();
      if(p>.28||(fast&&-pdx>40)) RP.open(RP.getLast());
    }
    document.addEventListener('touchend',end,{passive:true});
    document.addEventListener('touchcancel',end,{passive:true});
  })();

  /* ---------- documents toolbar: hides on scroll down, returns on scroll up ---------- */
  (function(){
    var timer=null,last=0;
    docBox.addEventListener('scroll',function(){
      var cur=Math.max(0,docBox.scrollTop); clearTimeout(timer);
      timer=setTimeout(function(){
        var focused=docSearch&&document.activeElement===docSearch;
        if(cur<=80||focused) docBar.classList.remove('is-hidden');
        else if(cur>last+10) docBar.classList.add('is-hidden');
        else if(cur<last-10) docBar.classList.remove('is-hidden');
        last=cur;
      },120);
    },{passive:true});
  })();

  /* ---------- initial load once the dashboard is unlocked; refresh after an editor save ---------- */
  var tries=0, iv=setInterval(function(){
    var app=$('app'); tries++;
    if(app&&!app.hidden){ clearInterval(iv); load(); startRealtime(); }
    else if(tries>60) clearInterval(iv);
  },1000);
  var editorEl=$('editor');
  if(editorEl){
    new MutationObserver(function(){ if(editorEl.getAttribute('aria-hidden')==='true'&&S.loaded) load(); })
      .observe(editorEl,{attributes:true,attributeFilter:['aria-hidden']});
  }
})();
