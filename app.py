import os
import uuid
import psycopg2
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
import jwt
import datetime
from functools import wraps
from werkzeug.utils import secure_filename
import pandas as pd

# ============================
#   CONFIG
# ============================
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

@app.after_request
def after_request(response):
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    response.headers.add("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
    response.headers.add("Access-Control-Allow-Origin", "*")
    return response

app.config["SECRET_KEY"] = "clave_super_secreta"
app.config["UPLOAD_FOLDER"] = "uploads"
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
os.makedirs("exports", exist_ok=True)

ALLOWED_EXT = {"jpg", "jpeg", "png"}

# 🔥 ORDEN DE CATEGORÍAS POR PÁGINA
CATEGORIAS_POR_PAGINA = [
    "bebidas",
    "entrantes",
    "carnes",
    "pescados",
    "postres"
]

# ============================
#   HELPERS
# ============================
def get_connection():
    return psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT")
    )

def extension_valida(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXT

def nombre_unico(filename):
    ext = filename.rsplit(".", 1)[1]
    return f"{uuid.uuid4().hex}.{ext}"

# ============================
#   TOKEN DECORATOR
# ============================
def token_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = request.headers.get("Authorization")
        if not token:
            return jsonify({"error": "Token requerido"}), 401
        try:
            datos = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
        except Exception:
            return jsonify({"error": "Token inválido o expirado"}), 401
        return f(datos, *args, **kwargs)
    return wrapper

# ============================
#   LOGIN
# ============================
@app.route("/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS":
        return "", 200

    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT password, rol FROM usuarios WHERE username=%s", (username,))
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        return jsonify({"error": "Usuario no encontrado"}), 401
    if row[0] != password:
        return jsonify({"error": "Contraseña incorrecta"}), 401

    token = jwt.encode({
        "username": username,
        "rol": row[1],
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=3)
    }, app.config["SECRET_KEY"], algorithm="HS256")

    if isinstance(token, bytes):
        token = token.decode("utf-8")

    return jsonify({"token": token})

# ============================
#   RESEÑAS
# ============================
@app.route("/reseñas", methods=["GET", "OPTIONS"])
def reseñas():
    if request.method == "OPTIONS":
        return "", 200

    data = [
        {"cliente": "Ana", "comentario": "Excelente comida", "puntuación": 5},
        {"cliente": "Luis", "comentario": "Servicio rápido", "puntuación": 4}
    ]
    return jsonify(data)

# ============================
#   CREAR USUARIO
# ============================
@app.route("/usuarios", methods=["POST", "OPTIONS"])
@token_required
def crear_usuario(datos):
    if request.method == "OPTIONS":
        return "", 200

    if datos["rol"] != "admin":
        return jsonify({"error": "Solo admin puede crear usuarios"}), 403

    username = request.form.get("username")
    password = request.form.get("password")
    rol = request.form.get("rol")

    if not username or not password or not rol:
        return jsonify({"error": "Faltan datos"}), 400

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT id FROM usuarios WHERE username=%s", (username,))
    existe = cur.fetchone()

    if existe:
        cur.close()
        conn.close()
        return jsonify({"error": "El usuario ya existe"}), 400

    cur.execute("""
        INSERT INTO usuarios (username, password, rol)
        VALUES (%s, %s, %s)
    """, (username, password, rol))

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"mensaje": "Usuario creado correctamente"})

# ============================
#   CATEGORÍAS
# ============================
@app.route("/categorias", methods=["OPTIONS"])
def categorias_options():
    return "", 200

@app.route("/categorias", methods=["GET"])
@token_required
def categorias(datos):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT nombre FROM categorias ORDER BY nombre")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify([r[0] for r in rows])

@app.route("/categorias/add", methods=["OPTIONS"])
def categorias_add_options():
    return "", 200

