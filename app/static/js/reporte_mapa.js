// reporte_mapa.js - Inicialización del mapa de reporte

function inicializarMapaReporte(emergenciaData, recursosBomberos, recursosHidrantes) {
  const mapaDiv = document.getElementById('mapa-reporte');
  if (!mapaDiv || !emergenciaData.lat || !emergenciaData.lon) return;
  
  // Crear mapa centrado en la emergencia
  const mapa = L.map('mapa-reporte').setView([emergenciaData.lat, emergenciaData.lon], 15);
  
  // Agregar capa de OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(mapa);
  
  // Marcador personalizado para la emergencia
  const emergenciaIcon = L.divIcon({
    html: '<div style="background-color: #dc2626; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"><span class="material-symbols-outlined" style="color: white; font-size: 20px;">emergency</span></div>',
    className: 'custom-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
  
  // Agregar marcador de la emergencia
  L.marker([emergenciaData.lat, emergenciaData.lon], {icon: emergenciaIcon})
    .addTo(mapa)
    .bindPopup(`
      <div class="text-sm">
        <p class="font-bold">${emergenciaData.nombre}</p>
        <p class="text-xs text-gray-600">${emergenciaData.direccion}</p>
        <p class="text-xs text-gray-500 mt-1">${emergenciaData.distrito}</p>
      </div>
    `).openPopup();
  
  // Agregar marcadores de bomberos
  if (recursosBomberos && recursosBomberos.length > 0) {
    recursosBomberos.forEach((bombero, index) => {
      if (bombero.lat && bombero.lon) {
        const bomberoIcon = L.divIcon({
          html: '<div style="background-color: #2E7D32; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"><span class="material-symbols-outlined" style="color: white; font-size: 14px;">local_fire_department</span></div>',
          className: 'custom-marker',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
          popupAnchor: [0, -12]
        });
        
        L.marker([bombero.lat, bombero.lon], {icon: bomberoIcon})
          .addTo(mapa)
          .bindPopup(`
            <div class="text-xs">
              <p class="font-bold text-green-700">Bomberos</p>
              <p>${bombero.direccion}</p>
              <p class="text-gray-500">${bombero.distancia_recurso}</p>
            </div>
          `);
      }
    });
  }
  
  // Agregar marcadores de hidrantes (solo algunos para no saturar)
  if (recursosHidrantes && recursosHidrantes.length > 0) {
    const hidrantesLimitados = recursosHidrantes.slice(0, 10);
    hidrantesLimitados.forEach((hidrante, index) => {
      if (hidrante.lat && hidrante.lon) {
        const hidranteIcon = L.divIcon({
          html: '<div style="background-color: #2563eb; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"></div>',
          className: 'custom-marker',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
          popupAnchor: [0, -8]
        });
        
        L.marker([hidrante.lat, hidrante.lon], {icon: hidranteIcon})
          .addTo(mapa)
          .bindPopup(`
            <div class="text-xs">
              <p class="font-bold text-blue-600">Hidrante</p>
              <p>${hidrante.direccion}</p>
              <p class="text-gray-500">${hidrante.distancia_recurso}</p>
            </div>
          `);
      }
    });
  }
}
