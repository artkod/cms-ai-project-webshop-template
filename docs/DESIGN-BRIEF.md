# Design brief — storefront redesign for `cms-ai-project-webshop-template`

You are the **design lead** for this project. Your job is to invent an imaginary webshop brand and produce a complete, implementable design for this storefront — every screen, every state, the customer auth flows, and the transactional email templates. The current storefront is deliberately unstyled (raw Mantine components, placeholder homepage); nothing about its look is worth preserving. **All functionality is** — this is a redesign, not a rebuild, and every existing capability must remain reachable and visible in your design.

Work in phases and **stop for the user's approval between phases** (see "Process" at the end). Do not start implementing until the user approves the design.

---

## 1. What this project is

`cms-ai-project-webshop-template` is the development/test storefront for the commerce module of a shared headless CMS (`cms-ai-core`, sibling repo). It is the canonical surface where every webshop feature is manually verified, so the design must exercise the **full feature matrix** — a pretty shop that hides half the features is a failure.

Read before designing:

- `CLAUDE.md` (this repo) — project conventions.
- `../cms-ai-core/CLAUDE.md` — the commerce module map: every feature, route group, and setting. Dense but authoritative.
- `../cms-ai-core/docs/webshop-manual-test-plan.md` — end-to-end QA walkthrough; the best plain-language tour of every user-facing flow you are designing for.
- `../cms-ai-core/docs/webshop-design.md` — architecture and decision log.
- `src/` in this repo — the current implementation: routes, components, SCSS structure.

**Tech constraints (non-negotiable):**

- React 19 + react-router 7 + Vite. Mantine 7 is currently used for storefront UI; you may keep it (restyled via theme + SCSS) or replace it with pure custom SCSS components — your call, but state it explicitly and keep the migration realistic.
- Styling lives in SCSS partials under `src/styles/` (tokens in `styles/abstracts/_tokens.scss`). Your design system must land as tokens there.
- Icons: `lucide-react`.
- Payment: Stripe Elements mounts inside your payment card on the order page — its inputs are Stripe-rendered; you style the container, not the iframe internals.
- Emails: React Email components in `../cms-ai-core/apps/api/src/emails/` — email-client-safe design (inline styles, table-friendly layout, no web fonts guaranteed).
- **Accessibility must not regress:** skip link, global `:focus-visible` ring, option pickers as `role="group"` + `aria-pressed`, `aria-invalid` on checkout errors after submit attempt, correct heading order. There are axe tests (`pnpm test`) that must stay green.
- Fully responsive, mobile-first. Croatian + English locales (design for text expansion; HR strings run longer).
- **Every visible string is CMS-editable** via translation strings (`t("key")` from `src/lib/locale.tsx`) — your design specifies copy, but implementation must route all copy through string keys in `project-data.seed.json`. Missing keys render as the literal key, so incomplete copy is loud.

---

## 2. The imaginary brand — you invent it

Propose **2–3 brand concepts** for the user to pick from. Each concept needs: shop name, product domain, tone of voice, logo direction (text/simple mark — no external assets), color palette, and typography direction (system/self-hostable fonts only; no external font CDNs on the storefront).

The product domain must plausibly cover the whole feature matrix, so pick something that naturally includes:

- **Physical products with variants** (e.g. size/color/material option axes, per-variant price + stock, per-variant SKU).
- **Digital products** (downloadable files, license keys) and **service-like items** — these skip shipping entirely.
- **Sale prices** (compare-at + the EU **Omnibus** "lowest price in the last 30 days" disclosure).
- **B2B**: business customers with negotiated price lists, quotes/inquiries.
- **Inquiry-only products** (not purchasable → quote request instead of add-to-cart).
- A **category tree** (nested categories, category landing pages).
- Products with **rich content** (block-based body: text, galleries) and plain ones.
- Out-of-stock states worth subscribing to (back-in-stock notifications).

Examples that fit: specialty tools/hardware, audio gear + sample packs, photography equipment + presets, coffee gear + subscriptions-as-services. Pick better ones if you have them. The user will choose one concept; you then also draft the **seed catalog plan** (categories + ~15–25 products with variants/prices/stock) that exercises everything above — this becomes test data.

---

## 3. Screen inventory — everything that must be designed

Routes live in `src/App.tsx`, all under `/:locale/…` (hr/en). Read each route component for the full state list; summarized here.

### Global chrome
- **Header**: logo, nav (CMS-driven menu — arbitrary depth/labels, editors change it at runtime), search entry point, language switcher (HR/EN, must handle a page missing in the other locale), cart indicator with item count, account entry (guest vs logged-in states).
- **Footer**: CMS-driven menu(s), locale-aware links, legal/contact area.
- **Cookie/consent banner** (`src/components/CookieBanner.tsx`): analytics consent — must render accept/decline, persist choice, and stay out of the way. Analytics (GA4) loads only after grant.
- Toast/notification styling (Mantine notifications), loading states, error boundaries, 404 (`NotFound.tsx`).

