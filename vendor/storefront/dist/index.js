var Ae = Object.defineProperty;
var Le = (n, r, s) => r in n ? Ae(n, r, { enumerable: !0, configurable: !0, writable: !0, value: s }) : n[r] = s;
var O = (n, r, s) => Le(n, typeof r != "symbol" ? r + "" : r, s);
const Ge = 3, Je = "0.1.0";
class P extends Error {
  constructor(s, a) {
    super(s);
    O(this, "status");
    O(this, "code");
    O(this, "body");
    this.name = "StorefrontError", this.status = a.status, this.code = a.code ?? null, this.body = a.body ?? null;
  }
}
const Ve = "X-Commerce-Contract-Version", N = "X-CSRF-Token", De = "cms_csrf";
function Fe() {
  if (typeof document > "u" || typeof document.cookie != "string") return null;
  for (const n of document.cookie.split(";")) {
    const r = n.indexOf("=");
    if (r !== -1 && n.slice(0, r).trim() === De)
      return decodeURIComponent(n.slice(r + 1).trim());
  }
  return null;
}
function p(n, r, s) {
  const a = n.replace(/\/+$/, ""), o = r.startsWith("/") ? r : `/${r}`;
  if (!s) return `${a}${o}`;
  const f = new URLSearchParams();
  for (const [g, m] of Object.entries(s))
    if (m != null)
      if (Array.isArray(m))
        for (const I of m) f.append(g, String(I));
      else
        f.set(g, String(m));
  const w = f.toString();
  return w ? `${a}${o}?${w}` : `${a}${o}`;
}
function Me(n) {
  const r = n.fetch ?? globalThis.fetch;
  if (typeof r != "function")
    throw new Error(
      "@cms/storefront: no fetch implementation available — pass `fetch` in the config for this runtime."
    );
  const s = n.credentials ?? "include", a = {
    "X-Project-Slug": n.projectSlug,
    [Ve]: String(3),
    ...n.headers
  };
  async function o(e, t = {}) {
    const c = p(n.apiUrl, e, t.query), l = { ...a, ...t.headers };
    let T;
    t.body !== void 0 && (T = JSON.stringify(t.body), l["Content-Type"] = "application/json");
    const q = (t.method ?? (t.body !== void 0 ? "POST" : "GET")).toUpperCase();
    if (q !== "GET" && q !== "HEAD" && !(N in l)) {
      const i = Fe();
      i && (l[N] = i);
    }
    let y;
    try {
      y = await r(c, {
        method: t.method ?? (t.body !== void 0 ? "POST" : "GET"),
        headers: l,
        body: T,
        credentials: t.credentials ?? s,
        signal: t.signal
      });
    } catch (i) {
      throw new P(
        `Network request to ${c} failed: ${(i == null ? void 0 : i.message) ?? String(i)}`,
        { status: 0 }
      );
    }
    const v = await y.text();
    let d = null;
    if (v)
      try {
        d = JSON.parse(v);
      } catch {
        d = v;
      }
    if (!y.ok) {
      const i = d && typeof d == "object" && "error" in d ? String(d.error) : null;
      throw new P(
        `Request to ${c} failed with ${y.status}${i ? ` (${i})` : ""}`,
        { status: y.status, code: i, body: d }
      );
    }
    return d;
  }
  async function f() {
    return o("/api/commerce/health");
  }
  async function w() {
    const { contractVersion: e } = await f();
    return {
      sdk: 3,
      api: e,
      compatible: e === 3
    };
  }
  function g(e = {}) {
    const t = [];
    if (e.options)
      for (const [c, l] of Object.entries(e.options))
        for (const T of l) t.push(`${c}:${T}`);
    return {
      locale: e.locale,
      category: e.category,
      q: e.q,
      type: e.type,
      option: t.length ? t : void 0,
      minPrice: e.minPrice,
      maxPrice: e.maxPrice,
      // omit `inStock` unless true (sending "false" would still filter on the server)
      inStock: e.inStock ? !0 : void 0,
      sort: e.sort,
      limit: e.limit,
      offset: e.offset
    };
  }
  async function m(e = {}) {
    return o("/api/commerce/catalog/products", {
      query: g(e),
      signal: e.signal
    });
  }
  async function I(e, t = {}) {
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
  async function W(e, t = {}) {
    return o(`/api/commerce/catalog/categories/${encodeURIComponent(e)}`, {
      query: g(t),
      signal: t.signal
    });
  }
  function u(e) {
    return e ? { locale: e } : void 0;
  }
  async function j(e = {}) {
    return o("/api/commerce/cart", { query: u(e.locale), signal: e.signal });
  }
  async function x(e, t = 1, c = {}) {
    return o("/api/commerce/cart/items", {
      method: "POST",
      body: { variantId: e, quantity: t },
      query: u(c.locale),
      signal: c.signal
    });
  }
  async function G(e, t, c = {}) {
    return o(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "PUT",
      body: { quantity: t },
      query: u(c.locale),
      signal: c.signal
    });
  }
  async function J(e, t = {}) {
    return o(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "DELETE",
      query: u(t.locale),
      signal: t.signal
    });
  }
  async function M(e = {}) {
    return o("/api/commerce/cart", { method: "DELETE", query: u(e.locale), signal: e.signal });
  }
  async function H(e, t = {}) {
    return o("/api/commerce/cart/coupon", {
      method: "POST",
      body: { code: e },
      query: u(t.locale),
      signal: t.signal
    });
  }
  async function Q(e, t = {}) {
    const c = e ? `/api/commerce/cart/coupon/${encodeURIComponent(e)}` : "/api/commerce/cart/coupon";
    return o(c, {
      method: "DELETE",
      query: u(t.locale),
      signal: t.signal
    });
  }
  async function K(e = {}) {
    return o("/api/commerce/cart/shipping", {
      query: { country: e.country, locale: e.locale },
      signal: e.signal
    });
  }
  async function X(e, t = {}) {
    return o("/api/commerce/cart/shipping", {
      method: "PUT",
      body: e,
      query: u(t.locale),
      signal: t.signal
    });
  }
  async function z(e = {}, t = {}) {
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
  async function B(e = {}) {
    return o("/api/commerce/checkout", {
      query: u(e.locale),
      signal: e.signal
    });
  }
  async function Y(e, t = {}) {
    return o("/api/commerce/checkout", {
      method: "POST",
      body: e,
      query: u(t.locale),
      signal: t.signal
    });
  }
  async function Z(e, t = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}`, {
      signal: t.signal
    });
  }
  function ee(e) {
    return p(n.apiUrl, `/api/commerce/orders/${encodeURIComponent(e)}/invoice.pdf`);
  }
  function te(e) {
    return p(n.apiUrl, `/api/commerce/orders/${encodeURIComponent(e)}/proforma.pdf`);
  }
  function ne(e) {
    return p(n.apiUrl, e);
  }
  async function re(e, t = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/accept`, {
      method: "POST",
      signal: t.signal,
      ...t.paymentMethod ? { body: { paymentMethod: t.paymentMethod } } : {}
    });
  }
  async function oe(e, t = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/decline`, {
      method: "POST",
      signal: t.signal
    });
  }
  async function ce(e, t = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/returns`, {
      signal: t.signal
    });
  }
  async function se(e, t, c = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/return`, {
      method: "POST",
      body: t,
      signal: c.signal
    });
  }
  async function ae(e = {}) {
    return (await o("/api/commerce/customers/csrf", { signal: e.signal })).token;
  }
  async function ie(e, t = {}) {
    return (await o("/api/commerce/customers/register", {
      method: "POST",
      body: e,
      signal: t.signal
    })).customer;
  }
  async function ue(e, t = {}) {
    return (await o("/api/commerce/customers/login", {
      method: "POST",
      body: e,
      signal: t.signal
    })).customer;
  }
  async function le(e = {}) {
    await o("/api/commerce/customers/logout", {
      method: "POST",
      signal: e.signal
    });
  }
  async function de(e = {}) {
    try {
      return (await o("/api/commerce/customers/me", { signal: e.signal })).customer;
    } catch (t) {
      if (t instanceof P && t.status === 401) return null;
      throw t;
    }
  }
  async function me(e, t = {}) {
    return o(
      `/api/commerce/customers/token/${encodeURIComponent(e)}`,
      { signal: t.signal }
    );
  }
  async function fe(e, t = {}) {
    return o("/api/commerce/customers/verify-email", {
      method: "POST",
      body: { token: e },
      signal: t.signal
    });
  }
  async function ge(e = {}) {
    return o("/api/commerce/customers/resend-verification", {
      method: "POST",
      signal: e.signal
    });
  }
  async function ye(e, t = {}) {
    await o("/api/commerce/customers/forgot-password", {
      method: "POST",
      body: { email: e },
      signal: t.signal
    });
  }
  async function pe(e, t, c = {}) {
    return (await o("/api/commerce/customers/reset-password", {
      method: "POST",
      body: { token: e, password: t },
      signal: c.signal
    })).customer;
  }
  async function he(e, t, c = {}) {
    await o("/api/commerce/customers/change-password", {
      method: "POST",
      body: { currentPassword: e, newPassword: t },
      signal: c.signal
    });
  }
  async function Se(e = {}) {
    return (await o("/api/commerce/customers/addresses", {
      signal: e.signal
    })).addresses ?? [];
  }
  async function Ce(e, t = {}) {
    return (await o("/api/commerce/customers/addresses", {
      method: "POST",
      body: e,
      signal: t.signal
    })).address;
  }
  async function we(e, t, c = {}) {
    return (await o(
      `/api/commerce/customers/addresses/${encodeURIComponent(e)}`,
      { method: "PUT", body: t, signal: c.signal }
    )).address;
  }
  async function Te(e, t = {}) {
    await o(`/api/commerce/customers/addresses/${encodeURIComponent(e)}`, {
      method: "DELETE",
      signal: t.signal
    });
  }
  async function Oe(e = {}) {
    return o("/api/commerce/customers/wishlist", {
      query: { locale: e.locale },
      signal: e.signal
    });
  }
  async function Re(e, t = {}) {
    return (await o("/api/commerce/customers/wishlist", {
      method: "POST",
      body: { productId: e },
      signal: t.signal
    })).productIds ?? [];
  }
  async function Ee(e, t = {}) {
    return (await o(
      `/api/commerce/customers/wishlist/${encodeURIComponent(e)}`,
      { method: "DELETE", signal: t.signal }
    )).productIds ?? [];
  }
  async function Ie(e, t = {}) {
    return o(
      `/api/commerce/catalog/products/${encodeURIComponent(e)}/reviews`,
      {
        query: { limit: t.limit != null ? String(t.limit) : void 0, offset: t.offset != null ? String(t.offset) : void 0 },
        signal: t.signal
      }
    );
  }
  async function ve(e, t, c = {}) {
    return o(
      `/api/commerce/catalog/products/${encodeURIComponent(e)}/reviews`,
      { method: "POST", body: t, signal: c.signal }
    );
  }
  async function Pe(e, t, c = {}) {
    return o(
      `/api/commerce/catalog/products/${encodeURIComponent(e)}/back-in-stock`,
      { method: "POST", body: t, signal: c.signal }
    );
  }
  async function be(e, t = {}) {
    return o("/api/commerce/consent", {
      method: "POST",
      body: e,
      signal: t.signal
    });
  }
  async function Ue(e = {}) {
    return (await o("/api/commerce/customers/orders", {
      signal: e.signal
    })).orders ?? [];
  }
  async function $e(e = {}) {
    return (await o("/api/commerce/customers/oauth/providers", {
      signal: e.signal
    })).providers ?? [];
  }
  function _e(e, t = {}) {
    return p(n.apiUrl, `/api/commerce/customers/oauth/${encodeURIComponent(e)}/start`, {
      returnLocale: t.returnLocale
    });
  }
  async function ke(e = {}) {
    return (await o("/api/commerce/payments/providers", {
      signal: e.signal
    })).providers ?? [];
  }
  async function qe(e, t, c = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/pay`, {
      method: "POST",
      body: { provider: t },
      signal: c.signal
    });
  }
  async function Ne(e, t = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/payment/refresh`, {
      method: "POST",
      signal: t.signal
    });
  }
  return {
    contractVersion: 3,
    request: o,
    health: f,
    checkContract: w,
    listProducts: m,
    getProduct: I,
    listCategories: F,
    getCategory: W,
    getCart: j,
    addCartItem: x,
    setCartItemQuantity: G,
    removeCartItem: J,
    clearCart: M,
    applyCoupon: H,
    removeCoupon: Q,
    getShippingMethods: K,
    setShipping: X,
    searchPickupPoints: z,
    previewCheckout: B,
    startCheckout: Y,
    getOrder: Z,
    orderInvoicePdfUrl: ee,
    downloadUrl: ne,
    orderProformaPdfUrl: te,
    acceptQuote: re,
    declineQuote: oe,
    getReturns: ce,
    requestReturn: se,
    getCsrfToken: ae,
    register: ie,
    login: ue,
    logout: le,
    getCustomer: de,
    getTokenInfo: me,
    verifyEmail: fe,
    resendVerification: ge,
    forgotPassword: ye,
    resetPassword: pe,
    changePassword: he,
    listAddresses: Se,
    createAddress: Ce,
    updateAddress: we,
    deleteAddress: Te,
    getWishlist: Oe,
    addToWishlist: Re,
    removeFromWishlist: Ee,
    listProductReviews: Ie,
    submitReview: ve,
    subscribeBackInStock: Pe,
    recordConsent: be,
    listMyOrders: Ue,
    listOAuthProviders: $e,
    oauthStartUrl: _e,
    listPaymentProviders: ke,
    initiatePayment: qe,
    refreshOrderPayment: Ne
  };
}
function He(n) {
  if (!/^\d{11}$/.test(n)) return !1;
  let r = 10;
  for (let a = 0; a < 10; a++)
    r = (r + Number(n[a])) % 10, r === 0 && (r = 10), r = r * 2 % 11;
  return (11 - r) % 10 === Number(n[10]);
}
const U = "cms_wishlist";
function $() {
  try {
    return typeof localStorage > "u" ? null : localStorage;
  } catch {
    return null;
  }
}
function A() {
  const n = $();
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
  const r = Array.from(new Set(n)), s = $();
  if (s)
    try {
      s.setItem(U, JSON.stringify(r));
    } catch {
    }
  return r;
}
function Qe(n) {
  const r = A().filter((s) => s !== n);
  return L([n, ...r]);
}
function Ke(n) {
  return L(A().filter((r) => r !== n));
}
function Xe() {
  const n = $();
  if (n)
    try {
      n.removeItem(U);
    } catch {
    }
}
const _ = "cms-consent-v1";
let h = null, b = !1;
function S() {
  return typeof window < "u" && typeof document < "u";
}
function k() {
  if (!S()) return null;
  try {
    const n = window.localStorage.getItem(_);
    if (!n) return null;
    const r = JSON.parse(n);
    return typeof (r == null ? void 0 : r.analytics) != "boolean" ? null : r;
  } catch {
    return null;
  }
}
function V(n) {
  if (S())
    try {
      const r = {
        ...k(),
        ...n,
        decidedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      window.localStorage.setItem(_, JSON.stringify(r));
    } catch {
    }
}
function ze() {
  if (S())
    try {
      window.localStorage.removeItem(_);
    } catch {
    }
}
function D() {
  if (!S() || !h || b) return;
  const n = window;
  n.dataLayer = n.dataLayer || [], typeof n.gtag != "function" && (n.gtag = function() {
    n.dataLayer.push(arguments);
  }), n.gtag("js", /* @__PURE__ */ new Date()), n.gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied"
  }), n.gtag("config", h, { anonymize_ip: !0 });
  const r = document.createElement("script");
  r.async = !0, r.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(h)}`, document.head.appendChild(r), b = !0;
}
function Be(n) {
  var r;
  h = n || null, h && ((r = k()) == null ? void 0 : r.analytics) === !0 && D();
}
function Ye() {
  V({ analytics: !0 }), D();
}
function Ze() {
  V({ analytics: !1 });
}
function We() {
  var n;
  return b && ((n = k()) == null ? void 0 : n.analytics) === !0;
}
function R(n, r) {
  return !S() || !We() ? !1 : (window.gtag("event", n, r ?? {}), !0);
}
function C(n) {
  return Math.round(n) / 100;
}
function E(n) {
  return n.map((r) => ({
    item_id: r.id,
    item_name: r.name,
    price: C(r.priceCents),
    quantity: r.quantity ?? 1
  }));
}
function je(n) {
  return n.reduce((r, s) => r + s.priceCents * (s.quantity ?? 1), 0);
}
function et(n) {
  return R("view_item", {
    currency: "EUR",
    value: C(n.priceCents),
    items: E([n])
  });
}
function tt(n) {
  return R("add_to_cart", {
    currency: "EUR",
    value: C(n.priceCents * (n.quantity ?? 1)),
    items: E([n])
  });
}
function nt(n, r) {
  return R("begin_checkout", {
    currency: "EUR",
    value: C(r ?? je(n)),
    items: E(n)
  });
}
function rt(n, r, s) {
  return R("purchase", {
    transaction_id: n,
    currency: "EUR",
    value: C(s),
    items: E(r)
  });
}
export {
  _ as CONSENT_STORAGE_KEY,
  Ve as CONTRACT_VERSION_HEADER,
  Ge as STOREFRONT_CONTRACT_VERSION,
  Je as STOREFRONT_SDK_VERSION,
  P as StorefrontError,
  Qe as addLocalWishlist,
  Xe as clearLocalWishlist,
  ze as clearStoredConsent,
  Me as createStorefrontClient,
  Ze as denyAnalyticsConsent,
  A as getLocalWishlist,
  k as getStoredConsent,
  Ye as grantAnalyticsConsent,
  Be as initAnalytics,
  We as isAnalyticsActive,
  He as isValidOib,
  Ke as removeLocalWishlist,
  L as setLocalWishlist,
  V as storeConsent,
  tt as trackAddToCart,
  nt as trackBeginCheckout,
  R as trackEvent,
  rt as trackPurchase,
  et as trackViewItem
};
