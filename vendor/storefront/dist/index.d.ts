/** The full cart, returned by every cart endpoint. */
export declare interface Cart {
    id: string;
    token: string;
    currency: "EUR";
    locale: string;
    items: CartLine[];
    itemCount: number;
    coupon: CartCoupon | null;
    /** Chosen shipping method + resolved cost + COD (L4.4). */
    shipping: CartShipping;
    totals: CartTotals;
    /** ISO-2 country the totals were taxed at (the cart's ship-to, or "HR" home). */
    taxDestination: string;
    /** false when the shop isn't VAT-registered → no VAT charged (prices are VAT-exempt). */
    vatRegistered: boolean;
    /** e.g. `"coupon_removed"` when an applied coupon lapsed since it was added. */
    warnings: string[];
}

export declare interface CartCoupon {
    discountId: string;
    code: string | null;
    type: "percentage" | "fixed" | "free_shipping";
    value: number;
    amount: number;
    freeShipping: boolean;
}

export declare interface CartLine {
    variantId: string;
    productId: string;
    sku: string | null;
    name: string;
    slug: string | null;
    image: CatalogImage | null;
    taxClass: string;
    quantity: number;
    unitPrice: number;
    regularPrice: number;
    salePrice: number | null;
    onSale: boolean;
    lineTotal: number;
    inventoryTracked: boolean;
    backorder: boolean;
    onHand: number;
    weightGrams: number;
    available: number | null;
    inStock: boolean;
    sellable: boolean;
    maxQuantity: number | null;
}

export declare interface CartShipping {
    country: string;
    zone: ShippingZone;
    method: CartShippingMethod | null;
    amount: number;
    free: boolean;
    freeByCoupon: boolean;
    pickupPoint: PickupPoint | null;
    codEnabled: boolean;
    codSelected: boolean;
    codSurcharge: number;
}

/** The cart's resolved shipping selection (on every cart response). */
export declare interface CartShippingMethod {
    id: string;
    code: string;
    name: string;
    kind: ShippingKind;
    requiresPickupPoint: boolean;
    taxClass: string;
}

/** One row of the per-rate VAT summary (the legally-relevant grouping). */
export declare interface CartTaxSummaryRow {
    rateBps: number;
    net: number;
    vat: number;
    gross: number;
}

/** The single money authority's full breakdown (mirrors `priceOrder()`). */
export declare interface CartTotals {
    currency: "EUR";
    pricesIncludeTax: boolean;
    lines: CartTotalsLine[];
    shipping: null | {
        amount: number;
        taxClass: string;
        rateBps: number;
        net: number;
        vat: number;
        gross: number;
    };
    surcharge: null | {
        amount: number;
        taxClass: string;
        rateBps: number;
        net: number;
        vat: number;
        gross: number;
    };
    itemsSubtotal: number;
    discountTotal: number;
    taxSummary: CartTaxSummaryRow[];
    netTotal: number;
    taxTotal: number;
    grossTotal: number;
    total: number;
}

/** One priced line in the cart totals breakdown. */
export declare interface CartTotalsLine {
    id: string;
    unitPrice: number;
    quantity: number;
    taxClass: string;
    rateBps: number;
    extended: number;
    discount: number;
    net: number;
    vat: number;
    gross: number;
}

export declare interface CatalogBlock {
    type: string;
    data: Record<string, unknown>;
}

export declare interface CatalogCategoryMembership {
    categoryId: string;
    isPrimary: boolean;
    position: number;
}

export declare interface CatalogImage {
    mediaId: string;
    cdnUrl: string;
}

export declare interface CatalogOption {
    id: string;
    name: string;
    position: number;
    values: CatalogOptionValue[];
}

export declare interface CatalogOptionValue {
    id: string;
    value: string;
    position: number;
}

/** Full product detail for a product page. */
export declare interface CatalogProduct {
    id: string;
    type: string;
    status: string;
    locale: string;
    name: string;
    slug: string;
    shortDescription: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
    ogImage: CatalogImage | null;
    blocks: CatalogBlock[];
    gallery: CatalogImage[];
    options: CatalogOption[];
    variants: CatalogVariant[];
    categories: CatalogCategoryMembership[];
    primaryCategoryId: string | null;
    categoryPath: string[];
    alternates: Record<string, {
        slug: string;
        name: string;
    }>;
    /** schema.org/Product JSON-LD for rich snippets (inject verbatim into a
     *  `<script type="application/ld+json">`). Added in L2.5. */
    jsonLd: Record<string, unknown>;
}

