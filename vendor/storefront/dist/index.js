var G = Object.defineProperty;
var Q = (r, o, a) => o in r ? G(r, o, { enumerable: !0, configurable: !0, writable: !0, value: a }) : r[o] = a;
var T = (r, o, a) => Q(r, typeof o != "symbol" ? o + "" : o, a);
const z = 1, B = "0.0.1";
class O extends Error {
  constructor(a, l) {
    super(a);
    T(this, "status");
    T(this, "code");
    T(this, "body");
    this.name = "StorefrontError", this.status = l.status, this.code = l.code ?? null, this.body = l.body ?? null;
  }
}
const X = "X-Commerce-Contract-Version", E = "X-CSRF-Token", J = "cms_csrf";
function K() {
  if (typeof document > "u" || typeof document.cookie != "string") return null;
  for (const r of document.cookie.split(";")) {
    const o = r.indexOf("=");
    if (o !== -1 && r.slice(0, o).trim() === J)
      return decodeURIComponent(r.slice(o + 1).trim());
  }
  return null;
}
function M(r, o, a) {
  const l = r.replace(/\/+$/, ""), n = o.startsWith("/") ? o : `/${o}`;
  if (!a) return `${l}${n}`;
  const d = new URLSearchParams();
  for (const [f, m] of Object.entries(a))
    if (m != null)
      if (Array.isArray(m))
        for (const C of m) d.append(f, String(C));
      else
        d.set(f, String(m));
  const h = d.toString();
  return h ? `${l}${n}?${h}` : `${l}${n}`;
}
function Y(r) {
  const o = r.fetch ?? globalThis.fetch;
  if (typeof o != "function")
    throw new Error(
      "@cms/storefront: no fetch implementation available — pass `fetch` in the config for this runtime."
    );
  const a = r.credentials ?? "include", l = {
    "X-Project-Slug": r.projectSlug,
    [X]: String(1),
    ...r.headers
  };
  async function n(e, t = {}) {
    const c = M(r.apiUrl, e, t.query), g = { ...l, ...t.headers };
    let p;
    t.body !== void 0 && (p = JSON.stringify(t.body), g["Content-Type"] = "application/json");
    const R = (t.method ?? (t.body !== void 0 ? "POST" : "GET")).toUpperCase();
    if (R !== "GET" && R !== "HEAD" && !(E in g)) {
      const s = K();
      s && (g[E] = s);
    }
    let y;
    try {
      y = await o(c, {
        method: t.method ?? (t.body !== void 0 ? "POST" : "GET"),
        headers: g,
        body: p,
        credentials: t.credentials ?? a,
        signal: t.signal
      });
    } catch (s) {
      throw new O(
        `Network request to ${c} failed: ${(s == null ? void 0 : s.message) ?? String(s)}`,
        { status: 0 }
      );
    }
    const S = await y.text();
    let u = null;
    if (S)
      try {
        u = JSON.parse(S);
      } catch {
        u = S;
      }
    if (!y.ok) {
      const s = u && typeof u == "object" && "error" in u ? String(u.error) : null;
      throw new O(
        `Request to ${c} failed with ${y.status}${s ? ` (${s})` : ""}`,
        { status: y.status, code: s, body: u }
      );
    }
    return u;
  }
  async function d() {
    return n("/api/commerce/health");
  }
  async function h() {
    const { contractVersion: e } = await d();
    return {
      sdk: 1,
      api: e,
      compatible: e === 1
    };
  }
  function f(e = {}) {
    const t = [];
    if (e.options)
      for (const [c, g] of Object.entries(e.options))
        for (const p of g) t.push(`${c}:${p}`);
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
  async function C(e, t = {}) {
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
  async function q(e, t = {}) {
    return n(`/api/commerce/catalog/categories/${encodeURIComponent(e)}`, {
      query: f(t),
      signal: t.signal
    });
  }
  function i(e) {
    return e ? { locale: e } : void 0;
  }
  async function N(e = {}) {
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
  async function w(e, t, c = {}) {
    return n(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "PUT",
      body: { quantity: t },
      query: i(c.locale),
      signal: c.signal
    });
  }
  async function P(e, t = {}) {
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
  async function _(e = {}) {
    return n("/api/commerce/cart/coupon", {
      method: "DELETE",
      query: i(e.locale),
      signal: e.signal
    });
  }
  async function v(e = {}) {
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
  async function F(e, t = {}) {
    return n("/api/commerce/checkout", {
      method: "POST",
      body: e,
      query: i(t.locale),
      signal: t.signal
    });
  }
  async function V(e, t = {}) {
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
      if (t instanceof O && t.status === 401) return null;
      throw t;
    }
  }
  return {
    contractVersion: 1,
    request: n,
    health: d,
    checkContract: h,
    listProducts: m,
    getProduct: C,
    listCategories: b,
    getCategory: q,
    getCart: N,
    addCartItem: $,
    setCartItemQuantity: w,
    removeCartItem: P,
    clearCart: k,
    applyCoupon: I,
    removeCoupon: _,
    getShippingMethods: v,
    setShipping: U,
    previewCheckout: A,
    startCheckout: F,
    getOrder: V,
    getCsrfToken: x,
    register: D,
    login: j,
    logout: H,
    getCustomer: L
  };
}
export {
  X as CONTRACT_VERSION_HEADER,
  z as STOREFRONT_CONTRACT_VERSION,
  B as STOREFRONT_SDK_VERSION,
  O as StorefrontError,
  Y as createStorefrontClient
};
