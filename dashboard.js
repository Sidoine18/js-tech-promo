// ============================================================
// dashboard.js — JS TECH PROMO VACANCES 2026
// Full Firebase · Real-time · Auth · Firestore
// ============================================================

import { auth, db } from './firebase-config.js';

import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  collection, query, where, orderBy, limit,
  onSnapshot, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── State ──────────────────────────────────────────────────
let currentUser   = null;
let currentUserData = null;
let activeSection = 'home';
let sidebarMini   = false;
let darkMode      = localStorage.getItem('jst-theme') === 'dark';
let chatListeners = {};

// ── DOM helpers ────────────────────────────────────────────
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// ── Preloader ──────────────────────────────────────────────
window.addEventListener('load', () => setTimeout(() => $('#preloader')?.classList.add('out'), 700));

// ── Toast ──────────────────────────────────────────────────
function toast(type, title, msg, dur = 4500) {
  const icons = { s:'fa-check-circle', e:'fa-times-circle', w:'fa-exclamation-triangle', i:'fa-info-circle' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fas ${icons[type]||'fa-info-circle'} toast-ic"></i>
    <div><div class="toast-title">${title}</div><div class="toast-body">${msg}</div></div>`;
  $('#toastBox').appendChild(el);
  el.addEventListener('click', () => { el.classList.add('out'); setTimeout(() => el.remove(), 320); });
  if (dur > 0) setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, dur);
}

// ── Theme ──────────────────────────────────────────────────
function applyTheme() {
  document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
  const btn = $('#themeBtn');
  if (btn) btn.innerHTML = `<i class="fas fa-${darkMode ? 'sun' : 'moon'}"></i>`;
}
applyTheme();

// ── Auth guard ─────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  currentUser = user;
  await loadUserData(user.uid);
  initDashboard();
});

async function loadUserData(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      currentUserData = snap.data();
    } else {
      currentUserData = {
        nom: 'Étudiant', prenom: '', matricule: '—',
        role: 'student', email: currentUser.email, session: 'PROMO VACANCES 2026'
      };
    }
  } catch(e) {
    console.warn('loadUserData:', e);
    currentUserData = { nom: 'Utilisateur', prenom: '', role: 'student' };
  }
}

// ── Init ───────────────────────────────────────────────────
function initDashboard() {
  populateUserUI();
  setupNavigation();
  setupThemeToggle();
  setupSidebarToggle();
  setupHamburger();
  setupSearch();
  loadSection('home');
  listenNotifications();
}

function populateUserUI() {
  const fullName = `${currentUserData.prenom||''} ${currentUserData.nom||''}`.trim() || 'Étudiant';
  const initials = ((currentUserData.prenom||'?')[0] + (currentUserData.nom||'?')[0]).toUpperCase();
  const role = currentUserData.role === 'admin' ? 'Administrateur' : currentUserData.role === 'trainer' ? 'Formateur' : 'Étudiant';

  $$('.sb-user-name-val').forEach(el => el.textContent = fullName);
  $$('.sb-user-role-val').forEach(el => el.textContent = role);
  $$('.sb-avatar-initials').forEach(el => el.textContent = initials);
  $$('.tb-avatar-initials').forEach(el => el.textContent = initials);

  if (currentUserData.role === 'admin') {
    $$('.admin-only').forEach(el => el.style.display = '');
    $$('.student-only').forEach(el => el.style.display = 'none');
  }
}

// ── Navigation ─────────────────────────────────────────────
function setupNavigation() {
  $$('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      navigateTo(page);
      // close mobile
      if (window.innerWidth < 900) {
        $('#sidebar').classList.remove('mobile-open');
        $('#sidebarOverlay').classList.remove('show');
      }
    });
  });
}

function navigateTo(page) {
  activeSection = page;
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  $$('.page-section').forEach(s => s.classList.toggle('active', s.id === `sec-${page}`));
  loadSection(page);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function loadSection(page) {
  const loaders = {
    home:          loadHome,
    profile:       loadProfile,
    attendance:    loadAttendance,
    grades:        loadGrades,
    evaluations:   loadEvaluations,
    bulletins:     loadBulletins,
    messages:      loadMessages,
    notifications: loadNotifications,
    friends:       loadFriends,
    feed:          loadFeed,
    settings:      loadSettings,
  };
  if (loaders[page]) loaders[page]();
}

// ── Sidebar toggle ─────────────────────────────────────────
function setupSidebarToggle() {
  $('#sidebarToggle')?.addEventListener('click', () => {
    sidebarMini = !sidebarMini;
    $('#sidebar').classList.toggle('mini', sidebarMini);
    $('#mainWrap').classList.toggle('expanded', sidebarMini);
    const icon = $('#sidebarToggle').querySelector('i');
    if (icon) icon.className = `fas fa-${sidebarMini ? 'chevron-right' : 'chevron-left'}`;
  });
}

function setupHamburger() {
  $('#hamburgerBtn')?.addEventListener('click', () => {
    $('#sidebar').classList.toggle('mobile-open');
    $('#sidebarOverlay').classList.toggle('show');
  });
  $('#sidebarOverlay')?.addEventListener('click', () => {
    $('#sidebar').classList.remove('mobile-open');
    $('#sidebarOverlay').classList.remove('show');
  });
}

// ── Theme toggle ───────────────────────────────────────────
function setupThemeToggle() {
  $('#themeBtn')?.addEventListener('click', () => {
    darkMode = !darkMode;
    localStorage.setItem('jst-theme', darkMode ? 'dark' : 'light');
    applyTheme();
  });
}

// ── Search ─────────────────────────────────────────────────
function setupSearch() {
  $('#topSearch')?.addEventListener('input', e => {
    const v = e.target.value.trim().toLowerCase();
    if (v.length < 2) return;
    // Basic page search hints
    const pages = ['home','profile','attendance','grades','evaluations','bulletins','messages','notifications','friends','feed','settings'];
    const match = pages.find(p => p.includes(v));
    if (match) {/* could show suggestion */}
  });
}

// ── Sign out ────────────────────────────────────────────────
window.doSignOut = async () => {
  if (!confirm('Se déconnecter ?')) return;
  try { await signOut(auth); window.location.href = 'login.html'; }
  catch(e) { toast('e', 'Erreur', 'Impossible de se déconnecter.'); }
};

// ============================================================
// HOME
// ============================================================
async function loadHome() {
  const fullName = `${currentUserData.prenom||''} ${currentUserData.nom||''}`.trim();
  const el = $('#homeWelcome');
  if (el) el.textContent = `Bonjour, ${fullName || 'Étudiant'} 👋`;

  // Load stats
  await Promise.all([
    loadHomeStats(),
    loadRecentActivity(),
    loadHomeAnnouncements()
  ]);
}

async function loadHomeStats() {
  try {
    if (!currentUserData.matricule || currentUserData.matricule === '—') return;

    // Attendance stats
    const attQ = query(collection(db,'attendance'), where('matricule','==', currentUserData.matricule));
    const attSnap = await getDocs(attQ);
    let present=0, absent=0;
    attSnap.forEach(d => { const v = d.data().status; if (v==='present') present++; else absent++; });
    const total = present + absent;
    const rate  = total > 0 ? Math.round(present/total*100) : 0;

    const attEl = $('#statAttendance');
    if (attEl) { attEl.textContent = rate + '%'; animateCount(attEl, 0, rate, '%'); }

    // Grades stats
    const grQ = query(collection(db,'grades'), where('matricule','==', currentUserData.matricule));
    const grSnap = await getDocs(grQ);
    let total_grade = 0, count = 0;
    grSnap.forEach(d => { const g = parseFloat(d.data().note); if (!isNaN(g)) { total_grade += g; count++; } });
    const avg = count > 0 ? (total_grade/count).toFixed(1) : '—';
    const avgEl = $('#statAverage');
    if (avgEl && count > 0) { animateCount(avgEl, 0, parseFloat(avg), '/20'); }
    else if (avgEl) avgEl.textContent = '—';

    // Progress bar
    const pb = $('#homeProgressBar');
    if (pb && count > 0) pb.style.width = Math.min(100, parseFloat(avg)*5) + '%';

  } catch(e) { console.warn('loadHomeStats:', e); }
}

async function loadRecentActivity() {
  const container = $('#recentActivity');
  if (!container) return;
  try {
    const q = query(collection(db,'notifications'), where('userId','==', currentUser.uid), orderBy('createdAt','desc'), limit(5));
    const snap = await getDocs(q);
    if (snap.empty) { container.innerHTML = '<div class="empty-state"><i class="fas fa-bell-slash"></i><p>Aucune activité récente.</p></div>'; return; }
    container.innerHTML = '';
    snap.forEach(d => {
      const n = d.data();
      container.innerHTML += `
        <div class="notif-item ${n.read?'':'unread'}">
          <div class="notif-icon" style="background:${n.color||'var(--blue-pale)'};color:${n.iconColor||'var(--blue)'}">
            <i class="fas ${n.icon||'fa-bell'}"></i>
          </div>
          <div class="notif-text">${n.message||''}
            <div class="notif-time">${formatDate(n.createdAt)}</div>
          </div>
          ${!n.read ? '<div class="notif-unread-dot"></div>' : ''}
        </div>`;
    });
  } catch(e) { container.innerHTML = '<div class="empty-state"><p>Chargement...</p></div>'; }
}

async function loadHomeAnnouncements() {
  const container = $('#homeAnnouncements');
  if (!container) return;
  try {
    const q = query(collection(db,'posts'), where('type','==','announcement'), orderBy('createdAt','desc'), limit(3));
    const snap = await getDocs(q);
    if (snap.empty) { container.innerHTML = '<p style="font-size:.82rem;color:var(--text-soft);text-align:center;padding:20px">Aucune annonce.</p>'; return; }
    container.innerHTML = '';
    snap.forEach(d => {
      const p = d.data();
      container.innerHTML += `
        <div style="padding:12px 0;border-bottom:1px solid var(--border-soft)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
            <span class="badge badge-orange" style="font-size:.65rem"><i class="fas fa-megaphone"></i> Annonce</span>
            <span style="font-size:.7rem;color:var(--text-soft)">${formatDate(p.createdAt)}</span>
          </div>
          <div style="font-size:.85rem;font-weight:700;color:var(--text)">${p.title||''}</div>
          <div style="font-size:.78rem;color:var(--text-mid);margin-top:4px">${(p.content||'').substring(0,120)}...</div>
        </div>`;
    });
  } catch(e) { console.warn(e); }
}

// ============================================================
// ATTENDANCE
// ============================================================
async function loadAttendance() {
  const container = $('#attendanceTable');
  if (!container) return;

  const isAdmin = currentUserData.role === 'admin' || currentUserData.role === 'trainer';

  try {
    let q;
    if (isAdmin) {
      q = query(collection(db,'attendance'), orderBy('date','desc'), limit(50));
    } else {
      q = query(collection(db,'attendance'), where('matricule','==', currentUserData.matricule||''), orderBy('date','desc'));
    }
    const snap = await getDocs(q);
    if (snap.empty) { container.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-soft)">Aucune donnée de présence.</td></tr>'; return; }
    container.innerHTML = '';
    let p=0, a=0, l=0;
    snap.forEach(d => {
      const r = d.data();
      const statusMap = { present:'<span class="badge badge-green">✓ Présent</span>', absent:'<span class="badge badge-red">✗ Absent</span>', late:'<span class="badge badge-warning">⚠ Retard</span>' };
      if (r.status==='present') p++; else if (r.status==='absent') a++; else l++;
      container.innerHTML += `
        <tr>
          <td>${formatDate(r.date)}</td>
          <td>${r.module||'—'}</td>
          ${isAdmin ? `<td>${r.studentName||r.matricule||'—'}</td>` : ''}
          <td>${statusMap[r.status]||r.status}</td>
          <td style="color:var(--text-soft);font-size:.75rem">${r.note||'—'}</td>
        </tr>`;
    });
    const tot = p+a+l;
    const rate = tot > 0 ? Math.round(p/tot*100) : 0;
    if ($('#attRate'))  animateCount($('#attRate'),  0, rate, '%');
    if ($('#attP'))     animateCount($('#attP'),     0, p, '');
    if ($('#attA'))     animateCount($('#attA'),     0, a, '');
    if ($('#attRateBar')) $('#attRateBar').style.width = rate + '%';
  } catch(e) { console.warn('loadAttendance:', e); toast('e','Erreur','Impossible de charger les présences.'); }
}

// Admin: mark attendance
window.markAttendance = async () => {
  const matri   = $('#attMatriInput')?.value.trim().toUpperCase();
  const date    = $('#attDateInput')?.value;
  const module  = $('#attModuleSelect')?.value;
  const status  = $('#attStatusSelect')?.value;
  const note    = $('#attNoteInput')?.value.trim();

  if (!matri || !date || !module || !status) { toast('w','Champs requis','Remplissez tous les champs obligatoires.'); return; }

  try {
    await addDoc(collection(db,'attendance'), {
      matricule: matri, date, module, status, note: note||'',
      markedBy: currentUser.uid, createdAt: serverTimestamp()
    });
    toast('s','Présence enregistrée',`Présence de ${matri} marquée : ${status}`);
    loadAttendance();
  } catch(e) { toast('e','Erreur','Impossible d\'enregistrer.'); }
};

// ============================================================
// GRADES
// ============================================================
async function loadGrades() {
  const container = $('#gradesTableBody');
  const cardsEl   = $('#gradeCards');
  if (!container) return;

  const modules = ['Word','Excel','PowerPoint','Anglais'];
  const modKeys  = ['word','excel','powerpoint','anglais'];
  const modColors = ['word','excel','ppt','english'];
  let modTotals  = {}, modCounts = {};

  try {
    const q = currentUserData.role === 'admin'
      ? query(collection(db,'grades'), orderBy('createdAt','desc'), limit(100))
      : query(collection(db,'grades'), where('matricule','==', currentUserData.matricule||''));

    const snap = await getDocs(q);
    container.innerHTML = '';

    if (snap.empty) { container.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text-soft)">Aucune note enregistrée.</td></tr>'; }

    snap.forEach(d => {
      const g = d.data();
      const note = parseFloat(g.note);
      const mKey = (g.module||'').toLowerCase().replace(/\s/g,'');
      if (!isNaN(note)) { modTotals[mKey] = (modTotals[mKey]||0) + note; modCounts[mKey] = (modCounts[mKey]||0) + 1; }
      const mention = getMention(note);
      container.innerHTML += `
        <tr>
          <td>${g.studentName||g.matricule||'—'}</td>
          <td><span class="badge badge-blue">${g.module||'—'}</span></td>
          <td><strong>${isNaN(note)?'—':note+'/20'}</strong></td>
          <td><span class="badge ${mention.badge}">${mention.label}</span></td>
        </tr>`;
    });

    // Update module cards
    modules.forEach((m, i) => {
      const k = modKeys[i];
      const avg = modCounts[k] ? (modTotals[k]/modCounts[k]).toFixed(1) : '—';
      const el = $(`#grade-${k}`);
      if (el) { el.textContent = avg === '—' ? '—' : avg + '/20'; }
    });

  } catch(e) { console.warn('loadGrades:', e); }
}

