// ============================================================
// dashboard-student.js — JS TECH PROMO VACANCES 2026
// Firebase Auth · Firestore · WebRTC · Cloudinary
// ============================================================

import { auth, db }               from './firebase-config.js';
import { uploadToCloudinary }     from './cloudinary-config.js';

import {
  onAuthStateChanged, signOut, updateProfile as fbUpdateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  collection, query, where, orderBy, limit,
  onSnapshot, serverTimestamp, increment, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Global state ────────────────────────────────────────────
let ME           = null;   // Firebase user
let MY_DATA      = null;   // Firestore user doc
let ACTIVE_SEC   = 'home';
let SIDEBAR_MINI = false;
let DARK         = localStorage.getItem('jst-theme') === 'dark';

// WebRTC state
let localStream     = null;
let remoteStream    = null;
let peerConn        = null;
let currentCallId   = null;
let callTimerInt    = null;
let callSeconds     = 0;
let selectedChatUID = null;
let msgUnsub        = null;
const ICE_SERVERS   = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };

// ── Helpers ─────────────────────────────────────────────────
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const esc = s => String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;');

// ── Preloader ───────────────────────────────────────────────
window.addEventListener('load', () => setTimeout(() => $('#sPreloader')?.classList.add('out'), 800));

// ── Theme ────────────────────────────────────────────────────
function applyTheme() {
  document.documentElement.dataset.theme = DARK ? 'dark' : 'light';
  $$('.theme-icon').forEach(i => { i.className = `fas fa-${DARK ? 'sun' : 'moon'} theme-icon`; });
}
applyTheme();

