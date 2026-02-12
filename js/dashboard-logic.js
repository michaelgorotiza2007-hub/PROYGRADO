import { auth, db, firebaseConfig } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, limit, setDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth as getAuthSecondary, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { showToast } from './utils.js';
// ✅ IMPORTANTE: Importamos el servicio de IA
import './ai-service.js';

let currentUser = null;
let notifUnsubscribe = null;

// ==========================================
// 1. UTILIDADES Y AYUDAS
// ==========================================

const executeMenuFunction = (path) => {
    const parts = path.split('.');
    let fn = window;
    for(let i=1; i<parts.length; i++) {
        if(fn) fn = fn[parts[i]];
    }
    if(typeof fn === 'function') fn();
    else console.error("Función no encontrada:", path);
};

window.openModal = (title, htmlContent) => {
  document.getElementById('modalTitle').innerText = title;
  document.getElementById('modalContent').innerHTML = htmlContent;
  document.getElementById('modalOverlay').classList.remove('hidden');
};

const sendNotification = async (targetUid, title, msg, type) => {
    try {
        await addDoc(collection(db, "notificaciones"), {
            targetUid, titulo: title, mensaje: msg, type, fecha: new Date().toISOString(), leido: false
        });
    } catch(e) { console.error("Error enviando notificación:", e); }
};

// ==========================================
// 2. FUNCIONES GLOBALES (Window)
// ==========================================
window.System = {
    logout: async () => {
        if (notifUnsubscribe) notifUnsubscribe();
        await signOut(auth);
        window.location.href = 'index.html';
    },
    
    closeModal: () => document.getElementById('modalOverlay').classList.add('hidden'),
    
    toggleNotif: () => {
        const p = document.getElementById('notifPanel');
        p.classList.toggle('hidden');
        if (!p.classList.contains('hidden')) {
            const badge = document.getElementById('notifDot');
            if(badge) badge.style.display = 'none';
        }
    },

    markRead: async (id) => {
        await updateDoc(doc(db, "notificaciones", id), { leido: true });
    },
};

window.cycle = (el) => {
    const s=['-','P','F','A'];
    const n = s[(s.indexOf(el.innerText)+1)%s.length];
    el.innerText=n; el.setAttribute('data-v',n);
};

// ==========================================
// 3. CONTROLADORES
// ==========================================

// --- ADMIN ---
window.Admin = {
    renderDashboard: async () => {
        document.getElementById('pageTitle').innerText = "Dashboard Admin";
        const main = document.getElementById('mainArea');
        main.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>';

        try {
            const uSnap = await getDocs(collection(db, "users"));
            const cSnap = await getDocs(collection(db, "cursos"));
            let st=0, tc=0;
            uSnap.forEach(d => { if(d.data().rol === 'estudiante') st++; if(d.data().rol === 'docente') tc++; });

            main.innerHTML = `
                <div class="grid-3">
                    <div class="stat-card"><span class="stat-val" style="color:var(--primary)">${st}</span><small>Estudiantes</small></div>
                    <div class="stat-card"><span class="stat-val" style="color:var(--secondary)">${tc}</span><small>Docentes</small></div>
                    <div class="stat-card"><span class="stat-val" style="color:var(--success)">${cSnap.size}</span><small>Cursos</small></div>
                </div>
                <div class="card" style="margin-top:20px"><h3>Accesos Rápidos</h3><div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;">
                    <button class="btn btn-primary" onclick="window.Admin.modalUser()">+ Alumno</button>
                    <button class="btn btn-primary" onclick="window.Admin.modalTeacher()">+ Docente</button>
                    <button class="btn btn-ghost" onclick="window.Admin.modalMateria()">+ Materia</button>
                </div></div>`;
        } catch(e) { main.innerHTML = `<p>Error cargando dashboard: ${e.message}</p>`; }
    },

    renderAcademic: async () => {
        document.getElementById('pageTitle').innerText = "Gestión Académica";
        document.getElementById('mainArea').innerHTML = `
            <div class="grid-3">
                <div class="card"><h4>Periodos</h4><button class="btn btn-sm btn-ghost" onclick="window.Admin.addPeriodo()">+ Crear</button><div id="listP"></div></div>
                <div class="card"><h4>Cursos</h4><button class="btn btn-sm btn-ghost" onclick="window.Admin.addCurso()">+ Crear</button><div id="listC"></div></div>
                <div class="card"><h4>Materias</h4><button class="btn btn-sm btn-primary" onclick="window.Admin.modalMateria()">+ Asignar</button><div id="listM"></div></div>
            </div>`;
        window.Admin.loadLists();
    },

    loadLists: async () => {
        getDocs(collection(db, "periodos")).then(snap => {
            let h=''; snap.forEach(d=>h+=`<div style="padding:8px;border-bottom:1px solid #eee">${d.data().nombre}</div>`);
            const el = document.getElementById('listP'); if(el) el.innerHTML=h||'Vacío';
        });
        
        getDocs(collection(db, "cursos")).then(snap => {
            let h=''; snap.forEach(d=>h+=`<div style="padding:8px;border-bottom:1px solid #eee">${d.data().nombre}</div>`);
            const el = document.getElementById('listC'); if(el) el.innerHTML=h||'Vacío';
        });

        getDocs(collection(db,"materias")).then(snap => {
            let h=''; snap.forEach(d=>h+=`<div style="padding:8px;border-bottom:1px solid #eee"><b>${d.data().nombre}</b></div>`);
            const el = document.getElementById('listM'); if(el) el.innerHTML=h||'Vacío';
        });
    },

    addPeriodo: async () => { const n=prompt("Nombre:"); if(n){ await addDoc(collection(db,"periodos"),{nombre:n}); window.Admin.loadLists(); } },
    addCurso: async () => { const n=prompt("Nombre:"); if(n){ await addDoc(collection(db,"cursos"),{nombre:n}); window.Admin.loadLists(); } },

    modalMateria: async () => {
        const ds = await getDocs(query(collection(db,"users"),where("rol","==","docente")));
        let dOpt=''; ds.forEach(d=>dOpt+=`<option value="${d.id}">${d.data().nombres}</option>`);
        const cs = await getDocs(collection(db,"cursos"));
        let cOpt=''; cs.forEach(c=>cOpt+=`<option value="${c.id}">${c.data().nombre}</option>`);
        
        window.openModal("Asignar Materia", `
            <div class="form-group"><label>Materia</label><input id="mn" class="form-control"></div>
            <div class="form-group"><label>Curso</label><select id="mc" class="form-control">${cOpt}</select></div>
            <div class="form-group"><label>Docente</label><select id="md" class="form-control">${dOpt}</select></div>
            <button id="btnSaveMat" class="btn btn-primary" style="width:100%; margin-top:10px;" onclick="window.Admin.saveMateria()">Guardar</button>
        `);
    },

    saveMateria: async () => {
        const btn = document.getElementById('btnSaveMat');
        const name = document.getElementById('mn').value;
        const cursoId = document.getElementById('mc').value;
        const docId = document.getElementById('md').value;

        if(!name) return alert("Ingrese un nombre");
        btn.innerText = "Guardando..."; btn.disabled = true;

        try {
            await addDoc(collection(db,"materias"), { nombre:name, cursoId:cursoId, docenteUid:docId });
            await sendNotification(docId, "Nueva Asignación", `Materia: ${name}`, "admin");
            await window.Admin.loadLists();
            window.System.closeModal(); 
            showToast("Materia Asignada");
        } catch(e) {
            alert("Error al guardar: " + e.message);
            btn.innerText = "Guardar"; btn.disabled = false;
        }
    },

    renderTeachers: async () => {
        document.getElementById('pageTitle').innerText = "Plana Docente";
        document.getElementById('mainArea').innerHTML = `
            <div style="text-align:right; margin-bottom:15px"><button class="btn btn-primary" onclick="window.Admin.modalTeacher()">+ Nuevo Docente</button></div>
            <div id="tList" class="card">Cargando...</div>`;
        const snap = await getDocs(query(collection(db,"users"),where("rol","==","docente")));
        let h = `<table class="data-table"><thead><tr><th>Nombre</th><th>Email</th><th>Estado</th></tr></thead><tbody>`;
        snap.forEach(d => h += `<tr><td>${d.data().nombres}</td><td>${d.data().email}</td><td><span class="badge bg-green">Activo</span></td></tr>`);
        document.getElementById('tList').innerHTML = h + "</tbody></table>";
    },

    modalTeacher: () => {
        window.openModal("Nuevo Docente", `
            <input id="dn" placeholder="Nombre Completo"><input id="de" placeholder="Email"><input id="dp" type="password" placeholder="Contraseña">
            <button id="btnSaveT" class="btn btn-primary" style="width:100%" onclick="window.Admin.saveTeacher()">Registrar</button>
        `);
    },

    saveTeacher: async () => {
        const btn = document.getElementById('btnSaveT');
        btn.innerText = "Registrando..."; btn.disabled = true;
        try {
            const app2 = initializeApp(firebaseConfig, "App2"); const auth2 = getAuthSecondary(app2);
            const cred = await createUserWithEmailAndPassword(auth2, document.getElementById('de').value, document.getElementById('dp').value);
            await setDoc(doc(db,"users",cred.user.uid), {nombres:document.getElementById('dn').value, email:document.getElementById('de').value, rol:'docente'});
            await deleteApp(app2);
            window.System.closeModal(); window.Admin.renderTeachers(); showToast("Docente registrado");
        } catch(e) { alert(e.message); btn.disabled = false; btn.innerText = "Registrar"; }
    },

    renderUsers: async () => {
        document.getElementById('pageTitle').innerText = "Directorio Estudiantil";
        document.getElementById('mainArea').innerHTML = `
            <div style="text-align:right; margin-bottom:15px"><button class="btn btn-primary" onclick="window.Admin.modalUser()">+ Nuevo Alumno</button></div>
            <div id="uList" class="card">Cargando...</div>`;
        const snap = await getDocs(query(collection(db,"users"), where("rol","==","estudiante")));
        let h = `<table class="data-table"><thead><tr><th>Nombre</th><th>Curso</th></tr></thead><tbody>`;
        snap.forEach(d=>h+=`<tr><td>${d.data().nombres}<br><small>${d.data().cedula}</small></td><td>${d.data().cursoNombre||'-'}</td></tr>`);
        document.getElementById('uList').innerHTML = h+"</tbody></table>";
    },

    modalUser: async () => {
        const cs = await getDocs(collection(db,"cursos"));
        let opt=''; cs.forEach(c=>opt+=`<option value="${c.id}|${c.data().nombre}">${c.data().nombre}</option>`);
        window.openModal("Nuevo Alumno", `
            <div class="grid-2"><input id="sn" placeholder="Nombre"><input id="sa" placeholder="Apellido"><input id="sc" placeholder="Cédula"><select id="sk">${opt}</select><input id="sm" placeholder="Email"><input id="sp" placeholder="Pass"></div>
            <h4>Representante</h4><div class="grid-2"><input id="rn" placeholder="Nombre Rep"><input id="rc" placeholder="Cédula Rep"></div>
            <button id="btnSaveU" class="btn btn-primary" style="width:100%" onclick="window.Admin.saveUser()">Guardar</button>
        `);
    },

    saveUser: async () => {
        const btn = document.getElementById('btnSaveU');
        btn.innerText = "Guardando..."; btn.disabled = true;
        try {
            const app2 = initializeApp(firebaseConfig, "App2"); const auth2 = getAuthSecondary(app2);
            const cred = await createUserWithEmailAndPassword(auth2, document.getElementById('sm').value, document.getElementById('sp').value);
            const inf = document.getElementById('sk').value.split('|');
            await setDoc(doc(db,"users",cred.user.uid), {
                nombres:document.getElementById('sn').value, apellidos:document.getElementById('sa').value, rol:'estudiante',
                cursoId:inf[0], cursoNombre:inf[1], cedula:document.getElementById('sc').value, proximoPago: new Date().toISOString().split('T')[0],
                representante:{nombres:document.getElementById('rn').value, cedula:document.getElementById('rc').value}
            });
            await deleteApp(app2); window.System.closeModal(); window.Admin.renderUsers(); showToast("Registrado");
        } catch(e) { alert(e.message); btn.disabled=false; btn.innerText="Guardar"; }
    },

    renderPayments: async () => {
        document.getElementById('pageTitle').innerText = "Pagos";
        document.getElementById('mainArea').innerHTML = `<div id="pl" class="card">Cargando...</div>`;
        const snap = await getDocs(query(collection(db,"users"),where("rol","==","estudiante")));
        let h=`<table class="data-table"><thead><tr><th>Alumno</th><th>Estado</th><th>Acción</th></tr></thead><tbody>`;
        snap.forEach(d=>{
            const u=d.data();
            const dias = Math.floor((new Date()-new Date(u.proximoPago))/86400000);
            let st='bg-green',tx='Al día';
            if(dias>20){st='bg-red';tx='Bloqueado';}else if(dias>10){st='bg-yellow';tx='Mora';}
            h+=`<tr><td>${u.nombres}</td><td><span class="badge ${st}">${tx}</span></td><td><button class="btn btn-sm btn-ghost" onclick="window.Admin.cobrar('${d.id}')">Cobrar</button></td></tr>`;
        });
        document.getElementById('pl').innerHTML = h+"</tbody></table>";
    },
};

