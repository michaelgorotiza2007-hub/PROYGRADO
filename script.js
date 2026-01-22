import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, query, where, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURACIÓN (REEMPLAZAR CON TUS DATOS REALES) ---
const firebaseConfig = {
    apiKey: "AIzaSyD5-bT6Z1JUa9yzjEiOtBGb31XhyNKfkAA",
  authDomain: "proygrado-dac9c.firebaseapp.com",
  projectId: "proygrado-dac9c",
  storageBucket: "proygrado-dac9c.firebasestorage.app",
  messagingSenderId: "1078060346645",
  appId: "1:1078060346645:web:7407634d4a39c49c408d1c"
};
const GEMINI_API_KEY = "AIzaSyBL9yP7dylPLwBdKvZWCkMH5iZJLQcxDtY";

// Inicialización
let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (e) {
    console.error("Error crítico Firebase:", e);
    alert("Error de configuración. Revise la consola.");
}

// Estado Global
let currentUser = null;
let notifUnsubscribe = null; // Para detener el listener de notificaciones

// ==================== UTILIDADES UI ====================
window.showToast = (msg, type = 'info') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    let icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
};

window.toggleDropdown = (id) => {
    const drop = document.getElementById(id);
    drop.classList.toggle('active');
    // Cerrar otros si se abre uno
    if (id === 'notif-drop') document.getElementById('msg-drop').classList.remove('active');
    if (id === 'msg-drop') document.getElementById('notif-drop').classList.remove('active');
};

// Cierra dropdowns al hacer clic fuera
document.addEventListener('click', (e) => {
    if (!e.target.closest('.icon-wrapper')) {
        document.querySelectorAll('.dropdown-glass').forEach(d => d.classList.remove('active'));
    }
});

window.loadSection = (secId) => {
    document.querySelectorAll('.workspace-section').forEach(s => s.classList.remove('active'));
    document.getElementById(secId).classList.add('active');
    
    document.querySelectorAll('.menu-list a').forEach(a => a.classList.remove('active'));
    const activeLink = document.querySelector(`a[onclick*='${secId}']`);
    if(activeLink) activeLink.classList.add('active');

    // Títulos dinámicos
    const titles = {
        'stu-overview': 'Panel General del Estudiante',
        'stu-grades': 'Cuaderno de Notas',
        'adm-register': 'Sistema de Matriculación',
        'tea-ai': 'Asistente IA Docente'
    };
    document.getElementById('section-title').innerText = titles[secId] || 'Panel de Control';
};

// ==================== NÚCLEO DE AUTENTICACIÓN ====================
onAuthStateChanged(auth, async (user) => {
    const loader = document.getElementById('loader-screen');
    const loginView = document.getElementById('view-login');
    const verifyView = document.getElementById('view-verify');
    const dashView = document.getElementById('view-dashboard');

    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (!userDoc.exists()) throw new Error("Usuario no encontrado en BD");

            currentUser = { uid: user.uid, ...userDoc.data() };
            loader.classList.remove('active');
            loginView.classList.remove('active');

            // Lógica de Redirección según Rol y Verificación
            if (currentUser.role === 'student' || currentUser.role === 'parent') {
                if (currentUser.isVerified) {
                    verifyView.classList.remove('active');
                    initializeDashboard(dashView);
                } else {
                    document.getElementById('verify-name').innerText = currentUser.firstName.split(' ')[0];
                    verifyView.classList.add('active');
                    dashView.classList.remove('active');
                }
            } else {
                // Staff (Docente/Admin) pasa directo
                verifyView.classList.remove('active');
                initializeDashboard(dashView);
            }

        } catch (e) {
            console.error(e);
            window.showToast("Error al cargar perfil. Intente nuevamente.", "error");
            signOut(auth);
            loader.classList.remove('active');
            loginView.classList.add('active');
        }
    } else {
        // No hay sesión
        if(notifUnsubscribe) notifUnsubscribe(); // Limpiar listener
        currentUser = null;
        loader.classList.remove('active');
        dashView.classList.remove('active');
        verifyView.classList.remove('active');
        loginView.classList.add('active');
    }
});

// --- LOGIN ---
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    const btn = e.target.querySelector('button');
    const originalBtn = btn.innerHTML;

    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Conectando...';
    btn.disabled = true;

    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        window.showToast("Error de credenciales. Verifique.", "error");
        btn.innerHTML = originalBtn;
        btn.disabled = false;
    }
});

