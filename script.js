// --- CONFIGURACIÓN FIREBASE (Pegar aquí tus credenciales reales) ---
const firebaseConfig = {
    apiKey: "AIzaSyD5-bT6Z1JUa9yzjEiOtBGb31XhyNKfkAA",
  authDomain: "proygrado-dac9c.firebaseapp.com",
  projectId: "proygrado-dac9c",
  storageBucket: "proygrado-dac9c.firebasestorage.app",
  messagingSenderId: "1078060346645",
  appId: "1:1078060346645:web:7407634d4a39c49c408d1c"

};
// firebase.initializeApp(firebaseConfig);
// const db = firebase.firestore();

// --- ESTADO GLOBAL ---
let currentUser = null;
let currentRole = null;

// --- NAVEGACIÓN Y INTERFAZ ---

// Simulación de carga (Splash Screen)
window.onload = () => {
    setTimeout(() => {
        document.getElementById('splash-screen').classList.add('hidden');
        document.getElementById('splash-screen').classList.remove('active');
        document.getElementById('profile-selection').classList.remove('hidden');
        document.getElementById('profile-selection').classList.add('active');
    }, 2500);
};

function selectProfile(role) {
    currentRole = role;
    // Simular login
    currentUser = {
        name: role === 'estudiante' ? 'Michael Gorotiza' : 'Admin User',
        role: role.toUpperCase(),
        course: '3ero Informática'
    };

    document.getElementById('profile-selection').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    
    setupDashboard();
}

function setupDashboard() {
    document.getElementById('user-name').innerText = currentUser.name;
    document.getElementById('user-role').innerText = currentUser.role;

    const menu = document.getElementById('menu-items');
    menu.innerHTML = ''; // Limpiar menú

    // MENÚ DINÁMICO SEGÚN ROL
    if (currentRole === 'admin') {
        const items = [
            { icon: 'fa-users', text: 'Matriculación', action: 'renderMatricula' },
            { icon: 'fa-chalkboard-teacher', text: 'Docentes', action: 'renderDocentes' },
            { icon: 'fa-chart-line', text: 'Rankings', action: 'renderRanking' },
            { icon: 'fa-robot', text: 'Generar Reportes IA', action: 'renderAIReports' }
        ];
        items.forEach(item => addMenuItem(menu, item));
        renderMatricula(); // Vista por defecto
    } 
    else if (currentRole === 'docente') {
        const items = [
            { icon: 'fa-calendar', text: 'Calendario', action: 'renderCalendar' },
            { icon: 'fa-book', text: 'Mis Cursos', action: 'renderCourses' },
            { icon: 'fa-brain', text: 'Crear Examen (IA)', action: 'renderExamCreator' }
        ];
        items.forEach(item => addMenuItem(menu, item));
        renderCalendar();
    }
    else if (currentRole === 'estudiante') {
        const items = [
            { icon: 'fa-home', text: 'Inicio', action: 'renderStudentHome' },
            { icon: 'fa-list-check', text: 'Tareas', action: 'renderTasks' },
            { icon: 'fa-chart-pie', text: 'Resumen del Año', action: 'renderYearSummary' },
            { icon: 'fa-book-open', text: 'Cuaderno de Notas', action: 'renderGradebook' }
        ];
        items.forEach(item => addMenuItem(menu, item));
        renderStudentHome(); // Vista por defecto (ver imagen referencia 4)
    }
}

function addMenuItem(menu, item) {
    const li = document.createElement('li');
    li.innerHTML = `<i class="fa-solid ${item.icon}"></i> ${item.text}`;
    li.onclick = () => {
        // Remover clase activa de todos
        document.querySelectorAll('.sidebar li').forEach(el => el.classList.remove('active-link'));
        li.classList.add('active-link');
        // Ejecutar función dinámica
        window[item.action](); 
    };
    menu.appendChild(li);
}

// --- VISTAS ESPECÍFICAS (Renderizado Dinámico) ---

// 1. VISTA ESTUDIANTE: RESUMEN DEL AÑO (Referencia imagen 1)
window.renderYearSummary = () => {
    const content = document.getElementById('dynamic-content');
    document.getElementById('page-title').innerText = "Resumen del Año";
    
    content.innerHTML = `
        <div class="card" style="margin-bottom: 20px; background: linear-gradient(45deg, #1e3a8a, #1e40af);">
            <div style="display: flex; align-items: center; gap: 20px;">
                <img src="https://via.placeholder.com/100" style="border-radius: 10px;">
                <div>
                    <h2>${currentUser.name}</h2>
                    <p>Curso: ${currentUser.course}</p>
                    <div style="display: flex; gap: 30px; margin-top: 10px;">
                        <div><h1>9.3</h1><small>Promedio</small></div>
                        <div><h1>2</h1><small>Faltas</small></div>
                        <div><h1>A</h1><small>Comportamiento</small></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <h3>Avance Académico</h3>
            <div class="progress-track">
                <div class="track-line"></div>
                <div class="step"><i class="fa-solid fa-check"></i></div>
                <div class="step"><i class="fa-solid fa-check"></i></div>
                <div class="step"><i class="fa-solid fa-check"></i></div>
                <div class="step" style="border-color: #555; color: #555;">4</div>
                <div class="step" style="border-color: #555; color: #555;">5</div>
            </div>
            <p style="text-align: center; color: var(--accent);">Periodo en proceso: Trimestre 2</p>
        </div>
    `;
};

