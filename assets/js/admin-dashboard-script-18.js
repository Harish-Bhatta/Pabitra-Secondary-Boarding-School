/* ===== Admin redesign layer: richer record cards, View dialog, editor polish. Data/RPC contracts unchanged. ===== */
(function(){
const MONTHS=['Baisakh','Jestha','Ashadh','Shrawan','Bhadra','Ashwin','Kartik','Mangsir','Poush','Magh','Falgun','Chaitra'];
const NOUN={notices:'notice',documents:'document',gallery:'gallery photo',faculty:'faculty member',calendar_data:'calendar month',school_info:'school information'};
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const mk=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;};
const tagEl=txt=>mk('span','tag',txt);
const host=u=>{try{return new URL(u).hostname.replace(/^www\./,'');}catch(e){return '';}};
const tok=()=>localStorage.getItem(tokenKey)||sessionStorage.getItem(tokenKey);
function summary(t,row){
  if(t==='documents') return row.subject||'';
  if(t==='calendar_data'){const d=row.data;const n=Array.isArray(d)?d.length:(d&&typeof d==='object'?Object.keys(d).length:0);return 'B.S. '+(row.year_bs??'—')+' · '+(MONTHS[row.month_idx]||'Month '+row.month_idx)+(n?' · '+n+' entries':'');}
  return recordSummary(t,row);
}
renderRecords=function(t,rows,target,emptyEl,editable=true){
  if(!target) return;
  target.replaceChildren(); target.dataset.table=t;
  if(!rows.length){ if(emptyEl) emptyEl.hidden=false; return; }
  if(emptyEl) emptyEl.hidden=true;
  rows.forEach(row=>{
    const card=mk('article','record-card');
    const thumb=mk('div','record-thumb');
    const safe=t==='gallery'?Helpers.safeUrl(row.image_url):'';
    if(safe){const im=document.createElement('img');im.src=safe;im.alt=row.caption||'Gallery photo';im.loading='lazy';im.onerror=()=>{thumb.innerHTML='<i class="ri-image-line"></i>';};thumb.append(im);}
    else if(t==='faculty'&&row.emoji){thumb.append(mk('span','emoji',row.emoji));}
    else thumb.innerHTML='<i class="'+iconFor(t)+'"></i>';
    const info=mk('div','record-info');
    const meta=mk('div','record-meta');
    if(row.date) meta.append(tagEl(Helpers.formatDate(row.date)));
    if(row.label) meta.append(tagEl(row.label));
    if(row.file_type) meta.append(tagEl(row.file_type));
    if(t==='documents'&&row.file_url) meta.append(tagEl(host(row.file_url)||'Linked file'));
    if(row.order!==undefined&&row.order!==null&&row.order!=='') meta.append(tagEl('Order '+row.order));
    if(t==='calendar_data') meta.append(tagEl('Month '+row.month_idx));
    const p=mk('p',null,String(summary(t,row)).slice(0,230)); if(!p.textContent) p.hidden=true;
    info.append(mk('b',null,recordTitle(t,row)),p,meta);
    card.append(thumb,info);
    if(editable){
      const acts=mk('div','record-actions');
      const more=mk('button','btn more-btn');more.type='button';more.title='Actions';
      more.setAttribute('aria-label','More actions for '+recordTitle(t,row));more.setAttribute('aria-haspopup','menu');more.setAttribute('aria-expanded','false');
      more.innerHTML='<i class="ri-more-2-fill" aria-hidden="true"></i>';
      more.onclick=ev=>{ev.stopPropagation();openActionMenu(more,row,t);};
      acts.append(more); card.append(acts);
    }
    target.append(card);
  });
};
/* View dialog (read-only, reuses editor chrome) */
const v=document.createElement('div');
v.className='editor';v.id='viewer';v.setAttribute('aria-hidden','true');
v.innerHTML='<div class="editor-sheet" role="dialog" aria-modal="true" aria-labelledby="viewerTitle"><div class="vw-hero"><div class="vw-hero-row"><div class="vw-badge" id="viewerIcon" aria-hidden="true"></div><div class="vw-headtxt"><div id="viewerEyebrow" class="vw-eyebrow"></div><h2 id="viewerTitle" class="vw-title"></h2></div><button type="button" class="vw-close" id="closeViewer" aria-label="Close details"><i class="ri-close-line"></i></button></div><div class="vw-chips" id="viewerChips"></div></div><div class="editor-body vw-body" id="viewerScroll"><div class="vw-cover" id="viewerCover" hidden></div><dl class="vw-grid" id="viewerBody"></dl></div><div class="form-actions"><button type="button" class="btn primary" id="viewerEdit"><i class="ri-edit-line"></i> Edit</button><button type="button" class="btn" id="viewerClose"><i class="ri-close-line"></i> Close</button></div></div>';
document.body.append(v);
let viewRow=null,viewTable=null,lastFocus=null;
const VW_TITLE={notices:'title',documents:'title',faculty:'name',school_info:'school_name'};
const VW_ICON={title:'ri-text',description:'ri-align-left',date:'ri-calendar-line',label:'ri-price-tag-3-line',subject:'ri-book-open-line',file_type:'ri-file-3-line',file_url:'ri-attachment-2',image_url:'ri-image-line',caption:'ri-chat-quote-line',order:'ri-sort-asc',name:'ri-user-3-line',emoji:'ri-emotion-happy-line',month_idx:'ri-calendar-2-line',year_bs:'ri-calendar-event-line',data:'ri-braces-line',school_name:'ri-building-2-line',motto:'ri-double-quotes-l',address:'ri-map-pin-2-line',phone:'ri-phone-line',email:'ri-mail-line',students_count:'ri-group-line',teachers_count:'ri-user-star-line',established_year:'ri-history-line',full_name:'ri-user-3-line',role:'ri-shield-user-line',is_approved:'ri-checkbox-circle-line'};
function vwCopy(text){
  const ok=()=>{if(typeof Toast!=='undefined')Toast.show('Copied to clipboard','success');};
  const bad=()=>{if(typeof Toast!=='undefined')Toast.show('Could not copy','error');};
  try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(ok).catch(bad);return;}}catch(e){}
  bad();
}
function vwIcon(cls){const i=document.createElement('i');i.className=cls;i.setAttribute('aria-hidden','true');return i;}
window.openViewer=function(row,t){
  viewRow=row;viewTable=t;lastFocus=document.activeElement;
  const S=SCHEMAS[t];
  $('viewerEyebrow').textContent=S.title;$('viewerTitle').textContent=recordTitle(t,row);

  /* hero badge: emoji for faculty, otherwise the section icon */
  const badge=$('viewerIcon');badge.replaceChildren();
  if(t==='faculty'&&row.emoji) badge.append(mk('span','vw-emoji',row.emoji)); else badge.append(vwIcon(iconFor(t)));

  /* hero chips */
  const chips=$('viewerChips');chips.replaceChildren();
  const chip=(txt,icon,k)=>{const c=mk('span','vw-chip');if(k)c.dataset.k=String(k).toLowerCase();if(icon)c.append(vwIcon(icon));c.append(document.createTextNode(txt));chips.append(c);};
  if(row.date) chip(Helpers.formatDate(row.date),'ri-calendar-line');
  if(row.label) chip(row.label,'ri-price-tag-3-line',row.label);
  if(row.subject&&t!=='notices') chip(row.subject,'ri-book-open-line');
  if(row.file_type) chip(row.file_type,'ri-file-3-line');
  if(row.order!==undefined&&row.order!==null&&row.order!=='') chip('Order '+row.order,'ri-sort-asc');
  if(t==='calendar_data'){chip('B.S. '+(row.year_bs??'—'),'ri-calendar-event-line');chip('Month '+(row.month_idx??'—'),'ri-calendar-2-line');}
  chips.hidden=!chips.children.length;

  /* gallery cover image */
  const cover=$('viewerCover');cover.replaceChildren();cover.hidden=true;
  if(t==='gallery'){
    const u=Helpers.safeUrl(row.image_url);
    if(u){
      const a=document.createElement('a');a.href=u;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label','Open full image');
      const im=document.createElement('img');im.src=u;im.alt=row.caption||'Gallery photo';
      im.onerror=()=>{cover.hidden=true;};
      const op=mk('span','vw-open');op.append(vwIcon('ri-external-link-line'),document.createTextNode(' Open full image'));
      a.append(im,op);cover.append(a);cover.hidden=false;
    }
  }

  /* field cards */
  const body=$('viewerBody');body.replaceChildren();
  let n=0;
  fieldsFor(t).forEach(([key,label,type])=>{
    if(key===VW_TITLE[t]) return;                      /* already the hero title */
    if(t==='gallery'&&key==='caption') return;         /* already the hero title */
    const val=row[key];
    const empty=val===null||val===undefined||val==='';
    const card=mk('div','vw-card');card.style.setProperty('--i',n++);
    const dt=mk('dt','vw-label');const ic=mk('span','vw-lic');ic.append(vwIcon(VW_ICON[key]||'ri-information-line'));dt.append(ic,mk('span',null,label));
    const dd=document.createElement('dd');dd.className='vw-value';
    let copyText='';
    if(empty){dd.textContent='Not set';card.classList.add('is-empty');}
    else if(type==='json'){
      card.classList.add('wide');
      const pre=document.createElement('pre');try{pre.textContent=JSON.stringify(val,null,2);}catch(e){pre.textContent=String(val);}
      dd.append(pre);copyText=pre.textContent;
    }
    else if(type==='checkbox'){const y=mk('span','vw-yn',val?'Yes':'No');y.dataset.on=val?'true':'false';y.prepend(vwIcon(val?'ri-checkbox-circle-fill':'ri-close-circle-fill'));dd.append(y);}
    else if(type==='date') dd.textContent=Helpers.formatDate(val);
    else if(type==='url'||key==='file_url'){
      card.classList.add('wide');
      const u=Helpers.safeUrl(val);copyText=String(val);
      if(u){const a=document.createElement('a');a.className='vw-link';a.href=u;a.target='_blank';a.rel='noopener noreferrer';a.append(mk('span',null,String(val)),vwIcon('ri-external-link-line'));dd.append(a);}
      else dd.textContent=String(val);
    }
    else if(type==='email'||type==='tel'){
      const sv=String(val).trim();copyText=sv;
      const a=document.createElement('a');a.className='vw-link';a.href=(type==='email'?'mailto:':'tel:')+sv;a.textContent=sv;dd.append(a);
    }
    else if(type==='number'){card.classList.add('stat');dd.textContent=String(val);}
    else if(key==='label'){const c=mk('span','vw-chip',String(val));c.dataset.k=String(val).toLowerCase();dd.append(c);}
    else{
      const sv=String(val);dd.textContent=sv;copyText=sv;
      if(type==='textarea'||sv.length>60||sv.indexOf('\n')>-1){card.classList.add('wide','vw-prose');}
    }
    card.append(dt,dd);
    if(copyText){
      const cb=document.createElement('button');cb.type='button';cb.className='vw-copy';cb.title='Copy';cb.setAttribute('aria-label','Copy '+label);cb.append(vwIcon('ri-file-copy-line'));
      cb.onclick=()=>{vwCopy(copyText);cb.classList.add('done');cb.replaceChildren(vwIcon('ri-check-line'));setTimeout(()=>{cb.classList.remove('done');cb.replaceChildren(vwIcon('ri-file-copy-line'));},1400);};
      card.append(cb);
    }
    body.append(card);
  });
  if(!body.children.length){const e=mk('div','vw-empty','No further details for this record.');body.append(e);}

  v.classList.add('open');v.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
  const sc=$('viewerScroll');if(sc)sc.scrollTop=0;
  const sh=v.querySelector('.editor-sheet');if(sh)sh.scrollTop=0;
  setTimeout(()=>$('viewerEdit').focus({preventScroll:true}),80);
};
function closeViewer(){v.classList.remove('open');v.setAttribute('aria-hidden','true');document.body.style.overflow='';if(lastFocus&&lastFocus.focus)try{lastFocus.focus({preventScroll:true});}catch(e){}}
$('closeViewer').onclick=closeViewer;$('viewerClose').onclick=closeViewer;
v.addEventListener('click',e=>{if(e.target===v)closeViewer();});
$('viewerEdit').onclick=()=>{const r=viewRow,t=viewTable;v.classList.remove('open');v.setAttribute('aria-hidden','true');document.body.style.overflow='';openEditor(r,t);};
/* Back button and Escape close the viewer/editor first */
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||State.isSearchOpen||State.isThemePresetsOpen) return;
  if(typeof menu!=='undefined'&&menu.classList.contains('open')) closeMenu2();
  else if(v.classList.contains('open')) closeViewer();
  else if($('editor').classList.contains('open')) closeEditor();
});
/* Editor polish: titles, widths, groups, image preview, inline JSON error */
const _open=openEditor;
openEditor=function(row,table){
  _open.apply(this,arguments);
  const t=currentTable,noun=NOUN[t]||SCHEMAS[t].title.toLowerCase();
  $('editorTitle').textContent=(row?'Edit ':'Add ')+noun;
  $('editorEyebrow').textContent=row?'Editing an existing record':'Creating a new record';
  const fullKeys=['title','description','subject','file_url','image_url','caption','address','motto','school_name','data','name','principal_name','principal_message'];
  const w=k=>$('f_'+k)?.closest('.form-field');
  fieldsFor(t).forEach(([key,,type])=>{const f=w(key);if(f&&(fullKeys.includes(key)||type==='url'))f.classList.add('full');});
  if(t==='school_info'){
    [['school_name','School identity','Name and motto shown across the public website.'],['address','Contact and location','How visitors can find and reach the school.'],['students_count','School statistics','Figures displayed on the public homepage.'],['principal_name','Principal','Name and message shown in the About section of the public website.']].forEach(([k,h,d])=>{
      const f=w(k);if(!f)return;const g=mk('div','form-group-title');g.append(mk('h3',null,h),mk('p',null,d));f.before(g);});
  }
};
$('recordForm').addEventListener('submit',()=>{
  const j=$('f_data');if(!j||currentTable!=='calendar_data')return;
  j.parentElement.querySelectorAll('.field-error').forEach(n=>n.remove());
  try{JSON.parse(j.value||'{}');}catch(err){const m=mk('div','field-error','Invalid JSON: '+err.message);m.setAttribute('role','alert');j.after(m);j.focus();}
},true);
$('formFields').addEventListener('focusin',e=>{setTimeout(()=>e.target.scrollIntoView?.({block:'center',behavior:'smooth'}),300);});
/* Restore focus when editor closes */
let edFocus=null;
new MutationObserver(()=>{const o=$('editor').classList.contains('open');if(o&&!edFocus)edFocus=document.activeElement;else if(!o&&edFocus){try{edFocus.focus({preventScroll:true});}catch(e){}edFocus=null;}}).observe($('editor'),{attributes:true,attributeFilter:['class']});
/* Helpful empty state + subtitle */
if($('recordsSub')) $('recordsSub').textContent='Use View to read details, Edit to update, or Delete to remove a record.';
const em=$('empty');if(em){const b=mk('button','btn primary');b.type='button';b.innerHTML='<i class="ri-add-line"></i> Add new';b.onclick=()=>openEditor();em.append(b);}
/* ---- Three-dot action card ---- */
const menu=document.createElement('div');menu.id='actionMenu';menu.setAttribute('role','menu');document.body.append(menu);
let menuBtn=null;
function closeMenu2(){if(!menu.classList.contains('open'))return;menu.classList.remove('open');if(menuBtn){menuBtn.setAttribute('aria-expanded','false');try{menuBtn.focus({preventScroll:true});}catch(e){}}menuBtn=null;}
function openActionMenu(btn,row,t){
  if(menuBtn===btn){closeMenu2();return;}
  closeMenu2();menuBtn=btn;btn.setAttribute('aria-expanded','true');
  menu.replaceChildren();
  const head=mk('div','am-head');const tx=mk('div');tx.append(mk('b',null,recordTitle(t,row)),mk('small',null,SCHEMAS[t].title));
  const x=mk('button','am-close');x.type='button';x.setAttribute('aria-label','Close menu');x.innerHTML='<i class="ri-close-line"></i>';x.onclick=closeMenu2;
  head.append(tx,x);menu.append(head);
  const item=(cls,icon,label,fn)=>{const b=mk('button','am-item '+cls);b.type='button';b.setAttribute('role','menuitem');b.innerHTML='<span class="am-ic"><i class="'+icon+'" aria-hidden="true"></i></span><span>'+label+'</span>';b.onclick=()=>{closeMenu2();fn();};menu.append(b);};
  item('','ri-eye-line','View details',()=>openViewer(row,t));
  item('','ri-edit-line','Edit',()=>openEditor(row,t));
  item('danger','ri-delete-bin-line','Delete',()=>deleteFlow(row,t));
  const r=btn.getBoundingClientRect(),w=menu.offsetWidth||290;
  menu.style.visibility='hidden';menu.classList.add('open');const h=menu.offsetHeight;menu.style.visibility='';
  const vw=innerWidth,vh=innerHeight;
  let left=Math.min(Math.max(12,r.right-w),vw-w-12),top=r.bottom+8;
  if(top+h>vh-12) top=r.top-h-8;
  top=Math.min(Math.max(12,top),Math.max(12,vh-h-12));
  menu.style.left=left+'px';menu.style.top=top+'px';
  menu.style.transformOrigin=(r.top-h-8===top?'bottom':'top')+' right';
  menu.querySelector('.am-item')?.focus({preventScroll:true});
}
document.addEventListener('pointerdown',e=>{if(menu.classList.contains('open')&&!menu.contains(e.target)&&!(menuBtn&&menuBtn.contains(e.target)))closeMenu2();},true);
addEventListener('scroll',()=>{if(menu.classList.contains('open'))closeMenu2();},{passive:true,capture:true});
addEventListener('resize',closeMenu2);
/* ---- Own confirmation card (replaces browser confirm) ---- */
const dlg=document.createElement('div');dlg.id='psbsDialog';dlg.setAttribute('aria-hidden','true');
dlg.innerHTML='<div class="dlg-card" role="alertdialog" aria-modal="true" aria-labelledby="dlgTitle" aria-describedby="dlgMsg"><div class="dlg-icon"><i id="dlgIcon"></i></div><h3 id="dlgTitle"></h3><p class="dlg-detail" id="dlgDetail"></p><p class="dlg-msg" id="dlgMsg"></p><div class="dlg-actions"><button type="button" class="btn" id="dlgCancel"></button><button type="button" class="btn primary" id="dlgOk"></button></div></div>';
document.body.append(dlg);
let dlgDone=null;
function psbsDialog(o){
  return new Promise(res=>{
    dlgDone=res;
    dlg.querySelector('.dlg-card').className='dlg-card'+(o.tone==='danger'?' danger':o.tone==='exit'?' exit':'');
    $('dlgIcon').className=o.icon||'ri-question-line';$('dlgTitle').textContent=o.title;
    $('dlgDetail').textContent=o.detail||'';$('dlgDetail').hidden=!o.detail;$('dlgMsg').textContent=o.message||'';
    $('dlgCancel').textContent=o.cancelText||'Cancel';$('dlgOk').textContent=o.okText||'OK';
    [['dlgCancel',o.cancelIcon],['dlgOk',o.okIcon]].forEach(([id,ic])=>{if(!ic)return;const i=document.createElement('i');i.className=ic;i.setAttribute('aria-hidden','true');$(id).prepend(i);});
    dlg.classList.add('open');dlg.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
    setTimeout(()=>$('dlgCancel').focus({preventScroll:true}),60);
  });
}
function closeDlg(v){if(!dlg.classList.contains('open'))return;dlg.classList.remove('open');dlg.setAttribute('aria-hidden','true');
  if(!$('editor').classList.contains('open')&&!v_open())document.body.style.overflow='';
  const d=dlgDone;dlgDone=null;if(d)d(v);}
