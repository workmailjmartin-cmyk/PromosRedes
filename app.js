document.addEventListener('DOMContentLoaded', () => {

    // --- 1. CONFIGURACIÓN ---
    const firebaseConfig = {
        apiKey: "AIzaSyCBiyH6HTatUxNxQ6GOxGp-xFWa7UfCMJk",
        authDomain: "feliz-viaje-43d02.firebaseapp.com",
        projectId: "feliz-viaje-43d02",
        storageBucket: "feliz-viaje-43d02.firebasestorage.app",
        messagingSenderId: "931689659600",
        appId: "1:931689659600:web:66dbce023705936f26b2d5",
        measurementId: "G-2PNDZR3ZS1"
    };

    const API_URL_SEARCH = 'https://n8n.srv1097024.hstgr.cloud/webhook/83cb99e2-c474-4eca-b950-5d377bcf63fa';
    const API_URL_UPLOAD = 'https://n8n.srv1097024.hstgr.cloud/webhook/6ec970d0-9da4-400f-afcc-611d3e2d82eb';

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const analytics = firebase.analytics();
    const auth = firebase.auth();
    const db = firebase.firestore(); 
    const provider = new firebase.auth.GoogleAuthProvider();

    // --- DICCIONARIO DE AEROPUERTOS POR PROVINCIA ---
    const aeropuertosPorProvincia = {
        "Buenos Aires": [
            {nombre: "Ezeiza - Ministro Pistarini", sigla: "EZE"},
            {nombre: "Aeroparque Jorge Newbery", sigla: "AEP"},
            {nombre: "El Palomar", sigla: "EPA"},
            {nombre: "Mar del Plata - Astor Piazzolla", sigla: "MDQ"},
            {nombre: "Bahía Blanca - Comandante Espora", sigla: "BHI"},
            {nombre: "San Fernando", sigla: "FDO"}
        ],
        "CABA": [{nombre: "Aeroparque Jorge Newbery", sigla: "AEP"}],
        "Catamarca": [{nombre: "Catamarca - Felipe Varela", sigla: "CTC"}],
        "Chaco": [{nombre: "Resistencia", sigla: "RES"}],
        "Chubut": [
            {nombre: "Comodoro Rivadavia", sigla: "CRV"}, {nombre: "Trelew", sigla: "REL"},
            {nombre: "Puerto Madryn", sigla: "PMY"}, {nombre: "Esquel", sigla: "EQS"}
        ],
        "Córdoba": [
            {nombre: "Córdoba - Ing. Taravella", sigla: "COR"},
            {nombre: "Río Cuarto", sigla: "RCU"}
        ],
        "Corrientes": [{nombre: "Corrientes", sigla: "CNQ"}, {nombre: "Paso de los Libres", sigla: "AOL"}],
        "Entre Ríos": [{nombre: "Paraná", sigla: "PRA"}],
        "Formosa": [{nombre: "Formosa", sigla: "FMA"}],
        "Jujuy": [{nombre: "Jujuy - Horacio Guzmán", sigla: "JUJ"}],
        "La Pampa": [{nombre: "Santa Rosa", sigla: "RSA"}, {nombre: "General Pico", sigla: "GPO"}],
        "La Rioja": [{nombre: "La Rioja", sigla: "IRJ"}],
        "Mendoza": [
            {nombre: "Mendoza - El Plumerillo", sigla: "MDZ"},
            {nombre: "San Rafael", sigla: "AFA"}, {nombre: "Malargüe", sigla: "LGS"}
        ],
        "Misiones": [{nombre: "Iguazú", sigla: "IGR"}, {nombre: "Posadas", sigla: "PSS"}],
        "Neuquén": [{nombre: "Neuquén", sigla: "NQN"}, {nombre: "San Martín de los Andes", sigla: "CPC"}],
        "Río Negro": [{nombre: "Bariloche", sigla: "BRC"}, {nombre: "Viedma", sigla: "VDM"}],
        "Salta": [{nombre: "Salta - Güemes", sigla: "SLA"}],
        "San Juan": [{nombre: "San Juan", sigla: "UAQ"}],
        "San Luis": [{nombre: "San Luis", sigla: "LUQ"}, {nombre: "Merlo", sigla: "RLO"}],
        "Santa Cruz": [
            {nombre: "El Calafate", sigla: "FTE"}, {nombre: "Río Gallegos", sigla: "RGL"},
            {nombre: "Puerto Deseado", sigla: "PUD"}, {nombre: "Perito Moreno", sigla: "PMQ"}
        ],
        "Santa Fe": [{nombre: "Rosario", sigla: "ROS"}, {nombre: "Santa Fe", sigla: "SFN"}],
        "Santiago del Estero": [{nombre: "Santiago del Estero", sigla: "SDE"}, {nombre: "Termas de Río Hondo", sigla: "RHD"}],
        "Tierra del Fuego": [{nombre: "Ushuaia", sigla: "USH"}, {nombre: "Río Grande", sigla: "RGA"}],
        "Tucumán": [{nombre: "Tucumán", sigla: "TUC"}]
    };
    
    function actualizarAeropuertos(provinciaSeleccionada) {
        const selectsAeropuerto = document.querySelectorAll('[name="aeropuerto_salida"]');
        if(!selectsAeropuerto || selectsAeropuerto.length === 0) return;
        
        selectsAeropuerto.forEach(selectAeropuerto => {
            const valorPrevio = selectAeropuerto.value; // Guardamos lo que ya estaba elegido
            selectAeropuerto.innerHTML = '<option value="">-- No especificar --</option>';
            if (aeropuertosPorProvincia[provinciaSeleccionada]) {
                aeropuertosPorProvincia[provinciaSeleccionada].forEach(aero => {
                    const option = document.createElement('option');
                    option.value = `${aero.nombre} (${aero.sigla})`;
                    option.textContent = `${aero.nombre} (${aero.sigla})`;
                    selectAeropuerto.appendChild(option);
                });
            }
            if (valorPrevio) selectAeropuerto.value = valorPrevio; // Lo volvemos a poner
        });
    }
    
    document.addEventListener('change', (e) => {
        // Conectamos el filtro al campo de Salida de tu formulario principal
        if (e.target.id === 'upload-salida') {
            actualizarAeropuertos(e.target.value);
        }
    });

    // ESTADO GLOBAL
    let currentUser = null;
    let userData = null; 
    let allPackages = [];
    let uniquePackages = []; 
    let isEditingId = null; 
    let originalCreator = ''; 
    window.currentModalPackage = null;

    // DOM PRINCIPAL
    const dom = {
        views: { search: document.getElementById('view-search'), upload: document.getElementById('view-upload'), gestion: document.getElementById('view-gestion'), users: document.getElementById('view-users') },
        nav: { search: document.getElementById('nav-search'), upload: document.getElementById('nav-upload'), gestion: document.getElementById('nav-gestion'), users: document.getElementById('nav-users') },
        grid: document.getElementById('grilla-paquetes'), gridGestion: document.getElementById('grid-gestion'),
        uploadForm: document.getElementById('upload-form'), userForm: document.getElementById('user-form'), usersList: document.getElementById('users-list'),
        inputCostoTotal: document.getElementById('upload-costo-total'), inputTarifaTotal: document.getElementById('upload-tarifa-total'), inputFechaViaje: document.getElementById('upload-fecha-salida'),
        loginContainer: document.getElementById('login-container'), appContainer: document.getElementById('app-container'),
        btnLogin: document.getElementById('login-button'), btnLogout: document.getElementById('logout-button'), userEmail: document.getElementById('user-email'),
        modal: document.getElementById('modal-detalle'), modalBody: document.getElementById('modal-body'), modalClose: document.getElementById('modal-cerrar'),
        containerServicios: document.getElementById('servicios-container'), btnAgregarServicio: document.getElementById('btn-agregar-servicio'), selectorServicio: document.getElementById('selector-servicio'),
        btnBuscar: document.getElementById('boton-buscar'), btnLimpiar: document.getElementById('boton-limpiar'),
        filtroOrden: document.getElementById('filtro-orden'), filtroCreador: document.getElementById('filtro-creador'), filtroSalida: document.getElementById('filtro-salida'), containerFiltroCreador: document.getElementById('container-filtro-creador'),
        logoImg: document.getElementById('app-logo'), loader: document.getElementById('loader-overlay'),
        badgeGestion: document.getElementById('badge-gestion')
    };

    // DOM PLANNER
    const domPlanner = {
        container: document.getElementById('weekly-planner'),
        header: document.getElementById('planner-header-btn'),
        body: document.getElementById('planner-body-content'),
        btnSave: document.getElementById('btn-save-planning'),
        inputs: {
            lunes: document.getElementById('note-lunes'),
            martes: document.getElementById('note-martes'),
            miercoles: document.getElementById('note-miercoles'),
            jueves: document.getElementById('note-jueves'),
            viernes: document.getElementById('note-viernes')
        }
    };

    // --- UTILS ---
    // Función para comprimir imágenes ANTES de subir 
    async function comprimirImagen(file, maxWidth, maxHeight, quality) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Calcular nuevas dimensiones manteniendo la proporción
                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = Math.round((width * maxHeight) / height);
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Exportar como JPEG comprimido
                    canvas.toBlob((blob) => {
                        resolve(blob);
                    }, 'image/jpeg', quality);
                };
            };
            reader.onerror = error => reject(error);
        });
    }

    // ==========================================
    // UI DE CAPTURAS (Copiar, Pegar y Previsualizar)
    // ==========================================

    // 1. Si hacen clic en la caja, abrimos el buscador de archivos del sistema
    document.addEventListener('click', (e) => {
        const dz = e.target.closest('.dropzone-capturas');
        if (dz) dz.querySelector('input[type="file"]').click();
    });

    // 2. Si eligen archivos manualmente, mostramos las miniaturas
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('upload-captura-aereo')) {
            actualizarMiniaturasAereo(e.target.files, e.target.closest('.form-group').querySelector('.preview-capturas'));
        }
    });

    // 3. MAGIA: Si tocan Ctrl+V adentro de la caja
    document.addEventListener('paste', (e) => {
        // Verificamos si tienen "seleccionada" la caja
        const dz = document.activeElement.closest('.dropzone-capturas');
        if (!dz) return; 
        
        e.preventDefault();
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        const files = [];
        
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file') files.push(item.getAsFile()); // Rescatamos la imagen pegada
        }
        
        if (files.length > 0) {
            const input = dz.querySelector('input[type="file"]');
            const dataTransfer = new DataTransfer();
            
            // Si ya habían subido otras fotos antes, las conservamos
            if (input.files) { Array.from(input.files).forEach(f => dataTransfer.items.add(f)); }
            
            // Sumamos las nuevas fotos pegadas
            files.forEach(f => dataTransfer.items.add(f));
            input.files = dataTransfer.files;
            
            // Dibujamos las fotos
            actualizarMiniaturasAereo(input.files, dz.parentElement.querySelector('.preview-capturas'));
        }
    });

    function actualizarMiniaturasAereo(files, previewDiv) {
        previewDiv.innerHTML = '';
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                // Dibuja una miniatura linda con sombra
                previewDiv.innerHTML += `<img src="${e.target.result}" style="height: 60px; border-radius: 6px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">`;
            };
            reader.readAsDataURL(file);
        });
    }
        
    const showLoader = (show, text = null) => { 
        if(dom.loader) {
            dom.loader.style.display = show ? 'flex' : 'none';
            let p = dom.loader.querySelector('p');
            if (!p) { p = document.createElement('p'); p.style.cssText = "margin-top:20px; font-weight:600; color:#11173d; font-size:1.2em;"; dom.loader.appendChild(p); }
            p.innerText = text || "Procesando...";
        }
    };
    const formatMoney = (a) => new Intl.NumberFormat('es-AR', { style: 'decimal', minimumFractionDigits: 0 }).format(a);
    const formatDateAR = (s) => { if(!s) return '-'; const p = s.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s; };
    
    // Función auxiliar para formatear texto de escalas
    const formatEscalasTexto = (n) => {
        n = parseInt(n) || 0;
        if (n === 0) return "Directo";
        if (n === 1) return "1 Escala";
        return `${n} Escalas`;
    };

    function getNoches(pkg) {
        let servicios = []; try { const raw = pkg['servicios'] || pkg['item.servicios']; servicios = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch(e) {}
        if(!Array.isArray(servicios)) return 0;
        
        let totalHotel = 0; let hayHotel = false;
        servicios.forEach(s => { if (s.tipo === 'hotel' && s.noches) { totalHotel += parseInt(s.noches) || 0; hayHotel = true; } });
        if(hayHotel && totalHotel > 0) return totalHotel;

        // Buscamos si hay servicios principales con sus propias noches definidas
        const bus = servicios.find(s => s.tipo === 'bus'); if (bus && bus.noches) return parseInt(bus.noches);
        const crucero = servicios.find(s => s.tipo === 'crucero'); if (crucero && crucero.crucero_noches) return parseInt(crucero.crucero_noches);
        
        // ¡NUEVO! Le enseñamos a buscar el circuito
        const circuito = servicios.find(s => s.tipo === 'circuito'); if (circuito && circuito.circuito_noches) return parseInt(circuito.circuito_noches);
        
        if(!pkg['fecha_salida']) return 0;
        let fechaStr = pkg['fecha_salida']; if(fechaStr.includes('/')) fechaStr = fechaStr.split('/').reverse().join('-');
        const start = new Date(fechaStr + 'T00:00:00'); let maxDate = new Date(start), hasData = false;
        
        servicios.forEach(s => {
            if(s.tipo==='hotel'&&s.checkout){ const d=new Date(s.checkout+'T00:00:00'); if(d>maxDate){maxDate=d; hasData=true;} }
            if(s.tipo==='aereo'&&s.fecha_regreso){ const d=new Date(s.fecha_regreso+'T00:00:00'); if(d>maxDate){maxDate=d; hasData=true;} }
            if(s.tipo==='crucero'&&s.checkout){ const d=new Date(s.checkout+'T00:00:00'); if(d>maxDate){maxDate=d; hasData=true;} }
            if(s.tipo==='circuito'&&s.checkout){ const d=new Date(s.checkout+'T00:00:00'); if(d>maxDate){maxDate=d; hasData=true;} } // <-- Sumado aquí también
        });
        return hasData ? Math.ceil((maxDate - start) / 86400000) : 0;
    }

    function getSummaryIcons(pkg) { 
        let s = []; try { s = typeof pkg.servicios === 'string' ? JSON.parse(pkg.servicios) : pkg.servicios; } catch(e) {} 
        if (!Array.isArray(s)) return ''; 
        const m = {'aereo':'✈️','hotel':'🏨','traslado':'🚕','seguro':'🛡️','bus':'🚌','crucero':'🚢','circuito':'🗺️'};
        return [...new Set(s.map(x => m[x.tipo] || '🔹'))].join(' '); 
    }

    // --- GENERADOR DE TEXTO ---
    function generarTextoPresupuesto(pkg) {
        const fechaCotizacion = pkg.fecha_creacion ? pkg.fecha_creacion : new Date().toLocaleDateString('es-AR');
        const noches = getNoches(pkg);
        const tarifa = parseFloat(pkg['tarifa']) || 0;
        
        // 👉 LÓGICA NUEVA: Detecta si es base doble o cuádruple
        const divisor = parseInt(pkg.base_pasajeros) === 4 ? 4 : 2;
        const tarifaPorPersona = Math.round(tarifa / divisor);
        const textoBase = divisor === 4 ? 'Base Cuádruple' : 'Base Doble';
        
        let servicios = [];
        try { servicios = typeof pkg.servicios === 'string' ? JSON.parse(pkg.servicios) : pkg.servicios; } catch(e) {}

        // Mejoramos la detección del seguro (incluyendo cruceros que ya lo traen por defecto)
        const tieneSeguro = Array.isArray(servicios) && servicios.some(s => 
            s.tipo === 'seguro' || (s.tipo === 'bus' && s.asistencia === true) || s.tipo === 'crucero'
        );

        const tieneAereo = Array.isArray(servicios) && servicios.some(s => s.tipo === 'aereo');

        // LÓGICA INTELIGENTE: ¿Es un paquete o un servicio suelto?
        let tituloServicio = "PAQUETE";
        if (Array.isArray(servicios) && servicios.length === 1) {
            const dicNombres = { 'aereo': 'VUELO', 'hotel': 'HOTEL', 'traslado': 'TRASLADO', 'seguro': 'ASISTENCIA AL VIAJERO', 'bus': 'PAQUETE BUS', 'crucero': 'CRUCERO', 'circuito': 'CIRCUITO', 'adicional': 'SERVICIO' };
            tituloServicio = dicNombres[servicios[0].tipo] || "SERVICIO";
        }

        // 1. ENCABEZADO
        let texto = `*${pkg.destino.toUpperCase()}*\n`;
        texto += `${tituloServicio}\n\n`; 
        
        const esCircuitoTxt = Array.isArray(servicios) && servicios.some(s => s.tipo === 'circuito');
        const fechaTxt = (!pkg.fecha_salida && esCircuitoTxt && !tieneAereo) ? 'Múltiples Salidas' : formatDateAR(pkg.fecha_salida);
        texto += `📅 Salida: ${fechaTxt}\n`;
        
        // --- LÓGICA INTELIGENTE DE SALIDA ---
        let lugarSalida = pkg.salida;
        if (!tieneAereo) {
            const crucero = Array.isArray(servicios) && servicios.find(s => s.tipo === 'crucero');
            const circuito = Array.isArray(servicios) && servicios.find(s => s.tipo === 'circuito');
            if (crucero && crucero.crucero_puerto_salida) {
                lugarSalida = crucero.crucero_puerto_salida;
            } else if (circuito && circuito.circuito_salida) {
                lugarSalida = circuito.circuito_salida;
            }
        }
        texto += `📍 Desde: ${lugarSalida}\n`;
        if (noches > 0) texto += `🌙 Duración: ${noches} Noches\n`;
        
        // 2. INTRODUCCIÓN SERVICIOS
        // El texto también se adapta: "Servicios que incluye el hotel / paquete"
        texto += `\n✅ Servicios que incluye el ${tituloServicio.toLowerCase()}:\n\n`;

        if (Array.isArray(servicios)) {
            servicios.forEach(s => {
                if(s.tipo === 'aereo') {
                    let eIda = (s.escalas_ida !== undefined) ? parseInt(s.escalas_ida) : (parseInt(s.escalas) || 0);
                    let eVuelta = (s.escalas_vuelta !== undefined) ? parseInt(s.escalas_vuelta) : (parseInt(s.escalas) || 0);
                    
                    let escalasTxt = "";
                    if (eIda === eVuelta) {
                        escalasTxt = formatEscalasTexto(eIda);
                    } else {
                        escalasTxt = `IDA: ${formatEscalasTexto(eIda)} | REGRESO: ${formatEscalasTexto(eVuelta)}`;
                    }

                    texto += `> ✈️ *AÉREO*\n`;
                    if (s.aeropuerto_salida) {
                        texto += `🛫 *Salida desde:* ${s.aeropuerto_salida}\n`;
                    }
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
                    texto += ` Incluye:\n`;
                    texto += `- Pensión Completa\n`;
                    texto += `- Asistencia al Viajero\n`;
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

        // 3. PIE DE PAGINA (PRECIO Y LEGALES) 👉 CON TEXTO DINÁMICO
        texto += `💲*Tarifa final por Persona en ${textoBase}:*\n`;
        texto += `${pkg.moneda} $${formatMoney(tarifaPorPersona)}\n\n`;
        
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
        
        // ✈️ REGLA: Políticas de vuelo (Solo si hay aéreo)
        if (tieneAereo) {
            texto += `✈ Políticas generales de aerolíneas (tarifas económicas)\n`;
            texto += `-Equipaje y la selección de asientos no están incluidos (pueden tener costo adicional)\n\n`;
        }
        
        // 🛡️ REGLA: Asistencia al viajero (Solo si NO la tiene)
        if (!tieneSeguro) {
            texto += `Asistencia al viajero no incluida. Puede añadirse al reservar o más adelante. Es requisito obligatorio en la mayoría de los destinos internacionales\n`;
        }

        return texto.trim(); // Limpia espacios vacíos al final
    }

    window.copiarPresupuesto = (pkg) => {
        const texto = generarTextoPresupuesto(pkg);
        navigator.clipboard.writeText(texto).then(() => {
            window.showAlert("✅ ¡Presupuesto copiado al portapapeles!", "success");
        }).catch(err => {
            console.error('Error al copiar: ', err);
            window.showAlert("Error al copiar texto.", "error");
        });
    };

    function renderServiciosClienteHTML(rawJson) { 
        let s=[]; try{s=typeof rawJson==='string'?JSON.parse(rawJson):rawJson;}catch(e){return'<p>-</p>';} 
        if(!Array.isArray(s)||s.length===0)return'<p>-</p>'; 
        let h=''; 
        s.forEach(x=>{ 
            let i='🔹',t='',l=[]; 
            if(x.tipo==='aereo'){
                i='✈️';t='AÉREO';
                if(x.aeropuerto_salida) {
                    l.push(`🛫 <b>Salida desde:</b> ${x.aeropuerto_salida}`);
                }
                l.push(`<b>${x.aerolinea}</b>`);
                l.push(`${formatDateAR(x.fecha_aereo)}${x.fecha_regreso?` - ${formatDateAR(x.fecha_regreso)}`:''}`);
                
                // LÓGICA VISUAL ESCALAS (IDA Y VUELTA)
                let eIda = (x.escalas_ida !== undefined) ? parseInt(x.escalas_ida) : (parseInt(x.escalas) || 0);
                let eVuelta = (x.escalas_vuelta !== undefined) ? parseInt(x.escalas_vuelta) : (parseInt(x.escalas) || 0);
                
                let escalasTxt = "";
                if (eIda === eVuelta) {
                    escalasTxt = formatEscalasTexto(eIda);
                } else {
                    escalasTxt = `<b>IDA:</b> ${formatEscalasTexto(eIda)} | <b>REG:</b> ${formatEscalasTexto(eVuelta)}`;
                }

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
            else if(x.tipo==='seguro'){
                i='🛡️';t='SEGURO';
                if(x.cobertura) l.push(x.cobertura);
            } 
            else if(x.tipo==='adicional'){i='➕';t='ADICIONAL';l.push(`${x.descripcion}`);} 
            else if(x.tipo === 'bus'){
            i='🚌'; t='PAQUETE BUS';
                
            if(x.bus_salida) {
                l.push(`📍 <b>Salida desde:</b> ${x.bus_salida}`);
            }
            // 1. Noches
            if(x.noches) l.push(`🌙 <b>${x.noches} Noches</b>`);

            // 2. Alojamiento
            if(x.incluye_alojamiento){
                // Nombre y Link
                l.push(`🏨 <b>Hotel:</b> ${x.hotel_nombre || 'A confirmar'}`);
                if(x.hotel_ubicacion) {
                    l.push(`<a href="${x.hotel_ubicacion}" target="_blank" style="color:#ef5a1a;text-decoration:none;font-weight:bold; display:inline-block; margin-top:2px;">📍 Ver Ubicación</a>`);
                }
                
                // LÓGICA DE BEBIDAS: Solo mostrar si es Media Pensión o Pensión Completa
                let infoComida = `🍽 <b>Régimen:</b> ${x.regimen || ''}`;
                
                if (x.regimen === 'Media Pensión' || x.regimen === 'Pensión Completa') {
                    if(x.bebidas === 'Si') infoComida += ` <span style="color:#2ecc71; font-weight:bold;">(🥤 Con Bebidas)</span>`;
                    else if(x.bebidas === 'No') infoComida += ` <span style="color:#e74c3c;">(🚫 Sin Bebidas)</span>`;
                }
                
                l.push(infoComida);
            }

            // 3. Excursiones
            if(x.incluye_excursiones){
                l.push(`🌲 <b>Excursiones:</b> ${x.excursion_adicional || 'Incluidas'}`);
            }

            // 4. Asistencia
            if(x.asistencia){
                l.push(`🚑 <b>Asistencia al Viajero:</b> Incluida`);
            }

            // 5. Observaciones
            if(x.observaciones){
                l.push(`📝 <i>Nota: ${x.observaciones}</i>`);
            }
        }
            else if(x.tipo === 'crucero'){
                i='🚢'; t='CRUCERO';
                l.push(`<b>Naviera:</b> ${x.crucero_naviera}`);
                if(x.crucero_puerto_salida) l.push(`📍 <b>Puerto de Salida:</b> ${x.crucero_puerto_salida}`);
                
                let det = [];
                if(x.checkin) det.push(`Embarque: ${formatDateAR(x.checkin)}`);
                if(x.crucero_noches) det.push(`🌙 ${x.crucero_noches} Noches`);
                if(det.length > 0) l.push(`<small>${det.join(' | ')}</small>`);

                if(x.crucero_paradas) {
                    l.push(`🗺️ <b>Recorrido:</b> ${x.crucero_paradas}`);
                }

                l.push(`<div style="margin-top:5px;"><b>Incluye:</b><br>
                <span style="color:#2ecc71;">✓ Pensión Completa</span><br>
                <span style="color:#2ecc71;">✓ Asistencia al Viajero</span>
                ${x.crucero_bebidas ? '<br><span style="color:#2ecc71;">✓ Paquete de Bebidas</span>' : ''}
                ${x.crucero_propinas ? '<br><span style="color:#2ecc71;">✓ Propinas Incluidas</span>' : ''}
                </div>`);
            }
            else if(x.tipo === 'adicional'){
                i='➕'; t='ADICIONAL'; 
                l.push(`${x.descripcion}`);
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

                if(x.circuito_descripcion) {
                    l.push(`<div style="margin-top:5px; color:#555;">📝 <i>${x.circuito_descripcion.replace(/\n/g, '<br>')}</i></div>`);
                }
            }
            h+=`<div style="margin-bottom:5px;border-left:3px solid #ddd;padding-left:10px;"><div style="font-weight:bold;color:#11173d;">${i} ${t}</div><div style="font-size:0.9em;">${l.join('<br>')}</div></div>`;
        }); 
        return h; 
    }
    
    function renderCostosProveedoresHTML(rawJson) { 
        let s=[]; try{s=typeof rawJson==='string'?JSON.parse(rawJson):rawJson;}catch(e){return'<p>-</p>';} 
        if(!Array.isArray(s)||s.length===0)return'<p>-</p>'; 
        let h='<ul style="padding-left:15px;margin:0;">'; 
        s.forEach(x=>{ 
            let texto = `${x.proveedor||x.tipo}: $${x.costo}`;
            h+=`<li>${texto}</li>`; 
        }); 
        return h+'</ul>'; 
    }

   // --- ALERTAS ---
    window.showAlert = (message, type = 'error') => { return new Promise((resolve) => { showLoader(false); const overlay = document.getElementById('custom-alert-overlay'); if(overlay) overlay.style.zIndex = "99999"; const title = document.getElementById('custom-alert-title'); const msg = document.getElementById('custom-alert-message'); const icon = document.getElementById('custom-alert-icon'); const btn = document.getElementById('custom-alert-btn'); const btnCancel = document.getElementById('custom-alert-cancel'); if(btnCancel) btnCancel.style.display = 'none'; if (type === 'success') { title.innerText = '¡Éxito!'; title.style.color = '#4caf50'; icon.innerHTML = '✅'; } else if (type === 'info') { title.innerText = 'Información'; title.style.color = '#3498db'; icon.innerHTML = 'ℹ️'; } else { title.innerText = 'Atención'; title.style.color = '#ef5a1a'; icon.innerHTML = '⚠️'; } msg.innerText = message; overlay.style.display = 'flex'; btn.onclick = () => { overlay.style.display = 'none'; resolve(); }; }); };
    window.showConfirm = (message) => { return new Promise((resolve) => { showLoader(false); const overlay = document.getElementById('custom-alert-overlay'); if(overlay) overlay.style.zIndex = "99999"; const title = document.getElementById('custom-alert-title'); const msg = document.getElementById('custom-alert-message'); const icon = document.getElementById('custom-alert-icon'); const btnOk = document.getElementById('custom-alert-btn'); const btnCancel = document.getElementById('custom-alert-cancel'); title.innerText = 'Confirmación'; title.style.color = '#11173d'; icon.innerHTML = '❓'; msg.innerText = message; if(btnCancel) btnCancel.style.display = 'inline-block'; overlay.style.display = 'flex'; btnOk.onclick = () => { overlay.style.display = 'none'; resolve(true); }; if(btnCancel) btnCancel.onclick = () => { overlay.style.display = 'none'; resolve(false); }; }); };
   
    // --- CORE ---
    if(dom.logoImg) {
        dom.logoImg.addEventListener('click', async (e) => {
            e.preventDefault(); // Evitamos cualquier comportamiento por defecto

            // 1. Ocultamos otras pantallas y mostramos la grilla principal
            showView('search'); 

            // 2. Limpiamos el formulario por si el vendedor estaba a la mitad de una carga
            if (dom.uploadForm) dom.uploadForm.reset();
            if (dom.containerServicios) dom.containerServicios.innerHTML = '';

            // 3. (Opcional pero recomendado) Ya que apretó el logo para "refrescar", 
            // le traemos las novedades de Firebase en silencio y al instante
            if(typeof fetchAndLoadPackages === 'function') await fetchAndLoadPackages();

            // 4. Lo llevamos arriba de todo de la página con un scroll suavecito
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const minGlobalDate = now.toISOString().split('T')[0];
    if(dom.inputFechaViaje) {
        dom.inputFechaViaje.min = minGlobalDate; 
        dom.inputFechaViaje.addEventListener('change', (e) => {
            const fechaSalida = e.target.value;
            if(fechaSalida && fechaSalida < minGlobalDate) { window.showAlert("⚠️ La fecha de salida no puede ser en el pasado."); dom.inputFechaViaje.value = ""; return; }
            if(fechaSalida) actualizarMinimosFechas(fechaSalida);
        });
    }
    function actualizarMinimosFechas(minDate) {
        const dateInputs = dom.containerServicios.querySelectorAll('input[type="date"]');
        dateInputs.forEach(input => { input.min = minDate; if(input.value && input.value < minDate){ input.value = ''; input.style.borderColor = '#ef5a1a'; setTimeout(() => input.style.borderColor = '#ddd', 2000); } });
    }

    // --- ANIMACIÓN DEL SWITCH DE PASAJEROS ---
    window.toggleBasePasajeros = () => {
        const input = document.getElementById('paquete-base-pasajeros');
        if(!input) return;
        
        // Invertimos el valor
        const nuevoValor = input.value === "2" ? "4" : "2";
        window.setTogglePasajerosVisually(nuevoValor);
        
        // Recalculamos la guita al instante
        if(typeof window.calcularPorPersona === 'function') window.calcularPorPersona();
    };

    window.setTogglePasajerosVisually = (val) => {
        const input = document.getElementById('paquete-base-pasajeros');
        const bg = document.getElementById('toggle-bg');
        const opt2 = document.getElementById('opt-2');
        const opt4 = document.getElementById('opt-4');
        if(!input || !bg) return;

        input.value = val;

        if(val === "4") {
            bg.style.left = "75px"; // Distancia exacta para la mitad derecha
            opt2.style.opacity = "0.3"; opt2.style.filter = "grayscale(100%)";
            opt4.style.opacity = "1"; opt4.style.filter = "drop-shadow(0px 1px 2px rgba(0,0,0,0.4))";
        } else {
            bg.style.left = "4px"; // Distancia exacta para la mitad izquierda
            opt2.style.opacity = "1"; opt2.style.filter = "drop-shadow(0px 1px 2px rgba(0,0,0,0.4))";
            opt4.style.opacity = "0.3"; opt4.style.filter = "grayscale(100%)";
        }
    };

    /// --- EVENTO PARA CALCULAR AUTOMÁTICAMENTE TARIFA X PERSONA ---
    window.calcularPorPersona = () => {
        const totalInput = document.getElementById('upload-tarifa-total');
        const personaInput = document.getElementById('upload-tarifa-persona');
        const baseSelect = document.getElementById('paquete-base-pasajeros');
        
        if (totalInput && personaInput) {
            const total = parseFloat(totalInput.value) || 0;
            // Si el selector está en 4, divide por 4. Si no, divide por 2 por defecto.
            const divisor = (baseSelect && parseInt(baseSelect.value) === 4) ? 4 : 2;
            const porPersona = Math.round(total / divisor);
            personaInput.value = formatMoney(porPersona);
        }
    };

    if(dom.inputTarifaTotal) {
        dom.inputTarifaTotal.addEventListener('input', window.calcularPorPersona);
    }

    function processPackageHistory(rawList) {
        if (!Array.isArray(rawList)) return [];
        const historyMap = new Map();
        rawList.forEach(pkg => { const id = pkg.id_paquete || pkg.id || pkg['item.id']; if (!id) return; if (!historyMap.has(id)) historyMap.set(id, []); historyMap.get(id).push(pkg); });
        const processedList = [];
        historyMap.forEach((versions) => { const latestVersion = versions[versions.length - 1]; if (latestVersion.status === 'deleted') return; processedList.push(latestVersion); });
        return processedList;
    }

    // BADGE
    function updatePendingBadge() {
        const badge = document.getElementById('badge-gestion');
        if (!badge) return;
        if (userData.rol !== 'admin' && userData.rol !== 'editor') { badge.style.display = 'none'; return; }
        const pendingCount = uniquePackages.filter(p => p.status === 'pending').length;
        if (pendingCount > 0) { badge.innerText = pendingCount; badge.style.display = 'inline-block'; } 
        else { badge.style.display = 'none'; }
    }

    // --- SISTEMA DE COLA / MUTEX CON FIRESTORE ---
    async function secureFetch(url, body) {
        if (!currentUser) throw new Error('No auth');
        
        if (url === API_URL_SEARCH) {
            return await _doFetch(url, body);
        }
        return await uploadWithMutex(url, body);
    }

    async function _doFetch(url, body) {
        const token = await currentUser.getIdToken(true);
        const res = await fetch(url, { 
            method:'POST', 
            headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`}, 
            body:JSON.stringify(body), 
            cache:'no-store' 
        });
        
        if (!res.ok) throw new Error(`API HTTP Error: ${res.status}`);

        const jsonResponse = await res.json();
        if (jsonResponse.error || jsonResponse.status === 'error' || (Array.isArray(jsonResponse) && jsonResponse.length === 0 && url === API_URL_UPLOAD)) {
            throw new Error(jsonResponse.message || "Error procesando en n8n (Respuesta inválida).");
        }

        return jsonResponse;
    }

    async function uploadWithMutex(url, body) {
        const lockRef = db.collection('config').doc('upload_lock');
        let acquired = false;
        let attempts = 0;
        
        while(!acquired && attempts < 20) { 
            try {
                await db.runTransaction(async (t) => {
                    const doc = await t.get(lockRef);
                    const data = doc.data();
                    const now = Date.now();

                    if (data && data.locked && (now - data.timestamp < 15000)) {
                        throw "LOCKED";
                    }
                    t.set(lockRef, { locked: true, user: currentUser.email, timestamp: now });
                });
                acquired = true;
            } catch (e) {
                if (e === "LOCKED" || e.message === "LOCKED") {
                    showLoader(true, `⏳ Esperando turno de carga... (${attempts+1}/20)`);
                    await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
                    attempts++;
                } else {
                    console.error("Error Transaction:", e);
                    throw e; 
                }
            }
        }

        if(!acquired) throw new Error("El sistema está muy saturado. Por favor intenta en 1 minuto.");

        try {
            showLoader(true, "🚀 Subiendo datos...");
            const result = await _doFetch(url, body);
            return result;
        } finally {
            await lockRef.set({ locked: false });
        }
    }

    async function fetchAndLoadPackages() { 
        showLoader(true, "Cargando paquetes...");
        try { 
            // 1. Descargamos todo de Firebase a la velocidad de la luz
            const snapshot = await db.collection('paquetes').get();
            
            // 2. Transformamos los datos al formato que tu código ya conoce
            allPackages = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id_paquete: doc.id, // Le inyectamos el ID seguro de Firebase
                    ...data
                };
            });
            
            // ORDEN TEMPORAL
            allPackages.sort((a, b) => {
                // Función interna para sacar los milisegundos de cualquier paquete (viejo o nuevo)
                function getMilisegundos(pkg) {
                    if (pkg.timestamp) return pkg.timestamp; // Si es nuevo de Firebase
                    if (pkg.fecha_creacion) { // Si es viejo del Excel (ej: 13/03/2026)
                        const partes = pkg.fecha_creacion.split('/');
                        if (partes.length === 3) {
                            return new Date(partes[2], partes[1] - 1, partes[0]).getTime();
                        }
                    }
                    return 0; // Por si alguno viene sin fecha
                }
                
                // Ordenamos de Mayor a Menor (más recientes arriba)
                return getMilisegundos(b) - getMilisegundos(a); 
            });
            
            // 3. Tus funciones de filtrado y dibujado quedan intactas
            uniquePackages = processPackageHistory(allPackages); 
            autoCleanupPackages(uniquePackages);
            applyFilters();
            updatePendingBadge(); 
            
        } catch(e) { 
            console.error("🔥 Error al leer de Firebase:", e); 
            // Cuidamos al usuario: le mostramos qué pasó si falla
            if (typeof window.showAlert === 'function') {
                window.showAlert("No se pudieron cargar las promociones. Revisa tu conexión.", "error");
            }
        }
        showLoader(false);
    }

    auth.onAuthStateChanged(async (u) => {
        showLoader(true, "Iniciando...");
        
        // 👻 ESCUDO: Si el usuario es Anónimo o no tiene email, cerramos su sesión y lo bloqueamos
        if (u && (u.isAnonymous || !u.email)) {
            await auth.signOut();
            showLoader(false);
            return; // Cortamos acá para que el sistema le muestre la pantalla de Login normal
        }

        if (u) {
            try {
                const emailLimpio = u.email.trim().toLowerCase();
                const doc = await db.collection('usuarios').doc(emailLimpio).get();
                if (doc.exists) {
                    currentUser = u; userData = doc.data(); 
                    dom.loginContainer.style.display='none'; dom.appContainer.style.display='block';
                    const nombreMostrar = userData.franquicia || u.email;
                    if(dom.userEmail) dom.userEmail.innerHTML = `<b>${nombreMostrar}</b><br><small>${userData.rol.toUpperCase()}</small>`;
                    configureUIByRole(); await fetchAndLoadPackages(); await loadCalculadoraConfig(); showView('search');
                    if (document.getElementById('btn-toggle-calculadora')) document.getElementById('btn-toggle-calculadora').style.display = 'flex';
                } else { await window.showAlert(`⛔ Sin permisos.`); auth.signOut(); }
            } catch (e) { 
                console.error("🔥 ERROR REAL DE FIRESTORE:", e); // <--- Esto mostrará el detalle en consola (F12)
                console.log("Código de error:", e.code);
                console.log("Mensaje:", e.message);
                await window.showAlert("Error de conexión: " + e.message); // Verás el error en la pantalla
            }
        } else { 
            currentUser = null; userData = null; dom.loginContainer.style.display='flex'; dom.appContainer.style.display='none'; 
            if (document.getElementById('btn-toggle-calculadora')) document.getElementById('btn-toggle-calculadora').style.display = 'none';
        }
        showLoader(false);
    });

    dom.btnLogin.addEventListener('click', () => { showLoader(true); auth.signInWithPopup(provider).catch(() => showLoader(false)); });
    dom.btnLogout.addEventListener('click', () => { showLoader(true); auth.signOut().then(() => window.location.reload()); });

    function configureUIByRole() {
        const rol = userData.rol;

        // --- NUEVO: Mostrar panel de visibilidad solo a Admins/Editores ---
        const panelVisibilidad = document.getElementById('panel-visibilidad-admin');
        if (panelVisibilidad) {
            panelVisibilidad.style.display = (rol === 'admin' || rol === 'editor') ? 'block' : 'none';
        }
    
        // --- 1. PROTECCIÓN DE BOTONES (El arreglo del error) ---
        // Si existe el botón Gestión, lo configuramos. Si no, seguimos de largo.
        if (dom.nav && dom.nav.gestion) {
            dom.nav.gestion.style.display = (rol === 'editor' || rol === 'admin') ? 'inline-block' : 'none';
        }
    
        // Lo mismo para el botón de Usuarios
        if (dom.nav && dom.nav.users) {
            dom.nav.users.style.display = (rol === 'admin') ? 'inline-block' : 'none';
        }
    
        // --- 2. RESTO DE LA LÓGICA ---
        if (dom.containerFiltroCreador) dom.containerFiltroCreador.style.display = 'flex';
    
        if (rol === 'admin' && typeof loadUsersList === 'function') loadUsersList();
    
    
        // --- 3. LO QUE FALTABA AL FINAL (Planificación y Badge) ---
        // Agregamos un pequeño chequeo de seguridad también aquí por si acaso
        if (typeof updatePendingBadge === 'function') updatePendingBadge();
        if (typeof initWeeklyPlanner === 'function') initWeeklyPlanner();
    }

    if (dom.userForm) {
        dom.userForm.addEventListener('submit', async (e) => {
            e.preventDefault(); showLoader(true);
            const email = document.getElementById('user-email-input').value.trim().toLowerCase();
            const rol = document.getElementById('user-role-input').value;
            const fran = document.getElementById('user-franchise-input').value;
            try { await db.collection('usuarios').doc(email).set({ email, rol, franquicia: fran, fecha_modificacion: new Date() }, { merge: true }); await window.showAlert('Usuario guardado.', 'success'); document.getElementById('user-email-input').value = ''; document.getElementById('user-franchise-input').value = ''; loadUsersList(); } catch (e) { await window.showAlert('Error.', 'error'); }
            showLoader(false);
        });
    }

    async function loadUsersList() {
        const list = dom.usersList; list.innerHTML = 'Cargando...';
        try {
            const snap = await db.collection('usuarios').get(); list.innerHTML = '';
            snap.forEach(doc => { const u = doc.data(); const li = document.createElement('div'); li.className = 'user-item'; li.innerHTML = `<span><b>${u.email}</b><br><small>${u.rol.toUpperCase()} - ${u.franquicia}</small></span><div style="display:flex; gap:5px;"><button class="btn btn-secundario" style="padding:4px 10px;" onclick="editUser('${u.email}', '${u.rol}', '${u.franquicia}')">✏️</button><button class="btn btn-secundario" style="padding:4px 10px;" onclick="confirmDeleteUser('${u.email}')">🗑️</button></div>`; list.appendChild(li); });
        } catch (e) { list.innerHTML = 'Error.'; }
    }

    window.editUser = (e, r, f) => { document.getElementById('user-email-input').value = e; document.getElementById('user-role-input').value = r; document.getElementById('user-franchise-input').value = f; window.scrollTo(0,0); window.showAlert(`Editando: ${e}`, 'info'); };
    window.confirmDeleteUser = async (e) => { if(await window.showConfirm("¿Eliminar?")) try { showLoader(true); await db.collection('usuarios').doc(e).delete(); loadUsersList(); showLoader(false); } catch(x){alert('Error');} };

    dom.btnAgregarServicio.addEventListener('click', () => { if (dom.selectorServicio.value) { agregarModuloServicio(dom.selectorServicio.value); dom.selectorServicio.value = ""; } });

    // --- ESTRELLAS ---
    window.setStars = (id, count) => {
        const container = document.querySelector(`.servicio-card[data-id="${id}"] .star-rating`);
        const input = document.getElementById(`stars-${id}`);
        if(container && input) {
            input.value = count;
            const spans = container.querySelectorAll('span');
            spans.forEach((span, idx) => {
                if(idx < count) span.classList.add('filled');
                else span.classList.remove('filled');
            });
        }
    };

    function agregarModuloServicio(tipo, data = null) {
        const container = dom.containerServicios; const existingServices = container.querySelectorAll('.servicio-card');
        const hasExclusive = Array.from(existingServices).some(c => c.dataset.tipo === 'bus');
        if (!data) { 
            if (hasExclusive && tipo !== 'adicional') return window.showAlert("⛔ Ya hay un paquete Bus cargado. Solo puedes agregar Adicionales.", "error"); 
            if (tipo === 'bus' && existingServices.length > 0) return window.showAlert("⛔ El Paquete Bus debe ser único y no se puede mezclar con otros servicios base.", "error"); 
        }
        
        const id = Date.now() + Math.random(); const div = document.createElement('div');
        div.className = `servicio-card ${tipo}`; div.dataset.id = id; div.dataset.tipo = tipo;
        let html = `<button type="button" class="btn-eliminar-servicio" onclick="this.parentElement.remove(); window.calcularTotal();">×</button>`;
        
        if(tipo==='aereo'){
            // Inyeccion de aereos
            html+=`<h4>✈️ Aéreo</h4>
            <div class="form-group-row">
                <div class="form-group"><label>Aerolínea</label><input type="text" name="aerolinea" required></div>
                <div class="form-group"><label>Ida</label><input type="date" name="fecha_aereo" required></div>
                <div class="form-group"><label>Vuelta</label><input type="date" name="fecha_regreso"></div>
            </div>
            
            <div class="form-group-row">
                <div class="form-group"><label>Escalas Ida</label>${crearContadorHTML('escalas_ida',0)}</div>
                <div class="form-group"><label>Escalas Vuelta</label>${crearContadorHTML('escalas_vuelta',0)}</div>
                <div class="form-group"><label>Equipaje</label>
                    <select name="tipo_equipaje">
                        <option>Mochila</option>
                        <option>Mochila + Carry On</option>
                        <option>Mochila + Bodega</option>
                        <option>Mochila + Carry On + Bodega</option>
                    </select>
                </div>
                <div class="form-group" style="flex: 1.5;">
                    <label>🛫 Aeropuerto Salida (Opcional)</label>
                    <select name="aeropuerto_salida" class="form-control">
                        <option value="">-- Selecciona provincia primero --</option>
                    </select>
                </div>
            </div>

            <div class="form-group-row">
                <div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div>
                <div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div>
            </div>`;
        }
        else if(tipo==='hotel'){
            html+=`<h4>🏨 Hotel</h4>
            <div class="form-group"><label>Alojamiento</label><input type="text" name="hotel_nombre" required></div>
            <div class="form-group"><label>Estrellas</label>
                <div class="star-rating" data-id="${id}">
                    <span onclick="setStars('${id}', 1)">★</span>
                    <span onclick="setStars('${id}', 2)">★</span>
                    <span onclick="setStars('${id}', 3)">★</span>
                    <span onclick="setStars('${id}', 4)">★</span>
                    <span onclick="setStars('${id}', 5)">★</span>
                </div>
                <input type="hidden" name="hotel_estrellas" id="stars-${id}" value="0">
            </div>
            <div class="form-group"><label>Ubicación (Link)</label><input type="url" name="hotel_link" placeholder="https://maps.google.com/..."></div>
            <div class="form-group-row">
                <div class="form-group"><label>Check In</label><input type="date" name="checkin" onchange="window.calcularNoches(${id})" required></div>
                <div class="form-group"><label>Check Out</label><input type="date" name="checkout" onchange="window.calcularNoches(${id})" required></div>
                <div class="form-group"><label>Noches</label><input type="text" name="noches" id="noches-${id}" readonly style="background:#eee; width:60px;"></div>
            </div>
            <div class="form-group"><label>Régimen</label><select name="regimen"><option>Solo Habitación</option><option>Desayuno</option><option>Media Pensión</option><option>All Inclusive</option></select></div>
            <div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
        }
        else if(tipo==='traslado'){html+=`<h4>🚕 Traslado</h4><div class="checkbox-group"><label class="checkbox-label"><input type="checkbox" name="trf_in"> In</label><label class="checkbox-label"><input type="checkbox" name="trf_out"> Out</label><label class="checkbox-label"><input type="checkbox" name="trf_hah"> Hotel - Hotel</label></div><div class="form-group-row"><div class="form-group"><label>Tipo</label><select name="tipo_trf"><option>Compartido</option><option>Privado</option></select></div><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;}
        else if(tipo==='seguro'){
            html+=`<h4>🛡️ Seguro</h4>
            <div class="form-group-row">
                <div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div>
                <div class="form-group"><label>Cobertura</label><input type="text" name="cobertura" required></div>
            </div>
            <div class="form-group-row"><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;
        }
        else if(tipo==='adicional'){html+=`<h4>➕ Adicional</h4><div class="form-group"><label>Detalle</label><input type="text" name="descripcion" required></div><div class="form-group-row"><div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div><div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div></div>`;}
        else if (tipo === 'bus') {
                const uniqueId = Date.now();

                html += `
                    <div style="margin-bottom:15px; border-bottom: 2px solid #f8f9fa; padding-bottom:10px;">
                        <h4 style="margin:0; color:#333;">🚌 Paquete Bus</h4>
                    </div>

                   <div class="form-group-row">
                        <div class="form-group" style="flex: 0 0 auto;">
                            <label style="font-weight:600;">Cant. Noches <span style="color:red">*</span></label>
                            <input type="number" name="noches" class="form-control" required style="width: 100px;">
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label style="font-weight:600;">Ciudad de Salida (Opcional)</label>
                            <input type="text" name="bus_salida" class="form-control" placeholder="Ej: Córdoba, Rosario...">
                        </div>
                    </div>

                    <div class="form-group" style="border-bottom: 1px solid #eee; padding: 12px 0;">
                        <div style="display: flex; align-items: center; width: 100%;">
                            <div style="flex: 1;">
                                <label style="margin:0; font-weight:500; color:#555; cursor:pointer;" for="chk-aloj-${uniqueId}">
                                    Incluye Alojamiento 🏨
                                </label>
                            </div>
                            <div style="width: 40px; text-align: right;">
                                <input type="checkbox" id="chk-aloj-${uniqueId}" name="incluye_alojamiento" style="transform: scale(1.5); cursor: pointer;"
                                onchange="
                                    const box = document.getElementById('hotel-box-${uniqueId}');
                                    box.style.display = this.checked ? 'block' : 'none';
                                    box.querySelectorAll('input, select').forEach(el => el.required = this.checked);
                                ">
                            </div>
                        </div>
                    </div>

                    <div id="hotel-box-${uniqueId}" style="display:none; background:#f9f9f9; padding:15px; border-radius:5px; margin-bottom:10px; border-left: 3px solid #007bff; margin-top:5px;">
                        <div class="form-group">
                            <label>Nombre del Alojamiento <span style="color:red">*</span></label>
                            <input type="text" name="hotel_nombre" class="form-control" placeholder="Nombre...">
                        </div>
                        <div class="form-group-row">
                            <div class="form-group">
                                <label>Régimen <span style="color:red">*</span></label>
                                <select name="regimen" class="form-control">
                                    <option value="" disabled selected>-- Seleccionar --</option>
                                    <option>Solo Alojamiento</option>
                                    <option>Desayuno</option>
                                    <option>Media Pensión</option>
                                    <option>Pensión Completa</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Bebidas <span style="color:red">*</span></label>
                                <select name="bebidas" class="form-control">
                                    <option value="" disabled selected>-- Seleccionar --</option>
                                    <option value="No">🚫 No incluye</option>
                                    <option value="Si">🥤 Si incluye</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Ubicación <span style="color:red">*</span></label>
                            <input type="text" name="hotel_ubicacion" class="form-control" placeholder="Ubicación exacta...">
                        </div>
                    </div>

                    <div class="form-group" style="border-bottom: 1px solid #eee; padding: 12px 0;">
                        <div style="display: flex; align-items: center; width: 100%;">
                            <div style="flex: 1;">
                                <label style="margin:0; font-weight:500; color:#555; cursor:pointer;" for="chk-exc-${uniqueId}">
                                    Incluye Excursiones 🌲
                                </label>
                            </div>
                            <div style="width: 40px; text-align: right;">
                                <input type="checkbox" id="chk-exc-${uniqueId}" name="incluye_excursiones" style="transform: scale(1.5); cursor: pointer;"
                                onchange="
                                    const box = document.getElementById('excursion-box-${uniqueId}');
                                    box.style.display = this.checked ? 'block' : 'none';
                                    box.querySelectorAll('input').forEach(el => el.required = this.checked);
                                ">
                            </div>
                        </div>
                        <div id="excursion-box-${uniqueId}" style="display:none; margin-top:10px;">
                            <label style="font-size:0.9em;">Detalle de excursiones <span style="color:red">*</span></label>
                            <input type="text" name="excursion_adicional" class="form-control" placeholder="Describir excursiones...">
                        </div>
                    </div>

                    <div class="form-group" style="border-bottom: 1px solid #eee; padding: 12px 0; margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; width: 100%;">
                            <div style="flex: 1;">
                                <label style="margin:0; font-weight:500; color:#555; cursor:pointer;" for="chk-assist-${uniqueId}">
                                    Asistencia al Viajero 🚑
                                </label>
                            </div>
                            <div style="width: 40px; text-align: right;">
                                <input type="checkbox" id="chk-assist-${uniqueId}" name="asistencia" style="transform: scale(1.5); cursor: pointer;">
                            </div>
                        </div>
                    </div>

                    <div class="form-group-row">
                        <div class="form-group">
                            <label>Proveedor <span style="color:red">*</span></label>
                            <input type="text" name="proveedor" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label>Costo <span style="color:red">*</span></label>
                            <input type="number" name="costo" class="form-control input-costo" onchange="window.calcularTotal && window.calcularTotal()" required>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Observaciones</label>
                        <textarea name="observaciones" class="form-control" rows="2" placeholder="Notas adicionales..."></textarea>
                    </div>
                `;
            }
       else if(tipo === 'crucero') {
            // Limpiamos el ID para que no tenga puntos decimales que rompan el CSS
            const idLimpio = String(id).replace('.', '_'); 
            
            let paradasHtml = '';
            let paradasValue = '';
            if (data && data.crucero_paradas) {
                paradasValue = data.crucero_paradas;
                const paradasArray = data.crucero_paradas.split(' - ');
                paradasArray.forEach((p, index) => {
                    paradasHtml += `<div style="display:flex; gap:5px; margin-bottom:5px;">
                        <input type="text" class="form-control parada-input-${idLimpio}" value="${p}" oninput="window.actualizarParadas('${idLimpio}')">
                        ${index > 0 ? `<button type="button" class="btn btn-secundario" style="padding:2px 8px;" onclick="this.parentElement.remove(); window.actualizarParadas('${idLimpio}');">🗑️</button>` : ''}
                    </div>`;
                });
            } else {
                paradasHtml = `<div style="display:flex; gap:5px; margin-bottom:5px;">
                    <input type="text" class="form-control parada-input-${idLimpio}" placeholder="Ej: Punta del Este..." oninput="window.actualizarParadas('${idLimpio}')">
                </div>`;
            }

            html += `
                <div style="margin-bottom:15px; border-bottom: 2px solid #f8f9fa; padding-bottom:10px;">
                    <h4 style="margin:0; color:#333;">🚢 Crucero</h4>
                </div>
                <div class="form-group-row">
                    <div class="form-group"><label>Naviera</label><input type="text" name="crucero_naviera" placeholder="Ej: MSC, Costa Cruceros..." required></div>
                    <div class="form-group"><label>Puerto de Salida</label><input type="text" name="crucero_puerto_salida" placeholder="Ej: Buenos Aires, Miami..." required></div>
                </div>
                
                <div class="form-group-row">
                    <div class="form-group"><label>Embarque</label><input type="date" name="checkin" onchange="window.calcularNoches('${id}')" required></div>
                    <div class="form-group"><label>Desembarque</label><input type="date" name="checkout" onchange="window.calcularNoches('${id}')" required></div>
                    <div class="form-group"><label>Noches</label><input type="text" name="crucero_noches" id="noches-${id}" readonly style="background:#eee; width:60px;"></div>
                </div>

                <div class="form-group-row" style="background:#f9f9f9; padding:12px; border-radius:5px; margin-bottom:10px;">
                    <div class="form-group" style="flex:1;">
                        <label style="margin:0; font-weight:500; cursor:pointer;"><input type="checkbox" name="crucero_bebidas" style="transform: scale(1.2); margin-right:5px;"> Paquete de Bebidas 🥤</label>
                    </div>
                    <div class="form-group" style="flex:1;">
                        <label style="margin:0; font-weight:500; cursor:pointer;"><input type="checkbox" name="crucero_propinas" style="transform: scale(1.2); margin-right:5px;"> Propinas Incluidas 💰</label>
                    </div>
                </div>
                
                <div style="margin-bottom: 15px; padding-left: 5px;">
                    <small style="color:#2ecc71; font-weight:bold;">✓ Pensión Completa incluida</small> | 
                    <small style="color:#2ecc71; font-weight:bold;">✓ Asistencia al Viajero incluida</small>
                </div>

                <div class="form-group" style="border: 1px solid #eee; padding: 10px; border-radius: 5px; margin-bottom:10px;">
                    <label>Paradas del Recorrido</label>
                    <div id="paradas-container-${id}">
                        ${paradasHtml}
                    </div>
                    <button type="button" class="btn btn-secundario" style="padding: 2px 10px; font-size: 0.9em; margin-top:5px;" onclick="
                        const cont = document.getElementById('paradas-container-${id}');
                        const div = document.createElement('div');
                        div.style.cssText = 'display:flex; gap:5px; margin-bottom:5px;';
                        div.innerHTML = '<input type=\\'text\\' class=\\'form-control parada-input-${id}\\' placeholder=\\'Siguiente parada...\\' oninput=\\'window.actualizarParadas(\\'${id}\\')\\'><button type=\\'button\\' class=\\'btn btn-secundario\\' style=\\'padding:2px 8px;\\' onclick=\\'this.parentElement.remove(); window.actualizarParadas(\\'${id}\\');\\'>🗑️</button>';
                        cont.appendChild(div);
                    ">+ Agregar Parada</button>
                    <input type="hidden" name="crucero_paradas" id="hidden_paradas_${id}" value="${paradasValue}">
                </div>

                <div class="form-group-row">
                    <div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div>
                    <div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="window.calcularTotal()" required></div>
                </div>
            `;
        }
        else if (tipo === 'circuito') {
            // Eliminamos el uniqueId y usamos el 'id' original para que funcionen las noches
            html += `
                <div style="margin-bottom:15px; border-bottom: 2px solid #f8f9fa; padding-bottom:10px;">
                    <h4 style="margin:0; color:#333;">🗺️ Circuito Terrestre</h4>
                </div>
                
                <div class="form-group-row">
                    <div class="form-group">
                        <label>Nombre del Circuito <span style="color:red">*</span></label>
                        <input type="text" name="circuito_nombre" class="form-control" placeholder="Ej: Vuelta al Norte, Europa Clásica..." required>
                    </div>
                    <div class="form-group">
                        <label>Ciudad de Salida</label>
                        <input type="text" name="circuito_salida" class="form-control" placeholder="Ej: Madrid, Salta..." required>
                    </div>
                </div>
                
                <div class="form-group-row">
                    <div class="form-group"><label>Fecha de Inicio</label><input type="date" name="checkin" onchange="window.calcularNoches('${id}')" required></div>
                    <div class="form-group"><label>Fecha de Fin</label><input type="date" name="checkout" onchange="window.calcularNoches('${id}')" required></div>
                    <div class="form-group"><label>Noches</label><input type="text" name="circuito_noches" id="noches-${id}" readonly style="background:#eee; width:60px;"></div>
                </div>
                
                <div class="form-group">
                    <label>Descripción / Itinerario <span style="color:red">*</span></label>
                    <textarea name="circuito_descripcion" class="form-control" rows="3" placeholder="Describe brevemente las ciudades, excursiones o el régimen incluido..." required></textarea>
                </div>
                
                <div class="form-group-row">
                    <div class="form-group"><label>Proveedor <span style="color:red">*</span></label><input type="text" name="proveedor" class="form-control" required></div>
                    <div class="form-group"><label>Costo <span style="color:red">*</span></label><input type="number" name="costo" class="form-control input-costo" onchange="window.calcularTotal()" required></div>
                </div>
            `;
        }
        div.innerHTML = html;
        dom.containerServicios.appendChild(div);
        if (tipo === 'aereo') {
            const selectProvinciaGlobal = document.getElementById('upload-salida');
            if (selectProvinciaGlobal && selectProvinciaGlobal.value) {
                actualizarAeropuertos(selectProvinciaGlobal.value);
            }
        }
        if(dom.inputFechaViaje.value) { const inputsFecha = div.querySelectorAll('input[type="date"]'); inputsFecha.forEach(i => i.min = dom.inputFechaViaje.value); }
        else { const inputsFecha = div.querySelectorAll('input[type="date"]'); const today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset()); inputsFecha.forEach(i => i.min = today.toISOString().split('T')[0]); }

        if(data){ 
            div.querySelectorAll('input, select, textarea').forEach(input => { 
                if (data[input.name] !== undefined) { 
                    if (input.type === 'checkbox') { 
                        input.checked = data[input.name]; 
                        if (input.name === 'bus_alojamiento') input.dispatchEvent(new Event('change')); 
                    } else if (input.type === 'hidden') { 
                        if(input.name === 'hotel_estrellas') { window.setStars(id, data[input.name]); }
                        else {
                            const counter = input.parentElement.querySelector('.counter-value'); 
                            if(counter) counter.innerText = data[input.name]; 
                            input.value = data[input.name]; 
                        }
                    } else { 
                        input.value = data[input.name]; 
                        if (input.name === 'checkin' || input.name === 'checkout') window.calcularNoches(id); 
                    } 
                } 
                // COMPATIBILIDAD CON DATOS VIEJOS
                // Si existe 'escalas' pero no las nuevas, asignamos el valor viejo a ambas
                if (input.name === 'escalas_ida' && data['escalas'] !== undefined && data['escalas_ida'] === undefined) {
                     const counter = input.parentElement.querySelector('.counter-value');
                     if(counter) counter.innerText = data['escalas'];
                     input.value = data['escalas'];
                }
                if (input.name === 'escalas_vuelta' && data['escalas'] !== undefined && data['escalas_vuelta'] === undefined) {
                     const counter = input.parentElement.querySelector('.counter-value');
                     if(counter) counter.innerText = data['escalas'];
                     input.value = data['escalas'];
                }
            }); 
        }
    }

    window.crearContadorHTML = (n, v) => `<div class="counter-wrapper"><button type="button" class="counter-btn" onclick="this.nextElementSibling.innerText=Math.max(0,parseInt(this.nextElementSibling.innerText)-1)">-</button><span class="counter-value">${v}</span><button type="button" class="counter-btn" onclick="this.previousElementSibling.innerText=parseInt(this.previousElementSibling.innerText)+1">+</button><input type="hidden" name="${n}" value="${v}"></div>`;

    // LÓGICA DINÁMICA DE PARADAS DE CRUCERO
    window.actualizarParadas = (id) => {
        const container = document.getElementById(`paradas-container-${id}`);
        if(!container) return;
        const inputs = container.querySelectorAll(`.parada-input-${id}`);
        const vals = Array.from(inputs).map(i => i.value).filter(v => v.trim() !== '');
        const hidden = document.getElementById(`hidden_paradas_${id}`);
        if(hidden) hidden.value = vals.join(' - ');
    };
    // CALCULO NOCHES (HOTEL)
    window.calcularNoches = (id) => { 
        const c=document.querySelector(`.servicio-card[data-id="${id}"]`); if(!c)return; 
        const i=c.querySelector('input[name="checkin"]'), o=c.querySelector('input[name="checkout"]'); 
        if(i&&o&&i.value&&o.value){ 
            const d1=new Date(i.value), d2=new Date(o.value); 
            const diff = (d2>d1)?Math.ceil((d2-d1)/86400000):0;
            const inputN = document.getElementById(`noches-${id}`);
            if(inputN) inputN.value = diff;
        } 
    };
   
    if (typeof window.calcularPorPersona !== 'function') {
        window.calcularPorPersona = () => {
            // Función de seguridad: evita que el HTML colapse al limpiarse
        };
    }
    window.calcularTotal = () => {
        let t=0;
        document.querySelectorAll('.input-costo').forEach(i=>t+=parseFloat(i.value)||0);
        if(dom.inputCostoTotal) dom.inputCostoTotal.value = t;
        const tarifaSugerida = Math.round(t * 1.185);
        if(dom.inputTarifaTotal) dom.inputTarifaTotal.value = tarifaSugerida;
        
        // Disparamos el cálculo por persona automático actualizado
        if (typeof window.calcularPorPersona === 'function') {
            window.calcularPorPersona();
        }
    };

    dom.uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault(); showLoader(true);
        const rol = userData.rol; const promoType = document.getElementById('upload-promo').value;
        
        let status = 'approved'; 
        
        let costo = parseFloat(dom.inputCostoTotal.value) || 0; const tarifa = parseFloat(document.getElementById('upload-tarifa-total').value) || 0; let fechaViajeStr = dom.inputFechaViaje.value;
        if (tarifa < costo) { showLoader(false); return window.showAlert(`Error: Tarifa menor al costo.`, 'error'); }
        
        const cards = document.querySelectorAll('.servicio-card'); if (cards.length === 0) { showLoader(false); return window.showAlert("Agrega servicios.", 'error'); }

        let serviciosData = []; for (let card of cards) { const serv = { tipo: card.dataset.tipo }; card.querySelectorAll('input, select, textarea').forEach(i => { if (i.type === 'checkbox') serv[i.name] = i.checked; else if (i.type === 'hidden') { if(i.name==='hotel_estrellas') serv[i.name] = i.value; else serv[i.name] = i.parentElement.querySelector('.counter-value')?.innerText || i.value; } else serv[i.name] = i.value; }); serviciosData.push(serv); }
        
        // --- NUEVA VALIDACIÓN INTELIGENTE DE FECHA ---
        const esCircuito = serviciosData.some(s => s.tipo === 'circuito');
        const tieneAereo = serviciosData.some(s => s.tipo === 'aereo');
        
        // Si es circuito Y NO HAY AÉREO, borramos la fecha a la fuerza
        if (esCircuito && !tieneAereo) {
            fechaViajeStr = ""; 
        } else if (!fechaViajeStr) { 
            // Si no hay fecha (y no es un circuito puro), frena todo
            showLoader(false); return window.showAlert("Falta fecha de salida.", 'error'); 
        }
        let fechaMaxRegresoAereo = null;
        let aereoRegresoStr = "";
        
        // Buscamos si hay un vuelo con fecha de regreso
        for (let serv of serviciosData) {
            if (serv.tipo === 'aereo' && serv.fecha_regreso) {
                fechaMaxRegresoAereo = new Date(serv.fecha_regreso + 'T00:00:00');
                aereoRegresoStr = formatDateAR(serv.fecha_regreso);
                break; 
            }
        }

        // Si hay un regreso de vuelo, validamos que nadie se quede en destino
        if (fechaMaxRegresoAereo) {
            for (let serv of serviciosData) {
                let endDateStr = null;
                
                // Calculamos el final de hoteles y cruceros
                if ((serv.tipo === 'hotel' || serv.tipo === 'crucero' || serv.tipo === 'circuito') && serv.checkout) {
                    endDateStr = serv.checkout;
                } 
                // Calculamos el final de los buses
                else if (serv.tipo === 'bus' && serv.noches && fechaViajeStr) {
                    const startBus = new Date(fechaViajeStr + 'T00:00:00');
                    startBus.setDate(startBus.getDate() + parseInt(serv.noches));
                    endDateStr = startBus.toISOString().split('T')[0];
                }

                if (endDateStr) {
                    const endDate = new Date(endDateStr + 'T00:00:00');
                    if (endDate > fechaMaxRegresoAereo) {
                        showLoader(false);
                        return window.showAlert(`⛔ Error: El servicio de ${serv.tipo.toUpperCase()} finaliza después de tu regreso en Vuelo (${aereoRegresoStr}). Revisa las fechas.`, 'error');
                    }
                }
            }
        }
        const idGenerado = isEditingId || 'pkg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        let creadorFinal;
        if (isEditingId && originalCreator) { 
            // EDITANDO: Respetamos a muerte al creador original (La franquicia que lo subió)
            creadorFinal = originalCreator; 
        } else { 
            // PAQUETE NUEVO: Usamos la franquicia oficial. Si por algún motivo no tiene, usamos su mail.
            creadorFinal = (userData && userData.franquicia) ? userData.franquicia : currentUser.email; 
        }

        const fechaActual = new Date();
        const dia = String(fechaActual.getDate()).padStart(2, '0');
        const mes = String(fechaActual.getMonth() + 1).padStart(2, '0');
        const anio = fechaActual.getFullYear();
        const fechaCreacionFormateada = `${dia}/${mes}/${anio}`;

        /*
        // === MAGIA: FRANCOTIRADOR MÚLTIPLE DE IMÁGENES EN AÉREOS ===
        let imageUrls = []; 
        const fileInput = dom.containerServicios.querySelector('.upload-captura-aereo');
        
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
            showLoader(true, `Comprimiendo ${fileInput.files.length} captura(s)...`);
            try {
                for(let i=0; i < fileInput.files.length; i++) {
                    const file = fileInput.files[i];
                    const compressedBlob = await comprimirImagen(file, 800, 800, 0.7); 
                    
                    const storageRef = firebase.storage().ref();
                    const imageRef = storageRef.child(`vuelos/${Date.now()}_${i}_${file.name || 'captura.jpg'}`);
                    await imageRef.put(compressedBlob);
                    
                    const url = await imageRef.getDownloadURL();
                    imageUrls.push(url);
                }
                
                // Le inyectamos el ARRAY de URLs al aéreo
                const aereoData = serviciosData.find(s => s.tipo === 'aereo');
                if (aereoData) aereoData.capturas_urls = imageUrls;

            } catch (err) {
                console.error("Error al subir capturas:", err);
                showLoader(false);
                return window.showAlert("Error al procesar las capturas. Intenta sin ellas.", "error");
            }
        }
        */
        const payload = { 
                    id_paquete: idGenerado, 
                    destino: document.getElementById('upload-destino').value, 
                    salida: document.getElementById('upload-salida').value, 
                    fecha_salida: fechaViajeStr, 
                    costos_proveedor: costo, 
                    tarifa: tarifa, 
                    moneda: document.getElementById('upload-moneda').value, 
                    tipo_promo: promoType, 
                    financiacion: document.getElementById('upload-financiacion').value, 
                    servicios: serviciosData, 
                    status: status, 
                    creador: creadorFinal, 
                    editor_email: currentUser.email, 
                    action_type: isEditingId ? 'edit' : 'create',
                    timestamp: Date.now(),
                    fecha_creacion: fechaCreacionFormateada,
                    reflejo_cliente: document.getElementById('chk-reflejo') ? document.getElementById('chk-reflejo').checked : false,
                    cultar_cliente: document.getElementById('chk-ocultar') ? document.getElementById('chk-ocultar').checked : false,
                    base_pasajeros: document.getElementById('paquete-base-pasajeros') ? parseInt(document.getElementById('paquete-base-pasajeros').value) : 2
                };

        // 🧹 FILTRO PROFUNDO: Busca y destruye campos sin nombre o undefined en TODOS los niveles
        const limpiarProfundo = (obj) => {
            if (obj !== null && typeof obj === 'object') {
                Object.keys(obj).forEach(key => {
                    if (key.trim() === "" || obj[key] === undefined) {
                        delete obj[key];
                    } else {
                        limpiarProfundo(obj[key]); // Se mete adentro de las subcarpetas a limpiar
                    }
                });
            }
        };
        limpiarProfundo(payload);
        
       // PASO 1 y 2: Guardamos en la base de datos de FIREBASE
        showLoader(true, "Guardando paquete...");
        try { 
            if (isEditingId) {
                // 🛡️ ESCUDO PROTECTOR: Borramos estos datos del envío para que Firestore NO los sobreescriba jamás
                delete payload.creador;
                delete payload.fecha_creacion;
                
                // EDITAR: Actualizamos el documento existente con el ID de edición
                await db.collection('paquetes').doc(isEditingId).update(payload);
                await window.showAlert(status === 'pending' ? 'Edición enviada a revisión.' : 'Actualizado correctamente.', 'success');
            } else {
                // CREAR NUEVO: Usamos tu idGenerado para nombrar al documento en Firebase
                await db.collection('paquetes').doc(idGenerado).set(payload);
                await window.showAlert(status === 'pending' ? 'Enviado a revisión.' : 'Guardado correctamente.', 'success');
            }
        } catch(e) { 
            window.showAlert("Falla exacta: " + e.message, "error");
            console.error("Fallo el guardado en Firebase:", e);
            showLoader(false);
            return; // Si no hay internet o falla, cortamos todo acá.
        }
    
        
        // PASO 3: Cambio visual de pantallas y recarga de datos
        try {
            dom.uploadForm.reset();
            dom.containerServicios.innerHTML = '';
            
            // 1. Limpiamos cualquier forzado de estilo viejo por las dudas
            dom.views.upload.style.display = '';
            dom.views.search.style.display = '';
            
            // 2. Usamos tu función oficial para que los botones de arriba cambien de color perfecto
            showView('search');
            
            // 3. ¡Magia para el usuario! Llevamos la pantalla arriba de todo suavemente
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            showLoader(true, "Actualizando grilla...");
            
            // Recargamos los paquetes
            if(typeof fetchAndLoadPackages === 'function') await fetchAndLoadPackages(); 
            
            showLoader(false);
        } catch (errorVisual) {
            console.error("🚨 ERROR EN LA PANTALLA:", errorVisual);
            showLoader(false);
        }
    });
   
    function applyFilters() {
        // Normalizador de texto (borra tildes y mayúsculas)
        const normalizeText = (text) => {
            if (!text) return '';
            return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        };

        const fDestino = normalizeText(document.getElementById('filtro-destino').value);
        const fCreador = dom.filtroCreador ? dom.filtroCreador.value : '';
        const fPromo = document.getElementById('filtro-promo').value;
        const fOrden = dom.filtroOrden ? dom.filtroOrden.value : 'reciente';
        const fSalida = dom.filtroSalida ? dom.filtroSalida.value : '';

        // Obtenemos qué promociones son exclusivas de Casa Central
        const promosSecretas = typeof promocionesGlobal !== 'undefined' 
            ? promocionesGlobal.filter(p => p.alcance === 'casa_central').map(p => p.nombre) 
            : [];
        const esAdmin = userData && (userData.rol === 'admin' || userData.rol === 'editor');

        let result = uniquePackages.filter(pkg => {
            const destinoNormalizado = normalizeText(pkg.destino);
            const mDestino = !fDestino || destinoNormalizado.includes(fDestino);
            const mCreador = !fCreador || (pkg.creador && pkg.creador === fCreador);
            const mPromo = !fPromo || (pkg.tipo_promo && pkg.tipo_promo === fPromo);
            const mSalida = !fSalida || (pkg.salida && pkg.salida === fSalida);

            if (!mDestino || !mCreador || !mPromo || !mSalida) return false;

            // 👻 FILTRO DE INVISIBILIDAD: Si es promo secreta y no es admin, ocultar tarjeta
            if (!esAdmin && promosSecretas.includes(pkg.tipo_promo)) return false;

            const isOwner = pkg.editor_email === currentUser.email;
            const isPending = pkg.status === 'pending';
            if (isPending && !isOwner && !esAdmin) return false;
            
            return true;
        });

        if (fOrden === 'reciente') {
            result.sort((a, b) => {
                const getTs = (pkg) => { 
                    if (pkg.timestamp) return pkg.timestamp;
                    if (pkg.id_paquete && pkg.id_paquete.startsWith('pkg_')) return parseInt(pkg.id_paquete.split('_')[1]) || 0; 
                    return 0; 
                };
                return getTs(b) - getTs(a);
            });
        } else if (fOrden === 'menor_precio') result.sort((a, b) => parseFloat(a.tarifa) - parseFloat(b.tarifa));
        else if (fOrden === 'mayor_precio') result.sort((a, b) => parseFloat(b.tarifa) - parseFloat(a.tarifa));

        renderCards(result, dom.grid);
        
        if (esAdmin) {
            const pendientes = uniquePackages.filter(p => p.status === 'pending');
            renderCards(pendientes, dom.gridGestion);
        }
    }

    function renderCards(list, targetGrid = dom.grid) {
        targetGrid.innerHTML = ''; if (!list || list.length === 0) { targetGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;">No hay resultados.</p>'; return; }
        list.forEach(pkg => {
            if (!pkg.destino) return; 
            const card = document.createElement('div'); const noches = getNoches(pkg);
           // --- LÓGICA INTELIGENTE DE SALIDA PARA LA GRILLA ---
            let lugarSalidaGrid = pkg['salida'];
            let sGrid = []; try { sGrid = typeof pkg.servicios === 'string' ? JSON.parse(pkg.servicios) : pkg.servicios; } catch(e){}
            const tieneAereoGrid = Array.isArray(sGrid) && sGrid.some(s => s.tipo === 'aereo');
            
           // Lógica de Múltiples salidas para Circuitos (EL AÉREO MANDA)
            const esCircuitoGrid = Array.isArray(sGrid) && sGrid.some(s => s.tipo === 'circuito');
            const fechaMostrar = (!pkg['fecha_salida'] && esCircuitoGrid && !tieneAereoGrid) ? 'Múltiples Salidas' : formatDateAR(pkg['fecha_salida']);
            if (!tieneAereoGrid) {
                const crucero = Array.isArray(sGrid) && sGrid.find(s => s.tipo === 'crucero');
                const circuito = Array.isArray(sGrid) && sGrid.find(s => s.tipo === 'circuito');
                if (crucero && crucero.crucero_puerto_salida) {
                    lugarSalidaGrid = crucero.crucero_puerto_salida;
                } else if (circuito && circuito.circuito_salida) {
                    lugarSalidaGrid = circuito.circuito_salida;
                }
            }
            card.className = 'paquete-card'; const tarifaMostrar = parseFloat(pkg['tarifa']) || 0; const summaryIcons = getSummaryIcons(pkg); 
            const bubbleStyle = `background-color:#56DDE0;color:#11173d;padding:4px 12px;border-radius:20px;font-weight:600;font-size:0.75em;display:inline-block;box-shadow:0 2px 4px rgba(0,0,0,0.05);`; 
            let statusTag = ''; if (pkg.status === 'pending') statusTag = `<span style="background-color:#ffeaa7; color:#d35400; padding:2px 8px; border-radius:10px; font-size:0.7em; margin-left:5px;">⏳ En Revisión</span>`;

            card.innerHTML = `
                <div class="card-clickable">
                    <div class="card-header">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%;">
                            <div style="max-width:75%; padding-right:30px;">
                                <h3 style="margin:0;font-size:1.5em;line-height:1.2;color:#11173d;">${pkg['destino']} ${statusTag}</h3>
                            </div>
                            ${noches > 0 ? `<div style="background:#eef2f5;color:#11173d;padding:5px 10px;border-radius:12px;font-weight:bold;font-size:0.8em;white-space:nowrap;">🌙 ${noches}</div>` : ''}
                        </div>
                        <div class="fecha">📅 Salida: ${fechaMostrar}</div>
                    </div>
                    
                    <div class="card-body">
                        <div style="font-size:0.85em;color:#555;display:flex;flex-wrap:wrap;line-height:1.4;">${summaryIcons}</div>
                    </div>
                    
                    <div class="card-footer" style="display:flex; justify-content:space-between; align-items:flex-end;">
                        <div><span style="${bubbleStyle}">${pkg['tipo_promo']}</span></div>
                        
                        <div style="text-align: right;">
                            <div style="font-size: 0.85em; color: #666; font-weight: 500; margin-bottom: -5px;">Desde ${lugarSalidaGrid}</div>
                            
                            <p class="precio-valor" style="margin: 5px 0 0 0;">
                                ${pkg['moneda']} $${formatMoney(Math.round(tarifaMostrar / (parseInt(pkg.base_pasajeros) === 4 ? 4 : 2)))}
                            </p>
                        </div>
                    </div>
                </div>`;
            
            targetGrid.appendChild(card); 
            card.querySelector('.card-clickable').addEventListener('click', () => openModal(pkg));
        });
    }

    // GESTION MODAL
    window.deletePackage = async (pkg) => { 
        if (!await window.showConfirm("⚠️ ¿Eliminar este paquete para siempre?")) return; 
        
        showLoader(true, "Eliminando paquete..."); 
        try { 
            const id = pkg.id_paquete || pkg.id || pkg['item.id']; 
            
            // FIREBASE: Borramos el documento físicamente de la base de datos
            await db.collection('paquetes').doc(id).delete(); 
            
            await window.showAlert("Paquete eliminado correctamente.", "success"); 
            
            // Cerramos el modal si estaba abierto
            if(dom.modal) dom.modal.style.display = 'none';
            
            // UX MÁGICA: Recargamos la grilla suavecito sin reiniciar la página
            if(typeof fetchAndLoadPackages === 'function') await fetchAndLoadPackages(); 

        } catch (e) { 
            console.error("Error al borrar en Firebase:", e);
            window.showAlert("Error al eliminar.", "error"); 
        } 
        showLoader(false);
    };
window.approvePackage = async (pkg) => { 
        if (!await window.showConfirm("¿Aprobar publicación en FEED?")) return; 
        
        showLoader(true, "Aprobando..."); 
        try { 
            const id = pkg.id_paquete || pkg.id || pkg['item.id'];
            
            // FIREBASE: Solo actualizamos el campo 'status', súper eficiente
            await db.collection('paquetes').doc(id).update({
                status: 'approved'
            }); 
            
            await window.showAlert("Paquete Aprobado y publicado.", "success"); 
            
            if(dom.modal) dom.modal.style.display = 'none';
            
            // UX: Recargamos la grilla sin F5
            if(typeof fetchAndLoadPackages === 'function') await fetchAndLoadPackages(); 

        } catch(e) { 
            console.error("Error al aprobar en Firebase:", e);
            window.showAlert("Error al aprobar.", "error"); 
        } 
        showLoader(false);
    };    

    window.startEditing = async (pkg) => { 
        if (!await window.showConfirm("Se abrirá el formulario de edición.")) return; 
        
        isEditingId = pkg.id_paquete || pkg.id || pkg['item.id']; 
        originalCreator = pkg.creador || ''; 
        
        document.getElementById('upload-destino').value = pkg.destino; 
        document.getElementById('upload-salida').value = pkg.salida; 
        
        let fecha = pkg.fecha_salida; 
        if(fecha && fecha.includes('/')) fecha = fecha.split('/').reverse().join('-'); 
        dom.inputFechaViaje.value = fecha; 
        
        document.getElementById('upload-moneda').value = pkg.moneda; 
        document.getElementById('upload-promo').value = pkg.tipo_promo; 
        document.getElementById('upload-financiacion').value = pkg.financiacion || ''; 
        document.getElementById('upload-tarifa-total').value = pkg.tarifa; 
        if(document.getElementById('paquete-base-pasajeros')) {
            window.setTogglePasajerosVisually(pkg.base_pasajeros || '2');
        }

        // --- NUEVO: Cargar estado de los checkboxes al editar ---
        if(document.getElementById('chk-reflejo')) {
            document.getElementById('chk-reflejo').checked = pkg.reflejo_cliente || false;
        }
        if(document.getElementById('chk-ocultar')) {
            document.getElementById('chk-ocultar').checked = pkg.ocultar_cliente || false;
        }
        
        dom.containerServicios.innerHTML = ''; 
        let servicios = []; 
        try { 
            const raw = pkg['servicios'] || pkg['item.servicios']; 
            servicios = typeof raw === 'string' ? JSON.parse(raw) : raw; 
        } catch(e) {} 
        
        if (Array.isArray(servicios)) { 
            servicios.forEach(s => agregarModuloServicio(s.tipo, s)); 
        } 
        
        window.calcularTotal(); 
        dom.modal.style.display = 'none'; 
        showView('upload'); 
        window.scrollTo(0,0); 
        window.showAlert("Modo Edición Activado.", "info"); 
    };

    function openModal(pkg) {
        window.currentModalPackage = pkg;
        if (typeof renderServiciosClienteHTML !== 'function') return alert("Error interno.");
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
        const htmlCostos = renderCostosProveedoresHTML(rawServicios); 
        const noches = getNoches(pkg); 
        const tarifa = parseFloat(pkg['tarifa']) || 0; 
        
        // 👉 LÓGICA DINÁMICA: Detecta el divisor y el texto
        const divisor = parseInt(pkg.base_pasajeros) === 4 ? 4 : 2;
        const tarifaPorPersona = Math.round(tarifa / divisor);
        const textoBase = divisor === 4 ? 'Base Cuádruple' : 'Base Doble'; 
        const bubbleStyle = `background-color: #56DDE0; color: #11173d; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 0.8em; display: inline-block; margin-top: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);`; 
        let adminTools = ''; 
        const isOwner = pkg.editor_email === currentUser.email; 
        const canEdit = userData.rol === 'admin' || userData.rol === 'editor' || (userData.rol === 'usuario' && pkg.status === 'pending' && isOwner);
        
        if (canEdit) { 
            const btnApprove = (userData.rol === 'admin' || userData.rol === 'editor') && pkg.status === 'pending' ? `<button class="btn btn-primario" onclick="approvePackage(currentModalPackage)" style="padding:5px 15px; font-size:0.8em; background:#2ecc71;">✅ Aprobar</button>` : ''; 
            
            // --- NUEVO: Herramientas de Visibilidad B2C (Solo Jefes) ---
            let visibilidadTools = '';
            if (userData.rol === 'admin' || userData.rol === 'editor') {
                const isAnclado = pkg.reflejo_cliente === true;
                const isOculto = pkg.ocultar_cliente === true;
                const pkgId = pkg.id_paquete || pkg.id || pkg['item.id'];
                
                // Botones de control rápido (Anclar y Ocultar)
                const btnAnclar = `<button title="Anclar a B2C (Ignora corte 12hs)" onclick="window.toggleVisibilidad('${pkgId}', 'reflejo_cliente', ${isAnclado})" style="padding:4px 12px; font-size:0.9em; font-weight:bold; border-radius:6px; cursor:pointer; border: 1px solid ${isAnclado ? '#1e8e3e' : '#555'}; background: ${isAnclado ? '#e6f4ea' : 'transparent'}; color: ${isAnclado ? '#1e8e3e' : '#ccc'}; transition: 0.2s;">✅ Anclar</button>`;
                
                const btnOcultar = `<button title="Ocultar en B2C " onclick="window.toggleVisibilidad('${pkgId}', 'ocultar_cliente', ${isOculto})" style="padding:4px 12px; font-size:0.9em; font-weight:bold; border-radius:6px; cursor:pointer; border: 1px solid ${isOculto ? '#d93025' : '#555'}; background: ${isOculto ? '#fce8e6' : 'transparent'}; color: ${isOculto ? '#d93025' : '#ccc'}; transition: 0.2s;">❌ Ocultar</button>`;
                
                visibilidadTools = `<div style="display:flex; gap:8px; margin-top: 8px;">${btnAnclar}${btnOcultar}</div>`;
            }

            // --- ESTRUCTURA FINAL DE LA BOTONERA APILADA ---
            adminTools = `
            <div class="modal-tools" style="position: absolute; top: 15px; right: 50px; display:flex; flex-direction:column; align-items:flex-end;">
                <div style="display:flex; gap:10px;">
                    ${btnApprove}
                    <button class="btn btn-secundario" onclick="startEditing(currentModalPackage)" style="padding:5px 15px; font-size:0.8em;">✏️ Editar</button>
                    <button class="btn btn-secundario" onclick="deletePackage(currentModalPackage)" style="padding:5px 15px; font-size:0.8em; background:#e74c3c; color:white;">🗑️ Borrar</button>
                </div>
                ${visibilidadTools}
            </div>`; 
        }

        const btnCopiar = `<button class="btn" onclick='copiarPresupuesto(currentModalPackage)' style="background:#34495e; color:white; padding: 5px 15px; font-size:0.8em; display:flex; align-items:center; gap:5px;">📋 Copiar</button>`;

        dom.modalBody.innerHTML = `
            ${adminTools}
            <div class="modal-detalle-header" style="display:block; padding-bottom: 25px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <h2 style="margin:0;font-size:2.2em;line-height:1.1;">${pkg['destino']}</h2>
                </div>
                <div style="margin-top:5px;"><span style="${bubbleStyle}">${pkg['tipo_promo']}</span></div>
            </div>

            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; padding: 20px;">
                <div>
                    <h3 style="border-bottom:2px solid #eee; padding-bottom:10px; margin-top:0; color:#11173d;">Itinerario</h3>
                    ${htmlCliente}
                </div>
                <div style="background:#f9fbfd; padding:15px; border-radius:8px; height:fit-content;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
                        <h4 style="margin:0; color:#11173d;">Resumen</h4>
                        ${btnCopiar}
                    </div>
                    <p style="margin:5px 0; font-size:0.9em;"><b>📅 Salida:</b> ${fechaModal}</p>
                    <p style="margin:5px 0; font-size:0.9em;"><b>📍 Desde:</b> ${lugarSalidaModal}</p>
                    <p style="margin:5px 0; font-size:0.9em;"><b>🌙 Duración:</b> ${noches > 0 ? noches + ' Noches' : '-'}</p>
                    <p style="margin:5px 0; font-size:0.9em;"><b>📅 Cargado el:</b> ${pkg['fecha_creacion'] || '-'}</p>
                    
                    <div>
                        <h4 style="margin:20px 0 10px 0; color:#11173d; border-top:1px solid #eee; padding-top:15px;">Costos (Interno)</h4>
                        ${htmlCostos}
                    </div>
                    ${pkg['financiacion'] ? `<div style="margin-top:15px; background:#e3f2fd; padding:10px; border-radius:5px; font-size:0.85em;"><b>💳 Financiación:</b> ${pkg['financiacion']}</div>` : ''}
                </div>
            </div>
            
            <div style="background:#11173d; color:white; padding:15px 20px; display:flex; justify-content:space-between; align-items:center; border-radius:0 0 12px 12px;">
                <div style="display:flex; gap:30px;">
                    <div><small style="opacity:0.7;">Costo Total</small><div style="font-size:1.2em; font-weight:bold;">${pkg['moneda']} $${formatMoney(pkg['costos_proveedor'])}</div></div>
                    <div><small style="opacity:0.7;">Tarifa Final</small><div style="font-size:1.2em; font-weight:bold; color:#ef5a1a;">${pkg['moneda']} $${formatMoney(tarifa)}</div></div>
                    <div><small style="opacity:0.7;">x Persona (${textoBase})</small><div style="font-size:1.2em; font-weight:bold; color:#4caf50;">${pkg['moneda']} $${formatMoney(tarifaPorPersona)}</div></div>
                </div>
                <div style="text-align:right;"><small style="opacity:0.7;">Cargado por:</small><div style="font-size:0.9em;">${pkg['creador']}</div></div>
            </div>`;
    
        dom.modal.style.display = 'flex';
    }

    function showView(n) {
        // Protección para vistas: Si alguna es null, la ignoramos
        Object.values(dom.views).forEach(v => { 
            if (v) v.classList.remove('active'); 
        });
    
        // Protección para botones: Si (como 'gestion') es null, no hacemos nada y no da error
        Object.values(dom.nav).forEach(b => { 
            if (b) b.classList.remove('active'); 
        });
    
        // Activamos la vista y el botón solo si existen realmente
        if (dom.views[n]) dom.views[n].classList.add('active');
        if (dom.nav[n]) dom.nav[n].classList.add('active');
    }
    if (dom.nav.search) dom.nav.search.onclick = () => showView('search');
    
    if (dom.nav.upload) {
        dom.nav.upload.onclick = () => { 
            isEditingId = null; originalCreator = ''; document.getElementById('upload-form').reset(); dom.containerServicios.innerHTML=''; showView('upload'); 
        };
    }
    
    if (dom.nav.gestion) {
        dom.nav.gestion.onclick = async () => { 
            if(typeof fetchAndLoadPackages === 'function') await fetchAndLoadPackages(); 
            showView('gestion'); 
        };
    }
    
    // Le ponemos un escudo por si el botón users no existe arriba
    if (dom.nav.users) {
        dom.nav.users.onclick = async () => { await loadUsersList(); showView('users'); };
    }
    // ==========================================
    // CONECTAMOS EL CALENDARIO AL SISTEMA NATIVO
    // ==========================================
    dom.views.marketing = document.getElementById('view-marketing');
    dom.nav.marketing = document.getElementById('nav-marketing');
    dom.nav.marketing.onclick = () => { 
        showView('marketing'); 
        if (typeof window.renderizarCalendario === 'function') window.renderizarCalendario(); 
    };
    // ==========================================
    dom.modalClose.onclick = () => dom.modal.style.display = 'none';
    window.onclick = e => { if(e.target === dom.modal) dom.modal.style.display='none'; };
    dom.btnBuscar.addEventListener('click', applyFilters);
    dom.btnLimpiar.addEventListener('click', () => { document.getElementById('filtro-destino').value=''; if(dom.filtroCreador) dom.filtroCreador.value=''; document.getElementById('filtro-promo').value=''; if(dom.filtroOrden) dom.filtroOrden.value='reciente'; applyFilters(); });
    if(dom.filtroOrden) dom.filtroOrden.addEventListener('change', applyFilters);
    if(dom.filtroCreador) dom.filtroCreador.addEventListener('change', applyFilters);

    // 14. LOGICA CALENDARIO SEMANAL
    
    // Toggle Desplegable
    if(domPlanner.header) {
        domPlanner.header.addEventListener('click', () => {
            domPlanner.header.classList.toggle('open');
            domPlanner.body.classList.toggle('open');
        });
    }

    const diasSemana = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

    // Inicializar Calendario
    async function initWeeklyPlanner() {
        if(domPlanner.container) {
            domPlanner.container.style.display = 'block';
            domPlanner.header.classList.add('open');
            domPlanner.body.classList.add('open');
            highlightCurrentDay();
            await loadPlanningData();
        }

        const isStaff = userData && (userData.rol === 'admin' || userData.rol === 'editor');

        diasSemana.forEach(dia => {
            const readDiv = document.getElementById(`read-${dia}`);
            const editDiv = document.getElementById(`edit-${dia}`);
            if(readDiv && editDiv) {
                if (isStaff) {
                    // Los administradores ven el formulario de carga
                    readDiv.style.display = 'none';
                    editDiv.style.display = 'flex';
                } else {
                    // Los vendedores ven la lista bonita y limpia
                    editDiv.style.display = 'none';
                    readDiv.style.display = 'flex';
                }
            }
        });

        if(domPlanner.btnSave) domPlanner.btnSave.style.display = isStaff ? 'inline-block' : 'none';
    }

    function highlightCurrentDay() {
        for (let i = 1; i <= 5; i++) {
            const card = document.getElementById(`day-card-${i}`);
            if (card) card.classList.remove('today');
        }
        const today = new Date();
        const dayIndex = today.getDay(); 
        if (dayIndex >= 1 && dayIndex <= 5) {
            const card = document.getElementById(`day-card-${dayIndex}`);
            if (card) {
                card.classList.add('today');
                const span = document.getElementById(`date-${dayIndex}`);
                if(span) span.innerText = `${today.getDate()}/${today.getMonth()+1}`;
            }
        }
    }

    async function loadPlanningData() {
        try {
            const doc = await db.collection('config').doc('planning_weekly').get();
            if (doc.exists) {
                const data = doc.data();
                
                diasSemana.forEach(dia => {
                    let dayData = data[dia] || {};
                    
                    // 🛡️ REGLA DE COMPATIBILIDAD: Si es texto viejo, lo convertimos a observaciones
                    if (typeof dayData === 'string') {
                        dayData = { obs: dayData }; 
                    }

                    // 1. Llenar los inputs (Para los Administradores)
                    if(document.getElementById(`plan-dest-${dia}`)) document.getElementById(`plan-dest-${dia}`).value = dayData.destino || '';
                    if(document.getElementById(`plan-reg-${dia}`)) document.getElementById(`plan-reg-${dia}`).value = dayData.regimen || '';
                    if(document.getElementById(`plan-trf-${dia}`)) document.getElementById(`plan-trf-${dia}`).value = dayData.traslados || '';
                    if(document.getElementById(`plan-dias-${dia}`)) document.getElementById(`plan-dias-${dia}`).value = dayData.dias || '';
                    if(document.getElementById(`plan-precio-${dia}`)) document.getElementById(`plan-precio-${dia}`).value = dayData.precio || '';
                    if(document.getElementById(`plan-recom-${dia}`)) document.getElementById(`plan-recom-${dia}`).value = dayData.recom || ''; // NUEVO CAMPO
                    if(document.getElementById(`plan-obs-${dia}`)) document.getElementById(`plan-obs-${dia}`).value = dayData.obs || '';

                    // 2. Armar el HTML limpio (Para los Vendedores)
                    const readDiv = document.getElementById(`read-${dia}`);
                    if(readDiv) {
                        let html = '';
                        if(dayData.destino) html += `<div><span style="color:#ef5a1a; font-weight:bold; font-size: 1.1em;">📍 ${dayData.destino}</span></div>`;
                        if(dayData.regimen) html += `<div><b>🍽️ Régimen:</b> ${dayData.regimen}</div>`;
                        if(dayData.traslados) html += `<div><b>🚕 Traslados:</b> ${dayData.traslados}</div>`;
                        if(dayData.dias) html += `<div><b>🌙 Días:</b> ${dayData.dias}</div>`;
                        if(dayData.precio) html += `<div><b>💰 Precio Ideal:</b> ${dayData.precio}</div>`;
                        if(dayData.recom) html += `<div><b style="color:#3498db;">💡 Cotizar en:</b> ${dayData.recom}</div>`; // NUEVO CAMPO
                        if(dayData.obs) html += `<div style="margin-top:6px; padding-top:6px; border-top:1px dashed #e5e7eb; color:#555;"><i>📝 ${dayData.obs}</i></div>`;
                        
                        if(!html) html = '<div style="color:#999; text-align:center; margin-top:20px;">Sin pedidos para hoy</div>';
                        readDiv.innerHTML = html;
                    }
                });
            }
        } catch (e) {
            console.error("Error cargando planner:", e);
        }
    }

    if(domPlanner.btnSave) {
        domPlanner.btnSave.addEventListener('click', async () => {
            showLoader(true, "Guardando agenda...");
            try {
                const payload = {
                    last_update: new Date(),
                    updated_by: currentUser.email
                };

                diasSemana.forEach(dia => {
                    // Armamos el objeto de cada día recopilando sus 7 campos
                    payload[dia] = {
                        destino: document.getElementById(`plan-dest-${dia}`) ? document.getElementById(`plan-dest-${dia}`).value.trim() : '',
                        regimen: document.getElementById(`plan-reg-${dia}`) ? document.getElementById(`plan-reg-${dia}`).value.trim() : '',
                        traslados: document.getElementById(`plan-trf-${dia}`) ? document.getElementById(`plan-trf-${dia}`).value.trim() : '',
                        dias: document.getElementById(`plan-dias-${dia}`) ? document.getElementById(`plan-dias-${dia}`).value.trim() : '',
                        precio: document.getElementById(`plan-precio-${dia}`) ? document.getElementById(`plan-precio-${dia}`).value.trim() : '',
                        recom: document.getElementById(`plan-recom-${dia}`) ? document.getElementById(`plan-recom-${dia}`).value.trim() : '', // NUEVO CAMPO
                        obs: document.getElementById(`plan-obs-${dia}`) ? document.getElementById(`plan-obs-${dia}`).value.trim() : ''
                    };
                });

                await db.collection('config').doc('planning_weekly').set(payload, { merge: true });
                await window.showAlert("✅ Planificación detallada actualizada.", "success");
                
                // Refrescamos visualmente al guardar
                await loadPlanningData();
            } catch (e) {
                console.error(e);
                window.showAlert("Error al guardar planificación.", "error");
            }
            showLoader(false);
        });
    }

    // 1. Activar el filtro cuando cambien la opción de salida
    if(dom.filtroSalida) dom.filtroSalida.addEventListener('change', applyFilters);

    // 2. Modificar el botón limpiar para que también borre la salida
    dom.btnLimpiar.addEventListener('click', () => {
        document.getElementById('filtro-destino').value='';
        if(dom.filtroCreador) dom.filtroCreador.value='';
        document.getElementById('filtro-promo').value='';
        if(dom.filtroOrden) dom.filtroOrden.value='reciente';
        
        // NUEVO: Limpiar también el selector de salida
        if(dom.filtroSalida) dom.filtroSalida.value = '';
        
        applyFilters();
    });
    async function autoCleanupPackages(packages) {
        // Solo el administrador ejecuta la limpieza para no saturar la base de datos
        if (!userData || (userData.rol !== 'admin')) return;

        const hoyString = new Date().toISOString().split('T')[0];
        const ultimoChequeo = localStorage.getItem('ultimo_mantenimiento');
        if (ultimoChequeo === hoyString) return; 

        console.log("🧹 Iniciando mantenimiento general...");
        const now = new Date();
        now.setHours(0, 0, 0, 0); 

        // --- 1. LIMPIEZA DE PAQUETES (Reglas anteriores) ---
        const candidatosPaquetes = packages.filter(pkg => {
            
            // 👇 ACÁ ESTÁ EL LUGAR CORRECTO PARA LA PROTECCIÓN 👇
            // Si está anclado a la web de clientes (B2C), jamás lo borramos
            if (pkg.reflejo_cliente) return false; 
            
            if (pkg.fecha_salida) {
                const fechaSalida = new Date(pkg.fecha_salida + 'T00:00:00');
                if (fechaSalida <= now) return true; // Ya pasó la fecha de viaje
            }
            
            if (!pkg.fecha_creacion || !pkg.tipo_promo) return false;
            
            const parts = pkg.fecha_creacion.split('/');
            if (parts.length === 3) {
                const fechaPkg = new Date(parts[2], parts[1] - 1, parts[0]);
                const diffDays = Math.ceil((now - fechaPkg) / (1000 * 60 * 60 * 24)); 
                
                // Vencimientos por tiempo
                if (pkg.tipo_promo === 'Solo X Hoy' && diffDays > 7) return true;
                if (pkg.tipo_promo !== 'Solo X Hoy' && diffDays > 30) return true;
            }
            return false;
        });

        // Borrado físico de los paquetes caducados
        for (const pkg of candidatosPaquetes) {
            await db.collection('paquetes').doc(pkg.id_paquete || pkg.id).delete();
        }

        // --- 2. LIMPIEZA DE CALENDARIO DE MARKETING (60 días) ---
        console.log("📅 Limpiando tareas de marketing viejas...");
        try {
            const limiteMkt = new Date();
            limiteMkt.setDate(limiteMkt.getDate() - 60); // 60 días hacia atrás (2 meses)
            
            const snapMkt = await db.collection('calendario_marketing').get();
            let borradosMkt = 0;
            
            snapMkt.forEach(async (doc) => {
                const tarea = doc.data();
                if (tarea.fecha) {
                    const fechaTarea = new Date(tarea.fecha + 'T00:00:00');
                    if (fechaTarea < limiteMkt) {
                        await doc.ref.delete();
                        borradosMkt++;
                    }
                }
            });
            if(borradosMkt > 0) console.log(`✅ Se eliminaron ${borradosMkt} tareas antiguas de marketing.`);
        } catch(e) { console.error("Error limpieza Mkt:", e); }

        // Marcamos que ya se hizo el mantenimiento de hoy
        localStorage.setItem('ultimo_mantenimiento', hoyString);
        console.log("🏆 Mantenimiento total completado.");
        
        if (candidatosPaquetes.length > 0 && typeof fetchAndLoadPackages === 'function') {
            await fetchAndLoadPackages();
        }
    }
// ==========================================
// MÓDULO CALCULADORA DINÁMICA Y ADMIN (V3)
// ==========================================

// 1. EL NUEVO MODELO DE DATOS UNIVERSAL
var dbCalculadora = [];
var servicioEditandoId = null;

// Valores por defecto (Semilla) si Firebase está vacío
const defaultData = [
    { id: 'vuelo_nac', nombre: '✈️ Vuelo Nacional', proveedores: [ { nombre: 'Hoteldo', tasa: 11.7, tipo: 'markup' }, { nombre: 'Ola', tasa: 11.7, tipo: 'markup' } ] },
    { id: 'vuelo_int', nombre: '✈️ Vuelo Internacional', proveedores: [ { nombre: 'Hoteldo', tasa: 9.7, tipo: 'markup' } ] },
    { id: 'hoteles', nombre: '🏨 Alojamiento', proveedores: [ { nombre: 'Feliz Viaje', tasa: 18.5, tipo: 'markup' } ] },
    { id: 'autos', nombre: '🚗 Autos', proveedores: [ { nombre: 'BookingCars', tasa: 12, tipo: 'descuento' }, { nombre: 'Hoteldo', tasa: 18.5, tipo: 'markup' } ] }
];

// Carga inicial
async function loadCalculadoraConfig() {
    try {
        const doc = await db.collection('config').doc('calculadora_v3').get();
        if (doc.exists) {
            dbCalculadora = doc.data().servicios || [];
        } else {
            dbCalculadora = defaultData;
            await db.collection('config').doc('calculadora_v3').set({ servicios: dbCalculadora });
        }
        if (typeof actualizarSelectServiciosVentas === 'function') {
            actualizarSelectServiciosVentas();
        }
    } catch (e) {
        console.error("Error cargando calculadora:", e);
    }
}

// 2. MOTOR MATEMÁTICO UNIVERSAL
function calcularVentaAgencia(montoBase, provData) {
    let final = parseFloat(montoBase);
    let base = parseFloat(montoBase);
    let profit = 0;
    let profitRate = parseFloat(provData.tasa) / 100;

    if (provData.tipo === 'descuento') {
        // Lógica BookingCars: El monto ingresado es el Final, la ganancia se resta de ahí.
        base = final * (1 - profitRate);
        profit = final - base;
    } else {
        // Lógica Normal (Markup): El monto ingresado es la Base, se le suma la ganancia.
        profit = base * profitRate;
        final = base + profit;
    }
    return { base, profit, final, profitRate };
}

// 3. LÓGICA DE LA INTERFAZ VISUAL (Ventas)
const btnToggle = document.getElementById('btn-toggle-calculadora');
const panelCalc = document.getElementById('panel-calculadora');
const bodyCalc = document.getElementById('body-calculadora');
const btnClose = document.getElementById('btn-close-calculadora');
const btnMin = document.getElementById('btn-min-calculadora');
const btnMax = document.getElementById('btn-max-calculadora');
const selectServicio = document.getElementById('calc-servicio');
const selectProveedor = document.getElementById('calc-proveedor');
const selectMoneda = document.getElementById('calc-moneda');
const inputMonto = document.getElementById('calc-monto');
const btnCalcular = document.getElementById('btn-calcular-ya');
const boxResultados = document.getElementById('calc-resultados');
const btnCalcCopiar = document.getElementById('btn-calc-copiar');
const btnCalcNueva = document.getElementById('btn-calc-nueva');
const calcBackdrop = document.getElementById('calc-backdrop');

if (btnToggle && panelCalc) {
    let isMaximized = false;

    btnToggle.addEventListener('click', () => {
        panelCalc.style.display = panelCalc.style.display === 'none' || panelCalc.style.display === '' ? 'flex' : 'none';
        bodyCalc.style.display = 'block';
    });

    btnClose.addEventListener('click', () => { 
        panelCalc.style.display = 'none'; 
        if(calcBackdrop) calcBackdrop.style.display = 'none';
        if(btnCalcNueva) btnCalcNueva.click(); 
        if (isMaximized) btnMax.click(); 
    });
    
    btnMin.addEventListener('click', () => { bodyCalc.style.display = bodyCalc.style.display === 'none' ? 'block' : 'none'; });
    
    // RESPONSIVIDAD: Tamaño cómodo y centrado
    btnMax.addEventListener('click', () => {
        isMaximized = !isMaximized;
        if (isMaximized) {
            // Tamaño centrado y prolijo
            panelCalc.style.width = '600px'; 
            panelCalc.style.height = 'auto'; 
            panelCalc.style.maxHeight = '80vh';
            panelCalc.style.top = '50%'; 
            panelCalc.style.left = '50%'; 
            panelCalc.style.bottom = 'auto'; 
            panelCalc.style.right = 'auto';
            panelCalc.style.transform = 'translate(-50%, -50%)'; 
            btnMax.innerText = '❐';
            if(calcBackdrop) calcBackdrop.style.display = 'block'; // Prende el fondo oscuro
        } else {
            // Vuelve a su lugar flotante
            panelCalc.style.width = '350px'; 
            panelCalc.style.height = 'auto'; 
            panelCalc.style.maxHeight = 'calc(100vh - 120px)';
            panelCalc.style.top = 'auto'; 
            panelCalc.style.left = 'auto'; 
            panelCalc.style.bottom = '100px'; 
            panelCalc.style.right = '30px';
            panelCalc.style.transform = 'none'; 
            btnMax.innerText = '⬜';
            if(calcBackdrop) calcBackdrop.style.display = 'none'; // Apaga el fondo oscuro
        }
    });

    // Llenar el primer select de Ventas
    // --- ESTADO DEL MODO PAQUETE ---
    let modoCalculadora = 'individual';
    let carritoPaquete = [];

    const btnModoIndiv = document.getElementById('btn-modo-indiv');
    const btnModoPaq = document.getElementById('btn-modo-paq');
    const boxPaquete = document.getElementById('calc-paquete-container');
    const listaPaquete = document.getElementById('calc-lista-paquete');

    // Cambiar a Individual
    if(btnModoIndiv) btnModoIndiv.addEventListener('click', () => {
        modoCalculadora = 'individual';
        btnModoIndiv.style.background = 'white'; btnModoIndiv.style.color = '#11173d'; btnModoIndiv.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        btnModoPaq.style.background = 'transparent'; btnModoPaq.style.color = '#6b7280'; btnModoPaq.style.boxShadow = 'none';
        btnCalcular.innerText = 'Calcular Venta';
        boxPaquete.style.display = 'none';
        if(inputMonto.value !== '') boxResultados.style.display = 'block';
    });

    // Cambiar a Paquete
    if(btnModoPaq) btnModoPaq.addEventListener('click', () => {
        modoCalculadora = 'paquete';
        btnModoPaq.style.background = 'white'; btnModoPaq.style.color = '#11173d'; btnModoPaq.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        btnModoIndiv.style.background = 'transparent'; btnModoIndiv.style.color = '#6b7280'; btnModoIndiv.style.boxShadow = 'none';
        btnCalcular.innerText = '➕ Agregar al Paquete';
        boxResultados.style.display = 'none';
        boxPaquete.style.display = 'flex';
        renderizarCarritoPaquete();
    });

    window.actualizarSelectServiciosVentas = () => {
        if(!selectServicio) return;
        selectServicio.innerHTML = '<option value="">Seleccionar Servicio...</option>';
        dbCalculadora.forEach(s => { selectServicio.innerHTML += `<option value="${s.id}">${s.nombre}</option>`; });
    };

    selectServicio.addEventListener('change', (e) => {
        const servId = e.target.value;
        selectProveedor.innerHTML = '<option value="">Seleccionar Proveedor...</option>';
        if (modoCalculadora === 'individual') boxResultados.style.display = 'none';
        const srv = dbCalculadora.find(s => s.id === servId);
        if (srv && srv.proveedores) {
            srv.proveedores.forEach(p => { selectProveedor.innerHTML += `<option value="${p.nombre}">${p.nombre}</option>`; });
        }
    });

    btnCalcular.addEventListener('click', () => {
        const servId = selectServicio.value;
        const provName = selectProveedor.value;
        const monto = parseFloat(inputMonto.value);
        const moneda = selectMoneda.value;

        if (!servId || !provName || isNaN(monto)) return window.showAlert("Completá servicio, proveedor y monto.", "error");

        const srv = dbCalculadora.find(s => s.id === servId);
        // Hacemos una COPIA de los datos del proveedor para no arruinar la base original
        let provData = JSON.parse(JSON.stringify(srv.proveedores.find(p => p.nombre === provName)));
        
        // 🚨 LÓGICA ESTRICTA DE PAQUETE: Forzamos el 18.5% si es markup
        if (modoCalculadora === 'paquete' && provData.tipo === 'markup') {
            provData.tasa = 18.5; 
        }

        const resultado = calcularVentaAgencia(monto, provData);
        const formatter = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        if (modoCalculadora === 'individual') {
            document.getElementById('res-rentabilidad').innerText = `${moneda}${formatter.format(resultado.profit)} (${(resultado.profitRate * 100).toFixed(1)}%)`;
            document.getElementById('res-total').innerText = `${moneda}${formatter.format(resultado.final)}`;
            boxResultados.style.display = 'block';
            setTimeout(() => { bodyCalc.scrollTo({ top: bodyCalc.scrollHeight, behavior: 'smooth' }); }, 50);
        } else {
            // MODO PAQUETE: Inyectamos al carrito
            carritoPaquete.push({
                id: Date.now(), // ID único para el botón borrar/pausar
                servicioNombre: srv.nombre,
                provNombre: provName,
                moneda: moneda,
                base: resultado.base,
                profit: resultado.profit,
                final: resultado.final,
                activo: true // Para la pausa
            });
            inputMonto.value = ''; // Limpiamos para que cargue el siguiente rápido
            renderizarCarritoPaquete();
            setTimeout(() => { bodyCalc.scrollTo({ top: bodyCalc.scrollHeight, behavior: 'smooth' }); }, 50);
        }
    });

    window.renderizarCarritoPaquete = () => {
        if (!listaPaquete) return;
        listaPaquete.innerHTML = '';
        let totalBase = 0; let totalProfit = 0; let totalFinal = 0; let ultimaMoneda = 'USD ';

        if (carritoPaquete.length === 0) {
            listaPaquete.innerHTML = '<div style="color: #999; font-size: 0.85em; text-align: center; padding: 10px;">El paquete está vacío.</div>';
        } else {
            carritoPaquete.forEach(item => {
                if (item.activo) {
                    totalBase += item.base; totalProfit += item.profit; totalFinal += item.final;
                }
                ultimaMoneda = item.moneda; // Mantiene el USD o el ARS
                const formatter = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                const opacity = item.activo ? '1' : '0.5';
                const bg = item.activo ? '#eefaf6' : '#f3f4f6';
                const colorTexto = item.activo ? '#11173d' : '#9ca3af';
                const btnPauseColor = item.activo ? '#f39c12' : '#9ca3af';

                listaPaquete.innerHTML += `
                    <div style="background: ${bg}; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center; opacity: ${opacity}; transition: 0.2s;">
                        <div style="flex: 1;">
                            <div style="font-weight: bold; color: ${colorTexto}; font-size: 0.9em; margin-bottom: 2px;">${item.servicioNombre}</div>
                            <div style="color: #6b7280; font-size: 0.75em; margin-bottom: 5px;">${item.provNombre}</div>
                            <div style="font-size: 0.75em; color: #999;">Base: ${item.moneda}${formatter.format(item.base)}</div>
                        </div>
                        <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                            <div style="color: #ef5a1a; font-weight: bold; font-size: 1.1em;">${item.moneda}${formatter.format(item.final)}</div>
                            <div style="display: flex; gap: 5px;">
                                <button type="button" onclick="window.toggleItemPaquete(${item.id})" style="background: ${btnPauseColor}; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8em;" title="Pausar / Activar">⏸️</button>
                                <button type="button" onclick="window.borrarItemPaquete(${item.id})" style="background: #e74c3c; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8em;" title="Eliminar">🗑️</button>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        const formatter = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('paq-res-base').innerText = `${ultimaMoneda}${formatter.format(totalBase)}`;
        document.getElementById('paq-res-rentabilidad').innerText = `${ultimaMoneda}${formatter.format(totalProfit)}`;
        document.getElementById('paq-res-total').innerText = `${ultimaMoneda}${formatter.format(totalFinal)}`;
    };

    window.toggleItemPaquete = (id) => {
        const item = carritoPaquete.find(i => i.id === id);
        if (item) { item.activo = !item.activo; renderizarCarritoPaquete(); }
    };
    
    window.borrarItemPaquete = (id) => {
        carritoPaquete = carritoPaquete.filter(i => i.id !== id);
        renderizarCarritoPaquete();
    };

    if(btnCalcCopiar) btnCalcCopiar.addEventListener('click', () => {
        let totalTexto = document.getElementById('res-total').innerText.replace('USD', '').replace('$', '').trim();
        totalTexto = totalTexto.replace(/\./g, '').replace(',', '.');
        navigator.clipboard.writeText(totalTexto).then(() => {
            const old = btnCalcCopiar.innerHTML; btnCalcCopiar.innerHTML = '✅ Copiado';
            setTimeout(() => { btnCalcCopiar.innerHTML = old; }, 2000);
        });
    });

    if(btnCalcNueva) btnCalcNueva.addEventListener('click', () => {
        selectServicio.value = ''; selectProveedor.innerHTML = '<option value="">Seleccionar Servicio Primero...</option>';
        inputMonto.value = ''; boxResultados.style.display = 'none'; selectServicio.focus(); 
        carritoPaquete = []; renderizarCarritoPaquete(); // También limpiamos el carrito
    });

    // Copiar solo el número total del paquete
    const btnPaqCopiar = document.getElementById('btn-paq-copiar');
    if(btnPaqCopiar) btnPaqCopiar.addEventListener('click', () => {
        let totalTexto = document.getElementById('paq-res-total').innerText.replace('USD', '').replace('$', '').trim();
        totalTexto = totalTexto.replace(/\./g, '').replace(',', '.');
        navigator.clipboard.writeText(totalTexto).then(() => {
            const old = btnPaqCopiar.innerHTML; btnPaqCopiar.innerHTML = '✅ Copiado';
            setTimeout(() => { btnPaqCopiar.innerHTML = old; }, 2000);
        });
    });

    // NUEVO: Generar resumen de texto para WhatsApp
    const btnPaqGuardar = document.getElementById('btn-paq-guardar');
    if(btnPaqGuardar) btnPaqGuardar.addEventListener('click', () => {
        if (carritoPaquete.length === 0) return window.showAlert("El paquete está vacío", "error");
        
        let texto = "🌟 *RESUMEN DE COTIZACIÓN* 🌟\n\n";
        let totalGeneral = 0;
        let monedaActual = 'USD ';
        
        carritoPaquete.forEach(item => {
            if (item.activo) {
                const formatter = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                texto += `🔹 *${item.servicioNombre}*\n`;
                texto += `   Valor: ${item.moneda}${formatter.format(item.final)}\n\n`;
                totalGeneral += item.final;
                monedaActual = item.moneda;
            }
        });
        
        const formTot = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        texto += `------------------------\n`;
        texto += `💰 *TOTAL FINAL: ${monedaActual}${formTot.format(totalGeneral)}*\n`;
        
        navigator.clipboard.writeText(texto).then(() => {
            window.showAlert("¡Presupuesto copiado al portapapeles listo para enviar!", "success");
        });
    });
}

// 4. LÓGICA DEL PANEL DE ADMINISTRACIÓN (BACKOFFICE)
const tabUsers = document.getElementById('tab-admin-usuarios');
const tabCalc = document.getElementById('tab-admin-calculadora');
const tabMkt = document.getElementById('tab-admin-marketing'); // NUEVO
const secUsers = document.getElementById('admin-seccion-usuarios');
const secCalc = document.getElementById('admin-seccion-calculadora');
const secMkt = document.getElementById('admin-seccion-marketing'); // NUEVO
const btnSaveCalc = document.getElementById('btn-save-calculadora');

if(tabUsers && tabCalc) {
    // Clic en Usuarios
    tabUsers.addEventListener('click', () => { 
        secUsers.style.display = 'block'; secCalc.style.display = 'none'; if(secMkt) secMkt.style.display = 'none'; 
        tabUsers.style.background = '#11173d'; tabUsers.style.color = 'white'; 
        tabCalc.style.background = '#f3f4f6'; tabCalc.style.color = '#6b7280'; 
        if(tabMkt) { tabMkt.style.background = '#f3f4f6'; tabMkt.style.color = '#6b7280'; }
    });
    
    // Clic en Calculadora
    tabCalc.addEventListener('click', () => { 
        secUsers.style.display = 'none'; secCalc.style.display = 'block'; if(secMkt) secMkt.style.display = 'none'; 
        tabCalc.style.background = '#11173d'; tabCalc.style.color = 'white'; 
        tabUsers.style.background = '#f3f4f6'; tabUsers.style.color = '#6b7280'; 
        if(tabMkt) { tabMkt.style.background = '#f3f4f6'; tabMkt.style.color = '#6b7280'; }
        if(typeof renderAdminListaServicios === 'function') renderAdminListaServicios(); 
    });

    // Clic en Marketing
    if(tabMkt) {
        tabMkt.addEventListener('click', () => {
            secUsers.style.display = 'none'; secCalc.style.display = 'none'; if(secMkt) secMkt.style.display = 'block';
            tabMkt.style.background = '#11173d'; tabMkt.style.color = 'white';
            tabUsers.style.background = '#f3f4f6'; tabUsers.style.color = '#6b7280';
            tabCalc.style.background = '#f3f4f6'; tabCalc.style.color = '#6b7280';
        });
    }

    // RENDERIZAR LISTA IZQUIERDA
    window.renderAdminListaServicios = () => {
        const listaDiv = document.getElementById('admin-lista-servicios');
        if(!listaDiv) return;
        listaDiv.innerHTML = '';
        dbCalculadora.forEach(srv => {
            const btn = document.createElement('div');
            btn.style.cssText = `padding: 12px; border-bottom: 1px solid #e5e7eb; cursor: pointer; transition: background 0.2s; background: ${servicioEditandoId === srv.id ? '#e6f4ea' : 'white'}; font-weight: ${servicioEditandoId === srv.id ? 'bold' : 'normal'};`;
            btn.innerText = srv.nombre;
            btn.onclick = () => { servicioEditandoId = srv.id; renderAdminListaServicios(); renderAdminEditor(); };
            listaDiv.appendChild(btn);
        });
        if(dbCalculadora.length > 0 && !servicioEditandoId) { servicioEditandoId = dbCalculadora[0].id; renderAdminListaServicios(); renderAdminEditor(); }
    };

    // RENDERIZAR TABLA DERECHA
    window.renderAdminEditor = () => {
        const editorDiv = document.getElementById('admin-editor-servicio');
        const tbody = document.getElementById('editor-proveedores-tbody');
        if(!editorDiv || !tbody) return;
        
        btnSaveCalc.style.display = 'block';
        
        const srv = dbCalculadora.find(s => s.id === servicioEditandoId);
        if(!srv) return;
        
        editorDiv.style.display = 'block';
        editorDiv.style.display = 'block';
        
        // NUEVO TÍTULO CON BOTONES DE EDITAR Y BORRAR
        document.getElementById('editor-servicio-titulo').innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="cursor: pointer; border-bottom: 2px dashed #11173d;" onclick="editarNombreServicio()" title="Tocar para editar nombre">
                    ✏️ ${srv.nombre}
                </span>
                <button onclick="borrarServicioActual()" style="background: #ef5a1a; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.6em; cursor: pointer; font-weight: bold; transition: opacity 0.2s;">
                    🗑️ Borrar Servicio
                </button>
            </div>
        `;
        tbody.innerHTML = '';
        
        srv.proveedores.forEach((prov, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><input type="text" value="${prov.nombre}" onchange="updateProv(${index}, 'nombre', this.value)" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;"></td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><input type="number" step="0.1" value="${prov.tasa}" onchange="updateProv(${index}, 'tasa', this.value)" style="width:80px; padding:8px; border:1px solid #ccc; border-radius:4px;"></td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
                    <select onchange="updateProv(${index}, 'tipo', this.value)" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;">
                        <option value="markup" ${prov.tipo === 'markup' ? 'selected' : ''}>Suma (Markup)</option>
                        <option value="descuento" ${prov.tipo === 'descuento' ? 'selected' : ''}>Descuento Neta</option>
                    </select>
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align:center;"><button onclick="deleteProv(${index})" style="background:#ef5a1a; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;">Borrar</button></td>
            `;
            tbody.appendChild(tr);
        });
    };

    // FUNCIONES AUXILIARES DEL EDITOR
    // FUNCIONES AUXILIARES DEL EDITOR
    window.editarNombreServicio = () => {
        const srv = dbCalculadora.find(s => s.id === servicioEditandoId);
        const nuevoNombre = prompt("Editá el nombre y el emoji (Ej: 🚌 Paquete en BUS):", srv.nombre);
        if(nuevoNombre) { srv.nombre = nuevoNombre; renderAdminListaServicios(); renderAdminEditor(); }
    };

    window.borrarServicioActual = () => {
        const srv = dbCalculadora.find(s => s.id === servicioEditandoId);
        if(confirm(`¿Seguro que querés borrar el servicio "${srv.nombre}" y todos sus proveedores?`)) {
            dbCalculadora = dbCalculadora.filter(s => s.id !== servicioEditandoId);
            servicioEditandoId = null;
            renderAdminListaServicios();
            document.getElementById('admin-editor-servicio').style.display = 'none';
        }
    };
    window.updateProv = (index, field, value) => { const srv = dbCalculadora.find(s => s.id === servicioEditandoId); srv.proveedores[index][field] = value; };
    window.deleteProv = (index) => { const srv = dbCalculadora.find(s => s.id === servicioEditandoId); srv.proveedores.splice(index, 1); renderAdminEditor(); };
    
    const btnNuevoProv = document.getElementById('btn-admin-nuevo-proveedor');
    if(btnNuevoProv) {
        btnNuevoProv.addEventListener('click', () => {
            const srv = dbCalculadora.find(s => s.id === servicioEditandoId);
            if(srv) { srv.proveedores.push({ nombre: 'Nuevo Proveedor', tasa: 10, tipo: 'markup' }); renderAdminEditor(); }
        });
    }

    const btnNuevoServ = document.getElementById('btn-admin-nuevo-servicio');
    if(btnNuevoServ) {
        btnNuevoServ.addEventListener('click', async () => {
            const nombreStr = prompt("Escribí el nombre del servicio con su emoji (Ej: 🚀 Viajes a Marte):");
            if(nombreStr) {
                const newId = 'srv_' + Date.now();
                dbCalculadora.push({ id: newId, nombre: nombreStr, proveedores: [] });
                servicioEditandoId = newId;
                renderAdminListaServicios();
                renderAdminEditor();
            }
        });
    }

    // GUARDAR EN FIREBASE
    if(btnSaveCalc) {
        btnSaveCalc.addEventListener('click', async () => {
            showLoader(true, "Guardando base de datos...");
            try {
                await db.collection('config').doc('calculadora_v3').set({ servicios: dbCalculadora });
                if(typeof actualizarSelectServiciosVentas === 'function') actualizarSelectServiciosVentas();
                window.showAlert("¡Estructura guardada con éxito!", "success");
            } catch (e) { console.error(e); window.showAlert("Error guardando.", "error"); }
            showLoader(false);
        });
    }
     
}
// ==========================================
// BUSCADOR EN TIEMPO REAL DE USUARIOS
// ==========================================
const searchUsersInput = document.getElementById('admin-search-users');

if (searchUsersInput) {
    searchUsersInput.addEventListener('input', function() {
        const termino = this.value.toLowerCase();
        const listaUsuarios = document.getElementById('users-list');
        
        if (listaUsuarios) {
            // Agarramos a todos los usuarios de la lista
            const items = listaUsuarios.children;
            
            for (let i = 0; i < items.length; i++) {
                // Leemos todo el texto que tiene ese renglón (email, rol, franquicia)
                const textoRenglon = items[i].innerText.toLowerCase();
                
                // Si el renglón contiene lo que escribimos, lo mostramos. Si no, lo ocultamos.
                if (textoRenglon.includes(termino)) {
                    items[i].style.display = ''; 
                } else {
                    items[i].style.display = 'none'; 
                }
            }
        }
    });
}

// ====================================================================
// 🚀 MÓDULO MARKETING Y CALENDARIO (CONECTADO A FIREBASE)
// ====================================================================

// --- 1. LÓGICA DEL CALENDARIO ---
let currentDateMarketing = new Date();
let tareasMarketingGlobal = []; // Guardamos las tareas acá para leerlas al hacer clic
let isEditingMktId = null;
window.vistaCalendarioMkt = null;

window.renderizarCalendario = async () => {
    const grid = document.getElementById('grid-calendario-marketing');
    const labelMes = document.getElementById('mes-actual-label');
    if (!grid || !labelMes) return;

    // 👁️ 1. CONFIGURACIÓN DEL FILTRO POR DEFECTO (Inteligencia por Rol)
    if (!window.vistaCalendarioMkt) {
        const esAdmin = userData && (userData.rol === 'admin' || userData.rol === 'editor');
        window.vistaCalendarioMkt = esAdmin ? 'RED' : 'PROPIOS';
    }

    // 👁️ 2. DIBUJAR EL SWITCH (Sin tocar el HTML)
    let toggleContainer = document.getElementById('toggle-mkt-container');
    if (!toggleContainer) {
        toggleContainer = document.createElement('div');
        toggleContainer.id = 'toggle-mkt-container';
        toggleContainer.style.cssText = 'display: flex; justify-content: flex-end; margin-bottom: 15px; width: 100%;';
        
        // Lo intentamos insertar justo arriba de los nombres de los días ("Dom", "Lun")
        const headerDias = document.querySelector('.header-dias-semana');
        if(headerDias) {
            headerDias.parentNode.insertBefore(toggleContainer, headerDias);
        } else {
            grid.parentNode.insertBefore(toggleContainer, grid);
        }
    }

    // Lógica visual del Switch (Naranja si está activo, Gris si no)
    const isPropios = window.vistaCalendarioMkt === 'PROPIOS';
    toggleContainer.innerHTML = `
        <div style="background: #f3f4f6; padding: 4px; border-radius: 30px; display: inline-flex; align-items: center; gap: 5px; border: 1px solid #e5e7eb;">
            <button onclick="window.cambiarVistaMkt('PROPIOS')" style="border: none; background: ${isPropios ? 'white' : 'transparent'}; color: ${isPropios ? '#ef5a1a' : '#6b7280'}; box-shadow: ${isPropios ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'}; padding: 6px 15px; border-radius: 20px; font-weight: bold; cursor: pointer; transition: 0.3s; font-size: 0.85em;">
                👁️ Mis Tareas
            </button>
            <button onclick="window.cambiarVistaMkt('RED')" style="border: none; background: ${!isPropios ? 'white' : 'transparent'}; color: ${!isPropios ? '#1e3a8a' : '#6b7280'}; box-shadow: ${!isPropios ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'}; padding: 6px 15px; border-radius: 20px; font-weight: bold; cursor: pointer; transition: 0.3s; font-size: 0.85em;">
                🌐 Red FV
            </button>
        </div>
    `;

    // Ponemos un mensajito de carga mientras buscamos en Firebase
    grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #6b7280; font-weight: bold;">Cargando tareas... ⏳</div>';

    // 1. DESCARGAMOS LAS TAREAS DE LA BASE DE DATOS
    try {
        const snapshot = await db.collection('calendario_marketing').get();
        tareasMarketingGlobal = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch(e) { 
        console.error("Error al traer tareas:", e); 
    }

    grid.innerHTML = '';
    const mes = currentDateMarketing.getMonth();
    const anio = currentDateMarketing.getFullYear();
    const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    labelMes.innerText = `${nombresMeses[mes]} ${anio}`;

    const primerDia = new Date(anio, mes, 1).getDay();
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();

    // Rellenar espacios vacíos antes del 1 del mes
    for (let i = 0; i < primerDia; i++) {
        const divVacio = document.createElement('div');
        divVacio.style.cssText = "background: transparent; min-height: 100px;";
        grid.appendChild(divVacio);
    }

    const hoyReal = new Date();
    // Conseguimos "hoy" pero a las 00:00:00 para comparar fácil
    const hoyPuro = new Date(hoyReal.getFullYear(), hoyReal.getMonth(), hoyReal.getDate());
    
    // Dibujamos todos los días
    for (let dia = 1; dia <= diasEnMes; dia++) {
        const fechaCelda = new Date(anio, mes, dia);
        const esHoy = (fechaCelda.getTime() === hoyPuro.getTime());
        const esPasado = (fechaCelda < hoyPuro); // ¡MAGIA ACÁ! Se da cuenta si el día ya pasó
        
        const divDia = document.createElement('div');
        
        const diaSemana = fechaCelda.getDay();
        const esFinde = (diaSemana === 0 || diaSemana === 6);

        const colorFondo = esFinde ? '#f9fafb' : 'white';
        
        // Si es pasado lo hacemos transparente (0.4), si es finde un poquito (0.8), sino 1.
        let opacidadFinal = '1';
        if (esPasado) opacidadFinal = '0.4'; 
        else if (esFinde) opacidadFinal = '0.8';

        divDia.style.cssText = `
            background: ${colorFondo}; opacity: ${opacidadFinal}; border: 1px solid ${esHoy ? '#ef5a1a' : '#e5e7eb'}; border-radius: 8px; 
            min-height: 120px; padding: 10px; display: flex; flex-direction: column; cursor: pointer;
            transition: box-shadow 0.2s, transform 0.2s, opacity 0.2s; box-shadow: ${esHoy ? '0 0 0 2px rgba(239, 90, 26, 0.2)' : 'none'};
        `;
        
        // Efecto hover (Iluminar al pasar el mouse)
        if (esPasado) {
            divDia.onmouseover = () => { divDia.style.boxShadow = '0 4px 10px rgba(0,0,0,0.05)'; divDia.style.opacity = '0.8'; };
            divDia.onmouseout = () => { divDia.style.boxShadow = 'none'; divDia.style.opacity = '0.4'; };
        } else {
            divDia.onmouseover = () => divDia.style.boxShadow = '0 4px 10px rgba(0,0,0,0.05)';
            divDia.onmouseout = () => divDia.style.boxShadow = esHoy ? '0 0 0 2px rgba(239, 90, 26, 0.2)' : 'none';
        }

        // Armamos la fecha exacta de este cuadradito
        const fechaString = `${anio}-${String(mes+1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        
        // Filtramos las tareas que caen EXACTAMENTE en este día
        let tareasDelDia = tareasMarketingGlobal.filter(t => t.fecha === fechaString);

        // 👁️ 3. APLICAR EL FILTRO DE VISTA (El "Ojito")
        if (window.vistaCalendarioMkt === 'PROPIOS') {
            const miFranquicia = userData && userData.franquicia ? userData.franquicia : '';
            // Solo deja pasar las que me asignaron a mí o las que son globales ("TODOS")
            tareasDelDia = tareasDelDia.filter(t => t.asignado === miFranquicia || t.asignado === 'TODOS');
        }

        // Creamos el HTML de las tarjetitas
        let htmlTareas = '';
        tareasDelDia.forEach(tarea => {
            
            // LA MAGIA: Verificamos si esta tarea es para el usuario que está mirando la pantalla
            const miFranquicia = userData && userData.franquicia ? userData.franquicia : '';
            const esParaMi = (tarea.asignado === miFranquicia || tarea.asignado === 'TODOS');

            // Buscamos el color y abreviatura de la etiqueta
            const infoEtiqueta = etiquetasMarketingGlobal.find(e => e.nombre === tarea.tipo) || { abrev: 'MKT', color: '#6b7280' };

            // Diseño: Si es para mí (azul vibrante). Si es de otro (gris neutro).
            const fondoTarea = esParaMi ? '#eff6ff' : '#f9fafb';
            const bordeIzquierdo = esParaMi ? '4px solid #3b82f6' : '2px solid #e5e7eb';
            const colorTextoAsignado = esParaMi ? '#1e3a8a' : '#6b7280';

            htmlTareas += `
                <div onclick="window.verDetalleTareaMkt(event, '${tarea.id}')"
                     style="background: ${fondoTarea}; border: 1px solid #e5e7eb; border-left: ${bordeIzquierdo}; 
                            border-radius: 4px; padding: 6px; margin-bottom: 5px; transition: transform 0.1s;">
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="background: ${infoEtiqueta.color}; color: white; padding: 2px 5px; border-radius: 4px; font-weight: bold; font-size: 0.7em; letter-spacing: 0.5px;">
                            ${infoEtiqueta.abrev}
                        </span>
                        ${esParaMi ? '<span title="¡Esta tarea es para tu franquicia!" style="font-size: 1.1em; animation: pulse 2s infinite;">🔔</span>' : ''}
                    </div>
                    
                    <div style="font-weight: 700; font-size: 0.75em; color: ${colorTextoAsignado}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        Para: ${tarea.asignado}
                    </div>
                </div>
            `;
        });

        // Inyectamos todo adentro del día
        divDia.innerHTML = `
            <div style="font-weight: bold; font-size: 1.1em; color: ${esHoy ? '#ef5a1a' : '#11173d'}; margin-bottom: 8px;">${dia}</div>
            <div style="flex: 1; display: flex; flex-direction: column;">
                ${htmlTareas}
            </div>
        `;

        // Al hacer clic en el espacio en blanco del día, abre para crear una tarea nueva
        divDia.onclick = () => {
            window.abrirFormularioMarketing(fechaString);
        };

        grid.appendChild(divDia);
    }
};

// Función para ver los detalles de una tarea (AHORA USA EL MODAL PREMIUM DE PROMOS)
window.verDetalleTareaMkt = (event, idTarea) => {
    event.stopPropagation(); 
    
    const tarea = tareasMarketingGlobal.find(t => t.id === idTarea);
    if(!tarea) return;

    // 🪄 EL TRUCO: Usamos el mismo contenedor exacto de los paquetes (Promos)
    const modal = dom.modal;
    const modalBody = dom.modalBody;

    // 1. Fechas y Etiquetas
    const partes = tarea.fecha.split('-');
    const fechaFormat = `${partes[2]}/${partes[1]}/${partes[0]}`;
    const infoEtiqueta = etiquetasMarketingGlobal.find(e => e.nombre === tarea.tipo) || { abrev: 'MKT', color: '#56DDE0' };
    
    // Etiqueta adentro del modal (Igual que Promos)
    const bubbleStyle = `background-color: ${infoEtiqueta.color}; color: white; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 0.8em; display: inline-block; margin-top: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);`;

    // 2. Permisos y Botones finitos
    let adminTools = '';
    const tienePermisos = userData && (userData.rol === 'admin' || userData.rol === 'editor' || currentUser.email === tarea.creador);
    
    if (tienePermisos) {
        // Botones Editar/Borrar idénticos a los de Paquetes
        adminTools = `
        <div class="modal-tools" style="position: absolute; top: 20px; right: 70px; display:flex; gap:10px;">
            <button class="btn btn-secundario" onclick="window.editarTareaMktProxy('${tarea.id}')" style="padding:5px 15px; font-size:0.8em;">✏️ Editar</button>
            <button class="btn btn-secundario" onclick="window.borrarTareaMktProxy('${tarea.id}')" style="padding:5px 15px; font-size:0.8em; background:#e74c3c; color:white;">🗑️ Borrar</button>
        </div>`;
    }

    // 3. Estilo para el link de Drive (Más ordenado y cliqueable)
    let driveHtml = '';
    if (tarea.drive && tarea.drive.trim() !== "") {
        driveHtml = `
            <div style="margin-top: 20px; background: #eef2f5; padding: 15px; border-radius: 8px;">
                <h4 style="margin: 0 0 8px 0; color: #11173d;">📁 Archivo / Link de Drive</h4>
                <a href="${tarea.drive}" target="_blank" style="color: #ef5a1a; text-decoration: none; word-break: break-all; font-weight: 500;">${tarea.drive}</a>
            </div>
        `;
    }

    // 4. INYECTAMOS EL HTML CON LA ESTRUCTURA DE PAQUETES
    modalBody.innerHTML = `
        ${adminTools}
        <div class="modal-detalle-header" style="display:block; padding-bottom: 25px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <h2 style="margin:0; font-size:2.2em; line-height:1.1; color:white; padding-right: 170px;">${tarea.tipo.toUpperCase()}</h2>
            </div>
            <div style="margin-top:5px;"><span style="${bubbleStyle}">${tarea.tipo}</span></div>
        </div>

        <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; padding: 20px;">
            <div>
                <h3 style="border-bottom:2px solid #eee; padding-bottom:10px; margin-top:0; color:#11173d;">Instrucciones y Detalles</h3>
                <p style="white-space: pre-wrap; color: #555; line-height: 1.6; font-size: 0.95em; margin-top:10px;">${tarea.notas || 'Sin instrucciones adicionales.'}</p>
                ${driveHtml}
            </div>
            <div style="background:#f9fbfd; padding:15px; border-radius:8px; height:fit-content;">
                <h4 style="margin:0 0 15px 0; color:#11173d; border-bottom:1px solid #eee; padding-bottom:10px;">Resumen</h4>
                <p style="margin:8px 0 15px 0; font-size:0.95em;"><b>📅 Entrega:</b> ${fechaFormat}</p>
                
                <p style="margin:8px 0 4px 0; font-size:0.95em;"><b>🏢 Asignado a:</b></p>
                <div style="color:#ef5a1a; font-weight:bold; font-size: 1.1em; line-height: 1.3;">${tarea.asignado}</div>
            </div>
        </div>
        
        <div style="background:#11173d; color:white; padding:15px 20px; display:flex; justify-content:flex-end; align-items:center; border-radius:0 0 12px 12px;">
            <div style="text-align:right;">
                <small style="opacity:0.7;">Cargado por:</small>
                <div style="font-size:0.9em;">${tarea.creador}</div>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
};

// 5. Funciones "Proxy" para manejar los clics de Editar/Borrar desde adentro del nuevo modal
window.editarTareaMktProxy = (id) => {
    const tarea = tareasMarketingGlobal.find(t => t.id === id);
    if(tarea) {
        dom.modal.style.display = 'none'; // Cerramos el modal de detalle
        window.editarTareaMkt(tarea);     // Abrimos el formulario de edición
    }
};

window.borrarTareaMktProxy = async (id) => {
    if(await window.showConfirm("⚠️ ¿Seguro que querés ELIMINAR esta tarea del calendario?")) {
        showLoader(true, "Borrando tarea...");
        try {
            await db.collection('calendario_marketing').doc(id).delete();
            dom.modal.style.display = 'none'; // Cerramos el modal
            await window.renderizarCalendario();
            window.showAlert("Tarea eliminada", "success");
        } catch(e) {
            console.error(e);
            window.showAlert("Error al borrar", "error");
        }
        showLoader(false);
    }
};

// Cerrar el modal tocando el fondo oscuro
const modalDetalleMkt = document.getElementById('modal-detalle-tarea');
if(modalDetalleMkt) {
    modalDetalleMkt.addEventListener('click', (e) => {
        if(e.target === modalDetalleMkt) modalDetalleMkt.style.display = 'none';
    });
}

// Función para que el Switch cambie la vista y recargue el mes al instante
window.cambiarVistaMkt = (vista) => {
    window.vistaCalendarioMkt = vista;
    window.renderizarCalendario();
};

// --- 2. CONTROLES DEL CALENDARIO ---
const btnAnt = document.getElementById('btn-mes-anterior');
const btnSig = document.getElementById('btn-mes-siguiente');

if(btnAnt) {
    btnAnt.addEventListener('click', () => {
        const hoy = new Date();
        // Calculamos el mes mínimo permitido (hace 2 meses)
        const mesMinimo = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
        // El mes al que queremos ir
        const mesDestino = new Date(currentDateMarketing.getFullYear(), currentDateMarketing.getMonth() - 1, 1);

        if (mesDestino < mesMinimo) {
            window.showAlert("Solo se puede visualizar hasta 2 meses atrás.", "info");
            return;
        }

        currentDateMarketing.setMonth(currentDateMarketing.getMonth() - 1);
        window.renderizarCalendario();
    });
}

if(btnSig) {
    btnSig.addEventListener('click', () => {
        currentDateMarketing.setMonth(currentDateMarketing.getMonth() + 1);
        window.renderizarCalendario();
    });
}

// --- 3. GESTIÓN DE ETIQUETAS DE MARKETING ---
let etiquetasMarketingGlobal = [];

window.cargarEtiquetasMarketing = async () => {
    const contenedor = document.getElementById('lista-etiquetas-admin');
    const selectModal = document.getElementById('marketing-tipo');
    try {
        const doc = await db.collection('metadata').doc('config').get();
        if(doc.exists && doc.data().tipos_marketing) etiquetasMarketingGlobal = doc.data().tipos_marketing;

        if(contenedor) {
            contenedor.innerHTML = '';
            if(etiquetasMarketingGlobal.length === 0) contenedor.innerHTML = '<span style="color: #999; font-size: 0.9em;">No hay etiquetas creadas.</span>';
            etiquetasMarketingGlobal.forEach((eti, index) => {
                contenedor.innerHTML += `
                <div style="background: ${eti.color}15; border: 1px solid ${eti.color}; color: #11173d; padding: 5px 12px; border-radius: 20px; display: flex; align-items: center; gap: 8px; font-size: 0.85em;">
                    <span style="background: ${eti.color}; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.8em;">${eti.abrev}</span>
                    <b>${eti.nombre}</b>
                    <button onclick="borrarEtiquetaMkt(${index})" style="background: transparent; border: none; color: #e74c3c; cursor: pointer; font-weight: bold;">×</button>
                </div>`;
            });
        }

        if(selectModal) {
            selectModal.innerHTML = '<option value="">Seleccionar...</option>';
            etiquetasMarketingGlobal.forEach(eti => { selectModal.innerHTML += `<option value="${eti.nombre}">${eti.nombre}</option>`; });
        }

        const leyendaCalendario = document.getElementById('leyenda-etiquetas-marketing');
        if(leyendaCalendario) {
            leyendaCalendario.innerHTML = '';
            if(etiquetasMarketingGlobal.length === 0) {
                leyendaCalendario.innerHTML = '<span style="color: #999; font-size: 0.8em;">No hay etiquetas creadas.</span>';
            } else {
                etiquetasMarketingGlobal.forEach(eti => {
                    leyendaCalendario.innerHTML += `
                        <div style="display: flex; align-items: center; gap: 6px; font-size: 0.85em; color: #555; background: #f9fafb; padding: 4px 10px; border-radius: 6px; border: 1px solid #e5e7eb;">
                            <span style="background: ${eti.color}; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.8em;">${eti.abrev}</span>
                            <span style="font-weight: 500;">= ${eti.nombre}</span>
                        </div>
                    `;
                });
            }
        }
        
    } catch(e) { console.error("Error al cargar etiquetas:", e); }
};
 



const btnNuevaEti = document.getElementById('btn-agregar-etiqueta');
if(btnNuevaEti) {
    btnNuevaEti.addEventListener('click', async () => {
        const nombre = document.getElementById('admin-etiqueta-nombre').value.trim();
        const abrev = document.getElementById('admin-etiqueta-abrev').value.trim().toUpperCase();
        const color = document.getElementById('admin-etiqueta-color').value;
        if(!nombre || !abrev) return window.showAlert("Completá nombre y abreviatura", "error");

        etiquetasMarketingGlobal.push({ nombre, abrev, color });
        showLoader(true, "Guardando etiqueta...");
        try {
            await db.collection('metadata').doc('config').set({ tipos_marketing: etiquetasMarketingGlobal }, { merge: true });
            document.getElementById('admin-etiqueta-nombre').value = '';
            document.getElementById('admin-etiqueta-abrev').value = '';
            await window.cargarEtiquetasMarketing();
        } catch(e) { window.showAlert("Error al guardar", "error"); }
        showLoader(false);
    });
}

window.borrarEtiquetaMkt = async (index) => {
    if(!confirm("¿Borrar esta etiqueta?")) return;
    etiquetasMarketingGlobal.splice(index, 1);
    showLoader(true, "Borrando...");
    try { await db.collection('metadata').doc('config').update({ tipos_marketing: etiquetasMarketingGlobal }); await window.cargarEtiquetasMarketing(); } 
    catch(e) { window.showAlert("Error", "error"); }
    showLoader(false);
};

// --- 4. FORMULARIO Y MODAL DE TAREAS ---
const modalMkt = document.getElementById('modal-marketing');
const formMkt = document.getElementById('form-marketing');
const selectAsignado = document.getElementById('marketing-asignado');

// Abre para CREAR
window.abrirFormularioMarketing = async (fechaElegida) => {
    if (!modalMkt) return;
    isEditingMktId = null; // Reiniciamos el ID de edición
    if(formMkt) formMkt.reset(); // Limpiamos el formulario

    const partes = fechaElegida.split('-');
    document.getElementById('marketing-fecha-display').innerText = `${partes[2]}/${partes[1]}/${partes[0]}`;
    document.getElementById('marketing-fecha-input').value = fechaElegida;
    
    await llenarComboFranquiciasMkt();
    modalMkt.style.display = 'flex';
};

// Abre para EDITAR (Nueva función)
window.editarTareaMkt = async (tarea) => {
    if (!modalMkt) return;
    isEditingMktId = tarea.id; // Guardamos el ID que estamos editando
    
    // Ocultamos el modal de detalle y abrimos el de carga
    document.getElementById('modal-detalle-tarea').style.display = 'none';

    const partes = tarea.fecha.split('-');
    document.getElementById('marketing-fecha-display').innerText = `${partes[2]}/${partes[1]}/${partes[0]}`;
    document.getElementById('marketing-fecha-input').value = tarea.fecha;

    await llenarComboFranquiciasMkt();

    // Llenamos los datos existentes
    document.getElementById('marketing-tipo').value = tarea.tipo || '';
    document.getElementById('marketing-asignado').value = tarea.asignado || '';
    document.getElementById('marketing-drive').value = tarea.drive || '';
    document.getElementById('marketing-notas').value = tarea.notas || '';

    modalMkt.style.display = 'flex';
};

// Función auxiliar para cargar el combo (para no repetir código)
async function llenarComboFranquiciasMkt() {
    selectAsignado.innerHTML = '<option value="">Seleccionar...</option><option value="TODOS">📢 A Todas las Franquicias</option>';
    try {
        const doc = await db.collection('metadata').doc('config').get();
        if (doc.exists && doc.data().franquicias) {
            doc.data().franquicias.forEach(f => selectAsignado.innerHTML += `<option value="${f}">🏢 ${f}</option>`);
        }
    } catch(e) { console.error(e); }
}

const btnCerrarMkt = document.getElementById('modal-marketing-cerrar');
if(btnCerrarMkt) btnCerrarMkt.onclick = () => { modalMkt.style.display = 'none'; if(formMkt) formMkt.reset(); };

if (formMkt) {
    formMkt.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoader(true, isEditingMktId ? "Actualizando tarea..." : "Guardando tarea...");
        
        // Buscamos si hay datos originales para conservarlos (creador y timestamp original)
        let tareaOriginal = null;
        if (isEditingMktId) {
            tareaOriginal = tareasMarketingGlobal.find(t => t.id === isEditingMktId);
        }

        const payload = {
            fecha: document.getElementById('marketing-fecha-input').value,
            tipo: document.getElementById('marketing-tipo').value,
            asignado: document.getElementById('marketing-asignado').value,
            drive: document.getElementById('marketing-drive').value,
            notas: document.getElementById('marketing-notas').value,
            // Si editamos, mantenemos al creador original. Si es nueva, ponemos al actual.
            creador: isEditingMktId && tareaOriginal ? tareaOriginal.creador : ((userData && userData.franquicia) ? userData.franquicia : (currentUser ? currentUser.email : 'Anónimo')),
            // Misma lógica para la fecha de creación
            timestamp: isEditingMktId && tareaOriginal ? tareaOriginal.timestamp : Date.now(),
            // Agregamos una marca de quién editó
            last_edited_by: isEditingMktId ? currentUser.email : null
        };

        try {
            if (isEditingMktId) {
                // Modo Edición
                await db.collection('calendario_marketing').doc(isEditingMktId).update(payload);
                window.showAlert("¡Tarea actualizada con éxito!", "success");
            } else {
                // Modo Creación
                await db.collection('calendario_marketing').add(payload);
                window.showAlert("¡Tarea asignada con éxito!", "success");
            }
            
            modalMkt.style.display = 'none';
            formMkt.reset();
            isEditingMktId = null; // Limpiamos el control

            await window.renderizarCalendario();
        } catch(error) {
            console.error(error);
            window.showAlert("Error al guardar en BD.", "error");
        }
        showLoader(false);
    });
}


// ==========================================
// MÓDULO: GESTIÓN DE FRANQUICIAS DINÁMICAS
// ==========================================
const inputNuevaFranquicia = document.getElementById('admin-nueva-franquicia');
const btnAgregarFranquicia = document.getElementById('btn-agregar-franquicia');

let modoEdicionFranquicias = false;

// Botón Lápiz para activar/desactivar el modo edición
const btnToggleEditFranq = document.getElementById('btn-toggle-edit-franq');
if (btnToggleEditFranq) {
    btnToggleEditFranq.addEventListener('click', () => {
        modoEdicionFranquicias = !modoEdicionFranquicias;
        btnToggleEditFranq.style.background = modoEdicionFranquicias ? '#e5e7eb' : 'transparent';
        window.cargarFranquiciasAdmin(); // Redibujar las pastillas
    });
}

// 1. Función para descargar y dibujar las franquicias
window.cargarFranquiciasAdmin = async () => {
    const contenedorFranquicias = document.getElementById('lista-franquicias-admin');
    const selectCrearUsuario = document.getElementById('user-franchise-input');
    const contadorDiv = document.getElementById('contador-franquicias'); 
    
    // 👇 NUEVO: Atrapamos el selector del buscador de "Solo X Hoy"
    const filtroCreador = document.getElementById('filtro-creador'); 
    
    try {
        const doc = await db.collection('metadata').doc('config').get();
        let franquicias = [];
        if(doc.exists && doc.data().franquicias) franquicias = doc.data().franquicias;

        // Actualizar el mini-contador (INTACTO)
        if (contadorDiv) contadorDiv.innerText = franquicias.length;

        // Dibujar pastillitas (INTACTO)
        if(contenedorFranquicias) {
            contenedorFranquicias.innerHTML = '';
            if (franquicias.length === 0) {
                contenedorFranquicias.innerHTML = '<span style="color: #999; font-size: 0.9em;">No hay franquicias cargadas aún.</span>';
            } else {
                franquicias.forEach((franq, index) => {
                    if (modoEdicionFranquicias) {
                        // MODO EDICIÓN (Rojas y clickeables)
                        contenedorFranquicias.innerHTML += `
                            <span onclick="window.gestionarFranquicia(${index}, '${franq}')" 
                                  style="cursor: pointer; background: #fce8e6; color: #d93025; padding: 6px 12px; border-radius: 20px; font-size: 0.85em; font-weight: bold; border: 1px solid #fad2cf; transition: 0.2s;" 
                                  onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1" title="Clic para Editar o Borrar">
                                ✏️ ${franq}
                            </span>`;
                    } else {
                        // MODO NORMAL (Verdes)
                        contenedorFranquicias.innerHTML += `
                            <span style="background: #e6f4ea; color: #1e8e3e; padding: 6px 12px; border-radius: 20px; font-size: 0.85em; font-weight: bold; border: 1px solid #ceead6;">
                                🏢 ${franq}
                            </span>`;
                    }
                });
            }
        }

        // Llenar combo de Crear Usuario (INTACTO)
        if(selectCrearUsuario) {
            const valorPrevio = selectCrearUsuario.value;
            selectCrearUsuario.innerHTML = '<option value="">Seleccioná de la lista...</option>';
            franquicias.forEach(f => selectCrearUsuario.innerHTML += `<option value="${f}">${f}</option>`);
            if(valorPrevio) selectCrearUsuario.value = valorPrevio;
        }

        // 👇 NUEVO: Llenar el filtro del Buscador "Solo X Hoy"
        if(filtroCreador) {
            const valorPrevioFiltro = filtroCreador.value;
            filtroCreador.innerHTML = '<option value="">Todas las Franquicias</option>';
            
            // Le agregamos Casa Central fijo arriba de todo por si no la tenés en la base de franquicias general
            if (!franquicias.includes("Casa Central")) {
                filtroCreador.innerHTML += `<option value="Casa Central">Casa Central</option>`;
            }
            
            franquicias.forEach(f => filtroCreador.innerHTML += `<option value="${f}">${f}</option>`);
            
            if(valorPrevioFiltro) filtroCreador.value = valorPrevioFiltro;
        }

    } catch(e) { console.error("Error cargando franquicias:", e); }
};

// Función para mostrar el cartel lindo de edición
window.showPromptFranq = (message, defaultValue = '') => {
    return new Promise((resolve) => {
        const overlay = document.getElementById('custom-prompt-overlay');
        const input = document.getElementById('custom-prompt-input');
        
        input.value = defaultValue;
        overlay.style.display = 'flex';
        input.focus();

        document.getElementById('custom-prompt-btn').onclick = () => { overlay.style.display = 'none'; resolve(input.value); };
        document.getElementById('custom-prompt-cancel').onclick = () => { overlay.style.display = 'none'; resolve(null); };
        document.getElementById('custom-prompt-borrar').onclick = () => { overlay.style.display = 'none'; resolve('BORRAR'); };
    });
};

// Función para Editar o Borrar una franquicia
window.gestionarFranquicia = async (index, nombreActual) => {
    // Usamos el cartel premium en vez del feo del navegador
    const accion = await window.showPromptFranq(`Franquicia original: ${nombreActual}`, nombreActual);
    
    if (!accion || accion === nombreActual) return; // Si cancela o no cambia nada

    let franquicias = [];
    try {
        const doc = await db.collection('metadata').doc('config').get();
        if(doc.exists && doc.data().franquicias) franquicias = doc.data().franquicias;

        if (accion.trim().toUpperCase() === 'BORRAR') {
            if(!await window.showConfirm(`⚠️ ¿Seguro que querés eliminar "${nombreActual}" permanentemente?`)) return;
            franquicias.splice(index, 1);
            showLoader(true, "Borrando franquicia...");
            await db.collection('metadata').doc('config').update({ franquicias });
        } else {
            const nuevoNombre = accion.trim();
            franquicias[index] = nuevoNombre;

            showLoader(true, "Actualizando franquicias y usuarios...");
            
            // 1. Guardamos el nuevo nombre en la lista maestra
            await db.collection('metadata').doc('config').update({ franquicias });

            // 2. MAGIA: Buscamos a todos los usuarios con el nombre viejo y los actualizamos
            const usersRef = db.collection('usuarios');
            const snapshot = await usersRef.where('franquicia', '==', nombreActual).get();
            
            if (!snapshot.empty) {
                const batch = db.batch(); // El batch hace los cambios todos juntos de golpe
                snapshot.forEach(userDoc => {
                    batch.update(userDoc.ref, { franquicia: nuevoNombre });
                });
                await batch.commit();
                
                // Recargamos la lista visual de usuarios para que veas el cambio
                if(typeof loadUsersList === 'function') await loadUsersList(); 
            }
        }

        await window.cargarFranquiciasAdmin(); // Refrescar pastillitas
        showLoader(false);
        window.showAlert("¡Actualizado con éxito!", "success");

    } catch(e) {
        console.error(e);
        window.showAlert("Error al modificar.", "error");
        showLoader(false);
    }
};

// 2. Evento del botón para guardar una nueva
if(btnAgregarFranquicia) {
    btnAgregarFranquicia.addEventListener('click', async () => {
        const nueva = inputNuevaFranquicia.value.trim();
        if(!nueva) return window.showAlert("Escribí el nombre de la franquicia primero.", "error");

        showLoader(true, "Guardando franquicia...");
        try {
            await db.collection('metadata').doc('config').set({
                franquicias: firebase.firestore.FieldValue.arrayUnion(nueva)
            }, { merge: true });

            inputNuevaFranquicia.value = '';
            await window.cargarFranquiciasAdmin();
            window.showAlert("Franquicia guardada correctamente.", "success");
        } catch(e) {
            console.error(e);
            window.showAlert("Error técnico: " + error.message, "error");
        }
        showLoader(false);
    });
}

firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        // Apenas Firebase confirma que el usuario está logueado, descargamos todo:
        if(typeof window.cargarFranquiciasAdmin === 'function') {
            window.cargarFranquiciasAdmin();
        }
        if(typeof window.cargarEtiquetasMarketing === 'function') {
            window.cargarEtiquetasMarketing();
        }
        if(typeof window.cargarPromocionesAdmin === 'function') {
            window.cargarPromocionesAdmin();
        }
    }
});

// ==========================================
// CONEXIÓN SEGURA DE SUB-PESTAÑAS "SOLO X HOY"
// ==========================================
const conectarPestanas = () => {
    const bs1 = document.getElementById('btn-sub-buscar');
    const cg1 = document.getElementById('btn-sub-cargar');
    const bs2 = document.getElementById('btn-sub-buscar-2');
    const cg2 = document.getElementById('btn-sub-cargar-2');

    // Función directa para ir al buscador
    const abrirBuscar = () => showView('search');
    
    // Función directa para ir a la carga (limpiando formulario)
    const abrirCargar = () => { 
        isEditingId = null; 
        originalCreator = ''; 
        document.getElementById('upload-form').reset(); 
        if(dom.containerServicios) dom.containerServicios.innerHTML=''; 
        showView('upload'); 
        
        // Truco visual para que el menú superior de "Solo X Hoy" siga resaltado
        setTimeout(() => { 
            if(dom.nav.search) dom.nav.search.classList.add('active'); 
        }, 50); 
    };

    // Asignamos el clic a cada botón si existen en la pantalla
    if(bs1) bs1.onclick = abrirBuscar;
    if(bs2) bs2.onclick = abrirBuscar;
    if(cg1) cg1.onclick = abrirCargar;
    if(cg2) cg2.onclick = abrirCargar;
};
conectarPestanas();
// ==========================================
// GESTIÓN DINÁMICA DE PROMOCIONES
// ==========================================
var promocionesGlobal = [];
window.textoListonGlobal = "SOLO X HOY"; // Texto por defecto para el listón

window.cargarPromocionesAdmin = async () => {
    const contenedor = document.getElementById('lista-promos-admin');
    const filtroPromo = document.getElementById('filtro-promo');
    const uploadPromo = document.getElementById('upload-promo');
    const inputListon = document.getElementById('admin-texto-liston'); // Agregamos el input del HTML

    try {
        const doc = await db.collection('metadata').doc('config').get();
        if (doc.exists) {
            if (doc.data().tipos_promocion) promocionesGlobal = doc.data().tipos_promocion;
            if (doc.data().texto_liston) window.textoListonGlobal = doc.data().texto_liston; // Traemos el texto
        } else {
            promocionesGlobal = [
                { nombre: "Solo X Hoy", alcance: "todos" },
                { nombre: "FEED", alcance: "todos" },
                { nombre: "ADS", alcance: "todos" }
            ];
        }

        const esAdmin = userData && (userData.rol === 'admin' || userData.rol === 'editor');

        // Mostramos el texto guardado en el cajón de configuración
        if (inputListon) inputListon.value = window.textoListonGlobal;

        // 1. RENDERIZAR PANEL ADMIN
        if(contenedor) {
            contenedor.innerHTML = '';
            if(promocionesGlobal.length === 0) contenedor.innerHTML = '<span style="color: #999; font-size: 0.9em;">No hay promociones.</span>';
            promocionesGlobal.forEach((promo, index) => {
                const isCc = promo.alcance === 'casa_central';
                contenedor.innerHTML += `
                <div style="background: #f9fafb; border: 1px solid #e5e7eb; color: #11173d; padding: 5px 12px; border-radius: 20px; display: flex; align-items: center; gap: 8px; font-size: 0.85em;">
                    <b>${promo.nombre}</b>
                    <span style="background: ${isCc ? '#e74c3c' : '#2ecc71'}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7em;">
                        ${isCc ? 'Solo C. Central' : 'Todos'}
                    </span>
                    <button onclick="borrarPromoAdmin(${index})" style="background: transparent; border: none; color: #e74c3c; cursor: pointer; font-weight: bold;">×</button>
                </div>`;
            });
        }

        // 2. RENDERIZAR BUSCADOR Y CARGA
        if(filtroPromo && uploadPromo) {
            const valorFiltro = filtroPromo.value;
            const valorUpload = uploadPromo.value;
            
            filtroPromo.innerHTML = '<option value="">Todas</option>';
            uploadPromo.innerHTML = '';

            promocionesGlobal.forEach(promo => {
                // Si es secreta y NO es admin, omitimos todo (Filtro e Invisibilidad)
                if (promo.alcance === 'casa_central' && !esAdmin) return;
                
                filtroPromo.innerHTML += `<option value="${promo.nombre}">${promo.nombre}</option>`;
                
                // Opción limpia para la carga (Sin cartel de requerimiento)
                uploadPromo.innerHTML += `<option value="${promo.nombre}">${promo.nombre}</option>`;
            });

            if(valorFiltro) filtroPromo.value = valorFiltro;
            if(valorUpload) uploadPromo.value = valorUpload; // 🛡️ Esto protege la edición de paquetes
        }

        // Refrescar grilla para aplicar invisibilidad si hubo cambios
        if(typeof applyFilters === 'function') applyFilters();

    } catch(e) { console.error("Error promociones:", e); }
};

// 3. NUEVO: LÓGICA PARA GUARDAR EL LISTÓN
const btnGuardarListon = document.getElementById('btn-guardar-liston');
if(btnGuardarListon) {
    btnGuardarListon.addEventListener('click', async () => {
        const nuevoTexto = document.getElementById('admin-texto-liston').value.trim();
        if(!nuevoTexto) return window.showAlert("Escribí un texto corto para el listón.", "error");
        
        showLoader(true, "Guardando...");
        try {
            await db.collection('metadata').doc('config').set({ texto_liston: nuevoTexto }, { merge: true });
            window.textoListonGlobal = nuevoTexto; // Actualizamos la memoria
            window.showAlert("¡Texto del listón actualizado!", "success");
        } catch(e) { 
            console.error(e);
            window.showAlert("Error al guardar listón", "error"); 
        }
        showLoader(false);
    });
}

const btnNuevaPromo = document.getElementById('btn-agregar-promo');
if(btnNuevaPromo) {
    btnNuevaPromo.addEventListener('click', async () => {
        const nombre = document.getElementById('admin-promo-nombre').value.trim();
        const alcance = document.getElementById('admin-promo-alcance').value;
        if(!nombre) return window.showAlert("Completá el nombre de la promoción", "error");

        promocionesGlobal.push({ nombre, alcance });
        showLoader(true, "Guardando...");
        try {
            await db.collection('metadata').doc('config').set({ tipos_promocion: promocionesGlobal }, { merge: true });
            document.getElementById('admin-promo-nombre').value = '';
            await window.cargarPromocionesAdmin();
        } catch(e) { window.showAlert("Error", "error"); }
        showLoader(false);
    });
}

window.borrarPromoAdmin = async (index) => {
    if(!await window.showConfirm("¿Borrar esta promoción permanentemente?")) return;
    promocionesGlobal.splice(index, 1);
    showLoader(true, "Borrando...");
    try { 
        await db.collection('metadata').doc('config').update({ tipos_promocion: promocionesGlobal }); 
        await window.cargarPromocionesAdmin(); 
    } catch(e) { window.showAlert("Error", "error"); }
    showLoader(false);
};

// ==========================================
// FUNCIÓN: TOGGLE DE VISIBILIDAD RÁPIDA B2C
// ==========================================
window.toggleVisibilidad = async (id, campo, estadoActual) => {
    showLoader(true, "Actualizando visibilidad...");
    try {
        const nuevoEstado = !estadoActual;
            
        // Regla lógica cruzada: Si anclo, desoculto. Si oculto, desanclo.
        let updateData = { [campo]: nuevoEstado };
        if (nuevoEstado === true) {
            if (campo === 'reflejo_cliente') updateData.ocultar_cliente = false;
            if (campo === 'ocultar_cliente') updateData.reflejo_cliente = false;
        }

        // Actualizamos en Firebase
        await db.collection('paquetes').doc(id).update(updateData);
            
        // Cerramos el modal
        if(dom.modal) dom.modal.style.display = 'none';
            
        // Recargamos la grilla para que se actualice la base de datos local
        if(typeof fetchAndLoadPackages === 'function') await fetchAndLoadPackages();
            
        window.showAlert("Visibilidad actualizada en la web de clientes.", "success");
    } catch (e) {
        console.error("Error al actualizar visibilidad:", e);
        window.showAlert("Error de conexión al actualizar.", "error");
    }
    showLoader(false);
};

// ====================================================================
// 🌟 MÓDULO: CALENDARIO AGENTES FELICES (EL CLON PERFECTO)
// ====================================================================

// 1. Conexión del menú superior
dom.views.agentes = document.getElementById('view-agentes');
dom.nav.agentes = document.getElementById('nav-agentes');
if (dom.nav.agentes) {
    dom.nav.agentes.onclick = () => { 
        showView('agentes'); 
        if (typeof window.renderizarCalendarioAgentes === 'function') window.renderizarCalendarioAgentes(); 
    };
}

let currentDateAgentes = new Date();
let tareasAgentesGlobal = [];
let isEditingAgentesId = null;
window.vistaCalendarioAgentes = null;

// 2. El Motor de Renderizado
window.renderizarCalendarioAgentes = async () => {
    const grid = document.getElementById('grid-calendario-agentes');
    const labelMes = document.getElementById('mes-actual-label-agentes');
    if (!grid || !labelMes) return;

    if (!window.vistaCalendarioAgentes) {
        const esAdmin = userData && (userData.rol === 'admin' || userData.rol === 'editor');
        window.vistaCalendarioAgentes = esAdmin ? 'RED' : 'PROPIOS';
    }

    let toggleContainer = document.getElementById('toggle-agentes-container');
    if (!toggleContainer) {
        toggleContainer = document.createElement('div');
        toggleContainer.id = 'toggle-agentes-container';
        toggleContainer.style.cssText = 'display: flex; justify-content: flex-end; margin-bottom: 15px; width: 100%;';
        const headerDias = document.querySelector('#view-agentes .header-dias-semana');
        headerDias ? headerDias.parentNode.insertBefore(toggleContainer, headerDias) : grid.parentNode.insertBefore(toggleContainer, grid);
    }

    const isPropios = window.vistaCalendarioAgentes === 'PROPIOS';
    toggleContainer.innerHTML = `
        <div style="background: #f3f4f6; padding: 4px; border-radius: 30px; display: inline-flex; align-items: center; gap: 5px; border: 1px solid #e5e7eb;">
            <button onclick="window.cambiarVistaAgentes('PROPIOS')" style="border: none; background: ${isPropios ? 'white' : 'transparent'}; color: ${isPropios ? '#f1c40f' : '#6b7280'}; box-shadow: ${isPropios ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'}; padding: 6px 15px; border-radius: 20px; font-weight: bold; cursor: pointer; transition: 0.3s; font-size: 0.85em;">👁️ Mis Tareas</button>
            <button onclick="window.cambiarVistaAgentes('RED')" style="border: none; background: ${!isPropios ? 'white' : 'transparent'}; color: ${!isPropios ? '#1e3a8a' : '#6b7280'}; box-shadow: ${!isPropios ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'}; padding: 6px 15px; border-radius: 20px; font-weight: bold; cursor: pointer; transition: 0.3s; font-size: 0.85em;">🌐 Red FV</button>
        </div>
    `;

    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #6b7280; font-weight: bold;">Cargando tareas... ⏳</div>';

    try {
        const snapshot = await db.collection('calendario_agentes').get();
        tareasAgentesGlobal = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch(e) { console.error("Error al traer agentes:", e); }

    grid.innerHTML = '';
    const mes = currentDateAgentes.getMonth();
    const anio = currentDateAgentes.getFullYear();
    const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    labelMes.innerText = `${nombresMeses[mes]} ${anio}`;

    const primerDia = new Date(anio, mes, 1).getDay();
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();

    for (let i = 0; i < primerDia; i++) {
        const divVacio = document.createElement('div');
        divVacio.style.cssText = "background: transparent; min-height: 100px;";
        grid.appendChild(divVacio);
    }

    const hoyReal = new Date();
    const hoyPuro = new Date(hoyReal.getFullYear(), hoyReal.getMonth(), hoyReal.getDate());
    
    for (let dia = 1; dia <= diasEnMes; dia++) {
        const fechaCelda = new Date(anio, mes, dia);
        const esHoy = (fechaCelda.getTime() === hoyPuro.getTime());
        const esPasado = (fechaCelda < hoyPuro); 
        
        const divDia = document.createElement('div');
        const diaSemana = fechaCelda.getDay();
        const esFinde = (diaSemana === 0 || diaSemana === 6);
        const colorFondo = esFinde ? '#f9fafb' : 'white';
        let opacidadFinal = esPasado ? '0.4' : (esFinde ? '0.8' : '1');

        divDia.style.cssText = `background: ${colorFondo}; opacity: ${opacidadFinal}; border: 1px solid ${esHoy ? '#f1c40f' : '#e5e7eb'}; border-radius: 8px; min-height: 120px; padding: 10px; display: flex; flex-direction: column; cursor: pointer; transition: box-shadow 0.2s, transform 0.2s, opacity 0.2s; box-shadow: ${esHoy ? '0 0 0 2px rgba(241, 196, 15, 0.2)' : 'none'};`;
        
        if (esPasado) {
            divDia.onmouseover = () => { divDia.style.boxShadow = '0 4px 10px rgba(0,0,0,0.05)'; divDia.style.opacity = '0.8'; };
            divDia.onmouseout = () => { divDia.style.boxShadow = 'none'; divDia.style.opacity = '0.4'; };
        } else {
            divDia.onmouseover = () => divDia.style.boxShadow = '0 4px 10px rgba(0,0,0,0.05)';
            divDia.onmouseout = () => divDia.style.boxShadow = esHoy ? '0 0 0 2px rgba(241, 196, 15, 0.2)' : 'none';
        }

        const fechaString = `${anio}-${String(mes+1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        let tareasDelDia = tareasAgentesGlobal.filter(t => t.fecha === fechaString);

        if (window.vistaCalendarioAgentes === 'PROPIOS') {
            const miFranquicia = userData && userData.franquicia ? userData.franquicia : '';
            tareasDelDia = tareasDelDia.filter(t => t.asignado === miFranquicia || t.asignado === 'TODOS');
        }

        let htmlTareas = '';
        tareasDelDia.forEach(tarea => {
            const miFranquicia = userData && userData.franquicia ? userData.franquicia : '';
            const esParaMi = (tarea.asignado === miFranquicia || tarea.asignado === 'TODOS');
            const infoEtiqueta = etiquetasMarketingGlobal.find(e => e.nombre === tarea.tipo) || { abrev: 'AGT', color: '#6b7280' };

            const fondoTarea = esParaMi ? '#fffdf0' : '#f9fafb';
            const bordeIzquierdo = esParaMi ? '4px solid #f1c40f' : '2px solid #e5e7eb';
            const colorTextoAsignado = esParaMi ? '#7a6200' : '#6b7280';

            htmlTareas += `
                <div onclick="window.verDetalleTareaAgentes(event, '${tarea.id}')" style="background: ${fondoTarea}; border: 1px solid #e5e7eb; border-left: ${bordeIzquierdo}; border-radius: 4px; padding: 6px; margin-bottom: 5px; transition: transform 0.1s;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="background: ${infoEtiqueta.color}; color: white; padding: 2px 5px; border-radius: 4px; font-weight: bold; font-size: 0.7em;">${infoEtiqueta.abrev}</span>
                        ${esParaMi ? '<span style="font-size: 1.1em;">🔔</span>' : ''}
                    </div>
                    <div style="font-weight: 700; font-size: 0.75em; color: ${colorTextoAsignado}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Para: ${tarea.asignado}</div>
                </div>
            `;
        });

        divDia.innerHTML = `<div style="font-weight: bold; font-size: 1.1em; color: ${esHoy ? '#f1c40f' : '#11173d'}; margin-bottom: 8px;">${dia}</div><div style="flex: 1; display: flex; flex-direction: column;">${htmlTareas}</div>`;
        divDia.onclick = () => window.abrirFormularioAgentes(fechaString);
        grid.appendChild(divDia);
    }
};

window.cambiarVistaAgentes = (vista) => { window.vistaCalendarioAgentes = vista; window.renderizarCalendarioAgentes(); };

const btnAntAgt = document.getElementById('btn-mes-anterior-agentes');
if(btnAntAgt) btnAntAgt.addEventListener('click', () => { currentDateAgentes.setMonth(currentDateAgentes.getMonth() - 1); window.renderizarCalendarioAgentes(); });
const btnSigAgt = document.getElementById('btn-mes-siguiente-agentes');
if(btnSigAgt) btnSigAgt.addEventListener('click', () => { currentDateAgentes.setMonth(currentDateAgentes.getMonth() + 1); window.renderizarCalendarioAgentes(); });

// 3. Gestor de Formularios y Modales
const modalAgt = document.getElementById('modal-agentes');
const formAgt = document.getElementById('form-agentes');
const modalDetalleAgt = document.getElementById('modal-detalle-agentes');

window.abrirFormularioAgentes = async (fecha) => {
    isEditingAgentesId = null;
    if(formAgt) formAgt.reset();
    const p = fecha.split('-');
    document.getElementById('agentes-fecha-display').innerText = `${p[2]}/${p[1]}/${p[0]}`;
    document.getElementById('agentes-fecha-input').value = fecha;
    await llenarComboFranquiciasAgentes();
    modalAgt.style.display = 'flex';
};

window.editarTareaAgentesProxy = async (id) => {
    const tarea = tareasAgentesGlobal.find(t => t.id === id);
    if(tarea) {
        modalDetalleAgt.style.display = 'none';
        isEditingAgentesId = tarea.id;
        const p = tarea.fecha.split('-');
        document.getElementById('agentes-fecha-display').innerText = `${p[2]}/${p[1]}/${p[0]}`;
        document.getElementById('agentes-fecha-input').value = tarea.fecha;
        await llenarComboFranquiciasAgentes();
        document.getElementById('agentes-tipo').value = tarea.tipo || '';
        document.getElementById('agentes-asignado').value = tarea.asignado || '';
        document.getElementById('agentes-drive').value = tarea.drive || '';
        document.getElementById('agentes-notas').value = tarea.notas || '';
        modalAgt.style.display = 'flex';
    }
};

async function llenarComboFranquiciasAgentes() {
    const s = document.getElementById('agentes-asignado');
    s.innerHTML = '<option value="">Seleccionar...</option><option value="TODOS">📢 A Todas las Franquicias</option>';
    try {
        const doc = await db.collection('metadata').doc('config').get();
        if (doc.exists && doc.data().franquicias) doc.data().franquicias.forEach(f => s.innerHTML += `<option value="${f}">🏢 ${f}</option>`);
    } catch(e) {}
}

const btnCerrarAgt = document.getElementById('modal-agentes-cerrar');
if(btnCerrarAgt) btnCerrarAgt.onclick = () => modalAgt.style.display = 'none';

if(formAgt) {
    formAgt.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoader(true, "Guardando tarea...");
        let tareaOrig = isEditingAgentesId ? tareasAgentesGlobal.find(t => t.id === isEditingAgentesId) : null;
        
        const payload = {
            fecha: document.getElementById('agentes-fecha-input').value,
            tipo: document.getElementById('agentes-tipo').value,
            asignado: document.getElementById('agentes-asignado').value,
            drive: document.getElementById('agentes-drive').value,
            notas: document.getElementById('agentes-notas').value,
            creador: isEditingAgentesId && tareaOrig ? tareaOrig.creador : ((userData && userData.franquicia) ? userData.franquicia : currentUser.email),
            timestamp: isEditingAgentesId && tareaOrig ? tareaOrig.timestamp : Date.now(),
            last_edited_by: isEditingAgentesId ? currentUser.email : null
        };

        try {
            if (isEditingAgentesId) await db.collection('calendario_agentes').doc(isEditingAgentesId).update(payload);
            else await db.collection('calendario_agentes').add(payload);
            
            window.showAlert("¡Tarea Agente guardada!", "success");
            modalAgt.style.display = 'none';
            await window.renderizarCalendarioAgentes();
        } catch(err) { window.showAlert("Error al guardar", "error"); }
        showLoader(false);
    });
}

window.verDetalleTareaAgentes = (event, id) => {
    event.stopPropagation(); 
    const tarea = tareasAgentesGlobal.find(t => t.id === id);
    if(!tarea) return;

    const p = tarea.fecha.split('-');
    const eti = etiquetasMarketingGlobal.find(e => e.nombre === tarea.tipo) || { color: '#f1c40f' };
    
    document.getElementById('detalle-agentes-tipo').innerText = tarea.tipo.toUpperCase();
    document.getElementById('detalle-agentes-fecha').innerText = `${p[2]}/${p[1]}/${p[0]}`;
    document.getElementById('detalle-agentes-fecha').style.backgroundColor = eti.color;
    document.getElementById('detalle-agentes-fecha').style.color = "white";
    document.getElementById('detalle-agentes-asignado').innerText = tarea.asignado;
    document.getElementById('detalle-agentes-creador').innerText = tarea.creador;
    
    const boxDrive = document.getElementById('contenedor-detalle-drive-agentes');
    if (tarea.drive && tarea.drive.trim() !== "") {
        boxDrive.style.display = 'block';
        document.getElementById('detalle-agentes-drive').href = tarea.drive;
        document.getElementById('detalle-agentes-drive').innerText = tarea.drive;
    } else boxDrive.style.display = 'none';
    
    document.getElementById('detalle-agentes-notas').innerText = tarea.notas || 'Sin instrucciones adicionales.';

    const btnBorrar = document.getElementById('btn-borrar-agentes');
    if (userData && (userData.rol === 'admin' || userData.rol === 'editor' || currentUser.email === tarea.creador)) {
        btnBorrar.style.display = 'inline-block';
        btnBorrar.onclick = async () => {
            if(await window.showConfirm("¿Eliminar esta tarea del agente?")) {
                showLoader(true);
                try { await db.collection('calendario_agentes').doc(id).delete(); modalDetalleAgt.style.display = 'none'; await window.renderizarCalendarioAgentes(); } 
                catch(e) { window.showAlert("Error", "error"); }
                showLoader(false);
            }
        };
        // Inyectar botón editar
        let divHeader = btnBorrar.parentElement;
        if(!document.getElementById('btn-editar-agentes')) {
            const btnEdit = document.createElement('button');
            btnEdit.id = 'btn-editar-agentes';
            btnEdit.style.cssText = 'background: #f1c40f; color: #11173d; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.85em; cursor: pointer; font-weight: bold;';
            btnEdit.innerText = '✏️ Editar';
            divHeader.insertBefore(btnEdit, btnBorrar);
        }
        document.getElementById('btn-editar-agentes').onclick = () => window.editarTareaAgentesProxy(id);
    } else {
        btnBorrar.style.display = 'none';
        const oldEdit = document.getElementById('btn-editar-agentes');
        if(oldEdit) oldEdit.remove();
    }
    
    modalDetalleAgt.style.display = 'flex';
};

if(modalDetalleAgt) modalDetalleAgt.onclick = (e) => { if(e.target === modalDetalleAgt) modalDetalleAgt.style.display = 'none'; };

// 4. TRUCO DE MAGIA: Interceptamos la carga de etiquetas para que las comparta
const originalCargarEtiquetas = window.cargarEtiquetasMarketing;
window.cargarEtiquetasMarketing = async () => {
    if(typeof originalCargarEtiquetas === 'function') await originalCargarEtiquetas();
    
    const selectAg = document.getElementById('agentes-tipo');
    const leyendaAg = document.getElementById('leyenda-etiquetas-agentes');
    if(selectAg) {
        selectAg.innerHTML = '<option value="">Seleccionar...</option>';
        etiquetasMarketingGlobal.forEach(e => selectAg.innerHTML += `<option value="${e.nombre}">${e.nombre}</option>`);
    }
    if(leyendaAg) {
        leyendaAg.innerHTML = etiquetasMarketingGlobal.length === 0 ? '<span style="color:#999; font-size:0.8em;">No hay etiquetas.</span>' : '';
        etiquetasMarketingGlobal.forEach(e => {
            leyendaAg.innerHTML += `<div style="display:flex; align-items:center; gap:6px; font-size:0.85em; color:#555; background:#f9fafb; padding:4px 10px; border-radius:6px; border:1px solid #e5e7eb;"><span style="background:${e.color}; color:white; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:0.8em;">${e.abrev}</span><span style="font-weight:500;">= ${e.nombre}</span></div>`;
        });
    }
};

});
