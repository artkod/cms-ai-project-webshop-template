# Handoff: Alder & Co storefront redesign

## Overview
This is the visual + UX redesign for `cms-ai-project-webshop-template`, following the project's own `docs/DESIGN-BRIEF.md`. The invented brand is **Alder & Co** — considered clothing essentials, made-to-measure tailoring, and small-batch wholesale — chosen because it naturally exercises the full commerce feature matrix (variants, digital goods, inquiry-only products, B2B price lists, sale/Omnibus pricing, nested categories, back-in-stock, returns, quotes).

## About the design files
The attached prototype (`alder-webshop-prototype.html`) is a **design reference**, built as a single self-contained click-through in a non-React tool. It is not production code and must not be copied verbatim — its markup, state management, and styling approach do not match this repo's stack. Treat it purely as the source of truth for **look, copy, layout, and behavior**, and reimplement it natively in this codebase's existing environment: React 19 + react-router 7 + Mantine 7 (restyled) + SCSS partials under `src/styles/abstracts/_tokens.scss`, `src/styles/pages/`, `src/styles/base/`.

Open the HTML file in a browser — it has a "Prototype — jump to screen" control (bottom-right) to move between every screen, plus inline demo toggles on the product/cart/checkout/order/account screens to click through conditional states (out-of-stock, sale, B2B, quote, payment/fulfillment status combinations, empty states, token-expired states, etc). Use those toggles to see every state before implementing.

## Fidelity
**High-fidelity** for the design system (color, type, spacing, component shapes) — implement these values pixel-for-pixel. The screens themselves are **representative, not exhaustive** — real content, exact copy for every locale string, and pagination/data wiring are implementation's job; the prototype shows one example per state, not every product in the seed catalog.

## Brand & design tokens

Palette — warm, quiet, neutral-first with a single bronze accent. Map into `src/styles/abstracts/_tokens.scss`, replacing the current green "Clean & Corporate" values but **keeping the same custom-property names** so existing partials (`var(--brand)`, `var(--ink)`, etc.) don't need renaming everywhere — add the new ones listed as additions.

```
--bg: #F5F3EE;            /* page background, warm cream */
--surface: #FFFFFF;
--surface-tint: #EFEAE1;   /* card / callout fill (was --brand-tint) */
--border: #E4DCC9;         /* hairlines, was --border */
--ink: #17140F;             /* primary text/ink, near-black warm */
--ink-2: #55503F;           /* secondary text */
--ink-3: #8A8267;           /* tertiary/meta text */
--brand: #A9895E;           /* bronze accent — links, active states, CTAs on light */
--brand-hover: #17140F;     /* links/buttons darken to ink on hover, not a brighter accent */
--tan: #D9D2C4;             /* light tan — chips, inactive borders */

/* Footer (near-black, not brand green) */
--footer-bg: #17140F;
--footer-line: #33301F;
--footer-ink: #EFEAE1;
--footer-ink-2: #8A8267;

/* Semantic status colors — order/payment/fulfillment/return states */
--status-pending-bg: #F3E7CE; --status-pending-fg: #7A5A17;   /* awaiting_payment, partially_shipped */
--status-positive-bg: #DCEADD; --status-positive-fg: #2E4A31; /* paid, shipped */
--status-neutral-bg: #E3E1F0;  --status-neutral-fg: #413A6B;  /* refunded, returned */
--status-negative-bg: #F3D9D3; --status-negative-fg: #7A2E1E; /* failed */

--ln-container: 1140px;      /* unchanged */
--ln-gutter: clamp(20px, 5vw, 40px); /* unchanged */
```

Typography — two families, self-hosted (no external font CDN per brief constraint):
- **Display/headlines**: Instrument Serif, italic, regular weight only. Used for all H1/H2 and the wordmark. Source and self-host the variable/italic files under `public/fonts/` with `@font-face` in `global.scss` (do not link Google Fonts at runtime).
- **UI/body**: Work Sans, weights 400/500/600. Used for everything else — nav, body copy, buttons, forms, badges.
- Minimum sizes: 13px for meta/labels, 14–16px body, 22–34px section/page headings, hero H1 up to 56px desktop / ~34px mobile.

