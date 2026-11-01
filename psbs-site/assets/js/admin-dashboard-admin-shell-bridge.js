(function(){
  var $=function(i){return document.getElementById(i);};
  var hp=$('headerThemePresetsBtn'), ht=$('headerThemeToggleBtn'), tb=$('ddThemesBtn'), db=$('ddDarkBtn'), pc=$('sbProfileCard');
  function closeDD(){ if(typeof closeProfileDropdown==='function') closeProfileDropdown(); else { var d=$('profileDropdown'); if(d) d.classList.remove('active'); } }
  if(tb&&hp) tb.addEventListener('click',function(){ closeDD(); setTimeout(function(){ hp.click(); },180); });
  function syncDark(){ if(db) db.setAttribute('aria-checked', document.body.classList.contains('dark')?'true':'false'); }
  if(db&&ht) db.addEventListener('click',function(){ ht.click(); setTimeout(syncDark,60); });
  try{ new MutationObserver(syncDark).observe(document.body,{attributes:true,attributeFilter:['class']}); }catch(e){}
  syncDark();
  var nm=$('ddName'), rl=$('ddRole'), av=$('ddAvatar'), sn=$('sbName'), sr=$('sbRole'), sa=$('sbAvatar');
  function syncProfile(){
    if(nm&&sn) sn.textContent=nm.textContent.trim()||'Admin';
    if(rl&&sr) sr.textContent=rl.textContent.trim()||'Verified';
    if(av&&sa){
      var im=av.querySelector&&av.querySelector('img'), bg=(im&&im.src)?'url("'+im.src+'")':'';
      if(bg&&bg!=='none'){ sa.style.setProperty('background-image',bg,'important'); sa.style.setProperty('background-size','cover','important'); sa.style.setProperty('background-position','center','important'); sa.textContent=''; }
      else { ['background-image','background-size','background-position'].forEach(function(p){sa.style.removeProperty(p);}); sa.textContent=(av.textContent.trim()||'A').slice(0,1); }
    }
  }
  [nm,rl,av].forEach(function(el){ if(el){ try{ new MutationObserver(syncProfile).observe(el,{childList:true,characterData:true,subtree:true,attributes:true}); }catch(e){} } });
  syncProfile();
})();
