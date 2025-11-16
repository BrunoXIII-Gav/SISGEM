from flask import Blueprint, jsonify, request
import json
import os
from typing import List, Dict, Any
from datetime import datetime
from decimal import Decimal
from sqlalchemy.exc import SQLAlchemyError
from app.api.auth import login_required
from app.repositories.db import get_db
from app.models.models import Emergencia, Recurso, RecursoDesplazado, Accion

identificar_recursos_bp = Blueprint("identificar_recursos", __name__)


def cargar_json(nombre_archivo: str) -> List[Dict[str, Any]]:
    """Carga un archivo JSON desde la carpeta JSON de la aplicación."""
    ruta = os.path.join(os.path.dirname(os.path.dirname(__file__)), "JSON", nombre_archivo)
    try:
        with open(ruta, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error cargando {nombre_archivo}: {e}")
        return []


def calcular_distancia(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calcula la distancia aproximada en km usando la fórmula haversine simplificada."""
    from math import radians, sin, cos, sqrt, atan2
    
    R = 6371  # Radio de la Tierra en km
    
    lat1_rad = radians(lat1)
    lat2_rad = radians(lat2)
    delta_lat = radians(lat2 - lat1)
    delta_lon = radians(lon2 - lon1)
    
    a = sin(delta_lat/2)**2 + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    
    return R * c


def filtrar_recursos_por_distrito(recursos: List[Dict], lat_emergencia: float, lon_emergencia: float, radio_km: float = 5.0) -> List[Dict]:
    """
    Filtra recursos que estén dentro de un radio específico desde la ubicación de la emergencia.
    
    Args:
        recursos: Lista de recursos (bomberos o hidrantes)
        lat_emergencia: Latitud de la emergencia
        lon_emergencia: Longitud de la emergencia
        radio_km: Radio en kilómetros para filtrar (por defecto 5 km)
    
    Returns:
        Lista de recursos filtrados con distancia agregada
    """
    recursos_filtrados = []
    
    for recurso in recursos:
        lat_recurso = recurso.get('lat')
        lon_recurso = recurso.get('lng')
        
        if lat_recurso is None or lon_recurso is None:
            continue
        
        try:
            distancia = calcular_distancia(lat_emergencia, lon_emergencia, lat_recurso, lon_recurso)
            
            if distancia <= radio_km:
                recurso_con_distancia = recurso.copy()
                recurso_con_distancia['distancia_km'] = round(distancia, 2)
                recursos_filtrados.append(recurso_con_distancia)
        except Exception as e:
            print(f"Error calculando distancia para recurso {recurso.get('nombre', 'desconocido')}: {e}")
            continue
    
    # Ordenar por distancia (más cercano primero)
    recursos_filtrados.sort(key=lambda x: x.get('distancia_km', float('inf')))
    
    return recursos_filtrados


@identificar_recursos_bp.route("/api/recursos/<int:emergencia_id>", methods=["GET"])
@login_required
def obtener_recursos(emergencia_id: int):
    """
    Obtiene los recursos (bomberos e hidrantes) cercanos a una emergencia específica.
    
    Query parameters opcionales:
        - radio: Radio en km para filtrar recursos (default: 5.0)
        - tipo: Tipo de recursos a retornar ('bomberos', 'hidrantes', 'todos' - default: 'todos')
    """
    # Obtener parámetros opcionales
    radio_km = float(request.args.get('radio', 5.0))
    tipo_recurso = request.args.get('tipo', 'todos').lower()
    
    # Validar el radio
    if radio_km <= 0 or radio_km > 50:
        return jsonify({
            "ok": False,
            "error": "El radio debe estar entre 0 y 50 km"
        }), 400
    
    # Obtener la emergencia de la base de datos
    with next(get_db()) as db:
        emergencia = db.get(Emergencia, emergencia_id)
        
        if not emergencia:
            return jsonify({
                "ok": False,
                "error": "Emergencia no encontrada"
            }), 404
        
        # Verificar que la emergencia tenga coordenadas
        if emergencia.lat is None or emergencia.lon is None:
            return jsonify({
                "ok": False,
                "error": "La emergencia no tiene coordenadas definidas"
            }), 400
        
        lat_emergencia = float(emergencia.lat)
        lon_emergencia = float(emergencia.lon)
        distrito = emergencia.distrito
    
    # Cargar los datos de recursos
    bomberos_data = []
    hidrantes_data = []
    
    if tipo_recurso in ['bomberos', 'todos']:
        bomberos_raw = cargar_json("bomberos.json")
        bomberos_data = filtrar_recursos_por_distrito(bomberos_raw, lat_emergencia, lon_emergencia, radio_km)
    
    if tipo_recurso in ['hidrantes', 'todos']:
        hidrantes_raw = cargar_json("hidrantes.json")
        hidrantes_data = filtrar_recursos_por_distrito(hidrantes_raw, lat_emergencia, lon_emergencia, radio_km)
    
    # Preparar respuesta
    respuesta = {
        "ok": True,
        "emergencia": {
            "id": emergencia.id_emergencias,
            "nombre": emergencia.Nombre_emergencia,
            "distrito": distrito,
            "lat": lat_emergencia,
            "lon": lon_emergencia,
            "direccion": emergencia.direccion
        },
        "filtros": {
            "radio_km": radio_km,
            "tipo": tipo_recurso
        },
        "recursos": {}
    }
    
    if tipo_recurso in ['bomberos', 'todos']:
        respuesta["recursos"]["bomberos"] = {
            "total": len(bomberos_data),
            "data": bomberos_data[:20]  # Limitar a los 20 más cercanos
        }
    
    if tipo_recurso in ['hidrantes', 'todos']:
        respuesta["recursos"]["hidrantes"] = {
            "total": len(hidrantes_data),
            "data": hidrantes_data[:50]  # Limitar a los 50 más cercanos
        }
    
    return jsonify(respuesta), 200


@identificar_recursos_bp.route("/api/desplegar-recursos", methods=["POST"])
@login_required
def guardar_recursos_desplegados():
    """
    Guarda los recursos desplegados y las acciones realizadas para una emergencia.
    
    Payload esperado:
    {
        "emergencia_id": int,
        "acciones": str,
        "observaciones": str,
        "recursos": {
            "bomberos": [ids...],
            "hidrantes": [ids...]
        }
    }
    """
    data = request.get_json(silent=True) or {}
    
    emergencia_id = data.get('emergencia_id')
    acciones_texto = data.get('acciones', '').strip()
    observaciones = data.get('observaciones', '').strip()
    recursos_seleccionados = data.get('recursos', {})
    
    # Validaciones
    if not emergencia_id:
        return jsonify({"ok": False, "error": "El ID de emergencia es requerido"}), 400
    
    if not acciones_texto:
        return jsonify({"ok": False, "error": "Debe describir las acciones realizadas"}), 400
    
    bomberos_ids = recursos_seleccionados.get('bomberos', [])
    hidrantes_ids = recursos_seleccionados.get('hidrantes', [])
    
    if not bomberos_ids and not hidrantes_ids:
        return jsonify({"ok": False, "error": "Debe seleccionar al menos un recurso"}), 400
    
    try:
        with next(get_db()) as db:
            # Verificar que la emergencia existe
            emergencia = db.get(Emergencia, emergencia_id)
            if not emergencia:
                return jsonify({"ok": False, "error": "Emergencia no encontrada"}), 404
            
            now_utc = datetime.utcnow()
            
            # Cargar datos completos de los recursos seleccionados
            bomberos_data = cargar_json("bomberos.json") if bomberos_ids else []
            hidrantes_data = cargar_json("hidrantes.json") if hidrantes_ids else []
            
            # 1. Guardar recursos identificados en la tabla 'recursos'
            recursos_guardados = []
            
            for bombero_id in bomberos_ids:
                bombero = next((b for b in bomberos_data if b.get('idCompaniaBomberos') == bombero_id), None)
                if bombero:
                    # Calcular distancia
                    distancia = calcular_distancia(
                        float(emergencia.lat), float(emergencia.lon),
                        bombero.get('lat'), bombero.get('lng')
                    )
                    
                    # Convertir valores a Decimal para compatibilidad con DECIMAL de SQL
                    lat_decimal = Decimal(str(bombero.get('lat'))) if bombero.get('lat') is not None else None
                    lon_decimal = Decimal(str(bombero.get('lng'))) if bombero.get('lng') is not None else None
                    
                    recurso = Recurso(
                        tipo_recurso='bombero',
                        entidad_recurso=str(bombero_id),
                        lat=lat_decimal,
                        lon=lon_decimal,
                        direccion=bombero.get('nombre', ''),
                        distancia_recurso=f"{round(distancia, 2)} km",
                        emergencias_id_emergencias=emergencia_id
                    )
                    db.add(recurso)
                    recursos_guardados.append({
                        'tipo': 'bombero',
                        'nombre': bombero.get('nombre'),
                        'distancia': round(distancia, 2)
                    })
            
            for hidrante_id in hidrantes_ids:
                hidrante = next((h for h in hidrantes_data if h.get('ID') == hidrante_id), None)
                if hidrante:
                    # Calcular distancia
                    distancia = calcular_distancia(
                        float(emergencia.lat), float(emergencia.lon),
                        hidrante.get('lat'), hidrante.get('lng')
                    )
                    
                    # Convertir valores a Decimal para compatibilidad con DECIMAL de SQL
                    lat_decimal = Decimal(str(hidrante.get('lat'))) if hidrante.get('lat') is not None else None
                    lon_decimal = Decimal(str(hidrante.get('lng'))) if hidrante.get('lng') is not None else None
                    
                    recurso = Recurso(
                        tipo_recurso='hidrante',
                        entidad_recurso=str(hidrante_id),
                        lat=lat_decimal,
                        lon=lon_decimal,
                        direccion=hidrante.get('nombre', ''),
                        distancia_recurso=f"{round(distancia, 2)} km",
                        emergencias_id_emergencias=emergencia_id
                    )
                    db.add(recurso)
                    recursos_guardados.append({
                        'tipo': 'hidrante',
                        'nombre': hidrante.get('nombre'),
                        'distancia': round(distancia, 2)
                    })
            
            # 2. Guardar recursos desplegados en la tabla 'recursos_desplazados'
            # Por ahora, guardamos un registro por cada bombero desplegado
            for bombero_id in bomberos_ids:
                recurso_desplegado = RecursoDesplazado(
                    tipo_recurso_deplazado=1,  # 1 = bombero, 2 = hidrante (por ejemplo)
                    hora_salida=now_utc,
                    estado='EN_CAMINO',
                    emergencias_id_emergencias=emergencia_id
                )
                db.add(recurso_desplegado)
            
            for hidrante_id in hidrantes_ids:
                recurso_desplegado = RecursoDesplazado(
                    tipo_recurso_deplazado=2,  # 2 = hidrante
                    hora_salida=now_utc,
                    estado='IDENTIFICADO',
                    emergencias_id_emergencias=emergencia_id
                )
                db.add(recurso_desplegado)
            
            # 3. Guardar acción realizada en la tabla 'acciones'
            descripcion_completa = acciones_texto
            if observaciones:
                descripcion_completa += f"\n\nObservaciones: {observaciones}"
            
            accion = Accion(
                tipo_accion='DESPLIEGUE_RECURSOS',
                descripcion_durante_emer=descripcion_completa,
                fecha_hora=now_utc,
                emergencias_id_emergencias=emergencia_id
            )
            db.add(accion)
            
            # 4. Actualizar estado de la emergencia a 'EN CURSO' (estado normalizado en BD)
            if emergencia.estado not in ['CERRADO', 'ATENDIDA']:
                emergencia.estado = 'EN CURSO'
            
            # Commit de todas las operaciones
            db.commit()
            
            return jsonify({
                "ok": True,
                "message": "Recursos desplegados exitosamente",
                "emergencia_id": emergencia_id,
                "recursos_guardados": {
                    "total": len(recursos_guardados),
                    "bomberos": len(bomberos_ids),
                    "hidrantes": len(hidrantes_ids),
                    "detalles": recursos_guardados
                },
                "accion_registrada": {
                    "tipo": "DESPLIEGUE_RECURSOS",
                    "fecha_hora": now_utc.isoformat()
                }
            }), 201
            
    except SQLAlchemyError as e:
        return jsonify({
            "ok": False,
            "error": f"Error al guardar en la base de datos: {str(e)}"
        }), 500
    except Exception as e:
        return jsonify({
            "ok": False,
            "error": f"Error inesperado: {str(e)}"
        }), 500


@identificar_recursos_bp.route("/api/recursos/distrito", methods=["GET"])
@login_required
def obtener_recursos_por_coordenadas():
    """
    Obtiene recursos por coordenadas directas (sin necesidad de emergencia creada).
    
    Query parameters requeridos:
        - lat: Latitud
        - lon: Longitud
    
    Query parameters opcionales:
        - radio: Radio en km (default: 5.0)
        - tipo: Tipo de recursos ('bomberos', 'hidrantes', 'todos')
    """
    try:
        lat = float(request.args.get('lat'))
        lon = float(request.args.get('lon'))
    except (TypeError, ValueError):
        return jsonify({
            "ok": False,
            "error": "Parámetros lat y lon son requeridos y deben ser numéricos"
        }), 400
    
    radio_km = float(request.args.get('radio', 5.0))
    tipo_recurso = request.args.get('tipo', 'todos').lower()
    
    # Cargar los datos de recursos
    bomberos_data = []
    hidrantes_data = []
    
    if tipo_recurso in ['bomberos', 'todos']:
        bomberos_raw = cargar_json("bomberos.json")
        bomberos_data = filtrar_recursos_por_distrito(bomberos_raw, lat, lon, radio_km)
    
    if tipo_recurso in ['hidrantes', 'todos']:
        hidrantes_raw = cargar_json("hidrantes.json")
        hidrantes_data = filtrar_recursos_por_distrito(hidrantes_raw, lat, lon, radio_km)
    
    respuesta = {
        "ok": True,
        "ubicacion": {
            "lat": lat,
            "lon": lon
        },
        "filtros": {
            "radio_km": radio_km,
            "tipo": tipo_recurso
        },
        "recursos": {}
    }
    
    if tipo_recurso in ['bomberos', 'todos']:
        respuesta["recursos"]["bomberos"] = {
            "total": len(bomberos_data),
            "data": bomberos_data[:20]
        }
    
    if tipo_recurso in ['hidrantes', 'todos']:
        respuesta["recursos"]["hidrantes"] = {
            "total": len(hidrantes_data),
            "data": hidrantes_data[:50]
        }
    
    return jsonify(respuesta), 200