function getMention(note) {
  if (isNaN(note) || note === null) return { label:'—', badge:'badge-gray' };
  if (note >= 16) return { label:'Très Bien', badge:'badge-green' };
  if (note >= 14) return { label:'Bien', badge:'badge-blue' };
  if (note >= 12) return { label:'Assez Bien', badge:'badge-orange' };
  if (note >= 10) return { label:'Passable', badge:'badge-warning' };
  return { label:'Insuffisant', badge:'badge-red' };
}

// Admin: add grade
window.addGrade = async () => {
  const matri  = $('#gradeMatri')?.value.trim().toUpperCase();
  const module = $('#gradeModule')?.value;
  const note   = parseFloat($('#gradeNote')?.value);
  const eval_  = $('#gradeEval')?.value.trim();
  const name   = $('#gradeStudentName')?.value.trim();

  if (!matri || !module || isNaN(note)) { toast('w','Champs requis','Matricule, module et note sont obligatoires.'); return; }
  if (note < 0 || note > 20) { toast('w','Note invalide','La note doit être entre 0 et 20.'); return; }

  try {
    await addDoc(collection(db,'grades'), {
      matricule: matri, module, note, evaluation: eval_||'', studentName: name||matri,
      addedBy: currentUser.uid, createdAt: serverTimestamp()
    });
    toast('s','Note enregistrée',`${note}/20 en ${module} pour ${matri}`);
    loadGrades();
  } catch(e) { toast('e','Erreur','Impossible d\'enregistrer la note.'); }
};

