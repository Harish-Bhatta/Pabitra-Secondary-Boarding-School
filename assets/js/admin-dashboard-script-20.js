/* Overview extras: live counts, latest notices, shortcuts, tips. Read-only use of the existing list RPC. */
(function(){
  const COLS=[['notices','Notices','ri-notification-3-line','243,156,18'],['documents','Documents','ri-file-paper-2-line','79,70,229'],['gallery','Gallery','ri-image-line','16,185,129'],['faculty','Faculty','ri-graduation-cap-line','6,182,212'],['calendar_data','Calendar','ri-calendar-event-line','139,92,246'],['school_info','School Info','ri-community-line','234,88,12']];
  const mk=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;};
  const tok=()=>localStorage.getItem(tokenKey)||sessionStorage.getItem(tokenKey);
  const rows=d=>Array.isArray(d)?d:(d?.records||d?.data||[]);
  const host=document.getElementById('quickCards');if(!host)return;
  const wrap=document.createElement('div');wrap.id='overviewExtras';
  wrap.innerHTML='<div class="ov-grid"><section class="panel ov-panel" aria-labelledby="ovT1"><div class="ov-head"><div><h3 id="ovT1">Content at a glance</h3><p>Live record counts across the public website.</p></div><button type="button" class="btn slim refresh-btn" id="ovRefresh"><span class="rf-ic" aria-hidden="true"><i class="ri-refresh-line"></i></span><span class="rf-tx">Refresh</span></button></div><div class="ov-bars" id="ovBars"></div></section><section class="panel ov-panel" aria-labelledby="ovT2"><div class="ov-head"><div><h3 id="ovT2">Latest notices</h3></div><button type="button" class="btn slim" id="ovAllNotices">View all <i class="ri-arrow-right-line"></i></button></div><div class="ov-list" id="ovNotices"></div></section></div>';
  host.after(wrap);
  const $=id=>document.getElementById(id);
  $('ovAllNotices').onclick=()=>navigate('collection','notices');
  // Data
  let busy=false;
  async function load(){
    if(busy)return;busy=true;
    const bars=$('ovBars'),nl=$('ovNotices');
    if(!bars.children.length){for(let i=0;i<6;i++)bars.append(mk('div','ov-skel'));}
    if(!nl.children.length){for(let i=0;i<3;i++)nl.append(mk('div','ov-skel'));}
    try{
      const res=await Promise.allSettled(COLS.map(c=>rpc(ADMIN_CONFIG.rpc.list,{p_session_token:tok(),p_table:c[0],p_limit:500})));
      const data=res.map(r=>r.status==='fulfilled'?rows(r.value):null);
      if(data.every(d=>d===null)&&(load.tries=(load.tries||0)+1)<=4){busy=false;setTimeout(load,1500);return;}
      const max=Math.max(1,...data.map(d=>d?d.length:0));
      window.__ovCounts={}; COLS.forEach((c,i)=>{ if(data[i]) window.__ovCounts[c[0]]=data[i].length; }); window.__ovApplyCounts&&window.__ovApplyCounts();
      bars.replaceChildren();
      COLS.forEach((c,i)=>{
        const n=data[i]?data[i].length:null;
        const b=mk('button','ov-bar');b.type='button';b.style.setProperty('--qc',c[3]);
        b.setAttribute('aria-label',c[1]+': '+(n===null?'unavailable':n+' records')+'. Open.');
        b.innerHTML='<span class="nm"><i class="'+c[2]+'" aria-hidden="true"></i><span></span></span><span class="tr"><span></span></span><span class="ct"></span>';
        b.querySelector('.nm span').textContent=c[1];b.querySelector('.ct').textContent=n===null?'—':n;
        b.onclick=()=>navigate('collection',c[0]);bars.append(b);
        requestAnimationFrame(()=>{b.querySelector('.tr span').style.width=(n?Math.max(6,n/max*100):0)+'%';});
      });
      nl.replaceChildren();
      let notes=(data[0]||[]).slice();
      notes.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
      notes=notes.slice(0,4);
      if(!notes.length) nl.append(mk('div','ov-empty',data[0]?'No notices yet.':'Notices could not be loaded.'));
      notes.forEach(r=>{
        const b=mk('button','ov-item');b.type='button';
        b.innerHTML='<span class="tx"><span class="nt-top"><em class="nt-chip"></em><small></small></span><b></b></span><i class="ri-arrow-right-s-line" aria-hidden="true"></i>';
        b.querySelector('b').textContent=recordTitle('notices',r);
        const lb=String(r.label||'Notice').toLowerCase(); const chip=b.querySelector('.nt-chip'); chip.textContent=r.label||'Notice'; chip.dataset.k=lb;
        let when=''; if(r.date){const d=new Date(r.date); if(!isNaN(d)){const days=Math.round((new Date().setHours(0,0,0,0)-new Date(d).setHours(0,0,0,0))/864e5); when=days===0?'Today':days===1?'Yesterday':(days>1&&days<7)?days+' days ago':Helpers.formatDate(r.date);} }
        b.querySelector('small').textContent=when;
        b.onclick=()=>{navigate('collection','notices');setTimeout(()=>openViewer(r,'notices'),150);};
        nl.append(b);
      });
    }catch(e){bars.replaceChildren(mk('div','ov-empty','Could not load counts. Try Refresh.'));nl.replaceChildren();}
    finally{busy=false;}
  }
  $('ovRefresh').onclick=load;
  const orig=refreshOverview;
  refreshOverview=async function(){const r=orig.apply(this,arguments);load();return r;};
  load();
})();
