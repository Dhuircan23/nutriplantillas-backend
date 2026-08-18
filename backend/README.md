# NutriPlantillas — Backend

Backend real en Node.js + Express + PostgreSQL para reemplazar la persistencia
100% en `localStorage` del prototipo frontend. Cubre: autenticación real,
carrito y pedidos en servidor, pago real con **Webpay Plus (Transbank)**, y
descargas protegidas por dueño/pago/cupo.

Este backend resuelve de raíz varios hallazgos de la auditoría original:
descarga gratuita vía Confirmation.dc.html, panel Admin sin autenticación,
archivos servidos desde una ruta pública adivinable, contador de descargas
decorativo, y la sesión simulada en localStorage.

## 1. Requisitos

- Node.js 18+
- PostgreSQL 14+ corriendo en algún lado (local, Docker, o un servicio como Railway/Render/Supabase)

## 2. Instalación

```bash
cp .env.example .env
# edita .env: al menos DATABASE_URL y JWT_SECRET son obligatorios

npm install
createdb nutriplantillas          # o crea la base desde tu cliente de Postgres preferido
npm run migrate                   # aplica db/schema.sql y db/seed.sql (carga los 5 productos)
```

Copia los 5 archivos `.xlsx` reales dentro de `secure-files/` (ver
`secure-files/LEEME.txt` para los nombres exactos que espera el seed).

```bash
npm run dev      # con recarga automática (nodemon)
# o
npm start
```

El servidor queda en `http://localhost:4000`. `GET /api/health` debe responder `{"ok":true}`.

## 3. Pago real — Webpay Plus

Ya viene funcionando en modo **sandbox** sin que configures nada: si dejas
`TRANSBANK_COMMERCE_CODE` y `TRANSBANK_API_KEY` vacíos en `.env`, el backend
usa automáticamente las credenciales públicas de integración que trae el SDK
oficial de Transbank. Puedes probar el flujo de pago completo ahora mismo con
las tarjetas de prueba que Transbank publica en transbankdevelopers.cl.

Para cobrar de verdad:
1. Afíliate como comercio en Transbank y obtén tu `commerce_code` y `api_key` reales.
2. Complétalos en `.env`.
3. Cambia `TRANSBANK_ENV=production`.

No necesito tus credenciales para nada de lo anterior — el código ya está
armado para que sea solo cambiar variables de entorno.

## 4. Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/register` | — | Crea cuenta, deja sesión (cookie httpOnly) |
| POST | `/api/auth/login` | — | Inicia sesión |
| POST | `/api/auth/oauth/google` | — | Inicia sesión (o crea cuenta) con un ID token de Google |
| POST | `/api/auth/oauth/apple` | — | Inicia sesión (o crea cuenta) con un ID token de Apple |
| POST | `/api/auth/logout` | — | Cierra la sesión actual (revocada en servidor) |
| POST | `/api/auth/logout-all` | ✔ | Cierra todas las sesiones activas del usuario |
| GET | `/api/auth/me` | ✔ | Usuario actual |
| GET | `/api/products` | — | Catálogo público (no expone rutas de archivo) |
| GET | `/api/products/:id` | — | Detalle de un producto |
| GET | `/api/cart` | ✔ | Carrito del usuario |
| POST | `/api/cart` | ✔ | Agrega `{ productId }` |
| DELETE | `/api/cart/:productId` | ✔ | Quita del carrito |
| POST | `/api/orders` | ✔ | Crea pedido desde el carrito (o `{ productIds }` para "comprar ahora") |
| GET | `/api/orders` | ✔ | Mis pedidos |
| GET | `/api/orders/:orderCode` | ✔ | Detalle de un pedido (dueño o admin) |
| POST | `/api/payments/:orderCode/init` | ✔ | Inicia el pago con el `PaymentProvider` activo |
| GET/POST | `/api/payments/webpay/return` | — (la llama Transbank) | Confirma el pago y redirige al frontend |
| GET | `/api/downloads/:orderItemId` | ✔ | Descarga el Excel comprado |
| GET | `/api/downloads/:orderItemId/:assetType` | ✔ | `excel` o `portfolio` (DOCX) del producto comprado |
| POST | `/api/admin/reconcile` | ✔ admin | Dispara la reconciliación de pedidos atascados |
| POST | `/api/admin/orders/:orderCode/confirm-manual` | ✔ admin | Confirma un pago del proveedor simulado |
| GET | `/api/admin/download-events` | ✔ admin | Auditoría de descargas (`?denied=true`, `?limit=`) |

