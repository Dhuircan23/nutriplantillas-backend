const express = require('express');
const db = require('../db');

const router = express.Router();

// Solo columnas públicas — file_path NUNCA se expone en ninguna respuesta.
// Desde la Fase C, esto incluye el contenido de marketing (antes hardcodeado
// en el PRODUCTS estático de store.js): el frontend ya no necesita tener
// ningún dato de producto guardado localmente, todo viene de acá.
const PUBLIC_COLUMNS = `
  id, sku, name, category, price_clp, version, file_name,
  description, badge, updated_label, format, language, status_label,
  license_text, support_text, limitations,
  tabs, results, equations, sources, instructions, functions,
  variables, compat, faq, version_history
`;

router.get('/', async (req, res) => {
  const result = await db.query(
    `SELECT ${PUBLIC_COLUMNS} FROM products WHERE active = true ORDER BY sku`
  );
  res.json({ products: result.rows });
});

router.get('/:id', async (req, res) => {
  const result = await db.query(
    `SELECT ${PUBLIC_COLUMNS} FROM products WHERE id = $1 AND active = true`,
    [req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado.' });
  res.json({ product: result.rows[0] });
});

module.exports = router;