// --- DOCENTE ---
window.Teacher = {
    renderWelcome: () => document.getElementById('mainArea').innerHTML = `<div class="card"><h3>Bienvenido</h3><p>Seleccione un curso del menú.</p></div>`,
    
    renderCreateActivityPage: (mId, cId) => {
        document.getElementById('pageTitle').innerText = "Crear Actividad";
        const main = document.getElementById('mainArea');
        main.innerHTML = `
            <div class="card" style="padding:18px;">
            <div class="form-group"><label>Tipo</label><select id="at"><option>Actividad</option><option>Tarea</option><option>Examen</option></select></div>
            <div class="form-group"><label>Título</label><input id="an" placeholder="Ej: Evaluación Unidad 1"></div>
            <div class="form-group"><label>Descripción</label><textarea id="ad" placeholder="Instrucciones..."></textarea></div>
            <div class="grid-2">
                <div class="form-group"><label>Fecha</label><input type="date" id="af"></div>
                <div class="form-group"><label>Tiempo límite (minutos)</label><input type="number" id="alim" min="1" value="60"></div>
            </div>
            <div class="card" style="padding:18px; margin-top:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
                <h4 style="margin:0;">Preguntas</h4>
                <button class="btn btn-sm btn-primary" type="button" onclick="window.Teacher.addQuestion()">+ Agregar pregunta</button>
                </div>
                <div id="qList" style="margin-top:12px;"></div>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:12px;">
                <button class="btn btn-ghost" onclick="window.Teacher.loadTab('act','${mId}','${cId}')">Cancelar</button>
                <button class="btn btn-primary" onclick="window.Teacher.saveAct('${mId}','${cId}')">Publicar</button>
            </div>
            </div>`;
        window.Teacher.renderQuestions();
    },

    renderClasses: async () => {
        const main = document.getElementById('mainArea');
        main.innerHTML = '<div class="loading">Cargando...</div>';
        const snap = await getDocs(query(collection(db,"materias"), where("docenteUid","==",currentUser.uid)));
        let h = '<div class="grid-2">';
        snap.forEach(d => {
            h += `<div class="card" onclick="window.Teacher.manage('${d.id}','${d.data().nombre}','${d.data().cursoId}')" style="cursor:pointer; border-left:4px solid var(--primary)"><h3>${d.data().nombre}</h3><p>Gestionar</p></div>`;
        });
        main.innerHTML = h+"</div>";
    },

    reviewActivity: async (tareaId, materiaId, cursoId, titulo) => {
        document.getElementById('pageTitle').innerText = `Revisar: ${titulo}`;
        const main = document.getElementById('mainArea');
        main.innerHTML = '<div class="loading">Cargando...</div>';

        const studentsSnap = await getDocs(query(collection(db,"users"), where("cursoId","==",cursoId), where("rol","==","estudiante")));
        const entregasSnap = await getDocs(query(collection(db,"entregas"), where("tareaId","==",tareaId), where("cursoId","==",cursoId)));

        const entregaMap = {};
        entregasSnap.forEach(e => entregaMap[e.data().estudianteUid] = { id: e.id, ...e.data() });

        let h = `<div class="card"><h3 style="margin-bottom:10px;">Estudiantes</h3><table class="data-table"><thead><tr><th>Estudiante</th><th>Estado</th><th>Acción</th></tr></thead><tbody>`;

        studentsSnap.forEach(s => {
            const u = s.data();
            const ent = entregaMap[s.id];
            let badge = `<span class="badge bg-yellow">SIN ENVIAR</span>`;
            if (ent?.estado === "en_progreso") badge = `<span class="badge bg-yellow">EN PROGRESO</span>`;
            if (ent?.estado === "enviado") badge = `<span class="badge bg-green">ENVIADO</span>`;
            if (ent?.estado === "caducado") badge = `<span class="badge bg-red">CADUCADO</span>`;
            if (ent?.estado === "calificado") badge = `<span class="badge bg-green">CALIFICADO</span>`;

            const btn = ent ? `<button class="btn btn-sm btn-primary" onclick="window.Teacher.openEntrega('${tareaId}','${ent.id}','${(u.nombres||'').replaceAll("'", "\\'")}')">Ver</button>` : `<button class="btn btn-sm btn-ghost" disabled>—</button>`;
            h += `<tr><td>${u.nombres}</td><td>${badge}</td><td>${btn}</td></tr>`;
        });
        h += `</tbody></table></div>`;
        main.innerHTML = h;
    },

    openEntrega: async (tareaId, entregaId, estudianteNombre) => {
        const tareaSnap = await getDoc(doc(db,"tareas",tareaId));
        const entregaSnap = await getDoc(doc(db,"entregas",entregaId));
        if (!tareaSnap.exists() || !entregaSnap.exists()) return alert("No encontrado.");

        const tarea = { id: tareaId, ...tareaSnap.data() };
        const entrega = { id: entregaId, ...entregaSnap.data() };
        const preguntas = tarea.preguntas || [];
        const ans = entrega.respuestas || {};
        const detail = entrega.detalleAuto || {};

        let html = `<div class="card" style="padding:16px; margin-bottom:12px;"><h3 style="margin:0;">${estudianteNombre}</h3><div style="margin-top:8px; color:var(--text-muted);">Estado: <b>${(entrega.estado||"-").toUpperCase()}</b> — Auto: <b>${entrega.puntosAuto ?? 0}/${entrega.puntosTotalesAuto ?? 0}</b></div></div>`;

        preguntas.forEach((q, idx) => {
            const pid = q.id || `q${idx+1}`;
            const pts = Number(q.puntos || 1);
            const a = ans[pid];
            let tag = `<span class="badge bg-yellow">MANUAL</span>`;
            if (q.tipo === "multiple" || q.tipo === "vf") {
                tag = detail[pid]?.ok ? `<span class="badge bg-green">OK</span>` : `<span class="badge bg-red">MAL</span>`;
            }

            html += `<div class="card" style="padding:16px; margin-bottom:12px;"><div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;"><div style="font-weight:800;">${idx+1}. ${q.enunciado||""}</div><div style="display:flex; gap:8px; align-items:center;">${tag}<span class="badge bg-yellow">${pts} pts</span></div></div>`;

            if (q.tipo === "multiple") {
                const sel = (a === undefined || a === null) ? "-" : (q.opciones?.[a] ?? "-");
                const corr = q.opciones?.[q.correctaIndex] ?? "-";
                html += `<div style="margin-top:10px;"><b>Respuesta:</b> ${sel}</div><div style="margin-top:6px;"><b>Correcta:</b> ${corr}</div>`;
            } else if (q.tipo === "vf") {
                html += `<div style="margin-top:10px;"><b>Respuesta:</b> ${String(a)}</div><div style="margin-top:6px;"><b>Correcta:</b> ${String(q.correctaBool)}</div>`;
            } else if (q.tipo === "emparejar") {
                const izq = q.izq || [];
                const der = q.der || [];
                const studentMap = (a && typeof a === "object") ? a : {};
                const correctMap = q.pares || {};
                html += `<div style="margin-top:10px;">`;
                izq.forEach((leftText, li) => {
                    const sIdx = studentMap[String(li)];
                    const cIdx = correctMap[String(li)];
                    const sTxt = (sIdx === undefined || sIdx === null) ? "-" : (der[sIdx] ?? "-");
                    const cTxt = (cIdx === undefined || cIdx === null) ? "-" : (der[cIdx] ?? "-");
                    const ok = Number(sIdx) === Number(cIdx);
                    html += `<div style="padding:10px; border-radius:12px; margin-bottom:10px; border:1px solid rgba(0,0,0,0.08); background:${ok ? "#d1fae5" : "#fee2e2"};"><b>${leftText}</b><br>Tu emparejaste: <b>${sTxt}</b><br>Correcto: <b>${cTxt}</b></div>`;
                });
                html += `</div>`;
            } else {
                const txt = (a || "").toString().replaceAll("<","&lt;");
                const manualVal = (entrega.manualPuntos?.[pid] ?? "");
                html += `<div style="margin-top:10px;"><b>Respuesta:</b><div style="background:#f8fafc; padding:12px; border-radius:10px; margin-top:8px;">${txt || "<i>Sin respuesta</i>"}</div></div><div class="grid-2" style="margin-top:12px;"><div class="form-group"><label>Puntos (0-${pts})</label><input type="number" min="0" max="${pts}" value="${manualVal}" onchange="window.Teacher.setManualPoint('${pid}', this.value)"></div></div>`;
            }
            html += `</div>`;
        });

        html += `<div class="card" style="padding:16px;"><button class="btn btn-primary" style="width:100%;" onclick="window.Teacher.saveCalificacion('${tareaId}','${entregaId}','${entrega.estudianteUid}')">Guardar calificación final</button></div>`;

        window.Teacher._manualPoints = { ...(entrega.manualPuntos || {}) };
        window.openModal(`Revisión - ${estudianteNombre}`, html);
    },

    setManualPoint: (pid, val) => {
        if (!window.Teacher._manualPoints) window.Teacher._manualPoints = {};
        window.Teacher._manualPoints[pid] = Number(val || 0);
    },

    saveCalificacion: async (tareaId, entregaId, estudianteUid) => {
        const tareaSnap = await getDoc(doc(db,"tareas",tareaId));
        const entregaSnap = await getDoc(doc(db,"entregas",entregaId));
        if (!tareaSnap.exists() || !entregaSnap.exists()) return alert("No encontrado.");

        const tarea = tareaSnap.data();
        const preguntas = tarea.preguntas || [];
        const entrega = entregaSnap.data();
        const auto = Number(entrega.puntosAuto || 0);
        let manual = 0;
        preguntas.forEach((q, idx) => {
            const pid = q.id || `q${idx+1}`;
            if (q.tipo === "abierta") manual += Number(window.Teacher._manualPoints?.[pid] || 0);
        });
        const total = auto + manual;

        await updateDoc(doc(db,"entregas",entregaId), {
            manualPuntos: window.Teacher._manualPoints || {},
            puntosManual: manual,
            puntosFinal: total,
            estado: "calificado",
            pendienteManual: false,
            calificadoEn: new Date().toISOString()
        });

        const notaQuery = query(collection(db,"notas"), where("tareaId","==",tareaId), where("estudianteUid","==",estudianteUid));
        const notaSnap = await getDocs(notaQuery);

        if (notaSnap.empty) {
            await addDoc(collection(db,"notas"), { tareaId: tareaId, estudianteUid: estudianteUid, materiaId: tarea.materiaId, valor: total });
        } else {
            await updateDoc(doc(db,"notas",notaSnap.docs[0].id), { valor: total });
        }

        await sendNotification(estudianteUid, "Actividad calificada", `Tu nota final: ${total}`, "nota");
        alert("Calificación guardada.");
        window.System.closeModal();
    },

    renderGlobalActivity: async () => {
        document.getElementById('pageTitle').innerText = "Crear Actividad Global";
        const main = document.getElementById('mainArea');
        main.innerHTML = '<div class="loading">Cargando...</div>';

        const mSnap = await getDocs(query(collection(db,"materias"), where("docenteUid","==",currentUser.uid)));
        if (mSnap.empty) { main.innerHTML = "<p>No tienes materias asignadas.</p>"; return; }

        const cursosMap = {};
        mSnap.forEach(m => cursosMap[m.data().cursoId] = true);
        const cursoIds = Object.keys(cursosMap);

        let cursoHTML = '<div class="grid-2">';
        for (let cursoId of cursoIds) {
            const cursoDoc = await getDoc(doc(db,"cursos",cursoId));
            if (cursoDoc.exists()) {
                cursoHTML += `<div class="card" style="padding:15px; display:flex; justify-content:space-between; align-items:center;"><span>${cursoDoc.data().nombre}</span><input type="checkbox" value="${cursoId}"></div>`;
            }
        }
        cursoHTML += '</div>';

        main.innerHTML = `
        <div class="card" style="padding:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <div><h3 style="margin:0;">Crear Actividad Global</h3><p style="margin:6px 0 0; color:var(--text-muted);">Usa la IA para sugerir preguntas y mejorar instrucciones.</p></div>
                <button id="btnIA" class="btn btn-ghost" type="button">🤖 Ayuda IA</button>
            </div>
            <div class="form-group"><label>Tipo</label><select id="gTipo"><option>Actividad</option><option>Tarea</option><option>Examen</option></select></div>
            <div class="form-group"><label>Título</label><input id="gTitulo"></div>
            <div class="form-group"><label>Descripción</label><textarea id="gDesc"></textarea></div>
            <div class="form-group"><label>Tiempo límite (minutos)</label><input type="number" id="gLimite" value="60" min="1"></div>
            <div class="form-group"><label>Seleccionar Cursos</label>${cursoHTML}</div>
            <div class="card" style="padding:18px; margin-top:12px;">
                <div style="display:flex; justify-content:space-between;"><h4>Preguntas</h4><button class="btn btn-sm btn-primary" onclick="window.Teacher.addQuestion()">+ Agregar pregunta</button></div>
                <div id="qList" style="margin-top:12px;"></div>
            </div>
            <div style="margin-top:15px; display:flex; justify-content:flex-end; gap:10px;">
                <button class="btn btn-ghost" onclick="window.Teacher.renderClasses()">Cancelar</button>
                <button class="btn btn-primary" onclick="window.Teacher.saveGlobalActivity()">Publicar Global</button>
            </div>
        </div>`;

        setTimeout(() => {
            const btn = document.getElementById("btnIA");
            if (btn) {
                btn.addEventListener("click", () => {
                    // ✅ Llama al AIService importado
                    window.AIService.openGlobalHelp();
                });
            }
        }, 0);

        window.Teacher._questions = [];
        window.Teacher.renderQuestions();
    },

    saveGlobalActivity: async () => {
        const titulo = document.getElementById('gTitulo').value;
        if (!titulo) return alert("Ingrese un título");
        const desc = document.getElementById('gDesc').value;
        const tipo = document.getElementById('gTipo').value;
        const tiempoLimiteMin = parseInt(document.getElementById('gLimite').value || "60", 10);
        const qPack = window.Teacher.collectQuestions();
        if (!qPack.ok) return alert(qPack.msg);

        const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
        if (checkboxes.length === 0) return alert("Seleccione al menos un curso");

        for (let checkbox of checkboxes) {
            const mSnap = await getDocs(query(collection(db,"materias"), where("docenteUid","==",currentUser.uid), where("cursoId","==",checkbox.value)));
            if (!mSnap.empty) {
                const materiaId = mSnap.docs[0].id;
                await addDoc(collection(db,"tareas"), {
                    materiaId, tipo, titulo, desc, tiempoLimiteMin,
                    fecha: new Date().toISOString().split('T')[0],
                    preguntas: qPack.preguntas,
                    creado: new Date().toISOString()
                });
                const users = await getDocs(query(collection(db,"users"), where("cursoId","==",checkbox.value)));
                users.forEach(u => sendNotification(u.id, "Nueva Actividad Global", titulo, "tarea"));
            }
        }
        window.Teacher._questions = [];
        alert("Actividad creada correctamente en los cursos seleccionados.");
        window.Teacher.renderClasses();
    },

    renderRanking: async (materiaId, cursoId) => {
        document.getElementById('pageTitle').innerText = "Ranking";
        const cont = document.getElementById('tabCont');
        cont.innerHTML = '<div class="loading">Cargando ranking...</div>';
        const sSnap = await getDocs(query(collection(db,"users"), where("cursoId","==",cursoId), where("rol","==","estudiante")));
        if (sSnap.empty) { cont.innerHTML = "<p>No hay estudiantes.</p>"; return; }

        let ranking = [];
        for (const s of sSnap.docs) {
            const notaSnap = await getDocs(query(collection(db,"notas"), where("materiaId","==",materiaId), where("estudianteUid","==",s.id)));
            let total = 0, count = 0;
            notaSnap.forEach(n => { total += Number(n.data().valor || 0); count++; });
            const promedio = count > 0 ? (total / count) : 0;
            ranking.push({ nombre: s.data().nombres, promedio });
        }
        ranking.sort((a,b)=> b.promedio - a.promedio);

        let html = `<div class="card" style="padding:16px;"><table class="data-table"><thead><tr><th>Puesto</th><th>Estudiante</th><th>Promedio</th></tr></thead><tbody>`;
        ranking.forEach((r,i)=>{
            let medal = ""; if (i === 0) medal = "🥇"; if (i === 1) medal = "🥈"; if (i === 2) medal = "🥉";
            html += `<tr><td>${medal} ${i+1}</td><td>${r.nombre}</td><td>${r.promedio.toFixed(2)}</td></tr>`;
        });
        html += `</tbody></table></div>`;
        cont.innerHTML = html;
    },

    manage: (mId, mName, cId) => {
        document.getElementById('pageTitle').innerText = mName;
        document.getElementById('mainArea').innerHTML = `
            <div style="margin-bottom:20px; display:flex; gap:10px;">
            <button class="btn btn-ghost" onclick="window.Teacher.loadTab('notas','${mId}','${cId}')">Notas</button>
            <button class="btn btn-ghost" onclick="window.Teacher.loadTab('act','${mId}','${cId}')">Actividades</button>
            <button class="btn btn-ghost" onclick="window.Teacher.loadTab('ranking','${mId}','${cId}')">Ranking</button>
            </div>
            <div id="tabCont"></div>`;
        window.Teacher.loadTab('notas', mId, cId);
    },

    loadTab: async (tab, mId, cId) => {
        const c = document.getElementById('tabCont');
        c.innerHTML = '<div class="loading">Cargando...</div>';
        if (tab === 'notas') {
            const pSnap = await getDocs(collection(db,"periodos"));
            const tSnap = await getDocs(query(collection(db,"tareas"), where("materiaId","==",mId)));
            let h = `<div class="card"><div class="grid-2"><div><label>Periodo</label><select id="pSel"><option value="">Seleccione...</option>`;
            pSnap.forEach(p => h += `<option value="${p.id}">${p.data().nombre}</option>`);
            h += `</select></div><div><label>Actividad</label><select id="tSel" onchange="window.Teacher.renderGradeTable('${mId}','${cId}')"><option value="">Seleccione...</option>`;
            tSnap.forEach(t => h += `<option value="${t.id}">${t.data().tipo}: ${t.data().titulo}</option>`);
            h += `</select></div></div></div><div id="gTable"></div>`;
            c.innerHTML = h;
        } else if (tab === 'ranking') {
            window.Teacher.renderRanking(mId, cId);
        } else if (tab === 'act') {
            const snap = await getDocs(query(collection(db,"tareas"), where("materiaId","==",mId)));
            let h = `<div style="text-align:right; margin-bottom:15px"><button class="btn btn-primary" onclick="window.Teacher.renderCreateActivityPage('${mId}','${cId}')">+ Crear Actividad</button></div><div class="grid-2">`;
            snap.forEach(d => {
                const k = d.data();
                h += `<div class="card"><h4>${k.titulo}</h4><p>${k.desc}</p><span class="badge bg-green">${k.tipo}</span><div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;"><button class="btn btn-sm btn-ghost" onclick="window.Teacher.reviewActivity('${d.id}','${mId}','${cId}','${(k.titulo||'').replaceAll("'", "\\'")}')">Revisar</button></div></div>`;
            });
            c.innerHTML = h+"</div>";
        }
    },

    renderGradeTable: async (mId, cId) => {
        const tid = document.getElementById('tSel').value;
        const pid = document.getElementById('pSel').value;
        if(!tid || !pid) return;
        const students = await getDocs(query(collection(db,"users"), where("cursoId","==",cId)));
        let h = `<div class="card"><table class="data-table"><thead><tr><th>Estudiante</th><th>Nota (0-10)</th></tr></thead><tbody>`;
        for (const s of students.docs) {
            const q = query(collection(db,"notas"), where("tareaId","==",tid), where("estudianteUid","==",s.id));
            const nSnap = await getDocs(q);
            const val = nSnap.empty ? '' : nSnap.docs[0].data().valor;
            h += `<tr><td>${s.data().nombres}</td><td><input class="grade-input" type="number" min="0" max="10" value="${val}" onchange="window.Teacher.saveGrade('${tid}','${s.id}','${pid}','${mId}',this.value)"></td></tr>`;
        }
        document.getElementById('gTable').innerHTML = h + "</tbody></table></div>";
    },

    saveGrade: async (tid, uid, pid, mid, val) => {
        if(val < 0 || val > 10) return alert("Nota inválida");
        const q = query(collection(db,"notas"), where("tareaId","==",tid), where("estudianteUid","==",uid));
        const snap = await getDocs(q);
        if(snap.empty) await addDoc(collection(db,"notas"), { tareaId:tid, estudianteUid:uid, periodoId:pid, materiaId:mid, valor:val });
        else await updateDoc(doc(db,"notas",snap.docs[0].id), { valor:val });
        await sendNotification(uid, "Nueva Calificación", `Nota: ${val}`, "nota");
        showToast("Nota guardada");
    },

    modalAct: (mId, cId) => {
        window.openModal("Crear Actividad", `
            <div class="form-group"><label>Tipo</label><select id="at"><option>Actividad</option><option>Tarea</option><option>Examen</option></select></div>
            <div class="form-group"><label>Título</label><input id="an" placeholder="Ej: Evaluación Unidad 1"></div>
            <div class="form-group"><label>Descripción</label><textarea id="ad" placeholder="Instrucciones..."></textarea></div>
            <div class="grid-2"><div class="form-group"><label>Fecha</label><input type="date" id="af"></div><div class="form-group"><label>Tiempo límite (minutos)</label><input type="number" id="alim" min="1" value="60"></div></div>
            <div class="card" style="padding:18px; margin-top:10px;"><div style="display:flex; justify-content:space-between; align-items:center; gap:10px;"><h4 style="margin:0;">Preguntas</h4><button class="btn btn-sm btn-primary" type="button" onclick="window.Teacher.addQuestion()">+ Agregar pregunta</button></div><div id="qList" style="margin-top:12px;"></div></div>
            <button class="btn btn-primary" style="width:100%; margin-top:12px;" onclick="window.Teacher.saveAct('${mId}','${cId}')">Publicar Actividad</button>
        `);
        window.Teacher.renderQuestions();
    },

    _questions: [],

    addQuestion: () => {
        window.Teacher._questions.push({
            tipo: "multiple", enunciado: "", puntos: 1, opciones: ["", "", "", ""], correctaIndex: 0, correctaBool: true,
            izq: ["", "", ""], der: ["", "", ""], pares: { "0": 0, "1": 1, "2": 2 }
        });
        window.Teacher.renderQuestions();
    },

    renderQuestions: () => {
        const cont = document.getElementById("qList");
        if (!cont) return;
        if (!window.Teacher._questions || window.Teacher._questions.length === 0) { cont.innerHTML = `<p style="color:var(--text-muted); margin:0;">Sin preguntas todavía. Agrega una para empezar.</p>`; return; }
        
        let html = "";
        window.Teacher._questions.forEach((q, i) => {
            html += `<div class="card" style="padding:16px; margin-bottom:12px;"><div style="display:flex; justify-content:space-between; align-items:center; gap:10px;"><div style="font-weight:700;">Pregunta ${i + 1}</div><button class="btn btn-sm btn-danger" type="button" onclick="window.Teacher._questions.splice(${i},1); window.Teacher.renderQuestions();">Eliminar</button></div>
            <div class="grid-2" style="margin-top:10px;"><div class="form-group"><label>Tipo</label><select data-qtype="${i}" onchange="window.Teacher._questions[${i}].tipo=this.value; window.Teacher.renderQuestions();">
                <option value="multiple" ${q.tipo==="multiple"?"selected":""}>Opción múltiple</option><option value="vf" ${q.tipo==="vf"?"selected":""}>Verdadero / Falso</option><option value="abierta" ${q.tipo==="abierta"?"selected":""}>Respuesta abierta</option><option value="emparejar" ${q.tipo==="emparejar"?"selected":""}>Unir con líneas</option>
            </select></div><div class="form-group"><label>Puntos</label><input type="number" min="1" value="${q.puntos}" onchange="window.Teacher._questions[${i}].puntos=parseFloat(this.value||1)"></div></div>
            <div class="form-group"><label>Enunciado</label><textarea onchange="window.Teacher._questions[${i}].enunciado=this.value" placeholder="Escribe la pregunta...">${q.enunciado||""}</textarea></div>`;

            if (q.tipo === "multiple") {
                html += `<div class="form-group"><label>Opciones</label>${q.opciones.map((op, idx) => `<div style="display:flex; gap:10px; align-items:center; margin-bottom:10px;"><input style="flex:1;" placeholder="Opción ${idx+1}" value="${op}" onchange="window.Teacher._questions[${i}].opciones[${idx}]=this.value"><label style="display:flex; gap:8px; align-items:center; white-space:nowrap;"><input type="radio" name="mc_${i}" ${q.correctaIndex===idx?"checked":""} onchange="window.Teacher._questions[${i}].correctaIndex=${idx}">Correcta</label></div>`).join("")}</div>`;
            }
            if (q.tipo === "vf") {
                html += `<div class="form-group"><label>Respuesta correcta</label><select onchange="window.Teacher._questions[${i}].correctaBool=(this.value==='true')"><option value="true" ${q.correctaBool===true?"selected":""}>Verdadero</option><option value="false" ${q.correctaBool===false?"selected":""}>Falso</option></select></div>`;
            }
            if (q.tipo === "abierta") {
                html += `<div class="form-group"><label>Nota</label><p style="margin:0; color:var(--text-muted);">Esta pregunta la calificará el docente manualmente.</p></div>`;
            }
            if (q.tipo === "emparejar") {
                const izq = q.izq || ["","",""]; const der = q.der || ["","",""]; if (!q.pares) q.pares = { "0":0, "1":1, "2":2 };
                html += `<div class="grid-2" style="margin-top:12px; gap:12px;"><div><label><b>Columna izquierda</b></label>${izq.map((v, idx) => `<input placeholder="Izquierda ${idx+1}" value="${v||""}" onchange="window.Teacher._questions[${i}].izq[${idx}]=this.value">`).join("")}<button class="btn btn-sm btn-ghost" type="button" onclick="window.Teacher._questions[${i}].izq.push(''); window.Teacher._questions[${i}].der.push(''); window.Teacher._questions[${i}].pares[String(window.Teacher._questions[${i}].izq.length-1)] = window.Teacher._questions[${i}].der.length-1; window.Teacher.renderQuestions();">+ Añadir fila</button></div>
                <div><label><b>Columna derecha</b></label>${der.map((v, idx) => `<input placeholder="Derecha ${idx+1}" value="${v||""}" onchange="window.Teacher._questions[${i}].der[${idx}]=this.value">`).join("")}</div></div>
                <div style="margin-top:12px;"><label><b>Emparejar correcto (izquierda → derecha)</b></label>${izq.map((_, li) => `<div style="display:flex; gap:10px; align-items:center; margin-bottom:10px;"><span style="flex:1; color:var(--text-muted);">Item ${li+1}</span><select style="flex:1;" onchange="window.Teacher._questions[${i}].pares['${li}']=parseInt(this.value,10)">${der.map((__, ri) => `<option value="${ri}" ${(q.pares?.[String(li)]===ri)?"selected":""}>Derecha ${ri+1}</option>`).join("")}</select></div>`).join("")}<p style="color:var(--text-muted); margin:0;">(Luego el estudiante selecciona la pareja para cada item de la izquierda)</p></div>`;
            }
            html += `</div>`;
        });
        cont.innerHTML = html;
    },

    collectQuestions: () => {
        const qs = window.Teacher._questions || [];
        if (qs.length === 0) return { ok:false, msg:"Agrega al menos 1 pregunta." };
        for (const q of qs) {
            if (!q.enunciado || !q.enunciado.trim()) return { ok:false, msg:"Todas las preguntas deben tener enunciado." };
            if (q.tipo === "multiple") {
                const filled = (q.opciones || []).filter(x => (x||"").trim() !== "");
                if (filled.length < 2) return { ok:false, msg:"En opción múltiple, pon mínimo 2 opciones completas." };
            }
        }
        for (const q of qs) {
            if (q.tipo === "emparejar") {
                const izqF = (q.izq || []).filter(x => (x || "").trim() !== "");
                const derF = (q.der || []).filter(x => (x || "").trim() !== "");
                if (izqF.length < 2 || derF.length < 2) return { ok: false, msg: "En 'Unir con líneas' necesitas mínimo 2 items en cada columna." };
            }
        }
        const out = qs.map(q => {
            const base = { tipo: q.tipo, enunciado: q.enunciado.trim(), puntos: Number(q.puntos || 1) };
            if (q.tipo === "multiple") return { ...base, opciones: (q.opciones || []).map(x => x || ""), correctaIndex: Number(q.correctaIndex || 0) };
            if (q.tipo === "vf") return { ...base, correctaBool: !!q.correctaBool };
            if (q.tipo === "emparejar") {
                const izq = (q.izq || []).map(x => (x || "").trim());
                const der = (q.der || []).map(x => (x || "").trim());
                return { ...base, izq, der, pares: q.pares || {} };
            }
            return { ...base, requiereRevision: true };
        });
        return { ok:true, preguntas: out };
    },

    saveAct: async (mId, cId) => {
        const t = document.getElementById('an').value;
        if(!t) return;
        const tiempoLimiteMin = parseInt(document.getElementById('alim').value || "60", 10);
        const qPack = window.Teacher.collectQuestions();
        if (!qPack.ok) return alert(qPack.msg);
        await addDoc(collection(db,"tareas"), {
            materiaId: mId, tipo: document.getElementById('at').value, titulo: t, desc: document.getElementById('ad').value,
            fecha: document.getElementById('af').value, tiempoLimiteMin: tiempoLimiteMin, preguntas: qPack.preguntas, creado: new Date().toISOString()
        });
        const users = await getDocs(query(collection(db,"users"), where("cursoId","==",cId)));
        users.forEach(u => sendNotification(u.id, "Nueva Actividad", t, "tarea"));
        window.Teacher._questions = [];
        document.getElementById('pageTitle').innerText = "Actividades";
        window.Teacher.renderClasses();
    },

}; // ✅ CIERRE CORRECTO DE TEACHER (Sin código viejo después)

