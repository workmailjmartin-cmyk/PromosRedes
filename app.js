document.addEventListener('DOMContentLoaded', () => {

    // ===========================================================
    // 1. CONFIGURACIÓN
    // ===========================================================
    const firebaseConfig = { apiKey: "AIzaSyCBiyH6HTatUxNxQ6GOxGp-xFWa7UfCMJk", authDomain: "feliz-viaje-43d02.firebaseapp.com", projectId: "feliz-viaje-43d02", storageBucket: "feliz-viaje-43d02.firebasestorage.app", messagingSenderId: "931689659600", appId: "1:931689659600:web:66dbce023705936f26b2d5", measurementId: "G-2PNDZR3ZS1" };
    const API_URL_SEARCH = 'https://n8n.srv1097024.hstgr.cloud/webhook/83cb99e2-c474-4eca-b950-5d377bcf63fa';
    const API_URL_UPLOAD = 'https://n8n.srv1097024.hstgr.cloud/webhook/6ec970d0-9da4-400f-afcc-611d3e2d82eb';

    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore(); 
    const provider = new firebase.auth.GoogleAuthProvider();

    let currentUser = null, userData = null, allPackages = [], uniquePackages = [], isEditingId = null, originalCreator = ''; 
    let currentEditingDayKey = null;

    const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const minGlobalDate = now.toISOString().split('T')[0];

    // DOM CACHE
    const dom = {
        views: { search: document.getElementById('view-search'), upload: document.getElementById('view-upload'), gestion: document.getElementById('view-gestion'), users: document.getElementById('view-users') },
        nav: { search: document.getElementById('nav-search'), upload: document.getElementById('nav-upload'), gestion: document.getElementById('nav-gestion'), users: document.getElementById('nav-users') },
        grid: document.getElementById('grilla-paquetes'), gridGestion: document.getElementById('grid-gestion'),
        uploadForm: document.getElementById('upload-form'), userForm: document.getElementById('user-form'), usersList: document.getElementById('users-list'),
        inputCostoTotal: document.getElementById('upload-costo-total'), inputTarifaTotal: document.getElementById('upload-tarifa-total'), inputFechaViaje: document.getElementById('upload-fecha-salida'),
        loginContainer: document.getElementById('login-container'), appContainer: document.getElementById('app-container'),
        btnLogin: document.getElementById('login-button'), btnLogout: document.getElementById('logout-button'), userEmail: document.getElementById('user-email'),
        modal: document.getElementById('modal-detalle'), modalBody: document.getElementById('modal-body'), modalClose: document.getElementById('modal-cerrar'),
        containerServicios: document.getElementById('servicios-container'), btnAgregarServicio: document.getElementById('btn-agregar-servicio'), selectorServicio: document.getElementById('selector-servicio'),
        btnBuscar: document.getElementById('boton-buscar'), btnLimpiar: document.getElementById('boton-limpiar'),
        filtroOrden: document.getElementById('filtro-orden'), filtroCreador: document.getElementById('filtro-creador'), containerFiltroCreador: document.getElementById('container-filtro-creador'),
        logoImg: document.getElementById('app-logo'), loader: document.getElementById('loader-overlay'), badgeGestion: document.getElementById('badge-gestion'),
        // Calendario
        calendarContainer: document.getElementById('calendar-container'), calendarGrid: document.getElementById('calendar-grid'), btnToggleCalendar: document.getElementById('btn-toggle-calendar'),
        modalCalendar: document.getElementById('modal-calendar'), modalCalendarTitle: document.getElementById('modal-calendar-title'), calendarInput: document.getElementById('calendar-input'), btnSaveCalendar: document.getElementById('btn-save-calendar'), btnCloseCalendar: document.getElementById('btn-close-calendar')
    };

    // ===========================================================
    // 2. FUNCIONES DE UTILIDAD (DEFINIR PRIMERO)
    // ===========================================================
    const showLoader = (show, text = null) => { 
        if(dom.loader) { dom.loader.style.display = show ? 'flex' : 'none'; if(text) dom.loader.querySelector('p').innerText = text; }
    };
    const formatMoney = (a) => new Intl.NumberFormat('es-AR', { style: 'decimal', minimumFractionDigits: 0 }).format(a);
    const formatDateAR = (s) => { if(!s) return '-'; const p = s.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s; };

    // Alertas Globales
    window.showAlert = (message, type = 'error') => { return new Promise((resolve) => { showLoader(false); const overlay = document.getElementById('custom-alert-overlay'); if(overlay){ document.getElementById('custom-alert-message').innerText=message; overlay.style.display='flex'; document.getElementById('custom-alert-btn').onclick=()=>{overlay.style.display='none';resolve();}; }else{ alert(message); resolve(); } }); };
    window.showConfirm = (message) => { return new Promise((resolve) => { showLoader(false); const overlay = document.getElementById('custom-alert-overlay'), btnCancel = document.getElementById('custom-alert-cancel'); if(overlay && btnCancel){ document.getElementById('custom-alert-message').innerText=message; btnCancel.style.display='inline-block'; overlay.style.display='flex'; document.getElementById('custom-alert-btn').onclick=()=>{overlay.style.display='none';resolve(true);}; btnCancel.onclick=()=>{overlay.style.display='none';resolve(false);}; }else{ resolve(confirm(message)); } }); };

    // --- FORMULARIO HELPERS (ESTRELLAS) ---
    window.setStars = (id, count) => {
        const input = document.getElementById(`stars-${id}`);
        const container = document.querySelector(`.servicio-card[data-id="${id}"] .star-rating`);
        if(input && container) {
            input.value = count;
            container.querySelectorAll('span').forEach((s, idx) => {
                if(idx < count) s.classList.add('filled'); else s.classList.remove('filled');
            });
        }
    };

    window.crearContadorHTML = (n, v) => `<div class="counter-wrapper"><button type="button" class="counter-btn" onclick="this.nextElementSibling.innerText=Math.max(0,parseInt(this.nextElementSibling.innerText)-1)">-</button><span class="counter-value">${v}</span><button type="button" class="counter-btn" onclick="this.previousElementSibling.innerText=parseInt(this.previousElementSibling.innerText)+1">+</button><input type="hidden" name="${n}" value="${v}"></div>`;
    window.calcularNoches = (id) => { const c=document.querySelector(`.servicio-card[data-id="${id}"]`); if(!c)return; const i=c.querySelector('input[name="checkin"]'), o=c.querySelector('input[name="checkout"]'); if(i&&o&&i.value&&o.value){ const d1=new Date(i.value), d2=new Date(o.value); document.getElementById(`noches-${id}`).value=(d2>d1)?Math.ceil((d2-d1)/86400000):'-'; } };
    window.calcularTotal = () => { let t=0; document.querySelectorAll('.input-costo').forEach(i=>t+=parseFloat(i.value)||0); if(dom.inputCostoTotal) dom.inputCostoTotal.value=t; if(dom.inputTarifaTotal) dom.inputTarifaTotal.value=Math.round(t*1.185); };

    // ===========================================================
    // 3. LOGICA CALENDARIO
    // ===========================================================
    async function loadCalendar() {
        if (!dom.calendarContainer) return;
        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
        const todayIndex = new Date().getDay(); 
        try {
            const doc = await db.collection('config').doc('weekly_calendar').get();
            const data = doc.exists ? doc.data() : {};
            dom.calendarGrid.innerHTML = '';
            
            days.forEach((dayName, index) => {
                const dayKey = `day_${index + 1}`; 
                const content = data[dayKey] || ''; 
                const isActive = (todayIndex === index + 1); 
                
                const card = document.createElement('div'); 
                card.className = `day-card ${isActive ? 'today' : ''}`;
                
                let editBtn = '';
                if (userData && (userData.rol === 'admin' || userData.rol === 'editor')) {
                    // Botón para editar
                    editBtn = `<button class="btn-edit-day" onclick="event.stopPropagation(); window.openCalendarModal('${dayKey}', '${dayName}')" title="Editar">✏️</button>`;
                }
                
                let displayContent = content || (userData && userData.rol === 'usuario' ? '<span style="color:#ddd;">-</span>' : '<span style="color:#eee;">Clic para editar</span>');
                card.innerHTML = `${editBtn}<h4>${dayName}</h4><div class="day-content">${displayContent}</div>`;
                dom.calendarGrid.appendChild(card);

                // Clic en toda la tarjeta si es admin y está vacía
                if (!content && (userData.rol === 'admin' || userData.rol === 'editor')) {
                    card.style.cursor = 'pointer';
                    card.onclick = () => window.openCalendarModal(dayKey, dayName);
                }
            });
            dom.calendarContainer.style.display = 'block';
        } catch (e) { console.error("Error calendario:", e); }
    }

    // Modal Calendario
    window.openCalendarModal = async (dayKey, dayName) => {
        currentEditingDayKey = dayKey; 
        if(dom.modalCalendarTitle) dom.modalCalendarTitle.innerText = `Editar ${dayName}`;
        try { 
            const doc = await db.collection('config').doc('weekly_calendar').get(); 
            const currentVal = doc.exists ? (doc.data()[dayKey] || "") : ""; 
            if(dom.calendarInput) dom.calendarInput.value = currentVal; 
            if(dom.modalCalendar) dom.modalCalendar.classList.add('active'); 
        } catch(e) { window.showAlert("Error al cargar.", "error"); }
    };

    // ===========================================================
    // 4. LÓGICA DE PAQUETES (CLICKS, MODAL, RENDER)
    // ===========================================================
    
    // Funciones Helper para Paquetes
    function getNoches(pkg) { let s = []; try { const raw = pkg['servicios'] || pkg['item.servicios']; s = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch(e) {} if(!Array.isArray(s)) return 0; let th = 0; let hh = false; s.forEach(x => { if (x.tipo === 'hotel' && x.noches) { th += parseInt(x.noches) || 0; hh = true; } }); if(hh && th > 0) return th; const b = s.find(x => x.tipo === 'bus'); if (b && b.bus_noches) return parseInt(b.bus_noches); const c = s.find(x => x.tipo === 'crucero'); if (c && c.crucero_noches) return parseInt(c.crucero_noches); if(!pkg['fecha_salida']) return 0; let f = pkg['fecha_salida']; if(f.includes('/')) f = f.split('/').reverse().join('-'); const start = new Date(f + 'T00:00:00'); let max = new Date(start); let hd = false; s.forEach(x => { if(x.tipo==='hotel'&&x.checkout){ const d=new Date(x.checkout+'T00:00:00'); if(d>max){max=d; hd=true;} } if(x.tipo==='aereo'&&x.fecha_regreso){ const d=new Date(x.fecha_regreso+'T00:00:00'); if(d>max){max=d; hd=true;} } }); return hd ? Math.ceil((max - start) / 86400000) : 0; }
    function getSummaryIcons(pkg) { let s = []; try { s = typeof pkg.servicios === 'string' ? JSON.parse(pkg.servicios) : pkg.servicios; } catch(e) {} if (!Array.isArray(s)) return ''; const m = {'aereo':'✈️','hotel':'🏨','traslado':'🚕','seguro':'🛡️','bus':'🚌','crucero':'🚢'}; return [...new Set(s.map(x => m[x.tipo] || '🔹'))].join(' '); }

    function generarTextoPresupuesto(pkg) {
        const fechaCotizacion = pkg.fecha_creacion ? pkg.fecha_creacion : new Date().toLocaleDateString('es-AR');
        const noches = getNoches(pkg); const tarifa = parseFloat(pkg['tarifa']) || 0; const tarifaDoble = Math.round(tarifa / 2);
        let s = []; try { s = typeof pkg.servicios === 'string' ? JSON.parse(pkg.servicios) : pkg.servicios; } catch(e) {}
        const seg = Array.isArray(s) && s.some(x => x.tipo === 'seguro');
        let t = `*${pkg.destino.toUpperCase()}*\n\n📅 Salida: ${formatDateAR(pkg.fecha_salida)}\n📍 Desde: ${pkg.salida}\n${noches > 0 ? `🌙 Duración: ${noches} Noches\n` : ''}\n`;
        if (Array.isArray(s)) { s.forEach(x => { 
            if(x.tipo === 'aereo') { let es = (x.escalas == 0) ? "Directo" : (x.escalas == 1 ? "1 Escala" : `${x.escalas} Escalas`); t += `✈️ AÉREO\n${x.aerolinea || 'Aerolínea'}\n${formatDateAR(x.fecha_aereo)}${x.fecha_regreso ? ' - ' + formatDateAR(x.fecha_regreso) : ''}\n🔄 ${es} | 🧳 ${x.tipo_equipaje || '-'}\n\n`; }
            else if (x.tipo === 'hotel') { let st = ''; if(x.hotel_estrellas) for(let i=0;i<x.hotel_estrellas;i++) st+='⭐'; t += `🏨 HOTEL\n${x.hotel_nombre} ${st}\n${x.regimen ? '('+x.regimen+')\n' : ''}`; if(x.noches) t += `🌙 ${x.noches} Noches`; if(x.checkin) t += ` | 📥 Ingreso: ${formatDateAR(x.checkin)}`; if(x.hotel_link) t += `\n📍 Ubicación: ${x.hotel_link}`; t += `\n\n`; }
            else if (x.tipo === 'traslado') { t += `🚕 TRASLADO\n${x.tipo_trf || 'Incluido'}\n\n`; }
            else if (x.tipo === 'seguro') { t += `🛡️ SEGURO\n${x.cobertura || 'Asistencia'}\n\n`; }
            else if (x.tipo === 'bus') { t += `🚌 BUS\n${x.bus_noches} Noches ${x.bus_regimen || ''}\n\n`; }
            else if (x.tipo === 'crucero') { t += `🚢 CRUCERO\n${x.crucero_naviera} - ${x.crucero_recorrido}\n\n`; }
            else if (x.tipo === 'adicional') { t += `➕ ADICIONAL\n${x.descripcion}\n\n`; }
        }); }
        t += `💲*Tarifa final por Persona en Base Doble:*\n${pkg.moneda} $${formatMoney(tarifaDoble)}\n\n`;
        if(pkg.financiacion) t += `💳 Financiación: ${pkg.financiacion}\n\n`;
        t += `--------------------------------------------\nInformación importante:\n-Tarifas y disponibilidad sujetas a cambio.\n-Cotización válida al ${pkg.fecha_creacion||new Date().toLocaleDateString('es-AR')}\n\nℹ Más info: (https://felizviaje.tur.ar/informacion-antes-de-contratar)\n\n✈ Políticas generales:\n-Equipaje y selección de asientos no incluidos.\n\n`;
        t += seg ? `Asistencia al viajero es requisito obligatorio.` : `Asistencia al viajero no incluida.`;
        return t;
    }
    window.copiarPresupuesto = (pkg) => { navigator.clipboard.writeText(generarTextoPresupuesto(pkg)).then(() => window.showAlert("✅ Copiado!", "success")).catch(() => window.showAlert("Error al copiar", "error")); };

    function renderServiciosClienteHTML(raw) { 
        let s=[]; try{s=typeof raw==='string'?JSON.parse(raw):raw;}catch(e){return'-';} if(!Array.isArray(s))return'-'; let h=''; 
        s.forEach(x=>{ let i='🔹',t='',l=[]; 
            if(x.tipo==='aereo'){ i='✈️';t='AÉREO'; l.push(`<b>${x.aerolinea}</b>`); l.push(`${formatDateAR(x.fecha_aereo)}${x.fecha_regreso?` - ${formatDateAR(x.fecha_regreso)}`:''}`); let es = (x.escalas == 0) ? "Directo" : (x.escalas == 1 ? "1 Escala" : `${x.escalas} Escalas`); l.push(`🔄 ${es} | 🧳 ${x.tipo_equipaje || '-'}`);} 
            else if(x.tipo==='hotel'){ i='🏨';t='HOTEL'; let st=''; if(x.hotel_estrellas) for(let k=0;k<x.hotel_estrellas;k++) st+='⭐'; l.push(`<b>${x.hotel_nombre}</b> <span style="color:#ef5a1a;">${st}</span>`); l.push(`(${x.regimen})`); if(x.hotel_link) l.push(`<a href="${x.hotel_link}" target="_blank" style="color:#ef5a1a;font-weight:bold;">📍 Ver Ubicación</a>`);} 
            else if(x.tipo==='traslado'){i='🚕';t='TRASLADO';l.push(`${x.tipo_trf}`);} else if(x.tipo==='seguro'){ i='🛡️';t='SEGURO'; if(x.cobertura) l.push(x.cobertura); } else if(x.tipo==='adicional'){i='➕';t='ADICIONAL';l.push(`${x.descripcion}`);} else if(x.tipo==='bus'){i='🚌';t='BUS';l.push(`${x.bus_noches} Noches`);} else if(x.tipo==='crucero'){i='🚢';t='CRUCERO';l.push(`${x.crucero_naviera}`);} 
            h+=`<div style="margin-bottom:5px;border-left:3px solid #ddd;padding-left:10px;"><div style="font-weight:bold;color:#11173d;">${i} ${t}</div><div style="font-size:0.9em;">${l.join('<br>')}</div></div>`; 
        }); return h; 
    }
    function renderCostosProveedoresHTML(raw) { let s=[]; try{s=typeof raw==='string'?JSON.parse(raw):raw;}catch(e){return'-';} if(!Array.isArray(s))return'-'; let h='<ul style="padding-left:15px;margin:0;">'; s.forEach(x=>{ h+=`<li>${x.proveedor||x.tipo}: $${x.costo}</li>`; }); return h+'</ul>'; }

    // --- ACCIONES MODAL ---
    window.openModal = function(pkg) {
        if (!dom.modal || !dom.modalBody) return;
        const htmlClient = renderServiciosClienteHTML(pkg.servicios || pkg['item.servicios']);
        const htmlCost = renderCostosProveedoresHTML(pkg.servicios || pkg['item.servicios']);
        const noches = getNoches(pkg); const tarifa = parseFloat(pkg['tarifa']) || 0; const tarifaDoble = Math.round(tarifa / 2); 
        const bubbleStyle = `background-color: #56DDE0; color: #11173d; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 0.8em; display: inline-block; margin-top: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);`; 
        let adminTools = ''; 
        const canEdit = userData.rol === 'admin' || userData.rol === 'editor' || (userData.rol === 'usuario' && pkg.status === 'pending' && pkg.editor_email === currentUser.email);
        if (canEdit) {
            const btnApprove = (userData.rol === 'admin' || userData.rol === 'editor') && pkg.status === 'pending' ? `<button class="btn btn-primario" onclick='window.approvePackage(${JSON.stringify(pkg).replace(/'/g, "&#39;")})' style="padding:5px 15px; font-size:0.8em; background:#2ecc71;">✅ Aprobar</button>` : '';
            adminTools = `<div class="modal-tools" style="position: absolute; top: 20px; right: 70px; display:flex; gap:10px;">${btnApprove}<button class="btn btn-secundario" onclick='window.startEditing(${JSON.stringify(pkg).replace(/'/g, "&#39;")})' style="padding:5px 15px; font-size:0.8em;">✏️ Editar</button><button class="btn btn-secundario" onclick='window.deletePackage(${JSON.stringify(pkg).replace(/'/g, "&#39;")})' style="padding:5px 15px; font-size:0.8em; background:#e74c3c; color:white;">🗑️ Borrar</button></div>`;
        }
        const btnCopiar = `<button class="btn" onclick='window.copiarPresupuesto(${JSON.stringify(pkg).replace(/'/g, "&#39;")})' style="background:#34495e; color:white; padding: 5px 15px; font-size:0.8em; display:flex; align-items:center; gap:5px;">📋 Copiar</button>`;
        dom.modalBody.innerHTML = `${adminTools}<div class="modal-detalle-header" style="display:block; padding-bottom: 25px;"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><h2 style="margin:0;font-size:2.2em;line-height:1.1;">${pkg['destino']}</h2></div><div style="margin-top:5px;"><span style="${bubbleStyle}">${pkg['tipo_promo']}</span></div></div><div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; padding: 20px;"><div><h3 style="border-bottom:2px solid #eee; padding-bottom:10px; margin-top:0; color:#11173d;">Itinerario</h3>${htmlClient}</div><div style="background:#f9fbfd; padding:15px; border-radius:8px; height:fit-content;"><div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;"><h4 style="margin:0; color:#11173d;">Resumen</h4>${btnCopiar}</div><p style="margin:5px 0; font-size:0.9em;"><b>📅 Salida:</b> ${formatDateAR(pkg['fecha_salida'])}</p><p style="margin:5px 0; font-size:0.9em;"><b>📍 Desde:</b> ${pkg['salida']}</p><p style="margin:5px 0; font-size:0.9em;"><b>🌙 Duración:</b> ${noches > 0 ? noches + ' Noches' : '-'}</p><p style="margin:5px 0; font-size:0.9em;"><b>📅 Cargado el:</b> ${pkg['fecha_creacion'] || '-'}</p><div><h4 style="margin:20px 0 10px 0; color:#11173d; border-top:1px solid #eee; padding-top:15px;">Costos (Interno)</h4>${htmlCost}</div>${pkg['financiacion'] ? `<div style="margin-top:15px; background:#e3f2fd; padding:10px; border-radius:5px; font-size:0.85em;"><b>💳 Financiación:</b> ${pkg['financiacion']}</div>` : ''}</div></div><div style="background:#11173d; color:white; padding:15px 20px; display:flex; justify-content:space-between; align-items:center; border-radius:0 0 12px 12px;"><div style="display:flex; gap:30px;"><div><small style="opacity:0.7;">Costo Total</small><div style="font-size:1.2em; font-weight:bold;">${pkg['moneda']} $${formatMoney(pkg['costos_proveedor'])}</div></div><div><small style="opacity:0.7;">Tarifa Final</small><div style="font-size:1.2em; font-weight:bold; color:#ef5a1a;">${pkg['moneda']} $${formatMoney(tarifa)}</div></div><div><small style="opacity:0.7;">x Persona (Base Doble)</small><div style="font-size:1.2em; font-weight:bold; color:#4caf50;">${pkg['moneda']} $${formatMoney(tarifaDoble)}</div></div></div><div style="text-align:right;"><small style="opacity:0.7;">Cargado por:</small><div style="font-size:0.9em;">${pkg['creador']}</div></div></div>`;
        dom.modal.classList.add('active');
    };

    window.deletePackage = async (pkg) => { if (!await window.showConfirm("⚠️ ¿Eliminar este paquete?")) return; showLoader(true); try { const id = pkg.id_paquete || pkg.id || pkg['item.id']; await secureFetch(API_URL_UPLOAD, { action_type: 'delete', id_paquete: id, status: 'deleted' }); await window.showAlert("Paquete eliminado.", "success"); if(dom.modal) dom.modal.classList.remove('active'); await softReload(); } catch (e) { window.showAlert("Error al eliminar.", "error"); } };
    window.approvePackage = async (pkg) => { if (!await window.showConfirm("¿Aprobar publicación en FEED?")) return; showLoader(true); try { let payload = JSON.parse(JSON.stringify(pkg)); payload.status = 'approved'; payload.action_type = 'edit'; payload.creador = pkg.creador; delete payload['row_number']; await secureFetch(API_URL_UPLOAD, payload); await window.showAlert("Paquete Aprobado.", "success"); if(dom.modal) dom.modal.classList.remove('active'); await softReload(); } catch (e) { window.showAlert("Error al aprobar.", "error"); } };
    window.startEditing = async (pkg) => { 
        if (!await window.showConfirm("Se abrirá el formulario de edición.")) return; 
        isEditingId = pkg.id_paquete || pkg.id || pkg['item.id']; originalCreator = pkg.creador || ''; 
        document.getElementById('upload-destino').value = pkg.destino; document.getElementById('upload-salida').value = pkg.salida; let f = pkg.fecha_salida; if(f && f.includes('/')) f = f.split('/').reverse().join('-'); dom.inputFechaViaje.value = f;
        document.getElementById('upload-moneda').value = pkg.moneda; document.getElementById('upload-promo').value = pkg.tipo_promo; document.getElementById('upload-financiacion').value = pkg.financiacion || ''; document.getElementById('upload-tarifa-total').value = pkg.tarifa; 
        dom.containerServicios.innerHTML = ''; let s = []; try { const raw = pkg['servicios'] || pkg['item.servicios']; s = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch(e) {} 
        if (Array.isArray(s)) { s.forEach(x => agregarModuloServicio(x.tipo, x)); } 
        window.calcularTotal(); if(dom.modal) dom.modal.classList.remove('active'); showView('upload'); window.scrollTo(0,0); window.showAlert("Modo Edición Activado.", "info"); 
    };

    // ===========================================================
    // 5. CARGA DE DATOS & AUTH (AL FINAL PARA EVITAR ERRORES)
    // ===========================================================
    function showView(n) { Object.values(dom.views).forEach(v => v.classList.remove('active')); Object.values(dom.nav).forEach(b => b.classList.remove('active')); dom.views[n].classList.add('active'); dom.nav[n].classList.add('active'); }
    async function secureFetch(url, body) { if (!currentUser) throw new Error('No auth'); if (url === API_URL_SEARCH) return await _doFetch(url, body); return await uploadWithMutex(url, body); }
    async function _doFetch(url, body) { const token = await currentUser.getIdToken(true); const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body:JSON.stringify(body), cache:'no-store' }); if (!res.ok) throw new Error(`API Error`); const j = await res.json(); if (j.error || j.status === 'error' || (Array.isArray(j) && j.length === 0 && url === API_URL_UPLOAD)) throw new Error(j.message || "Error procesando."); return j; }
    async function uploadWithMutex(url, body) { const lockRef = db.collection('config').doc('upload_lock'); let acquired = false, attempts = 0; while(!acquired && attempts < 20) { try { await db.runTransaction(async (t) => { const doc = await t.get(lockRef); const now = Date.now(); if (!doc.exists) { t.set(lockRef, { locked: true, user: currentUser.email, timestamp: now }); return; } const data = doc.data(); if (data && data.locked && (now - data.timestamp < 15000)) { throw "LOCKED"; } t.set(lockRef, { locked: true, user: currentUser.email, timestamp: now }); }); acquired = true; } catch (e) { if (e === "LOCKED" || e.message === "LOCKED") { showLoader(true, `⏳ Esperando turno... (${attempts+1}/20)`); await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000)); attempts++; } else { throw e; } } } if(!acquired) throw new Error("Sistema saturado."); try { showLoader(true, "🚀 Subiendo..."); return await _doFetch(url, body); } finally { await lockRef.set({ locked: false }); } }

    async function fetchAndLoadPackages() { 
        showLoader(true);
        try { 
            let d = await secureFetch(API_URL_SEARCH, {}); 
            if (typeof d === 'string') d = JSON.parse(d); 
            allPackages = d; uniquePackages = processPackageHistory(allPackages); 
            populateFranchiseFilter(uniquePackages); applyFilters(); updatePendingBadge(); 
        } catch(e){ console.error(e); } 
        showLoader(false); 
    }
    function processPackageHistory(rawList) { if (!Array.isArray(rawList)) return []; const historyMap = new Map(); rawList.forEach(pkg => { const id = pkg.id_paquete || pkg.id || pkg['item.id']; if (!id) return; if (!historyMap.has(id)) historyMap.set(id, []); historyMap.get(id).push(pkg); }); const processedList = []; historyMap.forEach((versions) => { const latestVersion = versions[versions.length - 1]; if (latestVersion.status === 'deleted') return; processedList.push(latestVersion); }); return processedList; }
    function populateFranchiseFilter(packages) { const selector = dom.filtroCreador; if(!selector) return; const currentVal = selector.value; const creadores = [...new Set(packages.map(p => p.creador).filter(Boolean))]; selector.innerHTML = '<option value="">Todas las Franquicias</option>'; creadores.sort().forEach(c => { const opt = document.createElement('option'); opt.value = c; opt.innerText = c; selector.appendChild(opt); }); selector.value = currentVal; }
    function updatePendingBadge() { const badge = document.getElementById('badge-gestion'); if (!badge) return; if (!userData || (userData.rol !== 'admin' && userData.rol !== 'editor')) { badge.style.display = 'none'; return; } const pendingCount = uniquePackages.filter(p => p.status === 'pending').length; if (pendingCount > 0) { badge.innerText = pendingCount; badge.style.display = 'inline-block'; } else { badge.style.display = 'none'; } }
    
    function applyFilters() {
        const fDestino = document.getElementById('filtro-destino').value.toLowerCase(); const fCreador = dom.filtroCreador ? dom.filtroCreador.value : ''; const fPromo = document.getElementById('filtro-promo').value; const fOrden = dom.filtroOrden ? dom.filtroOrden.value : 'reciente';
        let res = uniquePackages.filter(pkg => { const mDestino = !fDestino || (pkg.destino && pkg.destino.toLowerCase().includes(fDestino)); const mCreador = !fCreador || (pkg.creador && pkg.creador === fCreador); const mPromo = !fPromo || (pkg.tipo_promo && pkg.tipo_promo === fPromo); if (!mDestino || !mCreador || !mPromo) return false; const isOwner = pkg.editor_email === currentUser.email; const isPending = pkg.status === 'pending'; if (isPending && !isOwner && userData.rol !== 'admin' && userData.rol !== 'editor') return false; return true; });
        if (fOrden === 'reciente') { res.sort((a, b) => { const getTs = (id) => { if(!id || !id.startsWith('pkg_')) return 0; return parseInt(id.split('_')[1]) || 0; }; return getTs(b.id_paquete) - getTs(a.id_paquete); }); } else if (fOrden === 'menor_precio') res.sort((a, b) => parseFloat(a.tarifa) - parseFloat(b.tarifa)); else if (fOrden === 'mayor_precio') res.sort((a, b) => parseFloat(b.tarifa) - parseFloat(a.tarifa));
        renderCards(res, dom.grid); if (userData && (userData.rol === 'admin' || userData.rol === 'editor')) { const pen = uniquePackages.filter(p => p.status === 'pending'); renderCards(pen, dom.gridGestion); }
    }
    function renderCards(list, targetGrid) {
        if(!targetGrid) return; targetGrid.innerHTML = ''; if (!list || list.length === 0) { targetGrid.innerHTML = '<p>No hay resultados.</p>'; return; }
        list.forEach(pkg => {
            const card = document.createElement('div'); card.className = 'paquete-card';
            const noches = getNoches(pkg); const tarifa = parseFloat(pkg['tarifa']) || 0; const summaryIcons = getSummaryIcons(pkg); 
            let statusTag = ''; if (pkg.status === 'pending') statusTag = `<span style="background-color:#ffeaa7; color:#d35400; padding:2px 8px; border-radius:10px; font-size:0.7em; margin-left:5px;">⏳ En Revisión</span>`;
            const bubbleStyle = `background-color:#56DDE0;color:#11173d;padding:4px 12px;border-radius:20px;font-weight:600;font-size:0.75em;display:inline-block;box-shadow:0 2px 4px rgba(0,0,0,0.05);`;
            card.innerHTML = `<div class="card-clickable" onclick='window.openModal(${JSON.stringify(pkg).replace(/'/g, "&#39;")})'><div class="card-header"><div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%;"><div style="max-width:75%; padding-right:30px;"><h3 style="margin:0;font-size:1.5em;line-height:1.2;color:#11173d;">${pkg['destino']} ${statusTag}</h3></div>${noches > 0 ? `<div style="background:#eef2f5;color:#11173d;padding:5px 10px;border-radius:12px;font-weight:bold;font-size:0.8em;white-space:nowrap;">🌙 ${noches}</div>` : ''}</div><div class="fecha">📅 Salida: ${formatDateAR(pkg['fecha_salida'])}</div></div><div class="card-body"><div style="font-size:0.85em;color:#555;display:flex;flex-wrap:wrap;line-height:1.4;">${summaryIcons}</div></div><div class="card-footer"><div><span style="${bubbleStyle}">${pkg['tipo_promo']}</span></div><div><p class="precio-valor">${pkg['moneda']} $${formatMoney(Math.round(tarifa/2))}</p></div></div></div>`;
            targetGrid.appendChild(card);
        });
    }

    async function loadUsersList() { const list = dom.usersList; if(!list) return; list.innerHTML = 'Cargando...'; try { const snap = await db.collection('usuarios').get(); list.innerHTML = ''; snap.forEach(doc => { const u = doc.data(); const li = document.createElement('div'); li.className = 'user-item'; li.innerHTML = `<span><b>${u.email}</b><br><small>${u.rol.toUpperCase()} - ${u.franquicia}</small></span><div style="display:flex; gap:5px;"><button class="btn btn-secundario" style="padding:4px 10px;" onclick="window.editUser('${u.email}', '${u.rol}', '${u.franquicia}')">✏️</button><button class="btn btn-secundario" style="padding:4px 10px;" onclick="window.confirmDeleteUser('${u.email}')">🗑️</button></div>`; list.appendChild(li); }); } catch (e) { list.innerHTML = 'Error.'; } }
    function configureUIByRole() { if(!userData) return; const rol = userData.rol; if(dom.nav.gestion) dom.nav.gestion.style.display = (rol === 'editor' || rol === 'admin') ? 'inline-block' : 'none'; if(dom.nav.users) dom.nav.users.style.display = (rol === 'admin') ? 'inline-block' : 'none'; if(dom.containerFiltroCreador) dom.containerFiltroCreador.style.display = 'flex'; if (rol === 'admin') loadUsersList(); const selectPromo = document.getElementById('upload-promo'); if(selectPromo) { selectPromo.innerHTML = rol === 'usuario' ? '<option value="Solo X Hoy">Solo X Hoy</option><option value="FEED">FEED (Requiere Aprobación)</option><option value="ADS">ADS (Requiere Aprobación)</option>' : '<option value="FEED">FEED</option><option value="Solo X Hoy">Solo X Hoy</option><option value="ADS">ADS</option>'; } updatePendingBadge(); }
    async function softReload() { showLoader(true, "Actualizando..."); try { document.getElementById('filtro-destino').value = ''; if(dom.filtroCreador) dom.filtroCreador.value = ''; document.getElementById('filtro-promo').value = ''; if(dom.filtroOrden) dom.filtroOrden.value = 'reciente'; await loadCalendar(); await fetchAndLoadPackages(); showView('search'); } catch(e) { console.error(e); } showLoader(false); }

    // ===========================================================
    // 7. AUTH & LISTENERS (TODO AL FINAL PARA QUE FUNCIONE)
    // ===========================================================
    auth.onAuthStateChanged(async (u) => {
        showLoader(true);
        if (u) {
            try {
                const doc = await db.collection('usuarios').doc(u.email.trim().toLowerCase()).get();
                if (doc.exists) {
                    currentUser = u; userData = doc.data(); 
                    dom.loginContainer.style.display='none'; dom.appContainer.style.display='block';
                    if(dom.userEmail) dom.userEmail.innerHTML = `<b>${userData.franquicia||u.email}</b><br><small>${userData.rol.toUpperCase()}</small>`;
                    configureUIByRole(); await loadCalendar(); await fetchAndLoadPackages(); showView('search');
                } else { await window.showAlert(`⛔ Sin permisos.`); auth.signOut(); }
            } catch (e) { console.error(e); await window.showAlert("Error de conexión. Intente recargar."); }
        } else { currentUser = null; userData = null; dom.loginContainer.style.display='flex'; dom.appContainer.style.display='none'; }
        showLoader(false);
    });

    if(dom.logoImg) dom.logoImg.addEventListener('click', async () => { if(currentUser) await softReload(); else window.location.reload(); });
    if(dom.btnToggleCalendar) dom.btnToggleCalendar.onclick = () => { dom.calendarGrid.classList.toggle('collapsed'); dom.btnToggleCalendar.style.transform = dom.calendarGrid.classList.contains('collapsed') ? 'rotate(-90deg)' : 'rotate(0deg)'; };
    if(dom.btnSaveCalendar) dom.btnSaveCalendar.onclick = async () => { const val = dom.calendarInput.value; if(!currentEditingDayKey) return; showLoader(true); try { await db.collection('config').doc('weekly_calendar').set({ [currentEditingDayKey]: val }, { merge: true }); dom.modalCalendar.classList.remove('active'); await loadCalendar(); await softReload(); showLoader(false); } catch (e) { window.showAlert("Error al guardar.", "error"); } };
    if(dom.btnCloseCalendar) dom.btnCloseCalendar.onclick = () => dom.modalCalendar.classList.remove('active');
    
    if(dom.nav.search) dom.nav.search.onclick = () => showView('search');
    if(dom.nav.upload) dom.nav.upload.onclick = () => { isEditingId = null; originalCreator = ''; document.getElementById('upload-form').reset(); dom.containerServicios.innerHTML=''; showView('upload'); };
    if(dom.nav.gestion) dom.nav.gestion.onclick = async () => { await fetchAndLoadPackages(); showView('gestion'); };
    if(dom.nav.users) dom.nav.users.onclick = async () => { await loadUsersList(); showView('users'); };

    if(dom.btnLogin) dom.btnLogin.addEventListener('click', () => { showLoader(true); auth.signInWithPopup(provider).catch(() => showLoader(false)); });
    if(dom.btnLogout) dom.btnLogout.addEventListener('click', () => { showLoader(true); auth.signOut().then(() => window.location.reload()); });
    if(dom.inputFechaViaje) dom.inputFechaViaje.addEventListener('change', (e) => { const f = e.target.value; if(f && f < minGlobalDate) { window.showAlert("Fecha inválida"); dom.inputFechaViaje.value=""; return; } if(f) { const inputs = dom.containerServicios.querySelectorAll('input[type="date"]'); inputs.forEach(i => i.min = f); } });
    if(dom.btnBuscar) dom.btnBuscar.addEventListener('click', applyFilters);
    if(dom.btnLimpiar) dom.btnLimpiar.addEventListener('click', () => { document.getElementById('filtro-destino').value=''; if(dom.filtroCreador) dom.filtroCreador.value=''; document.getElementById('filtro-promo').value=''; if(dom.filtroOrden) dom.filtroOrden.value='reciente'; applyFilters(); });
    if(dom.filtroOrden) dom.filtroOrden.addEventListener('change', applyFilters);
    if(dom.filtroCreador) dom.filtroCreador.addEventListener('change', applyFilters);
    if(dom.modalClose) dom.modalClose.onclick = () => dom.modal.classList.remove('active');
    window.onclick = (e) => { if(e.target === dom.modal) dom.modal.classList.remove('active'); };

    if (dom.userForm) { dom.userForm.addEventListener('submit', async (e) => { e.preventDefault(); showLoader(true); const mail = document.getElementById('user-email-input').value.trim().toLowerCase(); const r = document.getElementById('user-role-input').value; const f = document.getElementById('user-franchise-input').value; try { await db.collection('usuarios').doc(mail).set({ email: mail, rol: r, franquicia: f }, { merge: true }); await window.showAlert('Guardado.', 'success'); document.getElementById('user-email-input').value=''; loadUsersList(); } catch (e) { window.showAlert('Error.', 'error'); } showLoader(false); }); }
    if(dom.btnAgregarServicio) dom.btnAgregarServicio.addEventListener('click', () => { if(dom.selectorServicio.value) agregarModuloServicio(dom.selectorServicio.value); dom.selectorServicio.value = ""; });
    if(dom.uploadForm) dom.uploadForm.addEventListener('submit', async (e) => { e.preventDefault(); showLoader(true); const r = userData.rol; const pt = document.getElementById('upload-promo').value; let st = 'approved'; if (r === 'usuario' && (pt === 'FEED' || pt === 'ADS')) st = 'pending'; const cost = parseFloat(dom.inputCostoTotal.value) || 0; const tar = parseFloat(document.getElementById('upload-tarifa-total').value) || 0; const f = dom.inputFechaViaje.value; if (tar < cost) { showLoader(false); return window.showAlert("Tarifa menor al costo.", 'error'); } if (!f) { showLoader(false); return window.showAlert("Falta fecha.", 'error'); } const cards = document.querySelectorAll('.servicio-card'); if (cards.length === 0) { showLoader(false); return window.showAlert("Agrega servicios.", 'error'); } let sData = []; for (let c of cards) { const s = { tipo: c.dataset.tipo }; c.querySelectorAll('input, select, textarea').forEach(i => { if (i.type === 'checkbox') s[i.name] = i.checked; else if (i.type === 'hidden') { if(i.name==='hotel_estrellas') s[i.name]=i.value; else s[i.name]=i.parentElement.querySelector('.counter-value').innerText||i.value; } else s[i.name] = i.value; }); sData.push(s); } const idG = isEditingId || 'pkg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9); let cr = (isEditingId && originalCreator) ? originalCreator : (userData.franquicia || 'Desconocido'); const pay = { id_paquete: idG, destino: document.getElementById('upload-destino').value, salida: document.getElementById('upload-salida').value, fecha_salida: f, costos_proveedor: cost, tarifa: tar, moneda: document.getElementById('upload-moneda').value, tipo_promo: pt, financiacion: document.getElementById('upload-financiacion').value, servicios: sData, status: st, creador: cr, editor_email: currentUser.email, action_type: isEditingId ? 'edit' : 'create' }; try { await secureFetch(API_URL_UPLOAD, pay); await window.showAlert(st === 'pending' ? 'En revisión.' : 'Guardado.', 'success'); await softReload(); } catch(e) { window.showAlert("Error al guardar.", 'error'); } });

    function agregarModuloServicio(t,d=null){const c=dom.containerServicios;const x=c.querySelectorAll('.servicio-card');const h=Array.from(x).some(k=>k.dataset.tipo==='bus'||k.dataset.tipo==='crucero');if(!d){if(h&&t!=='adicional')return window.showAlert("Solo Adicionales.","error");if((t==='bus'||t==='crucero')&&x.length>0)return window.showAlert("Exclusivo.","error");}const id=Date.now()+Math.random();const v=document.createElement('div');v.className=`servicio-card ${t}`;v.dataset.id=id;v.dataset.tipo=t;let m=`<button type="button" class="btn-eliminar-servicio" onclick="this.parentElement.remove();window.calcularTotal()">×</button>`;
    if(t==='aereo')m+=`<h4>✈️ Aéreo</h4><div class="form-group-row"><div class="form-group"><label>Aerolínea</label><input type="text" name="aerolinea" required></div><div class="form-group"><label>Ida</label><input type="date" name="fecha_aereo" required></div><div class="form-group"><label>Vuelta</label><input type="date" name="fecha_regreso"></div></div><div class="form-group-row"><div class="form-group"><label>Escalas</label>${window.crearContadorHTML('escalas',0)}</div><div class="form-group"><label>Equipaje</label><select name="tipo_equipaje"><option>Objeto Personal</option><option>Objeto Personal + Carry On</option><option>Objeto Personal + Bodega</option><option>Objeto Personal + Carry On + Bodega</option></select></div></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
    else if(t==='hotel')m+=`<h4>🏨 Hotel</h4><div class="form-group"><label>Alojamiento</label><input type="text" name="hotel_nombre" required></div><div class="form-group"><label>Estrellas</label><div class="star-rating" data-id="${id}"><span onclick="window.setStars('${id}', 1)">★</span><span onclick="window.setStars('${id}', 2)">★</span><span onclick="window.setStars('${id}', 3)">★</span><span onclick="window.setStars('${id}', 4)">★</span><span onclick="window.setStars('${id}', 5)">★</span></div><input type="hidden" name="hotel_estrellas" id="stars-${id}" value="0"></div><div class="form-group"><label>Ubicación (Link)</label><input type="url" name="hotel_link" placeholder="http://googleusercontent.com/maps..."></div><div class="form-group-row"><div class="form-group"><label>Check In</label><input type="date" name="checkin" onchange="window.calcularNoches('${id}')" required></div><div class="form-group"><label>Check Out</label><input type="date" name="checkout" onchange="window.calcularNoches('${id}')" required></div><div class="form-group"><label>Noches</label><input type="text" name="noches" id="noches-${id}" readonly style="background:#eee;width:60px;"></div></div><div class="form-group"><label>Régimen</label><select name="regimen"><option>Solo Habitación</option><option>Desayuno</option><option>Media Pensión</option><option>All Inclusive</option></select></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
    else if(t==='traslado')m+=`<h4>🚕 Traslado</h4><div class="checkbox-group"><label class="checkbox-label"><input type="checkbox" name="trf_in"> In</label><label class="checkbox-label"><input type="checkbox" name="trf_out"> Out</label><label class="checkbox-label"><input type="checkbox" name="trf_hah"> Hotel - Hotel</label></div><div class="form-group-row"><div class="form-group"><label>Tipo</label><select name="tipo_trf"><option>Compartido</option><option>Privado</option></select></div><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
    else if(t==='seguro')m+=`<h4>🛡️ Seguro</h4><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Cobertura</label><input type="text" name="cobertura" required></div></div><div class="form-group-row"><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
    else if(t==='adicional')m+=`<h4>➕ Adicional</h4><div class="form-group"><label>Detalle</label><input type="text" name="descripcion" required></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
    else if(t==='bus')m+=`<h4>🚌 Paquete Bus</h4><div class="form-group-row"><div class="form-group"><label>Cant. Noches</label><input type="number" name="bus_noches" required></div><div class="form-group" style="display:flex;align-items:flex-end;padding-bottom:10px;"><div class="checkbox-group"><label class="checkbox-label"><input type="checkbox" name="bus_alojamiento" onchange="document.getElementById('br-${id}').style.display=this.checked?'block':'none'"> Incluye Alojamiento</label></div></div></div><div id="br-${id}" style="display:none;margin-top:-10px;margin-bottom:15px;background:#f9f9f9;padding:10px;border-radius:8px;"><label>Régimen</label><select name="bus_regimen"><option value="Sin Pensión">Sin Pensión</option><option value="Desayuno">Desayuno</option><option value="Media Pensión">Media Pensión</option><option value="Pensión Completa">Pensión Completa</option></select></div><div class="checkbox-group" style="margin-bottom:15px;"><label class="checkbox-label"><input type="checkbox" name="bus_excursiones"> Incluye Excursiones</label><label class="checkbox-label"><input type="checkbox" name="bus_asistencia"> Asistencia al Viajero</label></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
    else if(t==='crucero')m+=`<h4>🚢 Crucero</h4><div class="form-group-row"><div class="form-group"><label>Naviera</label><input type="text" name="crucero_naviera" required></div><div class="form-group"><label>Noches</label><input type="number" name="crucero_noches" required></div></div><div class="form-group-row"><div class="form-group"><label>Puerto Salida</label><input type="text" name="crucero_puerto_salida" required></div><div class="form-group"><label>Puertos que Recorre</label><input type="text" name="crucero_recorrido" required></div></div><div class="form-group"><label>Información Adicional</label><textarea name="crucero_info" rows="2"></textarea></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
    v.innerHTML=m;c.appendChild(v);
    const minD = dom.inputFechaViaje.value || new Date().toISOString().split('T')[0];
    v.querySelectorAll('input[type="date"]').forEach(i=>i.min=minD);
    if(d){v.querySelectorAll('input, select, textarea').forEach(i=>{if(d[i.name]!==undefined){if(i.type==='checkbox'){i.checked=d[i.name];i.dispatchEvent(new Event('change'));}else if(i.type==='hidden'){if(i.name==='hotel_estrellas')window.setStars(id, d[i.name]);else{i.parentElement.querySelector('.counter-value').innerText=d[i.name];i.value=d[i.name];}}else{i.value=d[i.name];if(i.name==='checkin'||i.name==='checkout')window.calcularNoches(id);}}});}}

});