export declare type CatalogSort = "newest" | "price_asc" | "price_desc" | "name_asc" | "name_desc";

/** A variant on a product-detail response (price + availability resolved). */
export declare interface CatalogVariant {
    id: string;
    productId: string;
    sku: string | null;
    price: number;
    salePrice: number | null;
    effectivePrice: number;
    onSale: boolean;
    compareAt: number | null;
    isDefault: boolean;
    optionValues: Record<string, string>;
    position: number;
    inventoryTracked: boolean;
    backorder: boolean;
    onHand: number;
    available: number | null;
    inStock: boolean;
    sellable: boolean;
    version: number;
}

export declare interface CategoryFacet {
    categoryId: string;
    count: number;
}

export declare interface CategoryLanding {
    category: CategoryNode;
    breadcrumb: {
        id: string;
        slug: string | null;
        label: string | null;
    }[];
    children: CategoryNode[];
    products: ProductCard[];
    total: number;
    limit: number;
    offset: number;
    facets: SearchFacets;
    /** schema.org/CollectionPage JSON-LD for rich snippets. Added in L2.5. */
    jsonLd: Record<string, unknown>;
}

export declare interface CategoryNode {
    id: string;
    parentId: string | null;
    sortOrder: number;
    slug: string | null;
    label: string | null;
    description: string | null;
    heroImage: CatalogImage | null;
    metaTitle: string | null;
    metaDescription: string | null;
}

/** `GET /api/commerce/checkout` — the cart recomputed at the destination tax. */
export declare interface CheckoutPreview {
    /** True when any item is inquiry-only → the cart is placed as a quote request. */
    isQuote: boolean;
    /** The full cart view, with totals taxed at the ship-to destination. */
    cart: Cart;
}

/** Response of `GET /api/commerce/health` (the public gating probe). */
export declare interface CommerceHealth {
    status: string;
    commerce: true;
    enabled: boolean;
    /** The API's commerce contract version (design §22). */
    contractVersion: number;
}

/** Header the client stamps with its pinned contract version (design §22). */
export declare const CONTRACT_VERSION_HEADER = "X-Commerce-Contract-Version";

/** Result of {@link StorefrontClient.checkContract}. */
export declare interface ContractCheck {
    /** The contract version this SDK is pinned to. */
    sdk: number;
    /** The contract version the API reports. */
    api: number;
    /** `true` when the SDK and API agree on the contract version. */
    compatible: boolean;
}

/**
 * Create a typed storefront API client (design §17). Framework-agnostic — uses
 * the global `fetch` (override via `config.fetch`). Headless hooks and the
 * payment-client adapters wrap this client in later phases.
 */
export declare function createStorefrontClient(config: StorefrontConfig): StorefrontClient;

/** Response of the CSRF endpoint. */
export declare interface CsrfResponse {
    token: string;
}

/** Response wrapper for register/login/me. */
export declare interface CustomerResponse {
    customer: StorefrontCustomer;
}

/** Public token-lookup result (storefront renders the email before acting). */
export declare interface CustomerTokenInfo {
    type: "verification" | "reset";
    email: string;
    expiresAt: string;
}

/** Input for `POST /api/commerce/customers/login`. */
export declare interface LoginInput {
    email: string;
    password: string;
}

/** A social-login provider id the storefront can render a button for. */
export declare type OAuthProviderId = "google" | "apple" | "stub";

/** Response of `GET …/customers/oauth/providers`. */
export declare interface OAuthProvidersResponse {
    providers: OAuthProviderId[];
}

/** Options for {@link StorefrontClient.oauthStartUrl}. */
export declare interface OAuthStartOptions {
    /** Locale to return to after the round-trip (lands on `/{locale}/account`). */
    returnLocale?: string;
}

export declare interface OptionFacet {
    name: string;
    values: {
        value: string;
        count: number;
    }[];
}

/** A placed order — returned by `startCheckout` and `getOrder`. */
export declare interface Order {
    id: string;
    orderNumber: number;
    token: string;
    email: string;
    locale: string;
    status: OrderStatus;
    isQuote: boolean;
    currency: "EUR";
    shippingAddress: OrderAddress | null;
    billingAddress: OrderAddress | null;
    shippingMethod: {
        id: string | null;
        code: string;
        name: string;
        kind: ShippingKind;
    } | null;
    pickupPoint: unknown | null;
    codSelected: boolean;
    taxDestination: string | null;
    items: OrderItem[];
    itemCount: number;
    /** The single money authority's full breakdown (same shape as the cart). */
    totals: CartTotals;
    note: string | null;
    placedAt: string;
}

