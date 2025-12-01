# app/api/gestionar_usuarios.py
from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, g
from sqlalchemy.orm import Session, joinedload
from app.repositories.db import get_db
from app.models.models import UsuarioMunicipal, Rol
from app.api.auth import admin_required, login_required
from app.constants.roles import (
    ROLES_DEFINITION, 
    PERMISSIONS_DISPLAY, 
    ROLE_COLORS,
    ROLE_ADMIN,
    ROLE_OPERADOR,
    ROLE_VISUALIZADOR
)

gestionar_usuarios_bp = Blueprint("gestionar_usuarios", __name__, url_prefix="/admin")

@gestionar_usuarios_bp.route("/usuarios")
@admin_required
def listar_usuarios():
    """Lista todos los usuarios del sistema"""
    search = request.args.get('search', '').strip()
    
    with next(get_db()) as db:
        query = db.query(UsuarioMunicipal).options(joinedload(UsuarioMunicipal.roles))
        
        if search:
            query = query.filter(
                (UsuarioMunicipal.nombre_usuario.ilike(f"%{search}%")) |
                (UsuarioMunicipal.email_usuario.ilike(f"%{search}%")) |
                (UsuarioMunicipal.cargo.ilike(f"%{search}%"))
            )
        
        usuarios = query.order_by(UsuarioMunicipal.usuario_municipal_id.desc()).all()
        
        # Obtener todos los roles disponibles con sus usuarios cargados
        roles_disponibles = db.query(Rol).options(joinedload(Rol.usuarios)).all()
    
    return render_template(
        "admin/listar_usuarios.html",
        usuarios=usuarios,
        roles_disponibles=roles_disponibles,
        role_colors=ROLE_COLORS,
        search=search
    )


@gestionar_usuarios_bp.route("/usuarios/nuevo", methods=["GET", "POST"])
@admin_required
def crear_usuario():
    """Crea un nuevo usuario"""
    if request.method == "POST":
        dni = request.form.get("dni")
        nombre = request.form.get("nombre")
        email = request.form.get("email")
        password = request.form.get("password")
        cargo = request.form.get("cargo", "")
        roles_ids = request.form.getlist("roles")  # Lista de IDs de roles
        
        # Validaciones
        if not all([dni, nombre, email, password]):
            flash("Todos los campos obligatorios deben ser completados", "error")
            return redirect(url_for("gestionar_usuarios.crear_usuario"))
        
        try:
            dni = int(dni)
        except ValueError:
            flash("El DNI debe ser un número válido", "error")
            return redirect(url_for("gestionar_usuarios.crear_usuario"))
        
        with next(get_db()) as db:
            # Verificar si el email ya existe
            existe = db.query(UsuarioMunicipal).filter_by(email_usuario=email).first()
            if existe:
                flash("El email ya está registrado", "error")
                return redirect(url_for("gestionar_usuarios.crear_usuario"))
            
            # Crear usuario
            nuevo_usuario = UsuarioMunicipal(
                dni=dni,
                nombre_usuario=nombre,
                email_usuario=email,
                password_usuario=password,  # En producción, usar hash
                cargo=cargo,
                is_active=True,
                is_admin=False
            )
            
            # Asignar roles
            if roles_ids:
                roles = db.query(Rol).filter(Rol.id_rol.in_(roles_ids)).all()
                nuevo_usuario.roles = roles
            
            db.add(nuevo_usuario)
            db.commit()
            
            flash(f"Usuario {nombre} creado exitosamente", "success")
            return redirect(url_for("gestionar_usuarios.listar_usuarios"))
    
    # GET: Mostrar formulario
    with next(get_db()) as db:
        roles_disponibles = db.query(Rol).all()
    
    return render_template(
        "admin/crear_usuario.html",
        roles_disponibles=roles_disponibles
    )


