//  FIREBASE CONFIG — Replace with your own config
// ══════════════════════════════════════════════════════
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD1TA78WcqWNDLkbhe6We9LM_AkmQs04EM",
  authDomain: "bridgegate-1a2c6.firebaseapp.com",
  databaseURL: "https://bridgegate-1a2c6-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "bridgegate-1a2c6",
  storageBucket: "bridgegate-1a2c6.firebasestorage.app",
  messagingSenderId: "544390125037",
  appId: "1:544390125037:web:b7f539c56d2aaea6f943e4",
  measurementId: "G-PS3K5YNR96"
};


// Generates a strong random password (avoids ambiguous chars like 0/O, 1/l/I)
function genStrongPassword(len){
  const chars='ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out='';
  const arr=new Uint32Array(len||10);
  (window.crypto||window.msCrypto).getRandomValues(arr);
  for(let i=0;i<arr.length;i++)out+=chars[arr[i]%chars.length];
  return out;
}
window.fillGeneratedPw=function(fieldId){
  const el=document.getElementById(fieldId);
  if(!el)return;
  el.type='text';
  el.value=genStrongPassword(10);
  setTimeout(()=>{ el.type='password'; },1500);
};

// ── Online-only enforcement ──
{
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '';
  if(isLocal){
    document.body.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f0e0c;font-family:sans-serif;"><div style="max-width:380px;text-align:center;padding:40px 24px;background:#1a1916;border:1px solid #c9a84c;border-radius:12px;"><div style="font-size:3rem;margin-bottom:12px;">&#x26D4;</div><div style="font-size:1.5rem;color:#c9a84c;margin-bottom:10px;">Online Only</div><div style="color:#9a958c;font-size:0.88rem;">BridgeGate requires an internet connection.<br>Please use the GitHub Pages URL.</div></div></div>';
    throw new Error('Local environment - app stopped');
  }
}

// ══════════════════════════════════════════════════════
//  CLUB RESOLUTION (multi-tenant)
// ══════════════════════════════════════════════════════
// Checks /clubs/{id}/info.json — returns the info object if the club exists, else null.
async function checkClubExists(id){
  try{
    const url = await fbRootUrl('/clubs/'+encodeURIComponent(id)+'/info.json');
    const r = await fetch(url,{cache:'no-store'});
    if(!r.ok) return null;
    const v = await r.json();
    return (v && v.name) ? cleanData(v) : null;
  }catch(e){ return null; }
}

// Locks in the active club: sets CLUB_ID/FBURL, persists it, and reflects it in the URL
// so the page stays a single shareable link (?club=CLUBID).
function setClub(id){
  CLUB_ID=id;
  FBURL=FB_BASE+'/clubs/'+id+'/bm';
  try{ localStorage.setItem('bg_clubId', id); }catch(e){}
  try{
    const u=new URL(location.href);
    u.searchParams.set('club', id);
    history.replaceState(null, '', u);
  }catch(e){}
}

function showLoginForm(clubName){
  CLUB_NAME=clubName||null;
  document.getElementById('clubGate').style.display='none';
  document.getElementById('loginForm').style.display='block';
  document.getElementById('loginSub').textContent=clubName||'Tournament Control System';
  const badge=document.getElementById('topbarClub');
  if(badge){
    if(clubName){ badge.textContent='🏛 '+clubName; badge.style.display='inline-flex'; }
    else badge.style.display='none';
  }
}

window.resolveClubFromInput=async function(){
  const err=document.getElementById('clubErr');err.textContent='';
  const id=(document.getElementById('clubIdInput').value||'').trim();
  if(!id){err.textContent='❌ Enter a Club ID';return;}
  const btn=document.getElementById('clubContinueBtn');
  if(btn){btn.disabled=true;btn.textContent='Checking...';}
  const info=await checkClubExists(id);
  if(btn){btn.disabled=false;btn.textContent='Continue';}
  if(!info){err.textContent='❌ Club not found';return;}
  setClub(id);
  showLoginForm(info.name);
};

// Resolves the club from ?club=CLUBID in the URL, falling back to the last used club
// stored in localStorage. Shows the club-entry gate if neither is valid.
async function initClubGate(){
  const params=new URLSearchParams(location.search);
  let id=params.get('club');
  const roleParam=params.get('role');
  if(!id){ try{ id=localStorage.getItem('bg_clubId'); }catch(e){} }
  if(id){
    const info=await checkClubExists(id);
    if(info){
      setClub(id); showLoginForm(info.name);
      if(roleParam&&['admin','table','screen'].includes(roleParam)){
        selRole(roleParam);
        setTimeout(()=>document.getElementById('pwInput')?.focus(),100);
      }
      return;
    }
    try{ localStorage.removeItem('bg_clubId'); }catch(e){}
  }
  document.getElementById('clubGate').style.display='block';
}
initClubGate();