// --- VERIFICACIÓN DE CÓDIGO (ESTUDIANTE) ---
document.getElementById('form-verify').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('verify-code').value.trim();
    const btn = e.target.querySelector('button');

    // El código correcto se guardó en el perfil del usuario al matricularlo
    if (code === currentUser.securityCode) {
        btn.innerText = "Validando...";
        btn.disabled = true;
        try {
            await updateDoc(doc(db, "users", currentUser.uid), {
                isVerified: true,
                verifiedAt: new Date()
            });
            currentUser.isVerified = true;
            document.getElementById('view-verify').classList.remove('active');
            initializeDashboard(document.getElementById('view-dashboard'));
            window.showToast("¡Acceso concedido! Bienvenido.", "success");
        } catch (e) {
            window.showToast("Error de conexión.", "error");
            btn.innerText = "Validar Acceso";
            btn.disabled = false;
        }
    } else {
        window.showToast("Código de seguridad incorrecto.", "error");
        e.target.reset();
    }
});

// ==================== LÓGICA DEL DASHBOARD ====================
function initializeDashboard(view) {
    view.classList.add('active');

    // 1. Configurar Sidebar UI
    document.getElementById('dash-name').innerText = `${currentUser.firstName.split(' ')[0]} ${currentUser.lastName.split(' ')[0]}`;
    document.getElementById('dash-role').innerText = translateRole(currentUser.role);
    document.getElementById('dash-avatar').innerText = currentUser.firstName.charAt(0);

    // 2. Mostrar Menú según Rol
    document.querySelectorAll('.menu-list').forEach(ul => ul.style.display = 'none');
    const activeMenu = document.querySelector(`.menu-list.${currentUser.role}-only`);
    if (activeMenu) {
        activeMenu.style.display = 'block';
        // Clic en la primera opción
        activeMenu.querySelector('a').click();
    }

    // 3. Cargar Datos Específicos
    if (currentUser.role === 'student') loadStudentProfile();
    
    // 4. Iniciar Listener de Notificaciones en Tiempo Real
    setupNotificationsListener();
}

function translateRole(role) {
    const map = { student: 'Estudiante', teacher: 'Docente', admin: 'Administrador' };
    return map[role] || role.toUpperCase();
}

// --- LÓGICA ESTUDIANTE ---
function loadStudentProfile() {
    document.getElementById('stu-fullname-display').innerText = `${currentUser.firstName} ${currentUser.lastName}`;
    document.getElementById('stu-course-display').innerText = currentUser.course || 'No asignado';
    document.getElementById('stu-gender-display').innerText = currentUser.gender || '-';

    // Cálculo de Edad
    if (currentUser.dob) {
        const dob = new Date(currentUser.dob);
        const ageDiff = Date.now() - dob.getTime();
        const ageDate = new Date(ageDiff);
        document.getElementById('stu-age-display').innerText = `${Math.abs(ageDate.getUTCFullYear() - 1970)} años`;
    }

    // Generar Calendario (Simulado)
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = "";
    for (let i = 1; i <= 31; i++) {
        grid.innerHTML += `<div class="cal-tech-day"><span class="cal-num">${i}</span></div>`;
    }
}

// --- SISTEMA DE NOTIFICACIONES REAL-TIME (FIRESTORE) ---
function setupNotificationsListener() {
    // Escuchar colección "notifications" donde el destinatario es el usuario actual
    const q = query(
        collection(db, "notifications"),
        where("targetUserId", "==", currentUser.uid),
        orderBy("createdAt", "desc"),
        limit(5) // Solo las últimas 5
    );

    notifUnsubscribe = onSnapshot(q, (snapshot) => {
        const list = document.getElementById('notif-list');
        const badge = document.getElementById('notif-badge');
        
        if (snapshot.empty) {
            list.innerHTML = '<p class="empty-state">Sin novedades.</p>';
            badge.style.display = 'none';
        } else {
            list.innerHTML = '';
            let unreadCount = 0;
            snapshot.forEach(doc => {
                const notif = doc.data();
                if(!notif.read) unreadCount++;
                
                list.innerHTML += `
                    <div class="notif-item">
                        <div class="notif-icon"><i class="fas fa-info-circle"></i></div>
                        <div class="notif-content">
                            <h5>${notif.title}</h5>
                            <p>${notif.message}</p>
                            <span class="notif-time">${new Date(notif.createdAt.toDate()).toLocaleDateString()}</span>
                        </div>
                    </div>`;
            });
            
            if(unreadCount > 0) {
                badge.style.display = 'block';
                // Opcional: Mostrar toast si es una notificación muy reciente
                if(snapshot.docChanges().some(change => change.type === 'added')) {
                   window.showToast("Tienes nuevas notificaciones", "info");
                }
            } else {
                 badge.style.display = 'none';
            }
        }
    }, (error) => {
        console.error("Error notificaciones:", error);
    });
}


// ==================== LÓGICA ADMIN (MATRICULACIÓN COMPLEJA) ====================
window.calculateAge = () => {
    const dobInput = document.getElementById('mat-stu-dob').value;
    if (!dobInput) return;
    const dob = new Date(dobInput);
    const ageDiff = Date.now() - dob.getTime();
    const ageDate = new Date(ageDiff);
    document.getElementById('mat-stu-age').value = `${Math.abs(ageDate.getUTCFullYear() - 1970)} años`;
};

