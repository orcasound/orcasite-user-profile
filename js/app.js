// Minimal app logic for prototype: load sample audio list, render UI, filtering, playback, comments (localStorage)
document.addEventListener('DOMContentLoaded', async () => {
  const audioListEl = document.getElementById('audioList');
  const searchInput = document.getElementById('search');
  const tagFilter = document.getElementById('tagFilter');
  const detailPanel = document.getElementById('detailPanel');
  const centerPanel = document.getElementById('centerPanel');
  const playerView = document.getElementById('playerView');
  const mapView = document.getElementById('mapView');

  // Embedded fallback sample list so the prototype works from file:// without a server
  const FALLBACK = {
    audios: [
  {id:'a1',title:'Sunset Bay - Dawn clicks',location:'Beach Camp at Sunset Bay',site:'sunset_bay',recordedAt:'2025-09-14T11:05:00Z',tags:['whales','ai_whales'],url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'},
  {id:'a2',title:'Lab stream - distant vessel',location:'Orcasound Lab',site:'orcasound_lab',recordedAt:'2025-09-14T12:22:10Z',tags:['vessel'],url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'},
  {id:'a3',title:'Port Townsend - possible pod',location:'Port Townsend',site:'port_townsend',recordedAt:'2025-09-13T19:44:33Z',tags:['whales'],url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'},
  {id:'a4',title:'Bush Point - background noise',location:'Bush Point',site:'bush_point',recordedAt:'2025-09-12T03:15:45Z',tags:['other'],url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'},
  {id:'a5',title:'Sunset Bay - faint whistles',location:'Beach Camp at Sunset Bay',site:'sunset_bay',recordedAt:'2025-09-14T11:32:05Z',tags:['whales'],url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3'},
  {id:'a6',title:'Lab stream - surface splash',location:'Orcasound Lab',site:'orcasound_lab',recordedAt:'2025-09-14T12:40:12Z',tags:['other'],url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3'},
  {id:'a7',title:'Port Townsend - rapid clicks',location:'Port Townsend',site:'port_townsend',recordedAt:'2025-09-13T20:02:11Z',tags:['whales','ai_whales'],url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3'},
  {id:'a8',title:'Bush Point - passing vessel',location:'Bush Point',site:'bush_point',recordedAt:'2025-09-12T04:05:03Z',tags:['vessel'],url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3'},
  {id:'a9',title:'Sunset Bay - quiet background',location:'Beach Camp at Sunset Bay',site:'sunset_bay',recordedAt:'2025-09-14T11:50:44Z',tags:['other'],url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3'},
  {id:'a10',title:'Lab stream - mechanical hum',location:'Orcasound Lab',site:'orcasound_lab',recordedAt:'2025-09-14T12:55:27Z',tags:['vessel'],url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3'},
  {id:'a11',title:'Port Townsend - distant calls',location:'Port Townsend',site:'port_townsend',recordedAt:'2025-09-13T20:22:33Z',tags:['whales'],url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3'},
  {id:'a12',title:'Bush Point - rain on surface',location:'Bush Point',site:'bush_point',recordedAt:'2025-09-12T05:12:19Z',tags:['other'],url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3'},
  {id:'a13',title:'Sunset Bay - pod chatter',location:'Beach Camp at Sunset Bay',site:'sunset_bay',recordedAt:'2025-09-14T12:04:02Z',tags:['whales','ai_whales'],url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3'},
  {id:'a14',title:'Lab stream - equipment ping',location:'Orcasound Lab',site:'orcasound_lab',recordedAt:'2025-09-14T13:05:45Z',tags:['other'],url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3'},
  {id:'a15',title:'Port Townsend - strong call sequence',location:'Port Townsend',site:'port_townsend',recordedAt:'2025-09-13T21:05:55Z',tags:['whales'],url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3'},
  {id:'a16',title:'Bush Point - low vessel rumble',location:'Bush Point',site:'bush_point',recordedAt:'2025-09-12T06:25:14Z',tags:['vessel'],url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3'},
  {id:'a17',title:'Sunset Bay - quiet interval',location:'Beach Camp at Sunset Bay',site:'sunset_bay',recordedAt:'2025-09-14T12:20:21Z',tags:['other'],url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-17.mp3'},
  {id:'a18',title:'Lab stream - rapid clicks (AI)',location:'Orcasound Lab',site:'orcasound_lab',recordedAt:'2025-09-14T13:18:37Z',tags:['whales','ai_whales'],url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-18.mp3'},
  {id:'a19',title:'Port Townsend - mixed pod calls',location:'Port Townsend',site:'port_townsend',recordedAt:'2025-09-13T21:30:48Z',tags:['whales'],url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'}
    ]
  };

  // Try fetching the sample JSON (works when served over HTTP). If it fails (file:// or network), use the embedded FALLBACK.
  let audios = [];
  try{
    const res = await fetch('sample-audio.json');
    if(res.ok){
      const data = await res.json();
      audios = data.audios || FALLBACK.audios;
    } else {
      audios = FALLBACK.audios;
    }
  }catch(e){
    audios = FALLBACK.audios;
  }

  // --- Deterministic pseudo-random timestamp shifting ---
  // Goal: Make clips feel recent (within last 72h) while still deterministic per day+id so page reloads are stable.
  // We preserve the original in originalRecordedAt. The displayed recordedAt is adjusted.
  (function applyDeterministicRecentTimestamps(){
    const MAX_HOURS = 72; // window size
    const now = Date.now();
    // Use current date (UTC) as seed component so each day offsets reshuffle
    const daySeed = new Date().toISOString().slice(0,10); // YYYY-MM-DD
    function hash(str){
      let h = 0; for(let i=0;i<str.length;i++){ h = (h*31 + str.charCodeAt(i))>>>0; } return h;
    }
    audios.forEach(a=>{
      if(!a || !a.id) return;
      if(!a.originalRecordedAt) a.originalRecordedAt = a.recordedAt; // keep original
      const h = hash(a.id + '|' + daySeed);
      const hoursAgo = (h % MAX_HOURS) + Math.random()*0.25; // add tiny non-deterministic jitter < 15m to avoid identical minutes, acceptable for prototype
      const shifted = new Date(now - hoursAgo*3600*1000).toISOString();
      a.recordedAt = shifted;
    });
    // Sort audios by newest first after shifting
    audios.sort((a,b)=> new Date(b.recordedAt) - new Date(a.recordedAt));
  })();

  function formatDate(iso){
    if(!iso) return '';
    try {
      const d = new Date(iso);
      if(isNaN(d.getTime())) return '';
      // Format as YYYY-MM-DD HH:MM local time
      const pad = n=>String(n).padStart(2,'0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch(e){return ''}
  }

  function render(list){
    if(!audioListEl) return;
    audioListEl.innerHTML = '';
    // Group by site if present
    let currentSite = null;
    list.forEach(a=>{
      if(a.site && a.site !== currentSite){
        currentSite = a.site;
        const header = document.createElement('div');
        header.className = 'site-group-header';
        header.textContent = friendlySiteName(a.site);
        audioListEl.appendChild(header);
      }
      const item = document.createElement('div');
      item.className = 'audio-item';
      const title = `${a.location || 'Unknown location'}${a.recordedAt ? ' — '+formatDate(a.recordedAt) : ''}`;
      const vote = getVote(a.id);
      const score = vote.score;
      const bookmark = isBookmarked(a.id);
      item.setAttribute('data-id', a.id);
      item.innerHTML = `
        <div class="top-row">
          <div class="meta">
            <div class="clip-title">${escapeHtml(title)}</div>
            <div class="tag-row">${a.tags.map(t=>`<span class=\"tag\">${escapeHtml(t)}</span>`).join('')}</div>
            <div class="comments" data-id="${a.id}"></div>
          </div>
          <div class="controls">
            <button data-id="${a.id}" data-url="${a.url}" class="play-btn" aria-label="Play clip">▶</button>
            <button data-id="${a.id}" class="add-comment" aria-label="Add comment">💬</button>
          </div>
        </div>
        <div class="actions" data-id="${a.id}">
          <button class="vote up ${vote.value===1?'active':''}" data-action="vote-up" aria-label="Upvote" title="Upvote">▲</button>
          <span class="score" aria-label="Score">${score}</span>
          <button class="vote down ${vote.value===-1?'active':''}" data-action="vote-down" aria-label="Downvote" title="Downvote">▼</button>
          <button class="share" data-action="share" aria-label="Share" title="Share link">🔗</button>
          <button class="bookmark ${bookmark?'active':''} ${!localStorage.getItem('demoUserId')?'disabled':''}" data-action="bookmark" aria-label="Bookmark" title="Bookmark" ${!localStorage.getItem('demoUserId')?'tabindex="-1" aria-disabled="true"':''}>★</button>
        </div>
      `;
      audioListEl.appendChild(item);
      renderComments(a.id);
    });
  }

  function escapeHtml(s){return String(s).replace(/[&<>\"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"})[c]||c)}

  function getCommentsKey(id){return 'comments:'+id}
  function readComments(id){
    try {
      const raw = JSON.parse(localStorage.getItem(getCommentsKey(id))||'[]');
      let changed = false;
      const upgraded = raw.map((c,idx) => {
        // Legacy string comment -> upgrade with generated id + unknown user attribution
        if(typeof c === 'string') {
          changed = true;
          return { id: genCommentId(id, idx), text:c, ts:null, userId:'unknown', userName:'Unknown', role:'unknown' };
        }
        // Legacy object missing id
        if(!c.id){
          changed = true;
          return { id: genCommentId(id, idx), text:c.text, ts:c.ts||null, userId: c.userId||'unknown', userName: c.userName||'Unknown', role: c.role||'unknown' };
        }
        // Add default user attribution if missing (new requirement: attribute legacy comments to "unknown")
        if(!c.userId || !c.userName){
          changed = true;
          return { ...c, userId: c.userId||'unknown', userName: c.userName||'Unknown', role: c.role||'unknown' };
        }
        return c; // already upgraded
      });
      if(changed) { localStorage.setItem(getCommentsKey(id), JSON.stringify(upgraded)); }
      return upgraded;
    } catch(e){ return []; }
  }
  function saveComments(id,arr){ localStorage.setItem(getCommentsKey(id), JSON.stringify(arr)); }
  function genCommentId(clipId, seed){ return clipId+':c:'+seed+':'+Math.random().toString(36).slice(2,8); }

  function renderComments(id){
    const container = document.querySelector(`.comments[data-id="${id}"]`);
    if(!container) return;
    const comments = readComments(id);
    container.innerHTML = '';
    comments.forEach(c => {
      const el = document.createElement('div'); el.className='comment';
      const time = c.ts ? `<span class=\"c-ts\">${formatDate(c.ts)}</span> ` : '';
      el.innerHTML = time + escapeHtml(c.text||'');
      container.appendChild(el);
    });
  }

  let currentAudio = null;

  document.addEventListener('click', e => {
    const itemCard = e.target.closest('.audio-item');
    if(itemCard && !e.target.closest('.actions') && !e.target.closest('button')){
      const id = itemCard.getAttribute('data-id');
      showDetail(id);
    }
    const play = e.target.closest('.play-btn');
    if(play){
      const url = play.getAttribute('data-url');
      if(currentAudio){
        currentAudio.pause();
        if(currentAudio._btn) currentAudio._btn.textContent = '▶';
      }
      if(currentAudio && currentAudio._url === url && !currentAudio.paused){
        // toggled off
        return;
      }
      if(!play._audio){
        const aEl = new Audio(url);
        play._audio = aEl;
        aEl._btn = play;
        aEl._url = url;
        aEl.addEventListener('ended', ()=>{play.textContent='▶';});
      }
      currentAudio = play._audio;
      currentAudio.currentTime = 0;
      currentAudio.play();
      play.textContent = '⏸';
    }
    const btn = e.target.closest('.add-comment');
    if(btn){
      const id = btn.getAttribute('data-id');
      const text = prompt('Add a short comment about this clip (e.g. "Heard whales at 00:12")');
      if(text){
        const userId = localStorage.getItem('demoUserId')||'anon';
        const userName = localStorage.getItem('demoUserName')||'Anonymous';
        const role = localStorage.getItem('demoUserRole')||'public';
        const arr = readComments(id); arr.unshift({id:genCommentId(id, Date.now()), text, ts:new Date().toISOString(), userId, userName, role}); saveComments(id,arr); renderComments(id);
        window.ActivityLog && ActivityLog.logActivity('comment_add', {clip:id});
      }
    }

    const actionBar = e.target.closest('.actions button');
    if(actionBar){
      const action = actionBar.getAttribute('data-action');
      const container = actionBar.closest('.actions');
      const id = container.getAttribute('data-id');
      if(action === 'vote-up' || action === 'vote-down'){
        const dir = action === 'vote-up' ? 1 : -1;
        toggleVote(id, dir);
        refreshItem(id);
      } else if(action === 'bookmark'){
        if(!localStorage.getItem('demoUserId')) return; // ignore clicks when no user
        toggleBookmark(id); refreshItem(id); window.ActivityLog && ActivityLog.logActivity('bookmark_toggle', {clip:id, state:isBookmarked(id)});
      } else if(action === 'share'){
        shareItem(id);
      }
    }
  });

  function applyFilters(){
    const q = (searchInput && searchInput.value||'').toLowerCase().trim();
    const tag = (tagFilter && tagFilter.value)||'';
    const siteSel = (window.__siteFilterEl && window.__siteFilterEl.value)||'';
    const filtered = audios.filter(a=>{
      if(tag && !a.tags.includes(tag)) return false;
      if(siteSel && a.site !== siteSel) return false;
      if(!q) return true;
      const composite = `${a.location||''} ${a.recordedAt||''} ${a.title||''}`.toLowerCase();
      return composite.includes(q) || a.tags.join(' ').toLowerCase().includes(q);
    });
    render(filtered);
    updateSiteCounts(filtered);
    syncSiteListHighlight();
  }

  function friendlySiteName(site){
    const map = {
      sunset_bay: 'Sunset Bay',
      orcasound_lab: 'Orcasound Lab',
      port_townsend: 'Port Townsend',
      bush_point: 'Bush Point'
    };
    return map[site] || site || 'Site';
  }

  // ----- Detail Panel -----
  const REPORTS = {
    a1: [
      {user:'Orcasound Listener', ts:'2025-09-14T11:06:10Z', type:'whale', text:'Clicks increasing - probable pod'},
      {user:'Orcasound Listener', ts:'2025-09-14T11:08:55Z', type:'whale', text:'J pod vibes'}
    ],
    a2: [
      {user:'Orcasound Listener', ts:'2025-09-14T12:23:05Z', type:'ship', text:'Distant engine rumble'},
      {user:'Orcasound Listener', ts:'2025-09-14T12:24:40Z', type:'ship', text:'Volume increasing'}
    ],
    a3: [
      {user:'Orcasound Listener', ts:'2025-09-13T19:46:02Z', type:'whale', text:'Faint calls, maybe J pod'},
      {user:'Orcasound Listener', ts:'2025-09-13T19:50:22Z', type:'whale', text:'Stronger call sequence'}
    ],
    a4: [
      {user:'Orcasound Listener', ts:'2025-09-12T03:16:11Z', type:'ship', text:'Low hum only'}
    ]
  };

  function showDetail(id){
    if(!detailPanel) return;
    const clip = audios.find(a=>a.id===id);
    if(!clip){
      detailPanel.innerHTML = '<h3>Clip Details</h3><div class="empty">Clip not found.</div>';
      return;
    }
    // Track viewed clips for public user dashboard (unique set)
    try {
      const userId = localStorage.getItem('demoUserId') || 'anon';
      const globalKey = 'viewedClips';
      const perUserKey = 'viewedClips:'+userId;
      // migrate legacy global list to per-user if present and per-user empty
      const perUserExisting = JSON.parse(localStorage.getItem(perUserKey)||'[]');
      if(perUserExisting.length===0){
        const legacy = JSON.parse(localStorage.getItem(globalKey)||'[]');
        if(legacy.length){ localStorage.setItem(perUserKey, JSON.stringify(legacy)); }
      }
      const arr = JSON.parse(localStorage.getItem(perUserKey)||'[]');
      if(!arr.includes(id)){
        arr.push(id);
        localStorage.setItem(perUserKey, JSON.stringify(arr));
      }
    }catch(e){}
    const title = `${clip.location || 'Unknown location'}${clip.recordedAt ? ' — '+formatDate(clip.recordedAt) : ''}`;
    const vote = getVote(id);
    const bookmarked = isBookmarked(id);
    detailPanel.innerHTML = `
      <h3>Clip Details</h3>
      <div class="detail-header">
        <div class="detail-title">${escapeHtml(title)}</div>
        <div class="detail-meta">ID: ${escapeHtml(id)} &middot; Tags: ${clip.tags.map(t=>escapeHtml(t)).join(', ')}</div>
        <div class="detail-actions" data-id="${id}">
          <button class="vote up ${vote.value===1?'active':''}" data-action="vote-up" title="Upvote">▲</button>
          <span class="score">${vote.score}</span>
          <button class="vote down ${vote.value===-1?'active':''}" data-action="vote-down" title="Downvote">▼</button>
          <button class="bookmark inline ${bookmarked?'active':''}" data-action="bookmark" title="Bookmark">★</button>
          <button class="share inline" data-action="share" title="Share">🔗</button>
          <button class="clear-selection-btn inline" data-action="clear-selection" title="Clear selection">✖</button>
          <button class="spectro-btn" data-action="spectro">Generate Spectrogram View</button>
        </div>
        <div class="tabs">
          <button class="tab-btn active" data-tab="reports">Reports</button>
          <button class="tab-btn" data-tab="comments">Comments</button>
        </div>
        <div class="tab-content" id="tabContent"></div>
      </div>
    `;
    renderReports(id);
    showCenterPlayer(id);
  }

  function renderReports(id){
    const content = document.getElementById('tabContent'); if(!content) return;
    // --- User report storage helpers (defined inline to keep prototype minimal) ---
    function getUserReportsKey(clipId){ return 'userReports:'+clipId; }
    function readUserReports(clipId){
      try { return JSON.parse(localStorage.getItem(getUserReportsKey(clipId))||'[]'); } catch(e){ return []; }
    }
    function saveUserReports(clipId, arr){ localStorage.setItem(getUserReportsKey(clipId), JSON.stringify(arr)); }
    function genReportId(clipId){ return clipId+':r:'+Date.now()+':'+Math.random().toString(36).slice(2,8); }

    const seed = REPORTS[id] || [];
    const userReports = readUserReports(id);
    const hasAny = seed.length || userReports.length;
    if(!hasAny){
      content.innerHTML = '<div class="empty">No reports yet.</div>'+buildReportForm();
      attachReportForm();
      return;
    }
    const seedHtml = seed.length ? `<div class="report-section"><div class="section-label">Seed Reports</div><ul class="reports-list">${seed.map(renderRow).join('')}</ul></div>` : '';
    const userHtml = userReports.length ? `<div class="report-section"><div class="section-label">User Reports</div><ul class="reports-list">${userReports.map(renderRow).join('')}</ul></div>` : '';
    content.innerHTML = seedHtml + userHtml + buildReportForm();
    attachReportForm();

    function renderRow(r){
      const d = formatDate(r.ts);
      const typeClass = r.type==='whale'?'whale':(r.type==='vessel'?'ship':'ship'); // reuse ship color for vessel/other for now
      const label = r.type ? (r.type.charAt(0).toUpperCase()+r.type.slice(1)) : '';
      const at = r.at ? `<span class="r-at" title="Reported time within clip">[${escapeHtml(r.at)}]</span> `: '';
      return `<li class="report-row"><span class="r-user">${escapeHtml(r.user||'User')}</span><span class="r-time">${d}</span> <span class="r-type ${typeClass}">${label}</span><br>${at}${escapeHtml(r.text||'')}</li>`;
    }

    function buildReportForm(){
      return `
        <form class="report-form" data-id="${id}" autocomplete="off">
          <div class="rf-row">
            <input type="text" name="time" placeholder="Time (e.g. 01:23)" aria-label="Approximate time within clip" maxlength="8" />
            <select name="type" aria-label="Report type">
              <option value="whale">Whale</option>
              <option value="vessel">Vessel</option>
              <option value="other">Other</option>
            </select>
          </div>
          <textarea name="notes" rows="2" maxlength="240" placeholder="Notes (what did you hear?)" aria-label="Report notes"></textarea>
          <div class="rf-actions"><button type="submit">Add Report</button></div>
        </form>`;
    }

    function attachReportForm(){
      const form = content.querySelector('.report-form'); if(!form) return;
      form.addEventListener('submit', ev => {
        ev.preventDefault();
        const clipId = form.getAttribute('data-id');
        const timeVal = (form.time.value||'').trim();
        const typeVal = (form.type.value||'').trim().toLowerCase();
        const notesVal = (form.notes.value||'').trim();
        if(!notesVal){ form.notes.focus(); return; }
        // basic time validation allow mm:ss or m:ss (optional)
        if(timeVal && !/^\d{1,2}:[0-5]\d$/.test(timeVal)){
          alert('Time must be mm:ss (e.g. 01:23)');
          form.time.focus();
          return;
        }
        const arr = readUserReports(clipId);
        const userId = localStorage.getItem('demoUserId')||'anon';
        const userName = localStorage.getItem('demoUserName')||'Anonymous';
        const role = localStorage.getItem('demoUserRole')||'public';
        arr.push({ id: genReportId(clipId), user:userName, userId, role, ts:new Date().toISOString(), at:timeVal, type:typeVal, text:notesVal });
        saveUserReports(clipId, arr);
        window.ActivityLog && ActivityLog.logActivity('report_add', {clip:clipId, type:typeVal});
        renderReports(clipId); // re-render
      }, { once:true }); // reattached each render
    }
  }

  function renderDetailComments(id){
    const content = document.getElementById('tabContent'); if(!content) return;
    const arr = readComments(id);
    const currentUserId = localStorage.getItem('demoUserId');
    const own = currentUserId ? arr.filter(c=>c.userId===currentUserId) : arr;
    if(!own.length){
      content.innerHTML = '<div class="empty">No comments yet for this user.</div>'+commentFormHtml(id);
      return;
    }
    content.innerHTML = '<div class="comments-list">'+own.map(c=>`<div class="comment">${c.ts?`<span class=\"c-ts\">${formatDate(c.ts)}</span> `:''}${escapeHtml(c.text||'')}</div>`).join('')+'</div>'+commentFormHtml(id);
  }

  function commentFormHtml(id){
    return `<form class="comment-form" data-id="${id}"><input type="text" maxlength="180" placeholder="Add comment..." aria-label="Add comment" /><button type="submit">Post</button></form>`;
  }

  document.addEventListener('submit', e => {
    const form = e.target.closest('.comment-form');
    if(form){
      e.preventDefault();
      const id = form.getAttribute('data-id');
      const input = form.querySelector('input');
      const val = (input.value||'').trim();
      if(val){
        const userId = localStorage.getItem('demoUserId')||'anon';
        const userName = localStorage.getItem('demoUserName')||'Anonymous';
        const role = localStorage.getItem('demoUserRole')||'public';
        const arr = readComments(id);
        arr.unshift({id:genCommentId(id, Date.now()), text:val, ts:new Date().toISOString(), userId, userName, role});
        saveComments(id, arr);
        input.value='';
        window.ActivityLog && ActivityLog.logActivity('comment_add', {clip:id});
        const activeTab = form.closest('#detailPanel').querySelector('.tab-btn.active');
        if(activeTab && activeTab.getAttribute('data-tab')==='comments'){
          renderDetailComments(id);
        }
      }
    }
  });

  // Center player & spectrogram
  let spectroActiveFor = null;
  let selectedClipId = null;
  function showCenterPlayer(id){
    if(!playerView || !mapView) return;
    const clip = audios.find(a=>a.id===id); if(!clip) return;
    selectedClipId = id;
    mapView.classList.add('hidden');
    playerView.classList.remove('hidden');
    playerView.innerHTML = `
      <div class="player-box" data-id="${id}">
        <div class="player-title">Playing: ${escapeHtml(clip.location||'Location')} ${clip.recordedAt? '('+formatDate(clip.recordedAt)+')':''}</div>
        <div class="player-inner">${spectroActiveFor===id ? spectroMarkup() : audioMarkup(clip)}</div>
      </div>
    `;
  }
  function audioMarkup(clip){
    return `<audio controls src="${clip.url}"></audio>`;
  }
  function spectroMarkup(){
    return `<div class="spectro-placeholder">[ mock spectrogram ]</div><button class="back-to-audio" data-action="back-audio">Back to audio</button>`;
  }

  // Clear selection resets detail panel & center panel to initial state (map visible, player hidden)
  function clearSelection(){
    selectedClipId = null;
    spectroActiveFor = null;
    if(playerView){ playerView.classList.add('hidden'); playerView.innerHTML=''; }
    if(mapView){ mapView.classList.remove('hidden'); }
    if(detailPanel){
      // Rebuild original site list panel
      detailPanel.innerHTML = `
        <h3>Hydrophone Locations</h3>
        <ul class="locations-list" id="siteList">
          ${buildSiteListItems()}
        </ul>
        <div class="detail-placeholder small-note">Select a clip from the right list to view details here.</div>
      `;
      attachSiteListHandlers();
    }
    // Reset site filter if previously narrowed via site list click
    if(window.__siteFilterEl){ window.__siteFilterEl.value=''; }
    applyFilters();
  }

  document.addEventListener('click', e => {
    const back = e.target.closest('[data-action="back-audio"]');
    if(back){
      const id = playerView.querySelector('.player-box')?.getAttribute('data-id');
      spectroActiveFor = null; showCenterPlayer(id);
    }
    const spectroBtn = e.target.closest('#detailPanel [data-action="spectro"]');
    if(spectroBtn){
      const id = spectroBtn.closest('.detail-actions').getAttribute('data-id');
      if(spectroActiveFor===id){
        spectroActiveFor=null; showCenterPlayer(id);
      } else {
        spectroActiveFor=id; showCenterPlayer(id);
      }
    }
  });

  document.addEventListener('click', e => {
    // detail tabs/actions
    const tabBtn = e.target.closest('.tab-btn');
    if(tabBtn){
      const panel = tabBtn.closest('#detailPanel');
      if(panel){
        panel.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
        tabBtn.classList.add('active');
        const tab = tabBtn.getAttribute('data-tab');
        const id = panel.querySelector('.detail-actions')?.getAttribute('data-id');
        if(tab==='reports') renderReports(id); else if(tab==='comments') renderDetailComments(id);
      }
    }
    const spectro = e.target.closest('[data-action="spectro"]');
    if(spectro){
      alert('Spectrogram generation prototype not implemented yet.');
    }
    const detailAct = e.target.closest('#detailPanel .detail-actions button');
    if(detailAct){
      const action = detailAct.getAttribute('data-action');
      const id = detailAct.closest('.detail-actions').getAttribute('data-id');
      if(action==='vote-up' || action==='vote-down'){
        toggleVote(id, action==='vote-up'?1:-1); showDetail(id);
      } else if(action==='bookmark'){
        toggleBookmark(id); showDetail(id); window.ActivityLog && ActivityLog.logActivity('bookmark_toggle', {clip:id, state:isBookmarked(id)});
      } else if(action==='share'){
        shareItem(id);
      } else if(action==='clear-selection') {
        clearSelection();
      }
    }
  });

  // --- Voting & Bookmarking State ---
  function voteKey(id){ return 'vote:'+id; }
  function bookmarkKey(id){
    const uid = localStorage.getItem('demoUserId') || 'anon';
    return 'bookmark:'+uid+':'+id;
  }
  function getVote(id){
    try { const v = JSON.parse(localStorage.getItem(voteKey(id))||'{}'); return {value: v.value||0, score: v.score||0}; } catch(e){ return {value:0, score:0}; }
  }
  function saveVote(id, obj){ localStorage.setItem(voteKey(id), JSON.stringify(obj)); }
  function toggleVote(id, dir){
    const current = getVote(id);
    if(current.value === dir){
      // remove vote
      current.score -= dir; current.value = 0;
    } else {
      // switching vote: remove previous then add new
      if(current.value !== 0) current.score -= current.value;
      current.value = dir; current.score += dir;
    }
    saveVote(id, current);
    window.ActivityLog && ActivityLog.logActivity('vote', {clip:id, value:current.value, score:current.score});
  }
  function isBookmarked(id){
    // Migrate legacy global bookmark key if present (bookmark:clipId)
    const legacyKey = 'bookmark:'+id;
    if(localStorage.getItem(legacyKey) === '1' && !localStorage.getItem(bookmarkKey(id))){
      // Assign legacy favorite to Lisa (interpreting request: Lisa => pub_lina)
      const targetUser = 'pub_lina';
      const targetKey = 'bookmark:'+targetUser+':'+id;
      localStorage.setItem(targetKey,'1');
      localStorage.removeItem(legacyKey);
    }
    return localStorage.getItem(bookmarkKey(id)) === '1';
  }
  function toggleBookmark(id){
    const key = bookmarkKey(id);
    if(localStorage.getItem(key) === '1') localStorage.removeItem(key); else localStorage.setItem(key, '1');
  }
  function shareItem(id){
    const a = audios.find(x=>x.id===id); if(!a) return;
    const shareData = { title: 'Orca clip', text: `${a.location} ${a.recordedAt||''}`.trim(), url: a.url };
    if(navigator.share){ navigator.share(shareData).catch(()=>{}); }
    else {
      navigator.clipboard && navigator.clipboard.writeText(a.url).then(()=>{ alert('Link copied to clipboard'); });
    }
  }

  function refreshItem(id){
    const item = document.querySelector(`.audio-item .actions[data-id="${id}"]`); // actions container
    if(!item){ return; }
    const vote = getVote(id);
    const bookmarked = isBookmarked(id);
    const hasUser = !!localStorage.getItem('demoUserId');
    item.querySelector('.score').textContent = vote.score;
    item.querySelector('.vote.up').classList.toggle('active', vote.value===1);
    item.querySelector('.vote.down').classList.toggle('active', vote.value===-1);
    const bm = item.querySelector('.bookmark');
    bm.classList.toggle('active', bookmarked);
    bm.disabled = !hasUser;
    bm.classList.toggle('disabled', !hasUser);
  }

  if(searchInput) searchInput.addEventListener('input', applyFilters);
  if(tagFilter) tagFilter.addEventListener('change', applyFilters);

  // Inject site filter if container exists (right column filter-row) and not already added
  const filterRow = document.querySelector('.filter-row');
  if(filterRow && !document.getElementById('siteFilter')){
    const sel = document.createElement('select');
    sel.id = 'siteFilter';
    sel.innerHTML = '<option value="">-- Site --</option>' + Array.from(new Set(audios.map(a=>a.site).filter(Boolean))).map(s=>`<option value="${s}">${friendlySiteName(s)}</option>`).join('');
    filterRow.appendChild(sel);
    window.__siteFilterEl = sel;
    sel.addEventListener('change', ()=>{ applyFilters(); syncSiteListHighlight(); });
  }

  // --- Site list interactivity (left panel initial list) ---
  function buildSiteCounts(list){
    const counts = {};
    list.forEach(a=>{ if(a.site){ counts[a.site] = (counts[a.site]||0)+1; } });
    return counts;
  }
  function buildSiteListItems(){
    const counts = buildSiteCounts(audios);
    const order = ['sunset_bay','orcasound_lab','port_townsend','bush_point'];
    return order.map(site=>`<li data-site="${site}">${friendlySiteName(site)} <span class="count">(${counts[site]||0})</span></li>`).join('');
  }
  function updateSiteCounts(currentFiltered){
    const listEl = document.getElementById('siteList');
    if(!listEl) return;
    const counts = buildSiteCounts(currentFiltered.length ? currentFiltered : audios);
    Array.from(listEl.querySelectorAll('li')).forEach(li=>{
      const site = li.getAttribute('data-site');
      const c = counts[site] || 0;
      const name = friendlySiteName(site);
      li.innerHTML = `${name} <span class="count">(${c})</span>`;
    });
  }
  function attachSiteListHandlers(){
    const listEl = document.getElementById('siteList');
    if(!listEl) return;
    listEl.addEventListener('click', e=>{
      const li = e.target.closest('li[data-site]');
      if(!li) return;
      const site = li.getAttribute('data-site');
      // Toggle behavior: if already active -> clear site filter
      if(window.__siteFilterEl){
        if(window.__siteFilterEl.value === site){
          window.__siteFilterEl.value = '';
        } else {
          window.__siteFilterEl.value = site;
        }
        applyFilters();
        syncSiteListHighlight();
      }
    }, { once:false });
  }
  function syncSiteListHighlight(){
    const listEl = document.getElementById('siteList'); if(!listEl) return;
    const active = window.__siteFilterEl ? window.__siteFilterEl.value : '';
    Array.from(listEl.querySelectorAll('li')).forEach(li=>{
      li.classList.toggle('active', li.getAttribute('data-site')===active && active !== '');
    });
  }

  // If the initial panel is the locations list, augment it with counts & interaction
  (function initSiteList(){
    const listEl = document.getElementById('siteList');
    if(listEl){
      // Replace list items with versions including counts
      listEl.innerHTML = buildSiteListItems();
      attachSiteListHandlers();
      updateSiteCounts(audios);
      syncSiteListHighlight();
    }
  })();

  // initial render
  render(audios);
  updateSiteCounts(audios);
  syncSiteListHighlight();

  // Hash-based auto-select (e.g., hydrophones.html#a2)
  if(location.hash && detailPanel){
    const hid = location.hash.replace('#','');
    if(audios.some(a=>a.id===hid)){
      showDetail(hid);
    }
  }

  window.addEventListener('hashchange', ()=>{
    const hid = location.hash.replace('#','');
    if(audios.some(a=>a.id===hid)){
      showDetail(hid);
    }
  });

});
