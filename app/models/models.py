# app/models/models.py
from sqlalchemy import Column, Integer, String, Text, DECIMAL, TIMESTAMP, ForeignKey, BIGINT
from sqlalchemy.orm import relationship
from app.repositories.db import Base

class UsuarioMunicipal(Base):
    __tablename__ = "usuario_municipal"

    # mapeo exacto del nombre de columna real
    usuario_municipal_id = Column("id_usuario", Integer, primary_key=True)
    dni = Column(Integer, nullable=False)
    nombre_usuario = Column(String(120), nullable=False)
    email_usuario = Column(String(120), unique=True, nullable=False)
    password_usuario = Column(Text, nullable=False)
    cargo = Column(Text)

    emergencias = relationship(
        "Emergencia",
        back_populates="usuario",
        cascade="all,delete-orphan"
    )

class Emergencia(Base):
    __tablename__ = "emergencias"

    id_emergencias = Column(Integer, primary_key=True)
    Nombre_emergencia = Column(String(160), nullable=False)
    descripcion = Column(String(200))
    tipo = Column(String(50))
    estado = Column(String(30))
    fecha_reporte = Column(TIMESTAMP)
    fecha_cierre = Column(TIMESTAMP)
    lat = Column(DECIMAL(9,6))
    lon = Column(DECIMAL(9,6))
    direccion = Column(String(200))
    distrito = Column(String(80))

    # conexiones
    usuario_municipal_id_usuario = Column(
        "usuario_municipal_id_usuario",
        Integer,
        ForeignKey("usuario_municipal.id_usuario"),
        nullable=True
    )

    usuario = relationship(
        "UsuarioMunicipal",
        back_populates="emergencias",
        foreign_keys=[usuario_municipal_id_usuario]
    )
    
    # Relaciones con recursos y acciones
    recursos = relationship("Recurso", back_populates="emergencia", cascade="all, delete-orphan")
    recursos_desplazados = relationship("RecursoDesplazado", back_populates="emergencia", cascade="all, delete-orphan")
    acciones = relationship("Accion", back_populates="emergencia", cascade="all, delete-orphan")


class Recurso(Base):
    """Tabla para almacenar recursos identificados cercanos a la emergencia"""
    __tablename__ = "recursos"
    
    id_recursos = Column(Integer, primary_key=True)
    tipo_recurso = Column(String(50), nullable=True)  # 'bombero' o 'hidrante'
    entidad_recurso = Column(String(160), nullable=True)  # ID del bombero o hidrante del JSON
    lat = Column(DECIMAL(9,6), nullable=True)
    lon = Column(DECIMAL(9,6), nullable=True)
    direccion = Column(String(200), nullable=True)
    distancia_recurso = Column(String(45), nullable=True)
    emergencias_id_emergencias = Column(Integer, ForeignKey("emergencias.id_emergencias"), nullable=False)
    
    emergencia = relationship("Emergencia", back_populates="recursos")


class RecursoDesplazado(Base):
    """Tabla para almacenar recursos que fueron efectivamente desplegados"""
    __tablename__ = "recursos_desplazados"
    
    id_recursos_desplazado = Column(BIGINT, primary_key=True, autoincrement=True)
    tipo_recurso_deplazado = Column(Integer)  # Podría ser un enum o referencia
    hora_salida = Column(TIMESTAMP)
    hora_llegada = Column(TIMESTAMP)
    estado = Column(String(30))
    emergencias_id_emergencias = Column(Integer, ForeignKey("emergencias.id_emergencias"), nullable=False)
    
    emergencia = relationship("Emergencia", back_populates="recursos_desplazados")


class Accion(Base):
    """Tabla para almacenar las acciones realizadas durante la emergencia"""
    __tablename__ = "acciones"
    
    id_acciones = Column(Integer, primary_key=True)
    tipo_accion = Column(String(80), nullable=True)
    descripcion_durante_emer = Column(Text, nullable=True)
    fecha_hora = Column(TIMESTAMP, nullable=True)
    emergencias_id_emergencias = Column(Integer, ForeignKey("emergencias.id_emergencias"), nullable=False)
    
    emergencia = relationship("Emergencia", back_populates="acciones")

