// Importar funciones necesarias de Firebase (CDN Modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc,
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// =======================================================
// 1. CONFIGURACIÓN DE FIREBASE (¡PEGA TUS DATOS AQUÍ!)
// =======================================================
const firebaseConfig = {
  apiKey: "AIzaSyD5-bT6Z1JUa9yzjEiOtBGb31XhyNKfkAA",
  authDomain: "proygrado-dac9c.firebaseapp.com",
  projectId: "proygrado-dac9c",
  storageBucket: "proygrado-dac9c.firebasestorage.app",
  messagingSenderId: "1078060346645",
  appId: "1:1078060346645:web:7407634d4a39c49c408d1c"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =======================================================
// 2. LÓGICA DE INTERFAZ (UI)
// =======================================================

// Elementos del DOM
const cards = document.querySelectorAll('.card');
const overlay = document.getElementById('auth-overlay');
const mainContainer = document.getElementById('main-container');
const closeBtn = document.getElementById('close-btn');
const roleText = document.querySelector('#selected-role-text span');
const errorMsg = document.getElementById('error-msg');

// Formularios y Botones de cambio
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const toRegisterBtn = document.getElementById('to-register');
const toLoginBtn = document.getElementById('to-login');

let selectedRole = ""; // Variable para guardar el rol elegido

// Efecto Hover original (Manteniendo tu lógica visual)
cards.forEach(button => {
    button.addEventListener("mouseenter", () => button.style.backgroundImage = "url('img/BTN CON FLECHAS.png')");
    button.addEventListener("mouseleave", () => button.style.backgroundImage = "url('img/BTN.png')");
    
    // Al hacer click en una tarjeta
    button.addEventListener('click', () => {
        selectedRole = button.getAttribute('data-role'); // Obtener 'estudiante', 'docente', etc.
        roleText.textContent = selectedRole.toUpperCase();
        openModal();
    });
});

// Funciones Modal
function openModal() {
    overlay.classList.add('show');
    mainContainer.classList.add('blur');
    errorMsg.textContent = "";
    // Siempre abrir en Login primero
    showLogin();
}

function closeModal() {
    overlay.classList.remove('show');
    mainContainer.classList.remove('blur');
    loginForm.reset();
    registerForm.reset();
}

closeBtn.addEventListener('click', closeModal);

// Cambiar entre Login y Registro
function showRegister() {
    loginForm.classList.remove('active');
    registerForm.classList.add('active');
    document.getElementById('auth-title').textContent = "Crear Cuenta";
    errorMsg.textContent = "";
}

function showLogin() {
    registerForm.classList.remove('active');
    loginForm.classList.add('active');
    document.getElementById('auth-title').textContent = "Bienvenido";
    errorMsg.textContent = "";
}

toRegisterBtn.addEventListener('click', showRegister);
toLoginBtn.addEventListener('click', showLogin);

// =======================================================
// 3. LÓGICA DE AUTENTICACIÓN (FIREBASE)
// =======================================================

// A) REGISTRO
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;

    try {
        // 1. Crear usuario en Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;

        // 2. Guardar datos adicionales en Firestore
        // La colección será "usuarios" y el ID del documento será el UID del usuario
        await setDoc(doc(db, "usuarios", user.uid), {
            nombre: name,
            email: email,
            rol: selectedRole, // Guardamos si es docente, estudiante o admin
            fechaRegistro: new Date()
        });

        alert(`Cuenta creada exitosamente como ${selectedRole.toUpperCase()}`);
        closeModal();
        // Aquí podrías redirigir a dashboard.html
        
    } catch (error) {
        manejarErrores(error);
    }
});

// B) LOGIN
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;

        // Opcional: Verificar que el rol coincida con el botón presionado
        // Consultamos la base de datos
        const docRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const userData = docSnap.data();
            
            // Verificación de seguridad simple
            /* Si quieres obligar a que un docente solo entre por el botón docente:
            if(userData.rol !== selectedRole) {
                throw new Error("rol-incorrecto");
            } 
            */
            
            alert(`Bienvenido de nuevo, ${userData.nombre}`);
            closeModal();
            // Redirigir según rol:
            // window.location.href = `panel-${userData.rol}.html`;

        } else {
            console.log("No hay datos adicionales del usuario");
        }

    } catch (error) {
        manejarErrores(error);
    }
});

// Manejo de errores traducidos
function manejarErrores(error) {
    console.error(error);
    let mensaje = "Ocurrió un error. Intenta de nuevo.";
    
    if (error.code === 'auth/email-already-in-use') mensaje = "Este correo ya está registrado.";
    if (error.code === 'auth/wrong-password') mensaje = "Contraseña incorrecta.";
    if (error.code === 'auth/user-not-found') mensaje = "Usuario no encontrado.";
    if (error.code === 'auth/weak-password') mensaje = "La contraseña debe tener al menos 6 caracteres.";
    if (error.message === 'rol-incorrecto') mensaje = "Tu cuenta no pertenece a este perfil.";

    errorMsg.textContent = mensaje;
}

// Monitor de estado (Opcional: para ver si ya está logueado al cargar)
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Usuario logueado:", user.email);
    } else {
        console.log("Nadie logueado");
    }
});