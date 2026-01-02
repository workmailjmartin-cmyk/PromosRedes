document.addEventListener('DOMContentLoaded', () => {

    // 1. CONFIGURACIÓN
    const firebaseConfig = { apiKey: "AIzaSyCBiyH6HTatUxNxQ6GOxGp-xFWa7UfCMJk", authDomain: "feliz-viaje-43d02.firebaseapp.com", projectId: "feliz-viaje-43d02", storageBucket: "feliz-viaje-43d02.firebasestorage.app", messagingSenderId: "931689659600", appId: "1:931689659600:web:66dbce023705936f26b2d5", measurementId: "G-2PNDZR3ZS1" };
    const API_URL_SEARCH = 'https://n8n.srv1097024.hstgr.cloud/webhook/83cb99e2-c474-4eca-b950-5d377bcf63fa';
    const API_URL_UPLOAD = 'https://n8n.srv1097024.hstgr.cloud/webhook/6ec970d0-9da4-400f-afcc-611d3e2d82eb';

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore(); 
    const provider = new firebase.auth.GoogleAuthProvider();

    let currentUser = null, userData = null, allPackages = [], uniquePackages = [], isEditingId = null, originalCreator = ''; 

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
        logoImg: document.getElementById('app-logo'), loader: document.getElementById('loader-overlay'),
        badgeGestion: document.getElementById('badge-gestion')
    };

    // 2. UTILS BÁSICOS (Definidos PRIMERO)
    const showLoader = (show, text = null) => { 
        if(dom.loader) {
            dom.loader.style.display = show ? 'flex' : 'none';
            let p = dom.loader.querySelector('p');
            if (!p) { p = document.createElement('p'); p.style.cssText = "margin-top:20px; font-weight:600; color:#11173d; font-size:1.2em;"; dom.loader.appendChild(p); }
            p.innerText = text || "Procesando...";
        }
    };
    const formatMoney = (a) => new Intl.NumberFormat('es-AR', { style: 'decimal', minimumFractionDigits: 0 }).format(a);
    const formatDateAR = (s) => { if(!s) return '-'; const p = s.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s; };

    // ALERTAS
    window.showAlert = (message, type = 'error') => { return new Promise((resolve) => { showLoader(false); const overlay = document.getElementById('custom-alert-overlay'); const title = document.getElementById('custom-alert-title'); const msg = document.getElementById('custom-alert-message'); const icon = document.getElementById('custom-alert-icon'); const btn = document.getElementById('custom-alert-btn'); const btnCancel = document.getElementById('custom-alert-cancel'); if(btnCancel) btnCancel.style.display = 'none'; if (type === 'success') { title.innerText = '¡Éxito!'; title.style.color = '#4caf50'; icon.innerHTML = '✅'; } else if (type === 'info') { title.innerText = 'Información'; title.style.color = '#3498db'; icon.innerHTML = 'ℹ️'; } else { title.innerText = 'Atención'; title.style.color = '#ef5a1a'; icon.innerHTML = '⚠️'; } msg.innerText = message; overlay.style.display = 'flex'; btn.onclick = () => { overlay.style.display = 'none'; resolve(); }; }); };
    window.showConfirm = (message) => { return new Promise((resolve) => { showLoader(false); const overlay = document.getElementById('custom-alert-overlay'); const title = document.getElementById('custom-alert-title'); const msg = document.getElementById('custom-alert-message'); const icon = document.getElementById('custom-alert-icon'); const btnOk = document.getElementById('custom-alert-btn'); const btnCancel = document.getElementById('custom-alert-cancel'); title.innerText = 'Confirmación'; title.style.color = '#11173d'; icon.innerHTML = '❓'; msg.innerText = message; if(btnCancel) btnCancel.style.display = 'inline-block'; overlay.style.display = 'flex'; btnOk.onclick = () => { overlay.style.display = 'none'; resolve(true); }; if(btnCancel) btnCancel.onclick = () => { overlay.style.display = 'none'; resolve(false); }; }); };

    // BADGE (Definida ANTES de usarse)
    function updatePendingBadge() {
        const badge = document.getElementById('badge-gestion'); if (!badge) return;
        if (!userData || (userData.rol !== 'admin' && userData.rol !== 'editor')) { badge.style.display = 'none'; return; }
        const pendingCount = uniquePackages.filter(p => p.status === 'pending').length;
        if (pendingCount > 0) { badge.innerText = pendingCount; badge.style.display = 'inline-block'; } else { badge.style.display = 'none'; }
    }

    // 3. LÓGICA DE NEGOCIO
    function getNoches(pkg) {
        let servicios = []; try { const raw = pkg['servicios'] || pkg['item.servicios']; servicios = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch(e) {}
        if(!Array.isArray(servicios)) return 0;
        // Prioridad 1: Hoteles
        let totalHotel = 0; let hayHotel = false;
        servicios.forEach(s => { if (s.tipo === 'hotel' && s.noches) { totalHotel += parseInt(s.noches) || 0; hayHotel = true; } });
        if(hayHotel && totalHotel > 0) return totalHotel;
        // Prioridad 2: Bus/Crucero
        const bus = servicios.find(s => s.tipo === 'bus'); if (bus && bus.bus_noches) return parseInt(bus.bus_noches);
        const crucero = servicios.find(s => s.tipo === 'crucero'); if (crucero && crucero.crucero_noches) return parseInt(crucero.crucero_noches);
        // Prioridad 3: Fechas
        if(!pkg['fecha_salida']) return 0;
        let fechaStr = pkg['fecha_salida']; if(fechaStr.includes('/')) fechaStr = fechaStr.split('/').reverse().join('-');
        const start = new Date(fechaStr + 'T00:00:00'); let maxDate = new Date(start), hasData = false;
        servicios.forEach(s => {
            if(s.tipo==='hotel'&&s.checkout){ const d=new Date(s.checkout+'T00:00:00'); if(d>maxDate){maxDate=d; hasData=true;} }
            if(s.tipo==='aereo'&&s.fecha_regreso){ const d=new Date(s.fecha_regreso+'T00:00:00'); if(d>maxDate){maxDate=d; hasData=true;} }
        });
        return hasData ? Math.ceil((maxDate - start) / 86400000) : 0;
    }

    function getSummaryIcons(pkg) { 
        let s = []; try { s = typeof pkg.servicios === 'string' ? JSON.parse(pkg.servicios) : pkg.servicios; } catch(e) {} 
        if (!Array.isArray(s)) return ''; 
        const m = {'aereo':'✈️','hotel':'🏨','traslado':'🚕','seguro':'🛡️','bus':'🚌','crucero':'🚢'}; 
        return [...new Set(s.map(x => m[x.tipo] || '🔹'))].join(' '); 
    }

    // 4. COLA / MUTEX
    async function secureFetch(url, body) {
        if (!currentUser) throw new Error('No auth');
        if (url === API_URL_SEARCH) return await _doFetch(url, body);
        return await uploadWithMutex(url, body);
    }
    async function _doFetch(url, body) {
        const token = await currentUser.getIdToken(true);
        const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body:JSON.stringify(body), cache:'no-store' });
        if (!res.ok) throw new Error(`API Error`);
        const j = await res.json();
        if (j.error || j.status === 'error' || (Array.isArray(j) && j.length === 0 && url === API_URL_UPLOAD)) throw new Error(j.message || "Error procesando.");
        return j;
    }
    async function uploadWithMutex(url, body) {
        const lockRef = db.collection('config').doc('upload_lock');
        let acquired = false, attempts = 0;
        while(!acquired && attempts < 20) {
            try { await db.runTransaction(async (t) => { const doc = await t.get(lockRef); const now = Date.now(); if (!doc.exists) { t.set(lockRef, { locked: true, user: currentUser.email, timestamp: now }); return; } const data = doc.data(); if (data && data.locked && (now - data.timestamp < 15000)) { throw "LOCKED"; } t.set(lockRef, { locked: true, user: currentUser.email, timestamp: now }); }); acquired = true; } catch (e) { if (e === "LOCKED" || e.message === "LOCKED") { showLoader(true, `⏳ Esperando turno... (${attempts+1}/20)`); await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000)); attempts++; } else { throw e; } }
        }
        if(!acquired) throw new Error("Sistema saturado. Intenta en 1 min.");
        try { showLoader(true, "🚀 Subiendo datos..."); return await _doFetch(url, body); } finally { await lockRef.set({ locked: false }); }
    }

    // 5. CARGA DE DATOS
    async function fetchAndLoadPackages() { 
        showLoader(true);
        try { 
            let d = await secureFetch(API_URL_SEARCH, {}); 
            if (typeof d === 'string') d = JSON.parse(d); 
            allPackages = d; 
            uniquePackages = processPackageHistory(allPackages); 
            populateFranchiseFilter(uniquePackages); 
            applyFilters();
            updatePendingBadge(); // AHORA SÍ ESTÁ DEFINIDA
        } catch(e){ console.error(e); }
        showLoader(false);
    }

    function processPackageHistory(rawList) {
        if (!Array.isArray(rawList)) return [];
        const historyMap = new Map();
        rawList.forEach(pkg => { const id = pkg.id_paquete || pkg.id || pkg['item.id']; if (!id) return; if (!historyMap.has(id)) historyMap.set(id, []); historyMap.get(id).push(pkg); });
        const processedList = [];
        historyMap.forEach((versions) => { const latestVersion = versions[versions.length - 1]; if (latestVersion.status === 'deleted') return; processedList.push(latestVersion); });
        return processedList;
    }

    function populateFranchiseFilter(packages) { 
        const selector = dom.filtroCreador; if(!selector) return; 
        const currentVal = selector.value; 
        const creadores = [...new Set(packages.map(p => p.creador).filter(Boolean))]; 
        selector.innerHTML = '<option value="">Todas las Franquicias</option>'; 
        creadores.sort().forEach(c => { const opt = document.createElement('option'); opt.value = c; opt.innerText = c; selector.appendChild(opt); }); 
        selector.value = currentVal; 
    }

    function applyFilters() {
        const fDestino = document.getElementById('filtro-destino').value.toLowerCase(); 
        const fCreador = dom.filtroCreador ? dom.filtroCreador.value : ''; 
        const fPromo = document.getElementById('filtro-promo').value; 
        const fOrden = dom.filtroOrden ? dom.filtroOrden.value : 'reciente';
        
        let result = uniquePackages.filter(pkg => { 
            const mDestino = !fDestino || (pkg.destino && pkg.destino.toLowerCase().includes(fDestino)); 
            const mCreador = !fCreador || (pkg.creador && pkg.creador === fCreador); 
            const mPromo = !fPromo || (pkg.tipo_promo && pkg.tipo_promo === fPromo); 
            if (!mDestino || !mCreador || !mPromo) return false; 
            const isOwner = pkg.editor_email === currentUser.email; 
            const isPending = pkg.status === 'pending'; 
            if (isPending && !isOwner && userData.rol !== 'admin' && userData.rol !== 'editor') return false; 
            return true; 
        });

        if (fOrden === 'reciente') { result.sort((a, b) => { const getTs = (id) => { if(!id || !id.startsWith('pkg_')) return 0; return parseInt(id.split('_')[1]) || 0; }; return getTs(b.id_paquete) - getTs(a.id_paquete); }); } 
        else if (fOrden === 'menor_precio') result.sort((a, b) => parseFloat(a.tarifa) - parseFloat(b.tarifa)); 
        else if (fOrden === 'mayor_precio') result.sort((a, b) => parseFloat(b.tarifa) - parseFloat(a.tarifa));
        
        renderCards(result, dom.grid); 
        if (userData && (userData.rol === 'admin' || userData.rol === 'editor')) { const pendientes = uniquePackages.filter(p => p.status === 'pending'); renderCards(pendientes, dom.gridGestion); }
    }

    function renderCards(list, targetGrid = dom.grid) {
        targetGrid.innerHTML = ''; if (!list || list.length === 0) { targetGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;">No hay resultados.</p>'; return; }
        list.forEach(pkg => {
            if (!pkg.destino) return; 
            const card = document.createElement('div'); const noches = getNoches(pkg); card.className = 'paquete-card'; const tarifaMostrar = parseFloat(pkg['tarifa']) || 0; const summaryIcons = getSummaryIcons(pkg); 
            let statusTag = ''; if (pkg.status === 'pending') statusTag = `<span style="background-color:#ffeaa7; color:#d35400; padding:2px 8px; border-radius:10px; font-size:0.7em; margin-left:5px;">⏳ En Revisión</span>`;
            card.innerHTML = `<div class="card-clickable"><div class="card-header"><div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%;"><div style="max-width:75%; padding-right:30px;"><h3 style="margin:0;font-size:1.5em;line-height:1.2;color:#11173d;">${pkg['destino']} ${statusTag}</h3></div>${noches > 0 ? `<div style="background:#eef2f5;color:#11173d;padding:5px 10px;border-radius:12px;font-weight:bold;font-size:0.8em;white-space:nowrap;">🌙 ${noches}</div>` : ''}</div><div class="fecha">📅 Salida: ${formatDateAR(pkg['fecha_salida'])}</div></div><div class="card-body"><div style="font-size:0.85em;color:#555;display:flex;flex-wrap:wrap;line-height:1.4;">${summaryIcons}</div></div><div class="card-footer"><div><span style="background-color:#56DDE0;color:#11173d;padding:4px 12px;border-radius:20px;font-weight:600;font-size:0.75em;display:inline-block;">${pkg['tipo_promo']}</span></div><div><p class="precio-valor">${pkg['moneda']} $${formatMoney(Math.round(tarifaMostrar/2))}</p></div></div></div>`;
            targetGrid.appendChild(card); card.querySelector('.card-clickable').addEventListener('click', () => openModal(pkg));
        });
    }

    // 6. GENERADORES TEXTO Y MODAL
    function generarTextoPresupuesto(pkg) {
        const noches = getNoches(pkg); const tarifa = parseFloat(pkg['tarifa']) || 0; const tarifaDoble = Math.round(tarifa / 2);
        let servicios = []; try { servicios = typeof pkg.servicios === 'string' ? JSON.parse(pkg.servicios) : pkg.servicios; } catch(e) {}
        let texto = `*${pkg.destino.toUpperCase()}*\n\n📅 Salida: ${formatDateAR(pkg.fecha_salida)}\n📍 Desde: ${pkg.salida}\n${noches > 0 ? `🌙 Duración: ${noches} Noches\n` : ''}\n`;
        if (Array.isArray(servicios)) { servicios.forEach(s => { 
            if(s.tipo === 'aereo') { let es = (s.escalas == 0 || s.escalas == '0') ? "Directo" : (s.escalas == 1 ? "1 Escala" : `${s.escalas} Escalas`); texto += `✈️ AÉREO\n${s.aerolinea || 'Aerolínea'}\n${formatDateAR(s.fecha_aereo)}${s.fecha_regreso ? ' - ' + formatDateAR(s.fecha_regreso) : ''}\n🔄 ${es} | 🧳 ${s.tipo_equipaje || '-'}\n\n`; }
            else if (s.tipo === 'hotel') { let stars = ''; if(s.hotel_estrellas) for(let i=0;i<s.hotel_estrellas;i++) stars+='⭐'; texto += `🏨 HOTEL\n${s.hotel_nombre} ${stars} (${s.regimen || ''})\n`; if(s.noches) texto += `🌙 ${s.noches} Noches`; if(s.checkin) texto += ` | 📥 Ingreso: ${formatDateAR(s.checkin)}`; if(s.hotel_link) texto += `\n📍 Ubicación: ${s.hotel_link}`; texto += `\n\n`; }
            else if (s.tipo === 'traslado') { texto += `🚕 TRASLADO\n${s.tipo_trf || 'Incluido'}\n\n`; }
            else if (s.tipo === 'seguro') { texto += `🛡️ SEGURO\n${s.cobertura || 'Asistencia'}\n\n`; }
            else if (s.tipo === 'bus') { texto += `🚌 BUS\n${s.bus_noches} Noches ${s.bus_regimen || ''}\n\n`; }
            else if (s.tipo === 'crucero') { texto += `🚢 CRUCERO\n${s.crucero_naviera} - ${s.crucero_recorrido}\n\n`; }
            else if (s.tipo === 'adicional') { texto += `➕ ADICIONAL\n${s.descripcion}\n\n`; }
        }); }
        texto += `💲*Tarifa final por Persona en Base Doble:*\n${pkg.moneda} $${formatMoney(tarifaDoble)}\n\n`;
        if(pkg.financiacion) texto += `💳 Financiación: ${pkg.financiacion}\n\n`;
        return texto + `--------------------------------------------\nInformación importante:\n-Tarifas y disponibilidad sujetas a cambio.\n-Cotización válida al ${pkg.fecha_creacion||new Date().toLocaleDateString('es-AR')}\n\n⚠¡Cupos limitados!\nAsistencia al viajero no incluida.`;
    }
    window.copiarPresupuesto = (pkg) => { const t = generarTextoPresupuesto(pkg); navigator.clipboard.writeText(t).then(() => window.showAlert("✅ Copiado!", "success")).catch(() => window.showAlert("Error al copiar", "error")); };

    function renderServiciosClienteHTML(rawJson) { 
        let s=[]; try{s=typeof rawJson==='string'?JSON.parse(rawJson):rawJson;}catch(e){return'<p>-</p>';} if(!Array.isArray(s)||s.length===0)return'<p>-</p>'; 
        let h=''; s.forEach(x=>{ let i='🔹',t='',l=[]; 
        if(x.tipo==='aereo'){ i='✈️';t='AÉREO'; l.push(`<b>${x.aerolinea}</b>`); l.push(`${formatDateAR(x.fecha_aereo)}${x.fecha_regreso?` - ${formatDateAR(x.fecha_regreso)}`:''}`); let es = (x.escalas == 0) ? "Directo" : (x.escalas == 1 ? "1 Escala" : `${x.escalas} Escalas`); l.push(`🔄 ${es} | 🧳 ${x.tipo_equipaje || '-'}`);} 
        else if(x.tipo==='hotel'){ i='🏨';t='HOTEL'; let stars = ''; if(x.hotel_estrellas) for(let k=0;k<x.hotel_estrellas;k++) stars+='⭐'; l.push(`<b>${x.hotel_nombre}</b> <span style="color:#ef5a1a;">${stars}</span>`); l.push(`(${x.regimen})`); let det = []; if(x.noches) det.push(`🌙 ${x.noches} Noches`); if(x.checkin) det.push(`Ingreso: ${formatDateAR(x.checkin)}`); if(det.length > 0) l.push(`<small>${det.join(' | ')}</small>`); if(x.hotel_link) l.push(`<a href="${x.hotel_link}" target="_blank" style="color:#ef5a1a;font-weight:bold;text-decoration:none;">📍 Ver Ubicación</a>`);} 
        else if(x.tipo==='traslado'){i='🚕';t='TRASLADO';l.push(`${x.tipo_trf}`);} 
        else if(x.tipo==='seguro'){ i='🛡️';t='SEGURO'; if(x.cobertura) l.push(x.cobertura); } 
        else if(x.tipo==='adicional'){i='➕';t='ADICIONAL';l.push(`${x.descripcion}`);} else if(x.tipo==='bus'){i='🚌';t='BUS';l.push(`${x.bus_noches} Noches`);} else if(x.tipo==='crucero'){i='🚢';t='CRUCERO';l.push(`${x.crucero_naviera} - ${x.crucero_recorrido}`);} h+=`<div style="margin-bottom:5px;border-left:3px solid #ddd;padding-left:10px;"><div style="font-weight:bold;color:#11173d;">${i} ${t}</div><div style="font-size:0.9em;">${l.join('<br>')}</div></div>`; }); return h; 
    }
    
    function renderCostosProveedoresHTML(rawJson) { let s=[]; try{s=typeof rawJson==='string'?JSON.parse(rawJson):rawJson;}catch(e){return'<p>-</p>';} if(!Array.isArray(s)||s.length===0)return'<p>-</p>'; let h='<ul style="padding-left:15px;margin:0;">'; s.forEach(x=>{ h+=`<li>${x.proveedor||x.tipo}: $${x.costo}</li>`; }); return h+'</ul>'; }

    // 7. AUTH & INIT (Ahora sí con funciones definidas)
    auth.onAuthStateChanged(async (u) => {
        showLoader(true);
        if (u) {
            try {
                const doc = await db.collection('usuarios').doc(u.email.trim().toLowerCase()).get();
                if (doc.exists) {
                    currentUser = u; userData = doc.data(); 
                    dom.loginContainer.style.display='none'; dom.appContainer.style.display='block';
                    if(dom.userEmail) dom.userEmail.innerHTML = `<b>${userData.franquicia||u.email}</b><br><small>${userData.rol.toUpperCase()}</small>`;
                    configureUIByRole(); await fetchAndLoadPackages(); showView('search');
                } else { await window.showAlert(`⛔ Sin permisos.`); auth.signOut(); }
            } catch (e) { console.error(e); await window.showAlert("Error de conexión. Intente recargar."); }
        } else { currentUser = null; userData = null; dom.loginContainer.style.display='flex'; dom.appContainer.style.display='none'; }
        showLoader(false);
    });

    dom.btnLogin.addEventListener('click', () => { showLoader(true); auth.signInWithPopup(provider).catch(() => showLoader(false)); });
    dom.btnLogout.addEventListener('click', () => { showLoader(true); auth.signOut().then(() => window.location.reload()); });

    function showView(n) { Object.values(dom.views).forEach(v => v.classList.remove('active')); Object.values(dom.nav).forEach(b => b.classList.remove('active')); dom.views[n].classList.add('active'); dom.nav[n].classList.add('active'); }
    dom.nav.search.onclick = () => showView('search');
    dom.nav.upload.onclick = () => { isEditingId = null; originalCreator = ''; document.getElementById('upload-form').reset(); dom.containerServicios.innerHTML=''; showView('upload'); };
    dom.nav.gestion.onclick = async () => { await fetchAndLoadPackages(); showView('gestion'); };
    dom.nav.users.onclick = async () => { await loadUsersList(); showView('users'); };
    dom.modalClose.onclick = () => dom.modal.style.display = 'none';
    window.onclick = e => { if(e.target === dom.modal) dom.modal.style.display='none'; };
    dom.btnBuscar.addEventListener('click', applyFilters);
    dom.btnLimpiar.addEventListener('click', () => { document.getElementById('filtro-destino').value=''; if(dom.filtroCreador) dom.filtroCreador.value=''; document.getElementById('filtro-promo').value=''; if(dom.filtroOrden) dom.filtroOrden.value='reciente'; applyFilters(); });
    if(dom.filtroOrden) dom.filtroOrden.addEventListener('change', applyFilters);
    if(dom.filtroCreador) dom.filtroCreador.addEventListener('change', applyFilters);

    // 8. OTRAS FUNCIONES (Formularios, Usuarios, Gestión)
    async function loadUsersList() {
        const list = dom.usersList; list.innerHTML = 'Cargando...';
        try { const snap = await db.collection('usuarios').get(); list.innerHTML = ''; snap.forEach(doc => { const u = doc.data(); const li = document.createElement('div'); li.className = 'user-item'; li.innerHTML = `<span><b>${u.email}</b><br><small>${u.rol.toUpperCase()} - ${u.franquicia}</small></span><div style="display:flex; gap:5px;"><button class="btn btn-secundario" style="padding:4px 10px;" onclick="editUser('${u.email}', '${u.rol}', '${u.franquicia}')">✏️</button><button class="btn btn-secundario" style="padding:4px 10px;" onclick="confirmDeleteUser('${u.email}')">🗑️</button></div>`; list.appendChild(li); }); } catch (e) { list.innerHTML = 'Error.'; }
    }
    window.editUser = (e, r, f) => { document.getElementById('user-email-input').value = e; document.getElementById('user-role-input').value = r; document.getElementById('user-franchise-input').value = f; window.scrollTo(0,0); window.showAlert(`Editando: ${e}`, 'info'); };
    window.confirmDeleteUser = async (e) => { if(await window.showConfirm("¿Eliminar?")) try { showLoader(true); await db.collection('usuarios').doc(e).delete(); loadUsersList(); showLoader(false); } catch(x){alert('Error');} };

    window.deletePackage = async (pkg) => { if (!await window.showConfirm("⚠️ ¿Eliminar este paquete?")) return; showLoader(true); try { const id = pkg.id_paquete || pkg.id || pkg['item.id']; await secureFetch(API_URL_UPLOAD, { action_type: 'delete', id_paquete: id, status: 'deleted' }); await window.showAlert("Paquete eliminado.", "success"); document.getElementById('boton-buscar').click(); } catch (e) { window.showAlert("Error al eliminar.", "error"); } };
    window.approvePackage = async (pkg) => { if (!await window.showConfirm("¿Aprobar publicación en FEED?")) return; showLoader(true); try { let payload = JSON.parse(JSON.stringify(pkg)); payload.status = 'approved'; payload.action_type = 'edit'; payload.creador = pkg.creador; delete payload['row_number']; await secureFetch(API_URL_UPLOAD, payload); await window.showAlert("Paquete Aprobado.", "success"); document.getElementById('boton-buscar').click(); } catch(e) { window.showAlert("Error al aprobar.", "error"); } };
    window.startEditing = async (pkg) => { if (!await window.showConfirm("Se abrirá el formulario de edición.")) return; isEditingId = pkg.id_paquete || pkg.id || pkg['item.id']; originalCreator = pkg.creador || ''; document.getElementById('upload-destino').value = pkg.destino; document.getElementById('upload-salida').value = pkg.salida; let fecha = pkg.fecha_salida; if(fecha && fecha.includes('/')) fecha = fecha.split('/').reverse().join('-'); dom.inputFechaViaje.value = fecha; document.getElementById('upload-moneda').value = pkg.moneda; document.getElementById('upload-promo').value = pkg.tipo_promo; document.getElementById('upload-financiacion').value = pkg.financiacion || ''; document.getElementById('upload-tarifa-total').value = pkg.tarifa; dom.containerServicios.innerHTML = ''; let servicios = []; try { const raw = pkg['servicios'] || pkg['item.servicios']; servicios = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch(e) {} if (Array.isArray(servicios)) { servicios.forEach(s => agregarModuloServicio(s.tipo, s)); } window.calcularTotal(); dom.modal.style.display = 'none'; showView('upload'); window.scrollTo(0,0); window.showAlert("Modo Edición Activado.", "info"); };

    window.crearContadorHTML = (n, v) => `<div class="counter-wrapper"><button type="button" class="counter-btn" onclick="this.nextElementSibling.innerText=Math.max(0,parseInt(this.nextElementSibling.innerText)-1)">-</button><span class="counter-value">${v}</span><button type="button" class="counter-btn" onclick="this.previousElementSibling.innerText=parseInt(this.previousElementSibling.innerText)+1">+</button><input type="hidden" name="${n}" value="${v}"></div>`;
    window.calcularNoches = (id) => { const c=document.querySelector(`.servicio-card[data-id="${id}"]`); if(!c)return; const i=c.querySelector('input[name="checkin"]'), o=c.querySelector('input[name="checkout"]'); if(i&&o&&i.value&&o.value){ const d1=new Date(i.value), d2=new Date(o.value); document.getElementById(`noches-${id}`).value=(d2>d1)?Math.ceil((d2-d1)/86400000):'-'; } };
    window.calcularTotal = () => { let t=0; document.querySelectorAll('.input-costo').forEach(i=>t+=parseFloat(i.value)||0); dom.inputCostoTotal.value = t; dom.inputTarifaTotal.value = Math.round(t * 1.185); };
    window.setStars = (id, count) => { const c=document.querySelector(`.servicio-card[data-id="${id}"] .star-rating`); const i=document.getElementById(`stars-${id}`); if(c&&i){ i.value=count; c.querySelectorAll('span').forEach((s,idx)=>{ if(idx<count)s.classList.add('filled');else s.classList.remove('filled'); }); } };

    dom.uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault(); showLoader(true);
        const rol = userData.rol; const promoType = document.getElementById('upload-promo').value;
        let status = 'approved'; if (rol === 'usuario' && promoType === 'FEED') status = 'pending';
        const costo = parseFloat(dom.inputCostoTotal.value) || 0; const tarifa = parseFloat(document.getElementById('upload-tarifa-total').value) || 0; const fechaViajeStr = dom.inputFechaViaje.value;
        if (tarifa < costo) { showLoader(false); return window.showAlert(`Error: Tarifa menor al costo.`, 'error'); }
        if (!fechaViajeStr) { showLoader(false); return window.showAlert("Falta fecha.", 'error'); }
        const cards = document.querySelectorAll('.servicio-card'); if (cards.length === 0) { showLoader(false); return window.showAlert("Agrega servicios.", 'error'); }
        let serviciosData = []; for (let card of cards) { const serv = { tipo: card.dataset.tipo }; card.querySelectorAll('input, select, textarea').forEach(i => { if (i.type === 'checkbox') serv[i.name] = i.checked; else if (i.type === 'hidden') { if(i.name==='hotel_estrellas') window.setStars(card.dataset.id, i.value); else serv[i.name]=i.parentElement.querySelector('.counter-value')?.innerText || i.value; } else serv[i.name] = i.value; }); serviciosData.push(serv); }
        const idGenerado = isEditingId || 'pkg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        let creadorFinal = (isEditingId && originalCreator) ? originalCreator : (userData.franquicia || 'Desconocido');
        const payload = { id_paquete: idGenerado, destino: document.getElementById('upload-destino').value, salida: document.getElementById('upload-salida').value, fecha_salida: fechaViajeStr, costos_proveedor: costo, tarifa: tarifa, moneda: document.getElementById('upload-moneda').value, tipo_promo: promoType, financiacion: document.getElementById('upload-financiacion').value, servicios: serviciosData, status: status, creador: creadorFinal, editor_email: currentUser.email, action_type: isEditingId ? 'edit' : 'create' };
        try { await secureFetch(API_URL_UPLOAD, payload); await window.showAlert(status === 'pending' ? 'Enviado a revisión.' : 'Guardado correctamente.', 'success'); document.getElementById('upload-form').reset(); dom.containerServicios.innerHTML=''; dom.inputCostoTotal.value=''; dom.inputTarifaTotal.value=''; await fetchAndLoadPackages(); showView('search'); } catch(e) { window.showAlert(e.message || "Error al guardar.", 'error'); }
    });

    if (dom.userForm) { dom.userForm.addEventListener('submit', async (e) => { e.preventDefault(); showLoader(true); const email = document.getElementById('user-email-input').value.trim().toLowerCase(); const rol = document.getElementById('user-role-input').value; const fran = document.getElementById('user-franchise-input').value; try { await db.collection('usuarios').doc(email).set({ email, rol, franquicia: fran, fecha_modificacion: new Date() }, { merge: true }); await window.showAlert('Usuario guardado.', 'success'); document.getElementById('user-email-input').value = ''; document.getElementById('user-franchise-input').value = ''; loadUsersList(); } catch (e) { await window.showAlert('Error.', 'error'); } showLoader(false); }); }
    dom.btnAgregarServicio.addEventListener('click', () => { if (dom.selectorServicio.value) { agregarModuloServicio(dom.selectorServicio.value); dom.selectorServicio.value = ""; } });
    
    function agregarModuloServicio(t,d=null){const c=dom.containerServicios;const x=c.querySelectorAll('.servicio-card');const h=Array.from(x).some(k=>k.dataset.tipo==='bus'||k.dataset.tipo==='crucero');if(!d){if(h&&t!=='adicional')return window.showAlert("Solo Adicionales.","error");if((t==='bus'||t==='crucero')&&x.length>0)return window.showAlert("Exclusivo.","error");}const id=Date.now()+Math.random();const v=document.createElement('div');v.className=`servicio-card ${t}`;v.dataset.id=id;v.dataset.tipo=t;let m=`<button type="button" class="btn-eliminar-servicio" onclick="this.parentElement.remove();window.calcularTotal()">×</button>`;
    if(t==='aereo')m+=`<h4>✈️ Aéreo</h4><div class="form-group-row"><div class="form-group"><label>Aerolínea</label><input type="text" name="aerolinea" required></div><div class="form-group"><label>Ida</label><input type="date" name="fecha_aereo" required></div><div class="form-group"><label>Vuelta</label><input type="date" name="fecha_regreso"></div></div><div class="form-group-row"><div class="form-group"><label>Escalas</label>${crearContadorHTML('escalas',0)}</div><div class="form-group"><label>Equipaje</label><select name="tipo_equipaje"><option>Objeto Personal</option><option>Objeto Personal + Carry On</option><option>Objeto Personal + Bodega</option><option>Objeto Personal + Carry On + Bodega</option></select></div></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
    else if(t==='hotel')m+=`<h4>🏨 Hotel</h4><div class="form-group"><label>Alojamiento</label><input type="text" name="hotel_nombre" required></div><div class="form-group"><label>Estrellas</label><div class="star-rating" data-id="${id}"><span onclick="setStars('${id}', 1)">★</span><span onclick="setStars('${id}', 2)">★</span><span onclick="setStars('${id}', 3)">★</span><span onclick="setStars('${id}', 4)">★</span><span onclick="setStars('${id}', 5)">★</span></div><input type="hidden" name="hotel_estrellas" id="stars-${id}" value="0"></div><div class="form-group"><label>Ubicación (Link)</label><input type="url" name="hotel_link" placeholder="http://google.com/maps..."></div><div class="form-group-row"><div class="form-group"><label>Check In</label><input type="date" name="checkin" onchange="window.calcularNoches('${id}')" required></div><div class="form-group"><label>Check Out</label><input type="date" name="checkout" onchange="window.calcularNoches('${id}')" required></div><div class="form-group"><label>Noches</label><input type="text" name="noches" id="noches-${id}" readonly style="background:#eee;width:60px;"></div></div><div class="form-group"><label>Régimen</label><select name="regimen"><option>Solo Habitación</option><option>Desayuno</option><option>Media Pensión</option><option>All Inclusive</option></select></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
    else if(t==='traslado')m+=`<h4>🚕 Traslado</h4><div class="checkbox-group"><label class="checkbox-label"><input type="checkbox" name="trf_in"> In</label><label class="checkbox-label"><input type="checkbox" name="trf_out"> Out</label><label class="checkbox-label"><input type="checkbox" name="trf_hah"> Hotel - Hotel</label></div><div class="form-group-row"><div class="form-group"><label>Tipo</label><select name="tipo_trf"><option>Compartido</option><option>Privado</option></select></div><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
    else if(t==='seguro')m+=`<h4>🛡️ Seguro</h4><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Cobertura</label><input type="text" name="cobertura" required></div></div><div class="form-group-row"><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
    else if(t==='adicional')m+=`<h4>➕ Adicional</h4><div class="form-group"><label>Detalle</label><input type="text" name="descripcion" required></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
    else if(t==='bus')m+=`<h4>🚌 Bus</h4><div class="form-group-row"><div class="form-group"><label>Noches</label><input type="number" name="bus_noches" required></div><div class="form-group"><div class="checkbox-group"><label class="checkbox-label"><input type="checkbox" name="bus_alojamiento" onchange="document.getElementById('br-${id}').style.display=this.checked?'block':'none'"> Alojamiento</label></div></div></div><div id="br-${id}" style="display:none;margin-bottom:10px;"><label>Régimen</label><select name="bus_regimen"><option>Sin Pensión</option><option>Desayuno</option><option>Media Pensión</option><option>Pensión Completa</option></select></div><div class="checkbox-group"><label class="checkbox-label"><input type="checkbox" name="bus_excursiones"> Excursiones</label><label class="checkbox-label"><input type="checkbox" name="bus_asistencia"> Asistencia</label></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
    else if(t==='crucero')m+=`<h4>🚢 Crucero</h4><div class="form-group-row"><div class="form-group"><label>Naviera</label><input type="text" name="crucero_naviera" required></div><div class="form-group"><label>Noches</label><input type="number" name="crucero_noches" required></div></div><div class="form-group-row"><div class="form-group"><label>Salida</label><input type="text" name="crucero_puerto_salida" required></div><div class="form-group"><label>Recorrido</label><input type="text" name="crucero_recorrido" required></div></div><textarea name="crucero_info"></textarea><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
    v.innerHTML=m;c.appendChild(v);
    const minD = dom.inputFechaViaje.value || new Date().toISOString().split('T')[0];
    v.querySelectorAll('input[type="date"]').forEach(i=>i.min=minD);
    if(d){v.querySelectorAll('input, select, textarea').forEach(i=>{if(d[i.name]!==undefined){if(i.type==='checkbox'){i.checked=d[i.name];i.dispatchEvent(new Event('change'));}else if(i.type==='hidden'){if(i.name==='hotel_estrellas')window.setStars(id, d[i.name]);else{i.parentElement.querySelector('.counter-value').innerText=d[i.name];i.value=d[i.name];}}else{i.value=d[i.name];if(i.name==='checkin'||i.name==='checkout')window.calcularNoches(id);}}});}}

    function openModal(pkg) {
        if (typeof renderServiciosClienteHTML !== 'function') return alert("Error interno.");
        const rawServicios = pkg['servicios'] || pkg['item.servicios']; const htmlCliente = renderServiciosClienteHTML(rawServicios); const htmlCostos = renderCostosProveedoresHTML(rawServicios); const noches = getNoches(pkg); const tarifa = parseFloat(pkg['tarifa']) || 0; const tarifaDoble = Math.round(tarifa / 2); 
        const bubbleStyle = `background-color: #56DDE0; color: #11173d; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 0.8em; display: inline-block; margin-top: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);`; 
        let adminTools = ''; const isOwner = pkg.editor_email === currentUser.email; const canEdit = userData.rol === 'admin' || userData.rol === 'editor' || (userData.rol === 'usuario' && pkg.status === 'pending' && isOwner);
        if (canEdit) { const btnApprove = (userData.rol === 'admin' || userData.rol === 'editor') && pkg.status === 'pending' ? `<button class="btn btn-primario" onclick='approvePackage(${JSON.stringify(pkg)})' style="padding:5px 15px; font-size:0.8em; background:#2ecc71;">✅ Aprobar</button>` : ''; adminTools = `<div class="modal-tools" style="position: absolute; top: 20px; right: 70px; display:flex; gap:10px;">${btnApprove}<button class="btn btn-secundario" onclick='startEditing(${JSON.stringify(pkg)})' style="padding:5px 15px; font-size:0.8em;">✏️ Editar</button><button class="btn btn-secundario" onclick='deletePackage(${JSON.stringify(pkg)})' style="padding:5px 15px; font-size:0.8em; background:#e74c3c; color:white;">🗑️ Borrar</button></div>`; }
        const btnCopiar = `<button class="btn" onclick='copiarPresupuesto(${JSON.stringify(pkg)})' style="background:#34495e; color:white; padding: 5px 15px; font-size:0.8em; display:flex; align-items:center; gap:5px;">📋 Copiar</button>`;
        dom.modalBody.innerHTML = `${adminTools}<div class="modal-detalle-header" style="display:block; padding-bottom: 25px;"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><h2 style="margin:0;font-size:2.2em;line-height:1.1;">${pkg['destino']}</h2></div><div style="margin-top:5px;"><span style="${bubbleStyle}">${pkg['tipo_promo']}</span></div></div><div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; padding: 20px;"><div><h3 style="border-bottom:2px solid #eee; padding-bottom:10px; margin-top:0; color:#11173d;">Itinerario</h3>${htmlCliente}</div><div style="background:#f9fbfd; padding:15px; border-radius:8px; height:fit-content;"><div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;"><h4 style="margin:0; color:#11173d;">Resumen</h4>${btnCopiar}</div><p style="margin:5px 0; font-size:0.9em;"><b>📅 Salida:</b> ${formatDateAR(pkg['fecha_salida'])}</p><p style="margin:5px 0; font-size:0.9em;"><b>📍 Desde:</b> ${pkg['salida']}</p><p style="margin:5px 0; font-size:0.9em;"><b>🌙 Duración:</b> ${noches > 0 ? noches + ' Noches' : '-'}</p><p style="margin:5px 0; font-size:0.9em;"><b>📅 Cargado el:</b> ${pkg['fecha_creacion'] || '-'}</p><div><h4 style="margin:20px 0 10px 0; color:#11173d; border-top:1px solid #eee; padding-top:15px;">Costos (Interno)</h4>${htmlCostos}</div>${pkg['financiacion'] ? `<div style="margin-top:15px; background:#e3f2fd; padding:10px; border-radius:5px; font-size:0.85em;"><b>💳 Financiación:</b> ${pkg['financiacion']}</div>` : ''}</div></div><div style="background:#11173d; color:white; padding:15px 20px; display:flex; justify-content:space-between; align-items:center; border-radius:0 0 12px 12px;"><div style="display:flex; gap:30px;"><div><small style="opacity:0.7;">Costo Total</small><div style="font-size:1.2em; font-weight:bold;">${pkg['moneda']} $${formatMoney(pkg['costos_proveedor'])}</div></div><div><small style="opacity:0.7;">Tarifa Final</small><div style="font-size:1.2em; font-weight:bold; color:#ef5a1a;">${pkg['moneda']} $${formatMoney(tarifa)}</div></div><div><small style="opacity:0.7;">x Persona (Base Doble)</small><div style="font-size:1.2em; font-weight:bold; color:#4caf50;">${pkg['moneda']} $${formatMoney(tarifaDoble)}</div></div></div><div style="text-align:right;"><small style="opacity:0.7;">Cargado por:</small><div style="font-size:0.9em;">${pkg['creador']}</div></div></div>`;
        dom.modal.style.display = 'flex';
    }
});
