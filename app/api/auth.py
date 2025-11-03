# app/api/auth.py
from flask import Blueprint, render_template, request, redirect, url_for, session, g, flash, request as rq
from functools import wraps
from sqlalchemy.orm import Session
from app.repositories.db import get_db
from app.models.models import UsuarioMunicipal, Emergencia

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
    with next(get_db()) as db:
        emergencias = (
            db.query(Emergencia)
              .order_by(Emergencia.id_emergencias.desc())
              .all()
        )

    estado_map = {
        "ABIERTO": ("bg-red-100 text-red-600", "bg-red-600"),
        "ABIERTA": ("bg-red-100 text-red-600", "bg-red-600"),
        "EN PROGRESO": ("bg-yellow-100 text-yellow-700", "bg-yellow-500"),
        "ATENDIDO": ("bg-green-100 text-green-700", "bg-green-600"),
        "ATENDIDA": ("bg-green-100 text-green-700", "bg-green-600"),
    }

    # Mapeo solo de presentación (UI): cómo mostrar el estado al usuario
    estado_display_map = {
        "EN PROGRESO": "EN CURSO",
        "ATENDIDA": "CERRADA",
        "ABIERTA": "ABIERTA",
        "ABIERTO": "ABIERTA",
        "ATENDIDO": "CERRADA",
    }

    def es_abierta(s):
        return bool(s) and s.upper().startswith("ABIER")

    markers = []
    for e in emergencias:
        if es_abierta(e.estado) and e.lat is not None and e.lon is not None:
            try:
                markers.append({
                    "id": e.id_emergencias,
                    "nombre": e.Nombre_emergencia,
                    "distrito": e.distrito or "",
                    # Mostrar etiqueta amigable en el popup del mapa
                    "estado": estado_display_map.get(e.estado or "", e.estado or ""),
                    "lat": float(e.lat),
                    "lon": float(e.lon),
                })
            except Exception:
                pass

    return render_template("inicio.html",
                           emergencias=emergencias,
                           estado_map=estado_map,
                           estado_display_map=estado_display_map,
                           markers=markers)
