import { auth, db, firebaseConfig } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth as getAuthSecondary, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { showToast } from './utils.js';

let currentUser = null;

// GLOBALES
window.logout = async () => { await signOut(auth); window.location.href = 'index.html'; };
window.cerrarModal = () => document.getElementById('actionModal').classList.add('hidden');

window.navigate = (titulo, fnName) => {
    document.getElementById('pageTitle').innerText = titulo;
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    
    // Marcar activo
    const clicked = [...document.querySelectorAll('.menu-item')].find(el => el.innerText.includes(titulo));
    if(clicked) clicked.classList.add('active');
    
    if(views[fnName]) views[fnName]();
};

// INICIALIZACIÓN
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
            currentUser = { ...docSnap.data(), uid: user.uid };
            initUI();
        } else {
            // Autoreparación si no existe perfil
            console.warn("Autoreparando perfil...");
            const newProfile = { nombre: user.email.split('@')[0], email: user.email, rol: 'admin', fecha: new Date() };
            await setDoc(doc(db, "users", user.uid), newProfile);
            currentUser = { ...newProfile, uid: user.uid };
            initUI();
        }
    } catch (e) { showToast(e.message, 'error'); }
});

function initUI() {
    document.getElementById('userName').innerText = currentUser.nombre;
    document.getElementById('userRole').innerText = currentUser.rol || "Usuario";
    renderMenu(currentUser.rol);
    views.loadWelcome();
}

function renderMenu(rol) {
    const container = document.getElementById('menuContainer');
    container.innerHTML = '';
    
    let items = [];
    if(rol === 'admin') items = [
        { icon: 'fa-home', txt: 'Inicio', fn: 'loadWelcome' },
        { icon: 'fa-users', txt: 'Usuarios', fn: 'vistaUsuarios' },
        { icon: 'fa-book', txt: 'Materias', fn: 'vistaMaterias' }
    ];
    else if(rol === 'docente') items = [
        { icon: 'fa-home', txt: 'Inicio', fn: 'loadWelcome' },
        { icon: 'fa-chalkboard', txt: 'Mis Clases', fn: 'vistaDocente' }
    ];
    else items = [ // Estudiante
        { icon: 'fa-home', txt: 'Inicio', fn: 'loadWelcome' },
        { icon: 'fa-star', txt: 'Mis Notas', fn: 'vistaEstudiante' }
    ];

    items.forEach(i => {
        const div = document.createElement('div');
        div.className = 'menu-item';
        div.innerHTML = `<i class="fas ${i.icon}"></i> ${i.txt}`;
        div.onclick = () => window.navigate(i.txt, i.fn);
        container.appendChild(div);
    });
}

// VISTAS
const views = {
    loadWelcome: () => {
        document.getElementById('mainArea').innerHTML = `
            <div class="stat-card" style="text-align:center; padding:60px;">
                <h1 style="color:#00A8E8; font-size:2.5rem; margin-bottom:10px;">Hola, ${currentUser.nombre} 👋</h1>
                <p style="color:#6b7280; font-size:1.1rem;">Bienvenido al panel de gestión escolar.</p>
            </div>
        `;
    },

    vistaUsuarios: async () => {
        const area = document.getElementById('mainArea');
        area.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h3>Usuarios del Sistema</h3>
                <button class="btn btn-blue" onclick="window.abrirModalCrearUsuario()">+ Nuevo Usuario</button>
            </div>
            <div id="userList" class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>
        `;
        
        const snap = await getDocs(collection(db, "users"));
        let html = `<table class="data-table"><thead><tr><th>Usuario</th><th>Email</th><th>Rol</th></tr></thead><tbody>`;
        snap.forEach(d => {
            const u = d.data();
            html += `<tr><td><b>${u.nombre}</b></td><td>${u.email}</td><td><span style="padding:4px 10px; background:#e0f2fe; color:#0EA5E9; border-radius:20px; font-weight:bold; font-size:0.8rem;">${u.rol.toUpperCase()}</span></td></tr>`;
        });
        html += `</tbody></table>`;
        document.getElementById('userList').innerHTML = html;
    },

    vistaMaterias: () => {
        document.getElementById('mainArea').innerHTML = `<div class="stat-card"><h3>Gestión de Materias</h3><p>Aquí el admin podrá asignar cursos (Funcionalidad pendiente de implementar).</p></div>`;
    },

    vistaDocente: () => {
        document.getElementById('mainArea').innerHTML = `<div class="stat-card"><h3>Mis Clases</h3><p>Módulo de gestión de notas del docente.</p></div>`;
    },

    vistaEstudiante: () => {
        document.getElementById('mainArea').innerHTML = `<div class="stat-card"><h3>Mis Calificaciones</h3><p>Visualización de notas del estudiante.</p></div>`;
    }
};

// ACCIONES
window.abrirModalCrearUsuario = () => {
    document.getElementById('actionModal').classList.remove('hidden');
    document.getElementById('modalContent').innerHTML = `
        <h3 style="margin-bottom:20px; color:#00A8E8;">Nuevo Usuario</h3>
        <form onsubmit="window.crearUsuarioReal(event)">
            <label>Nombre</label><input id="newName" required>
            <label>Email</label><input id="newEmail" type="email" required>
            <label>Contraseña</label><input id="newPass" type="password" required>
            <label>Rol</label><select id="newRol"><option value="docente">Docente</option><option value="estudiante">Estudiante</option></select>
            <button class="btn btn-blue" style="width:100%; margin-top:15px;">Crear</button>
        </form>
    `;
};

window.crearUsuarioReal = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerHTML = 'Creando...'; btn.disabled = true;
    
    const email = document.getElementById('newEmail').value;
    const pass = document.getElementById('newPass').value;
    const nombre = document.getElementById('newName').value;
    const rol = document.getElementById('newRol').value;

    try {
        const tempApp = initializeApp(firebaseConfig, "Secondary");
        const tempAuth = getAuthSecondary(tempApp);
        const cred = await createUserWithEmailAndPassword(tempAuth, email, pass);
        
        await setDoc(doc(db, "users", cred.user.uid), { nombre, email, rol, fecha: new Date() });
        await signOut(tempAuth);
        
        showToast(`Usuario ${nombre} creado`, "success");
        window.cerrarModal();
        views.vistaUsuarios();
    } catch (err) {
        showToast(err.message, "error");
        btn.innerHTML = 'Crear'; btn.disabled = false;
    }
};