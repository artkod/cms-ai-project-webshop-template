var v = Object.defineProperty;
var P = (r, n, c) => n in r ? v(r, n, { enumerable: !0, configurable: !0, writable: !0, value: c }) : r[n] = c;
var S = (r, n, c) => P(r, typeof n != "symbol" ? n + "" : n, c);
const k = 1, F = "0.0.1";
class C extends Error {
  constructor(c, s) {
    super(c);
    S(this, "status");
    S(this, "code");
    S(this, "body");
    this.name = "StorefrontError", this.status = s.status, this.code = s.code ?? null, this.body = s.body ?? null;
  }
}
const V = "X-Commerce-Contract-Version";
function A(r, n, c) {
  const s = r.replace(/\/+$/, ""), o = n.startsWith("/") ? n : `/${n}`;
  if (!c) return `${s}${o}`;
  const d = new URLSearchParams();
  for (const [y, u] of Object.entries(c))
    if (u != null)
      if (Array.isArray(u))
        for (const O of u) d.append(y, String(O));
      else
        d.set(y, String(u));
  const g = d.toString();
  return g ? `${s}${o}?${g}` : `${s}${o}`;
}
function j(r) {
  const n = r.fetch ?? globalThis.fetch;
  if (typeof n != "function")
    throw new Error(
      "@cms/storefront: no fetch implementation available — pass `fetch` in the config for this runtime."
    );
  const c = r.credentials ?? "include", s = {
    "X-Project-Slug": r.projectSlug,
    [V]: String(1),
    ...r.headers
  };
  async function o(e, t = {}) {
    const a = A(r.apiUrl, e, t.query), h = { ...s, ...t.headers };
    let T;
    t.body !== void 0 && (T = JSON.stringify(t.body), h["Content-Type"] = "application/json");
    let f;
    try {
      f = await n(a, {
        method: t.method ?? (t.body !== void 0 ? "POST" : "GET"),
        headers: h,
        body: T,
        credentials: t.credentials ?? c,
        signal: t.signal
      });
    } catch (l) {
      throw new C(
        `Network request to ${a} failed: ${(l == null ? void 0 : l.message) ?? String(l)}`,
        { status: 0 }
      );
    }
    const R = await f.text();
    let i = null;
    if (R)
      try {
        i = JSON.parse(R);
      } catch {
        i = R;
      }
    if (!f.ok) {
      const l = i && typeof i == "object" && "error" in i ? String(i.error) : null;
      throw new C(
        `Request to ${a} failed with ${f.status}${l ? ` (${l})` : ""}`,
        { status: f.status, code: l, body: i }
      );
    }
    return i;
  }
  async function d() {
    return o("/api/commerce/health");
  }
  async function g() {
    const { contractVersion: e } = await d();
    return {
      sdk: 1,
      api: e,
      compatible: e === 1
    };
  }
  function y(e = {}) {
    const t = [];
    if (e.options)
      for (const [a, h] of Object.entries(e.options))
        for (const T of h) t.push(`${a}:${T}`);
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
  async function u(e = {}) {
    return o("/api/commerce/catalog/products", {
      query: y(e),
      signal: e.signal
    });
  }
  async function O(e, t = {}) {
    return o(`/api/commerce/catalog/products/${encodeURIComponent(e)}`, {
      query: { locale: t.locale },
      signal: t.signal
    });
  }
  async function E(e = {}) {
    return (await o("/api/commerce/catalog/categories", {
      query: { locale: e.locale },
      signal: e.signal
    })).data;
  }
  async function p(e, t = {}) {
    return o(`/api/commerce/catalog/categories/${encodeURIComponent(e)}`, {
      query: y(t),
      signal: t.signal
    });
  }
  function m(e) {
    return e ? { locale: e } : void 0;
  }
  async function N(e = {}) {
    return o("/api/commerce/cart", { query: m(e.locale), signal: e.signal });
  }
  async function $(e, t = 1, a = {}) {
    return o("/api/commerce/cart/items", {
      method: "POST",
      body: { variantId: e, quantity: t },
      query: m(a.locale),
      signal: a.signal
    });
  }
  async function b(e, t, a = {}) {
    return o(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "PUT",
      body: { quantity: t },
      query: m(a.locale),
      signal: a.signal
    });
  }
  async function q(e, t = {}) {
    return o(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "DELETE",
      query: m(t.locale),
      signal: t.signal
    });
  }
  async function I(e = {}) {
    return o("/api/commerce/cart", { method: "DELETE", query: m(e.locale), signal: e.signal });
  }
  async function _(e, t = {}) {
    return o("/api/commerce/cart/coupon", {
      method: "POST",
      body: { code: e },
      query: m(t.locale),
      signal: t.signal
    });
  }
  async function w(e = {}) {
    return o("/api/commerce/cart/coupon", {
      method: "DELETE",
      query: m(e.locale),
      signal: e.signal
    });
  }
  return {
    contractVersion: 1,
    request: o,
    health: d,
    checkContract: g,
    listProducts: u,
    getProduct: O,
    listCategories: E,
    getCategory: p,
    getCart: N,
    addCartItem: $,
    setCartItemQuantity: b,
    removeCartItem: q,
    clearCart: I,
    applyCoupon: _,
    removeCoupon: w
  };
}
export {
  V as CONTRACT_VERSION_HEADER,
  k as STOREFRONT_CONTRACT_VERSION,
  F as STOREFRONT_SDK_VERSION,
  C as StorefrontError,
  j as createStorefrontClient
};
