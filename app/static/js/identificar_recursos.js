// identificar_recursos.js - Manejo del mapa y carga de recursos

let map = null;
let recursosMarkers = {
    bomberos: [],
    hidrantes: [],
    emergencia: null
};
let distritoLayer = null; // Capa para los límites del distrito
let distritoGeoCache = {}; // Cache de geometrías de distritos

// Configuración del mapa
const CONFIG = {
    defaultCenter: [-12.0464, -77.0428], // Lima centro
    defaultZoom: 12,
    minZoom: 10,
    maxZoom: 18,
    radioDefault: 5 // km
};

// Conjunto de distritos que pertenecen al Callao
const CALLAO_DISTRICTS = new Set([
    'Callao', 'Bellavista', 'Carmen de la Legua Reynoso', 
    'La Perla', 'La Punta', 'Ventanilla', 'Mi Perú'
]);

/**
 * Inicializa el mapa de Leaflet
 */
function initMap() {
    // Crear el mapa
    map = L.map('mapa-recursos').setView(CONFIG.defaultCenter, CONFIG.defaultZoom);
    
    // Agregar capa de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        minZoom: CONFIG.minZoom,
        maxZoom: CONFIG.maxZoom
    }).addTo(map);
    
    return map;
}

/**
 * Crea un icono personalizado para los marcadores
 */
function crearIcono(tipo, color) {
    const iconos = {
        bomberos: 'local_fire_department',
        hidrantes: 'water_drop',
        emergencia: 'emergency'
    };
    
    const html = `
        <div style="
            background-color: ${color};
            width: 36px;
            height: 36px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
        ">
            <span class="material-symbols-outlined" style="
                color: white;
                font-size: 20px;
                transform: rotate(45deg);
            ">${iconos[tipo] || 'location_on'}</span>
        </div>
    `;
    
    return L.divIcon({
        html: html,
        className: 'custom-marker',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
    });
}

/**
 * Limpia todos los marcadores del mapa
 */
function limpiarMarcadores() {
    // Limpiar bomberos
    recursosMarkers.bomberos.forEach(marker => map.removeLayer(marker));
    recursosMarkers.bomberos = [];
    
    // Limpiar hidrantes
    recursosMarkers.hidrantes.forEach(marker => map.removeLayer(marker));
    recursosMarkers.hidrantes = [];
    
    // No limpiar el marcador de emergencia
}

/**
 * Carga y dibuja los límites del distrito en el mapa
 */
