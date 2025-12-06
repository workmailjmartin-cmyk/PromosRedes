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

    // TU LISTA DE INVITADOS (Emails permitidos)
    const allowedEmails = [
        'yairlaquis@gmail.com'
    ];

firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const provider = new firebase.auth.GoogleAuthProvider();
    
    let currentUser = null;
    let allPackages = [];

    // Referencias DOM
    const dom = {
        // ... (Mismas referencias básicas) ...
        viewSearch: document.getElementById('view-search'),
        viewUpload: document.getElementById('view-upload'),
        navSearch: document.getElementById('nav-search'),
        navUpload: document.getElementById('nav-upload'),
        grid: document.getElementById('grilla-paquetes'),
        loader: document.getElementById('loading-placeholder'),
        uploadForm: document.getElementById('upload-form'),
        uploadStatus: document.getElementById('upload-status'),
        btnSubir: document.getElementById('boton-subir'),
        containerServicios: document.getElementById('servicios-container'),
        btnAgregarServicio: document.getElementById('btn-agregar-servicio'),
        selectorServicio: document.getElementById('selector-servicio'),
        inputCostoTotal: document.getElementById('upload-costo-total'),
        modal: document.getElementById('modal-detalle'),
        modalBody: document.getElementById('modal-body'),
        modalClose: document.getElementById('modal-cerrar'),
        btnLogin: document.getElementById('login-button'),
        btnLogout: document.getElementById('logout-button'),
        userEmail: document.getElementById('user-email'),
        authError: document.getElementById('auth-error'),
        loginContainer: document.getElementById('login-container'),
        appContainer: document.getElementById('app-container'),
        btnBuscar: document.getElementById('boton-buscar'),
        btnLimpiar: document.getElementById('boton-limpiar')
    };

    // ... (Lógica de Auth y SecureFetch IGUAL que antes, no cambia) ...
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            if (allowedEmails.includes(user.email)) {
                currentUser = user;
                dom.loginContainer.style.display = 'none';
                dom.appContainer.style.display = 'block';
                dom.userEmail.textContent = user.email;
                await fetchPackages(); 
                showView('search');
            } else {
                dom.authError.textContent = 'Acceso denegado.';
                auth.signOut();
            }
        } else {
            currentUser = null;
            dom.loginContainer.style.display = 'flex';
            dom.appContainer.style.display = 'none';
        }
    });

    dom.btnLogin.addEventListener('click', () => auth.signInWithPopup(provider));
    dom.btnLogout.addEventListener('click', () => auth.signOut());

    async function secureFetch(url, bodyData) {
        if (!currentUser) throw new Error('No auth');
        const token = await currentUser.getIdToken(true);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(bodyData),
            cache: 'no-store'
        });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const text = await response.text();
        return text ? JSON.parse(text) : [];
    }

    // =========================================================
    // LÓGICA DE CARGA (FORMULARIO DINÁMICO CORREGIDO)
    // =========================================================

    dom.btnAgregarServicio.addEventListener('click', () => {
        const tipo = dom.selectorServicio.value;
        if (!tipo) return;
        agregarModuloServicio(tipo);
        dom.selectorServicio.value = "";
    });

    function agregarModuloServicio(tipo) {
        const idUnico = Date.now();
        const div = document.createElement('div');
        div.className = `servicio-card ${tipo}`;
        div.dataset.id = idUnico;
        div.dataset.tipo = tipo;

        let html = `<button type="button" class="btn-eliminar-servicio" onclick="this.parentElement.remove(); window.calcularTotal();">×</button>`;
        const fechaViaje = document.getElementById('upload-fecha-salida').value || '';

        // --- PLANTILLAS HTML CORREGIDAS (Con Emojis Reales) ---
        if (tipo === 'aereo') {
            html += `
                <h4>✈️ Aéreo</h4>
                <div class="form-group-row">
                    <div class="form-group"><label>Compañía Aérea</label><input type="text" name="aerolinea" required></div>
                    <div class="form-group"><label>Fecha Salida</label><input type="date" name="fecha_aereo" value="${fechaViaje}" required></div>
                </div>
                <div class="form-group-row">
                    <div class="form-group"><label>Escalas</label>${crearContadorHTML('escalas', 0)}</div>
                    <div class="form-group"><label>Equipaje</label>
                        <select name="tipo_equipaje" onchange="mostrarContadorEquipaje(this, ${idUnico})">
                            <option value="Objeto Personal">Objeto Personal</option>
                            <option value="Carry On">Carry On</option>
                            <option value="Carry On + Bodega">Carry On + Bodega</option> <option value="Bodega Chico">Bodega (15kg)</option>
                            <option value="Bodega Grande">Bodega (23kg)</option>
                        </select>
                        <div id="equipaje-cantidad-${idUnico}" style="display:none; margin-top:5px;">
                            <label style="font-size:0.8em">Cant:</label>${crearContadorHTML('cantidad_equipaje', 1)}
                        </div>
                    </div>
                </div>
                <div class="form-group-row">
                    <div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div>
                    <div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div>
                </div>
                <div class="form-group"><label>Obs</label><input type="text" name="obs"></div>
            `;
        } else if (tipo === 'hotel') {
            html += `
                <h4>🏨 Hotel</h4>
                <div class="form-group"><label>Alojamiento</label><input type="text" name="hotel_nombre" required></div>
                <div class="form-group-row">
                    <div class="form-group"><label>Check In</label><input type="date" name="checkin" onchange="window.calcularNoches(${idUnico})" required></div>
                    <div class="form-group"><label>Check Out</label><input type="date" name="checkout" onchange="window.calcularNoches(${idUnico})" required></div>
                    <div class="form-group"><label>Noches</label><input type="text" id="noches-${idUnico}" readonly style="background:#eee; width:60px;"></div>
                </div>
                <div class="form-group"><label>Régimen</label><select name="regimen"><option>Solo Habitación</option><option>Desayuno</option><option>Media Pensión</option><option>All Inclusive</option></select></div>
                <div class="form-group-row">
                    <div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div>
                    <div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div>
                </div>
                <div class="form-group"><label>Obs</label><input type="text" name="obs"></div>
            `;
        } else if (tipo === 'traslado') {
            html += `
                <h4>🚌 Traslado</h4> <div class="checkbox-group">
                    <label class="checkbox-label"><input type="checkbox" name="trf_in"> In</label>
                    <label class="checkbox-label"><input type="checkbox" name="trf_out"> Out</label>
                    <label class="checkbox-label"><input type="checkbox" name="trf_hotel"> Hotel-Hotel</label>
                </div>
                <div class="form-group" style="margin-top:10px;">
                    <label>Tipo</label><select name="tipo_trf"><option>Compartido</option><option>Privado</option></select>
                </div>
                <div class="form-group-row">
                    <div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div>
                    <div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div>
                </div>
                <div class="form-group"><label>Proveedor Extra?</label><input type="text" name="proveedor_extra" placeholder="Nombre y Costo"></div>
            `;
        } else if (tipo === 'seguro') {
            html += `
                <h4>🛡️ Seguro</h4> <div class="form-group-row">
                    <div class="form-group"><label>Cobertura/Proveedor</label><input type="text" name="proveedor" required></div>
                    <div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div>
                </div>
            `;
        } else if (tipo === 'adicional') {
            html += `
                <h4>➕ Adicional</h4>
                <div class="form-group"><label>Nombre del Servicio</label><input type="text" name="descripcion" required></div>
                <div class="form-group-row">
                    <div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div>
                    <div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div>
                </div>
            `;
        }

        div.innerHTML = html;
        dom.containerServicios.appendChild(div);
    }

    // Helpers UI
    window.crearContadorHTML = (n, v) => `<div class="counter-wrapper"><button type="button" class="counter-btn" onclick="this.nextElementSibling.innerText = Math.max(0, parseInt(this.nextElementSibling.innerText)-1)">-</button><span class="counter-value">${v}</span><button type="button" class="counter-btn" onclick="this.previousElementSibling.innerText = parseInt(this.previousElementSibling.innerText)+1">+</button><input type="hidden" name="${n}" value="${v}"></div>`;
    window.mostrarContadorEquipaje = (s, id) => document.getElementById(`equipaje-cantidad-${id}`).style.display = (s.value === 'Objeto Personal') ? 'none' : 'block';
    
    window.calcularNoches = (id) => {
        const card = document.querySelector(`.servicio-card[data-id="${id}"]`);
        const i = new Date(card.querySelector('input[name="checkin"]').value), o = new Date(card.querySelector('input[name="checkout"]').value);
        document.getElementById(`noches-${id}`).value = (i&&o&&o>i) ? Math.ceil((o-i)/86400000) : '-';
    };
    window.calcularTotal = () => {
        let t = 0; document.querySelectorAll('.input-costo').forEach(i => t += parseFloat(i.value)||0); dom.inputCostoTotal.value = t;
    };

    // ENVÍO DE FORMULARIO (Arreglado para no fallar si falta descripción)
    dom.uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        dom.btnSubir.disabled = true;
        dom.uploadStatus.textContent = 'Guardando...';
        
        const newPackage = {
            destino: document.getElementById('upload-destino').value,
            salida: document.getElementById('upload-salida').value,
            fecha_salida: document.getElementById('upload-fecha-salida').value,
            costos_proveedor: document.getElementById('upload-costo-total').value,
            tarifa: document.getElementById('upload-tarifa-total').value,
            moneda: document.getElementById('upload-moneda').value,
            tipo_promo: document.getElementById('upload-promo').value,
            financiacion: document.getElementById('upload-financiacion').value,
            descripcion: "", // Ya no usamos descripción global
            servicios: []
        };

        document.querySelectorAll('.servicio-card').forEach(card => {
            const serv = { tipo: card.dataset.tipo };
            card.querySelectorAll('input, select').forEach(input => {
                if (input.type === 'checkbox') serv[input.name] = input.checked;
                else if (input.type === 'hidden') {
                    const span = input.parentElement.querySelector('.counter-value');
                    serv[input.name] = span ? span.innerText : input.value;
                } else {
                    serv[input.name] = input.value;
                }
            });
            newPackage.servicios.push(serv);
        });

        try {
            await secureFetch(API_URL_UPLOAD, newPackage);
            dom.uploadStatus.textContent = '¡Guardado!';
            dom.uploadStatus.className = 'status-message success';
            dom.uploadForm.reset();
            dom.containerServicios.innerHTML = '';
            fetchPackages();
        } catch (error) {
            console.error(error);
            dom.uploadStatus.textContent = 'Error al guardar.';
            dom.uploadStatus.className = 'status-message error';
        } finally {
            dom.btnSubir.disabled = false;
        }
    });

    // =========================================================
    // RENDERIZADO Y MODAL (MEJORADO)
    // =========================================================

    function renderServiciosHTML(jsonStr) {
        if (!jsonStr) return '<p>Sin detalles.</p>';
        let servicios = [];
        try { servicios = JSON.parse(jsonStr); } catch (e) { return '<p>Error datos.</p>'; }

        let html = '';
        servicios.forEach(s => {
            let icono = '🔹', titulo = '', lineas = [];

            if (s.tipo === 'aereo') {
                icono = '✈️'; titulo = 'AÉREO';
                lineas.push(`<b>Aerolínea:</b> ${s.aerolinea}`);
                lineas.push(`<b>Fecha:</b> ${formatDateAR(s.fecha_aereo)}`);
                lineas.push(`<b>Escalas:</b> ${s.escalas}`);
                lineas.push(`<b>Equipaje:</b> ${s.tipo_equipaje} (x${s.cantidad_equipaje || 1})`);
            } else if (s.tipo === 'hotel') {
                icono = '🏨'; titulo = 'HOTEL';
                lineas.push(`<b>Alojamiento:</b> ${s.hotel_nombre}`);
                // Calculo de noches para mostrar en el modal
                let noches = '-';
                if(s.checkin && s.checkout) {
                    const d1 = new Date(s.checkin), d2 = new Date(s.checkout);
                    noches = Math.ceil((d2 - d1) / 86400000);
                }
                lineas.push(`<b>Estadía:</b> ${noches} noches (${formatDateAR(s.checkin)} al ${formatDateAR(s.checkout)})`);
                lineas.push(`<b>Régimen:</b> ${s.regimen}`);
            } else if (s.tipo === 'traslado') {
                icono = '🚌'; titulo = 'TRASLADO';
                let tramos = [];
                if(s.trf_in) tramos.push("In"); if(s.trf_out) tramos.push("Out"); if(s.trf_hotel) tramos.push("Hotel-Hotel");
                lineas.push(`<b>Tramos:</b> ${tramos.join(' + ') || '-'}`);
                lineas.push(`<b>Tipo:</b> ${s.tipo_trf}`);
                if(s.proveedor_extra) lineas.push(`<b>Extra:</b> ${s.proveedor_extra}`);
            } else if (s.tipo === 'seguro') {
                icono = '🛡️'; titulo = 'SEGURO';
                lineas.push(`<b>Cobertura:</b> ${s.proveedor}`);
            } else if (s.tipo === 'adicional') {
                icono = '➕'; titulo = 'ADICIONAL';
                lineas.push(`<b>Servicio:</b> ${s.descripcion}`); // Ahora muestra el nombre del servicio
            }

            if(s.obs) lineas.push(`<i>Nota: ${s.obs}</i>`);

            // Diseño en Lista (uno debajo del otro)
            html += `<div style="margin-bottom:15px; border-left:4px solid #ddd; padding-left:12px;">
                <div style="color:#11173d; font-weight:bold; margin-bottom:4px;">${icono} ${titulo}</div>
                ${lineas.map(l => `<div style="font-size:0.9em; color:#555; margin-bottom:2px;">${l}</div>`).join('')}
            </div>`;
        });
        return html;
    }

    // Helper fechas
    function formatDateAR(s) { if(!s)return'-'; const p=s.split('-'); return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:s; }

    // Render Cards (Tarifa dividida por 2)
    function renderCards(list) {
        dom.loader.style.display = 'none';
        dom.grid.innerHTML = '';
        if (!list || list.length === 0) { dom.grid.innerHTML = '<p>No se encontraron paquetes.</p>'; return; }
        
        list.forEach(pkg => {
            const card = document.createElement('div');
            card.className = 'paquete-card';
            card.dataset.packageData = JSON.stringify(pkg);
            
            // TARIFA / 2
            let precio = parseFloat(pkg['tarifa']) || 0;
            precio = Math.round(precio / 2);

            card.innerHTML = `
                <div class="card-header"><h3>${pkg['destino']}</h3><span class="tag-promo">${pkg['tipo_promo']}</span></div>
                <div class="card-body"><p><strong>Salida:</strong> ${formatDateAR(pkg['fecha_salida'])}</p></div>
                <div class="card-footer"><p class="precio-valor">${pkg['moneda']} $${precio}</p></div>
            `;
            dom.grid.appendChild(card);
        });
    }

    function openModal(pkg) {
        const serviciosHTML = renderServiciosHTML(pkg['servicios']);
        dom.modalBody.innerHTML = `
            <div class="modal-detalle-header"><h2>${pkg['destino']}</h2></div>
            <div class="modal-detalle-body">
                <div class="detalle-full precio-final"><label>Precio Venta</label><p>${pkg['moneda']} $${pkg['tarifa']}</p></div>
                <div class="detalle-item"><label>Fecha Salida</label><p>${formatDateAR(pkg['fecha_salida'])}</p></div>
                <div class="detalle-item"><label>Lugar</label><p>${pkg['salida']}</p></div>
                <div class="detalle-full"><h4 style="border-bottom:1px solid #eee; margin-bottom:10px;">Detalle de Servicios</h4>${serviciosHTML}</div>
                ${pkg['financiacion'] ? `<div class="detalle-full" style="background:#e3f2fd; padding:10px; border-radius:5px;"><b>Financiación:</b> ${pkg['financiacion']}</div>` : ''}
                <div class="detalle-item" style="margin-top:20px; border:none; text-align:right;"><small>Cargado Por: ${pkg['creador']}</small></div>
            </div>
        `;
        dom.modal.style.display = 'flex';
    }

    // Navegación
    function showView(name) {
        dom.viewSearch.classList.toggle('active', name === 'search');
        dom.viewUpload.classList.toggle('active', name === 'upload');
        dom.navSearch.classList.toggle('active', name === 'search');
        dom.navUpload.classList.toggle('active', name === 'upload');
    }
    dom.navSearch.onclick = () => showView('search');
    dom.navUpload.onclick = () => showView('upload');
    dom.grid.addEventListener('click', e => { if(e.target.closest('.paquete-card')) openModal(JSON.parse(e.target.closest('.paquete-card').dataset.packageData)); });
    dom.modalClose.onclick = () => dom.modal.style.display = 'none';
    window.onclick = e => { if(e.target === dom.modal) dom.modal.style.display = 'none'; };
    
    // Fetch inicial
    async function fetchPackages(filters={}) {
        try {
            const data = await secureFetch(API_URL_SEARCH, { method:'POST', body:JSON.stringify(filters) });
            allPackages = data.sort((a,b) => (b['fecha_creacion']||'').localeCompare(a['fecha_creacion']||''));
            renderCards(allPackages);
        } catch(e) { console.error(e); }
    }
});

