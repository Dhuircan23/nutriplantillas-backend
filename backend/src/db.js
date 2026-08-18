const { Pool } = require('pg');

// Pool lazy: no abre conexión real hasta el primer query, así que requerir
// este módulo nunca falla aunque la base todavía no esté arriba.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  // Error en un cliente inactivo del pool (ej. la base se cayó); no debe tumbar el proceso.
  console.error('Error inesperado en el pool de PostgreSQL:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