async function cargarLimitesDistrito(distrito) {
    if (!distrito || !map) return;
    
    console.log(`Cargando límites del distrito: ${distrito}`);
    
    // Remover capa anterior si existe
    if (distritoLayer) {
        try {
            map.removeLayer(distritoLayer);
        } catch (e) {
            console.warn('Error removiendo capa anterior:', e);
        }
        distritoLayer = null;
    }
    
    // Si ya está en caché, usarlo
    if (distritoGeoCache[distrito]) {
        console.log(`Usando geometría de distrito desde caché: ${distrito}`);
        try {
            distritoLayer = L.geoJSON(distritoGeoCache[distrito], {
                style: {
                    color: '#FF5722',
                    weight: 3,
                    opacity: 0.9,
                    fillColor: '#FFCCBC',
                    fillOpacity: 0.15,
                    dashArray: '5, 5'
                }
            }).addTo(map);
            
            // Bind popup al límite del distrito
            distritoLayer.bindPopup(`
                <div style="font-family: 'Manrope', sans-serif;">
                    <h3 style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #FF5722;">
                        📍 Distrito: ${distrito}
                    </h3>
                    <p style="margin: 0; font-size: 12px; color: #666;">
                        Límites administrativos
                    </p>
                </div>
            `);
            
            // Ajustar vista para mostrar todo el distrito
            const bounds = distritoLayer.getBounds();
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
        } catch (e) {
            console.error('Error dibujando límites del distrito desde caché:', e);
        }
        return;
    }
    
    // Determinar provincia (Lima o Callao)
    const provincia = CALLAO_DISTRICTS.has(distrito) ? 'Callao' : 'Lima';
    const query = `${distrito}, Provincia de ${provincia}, Perú`;
    
    console.log(`Buscando geometría en Nominatim: ${query}`);
    
    // Construir URL de Nominatim con parámetros para obtener geometría
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('polygon_geojson', '1');
    url.searchParams.set('polygon_threshold', '0.001');
    url.searchParams.set('limit', '3'); // Obtener más resultados para mejor coincidencia
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', 'es');
    url.searchParams.set('countrycodes', 'pe');
    
    try {
        const response = await fetch(url.toString());
        const data = await response.json();
        
        console.log(`Nominatim respondió con ${data.length} resultados`);
        
        // Buscar el mejor resultado (que tenga geojson y sea del tipo correcto)
        let bestResult = null;
        for (const result of data) {
            if (result.geojson && result.addressdetails) {
                // Priorizar resultados que sean específicamente del distrito
                const addr = result.addressdetails;
                if (addr.suburb === distrito || addr.city_district === distrito || 
                    addr.municipality === distrito || addr.county === distrito) {
                    bestResult = result;
                    break;
                }
                // Si no hay coincidencia exacta, usar el primer resultado con geometría
                if (!bestResult) {
                    bestResult = result;
                }
            }
        }
        
        if (bestResult && bestResult.geojson) {
            const geojson = bestResult.geojson;
            console.log(`Geometría encontrada para ${distrito}:`, geojson.type);
            
            // Guardar en caché
            distritoGeoCache[distrito] = geojson;
            
            // Dibujar en el mapa
            distritoLayer = L.geoJSON(geojson, {
                style: {
                    color: '#FF5722',
                    weight: 3,
                    opacity: 0.9,
                    fillColor: '#FFCCBC',
                    fillOpacity: 0.15,
                    dashArray: '5, 5'
                }
            }).addTo(map);
            
            // Bind popup al límite del distrito
            distritoLayer.bindPopup(`
                <div style="font-family: 'Manrope', sans-serif;">
                    <h3 style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #FF5722;">
                        📍 Distrito: ${distrito}
                    </h3>
                    <p style="margin: 0; font-size: 12px; color: #666;">
                        ${provincia}, Lima
                    </p>
                </div>
            `);
            
            // Ajustar vista al distrito (pero sin zoom extremo)
            const bounds = distritoLayer.getBounds();
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
            
            console.log(`Límites del distrito ${distrito} dibujados correctamente`);
            
        } else {
            console.warn(`No se encontró la geometría para el distrito: ${distrito}`);
            // Intentar con una búsqueda alternativa más simple
            const urlAlt = new URL('https://nominatim.openstreetmap.org/search');
            urlAlt.searchParams.set('q', `${distrito}, Lima, Peru`);
            urlAlt.searchParams.set('format', 'json');
            urlAlt.searchParams.set('polygon_geojson', '1');
            urlAlt.searchParams.set('polygon_threshold', '0.005'); // Umbral más alto para geometría simplificada
            urlAlt.searchParams.set('limit', '1');
            
            const responseAlt = await fetch(urlAlt.toString());
            const dataAlt = await responseAlt.json();
            
            if (dataAlt && dataAlt.length > 0 && dataAlt[0].geojson) {
                const geojsonAlt = dataAlt[0].geojson;
                console.log(`Geometría alternativa encontrada para ${distrito}`);
                
                distritoGeoCache[distrito] = geojsonAlt;
                
                distritoLayer = L.geoJSON(geojsonAlt, {
                    style: {
                        color: '#FF5722',
                        weight: 3,
                        opacity: 0.9,
                        fillColor: '#FFCCBC',
                        fillOpacity: 0.15,
                        dashArray: '5, 5'
                    }
                }).addTo(map);
                
                distritoLayer.bindPopup(`
                    <div style="font-family: 'Manrope', sans-serif;">
                        <h3 style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #FF5722;">
                            📍 Distrito: ${distrito}
                        </h3>
                        <p style="margin: 0; font-size: 12px; color: #666;">
                            Límites aproximados
                        </p>
                    </div>
                `);
                
                const bounds = distritoLayer.getBounds();
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
            }
        }
    } catch (error) {
        console.error('Error cargando límites del distrito:', error);
    }
}

