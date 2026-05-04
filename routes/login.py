from flask import Blueprint, request, jsonify
from flask_cors import cross_origin

login_bp = Blueprint('login', __name__)

@login_bp.route('/login', methods=['POST', 'OPTIONS'])
@cross_origin()
def login():
    if request.method == 'OPTIONS':
        return '', 200

    data = request.get_json()
    usuario = data.get("usuario")
    contraseña = data.get("contraseña")

    # EJEMPLO: usuario fijo
    if usuario == "admin" and contraseña == "1234":
        return jsonify({"token": "TOKEN_DE_EJEMPLO"}), 200

    return jsonify({"error": "Credenciales incorrectas"}), 401

