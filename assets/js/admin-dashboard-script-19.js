/* Root-level: (1) switch browser/password-manager autofill off everywhere (removes the keyboard's autofill row),
   (2) track the visible viewport + keyboard height so every field/overlay moves above the on-screen keyboard
   in browsers that don't resize the layout (Acode's WebView already does). */
(function(){
  const SKIP=['checkbox','radio','button','submit','reset','file','range','color','hidden'];
  const FIELD=/^(INPUT|TEXTAREA|SELECT)$/;
  function off(el){
    if(el.tagName==='FORM'){if(el.getAttribute('autocomplete')!=='off')el.setAttribute('autocomplete','off');return;}
    if(!FIELD.test(el.tagName)||SKIP.includes((el.type||'').toLowerCase()))return;
    const v=(el.type||'')==='password'?'new-password':'off';
    if(el.getAttribute('autocomplete')!==v)el.setAttribute('autocomplete',v);
    el.setAttribute('data-lpignore','true');el.setAttribute('data-1p-ignore','');
    el.setAttribute('data-bwignore','true');el.setAttribute('data-form-type','other');
  }
  function sweep(root){if(root.nodeType!==1)return;off(root);root.querySelectorAll&&root.querySelectorAll('input,textarea,select,form').forEach(off);}
  sweep(document.documentElement);
  new MutationObserver(ms=>ms.forEach(m=>{
    if(m.type==='attributes'){off(m.target);return;}
    m.addedNodes.forEach(sweep);
  })).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['autocomplete','type']});
  /* Re-assert on focus too, in case a field was touched by other code right before the keyboard opens */
  document.addEventListener('focusin',e=>{if(e.target&&e.target.nodeType===1)off(e.target);},true);

  const vv=window.visualViewport,root=document.documentElement;
  let base=innerHeight,lastW=innerWidth;
  function sync(){
    if(innerWidth!==lastW){lastW=innerWidth;base=innerHeight;}
    base=Math.max(base,innerHeight);
    const zoomed=vv&&vv.scale>1.01;
    const h=(vv&&!zoomed)?vv.height:innerHeight,top=(vv&&!zoomed)?vv.offsetTop:0;
    root.style.setProperty('--vvh',h+'px');root.style.setProperty('--vvt',top+'px');
    /* Keyboard height as seen by position:fixed elements (0 when the browser already resized the layout) */
    const kbPx=Math.max(0,Math.round(innerHeight-h-top));
    root.style.setProperty('--kb',kbPx+'px');
    const kb=kbPx>80||(base-h-top)>120;
    root.classList.toggle('kb-open',!!kb);
    if(kb)reveal(document.activeElement);
  }
  /* Scroll the focused field into the visible area only when the keyboard would cover it */
  let rt=0;
  function reveal(a){
    if(!a||!FIELD.test(a.tagName)||SKIP.includes((a.type||'').toLowerCase()))return;
    clearTimeout(rt);
    rt=setTimeout(()=>{
      const h=vv?vv.height:innerHeight,top=vv?vv.offsetTop:0,r=a.getBoundingClientRect();
      if(r.bottom>top+h-14||r.top<top+8)a.scrollIntoView({block:'center',behavior:'smooth'});
    },80);
  }
  if(vv){vv.addEventListener('resize',sync);vv.addEventListener('scroll',sync);}
  addEventListener('resize',sync);
  addEventListener('orientationchange',()=>{base=0;setTimeout(()=>{base=innerHeight;sync();},300);});
  document.addEventListener('focusin',e=>{setTimeout(sync,120);setTimeout(()=>{sync();reveal(e.target);},400);setTimeout(()=>reveal(e.target),800);});
  document.addEventListener('focusout',()=>setTimeout(sync,200));
  sync();
})();
