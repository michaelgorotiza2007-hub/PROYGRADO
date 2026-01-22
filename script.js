import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// 1. CONFIGURACIÓN (¡REEMPLAZAR DATOS AQUÍ!)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyD5-bT6Z1JUa9yzjEiOtBGb31XhyNKfkAA",
  authDomain: "proygrado-dac9c.firebaseapp.com",
  projectId: "proygrado-dac9c",
  storageBucket: "proygrado-dac9c.firebasestorage.app",
  messagingSenderId: "1078060346645",
  appId: "1:1078060346645:web:7407634d4a39c49c408d1c"
};

const GEMINI_API_KEY = "AIzaSyCeVwmI2QhB4LfH-nrDRUjnUDBqYL2yGUw"; // <--- PEGA TU API KEY DE GOOGLE AI

// Inicializar Servicios
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Estado Global
let currentUserData = null;
window.currentAiMode = 'report';

// ==========================================
// 2. SISTEMA DE SESIÓN Y CARGA
// ==========================================

// Animación de Carga Inicial
window.addEventListener('load', () => {
    let width = 0;
    const bar = document.getElementById('progress-bar');
    const interval = setInterval(() => {
        width += 2; // Más lento para apreciar el diseño
        bar.style.width = width + '%';
        if (width >= 105) clearInterval(interval); // Un poco más para asegurar
    }, 30);
});

// Monitor de Estado de Autenticación
onAuthStateChanged(auth, async (user) => {
    const loader = document.getElementById('loader-screen');
    const authView = document.getElementById('auth-container');
    const dashView = document.getElementById('app-dashboard');
    const loadingStatus = document.querySelector('.loading-status');

    if (user) {
        if(loadingStatus) loadingStatus.innerText = "Verificando credenciales...";
        try {
            // Obtener rol y nombre desde Firestore
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                if(loadingStatus) loadingStatus.innerText = "Cargando su panel personalizado...";
                currentUserData = docSnap.data();
                setupUI(currentUserData);
                
                // Transición suave
                setTimeout(() => {
                    loader.style.opacity = '0';
                    loader.style.transition = 'opacity 0.5s ease';
                    setTimeout(() => { loader.style.display = 'none'; }, 500);
                    
                    authView.style.display = 'none';
                    dashView.style.display = 'flex';
                }, 800);

            } else {
                console.error("Usuario sin datos de perfil");
                signOut(auth);
                showLogin(loader, authView, dashView);
            }
        } catch (error) {
            console.error("Error Firestore:", error);
            showLogin(loader, authView, dashView);
        }
    } else {
        showLogin(loader, authView, dashView);
    }
});

function showLogin(loader, authView, dashView) {
    dashView.style.display = 'none';
    authView.style.display = 'flex';
    // Ocultar loader después de un momento si no hay user
    setTimeout(() => {
       loader.style.opacity = '0';
       loader.style.transition = 'opacity 0.5s ease';
       setTimeout(() => { loader.style.display = 'none'; }, 500);
    }, 1500);
}

// Lógica de Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    const btn = e.target.querySelector('button');
    const originalText = btn.innerHTML;

    try {
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Iniciando...';
        btn.disabled = true;
        await signInWithEmailAndPassword(auth, email, pass);
        // El observador onAuthStateChanged manejará la redirección
    } catch (error) {
        alert("Error de acceso: Verifique sus credenciales.");
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

// Lógica de Registro Staff
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    const name = document.getElementById('reg-name').value;
    const role = document.getElementById('reg-role').value;

    if(!role) return alert("Seleccione un rol");

    try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, "users", cred.user.uid), {
            name: name,
            email: email,
            role: role,
            createdAt: new Date()
        });
        alert("Cuenta de Staff creada exitosamente. Ya puede iniciar sesión.");
        window.toggleAuth('login'); // Volver al tab de login
        e.target.reset();
    } catch (error) {
        alert("Error al registrar: " + error.message);
    }
});

// ==========================================
// 3. FUNCIONES DEL DASHBOARD
// ==========================================

