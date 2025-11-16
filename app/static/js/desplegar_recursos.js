// desplegar_recursos.js - Manejo de selección y despliegue de recursos

let recursosSeleccionados = {
    bomberos: new Set(),
    hidrantes: new Set()
};

let recursosData = {
    bomberos: [],
    hidrantes: []
};

/**
 * Carga los recursos desde el API
 */
async function cargarRecursos(emergenciaId) {
    try {
        mostrarCargando(true);
        
        const response = await fetch(`/api/recursos/${emergenciaId}?radio=15&tipo=todos`);
        const data = await response.json();
        
        if (!data.ok) {
            throw new Error(data.error || 'Error al cargar recursos');
        }
        
        // Guardar datos de recursos
        if (data.recursos.bomberos) {
            recursosData.bomberos = data.recursos.bomberos.data;
            renderizarBomberos(recursosData.bomberos);
        }
        
        if (data.recursos.hidrantes) {
            recursosData.hidrantes = data.recursos.hidrantes.data;
            renderizarHidrantes(recursosData.hidrantes);
        }
        
        mostrarCargando(false);
        
    } catch (error) {
        console.error('Error cargando recursos:', error);
        mostrarError('Error al cargar los recursos. Por favor, intente nuevamente.');
        mostrarCargando(false);
    }
}

/**
 * Renderiza la lista de bomberos
 */
function renderizarBomberos(bomberos) {
    const contenedor = document.getElementById('lista-bomberos');
    if (!contenedor) return;
    
    contenedor.innerHTML = '';
    
    if (bomberos.length === 0) {
        contenedor.innerHTML = `
            <div class="text-center py-8 text-text-light-secondary">
                <span class="material-symbols-outlined text-4xl">local_fire_department</span>
                <p class="mt-2">No hay bomberos disponibles en el área</p>
            </div>
        `;
        return;
    }
    
    bomberos.forEach(bombero => {
        const card = crearTarjetaBombero(bombero);
        contenedor.appendChild(card);
    });
}

/**
 * Crea una tarjeta de bombero
 */
function crearTarjetaBombero(bombero) {
    const div = document.createElement('div');
    div.className = 'recurso-card flex items-center gap-3 bg-white dark:bg-gray-700 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600 cursor-pointer';
    div.dataset.tipo = 'bombero';
    div.dataset.id = bombero.idCompaniaBomberos;
    
    const estaSeleccionado = recursosSeleccionados.bomberos.has(bombero.idCompaniaBomberos);
    if (estaSeleccionado) {
        div.classList.add('selected');
    }
    
    div.innerHTML = `
        <div class="flex-shrink-0">
            <div class="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <span class="material-symbols-outlined text-secondary text-xl">local_fire_department</span>
            </div>
        </div>
        <div class="flex-grow min-w-0">
            <h3 class="font-semibold text-sm text-text-light-primary dark:text-text-dark-primary truncate">
                ${bombero.nombre}
            </h3>
            <div class="flex items-center gap-3 mt-1 text-xs text-text-light-secondary dark:text-text-dark-secondary">
                <span class="flex items-center gap-1">
                    <span class="material-symbols-outlined text-xs">person</span>
                    ${bombero.bomberos_disponibles}
                </span>
                <span class="flex items-center gap-1">
                    <span class="material-symbols-outlined text-xs">local_shipping</span>
                    ${bombero.vehiculos_disponibles}
                </span>
                <span class="flex items-center gap-1 text-secondary font-semibold">
                    <span class="material-symbols-outlined text-xs">near_me</span>
                    ${bombero.distancia_km} km
                </span>
            </div>
        </div>
        <div class="flex-shrink-0">
            <div class="w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                estaSeleccionado 
                ? 'bg-primary border-primary' 
                : 'border-gray-300 dark:border-gray-600'
            }">
                ${estaSeleccionado ? '<span class="material-symbols-outlined text-white text-sm">check</span>' : ''}
            </div>
        </div>
    `;
    
    div.addEventListener('click', () => toggleSeleccionBombero(bombero, div));
    
    return div;
}

/**
 * Renderiza la lista de hidrantes
 */
function renderizarHidrantes(hidrantes) {
    const contenedor = document.getElementById('lista-hidrantes');
    if (!contenedor) return;
    
    contenedor.innerHTML = '';
    
    if (hidrantes.length === 0) {
        contenedor.innerHTML = `
            <div class="text-center py-8 text-text-light-secondary">
                <span class="material-symbols-outlined text-4xl">water_drop</span>
                <p class="mt-2">No hay hidrantes disponibles en el área</p>
            </div>
        `;
        return;
    }
    
    hidrantes.forEach(hidrante => {
        const card = crearTarjetaHidrante(hidrante);
        contenedor.appendChild(card);
    });
}

/**
 * Crea una tarjeta de hidrante
 */
