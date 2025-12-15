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

    // 2. INICIALIZACIÓN
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
        btnBuscar: document.getElementById('boton-buscar'), btnLimpiar: document.getElementById('boton-limpiar'),
        uploadForm: document.getElementById('upload-form'), uploadStatus: document.getElementById('upload-status'), btnSubir: document.getElementById('boton-subir'),
        containerServicios: document.getElementById('servicios-container'), btnAgregarServicio: document.getElementById('btn-agregar-servicio'), selectorServicio: document.getElementById('selector-servicio'),
        inputCostoTotal: document.getElementById('upload-costo-total'), inputFechaViaje: document.getElementById('upload-fecha-salida'),
        modal: document.getElementById('modal-detalle'), modalBody: document.getElementById('modal-body'), modalClose: document.getElementById('modal-cerrar'),
        // Header de acciones del modal
        modalHeaderActions: document.getElementById('modal-header-actions'),
        
        // Admin UI
        listaUsuarios: document.getElementById('lista-usuarios-body'), btnNuevoUsuario: document.getElementById('btn-nuevo-usuario'),
        modalUsuario: document.getElementById('modal-usuario'), formUsuario: document.getElementById('form-usuario'), btnCerrarUserModal: document.getElementById('btn-cerrar-user-modal'), inputAdminEmail: document.getElementById('admin-user-email'), inputAdminRole: document.getElementById('admin-user-role')
    };

    if(dom.logo) dom.logo.onclick = () => window.location.reload();

    // 3. AUTENTICACIÓN ESTRICTA Y ROLES
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Verificar si el usuario está en la BD
            const roleData = await verificarAcceso(user.email);
            
            if (roleData) {
                // ACCESO PERMITIDO
                currentUser = user;
                currentRole = roleData; // 'usuario', 'editor', 'admin'
                
                dom.loginContainer.style.display = 'none';
                dom.appContainer.style.display = 'block';
                dom.userLabel.textContent = user.email;

                setupUIByRole();
                // AQUÍ ESTABA EL ERROR: Cargamos paquetes para TODOS los que entran
                await fetchAndLoadPackages(); 
                showView('search');
            } else {
                alert("Acceso denegado: Usuario no registrado.");
                auth.signOut();
            }
        } else {
            currentUser = null;
            dom.loginContainer.style.display = 'flex';
            dom.appContainer.style.display = 'none';
        }
    });

    async function verificarAcceso(email) {
        if (email === SUPER_ADMIN) return 'admin';
        try {
            const doc = await db.collection('usuarios').doc(email).get();
            if (doc.exists) {
                // Si el documento existe, devolvemos el rol (o 'usuario' por defecto)
                return doc.data().role || 'usuario';
            }
        } catch (e) { console.error(e); }
        return null; // No existe -> Bloqueado
    }

    function setupUIByRole() {
        // Todos los registrados ven Cargar
        dom.navUpload.style.display = 'inline-block';
        
        // Solo Admin ve Usuarios
        dom.navUsers.style.display = (currentRole === 'admin') ? 'inline-block' : 'none';
    }

    // Login
    dom.btnLoginGoogle.onclick = () => auth.signInWithPopup(provider).catch(e => dom.authError.textContent = e.message);
    dom.loginEmailForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await auth.signInWithEmailAndPassword(document.getElementById('login-email').value, document.getElementById('login-pass').value);
        } catch (err) { dom.authError.textContent = "Credenciales incorrectas."; }
    };
    dom.btnLogout.onclick = () => auth.signOut();

    // 4. GESTIÓN USUARIOS (Solo Admin)
    async function cargarTablaUsuarios() {
        if (currentRole !== 'admin') return;
        dom.listaUsuarios.innerHTML = '<tr><td colspan="3">Cargando...</td></tr>';
        const snap = await db.collection('usuarios').get();
        dom.listaUsuarios.innerHTML = '';
        snap.forEach(doc => {
            const d = doc.data();
            let color = 'bg-blue';
            if (d.role === 'editor') color = 'bg-green';
            if (d.role === 'admin') color = 'bg-orange';
            
            dom.listaUsuarios.innerHTML += `
                <tr>
                    <td>${doc.id}</td>
                    <td><span class="badge-permiso ${color}">${(d.role || 'usuario').toUpperCase()}</span></td>
                    <td>
                        <button class="btn btn-secundario btn-sm" onclick="window.editarUsuario('${doc.id}', '${d.role||'usuario'}')">Editar</button>
                        <button class="btn btn-secundario btn-sm" style="color:red;" onclick="window.borrarUsuario('${doc.id}')">Borrar</button>
                    </td>
                </tr>`;
        });
    }

    dom.formUsuario.onsubmit = async (e) => {
        e.preventDefault();
        const email = dom.inputAdminEmail.value.toLowerCase().trim();
        const role = dom.inputAdminRole.value;
        await db.collection('usuarios').doc(email).set({ role: role });
        alert("Usuario guardado.");
        dom.modalUsuario.style.display='none';
        cargarTablaUsuarios();
    };

    window.editarUsuario = (email, role) => {
        dom.inputAdminEmail.value = email;
        dom.inputAdminEmail.disabled = true;
        dom.inputAdminRole.value = role;
        dom.modalUsuario.style.display = 'flex';
    };
    window.borrarUsuario = async (email) => {
        if(confirm("¿Eliminar usuario?")) {
            await db.collection('usuarios').doc(email).delete();
            cargarTablaUsuarios();
        }
    };
    
    dom.btnNuevoUsuario.onclick = () => { dom.formUsuario.reset(); dom.inputAdminEmail.disabled = false; dom.modalUsuario.style.display = 'flex'; };
    dom.btnCerrarUserModal.onclick = () => dom.modalUsuario.style.display = 'none';

    // 5. NAVEGACIÓN
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

    // 6. CARGA PAQUETES (Formulario Original)
    dom.btnAgregarServicio.onclick = () => { if (dom.selectorServicio.value) { agregarModuloServicio(dom.selectorServicio.value); dom.selectorServicio.value = ""; } };

    // Función modificada para soportar pre-llenado en edición
    function agregarModuloServicio(tipo, data = null) {
        const id = Date.now() + Math.random(); 
        const div = document.createElement('div'); 
        div.className = `servicio-card ${tipo}`; div.dataset.id = id; div.dataset.tipo = tipo;
        
        let html = `<button type="button" class="btn-eliminar-servicio" onclick="this.parentElement.remove(); window.calcularTotal();">×</button>`;
        
        // Función helper para value
        const val = (name) => data ? (data[name] || '') : '';

        if (tipo === 'aereo') { 
            html += `<h4>✈️ Aéreo</h4><div class="form-group-row"><div class="form-group"><label>Aerolínea</label><input type="text" name="aerolinea" value="${val('aerolinea')}" required></div><div class="form-group"><label>Ida</label><input type="date" name="fecha_aereo" value="${val('fecha_aereo')}" required></div><div class="form-group"><label>Vuelta</label><input type="date" name="fecha_regreso" value="${val('fecha_regreso')}"></div></div><div class="form-group-row"><div class="form-group"><label>Escalas</label>${crearContadorHTML('escalas', val('escalas')||0)}</div><div class="form-group"><label>Equipaje</label><select name="tipo_equipaje"><option>Objeto Personal</option><option>Carry On</option><option>Carry On + Bodega</option><option>Bodega (15kg)</option><option>Bodega (23kg)</option></select></div></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" value="${val('proveedor')}" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" value="${val('costo')}" onchange="window.calcularTotal()" required></div></div>`; 
        }
        else if (tipo === 'hotel') { 
            html += `<h4>🏨 Hotel</h4><div class="form-group"><label>Alojamiento</label><input type="text" name="hotel_nombre" value="${val('hotel_nombre')}" required></div><div class="form-group-row"><div class="form-group"><label>Check In</label><input type="date" name="checkin" value="${val('checkin')}" onchange="window.calcularNoches('${id}')" required></div><div class="form-group"><label>Check Out</label><input type="date" name="checkout" value="${val('checkout')}" onchange="window.calcularNoches('${id}')" required></div><div class="form-group"><label>Noches</label><input type="text" id="noches-${id}" readonly style="background:#eee; width:60px;"></div></div><div class="form-group"><label>Régimen</label><select name="regimen"><option>Solo Habitación</option><option>Desayuno</option><option>Media Pensión</option><option>All Inclusive</option></select></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" value="${val('proveedor')}" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" value="${val('costo')}" onchange="window.calcularTotal()" required></div></div>`; 
        }
        else {
            // Generico para el resto
            html += `<h4>${tipo.toUpperCase()}</h4><div class="form-group-row"><div class="form-group"><label>Detalle/Prov</label><input type="text" name="proveedor" value="${val('proveedor')}" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" value="${val('costo')}" onchange="window.calcularTotal()" required></div></div>`;
        }
        
        div.innerHTML = html; 
        dom.containerServicios.appendChild(div);
        
        // Set selects values manually if editing
        if(data) {
            const selects = div.querySelectorAll('select');
            selects.forEach(s => { if(data[s.name]) s.value = data[s.name]; });
        }
    }

    window.crearContadorHTML = (n, v) => `<div class="counter-wrapper"><button type="button" class="counter-btn" onclick="this.nextElementSibling.innerText=Math.max(0,parseInt(this.nextElementSibling.innerText)-1)">-</button><span class="counter-value">${v}</span><button type="button" class="counter-btn" onclick="this.previousElementSibling.innerText=parseInt(this.previousElementSibling.innerText)+1">+</button><input type="hidden" name="${n}" value="${v}"></div>`;
    window.calcularNoches = (id) => { 
        // Lógica simple de noches
    }; 
    window.calcularTotal = () => { let t=0; document.querySelectorAll('.input-costo').forEach(i=>t+=parseFloat(i.value)||0); dom.inputCostoTotal.value=t; };

    // SUBMIT (Crear o Editar)
    dom.uploadForm.onsubmit = async (e) => {
        e.preventDefault();
        
        const isEdit = document.getElementById('edit-package-id').value !== "";
        const servicios = [];
        document.querySelectorAll('.servicio-card').forEach(c => {
            const s = {tipo: c.dataset.tipo};
            c.querySelectorAll('input, select').forEach(i => {
                if(i.type==='hidden') s[i.name] = i.parentElement.querySelector('.counter-value').innerText;
                else s[i.name] = i.value;
            });
            servicios.push(s);
        });

        const body = {
            action: isEdit ? 'edit' : 'create',
            id: document.getElementById('edit-package-id').value, // ID para editar/borrar
            destino: document.getElementById('upload-destino').value,
            salida: document.getElementById('upload-salida').value,
            fecha_salida: document.getElementById('upload-fecha-salida').value,
            moneda: document.getElementById('upload-moneda').value,
            tipo_promo: document.getElementById('upload-promo').value,
            costos_proveedor: document.getElementById('upload-costo-total').value,
            tarifa_venta: document.getElementById('upload-tarifa-total').value,
            financiacion: document.getElementById('upload-financiacion').value,
            servicios: servicios,
            creador: currentUser.email
        };

        dom.btnSubir.disabled=true; 
        try {
            await secureFetch(API_URL_ACTION, body);
            alert(isEdit ? "Paquete actualizado" : "Paquete creado");
            dom.uploadForm.reset();
            dom.containerServicios.innerHTML = '';
            document.getElementById('edit-package-id').value = ''; // Reset ID
            document.getElementById('boton-cancelar-edicion').style.display = 'none';
            document.getElementById('form-title').innerText = "Cargar Nuevo Paquete";
            document.getElementById('boton-subir').innerText = "Guardar Paquete";
            
            fetchAndLoadPackages();
            showView('search');
        } catch(e) { alert("Error: " + e.message); }
        dom.btnSubir.disabled=false;
    };

    // 7. RENDER Y MODAL
    async function fetchAndLoadPackages() {
        dom.loader.style.display='block';
        try {
            const data = await secureFetch(API_URL_SEARCH, {});
            allPackages = data;
            renderCards(data); // Render inicial sin filtros
        } catch(e){}
        dom.loader.style.display='none';
    }

    function renderCards(list) {
        dom.grid.innerHTML = '';
        list.forEach(pkg => {
            const card=document.createElement('div'); card.className='paquete-card';
            
            // Guardamos el objeto completo en el elemento para usarlo luego
            // (Evitamos stringify en dataset para no romper caracteres raros)
            card.onclick = () => openModal(pkg);

            card.innerHTML=`<div class="card-header"><span class="tag-promo">${pkg.tipo_promo}</span><h3>${pkg.destino}</h3></div><div class="card-body"><p>Salida: ${formatDateAR(pkg.fecha_salida)}</p></div><div class="card-footer"><p class="precio-valor">${pkg.moneda} $${formatMoney(pkg.tarifa_venta)}</p></div>`;
            dom.grid.appendChild(card);
        });
    }

    function openModal(pkg) {
        // Renderizar contenido
        // ... (Usa tu función renderServiciosClienteHTML aquí, o la lógica básica)
        const htmlServicios = `<ul>${(Array.isArray(pkg.servicios) ? pkg.servicios : []).map(s=>`<li>${s.tipo.toUpperCase()}</li>`).join('')}</ul>`;
        
        dom.modalBody.innerHTML = `
            <div class="modal-detalle-header"><h2>${pkg.destino}</h2></div>
            <div style="padding:20px;">
                <p>Fecha: ${pkg.fecha_salida}</p>
                <p>Precio: ${pkg.moneda} ${pkg.tarifa_venta}</p>
                ${htmlServicios}
            </div>
        `;

        // INYECTAR BOTONES (Solo si es Editor o Admin)
        const headerActions = document.getElementById('modal-header-actions');
        headerActions.innerHTML = ''; // Limpiar
        
        if (currentRole === 'editor' || currentRole === 'admin') {
            // Botón Editar
            const btnEdit = document.createElement('button');
            btnEdit.className = 'btn-action-modal';
            btnEdit.innerHTML = '✏️ Editar';
            btnEdit.onclick = () => prepararEdicion(pkg);
            
            // Botón Borrar
            const btnDel = document.createElement('button');
            btnDel.className = 'btn-action-modal delete';
            btnDel.innerHTML = '🗑️ Borrar';
            btnDel.onclick = () => borrarPaquete(pkg.id);

            headerActions.appendChild(btnEdit);
            headerActions.appendChild(btnDel);
        }

        dom.modal.style.display = 'flex';
    }

    // Funciones de acción
    window.prepararEdicion = (pkg) => {
        dom.modal.style.display = 'none';
        showView('upload');
        
        document.getElementById('form-title').innerText = "Editando Paquete";
        document.getElementById('boton-subir').innerText = "Actualizar";
        document.getElementById('boton-cancelar-edicion').style.display = 'inline-block';
        document.getElementById('edit-package-id').value = pkg.id; // IMPORTANTE

        // Llenar campos simples
        document.getElementById('upload-destino').value = pkg.destino;
        document.getElementById('upload-salida').value = pkg.salida;
        document.getElementById('upload-fecha-salida').value = pkg.fecha_salida;
        document.getElementById('upload-moneda').value = pkg.moneda;
        document.getElementById('upload-promo').value = pkg.tipo_promo;
        document.getElementById('upload-financiacion').value = pkg.financiacion;

        // Llenar servicios
        dom.containerServicios.innerHTML = '';
        const servs = typeof pkg.servicios === 'string' ? JSON.parse(pkg.servicios) : pkg.servicios;
        if(Array.isArray(servs)) servs.forEach(s => agregarModuloServicio(s.tipo, s));
        
        window.calcularTotal();
    };

    window.borrarPaquete = async (id) => {
        if(!confirm("¿Seguro que deseas borrar este paquete?")) return;
        try {
            await secureFetch(API_URL_ACTION, { action: 'delete', id: id });
            alert("Paquete borrado.");
            dom.modal.style.display = 'none';
            fetchAndLoadPackages();
        } catch(e) { alert(e.message); }
    };

    // Botón cancelar edición
    document.getElementById('boton-cancelar-edicion').onclick = () => {
        dom.uploadForm.reset();
        dom.containerServicios.innerHTML = '';
        document.getElementById('edit-package-id').value = '';
        document.getElementById('boton-cancelar-edicion').style.display = 'none';
        document.getElementById('form-title').innerText = "Cargar Nuevo Paquete";
        document.getElementById('boton-subir').innerText = "Guardar Paquete";
    };

    // Helpers
    async function secureFetch(url, body) {
        const t = await currentUser.getIdToken();
        const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${t}`}, body:JSON.stringify(body) });
        return r.json();
    }
    const formatMoney = (a) => new Intl.NumberFormat('es-AR', { style: 'decimal' }).format(a);
    const formatDateAR = (s) => s ? s.split('-').reverse().join('/') : '-';
    dom.modalClose.onclick = () => dom.modal.style.display='none';
});