const v_open=()=>document.getElementById('viewer').classList.contains('open');
$('dlgCancel').onclick=()=>closeDlg(false);$('dlgOk').onclick=()=>closeDlg(true);
dlg.addEventListener('click',e=>{if(e.target===dlg)closeDlg(false);});
dlg.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();closeDlg(false);}
  if(e.key==='Tab'){const a=$('dlgCancel'),b=$('dlgOk');if(e.shiftKey&&document.activeElement===a){e.preventDefault();b.focus();}else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a.focus();}}});
async function deleteFlow(row,t){
  if(row._deleting) return;
  const ok=await psbsDialog({tone:'danger',icon:'ri-delete-bin-6-line',title:'Delete this record?',detail:recordTitle(t,row),message:'This permanently removes it from the school website. This cannot be undone.',okText:'Delete',cancelText:'Cancel'});
  if(!ok) return;
  row._deleting=true;
  try{
    await rpc(ADMIN_CONFIG.rpc.remove,{p_session_token:tok(),p_table:t,p_primary_key:'id',p_record_id:String(row.id)});
    showBanner('Record deleted.','success');Toast.show('Record deleted','success');loadRecords();
  }catch(err){showBanner(err.message||'Delete failed','error');Toast.show('Delete failed: '+(err.message||''),'error');}
  finally{row._deleting=false;}
}
/* Pending-user Reject: use our card instead of the browser confirm */
let bypass=false;
$('pendingList')?.addEventListener('click',async e=>{
  const b=e.target.closest('.btn.danger');if(!b||bypass)return;
  e.stopImmediatePropagation();e.preventDefault();
  const name=b.closest('.record-card')?.querySelector('.record-info b')?.textContent||'this user';
  const ok=await psbsDialog({tone:'danger',icon:'ri-user-unfollow-line',title:'Reject this user?',detail:name,message:'Their pending account will be deleted. This cannot be undone.',okText:'Reject',cancelText:'Cancel'});
  if(!ok)return;
  const old=window.confirm;window.confirm=()=>true;bypass=true;
  try{b.click();}finally{bypass=false;window.confirm=old;}
},true);
/* ---- Back button: never leaves the dashboard without asking ---- */
const ORIGIN_KEY='psbs_admin_origin';
function okRef(r){try{const u=new URL(r);return u.origin===location.origin&&!/admin/i.test(u.pathname)?u.href:'';}catch(e){return '';}}
try{const r=okRef(document.referrer);if(r)sessionStorage.setItem(ORIGIN_KEY,r);}catch(e){}
function exitTarget(){
  let href='';try{href=sessionStorage.getItem(ORIGIN_KEY)||'';}catch(e){}
  if(!href) href=new URL('index.html',location.href).href;
  const p=new URL(href).pathname.toLowerCase();
  return {href,label:/gallery/.test(p)?'Gallery page':/calendar/.test(p)?'Calendar page':/index|\/$/.test(p)?'Public website':'Previous page'};
}
async function exitFlow(){
  const t=exitTarget();
  const ok=await psbsDialog({tone:'exit',icon:'ri-logout-circle-r-line',title:'Exit or stay?',message:'You will stay signed in. Exiting takes you to the '+t.label+'.',okText:'Exit',okIcon:'ri-logout-box-r-line',cancelText:'Stay',cancelIcon:'ri-check-line'});
  if(ok){
    leaving=true; window.psbsAllowLeave=true;
    const n=(history.state&&history.state.i)||0;   /* entries we added above the original page */
    if(n>0){ history.go(-(n+1)); setTimeout(()=>location.replace(t.href),600); }
    else location.replace(t.href);
  }
}
window.psbsExitFlow=exitFlow;
window.psbsDialog=psbsDialog;
let leaving=false, lastTap=0, restoring=false;
const GUARD_DEPTH=3;
/* Browsers skip history entries that a page leaves/creates WITHOUT a tap. So guards are only ever pushed during a real
   tap/key press (while the browser reports active user activation), 3 deep, and are topped up on every tap. */
