import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { showToast } from './utils.js';

// LOGIN
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = loginForm.querySelector('button');
        const originalText = btn.innerText;
        btn.innerText = "Verificando..."; btn.disabled = true;

        try {
            await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
            window.location.href = 'dashboard.html';
        } catch (error) {
            console.error("Error Login:", error);
            let msg = "Error desconocido";
            if (error.code === 'auth/user-not-found') msg = "Usuario no registrado";
            if (error.code === 'auth/wrong-password') msg = "Contraseña incorrecta";
            if (error.code === 'auth/invalid-email') msg = "Correo inválido";
            showToast(msg, "error");
            btn.innerText = originalText; btn.disabled = false;
        }
    });
}

// REGISTRO ADMIN (SOLO PRIMERA VEZ)
const regForm = document.getElementById('fullRegisterForm');
if (regForm) {
    regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = regForm.querySelector('button');
        btn.innerText = "Registrando..."; btn.disabled = true;

        try {
            // 1. Crear Auth
            const cred = await createUserWithEmailAndPassword(auth, document.getElementById('regEmail').value, document.getElementById('regPass').value);
            
            // 2. Crear Perfil Firestore
            const userData = {
                nombres: document.getElementById('regNombre').value,
                email: document.getElementById('regEmail').value,
                rol: 'admin',
                institucion: document.getElementById('regInst').value,
                fechaRegistro: new Date().toISOString()
            };

            await setDoc(doc(db, "users", cred.user.uid), userData);
            
            alert("Cuenta administrativa creada con éxito.");
            window.location.href = 'dashboard.html';

        } catch (error) {
            console.error("Error Registro:", error);
            showToast("Error: " + error.message, "error");
            btn.innerText = "Intentar de nuevo"; btn.disabled = false;
        }
    });
}