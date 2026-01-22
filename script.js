import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURACIÓN (REEMPLAZAR) ---
const firebaseConfig = {
    apiKey: "AIzaSyD5-bT6Z1JUa9yzjEiOtBGb31XhyNKfkAA",
  authDomain: "proygrado-dac9c.firebaseapp.com",
  projectId: "proygrado-dac9c",
  storageBucket: "proygrado-dac9c.firebasestorage.app",
  messagingSenderId: "1078060346645",
  appId: "1:1078060346645:web:7407634d4a39c49c408d1c"
};
const GEMINI_API_KEY = "AIzaSyBL9yP7dylPLwBdKvZWCkMH5iZJLQcxDtY";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

// --- SISTEMA DE NOTIFICACIONES (TOAST) ---
window.showToast = (msg, type = 'info') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${msg}</span> <i class="fas fa-times" onclick="this.parentElement.remove()"></i>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
};

// --- GESTIÓN DE SESIÓN Y SEGURIDAD ---
onAuthStateChanged(auth, async (user) => {
    const loader = document.getElementById('loader-screen');
    const loginView = document.getElementById('auth-container');
    const verifyView = document.getElementById('verification-container');
    const dashView = document.getElementById('dashboard-container');

    if (user) {
        // Usuario autenticado en Firebase
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                currentUser = userDoc.data();
                currentUser.uid = user.uid;

                loader.style.display = 'none';
                loginView.style.display = 'none';

                // LÓGICA DE VERIFICACIÓN PARA ESTUDIANTES
                if (currentUser.role === 'student') {
                    // Verificamos si ya validó el código en esta sesión (o en base de datos)
                    if (sessionStorage.getItem('isVerified') === 'true' || currentUser.isVerifiedDB) {
                        dashView.style.display = 'flex';
                        setupDashboard(currentUser);
                    } else {
                        verifyView.style.display = 'flex';
                        window.showToast("Seguridad: Ingrese su código de matrícula", "info");
                    }
                } else {
                    // Docentes y Admin pasan directo
                    dashView.style.display = 'flex';
                    setupDashboard(currentUser);
                }

            } else {
                console.error("Usuario sin registro DB");
                signOut(auth);
            }
        } catch (e) {
            console.error(e);
            window.showToast("Error de conexión", "error");
        }
    } else {
        // No hay sesión
        loader.style.display = 'none';
        dashView.style.display = 'none';
        verifyView.style.display = 'none';
        loginView.style.display = 'flex';
    }
});

// Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        window.showToast("Credenciales correctas. Verificando rol...", "success");
    } catch (e) {
        window.showToast("Error: Usuario o contraseña incorrectos", "error");
    }
});

// Verificación de Código (Estudiantes)
document.getElementById('verify-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const codeInput = document.getElementById('verify-code').value.trim();
    
    // El código real está guardado en el documento del usuario en Firestore
    if (codeInput === currentUser.enrollmentCode) {
        window.showToast("¡Código Correcto! Acceso concedido.", "success");
        sessionStorage.setItem('isVerified', 'true');
        document.getElementById('verification-container').style.display = 'none';
        document.getElementById('dashboard-container').style.display = 'flex';
        setupDashboard(currentUser);
    } else {
        window.showToast("Código incorrecto. Revise su hoja de matrícula.", "error");
    }
});

// Logout
window.logout = () => {
    sessionStorage.clear();
    signOut(auth).then(() => location.reload());
};

// --- DASHBOARD UI ---
function setupDashboard(user) {
    // 1. Sidebar Perfil
    document.getElementById('sb-name').innerText = user.firstName.split(' ')[0];
    document.getElementById('sb-role').innerText = user.role.toUpperCase();
    document.getElementById('sb-avatar').innerText = user.firstName.charAt(0);

    // 2. Mostrar Menú según Rol
    document.querySelectorAll('.nav-list').forEach(ul => ul.style.display = 'none');
    document.querySelector(`.${user.role}-only`).style.display = 'block';

    // 3. Cargar Datos Específicos
    if(user.role === 'student') loadStudentData(user);
    if(user.role === 'admin') loadAdminTools();

    // 4. Iniciar Listeners de Notificaciones (Simulado)
    startNotifications(user);
}

// Navegación Sidebar
window.nav = (sectionId) => {
    document.querySelectorAll('.section-view').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    // Activar clase CSS en link sidebar...
};

// --- LÓGICA ESTUDIANTE ---
function loadStudentData(user) {
    document.getElementById('stu-full-name').innerText = `${user.firstName} ${user.lastName}`;
    document.getElementById('stu-course').innerText = user.course || "No asignado";
    document.getElementById('stu-gender').innerText = user.gender === 'M' ? 'Masculino' : 'Femenino';
    
    // Generar Calendario
    generateCalendar();
}

