import { createStorefrontClient } from "@cms/storefront";

// The single @cms/storefront client for the dev storefront. Same apiUrl +
// projectSlug as lib/api.ts (the content reads); the SDK stamps X-Project-Slug
// + the contract-version header and sends credentials: "include" by default so
// the httpOnly cms_cart cookie rides along (the cart is server-side, design §9).
const API_URL = import.meta.env.VITE_CMS_API_URL || "http://localhost:3001";
const PROJECT_SLUG = "project-webshop-template";

export const storefront = createStorefrontClient({ apiUrl: API_URL, projectSlug: PROJECT_SLUG });
