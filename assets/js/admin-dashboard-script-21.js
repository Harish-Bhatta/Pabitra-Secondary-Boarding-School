/* Custom UI layer: date picker, dropdowns, number stepper, validation messages.
   Values, events and saved data are identical to the native controls (UI only). */
(function(){
  'use strict';
  var MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  var MS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var DOWS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var DOW2=['Su','Mo','Tu','We','Th','Fr','Sa'];
  function sv(p,w){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(w||2)+'" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>';}
  var IC={
    cal:sv('<rect x="3" y="5" width="18" height="16" rx="4"/><path d="M8 3v4M16 3v4M3 10h18"/>'),
    down:sv('<path d="m6 9 6 6 6-6"/>',2.4),
    l:sv('<path d="m15 5-7 7 7 7"/>',2.6), r:sv('<path d="m9 5 7 7-7 7"/>',2.6),
    x:sv('<path d="M6 6l12 12M18 6 6 18"/>',2.6),
    trash:sv('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>'),
    today:sv('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/>'),
    check:sv('<path d="m5 12.5 4.5 4.5L19 7.5"/>',3),
    minus:sv('<path d="M5 12h14"/>',2.8), plus:sv('<path d="M12 5v14M5 12h14"/>',2.8),
    list:sv('<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',2.4),
    warn:sv('<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/>',2.4)
  };
  var LBL={
    urgent:['#ef4444','rgba(239,68,68,.14)',IC.warn],
    event:['#3b82f6','rgba(59,130,246,.14)',IC.cal],
    announcement:['#f39c12','rgba(243,156,18,.16)',sv('<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M15 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>')],
    achievement:['#16a34a','rgba(34,197,94,.15)',sv('<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v1a3 3 0 0 0 3 3M16 6h4v1a3 3 0 0 1-3 3M12 13v4M8 20h8"/>')],
    exam:['#8b5cf6','rgba(139,92,246,.15)',sv('<path d="M4 20l4-1 11-11a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"/><path d="M14 7l3 3"/>')],
    holiday:['#0d9488','rgba(20,184,166,.15)',sv('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>')]
  };
  var FT={pdf:['#dc2626','rgba(239,68,68,.14)','PDF'],doc:['#2563eb','rgba(59,130,246,.14)','DOC'],docx:['#2563eb','rgba(59,130,246,.14)','DOCX'],xls:['#16a34a','rgba(34,197,94,.15)','XLS'],xlsx:['#16a34a','rgba(34,197,94,.15)','XLSX'],ppt:['#ea580c','rgba(249,115,22,.15)','PPT'],image:['#db2777','rgba(236,72,153,.14)','IMG'],other:['#64748b','rgba(100,116,139,.16)','···']};
  var PAL=[['#f39c12','rgba(243,156,18,.16)'],['#3b82f6','rgba(59,130,246,.14)'],['#16a34a','rgba(34,197,94,.15)'],['#8b5cf6','rgba(139,92,246,.15)'],['#ec4899','rgba(236,72,153,.14)'],['#0d9488','rgba(20,184,166,.15)']];
  function visual(val,idx){
    var k=String(val).toLowerCase();
    if(LBL[k]) return {c:LBL[k][0],cb:LBL[k][1],h:LBL[k][2]};
    if(FT[k]) return {c:FT[k][0],cb:FT[k][1],h:FT[k][2]};
    var p=PAL[idx%PAL.length]; return {c:p[0],cb:p[1],h:String(val).charAt(0).toUpperCase()||'•'};
  }
  function bubble(v){return '<span class="sx-b" style="--c:'+v.c+';--cb:'+v.cb+'">'+v.h+'</span>';}
  function esc(s){return Helpers.sanitize(s);}
  function el(t,c){var e=document.createElement(t);if(c)e.className=c;return e;}
  function pad(n){return (n<10?'0':'')+n;}
  function iso(y,m,d){return y+'-'+pad(m+1)+'-'+pad(d);}
  function parse(v){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(v||'');return m?{y:+m[1],m:+m[2]-1,d:+m[3]}:null;}
  function dow(p){return new Date(p.y,p.m,p.d).getDay();}
  function fmt(p){return DOWS[dow(p)]+', '+p.d+' '+MS[p.m]+' '+p.y;}
  function fire(i){i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));}
  function labelOf(i){var l=i.id?document.querySelector('label[for="'+i.id+'"]'):null;return l?l.textContent.replace(/\s*\*$/,'').trim():'';}
  function hookValue(node,proto,refresh){
    var d=Object.getOwnPropertyDescriptor(proto,'value');
    Object.defineProperty(node,'value',{configurable:true,get:function(){return d.get.call(this);},set:function(v){d.set.call(this,v);refresh();}});
  }
  function wrapField(node,disp,hitLabel){
    var wrap=el('div','dp-wrap'); node.parentNode.insertBefore(wrap,node); wrap.appendChild(node);
    var hit=el('button','dp-hit'); hit.type='button'; hit.setAttribute('aria-haspopup','dialog'); hit.setAttribute('aria-label',hitLabel);
    wrap.appendChild(disp); wrap.appendChild(hit); return {wrap:wrap,hit:hit};
  }

  /* ---------- generic layer: popover on desktop, bottom sheet on phones (swipe down anywhere to close) ---------- */
  var L=null;
  function openLayer(o){
    if(L) closeLayer(true);
    var backdrop=el('div','dp-backdrop'), pop=el('div','dp-pop '+(o.cls||''));
    pop.setAttribute('role','dialog'); pop.setAttribute('aria-modal','true'); pop.setAttribute('aria-label',o.aria||'Choose');
    document.body.appendChild(backdrop); document.body.appendChild(pop);
    L={pop:pop,backdrop:backdrop,o:o,noClick:false};
    var me=L;
    backdrop.addEventListener('pointerdown',function(e){e.preventDefault();closeLayer();});
    pop.addEventListener('click',function(e){ if(me.noClick){e.stopPropagation();e.preventDefault();return;} o.onClick(e); });
    if(o.onKey) pop.addEventListener('keydown',o.onKey);
    document.addEventListener('keydown',docKey,true);
    window.addEventListener('resize',place); window.addEventListener('scroll',place,true);
    o.wrap.classList.add('dp-open');
    attachDrag(me);
    o.render(); place();
    requestAnimationFrame(function(){ if(L!==me) return; pop.classList.add('dp-in'); backdrop.classList.add('dp-in'); if(o.afterOpen) o.afterOpen(); });
  }
  window.__psbsPicker={isOpen:function(){return !!L;},close:function(){closeLayer();}};
  function closeLayer(instant){
    if(!L) return;
    var me=L; L=null;
    document.removeEventListener('keydown',docKey,true);
    window.removeEventListener('resize',place); window.removeEventListener('scroll',place,true);
    me.o.wrap.classList.remove('dp-open');
    me.pop.style.transition=''; me.pop.style.transform=''; me.backdrop.style.transition=''; me.backdrop.style.opacity='';
    me.pop.classList.remove('dp-in'); me.backdrop.classList.remove('dp-in');
    var rm=function(){me.pop.remove();me.backdrop.remove();};
    if(instant) rm(); else setTimeout(rm,300);
    if(me.o.onClose) me.o.onClose();
    try{me.o.hit.focus({preventScroll:true});}catch(e){}
  }
  function docKey(e){ if(e.key==='Escape'&&L){e.preventDefault();e.stopPropagation();closeLayer();} }
  function place(){
    if(!L) return; var o=L.o, pop=L.pop;
    if(window.innerWidth<=560){pop.style.left='';pop.style.top='';pop.style.width='';return;}
    var r=o.wrap.getBoundingClientRect();
    if(o.matchWidth) pop.style.width=Math.max(r.width,260)+'px';
    var w=pop.offsetWidth,h=pop.offsetHeight,vw=window.innerWidth,vh=window.innerHeight;
    var left=Math.min(Math.max(8,r.left),vw-w-8), top=r.bottom+8, up=false;
    if(top+h>vh-8){ if(r.top-h-8>=8){top=r.top-h-8;up=true;} else top=Math.max(8,(vh-h)/2); }
    pop.style.left=left+'px'; pop.style.top=top+'px'; pop.style.transformOrigin=(up?'bottom':'top')+' left';
  }
  function attachDrag(Ly){
    var pop=Ly.pop,bd=Ly.backdrop,sy=0,sx=0,can=false,drag=false,skip=false,lastY=0,lastT=0,vel=0,cur=0,raf=0,ph=0;
    function paint(){ raf=0; if(!drag) return; pop.style.transform='translate3d(0,'+cur+'px,0)'; bd.style.opacity=String(Math.max(.15,1-cur/(ph||1))); }
    pop.addEventListener('touchstart',function(e){
      if(window.innerWidth>560||e.touches.length!==1){can=false;return;}
      var t=e.touches[0]; sy=t.clientY; sx=t.clientX; lastY=sy; lastT=e.timeStamp; vel=0; cur=0; drag=false; skip=false;
      var sc=e.target.closest?e.target.closest('.sx-list'):null;
      can=!sc||sc.scrollTop<=0;
    },{passive:true});
    pop.addEventListener('touchmove',function(e){
      if(!can||skip) return;
      var t=e.touches[0],dy=t.clientY-sy,dx=t.clientX-sx;
      if(!drag){
        if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)){skip=true;return;}
        if(dy<-6){skip=true;return;}
        if(dy>8){drag=true;ph=pop.offsetHeight;pop.style.transition='none';bd.style.transition='none';} else return;
      }
      e.preventDefault();
      cur=Math.max(0,dy);
      if(!raf) raf=requestAnimationFrame(paint);
      vel=(t.clientY-lastY)/Math.max(1,e.timeStamp-lastT); lastY=t.clientY; lastT=e.timeStamp;
    },{passive:false});
    function end(){
      if(!drag) return; drag=false;
      if(raf){cancelAnimationFrame(raf);raf=0;} pop.style.transform='translate3d(0,'+cur+'px,0)';
      Ly.noClick=true; setTimeout(function(){Ly.noClick=false;},350);
      if(cur>Math.min(130,pop.offsetHeight*.28)||vel>.55){ if(L===Ly) closeLayer(); }
      else{
        pop.style.transition='transform .32s cubic-bezier(.22,1,.36,1)'; pop.style.transform='';
        bd.style.transition='opacity .3s'; bd.style.opacity='';
        setTimeout(function(){pop.style.transition='';bd.style.transition='';},340);
      }
    }
    pop.addEventListener('touchend',end); pop.addEventListener('touchcancel',end);
  }
  function trapTab(e){
    var pop=L.pop,f=[].slice.call(pop.querySelectorAll('button:not([tabindex="-1"])'));
    if(!f.length) return; var i=f.indexOf(document.activeElement);
    if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus();}
    else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus();}
  }

  /* ---------- DATE PICKER ---------- */
  var S=null;
  function isDis(y,m,d){var k=iso(y,m,d);return (S.min&&k<iso(S.min.y,S.min.m,S.min.d))||(S.max&&k>iso(S.max.y,S.max.m,S.max.d));}
  function enhanceDate(input){
    var disp=el('div','dp-display'); disp.setAttribute('aria-hidden','true');
    disp.innerHTML='<span class="dp-ico">'+IC.cal+'</span><span class="dp-text"></span><span class="dp-caret">'+IC.down+'</span>';
    var f=wrapField(input,disp,(labelOf(input)||'Date')+': choose date'), wrap=f.wrap, hit=f.hit;
    input.classList.add('dp-input'); input.tabIndex=-1;
    var txt=disp.querySelector('.dp-text');
    function refresh(){var p=parse(input.value);if(p){txt.textContent=fmt(p);txt.classList.remove('dp-ph');}else{txt.textContent='Select a date';txt.classList.add('dp-ph');}hit.disabled=input.disabled;}
    hookValue(input,HTMLInputElement.prototype,refresh);
    input.addEventListener('input',refresh); input.addEventListener('change',refresh);
    hit.addEventListener('click',function(){ if(L&&S&&S.input===input) closeLayer(); else openDate(input,wrap,hit); });
    refresh();
  }
  function openDate(input,wrap,hit){
    var n=new Date(),today={y:n.getFullYear(),m:n.getMonth(),d:n.getDate()},cur=parse(input.value),base=cur||today;
    S={input:input,view:'days',y:base.y,m:base.m,sel:cur,focus:{y:base.y,m:base.m,d:base.d},today:today,min:parse(input.min),max:parse(input.max)};
    openLayer({wrap:wrap,hit:hit,cls:'',aria:'Choose a date',render:renderDate,onClick:dateClick,onKey:dateKey,afterOpen:focusDay,onClose:function(){S=null;}});
  }
  function focusDay(){ if(!L) return; var e=L.pop.querySelector('.dp-d[tabindex="0"],.dp-m.sel,.dp-m.today,.dp-m'); if(e) e.focus({preventScroll:true}); }
  function renderDate(dir){
    var s=S,h='',pop=L.pop;
    var big=s.sel?(DOWS[dow(s.sel)]+', '+s.sel.d+' '+MS[s.sel.m]):'Pick a date', yr=s.sel?s.sel.y:s.y, hint='No date selected';
    if(s.sel){var df=Math.round((Date.UTC(s.sel.y,s.sel.m,s.sel.d)-Date.UTC(s.today.y,s.today.m,s.today.d))/864e5);
      hint=df===0?'Today':df===1?'Tomorrow':df===-1?'Yesterday':df>1?'In '+df+' days':(-df)+' days ago';}
    h+='<div class="dp-band"><div class="dp-cap"><span class="dp-capi">'+IC.cal+'</span>Select date</div>'+
       '<button type="button" class="dp-x" data-act="close" aria-label="Close calendar">'+IC.x+'</button>'+
       '<div class="dp-big">'+big+'</div><div class="dp-meta"><button type="button" class="dp-year" data-act="years" aria-label="Choose year">'+yr+IC.down+'</button><span class="dp-chip">'+hint+'</span></div></div>';
    var title,tAct;
    if(s.view==='days'){title=MONTHS[s.m]+' '+s.y;tAct='months';}
    else if(s.view==='months'){title=String(s.y);tAct='years';}
    else{var st=Math.floor(s.y/12)*12;title=st+' – '+(st+11);tAct='days';}
    h+='<div class="dp-main"><div class="dp-nav"><button type="button" class="dp-arrow" data-act="prev" aria-label="Previous">'+IC.l+'</button><button type="button" class="dp-title" data-act="'+tAct+'" aria-live="polite">'+title+'</button><button type="button" class="dp-arrow" data-act="next" aria-label="Next">'+IC.r+'</button></div>';
    h+='<div class="dp-body'+(dir?' dp-'+dir:'')+'">';
    if(s.view==='days'){
      var dim=new Date(s.y,s.m+1,0).getDate();
      if(!(s.focus.y===s.y&&s.focus.m===s.m)) s.focus={y:s.y,m:s.m,d:Math.min(s.focus.d,dim)};
      var first=new Date(s.y,s.m,1).getDay();
      h+='<div class="dp-dow">'+DOW2.map(function(x){return '<span>'+x+'</span>';}).join('')+'</div><div class="dp-grid" role="grid">';
      for(var i=0;i<42;i++){
        var dt=new Date(s.y,s.m,i-first+1),cy=dt.getFullYear(),cm=dt.getMonth(),cd=dt.getDate(),out=cm!==s.m,cls='dp-d';
        if(out)cls+=' out'; if(dt.getDay()===0)cls+=' sun';
        if(cy===s.today.y&&cm===s.today.m&&cd===s.today.d)cls+=' today';
        var sel=s.sel&&s.sel.y===cy&&s.sel.m===cm&&s.sel.d===cd; if(sel)cls+=' sel';
        if(isDis(cy,cm,cd))cls+=' dis';
        h+='<button type="button" class="'+cls+'" data-act="pick" data-iso="'+iso(cy,cm,cd)+'" tabindex="'+((!out&&cd===s.focus.d)?0:-1)+'" aria-pressed="'+(!!sel)+'" aria-label="'+DOWS[dt.getDay()]+' '+cd+' '+MONTHS[cm]+' '+cy+'">'+cd+'</button>';
      }
      h+='</div>';
    } else if(s.view==='months'){
      h+='<div class="dp-mgrid">';
      for(var m=0;m<12;m++){var c='dp-m';if(s.sel&&s.sel.y===s.y&&s.sel.m===m)c+=' sel';if(s.today.y===s.y&&s.today.m===m)c+=' today';
        h+='<button type="button" class="'+c+'" data-act="month" data-v="'+m+'">'+MS[m]+'</button>';}
      h+='</div>';
    } else {
      var y0=Math.floor(s.y/12)*12;h+='<div class="dp-mgrid">';
      for(var j=0;j<12;j++){var yy=y0+j,c2='dp-m';if(s.sel&&s.sel.y===yy)c2+=' sel';if(s.today.y===yy)c2+=' today';
        if((s.min&&yy<s.min.y)||(s.max&&yy>s.max.y))c2+=' dis';
        h+='<button type="button" class="'+c2+'" data-act="year" data-v="'+yy+'">'+yy+'</button>';}
      h+='</div>';
    }
    h+='</div></div>';
    if(s.view==='days'){
      var T=s.today, q=[['Yesterday',-1],['Tomorrow',1],['Next week',7]];
      h+='<div class="dp-quick">'+q.map(function(x){var d=new Date(T.y,T.m,T.d+x[1]);return '<button type="button" class="dp-q'+(isDis(d.getFullYear(),d.getMonth(),d.getDate())?' dis':'')+'" data-act="pick" data-iso="'+iso(d.getFullYear(),d.getMonth(),d.getDate())+'">'+x[0]+'</button>';}).join('')+'</div>';
    }
    var tdis=isDis(s.today.y,s.today.m,s.today.d), req=s.input.required;
    h+='<div class="dp-foot'+(req?' one':'')+'">'+(req?'':'<button type="button" class="dp-btn dp-clear" data-act="clear">'+IC.trash+'Clear</button>')+'<button type="button" class="dp-btn dp-today'+(tdis?' dis':'')+'" data-act="today">'+IC.today+'Today</button></div>';
    pop.innerHTML=h; place();
  }
  function commitDate(v){var i=S.input;i.value=v;fire(i);closeLayer();}
  function dateClick(e){
    var b=e.target.closest('[data-act]'); if(!b||!S) return;
    var a=b.getAttribute('data-act'),s=S;
    if(a==='pick'){commitDate(b.getAttribute('data-iso'));return;}
    if(a==='close'){closeLayer();return;}
    if(a==='clear'){commitDate('');return;}
    if(a==='today'){if(!isDis(s.today.y,s.today.m,s.today.d))commitDate(iso(s.today.y,s.today.m,s.today.d));return;}
    if(a==='prev'||a==='next'){var k=a==='next'?1:-1;
      if(s.view==='days'){s.m+=k;if(s.m<0){s.m=11;s.y--;}if(s.m>11){s.m=0;s.y++;}}
      else if(s.view==='months')s.y+=k; else s.y+=12*k;
      renderDate(k>0?'next':'prev');return;}
    if(a==='months'||a==='years'||a==='days'){s.view=a;renderDate();focusDay();return;}
    if(a==='month'){s.m=+b.getAttribute('data-v');s.view='days';renderDate();focusDay();return;}
    if(a==='year'){s.y=+b.getAttribute('data-v');s.view='months';renderDate();focusDay();return;}
  }
  function dateKey(e){
    var s=S;if(!s)return;
    if(e.key==='Tab'){trapTab(e);return;}
    if(!e.target.classList.contains('dp-d'))return;
    var f0=s.focus,nd=null,dl=0;
    if(e.key==='ArrowLeft')dl=-1;else if(e.key==='ArrowRight')dl=1;else if(e.key==='ArrowUp')dl=-7;else if(e.key==='ArrowDown')dl=7;
    if(dl)nd=new Date(f0.y,f0.m,f0.d+dl);
    else if(e.key==='PageUp')nd=new Date(f0.y,f0.m-1,f0.d);
    else if(e.key==='PageDown')nd=new Date(f0.y,f0.m+1,f0.d);
    else if(e.key==='Home')nd=new Date(f0.y,f0.m,f0.d-new Date(f0.y,f0.m,f0.d).getDay());
    else if(e.key==='End')nd=new Date(f0.y,f0.m,f0.d+(6-new Date(f0.y,f0.m,f0.d).getDay()));
    else return;
    e.preventDefault();
    var ch=nd.getMonth()!==s.m||nd.getFullYear()!==s.y;
    s.focus={y:nd.getFullYear(),m:nd.getMonth(),d:nd.getDate()};s.y=s.focus.y;s.m=s.focus.m;
    renderDate(ch?(nd>new Date(f0.y,f0.m,f0.d)?'next':'prev'):null);focusDay();
  }

  /* ---------- CUSTOM DROPDOWN (replaces native <select>) ---------- */
  var X=null;
  function optsOf(sel){return [].map.call(sel.options,function(o,i){return {value:o.value,text:o.textContent,i:i};});}
  function enhanceSelect(sel){
    if(sel.multiple||sel.size>1) return;
    var disp=el('div','dp-display sx-display'); disp.setAttribute('aria-hidden','true');
    disp.innerHTML='<span class="sx-slot"></span><span class="dp-text"></span><span class="dp-caret">'+IC.down+'</span>';
    var lab=labelOf(sel)||'Option';
    var f=wrapField(sel,disp,lab+': choose option'), wrap=f.wrap, hit=f.hit;
    sel.classList.add('sx-select'); sel.tabIndex=-1;
    var txt=disp.querySelector('.dp-text'), slot=disp.querySelector('.sx-slot');
    function refresh(){
      var o=sel.options[sel.selectedIndex];
      if(o&&o.value!==''){txt.textContent=o.textContent;txt.classList.remove('dp-ph');slot.outerHTML=bubble(visual(o.value,sel.selectedIndex)).replace('class="sx-b"','class="sx-b sx-slot"');}
      else{txt.textContent=o?o.textContent:'Choose an option';txt.classList.add('dp-ph');var s2=disp.querySelector('.sx-b.sx-slot,.sx-slot');if(s2)s2.outerHTML='<span class="dp-ico sx-slot">'+IC.list+'</span>';}
      slot=disp.querySelector('.sx-slot'); hit.disabled=sel.disabled;
    }
    hookValue(sel,HTMLSelectElement.prototype,refresh);
    sel.addEventListener('change',refresh); sel.addEventListener('input',refresh);
    hit.addEventListener('click',function(){ if(L&&X&&X.sel===sel) closeLayer(); else openSelect(sel,wrap,hit,lab); });
    refresh();
  }
  function openSelect(sel,wrap,hit,lab){
    var all=optsOf(sel), items=all.filter(function(o){return !(o.value===''&&sel.required);});
    var curIdx=-1; items.forEach(function(o,k){if(o.value===sel.value)curIdx=k;});
    X={sel:sel,items:items,act:Math.max(0,curIdx),lab:lab};
    openLayer({wrap:wrap,hit:hit,cls:'sx-pop',aria:lab,matchWidth:true,role:'listbox',render:renderSelect,onClick:selClick,onKey:selKey,
      afterOpen:function(){var a=L&&L.pop.querySelector('.sx-opt.act');if(a){a.scrollIntoView({block:'nearest'});a.focus({preventScroll:true});}},onClose:function(){X=null;}});
  }
  function renderSelect(){
    var h='<div class="dp-band sx-band"><span class="sx-hico">'+IC.list+'</span><div style="min-width:0"><div class="sx-ttl">'+esc(X.lab)+'</div><div class="sx-sub">Choose one option</div></div>'+
      '<button type="button" class="dp-x" data-act="close" aria-label="Close">'+IC.x+'</button></div><div class="sx-list" role="presentation">';
    X.items.forEach(function(o,k){
      var none=o.value==='', on=o.value===X.sel.value;
      h+='<button type="button" class="sx-opt'+(on?' on':'')+(k===X.act?' act':'')+(none?' none':'')+'" role="option" aria-selected="'+on+'" data-act="opt" data-k="'+k+'" tabindex="'+(k===X.act?0:-1)+'">'+
        (none?'<span class="sx-b" style="--c:#64748b;--cb:rgba(100,116,139,.14)">'+IC.x+'</span>':bubble(visual(o.value,o.i)))+
        '<span class="sx-t">'+esc(none?'No selection':o.text)+'</span><span class="sx-chk">'+IC.check+'</span></button>';
    });
    h+='</div>';
    L.pop.innerHTML=h; place();
  }
  function pickOpt(k){var o=X.items[k];if(!o)return;var s=X.sel;s.value=o.value;fire(s);closeLayer();}
  function selClick(e){
    var b=e.target.closest('[data-act]');if(!b||!X)return;
    if(b.getAttribute('data-act')==='close'){closeLayer();return;}
    if(b.getAttribute('data-act')==='opt')pickOpt(+b.getAttribute('data-k'));
  }
  function selKey(e){
    if(!X)return;
    if(e.key==='Tab'){trapTab(e);return;}
    var n=X.items.length,k=X.act;
    if(e.key==='ArrowDown')k=(k+1)%n;else if(e.key==='ArrowUp')k=(k-1+n)%n;else if(e.key==='Home')k=0;else if(e.key==='End')k=n-1;else return;
    e.preventDefault();X.act=k;
    var list=L.pop.querySelectorAll('.sx-opt');
    [].forEach.call(list,function(b,i){b.classList.toggle('act',i===k);b.tabIndex=i===k?0:-1;});
    list[k].focus({preventScroll:true});list[k].scrollIntoView({block:'nearest'});
  }

  /* ---------- NUMBER STEPPER ---------- */
  function enhanceNumber(inp){
    var w=el('div','nx-wrap'); inp.parentNode.insertBefore(w,inp); w.appendChild(inp);
    var b=el('div','nx-btns');
    b.innerHTML='<button type="button" class="nx-b" data-d="-1" tabindex="-1" aria-label="Decrease">'+IC.minus+'</button><button type="button" class="nx-b" data-d="1" tabindex="-1" aria-label="Increase">'+IC.plus+'</button>';
    w.appendChild(b);
    b.addEventListener('click',function(e){
      var x=e.target.closest('.nx-b');if(!x)return;
      var st=parseFloat(inp.step);if(!(st>0))st=1;
      var v=parseFloat(inp.value);if(isNaN(v))v=0;
      var n=Math.round((v+(+x.getAttribute('data-d'))*st)*1e6)/1e6,mn=parseFloat(inp.min),mx=parseFloat(inp.max);
      if(!isNaN(mn)&&n<mn)n=mn;if(!isNaN(mx)&&n>mx)n=mx;
      inp.value=String(n);fire(inp);inp.focus({preventScroll:true});
    });
  }

  /* ---------- VALIDATION MESSAGES (no browser bubbles) ---------- */
  function msgFor(c){
    var l=labelOf(c)||'This field', v=c.validity;
    if(v.valueMissing) return (c.tagName==='SELECT'||c.type==='date')?'Please choose '+l.toLowerCase():l+' is required';
    if(v.typeMismatch) return c.type==='email'?'Enter a valid email address':c.type==='url'?'Enter a valid URL starting with https://':'Please enter a valid value';
    if(v.patternMismatch) return 'Please match the requested format';
    if(v.tooShort||v.tooLong) return 'Please check the length';
    if(v.rangeUnderflow||v.rangeOverflow) return 'Value is out of range';
    return 'Please check this value';
  }
  function clearErr(host){
    var ff=host.closest('.form-field'); if(!ff) return;
    ff.classList.remove('fx-invalid'); var e=ff.querySelector('.fx-error'); if(e) e.remove();
  }
  function validate(form){
    [].forEach.call(form.querySelectorAll('.fx-error'),function(n){n.remove();});
    [].forEach.call(form.querySelectorAll('.fx-invalid'),function(n){n.classList.remove('fx-invalid');});
    var first=null;
    [].forEach.call(form.querySelectorAll('input,textarea,select'),function(c){
      if(c.type==='checkbox'||c.disabled||c.validity.valid) return;
      var ff=c.closest('.form-field')||c.parentNode; ff.classList.add('fx-invalid');
      var er=el('div','fx-error'); er.setAttribute('role','alert'); er.innerHTML=IC.warn+'<span>'+esc(msgFor(c))+'</span>';
      var host=c.closest('.dp-wrap,.nx-wrap')||c; host.insertAdjacentElement('afterend',er);
      if(!first) first={c:c,host:host};
    });
    if(first){
      var tgt=first.host.querySelector&&first.host.querySelector('.dp-hit')||first.c;
      try{tgt.focus({preventScroll:true});}catch(e){}
      first.host.scrollIntoView({block:'center',behavior:'smooth'});
      first.host.classList.remove('fx-shake'); void first.host.offsetWidth; first.host.classList.add('fx-shake');
    }
    return !first;
  }
  function setupForm(){
    var f=document.getElementById('recordForm'); if(!f) return;
    f.noValidate=true;
    f.addEventListener('input',function(e){clearErr(e.target);});
    f.addEventListener('change',function(e){clearErr(e.target);});
    document.addEventListener('submit',function(e){
      if(e.target!==f) return;
      if(!validate(f)){e.preventDefault();e.stopImmediatePropagation();}
    },true);
  }

  /* ---------- scan & observe ---------- */
  function enhance(node){
    if(node.dataset.uiReady||!node.parentNode) return; node.dataset.uiReady='1';
    var t=node.tagName;
    if(t==='SELECT') enhanceSelect(node);
    else if(node.type==='date') enhanceDate(node);
    else if(node.type==='number'&&node.closest('.form-field')) enhanceNumber(node);
    if(node.closest&&node.closest('#recordForm')&&t!=='SELECT') node.setAttribute('autocomplete','off');
  }
  function scan(root){
    if(!root||root.nodeType!==1) return;
    if(root.closest&&root.closest('#rightPanel,.doc-menu')) return;
    var sel='select,input[type="date"],input[type="number"]';
    if(root.matches&&root.matches(sel)) enhance(root);
    [].forEach.call(root.querySelectorAll?root.querySelectorAll(sel):[],enhance);
  }
  function start(){
    setupForm(); scan(document.body);
    new MutationObserver(function(ms){ms.forEach(function(m){var t=m.target; if(t&&t.closest&&t.closest('#rightPanel,#toast,.doc-menu')) return; m.addedNodes.forEach(scan);});}).observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
