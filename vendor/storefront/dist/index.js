var A = Object.defineProperty;
var F = (r, o, c) => o in r ? A(r, o, { enumerable: !0, configurable: !0, writable: !0, value: c }) : r[o] = c;
var T = (r, o, c) => F(r, typeof o != "symbol" ? o + "" : o, c);
const L = 1, Q = "0.0.1";
class C extends Error {
  constructor(c, s) {
    super(c);
    T(this, "status");
    T(this, "code");
    T(this, "body");
    this.name = "StorefrontError", this.status = s.status, this.code = s.code ?? null, this.body = s.body ?? null;
  }
}
const j = "X-Commerce-Contract-Version";
function x(r, o, c) {
  const s = r.replace(/\/+$/, ""), n = o.startsWith("/") ? o : `/${o}`;
  if (!c) return `${s}${n}`;
  const y = new URLSearchParams();
  for (const [d, m] of Object.entries(c))
    if (m != null)
      if (Array.isArray(m))
        for (const O of m) y.append(d, String(O));
      else
        y.set(d, String(m));
  const f = y.toString();
  return f ? `${s}${n}?${f}` : `${s}${n}`;
}
function H(r) {
  const o = r.fetch ?? globalThis.fetch;
  if (typeof o != "function")
    throw new Error(
      "@cms/storefront: no fetch implementation available — pass `fetch` in the config for this runtime."
    );
  const c = r.credentials ?? "include", s = {
    "X-Project-Slug": r.projectSlug,
    [j]: String(1),
    ...r.headers
  };
  async function n(e, t = {}) {
    const a = x(r.apiUrl, e, t.query), h = { ...s, ...t.headers };
    let S;
    t.body !== void 0 && (S = JSON.stringify(t.body), h["Content-Type"] = "application/json");
    let g;
    try {
      g = await o(a, {
        method: t.method ?? (t.body !== void 0 ? "POST" : "GET"),
        headers: h,
        body: S,
        credentials: t.credentials ?? c,
        signal: t.signal
      });
    } catch (u) {
      throw new C(
        `Network request to ${a} failed: ${(u == null ? void 0 : u.message) ?? String(u)}`,
        { status: 0 }
      );
    }
    const p = await g.text();
    let l = null;
    if (p)
      try {
        l = JSON.parse(p);
      } catch {
        l = p;
      }
    if (!g.ok) {
      const u = l && typeof l == "object" && "error" in l ? String(l.error) : null;
      throw new C(
        `Request to ${a} failed with ${g.status}${u ? ` (${u})` : ""}`,
        { status: g.status, code: u, body: l }
      );
    }
    return l;
  }
  async function y() {
    return n("/api/commerce/health");
  }
  async function f() {
    const { contractVersion: e } = await y();
    return {
      sdk: 1,
      api: e,
      compatible: e === 1
    };
  }
  function d(e = {}) {
    const t = [];
    if (e.options)
      for (const [a, h] of Object.entries(e.options))
        for (const S of h) t.push(`${a}:${S}`);
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
      query: d(e),
      signal: e.signal
    });
  }
  async function O(e, t = {}) {
    return n(`/api/commerce/catalog/products/${encodeURIComponent(e)}`, {
      query: { locale: t.locale },
      signal: t.signal
    });
  }
  async function R(e = {}) {
    return (await n("/api/commerce/catalog/categories", {
      query: { locale: e.locale },
      signal: e.signal
    })).data;
  }
  async function E(e, t = {}) {
    return n(`/api/commerce/catalog/categories/${encodeURIComponent(e)}`, {
      query: d(t),
      signal: t.signal
    });
  }
  function i(e) {
    return e ? { locale: e } : void 0;
  }
  async function b(e = {}) {
    return n("/api/commerce/cart", { query: i(e.locale), signal: e.signal });
  }
  async function N(e, t = 1, a = {}) {
    return n("/api/commerce/cart/items", {
      method: "POST",
      body: { variantId: e, quantity: t },
      query: i(a.locale),
      signal: a.signal
    });
  }
  async function $(e, t, a = {}) {
    return n(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "PUT",
      body: { quantity: t },
      query: i(a.locale),
      signal: a.signal
    });
  }
  async function q(e, t = {}) {
    return n(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "DELETE",
      query: i(t.locale),
      signal: t.signal
    });
  }
  async function I(e = {}) {
    return n("/api/commerce/cart", { method: "DELETE", query: i(e.locale), signal: e.signal });
  }
  async function w(e, t = {}) {
    return n("/api/commerce/cart/coupon", {
      method: "POST",
      body: { code: e },
      query: i(t.locale),
      signal: t.signal
    });
  }
  async function P(e = {}) {
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
  async function v(e, t = {}) {
    return n("/api/commerce/cart/shipping", {
      method: "PUT",
      body: e,
      query: i(t.locale),
      signal: t.signal
    });
  }
  async function k(e = {}) {
    return n("/api/commerce/checkout", {
      query: i(e.locale),
      signal: e.signal
    });
  }
  async function U(e, t = {}) {
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
  return {
    contractVersion: 1,
    request: n,
    health: y,
    checkContract: f,
    listProducts: m,
    getProduct: O,
    listCategories: R,
    getCategory: E,
    getCart: b,
    addCartItem: N,
    setCartItemQuantity: $,
    removeCartItem: q,
    clearCart: I,
    applyCoupon: w,
    removeCoupon: P,
    getShippingMethods: _,
    setShipping: v,
    previewCheckout: k,
    startCheckout: U,
    getOrder: V
  };
}
export {
  j as CONTRACT_VERSION_HEADER,
  L as STOREFRONT_CONTRACT_VERSION,
  Q as STOREFRONT_SDK_VERSION,
  C as StorefrontError,
  H as createStorefrontClient
};
