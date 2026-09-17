var De = Object.defineProperty;
var Fe = (n, r, s) => r in n ? De(n, r, { enumerable: !0, configurable: !0, writable: !0, value: s }) : n[r] = s;
var R = (n, r, s) => Fe(n, typeof r != "symbol" ? r + "" : r, s);
const He = 3, Qe = "0.4.0";
class v extends Error {
  constructor(s, a) {
    super(s);
    R(this, "status");
    R(this, "code");
    R(this, "body");
    this.name = "StorefrontError", this.status = a.status, this.code = a.code ?? null, this.body = a.body ?? null;
  }
}
const je = "X-Commerce-Contract-Version", N = "X-CSRF-Token", We = "cms_csrf";
function xe() {
  if (typeof document > "u" || typeof document.cookie != "string") return null;
  for (const n of document.cookie.split(";")) {
    const r = n.indexOf("=");
    if (r !== -1 && n.slice(0, r).trim() === We)
      return decodeURIComponent(n.slice(r + 1).trim());
  }
  return null;
}
function h(n, r, s) {
  const a = n.replace(/\/+$/, ""), o = r.startsWith("/") ? r : `/${r}`;
  if (!s) return `${a}${o}`;
  const g = new URLSearchParams();
  for (const [y, d] of Object.entries(s))
    if (d != null)
      if (Array.isArray(d))
        for (const E of d) g.append(y, String(E));
      else
        g.set(y, String(d));
  const T = g.toString();
  return T ? `${a}${o}?${T}` : `${a}${o}`;
}
function Ke(n) {
  const r = n.fetch ?? globalThis.fetch;
  if (typeof r != "function")
    throw new Error(
      "@cms/storefront: no fetch implementation available — pass `fetch` in the config for this runtime."
    );
  const s = n.credentials ?? "include", a = {
    "X-Project-Slug": n.projectSlug,
    [je]: String(3),
    ...n.headers
  };
  async function o(e, t = {}) {
    const c = h(n.apiUrl, e, t.query), i = { ...a, ...t.headers };
    let f;
    t.body !== void 0 && (f = JSON.stringify(t.body), i["Content-Type"] = "application/json");
    const O = (t.method ?? (t.body !== void 0 ? "POST" : "GET")).toUpperCase();
    if (O !== "GET" && O !== "HEAD" && !(N in i)) {
      const u = xe();
      u && (i[N] = u);
    }
    let p;
    try {
      p = await r(c, {
        method: t.method ?? (t.body !== void 0 ? "POST" : "GET"),
        headers: i,
        body: f,
        credentials: t.credentials ?? s,
        signal: t.signal
      });
    } catch (u) {
      throw new v(
        `Network request to ${c} failed: ${(u == null ? void 0 : u.message) ?? String(u)}`,
        { status: 0 }
      );
    }
    const P = await p.text();
    let m = null;
    if (P)
      try {
        m = JSON.parse(P);
      } catch {
        m = P;
      }
    if (!p.ok) {
      const u = m && typeof m == "object" && "error" in m ? String(m.error) : null;
      throw new v(
        `Request to ${c} failed with ${p.status}${u ? ` (${u})` : ""}`,
        { status: p.status, code: u, body: m }
      );
    }
    return m;
  }
  async function g() {
    return o("/api/commerce/health");
  }
  async function T() {
    const { contractVersion: e } = await g();
    return {
      sdk: 3,
      api: e,
      compatible: e === 3
    };
  }
  function y(e = {}) {
    const t = [];
    if (e.options)
      for (const [i, f] of Object.entries(e.options))
        for (const O of f) t.push(`${i}:${O}`);
    const c = [];
    if (e.attributes)
      for (const [i, f] of Object.entries(e.attributes))
        f.length && c.push(`${i}:${f.join(",")}`);
    return {
      locale: e.locale,
      category: e.category,
      q: e.q,
      type: e.type,
      option: t.length ? t : void 0,
      attribute: c.length ? c : void 0,
      minPrice: e.minPrice,
      maxPrice: e.maxPrice,
      // omit `inStock` unless true (sending "false" would still filter on the server)
      inStock: e.inStock ? !0 : void 0,
      sort: e.sort,
      limit: e.limit,
      offset: e.offset
    };
  }
  async function d(e = {}) {
    return o("/api/commerce/catalog/products", {
      query: y(e),
      signal: e.signal
    });
  }
  async function E(e, t = {}) {
    return o(`/api/commerce/catalog/products/${encodeURIComponent(e)}`, {
      query: { locale: t.locale },
      signal: t.signal
    });
  }
  async function F(e = {}) {
    return (await o("/api/commerce/catalog/categories", {
      query: { locale: e.locale },
      signal: e.signal
    })).data;
  }
  async function j(e, t = {}) {
    return o(`/api/commerce/catalog/categories/${encodeURIComponent(e)}`, {
      query: y(t),
      signal: t.signal
    });
  }
  async function W(e = {}) {
    return (await o("/api/commerce/catalog/collections", {
      query: { locale: e.locale },
      signal: e.signal
    })).data;
  }
  async function x(e, t = {}) {
    return o(`/api/commerce/catalog/collections/${encodeURIComponent(e)}`, {
      query: { locale: t.locale, limit: t.limit },
      signal: t.signal
    });
  }
  function l(e) {
    return e ? { locale: e } : void 0;
  }
  async function G(e = {}) {
    const t = await o(
      "/api/commerce/price-publications",
      { signal: e.signal }
    ), c = n.apiUrl.replace(/\/+$/, "");
    return t.data.map((i) => ({ ...i, url: `${c}${i.path}` }));
  }
  async function J(e = {}) {
    return o("/api/commerce/cart", { query: l(e.locale), signal: e.signal });
  }
  async function M(e, t = 1, c = {}) {
    return o("/api/commerce/cart/items", {
      method: "POST",
      body: { variantId: e, quantity: t },
      query: l(c.locale),
      signal: c.signal
    });
  }
  async function H(e, t, c = {}) {
    return o(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "PUT",
      body: { quantity: t },
      query: l(c.locale),
      signal: c.signal
    });
  }
  async function Q(e, t = {}) {
    return o(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "DELETE",
      query: l(t.locale),
      signal: t.signal
    });
  }
  async function K(e = {}) {
    return o("/api/commerce/cart", { method: "DELETE", query: l(e.locale), signal: e.signal });
  }
  async function X(e, t = {}) {
    return o("/api/commerce/cart/coupon", {
      method: "POST",
      body: { code: e },
      query: l(t.locale),
      signal: t.signal
    });
  }
  async function z(e, t = {}) {
    const c = e ? `/api/commerce/cart/coupon/${encodeURIComponent(e)}` : "/api/commerce/cart/coupon";
    return o(c, {
      method: "DELETE",
      query: l(t.locale),
      signal: t.signal
    });
  }
  async function B(e = {}) {
    return o("/api/commerce/cart/shipping", {
      query: { country: e.country, locale: e.locale },
      signal: e.signal
    });
  }
  async function Y(e, t = {}) {
    return o("/api/commerce/cart/shipping", {
      method: "PUT",
      body: e,
      query: l(t.locale),
      signal: t.signal
    });
  }
  async function Z(e = {}, t = {}) {
    return o("/api/commerce/pickup-points", {
      query: {
        methodId: e.methodId,
        provider: e.provider,
        country: e.country,
        q: e.q,
        type: e.type,
        limit: e.limit != null ? String(e.limit) : void 0,
        offset: e.offset != null ? String(e.offset) : void 0
      },
      signal: t.signal
    });
  }
  async function ee(e = {}) {
    return o("/api/commerce/checkout", {
      query: l(e.locale),
      signal: e.signal
    });
  }
  async function te(e, t = {}) {
    return o("/api/commerce/checkout", {
      method: "POST",
      body: e,
      query: l(t.locale),
      signal: t.signal
    });
  }
  async function ne(e, t = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}`, {
      signal: t.signal
    });
  }
  function re(e) {
    return h(n.apiUrl, `/api/commerce/orders/${encodeURIComponent(e)}/invoice.pdf`);
  }
  function oe(e) {
    return h(n.apiUrl, `/api/commerce/orders/${encodeURIComponent(e)}/proforma.pdf`);
  }
  function ce(e) {
    return h(n.apiUrl, e);
  }
  async function se(e, t = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/accept`, {
      method: "POST",
      signal: t.signal,
      ...t.paymentMethod ? { body: { paymentMethod: t.paymentMethod } } : {}
    });
  }
  async function ae(e, t = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/decline`, {
      method: "POST",
      signal: t.signal
    });
  }
  async function ie(e, t = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/returns`, {
      signal: t.signal
    });
  }
  async function ue(e, t, c = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/return`, {
      method: "POST",
      body: t,
      signal: c.signal
    });
  }
  async function le(e = {}) {
    return (await o("/api/commerce/customers/csrf", { signal: e.signal })).token;
  }
  async function me(e, t = {}) {
    return (await o("/api/commerce/customers/register", {
      method: "POST",
      body: e,
      signal: t.signal
    })).customer;
  }
  async function de(e, t = {}) {
    return (await o("/api/commerce/customers/login", {
      method: "POST",
      body: e,
      signal: t.signal
    })).customer;
  }
  async function fe(e = {}) {
    await o("/api/commerce/customers/logout", {
      method: "POST",
      signal: e.signal
    });
  }
  async function ge(e = {}) {
    try {
      return (await o("/api/commerce/customers/me", { signal: e.signal })).customer;
    } catch (t) {
      if (t instanceof v && t.status === 401) return null;
      throw t;
    }
  }
  async function ye(e, t = {}) {
    return o(
      `/api/commerce/customers/token/${encodeURIComponent(e)}`,
      { signal: t.signal }
    );
  }
  async function pe(e, t = {}) {
    return o("/api/commerce/customers/verify-email", {
      method: "POST",
      body: { token: e },
      signal: t.signal
    });
  }
  async function he(e = {}) {
    return o("/api/commerce/customers/resend-verification", {
      method: "POST",
      signal: e.signal
    });
  }
  async function Se(e, t = {}) {
    await o("/api/commerce/customers/forgot-password", {
      method: "POST",
      body: { email: e },
      signal: t.signal
    });
  }
  async function Ce(e, t, c = {}) {
    return (await o("/api/commerce/customers/reset-password", {
      method: "POST",
      body: { token: e, password: t },
      signal: c.signal
    })).customer;
  }
  async function we(e, t, c = {}) {
    await o("/api/commerce/customers/change-password", {
      method: "POST",
      body: { currentPassword: e, newPassword: t },
      signal: c.signal
    });
  }
  async function Te(e = {}) {
    return (await o("/api/commerce/customers/addresses", {
      signal: e.signal
    })).addresses ?? [];
  }
  async function Oe(e, t = {}) {
    return (await o("/api/commerce/customers/addresses", {
      method: "POST",
      body: e,
      signal: t.signal
    })).address;
  }
  async function Re(e, t, c = {}) {
    return (await o(
      `/api/commerce/customers/addresses/${encodeURIComponent(e)}`,
      { method: "PUT", body: t, signal: c.signal }
    )).address;
  }
  async function be(e, t = {}) {
    await o(`/api/commerce/customers/addresses/${encodeURIComponent(e)}`, {
      method: "DELETE",
      signal: t.signal
    });
  }
  async function Ie(e = {}) {
    return o("/api/commerce/customers/wishlist", {
      query: { locale: e.locale },
      signal: e.signal
    });
  }
  async function Ee(e, t = {}) {
    return (await o("/api/commerce/customers/wishlist", {
      method: "POST",
      body: { productId: e },
      signal: t.signal
    })).productIds ?? [];
  }
  async function Pe(e, t = {}) {
    return (await o(
      `/api/commerce/customers/wishlist/${encodeURIComponent(e)}`,
      { method: "DELETE", signal: t.signal }
    )).productIds ?? [];
  }
  async function ve(e, t = {}) {
    return o(
      `/api/commerce/catalog/products/${encodeURIComponent(e)}/reviews`,
      {
        query: { limit: t.limit != null ? String(t.limit) : void 0, offset: t.offset != null ? String(t.offset) : void 0 },
        signal: t.signal
      }
    );
  }
  async function $e(e, t, c = {}) {
    return o(
      `/api/commerce/catalog/products/${encodeURIComponent(e)}/reviews`,
      { method: "POST", body: t, signal: c.signal }
    );
  }
  async function Ue(e, t, c = {}) {
    return o(
      `/api/commerce/catalog/products/${encodeURIComponent(e)}/back-in-stock`,
      { method: "POST", body: t, signal: c.signal }
    );
  }
  async function ke(e, t = {}) {
    return o("/api/commerce/consent", {
      method: "POST",
      body: e,
      signal: t.signal
    });
  }
  async function qe(e = {}) {
    return (await o("/api/commerce/customers/orders", {
      signal: e.signal
    })).orders ?? [];
  }
  async function _e(e = {}) {
    return (await o("/api/commerce/customers/oauth/providers", {
      signal: e.signal
    })).providers ?? [];
  }
  function Ne(e, t = {}) {
    return h(n.apiUrl, `/api/commerce/customers/oauth/${encodeURIComponent(e)}/start`, {
      returnLocale: t.returnLocale
    });
  }
  async function Ae(e = {}) {
    return (await o("/api/commerce/payments/providers", {
      signal: e.signal
    })).providers ?? [];
  }
  async function Le(e, t, c = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/pay`, {
      method: "POST",
      body: { provider: t },
      signal: c.signal
    });
  }
  async function Ve(e, t = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/payment/refresh`, {
      method: "POST",
      signal: t.signal
    });
  }
  return {
    contractVersion: 3,
    request: o,
    health: g,
    checkContract: T,
    listProducts: d,
    getProduct: E,
    listCategories: F,
    getCategory: j,
    listCollections: W,
    getCollection: x,
    listPricePublications: G,
    getCart: J,
    addCartItem: M,
    setCartItemQuantity: H,
    removeCartItem: Q,
    clearCart: K,
    applyCoupon: X,
    removeCoupon: z,
    getShippingMethods: B,
    setShipping: Y,
    searchPickupPoints: Z,
    previewCheckout: ee,
    startCheckout: te,
    getOrder: ne,
    orderInvoicePdfUrl: re,
    downloadUrl: ce,
    orderProformaPdfUrl: oe,
    acceptQuote: se,
    declineQuote: ae,
    getReturns: ie,
    requestReturn: ue,
    getCsrfToken: le,
    register: me,
    login: de,
    logout: fe,
    getCustomer: ge,
    getTokenInfo: ye,
    verifyEmail: pe,
    resendVerification: he,
    forgotPassword: Se,
    resetPassword: Ce,
    changePassword: we,
    listAddresses: Te,
    createAddress: Oe,
    updateAddress: Re,
    deleteAddress: be,
    getWishlist: Ie,
    addToWishlist: Ee,
    removeFromWishlist: Pe,
    listProductReviews: ve,
    submitReview: $e,
    subscribeBackInStock: Ue,
    recordConsent: ke,
    listMyOrders: qe,
    listOAuthProviders: _e,
    oauthStartUrl: Ne,
    listPaymentProviders: Ae,
    initiatePayment: Le,
    refreshOrderPayment: Ve
  };
}
function Xe(n) {
  if (!/^\d{11}$/.test(n)) return !1;
  let r = 10;
  for (let a = 0; a < 10; a++)
    r = (r + Number(n[a])) % 10, r === 0 && (r = 10), r = r * 2 % 11;
  return (11 - r) % 10 === Number(n[10]);
}
const U = "cms_wishlist";
function k() {
  try {
    return typeof localStorage > "u" ? null : localStorage;
  } catch {
    return null;
  }
}
function A() {
  const n = k();
  if (!n) return [];
  try {
    const r = n.getItem(U);
    if (!r) return [];
    const s = JSON.parse(r);
    return Array.isArray(s) ? s.filter((a) => typeof a == "string") : [];
  } catch {
    return [];
  }
}
function L(n) {
  const r = Array.from(new Set(n)), s = k();
  if (s)
    try {
      s.setItem(U, JSON.stringify(r));
    } catch {
    }
  return r;
}
function ze(n) {
  const r = A().filter((s) => s !== n);
  return L([n, ...r]);
}
function Be(n) {
  return L(A().filter((r) => r !== n));
}
function Ye() {
  const n = k();
  if (n)
    try {
      n.removeItem(U);
    } catch {
    }
}
const q = "cms-consent-v1";
let S = null, $ = !1;
function C() {
  return typeof window < "u" && typeof document < "u";
}
function _() {
  if (!C()) return null;
  try {
    const n = window.localStorage.getItem(q);
    if (!n) return null;
    const r = JSON.parse(n);
    return typeof (r == null ? void 0 : r.analytics) != "boolean" ? null : r;
  } catch {
    return null;
  }
}
function V(n) {
  if (C())
    try {
      const r = {
        ..._(),
        ...n,
        decidedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      window.localStorage.setItem(q, JSON.stringify(r));
    } catch {
    }
}
function Ze() {
  if (C())
    try {
      window.localStorage.removeItem(q);
    } catch {
    }
}
function D() {
  if (!C() || !S || $) return;
  const n = window;
  n.dataLayer = n.dataLayer || [], typeof n.gtag != "function" && (n.gtag = function() {
    n.dataLayer.push(arguments);
  }), n.gtag("js", /* @__PURE__ */ new Date()), n.gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied"
  }), n.gtag("config", S, { anonymize_ip: !0 });
  const r = document.createElement("script");
  r.async = !0, r.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(S)}`, document.head.appendChild(r), $ = !0;
}
function et(n) {
  var r;
  S = n || null, S && ((r = _()) == null ? void 0 : r.analytics) === !0 && D();
}
function tt() {
  V({ analytics: !0 }), D();
}
function nt() {
  V({ analytics: !1 });
}
function Ge() {
  var n;
  return $ && ((n = _()) == null ? void 0 : n.analytics) === !0;
}
function b(n, r) {
  return !C() || !Ge() ? !1 : (window.gtag("event", n, r ?? {}), !0);
}
function w(n) {
  return Math.round(n) / 100;
}
function I(n) {
  return n.map((r) => ({
    item_id: r.id,
    item_name: r.name,
    price: w(r.priceCents),
    quantity: r.quantity ?? 1
  }));
}
function Je(n) {
  return n.reduce((r, s) => r + s.priceCents * (s.quantity ?? 1), 0);
}
function rt(n) {
  return b("view_item", {
    currency: "EUR",
    value: w(n.priceCents),
    items: I([n])
  });
}
function ot(n) {
  return b("add_to_cart", {
    currency: "EUR",
    value: w(n.priceCents * (n.quantity ?? 1)),
    items: I([n])
  });
}
function ct(n, r) {
  return b("begin_checkout", {
    currency: "EUR",
    value: w(r ?? Je(n)),
    items: I(n)
  });
}
function st(n, r, s) {
  return b("purchase", {
    transaction_id: n,
    currency: "EUR",
    value: w(s),
    items: I(r)
  });
}
export {
  q as CONSENT_STORAGE_KEY,
  je as CONTRACT_VERSION_HEADER,
  He as STOREFRONT_CONTRACT_VERSION,
  Qe as STOREFRONT_SDK_VERSION,
  v as StorefrontError,
  ze as addLocalWishlist,
  Ye as clearLocalWishlist,
  Ze as clearStoredConsent,
  Ke as createStorefrontClient,
  nt as denyAnalyticsConsent,
  A as getLocalWishlist,
  _ as getStoredConsent,
  tt as grantAnalyticsConsent,
  et as initAnalytics,
  Ge as isAnalyticsActive,
  Xe as isValidOib,
  Be as removeLocalWishlist,
  L as setLocalWishlist,
  V as storeConsent,
  ot as trackAddToCart,
  ct as trackBeginCheckout,
  b as trackEvent,
  st as trackPurchase,
  rt as trackViewItem
};
