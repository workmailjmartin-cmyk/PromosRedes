document.addEventListener('DOMContentLoaded', () => {

    const firebaseConfig = {
        apiKey: "AIzaSyCBiyH6HTatUxNxQ6GOxGp-xFWa7UfCMJk",
         authDomain: "feliz-viaje-43d02.firebaseapp.com",
         projectId: "feliz-viaje-43d02",
         storageBucket: "feliz-viaje-43d02.firebasestorage.app",
         messagingSenderId: "931689659600",
         appId: "1:931689659600:web:66dbce023705936f26b2d5",
         measurementId: "G-2PNDZR3ZS1"
    };

    // TUS URLs DE n8n (Producción)
    const API_URL_SEARCH = 'https://n8n.srv1097024.hstgr.cloud/webhook/83cb99e2-c474-4eca-b950-5d377bcf63fa';
    const API_URL_UPLOAD = 'https://n8n.srv1097024.hstgr.cloud/webhook/6ec970d0-9da4-400f-afcc-611d3e2d82eb';

    const SUPER_ADMIN = 'yairlaquis@gmail.com'; 


   try { firebase.initializeApp(firebaseConfig); } catch(e){ console.error(e); }
    const auth = firebase.auth();
    const db = firebase.firestore();
    const provider = new firebase.auth.GoogleAuthProvider();

    let currentUser = null;
    let currentRole = null;
    let allPackages = [];

    const dom = {
        viewSearch: document.getElementById('view-search'), viewUpload: document.getElementById('view-upload'), viewUsers: document.getElementById('view-users'),
        navSearch: document.getElementById('nav-search'), navUpload: document.getElementById('nav-upload'), navUsers: document.getElementById('nav-users'),
        logo: document.querySelector('.logo'), userLabel: document.getElementById('user-label'), btnLogout: document.getElementById('logout-button'),
        loginContainer: document.getElementById('login-container'), appContainer: document.getElementById('app-container'),
        btnLoginGoogle: document.getElementById('login-google'), loginEmailForm: document.getElementById('login-email-form'), authError: document.getElementById('auth-error'),
        grid: document.getElementById('grilla-paquetes'), loader: document.getElementById('loading-placeholder'),
        btnBuscar: document.getElementById('boton-buscar'), btnLimpiar: document.getElementById('boton-limpiar'), filtroOrden: document.getElementById('filtro-orden'),
        uploadForm: document.getElementById('upload-form'), uploadStatus: document.getElementById('upload-status'), btnSubir: document.getElementById('boton-subir'),
        containerServicios: document.getElementById('servicios-container'), btnAgregarServicio: document.getElementById('btn-agregar-servicio'), selectorServicio: document.getElementById('selector-servicio'),
        inputCostoTotal: document.getElementById('upload-costo-total'), inputFechaViaje: document.getElementById('upload-fecha-salida'),
        modal: document.getElementById('modal-detalle'), modalBody: document.getElementById('modal-body'), modalClose: document.getElementById('modal-cerrar'),
        
        // Admin
        listaUsuarios: document.getElementById('lista-usuarios-body'), btnNuevoUsuario: document.getElementById('btn-nuevo-usuario'),
        modalUsuario: document.getElementById('modal-usuario'), formUsuario: document.getElementById('form-usuario'),
        btnCerrarUserModal: document.getElementById('btn-cerrar-user-modal'), inputAdminEmail: document.getElementById('admin-user-email'),
        inputAdminRole: document.getElementById('admin-user-role')
    };

    if(dom.logo) dom.logo.addEventListener('click', () => window.location.reload());

    // =========================================================
    // 3. AUTENTICACIÓN ESTRICTA
    // =========================================================

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Verificar si existe en la BD
            const role = await verificarAcceso(user.email);
            
            if (role) {
                // ACCESO CONCEDIDO
                currentUser = user;
                currentRole = role;
                
                dom.loginContainer.style.display = 'none';
                dom.appContainer.style.display = 'block';
                dom.userLabel.textContent = `${user.email} (${currentRole})`;

                setupUIByRole();
                await fetchAndLoadPackages();
                showView('search');
            } else {
                // ACCESO DENEGADO (No está en la lista)
                alert("Acceso denegado: Tu usuario no está registrado por el administrador.");
                auth.signOut();
            }
        } else {
            currentUser = null;
            currentRole = null;
            dom.loginContainer.style.display = 'flex';
            dom.appContainer.style.display = 'none';
        }
    });

    async function verificarAcceso(email) {
        if (email === SUPER_ADMIN) return 'admin';
        try {
            const doc = await db.collection('usuarios').doc(email).get();
            if (doc.exists) {
                // Devolvemos el rol que tenga guardado, o 'usuario' por defecto
                return doc.data().role || 'usuario';
            }
        } catch (e) { console.error("Error verificando acceso:", e); }
        return null; // Null significa "No autorizado"
    }

    function setupUIByRole() {
        // Nivel 1 (Usuario): Todos pueden cargar
        dom.navUpload.style.display = 'inline-block';
        
        // Nivel 3 (Admin): Gestión de usuarios
        if (currentRole === 'admin') {
            dom.navUsers.style.display = 'inline-block';
        } else {
            dom.navUsers.style.display = 'none';
        }
    }

    // Login Google
    if(dom.btnLoginGoogle) dom.btnLoginGoogle.onclick = () => auth.signInWithPopup(provider).catch(e => dom.authError.textContent = e.message);
    
    // Login Email (Sin auto-registro)
    if(dom.loginEmailForm) dom.loginEmailForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-pass').value;
        dom.authError.textContent = "Verificando...";
        try {
            await auth.signInWithEmailAndPassword(email, pass);
            // El onAuthStateChanged verificará si está en la lista blanca
        } catch (error) {
            dom.authError.textContent = "Error: Credenciales inválidas o usuario no existe.";
        }
    };
    dom.btnLogout.onclick = () => auth.signOut();

    // =========================================================
    // 4. GESTIÓN DE USUARIOS (SOLO ADMIN)
    // =========================================================

    async function cargarTablaUsuarios() {
        if (currentRole !== 'admin') return;
        dom.listaUsuarios.innerHTML = '<tr><td colspan="3">Cargando...</td></tr>';
        
        try {
            const snapshot = await db.collection('usuarios').get();
            dom.listaUsuarios.innerHTML = '';
            
            if(snapshot.empty) {
                dom.listaUsuarios.innerHTML = '<tr><td colspan="3">No hay usuarios registrados.</td></tr>';
                return;
            }

            snapshot.forEach(doc => {
                const data = doc.data();
                const email = doc.id;
                let badgeClass = 'bg-blue'; // Usuario
                if(data.role === 'admin') badgeClass = 'bg-orange';
                if(data.role === 'editor') badgeClass = 'bg-green';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${email}</td>
                    <td><span class="badge-permiso ${badgeClass}">${(data.role || 'usuario').toUpperCase()}</span></td>
                    <td>
                        <button class="btn btn-secundario btn-sm" onclick="window.editarUsuario('${email}', '${data.role || 'usuario'}')">Editar</button>
                        <button class="btn btn-secundario btn-sm" style="color:red;" onclick="window.borrarUsuario('${email}')">Borrar</button>
                    </td>
                `;
                dom.listaUsuarios.appendChild(tr);
            });
        } catch(e) { console.error(e); }
    }

    dom.formUsuario.onsubmit = async (e) => {
        e.preventDefault();
        const email = dom.inputAdminEmail.value.trim().toLowerCase();
        const role = dom.inputAdminRole.value;
        if(!email) return;
        try {
            // Guardamos el usuario y su rol en la BD
            await db.collection('usuarios').doc(email).set({ role: role });
            alert(`Usuario ${email} autorizado como ${role}.`);
            dom.modalUsuario.style.display = 'none';
            cargarTablaUsuarios();
        } catch (e) { alert("Error: " + e.message); }
    };

    window.editarUsuario = (email, role) => {
        dom.inputAdminEmail.value = email;
        dom.inputAdminEmail.disabled = true;
        dom.inputAdminRole.value = role;
        dom.modalUsuario.style.display = 'flex';
    };
    window.borrarUsuario = async (email) => {
        if(!confirm(`¿Eliminar acceso a ${email}?`)) return;
        try { await db.collection('usuarios').doc(email).delete(); cargarTablaUsuarios(); } catch(e){ alert(e.message); }
    };

    dom.btnNuevoUsuario.onclick = () => { dom.formUsuario.reset(); dom.inputAdminEmail.disabled=false; dom.modalUsuario.style.display='flex'; };
    if(dom.btnCerrarUserModal) dom.btnCerrarUserModal.onclick = () => dom.modalUsuario.style.display='none';

    // =========================================================
    // 5. NAVEGACIÓN Y UTILIDADES
    // =========================================================

    function showView(name) {
        dom.viewSearch.style.display='none'; dom.navSearch.classList.remove('active');
        dom.viewUpload.style.display='none'; dom.navUpload.classList.remove('active');
        dom.viewUsers.style.display='none'; dom.navUsers.classList.remove('active');

        if(name==='search'){ dom.viewSearch.style.display='block'; dom.navSearch.classList.add('active'); }
        else if(name==='upload'){ dom.viewUpload.style.display='block'; dom.navUpload.classList.add('active'); }
        else if(name==='users'){ dom.viewUsers.style.display='block'; dom.navUsers.classList.add('active'); cargarTablaUsuarios(); }
    }
    
    dom.navSearch.onclick = () => showView('search');
    dom.navUpload.onclick = () => showView('upload');
    dom.navUsers.onclick = () => showView('users');

    async function secureFetch(url, body) {
        if (!currentUser) throw new Error('No auth');
        const token = await currentUser.getIdToken(true);
        const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body:JSON.stringify(body), cache:'no-store' });
        if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
        const txt = await res.text(); return txt ? JSON.parse(txt) : [];
    }
    const formatMoney = (a) => new Intl.NumberFormat('es-AR', { style: 'decimal', minimumFractionDigits: 0 }).format(a);
    const formatDateAR = (s) => { if(!s) return '-'; const p = s.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s; };

    // =========================================================
    // 6. CARGA DE PAQUETES
    // =========================================================

    dom.btnAgregarServicio.onclick = () => { if (dom.selectorServicio.value) { agregarModuloServicio(dom.selectorServicio.value); dom.selectorServicio.value = ""; } };

    function agregarModuloServicio(tipo) {
        const id = Date.now(); const div = document.createElement('div'); div.className = `servicio-card ${tipo}`; div.dataset.id = id; div.dataset.tipo = tipo;
        const fechaBase = dom.inputFechaViaje.value || '';
        let html = `<button type="button" class="btn-eliminar-servicio" onclick="this.parentElement.remove(); window.calcularTotal();">×</button>`;
        
        if (tipo === 'aereo') { html += `<h4>✈️ Aéreo</h4><div class="form-group-row"><div class="form-group"><label>Aerolínea</label><input type="text" name="aerolinea" required></div><div class="form-group"><label>Ida</label><input type="date" name="fecha_aereo" value="${fechaBase}" required></div><div class="form-group"><label>Vuelta</label><input type="date" name="fecha_regreso"></div></div><div class="form-group-row"><div class="form-group"><label>Escalas</label>${crearContadorHTML('escalas', 0)}</div><div class="form-group"><label>Equipaje</label><select name="tipo_equipaje"><option>Objeto Personal</option><option>Carry On</option><option>Carry On + Bodega</option><option>Bodega (15kg)</option><option>Bodega (23kg)</option></select></div></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`; }
        else if (tipo === 'hotel') { html += `<h4>🏨 Hotel</h4><div class="form-group"><label>Alojamiento</label><input type="text" name="hotel_nombre" required></div><div class="form-group-row"><div class="form-group"><label>Check In</label><input type="date" name="checkin" value="${fechaBase}" onchange="window.calcularNoches(${id})" required></div><div class="form-group"><label>Check Out</label><input type="date" name="checkout" onchange="window.calcularNoches(${id})" required></div><div class="form-group"><label>Noches</label><input type="text" id="noches-${id}" readonly style="background:#eee; width:60px;"></div></div><div class="form-group"><label>Régimen</label><select name="regimen"><option>Solo Habitación</option><option>Desayuno</option><option>Media Pensión</option><option>All Inclusive</option></select></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`; }
        else if (tipo === 'traslado') { html += `<h4>🚌 Traslado</h4><div class="checkbox-group"><label class="checkbox-label"><input type="checkbox" name="trf_in"> In</label><label class="checkbox-label"><input type="checkbox" name="trf_out"> Out</label><label class="checkbox-label"><input type="checkbox" name="trf_hotel"> Hotel-Hotel</label></div><div class="form-group-row"><div class="form-group"><label>Tipo</label><select name="tipo_trf"><option>Compartido</option><option>Privado</option></select></div><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`; }
        else if (tipo === 'seguro') { html += `<h4>🛡️ Seguro</h4><div class="form-group-row"><div class="form-group"><label>Cobertura</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`; }
        else if (tipo === 'adicional') { html += `<h4>➕ Adicional</h4><div class="form-group"><label>Detalle</label><input type="text" name="descripcion" required></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`; }
        div.innerHTML = html; dom.containerServicios.appendChild(div);
    }
    
    window.crearContadorHTML = (n, v) => `<div class="counter-wrapper"><button type="button" class="counter-btn" onclick="this.nextElementSibling.innerText=Math.max(0,parseInt(this.nextElementSibling.innerText)-1)">-</button><span class="counter-value">${v}</span><button type="button" class="counter-btn" onclick="this.previousElementSibling.innerText=parseInt(this.previousElementSibling.innerText)+1">+</button><input type="hidden" name="${n}" value="${v}"></div>`;
    window.calcularNoches = (id) => { const c=document.querySelector(`.servicio-card[data-id="${id}"]`), i=new Date(c.querySelector('input[name="checkin"]').value), o=new Date(c.querySelector('input[name="checkout"]').value); document.getElementById(`noches-${id}`).value=(i&&o&&o>i)?Math.ceil((o-i)/86400000):'-'; };
    window.calcularTotal = () => { let t=0; document.querySelectorAll('.input-costo').forEach(i=>t+=parseFloat(i.value)||0); dom.inputCostoTotal.value=t; };

    dom.uploadForm.onsubmit = async (e) => {
        e.preventDefault();
        const costo=parseFloat(dom.inputCostoTotal.value)||0, tarifa=parseFloat(document.getElementById('upload-tarifa-total').value)||0, fechaViajeStr=dom.inputFechaViaje.value;
        if(tarifa<costo) return alert(`⛔ ERROR: Tarifa ($${tarifa}) menor al Costo ($${costo}).`);
        if(!fechaViajeStr) return alert("Falta fecha de salida.");
        const fechaViaje=new Date(fechaViajeStr+'T00:00:00'), cards=document.querySelectorAll('.servicio-card');
        if(cards.length===0) return alert("Agrega servicios.");
        let fechaRegresoVuelo=null, errorMsg=null, serviciosData=[];
        cards.forEach(c=>{ if(c.dataset.tipo==='aereo'){ const r=c.querySelector('input[name="fecha_regreso"]'); if(r&&r.value){ const f=new Date(r.value+'T00:00:00'); if(!fechaRegresoVuelo||f>fechaRegresoVuelo) fechaRegresoVuelo=f; } } });
        for(let card of cards){
            const tipo=card.dataset.tipo, inputs=card.querySelectorAll('input[type="date"]');
            for(let i of inputs){ if(i.value && new Date(i.value+'T00:00:00')<fechaViaje){ errorMsg=`⛔ FECHA INVÁLIDA: Servicio ${tipo} anterior a salida.`; break; } }
            if(errorMsg) break;
            if(tipo==='hotel'){ const i=card.querySelector('input[name="checkin"]').value, o=card.querySelector('input[name="checkout"]').value; if(i&&o&&new Date(o)<=new Date(i)){ errorMsg="⛔ HOTEL: Check-out debe ser posterior al Check-in."; break; } }
            if(fechaRegresoVuelo){
                let fin=null; if(tipo==='hotel'){ const o=card.querySelector('input[name="checkout"]').value; if(o) fin=new Date(o+'T00:00:00'); }
                if(fin){ const lim=new Date(fechaRegresoVuelo); if(tipo==='hotel'||tipo==='seguro') lim.setDate(lim.getDate()+1); if(fin>lim){ errorMsg=`⛔ FECHA LÍMITE: ${tipo} termina después del vuelo.`; break; } }
            }
            const serv={tipo}; card.querySelectorAll('input, select').forEach(i=>{ if(i.type==='checkbox') serv[i.name]=i.checked; else if(i.type==='hidden') serv[i.name]=i.parentElement.querySelector('.counter-value')?.innerText||i.value; else serv[i.name]=i.value; }); serviciosData.push(serv);
        }
        if(errorMsg) return alert(errorMsg);
        dom.btnSubir.disabled=true; dom.uploadStatus.textContent='Guardando...';
        try { await secureFetch(API_URL_UPLOAD, { destino:document.getElementById('upload-destino').value, salida:document.getElementById('upload-salida').value, fecha_salida:fechaViajeStr, costos_proveedor:costo, tarifa_venta:tarifa, moneda:document.getElementById('upload-moneda').value, tipo_promo:document.getElementById('upload-promo').value, financiacion:document.getElementById('upload-financiacion').value, servicios:serviciosData }); alert('¡Guardado!'); window.location.reload(); }
        catch(e) { console.error(e); dom.uploadStatus.textContent='Error al guardar'; dom.btnSubir.disabled=false; }
    };

    function applyFilters() {
        const fD=document.getElementById('filtro-destino').value.toLowerCase(), fC=document.getElementById('filtro-creador').value, fP=document.getElementById('filtro-promo').value, fO=document.getElementById('filtro-orden')?document.getElementById('filtro-orden').value:'reciente';
        let res = allPackages.filter(p => (!fD||(p.destino&&p.destino.toLowerCase().includes(fD))) && (!fC||(p.creador&&p.creador===fC)) && (!fP||(p.tipo_promo&&p.tipo_promo===fP)));
        if(fO==='menor_precio') res.sort((a,b)=>parseFloat(a.tarifa)-parseFloat(b.tarifa));
        else if(fO==='mayor_precio') res.sort((a,b)=>parseFloat(b.tarifa)-parseFloat(a.tarifa));
        else res.sort((a,b)=>(b['fecha_creacion']||'').split('/').reverse().join('').localeCompare((a['fecha_creacion']||'').split('/').reverse().join('')));
        renderCards(res);
    }
    
    function getNoches(pkg) {
        if(!pkg['fecha_salida']) return 0;
        const start = new Date(pkg['fecha_salida'].split('/').reverse().join('-') + 'T00:00:00');
        let maxDate = new Date(start), hasData = false, servicios = [];
        try { const raw=pkg['servicios']||pkg['item.servicios']; servicios=typeof raw==='string'?JSON.parse(raw):raw; } catch(e){}
        if(!Array.isArray(servicios)) return 0;
        servicios.forEach(s => {
            if(s.tipo==='hotel'&&s.checkout){ const d=new Date(s.checkout+'T00:00:00'); if(d>maxDate){maxDate=d; hasData=true;} }
            if(s.tipo==='aereo'&&s.fecha_regreso){ const d=new Date(s.fecha_regreso+'T00:00:00'); if(d>maxDate){maxDate=d; hasData=true;} }
        });
        return hasData ? Math.ceil((maxDate - start) / 86400000) : 0;
    }

    function renderCards(list) {
        dom.loader.style.display='none'; dom.grid.innerHTML=''; 
        if(!list||list.length===0){ dom.grid.innerHTML='<p>No hay resultados.</p>'; return; }
        list.forEach(pkg => {
            const card = document.createElement('div');
            const noches = getNoches(pkg);
            card.className = 'paquete-card';
            card.dataset.packageData = JSON.stringify(pkg);
            
            // Botón Borrar (Solo para Editor o Admin)
            let deleteBtnHTML = '';
            if (currentRole === 'editor' || currentRole === 'admin') {
                deleteBtnHTML = `<button class="btn-card-action delete" title="Borrar" onclick="event.stopPropagation(); window.borrarPaquete('${pkg.id || 'N/A'}')">🗑️</button>`;
            }

            card.innerHTML = `
                <div class="card-header" style="position:relative;">
                    ${deleteBtnHTML}
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%; padding-right:30px;">
                        <div style="max-width:70%;">
                            <h3 style="margin:0;font-size:1.1em;">${pkg['destino']}</h3>
                            <span class="tag-promo" style="margin-top:5px;display:inline-block;font-size:0.75em;">${pkg['tipo_promo']}</span>
                        </div>
                        ${noches>0?`<div style="background:#eef2f5;color:#11173d;padding:4px 8px;border-radius:6px;font-weight:bold;font-size:0.85em;white-space:nowrap;">🌙 ${noches} Noches</div>`:''}
                    </div>
                </div>
                <div class="card-body">
                    <p style="color:#666;font-size:0.9em;margin-top:10px;"><strong>Salida:</strong> ${formatDateAR(pkg['fecha_salida'])}</p>
                </div>
                <div class="card-footer">
                    <p class="precio-valor">${pkg['moneda']} $${formatMoney(Math.round((parseFloat(pkg['tarifa'])||0)/2))}</p>
                </div>`;
            dom.grid.appendChild(card);
        });
    }

    window.borrarPaquete = (id) => {
        if(!confirm("¿Borrar este paquete? (Requiere webhook)")) return;
        alert("Paquete marcado para borrar (Conecta tu webhook de Delete aquí).");
    };

    function renderServiciosClienteHTML(rawJson) {
        let servicios=[]; try{ servicios=typeof rawJson==='string'?JSON.parse(rawJson):rawJson; }catch(e){ return '<p>Sin detalles.</p>'; }
        if(!Array.isArray(servicios)||servicios.length===0) return '<p>Sin detalles.</p>';
        let html='';
        servicios.forEach(s => {
            let icono='🔹', titulo='', lineas=[];
            if(s.tipo==='aereo'){ icono='✈️'; titulo='AÉREO'; lineas.push(`<b>Aerolínea:</b> ${s.aerolinea}`); lineas.push(`<b>Fechas:</b> ${formatDateAR(s.fecha_aereo)}${s.fecha_regreso?` | <b>Vuelta:</b> ${formatDateAR(s.fecha_regreso)}`:''}`); lineas.push(`<b>Escalas:</b> ${s.escalas==0?'Directo':s.escalas}`); lineas.push(`<b>Equipaje:</b> ${s.tipo_equipaje.replace(/_/g,' ')} (x${s.cantidad_equipaje||1})`); }
            else if(s.tipo==='hotel'){ icono='🏨'; titulo='HOTEL'; lineas.push(`<b>${s.hotel_nombre}</b> (${s.regimen})`); lineas.push(`<b>Estadía:</b> ${(s.checkin&&s.checkout)?Math.ceil((new Date(s.checkout)-new Date(s.checkin))/86400000):'-'} noches (${formatDateAR(s.checkin)} al ${formatDateAR(s.checkout)})`); }
            else if(s.tipo==='traslado'){ icono='🚌'; titulo='TRASLADO'; let t=[]; if(s.trf_in)t.push("In"); if(s.trf_out)t.push("Out"); if(s.trf_hotel)t.push("Hotel-Hotel"); lineas.push(`<b>Tipo:</b> ${s.tipo_trf} (${t.join('+')})`); }
            else if(s.tipo==='seguro'){ icono='🛡️'; titulo='SEGURO'; lineas.push(`<b>Cob:</b> ${s.proveedor}`); }
            else if(s.tipo==='adicional'){ icono='➕'; titulo='ADICIONAL'; lineas.push(`<b>${s.descripcion}</b>`); }
            if(s.obs) lineas.push(`<i>Obs: ${s.obs}</i>`);
            html+=`<div style="margin-bottom:10px;border-left:3px solid #ddd;padding-left:10px;"><div style="color:#11173d;font-weight:bold;">${icono} ${titulo}</div><div style="font-size:0.9em;color:#555;">${lineas.map(l=>`<div>${l}</div>`).join('')}</div></div>`;
        });
        return html;
    }

    function renderCostosProveedoresHTML(rawJson) {
        let servicios=[]; try{ servicios=typeof rawJson==='string'?JSON.parse(rawJson):rawJson; }catch(e){ return '<p>-</p>'; }
        if(!Array.isArray(servicios)||servicios.length===0) return '<p>-</p>';
        let html='<ul style="list-style:none; padding:0; margin:0;">';
        servicios.forEach(s => {
            const tipo = s.tipo ? s.tipo.toUpperCase() : 'SERVICIO';
            html += `<li style="margin-bottom:5px; font-size:0.9em; border-bottom:1px dashed #eee; padding-bottom:5px;"><b>${tipo}:</b> ${s.proveedor || '-'} <span style="float:right;">$${formatMoney(s.costo || 0)}</span></li>`;
        });
        html += '</ul>';
        return html;
    }

    function openModal(pkg) {
        const rawServicios = pkg['servicios'] || pkg['item.servicios'];
        const htmlCliente = renderServiciosClienteHTML(rawServicios);
        const htmlCostos = renderCostosProveedoresHTML(rawServicios);
        const noches = getNoches(pkg);
        const tarifaDoble = Math.round((parseFloat(pkg['tarifa']) || 0) / 2);
        dom.modalBody.innerHTML = `
            <div class="modal-detalle-header"><h2>${pkg['destino']}</h2><span class="tag-promo">${pkg['tipo_promo']}</span></div>
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; padding: 20px;">
                <div><h3 style="border-bottom:2px solid #eee; padding-bottom:10px; margin-top:0; color:#11173d;">Itinerario</h3>${htmlCliente}</div>
                <div style="background:#f9fbfd; padding:15px; border-radius:8px; height:fit-content;">
                    <div style="margin-bottom:20px;">
                        <h4 style="margin:0 0 10px 0; color:#11173d;">Resumen</h4>
                        <p style="margin:5px 0; font-size:0.9em;"><b>📅 Salida:</b> ${formatDateAR(pkg['fecha_salida'])}</p>
                        <p style="margin:5px 0; font-size:0.9em;"><b>📍 Desde:</b> ${pkg['salida']}</p>
                        <p style="margin:5px 0; font-size:0.9em;"><b>🌙 Duración:</b> ${noches > 0 ? noches + ' Noches' : '-'}</p>
                        <p style="margin:5px 0; font-size:0.9em;"><b>📅 Cargado el:</b> ${pkg['fecha_creacion'] || '-'}</p>
                    </div>
                    <div><h4 style="margin:0 0 10px 0; color:#11173d; border-top:1px solid #eee; padding-top:15px;">Costos (Interno)</h4>${htmlCostos}</div>
                     ${pkg['financiacion'] ? `<div style="margin-top:15px; background:#e3f2fd; padding:10px; border-radius:5px; font-size:0.85em;"><b>💳 Financiación:</b> ${pkg['financiacion']}</div>` : ''}
                </div>
            </div>
            <div style="background:#11173d; color:white; padding:15px 20px; display:flex; justify-content:space-between; align-items:center; border-radius:0 0 12px 12px;">
                <div style="display:flex; gap:30px;">
                    <div><small style="opacity:0.7;">Costo Total</small><div style="font-size:1.2em; font-weight:bold;">${pkg['moneda']} $${formatMoney(pkg['costos_proveedor'])}</div></div>
                    <div><small style="opacity:0.7;">Tarifa Final</small><div style="font-size:1.2em; font-weight:bold; color:#ef5a1a;">${pkg['moneda']} $${formatMoney(pkg['tarifa'])}</div></div>
                    <div><small style="opacity:0.7;">Base Doble (x Pax)</small><div style="font-size:1.2em; font-weight:bold; color:#4caf50;">${pkg['moneda']} $${formatMoney(tarifaDoble)}</div></div>
                </div>
                <div style="text-align:right;"><small style="opacity:0.7;">Cargado por:</small><div style="font-size:0.9em;">${pkg['creador']}</div></div>
            </div>`;
        dom.modal.style.display = 'flex';
    }
    
    function fetchAndLoadPackages() { fetchPackages(); }
    async function fetchPackages(f={}) { try{ const d=await secureFetch(API_URL_SEARCH, f); allPackages=d; applyFilters(); }catch(e){console.error(e);} }
    dom.btnBuscar.onclick = applyFilters;
    dom.btnLimpiar.onclick = () => { document.getElementById('filtro-destino').value=''; document.getElementById('filtro-creador').value=''; document.getElementById('filtro-promo').value=''; if(dom.filtroOrden)dom.filtroOrden.value='reciente'; applyFilters(); };
    if(dom.filtroOrden) dom.filtroOrden.onchange = applyFilters;
    dom.grid.onclick = e => { 
        if(e.target.closest('.delete')) return; 
        const c=e.target.closest('.paquete-card'); 
        if(c) openModal(JSON.parse(c.dataset.packageData)); 
    };
    dom.modalClose.onclick=()=>dom.modal.style.display='none'; window.onclick=e=>{if(e.target===dom.modal)dom.modal.style.display='none';};
});







