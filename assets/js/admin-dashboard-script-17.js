/* ===== SUPABASE CONFIG - MUST KEEP SAME PROJECT ===== */
const ADMIN_CONFIG = {
  url: 'https://ikeexzsjsksyhdfflwqe.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZWV4enNqc2tzeWhkZmZsd3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNzM0MDAsImV4cCI6MjEwMDY0OTQwMH0.t4AWEhlEiSyxqdtSuDK_5gA6zRv-45UNpFm86WpViWY',
  rpc: { validate:'admin_validate_session', list:'admin_list_records', save:'admin_save_record', remove:'admin_delete_record', logout:'admin_logout', admins:'admin_list_admins', setRole:'admin_set_admin_role', removeAdmin:'admin_remove_admin' },
  pageSize: 100,
  THEME_KEY: 'psbs_theme',
  THEME_PRESET_KEY: 'psbs_theme_preset',
  RIGHT_PANEL_TAB_KEY: 'psbs_right_panel_tab',
  NOTICE_READ_IDS_KEY: 'psbs_notice_read_ids',
  SWIPE_THRESHOLD: 50,
  PANEL_SWIPE_THRESHOLD: 55
};
const SCHEMAS = {
 notices:{title:'Notices',icon:'ri-megaphone-line',description:'Announcements, school updates and important dates.',fields:[['title','Notice title','text',true],['description','Description','textarea',true],['date','Notice date','date',false],['label','Label / category','select',false,['urgent','event','announcement','achievement','exam','holiday']]]},
 documents:{title:'Documents',icon:'ri-file-paper-2-line',description:'Study resources, forms, circulars and downloadable files.',fields:[['title','Document title','text',true],['subject','Subject','text',false],['file_type','File type','select',true,['PDF','DOC','DOCX','XLS','XLSX','PPT','Image','Other']],['file_url','File name','url',true]]},
 gallery:{title:'Gallery',icon:'ri-image-line',description:'School photos and captions shown in the public gallery.',fields:[['image_url','Image URL','url',true],['caption','Photo caption','text',false],['order','Display order','number',false]]},
 faculty:{title:'Faculty',icon:'ri-graduation-cap-line',description:'Teacher names, subjects, emoji and display order.',fields:[['name','Teacher name','text',true],['subject','Subject / role','text',true],['emoji','Icon / emoji','text',false],['order','Display order','number',false]]},
 calendar_data:{title:'Calendar',icon:'ri-calendar-event-line',description:'Year and month data used by the school calendar page.',fields:[['month_idx','Month index (0-11)','number',true],['year_bs','Bikram Sambat year','number',true],['data','Calendar data (JSON)','json',true]]},
 school_info:{title:'School information',icon:'ri-community-line',description:'School name, motto, address, contacts and statistics.',fields:[['school_name','School name','text',true],['motto','School motto','text',false],['address','Address','text',false],['phone','Phone','tel',false],['email','Email','email',false],['students_count','Student count','number',false],['teachers_count','Teacher count','number',false],['established_year','Established year (B.S.)','number',false],['principal_name','Principal name','text',false],['principal_message','Principal\'s message (leave empty to use the default text)','textarea',false]]},
 profiles:{title:'User profiles',icon:'ri-user-settings-line',description:'Profile approval records.',fields:[['full_name','Full name','text',false],['email','Email','email',false],['role','Role','text',false],['is_approved','Approved','checkbox',false]]}
};
const $ = id => document.getElementById(id);
const tokenKey = 'psbs_admin_session_token';
let db, session, identity={}, currentView='overview', currentTable='notices', records=[], editing=null, allProfiles=[], superAdmin=false;
const views=['overview','collection','pending','admins','images'];
const tableNames=Object.keys(SCHEMAS).filter(t=>t!=='profiles');
const escapeHTML=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const Helpers = {
  safeUrl: function(raw){ if(!raw) return ''; try{ const u=new URL(String(raw).trim(), window.location.href); return (u.protocol==='https:'||u.protocol==='http:')?u.href:''; }catch(e){ return ''; } },
  sanitize: function(input){ const map={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;','/':'&#x2F;'}; return String(input==null?'':input).replace(/[&<>\"'\/]/g,s=>map[s]||s); },
  initials: function(name){ if(!name) return 'U'; const parts=name.trim().split(' '); let init=''; for(let i=0;i<Math.min(parts.length,2);i++) init+=parts[i].charAt(0).toUpperCase(); return init||'U'; },
  colorFromName: function(name){ const colors=['#f39c12','#06b6d4','#e85d75','#4f46e5','#e74c3c','#e11d48','#27ae9e','#f1c40f']; let sum=0; const str=String(name); for(let i=0;i<str.length;i++) sum+=str.charCodeAt(i); return colors[sum%colors.length]; },
  debounce: function(func,wait){ let timeout; return function(){ const ctx=this,args=arguments; clearTimeout(timeout); timeout=setTimeout(()=>func.apply(ctx,args),wait); }; },
  formatDate: function(dateStr){ try{ const d=new Date(dateStr); if(isNaN(d.getTime())) return dateStr||''; return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }catch(e){ return dateStr||''; } },
  timeAgo: function(dateStr){ const then=new Date(dateStr).getTime(); if(isNaN(then)) return ''; const diff=Math.floor((Date.now()-then)/1000); if(diff<60) return 'just now'; if(diff<3600) return Math.floor(diff/60)+'m ago'; if(diff<86400) return Math.floor(diff/3600)+'h ago'; if(diff<604800) return Math.floor(diff/86400)+'d ago'; return new Date(dateStr).toLocaleDateString(); },
  clamp: function(v,min,max){ return Math.max(min,Math.min(max,v)); },
  vibrate: function(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms||8); }catch(e){} },
  getTheme: function(){ return localStorage.getItem(ADMIN_CONFIG.THEME_KEY)||'light'; },
  applyTheme: function(){
    const isDark = this.getTheme()==='dark';
    document.body.classList.toggle('dark', isDark);
    const btn=document.getElementById('headerThemeToggleBtn');
    if(btn){ const icon=btn.querySelector('i'); if(icon) icon.className = isDark?'ri-sun-line':'ri-moon-line'; }
    return isDark;
  },
  toggleDark: function(){
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem(ADMIN_CONFIG.THEME_KEY, isDark?'dark':'light');
    const btn=document.getElementById('headerThemeToggleBtn');
    if(btn){ const icon=btn.querySelector('i'); if(icon) icon.className = isDark?'ri-sun-line':'ri-moon-line'; }
    return isDark;
  },
  getThemePreset: function(){ return localStorage.getItem(ADMIN_CONFIG.THEME_PRESET_KEY)||'gold'; },
  setThemePreset: function(preset){
    document.body.className = document.body.className.split(' ').filter(c=>!c.startsWith('theme-')).join(' ');
    if(preset && preset!=='default' && preset!=='gold'){ document.body.classList.add('theme-'+preset); }
    localStorage.setItem(ADMIN_CONFIG.THEME_PRESET_KEY, preset);
    const meta=document.querySelector('meta[name="theme-color"]');
    const colorMap={ gold:'#f39c12', cyan:'#06b6d4', coral:'#e85d75', indigo:'#4f46e5', red:'#e74c3c', rose:'#e11d48', teal:'#27ae9e', yellow:'#f1c40f' };
    if(meta && colorMap[preset]) meta.setAttribute('content', colorMap[preset]);
    return preset;
  },
  sharePage: function(){
    const url = window.location.href;
    const title = 'PSBS Admin Studio';
    const text = 'Pabitra Secondary Boarding School Admin Dashboard';
    if(navigator.share){
      navigator.share({title, text, url}).catch(()=>{});
    } else if(navigator.clipboard){
      navigator.clipboard.writeText(url).then(()=>{ Toast.show('Link copied to clipboard! 📋','success'); }).catch(()=>{ Toast.show('Share: '+url,'info'); });
    } else {
      Toast.show('Share: '+url,'info');
    }
  }
};
const Toast = {
  _timeout:null, _queue:[], _isShowing:false,
  show: function(message,type,duration){
    type=type||'success'; duration=duration||3200;
    this._queue.push({message,type,duration});
    if(!this._isShowing) this._processQueue();
  },
  _processQueue: function(){
    if(this._queue.length===0){ this._isShowing=false; return; }
    this._isShowing=true;
    const {message,type,duration}=this._queue.shift();
    this._display(message,type,duration);
  },
  _display: function(message,type,duration){
    const toastEl=document.getElementById('toast');
    if(!toastEl){ this._isShowing=false; return; }
    const msgEl=toastEl.querySelector('.toast-message');
    const iconEl=toastEl.querySelector('.toast-icon');
    const icons={success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
    if(msgEl) msgEl.textContent=message;
    toastEl.className='toast toast-'+type;
    if(iconEl) iconEl.textContent=icons[type]||icons.info;
    toastEl.classList.add('active');
    clearTimeout(this._timeout);
    const closeBtn=toastEl.querySelector('.toast-close');
    if(closeBtn) closeBtn.onclick=()=>{ this.hide(); };
    this._timeout=setTimeout(()=>{ toastEl.classList.remove('active'); setTimeout(()=>this._processQueue(),300); },duration);
  },
  hide: function(){
    const toastEl=document.getElementById('toast');
    if(toastEl) toastEl.classList.remove('active');
    clearTimeout(this._timeout);
    setTimeout(()=>this._processQueue(),300);
  }
};
function showBanner(msg,type='info'){
  const n=$('notice');
  if(!n) return;
  n.textContent=msg;
  n.className='notice show '+(type==='error'?'err':type==='success'?'ok':'info');
  window.clearTimeout(showBanner._t);
  showBanner._t=setTimeout(()=>n.classList.remove('show'),6500);
}
const DOM = {
  sidebar: $('sidebar'),
  sidebarOverlay: $('sidebarOverlay'),
  overlay: $('overlay'),
  menuBtn: document.querySelector('.menu-btn'),
  sidebarClose: document.querySelector('.sidebar-close'),
  searchOverlay: $('searchOverlay'),
  searchInput: $('searchInput'),
  searchResults: $('searchResults'),
  searchClearBtn: $('searchClearBtn'),
  headerSearchBtn: $('headerSearchBtn'),
  headerThemeToggleBtn: $('headerThemeToggleBtn'),
  headerThemePresetsBtn: $('headerThemePresetsBtn'),
  themePresetsModal: $('themePresetsModal'),
  themePresetsGrid: $('themePresetsGrid'),
  themePresetsCloseBtn: $('themePresetsCloseBtn'),
  themePresetsApplyBtn: $('themePresetsApplyBtn'),
  profileBtn: $('headerProfileBtn'),
  profileDropdown: $('profileDropdown'),
  noticeBtn: $('noticeHeadBtn'),
  dragTrail: $('dragTrail'),
  edgeHintLeft: $('edgeHintLeft'),
  edgeHintRight: $('edgeHintRight'),
  quickCards: $('quickCards')
};
const State = {
  isSidebarOpen:false,
  isDropdownOpen:false,
  isSearchOpen:false,
  isThemePresetsOpen:false,
  panelOpen:false,
  touchStartX:0, touchStartY:0, touchCurrentX:0, touchCurrentY:0,
  isDragging:false, isDraggingSidebar:false,
  verticalSwipeLock:false,
  openCount:0,
  themePreset: Helpers.getThemePreset()
};
function openSidebar(){
  if(State.panelOpen && !State.isSidebarOpen) return;
  closeAllPanels(['sidebar']);
  if(DOM.sidebar) DOM.sidebar.classList.add('active');
  if(DOM.sidebarOverlay) DOM.sidebarOverlay.classList.add('active');
  if(DOM.overlay) DOM.overlay.classList.add('open');
  if(DOM.menuBtn) DOM.menuBtn.setAttribute('aria-expanded','true');
  State.isSidebarOpen=true;
  State.panelOpen=true;
  State.openCount++;
  requestAnimationFrame(function(){ if(!State.isSidebarOpen) return; document.body.style.overflow='hidden'; document.body.classList.add('sidebar-active'); });
}
function closeSidebar(){
  if(DOM.sidebar) DOM.sidebar.classList.remove('active');
  if(DOM.sidebar){ DOM.sidebar.style.transform=''; DOM.sidebar.style.transition=''; DOM.sidebar.style.opacity=''; DOM.sidebar.style.borderRadius=''; }
  if(DOM.sidebarOverlay){ DOM.sidebarOverlay.classList.remove('active'); DOM.sidebarOverlay.style.opacity=''; DOM.sidebarOverlay.style.visibility=''; }
  if(DOM.overlay) DOM.overlay.classList.remove('open');
  if(DOM.menuBtn) DOM.menuBtn.setAttribute('aria-expanded','false');
  State.isSidebarOpen=false;
  State.panelOpen=false;
  document.body.classList.remove('sidebar-active');
  if(State.openCount>0) State.openCount--;
  if(!State.isDropdownOpen && !State.isSearchOpen && !State.isThemePresetsOpen){
    document.body.style.overflow='';
  }
}
function closeMenu(){ closeSidebar(); }
if(DOM.menuBtn) DOM.menuBtn.addEventListener('click', ()=>{ State.isSidebarOpen?closeSidebar():openSidebar(); });
if(DOM.sidebarClose) DOM.sidebarClose.addEventListener('click', closeSidebar);
if(DOM.sidebarOverlay) DOM.sidebarOverlay.addEventListener('click', closeAllPanels);
if(DOM.overlay) DOM.overlay.addEventListener('click', closeAllPanels);
function closeAllPanels(except){ except=Array.isArray(except)?except:[];
  if(!except.includes('sidebar')) closeSidebar();
  if(!except.includes('dropdown')) closeProfileDropdown();
  if(!except.includes('search')) closeSearch();
  if(!except.includes('themePresets')) closeThemePresets();
}
function toggleProfileDropdown(e){
  if(e) e.stopPropagation();
  const isOpen = DOM.profileDropdown && DOM.profileDropdown.classList.contains('active');
  if(!isOpen){
    closeAllPanels(['dropdown']);
    if(DOM.profileDropdown) DOM.profileDropdown.classList.add('active');
    if(DOM.profileBtn) DOM.profileBtn.setAttribute('aria-expanded','true');
    State.isDropdownOpen=true;
    State.panelOpen=true;
    State.openCount++;
    document.body.classList.add('dropdown-active');
  } else {
    closeProfileDropdown();
  }
}
function closeProfileDropdown(){
  if(DOM.profileDropdown) DOM.profileDropdown.classList.remove('active');
  if(DOM.profileBtn) DOM.profileBtn.setAttribute('aria-expanded','false');
  State.isDropdownOpen=false;
  State.panelOpen=false;
  document.body.classList.remove('dropdown-active');
  if(!State.isSidebarOpen && !State.isSearchOpen && !State.isThemePresetsOpen){
    document.body.style.overflow='';
  }
  if(State.openCount>0) State.openCount--;
}
if(DOM.profileBtn) DOM.profileBtn.addEventListener('click', toggleProfileDropdown);
/* First outside interaction closes the dropdown (and is swallowed); the next gesture can scroll. Same rules as the index page. */
var headerProfileOutsideTap=false, headerProfileTouchPending=false;
function inHdrProfile(t){ return (DOM.profileDropdown&&DOM.profileDropdown.contains(t))||(DOM.profileBtn&&DOM.profileBtn.contains(t)); }
document.addEventListener('pointerdown',function(e){
  if(!State.isDropdownOpen) return;
  if(e.pointerType==='touch'){ headerProfileTouchPending=!inHdrProfile(e.target); return; }
  if(inHdrProfile(e.target)) return;
  headerProfileOutsideTap=true; setTimeout(function(){headerProfileOutsideTap=false;},700);
  e.preventDefault(); closeProfileDropdown();
},true);
document.addEventListener('touchmove',function(){
  if(!headerProfileTouchPending||!State.isDropdownOpen) return;
  headerProfileTouchPending=false; closeProfileDropdown();   /* close first, the same swipe keeps scrolling */
},{capture:true,passive:true});
document.addEventListener('touchend',function(e){
  if(headerProfileTouchPending&&State.isDropdownOpen){
    headerProfileOutsideTap=true; setTimeout(function(){headerProfileOutsideTap=false;},700);
    if(e.cancelable) e.preventDefault();
    closeProfileDropdown();
  }
  headerProfileTouchPending=false;
},{capture:true,passive:false});
document.addEventListener('click',function(e){
  if(headerProfileOutsideTap){ headerProfileOutsideTap=false; e.preventDefault(); e.stopImmediatePropagation(); return; }
  if(DOM.profileDropdown&&!inHdrProfile(e.target)&&State.isDropdownOpen){ e.preventDefault(); closeProfileDropdown(); }
},true);
document.addEventListener('wheel',function(e){
  if(State.isDropdownOpen&&!(DOM.profileDropdown&&DOM.profileDropdown.contains(e.target))) closeProfileDropdown();
},{capture:true,passive:true});
window.addEventListener('scroll',function(){ if(State.isDropdownOpen) closeProfileDropdown(); },{passive:true});
function openSearch(){
  const ov=DOM.searchOverlay; if(!ov) return;
  if(State.isSearchOpen) return;                      // no double-open glitch
  clearTimeout(ov._closeAnimationTimer);
  ov.classList.remove('is-closing');
  void ov.offsetWidth;                                // crisp restart of the transition
  ov.classList.add('active');
  State.isSearchOpen=true;
  State.panelOpen=true;
  State.openCount++;
  document.body.classList.add('modal-active','search-open');
  document.body.style.overflow='hidden';
  const sbx=ov.querySelector('.search-box'); if(sbx) sbx.classList.remove('has-query');
  renderAdminDefaults();
  // focus after the first frames so the keyboard never competes with the animation
  const isTouch=window.matchMedia&&window.matchMedia('(pointer: coarse)').matches;
  clearTimeout(ov._focusTimer);
  ov._focusTimer=setTimeout(()=>{
    if(!State.isSearchOpen||!DOM.searchInput) return;
    try{ DOM.searchInput.focus({preventScroll:true}); }catch(e){ DOM.searchInput.focus(); }
  }, isTouch?360:90);
}
function closeSearch(){
  const ov=DOM.searchOverlay; if(!ov) return;
  if(!ov.classList.contains('active') && !ov.classList.contains('is-closing')) return;
  clearTimeout(ov._focusTimer);
  try{ if(DOM.searchInput) DOM.searchInput.blur(); }catch(e){}
  ov.classList.add('is-closing');                     // keeps the card visible while it animates out
  void ov.offsetWidth;                                // transition starts from the open state
  ov.classList.remove('active');
  State.isSearchOpen=false;
  State.panelOpen=false;
  const sbx=ov.querySelector('.search-box');
  if(sbx){ void sbx.offsetWidth; sbx.classList.remove('has-query'); }
  if(State.openCount>0) State.openCount--;
  if(!State.isSidebarOpen && !State.isDropdownOpen && !State.isThemePresetsOpen){
    document.body.style.overflow='';
  }
  clearTimeout(ov._closeAnimationTimer);
  ov._closeAnimationTimer=setTimeout(()=>{
    ov.classList.remove('is-closing');
    if(!State.isSearchOpen) document.body.classList.remove('modal-active','search-open');
    if(DOM.searchInput) DOM.searchInput.value='';
  }, 340);
}
if(DOM.searchOverlay){
  DOM.searchOverlay.addEventListener('click', (e)=>{ if(e.target===DOM.searchOverlay) closeSearch(); });
}
if(DOM.headerSearchBtn) DOM.headerSearchBtn.addEventListener('click', ()=>{ State.isSearchOpen?closeSearch():openSearch(); });
if(DOM.searchClearBtn){
  const closeFromBtn = (e)=>{ e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation(); if(!State.isSearchOpen) return; closeSearch(); };
  DOM.searchClearBtn.addEventListener('pointerdown', closeFromBtn, true);
  DOM.searchClearBtn.addEventListener('touchstart', closeFromBtn, {capture:true, passive:false});
  DOM.searchClearBtn.addEventListener('click', closeFromBtn, true);
}
function renderAdminDefaults(){
  const c=DOM.searchResults; if(!c) return;
  const addRec=t=>()=>{ navigate('collection',t); setTimeout(()=>openEditor(null,t),140); };
  const groups=[
    { title:'QUICK ACTIONS', items:[
      {icon:'📢', title:'Add a notice', desc:'Publish an announcement', tag:'New', action:addRec('notices')},
      {icon:'📄', title:'Add a document', desc:'Share a file or resource', tag:'New', action:addRec('documents')},
      {icon:'🖼️', title:'Add gallery photo', desc:'Add a new campus image', tag:'New', action:addRec('gallery')},
      {icon:'👨‍🏫', title:'Add faculty', desc:'Add a teacher or staff member', tag:'New', action:addRec('faculty')}
    ]},
    { title:'JUMP TO', items:[
      {icon:'👥', title:'Pending users', desc:'Review account requests', action:()=>navigate('pending')},
      {icon:'📅', title:'Calendar management', desc:'Edit school calendar data', action:()=>navigate('collection','calendar_data')},
      {icon:'🌐', title:'Public website', desc:'Open the homepage', action:()=>{ psbsGo('index.html'); }}
    ]}
  ];
  const phone=window.matchMedia&&window.matchMedia('(max-width: 767px)').matches;
  const shown=phone?[groups[0]]:groups;               // phones: just the 4 quick actions
  let html='', n=0;
  const flat=[];
  shown.forEach(g=>{
    html+='<div class="search-group-title">'+g.title+'</div>';
    g.items.forEach(it=>{
      html+='<div class="search-result-item" data-idx="'+n+'" style="animation: fadeUp 0.35s '+(n*35)+'ms both;"><span class="sri-icon">'+it.icon+'</span><div class="sri-text"><h4>'+Helpers.sanitize(it.title)+'</h4><p>'+Helpers.sanitize(it.desc)+'</p></div>'+(it.tag?'<span class="sri-tag">'+it.tag+'</span>':'')+'</div>';
      flat.push(it); n++;
    });
  });
  c.innerHTML=html;
  c.querySelectorAll('.search-result-item').forEach(el=>{
    el.addEventListener('click',()=>{ const it=flat[+el.getAttribute('data-idx')]; closeSearch(); if(it&&it.action) setTimeout(()=>{ try{ it.action(); }catch(e){ console.warn(e); } },120); });
  });
}
function getAdminSearchData(){
  const sections=[
    {id:'overview', title:'Dashboard Overview', desc:'Admin overview and quick launch', icon:'📊', action:()=>navigate('overview')},
    {id:'notices', title:'Notices', desc:'Manage school notices and announcements', icon:'📢', action:()=>navigate('collection','notices')},
    {id:'documents', title:'Documents', desc:'Manage downloadable files and resources', icon:'📄', action:()=>navigate('collection','documents')},
    {id:'gallery', title:'Gallery Management', desc:'Manage school photos and gallery', icon:'🖼️', action:()=>navigate('collection','gallery')},
    {id:'faculty', title:'Faculty Management', desc:'Manage teachers and staff', icon:'👨‍🏫', action:()=>navigate('collection','faculty')},
    {id:'calendar_data', title:'Calendar Management', desc:'Manage school calendar data', icon:'📅', action:()=>navigate('collection','calendar_data')},
    {id:'school_info', title:'School Information', desc:'Edit school name, motto, contacts', icon:'🏫', action:()=>navigate('collection','school_info')},
    {id:'pending', title:'Pending Users', desc:'Review and approve user accounts', icon:'👥', action:()=>navigate('pending')},
    {id:'admins', title:'Administrator Management', desc:'View all administrators (super-admin)', icon:'🛡️', action:()=>navigate('admins')},
    {id:'public-home', title:'Public Website - Home', desc:'Open public homepage', icon:'🌐', action:()=>{ psbsGo('index.html'); }},
    {id:'public-calendar', title:'Public Calendar', desc:'Open public calendar page', icon:'🗓️', action:()=>{ psbsGo('calendar.html'); }},
    {id:'public-gallery', title:'Public Gallery', desc:'Open public gallery page', icon:'🖼️', action:()=>{ psbsGo('gallery.html'); }}
  ];
  if(Array.isArray(records) && records.length){
    const recItems = records.slice(0,30).map(r=>{
      const t = recordTitle(currentTable, r);
      const s = recordSummary(currentTable, r).slice(0,60);
      return { id:'rec-'+(r.id||t), title:t, desc: s||('In '+ (SCHEMAS[currentTable]?.title||currentTable)), icon:'📝', action:()=>{ openEditor(r); closeSearch(); } };
    });
    return sections.concat(recItems);
  }
  return sections;
}
function performAdminSearch(query){
  const container=DOM.searchResults;
  if(!container) return;
  const q=query.toLowerCase().trim();
  if(!q){ renderAdminDefaults(); return; }
  const data=getAdminSearchData();
  const results=data.filter(item=> item.title.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q) || item.id.toLowerCase().includes(q) );
  if(results.length===0){
    container.innerHTML='<div class="search-empty">😕 No results found for "'+Helpers.sanitize(q)+'"</div>';
    return;
  }
  let html='';
  results.slice(0,20).forEach((r,i)=>{
    html+='<div class="search-result-item" data-idx="'+i+'" style="animation: fadeUp 0.35s '+(i*40)+'ms both;">';
    html+='<span class="sri-icon">'+r.icon+'</span>';
    html+='<div class="sri-text"><h4>'+Helpers.sanitize(r.title)+'</h4><p>'+Helpers.sanitize(r.desc)+'</p></div>';
    html+='</div>';
  });
  container.innerHTML=html;
  container.querySelectorAll('.search-result-item').forEach((el,idx)=>{
    el.addEventListener('click', ()=>{
      const item=results[idx];
      if(item && item.action){
        closeSearch();
        setTimeout(()=>{ try{ item.action(); }catch(e){ console.warn(e); } }, 100);
      }
    });
  });
}
if(DOM.searchInput){
  DOM.searchInput.addEventListener('input', function(){ performAdminSearch(this.value); });
}
document.addEventListener('keydown', (e)=>{
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); State.isSearchOpen?closeSearch():openSearch(); }
  if(e.key==='Escape'){ if(State.isSearchOpen) closeSearch(); if(State.isSidebarOpen) closeSidebar(); if(State.isDropdownOpen) closeProfileDropdown(); if(State.isThemePresetsOpen) closeThemePresets(); }
});
const THEME_PRESETS = [
  { id: 'gold', label: 'Gold', color: '#f39c12' },
  { id: 'cyan', label: 'Cyan', color: '#06b6d4' },
  { id: 'coral', label: 'Coral', color: '#e85d75' },
  { id: 'indigo', label: 'Indigo', color: '#4f46e5' },
  { id: 'red', label: 'Red', color: '#e74c3c' },
  { id: 'rose', label: 'Rose', color: '#e11d48' },
  { id: 'teal', label: 'Teal', color: '#27ae9e' },
  { id: 'yellow', label: 'Yellow', color: '#f1c40f' }
];
let pendingPreset = Helpers.getThemePreset();
/* Same markup/classes as index.html: .theme-option > .theme-swatch + .theme-name + .theme-check */
function renderThemePresets(){
  const grid = DOM.themePresetsGrid;
  if(!grid) return;
  pendingPreset = Helpers.getThemePreset();
  let html = '';
  THEME_PRESETS.forEach((t,i)=>{
    const active = t.id===pendingPreset ? 'active-theme' : '';
    html += '<div class="theme-option '+active+'" data-theme-id="'+t.id+'" style="animation: fadeUp 0.4s '+(i*35)+'ms both cubic-bezier(0.16,1,0.3,1);">'
      + '<div class="theme-swatch" style="background:'+t.color+';"></div>'
      + '<div class="theme-name">'+t.label+'</div>'
      + '<div class="theme-check"><i class="ri-check-line"></i></div></div>';
  });
  grid.innerHTML = html;
  grid.querySelectorAll('.theme-option').forEach(el=>{
    el.addEventListener('click', ()=>{
      grid.querySelectorAll('.theme-option').forEach(c=>c.classList.remove('active-theme'));
      el.classList.add('active-theme');
      pendingPreset = el.getAttribute('data-theme-id');
    });
  });
}
function openThemePresets(){
  if(!DOM.themePresetsModal) return;
  renderThemePresets();
  DOM.themePresetsModal.classList.add('active');
  State.isThemePresetsOpen=true;
  State.panelOpen=true;
  State.openCount++;
  document.body.classList.add('modal-active');
  document.body.style.overflow='hidden';
}
function closeThemePresets(){
  if(!DOM.themePresetsModal) return;
  DOM.themePresetsModal.classList.remove('active');
  State.isThemePresetsOpen=false;
  State.panelOpen=false;
  document.body.classList.remove('modal-active');
  if(State.openCount>0) State.openCount--;
  if(!State.isSidebarOpen && !State.isDropdownOpen && !State.isSearchOpen){
    document.body.style.overflow='';
  }
}
if(DOM.headerThemePresetsBtn) DOM.headerThemePresetsBtn.addEventListener('click', openThemePresets);
if(DOM.themePresetsCloseBtn) DOM.themePresetsCloseBtn.addEventListener('click', closeThemePresets);
if(DOM.themePresetsApplyBtn) DOM.themePresetsApplyBtn.addEventListener('click', ()=>{
  if(!pendingPreset){ Toast.show('Please select a theme first.','warning'); return; }
  Helpers.setThemePreset(pendingPreset);
  State.themePreset = pendingPreset;
  const found = THEME_PRESETS.find(p=>p.id===pendingPreset);
  Toast.show('🎨 Theme applied: '+(found?found.label:pendingPreset),'success');
  closeThemePresets();
});
if(DOM.themePresetsModal){
  DOM.themePresetsModal.addEventListener('click', (e)=>{ if(e.target===DOM.themePresetsModal) closeThemePresets(); });
}
if(DOM.headerThemeToggleBtn){
  DOM.headerThemeToggleBtn.addEventListener('click', ()=>{
    Helpers.toggleDark();
    Toast.show('Theme switched to '+(document.body.classList.contains('dark')?'dark':'light')+' mode','info');
  });
}
Helpers.applyTheme();
Helpers.setThemePreset(Helpers.getThemePreset());
function initShare(){
  const btns = [document.getElementById('sidebarShareBtn')].filter(Boolean);
  btns.forEach(b=>{ if(b) b.addEventListener('click', ()=>{ Helpers.sharePage(); closeSidebar(); closeProfileDropdown(); }); });
}
initShare();
const Gestures = {
  init: function(){
    document.addEventListener('touchstart', this.onTouchStart.bind(this), {passive:true});
    document.addEventListener('touchmove', this.onTouchMove.bind(this), {passive:false});
    document.addEventListener('touchend', this.onTouchEnd.bind(this), {passive:true});
    document.addEventListener('touchcancel', this.onTouchEnd.bind(this), {passive:true});
  },
  _computeEdgeHint: function(){
    if(!DOM.edgeHintLeft) return;
    const sidebarOpen = DOM.sidebar && DOM.sidebar.classList.contains('active');
    if(DOM.edgeHintLeft){ DOM.edgeHintLeft.classList.remove('show'); DOM.edgeHintLeft.hidden=true; DOM.edgeHintLeft.style.setProperty('display','none','important'); }
    if(DOM.edgeHintRight){ DOM.edgeHintRight.classList.remove('show'); DOM.edgeHintRight.hidden=true; DOM.edgeHintRight.style.setProperty('display','none','important'); }
  },
  onTouchStart: function(e){
    this._computeEdgeHint();
    if(State.isSearchOpen) return;
    const touch=e.touches[0];
    if(!touch) return;
    State.touchBlocked = !!(e.target.closest && e.target.closest('input,textarea,select,.editor-sheet,.table-wrap,.quick-notice-row,.right-panel,.dp-pop,.pk-sheet-ov,[contenteditable="true"]'));
    State.touchStartX=touch.clientX;
    State.touchStartY=touch.clientY;
    State.touchCurrentX=State.touchStartX;
    State.touchCurrentY=State.touchStartY;
    State.isDragging=false;
    State.isDraggingSidebar=false;
    State.verticalSwipeLock=false;
  },
  onTouchMove: function(e){
    if(State.isSearchOpen) return;
    if(State.touchBlocked) return;
    const touch=e.touches[0];
    if(!touch) return;
    State.touchCurrentX=touch.clientX;
    State.touchCurrentY=touch.clientY;
    const deltaX=State.touchCurrentX-State.touchStartX;
    const deltaY=State.touchCurrentY-State.touchStartY;
    if(Math.abs(deltaY) > Math.abs(deltaX)*1.2){ State.verticalSwipeLock=true; return; }
    if(State.verticalSwipeLock) return;
    const isSidebarOpen = DOM.sidebar && DOM.sidebar.classList.contains('active');
    if(!State.isDragging && Math.abs(deltaX)>14){
      State.isDragging=true;
      if(deltaX>0 && !isSidebarOpen) State.isDraggingSidebar=true;
      else if(isSidebarOpen && deltaX<0) State.isDraggingSidebar=true;
      else return;
    }
    if(State.isDraggingSidebar && DOM.sidebar){
      e.preventDefault();
      const W = DOM.sidebar.offsetWidth || 300;
      const base = isSidebarOpen?0:-W;
      const tx = Helpers.clamp(base+deltaX, -W, 0);
      const p = 1 - (Math.abs(tx)/W);
      DOM.sidebar.style.transition='none';
      DOM.sidebar.style.transform='translate3d('+tx+'px,0,0)';
      if(DOM.sidebarOverlay){
        DOM.sidebarOverlay.style.transition='none';
        DOM.sidebarOverlay.style.opacity=String(0.85*p);
        DOM.sidebarOverlay.style.visibility='visible';
        DOM.sidebarOverlay.classList.add('active');
      }
      if(DOM.overlay){
        DOM.overlay.style.opacity=String(0.85*p);
        DOM.overlay.classList.add('open');
      }
      if(DOM.dragTrail){
        DOM.dragTrail.style.left=touch.clientX+'px';
        DOM.dragTrail.style.top=touch.clientY+'px';
        DOM.dragTrail.classList.add('active');
      }
    }
  },
  onTouchEnd: function(e){
    const deltaX = State.touchCurrentX - State.touchStartX;
    const isSidebarOpen = DOM.sidebar && DOM.sidebar.classList.contains('active');
    const wasDraggingSidebar = State.isDraggingSidebar;
    const verticalLock = State.verticalSwipeLock;
    State.isDragging=false; State.isDraggingSidebar=false; State.verticalSwipeLock=false; State.touchBlocked=false;
    if(DOM.dragTrail) DOM.dragTrail.classList.remove('active');
    if(DOM.sidebar){ DOM.sidebar.style.transition=''; DOM.sidebar.style.transform=''; DOM.sidebar.style.opacity=''; DOM.sidebar.style.borderRadius=''; }
    if(DOM.sidebarOverlay){ DOM.sidebarOverlay.style.transition=''; DOM.sidebarOverlay.style.opacity=''; DOM.sidebarOverlay.style.visibility=''; }
    if(DOM.overlay){ DOM.overlay.style.opacity=''; }
    if(verticalLock || !wasDraggingSidebar) { if(!isSidebarOpen){ DOM.sidebarOverlay&&DOM.sidebarOverlay.classList.remove('active'); DOM.overlay&&DOM.overlay.classList.remove('open'); } return; }
    const threshold = ADMIN_CONFIG.SWIPE_THRESHOLD;
    if(!isSidebarOpen && deltaX > threshold) openSidebar();
    else if(isSidebarOpen && deltaX < -threshold) closeSidebar();
    else if(!isSidebarOpen){ DOM.sidebarOverlay&&DOM.sidebarOverlay.classList.remove('active'); DOM.overlay&&DOM.overlay.classList.remove('open'); }
  }
};
Gestures.init();
async function rpc(name,args){
  const {data,error}=await db.rpc(name,args);
  if(error) throw error;
  const v=Array.isArray(data)&&data.length===1?data[0]:data;
  if(v&&v.success===false) throw Error(v.message||'Request rejected');
  return v;
}
function navigate(view,table,fromHistory){
  if(view==='admins' && !superAdmin) view='overview';
  if(table && table!==currentTable){ const se=$('search'); if(se) se.value=''; }   /* a search for one collection must not filter another */
  if(table) currentTable=table;
  currentView=view;
  /* Dashboard section changes stay in-page; device Back returns to the public homepage. */
  views.forEach(v=>{ const el=$('view-'+v); if(el) el.hidden=v!==view; });
  document.querySelectorAll('.sidebar .nav-link').forEach(b=>{
    const dv=b.getAttribute('data-view');
    const dt=b.getAttribute('data-table');
    const active = (dv===view && (!dt || dt===currentTable)) || (view==='collection' && dv==='collection' && dt===currentTable);
    b.classList.toggle('active', !!active);
  });
  closeMenu();
  if(view==='overview') refreshOverview();
  if(view==='collection') loadRecords();
  if(view==='pending') loadPending();
  if(view==='admins') loadAdmins();
  if(view==='images') loadSiteImages();
  window.scrollTo({top:0,behavior:'smooth'});
}
function fieldsFor(t){ return SCHEMAS[t]?.fields||[]; }
function valueFor(row,key){ return row?.[key]===null||row?.[key]===undefined?'':row[key]; }
function recordSummary(t,row){
  if(t==='notices') return row.description||row.date||row.label||'';
  if(t==='documents') return [row.subject,row.file_type,row.file_url].filter(Boolean).join(' · ');
  if(t==='gallery') return row.caption||row.image_url||'';
  if(t==='faculty') return row.subject||'';
  if(t==='calendar_data') return 'B.S. '+(row.year_bs??'—')+' · month index '+(row.month_idx??'—');
  if(t==='school_info') return [row.motto,row.address,row.phone,row.email].filter(Boolean).join(' · ');
  return row.email||'';
}
function recordTitle(t,row){
  if(t==='calendar_data') return 'Calendar · '+(row.year_bs??'')+' / '+(row.month_idx??'');
  if(t==='school_info') return row.school_name||'School information';
  if(t==='gallery') return row.caption||'School photo';
  if(t==='faculty') return row.name||'Faculty member';
  return row.title||row.full_name||row.email||'Untitled record';
}
function iconFor(t){ return SCHEMAS[t]?.icon||'ri-file-list-3-line'; }
const DOC_BASE='https://ikeexzsjsksyhdfflwqe.supabase.co/storage/v1/object/public/documents/';
function docNameFromUrl(u){
  u=String(u||'');
  if(u.indexOf(DOC_BASE)===0){ const r=u.slice(DOC_BASE.length); try{ return decodeURIComponent(r); }catch(e){ return r; } }
  return u;
}
function docUrlFromInput(v){
  v=String(v||'').trim(); if(!v) return '';
  if(/^https?:\/\//i.test(v)) return v;                 /* a full link still works */
  v=v.replace(/^\/+/,'').replace(/^documents\//i,'');
  try{ v=decodeURIComponent(v); }catch(e){}
  return DOC_BASE+v.split('/').map(encodeURIComponent).join('/');
}

/* ============================================================
   FILE PICKERS — upload documents / gallery photos to Supabase Storage
   ============================================================ */
const DOC_BUCKET='documents', GALLERY_BUCKET='images', SITE_BUCKET='images';
const DOC_MAX=25*1024*1024, IMG_MAX=10*1024*1024;
const DOC_EXT=['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv','png','jpg','jpeg','webp','gif'];
const DOC_TYPE_MAP={pdf:'PDF',doc:'DOC',docx:'DOCX',xls:'XLS',xlsx:'XLSX',ppt:'PPT',pptx:'PPT',png:'Image',jpg:'Image',jpeg:'Image',webp:'Image',gif:'Image',txt:'Other',csv:'Other'};
let pickBusy=false;
const MIME_BY_EXT={pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',txt:'text/plain',csv:'text/csv',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif'};
function pkMime(file,name){ const t=file.type; if(t&&t!=='application/octet-stream') return t; return MIME_BY_EXT[pkExt(name||file.name)]||t||'application/octet-stream'; }
const pkEl=(tag,cls,html)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(html!==undefined) e.innerHTML=html; return e; };
const pkExt=n=>{ const m=String(n||'').toLowerCase().match(/\.([a-z0-9]+)(?:\?.*)?$/); return m?m[1]:''; };
const pkBase=p=>String(p||'').split('/').pop();
const pkDir=p=>{ const a=String(p||'').split('/'); a.pop(); return a.join('/'); };
function pkSize(b){ if(!b&&b!==0) return ''; if(b<1024) return b+' B'; if(b<1048576) return (b/1024).toFixed(0)+' KB'; return (b/1048576).toFixed(1)+' MB'; }
function pkSafeName(n){
  const i=n.lastIndexOf('.'), ext=i>0?n.slice(i+1).toLowerCase().replace(/[^a-z0-9]/g,''):'';
  let base=(i>0?n.slice(0,i):n).normalize('NFKD').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-').slice(0,60)||'file';
  return ext?base+'.'+ext:base;
}
function pkSafeFolder(n){ return String(n||'').split('/').map(s=>s.normalize('NFKD').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-')).filter(Boolean).join('/'); }
/* Put a name into a title/caption field, but never overwrite something the admin typed themselves */
function pkAutoFill(el,text){
  if(!el||!text) return;
  if(!el._pkBound){ el._pkBound=1; el.addEventListener('input',e=>{ if(e.isTrusted) el.dataset.auto=''; }); }
  if(el.value.trim() && el.dataset.auto!=='1') return;
  el.value=text; el.dataset.auto='1'; el.dispatchEvent(new Event('input',{bubbles:true}));
}
function pkNiceTitle(n){ return pkBase(n).replace(/\.[^.]+$/,'').replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim().replace(/\b\w/g,c=>c.toUpperCase()); }
async function pkList(bucket,prefix){
  const {data,error}=await db.storage.from(bucket).list(prefix||'',{limit:300,sortBy:{column:'name',order:'asc'}});
  if(error) throw error;
  return (data||[]).filter(x=>x.name!=='.emptyFolderPlaceholder');
}
async function pkUpload(bucket,folder,file,name){
  let n=name;
  for(let i=0;i<2;i++){
    const path=(folder?folder+'/':'')+n;
    const mime=pkMime(file,n), body=(file.type===mime&&file.name===n)?file:new File([file],n,{type:mime});
    const {error}=await db.storage.from(bucket).upload(path,body,{upsert:false,contentType:mime,cacheControl:'31536000'});
    if(!error) return path;
    if(/exist|duplicate|409/i.test(String(error.message||'')+String(error.statusCode||''))){ n=n.replace(/(\.[^.]*)?$/,'-'+Date.now().toString(36)+'$1'); continue; }
    throw error;
  }
  throw new Error('Upload failed');
}
function pkErr(err){
  const m=String(err&&err.message||err||'');
  if(/row-level security|policy|not authorized|403/i.test(m)) return 'Storage is not set up for uploads yet — run supabase_storage_setup.sql once in the Supabase SQL editor.';
  if(/bucket.*not found|404/i.test(m)) return 'Storage bucket not found — run supabase_storage_setup.sql in Supabase.';
  if(/mime|type/i.test(m)) return 'That file type is not allowed by the storage bucket.';
  if(/size|exceed|413/i.test(m)) return 'File is too large for the storage bucket.';
  return 'Upload failed: '+(m||'unknown error');
}
function pkCompress(file,max=1600,q=.85){
  return new Promise(res=>{
    if(!/^image\/(jpeg|png|webp)$/.test(file.type)) return res(file);
    const url=URL.createObjectURL(file), im=new Image();
    im.onload=()=>{
      URL.revokeObjectURL(url);
      const s=Math.min(1,max/Math.max(im.width,im.height));
      if(s===1&&file.size<800*1024) return res(file);
      const w=Math.round(im.width*s), h=Math.round(im.height*s), c=document.createElement('canvas');
      c.width=w; c.height=h; c.getContext('2d').drawImage(im,0,0,w,h);
      const keepAlpha=/^image\/(png|webp)$/.test(file.type);   /* PNG/WebP may be transparent: never flatten them to JPEG (that makes the background black) */
      const outType=keepAlpha?file.type:'image/jpeg', outExt=keepAlpha?(file.type==='image/png'?'.png':'.webp'):'.jpg';
      c.toBlob(b=>{ if(!b||b.size>=file.size) return res(file); res(new File([b],file.name.replace(/\.\w+$/,'')+outExt,{type:outType})); },outType,q);
    };
    im.onerror=()=>{ URL.revokeObjectURL(url); res(file); };
    im.src=url;
  });
}
function pkBusy(panel,on,label){
  pickBusy=on;
  const bar=panel.querySelector('.pk-bar'); if(bar){ bar.hidden=!on; const s=bar.querySelector('small'); if(s) s.textContent=label||'Uploading…'; }
  panel.classList.toggle('is-busy',on);
  panel.querySelectorAll('button').forEach(b=>{ if(!b.dataset.keep) b.disabled=on; });
  const sv=$('saveRecord'); if(sv) sv.disabled=on;
}

/* ----- existing-file browser (bottom sheet) ----- */
function pkBrowse(bucket,startDir,onPick){
  const ov=pkEl('div','pk-sheet-ov'), sh=pkEl('div','pk-sheet'); ov.append(sh);
  let dir=startDir||'', items=[], q='';
  const head=pkEl('div','pk-sheet-head'), up=pkEl('button','pk-icon','<i class="ri-arrow-left-line"></i>'); up.type='button'; up.setAttribute('aria-label','Up one folder');
  const ttl=pkEl('div','pk-sheet-title'), x=pkEl('button','pk-icon','<i class="ri-close-line"></i>'); x.type='button'; x.setAttribute('aria-label','Close');
  head.append(up,ttl,x);
  const sw=pkEl('div','pk-search','<i class="ri-search-line"></i>'), si=pkEl('input'); si.type='search'; si.placeholder='Search in this folder'; sw.append(si);
  const list=pkEl('div','pk-list'); sh.append(head,sw,list);
  const close=()=>{ ov.classList.remove('show'); setTimeout(()=>ov.remove(),220); document.removeEventListener('keydown',esc); };
  const esc=e=>{ if(e.key==='Escape') close(); };
  document.addEventListener('keydown',esc);
  ov.addEventListener('click',e=>{ if(e.target===ov) close(); }); x.onclick=close;
  up.onclick=()=>{ dir=pkDir(dir); load(); };
  si.addEventListener('input',()=>{ q=si.value.trim().toLowerCase(); draw(); });
  function draw(){
    list.replaceChildren();
    const rows=items.filter(i=>!q||i.name.toLowerCase().includes(q));
    if(!rows.length){ list.append(pkEl('div','pk-empty','<i class="ri-folder-open-line"></i><b>'+(q?'No matches':'This folder is empty')+'</b><small>'+(q?'Try another search.':'Upload a file to see it here.')+'</small>')); return; }
    rows.sort((a,b)=>(!a.id===!b.id?a.name.localeCompare(b.name):(!a.id?-1:1)));
    rows.forEach(it=>{
      const isDir=!it.id, ext=pkExt(it.name), b=pkEl('button','pk-row'); b.type='button';
      const ico=isDir?pkEl('span','pk-ico dir','<i class="ri-folder-3-fill"></i>'):pkEl('span','pk-ico',''); if(!isDir){ ico.dataset.k=ext; ico.textContent=(ext||'file').slice(0,4); }
      const tx=pkEl('span','pk-row-text'), nm=pkEl('b'); nm.textContent=it.name;
      const sm=pkEl('small'); sm.textContent=isDir?'Folder':[pkSize(it.metadata&&it.metadata.size),it.updated_at?Helpers.formatDate(it.updated_at):''].filter(Boolean).join(' · ');
      tx.append(nm,sm); b.append(ico,tx,pkEl('i',isDir?'ri-arrow-right-s-line pk-go':'ri-check-line pk-go'));
      b.onclick=()=>{ const p=(dir?dir+'/':'')+it.name; if(isDir){ dir=p; load(); } else { onPick(p,it); close(); } };
      list.append(b);
    });
  }
  async function load(){
    ttl.innerHTML='<b>Choose a file</b><small>'+escapeHTML(bucket+(dir?' / '+dir.replace(/\//g,' / '):''))+'</small>';
    up.style.visibility=dir?'visible':'hidden'; si.value=''; q='';
    list.replaceChildren(pkEl('div','pk-empty','<i class="ri-loader-4-line pk-spin"></i><b>Loading…</b>'));
    try{ items=await pkList(bucket,dir); draw(); }
    catch(err){ list.replaceChildren(pkEl('div','pk-empty','<i class="ri-error-warning-line"></i><b>Could not load files</b><small>'+escapeHTML(pkErr(err))+'</small>')); }
  }
  document.body.append(ov); requestAnimationFrame(()=>ov.classList.add('show')); load();
}

/* ----- documents: folder select + upload + browse ----- */
function mountDocPicker(){
  const fu=$('f_file_url'), ft=$('f_file_type'); if(!fu) return;
  const wrap=fu.closest('.form-field'); wrap.classList.add('full','pk-field');
  const lab=wrap.querySelector('label'); if(lab) lab.textContent='Document file *';
  const hint=wrap.querySelector('.hint'); if(hint) hint.textContent='Pick a folder, then upload from your file manager or choose a file already in storage. You can also type a path like folder/file.pdf.';
  const panel=pkEl('div','pk pk-doc');
  panel.innerHTML=
   '<div class="pk-row2"><div class="pk-sel"><i class="ri-folder-3-line"></i><select id="pkFolder" aria-label="Storage folder"></select></div>'+
   '<button type="button" class="pk-mini" id="pkNewFolder" title="Create new folder"><i class="ri-folder-add-line"></i></button></div>'+
   '<div class="pk-newfolder" hidden><input type="text" id="pkNewFolderInput" placeholder="New folder name, e.g. exam-papers" autocomplete="off" autocapitalize="off"><button type="button" class="pk-mini ok" id="pkNewFolderOk"><i class="ri-check-line"></i></button></div>'+
   '<button type="button" class="pk-drop" id="pkDrop"><span class="pk-drop-ico"><i class="ri-upload-cloud-2-fill"></i></span><span class="pk-drop-text"><b>Choose from file manager</b><small>PDF, Word, Excel, PowerPoint, images · up to 25 MB</small></span></button>'+
   '<button type="button" class="pk-link" id="pkBrowse"><i class="ri-folder-open-line"></i> Browse existing files</button>'+
   '<div class="pk-bar" hidden><span></span><small>Uploading…</small></div>'+
   '<div class="pk-chip" hidden><span class="pk-ico"></span><span class="pk-chip-text"><b></b><small></small></span><a class="pk-icon" id="pkOpen" target="_blank" rel="noopener" aria-label="Open file"><i class="ri-external-link-line"></i></a><button type="button" class="pk-icon" id="pkClear" aria-label="Remove file"><i class="ri-close-line"></i></button></div>';
  wrap.insertBefore(panel,fu);
  { const grid=wrap.parentElement; if(grid&&grid.firstElementChild!==wrap) grid.insertBefore(wrap,grid.firstElementChild); } /* file card first, like the photo picker */
  let uploadedPath='';
  const fileIn=pkEl('input'); fileIn.type='file'; fileIn.hidden=true;
  panel.append(fileIn);
  const sel=panel.querySelector('#pkFolder'), chip=panel.querySelector('.pk-chip');
  const nf=panel.querySelector('.pk-newfolder'), nfi=panel.querySelector('#pkNewFolderInput');
  fu.classList.add('pk-path'); fu.placeholder='folder/example.pdf';

  function addOpt(v,sel_){ if([...sel.options].some(o=>o.value===v)) { if(sel_) sel.value=v; return; } const o=pkEl('option'); o.value=v; o.textContent='📁 '+v; sel.append(o); if(sel_) sel.value=v; }
  function setRoot(){ sel.replaceChildren(); const o=pkEl('option'); o.value=''; o.textContent='📂 Documents (main folder)'; sel.append(o); }
  setRoot();
  pkList(DOC_BUCKET,'').then(a=>{ const cur=sel.value; a.filter(x=>!x.id).forEach(f=>addOpt(f.name,false)); sel.value=cur; syncFromPath(); }).catch(()=>{});
  function showChip(){
    const p=fu.value.trim(); if(!p){ chip.hidden=true; return; }
    const ext=pkExt(p), ic=chip.querySelector('.pk-ico'); ic.dataset.k=ext; ic.textContent=(ext||'file').slice(0,4);
    chip.querySelector('b').textContent=pkBase(p); chip.querySelector('small').textContent=pkDir(p)?'Folder: '+pkDir(p):'Main documents folder'; chip.hidden=false;
    const o=chip.querySelector('#pkOpen'); if(o) o.href=Helpers.safeUrl(docUrlFromInput(p))||'#';
  }
  function syncFromPath(){ const d=pkDir(fu.value.trim()); if(/^https?:/i.test(fu.value)) return; if(d) addOpt(d,true); else sel.value=''; showChip(); }
  function setPath(p,size){
    fu.value=p; fu.dispatchEvent(new Event('input',{bubbles:true}));
    const ext=pkExt(p); if(ft&&DOC_TYPE_MAP[ext]){ ft.value=DOC_TYPE_MAP[ext]; ft.dataset.auto='1'; }
    pkAutoFill($('f_title'),pkNiceTitle(p));
    syncFromPath(); if(size) chip.querySelector('small').textContent+=' · '+pkSize(size);
  }
  sel.addEventListener('change',(ev)=>{
    const cur=fu.value.trim(), b=pkBase(cur);
    if(b&&!/^https?:/i.test(cur)){
      if(cur&&cur===uploadedPath){ /* file already lives in its folder: the new choice applies to the NEXT upload */
        if(ev&&ev.isTrusted) Toast.show('This file stays in “'+(pkDir(cur)||'main folder')+'”. The selected folder is used for your next upload.','info');
        showChip(); return;
      }
      fu.value=(sel.value?sel.value+'/':'')+b;
    }
    showChip();
  });
  fu.addEventListener('input',()=>{ if(!pickBusy) syncFromPath(); });
  panel.querySelector('#pkNewFolder').onclick=()=>{ nf.hidden=!nf.hidden; if(!nf.hidden) nfi.focus(); };
  const okFolder=()=>{ const f=pkSafeFolder(nfi.value); if(!f){ Toast.show('Enter a folder name','error'); return; } addOpt(f,true); nfi.value=''; nf.hidden=true; sel.dispatchEvent(new Event('change')); Toast.show('Folder “'+f+'” ready — it is created when you upload','success'); };
  panel.querySelector('#pkNewFolderOk').onclick=okFolder;
  nfi.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); okFolder(); } });
  panel.querySelector('#pkClear').onclick=()=>{ fu.value=''; chip.hidden=true; };
  panel.querySelector('#pkBrowse').onclick=()=>pkBrowse(DOC_BUCKET,sel.value,(p,it)=>setPath(p,it&&it.metadata&&it.metadata.size));
  panel.querySelector('#pkDrop').onclick=()=>fileIn.click();
  fileIn.addEventListener('change',async()=>{
    const f=fileIn.files&&fileIn.files[0]; fileIn.value=''; if(!f) return;
    const ext=pkExt(f.name);
    if(!DOC_EXT.includes(ext)&&!/^image\//.test(f.type)){ Toast.show('This file type is not supported','error'); return; }
    if(f.size>DOC_MAX){ Toast.show('File is larger than 25 MB','error'); return; }
    pkBusy(panel,true,'Uploading '+f.name+'…');
    try{
      const path=await pkUpload(DOC_BUCKET,sel.value,f,pkSafeName(f.name));
      uploadedPath=path; setPath(path,f.size); Toast.show('File uploaded ✨','success');
      /* best-effort check that the object is publicly reachable at the exact folder path we will save */
      try{ const chk=await fetch(docUrlFromInput(path),{method:'HEAD',cache:'no-store'}); if(!chk.ok) Toast.show('Uploaded, but the public link did not respond ('+chk.status+'). Check the storage bucket is public.','warning'); }catch(_){}
    }catch(err){ console.error('[doc upload]',err); Toast.show(pkErr(err),'error'); showBanner(pkErr(err),'error'); }
    finally{ pkBusy(panel,false); }
  });
  syncFromPath();
}

/* ----- gallery: pick from phone gallery / camera ----- */
function mountGalleryPicker(){
  const iu=$('f_image_url'); if(!iu) return;
  const wrap=iu.closest('.form-field'); wrap.classList.add('full','pk-field');
  const lab=wrap.querySelector('label'); if(lab) lab.textContent='Photo *';
  const hint=wrap.querySelector('.hint'); if(hint) hint.textContent='Choose a photo from your phone gallery or take a new one. Large photos are resized automatically. You can also paste an image link.';
  const panel=pkEl('div','pk pk-gal');
  panel.innerHTML=
   '<div class="pk-preview"><img alt="" hidden><div class="pk-ph"><i class="ri-image-add-line"></i><span>No photo selected</span><small>Tap to choose a photo, or drop one here</small></div></div>'+
   '<div class="pk-gbtns"><button type="button" class="pk-btn primary" id="pkGalPick"><i class="ri-gallery-line"></i> Choose from gallery</button>'+
   '<button type="button" class="pk-btn" id="pkGalCam"><i class="ri-camera-3-line"></i> Take photo</button>'+
   '<button type="button" class="pk-btn" id="pkGalRep" hidden><i class="ri-refresh-line"></i> Replace this photo (same link)</button>'+
   '<button type="button" class="pk-btn danger" id="pkGalClear" hidden><i class="ri-delete-bin-6-line"></i></button></div>'+
   '<div class="pk-bar" hidden><span></span><small>Uploading…</small></div>';
  wrap.insertBefore(panel,iu);
  const mk=cam=>{ const i=pkEl('input'); i.type='file'; i.accept='image/*'; if(cam) i.setAttribute('capture','environment'); i.hidden=true; panel.append(i); return i; };
  const pick=mk(false), cam=mk(true), rep=mk(false);
  const img=panel.querySelector('img'), ph=panel.querySelector('.pk-ph'), clr=panel.querySelector('#pkGalClear');
  iu.classList.add('pk-path'); iu.placeholder='https://… (or use the buttons above)';
  function preview(){
    const u=Helpers.safeUrl(iu.value);
    if(u){ img.src=u; img.hidden=false; ph.hidden=true; clr.hidden=false; img.onerror=()=>{ img.hidden=true; ph.hidden=false; ph.querySelector('span').textContent='Preview unavailable'; }; }
    else { img.hidden=true; img.removeAttribute('src'); ph.hidden=false; ph.querySelector('span').textContent='No photo selected'; clr.hidden=true; }
  }
  iu.addEventListener('input',preview); preview();
  clr.onclick=()=>{ iu.value=''; preview(); };
  panel.querySelector('#pkGalPick').onclick=()=>pick.click();
  panel.querySelector('#pkGalCam').onclick=()=>cam.click();
  async function handle(inp){ const f0=inp.files&&inp.files[0]; inp.value=''; return handleFile(f0); }
  async function handleFile(f0){
    if(!f0) return;
    if(!/^image\//.test(f0.type)&&!/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f0.name)){ Toast.show('Please choose an image','error'); return; }
    if(f0.size>40*1024*1024){ Toast.show('Image is too large','error'); return; }
    pkBusy(panel,true,'Preparing photo…');
    try{
      const f=await pkCompress(f0);
      if(f.size>IMG_MAX) throw new Error('Image is still over 10 MB after resizing — choose a smaller one.');
      const d=new Date(), folder=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      pkBusy(panel,true,'Uploading photo…');
      const path=await pkUpload(GALLERY_BUCKET,'gallery/'+folder,f,Date.now().toString(36)+'-'+pkSafeName(f.name));
      iu.value=db.storage.from(GALLERY_BUCKET).getPublicUrl(path).data.publicUrl;
      pkAutoFill($('f_caption'),pkNiceTitle(f0.name));   /* file name becomes the caption (admin can change it) */
      preview(); Toast.show('Photo uploaded ✨','success');
    }catch(err){ console.error('[gallery upload]',err); Toast.show(pkErr(err),'error'); showBanner(pkErr(err),'error'); }
    finally{ pkBusy(panel,false); }
  }
  pick.addEventListener('change',()=>handle(pick)); cam.addEventListener('change',()=>handle(cam));
  /* empty photo area = tap to open the gallery + drag & drop (only while there is no image) */
  const box=panel.querySelector('.pk-preview');
  box.setAttribute('role','button'); box.setAttribute('tabindex','0'); box.setAttribute('aria-label','Choose a photo');
  const hasImg=()=>!img.hidden;
  const syncBox=()=>{ box.classList.toggle('pk-empty',!hasImg()); box.tabIndex=hasImg()?-1:0; };
  new MutationObserver(syncBox).observe(img,{attributes:true,attributeFilter:['hidden','src']}); syncBox();
  box.addEventListener('click',()=>{ if(!hasImg()) pick.click(); });
  box.addEventListener('keydown',e=>{ if(!hasImg()&&(e.key==='Enter'||e.key===' ')){ e.preventDefault(); pick.click(); } });
  ['dragenter','dragover'].forEach(ev=>box.addEventListener(ev,e=>{ if(hasImg()) return; e.preventDefault(); box.classList.add('pk-drag'); }));
  ['dragleave','dragend'].forEach(ev=>box.addEventListener(ev,()=>box.classList.remove('pk-drag')));
  box.addEventListener('drop',e=>{ if(hasImg()) return; e.preventDefault(); box.classList.remove('pk-drag');
    const f=[...(e.dataTransfer&&e.dataTransfer.files||[])].find(x=>/^image\//.test(x.type)||/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(x.name));
    if(f) handleFile(f); else Toast.show('Please drop an image','error'); });
  /* Replace: overwrite the SAME storage file so the link/file name never changes */
  const repBtn=panel.querySelector('#pkGalRep');
  function parseStorage(u){ const m=String(u||'').match(/\/storage\/v1\/object\/public\/([^/]+)\/([^?#]+)/); return m?{bucket:m[1],path:decodeURIComponent(m[2])}:null; }
  function syncRep(){ if(repBtn) repBtn.hidden=!parseStorage(iu.value); }
  iu.addEventListener('input',syncRep); setTimeout(syncRep,0);
  repBtn.onclick=()=>rep.click();
  rep.addEventListener('change',async()=>{
    const f0=rep.files&&rep.files[0]; rep.value=''; if(!f0) return;
    const loc=parseStorage(iu.value); if(!loc){ Toast.show('This photo is not in storage, so it cannot be replaced','error'); return; }
    if(!/^image\//.test(f0.type)){ Toast.show('Please choose an image','error'); return; }
    pkBusy(panel,true,'Replacing photo…');
    try{
      const f=await pkCompress(f0);
      if(f.size>IMG_MAX) throw new Error('Image is still over 10 MB after resizing — choose a smaller one.');
      const mime=pkMime(f,f.name);
      const {error}=await db.storage.from(loc.bucket).upload(loc.path,f,{upsert:true,contentType:mime,cacheControl:'60'});
      if(error) throw error;
      const base=db.storage.from(loc.bucket).getPublicUrl(loc.path).data.publicUrl;
      iu.value=base+'?v='+Date.now(); preview(); syncRep();
      Toast.show('Photo replaced ✨ Press Save to publish','success');
    }catch(err){ console.error('[gallery replace]',err); Toast.show(pkErr(err),'error'); showBanner(pkErr(err),'error'); }
    finally{ pkBusy(panel,false); }
  });
}
/* ----- Site images: fixed names, replace in place ----- */
const SITE_SLOTS=[
  {key:'logo',title:'School logo',note:'Shown in the header, menu and footer.'},
  {key:'school',title:'School / campus photo',note:'Shown in the About section.'},
  {key:'principal',title:'Principal photo',note:'Shown in the principal message.'}
];
function siteUrl(key){ return db.storage.from(SITE_BUCKET).getPublicUrl('site/'+key).data.publicUrl; }
function loadSiteImages(){
  const box=$('siteImages'); if(!box) return;
  box.innerHTML='';
  SITE_SLOTS.forEach(sl=>{
    const card=pkEl('div','si-card');
    card.innerHTML='<div class="si-prev"><span>Loading…</span></div><div><h3></h3><p></p></div>'+
      '<button type="button" class="pk-btn primary"><i class="ri-upload-2-line"></i> <span>Upload / replace</span></button>';
    card.querySelector('h3').textContent=sl.title; card.querySelector('p').textContent=sl.note;
    const prev=card.querySelector('.si-prev'), btn=card.querySelector('button'), lab=btn.querySelector('span');
    const inp=pkEl('input'); inp.type='file'; inp.accept='image/*'; inp.hidden=true; card.append(inp);
    function show(){
      const im=new Image();
      im.onload=()=>{ prev.innerHTML=''; prev.append(im); lab.textContent='Replace image'; };
      im.onerror=()=>{ prev.innerHTML='<span>No image uploaded yet</span>'; lab.textContent='Upload image'; };
      im.src=siteUrl(sl.key)+'?t='+Date.now();
    }
    show();
    btn.onclick=()=>inp.click();
    inp.addEventListener('change',async()=>{
      const f0=inp.files&&inp.files[0]; inp.value=''; if(!f0) return;
      if(!/^image\//.test(f0.type)){ Toast.show('Please choose an image','error'); return; }
      card.classList.add('busy'); lab.textContent='Uploading…';
      try{
        const f=await pkCompress(f0,sl.key==='logo'?800:1600);
        if(f.size>IMG_MAX) throw new Error('Image is still over 10 MB after resizing — choose a smaller one.');
        const {error}=await db.storage.from(SITE_BUCKET).upload('site/'+sl.key,f,{upsert:true,contentType:pkMime(f,f.name),cacheControl:'60'});
        if(error) throw error;
        Toast.show(sl.title+' updated ✨','success'); show();
      }catch(err){ console.error('[site image]',err); Toast.show(pkErr(err),'error'); lab.textContent='Upload / replace'; }
      finally{ card.classList.remove('busy'); }
    });
    box.append(card);
  });
}
function mountPickers(){
  pickBusy=false;
  if(currentTable==='documents') mountDocPicker();
  else if(currentTable==='gallery') mountGalleryPicker();
}

const PH_BY_KEY={title:'Title here',description:'Description here',subject:'Subject here',caption:'Caption here',name:'Name here',emoji:'Emoji here, e.g. 👩‍🏫',order:'Next number',school_name:'School name here',motto:'Motto here',address:'Address here',principal_name:'Principal name here',principal_message:'Principal message here',students_count:'Student count here',teachers_count:'Teacher count here',established_year:'Year here, e.g. 2050',month_idx:'0 to 11',year_bs:'Year here, e.g. 2083',full_name:'Full name here',role:'Role here'};
function psbsPlaceholder(key,label){ if(PH_BY_KEY[key]) return PH_BY_KEY[key]; const l=String(label||key).replace(/\s*\(.*?\)\s*/g,' ').replace(/\s+/g,' ').trim(); return l+' here'; }
function psbsOrderFrom(rows){ let max=0; (rows||[]).forEach(r=>{ const n=Number(r&&r.order); if(Number.isFinite(n)&&n>max) max=n; }); return (max>0?max:(rows||[]).length)+1; }   /* last order + 1 (or item count + 1 when nothing has an order yet) */
async function psbsNextOrder(table){
  const token=localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
  const data=await rpc(ADMIN_CONFIG.rpc.list,{p_session_token:token,p_table:table,p_limit:1000});
  return psbsOrderFrom(Array.isArray(data)?data:(data?.records||data?.data||[]));
}
function openEditor(row=null,table=currentTable){
  if(table) currentTable=table;
  editing=row;
  const schema=SCHEMAS[currentTable];
  if(!schema) return;
  $('editorTitle').textContent=(row?'Edit ':'Add ')+schema.title.toLowerCase().replace(/s$/,'');
  $('editorEyebrow').textContent=row?'EDIT EXISTING ITEM':'CREATE A NEW ITEM';
  $('editorDescription').textContent=row?'Update the details, then save your changes.':'Fill in the details below. The form adapts to this content type.';
  $('editorCategoryIcon').innerHTML='<i class="'+schema.icon+'"></i>';
  $('formCollectionName').textContent=schema.title;
  $('formFields').replaceChildren();
  fieldsFor(currentTable).forEach(([key,label,type,required,options])=>{
    const wrap=document.createElement('div');
    wrap.className='form-field'+(type==='textarea'||type==='json'?' full':'');
    const id='f_'+key;
    const lab=document.createElement('label');
    lab.htmlFor=id;
    lab.textContent=label+(required?' *':'');
    let input;
    if(type==='textarea'||type==='json'){
      input=document.createElement('textarea');
      if(type==='json') input.classList.add('json');
      input.spellcheck=false;
    } else if(type==='select'){
      input=document.createElement('select');
      const blank=document.createElement('option'); blank.value=''; blank.textContent='Choose '+label.toLowerCase();
      input.append(blank);
      (options||[]).forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=(currentTable==='notices' && key==='label') ? (v.charAt(0).toUpperCase()+v.slice(1)) : v; input.append(o); });
    } else if(type==='checkbox'){
      input=document.createElement('input'); input.type='checkbox';
    } else {
      input=document.createElement('input'); input.type=(currentTable==='documents'&&key==='file_url')?'text':(type==='number'?'number':type); input.className='field';
    }
    input.id=id; input.name=key;
    if(type==='json'){
      input.placeholder='Paste or edit valid JSON here';
      try{ input.value=JSON.stringify(valueFor(row,key)!==''?valueFor(row,key):{},null,2); }catch{ input.value='{}'; }
    } else if(type==='checkbox'){
      input.checked=!!row?.[key];
    } else {
      input.value=valueFor(row,key);
      if(type==='date' && !row && !input.value){ const t=new Date(); input.value=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'); }
      if(currentTable==='documents'&&key==='file_url'){ input.value=docNameFromUrl(input.value); input.autocapitalize='off'; input.autocomplete='off'; input.spellcheck=false; }
      if(currentTable==='notices' && key==='label' && !['urgent','event','announcement','achievement','exam','holiday'].includes(String(input.value).toLowerCase())) input.value=row ? 'announcement' : 'announcement';
      else if(currentTable==='notices' && key==='label') input.value=String(input.value).toLowerCase();
      if(type==='number') input.step='any';
      if(type==='url') input.placeholder=(currentTable==='documents'&&key==='file_url')?'example.pdf':'https://…';
      if(type==='email') input.placeholder='name@example.com';
      if(type==='tel') input.placeholder='School contact number';
    }
    if(!input.placeholder && type!=='checkbox' && type!=='select' && type!=='date') input.placeholder=psbsPlaceholder(key,label);
    if(required) input.required=true;
    if(type==='checkbox'){ wrap.append(input,lab); }
    else { wrap.append(lab,input); }
    const hints={title:'Use a clear title that visitors can understand quickly.',description:'Write the full message shown to visitors.',date:'Choose the date associated with this update.',label:'Choose a category to help visitors scan the notice.',file_url:'Paste the public URL of the file visitors should open.',image_url:'Paste a direct image URL. A preview appears below when available.',order:'Smaller numbers appear earlier when the website sorts by display order.',month_idx:'Use 0 for the first month, through 11 for the twelfth month.',year_bs:'Enter the Bikram Sambat year used by the calendar.',data:'Keep the calendar data in valid JSON format.'};
    if(type!=='checkbox'&&currentTable==='documents'&&key==='file_url'){
      const hint=document.createElement('span'); hint.className='hint'; hint.textContent='Type only the file name, e.g. example.pdf — the storage link is added automatically.'; wrap.append(hint);
    }
    $('formFields').append(wrap);
  });
  if(currentTable==='documents'){
    const fu=$('f_file_url'), ft=$('f_file_type');
    const map={pdf:'PDF',doc:'DOC',docx:'DOCX',xls:'XLS',xlsx:'XLSX',ppt:'PPT',pptx:'PPT',png:'Image',jpg:'Image',jpeg:'Image',webp:'Image',gif:'Image'};
    if(fu&&ft){
      ft.addEventListener('change',()=>{ ft.dataset.auto=''; });
      fu.addEventListener('input',()=>{
        const ext=fu.value.trim().split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'');
        if(map[ext] && (!ft.value||ft.dataset.auto==='1')){ ft.value=map[ext]; ft.dataset.auto='1'; }
      });
    }
  }
  try{ mountPickers(); }catch(err){ console.error('[picker mount]',err); }
  /* New item: fill "Display order" with the next number so it lands at the end of the list */
  if(!row){
    const oi=$('f_order');
    if(oi){
      const tbl=currentTable, put=n=>{ if(currentTable===tbl && !editing && oi.isConnected && oi.value===''){ oi.value=String(n); oi.dispatchEvent(new Event('input',{bubbles:true})); } };
      if(currentView==='collection' && Array.isArray(records) && records.length) put(psbsOrderFrom(records));   /* instant, from the list on screen */
      psbsNextOrder(tbl).then(n=>{ if(currentTable===tbl && !editing && oi.isConnected && (oi.value===''||oi.dataset.autoOrder==='1')){ oi.value=String(n); oi.dataset.autoOrder='1'; oi.dispatchEvent(new Event('input',{bubbles:true})); } }).catch(()=>{});
      oi.addEventListener('input',e=>{ if(e.isTrusted) oi.dataset.autoOrder=''; });
    }
  }
  $('deleteRecord').hidden=!row;
  $('saveRecord').innerHTML='<i class="ri-check-line"></i> '+(row?'Save changes':'Publish item');
  $('editor').classList.add('open');
  $('editor').setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
  setTimeout(()=>{ $('formFields').querySelector('input,textarea,select')?.focus({preventScroll:true}); },100);
}
function closeEditor(){
  $('editor').classList.remove('open');
  $('editor').setAttribute('aria-hidden','true');
  document.body.style.overflow='';
  editing=null;
}
$('closeEditor')?.addEventListener('click', closeEditor);
$('cancelEditor')?.addEventListener('click', closeEditor);
$('addRecord')?.addEventListener('click', ()=>openEditor());
$('editor')?.addEventListener('click', e=>{ if(e.target===$('editor')) closeEditor(); });
function renderRecords(t,rows,target,emptyEl,editable=true){
  if(!target) return;
  target.replaceChildren();
  if(!rows.length){ if(emptyEl) emptyEl.hidden=false; return; }
  if(emptyEl) emptyEl.hidden=true;
  rows.forEach(row=>{
    const card=document.createElement('article'); card.className='record-card';
    const thumb=document.createElement('div'); thumb.className='record-thumb';
    if(t==='gallery'&&row.image_url){
      const im=document.createElement('img'); im.src=row.image_url; im.alt=row.caption||'Gallery photo'; im.loading='lazy';
      im.onerror=()=>{ thumb.innerHTML='<i class="ri-image-line"></i>'; };
      thumb.append(im);
    } else if(t==='documents'){ const ex=(String(row.file_url||'').split('?')[0].split('.').pop()||'').toLowerCase().replace(/[^a-z0-9]/g,''); thumb.classList.add('doc-thumb'); thumb.innerHTML='<span class="pk-ico lg" data-k="'+escapeHTML(ex)+'">'+escapeHTML((ex||'file').slice(0,4))+'</span>'; } else thumb.innerHTML='<i class="'+iconFor(t)+'"></i>';
    const info=document.createElement('div'); info.className='record-info';
    const b=document.createElement('b'); b.textContent=recordTitle(t,row);
    const p=document.createElement('p'); p.textContent=String(recordSummary(t,row)).slice(0,230);
    const meta=document.createElement('div'); meta.className='record-meta';
    if(row.date){ const tag=document.createElement('span'); tag.className='tag'; tag.textContent=Helpers.formatDate(row.date); meta.append(tag); }
    if(row.label){ const tag=document.createElement('span'); tag.className='tag'; tag.textContent=row.label; meta.append(tag); }
    if(row.file_type){ const tag=document.createElement('span'); tag.className='tag'; tag.textContent=row.file_type; meta.append(tag); }
    info.append(b,p,meta);
    if(editable){
      const actions=document.createElement('div'); actions.className='record-actions';
      const edit=document.createElement('button'); edit.className='btn slim'; edit.innerHTML='<i class="ri-edit-line"></i> Edit';
      edit.onclick=()=>openEditor(row,t);
      const del=document.createElement('button'); del.className='btn slim danger'; del.innerHTML='<i class="ri-delete-bin-line"></i>';
      del.onclick=async()=>{
        if(!confirm('Delete this record? This cannot be undone.')) return;
        try{
          const token=localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
          await rpc(ADMIN_CONFIG.rpc.remove,{p_session_token:token,p_table:t,p_primary_key:'id',p_record_id:String(row.id)});
          showBanner('Record deleted.','success');
          Toast.show('Record deleted','success');
          loadRecords();
        }catch(err){ showBanner(err.message||'Delete failed','error'); Toast.show('Delete failed: '+(err.message||''),'error'); }
      };
      actions.append(edit,del);
      info.append(actions);
    }
    card.append(thumb,info);
    target.append(card);
  });
}
function refreshQuickCards(){
  const container=$('quickCards');
  if(!container) return;
  container.replaceChildren();
  const cards=[
    {table:'notices', title:'Notices', sub:'Announcements & updates', icon:'ri-notification-3-line', color:'243,156,18'},
    {table:'documents', title:'Documents', sub:'Files & resources', icon:'ri-file-paper-2-line', color:'79,70,229'},
    {table:'gallery', title:'Gallery', sub:'Campus photos', icon:'ri-image-line', color:'16,185,129'},
    {table:'faculty', title:'Faculty', sub:'Teachers & staff', icon:'ri-graduation-cap-line', color:'6,182,212'},
    {table:'calendar_data', title:'Calendar', sub:'Events & holidays', icon:'ri-calendar-event-line', color:'139,92,246'},
    {table:'school_info', title:'School Info', sub:'Name, motto & contacts', icon:'ri-community-line', color:'234,88,12'}
  ];
  cards.filter(c=>c.table!=='admins'||superAdmin).forEach(c=>{
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='quick-card ripple-host';
    btn.style.setProperty('--qc', c.color);
    btn.dataset.table=c.table;
    btn.innerHTML='<span class="qc-count" hidden></span><span class="qc-icon" aria-hidden="true"><i class="'+c.icon+'"></i></span><span class="qc-title">'+c.title+'</span><span class="qc-sub">'+c.sub+'</span>';
    btn.onclick=()=>{
      if(c.table==='pending') navigate('pending');
      else if(c.table==='admins') navigate('admins');
      else navigate('collection', c.table);
    };
    container.append(btn);
  });
}
async function loadRecords(){
  const target=$('records'), empty=$('empty'), count=$('recordCount'), searchInput=$('search');
  if(!target) return;
  try{
    if(count) count.textContent='Loading';
    target.replaceChildren();
    if(empty) empty.hidden=true;
    const token=localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
    const data=await rpc(ADMIN_CONFIG.rpc.list,{p_session_token:token,p_table:currentTable,p_limit:ADMIN_CONFIG.pageSize});
    records = Array.isArray(data)?data:(data?.records||data?.data||[]);
    if($('overviewRecords')) $('overviewRecords').textContent = String(records.length);
    const filtered = filterRecords(records, searchInput?.value||'');
    renderRecords(currentTable, filtered, target, empty, true);
    if(count) count.textContent=filtered.length+' record'+(filtered.length===1?'':'s');
    const schema=SCHEMAS[currentTable];
    if(schema){
      if($('collectionEyebrow')) $('collectionEyebrow').textContent='Content management';
      if($('collectionTitle')) $('collectionTitle').textContent=schema.title;
      if($('collectionDescription')) $('collectionDescription').textContent=schema.description;
      if($('recordsHeading')) $('recordsHeading').textContent='Latest '+schema.title.toLowerCase();
    }
  }catch(err){
    console.error(err);
    if(count) count.textContent='Error';
    showBanner(err.message||'Failed to load records','error');
    Toast.show('Failed to load: '+(err.message||''),'error');
  }
}
function filterRecords(rows,q){
  if(!q) return rows;
  const lower=q.toLowerCase();
  return rows.filter(r=> JSON.stringify(r).toLowerCase().includes(lower));
}
$('search')?.addEventListener('input', (e)=>{
  const filtered=filterRecords(records, e.target.value);
  renderRecords(currentTable, filtered, $('records'), $('empty'), true);
  const count=$('recordCount');
  if(count) count.textContent=filtered.length+' record'+(filtered.length===1?'':'s');
});
$('refresh')?.addEventListener('click', loadRecords);
/* Clear (×) button of the records search. Keeps the keyboard open so you can type a new search straight away. */
(function(){
  const s=$('search'), b=$('searchRecClear'); if(!s||!b) return;
  const fire=()=>s.dispatchEvent(new Event('input',{bubbles:true}));
  b.addEventListener('pointerdown',e=>e.preventDefault());
  b.addEventListener('mousedown',e=>e.preventDefault());
  b.addEventListener('click',()=>{ s.value=''; fire(); try{ s.focus({preventScroll:true}); }catch(e){} });
  /* Used by the device Back button: returns true when there was a search to clear */
  window.psbsClearRecordSearch=function(){ if(!s.value) return false; s.value=''; fire(); try{ s.blur(); }catch(e){} return true; };
})();
async function refreshOverview(){
  refreshQuickCards();
  try{
    const token=localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
    const data=await rpc(ADMIN_CONFIG.rpc.list,{p_session_token:token,p_table:'notices',p_limit:5});
    const notices=Array.isArray(data)?data:(data?.records||[]);
    if($('overviewRecords')) $('overviewRecords').textContent = String(notices.length);
  }catch{}
  loadPendingCount();
}
async function loadPendingCount(){
  try{
    const token=localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
    const data=await rpc(ADMIN_CONFIG.rpc.list,{p_session_token:token,p_table:'profiles',p_limit:200});
    const rows=Array.isArray(data)?data:(data?.records||data?.data||[]);
    const pending=rows.filter(r=>!r.is_approved);
    allProfiles=rows;
    const count=pending.length;
    const display = count>99 ? '99+' : String(count);
    if($('overviewPending')) $('overviewPending').textContent = String(count);
    const pbs=$('pendingBadgeSidebar');
    if(pbs){
      pbs.textContent = count===0 ? '0' : display;
      pbs.classList.toggle('has-count', count>0);
      pbs.classList.toggle('is-zero', count===0);
      pbs.setAttribute('data-zero', count===0 ? 'true' : 'false');
      pbs.setAttribute('title', count>0 ? count + ' pending user'+(count>1?'s':'')+' awaiting approval' : 'No pending users');
      pbs.setAttribute('aria-label', count>0 ? count + ' pending' : 'no pending');
    }
  }catch{}
}
async function loadPending(){
  const target=$('pendingList'), empty=$('pendingEmpty');
  if(!target) return;
  try{
    const token=localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
    const data=await rpc(ADMIN_CONFIG.rpc.list,{p_session_token:token,p_table:'profiles',p_limit:200});
    const rows=Array.isArray(data)?data:(data?.records||data?.data||[]);
    const pending=rows.filter(r=>!r.is_approved);
    allProfiles=rows;
    if(!pending.length){ target.replaceChildren(); if(empty) empty.hidden=false; return; }
    if(empty) empty.hidden=true;
    target.replaceChildren();
    pending.forEach(row=>{
      const card=document.createElement('article'); card.className='record-card';
      const thumb=document.createElement('div'); thumb.className='record-thumb'; thumb.innerHTML='<i class="ri-user-follow-line"></i>';
      const info=document.createElement('div'); info.className='record-info';
      const b=document.createElement('b'); b.textContent=row.full_name||row.email||'Pending user';
      const p=document.createElement('p'); p.textContent=(row.email||'')+' · '+(row.role||'Viewer');
      const actions=document.createElement('div'); actions.className='record-actions';
      const approve=document.createElement('button'); approve.className='btn slim primary'; approve.innerHTML='<i class="ri-check-line"></i> Approve';
      approve.onclick=async()=>{
        try{
          const token=localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
          await rpc(ADMIN_CONFIG.rpc.save,{p_session_token:token,p_table:'profiles',p_primary_key:'id',p_record:{is_approved:true},p_is_update:true,p_original_id:String(row.id)});
          showBanner('User approved.','success');
          Toast.show('User approved','success');
          loadPending();
          loadPendingCount();
        }catch(err){ showBanner(err.message||'Approval failed','error'); }
      };
      const reject=document.createElement('button'); reject.className='btn slim danger'; reject.innerHTML='<i class="ri-close-line"></i> Reject';
      reject.onclick=async()=>{
        if(!confirm('Reject and delete this pending user?')) return;
        try{
          const token=localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
          await rpc(ADMIN_CONFIG.rpc.remove,{p_session_token:token,p_table:'profiles',p_primary_key:'id',p_record_id:String(row.id)});
          showBanner('User rejected.','success');
          loadPending();
          loadPendingCount();
        }catch(err){ showBanner(err.message||'Failed','error'); }
      };
      actions.append(approve,reject);
      info.append(b,p,actions);
      card.append(thumb,info);
      target.append(card);
    });
  }catch(err){
    showBanner(err.message||'Failed to load pending users','error');
  }
}
$('refreshPending')?.addEventListener('click', loadPending);
async function adminAction(kind,row){
  const label=row.name||row.email||'this administrator';
  const cfg={
    promote:{tone:undefined,icon:'ri-shield-star-line',title:'Make super admin?',message:'They will be able to manage all administrators, including promoting, demoting and removing them.',okText:'Make super admin',done:'Promoted to super admin.'},
    demote:{tone:undefined,icon:'ri-arrow-down-circle-line',title:'Change to admin?',message:'They will keep their access to the dashboard but lose the ability to manage other administrators.',okText:'Change to admin',done:'Changed to admin.'},
    remove:{tone:'danger',icon:'ri-user-unfollow-line',title:'Remove this administrator?',message:'They will lose access to the dashboard immediately. This cannot be undone.',okText:'Remove',done:'Administrator removed.'}
  }[kind];
  const ok=await psbsDialog({tone:cfg.tone,icon:cfg.icon,title:cfg.title,detail:label+(row.name&&row.email?' · '+row.email:''),message:cfg.message,okText:cfg.okText,cancelText:'Cancel'});
  if(!ok) return;
  try{
    const token=localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
    if(kind==='remove') await rpc(ADMIN_CONFIG.rpc.removeAdmin,{p_token:token,p_admin_id:String(row.id)});
    else await rpc(ADMIN_CONFIG.rpc.setRole,{p_token:token,p_admin_id:String(row.id),p_make_super:kind==='promote'});
    showBanner(cfg.done,'success'); Toast.show(cfg.done,'success');
  }catch(err){
    const m=err.message||'Action failed'; showBanner(m,'error'); Toast.show(m,'error');
  }
  loadAdmins();
}
async function loadAdmins(){
  const target=$('adminsList'), empty=$('adminsEmpty');
  if(!target) return;
  try{
    const token=localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
    const data=await rpc(ADMIN_CONFIG.rpc.admins,{p_token:token});
    const rows=Array.isArray(data)?data:(data?.admins||data?.records||data?.data||[]);
    if(!rows.length){ target.replaceChildren(); if(empty) empty.hidden=false; return; }
    if(empty) empty.hidden=true;
    target.replaceChildren();
    rows.forEach(row=>{
      const isSuper=!!(row.is_super_admin||row.role==='super_admin');
      const card=document.createElement('article'); card.className='record-card';
      const thumb=document.createElement('div'); thumb.className='record-thumb'; thumb.innerHTML=isSuper?'<i class="ri-shield-star-line"></i>':'<i class="ri-shield-user-line"></i>';
      const info=document.createElement('div'); info.className='record-info';
      const b=document.createElement('b'); b.textContent=row.name||row.email||row.username||'Admin';
      const badges=document.createElement('div'); badges.className='admin-badges';
      const rp=document.createElement('span'); rp.className='role-pill'+(isSuper?' super':''); rp.textContent=isSuper?'Super admin':'Admin'; badges.append(rp);
      if(row.is_self){ const y=document.createElement('span'); y.className='you-tag'; y.textContent='You'; badges.append(y); }
      const st=String(row.status||'').toLowerCase();
      const flag=row.is_active===false?'Disabled':(row.is_approved===false||st==='pending')?'Pending approval':(['disabled','inactive','suspended'].includes(st)?'Disabled':'');
      if(flag){ const f=document.createElement('span'); f.className='status-pill'; f.textContent=flag; badges.append(f); }
      const p=document.createElement('p'); p.textContent=(row.name&&row.email?row.email+' · ':'')+'Created: '+(row.created_at?Helpers.formatDate(row.created_at):'—');
      info.append(b,badges,p);
      if(row.is_self){
        const n=document.createElement('div'); n.className='self-note'; n.textContent='This is your account. Ask another super admin to change it.'; info.append(n);
      }else if(row.id!=null){
        const actions=document.createElement('div'); actions.className='record-actions';
        const toggle=document.createElement('button'); toggle.type='button';
        toggle.className='btn slim'+(isSuper?'':' primary');
        toggle.innerHTML=isSuper?'<i class="ri-arrow-down-circle-line"></i> Make admin':'<i class="ri-shield-star-line"></i> Make super admin';
        toggle.onclick=()=>adminAction(isSuper?'demote':'promote',row);
        const rm=document.createElement('button'); rm.type='button'; rm.className='btn slim danger'; rm.innerHTML='<i class="ri-user-unfollow-line"></i> Remove';
        rm.onclick=()=>adminAction('remove',row);
        actions.append(toggle,rm); info.append(actions);
      }
      card.append(thumb,info);
      target.append(card);
    });
  }catch(err){
    console.error('[PSBS Admin Directory] Failed to load administrators:', err);
    const emptyMsg=$('adminsError');
    const message=err?.message||String(err)||'Administrator directory unavailable';
    if(emptyMsg) emptyMsg.textContent=message;
    if(empty) empty.hidden=false;
    target.replaceChildren();
  }
}
$('refreshAdmins')?.addEventListener('click', loadAdmins);
$('recordForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(pickBusy){ Toast.show('Please wait — the upload is still running','info'); return; }
  const formData={};
  fieldsFor(currentTable).forEach(([key,label,type])=>{
    const el=$('f_'+key);
    if(!el) return;
    if(type==='checkbox'){ formData[key]=el.checked; }
    else if(type==='number'){ const v=el.value.trim(); formData[key]= v==='' ? null : Number(v); }
    else if(type==='json'){
      try{ formData[key]=JSON.parse(el.value||'{}'); }
      catch(err){ showBanner('Invalid JSON in '+label+': '+err.message,'error'); throw err; }
    } else {
      formData[key]=el.value.trim();
    }
  });
  if(currentTable==='documents' && formData.file_url!==undefined) formData.file_url=docUrlFromInput(formData.file_url);
  try{
    const token=localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
    $('saveRecord').disabled=true;
    $('saveRecord').innerHTML='<i class="ri-loader-4-line"></i> Saving...';
    const primaryKey='id';
    const payload={p_session_token:token,p_table:currentTable,p_primary_key:primaryKey,p_record:formData,p_is_update:!!(editing && editing.id!==undefined && editing.id!==null),p_original_id:(editing && editing.id!==undefined && editing.id!==null)?String(editing.id):null};
    await rpc(ADMIN_CONFIG.rpc.save,payload);
    showBanner((editing?'Updated':'Created')+' successfully.','success');
    Toast.show((editing?'Updated':'Created')+' successfully','success');
    closeEditor();
    loadRecords();
    refreshOverview();
    try{ window.__psbsReloadPanel&&window.__psbsReloadPanel(); }catch(_){}
  }catch(err){
    showBanner(err.message||'Save failed','error');
    Toast.show('Save failed: '+(err.message||''),'error');
  }finally{
    $('saveRecord').disabled=false;
    $('saveRecord').innerHTML='<i class="ri-check-line"></i> '+(editing?'Save changes':'Publish item');
  }
});
$('deleteRecord')?.addEventListener('click', async ()=>{
  if(!editing || !editing.id) return;
  if(!confirm('Delete this record permanently?')) return;
  try{
    const token=localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
    await rpc(ADMIN_CONFIG.rpc.remove,{p_session_token:token,p_table:currentTable,p_primary_key:'id',p_record_id:String(editing.id)});
    showBanner('Record deleted.','success');
    Toast.show('Record deleted','success');
    closeEditor();
    loadRecords();
    try{ window.__psbsReloadPanel&&window.__psbsReloadPanel(); }catch(_){}
  }catch(err){ showBanner(err.message||'Delete failed','error'); }
});
async function initAuth(){
  const gateTitle=$('gateTitle'), gateText=$('gateText'), returnLogin=$('returnLogin'), app=$('app'), gate=$('gate');
  /* Keep an existing session across tab/page visits. Server-side expiry/revocation still applies. */
  try { if(!localStorage.getItem(tokenKey) && sessionStorage.getItem(tokenKey)) localStorage.setItem(tokenKey, sessionStorage.getItem(tokenKey)); } catch(e) {}
  const token=localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
  if(!token){
    if(gateTitle) gateTitle.textContent='No administrator session found';
    if(gateText) gateText.textContent='Please sign in through the admin login page to access this workspace.';
    if(returnLogin) returnLogin.hidden=false;
    return;
  }
  try{
    db = window.supabase.createClient(ADMIN_CONFIG.url, ADMIN_CONFIG.anonKey);
    const result = await rpc(ADMIN_CONFIG.rpc.validate,{p_session_token:token});
    const payload = result?.identity || result?.admin || result;
    identity = payload||{};
    session = {token};
    superAdmin = !!(identity.is_super_admin || identity.role==='super_admin' || identity.is_super || identity.is_super_admin===true);
    if($('adminsNavSidebar')) $('adminsNavSidebar').hidden = !superAdmin;
    if($('ddName')) $('ddName').textContent = identity.name || identity.full_name || identity.display_name || identity.username || 'Admin';
    if($('ddRole')) $('ddRole').textContent = superAdmin ? 'Super Admin' : 'Admin';
    if($('ddAvatar')){ const av=$('ddAvatar'); const name=identity.name||identity.full_name||identity.display_name||identity.username||'Admin'; av.textContent=Helpers.initials(name); av.style.backgroundColor=Helpers.colorFromName(name); }
    const profileBtn=$('headerProfileBtn');
    if(profileBtn){
      if(identity.email){
        profileBtn.innerHTML=''; profileBtn.textContent=Helpers.initials(identity.email);
        profileBtn.style.backgroundColor=Helpers.colorFromName(identity.email);
        profileBtn.style.backgroundImage='';
        profileBtn.style.color='#fff';
        profileBtn.style.display='grid'; profileBtn.style.placeItems='center';
        profileBtn.style.fontWeight='800';
      } else {
        profileBtn.innerHTML='<i class="ri-user-3-line"></i>';
      }
    }
    if($('accessLevel')) $('accessLevel').textContent = superAdmin ? 'Super Admin' : 'Admin';
    if($('accessSub')) $('accessSub').textContent = identity.email ? identity.email : 'Session verified by Supabase';
    try{ if(identity.avatar_url||identity.avatar||cachedAvatar()) updateHeaderAvatarUI(); }catch(e){}
    if(gate) gate.hidden=true;
    if(app) app.hidden=false;
    refreshOverview();
    const sin=document.getElementById('siteImagesNav'); if(sin) sin.addEventListener('click',()=>navigate('images'));
    document.querySelectorAll('[data-admin-nav]').forEach(el=>{
      el.addEventListener('click', ()=>{
        const nav=el.getAttribute('data-admin-nav');
        if(nav==='overview') navigate('overview');
        else if(['notices','documents','gallery','faculty','calendar_data','school_info'].includes(nav)) navigate('collection', nav);
        else if(nav==='pending') navigate('pending');
        else if(nav==='admins') navigate('admins');
        closeProfileDropdown(); closeSidebar();
      });
    });
    document.querySelectorAll('[data-table]').forEach(el=>{
      el.addEventListener('click', ()=>{
        const t=el.getAttribute('data-table');
        if(t) navigate('collection', t);
      });
    });
    if($('noticeHeadBtn')) $('noticeHeadBtn').addEventListener('click', ()=>{ if(window.psbsPanel) window.psbsPanel.toggle('notices'); else navigate('collection','notices'); });
    document.addEventListener('pointerdown', (e)=>{
      const host=e.target.closest('.ripple-host');
      if(!host) return;
      const rect=host.getBoundingClientRect();
      const size=Math.max(rect.width,rect.height);
      const x=(e.clientX||(rect.left+rect.width/2))-rect.left-size/2;
      const y=(e.clientY||(rect.top+rect.height/2))-rect.top-size/2;
      const ripple=document.createElement('span');
      ripple.className='ripple';
      ripple.style.width=size+'px'; ripple.style.height=size+'px'; ripple.style.left=x+'px'; ripple.style.top=y+'px';
      host.appendChild(ripple);
      setTimeout(()=>ripple.remove(),680);
    }, {passive:true});
  }catch(err){
    console.error(err);
    if(gateTitle) gateTitle.textContent='Session validation failed';
    if(gateText) gateText.textContent=err.message||'Your session could not be verified. Please sign in again.';
    if(returnLogin) returnLogin.hidden=false;
    localStorage.removeItem(tokenKey);
    sessionStorage.removeItem(tokenKey);
  }
}
let logoutInProgress = false;
let logoutAsking = false;
async function handleLogout(){
  if(logoutInProgress || logoutAsking) return;
  logoutAsking = true;
  let confirmed = false;
  try{
    confirmed = (typeof window.psbsDialog==='function')
      ? await window.psbsDialog({tone:'danger',icon:'ri-logout-box-r-line',title:'Log out?',message:'You will be signed out of Admin Studio on this device and taken to the public website.',okText:'Log out',okIcon:'ri-logout-box-r-line',cancelText:'Stay',cancelIcon:'ri-check-line'})
      : window.confirm('Log out of Admin Studio?');
  } finally { logoutAsking = false; }
  if(!confirmed) return;
  logoutInProgress = true;
  const button = $('logoutMenu');
  if(button){ button.disabled = true; button.setAttribute('aria-busy','true'); }
  const token = localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
  try{
    // The server-side RPC is the authority for revoking the admin session.
    // Do not silently treat a failed RPC as a successful logout.
    if(!db || !token) throw new Error('Your admin session token is missing. Please sign in again.');
    await rpc(ADMIN_CONFIG.rpc.logout,{p_token:token});
    localStorage.removeItem(tokenKey);
    sessionStorage.removeItem(tokenKey);
    localStorage.removeItem('psbs_admin_name');
    sessionStorage.removeItem('psbs_admin_name');
    Toast.show('Logged out — redirecting to homepage','info');
    window.psbsAllowLeave=true;
    setTimeout(()=>{ window.location.replace(new URL('index.html', window.location.href).href); }, 500);
  }catch(e){
    console.error('Admin logout failed:', e);
    Toast.show('Logout could not be confirmed. Check your connection and try again.','error');
    logoutInProgress = false;
    if(button){ button.disabled = false; button.removeAttribute('aria-busy'); }
  }
}
$('logoutMenu')?.addEventListener('click', handleLogout);
/* ===== Reliable mobile Back handling =====
   Back closes open UI first. From another dashboard section it returns to Overview.
   From Overview it returns to the public homepage without clearing the admin token.
*/
window.psbsAllowLeave=false;   /* set true only for deliberate exits (Exit card / logout) */
/* No guard is pushed at load: a push without a tap makes the browser skip the page's own entry on Back. Guards are pushed on taps only. */
/* Back handling lives in one place (the handler near exitFlow) so Back from a section only returns to Overview
   and the leave card shows only when Back is pressed on Overview itself. */

// Match index.html: hide header when scrolling down and reveal it when scrolling up.
(function(){
  const header=document.querySelector('.header');
  if(!header) return;
  let lastY=window.scrollY||0, timer=0;
  window.addEventListener('scroll', function(){
    window.clearTimeout(timer);
    const y=window.scrollY||document.documentElement.scrollTop||0;
    timer=window.setTimeout(function(){
      if(y<=80 || y<lastY-10) header.classList.remove('header-hidden');
      else if(y>lastY+10) header.classList.add('header-hidden');
      lastY=y;
    },120);
  },{passive:true});
})();

// Compact footer consistent with the public school website.
(function(){
  const main=document.querySelector('main.admin-content');
  if(!main || document.getElementById('adminFooter')) return;
  const footer=document.createElement('footer');
  footer.className='admin-footer'; footer.id='adminFooter'; footer.setAttribute('role','contentinfo');
  footer.innerHTML='<p>© <span id="adminFooterYear"></span> Pabitra Secondary Boarding School</p><p>Quality Education since 2040 B.S. · <strong>🌸 Radhe Radhe</strong></p>';
  main.appendChild(footer);
  const year=document.getElementById('adminFooterYear'); if(year) year.textContent=String(new Date().getFullYear());
})();

initAuth();


// ===== Profile Edit Feature =====
let currentAvatarUrl = null;
function avatarKey(){ return 'psbs_admin_avatar_'+(identity.id||identity.email||'admin'); }
function cacheAvatar(u){ try{ localStorage.setItem(avatarKey(),u); }catch(e){} }
function cachedAvatar(){ try{ return localStorage.getItem(avatarKey())||''; }catch(e){ return ''; } }
function updateHeaderAvatarUI(){
  const name = identity.name || identity.full_name || identity.display_name || identity.username || 'Admin';
  const avatarUrl = identity.avatar_url || identity.avatar || cachedAvatar() || '';
  // dropdown avatar
  const ddAv=$('ddAvatar');
  if(ddAv){
    if(avatarUrl){
      ddAv.innerHTML='<img src="'+Helpers.sanitize(avatarUrl)+'" alt="" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%">';
      ddAv.style.backgroundColor='transparent';
    } else {
      ddAv.textContent=Helpers.initials(name);
      ddAv.style.backgroundColor=Helpers.colorFromName(name);
    }
  }
  if($('ddName')) $('ddName').textContent = identity.name || identity.full_name || identity.display_name || identity.username || 'Admin';
  // header button
  const btn=$('headerProfileBtn');
  if(btn){
    if(avatarUrl){
      btn.innerHTML='<img src="'+Helpers.sanitize(avatarUrl)+'" alt="">';
      btn.classList.add('has-image');
      btn.style.backgroundColor='transparent';
      btn.style.backgroundImage='none';
    } else {
      btn.classList.remove('has-image');
      btn.textContent=Helpers.initials(name);
      btn.style.backgroundColor=Helpers.colorFromName(name);
      btn.style.color='#fff';
      btn.style.display='grid';
      btn.style.placeItems='center';
      btn.style.fontWeight='800';
    }
  }
}

// Small Name Card Logic
document.addEventListener('DOMContentLoaded', ()=>{
  const avatarWrap=document.getElementById('ddAvatarWrap');
  const editIcon=document.getElementById('editNameInlineBtn');
  const card=document.getElementById('nameEditCard');
  const backdrop=card;
  const closeBtn=document.getElementById('closeNameCard');
  const cancelBtn=document.getElementById('cancelNameCard');
  const saveBtn=document.getElementById('saveNameCard');
  const input=document.getElementById('nameCardInput');
  const nameError=document.getElementById('nameEditError');

  let fileInput=document.getElementById('avatarFileInputDirect');
  if(!fileInput){
    fileInput=document.createElement('input');
    fileInput.type='file'; fileInput.id='avatarFileInputDirect'; fileInput.accept='image/*'; fileInput.tabIndex=-1; fileInput.style.cssText='position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.appendChild(fileInput);
    fileInput.addEventListener('change', async (e)=>{
      const file=e.target.files?.[0]; if(!file) return;
      if(file.size>15*1024*1024){ Toast.show('Max 15MB','error'); return; }
      try{
        Toast.show('Uploading...','info');
        let up=file; try{ up=await pkCompress(file,512,.85); }catch(_){}
        const ext=(up.name||file.name).split('.').pop()||'jpg';
        const path=(identity.id||'admin')+'/'+Date.now()+'.'+ext;
        let publicUrl=null;
        try{
          const {data,error}=await db.storage.from('admin_avatars').upload(path,up,{upsert:true,contentType:up.type||'image/jpeg'});
          if(error) throw error;
          const {data:urlData}=db.storage.from('admin_avatars').getPublicUrl(path);
          publicUrl=urlData?.publicUrl;
        }catch(se){
          publicUrl=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(up); });
        }
        if(publicUrl){
          const token=localStorage.getItem(tokenKey)||sessionStorage.getItem(tokenKey);
          try{ await rpc('admin_update_profile',{p_token:token,p_name:identity.name||'',p_avatar_url:publicUrl}); }
          catch(err){ await rpc(ADMIN_CONFIG.rpc.save,{p_session_token:token,p_table:'admin_accounts',p_primary_key:'id',p_record:{avatar_url:publicUrl,updated_at:new Date().toISOString()},p_is_update:true,p_original_id:String(identity.id)}); }
          identity.avatar_url=publicUrl; identity.avatar=publicUrl; cacheAvatar(publicUrl); updateHeaderAvatarUI();
          Toast.show('Photo updated ✨','success');
        }
      }catch(err){ console.error('[avatar]',err); Toast.show('Photo not saved: '+((err&&err.message)||'unknown error'),'error',5000); }
      finally{ e.target.value=''; }
    });
  }

  function openCard(){
    const cur=identity.name||identity.full_name||identity.display_name||identity.username||document.getElementById('ddName')?.textContent||'Admin';
    input.value=cur; if(nameError) nameError.textContent=''; input?.setAttribute('aria-invalid','false');
    card.classList.add('active'); card.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; document.body.classList.add('modal-active');
    setTimeout(()=>{ input.focus(); input.select(); }, 300);
    closeProfileDropdown();
  }
  function closeCard(){ card.classList.remove('active'); card.setAttribute('aria-hidden','true'); document.body.style.overflow=''; document.body.classList.remove('modal-active'); }

  avatarWrap?.addEventListener('click',(e)=>{ e.stopPropagation(); fileInput.click(); });
  editIcon?.addEventListener('click',(e)=>{ e.stopPropagation(); openCard(); });
  backdrop?.addEventListener('click', (e)=>{ if(e.target===card) closeCard(); });
  closeBtn?.addEventListener('click', closeCard);
  cancelBtn?.addEventListener('click', closeCard);
  input?.addEventListener('input',()=>{ if(nameError) nameError.textContent=''; input.setAttribute('aria-invalid','false'); });
  saveBtn?.addEventListener('click', async ()=>{
    const newName=input?.value?.trim();
    if(!newName||newName.length<2||newName.length>50||!/^[a-zA-Z\s\-']+$/.test(newName)){
      if(nameError) nameError.textContent=!newName?'Name is required':newName.length<2?'Name must be at least 2 characters':newName.length>50?'Name is too long (max 50)':'Name contains invalid characters';
      input?.setAttribute('aria-invalid','true'); return;
    }
    if(nameError) nameError.textContent=''; input?.setAttribute('aria-invalid','false');
    const old=saveBtn.innerHTML; saveBtn.innerHTML='Saving...'; saveBtn.disabled=true;
    try{
      const token=localStorage.getItem(tokenKey)||sessionStorage.getItem(tokenKey);
      try{ await rpc('admin_update_profile',{p_token:token,p_name:newName,p_avatar_url:identity.avatar_url||''}); }
      catch(err){ await rpc(ADMIN_CONFIG.rpc.save,{p_session_token:token,p_table:'admin_accounts',p_primary_key:'id',p_record:{name:newName,updated_at:new Date().toISOString()},p_is_update:true,p_original_id:String(identity.id)}); }
      identity.name=newName; document.getElementById('ddName').textContent=newName; updateHeaderAvatarUI();
      closeCard(); Toast.show('Saved ✨','success');
    }catch(err){ Toast.show('Failed','error'); }
    finally{ saveBtn.innerHTML=old; saveBtn.disabled=false; }
  });
  input?.addEventListener('keydown',(e)=>{ if(e.key==='Enter'){ e.preventDefault(); saveBtn.click(); } if(e.key==='Escape') closeCard(); });
  document.addEventListener('keydown',(e)=>{ if(e.key==='Escape'&&card?.classList.contains('active')) closeCard(); });
});
