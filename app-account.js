import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDocs, collection, query, where, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD-GqWDwWmE3g6oUrsrVZ9vGhwyn64YVkc",
    authDomain: "js-tech-978a1.firebaseapp.com",
    projectId: "js-tech-978a1",
    storageBucket: "js-tech-978a1.firebasestorage.app",
    messagingSenderId: "174162300177",
    appId: "1:174162300177:web:0a51ee1363ac8e14d610b0",
    measurementId: "G-VFWPDZPCBH"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let verifiedStudentData = null;

// --- UTILS: TOAST NOTIFICATIONS ---
function notify(msg, type = "success") {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// --- STEP 1: VERIFICATION ---
document.getElementById('verify-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const matricule = document.getElementById('v-matricule').value.trim();
    const contact = document.getElementById('v-contact').value.trim();
    const btn = document.getElementById('btn-verify');

    btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Vérification...";
    
    try {
        const q = query(collection(db, "students"), where("matricule", "==", matricule));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            throw new Error("Matricule introuvable.");
        }

        let student = null;
        querySnapshot.forEach(doc => {
            const data = doc.data();
            // Vérification croisée avec Email ou Téléphone
            if (data.email === contact || data.telephone === contact) {
                student = data;
            }
        });

        if (!student) {
            throw new Error("Les informations ne correspondent pas à ce matricule.");
        }

        // Succès de vérification
        verifiedStudentData = student;
        showStep2(student);
        notify("Étudiant vérifié avec succès !");

    } catch (err) {
        notify(err.message, "error");
    } finally {
        btn.innerHTML = "Vérifier mon inscription";
    }
});

function showStep2(data) {
    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.remove('hidden');
    
    document.getElementById('display-name').innerText = `${data.nom} ${data.prenom}`;
    document.getElementById('display-session').innerText = `Matricule: ${data.matricule}`;
    document.getElementById('display-payment').innerText = data.paymentStatus === "ok" ? "Payé" : "En attente";
    document.getElementById('c-email').value = data.email;
}

// --- STEP 2: CREATION DE COMPTE ---
document.getElementById('create-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('c-username').value;
    const pass = document.getElementById('c-password').value;
    const confirm = document.getElementById('c-confirm').value;

    if (pass !== confirm) return notify("Les mots de passe diffèrent", "error");
    if (pass.length < 6) return notify("Minimum 6 caractères", "error");

    const btn = document.getElementById('btn-register');
    btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Création...";

    try {
        // 1. Création Auth
        const userCredential = await createUserWithEmailAndPassword(auth, verifiedStudentData.email, pass);
        const user = userCredential.user;

        // 2. Enregistrement Firestore Collection "users"
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            nom: verifiedStudentData.nom,
            prenom: verifiedStudentData.prenom,
            username: username,
            email: verifiedStudentData.email,
            telephone: verifiedStudentData.telephone,
            matricule: verifiedStudentData.matricule,
            role: "student",
            photoURL: "",
            createdAt: serverTimestamp(),
            isVerified: true,
            paymentStatus: verifiedStudentData.paymentStatus
        });

        notify("Compte créé ! Redirection...");
        setTimeout(() => window.location.href = "dashboard.html", 2000);

    } catch (err) {
        notify("Erreur: " + err.message, "error");
    } finally {
        btn.innerHTML = "Créer mon compte étudiant";
    }
});

// Preloader setup
window.addEventListener('load', () => {
    document.getElementById('preloader').style.display = 'none';
    AOS.init();
});