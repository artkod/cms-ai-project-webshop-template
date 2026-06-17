var V = Object.defineProperty;
var A = (r, o, c) => o in r ? V(r, o, { enumerable: !0, configurable: !0, writable: !0, value: c }) : r[o] = c;
var T = (r, o, c) => A(r, typeof o != "symbol" ? o + "" : o, c);
const j = 1, x = "0.0.1";
class p extends Error {
  constructor(c, i) {
    super(c);
    T(this, "status");
    T(this, "code");
    T(this, "body");
    this.name = "StorefrontError", this.status = i.status, this.code = i.code ?? null, this.body = i.body ?? null;
  }
}
const U = "X-Commerce-Contract-Version";
function k(r, o, c) {
  const i = r.replace(/\/+$/, ""), n = o.startsWith("/") ? o : `/${o}`;
  if (!c) return `${i}${n}`;
  const d = new URLSearchParams();
  for (const [y, m] of Object.entries(c))
    if (m != null)
      if (Array.isArray(m))
        for (const O of m) d.append(y, String(O));
      else
        d.set(y, String(m));
  const f = d.toString();
  return f ? `${i}${n}?${f}` : `${i}${n}`;
}
function D(r) {
  const o = r.fetch ?? globalThis.fetch;
  if (typeof o != "function")
    throw new Error(
      "@cms/storefront: no fetch implementation available — pass `fetch` in the config for this runtime."
    );
  const c = r.credentials ?? "include", i = {
    "X-Project-Slug": r.projectSlug,
    [U]: String(1),
    ...r.headers
  };
  async function n(e, t = {}) {
    const a = k(r.apiUrl, e, t.query), h = { ...i, ...t.headers };
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
      throw new p(
        `Network request to ${a} failed: ${(u == null ? void 0 : u.message) ?? String(u)}`,
        { status: 0 }
      );
    }
    const R = await g.text();
    let l = null;
    if (R)
      try {
        l = JSON.parse(R);
      } catch {
        l = R;
      }
    if (!g.ok) {
      const u = l && typeof l == "object" && "error" in l ? String(l.error) : null;
      throw new p(
        `Request to ${a} failed with ${g.status}${u ? ` (${u})` : ""}`,
        { status: g.status, code: u, body: l }
      );
    }
    return l;
  }
  async function d() {
    return n("/api/commerce/health");
  }
  async function f() {
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
      query: y(e),
      signal: e.signal
    });
  }
  async function O(e, t = {}) {
    return n(`/api/commerce/catalog/products/${encodeURIComponent(e)}`, {
      query: { locale: t.locale },
      signal: t.signal
    });
  }
  async function C(e = {}) {
    return (await n("/api/commerce/catalog/categories", {
      query: { locale: e.locale },
      signal: e.signal
    })).data;
  }
  async function E(e, t = {}) {
    return n(`/api/commerce/catalog/categories/${encodeURIComponent(e)}`, {
      query: y(t),
      signal: t.signal
    });
  }
  function s(e) {
    return e ? { locale: e } : void 0;
  }
  async function N(e = {}) {
    return n("/api/commerce/cart", { query: s(e.locale), signal: e.signal });
  }
  async function b(e, t = 1, a = {}) {
    return n("/api/commerce/cart/items", {
      method: "POST",
      body: { variantId: e, quantity: t },
      query: s(a.locale),
      signal: a.signal
    });
  }
  async function $(e, t, a = {}) {
    return n(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "PUT",
      body: { quantity: t },
      query: s(a.locale),
      signal: a.signal
    });
  }
  async function q(e, t = {}) {
    return n(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "DELETE",
      query: s(t.locale),
      signal: t.signal
    });
  }
  async function I(e = {}) {
    return n("/api/commerce/cart", { method: "DELETE", query: s(e.locale), signal: e.signal });
  }
  async function _(e, t = {}) {
    return n("/api/commerce/cart/coupon", {
      method: "POST",
      body: { code: e },
      query: s(t.locale),
      signal: t.signal
    });
  }
  async function w(e = {}) {
    return n("/api/commerce/cart/coupon", {
      method: "DELETE",
      query: s(e.locale),
      signal: e.signal
    });
  }
  async function P(e = {}) {
    return n("/api/commerce/cart/shipping", {
      query: { country: e.country, locale: e.locale },
      signal: e.signal
    });
  }
  async function v(e, t = {}) {
    return n("/api/commerce/cart/shipping", {
      method: "PUT",
      body: e,
      query: s(t.locale),
      signal: t.signal
    });
  }
  return {
    contractVersion: 1,
    request: n,
    health: d,
    checkContract: f,
    listProducts: m,
    getProduct: O,
    listCategories: C,
    getCategory: E,
    getCart: N,
    addCartItem: b,
    setCartItemQuantity: $,
    removeCartItem: q,
    clearCart: I,
    applyCoupon: _,
    removeCoupon: w,
    getShippingMethods: P,
    setShipping: v
  };
}
export {
  U as CONTRACT_VERSION_HEADER,
  j as STOREFRONT_CONTRACT_VERSION,
  x as STOREFRONT_SDK_VERSION,
  p as StorefrontError,
  D as createStorefrontClient
};
