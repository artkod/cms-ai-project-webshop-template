var he = Object.defineProperty;
var Se = (o, r, c) => r in o ? he(o, r, { enumerable: !0, configurable: !0, writable: !0, value: c }) : o[r] = c;
var S = (o, r, c) => Se(o, typeof r != "symbol" ? r + "" : r, c);
const we = 2, Ee = "0.0.1";
class C extends Error {
  constructor(c, a) {
    super(c);
    S(this, "status");
    S(this, "code");
    S(this, "body");
    this.name = "StorefrontError", this.status = a.status, this.code = a.code ?? null, this.body = a.body ?? null;
  }
}
const Te = "X-Commerce-Contract-Version", P = "X-CSRF-Token", Oe = "cms_csrf";
function Ce() {
  if (typeof document > "u" || typeof document.cookie != "string") return null;
  for (const o of document.cookie.split(";")) {
    const r = o.indexOf("=");
    if (r !== -1 && o.slice(0, r).trim() === Oe)
      return decodeURIComponent(o.slice(r + 1).trim());
  }
  return null;
}
function b(o, r, c) {
  const a = o.replace(/\/+$/, ""), n = r.startsWith("/") ? r : `/${r}`;
  if (!c) return `${a}${n}`;
  const g = new URLSearchParams();
  for (const [f, d] of Object.entries(c))
    if (d != null)
      if (Array.isArray(d))
        for (const T of d) g.append(f, String(T));
      else
        g.set(f, String(d));
  const p = g.toString();
  return p ? `${a}${n}?${p}` : `${a}${n}`;
}
function Pe(o) {
  const r = o.fetch ?? globalThis.fetch;
  if (typeof r != "function")
    throw new Error(
      "@cms/storefront: no fetch implementation available — pass `fetch` in the config for this runtime."
    );
  const c = o.credentials ?? "include", a = {
    "X-Project-Slug": o.projectSlug,
    [Te]: String(2),
    ...o.headers
  };
  async function n(e, t = {}) {
    const s = b(o.apiUrl, e, t.query), l = { ...a, ...t.headers };
    let h;
    t.body !== void 0 && (h = JSON.stringify(t.body), l["Content-Type"] = "application/json");
    const E = (t.method ?? (t.body !== void 0 ? "POST" : "GET")).toUpperCase();
    if (E !== "GET" && E !== "HEAD" && !(P in l)) {
      const i = Ce();
      i && (l[P] = i);
    }
    let y;
    try {
      y = await r(s, {
        method: t.method ?? (t.body !== void 0 ? "POST" : "GET"),
        headers: l,
        body: h,
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
  async function g() {
    return n("/api/commerce/health");
  }
  async function p() {
    const { contractVersion: e } = await g();
    return {
      sdk: 2,
      api: e,
      compatible: e === 2
    };
  }
  function f(e = {}) {
    const t = [];
    if (e.options)
      for (const [s, l] of Object.entries(e.options))
        for (const h of l) t.push(`${s}:${h}`);
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
  async function T(e, t = {}) {
    return n(`/api/commerce/catalog/products/${encodeURIComponent(e)}`, {
      query: { locale: t.locale },
      signal: t.signal
    });
  }
  async function U(e = {}) {
    return (await n("/api/commerce/catalog/categories", {
      query: { locale: e.locale },
      signal: e.signal
    })).data;
  }
  async function v(e, t = {}) {
    return n(`/api/commerce/catalog/categories/${encodeURIComponent(e)}`, {
      query: f(t),
      signal: t.signal
    });
  }
  function u(e) {
    return e ? { locale: e } : void 0;
  }
  async function N(e = {}) {
    return n("/api/commerce/cart", { query: u(e.locale), signal: e.signal });
  }
  async function q(e, t = 1, s = {}) {
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
  async function V(e, t = {}) {
    const s = e ? `/api/commerce/cart/coupon/${encodeURIComponent(e)}` : "/api/commerce/cart/coupon";
    return n(s, {
      method: "DELETE",
      query: u(t.locale),
      signal: t.signal
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
  async function J(e, t = {}) {
    return n(`/api/commerce/orders/${encodeURIComponent(e)}/returns`, {
      signal: t.signal
    });
  }
  async function G(e, t, s = {}) {
    return n(`/api/commerce/orders/${encodeURIComponent(e)}/return`, {
      method: "POST",
      body: t,
      signal: s.signal
    });
  }
  async function K(e = {}) {
    return (await n("/api/commerce/customers/csrf", { signal: e.signal })).token;
  }
  async function X(e, t = {}) {
    return (await n("/api/commerce/customers/register", {
      method: "POST",
      body: e,
      signal: t.signal
    })).customer;
  }
  async function M(e, t = {}) {
    return (await n("/api/commerce/customers/login", {
      method: "POST",
      body: e,
      signal: t.signal
    })).customer;
  }
  async function Y(e = {}) {
    await n("/api/commerce/customers/logout", {
      method: "POST",
      signal: e.signal
    });
  }
  async function z(e = {}) {
    try {
      return (await n("/api/commerce/customers/me", { signal: e.signal })).customer;
    } catch (t) {
      if (t instanceof C && t.status === 401) return null;
      throw t;
    }
  }
  async function B(e, t = {}) {
    return n(
      `/api/commerce/customers/token/${encodeURIComponent(e)}`,
      { signal: t.signal }
    );
  }
  async function Z(e, t = {}) {
    return n("/api/commerce/customers/verify-email", {
      method: "POST",
      body: { token: e },
      signal: t.signal
    });
  }
  async function ee(e = {}) {
    return n("/api/commerce/customers/resend-verification", {
      method: "POST",
      signal: e.signal
    });
  }
  async function te(e, t = {}) {
    await n("/api/commerce/customers/forgot-password", {
      method: "POST",
      body: { email: e },
      signal: t.signal
    });
  }
  async function ne(e, t, s = {}) {
    return (await n("/api/commerce/customers/reset-password", {
      method: "POST",
      body: { token: e, password: t },
      signal: s.signal
    })).customer;
  }
  async function re(e, t, s = {}) {
    await n("/api/commerce/customers/change-password", {
      method: "POST",
      body: { currentPassword: e, newPassword: t },
      signal: s.signal
    });
  }
  async function oe(e = {}) {
    return (await n("/api/commerce/customers/addresses", {
      signal: e.signal
    })).addresses ?? [];
  }
  async function se(e, t = {}) {
    return (await n("/api/commerce/customers/addresses", {
      method: "POST",
      body: e,
      signal: t.signal
    })).address;
  }
  async function ce(e, t, s = {}) {
    return (await n(
      `/api/commerce/customers/addresses/${encodeURIComponent(e)}`,
      { method: "PUT", body: t, signal: s.signal }
    )).address;
  }
  async function ae(e, t = {}) {
    await n(`/api/commerce/customers/addresses/${encodeURIComponent(e)}`, {
      method: "DELETE",
      signal: t.signal
    });
  }
  async function ie(e = {}) {
    return n("/api/commerce/customers/wishlist", {
      query: { locale: e.locale },
      signal: e.signal
    });
  }
  async function ue(e, t = {}) {
    return (await n("/api/commerce/customers/wishlist", {
      method: "POST",
      body: { productId: e },
      signal: t.signal
    })).productIds ?? [];
  }
  async function le(e, t = {}) {
    return (await n(
      `/api/commerce/customers/wishlist/${encodeURIComponent(e)}`,
      { method: "DELETE", signal: t.signal }
    )).productIds ?? [];
  }
  async function me(e = {}) {
    return (await n("/api/commerce/customers/orders", {
      signal: e.signal
    })).orders ?? [];
  }
  async function de(e = {}) {
    return (await n("/api/commerce/customers/oauth/providers", {
      signal: e.signal
    })).providers ?? [];
  }
  function ge(e, t = {}) {
    return b(o.apiUrl, `/api/commerce/customers/oauth/${encodeURIComponent(e)}/start`, {
      returnLocale: t.returnLocale
    });
  }
  async function fe(e = {}) {
    return (await n("/api/commerce/payments/providers", {
      signal: e.signal
    })).providers ?? [];
  }
  async function ye(e, t, s = {}) {
    return n(`/api/commerce/orders/${encodeURIComponent(e)}/pay`, {
      method: "POST",
      body: { provider: t },
      signal: s.signal
    });
  }
  async function pe(e, t = {}) {
    return n(`/api/commerce/orders/${encodeURIComponent(e)}/payment/refresh`, {
      method: "POST",
      signal: t.signal
    });
  }
  return {
    contractVersion: 2,
    request: n,
    health: g,
    checkContract: p,
    listProducts: d,
    getProduct: T,
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
    acceptQuote: H,
    declineQuote: Q,
    getReturns: J,
    requestReturn: G,
    getCsrfToken: K,
    register: X,
    login: M,
    logout: Y,
    getCustomer: z,
    getTokenInfo: B,
    verifyEmail: Z,
    resendVerification: ee,
    forgotPassword: te,
    resetPassword: ne,
    changePassword: re,
    listAddresses: oe,
    createAddress: se,
    updateAddress: ce,
    deleteAddress: ae,
    getWishlist: ie,
    addToWishlist: ue,
    removeFromWishlist: le,
    listMyOrders: me,
    listOAuthProviders: de,
    oauthStartUrl: ge,
    listPaymentProviders: fe,
    initiatePayment: ye,
    refreshOrderPayment: pe
  };
}
function be(o) {
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
function Ie(o) {
  const r = I().filter((c) => c !== o);
  return $([o, ...r]);
}
function $e(o) {
  return $(I().filter((r) => r !== o));
}
function Ue() {
  const o = w();
  if (o)
    try {
      o.removeItem(R);
    } catch {
    }
}
export {
  Te as CONTRACT_VERSION_HEADER,
  we as STOREFRONT_CONTRACT_VERSION,
  Ee as STOREFRONT_SDK_VERSION,
  C as StorefrontError,
  Ie as addLocalWishlist,
  Ue as clearLocalWishlist,
  Pe as createStorefrontClient,
  I as getLocalWishlist,
  be as isValidOib,
  $e as removeLocalWishlist,
  $ as setLocalWishlist
};