// ══════════════════════════════════════════════════════
//  SESSIONS — the password is never read by the app
// ══════════════════════════════════════════════════════
// Logging in writes /sess/{this device's hidden account} = {role, club, pw}. The database rules accept it only when
// the password is right, and that session decides what this device may change (see database.rules.json).
// Passwords themselves cannot be read by anyone; changing a password ends the sessions made with the old one.
async function startSession(r, club, pw){
  const token=await authToken(); const uid=window._authUid;
  if(!token||!uid) throw new Error('No connection to the database');
  // a password typed in the Firebase console without quotes is kept there as a number: a password of digits
  // is also tried as a number
  const tries=[String(pw)]; if(/^[1-9]\d{0,14}$/.test(String(pw))) tries.push(Number(pw));
  for(const p of tries){
    const body=JSON.stringify(r==='superadmin'?{role:'super',pw:p}:{role:r,club:String(club),pw:p});
    const res=await fetch(FB_BASE+'/sess/'+uid+'.json?auth='+token,{method:'PUT',headers:{'Content-Type':'application/json'},body});
    if(res.ok) return true;
    if(res.status!==401) throw new Error('Firebase error '+res.status);
  }
  return false;   // wrong password (or the club is switched off)
}
async function endSession(){
  try{ const token=await authToken(); const uid=window._authUid; if(token&&uid) await fetch(FB_BASE+'/sess/'+uid+'.json?auth='+token,{method:'DELETE'}); }catch(e){}
}

// Change one of this club's passwords (admin or table); an admin stays logged in with the new one
async function savePassword(which, newPw){
  const url = await fbRootUrl('/clubs/'+CLUB_ID+'/passwords/'+which+'.json');
  const res = await fetch(url, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(String(newPw))});
  if(!res.ok) throw new Error('Firebase write failed: ' + res.status);
  if(which==='admin') await startSession('admin', CLUB_ID, newPw);
}

// ══════════════════════════════════════════════════════
//  SUPER ADMIN — club-independent, manages /clubs/*
// ══════════════════════════════════════════════════════
async function fbAuthToken(){ return authToken(); }

async function saveSuperPassword(pw){
  const token = await fbAuthToken();
  const url = FB_BASE+'/superadmin/password.json'+(token?'?auth='+token:'');
  const r = await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(pw)});
  if(!r.ok) throw new Error('Firebase write failed: '+r.status);
  await startSession('superadmin', null, pw);
}

// Lists all clubs: shallow key fetch, then one info fetch per club.
async function saListClubs(){
  const token = await fbAuthToken();
  const shallowUrl = FB_BASE+'/clubs.json?shallow=true'+(token?'&auth='+token:'');
  const r = await fetch(shallowUrl,{cache:'no-store'});
  if(!r.ok) return [];
  const keys = await r.json();
  if(!keys) return [];
  const ids = Object.keys(keys);
  const infos = await Promise.all(ids.map(async id=>{
    try{
      const url = FB_BASE+'/clubs/'+id+'/info.json'+(token?'?auth='+token:'');
      const rr = await fetch(url,{cache:'no-store'});
      const v = rr.ok ? await rr.json() : null;
      return {id, name:cleanData((v&&v.name)||id), created:(v&&v.created)||null, active:(v&&v.active!==false)};
    }catch(e){ return {id, name:id, created:null, active:true}; }
  }));
  return infos.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
}

async function saCreateClub(id, name, adminPw, tablePw){
  const existing = await checkClubExists(id);
  if(existing) throw new Error('Club ID already exists');
  const token = await fbAuthToken();
  const q = token?'?auth='+token:'';
  const infoRes = await fetch(FB_BASE+'/clubs/'+id+'/info.json'+q,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name, created:new Date().toISOString(), active:true})});
  if(!infoRes.ok) throw new Error('Firebase write failed: '+infoRes.status);
  if(!adminPw||!tablePw) throw new Error('Enter both passwords');
  const pass = {admin:String(adminPw), table:String(tablePw)};
  const passRes = await fetch(FB_BASE+'/clubs/'+id+'/passwords.json'+q,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(pass)});
  if(!passRes.ok) throw new Error('Firebase write failed: '+passRes.status);
}