function generateCalendar() {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = "";
    // Simulación de Enero (empezando Jueves 1)
    for(let i=0; i<3; i++) grid.innerHTML += `<div></div>`; // Espacios vacíos
    for(let i=1; i<=31; i++) {
        let event = "";
        if(i === 15) event = `<span class="cal-event">Examen Math</span>`;
        if(i === 22) event = `<span class="cal-event">Entrega Proyecto</span>`;
        
        grid.innerHTML += `
            <div class="cal-day">
                <span class="cal-num">${i}</span>
                ${event}
            </div>`;
    }
}

// --- LÓGICA ADMIN (MATRICULACIÓN COMPLEJA) ---
// Cálculo de Edad
window.calculateAge = () => {
    const dob = new Date(document.getElementById('mat-stu-dob').value);
    const diff_ms = Date.now() - dob.getTime();
    const age_dt = new Date(diff_ms); 
    const age = Math.abs(age_dt.getUTCFullYear() - 1970);
    document.getElementById('mat-stu-age').value = age + " años";
};

document.getElementById('matricula-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerText = "Procesando...";
    btn.disabled = true;

    // Datos Básicos
    const name = document.getElementById('mat-stu-name').value;
    const lastName = document.getElementById('mat-stu-lastname').value;
    const course = document.getElementById('mat-stu-course').value;
    const gender = document.getElementById('mat-stu-gender').value;
    
    // Generar Credenciales
    const email = `${name.charAt(0).toLowerCase()}${lastName.toLowerCase()}@lcp.edu.ec`;
    const tempPass = "LCP2026";
    const enrollmentCode = `LCP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
        // 1. Crear Auth
        const userCred = await createUserWithEmailAndPassword(auth, email, tempPass);
        
        // 2. Crear Documento Detallado
        await setDoc(doc(db, "users", userCred.user.uid), {
            firstName: name,
            lastName: lastName,
            email: email,
            role: 'student',
            course: course,
            gender: gender,
            enrollmentCode: enrollmentCode, // CÓDIGO CLAVE
            guardianInfo: {
                // Aquí irían los datos del representante del formulario
                updated: new Date()
            },
            createdAt: new Date()
        });

        window.showToast(`✅ Estudiante matriculado.`, "success");
        alert(`MATRÍCULA EXITOSA\n\nUsuario: ${email}\nPass: ${tempPass}\nCÓDIGO DE SEGURIDAD: ${enrollmentCode}\n\n(Entregue este código al estudiante)`);
        
        e.target.reset();
    } catch (err) {
        window.showToast("Error: " + err.message, "error");
    } finally {
        btn.innerText = "Registrar y Generar Código";
        btn.disabled = false;
    }
});

// --- DOCENTE / IA ---
window.askGemini = async (type) => {
    const input = document.getElementById('ai-input');
    const box = document.getElementById('ai-chat-box');
    const prompt = input.value;
    
    if(!prompt) return;
    
    // Añadir msg usuario
    box.innerHTML += `<div class="user-msg">${prompt}</div>`;
    input.value = "";
    
    // Llamada API
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ contents: [{ parts: [{ text: "Actúa como profesor experto. " + prompt }] }] })
        });
        const data = await res.json();
        const text = data.candidates[0].content.parts[0].text;
        
        // Añadir respuesta IA
        box.innerHTML += `<div class="ai-msg">${text.replace(/\n/g, '<br>')}</div>`;
        box.scrollTop = box.scrollHeight;
        
        // Simular notificación
        window.showToast("Examen generado con éxito", "success");
        
    } catch(e) {
        window.showToast("Error conectando con IA", "error");
    }
};

// --- UI HELPERS ---
window.toggleNotifications = () => {
    document.getElementById('notif-dropdown').classList.toggle('active'); // CSS display logic needed or wrapper class toggle
    document.querySelector('.icon-wrapper:nth-child(1)').classList.toggle('active');
};
window.toggleMessages = () => {
    document.querySelector('.icon-wrapper:nth-child(2)').classList.toggle('active');
};

function startNotifications(user) {
    // Simulación de notificaciones tiempo real
    if(user.role === 'student') {
        setTimeout(() => {
            window.showToast("Nueva calificación: Matemáticas (10/10)", "info");
            document.getElementById('notif-badge').innerText = "1";
            document.getElementById('notif-list').innerHTML = `<div style="padding:10px; border-bottom:1px solid #333">Docente M. López subió notas de 1er Parcial.</div>`;
        }, 5000);
    }
}