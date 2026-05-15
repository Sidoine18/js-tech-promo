// ============================================================
// create-account.js — JS TECH PROMO VACANCES 2026
// Firebase Authentication + Firestore Student Verification
// ============================================================

import { auth, db } from './firebase-config.js';

import {
  createUserWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── State ──────────────────────────────────────────────────
let foundStudent = null;   // Firestore document data of verified student
let foundDocId   = null;   // Firestore doc ID

// ── DOM helpers ────────────────────────────────────────────
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Preloader ──────────────────────────────────────────────
window.addEventListener('load', () => {
  setTimeout(() => {
    const pre = $('#preloader');
    if (pre) pre.classList.add('hide');
  }, 900);
});

// ── Toast system ───────────────────────────────────────────
function showToast(type, title, msg, duration = 5000) {
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
  const container = $('#toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `
    <i class="fas ${icons[type] || 'fa-info-circle'} toast-icon"></i>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${msg}</div>
    </div>
    <i class="fas fa-times toast-close"></i>
  `;
  container.appendChild(t);
  t.querySelector('.toast-close').addEventListener('click', () => dismissToast(t));
  t.addEventListener('click', () => dismissToast(t));
  if (duration > 0) setTimeout(() => dismissToast(t), duration);
  return t;
}
function dismissToast(t) {
  if (!t || t.classList.contains('hide')) return;
  t.classList.add('hide');
  setTimeout(() => t.remove(), 380);
}

// ── Button loader ───────────────────────────────────────────
function setLoading(btn, state) {
  if (state) {
    btn.classList.add('loading');
    btn.disabled = true;
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ── Input validation helpers ────────────────────────────────
function setInputState(input, state) {
  input.classList.remove('valid', 'invalid');
  const statusEl = input.parentElement.querySelector('.input-status');
  if (statusEl) { statusEl.classList.remove('show', 'ok', 'err'); }
  if (state === 'valid') {
    input.classList.add('valid');
    if (statusEl) { statusEl.className = 'input-status show ok'; statusEl.innerHTML = '<i class="fas fa-check-circle"></i>'; }
  } else if (state === 'invalid') {
    input.classList.add('invalid');
    if (statusEl) { statusEl.className = 'input-status show err'; statusEl.innerHTML = '<i class="fas fa-times-circle"></i>'; }
  }
}

function setHint(id, type, msg) {
  const el = $(`#hint-${id}`);
  if (!el) return;
  el.className = `field-hint ${type}`;
  el.innerHTML = `<i class="fas ${type === 'error' ? 'fa-times-circle' : type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i> ${msg}`;
}

// ── Step management ─────────────────────────────────────────
function setStep(n) {
  $$('.step-item').forEach((s, i) => {
    s.classList.remove('active', 'done');
    if (i + 1 < n)  s.classList.add('done');
    if (i + 1 === n) s.classList.add('active');
  });
}

// ── STEP 1: Verify student ──────────────────────────────────
const verifyBtn  = $('#verifyBtn');
const step2Sec   = $('#step2Section');
const preview    = $('#studentPreview');

verifyBtn && verifyBtn.addEventListener('click', verifyStudent);

async function verifyStudent() {
  const matricule = $('#matricule').value.trim().toUpperCase();
  const phone     = $('#phone').value.trim();
  const email     = $('#emailVerif').value.trim().toLowerCase();

  // Basic check
  if (!matricule) {
    showToast('warning', 'Champ requis', 'Veuillez saisir votre matricule.');
    setInputState($('#matricule'), 'invalid');
    return;
  }
  if (!phone && !email) {
    showToast('warning', 'Identification requise', 'Saisissez votre téléphone WhatsApp ou votre email.');
    return;
  }

  setLoading(verifyBtn, true);
  setStep(1);

  try {
    const studentsRef = collection(db, 'students');
    let snap = null;

    // Query by matricule
    const qMatricule = query(studentsRef, where('matricule', '==', matricule));
    const matSnap = await getDocs(qMatricule);

    if (!matSnap.empty) {
      // Matricule found — also check phone or email
      for (const d of matSnap.docs) {
        const data = d.data();
        const phoneMatch = phone && (data.telephone === phone || data.telephone === phone.replace(/\s/g,''));
        const emailMatch = email && data.email && data.email.toLowerCase() === email;
        if (phoneMatch || emailMatch) {
          snap = d;
          break;
        }
      }
    }

    // Fallback: search by phone
    if (!snap && phone) {
      const qPhone = query(studentsRef, where('telephone', '==', phone));
      const pSnap  = await getDocs(qPhone);
      if (!pSnap.empty) snap = pSnap.docs[0];
    }

    // Fallback: search by email
    if (!snap && email) {
      const qEmail = query(studentsRef, where('email', '==', email));
      const eSnap  = await getDocs(qEmail);
      if (!eSnap.empty) snap = eSnap.docs[0];
    }

    if (!snap) {
      // Student NOT found
      setInputState($('#matricule'), 'invalid');
      showToast('error', 'Inscription introuvable',
        'Vous devez d\'abord effectuer votre inscription officielle avant de créer un compte.');
      setHint('matricule', 'error', 'Aucun étudiant trouvé avec ces informations.');
      setLoading(verifyBtn, false);
      return;
    }

    // ✅ Student found
    foundStudent = snap.data();
    foundDocId   = snap.id;

    setInputState($('#matricule'), 'valid');
    showStudentPreview(foundStudent);
    showStep2();
    setStep(2);
    showToast('success', 'Étudiant vérifié !', `Bienvenue, ${foundStudent.prenom} ${foundStudent.nom} 🎉`);

  } catch (err) {
    console.error('Verification error:', err);
    showToast('error', 'Erreur de vérification', mapFirebaseError(err.code) || 'Impossible de vérifier. Réessayez.');
  } finally {
    setLoading(verifyBtn, false);
  }
}

// ── Display student preview ─────────────────────────────────
function showStudentPreview(data) {
  const fullName = `${data.prenom || ''} ${data.nom || ''}`.trim() || 'Inconnu';
  const initials  = ((data.prenom || '?')[0] + (data.nom || '?')[0]).toUpperCase();

  $('#previewInitials').textContent = initials;
  if (data.photoURL) {
    const img = document.createElement('img');
    img.src = data.photoURL;
    img.alt = fullName;
    $('#previewInitials').style.display = 'none';
    document.querySelector('.preview-avatar').appendChild(img);
  }

  $('#previewName').textContent    = fullName;
  $('#previewMatri').textContent   = `Matricule : ${data.matricule || '—'}`;
  $('#previewSession').textContent = data.session || 'PROMO VACANCES 2026';
  $('#previewPhone').textContent   = data.telephone || '—';

  const statusBadge = $('#previewStatus');
  const ps = (data.paymentStatus || '').toLowerCase();
  if (ps === 'paid' || ps === 'payé') {
    statusBadge.className = 'badge-status paid';
    statusBadge.innerHTML = '<i class="fas fa-check-circle"></i> Payé';
  } else if (ps === 'pending' || ps === 'en attente') {
    statusBadge.className = 'badge-status pending';
    statusBadge.innerHTML = '<i class="fas fa-clock"></i> En attente';
  } else {
    statusBadge.className = 'badge-status unpaid';
    statusBadge.innerHTML = '<i class="fas fa-times-circle"></i> Non payé';
  }

  preview.classList.add('show');

  // Pre-fill email in step 2
  if (data.email) $('#email').value = data.email;
}

// ── Show step 2 ─────────────────────────────────────────────
function showStep2() {
  step2Sec.classList.add('show');
  setTimeout(() => step2Sec.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

// ── Password strength ───────────────────────────────────────
$('#password') && $('#password').addEventListener('input', function () {
  const val = this.value;
  const segs = $$('.pw-strength-seg');
  const label = $('#pwStrengthLabel');
  const strength = getPasswordStrength(val);
  segs.forEach((s, i) => {
    s.classList.remove('weak', 'medium', 'strong');
    if (i < strength.score) s.classList.add(strength.level);
  });
  if (label) label.textContent = val ? strength.label : '';
  checkPasswordMatch();
});

$('#passwordConfirm') && $('#passwordConfirm').addEventListener('input', checkPasswordMatch);

function getPasswordStrength(pw) {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { score: 1, level: 'weak',   label: '⚠ Faible — ajoutez des majuscules, chiffres et symboles' };
  if (score <= 3) return { score: 2, level: 'medium',  label: '✓ Moyen — presque bon !' };
  return { score: 3, level: 'strong', label: '✅ Fort — excellent mot de passe !' };
}

function checkPasswordMatch() {
  const p1 = $('#password').value;
  const p2 = $('#passwordConfirm').value;
  if (!p2) return;
  if (p1 === p2) {
    setInputState($('#passwordConfirm'), 'valid');
    setHint('passwordConfirm', 'success', 'Les mots de passe correspondent.');
  } else {
    setInputState($('#passwordConfirm'), 'invalid');
    setHint('passwordConfirm', 'error', 'Les mots de passe ne correspondent pas.');
  }
}

// ── Real-time email validation ──────────────────────────────
$('#email') && $('#email').addEventListener('blur', function () {
  const v = this.value.trim();
  if (!v) return;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    setInputState(this, 'valid');
    setHint('email', 'success', 'Email valide.');
  } else {
    setInputState(this, 'invalid');
    setHint('email', 'error', 'Format d\'email invalide.');
  }
});

// ── Password toggle ─────────────────────────────────────────
$$('.pw-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.closest('.input-wrap').querySelector('input');
    const isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    btn.innerHTML = `<i class="fas fa-${isText ? 'eye' : 'eye-slash'}"></i>`;
  });
});

