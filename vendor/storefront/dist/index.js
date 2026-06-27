var ye = Object.defineProperty;
var he = (o, r, c) => r in o ? ye(o, r, { enumerable: !0, configurable: !0, writable: !0, value: c }) : o[r] = c;
var S = (o, r, c) => he(o, typeof r != "symbol" ? r + "" : r, c);
const Ce = 1, Re = "0.0.1";
class C extends Error {
  constructor(c, a) {
    super(c);
    S(this, "status");
    S(this, "code");
    S(this, "body");
    this.name = "StorefrontError", this.status = a.status, this.code = a.code ?? null, this.body = a.body ?? null;
  }
}
const pe = "X-Commerce-Contract-Version", P = "X-CSRF-Token", Se = "cms_csrf";
function Te() {
  if (typeof document > "u" || typeof document.cookie != "string") return null;
  for (const o of document.cookie.split(";")) {
    const r = o.indexOf("=");
    if (r !== -1 && o.slice(0, r).trim() === Se)
      return decodeURIComponent(o.slice(r + 1).trim());
  }
  return null;
}
function b(o, r, c) {
  const a = o.replace(/\/+$/, ""), n = r.startsWith("/") ? r : `/${r}`;
  if (!c) return `${a}${n}`;
  const f = new URLSearchParams();
  for (const [g, d] of Object.entries(c))
    if (d != null)
      if (Array.isArray(d))
        for (const T of d) f.append(g, String(T));
      else
        f.set(g, String(d));
  const h = f.toString();
  return h ? `${a}${n}?${h}` : `${a}${n}`;
}
function we(o) {
  const r = o.fetch ?? globalThis.fetch;
  if (typeof r != "function")
    throw new Error(
      "@cms/storefront: no fetch implementation available — pass `fetch` in the config for this runtime."
    );
  const c = o.credentials ?? "include", a = {
    "X-Project-Slug": o.projectSlug,
    [pe]: String(1),
    ...o.headers
  };
  async function n(e, t = {}) {
    const s = b(o.apiUrl, e, t.query), l = { ...a, ...t.headers };
    let p;
    t.body !== void 0 && (p = JSON.stringify(t.body), l["Content-Type"] = "application/json");
    const E = (t.method ?? (t.body !== void 0 ? "POST" : "GET")).toUpperCase();
    if (E !== "GET" && E !== "HEAD" && !(P in l)) {
      const i = Te();
      i && (l[P] = i);
    }
    let y;
    try {
      y = await r(s, {
        method: t.method ?? (t.body !== void 0 ? "POST" : "GET"),
        headers: l,
        body: p,
        credentials: t.credentials ?? c,
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
  async function f() {
    return n("/api/commerce/health");
  }
  async function h() {
    const { contractVersion: e } = await f();
    return {
      sdk: 1,
      api: e,
      compatible: e === 1
    };
  }
  function g(e = {}) {
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
      query: g(e),
      signal: e.signal
    });
  }
  async function T(e, t = {}) {
    return n(`/api/commerce/catalog/products/${encodeURIComponent(e)}`, {
      query: { locale: t.locale },
      signal: t.signal
    });
  }
  async function v(e = {}) {
    return (await n("/api/commerce/catalog/categories", {
      query: { locale: e.locale },
      signal: e.signal
    })).data;
  }
  async function N(e, t = {}) {
    return n(`/api/commerce/catalog/categories/${encodeURIComponent(e)}`, {
      query: g(t),
      signal: t.signal
    });
  }
  function u(e) {
    return e ? { locale: e } : void 0;
  }
  async function q(e = {}) {
    return n("/api/commerce/cart", { query: u(e.locale), signal: e.signal });
  }
  async function U(e, t = 1, s = {}) {
    return n("/api/commerce/cart/items", {
      method: "POST",
      body: { variantId: e, quantity: t },
      query: u(s.locale),
      signal: s.signal
    });
  }
  async function k(e, t, s = {}) {
    return n(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "PUT",
      body: { quantity: t },
      query: u(s.locale),
      signal: s.signal
    });
  }
  async function A(e, t = {}) {
    return n(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "DELETE",
      query: u(t.locale),
      signal: t.signal
    });
  }
  async function _(e = {}) {
    return n("/api/commerce/cart", { method: "DELETE", query: u(e.locale), signal: e.signal });
  }
  async function L(e, t = {}) {
    return n("/api/commerce/cart/coupon", {
      method: "POST",
      body: { code: e },
      query: u(t.locale),
      signal: t.signal
    });
  }
  async function V(e = {}) {
    return n("/api/commerce/cart/coupon", {
      method: "DELETE",
      query: u(e.locale),
      signal: e.signal
    });
  }
  async function F(e = {}) {
    return n("/api/commerce/cart/shipping", {
      query: { country: e.country, locale: e.locale },
      signal: e.signal
    });
  }
  async function W(e, t = {}) {
    return n("/api/commerce/cart/shipping", {
      method: "PUT",
      body: e,
      query: u(t.locale),
      signal: t.signal
    });
  }
  async function D(e = {}) {
    return n("/api/commerce/checkout", {
      query: u(e.locale),
      signal: e.signal
    });
  }
  async function x(e, t = {}) {
    return n("/api/commerce/checkout", {
      method: "POST",
      body: e,
      query: u(t.locale),
      signal: t.signal
    });
  }
  async function j(e, t = {}) {
    return n(`/api/commerce/orders/${encodeURIComponent(e)}`, {
      signal: t.signal
    });
  }
  async function H(e, t = {}) {
    return n(`/api/commerce/orders/${encodeURIComponent(e)}/accept`, {
      method: "POST",
      signal: t.signal
    });
  }
  async function Q(e, t = {}) {
    return n(`/api/commerce/orders/${encodeURIComponent(e)}/decline`, {
      method: "POST",
      signal: t.signal
    });
  }
  async function J(e = {}) {
    return (await n("/api/commerce/customers/csrf", { signal: e.signal })).token;
  }
  async function G(e, t = {}) {
    return (await n("/api/commerce/customers/register", {
      method: "POST",
      body: e,
      signal: t.signal
    })).customer;
  }
  async function K(e, t = {}) {
    return (await n("/api/commerce/customers/login", {
      method: "POST",
      body: e,
      signal: t.signal
    })).customer;
  }
  async function X(e = {}) {
    await n("/api/commerce/customers/logout", {
      method: "POST",
      signal: e.signal
    });
  }
  async function M(e = {}) {
    try {
      return (await n("/api/commerce/customers/me", { signal: e.signal })).customer;
    } catch (t) {
      if (t instanceof C && t.status === 401) return null;
      throw t;
    }
  }
  async function Y(e, t = {}) {
    return n(
      `/api/commerce/customers/token/${encodeURIComponent(e)}`,
      { signal: t.signal }
    );
  }
  async function z(e, t = {}) {
    return n("/api/commerce/customers/verify-email", {
      method: "POST",
      body: { token: e },
      signal: t.signal
    });
  }
  async function B(e = {}) {
    return n("/api/commerce/customers/resend-verification", {
      method: "POST",
      signal: e.signal
    });
  }
  async function Z(e, t = {}) {
    await n("/api/commerce/customers/forgot-password", {
      method: "POST",
      body: { email: e },
      signal: t.signal
    });
  }
  async function ee(e, t, s = {}) {
    return (await n("/api/commerce/customers/reset-password", {
      method: "POST",
      body: { token: e, password: t },
      signal: s.signal
    })).customer;
  }
  async function te(e, t, s = {}) {
    await n("/api/commerce/customers/change-password", {
      method: "POST",
      body: { currentPassword: e, newPassword: t },
      signal: s.signal
    });
  }
  async function ne(e = {}) {
    return (await n("/api/commerce/customers/addresses", {
      signal: e.signal
    })).addresses ?? [];
  }
  async function re(e, t = {}) {
    return (await n("/api/commerce/customers/addresses", {
      method: "POST",
      body: e,
      signal: t.signal
    })).address;
  }
  async function oe(e, t, s = {}) {
    return (await n(
      `/api/commerce/customers/addresses/${encodeURIComponent(e)}`,
      { method: "PUT", body: t, signal: s.signal }
    )).address;
  }
  async function se(e, t = {}) {
    await n(`/api/commerce/customers/addresses/${encodeURIComponent(e)}`, {
      method: "DELETE",
      signal: t.signal
    });
  }
  async function ce(e = {}) {
    return n("/api/commerce/customers/wishlist", {
      query: { locale: e.locale },
      signal: e.signal
    });
  }
  async function ae(e, t = {}) {
    return (await n("/api/commerce/customers/wishlist", {
      method: "POST",
      body: { productId: e },
      signal: t.signal
    })).productIds ?? [];
  }
  async function ie(e, t = {}) {
    return (await n(
      `/api/commerce/customers/wishlist/${encodeURIComponent(e)}`,
      { method: "DELETE", signal: t.signal }
    )).productIds ?? [];
  }
  async function ue(e = {}) {
    return (await n("/api/commerce/customers/orders", {
      signal: e.signal
    })).orders ?? [];
  }
  async function le(e = {}) {
    return (await n("/api/commerce/customers/oauth/providers", {
      signal: e.signal
    })).providers ?? [];
  }
  function me(e, t = {}) {
    return b(o.apiUrl, `/api/commerce/customers/oauth/${encodeURIComponent(e)}/start`, {
      returnLocale: t.returnLocale
    });
  }
  async function de(e = {}) {
    return (await n("/api/commerce/payments/providers", {
      signal: e.signal
    })).providers ?? [];
  }
  async function fe(e, t, s = {}) {
    return n(`/api/commerce/orders/${encodeURIComponent(e)}/pay`, {
      method: "POST",
      body: { provider: t },
      signal: s.signal
    });
  }
  async function ge(e, t = {}) {
    return n(`/api/commerce/orders/${encodeURIComponent(e)}/payment/refresh`, {
      method: "POST",
      signal: t.signal
    });
  }
  return {
    contractVersion: 1,
    request: n,
    health: f,
    checkContract: h,
    listProducts: d,
    getProduct: T,
    listCategories: v,
    getCategory: N,
    getCart: q,
    addCartItem: U,
    setCartItemQuantity: k,
    removeCartItem: A,
    clearCart: _,
    applyCoupon: L,
    removeCoupon: V,
    getShippingMethods: F,
    setShipping: W,
    previewCheckout: D,
    startCheckout: x,
    getOrder: j,
    acceptQuote: H,
    declineQuote: Q,
    getCsrfToken: J,
    register: G,
    login: K,
    logout: X,
    getCustomer: M,
    getTokenInfo: Y,
    verifyEmail: z,
    resendVerification: B,
    forgotPassword: Z,
    resetPassword: ee,
    changePassword: te,
    listAddresses: ne,
    createAddress: re,
    updateAddress: oe,
    deleteAddress: se,
    getWishlist: ce,
    addToWishlist: ae,
    removeFromWishlist: ie,
    listMyOrders: ue,
    listOAuthProviders: le,
    oauthStartUrl: me,
    listPaymentProviders: de,
    initiatePayment: fe,
    refreshOrderPayment: ge
  };
}
function Ee(o) {
  if (!/^\d{11}$/.test(o)) return !1;
  let r = 10;
  for (let a = 0; a < 10; a++)
    r = (r + Number(o[a])) % 10, r === 0 && (r = 10), r = r * 2 % 11;
  return (11 - r) % 10 === Number(o[10]);
}
const R = "cms_wishlist";
function w() {
  try {
    return typeof localStorage > "u" ? null : localStorage;
  } catch {
    return null;
  }
}
function I() {
  const o = w();
  if (!o) return [];
  try {
    const r = o.getItem(R);
    if (!r) return [];
    const c = JSON.parse(r);
    return Array.isArray(c) ? c.filter((a) => typeof a == "string") : [];
  } catch {
    return [];
  }
}
function $(o) {
  const r = Array.from(new Set(o)), c = w();
  if (c)
    try {
      c.setItem(R, JSON.stringify(r));
    } catch {
    }
  return r;
}
function Pe(o) {
  const r = I().filter((c) => c !== o);
  return $([o, ...r]);
}
function be(o) {
  return $(I().filter((r) => r !== o));
}
function Ie() {
  const o = w();
  if (o)
    try {
      o.removeItem(R);
    } catch {
    }
}
export {
  pe as CONTRACT_VERSION_HEADER,
  Ce as STOREFRONT_CONTRACT_VERSION,
  Re as STOREFRONT_SDK_VERSION,
  C as StorefrontError,
  Pe as addLocalWishlist,
  Ie as clearLocalWishlist,
  we as createStorefrontClient,
  I as getLocalWishlist,
  Ee as isValidOib,
  be as removeLocalWishlist,
  $ as setLocalWishlist
};
