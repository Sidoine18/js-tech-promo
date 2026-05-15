// ============================================================
// firebase-config.js — Configuration Firebase JS TECH
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyD-GqWDwWmE3g6oUrsrVZ9vGhwyn64YVkc",
  authDomain:        "js-tech-978a1.firebaseapp.com",
  projectId:         "js-tech-978a1",
  storageBucket:     "js-tech-978a1.firebasestorage.app",
  messagingSenderId: "174162300177",
  appId:             "1:174162300177:web:0a51ee1363ac8e14d610b0",
  measurementId:     "G-VFWPDZPCBH"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
export default app;
