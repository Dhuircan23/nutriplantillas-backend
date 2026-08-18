// Ejecuta schema.sql, las migraciones incrementales de db/migrations/ y seed.sql
// contra la base configurada en .env
// Uso: npm run migrate
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Las migraciones se aplican en orden alfabético (001_, 002_, 003_…) y son
// idempotentes, así que correr `npm run migrate` de nuevo es seguro.
function readMigrations() {
  const dir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ name: f, sql: fs.readFileSync(path.join(dir, f), 'utf8') }));
}

async function run() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
  const migrations = readMigrations();

  const client = await pool.connect();
  try {
    console.log('→ Aplicando schema.sql...');
    await client.query(schema);

    for (const m of migrations) {
      console.log(`→ Aplicando migrations/${m.name}...`);
      await client.query(m.sql);
    }

    console.log('→ Aplicando seed.sql...');
    await client.query(seed);
    console.log(`✓ Migración completada (schema + ${migrations.length} migración/es + seed).`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('✗ Falló la migración:', err.message);
  process.exit(1);
});
