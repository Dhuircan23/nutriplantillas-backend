const express = require('express');
const db = require('../db');

const router = express.Router();

// Solo columnas públicas — file_path NUNCA se expone en ninguna respuesta.
const PUBLIC_COLUMNS = `
  id, sku, name, category, price_clp, version, file_name,
  description, badge, updated_label, format, language, status_label,
  license_text, support_text, limitations,
  tabs, results, equations, sources, instructions, functions,
  variables, compat, faq, version_history
`;

router.get('/', async (req, res) => {
  // Los packs se excluyen del catálogo de herramientas: tienen su propia página
  // (Packages.dc.html) y aparecerían mezclados entre los 32 NMX.
  const result = await db.query(
    `SELECT ${PUBLIC_COLUMNS} FROM products WHERE active = true AND bundle_items IS NULL ORDER BY sku`
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