function canPush(){
  /* The browser only skips entries when the page has NEVER had a tap; once it has, pushing is always safe. */
  try{ if(navigator.userActivation) return navigator.userActivation.hasBeenActive; }catch(e){}
  return true;
}
function topUp(){
  if(leaving || restoring || !canPush()) return;
  let n=(history.state&&history.state.i)||0, guard=0;
  while(n<GUARD_DEPTH && guard++<GUARD_DEPTH){
    try{ history.pushState({psbsAdminGuard:true,i:n+1},'',window.location.href); n++; }catch(e){ break; }
  }
}
function armGuard(ev){
  if(ev&&ev.type!=='pointerup'&&ev.type!=='pointerdown') lastTap=Date.now();
  topUp();
}
try{ if(leaving===false){ const n0=(history.state&&history.state.i)||0; if(n0<GUARD_DEPTH){ for(let k=n0;k<GUARD_DEPTH;k++) history.pushState({psbsAdminGuard:true,i:k+1},'',window.location.href); } } }catch(e){}
['pointerdown','pointerup','touchstart','touchend','mousedown','click','keydown'].forEach(ev=>document.addEventListener(ev,armGuard,{passive:true,capture:true}));
/* Navigation API layer (Chromium): a Back that would leave the page is cancelled and OUR card is shown instead. */
try{
  if(window.navigation && navigation.addEventListener){
    navigation.addEventListener('navigate',function(e){
      if(e.navigationType!=='traverse'||e.destination.sameDocument) return;
      if(window.psbsAllowLeave||leaving||!e.cancelable) return;
      e.preventDefault();
      if(!dlg.classList.contains('open')) exitFlow();
    });
  }
}catch(err){}
window.addEventListener('popstate',e=>{
  e.stopImmediatePropagation();
  if(leaving) return;
  /* Restoring guards by walking FORWARD over the entries we already own (pushing new ones here, without a tap, makes
     the browser mark them skippable — that is what let a later Back escape). */
  if(restoring){ restoring=false; return; }   /* this popstate is just our own forward step */
  { const k=(history.state&&history.state.i)||0;
    if(k<GUARD_DEPTH){
      restoring=true;
      try{ history.go(GUARD_DEPTH-k); }catch(err){ restoring=false; }
      setTimeout(()=>{ restoring=false; },700);   /* safety: never stay stuck if no forward entry existed */
    } }
  /* 0) keyboard open? first Back only closes the keyboard */
  { const a=document.activeElement;
    if(a&&/^(INPUT|TEXTAREA)$/.test(a.tagName)&&document.documentElement.classList.contains('kb-open')){ a.blur(); return; } }
  /* 1) close whatever is really open — flags can go stale, so look at the real elements */
  if(dlg.classList.contains('open')){closeDlg(false);return;}
  { const pk=document.querySelector('.pk-sheet-ov'); if(pk){ pk.click(); return; } }
  if(window.__psbsPicker&&window.__psbsPicker.isOpen()){ window.__psbsPicker.close(); return; }
  const isOn=el=>!!(el&&el.classList.contains('active'));
  if(document.body.classList.contains('rp-open')){
    if(isOn($('rightPanel'))){ $('rightPanelClose')?.click(); return; }
    document.body.classList.remove('rp-open');
  }
  if(window.__sbPm&&window.__sbPm.isOpen()){ window.__sbPm.close(); return; }
  if(menu.classList.contains('open')){closeMenu2();return;}
  if(v_open()){closeViewer();return;}
  const sidebarOpen=isOn(DOM.sidebar), editorOpen=$('editor').classList.contains('open');
  const searchOpen=isOn(DOM.searchOverlay), dropOpen=isOn(DOM.profileDropdown), themeOpen=isOn(DOM.themePresetsModal);
  if(sidebarOpen||editorOpen||searchOpen||dropOpen||themeOpen){
    if(searchOpen)closeSearch();if(themeOpen)closeThemePresets();
    if(dropOpen)closeProfileDropdown();if(sidebarOpen)closeSidebar();if(editorOpen)closeEditor();return;
  }
  /* 1b) a records search is active: next Back clears it (before leaving the section) */
  if(currentView==='collection' && window.psbsClearRecordSearch && window.psbsClearRecordSearch()) return;
  /* 2) another section goes back to Overview first; 3) Overview asks Exit or Stay (our own card) */
  if(currentView!=='overview'){navigate('overview');return;}
  exitFlow();
},{capture:true});
})();