// ============================================================
// EVALUATIONS
// ============================================================
async function loadEvaluations() {
  const container = $('#evalList');
  if (!container) return;
  try {
    const q = query(collection(db,'evaluations'), orderBy('dueDate','asc'));
    const snap = await getDocs(q);
    if (snap.empty) { container.innerHTML = '<div class="empty-state"><i class="fas fa-clipboard-list"></i><h3>Aucune évaluation</h3><p>Les prochaines évaluations apparaîtront ici.</p></div>'; return; }
    container.innerHTML = '';
    snap.forEach(d => {
      const e = d.data();
      const typeColors = { devoir:'badge-blue', controle:'badge-orange', examen:'badge-red', tp:'badge-green' };
      const isPast = e.dueDate && new Date(e.dueDate) < new Date();
      container.innerHTML += `
        <div class="eval-card anim-2">
          <div class="eval-type" style="color:var(--blue)">${e.type||'Évaluation'}</div>
          <div class="eval-title">${e.title||'—'}</div>
          <div class="eval-meta">
            <span><i class="fas fa-book"></i> ${e.module||'—'}</span>
            <span><i class="fas fa-calendar"></i> ${e.dueDate||'—'}</span>
            <span><i class="fas fa-star"></i> ${e.coefficient||1} coeff.</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <span class="badge ${typeColors[e.type]||'badge-gray'}">${e.type||'—'}</span>
            <span class="badge ${isPast ? 'badge-gray' : 'badge-green'}">${isPast ? 'Terminé' : 'À venir'}</span>
          </div>
        </div>`;
    });
  } catch(e) { console.warn('loadEvaluations:', e); }
}

