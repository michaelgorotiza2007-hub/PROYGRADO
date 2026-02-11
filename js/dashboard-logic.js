import { auth, db, firebaseConfig } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, limit, setDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth as getAuthSecondary, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { showToast } from './utils.js';

let currentUser = null;
let notifUnsubscribe = null;

// ==========================================
// 1. UTILIDADES Y AYUDAS
// ==========================================

// Función vital para convertir strings del menú en funciones reales
const executeMenuFunction = (path) => {
    const parts = path.split('.');
    let fn = window;
    for(let i=1; i<parts.length; i++) {
        if(fn) fn = fn[parts[i]];
    }
    if(typeof fn === 'function') fn();
    else console.error("Función no encontrada:", path);
};

const openModal = (title, htmlContent) => {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalContent').innerHTML = htmlContent;
    document.getElementById('modalOverlay').classList.remove('hidden');
};

const sendNotification = async (targetUid, title, msg, type) => {
    try {
        await addDoc(collection(db, "notificaciones"), {
            targetUid, titulo: title, mensaje: msg, tipo, fecha: new Date().toISOString(), leido: false
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

    desbloquear: async () => {
        if (!currentUser || currentUser.rol !== 'estudiante') return;
        const code = document.getElementById('unlockCode').value.toUpperCase().trim();
        const btn = document.querySelector('#lockScreen button');
        
        btn.innerText = "Verificando...";
        btn.disabled = true;

        if (code === currentUser.codigoPago) {
            const next = new Date(); next.setMonth(next.getMonth() + 1);
            await updateDoc(doc(db, "users", currentUser.uid), { proximoPago: next.toISOString().split('T')[0], codigoPago: null });
            alert("¡Acceso Restaurado!"); location.reload();
        } else {
            alert("Código inválido. Contacte a administración.");
            btn.innerText = "Validar Pago";
            btn.disabled = false;
        }
    }
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
        // Cargar Periodos
        getDocs(collection(db, "periodos")).then(snap => {
            let h=''; snap.forEach(d=>h+=`<div style="padding:8px;border-bottom:1px solid #eee">${d.data().nombre}</div>`);
            const el = document.getElementById('listP'); if(el) el.innerHTML=h||'Vacío';
        });
        
        // Cargar Cursos
        getDocs(collection(db, "cursos")).then(snap => {
            let h=''; snap.forEach(d=>h+=`<div style="padding:8px;border-bottom:1px solid #eee">${d.data().nombre}</div>`);
            const el = document.getElementById('listC'); if(el) el.innerHTML=h||'Vacío';
        });

        // Cargar Materias
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
        
        openModal("Asignar Materia", `
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

        // UI Feedback
        btn.innerText = "Guardando...";
        btn.disabled = true;

        try {
            await addDoc(collection(db,"materias"), { nombre:name, cursoId:cursoId, docenteUid:docId });
            await sendNotification(docId, "Nueva Asignación", `Materia: ${name}`, "admin");
            
            // Esperar a que se actualice la lista
            await window.Admin.loadLists();
            
            window.System.closeModal(); 
            showToast("Materia Asignada");
        } catch(e) {
            alert("Error al guardar: " + e.message);
            btn.innerText = "Guardar";
            btn.disabled = false;
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
        openModal("Nuevo Docente", `
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
        openModal("Nuevo Alumno", `
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

    cobrar: async (uid) => {
        const c = Math.random().toString(36).substring(7).toUpperCase();
        await updateDoc(doc(db,"users",uid),{codigoPago:c});
        alert("CÓDIGO: "+c); window.Admin.renderPayments();
    }
};

// --- DOCENTE ---
window.Teacher = {
    renderWelcome: () => document.getElementById('mainArea').innerHTML = `<div class="card"><h3>Bienvenido</h3><p>Seleccione un curso del menú.</p></div>`,

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

    manage: (mId, mName, cId) => {
        document.getElementById('pageTitle').innerText = mName;
        document.getElementById('mainArea').innerHTML = `
            <div style="margin-bottom:20px; display:flex; gap:10px;">
                <button class="btn btn-ghost" onclick="window.Teacher.loadTab('notas','${mId}','${cId}')">Notas</button>
                <button class="btn btn-ghost" onclick="window.Teacher.loadTab('act','${mId}','${cId}')">Actividades</button>
                <button class="btn btn-ghost" onclick="window.Teacher.loadTab('asis','${mId}','${cId}')">Asistencia</button>
            </div>
            <div id="tabCont"></div>
        `;
        window.Teacher.loadTab('notas', mId, cId);
    },

    loadTab: async (tab, mId, cId) => {
        const c = document.getElementById('tabCont');
        c.innerHTML = '<div class="loading">Cargando...</div>';

        if (tab === 'notas') {
            const pSnap = await getDocs(collection(db,"periodos"));
            const tSnap = await getDocs(query(collection(db,"tareas"), where("materiaId","==",mId)));
            let h = `<div class="card"><div class="grid-2">
                <div><label>Periodo</label><select id="pSel"><option value="">Seleccione...</option>`;
            pSnap.forEach(p => h += `<option value="${p.id}">${p.data().nombre}</option>`);
            h += `</select></div><div><label>Actividad</label><select id="tSel" onchange="window.Teacher.renderGradeTable('${mId}','${cId}')"><option value="">Seleccione...</option>`;
            tSnap.forEach(t => h += `<option value="${t.id}">${t.data().tipo}: ${t.data().titulo}</option>`);
            h += `</select></div></div></div><div id="gTable"></div>`;
            c.innerHTML = h;
        } 
        else if (tab === 'act') {
            const snap = await getDocs(query(collection(db,"tareas"), where("materiaId","==",mId)));
            let h = `<div style="text-align:right; margin-bottom:15px"><button class="btn btn-primary" onclick="window.Teacher.modalAct('${mId}','${cId}')">+ Crear Actividad</button></div><div class="grid-2">`;
            snap.forEach(d => {
                const k = d.data();
                h += `<div class="card"><h4>${k.titulo}</h4><p>${k.desc}</p><span class="badge bg-green">${k.tipo}</span></div>`;
            });
            c.innerHTML = h+"</div>";
        }
        else if (tab === 'asis') {
            const snap = await getDocs(query(collection(db,"users"), where("cursoId","==",cId)));
            let h = `<div class="card"><h4>Asistencia Semanal</h4><div class="week-grid" style="font-weight:bold;margin-top:15px"><div style="padding-left:10px">Estudiante</div><div class="day-h">L</div><div class="day-h">M</div><div class="day-h">M</div><div class="day-h">J</div><div class="day-h">V</div></div>`;
            snap.forEach(s => {
                h += `<div class="week-grid" style="padding:5px 0"><div style="padding-left:10px">${s.data().nombres}</div>
                    <div class="att-cell" onclick="window.cycle(this)">-</div><div class="att-cell" onclick="window.cycle(this)">-</div>
                    <div class="att-cell" onclick="window.cycle(this)">-</div><div class="att-cell" onclick="window.cycle(this)">-</div>
                    <div class="att-cell" onclick="window.cycle(this)">-</div>
                </div>`;
            });
            c.innerHTML = h + `<button class="btn btn-primary" style="margin-top:15px">Guardar Semana</button></div>`;
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
        openModal("Crear Tarea", `<div class="form-group"><label>Tipo</label><select id="at"><option>Tarea</option><option>Examen</option></select></div><div class="form-group"><label>Título</label><input id="an"></div><div class="form-group"><label>Descripción</label><textarea id="ad"></textarea></div><div class="form-group"><label>Fecha</label><input type="date" id="af"></div><button class="btn btn-primary" onclick="window.Teacher.saveAct('${mId}','${cId}')">Publicar</button>`);
    },

    saveAct: async (mId, cId) => {
        const t = document.getElementById('an').value;
        if(!t) return;
        await addDoc(collection(db,"tareas"), { materiaId:mId, tipo:document.getElementById('at').value, titulo:t, desc:document.getElementById('ad').value, fecha:document.getElementById('af').value, creado:new Date().toISOString() });
        const users = await getDocs(query(collection(db,"users"), where("cursoId","==",cId)));
        users.forEach(u => sendNotification(u.id, "Nueva Actividad", t, "tarea"));
        window.System.closeModal(); window.Teacher.loadTab('act', mId, cId);
    }
};

// --- ESTUDIANTE ---
window.Student = {
    renderDashboard: async () => {
        document.getElementById('pageTitle').innerText = "Mis Tareas";
        const main = document.getElementById('mainArea');
        main.innerHTML = '<div class="loading">Cargando...</div>';
        
        if(!currentUser.cursoId) { main.innerHTML="<p>Sin curso asignado.</p>"; return; }

        const mSnap = await getDocs(query(collection(db,"materias"), where("cursoId","==",currentUser.cursoId)));
        const mIds = mSnap.docs.map(d=>d.id);
        const mNames = {}; mSnap.forEach(d=>mNames[d.id]=d.data().nombre);

        if(mIds.length===0) { main.innerHTML="<p>No hay materias.</p>"; return; }

        const tSnap = await getDocs(query(collection(db,"tareas"), where("materiaId","in",mIds)));
        const eSnap = await getDocs(query(collection(db,"entregas"), where("estudianteUid","==",currentUser.uid)));
        const doneMap = {}; eSnap.forEach(e=>doneMap[e.data().tareaId]=true);

        let h = '<div class="grid-2">';
        tSnap.forEach(d => {
            const k = d.data();
            const done = doneMap[d.id];
            h += `<div class="card" onclick="window.Student.viewTask('${d.id}')" style="cursor:pointer; border-left:4px solid ${done?'var(--success)':'var(--warning)'}">
                <h4>${k.titulo}</h4><p>${k.desc}</p>
                <span class="badge ${done?'bg-green':'bg-yellow'}">${done?'COMPLETADO':'PENDIENTE'}</span>
            </div>`;
        });
        main.innerHTML = h+"</div>";
    },

    viewTask: async (tid) => {
        const docSnap = await getDoc(doc(db,"tareas",tid));
        const k = docSnap.data();
        const q = query(collection(db,"entregas"), where("estudianteUid","==",currentUser.uid), where("tareaId","==",tid));
        const s = await getDocs(q);
        const btn = !s.empty ? '<button class="btn btn-success" disabled>Entregado</button>' : `<button class="btn btn-primary" onclick="window.Student.markDone('${tid}')">Marcar Completado</button>`;
        openModal(k.titulo, `<div style="background:#f8fafc;padding:15px;border-radius:10px;margin-bottom:15px">${k.desc}<br><small>Vence: ${k.fecha}</small></div><div style="text-align:right">${btn}</div>`);
    },

    markDone: async (tid) => {
        await addDoc(collection(db,"entregas"), { tareaId:tid, estudianteUid:currentUser.uid, fecha:new Date().toISOString() });
        window.System.closeModal(); window.Student.renderDashboard();
    },

    renderGrades: async () => {
        document.getElementById('pageTitle').innerText = "Mis Notas";
        const main = document.getElementById('mainArea');
        main.innerHTML = '<div class="loading">Cargando...</div>';
        
        const mSnap = await getDocs(query(collection(db,"materias"), where("cursoId","==",currentUser.cursoId)));
        let h = '<div class="card"><table class="data-table"><thead><tr><th>Materia</th><th>Actividad</th><th>Nota</th></tr></thead><tbody>';
        
        for(const m of mSnap.docs) {
            const nSnap = await getDocs(query(collection(db,"notas"), where("estudianteUid","==",currentUser.uid), where("materiaId","==",m.id)));
            if(!nSnap.empty) {
                for(const n of nSnap.docs) {
                    const t = await getDoc(doc(db,"tareas",n.data().tareaId));
                    h += `<tr><td>${m.data().nombre}</td><td>${t.data().titulo}</td><td><span class="badge bg-green">${n.data().valor}</span></td></tr>`;
                }
            }
        }
        main.innerHTML = h+"</tbody></table></div>";
    }
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
            {t:'Pagos', i:'fa-wallet', f:'window.Admin.renderPayments'}
        ],
        docente: [
            {t:'Inicio', i:'fa-home', f:'window.Teacher.renderWelcome'},
            {t:'Mis Cursos', i:'fa-book', f:'window.Teacher.renderClasses'}
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