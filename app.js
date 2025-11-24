
document.addEventListener('DOMContentLoaded', () => {

    // --- 0. CONFIGURACIÓN DE FIREBASE ---
    
    // ¡¡¡ REEMPLAZA ESTO CON EL CÓDIGO DE TU PROYECTO DE FIREBASE !!!
    const firebaseConfig = {
     apiKey: "AIzaSyCBiyH6HTatUxNxQ6GOxGp-xFWa7UfCMJk",
     authDomain: "feliz-viaje-43d02.firebaseapp.com",
     projectId: "feliz-viaje-43d02",
     storageBucket: "feliz-viaje-43d02.firebasestorage.app",
     messagingSenderId: "931689659600",
     appId: "1:931689659600:web:66dbce023705936f26b2d5",
     measurementId: "G-2PNDZR3ZS1"
    };
    
    // Inicializamos Firebase
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const provider = new firebase.auth.GoogleAuthProvider();

    // --- 1. CONFIGURACIÓN DE LA APP ---
    
    // ¡¡¡ASEGÚRATE DE QUE ESTAS SEAN TUS URLs DE PRODUCCIÓN DE n8n!!!
    const API_URL_SEARCH = 'https://n8n.srv1097024.hstgr.cloud/webhook/83cb99e2-c474-4eca-b950-5d377bcf63fa';
    const API_URL_UPLOAD = 'https://n8n.srv1097024.hstgr.cloud/webhook/TU-NUEVO-WEBHOOK-DE-CARGA'; // ¡¡DEBES CREAR ESTA!!

    // --- 1.B. LA "LISTA DE INVITADOS" (FRONTEND) ---
    const allowedEmails = [
        'email.tucuman@gmail.com',
        'email.mendoza@gmail.com',
        'email.sanjuan@gmail.com',
        'email.villamaria@gmail.com',
        'email.pilar@gmail.com',
        'email.laplata@gmail.com',
        'email.coloniacaroya@gmail.com',
        'email.arenales@gmail.com',
        'email.oliva@gmail.com',
        'tu-propio-email-admin@gmail.com' // ¡Importante!
    ];
    
    let allPackages = [];
    let currentUser = null; // Guardaremos al usuario aquí

    // Referencias a elementos del DOM
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const authError = document.getElementById('auth-error');
    const btnLogin = document.getElementById('login-button');
    const btnLogout = document.getElementById('logout-button');
    const userEmailEl = document.getElementById('user-email');
    
    // Contenedores de Vistas
    const viewSearch = document.getElementById('view-search');
    const viewUpload = document.getElementById('view-upload');
    const navSearch = document.getElementById('nav-search');
    const navUpload = document.getElementById('nav-upload');

    // Elementos de Búsqueda
    const grillaPaquetes = document.getElementById('grilla-paquetes');
    const loadingPlaceholder = document.getElementById('loading-placeholder');
    const btnBuscar = document.getElementById('boton-buscar');
    const btnLimpiar = document.getElementById('boton-limpiar');
    
    // Elementos de Carga
    const uploadForm = document.getElementById('upload-form');
    const btnSubir = document.getElementById('boton-subir');
    const uploadStatus = document.getElementById('upload-status');
    
    // Elementos del Modal
    const modalDetalle = document.getElementById('modal-detalle');
    const modalBody = document.getElementById('modal-body');
    const modalCerrar = document.getElementById('modal-cerrar');

    // --- 2. LÓGICA DE AUTENTICACIÓN (El "Guardia" del Frontend) ---

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // USUARIO AUTENTICADO
            if (allowedEmails.includes(user.email)) {
                // ¡SÍ! AUTORIZADO
                currentUser = user; // Guardamos al usuario
                loginContainer.style.display = 'none';
                appContainer.style.display = 'block';
                userEmailEl.textContent = user.email;
                await fetchPackages(); // Cargamos los paquetes iniciales
                showView('search'); // Asegurarse de empezar en la vista de búsqueda
            } else {
                // ¡NO! No está en la lista.
                authError.textContent = 'Error: No tienes permiso para acceder.';
                auth.signOut();
            }
        } else {
            // USUARIO NO LOGUEADO
            currentUser = null;
            loginContainer.style.display = 'block';
            appContainer.style.display = 'none';
        }
    });

    const login = () => {
        authError.textContent = ''; // Limpia errores
        auth.signInWithPopup(provider)
            .catch((error) => { authError.textContent = `Error: ${error.message}`; });
    };

    const logout = () => {
        auth.signOut();
    };

    // --- 3. LÓGICA DE NAVEGACIÓN DE VISTAS ---
    
    function showView(viewName) {
        if (viewName === 'search') {
            viewSearch.classList.add('active');
            viewUpload.classList.remove('active');
            navSearch.classList.add('active');
            navUpload.classList.remove('active');
        } else if (viewName === 'upload') {
            viewSearch.classList.remove('active');
            viewUpload.classList.add('active');
            navSearch.classList.remove('active');
            navUpload.classList.add('active');
        }
    }

    // --- 4. FUNCIÓN DE FETCH SEGURA (CRÍTICA) ---

    async function secureFetch(url, options) {
        if (!currentUser) {
            alert("Tu sesión ha expirado.");
            logout();
            throw new Error('Usuario no autenticado.');
        }

        const token = await currentUser.getIdToken(true); // Forzar refresco del token
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        const response = await fetch(url, { ...options, headers, cache: 'no-store' });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                alert("Error de seguridad: No tienes permiso. Serás deslogueado.");
                logout();
            }
            throw new Error(`Error de API: ${response.statusText}`);
        }
        return response.json();
    }

    // --- 5. LÓGICA DE BÚSQUEDA ---

    function parseDate(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return null;
        const parts = dateStr.split('/');
        if (parts.length !== 3) return null;
        // Asumiendo DD/MM/AAAA
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }

    async function fetchPackages() {
        loadingPlaceholder.style.display = 'block';
        grillaPaquetes.innerHTML = '';
        try {
            const data = await secureFetch(API_URL_SEARCH, {
                method: 'POST',
                body: JSON.stringify({}) // Cuerpo vacío para obtener todos
            });
            
            allPackages = data.sort((a, b) => {
                const dateA = parseDate(a['item.fecha_creacion']);
                const dateB = parseDate(b['item.fecha_creacion']);
                return (dateB || 0) - (dateA || 0); // Los más nuevos primero
            });

            renderCards(allPackages);
            
        } catch (error) {
            console.error('Error al cargar paquetes:', error);
            loadingPlaceholder.innerHTML = '<p>No se pudieron cargar los paquetes.</p>';
        }
    }

    async function filterAndRender() {
        // Obtenemos los valores de los filtros
        const filtersToSend = {
            destino: document.getElementById('filtro-destino').value,
            creador: document.getElementById('filtro-creador').value,
            tipo_promo: document.getElementById('filtro-promo').value
        };
        
        loadingPlaceholder.style.display = 'block';
        grillaPaquetes.innerHTML = '<p class="loading-placeholder">Buscando...</p>';

        try {
            const data = await secureFetch(API_URL_SEARCH, {
                method: 'POST',
                body: JSON.stringify(filtersToSend)
            });
            renderCards(data); // Renderiza solo los filtrados
        } catch (error) {
            console.error('Error al filtrar:', error);
            loadingPlaceholder.style.display = 'none';
            grillaPaquetes.innerHTML = '<p class="loading-placeholder">Error al buscar.</p>';
        }
    }
    
    // --- 6. LÓGICA DE CARGA (¡NUEVO!) ---
    
    async function handleUploadSubmit(e) {
        e.preventDefault(); // Evita que la página se recargue
        btnSubir.disabled = true;
        uploadStatus.textContent = 'Guardando...';
        uploadStatus.className = 'status-message';

        try {
            // 1. Recolectar los datos del formulario
            const newPackage = {
                destino: document.getElementById('upload-destino').value,
                salida: document.getElementById('upload-salida').value,
                fecha_salida: document.getElementById('upload-fecha-salida').value,
                costos_proveedor: document.getElementById('upload-costo').value,
                tarifa: document.getElementById('upload-tarifa').value,
                moneda: document.getElementById('upload-moneda').value,
                tipo_promo: document.getElementById('upload-promo').value,
                financiacion: document.getElementById('upload-financiacion').value,
                descripcion: document.getElementById('upload-descripcion').value
            };

            // 2. Enviar a la API de CARGA
            await secureFetch(API_URL_UPLOAD, {
                method: 'POST',
                body: JSON.stringify(newPackage)
            });

            // 3. Éxito
            uploadStatus.textContent = '¡Paquete guardado con éxito!';
            uploadStatus.className = 'status-message success';
            uploadForm.reset(); // Limpia el formulario
            
            // Opcional: recargar los paquetes en la vista de búsqueda
            fetchPackages();

        } catch (error) {
            console.error('Error al guardar:', error);
            uploadStatus.textContent = 'Error al guardar. Intenta de nuevo.';
            uploadStatus.className = 'status-message error';
        } finally {
            btnSubir.disabled = false;
        }
    }
    
    // --- 7. Event Listeners y Funciones de UI (Render) ---
    
    function renderCards(packages) {
        loadingPlaceholder.style.display = 'none';
        grillaPaquetes.innerHTML = '';

        if (packages.length === 0) {
            grillaPaquetes.innerHTML = '<p class="loading-placeholder">No se encontraron paquetes.</p>';
            return;
        }

        packages.forEach((pkg) => {
            const destino = pkg['item.destino'] || 'Destino no disponible';
            const tipoPromo = pkg['item.tipo_promo'] || 'Promo';
            const fechaSalida = pkg['item.fecha_salida'] || 'Fecha a confirmar';
            const moneda = pkg['item.moneda'] || '';
            const tarifa = pkg['item.tarifa'] || 'Consultar';

            const card = document.createElement('div');
            card.className = 'paquete-card';
            
            // Almacenamos el paquete entero como un string JSON en el dataset
            // Esto es más seguro que usar 'indexOf' si la lista se filtra
            card.dataset.packageData = JSON.stringify(pkg);

            card.innerHTML = `
                <div class="card-header"> <h3>${destino}</h3> <span class="tag-promo">${tipoPromo}</span> </div>
                <div class="card-body"> <p class="fecha-salida">Salida: ${fechaSalida}</p> </div>
                <div class="card-footer"> <p class="precio-label">Desde</p> <p class="precio-valor">${moneda} $${tarifa}</p> </div>
            `;
            grillaPaquetes.appendChild(card);
        });
    }

    function openModal(pkg) {
        if (!pkg) return; 

        // "Bien ordenada": Creamos el HTML para el detalle
        modalBody.innerHTML = `
            <div class="modal-detalle-header">
                <h2>${pkg['item.destino'] || 'Detalle del Paquete'}</h2>
            </div>
            
            <div class="modal-detalle-body">
                <div class="detalle-precios">
                    <div class="detalle-item">
                        <label>Costo Proveedor</label>
                        <p>${pkg['item.moneda'] || ''} $${pkg['item.costos_proveedor'] || 'N/A'}</p>
                    </div>
                    <div class="detalle-item tarifa-final">
                        <label>Tarifa Final</label>
                        <p>${pkg['item.moneda'] || ''} $${pkg['item.tarifa'] || 'Consultar'}</p>
                    </div>
                </div>

                <div class="detalle-item">
                    <label>Fecha de Salida</label>
                    <p>${pkg['item.fecha_salida'] || 'No especificada'}</p>
                </div>
                <div class="detalle-item">
                    <label>Salida</label>
                    <p>${pkg['item.salida'] || 'No especificada'}</p>
                </div>
                <div class="detalle-item">
                    <label>Tipo de Promoción</label>
                    <p>${pkg['item.tipo_promo'] || 'N/A'}</p>
                </div>
                <div class="detalle-item">
                    <label>Financiación</label>
                    <p>${pkg['item.financiacion'] || 'N/A'}</p>
                </div>
                <div class="detalle-item-full">
                    <label>Descripción / Itinerario</label>
                    <p>${pkg['item.descripcion'] || 'Sin descripción.'}</p>
                </div>
                <div class="detalle-item">
                    <label>Cargado por</label>
                    <p>${pkg['item.creador'] || 'N/A'}</p>
                </div>
                <div class="detalle-item">
                    <label>Fecha de Carga</label>
                    <p>${pkg['item.fecha_creacion'] || 'N/A'}</p>
                </div>
            </div>
        `;
        
        modalDetalle.style.display = 'flex';
    }

    function closeModal() {
        modalDetalle.style.display = 'none';
        modalBody.innerHTML = '';
    }

    // Listeners de Auth
    btnLogin.addEventListener('click', login);
    btnLogout.addEventListener('click', logout);
    
    // Listeners de Navegación
    navSearch.addEventListener('click', () => showView('search'));
    navUpload.addEventListener('click', () => showView('upload'));

    // Listeners de Búsqueda
    btnBuscar.addEventListener('click', filterAndRender);
    btnLimpiar.addEventListener('click', () => {
        document.getElementById('filtro-destino').value = '';
        document.getElementById('filtro-creador').value = '';
        document.getElementById('filtro-promo').value = '';
        fetchPackages(); // Carga todos de nuevo
    });

    // Listener del Modal (Delegación de eventos)
    grillaPaquetes.addEventListener('click', (e) => {
        const card = e.target.closest('.paquete-card');
        if (card) {
            // Obtenemos el paquete del dataset (más seguro)
            const pkg = JSON.parse(card.dataset.packageData);
            openModal(pkg);
        }
    });
    modalCerrar.addEventListener('click', closeModal);
    modalDetalle.addEventListener('click', (e) => {
        if (e.target === modalDetalle) {
            closeModal();
        }
    });
    
    // Listeners de Carga
    uploadForm.addEventListener('submit', handleUploadSubmit);
});