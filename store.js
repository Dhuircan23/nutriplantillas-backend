// Todo el contenido editorial (descripciones, badges, ecuaciones, FAQ, compatibilidad,
// historial de versiones) ahora vive en el backend/Postgres — GET /api/products y
// GET /api/products/:id lo devuelven junto con el precio real.
(function (global) {
  var API_BASE = 'https://api.nutrimetria.cc';

  var BUYNOW_KEY = 'nmx_buynow_v1';

  // Sesión en memoria cacheada por getSession() (ver más abajo) — se limpia acá
  // mismo cuando el interceptor detecta un 401 real de sesión expirada/revocada.
  var _cachedSession = null;

  // Interceptor central de errores HTTP. Todas las funciones de este archivo pasan
  // por acá — no se debe duplicar este manejo en las páginas ni en otras funciones.
  //   401 -> sesión expirada/revocada: limpia el cache en memoria y redirige a Login
  //          con ?reason=session_expired. Excepción: getSession() (opts.isSessionCheck)
  //          llama a /api/auth/me para *averiguar* si hay sesión — un 401 ahí es un
  //          resultado normal ("no hay sesión"), no un evento de expiración, así que
  //          nunca debe disparar la redirección (si no, páginas públicas como Home
  //          rebotarían a Login solo por chequear el estado del Header).
  //   429   -> bloqueo por intentos fallidos / rate limit: no redirige, se deja pasar
  //          el error tal cual para que el formulario muestre el mensaje del backend.
  //   500 / red caída -> mensaje genérico, sin detalles técnicos.
  async function apiFetch(path, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    var res;
    try {
      res = await fetch(API_BASE + path, {
        credentials: 'include',
        method: opts.method || 'GET',
        headers: headers,
        body: opts.body
      });
    } catch (networkErr) {
      throw new Error('Algo salió mal de nuestro lado. Intenta de nuevo en un momento.');
    }
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      if (res.status === 401 && !opts.isSessionCheck) {
        _cachedSession = null;
        try { global.dispatchEvent(new Event('nmx:session-changed')); } catch (e) {}
        if (typeof global.location !== 'undefined' && !/\/?Login\.dc\.html/i.test(global.location.pathname)) {
          global.location.href = 'Login.dc.html?reason=session_expired';
        }
        var expiredErr = new Error('Tu sesión expiró, inicia sesión de nuevo.');
        expiredErr.status = 401;
        throw expiredErr;
      }
      if (res.status === 429) {
        var rateErr = new Error((data && data.error) || 'Demasiados intentos. Intenta de nuevo más tarde.');
        rateErr.status = 429;
        rateErr.data = data;
        throw rateErr;
      }
      if (res.status >= 500) {
        var serverErr = new Error('Algo salió mal de nuestro lado. Intenta de nuevo en un momento.');
        serverErr.status = res.status;
        throw serverErr;
      }
      var err = new Error((data && data.error) || ('Error de red (' + res.status + ')'));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function getProduct(id) {
    try { return (await apiFetch('/api/products/' + encodeURIComponent(id))).product; }
    catch (e) { return null; }
  }
  async function getAllProducts() { return (await apiFetch('/api/products')).products; }

  // GET /api/products — la API ya devuelve todo el contenido junto (editorial + precio real).
  async function getCatalog() {
    var apiProducts = (await apiFetch('/api/products')).products;
    return apiProducts.map(function (p) {
      return Object.assign({}, p, { priceLabel: '$' + p.price_clp.toLocaleString('es-CL') + ' CLP' });
    });
  }

  async function getSession() {
    try {
      var d = await apiFetch('/api/auth/me', { isSessionCheck: true });
      _cachedSession = d.user;
      return d.user;
    } catch (e) {
      _cachedSession = null;
      return null;
    }
  }
  async function login(email, password) {
    var d = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: email, password: password }) });
    try { global.dispatchEvent(new Event('nmx:session-changed')); } catch (e) {}
    return d.user;
  }
  async function loginWithGoogle(idToken) {
    var d = await apiFetch('/api/auth/oauth/google', { method: 'POST', body: JSON.stringify({ idToken: idToken }) });
    try { global.dispatchEvent(new Event('nmx:session-changed')); } catch (e) {}
    return d.user;
  }
  async function loginWithApple(idToken) {
    var d = await apiFetch('/api/auth/oauth/apple', { method: 'POST', body: JSON.stringify({ idToken: idToken }) });
    try { global.dispatchEvent(new Event('nmx:session-changed')); } catch (e) {}
    return d.user;
  }
  async function register(email, password) {
    var d = await apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ email: email, password: password }) });
    try { global.dispatchEvent(new Event('nmx:session-changed')); } catch (e) {}
    return d.user;
  }
  async function logout() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    try { global.dispatchEvent(new Event('nmx:session-changed')); } catch (e) {}
    try { global.dispatchEvent(new Event('nmx:cart-changed')); } catch (e) {}
  }

  async function updateProfile(fields) {
    return await apiFetch('/api/auth/me', { method: 'PATCH', body: JSON.stringify(fields) });
  }
  async function changePassword(currentPassword, newPassword) {
    return await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: currentPassword, newPassword: newPassword })
    });
  }

  async function addToCart(productId) {
    await apiFetch('/api/cart', { method: 'POST', body: JSON.stringify({ productId: productId }) });
    try { global.dispatchEvent(new Event('nmx:cart-changed')); } catch (e) {}
  }
  async function removeFromCart(productId) {
    await apiFetch('/api/cart/' + encodeURIComponent(productId), { method: 'DELETE' });
    try { global.dispatchEvent(new Event('nmx:cart-changed')); } catch (e) {}
  }
  async function getCartItems() {
    var items = (await apiFetch('/api/cart')).items;
    return items.map(function (it) {
      return Object.assign({}, it, { priceLabel: '$' + it.price_clp.toLocaleString('es-CL') + ' CLP' });
    });
  }
  async function getCartCount() {
    try { return (await getCartItems()).length; } catch (e) { return 0; }
  }

  // "Comprar ahora" solo necesita sobrevivir la navegación de la ficha NMX -> Checkout.dc.html,
  // no forma parte del contrato del backend — se guarda aparte del carrito real.
  function setBuyNow(productId) {
    try { global.sessionStorage.setItem(BUYNOW_KEY, JSON.stringify([productId])); } catch (e) {}
  }
  function clearBuyNow() {
    try { global.sessionStorage.removeItem(BUYNOW_KEY); } catch (e) {}
  }
  function getBuyNowIds() {
    try {
      var v = JSON.parse(global.sessionStorage.getItem(BUYNOW_KEY));
      return Array.isArray(v) && v.length ? v : null;
    } catch (e) { return null; }
  }

  async function createOrder() {
    var buyNowIds = getBuyNowIds();
    var body = buyNowIds ? { productIds: buyNowIds } : {};
    var order = (await apiFetch('/api/orders', { method: 'POST', body: JSON.stringify(body) })).order;
    clearBuyNow();
    return order;
  }
  async function getOrder(orderCode) {
    return (await apiFetch('/api/orders/' + encodeURIComponent(orderCode))).order;
  }
  async function getMyOrders() {
    return (await apiFetch('/api/orders')).orders;
  }
  async function initPayment(orderCode) {
    return await apiFetch('/api/payments/' + encodeURIComponent(orderCode) + '/init', { method: 'POST' });
  }
  // assetType: 'excel' (el libro comprado) o 'portfolio' (su portafolio DOCX).
  // El backend deriva el archivo del SKU del producto; acá solo se elige cual de
  // los dos, nunca un nombre ni una ruta.
  // --- Flujo manual de pagos (PAYMENT_PROVIDER=manual, sin Transbank) --------
  async function adminListOrders() {
    return (await apiFetch('/api/admin/orders')).orders;
  }
  async function adminConfirmManualPayment(orderCode) {
    return await apiFetch('/api/admin/orders/' + encodeURIComponent(orderCode) + '/confirm-manual', { method: 'POST' });
  }
  async function adminGetStats() {
    return await apiFetch('/api/admin/stats');
  }
  async function adminGetCustomers() {
    return (await apiFetch('/api/admin/customers')).customers;
  }
  async function adminGetProducts() {
    return (await apiFetch('/api/admin/products')).products;
  }

  function downloadUrl(orderItemId, assetType) {
    var base = API_BASE + '/api/downloads/' + encodeURIComponent(orderItemId);
    return assetType ? base + '/' + encodeURIComponent(assetType) : base;
  }

  global.NMXStore = {
    API_BASE: API_BASE,
    getProduct: getProduct,
    getAllProducts: getAllProducts,
    getCatalog: getCatalog,
    getSession: getSession,
    login: login,
    loginWithGoogle: loginWithGoogle,
    loginWithApple: loginWithApple,
    register: register,
    logout: logout,
    updateProfile: updateProfile,
    changePassword: changePassword,
    addToCart: addToCart,
    removeFromCart: removeFromCart,
    getCartItems: getCartItems,
    getCartCount: getCartCount,
    setBuyNow: setBuyNow,
    clearBuyNow: clearBuyNow,
    getBuyNowIds: getBuyNowIds,
    createOrder: createOrder,
    getOrder: getOrder,
    getMyOrders: getMyOrders,
    initPayment: initPayment,
    adminListOrders: adminListOrders,
    adminConfirmManualPayment: adminConfirmManualPayment,
    adminGetStats: adminGetStats,
    adminGetCustomers: adminGetCustomers,
    adminGetProducts: adminGetProducts,
    downloadUrl: downloadUrl
  };
})(window);
