// app/static/js/crear_emergencia.js
(function () {
    let map;
    let marker;
    // capa GeoJSON actual del distrito seleccionado (se comparte entre funciones)
    let distritoLayer = null;
    const defaultCenter = [-12.0464, -77.0428]; // Lima
    const defaultZoom = 11.5;

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

        // Evento de clic en el mapa para colocar/mover el marcador
        map.on('click', function(e) {
            // Click manual: colocar marcador y mostrar coordenadas en el campo
            updateMarker(e.latlng.lat, e.latlng.lng, 'Ubicación seleccionada', null);
        });
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
                        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
                            .then(r => r.json())
                                .then(data => {
                                const display = data && data.display_name ? data.display_name : null;
                                // pasar displayName sólo si existe, si no dejar null para usar coordenadas
                                placeIfInsideDistrict(lat, lng, display ? display : null);
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

    // Intenta colocar el marcador solo si está dentro del distrito seleccionado (si hay uno)
    function placeIfInsideDistrict(lat, lon, name) {
        if (!map) return;
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
                    const params = `format=json&addressdetails=1&limit=3&street=${encodeURIComponent(streetOnly + ' ' + houseNumber)}&house_number=${encodeURIComponent(houseNumber)}&city=${encodeURIComponent('Lima')}&country=${encodeURIComponent('Peru')}`;
                    fetch(`https://nominatim.openstreetmap.org/search?${params}`)
                        .then(r => r.json())
                        .then(data => {
                            if (data && data.length > 0 && data[0].address && data[0].address.house_number) {
                                const lat = parseFloat(data[0].lat);
                                const lon = parseFloat(data[0].lon);
                                const name = data[0].display_name || raw;
                                placeIfInsideDistrict(lat, lon, name);
                            } else {
                                // fallback: búsqueda general (como antes)
                                fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(raw)}`)
                                    .then(r2 => r2.json())
                                    .then(data2 => {
                                        if (data2 && data2.length > 0) {
                                            const lat = parseFloat(data2[0].lat);
                                            const lon = parseFloat(data2[0].lon);
                                            const name = data2[0].display_name || raw;
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
                            fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(raw)}`)
                                .then(r3 => r3.json())
                                .then(data3 => {
                                    if (data3 && data3.length > 0) {
                                        const lat = parseFloat(data3[0].lat);
                                        const lon = parseFloat(data3[0].lon);
                                        const name = data3[0].display_name || raw;
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
                fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(raw)}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data && data.length > 0) {
                            const lat = parseFloat(data[0].lat);
                            const lon = parseFloat(data[0].lon);
                            const name = data[0].display_name || raw;
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
            fetch(`https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&limit=1&q=${encodeURIComponent(query)}`)
                .then(response => response.json())
                .then(data => {
                    if (data && data.length > 0) {
                        const item = data[0];
                        // Si Nominatim devuelve geojson, dibujar límites
                        if (item && item.geojson) {
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
            setupSaveHandler();
        });
    } else {
        initMap();
        setupLocationButton();
        setupSearchHandlers();
        setupDistritoHandler();
        setupSaveHandler();
    }
})();
