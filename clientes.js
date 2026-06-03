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
    const WPP_NUMBER = "5491100000000";

    const showLoader = (show) => { 
        if(dom.loader) dom.loader.style.display = show ? 'flex' : 'none'; 
    };
    
    const formatMoney = (a) => new Intl.NumberFormat('es-AR', { style: 'decimal', minimumFractionDigits: 0 }).format(a);
    const formatDateAR = (s) => { if(!s) return '-'; const p = s.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s; };

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
                            <div style="max-width:85%;">
                                <h3 style="margin:0;font-size:1.4em;line-height:1.2;color:#11173d;">${pkg.destino}</h3>
                            </div>
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

    // --- MODAL DE CLIENTES (SIN HERRAMIENTAS INTERNAS) ---
    function openModal(pkg, serviciosModal, fechaModal) {
        
        let htmlCliente = ''; 
        if(Array.isArray(serviciosModal)) {
            serviciosModal.forEach(x => {
                let i='🔹',t='',l=[]; 
                if(x.tipo==='aereo'){
                    i='✈️';t='AÉREO';
                    l.push(`<b>${x.aerolinea || ''}</b>`);
                    l.push(`${formatDateAR(x.fecha_aereo)}${x.fecha_regreso?` - ${formatDateAR(x.fecha_regreso)}`:''}`);
                    let eIda = (x.escalas_ida !== undefined) ? parseInt(x.escalas_ida) : (parseInt(x.escalas) || 0);
                    let eVuelta = (x.escalas_vuelta !== undefined) ? parseInt(x.escalas_vuelta) : (parseInt(x.escalas) || 0);
                    l.push(`🔄 IDA: ${eIda===0?'Directo':eIda+' Escala'} | REG: ${eVuelta===0?'Directo':eVuelta+' Escala'}`);
                } 
                else if(x.tipo==='hotel'){
                    i='🏨';t='HOTEL';
                    let stars = ''; if(x.hotel_estrellas) { for(let k=0; k<x.hotel_estrellas; k++) stars += '⭐'; }
                    l.push(`<b>${x.hotel_nombre}</b> <span style="color:#ef5a1a;">${stars}</span>`);
                    l.push(`(${x.regimen})`);
                    if(x.noches) l.push(`🌙 ${x.noches} Noches`);
                } 
                else if(x.tipo==='traslado'){i='🚕';t='TRASLADO';l.push(`${x.tipo_trf}`);} 
                else if(x.tipo==='seguro'){i='🛡️';t='SEGURO'; if(x.cobertura) l.push(x.cobertura);} 
                else if(x.tipo==='bus'){
                    i='🚌'; t='PAQUETE BUS';
                    if(x.noches) l.push(`🌙 <b>${x.noches} Noches</b>`);
                    if(x.incluye_alojamiento) { l.push(`🏨 <b>Hotel:</b> ${x.hotel_nombre}`); l.push(`🍽 <b>Régimen:</b> ${x.regimen}`); }
                    if(x.incluye_excursiones) l.push(`🌲 <b>Excursiones:</b> Incluidas`);
                }
                else if(x.tipo === 'crucero'){
                    i='🚢'; t='CRUCERO';
                    l.push(`<b>Naviera:</b> ${x.crucero_naviera}`);
                    if(x.crucero_noches) l.push(`🌙 ${x.crucero_noches} Noches`);
                    l.push(`Pensión Completa`);
                }
                else if(x.tipo === 'circuito'){
                    i='🗺️'; t='CIRCUITO TERRESTRE';
                    l.push(`<b>${x.circuito_nombre}</b>`);
                    if(x.circuito_noches) l.push(`🌙 ${x.circuito_noches} Noches`);
                }
                htmlCliente += `<div style="margin-bottom:15px; border-left:3px solid #ddd; padding-left:10px;"><div style="font-weight:bold;color:#11173d;">${i} ${t}</div><div style="font-size:0.9em; color:#555;">${l.join('<br>')}</div></div>`;
            });
        }

        const tarifa = parseFloat(pkg['tarifa']) || 0; 
        const tarifaDoble = Math.round(tarifa / 2); 
        
        // Link directo a WhatsApp con texto prearmado
        const mensajeWa = encodeURIComponent(`Hola Feliz Viaje! Vengo de la web y quiero consultar por el paquete a ${pkg['destino']} (Salida: ${fechaModal}). ¿Me pasan más info?`);
        const btnConsultarWpp = `<a href="https://wa.me/${WPP_NUMBER}?text=${mensajeWa}" target="_blank" style="background: #25d366; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; text-decoration: none; text-align: center; display: block; margin-top: 20px; font-size: 1.1em; transition: 0.2s;" onmouseover="this.style.background='#1da851'" onmouseout="this.style.background='#25d366'">💬 Consultar al Asesor</a>`;

        dom.modalBody.innerHTML = `
            <div class="modal-detalle-header" style="display:block; padding-bottom: 25px;">
                <h2 style="margin:0;font-size:2.2em;line-height:1.1;">${pkg.destino}</h2>
            </div>

            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; padding: 20px;">
                <div>
                    <h3 style="border-bottom:2px solid #eee; padding-bottom:10px; margin-top:0; color:#11173d;">Servicios Incluidos</h3>
                    ${htmlCliente || '<p>Servicios a confirmar</p>'}
                </div>
                
                <div style="background:#f9fbfd; padding:15px; border-radius:8px; height:fit-content; border: 1px solid #eee;">
                    <h4 style="margin:0 0 15px 0; color:#11173d; font-size:1.2em;">Resumen del Viaje</h4>
                    <p style="margin:8px 0; font-size:0.95em;"><b>📅 Salida:</b> ${fechaModal}</p>
                    <p style="margin:8px 0; font-size:0.95em;"><b>📍 Desde:</b> ${pkg.salida || '-'}</p>
                    
                    ${pkg.financiacion ? `<div style="margin-top:20px; background:#e3f2fd; padding:10px; border-radius:5px; font-size:0.85em; color:#11173d;"><b>💳 Financiación / Notas:</b><br>${pkg.financiacion}</div>` : ''}
                    
                    ${btnConsultarWpp}
                </div>
            </div>
            
            <div style="background:#11173d; color:white; padding:20px; display:flex; justify-content:center; align-items:center; border-radius:0 0 12px 12px;">
                <div style="text-align:center;">
                    <small style="opacity:0.8; font-size: 0.9em; text-transform: uppercase;">Tarifa final por persona (Base Doble)</small>
                    <div style="font-size:2em; font-weight:bold; color:#56DDE0;">${pkg.moneda} $${formatMoney(tarifaDoble)}</div>
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