# app/models/models.py
from sqlalchemy import Column, Integer, String, Text, DECIMAL, TIMESTAMP, ForeignKey
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
