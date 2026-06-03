document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURACIÓN FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyCBiyH6HTatUxNxQ6GOxGp-xFWa7UfCMJk",
        authDomain: "feliz-viaje-43d02.firebaseapp.com",
        projectId: "feliz-viaje-43d02",
        storageBucket: "feliz-viaje-43d02.firebasestorage.app",
        messagingSenderId: "931689659600",
        appId: "1:931689659600:web:66dbce023705936f26b2d5",
        measurementId: "G-2PNDZR3ZS1"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();
    const db = firebase.firestore(); 

    // DOM Elements
    const dom = {
        grid: document.getElementById('grilla-paquetes'),
        modal: document.getElementById('modal-detalle'),
        modalBody: document.getElementById('modal-body'),
        modalClose: document.getElementById('modal-cerrar'),
        btnBuscar: document.getElementById('boton-buscar'),
        filtroDestino: document.getElementById('filtro-destino'),
        filtroSalida: document.getElementById('filtro-salida'),
        filtroOrden: document.getElementById('filtro-orden'),
        loader: document.getElementById('loader-overlay')
    };

    let allPackages = [];
    
    // --- NÚMERO OFICIAL DE WHATSAPP ---
    // Colocá acá el número de la franquicia o el bot principal (sin el +, ej: 5491100000000)
    const WPP_NUMBER = "5493512444868";

    const showLoader = (show) => { 
        if(dom.loader) dom.loader.style.display = show ? 'flex' : 'none'; 
    };
    
    const formatMoney = (a) => new Intl.NumberFormat('es-AR', { style: 'decimal', minimumFractionDigits: 0 }).format(a);
    const formatDateAR = (s) => { if(!s) return '-'; const p = s.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s; };
    
    function getNoches(pkg) {
        let servicios = []; try { const raw = pkg['servicios'] || pkg['item.servicios']; servicios = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch(e) {}
        if(!Array.isArray(servicios)) return 0;
        let totalHotel = 0; let hayHotel = false;
        servicios.forEach(s => { if (s.tipo === 'hotel' && s.noches) { totalHotel += parseInt(s.noches) || 0; hayHotel = true; } });
        if(hayHotel && totalHotel > 0) return totalHotel;
        const bus = servicios.find(s => s.tipo === 'bus'); if (bus && bus.noches) return parseInt(bus.noches);
        const crucero = servicios.find(s => s.tipo === 'crucero'); if (crucero && crucero.crucero_noches) return parseInt(crucero.crucero_noches);
        const circuito = servicios.find(s => s.tipo === 'circuito'); if (circuito && circuito.circuito_noches) return parseInt(circuito.circuito_noches);
        if(!pkg['fecha_salida']) return 0;
        let fechaStr = pkg['fecha_salida']; if(fechaStr.includes('/')) fechaStr = fechaStr.split('/').reverse().join('-');
        const start = new Date(fechaStr + 'T00:00:00'); let maxDate = new Date(start), hasData = false;
        servicios.forEach(s => {
            if(s.tipo==='hotel'&&s.checkout){ const d=new Date(s.checkout+'T00:00:00'); if(d>maxDate){maxDate=d; hasData=true;} }
            if(s.tipo==='aereo'&&s.fecha_regreso){ const d=new Date(s.fecha_regreso+'T00:00:00'); if(d>maxDate){maxDate=d; hasData=true;} }
            if(s.tipo==='crucero'&&s.checkout){ const d=new Date(s.checkout+'T00:00:00'); if(d>maxDate){maxDate=d; hasData=true;} }
            if(s.tipo==='circuito'&&s.checkout){ const d=new Date(s.checkout+'T00:00:00'); if(d>maxDate){maxDate=d; hasData=true;} }
        });
        return hasData ? Math.ceil((maxDate - start) / 86400000) : 0;
    }

    // --- REGLA DE LA CENICIENTA (CORTE 12:00 HS ARGENTINA) ---
    const getCutoffEpoch = () => {
        const now = new Date();
        // Llevamos la hora a UTC pura y le restamos 3 horas para tener la hora exacta de Argentina siempre
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const arTime = new Date(utcTime - (3 * 3600000)); 
        
        const arHour = arTime.getHours();
        const arYear = arTime.getFullYear();
        const arMonth = arTime.getMonth();
        let arDay = arTime.getDate();
        
        // Si son antes de las 12 del mediodía en Arg, permitimos ver lo de ayer
        if (arHour < 12) {
            arDay -= 1; 
        }
        
        // Creamos la fecha límite (00:00 hs del día permitido, en UTC equivale a las 03:00)
        const cutoffUtc = new Date(Date.UTC(arYear, arMonth, arDay, 3, 0, 0, 0));
        return cutoffUtc.getTime();
    };

    // --- AUTENTICACIÓN INVISIBLE ---
    auth.signInAnonymously()
        .then(() => {
            fetchAndLoadPackages();
        })
        .catch((error) => {
            console.error("Error Auth:", error);
            dom.grid.innerHTML = '<p style="text-align:center;">Error al conectar con el servidor.</p>';
            showLoader(false);
        });

    // --- CARGA Y FILTRADO INICIAL ---
    async function fetchAndLoadPackages() { 
        showLoader(true);
        try { 
            const snapshot = await db.collection('paquetes').get();
            const cutoffEpoch = getCutoffEpoch();
            
            allPackages = snapshot.docs.map(doc => ({ id_paquete: doc.id, ...doc.data() }))
                .filter(pkg => {
                    // 1. Ocultar promociones "Secretas" de la empresa
                    if (pkg.alcance === 'casa_central') return false;
                    // 2. Solo promociones Aprobadas
                    if (pkg.status === 'pending') return false;
                    // 3. LA REGLA DE TIEMPO: Solo del día o de ayer si es antes de las 12
                    if (pkg.timestamp && pkg.timestamp < cutoffEpoch) return false;
                    
                    return true;
                });
                
            applyFilters();
            
        } catch(e) { 
            console.error("Error Firebase:", e); 
            dom.grid.innerHTML = '<p style="text-align:center;">No se pudieron cargar las promociones.</p>';
        }
        showLoader(false);
    }

    function applyFilters() {
        const normalizeText = (text) => text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : '';

        const fDestino = normalizeText(dom.filtroDestino.value);
        const fSalida = dom.filtroSalida.value;
        const fOrden = dom.filtroOrden.value;

        let result = allPackages.filter(pkg => {
            if (fDestino && !normalizeText(pkg.destino).includes(fDestino)) return false;
            if (fSalida && pkg.salida !== fSalida) return false;
            return true;
        });

        if (fOrden === 'reciente') {
            result.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        } else if (fOrden === 'menor_precio') {
            result.sort((a, b) => parseFloat(a.tarifa) - parseFloat(b.tarifa));
        } else if (fOrden === 'mayor_precio') {
            result.sort((a, b) => parseFloat(b.tarifa) - parseFloat(a.tarifa));
        }

        renderCards(result);
    }

    // --- RENDERIZADO B2C DE LA GRILLA ---
    function renderCards(list) {
        dom.grid.innerHTML = ''; 
        if (!list || list.length === 0) { 
            dom.grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#666;">No encontramos viajes para esa búsqueda, ¡Contactanos al WhatsApp y lo armamos a medida!</p>'; 
            return; 
        }
        
        list.forEach(pkg => {
            if (!pkg.destino) return; 
            const card = document.createElement('div');
            
            // Calculamos noches y aéreos simple
            const noches = getNoches(pkg); // <--- AGREGAMOS ESTO
            let sGrid = []; try { sGrid = typeof pkg.servicios === 'string' ? JSON.parse(pkg.servicios) : pkg.servicios; } catch(e){}
            const tieneAereo = Array.isArray(sGrid) && sGrid.some(s => s.tipo === 'aereo');
            const esCircuito = Array.isArray(sGrid) && sGrid.some(s => s.tipo === 'circuito');
            const fechaMostrar = (!pkg.fecha_salida && esCircuito && !tieneAereo) ? 'Múltiples Salidas' : formatDateAR(pkg.fecha_salida);
            
            card.className = 'paquete-card'; 
            const tarifaMostrar = parseFloat(pkg['tarifa']) || 0; 
            
            // Mapeo Iconos
            const m = {'aereo':'✈️','hotel':'🏨','traslado':'🚕','seguro':'🛡️','bus':'🚌','crucero':'🚢','circuito':'🗺️'};
            const summaryIcons = [...new Set((Array.isArray(sGrid)?sGrid:[]).map(x => m[x.tipo] || '🔹'))].join(' '); 

            card.innerHTML = `
                <div class="card-clickable" style="height:100%;">
                    <div class="card-header">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%;">
                            <div style="max-width:75%; padding-right:10px;">
                                <h3 style="margin:0;font-size:1.4em;line-height:1.2;color:#11173d;">${pkg.destino}</h3>
                            </div>
                            <!-- MAGIA: PASTILLA DE NOCHES -->
                            ${noches > 0 ? `<div style="background:#eef2f5;color:#11173d;padding:5px 10px;border-radius:12px;font-weight:bold;font-size:0.8em;white-space:nowrap;">🌙 ${noches}</div>` : ''}
                        </div>
                        <div class="fecha">📅 Salida: ${fechaMostrar}</div>
                    </div>
                    
                    <div class="card-body">
                        <div style="font-size:1em;color:#555;">${summaryIcons}</div>
                    </div>
                    
                    <div class="card-footer" style="display:flex; justify-content:flex-end; align-items:flex-end;">
                        <div style="text-align: right;">
                            <div style="font-size: 0.85em; color: #666; font-weight: 500; margin-bottom: -5px;">Desde ${pkg.salida || 'Varias'}</div>
                            <p class="precio-valor" style="margin: 5px 0 0 0;">
                                ${pkg.moneda} $${formatMoney(Math.round(tarifaMostrar/2))} <span style="font-size:0.5em; color:#999; font-weight:normal;">x Persona</span>
                            </p>
                        </div>
                    </div>
                </div>`;
            
            dom.grid.appendChild(card); 
            card.querySelector('.card-clickable').addEventListener('click', () => openModal(pkg, sGrid, fechaMostrar));
        });
    }

    // --- MODAL DE CLIENTES B2C ---
    function openModal(pkg) {
        if (typeof renderServiciosClienteHTML !== 'function') return alert("Falta la función renderServiciosClienteHTML.");
        
        const rawServicios = pkg['servicios'] || pkg['item.servicios']; 
        let serviciosModal = []; 
        try { serviciosModal = typeof rawServicios === 'string' ? JSON.parse(rawServicios) : rawServicios; } catch(e) {}
        
        let lugarSalidaModal = pkg['salida'];
        const esCircuitoModal = Array.isArray(serviciosModal) && serviciosModal.some(s => s.tipo === 'circuito');
        const fechaModal = (!pkg['fecha_salida'] && esCircuitoModal) ? 'Múltiples Salidas' : formatDateAR(pkg['fecha_salida']);
        const tieneAereoModal = Array.isArray(serviciosModal) && serviciosModal.some(s => s.tipo === 'aereo');
        if (!tieneAereoModal) {
            const crucero = Array.isArray(serviciosModal) && serviciosModal.find(s => s.tipo === 'crucero');
            const circuito = Array.isArray(serviciosModal) && serviciosModal.find(s => s.tipo === 'circuito');
            if (crucero && crucero.crucero_puerto_salida) {
                lugarSalidaModal = crucero.crucero_puerto_salida;
            } else if (circuito && circuito.circuito_salida) {
                lugarSalidaModal = circuito.circuito_salida;
            }
        }
        
        const htmlCliente = renderServiciosClienteHTML(rawServicios); 
        const noches = getNoches(pkg); 
        const tarifa = parseFloat(pkg['tarifa']) || 0; 
        const tarifaDoble = Math.round(tarifa / 2); 
        
        // Link de WhatsApp que se lleva el nombre del paquete
        const mensajeWa = encodeURIComponent(`Hola Feliz Viaje! Vengo de la web y quiero consultar por el paquete a ${pkg['destino']} (Salida: ${fechaModal}).`);
        const btnConsultarWpp = `<a href="https://wa.me/${WPP_NUMBER}?text=${mensajeWa}" target="_blank" style="background: #25d366; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; text-decoration: none; text-align: center; display: block; margin-top: 20px; font-size: 1.1em; transition: 0.2s;" onmouseover="this.style.background='#1da851'" onmouseout="this.style.background='#25d366'">💬 Consultar al Asesor</a>`;

        dom.modalBody.innerHTML = `
            <div class="modal-detalle-header" style="display:block; padding-bottom: 25px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <h2 style="margin:0;font-size:2.2em;line-height:1.1;">${pkg['destino']}</h2>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; padding: 20px;">
                <div>
                    <h3 style="border-bottom:2px solid #eee; padding-bottom:10px; margin-top:0; color:#11173d;">Itinerario</h3>
                    ${htmlCliente}
                </div>
                <div style="background:#f9fbfd; padding:15px; border-radius:8px; height:fit-content; border: 1px solid #e5e7eb;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                        <h4 style="margin:0; color:#11173d;">Resumen del Viaje</h4>
                    </div>
                    <p style="margin:5px 0; font-size:0.9em;"><b>📅 Salida:</b> ${fechaModal}</p>
                    <p style="margin:5px 0; font-size:0.9em;"><b>📍 Desde:</b> ${lugarSalidaModal}</p>
                    <p style="margin:5px 0; font-size:0.9em;"><b>🌙 Duración:</b> ${noches > 0 ? noches + ' Noches' : '-'}</p>
                    
                    ${pkg['financiacion'] ? `<div style="margin-top:15px; background:#e3f2fd; padding:10px; border-radius:5px; font-size:0.85em;"><b>💳 Financiación / Notas:</b><br>${pkg['financiacion']}</div>` : ''}
                    
                    ${btnConsultarWpp}
                </div>
            </div>
            
            <div style="background:#11173d; color:white; padding:15px 20px; display:flex; justify-content:center; align-items:center; border-radius:0 0 12px 12px;">
                <div style="text-align:center;">
                    <small style="opacity:0.7; text-transform: uppercase;">Tarifa final por Persona (Base Doble)</small>
                    <div style="font-size:2.5em; font-weight:bold; color:#56DDE0; line-height: 1;">${pkg['moneda']} $${formatMoney(tarifaDoble)}</div>
                </div>
            </div>`;
        
        dom.modal.style.display = 'flex';
    }

    // Eventos
    dom.modalClose.onclick = () => dom.modal.style.display = 'none';
    window.onclick = e => { if(e.target === dom.modal) dom.modal.style.display='none'; };
    dom.btnBuscar.addEventListener('click', applyFilters);
    [dom.filtroSalida, dom.filtroOrden].forEach(el => el.addEventListener('change', applyFilters));

});