window.addEvaluation = async () => {
  const title  = $('#evalTitle')?.value.trim();
  const type   = $('#evalType')?.value;
  const module = $('#evalModule')?.value;
  const date   = $('#evalDate')?.value;
  const coeff  = $('#evalCoeff')?.value || 1;
  const desc   = $('#evalDesc')?.value.trim();

  if (!title || !type || !module || !date) { toast('w','Champs requis','Remplissez tous les champs.'); return; }
  try {
    await addDoc(collection(db,'evaluations'), { title, type, module, dueDate: date, coefficient: parseFloat(coeff), description: desc||'', createdBy: currentUser.uid, createdAt: serverTimestamp() });
    toast('s','Évaluation créée', `"${title}" ajoutée avec succès.`);
    loadEvaluations();
  } catch(e) { toast('e','Erreur','Impossible de créer l\'évaluation.'); }
};

// ============================================================
// BULLETINS
// ============================================================
async function loadBulletins() {
  const container = $('#bulletinStudentList');
  if (!container) return;

  if (currentUserData.role !== 'admin') {
    await showMyBulletin();
    return;
  }

  try {
    const snap = await getDocs(query(collection(db,'students'), limit(30)));
    container.innerHTML = '';
    if (snap.empty) { container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Aucun étudiant enregistré.</p></div>'; return; }
    snap.forEach(d => {
      const s = d.data();
      const fullName = `${s.prenom||''} ${s.nom||''}`.trim();
      container.innerHTML += `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--border-soft)">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="avatar-cell" style="width:36px;height:36px;border-radius:9px;background:linear-gradient(135deg,var(--blue),var(--blue-light));display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:800;color:#fff;flex-shrink:0">${((s.prenom||'?')[0]+(s.nom||'?')[0]).toUpperCase()}</div>
            <div>
              <div style="font-size:.85rem;font-weight:700">${fullName||'—'}</div>
              <div style="font-size:.72rem;color:var(--text-soft)">${s.matricule||'—'}</div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="generateBulletin('${s.matricule}','${fullName}')">
            <i class="fas fa-file-pdf"></i> Générer
          </button>
        </div>`;
    });
  } catch(e) { console.warn('loadBulletins:', e); }
}

async function showMyBulletin() {
  if (!currentUserData.matricule || currentUserData.matricule === '—') {
    $('#bulletinPreview').innerHTML = '<div class="empty-state"><i class="fas fa-id-card"></i><h3>Matricule introuvable</h3><p>Votre profil n\'a pas de matricule.</p></div>';
    return;
  }
  await renderBulletin(currentUserData.matricule, `${currentUserData.prenom||''} ${currentUserData.nom||''}`.trim());
}

async function renderBulletin(matricule, studentName) {
  const container = $('#bulletinPreview');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-soft)"><div class="pre-ring" style="margin:0 auto"></div><p style="margin-top:12px">Génération du bulletin...</p></div>';

  try {
    const grQ = query(collection(db,'grades'), where('matricule','==', matricule));
    const snap = await getDocs(grQ);
    const grades = {};
    snap.forEach(d => {
      const g = d.data();
      const m = g.module||'—';
      if (!grades[m] || g.note > grades[m]) grades[m] = parseFloat(g.note)||0;
    });

    const modules = ['Word','Excel','PowerPoint','Anglais'];
    const coeffs  = { Word:3, Excel:4, PowerPoint:2, Anglais:3 };
    let totalPts = 0, totalCoeff = 0;
    modules.forEach(m => {
      const note = grades[m] || 0;
      const c = coeffs[m] || 1;
      totalPts   += note * c;
      totalCoeff += c;
    });
    const avg = totalCoeff > 0 ? (totalPts/totalCoeff).toFixed(2) : '0.00';
    const mention = parseFloat(avg) >= 16 ? 'Très Bien' : parseFloat(avg) >= 14 ? 'Bien' : parseFloat(avg) >= 12 ? 'Assez Bien' : parseFloat(avg) >= 10 ? 'Passable' : 'Insuffisant';

    const today = new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'});

    container.innerHTML = `
      <div class="bulletin-preview" id="theBulletin">
        <div class="bull-header">
          <div class="bull-logo">J</div>
          <div class="bull-school">
            <h2>JS TECH — PROMO VACANCES 2026</h2>
            <p>Plateforme Éducative Numérique · Cotonou, Bénin</p>
          </div>
        </div>
        <div class="bull-body">
          <div class="bull-section">
            <div class="bull-section-title">Bulletin de Notes</div>
            <div class="bull-info-grid">
              <div class="bull-info-item"><label>Étudiant :</label> <span>${studentName}</span></div>
              <div class="bull-info-item"><label>Matricule :</label> <span>${matricule}</span></div>
              <div class="bull-info-item"><label>Session :</label> <span>${currentUserData.session||'PROMO VACANCES 2026'}</span></div>
              <div class="bull-info-item"><label>Date :</label> <span>${today}</span></div>
            </div>
          </div>
          <div class="bull-section">
            <div class="bull-section-title">Résultats par Module</div>
            <table class="bull-table">
              <thead><tr><th>Module</th><th>Note /20</th><th>Coeff.</th><th>Points</th><th>Mention</th></tr></thead>
              <tbody>
                ${modules.map(m => {
                  const note = grades[m] !== undefined ? grades[m].toFixed(1) : '—';
                  const pts  = grades[m] !== undefined ? (grades[m]*coeffs[m]).toFixed(1) : '—';
                  const mc   = getMention(parseFloat(note));
                  return `<tr><td>${m}</td><td><strong>${note}</strong></td><td>${coeffs[m]}</td><td>${pts}</td><td>${mc.label}</td></tr>`;
                }).join('')}
                <tr class="bull-avg-row"><td><strong>Moyenne Générale</strong></td><td><strong>${avg}/20</strong></td><td>${totalCoeff}</td><td><strong>${totalPts.toFixed(1)}</strong></td><td><strong>${mention}</strong></td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="bull-footer">
          <div class="bull-sign">
            <div style="font-size:.75rem;color:#666">Signature Direction</div>
            <div class="bull-sign-line"></div>
            <div style="font-size:.75rem">JS TECH</div>
          </div>
          <div style="text-align:center;font-size:.72rem;color:#999">Bulletin généré le ${today}</div>
          <div class="bull-sign">
            <div style="font-size:.75rem;color:#666">Cachet & Validation</div>
            <div class="bull-sign-line"></div>
            <div style="font-size:.72rem;color:#0A3D91;font-weight:700">Officiel ✓</div>
          </div>
        </div>
      </div>`;
  } catch(e) { container.innerHTML = '<div class="empty-state"><p>Impossible de générer le bulletin.</p></div>'; }
}

