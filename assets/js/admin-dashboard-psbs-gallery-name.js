/* ===== Gallery editor: hide the image link, add an editable "Photo name" (renames the stored file) ===== */
(function(){
'use strict';
var prev=mountGalleryPicker;
mountGalleryPicker=function(){
  prev.apply(this,arguments);
  try{ enhance(); }catch(e){ console.error('[gallery name]',e); }
};
var cur=null, wired=false, busy=false;
function parseStorage(u){ var m=String(u||'').match(/\/storage\/v1\/object\/public\/([^/]+)\/([^?#]+)/); return m?{bucket:m[1],path:decodeURIComponent(m[2])}:null; }
function enhance(){
  var iu=$('f_image_url'); if(!iu) return;
  var wrap=iu.closest('.form-field'), form=$('recordForm');
  /* 1. the image link is automatic: hide it */
  iu.type='hidden'; iu.removeAttribute('required');
  var hint=wrap.querySelector('.hint'); if(hint) hint.textContent='Choose a photo from your phone gallery or take a new one. Large photos are resized automatically.';
  /* 2. photo name field */
  var nf=document.createElement('div'); nf.className='form-field full'; nf.id='gnField';
  nf.innerHTML='<label for="f_photo_name">Photo name</label><div style="display:flex;align-items:center;gap:8px"><input id="f_photo_name" class="field" type="text" autocomplete="off" spellcheck="false" placeholder="e.g. annual-day-2083" style="flex:1;min-width:0"><span id="gnExt" style="font-weight:700;opacity:.7"></span></div><span class="hint">The name of the photo file. Change it and save to rename the photo.</span>';
  wrap.after(nf);
  var inp=nf.querySelector('input'), ext=nf.querySelector('#gnExt'), orig=null;
  function sync(){
    var loc=parseStorage(iu.value);
    if(!loc){ nf.hidden=true; orig=null; return; }
    nf.hidden=false;
    var file=loc.path.split('/').pop(), i=file.lastIndexOf('.');
    var base=i>0?file.slice(0,i):file, e=i>0?file.slice(i):'';
    orig={loc:loc,base:base,ext:e,dir:loc.path.slice(0,loc.path.length-file.length)};
    inp.value=base; ext.textContent=e;
  }
  iu.addEventListener('input',sync);
  new MutationObserver(sync).observe(iu,{attributes:true,attributeFilter:['value']});
  /* uploads set iu.value from script (no event): poll cheaply while the editor is open */
  var last=iu.value, t=setInterval(function(){ if(!iu.isConnected){ clearInterval(t); return; } if(iu.value!==last){ last=iu.value; sync(); } },400);
  sync();
  cur={iu:iu,inp:inp,get orig(){return orig;},set orig(v){orig=v;},sync:function(){sync();},setLast:function(v){last=v;}};
  if(!wired){ wired=true; form.addEventListener('submit',onSubmit,true); }
}

async function onSubmit(e){
  var form=$('recordForm');
  if(currentTable!=='gallery'||!cur||!cur.iu.isConnected) return;
  if(form.dataset.gnDone==='1'){ form.dataset.gnDone=''; return; }
  if(busy){ e.preventDefault(); e.stopImmediatePropagation(); return; }
  var iu=cur.iu, inp=cur.inp, orig=cur.orig;
  if(!iu.value.trim()){ e.preventDefault(); e.stopImmediatePropagation(); Toast.show('Please choose a photo first','error'); return; }
  var nn=pkSafeName((inp.value||'').trim()+(orig?orig.ext:'')).replace(/\.[^.]+$/,'');
  if(!orig||!inp.value.trim()||nn===orig.base) return;       /* name unchanged: normal save */
  e.preventDefault(); e.stopImmediatePropagation(); busy=true;
  try{
    var newPath=orig.dir+nn+orig.ext;
    var res=await db.storage.from(orig.loc.bucket).move(orig.loc.path,newPath);
    if(res.error) throw res.error;
    iu.value=db.storage.from(orig.loc.bucket).getPublicUrl(newPath).data.publicUrl; cur.setLast(iu.value); cur.sync();
    Toast.show('Photo renamed','success');
    busy=false; form.dataset.gnDone='1'; form.requestSubmit();
  }catch(err){ busy=false; console.error('[rename photo]',err); Toast.show('Could not rename the photo: '+(err&&err.message||err),'error'); }
}
})();