// --- ESTUDIANTE ---
window.Student = {
    renderDashboard: async () => {
        document.getElementById('pageTitle').innerText = "Mis Materias";
        const main = document.getElementById('mainArea');
        main.innerHTML = '<div class="loading">Cargando...</div>';
        if (!currentUser.cursoId) { main.innerHTML = "<p>Sin curso asignado.</p>"; return; }
        const mSnap = await getDocs(query(collection(db, "materias"), where("cursoId", "==", currentUser.cursoId)));
        if (mSnap.empty) { main.innerHTML = "<p>No hay materias asignadas.</p>"; return; }
        let h = `<div style="display:flex; justify-content:flex-end; margin-bottom:15px;"><button class="btn btn-primary" onclick="window.Student.renderRanking()">Ranking</button></div><div class="grid-2">`;
        mSnap.forEach(m => {
            h += `<div class="card" style="cursor:pointer; border-left:4px solid var(--primary)" onclick="window.Student.openMateria('${m.id}','${m.data().nombre}')"><h3>${m.data().nombre}</h3><p>Ver tareas</p></div>`;
        });
        main.innerHTML = h + "</div>";
    },

    renderRanking: async () => {
        document.getElementById('pageTitle').innerText = "Ranking";
        const main = document.getElementById('mainArea');
        main.innerHTML = '<div class="loading">Cargando ranking...</div>';
        if (!currentUser.cursoId) { main.innerHTML = "<p>Sin curso asignado.</p>"; return; }
        const mSnap = await getDocs(query(collection(db,"materias"), where("cursoId","==",currentUser.cursoId)));
        if (mSnap.empty) { main.innerHTML = "<p>No hay materias.</p>"; return; }
        
        let html = "";
        for (const m of mSnap.docs) {
            const materiaId = m.id;
            const materia = m.data();
            const sSnap = await getDocs(query(collection(db,"users"), where("cursoId","==",currentUser.cursoId), where("rol","==","estudiante")));
            let ranking = [];
            for (const s of sSnap.docs) {
                const entregasSnap = await getDocs(query(collection(db,"entregas"), where("estudianteUid","==",s.id), where("materiaId","==",materiaId), where("estado","==","calificado")));
                let total = 0, count = 0;
                entregasSnap.forEach(e => { total += Number(e.data().puntosFinal || 0); count++; });
                const promedio = count > 0 ? (total / count) : 0;
                ranking.push({ nombre: s.data().nombres, promedio });
            }
            ranking.sort((a,b)=> b.promedio - a.promedio);
            html += `<div class="card" style="padding:16px; margin-bottom:15px;"><h3>${materia.nombre}</h3><table class="data-table"><thead><tr><th>Puesto</th><th>Estudiante</th><th>Promedio</th></tr></thead><tbody>`;
            ranking.forEach((r, i) => {
                let medal = ""; if (i === 0) medal = "🥇"; if (i === 1) medal = "🥈"; if (i === 2) medal = "🥉";
                html += `<tr><td>${medal} ${i+1}</td><td>${r.nombre}</td><td>${r.promedio.toFixed(2)}</td></tr>`;
            });
            html += `</tbody></table></div>`;
        }
        html += `<div style="margin-top:15px;"><button class="btn btn-ghost" onclick="window.Student.renderDashboard()">Volver</button></div>`;
        main.innerHTML = html;
    },

    openTaskPage: async (tid) => {
        const tareaSnap = await getDoc(doc(db, "tareas", tid));
        if (!tareaSnap.exists()) return alert("Actividad no encontrada.");
        const tarea = { id: tid, ...tareaSnap.data() };
        const limiteMin = parseInt(tarea.tiempoLimiteMin || 60, 10);
        document.getElementById('pageTitle').innerText = tarea.titulo;
        const main = document.getElementById('mainArea');

        const q = query(collection(db, "entregas"), where("estudianteUid", "==", currentUser.uid), where("tareaId", "==", tid));
        const s = await getDocs(q);
        let entregaId = null, entrega = null;
        if (!s.empty) { entregaId = s.docs[0].id; entrega = s.docs[0].data(); }

        if (entrega && (entrega.estado === "enviado" || entrega.estado === "calificado" || entrega.estado === "caducado")) {
            main.innerHTML = window.Student.renderReview(tarea, entrega) + `<div style="margin-top:12px; display:flex; justify-content:flex-end;"><button class="btn btn-ghost" onclick="window.Student.renderDashboard()">Volver</button></div>`;
            return;
        }

        if (!entrega) {
            const startedAt = new Date().toISOString();
            const nuevo = { tareaId: tid, estudianteUid: currentUser.uid, cursoId: currentUser.cursoId, materiaId: tarea.materiaId, estado: "en_progreso", inicio: startedAt, tiempoLimiteMin: limiteMin, respuestas: {}, creado: new Date().toISOString() };
            const ref = await addDoc(collection(db, "entregas"), nuevo);
            entregaId = ref.id; entrega = nuevo;
        }

        const startMs = new Date(entrega.inicio).getTime();
        const deadlineMs = startMs + limiteMin * 60 * 1000;
        let remainingMs = Math.max(0, deadlineMs - Date.now());

        main.innerHTML = `<div class="card" style="padding:16px; margin-bottom:12px;"><div style="display:flex; justify-content:space-between; align-items:center; gap:10px;"><div><div style="font-weight:800; color:var(--primary);">Tiempo restante</div><div id="timerBox" style="font-size:1.3rem; font-weight:800;">--:--:--</div></div><div style="text-align:right; color:var(--text-muted);"><div><b>Tipo:</b> ${tarea.tipo || "Actividad"}</div><div><b>Puntos:</b> ${window.Student.totalPoints(tarea)}</div></div></div></div>
        <div class="card" style="padding:16px;"><div style="margin-bottom:10px; color:var(--text-muted);">${tarea.desc || ""}</div><div id="qForm"></div><div style="display:flex; justify-content:flex-end; gap:10px; margin-top:14px;"><button class="btn btn-ghost" onclick="window.Student.renderDashboard()">Volver</button><button id="btnSend" class="btn btn-primary" onclick="window.Student.submitExam('${tarea.id}','${entregaId}')">Enviar</button></div></div>`;

        window.Student.renderExamForm(tarea, entrega);
        window.Student.startTimer(remainingMs, async () => { await window.Student.submitExam(tarea.id, entregaId, true); });
    },

    openMateria: async (materiaId, materiaNombre) => {
        document.getElementById('pageTitle').innerText = materiaNombre;
        const main = document.getElementById('mainArea');
        main.innerHTML = '<div class="loading">Cargando...</div>';
        const tSnap = await getDocs(query(collection(db, "tareas"), where("materiaId", "==", materiaId)));
        if (tSnap.empty) { main.innerHTML = "<p>No hay tareas en esta materia.</p>"; return; }
        const eSnap = await getDocs(query(collection(db, "entregas"), where("estudianteUid", "==", currentUser.uid)));
        const doneMap = {}; eSnap.forEach(e => doneMap[e.data().tareaId] = true);

        let h = '<div class="grid-2">';
        tSnap.forEach(t => {
            const k = t.data();
            const done = doneMap[t.id];
            h += `<div class="card" onclick="window.Student.openTaskPage('${t.id}')" style="cursor:pointer; border-left:4px solid ${done ? 'var(--success)' : 'var(--warning)'}"><h4>${k.titulo}</h4><p>${k.desc}</p><span class="badge ${done ? 'bg-green' : 'bg-yellow'}">${done ? 'COMPLETADO' : 'PENDIENTE'}</span></div>`;
        });
        main.innerHTML = h + "</div>";
    },

    viewTask: async (tid) => {
        // Fallback or specific view logic if needed, currently reusing openTaskPage logic mostly
        const tareaSnap = await getDoc(doc(db, "tareas", tid));
        if (!tareaSnap.exists()) return alert("Actividad no encontrada.");
        const tarea = { id: tid, ...tareaSnap.data() };
        const limiteMin = parseInt(tarea.tiempoLimiteMin || 60, 10);
        const preguntas = Array.isArray(tarea.preguntas) ? tarea.preguntas : [];

        if (preguntas.length === 0) {
            window.openModal(tarea.titulo, `<div style="background:#f8fafc;padding:15px;border-radius:10px;margin-bottom:15px">${tarea.desc || ""}<br><small>Vence: ${tarea.fecha || "-"}</small></div><div style="text-align:right"><button class="btn btn-primary" onclick="window.Student.simpleDone('${tid}')">Marcar Completado</button></div>`);
            return;
        }
        // Redirect to full task page for consistency
        window.Student.openTaskPage(tid);
    },

    simpleDone: async (tid) => {
        await addDoc(collection(db,"entregas"), { tareaId: tid, estudianteUid: currentUser.uid, fecha: new Date().toISOString(), estado: "enviado_simple" });
        window.System.closeModal();
        window.Student.renderDashboard();
    },

    totalPoints: (tarea) => {
        const preguntas = Array.isArray(tarea.preguntas) ? tarea.preguntas : [];
        return preguntas.reduce((acc, q) => acc + Number(q.puntos || 1), 0);
    },

    startTimer: (ms, onFinish) => {
        const box = document.getElementById("timerBox");
        if (!box) return;
        if (window.Student._timerInt) clearInterval(window.Student._timerInt);
        let remaining = ms;
        const fmt = (n) => String(n).padStart(2, "0");
        const tick = async () => {
            const h = Math.floor(remaining / 3600000);
            const m = Math.floor((remaining % 3600000) / 60000);
            const s = Math.floor((remaining % 60000) / 1000);
            box.textContent = `${fmt(h)}:${fmt(m)}:${fmt(s)}`;
            if (remaining <= 0) {
                clearInterval(window.Student._timerInt);
                window.Student._timerInt = null;
                box.textContent = "00:00:00";
                if (typeof onFinish === "function") await onFinish();
                return;
            }
            remaining -= 1000;
        };
        tick();
        window.Student._timerInt = setInterval(tick, 1000);
    },

    renderExamForm: (tarea, entrega) => {
        const cont = document.getElementById("qForm");
        if (!cont) return;
        const preguntas = tarea.preguntas || [];
        const respuestas = entrega.respuestas || {};
        let html = "";

        preguntas.forEach((q, idx) => {
            const pid = q.id || `q${idx+1}`;
            const saved = respuestas[pid];
            html += `<div class="card" style="padding:16px; margin-bottom:12px;"><div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;"><div style="font-weight:800;">${idx+1}. ${q.enunciado || ""}</div><div class="badge bg-yellow">${Number(q.puntos||1)} pts</div></div>`;
            if (q.imagenUrl) html += `<img src="${q.imagenUrl}" alt="img" style="max-width:100%; border-radius:12px; margin-top:10px;">`;

            if (q.tipo === "multiple") {
                html += `<div style="margin-top:12px;">`;
                q.opciones.forEach((op, j) => {
                    const checked = (saved === j) ? "checked" : "";
                    html += `<label style="display:flex; gap:10px; align-items:center; padding:10px; border:1px solid rgba(0,0,0,0.08); border-radius:12px; margin-bottom:10px; cursor:pointer;"><input type="radio" name="ans_${tarea.id}_${pid}" value="${j}" ${checked} onchange="window.Student.saveLocalAnswer('${pid}', ${j})"><span>${op || ""}</span></label>`;
                });
                html += `</div>`;
            } else if (q.tipo === "vf") {
                const v = (saved === true) ? "checked" : "";
                const f = (saved === false) ? "checked" : "";
                html += `<div style="margin-top:12px; display:flex; gap:12px; flex-wrap:wrap;"><label style="display:flex; gap:10px; align-items:center; padding:10px 12px; border:1px solid rgba(0,0,0,0.08); border-radius:12px; cursor:pointer;"><input type="radio" name="ans_${tarea.id}_${pid}" value="true" ${v} onchange="window.Student.saveLocalAnswer('${pid}', true)">Verdadero</label><label style="display:flex; gap:10px; align-items:center; padding:10px 12px; border:1px solid rgba(0,0,0,0.08); border-radius:12px; cursor:pointer;"><input type="radio" name="ans_${tarea.id}_${pid}" value="false" ${f} onchange="window.Student.saveLocalAnswer('${pid}', false)">Falso</label></div>`;
            } else if (q.tipo === "emparejar") {
                const izq = q.izq || []; const der = q.der || []; const savedMap = (saved && typeof saved === "object") ? saved : {};
                html += `<div style="margin-top:12px;">`;
                izq.forEach((leftText, li) => {
                    const cur = savedMap[String(li)];
                    html += `<div style="display:flex; gap:12px; align-items:center; margin-bottom:10px;"><div style="flex:1; padding:10px; border:1px solid rgba(0,0,0,0.08); border-radius:12px;">${leftText || ""}</div><select style="flex:1;" onchange="const map = (window.Student._currentAnswers['${pid}'] && typeof window.Student._currentAnswers['${pid}']==='object') ? window.Student._currentAnswers['${pid}'] : {}; map['${li}'] = parseInt(this.value,10); window.Student.saveLocalAnswer('${pid}', map);"><option value="">Selecciona...</option>${der.map((rightText, ri) => `<option value="${ri}" ${(cur===ri)?"selected":""}>${rightText || ""}</option>`).join("")}</select></div>`;
                });
                html += `</div>`;
            } else {
                const txt = (typeof saved === "string") ? saved : "";
                html += `<div class="form-group" style="margin-top:12px;"><label>Respuesta</label><textarea placeholder="Escribe tu respuesta..." onchange="window.Student.saveLocalAnswer('${pid}', this.value)">${txt}</textarea></div>`;
            }
            html += `</div>`;
        });
        cont.innerHTML = html;
        window.Student._currentAnswers = { ...(respuestas || {}) };
    },

    saveLocalAnswer: (pid, value) => {
        if (!window.Student._currentAnswers) window.Student._currentAnswers = {};
        window.Student._currentAnswers[pid] = value;
    },

    gradeAuto: (tarea, answers) => {
        const preguntas = tarea.preguntas || [];
        let puntosAuto = 0;
        let puntosTotalesAuto = 0;
        const detail = {};
        preguntas.forEach((q, idx) => {
            const pid = q.id || `q${idx+1}`;
            const pts = Number(q.puntos || 1);
            if (q.tipo === "multiple") {
                puntosTotalesAuto += pts;
                const ok = Number(answers[pid]) === Number(q.correctaIndex);
                if (ok) puntosAuto += pts;
                detail[pid] = { auto: true, ok, pts };
            } else if (q.tipo === "vf") {
                puntosTotalesAuto += pts;
                const ok = Boolean(answers[pid]) === Boolean(q.correctaBool);
                if (ok) puntosAuto += pts;
                detail[pid] = { auto: true, ok, pts };
            } else if (q.tipo === "emparejar") {
                puntosTotalesAuto += pts;
                const studentMap = (answers[pid] && typeof answers[pid] === "object") ? answers[pid] : {};
                const correctMap = q.pares || {};
                let ok = true;
                for (const key in correctMap) { if (Number(studentMap[key]) !== Number(correctMap[key])) { ok = false; break; } }
                if (ok) puntosAuto += pts;
                detail[pid] = { auto:true, ok, pts };
            } else {
                detail[pid] = { auto: false, ok: null, pts };
            }
        });
        return { puntosAuto, puntosTotalesAuto, detail };
    },

    submitExam: async (tareaId, entregaId, isAuto = false) => {
        const btn = document.getElementById("btnSend");
        if (btn) { btn.disabled = true; btn.innerText = isAuto ? "Auto-enviando..." : "Enviando..."; }
        const tareaSnap = await getDoc(doc(db, "tareas", tareaId));
        if (!tareaSnap.exists()) return alert("Actividad no encontrada.");
        const tarea = { id: tareaId, ...tareaSnap.data() };
        const answers = window.Student._currentAnswers || {};
        const g = window.Student.gradeAuto(tarea, answers);
        const hayAbiertas = (tarea.preguntas || []).some(q => q.tipo === "abierta");
        await updateDoc(doc(db, "entregas", entregaId), {
            respuestas: answers, estado: isAuto ? "caducado" : "enviado", enviadoEn: new Date().toISOString(),
            puntosAuto: g.puntosAuto, puntosTotalesAuto: g.puntosTotalesAuto, detalleAuto: g.detail, pendienteManual: hayAbiertas
        });
        window.System.closeModal();
        window.Student.renderDashboard();
    },

    renderReview: (tarea, entrega) => {
        const preguntas = tarea.preguntas || [];
        const answers = entrega.respuestas || {};
        const detail = entrega.detalleAuto || {};
        let html = `<div class="card" style="padding:16px; margin-bottom:12px;"><div style="display:flex; justify-content:space-between; gap:10px; align-items:center;"><div><div style="font-weight:800; color:var(--primary);">Estado</div><div class="badge bg-green">${(entrega.estado || "ENVIADO").toUpperCase()}</div></div><div style="text-align:right;"><div><b>Auto:</b> ${entrega.puntosAuto ?? 0}/${entrega.puntosTotalesAuto ?? 0}</div><div style="color:var(--text-muted);"><small>Abiertas: ${entrega.pendienteManual ? "Pendiente" : "N/A"}</small></div></div></div></div>`;

        preguntas.forEach((q, idx) => {
            const pid = q.id || `q${idx+1}`;
            const pts = Number(q.puntos || 1);
            const a = answers[pid];
            let estadoColor = "bg-yellow";
            if (q.tipo === "multiple" || q.tipo === "vf" || q.tipo === "emparejar") { estadoColor = detail[pid]?.ok ? "bg-green" : "bg-red"; }
            html += `<div class="card" style="padding:16px; margin-bottom:12px;"><div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;"><div style="font-weight:800;">${idx+1}. ${q.enunciado || ""}</div><div style="display:flex; gap:8px; align-items:center;"><span class="badge ${estadoColor}">${q.tipo === "abierta" ? "MANUAL" : (detail[pid]?.ok ? "OK" : "MAL")}</span><span class="badge bg-yellow">${pts} pts</span></div></div>`;

            if (q.tipo === "multiple") {
                const sel = (a === undefined || a === null) ? "-" : (q.opciones?.[a] ?? "-");
                const corr = q.opciones?.[q.correctaIndex] ?? "-";
                html += `<div style="margin-top:10px;"><b>Tu respuesta:</b> ${sel}</div><div style="margin-top:6px;"><b>Correcta:</b> ${corr}</div>`;
            } else if (q.tipo === "vf") {
                const normalized = (a === true || a === "true") ? true : (a === false || a === "false") ? false : null;
                html += `<div style="margin-top:10px;"><b>Tu respuesta:</b> ${normalized === null ? "-" : String(normalized)}</div><div style="margin-top:6px;"><b>Correcta:</b> ${String(q.correctaBool)}</div>`;
            } else if (q.tipo === "emparejar") {
                const izq = q.izq || []; const der = q.der || []; const studentMap = (a && typeof a === "object") ? a : {}; const correctMap = q.pares || {};
                html += `<div style="margin-top:12px;">`;
                izq.forEach((leftText, li) => {
                    const sIdx = studentMap[String(li)];
                    const cIdx = correctMap[String(li)];
                    const sTxt = (sIdx === undefined || sIdx === null) ? "-" : (der[sIdx] ?? "-");
                    const cTxt = (cIdx === undefined || cIdx === null) ? "-" : (der[cIdx] ?? "-");
                    const ok = Number(sIdx) === Number(cIdx);
                    html += `<div style="padding:10px; border-radius:12px; margin-bottom:10px; border:1px solid rgba(0,0,0,0.08); background:${ok ? "#d1fae5" : "#fee2e2"};"><b>${leftText || ""}</b><br>Tu emparejaste: <b>${sTxt}</b><br>Correcto: <b>${cTxt}</b></div>`;
                });
                html += `</div>`;
            } else {
                html += `<div style="margin-top:10px;"><b>Tu respuesta:</b><div style="background:#f8fafc; padding:12px; border-radius:10px; margin-top:8px;">${(a || "").toString().replaceAll("<","&lt;")}</div></div><div style="margin-top:8px;color:var(--text-muted);"><small>Esta respuesta la calificará el docente.</small></div>`;
            }
            html += `</div>`;
        });
        return html;
    },

    markDone: async (tid) => {
        await addDoc(collection(db,"entregas"), { tareaId:tid, estudianteUid:currentUser.uid, fecha:new Date().toISOString() });
        window.System.closeModal(); window.Student.renderDashboard();
    },

    renderGrades: async () => {
        document.getElementById('pageTitle').innerText = "Mis Notas";
        const main = document.getElementById('mainArea');
        main.innerHTML = '<div class="loading">Cargando...</div>';
        const entregasSnap = await getDocs(query(collection(db,"entregas"), where("estudianteUid","==",currentUser.uid), where("estado","==","calificado")));
        if (entregasSnap.empty) { main.innerHTML = "<p>No tienes notas todavía.</p>"; return; }
        
        const map = {};
        entregasSnap.forEach(doc => {
            const e = doc.data();
            const key = e.tareaId;
            if (!map[key] || new Date(e.calificadoEn) > new Date(map[key].calificadoEn)) { map[key] = e; }
        });

        let h = `<div class="card"><table class="data-table"><thead><tr><th>Materia</th><th>Actividad</th><th>Nota Final</th></tr></thead><tbody>`;
        for (const key in map) {
            const entrega = map[key];
            const materiaSnap = await getDoc(doc(db,"materias",entrega.materiaId));
            const tareaSnap = await getDoc(doc(db,"tareas",entrega.tareaId));
            const materiaNombre = materiaSnap.exists() ? materiaSnap.data().nombre : "-";
            const tareaTitulo = tareaSnap.exists() ? tareaSnap.data().titulo : "-";
            h += `<tr><td>${materiaNombre}</td><td>${tareaTitulo}</td><td><span class="badge bg-green">${entrega.puntosFinal ?? 0}</span></td></tr>`;
        }
        h += `</tbody></table></div>`;
        main.innerHTML = h;
    },
};