async function saSetClubActive(id, active){
  const token = await fbAuthToken();
  const q = token?'?auth='+token:'';
  const r = await fetch(FB_BASE+'/clubs/'+id+'/info/active.json'+q,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(active)});
  if(!r.ok) throw new Error('Firebase write failed: '+r.status);
}

async function saResetClubPasswords(id, adminPw, tablePw){
  const token = await fbAuthToken();
  const q = token?'?auth='+token:'';
  if(!adminPw||!tablePw) throw new Error('Enter both passwords');
  const pass = {admin:String(adminPw), table:String(tablePw)};
  const r = await fetch(FB_BASE+'/clubs/'+id+'/passwords.json'+q,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(pass)});
  if(!r.ok) throw new Error('Firebase write failed: '+r.status);
}

async function saDeleteClub(id){
  const token = await fbAuthToken();
  const q = token?'?auth='+token:'';
  const r = await fetch(FB_BASE+'/clubs/'+id+'.json'+q,{method:'DELETE'});
  if(!r.ok) throw new Error('Firebase delete failed: '+r.status);
}

// ══════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════
let role='admin';

window.selRole=function(r){
  role=r;
  document.querySelectorAll('.role-tab').forEach(b=>b.classList.remove('active'));
  document.getElementById('rtab-'+r)?.classList.add('active');
  document.getElementById('loginErr').textContent='';
  document.getElementById('pwInput').value='';
  document.getElementById('pwWrap').style.display=(r==='admin'||r==='table'||r==='superadmin')?'block':'none';
};
selRole('admin');

// Entered from the club gate — Super Admin doesn't need a resolved club.
window.enterSuperAdminLogin=function(){
  document.getElementById('clubGate').style.display='none';
  document.getElementById('loginForm').style.display='block';
  document.getElementById('roleTabs').style.display='none';
  document.getElementById('backToClubGate').style.display='block';
  document.getElementById('loginSub').textContent='Super Admin';
  selRole('superadmin');
};
window.backToClubGate=function(){
  document.getElementById('loginForm').style.display='none';
  document.getElementById('roleTabs').style.display='flex';
  document.getElementById('backToClubGate').style.display='none';
  document.getElementById('loginSub').textContent=CLUB_NAME||'Tournament Control System';
  document.getElementById('clubGate').style.display='block';
  selRole('admin');
};

