/* ===== Calendar month editor: simple cards (details, quote, tithi, programs, events, muhurta) + auto tithis ===== */
(function(){
'use strict';
var NP=['०','१','२','३','४','५','६','७','८','९'], toNp=function(n){return String(n).split('').map(function(d){return NP[d]||d;}).join('');};
var BS_MONTHS=['वैशाख','जेठ','असार','श्रावण','भदौ','असोज','कार्तिक','मंसिर','पुस','माघ','फागुन','चैत्र'];
var AD_MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var DOW=['Sunday / आइतबार','Monday / सोमबार','Tuesday / मंगलबार','Wednesday / बुधबार','Thursday / बिहीबार','Friday / शुक्रबार','Saturday / शनिबार'];
var DAY_MS=86400000, R=Math.PI/180;
var TN=['प्रतिपदा','द्वितीया','तृतीया','चतुर्थी','पञ्चमी','षष्ठी','सप्तमी','अष्टमी','नवमी','दशमी','एकादशी','द्वादशी','त्रयोदशी','चतुर्दशी','पूर्णिमा'];
function tName(n){ return n===30?'औंशी':TN[(n-1)%15]; }

/* ---- tithi from moon/sun longitude at the Nepali sunrise window (checked against the school's Chaitra 2083 data) ---- */
function tithiPos(ms){
  var d=ms/DAY_MS-10957.5, L0=280.460+0.9856474*d, Ms=357.528+0.9856003*d;
  var sun=L0+1.915*Math.sin(Ms*R)+0.020*Math.sin(2*Ms*R);
  var Lm=218.316+13.176396*d, Mm=134.963+13.064993*d, D=297.850+12.190749*d;
  var moon=Lm+6.289*Math.sin(Mm*R)+1.274*Math.sin((2*D-Mm)*R)+0.658*Math.sin(2*D*R)+0.214*Math.sin(2*Mm*R)-0.186*Math.sin(Ms*R);
  return (((moon-sun)%360+360)%360)/12;
}
function autoTithis(startMs,days){
  var t=[],i; for(i=0;i<=days;i++) t.push(Math.floor(tithiPos(startMs+i*DAY_MS+2.5*3600000))+1);
  var out=[]; for(i=0;i<days;i++){ var a=t[i], diff=(((t[i+1]-a)%30)+30)%30; out.push(diff===2? tName(a)+'/'+tName(a%30+1) : tName(a)); }
  return out;
}

function utcMs(v){ var d=new Date(v); return isNaN(d)?null:Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()); }
function isoOf(ms){ return new Date(ms).toISOString(); }
function ymd(ms){ return new Date(ms).toISOString().slice(0,10); }
function nameAD(startMs,days){
  var a=new Date(startMs), b=new Date(startMs+(days-1)*DAY_MS);
  if(a.getUTCFullYear()!==b.getUTCFullYear()) return AD_MON[a.getUTCMonth()]+' '+a.getUTCFullYear()+' / '+AD_MON[b.getUTCMonth()]+' '+b.getUTCFullYear();
  if(a.getUTCMonth()===b.getUTCMonth()) return AD_MON[a.getUTCMonth()]+' '+a.getUTCFullYear();
  return AD_MON[a.getUTCMonth()]+' / '+AD_MON[b.getUTCMonth()]+' '+b.getUTCFullYear();
}
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ---- existing rows (for defaults) ---- */
async function getRows(){
  try{
    if(typeof currentView!=='undefined' && currentView==='collection' && Array.isArray(records) && records.length && records[0].month_idx!==undefined) return records;
    var token=localStorage.getItem(tokenKey)||sessionStorage.getItem(tokenKey);
    var data=await rpc(ADMIN_CONFIG.rpc.list,{p_session_token:token,p_table:'calendar_data',p_limit:1000});
    return Array.isArray(data)?data:(data&&(data.records||data.data))||[];
  }catch(e){ return []; }
}
function dataOf(r){ var d=r&&r.data; if(typeof d==='string'){ try{d=JSON.parse(d);}catch(e){d=null;} } return d&&typeof d==='object'?d:null; }

/* ---- styles ---- */
if(!document.getElementById('ce-styles')){
  var st=document.createElement('style'); st.id='ce-styles';
  st.textContent=
  '.ce-wrap{grid-column:1/-1;display:flex;flex-direction:column;gap:12px;margin:4px 0 8px}'+
  '.ce-card{border:1px solid var(--pm-line,rgba(15,23,42,.1));background:var(--pm-card,var(--surface-solid,#fff));border-radius:18px;padding:14px 14px 12px;box-shadow:0 6px 18px -14px rgba(15,23,42,.35)}'+
  '.ce-card>h4{margin:0 0 10px;display:flex;align-items:center;gap:8px;font-size:.95rem;font-weight:800;color:var(--pm-text,var(--text,#0f172a))}'+
  '.ce-card>h4 i{color:var(--primary,#f39c12);font-size:1.15rem}'+
  '.ce-card>h4{flex-wrap:wrap}.ce-card>h4 small{margin-left:auto;font-weight:600;font-size:.72rem;opacity:.65;flex-basis:100%;margin-left:0}'+
  '.ce-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ce-grid .full{grid-column:1/-1}'+
  '.ce-wrap .form-field{margin:0}.ce-wrap label{font-size:.78rem}'+
  '.ce-wrap textarea{min-height:76px;resize:vertical;width:100%;box-sizing:border-box}'+
  '.ce-wrap textarea.ce-tithi{min-height:120px;line-height:1.7}'+
  '.ce-row{display:grid;grid-template-columns:64px 1fr 34px;gap:8px;align-items:center;margin-bottom:8px}'+
  '.ce-row.ev{grid-template-columns:64px minmax(0,1fr) 34px;padding-bottom:10px;border-bottom:1px dashed var(--pm-line,rgba(15,23,42,.12))}.ce-row.ev .ce-tick{grid-column:1/-1;grid-row:2;flex-direction:row;flex-wrap:wrap;gap:6px 18px}.ce-row.ev .ce-x{grid-column:3;grid-row:1}'+
  '.ce-row .field{min-width:0;width:100%;box-sizing:border-box}'+
  '.ce-tick{display:flex;flex-direction:column;gap:4px}.ce-hol{display:flex;align-items:center;gap:5px;font-size:.74rem;font-weight:700;white-space:nowrap}'+
  '.ce-hol input{width:18px;height:18px;accent-color:var(--primary,#f39c12)}'+
  '.ce-x{width:34px;height:34px;border-radius:50%;border:1px solid var(--pm-line,rgba(15,23,42,.12));background:transparent;color:#ef4444;font-size:1rem;cursor:pointer;display:grid;place-items:center}'+
  '.ce-btn{display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:0 14px;border-radius:999px;border:1px dashed var(--primary,#f39c12);background:rgba(243,156,18,.08);color:var(--primary-dark,#b9770e);font:700 .8rem inherit;cursor:pointer}'+
  '.ce-btn.solid{border-style:solid;background:var(--primary-gradient,linear-gradient(135deg,#f39c12,#f5b041));color:#fff;border-color:transparent}'+
  '.ce-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}'+
  '.ce-note{font-size:.74rem;opacity:.72;margin:6px 0 0;line-height:1.5}.ce-note b{color:var(--primary-dark,#b9770e)}'+
  '.ce-count{font-size:.76rem;font-weight:800;padding:3px 10px;border-radius:999px;background:rgba(34,197,94,.14);color:#15803d}.ce-count.bad{background:rgba(239,68,68,.14);color:#b91c1c}'+
  '.ce-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.ce-chip{font-size:.72rem;padding:3px 9px;border-radius:999px;border:1px solid var(--pm-line,rgba(15,23,42,.1));background:rgba(243,156,18,.07)}.ce-chip b{color:var(--primary-dark,#b9770e);margin-right:4px}'+
  '.ce-adv{grid-column:1/-1;border:1px dashed var(--pm-line,rgba(15,23,42,.18));border-radius:16px;padding:8px 12px;margin-top:6px}.ce-adv>summary{cursor:pointer;font-weight:800;font-size:.85rem;padding:6px 0}'+
  '@media(max-width:420px){.ce-grid{grid-template-columns:1fr}.ce-row.ev,.ce-row{grid-template-columns:56px minmax(0,1fr) 34px}}';
  document.head.appendChild(st);
}

var prevOpen=openEditor;
openEditor=function(row,table){
  prevOpen.apply(this,arguments);
  if(currentTable!=='calendar_data') return;
  try{ mount(row); }catch(e){ console.error('[calendar editor]',e); }
};

function mount(row){
  var ta=document.getElementById('f_data'), mi=document.getElementById('f_month_idx'), yi=document.getElementById('f_year_bs');
  if(!ta||!mi||!yi) return;
  var advField=ta.closest('.form-field'); if(!advField) return;
  var S={}; try{ S=JSON.parse(ta.value||'{}')||{}; }catch(e){ S={}; }
  var isNew=!row, autoT=isNew, rowsCache=null, lastYearData=null;
  var wrap=document.createElement('div'); wrap.className='ce-wrap';
  var adv=document.createElement('details'); adv.className='ce-adv';
  adv.innerHTML='<summary>⚙️ Advanced — edit the full JSON</summary>';
  advField.before(wrap); advField.before(adv); adv.append(advField);
  var lab=advField.querySelector('label'); if(lab) lab.textContent='Calendar data (JSON) — updates automatically from the cards above';

  /* month hint under the month number */
  function updHint(){}   /* label under the month number removed */

  function ensure(){ if(!Array.isArray(S.tithis)) S.tithis=[]; if(!Array.isArray(S.programs)) S.programs=[]; if(!S.events||typeof S.events!=='object'||Array.isArray(S.events)){ var o={}; (Array.isArray(S.events)?S.events:[]).forEach(function(e){ if(e&&e.day!=null&&e.title) o[e.day]={title:e.title,isHoliday:!!e.isHoliday}; }); S.events=o; } }
  (function migrate(){   /* old data kept everything in one "muhurta" text: split it into the three boxes */
    var m=String(S.muhurta||''); if(!m||S.pasni||S.bibah||S.bratabandha) return;
    var re=/(पास्नी|विवाह|बिबाह|व्रतबन्ध|ब्रतबन्ध|उपनयन)[^:ः]*[:ः]/g, hits=[], x;
    while((x=re.exec(m))) hits.push({k:x[1],i:x.index,e:re.lastIndex});
    if(!hits.length) return;
    hits.forEach(function(h,n){ var v=m.slice(h.e,n+1<hits.length?hits[n+1].i:m.length).replace(/[;|,\s]+$/,'').trim(); var key=h.k==='पास्नी'?'pasni':(h.k==='विवाह'||h.k==='बिबाह')?'bibah':'bratabandha'; if(v) S[key]=v; });
    if(S.pasni||S.bibah||S.bratabandha) S.muhurta='';
  })();
  ensure();
  var evRows=Object.keys(S.events).map(function(d){ return {day:d,title:S.events[d].title||'',isHoliday:!!S.events[d].isHoliday,workday:!!S.events[d].workday}; });
  var pgRows=S.programs.map(function(p){ return Object.assign({},p); });

  function commit(){
    var ev={}; evRows.slice().sort(function(a,b){return (+a.day||0)-(+b.day||0);}).forEach(function(r){ var d=parseInt(r.day,10); if(d>=1&&d<=32&&String(r.title).trim()) ev[String(d)]=r.workday&&!r.isHoliday?{title:String(r.title).trim(),isHoliday:false,workday:true}:{title:String(r.title).trim(),isHoliday:!!r.isHoliday}; });
    var pg=pgRows.filter(function(p){ return parseInt(p.day,10)>=1&&String(p.title||'').trim(); }).map(function(p){ return Object.assign({},p,{day:parseInt(p.day,10),title:String(p.title).trim()}); }).sort(function(a,b){return a.day-b.day;});
    var order=['quote','events','nameAD','nameBS','tithis','pasni','bibah','bratabandha','muhurta','programs','daysCount','adStartDate','startDayOfWeek'];
    var out={}, src=Object.assign({},S,{events:ev,programs:pg});
    order.forEach(function(k){ if(src[k]!==undefined) out[k]=src[k]; });
    Object.keys(src).forEach(function(k){ if(!(k in out)) out[k]=src[k]; });
    ta.value=JSON.stringify(out,null,2);
    ta.dispatchEvent(new Event('input',{bubbles:true}));
  }
  function startMs(){ return S.adStartDate?utcMs(S.adStartDate):null; }
  function recompute(){   /* derived values from start date + days */
    var ms=startMs(), n=parseInt(S.daysCount,10)||30;
    if(ms==null) return;
    S.startDayOfWeek=new Date(ms).getUTCDay();
    S.nameAD=nameAD(ms,n);
    if(autoT) S.tithis=autoTithis(ms,n);
    else { while(S.tithis.length<n) S.tithis.push(''); if(S.tithis.length>n) S.tithis.length=n; }
  }

  function render(){
    var ms=startMs(), n=parseInt(S.daysCount,10)||30;
    var tcount=S.tithis.filter(function(t){return String(t).trim();}).length;
    var sd=ms!=null?ymd(ms):'';
    var h='';
    h+='<div class="ce-card"><h4><i class="ri-calendar-event-line"></i>Month details<small>'+(isNew?'filled automatically':'')+'</small></h4><div class="ce-grid">'+
      '<div class="form-field"><label>Name in Nepali (BS)</label><input class="field" data-k="nameBS" value="'+esc(S.nameBS||'')+'" placeholder="e.g. वैशाख २०८४"></div>'+
      '<div class="form-field"><label>Name in English (AD)</label><input class="field" data-k="nameAD" value="'+esc(S.nameAD||'')+'" placeholder="e.g. Apr / May 2027"></div>'+
      '<div class="form-field"><label>Number of days</label><input class="field" type="number" min="28" max="32" data-k="daysCount" value="'+esc(n)+'"></div>'+
      '<div class="form-field"><label>First day (AD date)</label><input class="field" type="date" data-k="adStartDate" value="'+sd+'"></div>'+
      '<div class="form-field full"><label>Starts on</label><input class="field" disabled value="'+(ms!=null?DOW[new Date(ms).getUTCDay()]:'Pick the first day above')+'"></div>'+
      '</div>'+(ms==null?'<p class="ce-note"><b>Pick the AD date of the 1st day.</b> Weekday, English name and tithis fill in by themselves.</p>':'')+'</div>';
    h+='<div class="ce-card"><h4><i class="ri-double-quotes-l"></i>Quote / सुविचार</h4><div class="form-field"><textarea data-k="quote" placeholder="One thought shown under the calendar">'+esc(S.quote||'')+'</textarea></div></div>';
    h+='<div class="ce-card"><h4><i class="ri-moon-line"></i>Tithi / तिथि<small><span class="ce-count'+(tcount===n?'':' bad')+'">'+tcount+' / '+n+' days</span></small></h4>'+
      '<div class="form-field"><textarea class="ce-tithi" data-k="tithis" placeholder="सप्तमी, अष्टमी/नवमी, दशमी, …">'+esc(S.tithis.join(', '))+'</textarea></div>'+
      '<p class="ce-note">One tithi per day, separated by <b>commas</b>. When two tithis fall on the same day, join them with a <b>slash</b>, e.g. <b>अष्टमी/नवमी</b>.</p>'+
      '<div class="ce-bar"><button type="button" class="ce-btn solid" data-act="autot"><i class="ri-magic-line"></i> Auto-fill tithis</button>'+(autoT?'<span class="ce-note" style="margin:0">Auto mode is on — change the first day or number of days and tithis follow.</span>':'<span class="ce-note" style="margin:0">Manual edits kept.</span>')+'</div>'+
      (tcount?'<div class="ce-chips">'+S.tithis.map(function(t,i){ return '<span class="ce-chip"><b>'+toNp(i+1)+'</b>'+esc(t)+'</span>'; }).join('')+'</div>':'')+'</div>';
    h+='<div class="ce-card"><h4><i class="ri-flag-line"></i>School programs / कार्यक्रम</h4>'+
      pgRows.map(function(p,i){ return '<div class="ce-row"><input class="field" type="number" min="1" max="32" placeholder="Day" data-pg="'+i+'" data-f="day" value="'+esc(p.day==null?'':p.day)+'"><input class="field" placeholder="Program title" data-pg="'+i+'" data-f="title" value="'+esc(p.title||'')+'"><button type="button" class="ce-x" data-act="delpg" data-i="'+i+'" aria-label="Remove"><i class="ri-close-line"></i></button></div>'; }).join('')+
      '<div class="ce-bar"><button type="button" class="ce-btn" data-act="addpg"><i class="ri-add-line"></i> Add program</button></div></div>';
    h+='<div class="ce-card"><h4><i class="ri-star-line"></i>Events &amp; holidays / पर्व<small>Sat/Sun stay red unless "Working day" is ticked</small></h4>'+
      evRows.map(function(e,i){ return '<div class="ce-row ev"><input class="field" type="number" min="1" max="32" placeholder="Day" data-ev="'+i+'" data-f="day" value="'+esc(e.day)+'"><input class="field" placeholder="Event / festival name" data-ev="'+i+'" data-f="title" value="'+esc(e.title)+'"><span class="ce-tick"><label class="ce-hol"><input type="checkbox" data-ev="'+i+'" data-f="isHoliday"'+(e.isHoliday?' checked':'')+'> Holiday</label><label class="ce-hol"><input type="checkbox" data-ev="'+i+'" data-f="workday"'+(e.workday?' checked':'')+'> Working day</label></span><button type="button" class="ce-x" data-act="delev" data-i="'+i+'" aria-label="Remove"><i class="ri-close-line"></i></button></div>'; }).join('')+
      '<div class="ce-bar"><button type="button" class="ce-btn" data-act="addev"><i class="ri-add-line"></i> Add event</button>'+(lastYearData?'<button type="button" class="ce-btn" data-act="copyly"><i class="ri-file-copy-line"></i> Copy from last year</button>':'')+'</div></div>';
    h+='<div class="ce-card"><h4><i class="ri-heart-line"></i>Auspicious dates / साइत-मुहूर्त<small>all optional</small></h4><div class="ce-grid">'+
      '<div class="form-field full"><label>पास्नी (Pasni) — days</label><input class="field" data-k="pasni" value="'+esc(S.pasni||'')+'" placeholder="e.g. २, ३, १०, १८"></div>'+
      '<div class="form-field full"><label>विवाह (Bibah / Marriage) — days</label><input class="field" data-k="bibah" value="'+esc(S.bibah||'')+'" placeholder="e.g. ५, ६, १२"></div>'+
      '<div class="form-field full"><label>व्रतबन्ध (Bratabandha) — days</label><input class="field" data-k="bratabandha" value="'+esc(S.bratabandha||'')+'" placeholder="e.g. ८, २०"></div>'+
      '<div class="form-field full"><label>Other note (optional)</label><input class="field" data-k="muhurta" value="'+esc(S.muhurta||'')+'" placeholder="Anything else to show"></div>'+
      '</div><p class="ce-note">Leave any of these empty and it will not show on the calendar.</p></div>';
    var keep=wrap.scrollTop; wrap.innerHTML=h;
  }

  function rerender(){ var y=window.scrollY; var a=document.activeElement, key=a&&(a.getAttribute('data-k')||'')+'|'+(a.getAttribute('data-ev')||a.getAttribute('data-pg')||'')+'|'+(a.getAttribute('data-f')||''); render(); }

  /* typing in simple fields must not rebuild the cards (keeps focus); only structural changes rebuild */
  wrap.addEventListener('input',function(e){
    var t=e.target, k=t.getAttribute('data-k');
    if(k){
      if(k==='daysCount'){ var v=parseInt(t.value,10); if(!(v>=28&&v<=32)) return; S.daysCount=v; recompute(); commit(); render(); restoreFocus(k); return; }
      if(k==='adStartDate'){ if(!t.value){ delete S.adStartDate; commit(); return; } S.adStartDate=isoOf(Date.parse(t.value+'T00:00:00Z')); recompute(); commit(); render(); restoreFocus(k); return; }
      if(k==='tithis'){ autoT=false; S.tithis=t.value.split(/[,\n،]+/).map(function(x){return x.trim();}).filter(Boolean); commit(); var c=wrap.querySelector('.ce-count'), n=parseInt(S.daysCount,10)||30; if(c){ c.textContent=S.tithis.length+' / '+n+' days'; c.classList.toggle('bad',S.tithis.length!==n); } return; }
      S[k]=t.value; commit(); return;
    }
    var ev=t.getAttribute('data-ev'), pg=t.getAttribute('data-pg'), f=t.getAttribute('data-f');
    if(ev!=null){ evRows[+ev][f]=(f==='isHoliday'||f==='workday')?t.checked:t.value; commit(); }
    else if(pg!=null){ pgRows[+pg][f]=t.value; commit(); }
  });
  wrap.addEventListener('change',function(e){ if(e.target.getAttribute('data-k')==='tithis') render(); });
  function restoreFocus(k){ var el=wrap.querySelector('[data-k="'+k+'"]'); if(el){ el.focus(); try{ var l=el.value.length; el.setSelectionRange&&el.type!=='date'&&el.type!=='number'&&el.setSelectionRange(l,l); }catch(_){} } }
  wrap.addEventListener('click',function(e){
    var b=e.target.closest('[data-act]'); if(!b) return; var a=b.getAttribute('data-act'), i=+b.getAttribute('data-i');
    if(a==='addpg'){ pgRows.push({day:'',title:''}); render(); var r=wrap.querySelectorAll('[data-pg][data-f="day"]'); r[r.length-1]&&r[r.length-1].focus(); }
    else if(a==='delpg'){ pgRows.splice(i,1); commit(); render(); }
    else if(a==='addev'){ evRows.push({day:'',title:'',isHoliday:false}); render(); var q=wrap.querySelectorAll('[data-ev][data-f="day"]'); q[q.length-1]&&q[q.length-1].focus(); }
    else if(a==='delev'){ evRows.splice(i,1); commit(); render(); }
    else if(a==='autot'){ var ms=startMs(); if(ms==null){ Toast.show('Pick the first day (AD date) first','info'); return; } autoT=true; recompute(); commit(); render(); Toast.show('Tithis filled automatically — check and edit if your panchang differs','success'); }
    else if(a==='copyly'&&lastYearData){
      var d=lastYearData; if(d.quote&&!S.quote) S.quote=d.quote;
      var ev=d.events&&typeof d.events==='object'?d.events:{}; Object.keys(ev).forEach(function(k){ if(!evRows.some(function(r){return String(r.day)===k;})) evRows.push({day:k,title:(ev[k]||{}).title||'',isHoliday:!!(ev[k]||{}).isHoliday,workday:!!(ev[k]||{}).workday}); });
      (d.programs||[]).forEach(function(p){ pgRows.push(Object.assign({},p)); });
      commit(); render(); Toast.show('Copied — the dates are last year\'s, so fix the days that moved','info');
    }
  });

  /* manual JSON edit -> refresh the cards */
  ta.addEventListener('change',function(){ try{ var p=JSON.parse(ta.value||'{}'); S=p; ensure(); evRows=Object.keys(S.events).map(function(d){return {day:d,title:S.events[d].title||'',isHoliday:!!S.events[d].isHoliday};}); pgRows=S.programs.map(function(x){return Object.assign({},x);}); autoT=false; render(); }catch(e){} });
  document.getElementById('recordForm').addEventListener('submit',function(){ commit(); },true);

  /* new month: choose the next free month, then fill everything */
  async function autofill(){
    var rows=await getRows(); rowsCache=rows;
    var map={}; rows.forEach(function(r){ var y=Number(r.year_bs), i=Number(r.month_idx); if(y&&i>=0) map[y*12+i]=r; });
    if(isNew && !mi.dataset.touched && !yi.dataset.touched && (mi.value===''||yi.value==='')){
      var keys=Object.keys(map).map(Number); var next=keys.length?Math.max.apply(null,keys)+1:null;
      if(next!=null){ yi.value=Math.floor(next/12); mi.value=next%12; } else { yi.value=yi.value||new Date().getFullYear()+57; mi.value=mi.value||0; }
    }
    var y=parseInt(yi.value,10), i=parseInt(mi.value,10); updHint();
    var key=y*12+i, prev=map[key-1], ly=map[key-12];
    lastYearData=ly?dataOf(ly):null;
    if(!isNew) { render(); return; }
    var pd=prev?dataOf(prev):null, ms=null, dc=null;
    if(pd&&pd.adStartDate&&pd.daysCount) ms=utcMs(pd.adStartDate)+parseInt(pd.daysCount,10)*DAY_MS;
    if(ms==null && y>1900 && i>=0 && i<=11) ms=Date.UTC(y-57,3,14)+Math.round(i*30.4)*DAY_MS;   /* rough guess: check it */
    dc=lastYearData&&lastYearData.daysCount?parseInt(lastYearData.daysCount,10):30;
    S.nameBS=BS_MONTHS[i]+' '+toNp(y); S.daysCount=dc; if(ms!=null) S.adStartDate=isoOf(ms);
    S.quote=S.quote||''; S.muhurta=S.muhurta||''; S.pasni=S.pasni||''; S.bibah=S.bibah||''; S.bratabandha=S.bratabandha||''; autoT=true; recompute();
    evRows=[]; pgRows=[]; commit(); render();
    if(ms!=null&&!(pd&&pd.adStartDate)) Toast.show('First day is an estimate — please check the AD date','info');
  }
  mi.addEventListener('input',function(e){ if(e.isTrusted) mi.dataset.touched='1'; updHint(); if(isNew) autofill(); });
  yi.addEventListener('input',function(e){ if(e.isTrusted) yi.dataset.touched='1'; updHint(); if(isNew) autofill(); });
  updHint(); render();
  if(isNew) autofill(); else getRows().then(function(rows){ var y=Number(yi.value), i=Number(mi.value); var ly=rows.filter(function(r){return Number(r.year_bs)===y-1&&Number(r.month_idx)===i;})[0]; lastYearData=ly?dataOf(ly):null; render(); });
}
})();
