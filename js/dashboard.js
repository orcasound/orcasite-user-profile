// Dashboard logic for both Public and Expert roles
(function(){
  const role = localStorage.getItem('demoUserRole');
  // Map known sample user display names to their stable IDs for legacy attribution fixes
  const SAMPLE_NAME_TO_ID = {
    'Alex Rivers':'pub_alex',
    'Sam Harper':'pub_sam',
    'Lina Chen':'pub_lina',
    'Maya Ortiz':'pub_maya',
    'Dr. Marin':'exp_drmarin',
    'K. Patel':'exp_kpatel'
  };
  const favList = document.getElementById('favList');
  const commentList = document.getElementById('commentList');
  const userReportsEl = document.getElementById('userReports');
  // scoreboard metrics
  const mComments = document.getElementById('mComments')?.querySelector('.num');
  const mChecked = document.getElementById('mChecked')?.querySelector('.num');
  const mTags = document.getElementById('mTags')?.querySelector('.num');
  const mScore = document.getElementById('mScore')?.querySelector('.num');
  const statsBox = document.getElementById('statsBox'); // legacy (may be absent now)
  const approvalsList = document.getElementById('approvalsList');
  const activityList = document.getElementById('activityList');
  // New expert management panels
  const manageListEl = document.getElementById('userReportsManageList');
  const candidateListEl = document.getElementById('candidateReportsList');
  const manageTypeFilter = document.getElementById('manageTypeFilter');
  const manageSortSel = document.getElementById('manageSort');
  const groupByTypeChk = document.getElementById('groupByType');
  const manageSearchInput = document.getElementById('manageSearch');
  const batchSelectAllBtn = document.getElementById('batchSelectAll');
  const batchClearBtn = document.getElementById('batchClear');
  const batchCandidateBtn = document.getElementById('batchCandidate');
  const batchUncandidateBtn = document.getElementById('batchUncandidate');
  const batchConfirmBtn = document.getElementById('batchConfirmReports');
  const exportCandidatesBtn = document.getElementById('exportCandidatesBtn');
  const aggregateMetricsBody = document.getElementById('aggregateMetricsBody');
  // Listening shifts elements (expert tab 2)
  const shiftsPanel = document.getElementById('listeningShiftsPanel');
  const shiftListEl = document.getElementById('shiftList');
  // Weekly shift form inputs
  const shiftDaySel = document.getElementById('shiftDay');
  const shiftStartTimeSel = document.getElementById('shiftStartTime');
  const shiftEndTimeSel = document.getElementById('shiftEndTime');
  const addShiftBtn = document.getElementById('addShiftBtn');
  const clearShiftFormBtn = document.getElementById('clearShiftFormBtn');
  const editingShiftIdInput = document.getElementById('editingShiftId');
  const weekPrevBtn = document.getElementById('weekPrevBtn');
  const weekNextBtn = document.getElementById('weekNextBtn');
  const weekLabel = document.getElementById('weekLabel');
  const shiftCalendarEl = document.getElementById('shiftCalendar');
  const weekHeaderEl = document.getElementById('weekHeader');
  const weekBodyEl = document.getElementById('weekBody');
  const shiftSummaryEl = document.getElementById('shiftSummary');
  const shiftLegendEl = document.getElementById('shiftLegend');
  const tabsNav = document.getElementById('expertDashTabs');
  const publicTabsNav = document.getElementById('publicDashTabs');

  // --- Tab Navigation ---
  if(tabsNav){
    tabsNav.addEventListener('click', e=>{
      const btn = e.target.closest('.dash-tab');
      if(!btn) return;
      const target = btn.getAttribute('data-tab');
      document.querySelectorAll('.dash-tab').forEach(b=>b.classList.toggle('active', b===btn));
      document.querySelectorAll('.tab-pane').forEach(p=>p.classList.toggle('active', p.id===target));
      if(target==='shiftsTab' && role==='expert'){ renderCalendar(); renderShifts(); }
      if(target==='confirmedTab' && role==='expert'){
        // Re-render candidate reports for confirmed tab
        renderCandidateReportsFromCache();
        // Activity mirror only (metrics clone removed)
        mirrorActivity();
      }
      if(target==='expertMyDataTab' && role==='expert'){
        // Refresh personal data panels when switching to My Data
        if(__audiosCache){
          renderUserReports(__audiosCache);
          renderComments(__audiosCache);
          renderFavorites(__audiosCache);
          renderScoreboard(__audiosCache);
          renderActivity();
        }
      }
    });
  }
  if(publicTabsNav){
    publicTabsNav.addEventListener('click', e=>{
      const btn = e.target.closest('.dash-tab'); if(!btn) return;
      const target = btn.getAttribute('data-tab');
      publicTabsNav.querySelectorAll('.dash-tab').forEach(b=>b.classList.toggle('active', b===btn));
      document.querySelectorAll('.tab-pane').forEach(p=>{
        // Limit to panes that belong to public dashboard (id starts with public)
        if(p.id.startsWith('public')){
          p.classList.toggle('active', p.id===target);
        }
      });
      if(target==='publicConfirmedTab'){
        renderCandidateReportsFromCache();
      }
    });
  }

  // --- Shift Storage ---
  function readShifts(){
    try { return JSON.parse(localStorage.getItem('listeningShifts')||'[]'); } catch(e){ return []; }
  }
  function saveShifts(arr){ localStorage.setItem('listeningShifts', JSON.stringify(arr)); }
  function genShiftId(){ return 'shift_'+Date.now()+'_'+Math.random().toString(36).slice(2,8); }

  // --- User Color Mapping ---
  const USER_COLORS = ['#4fc3f7','#ffb74d','#81c784','#ce93d8','#f06292','#4db6ac','#9575cd','#aed581'];
  function userColor(uid){ if(!uid) return '#888'; let hash=0; for(let i=0;i<uid.length;i++){ hash=(hash*31+uid.charCodeAt(i))>>>0; } return USER_COLORS[hash % USER_COLORS.length]; }

  // --- Duration Helpers ---
  function shiftDurationHours(s){ return (new Date(s.end)-new Date(s.start))/(1000*60*60); }
  function formatHours(h){ return (Math.round(h*10)/10).toFixed(1); }
  function isSameDay(dateIso, dayKey){ return dateIso.slice(0,10)===dayKey; }
  function eachDaySpan(s){
    const days=[]; let cur = new Date(s.start.slice(0,10));
    const end = new Date(s.end); // inclusive logic for calendar representation
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while(cur <= endDay){ days.push(cur.toISOString().slice(0,10)); cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate()+1); }
    return days;
  }

  function addShift(startIso, endIso){
    const uid = localStorage.getItem('demoUserId');
    const uname = localStorage.getItem('demoUserName');
    if(!uid) return;
    const shifts = readShifts();
    shifts.push({id:genShiftId(), start:startIso, end:endIso, userId:uid, userName:uname});
    saveShifts(shifts);
  }
  function updateShift(id, startIso, endIso){
    const shifts = readShifts();
    const idx = shifts.findIndex(s=>s.id===id); if(idx>=0){ shifts[idx].start=startIso; shifts[idx].end=endIso; saveShifts(shifts); }
  }
  function deleteShift(id){
    const shifts = readShifts().filter(s=>s.id!==id); saveShifts(shifts);
  }

  // --- Calendar Logic ---
  let calView = new Date(); // month anchor
  function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
  function endOfMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0); }
  function fmtDate(dt){ const y=dt.getFullYear(); const m=String(dt.getMonth()+1).padStart(2,'0'); const da=String(dt.getDate()).padStart(2,'0'); return `${y}-${m}-${da}`; }
  let selectedDay = null; // 'YYYY-MM-DD'

  function renderCalendar(){
    if(!shiftCalendarEl) return;
    const anchor = startOfMonth(calView);
    const firstDow = anchor.getDay();
    const daysInMonth = endOfMonth(anchor).getDate();
    const prevMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 0);
    const nextMonth = new Date(anchor.getFullYear(), anchor.getMonth()+1, 1);
    calMonthLabel && (calMonthLabel.textContent = anchor.toLocaleString(undefined,{month:'long', year:'numeric'}));
    const cells = [];
    // Leading days
    for(let i=0;i<firstDow;i++){
      const dayNum = prevMonth.getDate()-firstDow+i+1;
      const d = new Date(anchor.getFullYear(), anchor.getMonth()-1, dayNum);
      cells.push({date:d, other:true});
    }
    // Current month days
    for(let i=1;i<=daysInMonth;i++) cells.push({date:new Date(anchor.getFullYear(), anchor.getMonth(), i), other:false});
    // Trailing to fill 42 cells (6 weeks)
    while(cells.length<42){
      const last = cells[cells.length-1].date;
      const d = new Date(last.getFullYear(), last.getMonth(), last.getDate()+1);
      cells.push({date:d, other:d.getMonth()!==anchor.getMonth()});
    }
    const shifts = readShifts();
    // Multi-day counting across span
    const counts = {}; const dayDots = {};
    shifts.forEach(s=>{
      eachDaySpan(s).forEach(dayKey=>{
        counts[dayKey] = (counts[dayKey]||0)+1;
        (dayDots[dayKey] ||= []).push({userId:s.userId});
      });
    });
    shiftCalendarEl.innerHTML = cells.map(c=>{
      const key = fmtDate(c.date);
      const count = counts[key]||0;
      const sel = selectedDay===key ? ' selected' : '';
      let dotsHtml='';
      const dots = (dayDots[key]||[]).slice(0,6); // cap visible dots
      if(dots.length){
        dotsHtml = `<div class="multi-dot-wrap">${dots.map(d=>`<span class="shift-dot" style="background:${userColor(d.userId)}"></span>`).join('')}</div>`;
      }
      return `<div class="cal-day${c.other?' other-month':''}${sel}" data-day="${key}"><span class="d-num">${c.date.getDate()}</span>${count?`<span class="d-count" title="${count} shifts">${count}</span>`:''}${dotsHtml}</div>`;
    }).join('');
  }

  function renderShifts(){
    if(!shiftListEl) return;
    const shifts = readShifts().sort((a,b)=> new Date(a.start)-new Date(b.start));
    const uid = localStorage.getItem('demoUserId');
    const filtered = selectedDay ? shifts.filter(s=> eachDaySpan(s).includes(selectedDay)) : shifts;
    if(!filtered.length){ shiftListEl.innerHTML = '<div class="shift-empty">No shifts'+(selectedDay?` for ${selectedDay}`:'')+'.</div>'; return; }
    shiftListEl.innerHTML = filtered.map(s=>{
      const owned = s.userId===uid;
      const startStr = new Date(s.start).toLocaleString();
      const endStr = new Date(s.end).toLocaleString();
      const dur = shiftDurationHours(s);
      const color = userColor(s.userId);
      return `<div class="shift-row" data-id="${s.id}"><div><div class="sr-times"><span class="sr-color-dot" style="background:${color}"></span>${startStr} - ${endStr} <span class="sr-dur">(${formatHours(dur)}h)</span></div><div class="sr-user">${owned?'You':escapeHtml(s.userName||'')}</div></div><div class="sr-actions">${owned?`<button data-action="edit-shift">Edit</button><button data-action="del-shift">Delete</button>`:''}</div></div>`;
    }).join('');
  }

  function renderShiftSummary(){
    if(!shiftSummaryEl) return;
    const shifts = readShifts();
    if(!shifts.length){ shiftSummaryEl.textContent='No scheduled hours.'; return; }
    let total = 0; let dayTotal=0; let monthTotal=0;
    const monthKey = calView.getFullYear()+'-'+String(calView.getMonth()+1).padStart(2,'0');
    shifts.forEach(s=>{ const h=shiftDurationHours(s); total+=h; if(selectedDay && eachDaySpan(s).includes(selectedDay)) dayTotal+=h; if(s.start.startsWith(monthKey)) monthTotal+=h; });
    const parts = [`Total: ${formatHours(total)}h`, `Month: ${formatHours(monthTotal)}h`];
    if(selectedDay) parts.push(`Day: ${formatHours(dayTotal)}h`);
    shiftSummaryEl.textContent = parts.join(' | ');
  }

  function renderShiftLegend(){
    if(!shiftLegendEl) return;
    const shifts = readShifts();
    if(!shifts.length){ shiftLegendEl.innerHTML=''; return; }
    const byUser = {};
    shifts.forEach(s=>{ if(!byUser[s.userId]) byUser[s.userId]=s.userName||s.userId; });
    const items = Object.keys(byUser).sort().map(uid=>`<div class="legend-item"><span class="legend-dot" style="background:${userColor(uid)}"></span>${escapeHtml(byUser[uid])}</div>`).join('');
    shiftLegendEl.innerHTML = items;
  }

  function clearShiftForm(){
    if(editingShiftIdInput) editingShiftIdInput.value='';
    if(shiftDaySel) shiftDaySel.value=new Date().getDay();
    if(shiftStartTimeSel) shiftStartTimeSel.selectedIndex=16; // 08:00 baseline
    if(shiftEndTimeSel) shiftEndTimeSel.selectedIndex=20; // 10:00 baseline
  }

  function validateShift(startIso, endIso){
    if(!startIso || !endIso) return 'Start and End required';
    const s = new Date(startIso); const e = new Date(endIso);
    if(isNaN(s)||isNaN(e)) return 'Invalid date';
    if(e<=s) return 'End must be after Start';
    return null;
  }

  // Weekly calendar state
  let weekAnchor = (function(){ const now=new Date(); const day = now.getDay(); const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()-day); return start; })(); // Sunday start

  function fmtDayLabel(d){ return d.toLocaleDateString(undefined,{weekday:'short', month:'numeric', day:'numeric'}); }
  function cloneDate(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  function buildTimeOptions(){
    if(!shiftStartTimeSel || !shiftEndTimeSel) return;
    if(shiftStartTimeSel.options.length) return; // already built
    // Build in 30-minute increments
    for(let h=0; h<24; h++){
      for(let m=0; m<60; m+=30){
        const label = String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
        const o1=document.createElement('option'); o1.value=label; o1.textContent=label; shiftStartTimeSel.appendChild(o1);
        const o2=document.createElement('option'); o2.value=label; o2.textContent=label; shiftEndTimeSel.appendChild(o2.cloneNode(true));
      }
    }
  }

  function isoForWeekDay(dayIdx, timeHHMM){
    const base = cloneDate(weekAnchor); // Sunday
    base.setDate(base.getDate()+parseInt(dayIdx,10));
    const [hh,mm] = timeHHMM.split(':').map(x=>parseInt(x,10));
    base.setHours(hh,mm,0,0);
    return base.toISOString().slice(0,16)+':00.000Z'.slice(-1); // ensure minutes precision
  }

  function renderWeekCalendar(){
    if(!weekHeaderEl || !weekBodyEl) return;
    const days=[]; for(let i=0;i<7;i++){ const d=new Date(weekAnchor.getFullYear(), weekAnchor.getMonth(), weekAnchor.getDate()+i); days.push(d); }
    weekLabel && (weekLabel.textContent = days[0].toLocaleDateString(undefined,{month:'short', day:'numeric'}) + ' - ' + days[6].toLocaleDateString(undefined,{month:'short', day:'numeric', year:'numeric'}));
    weekHeaderEl.innerHTML = '<div class="wh-cell">Time</div>'+days.map(d=>`<div class="wh-cell" data-wday="${d.getDay()}">${fmtDayLabel(d)}</div>`).join('');
    // Build time column 00:00 - 23:30
    const timeLabels = []; for(let h=0; h<24; h++){ timeLabels.push(String(h).padStart(2,'0')+':00'); timeLabels.push(String(h).padStart(2,'0')+':30'); }
    weekBodyEl.innerHTML = '';
    // time column
    const timeCol = document.createElement('div'); timeCol.className='time-col';
    timeLabels.forEach((t,i)=>{ const lab=document.createElement('div'); lab.className='time-slot-label'; lab.textContent = i%2===0 ? t : ''; timeCol.appendChild(lab); });
    weekBodyEl.appendChild(timeCol);
    // day columns
    const shifts = readShifts();
    days.forEach(d=>{
      const col=document.createElement('div'); col.className='day-col'; col.setAttribute('data-day', d.toISOString().slice(0,10));
      // Add shift blocks belonging to this day
      const dayShifts = shifts.filter(s=>{
        const sd=new Date(s.start); const ed=new Date(s.end);
        // Overlaps this day if any time on this date
        const dayStart=new Date(d.getFullYear(), d.getMonth(), d.getDate(),0,0,0,0);
        const dayEnd=new Date(d.getFullYear(), d.getMonth(), d.getDate(),23,59,59,999);
        return ed>=dayStart && sd<=dayEnd;
      });
      dayShifts.forEach(s=>{
        const sd=new Date(s.start); const ed=new Date(s.end);
        const dayStart=new Date(d.getFullYear(), d.getMonth(), d.getDate(),0,0,0,0);
        const minutesStart = Math.max(0, (sd - dayStart)/60000);
        const minutesEnd = Math.min(24*60, (ed - dayStart)/60000);
        const pxPerMinute = 24 / 30; // slot is 24px per 30 minutes
        const topPx = minutesStart * pxPerMinute;
        const heightPx = Math.max(8, (minutesEnd - minutesStart) * pxPerMinute);
        const owned = s.userId === localStorage.getItem('demoUserId');
        const div=document.createElement('div');
        div.className='shift-block'+(owned?' owned':'');
        div.style.top=topPx+'px';
        div.style.height=heightPx+'px';
        div.setAttribute('data-id', s.id);
        div.innerHTML = `<span class="sb-time">${sd.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - ${ed.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span><span class="sb-user">${owned?'You':escapeHtml(s.userName||'')}</span>`;
        col.appendChild(div);
      });
      weekBodyEl.appendChild(col);
    });
  }

  function renderCalendar(){ // shim old calls
    renderWeekCalendar();
  }

  if(weekPrevBtn){ weekPrevBtn.addEventListener('click', ()=>{ weekAnchor = new Date(weekAnchor.getFullYear(), weekAnchor.getMonth(), weekAnchor.getDate()-7); renderWeekCalendar(); }); }
  if(weekNextBtn){ weekNextBtn.addEventListener('click', ()=>{ weekAnchor = new Date(weekAnchor.getFullYear(), weekAnchor.getMonth(), weekAnchor.getDate()+7); renderWeekCalendar(); }); }

  buildTimeOptions();
  clearShiftForm();

  if(addShiftBtn){
    addShiftBtn.addEventListener('click', ()=>{
      if(!shiftDaySel || !shiftStartTimeSel || !shiftEndTimeSel){ alert('Shift inputs missing'); return; }
      const startIso = isoForWeekDay(shiftDaySel.value, shiftStartTimeSel.value);
      const endIso = isoForWeekDay(shiftDaySel.value, shiftEndTimeSel.value);
      const err = validateShift(startIso, endIso); if(err){ alert(err); return; }
      const editing = editingShiftIdInput.value;
      if(editing){ updateShift(editing, startIso, endIso); }
      else { addShift(startIso, endIso); }
      clearShiftForm(); renderWeekCalendar(); renderShifts(); renderShiftSummary(); renderShiftLegend();
    });
  }
  if(clearShiftFormBtn){ clearShiftFormBtn.addEventListener('click', ()=> clearShiftForm()); }
  // Remove old month navigation listeners (replaced by week prev/next)
  if(shiftCalendarEl){
    shiftCalendarEl.addEventListener('click', e=>{
      const blk = e.target.closest('.shift-block');
      if(!blk) return;
      const id = blk.getAttribute('data-id');
      const shifts = readShifts();
      const s = shifts.find(x=>x.id===id); if(!s) return;
      // populate form for edit if owned
      if(s.userId === localStorage.getItem('demoUserId')){
        editingShiftIdInput.value = s.id;
        const sd = new Date(s.start);
        shiftDaySel.value = String(sd.getDay());
        const stLabel = String(sd.getHours()).padStart(2,'0')+':'+String(sd.getMinutes()).padStart(2,'0');
        const ed = new Date(s.end);
        const etLabel = String(ed.getHours()).padStart(2,'0')+':'+String(ed.getMinutes()).padStart(2,'0');
        shiftStartTimeSel.value = stLabel;
        shiftEndTimeSel.value = etLabel;
      }
    });
  }
  if(shiftListEl){
    shiftListEl.addEventListener('click', e=>{
      const row = e.target.closest('.shift-row'); if(!row) return;
      const id = row.getAttribute('data-id');
      if(e.target.matches('[data-action="edit-shift"]')){
        const shifts = readShifts(); const s = shifts.find(x=>x.id===id); if(!s) return;
        shiftStartInput.value = s.start.slice(0,16);
        shiftEndInput.value = s.end.slice(0,16);
        editingShiftIdInput.value = s.id;
      } else if(e.target.matches('[data-action="del-shift"]')){
        if(confirm('Delete this shift?')){ deleteShift(id); renderCalendar(); renderShifts(); renderShiftSummary(); renderShiftLegend(); }
      }
    });
  }

  window.addEventListener('userchange', ()=>{
    // Refresh shift ownership display
    if(role==='expert') { renderShifts(); renderCalendar(); renderShiftSummary(); renderShiftLegend(); }
  });

  // Initial legend/summary if shifts tab already active
  if(role==='expert' && shiftsPanel){ renderShiftSummary(); renderShiftLegend(); }

  // --- Expert Enhancements State ---
  let __reportRowCache = null; // { rows: [...], ts: Date }
  let __reportCacheVersion = 0;
  let __showOnlyStructured = false; // toggle to hide comment-derived
  let __groupMode = 'none'; // none|user|clip
  let __page = 1; const PAGE_SIZE = 50;
  let __activeChipFilter = null; // 'top'|'noConf'|'needsReview'

  function invalidateReportCache(){ __reportRowCache = null; __reportCacheVersion++; }

  function assembleReportRows(audios){
    if(__reportRowCache) return __reportRowCache.rows;
    const tmp=[];
    audios.forEach(a=>{
      const cs = readComments(a.id);
      cs.forEach(c=>{
        let uId = c.userId; let uName = c.userName;
        if((!uId || uId==='unknown') && uName && SAMPLE_NAME_TO_ID[uName]){ uId = SAMPLE_NAME_TO_ID[uName]; }
        tmp.push({source:'comment', clipId:a.id, location:a.location||a.title, ts:c.ts, text:c.text||c, commentId:c.id, userId:uId, userName:uName, type:null, at:null});
      });
    });
    audios.forEach(a=>{
      const reps = readUserReports(a.id);
      reps.forEach(r=>{
        let uId = r.userId; let uName = r.user;
        if((!uId || uId==='unknown') && uName && SAMPLE_NAME_TO_ID[uName]){ uId = SAMPLE_NAME_TO_ID[uName]; }
        tmp.push({source:'userReport', clipId:a.id, location:a.location||a.title, ts:r.ts, text:r.text||'', commentId:r.id, userId:uId, userName:uName, type:r.type||null, at:r.at||null});
      });
    });
    __reportRowCache = { rows: tmp, ts: Date.now(), ver: __reportCacheVersion };
    return tmp;
  }

  // Basic guard: only proceed if on a dashboard page.
  // Original check missed pure expert pages which lack favList/commentList/mScore.
  const isExpertPage = !!(manageListEl || candidateListEl || aggregateMetricsBody);
  if(!favList && !commentList && !userReportsEl && !mScore && !isExpertPage) return;

  // NOTE: sample-audio.json is already loaded in app pages; here we re-fetch if needed
  fetch('sample-audio.json').then(r=>r.json()).then(data=>{
    const audios = (data && data.audios) || [];
    __audiosCache = audios;
    buildAudioMap(audios);
  updateDashboardTitle();
  renderFavorites(audios);
  renderComments(audios);
  renderUserReports(audios);
  if(role==='expert') {
    renderManageReports(audios);
    renderCandidateReports(audios);
    renderAggregateMetrics(audios);
  } else {
    // Public still needs candidate reports list (confirmed) when switching tabs
    renderCandidateReports(audios);
  }
  renderScoreboard(audios);
  renderStats(audios); // legacy optional
    if(role === 'expert' && approvalsList){ renderApprovals(audios); }
  }).catch(()=>{
    if(favList) favList.textContent = 'Failed to load data.';
    if(commentList) commentList.textContent = 'Failed to load data.';
    if(statsBox) statsBox.textContent = 'Failed to load.';
    if(approvalsList) approvalsList.textContent = 'Failed to load.';
  });

  function isBookmarked(id){
    const uid = localStorage.getItem('demoUserId') || 'anon';
    const key = 'bookmark:'+uid+':'+id;
    const legacy = 'bookmark:'+id;
    // migrate legacy if exists
    if(localStorage.getItem(legacy) === '1'){
      // Assign all legacy favorites to Lisa (sample user Lina) per requirement
      const targetUser = 'pub_lina';
      const targetKey = 'bookmark:'+targetUser+':'+id;
      if(!localStorage.getItem(targetKey)){
        localStorage.setItem(targetKey,'1');
      }
      localStorage.removeItem(legacy);
    }
    return localStorage.getItem(key) === '1';
  }
  function readComments(id){
    try {
      const raw = JSON.parse(localStorage.getItem('comments:'+id)||'[]');
      let changed=false; let idx=0;
      const upgraded = raw.map(c=>{
        if(typeof c === 'string'){ changed=true; return {id: genCommentId(id, idx++), text:c, ts:null, userId:'unknown', userName:'Unknown'}; }
        if(!c.id){ changed=true; return {id: genCommentId(id, idx++), text:c.text, ts:c.ts||null, userId: c.userId||'unknown', userName: c.userName||'Unknown'}; }
        // Backfill user mapping if only name present
        if((!c.userId || c.userId==='unknown') && c.userName && SAMPLE_NAME_TO_ID[c.userName]){
          changed=true; return {...c, userId: SAMPLE_NAME_TO_ID[c.userName]};
        }
        idx++; return c;
      });
      if(changed) localStorage.setItem('comments:'+id, JSON.stringify(upgraded));
      return upgraded;
    }catch(e){ return []; }
  }
  function genCommentId(clipId, seed){ return clipId+':c:'+seed+':dash'; }

  // Confirmation storage helpers
  function confirmStore(){
    try { return JSON.parse(localStorage.getItem('reportConfirmations')||'{}'); } catch(e){ return {}; }
  }
  function saveConfirmStore(obj){ localStorage.setItem('reportConfirmations', JSON.stringify(obj)); }
  function getConfirmation(commentId){ const store = confirmStore(); return store[commentId]||null; }
  function setConfirmation(commentId, data){
    const store = confirmStore();
    const uid = localStorage.getItem('demoUserId') || null;
    store[commentId] = { ...data, confirmerUserId: data.confirmerUserId || uid };
    saveConfirmStore(store);
  }
  function formatDate(iso){ if(!iso) return ''; try { const d=new Date(iso); if(isNaN(d)) return ''; const pad=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; } catch(e){return ''} }
  function isApproved(id){ return localStorage.getItem('approved:'+id)==='1'; }
  function setApproved(id){ localStorage.setItem('approved:'+id,'1'); }

  function renderFavorites(audios){
    if(!favList) return;
    const favs = audios.filter(a=>isBookmarked(a.id));
    if(!favs.length){ favList.innerHTML = '<div class="empty">None yet.</div>'; return; }
    favList.innerHTML = '<ul class="mini-list">'+favs.map(a=>`<li><a href="hydrophones.html#${a.id}">${escapeHtml(a.location||a.title)}</a></li>`).join('')+'</ul>';
  }

  function renderComments(audios){
    if(!commentList) return;
    const currentUserId = localStorage.getItem('demoUserId');
    const withComments = audios.map(a=>({id:a.id, title:a.location||a.title, comments:readComments(a.id).filter(c=> !currentUserId || c.userId===currentUserId)})).filter(x=>x.comments.length);
    if(!withComments.length){ commentList.innerHTML = '<div class="empty">No comments yet.</div>'; return; }
    commentList.innerHTML = withComments.map(x=>`<div class="dash-comment-block"><div class="c-title">${escapeHtml(x.title)}</div>`+x.comments.map(c=>`<div class="c-line">${c.ts?`<span class=\"c-ts\">${formatDate(c.ts)}</span> `:''}${escapeHtml(c.text||c)}</div>`).join('')+'</div>').join('');
  }

  function renderStats(audios){
    if(!statsBox) return;
    const currentUserId = localStorage.getItem('demoUserId');
    let totalComments = 0; audios.forEach(a=>{ totalComments += readComments(a.id).filter(c=> !currentUserId || c.userId===currentUserId).length; });
    const totalFavs = audios.filter(a=>isBookmarked(a.id)).length; // already per-user key
    statsBox.innerHTML = `<div class="stat-line">Favorited clips: ${totalFavs}</div><div class="stat-line">Comments made: ${totalComments}</div>`;
  }

  // Filter state for expert reports
  let reportFilter = 'all'; // all|unconfirmed|confirmed
  function renderUserReports(audios){
    if(!userReportsEl) return;
    const currentUserId = localStorage.getItem('demoUserId');
    const currentRole = localStorage.getItem('demoUserRole');
    // Cached assembly
    let rows = [];
    rows = assembleReportRows(audios);
    // Filter for public only
    let effective = rows;
    if(currentRole === 'public'){
      effective = rows.filter(r=> (!currentUserId || r.userId === currentUserId) && r.source==='userReport');
    }
    // Toggle: show only structured if enabled
    if(__showOnlyStructured){
      effective = effective.filter(r=> r.source==='userReport');
    }
    if(!effective.length){ userReportsEl.innerHTML = '<div class="empty">No reports yet.</div>'; return; }
  // Sorting depends on grouping mode; base sort newest first
  effective.sort((a,b)=>{ if(!a.ts && !b.ts) return 0; if(!a.ts) return 1; if(!b.ts) return -1; return new Date(b.ts)-new Date(a.ts); });
    // Apply filter for expert
    let filtered = effective;
    // Expert-specific user filter
    let userFilterId = null;
    if(role==='expert'){
      userFilterId = window.__expertUserFilter || null;
      filtered = effective.filter(r=>{
        const conf = getConfirmation(r.commentId);
        if(reportFilter==='unconfirmed' && conf) return false;
        if(reportFilter==='confirmed' && !conf) return false;
        if(userFilterId && r.userId !== userFilterId) return false;
        return true;
      });
    }
    const header = role==='expert' ? `
      <div class="report-controls">
        <label>Filter: <select id="reportFilterSel">
          <option value="all" ${reportFilter==='all'?'selected':''}>All</option>
          <option value="unconfirmed" ${reportFilter==='unconfirmed'?'selected':''}>Unconfirmed</option>
          <option value="confirmed" ${reportFilter==='confirmed'?'selected':''}>Confirmed</option>
        </select></label>
        <label>User: <select id="expertUserFilter"><option value="">All</option></select></label>
        <button class="confirm-btn" id="batchConfirmBtn" data-action="batch-confirm">Batch Confirm</button>
      </div>` : '';
    // Grouping logic
    let groupedHtml = '';
    if(__groupMode==='user'){
      const byUser = {};
      filtered.forEach(r=>{ (byUser[r.userId||'unknown'] ||= []).push(r); });
      const keys = Object.keys(byUser).sort();
      groupedHtml = keys.map(uid=>{
        const arr = byUser[uid];
        return `<li class="group-block"><div class="group-head">${escapeHtml(arr[0].userName||uid||'Unknown')} <button class="mini-btn" data-action="batch-select-user" data-user="${uid}">Select User</button></div>`+
          '<ul class="mini-list">'+arr.map(r=>renderReportRow(r)).join('')+'</ul></li>';
      }).join('');
    } else if(__groupMode==='clip'){
      const byClip = {};
      filtered.forEach(r=>{ (byClip[r.clipId] ||= []).push(r); });
      const keys = Object.keys(byClip).sort();
      groupedHtml = keys.map(cid=>{
        const arr = byClip[cid];
        return `<li class="group-block"><div class="group-head">Clip ${escapeHtml(cid)} <a href="hydrophones.html#${cid}">open</a></div>`+
          '<ul class="mini-list">'+arr.map(r=>renderReportRow(r)).join('')+'</ul></li>';
      }).join('');
    } else {
      groupedHtml = filtered.map(r=>renderReportRow(r)).join('');
    }

    // Pagination
    const totalItems = (__groupMode==='none') ? filtered.length : (groupedHtml ? (groupedHtml.match(/class=\"report-row-item\"/g)||[]).length : 0);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if(__page > totalPages) __page = totalPages;
    let pageFiltered = filtered;
    if(__groupMode==='none'){
      const start = (__page-1)*PAGE_SIZE;
      pageFiltered = filtered.slice(start, start+PAGE_SIZE);
      groupedHtml = pageFiltered.map(r=>renderReportRow(r)).join('');
    } // (For grouped modes we show all for now to avoid nested complexity)

    const paginationBar = `<div class="pagination-bar"><button data-action="page-prev" ${__page<=1?'disabled':''}>Prev</button><span>Page ${__page} / ${totalPages}</span><button data-action="page-next" ${__page>=totalPages?'disabled':''}>Next</button></div>`;

    const controlsExtra = role==='expert' ? `
      <div class="manage-extra-controls">
        <label><input type="checkbox" id="toggleStructuredOnly" ${__showOnlyStructured?'checked':''}/> Only structured</label>
        <label>Group:
          <select id="groupModeSel">
            <option value="none" ${__groupMode==='none'?'selected':''}>None</option>
            <option value="user" ${__groupMode==='user'?'selected':''}>By User</option>
            <option value="clip" ${__groupMode==='clip'?'selected':''}>By Clip</option>
          </select>
        </label>
      </div>
      <div class="report-chips">
        <div class="report-chip ${__activeChipFilter==='top'?'active':''}" data-chip="top">Top reporters</div>
        <div class="report-chip ${__activeChipFilter==='noConf'?'active':''}" data-chip="noConf">No confirmations yet</div>
        <div class="report-chip ${__activeChipFilter==='needsReview'?'active':''}" data-chip="needsReview">Needs confidence review</div>
      </div>
    `:'';

    userReportsEl.innerHTML = header + controlsExtra + '<div class="confirm-summary"></div>' + (role==='expert'?paginationBar:'') + '<ul class="mini-list reports-list">'+groupedHtml+'</ul>' + (role==='expert'?paginationBar:'');

    updateConfirmationSummary(filtered);
    if(role==='expert'){
      const sel = document.getElementById('reportFilterSel'); if(sel){ sel.addEventListener('change', e=>{ reportFilter = sel.value; renderUserReports(audios); }); }
      // Populate user filter
      const uSel = document.getElementById('expertUserFilter');
      if(uSel){
        const statsByUser = {};
        rows.forEach(r=>{ if(!r.userId) return; (statsByUser[r.userId] ||= {name:r.userName||r.userId,total:0,confirmed:0,structured:0}); statsByUser[r.userId].total++; if(r.source==='userReport') statsByUser[r.userId].structured++; if(getConfirmation(r.commentId)) statsByUser[r.userId].confirmed++; });
        const uniqueUsers = Object.keys(statsByUser).map(id=>({id, ...statsByUser[id]}));
        uniqueUsers.sort((a,b)=> a.name.localeCompare(b.name));
        uSel.innerHTML = '<option value="">All</option>'+uniqueUsers.map(u=>`<option value="${u.id}" ${userFilterId===u.id?'selected':''}>${escapeHtml(u.name)} (${u.total}/${u.confirmed})</option>`).join('');
        uSel.addEventListener('change', ()=>{ window.__expertUserFilter = uSel.value || null; renderUserReports(audios); });
      }

      const toggleStructuredOnly = document.getElementById('toggleStructuredOnly');
      if(toggleStructuredOnly){ toggleStructuredOnly.addEventListener('change', ()=>{ __showOnlyStructured = toggleStructuredOnly.checked; __page=1; renderUserReports(audios); }); }
      const groupModeSel = document.getElementById('groupModeSel'); if(groupModeSel){ groupModeSel.addEventListener('change', ()=>{ __groupMode = groupModeSel.value; renderUserReports(audios); }); }
      document.querySelectorAll('.report-chip').forEach(ch=>{
        ch.addEventListener('click', ()=>{ const v = ch.getAttribute('data-chip'); __activeChipFilter = (__activeChipFilter===v)?null:v; applyChipFilterAndRerender(audios); });
      });
      document.querySelectorAll('button[data-action="page-prev"],button[data-action="page-next"]').forEach(b=>{
        b.addEventListener('click', ()=>{ if(b.disabled) return; if(b.getAttribute('data-action')==='page-prev'){ if(__page>1){ __page--; } } else { __page++; } renderUserReports(audios); });
      });
      document.querySelectorAll('button[data-action="batch-select-user"]').forEach(btn=>{
        btn.addEventListener('click', ()=>{ const uid = btn.getAttribute('data-user'); batchSelectUser(uid); });
      });
    }
  }

  function renderReportRow(r){
    const conf = getConfirmation(r.commentId);
    const badge = conf?`<span class=\"confirmed-badge\" title=\"${conf.category||''} (conf ${conf.confidence||''})\">Confirmed</span>`:'';
    let expertControls='';
    if(role==='expert' && !conf){
      expertControls = `
        <div class=\"report-line-controls\">
          <select data-role=\"cat\" class=\"rep-cat\">
            <option value=\"Whale\">Whale</option>
            <option value=\"Vessel\">Vessel</option>
            <option value=\"Other\">Other</option>
          </select>
          <select data-role=\"conf\" class=\"rep-conf\">
            <option value=\"1\">1</option>
            <option value=\"2\">2</option>
            <option value=\"3\" selected>3</option>
            <option value=\"4\">4</option>
            <option value=\"5\">5</option>
          </select>
          <button class=\"confirm-btn\" data-action=\"confirm-report\" data-comment=\"${r.commentId}\" data-clip=\"${r.clipId}\">Confirm</button>
          <input type=\"checkbox\" class=\"batch-select\" data-comment=\"${r.commentId}\" title=\"Select for batch\" />
        </div>`;
    }
    const metaBits = [];
    if(r.source==='userReport'){ metaBits.push('<span class=\"mini-pill\">SR</span>'); }
    if(r.type){ metaBits.push(`<span class=\"mini-type\">${escapeHtml(r.type)}</span>`); }
    if(r.at){ metaBits.push(`<span class=\"mini-at\" title=\"Reported time within clip\">[${escapeHtml(r.at)}]</span>`); }
    return `<li class=\"report-row-item\" data-comment=\"${r.commentId}\"><a href=\"hydrophones.html#${r.clipId}\">${escapeHtml(r.location)}</a><br><span class=\"mini-count\">${r.ts?escapeHtml(formatDate(r.ts)):''}</span> ${metaBits.join(' ')} ${escapeHtml(r.text||'')} <span class=\"mini-user\">${escapeHtml(r.userName||'')}</span> ${badge} ${expertControls}</li>`;
  }

  function updateConfirmationSummary(list){
    const el = userReportsEl.querySelector('.confirm-summary'); if(!el) return;
    let un=0, conf=0; list.forEach(r=>{ if(getConfirmation(r.commentId)) conf++; else un++; });
    el.textContent = `${un} unconfirmed / ${conf} confirmed`;
  }

  function applyChipFilterAndRerender(audios){
    if(!__activeChipFilter){ renderUserReports(audios); return; }
    // chip filtering derived from cached rows, then apply confirmation logic etc inside renderUserReports.
    // We'll store chosen chip and let renderUserReports apply again (simpler approach) but for special chips we pre-adjust global toggles.
    if(__activeChipFilter==='top'){
      // identify top 3 reporters by structured reports count
      if(__reportRowCache){
        const counts={}; __reportRowCache.rows.forEach(r=>{ if(r.userId){ counts[r.userId]=(counts[r.userId]||0)+(r.source==='userReport'?1:0); } });
        const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);
        window.__expertUserFilter = null; // show all but we will highlight via grouping later (not implemented highlight)
      }
    } else if(__activeChipFilter==='noConf'){
      // no special pre-step; render will reflect
    } else if(__activeChipFilter==='needsReview'){
      // Could toggle to show structured only
      __showOnlyStructured = true;
    }
    renderUserReports(audios);
  }

  function batchSelectUser(userId){
    const checkboxes = userReportsEl.querySelectorAll(`.report-row-item .batch-select`);
    checkboxes.forEach(cb=>{
      const li = cb.closest('.report-row-item');
      if(!li) return;
      // naive: we stored user name only in text; simpler to rely on cached rows mapping
      if(__reportRowCache){
        const id = cb.getAttribute('data-comment');
        const r = __reportRowCache.rows.find(x=>x.commentId===id);
        if(r && r.userId===userId){ cb.checked = true; }
      }
    });
  }

  // Aggregate Metrics Panel
  function renderAggregateMetrics(audios){
    if(!aggregateMetricsBody || role!=='expert') return;
    // Invalidate and rebuild rows to ensure counts fresh
  invalidateReportCache();
  const rows = assembleReportRows(audios);
    const totalPublicComments = rows.filter(r=> r.source==='comment').length;
    const totalStructured = rows.filter(r=> r.source==='userReport').length;
    const distinctUsers = new Set(rows.filter(r=> !!r.userId).map(r=> r.userId)).size;
    let confirmed=0, unconfirmed=0; rows.forEach(r=>{ if(getConfirmation(r.commentId)) confirmed++; else unconfirmed++; });
    aggregateMetricsBody.innerHTML = `
      <div class="agg-metrics">
        <div class="agg-metric"><div class="am-label">Public Comments</div><div class="am-value">${totalPublicComments}</div></div>
        <div class="agg-metric"><div class="am-label">Structured Reports</div><div class="am-value">${totalStructured}</div></div>
        <div class="agg-metric"><div class="am-label">Contributing Users</div><div class="am-value">${distinctUsers}</div></div>
        <div class="agg-metric"><div class="am-label">Unconf / Conf</div><div class="am-value">${unconfirmed}/${confirmed}</div></div>
      </div>`;
  }
  // Legacy confirmKey left unused after upgrade

  function renderScoreboard(audios){
    if(!mComments || !mChecked || !mTags || !mScore) return;
    // total comments
    const currentUserId = localStorage.getItem('demoUserId');
    let totalComments = 0; let totalReports = 0; const tagSet = new Set();
    // confirmations count for this user
    let confirmedCount = 0; try {
      const confStore = JSON.parse(localStorage.getItem('reportConfirmations')||'{}');
      Object.keys(confStore).forEach(k=>{ const c=confStore[k]; if(currentUserId && c && c.confirmerUserId===currentUserId) confirmedCount++; });
    } catch(e){ /* ignore */ }
    audios.forEach(a=>{ 
      const cs = readComments(a.id).filter(c=> !currentUserId || c.userId===currentUserId);
      if(cs.length){ totalComments += cs.length; a.tags && a.tags.forEach(t=>tagSet.add(t)); }
      const reps = readUserReports(a.id).filter(r=> !currentUserId || r.userId===currentUserId || (!r.userId && r.user && SAMPLE_NAME_TO_ID[r.user]===currentUserId));
      if(reps.length){ totalReports += reps.length; a.tags && a.tags.forEach(t=>tagSet.add(t)); }
    });
    const mReportsEl = document.getElementById('mReports')?.querySelector('.num');
    if(mReportsEl) mReportsEl.textContent = totalReports;
    const mConfirmedEl = document.getElementById('mConfirmed')?.querySelector('.num');
    if(mConfirmedEl) mConfirmedEl.textContent = confirmedCount;
    // viewed clips (per-user key)
    let viewed = [];
    try { viewed = JSON.parse(localStorage.getItem('viewedClips:'+(currentUserId||'anon'))||'[]'); } catch(e){ viewed=[]; }
    // Unique tags across commented clips already in tagSet
    mComments.textContent = totalComments;
    mChecked.textContent = viewed.length;
    mTags.textContent = tagSet.size;
  // Score formula: comments + reports + viewed + tags + (confirmations * 3)
  const score = totalComments + totalReports + viewed.length + tagSet.size + (confirmedCount * 3);
    mScore.textContent = score;
  }

  // Mock approvals: list of whale-tagged clips with at least one comment; expert can mark approved
  function renderApprovals(audios){
    if(!approvalsList) return;
    const pending = audios.filter(a=>a.tags.includes('whales') && readComments(a.id).length);
    if(!pending.length){ approvalsList.innerHTML = '<div class="empty">No pending detections.</div>'; return; }
    approvalsList.innerHTML = pending.map(a=>{
      const approved = isApproved(a.id);
      return `<div class="approval-row" data-id="${a.id}"><span>${escapeHtml(a.location||a.title)}</span> <button data-action="approve" class="approve-btn" ${approved?'disabled':''}>${approved?'Approved':'Approve'}</button></div>`;
    }).join('');
  }

  function renderActivity(){
    if(!activityList || !window.ActivityLog) return;
    const currentUserId = localStorage.getItem('demoUserId');
    const currentRole = localStorage.getItem('demoUserRole');
    let items = ActivityLog.getActivity().slice(0,100);
    if(currentRole==='public' && currentUserId){
      items = items.filter(e=> e.userId === currentUserId || (!e.userId && e.userName && SAMPLE_NAME_TO_ID[e.userName]===currentUserId));
    }
    if(!items.length){ activityList.innerHTML = '<div class="empty">No activity yet.</div>'; return; }
    activityList.innerHTML = '<ul class="activity-ul">'+items.map(e=>{
      const uname = e.userName ? escapeHtml(e.userName) : 'Unknown';
      const uid = e.userId ? escapeHtml(e.userId) : '';
      return `<li class="act-item act-${e.type}"><span class="act-time">${formatDate(e.ts)}</span> <span class="act-type">${e.type}</span> <span class="act-role">${uname} (${e.role}${uid?','+uid:''})</span> ${e.details && e.details.clip?`clip ${escapeHtml(e.details.clip)}`:''}${e.type==='vote' && e.details?` value=${e.details.value}`:''}</li>`;
    }).join('')+'</ul>';
  }

  // ---------- User Report (detail tab) aggregation (expert management) ----------
  function readUserReports(clipId){
    try { return JSON.parse(localStorage.getItem('userReports:'+clipId)||'[]'); } catch(e){ return []; }
  }
  function saveUserReports(clipId, arr){ localStorage.setItem('userReports:'+clipId, JSON.stringify(arr)); }
  function candidateStore(){ try { return JSON.parse(localStorage.getItem('candidateReports')||'{}'); } catch(e){ return {}; } }
  function saveCandidateStore(obj){ localStorage.setItem('candidateReports', JSON.stringify(obj)); }
  function isCandidate(reportId){ const s=candidateStore(); return !!s[reportId]; }
  function toggleCandidate(reportObj){
    const s=candidateStore();
    if(s[reportObj.id]){ delete s[reportObj.id]; }
    else { s[reportObj.id] = { ts:new Date().toISOString(), clipId:reportObj.clipId, type:reportObj.type, at:reportObj.at||'', text:reportObj.text||'' }; }
    saveCandidateStore(s);
  }

  function aggregateAllUserReports(audios){
    const out=[];
    audios.forEach(a=>{
      const reps = readUserReports(a.id);
      reps.forEach(r=> out.push({ clipId:a.id, location:a.location||a.title, ...r }));
    });
    return out;
  }

  let manageFilterType='all'; let manageSort='newest'; let manageGroup=false;
  if(manageTypeFilter){ manageTypeFilter.addEventListener('change', ()=>{ manageFilterType=manageTypeFilter.value; renderManageReportsFromCache(); }); }
  if(manageSortSel){ manageSortSel.addEventListener('change', ()=>{ manageSort=manageSortSel.value; renderManageReportsFromCache(); }); }
  if(groupByTypeChk){ groupByTypeChk.addEventListener('change', ()=>{ manageGroup=groupByTypeChk.checked; renderManageReportsFromCache(); }); }
  if(manageSearchInput){ manageSearchInput.addEventListener('input', ()=>{ manageSearch = manageSearchInput.value.trim().toLowerCase(); renderManageReportsFromCache(); }); }
  if(batchSelectAllBtn){ batchSelectAllBtn.addEventListener('click', ()=>{ selectAllManage(true); }); }
  if(batchClearBtn){ batchClearBtn.addEventListener('click', ()=>{ selectAllManage(false); }); }
  if(batchCandidateBtn){ batchCandidateBtn.addEventListener('click', ()=> batchMarkCandidate(true)); }
  if(batchUncandidateBtn){ batchUncandidateBtn.addEventListener('click', ()=> batchMarkCandidate(false)); }
  if(batchConfirmBtn){ batchConfirmBtn.addEventListener('click', batchConfirmReports); }
  if(exportCandidatesBtn){ exportCandidatesBtn.addEventListener('click', exportCandidatesJSON); }

  let manageSearch='';
  function selectAllManage(state){
    if(!manageListEl) return; const boxes = manageListEl.querySelectorAll('.mr-select'); boxes.forEach(b=> b.checked = state);
  }
  function getSelectedManageRows(){
    if(!manageListEl) return []; return Array.from(manageListEl.querySelectorAll('.mr-select:checked')).map(b=>{
      const row = b.closest('.manage-row');
      return { reportId: row.getAttribute('data-report'), clipId: row.getAttribute('data-clip') };
    });
  }
  function batchMarkCandidate(mark){
    const selected = getSelectedManageRows(); if(!selected.length){ alert('No reports selected.'); return; }
    selected.forEach(sel => {
      // need the report data to add if marking
      if(mark){
        const list = readUserReports(sel.clipId);
        const r = list.find(x=>x.id===sel.reportId); if(r && !isCandidate(r.id)) toggleCandidate({ ...r, clipId: sel.clipId });
      } else {
        if(isCandidate(sel.reportId)) toggleCandidate({ id: sel.reportId, clipId: sel.clipId });
      }
    });
    window.ActivityLog && ActivityLog.logActivity(mark?'report_candidate_batch_add':'report_candidate_batch_remove', {count:selected.length});
    renderManageReportsFromCache(); renderCandidateReportsFromCache();
  }
  function batchConfirmReports(){
    const selected = getSelectedManageRows(); if(!selected.length){ alert('No reports selected.'); return; }
    const cat = prompt('Category (Whale/Vessel/Other)','Whale')||'Whale';
    const conf = parseInt(prompt('Confidence 1-5','4')||'4',10);
    selected.forEach(sel => {
      // confirmations reuse reportConfirmations store keyed by reportId
      setConfirmation(sel.reportId, {clipId:sel.clipId, category:cat, confidence:conf, ts:new Date().toISOString(), confirmerRole:role});
    });
    window.ActivityLog && ActivityLog.logActivity('report_confirm_batch_user_reports', {count:selected.length, category:cat, confidence:conf});
    renderManageReportsFromCache(); renderCandidateReportsFromCache();
  }
  function exportCandidatesJSON(){
    const c = candidateStore();
    const blob = new Blob([JSON.stringify(c, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='candidate-reports.json'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 100);
  }

  function renderManageReports(audios){
    if(role!=='expert' || !manageListEl) return;
    const all = aggregateAllUserReports(audios);
    if(!all.length){ manageListEl.innerHTML = '<div class="empty">No user reports yet.</div>'; return; }
    let filtered = all.filter(r=> manageFilterType==='all' ? true : (r.type===manageFilterType));
    if(manageSearch){
      filtered = filtered.filter(r=> (r.text||'').toLowerCase().includes(manageSearch) || (r.at||'').toLowerCase().includes(manageSearch));
    }
    // Sorting
    filtered.sort((a,b)=>{
      if(manageSort==='oldest') return new Date(a.ts)-new Date(b.ts);
      if(manageSort==='type'){ return (a.type||'').localeCompare(b.type||'') || (new Date(b.ts)-new Date(a.ts)); }
      return new Date(b.ts)-new Date(a.ts); // newest
    });
    // Grouping by type
    let html='';
    if(manageGroup){
      const groups = {};
      filtered.forEach(r=>{ const t=r.type||'other'; (groups[t]=groups[t]||[]).push(r); });
      Object.keys(groups).sort().forEach(t=>{
        html += `<div class="group-head">${t.charAt(0).toUpperCase()+t.slice(1)}</div>` + groups[t].map(renderManageRow).join('');
      });
    } else {
      html = filtered.map(renderManageRow).join('');
    }
    manageListEl.innerHTML = `<div class="manage-report-list">${html}</div>`;
    // Reselect previously selected report if still present
    if(window.__selectedReportId){
      const sel = manageListEl.querySelector(`.manage-row[data-report="${window.__selectedReportId}"]`);
      if(sel) sel.classList.add('selected'); else window.__selectedReportId=null;
    }
    renderReportDetail();
  }

  function renderManageRow(r){
    const time = formatDate(r.ts);
    const candidate = isCandidate(r.id) ? '<span class="candidate-badge" title="Marked candidate">Candidate</span>' : '';
    const conf = getConfirmation(r.id);
    const confBadge = conf ? `<span class=\"confirm-badge\" title=\"${conf.category} (conf ${conf.confidence})\">${conf.category}</span>` : '';
    return `<div class="manage-row" data-report="${r.id}" data-clip="${r.clipId}">
      <div class="mr-main"><label><input type="checkbox" class="mr-select" /></label> <a href="hydrophones.html#${r.clipId}">${escapeHtml(r.location)}</a> <span class="mr-time">${time}</span> <span class="mr-type ${r.type}">${escapeHtml(r.type||'other')}</span> ${candidate} ${confBadge}<br>${r.at?`<span class=\"mr-at\">[${escapeHtml(r.at)}]</span> `:''}${escapeHtml(r.text||'')}</div>
      <div class="mr-actions">
        <button class="mini-btn" data-action="edit-report">Edit</button>
        <button class="mini-btn" data-action="delete-report">Delete</button>
        <button class="mini-btn" data-action="candidate-report">${isCandidate(r.id)?'Unmark':'Candidate'}</button>
      </div>
    </div>`;
  }

  // --- Detail Panel & Audio Controls ---
  function pseudoRandom(seed){ let x = seed & 0xffffffff; return ()=>{ x = (1103515245 * x + 12345) & 0x7fffffff; return x/0x7fffffff; }; }
  function buildWaveformBars(clipId){
    if(!clipId) return '<div class="waveform-empty">No audio</div>';
    const audioObj = window.__audioMap && window.__audioMap[clipId];
    if(!audioObj) return '<div class="waveform-empty">Audio not found</div>';
    const pr = pseudoRandom(clipId.split('').reduce((a,c)=>a+c.charCodeAt(0),0));
    const bars = Array.from({length:80}, ()=>{ const h=Math.max(4,Math.floor(pr()*100)); return `<div class="waveform-bar" style="height:${h}%"></div>`; }).join('');
    return `<div class="waveform-wrap">${bars}</div>`;
  }
  function getSelectedReportData(){
    if(!window.__selectedReportId || !__audiosCache) return null;
    const all = aggregateAllUserReports(__audiosCache);
    return all.find(r=> r.id === window.__selectedReportId) || null;
  }
  function renderReportDetail(){
    const container = document.getElementById('reportDetailBody'); if(!container) return;
    const data = getSelectedReportData();
    if(!data){ container.innerHTML='<div class="detail-placeholder">Select a report to view audio and details.</div>'; return; }
    const audioObj = window.__audioMap && window.__audioMap[data.clipId];
    const audioUrl = audioObj ? audioObj.url : null;
    const timeVal = data.at || '';
    const lastRate = parseFloat(localStorage.getItem('detailAudio:lastRate')||'1')||1;
    container.innerHTML = `
      ${audioUrl?`<audio id="detailAudioEl" src="${audioUrl}" data-clip="${data.clipId}"></audio>`:'<div class="waveform-empty">No audio URL</div>'}
      ${audioUrl?`<div class="audio-controls" aria-label="Custom audio controls">
        <button type="button" class="ac-btn" data-ac="play" aria-label="Play/Pause">▶</button>
        <button type="button" class="ac-btn" data-ac="back5" aria-label="Back 5 seconds">⏪5</button>
        <button type="button" class="ac-btn" data-ac="fwd5" aria-label="Forward 5 seconds">5⏩</button>
        <div class="ac-time" aria-live="off"><span class="ac-cur">0:00</span> / <span class="ac-dur">0:00</span></div>
        <label class="ac-rate-label">Rate
          <select class="ac-rate" aria-label="Playback rate">
            <option value="0.75" ${lastRate===0.75?'selected':''}>0.75x</option>
            <option value="1" ${lastRate===1?'selected':''}>1x</option>
            <option value="1.25" ${lastRate===1.25?'selected':''}>1.25x</option>
            <option value="1.5" ${lastRate===1.5?'selected':''}>1.5x</option>
            <option value="2" ${lastRate===2?'selected':''}>2x</option>
          </select>
        </label>
        <label class="ac-vol-label">Vol
          <input type="range" class="ac-vol" min="0" max="1" step="0.01" value="1" aria-label="Volume" />
        </label>
        <div class="ac-progress-wrap" aria-label="Seek" role="slider" tabindex="0" data-progress>
          <div class="ac-progress-bar"><div class="ac-progress-fill" style="width:0%"></div></div>
        </div>
        <button type="button" class="ac-btn" id="jumpReportTimeBtn" title="Jump to saved report time" ${timeVal?'':'disabled'}>Jump at</button>
        <button type="button" class="ac-btn" id="loopClearBtn" title="Clear loop" disabled>Loop ✖</button>
      </div>`:''}
      <div class="time-edit"><label>Time (mm:ss): <input type="text" id="detailTimeInput" value="${escapeHtml(timeVal)}" placeholder="mm:ss" maxlength="8" /></label><button id="detailTimeSaveBtn" type="button">Save Time</button></div>
      <div class="detail-waveform" id="detailWaveform" data-clip="${data.clipId}">${buildWaveformBars(data.clipId)}</div>
      <div class="detail-meta-block">${buildDetailMetadata(data)}</div>
    `;
    // Save time handler
    const saveBtn = document.getElementById('detailTimeSaveBtn');
    if(saveBtn){ saveBtn.addEventListener('click', ()=>{ const inp=document.getElementById('detailTimeInput'); const v=inp.value.trim(); if(v && !/^\d{1,2}:[0-5]\d$/.test(v)){ alert('Time must be mm:ss'); return; } const d=getSelectedReportData(); if(!d) return; const list=readUserReports(d.clipId); const r=list.find(x=>x.id===d.id); if(r){ r.at=v||''; saveUserReports(d.clipId,list); renderManageReportsFromCache(); renderCandidateReportsFromCache(); } }); }
    const audioEl = document.getElementById('detailAudioEl');
    if(audioEl){
      const btnPlay = container.querySelector('[data-ac="play"]');
      const btnBack5 = container.querySelector('[data-ac="back5"]');
      const btnFwd5 = container.querySelector('[data-ac="fwd5"]');
      const rateSel = container.querySelector('.ac-rate');
      const volRange = container.querySelector('.ac-vol');
      const curSpan = container.querySelector('.ac-cur');
      const durSpan = container.querySelector('.ac-dur');
      const progressWrap = container.querySelector('[data-progress]');
      const progressFill = container.querySelector('.ac-progress-fill');
      const fmt = s=>{ if(!isFinite(s)) return '0:00'; const m=Math.floor(s/60); const sec=Math.floor(s%60); return m+':'+String(sec).padStart(2,'0'); };
      function updateTime(){ curSpan.textContent=fmt(audioEl.currentTime); if(audioEl.duration) progressFill.style.width=(audioEl.currentTime/audioEl.duration)*100+'%'; }
      audioEl.addEventListener('loadedmetadata', ()=>{ durSpan.textContent=fmt(audioEl.duration); updateTime(); });
      audioEl.addEventListener('timeupdate', updateTime);
      audioEl.addEventListener('ended', ()=>{ btnPlay.textContent='▶'; });
      btnPlay && btnPlay.addEventListener('click', ()=>{ if(audioEl.paused){ audioEl.play(); btnPlay.textContent='⏸'; } else { audioEl.pause(); btnPlay.textContent='▶'; } });
      btnBack5 && btnBack5.addEventListener('click', ()=>{ audioEl.currentTime=Math.max(0,audioEl.currentTime-5); });
      btnFwd5 && btnFwd5.addEventListener('click', ()=>{ audioEl.currentTime=Math.min(audioEl.duration||audioEl.currentTime+5,audioEl.currentTime+5); });
      audioEl.playbackRate = lastRate;
      rateSel && rateSel.addEventListener('change', ()=>{ audioEl.playbackRate=parseFloat(rateSel.value)||1; localStorage.setItem('detailAudio:lastRate', String(audioEl.playbackRate)); });
      volRange && volRange.addEventListener('input', ()=>{ audioEl.volume=parseFloat(volRange.value); });
      function seekFromClientX(clientX){ const rect=progressWrap.getBoundingClientRect(); const pct=Math.min(1,Math.max(0,(clientX-rect.left)/rect.width)); audioEl.currentTime=pct*(audioEl.duration||0); }
      progressWrap && progressWrap.addEventListener('click', e=>seekFromClientX(e.clientX));
      progressWrap && progressWrap.addEventListener('keydown', e=>{ if(e.key==='ArrowLeft'){ audioEl.currentTime=Math.max(0,audioEl.currentTime-1); } else if(e.key==='ArrowRight'){ audioEl.currentTime=Math.min(audioEl.duration||audioEl.currentTime+1,audioEl.currentTime+1); } });
      let dragging=false; progressWrap && progressWrap.addEventListener('mousedown', e=>{ dragging=true; seekFromClientX(e.clientX); }); window.addEventListener('mousemove', e=>{ if(dragging) seekFromClientX(e.clientX); }); window.addEventListener('mouseup', ()=>{ dragging=false; });
      const jumpBtn=document.getElementById('jumpReportTimeBtn'); if(jumpBtn && timeVal){ jumpBtn.addEventListener('click', ()=>{ const parts=timeVal.split(':'); if(parts.length===2){ const t=parseInt(parts[0],10)*60+parseInt(parts[1],10); if(isFinite(t)) audioEl.currentTime=Math.min(audioEl.duration||t,t); } }); }
      // Loop markers
      let loopStartIdx=null, loopEndIdx=null; const waveform=document.getElementById('detailWaveform'); const bars=waveform?Array.from(waveform.querySelectorAll('.waveform-bar')):[]; const loopClearBtn=document.getElementById('loopClearBtn');
      function clearLoop(){ loopStartIdx=null; loopEndIdx=null; bars.forEach(b=>b.classList.remove('loop-range','loop-start','loop-end')); loopClearBtn && (loopClearBtn.disabled=true); }
      function applyLoop(){ bars.forEach((b,i)=>{ b.classList.toggle('loop-range', loopStartIdx!=null && loopEndIdx!=null && i>=loopStartIdx && i<=loopEndIdx); b.classList.toggle('loop-start', i===loopStartIdx); b.classList.toggle('loop-end', i===loopEndIdx); }); loopClearBtn && (loopClearBtn.disabled=!(loopStartIdx!=null && loopEndIdx!=null)); }
      bars.forEach((bar,i)=>{ bar.addEventListener('click', ()=>{ if(loopStartIdx==null){ loopStartIdx=i; } else if(loopEndIdx==null){ loopEndIdx=i; if(loopEndIdx<loopStartIdx){ [loopStartIdx,loopEndIdx]=[loopEndIdx,loopStartIdx]; } } else { loopStartIdx=i; loopEndIdx=null; } applyLoop(); }); });
      loopClearBtn && loopClearBtn.addEventListener('click', clearLoop);
      audioEl.addEventListener('timeupdate', ()=>{ if(loopStartIdx!=null && loopEndIdx!=null && audioEl.duration){ const startTime=(loopStartIdx/bars.length)*audioEl.duration; const endTime=(loopEndIdx/bars.length)*audioEl.duration; if(audioEl.currentTime> endTime + 0.05){ audioEl.currentTime=startTime; } }});
      audioEl.addEventListener('loadedmetadata', ()=>{ const dur=audioEl.duration||0; bars.forEach((bar,i)=>{ const t=(i/bars.length)*dur; const m=Math.floor(t/60); const s=Math.floor(t%60); bar.title=m+':'+String(s).padStart(2,'0'); }); });
    }
  }

  function buildDetailMetadata(report){
    const audioObj = window.__audioMap && window.__audioMap[report.clipId];
    if(!audioObj) return '<div class="meta-empty">No metadata</div>';
    const rec = audioObj.recordedAt ? new Date(audioObj.recordedAt) : null;
    const recStr = rec ? rec.toLocaleString(undefined,{ dateStyle:'medium', timeStyle:'short'}) : 'Unknown time';
    const tags = (audioObj.tags||[]).map(t=>`<span class="wf-tag">${escapeHtml(t)}</span>`).join('');
    return `
      <div class="wf-title">${escapeHtml(audioObj.title||report.location||report.clipId)}</div>
      <div class="wf-sub">${escapeHtml(audioObj.location||'Unknown location')} • ${recStr}</div>
      <div class="wf-tags">${tags || '<span class=\"wf-tag empty\">no tags</span>'}</div>
    `;
  }

  document.addEventListener('click', e=>{
    if(role!=='expert') return;
    const row = e.target.closest('.manage-row');
    if(row && row.getAttribute('data-report')){
      window.__selectedReportId = row.getAttribute('data-report');
      document.querySelectorAll('.manage-row.selected').forEach(r=>r.classList.remove('selected'));
      row.classList.add('selected');
      renderReportDetail();
    }
  });

  function renderCandidateReports(audios){
    const cStore = candidateStore();
    const list = Object.keys(cStore).map(id=>({ id, ...cStore[id] }));
    // Expert list (with actions)
    if(candidateListEl){
      if(!list.length){ candidateListEl.innerHTML='<div class="empty">No candidate reports.</div>'; }
      else {
        const groups={}; list.forEach(r=>{ const t=r.type||'other'; (groups[t]=groups[t]||[]).push(r); });
        let html='';
        Object.keys(groups).sort().forEach(t=>{
          html += `<div class="group-head">${t.charAt(0).toUpperCase()+t.slice(1)}</div>` + groups[t].sort((a,b)=> new Date(b.ts)-new Date(a.ts)).map(r=>{
            const conf = getConfirmation(r.id);
            const confBadge = conf ? `<span class=\"confirm-badge\" title=\"${conf.category} (conf ${conf.confidence})\">${conf.category}</span>` : '';
            return `<div class="candidate-row" data-report="${r.id}" data-clip="${r.clipId}">
              <div><a href="hydrophones.html#${r.clipId}">${escapeHtml(r.clipId)}</a> <span class="cand-time">${formatDate(r.ts)}</span> <span class="cand-type ${r.type}">${escapeHtml(r.type)}</span>${confBadge}${r.at?` <span class=\"cand-at\">[${escapeHtml(r.at)}]</span>`:''}<br>${escapeHtml(r.text||'')}</div>
              <div class="cand-actions"><button class="mini-btn" data-action="candidate-report" data-source="candidate-list">Unmark</button></div>
            </div>`;
          }).join('');
        });
        candidateListEl.innerHTML = `<div class="candidate-report-list">${html}</div>`;
      }
    }
    // Public confirmed candidates list (read-only)
    const publicListEl = document.getElementById('publicCandidateReportsList');
    if(publicListEl){
      if(!list.length){ publicListEl.innerHTML='<div class="empty">No confirmed candidate reports yet.</div>'; }
      else {
        const groups2={}; list.forEach(r=>{ const t=r.type||'other'; (groups2[t]=groups2[t]||[]).push(r); });
        let html2='';
        Object.keys(groups2).sort().forEach(t=>{
          html2 += `<div class="group-head">${t.charAt(0).toUpperCase()+t.slice(1)}</div>` + groups2[t].sort((a,b)=> new Date(b.ts)-new Date(a.ts)).map(r=>{
            const conf = getConfirmation(r.id);
            const confBadge = conf ? `<span class=\"confirm-badge\" title=\"${conf.category} (conf ${conf.confidence})\">${conf.category}</span>` : '';
            return `<div class="candidate-row" data-public-candidate="1" data-report="${r.id}" data-clip="${r.clipId}">
              <div><a href="hydrophones.html#${r.clipId}">${escapeHtml(r.clipId)}</a> <span class="cand-time">${formatDate(r.ts)}</span> <span class="cand-type ${r.type}">${escapeHtml(r.type)}</span>${confBadge}${r.at?` <span class=\"cand-at\">[${escapeHtml(r.at)}]</span>`:''}<br>${escapeHtml(r.text||'')}</div>
            </div>`;
          }).join('');
        });
        publicListEl.innerHTML = `<div class="candidate-report-list">${html2}</div>`;
      }
    }
  }

  function renderManageReportsFromCache(){ if(__audiosCache) renderManageReports(__audiosCache); }
  function renderCandidateReportsFromCache(){ if(__audiosCache) renderCandidateReports(__audiosCache); }

  function mirrorActivity(){
    const src = document.getElementById('activityList');
    const dest = document.getElementById('activityListClone');
    if(src && dest){ dest.innerHTML = src.innerHTML; }
  }

  // Separate detail handling for confirmedTab (candidate focus)
  document.addEventListener('click', e=>{
    if(role!=='expert') return;
    const paneConfirmedActive = document.getElementById('confirmedTab')?.classList.contains('active');
    if(!paneConfirmedActive) return; // only handle when confirmed tab active
    const row = e.target.closest('.candidate-row');
    if(row && row.getAttribute('data-report')){
      const reportId = row.getAttribute('data-report');
      window.__selectedCandidateReportId = reportId;
      document.querySelectorAll('#confirmedTab .candidate-row.selected').forEach(r=>r.classList.remove('selected'));
      row.classList.add('selected');
      renderCandidateDetailPanel();
    }
  });

  function getSelectedCandidateData(){
    const id = window.__selectedCandidateReportId; if(!id || !__audiosCache) return null;
    const cStore = candidateStore(); if(!cStore[id]) return null; return { id, ...cStore[id] };
  }
  function renderCandidateDetailPanel(){
    const container = document.getElementById('reportDetailBodyClone'); if(!container) return;
    const data = getSelectedCandidateData();
    if(!data){ container.innerHTML='<div class="detail-placeholder">Select a report to view audio and details.</div>'; return; }
    const audioObj = window.__audioMap && window.__audioMap[data.clipId];
    const audioUrl = audioObj ? audioObj.url : null;
    const timeVal = data.at || '';
    const lastRate = parseFloat(localStorage.getItem('detailAudio:lastRate')||'1')||1;
    const comments = readComments(data.clipId).filter(c=> c.reportId===data.id || !c.reportId); // legacy comments may lack reportId
    container.innerHTML = `
      ${audioUrl?`<audio id="detailAudioElClone" src="${audioUrl}" data-clip="${data.clipId}"></audio>`:'<div class="waveform-empty">No audio URL</div>'}
      ${audioUrl?`<div class="audio-controls" aria-label="Custom audio controls">
        <button type="button" class="ac-btn" data-ac="play" aria-label="Play/Pause">▶</button>
        <button type="button" class="ac-btn" data-ac="back5" aria-label="Back 5 seconds">⏪5</button>
        <button type="button" class="ac-btn" data-ac="fwd5" aria-label="Forward 5 seconds">5⏩</button>
        <div class="ac-time" aria-live="off"><span class="ac-cur">0:00</span> / <span class="ac-dur">0:00</span></div>
        <label class="ac-rate-label">Rate
          <select class="ac-rate" aria-label="Playback rate">
            <option value="0.75" ${lastRate===0.75?'selected':''}>0.75x</option>
            <option value="1" ${lastRate===1?'selected':''}>1x</option>
            <option value="1.25" ${lastRate===1.25?'selected':''}>1.25x</option>
            <option value="1.5" ${lastRate===1.5?'selected':''}>1.5x</option>
            <option value="2" ${lastRate===2?'selected':''}>2x</option>
          </select>
        </label>
        <label class="ac-vol-label">Vol
          <input type="range" class="ac-vol" min="0" max="1" step="0.01" value="1" aria-label="Volume" />
        </label>
        <div class="ac-progress-wrap" aria-label="Seek" role="slider" tabindex="0" data-progress>
          <div class="ac-progress-bar"><div class="ac-progress-fill" style="width:0%"></div></div>
        </div>
        <button type="button" class="ac-btn" id="jumpReportTimeBtnClone" title="Jump to saved report time" ${timeVal?'':'disabled'}>Jump at</button>
        <button type="button" class="ac-btn" id="loopClearBtnClone" title="Clear loop" disabled>Loop ✖</button>
      </div>`:''}
      <div class="time-edit"><label>Time (mm:ss): <input type="text" id="detailTimeInputClone" value="${escapeHtml(timeVal)}" placeholder="mm:ss" maxlength="8" /></label><button id="detailTimeSaveBtnClone" type="button">Save Time</button></div>
      <div class="detail-waveform" id="detailWaveformClone" data-clip="${data.clipId}">${buildWaveformBars(data.clipId)}</div>
      <div class="detail-meta-block">${buildDetailMetadata(data)}</div>
      <div class="detail-comments" id="candidateCommentsWrap">
        <h4>Comments</h4>
        <div class="comment-list" id="candidateCommentsList">${comments.length? comments.map(c=>`<div class=\"c-item\"><span class=\"c-user\">${escapeHtml(c.userName||'User')}:</span> ${escapeHtml(c.text||'')} ${c.ts?`<span class=\"c-ts\">${formatDate(c.ts)}</span>`:''}</div>`).join('') : '<div class=\"empty\">No comments yet.</div>'}</div>
        <div class="comment-form" id="candidateCommentFormWrap"></div>
      </div>
    `;
    // Inject form only if signed in
    const uid = localStorage.getItem('demoUserId');
    const uname = localStorage.getItem('demoUserName') || 'You';
    if(uid){
      const formWrap = document.getElementById('candidateCommentFormWrap');
      formWrap.innerHTML = `<form id="candidateCommentForm"><textarea id="candidateCommentText" rows="2" maxlength="240" placeholder="Add a comment about this audio..."></textarea><div><button type="submit" class="mini-btn">Submit</button></div></form>`;
      formWrap.querySelector('form').addEventListener('submit', ev=>{
        ev.preventDefault();
        const txt = formWrap.querySelector('#candidateCommentText').value.trim();
        if(!txt) return;
        const list = readComments(data.clipId);
        const newId = genCommentId(data.clipId, list.length+1);
        list.push({id:newId, text:txt, ts:new Date().toISOString(), userId:uid, userName:uname, reportId:data.id});
        localStorage.setItem('comments:'+data.clipId, JSON.stringify(list));
        formWrap.querySelector('#candidateCommentText').value='';
        renderCandidateDetailPanel(); // re-render
        renderComments(__audiosCache||[]); // update public/private comments panels if present
      });
    }
    const saveBtn = document.getElementById('detailTimeSaveBtnClone');
    if(saveBtn){ saveBtn.addEventListener('click', ()=>{ const inp=document.getElementById('detailTimeInputClone'); const v=inp.value.trim(); if(v && !/^\d{1,2}:[0-5]\d$/.test(v)){ alert('Time must be mm:ss'); return; } const cStore=candidateStore(); const rec=cStore[data.id]; if(rec){ rec.at=v||''; cStore[data.id]=rec; saveCandidateStore(cStore); renderCandidateReportsFromCache(); renderCandidateDetailPanel(); } }); }
    const audioEl = document.getElementById('detailAudioElClone');
    if(audioEl){
      const btnPlay = container.querySelector('[data-ac="play"]');
      const btnBack5 = container.querySelector('[data-ac="back5"]');
      const btnFwd5 = container.querySelector('[data-ac="fwd5"]');
      const rateSel = container.querySelector('.ac-rate');
      const volRange = container.querySelector('.ac-vol');
      const curSpan = container.querySelector('.ac-cur');
      const durSpan = container.querySelector('.ac-dur');
      const progressWrap = container.querySelector('[data-progress]');
      const progressFill = container.querySelector('.ac-progress-fill');
      const fmt = s=>{ if(!isFinite(s)) return '0:00'; const m=Math.floor(s/60); const sec=Math.floor(s%60); return m+':'+String(sec).padStart(2,'0'); };
      function updateTime(){ curSpan.textContent=fmt(audioEl.currentTime); if(audioEl.duration) progressFill.style.width=(audioEl.currentTime/audioEl.duration)*100+'%'; }
      audioEl.addEventListener('loadedmetadata', ()=>{ durSpan.textContent=fmt(audioEl.duration); updateTime(); });
      audioEl.addEventListener('timeupdate', updateTime);
      audioEl.addEventListener('ended', ()=>{ btnPlay.textContent='▶'; });
      btnPlay && btnPlay.addEventListener('click', ()=>{ if(audioEl.paused){ audioEl.play(); btnPlay.textContent='⏸'; } else { audioEl.pause(); btnPlay.textContent='▶'; } });
      btnBack5 && btnBack5.addEventListener('click', ()=>{ audioEl.currentTime=Math.max(0,audioEl.currentTime-5); });
      btnFwd5 && btnFwd5.addEventListener('click', ()=>{ audioEl.currentTime=Math.min(audioEl.duration||audioEl.currentTime+5,audioEl.currentTime+5); });
      audioEl.playbackRate = lastRate;
      rateSel && rateSel.addEventListener('change', ()=>{ audioEl.playbackRate=parseFloat(rateSel.value)||1; localStorage.setItem('detailAudio:lastRate', String(audioEl.playbackRate)); });
      volRange && volRange.addEventListener('input', ()=>{ audioEl.volume=parseFloat(volRange.value); });
      function seekFromClientX(x){ const rect=progressWrap.getBoundingClientRect(); const pct=Math.min(1,Math.max(0,(x-rect.left)/rect.width)); audioEl.currentTime=pct*(audioEl.duration||0); }
      progressWrap && progressWrap.addEventListener('click', e=>seekFromClientX(e.clientX));
      progressWrap && progressWrap.addEventListener('keydown', e=>{ if(e.key==='ArrowLeft'){ audioEl.currentTime=Math.max(0,audioEl.currentTime-1); } else if(e.key==='ArrowRight'){ audioEl.currentTime=Math.min(audioEl.duration||audioEl.currentTime+1,audioEl.currentTime+1); } });
      let dragging=false; progressWrap && progressWrap.addEventListener('mousedown', e=>{ dragging=true; seekFromClientX(e.clientX); }); window.addEventListener('mousemove', e=>{ if(dragging) seekFromClientX(e.clientX); }); window.addEventListener('mouseup', ()=>{ dragging=false; });
      const jumpBtn=document.getElementById('jumpReportTimeBtnClone'); if(jumpBtn && timeVal){ jumpBtn.addEventListener('click', ()=>{ const parts=timeVal.split(':'); if(parts.length===2){ const t=parseInt(parts[0],10)*60+parseInt(parts[1],10); if(isFinite(t)) audioEl.currentTime=Math.min(audioEl.duration||t,t); } }); }
      // Loop for candidate panel
      let loopStartIdx=null, loopEndIdx=null; const waveform=document.getElementById('detailWaveformClone'); const bars=waveform?Array.from(waveform.querySelectorAll('.waveform-bar')):[]; const loopClearBtn=document.getElementById('loopClearBtnClone');
      function clearLoop(){ loopStartIdx=null; loopEndIdx=null; bars.forEach(b=>b.classList.remove('loop-range','loop-start','loop-end')); loopClearBtn && (loopClearBtn.disabled=true); }
      function applyLoop(){ bars.forEach((b,i)=>{ b.classList.toggle('loop-range', loopStartIdx!=null && loopEndIdx!=null && i>=loopStartIdx && i<=loopEndIdx); b.classList.toggle('loop-start', i===loopStartIdx); b.classList.toggle('loop-end', i===loopEndIdx); }); loopClearBtn && (loopClearBtn.disabled=!(loopStartIdx!=null && loopEndIdx!=null)); }
      bars.forEach((bar,i)=>{ bar.addEventListener('click', ()=>{ if(loopStartIdx==null){ loopStartIdx=i; } else if(loopEndIdx==null){ loopEndIdx=i; if(loopEndIdx<loopStartIdx){ [loopStartIdx,loopEndIdx]=[loopEndIdx,loopStartIdx]; } } else { loopStartIdx=i; loopEndIdx=null; } applyLoop(); }); });
      loopClearBtn && loopClearBtn.addEventListener('click', clearLoop);
      audioEl.addEventListener('timeupdate', ()=>{ if(loopStartIdx!=null && loopEndIdx!=null && audioEl.duration){ const st=(loopStartIdx/bars.length)*audioEl.duration; const et=(loopEndIdx/bars.length)*audioEl.duration; if(audioEl.currentTime> et + 0.05){ audioEl.currentTime=st; } }});
      audioEl.addEventListener('loadedmetadata', ()=>{ const dur=audioEl.duration||0; bars.forEach((bar,i)=>{ const t=(i/bars.length)*dur; const m=Math.floor(t/60); const s=Math.floor(t%60); bar.title=m+':'+String(s).padStart(2,'0'); }); });
    }
  }
  // Public confirmed tab selection and detail
  document.addEventListener('click', e=>{
    if(role==='expert') return; // only public
    const paneActive = document.getElementById('publicConfirmedTab')?.classList.contains('active');
    if(!paneActive) return;
    const row = e.target.closest('.candidate-row[data-public-candidate]');
    if(row){
      window.__selectedPublicCandidateId = row.getAttribute('data-report');
      document.querySelectorAll('#publicConfirmedTab .candidate-row.selected').forEach(r=>r.classList.remove('selected'));
      row.classList.add('selected');
      renderPublicCandidateDetail();
    }
  });
  function getSelectedPublicCandidate(){
    const id = window.__selectedPublicCandidateId; if(!id || !__audiosCache) return null;
    const cStore = candidateStore(); if(!cStore[id]) return null; return { id, ...cStore[id] };
  }
  function renderPublicCandidateDetail(){
    const container = document.getElementById('publicCandidateDetailBody'); if(!container) return;
    const data = getSelectedPublicCandidate();
    if(!data){ container.innerHTML='<div class="detail-placeholder">Select a candidate report to view audio and details.</div>'; return; }
    const audioObj = window.__audioMap && window.__audioMap[data.clipId];
    const audioUrl = audioObj ? audioObj.url : null;
    const timeVal = data.at || '';
    const lastRate = parseFloat(localStorage.getItem('detailAudio:lastRate')||'1')||1;
    const comments = readComments(data.clipId).filter(c=> c.reportId===data.id || !c.reportId);
    container.innerHTML = `
      ${audioUrl?`<audio id="publicDetailAudioEl" src="${audioUrl}" data-clip="${data.clipId}"></audio>`:'<div class="waveform-empty">No audio URL</div>'}
      ${audioUrl?`<div class="audio-controls" aria-label="Custom audio controls">
        <button type="button" class="ac-btn" data-ac="play" aria-label="Play/Pause">▶</button>
        <button type="button" class="ac-btn" data-ac="back5" aria-label="Back 5 seconds">⏪5</button>
        <button type="button" class="ac-btn" data-ac="fwd5" aria-label="Forward 5 seconds">5⏩</button>
        <div class="ac-time" aria-live="off"><span class="ac-cur">0:00</span> / <span class="ac-dur">0:00</span></div>
        <label class="ac-rate-label">Rate
          <select class="ac-rate" aria-label="Playback rate">
            <option value="0.75" ${lastRate===0.75?'selected':''}>0.75x</option>
            <option value="1" ${lastRate===1?'selected':''}>1x</option>
            <option value="1.25" ${lastRate===1.25?'selected':''}>1.25x</option>
            <option value="1.5" ${lastRate===1.5?'selected':''}>1.5x</option>
            <option value="2" ${lastRate===2?'selected':''}>2x</option>
          </select>
        </label>
        <label class="ac-vol-label">Vol
          <input type="range" class="ac-vol" min="0" max="1" step="0.01" value="1" aria-label="Volume" />
        </label>
        <div class="ac-progress-wrap" aria-label="Seek" role="slider" tabindex="0" data-progress>
          <div class="ac-progress-bar"><div class="ac-progress-fill" style="width:0%"></div></div>
        </div>
        <button type="button" class="ac-btn" id="jumpPublicReportTimeBtn" title="Jump to saved report time" ${timeVal?'':'disabled'}>Jump at</button>
        <button type="button" class="ac-btn" id="loopClearBtnPublic" title="Clear loop" disabled>Loop ✖</button>
      </div>`:''}
      <div class="time-edit"><label>Time (mm:ss): <input type="text" id="publicDetailTimeInput" value="${escapeHtml(timeVal)}" placeholder="mm:ss" maxlength="8" disabled /></label></div>
      <div class="detail-waveform" id="publicDetailWaveform" data-clip="${data.clipId}">${buildWaveformBars(data.clipId)}</div>
      <div class="detail-meta-block">${buildDetailMetadata(data)}</div>
      <div class="detail-comments" id="publicCandidateCommentsWrap">
        <h4>Comments</h4>
        <div class="comment-list" id="publicCandidateCommentsList">${comments.length? comments.map(c=>`<div class=\"c-item\"><span class=\"c-user\">${escapeHtml(c.userName||'User')}:</span> ${escapeHtml(c.text||'')} ${c.ts?`<span class=\"c-ts\">${formatDate(c.ts)}</span>`:''}</div>`).join('') : '<div class=\"empty\">No comments yet.</div>'}</div>
        <div class="comment-form" id="publicCandidateCommentFormWrap"></div>
      </div>
    `;
    const uid = localStorage.getItem('demoUserId');
    const uname = localStorage.getItem('demoUserName') || 'You';
    if(uid){
      const formWrap = document.getElementById('publicCandidateCommentFormWrap');
      formWrap.innerHTML = `<form id="publicCandidateCommentForm"><textarea id="publicCandidateCommentText" rows="2" maxlength="240" placeholder="Add a comment..."></textarea><div><button type="submit" class="mini-btn">Submit</button></div></form>`;
      formWrap.querySelector('form').addEventListener('submit', ev=>{
        ev.preventDefault();
        const txt = formWrap.querySelector('#publicCandidateCommentText').value.trim();
        if(!txt) return;
        const list = readComments(data.clipId);
        const newId = genCommentId(data.clipId, list.length+1);
        list.push({id:newId, text:txt, ts:new Date().toISOString(), userId:uid, userName:uname, reportId:data.id});
        localStorage.setItem('comments:'+data.clipId, JSON.stringify(list));
        formWrap.querySelector('#publicCandidateCommentText').value='';
        renderPublicCandidateDetail();
        renderComments(__audiosCache||[]);
      });
    }
    const audioEl = document.getElementById('publicDetailAudioEl');
    if(audioEl){
      const btnPlay = container.querySelector('[data-ac="play"]');
      const btnBack5 = container.querySelector('[data-ac="back5"]');
      const btnFwd5 = container.querySelector('[data-ac="fwd5"]');
      const rateSel = container.querySelector('.ac-rate');
      const volRange = container.querySelector('.ac-vol');
      const curSpan = container.querySelector('.ac-cur');
      const durSpan = container.querySelector('.ac-dur');
      const progressWrap = container.querySelector('[data-progress]');
      const progressFill = container.querySelector('.ac-progress-fill');
      const fmt = s=>{ if(!isFinite(s)) return '0:00'; const m=Math.floor(s/60); const sec=Math.floor(s%60); return m+':'+String(sec).padStart(2,'0'); };
      function updateTime(){ curSpan.textContent=fmt(audioEl.currentTime); if(audioEl.duration) progressFill.style.width=(audioEl.currentTime/audioEl.duration)*100+'%'; }
      audioEl.addEventListener('loadedmetadata', ()=>{ durSpan.textContent=fmt(audioEl.duration); updateTime(); const dur=audioEl.duration||0; const bars=[...document.querySelectorAll('#publicDetailWaveform .waveform-bar')]; bars.forEach((bar,i)=>{ const t=(i/bars.length)*dur; const m=Math.floor(t/60); const s=Math.floor(t%60); bar.title=m+':'+String(s).padStart(2,'0'); }); });
      audioEl.addEventListener('timeupdate', updateTime);
      audioEl.addEventListener('ended', ()=>{ btnPlay.textContent='▶'; });
      btnPlay && btnPlay.addEventListener('click', ()=>{ if(audioEl.paused){ audioEl.play(); btnPlay.textContent='⏸'; } else { audioEl.pause(); btnPlay.textContent='▶'; } });
      btnBack5 && btnBack5.addEventListener('click', ()=>{ audioEl.currentTime=Math.max(0,audioEl.currentTime-5); });
      btnFwd5 && btnFwd5.addEventListener('click', ()=>{ audioEl.currentTime=Math.min(audioEl.duration||audioEl.currentTime+5,audioEl.currentTime+5); });
      audioEl.playbackRate = lastRate;
      rateSel && rateSel.addEventListener('change', ()=>{ audioEl.playbackRate=parseFloat(rateSel.value)||1; localStorage.setItem('detailAudio:lastRate', String(audioEl.playbackRate)); });
      volRange && volRange.addEventListener('input', ()=>{ audioEl.volume=parseFloat(volRange.value); });
      function seekFromClientX(x){ const rect=progressWrap.getBoundingClientRect(); const pct=Math.min(1,Math.max(0,(x-rect.left)/rect.width)); audioEl.currentTime=pct*(audioEl.duration||0); }
      progressWrap && progressWrap.addEventListener('click', e=>seekFromClientX(e.clientX));
      progressWrap && progressWrap.addEventListener('keydown', e=>{ if(e.key==='ArrowLeft'){ audioEl.currentTime=Math.max(0,audioEl.currentTime-1); } else if(e.key==='ArrowRight'){ audioEl.currentTime=Math.min(audioEl.duration||audioEl.currentTime+1,audioEl.currentTime+1); } });
      let dragging=false; progressWrap && progressWrap.addEventListener('mousedown', e=>{ dragging=true; seekFromClientX(e.clientX); }); window.addEventListener('mousemove', e=>{ if(dragging) seekFromClientX(e.clientX); }); window.addEventListener('mouseup', ()=>{ dragging=false; });
      let loopStartIdx=null, loopEndIdx=null; const waveform=document.getElementById('publicDetailWaveform'); const bars=waveform?Array.from(waveform.querySelectorAll('.waveform-bar')):[]; const loopClearBtn=document.getElementById('loopClearBtnPublic');
      function clearLoop(){ loopStartIdx=null; loopEndIdx=null; bars.forEach(b=>b.classList.remove('loop-range','loop-start','loop-end')); loopClearBtn && (loopClearBtn.disabled=true); }
      function applyLoop(){ bars.forEach((b,i)=>{ b.classList.toggle('loop-range', loopStartIdx!=null && loopEndIdx!=null && i>=loopStartIdx && i<=loopEndIdx); b.classList.toggle('loop-start', i===loopStartIdx); b.classList.toggle('loop-end', i===loopEndIdx); }); loopClearBtn && (loopClearBtn.disabled=!(loopStartIdx!=null && loopEndIdx!=null)); }
      bars.forEach((bar,i)=>{ bar.addEventListener('click', ()=>{ if(loopStartIdx==null){ loopStartIdx=i; } else if(loopEndIdx==null){ loopEndIdx=i; if(loopEndIdx<loopStartIdx){ [loopStartIdx,loopEndIdx]=[loopEndIdx,loopStartIdx]; } } else { loopStartIdx=i; loopEndIdx=null; } applyLoop(); }); });
      loopClearBtn && loopClearBtn.addEventListener('click', clearLoop);
      audioEl.addEventListener('timeupdate', ()=>{ if(loopStartIdx!=null && loopEndIdx!=null && audioEl.duration){ const st=(loopStartIdx/bars.length)*audioEl.duration; const et=(loopEndIdx/bars.length)*audioEl.duration; if(audioEl.currentTime> et + 0.05){ audioEl.currentTime=st; } }});
    }
  }

  // Editing workflow
  document.addEventListener('click', e => {
    if(role!=='expert') return;
    const editBtn = e.target.closest('[data-action="edit-report"]');
    if(editBtn){
      const row = editBtn.closest('.manage-row');
      if(row && !row.classList.contains('editing')){
        row.classList.add('editing');
        const clipId = row.getAttribute('data-clip');
        const reportId = row.getAttribute('data-report');
        // load report
        const list = readUserReports(clipId);
        const r = list.find(x=>x.id===reportId); if(!r) return;
        const main = row.querySelector('.mr-main');
        main.innerHTML = `<form class="edit-form" data-report="${r.id}">
          <div class="ef-row">
            <input name="at" value="${escapeHtml(r.at||'')}" placeholder="mm:ss" maxlength="8" />
            <select name="type">
              <option value="whale" ${r.type==='whale'?'selected':''}>Whale</option>
              <option value="vessel" ${r.type==='vessel'?'selected':''}>Vessel</option>
              <option value="other" ${r.type==='other'?'selected':''}>Other</option>
            </select>
          </div>
          <textarea name="text" rows="2" maxlength="240">${escapeHtml(r.text||'')}</textarea>
          <div class="ef-actions"><button class="mini-btn" data-action="save-edit">Save</button> <button class="mini-btn" data-action="cancel-edit">Cancel</button></div>
        </form>`;
      }
    }
    const saveBtn = e.target.closest('[data-action="save-edit"]');
    if(saveBtn){
      e.preventDefault();
      const form = saveBtn.closest('form.edit-form');
      if(form){
        const reportId = form.getAttribute('data-report');
        const row = form.closest('.manage-row');
        const clipId = row.getAttribute('data-clip');
        const list = readUserReports(clipId);
        const r = list.find(x=>x.id===reportId); if(!r) return;
        const newAt = form.at.value.trim();
        if(newAt && !/^\d{1,2}:[0-5]\d$/.test(newAt)){ alert('Time must be mm:ss'); return; }
        r.at = newAt; r.type = form.type.value; r.text = form.text.value.trim();
        saveUserReports(clipId, list);
        window.ActivityLog && ActivityLog.logActivity('report_edit', {clip:clipId});
        renderManageReportsFromCache(); renderCandidateReportsFromCache();
      }
    }
    const cancelBtn = e.target.closest('[data-action="cancel-edit"]');
    if(cancelBtn){ e.preventDefault(); renderManageReportsFromCache(); }
    const delBtn = e.target.closest('[data-action="delete-report"]');
    if(delBtn){
      const row = delBtn.closest('.manage-row'); if(!row) return;
      if(!confirm('Delete this report?')) return;
      const clipId = row.getAttribute('data-clip');
      const reportId = row.getAttribute('data-report');
      let list = readUserReports(clipId);
      list = list.filter(r=>r.id!==reportId);
      saveUserReports(clipId, list);
      // Also remove from candidates if present
      const s=candidateStore(); if(s[reportId]){ delete s[reportId]; saveCandidateStore(s); }
      window.ActivityLog && ActivityLog.logActivity('report_delete', {clip:clipId});
      renderManageReportsFromCache(); renderCandidateReportsFromCache();
    }
    const candBtn = e.target.closest('[data-action="candidate-report"]');
    if(candBtn){
      const row = candBtn.closest('.manage-row, .candidate-row'); if(!row) return;
      const reportId = row.getAttribute('data-report');
      const clipId = row.getAttribute('data-clip');
      // Need report data if adding
      if(!isCandidate(reportId)){
        // If coming from candidate list we already have store, else fetch from clip
        let reportData = null;
        const list = readUserReports(clipId);
        reportData = list.find(r=>r.id===reportId);
        if(!reportData && candidateStore()[reportId]){ reportData = candidateStore()[reportId]; reportData.id=reportId; reportData.clipId=clipId; }
        if(reportData){ reportData.clipId = clipId; toggleCandidate(reportData); }
      } else {
        toggleCandidate({ id:reportId, clipId });
      }
      window.ActivityLog && ActivityLog.logActivity('report_candidate_toggle', {clip:clipId, state:isCandidate(reportId)});
      renderManageReportsFromCache(); renderCandidateReportsFromCache();
    }
  });

  document.addEventListener('click', e => {
    const approveBtn = e.target.closest('.approve-btn');
    if(approveBtn && role==='expert'){
      const row = approveBtn.closest('.approval-row');
      if(row){
        const id = row.getAttribute('data-id');
        setApproved(id);
        row.querySelector('.approve-btn').disabled = true; row.querySelector('.approve-btn').textContent = 'Approved';
        window.ActivityLog && ActivityLog.logActivity('approve', {clip:id});
        renderActivity();
      }
    }
    const confirmBtn = e.target.closest('[data-action="confirm-report"]');
    if(confirmBtn && role==='expert'){
      const clip = confirmBtn.getAttribute('data-clip');
      const commentId = confirmBtn.getAttribute('data-comment');
      const li = confirmBtn.closest('.report-row-item');
      const cat = li.querySelector('select.rep-cat')?.value || 'Unspecified';
      const conf = parseInt(li.querySelector('select.rep-conf')?.value||'3',10);
      setConfirmation(commentId, {clipId:clip, category:cat, confidence:conf, ts:new Date().toISOString(), confirmerRole:role});
      window.ActivityLog && ActivityLog.logActivity('report_confirm', {clip, commentId, category:cat, confidence:conf});
      renderUserReportsFromCache();
    }
    const batchBtn = e.target.closest('[data-action="batch-confirm"]');
    if(batchBtn && role==='expert'){
      const container = userReportsEl;
      const rows = Array.from(container.querySelectorAll('li.report-row-item'));
      const selected = rows.filter(r=>r.querySelector('.batch-select:checked'));
      if(!selected.length){ alert('No reports selected.'); return; }
      const cat = prompt('Category for batch (Whale/Vessel/Other)', 'Whale') || 'Whale';
      const conf = parseInt(prompt('Confidence 1-5','4')||'4',10);
      selected.forEach(li=>{
        const commentId = li.getAttribute('data-comment');
        const clip = li.querySelector('a')?.getAttribute('href')?.split('#')[1];
        setConfirmation(commentId, {clipId:clip, category:cat, confidence:conf, ts:new Date().toISOString(), confirmerRole:role});
      });
      window.ActivityLog && ActivityLog.logActivity('report_confirm_batch', {count:selected.length, category:cat, confidence:conf});
      renderUserReportsFromCache();
    }
  });

  // Avoid re-fetch race by caching audios after load for re-render
  let __audiosCache = null;
  function renderUserReportsFromCache(){ if(__audiosCache) renderUserReports(__audiosCache); }
  function renderFavoritesFromCache(){ if(__audiosCache) renderFavorites(__audiosCache); }

  // Build audio map on fetch (if not already done in previous version)
  function buildAudioMap(audios){ window.__audioMap = audios.reduce((acc,a)=>{ acc[a.id]=a; return acc; },{}); }

  // Re-render favorites (and user reports) when user changes to reflect user-specific bookmarks
  window.addEventListener('userchange', ()=>{ renderFavoritesFromCache(); renderUserReportsFromCache(); });
  window.addEventListener('userchange', ()=>{ renderScoreboard(__audiosCache||[]); renderActivity(); });
  window.addEventListener('userchange', updateDashboardTitle);

  function updateDashboardTitle(){
    const h2 = document.querySelector('main h2');
    const userName = localStorage.getItem('demoUserName');
    const userRole = localStorage.getItem('demoUserRole');
    if(!userName || !userRole){
      if(h2) h2.textContent = 'Dashboard';
      document.title = 'Dashboard — Please Sign In';
      ensureFallbackPanel();
      return;
    }
    removeFallbackPanel();
    if(userRole === 'public'){
      if(h2) h2.textContent = `${userName}'s Dashboard`;
      document.title = `${userName} — Public Dashboard`;
    } else if(userRole === 'expert') {
      if(h2) h2.textContent = `${userName}'s Expert Dashboard`;
      document.title = `${userName} — Expert Dashboard`;
    } else {
      if(h2) h2.textContent = `${userName}'s Dashboard`;
      document.title = `${userName} — Dashboard`;
    }
  }

  function ensureFallbackPanel(){
    if(document.getElementById('noUserPanel')) return;
    const main = document.querySelector('main'); if(!main) return;
    const div = document.createElement('div');
    div.id='noUserPanel';
    div.className='dash-panel';
    div.innerHTML = `<h3>No user signed in</h3><div class="panel-body"><p>Please sign in to view personalized dashboard data.</p><button class="sign-btn" id="fallbackSignInBtn">Sign In</button></div>`;
    main.insertBefore(div, main.firstChild.nextSibling);
    div.querySelector('#fallbackSignInBtn')?.addEventListener('click', ()=>{
      // trigger existing sign-in button if present
      const btn = document.getElementById('signInBtn'); btn && btn.click();
    });
  }
  function removeFallbackPanel(){
    const p = document.getElementById('noUserPanel'); if(p) p.remove();
  }

  // Initial activity render (after small timeout to ensure activity.js loaded)
  setTimeout(renderActivity, 0);

  function escapeHtml(s){return String(s).replace(/[&<>\"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"})[c]||c)}
})();
