/* ===== Add cards: infinite loop carousel on phones — Notice first, swipe either way, slides on its own ===== */
(function(){
  var row=document.querySelector('.quick-notice-row'), wrap=document.querySelector('.quick-notice-wrap');
  if(!row||!wrap) return;
  var real=[].slice.call(row.querySelectorAll('.quick-notice-card'));
  var n=real.length; if(n<2) return;

  function mkClone(src){
    var c=src.cloneNode(true); c.removeAttribute('id'); c.classList.add('qn-clone');
    c.setAttribute('aria-hidden','true'); c.tabIndex=-1;
    c.addEventListener('click',function(){ src.click(); });
    return c;
  }
  /* clones exist only while the phone carousel is showing, so the wide grid is untouched */
  var headClone=null, tailClone=null, all=real.slice();
  function setLoop(on){
    if(on && !headClone){
      headClone=mkClone(real[n-1]); tailClone=mkClone(real[0]);
      row.insertBefore(headClone,row.firstChild); row.appendChild(tailClone);
      all=[headClone].concat(real,[tailClone]);
    } else if(!on && headClone){
      headClone.remove(); tailClone.remove(); headClone=tailClone=null; all=real.slice();
    }
  }
  function narrow(){ return wrap.clientWidth>0 && wrap.clientWidth<560; }

  function active(){ return !!headClone && row.scrollWidth>row.clientWidth+4; }
  function posFor(el){ return el.offsetLeft-(row.clientWidth-el.offsetWidth)/2; }
  function nearest(){
    var mid=row.scrollLeft+row.clientWidth/2, best=0, bd=1e9;
    all.forEach(function(c,i){ var d=Math.abs(c.offsetLeft+c.offsetWidth/2-mid); if(d<bd){ bd=d; best=i; } });
    return best;
  }
  /* Clone and real card are pixel-identical and both are snap points, so an instant jump between them is invisible.
     Snap stays enabled the whole time (toggling it is what made the card flicker). */
  function jump(el){
    row.style.scrollBehavior='auto';
    row.scrollLeft=Math.round(posFor(el));
  }
  function goTo(i,smooth){ row.scrollTo({left:posFor(all[i]),behavior:smooth?'smooth':'auto'}); }
  function markCurrent(){
    var i=nearest();
    all.forEach(function(c,k){ c.classList.toggle('qn-current',k===i); });
  }
  var settle=0, raf=0, down=false;
  function settleNow(){
    if(down||!active()) return;
    var i=nearest(), target=row.scrollLeft;
    /* only jump once the clone is really at rest on its snap point */
    if(i===0||i===n+1){
      if(Math.abs(target-posFor(all[i]))>2){ settleSoon(90); return; }
      jump(i===0?real[n-1]:real[0]);
    }
    markCurrent();
  }
  function settleSoon(ms){ clearTimeout(settle); settle=setTimeout(settleNow,ms||140); }
  row.addEventListener('scroll',function(){
    if(!raf) raf=requestAnimationFrame(function(){ raf=0; if(active()) markCurrent(); });
    if(!('onscrollend' in window)) settleSoon(140);
  },{passive:true});
  row.addEventListener('scrollend',function(){ settleSoon(30); });
  row.addEventListener('touchstart',function(){ down=true; clearTimeout(settle); },{passive:true});
  row.addEventListener('touchend',function(){ down=false; settleSoon(180); },{passive:true});
  row.addEventListener('touchcancel',function(){ down=false; settleSoon(180); },{passive:true});

  /* start on the first real card (Notice) */
  function init(){
    var wasOn=!!headClone; setLoop(narrow());
    if(active() && !wasOn){ jump(real[0]); markCurrent(); }
  }
  init(); window.addEventListener('resize',function(){ setTimeout(init,60); });
  /* every time the Overview is shown again, start back on "Add a notice" */
  new MutationObserver(function(){ setTimeout(function(){ init(); if(active()&&row.offsetParent!==null){ jump(real[0]); markCurrent(); } },60); }).observe(document.getElementById('view-overview')||document.body,{attributes:true,attributeFilter:['hidden']});
  if('ResizeObserver' in window) new ResizeObserver(function(){ init(); }).observe(wrap);

  /* gentle auto-slide: one card after another, pauses while the person interacts */
  var idle=0, touching=false, timer=null, reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  function userTouched(){ idle=Date.now(); }
  row.addEventListener('touchstart',function(){ touching=true; userTouched(); },{passive:true});
  row.addEventListener('touchend',function(){ touching=false; userTouched(); },{passive:true});
  row.addEventListener('touchcancel',function(){ touching=false; userTouched(); },{passive:true});
  row.addEventListener('pointerdown',userTouched,{passive:true});
  row.addEventListener('wheel',userTouched,{passive:true});
  function tick(){
    if(reduce||touching||document.hidden||!active()||row.offsetParent===null) return;
    if(document.body.classList.contains('modal-active')||document.body.classList.contains('rp-open')||document.body.classList.contains('search-open')) return;
    if(Date.now()-idle<6000) return;
    var i=nearest(); if(i>=n+1){ jump(real[0]); i=1; }
    goTo(i+1,true);
  }
  timer=setInterval(tick,4200);
})();