window.generateBulletin = (matricule, name) => renderBulletin(matricule, name);

window.printBulletin = () => {
  const el = document.getElementById('theBulletin');
  if (!el) { toast('w','Bulletin introuvable','Générez d\'abord un bulletin.'); return; }
  const win = window.open('','_blank');
  win.document.write(`<html><head><title>Bulletin</title><style>body{font-family:'Times New Roman',serif;margin:0;padding:20px;}</style></head><body>${el.outerHTML}</body></html>`);
  win.document.close(); win.print();
};

// ============================================================
// MESSAGES
// ============================================================
let selectedChat = null;
let msgUnsubscribe = null;

async function loadMessages() {
  await loadConversationList();
}

async function loadConversationList() {
  const container = $('#chatList');
  if (!container) return;
  try {
    const snap = await getDocs(query(collection(db,'users'), limit(20)));
    container.innerHTML = '';
    snap.forEach(d => {
      if (d.id === currentUser.uid) return;
      const u = d.data();
      const initials = ((u.prenom||'?')[0]+(u.nom||'?')[0]).toUpperCase();
      const fullName = `${u.prenom||''} ${u.nom||''}`.trim()||'—';
      container.innerHTML += `
        <div class="chat-item" data-uid="${d.id}" onclick="openChat('${d.id}','${fullName}','${initials}')">
          <div class="chat-item-avatar">${initials}<div class="chat-item-online"></div></div>
          <div style="flex:1;min-width:0">
            <div class="chat-item-name">${fullName}</div>
            <div class="chat-item-preview">${u.role||'Étudiant'}</div>
          </div>
          <div class="chat-item-time">—</div>
        </div>`;
    });
  } catch(e) { console.warn('loadConversationList:', e); }
}

