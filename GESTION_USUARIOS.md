# Sistema de Gestión de Usuarios y Roles - SISGEM

## 📋 Descripción

Sistema de gestión de usuarios con roles y permisos granulares, similar a AWS IAM. Permite a los administradores crear usuarios, asignarles roles específicos y gestionar el acceso a diferentes funcionalidades de SISGEM.

## 🎯 Características

- **Sistema de Roles Predefinidos**: ADMIN, OPERADOR, VISUALIZADOR
- **Permisos Granulares**: Control fino sobre qué puede hacer cada usuario
- **Usuarios Múltiples Roles**: Un usuario puede tener varios roles
- **Activación/Desactivación**: Desactivar usuarios sin eliminar sus datos
- **Super Administrador**: Usuario especial con acceso total e inmodificable

## 🔐 Roles del Sistema

### ADMIN (Administrador)
✅ Crear emergencias  
✅ Editar emergencias  
✅ Eliminar emergencias  
✅ Gestionar recursos  
✅ **Gestionar usuarios** (único con este permiso)  
✅ Ver reportes  

### OPERADOR
✅ Crear emergencias  
✅ Editar emergencias  
❌ Eliminar emergencias  
✅ Gestionar recursos  
❌ Gestionar usuarios  
✅ Ver reportes  

### VISUALIZADOR
❌ Crear emergencias  
❌ Editar emergencias  
❌ Eliminar emergencias  
❌ Gestionar recursos  
❌ Gestionar usuarios  
✅ Ver reportes (solo lectura)  

## 🚀 Instalación y Configuración

### 1. Ejecutar el script de inicialización

Después de configurar la base de datos, ejecuta:

```powershell
python scripts/init_roles_admin.py
```

Este script:
- ✅ Crea las tablas nuevas en la base de datos
- ✅ Inicializa los 3 roles base (ADMIN, OPERADOR, VISUALIZADOR)
- ✅ Crea un usuario administrador inicial

### 2. Credenciales del Administrador Inicial

```
Email: admin@sisgem.pe
Password: admin123
```

⚠️ **IMPORTANTE**: Cambia esta contraseña después del primer inicio de sesión

## 📖 Uso del Sistema

### Acceso a la Gestión de Usuarios

Solo usuarios con rol **ADMIN** o permiso `puede_gestionar_usuarios` pueden acceder a:
- `/admin/usuarios` - Lista de usuarios
- `/admin/usuarios/nuevo` - Crear nuevo usuario
- `/admin/usuarios/<id>/editar` - Editar usuario
- `/admin/roles` - Ver roles del sistema

### Crear un Nuevo Usuario

1. Inicia sesión como administrador
2. Navega a **Administración** en el navbar
3. Haz clic en **Nuevo Usuario**
4. Completa el formulario:
   - DNI (requerido)
   - Nombre completo (requerido)
   - Email (requerido, único)
   - Contraseña (requerido, mínimo 6 caracteres)
   - Cargo (opcional)
   - Roles (selecciona uno o más)
5. Haz clic en **Crear Usuario**

### Editar un Usuario

1. En la lista de usuarios, haz clic en el botón ✏️ (Editar)
2. Modifica los campos necesarios
3. Para cambiar contraseña, ingresa una nueva (deja en blanco para mantener actual)
4. Actualiza los roles según sea necesario
5. Usa el switch "Usuario Activo" para activar/desactivar
6. Haz clic en **Guardar Cambios**

### Desactivar/Activar Usuarios

- **Desactivar**: Haz clic en el botón 🚫 junto al usuario
  - El usuario no podrá iniciar sesión
  - Sus datos se mantienen intactos
  
- **Activar**: Haz clic en el botón ✅ junto al usuario desactivado
  - El usuario podrá iniciar sesión nuevamente

### Gestión de Roles

Accede a `/admin/roles` para ver:
- Lista de todos los roles disponibles
- Permisos específicos de cada rol
- Cantidad de usuarios con cada rol

## 🔒 Protección de Rutas

Las rutas están protegidas con decoradores:

```python
# Requiere estar autenticado
@login_required

# Requiere ser administrador
@admin_required

# Requiere un permiso específico
@permission_required("puede_crear_emergencias")
```

### Rutas Protegidas por Permisos

| Ruta | Permiso Requerido |
|------|-------------------|
| `/crear-emergencia` | `puede_crear_emergencias` |
| `/api/emergencias` (POST) | `puede_crear_emergencias` |
| `/api/desplegar-recursos` | `puede_gestionar_recursos` |
| `/admin/usuarios` | `puede_gestionar_usuarios` |

## 💡 Ejemplo de Flujo de Trabajo

### Caso: Empresa de Bomberos con 3 Niveles

