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
  const byId = new Map();

    function highlightRow(id){
      try{
        const row = document.querySelector("tr[data-id='"+id+"']");
        if(row){
          row.classList.add('row-highlight');
          row.scrollIntoView({behavior:'smooth', block:'center'});
          setTimeout(()=> row.classList.remove('row-highlight'), 1200);
        }
      }catch(e){}
    }

    markers.forEach(m => {
      if (typeof m.lat === 'number' && typeof m.lon === 'number') {
        const popup = [`<b>${m.nombre || ''}</b>`];
        if (m.distrito) popup.push(`${m.distrito}`);
        if (m.estado) popup.push(`<small>Estado: ${m.estado}</small>`);
        // Enlazar a detalle si tenemos id
        if (m.id) {
          popup.push(`<a href="/emergencias/${m.id}" class="text-blue-600 underline text-xs">Ver detalle</a>`);
        }
        const marker = L.marker([m.lat, m.lon]).addTo(group)
          .bindPopup(popup.join('<br/>'));
        if(m.id !== undefined){
          byId.set(String(m.id), marker);
        }
        marker.on('click', ()=>{
          if(m.id !== undefined){
            highlightRow(String(m.id));
          }
        });
      }
    });

    // Si hay marcadores, ajustar a sus límites; si no, vista por defecto
    if (group.getLayers().length > 0) {
      try {
        map.fitBounds(group.getBounds(), { padding: [24, 24], maxZoom: 14 });
      } catch (e) {
        map.setView(defaultCenter, defaultZoom);
      }
    } else {
      map.setView(defaultCenter, defaultZoom);
    }
    // Exponer utilidades globales para interacción con la tabla
    window._MAP_CTX = {
      map,
      group,
      byId,
      focusById: function(id){
        const mk = byId.get(String(id));
        if(mk){
          const ll = mk.getLatLng();
          map.setView(ll, Math.max(map.getZoom(), 14));
          mk.openPopup();
          // también resaltar fila
          try{ const row = document.querySelector("tr[data-id='"+id+"']"); if(row){ row.classList.add('row-highlight'); setTimeout(()=>row.classList.remove('row-highlight'),1200);} }catch(e){}
        }
      },
      fitToGroup: function(){
        if(group.getLayers().length>0){
          try{ map.fitBounds(group.getBounds(), { padding: [24,24], maxZoom: 14 }); } catch(e){}
        }
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