function crearTarjetaHidrante(hidrante) {
    const div = document.createElement('div');
    div.className = 'recurso-card flex items-center gap-3 bg-white dark:bg-gray-700 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600 cursor-pointer';
    div.dataset.tipo = 'hidrante';
    div.dataset.id = hidrante.ID;
    
    const estaSeleccionado = recursosSeleccionados.hidrantes.has(hidrante.ID);
    if (estaSeleccionado) {
        div.classList.add('selected');
    }
    
    const estadoColor = hidrante.estado === 'OPERATIVO' ? 'text-green-600' : 'text-red-600';
    
    div.innerHTML = `
        <div class="flex-shrink-0">
            <div class="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <span class="material-symbols-outlined text-blue-600 text-xl">water_drop</span>
            </div>
        </div>
        <div class="flex-grow min-w-0">
            <h3 class="font-semibold text-sm text-text-light-primary dark:text-text-dark-primary truncate">
                ${hidrante.nombre}
            </h3>
            <div class="flex items-center gap-3 mt-1 text-xs text-text-light-secondary dark:text-text-dark-secondary">
                <span class="${estadoColor} font-medium">
                    ${hidrante.estado}
                </span>
                <span class="flex items-center gap-1 text-blue-600 font-semibold">
                    <span class="material-symbols-outlined text-xs">near_me</span>
                    ${hidrante.distancia_km} km
                </span>
            </div>
        </div>
        <div class="flex-shrink-0">
            <div class="w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                estaSeleccionado 
                ? 'bg-primary border-primary' 
                : 'border-gray-300 dark:border-gray-600'
            }">
                ${estaSeleccionado ? '<span class="material-symbols-outlined text-white text-sm">check</span>' : ''}
            </div>
        </div>
    `;
    
    div.addEventListener('click', () => toggleSeleccionHidrante(hidrante, div));
    
    return div;
}

/**
 * Alterna la selección de un bombero
 */
function toggleSeleccionBombero(bombero, elemento) {
    const id = bombero.idCompaniaBomberos;
    
    if (recursosSeleccionados.bomberos.has(id)) {
        recursosSeleccionados.bomberos.delete(id);
        elemento.classList.remove('selected');
    } else {
        recursosSeleccionados.bomberos.add(id);
        elemento.classList.add('selected');
    }
    
    // Re-renderizar el checkbox
    const checkbox = elemento.querySelector('div:last-child > div');
    if (recursosSeleccionados.bomberos.has(id)) {
        checkbox.className = 'w-6 h-6 rounded border-2 flex items-center justify-center transition-all bg-primary border-primary';
        checkbox.innerHTML = '<span class="material-symbols-outlined text-white text-sm">check</span>';
    } else {
        checkbox.className = 'w-6 h-6 rounded border-2 flex items-center justify-center transition-all border-gray-300 dark:border-gray-600';
        checkbox.innerHTML = '';
    }
    
    actualizarContadores();
}

/**
 * Alterna la selección de un hidrante
 */
function toggleSeleccionHidrante(hidrante, elemento) {
    const id = hidrante.ID;
    
    if (recursosSeleccionados.hidrantes.has(id)) {
        recursosSeleccionados.hidrantes.delete(id);
        elemento.classList.remove('selected');
    } else {
        recursosSeleccionados.hidrantes.add(id);
        elemento.classList.add('selected');
    }
    
    // Re-renderizar el checkbox
    const checkbox = elemento.querySelector('div:last-child > div');
    if (recursosSeleccionados.hidrantes.has(id)) {
        checkbox.className = 'w-6 h-6 rounded border-2 flex items-center justify-center transition-all bg-primary border-primary';
        checkbox.innerHTML = '<span class="material-symbols-outlined text-white text-sm">check</span>';
    } else {
        checkbox.className = 'w-6 h-6 rounded border-2 flex items-center justify-center transition-all border-gray-300 dark:border-gray-600';
        checkbox.innerHTML = '';
    }
    
    actualizarContadores();
}

/**
 * Actualiza los contadores de recursos seleccionados
 */
function actualizarContadores() {
    const totalCount = document.getElementById('recursos-seleccionados-count');
    const bomberosCount = document.getElementById('count-bomberos');
    const hidrantesCount = document.getElementById('count-hidrantes');
    
    const totalBomberos = recursosSeleccionados.bomberos.size;
    const totalHidrantes = recursosSeleccionados.hidrantes.size;
    const total = totalBomberos + totalHidrantes;
    
    if (totalCount) totalCount.textContent = total;
    if (bomberosCount) bomberosCount.textContent = totalBomberos;
    if (hidrantesCount) hidrantesCount.textContent = totalHidrantes;
    
    // Habilitar/deshabilitar botón de despliegue
    const btnDesplegar = document.getElementById('btn-desplegar');
    if (btnDesplegar) {
        btnDesplegar.disabled = total === 0;
    }
}

/**
 * Selecciona todos los bomberos
 */
function seleccionarTodosBomberos() {
    recursosData.bomberos.forEach(bombero => {
        recursosSeleccionados.bomberos.add(bombero.idCompaniaBomberos);
    });
    renderizarBomberos(recursosData.bomberos);
    actualizarContadores();
}

