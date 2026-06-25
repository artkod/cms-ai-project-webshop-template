var ne = Object.defineProperty;
var re = (o, r, a) => r in o ? ne(o, r, { enumerable: !0, configurable: !0, writable: !0, value: a }) : o[r] = a;
var T = (o, r, a) => re(o, typeof r != "symbol" ? r + "" : r, a);
const ie = 1, ue = "0.0.1";
class C extends Error {
  constructor(a, c) {
    super(a);
    T(this, "status");
    T(this, "code");
    T(this, "body");
    this.name = "StorefrontError", this.status = c.status, this.code = c.code ?? null, this.body = c.body ?? null;
  }
}
const oe = "X-Commerce-Contract-Version", E = "X-CSRF-Token", se = "cms_csrf";
function ce() {
  if (typeof document > "u" || typeof document.cookie != "string") return null;
  for (const o of document.cookie.split(";")) {
    const r = o.indexOf("=");
    if (r !== -1 && o.slice(0, r).trim() === se)
      return decodeURIComponent(o.slice(r + 1).trim());
  }
  return null;
}
function w(o, r, a) {
  const c = o.replace(/\/+$/, ""), n = r.startsWith("/") ? r : `/${r}`;
  if (!a) return `${c}${n}`;
  const g = new URLSearchParams();
  for (const [f, d] of Object.entries(a))
    if (d != null)
      if (Array.isArray(d))
        for (const S of d) g.append(f, String(S));
      else
        g.set(f, String(d));
  const h = g.toString();
  return h ? `${c}${n}?${h}` : `${c}${n}`;
}
function le(o) {
  const r = o.fetch ?? globalThis.fetch;
  if (typeof r != "function")
    throw new Error(
      "@cms/storefront: no fetch implementation available — pass `fetch` in the config for this runtime."
    );
  const a = o.credentials ?? "include", c = {
    "X-Project-Slug": o.projectSlug,
    [oe]: String(1),
    ...o.headers
  };
  async function n(e, t = {}) {
    const s = w(o.apiUrl, e, t.query), l = { ...c, ...t.headers };
    let p;
    t.body !== void 0 && (p = JSON.stringify(t.body), l["Content-Type"] = "application/json");
    const R = (t.method ?? (t.body !== void 0 ? "POST" : "GET")).toUpperCase();
    if (R !== "GET" && R !== "HEAD" && !(E in l)) {
      const i = ce();
      i && (l[E] = i);
    }
    let y;
    try {
      y = await r(s, {
        method: t.method ?? (t.body !== void 0 ? "POST" : "GET"),
        headers: l,
        body: p,
        credentials: t.credentials ?? a,
        signal: t.signal
      });
    } catch (i) {
      throw new C(
        `Network request to ${s} failed: ${(i == null ? void 0 : i.message) ?? String(i)}`,
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
      const i = m && typeof m == "object" && "error" in m ? String(m.error) : null;
      throw new C(
        `Request to ${s} failed with ${y.status}${i ? ` (${i})` : ""}`,
        { status: y.status, code: i, body: m }
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
      for (const [s, l] of Object.entries(e.options))
        for (const p of l) t.push(`${s}:${p}`);
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
  function u(e) {
    return e ? { locale: e } : void 0;
  }
  async function $(e = {}) {
    return n("/api/commerce/cart", { query: u(e.locale), signal: e.signal });
  }
  async function N(e, t = 1, s = {}) {
    return n("/api/commerce/cart/items", {
      method: "POST",
      body: { variantId: e, quantity: t },
      query: u(s.locale),
      signal: s.signal
    });
  }
  async function q(e, t, s = {}) {
    return n(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "PUT",
      body: { quantity: t },
      query: u(s.locale),
      signal: s.signal
    });
  }
  async function I(e, t = {}) {
    return n(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "DELETE",
      query: u(t.locale),
      signal: t.signal
    });
  }
  async function k(e = {}) {
    return n("/api/commerce/cart", { method: "DELETE", query: u(e.locale), signal: e.signal });
  }
  async function v(e, t = {}) {
    return n("/api/commerce/cart/coupon", {
      method: "POST",
      body: { code: e },
      query: u(t.locale),
      signal: t.signal
    });
  }
  async function U(e = {}) {
    return n("/api/commerce/cart/coupon", {
      method: "DELETE",
      query: u(e.locale),
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
      query: u(t.locale),
      signal: t.signal
    });
  }
  async function V(e = {}) {
    return n("/api/commerce/checkout", {
      query: u(e.locale),
      signal: e.signal
    });
  }
  async function F(e, t = {}) {
    return n("/api/commerce/checkout", {
      method: "POST",
      body: e,
      query: u(t.locale),
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
  async function M(e, t, s = {}) {
    return (await n("/api/commerce/customers/reset-password", {
      method: "POST",
      body: { token: e, password: t },
      signal: s.signal
    })).customer;
  }
  async function W(e, t, s = {}) {
    await n("/api/commerce/customers/change-password", {
      method: "POST",
      body: { currentPassword: e, newPassword: t },
      signal: s.signal
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
  async function Y(e, t, s = {}) {
    return (await n(
      `/api/commerce/customers/addresses/${encodeURIComponent(e)}`,
      { method: "PUT", body: t, signal: s.signal }
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
    return w(o.apiUrl, `/api/commerce/customers/oauth/${encodeURIComponent(e)}/start`, {
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
    addCartItem: N,
    setCartItemQuantity: q,
    removeCartItem: I,
    clearCart: k,
    applyCoupon: v,
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
function me(o) {
  if (!/^\d{11}$/.test(o)) return !1;
  let r = 10;
  for (let c = 0; c < 10; c++)
    r = (r + Number(o[c])) % 10, r === 0 && (r = 10), r = r * 2 % 11;
  return (11 - r) % 10 === Number(o[10]);
}
export {
  oe as CONTRACT_VERSION_HEADER,
  ie as STOREFRONT_CONTRACT_VERSION,
  ue as STOREFRONT_SDK_VERSION,
  C as StorefrontError,
  le as createStorefrontClient,
  me as isValidOib
};
