var Y = Object.defineProperty;
var Z = (o, r, s) => r in o ? Y(o, r, { enumerable: !0, configurable: !0, writable: !0, value: s }) : o[r] = s;
var T = (o, r, s) => Z(o, typeof r != "symbol" ? r + "" : r, s);
const re = 1, ce = "0.0.1";
class C extends Error {
  constructor(s, u) {
    super(s);
    T(this, "status");
    T(this, "code");
    T(this, "body");
    this.name = "StorefrontError", this.status = u.status, this.code = u.code ?? null, this.body = u.body ?? null;
  }
}
const ee = "X-Commerce-Contract-Version", E = "X-CSRF-Token", te = "cms_csrf";
function ne() {
  if (typeof document > "u" || typeof document.cookie != "string") return null;
  for (const o of document.cookie.split(";")) {
    const r = o.indexOf("=");
    if (r !== -1 && o.slice(0, r).trim() === te)
      return decodeURIComponent(o.slice(r + 1).trim());
  }
  return null;
}
function w(o, r, s) {
  const u = o.replace(/\/+$/, ""), n = r.startsWith("/") ? r : `/${r}`;
  if (!s) return `${u}${n}`;
  const g = new URLSearchParams();
  for (const [f, m] of Object.entries(s))
    if (m != null)
      if (Array.isArray(m))
        for (const S of m) g.append(f, String(S));
      else
        g.set(f, String(m));
  const h = g.toString();
  return h ? `${u}${n}?${h}` : `${u}${n}`;
}
function se(o) {
  const r = o.fetch ?? globalThis.fetch;
  if (typeof r != "function")
    throw new Error(
      "@cms/storefront: no fetch implementation available — pass `fetch` in the config for this runtime."
    );
  const s = o.credentials ?? "include", u = {
    "X-Project-Slug": o.projectSlug,
    [ee]: String(1),
    ...o.headers
  };
  async function n(e, t = {}) {
    const c = w(o.apiUrl, e, t.query), d = { ...u, ...t.headers };
    let p;
    t.body !== void 0 && (p = JSON.stringify(t.body), d["Content-Type"] = "application/json");
    const R = (t.method ?? (t.body !== void 0 ? "POST" : "GET")).toUpperCase();
    if (R !== "GET" && R !== "HEAD" && !(E in d)) {
      const a = ne();
      a && (d[E] = a);
    }
    let y;
    try {
      y = await r(c, {
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
    let l = null;
    if (O)
      try {
        l = JSON.parse(O);
      } catch {
        l = O;
      }
    if (!y.ok) {
      const a = l && typeof l == "object" && "error" in l ? String(l.error) : null;
      throw new C(
        `Request to ${c} failed with ${y.status}${a ? ` (${a})` : ""}`,
        { status: y.status, code: a, body: l }
      );
    }
    return l;
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
  async function P(e, t = {}) {
    return n(`/api/commerce/catalog/categories/${encodeURIComponent(e)}`, {
      query: f(t),
      signal: t.signal
    });
  }
  function i(e) {
    return e ? { locale: e } : void 0;
  }
  async function $(e = {}) {
    return n("/api/commerce/cart", { query: i(e.locale), signal: e.signal });
  }
  async function q(e, t = 1, c = {}) {
    return n("/api/commerce/cart/items", {
      method: "POST",
      body: { variantId: e, quantity: t },
      query: i(c.locale),
      signal: c.signal
    });
  }
  async function N(e, t, c = {}) {
    return n(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "PUT",
      body: { quantity: t },
      query: i(c.locale),
      signal: c.signal
    });
  }
  async function v(e, t = {}) {
    return n(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "DELETE",
      query: i(t.locale),
      signal: t.signal
    });
  }
  async function I(e = {}) {
    return n("/api/commerce/cart", { method: "DELETE", query: i(e.locale), signal: e.signal });
  }
  async function k(e, t = {}) {
    return n("/api/commerce/cart/coupon", {
      method: "POST",
      body: { code: e },
      query: i(t.locale),
      signal: t.signal
    });
  }
  async function _(e = {}) {
    return n("/api/commerce/cart/coupon", {
      method: "DELETE",
      query: i(e.locale),
      signal: e.signal
    });
  }
  async function U(e = {}) {
    return n("/api/commerce/cart/shipping", {
      query: { country: e.country, locale: e.locale },
      signal: e.signal
    });
  }
  async function A(e, t = {}) {
    return n("/api/commerce/cart/shipping", {
      method: "PUT",
      body: e,
      query: i(t.locale),
      signal: t.signal
    });
  }
  async function V(e = {}) {
    return n("/api/commerce/checkout", {
      query: i(e.locale),
      signal: e.signal
    });
  }
  async function F(e, t = {}) {
    return n("/api/commerce/checkout", {
      method: "POST",
      body: e,
      query: i(t.locale),
      signal: t.signal
    });
  }
  async function x(e, t = {}) {
    return n(`/api/commerce/orders/${encodeURIComponent(e)}`, {
      signal: t.signal
    });
  }
  async function D(e = {}) {
    return (await n("/api/commerce/customers/csrf", { signal: e.signal })).token;
  }
  async function j(e, t = {}) {
    return (await n("/api/commerce/customers/register", {
      method: "POST",
      body: e,
      signal: t.signal
    })).customer;
  }
  async function L(e, t = {}) {
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
  async function G(e = {}) {
    try {
      return (await n("/api/commerce/customers/me", { signal: e.signal })).customer;
    } catch (t) {
      if (t instanceof C && t.status === 401) return null;
      throw t;
    }
  }
  async function Q(e, t = {}) {
    return n(
      `/api/commerce/customers/token/${encodeURIComponent(e)}`,
      { signal: t.signal }
    );
  }
  async function X(e, t = {}) {
    return n("/api/commerce/customers/verify-email", {
      method: "POST",
      body: { token: e },
      signal: t.signal
    });
  }
  async function J(e = {}) {
    return n("/api/commerce/customers/resend-verification", {
      method: "POST",
      signal: e.signal
    });
  }
  async function K(e, t = {}) {
    await n("/api/commerce/customers/forgot-password", {
      method: "POST",
      body: { email: e },
      signal: t.signal
    });
  }
  async function M(e, t, c = {}) {
    return (await n("/api/commerce/customers/reset-password", {
      method: "POST",
      body: { token: e, password: t },
      signal: c.signal
    })).customer;
  }
  async function W(e, t, c = {}) {
    await n("/api/commerce/customers/change-password", {
      method: "POST",
      body: { currentPassword: e, newPassword: t },
      signal: c.signal
    });
  }
  async function z(e = {}) {
    return (await n("/api/commerce/customers/oauth/providers", {
      signal: e.signal
    })).providers ?? [];
  }
  function B(e, t = {}) {
    return w(o.apiUrl, `/api/commerce/customers/oauth/${encodeURIComponent(e)}/start`, {
      returnLocale: t.returnLocale
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
    getCategory: P,
    getCart: $,
    addCartItem: q,
    setCartItemQuantity: N,
    removeCartItem: v,
    clearCart: I,
    applyCoupon: k,
    removeCoupon: _,
    getShippingMethods: U,
    setShipping: A,
    previewCheckout: V,
    startCheckout: F,
    getOrder: x,
    getCsrfToken: D,
    register: j,
    login: L,
    logout: H,
    getCustomer: G,
    getTokenInfo: Q,
    verifyEmail: X,
    resendVerification: J,
    forgotPassword: K,
    resetPassword: M,
    changePassword: W,
    listOAuthProviders: z,
    oauthStartUrl: B
  };
}
export {
  ee as CONTRACT_VERSION_HEADER,
  re as STOREFRONT_CONTRACT_VERSION,
  ce as STOREFRONT_SDK_VERSION,
  C as StorefrontError,
  se as createStorefrontClient
};