### Content pages
- **Homepage** (`HomePage.tsx`) — currently a placeholder list of pages. Design a real shop homepage: hero, featured categories/products, USP band, etc. Note: homepage content should be CMS-composable where possible (the CMS has block-based pages), but a code-defined layout fed by catalog API calls is acceptable — state your approach.
- **Generic CMS page** (`PageView.tsx`) — renders editor-built pages made of "mixed-content" blocks (rich text, images, galleries, links, buttons). These are arbitrary editor content: design the typographic system and block spacing, not fixed layouts. Also used for about/terms/privacy-type pages.

### Catalog
- **Catalog / shop listing** (`CatalogPage.tsx`, `components/shop/CatalogBrowser.tsx`): product grid + **facet sidebar** (`FacetSidebar.tsx` — category, price range, product options, availability), full-text search box, sort control, pagination. States: no results, loading, active-filter chips.
- **Category landing** (`CategoryPage.tsx`): category header (name/description), subcategory navigation, filtered product grid. Categories nest — breadcrumbs required.
- **Product card** (in `ProductGrid.tsx`): image, name, price (regular / sale with compare-at struck through / "from X" for multi-variant / B2B price-list price), stock badge, wishlist heart, digital/inquiry-only markers.
- **Product detail** (`ProductPage.tsx`): gallery, name, price block (incl. sale + **Omnibus lowest-30-day price note** — legally required, design it legible, not hidden), **variant/option picker** (`role="group"`/`aria-pressed` — respect it), stock status, quantity + add-to-cart, **back-in-stock form** (`BackInStockForm.tsx`, shown when out of stock, guest-friendly email field), wishlist button, block-based content body, **reviews section** (`ReviewsSection.tsx`: average + count, list, submit form — gated to verified customers, optionally buyers-only per shop setting, "verified purchase" badge), breadcrumbs, JSON-LD is already emitted (no design needed). Inquiry-only products show a quote-request path instead of add-to-cart.

### Cart & checkout
- **Cart** (`CartPage.tsx`): line items (variant labels, unit/line prices), quantity edit, remove, **multi-coupon** entry + applied-coupon list with per-coupon remove (stackable rules produce errors: `not_stackable`, `coupon_already_applied`, invalid code — design error presentation), totals with **itemized VAT**, B2B note when a price list applies, empty-cart state, "continue to checkout".
- **Checkout** (`CheckoutPage.tsx`): contact + shipping/billing address form (guest) or **saved-address picker** (verified customers, address book), **shipping method selection** (name/price/COD-eligibility), **payment mode radio** — the shop offers an intersection of `pay_now` (card), `bank_transfer`, `cod` (+ COD surcharge shown); **digital-only carts skip the shipping step entirely**; marketing-consent tri-state checkbox; validation errors (`aria-invalid` after submit attempt); mixed inquiry carts divert to a **quote request** instead of a payable order. Design both the happy path and every branch.

### Order page (the densest screen — `OrderPage.tsx`, token-URL, works for guests)
Cards that appear conditionally; design all of them:
- Order header: number, date, status (payment / fulfillment states — design a status language: colors + labels for `awaiting_payment/paid/refunded/…`, `unfulfilled/partially_shipped/shipped/returned/…`).
- **Payment card**: Stripe Elements card form (pay_now, polls for the paid flip — design the "confirming payment…" state), bank-transfer instructions (amount, reference = order number, IBAN, due date, **proforma PDF download**), COD confirmation note.
- **Quote card**: "your quote is ready" — line items, validity date, **accept / decline** actions; expired/declined states.
- **Items** with per-line fulfillment (shipped X of Y), shipping address, totals.
- **Invoice download** (appears once fiscalized), proforma download (bank transfer).
- **Downloads card** (digital goods: per-file download links with expiry, license keys).
- **Returns card**: eligibility window (from ship date), per-line return request (qty + reason), request states (requested/approved/rejected), returns-disabled fallback ("contact us" + email).
- Not-found/expired-token state.

### Customer account
- **Account page** (`AccountPage.tsx`): login + registration. Registration is two-mode: **personal** and **business** (company name, OIB, VAT ID; business accounts land as "pending approval" and buy at B2C terms until approved — design the pending banner and the approved/price-list state). **Social login** buttons: Google, Apple (+ a dev-stub provider in dev). Logged-in view: profile summary, verification nag ("verify your email to unlock wishlist sync / reviews / addresses / order history") with resend action, change password, logout, links to sub-pages, marketing-consent status.
- **Address book** (`AddressBookPage.tsx`): list, add/edit/delete, default shipping + default billing badges.
- **Order history** (`OrdersPage.tsx`): claimed + own orders, newest first, status glance, link to order pages. Empty state.
- **Wishlist** (`WishlistPage.tsx`): product cards, remove; works guest-local (localStorage) and merges to server on verify — same design either way.
- **Forgot password** (`ForgotPasswordPage.tsx`), **reset password** (`ResetPasswordPage.tsx`), **verify email** (`VerifyEmailPage.tsx`) — token-link landing pages; design success/expired/invalid states.

