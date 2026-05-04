console.log(">>> APP.JS CARGADO");

/* ============================
   TOKEN GLOBAL
============================ */
let token = localStorage.getItem("token") || null;

/* ============================
   PAGINACIÓN POR CATEGORÍAS
============================ */
let paginaActual = 1;
let totalPaginas = 6;

/* ============================
   DECODIFICAR TOKEN
============================ */
function obtenerDatosToken() {
    if (!token) return null;
    const partes = token.split(".");
    if (partes.length !== 3) return null;

    try {
        return JSON.parse(atob(partes[1]));
    } catch (e) {
        console.error("Error decodificando token:", e);
        return null;
    }
}

/* ============================
   MODO OSCURO
============================ */
function toggleDarkMode() {
    document.body.classList.toggle("dark");
    localStorage.setItem("darkmode", document.body.classList.contains("dark") ? "1" : "0");
}

window.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem("darkmode") === "1") {
        document.body.classList.add("dark");
    }
});

/* ============================
   LOGOUT
============================ */
function logout() {
    localStorage.removeItem("token");
    token = null;

    document.getElementById("login-box").style.display = "block";
    document.getElementById("sidebar").style.display = "none";
    document.getElementById("panel").style.display = "none";

    mostrarToast("Sesión cerrada");
}

/* ============================
   LOGIN
============================ */
function login() {
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value.trim();

    if (!username || !password) {
        mostrarToast("Debes rellenar usuario y contraseña", "danger");
        return;
    }

    fetch("http://127.0.0.1:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            mostrarToast(data.error, "danger");
        } else {
            token = data.token;
            localStorage.setItem("token", token);

            document.getElementById("login-box").style.display = "none";
            document.getElementById("sidebar").style.display = "block";
            document.getElementById("panel").style.display = "block";

            activateButton("btn-dashboard");
            showView("view-dashboard");

            cargarCategorias();
            cargarPlatos();
        }
    })
    .catch(() => mostrarToast("Error en la conexión", "danger"));
}