## Seguridad de las descargas (Fase 3)

El cliente nunca envía una ruta ni un nombre de archivo: solo el id del item que
compró y, opcionalmente, cuál de los dos archivos de ese producto quiere.

```
GET /api/downloads/:orderItemId/:assetType
  → requireAuth
  → el order_item existe
  → el pedido es del usuario (si no: 404, no 403 — no se confirma el id)
  → el pedido está 'paid' (cualquier otro estado: 402)
  → queda cupo (UPDATE atómico condicional)
  → assetResolver: SKU + tipo en lista blanca → ruta contenida en secure-files/
  → stream privado (Cache-Control: private, no-store)
```

`services/assetResolver.js` es el único que construye rutas. Deriva el nombre
del SKU del producto (validado contra `/^NMX-[A-Z0-9]+(?:-[A-Z]+)*$/`), acepta
solo los tipos `excel` y `portfolio`, y comprueba con `path.relative` que la
ruta final caiga bajo `secure-files/`. Las carpetas `audit/` y `master/`
existen en disco pero no están en la lista blanca: ningún cliente puede pedirlas.

Si el envío falla a mitad de camino, el cupo consumido se devuelve. Todos los
intentos —permitidos y denegados— quedan en `download_events`, sin tokens ni
cookies.

Rate limiting: descargas 40/10min por usuario, pedidos 30/10min, admin 60/15min,
login/registro/oauth 30/15min por IP más bloqueo progresivo por cuenta.

## CSRF

La sesión va en cookie y CORS usa `credentials: true`, así que con
`COOKIE_SAME_SITE=none` (necesario cuando frontend y backend están en dominios
distintos) un sitio ajeno podría disparar POSTs autenticados. `middleware/
verifySameOrigin.js` exige que todo método que cambia estado traiga un `Origin`
(o `Referer`) de la lista blanca. El retorno de Webpay está exento porque no se
apoya en la cookie: valida el pago con `token_ws` contra el proveedor.

## Proveedor de pago

`services/paymentProvider.js` define la interfaz. Dos implementaciones:

- **`manual`** (por defecto): no cobra. Deja el pedido en `payment_processing`
  y solo `POST /api/admin/orders/:orderCode/confirm-manual` lo pasa a `paid`.
  Permite probar la cadena compra → permiso → descarga sin dinero real.
- **`webpay`**: envuelve el SDK de Transbank. **No activo.** Requiere
  `PAYMENT_PROVIDER=webpay` explícito; con `TRANSBANK_*` vacías opera contra el
  sandbox de integración.

Estados de orden en `utils/orderStatus.js`: `pending`, `payment_processing`,
`authorized`, `paid`, `failed`, `cancelled`, `refunded`. **Solo `paid`
habilita la descarga**; cualquier estado nuevo queda excluido por defecto.

## Pruebas

```bash
npm install
npm run migrate            # schema + migrations/ + seed
npm run test:unit          # ataques al resolutor de rutas, sin base de datos
npm run test:integration   # cadena completa contra Postgres
npm test                   # ambas
```

`tests/assetResolver.test.js` corre 21 payloads de path traversal y 9 tipos de
archivo ilegales. `tests/downloads.security.test.js` cubre los 13 casos
negativos de la auditoría: sin sesión, sin compra, IDOR con barrido de ids,
DOCX ajeno, traversal en la URL, manipulación de `filename`, pedido ajeno, los
seis estados no pagados, condición de carrera del cupo, rate limit, CSRF,
escalada a admin y el total calculado en servidor.

