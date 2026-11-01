(function(){
  var $=function(i){return document.getElementById(i);};
  var card=$('sbProfileCard'), menu=$('sbProfileMenu'), sb=$('sidebar');
  if(!card||!menu||!sb) return;
  function fill(){
    var a=$('sbpAvatar'), src=$('sbAvatar');
    $('sbpName').textContent=($('sbName')||{}).textContent||'Admin';
    $('sbpRole').textContent=($('sbRole')||{}).textContent||'Verified';
    var bg=src&&src.style.backgroundImage;
    if(bg&&bg!=='none'){ a.style.backgroundImage=bg; a.textContent=''; }
    else { a.style.backgroundImage=''; a.textContent=src?src.textContent:'A'; }
  }
  var menuCloseTimer=null;
  function isOpen(){ return !menu.hidden && !menu.classList.contains('is-leaving'); }
  function open(){
    if(menuCloseTimer){ clearTimeout(menuCloseTimer); menuCloseTimer=null; }
    fill(); menu.hidden=false; menu.classList.remove('is-leaving','is-entering'); void menu.offsetWidth; menu.classList.add('is-entering');
    card.setAttribute('aria-expanded','true');
    setTimeout(function(){ menu.classList.remove('is-entering'); },650);
    setTimeout(function(){ if(isOpen()) menu.scrollIntoView({block:'nearest',behavior:'smooth'}); },30);
  }
  function close(){
    if(menu.hidden) return;
    if(menuCloseTimer) clearTimeout(menuCloseTimer);
    menu.classList.remove('is-entering'); menu.classList.add('is-leaving');
    card.setAttribute('aria-expanded','false');
    menuCloseTimer=setTimeout(function(){ menu.hidden=true; menu.classList.remove('is-leaving'); menuCloseTimer=null; },240);
  }
  card.addEventListener('click',function(e){ e.stopPropagation(); isOpen()?close():open(); });
  var outsideTap=false, touchPending=false;
  function outside(e){ return isOpen()&&!menu.contains(e.target)&&!card.contains(e.target); }
  document.addEventListener('pointerdown',function(e){
    if(!isOpen()) return;
    if(e.pointerType==='touch'){ touchPending=outside(e); return; }
    if(!outside(e)) return;
    outsideTap=true; setTimeout(function(){outsideTap=false;},700); e.preventDefault(); close();
  },true);
  document.addEventListener('touchmove',function(){ if(!touchPending||!isOpen()) return; touchPending=false; close(); },{capture:true,passive:true});
  document.addEventListener('touchend',function(e){
    if(touchPending&&isOpen()){ outsideTap=true; setTimeout(function(){outsideTap=false;},700); if(e.cancelable) e.preventDefault(); close(); }
    touchPending=false;
  },{capture:true,passive:false});
  document.addEventListener('click',function(e){
    if(outsideTap){ outsideTap=false; e.preventDefault(); e.stopImmediatePropagation(); return; }
    if(outside(e)){ outsideTap=true; close(); e.preventDefault(); e.stopImmediatePropagation(); }
  },true);
  document.addEventListener('wheel',function(e){ if(isOpen()&&!menu.contains(e.target)) close(); },{capture:true,passive:true});
  [sb.querySelector('.sidebar-scroll'), sb.querySelector('.sidebar-body')].forEach(function(el){
    if(el) el.addEventListener('scroll',function(){ if(isOpen()) close(); },{passive:true});
  });
  window.addEventListener('blur',close);
  window.__sbPm={isOpen:isOpen,close:close};
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&isOpen()){ e.stopPropagation(); close(); } },true);
  new MutationObserver(function(){ if(!sb.classList.contains('active')&&isOpen()) close(); }).observe(sb,{attributes:true,attributeFilter:['class']});
  function afterClose(fn){
    close();
    if(!window.matchMedia('(min-width:1200px)').matches){ closeSidebar(); setTimeout(fn,260); } else fn();
  }
  menu.addEventListener('click',function(e){
    var b=e.target.closest('[data-pm]'); if(!b) return;
    var k=b.getAttribute('data-pm');
    if(k==='photo'){ close(); var w=$('ddAvatarWrap'); if(w) w.click(); }
    else if(k==='name') afterClose(function(){ var x=$('editNameInlineBtn'); if(x) x.click(); });
    else if(k==='site'){ close(); location.href='index.html'; }
    else if(k==='logout') afterClose(function(){ var x=$('logoutMenu'); if(x) x.click(); });
  });
})();
