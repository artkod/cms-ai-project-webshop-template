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
    /** Query parameters; `undefined`/`null` values are omitted. */
    query?: Record<string, string | number | boolean | undefined | null>;
    /** JSON request body (serialized; sets `Content-Type: application/json`). */
    body?: unknown;
    /** Extra headers merged into (and overriding) the client defaults. */
    headers?: Record<string, string>;
    signal?: AbortSignal;
    /** Per-call override of the credentials mode. */
    credentials?: RequestCredentials;
}

export { }
