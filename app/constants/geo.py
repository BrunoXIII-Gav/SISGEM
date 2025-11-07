# app/constants/geo.py
# Listas y límites geográficos comunes para Lima Metropolitana (Provincia de Lima + Callao)

# Distritos de la Provincia de Lima (43)
LIMA_DISTRICTS = {
    "Ancón", "Ate", "Barranco", "Breña", "Carabayllo", "Chaclacayo", "Chorrillos",
    "Cieneguilla", "Comas", "El Agustino", "Independencia", "Jesús María", "La Molina",
    "La Victoria", "Lima", "Lince", "Los Olivos", "Lurigancho", "Lurín", "Magdalena del Mar",
    "Miraflores", "Pachacámac", "Pucusana", "Pueblo Libre", "Puente Piedra", "Punta Hermosa",
    "Punta Negra", "Rímac", "San Bartolo", "San Borja", "San Isidro",
    "San Juan de Lurigancho", "San Juan de Miraflores", "San Luis",
    "San Martín de Porres", "San Miguel", "Santa Anita", "Santa María del Mar",
    "Santa Rosa", "Santiago de Surco", "Surquillo", "Villa El Salvador",
    "Villa María del Triunfo"
}

# Distritos de la Provincia Constitucional del Callao (7)
CALLAO_DISTRICTS = {
    "Callao", "Bellavista", "Carmen de la Legua Reynoso", "La Perla", "La Punta", "Ventanilla", "Mi Perú"
}

# Conjunto total de distritos del área metropolitana
ALL_DISTRICTS = LIMA_DISTRICTS | CALLAO_DISTRICTS

# BBOX que cubre Lima + Callao (coincidir con frontend)
LIMA_CALLAO_BBOX = {
    "south": -12.60,
    "west": -77.35,
    "north": -11.50,
    "east": -76.25,
}
