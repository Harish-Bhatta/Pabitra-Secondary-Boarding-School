/* ===== Login experience layer (does not touch the sign-in / request-access logic) ===== */
(function(){
  var $=function(s,r){return (r||document).querySelector(s);}, $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};

  /* 2) Keyboard: lift the form above the on-screen keyboard in every environment.
        - Acode WebView: layout does not resize, visualViewport does.
        - Chrome/Firefox (resizes-content): the layout viewport itself shrinks, so visualViewport.height === innerHeight.
        - iOS Safari: keyboard overlays; only visualViewport shrinks.
     We remember the full height while no field is focused and compare against it, so all three are detected. */
  var vv=window.visualViewport,root=document.documentElement;
  var isField=function(el){return !!(el&&el.matches&&el.matches('input,textarea,select'));};
  var base=Math.max(innerHeight,vv?vv.height:0),scrollT=0;
  function ensureVisible(){
    var a=document.activeElement;if(!isField(a))return;
    var vh=(vv&&vv.scale<=1.01)?vv.height:innerHeight,r=a.getBoundingClientRect();
    if(r.bottom>vh-24||r.top<72)a.scrollIntoView({block:'center',behavior:'smooth'});
  }
  function sync(){
    var zoomed=vv&&vv.scale>1.01,vh=(vv&&!zoomed)?vv.height:innerHeight,vt=(vv&&!zoomed)?vv.offsetTop:0;
    var focused=isField(document.activeElement);
    if(!focused)base=Math.max(innerHeight,vh);
    var shrunk=(base-vh-vt>120)||(base-innerHeight>120);
    var kb=shrunk||(focused&&matchMedia('(pointer:coarse)').matches&&innerWidth<980);
    root.style.setProperty('--vvh',vh+'px');root.style.setProperty('--vvt',vt+'px');
    root.style.setProperty('--kb',Math.max(0,innerHeight-vh-vt)+'px');
    root.classList.toggle('kb-open',!!kb);
    if(kb){clearTimeout(scrollT);scrollT=setTimeout(ensureVisible,120);}
  }
  if(vv){vv.addEventListener('resize',sync);vv.addEventListener('scroll',sync);}
  addEventListener('resize',sync);
  addEventListener('orientationchange',function(){base=0;setTimeout(sync,350);});
  document.addEventListener('focusin',function(){sync();setTimeout(sync,350);});
  document.addEventListener('focusout',function(){setTimeout(sync,320);});
  sync();

  /* 3) Friendly greeting */
  var h=new Date().getHours(),g=h<5?['Still up?','🌙']:h<12?['Good morning','🌅']:h<17?['Good afternoon','☀️']:h<21?['Good evening','🌆']:['Good night','🌙'];
  var gr=$('#greet'); if(gr) gr.textContent='Namaste 🙏 '+g[0]+' '+g[1]+' · welcome back!';

  /* 4) Eye buttons, caps-lock hint, focus state, clear errors while typing */
  $$('.input-group').forEach(function(gp){
    var inp=$('input',gp);if(!inp)return;
    inp.addEventListener('focus',function(){gp.classList.add('focus-in');});
    inp.addEventListener('blur',function(){gp.classList.remove('focus-in');});
    inp.addEventListener('input',function(){inp.removeAttribute('aria-invalid');var er=$('.input-error',gp);if(er&&er.textContent)er.textContent='';});
    if(inp.type!=='password')return;
    var field=$('.field',gp)||gp;
    var b=document.createElement('button');b.type='button';b.className='pw-toggle';b.setAttribute('aria-label','Show password');b.innerHTML='<i class="ri-eye-line" aria-hidden="true"></i>';
    b.addEventListener('click',function(){var s=inp.type==='password';inp.type=s?'text':'password';b.firstChild.className=s?'ri-eye-off-line':'ri-eye-line';b.setAttribute('aria-label',s?'Hide password':'Show password');inp.focus({preventScroll:true});});
    field.appendChild(b);
    var cap=document.createElement('div');cap.className='caps-hint';cap.innerHTML='<i class="ri-arrow-up-circle-line" aria-hidden="true"></i> Caps Lock is on';gp.after(cap);
    var chk=function(e){if(e.getModifierState)cap.classList.toggle('show',e.getModifierState('CapsLock'));};
    inp.addEventListener('keydown',chk);inp.addEventListener('keyup',chk);inp.addEventListener('blur',function(){cap.classList.remove('show');});
  });

  /* 5) Password strength (request access) */
  var sp=document.getElementById('signupPassword');
  if(sp){
    var m=document.createElement('div');m.className='strength';m.dataset.l='0';m.setAttribute('aria-live','polite');m.innerHTML='<i></i><i></i><i></i><i></i><span></span>';
    sp.closest('.input-group').after(m);
    sp.addEventListener('input',function(){
      var v=sp.value,s=0;if(v.length>=8)s++;if(/[a-z]/.test(v)&&/[A-Z]/.test(v))s++;if(/\d/.test(v))s++;if(/[^A-Za-z0-9]/.test(v)||v.length>=12)s++;
      if(!v)s=0;m.dataset.l=s;m.lastChild.textContent=['','Weak','Okay','Good','Strong'][s];
    });
  }

  /* 6) Shake the field on validation errors */
  $$('.input-error').forEach(function(er){
    new MutationObserver(function(){
      if(!er.textContent)return;var gp=er.closest('.input-group'),inp=$('input',gp);
      if(inp)inp.setAttribute('aria-invalid','true');gp.classList.remove('shake');void gp.offsetWidth;gp.classList.add('shake');
    }).observe(er,{childList:true,characterData:true,subtree:true});
  });

  /* 7) Celebrate success, nudge on error (watches the existing toast) */
  var card=$('.login-card'),toast=$('#toast');
  function burst(){
    var host=$('.login-btn.loading')||$('.login-btn:not(:disabled)')||card,r=host.getBoundingClientRect(),em=['🎉','✨','🌸','⭐','🎓'];
    if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
    for(var i=0;i<18;i++){var s=document.createElement('span');s.className='confetti';s.textContent=em[i%em.length];
      s.style.left=(r.left+r.width/2)+'px';s.style.top=(r.top+r.height/2)+'px';
      s.style.setProperty('--dx',((Math.random()-.5)*320)+'px');s.style.setProperty('--dy',(-60-Math.random()*220)+'px');s.style.setProperty('--r',((Math.random()-.5)*540)+'deg');
      document.body.appendChild(s);setTimeout(function(x){x.remove();},1100,s);}
  }
  if(toast)new MutationObserver(function(){
    if(!toast.classList.contains('active'))return;
    if(toast.classList.contains('toast-success')){card.classList.add('is-success');burst();setTimeout(function(){card.classList.remove('is-success');},900);}
    else if(toast.classList.contains('toast-error')){card.classList.remove('shake');void card.offsetWidth;card.classList.add('shake');}
  }).observe(toast,{attributes:true,attributeFilter:['class']});

  /* 8) Forgot password: there is no automated reset flow, so say so clearly */
  var fl=document.getElementById('forgotLink');
  if(fl)fl.addEventListener('click',function(e){e.preventDefault();showToast('Password resets are handled by a senior administrator. Please contact one.','info');});

  /* 9) Tab switch links inside the card */
  function goTab(t){var b=$('.tab-bar button[data-tab="'+t+'"]');if(b)b.click();}
  var gs=document.getElementById('goSignup'),gi=document.getElementById('goSignin');
  if(gs)gs.addEventListener('click',function(){goTab('signup');});
  if(gi)gi.addEventListener('click',function(){goTab('signin');});

  /* 10) Gentle parallax on the background glow (desktop pointers only) */
  var fx=$('.fx');
  if(fx&&matchMedia('(pointer:fine)').matches&&!matchMedia('(prefers-reduced-motion:reduce)').matches)
    addEventListener('pointermove',function(e){fx.style.transform='translate3d('+((e.clientX/innerWidth-.5)*-22)+'px,'+((e.clientY/innerHeight-.5)*-22)+'px,0)';},{passive:true});
})();