@app.route("/categorias/add", methods=["POST"])
@token_required
def add_categoria(datos):
    if datos["rol"] != "admin":
        return jsonify({"error": "Solo admin puede crear categorías"}), 403

    data = request.get_json()
    nombre = data.get("nombre")

    if not nombre:
        return jsonify({"error": "Nombre requerido"}), 400

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO categorias (nombre)
        VALUES (%s)
        ON CONFLICT (nombre) DO NOTHING
    """, (nombre,))
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"mensaje": "Categoría creada"})

# ============================
#   PLATOS OPTIONS
# ============================
@app.route("/platos", methods=["OPTIONS"])
def platos_options():
    return '', 200

# ============================
#   PLATOS (GET + POST)
# ============================
@app.route("/platos", methods=["GET", "POST"])
@token_required
def platos(datos):

    # ---------- GET ----------
    if request.method == "GET":
        page = int(request.args.get("page", 1))

        # Si la página no existe, devolver vacío
        if page < 1 or page > len(CATEGORIAS_POR_PAGINA):
            return jsonify({
                "total": 0,
                "size": 0,
                "page": page,
                "categoria": None,
                "platos": []
            })

        categoria = CATEGORIAS_POR_PAGINA[page - 1]

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, nombre, precio, foto_url, categoria
            FROM platos
            WHERE categoria = %s
            ORDER BY id
        """, (categoria,))

        rows = cur.fetchall()
        cur.close()
        conn.close()

        platos = [{
            "id": r[0],
            "nombre": r[1],
            "precio": float(r[2]),
            "foto_url": r[3],
            "categoria": r[4]
        } for r in rows]

        return jsonify({
            "total": len(platos),
            "size": len(platos),
            "page": page,
            "categoria": categoria,
            "platos": platos
        })

    # ---------- POST ----------
    if request.method == "POST":
        if datos["rol"] != "admin":
            return jsonify({"error": "Solo admin"}), 403

        nombre = request.form.get("nombre")
        precio = request.form.get("precio")
        categoria = request.form.get("categoria")
        imagen = request.files.get("imagen")
        foto_url = None

        if imagen:
            if not extension_valida(imagen.filename):
                return jsonify({"error": "Formato no permitido (solo JPG/PNG)"}), 400

            filename = nombre_unico(secure_filename(imagen.filename))
            path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            imagen.save(path)
            foto_url = f"http://127.0.0.1:5000/uploads/{filename}"

        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO platos (nombre, precio, foto_url, categoria)
            VALUES (%s, %s, %s, %s)
        """, (nombre, precio, foto_url, categoria))
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"mensaje": "Plato creado"})

# ============================
#   PLATO POR ID OPTIONS
# ============================
@app.route("/platos/<int:id>", methods=["OPTIONS"])
def plato_por_id_options(id):
    return '', 200

# ============================
#   PLATO POR ID (GET + PUT + DELETE)
# ============================
@app.route("/platos/<int:id>", methods=["GET", "PUT", "DELETE"])
@token_required
def plato_por_id(datos, id):

    conn = get_connection()
    cur = conn.cursor()

    # ---------- GET ----------
    if request.method == "GET":
        cur.execute("SELECT id, nombre, precio, foto_url, categoria FROM platos WHERE id=%s", (id,))
        r = cur.fetchone()
        cur.close()
        conn.close()

        if not r:
            return jsonify({"error": "No encontrado"}), 404

        return jsonify({
            "id": r[0],
            "nombre": r[1],
            "precio": float(r[2]),
            "foto_url": r[3],
            "categoria": r[4]
        })

    # ---------- PUT ----------
    if request.method == "PUT":
        if datos["rol"] != "admin":
            return jsonify({"error": "Solo admin"}), 403

        nombre = request.form.get("nombre")
        precio = request.form.get("precio")
        categoria = request.form.get("categoria")
        imagen = request.files.get("imagen")

        cur.execute("SELECT foto_url FROM platos WHERE id=%s", (id,))
        old_url = cur.fetchone()[0]

        foto_url = old_url

        if imagen:
            if not extension_valida(imagen.filename):
                return jsonify({"error": "Formato no permitido"}), 400

            filename = nombre_unico(secure_filename(imagen.filename))
            path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            imagen.save(path)
            foto_url = f"http://127.0.0.1:5000/uploads/{filename}"

        cur.execute("""
            UPDATE platos
            SET nombre=%s, precio=%s, categoria=%s, foto_url=%s
            WHERE id=%s
        """, (nombre, precio, categoria, foto_url, id))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"mensaje": "Plato actualizado"})

    # ---------- DELETE ----------
    if request.method == "DELETE":
        if datos["rol"] != "admin":
            return jsonify({"error": "Solo admin"}), 403

        cur.execute("DELETE FROM platos WHERE id=%s", (id,))
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"mensaje": "Plato eliminado"})

# ============================
#   SERVIR IMÁGENES
# ============================
@app.route("/uploads/<path:filename>")
def uploads(filename):
    from flask import send_from_directory
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

# ============================
#   RUN SERVER
# ============================
@app.route("/health", methods=["GET"])
def health():
    return {"status": "ok"}, 200


@app.route("/test-db", methods=["GET"])
def test_db():
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT NOW();")
        result = cur.fetchone()
        cur.close()
        conn.close()
        return {"database_connection": "successful", "timestamp": result[0]}, 200
    except Exception as e:
        return {"database_connection": "failed", "error": str(e)}, 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)

CATEGORIAS_POR_PAGINA = [
    "bebidas",
    "entrantes",
    "carnes",
    "postres",
    "vegano",
    "infantil"
]