window.openChat = (uid, name, initials) => {
  selectedChat = uid;
  $$('.chat-item').forEach(i => i.classList.toggle('active', i.dataset.uid === uid));
  const header = $('#chatHeaderName');
  const status = $('#chatHeaderStatus');
  if (header) header.textContent = name;
  if (status) { status.textContent = '● En ligne'; status.style.color = 'var(--success)'; }

  const chatAvatar = $('#chatHeaderAvatar');
  if (chatAvatar) chatAvatar.textContent = initials;

  if (msgUnsubscribe) msgUnsubscribe();
  const convId = [currentUser.uid, uid].sort().join('_');
  const q = query(collection(db,'messages',convId,'msgs'), orderBy('createdAt','asc'), limit(50));
  msgUnsubscribe = onSnapshot(q, snap => {
    const msgs = $('#chatMessages');
    if (!msgs) return;
    msgs.innerHTML = '';
    snap.forEach(d => {
      const m = d.data();
      const isOwn = m.senderId === currentUser.uid;
      const myInitials = `${(currentUserData.prenom||'?')[0]}${(currentUserData.nom||'?')[0]}`.toUpperCase();
      msgs.innerHTML += `
        <div class="msg-row ${isOwn?'own':''}">
          <div class="msg-avatar">${isOwn ? myInitials : initials}</div>
          <div>
            <div class="msg-bubble">${m.text||''}</div>
            <div class="msg-time">${formatDate(m.createdAt)}</div>
          </div>
        </div>`;
    });
    msgs.scrollTop = msgs.scrollHeight;
  });
};

window.sendMessage = async () => {
  if (!selectedChat) { toast('w','Sélectionnez','Choisissez une conversation.'); return; }
  const input = $('#msgInput');
  const text = input?.value.trim();
  if (!text) return;
  input.value = '';
  const convId = [currentUser.uid, selectedChat].sort().join('_');
  try {
    await addDoc(collection(db,'messages',convId,'msgs'), {
      text, senderId: currentUser.uid,
      senderName: `${currentUserData.prenom||''} ${currentUserData.nom||''}`.trim(),
      createdAt: serverTimestamp()
    });
  } catch(e) { toast('e','Erreur','Message non envoyé.'); }
};

// ============================================================
// NOTIFICATIONS
// ============================================================
let notifUnsubscribe = null;

function listenNotifications() {
  const q = query(collection(db,'notifications'), where('userId','==', currentUser.uid), where('read','==', false));
  notifUnsubscribe = onSnapshot(q, snap => {
    const count = snap.size;
    $$('.notif-count').forEach(el => {
      el.textContent = count > 0 ? (count > 9 ? '9+' : count) : '';
      el.style.display = count > 0 ? '' : 'none';
    });
    const dot = $('#tbNotifDot');
    if (dot) dot.style.display = count > 0 ? '' : 'none';
  });
}

async function loadNotifications() {
  const container = $('#notifList');
  if (!container) return;
  try {
    const q = query(collection(db,'notifications'), where('userId','==', currentUser.uid), orderBy('createdAt','desc'), limit(30));
    const snap = await getDocs(q);
    if (snap.empty) { container.innerHTML = '<div class="empty-state"><i class="fas fa-bell-slash"></i><h3>Aucune notification</h3><p>Vous êtes à jour !</p></div>'; return; }
    container.innerHTML = '';
    snap.forEach(d => {
      const n = d.data();
      container.innerHTML += `
        <div class="notif-item ${n.read?'':'unread'}" onclick="markNotifRead('${d.id}',this)">
          <div class="notif-icon" style="background:${n.bg||'var(--blue-pale)'};color:${n.ic||'var(--blue)'}">
            <i class="fas ${n.icon||'fa-bell'}"></i>
          </div>
          <div style="flex:1">
            <div class="notif-text">${n.message||''}</div>
            <div class="notif-time">${formatDate(n.createdAt)}</div>
          </div>
          ${!n.read ? '<div class="notif-unread-dot"></div>' : ''}
        </div>`;
    });
  } catch(e) { console.warn('loadNotifications:', e); }
}

