document.addEventListener('DOMContentLoaded', () => {

    // 1. CONFIGURACIÓN
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

    const allowedEmails = [
        'yairlaquis@gmail.com'
    ];

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const provider = new firebase.auth.GoogleAuthProvider();
    let currentUser = null;
    let allPackages = [];

    // SELECTORES DOM
    const dom = {
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
        inputFechaViaje: document.getElementById('upload-fecha-salida'),
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
        btnLimpiar: document.getElementById('boton-limpiar'), 
        logo: document.querySelector('.logo'),
        filtroOrden: document.getElementById('filtro-orden')
    };

    if(dom.logo) { 
        dom.logo.style.cursor = 'pointer'; 
        dom.logo.addEventListener('click', () => window.location.reload()); 
    }

    // AUTH
    auth.onAuthStateChanged(async (u) => {
        if (u && allowedEmails.includes(u.email)) {
            currentUser = u; 
            dom.loginContainer.style.display='none'; 
            dom.appContainer.style.display='block';
            dom.userEmail.textContent = u.email; 
            await fetchAndLoadPackages(); 
            showView('search');
        } else { 
            currentUser=null; 
            if(u) auth.signOut(); 
            dom.loginContainer.style.display='flex'; 
            dom.appContainer.style.display='none'; 
        }
    });

    dom.btnLogin.addEventListener('click', () => auth.signInWithPopup(provider));
    dom.btnLogout.addEventListener('click', () => auth.signOut());

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

    const formatMoney = (a) => new Intl.NumberFormat('es-AR', { style: 'decimal', minimumFractionDigits: 0 }).format(a);
    const formatDateAR = (s) => { 
        if(!s) return '-'; 
        const p = s.split('-'); 
        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s; 
    };

    // --- NUEVA FUNCIÓN DE ALERTA MODERNA ---
    window.showAlert = (message, type = 'error') => {
        return new Promise((resolve) => {
            const overlay = document.getElementById('custom-alert-overlay');
            if(!overlay) { alert(message); return resolve(); } // Fallback por seguridad

            const title = document.getElementById('custom-alert-title');
            const msg = document.getElementById('custom-alert-message');
            const icon = document.getElementById('custom-alert-icon');
            const btn = document.getElementById('custom-alert-btn');

            if (type === 'success') {
                title.innerText = '¡Éxito!';
                title.style.color = '#4caf50';
                icon.innerHTML = '✅';
            } else {
                title.innerText = 'Atención';
                title.style.color = '#ef5a1a';
                icon.innerHTML = '⚠️';
            }

            msg.innerText = message;
            overlay.style.display = 'flex';

            btn.onclick = () => {
                overlay.style.display = 'none';
                resolve();
            };
        });
    };

    // LÓGICA DE SERVICIOS
    dom.btnAgregarServicio.addEventListener('click', () => { if (dom.selectorServicio.value) { agregarModuloServicio(dom.selectorServicio.value); dom.selectorServicio.value = ""; } });
    
    function agregarModuloServicio(tipo) {
        const id = Date.now(); const div = document.createElement('div');
        div.className = `servicio-card ${tipo}`; div.dataset.id = id; div.dataset.tipo = tipo;
        const fechaBase = dom.inputFechaViaje.value || '';
        let html = `<button type="button" class="btn-eliminar-servicio" onclick="this.parentElement.remove(); window.calcularTotal();">×</button>`;
        
        if (tipo === 'aereo') { html += `<h4>✈️ Aéreo</h4><div class="form-group-row"><div class="form-group"><label>Aerolínea</label><input type="text" name="aerolinea" required></div><div class="form-group"><label>Ida</label><input type="date" name="fecha_aereo" value="${fechaBase}" required></div><div class="form-group"><label>Vuelta</label><input type="date" name="fecha_regreso"></div></div><div class="form-group-row"><div class="form-group"><label>Escalas</label>${crearContadorHTML('escalas', 0)}</div><div class="form-group"><label>Equipaje</label><select name="tipo_equipaje"><option>Objeto Personal</option><option>Carry On</option><option>Carry On + Bodega</option><option>Bodega (15kg)</option><option>Bodega (23kg)</option></select></div></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`; }
        else if (tipo === 'hotel') { html += `<h4>🏨 Hotel</h4><div class="form-group"><label>Alojamiento</label><input type="text" name="hotel_nombre" required></div><div class="form-group-row"><div class="form-group"><label>Check In</label><input type="date" name="checkin" value="${fechaBase}" onchange="window.calcularNoches(${id})" required></div><div class="form-group"><label>Check Out</label><input type="date" name="checkout" onchange="window.calcularNoches(${id})" required></div><div class="form-group"><label>Noches</label><input type="text" id="noches-${id}" readonly style="background:#eee; width:60px;"></div></div><div class="form-group"><label>Régimen</label><select name="regimen"><option>Solo Habitación</option><option>Desayuno</option><option>Media Pensión</option><option>All Inclusive</option></select></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`; }
        else if (tipo === 'traslado') { html += `<h4>🚌 Traslado</h4><div class="checkbox-group"><label class="checkbox-label"><input type="checkbox" name="trf_in"> In</label><label class="checkbox-label"><input type="checkbox" name="trf_out"> Out</label><label class="checkbox-label"><input type="checkbox" name="trf_hah"> Htl-Htl</label></div><div class="form-group-row"><div class="form-group"><label>Tipo</label><select name="tipo_trf"><option>Compartido</option><option>Privado</option></select></div><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`; }
        else if (tipo === 'seguro') { html += `<h4>🛡️ Seguro</h4><div class="form-group-row"><div class="form-group"><label>Cobertura</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`; }
        else if (tipo === 'adicional') { html += `<h4>➕ Adicional</h4><div class="form-group"><label>Detalle</label><input type="text" name="descripcion" required></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`; }
        
        div.innerHTML = html; dom.containerServicios.appendChild(div);
    }

    window.crearContadorHTML = (n, v) => `<div class="counter-wrapper"><button type="button" class="counter-btn" onclick="this.nextElementSibling.innerText=Math.max(0,parseInt(this.nextElementSibling.innerText)-1)">-</button><span class="counter-value">${v}</span><button type="button" class="counter-btn" onclick="this.previousElementSibling.innerText=parseInt(this.previousElementSibling.innerText)+1">+</button><input type="hidden" name="${n}" value="${v}"></div>`;
    window.calcularNoches = (id) => { const c=document.querySelector(`.servicio-card[data-id="${id}"]`), i=new Date(c.querySelector('input[name="checkin"]').value), o=new Date(c.querySelector('input[name="checkout"]').value); document.getElementById(`noches-${id}`).value=(i&&o&&o>i)?Math.ceil((o-i)/86400000):'-'; };
    window.calcularTotal = () => { let t=0; document.querySelectorAll('.input-costo').forEach(i=>t+=parseFloat(i.value)||0); dom.inputCostoTotal.value=t; };

    // --- FORMULARIO DE CARGA (CORREGIDO) ---
    dom.uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const costo = parseFloat(dom.inputCostoTotal.value) || 0;
        const tarifa = parseFloat(document.getElementById('upload-tarifa-total').value) || 0;
        const fechaViajeStr = dom.inputFechaViaje.value;

        // VALIDACIONES
        if (tarifa < costo) return window.showAlert(`Error: La tarifa ($${tarifa}) es menor al costo ($${costo}).`, 'error');
        if (!fechaViajeStr) return window.showAlert("Falta fecha de salida.", 'error');
        
        const fechaViaje = new Date(fechaViajeStr + 'T00:00:00');
        const cards = document.querySelectorAll('.servicio-card');
        if (cards.length === 0) return window.showAlert("Agrega al menos un servicio.", 'error');

        let fechaRegresoVuelo = null;
        let errorMsg = null;
        let serviciosData = [];

        cards.forEach(c => { 
            if(c.dataset.tipo==='aereo'){ 
                const r = c.querySelector('input[name="fecha_regreso"]'); 
                if(r && r.value){ 
                    const f = new Date(r.value+'T00:00:00'); 
                    if(!fechaRegresoVuelo || f > fechaRegresoVuelo) fechaRegresoVuelo = f; 
                } 
            } 
        });

        for(let card of cards){
            const tipo = card.dataset.tipo;
            const inputs = card.querySelectorAll('input[type="date"]');
            
            for(let i of inputs){ 
                if(i.value && new Date(i.value+'T00:00:00') < fechaViaje){ 
                    errorMsg = `Servicio ${tipo}: Fecha anterior a la salida.`; 
                    break;
                } 
            }
            if(errorMsg) break;
            
            if(tipo === 'hotel'){ 
                const i = card.querySelector('input[name="checkin"]').value;
                const o = card.querySelector('input[name="checkout"]').value;
                if(i && o && new Date(o) <= new Date(i)){ 
                    errorMsg = "HOTEL: Check-out erróneo."; 
                    break; 
                } 
            }
            
            if(fechaRegresoVuelo){
                let fin = null;
                if(tipo === 'hotel'){ 
                    const o = card.querySelector('input[name="checkout"]').value; 
                    if(o) fin = new Date(o+'T00:00:00'); 
                }
                if(fin){ 
                    const lim = new Date(fechaRegresoVuelo);
                    if(tipo === 'hotel' || tipo === 'seguro') lim.setDate(lim.getDate()+1); 
                    if(fin > lim){ 
                        errorMsg = `${tipo} termina después del vuelo.`; 
                        break; 
                    } 
                }
            }

            const serv = { tipo };
            card.querySelectorAll('input, select').forEach(i => { 
                if(i.type === 'checkbox') serv[i.name] = i.checked; 
                else if(i.type === 'hidden') serv[i.name] = i.parentElement.querySelector('.counter-value')?.innerText || i.value; 
                else serv[i.name] = i.value; 
            }); 
            serviciosData.push(serv);
        }

        if(errorMsg) return window.showAlert(errorMsg, 'error');

        dom.btnSubir.disabled = true; 
        dom.uploadStatus.textContent = 'Guardando...';

        try { 
            await secureFetch(API_URL_UPLOAD, { 
                destino: document.getElementById('upload-destino').value, 
                salida: document.getElementById('upload-salida').value, 
                fecha_salida: fechaViajeStr, 
                costos_proveedor: costo, 
                tarifa: tarifa, // CORREGIDO: Se envía como 'tarifa'
                moneda: document.getElementById('upload-moneda').value, 
                tipo_promo: document.getElementById('upload-promo').value, 
                financiacion: document.getElementById('upload-financiacion').value, 
                servicios: serviciosData 
            }); 
            
            await window.showAlert('¡Paquete guardado con éxito!', 'success'); 
            window.location.reload();
        } catch(e) { 
            console.error(e); 
            dom.uploadStatus.textContent = 'Error al guardar'; 
            window.showAlert("Error de conexión al guardar.", 'error');
            dom.btnSubir.disabled = false; 
        }
    });

    // RENDERIZADO
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
    function getSummaryIcons(pkg) {
        let servicios = [];
        try { const raw = pkg['servicios'] || pkg['item.servicios']; servicios = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) {}
        if (!Array.isArray(servicios) || servicios.length === 0) return '<span style="opacity:0.6">Sin servicios</span>';
        
        const iconMap = { 'aereo': '✈️ Aéreo', 'hotel': '🏨 Hotel', 'traslado': '🚌 Traslado', 'seguro': '🛡️ Seguro', 'adicional': '➕ Adic.' };
        const uniqueTypes = [...new Set(servicios.map(s => iconMap[s.tipo] || s.tipo))];
        
        // CAMBIO: Envolvemos cada item en un span que no permite saltos de línea internos
        // y usamos un contenedor flex en el renderCards para que se acomoden solos.
        return uniqueTypes.map(t => 
            `<span style="white-space:nowrap; display:inline-block; margin-right:8px; margin-bottom:4px; background:#f4f7f9; padding:2px 8px; border-radius:4px;">${t}</span>`
        ).join('');
    }

    function renderCards(list) {
        dom.loader.style.display='none'; 
        dom.grid.innerHTML=''; 
        if(!list || list.length === 0){ dom.grid.innerHTML='<p>No hay resultados.</p>'; return; }
        
        list.forEach(pkg => {
            const card = document.createElement('div');
            const noches = getNoches(pkg); 
            card.className = 'paquete-card'; 
            card.dataset.packageData = JSON.stringify(pkg);
            
            const tarifaMostrar = parseFloat(pkg['tarifa']) || 0;
            const summaryIcons = getSummaryIcons(pkg);
    
            // Estilo de la burbuja (Cyan/Turquesa)
            const bubbleStyle = `
                background-color: #56DDE0; 
                color: #11173d; 
                padding: 4px 12px; 
                border-radius: 20px; 
                font-weight: 600; 
                font-size: 0.75em; 
                display: inline-block;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            `;
    
            card.innerHTML = `
                <div class="card-header" style="padding-bottom: 0;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                        <div style="max-width:75%;">
                            <h3 style="margin:0; font-size:1.5em; line-height:1.2; color: #11173d;">${pkg['destino']}</h3>
                        </div>
                        
                        ${noches > 0 ? `<div style="background:#eef2f5; color:#11173d; padding:5px 10px; border-radius:12px; font-weight:bold; font-size:0.8em; white-space:nowrap; box-shadow:0 2px 5px rgba(0,0,0,0.05);">🌙 ${noches}</div>` : ''}
                    </div>
    
                    <div style="margin-top: 8px; margin-bottom: 25px; font-size:0.9em; color:#666; font-weight:500; display:flex; align-items:center; gap:6px;">
                        <span>📅 Salida: ${formatDateAR(pkg['fecha_salida'])}</span>
                    </div>
                </div>
    
                <div class="card-body" style="padding: 0 20px 15px 20px; display:flex; align-items:center;">
                    <div style="font-size:0.75em; color:#555; display:flex; flex-wrap:wrap; line-height:1.4;">
                        ${summaryIcons}
                    </div>
                </div>
    
                <div class="card-footer" style="padding-top:15px; border-top: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="${bubbleStyle}">${pkg['tipo_promo']}</span>
                    </div>
                    <div>
                        <p class="precio-valor" style="font-size: 1.8em; margin:0; color: #ef5a1a;">${pkg['moneda']} $${formatMoney(Math.round(tarifaMostrar / 2))}</p>
                    </div>
                </div>`;
            dom.grid.appendChild(card);
        });
    }
    
    function renderServiciosClienteHTML(rawJson) {
        let servicios=[]; try{ servicios=typeof rawJson==='string'?JSON.parse(rawJson):rawJson; }catch(e){ return '<p>Sin detalles.</p>'; }
        if(!Array.isArray(servicios)||servicios.length===0) return '<p>Sin detalles.</p>';
        let html='';
        servicios.forEach(s => {
            let icono='🔹', titulo='', lineas=[];
            if(s.tipo==='aereo'){ icono='✈️'; titulo='AÉREO'; lineas.push(`<b>Aerolínea:</b> ${s.aerolinea}`); lineas.push(`<b>Fechas:</b> ${formatDateAR(s.fecha_aereo)}${s.fecha_regreso?` | <b>Vuelta:</b> ${formatDateAR(s.fecha_regreso)}`:''}`); lineas.push(`<b>Escalas:</b> ${s.escalas==0?'Directo':s.escalas}`); lineas.push(`<b>Equipaje:</b> ${s.tipo_equipaje.replace(/_/g,' ')} (x${s.cantidad_equipaje||1})`); }
            else if(s.tipo==='hotel'){ icono='🏨'; titulo='HOTEL'; lineas.push(`<b>${s.hotel_nombre}</b> (${s.regimen})`); lineas.push(`<b>Estadía:</b> ${(s.checkin&&s.checkout)?Math.ceil((new Date(s.checkout)-new Date(s.checkin))/86400000):'-'} noches (${formatDateAR(s.checkin)} al ${formatDateAR(s.checkout)})`); }
            else if(s.tipo==='traslado'){ icono='🚌'; titulo='TRASLADO'; let t=[]; if(s.trf_in)t.push("In"); if(s.trf_out)t.push("Out"); if(s.trf_hah)t.push("Htl-Htl"); lineas.push(`<b>Tipo:</b> ${s.tipo_trf} (${t.join(' + ')})`); }
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
        const tarifa = parseFloat(pkg['tarifa']) || 0;
        const tarifaDoble = Math.round(tarifa / 2);

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
                    <div><small style="opacity:0.7;">Tarifa Final</small><div style="font-size:1.2em; font-weight:bold; color:#ef5a1a;">${pkg['moneda']} $${formatMoney(tarifa)}</div></div>
                    <div><small style="opacity:0.7;">x Persona (Base Doble)</small><div style="font-size:1.2em; font-weight:bold; color:#4caf50;">${pkg['moneda']} $${formatMoney(tarifaDoble)}</div></div>
                </div>
                <div style="text-align:right;"><small style="opacity:0.7;">Cargado por:</small><div style="font-size:0.9em;">${pkg['creador']}</div></div>
            </div>`;
        dom.modal.style.display = 'flex';
    }

    // --- FILTROS Y ORDENAMIENTO (CORREGIDO) ---
    function applyFilters() {
        const fDestino = document.getElementById('filtro-destino').value.toLowerCase();
        const fCreador = document.getElementById('filtro-creador').value;
        const fPromo = document.getElementById('filtro-promo').value;
        const fOrden = document.getElementById('filtro-orden') ? document.getElementById('filtro-orden').value : 'reciente';
        
        // 1. Crear copia para filtrar
        let result = allPackages.filter(pkg => {
            const mDestino = !fDestino || (pkg.destino && pkg.destino.toLowerCase().includes(fDestino));
            const mCreador = !fCreador || (pkg.creador && pkg.creador === fCreador);
            const mPromo = !fPromo || (pkg.tipo_promo && pkg.tipo_promo === fPromo);
            return mDestino && mCreador && mPromo;
        });

        // 2. Ordenar
        if (fOrden === 'menor_precio') {
            result.sort((a, b) => parseFloat(a.tarifa) - parseFloat(b.tarifa));
        } else if (fOrden === 'mayor_precio') {
            result.sort((a, b) => parseFloat(b.tarifa) - parseFloat(a.tarifa));
        } else {
            // "Más Recientes" (por defecto)
            // Asumimos que Google Sheets entrega los datos históricos (antiguos primero)
            // Invertimos la copia del array.
            result.reverse(); 
        }

        renderCards(result);
    }

    function fetchAndLoadPackages() { fetchPackages(); }
    
    async function fetchPackages(f={}) { 
        try{ 
            // Obtenemos los paquetes en orden original del Sheet (Antiguo -> Nuevo)
            const d = await secureFetch(API_URL_SEARCH, f); 
            allPackages = d; 
            applyFilters(); 
        } catch(e){ console.error(e); } 
    }

    function showView(n) { 
        dom.viewSearch.classList.toggle('active', n === 'search'); 
        dom.viewUpload.classList.toggle('active', n === 'upload'); 
        dom.navSearch.classList.toggle('active', n === 'search'); 
        dom.navUpload.classList.toggle('active', n === 'upload'); 
    }
    
    dom.navSearch.onclick = () => showView('search'); 
    dom.navUpload.onclick = () => showView('upload');
    dom.grid.addEventListener('click', e => { const c=e.target.closest('.paquete-card'); if(c) openModal(JSON.parse(c.dataset.packageData)); });
    dom.modalClose.onclick = () => dom.modal.style.display='none'; 
    window.onclick = e => { if(e.target === dom.modal) dom.modal.style.display='none'; };
    
    dom.btnBuscar.addEventListener('click', applyFilters);
    dom.btnLimpiar.addEventListener('click', () => { 
        document.getElementById('filtro-destino').value=''; 
        document.getElementById('filtro-creador').value=''; 
        document.getElementById('filtro-promo').value='';
        if(dom.filtroOrden) dom.filtroOrden.value='reciente';
        applyFilters(); 
    });
    if(dom.filtroOrden) dom.filtroOrden.addEventListener('change', applyFilters);
});