function setupUI(user) {
    // Configurar Perfil en Sidebar
    document.getElementById('user-name').innerText = user.name;
    document.getElementById('user-avatar').innerText = user.name.substring(0,2).toUpperCase();
    const roleMap = { 'admin': 'Administrativo', 'teacher': 'Docente', 'student': 'Estudiante', 'parent': 'Padre de Familia' };
    document.getElementById('user-role-badge').innerText = roleMap[user.role] || user.role.toUpperCase();
    document.getElementById('welcome-msg').innerText = `Bienvenido de nuevo, ${user.name.split(' ')[0]}`;

    // Filtrar Menú Lateral según Rol
    document.querySelectorAll('.role-link').forEach(el => el.style.display = 'none');
    if (user.role === 'admin') document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
    if (user.role === 'teacher') document.querySelectorAll('.teacher-only').forEach(el => el.style.display = 'block');
    if (user.role === 'student') {
        document.querySelectorAll('.student-only').forEach(el => el.style.display = 'block');
        loadRanking(); // Cargar datos específicos de estudiante
    }

    // Resetear vista a Dashboard
    showSection('dashboard');
}

// Admin: Crear Matrícula (Simulación)
document.getElementById('admin-create-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const roleSelect = document.getElementById('new-user-role');
    const inputs = e.target.querySelectorAll('input');
    
    const roleText = roleSelect.options[roleSelect.selectedIndex].text;
    const name = inputs[0].value;
    const code = inputs[2].value;

    // En un sistema real, aquí guardarías en Firestore en una colección "matriculas_pendientes"
    alert(`✅ Matrícula registrada con éxito.\n\nUsuario: ${name} (${roleText})\nCódigo de Validación: ${code}\n\nEntregue este código al usuario para que proceda con su registro.`);
    e.target.reset();
});

// Estudiante: Cargar Ranking (Datos Simulados para Demo Visual)
async function loadRanking() {
    const tbody = document.getElementById('ranking-body');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;"><i class="fas fa-circle-notch fa-spin"></i> Cargando datos...</td></tr>';

    // Simulamos un pequeño delay de red
    setTimeout(() => {
        // Datos de ejemplo (en prod vendrían de Firestore query)
        const fakeData = [
            { name: "Ana Paula Torres", score: 98.5 },
            { name: "Carlos Ruiz", score: 97.2 },
            { name: currentUserData.name, score: 94.8 }, // El usuario actual
            { name: "Luisa Mendoza", score: 92.1 },
            { name: "Jorge Vera", score: 90.5 }
        ];
        
        tbody.innerHTML = "";
        fakeData.forEach((st, i) => {
            let medal = '';
            let badgeClass = 'rank-bronze';
            if(i === 0) { medal = '🥇 Oro'; badgeClass = 'rank-gold'; }
            else if(i === 1) { medal = '🥈 Plata'; badgeClass = 'rank-silver'; }
            else if(i === 2) { medal = '🥉 Bronce'; }
            else { medal = 'Mención Honrosa'; badgeClass = ''; }

            const isMe = st.name === currentUserData.name;

            tbody.innerHTML += `
                <tr style="${isMe ? 'background:#f0f9ff; font-weight:500;' : ''}">
                    <td>#${i+1}</td>
                    <td>${st.name} ${isMe ? '(Tú)' : ''}</td>
                    <td><strong>${st.score}</strong> / 100</td>
                    <td><span class="rank-badge ${badgeClass}">${medal}</span></td>
                </tr>`;
        });
    }, 800);
}

// ==========================================
// 4. INTELIGENCIA ARTIFICIAL (GEMINI)
// ==========================================

