# app/main.py
import os
from functools import wraps
from flask import render_template, request, redirect, url_for, session, g, flash
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from app.repositories.db import get_db
from app.models.models import UsuarioMunicipal, Emergencia

load_dotenv()

from flask import Flask
app = Flask(__name__, template_folder="templates", static_folder="static")
app.secret_key = os.getenv("FLASK_SECRET", "dev-secret")


from app.api.auth import auth_bp
app.register_blueprint(auth_bp)


@app.route("/")
def root():
    # endpoints del blueprint
    return redirect(url_for("auth.inicio" if session.get("user_id") else "auth.login"))