var Te = Object.defineProperty;
var Oe = (r, o, c) => o in r ? Te(r, o, { enumerable: !0, configurable: !0, writable: !0, value: c }) : r[o] = c;
var S = (r, o, c) => Oe(r, typeof o != "symbol" ? o + "" : o, c);
const Pe = 2, Ie = "0.0.1";
class R extends Error {
  constructor(c, a) {
    super(c);
    S(this, "status");
    S(this, "code");
    S(this, "body");
    this.name = "StorefrontError", this.status = a.status, this.code = a.code ?? null, this.body = a.body ?? null;
  }
}
const Ce = "X-Commerce-Contract-Version", I = "X-CSRF-Token", Re = "cms_csrf";
function we() {
  if (typeof document > "u" || typeof document.cookie != "string") return null;
  for (const r of document.cookie.split(";")) {
    const o = r.indexOf("=");
    if (o !== -1 && r.slice(0, o).trim() === Re)
      return decodeURIComponent(r.slice(o + 1).trim());
  }
  return null;
}
function T(r, o, c) {
  const a = r.replace(/\/+$/, ""), t = o.startsWith("/") ? o : `/${o}`;
  if (!c) return `${a}${t}`;
  const f = new URLSearchParams();
  for (const [g, d] of Object.entries(c))
    if (d != null)
      if (Array.isArray(d))
        for (const O of d) f.append(g, String(O));
      else
        f.set(g, String(d));
  const p = f.toString();
  return p ? `${a}${t}?${p}` : `${a}${t}`;
}
function $e(r) {
  const o = r.fetch ?? globalThis.fetch;
  if (typeof o != "function")
    throw new Error(
      "@cms/storefront: no fetch implementation available — pass `fetch` in the config for this runtime."
    );
  const c = r.credentials ?? "include", a = {
    "X-Project-Slug": r.projectSlug,
    [Ce]: String(2),
    ...r.headers
  };
  async function t(e, n = {}) {
    const s = T(r.apiUrl, e, n.query), l = { ...a, ...n.headers };
    let h;
    n.body !== void 0 && (h = JSON.stringify(n.body), l["Content-Type"] = "application/json");
    const P = (n.method ?? (n.body !== void 0 ? "POST" : "GET")).toUpperCase();
    if (P !== "GET" && P !== "HEAD" && !(I in l)) {
      const i = we();
      i && (l[I] = i);
    }
    let y;
    try {
      y = await o(s, {
        method: n.method ?? (n.body !== void 0 ? "POST" : "GET"),
        headers: l,
        body: h,
        credentials: n.credentials ?? c,
        signal: n.signal
      });
    } catch (i) {
      throw new R(
        `Network request to ${s} failed: ${(i == null ? void 0 : i.message) ?? String(i)}`,
        { status: 0 }
      );
    }
    const C = await y.text();
    let m = null;
    if (C)
      try {
        m = JSON.parse(C);
      } catch {
        m = C;
      }
    if (!y.ok) {
      const i = m && typeof m == "object" && "error" in m ? String(m.error) : null;
      throw new R(
        `Request to ${s} failed with ${y.status}${i ? ` (${i})` : ""}`,
        { status: y.status, code: i, body: m }
      );
    }
    return m;
  }
  async function f() {
    return t("/api/commerce/health");
  }
  async function p() {
    const { contractVersion: e } = await f();
    return {
      sdk: 2,
      api: e,
      compatible: e === 2
    };
  }
  function g(e = {}) {
    const n = [];
    if (e.options)
      for (const [s, l] of Object.entries(e.options))
        for (const h of l) n.push(`${s}:${h}`);
    return {
      locale: e.locale,
      category: e.category,
      q: e.q,
      type: e.type,
      option: n.length ? n : void 0,
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
    return t("/api/commerce/catalog/products", {
      query: g(e),
      signal: e.signal
    });
  }
  async function O(e, n = {}) {
    return t(`/api/commerce/catalog/products/${encodeURIComponent(e)}`, {
      query: { locale: n.locale },
      signal: n.signal
    });
  }
  async function U(e = {}) {
    return (await t("/api/commerce/catalog/categories", {
      query: { locale: e.locale },
      signal: e.signal
    })).data;
  }
  async function v(e, n = {}) {
    return t(`/api/commerce/catalog/categories/${encodeURIComponent(e)}`, {
      query: g(n),
      signal: n.signal
    });
  }
  function u(e) {
    return e ? { locale: e } : void 0;
  }
  async function N(e = {}) {
    return t("/api/commerce/cart", { query: u(e.locale), signal: e.signal });
  }
  async function q(e, n = 1, s = {}) {
    return t("/api/commerce/cart/items", {
      method: "POST",
      body: { variantId: e, quantity: n },
      query: u(s.locale),
      signal: s.signal
    });
  }
  async function k(e, n, s = {}) {
    return t(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "PUT",
      body: { quantity: n },
      query: u(s.locale),
      signal: s.signal
    });
  }
  async function A(e, n = {}) {
    return t(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "DELETE",
      query: u(n.locale),
      signal: n.signal
    });
  }
  async function _(e = {}) {
    return t("/api/commerce/cart", { method: "DELETE", query: u(e.locale), signal: e.signal });
  }
  async function L(e, n = {}) {
    return t("/api/commerce/cart/coupon", {
      method: "POST",
      body: { code: e },
      query: u(n.locale),
      signal: n.signal
    });
  }
  async function V(e, n = {}) {
    const s = e ? `/api/commerce/cart/coupon/${encodeURIComponent(e)}` : "/api/commerce/cart/coupon";
    return t(s, {
      method: "DELETE",
      query: u(n.locale),
      signal: n.signal
    });
  }
  async function F(e = {}) {
    return t("/api/commerce/cart/shipping", {
      query: { country: e.country, locale: e.locale },
      signal: e.signal
    });
  }
  async function W(e, n = {}) {
    return t("/api/commerce/cart/shipping", {
      method: "PUT",
      body: e,
      query: u(n.locale),
      signal: n.signal
    });
  }
  async function D(e = {}) {
    return t("/api/commerce/checkout", {
      query: u(e.locale),
      signal: e.signal
    });
  }
  async function x(e, n = {}) {
    return t("/api/commerce/checkout", {
      method: "POST",
      body: e,
      query: u(n.locale),
      signal: n.signal
    });
  }
  async function j(e, n = {}) {
    return t(`/api/commerce/orders/${encodeURIComponent(e)}`, {
      signal: n.signal
    });
  }
  function H(e) {
    return T(r.apiUrl, `/api/commerce/orders/${encodeURIComponent(e)}/invoice.pdf`);
  }
  function Q(e) {
    return T(r.apiUrl, `/api/commerce/orders/${encodeURIComponent(e)}/proforma.pdf`);
  }
  async function J(e, n = {}) {
    return t(`/api/commerce/orders/${encodeURIComponent(e)}/accept`, {
      method: "POST",
      signal: n.signal
    });
  }
  async function G(e, n = {}) {
    return t(`/api/commerce/orders/${encodeURIComponent(e)}/decline`, {
      method: "POST",
      signal: n.signal
    });
  }
  async function K(e, n = {}) {
    return t(`/api/commerce/orders/${encodeURIComponent(e)}/returns`, {
      signal: n.signal
    });
  }
  async function X(e, n, s = {}) {
    return t(`/api/commerce/orders/${encodeURIComponent(e)}/return`, {
      method: "POST",
      body: n,
      signal: s.signal
    });
  }
  async function M(e = {}) {
    return (await t("/api/commerce/customers/csrf", { signal: e.signal })).token;
  }
  async function Y(e, n = {}) {
    return (await t("/api/commerce/customers/register", {
      method: "POST",
      body: e,
      signal: n.signal
    })).customer;
  }
  async function z(e, n = {}) {
    return (await t("/api/commerce/customers/login", {
      method: "POST",
      body: e,
      signal: n.signal
    })).customer;
  }
  async function B(e = {}) {
    await t("/api/commerce/customers/logout", {
      method: "POST",
      signal: e.signal
    });
  }
  async function Z(e = {}) {
    try {
      return (await t("/api/commerce/customers/me", { signal: e.signal })).customer;
    } catch (n) {
      if (n instanceof R && n.status === 401) return null;
      throw n;
    }
  }
  async function ee(e, n = {}) {
    return t(
      `/api/commerce/customers/token/${encodeURIComponent(e)}`,
      { signal: n.signal }
    );
  }
  async function ne(e, n = {}) {
    return t("/api/commerce/customers/verify-email", {
      method: "POST",
      body: { token: e },
      signal: n.signal
    });
  }
  async function te(e = {}) {
    return t("/api/commerce/customers/resend-verification", {
      method: "POST",
      signal: e.signal
    });
  }
  async function re(e, n = {}) {
    await t("/api/commerce/customers/forgot-password", {
      method: "POST",
      body: { email: e },
      signal: n.signal
    });
  }
  async function oe(e, n, s = {}) {
    return (await t("/api/commerce/customers/reset-password", {
      method: "POST",
      body: { token: e, password: n },
      signal: s.signal
    })).customer;
  }
  async function se(e, n, s = {}) {
    await t("/api/commerce/customers/change-password", {
      method: "POST",
      body: { currentPassword: e, newPassword: n },
      signal: s.signal
    });
  }
  async function ce(e = {}) {
    return (await t("/api/commerce/customers/addresses", {
      signal: e.signal
    })).addresses ?? [];
  }
  async function ae(e, n = {}) {
    return (await t("/api/commerce/customers/addresses", {
      method: "POST",
      body: e,
      signal: n.signal
    })).address;
  }
  async function ie(e, n, s = {}) {
    return (await t(
      `/api/commerce/customers/addresses/${encodeURIComponent(e)}`,
      { method: "PUT", body: n, signal: s.signal }
    )).address;
  }
  async function ue(e, n = {}) {
    await t(`/api/commerce/customers/addresses/${encodeURIComponent(e)}`, {
      method: "DELETE",
      signal: n.signal
    });
  }
  async function le(e = {}) {
    return t("/api/commerce/customers/wishlist", {
      query: { locale: e.locale },
      signal: e.signal
    });
  }
  async function me(e, n = {}) {
    return (await t("/api/commerce/customers/wishlist", {
      method: "POST",
      body: { productId: e },
      signal: n.signal
    })).productIds ?? [];
  }
  async function de(e, n = {}) {
    return (await t(
      `/api/commerce/customers/wishlist/${encodeURIComponent(e)}`,
      { method: "DELETE", signal: n.signal }
    )).productIds ?? [];
  }
  async function fe(e = {}) {
    return (await t("/api/commerce/customers/orders", {
      signal: e.signal
    })).orders ?? [];
  }
  async function ge(e = {}) {
    return (await t("/api/commerce/customers/oauth/providers", {
      signal: e.signal
    })).providers ?? [];
  }
  function ye(e, n = {}) {
    return T(r.apiUrl, `/api/commerce/customers/oauth/${encodeURIComponent(e)}/start`, {
      returnLocale: n.returnLocale
    });
  }
  async function pe(e = {}) {
    return (await t("/api/commerce/payments/providers", {
      signal: e.signal
    })).providers ?? [];
  }
  async function he(e, n, s = {}) {
    return t(`/api/commerce/orders/${encodeURIComponent(e)}/pay`, {
      method: "POST",
      body: { provider: n },
      signal: s.signal
    });
  }
  async function Se(e, n = {}) {
    return t(`/api/commerce/orders/${encodeURIComponent(e)}/payment/refresh`, {
      method: "POST",
      signal: n.signal
    });
  }
  return {
    contractVersion: 2,
    request: t,
    health: f,
    checkContract: p,
    listProducts: d,
    getProduct: O,
    listCategories: U,
    getCategory: v,
    getCart: N,
    addCartItem: q,
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
    orderInvoicePdfUrl: H,
    orderProformaPdfUrl: Q,
    acceptQuote: J,
    declineQuote: G,
    getReturns: K,
    requestReturn: X,
    getCsrfToken: M,
    register: Y,
    login: z,
    logout: B,
    getCustomer: Z,
    getTokenInfo: ee,
    verifyEmail: ne,
    resendVerification: te,
    forgotPassword: re,
    resetPassword: oe,
    changePassword: se,
    listAddresses: ce,
    createAddress: ae,
    updateAddress: ie,
    deleteAddress: ue,
    getWishlist: le,
    addToWishlist: me,
    removeFromWishlist: de,
    listMyOrders: fe,
    listOAuthProviders: ge,
    oauthStartUrl: ye,
    listPaymentProviders: pe,
    initiatePayment: he,
    refreshOrderPayment: Se
  };
}
function be(r) {
  if (!/^\d{11}$/.test(r)) return !1;
  let o = 10;
  for (let a = 0; a < 10; a++)
    o = (o + Number(r[a])) % 10, o === 0 && (o = 10), o = o * 2 % 11;
  return (11 - o) % 10 === Number(r[10]);
}
const w = "cms_wishlist";
function E() {
  try {
    return typeof localStorage > "u" ? null : localStorage;
  } catch {
    return null;
  }
}
function $() {
  const r = E();
  if (!r) return [];
  try {
    const o = r.getItem(w);
    if (!o) return [];
    const c = JSON.parse(o);
    return Array.isArray(c) ? c.filter((a) => typeof a == "string") : [];
  } catch {
    return [];
  }
}
function b(r) {
  const o = Array.from(new Set(r)), c = E();
  if (c)
    try {
      c.setItem(w, JSON.stringify(o));
    } catch {
    }
  return o;
}
function Ue(r) {
  const o = $().filter((c) => c !== r);
  return b([r, ...o]);
}
function ve(r) {
  return b($().filter((o) => o !== r));
}
function Ne() {
  const r = E();
  if (r)
    try {
      r.removeItem(w);
    } catch {
    }
}
export {
  Ce as CONTRACT_VERSION_HEADER,
  Pe as STOREFRONT_CONTRACT_VERSION,
  Ie as STOREFRONT_SDK_VERSION,
  R as StorefrontError,
  Ue as addLocalWishlist,
  Ne as clearLocalWishlist,
  $e as createStorefrontClient,
  $ as getLocalWishlist,
  be as isValidOib,
  ve as removeLocalWishlist,
  b as setLocalWishlist
};