Shape language: sharp-ish, low-radius (2px on buttons/cards/inputs, 4px on larger panels, 999px only on pill badges/language switcher). Borders are 1px, hairline `--border` or `--tan`. No shadows except the cookie banner and sticky checkout summary (soft, `0 12px 32px rgba(0,0,0,.2)`-ish). Buttons: solid ink-on-cream primary, outline secondary — no gradients.

## Global chrome
- **Header** (`RootLayout.tsx` / `_header.scss`): sticky, translucent cream background with blur, logo as italic serif wordmark "Alder & Co", inline nav (CMS-driven, arbitrary depth — render top-level as flat links, active item gets a 2px bottom border in `--brand`), search icon+label button, EN/HR pill switcher (segmented, active = filled ink pill), account icon+label ("Sign in" for guest, "Account" once logged in), cart icon with a small bronze count badge that only renders when count > 0.
- **Footer** (`_footer.scss`): full-bleed near-black (`--footer-bg`), 4-column grid (brand blurb / Shop links / Account links / Info links), thin divider, copyright + locale label row at the bottom.
- **Cookie banner** (`CookieBanner.tsx`): bottom-left floating card, near-black, Accept (filled cream) / Decline (outlined) buttons, persists choice, analytics loads only after Accept — behavior unchanged, just restyle to tokens above.
- Skip link, focus-visible ring, and all existing a11y behavior must be preserved (see `test/a11y.test.tsx`).

## Screen-by-screen spec
Each maps to an existing route file — implement inside it, don't create new routes.

**HomePage.tsx** — Hero (2-col: eyebrow + serif H1 + supporting copy + two CTAs / image placeholder at 4:5), a 4-up USP band (free shipping / made-to-measure / responsibly sourced / returns) between hairline rules, "Shop by category" 4-up card grid (3:4 image + label), "Featured pieces" 4-up product grid reusing the catalog product card. Homepage can stay code-defined and driven by catalog API calls (per brief §"Content pages") rather than full block-based CMS composition.

**CatalogPage.tsx / CatalogBrowser.tsx / FacetSidebar.tsx** — breadcrumb, H1 + result count, search input (icon-left) + sort select top-right, active-filter chips row (removable), 220px facet sidebar (category checkboxes, price range slider, size as a `role=group`/`aria-pressed` button row, in-stock-only checkbox) + 3-up product grid + pagination. Explicit empty-state ("No products match these filters" + clear-filters CTA).

**CategoryPage.tsx** — same shell as catalog with a category header/description and breadcrumb reflecting nesting (Home / Men / Outerwear); subcategory nav above the grid.

**ProductGrid.tsx (card)** — 3:4 image, wishlist heart top-right, top-left badge (black "Out of stock" OR bronze "Digital" — never both), category meta line, name, then either "Request a quote" (inquiry-only, no price shown) or price line: `$X` (or `From $X` when multi-variant) + struck-through compare-at + sale tag when on sale.

**ProductPage.tsx** — breadcrumb; 2-col gallery (thumbnail rail + main 3:4 image) / info column. Info column branches on product type:
- *Inquiry-only*: description + a quote-request form (email + notes textarea) inline, no price/cart.
- *Physical/digital*: price row (current price, struck-through compare-at + "Sale" tag when on sale), and when on sale a required-by-law line: "Lowest price in the last 30 days: $X · required by EU Omnibus Directive". Option groups render as `role=group` labeled button rows with `aria-pressed`. In-stock: quantity stepper + "Add to cart — $X" button. Out-of-stock: stepper/cart hidden, replaced by an inline back-in-stock email capture. Wishlist button below. Below the fold: details & care copy + two supporting images, then a reviews section (average + count, list with "Verified purchase" badge, review form gated behind verified-customer copy).

**CartPage.tsx** — line items (thumbnail, name, variant, qty stepper, remove, line total), a B2B note callout when a wholesale price list applies, multi-coupon UI (input+apply, applied coupons as removable chips, inline stackability error text), summary card (subtotal, coupon discount, itemized VAT, "shipping calculated at checkout", total, continue-to-checkout). Explicit empty-cart state.

