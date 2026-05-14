import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Configuration Firebase EXACTE
const firebaseConfig = {
  apiKey: "AIzaSyD-GqWDwWmE3g6oUrsrVZ9vGhwyn64YVkc",
  authDomain: "js-tech-978a1.firebaseapp.com",
  projectId: "js-tech-978a1",
  storageBucket: "js-tech-978a1.firebasestorage.app",
  messagingSenderId: "174162300177",
  appId: "1:174162300177:web:0a51ee1363ac8e14d610b0",
  measurementId: "G-VFWPDZPCBH"
};

// Initialisation
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth, collection, addDoc, serverTimestamp };