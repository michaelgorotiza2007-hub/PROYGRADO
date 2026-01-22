import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// === 1. CONFIGURACIÓN ===
const firebaseConfig = {
    aapiKey: "AIzaSyD5-bT6Z1JUa9yzjEiOtBGb31XhyNKfkAA",
  authDomain: "proygrado-dac9c.firebaseapp.com",
  projectId: "proygrado-dac9c",
  storageBucket: "proygrado-dac9c.firebasestorage.app",
  messagingSenderId: "1078060346645",
  appId: "1:1078060346645:web:7407634d4a39c49c408d1c"
};

const GEMINI_API_KEY = "AIzaSyBL9yP7dylPLwBdKvZWCkMH5iZJLQcxDtY"; // <--- PON TU KEY

// Inicialización segura
let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (error) {
    console.error("Error inicializando Firebase:", error);
    alert("Error crítico de configuración. Revisa la consola.");
}

// Variables Globales
let currentUser = null;
const STAFF_TOKENS = {
    teacher: "PROFE2026",
    admin: "ADMINKEY"
};

// === 2. UTILIDADES ===
window.showToast = (msg, type = 'info') => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const div = document.createElement('div');
    div.className = `toast ${type}`;
    div.innerText = msg;
    container.appendChild(div);
    setTimeout(() => div.remove(), 4000);
};

window.switchAuthMode = (mode) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    
    if (mode === 'login') {
        document.querySelector("button[onclick*='login']").classList.add('active');
        document.getElementById('form-login').classList.add('active');
    } else {
        document.querySelector("button[onclick*='register']").classList.add('active');
        document.getElementById('form-register').classList.add('active');
    }
};

window.loadSection = (secId) => {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.menu a').forEach(a => a.classList.remove('active'));
    
    const panel = document.getElementById(secId);
    if (panel) panel.classList.add('active');
    
    const link = document.querySelector(`a[onclick*='${secId}']`);
    if (link) link.classList.add('active');
};

// === 3. SISTEMA DE AUTENTICACIÓN (CORE) ===
onAuthStateChanged(auth, async (user) => {
    const loader = document.getElementById('loader-screen');
    const authView = document.getElementById('view-auth');
    const verifyView = document.getElementById('view-verify');
    const dashView = document.getElementById('view-dashboard');

    if (user) {
        try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                currentUser = { ...userSnap.data(), uid: user.uid };
                
                // Ocultar loader
                loader.style.display = 'none';
                authView.classList.remove('active');

                // Lógica de Redirección
                if (currentUser.role === 'student' && !currentUser.isVerified) {
                    // Estudiante no verificado -> Pantalla de Código
                    document.getElementById('verify-user-name').innerText = currentUser.firstName || 'Estudiante';
                    verifyView.classList.add('active');
                    dashView.classList.remove('active');
                } else {
                    // Acceso concedido
                    verifyView.classList.remove('active');
                    initDashboard(dashView);
                }
            } else {
                throw new Error("Usuario sin registro en BD");
            }
        } catch (error) {
            console.error("Error Auth:", error);
            window.showToast("Error cargando perfil. Reintente.", "error");
            signOut(auth);
            loader.style.display = 'none';
            authView.classList.add('active');
        }
    } else {
        // No logueado
        currentUser = null;
        loader.style.display = 'none';
        dashView.classList.remove('active');
        verifyView.classList.remove('active');
        authView.classList.add('active');
    }
});

// LOGIN
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    const btn = document.getElementById('btn-login');

    btn.innerText = "Verificando...";
    btn.disabled = true;

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        // onAuthStateChanged se encarga del resto
    } catch (error) {
        window.showToast("Credenciales incorrectas", "error");
        btn.innerText = "Iniciar Sesión";
        btn.disabled = false;
    }
});

// REGISTRO STAFF
document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const last = document.getElementById('reg-last').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    const role = document.getElementById('reg-role').value;
    const token = document.getElementById('reg-token').value;
    const btn = document.getElementById('btn-register');

    if (token !== STAFF_TOKENS[role]) {
        return window.showToast("Token de seguridad inválido", "error");
    }

    btn.innerText = "Creando...";
    btn.disabled = true;

    try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, "users", cred.user.uid), {
            firstName: name,
            lastName: last,
            email: email,
            role: role,
            isVerified: true, // Staff nace verificado
            createdAt: new Date()
        });
        window.showToast("Cuenta creada. Bienvenido.", "success");
    } catch (error) {
        window.showToast("Error: " + error.message, "error");
        btn.innerText = "Crear Cuenta";
        btn.disabled = false;
    }
});

