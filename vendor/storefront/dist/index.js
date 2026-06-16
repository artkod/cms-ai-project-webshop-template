var N = Object.defineProperty;
var E = (e, t, o) => t in e ? N(e, t, { enumerable: !0, configurable: !0, writable: !0, value: o }) : e[t] = o;
var O = (e, t, o) => E(e, typeof t != "symbol" ? t + "" : t, o);
const $ = 1, m = "0.0.1";
class f extends Error {
  constructor(o, s) {
    super(o);
    O(this, "status");
    O(this, "code");
    O(this, "body");
    this.name = "StorefrontError", this.status = s.status, this.code = s.code ?? null, this.body = s.body ?? null;
  }
}
const y = "X-Commerce-Contract-Version";
function C(e, t, o) {
  const s = e.replace(/\/+$/, ""), a = t.startsWith("/") ? t : `/${t}`;
  if (!o) return `${s}${a}`;
  const l = new URLSearchParams();
  for (const [i, r] of Object.entries(o))
    r != null && l.set(i, String(r));
  const d = l.toString();
  return d ? `${s}${a}?${d}` : `${s}${a}`;
}
function _(e) {
  const t = e.fetch ?? globalThis.fetch;
  if (typeof t != "function")
    throw new Error(
      "@cms/storefront: no fetch implementation available — pass `fetch` in the config for this runtime."
    );
  const o = e.credentials ?? "include", s = {
    "X-Project-Slug": e.projectSlug,
    [y]: String(1),
    ...e.headers
  };
  async function a(i, r = {}) {
    const h = C(e.apiUrl, i, r.query), S = { ...s, ...r.headers };
    let T;
    r.body !== void 0 && (T = JSON.stringify(r.body), S["Content-Type"] = "application/json");
    let u;
    try {
      u = await t(h, {
        method: r.method ?? (r.body !== void 0 ? "POST" : "GET"),
        headers: S,
        body: T,
        credentials: r.credentials ?? o,
        signal: r.signal
      });
    } catch (c) {
      throw new f(
        `Network request to ${h} failed: ${(c == null ? void 0 : c.message) ?? String(c)}`,
        { status: 0 }
      );
    }
    const R = await u.text();
    let n = null;
    if (R)
      try {
        n = JSON.parse(R);
      } catch {
        n = R;
      }
    if (!u.ok) {
      const c = n && typeof n == "object" && "error" in n ? String(n.error) : null;
      throw new f(
        `Request to ${h} failed with ${u.status}${c ? ` (${c})` : ""}`,
        { status: u.status, code: c, body: n }
      );
    }
    return n;
  }
  async function l() {
    return a("/api/commerce/health");
  }
  async function d() {
    const { contractVersion: i } = await l();
    return {
      sdk: 1,
      api: i,
      compatible: i === 1
    };
  }
  return {
    contractVersion: 1,
    request: a,
    health: l,
    checkContract: d
  };
}
export {
  y as CONTRACT_VERSION_HEADER,
  $ as STOREFRONT_CONTRACT_VERSION,
  m as STOREFRONT_SDK_VERSION,
  f as StorefrontError,
  _ as createStorefrontClient
};
