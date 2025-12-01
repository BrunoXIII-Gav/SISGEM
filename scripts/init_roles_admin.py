# scripts/init_roles_admin.py
"""
Script para inicializar roles base y crear usuario administrador inicial
Ejecutar DESPUÉS de crear las tablas en la base de datos
"""
import sys
import os
from pathlib import Path

# Agregar el directorio raíz al path
root_dir = Path(__file__).parent.parent
sys.path.insert(0, str(root_dir))

from dotenv import load_dotenv
load_dotenv()

from app.repositories.db import SessionLocal, engine, Base
from app.models.models import UsuarioMunicipal, Rol
from app.constants.roles import ROLES_DEFINITION

def init_roles():
    """Crea los roles base del sistema si no existen"""
    db = SessionLocal()
    try:
        print("🔧 Inicializando roles del sistema...")
        
        for rol_nombre, rol_config in ROLES_DEFINITION.items():
            # Verificar si el rol ya existe
            rol_existente = db.query(Rol).filter_by(nombre_rol=rol_nombre).first()
            
            if not rol_existente:
                nuevo_rol = Rol(
                    nombre_rol=rol_nombre,
                    descripcion=rol_config['descripcion'],
                    **rol_config['permisos']  # Desempaquetar permisos
                )
                db.add(nuevo_rol)
                print(f"  ✅ Rol '{rol_nombre}' creado")
            else:
                print(f"  ℹ️  Rol '{rol_nombre}' ya existe")
        
        db.commit()
        print("✅ Roles inicializados correctamente\n")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error al inicializar roles: {e}")
        raise
    finally:
        db.close()


def init_admin_user():
    """Crea el usuario administrador inicial si no existe"""
    db = SessionLocal()
    try:
        print("🔧 Inicializando usuario administrador...")
        
        # Verificar si ya existe un administrador
        admin_existente = db.query(UsuarioMunicipal).filter_by(is_admin=True).first()
        
        if admin_existente:
            print(f"  ℹ️  Ya existe un usuario administrador: {admin_existente.email_usuario}")
            return
        
        # Obtener el rol ADMIN
        rol_admin = db.query(Rol).filter_by(nombre_rol='ADMIN').first()
        if not rol_admin:
            print("  ⚠️  Advertencia: Rol ADMIN no encontrado. Ejecuta init_roles() primero.")
        
        # Crear usuario administrador
        admin = UsuarioMunicipal(
            dni=12345678,  # DNI por defecto
            nombre_usuario="Administrador del Sistema",
            email_usuario="admin@sisgem.pe",
            password_usuario="admin123",  # CAMBIAR EN PRODUCCIÓN
            cargo="Administrador",
            is_active=True,
            is_admin=True  # Super admin
        )
        
        # Asignar rol ADMIN
        if rol_admin:
            admin.roles = [rol_admin]
        
        db.add(admin)
        db.commit()
        
        print("  ✅ Usuario administrador creado exitosamente")
        print(f"     Email: admin@sisgem.pe")
        print(f"     Password: admin123")
        print("     ⚠️  IMPORTANTE: Cambia esta contraseña después del primer inicio de sesión\n")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error al crear usuario administrador: {e}")
        raise
    finally:
        db.close()


def create_tables():
    """Crea todas las tablas en la base de datos"""
    print("🔧 Creando tablas en la base de datos...")
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Tablas creadas correctamente\n")
    except Exception as e:
        print(f"❌ Error al crear tablas: {e}")
        raise


def main():
    """Función principal"""
    print("="*60)
    print("🚀 INICIALIZACIÓN DEL SISTEMA DE ROLES Y USUARIOS")
    print("="*60 + "\n")
    
    try:
        # Paso 1: Crear tablas
        create_tables()
        
        # Paso 2: Inicializar roles
        init_roles()
        
        # Paso 3: Crear usuario administrador
        init_admin_user()
        
        print("="*60)
        print("✅ INICIALIZACIÓN COMPLETADA EXITOSAMENTE")
        print("="*60)
        print("\n📝 Próximos pasos:")
        print("1. Inicia la aplicación Flask")
        print("2. Inicia sesión con admin@sisgem.pe / admin123")
        print("3. Cambia la contraseña del administrador")
        print("4. Crea usuarios adicionales desde /admin/usuarios")
        print()
        
    except Exception as e:
        print("\n" + "="*60)
        print("❌ ERROR EN LA INICIALIZACIÓN")
        print("="*60)
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
