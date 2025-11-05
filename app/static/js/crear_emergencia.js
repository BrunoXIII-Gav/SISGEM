// app/static/js/crear_emergencia.js
(function () {
    let map;
    let marker;
    // capa GeoJSON actual del distrito seleccionado (se comparte entre funciones)
    let distritoLayer = null;
    const distritoGeoCache = {}; // cache simple por nombre de distrito -> geojson
    // Capa/geo de Lima Metropolitana (provincia) para geovalla global
    let limaLayer = null;
    let limaGeo = null;
    const defaultCenter = [-12.0464, -77.0428]; // Lima
    const defaultZoom = 11.5;

    // BBOX aproximado de Lima Metropolitana (provincia de Lima)
    const LIMA_BBOX = { south: -12.50, west: -77.25, north: -11.60, east: -76.60 };

    function isInsideLimaBBox(lat, lon) {
        return lat >= LIMA_BBOX.south && lat <= LIMA_BBOX.north && lon >= LIMA_BBOX.west && lon <= LIMA_BBOX.east;
    }

    function getNominatimSearchUrl(paramsObj) {
        const u = new URL('https://nominatim.openstreetmap.org/search');
        // default params
        u.searchParams.set('format', 'json');
        u.searchParams.set('addressdetails', '1');
        u.searchParams.set('accept-language', 'es');
        u.searchParams.set('countrycodes', 'pe');
        // limitar por viewbox y bounded a Lima
        u.searchParams.set('viewbox', `${LIMA_BBOX.west},${LIMA_BBOX.north},${LIMA_BBOX.east},${LIMA_BBOX.south}`);
        u.searchParams.set('bounded', '1');
        // custom params
        Object.keys(paramsObj || {}).forEach(k => u.searchParams.set(k, paramsObj[k]));
        return u.toString();
    }

    function initMap() {
        const mapEl = document.getElementById('map');
        if (!mapEl) return;

        // Inicializar el mapa
        map = L.map(mapEl).setView(defaultCenter, defaultZoom);

        // Capa base (OSM)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        // Cargar límites de Lima Metropolitana (provincia) y dibujarlos
        fetch(getNominatimSearchUrl({ q: 'Provincia de Lima, Perú', polygon_geojson: '1', polygon_threshold: '0.001', limit: '1' }))
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data) && data.length && data[0].geojson) {
                    limaGeo = data[0].geojson;
                    limaLayer = L.geoJSON(limaGeo, {
                        style: {
                            color: '#1976D2',
                            weight: 1.5,
                            opacity: 0.8,
                            fillColor: '#90CAF9',
                            fillOpacity: 0.10
                        }
                    }).addTo(map);
                    try { map.fitBounds(limaLayer.getBounds()); } catch(e){}
                }
            })
            .catch(err => console.warn('No se pudo cargar el polígono de Lima', err));

        // Evento de clic en el mapa para colocar/mover el marcador
        map.on('click', function(e) {
            // Click manual: colocar marcador y mostrar coordenadas en el campo
            updateMarker(e.latlng.lat, e.latlng.lng, 'Ubicación seleccionada', null);
        });
    }

    // Dado un objeto de resultado de Nominatim, formatea una dirección corta (solo calle y número)
    function shortAddressFromNominatim(result, rawFallback) {
        try {
            const addr = result && result.address ? result.address : {};
            const street = addr.road || addr.pedestrian || addr.footway || addr.residential || addr.path || addr.cycleway || addr.construction || '';
            const number = addr.house_number || '';
            if (street && number) return `${street} ${number}`;
            if (street) return street;
            // Si no hay calle, intentar usar el primer segmento de display_name
            const disp = (result && result.display_name) ? result.display_name : (rawFallback || '');
            if (disp) return disp.split(',')[0].trim();
            return '';
        } catch (e) {
            const disp = (result && result.display_name) ? result.display_name : (rawFallback || '');
            return disp ? disp.split(',')[0].trim() : '';
        }
    }

    function updateMarker(lat, lng, label, displayName) {
        if (!map) return;
        if (marker) {
            marker.setLatLng([lat, lng]);
        } else {
            marker = L.marker([lat, lng]).addTo(map);
        }
        if (label) marker.bindPopup(label).openPopup();
        map.setView([lat, lng], Math.max(map.getZoom(), 13));
        // Si se pasa un displayName explícito, usarlo; si no, dejar que fillLocationFields
        // coloque las coordenadas (caso de "Coordenadas" o clic manual)
        fillLocationFields(lat, lng, displayName);
    }

    function fillLocationFields(lat, lng, displayName) {
        const latEl = document.getElementById('latitude');
        const lonEl = document.getElementById('longitude');
        const locEl = document.getElementById('location');
        if (latEl) latEl.value = Number(lat).toFixed(6);
        if (lonEl) lonEl.value = Number(lng).toFixed(6);
        if (locEl) {
            // if we have a displayName prefer it, else put coordinates
            locEl.value = displayName ? displayName : `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
        }
    }

    function setupLocationButton() {
        const locationButton = document.getElementById('btn-current-location');
        if (locationButton) {
            locationButton.addEventListener('click', function() {
                if ("geolocation" in navigator) {
                    navigator.geolocation.getCurrentPosition(function(position) {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;
                        // Intentar reverse geocoding para una etiqueta legible (opcional)
                        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&accept-language=es&lat=${lat}&lon=${lng}`)
                            .then(r => r.json())
                                .then(data => {
                                const display = data ? shortAddressFromNominatim(data, null) : null;
                                // pasar displayName corto si existe, si no dejar null para usar coordenadas
                                placeIfInsideDistrict(lat, lng, display || null);
                            })
                            .catch(() => {
                                placeIfInsideDistrict(lat, lng, 'Mi ubicación');
                            });
                    }, function(err){
                        console.error('Geolocation error', err);
                    });
                } else {
                    console.warn('Geolocation no disponible');
                }
            });
        }
    }

    function clearLocation() {
        // limpiar inputs
        const latEl = document.getElementById('latitude');
        const lonEl = document.getElementById('longitude');
        const locEl = document.getElementById('location');
        if (latEl) latEl.value = '';
        if (lonEl) lonEl.value = '';
        if (locEl) locEl.value = '';

        // remover marcador del mapa si existe
        if (map && marker) {
            try { map.removeLayer(marker); } catch (e) {}
            marker = null;
        }

        // Reencuadrar mapa a distrito o Lima o vista por defecto
        try {
            if (map) {
                if (distritoLayer && map.hasLayer(distritoLayer)) {
                    map.fitBounds(distritoLayer.getBounds());
                } else if (limaLayer) {
                    map.fitBounds(limaLayer.getBounds());
                } else {
                    map.setView(defaultCenter, defaultZoom);
                }
            }
        } catch (e) {}
    }

    function setupClearHandler() {
        const btn = document.getElementById('btn-clear-location');
        if (!btn) return;
        btn.addEventListener('click', function(e){
            e.preventDefault();
            clearLocation();
        });
    }

    // Intenta colocar el marcador solo si está dentro del distrito seleccionado (si hay uno)
    function placeIfInsideDistrict(lat, lon, name) {
        if (!map) return;
        // Primero, validar contra valla de Lima Metropolitana
        if (!isInsideLimaBBox(parseFloat(lat), parseFloat(lon))) {
            alert('La ubicación está fuera de Lima Metropolitana.');
            try { if (limaLayer) map.fitBounds(limaLayer.getBounds()); } catch(e){}
            return;
        }

        if (limaGeo) {
            try {
                const ptLima = turf.point([parseFloat(lon), parseFloat(lat)]);
                const features = (limaGeo.type === 'FeatureCollection') ? limaGeo.features : [{ type: 'Feature', geometry: limaGeo }];
                let insideLima = false;
                for (let i = 0; i < features.length; i++) {
                    if (turf.booleanPointInPolygon(ptLima, features[i])) { insideLima = true; break; }
                }
                if (!insideLima) {
                    alert('La ubicación está fuera de Lima Metropolitana.');
                    try { if (limaLayer) map.fitBounds(limaLayer.getBounds()); } catch(e){}
                    return;
                }
            } catch (e) {
                console.warn('Fallo validando polígono de Lima, usando BBOX.', e);
            }
        }

        if (distritoLayer) {
            try {
                const pt = turf.point([parseFloat(lon), parseFloat(lat)]);
                const geo = distritoLayer.toGeoJSON();
                let inside = false;
                if (geo.type === 'FeatureCollection') {
                    for (let i = 0; i < geo.features.length; i++) {
                        if (turf.booleanPointInPolygon(pt, geo.features[i])) { inside = true; break; }
                    }
                } else {
                    inside = turf.booleanPointInPolygon(pt, geo);
                }
                if (inside) {
                    // Si el name es una etiqueta genérica 'Coordenadas' o null, no pasar displayName
                    const display = (name && name !== 'Coordenadas') ? name : null;
                    updateMarker(lat, lon, name, display);
                } else {
                    alert('La ubicación está fuera del distrito seleccionado. La búsqueda no moverá el marcador fuera del distrito.');
                    try { map.fitBounds(distritoLayer.getBounds()); } catch(e){}
                }
            } catch (e) {
                console.error('Error comprobando punto en polígono', e);
                const displayFallback = (name && name !== 'Coordenadas') ? name : null;
                updateMarker(lat, lon, name, displayFallback);
            }
        } else {
            const displayFallback = (name && name !== 'Coordenadas') ? name : null;
            updateMarker(lat, lon, name, displayFallback);
        }
    }

    function handleSearch() {
        const latEl = document.getElementById('latitude');
        const lonEl = document.getElementById('longitude');
        const locEl = document.getElementById('location');
        const latVal = latEl && latEl.value ? parseFloat(latEl.value.trim()) : NaN;
        const lonVal = lonEl && lonEl.value ? parseFloat(lonEl.value.trim()) : NaN;

        // Si lat/lon válidos, usarlos
        if (!isNaN(latVal) && !isNaN(lonVal)) {
            placeIfInsideDistrict(latVal, lonVal, 'Coordenadas');
            return;
        }

        // Si campo location contiene coordenadas "lat, lon"
        const locVal = locEl ? locEl.value.trim() : '';
        if (locVal) {
            const parts = locVal.split(',').map(s => s.trim());
            if (parts.length === 2) {
                const a = parseFloat(parts[0]);
                const b = parseFloat(parts[1]);
                if (!isNaN(a) && !isNaN(b)) {
                    placeIfInsideDistrict(a, b, 'Coordenadas');
                    return;
                }
            }

            // Si no son coordenadas, intentar geocodificar como dirección con Nominatim
            // Primero intentaremos una búsqueda estructurada si detectamos un número de casa en la cadena
            (function(){
                const raw = locVal;
                // intentar detectar número de casa aproximado en la cadena (no hace falta que esté al final)
                let m = raw.match(/^(.*\S)\s+(\d+[-A-Za-z0-9]*)$/);
                if (!m) {
                    // fallback: buscar cualquier primer token numérico
                    const m2 = raw.match(/(\d+[-A-Za-z0-9\/]*)/);
                    if (m2) {
                        const idx = raw.indexOf(m2[0]);
                        m = [raw, raw.slice(0, idx).trim(), m2[0]];
                    }
                }
                if (m) {
                    const streetOnly = m[1].trim();
                    const houseNumber = m[2].trim();
                    // En Nominatim la house number suele incluirse en 'street', pero probamos varias combinaciones
                    const url = getNominatimSearchUrl({ limit: '3', street: `${streetOnly} ${houseNumber}`, house_number: houseNumber, city: 'Lima', country: 'Peru' });
                    fetch(url)
                        .then(r => r.json())
                        .then(data => {
                            if (data && data.length > 0 && data[0].address && data[0].address.house_number) {
                                const lat = parseFloat(data[0].lat);
                                const lon = parseFloat(data[0].lon);
                                const name = shortAddressFromNominatim(data[0], raw);
                                placeIfInsideDistrict(lat, lon, name);
                            } else {
                                // fallback: búsqueda general (como antes)
                                const url2 = getNominatimSearchUrl({ q: raw });
                                fetch(url2)
                                    .then(r2 => r2.json())
                                    .then(data2 => {
                                        if (data2 && data2.length > 0) {
                                            const lat = parseFloat(data2[0].lat);
                                            const lon = parseFloat(data2[0].lon);
                                            const name = shortAddressFromNominatim(data2[0], raw);
                                            placeIfInsideDistrict(lat, lon, name);
                                        } else {
                                            alert('No se encontró la dirección. Intente otra búsqueda.');
                                        }
                                    })
                                    .catch(err2 => console.error('Error en geocodificación (fallback)', err2));
                            }
                        })
                        .catch(err => {
                            console.error('Error en geocodificación estructurada', err);
                            // en caso de error, intentar búsqueda general
                            const url3 = getNominatimSearchUrl({ q: raw });
                            fetch(url3)
                                .then(r3 => r3.json())
                                .then(data3 => {
                                    if (data3 && data3.length > 0) {
                                        const lat = parseFloat(data3[0].lat);
                                        const lon = parseFloat(data3[0].lon);
                                        const name = shortAddressFromNominatim(data3[0], raw);
                                        placeIfInsideDistrict(lat, lon, name);
                                    } else {
                                        alert('No se encontró la dirección. Intente otra búsqueda.');
                                    }
                                })
                                .catch(err3 => console.error('Error en geocodificación fallback final', err3));
                        });
                    return;
                }

                // Si no hay número detectado, hacer búsqueda general (añadir addressdetails para mejor info)
                const url4 = getNominatimSearchUrl({ q: raw });
                fetch(url4)
                    .then(response => response.json())
                    .then(data => {
                        if (data && data.length > 0) {
                            const lat = parseFloat(data[0].lat);
                            const lon = parseFloat(data[0].lon);
                            const name = shortAddressFromNominatim(data[0], raw);
                            // Colocar marcador solo si está dentro del distrito (si aplica)
                            placeIfInsideDistrict(lat, lon, name);
                        } else {
                            alert('No se encontró la dirección. Intente otra búsqueda.');
                        }
                    })
                    .catch(err => {
                        console.error('Error en geocodificación', err);
                    });
            })();
        }
    }

    function setupSearchHandlers() {
        const searchBtn = document.getElementById('search-location');
        const locEl = document.getElementById('location');
        if (searchBtn) {
            searchBtn.addEventListener('click', function(e){
                e.preventDefault();
                handleSearch();
            });
        }
        if (locEl) {
            locEl.addEventListener('keydown', function(e){
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                }
            });
        }
    }

    function setupSaveHandler() {
        const btn = document.getElementById('btn-save-emergency');
        if (!btn) return;
        btn.addEventListener('click', async function(e){
            e.preventDefault();
            const nombre = (document.getElementById('emergency-name')?.value || '').trim();
            const tipo = (document.getElementById('emergency-type')?.value || '').trim();
            const estado = (document.getElementById('emergency-status')?.value || '').trim();
            const detalles = (document.getElementById('emergency-details')?.value || '').trim();
            const lat = (document.getElementById('latitude')?.value || '').trim();
            const lon = (document.getElementById('longitude')?.value || '').trim();
            const direccion = (document.getElementById('location')?.value || '').trim();
            const distrito = (document.getElementById('distrito-lima')?.value || '').trim();

            if (!nombre) { alert('El nombre es obligatorio'); return; }
            if (!distrito) { alert('Debe seleccionar un distrito de Lima Metropolitana'); return; }

            const payload = {
                nombre,
                tipo,
                estado,
                descripcion: detalles,
                lat: lat || null,
                lon: lon || null,
                direccion,
                distrito
            };

            try {
                const resp = await fetch('/api/emergencias', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await resp.json();
                if (!resp.ok || !data.ok) {
                    throw new Error(data?.error || 'No se pudo registrar');
                }
                // Habilitar botón de identificar y redirigir a la vista de identificación
                const identBtn = document.getElementById('btn-identificar');
                if (identBtn) {
                    identBtn.disabled = false;
                    identBtn.classList.remove('cursor-not-allowed');
                }
                const id = data.id;
                // Redirigir inmediatamente a Identificar Recursos con el id
                window.location.href = `/identificar-recursos/${id}`;
            } catch (err) {
                console.error(err);
                alert('Error registrando la emergencia: ' + err.message);
            }
        });
    }

    // Función para mostrar solo los límites del distrito seleccionado (sin autocompletar campos)
    function setupDistritoHandler() {
        const distritoSelect = document.getElementById('distrito-lima');
        if (!distritoSelect) return;
        distritoSelect.addEventListener('change', function() {
            const distrito = distritoSelect.value;
            if (!distrito) return;
            // remover capa previa si existe
            if (distritoLayer && map && map.hasLayer(distritoLayer)) {
                map.removeLayer(distritoLayer);
                distritoLayer = null;
            }

            // Geocodificar el distrito en Lima, Perú y solicitar la geometría (GeoJSON)
            const query = `${distrito}, Lima, Perú`;
            // Si ya está en cache, úsalo
            if (distritoGeoCache[distrito]) {
                try {
                    distritoLayer = L.geoJSON(distritoGeoCache[distrito], {
                        style: {
                            color: '#FF5722',
                            weight: 2,
                            opacity: 0.9,
                            fillColor: '#FFCCBC',
                            fillOpacity: 0.25
                        }
                    }).addTo(map);
                    map.fitBounds(distritoLayer.getBounds());
                } catch (e) {}
                return;
            }

            const url = getNominatimSearchUrl({ q: query, polygon_geojson: '1', polygon_threshold: '0.001', limit: '1' });
            fetch(url)
                .then(response => response.json())
                .then(data => {
                    if (data && data.length > 0) {
                        const item = data[0];
                        // Si Nominatim devuelve geojson, dibujar límites
                        if (item && item.geojson) {
                            distritoGeoCache[distrito] = item.geojson; // cachear
                            distritoLayer = L.geoJSON(item.geojson, {
                                style: {
                                    color: '#FF5722',
                                    weight: 2,
                                    opacity: 0.9,
                                    fillColor: '#FFCCBC',
                                    fillOpacity: 0.25
                                }
                            }).addTo(map);
                            try {
                                map.fitBounds(distritoLayer.getBounds());
                            } catch (e) {
                                // Si falla fitBounds, centrar en lat/lon
                                if (item.lat && item.lon) {
                                    map.setView([parseFloat(item.lat), parseFloat(item.lon)], 13);
                                }
                            }
                        } else if (item.lat && item.lon) {
                            // Fallback: si no hay geometría, centrar en el punto sin añadir marcador
                            map.setView([parseFloat(item.lat), parseFloat(item.lon)], 13);
                        } else {
                            alert('No se encontró la geometría del distrito.');
                        }
                    } else {
                        alert('No se encontró la ubicación del distrito.');
                    }
                })
                .catch(err => {
                    console.error('Error en geocodificación de distrito', err);
                });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initMap();
            setupLocationButton();
            setupSearchHandlers();
            setupDistritoHandler();
            setupClearHandler();
            setupSaveHandler();
        });
    } else {
        initMap();
        setupLocationButton();
        setupSearchHandlers();
        setupDistritoHandler();
        setupClearHandler();
        setupSaveHandler();
    }
})();
