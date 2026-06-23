var W = Object.defineProperty;
var z = (r, o, s) => o in r ? W(r, o, { enumerable: !0, configurable: !0, writable: !0, value: s }) : r[o] = s;
var T = (r, o, s) => z(r, typeof o != "symbol" ? o + "" : o, s);
const ne = 1, oe = "0.0.1";
class C extends Error {
  constructor(s, l) {
    super(s);
    T(this, "status");
    T(this, "code");
    T(this, "body");
    this.name = "StorefrontError", this.status = l.status, this.code = l.code ?? null, this.body = l.body ?? null;
  }
}
const B = "X-Commerce-Contract-Version", E = "X-CSRF-Token", Y = "cms_csrf";
function Z() {
  if (typeof document > "u" || typeof document.cookie != "string") return null;
  for (const r of document.cookie.split(";")) {
    const o = r.indexOf("=");
    if (o !== -1 && r.slice(0, o).trim() === Y)
      return decodeURIComponent(r.slice(o + 1).trim());
  }
  return null;
}
function ee(r, o, s) {
  const l = r.replace(/\/+$/, ""), n = o.startsWith("/") ? o : `/${o}`;
  if (!s) return `${l}${n}`;
  const g = new URLSearchParams();
  for (const [f, m] of Object.entries(s))
    if (m != null)
      if (Array.isArray(m))
        for (const S of m) g.append(f, String(S));
      else
        g.set(f, String(m));
  const h = g.toString();
  return h ? `${l}${n}?${h}` : `${l}${n}`;
}
function re(r) {
  const o = r.fetch ?? globalThis.fetch;
  if (typeof o != "function")
    throw new Error(
      "@cms/storefront: no fetch implementation available — pass `fetch` in the config for this runtime."
    );
  const s = r.credentials ?? "include", l = {
    "X-Project-Slug": r.projectSlug,
    [B]: String(1),
    ...r.headers
  };
  async function n(e, t = {}) {
    const c = ee(r.apiUrl, e, t.query), d = { ...l, ...t.headers };
    let p;
    t.body !== void 0 && (p = JSON.stringify(t.body), d["Content-Type"] = "application/json");
    const R = (t.method ?? (t.body !== void 0 ? "POST" : "GET")).toUpperCase();
    if (R !== "GET" && R !== "HEAD" && !(E in d)) {
      const a = Z();
      a && (d[E] = a);
    }
    let y;
    try {
      y = await o(c, {
        method: t.method ?? (t.body !== void 0 ? "POST" : "GET"),
        headers: d,
        body: p,
        credentials: t.credentials ?? s,
        signal: t.signal
      });
    } catch (a) {
      throw new C(
        `Network request to ${c} failed: ${(a == null ? void 0 : a.message) ?? String(a)}`,
        { status: 0 }
      );
    }
    const O = await y.text();
    let u = null;
    if (O)
      try {
        u = JSON.parse(O);
      } catch {
        u = O;
      }
    if (!y.ok) {
      const a = u && typeof u == "object" && "error" in u ? String(u.error) : null;
      throw new C(
        `Request to ${c} failed with ${y.status}${a ? ` (${a})` : ""}`,
        { status: y.status, code: a, body: u }
      );
    }
    return u;
  }
  async function g() {
    return n("/api/commerce/health");
  }
  async function h() {
    const { contractVersion: e } = await g();
    return {
      sdk: 1,
      api: e,
      compatible: e === 1
    };
  }
  function f(e = {}) {
    const t = [];
    if (e.options)
      for (const [c, d] of Object.entries(e.options))
        for (const p of d) t.push(`${c}:${p}`);
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
    return n("/api/commerce/catalog/products", {
      query: f(e),
      signal: e.signal
    });
  }
  async function S(e, t = {}) {
    return n(`/api/commerce/catalog/products/${encodeURIComponent(e)}`, {
      query: { locale: t.locale },
      signal: t.signal
    });
  }
  async function b(e = {}) {
    return (await n("/api/commerce/catalog/categories", {
      query: { locale: e.locale },
      signal: e.signal
    })).data;
  }
  async function w(e, t = {}) {
    return n(`/api/commerce/catalog/categories/${encodeURIComponent(e)}`, {
      query: f(t),
      signal: t.signal
    });
  }
  function i(e) {
    return e ? { locale: e } : void 0;
  }
  async function P(e = {}) {
    return n("/api/commerce/cart", { query: i(e.locale), signal: e.signal });
  }
  async function $(e, t = 1, c = {}) {
    return n("/api/commerce/cart/items", {
      method: "POST",
      body: { variantId: e, quantity: t },
      query: i(c.locale),
      signal: c.signal
    });
  }
  async function q(e, t, c = {}) {
    return n(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "PUT",
      body: { quantity: t },
      query: i(c.locale),
      signal: c.signal
    });
  }
  async function N(e, t = {}) {
    return n(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "DELETE",
      query: i(t.locale),
      signal: t.signal
    });
  }
  async function k(e = {}) {
    return n("/api/commerce/cart", { method: "DELETE", query: i(e.locale), signal: e.signal });
  }
  async function I(e, t = {}) {
    return n("/api/commerce/cart/coupon", {
      method: "POST",
      body: { code: e },
      query: i(t.locale),
      signal: t.signal
    });
  }
  async function v(e = {}) {
    return n("/api/commerce/cart/coupon", {
      method: "DELETE",
      query: i(e.locale),
      signal: e.signal
    });
  }
  async function _(e = {}) {
    return n("/api/commerce/cart/shipping", {
      query: { country: e.country, locale: e.locale },
      signal: e.signal
    });
  }
  async function U(e, t = {}) {
    return n("/api/commerce/cart/shipping", {
      method: "PUT",
      body: e,
      query: i(t.locale),
      signal: t.signal
    });
  }
  async function A(e = {}) {
    return n("/api/commerce/checkout", {
      query: i(e.locale),
      signal: e.signal
    });
  }
  async function V(e, t = {}) {
    return n("/api/commerce/checkout", {
      method: "POST",
      body: e,
      query: i(t.locale),
      signal: t.signal
    });
  }
  async function F(e, t = {}) {
    return n(`/api/commerce/orders/${encodeURIComponent(e)}`, {
      signal: t.signal
    });
  }
  async function x(e = {}) {
    return (await n("/api/commerce/customers/csrf", { signal: e.signal })).token;
  }
  async function D(e, t = {}) {
    return (await n("/api/commerce/customers/register", {
      method: "POST",
      body: e,
      signal: t.signal
    })).customer;
  }
  async function j(e, t = {}) {
    return (await n("/api/commerce/customers/login", {
      method: "POST",
      body: e,
      signal: t.signal
    })).customer;
  }
  async function H(e = {}) {
    await n("/api/commerce/customers/logout", {
      method: "POST",
      signal: e.signal
    });
  }
  async function L(e = {}) {
    try {
      return (await n("/api/commerce/customers/me", { signal: e.signal })).customer;
    } catch (t) {
      if (t instanceof C && t.status === 401) return null;
      throw t;
    }
  }
  async function G(e, t = {}) {
    return n(
      `/api/commerce/customers/token/${encodeURIComponent(e)}`,
      { signal: t.signal }
    );
  }
  async function Q(e, t = {}) {
    return n("/api/commerce/customers/verify-email", {
      method: "POST",
      body: { token: e },
      signal: t.signal
    });
  }
  async function X(e = {}) {
    return n("/api/commerce/customers/resend-verification", {
      method: "POST",
      signal: e.signal
    });
  }
  async function J(e, t = {}) {
    await n("/api/commerce/customers/forgot-password", {
      method: "POST",
      body: { email: e },
      signal: t.signal
    });
  }
  async function K(e, t, c = {}) {
    return (await n("/api/commerce/customers/reset-password", {
      method: "POST",
      body: { token: e, password: t },
      signal: c.signal
    })).customer;
  }
  async function M(e, t, c = {}) {
    await n("/api/commerce/customers/change-password", {
      method: "POST",
      body: { currentPassword: e, newPassword: t },
      signal: c.signal
    });
  }
  return {
    contractVersion: 1,
    request: n,
    health: g,
    checkContract: h,
    listProducts: m,
    getProduct: S,
    listCategories: b,
    getCategory: w,
    getCart: P,
    addCartItem: $,
    setCartItemQuantity: q,
    removeCartItem: N,
    clearCart: k,
    applyCoupon: I,
    removeCoupon: v,
    getShippingMethods: _,
    setShipping: U,
    previewCheckout: A,
    startCheckout: V,
    getOrder: F,
    getCsrfToken: x,
    register: D,
    login: j,
    logout: H,
    getCustomer: L,
    getTokenInfo: G,
    verifyEmail: Q,
    resendVerification: X,
    forgotPassword: J,
    resetPassword: K,
    changePassword: M
  };
}
export {
  B as CONTRACT_VERSION_HEADER,
  ne as STOREFRONT_CONTRACT_VERSION,
  oe as STOREFRONT_SDK_VERSION,
  C as StorefrontError,
  re as createStorefrontClient
};