// ── Custom checkbox ─────────────────────────────────────────
$$('.checkbox-custom').forEach(box => {
  box.addEventListener('click', () => {
    const cb = box.previousElementSibling;
    if (cb) cb.checked = !cb.checked;
  });
});

// ── STEP 2: Create account ──────────────────────────────────
const createBtn = $('#createAccountBtn');
createBtn && createBtn.addEventListener('click', createAccount);

async function createAccount() {
  if (!foundStudent) {
    showToast('error', 'Non autorisé', 'Veuillez d\'abord vérifier votre inscription.');
    return;
  }

  const username  = $('#username').value.trim();
  const email     = $('#email').value.trim().toLowerCase();
  const password  = $('#password').value;
  const passwordC = $('#passwordConfirm').value;
  const terms     = $('#termsCheck').checked;

  // Validations
  if (!username) { showToast('warning', 'Champ requis', 'Saisissez votre nom d\'utilisateur.'); setInputState($('#username'), 'invalid'); return; }
  if (username.length < 3) { showToast('warning', 'Nom trop court', 'Au moins 3 caractères.'); setInputState($('#username'), 'invalid'); return; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('warning', 'Email invalide', 'Saisissez un email valide.'); setInputState($('#email'), 'invalid'); return; }
  if (!password || password.length < 8) { showToast('warning', 'Mot de passe trop court', 'Minimum 8 caractères.'); setInputState($('#password'), 'invalid'); return; }
  if (password !== passwordC) { showToast('warning', 'Mots de passe différents', 'Les mots de passe ne correspondent pas.'); setInputState($('#passwordConfirm'), 'invalid'); return; }
  if (!terms) { showToast('warning', 'Conditions requises', 'Acceptez les conditions d\'utilisation.'); return; }

  setLoading(createBtn, true);
  setStep(3);

  try {
    // Create Firebase Auth account
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCred.user;

    // Update display name
    const displayName = `${foundStudent.prenom || ''} ${foundStudent.nom || ''}`.trim() || username;
    await updateProfile(user, { displayName });

    // Save to Firestore users collection
    const userData = {
      uid:           user.uid,
      username:      username,
      nom:           foundStudent.nom           || '',
      prenom:        foundStudent.prenom        || '',
      email:         email,
      telephone:     foundStudent.telephone     || '',
      matricule:     foundStudent.matricule     || '',
      role:          'student',
      photoURL:      foundStudent.photoURL      || '',
      createdAt:     serverTimestamp(),
      isVerified:    true,
      session:       foundStudent.session       || 'PROMO VACANCES 2026',
      paymentStatus: foundStudent.paymentStatus || '',
      studentDocId:  foundDocId
    };

    await setDoc(doc(db, 'users', user.uid), userData);

    // Show success screen
    setStep(3);
    showSuccess(user.uid, displayName);
    showToast('success', 'Compte créé !', `Votre compte étudiant est prêt, ${foundStudent.prenom} ! 🎉`, 8000);

  } catch (err) {
    console.error('Account creation error:', err);
    const msg = mapFirebaseError(err.code);
    showToast('error', 'Erreur de création', msg);
    if (err.code === 'auth/email-already-in-use') setInputState($('#email'), 'invalid');
    setStep(2);
  } finally {
    setLoading(createBtn, false);
  }
}