1. **Administrador** crea cuentas para:
   - Director de operaciones → Rol ADMIN
   - Operadores de emergencia (5 personas) → Rol OPERADOR
   - Personal de monitoreo (3 personas) → Rol VISUALIZADOR

2. **Director** puede:
   - Gestionar todas las emergencias
   - Crear nuevos usuarios
   - Asignar/modificar roles

3. **Operadores** pueden:
   - Crear y editar emergencias
   - Identificar y desplegar recursos
   - Ver reportes

4. **Personal de monitoreo** puede:
   - Ver el dashboard de emergencias
   - Consultar reportes
   - NO pueden crear o modificar nada

## 🏗️ Arquitectura Técnica

### Modelos de Base de Datos

```python
# Tabla de Roles
Rol
├── id_rol (PK)
├── nombre_rol (ADMIN, OPERADOR, VISUALIZADOR)
├── descripcion
├── puede_crear_emergencias (boolean)
├── puede_editar_emergencias (boolean)
├── puede_eliminar_emergencias (boolean)
├── puede_gestionar_recursos (boolean)
├── puede_gestionar_usuarios (boolean)
└── puede_ver_reportes (boolean)

# Tabla Usuario (extendida)
UsuarioMunicipal
├── usuario_municipal_id (PK)
├── dni
├── nombre_usuario
├── email_usuario (unique)
├── password_usuario
├── cargo
├── is_active (boolean) ← NUEVO
├── is_admin (boolean) ← NUEVO
└── roles (many-to-many con Rol) ← NUEVO

# Tabla intermedia
usuario_roles
├── usuario_id (FK → UsuarioMunicipal)
└── rol_id (FK → Rol)
```

### Métodos Útiles en UsuarioMunicipal

```python
# Verificar si tiene un permiso específico
usuario.has_permission("puede_crear_emergencias")  # → True/False

# Verificar si tiene un rol
usuario.has_role("ADMIN")  # → True/False

# Super admins siempre retornan True en has_permission
if usuario.is_admin:
    usuario.has_permission("cualquier_cosa")  # → True
```

## 🛡️ Seguridad

### Recomendaciones

1. **Contraseñas**: 
   - En producción, implementar hashing con bcrypt o argon2
   - Actualmente se guardan en texto plano (SOLO DESARROLLO)

2. **Super Admin**:
   - No puede ser editado ni eliminado desde la interfaz
   - Cambiar contraseña manualmente en la BD si es necesario

3. **Sesiones**:
   - Configurar `FLASK_SECRET` en variables de entorno
   - Usar HTTPS en producción

4. **Validaciones**:
   - Emails únicos
   - DNI válido (8 dígitos)
   - Contraseñas de al menos 6 caracteres

## 📁 Archivos Creados/Modificados

### Nuevos Archivos
```
app/
├── api/
│   └── gestionar_usuarios.py     # API de gestión de usuarios
├── constants/
│   └── roles.py                  # Definición de roles y permisos
└── templates/
    └── admin/
        ├── listar_usuarios.html  # Lista de usuarios
        ├── crear_usuario.html    # Formulario crear usuario
        ├── editar_usuario.html   # Formulario editar usuario
        └── listar_roles.html     # Vista de roles

scripts/
└── init_roles_admin.py           # Script de inicialización
```

### Archivos Modificados
```
app/
├── models/models.py              # Añadido: Rol, usuario_roles, campos en UsuarioMunicipal
├── api/auth.py                   # Añadido: decoradores admin_required, permission_required
├── api/crear_emergencia.py       # Añadido: @permission_required
├── api/identificar_recursos.py   # Añadido: @permission_required
├── main.py                       # Registrado: gestionar_usuarios_bp
└── templates/inicio.html         # Actualizado: navbar con enlaces admin
```

## 🔄 Migración de Usuarios Existentes

Si ya tienes usuarios en la BD antes de implementar este sistema:

1. Ejecuta `init_roles_admin.py` para crear tablas y roles
2. Asigna roles manualmente a usuarios existentes:

```python
from app.repositories.db import SessionLocal
from app.models.models import UsuarioMunicipal, Rol

db = SessionLocal()

# Obtener usuario y rol
usuario = db.query(UsuarioMunicipal).filter_by(email_usuario="usuario@example.com").first()
rol_operador = db.query(Rol).filter_by(nombre_rol="OPERADOR").first()

# Asignar rol
usuario.roles = [rol_operador]
usuario.is_active = True

db.commit()
db.close()
```

## 📞 Soporte

Para dudas o problemas:
1. Revisa que las tablas se hayan creado correctamente
2. Verifica que el usuario administrador existe
3. Confirma que los roles tienen los permisos correctos

---

**Desarrollado para SISGEM** - Sistema de Gestión de Emergencias Municipales