/**
 * Agrega marcador de la emergencia
 */
function agregarMarcadorEmergencia(emergencia) {
    if (recursosMarkers.emergencia) {
        map.removeLayer(recursosMarkers.emergencia);
    }
    
    const icon = crearIcono('emergencia', '#DC2626'); // Rojo
    const marker = L.marker([emergencia.lat, emergencia.lon], { icon: icon }).addTo(map);
    
    const popupContent = `
        <div style="font-family: 'Manrope', sans-serif;">
            <h3 style="font-weight: 700; font-size: 16px; margin-bottom: 8px; color: #DC2626;">
                📍 ${emergencia.nombre}
            </h3>
            <p style="margin: 4px 0;"><strong>Distrito:</strong> ${emergencia.distrito || 'No especificado'}</p>
            <p style="margin: 4px 0;"><strong>Dirección:</strong> ${emergencia.direccion || 'No especificada'}</p>
        </div>
    `;
    
    marker.bindPopup(popupContent);
    recursosMarkers.emergencia = marker;
    
    // Cargar límites del distrito si está disponible
    if (emergencia.distrito) {
        cargarLimitesDistrito(emergencia.distrito);
    } else {
        // Centrar mapa en la emergencia si no hay distrito
        map.setView([emergencia.lat, emergencia.lon], 13);
    }
}

/**
 * Agrega marcadores de bomberos al mapa
 */
function agregarMarcadoresBomberos(bomberos) {
    bomberos.forEach(bombero => {
        const icon = crearIcono('bomberos', '#2E7D32'); // Verde
        const marker = L.marker([bombero.lat, bombero.lng], { icon: icon }).addTo(map);
        
        const popupContent = `
            <div style="font-family: 'Manrope', sans-serif;">
                <h3 style="font-weight: 700; font-size: 14px; margin-bottom: 8px; color: #2E7D32;">
                    🚒 ${bombero.nombre}
                </h3>
                <p style="margin: 4px 0;"><strong>Bomberos disponibles:</strong> ${bombero.bomberos_disponibles}</p>
                <p style="margin: 4px 0;"><strong>Vehículos disponibles:</strong> ${bombero.vehiculos_disponibles}</p>
                <p style="margin: 4px 0;"><strong>Responsable:</strong> ${bombero.nombre_responsable} (${bombero.cargo_responsable})</p>
                <p style="margin: 4px 0; color: #2E7D32; font-weight: 600;">📍 Distancia: ${bombero.distancia_km} km</p>
            </div>
        `;
        
        marker.bindPopup(popupContent);
        recursosMarkers.bomberos.push(marker);
    });
}

/**
 * Agrega marcadores de hidrantes al mapa
 */
function agregarMarcadoresHidrantes(hidrantes) {
    hidrantes.forEach(hidrante => {
        const icon = crearIcono('hidrantes', '#1976D2'); // Azul
        const marker = L.marker([hidrante.lat, hidrante.lng], { icon: icon }).addTo(map);
        
        const popupContent = `
            <div style="font-family: 'Manrope', sans-serif;">
                <h3 style="font-weight: 700; font-size: 14px; margin-bottom: 8px; color: #1976D2;">
                    💧 ${hidrante.nombre}
                </h3>
                <p style="margin: 4px 0;"><strong>NIS:</strong> ${hidrante.NIS}</p>
                <p style="margin: 4px 0;"><strong>Estado:</strong> 
                    <span style="color: ${hidrante.estado === 'OPERATIVO' ? '#2E7D32' : '#DC2626'}; font-weight: 600;">
                        ${hidrante.estado}
                    </span>
                </p>
                <p style="margin: 4px 0; color: #1976D2; font-weight: 600;">📍 Distancia: ${hidrante.distancia_km} km</p>
            </div>
        `;
        
        marker.bindPopup(popupContent);
        recursosMarkers.hidrantes.push(marker);
    });
}

