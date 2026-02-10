import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, deleteUser } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { showToast } from './utils.js';

// Login
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = loginForm.querySelector('button');
        try {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...'; btn.disabled = true;
            await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
            window.location.href = 'dashboard.html';
        } catch (error) {
            showToast("Error de credenciales", "error");
            btn.innerHTML = 'Ingresar'; btn.disabled = false;
        }
    });
}

// Registro Institución
const regForm = document.getElementById('fullRegisterForm');
if (regForm) {
    // Cargar pre-data
    const preData = JSON.parse(localStorage.getItem('preData'));
    if(preData) document.getElementById('regSostenimiento').value = preData.tipo;

    regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = regForm.querySelector('button');
        
        const email = document.getElementById('regEmail').value;
        const pass = document.getElementById('regPass').value;
        const nombre = document.getElementById('regNombre').value;
        const inst = document.getElementById('regInst').value;
        
        try {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...'; btn.disabled = true;
            
            // 1. Auth
            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            
            // 2. Firestore
            try {
                await setDoc(doc(db, "users", cred.user.uid), {
                    nombre: nombre,
                    email: email,
                    rol: 'admin',
                    fecha: new Date(),
                    datosInstitucion: { nombre: inst, amie: document.getElementById('regAMIE').value }
                });
                
                showToast("Registro Exitoso", "success");
                localStorage.removeItem('preData');
                setTimeout(() => window.location.href = 'dashboard.html', 1500);
            } catch (dbError) {
                await deleteUser(cred.user); // Rollback
                throw new Error("Error guardando datos. Intente de nuevo.");
            }
        } catch (error) {
            showToast(error.message, "error");
            btn.innerHTML = 'Completar Registro'; btn.disabled = false;
        }
    });
}