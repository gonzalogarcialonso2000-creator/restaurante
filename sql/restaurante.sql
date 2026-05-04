-- ============================================
--   CREAR BASE DE DATOS
-- ============================================
DROP DATABASE IF EXISTS restaurante;
CREATE DATABASE restaurante;

-- Conectar a la BD
\c restaurante;

-- ============================================
--   TABLA USUARIOS
-- ============================================
DROP TABLE IF EXISTS usuarios CASCADE;

CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'empleado'
);

-- Usuario administrador por defecto
INSERT INTO usuarios (username, password, rol)
VALUES ('admin', 'admin', 'admin');


-- ============================================
--   TABLA CATEGORÍAS
-- ============================================
DROP TABLE IF EXISTS categorias CASCADE;

CREATE TABLE categorias (
    id SERIAL PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL
);

-- Categorías iniciales
INSERT INTO categorias (nombre) VALUES
('Entrante'),
('Principal'),
('Postre'),
('Bebida'),
('Vegano'),
('Infantil')
ON CONFLICT DO NOTHING;


-- ============================================
--   TABLA PLATOS
-- ============================================
DROP TABLE IF EXISTS platos CASCADE;

CREATE TABLE platos (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    precio NUMERIC(10,2) NOT NULL,
    foto_url TEXT,
    categoria TEXT REFERENCES categorias(nombre)
);

-- Índice para acelerar búsquedas por categoría
CREATE INDEX idx_platos_categoria ON platos(categoria);


-- ============================================
--   OPCIONAL: ASIGNAR CATEGORÍA POR DEFECTO
-- ============================================
UPDATE platos
SET categoria = 'Principal'
WHERE categoria IS NULL;


-- ============================================
--   VERIFICACIONES
-- ============================================
SELECT 'Usuarios:' AS info;
SELECT * FROM usuarios;

SELECT 'Categorías:' AS info;
SELECT * FROM categorias;

SELECT 'Platos:' AS info;
SELECT * FROM platos;