// ==========================================
// 5. INICIALIZACIÓN
// ==========================================
function initUI() {
    document.getElementById('uName').innerText = currentUser.nombres;
    document.getElementById('uRole').innerText = currentUser.rol;
    document.getElementById('uPhoto').src = currentUser.foto || `https://ui-avatars.com/api/?name=${currentUser.nombres}&background=4f46e5&color=fff`;
    
    const nav = document.getElementById('menuContainer');
    nav.innerHTML = '';
    const menus = {
        admin: [
            {t:'Dashboard', i:'fa-chart-pie', f:'window.Admin.renderDashboard'},
            {t:'Académico', i:'fa-university', f:'window.Admin.renderAcademic'},
            {t:'Estudiantes', i:'fa-users', f:'window.Admin.renderUsers'},
            {t:'Docentes', i:'fa-chalkboard-teacher', f:'window.Admin.renderTeachers'},
        ],
        docente: [
           {t:'Inicio', i:'fa-home', f:'window.Teacher.renderWelcome'},
           {t:'Mis Cursos', i:'fa-book', f:'window.Teacher.renderClasses'},
          {t:'Crear Actividad', i:'fa-plus-circle', f:'window.Teacher.renderGlobalActivity'}
        ],
        estudiante: [
            {t:'Tareas', i:'fa-tasks', f:'window.Student.renderDashboard'},
            {t:'Notas', i:'fa-star', f:'window.Student.renderGrades'}
        ]
    };

    menus[currentUser.rol].forEach(item => {
        const d = document.createElement('div');
        d.className = 'nav-item';
        d.innerHTML = `<i class="fas ${item.i}"></i> ${item.t}`;
        d.onclick = () => {
            document.querySelectorAll('.nav-item').forEach(e=>e.classList.remove('active'));
            d.classList.add('active');
            executeMenuFunction(item.f);
        };
        nav.appendChild(d);
    });

    const q = query(collection(db,"notificaciones"), where("targetUid","==",currentUser.uid), orderBy("fecha","desc"), limit(10));
    notifUnsubscribe = onSnapshot(q, (snapshot) => {
        const list = document.getElementById('notifList');
        const badge = document.getElementById('notifDot');
        let unread=0; let html='';
        if(snapshot.empty) html='<div style="padding:15px;text-align:center;color:#999">Sin notificaciones</div>';
        snapshot.forEach(d => {
            const n = d.data();
            if(!n.leido) unread++;
            html += `<div style="padding:12px;border-bottom:1px solid #eee;cursor:pointer;background:${n.leido?'white':'#f0f9ff'}" onclick="window.System.markRead('${d.id}')">
                <div style="font-weight:600;font-size:0.9rem">${n.titulo}</div><small style="color:#666">${n.mensaje}</small>
            </div>`;
        });
        list.innerHTML=html;
        if(badge) badge.style.display = unread>0 ? 'block' : 'none';
    });
}

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    const docSnap = await getDoc(doc(db, "users", user.uid));
    if (docSnap.exists()) {
        currentUser = { ...docSnap.data(), uid: user.uid };
        
        document.getElementById('lockScreen').classList.add('hidden');
        document.getElementById('payAlert').classList.add('hidden');
        
        if(currentUser.rol === 'estudiante' && currentUser.proximoPago) {
            const days = Math.floor((new Date() - new Date(currentUser.proximoPago)) / 86400000);
            if (days > 20) document.getElementById('lockScreen').classList.remove('hidden');
            else if (days > 5) document.getElementById('payAlert').classList.remove('hidden');
        }

        initUI();
        if(currentUser.rol==='admin') window.Admin.renderDashboard();
        else if(currentUser.rol==='docente') window.Teacher.renderWelcome();
        else window.Student.renderDashboard();
    }
});