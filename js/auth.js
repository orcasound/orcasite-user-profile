// Simple prototype auth role switcher (Public vs Expert)
(function(){
  const LS_ROLE_KEY = 'demoUserRole';
  const LS_USER_ID = 'demoUserId';
  const LS_USER_NAME = 'demoUserName';
  const LS_CUSTOM_USERS = 'demoCustomUsers';
  // Sample users: 4 public, 2 expert
  const SAMPLE_USERS = [
    { id:'pub_alex', name:'Alex Rivers', role:'public' },
    { id:'pub_sam', name:'Sam Harper', role:'public' },
    { id:'pub_lina', name:'Lina Chen', role:'public' },
    { id:'pub_maya', name:'Maya Ortiz', role:'public' },
    { id:'exp_drmarin', name:'Dr. Marin', role:'expert' },
    { id:'exp_kpatel', name:'K. Patel', role:'expert' }
  ];
  function readCustomUsers(){ try { return JSON.parse(localStorage.getItem(LS_CUSTOM_USERS)||'[]'); } catch(e){ return []; } }
  function saveCustomUsers(list){ localStorage.setItem(LS_CUSTOM_USERS, JSON.stringify(list)); }
  function allUsers(){ return SAMPLE_USERS.concat(readCustomUsers()); }
  const authControls = document.getElementById('authControls');
  const modal = document.getElementById('authModal');
  if(!authControls) return; // page missing nav placeholder

  function getRole(){ return localStorage.getItem(LS_ROLE_KEY); }
  function setRole(r){ if(r) localStorage.setItem(LS_ROLE_KEY, r); else localStorage.removeItem(LS_ROLE_KEY); }
  function setUser(u){
    if(!u){ localStorage.removeItem(LS_USER_ID); localStorage.removeItem(LS_USER_NAME); setRole(null); return; }
    localStorage.setItem(LS_USER_ID, u.id);
    localStorage.setItem(LS_USER_NAME, u.name);
    setRole(u.role);
    // Emit user change event so other modules (e.g., bookmarks) can refresh UI
    window.dispatchEvent(new CustomEvent('userchange', { detail: { id:u.id, name:u.name, role:u.role } }));
  }
  function currentUser(){
    const id = localStorage.getItem(LS_USER_ID); if(!id) return null;
    const name = localStorage.getItem(LS_USER_NAME);
    const role = getRole();
    return { id, name, role };
  }

  function updateNav(){
    const user = currentUser();
    if(!user){
      authControls.innerHTML = '<button id="signInBtn" class="sign-btn">Sign In</button>';
    } else {
      const label = user.role === 'expert' ? 'Expert Dashboard' : user.name;
      const dash = user.role === 'expert' ? 'expert-dashboard.html' : 'public-dashboard.html';
      authControls.innerHTML = `<span class="user-pill" title="${user.id}">${user.name} (${user.role})</span> <a href="${dash}" class="dash-link">${label}</a> <button id="switchUserBtn" class="sign-btn">Switch</button> <button id="signOutBtn" class="sign-btn sign-out">Sign Out</button>`;
    }
  }

  let lastFocused = null;
  function openModal(){
    if(!modal) return;
    lastFocused = document.activeElement;
    modal.classList.remove('hidden');
    // If user list not injected yet, add it
    buildUserLists();
    const firstBtn = modal.querySelector('.sample-user-btn, .custom-user-btn') || modal.querySelector('.role-btn');
    firstBtn && firstBtn.focus();
  }
  function buildUserLists(){
    if(!modal) return;
    let container = modal.querySelector('.sample-users');
    if(!container){
      container = document.createElement('div');
      container.className='sample-users';
      const box = modal.querySelector('.auth-modal-content');
      box && box.insertBefore(container, box.firstChild);
    }
    const samplesHtml = SAMPLE_USERS.map(u=>`<button class="sample-user-btn" data-user="${u.id}">${u.name} <span class="su-role">${u.role}</span></button>`).join('');
    const custom = readCustomUsers();
    const customHtml = custom.map(u=>`<div class="custom-user-chip"><button class="custom-user-btn" data-user="${u.id}">${u.name} <span class="su-role">${u.role}</span></button><button class="del-user-btn" data-del-user="${u.id}" title="Delete">✕</button></div>`).join('');
    container.innerHTML = `
      <div class="su-head">Sample Users</div>
      <div class="su-list">${samplesHtml}</div>
      <hr class="su-sep" />
      <div class="su-head">Custom Users</div>
      <div class="su-list custom-list">${customHtml || '<div class="empty-users">None</div>'}</div>
      <form class="add-user-form" autocomplete="off">
        <input type="text" name="name" placeholder="Name" maxlength="40" required />
        <select name="role">
          <option value="public">public</option>
          <option value="expert">expert</option>
        </select>
        <button type="submit">Add</button>
      </form>
    `;
  }
  function closeModal(){
    if(!modal) return;
    modal.classList.add('hidden');
    if(lastFocused && typeof lastFocused.focus === 'function'){
      lastFocused.focus();
    }
  }

  function trapFocus(e){
    if(!modal || modal.classList.contains('hidden')) return;
    if(e.key === 'Tab'){
      const focusables = Array.from(modal.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')).filter(el=>!el.disabled && el.offsetParent!==null);
      if(!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length-1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    } else if(e.key === 'Escape'){
      closeModal();
    }
  }
  document.addEventListener('keydown', trapFocus);

  document.addEventListener('click', e => {
  if(e.target.id === 'signInBtn' || e.target.id === 'switchUserBtn'){ openModal(); }
  if(e.target.id === 'signOutBtn'){ setUser(null); updateNav(); window.dispatchEvent(new CustomEvent('userchange', { detail: { id:null } })); window.location.href='index.html'; }
    const roleBtn = e.target.closest('.role-btn');
    if(roleBtn){
      const role = roleBtn.getAttribute('data-role');
      // Use anonymous template (no name) for ad-hoc sign in
      setUser({ id: 'anon_'+role, name: 'Anonymous', role });
      updateNav();
      closeModal();
      const dash = role === 'expert' ? 'expert-dashboard.html' : 'public-dashboard.html';
      window.location.href = dash;
    }
    const sampleBtn = e.target.closest('.sample-user-btn');
    if(sampleBtn){
      const id = sampleBtn.getAttribute('data-user');
      const user = SAMPLE_USERS.find(u=>u.id===id);
      if(user){
        setUser(user);
        updateNav();
        closeModal();
        const dash = user.role === 'expert' ? 'expert-dashboard.html' : 'public-dashboard.html';
        window.location.href = dash;
      }
    }
    if(e.target.matches('[data-close]')){ closeModal(); }
    if(e.target === modal){ closeModal(); }
    const customBtn = e.target.closest('.custom-user-btn');
    if(customBtn){
      const id = customBtn.getAttribute('data-user');
      const user = allUsers().find(u=>u.id===id);
  if(user){ setUser(user); updateNav(); closeModal(); const dash = user.role==='expert'?'expert-dashboard.html':'public-dashboard.html'; window.location.href=dash; }
    }
    const delBtn = e.target.closest('.del-user-btn');
    if(delBtn){
      const id = delBtn.getAttribute('data-del-user');
      let list = readCustomUsers().filter(u=>u.id!==id);
      saveCustomUsers(list);
      buildUserLists();
    }
  });

  // Form submission for add user
  document.addEventListener('submit', e => {
    if(e.target.matches('.add-user-form')){
      e.preventDefault();
      const form = e.target;
      const name = form.name.value.trim();
      const role = form.role.value;
      if(!name) return;
      const id = 'cust_'+name.toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,24)+'_'+Math.random().toString(36).slice(2,6);
      const list = readCustomUsers();
      list.push({ id, name, role });
      saveCustomUsers(list);
      form.reset();
      buildUserLists();
    }
  });

  updateNav();
})();
