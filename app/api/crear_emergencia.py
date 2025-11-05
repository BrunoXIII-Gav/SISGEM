from flask import Blueprint, render_template, request, jsonify, g
from datetime import datetime
from sqlalchemy.exc import SQLAlchemyError
from app.api.auth import login_required
from app.repositories.db import get_db
from app.models.models import Emergencia

emergencia_bp = Blueprint("emergencia", __name__)

@emergencia_bp.route("/crear-emergencia")
@login_required
def crear_emergencia():
    return render_template("crear_emer.html")


@emergencia_bp.route("/api/emergencias", methods=["POST"])
@login_required
def api_crear_emergencia():
    """Crea una nueva emergencia con timestamps automáticos.

    - fecha_reporte: ahora (UTC)
    - fecha_cierre: ahora si el estado implica cierre; en caso contrario, NULL
    """
    data = request.get_json(silent=True) or {}

    # Restricciones de ámbito: solo Lima Metropolitana
    LIMA_DISTRITOS = {
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
    # Caja aproximada que contiene Lima Metropolitana (provincia de Lima)
    # lat in [-12.5, -11.6], lon in [-77.25, -76.6]
    LIMA_BBOX = {
        "south": -12.50,
        "west": -77.25,
        "north": -11.60,
        "east": -76.60,
    }

    # Extraer y normalizar payload
    nombre = (data.get("nombre") or data.get("Nombre_emergencia") or "").strip()
    descripcion = (data.get("descripcion") or data.get("detalles") or "").strip()
    tipo = (data.get("tipo") or data.get("emergency_type") or "").strip()
    estado = (data.get("estado") or data.get("emergency_status") or "").strip()
    direccion = (data.get("direccion") or data.get("location") or "").strip()
    distrito = (data.get("distrito") or data.get("distrito_lima") or "").strip()

    # Lat/Lon pueden venir como string
    def to_float(v):
        try:
            if v is None or v == "":
                return None
            return float(v)
        except (TypeError, ValueError):
            return None

    lat = to_float(data.get("lat"))
    lon = to_float(data.get("lon"))

    # Validación mínima
    if not nombre:
        return jsonify({"ok": False, "error": "El nombre de la emergencia es obligatorio."}), 400

    # Validaciones de ámbito Lima Metropolitana
    # 1) Distrito es obligatorio y debe pertenecer a Lima Metropolitana
    if not distrito:
        return jsonify({
            "ok": False,
            "error": "Debe seleccionar un distrito de Lima Metropolitana."
        }), 400
    if distrito not in LIMA_DISTRITOS:
        return jsonify({
            "ok": False,
            "error": "Solo se permiten distritos de Lima Metropolitana."
        }), 400

    # 2) Si hay coordenadas, deben caer dentro de la caja de Lima
    if lat is not None and lon is not None:
        if not (LIMA_BBOX["south"] <= lat <= LIMA_BBOX["north"] and LIMA_BBOX["west"] <= lon <= LIMA_BBOX["east"]):
            return jsonify({
                "ok": False,
                "error": "Las coordenadas deben ubicarse dentro de Lima Metropolitana."
            }), 400

    # Timestamps automáticos
    # Normalización de estado para coincidir con ENUM de la BD ('ABIERTA','EN PROGRESO','ATENDIDA')
    estado_map = {
        "ACTIVA": "ABIERTA",
        "ABIERTA": "ABIERTA",
        "ABIERTO": "ABIERTA",
        "MONITOREO": "EN PROGRESO",
        "EN PROGRESO": "EN PROGRESO",
        "PROGRESO": "EN PROGRESO",
        "EN CURSO": "EN PROGRESO",
        "CURSO": "EN PROGRESO",
        "CONTROLADA": "ATENDIDA",  # si el front envía 'controlada', guardar como 'ATENDIDA'
        "ATENDIDA": "ATENDIDA",
        "ATENDIDO": "ATENDIDA",
        "CERRADA": "ATENDIDA",
        "CERRADO": "ATENDIDA",
    }
    estado_upper = (estado or "").strip().upper()
    estado_norm = estado_map.get(estado_upper, estado.upper() if estado else None)

    now_utc = datetime.utcnow()  # naive para compatibilidad amplia con TIMESTAMP
    estados_cierre = {"ATENDIDA"}
    fecha_cierre = now_utc if (estado_norm in estados_cierre) else None

    try:
        with next(get_db()) as db:
            e = Emergencia(
                Nombre_emergencia=nombre,
                descripcion=descripcion or None,
                tipo=tipo or None,
                estado=estado_norm or None,
                fecha_reporte=now_utc,
                fecha_cierre=fecha_cierre,
                lat=lat,
                lon=lon,
                direccion=direccion or None,
                distrito=distrito or None,
                usuario_municipal_id_usuario=(g.user.usuario_municipal_id if getattr(g, 'user', None) else None)
            )
            db.add(e)
            db.commit()
            db.refresh(e)
            return jsonify({
                "ok": True,
                "id": e.id_emergencias,
                "fecha_reporte": e.fecha_reporte.isoformat(sep=' ', timespec='seconds') if e.fecha_reporte else None,
                "fecha_cierre": e.fecha_cierre.isoformat(sep=' ', timespec='seconds') if e.fecha_cierre else None
            }), 201
    except SQLAlchemyError as ex:
        # En caso de error de BD
        return jsonify({"ok": False, "error": str(ex)}), 500


@emergencia_bp.route("/identificar-recursos/<int:emergencia_id>")
@login_required
def identificar_recursos(emergencia_id: int):
    # Vista que carga la plantilla de identificación de recursos/peligros
    # Pasamos el ID por si la plantilla/JS necesita referenciar la emergencia creada
    return render_template("Identificar recursos.html", emergencia_id=emergencia_id)