/** A postal address captured at checkout (snapshotted on the order). */
export declare interface OrderAddress {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    postalCode: string;
    /** ISO-3166 alpha-2 — drives destination VAT (OSS) + the shipping zone. */
    country: string;
    phone?: string;
}

/** One snapshotted order line. */
export declare interface OrderItem {
    id: string;
    variantId: string | null;
    productId: string | null;
    sku: string | null;
    name: string;
    optionsLabel: string | null;
    quantity: number;
    taxClass: string;
    rateBps: number;
    unitPrice: number;
    discount: number;
    net: number;
    vat: number;
    gross: number;
    position: number;
}

export declare interface OrderStatus {
    /** draft | awaiting_payment | authorized | paid | partially_refunded | refunded | voided */
    paymentStatus: string;
    /** unfulfilled | reserved | preparing | (partially_)shipped | delivered | returned */
    fulfillmentStatus: string;
    /** open | completed | cancelled | quote */
    lifecycle: string;
}

/** A chosen parcel-locker / pickup point stored on the cart (carrier-defined). */
export declare interface PickupPoint {
    id?: string;
    name?: string;
    address?: string;
    provider?: string;
    [k: string]: unknown;
}

/** One product as it appears in a listing/grid. */
export declare interface ProductCard {
    id: string;
    type: string;
    slug: string;
    name: string;
    shortDescription: string | null;
    image: CatalogImage | null;
    currency: "EUR";
    /** Min effective B2C GROSS price (VAT-inclusive) across variants (EUR cents) — the "from" price. */
    price: number;
    /** Max effective B2C gross price across variants (EUR cents). */
    priceMax: number;
    /** The cheapest variant's Omnibus compare-at (struck-through reference), or null. */
    compareAt: number | null;
    onSale: boolean;
    inStock: boolean;
    sellable: boolean;
    variantCount: number;
    primaryCategoryId: string | null;
}

/** Query parameters for {@link StorefrontClient.listProducts}. */
export declare interface ProductListParams {
    locale?: string;
    /** Category id or slug — filters to products linked to that category. */
    category?: string;
    /** Full-text query (FTS relevance-ranked). */
    q?: string;
    /** Product type facet filter (physical|digital|service). */
    type?: string;
    /** Option-value facet filters: `{ Color: ["Red","Blue"], Size: ["M"] }` (AND across axes, OR within). */
    options?: Record<string, string[]>;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    sort?: CatalogSort;
    limit?: number;
    offset?: number;
    signal?: AbortSignal;
}

export declare interface ProductListResult {
    data: ProductCard[];
    total: number;
    limit: number;
    offset: number;
    facets: SearchFacets;
}

/** Input for `POST /api/commerce/customers/register`. */
export declare interface RegisterInput {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
}

/** Result of `POST /resend-verification`. */
export declare interface ResendVerificationResult {
    ok: boolean;
    alreadyVerified?: boolean;
}

export declare interface SearchFacets {
    categories: CategoryFacet[];
    types: TypeFacet[];
    options: OptionFacet[];
    priceRange: {
        min: number;
        max: number;
    } | null;
    inStock: number;
}

/** Body for `PUT /api/commerce/cart/shipping`. Only present fields are applied. */
export declare interface SetShippingInput {
    methodId?: string | null;
    country?: string | null;
    pickupPoint?: PickupPoint | null;
    codSelected?: boolean;
}

export declare type ShippingKind = "flat" | "weight" | "pickup_point" | "store_pickup";

/** `GET /api/commerce/cart/shipping` — offerable methods + COD config for a zone. */
export declare interface ShippingOptions {
    country: string;
    zone: ShippingZone;
    methods: ShippingRate[];
    cod: {
        enabled: boolean;
        surcharge: number;
    };
}

/** One offerable shipping option with its computed rate for the current cart. */
export declare interface ShippingRate {
    methodId: string;
    code: string;
    name: string;
    kind: ShippingKind;
    requiresPickupPoint: boolean;
    taxClass: string;
    zone: ShippingZone;
    amount: number;
    free: boolean;
}

export declare type ShippingZone = "HR" | "EU" | "INT";

