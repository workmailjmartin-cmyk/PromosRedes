document.addEventListener('DOMContentLoaded', () => {

    // 1. CONFIGURACIÓN (Tus datos)
     const firebaseConfig = {
     apiKey: "AIzaSyCBiyH6HTatUxNxQ6GOxGp-xFWa7UfCMJk",
     authDomain: "feliz-viaje-43d02.firebaseapp.com",
     projectId: "feliz-viaje-43d02",
     storageBucket: "feliz-viaje-43d02.firebasestorage.app",
     messagingSenderId: "931689659600",
     appId: "1:931689659600:web:66dbce023705936f26b2d5",
     measurementId: "G-2PNDZR3ZS1"

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const provider = new firebase.auth.GoogleAuthProvider();
    };
    const API_URL_SEARCH = 'https://n8n.srv1097024.hstgr.cloud/webhook/83cb99e2-c474-4eca-b950-5d377bcf63fa';
    const API_URL_UPLOAD = 'https://n8n.srv1097024.hstgr.cloud/webhook/6ec970d0-9da4-400f-afcc-611d3e2d82eb';
    const allowedEmails = [ /* ... PEGA TUS EMAILS ... */ ];

    // Inicialización Firebase
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const provider = new firebase.auth.GoogleAuthProvider();
    const allowedEmails = [
        'yairlaquis@gmail.com',
    ];

    // Elementos DOM Globales
    const dom = {
        // ... (login, header, nav igual que antes) ...
        viewSearch: document.getElementById('view-search'),
        viewUpload: document.getElementById('view-upload'),
        containerServicios: document.getElementById('servicios-container'),
        btnAgregarServicio: document.getElementById('btn-agregar-servicio'),
        selectorServicio: document.getElementById('selector-servicio'),
        inputFechaSalidaViaje: document.getElementById('upload-fecha-salida'),
        inputCostoTotal: document.getElementById('upload-costo-total'),
        uploadForm: document.getElementById('upload-form'),
        // ...
    };

    // --- LOGICA DE AUTENTICACION (Igual que antes) ---
    // (Copia y pega la lógica de auth.onAuthStateChanged, login, logout, secureFetch de mi respuesta anterior)
    // ...

    // =========================================================
    // NUEVA LÓGICA DE SERVICIOS DINÁMICOS
    // =========================================================

    dom.btnAgregarServicio.addEventListener('click', () => {
        const tipo = dom.selectorServicio.value;
        if (!tipo) return;
        agregarModuloServicio(tipo);
        dom.selectorServicio.value = ""; // Reset selector
    });

    function agregarModuloServicio(tipo) {
        const idUnico = Date.now(); // ID para identificar este módulo
        const div = document.createElement('div');
        div.className = `servicio-card ${tipo}`;
        div.dataset.id = idUnico;
        div.dataset.tipo = tipo;

        // HTML base según el tipo
        let htmlContenido = `<button type="button" class="btn-eliminar-servicio" onclick="this.parentElement.remove(); calcularTotal();">×</button>`;
        
        // --- 1. AÉREO ---
        if (tipo === 'aereo') {
            const fechaViaje = dom.inputFechaSalidaViaje.value || '';
            htmlContenido += `
                <h4>✈️ Aéreo</h4>
                <div class="form-group-row">
                    <div class="form-group">
                        <label>Compañía Aérea</label>
                        <input type="text" name="aerolinea" required>
                    </div>
                    <div class="form-group">
                        <label>Fecha Salida</label>
                        <input type="date" name="fecha_aereo" value="${fechaViaje}" required>
                    </div>
                </div>
                <div class="form-group-row">
                    <div class="form-group">
                        <label>Escalas</label>
                        ${crearContadorHTML('escalas', 0)}
                    </div>
                    <div class="form-group">
                        <label>Equipaje</label>
                        <select name="tipo_equipaje" onchange="mostrarContadorEquipaje(this, ${idUnico})">
                            <option value="objeto_personal">Objeto Personal (Mochila)</option>
                            <option value="carry_on">Carry On</option>
                            <option value="bodega_chico">Bodega Chico (15kg)</option>
                            <option value="bodega_grande">Bodega Grande (23kg)</option>
                        </select>
                        <div id="equipaje-cantidad-${idUnico}" style="display:none; margin-top:5px;">
                            <label style="font-size:0.8em">Cantidad:</label>
                            ${crearContadorHTML('cantidad_equipaje', 1)}
                        </div>
                    </div>
                </div>
                <div class="form-group-row">
                    <div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div>
                    <div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="calcularTotal()" required></div>
                </div>
                <div class="form-group"><label>Observaciones</label><input type="text" name="obs"></div>
            `;
        }

        // --- 2. HOTEL ---
        else if (tipo === 'hotel') {
            htmlContenido += `
                <h4>🏨 Hotel</h4>
                <div class="form-group"><label>Nombre Alojamiento</label><input type="text" name="hotel_nombre" required></div>
                <div class="form-group-row">
                    <div class="form-group"><label>Check In</label><input type="date" name="checkin" onchange="calcularNoches(${idUnico})" required></div>
                    <div class="form-group"><label>Check Out</label><input type="date" name="checkout" onchange="calcularNoches(${idUnico})" required></div>
                    <div class="form-group"><label>Noches</label><input type="text" id="noches-${idUnico}" readonly style="background:#eee; width:60px;"></div>
                </div>
                <div class="form-group">
                    <label>Régimen</label>
                    <select name="regimen">
                        <option value="Solo Habitacion">Solo Habitación</option>
                        <option value="Desayuno">Desayuno</option>
                        <option value="Media Pension">Media Pensión</option>
                        <option value="Pension Completa">Pensión Completa</option>
                        <option value="All Inclusive">All Inclusive</option>
                    </select>
                </div>
                <div class="form-group-row">
                    <div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div>
                    <div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="calcularTotal()" required></div>
                </div>
                <div class="form-group"><label>Observaciones</label><input type="text" name="obs"></div>
            `;
        }

        // --- 3. TRASLADO ---
        else if (tipo === 'traslado') {
            htmlContenido += `
                <h4>uD83DuDE90 Traslado</h4>
                <div class="checkbox-group">
                    <label class="checkbox-label"><input type="checkbox" name="trf_in"> In</label>
                    <label class="checkbox-label"><input type="checkbox" name="trf_out"> Out</label>
                    <label class="checkbox-label"><input type="checkbox" name="trf_hotel"> Hotel-Hotel</label>
                </div>
                <div class="form-group" style="margin-top:10px;">
                    <label>Tipo</label>
                    <select name="tipo_trf"><option value="Compartido">Compartido</option><option value="Privado">Privado</option></select>
                </div>
                <div class="form-group-row">
                    <div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div>
                    <div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="calcularTotal()" required></div>
                </div>
                <div class="form-group"><label>¿Otro proveedor adicional?</label><input type="text" name="proveedor_extra" placeholder="Nombre y Costo (Opcional)"></div>
            `;
        }

        // --- 4. SEGURO ---
        else if (tipo === 'seguro') {
            htmlContenido += `
                <h4>uD83DuDEE1️ Seguro Médico</h4>
                <div class="form-group-row">
                    <div class="form-group"><label>Proveedor / Cobertura</label><input type="text" name="proveedor" required></div>
                    <div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="calcularTotal()" required></div>
                </div>
            `;
        }

        // --- 5. ADICIONAL ---
        else if (tipo === 'adicional') {
            htmlContenido += `
                <h4>➕ Adicional</h4>
                <div class="form-group"><label>Descripción</label><input type="text" name="descripcion" required></div>
                <div class="form-group-row">
                    <div class="form-group"><label>Proveedor</label><input type="text" name="proveedor" required></div>
                    <div class="form-group"><label>Costo</label><input type="number" name="costo" class="input-costo" onchange="calcularTotal()" required></div>
                </div>
            `;
        }

        div.innerHTML = htmlContenido;
        dom.containerServicios.appendChild(div);
    }

    // --- Helpers para el HTML Dinámico ---

    window.crearContadorHTML = (name, valDefault) => {
        return `
            <div class="counter-wrapper">
                <button type="button" class="counter-btn" onclick="this.nextElementSibling.innerText = Math.max(0, parseInt(this.nextElementSibling.innerText) - 1)">-</button>
                <span class="counter-value" id="${name}-val">${valDefault}</span>
                <button type="button" class="counter-btn" onclick="this.previousElementSibling.innerText = parseInt(this.previousElementSibling.innerText) + 1">+</button>
                <input type="hidden" name="${name}" value="${valDefault}"> </div>
        `;
    };

    window.mostrarContadorEquipaje = (select, id) => {
        const divCant = document.getElementById(`equipaje-cantidad-${id}`);
        // Si es objeto personal, ocultamos cantidad. Si no, mostramos.
        divCant.style.display = (select.value === 'objeto_personal') ? 'none' : 'block';
    };

    window.calcularNoches = (id) => {
        const card = document.querySelector(`.servicio-card[data-id="${id}"]`);
        const inDate = new Date(card.querySelector('input[name="checkin"]').value);
        const outDate = new Date(card.querySelector('input[name="checkout"]').value);
        
        if (inDate && outDate && outDate > inDate) {
            const diffTime = Math.abs(outDate - inDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            document.getElementById(`noches-${id}`).value = diffDays;
        } else {
            document.getElementById(`noches-${id}`).value = "-";
        }
    };

    window.calcularTotal = () => {
        let total = 0;
        document.querySelectorAll('.input-costo').forEach(input => {
            total += parseFloat(input.value) || 0;
        });
        dom.inputCostoTotal.value = total;
    };

    // =========================================================
    // RECOPILAR DATOS PARA EL ENVÍO (Submit)
    // =========================================================

    dom.uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // 1. Recopilar datos generales
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
            servicios: [] // Aquí guardaremos el array de detalles
        };

        // 2. Recorrer cada tarjeta de servicio y extraer datos
        document.querySelectorAll('.servicio-card').forEach(card => {
            const tipo = card.dataset.tipo;
            const servicioData = { tipo: tipo };

            // Extraemos todos los inputs dentro de esa tarjeta
            card.querySelectorAll('input, select').forEach(input => {
                if (input.type === 'checkbox') {
                    servicioData[input.name] = input.checked;
                } else if (input.type === 'hidden') {
                    // Para los contadores, leemos el span hermano
                    const spanVal = input.parentElement.querySelector('.counter-value');
                    if (spanVal) servicioData[input.name] = spanVal.innerText;
                } else {
                    servicioData[input.name] = input.value;
                }
            });
            paqueteBase.servicios.push(servicioData);
        });

        // 3. Enviar a n8n
        // (Aquí reutilizas tu función secureFetch existente)
        try {
            // Nota: Enviaremos 'paqueteBase' como el body
            await secureFetch(API_URL_UPLOAD, {
                method: 'POST',
                body: JSON.stringify(paqueteBase)
            });
            alert('¡Paquete guardado con éxito!');
            // Resetear form...
        } catch (error) {
            console.error(error);
            alert('Error al guardar');
        }
    });

});