// 2. VISTA ESTUDIANTE: CUADERNO DE NOTAS (Referencia imagen 3)
window.renderGradebook = () => {
    const content = document.getElementById('dynamic-content');
    document.getElementById('page-title').innerText = "Cuaderno de Notas";

    content.innerHTML = `
        <div class="card" style="overflow-x: auto;">
            <table class="modern-table">
                <thead>
                    <tr>
                        <th>Asignatura</th>
                        <th>Parcial 1</th>
                        <th>Parcial 2</th>
                        <th>Examen</th>
                        <th>Promedio</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Diseño y Desarrollo WEB</td>
                        <td><span class="grade-box">9.89</span></td>
                        <td><span class="grade-box">10.00</span></td>
                        <td><span class="grade-box">10.00</span></td>
                        <td style="color: var(--primary); font-weight: bold;">9.96</td>
                    </tr>
                    <tr>
                        <td>Programación y Base de Datos</td>
                        <td><span class="grade-box">9.69</span></td>
                        <td><span class="grade-box">9.85</span></td>
                        <td><span class="grade-box">10.00</span></td>
                        <td style="color: var(--primary); font-weight: bold;">9.84</td>
                    </tr>
                    </tbody>
            </table>
        </div>
    `;
};

// 3. VISTA ADMIN: MATRICULACIÓN
window.renderMatricula = () => {
    const content = document.getElementById('dynamic-content');
    document.getElementById('page-title').innerText = "Gestión de Matriculación";
    
    content.innerHTML = `
        <div class="dashboard-grid">
            <div class="card">
                <h3>Datos del Estudiante</h3>
                <form onsubmit="registrarEstudiante(event)">
                    <input type="text" placeholder="Cédula" class="input-modern" required>
                    <input type="date" id="fechaNac" onchange="calcularEdad()" class="input-modern">
                    <input type="text" id="edadAuto" placeholder="Edad (Automático)" readonly class="input-modern">
                    <input type="email" placeholder="Correo Personal" class="input-modern">
                    <button type="submit" class="btn-primary">Matricular</button>
                </form>
            </div>
        </div>
    `;
};

// 4. DOCENTE: GENERADOR IA GEMINI
window.renderExamCreator = () => {
    const content = document.getElementById('dynamic-content');
    document.getElementById('page-title').innerText = "Asistente IA Gemini";

    content.innerHTML = `
        <div class="card">
            <h3>Generar Evaluación Automática</h3>
            <p>Describe el tema y la dificultad para que Gemini genere las preguntas.</p>
            <textarea id="ai-prompt" style="width: 100%; height: 100px; background: #2d3748; color: white; border: none; padding: 10px; margin: 10px 0; border-radius: 10px;" placeholder="Ej: Crea 5 preguntas de selección múltiple sobre HTML5 para nivel intermedio..."></textarea>
            <button onclick="callGeminiAPI()" class="btn-primary" style="background: var(--primary); border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold;">Generar Examen</button>
            
            <div id="ai-result" style="margin-top: 20px; white-space: pre-wrap;"></div>
        </div>
    `;
}

// --- FUNCIONES LÓGICAS ---

function calcularEdad() {
    const fecha = new Date(document.getElementById('fechaNac').value);
    const hoy = new Date();
    let edad = hoy.getFullYear() - fecha.getFullYear();
    document.getElementById('edadAuto').value = edad + " años";
}

// Simulación de llamada a Gemini API (REAL)
async function callGeminiAPI() {
    const promptInput = document.getElementById('ai-prompt');
    const resultDiv = document.getElementById('ai-result');
    const prompt = promptInput.value;

    // 1. TU API KEY: Pega tu clave aquí dentro de las comillas
    const API_KEY = "AIzaSyBL9yP7dylPLwBdKvZWCkMH5iZJLQcxDtY"; 

    if (!prompt.trim()) {
        alert("Por favor escribe una instrucción para la IA");
        return;
    }
    
    // Mostramos estado de carga
    resultDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando evaluación con IA...';
    
    try {
        // 2. Configuración de la petición a Google
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                })
            }
        );

        const data = await response.json();

        // 3. Extraer el texto de la respuesta compleja de Google
        if (data.candidates && data.candidates.length > 0) {
            const textoGenerado = data.candidates[0].content.parts[0].text;
            
            // 4. Formatear un poco el texto (Markdown básico a HTML)
            // Convierte **texto** en negrita y saltos de línea en <br>
            const textoFormateado = textoGenerado
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');

            resultDiv.innerHTML = `<div style="text-align: left;">${textoFormateado}</div>`;
        } else {
            resultDiv.innerHTML = "La IA no devolvió resultados. Intenta de nuevo.";
        }

    } catch (error) {
        console.error("Error:", error);
        resultDiv.innerHTML = `<span style="color: #ff4444;">Ocurrió un error al conectar con Gemini: ${error.message}</span>`;
    }
}

function logout() {
    location.reload();
}