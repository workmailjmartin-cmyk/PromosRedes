document.addEventListener('DOMContentLoaded', () => {

    // --- 1. CONFIGURACIÓN ---
    const firebaseConfig = {
        apiKey: "AIzaSyCBiyH6HTatUxNxQ6GOxGp-xFWa7UfCMJk",
        authDomain: "feliz-viaje-43d02.firebaseapp.com",
        projectId: "feliz-viaje-43d02",
        storageBucket: "feliz-viaje-43d02.firebasestorage.app",
        messagingSenderId: "931689659600",
        appId: "1:931689659600:web:66dbce023705936f26b2d5",
        measurementId: "G-2PNDZR3ZS1"
    };

    // URLs DE n8n
    const API_URL_SEARCH = 'https://n8n.srv1097024.hstgr.cloud/webhook/83cb99e2-c474-4eca-b950-5d377bcf63fa';
    const API_URL_UPLOAD = 'https://n8n.srv1097024.hstgr.cloud/webhook/6ec970d0-9da4-400f-afcc-611d3e2d82eb';

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore(); 
    const provider = new firebase.auth.GoogleAuthProvider();

    // ESTADO GLOBAL
    let currentUser = null;
    let userData = null; 
    let allPackages = [];
    let isEditingId = null; 

    // DOM
    const dom = {
        views: {
            search: document.getElementById('view-search'),
            upload: document.getElementById('view-upload'),
            gestion: document.getElementById('view-gestion'),
            users: document.getElementById('view-users')
        },
        nav: {
            search: document.getElementById('nav-search'),
            upload: document.getElementById('nav-upload'),
            gestion: document.getElementById('nav-gestion'),
            users: document.getElementById('nav-users')
        },
        grid: document.getElementById('grilla-paquetes'),
        gridGestion: document.getElementById('grid-gestion'),
        loader: document.getElementById('loading-placeholder'),
        
        // Forms
        uploadForm: document.getElementById('upload-form'),
        uploadStatus: document.getElementById('upload-status'),
        userForm: document.getElementById('user-form'),
        usersList: document.getElementById('users-list'),
        
        // Inputs Upload
        inputCostoTotal: document.getElementById('upload-costo-total'),
        inputFechaViaje: document.getElementById('upload-fecha-salida'),
        inputDestino: document.getElementById('upload-destino'),
        
        // Auth & Modal
        loginContainer: document.getElementById('login-container'),
        appContainer: document.getElementById('app-container'),
        btnLogin: document.getElementById('login-button'),
        btnLogout: document.getElementById('logout-button'),
        userEmail: document.getElementById('user-email'),
        modal: document.getElementById('modal-detalle'),
        modalBody: document.getElementById('modal-body'),
        modalClose: document.getElementById('modal-cerrar'),
        
        // Servicios
        containerServicios: document.getElementById('servicios-container'),
        btnAgregarServicio: document.getElementById('btn-agregar-servicio'),
        selectorServicio: document.getElementById('selector-servicio'),
        
        // Filtros
        btnBuscar: document.getElementById('boton-buscar'),
        btnLimpiar: document.getElementById('boton-limpiar'),
        filtroOrden: document.getElementById('filtro-orden'),
        filtroCreador: document.getElementById('filtro-creador'),
        
        logo: document.querySelector('.logo')
    };

    if(dom.logo) { dom.logo.style.cursor = 'pointer'; dom.logo.addEventListener('click', () => window.location.reload()); }

    // --- 2. AUTENTICACIÓN Y ROLES ---
    auth.onAuthStateChanged(async (u) => {
        if (u) {
            try {
                // Buscamos permiso en Firestore (Usamos TRIM para evitar errores de espacios)
                const emailLimpio = u.email.trim().toLowerCase();
                const doc = await db.collection('usuarios').doc(emailLimpio).get();
                
                if (doc.exists) {
                    currentUser = u;
                    userData = doc.data(); 
                    
                    dom.loginContainer.style.display='none';
                    dom.appContainer.style.display='block';
                    dom.userEmail.textContent = `${userData.franquicia} (${u.email})`;
                    
                    configureUIByRole();
                    await fetchAndLoadPackages();
                    showView('search');
                } else {
                    alert(`⛔ El usuario ${u.email} no tiene permisos. Pide a un Administrador que te registre en la sección Usuarios.`);
                    auth.signOut();
                }
            } catch (e) {
                console.error(e);
                alert("Error de conexión con la base de datos.");
            }
        } else {
            currentUser = null;
            userData = null;
            dom.loginContainer.style.display='flex';
            dom.appContainer.style.display='none';
        }
    });

    dom.btnLogin.addEventListener('click', () => auth.signInWithPopup(provider));
    dom.btnLogout.addEventListener('click', () => auth.signOut());

    function configureUIByRole() {
        const rol = userData.rol;
        // Reset menus
        dom.nav.gestion.style.display = 'none';
        dom.nav.users.style.display = 'none';

        if (rol === 'editor' || rol === 'admin') {
            dom.nav.gestion.style.display = 'inline-block';
        }
        if (rol === 'admin') {
            dom.nav.users.style.display = 'inline-block';
            loadUsersList(); 
        }

        // Restricciones en Formulario de Carga
        const selectPromo = document.getElementById('upload-promo');
        if(selectPromo) {
            selectPromo.innerHTML = '';
            if (rol === 'usuario') {
                selectPromo.innerHTML = '<option value="Solo X Hoy">Solo X Hoy</option><option value="FEED">FEED (Requiere Aprobación)</option>';
            } else {
                selectPromo.innerHTML = '<option value="FEED">FEED</option><option value="Solo X Hoy">Solo X Hoy</option><option value="ADS">ADS</option>';
            }
        }
    }

    // --- 3. GESTIÓN DE USUARIOS (SOLO ADMIN) ---
    if (dom.userForm) {
        dom.userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('user-email-input').value.trim().toLowerCase();
            const rol = document.getElementById('user-role-input').value;
            const fran = document.getElementById('user-franchise-input').value;

            try {
                // Guardar o Actualizar (set con merge true sobrescribe)
                await db.collection('usuarios').doc(email).set({
                    email: email,
                    rol: rol,
                    franquicia: fran,
                    fecha_modificacion: new Date()
                }, { merge: true });
                
                window.showAlert('Usuario guardado/modificado correctamente.', 'success');
                // Limpiar form
                document.getElementById('user-email-input').value = '';
                document.getElementById('user-franchise-input').value = '';
                loadUsersList();
            } catch (e) {
                console.error(e);
                window.showAlert('Error al guardar usuario.', 'error');
            }
        });
    }

    async function loadUsersList() {
        const list = dom.usersList;
        list.innerHTML = 'Cargando...';
        try {
            const snap = await db.collection('usuarios').get();
            list.innerHTML = '';
            snap.forEach(doc => {
                const u = doc.data();
                const li = document.createElement('li');
                li.style.cssText = "padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;";
                
                // Botones de Editar y Eliminar
                li.innerHTML = `
                    <span><b>${u.email}</b><br><small>${u.rol.toUpperCase()} - ${u.franquicia}</small></span>
                    <div style="display:flex; gap:5px;">
                        <button class="btn btn-secundario" style="padding:4px 10px; font-size:0.8em; background:#3498db; color:white;" onclick="editUser('${u.email}', '${u.rol}', '${u.franquicia}')">Editar</button>
                        <button class="btn btn-secundario" style="padding:4px 10px; font-size:0.8em; background:#e74c3c; color:white;" onclick="if(confirm('¿Eliminar usuario?')) deleteUser('${u.email}')">Eliminar</button>
                    </div>
                `;
                list.appendChild(li);
            });
        } catch (e) {
            list.innerHTML = 'Error al cargar lista.';
        }
    }

    // Funciones globales para acceder desde el HTML inyectado
    window.editUser = (email, rol, fran) => {
        document.getElementById('user-email-input').value = email;
        document.getElementById('user-role-input').value = rol;
        document.getElementById('user-franchise-input').value = fran;
        window.scrollTo(0,0);
        window.showAlert(`Editando usuario: ${email}. Modifica y dale a Guardar.`, 'info');
    };

    window.deleteUser = async (email) => {
        try { await db.collection('usuarios').doc(email).delete(); loadUsersList(); } catch(e){ alert('Error'); }
    };

    // --- 4. CORE DEL SISTEMA ---
    async function secureFetch(url, body) {
        if (!currentUser) throw new Error('No auth');
        const token = await currentUser.getIdToken(true);
        const res = await fetch(url, { 
            method:'POST', 
            headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`}, 
            body:JSON.stringify(body), 
            cache:'no-store' 
        });
        if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
        const txt = await res.text(); 
        return txt ? JSON.parse(txt) : [];
    }

    window.showAlert = (message, type = 'error') => {
        return new Promise((resolve) => {
            const overlay = document.getElementById('custom-alert-overlay');
            if(!overlay) { alert(message); return resolve(); }
            const title = document.getElementById('custom-alert-title');
            const msg = document.getElementById('custom-alert-message');
            const icon = document.getElementById('custom-alert-icon');
            const btn = document.getElementById('custom-alert-btn');
            if (type === 'success') { title.innerText = '¡Éxito!'; title.style.color = '#4caf50'; icon.innerHTML = '✅'; }
            else if (type === 'info') { title.innerText = 'Información'; title.style.color = '#3498db'; icon.innerHTML = 'ℹ️'; }
            else { title.innerText = 'Atención'; title.style.color = '#ef5a1a'; icon.innerHTML = '⚠️'; }
            msg.innerText = message; overlay.style.display = 'flex';
            btn.onclick = () => { overlay.style.display = 'none'; resolve(); };
        });
    };

    // --- FORMULARIO DE CARGA ---
    dom.btnAgregarServicio.addEventListener('click', () => { if (dom.selectorServicio.value) { agregarModuloServicio(dom.selectorServicio.value); dom.selectorServicio.value = ""; } });

    function agregarModuloServicio(tipo, data = null) {
        const container = dom.containerServicios;
        const existingServices = container.querySelectorAll('.servicio-card');
        const hasExclusive = Array.from(existingServices).some(c => c.dataset.tipo === 'bus' || c.dataset.tipo === 'crucero');
        if (!data && hasExclusive) return window.showAlert("⛔ No puedes agregar más servicios a un paquete de Bus o Crucero.", "error");
        if (!data && (tipo === 'bus' || tipo === 'crucero') && existingServices.length > 0) return window.showAlert("⛔ Los paquetes de Bus o Crucero deben ser servicios únicos.", "error");

        const id = Date.now() + Math.random(); 
        const div = document.createElement('div');
        div.className = `servicio-card ${tipo}`; div.dataset.id = id; div.dataset.tipo = tipo;
        
        let html = `<button type="button" class="btn-eliminar-servicio" onclick="this.parentElement.remove(); window.calcularTotal();">×</button>`;
        
        // BUILDERS
        if (tipo === 'aereo') { html += `<h4>✈️ Aéreo</h4><div class="form-group-row"><div class="form-group"><label>Aerolínea</label><input type="text" name="aerolinea" required></div><div class="form-group"><label>Ida</label><input type="date" name="fecha_aereo" required></div><div class="form-group"><label>Vuelta</label><input type="date" name="fecha_regreso"></div></div><div class="form-group-row"><div class="form-group"><label>Escalas</label>${crearContadorHTML('escalas', 0)}</div><div class="form-group"><label>Equipaje</label><select name="tipo_equipaje"><option>Objeto Personal</option><option>Carry On</option><option>Carry On + Bodega</option><option>Bodega (15kg)</option><option>Bodega (23kg)</option></select></div></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`; }
        else if (tipo === 'hotel') { html += `<h4>🏨 Hotel</h4><div class="form-group"><label>Alojamiento</label><input type="text" name="hotel_nombre" required></div><div class="form-group-row"><div class="form-group"><label>Check In</label><input type="date" name="checkin" onchange="window.calcularNoches(${id})" required></div><div class="form-group"><label>Check Out</label><input type="date" name="checkout" onchange="window.calcularNoches(${id})" required></div><div class="form-group"><label>Noches</label><input type="text" id="noches-${id}" readonly style="background:#eee; width:60px;"></div></div><div class="form-group"><label>Régimen</label><select name="regimen"><option>Solo Habitación</option><option>Desayuno</option><option>Media Pensión</option><option>All Inclusive</option></select></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`; }
        else if (tipo === 'traslado') { html += `<h4>🚕 Traslado</h4><div class="checkbox-group"><label class="checkbox-label"><input type="checkbox" name="trf_in"> In</label><label class="checkbox-label"><input type="checkbox" name="trf_out"> Out</label><label class="checkbox-label"><input type="checkbox" name="trf_hah"> Htl-Htl</label></div><div class="form-group-row"><div class="form-group"><label>Tipo</label><select name="tipo_trf"><option>Compartido</option><option>Privado</option></select></div><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`; }
        else if (tipo === 'seguro') { html += `<h4>🛡️ Seguro</h4><div class="form-group-row"><div class="form-group"><label>Cobertura</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`; }
        else if (tipo === 'adicional') { html += `<h4>➕ Adicional</h4><div class="form-group"><label>Detalle</label><input type="text" name="descripcion" required></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`; }
        else if (tipo === 'bus') { html += `<h4>🚌 Paquete Bus</h4><div class="form-group-row"><div class="form-group"><label>Cant. Noches</label><input type="number" name="bus_noches" required></div><div class="form-group" style="display:flex;align-items:flex-end;padding-bottom:10px;"><div class="checkbox-group"><label class="checkbox-label"><input type="checkbox" name="bus_alojamiento" onchange="document.getElementById('bus-regimen-${id}').style.display = this.checked ? 'block' : 'none'"> Incluye Alojamiento</label></div></div></div><div id="bus-regimen-${id}" class="form-group" style="display:none;margin-top:-10px;margin-bottom:15px;background:#f9f9f9;padding:10px;border-radius:8px;"><label>Régimen</label><select name="bus_regimen"><option value="Sin Pensión">Sin Pensión</option><option value="Desayuno">Desayuno</option><option value="Media Pensión">Media Pensión</option><option value="Pensión Completa">Pensión Completa</option></select></div><div class="checkbox-group" style="margin-bottom:15px;"><label class="checkbox-label"><input type="checkbox" name="bus_excursiones"> Incluye Excursiones</label><label class="checkbox-label"><input type="checkbox" name="bus_asistencia"> Asistencia al Viajero</label></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`; }
        else if (tipo === 'crucero') { html += `<h4>🚢 Crucero</h4><div class="form-group-row"><div class="form-group"><label>Naviera</label><input type="text" name="crucero_naviera" required></div><div class="form-group"><label>Noches</label><input type="number" name="crucero_noches" required></div></div><div class="form-group-row"><div class="form-group"><label>Puerto Salida</label><input type="text" name="crucero_puerto_salida" required></div><div class="form-group"><label>Puertos que Recorre</label><input type="text" name="crucero_recorrido" required></div></div><div class="form-group"><label>Información Adicional</label><textarea name="crucero_info" rows="2"></textarea></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`; }

        div.innerHTML = html;
        dom.containerServicios.appendChild(div);

        if (data) {
            div.querySelectorAll('input, select, textarea').forEach(input => {
                if (data[input.name] !== undefined) {
                    if (input.type === 'checkbox') {
                        input.checked = data[input.name];
                        if (input.name === 'bus_alojamiento') input.dispatchEvent(new Event('change'));
                    } else if (input.type === 'hidden') {
                         const counter = input.parentElement.querySelector('.counter-value');
                         if(counter) counter.innerText = data[input.name];
                         input.value = data[input.name];
                    } else {
                        input.value = data[input.name];
                        if (input.name === 'checkin' || input.name === 'checkout') window.calcularNoches(id);
                    }
                }
            });
        }
    }

    window.crearContadorHTML = (n, v) => `<div class="counter-wrapper"><button type="button" class="counter-btn" onclick="this.nextElementSibling.innerText=Math.max(0,parseInt(this.nextElementSibling.innerText)-1)">-</button><span class="counter-value">${v}</span><button type="button" class="counter-btn" onclick="this.previousElementSibling.innerText=parseInt(this.previousElementSibling.innerText)+1">+</button><input type="hidden" name="${n}" value="${v}"></div>`;
    window.calcularNoches = (id) => { const c=document.querySelector(`.servicio-card[data-id="${id}"]`); if(!c)return; const i=c.querySelector('input[name="checkin"]'), o=c.querySelector('input[name="checkout"]'); if(i&&o&&i.value&&o.value){ const d1=new Date(i.value), d2=new Date(o.value); document.getElementById(`noches-${id}`).value=(d2>d1)?Math.ceil((d2-d1)/86400000):'-'; } };
    window.calcularTotal = () => { let t=0; document.querySelectorAll('.input-costo').forEach(i=>t+=parseFloat(i.value)||0); dom.inputCostoTotal.value=t; };

    dom.uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const rol = userData.rol;
        const promoType = document.getElementById('upload-promo').value;
        let status = 'approved';
        // Si es usuario y es FEED, pasa a pendiente.
        if (rol === 'usuario' && promoType === 'FEED') status = 'pending';

        const costo = parseFloat(dom.inputCostoTotal.value) || 0;
        const tarifa = parseFloat(document.getElementById('upload-tarifa-total').value) || 0;
        const fechaViajeStr = dom.inputFechaViaje.value;

        if (tarifa < costo) return window.showAlert(`Error: La tarifa ($${tarifa}) es menor al costo ($${costo}).`, 'error');
        if (!fechaViajeStr) return window.showAlert("Falta fecha de salida.", 'error');
        const cards = document.querySelectorAll('.servicio-card');
        if (cards.length === 0) return window.showAlert("Agrega al menos un servicio.", 'error');

        let serviciosData = [];
        for (let card of cards) {
            const serv = { tipo: card.dataset.tipo };
            card.querySelectorAll('input, select, textarea').forEach(i => {
                if (i.type === 'checkbox') serv[i.name] = i.checked;
                else if (i.type === 'hidden') serv[i.name] = i.parentElement.querySelector('.counter-value')?.innerText || i.value;
                else serv[i.name] = i.value;
            });
            serviciosData.push(serv);
        }

        const payload = {
            destino: document.getElementById('upload-destino').value,
            salida: document.getElementById('upload-salida').value,
            fecha_salida: fechaViajeStr,
            costos_proveedor: costo,
            tarifa: tarifa,
            moneda: document.getElementById('upload-moneda').value,
            tipo_promo: promoType,
            financiacion: document.getElementById('upload-financiacion').value,
            servicios: serviciosData,
            status: status,
            creador: userData.franquicia || 'Usuario Web', // FALLBACK IMPORTANTE PARA EVITAR ERRORES
            editor_email: currentUser.email,
            action_type: isEditingId ? 'edit' : 'create',
            id_paquete: isEditingId || '' 
        };

        dom.uploadStatus.textContent = isEditingId ? 'Actualizando...' : 'Guardando...';
        
        try {
            await secureFetch(API_URL_UPLOAD, payload);
            if (status === 'pending') {
                await window.showAlert('¡Paquete enviado a revisión! Se publicará cuando un Editor lo apruebe.', 'info');
            } else {
                await window.showAlert(isEditingId ? '¡Paquete actualizado!' : '¡Paquete guardado!', 'success');
            }
            window.location.reload();
        } catch(e) {
            console.error(e);
            window.showAlert("Error de conexión al guardar.", 'error');
        }
    });

    // --- 5. RENDERIZADO (TARJETAS LIMPIAS) ---

    function getSummaryIcons(pkg) {
         let servicios = []; try { const raw = pkg['servicios'] || pkg['item.servicios']; servicios = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) {}
         // CORRECCIÓN VISUAL: Mantiene altura uniforme
         if (!Array.isArray(servicios) || servicios.length === 0) return '<span style="opacity:0.6; padding:2px;">Sin servicios</span>';
         
         const iconMap = { 'aereo': '✈️ Aéreo', 'hotel': '🏨 Hotel', 'traslado': '🚕 Traslado', 'seguro': '🛡️ Seguro', 'adicional': '➕ Adic.', 'bus': '🚌 Bus', 'crucero': '🚢 Crucero' };
         const uniqueTypes = [...new Set(servicios.map(s => iconMap[s.tipo] || s.tipo))];
         return uniqueTypes.map(t => `<span style="white-space:nowrap;display:inline-block;margin-right:8px;margin-bottom:4px;background:#f4f7f9;padding:2px 8px;border-radius:4px;">${t}</span>`).join('');
    }

    function renderCards(list, targetGrid = dom.grid) {
        targetGrid.innerHTML = '';
        if (!list || list.length === 0) { targetGrid.innerHTML = '<p>No hay resultados.</p>'; return; }

        list.forEach(pkg => {
            const card = document.createElement('div');
            const noches = getNoches(pkg);
            card.className = 'paquete-card';
            
            const tarifaMostrar = parseFloat(pkg['tarifa']) || 0;
            const summaryIcons = getSummaryIcons(pkg);
            const bubbleStyle = `background-color:#56DDE0;color:#11173d;padding:4px 12px;border-radius:20px;font-weight:600;font-size:0.75em;display:inline-block;box-shadow:0 2px 4px rgba(0,0,0,0.05);`;

            // Lógica para mostrar etiqueta de "Pendiente" en la tarjeta del dueño
            let statusTag = '';
            if (pkg.status === 'pending') {
                statusTag = `<span style="background-color:#ffeaa7; color:#d35400; padding:2px 8px; border-radius:10px; font-size:0.7em; margin-left:5px;">⏳ En Revisión</span>`;
            }

            card.innerHTML = `
                <div class="card-clickable">
                    <div class="card-header" style="padding-bottom:0;">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%;">
                            <div style="max-width:75%; padding-right:30px;">
                                <h3 style="margin:0;font-size:1.5em;line-height:1.2;color:#11173d;">${pkg['destino']} ${statusTag}</h3>
                            </div>
                            ${noches > 0 ? `<div style="background:#eef2f5;color:#11173d;padding:5px 10px;border-radius:12px;font-weight:bold;font-size:0.8em;white-space:nowrap;">🌙 ${noches}</div>` : ''}
                        </div>
                        <div style="margin-top:8px;margin-bottom:25px;font-size:0.9em;color:#666;font-weight:500;display:flex;align-items:center;gap:6px;">
                            <span>📅 Salida: ${formatDateAR(pkg['fecha_salida'])}</span>
                        </div>
                    </div>
                    <div class="card-body" style="padding:0 20px 15px 20px;">
                        <div style="font-size:0.75em;color:#555;display:flex;flex-wrap:wrap;line-height:1.4;">${summaryIcons}</div>
                    </div>
                    <div class="card-footer" style="padding-top:15px;border-top:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center;">
                        <div><span style="${bubbleStyle}">${pkg['tipo_promo']}</span></div>
                        <div><p class="precio-valor" style="font-size:1.8em;margin:0;color:#ef5a1a;">${pkg['moneda']} $${formatMoney(Math.round(tarifaMostrar/2))}</p></div>
                    </div>
                </div>`;
            
            targetGrid.appendChild(card);
            card.querySelector('.card-clickable').addEventListener('click', () => openModal(pkg));
        });
    }

    // --- 6. LOGICA COMÚN ---
    
    // FUNCIONES DEL MODAL
    window.deletePackage = async (pkg) => {
        if (!confirm("⚠️ ¿Estás seguro de ELIMINAR este paquete?")) return;
        try {
            const id = pkg.id || pkg['item.id'] || pkg.row_number;
            await secureFetch(API_URL_UPLOAD, { action_type: 'delete', id_paquete: id }); 
            window.showAlert("Paquete eliminado.", "success");
            window.location.reload();
        } catch (e) { window.showAlert("Error al eliminar.", "error"); }
    };

    window.approvePackage = async (pkg) => {
         if (!confirm("¿Aprobar publicación en FEED?")) return;
         try {
             let payload = JSON.parse(JSON.stringify(pkg)); 
             payload.status = 'approved';
             payload.action_type = 'edit';
             delete payload['row_number']; 
             await secureFetch(API_URL_UPLOAD, payload);
             window.showAlert("Paquete Aprobado.", "success");
             window.location.reload();
         } catch(e) { window.showAlert("Error al aprobar.", "error"); }
    };

    window.startEditing = (pkg) => {
        if (!confirm("Se abrirá el formulario de edición.")) return;
        isEditingId = pkg.id || pkg['item.id'] || pkg.row_number; 
        
        document.getElementById('upload-destino').value = pkg.destino;
        document.getElementById('upload-salida').value = pkg.salida;
        let fecha = pkg.fecha_salida;
        if(fecha && fecha.includes('/')) fecha = fecha.split('/').reverse().join('-');
        dom.inputFechaViaje.value = fecha;
        document.getElementById('upload-moneda').value = pkg.moneda;
        document.getElementById('upload-promo').value = pkg.tipo_promo;
        document.getElementById('upload-financiacion').value = pkg.financiacion || '';
        document.getElementById('upload-tarifa-total').value = pkg.tarifa;

        dom.containerServicios.innerHTML = '';
        let servicios = [];
        try { const raw = pkg['servicios'] || pkg['item.servicios']; servicios = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch(e) {}
        
        if (Array.isArray(servicios)) {
            servicios.forEach(s => agregarModuloServicio(s.tipo, s));
        }
        
        window.calcularTotal();
        dom.modal.style.display = 'none'; 
        showView('upload');
        window.scrollTo(0,0);
        window.showAlert("Modo Edición Activado.", "info");
    };

    function openModal(pkg) {
        const rawServicios = pkg['servicios'] || pkg['item.servicios'];
        const htmlCliente = renderServiciosClienteHTML(rawServicios);
        const htmlCostos = renderCostosProveedoresHTML(rawServicios);
        const noches = getNoches(pkg);
        const tarifa = parseFloat(pkg['tarifa']) || 0;
        const tarifaDoble = Math.round(tarifa / 2);
        const bubbleStyle = `background-color: #56DDE0; color: #11173d; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 0.8em; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-top: 8px;`;

        // INYECCIÓN DE BOTONES DE EDICIÓN
        let adminTools = '';
        // CORRECCIÓN: Permitimos al DUEÑO (Vendedor) editar sus paquetes pendientes, o al Admin/Editor editar todo.
        const isOwner = pkg.editor_email === currentUser.email;
        const canEdit = userData.rol === 'admin' || userData.rol === 'editor' || (userData.rol === 'usuario' && pkg.status === 'pending' && isOwner);

        if (canEdit) {
            // Solo Admin/Editor aprueba
            const btnApprove = (userData.rol === 'admin' || userData.rol === 'editor') && pkg.status === 'pending' ? 
                `<button class="btn btn-primario" onclick='approvePackage(${JSON.stringify(pkg)})' style="padding:5px 15px; font-size:0.8em; background:#2ecc71;">✅ Aprobar</button>` : '';
            
            adminTools = `
                <div class="modal-tools" style="position: absolute; top: 20px; right: 70px; display:flex; gap:10px;">
                    ${btnApprove}
                    <button class="btn btn-secundario" onclick='startEditing(${JSON.stringify(pkg)})' style="padding:5px 15px; font-size:0.8em;">✏️ Editar</button>
                    <button class="btn btn-secundario" onclick='deletePackage(${JSON.stringify(pkg)})' style="padding:5px 15px; font-size:0.8em; background:#e74c3c; color:white;">🗑️ Borrar</button>
                </div>
            `;
        }

        dom.modalBody.innerHTML = `
            ${adminTools}
            <div class="modal-detalle-header" style="display:flex; flex-direction:column; align-items:flex-start; padding: 25px;">
                <h2 style="margin:0; color:#11173d; font-size: 2em; padding-right: 150px;">${pkg['destino']}</h2>
                <span style="${bubbleStyle}">${pkg['tipo_promo']}</span>
            </div>
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
                    <div><small style="opacity:0.7;">Tarifa Final</small><div style="font-size:1.2em; font-weight:bold; color:#ef5a1a;">${pkg['moneda']} $${formatMoney(tarifa)}</div></div>
                    <div><small style="opacity:0.7;">x Persona (Base Doble)</small><div style="font-size:1.2em; font-weight:bold; color:#4caf50;">${pkg['moneda']} $${formatMoney(tarifaDoble)}</div></div>
                </div>
                <div style="text-align:right;"><small style="opacity:0.7;">Cargado por:</small><div style="font-size:0.9em;">${pkg['creador']}</div></div>
            </div>`;
        dom.modal.style.display = 'flex';
    }

    // --- UTILS & FILTERS ---
    function getNoches(pkg) {
        let servicios = []; try { const raw = pkg['servicios'] || pkg['item.servicios']; servicios = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch(e) {}
        if(!Array.isArray(servicios)) return 0;
        const bus = servicios.find(s => s.tipo === 'bus'); if (bus && bus.bus_noches) return parseInt(bus.bus_noches);
        const crucero = servicios.find(s => s.tipo === 'crucero'); if (crucero && crucero.crucero_noches) return parseInt(crucero.crucero_noches);
        if(!pkg['fecha_salida']) return 0;
        let fechaStr = pkg['fecha_salida']; if(fechaStr.includes('/')) fechaStr = fechaStr.split('/').reverse().join('-');
        const start = new Date(fechaStr + 'T00:00:00'); let maxDate = new Date(start), hasData = false;
        servicios.forEach(s => {
            if(s.tipo==='hotel'&&s.checkout){ const d=new Date(s.checkout+'T00:00:00'); if(d>maxDate){maxDate=d; hasData=true;} }
            if(s.tipo==='aereo'&&s.fecha_regreso){ const d=new Date(s.fecha_regreso+'T00:00:00'); if(d>maxDate){maxDate=d; hasData=true;} }
        });
        return hasData ? Math.ceil((maxDate - start) / 86400000) : 0;
    }
    
    function populateFranchiseFilter(packages) {
        const selector = dom.filtroCreador;
        if(!selector) return;
        const currentVal = selector.value;
        const creadores = [...new Set(packages.map(p => p.creador).filter(Boolean))];
        selector.innerHTML = '<option value="">Todas las Franquicias</option>';
        creadores.sort().forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.innerText = c;
            selector.appendChild(opt);
        });
        selector.value = currentVal;
    }

    // AQUI ESTÁ LA MAGIA PARA QUE EL USUARIO VEA SUS PENDIENTES
    function applyFilters() {
        const fDestino = document.getElementById('filtro-destino').value.toLowerCase();
        const fCreador = dom.filtroCreador ? dom.filtroCreador.value : '';
        const fPromo = document.getElementById('filtro-promo').value;
        const fOrden = dom.filtroOrden ? dom.filtroOrden.value : 'reciente';

        let result = allPackages.filter(pkg => {
            // LÓGICA DE VISIBILIDAD:
            // 1. Si es Admin/Editor: Ve todo (incluso pendientes si quiere, pero gralmente están en Gestión).
            //    Pero en la grilla PRINCIPAL solemos ocultar pendientes ajenos para no ensuciar.
            // 2. Si es Usuario:
            //    - Ve 'approved' (o sin status).
            //    - Ve 'pending' SOLO si es suyo (pkg.editor_email == currentUser.email).
            
            const isOwner = pkg.editor_email === currentUser.email;
            const isApproved = !pkg.status || pkg.status === 'approved';
            const isPending = pkg.status === 'pending';
            
            // Si está pendiente y NO soy el dueño, lo oculto (Admin lo ve en Gestión, otros no lo ven)
            if (isPending && !isOwner) return false;

            const mDestino = !fDestino || (pkg.destino && pkg.destino.toLowerCase().includes(fDestino));
            const mCreador = !fCreador || (pkg.creador && pkg.creador === fCreador);
            const mPromo = !fPromo || (pkg.tipo_promo && pkg.tipo_promo === fPromo);
            return mDestino && mCreador && mPromo;
        });

        if (fOrden === 'menor_precio') result.sort((a, b) => parseFloat(a.tarifa) - parseFloat(b.tarifa));
        else if (fOrden === 'mayor_precio') result.sort((a, b) => parseFloat(b.tarifa) - parseFloat(a.tarifa));
        else result.reverse();

        renderCards(result, dom.grid);
        
        if (userData && (userData.rol === 'admin' || userData.rol === 'editor')) {
            const pendientes = allPackages.filter(p => p.status === 'pending');
            renderCards(pendientes, dom.gridGestion);
        }
    }

    const formatMoney = (a) => new Intl.NumberFormat('es-AR', { style: 'decimal', minimumFractionDigits: 0 }).format(a);
    const formatDateAR = (s) => { if(!s) return '-'; const p = s.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s; };

    async function fetchAndLoadPackages() { 
        try { 
            const d = await secureFetch(API_URL_SEARCH, {}); 
            allPackages = d; 
            populateFranchiseFilter(allPackages); 
            applyFilters(); 
        } catch(e){ console.error(e); } 
    }

    function renderServiciosClienteHTML(rawJson) {
         let servicios=[]; try{ servicios=typeof rawJson==='string'?JSON.parse(rawJson):rawJson; }catch(e){ return '<p>Sin detalles.</p>'; }
        if(!Array.isArray(servicios)||servicios.length===0) return '<p>Sin detalles.</p>';
        let html='';
        servicios.forEach(s => {
            let icono='🔹', titulo='', lineas=[];
            if(s.tipo==='aereo'){ icono='✈️'; titulo='AÉREO'; lineas.push(`<b>Aerolínea:</b> ${s.aerolinea}`); lineas.push(`<b>Fechas:</b> ${formatDateAR(s.fecha_aereo)}${s.fecha_regreso?` | <b>Vuelta:</b> ${formatDateAR(s.fecha_regreso)}`:''}`); lineas.push(`<b>Escalas:</b> ${s.escalas==0?'Directo':s.escalas}`); lineas.push(`<b>Equipaje:</b> ${s.tipo_equipaje.replace(/_/g,' ')} (x${s.cantidad_equipaje||1})`); }
            else if(s.tipo==='hotel'){ icono='🏨'; titulo='HOTEL'; lineas.push(`<b>${s.hotel_nombre}</b> (${s.regimen})`); lineas.push(`<b>Estadía:</b> ${(s.checkin&&s.checkout)?Math.ceil((new Date(s.checkout)-new Date(s.checkin))/86400000):'-'} noches (${formatDateAR(s.checkin)} al ${formatDateAR(s.checkout)})`); }
            else if(s.tipo==='traslado'){ icono='🚕'; titulo='TRASLADO'; let t=[]; if(s.trf_in)t.push("In"); if(s.trf_out)t.push("Out"); if(s.trf_hah)t.push("Htl-Htl"); lineas.push(`<b>Tipo:</b> ${s.tipo_trf} (${t.join(' + ')})`); }
            else if(s.tipo==='seguro'){ icono='🛡️'; titulo='SEGURO'; lineas.push(`<b>Cob:</b> ${s.proveedor}`); }
            else if(s.tipo==='adicional'){ icono='➕'; titulo='ADICIONAL'; lineas.push(`<b>${s.descripcion}</b>`); }
            else if (s.tipo === 'bus') { icono = '🚌'; titulo = 'PAQUETE BUS'; lineas.push(`<b>Duración:</b> ${s.bus_noches} Noches`); if (s.bus_alojamiento) lineas.push(`<b>Alojamiento:</b> Incluido (${s.bus_regimen})`); else lineas.push(`<b>Alojamiento:</b> No incluido`); let extras = []; if (s.bus_excursiones) extras.push("Excursiones"); if (s.bus_asistencia) extras.push("Asistencia"); if (extras.length > 0) lineas.push(`<b>Incluye:</b> ${extras.join(' + ')}`); }
            else if (s.tipo === 'crucero') { icono = '🚢'; titulo = 'CRUCERO'; lineas.push(`<b>Naviera:</b> ${s.crucero_naviera}`); lineas.push(`<b>Salida:</b> ${s.crucero_puerto_salida} (${s.crucero_noches} Noches)`); lineas.push(`<b>Recorrido:</b> ${s.crucero_recorrido}`); if(s.crucero_info) lineas.push(`<i>Info: ${s.crucero_info}</i>`); }
            if(s.obs) lineas.push(`<i>Obs: ${s.obs}</i>`);
            html+=`<div style="margin-bottom:10px;border-left:3px solid #ddd;padding-left:10px;"><div style="color:#11173d;font-weight:bold;">${icono} ${titulo}</div><div style="font-size:0.9em;color:#555;">${lineas.map(l=>`<div>${l}</div>`).join('')}</div></div>`;
        });
        return html;
    }
    
    function renderCostosProveedoresHTML(rawJson) {
         let servicios=[]; try{ servicios=typeof rawJson==='string'?JSON.parse(rawJson):rawJson; }catch(e){ return '<p>-</p>'; }
        if(!Array.isArray(servicios)||servicios.length===0) return '<p>-</p>';
        let html='<ul style="list-style:none; padding:0; margin:0;">';
        servicios.forEach(s => { const tipo = s.tipo ? s.tipo.toUpperCase() : 'SERVICIO'; html += `<li style="margin-bottom:5px; font-size:0.9em; border-bottom:1px dashed #eee; padding-bottom:5px;"><b>${tipo}:</b> ${s.proveedor || '-'} <span style="float:right;">$${formatMoney(s.costo || 0)}</span></li>`; });
        html += '</ul>'; return html;
    }
    
    // Navegación Vistas
    function showView(n) {
        Object.values(dom.views).forEach(v => { if(v) v.classList.remove('active'); });
        Object.values(dom.nav).forEach(b => { if(b) b.classList.remove('active'); });
        if(dom.views[n]) dom.views[n].classList.add('active');
        if(dom.nav[n]) dom.nav[n].classList.add('active');
        isEditingId = null; 
    }
    
    dom.nav.search.onclick = () => showView('search');
    dom.nav.upload.onclick = () => { isEditingId = null; document.getElementById('upload-form').reset(); dom.containerServicios.innerHTML=''; showView('upload'); };
    dom.nav.gestion.onclick = () => showView('gestion');
    dom.nav.users.onclick = () => showView('users');
    dom.modalClose.onclick = () => dom.modal.style.display = 'none';
    window.onclick = e => { if(e.target === dom.modal) dom.modal.style.display='none'; };
    
    // Listeners Filtros
    dom.btnBuscar.addEventListener('click', applyFilters);
    dom.btnLimpiar.addEventListener('click', () => { 
        document.getElementById('filtro-destino').value=''; 
        if(dom.filtroCreador) dom.filtroCreador.value=''; 
        document.getElementById('filtro-promo').value='';
        if(dom.filtroOrden) dom.filtroOrden.value='reciente';
        applyFilters(); 
    });
    if(dom.filtroOrden) dom.filtroOrden.addEventListener('change', applyFilters);
    if(dom.filtroCreador) dom.filtroCreador.addEventListener('change', applyFilters);

});
