// app/static/js/mapa.js
(function () {
  function init() {
    // Datos inyectados por Jinja en la página
    const markers = (window.MARKERS || []);
    const defaultCenter = [-12.0464, -77.0428]; // Lima
    const defaultZoom = 11.5;

    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    const map = L.map(mapEl).setView(defaultCenter, defaultZoom);

    // Capa base (OSM)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const group = L.featureGroup().addTo(map);

    markers.forEach(m => {
      if (typeof m.lat === 'number' && typeof m.lon === 'number') {
        L.marker([m.lat, m.lon]).addTo(group)
          .bindPopup(`<b>${m.nombre || ''}</b><br/>${m.distrito || ''}<br/><small>Estado: ${m.estado || ''}</small>`);
      }
    });

    map.setView(defaultCenter, defaultZoom);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
