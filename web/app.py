from flask import Flask, request, render_template
import psycopg2

app = Flask(__name__)

conn = psycopg2.connect(
    dbname="RESTAURANTE",   # o restaurante si sale en minus
    user="gonzalo",
    password="123456",
    host="localhost"
)

@app.route('/', methods=['GET', 'POST'])
def index():
    cur = conn.cursor()

    if request.method == 'POST':
        nombre = request.form['nombre']
        tarea = request.form['tarea']

        cur.execute(
            "INSERT INTO tareas (nombre, tarea) VALUES (%s, %s)",
            (nombre, tarea)
        )
        conn.commit()

    cur.execute("SELECT * FROM tareas")
    datos = cur.fetchall()

    cur.close()
    return render_template('index.html', datos=datos)

app.run(host='0.0.0.0', port=5000)