window.markNotifRead = async (id, el) => {
  try {
    await updateDoc(doc(db,'notifications', id), { read: true });
    el.classList.remove('unread');
    el.querySelector('.notif-unread-dot')?.remove();
    el.querySelector('[style*="inset"]')?.remove();
  } catch(e) {}
};

window.markAllNotifRead = async () => {
  try {
    const q = query(collection(db,'notifications'), where('userId','==', currentUser.uid), where('read','==',false));
    const snap = await getDocs(q);
    const promises = snap.docs.map(d => updateDoc(d.ref, { read: true }));
    await Promise.all(promises);
    loadNotifications();
    toast('s','Tout lu','Toutes les notifications sont marquées comme lues.');
  } catch(e) { toast('e','Erreur','Impossible de mettre à jour.'); }
};

// ============================================================
// FRIENDS
// ============================================================
async function loadFriends() {
  const container = $('#friendsList');
  const suggested = $('#suggestedFriends');
  if (!container) return;
  try {
    const snap = await getDocs(query(collection(db,'users'), limit(20)));
    container.innerHTML = '';
    const online = ['online','online','offline','online','offline','offline','online','offline'];
    let i = 0;
    snap.forEach(d => {
      if (d.id === currentUser.uid) return;
      const u = d.data();
      const fn = `${u.prenom||''} ${u.nom||''}`.trim()||'—';
      const ini = ((u.prenom||'?')[0]+(u.nom||'?')[0]).toUpperCase();
      const st = online[i%online.length]; i++;
      container.innerHTML += `
        <div class="friend-card">
          <div class="friend-card-avatar">${ini}<div class="friend-status-dot ${st}"></div></div>
          <div class="friend-name">${fn}</div>
          <div class="friend-role">${u.role==='admin'?'Admin':u.role==='trainer'?'Formateur':'Étudiant'} · ${st==='online'?'<span style="color:var(--success)">En ligne</span>':'Hors ligne'}</div>
          <div class="friend-btns">
            <button class="btn btn-primary btn-sm" onclick="openChat('${d.id}','${fn}','${ini}');navigateTo('messages')">
              <i class="fas fa-comment"></i>
            </button>
            <button class="btn btn-ghost btn-sm" onclick="toast('s','Demande envoyée','Demande d\'ami envoyée à ${fn}.')">
              <i class="fas fa-user-plus"></i>
            </button>
          </div>
        </div>`;
    });
    if (i === 0) container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Aucun autre utilisateur.</p></div>';
  } catch(e) { console.warn('loadFriends:', e); }
}

// ============================================================
// FEED (Annonces)
// ============================================================
async function loadFeed() {
  const container = $('#feedContainer');
  if (!container) return;
  try {
    const q = query(collection(db,'posts'), orderBy('createdAt','desc'), limit(20));
    onSnapshot(q, snap => {
      container.innerHTML = '';
      if (snap.empty) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-newspaper"></i><h3>Fil vide</h3><p>Aucune publication pour le moment.</p></div>';
        return;
      }
      snap.forEach(d => {
        const p = d.data();
        const ini = ((p.authorName||'?')[0]).toUpperCase();
        container.innerHTML += `
          <div class="post-card">
            <div class="post-head">
              <div class="post-head-avatar">${ini}</div>
              <div>
                <div class="post-head-name">${p.authorName||'Admin JS TECH'}</div>
                <div class="post-head-time">${formatDate(p.createdAt)}</div>
              </div>
              <div class="post-head-badge">
                <span class="badge ${p.type==='announcement'?'badge-orange':'badge-blue'}">${p.type==='announcement'?'📢 Annonce':'📝 Publication'}</span>
              </div>
            </div>
            ${p.title ? `<div style="padding:0 20px 8px;font-size:.95rem;font-weight:800;color:var(--text)">${p.title}</div>` : ''}
            <div class="post-body">${p.content||''}</div>
            ${p.emoji ? `<div class="post-img">${p.emoji}</div>` : ''}
            <div class="post-actions">
              <button class="post-action-btn" onclick="likePost('${d.id}',this)">
                <i class="fas fa-heart"></i> <span class="like-count">${p.likes||0}</span>
              </button>
              <button class="post-action-btn" onclick="focusComment('${d.id}')">
                <i class="fas fa-comment"></i> Commenter
              </button>
              <button class="post-action-btn">
                <i class="fas fa-share"></i> Partager
              </button>
            </div>
          </div>`;
      });
    });
  } catch(e) { console.warn('loadFeed:', e); }
}

window.likePost = async (id, btn) => {
  try {
    await updateDoc(doc(db,'posts',id), { likes: increment(1) });
    btn.classList.toggle('liked');
    const c = btn.querySelector('.like-count');
    if (c) c.textContent = parseInt(c.textContent||0)+1;
  } catch(e) {}
};