/**
 * Actualiza la lista de recursos en el sidebar
 */
function actualizarListaRecursos(recursos) {
    const contenedorBomberos = document.getElementById('lista-bomberos');
    const contenedorHidrantes = document.getElementById('lista-hidrantes');
    
    // Actualizar bomberos
    if (recursos.bomberos && contenedorBomberos) {
        contenedorBomberos.innerHTML = '';
        recursos.bomberos.data.slice(0, 10).forEach(bombero => {
            const elemento = crearElementoRecurso('bomberos', bombero);
            contenedorBomberos.appendChild(elemento);
        });
    }
    
    // Actualizar hidrantes
    if (recursos.hidrantes && contenedorHidrantes) {
        contenedorHidrantes.innerHTML = '';
        recursos.hidrantes.data.slice(0, 10).forEach(hidrante => {
            const elemento = crearElementoRecurso('hidrantes', hidrante);
            contenedorHidrantes.appendChild(elemento);
        });
    }
}

/**
 * Crea un elemento HTML para un recurso en la lista
 */
function crearElementoRecurso(tipo, recurso) {
    const div = document.createElement('div');
    div.className = 'flex items-center gap-4 bg-background-light dark:bg-gray-700/50 p-3 rounded-lg hover:shadow-md transition-shadow cursor-pointer';
    
    const color = tipo === 'bomberos' ? '#2E7D32' : '#1976D2';
    const icono = tipo === 'bomberos' ? 'local_fire_department' : 'water_drop';
    
    let contenido = '';
    
    if (tipo === 'bomberos') {
        contenido = `
            <div class="flex items-center justify-center rounded-lg shrink-0 size-12" style="background-color: ${color}20; color: ${color};">
                <span class="material-symbols-outlined">${icono}</span>
            </div>
            <div class="flex-grow">
                <p class="font-medium text-text-light-primary dark:text-text-dark-primary text-sm">${recurso.nombre}</p>
                <p class="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                    ${recurso.bomberos_disponibles} bomberos, ${recurso.vehiculos_disponibles} vehículos
                </p>
                <p class="text-xs font-semibold" style="color: ${color};">${recurso.distancia_km} km</p>
            </div>
        `;
    } else {
        contenido = `
            <div class="flex items-center justify-center rounded-lg shrink-0 size-12" style="background-color: ${color}20; color: ${color};">
                <span class="material-symbols-outlined">${icono}</span>
            </div>
            <div class="flex-grow">
                <p class="font-medium text-text-light-primary dark:text-text-dark-primary text-sm">${recurso.nombre}</p>
                <p class="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                    ${recurso.estado}
                </p>
                <p class="text-xs font-semibold" style="color: ${color};">${recurso.distancia_km} km</p>
            </div>
        `;
    }
    
    div.innerHTML = contenido;
    
    // Al hacer clic, centrar el mapa en ese recurso
    div.addEventListener('click', () => {
        map.setView([recurso.lat, recurso.lng], 16);
        // Encontrar y abrir el popup del marcador correspondiente
        const markers = tipo === 'bomberos' ? recursosMarkers.bomberos : recursosMarkers.hidrantes;
        const marker = markers.find(m => {
            const latlng = m.getLatLng();
            return latlng.lat === recurso.lat && latlng.lng === recurso.lng;
        });
        if (marker) {
            marker.openPopup();
        }
    });
    
    return div;
}

/**
 * Carga los recursos desde el API
 */
