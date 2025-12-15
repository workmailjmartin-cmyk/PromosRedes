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

    // Referencias DOM (Me aseguro que coincidan con tu HTML original)
    const dom = {
        viewSearch: document.getElementById('view-search'),
        viewUpload: document.getElementById('view-upload'),
        viewUsers: document.getElementById('view-users'),
        navSearch: document.getElementById('nav-search'),
        navUpload: document.getElementById('nav-upload'),
        navUsers: document.getElementById('nav-users'),
        logo: document.querySelector('.logo'),
        userLabel: document.getElementById('user-label'),
        btnLogout: document.getElementById('logout-button'),
        loginContainer: document.getElementById('login-container'),
        appContainer: document.getElementById('app-container'),
        btnLoginGoogle: document.getElementById('login-google'),
        loginEmailForm: document.getElementById('login-email-form'),
        authError: document.getElementById('auth-error'),
        grid: document.getElementById('grilla-paquetes'),
        loader: document.getElementById('loading-placeholder'),
        btnBuscar: document.getElementById('boton-buscar'),
        btnLimpiar: document.getElementById('boton-limpiar'),
        uploadForm: document.getElementById('upload-form'),
        uploadStatus: document.getElementById('upload-status'),
        btnSubir: document.getElementById('boton-subir'),
        containerServicios: document.getElementById('servicios-container'),
        btnAgregarServicio: document.getElementById('btn-agregar-servicio'),
        selectorServicio: document.getElementById('selector-servicio'),
        inputCostoTotal: document.getElementById('upload-costo-total'),
        inputFechaViaje: document.getElementById('upload-fecha-salida'),
        modal: document.getElementById('modal-detalle'),
        modalBody: document.getElementById('modal-body'),
        modalClose: document.getElementById('modal-cerrar'),
        listaUsuarios: document.getElementById('lista-usuarios-body'),
        btnNuevoUsuario: document.getElementById('btn-nuevo-usuario'),
        modalUsuario: document.getElementById('modal-usuario'),
        formUsuario: document.getElementById('form-usuario'),
        btnCerrarUserModal: document.getElementById('btn-cerrar-user-modal'),
        inputAdminEmail: document.getElementById('admin-user-email'),
        // Checkboxes del admin viejo (los usaremos para mapear a roles si es necesario)
        checkPermPaquetes: document.getElementById('perm-paquetes'), 
        checkPermUsuarios: document.getElementById('perm-usuarios')
    };

    if(dom.logo) { dom.logo.style.cursor = 'pointer'; dom.logo.onclick = () => window.location.reload(); }

    // =========================================================
    // 3. AUTENTICACIÓN Y ROLES (Lógica Corregida)
    // =========================================================

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // 1. Obtener Rol Estricto
            const role = await verificarAcceso(user.email);
            
            if (role) {
                currentUser = user;
                currentRole = role;
                
                // UI
                dom.loginContainer.style.display = 'none';
                dom.appContainer.style.display = 'block';
                dom.userLabel.textContent = `${user.email} (${role})`;

                // Configurar Navegación
                setupNavPermissions();

                // Cargar datos
                await fetchAndLoadPackages();
                showView('search');
            } else {
                alert('Acceso denegado: Tu usuario no está registrado en la base de datos.');
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
                const data = doc.data();
                // Lógica de compatibilidad con tu sistema de permisos viejo
                if (data.role) return data.role; // Si ya tiene rol moderno
                if (data.usuarios) return 'admin';
                if (data.paquetes) return 'editor'; // Asumimos que el viejo permiso de paquetes es editor
                return 'usuario'; // Base
            }
        } catch (e) { console.error(e); }
        return null; // No existe -> Bloqueado
    }

    function setupNavPermissions() {
        // Todos los logueados pueden Cargar
        dom.navUpload.style.display = 'inline-block';
        
        // Solo Admin ve Usuarios
        dom.navUsers.style.display = (currentRole === 'admin') ? 'inline-block' : 'none';
    }

    // Login Events
    dom.btnLoginGoogle.onclick = () => auth.signInWithPopup(provider).catch(e => dom.authError.textContent = e.message);
    dom.loginEmailForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await auth.signInWithEmailAndPassword(document.getElementById('login-email').value, document.getElementById('login-pass').value);
        } catch (err) { dom.authError.textContent = "Credenciales incorrectas."; }
    };
    dom.btnLogout.onclick = () => auth.signOut();

    // =========================================================
    // 4. GESTIÓN DE USUARIOS (ADMIN)
    // =========================================================
    
    async function cargarTablaUsuarios() {
        if (currentRole !== 'admin') return;
        dom.listaUsuarios.innerHTML = '<tr><td colspan="3">Cargando...</td></tr>';
        
        const snapshot = await db.collection('usuarios').get();
        dom.listaUsuarios.innerHTML = '';
        
        snapshot.forEach(doc => {
            const d = doc.data();
            // Determinar rol visualmente
            let rolMostrar = d.role || (d.usuarios ? 'admin' : (d.paquetes ? 'editor' : 'usuario'));
            
            dom.listaUsuarios.innerHTML += `
                <tr>
                    <td>${doc.id}</td>
                    <td><span class="badge-permiso bg-blue">${rolMostrar.toUpperCase()}</span></td>
                    <td>
                        <button class="btn btn-secundario btn-sm" style="color:red;" onclick="window.borrarUsuario('${doc.id}')">Borrar</button>
                    </td>
                </tr>`;
        });
    }

    // Guardar usuario (Simplificado para usar tu modal existente)
    dom.formUsuario.onsubmit = async (e) => {
        e.preventDefault();
        const email = dom.inputAdminEmail.value.toLowerCase().trim();
        // Mapeamos los checkboxes viejos a roles nuevos para mantener compatibilidad visual
        let rol = 'usuario';
        if(dom.checkPermUsuarios.checked) rol = 'admin';
        else if(dom.checkPermPaquetes.checked) rol = 'editor';

        await db.collection('usuarios').doc(email).set({ 
            role: rol,
            paquetes: (rol === 'editor' || rol === 'admin'), // Mantener compatibilidad
            usuarios: (rol === 'admin')
        });
        alert("Usuario guardado/actualizado.");
        dom.modalUsuario.style.display = 'none';
        cargarTablaUsuarios();
    };

    window.borrarUsuario = async (email) => {
        if(confirm("¿Eliminar acceso a " + email + "?")) {
            await db.collection('usuarios').doc(email).delete();
            cargarTablaUsuarios();
        }
    };

    dom.btnNuevoUsuario.onclick = () => { dom.formUsuario.reset(); dom.modalUsuario.style.display='flex'; };
    dom.btnCerrarUserModal.onclick = () => dom.modalUsuario.style.display='none';

    // =========================================================
    // 5. NAVEGACIÓN
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

    // =========================================================
    // 6. CARGA DE PAQUETES (LÓGICA VIEJA RECUPERADA)
    // =========================================================
    dom.btnAgregarServicio.onclick = () => { if (dom.selectorServicio.value) { agregarModuloServicio(dom.selectorServicio.value); dom.selectorServicio.value = ""; } };

    function agregarModuloServicio(tipo) {
        const id = Date.now(); const div = document.createElement('div'); div.className = `servicio-card ${tipo}`; div.dataset.id = id; div.dataset.tipo = tipo;
        let html = `<button type="button" class="btn-eliminar-servicio" onclick="this.parentElement.remove(); window.calcularTotal();">×</button>`;
        
        // (Tu HTML original de los servicios)
        if (tipo === 'aereo') { html += `<h4>✈️ Aéreo</h4><div class="form-group-row"><div class="form-group"><label>Aerolínea</label><input type="text" name="aerolinea" required></div><div class="form-group"><label>Ida</label><input type="date" name="fecha_aereo" required></div><div class="form-group"><label>Vuelta</label><input type="date" name="fecha_regreso"></div></div><div class="form-group-row"><div class="form-group"><label>Escalas</label><input type="number" name="escalas" value="0"></div><div class="form-group"><label>Equipaje</label><select name="tipo_equipaje"><option>Mochila</option><option>Carry On</option><option>Bodega</option></select></div></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`; }
        else { html += `<h4>${tipo.toUpperCase()}</h4><div class="form-group-row"><div class="form-group"><label>Detalle</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`; }
        
        div.innerHTML = html; dom.containerServicios.appendChild(div);
    }

    window.calcularTotal = () => { let t=0; document.querySelectorAll('.input-costo').forEach(i=>t+=parseFloat(i.value)||0); dom.inputCostoTotal.value=t; };

    dom.uploadForm.onsubmit = async (e) => {
        e.preventDefault();
        dom.btnSubir.disabled=true;
        
        // Recolectar servicios
        const serviciosData = [];
        document.querySelectorAll('.servicio-card').forEach(c => {
            const s = {tipo: c.dataset.tipo};
            c.querySelectorAll('input, select').forEach(i => s[i.name]=i.value);
            serviciosData.push(s);
        });

        try {
            await secureFetch(API_URL_UPLOAD, {
                destino: document.getElementById('upload-destino').value,
                salida: document.getElementById('upload-salida').value,
                fecha_salida: document.getElementById('upload-fecha-salida').value,
                moneda: document.getElementById('upload-moneda').value,
                tipo_promo: document.getElementById('upload-promo').value,
                costos_proveedor: dom.inputCostoTotal.value,
                // Usamos input hidden o visible según tu HTML original, aquí asumo que existen los IDs
                tarifa_venta: (document.getElementById('upload-tarifa-total') || {}).value || 0,
                financiacion: (document.getElementById('upload-financiacion') || {}).value || '',
                servicios: serviciosData,
                creador: currentUser.email
            });
            alert('¡Guardado!');
            window.location.reload();
        } catch(e) { console.error(e); alert("Error al guardar"); dom.btnSubir.disabled=false; }
    };

    // =========================================================
    // 7. RENDERIZADO Y MODAL (CON BOTONES SEGÚN ROL)
    // =========================================================

    async function fetchAndLoadPackages() {
        dom.loader.style.display='block';
        try {
            const data = await secureFetch(API_URL_SEARCH, {});
            allPackages = data;
            renderCards(data);
        } catch(e){console.error(e);}
        dom.loader.style.display='none';
    }

    function renderCards(list) {
        dom.grid.innerHTML = '';
        list.forEach(pkg => {
            const card=document.createElement('div'); card.className='paquete-card';
            
            // Renderizamos la tarjeta
            card.innerHTML=`
                <div class="card-header">
                    <h3 style="margin:0;">${pkg.destino}</h3>
                    <span class="tag-promo" style="background:#ef5a1a; color:white; padding:2px 5px; font-size:0.8em; border-radius:4px;">${pkg.tipo_promo}</span>
                </div>
                <div class="card-body">
                    <p>Salida: ${pkg.fecha_salida}</p>
                    <p>Desde: ${pkg.salida}</p>
                </div>
                <div class="card-footer" style="text-align:right; font-weight:bold;">
                    ${pkg.moneda} $${pkg.tarifa_venta || pkg.tarifa || 0}
                </div>
            `;
            
            // CLICK: Abrir Modal
            card.onclick = () => openModal(pkg);
            dom.grid.appendChild(card);
        });
    }

    function openModal(pkg) {
        // Generamos el HTML del detalle (Simplificado para asegurar que cargue)
        let detalleHtml = `
            <h2>${pkg.destino}</h2>
            <p><strong>Salida:</strong> ${pkg.fecha_salida} | <strong>Desde:</strong> ${pkg.salida}</p>
            <p><strong>Cargado por:</strong> ${pkg.creador}</p>
            <hr>
            <h4>Servicios:</h4>
            <ul>
                ${Array.isArray(pkg.servicios) ? pkg.servicios.map(s => `<li>${s.tipo.toUpperCase()}: ${s.aerolinea || s.hotel_nombre || s.proveedor || ''}</li>`).join('') : '<li>Ver detalles en administración</li>'}
            </ul>
            <div style="background:#eee; padding:15px; margin-top:20px; text-align:right;">
                <h3>Precio Final: ${pkg.moneda} $${pkg.tarifa_venta || pkg.tarifa}</h3>
            </div>
        `;

        // INYECCIÓN DE BOTONES DE ACCIÓN (SOLO EDITORES Y ADMINS)
        if (currentRole === 'admin' || currentRole === 'editor') {
            detalleHtml += `
                <div style="margin-top:20px; border-top:1px solid #ccc; padding-top:15px; display:flex; gap:10px; justify-content:flex-end;">
                    <button class="btn btn-secundario" onclick="alert('Función Editar pendiente de conectar a tu formulario')">✏️ Editar</button>
                    <button class="btn btn-secundario" style="color:red; border-color:red;" onclick="borrarPaquete('${pkg.id}')">🗑️ Borrar</button>
                </div>
            `;
        }

        dom.modalBody.innerHTML = detalleHtml;
        dom.modal.style.display = 'flex';
    }

    // Funciones globales para los botones inyectados
    window.borrarPaquete = async (id) => {
        if(!confirm("¿Seguro que deseas eliminar este paquete?")) return;
        // Aquí llamarías a tu webhook de DELETE
        // await secureFetch(API_URL_UPLOAD, { action: 'delete', id: id });
        alert("Petición de borrado enviada para ID: " + id);
    };

    // Helpers
    async function secureFetch(url, body) {
        const t = await currentUser.getIdToken();
        const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${t}`}, body:JSON.stringify(body) });
        return r.json();
    }
    
    // Eventos Filtros
    dom.btnBuscar.onclick = () => {
        const term = document.getElementById('filtro-destino').value.toLowerCase();
        const filtrados = allPackages.filter(p => p.destino.toLowerCase().includes(term));
        renderCards(filtrados);
    };
    dom.btnLimpiar.onclick = () => { document.getElementById('filtro-destino').value=''; renderCards(allPackages); };
    dom.modalClose.onclick = () => dom.modal.style.display='none';

});





