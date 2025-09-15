// activity.js - shared activity logging utility
(function(){
  const KEY = 'activityLog';
  const MAX = 200; // keep last 200 entries

  function read(){
    try { return JSON.parse(localStorage.getItem(KEY)||'[]'); } catch(e){ return []; }
  }
  function write(arr){ localStorage.setItem(KEY, JSON.stringify(arr.slice(-MAX))); }

  function logActivity(type, details){
    const role = localStorage.getItem('demoUserRole') || 'anon';
    const userId = localStorage.getItem('demoUserId') || 'none';
    const userName = localStorage.getItem('demoUserName') || 'Anonymous';
    const entry = { ts: new Date().toISOString(), type, role, userId, userName, details };
    const arr = read();
    arr.push(entry);
    write(arr);
  }
  function getActivity(){ return read().slice().reverse(); } // newest first

  window.ActivityLog = { logActivity, getActivity };
})();
