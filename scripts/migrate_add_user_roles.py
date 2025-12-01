# scripts/migrate_add_user_roles.py
"""
Script de migración para añadir las columnas is_active e is_admin
a la tabla usuario_municipal existente
"""
import sys
import os
from pathlib import Path

# Agregar el directorio raíz al path
root_dir = Path(__file__).parent.parent
sys.path.insert(0, str(root_dir))

from dotenv import load_dotenv
load_dotenv()

from app.repositories.db import SessionLocal, engine

def migrate_usuario_table():
    """Añade las columnas is_active e is_admin a la tabla usuario_municipal"""
    print("🔧 Ejecutando migración de tabla usuario_municipal...")
    
    connection = engine.raw_connection()
    try:
        cursor = connection.cursor()
        
        # Verificar si las columnas ya existen
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'usuario_municipal'
            AND COLUMN_NAME IN ('is_active', 'is_admin')
        """)
        
        existing_columns = [row[0] for row in cursor.fetchall()]
        
        # Añadir is_active si no existe
        if 'is_active' not in existing_columns:
            print("  ➕ Añadiendo columna is_active...")
            cursor.execute("""
                ALTER TABLE usuario_municipal 
                ADD COLUMN is_active BOOLEAN DEFAULT TRUE
            """)
            print("  ✅ Columna is_active añadida")
        else:
            print("  ℹ️  Columna is_active ya existe")
        
        # Añadir is_admin si no existe
        if 'is_admin' not in existing_columns:
            print("  ➕ Añadiendo columna is_admin...")
            cursor.execute("""
                ALTER TABLE usuario_municipal 
                ADD COLUMN is_admin BOOLEAN DEFAULT FALSE
            """)
            print("  ✅ Columna is_admin añadida")
        else:
            print("  ℹ️  Columna is_admin ya existe")
        
        connection.commit()
        print("✅ Migración completada exitosamente\n")
        
    except Exception as e:
        connection.rollback()
        print(f"❌ Error en la migración: {e}")
        raise
    finally:
        cursor.close()
        connection.close()


def main():
    print("="*60)
    print("🚀 MIGRACIÓN: AÑADIR COLUMNAS DE ROLES Y ESTADO")
    print("="*60 + "\n")
    
    try:
        migrate_usuario_table()
        
        print("="*60)
        print("✅ MIGRACIÓN COMPLETADA")
        print("="*60)
        print("\n📝 Próximo paso:")
        print("Ejecuta: python scripts/init_roles_admin.py")
        print()
        
    except Exception as e:
        print("\n" + "="*60)
        print("❌ ERROR EN LA MIGRACIÓN")
        print("="*60)
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
