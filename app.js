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
    let userAliases = {}; // Mapa: email -> alias

    const dom = {
        // Vistas
        viewSearch: document.getElementById('view-search'), viewUpload: document.getElementById('view-upload'), viewUsers: document.getElementById('view-users'),
        navSearch: document.getElementById('nav-search'), navUpload: document.getElementById('nav-upload'), navUsers: document.getElementById('nav-users'),
        // Auth
        loginContainer: document.getElementById('login-container'), appContainer: document.getElementById('app-container'),
        btnLoginGoogle: document.getElementById('login-google'), loginEmailForm: document.getElementById('login-email-form'), authError: document.getElementById('auth-error'), userLabel: document.getElementById('user-label'), btnLogout: document.getElementById('logout-button'),
        // App
        grid: document.getElementById('grilla-paquetes'), loader: document.getElementById('loading-placeholder'),
        btnBuscar: document.getElementById('boton-buscar'), btnLimpiar: document.getElementById('boton-limpiar'), 
        filtroOrden: document.getElementById('filtro-orden'), filtroCreador: document.getElementById('filtro-creador'),
        // Carga
        uploadForm: document.getElementById('upload-form'), uploadStatus: document.getElementById('upload-status'), btnSubir: document.getElementById('boton-subir'), btnCancelarEdicion: document.getElementById('boton-cancelar-edicion'),
        formTitle: document.getElementById('form-title'), editIdField: document.getElementById('edit-package-id'),
        containerServicios: document.getElementById('servicios-container'), btnAgregarServicio: document.getElementById('btn-agregar-servicio'), selectorServicio: document.getElementById('selector-servicio'),
        inputCostoTotal: document.getElementById('upload-costo-total'),
        // Modales
        modal: document.getElementById('modal-detalle'), modalBody: document.getElementById('modal-body'), modalClose: document.getElementById('modal-cerrar'),
        modalConfirm: document.getElementById('modal-confirm'), btnConfirmOk: document.getElementById('btn-confirm-ok'), btnConfirmCancel: document.getElementById('btn-confirm-cancel'), confirmTitle: document.getElementById('confirm-title'), confirmMessage: document.getElementById('confirm-message'),
        // Admin
        listaUsuarios: document.getElementById('lista-usuarios-body'), btnNuevoUsuario: document.getElementById('btn-nuevo-usuario'),
        modalUsuario: document.getElementById('modal-usuario'), formUsuario: document.getElementById('form-usuario'), btnCerrarUserModal: document.getElementById('btn-cerrar-user-modal'), 
        inputAdminEmail: document.getElementById('admin-user-email'), inputAdminRole: document.getElementById('admin-user-role'), inputAdminAlias: document.getElementById('admin-user-alias')
    };

    // --- AUTENTICACIÓN ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const userData = await verificarAcceso(user.email);
            if (userData) {
                currentUser = user;
                currentRole = userData.role || 'usuario';
                
                await cargarMapaAliases(); // Cargar nombres bonitos
                
                dom.loginContainer.style.display = 'none';
                dom.appContainer.style.display = 'block';
                dom.userLabel.textContent = userAliases[user.email] || user.email;

                setupUIByRole();
                await fetchAndLoadPackages();
                showView('search');
            } else {
                alert("Usuario no registrado. Contacte al administrador.");
                auth.signOut();
            }
        } else {
            currentUser = null;
            dom.loginContainer.style.display = 'flex';
            dom.appContainer.style.display = 'none';
        }
    });

    async function verificarAcceso(email) {
        if (email === SUPER_ADMIN) return { role: 'admin' };
        try {
            const doc = await db.collection('usuarios').doc(email).get();
            if (doc.exists) return doc.data();
        } catch (e) { console.error(e); }
        return null;
    }

    async function cargarMapaAliases() {
        try {
            const snap = await db.collection('usuarios').get();
            dom.filtroCreador.innerHTML = '<option value="">Todos</option>';
            userAliases = {};
            snap.forEach(doc => {
                const d = doc.data();
                userAliases[doc.id] = d.alias || doc.id;
                // Llenar filtro creador
                const opt = document.createElement('option');
                opt.value = doc.id; // Value es el email
                opt.textContent = d.alias || doc.id; // Texto es el Alias
                dom.filtroCreador.appendChild(opt);
            });
        } catch(e) {}
    }

    function setupUIByRole() {
        dom.navUpload.style.display = 'inline-block';
        dom.navUsers.style.display = (currentRole === 'admin') ? 'inline-block' : 'none';
    }

    // Login Events
    dom.btnLoginGoogle.onclick = () => auth.signInWithPopup(provider).catch(e => dom.authError.textContent = e.message);
    dom.loginEmailForm.onsubmit = async (e) => { e.preventDefault(); try { await auth.signInWithEmailAndPassword(document.getElementById('login-email').value, document.getElementById('login-pass').value); } catch(err) { dom.authError.textContent = "Credenciales incorrectas."; } };
    dom.btnLogout.onclick = () => auth.signOut();

    // --- LÓGICA DE PAQUETES (CRUD) ---

    // 1. CARGA (GET)
    async function fetchAndLoadPackages() {
        dom.loader.style.display = 'block';
        try {
            const data = await secureFetch(API_URL_SEARCH, {});
            allPackages = data;
            applyFilters();
        } catch(e) { console.error(e); }
        dom.loader.style.display = 'none';
    }

    // 2. CREAR / EDITAR (POST/PUT)
    dom.uploadForm.onsubmit = async (e) => {
        e.preventDefault();
        const isEdit = !!dom.editIdField.value;
        const costo = parseFloat(dom.inputCostoTotal.value)||0;
        const tarifa = parseFloat(document.getElementById('upload-tarifa-total').value)||0;
        
        if(tarifa < costo) return showCustomConfirm("Advertencia", "La tarifa es menor al costo. ¿Deseas continuar?", () => submitPackage());
        submitPackage();
    };

    async function submitPackage() {
        dom.btnSubir.disabled = true; 
        dom.uploadStatus.textContent = 'Procesando...';
        
        const serviciosData = [];
        document.querySelectorAll('.servicio-card').forEach(card => {
            const serv = { tipo: card.dataset.tipo };
            card.querySelectorAll('input, select').forEach(i => {
                if(i.type === 'checkbox') serv[i.name] = i.checked;
                else if(i.type === 'hidden') serv[i.name] = i.parentElement.querySelector('.counter-value')?.innerText || i.value;
                else serv[i.name] = i.value;
            });
            serviciosData.push(serv);
        });

        const payload = {
            action: dom.editIdField.value ? 'edit' : 'create', // Flag para n8n
            id: dom.editIdField.value || null, // ID si es edición
            destino: document.getElementById('upload-destino').value,
            salida: document.getElementById('upload-salida').value,
            fecha_salida: document.getElementById('upload-fecha-salida').value,
            costos_proveedor: parseFloat(dom.inputCostoTotal.value)||0,
            tarifa_venta: parseFloat(document.getElementById('upload-tarifa-total').value)||0,
            moneda: document.getElementById('upload-moneda').value,
            tipo_promo: document.getElementById('upload-promo').value,
            financiacion: document.getElementById('upload-financiacion').value,
            servicios: serviciosData,
            creador: currentUser.email // Siempre enviamos el email, n8n o el sheet pueden buscar el alias si quieren
        };

        try {
            await secureFetch(API_URL_ACTION, payload);
            alert(dom.editIdField.value ? 'Paquete actualizado.' : 'Paquete creado.');
            resetForm();
            window.location.reload();
        } catch(e) {
            dom.uploadStatus.textContent = 'Error al guardar.';
            dom.btnSubir.disabled = false;
        }
    }

    // 3. BORRAR (DELETE)
    window.borrarPaquete = (id) => {
        showCustomConfirm("Eliminar Paquete", "¿Estás seguro de que deseas eliminar este paquete permanentemente de Google Sheets?", async () => {
            try {
                // Enviamos payload de borrado
                await secureFetch(API_URL_ACTION, { action: 'delete', id: id });
                // Optimista: removemos de la vista sin recargar
                allPackages = allPackages.filter(p => (p.id || p.row_number) != id); // Ajusta según tu ID
                applyFilters();
            } catch(e) { alert("Error al borrar: " + e.message); }
        });
    };

    // 4. PREPARAR EDICIÓN
    window.editarPaquete = (pkgStr) => {
        const pkg = JSON.parse(decodeURIComponent(pkgStr));
        
        // Cambiar a vista de carga
        showView('upload');
        dom.formTitle.textContent = `Editando: ${pkg.destino}`;
        dom.btnSubir.textContent = "Actualizar Paquete";
        dom.btnCancelarEdicion.style.display = 'inline-block';
        dom.editIdField.value = pkg.id || pkg.row_number; // Asegúrate de tener un ID único

        // Llenar campos simples
        document.getElementById('upload-destino').value = pkg.destino;
        document.getElementById('upload-salida').value = pkg.salida;
        // La fecha viene dd/mm/yyyy o yyyy-mm-dd, el input date necesita yyyy-mm-dd
        // Asumimos que viene bien o parseamos.
        // document.getElementById('upload-fecha-salida').value = ...
        
        // Llenar servicios (más complejo, borramos todo y recreamos)
        dom.containerServicios.innerHTML = '';
        const servicios = typeof pkg.servicios === 'string' ? JSON.parse(pkg.servicios) : pkg.servicios;
        if(Array.isArray(servicios)) {
            servicios.forEach(s => {
                agregarModuloServicio(s.tipo, s); // Modificaremos agregarModuloServicio para aceptar valores
            });
        }
        window.calcularTotal();
    };

    dom.btnCancelarEdicion.onclick = resetForm;

    function resetForm() {
        dom.uploadForm.reset();
        dom.containerServicios.innerHTML = '';
        dom.formTitle.textContent = "Cargar Nuevo Paquete";
        dom.btnSubir.textContent = "Guardar Paquete";
        dom.btnCancelarEdicion.style.display = 'none';
        dom.editIdField.value = '';
    }

    // --- INTERFAZ DINÁMICA ---
    
    // Custom Confirm Modal
    function showCustomConfirm(title, message, onConfirm) {
        dom.confirmTitle.textContent = title;
        dom.confirmMessage.textContent = message;
        dom.modalConfirm.style.display = 'flex';
        
        // Limpiamos eventos anteriores para no acumular clics
        const newOk = dom.btnConfirmOk.cloneNode(true);
        const newCancel = dom.btnConfirmCancel.cloneNode(true);
        dom.btnConfirmOk.replaceWith(newOk);
        dom.btnConfirmCancel.replaceWith(newCancel);
        dom.btnConfirmOk = newOk;
        dom.btnConfirmCancel = newCancel;

        dom.btnConfirmOk.addEventListener('click', () => {
            dom.modalConfirm.style.display = 'none';
            onConfirm();
        });
        dom.btnConfirmCancel.addEventListener('click', () => {
            dom.modalConfirm.style.display = 'none';
        });
    }

    // Render Cards
    function renderCards(list) {
        dom.grid.innerHTML = '';
        if(!list.length) { dom.grid.innerHTML='<p>No hay resultados.</p>'; return; }
        
        list.forEach(pkg => {
            const card = document.createElement('div');
            card.className = 'paquete-card';
            // Guardamos todo el objeto para usarlo en el modal y edición
            const pkgString = encodeURIComponent(JSON.stringify(pkg));
            card.dataset.packageData = pkgString;

            // Alias del creador
            const nombreCreador = userAliases[pkg.creador] || pkg.creador || 'Agencia';

            // Botones Acciones (Solo Editor/Admin)
            let actionsHTML = '';
            if(currentRole === 'editor' || currentRole === 'admin') {
                actionsHTML = `
                <div class="card-actions">
                    <div class="btn-mini edit" onclick="event.stopPropagation(); window.editarPaquete('${pkgString}')">✏️</div>
                    <div class="btn-mini delete" onclick="event.stopPropagation(); window.borrarPaquete('${pkg.id}')">🗑️</div>
                </div>`;
            }

            card.innerHTML = `
                ${actionsHTML}
                <div class="card-header">
                    <span class="tag-promo">${pkg.tipo_promo}</span>
                    <h3 style="margin-top:10px;">${pkg.destino}</h3>
                    <small style="color:#888;">Por: ${nombreCreador}</small>
                </div>
                <div class="card-body">
                    <p><strong>Salida:</strong> ${formatDateAR(pkg.fecha_salida)}</p>
                    <p><strong>Desde:</strong> ${pkg.salida}</p>
                </div>
                <div class="card-footer">
                    <p class="precio-valor">${pkg.moneda} $${formatMoney(pkg.tarifa_venta || pkg.tarifa)}</p>
                </div>
            `;
            
            // Efecto Flip y Apertura
            card.addEventListener('click', (e) => {
                if(e.target.closest('.card-actions')) return; // No abrir si clica botones
                card.classList.add('flipping');
                setTimeout(() => {
                    openModal(pkg);
                    setTimeout(() => card.classList.remove('flipping'), 500); // Reset visual
                }, 300);
            });

            dom.grid.appendChild(card);
        });
    }

    function applyFilters() {
        const fDest = dom.viewSearch.querySelector('#filtro-destino').value.toLowerCase();
        const fCreador = dom.viewSearch.querySelector('#filtro-creador').value; // Es el email
        const fPromo = dom.viewSearch.querySelector('#filtro-promo').value;
        const fOrden = dom.viewSearch.querySelector('#filtro-orden').value;

        let res = allPackages.filter(p => {
            const mDest = !fDest || (p.destino && p.destino.toLowerCase().includes(fDest));
            const mCreador = !fCreador || (p.creador === fCreador);
            const mPromo = !fPromo || (p.tipo_promo === fPromo);
            return mDest && mCreador && mPromo;
        });

        // Ordenamiento
        if (fOrden === 'menor_precio') res.sort((a,b) => parseFloat(a.tarifa_venta) - parseFloat(b.tarifa_venta));
        else if (fOrden === 'mayor_precio') res.sort((a,b) => parseFloat(b.tarifa_venta) - parseFloat(a.tarifa_venta));
        else { 
            // Reciente (asumiendo que hay fecha de carga o usando fecha salida como proxy)
            res.sort((a,b) => new Date(b.fecha_salida) - new Date(a.fecha_salida)); 
        }

        renderCards(res);
    }

    // Eventos Filtros
    dom.btnBuscar.onclick = applyFilters;
    dom.btnLimpiar.onclick = () => { 
        dom.viewSearch.querySelector('#filtro-destino').value='';
        dom.viewSearch.querySelector('#filtro-creador').value='';
        applyFilters(); 
    };
    dom.filtroOrden.onchange = applyFilters;

    // --- FORMULARIO DINÁMICO (Con capacidad de pre-llenado) ---
    function agregarModuloServicio(tipo, data = null) {
        const id = Date.now() + Math.random().toString().substr(2, 5); // ID único
        const div = document.createElement('div');
        div.className = `servicio-card ${tipo}`;
        div.dataset.id = id; 
        div.dataset.tipo = tipo;
        
        let html = `<button type="button" class="btn-eliminar-servicio" onclick="this.parentElement.remove(); window.calcularTotal();">×</button><h4>${tipo.toUpperCase()}</h4>`;
        
        // Generador de inputs helper
        const input = (name, type="text", cls="") => {
            const val = data ? data[name] : '';
            return `<input type="${type}" name="${name}" value="${val}" class="${cls}" required>`;
        };
        const sel = (name, opts) => {
            const val = data ? data[name] : '';
            const optsHtml = opts.map(o => `<option ${o===val?'selected':''}>${o}</option>`).join('');
            return `<select name="${name}">${optsHtml}</select>`;
        };

        if(tipo === 'aereo') {
            html += `<div class="form-grid"><div class="filtro-item"><label>Aerolínea</label>${input('aerolinea')}</div><div class="filtro-item"><label>Ida</label>${input('fecha_aereo','date')}</div></div>`;
            html += `<div class="filtro-item"><label>Costo</label><input type="number" name="costo" class="input-costo" value="${data?.costo||0}" onchange="window.calcularTotal()"></div>`;
        } 
        else if (tipo === 'hotel') {
            html += `<div class="filtro-item"><label>Hotel</label>${input('hotel_nombre')}</div>`;
            html += `<div class="filtro-item"><label>Costo</label><input type="number" name="costo" class="input-costo" value="${data?.costo||0}" onchange="window.calcularTotal()"></div>`;
        }
        else {
            // Genérico para otros
            html += `<div class="filtro-item"><label>Detalle/Proveedor</label>${input('proveedor')}</div>`;
            html += `<div class="filtro-item"><label>Costo</label><input type="number" name="costo" class="input-costo" value="${data?.costo||0}" onchange="window.calcularTotal()"></div>`;
        }

        div.innerHTML = html;
        dom.containerServicios.appendChild(div);
    }
    
    window.calcularTotal = () => {
        let t=0; 
        document.querySelectorAll('.input-costo').forEach(i=>t+=parseFloat(i.value)||0); 
        dom.inputCostoTotal.value = t; 
    };

    dom.btnAgregarServicio.onclick = () => { if (dom.selectorServicio.value) { agregarModuloServicio(dom.selectorServicio.value); dom.selectorServicio.value = ""; } };

    // --- UTILIDADES ---
    async function secureFetch(url, body) {
        if (!currentUser) throw new Error('No auth');
        const token = await currentUser.getIdToken(true);
        const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body:JSON.stringify(body), cache:'no-store' });
        const txt = await res.text(); return txt ? JSON.parse(txt) : [];
    }
    const formatMoney = (a) => new Intl.NumberFormat('es-AR', { style: 'decimal', minimumFractionDigits: 0 }).format(a);
    const formatDateAR = (s) => { if(!s) return '-'; const p = s.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s; };

    // --- GESTIÓN USUARIOS ---
    dom.btnNuevoUsuario.onclick = () => { dom.formUsuario.reset(); dom.modalUsuario.style.display='flex'; };
    dom.formUsuario.onsubmit = async (e) => {
        e.preventDefault();
        const email = dom.inputAdminEmail.value.trim().toLowerCase();
        const payload = { 
            role: dom.inputAdminRole.value, 
            alias: dom.inputAdminAlias.value 
        };
        try {
            await db.collection('usuarios').doc(email).set(payload);
            alert("Usuario guardado.");
            dom.modalUsuario.style.display='none';
            cargarTablaUsuarios();
        } catch(e) { alert(e.message); }
    };
    if(dom.btnCerrarUserModal) dom.btnCerrarUserModal.onclick = () => dom.modalUsuario.style.display='none';

    // --- MODAL DETALLE (Simplificado para el ejemplo) ---
    function openModal(pkg) {
        dom.modalBody.innerHTML = `<h2>${pkg.destino}</h2><p>Detalle completo aquí...</p>`;
        dom.modal.style.display = 'flex';
    }
    dom.modalClose.onclick = () => dom.modal.style.display='none';

    // Navegación
    function showView(name) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-button').forEach(b => b.classList.remove('active'));
        if(name === 'search') { dom.viewSearch.classList.add('active'); dom.navSearch.classList.add('active'); }
        if(name === 'upload') { dom.viewUpload.classList.add('active'); dom.navUpload.classList.add('active'); }
        if(name === 'users') { dom.viewUsers.classList.add('active'); dom.navUsers.classList.add('active'); cargarTablaUsuarios(); }
    }
    dom.navSearch.onclick = () => showView('search');
    dom.navUpload.onclick = () => showView('upload');
    dom.navUsers.onclick = () => showView('users');
});