window.doLogin=async function(){
  const err=document.getElementById('loginErr');err.textContent='';
  const pw=document.getElementById('pwInput').value;
  const loginBtn=document.querySelector('.btn-primary');

  // Super Admin — club-independent
  if(role==='superadmin'){
    if(loginBtn){loginBtn.disabled=true;loginBtn.textContent='Checking...';}
    let ok=false;
    try{ ok = await startSession('superadmin', null, pw); }
    catch(e){ if(loginBtn){loginBtn.disabled=false;loginBtn.textContent='Login';} err.textContent='❌ '+e.message; return; }
    if(loginBtn){loginBtn.disabled=false;loginBtn.textContent='Login';}
    if(!ok){ err.textContent='❌ Wrong password'; return; }
    document.getElementById('loginScreen').style.display='none';
    document.getElementById('app').style.display='flex';
    document.getElementById('topbarRole').textContent='Super Admin';
    const clubBadge=document.getElementById('topbarClub'); if(clubBadge) clubBadge.style.display='none';
    document.getElementById('topbarRound').style.display='none';
    renderSuperAdminPanel();
    return;
  }

  // Admin/Table/Screen all require a resolved club
  if(!CLUB_ID){ err.textContent='❌ No club selected'; return; }

  // Screen role — no password needed
  if(role==='screen'){
    document.getElementById('loginScreen').style.display='none';
    document.getElementById('app').style.display='flex';
    document.getElementById('topbarRole').textContent='Screen';
    await preloadCache();
    refreshTopbar();renderPanel();
    DB.subscribe('state',(val)=>{_cache['state']=val;refreshTopbar();renderScreenPanel();});
    DB.subscribe('boards',(val)=>{_cache['boards']=val;renderScreenPanel();});
    DB.subscribe('pairs',(val)=>{_cache['pairs']=val;renderScreenPanel();});
    return;
  }

  // Check password
  if(loginBtn){loginBtn.disabled=true;loginBtn.textContent='Checking...';}
  let ok=false;
  try{ ok = await startSession(role, CLUB_ID, pw); }
  catch(e){ if(loginBtn){loginBtn.disabled=false;loginBtn.textContent='Login';} err.textContent='❌ '+e.message; return; }
  if(loginBtn){loginBtn.disabled=false;loginBtn.textContent='Login';}
  if(!ok){err.textContent='❌ Wrong password';return;}

  // Preload all data from Firebase
  if(loginBtn){loginBtn.disabled=true;loginBtn.textContent='Loading...';}
  await preloadCache();
  if(loginBtn){loginBtn.disabled=false;loginBtn.textContent='Login';}

  // Enter app
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('app').style.display='flex';
  document.getElementById('topbarRole').textContent=role==='admin'?'Admin':'Table';

  if(role==='admin'){
    const st=getState();
    if(st&&st.status==='running'){
      refreshTopbar();
      document.getElementById('panelContent').innerHTML=`
        <div style="max-width:420px;margin:40px auto;padding:0 14px;">
          <div class="card" style="text-align:center;border-color:var(--gold);">
            <div style="font-size:2rem;margin-bottom:10px;">⚠️</div>
            <div style="font-size:1rem;font-weight:700;color:var(--gold);margin-bottom:6px;">Saved tournament found</div>
            <div style="font-size:0.82rem;color:var(--text2);margin-bottom:18px;">${st.name}</div>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-green btn-full" onclick="sessionContinue()">&#x25b6; Continue</button>
              <button class="btn btn-red btn-full" onclick="sessionNew()">&#x2795; New Tournament</button>
            </div>
          </div>
        </div>`;
      DB.subscribe('state',()=>{refreshTopbar();});
      DB.subscribe('approvals',()=>{if(adminTab==='setup')renderAdminTab();});
      return;
    }
  }

  refreshTopbar();renderPanel();
  DB.subscribe('state',(val)=>{
    _cache['state']=val;
    refreshTopbar();
    if(role==='screen') renderScreenPanel();
    else if(role==='table' && bmTableNo) renderTableDetail(bmTableNo);
    else if(role==='admin') {
      if(adminTab==='setup') { const c=document.getElementById('adminContent'); if(c)c.innerHTML=renderSetup(); }
      checkRoundComplete();
    }
  });
  DB.subscribe('pairs',()=>{ if(role==='admin'&&(adminTab==='players'||adminTab==='tables'))renderAdminTab(); });
  DB.subscribe('boards',(val)=>{
    _cache['boards']=val;
    if(role==='admin') { if(adminTab==='setup'||adminTab==='tables'||adminTab==='boards')renderAdminTab(); checkRoundComplete(); }
    if(role==='screen') renderScreenPanel();
  });
  DB.subscribe('approvals',()=>{
    if(role==='admin'&&adminTab==='setup') renderAdminTab();
    if(role==='table'&&bmTableNo) bmPollApprovals(bmTableNo);
  });
  DB.subscribe('tableLocks',()=>{ _cache['tableLocks']=null; DB.get('tableLocks'); });
  DB.subscribe('playerdb',()=>{}); // keeps _cache fresh for autocomplete
};
window.sessionContinue=function(){renderAdminPanel();};
window.sessionNew=async function(){
  if(!await confirmDialog('This will delete the current tournament. Are you sure?',{title:'New Tournament'}))return;
  Promise.all(['state','pairs','boards','movements','logs','approvals'].map(k=>DB.del(k))).then(()=>renderAdminPanel());
};
window.doLogout=function(){
  if(role==='table'&&bmTableNo){
    const st=getState();
    if(st&&st.status==='finished'){
      showTableFinalResults(bmTableNo);
      return; // real logout happens from the "Log Out" button on that screen
    }
  }
  performLogout();
};
window.showTableFinalResults=function(tableNo){
  if(bmPollInterval){clearInterval(bmPollInterval);bmPollInterval=null;}
  const s=getState();
  const pairMP=calcMP();
  const pairs=getPairs();
  const rows=Object.keys(pairs).filter(id=>!pairs[id].isPhantom).map(id=>{
    const d=pairMP[id]||{mp:0,top:0};
    return{id,name:pairs[id].name||id,pct:d.top>0?(d.mp/d.top*100):0};
  }).sort((a,b)=>b.pct-a.pct);
  const rowsHTML=rows.map((r,i)=>`
    <div style="display:flex;justify-content:space-between;padding:7px 10px;border-bottom:1px solid var(--border);font-size:0.8rem;${i===0?'background:var(--golddim);':''}">
      <span>${i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'.'} ${r.name}</span>
      <span style="font-weight:700;color:var(--gold);">${r.pct.toFixed(1)}%</span>
    </div>`).join('');
  document.getElementById('panelContent').innerHTML=`
    <div class="bm-device" style="max-width:400px;">
      <div class="round-over-screen">
        <div class="ro-badge">🏁</div>
        <div class="ro-title">${s.name||'Tournament'} — Final Results</div>
        <div class="ro-sub">Table ${tableNo}</div>
      </div>
      <div style="max-height:340px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm);margin:14px 0;">
        ${rowsHTML||'<div style="padding:14px;text-align:center;color:var(--text3);font-size:0.8rem;">No results yet</div>'}
      </div>
      <button class="btn btn-gold btn-full" onclick="performLogout()">← Log Out</button>
    </div>`;
};
window.performLogout=async function(){
  if(role==='table'){ try{ await unlockAllMyTables(); }catch(e){} }
  if(role==='admin'){
    const st=getState();
    if(st&&st.status==='running'){
      const wantsExport=await confirmDialog(
        'You are about to leave the Admin screen while the tournament is still running.',
        {title:'Export backup first?', confirmLabel:'Export Backup', cancelLabel:'Just Log Out', danger:false});
      if(wantsExport)adminExport();
    }
  }
  finishLogoutUI();
};
function finishLogoutUI(){
  setTimeout(endSession, 1500);   // this device may no longer change anything (after the last writes have gone out)
  document.getElementById('app').style.display='none';
  document.getElementById('loginScreen').style.display='flex';
  document.getElementById('topbarRound').style.display='none';
  if(role==='superadmin'){
    // Super Admin logs back out to the club gate (or straight to login form if a club is already resolved)
    if(CLUB_ID){
      document.getElementById('clubGate').style.display='none';
      document.getElementById('loginForm').style.display='block';
      document.getElementById('roleTabs').style.display='flex';
      document.getElementById('backToClubGate').style.display='none';
      document.getElementById('loginSub').textContent=CLUB_NAME||'Tournament Control System';
    } else {
      document.getElementById('loginForm').style.display='none';
      document.getElementById('roleTabs').style.display='flex';
      document.getElementById('backToClubGate').style.display='none';
      document.getElementById('loginSub').textContent='Tournament Control System';
      document.getElementById('clubGate').style.display='block';
    }
  }
  selRole('admin');
  if(bmPollInterval){clearInterval(bmPollInterval);bmPollInterval=null;}
}
function refreshTopbar(){
  const s=getState();const el=document.getElementById('topbarRound');
  if(s.currentRound>0){
    el.style.display='inline-flex';
    el.textContent='Round '+s.currentRound+'/'+s.roundCount+(s.name?' · '+s.name:'');
  } else el.style.display='none';
}

