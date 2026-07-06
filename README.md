# cms-ai-project-webshop-template

Test bed / reference template for the **cms-ai-core webshop (commerce) module**.

It's a standard `cms-ai-project-*` consumer of the CMS engine, grown alongside the commerce module
as each roadmap phase lands. Design + plan: `cms-ai-core/docs/webshop-design.md` and
`cms-ai-core/docs/webshop-roadmap.md` (Phase L).

> **Status:** stock CMS frontend + admin only. Commerce features are added starting at roadmap task
> L0.1; the storefront frontend is built from L2 onward.

## Run

```bash
# requires Docker + pnpm (corepack enable pnpm)
./start.sh        # → admin :5173, website :3000, API :3001 (auto-picks free ports)
./stop.sh
```

`cms-ai-core` must be a sibling checkout. On the dev machine that's `cms-ai-core-1`; `start.sh`
auto-detects it, or pass `CMS_CORE_DIR=/path/to/core ./start.sh`.

Default seeded login: `developer@artkod.com` / `k0dart`.

Docker also starts an optional **Meilisearch** container (core L9.7, port `7700`) for the pluggable
storefront search engine. The shop works without it (the built-in Postgres search is the default and
the automatic fallback); to try it, switch admin → Commerce Settings → Search to *Meilisearch* with
URL `http://localhost:7700` and API key `dev_meili_master_key`.

## Layout

```
admin/            Vite admin shell — createAdmin() + vendored @cms/admin-base
src/              Public frontend (React + Vite)
start.sh/stop.sh  Local dev orchestration (Docker DB + core API + admin + web)
project-data.seed.json   Per-project strings + runtime page types (empty for now)
```