/* ============================
   CARGAR CATEGORÍAS
============================ */
function cargarCategorias() {
    return fetch("http://127.0.0.1:5000/categorias", {
        headers: { "Authorization": token }
    })
    .then(r => r.json())
    .then(categorias => {
        const filtro = document.getElementById("filtro-categoria");
        const crear = document.getElementById("nuevo-plato-categoria");
        const editar = document.getElementById("edit-categoria");

        filtro.innerHTML = `<option value="">Todas</option>`;
        crear.innerHTML = "";
        editar.innerHTML = "";

        categorias.forEach(cat => {
            filtro.innerHTML += `<option value="${cat}">${cat}</option>`;
            crear.innerHTML += `<option value="${cat}">${cat}</option>`;
            editar.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
    });
}

/* ============================
   CARGAR PLATOS
============================ */
async function cargarPlatos() {
    const res = await fetch(`http://127.0.0.1:5000/platos?page=${paginaActual}`, {
        headers: { "Authorization": token }
    });

    const data = await res.json();

    document.getElementById("categoriaTitulo").textContent =
        data.categoria ? data.categoria.toUpperCase() : "SIN CATEGORÍA";

    const datos = obtenerDatosToken();
    const esAdmin = datos.rol === "admin";

    document.getElementById("usuario-logueado").textContent =
        `${datos.username} (${datos.rol})`;

    const tabla = document.getElementById("tabla-platos");
    tabla.innerHTML = "";

    let total = 0;
    let sumaPrecios = 0;

    data.platos.forEach(plato => {
        total++;
        sumaPrecios += plato.precio;

        tabla.innerHTML += `
        <tr>
            <td>${plato.id}</td>
            <td>
                ${plato.foto_url ? `<img src="${plato.foto_url}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;margin-right:8px;">` : ""}
                ${plato.nombre}
                <div class="text-muted small">${plato.categoria || ""}</div>
            </td>
            <td>${plato.precio} €</td>
            <td>
                ${esAdmin ? `
                    <button class="btn btn-warning btn-sm" onclick="editarPlato(${plato.id})">Editar</button>
                    <button class="btn btn-danger btn-sm" onclick="borrarPlato(${plato.id})">Borrar</button>
                ` : `<span class="text-muted">Sin permisos</span>`}
            </td>
        </tr>`;
    });

    document.getElementById("card-total-platos").textContent = data.total;
    document.getElementById("card-precio-medio").textContent =
        data.total > 0 ? (sumaPrecios / total).toFixed(2) + " €" : "0 €";

    dibujarGraficoPrecios(data.platos);
    dibujarGraficoCategorias(data.platos);

    pintarPaginacion();
}

/* ============================
   PAGINACIÓN
============================ */
function pintarPaginacion() {
    const cont = document.getElementById("paginacion");

    cont.innerHTML = `
        <div class="d-flex justify-content-center gap-3">
            <button class="btn btn-outline-primary" onclick="paginaAnterior()" ${paginaActual === 1 ? "disabled" : ""}>Anterior</button>
            <span class="fw-bold">Página ${paginaActual} / ${totalPaginas}</span>
            <button class="btn btn-outline-primary" onclick="paginaSiguiente()" ${paginaActual === totalPaginas ? "disabled" : ""}>Siguiente</button>
        </div>
    `;
}

function paginaAnterior() {
    if (paginaActual > 1) {
        paginaActual--;
        cargarPlatos();
    }
}

function paginaSiguiente() {
    if (paginaActual < totalPaginas) {
        paginaActual++;
        cargarPlatos();
    }
}

/* ============================
   CREAR PLATO
============================ */
function crearPlato() {
    const nombre = document.getElementById("nuevo-plato-nombre").value.trim();
    const precio = document.getElementById("nuevo-plato-precio").value.trim();
    const categoria = document.getElementById("nuevo-plato-categoria").value;
    const imagen = document.getElementById("nuevo-plato-imagen").files[0];

    if (!nombre || !precio || !categoria) {
        mostrarToast("Faltan datos del plato", "danger");
        return;
    }

    const formData = new FormData();
    formData.append("nombre", nombre);
    formData.append("precio", precio);
    formData.append("categoria", categoria);
    if (imagen) formData.append("imagen", imagen);

    fetch("http://127.0.0.1:5000/platos", {
        method: "POST",
        headers: { "Authorization": token },
        body: formData
    })
    .then(r => r.json())
    .then(data => {
        if (data.error) {
            mostrarToast(data.error, "danger");
        } else {
            mostrarToast("Plato creado correctamente");
            bootstrap.Modal.getInstance(
                document.getElementById("modalCrearPlato")
            ).hide();
            cargarPlatos();
        }
    })
    .catch(err => {
        console.error(">>> ERROR CREAR PLATO:", err);
        mostrarToast("Error al crear plato", "danger");
    });
}

/* ============================
   EDITAR PLATO
============================ */
async function editarPlato(id) {
    const r = await fetch("http://127.0.0.1:5000/platos/" + id, {
        headers: { "Authorization": token }
    });
    const plato = await r.json();

    document.getElementById("edit-id").value = plato.id;
    document.getElementById("edit-nombre").value = plato.nombre;
    document.getElementById("edit-precio").value = plato.precio;

    document.getElementById("preview-editar").src = plato.foto_url || "";
    document.getElementById("preview-editar").style.display = plato.foto_url ? "block" : "none";

    await cargarCategorias();

    document.getElementById("edit-categoria").value = plato.categoria;

    bootstrap.Modal.getOrCreateInstance(
        document.getElementById("modalEditarPlato")
    ).show();
}

function guardarEdicion() {
    const id = document.getElementById("edit-id").value;

    const formData = new FormData();
    formData.append("nombre", document.getElementById("edit-nombre").value);
    formData.append("precio", document.getElementById("edit-precio").value);
    formData.append("categoria", document.getElementById("edit-categoria").value);

    const imagen = document.getElementById("edit-imagen").files[0];
    if (imagen) formData.append("imagen", imagen);

    fetch("http://127.0.0.1:5000/platos/" + id, {
        method: "PUT",
        headers: { "Authorization": token },
        body: formData
    })
    .then(r => r.json())
    .then(() => {
        mostrarToast("Plato actualizado");
        cargarPlatos();
    });
}

/* ============================
   BORRAR PLATO
============================ */
function borrarPlato(id) {
    if (!confirm("¿Seguro que quieres borrar este plato?")) return;

    fetch("http://127.0.0.1:5000/platos/" + id, {
        method: "DELETE",
        headers: { "Authorization": token }
    })
    .then(r => r.json())
    .then(() => {
        mostrarToast("Plato eliminado");
        cargarPlatos();
    });
}

/* ============================
   BUSCADOR + FILTRO
============================ */
function filtrarPlatos() {
    const texto = document.getElementById("buscador").value.toLowerCase();
    const cat = document.getElementById("filtro-categoria").value;

    const filas = document.querySelectorAll("#tabla-platos tr");

    filas.forEach(fila => {
        const nombre = fila.children[1].textContent.toLowerCase();
        const categoria = fila.children[1].querySelector(".small")?.textContent.trim() || "";

        const coincideTexto = nombre.includes(texto);
        const coincideCat = !cat || categoria === cat;

        fila.style.display = coincideTexto && coincideCat ? "" : "none";
    });
}

/* ============================
   EXPORTAR EXCEL
============================ */
function exportarExcel() {
    fetch("http://127.0.0.1:5000/exportar_excel", {
        headers: { "Authorization": token }
    })
    .then(r => r.blob())
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "platos.xlsx";
        a.click();
        mostrarToast("Excel generado");
    });
}

