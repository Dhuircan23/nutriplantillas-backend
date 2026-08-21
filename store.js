// Todo el contenido editorial (descripciones, badges, ecuaciones, FAQ, compatibilidad,
// historial de versiones) ahora vive en el backend/Postgres — GET /api/products y
// GET /api/products/:id lo devuelven junto con el precio real.
(function (global) {
  var API_BASE = 'https://nutriplantillas-backend1-production.up.railway.app';

  var BUYNOW_KEY = 'nmx_buynow_v1';

  var _cachedSession = null;

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
