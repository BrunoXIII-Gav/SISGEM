# app/constants/status.py
"""Normalización y estilos para estados de emergencia.
Separar lógica de presentación y almacenamiento.
"""

# Normalización de entradas variadas del front a estados internos (coinciden con la BD)
# Estados de la BD: 'ABIERTO', 'EN CURSO', 'CERRADO'
ESTADO_NORMALIZACION = {
    # Variantes que deben guardarse como ABIERTO
    "ACTIVA": "ABIERTO",
    "ABIERTO": "ABIERTO",
    "ABIERTA": "ABIERTO",
    # Variantes que deben guardarse como EN CURSO
    "EN CURSO": "EN CURSO",
    "CURSO": "EN CURSO",
    "EN PROGRESO": "EN CURSO",
    "PROGRESO": "EN CURSO",
    "MONITOREO": "EN CURSO",
    # Variantes que deben guardarse como CERRADO
    "CERRADA": "CERRADO",
    "CERRADO": "CERRADO",
    "ATENDIDA": "CERRADO",
    "ATENDIDO": "CERRADO",
    "CONTROLADA": "CERRADO",
}

# Estados cuyo almacenamiento implica cierre (fecha_cierre no nula)
ESTADOS_CIERRE = {"CERRADO"}

# Mapeo de presentación (texto mostrado al usuario)
ESTADO_DISPLAY = {
    "ABIERTO": "ABIERTO",
    "EN CURSO": "EN CURSO",
    "CERRADO": "CERRADO",
}

# Clases CSS para badges (background, text) y color sólido
ESTADO_STYLES = {
    # Abierto = Verde
    "ABIERTO": ("bg-green-100 text-green-700", "bg-green-600"),
    # En curso = Amarillo (se mantiene)
    "EN CURSO": ("bg-yellow-100 text-yellow-700", "bg-yellow-500"),
    # Cerrado = Gris
    "CERRADO": ("bg-gray-100 text-gray-700", "bg-gray-500"),
}

def normalizar_estado(raw: str | None) -> str | None:
    if not raw:
        return None
    clave = raw.strip().upper()
    return ESTADO_NORMALIZACION.get(clave, clave)

def estado_display(raw: str | None) -> str | None:
    if not raw:
        return None
    clave = raw.strip().upper()
    return ESTADO_DISPLAY.get(clave, clave)

