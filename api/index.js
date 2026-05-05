import { Hono } from "hono";
import { sql } from "bun";

const app = new Hono();

// Conexión a la base de datos
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("DATABASE_URL no está definida");
}

sql.connect(dbUrl);

// Crear tabla si no existe
await sql`
  CREATE TABLE IF NOT EXISTS todos (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;

// GET todos
app.get("/todos", async (c) => {
  const todos = await sql`SELECT * FROM todos ORDER BY created_at DESC`;
  return c.json(todos);
});

// GET uno
app.get("/todos/:id", async (c) => {
  const id = c.req.param("id");
  const todo = await sql`SELECT * FROM todos WHERE id = ${id}`;
  if (todo.length === 0) return c.json({ error: "Todo not found" }, 404);
  return c.json(todo[0]);
});

// POST crear
app.post("/todos", async (c) => {
  const body = await c.req.json();
  const { title, description } = body;

  if (!title) return c.json({ error: "Title is required" }, 400);

  const result = await sql`
    INSERT INTO todos (title, description)
    VALUES (${title}, ${description || null})
    RETURNING *
  `;

  return c.json(result[0], 201);
});

// PATCH actualizar
app.patch("/todos/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { title, description, completed } = body;

  const result = await sql`
    UPDATE todos
    SET
      title = COALESCE(${title || null}, title),
      description = COALESCE(${description || null}, description),
      completed = COALESCE(${completed !== undefined ? completed : null}, completed),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *
  `;

  if (result.length === 0) return c.json({ error: "Todo not found" }, 404);

  return c.json(result[0]);
});

// DELETE
app.delete("/todos/:id", async (c) => {
  const id = c.req.param("id");
  const result = await sql`DELETE FROM todos WHERE id = ${id} RETURNING *`;

  if (result.length === 0) return c.json({ error: "Todo not found" }, 404);

  return c.json({ message: "Todo deleted" });
});

// Health
app.get("/health", (c) => c.json({ status: "ok" }));

// Railway necesita esto
app.fire();