// ══════════════════════════════════════════════════════
//  TOAST & MODAL
// ══════════════════════════════════════════════════════
function toast(msg,dur=2500){
  const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),dur);
}
function openModal(title,body,actions=''){
  document.getElementById('modalTitle').textContent=title;
  document.getElementById('modalBody').innerHTML=body;
  document.getElementById('modalActions').innerHTML=actions;
  document.getElementById('modalBg').classList.add('open');
}
window.closeModal=function(){document.getElementById('modalBg').classList.remove('open');};

// In-page replacement for native confirm() — returns a Promise<boolean>,
// styled consistently with the rest of the app instead of a browser popup.
function confirmDialog(message, opts={}){
  return new Promise(resolve=>{
    const danger=opts.danger!==false;
    const confirmLabel=opts.confirmLabel||'Confirm';
    const cancelLabel=opts.cancelLabel||'Cancel';
    const safeMsg=String(message).replace(/\n/g,'<br>');
    openModal(opts.title||'Please Confirm',
      `<div style="font-size:0.85rem;color:var(--text2);line-height:1.5;">${safeMsg}</div>`,
      `<button class="btn btn-ghost" onclick="__confirmDialogResolve(false)">${cancelLabel}</button>
       <button class="btn ${danger?'btn-red':'btn-gold'}" onclick="__confirmDialogResolve(true)">${confirmLabel}</button>`);
    window.__confirmDialogResolve=(val)=>{ closeModal(); resolve(val); delete window.__confirmDialogResolve; };
  });
}

// ══════════════════════════════════════════════════════
//  PANEL ROUTER
// ══════════════════════════════════════════════════════
window.renderPanel=function(){
  const c=document.getElementById('panelContent');
  c.innerHTML='';c.className='panel-anim';void c.offsetWidth;
  if(role==='superadmin')renderSuperAdminPanel();
  else if(role==='table')renderTablePanel();
  else if(role==='screen')renderScreenPanel();
  else renderAdminPanel();
};

// ══════════════════════════════════════════════════════