/* ============================
   TOASTS
============================ */
function mostrarToast(texto, tipo = "success") {
    const cont = document.getElementById("toast-container");

    const toast = document.createElement("div");
    toast.className = `toast align-items-center text-bg-${tipo} border-0 show mb-2`;
    toast.role = "alert";

    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${texto}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto"
            onclick="this.parentNode.parentNode.remove()"></button>
        </div>
    `;

    cont.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

/* ============================
   GRÁFICO DE PRECIOS
============================ */
let grafico1 = null;
let grafico2 = null;

function dibujarGraficoPrecios(platos) {
    const ctx = document.getElementById("grafico-precios");

    const labels = platos.map(p => p.nombre);
    const precios = platos.map(p => p.precio);

    if (grafico1) grafico1.destroy();

    grafico1 = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Precio (€)",
                data: precios,
                backgroundColor: "#0d6efd"
            }]
        }
    });
}

/* ============================
   GRÁFICO DE CATEGORÍAS
============================ */
function dibujarGraficoCategorias(platos) {
    const ctx = document.getElementById("grafico-categorias");

    const conteo = {};
    platos.forEach(p => {
        conteo[p.categoria] = (conteo[p.categoria] || 0) + 1;
    });

    const labels = Object.keys(conteo);
    const valores = Object.values(conteo);

    if (grafico2) grafico2.destroy();

    grafico2 = new Chart(ctx, {
        type: "pie",
        data: {
            labels,
            datasets: [{
                data: valores,
                backgroundColor: ["#0d6efd", "#198754", "#dc3545", "#ffc107", "#6f42c1"]
            }]
        }
    });
}

/* ============================
   SISTEMA DE VISTAS
============================ */
function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.getElementById(viewId).style.display = 'block';
}

function activateButton(btnId) {
    document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));
    document.getElementById(btnId).classList.add('active');
}

document.getElementById('btn-dashboard').addEventListener('click', () => {
    activateButton('btn-dashboard');
    showView('view-dashboard');
});

document.getElementById('btn-platos').addEventListener('click', () => {
    activateButton('btn-platos');
    showView('view-platos');
    cargarPlatos();
});

/* ============================
   RESEÑAS
============================ */
document.getElementById('btn-reseñas').addEventListener('click', () => {
    activateButton('btn-reseñas');
    showView('view-reseñas');
    cargarReseñas();
});

async function cargarReseñas() {
    try {
        const response = await fetch("http://127.0.0.1:5000/reseñas", {
            headers: { "Authorization": token }
        });

        const data = await response.json();
        const tabla = document.getElementById("tabla-reseñas");
        tabla.innerHTML = "";

        data.forEach(r => {
            tabla.innerHTML += `
                <tr>
                    <td>${r.cliente}</td>
                    <td>${r.comentario}</td>
                    <td>${r.puntuación}/5</td>
                </tr>
            `;
        });

    } catch (error) {
        mostrarToast("Error cargando reseñas", "danger");
    }
}

/* ===============================
   ASISTENTE OLLAMA
=============================== */

document.getElementById("assistant-button").addEventListener("click", toggleAssistant);

function toggleAssistant() {
    const win = document.getElementById("assistant-window");
    win.style.display = (win.style.display === "block") ? "none" : "block";
}

async function enviarPreguntaAsistente() {
    const input = document.getElementById("assistant-input");
    const texto = input.value.trim();
    if (!texto) return;

    const cont = document.getElementById("assistant-messages");

    cont.innerHTML += `
        <div class="text-end mb-1">
            <span class="badge bg-primary">${texto}</span>
        </div>
    `;

    input.value = "";

    const respuesta = await responderAsistente(texto);

    cont.innerHTML += `
        <div class="mb-2">
            <span class="badge bg-light text-dark">${respuesta}</span>
        </div>
    `;

    cont.scrollTop = cont.scrollHeight;
}

async function responderAsistente(pregunta) {
    try {
        const response = await fetch("http://192.168.31.65:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "qwen3.5:4b",
                stream: false,
                prompt: `
Eres un empleado IT de un restaurante moderno.
Tu estilo es directo, rápido y sin rodeos.
Hablas como un compañero de trabajo.
El usuario dice: "${pregunta}"
                `
            })
        });

        const data = await response.json();
        return data.response || "El modelo no devolvió texto.";
    } 
    catch (error) {
        return "Error al conectar con el servidor Ollama.";
    }
}

