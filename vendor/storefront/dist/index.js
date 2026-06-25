var ne = Object.defineProperty;
var oe = (r, s, c) => s in r ? ne(r, s, { enumerable: !0, configurable: !0, writable: !0, value: c }) : r[s] = c;
var T = (r, s, c) => oe(r, typeof s != "symbol" ? s + "" : s, c);
const ie = 1, ue = "0.0.1";
class C extends Error {
  constructor(c, u) {
    super(c);
    T(this, "status");
    T(this, "code");
    T(this, "body");
    this.name = "StorefrontError", this.status = u.status, this.code = u.code ?? null, this.body = u.body ?? null;
  }
}
const re = "X-Commerce-Contract-Version", E = "X-CSRF-Token", se = "cms_csrf";
function ce() {
  if (typeof document > "u" || typeof document.cookie != "string") return null;
  for (const r of document.cookie.split(";")) {
    const s = r.indexOf("=");
    if (s !== -1 && r.slice(0, s).trim() === se)
      return decodeURIComponent(r.slice(s + 1).trim());
  }
  return null;
}
function w(r, s, c) {
  const u = r.replace(/\/+$/, ""), n = s.startsWith("/") ? s : `/${s}`;
  if (!c) return `${u}${n}`;
  const g = new URLSearchParams();
  for (const [f, d] of Object.entries(c))
    if (d != null)
      if (Array.isArray(d))
        for (const S of d) g.append(f, String(S));
      else
        g.set(f, String(d));
  const h = g.toString();
  return h ? `${u}${n}?${h}` : `${u}${n}`;
}
function le(r) {
  const s = r.fetch ?? globalThis.fetch;
  if (typeof s != "function")
    throw new Error(
      "@cms/storefront: no fetch implementation available — pass `fetch` in the config for this runtime."
    );
  const c = r.credentials ?? "include", u = {
    "X-Project-Slug": r.projectSlug,
    [re]: String(1),
    ...r.headers
  };
  async function n(e, t = {}) {
    const o = w(r.apiUrl, e, t.query), l = { ...u, ...t.headers };
    let p;
    t.body !== void 0 && (p = JSON.stringify(t.body), l["Content-Type"] = "application/json");
    const R = (t.method ?? (t.body !== void 0 ? "POST" : "GET")).toUpperCase();
    if (R !== "GET" && R !== "HEAD" && !(E in l)) {
      const a = ce();
      a && (l[E] = a);
    }
    let y;
    try {
      y = await s(o, {
        method: t.method ?? (t.body !== void 0 ? "POST" : "GET"),
        headers: l,
        body: p,
        credentials: t.credentials ?? c,
        signal: t.signal
      });
    } catch (a) {
      throw new C(
        `Network request to ${o} failed: ${(a == null ? void 0 : a.message) ?? String(a)}`,
        { status: 0 }
      );
    }
    const O = await y.text();
    let m = null;
    if (O)
      try {
        m = JSON.parse(O);
      } catch {
        m = O;
      }
    if (!y.ok) {
      const a = m && typeof m == "object" && "error" in m ? String(m.error) : null;
      throw new C(
        `Request to ${o} failed with ${y.status}${a ? ` (${a})` : ""}`,
        { status: y.status, code: a, body: m }
      );
    }
    return m;
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
      for (const [o, l] of Object.entries(e.options))
        for (const p of l) t.push(`${o}:${p}`);
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
  async function d(e = {}) {
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
  async function q(e, t = 1, o = {}) {
    return n("/api/commerce/cart/items", {
      method: "POST",
      body: { variantId: e, quantity: t },
      query: i(o.locale),
      signal: o.signal
    });
  }
  async function I(e, t, o = {}) {
    return n(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "PUT",
      body: { quantity: t },
      query: i(o.locale),
      signal: o.signal
    });
  }
  async function N(e, t = {}) {
    return n(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "DELETE",
      query: i(t.locale),
      signal: t.signal
    });
  }
  async function v(e = {}) {
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
  async function U(e = {}) {
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
  async function D(e, t = {}) {
    return n(`/api/commerce/orders/${encodeURIComponent(e)}`, {
      signal: t.signal
    });
  }
  async function x(e = {}) {
    return (await n("/api/commerce/customers/csrf", { signal: e.signal })).token;
  }
  async function L(e, t = {}) {
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
  async function M(e, t, o = {}) {
    return (await n("/api/commerce/customers/reset-password", {
      method: "POST",
      body: { token: e, password: t },
      signal: o.signal
    })).customer;
  }
  async function W(e, t, o = {}) {
    await n("/api/commerce/customers/change-password", {
      method: "POST",
      body: { currentPassword: e, newPassword: t },
      signal: o.signal
    });
  }
  async function z(e = {}) {
    return (await n("/api/commerce/customers/addresses", {
      signal: e.signal
    })).addresses ?? [];
  }
  async function B(e, t = {}) {
    return (await n("/api/commerce/customers/addresses", {
      method: "POST",
      body: e,
      signal: t.signal
    })).address;
  }
  async function Y(e, t, o = {}) {
    return (await n(
      `/api/commerce/customers/addresses/${encodeURIComponent(e)}`,
      { method: "PUT", body: t, signal: o.signal }
    )).address;
  }
  async function Z(e, t = {}) {
    await n(`/api/commerce/customers/addresses/${encodeURIComponent(e)}`, {
      method: "DELETE",
      signal: t.signal
    });
  }
  async function ee(e = {}) {
    return (await n("/api/commerce/customers/oauth/providers", {
      signal: e.signal
    })).providers ?? [];
  }
  function te(e, t = {}) {
    return w(r.apiUrl, `/api/commerce/customers/oauth/${encodeURIComponent(e)}/start`, {
      returnLocale: t.returnLocale
    });
  }
  return {
    contractVersion: 1,
    request: n,
    health: g,
    checkContract: h,
    listProducts: d,
    getProduct: S,
    listCategories: b,
    getCategory: P,
    getCart: $,
    addCartItem: q,
    setCartItemQuantity: I,
    removeCartItem: N,
    clearCart: v,
    applyCoupon: k,
    removeCoupon: U,
    getShippingMethods: _,
    setShipping: A,
    previewCheckout: V,
    startCheckout: F,
    getOrder: D,
    getCsrfToken: x,
    register: L,
    login: j,
    logout: H,
    getCustomer: G,
    getTokenInfo: Q,
    verifyEmail: X,
    resendVerification: J,
    forgotPassword: K,
    resetPassword: M,
    changePassword: W,
    listAddresses: z,
    createAddress: B,
    updateAddress: Y,
    deleteAddress: Z,
    listOAuthProviders: ee,
    oauthStartUrl: te
  };
}
export {
  re as CONTRACT_VERSION_HEADER,
  ie as STOREFRONT_CONTRACT_VERSION,
  ue as STOREFRONT_SDK_VERSION,
  C as StorefrontError,
  le as createStorefrontClient
};