async function cargarRecursos(emergenciaId, radio = CONFIG.radioDefault) {
    try {
        mostrarCargando(true);
        
        const response = await fetch(`/api/recursos/${emergenciaId}?radio=${radio}&tipo=todos`);
        const data = await response.json();
        
        if (!data.ok) {
            throw new Error(data.error || 'Error al cargar recursos');
        }
        
        // Limpiar marcadores previos (excepto emergencia)
        limpiarMarcadores();
        
        // Agregar marcador de emergencia
        if (data.emergencia) {
            agregarMarcadorEmergencia(data.emergencia);
        }
        
        // Agregar marcadores de recursos
        if (data.recursos.bomberos) {
            agregarMarcadoresBomberos(data.recursos.bomberos.data);
        }
        
        if (data.recursos.hidrantes) {
            agregarMarcadoresHidrantes(data.recursos.hidrantes.data);
        }
        
        // Actualizar listas en el sidebar
        actualizarListaRecursos(data.recursos);
        
        // Actualizar contadores
        actualizarContadores(data.recursos);
        
        mostrarCargando(false);
        
    } catch (error) {
        console.error('Error cargando recursos:', error);
        mostrarError('Error al cargar los recursos. Por favor, intente nuevamente.');
        mostrarCargando(false);
    }
}

/**
 * Actualiza los contadores de recursos
 */
function actualizarContadores(recursos) {
    const contadorBomberos = document.getElementById('contador-bomberos');
    const contadorHidrantes = document.getElementById('contador-hidrantes');
    
    if (contadorBomberos && recursos.bomberos) {
        contadorBomberos.textContent = `${recursos.bomberos.total} encontrados`;
    }
    
    if (contadorHidrantes && recursos.hidrantes) {
        contadorHidrantes.textContent = `${recursos.hidrantes.total} encontrados`;
    }
}

/**
 * Muestra u oculta el indicador de carga
 */
function mostrarCargando(mostrar) {
    const spinner = document.getElementById('spinner-carga');
    if (spinner) {
        spinner.style.display = mostrar ? 'flex' : 'none';
    }
}

/**
 * Muestra un mensaje de error
 */
function mostrarError(mensaje) {
    // Implementar según tu sistema de notificaciones
    alert(mensaje);
}

/**
 * Agrega una leyenda al mapa
 */
function agregarLeyenda() {
    if (!map) return;
    
    const legend = L.control({ position: 'bottomright' });
    
    legend.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'info legend');
        div.style.cssText = `
            background: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            font-family: 'Manrope', sans-serif;
            font-size: 12px;
            line-height: 20px;
        `;
        
        div.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 8px; color: #212529;">Leyenda</div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <div style="width: 16px; height: 16px; background: #DC2626; border-radius: 50%; border: 2px solid white;"></div>
                <span>Emergencia</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <div style="width: 16px; height: 16px; background: #2E7D32; border-radius: 50%; border: 2px solid white;"></div>
                <span>Bomberos</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <div style="width: 16px; height: 16px; background: #1976D2; border-radius: 50%; border: 2px solid white;"></div>
                <span>Hidrantes</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e0e0e0;">
                <div style="width: 20px; height: 3px; background: #FF5722; border-top: 2px dashed #FF5722;"></div>
                <span>Límites del distrito</span>
            </div>
        `;
        
        return div;
    };
    
    legend.addTo(map);
}

/**
 * Inicialización cuando se carga el DOM
 */
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar mapa
    initMap();
    
    // Agregar leyenda
    agregarLeyenda();
    
    // Obtener ID de emergencia desde el DOM o URL
    const emergenciaId = document.getElementById('emergencia-id')?.value;
    
    if (emergenciaId) {
        cargarRecursos(emergenciaId);
    }
    
    // Configurar control de radio
    const radioControl = document.getElementById('radio-busqueda');
    if (radioControl) {
        radioControl.addEventListener('change', function() {
            const nuevoRadio = parseFloat(this.value);
            if (emergenciaId && nuevoRadio > 0) {
                cargarRecursos(emergenciaId, nuevoRadio);
            }
        });
    }
});
