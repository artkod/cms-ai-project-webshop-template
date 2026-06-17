/** The full cart, returned by every cart endpoint. */
export declare interface Cart {
    id: string;
    token: string;
    currency: "EUR";
    locale: string;
    items: CartLine[];
    itemCount: number;
    coupon: CartCoupon | null;
    totals: CartTotals;
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
    available: number | null;
    inStock: boolean;
    sellable: boolean;
    maxQuantity: number | null;
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

export declare interface OptionFacet {
    name: string;
    values: {
        value: string;
        count: number;
    }[];
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

export { }