window.publishPost = async () => {
  const title   = $('#postTitle')?.value.trim();
  const content = $('#postContent')?.value.trim();
  const type    = $('#postType')?.value || 'post';
  if (!content) { toast('w','Contenu requis','Rédigez votre publication.'); return; }
  try {
    await addDoc(collection(db,'posts'), {
      title: title||'', content, type, likes: 0,
      authorName: `${currentUserData.prenom||''} ${currentUserData.nom||''}`.trim()||'Admin',
      authorId: currentUser.uid, createdAt: serverTimestamp()
    });
    if ($('#postTitle'))   $('#postTitle').value = '';
    if ($('#postContent')) $('#postContent').value = '';
    toast('s','Publié !','Votre publication est en ligne.');
  } catch(e) { toast('e','Erreur','Impossible de publier.'); }
};

// ============================================================
// PROFILE
// ============================================================
async function loadProfile() {
  const fullName = `${currentUserData.prenom||''} ${currentUserData.nom||''}`.trim();
  const initials = ((currentUserData.prenom||'?')[0]+(currentUserData.nom||'?')[0]).toUpperCase();
  if ($('#profileName'))    $('#profileName').textContent    = fullName||'—';
  if ($('#profileMatri'))   $('#profileMatri').textContent   = `Matricule : ${currentUserData.matricule||'—'}`;
  if ($('#profileEmail'))   $('#profileEmail').textContent   = currentUserData.email||'—';
  if ($('#profileSession')) $('#profileSession').textContent = currentUserData.session||'—';
  if ($('#profileRole'))    $('#profileRole').textContent    = currentUserData.role||'student';
  if ($('#profileInitials'))  $('#profileInitials').textContent  = initials;
  if ($('#profileInitials2')) $('#profileInitials2').textContent = initials;
}

window.updateProfile = async () => {
  const prenom = $('#editPrenom')?.value.trim();
  const nom    = $('#editNom')?.value.trim();
  if (!prenom && !nom) { toast('w','Champs vides','Remplissez au moins un champ.'); return; }
  try {
    const update = {};
    if (prenom) update.prenom = prenom;
    if (nom)    update.nom    = nom;
    await updateDoc(doc(db,'users', currentUser.uid), update);
    Object.assign(currentUserData, update);
    toast('s','Profil mis à jour','Vos informations ont été sauvegardées.');
    loadProfile();
  } catch(e) { toast('e','Erreur','Impossible de mettre à jour le profil.'); }
};

// ============================================================
// SETTINGS
// ============================================================
function loadSettings() {
  if ($('#settingsEmail')) $('#settingsEmail').textContent = currentUserData.email||'—';
  if ($('#settingsRole'))  $('#settingsRole').textContent  = currentUserData.role||'—';
  if ($('#settingsUid'))   $('#settingsUid').textContent   = currentUser.uid?.substring(0,20)+'…';
}

// ============================================================
// ADMIN: Publish notification
// ============================================================
window.sendNotification = async () => {
  const targetUid = $('#notifTarget')?.value.trim();
  const message   = $('#notifMessage')?.value.trim();
  const icon      = $('#notifIcon')?.value || 'fa-bell';
  if (!message) { toast('w','Message requis','Saisissez le message.'); return; }
  try {
    if (targetUid) {
      await addDoc(collection(db,'notifications'), { userId: targetUid, message, icon, bg:'var(--blue-pale)', ic:'var(--blue)', read: false, createdAt: serverTimestamp() });
    } else {
      const snap = await getDocs(query(collection(db,'users'), limit(100)));
      const batch = snap.docs.map(d => addDoc(collection(db,'notifications'), { userId: d.id, message, icon, bg:'var(--blue-pale)', ic:'var(--blue)', read: false, createdAt: serverTimestamp() }));
      await Promise.all(batch);
    }
    toast('s','Notification envoyée', targetUid ? 'Message envoyé à l\'utilisateur.' : 'Message envoyé à tous les utilisateurs.');
    if ($('#notifMessage')) $('#notifMessage').value = '';
  } catch(e) { toast('e','Erreur','Impossible d\'envoyer la notification.'); }
};

// ============================================================
// HELPERS
// ============================================================
function formatDate(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'À l\'instant';
    if (diff < 3600000) return `Il y a ${Math.floor(diff/60000)} min`;
    if (diff < 86400000) return `Il y a ${Math.floor(diff/3600000)}h`;
    return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
  } catch(e) { return '—'; }
}

function animateCount(el, from, to, suffix='', duration=1400) {
  if (!el || isNaN(to)) return;
  const step = (to - from) / (duration / 16);
  let cur = from;
  const timer = setInterval(() => {
    cur += step;
    if (cur >= to) { cur = to; clearInterval(timer); }
    el.textContent = Number.isInteger(to) ? Math.floor(cur) + suffix : cur.toFixed(1) + suffix;
  }, 16);
}

// Enter key in chat input
document.addEventListener('DOMContentLoaded', () => {
  $('#msgInput')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
});