## 5. Reconciliación de pagos atascados

Si el servidor se cae o pierde conexión a la base **entre** el `commit()`
exitoso contra Transbank y el `UPDATE` del pedido a `'paid'`, el pedido queda
en `'pending'` aunque Transbank ya haya cobrado. `src/jobs/reconcilePendingOrders.js`
resuelve esto: cada cierto tiempo revisa los pedidos `pending` con más de
`RECONCILE_GRACE_MINUTES` (default 10) desde su creación, les pregunta a
Transbank su estado real (`tx.status(token)`), y corrige:

- Si Transbank confirma `AUTHORIZED` → el pedido se recupera como `paid` (y recién ahí se limpia el carrito).
- Si Transbank dice cualquier otra cosa, o el token ya no existe/expiró → `failed`.
- Si el pedido nunca llegó a iniciar el pago (sin `webpay_token`) → `cancelled`.

Corre de dos formas, no excluyentes:

1. **Automática, dentro del proceso web**: activada por defecto (un
   `setInterval` cada 5 minutos). Para desactivarla, `DISABLE_INPROCESS_RECONCILER=true`.
2. **Cron real** (recomendado para producción, porque no depende de que el
   proceso web seguir vivo): `npm run reconcile`, agendado por ejemplo cada 5
   minutos vía `cron` del sistema operativo o el scheduler de tu hosting.

También se puede disparar a mano por un admin logueado: `POST /api/admin/reconcile`.

## 6. Fase B — sesión revocable, bloqueo de login y cabeceras de seguridad

- **Sesión revocable de verdad**: el JWT ya no alcanza por sí solo. Cada login crea una fila en `sessions`, y el token solo la referencia (`sid`). `requireAuth`/`requireAdmin` validan en cada request que esa sesión siga existiendo, sin revocar y sin vencer. `POST /api/auth/logout` revoca la sesión actual; `POST /api/auth/logout-all` revoca todas las sesiones del usuario (todos los dispositivos) — útil si se sospecha que un token quedó comprometido.
- **Bloqueo progresivo por cuenta**: 5 intentos fallidos seguidos → 1 minuto de bloqueo; 8 → 15 minutos; 12 → 1 hora. Se resetea a 0 en cualquier login exitoso.
- **Rate limiting por IP** en `/api/auth/login` y `/api/auth/register` (30 requests / 15 min), complementario al bloqueo por cuenta: uno corta fuerza bruta contra un solo correo, el otro corta ataques distribuidos contra muchos correos desde la misma IP.
- **`helmet`** activado (CSP desactivado a propósito porque esta API solo devuelve JSON, nunca HTML que el navegador renderice; `Cross-Origin-Resource-Policy` en `cross-origin` porque el frontend vive en otro origen).

Con sesiones ahora revocables en base de datos, cada request autenticado hace
una consulta extra a `sessions`. A la escala actual es irrelevante; si el
tráfico crece mucho, cachear sesiones válidas en memoria (con invalidación al
revocar) sería el siguiente paso natural — lo dejo como nota, no lo implementé
para no adelantarme a un problema que todavía no existe.

## 7. Fase C — catálogo migrado a Postgres

El contenido de marketing que antes vivía hardcodeado en el `PRODUCTS` estático
de `store.js` (descripciones, badges, ecuaciones, FAQ, tablas de
compatibilidad, historial de versiones) ahora vive en la tabla `products`.
`GET /api/products` y `GET /api/products/:id` devuelven todo ese contenido
junto con el precio — el frontend ya no necesita tener ningún dato de
producto guardado localmente.

Para poblarlo:

```bash
npm run seed:generate   # regenera db/seed.sql desde ../nutrimetria-inventory.js
npm run migrate         # crea tablas + carga los 32 productos
```

