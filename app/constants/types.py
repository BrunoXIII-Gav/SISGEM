# app/constants/types.py
"""Tipos de emergencia disponibles en el sistema.
Se define el valor (codigo) que se almacena en BD y su etiqueta de presentación.
Mantener sincronizado con el formulario de creación.
"""

# Mapeo codigo -> etiqueta para mostrar
EMERGENCY_TYPES = {
    "incendio": "Incendio",
    "inundacion": "Inundación",
    "terremoto": "Terremoto",
    "accidente": "Accidente",
    "fuga_quimica": "Fuga Química",
    "otros": "Otros",
}