// ── Success screen ──────────────────────────────────────────
function showSuccess(uid, name) {
  const formCard2 = $('#formCard2');
  const successScr = $('#successScreen');
  const stepsBar   = $('.steps-bar');

  if (formCard2)  formCard2.style.display  = 'none';
  if (stepsBar)   stepsBar.style.display   = 'none';
  if (successScr) {
    successScr.classList.add('show');
    $('#successUid').textContent = `UID : ${uid.substring(0, 20)}...`;
    $('#successName').textContent = name;
  }
}

// ── Firebase error mapper ───────────────────────────────────
function mapFirebaseError(code) {
  const map = {
    'auth/email-already-in-use':   'Cet email est déjà utilisé par un autre compte.',
    'auth/invalid-email':          'L\'adresse email est invalide.',
    'auth/weak-password':          'Mot de passe trop faible (min. 6 caractères).',
    'auth/network-request-failed': 'Erreur réseau. Vérifiez votre connexion.',
    'auth/too-many-requests':      'Trop de tentatives. Réessayez dans quelques minutes.',
    'auth/operation-not-allowed':  'Cette méthode d\'authentification n\'est pas activée.',
    'permission-denied':           'Accès refusé. Vérifiez les règles Firestore.',
  };
  return map[code] || 'Une erreur inattendue est survenue. Veuillez réessayer.';
}

// ── Go to login redirect ────────────────────────────────────
window.goToLogin = function () {
  window.location.href = 'login.html';
};

// ── Username real-time check ────────────────────────────────
$('#username') && $('#username').addEventListener('input', function () {
  const v = this.value.trim();
  if (v.length >= 3) {
    setInputState(this, 'valid');
    setHint('username', 'success', 'Nom d\'utilisateur disponible.');
  } else if (v.length > 0) {
    setInputState(this, 'invalid');
    setHint('username', 'error', 'Minimum 3 caractères requis.');
  }
});
