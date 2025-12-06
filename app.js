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
        // ... (Mismas referencias que antes) ...
        viewSearch: document.getElementById('view-search'), viewUpload: document.getElementById('view-upload'),
        navSearch: document.getElementById('nav-search'), navUpload: document.getElementById('nav-upload'),
        grid: document.getElementById('grilla-paquetes'), loader: document.getElementById('loading-placeholder'),
        uploadForm: document.getElementById('upload-form'), uploadStatus: document.getElementById('upload-status'),
        btnSubir: document.getElementById('boton-subir'), containerServicios: document.getElementById('servicios-container'),
        btnAgregarServicio: document.getElementById('btn-agregar-servicio'), selectorServicio: document.getElementById('selector-servicio'),
        inputCostoTotal: document.getElementById('upload-costo-total'), modal: document.getElementById('modal-detalle'),
        modalBody: document.getElementById('modal-body'), modalClose: document.getElementById('modal-cerrar'),
        btnLogin: document.getElementById('login-button'), btnLogout: document.getElementById('logout-button'),
        userEmail: document.getElementById('user-email'), authError: document.getElementById('auth-error'),
        loginContainer: document.getElementById('login-container'), appContainer: document.getElementById('app-container'),
        btnBuscar: document.getElementById('boton-buscar'), btnLimpiar: document.getElementById('boton-limpiar'),
        inputFechaViaje: document.getElementById('upload-fecha-salida') // Nueva referencia
    };

    // --- AUTH & FETCH (Igual que antes) ---
    auth.onAuthStateChanged(async (user) => {
        if (user && allowedEmails.includes(user.email)) {
            currentUser = user;
            dom.loginContainer.style.display = 'none';
            dom.appContainer.style.display = 'block';
            dom.userEmail.textContent = user.email;
            await fetchPackages(); showView('search');
        } else {
            currentUser = null;
            if(user) { dom.authError.textContent = 'Acceso denegado.'; auth.signOut(); }
            dom.loginContainer.style.display = 'flex'; dom.appContainer.style.display = 'none';
        }
    });
    dom.btnLogin.addEventListener('click', () => auth.signInWithPopup(provider));
    dom.btnLogout.addEventListener('click', () => auth.signOut());

    async function secureFetch(url, bodyData) {
        if (!currentUser) throw new Error('No auth');
        const token = await currentUser.getIdToken(true);
        const response = await fetch(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(bodyData), cache: 'no-store'
        });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const text = await response.text(); return text ? JSON.parse(text) : [];
    }

    // =========================================================
    // LÓGICA DE CARGA (FORMULARIO DINÁMICO MEJORADO)
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
        const fechaViaje = dom.inputFechaViaje.value || '';

        // --- PLANTILLAS HTML ---
        if (tipo === 'aereo') {
            // AÉREO: Agregada fecha regreso
            html += `<h4>✈️ Aéreo</h4>
                <div class="form-group-row">
                    <div class="form-group"><label>Aerolínea</label><input type="text" name="aerolinea" required></div>
                    <div class="form-group"><label>Ida</label><input type="date" name="fecha_aereo" value="${fechaViaje}" onchange="validarFechas(this)" required></div>
                    <div class="form-group"><label>Regreso</label><input type="date" name="fecha_regreso" onchange="validarFechas(this)"></div>
                </div>
                <div class="form-group-row">
                    <div class="form-group"><label>Escalas</label>${crearContadorHTML('escalas', 0)}</div>
                    <div class="form-group"><label>Equipaje</label>
                        <select name="tipo_equipaje" onchange="mostrarContadorEquipaje(this, ${idUnico})">
                            <option>Objeto Personal</option><option>Carry On</option><option>Carry On + Bodega</option><option>Bodega (15kg)</option><option>Bodega (23kg)</option>
                        </select>
                        <div id="equipaje-cantidad-${idUnico}" style="display:none;"><label>Cant:</label>${crearContadorHTML('cantidad_equipaje', 1)}</div>
                    </div>
                </div>
                <div class="form-group-row">
                    <div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div>
                    <div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div>
                </div>
                <div class="form-group"><label>Obs</label><input type="text" name="obs"></div>`;
        
        } else if (tipo === 'hotel') {
            // HOTEL: Validaciones de fechas
            html += `<h4>🏨 Hotel</h4>
                <div class="form-group"><label>Alojamiento</label><input type="text" name="hotel_nombre" required></div>
                <div class="form-group-row">
                    <div class="form-group"><label>Check In</label><input type="date" name="checkin" onchange="validarHotel(${idUnico})" required></div>
                    <div class="form-group"><label>Check Out</label><input type="date" name="checkout" onchange="validarHotel(${idUnico})" required></div>
                    <div class="form-group"><label>Noches</label><input type="text" id="noches-${idUnico}" readonly style="background:#eee; width:60px;"></div>
                </div>
                <div class="form-group"><label>Régimen</label><select name="regimen"><option>Solo Habitación</option><option>Desayuno</option><option>Media Pensión</option><option>All Inclusive</option></select></div>
                <div class="form-group-row">
                    <div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div>
                    <div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div>
                </div>
                <div class="form-group"><label>Obs</label><input type="text" name="obs"></div>`;
        } 
        // ... (Traslado, Seguro, Adicional iguales que antes, solo asegúrate de copiar el código completo) ...
        // (Por brevedad, asumo que copias los otros bloques `else if` del código anterior aquí)
        else if (tipo === 'traslado') { html += `<h4>🚌 Traslado</h4><div class="checkbox-group"><label class="checkbox-label"><input type="checkbox" name="trf_in"> In</label><label class="checkbox-label"><input type="checkbox" name="trf_out"> Out</label></div><div class="form-group-row" style="margin-top:10px;"><div class="form-group"><label>Tipo</label><select name="tipo_trf"><option>Compartido</option><option>Privado</option></select></div><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`; }
        else if (tipo === 'seguro') { html += `<h4>🛡️ Seguro</h4><div class="form-group-row"><div class="form-group"><label>Cobertura</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`; }
        else if (tipo === 'adicional') { html += `<h4>➕ Adicional</h4><div class="form-group"><label>Detalle</label><input type="text" name="descripcion" required></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`; }

        div.innerHTML = html;
        dom.containerServicios.appendChild(div);
    }

    // --- NUEVAS VALIDACIONES ---

    window.validarFechas = (input) => {
        const fechaViaje = new Date(dom.inputFechaViaje.value);
        const fechaServicio = new Date(input.value);
        if (fechaServicio < fechaViaje) {
            alert("La fecha del servicio no puede ser anterior a la salida del viaje.");
            input.value = ""; // Limpiar
        }
    };

    window.validarHotel = (id) => {
        const card = document.querySelector(`.servicio-card[data-id="${id}"]`);
        const inInput = card.querySelector('input[name="checkin"]');
        const outInput = card.querySelector('input[name="checkout"]');
        
        window.validarFechas(inInput); // Validar vs fecha viaje
        if (!outInput.value) return;

        const d1 = new Date(inInput.value);
        const d2 = new Date(outInput.value);

        if (d2 <= d1) {
            alert("El Check-out debe ser posterior al Check-in.");
            outInput.value = "";
            document.getElementById(`noches-${id}`).value = "-";
        } else {
            document.getElementById(`noches-${id}`).value = Math.ceil((d2 - d1) / 86400000);
        }
    };

    // Helpers UI (Contadores, etc.)
    window.crearContadorHTML = (n, v) => `<div class="counter-wrapper"><button type="button" class="counter-btn" onclick="this.nextElementSibling.innerText = Math.max(0, parseInt(this.nextElementSibling.innerText)-1)">-</button><span class="counter-value">${v}</span><button type="button" class="counter-btn" onclick="this.previousElementSibling.innerText = parseInt(this.previousElementSibling.innerText)+1">+</button><input type="hidden" name="${n}" value="${v}"></div>`;
    window.mostrarContadorEquipaje = (s, id) => document.getElementById(`equipaje-cantidad-${id}`).style.display = (s.value === 'Objeto Personal') ? 'none' : 'block';
    window.calcularTotal = () => { let t = 0; document.querySelectorAll('.input-costo').forEach(i => t += parseFloat(i.value)||0); dom.inputCostoTotal.value = t; };

    // Envío del Formulario
    dom.uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        dom.btnSubir.disabled = true;
        dom.uploadStatus.textContent = 'Guardando...';
        
        const newPackage = {
            destino: document.getElementById('upload-destino').value,
            salida: document.getElementById('upload-salida').value,
            fecha_salida: document.getElementById('upload-fecha-salida').value,
            moneda: document.getElementById('upload-moneda').value,
            tipo_promo: document.getElementById('upload-promo').value,
            financiacion: document.getElementById('upload-financiacion').value,
            costo_total: document.getElementById('upload-costo-total').value,
            tarifa_venta: document.getElementById('upload-tarifa-total').value,
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
            dom.uploadStatus.textContent = 'Error al guardar.';
            dom.uploadStatus.className = 'status-message error';
        } finally {
            dom.btnSubir.disabled = false;
        }
    });

    // =========================================================
    // 7. INTERFAZ (RENDER TARJETAS - con Duración)
    // =========================================================

    function calculateDuration(pkg) {
        // Buscamos si hay servicios con fecha fin
        let maxDate = new Date(pkg['fecha_salida'].split('/').reverse().join('-')); // Fecha base
        let minDate = maxDate;
        let hasServices = false;

        try {
            const servicios = JSON.parse(pkg['servicios'] || '[]');
            servicios.forEach(s => {
                if (s.tipo === 'aereo' && s.fecha_regreso) {
                    const d = new Date(s.fecha_regreso);
                    if (d > maxDate) maxDate = d;
                    hasServices = true;
                }
                if (s.tipo === 'hotel' && s.checkout) {
                    const d = new Date(s.checkout);
                    if (d > maxDate) maxDate = d;
                    hasServices = true;
                }
            });
        } catch(e) {}

        if (!hasServices) return ''; // No mostrar nada si no hay datos

        const diffTime = Math.abs(maxDate - minDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Lógica: Si hay hotel, mostramos "Noches". Si solo hay vuelo, "Días".
        return diffDays > 0 ? `${diffDays} Días` : '';
    }

    function renderCards(list) {
        dom.loader.style.display = 'none';
        dom.grid.innerHTML = '';
        if (!list || list.length === 0) { dom.grid.innerHTML = '<p>No se encontraron paquetes.</p>'; return; }
        
        list.forEach(pkg => {
            const card = document.createElement('div');
            card.className = 'paquete-card';
            card.dataset.packageData = JSON.stringify(pkg);
            
            let precio = parseFloat(pkg['tarifa']) || 0;
            precio = Math.round(precio / 2);
            
            // Calculamos duración
            const duracion = calculateDuration(pkg);

            card.innerHTML = `
                <div class="card-header">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <h3 style="margin:0;">${pkg['destino']}</h3>
                        ${duracion ? `<span style="font-size:0.8em; font-weight:bold; color:#777;">${duracion}</span>` : ''}
                    </div>
                    <span class="tag-promo" style="margin-top:5px; display:inline-block;">${pkg['tipo_promo']}</span>
                </div>
                <div class="card-body">
                    <p><strong>Salida:</strong> ${formatDateAR(pkg['fecha_salida'])}</p>
                </div>
                <div class="card-footer">
                    <p class="precio-valor">${pkg['moneda']} $${precio}</p>
                </div>
            `;
            dom.grid.appendChild(card);
        });
    }

    // Modal y Helpers (Igual que antes)
    function renderServiciosHTML(jsonStr) {
        if (!jsonStr) return '<p>Sin detalles.</p>';
        let servicios = [];
        try { servicios = JSON.parse(jsonStr); } catch (e) { return '<p>Error.</p>'; }
        let html = '';
        servicios.forEach(s => {
            let icono = '🔹', titulo = '', lineas = [];
            if (s.tipo === 'aereo') {
                icono = '✈️'; titulo = 'AÉREO';
                lineas.push(`<b>Aerolínea:</b> ${s.aerolinea}`);
                lineas.push(`<b>Ida:</b> ${formatDateAR(s.fecha_aereo)} | <b>Vuelta:</b> ${formatDateAR(s.fecha_regreso)}`);
                let esc = parseInt(s.escalas) || 0;
                lineas.push(`<b>Escalas:</b> ${esc === 0 ? 'Directo' : esc}`);
                lineas.push(`<b>Equipaje:</b> ${s.tipo_equipaje} (x${s.cantidad_equipaje})`);
            } else if (s.tipo === 'hotel') {
                icono = '🏨'; titulo = 'HOTEL';
                lineas.push(`<b>${s.hotel_nombre}</b> (${s.regimen})`);
                let n = '-'; if(s.checkin && s.checkout) n = Math.ceil((new Date(s.checkout)-new Date(s.checkin))/86400000);
                lineas.push(`<b>Estadía:</b> ${n} noches (${formatDateAR(s.checkin)} - ${formatDateAR(s.checkout)})`);
            } else if (s.tipo === 'traslado') {
                icono = '🚌'; titulo = 'TRASLADO';
                let tr = []; if(s.trf_in) tr.push("In"); if(s.trf_out) tr.push("Out");
                lineas.push(`<b>Tipo:</b> ${s.tipo_trf} (${tr.join('+')})`);
            } else if (s.tipo === 'seguro') {
                icono = '🛡️'; titulo = 'SEGURO'; lineas.push(`<b>Cobertura:</b> ${s.proveedor}`);
            } else if (s.tipo === 'adicional') {
                icono = '➕'; titulo = 'ADICIONAL'; lineas.push(`<b>${s.descripcion}</b>`);
            }
            if(s.obs) lineas.push(`<i>Nota: ${s.obs}</i>`);
            html += `<div style="margin-bottom:10px; border-left:3px solid #ddd; padding-left:10px;"><b>${icono} ${titulo}</b><br><span style="font-size:0.9em; color:#555;">${lineas.join('<br>')}</span></div>`;
        });
        return html;
    }
    
    // ... (El resto de openModal, showView, listeners... igual que antes) ...
    // Asegúrate de pegar todo el final del archivo anterior aquí.
    function openModal(pkg) { /* Copia la función openModal del código anterior */ }
    function formatDateAR(s) { if(!s)return'-'; const p=s.split('-'); return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:s; }
    
    // Cierres
    dom.modalClose.onclick = () => dom.modal.style.display = 'none';
    window.onclick = e => { if(e.target === dom.modal) dom.modal.style.display = 'none'; };
    dom.navSearch.onclick = () => showView('search');
    dom.navUpload.onclick = () => showView('upload');
    dom.grid.addEventListener('click', e => { if(e.target.closest('.paquete-card')) openModal(JSON.parse(e.target.closest('.paquete-card').dataset.packageData)); });
    
    function showView(name) {
        dom.viewSearch.classList.toggle('active', name === 'search');
        dom.viewUpload.classList.toggle('active', name === 'upload');
        dom.navSearch.classList.toggle('active', name === 'search');
        dom.navUpload.classList.toggle('active', name === 'upload');
    }
    async function fetchPackages(filters={}) {
        try {
            const data = await secureFetch(API_URL_SEARCH, { method:'POST', body:JSON.stringify(filters) });
            allPackages = data.sort((a,b) => (b['fecha_creacion']||'').localeCompare(a['fecha_creacion']||''));
            renderCards(allPackages);
        } catch(e) { console.error(e); }
    }
});