// VERIFICACIÓN CÓDIGO ESTUDIANTE
document.getElementById('form-verify').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('verify-code').value.trim();
    const btn = document.getElementById('btn-verify');

    if (code === currentUser.enrollmentCode) {
        btn.innerText = "Activando...";
        try {
            await updateDoc(doc(db, "users", currentUser.uid), {
                isVerified: true
            });
            window.showToast("Cuenta activada correctamente", "success");
            location.reload(); // Recargar para entrar al dashboard limpio
        } catch (error) {
            window.showToast("Error de conexión", "error");
            btn.innerText = "Validar Código";
        }
    } else {
        window.showToast("Código incorrecto", "error");
    }
});

// === 4. LÓGICA DEL DASHBOARD ===
function initDashboard(view) {
    view.classList.add('active');
    
    // UI Básica
    document.getElementById('dash-name').innerText = currentUser.firstName;
    document.getElementById('dash-role').innerText = currentUser.role.toUpperCase();
    document.getElementById('dash-avatar').innerText = currentUser.firstName.charAt(0);

    // Filtrar Menú
    document.querySelectorAll('.role-group').forEach(el => el.style.display = 'none');
    const group = document.querySelector(`.${currentUser.role}-only`);
    if(group) group.style.display = 'block';

    // Cargar Datos Específicos
    if(currentUser.role === 'student') loadStudentUI();
    
    // Simular clic en la primera opción disponible
    const firstLink = group ? group.querySelector('a') : null;
    if(firstLink) firstLink.click();
}

function loadStudentUI() {
    document.getElementById('stu-fullname').innerText = `${currentUser.firstName} ${currentUser.lastName}`;
    document.getElementById('stu-course').innerText = currentUser.course || 'Sin Curso';
    document.getElementById('stu-gender').innerText = currentUser.gender || '-';
    document.getElementById('profile-big-initial').innerText = currentUser.firstName.charAt(0);
    
    if(currentUser.dob) {
        const age = new Date().getFullYear() - new Date(currentUser.dob).getFullYear();
        document.getElementById('stu-age').innerText = `${age} años`;
    }

    // Generar Calendario
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    for(let i=1; i<=30; i++) {
        const day = document.createElement('div');
        day.className = 'cal-day';
        day.innerHTML = `<small>${i}</small>`;
        grid.appendChild(day);
    }
}

// === 5. MATRICULACIÓN (ADMIN) ===
window.calcAge = () => {
    const dob = document.getElementById('mat-dob').value;
    if(dob) {
        const age = new Date().getFullYear() - new Date(dob).getFullYear();
        document.getElementById('mat-age').value = age + " años";
    }
};

document.getElementById('form-matricula')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if(currentUser.role !== 'admin') return;

    const btn = document.getElementById('btn-matricular');
    btn.innerText = "Procesando...";
    btn.disabled = true;

    const name = document.getElementById('mat-name').value;
    const last = document.getElementById('mat-last').value;
    const course = document.getElementById('mat-course').value;
    const dob = document.getElementById('mat-dob').value;
    const gender = document.getElementById('mat-gender').value;

    // Generar Credenciales
    const email = `${name.charAt(0).toLowerCase()}${last.toLowerCase().split(' ')[0]}@lcp.edu.ec`;
    const password = "LCP" + Math.floor(1000 + Math.random() * 9000);
    const code = "MAT-" + Math.floor(10000 + Math.random() * 90000);

    try {
        // Crear Auth
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        
        // Guardar en BD
        await setDoc(doc(db, "users", userCred.user.uid), {
            firstName: name,
            lastName: last,
            email: email,
            role: 'student',
            course: course,
            dob: dob,
            gender: gender,
            enrollmentCode: code,
            isVerified: false,
            createdAt: new Date()
        });

        // Mostrar Credenciales
        document.getElementById('res-user').innerText = email;
        document.getElementById('res-pass').innerText = password;
        document.getElementById('res-code').innerText = code;
        document.getElementById('credential-result').style.display = 'block';
        
        window.showToast("Estudiante matriculado exitosamente", "success");
        e.target.reset();

    } catch (error) {
        window.showToast("Error: " + error.message, "error");
    } finally {
        btn.innerText = "Registrar Estudiante";
        btn.disabled = false;
    }
});

// === 6. IA GEMINI (DOCENTE) ===
window.callGemini = async () => {
    const prompt = document.getElementById('ai-prompt').value;
    const display = document.getElementById('chat-display');
    const btn = document.getElementById('btn-ai-send');

    if(!prompt) return;

    display.innerHTML += `<div class="msg user">${prompt}</div>`;
    btn.disabled = true;
    document.getElementById('ai-prompt').value = '';

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ contents: [{ parts: [{ text: "Como profesor experto: " + prompt }] }] })
        });
        
        if(!response.ok) throw new Error("Error API");
        
        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        
        display.innerHTML += `<div class="msg ai">${text.replace(/\n/g, '<br>')}</div>`;
        display.scrollTop = display.scrollHeight;

    } catch (e) {
        display.innerHTML += `<div class="msg system">Error al conectar con la IA.</div>`;
    } finally {
        btn.disabled = false;
    }
};

window.logout = () => signOut(auth).then(() => location.reload());