// ── Toast ────────────────────────────────────────────────────
function toast(type, title, msg = '', dur = 4500) {
  const icons = { s:'fa-check-circle', e:'fa-times-circle', w:'fa-exclamation-triangle', i:'fa-info-circle' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fas ${icons[type]||'fa-info-circle'} ti"></i>
    <div><div class="tt">${esc(title)}</div>${msg?`<div class="tb">${esc(msg)}</div>`:''}`;
  $('#toastBox').appendChild(el);
  el.addEventListener('click', () => dismissToast(el));
  if (dur > 0) setTimeout(() => dismissToast(el), dur);
}
function dismissToast(el) {
  if (el.classList.contains('out')) return;
  el.classList.add('out');
  setTimeout(() => el.remove(), 320);
}

// ── Auth guard ───────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = 'login.html'; return; }
  ME = user;
  await loadMyData();
  initApp();
});

async function loadMyData() {
  try {
    const snap = await getDoc(doc(db, 'users', ME.uid));
    MY_DATA = snap.exists() ? snap.data() : {
      nom: 'Étudiant', prenom: '', matricule: '—',
      role: 'student', email: ME.email,
      session: 'PROMO VACANCES 2026',
      bio: '', photoURL: '', coverURL: ''
    };
  } catch(e) {
    MY_DATA = { nom: 'Utilisateur', prenom: '', role: 'student' };
  }
}

// ── Init ─────────────────────────────────────────────────────
function initApp() {
  populateUI();
  setupNav();
  setupSidebar();
  setupHamburger();
  setupTheme();
  setupSearch();
  listenNotifications();
  listenIncomingCalls();
  navigateTo('home');
}

function populateUI() {
  const full = `${MY_DATA.prenom||''} ${MY_DATA.nom||''}`.trim() || 'Étudiant';
  const ini  = ((MY_DATA.prenom||'?')[0] + (MY_DATA.nom||'?')[0]).toUpperCase();

  $$('.my-name').forEach(el => el.textContent = full);
  $$('.my-ini').forEach(el => el.textContent = ini);
  $$('.my-role').forEach(el => el.textContent = MY_DATA.role === 'admin' ? 'Administrateur' : 'Étudiant');
  $$('.my-matri').forEach(el => el.textContent = `Matricule : ${MY_DATA.matricule||'—'}`);

  // Avatar photos
  if (MY_DATA.photoURL) {
    $$('.my-photo').forEach(el => {
      if (el.tagName === 'IMG') { el.src = MY_DATA.photoURL; el.style.display = ''; }
      else {
        const img = el.querySelector('img.my-photo-img') || document.createElement('img');
        img.className = 'my-photo-img'; img.src = MY_DATA.photoURL;
        Object.assign(img.style, { position:'absolute', inset:'0', width:'100%', height:'100%', objectFit:'cover' });
        el.appendChild(img);
      }
    });
  }
}

// ── Navigation ───────────────────────────────────────────────
function setupNav() {
  $$('.ni[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      navigateTo(item.dataset.page);
      if (window.innerWidth < 900) closeMobileSidebar();
    });
  });
}

window.navigateTo = function(page) {
  ACTIVE_SEC = page;
  $$('.ni').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  $$('.sec').forEach(s => s.classList.toggle('active', s.id === `s-${page}`));
  const loaders = {
    home: loadHome, profile: loadProfile,
    attendance: loadAttendance, grades: loadGrades,
    evaluations: loadEvaluations, bulletins: loadBulletins,
    messages: loadMessages, calls: loadCalls,
    voicerooms: loadVoiceRooms, feed: loadFeed,
    friends: loadFriends, notifications: loadNotifications,
    upload: loadUpload, settings: loadSettings,
  };
  if (loaders[page]) loaders[page]();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ── Sidebar ──────────────────────────────────────────────────
function setupSidebar() {
  $('#sbToggle')?.addEventListener('click', () => {
    SIDEBAR_MINI = !SIDEBAR_MINI;
    $('#sidebar').classList.toggle('mini', SIDEBAR_MINI);
    $('#mainWrap').classList.toggle('exp', SIDEBAR_MINI);
    const icon = $('#sbToggle').querySelector('i');
    if (icon) icon.className = `fas fa-${SIDEBAR_MINI ? 'chevron-right' : 'chevron-left'}`;
  });
}

function setupHamburger() {
  $('#tbHam')?.addEventListener('click', () => {
    $('#sidebar').classList.toggle('mobile-open');
    $('#sbOverlay').classList.toggle('show');
  });
  $('#sbOverlay')?.addEventListener('click', closeMobileSidebar);
}

function closeMobileSidebar() {
  $('#sidebar').classList.remove('mobile-open');
  $('#sbOverlay').classList.remove('show');
}

function setupTheme() {
  $$('.theme-toggle').forEach(btn => btn.addEventListener('click', () => {
    DARK = !DARK;
    localStorage.setItem('jst-theme', DARK ? 'dark' : 'light');
    applyTheme();
  }));
}

function setupSearch() {
  $('#topSearch')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const v = e.target.value.trim();
      if (v) { navigateTo('friends'); searchFriends(v); }
    }
  });
}

window.doSignOut = async () => {
  if (!confirm('Se déconnecter ?')) return;
  try { await signOut(auth); window.location.href = 'login.html'; }
  catch { toast('e', 'Erreur', 'Impossible de se déconnecter.'); }
};

// ============================================================
// HOME
// ============================================================
async function loadHome() {
  const full = `${MY_DATA.prenom||''} ${MY_DATA.nom||''}`.trim();
  const el = $('#homeWelcome');
  if (el) el.textContent = `Bonjour, ${full || 'Étudiant'} 👋`;
  await Promise.all([loadHomeStats(), loadRecentActivity(), loadHomeAnnouncements()]);
}

async function loadHomeStats() {
  try {
    if (!MY_DATA.matricule || MY_DATA.matricule === '—') return;
    // Attendance
    const attSnap = await getDocs(query(collection(db,'attendance'), where('matricule','==',MY_DATA.matricule)));
    let p = 0, tot = 0;
    attSnap.forEach(d => { tot++; if (d.data().status === 'present') p++; });
    const rate = tot > 0 ? Math.round(p / tot * 100) : 0;
    animCount($('#statAtt'), 0, rate, '%');
    const pb = $('#homeAttBar'); if (pb) pb.style.width = rate + '%';

    // Grades
    const grSnap = await getDocs(query(collection(db,'grades'), where('matricule','==',MY_DATA.matricule)));
    let gTot = 0, gCnt = 0;
    grSnap.forEach(d => { const n = parseFloat(d.data().note); if (!isNaN(n)) { gTot += n; gCnt++; } });
    const avg = gCnt ? (gTot / gCnt).toFixed(1) : null;
    animCount($('#statAvg'), 0, avg ? parseFloat(avg) : 0, '/20');
    const gpb = $('#homeAvgBar'); if (gpb && avg) gpb.style.width = Math.min(100, parseFloat(avg)*5) + '%';
  } catch(e) { console.warn('loadHomeStats:', e); }
}

async function loadRecentActivity() {
  const el = $('#recentAct'); if (!el) return;
  try {
    const q = query(collection(db,'notifications'), where('userId','==',ME.uid), orderBy('createdAt','desc'), limit(6));
    const snap = await getDocs(q);
    if (snap.empty) { el.innerHTML = '<div class="empty"><i class="fas fa-bell-slash"></i><p>Aucune activité.</p></div>'; return; }
    el.innerHTML = '';
    snap.forEach(d => {
      const n = d.data();
      el.innerHTML += `<div class="nl-item ${n.read?'':'unread'}" onclick="markNotifRead('${d.id}',this)">
        <div class="nl-ico" style="background:${n.bg||'var(--blue-pale)'};color:${n.ic||'var(--blue)'}"><i class="fas ${n.icon||'fa-bell'}"></i></div>
        <div class="nl-txt">${esc(n.message||'')} <div class="nl-t">${fmtDate(n.createdAt)}</div></div>
        ${!n.read ? '<div class="nl-dot"></div>' : ''}
      </div>`;
    });
  } catch(e) { el.innerHTML = ''; }
}

async function loadHomeAnnouncements() {
  const el = $('#homeAnnounce'); if (!el) return;
  try {
    const q = query(collection(db,'posts'), where('type','==','announcement'), orderBy('createdAt','desc'), limit(3));
    const snap = await getDocs(q);
    el.innerHTML = '';
    if (snap.empty) { el.innerHTML = '<p style="font-size:.8rem;color:var(--text-soft);text-align:center;padding:16px">Aucune annonce.</p>'; return; }
    snap.forEach(d => {
      const p = d.data();
      el.innerHTML += `<div style="padding:10px 0;border-bottom:1px solid var(--border-soft)">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:4px">
          <span class="badge bo" style="font-size:.62rem"><i class="fas fa-megaphone"></i> Annonce</span>
          <span style="font-size:.67rem;color:var(--text-soft)">${fmtDate(p.createdAt)}</span>
        </div>
        <div style="font-size:.83rem;font-weight:700">${esc(p.title||'')}</div>
        <div style="font-size:.76rem;color:var(--text-mid);margin-top:3px">${esc((p.content||'').substring(0,100))}…</div>
      </div>`;
    });
  } catch(e) {}
}

// ============================================================
// PROFILE
// ============================================================
async function loadProfile() {
  const full = `${MY_DATA.prenom||''} ${MY_DATA.nom||''}`.trim();
  const ini  = ((MY_DATA.prenom||'?')[0]+(MY_DATA.nom||'?')[0]).toUpperCase();
  if ($('#profName'))    $('#profName').textContent = full||'—';
  if ($('#profMatri'))   $('#profMatri').textContent = `Matricule : ${MY_DATA.matricule||'—'}`;
  if ($('#profEmail'))   $('#profEmail').textContent = MY_DATA.email||'—';
  if ($('#profSession')) $('#profSession').textContent = MY_DATA.session||'—';
  if ($('#profBio'))     $('#profBio').textContent = MY_DATA.bio||'Aucune bio renseignée.';
  if ($('#profIni'))     $('#profIni').textContent = ini;
  if ($('#profIni2'))    $('#profIni2').textContent = ini;
  if (MY_DATA.photoURL) {
    $$('.prof-ava-img').forEach(img => { img.src = MY_DATA.photoURL; img.style.display = ''; });
  }
  if (MY_DATA.coverURL) {
    const cov = $('#profCoverImg');
    if (cov) { cov.src = MY_DATA.coverURL; cov.style.display = ''; }
  }
  // Prefill form
  if ($('#editPrenom')) $('#editPrenom').value = MY_DATA.prenom||'';
  if ($('#editNom'))    $('#editNom').value    = MY_DATA.nom||'';
  if ($('#editBio'))    $('#editBio').value    = MY_DATA.bio||'';
  // Stats
  await loadProfileStats();
}

async function loadProfileStats() {
  try {
    if (!MY_DATA.matricule || MY_DATA.matricule === '—') return;
    const [attSnap, grSnap] = await Promise.all([
      getDocs(query(collection(db,'attendance'), where('matricule','==',MY_DATA.matricule))),
      getDocs(query(collection(db,'grades'),    where('matricule','==',MY_DATA.matricule)))
    ]);
    let p = 0;
    attSnap.forEach(d => { if (d.data().status === 'present') p++; });
    const rate = attSnap.size > 0 ? Math.round(p/attSnap.size*100) : 0;
    let gT = 0, gC = 0;
    grSnap.forEach(d => { const n = parseFloat(d.data().note); if (!isNaN(n)) { gT += n; gC++; } });
    const avg = gC ? (gT/gC).toFixed(1) : '—';
    if ($('#psAtt')) $('#psAtt').textContent = rate + '%';
    if ($('#psAvg')) $('#psAvg').textContent = avg !== '—' ? avg + '/20' : '—';
    if ($('#psMods')) $('#psMods').textContent = '4';
  } catch(e) {}
}

// Update profile text
window.updateMyProfile = async () => {
  const prenom = $('#editPrenom')?.value.trim();
  const nom    = $('#editNom')?.value.trim();
  const bio    = $('#editBio')?.value.trim();
  if (!prenom && !nom) { toast('w','Champs vides','Remplissez au moins un champ.'); return; }
  try {
    const upd = {};
    if (prenom !== undefined) upd.prenom = prenom;
    if (nom    !== undefined) upd.nom    = nom;
    if (bio    !== undefined) upd.bio    = bio;
    await updateDoc(doc(db,'users',ME.uid), upd);
    Object.assign(MY_DATA, upd);
    populateUI(); loadProfile();
    toast('s','Profil mis à jour','Vos informations ont été sauvegardées.');
  } catch(e) { toast('e','Erreur','Impossible de mettre à jour.'); }
};

// Upload profile photo
window.triggerAvatarUpload = () => $('#avatarFileInput')?.click();
window.triggerCoverUpload  = () => $('#coverFileInput')?.click();

async function handleAvatarUpload(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('w','Format invalide','Sélectionnez une image.'); return; }
  toast('i','Upload en cours','Photo de profil en cours d\'envoi…');
  try {
    const res = await uploadToCloudinary(file, 'avatars', pct => {
      const el = $('#avatarUploadPct'); if (el) el.textContent = pct + '%';
    });
    await updateDoc(doc(db,'users',ME.uid), { photoURL: res.url });
    MY_DATA.photoURL = res.url;
    await fbUpdateProfile(ME, { photoURL: res.url });
    populateUI(); loadProfile();
    toast('s','Photo mise à jour !','Votre photo de profil a été sauvegardée.');
  } catch(e) { toast('e','Erreur upload', String(e.message||e)); }
}

async function handleCoverUpload(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('w','Format invalide','Sélectionnez une image.'); return; }
  toast('i','Upload couverture','En cours…');
  try {
    const res = await uploadToCloudinary(file, 'covers');
    await updateDoc(doc(db,'users',ME.uid), { coverURL: res.url });
    MY_DATA.coverURL = res.url;
    const cov = $('#profCoverImg');
    if (cov) { cov.src = res.url; cov.style.display = ''; }
    toast('s','Couverture mise à jour !');
  } catch(e) { toast('e','Erreur', String(e.message||e)); }
}

// ============================================================
// ATTENDANCE
// ============================================================
async function loadAttendance() {
  const tbody = $('#attTable'); if (!tbody) return;
  try {
    const q = query(collection(db,'attendance'), where('matricule','==',MY_DATA.matricule||''), orderBy('date','desc'));
    const snap = await getDocs(q);
    let p=0, a=0, l=0;
    tbody.innerHTML = '';
    if (snap.empty) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:28px;color:var(--text-soft)">Aucune donnée.</td></tr>'; return; }
    snap.forEach(d => {
      const r = d.data();
      if (r.status==='present') p++; else if (r.status==='absent') a++; else l++;
      const sm = { present:'<span class="badge bg"><i class="fas fa-check-circle"></i> Présent</span>', absent:'<span class="badge br"><i class="fas fa-times-circle"></i> Absent</span>', late:'<span class="badge bw"><i class="fas fa-clock"></i> Retard</span>' };
      tbody.innerHTML += `<tr><td>${fmtDate(r.date)}</td><td>${esc(r.module||'—')}</td><td>${sm[r.status]||r.status}</td><td style="font-size:.73rem;color:var(--text-soft)">${esc(r.note||'—')}</td></tr>`;
    });
    const tot = p+a+l; const rate = tot ? Math.round(p/tot*100) : 0;
    animCount($('#attP'), 0, p, ''); animCount($('#attA'), 0, a, ''); animCount($('#attL'), 0, l, '');
    animCount($('#attRate'), 0, rate, '%');
    const rpb = $('#attRateBar'); if (rpb) rpb.style.width = rate + '%';
  } catch(e) { console.warn('loadAttendance:', e); }
}

// ============================================================
// GRADES
// ============================================================
async function loadGrades() {
  const tbody = $('#gradesBody'); if (!tbody) return;
  const modules = { Word:3, Excel:4, PowerPoint:2, Anglais:3 };
  const modMap  = {};
  try {
    const snap = await getDocs(query(collection(db,'grades'), where('matricule','==',MY_DATA.matricule||'')));
    tbody.innerHTML = '';
    if (snap.empty) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:28px;color:var(--text-soft)">Aucune note enregistrée.</td></tr>'; return; }
    snap.forEach(d => {
      const g = d.data(); const note = parseFloat(g.note);
      const mk = (g.module||'').toLowerCase().replace(/\s/g,'');
      if (!modMap[mk] || note > modMap[mk]) modMap[mk] = note;
      const men = getMention(note);
      tbody.innerHTML += `<tr>
        <td><span class="badge bb">${esc(g.module||'—')}</span></td>
        <td><strong>${isNaN(note)?'—':note+'/20'}</strong></td>
        <td>${esc(g.evaluation||'—')}</td>
        <td><span class="badge ${men.cls}">${men.label}</span></td>
      </tr>`;
    });
    // Update module cards
    ['word','excel','powerpoint','anglais'].forEach(k => {
      const el = $(`#gmod-${k}`);
      if (el) el.textContent = modMap[k] !== undefined ? modMap[k].toFixed(1)+'/20' : '—';
    });
    // Compute general average
    let tot = 0, coTot = 0;
    Object.entries(modules).forEach(([m, c]) => {
      const k = m.toLowerCase().replace(/\s/g,'');
      if (modMap[k] !== undefined) { tot += modMap[k]*c; coTot += c; }
    });
    const avg = coTot ? (tot/coTot).toFixed(2) : '—';
    const avgEl = $('#gradesAvg'); if (avgEl) avgEl.textContent = avg !== '—' ? avg+'/20' : '—';
    const avgBadge = $('#gradesAvgMention');
    if (avgBadge && avg !== '—') { const m = getMention(parseFloat(avg)); avgBadge.className = `badge ${m.cls}`; avgBadge.textContent = m.label; }
  } catch(e) { console.warn('loadGrades:', e); }
}

