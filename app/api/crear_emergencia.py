from flask import Blueprint, render_template, request, jsonify, g
from datetime import datetime
from sqlalchemy.exc import SQLAlchemyError
from app.api.auth import login_required
from app.repositories.db import get_db
from app.models.models import Emergencia
from app.constants.geo import ALL_DISTRICTS, LIMA_CALLAO_BBOX
from app.constants.status import ESTADOS_CIERRE, normalizar_estado

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
    - Estados válidos esperados en BD: 'ABIERTO', 'EN CURSO', 'CERRADO'
    """
    data = request.get_json(silent=True) or {}

    # Uso de listas y bounding box unificados (incluye Callao)
    LIMA_BBOX = LIMA_CALLAO_BBOX

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
    if distrito not in ALL_DISTRICTS:
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
    estado_norm = normalizar_estado(estado)
    now_utc = datetime.utcnow()
    fecha_cierre = now_utc if (estado_norm in ESTADOS_CIERRE) else None

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


@emergencia_bp.route("/desplegar-recursos/<int:emergencia_id>")
@login_required
def desplegar_recursos(emergencia_id: int):
    """Vista para seleccionar y desplegar recursos a una emergencia."""
    # Verificar que la emergencia existe
    with next(get_db()) as db:
        emergencia = db.get(Emergencia, emergencia_id)
        if not emergencia:
            return render_template("crear_emer.html", error="Emergencia no encontrada"), 404
    
    return render_template("acciones_recursos_despla.html", emergencia_id=emergencia_id)


@emergencia_bp.route("/emergencias/<int:emergencia_id>")
@login_required
def detalle_emergencia(emergencia_id: int):
    """Detalle de una emergencia específica con recursos y acciones."""
    from app.models.models import Recurso, RecursoDesplazado, Accion
    
    with next(get_db()) as db:
        e = db.get(Emergencia, emergencia_id)
        if not e:
            return render_template("reporte.html", emergencia=None), 404

        # Cargar recursos identificados
        recursos = db.query(Recurso).filter(Recurso.emergencias_id_emergencias == emergencia_id).all()
        
        # Cargar recursos desplazados
        recursos_desplazados = db.query(RecursoDesplazado).filter(
            RecursoDesplazado.emergencias_id_emergencias == emergencia_id
        ).all()
        
        # Cargar acciones realizadas
        acciones = db.query(Accion).filter(
            Accion.emergencias_id_emergencias == emergencia_id
        ).order_by(Accion.fecha_hora.desc()).all()
        
        # Separar recursos por tipo
        bomberos = [r for r in recursos if r.tipo_recurso == 'bombero']
        hidrantes = [r for r in recursos if r.tipo_recurso == 'hidrante']

        # Preparar valores de presentación
        from app.constants.status import ESTADO_DISPLAY, ESTADO_STYLES, estado_display as _disp
        estado_txt = _disp(e.estado) or (e.estado or "Sin estado")
        estilos = ESTADO_STYLES.get(e.estado or "", ("bg-gray-100 text-gray-700", "bg-gray-500"))

        ctx = {
            "emergencia": e,
            "estado_display": estado_txt,
            "estado_badge_classes": estilos[0],
            "estado_dot_class": estilos[1],
            "recursos_bomberos": bomberos,
            "recursos_hidrantes": hidrantes,
            "recursos_desplazados": recursos_desplazados,
            "acciones": acciones,
            "total_bomberos": len(bomberos),
            "total_hidrantes": len(hidrantes),
        }
        return render_template("reporte.html", **ctx)
