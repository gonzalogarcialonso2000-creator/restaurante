from flask import Blueprint, jsonify, request
from flask_cors import cross_origin

reseñas_bp = Blueprint('reseñas', __name__)

@reseñas_bp.route('/reseñas', methods=['GET', 'OPTIONS'])
@cross_origin()
def obtener_reseñas():
    if request.method == 'OPTIONS':
        return '', 200

    reseñas = [
        {"cliente": "Ana", "comentario": "Excelente comida", "puntuación": 5},
        {"cliente": "Luis", "comentario": "Servicio rápido", "puntuación": 4}
    ]
    return jsonify(reseñas)