function getMention(n) {
  if (isNaN(n)) return { label:'—', cls:'bgr' };
  if (n >= 16)  return { label:'Très Bien', cls:'bg' };
  if (n >= 14)  return { label:'Bien',      cls:'bb' };
  if (n >= 12)  return { label:'Assez Bien',cls:'bo' };
  if (n >= 10)  return { label:'Passable',  cls:'bw' };
  return { label:'Insuffisant', cls:'br' };
}

// ============================================================
// EVALUATIONS
// ============================================================
async function loadEvaluations() {
  const el = $('#evalGrid'); if (!el) return;
  try {
    const snap = await getDocs(query(collection(db,'evaluations'), orderBy('dueDate','asc')));
    el.innerHTML = '';
    if (snap.empty) { el.innerHTML = '<div class="empty" style="grid-column:1/-1"><i class="fas fa-clipboard-list"></i><h3>Aucune évaluation</h3></div>'; return; }
    snap.forEach(d => {
      const e = d.data(); const isPast = e.dueDate && new Date(e.dueDate) < new Date();
      const tc = { devoir:'bb', controle:'bo', examen:'br', tp:'bg' };
      el.innerHTML += `<div class="card a2" style="padding:0">
        <div style="padding:16px">
          <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--blue);margin-bottom:7px">${esc(e.type||'Évaluation')}</div>
          <div style="font-size:.9rem;font-weight:800;margin-bottom:6px">${esc(e.title||'—')}</div>
          <div style="font-size:.74rem;color:var(--text-soft);display:flex;gap:11px;flex-wrap:wrap;margin-bottom:13px">
            <span><i class="fas fa-book"></i> ${esc(e.module||'—')}</span>
            <span><i class="fas fa-calendar"></i> ${esc(e.dueDate||'—')}</span>
            <span><i class="fas fa-star"></i> Coeff. ${e.coefficient||1}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="badge ${tc[e.type]||'bgr'}">${esc(e.type||'—')}</span>
            <span class="badge ${isPast?'bgr':'bg'}">${isPast?'Terminé':'À venir'}</span>
          </div>
        </div>
      </div>`;
    });
  } catch(e) { console.warn('loadEvaluations:', e); }
}

// ============================================================
// BULLETINS
// ============================================================
async function loadBulletins() {
  await renderBulletin(MY_DATA.matricule, `${MY_DATA.prenom||''} ${MY_DATA.nom||''}`.trim());
}