---

## 4. Dynamic variability the design must absorb

Admins/editors change these at runtime — the design cannot assume fixed content:

- **Menus, page tree, all copy strings, site title/tagline/favicon/OG defaults** — CMS-edited.
- **Locales**: hr + en today; switcher must handle missing translations (fallback per `alternates`).
- **Shop settings** that flip UI: default + per-product **checkout mode**; `returns_enabled` (off → returns card becomes "email us"); `reviews_buyers_only`; digital link TTL; `digital_allow_bank_transfer`; COD surcharge; shipping methods list (arbitrary names/prices); enabled **payment providers** (Stripe may be absent → no card option).
- **Pricing variability**: B2C gross prices; sale + Omnibus note; B2B assigned price list (approved businesses see their prices everywhere: catalog, product, cart, checkout); cross-border EU reverse-charge (net prices — rare edge, at least don't break); multi-coupon stacking.
- **Customer state matrix** (design every state, don't collapse them): guest → registered-unverified (blocked from wishlist-sync/reviews/addresses/order-history, with clear "verify" prompts) → verified → business-pending → business-approved. Plus GDPR-erased accounts simply don't log in (no UI needed).
- **Stock**: tracked with quantity, untracked, out-of-stock (+ back-in-stock), low stock is admin-only (no storefront UI).

---

## 5. Email templates

All live in `../cms-ai-core/apps/api/src/emails/` as React Email components, EN + HR copy in `strings.ts` / `ORDER_EVENT_COPY`. Design **one master transactional layout** (logo/brand header from `siteTitle`, content area, footer) plus per-event content. Inventory:

- **Customer order events** (`OrderEventEmail.tsx`, one template, 10 event variants): `order_confirmation` (proforma PDF attached for bank transfer), `paid` (invoice PDF attached), `shipped`, `refunded`, `cancelled`, `quote_ready`, `digital_ready` (download links), `return_requested`, `return_approved`, `return_rejected`.
- **Customer auth** (`CustomerAuthEmail.tsx`): email verification, password reset.
- **`BackInStockEmail.tsx`** — product back in stock.
- **`OrderStockVoidedEmail.tsx`** — order cancelled for stock shortfall at capture.
- **Admin-facing** (lower priority, same skeleton): `LowStockEmail.tsx`, `ReturnRequestEmail.tsx`, plus CMS-user `ActivationEmail.tsx` / `ResetPasswordEmail.tsx` (these serve the admin panel; keep them neutral-brand, not shop-brand).

Also branded but not email: **PDF documents** (invoice/proforma/storno, `lib/commerce-documents.ts`) already have a seller-letterhead layout — optional: propose a light visual alignment (logo, typography) but the fiscal content is legally fixed; do not redesign the data.

---

## 6. Out of scope

- The **admin panel** (`@cms/admin-base`, Mantine, has its own design system) — do not touch.
- API, SDK (`@cms/storefront`), pricing/fiscal logic — read-only context for you.
- No new features; no feature removals. If a flow feels awkward, note it as a recommendation, don't design it away.

---

## 7. Deliverables & process

**Phase 1 — concepts (stop for approval):** 2–3 brand concepts (name, domain, palette, type, tone, logo direction) + a one-screen visual sample each (homepage or product card as HTML mockup). User picks one.

**Phase 2 — design system + key screens (stop for approval):** design tokens (colors incl. semantic status colors for order/payment/fulfillment/return states, type scale, spacing, radii, shadows, buttons, forms, cards, badges), plus hi-fi HTML mockups of: homepage, catalog with facets, product detail (physical w/ sale + variants), cart, checkout, order page (pay_now + bank_transfer variants), account/login. Desktop + mobile for each. Deliver as self-contained HTML artifacts.

**Phase 3 — full coverage (stop for approval):** remaining screens + all conditional states (quote, returns, downloads, B2B pending/approved, empty/error states), email master template + event variants, seed catalog plan (categories/products/variants that exercise the feature matrix, incl. HR+EN names).

**Phase 4 — implementation handoff:** token → `_tokens.scss` mapping, component inventory mapped to existing files, string-key list for all new copy (EN + HR), ordered implementation checklist sized so each step is verifiable in the running storefront (`./start.sh`).

Ask the user before deviating from this process. Croatian copy: draft it, but flag that a native check is wanted.