@gestionar_usuarios_bp.route("/usuarios/<int:user_id>/editar", methods=["GET", "POST"])
@admin_required
def editar_usuario(user_id):
    """Edita un usuario existente"""
    with next(get_db()) as db:
        usuario = db.query(UsuarioMunicipal).options(
            joinedload(UsuarioMunicipal.roles)
        ).filter_by(usuario_municipal_id=user_id).first()
        if not usuario:
            flash("Usuario no encontrado", "error")
            return redirect(url_for("gestionar_usuarios.listar_usuarios"))
        
        # No permitir editar super admin
        if usuario.is_admin:
            flash("No se puede editar el usuario administrador principal", "error")
            return redirect(url_for("gestionar_usuarios.listar_usuarios"))
        
        if request.method == "POST":
            usuario.nombre_usuario = request.form.get("nombre", usuario.nombre_usuario)
            usuario.email_usuario = request.form.get("email", usuario.email_usuario)
            usuario.cargo = request.form.get("cargo", "")
            
            # Actualizar DNI si es válido
            dni_str = request.form.get("dni")
            if dni_str:
                try:
                    usuario.dni = int(dni_str)
                except ValueError:
                    flash("DNI inválido", "error")
                    return redirect(url_for("gestionar_usuarios.editar_usuario", user_id=user_id))
            
            # Cambiar password solo si se proporciona uno nuevo
            nueva_password = request.form.get("password")
            if nueva_password:
                usuario.password_usuario = nueva_password  # En producción, usar hash
            
            # Actualizar roles
            roles_ids = request.form.getlist("roles")
            if roles_ids:
                roles = db.query(Rol).filter(Rol.id_rol.in_(roles_ids)).all()
                usuario.roles = roles
            else:
                usuario.roles = []
            
            # Actualizar estado activo
            usuario.is_active = request.form.get("is_active") == "on"
            
            db.commit()
            flash(f"Usuario {usuario.nombre_usuario} actualizado exitosamente", "success")
            return redirect(url_for("gestionar_usuarios.listar_usuarios"))
        
        # GET: Mostrar formulario
        roles_disponibles = db.query(Rol).all()
        roles_actuales_ids = [r.id_rol for r in usuario.roles]
        
        return render_template(
            "admin/editar_usuario.html",
            usuario=usuario,
            roles_disponibles=roles_disponibles,
            roles_actuales_ids=roles_actuales_ids
        )


@gestionar_usuarios_bp.route("/usuarios/<int:user_id>/eliminar", methods=["POST"])
@admin_required
def eliminar_usuario(user_id):
    """Elimina (desactiva) un usuario"""
    with next(get_db()) as db:
        usuario = db.get(UsuarioMunicipal, user_id)
        if not usuario:
            flash("Usuario no encontrado", "error")
            return redirect(url_for("gestionar_usuarios.listar_usuarios"))
        
        # No permitir eliminar super admin
        if usuario.is_admin:
            flash("No se puede eliminar el usuario administrador principal", "error")
            return redirect(url_for("gestionar_usuarios.listar_usuarios"))
        
        # No permitir que se elimine a sí mismo
        if usuario.usuario_municipal_id == g.user.usuario_municipal_id:
            flash("No puedes eliminar tu propia cuenta", "error")
            return redirect(url_for("gestionar_usuarios.listar_usuarios"))
        
        # En lugar de eliminar, desactivar
        usuario.is_active = False
        db.commit()
        
        flash(f"Usuario {usuario.nombre_usuario} desactivado exitosamente", "success")
        return redirect(url_for("gestionar_usuarios.listar_usuarios"))


@gestionar_usuarios_bp.route("/usuarios/<int:user_id>/activar", methods=["POST"])
@admin_required
def activar_usuario(user_id):
    """Reactiva un usuario desactivado"""
    with next(get_db()) as db:
        usuario = db.get(UsuarioMunicipal, user_id)
        if not usuario:
            flash("Usuario no encontrado", "error")
            return redirect(url_for("gestionar_usuarios.listar_usuarios"))
        
        usuario.is_active = True
        db.commit()
        
        flash(f"Usuario {usuario.nombre_usuario} activado exitosamente", "success")
        return redirect(url_for("gestionar_usuarios.listar_usuarios"))


@gestionar_usuarios_bp.route("/roles")
@admin_required
def listar_roles():
    """Lista todos los roles disponibles"""
    with next(get_db()) as db:
        roles = db.query(Rol).options(joinedload(Rol.usuarios)).all()
    
    return render_template(
        "admin/listar_roles.html",
        roles=roles,
        permissions_display=PERMISSIONS_DISPLAY,
        role_colors=ROLE_COLORS
    )
