import { db, collection, addDoc, serverTimestamp } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Preloader ---
    const preloader = document.getElementById('preloader');
    setTimeout(() => {
        preloader.style.opacity = '0';
        setTimeout(() => preloader.style.display = 'none', 500);
    }, 800);

    // --- Initialisation AOS ---
    AOS.init({
        once: true,
        offset: 50,
        duration: 800,
        easing: 'ease-in-out'
    });

    // --- Navbar & Scroll Top Logic ---
    const header = document.getElementById('header');
    const scrollTopBtn = document.getElementById('scroll-top');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
            scrollTopBtn.classList.add('show');
        } else {
            header.classList.remove('scrolled');
            scrollTopBtn.classList.remove('show');
        }
    });

    // --- Mobile Menu Toggle ---
    const mobileToggle = document.getElementById('mobile-toggle');
    const navList = document.querySelector('.nav-list');

    mobileToggle.addEventListener('click', () => {
        navList.classList.toggle('active');
        const icon = mobileToggle.querySelector('i');
        if (navList.classList.contains('active')) {
            icon.classList.replace('bx-menu', 'bx-x');
        } else {
            icon.classList.replace('bx-x', 'bx-menu');
        }
    });

    // --- Dark Mode Toggle ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;
    const themeIcon = themeToggleBtn.querySelector('i');

    // Vérifier le thème local
    if(localStorage.getItem('theme') === 'dark') {
        htmlElement.classList.add('dark');
        themeIcon.classList.replace('bx-moon', 'bx-sun');
    }

    themeToggleBtn.addEventListener('click', () => {
        htmlElement.classList.toggle('dark');
        if (htmlElement.classList.contains('dark')) {
            localStorage.setItem('theme', 'dark');
            themeIcon.classList.replace('bx-moon', 'bx-sun');
        } else {
            localStorage.setItem('theme', 'light');
            themeIcon.classList.replace('bx-sun', 'bx-moon');
        }
    });

    // --- Toast Notification System ---
    const showToast = (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? "<i class='bx bx-check-circle' style='color:#27c93f;font-size:1.5rem'></i>" : "<i class='bx bx-error-circle' style='color:#ff5f56;font-size:1.5rem'></i>";
        
        toast.innerHTML = `${icon} <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    };

    // --- Firebase Registration Logic ---
    const registrationForm = document.getElementById('registration-form');
    
    registrationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = registrationForm.querySelector('button');
        const originalText = btn.innerHTML;
        btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Traitement...";
        btn.disabled = true;

        const inputs = registrationForm.querySelectorAll('.form-input');
        const nom = inputs[0].value;
        const email = inputs[1].value;
        const statut = inputs[2].value;

        try {
            await addDoc(collection(db, "inscriptions_promo_2026"), {
                nomComplet: nom,
                email: email,
                statut: statut,
                dateInscription: serverTimestamp(),
                statutPaiement: "en_attente" // Par défaut pour le SaaS
            });

            showToast('Inscription réussie ! Bienvenue chez JS TECH.', 'success');
            registrationForm.reset();
        } catch (error) {
            console.error("Erreur d'inscription: ", error);
            showToast('Erreur lors de l\'inscription. Veuillez réessayer.', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
});