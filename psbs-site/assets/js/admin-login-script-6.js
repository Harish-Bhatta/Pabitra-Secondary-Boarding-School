/* ===== Visual polish layer (purely cosmetic; never touches sign-in / request-access logic) ===== */
(function(){
  var reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* live clock in the brand panel: no seconds, but it flips exactly when the real minute changes */
  var clock=document.getElementById('clock'),clockT=0;
  function tick(){
    if(!clock)return;
    var d=new Date();
    clock.textContent=d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})+' · '+d.toLocaleDateString([],{weekday:'short',day:'numeric',month:'short'});
    clearTimeout(clockT);clockT=setTimeout(tick,60000-(d.getSeconds()*1000+d.getMilliseconds())+50);
  }
  tick();
  document.addEventListener('visibilitychange',function(){if(!document.hidden)tick();});

  /* soft spotlight that follows the pointer across the card (desktop only) */
  var card=document.querySelector('.login-card');
  if(card&&!reduced&&matchMedia('(pointer:fine)').matches){
    var raf=0;
    card.addEventListener('pointermove',function(e){
      if(raf)return;
      raf=requestAnimationFrame(function(){
        raf=0;var r=card.getBoundingClientRect();
        card.style.setProperty('--mx',(e.clientX-r.left)+'px');
        card.style.setProperty('--my',(e.clientY-r.top)+'px');
      });
    },{passive:true});
  }

  /* the shield swaps to a keyhole while a password field is focused */
  var shield=document.getElementById('shield'),pw=['passwordInput','signupPassword','signupConfirm'];
  document.addEventListener('focusin',function(e){if(shield&&pw.indexOf(e.target.id)>-1)shield.classList.add('locked');});
  document.addEventListener('focusout',function(e){if(shield&&pw.indexOf(e.target.id)>-1)shield.classList.remove('locked');});

  /* heading follows the active tab */
  var title=document.getElementById('cardTitle'),sub=document.getElementById('cardSub');
  var copy={signin:['Admin sign in','Secure access to the <span data-si="acronym">'+(window.SchoolInfo?SchoolInfo.acr():'PSBS')+'</span> dashboard'],signup:['Request admin access','Send your details for senior admin approval']};
  document.querySelectorAll('.tab-bar button').forEach(function(b){
    b.addEventListener('click',function(){
      var c=copy[b.getAttribute('data-tab')];if(!c||!title)return;
      title.textContent=c[0];sub.innerHTML=c[1];
      [title,sub].forEach(function(el){el.style.animation='none';void el.offsetWidth;el.style.animation='';});
    });
  });

  /* Enter moves to the next field; Enter in the last field submits (Sign In / Request Access) */
  ['loginForm','signupForm'].forEach(function(id){
    var f=document.getElementById(id);if(!f)return;
    var items=Array.prototype.slice.call(f.querySelectorAll('.field input'));
    items.forEach(function(inp,i){
      inp.setAttribute('enterkeyhint',i<items.length-1?'next':(id==='loginForm'?'go':'send'));
      inp.addEventListener('keydown',function(e){
        if(e.key!=='Enter'||e.isComposing||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
        if(i<items.length-1){e.preventDefault();var n=items[i+1];n.focus();if(n.select)n.select();}
        else{e.preventDefault();f.requestSubmit();}
      });
    });
  });

})();
