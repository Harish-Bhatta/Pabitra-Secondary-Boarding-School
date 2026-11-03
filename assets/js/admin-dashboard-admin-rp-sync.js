/* ===== 8. Tab glider ===== */
try {
    (function(){
      var bar=document.querySelector('.right-panel .panel-tabbar'); if(!bar)return;
      var panel=document.getElementById('rightPanel'), slider=document.getElementById('panelSlider');
      var nTab=bar.querySelector('[data-panel-tab="notice"]'), dTab=bar.querySelector('[data-panel-tab="documents"]');
      if(!nTab||!dTab)return;
      var g=document.createElement('span'); g.className='tab-glider'; g.setAttribute('aria-hidden','true'); bar.insertBefore(g,bar.firstChild);
      var dragP=null, last='', geo=null;
      if(window.ResizeObserver){var ro=new ResizeObserver(function(){last='';geo=null;}); ro.observe(bar); ro.observe(nTab); ro.observe(dTab);}
      function curP(){
        if(dragP!==null)return dragP;
        var v=parseFloat(dTab.style.getPropertyValue('--swipe-p'));
        if(!isNaN(v))return v;
        return dTab.classList.contains('active')?1:0;
      }
      function paint(){
        if(last===''||!geo){geo={nl:nTab.offsetLeft,dl:dTab.offsetLeft,nw:nTab.offsetWidth,dw:dTab.offsetWidth};}
        var p=curP(), x=geo.nl+(geo.dl-geo.nl)*p, w=geo.nw+(geo.dw-geo.nw)*p;
        var key=x.toFixed(1)+'|'+w.toFixed(1);
        if(key!==last&&w>0){last=key;g.style.width=w+'px';g.style.transform='translateX('+x+'px)';}
      }
      (function loop(){ if(panel&&panel.classList.contains('active')||dragP!==null)paint(); requestAnimationFrame(loop); })();
      window.addEventListener('resize',function(){last='';paint();});
      if(panel)new MutationObserver(function(){last='';paint();}).observe(panel,{attributes:true,attributeFilter:['class']});
      paint();

      // finger-drag the highlight across the dock
      var down=false,moved=false,sx=0,suppress=false;
      var startP=0,travel=60,lastX=0,t0=0,tgtP=0,raf=0;
      function tick(){
        raf=0; if(!down||!moved)return;
        var cur=dragP===null?startP:dragP; cur+= (tgtP-cur)*0.2; if(Math.abs(tgtP-cur)<0.002)cur=tgtP;
        dragP=cur; tint(cur);
        if(slider)slider.style.transform='translateX('+(-50*cur).toFixed(2)+'%)';
        paint();
        if(cur!==tgtP) raf=requestAnimationFrame(tick);
      }
      function pFromX(cx){
        return Math.max(0,Math.min(1,startP+(cx-sx)/travel));
      }
      function tint(p){nTab.style.setProperty('--swipe-p',(1-p).toFixed(3));dTab.style.setProperty('--swipe-p',p.toFixed(3));}
      bar.addEventListener('pointerdown',function(e){
        if(e.pointerType==='mouse'&&e.button!==0)return;
        down=true;moved=false;sx=lastX=e.clientX;t0=Date.now();startP=curP();
        var ra=nTab.getBoundingClientRect(), rb=dTab.getBoundingClientRect();
        travel=Math.max(40,((rb.left+rb.width/2)-(ra.left+ra.width/2))*0.75); tgtP=startP; raf=0; /* short travel = faster switching */
        try{bar.setPointerCapture(e.pointerId);}catch(_){}
      });
      bar.addEventListener('pointermove',function(e){
        if(!down)return;
        if(!moved&&Math.abs(e.clientX-sx)<2)return;
        if(!moved){moved=true;bar.classList.add('is-dragging');if(slider)slider.style.transition='none';}
        lastX=e.clientX;tgtP=pFromX(e.clientX); if(dragP===null)dragP=startP;
        if(!raf)raf=requestAnimationFrame(tick);
      });
      function end(e){
        if(!down)return;down=false;
        if(!moved)return;
        var p=dragP===null?curP():dragP, target=p>0.5?'documents':'notice';
        var dir0=lastX-sx; if(Math.abs(dir0)>=5){ target=dir0>0?'documents':'notice'; }
        var fdx=lastX-sx; if(Date.now()-t0<450&&Math.abs(fdx)>=4) target=fdx>0?'documents':'notice'; /* quick flick, same direction the highlight moves */
        if(raf){cancelAnimationFrame(raf);raf=0;}
        suppress=true;setTimeout(function(){suppress=false;},400);
        dragP=null;bar.classList.remove('is-dragging');
        nTab.style.removeProperty('--swipe-p');dTab.style.removeProperty('--swipe-p');
        if(slider){slider.style.transition='';slider.style.transform='';}
        var btn=target==='documents'?dTab:nTab;
        if(!btn.classList.contains('active')){suppress=false;btn.click();suppress=true;}
        last='';paint();
      }
      bar.addEventListener('pointerup',end);
      bar.addEventListener('pointercancel',end);
      bar.addEventListener('click',function(e){if(suppress){e.stopPropagation();e.preventDefault();}},true);
    })();
} catch (err) {
    console.warn('[psbs] section 8 failed:', err);
}
/* ===== 10. Panel sync ===== */
try {
    (function(){
      var panel=document.getElementById('rightPanel'); if(!panel)return;
      var src=panel.querySelector('.panel-header-source');
      var t=panel.querySelector('[data-docs-title]'), p=panel.querySelector('[data-docs-sub]');
      if(!src||!t||!p)return;
      var st=src.querySelector('#rightPanelSubtitle');
      function sync(){
        if(panel.getAttribute('data-active-tab')==='documents' && st && st.textContent) p.textContent=st.textContent;
      }
      new MutationObserver(sync).observe(src,{childList:true,characterData:true,subtree:true});
      new MutationObserver(sync).observe(panel,{attributes:true,attributeFilter:['data-active-tab']});
    })();
} catch (err) {
    console.warn('[psbs] section 10 failed:', err);
}
/* ===== 11. Filter glider ===== */
try {
    (function(){
      var wrap=document.getElementById('docFilters'); if(!wrap)return;
      var g=document.createElement('span'); g.className='filter-glider'; g.setAttribute('aria-hidden','true'); wrap.insertBefore(g,wrap.firstChild);
      function btns(){return [].slice.call(wrap.querySelectorAll('.doc-filter'));}
      function activeBtn(){return wrap.querySelector('.doc-filter.active')||btns()[0];}
      function place(b){ if(!b||!b.offsetWidth)return; g.style.width=b.offsetWidth+'px'; g.style.transform='translateX('+b.offsetLeft+'px)'; }
      function sync(){ if(!dragging) place(activeBtn()); }
      var dragging=false,moved=false,sx=0,startX=0,curX=0,tgtX=0,raf=0,suppress=false,pickBtn=null;
      new MutationObserver(sync).observe(wrap,{subtree:true,attributes:true,attributeFilter:['class']});
      if(window.ResizeObserver) new ResizeObserver(sync).observe(wrap);
      window.addEventListener('resize',sync); setTimeout(sync,0); setTimeout(sync,400);
      function nearest(x){ var bs=btns(),best=bs[0],bd=1e9; bs.forEach(function(b){var d=Math.abs(b.offsetLeft+b.offsetWidth/2-x); if(d<bd){bd=d;best=b;}}); return best; }
      function tick(){
        raf=0; if(!dragging||!moved)return;
        curX+=(tgtX-curX)*0.25; if(Math.abs(tgtX-curX)<0.4)curX=tgtX;
        g.style.transform='translateX('+curX.toFixed(1)+'px)';
        if(curX!==tgtX) raf=requestAnimationFrame(tick);
      }
      wrap.addEventListener('pointerdown',function(e){
        if(e.pointerType==='mouse'&&e.button!==0)return;
        var a=activeBtn(); if(!a)return;
        dragging=true;moved=false;sx=e.clientX;startX=a.offsetLeft;curX=startX;tgtX=startX;wrap._pid=e.pointerId;
      });
      wrap.addEventListener('pointermove',function(e){
        if(!dragging)return;
        if(!moved&&Math.abs(e.clientX-sx)<3)return;
        if(!moved){moved=true;wrap.classList.add('is-dragging');try{wrap.setPointerCapture(wrap._pid);}catch(_){}}
        var bs=btns(),first=bs[0],last=bs[bs.length-1],w=g.offsetWidth;
        tgtX=Math.max(first.offsetLeft,Math.min(last.offsetLeft+last.offsetWidth-w,startX+(e.clientX-sx)));
        var nb=nearest(tgtX+w/2);
        if(nb!==pickBtn){ if(pickBtn)pickBtn.classList.remove('pick'); pickBtn=nb; nb.classList.add('pick'); }
        if(!raf)raf=requestAnimationFrame(tick);
      });
      function end(){
        if(!dragging)return; dragging=false;
        if(raf){cancelAnimationFrame(raf);raf=0;}
        if(!moved)return;
        suppress=true;setTimeout(function(){suppress=false;},350);
        wrap.classList.remove('is-dragging');
        var target=pickBtn||activeBtn(); if(pickBtn){pickBtn.classList.remove('pick');pickBtn=null;}
        if(target&&!target.classList.contains('active')){suppress=false;target.click();suppress=true;}
        place(target);
      }
      wrap.addEventListener('pointerup',end); wrap.addEventListener('pointercancel',end);
      wrap.addEventListener('click',function(e){if(suppress){e.stopPropagation();e.preventDefault();}},true);
    })();
} catch (err) {
    console.warn('[psbs] section 11 failed:', err);
}
/* ===== 12. Docs search FAB ===== */
try {
    (function(){
      var panel=document.getElementById('rightPanel'); if(!panel)return;
      var wrap=panel.querySelector('.doc-search-wrap'), input=document.getElementById('docSearchInput');
      if(!wrap||!input)return;
      var fab=document.createElement('div'); fab.className='doc-search-fab';
      var btn=document.createElement('button'); btn.type='button'; btn.className='dsf-btn'; btn.setAttribute('aria-label','Search documents'); btn.innerHTML='<i class="ri-search-2-line" aria-hidden="true"></i>';
      fab.appendChild(btn); fab.appendChild(wrap);
      var hdr=panel.querySelector('.panel-pane[data-pane="documents"] .panel-scroll-header')||panel; hdr.style.position='relative'; hdr.appendChild(fab);   /* moves the existing search box, so its logic is unchanged */
      function open(){ fab.classList.add('expanded'); setTimeout(function(){try{input.focus({preventScroll:true});}catch(_){input.focus();}},180); }
      btn.addEventListener('click',open);
      function clearClose(){
        if(input.value){ input.value=''; input.dispatchEvent(new Event('input',{bubbles:true})); }
        fab.classList.remove('expanded');
      }
      /* keyboard closes (input loses focus) -> search clears and closes */
      input.addEventListener('blur',function(){
        setTimeout(function(){ if(document.activeElement!==input && fab.classList.contains('expanded')) clearClose(); },150);
      });
      /* Android: hiding the keyboard with Back doesn't always blur, so watch the viewport too */
      if(window.visualViewport){
        var baseH=window.visualViewport.height;
        window.visualViewport.addEventListener('resize',function(){
          var h=window.visualViewport.height;
          if(h>baseH)baseH=h;
          if(fab.classList.contains('expanded') && document.activeElement===input && h>=baseH-40 && input._kbWasOpen){ input._kbWasOpen=false; input.blur(); }
          else if(h<baseH-120){ input._kbWasOpen=true; }
        });
      }
      /* while search is open, the cross closes the search first (not the whole panel) */
      var cross=document.getElementById('rightPanelClose'), swallow=false;
      if(cross){
        ['pointerdown','touchstart','mousedown'].forEach(function(ev){
          cross.addEventListener(ev,function(){ if(fab.classList.contains('expanded')){ swallow=true; setTimeout(function(){swallow=false;},700); } },true);
        });
        cross.addEventListener('click',function(e){
          if(swallow||fab.classList.contains('expanded')){ e.stopImmediatePropagation(); e.preventDefault(); swallow=false; clearClose(); try{input.blur();}catch(_){} }
        },true);
      }
      new MutationObserver(function(){ if(panel.getAttribute('data-active-tab')!=='documents'){ input.blur(); fab.classList.remove('expanded'); } else if(input.value.trim()){ fab.classList.add('expanded'); } })
        .observe(panel,{attributes:true,attributeFilter:['data-active-tab']});
    })();
} catch (err) {
    console.warn('[psbs] section 12 failed:', err);
}
/* ===== 17. Panels polish ===== */
try {
    (function(){
      var fab=document.querySelector('.doc-search-fab'); if(!fab)return;
      var btn=fab.querySelector('.dsf-btn'), input=document.getElementById('docSearchInput');
      if(btn){
        btn.setAttribute('aria-expanded','false');
        btn.setAttribute('aria-controls','docSearchInput');
        new MutationObserver(function(){
          btn.setAttribute('aria-expanded',fab.classList.contains('expanded')?'true':'false');
        }).observe(fab,{attributes:true,attributeFilter:['class']});
      }
      /* Esc inside the search box clears and collapses it, without closing the whole panel */
      if(input) input.addEventListener('keydown',function(e){
        if(e.key==='Escape'){ e.stopPropagation(); input.blur(); }
      });
    })();
} catch (err) {
    console.warn('[psbs] section 17 failed:', err);
}
/* ===== 18. Pinned close button ===== */
try {
    (function(){
      var panel=document.getElementById('rightPanel'), real=document.getElementById('rightPanelClose');
      if(!panel||!real)return;
      /* put the real ✕ back on the panel itself and drop the scrolling twin (it only forwarded clicks to the real one) */
      panel.querySelectorAll('.panel-scroll-header>.notice-close').forEach(function(b){ if(b!==real) b.remove(); });
      if(real.parentNode!==panel){
        var vp=panel.querySelector('.panel-viewport');
        panel.insertBefore(real,vp||panel.firstChild);
      }
      /* mark the filter pill as "stuck" once it reaches the top, so CSS can make room for the ✕ beside it */
      var pane=panel.querySelector('.panel-pane[data-pane="documents"]'), tb=pane&&pane.querySelector(':scope>.doc-toolbar');
      if(!pane||!tb)return;
      var mark=document.createElement('div'); mark.setAttribute('aria-hidden','true'); mark.style.cssText='height:0;margin:0;padding:0;pointer-events:none';
      pane.insertBefore(mark,tb);
      var raf=0;
      function check(){
        raf=0;
        var lim=parseFloat(getComputedStyle(tb).top)||0;
        var stuck=mark.getBoundingClientRect().top-pane.getBoundingClientRect().top<=lim+0.5;
        if(stuck!==tb.classList.contains('psbs-stuck')) tb.classList.toggle('psbs-stuck',stuck);
      }
      pane.addEventListener('scroll',function(){ if(!raf) raf=requestAnimationFrame(check); },{passive:true});
      window.addEventListener('resize',check,{passive:true});
      check();
    })();
} catch (err) {
    console.warn('[psbs] section 18 failed:', err);
}
(function(){
  var q=document.getElementById('sbSearchTop');
  if(q) q.addEventListener('click',function(){ closeSidebar(); setTimeout(openSearch,160); });
})();
