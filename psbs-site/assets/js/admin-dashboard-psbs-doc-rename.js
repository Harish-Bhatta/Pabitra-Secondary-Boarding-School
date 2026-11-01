/* ===== Documents: renaming the file name/path also renames the stored file, so the link keeps working ===== */
(function(){
'use strict';
var busy=false, wired=false;
function rel(v){
  v=String(v||'').trim(); if(!v) return '';
  var u=/^https?:\/\//i.test(v)?v:docUrlFromInput(v);
  if(u.indexOf(DOC_BASE)!==0) return null;               /* external link: nothing to rename */
  try{ return decodeURIComponent(u.slice(DOC_BASE.length)).replace(/^\/+/,''); }catch(e){ return u.slice(DOC_BASE.length); }
}
async function exists(path){
  try{ var r=await fetch(DOC_BASE+path.split('/').map(encodeURIComponent).join('/'),{method:'HEAD',cache:'no-store'}); return r.ok; }
  catch(e){ return false; }
}
async function onSubmit(e){
  var form=e.currentTarget;
  if(currentTable!=='documents'||!editing||!editing.file_url) return;
  if(form.dataset.drDone==='1'){ form.dataset.drDone=''; return; }
  if(busy){ e.preventDefault(); e.stopImmediatePropagation(); return; }
  var fu=$('f_file_url'); if(!fu) return;
  var oldP=rel(editing.file_url), newP=rel(fu.value);
  if(!oldP||!newP||oldP===newP) return;
  e.preventDefault(); e.stopImmediatePropagation(); busy=true;
  try{
    /* keep the original extension if the new name dropped it */
    var oe=pkExt(oldP);
    if(oe && pkExt(newP)!==oe && !/\.[a-z0-9]+$/i.test(pkBase(newP))) newP+='.'+oe;
    var newExists=await exists(newP);
    if(!newExists && await exists(oldP)){
      var bk=db.storage.from(DOC_BUCKET);
      var res=await bk.move(oldP,newP);
      if(res.error){
        /* storage policy may allow copy but not move: copy, then tidy up the old file if allowed */
        var cp=await bk.copy(oldP,newP);
        if(cp.error) throw res.error;
        try{ await bk.remove([oldP]); }catch(_){}
      }
      fu.value=newP; fu.dispatchEvent(new Event('input',{bubbles:true}));
      editing.file_url=docUrlFromInput(newP);
      Toast.show('File renamed','success');
    }
    busy=false; form.dataset.drDone='1'; form.requestSubmit();
  }catch(err){
    busy=false; console.error('[rename document]',err);
    Toast.show('Could not rename the file: '+(err&&err.message||err),'error');
    try{ showBanner('Could not rename the stored file ('+(err&&err.message||err)+'). Storage needs permission to rename files; the link was not changed.','error'); }catch(_){}
  }
}
function wire(){ var f=$('recordForm'); if(f&&!wired){ wired=true; f.addEventListener('submit',onSubmit,true); } }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',wire); else wire();
})();
