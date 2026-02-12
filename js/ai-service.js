/* ==========================================
   SERVICIO DE INTELIGENCIA ARTIFICIAL (GEMINI 3)
   ========================================== */
import { showToast } from './utils.js';

window.AIService = {
    // 👇👇👇 ¡PEGA TU API KEY AQUÍ! 👇👇👇
    apiKey: "AIzaSyDywyqdrinLQIkOBB2s53rOaenM2NBvOVE",
    
    _msgs: [],

    // Lista de modelos por prioridad (Si falla el 1º, usa el 2º...)
    availableModels: [
        "gemini-3-pro-preview",    // 1. El más potente (Tu pedido)
        "gemini-3-flash-preview",  // 2. Rápido y eficiente
        "gemini-2.0-flash",        // 3. Versión anterior
        "gemini-1.5-flash"         // 4. El "tanque" confiable (backup final)
    ],

    // URL base de la API v1beta
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models/",

    /**
     * Función inteligente que prueba modelos en orden hasta que uno funcione
     */
    askGemini: async function(prompt) {
        if (!this.apiKey || this.apiKey.includes("PON_AQUI")) {
            alert("⚠️ FALTA API KEY: Configura tu clave en js/ai-service.js");
            return "Error: Falta configurar la API Key.";
        }

        // Iteramos sobre la lista de modelos
        for (const model of this.availableModels) {
            try {
                console.log(`🤖 Intentando con modelo: ${model}...`);
                const response = await this._callModel(model, prompt);
                return response; // ¡Éxito! Devolvemos la respuesta
            } catch (error) {
                console.warn(`⚠️ Falló ${model}:`, error.message);
                // Si es el último modelo y falló, lanzamos el error definitivo
                if (model === this.availableModels[this.availableModels.length - 1]) {
                    return `Error: Todos los modelos de IA fallaron. Verifica tu API Key o cuota. (${error.message})`;
                }
                // Si no, el bucle continúa con el siguiente modelo...
            }
        }
    },

    /**
     * Llamada individual a la API (Privada)
     */
    _callModel: async function(modelId, prompt) {
        const url = `${this.baseUrl}${modelId}:generateContent?key=${this.apiKey}`;
        
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();

        if (!response.ok || data.error) {
            throw new Error(data.error?.message || "Error desconocido en API");
        }

        return data.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta.";
    },

    /* ================= FUNCIONES DE INTERFAZ (UI) ================= */

    openGlobalHelp: () => {
        window.AIService._msgs = [
            { role: "assistant", text: "Hola 👋 Soy Gemini 3. ¿En qué te ayudo con tu clase?" }
        ];

        window.openModal("Asistente IA (Gemini 3) • Crear Actividad", `
            <div class="ai-chat">
                <div id="aiChatBody" class="ai-chat-body"></div>
                <div class="ai-chat-tools">
                    <button class="btn btn-sm btn-ghost" type="button" onclick="window.AIService.suggestFromForm()">
                        ✨ Analizar Formulario
                    </button>
                    <button class="btn btn-sm btn-ghost" type="button" onclick="window.AIService.clear()">
                        🗑️ Limpiar
                    </button>
                </div>
                <div class="ai-chat-input">
                    <input id="aiChatText" placeholder="Escribe aquí..." onkeypress="if(event.key==='Enter') window.AIService.send()">
                    <button class="btn btn-primary" type="button" onclick="window.AIService.send()">Enviar</button>
                </div>
            </div>
        `);
        window.AIService.render();
    },

    clear: () => {
        window.AIService._msgs = [{ role: "assistant", text: "Chat limpio. ¿Qué necesitas?" }];
        window.AIService.render();
    },

    render: () => {
        const body = document.getElementById("aiChatBody");
        if (!body) return;
        body.innerHTML = window.AIService._msgs.map(m => `
            <div class="ai-msg ${m.role}">
                <div class="bubble">${(m.text || "").replaceAll("<", "&lt;").replaceAll("\n", "<br>")}</div>
            </div>
        `).join("");
        body.scrollTop = body.scrollHeight;
    },

    suggestFromForm: async () => {
        const tipo = document.getElementById("gTipo")?.value || "Actividad";
        const titulo = document.getElementById("gTitulo")?.value || "(Sin título)";
        const desc = document.getElementById("gDesc")?.value || "(Sin descripción)";
        const limite = document.getElementById("gLimite")?.value || "60";

        const prompt = `Actúa como experto pedagógico usando Gemini 3.
        Datos: Tipo: ${tipo}, Título: ${titulo}, Desc: ${desc}, Tiempo: ${limite}min.
        1. Mejora la descripción para que sea motivadora.
        2. Sugiere 3 preguntas de opción múltiple (marca la correcta).
        3. Sugiere 1 pregunta de verdadero/falso.`;

        const input = document.getElementById("aiChatText");
        if(input) input.value = prompt.trim();
        window.AIService.send();
    },

    send: async () => {
        const input = document.getElementById("aiChatText");
        const text = (input?.value || "").trim();
        if (!text) return;

        window.AIService._msgs.push({ role: "user", text });
        if (input) input.value = "";
        window.AIService.render();

        // UI de carga
        const btn = document.querySelector(".ai-chat-input button");
        const originalText = btn ? btn.innerText : "Enviar";
        if(btn) { btn.innerText = "Pensando..."; btn.disabled = true; }

        // Llamada inteligente con fallback
        const responseText = await window.AIService.askGemini(text);

        window.AIService._msgs.push({ role: "assistant", text: responseText });
        
        if(btn) { btn.innerText = originalText; btn.disabled = false; }
        window.AIService.render();
    }
};