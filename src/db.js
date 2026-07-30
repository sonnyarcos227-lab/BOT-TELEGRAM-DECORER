const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

// La carpeta /data se usará como volumen persistente en Railway.
// En local, si no existe, se crea junto al proyecto.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'inventario.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS productos (
    codigo TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    categoria TEXT,
    cantidad REAL,
    precio REAL,
    nota TEXT,
    nombre_normalizado TEXT
  );
  CREATE TABLE IF NOT EXISTS meta (
    clave TEXT PRIMARY KEY,
    valor TEXT
  );
`);

function normalizar(texto) {
  return (texto || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/\s+/g, ' ')
    .trim();
}

function reemplazarInventario(productos) {
  const borrar = db.prepare('DELETE FROM productos');
  const insertar = db.prepare(`
    INSERT INTO productos (codigo, nombre, categoria, cantidad, precio, nota, nombre_normalizado)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(codigo) DO UPDATE SET
      nombre=excluded.nombre,
      categoria=excluded.categoria,
      cantidad=excluded.cantidad,
      precio=excluded.precio,
      nota=excluded.nota,
      nombre_normalizado=excluded.nombre_normalizado
  `);

  db.exec('BEGIN');
  try {
    borrar.run();
    for (const p of productos) {
      insertar.run(
        p.codigo,
        p.nombre,
        p.categoria,
        p.cantidad,
        p.precio,
        p.nota,
        normalizar(`${p.nombre} ${p.categoria || ''}`)
      );
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  setMeta('ultima_actualizacion', new Date().toISOString());
  setMeta('total_productos', String(productos.length));
}

function buscarProductos(consulta, limite = 8) {
  const palabras = normalizar(consulta).split(' ').filter(Boolean);
  if (palabras.length === 0) return [];

  const condiciones = palabras.map(() => 'nombre_normalizado LIKE ?').join(' AND ');
  const params = palabras.map((p) => `%${p}%`);

  const filas = db
    .prepare(
      `SELECT codigo, nombre, categoria, cantidad, precio, nota
       FROM productos
       WHERE ${condiciones}
       ORDER BY (cantidad > 0) DESC, cantidad DESC
       LIMIT ?`
    )
    .all(...params, limite);

  return filas;
}

function contarProductos() {
  const fila = db.prepare('SELECT COUNT(*) as total FROM productos').get();
  return fila.total;
}

function setMeta(clave, valor) {
  db.prepare(
    `INSERT INTO meta (clave, valor) VALUES (?, ?)
     ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor`
  ).run(clave, valor);
}

function getMeta(clave) {
  const fila = db.prepare('SELECT valor FROM meta WHERE clave = ?').get(clave);
  return fila ? fila.valor : null;
}

module.exports = {
  reemplazarInventario,
  buscarProductos,
  contarProductos,
  setMeta,
  getMeta,
};