/**
 * Selecciona todos los hidrantes
 */
function seleccionarTodosHidrantes() {
    recursosData.hidrantes.forEach(hidrante => {
        recursosSeleccionados.hidrantes.add(hidrante.ID);
    });
    renderizarHidrantes(recursosData.hidrantes);
    actualizarContadores();
}

/**
 * Maneja el envío del formulario de despliegue
 */
async function manejarDespliegue(event) {
    event.preventDefault();
    
    const emergenciaId = document.getElementById('emergencia-id')?.value;
    if (!emergenciaId) {
        mostrarError('No se encontró el ID de la emergencia');
        return;
    }
    
    const acciones = document.getElementById('acciones-realizadas')?.value.trim();
    const observaciones = document.getElementById('observaciones')?.value.trim();
    
    if (!acciones) {
        mostrarError('Debe describir las acciones a realizar');
        return;
    }
    
    if (recursosSeleccionados.bomberos.size === 0 && recursosSeleccionados.hidrantes.size === 0) {
        mostrarError('Debe seleccionar al menos un recurso para desplegar');
        return;
    }
    
    const payload = {
        emergencia_id: parseInt(emergenciaId),
        acciones: acciones,
        observaciones: observaciones,
        recursos: {
            bomberos: Array.from(recursosSeleccionados.bomberos),
            hidrantes: Array.from(recursosSeleccionados.hidrantes)
        }
    };
    
    try {
        mostrarCargandoDespliegue(true);
        
        const response = await fetch('/api/desplegar-recursos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Error al desplegar recursos');
        }
        
        // Redirigir al reporte de la emergencia
        alert('¡Recursos desplegados exitosamente!\n\n' + 
              `Total recursos: ${data.recursos_guardados.total}\n` +
              `Bomberos: ${data.recursos_guardados.bomberos}\n` +
              `Hidrantes: ${data.recursos_guardados.hidrantes}`);
        window.location.href = `/emergencias/${emergenciaId}`;
        
    } catch (error) {
        console.error('Error desplegando recursos:', error);
        mostrarError('Error al desplegar recursos: ' + error.message);
        mostrarCargandoDespliegue(false);
    }
}

/**
 * Configura el filtrado de búsqueda
 */
function configurarBusqueda() {
    const buscarBomberos = document.getElementById('buscar-bomberos');
    const buscarHidrantes = document.getElementById('buscar-hidrantes');
    
    if (buscarBomberos) {
        buscarBomberos.addEventListener('input', (e) => {
            const termino = e.target.value.toLowerCase();
            const filtrados = recursosData.bomberos.filter(b => 
                b.nombre.toLowerCase().includes(termino)
            );
            renderizarBomberos(filtrados);
        });
    }
    
    if (buscarHidrantes) {
        buscarHidrantes.addEventListener('input', (e) => {
            const termino = e.target.value.toLowerCase();
            const filtrados = recursosData.hidrantes.filter(h => 
                h.nombre.toLowerCase().includes(termino) ||
                h.NIS.includes(termino)
            );
            renderizarHidrantes(filtrados);
        });
    }
}

/**
 * Muestra u oculta el indicador de carga
 */
function mostrarCargando(mostrar) {
    // Por ahora no hay spinner general, pero se puede agregar
}

/**
 * Muestra u oculta el indicador de carga del despliegue
 */
function mostrarCargandoDespliegue(mostrar) {
    const spinner = document.getElementById('spinner-despliegue');
    const btnDesplegar = document.getElementById('btn-desplegar');
    
    if (spinner) {
        spinner.classList.toggle('hidden', !mostrar);
    }
    
    if (btnDesplegar) {
        btnDesplegar.disabled = mostrar;
    }
}

/**
 * Muestra un mensaje de error
 */
function mostrarError(mensaje) {
    alert(mensaje);
}

/**
 * Inicialización
 */
document.addEventListener('DOMContentLoaded', function() {
    const emergenciaId = document.getElementById('emergencia-id')?.value;
    
    if (emergenciaId) {
        cargarRecursos(emergenciaId);
    }
    
    // Configurar búsqueda
    configurarBusqueda();
    
    // Configurar botones de seleccionar todos
    const btnSeleccionarTodosBomberos = document.getElementById('btn-seleccionar-todos-bomberos');
    if (btnSeleccionarTodosBomberos) {
        btnSeleccionarTodosBomberos.addEventListener('click', seleccionarTodosBomberos);
    }
    
    const btnSeleccionarTodosHidrantes = document.getElementById('btn-seleccionar-todos-hidrantes');
    if (btnSeleccionarTodosHidrantes) {
        btnSeleccionarTodosHidrantes.addEventListener('click', seleccionarTodosHidrantes);
    }
    
    // Configurar formulario
    const form = document.getElementById('form-despliegue');
    if (form) {
        form.addEventListener('submit', manejarDespliegue);
    }
    
    // Inicializar contadores
    actualizarContadores();
});
