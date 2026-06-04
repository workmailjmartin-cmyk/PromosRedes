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

    // --- NÚMERO OFICIAL DE WHATSAPP ---
    // Cambiá este número por el de tu agencia (sin el +, ej: 5491100000000)
    const WPP_NUMBER = "5493512444868";

    // --- RECARGAR AL TOCAR EL LOGO ---
    const logoB2C = document.querySelector('.logo img');
    if (logoB2C) {
        logoB2C.style.cursor = 'pointer';
        logoB2C.addEventListener('click', () => window.location.reload());
    }

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

    // --- FUNCIONES AUXILIARES ---
    const showLoader = (show) => { if(dom.loader) dom.loader.style.display = show ? 'flex' : 'none'; };
    const formatMoney = (a) => new Intl.NumberFormat('es-AR', { style: 'decimal', minimumFractionDigits: 0 }).format(a);
    const formatDateAR = (s) => { if(!s) return '-'; const p = s.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s; };
    const formatEscalasTexto = (n) => { n = parseInt(n) || 0; if (n === 0) return "Directo"; if (n === 1) return "1 Escala"; return `${n} Escalas`; };

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

    // El generador de presupuestos exacto de tu sistema interno
    function generarTextoPresupuesto(pkg) {
        const fechaCotizacion = pkg.fecha_creacion ? pkg.fecha_creacion : new Date().toLocaleDateString('es-AR');
        const noches = getNoches(pkg);
        const tarifa = parseFloat(pkg['tarifa']) || 0;
        const tarifaDoble = Math.round(tarifa / 2);
        
        let servicios = [];
        try { servicios = typeof pkg.servicios === 'string' ? JSON.parse(pkg.servicios) : pkg.servicios; } catch(e) {}

        const tieneSeguro = Array.isArray(servicios) && servicios.some(s => 
            s.tipo === 'seguro' || (s.tipo === 'bus' && s.asistencia === true)
        );

        let texto = `*${pkg.destino.toUpperCase()}*\n`;
        texto += `PAQUETE\n\n`;
        
        const esCircuitoTxt = Array.isArray(servicios) && servicios.some(s => s.tipo === 'circuito');
        const fechaTxt = (!pkg.fecha_salida && esCircuitoTxt) ? 'Múltiples Salidas' : formatDateAR(pkg.fecha_salida);
        texto += `📅 Salida: ${fechaTxt}\n`;
        
        let lugarSalida = pkg.salida;
        const tieneAereo = Array.isArray(servicios) && servicios.some(s => s.tipo === 'aereo');
        if (!tieneAereo) {
            const crucero = Array.isArray(servicios) && servicios.find(s => s.tipo === 'crucero');
            const circuito = Array.isArray(servicios) && servicios.find(s => s.tipo === 'circuito');
            if (crucero && crucero.crucero_puerto_salida) lugarSalida = crucero.crucero_puerto_salida;
            else if (circuito && circuito.circuito_salida) lugarSalida = circuito.circuito_salida;
        }
        texto += `📍 Desde: ${lugarSalida}\n`;
        if (noches > 0) texto += `🌙 Duración: ${noches} Noches\n`;
        
        texto += `\n✅ Servicios que incluye el paquete:\n\n`;

        if (Array.isArray(servicios)) {
            servicios.forEach(s => {
                if(s.tipo === 'aereo') {
                    let eIda = (s.escalas_ida !== undefined) ? parseInt(s.escalas_ida) : (parseInt(s.escalas) || 0);
                    let eVuelta = (s.escalas_vuelta !== undefined) ? parseInt(s.escalas_vuelta) : (parseInt(s.escalas) || 0);
                    let escalasTxt = "";
                    if (eIda === eVuelta) escalasTxt = formatEscalasTexto(eIda);
                    else escalasTxt = `IDA: ${formatEscalasTexto(eIda)} | REGRESO: ${formatEscalasTexto(eVuelta)}`;

                    texto += `> ✈️ *AÉREO*\n`;
                    if (s.aeropuerto_salida) texto += `🛫 *Salida desde:* ${s.aeropuerto_salida}\n`;
                    texto += `${s.aerolinea || 'Aerolínea'}\n`;
                    texto += `${formatDateAR(s.fecha_aereo)}${s.fecha_regreso ? ' - ' + formatDateAR(s.fecha_regreso) : ''}\n`;
                    texto += `${escalasTxt} | ${s.tipo_equipaje || '-'}\n\n`;
                } else if (s.tipo === 'hotel') {
                    let stars = ''; if(s.hotel_estrellas) { for(let i=0; i<s.hotel_estrellas; i++) stars += '⭐'; }
                    texto += `> 🏨 *HOTEL*\n`;
                    texto += `${s.hotel_nombre} ${stars}\n`;
                    if(s.regimen) texto += `(${s.regimen})\n`;
                    if(s.noches) texto += `${s.noches} Noches`;
                    if(s.checkin) texto += ` | Ingreso: ${formatDateAR(s.checkin)}`; 
                    texto += `\n`;
                    if(s.hotel_link) texto += `📍 Ubicación: ${s.hotel_link}\n`;
                    texto += `\n`;
                } else if (s.tipo === 'traslado') {
                    texto += `> 🚗 *TRASLADO*\n`;
                    texto += `${s.tipo_trf || 'Incluido'}\n\n`;
                } else if (s.tipo === 'seguro') {
                    texto += `> 🛡️ *SEGURO*\n`;
                    texto += `${s.cobertura || 'Asistencia al viajero'}\n\n`;
                } else if (s.tipo === 'bus') {
                    texto += `> 🚌 *PAQUETE BUS* (${s.noches || '?'} Noches)\n`;
                    if (s.bus_salida) texto += `> 📍 *Salida desde:* ${s.bus_salida}\n`;
                    if (s.incluye_alojamiento) {
                        texto += `> 🏨 *Hotel:* ${s.hotel_nombre || 'A confirmar'}\n`;
                        if (s.hotel_ubicacion) texto += `> 📍 *Ubicación:* ${s.hotel_ubicacion}\n`;
                        texto += `> 🍽 *Régimen:* ${s.regimen || ''}`;
                        if (s.regimen === 'Media Pensión' || s.regimen === 'Pensión Completa') {
                            texto += ` ${s.bebidas === 'Si' ? '(🥤 Con Bebidas)' : '(🚫 Sin Bebidas)'}`;
                        }
                        texto += `\n`; 
                    }
                    if (s.incluye_excursiones) texto += `> 🌲 *Excursiones:* ${s.excursion_adicional || 'Incluidas'}\n`;
                    if (s.asistencia) texto += `> 🚑 *Asistencia al Viajero Incluida*\n`;
                    if (s.observaciones) texto += `> 📝 *Nota:* ${s.observaciones}\n`;
                    texto += `\n`;
                } else if (s.tipo === 'crucero') { 
                    texto += `> 🚢 *CRUCERO ${s.crucero_naviera ? s.crucero_naviera.toUpperCase() : ''}*\n`;
                    if (s.crucero_noches) texto += ` *Duración:* ${s.crucero_noches} Noches\n`;
                    if (s.crucero_puerto_salida) texto += ` Puerto de Salida: ${s.crucero_puerto_salida}\n`;
                    if (s.checkin) texto += ` Fechas: ${formatDateAR(s.checkin)} al ${formatDateAR(s.checkout || '')}\n`;
                    if (s.crucero_paradas) texto += ` Recorrido: ${s.crucero_paradas}\n`;
                    texto += ` Incluye:\n- Pensión Completa\n- Asistencia al Viajero\n`;
                    if (s.crucero_bebidas) texto += `- Paquete de Bebidas\n`;
                    if (s.crucero_propinas) texto += `- Propinas\n`;
                    texto += `\n`;
                } else if (s.tipo === 'adicional') {
                    texto += `> ➕ *ADICIONAL*\n`;
                    texto += `${s.descripcion}\n\n`;
                } else if (s.tipo === 'circuito') {
                    texto += `> 🗺️ *CIRCUITO: ${s.circuito_nombre ? s.circuito_nombre.toUpperCase() : ''}*\n`;
                    if (s.circuito_noches) texto += `Duración: ${s.circuito_noches} Noches\n`;
                    if (s.circuito_salida) texto += `Salida desde: ${s.circuito_salida}\n`;
                    if (s.checkin) texto += `*Fechas:* ${formatDateAR(s.checkin)} al ${formatDateAR(s.checkout || '')}\n`;
                    if (s.circuito_descripcion) texto += `Detalle: ${s.circuito_descripcion}\n`;
                    texto += `\n`;
                }
            });
        }

        texto += `💲*Tarifa final por Persona en Base Doble:*\n`;
        texto += `${pkg.moneda} $${formatMoney(tarifaDoble)}\n\n`;
        if (pkg.financiacion) texto += `💳 Financiación: ${pkg.financiacion}\n\n`;
        texto += `--------------------------------------------\n`;
        texto += `Información importante:\n`;
        texto += `-Tarifas y disponibilidad sujetas a cambio al momento de la reserva.\n`;
        texto += `-Cotización válida al ${fechaCotizacion}\n\n`;
        texto += `ℹ Más info: (https://felizviaje.tur.ar/informacion-antes-de-contratar)\n\n`;
        texto += `⚠¡Cupos limitados!\n`;
        texto += `-Para asegurar esta tarifa y evitar aumentos, recomendamos avanzar con la seña lo antes posible.\n`;
        texto += `-Las plazas y precios pueden modificarse en cualquier momento según disponibilidad de vuelos y hotel.\n\n`;
        texto += `¿Encontraste una mejor oferta? ¡Compartila con nosotros y la mejoramos para vos!\n\n`;
        texto += `✈ Políticas generales de aerolíneas (tarifas económicas)\n`;
        texto += `-Equipaje y la selección de asientos no están incluidos (pueden tener costo adicional)\n\n`;
        if (tieneSeguro) texto += `Asistencia al viajero es requisito obligatorio en la mayoría de los destinos internacionales`;
        else texto += `Asistencia al viajero no incluida. Puede añadirse al reservar o más adelante. Es requisito obligatorio en la mayoría de los destinos internacionales`;

        return texto;
    }

    // El dibujador del itinerario exacto de tu sistema interno
    function renderServiciosClienteHTML(rawJson) { 
        let s=[]; try{s=typeof rawJson==='string'?JSON.parse(rawJson):rawJson;}catch(e){return'<p>-</p>';} 
        if(!Array.isArray(s)||s.length===0)return'<p>-</p>'; 
        let h=''; 
        s.forEach(x=>{ 
            let i='🔹',t='',l=[]; 
            if(x.tipo==='aereo'){
                i='✈️';t='AÉREO';
                if(x.aeropuerto_salida) l.push(`🛫 <b>Salida desde:</b> ${x.aeropuerto_salida}`);
                l.push(`<b>${x.aerolinea}</b>`);
                l.push(`${formatDateAR(x.fecha_aereo)}${x.fecha_regreso?` - ${formatDateAR(x.fecha_regreso)}`:''}`);
                let eIda = (x.escalas_ida !== undefined) ? parseInt(x.escalas_ida) : (parseInt(x.escalas) || 0);
                let eVuelta = (x.escalas_vuelta !== undefined) ? parseInt(x.escalas_vuelta) : (parseInt(x.escalas) || 0);
                let escalasTxt = "";
                if (eIda === eVuelta) escalasTxt = formatEscalasTexto(eIda);
                else escalasTxt = `<b>IDA:</b> ${formatEscalasTexto(eIda)} | <b>REG:</b> ${formatEscalasTexto(eVuelta)}`;
                l.push(`🔄 ${escalasTxt} | 🧳 ${x.tipo_equipaje || '-'}`);
            } 
            else if(x.tipo==='hotel'){
                i='🏨';t='HOTEL';
                let stars = ''; if(x.hotel_estrellas) { for(let k=0; k<x.hotel_estrellas; k++) stars += '⭐'; }
                l.push(`<b>${x.hotel_nombre}</b> <span style="color:#ef5a1a;">${stars}</span>`);
                l.push(`(${x.regimen})`);
                let det = [];
                if(x.noches) det.push(`🌙 ${x.noches} Noches`);
                if(x.checkin) det.push(`Ingreso: ${formatDateAR(x.checkin)}`);
                if(det.length > 0) l.push(`<small>${det.join(' | ')}</small>`);
                if(x.hotel_link) l.push(`<a href="${x.hotel_link}" target="_blank" style="color:#ef5a1a;text-decoration:none;font-weight:bold;">📍 Ver Ubicación</a>`);
            } 
            else if(x.tipo==='traslado'){i='🚕';t='TRASLADO';l.push(`${x.tipo_trf}`);} 
            else if(x.tipo==='seguro'){ i='🛡️';t='SEGURO'; if(x.cobertura) l.push(x.cobertura); } 
            else if(x.tipo==='adicional'){i='➕';t='ADICIONAL';l.push(`${x.descripcion}`);} 
            else if(x.tipo === 'bus'){
                i='🚌'; t='PAQUETE BUS';
                if(x.bus_salida) l.push(`📍 <b>Salida desde:</b> ${x.bus_salida}`);
                if(x.noches) l.push(`🌙 <b>${x.noches} Noches</b>`);
                if(x.incluye_alojamiento){
                    l.push(`🏨 <b>Hotel:</b> ${x.hotel_nombre || 'A confirmar'}`);
                    if(x.hotel_ubicacion) l.push(`<a href="${x.hotel_ubicacion}" target="_blank" style="color:#ef5a1a;text-decoration:none;font-weight:bold; display:inline-block; margin-top:2px;">📍 Ver Ubicación</a>`);
                    let infoComida = `🍽 <b>Régimen:</b> ${x.regimen || ''}`;
                    if (x.regimen === 'Media Pensión' || x.regimen === 'Pensión Completa') {
                        if(x.bebidas === 'Si') infoComida += ` <span style="color:#2ecc71; font-weight:bold;">(🥤 Con Bebidas)</span>`;
                        else if(x.bebidas === 'No') infoComida += ` <span style="color:#e74c3c;">(🚫 Sin Bebidas)</span>`;
                    }
                    l.push(infoComida);
                }
                if(x.incluye_excursiones) l.push(`🌲 <b>Excursiones:</b> ${x.excursion_adicional || 'Incluidas'}`);
                if(x.asistencia) l.push(`🚑 <b>Asistencia al Viajero:</b> Incluida`);
                if(x.observaciones) l.push(`📝 <i>Nota: ${x.observaciones}</i>`);
            }
            else if(x.tipo === 'crucero'){
                i='🚢'; t='CRUCERO';
                l.push(`<b>Naviera:</b> ${x.crucero_naviera}`);
                if(x.crucero_puerto_salida) l.push(`📍 <b>Puerto de Salida:</b> ${x.crucero_puerto_salida}`);
                let det = [];
                if(x.checkin) det.push(`Embarque: ${formatDateAR(x.checkin)}`);
                if(x.crucero_noches) det.push(`🌙 ${x.crucero_noches} Noches`);
                if(det.length > 0) l.push(`<small>${det.join(' | ')}</small>`);
                if(x.crucero_paradas) l.push(`🗺️ <b>Recorrido:</b> ${x.crucero_paradas}`);
                l.push(`<div style="margin-top:5px;"><b>Incluye:</b><br><span style="color:#2ecc71;">✓ Pensión Completa</span><br><span style="color:#2ecc71;">✓ Asistencia al Viajero</span>${x.crucero_bebidas ? '<br><span style="color:#2ecc71;">✓ Paquete de Bebidas</span>' : ''}${x.crucero_propinas ? '<br><span style="color:#2ecc71;">✓ Propinas Incluidas</span>' : ''}</div>`);
            }
            else if(x.tipo === 'circuito'){
                i='🗺️'; t='CIRCUITO TERRESTRE';
                l.push(`<b>${x.circuito_nombre}</b>`);
                if(x.circuito_salida) l.push(`📍 <b>Salida desde:</b> ${x.circuito_salida}`);
                let det = [];
                if(x.checkin) det.push(`Inicio: ${formatDateAR(x.checkin)}`);
                if(x.checkout) det.push(`Fin: ${formatDateAR(x.checkout)}`);
                if(x.circuito_noches) det.push(`🌙 ${x.circuito_noches} Noches`);
                if(det.length > 0) l.push(`<small>${det.join(' | ')}</small>`);
                if(x.circuito_descripcion) l.push(`<div style="margin-top:5px; color:#555;">📝 <i>${x.circuito_descripcion.replace(/\n/g, '<br>')}</i></div>`);
            }
            h+=`<div style="margin-bottom:5px;border-left:3px solid #ddd;padding-left:10px;"><div style="font-weight:bold;color:#11173d;">${i} ${t}</div><div style="font-size:0.9em;color:#555;">${l.join('<br>')}</div></div>`;
        }); 
        return h; 
    }

    // --- REGLA DE LA CENICIENTA (CORTE 12:00 HS ARGENTINA) ---
    const getCutoffEpoch = () => {
        const now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const arTime = new Date(utcTime - (3 * 3600000)); 
        
        const arHour = arTime.getHours();
        const arYear = arTime.getFullYear();
        const arMonth = arTime.getMonth();
        let arDay = arTime.getDate();
        
        if (arHour < 12) { arDay -= 1; }
        
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

    // --- CARGA Y FILTRADO ---
    async function fetchAndLoadPackages() { 
        showLoader(true);
        try { 
            const snapshot = await db.collection('paquetes').get();
            const cutoffEpoch = getCutoffEpoch();
            
            allPackages = snapshot.docs.map(doc => ({ id_paquete: doc.id, ...doc.data() }))
                .filter(pkg => {
                    if (pkg.alcance === 'casa_central') return false; // Bloquea promo interna
                    if (pkg.status === 'pending') return false; // Bloquea no aprobados
                    if (pkg.timestamp && pkg.timestamp < cutoffEpoch) return false; // Bloquea pasados
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

    // --- RENDERIZADO DE GRILLA B2C ---
    function renderCards(list) {
        dom.grid.innerHTML = ''; 
        if (!list || list.length === 0) { 
            dom.grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#666;">No encontramos viajes para esa búsqueda, ¡Contactanos al WhatsApp y lo armamos a medida!</p>'; 
            return; 
        }
        
        list.forEach(pkg => {
            if (!pkg.destino) return; 
            const card = document.createElement('div');
            
            let sGrid = []; try { sGrid = typeof pkg.servicios === 'string' ? JSON.parse(pkg.servicios) : pkg.servicios; } catch(e){}
            const tieneAereo = Array.isArray(sGrid) && sGrid.some(s => s.tipo === 'aereo');
            const esCircuito = Array.isArray(sGrid) && sGrid.some(s => s.tipo === 'circuito');
            const fechaMostrar = (!pkg.fecha_salida && esCircuito && !tieneAereo) ? 'Múltiples Salidas' : formatDateAR(pkg.fecha_salida);
            
            const noches = getNoches(pkg);
            let lugarSalidaGrid = pkg['salida'];
            if (!tieneAereo) {
                const crucero = Array.isArray(sGrid) && sGrid.find(s => s.tipo === 'crucero');
                const circuito = Array.isArray(sGrid) && sGrid.find(s => s.tipo === 'circuito');
                if (crucero && crucero.crucero_puerto_salida) lugarSalidaGrid = crucero.crucero_puerto_salida;
                else if (circuito && circuito.circuito_salida) lugarSalidaGrid = circuito.circuito_salida;
            }

            card.className = 'paquete-card'; 
            const tarifaMostrar = parseFloat(pkg['tarifa']) || 0; 
            
            const m = {'aereo':'✈️','hotel':'🏨','traslado':'🚕','seguro':'🛡️','bus':'🚌','crucero':'🚢','circuito':'🗺️'};
            const summaryIcons = [...new Set((Array.isArray(sGrid)?sGrid:[]).map(x => m[x.tipo] || '🔹'))].join(' '); 

            card.innerHTML = `
                <div class="card-clickable" style="height:100%;">
                    <div class="card-header">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%;">
                            <div style="max-width:75%; padding-right:10px;">
                                <h3 style="margin:0;font-size:1.4em;line-height:1.2;color:#11173d;">${pkg.destino}</h3>
                            </div>
                            ${noches > 0 ? `<div style="background:#eef2f5;color:#11173d;padding:5px 10px;border-radius:12px;font-weight:bold;font-size:0.8em;white-space:nowrap;">🌙 ${noches}</div>` : ''}
                        </div>
                        <div class="fecha">📅 Salida: ${fechaMostrar}</div>
                    </div>
                    
                    <div class="card-body">
                        <div style="font-size:0.85em;color:#555;display:flex;flex-wrap:wrap;line-height:1.4;">${summaryIcons}</div>
                    </div>
                    
                    <div class="card-footer" style="display:flex; justify-content:flex-end; align-items:flex-end;">
                        <div style="text-align: right;">
                            <div style="font-size: 0.85em; color: #666; font-weight: 500; margin-bottom: -5px;">Desde ${lugarSalidaGrid || 'Varias'}</div>
                            <p class="precio-valor" style="margin: 5px 0 0 0;">
                                ${pkg.moneda} $${formatMoney(Math.round(tarifaMostrar/2))} <span style="font-size:0.5em; color:#999; font-weight:normal;">x Persona</span>
                            </p>
                        </div>
                    </div>
                </div>`;
            
            dom.grid.appendChild(card); 
            card.querySelector('.card-clickable').addEventListener('click', () => openModal(pkg));
        });
    }

    // --- MODAL DE CLIENTES B2C (CENSURADO Y CON TEXTO FULL PARA WHATSAPP) ---
    function openModal(pkg) {
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
            if (crucero && crucero.crucero_puerto_salida) lugarSalidaModal = crucero.crucero_puerto_salida;
            else if (circuito && circuito.circuito_salida) lugarSalidaModal = circuito.circuito_salida;
        }

        const htmlCliente = renderServiciosClienteHTML(rawServicios); 
        const noches = getNoches(pkg); 
        const tarifa = parseFloat(pkg['tarifa']) || 0; 
        const tarifaDoble = Math.round(tarifa / 2); 

        // ACÁ SUCEDE LA MAGIA: Armamos el texto completo para el vendedor
        const textoCompletoParaVendedor = generarTextoPresupuesto(pkg);
        const mensajeWa = encodeURIComponent(`¡Hola Feliz Viaje! Vengo de la web y quiero consultar por este paquete:\n\n${textoCompletoParaVendedor}`);
        
        const btnConsultarWpp = `<a href="https://wa.me/${WPP_NUMBER}?text=${mensajeWa}" target="_blank" style="background: #25d366; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; text-decoration: none; text-align: center; display: block; margin-top: 20px; font-size: 1.1em; transition: 0.2s; box-shadow: 0 4px 10px rgba(37,211,102,0.3);" onmouseover="this.style.background='#1da851'" onmouseout="this.style.background='#25d366'">💬 Consultar al Asesor</a>`;

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
                    <h4 style="margin:0 0 15px 0; color:#11173d; font-size:1.2em;">Resumen del Viaje</h4>
                    <p style="margin:5px 0; font-size:0.95em;"><b>📅 Salida:</b> ${fechaModal}</p>
                    <p style="margin:5px 0; font-size:0.95em;"><b>📍 Desde:</b> ${lugarSalidaModal || '-'}</p>
                    <p style="margin:5px 0; font-size:0.95em;"><b>🌙 Duración:</b> ${noches > 0 ? noches + ' Noches' : '-'}</p>
                    
                    ${pkg['financiacion'] ? `<div style="margin-top:15px; background:#e3f2fd; padding:10px; border-radius:5px; font-size:0.85em; color:#11173d;"><b>💳 Financiación / Notas:</b><br>${pkg['financiacion']}</div>` : ''}

                    ${btnConsultarWpp}
                </div>
            </div>
            
           <div style="background:#11173d; color:white; padding:20px 30px; display:flex; justify-content:space-between; align-items:center; border-radius:0 0 12px 12px; flex-wrap:wrap; gap:15px;">
                <div style="text-align:left;">
                    <small style="opacity:0.8; font-size: 0.85em; text-transform: uppercase;">Tarifa final por persona (Base Doble)</small>
                    <div style="font-size:2.5em; font-weight:bold; color:#56DDE0; line-height: 1.1;">${pkg['moneda']} $${formatMoney(tarifaDoble)}</div>
                </div>
                <div style="text-align:right; max-width: 250px;">
                    <small style="color: #ef5a1a; font-size: 0.85em; line-height: 1.3; display: block; font-weight: 500;">
                        * Tarifas y cupos sujetos a disponibilidad.<br>
                        Revisar <a href="https://felizviaje.tur.ar/informacion-antes-de-contratar" target="_blank" style="color: #56DDE0; text-decoration: underline;">bases y condiciones</a>.
                    </small>
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