**Fuente de datos única.** Los 32 productos viven en
`../nutrimetria-inventory.js`, que es también lo que consume el frontend.
`db/seed.sql` se genera desde ahí con `db/generate-seed.js` y no debe
editarse a mano: si lo editas, el catálogo y la base se desincronizan. Para
cambiar un precio, un nombre o una descripción, edita el inventario y vuelve a
generar.

El mapa completo NMX ↔ Excel ↔ portafolio PDF ↔ portafolio DOCX, con el nombre
original de cada archivo, está en `db/asset-map.json`.

Las 18 versiones que los archivos declaran como `NO_CONFIRMADO` se guardan como
`PENDIENTE_DE_VALIDACION`, no como una versión inventada.

Decisión de diseño: los campos con forma variable (`tabs`, `results`,
`equations`, `sources`, `instructions`, `functions`, `variables`, `compat`,
`faq`, `version_history`) quedan en columnas `JSONB`, no en tablas separadas
normalizadas. Ningún punto de la app filtra o consulta por su contenido
interno — siempre se leen completos, por producto — así que normalizarlos
agregaría complejidad sin ningún beneficio real a esta escala (5 productos).
Si el catálogo creciera mucho y necesitaras, por ejemplo, buscar "productos
que usan la ecuación de Harris-Benedict", ahí sí valdría la pena revisar esta
decisión.

Las portadas se calculan en el frontend desde el id del producto
(`assets/img/covers/{id}.png`) — es una convención de nombres, no contenido
editorial, así que no se guarda en la base.

### Contenido de `secure-files/` (NUNCA servir como estático)

```
secure-files/
├── excel/              32 libros Excel (NMX-01.xlsx … NMX-P1.xlsx)
├── portfolios-docx/    32 portafolios editables
├── master/             Portafolio Maestro DOCX
└── audit/              Índice maestro, 2 matrices, auditoría
```

Los 32 portafolios en PDF **no** están acá: son públicos y viven en
`../public/documentation/portfolios/`.

## 8. Preparación para producción real (última parte de la Fase C)

- **CORS multi-dominio**: `FRONTEND_URL` ahora admite una lista separada por comas (ej. `https://app.tudominio.cl,https://www.tudominio.cl`), para el caso típico de dominio con y sin "www", o staging + producción a la vez. Probé con Postgres real que un origen de la lista se acepta y uno fuera de la lista se rechaza.
- **Cookie de sesión configurable (`COOKIE_SAME_SITE`)**: por defecto `lax`, que funciona si el frontend y este backend quedan en subdominios del mismo dominio raíz. **Si en producción terminan en dominios completamente distintos** (típico con hosting gratuito: un dominio de Vercel/Netlify para el frontend y uno de Render/Railway para el backend), hay que setear `COOKIE_SAME_SITE=none` — y ahí el código fuerza `secure: true` automáticamente (los navegadores rechazan directamente `SameSite=None` sin `Secure`, así que esto no es opcional). Verifiqué el header `Set-Cookie` real en ambos modos.
- **Validación de arranque (`src/utils/validateProductionConfig.js`)**: con `NODE_ENV=production`, el servidor **rechaza arrancar** (exit code 1, con el detalle de qué falta) si: `TRANSBANK_ENV=production` sin credenciales reales configuradas, o `JWT_SECRET` ausente o demasiado corto. Antes de esto, cualquiera de esos dos errores se habría descubierto recién en el primer intento de pago real de un cliente. Además avisa (sin bloquear) si `FRONTEND_URL` todavía apunta a `localhost` con `NODE_ENV=production`.

## 9. Login con Google y Apple

Dos endpoints nuevos, que terminan en exactamente el mismo tipo de sesión que
el login por contraseña (misma cookie, misma tabla `sessions`, mismo
`GET /api/auth/me`):

- `POST /api/auth/oauth/google` — body `{ idToken }` (el ID token que entrega Google Identity Services en el navegador).
- `POST /api/auth/oauth/apple` — body `{ idToken }` (el ID token que entrega el flujo de "Sign in with Apple").