/** Body for `POST /api/commerce/checkout`. */
export declare interface StartCheckoutInput {
    email: string;
    shippingAddress: OrderAddress;
    /** Falls back to the shipping address when omitted. */
    billingAddress?: OrderAddress;
    note?: string;
}

export declare const STOREFRONT_CONTRACT_VERSION: 1;

export declare const STOREFRONT_SDK_VERSION: "0.0.1";

/** The typed storefront API client. */
export declare interface StorefrontClient {
    /** The contract version this SDK was built against. */
    readonly contractVersion: number;
    /**
     * Low-level typed request helper. Resolves with the parsed JSON body (typed
     * as `T`) or throws {@link StorefrontError}. The domain methods below are thin
     * wrappers over this; it's exposed so projects can reach endpoints the SDK
     * doesn't model yet.
     */
    request<T = unknown>(path: string, init?: StorefrontRequestInit): Promise<T>;
    /** `GET /api/commerce/health` — the public commerce gating probe. */
    health(): Promise<CommerceHealth>;
    /**
     * Fetch the API's contract version and compare it against this SDK's pinned
     * version. Use it on boot to surface a skew warning. Never throws on a
     * mismatch — it reports `{ compatible: false }`.
     */
    checkContract(): Promise<ContractCheck>;
    /** Paginated, filtered, sorted product list. `GET …/catalog/products`. */
    listProducts(params?: ProductListParams): Promise<ProductListResult>;
    /** Product detail by id or per-locale slug. `GET …/catalog/products/:idOrSlug`. */
    getProduct(idOrSlug: string, opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<CatalogProduct>;
    /** Full category tree (flat; nest by parentId). `GET …/catalog/categories`. */
    listCategories(opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<CategoryNode[]>;
    /** Category landing (metadata + breadcrumb + children + products). `GET …/catalog/categories/:idOrSlug`. */
    getCategory(idOrSlug: string, params?: ProductListParams): Promise<CategoryLanding>;
    /** Get-or-create + return the current cart. `GET /api/commerce/cart`. */
    getCart(opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<Cart>;
    /** Add (or increment) a variant. `POST /api/commerce/cart/items`. */
    addCartItem(variantId: string, quantity?: number, opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<Cart>;
    /** Set a line's absolute quantity (0 removes it). `PUT …/cart/items/:variantId`. */
    setCartItemQuantity(variantId: string, quantity: number, opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<Cart>;
    /** Remove a line. `DELETE …/cart/items/:variantId`. */
    removeCartItem(variantId: string, opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<Cart>;
    /** Clear all lines + the applied coupon. `DELETE /api/commerce/cart`. */
    clearCart(opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<Cart>;
    /** Apply a coupon code. `POST /api/commerce/cart/coupon`. */
    applyCoupon(code: string, opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<Cart>;
    /** Remove the applied coupon. `DELETE /api/commerce/cart/coupon`. */
    removeCoupon(opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<Cart>;
    /** Offerable shipping methods + rates for the cart in a zone. `GET …/cart/shipping`. */
    getShippingMethods(opts?: {
        country?: string;
        locale?: string;
        signal?: AbortSignal;
    }): Promise<ShippingOptions>;
    /** Set the chosen method / country / pickup point / COD. `PUT …/cart/shipping`. */
    setShipping(input: SetShippingInput, opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<Cart>;
    /** Preview totals at the destination tax + the quote flag. `GET /api/commerce/checkout`. */
    previewCheckout(opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<CheckoutPreview>;
    /** Place a pending order (before payment). `POST /api/commerce/checkout`. */
    startCheckout(input: StartCheckoutInput, opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<Order>;
    /** Fetch an order by its public token (the pending-order page). `GET /api/commerce/orders/:token`. */
    getOrder(token: string, opts?: {
        signal?: AbortSignal;
    }): Promise<Order>;
    /** Fetch a CSRF token (double-submit cookie). Call on boot or before mutations. */
    getCsrfToken(opts?: {
        signal?: AbortSignal;
    }): Promise<string>;
    /** Register a new customer. Auto-logs-in on success. */
    register(input: RegisterInput, opts?: {
        signal?: AbortSignal;
    }): Promise<StorefrontCustomer>;
    /** Log in an existing customer. Sets cookies + merges guest cart. */
    login(input: LoginInput, opts?: {
        signal?: AbortSignal;
    }): Promise<StorefrontCustomer>;
    /** Log out. Clears the auth cookie. */
    logout(opts?: {
        signal?: AbortSignal;
    }): Promise<void>;
    /** Get the current customer, or `null` if not logged in. */
    getCustomer(opts?: {
        signal?: AbortSignal;
    }): Promise<StorefrontCustomer | null>;
    /** Look up a verification/reset token (renders the email before acting). `GET …/customers/token/:token`. */
    getTokenInfo(token: string, opts?: {
        signal?: AbortSignal;
    }): Promise<CustomerTokenInfo>;
    /** Confirm an email-verification token (token-authed, no login needed). `POST …/verify-email`. */
    verifyEmail(token: string, opts?: {
        signal?: AbortSignal;
    }): Promise<VerifyEmailResult>;
    /** Resend the verification email to the logged-in customer. `POST …/resend-verification`. */
    resendVerification(opts?: {
        signal?: AbortSignal;
    }): Promise<ResendVerificationResult>;
    /** Request a password-reset email. Always resolves (anti-enumeration). `POST …/forgot-password`. */
    forgotPassword(email: string, opts?: {
        signal?: AbortSignal;
    }): Promise<void>;
    /** Complete a password reset; auto-logs-in + marks the email verified. `POST …/reset-password`. */
    resetPassword(token: string, password: string, opts?: {
        signal?: AbortSignal;
    }): Promise<StorefrontCustomer>;
    /** Change the logged-in customer's password (requires a verified email). `POST …/change-password`. */
    changePassword(currentPassword: string, newPassword: string, opts?: {
        signal?: AbortSignal;
    }): Promise<void>;
    /** Provider ids with a configured + enabled button. `GET …/customers/oauth/providers`. */
    listOAuthProviders(opts?: {
        signal?: AbortSignal;
    }): Promise<OAuthProviderId[]>;
    /**
     * Build the OAuth start URL to navigate the browser to (a full-page redirect,
     * NOT a fetch — cookies + the provider round-trip need a top-level navigation).
     * `GET …/customers/oauth/:provider/start`.
     */
    oauthStartUrl(provider: OAuthProviderId, opts?: OAuthStartOptions): string;
}

/** Configuration for {@link createStorefrontClient}. */
export declare interface StorefrontConfig {
    /**
     * Base URL of the CMS API (no trailing slash required), e.g.
     * `"https://api.example.com"` or `"http://localhost:3001"`.
     */
    apiUrl: string;
    /**
     * The project slug, sent as the `X-Project-Slug` header on every request —
     * the same header every CMS public endpoint requires.
     */
    projectSlug: string;
    /**
     * Optional `fetch` implementation. Defaults to the global `fetch`. Inject one
     * for SSR runtimes that don't expose a global, or for testing.
     */
    fetch?: typeof fetch;
    /**
     * Credentials mode for requests. Defaults to `"include"` so the customer-auth
     * cookie (added in L5) rides along on same-site-subdomain deployments.
     */
    credentials?: RequestCredentials;
    /** Extra headers merged into every request. */
    headers?: Record<string, string>;
}

/** Wire shape of a customer in API responses. */
export declare interface StorefrontCustomer {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    type: "personal" | "business";
    emailVerified: boolean;
    createdAt: string;
}

/**
 * Error thrown for any non-2xx API response (or a network/parse failure).
 * Carries the HTTP status, the parsed JSON body when available, and the API's
 * structured `error` code (e.g. `"forbidden_capability"`) when present.
 */
export declare class StorefrontError extends Error {
    readonly status: number;
    readonly code: string | null;
    readonly body: unknown;
    constructor(message: string, opts: {
        status: number;
        code?: string | null;
        body?: unknown;
    });
}

/** Per-call request options. */
export declare interface StorefrontRequestInit {
    method?: string;
    /**
     * Query parameters; `undefined`/`null` values are omitted. An array value is
     * serialized as a repeated key (`?option=a&option=b`).
     */
    query?: Record<string, string | number | boolean | undefined | null | (string | number | boolean)[]>;
    /** JSON request body (serialized; sets `Content-Type: application/json`). */
    body?: unknown;
    /** Extra headers merged into (and overriding) the client defaults. */
    headers?: Record<string, string>;
    signal?: AbortSignal;
    /** Per-call override of the credentials mode. */
    credentials?: RequestCredentials;
}

export declare interface TypeFacet {
    type: string;
    count: number;
}

/** Result of `POST /verify-email`. */
export declare interface VerifyEmailResult {
    ok: boolean;
    email: string;
}

export { }