async function renderBulletin(matricule, name) {
  const el = $('#bullPreview'); if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-soft)"><div class="spl-bar" style="margin:0 auto 14px"><div class="spl-bar-fill"></div></div>Génération…</div>';
  if (!matricule || matricule === '—') {
    el.innerHTML = '<div class="empty"><i class="fas fa-id-card"></i><h3>Matricule introuvable</h3><p>Votre profil ne contient pas de matricule.</p></div>'; return;
  }
  try {
    const snap = await getDocs(query(collection(db,'grades'), where('matricule','==',matricule)));
    const grades = {};
    snap.forEach(d => {
      const g = d.data(); const n = parseFloat(g.note)||0;
      const mk = (g.module||'').toLowerCase().replace(/\s/g,'');
      if (!grades[mk] || n > grades[mk]) grades[mk] = n;
    });
    const mods = ['Word','Excel','PowerPoint','Anglais'];
    const coeffs = { word:3, excel:4, powerpoint:2, anglais:3 };
    let pts = 0, co = 0;
    mods.forEach(m => { const k = m.toLowerCase().replace(/\s/g,''); const n = grades[k]||0; pts += n*(coeffs[k]||1); co += (coeffs[k]||1); });
    const avg = co ? (pts/co).toFixed(2) : '0.00';
    const men = getMention(parseFloat(avg));
    const today = new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'});

    el.innerHTML = `
    <div class="bull" id="theBull">
      <div class="bull-hdr">
        <div class="bull-logo">J</div>
        <div class="bull-school">
          <h2>JS TECH — PROMO VACANCES 2026</h2>
          <p>Plateforme Éducative Numérique · Cotonou, Bénin</p>
        </div>
      </div>
      <div class="bull-body">
        <div style="margin-bottom:18px">
          <div class="bull-st">Informations de l'étudiant</div>
          <div class="bull-ig">
            <div class="bull-ii"><label>Étudiant :</label><span>${esc(name)}</span></div>
            <div class="bull-ii"><label>Matricule :</label><span>${esc(matricule)}</span></div>
            <div class="bull-ii"><label>Session :</label><span>${esc(MY_DATA.session||'PROMO VACANCES 2026')}</span></div>
            <div class="bull-ii"><label>Date :</label><span>${today}</span></div>
          </div>
        </div>
        <div>
          <div class="bull-st">Résultats par module</div>
          <table class="bull-tbl">
            <thead><tr><th>Module</th><th>Note /20</th><th>Coeff.</th><th>Points</th><th>Mention</th></tr></thead>
            <tbody>
              ${mods.map(m => {
                const k = m.toLowerCase().replace(/\s/g,'');
                const n = grades[k] !== undefined ? grades[k].toFixed(1) : '—';
                const p = grades[k] !== undefined ? (grades[k]*coeffs[k]).toFixed(1) : '—';
                const mc = getMention(parseFloat(n));
                return `<tr><td>${m}</td><td><strong>${n}</strong></td><td>${coeffs[k]}</td><td>${p}</td><td>${mc.label}</td></tr>`;
              }).join('')}
              <tr class="bull-avg"><td><strong>Moyenne Générale</strong></td><td><strong>${avg}/20</strong></td><td>${co}</td><td><strong>${pts.toFixed(1)}</strong></td><td><strong>${men.label}</strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="bull-ft">
        <div class="bull-sign"><div style="font-size:.72rem">Signature Direction</div><div class="bull-sl"></div><div style="font-size:.72rem">JS TECH</div></div>
        <div style="text-align:center;font-size:.7rem">Généré le ${today}</div>
        <div class="bull-sign"><div style="font-size:.72rem">Validation</div><div class="bull-sl"></div><div style="font-size:.7rem;color:#0A3D91;font-weight:700">Officiel ✓</div></div>
      </div>
    </div>`;
  } catch(e) { el.innerHTML = '<div class="empty"><p>Impossible de générer le bulletin.</p></div>'; }
}