**Cómo decide crear cuenta nueva vs. entrar a una existente** (`src/services/oauthAccountLinking.js`):
1. Si ya existe esa identidad exacta (mismo proveedor + mismo id de usuario de Google/Apple) → entra a esa cuenta.
2. Si no, y el proveedor confirma el email como **verificado**, y ya existe una cuenta con ese email (por ejemplo, alguien que se registró antes con contraseña) → vincula esta identidad a esa cuenta existente.
3. Si el email **no** viene verificado, nunca se vincula a una cuenta preexistente — evita que alguien reclame una cuenta ajena con un email no confirmado. Si ese email no verificado coincide con una cuenta ya existente, el login se rechaza con un mensaje claro (409) en vez de fallar feo contra la restricción de email único.
4. Si no existe nada de lo anterior → crea una cuenta nueva (`password_hash` queda `NULL`: estas cuentas no tienen contraseña propia). El rol se asigna con la misma allowlist de `ADMIN_EMAILS` que usa el registro normal.

Probé los 4 casos de punta a punta contra Postgres real, más la verificación
de firma de Apple contra un JWKS simulado (con casos de audience falso,
issuer falso, y token con firma manipulada — los 3 se rechazan).

**Credenciales que tienes que conseguir tú** (no puedo generarlas, son específicas de tu proyecto real):
- **Google**: gratis. Crea un "OAuth Client ID" tipo *Web application* en Google Cloud Console, agrega el dominio real de tu frontend a "Authorized JavaScript origins", y pon ese Client ID en `GOOGLE_CLIENT_ID`.
- **Apple**: **requiere Apple Developer Program, de pago (~99 USD/año)** — esto es una diferencia real de costo que vale la pena que sepas antes de comprometerte a ofrecer login con Apple. Se configura un "Services ID" (no el App ID) en el portal de desarrolladores de Apple, y ese identificador va en `APPLE_CLIENT_ID`.

**Nota sobre "que no caduque"**: subí la duración de sesión de 7 días a
`SESSION_DURATION_DAYS=3650` (~10 años, configurable), aplicado a **todos**
los logins (contraseña, Google, y Apple) — no solo a estos dos nuevos, para
no tener dos comportamientos de sesión distintos conviviendo en el mismo
sistema. Sigue siendo revocable en cualquier momento vía `logout`/`logout-all`;
lo único que cambia es cuánto dura si nadie la revoca a mano. Vale la pena
que tengas presente el trade-off: si el dispositivo de alguien es robado y no
se revoca la sesión, ese acceso queda vivo mucho tiempo.

## 10. Lo que falta para conectar el frontend actual

La Fase 6 ya conectó login, carrito, checkout y confirmación a esta API — eso
está resuelto. Lo único que falta es adaptar el catálogo a los nuevos campos
de marketing que ahora vienen del backend:

- **Resuelto**: `store.js` ya no tiene datos de producto locales; `getProduct(id)` y `getAllProducts()` son asíncronos contra la API. El detalle de producto es ahora `Nmx.dc.html?id=<id>`, que deriva su contenido de `nutrimetria-inventory.js`.
- **Resuelto**: `db/marketing-content.json` y `db/migrateMarketingContent.js` se eliminaron. Duplicaban el inventario; `db/generate-seed.js` ocupa su lugar.


## 11. Qué no incluye esta versión (quedó fuera del alcance que elegiste)

- CRUD completo de productos/cupones/clientes desde el panel Admin (elegiste
  "solo lo esencial + pago real", no "panel admin completo"). Lo que sí
  incluye: rol `admin` real vía JWT, y `GET /api/orders/:orderCode` ya
  respeta ese rol para que un admin pueda ver cualquier pedido.
- Envío de correo transaccional con el link de descarga (el propio prototipo
  ya avisaba que esto quedaba pendiente para la implementación final).
