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

    // --- Auth ---
    auth.onAuthStateChanged(async (u) => {
        if (u) {
            if (allowedEmails.includes(u.email)) {
                currentUser = u; dom.loginContainer.style.display='none'; dom.appContainer.style.display='block';
                dom.userEmail.textContent = u.email; await fetchAndLoadPackages(); showView('search');
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
    // 3. LOGICA DE FORMATEO (Moneda y Fechas)
    // =========================================================
    
    const formatMoney = (amount) => new Intl.NumberFormat('es-AR', { style: 'decimal', minimumFractionDigits: 0 }).format(amount);
    
    // Convierte YYYY-MM-DD a DD/MM/AAAA
    const formatDateAR = (s) => { 
        if(!s) return '-'; 
        const p = s.split('-'); 
        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s; 
    };

    // =========================================================
    // 4. LÓGICA DE CARGA Y VALIDACIÓN (¡ESTRICTA!)
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

        // Plantillas HTML
        if (tipo === 'aereo') {
             html += `<h4>✈️ Aéreo</h4><div class="form-group-row"><div class="form-group"><label>Aerolínea</label><input type="text" name="aerolinea" required></div><div class="form-group"><label>Ida</label><input type="date" name="fecha_aereo" value="${fechaBase}" required></div><div class="form-group"><label>Vuelta</label><input type="date" name="fecha_regreso"></div></div><div class="form-group-row"><div class="form-group"><label>Escalas</label>${crearContadorHTML('escalas', 0)}</div><div class="form-group"><label>Equipaje</label><select name="tipo_equipaje"><option>Objeto Personal</option><option>Carry On</option><option>Carry On + Bodega</option><option>Bodega (15kg)</option><option>Bodega (23kg)</option></select></div></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
        } else if (tipo === 'hotel') {
            html += `<h4>🏨 Hotel</h4><div class="form-group"><label>Alojamiento</label><input type="text" name="hotel_nombre" required></div><div class="form-group-row"><div class="form-group"><label>Check In</label><input type="date" name="checkin" value="${fechaBase}" onchange="window.calcularNoches(${id})" required></div><div class="form-group"><label>Check Out</label><input type="date" name="checkout" onchange="window.calcularNoches(${id})" required></div><div class="form-group"><label>Noches</label><input type="text" id="noches-${id}" readonly style="background:#eee; width:60px;"></div></div><div class="form-group"><label>Régimen</label><select name="regimen"><option>Solo Habitación</option><option>Desayuno</option><option>Media Pensión</option><option>All Inclusive</option></select></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
        } else if (tipo === 'traslado') {
            html += `<h4>🚌 Traslado</h4><div class="checkbox-group"><label class="checkbox-label"><input type="checkbox" name="trf_in"> In</label><label class="checkbox-label"><input type="checkbox" name="trf_out"> Out</label></div><div class="form-group-row"><div class="form-group"><label>Tipo</label><select name="tipo_trf"><option>Compartido</option><option>Privado</option></select></div><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
        } else if (tipo === 'seguro') {
            html += `<h4>🛡️ Seguro</h4><div class="form-group-row"><div class="form-group"><label>Cobertura</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
        } else if (tipo === 'adicional') {
            html += `<h4>➕ Adicional</h4><div class="form-group"><label>Detalle</label><input type="text" name="descripcion" required></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
        }
        div.innerHTML = html;
        dom.containerServicios.appendChild(div);
    }

    // Helpers UI
    window.crearContadorHTML = (n, v) => `<div class="counter-wrapper"><button type="button" class="counter-btn" onclick="this.nextElementSibling.innerText=Math.max(0,parseInt(this.nextElementSibling.innerText)-1)">-</button><span class="counter-value">${v}</span><button type="button" class="counter-btn" onclick="this.previousElementSibling.innerText=parseInt(this.previousElementSibling.innerText)+1">+</button><input type="hidden" name="${n}" value="${v}"></div>`;
    window.calcularNoches = (id) => { const c=document.querySelector(`.servicio-card[data-id="${id}"]`); const i=new Date(c.querySelector('input[name="checkin"]').value), o=new Date(c.querySelector('input[name="checkout"]').value); document.getElementById(`noches-${id}`).value=(i&&o&&o>i)?Math.ceil((o-i)/86400000):'-'; };
    window.calcularTotal = () => { let t=0; document.querySelectorAll('.input-costo').forEach(i=>t+=parseFloat(i.value)||0); dom.inputCostoTotal.value=t; };

    // --- ENVÍO CON VALIDACIÓN DE FECHAS ---
    dom.uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // 1. Validar Precio
        const costo = parseFloat(dom.inputCostoTotal.value)||0; 
        const tarifa = parseFloat(document.getElementById('upload-tarifa-total').value)||0;
        if(tarifa < costo) { alert(`⛔ ERROR: La tarifa ($${tarifa}) es menor al costo ($${costo}).`); return; }

        // 2. Validar Fechas (Regla: Ningún servicio < Fecha Viaje | Hotel Out > In)
        const fechaViajeStr = dom.inputFechaViaje.value;
        if (!fechaViajeStr) { alert("Ingresa la fecha de salida del viaje."); return; }
        // Truco: Usamos "T00:00:00" para asegurar que se compare la fecha local y no UTC
        const fechaViaje = new Date(fechaViajeStr + 'T00:00:00'); 
        
        let errorMsg = null;
        
        const cards = document.querySelectorAll('.servicio-card');
        if(cards.length === 0) { alert("Agrega al menos un servicio."); return; }

        // Recolectamos datos SOLO si pasa la validación
        const serviciosData = [];

        for (let card of cards) {
            const tipo = card.dataset.tipo;
            
            // Validar vs Fecha Salida Viaje
            const inputsFecha = card.querySelectorAll('input[type="date"]');
            for (let input of inputsFecha) {
                if(input.value) {
                    const fServicio = new Date(input.value + 'T00:00:00');
                    if (fServicio < fechaViaje) {
                        errorMsg = `⛔ FECHA INVÁLIDA: Un servicio (${tipo}) tiene fecha anterior a la salida del viaje (${formatDateAR(fechaViajeStr)}).`;
                        break;
                    }
                }
            }
            if(errorMsg) break;

            // Validar Hotel (Out > In)
            if (tipo === 'hotel') {
                const inStr = card.querySelector('input[name="checkin"]').value;
                const outStr = card.querySelector('input[name="checkout"]').value;
                if (inStr && outStr) {
                    if (new Date(outStr) <= new Date(inStr)) {
                        errorMsg = "⛔ HOTEL INVÁLIDO: El Check-out debe ser posterior al Check-in.";
                        break;
                    }
                }
            }

            // Guardar datos
            const serv = { tipo };
            card.querySelectorAll('input, select').forEach(i => {
                if (i.type === 'checkbox') serv[i.name] = i.checked;
                else if (i.type === 'hidden') serv[i.name] = i.parentElement.querySelector('.counter-value')?.innerText || i.value;
                else serv[i.name] = i.value;
            });
            serviciosData.push(serv);
        }

        if(errorMsg) { alert(errorMsg); return; } // DETIENE EL GUARDADO

        // Si llegó aquí, todo está bien
        dom.btnSubir.disabled = true; dom.uploadStatus.textContent = 'Guardando...';
        const newPackage = {
            destino: document.getElementById('upload-destino').value,
            salida: document.getElementById('upload-salida').value,
            fecha_salida: fechaViajeStr, // Guardamos string YYYY-MM-DD
            costos_proveedor: costo, tarifa_venta: tarifa,
            moneda: document.getElementById('upload-moneda').value,
            tipo_promo: document.getElementById('upload-promo').value,
            financiacion: document.getElementById('upload-financiacion').value,
            servicios: serviciosData
        };
        try { await secureFetch(API_URL_UPLOAD, newPackage); alert('¡Paquete guardado!'); dom.uploadForm.reset(); dom.containerServicios.innerHTML=''; fetchAndLoadPackages(); }
        catch(e) { console.error(e); dom.uploadStatus.textContent='Error al guardar'; } finally { dom.btnSubir.disabled=false; }
    });

    // =========================================================
    // 5. RENDERIZADO (TARJETAS Y MODAL)
    // =========================================================

    // Cálculo Robusto de Duración (Noches)
    function calculateDuration(pkg) {
        // Base: Fecha salida del viaje
        if(!pkg['fecha_salida']) return '';
        const tripStart = new Date(pkg['fecha_salida'].split('/').reverse().join('-') + 'T00:00:00'); // Asume DD/MM/AAAA si viene de sheet, o YYYY-MM-DD
        
        // Si no se puede parsear, intentamos directo (si viene YYYY-MM-DD)
        const tripStartAlt = new Date(pkg['fecha_salida'] + 'T00:00:00');
        const start = isNaN(tripStart) ? tripStartAlt : tripStart;

        if (isNaN(start)) return '';

        let maxDate = new Date(start);
        let hasEndDates = false;

        let servicios = [];
        try { const raw = pkg['servicios']||pkg['item.servicios']; servicios = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch(e){}
        if(!Array.isArray(servicios)) return '';

        servicios.forEach(s => {
            if (s.tipo === 'hotel' && s.checkout) { 
                const d = new Date(s.checkout + 'T00:00:00'); 
                if (d > maxDate) { maxDate = d; hasEndDates = true; }
            }
            if (s.tipo === 'aereo' && s.fecha_regreso) { 
                const d = new Date(s.fecha_regreso + 'T00:00:00'); 
                if (d > maxDate) { maxDate = d; hasEndDates = true; }
            }
        });

        if (!hasEndDates) return '';
        const diffDays = Math.ceil((maxDate - start) / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? `${diffDays} Noches` : ''; 
    }

    function renderCards(list) {
        dom.loader.style.display = 'none'; dom.grid.innerHTML = '';
        if (!list || list.length === 0) { dom.grid.innerHTML = '<p>No hay resultados.</p>'; return; }
        
        list.forEach(pkg => {
            const card = document.createElement('div');
            card.className = 'paquete-card';
            card.dataset.packageData = JSON.stringify(pkg);
            
            let precio = parseFloat(pkg['tarifa']) || 0;
            precio = Math.round(precio / 2);
            const duracion = calculateDuration(pkg);

            card.innerHTML = `
                <div class="card-header">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                        <div style="max-width:70%;">
                            <h3 style="margin:0; font-size:1.1em; line-height:1.2;">${pkg['destino']}</h3>
                            <span class="tag-promo" style="margin-top:5px; display:inline-block; font-size:0.75em;">${pkg['tipo_promo']}</span>
                        </div>
                        ${duracion ? `<div style="background:#eef2f5; color:#11173d; padding:4px 8px; border-radius:6px; font-weight:bold; font-size:0.85em; white-space:nowrap; margin-left:5px;">🌙 ${duracion}</div>` : ''}
                    </div>
                </div>
                <div class="card-body">
                    <p style="color:#666; font-size:0.9em; margin-top:10px;"><strong>Salida:</strong> ${formatDateAR(pkg['fecha_salida'])}</p>
                </div>
                <div class="card-footer">
                    <p class="precio-valor">${pkg['moneda']} $${formatMoney(precio)}</p>
                </div>
            `;
            dom.grid.appendChild(card);
        });
    }

    // Modal con Proveedor y Costo discriminado
    function renderServiciosHTML(rawJson) {
        let servicios = [];
        try { servicios = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson; } catch(e) { return '<p>Sin detalles.</p>'; }
        if (!Array.isArray(servicios)) return '<p>Sin detalles.</p>';
        let html = '';
        servicios.forEach(s => {
            let icono = '🔹', titulo = '', lineas = [];
            
            // Info específica
            if (s.tipo === 'aereo') {
                icono = '✈️'; titulo = 'AÉREO';
                lineas.push(`<b>Aerolínea:</b> ${s.aerolinea}`);
                let v = s.fecha_regreso ? ` | <b>Vuelta:</b> ${formatDateAR(s.fecha_regreso)}` : '';
                lineas.push(`<b>Fechas:</b> ${formatDateAR(s.fecha_aereo)}${v}`);
                lineas.push(`<b>Escalas:</b> ${s.escalas==0?'Directo':s.escalas}`);
                lineas.push(`<b>Equipaje:</b> ${s.tipo_equipaje.replace(/_/g,' ')} (x${s.cantidad_equipaje})`);
            } else if (s.tipo === 'hotel') {
                icono = '🏨'; titulo = 'HOTEL';
                lineas.push(`<b>${s.hotel_nombre}</b> (${s.regimen})`);
                let n = (s.checkin && s.checkout) ? Math.ceil((new Date(s.checkout)-new Date(s.checkin))/86400000) : '-';
                lineas.push(`<b>Estadía:</b> ${n} noches (${formatDateAR(s.checkin)} al ${formatDateAR(s.checkout)})`);
            } else if (s.tipo === 'traslado') {
                icono = '🚌'; titulo = 'TRASLADO';
                let t = []; if(s.trf_in) t.push("In"); if(s.trf_out) t.push("Out"); if(s.trf_hotel) t.push("Hotel-Hotel");
                lineas.push(`<b>Tipo:</b> ${s.tipo_trf} (${t.join('+')})`);
            } else if (s.tipo === 'seguro') { icono='🛡️'; titulo='SEGURO'; lineas.push(`<b>Cob:</b> ${s.proveedor}`); }
            else if (s.tipo === 'adicional') { icono='➕'; titulo='ADICIONAL'; lineas.push(`<b>${s.descripcion}</b>`); }

            // DATOS INTERNOS (PROVEEDOR Y COSTO) - ¡AGREGADO!
            lineas.push(`<div style="margin-top:5px; padding-top:5px; border-top:1px dashed #ddd; font-size:0.85em; color:#555;">
                <b>Prov:</b> ${s.proveedor} &nbsp;|&nbsp; <b>Costo:</b> $${formatMoney(s.costo)}
            </div>`);

            if(s.obs) lineas.push(`<i>Obs: ${s.obs}</i>`);
            html += `<div style="margin-bottom:10px; border-left:3px solid #ddd; padding-left:10px;"><div style="color:#11173d; font-weight:bold;">${icono} ${titulo}</div><div style="font-size:0.9em; color:#555;">${lineas.map(l=>`<div>${l}</div>`).join('')}</div></div>`;
        });
        return html;
    }

    function openModal(pkg) {
        const serviciosHTML = renderServiciosHTML(pkg['servicios'] || pkg['item.servicios']);
        dom.modalBody.innerHTML = `
            <div class="modal-detalle-header"><h2>${pkg['destino']}</h2></div>
            <div class="modal-detalle-body">
                <div class="detalle-full precio-final"><label>Precio Venta</label><p>${pkg['moneda']} $${formatMoney(pkg['tarifa'])}</p></div>
                <div class="detalle-item"><label>Salida</label><p>${formatDateAR(pkg['fecha_salida'])} (${pkg['salida']})</p></div>
                <div class="detalle-item"><label>Costo Total</label><p>${pkg['moneda']} $${formatMoney(pkg['costos_proveedor'])}</p></div>
                <div class="detalle-full"><h4 style="border-bottom:1px solid #eee;">Detalle de Servicios</h4>${serviciosHTML}</div>
                ${pkg['financiacion'] ? `<div class="detalle-full" style="background:#e3f2fd; padding:10px;"><b>Financ.:</b> ${pkg['financiacion']}</div>` : ''}
                <div class="detalle-item" style="text-align:right; border:none;"><small>Cargado por: ${pkg['creador']}</small></div>
            </div>
        `;
        dom.modal.style.display = 'flex';
    }

    // Funciones de vista y cierre
    function fetchAndLoadPackages() { /* Reutiliza la lógica de búsqueda inicial */ fetchPackages(); }
    async function fetchPackages(f={}) { try{ const d=await secureFetch(API_URL_SEARCH, f); allPackages=d.sort((a,b)=>(b['fecha_creacion']||'').localeCompare(a['fecha_creacion']||'')); renderCards(allPackages); }catch(e){console.error(e);} }
    function showView(n) { dom.viewSearch.classList.toggle('active',n==='search'); dom.viewUpload.classList.toggle('active',n==='upload'); dom.navSearch.classList.toggle('active',n==='search'); dom.navUpload.classList.toggle('active',n==='upload'); }
    dom.navSearch.onclick=()=>showView('search'); dom.navUpload.onclick=()=>showView('upload');
    dom.grid.addEventListener('click', e => { const c=e.target.closest('.paquete-card'); if(c) openModal(JSON.parse(c.dataset.packageData)); });
    dom.modalClose.onclick=()=>dom.modal.style.display='none'; window.onclick=e=>{if(e.target===dom.modal)dom.modal.style.display='none';};

    // Buscador local
    dom.btnBuscar.addEventListener('click', () => {
        const fDestino = document.getElementById('filtro-destino').value.toLowerCase();
        const fCreador = document.getElementById('filtro-creador').value;
        const fPromo = document.getElementById('filtro-promo').value;
        const filtrados = allPackages.filter(pkg => {
            const m1 = !fDestino || (pkg.destino && pkg.destino.toLowerCase().includes(fDestino));
            const m2 = !fCreador || (pkg.creador && pkg.creador === fCreador);
            const m3 = !fPromo || (pkg.tipo_promo && pkg.tipo_promo === fPromo);
            return m1 && m2 && m3;
        });
        renderCards(filtrados);
    });
    dom.btnLimpiar.addEventListener('click', () => { document.getElementById('filtro-destino').value=''; document.getElementById('filtro-creador').value=''; document.getElementById('filtro-promo').value=''; renderCards(allPackages); });
});
