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
        viewSearch: document.getElementById('view-search'), viewUpload: document.getElementById('view-upload'),
        navSearch: document.getElementById('nav-search'), navUpload: document.getElementById('nav-upload'),
        grid: document.getElementById('grilla-paquetes'), loader: document.getElementById('loading-placeholder'),
        uploadForm: document.getElementById('upload-form'), uploadStatus: document.getElementById('upload-status'),
        btnSubir: document.getElementById('boton-subir'), containerServicios: document.getElementById('servicios-container'),
        btnAgregarServicio: document.getElementById('btn-agregar-servicio'), selectorServicio: document.getElementById('selector-servicio'),
        inputCostoTotal: document.getElementById('upload-costo-total'), inputFechaViaje: document.getElementById('upload-fecha-salida'),
        modal: document.getElementById('modal-detalle'), modalBody: document.getElementById('modal-body'),
        modalClose: document.getElementById('modal-cerrar'), btnLogin: document.getElementById('login-button'),
        btnLogout: document.getElementById('logout-button'), userEmail: document.getElementById('user-email'),
        authError: document.getElementById('auth-error'), loginContainer: document.getElementById('login-container'),
        appContainer: document.getElementById('app-container'), btnBuscar: document.getElementById('boton-buscar'),
        btnLimpiar: document.getElementById('boton-limpiar')
    };

    // --- Auth y Fetch (Sin Cambios) ---
    auth.onAuthStateChanged(async (u) => {
        if (u) {
            if (allowedEmails.includes(u.email)) {
                currentUser = u; dom.loginContainer.style.display='none'; dom.appContainer.style.display='block';
                dom.userEmail.textContent = u.email; await fetchPackages(); showView('search');
            } else { dom.authError.textContent='Acceso denegado.'; auth.signOut(); }
        } else { currentUser=null; dom.loginContainer.style.display='flex'; dom.appContainer.style.display='none'; }
    });
    dom.btnLogin.addEventListener('click', () => auth.signInWithPopup(provider));
    dom.btnLogout.addEventListener('click', () => auth.signOut());

    async function secureFetch(url, body) {
        if (!currentUser) throw new Error('No auth');
        const token = await currentUser.getIdToken(true);
        const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body:JSON.stringify(body), cache:'no-store' });
        if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
        const txt = await res.text(); return txt ? JSON.parse(txt) : [];
    }

    // =========================================================
    // 3. LÓGICA DE CARGA (FORMULARIO DINÁMICO)
    // =========================================================

    dom.btnAgregarServicio.addEventListener('click', () => {
        if (!dom.selectorServicio.value) return;
        agregarModuloServicio(dom.selectorServicio.value);
        dom.selectorServicio.value = "";
    });

    function agregarModuloServicio(tipo) {
        const id = Date.now();
        const div = document.createElement('div');
        div.className = `servicio-card ${tipo}`;
        div.dataset.id = id; div.dataset.tipo = tipo;
        const fechaBase = dom.inputFechaViaje.value || '';

        let html = `<button type="button" class="btn-eliminar-servicio" onclick="this.parentElement.remove(); window.calcularTotal();">×</button>`;
        
        if (tipo === 'aereo') {
            html += `<h4>✈️ Aéreo</h4>
            <div class="form-group-row">
                <div class="form-group"><label>Aerolínea</label><input type="text" name="aerolinea" required></div>
                <div class="form-group"><label>Ida</label><input type="date" name="fecha_aereo" value="${fechaBase}" required></div>
                <div class="form-group"><label>Vuelta</label><input type="date" name="fecha_regreso"></div>
            </div>
            <div class="form-group-row">
                <div class="form-group"><label>Escalas</label>${crearContadorHTML('escalas', 0)}</div>
                <div class="form-group"><label>Equipaje</label>
                    <select name="tipo_equipaje" onchange="mostrarContadorEquipaje(this, ${id})">
                        <option>Objeto Personal</option><option>Carry On</option><option>Carry On + Bodega</option><option>Bodega (15kg)</option><option>Bodega (23kg)</option>
                    </select>
                    <div id="equipaje-cantidad-${id}" style="display:none;"><label>Cant:</label>${crearContadorHTML('cantidad_equipaje', 1)}</div>
                </div>
            </div>
            <div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
        } 
        else if (tipo === 'hotel') {
            html += `<h4>🏨 Hotel</h4>
            <div class="form-group"><label>Alojamiento</label><input type="text" name="hotel_nombre" required></div>
            <div class="form-group-row">
                <div class="form-group"><label>Check In</label><input type="date" name="checkin" value="${fechaBase}" onchange="window.calcularNoches(${id})" required></div>
                <div class="form-group"><label>Check Out</label><input type="date" name="checkout" onchange="window.calcularNoches(${id})" required></div>
                <div class="form-group"><label>Noches</label><input type="text" id="noches-${id}" readonly style="background:#eee; width:60px;"></div>
            </div>
            <div class="form-group"><label>Régimen</label><select name="regimen"><option>Solo Habitación</option><option>Desayuno</option><option>Media Pensión</option><option>All Inclusive</option></select></div>
            <div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
        } 
        else if (tipo === 'traslado') {
            html += `<h4>🚌 Traslado</h4><div class="checkbox-group"><label class="checkbox-label"><input type="checkbox" name="trf_in"> In</label><label class="checkbox-label"><input type="checkbox" name="trf_out"> Out</label></div><div class="form-group-row" style="margin-top:10px;"><div class="form-group"><label>Tipo</label><select name="tipo_trf"><option>Compartido</option><option>Privado</option></select></div><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
        } 
        else if (tipo === 'seguro') {
            html += `<h4>🛡️ Seguro</h4><div class="form-group-row"><div class="form-group"><label>Cobertura</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
        } 
        else if (tipo === 'adicional') {
            html += `<h4>➕ Adicional</h4><div class="form-group"><label>Detalle</label><input type="text" name="descripcion" required></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
        }
        
        div.innerHTML = html;
        dom.containerServicios.appendChild(div);
    }

    // Helpers UI
    window.crearContadorHTML = (n, v) => `<div class="counter-wrapper"><button type="button" class="counter-btn" onclick="this.nextElementSibling.innerText = Math.max(0, parseInt(this.nextElementSibling.innerText)-1); if('${n}'==='escalas' && this.nextElementSibling.innerText==='0') this.parentElement.parentElement.querySelector('label').innerText='Escalas (Directo)'; else if('${n}'==='escalas') this.parentElement.parentElement.querySelector('label').innerText='Escalas'">-</button><span class="counter-value">${v}</span><button type="button" class="counter-btn" onclick="this.previousElementSibling.innerText = parseInt(this.previousElementSibling.innerText)+1; if('${n}'==='escalas') this.parentElement.parentElement.querySelector('label').innerText='Escalas'">+</button><input type="hidden" name="${n}" value="${v}"></div>`;
    
    window.mostrarContadorEquipaje = (s, id) => document.getElementById(`equipaje-cantidad-${id}`).style.display = (s.value === 'Objeto Personal') ? 'none' : 'block';
    
    window.calcularNoches = (id) => {
        const card = document.querySelector(`.servicio-card[data-id="${id}"]`);
        const i = new Date(card.querySelector('input[name="checkin"]').value), o = new Date(card.querySelector('input[name="checkout"]').value);
        document.getElementById(`noches-${id}`).value = (i&&o&&o>i) ? Math.ceil((o-i)/86400000) : '-';
    };
    
    window.calcularTotal = () => { let t = 0; document.querySelectorAll('.input-costo').forEach(i => t += parseFloat(i.value)||0); dom.inputCostoTotal.value = t; };

    // =========================================================
    // 4. VALIDACIÓN Y ENVÍO (¡AQUÍ ESTÁ LA SEGURIDAD!)
    // =========================================================

    dom.uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // --- 1. VALIDACIONES ESTRICTAS ---
        const costoTotal = parseFloat(dom.inputCostoTotal.value) || 0;
        const tarifaVenta = parseFloat(document.getElementById('upload-tarifa-total').value) || 0;
        const fechaViaje = new Date(dom.inputFechaViaje.value);

        // A. Validar Precio
        if (tarifaVenta < costoTotal) {
            alert(`⛔ ERROR: La Tarifa de Venta ($${tarifaVenta}) no puede ser menor al Costo ($${costoTotal}).`);
            return; // DETIENE EL PROCESO
        }

        // B. Validar Fechas en Servicios
        let errorFechas = null;
        const serviciosDOM = document.querySelectorAll('.servicio-card');
        if (serviciosDOM.length === 0) { alert("Debes agregar al menos un servicio."); return; }

        const serviciosData = [];

        for (let card of serviciosDOM) {
            const tipo = card.dataset.tipo;
            
            // Check Fechas < Fecha Viaje
            const fechaInput = card.querySelector('input[name="fecha_aereo"], input[name="checkin"]');
            if (fechaInput) {
                const fServicio = new Date(fechaInput.value);
                if (fServicio < fechaViaje) {
                    errorFechas = `El servicio de ${tipo.toUpperCase()} tiene fecha anterior a la salida del viaje.`;
                    break;
                }
            }

            // Check Hotel Fechas (Out < In)
            if (tipo === 'hotel') {
                const checkin = new Date(card.querySelector('input[name="checkin"]').value);
                const checkout = new Date(card.querySelector('input[name="checkout"]').value);
                if (checkout <= checkin) {
                    errorFechas = "En el Hotel, el Check-out debe ser posterior al Check-in.";
                    break;
                }
            }

            // Recolectar datos
            const serv = { tipo };
            card.querySelectorAll('input, select').forEach(i => {
                if (i.type === 'checkbox') serv[i.name] = i.checked;
                else if (i.type === 'hidden') {
                    const span = i.parentElement.querySelector('.counter-value');
                    serv[i.name] = span ? span.innerText : i.value;
                } else serv[i.name] = i.value;
            });
            serviciosData.push(serv);
        }

        if (errorFechas) { alert("⛔ ERROR DE FECHAS: " + errorFechas); return; }

        // --- 2. SI PASA TODO, ENVIAMOS ---
        dom.btnSubir.disabled = true;
        dom.uploadStatus.textContent = 'Guardando...';
        
        const newPackage = {
            destino: document.getElementById('upload-destino').value,
            salida: document.getElementById('upload-salida').value,
            fecha_salida: document.getElementById('upload-fecha-salida').value,
            costos_proveedor: costoTotal,
            tarifa_venta: tarifaVenta,
            moneda: document.getElementById('upload-moneda').value,
            tipo_promo: document.getElementById('upload-promo').value,
            financiacion: document.getElementById('upload-financiacion').value,
            descripcion: "", 
            servicios: serviciosData
        };

        try {
            await secureFetch(API_URL_UPLOAD, newPackage);
            alert('¡Guardado con éxito!');
            dom.uploadStatus.textContent = '¡Listo!';
            dom.uploadForm.reset();
            dom.containerServicios.innerHTML = '';
            fetchPackages();
        } catch (error) {
            console.error(error);
            dom.uploadStatus.textContent = 'Error al guardar.';
        } finally {
            dom.btnSubir.disabled = false;
        }
    });

    // =========================================================
    // 5. RENDERIZADO Y MODAL
    // =========================================================

    // Helper: Calcular duración total del viaje para la tarjeta
    function calculateDuration(pkg) {
        let maxDate = new Date(pkg['fecha_salida'].split('/').reverse().join('-')); // Base: Salida
        let hasData = false;
        
        // Parsear JSON seguro
        let servicios = [];
        try { 
            const raw = pkg['servicios'] || pkg['item.servicios'];
            servicios = typeof raw === 'string' ? JSON.parse(raw) : raw; 
        } catch(e) {}

        if(!Array.isArray(servicios)) return '';

        servicios.forEach(s => {
            if (s.tipo === 'hotel' && s.checkout) {
                const d = new Date(s.checkout); if (d > maxDate) { maxDate = d; hasData = true; }
            }
            if (s.tipo === 'aereo' && s.fecha_regreso) {
                const d = new Date(s.fecha_regreso); if (d > maxDate) { maxDate = d; hasData = true; }
            }
        });

        if (!hasData) return '';
        const start = new Date(pkg['fecha_salida'].split('/').reverse().join('-'));
        const diff = Math.ceil((maxDate - start) / 86400000);
        return diff > 0 ? `${diff} Días` : '';
    }

    // Helper: HTML del Modal
    function renderServiciosHTML(rawJson) {
        let servicios = [];
        try { servicios = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson; } catch(e) { return '<p>Sin detalles.</p>'; }
        if (!Array.isArray(servicios)) return '<p>Sin detalles.</p>';

        let html = '';
        servicios.forEach(s => {
            let icono = '🔹', titulo = '', lineas = [];
            if (s.tipo === 'aereo') {
                icono = '✈️'; titulo = 'AÉREO';
                lineas.push(`<b>Aerolínea:</b> ${s.aerolinea}`);
                let vuelta = s.fecha_regreso ? ` | <b>Vuelta:</b> ${formatDateAR(s.fecha_regreso)}` : '';
                lineas.push(`<b>Ida:</b> ${formatDateAR(s.fecha_aereo)}${vuelta}`);
                lineas.push(`<b>Escalas:</b> ${s.escalas == 0 ? 'Directo' : s.escalas}`);
                let eq = s.tipo_equipaje.replace(/_/g, ' '); if(s.tipo_equipaje==='carry_on_bodega') eq="Carry On + Bodega";
                lineas.push(`<b>Equipaje:</b> ${eq} (x${s.cantidad_equipaje})`);
            } else if (s.tipo === 'hotel') {
                icono = '🏨'; titulo = 'HOTEL';
                lineas.push(`<b>${s.hotel_nombre}</b> (${s.regimen})`);
                let n = (s.checkin && s.checkout) ? Math.ceil((new Date(s.checkout)-new Date(s.checkin))/86400000) : '-';
                lineas.push(`<b>Estadía:</b> ${n} noches (${formatDateAR(s.checkin)} al ${formatDateAR(s.checkout)})`);
            } else if (s.tipo === 'traslado') {
                icono = '🚌'; titulo = 'TRASLADO';
                let t = []; if(s.trf_in) t.push("In"); if(s.trf_out) t.push("Out"); if(s.trf_hotel) t.push("Hotel-Hotel");
                lineas.push(`<b>Tipo:</b> ${s.tipo_trf} (${t.join('+')})`);
            } else if (s.tipo === 'seguro') { icono='🛡️'; titulo='SEGURO'; lineas.push(`<b>Cobertura:</b> ${s.proveedor}`); }
            else if (s.tipo === 'adicional') { icono='➕'; titulo='ADICIONAL'; lineas.push(`<b>${s.descripcion}</b>`); }
            
            if(s.obs) lineas.push(`<i>Nota: ${s.obs}</i>`);
            
            html += `<div style="margin-bottom:10px; border-left:3px solid #ddd; padding-left:10px;">
                <div style="color:#11173d; font-weight:bold;">${icono} ${titulo}</div>
                <div style="font-size:0.9em; color:#555;">${lineas.map(l=>`<div>${l}</div>`).join('')}</div>
            </div>`;
        });
        return html;
    }

    function renderCards(list) {
        dom.loader.style.display = 'none'; dom.grid.innerHTML = '';
        if (!list || list.length === 0) { dom.grid.innerHTML = '<p>No hay paquetes.</p>'; return; }
        
        list.forEach(pkg => {
            const card = document.createElement('div');
            card.className = 'paquete-card';
            // Guardamos todo el objeto para el modal
            card.dataset.packageData = JSON.stringify(pkg);
            
            const precio = Math.round((parseFloat(pkg['tarifa'])||0) / 2);
            const duracion = calculateDuration(pkg);

            card.innerHTML = `
                <div class="card-header">
                    <div style="display:flex; justify-content:space-between;">
                        <h3 style="margin:0;">${pkg['destino']}</h3>
                        ${duracion ? `<span style="font-size:0.8em; font-weight:bold; color:#777;">${duracion}</span>` : ''}
                    </div>
                    <span class="tag-promo" style="display:inline-block; margin-top:5px;">${pkg['tipo_promo']}</span>
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

    function openModal(pkg) {
        const serviciosHTML = renderServiciosHTML(pkg['servicios'] || pkg['item.servicios']);
        dom.modalBody.innerHTML = `
            <div class="modal-detalle-header"><h2>${pkg['destino']}</h2></div>
            <div class="modal-detalle-body">
                <div class="detalle-full precio-final"><label>Precio Venta</label><p>${pkg['moneda']} $${pkg['tarifa']}</p></div>
                <div class="detalle-item"><label>Salida</label><p>${formatDateAR(pkg['fecha_salida'])} (${pkg['salida']})</p></div>
                <div class="detalle-item"><label>Costo</label><p>${pkg['moneda']} $${pkg['costos_proveedor']}</p></div>
                <div class="detalle-full"><h4 style="border-bottom:1px solid #eee;">Servicios</h4>${serviciosHTML}</div>
                ${pkg['financiacion'] ? `<div class="detalle-full" style="background:#e3f2fd; padding:10px;"><b>Financ.:</b> ${pkg['financiacion']}</div>` : ''}
                <div class="detalle-item" style="text-align:right; border:none;"><small>Cargado por: ${pkg['creador']}</small></div>
            </div>
        `;
        dom.modal.style.display = 'flex';
    }

    // Helpers y Navegación
    function formatDateAR(s) { if(!s)return'-'; const p=s.split('-'); return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:s; }
    function showView(n) { dom.viewSearch.classList.toggle('active',n==='search'); dom.viewUpload.classList.toggle('active',n==='upload'); dom.navSearch.classList.toggle('active',n==='search'); dom.navUpload.classList.toggle('active',n==='upload'); }
    dom.navSearch.onclick=()=>showView('search'); dom.navUpload.onclick=()=>showView('upload');
    dom.grid.addEventListener('click', e => { const c=e.target.closest('.paquete-card'); if(c) openModal(JSON.parse(c.dataset.packageData)); });
    dom.modalClose.onclick=()=>dom.modal.style.display='none'; window.onclick=e=>{if(e.target===dom.modal)dom.modal.style.display='none';};
    
    // Fetch inicial
    async function fetchPackages(f={}) { try{ const d=await secureFetch(API_URL_SEARCH, f); allPackages=d.sort((a,b)=>(b['fecha_creacion']||'').localeCompare(a['fecha_creacion']||'')); renderCards(allPackages); }catch(e){console.error(e);} }
});