document.getElementById('form-matricula-completa')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (currentUser.role !== 'admin') return;

    const btn = document.getElementById('btn-matricular');
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Procesando...';
    btn.disabled = true;

    // 1. Recolección de Datos Estudiante
    const stuData = {
        cedula: document.getElementById('mat-stu-cedula').value,
        firstName: document.getElementById('mat-stu-name').value,
        lastName: document.getElementById('mat-stu-last').value,
        dob: document.getElementById('mat-stu-dob').value,
        gender: document.getElementById('mat-stu-gender').value,
        emailPersonal: document.getElementById('mat-stu-email-personal').value,
        phone: document.getElementById('mat-stu-phone').value,
        nationality: document.getElementById('mat-stu-nacionalidad').value,
        cityOfBirth: document.getElementById('mat-stu-ciudad-nac').value,
        course: document.getElementById('mat-stu-course').value,
        role: 'student',
        isVerified: false,
        createdAt: new Date()
    };

    // 2. Recolección de Datos Representante (Objeto anidado)
    const guardianData = {
        cedula: document.getElementById('mat-rep-cedula').value,
        fullName: `${document.getElementById('mat-rep-name').value} ${document.getElementById('mat-rep-last').value}`,
        email: document.getElementById('mat-rep-email').value,
        // ... resto de campos del representante ...
        address: document.querySelector('input[placeholder*="Dirección"]').value
    };

    // 3. Generación de Credenciales
    // Email: primera letra nombre + primer apellido + @lcp.edu.ec
    const generatedEmail = `${stuData.firstName.charAt(0).toLowerCase()}${stuData.lastName.split(' ')[0].toLowerCase()}@lcp.edu.ec`.replace(/\s/g, '');
    const generatedPass = "LCP" + Math.floor(1000 + Math.random() * 9000);
    const securityCode = "LCP-" + Math.floor(10000 + Math.random() * 90000);

    try {
        // Crear Auth
        const userCred = await createUserWithEmailAndPassword(auth, generatedEmail, generatedPass);
        
        // Guardar Documento Completo en Firestore
        await setDoc(doc(db, "users", userCred.user.uid), {
            ...stuData,
            email: generatedEmail, // Email institucional
            securityCode: securityCode, // Código para el primer login
            guardian: guardianData
        });

        // Mostrar Resultados
        document.getElementById('res-user').innerText = generatedEmail;
        document.getElementById('res-pass').innerText = generatedPass;
        document.getElementById('res-code').innerText = securityCode;
        document.getElementById('credentials-result').style.display = 'block';
        
        window.showToast("Matrícula completada con éxito.", "success");
        e.target.reset();
        document.getElementById('mat-stu-age').value = '';

        // Ejemplo: Crear una notificación inicial para el estudiante
        await addDoc(collection(db, "notifications"), {
            targetUserId: userCred.user.uid,
            title: "Bienvenido a LCP",
            message: "Tu cuenta ha sido creada. Revisa tu horario de clases.",
            read: false,
            createdAt: new Date()
        });

    } catch (error) {
        console.error(error);
        window.showToast("Error en matrícula: " + error.message, "error");
    } finally {
        btn.innerHTML = '<i class="fas fa-save"></i> Procesar Matrícula';
        btn.disabled = false;
    }
});

// ==================== IA GEMINI (DOCENTE/ADMIN) ====================
window.callGeminiApi = async () => {
    const prompt = document.getElementById('ai-prompt').value.trim();
    const output = document.getElementById('ai-chat-output');
    const btn = document.getElementById('btn-ai-send');

    if (!prompt) return;

    // Añadir mensaje del usuario
    output.innerHTML += `
        <div class="ai-message user">
            <p>${prompt}</p>
        </div>`;
    output.scrollTop = output.scrollHeight;
    
    btn.disabled = true;
    document.getElementById('ai-prompt').value = '';

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Actúa como un asistente educativo experto y formal para la institución LCP. La consulta es: ${prompt}`
                    }]
                }]
            })
        });

        if (!response.ok) throw new Error("Error en la respuesta de la API");

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        
        // Formatear respuesta (saltos de línea)
        const formattedText = text.replace(/\n/g, '<br>');

        output.innerHTML += `
            <div class="ai-message system">
                <i class="fas fa-robot"></i>
                <div>${formattedText}</div>
            </div>`;

    } catch (e) {
        output.innerHTML += `
            <div class="ai-message system error">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error al conectar con la IA. Verifica la conexión o la API Key.</p>
            </div>`;
    } finally {
        output.scrollTop = output.scrollHeight;
        btn.disabled = false;
    }
};

window.logout = () => {
    if(notifUnsubscribe) notifUnsubscribe();
    signOut(auth).then(() => location.reload());
};