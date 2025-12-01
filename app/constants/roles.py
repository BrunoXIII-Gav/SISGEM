# app/constants/roles.py
"""
Definición de roles y permisos del sistema
Similar a AWS IAM, donde cada rol tiene permisos específicos
"""

# Nombres de roles
ROLE_ADMIN = "ADMIN"
ROLE_OPERADOR = "OPERADOR"
ROLE_VISUALIZADOR = "VISUALIZADOR"

# Permisos disponibles
PERMISSION_CREATE_EMERGENCY = "puede_crear_emergencias"
PERMISSION_EDIT_EMERGENCY = "puede_editar_emergencias"
PERMISSION_DELETE_EMERGENCY = "puede_eliminar_emergencias"
PERMISSION_MANAGE_RESOURCES = "puede_gestionar_recursos"
PERMISSION_MANAGE_USERS = "puede_gestionar_usuarios"
PERMISSION_VIEW_REPORTS = "puede_ver_reportes"

# Definición de roles con sus permisos
ROLES_DEFINITION = {
    ROLE_ADMIN: {
        "descripcion": "Administrador del sistema con todos los permisos",
        "permisos": {
            PERMISSION_CREATE_EMERGENCY: True,
            PERMISSION_EDIT_EMERGENCY: True,
            PERMISSION_DELETE_EMERGENCY: True,
            PERMISSION_MANAGE_RESOURCES: True,
            PERMISSION_MANAGE_USERS: True,
            PERMISSION_VIEW_REPORTS: True,
        }
    },
    ROLE_OPERADOR: {
        "descripcion": "Operador que puede gestionar emergencias y recursos",
        "permisos": {
            PERMISSION_CREATE_EMERGENCY: True,
            PERMISSION_EDIT_EMERGENCY: True,
            PERMISSION_DELETE_EMERGENCY: False,
            PERMISSION_MANAGE_RESOURCES: True,
            PERMISSION_MANAGE_USERS: False,
            PERMISSION_VIEW_REPORTS: True,
        }
    },
    ROLE_VISUALIZADOR: {
        "descripcion": "Usuario de solo lectura, puede ver pero no modificar",
        "permisos": {
            PERMISSION_CREATE_EMERGENCY: False,
            PERMISSION_EDIT_EMERGENCY: False,
            PERMISSION_DELETE_EMERGENCY: False,
            PERMISSION_MANAGE_RESOURCES: False,
            PERMISSION_MANAGE_USERS: False,
            PERMISSION_VIEW_REPORTS: True,
        }
    }
}

# Mapeo de permisos a descripción legible
PERMISSIONS_DISPLAY = {
    PERMISSION_CREATE_EMERGENCY: "Crear emergencias",
    PERMISSION_EDIT_EMERGENCY: "Editar emergencias",
    PERMISSION_DELETE_EMERGENCY: "Eliminar emergencias",
    PERMISSION_MANAGE_RESOURCES: "Gestionar recursos",
    PERMISSION_MANAGE_USERS: "Gestionar usuarios",
    PERMISSION_VIEW_REPORTS: "Ver reportes",
}

# Colores para roles en UI
ROLE_COLORS = {
    ROLE_ADMIN: "badge bg-danger",
    ROLE_OPERADOR: "badge bg-primary",
    ROLE_VISUALIZADOR: "badge bg-secondary",
}
