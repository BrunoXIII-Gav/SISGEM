# app/api/auth.py
from flask import Blueprint, render_template, request, redirect, url_for, session, g, flash, request as rq
from functools import wraps
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.repositories.db import get_db
from app.models.models import UsuarioMunicipal, Emergencia
from app.constants.status import estado_display, ESTADO_STYLES, ESTADO_DISPLAY
from app.constants.geo import ALL_DISTRICTS
from app.constants.types import EMERGENCY_TYPES

auth_bp = Blueprint("auth", __name__)

def login_required(f):
    @wraps(f)
    def _wrap(*args, **kwargs):
        if not session.get("user_id"):
            return redirect(url_for("auth.login"))
        return f(*args, **kwargs)
    return _wrap

@auth_bp.before_app_request
def load_current_user():
    g.user = None
    uid = session.get("user_id")
    if uid:
        with next(get_db()) as db:
            g.user = db.get(UsuarioMunicipal, uid)

@auth_bp.after_app_request
def add_no_cache_headers(resp):
    
    if rq.endpoint and not rq.endpoint.startswith('static'):
        resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0, private'
        resp.headers['Pragma'] = 'no-cache'
        resp.headers['Expires'] = '0'
    return resp

@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    
    if session.get("user_id") and rq.method == "GET":
        return redirect(url_for("auth.inicio"))

    if rq.method == "POST":
        email = rq.form.get("email")
        password = rq.form.get("password")
        with next(get_db()) as db:
            user = db.query(UsuarioMunicipal).filter_by(email_usuario=email).first()
            if not user:
                flash("Usuario no encontrado", "error")
                return render_template("login.html")
            if user.password_usuario == password:
                session["user_id"] = user.usuario_municipal_id
                return redirect(url_for("auth.inicio"))
            flash("Credenciales inválidas", "error")
    return render_template("login.html")


@auth_bp.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("auth.login"))


@auth_bp.route("/inicio")
@login_required
def inicio():
    # Parámetros de filtro
    q = (rq.args.get('q') or '').strip()
    distrito = (rq.args.get('distrito') or '').strip()
    estado = (rq.args.get('estado') or '').strip()
    tipo = (rq.args.get('tipo') or '').strip()
    desde = (rq.args.get('desde') or '').strip()
    hasta = (rq.args.get('hasta') or '').strip()
    sort = (rq.args.get('sort') or '').strip()  # id|nombre|distrito|estado|fecha
    direction = (rq.args.get('dir') or 'desc').lower()  # asc|desc

    with next(get_db()) as db:
        # Construir consulta con filtros
        query = db.query(Emergencia)

        if q:
            if q.isdigit():
                query = query.filter(or_(Emergencia.id_emergencias == int(q),
                                         Emergencia.Nombre_emergencia.ilike(f"%{q}%")))
            else:
                query = query.filter(Emergencia.Nombre_emergencia.ilike(f"%{q}%"))

        if distrito:
            query = query.filter(Emergencia.distrito == distrito)

        if estado:
            query = query.filter(Emergencia.estado == estado)

        if tipo:
            query = query.filter(Emergencia.tipo == tipo)

        # Rango de fechas por fecha_reporte
        if desde:
            try:
                # interpretar como fecha (YYYY-MM-DD). Comparar desde 00:00:00
                query = query.filter(func.date(Emergencia.fecha_reporte) >= desde)
            except Exception:
                pass
        if hasta:
            try:
                query = query.filter(func.date(Emergencia.fecha_reporte) <= hasta)
            except Exception:
                pass

        # Ordenamiento
        sort_map = {
            'id': Emergencia.id_emergencias,
            'nombre': Emergencia.Nombre_emergencia,
            'distrito': Emergencia.distrito,
            'estado': Emergencia.estado,
            'fecha': Emergencia.fecha_reporte,
        }
        col = sort_map.get(sort or 'id', Emergencia.id_emergencias)
        if direction == 'asc':
            query = query.order_by(col.asc())
        else:
            query = query.order_by(col.desc())

        emergencias = query.all()

        # Opciones para selects (no filtradas) 
    # Opciones fijas: Distritos de Lima + Callao y tipos predefinidos
    distritos_opts = sorted(ALL_DISTRICTS)
    tipos_opts = EMERGENCY_TYPES  # dict codigo -> etiqueta

    # Se reutilizan estilos y display centralizados
    estado_map = ESTADO_STYLES

    markers = []
    for e in emergencias:
        # Mostrar en el mapa todas las emergencias que tengan coordenadas
        if e.lat is not None and e.lon is not None:
            try:
                markers.append({
                    "id": e.id_emergencias,
                    "nombre": e.Nombre_emergencia,
                    "distrito": e.distrito or "",
                    # Mostrar etiqueta amigable en el popup del mapa
                    "estado": estado_display(e.estado) or e.estado,
                    "lat": float(e.lat),
                    "lon": float(e.lon),
                })
            except Exception:
                pass

    return render_template(
        "inicio.html",
        emergencias=emergencias,
        estado_map=estado_map,
        estado_display_map=ESTADO_DISPLAY,
        markers=markers,
        filtros={
            "q": q,
            "distrito": distrito,
            "estado": estado,
            "tipo": tipo,
            "desde": desde,
            "hasta": hasta,
            "sort": sort or 'id',
            "dir": direction,
        },
        distritos_opts=distritos_opts,
        estados_opts=list(ESTADO_DISPLAY.keys()),
        tipos_opts=tipos_opts,
        total=len(emergencias)
    )