window.printBulletin = () => {
  const el = document.getElementById('theBull');
  if (!el) { toast('w','Pas de bulletin','Attendez la génération du bulletin.'); return; }
  const w = window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>Bulletin JS TECH</title>
    <style>body{margin:20px;font-family:'Times New Roman',serif}
    .bull{max-width:700px;margin:0 auto;border:2px solid #ddd;border-radius:8px;overflow:hidden}
    .bull-hdr{background:#0A3D91;color:#fff;padding:22px 28px;display:flex;align-items:center;gap:18px}
    .bull-logo{width:55px;height:55px;border-radius:13px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:900;color:#0A3D91}
    .bull-school h2{font-size:1.1rem;font-weight:900;font-family:sans-serif}
    .bull-school p{font-size:.77rem;opacity:.8;font-family:sans-serif}
    .bull-body{padding:22px 28px}.bull-st{font-size:.75rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#0A3D91;border-bottom:2px solid #0A3D91;padding-bottom:4px;margin-bottom:10px;font-family:sans-serif}
    .bull-ig{display:grid;grid-template-columns:1fr 1fr;gap:7px 22px}
    .bull-ii{display:flex;gap:7px;font-size:.8rem}.bull-ii label{font-weight:700;min-width:86px}
    .bull-tbl{width:100%;border-collapse:collapse;font-size:.8rem;font-family:sans-serif}
    .bull-tbl th{background:#0A3D91;color:#fff;padding:7px 11px;text-align:left;font-size:.7rem}
    .bull-tbl td{padding:7px 11px;border-bottom:1px solid #eee}
    .bull-tbl tr:nth-child(even) td{background:#f9f9f9}
    .bull-avg{background:#FFF0E6 !important;font-weight:900}
    .bull-ft{background:#f4f6fc;padding:14px 28px;display:flex;justify-content:space-between;align-items:center;font-size:.75rem;color:#666;font-family:sans-serif;border-top:1px solid #ddd}
    .bull-sign{text-align:center}.bull-sl{width:110px;border-top:1px solid #333;margin:14px auto 3px}
    </style></head><body>${el.outerHTML}</body></html>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 400);
};

// ============================================================
// MESSAGES
// ============================================================
async function loadMessages() {
  await loadContactList();
}

async function loadContactList() {
  const el = $('#ccList'); if (!el) return;
  try {
    const snap = await getDocs(query(collection(db,'users'), limit(25)));
    el.innerHTML = '';
    snap.forEach(d => {
      if (d.id === ME.uid) return;
      const u = d.data();
      const fn = `${u.prenom||''} ${u.nom||''}`.trim()||'—';
      const ini = ((u.prenom||'?')[0]+(u.nom||'?')[0]).toUpperCase();
      el.innerHTML += `
        <div class="ci" data-uid="${d.id}" onclick="openChat('${d.id}','${esc(fn)}','${ini}','${u.photoURL||''}')">
          <div class="ci-ava">${u.photoURL?`<img src="${u.photoURL}" alt="">`:ini}<div class="ci-od"></div></div>
          <div style="flex:1;min-width:0">
            <div class="ci-n">${esc(fn)}</div>
            <div class="ci-p">${u.role==='admin'?'Admin':'Étudiant'}</div>
          </div>
          <div class="ci-t">—</div>
        </div>`;
    });
  } catch(e) { console.warn('loadContactList:', e); }
}

window.openChat = (uid, name, ini, photo) => {
  selectedChatUID = uid;
  $$('.ci').forEach(i => i.classList.toggle('active', i.dataset.uid === uid));
  const hn = $('#chatHdrName'); if (hn) hn.textContent = name;
  const hs = $('#chatHdrStatus'); if (hs) { hs.textContent = '● En ligne'; hs.style.color = 'var(--online)'; }
  const ha = $('#chatHdrAva');
  if (ha) ha.innerHTML = photo ? `<img src="${photo}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit">` : ini;

  if (msgUnsub) msgUnsub();
  const convId = [ME.uid, uid].sort().join('_');
  const myIni = ((MY_DATA.prenom||'?')[0]+(MY_DATA.nom||'?')[0]).toUpperCase();
  const myPhoto = MY_DATA.photoURL||'';
  const q = query(collection(db,'messages',convId,'msgs'), orderBy('createdAt','asc'), limit(60));
  msgUnsub = onSnapshot(q, snap => {
    const msgsEl = $('#chatMsgs'); if (!msgsEl) return;
    msgsEl.innerHTML = '';
    if (snap.empty) { msgsEl.innerHTML = '<div class="empty"><i class="fas fa-comments"></i><h3>Démarrez la conversation</h3></div>'; return; }
    snap.forEach(d => {
      const m = d.data(); const own = m.senderId === ME.uid;
      const avaHtml = own ? (myPhoto?`<img src="${myPhoto}" alt="">`:myIni) : (photo?`<img src="${photo}" alt="">`:ini);
      let content = '';
      if (m.type === 'image') content = `<div class="mimg"><img src="${esc(m.url||m.text)}" alt="photo" loading="lazy"></div>`;
      else if (m.type === 'file') content = `<div class="mfile"><div class="mfile-ico"><i class="fas fa-file"></i></div><div><div class="mfile-n">${esc(m.fileName||'Fichier')}</div><div class="mfile-s">${esc(m.fileSize||'')}</div></div><a href="${esc(m.url||'#')}" target="_blank" class="btn btn-xs btn-g"><i class="fas fa-download"></i></a></div>`;
      else content = esc(m.text||'');
      msgsEl.innerHTML += `<div class="mrow ${own?'own':''}">
        <div class="mava">${avaHtml}</div>
        <div><div class="mbbl">${content}</div><div class="mtime">${fmtDate(m.createdAt)}</div></div>
      </div>`;
    });
    msgsEl.scrollTop = msgsEl.scrollHeight;
  });
};

window.sendMsg = async () => {
  if (!selectedChatUID) { toast('w','Sélectionnez','Choisissez une conversation.'); return; }
  const input = $('#msgInput'); const text = input?.value.trim();
  if (!text) return;
  input.value = '';
  const convId = [ME.uid, selectedChatUID].sort().join('_');
  try {
    await addDoc(collection(db,'messages',convId,'msgs'), {
      text, type:'text', senderId:ME.uid,
      senderName:`${MY_DATA.prenom||''} ${MY_DATA.nom||''}`.trim(),
      createdAt: serverTimestamp()
    });
  } catch(e) { toast('e','Erreur','Message non envoyé.'); input.value = text; }
};

window.sendMsgFile = async (file) => {
  if (!selectedChatUID) { toast('w','Contact requis','Ouvrez une conversation d\'abord.'); return; }
  if (!file) return;
  toast('i','Envoi fichier','Upload en cours…');
  try {
    const folder = file.type.startsWith('image') ? 'chat-images' : 'chat-files';
    const res = await uploadToCloudinary(file, folder);
    const isImg = file.type.startsWith('image');
    const convId = [ME.uid, selectedChatUID].sort().join('_');
    await addDoc(collection(db,'messages',convId,'msgs'), {
      text: res.url, url: res.url,
      type: isImg ? 'image' : 'file',
      fileName: file.name,
      fileSize: formatBytes(file.size),
      senderId: ME.uid,
      senderName:`${MY_DATA.prenom||''} ${MY_DATA.nom||''}`.trim(),
      createdAt: serverTimestamp()
    });
    toast('s','Fichier envoyé !','Le fichier a été partagé avec succès.');
  } catch(e) { toast('e','Erreur upload',String(e.message||e)); }
};

// ============================================================
// CALLS — WebRTC
// ============================================================
async function loadCalls() {
  const el = $('#callsHistory'); if (!el) return;
  try {
    const q = query(collection(db,'calls'), where('participants','array-contains',ME.uid), orderBy('createdAt','desc'), limit(20));
    const snap = await getDocs(q);
    el.innerHTML = '';
    if (snap.empty) { el.innerHTML = '<div class="empty"><i class="fas fa-phone-slash"></i><h3>Aucun appel</h3><p>Vos appels apparaîtront ici.</p></div>'; return; }
    snap.forEach(d => {
      const c = d.data(); const outgoing = c.callerId === ME.uid;
      el.innerHTML += `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border-soft)">
          <div class="ci-ava" style="width:40px;height:40px;border-radius:11px">${(c.calleeName||'?')[0].toUpperCase()}</div>
          <div style="flex:1">
            <div style="font-size:.84rem;font-weight:700">${esc(outgoing?c.calleeName:c.callerName)||'—'}</div>
            <div style="font-size:.72rem;color:var(--text-soft)">
              <i class="fas fa-${outgoing?'phone-arrow-up-right':'phone-arrow-down-left'}" style="color:${c.status==='missed'?'var(--error)':'var(--success)'}"></i>
              ${outgoing?'Sortant':'Entrant'} · ${c.type||'audio'} · ${fmtDate(c.createdAt)}
            </div>
          </div>
          <button class="btn btn-g btn-xs" onclick="callUser('${outgoing?c.calleeId:c.callerId}','${esc(outgoing?c.calleeName:c.callerName)}','${c.type||'audio'}')">
            <i class="fas fa-phone"></i>
          </button>
        </div>`;
    });
  } catch(e) {}
}

// Start a call
window.callUser = async (calleeId, calleeName, callType = 'audio') => {
  if (!calleeId) { toast('w','Utilisateur requis','Sélectionnez un contact.'); return; }
  try {
    await initLocalStream(callType === 'video');
    showCallUI(calleeName, callType, false);
    const callRef = await addDoc(collection(db,'calls'), {
      callerId: ME.uid, callerName: `${MY_DATA.prenom||''} ${MY_DATA.nom||''}`.trim(),
      calleeId, calleeName, type: callType,
      status: 'ringing', participants: [ME.uid, calleeId],
      createdAt: serverTimestamp()
    });
    currentCallId = callRef.id;
    peerConn = new RTCPeerConnection(ICE_SERVERS);
    localStream.getTracks().forEach(t => peerConn.addTrack(t, localStream));
    peerConn.ontrack = e => { remoteStream = e.streams[0]; const rv = $('#remoteVideo'); if (rv) rv.srcObject = remoteStream; };
    peerConn.onicecandidate = async e => {
      if (e.candidate) await addDoc(collection(db,'calls',currentCallId,'callerCandidates'), e.candidate.toJSON());
    };
    const offer = await peerConn.createOffer();
    await peerConn.setLocalDescription(offer);
    await updateDoc(callRef, { offer: { type: offer.type, sdp: offer.sdp } });

    // Listen for answer
    onSnapshot(callRef, async snap => {
      const data = snap.data();
      if (data?.answer && !peerConn.currentRemoteDescription) {
        await peerConn.setRemoteDescription(new RTCSessionDescription(data.answer));
        startCallTimer();
        $('#callStatus').textContent = 'Connecté';
      }
      if (data?.status === 'ended') endCall();
    });

    // Collect callee ICE candidates
    onSnapshot(collection(db,'calls',currentCallId,'calleeCandidates'), snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') peerConn.addIceCandidate(new RTCIceCandidate(change.doc.data()));
      });
    });

  } catch(e) { toast('e','Erreur appel',String(e.message||e)); stopLocalStream(); hideCallUI(); }
};

// Listen for incoming calls
function listenIncomingCalls() {
  onSnapshot(
    query(collection(db,'calls'), where('calleeId','==',ME.uid), where('status','==','ringing')),
    snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') showIncomingCall(change.doc.id, change.doc.data());
      });
    }
  );
}

function showIncomingCall(callId, data) {
  const el = $('#incCallPopup'); if (!el) return;
  el.innerHTML = `
    <div class="ic-head">
      <div class="ic-ava">${(data.callerName||'?')[0].toUpperCase()}</div>
      <div>
        <div class="ic-title">${esc(data.callerName||'Inconnu')}</div>
        <div class="ic-sub"><i class="fas fa-${data.type==='video'?'video':'phone'}"></i> Appel ${data.type==='video'?'vidéo':'audio'} entrant…</div>
      </div>
    </div>
    <div class="ic-btns">
      <button class="btn btn-success btn-sm" onclick="acceptCall('${callId}','${esc(data.callerName||'')}','${data.type||'audio'}')">
        <i class="fas fa-phone"></i> Décrocher
      </button>
      <button class="btn btn-danger btn-sm" onclick="rejectCall('${callId}')">
        <i class="fas fa-phone-slash"></i> Refuser
      </button>
    </div>`;
  el.classList.add('show');
  // Auto-dismiss after 30s
  setTimeout(() => { if (el.classList.contains('show')) rejectCall(callId); }, 30000);
}

window.acceptCall = async (callId, callerName, callType) => {
  $('#incCallPopup')?.classList.remove('show');
  try {
    await initLocalStream(callType === 'video');
    showCallUI(callerName, callType, true);
    currentCallId = callId;
    peerConn = new RTCPeerConnection(ICE_SERVERS);
    localStream.getTracks().forEach(t => peerConn.addTrack(t, localStream));
    peerConn.ontrack = e => { remoteStream = e.streams[0]; const rv = $('#remoteVideo'); if (rv) rv.srcObject = remoteStream; };
    peerConn.onicecandidate = async e => {
      if (e.candidate) await addDoc(collection(db,'calls',callId,'calleeCandidates'), e.candidate.toJSON());
    };
    const callDoc = await getDoc(doc(db,'calls',callId));
    const offer = callDoc.data()?.offer;
    await peerConn.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConn.createAnswer();
    await peerConn.setLocalDescription(answer);
    await updateDoc(doc(db,'calls',callId), { answer:{ type:answer.type, sdp:answer.sdp }, status:'active' });
    onSnapshot(collection(db,'calls',callId,'callerCandidates'), snap => {
      snap.docChanges().forEach(c => { if (c.type==='added') peerConn.addIceCandidate(new RTCIceCandidate(c.doc.data())); });
    });
    startCallTimer();
  } catch(e) { toast('e','Erreur','Impossible de décrocher.'); stopLocalStream(); hideCallUI(); }
};

window.rejectCall = async (callId) => {
  $('#incCallPopup')?.classList.remove('show');
  try { await updateDoc(doc(db,'calls',callId), { status:'missed' }); } catch(e) {}
};

window.endCall = async () => {
  stopCallTimer(); stopLocalStream(); hideCallUI();
  if (peerConn) { peerConn.close(); peerConn = null; }
  if (currentCallId) {
    try { await updateDoc(doc(db,'calls',currentCallId), { status:'ended' }); } catch(e) {}
    currentCallId = null;
  }
};

async function initLocalStream(video = false) {
  stopLocalStream();
  localStream = await navigator.mediaDevices.getUserMedia({ audio:true, video });
  const lv = $('#localVideo'); if (lv) { lv.srcObject = localStream; }
}
function stopLocalStream() {
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
}
function showCallUI(name, type, incoming) {
  const el = $('#callOverlay'); if (!el) return;
  el.classList.add('show');
  const callName   = el.querySelector('.call-name');   if (callName) callName.textContent = name;
  const callStatus = $('#callStatus'); if (callStatus) callStatus.textContent = incoming ? 'Appel en cours…' : 'Appel en cours…';
  const vWrap = el.querySelector('.call-video-wrap');
  if (vWrap) vWrap.classList.toggle('show', type === 'video');
}
function hideCallUI() { $('#callOverlay')?.classList.remove('show'); }

function startCallTimer() {
  callSeconds = 0;
  const timer = $('#callTimer');
  if (timer) { timer.style.display = ''; }
  callTimerInt = setInterval(() => {
    callSeconds++;
    const h = Math.floor(callSeconds/3600), m = Math.floor((callSeconds%3600)/60), s = callSeconds%60;
    const fmt = [m,s].map(v=>String(v).padStart(2,'0')).join(':');
    if (timer) timer.textContent = h > 0 ? `${h}:${fmt}` : fmt;
  }, 1000);
}
function stopCallTimer() {
  clearInterval(callTimerInt); callSeconds = 0;
  const timer = $('#callTimer'); if (timer) { timer.style.display = 'none'; timer.textContent = '00:00'; }
}

window.toggleMute = () => {
  if (!localStream) return;
  const a = localStream.getAudioTracks()[0]; if (!a) return;
  a.enabled = !a.enabled;
  const btn = $('#btnMute');
  if (btn) { btn.classList.toggle('off', !a.enabled); btn.innerHTML = `<i class="fas fa-microphone${a.enabled?'':'-slash'}"></i>`; }
};
window.toggleCamera = () => {
  if (!localStream) return;
  const v = localStream.getVideoTracks()[0]; if (!v) return;
  v.enabled = !v.enabled;
  const btn = $('#btnCam');
  if (btn) { btn.classList.toggle('off', !v.enabled); btn.innerHTML = `<i class="fas fa-${v.enabled?'video':'video-slash'}"></i>`; }
};
window.startScreenShare = async () => {
  try {
    const scrStream = await navigator.mediaDevices.getDisplayMedia({ video:true });
    const scrTrack = scrStream.getVideoTracks()[0];
    if (peerConn) {
      const sender = peerConn.getSenders().find(s => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(scrTrack);
    }
    const lv = $('#localVideo'); if (lv) lv.srcObject = scrStream;
    scrTrack.addEventListener('ended', () => { if (localStream) { const lv=$('#localVideo'); if(lv) lv.srcObject=localStream; } });
    toast('s','Partage écran','Partage d\'écran activé.');
  } catch(e) { toast('w','Partage annulé','Partage d\'écran non disponible.'); }
};

// ============================================================
// VOICE ROOMS (Discord style)
// ============================================================
async function loadVoiceRooms() {
  const el = $('#voiceRoomList'); if (!el) return;
  // Static rooms — extend with Firestore realtime for production
  const rooms = [
    { id:'general', name:'# Général', icon:'fa-hashtag' },
    { id:'word', name:'🖊 Cours Word', icon:'fa-microphone' },
    { id:'excel', name:'📊 Cours Excel', icon:'fa-microphone' },
    { id:'ppt', name:'🎨 Cours PowerPoint', icon:'fa-microphone' },
    { id:'anglais', name:'🌍 Anglais Appliqué', icon:'fa-microphone' },
  ];
  el.innerHTML = '';
  for (const r of rooms) {
    // Listen to participants in this room from Firestore
    let participantsHtml = '';
    try {
      const pSnap = await getDocs(collection(db,'voiceRooms',r.id,'participants'));
      pSnap.forEach(d => {
        const p = d.data();
        participantsHtml += `<div class="vp"><div class="vp-ava">${(p.name||'?')[0].toUpperCase()}</div>${esc(p.name||'—')}${p.muted?'<span class="vp-muted"><i class="fas fa-microphone-slash"></i></span>':''}</div>`;
      });
    } catch {}
    el.innerHTML += `
      <div class="vroom">
        <div class="vroom-head" onclick="toggleVRoom('vroom-body-${r.id}')">
          <i class="fas ${r.icon} vroom-ico"></i>
          <span class="vroom-n">${r.name}</span>
          <span class="vroom-count"><i class="fas fa-user"></i> ${participantsHtml ? '…' : '0'} <i class="fas fa-chevron-down" style="font-size:.65rem"></i></span>
        </div>
        <div class="vroom-participants" id="vroom-body-${r.id}" style="display:none">
          ${participantsHtml || '<span style="font-size:.72rem;color:var(--text-soft)">Salon vide</span>'}
        </div>
        <div style="padding:0 16px 12px;display:flex;gap:8px">
          <button class="btn btn-p btn-xs" onclick="joinVoiceRoom('${r.id}','${esc(r.name)}')">
            <i class="fas fa-sign-in-alt"></i> Rejoindre
          </button>
          <button class="btn btn-g btn-xs" onclick="leaveVoiceRoom('${r.id}')">
            <i class="fas fa-sign-out-alt"></i> Quitter
          </button>
        </div>
      </div>`;
  }
}

window.toggleVRoom = id => { const el = $(`#${id}`); if (el) el.style.display = el.style.display==='none'?'flex':'none'; };

window.joinVoiceRoom = async (roomId, roomName) => {
  try {
    await initLocalStream(false);
    const myName = `${MY_DATA.prenom||''} ${MY_DATA.nom||''}`.trim()||'Étudiant';
    await setDoc(doc(db,'voiceRooms',roomId,'participants',ME.uid), { name:myName, uid:ME.uid, muted:false, joinedAt:serverTimestamp() });
    toast('s','Salon rejoint',`Vous êtes dans "${roomName}".`);
    loadVoiceRooms();
  } catch(e) { toast('e','Erreur',String(e.message||e)); }
};

window.leaveVoiceRoom = async (roomId) => {
  try {
    await deleteDoc(doc(db,'voiceRooms',roomId,'participants',ME.uid));
    stopLocalStream();
    toast('i','Salon quitté','Vous avez quitté le salon vocal.');
    loadVoiceRooms();
  } catch(e) {}
};

// ============================================================
// FEED (Posts)
// ============================================================
let feedUnsub = null;
function loadFeed() {
  const el = $('#feedPosts'); if (!el) return;
  if (feedUnsub) feedUnsub();
  const q = query(collection(db,'posts'), orderBy('createdAt','desc'), limit(20));
  feedUnsub = onSnapshot(q, snap => {
    el.innerHTML = '';
    if (snap.empty) { el.innerHTML = '<div class="empty"><i class="fas fa-newspaper"></i><h3>Fil vide</h3></div>'; return; }
    snap.forEach(d => {
      const p = d.data(); const ini = ((p.authorName||'?')[0]).toUpperCase();
      el.innerHTML += `
        <div class="post a2">
          <div class="post-head">
            <div class="post-ava">${p.authorPhoto?`<img src="${p.authorPhoto}" alt="">`:ini}</div>
            <div>
              <div class="post-head-n">${esc(p.authorName||'JS TECH')}</div>
              <div class="post-head-t">${fmtDate(p.createdAt)} · <span class="badge ${p.type==='announcement'?'bo':'bb'}" style="font-size:.62rem">${p.type==='announcement'?'📢 Annonce':'📝 Post'}</span></div>
            </div>
          </div>
          ${p.title?`<div style="padding:0 18px 6px;font-size:.93rem;font-weight:800">${esc(p.title)}</div>`:''}
          <div class="post-body">${esc(p.content||'')}</div>
          ${p.mediaURL?`<div class="post-media"><img src="${esc(p.mediaURL)}" alt="" loading="lazy"></div>`:''}
          <div class="post-acts">
            <button class="pa ${p.likedBy?.includes(ME.uid)?'liked':''}" onclick="likePost('${d.id}',this)">
              <i class="fas fa-heart"></i> <span class="lc">${p.likes||0}</span>
            </button>
            <button class="pa" onclick="focusComment('${d.id}')">
              <i class="fas fa-comment"></i> Commenter
            </button>
            <button class="pa"><i class="fas fa-share"></i> Partager</button>
          </div>
        </div>`;
    });
  });
}

window.publishPost = async () => {
  const content = $('#postContent')?.value.trim();
  const title   = $('#postTitle')?.value.trim();
  const type    = $('#postType')?.value || 'post';
  const fileInput = $('#postMedia');
  if (!content) { toast('w','Contenu requis','Rédigez votre publication.'); return; }
  let mediaURL = '';
  if (fileInput?.files[0]) {
    try { const res = await uploadToCloudinary(fileInput.files[0],'post-media'); mediaURL = res.url; }
    catch(e) { toast('w','Upload ignoré','Impossible d\'uploader l\'image. Le post sera publié sans image.'); }
  }
  try {
    await addDoc(collection(db,'posts'), {
      title:title||'', content, type, mediaURL, likes:0, likedBy:[],
      authorName:`${MY_DATA.prenom||''} ${MY_DATA.nom||''}`.trim()||'Étudiant',
      authorId:ME.uid, authorPhoto:MY_DATA.photoURL||'',
      createdAt:serverTimestamp()
    });
    if ($('#postContent')) $('#postContent').value='';
    if ($('#postTitle'))   $('#postTitle').value='';
    if (fileInput) fileInput.value='';
    toast('s','Publié !','Votre publication est en ligne.');
  } catch(e) { toast('e','Erreur','Impossible de publier.'); }
};

window.likePost = async (id, btn) => {
  try {
    const docRef = doc(db,'posts',id); const snap = await getDoc(docRef);
    const liked = snap.data()?.likedBy?.includes(ME.uid);
    if (liked) {
      await updateDoc(docRef, { likes:increment(-1), likedBy: snap.data().likedBy.filter(u=>u!==ME.uid) });
      btn.classList.remove('liked');
      const lc = btn.querySelector('.lc'); if(lc) lc.textContent = Math.max(0,(parseInt(lc.textContent)||0)-1);
    } else {
      await updateDoc(docRef, { likes:increment(1), likedBy:[...(snap.data().likedBy||[]),ME.uid] });
      btn.classList.add('liked');
      const lc = btn.querySelector('.lc'); if(lc) lc.textContent = (parseInt(lc.textContent)||0)+1;
    }
  } catch(e) {}
};

// ============================================================
// FRIENDS
// ============================================================
async function loadFriends() { await searchFriends(''); }

async function searchFriends(q_str = '') {
  const el = $('#frGrid'); if (!el) return;
  el.innerHTML = '<div style="color:var(--text-soft);font-size:.8rem;grid-column:1/-1;text-align:center;padding:20px">Chargement…</div>';
  try {
    const snap = await getDocs(query(collection(db,'users'), limit(30)));
    el.innerHTML = '';
    let count = 0;
    snap.forEach(d => {
      if (d.id === ME.uid) return;
      const u = d.data();
      const fn = `${u.prenom||''} ${u.nom||''}`.trim()||'—';
      if (q_str && !fn.toLowerCase().includes(q_str.toLowerCase()) && !(u.matricule||'').toLowerCase().includes(q_str.toLowerCase())) return;
      const ini = ((u.prenom||'?')[0]+(u.nom||'?')[0]).toUpperCase();
      const online = Math.random() > 0.5; // Replace with real presence
      el.innerHTML += `
        <div class="fr-card">
          <div class="fr-ava">${u.photoURL?`<img src="${u.photoURL}" alt="">`:ini}<div class="fr-sdot ${online?'on':'off'}"></div></div>
          <div class="fr-n">${esc(fn)}</div>
          <div class="fr-r">${u.role==='admin'?'Admin':'Étudiant'} · ${online?'<span style="color:var(--online)">En ligne</span>':'Hors ligne'}</div>
          <div class="fr-btns">
            <button class="btn btn-p btn-xs" onclick="openChat('${d.id}','${esc(fn)}','${ini}','${u.photoURL||''}');navigateTo('messages')">
              <i class="fas fa-comment"></i>
            </button>
            <button class="btn btn-xs" style="background:var(--orange);color:#fff" onclick="callUser('${d.id}','${esc(fn)}','audio')">
              <i class="fas fa-phone"></i>
            </button>
            <button class="btn btn-g btn-xs" onclick="toast('s','Demande envoyée','Demande d\'ami envoyée à ${esc(fn)}.')">
              <i class="fas fa-user-plus"></i>
            </button>
          </div>
        </div>`;
      count++;
    });
    if (count === 0) el.innerHTML = '<div class="empty" style="grid-column:1/-1"><i class="fas fa-users-slash"></i><h3>Aucun résultat</h3></div>';
  } catch(e) { el.innerHTML = '<div class="empty" style="grid-column:1/-1"><p>Erreur de chargement.</p></div>'; }
}

// ============================================================
// NOTIFICATIONS
// ============================================================
let notifUnsub = null;
function listenNotifications() {
  const q = query(collection(db,'notifications'), where('userId','==',ME.uid), where('read','==',false));
  notifUnsub = onSnapshot(q, snap => {
    const c = snap.size;
    $$('.notif-count').forEach(el => { el.textContent = c > 9 ? '9+' : c||''; el.style.display = c > 0 ? '' : 'none'; });
    $$('.notif-dot').forEach(el => { el.style.display = c > 0 ? '' : 'none'; });
  });
}

async function loadNotifications() {
  const el = $('#notifList'); if (!el) return;
  try {
    const q = query(collection(db,'notifications'), where('userId','==',ME.uid), orderBy('createdAt','desc'), limit(35));
    const snap = await getDocs(q);
    el.innerHTML = '';
    if (snap.empty) { el.innerHTML = '<div class="empty"><i class="fas fa-bell-slash"></i><h3>Aucune notification</h3><p>Vous êtes à jour !</p></div>'; return; }
    snap.forEach(d => {
      const n = d.data();
      el.innerHTML += `
        <div class="nl-item ${n.read?'':'unread'}" onclick="markNotifRead('${d.id}',this)">
          <div class="nl-ico" style="background:${n.bg||'var(--blue-pale)'};color:${n.ic||'var(--blue)'}"><i class="fas ${n.icon||'fa-bell'}"></i></div>
          <div style="flex:1"><div class="nl-txt">${esc(n.message||'')}</div><div class="nl-t">${fmtDate(n.createdAt)}</div></div>
          ${!n.read?'<div class="nl-dot"></div>':''}
        </div>`;
    });
  } catch(e) {}
}

window.markNotifRead = async (id, el) => {
  try {
    await updateDoc(doc(db,'notifications',id), { read:true });
    el.classList.remove('unread');
    el.querySelector('.nl-dot')?.remove();
    el.style.background = '';
  } catch(e) {}
};

window.markAllRead = async () => {
  try {
    const q = query(collection(db,'notifications'), where('userId','==',ME.uid), where('read','==',false));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map(d => updateDoc(d.ref, { read:true })));
    loadNotifications(); toast('s','Tout lu','Toutes les notifications ont été marquées comme lues.');
  } catch(e) {}
};

// ============================================================
// UPLOAD (Cloud)
// ============================================================
function loadUpload() {
  const dz = $('#dropzone');
  if (!dz) return;
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag'); handleDroppedFiles(e.dataTransfer.files); });
  dz.addEventListener('click', () => $('#cloudFileInput')?.click());
}

window.handleFileInputChange = (input) => handleDroppedFiles(input.files);

async function handleDroppedFiles(files) {
  if (!files || !files.length) return;
  const prog = $('#uploadProgress'); if (prog) prog.style.display = 'block';
  const list = $('#uploadList');

  for (const file of Array.from(files)) {
    const itemId = 'up-' + Date.now() + '-' + Math.random().toString(36).substr(2,5);
    if (list) list.innerHTML += `
      <div class="up-item" id="${itemId}">
        <div class="up-icon"><i class="fas ${getFileIcon(file.type)}"></i></div>
        <div style="flex:1">
          <div class="up-name">${esc(file.name)}</div>
          <div class="up-prog">
            <div class="up-pb"><div class="up-fill" id="fill-${itemId}" style="width:0%"></div></div>
            <span class="up-pct" id="pct-${itemId}">0%</span>
          </div>
        </div>
        <span id="status-${itemId}" style="font-size:.72rem;color:var(--text-soft)">En attente…</span>
      </div>`;

    try {
      const folder = file.type.startsWith('video') ? 'videos' : file.type.startsWith('audio') ? 'audio' : file.type.startsWith('image') ? 'images' : 'documents';
      const res = await uploadToCloudinary(file, folder, pct => {
        const fill = $(`#fill-${itemId}`); if (fill) fill.style.width = pct + '%';
        const pctEl = $(`#pct-${itemId}`); if (pctEl) pctEl.textContent = pct + '%';
      });
      // Save to Firestore
      await addDoc(collection(db,'uploads'), {
        userId:ME.uid, fileName:file.name, fileSize:file.size, fileType:file.type,
        url:res.url, publicId:res.publicId, folder, uploadedAt:serverTimestamp()
      });
      const stat = $(`#status-${itemId}`); if (stat) { stat.textContent = '✓ Terminé'; stat.style.color = 'var(--success)'; }
      toast('s','Upload réussi',file.name);
    } catch(e) {
      const stat = $(`#status-${itemId}`); if (stat) { stat.textContent = '✗ Erreur'; stat.style.color = 'var(--error)'; }
      toast('e','Erreur upload', file.name);
    }
  }
}

// ============================================================
// SETTINGS
// ============================================================
function loadSettings() {
  if ($('#setEmail'))   $('#setEmail').textContent   = MY_DATA.email||ME.email||'—';
  if ($('#setRole'))    $('#setRole').textContent    = MY_DATA.role||'student';
  if ($('#setMatri'))   $('#setMatri').textContent   = MY_DATA.matricule||'—';
  if ($('#setSession')) $('#setSession').textContent = MY_DATA.session||'—';
  if ($('#setUid'))     $('#setUid').textContent     = ME.uid?.substring(0,22)+'…';
}

// ============================================================
// HELPERS
// ============================================================
function fmtDate(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return 'À l\'instant';
    if (diff < 3600000) return `Il y a ${Math.floor(diff/60000)} min`;
    if (diff < 86400000) return `Il y a ${Math.floor(diff/3600000)}h`;
    return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'});
  } catch { return '—'; }
}

function animCount(el, from, to, suffix = '', dur = 1300) {
  if (!el || isNaN(to)) return;
  const step = (to - from) / (dur / 16); let cur = from;
  const t = setInterval(() => {
    cur += step;
    if (cur >= to) { cur = to; clearInterval(t); }
    const isInt = Number.isInteger(to);
    el.textContent = (isInt ? Math.floor(cur) : cur.toFixed(1)) + suffix;
  }, 16);
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1048576).toFixed(1) + ' MB';
}

function getFileIcon(mime) {
  if (mime.startsWith('image')) return 'fa-image';
  if (mime.startsWith('video')) return 'fa-film';
  if (mime.startsWith('audio')) return 'fa-music';
  if (mime.includes('pdf'))    return 'fa-file-pdf';
  if (mime.includes('word')||mime.includes('doc')) return 'fa-file-word';
  if (mime.includes('sheet')||mime.includes('excel')) return 'fa-file-excel';
  return 'fa-file';
}

// Enter key in chat
document.addEventListener('DOMContentLoaded', () => {
  $('#msgInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  });
});
