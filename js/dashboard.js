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
  updateDashboardTitle();
  renderFavorites(audios);
  renderComments(audios);
  renderUserReports(audios);
  if(role==='expert') {
    renderManageReports(audios);
    renderCandidateReports(audios);
    renderAggregateMetrics(audios);
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
  function setConfirmation(commentId, data){ const store=confirmStore(); store[commentId]=data; saveConfirmStore(store); }
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
    audios.forEach(a=>{ 
      const cs = readComments(a.id).filter(c=> !currentUserId || c.userId===currentUserId);
      if(cs.length){ totalComments += cs.length; a.tags && a.tags.forEach(t=>tagSet.add(t)); }
      const reps = readUserReports(a.id).filter(r=> !currentUserId || r.userId===currentUserId || (!r.userId && r.user && SAMPLE_NAME_TO_ID[r.user]===currentUserId));
      if(reps.length){ totalReports += reps.length; a.tags && a.tags.forEach(t=>tagSet.add(t)); }
    });
    const mReportsEl = document.getElementById('mReports')?.querySelector('.num');
    if(mReportsEl) mReportsEl.textContent = totalReports;
    // viewed clips (per-user key)
    let viewed = [];
    try { viewed = JSON.parse(localStorage.getItem('viewedClips:'+(currentUserId||'anon'))||'[]'); } catch(e){ viewed=[]; }
    // Unique tags across commented clips already in tagSet
    mComments.textContent = totalComments;
    mChecked.textContent = viewed.length;
    mTags.textContent = tagSet.size;
    // Score formula updated: comments + reports + viewed + tags
    const score = totalComments + totalReports + viewed.length + tagSet.size;
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

  function renderCandidateReports(audios){
    if(role!=='expert' || !candidateListEl) return;
    const cStore = candidateStore();
    const list = Object.keys(cStore).map(id=>({ id, ...cStore[id] }));
    if(!list.length){ candidateListEl.innerHTML='<div class="empty">No candidate reports.</div>'; return; }
    // Group by type
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

  function renderManageReportsFromCache(){ if(__audiosCache) renderManageReports(__audiosCache); }
  function renderCandidateReportsFromCache(){ if(__audiosCache) renderCandidateReports(__audiosCache); }

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