**CheckoutPage.tsx** — contact email (aria-invalid + error text after failed submit), shipping address form OR "use saved address" link for verified customers, shipping-method radio group (name/eta/price, one marked COD-eligible), payment-mode radio group as expandable cards (pay_now → Stripe mount point; bank_transfer → note that instructions render post-order; cod → surcharge note) restricted to whichever providers/modes the shop has enabled, marketing-consent checkbox (optional, explicitly opt-in language), sticky order-summary sidebar. Digital-only carts hide the entire shipping section. Carts containing an inquiry-only item divert to a distinct "submit a quote request" panel instead of payment.

**OrderPage.tsx** (token URL, works for guests — the densest screen) — header (order number/date + payment-status badge + fulfillment-status badge, colors/labels per the semantic status tokens above). Cards, each conditional: Payment (Stripe form + "confirming payment…" while awaiting_payment, paid confirmation once flipped; OR bank-transfer instructions with IBAN/reference/due-date + proforma download; OR COD confirmation note) — replaced entirely by a Quote card (line items, validity date, accept/decline) when the order is a quote. Items list with per-line "shipped X of Y" and the shipping address. Downloads card (digital files with expiry + license keys) appears only when paid and the order has digital lines. Documents card (invoice once paid/refunded, proforma while awaiting bank transfer). Returns card: eligibility copy once shipped, per-line "Request return" button, or — when the shop has `returns_enabled` off — a plain "email us" fallback. A not-found/expired-token state replaces the whole page for bad tokens.

**AccountPage.tsx** — for guests: three tabs (Sign in / Register / Business). Sign-in has email/password, forgot-password link, Google/Apple social buttons below a divider. Personal register is a short form. Business register additionally asks company name, OIB, VAT ID, and submits to a "pending approval" state. Logged-in view: unverified banner (amber) with resend-verification action; business-pending banner (amber, buying at retail terms) or business-approved banner (green, price list applied); account summary card (name/email/marketing status); link list to order history/addresses/wishlist/price list; change-password + logout.

**AddressBookPage.tsx** — card list with "Default shipping"/"Default billing" pill badges, edit/delete, add-new CTA.

**OrdersPage.tsx** — reverse-chronological list rows (number, date, item count, status pill, total), empty state with a "start shopping" CTA.

**WishlistPage.tsx** — same product-card grid as catalog; a small note explaining guest-local-storage vs. synced-to-account, per verification state.

**ForgotPasswordPage.tsx / ResetPasswordPage.tsx / VerifyEmailPage.tsx** — plain centered single-column forms; each has an explicit expired/invalid-token alternate state (message + a recovery CTA) in addition to the happy path.

**PageView.tsx (generic CMS page)** — the typographic system used on the About/Terms/etc. pages: breadcrumb, serif italic H1, 15px/1.8 body copy in `--ink-2`-adjacent tone (slightly darker, `#3A362B`, for long-form legibility), full-width 16:9 image-block slot between paragraphs. This defines spacing rules for arbitrary editor block content, not a fixed page.

**NotFound.tsx** — centered, large pale serif "404", short message, back-to-home CTA.

## Interactions & behavior
- All option pickers, filters, and payment/shipping choices are implemented as button/radio groups with `role="group"` + `aria-pressed`/native `checked` — preserve for a11y parity with current tests.
- Checkout errors only appear after a submit attempt (`aria-invalid` toggles then, not on load).
- Cart/coupon errors are inline text under the coupon form, not toasts.
- No page transition animations in the reference; keep interactions snappy (hover = color/border shift only, no scale/shadow pop).

## Assets
All imagery in the prototype is a placeholder (diagonal-stripe SVG pattern block with a monospace caption describing the shot needed, e.g. "product photo — Field Oxford Shirt", "hero photo — model wearing Field Oxford Shirt"). No real photography is included — source or shoot real product/lifestyle photography per the captions before shipping. Icons are inline stroke SVGs (24px viewBox, 2px stroke) in the style of `lucide-react` — swap for the actual `lucide-react` icons of the same shape (search, user, shopping cart, heart) rather than keeping hand-drawn SVGs.

## Files
- `alder-webshop-prototype.html` — the full click-through reference (all screens + states). Keep it in the same folder as `Header.dc.html`, `Footer.dc.html`, `ProductCard.dc.html`, `FacetSidebar.dc.html`, and `support.js` — it loads those at runtime and won't render standalone if separated. Open `alder-webshop-prototype.html` directly in a browser; no build step needed.
