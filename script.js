// IMPORTANTE: Reemplaza esto con tu configuración real de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const db = getFirestore(app);

// --- LÓGICA DE INTERFAZ ---

// 1. Simulación de Carga Inicial
window.addEventListener('load', () => {
    const progressBar = document.getElementById('progress-bar');
    const loaderScreen = document.getElementById('loader-screen');
    const appContainer = document.getElementById('app-container');
    
    let width = 0;
    const interval = setInterval(() => {
        if (width >= 100) {
            clearInterval(interval);
            // Ocultar loader y mostrar app
            loaderScreen.style.opacity = '0';
            setTimeout(() => {
                loaderScreen.style.display = 'none';
                appContainer.style.display = 'block';
                // Cargar datos iniciales
                mockLoadRankings(); 
            }, 500);
        } else {
            width++;
            progressBar.style.width = width + '%';
        }
    }, 20); // Velocidad de carga simulada
});

// 2. Sistema de Cambio de Roles (Tabs)
window.switchRole = (role) => {
    // Ocultar todas las vistas
    document.querySelectorAll('.role-view').forEach(view => {
        view.classList.remove('active');
    });
    // Mostrar la seleccionada
    document.getElementById(`view-${role}`).classList.add('active');
};

// 3. Sistema de Rankings (Pestañas internas)
window.showRanking = (type) => {
    document.getElementById('ranking-internal').style.display = 'none';
    document.getElementById('ranking-global').style.display = 'none';
    
    // Resetear botones
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    // Activar actual
    document.getElementById(`ranking-${type}`).style.display = 'block';
    event.target.classList.add('active');
};

// --- SIMULACIÓN DE DATOS (En producción esto viene de Firebase) ---
function mockLoadRankings() {
    // En producción usarías: const q = query(collection(db, "students"), where("course", "==", "3ro Info"), orderBy("score", "desc"));
    
    const internalData = [
        { name: "Juan Pérez", score: 98 },
        { name: "Maria Garcia", score: 96 },
        { name: "Usuario Actual", score: 92 }
    ];

    const globalData = [
        { name: "Ana Torres", course: "3ro Contabilidad", score: 99 },
        { name: "Juan Pérez", course: "3ro Informática", score: 98 },
        { name: "Carlos Ruiz", course: "3ro Ciencias", score: 97 }
    ];

    populateTable('tbody-internal', internalData);
    populateTable('tbody-global', globalData, true);
}

function populateTable(id, data, isGlobal = false) {
    const tbody = document.getElementById(id);
    tbody.innerHTML = "";
    data.forEach((student, index) => {
        let row = `<tr>
            <td>${index + 1}</td>
            <td>${student.name}</td>
            ${isGlobal ? `<td>${student.course}</td>` : ''}
            <td><b>${student.score}/100</b></td>
        </tr>`;
        tbody.innerHTML += row;
    });
}

// --- 4. INTEGRACIÓN GEMINI AI (Para Docentes) ---
// NOTA: En un entorno real, la llamada a la API debe hacerse desde el Backend (Cloud Functions)
// para no exponer tu API Key en el frontend.

window.consultarGemini = async () => {
    const promptInput = document.getElementById('ai-prompt').value;
    const mode = document.getElementById('ai-mode').value;
    const outputDiv = document.getElementById('ai-result');
    const outputText = document.getElementById('ai-text-content');
    const btn = document.querySelector('.btn-ai');

    if (!promptInput) return alert("Escribe una instrucción para Gemini");

    btn.textContent = "Pensando...";
    btn.disabled = true;

    // Contexto del sistema según el modo seleccionado
    let systemInstruction = "";
    if (mode === 'exam') systemInstruction = "Actúa como un profesor experto y crea un examen basado en: ";
    if (mode === 'report') systemInstruction = "Redacta un reporte formal para una reunión de padres sobre: ";
    if (mode === 'analysis') systemInstruction = "Analiza el siguiente caso de rendimiento académico y sugiere mejoras: ";

    const fullPrompt = `${systemInstruction} ${promptInput}`;

    try {
        // AQUÍ VA TU LLAVE DE API DE GEMINI (Google AI Studio)
        const API_KEY = "AIzaSyCeVwmI2QhB4LfH-nrDRUjnUDBqYL2yGUw"; 
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }]
            })
        });

        const data = await response.json();
        
        // Renderizar respuesta
        outputDiv.style.display = 'block';
        if(data.candidates && data.candidates.length > 0) {
            // Convertir saltos de línea y negritas de Markdown a HTML simple
            let text = data.candidates[0].content.parts[0].text;
            text = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
            outputText.innerHTML = text;
        } else {
            outputText.innerHTML = "Error al obtener respuesta de Gemini.";
        }

    } catch (error) {
        console.error("Error AI:", error);
        outputText.innerHTML = "Error de conexión con la IA.";
    } finally {
        btn.textContent = "✨ Generar con Gemini";
        btn.disabled = false;
    }
};