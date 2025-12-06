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

    // Referencias al DOM (Elementos de la pantalla)
    const views = { login: document.getElementById('login-container'), app: document.getElementById('app-container') };
    const dom = {
        // Header y Auth
        userEmail: document.getElementById('user-email'),
        authError: document.getElementById('auth-error'),
        btnLogin: document.getElementById('login-button'),
        btnLogout: document.getElementById('logout-button'),
        
        // Navegación
        navSearch: document.getElementById('nav-search'),
        navUpload: document.getElementById('nav-upload'),
        viewSearch: document.getElementById('view-search'),
        viewUpload: document.getElementById('view-upload'),
        
        // Búsqueda
        grid: document.getElementById('grilla-paquetes'),
        loader: document.getElementById('loading-placeholder'),
        btnBuscar: document.getElementById('boton-buscar'),
        btnLimpiar: document.getElementById('boton-limpiar'),
        
        // Carga
        uploadForm: document.getElementById('upload-form'),
        uploadStatus: document.getElementById('upload-status'),
        btnSubir: document.getElementById('boton-subir'),
        containerServicios: document.getElementById('servicios-container'),
        btnAgregarServicio: document.getElementById('btn-agregar-servicio'),
        selectorServicio: document.getElementById('selector-servicio'),
        inputCostoTotal: document.getElementById('upload-costo-total'),
        
        // Modal
        modal: document.getElementById('modal-detalle'),
        modalBody: document.getElementById('modal-body'),
        modalClose: document.getElementById('modal-cerrar')
    };

    // =========================================================
    // 3. AUTENTICACIÓN (El "Guardia")
    // =========================================================
    
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            if (allowedEmails.includes(user.email)) {
                // Login Exitoso
                currentUser = user;
                views.login.style.display = 'none';
                views.app.style.display = 'block';
                dom.userEmail.textContent = user.email;
                await fetchPackages(); 
                showView('search');
            } else {
                // Email no autorizado
                dom.authError.textContent = 'Acceso denegado: Tu email no está en la lista.';
                auth.signOut();
            }
        } else {
            // No logueado
            currentUser = null;
            views.login.style.display = 'flex';
            views.app.style.display = 'none';
        }
    });

    dom.btnLogin.addEventListener('click', () => auth.signInWithPopup(provider));
    dom.btnLogout.addEventListener('click', () => auth.signOut());

    // =========================================================
    // 4. COMUNICACIÓN SEGURA (El "Puente")
    // =========================================================

    async function secureFetch(url, bodyData) {
        if (!currentUser) throw new Error('No autenticado');
        const token = await currentUser.getIdToken(true);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(bodyData),
            cache: 'no-store'
        });
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                alert("Error de seguridad. Serás deslogueado.");
                auth.signOut();
            }
            throw new Error(`Error de API: ${response.statusText}`);
        }
        
        const text = await response.text();
        return text ? JSON.parse(text) : [];
    }

    // =========================================================
    // 5. LÓGICA DE BÚSQUEDA
    // =========================================================

    async function fetchPackages(filters = {}) {
        dom.loader.style.display = 'block';
        dom.grid.innerHTML = '';
        
        try {
            const data = await secureFetch(API_URL_SEARCH, filters);
            
            // Ordenar por fecha de creación (dd/mm/aaaa)
            allPackages = data.sort((a, b) => {
                const da = a['fecha_creacion'] ? a['fecha_creacion'].split('/').reverse().join('') : '';
                const db = b['fecha_creacion'] ? b['fecha_creacion'].split('/').reverse().join('') : '';
                return db.localeCompare(da);
            });
            renderCards(allPackages);
        } catch (e) {
            console.error(e);
            dom.loader.innerHTML = '<p>Error cargando datos.</p>';
        }
    }

    dom.btnBuscar.addEventListener('click', () => {
        const filters = {
            destino: document.getElementById('filtro-destino').value,
            creador: document.getElementById('filtro-creador').value,
            tipo_promo: document.getElementById('filtro-promo').value
        };
        fetchPackages(filters);
    });

    dom.btnLimpiar.addEventListener('click', () => {
        document.getElementById('filtro-destino').value = '';
        document.getElementById('filtro-creador').value = '';
        document.getElementById('filtro-promo').value = '';
        fetchPackages({});
    });

    // =========================================================
    // 6. LÓGICA DE CARGA (FORMULARIO DINÁMICO)
    // =========================================================

    // A. Agregar Módulos de Servicios
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

        let htmlContenido = `<button type="button" class="btn-eliminar-servicio" onclick="this.parentElement.remove(); window.calcularTotal();">×</button>`;
        
        // Plantillas HTML para cada servicio
        if (tipo === 'aereo') {
            const fechaViaje = document.getElementById('upload-fecha-salida').value || '';
            htmlContenido += `
                <h4>✈️ Aéreo</h4>
                <div class="form-group-row">
                    <div class="form-group"><label>Compañía Aérea</label><input type="text" name="aerolinea" required></div>
                    <div class="form-group"><label>Fecha Salida</label><input type="date" name="fecha_aereo" value="${fechaViaje}" required></div>
                </div>
                <div class="form-group-row">
                    <div class="form-group"><label>Escalas</label>${crearContadorHTML('escalas', 0)}</div>
                    <div class="form-group">
                        <label>Equipaje</label>
                        <select name="tipo_equipaje" onchange="mostrarContadorEquipaje(this, ${idUnico})">
                            <option value="objeto_personal">Objeto Personal</option>
                            <option value="carry_on">Carry On</option>
                            <option value="bodega_chico">Bodega (15kg)</option>
                            <option value="bodega_grande">Bodega (23kg)</option>
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
            htmlContenido += `
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
            `;
        } else if (tipo === 'traslado') {
            htmlContenido += `
                <h4>uD83DuDE90 Traslado</h4>
                <div class="checkbox-group">
                    <label class="checkbox-label"><input type="checkbox" name="trf_in"> In</label>
                    <label class="checkbox-label"><input type="checkbox" name="trf_out"> Out</label>
                </div>
                <div class="form-group-row">
                    <div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div>
                    <div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div>
                </div>
            `;
        } else if (tipo === 'seguro') {
            htmlContenido += `
                <h4>uD83DuDEE1️ Seguro</h4>
                <div class="form-group-row">
                    <div class="form-group"><label>Cobertura</label><input type="text" name="proveedor" required></div>
                    <div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div>
                </div>
            `;
        } else if (tipo === 'adicional') {
            htmlContenido += `
                <h4>➕ Adicional</h4>
                <div class="form-group"><label>Detalle</label><input type="text" name="descripcion" required></div>
                <div class="form-group-row">
                    <div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div>
                    <div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div>
                </div>
            `;
        }

        div.innerHTML = htmlContenido;
        dom.containerServicios.appendChild(div);
    }

    // B. Helpers globales para el HTML dinámico
    window.crearContadorHTML = (name, val) => `
        <div class="counter-wrapper">
            <button type="button" class="counter-btn" onclick="this.nextElementSibling.innerText = Math.max(0, parseInt(this.nextElementSibling.innerText) - 1)">-</button>
            <span class="counter-value">${val}</span>
            <button type="button" class="counter-btn" onclick="this.previousElementSibling.innerText = parseInt(this.previousElementSibling.innerText) + 1">+</button>
            <input type="hidden" name="${name}" value="${val}"> 
        </div>`;

    window.mostrarContadorEquipaje = (sel, id) => {
        document.getElementById(`equipaje-cantidad-${id}`).style.display = (sel.value === 'objeto_personal') ? 'none' : 'block';
    };

    window.calcularNoches = (id) => {
        const card = document.querySelector(`.servicio-card[data-id="${id}"]`);
        const inD = new Date(card.querySelector('input[name="checkin"]').value);
        const outD = new Date(card.querySelector('input[name="checkout"]').value);
        if (inD && outD && outD > inD) {
            document.getElementById(`noches-${id}`).value = Math.ceil(Math.abs(outD - inD) / (86400000));
        }
    };

    window.calcularTotal = () => {
        let total = 0;
        document.querySelectorAll('.input-costo').forEach(i => total += parseFloat(i.value) || 0);
        dom.inputCostoTotal.value = total;
    };

    // C. Envío del Formulario
    dom.uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        dom.btnSubir.disabled = true;
        dom.uploadStatus.textContent = 'Guardando...';
        
        // 1. Datos Base (Limpios)
        const paqueteBase = {
            destino: document.getElementById('upload-destino').value,
            salida: document.getElementById('upload-salida').value,
            fecha_salida: document.getElementById('upload-fecha-salida').value,
            moneda: document.getElementById('upload-moneda').value,
            tipo_promo: document.getElementById('upload-promo').value,
            financiacion: document.getElementById('upload-financiacion').value,
            descripcion_publica: document.getElementById('upload-descripcion').value,
            costo_total: document.getElementById('upload-costo-total').value,
            tarifa_venta: document.getElementById('upload-tarifa-total').value,
            servicios: [] 
        };

        // 2. Extraer Servicios
        document.querySelectorAll('.servicio-card').forEach(card => {
            const serv = { tipo: card.dataset.tipo };
            card.querySelectorAll('input, select').forEach(input => {
                if (input.type === 'checkbox') serv[input.name] = input.checked;
                else if (input.type === 'hidden') {
                    // Actualizar valor hidden con el span del contador
                    const span = input.parentElement.querySelector('.counter-value');
                    serv[input.name] = span ? span.innerText : input.value;
                } else {
                    serv[input.name] = input.value;
                }
            });
            paqueteBase.servicios.push(serv);
        });

        try {
            await secureFetch(API_URL_UPLOAD, paqueteBase);
            dom.uploadStatus.textContent = '¡Guardado con éxito!';
            dom.uploadStatus.className = 'status-message success';
            dom.uploadForm.reset();
            dom.containerServicios.innerHTML = ''; // Limpiar servicios
            fetchPackages(); 
        } catch (error) {
            dom.uploadStatus.textContent = 'Error al guardar.';
            dom.uploadStatus.className = 'status-message error';
        } finally {
            dom.btnSubir.disabled = false;
        }
    });

    // =========================================================
    // 7. INTERFAZ (Render y Modal)
    // =========================================================

    // Helper para dibujar servicios en el modal
    function renderServiciosHTML(jsonStr) {
        if (!jsonStr) return '<p>Sin detalles técnicos.</p>';
        let servicios = [];
        try { servicios = JSON.parse(jsonStr); } catch (e) { return '<p>Error datos.</p>'; }

        let html = '';
        servicios.forEach(s => {
            let icono = '🔹'; let info = '';
            if (s.tipo === 'aereo') {
                icono = '✈️ AÉREO';
                info = `Aerolínea: ${s.aerolinea} | Fecha: ${s.fecha_aereo} | Escalas: ${s.escalas}`;
            } else if (s.tipo === 'hotel') {
                icono = '🏨 HOTEL';
                info = `${s.hotel_nombre} | ${s.regimen} | Check-in: ${s.checkin}`;
            } else if (s.tipo === 'traslado') icono = 'uD83DuDE90 TRASLADO';
            else if (s.tipo === 'seguro') icono = 'uD83DuDEE1️ SEGURO';
            else icono = '➕ ADICIONAL';

            html += `<div style="border-left:3px solid #ddd; padding-left:10px; margin-bottom:10px;">
                <strong style="color:#11173d">${icono}</strong><br>
                <span style="font-size:0.9em; color:#555;">${info || s.proveedor || s.descripcion}</span>
            </div>`;
        });
        return html;
    }

    function renderCards(list) {
        dom.loader.style.display = 'none';
        dom.grid.innerHTML = '';
        if (!list || list.length === 0) {
            dom.grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;">No se encontraron resultados.</p>';
            return;
        }
        list.forEach(pkg => {
            const card = document.createElement('div');
            card.className = 'paquete-card';
            card.dataset.packageData = JSON.stringify(pkg);
            card.innerHTML = `
                <div class="card-header">
                    <h3>${pkg['destino'] || 'Paquete'}</h3>
                    <span class="tag-promo">${pkg['tipo_promo'] || '-'}</span>
                </div>
                <div class="card-body">
                    <p><strong>Salida:</strong> ${pkg['fecha_salida'] || '-'}</p>
                </div>
                <div class="card-footer">
                    <p class="precio-valor">${pkg['moneda']} $${pkg['tarifa']}</p>
                </div>
            `;
            dom.grid.appendChild(card);
        });
    }

    function openModal(pkg) {
        if (!pkg) return;
        const serviciosHTML = renderServiciosHTML(pkg['servicios']);
        
        dom.modalBody.innerHTML = `
            <div class="modal-detalle-header"><h2>${pkg['destino']}</h2></div>
            <div class="modal-detalle-body">
                <div class="detalle-full precio-final"><label>Precio Venta</label><p>${pkg['moneda']} $${pkg['tarifa']}</p></div>
                <div class="detalle-item"><label>Fecha Salida</label><p>${pkg['fecha_salida']}</p></div>
                <div class="detalle-item"><label>Lugar</label><p>${pkg['salida']}</p></div>
                <div class="detalle-full"><label>Itinerario</label><p>${pkg['descripcion']}</p></div>
                <div class="detalle-full">
                    <h4 style="border-bottom:1px solid #eee; margin-bottom:10px;">Detalle de Servicios</h4>
                    ${serviciosHTML}
                </div>
                <div class="detalle-item"><label>Cargado Por</label><p>${pkg['creador']}</p></div>
            </div>
        `;
        dom.modal.style.display = 'flex';
    }

    // UI Helpers
    dom.modalClose.onclick = () => dom.modal.style.display = 'none';
    window.onclick = (e) => { if (e.target === dom.modal) dom.modal.style.display = 'none'; };
    function showView(name) {
        dom.viewSearch.classList.toggle('active', name === 'search');
        dom.viewUpload.classList.toggle('active', name === 'upload');
        dom.navSearch.classList.toggle('active', name === 'search');
        dom.navUpload.classList.toggle('active', name === 'upload');
    }
    
    // Listeners UI
    dom.navSearch.onclick = () => showView('search');
    dom.navUpload.onclick = () => showView('upload');
    dom.grid.addEventListener('click', (e) => {
        const card = e.target.closest('.paquete-card');
        if (card) openModal(JSON.parse(card.dataset.packageData));
    });
});

