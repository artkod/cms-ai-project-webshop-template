# cms-ai-project-webshop-template — Claude Development Guide

This file is auto-loaded by Claude Code at the start of every session.

---

## What this project is

The **test bed / reference template** for the cms-ai-core **webshop (commerce) module**. It is a
normal `cms-ai-project-*` consumer of the CMS engine that we grow alongside the module as each
roadmap phase lands. The design + build plan live in the core repo:
`cms-ai-core/docs/webshop-design.md` and `cms-ai-core/docs/webshop-roadmap.md` (Phase L).

**Current status:** the commerce **admin** module is enabled (`createAdmin({ commerce: true })` +
`COMMERCE_ENABLED=true`, since L0.1) and a real storefront frontend is being grown against the
**vendored** `@cms/storefront` SDK (`vendor/storefront`, see below). It now covers browse → product
→ cart: `src/routes/CatalogPage.tsx` / `ProductPage.tsx` / `CartPage.tsx` + `lib/cart.tsx`
(`CartProvider`) + `lib/storefront.ts` (the client). The cart page includes a **shipping picker**
(ship-to country, method selection with live rates, pickup-point — L4.4) with totals recomputed
server-side. **COD** has no cart UI (it's a payment method → chosen at checkout, L4.5/L7.4; the
surcharge engine exists). **Re-vendor (`pnpm vendor:storefront`) after any SDK change**, and
`start.sh` now clears the frontend Vite dep cache on boot so the re-vendored bundle is picked up.
Checkout + payments land in later phases (L4.5+/L6).

## Related repos

`cms-ai-core` must be cloned as a sibling directory. **On the current dev machine the working core
clone is `cms-ai-core-1`** (there is also a stale non-git `cms-ai-core` copy — ignore it).
`start.sh` auto-prefers `cms-ai-core-1`, then `cms-ai-core`; override with `CMS_CORE_DIR=…`.

---

## Running

```bash
./start.sh    # Docker DB, migrations, dev-user seed, project-data seed, API, admin, frontend
./stop.sh     # clean shutdown
```

- Requires **Docker** and **pnpm** (`corepack enable pnpm` if missing).
- Custom core path: `CMS_CORE_DIR=/path/to/cms-ai-core ./start.sh`
- Default dev login (seeded): `developer@artkod.com` / `k0dart`.
- Ports auto-pick from 5432/3000/3001/5173 upward.

---

## Tech stack

React 19 + Vite 6, React Router v7, Mantine 7 (light, teal), TypeScript, PostgreSQL 16 (Docker).
DB name `project_webshop_template`; project slug `project-webshop-template`.

---

## Page types

Only the built-in **`default`** page type so far (Mixed Content blocks). Commerce page/block types
are added per the roadmap. When adding any project page type, follow the rules in
`cms-ai-core/docs/project-CLAUDE-template.md` (ask for EN+HR labels, `deletable`, `limit`, etc.).

## Frontend rendering (`src/routes/PageView.tsx`)

- `default` (and the index `HomePage`) — renders the page title + Mixed Content blocks via the
  built-in widget renderers (text / video / link / accordion / gallery / section). Unknown types
  fall through to the default view; `404` renders `NotFound`.
- Generic lib kept from the project template: `src/lib/api.ts` (CMS client),
  `src/lib/locale.tsx` (locale/strings/alternates providers), `src/lib/seo.ts`,
  `src/lib/tiptapRenderer.ts`. URL shape `/{locale}/{ancestorSlugs…}/{slug}`.

## Admin panel (`admin/`)

`admin/src/main.tsx` is a minimal `createAdmin({ projectSlug: "project-webshop-template" })`. The
`@cms/admin-base` bundle is vendored at `admin/vendor/admin-base` (refresh with
`pnpm vendor:admin-base`). Commerce admin is enabled here (`commerce: true`) at task L0.1.

## Storefront SDK (`@cms/storefront`, L2.1+)

The frontend depends on the commerce SDK `@cms/storefront`, **vendored** at `vendor/storefront`
(`file:` dependency) — same model as `admin/vendor/admin-base`. Rebuild + re-vendor it after any
change in `cms-ai-core/packages/storefront` with **`pnpm vendor:storefront`**
(`scripts/vendor-storefront.sh`), then commit the updated `vendor/storefront/` so the next Vercel
deploy picks it up. The SDK is a self-contained single-file bundle with no runtime deps. *(L2.1 is
the client skeleton; the frontend starts importing catalog methods at L2.2, at which point
`start.sh` will also live-link the SDK dist for local dev, like it does for admin-base.)*

---

## Keeping this file current

Update as commerce features land — new page/block types, the storefront frontend, and the
`commerce: true` admin flag. Mirror anything non-obvious into the core's `docs/webshop-*` docs.
