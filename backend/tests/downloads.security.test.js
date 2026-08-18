// Pruebas de ATAQUE sobre la cadena real compra -> permiso -> descarga.
// Requieren Postgres: `npm run test:integration`
//
// Cada caso corresponde a un punto de la Fase 3.4. No prueban el caso feliz
// salvo donde hace falta como contraste (caso 3).
//
// Se monta la app real (src/server.js exporta `app`) y se ataca con supertest.
const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-pruebas-suficientemente-largo-1234567890';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
process.env.DISABLE_INPROCESS_RECONCILER = 'true';

const ORIGIN = 'http://localhost:3000';
const app = require('../src/server');
const db = require('../src/db');

// --- utilidades de fixture ---------------------------------------------------

let seq = 0;
function uniqueEmail(prefix) {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}@test.local`;
}

async function registerAndLogin(email) {
  const password = 'ClaveDePrueba.2026';
  await request(app).post('/api/auth/register').set('Origin', ORIGIN).send({ email, password });
  const res = await request(app).post('/api/auth/login').set('Origin', ORIGIN).send({ email, password });
  const cookie = (res.headers['set-cookie'] || []).find((c) => c.startsWith('nmx_token='));
  assert.ok(cookie, `no se obtuvo cookie de sesión para ${email}`);
  const userId = (await db.query('SELECT id FROM users WHERE email = $1', [email])).rows[0].id;
  return { cookie, userId, email, password };
}

// Crea un pedido para un producto y lo deja en el estado pedido, sin pasar por
// Webpay (Transbank NO está conectado en esta fase).
async function createOrder(user, productId, status) {
  const res = await request(app)
    .post('/api/orders')
    .set('Origin', ORIGIN)
    .set('Cookie', user.cookie)
    .send({ productIds: [productId] });
  assert.strictEqual(res.status, 201, `no se creó el pedido: ${JSON.stringify(res.body)}`);
  const orderId = res.body.order.id;
  if (status && status !== 'pending') {
    await db.query('UPDATE orders SET status = $1, paid_at = now() WHERE id = $2', [status, orderId]);
  }
  const item = (
    await db.query('SELECT id FROM order_items WHERE order_id = $1 LIMIT 1', [orderId])
  ).rows[0];
  return { orderId, orderItemId: item.id, orderCode: res.body.order.order_code };
}

test.after(async () => {
  await db.pool.end();
});

// --- 1. Usuario sin sesión ---------------------------------------------------

test('1. sin sesión -> 401', async () => {
  const res = await request(app).get('/api/downloads/1');
  assert.strictEqual(res.status, 401);
  assert.ok(!JSON.stringify(res.body).includes('secure-files'), 'la respuesta filtró una ruta física');
});

// --- 2. Autenticado sin compra ----------------------------------------------

test('2. autenticado sin ninguna compra -> no puede descargar', async () => {
  const buyer = await registerAndLogin(uniqueEmail('dueno'));
  const stranger = await registerAndLogin(uniqueEmail('ajeno'));
  const { orderItemId } = await createOrder(buyer, 'nmx01', 'paid');

  const res = await request(app).get(`/api/downloads/${orderItemId}`).set('Cookie', stranger.cookie);
  // 404 a propósito: no se confirma que el id exista (evita enumeración).
  assert.strictEqual(res.status, 404);
});

// --- 3. Compró NMX-01 -> puede descargar NMX-01 (contraste) -----------------

test('3. compró nmx01 y está pagado -> descarga permitida', async () => {
  const buyer = await registerAndLogin(uniqueEmail('ok'));
  const { orderItemId } = await createOrder(buyer, 'nmx01', 'paid');

  const res = await request(app).get(`/api/downloads/${orderItemId}`).set('Cookie', buyer.cookie);
  assert.strictEqual(res.status, 200);
  assert.match(res.headers['content-disposition'], /NMX-01\.xlsx/);
  assert.strictEqual(res.headers['cache-control'], 'private, no-store');
});

// --- 4 y 10. IDOR: item de otro producto / id alterado ----------------------

test('4. compró nmx01 -> NO puede descargar el item de nmx02 de otro pedido', async () => {
  const a = await registerAndLogin(uniqueEmail('a'));
  const b = await registerAndLogin(uniqueEmail('b'));
  await createOrder(a, 'nmx01', 'paid');
  const otro = await createOrder(b, 'nmx02', 'paid');

  const res = await request(app).get(`/api/downloads/${otro.orderItemId}`).set('Cookie', a.cookie);
  assert.strictEqual(res.status, 404);
});

test('10. id de item alterado (barrido secuencial) -> nunca entrega ajeno', async () => {
  const victim = await registerAndLogin(uniqueEmail('victima'));
  const attacker = await registerAndLogin(uniqueEmail('atacante'));
  const v = await createOrder(victim, 'nmx03', 'paid');

  let entregados = 0;
  for (let id = Math.max(1, v.orderItemId - 5); id <= v.orderItemId + 5; id++) {
    const res = await request(app).get(`/api/downloads/${id}`).set('Cookie', attacker.cookie);
    if (res.status === 200) entregados += 1;
  }
  assert.strictEqual(entregados, 0, 'el atacante obtuvo al menos un archivo ajeno');
});

// --- 5. DOCX de otro producto ------------------------------------------------

test('5. compró nmx01 -> NO puede descargar el DOCX de nmx02', async () => {
  const a = await registerAndLogin(uniqueEmail('docx-a'));
  const b = await registerAndLogin(uniqueEmail('docx-b'));
  await createOrder(a, 'nmx01', 'paid');
  const otro = await createOrder(b, 'nmx02', 'paid');

  const res = await request(app)
    .get(`/api/downloads/${otro.orderItemId}/portfolio`)
    .set('Cookie', a.cookie);
  assert.strictEqual(res.status, 404);
});

test('5b. el DOCX del producto propio SÍ se entrega', async () => {
  const buyer = await registerAndLogin(uniqueEmail('docx-ok'));
  const { orderItemId } = await createOrder(buyer, 'nmx01', 'paid');

  const res = await request(app)
    .get(`/api/downloads/${orderItemId}/portfolio`)
    .set('Cookie', buyer.cookie);
  assert.strictEqual(res.status, 200);
  assert.match(res.headers['content-disposition'], /NMX-01\.docx/);
});

// --- 6 y 7. Inexistentes -----------------------------------------------------

test('6. order_item inexistente -> 404 controlado', async () => {
  const u = await registerAndLogin(uniqueEmail('inex'));
  const res = await request(app).get('/api/downloads/999999999').set('Cookie', u.cookie);
  assert.strictEqual(res.status, 404);
});

test('7. tipo de asset inexistente -> error controlado, sin ruta física', async () => {
  const buyer = await registerAndLogin(uniqueEmail('tipo'));
  const { orderItemId } = await createOrder(buyer, 'nmx01', 'paid');

  const res = await request(app)
    .get(`/api/downloads/${orderItemId}/audit`)
    .set('Cookie', buyer.cookie);
  assert.strictEqual(res.status, 400);
  assert.ok(!JSON.stringify(res.body).includes('secure-files'));
});

// --- 8 y 9. Traversal y manipulación de nombre en la URL ---------------------

test('8. path traversal en la URL -> rechazado', async () => {
  const u = await registerAndLogin(uniqueEmail('trav'));
  const payloads = [
    '/api/downloads/..%2F..%2F.env',
    '/api/downloads/%2e%2e%2f.env',
    '/api/downloads/1/..%2F..%2Faudit',
    '/api/downloads/1%00',
    '/api/downloads/-1',
    '/api/downloads/1e9',
  ];
  for (const p of payloads) {
    const res = await request(app).get(p).set('Cookie', u.cookie);
    assert.ok(res.status >= 400 && res.status < 500, `${p} devolvió ${res.status}`);
    assert.notStrictEqual(res.status, 200, `${p} entregó un archivo`);
  }
});

test('9. no existe forma de pedir un filename arbitrario', async () => {
  const buyer = await registerAndLogin(uniqueEmail('fname'));
  const { orderItemId } = await createOrder(buyer, 'nmx01', 'paid');

  // El endpoint no lee ningún parámetro de nombre: se intenta por query y body.
  const res = await request(app)
    .get(`/api/downloads/${orderItemId}?filename=NMX-02.xlsx&file=../../.env&path=/etc/passwd`)
    .set('Cookie', buyer.cookie);
  assert.strictEqual(res.status, 200);
  // Pese a los parámetros, el archivo entregado sigue siendo el comprado.
  assert.match(res.headers['content-disposition'], /NMX-01\.xlsx/);
});

// --- 11. Orden de otro usuario ----------------------------------------------

test('11. pedido de otro usuario -> no visible ni descargable', async () => {
  const owner = await registerAndLogin(uniqueEmail('own'));
  const other = await registerAndLogin(uniqueEmail('oth'));
  const o = await createOrder(owner, 'nmx06', 'paid');

  const view = await request(app).get(`/api/orders/${o.orderCode}`).set('Cookie', other.cookie);
  assert.strictEqual(view.status, 403);

  const dl = await request(app).get(`/api/downloads/${o.orderItemId}`).set('Cookie', other.cookie);
  assert.strictEqual(dl.status, 404);
});

// --- 12. Pago no confirmado -------------------------------------------------

test('12. pedido sin pago confirmado -> 402 en todos los estados no pagados', async () => {
  const buyer = await registerAndLogin(uniqueEmail('estado'));
  for (const status of ['pending', 'payment_processing', 'authorized', 'failed', 'cancelled', 'refunded']) {
    const { orderItemId, orderId } = await createOrder(buyer, 'nmx07', 'pending');
    await db.query('UPDATE orders SET status = $1 WHERE id = $2', [status, orderId]);
    const res = await request(app).get(`/api/downloads/${orderItemId}`).set('Cookie', buyer.cookie);
    assert.strictEqual(res.status, 402, `estado ${status} permitió la descarga`);
  }
});

// --- Cupo de descargas: condición de carrera --------------------------------

test('cupo: 6 descargas concurrentes con cupo 5 -> exactamente 5 entregadas', async () => {
  const buyer = await registerAndLogin(uniqueEmail('cupo'));
  const { orderItemId } = await createOrder(buyer, 'nmx08', 'paid');

  const results = await Promise.all(
    Array.from({ length: 6 }, () =>
      request(app).get(`/api/downloads/${orderItemId}`).set('Cookie', buyer.cookie)
    )
  );
  const ok = results.filter((r) => r.status === 200).length;
  assert.strictEqual(ok, 5, `se entregaron ${ok} descargas con un cupo de 5`);

  const after = await request(app).get(`/api/downloads/${orderItemId}`).set('Cookie', buyer.cookie);
  assert.strictEqual(after.status, 403);
});

// --- 13. Rate limiting ------------------------------------------------------

test('13. reintentos anormales de descarga -> 429', async () => {
  const buyer = await registerAndLogin(uniqueEmail('rate'));
  const { orderItemId } = await createOrder(buyer, 'nmx09', 'paid');

  let sawLimit = false;
  for (let i = 0; i < 60 && !sawLimit; i++) {
    const res = await request(app).get(`/api/downloads/${orderItemId}`).set('Cookie', buyer.cookie);
    if (res.status === 429) sawLimit = true;
  }
  assert.ok(sawLimit, 'nunca se activó el rate limit de descargas');
});

// --- CSRF -------------------------------------------------------------------

test('CSRF: POST con cookie de sesión desde un origen ajeno -> 403', async () => {
  const u = await registerAndLogin(uniqueEmail('csrf'));
  const res = await request(app)
    .post('/api/cart')
    .set('Origin', 'https://sitio-atacante.example')
    .set('Cookie', u.cookie)
    .send({ productId: 'nmx01' });
  assert.strictEqual(res.status, 403);
});

test('CSRF: POST desde el origen permitido -> pasa', async () => {
  const u = await registerAndLogin(uniqueEmail('csrf-ok'));
  const res = await request(app)
    .post('/api/cart')
    .set('Origin', ORIGIN)
    .set('Cookie', u.cookie)
    .send({ productId: 'nmx01' });
  assert.strictEqual(res.status, 201);
});

// --- Admin ------------------------------------------------------------------

test('admin: un cliente no puede usar endpoints administrativos', async () => {
  const u = await registerAndLogin(uniqueEmail('cliente'));
  const res = await request(app)
    .post('/api/admin/reconcile')
    .set('Origin', ORIGIN)
    .set('Cookie', u.cookie);
  assert.strictEqual(res.status, 403);
});

test('admin: sin sesión tampoco', async () => {
  const res = await request(app).post('/api/admin/reconcile').set('Origin', ORIGIN);
  assert.strictEqual(res.status, 401);
});

// --- Precio: el cliente no es autoridad -------------------------------------

test('precio: el total lo calcula el backend, no el cliente', async () => {
  const u = await registerAndLogin(uniqueEmail('precio'));
  const res = await request(app)
    .post('/api/orders')
    .set('Origin', ORIGIN)
    .set('Cookie', u.cookie)
    .send({ productIds: ['nmx01'], total_clp: 1, price_clp: 1, total: 1, discount: 99 });
  assert.strictEqual(res.status, 201);

  const real = (await db.query('SELECT price_clp FROM products WHERE id = $1', ['nmx01'])).rows[0].price_clp;
  assert.strictEqual(res.body.order.total_clp, real, 'el backend aceptó un total del cliente');
});

test('precio: un product_id inexistente no crea pedido', async () => {
  const u = await registerAndLogin(uniqueEmail('fake-prod'));
  const res = await request(app)
    .post('/api/orders')
    .set('Origin', ORIGIN)
    .set('Cookie', u.cookie)
    .send({ productIds: ['nmx-inexistente'] });
  assert.strictEqual(res.status, 400);
});

// --- Proveedor de pago manual: la cadena completa sin Transbank -------------

test('pago manual: solo un admin puede confirmar, y solo así se habilita la descarga', async () => {
  const buyer = await registerAndLogin(uniqueEmail('manual-buyer'));

  // 1. Pedido creado -> pending -> descarga bloqueada.
  const res = await request(app)
    .post('/api/orders')
    .set('Origin', ORIGIN)
    .set('Cookie', buyer.cookie)
    .send({ productIds: ['nmx10'] });
  assert.strictEqual(res.status, 201);
  const orderCode = res.body.order.order_code;
  const itemId = (
    await db.query('SELECT id FROM order_items WHERE order_id = $1', [res.body.order.id])
  ).rows[0].id;

  let dl = await request(app).get(`/api/downloads/${itemId}`).set('Cookie', buyer.cookie);
  assert.strictEqual(dl.status, 402, 'un pedido pending permitió descargar');

  // 2. El comprador inicia el pago: el proveedor manual NO cobra.
  const init = await request(app)
    .post(`/api/payments/${orderCode}/init`)
    .set('Origin', ORIGIN)
    .set('Cookie', buyer.cookie);
  assert.strictEqual(init.status, 200);
  assert.strictEqual(init.body.provider, 'manual');
  assert.strictEqual(init.body.requiresManualConfirmation, true);

  const status = (await db.query('SELECT status FROM orders WHERE order_code = $1', [orderCode]))
    .rows[0].status;
  assert.strictEqual(status, 'payment_processing');

  // 3. payment_processing tampoco habilita la descarga.
  dl = await request(app).get(`/api/downloads/${itemId}`).set('Cookie', buyer.cookie);
  assert.strictEqual(dl.status, 402, 'payment_processing permitió descargar');

  // 4. El propio comprador NO puede autoconfirmarse el pago.
  const selfConfirm = await request(app)
    .post(`/api/admin/orders/${orderCode}/confirm-manual`)
    .set('Origin', ORIGIN)
    .set('Cookie', buyer.cookie);
  assert.strictEqual(selfConfirm.status, 403, 'un cliente confirmó su propio pago');

  dl = await request(app).get(`/api/downloads/${itemId}`).set('Cookie', buyer.cookie);
  assert.strictEqual(dl.status, 402);

  // 5. Un admin sí puede: el rol se asigna por ADMIN_EMAILS al registrarse.
  const adminEmail = uniqueEmail('admin');
  process.env.ADMIN_EMAILS = adminEmail;
  const admin = await registerAndLogin(adminEmail);
  const role = (await db.query('SELECT role FROM users WHERE email = $1', [adminEmail])).rows[0].role;
  assert.strictEqual(role, 'admin', 'ADMIN_EMAILS no asignó el rol admin');

  const confirm = await request(app)
    .post(`/api/admin/orders/${orderCode}/confirm-manual`)
    .set('Origin', ORIGIN)
    .set('Cookie', admin.cookie);
  assert.strictEqual(confirm.status, 200);
  assert.strictEqual(confirm.body.status, 'paid');

  // 6. Recién ahora la descarga funciona.
  dl = await request(app).get(`/api/downloads/${itemId}`).set('Cookie', buyer.cookie);
  assert.strictEqual(dl.status, 200);
  assert.match(dl.headers['content-disposition'], /NMX-10\.xlsx/);

  // 7. Confirmar dos veces no duplica nada.
  const again = await request(app)
    .post(`/api/admin/orders/${orderCode}/confirm-manual`)
    .set('Origin', ORIGIN)
    .set('Cookie', admin.cookie);
  assert.strictEqual(again.status, 409);
});

test('auditoría: los intentos denegados quedan registrados y son visibles solo al admin', async () => {
  const victim = await registerAndLogin(uniqueEmail('audit-v'));
  const attacker = await registerAndLogin(uniqueEmail('audit-a'));
  const v = await createOrder(victim, 'nmx11', 'paid');

  await request(app).get(`/api/downloads/${v.orderItemId}`).set('Cookie', attacker.cookie);

  const rows = await db.query(
    `SELECT outcome FROM download_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [attacker.userId]
  );
  assert.strictEqual(rows.rows[0].outcome, 'denied_not_owner');

  // El log no es accesible para un cliente.
  const forbidden = await request(app)
    .get('/api/admin/download-events')
    .set('Cookie', attacker.cookie);
  assert.strictEqual(forbidden.status, 403);
});

// --- Secretos en respuestas -------------------------------------------------

test('secretos: ninguna respuesta pública expone file_path ni credenciales', async () => {
  const res = await request(app).get('/api/products');
  assert.strictEqual(res.status, 200);
  const body = JSON.stringify(res.body);
  for (const leak of ['file_path', 'secure-files', 'JWT_SECRET', 'DATABASE_URL', 'password_hash', 'TRANSBANK']) {
    assert.ok(!body.includes(leak), `/api/products expuso "${leak}"`);
  }
});
