
document.addEventListener('DOMContentLoaded', () => {

    // --- 0. CONFIGURACIÓN DE FIREBASE ---
    
   
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
    
    
    const API_URL_SEARCH = 'https://n8n.srv1097024.hstgr.cloud/webhook/83cb99e2-c474-4eca-b950-5d377bcf63fa';
    const API_URL_UPLOAD = 'https://n8n.srv1097024.hstgr.cloud/webhook/6ec970d0-9da4-400f-afcc-611d3e2d82eb'; // ¡¡DEBES CREAR ESTA!!

    // --- 1.B. LA "LISTA DE INVITADOS" (FRONTEND) ---
    const allowedEmails = [
        'yairlaquis@gmail.com',
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

    // =========================================================
    // 2. LÓGICA DE AUTENTICACIÓN (El "Guardia" del Frontend)
    // =========================================================

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
            loginContainer.style.display = 'flex';
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

    // =========================================================
    // 4. FUNCIÓN DE FETCH SEGURA (CRÍTICA)
    // =========================================================

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
        
        // Leemos como texto primero para evitar errores si la respuesta está vacía
        const text = await response.text();
        return text ? JSON.parse(text) : [];
    }

    // =========================================================
    // 5. LÓGICA DE BÚSQUEDA
    // =========================================================

    async function fetchPackages(filters = {}) {
        loadingPlaceholder.style.display = 'block';
        grillaPaquetes.innerHTML = '';
        try {
            const data = await secureFetch(API_URL_SEARCH, {
                method: 'POST',
                body: JSON.stringify(filters) // Enviamos filtros (o vacío)
            });
            
            // Ordenar por fecha de creación (dd/mm/aaaa)
            allPackages = data.sort((a, b) => {
                const da = a['fecha_creacion'] ? a['fecha_creacion'].split('/').reverse().join('') : '';
                const db = b['fecha_creacion'] ? b['fecha_creacion'].split('/').reverse().join('') : '';
                return db.localeCompare(da);
            });

            renderCards(allPackages);
            
        } catch (error) {
            console.error('Error al cargar paquetes:', error);
            loadingPlaceholder.innerHTML = '<p>No se pudieron cargar los paquetes.</p>';
        }
    }

    // Lógica del botón buscar
    btnBuscar.addEventListener('click', () => {
        const filters = {
            destino: document.getElementById('filtro-destino').value,
            creador: document.getElementById('filtro-creador').value,
            tipo_promo: document.getElementById('filtro-promo').value
        };
        fetchPackages(filters);
    });

    // Lógica del botón limpiar
    btnLimpiar.addEventListener('click', () => {
        document.getElementById('filtro-destino').value = '';
        document.getElementById('filtro-creador').value = '';
        document.getElementById('filtro-promo').value = '';
        fetchPackages({});
    });

    // =========================================================
    // 6. LÓGICA DE CARGA
    // =========================================================

    uploadForm.addEventListener('submit', async (e) => {
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
                descripcion: document.getElementById('upload-descripcion').value,
                // El 'creador' y 'fecha_creacion' se asignarán en el backend (n8n)
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
    });
    
    // =========================================================
    // 7. INTERFAZ (Render y Modal)
    // =========================================================

    function renderCards(list) {
        loadingPlaceholder.style.display = 'none';
        grillaPaquetes.innerHTML = '';

        if (!list || list.length === 0) {
            grillaPaquetes.innerHTML = '<p class="loading-placeholder">No se encontraron paquetes.</p>';
            return;
        }

        list.forEach(pkg => {
            const card = document.createElement('div');
            card.className = 'paquete-card';
            // Guardamos el paquete entero como un string JSON en el dataset
            card.dataset.packageData = JSON.stringify(pkg);

            card.innerHTML = `
                <div class="card-header">
                    <h3>${pkg['destino'] || 'Sin Destino'}</h3>
                    <span class="tag-promo">${pkg['tipo_promo'] || '-'}</span>
                </div>
                <div class="card-body">
                    <p><strong>Salida:</strong> ${pkg['fecha_salida'] || '-'}</p>
                </div>
                <div class="card-footer">
                    <p class="precio-valor">${pkg['moneda']} $${pkg['tarifa']}</p>
                </div>
            `;
            grillaPaquetes.appendChild(card);
        });
    }

    function openModal(pkg) {
        if (!pkg) return; 

        // "Bien ordenada": Creamos el HTML para el detalle
        modalBody.innerHTML = `
            <div class="modal-detalle-header">
                <h2>${pkg['destino'] || 'Detalle del Paquete'}</h2>
            </div>
            
            <div class="modal-detalle-body">
                <div class="detalle-full precio-final">
                    <label>Precio Final</label>
                    <p>${pkg['moneda']} $${pkg['tarifa']}</p>
                </div>
                <div class="detalle-item">
                    <label>Costo Proveedor</label>
                    <p>${pkg['moneda']} $${pkg['costos_proveedor']}</p>
                </div>
                <div class="detalle-item">
                    <label>Fecha Salida</label>
                    <p>${pkg['fecha_salida']}</p>
                </div>
                <div class="detalle-item">
                    <label>Lugar Salida</label>
                    <p>${pkg['salida']}</p>
                </div>
                <div class="detalle-item">
                    <label>Financiación</label>
                    <p>${pkg['financiacion']}</p>
                </div>
                <div class="detalle-full">
                    <label>Descripción / Itinerario</label>
                    <p>${pkg['descripcion']}</p>
                </div>
                <div class="detalle-item">
                    <label>Cargado Por</label>
                    <p>${pkg['creador']}</p>
                </div>
            </div>
        `;
        
        modalDetalle.style.display = 'flex';
    }

    // Listeners de Auth
    btnLogin.addEventListener('click', login);
    btnLogout.addEventListener('click', logout);
    
    // Listeners de Navegación
    navSearch.addEventListener('click', () => showView('search'));
    navUpload.addEventListener('click', () => showView('upload'));

    // Listener del Modal (Delegación de eventos)
    grillaPaquetes.addEventListener('click', (e) => {
        const card = e.target.closest('.paquete-card');
        if (card) {
            const pkg = JSON.parse(card.dataset.packageData);
            openModal(pkg);
        }
    });
    modalCerrar.addEventListener('click', () => modalDetalle.style.display = 'none');
    window.onclick = (e) => { if (e.target === modalDetalle) modalDetalle.style.display = 'none'; };
});