window.consultarGemini = async () => {
    const promptInput = document.getElementById('ai-prompt');
    const box = document.getElementById('ai-window');
    const btn = document.querySelector('.btn-ai-send');
    
    if(!promptInput.value.trim()) return promptInput.focus();

    // UI de carga
    const originalBtnText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Generando...';
    btn.disabled = true;
    box.innerHTML = `
        <div class="chat-response" style="opacity:0.7;">
            <p><i class="fas fa-sparkles fa-pulse accent-color"></i> Analizando solicitud y generando contenido pedagógico...</p>
        </div>`;

    // Contexto para el modelo
    let context = "Actúa como un asistente pedagógico experto y formal para una institución educativa.";
    const modeTitle = document.getElementById('ai-mode-title').innerText;
    context += ` La tarea actual es: ${modeTitle}.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ contents: [{ parts: [{ text: context + "\n\nInstrucción del usuario: " + promptInput.value }] }] })
        });
        
        const data = await response.json();

        if(data.candidates && data.candidates.length > 0) {
            const text = data.candidates[0].content.parts[0].text;
            // Formateo simple de Markdown a HTML para mejor visualización
            const formattedText = text
                .replace(/^### (.*$)/gim, '<h4>$1</h4>') // Títulos H3
                .replace(/^## (.*$)/gim, '<h3>$1</h3>') // Títulos H2
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Negritas
                .replace(/\* (.*$)/gim, '<li>$1</li>') // Listas
                .replace(/\n/g, '<br>'); // Saltos de línea

            box.innerHTML = `<div class="chat-response">${formattedText}</div>`;
        } else {
            throw new Error("No se generó respuesta válida.");
        }

    } catch (e) {
        box.innerHTML = `<div class="chat-response" style="border-left-color:red; color:red;"><i class="fas fa-exclamation-triangle"></i> Error: ${e.message || "No se pudo conectar con Gemini."} Verifica tu API Key.</div>`;
        console.error(e);
    } finally {
        btn.innerHTML = originalBtnText;
        btn.disabled = false;
    }
};

// ==========================================
// 5. UTILIDADES DE INTERFAZ
// ==========================================
window.toggleAuth = (mode) => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    
    if(mode === 'login') {
        document.querySelectorAll('.auth-tab')[0].classList.add('active');
        document.getElementById('login-form').classList.add('active');
    } else {
        document.querySelectorAll('.auth-tab')[1].classList.add('active');
        document.getElementById('register-form').classList.add('active');
    }
};

window.showSection = (id) => {
    // Manejo de estado activo del menú sidebar
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
    // Encontrar el link que llama a esta función y activarlo (aproximación)
    const activeLink = Array.from(document.querySelectorAll('.sidebar-menu a')).find(a => a.onclick.toString().includes(id));
    if(activeLink) activeLink.classList.add('active');

    // Mostrar sección de contenido
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const targetId = id.startsWith('sec-') ? id : 'sec-' + id;
    const targetEl = document.getElementById(targetId);
    if(targetEl) targetEl.classList.add('active');

    // Actualizar título de la página (Opcional)
    const titles = { 'dashboard': 'Resumen Académico', 'admin-users': 'Gestión de Matrículas', 'ranking': 'Cuadro de Honor', 'gemini-ai': 'Asistente IA' };
    const pageTitle = document.querySelector('.current-date');
    if(pageTitle && titles[id]) pageTitle.innerText = titles[id];
};

window.setAiMode = (mode) => {
    window.currentAiMode = mode;
    document.querySelectorAll('.ai-tool-btn').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    const titles = {'report': 'Generador de Reportes', 'exam': 'Crear Evaluaciones', 'analysis': 'Análisis Pedagógico'};
    document.getElementById('ai-mode-title').innerHTML = `<i class="fas fa-comment-alt"></i> ${titles[mode]}`;
    
    // Limpiar área de chat
    document.getElementById('ai-window').innerHTML = `
        <div class="chat-response placeholder">
            <i class="fas fa-sparkles"></i>
            <p>Modo cambiado a: <strong>${titles[mode]}</strong>.<br>Escribe tu nueva instrucción abajo.</p>
        </div>`;
    document.getElementById('ai-prompt').value = '';
    document.getElementById('ai-prompt').focus();
};

window.logout = () => {
    if(confirm("¿Está seguro que desea cerrar sesión?")) {
        signOut(auth).then(() => location.reload());
    }
};