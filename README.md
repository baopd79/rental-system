# VnRental

> A multi-tenant SaaS for Vietnamese rental-house owners — manage properties, rooms, tenants, contracts, and generate monthly electricity/water invoices with public share links sent over Zalo/SMS.

**Live demo:** https://rental-system-nine-umber.vercel.app

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-async-009688?logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF)
![Vercel](https://img.shields.io/badge/Frontend-Vercel-000000?logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render&logoColor=white)

---

## Screenshots

| Properties list & detail drawer | Bulk invoice generation |
| --- | --- |
| ![Properties list](image/Properties%20_%20List%20_%20Detail%20Drawer.png) | ![Generate invoice](image/Generate%20Invoice%20_%20Bulk%20Modal.png) |

| Utility readings (per-room, per-month) | Public invoice (no login required) |
| --- | --- |
| ![Utility readings](image/Utility%20Readings%20_%20nhap%20chi%20so.png) | ![Public invoice](image/Public%20Invoice%20_%20Trang%20kh_ch%20thu_%20m_%20t_%20link.png) |

---

## The problem

Most independent landlords in Vietnam still manage rentals with spreadsheets or paper notebooks. Calculating monthly bills by hand is slow and error-prone — meter readings get transcribed wrong, prorations for mid-month move-ins are skipped, and invoices are sent as plain text over Zalo with no professional format.

VnRental digitises the full workflow: create a property → add rooms → sign a contract → record meter readings → generate invoices → share a public link the tenant can open without an account.

**Target users:** independent landlords with 1–50+ rental rooms across one or more buildings.

---

## Features

**Multi-tenant auth**
- Sign-in/sign-up handled by Clerk; backend verifies JWTs against Clerk's JWKS (RS256).
- Every row in the data model is isolated by `clerk_user_id` on the `property` table; downstream tables (room, contract, invoice…) inherit isolation through FK chains.

**Properties, rooms, tenants, contracts**
- Per-property defaults for electricity rate, water billing mode (`per_meter` / `per_person` / `per_room`), bank details, and surcharge templates.
- Per-room overrides for electricity rate; rooms track `vacant` / `occupied` / `maintenance` state.
- Contract lifecycle with an event timeline (`created`, `rent_changed`, `people_changed`, `ended`).

**Monthly invoicing**
- Meter readings keyed by `(room_id, period)`; previous-month value auto-filled and scoped to the **same contract** to prevent cross-tenant contamination.
- **Bulk meter entry** — record electricity and water readings for every room in a property on one screen, one period at a time.
- **Bulk invoice generation with rules** — pick a property and period, then generate invoices for all eligible rooms in a single transaction. Rooms with missing readings, no active contract, or already-issued invoices for the period are skipped and reported back so the landlord knows exactly what was created vs. why something was excluded.
- Proration for partial first/last months on rent and fixed surcharges (`days_occupied / days_in_month`); meter-based items are never prorated.
- Shared meters (e.g. a corridor light) split across multiple rooms.
- Invoice status flow `draft → sent → paid`; ending a contract is blocked while unpaid invoices exist.

**Public invoice link**
- Tenants open a tokenised URL with no auth and view the invoice in a print-friendly layout.
- Sensitive fields (CCCD, phone) are stripped from the public endpoint.

**Dashboard**
- Monthly revenue, vacancy rate, contracts expiring soon — computed with a single raw-SQL aggregation per metric.

---

## Architecture

```
┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│  Next.js 15 (Vercel) │ ──▶ │  FastAPI (Render)    │ ──▶ │  Neon (Postgres) │
│  App Router · TS     │     │  async SQLModel      │     │  serverless      │
└──────────┬───────────┘     └──────────┬───────────┘     └──────────────────┘
           │                            │
           └──────────┐    ┌────────────┘
                      ▼    ▼
                  ┌──────────────┐
                  │  Clerk Auth  │
                  │  (JWKS/RS256)│
                  └──────────────┘
```

**Backend layering** is strict: `Router → Service → Repository → Model`.

- **Router** parses the request and calls one service method. No business logic, no direct DB access.
- **Service** owns the transaction boundary, runs business rules, and raises typed `AppException`s (never `HTTPException`).
- **Repository** performs DB operations only and never commits.
- **Model** is a SQLModel table with no logic; request/response shapes live in separate `schemas/` Pydantic types.

This separation makes each layer trivially testable in isolation and keeps the call graph easy to follow.

---

## Tech stack

| Layer            | Choice                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| Frontend         | Next.js 15 (App Router), TypeScript, Tailwind v4, shadcn/ui, Clerk SDK |
| Backend          | FastAPI, Python 3.12+, SQLModel (async), asyncpg                       |
| Database         | PostgreSQL 16 — Docker locally, Neon (serverless) in production        |
| Migrations       | Alembic (manual review of every autogenerated file)                    |
| Auth             | Clerk (RS256 JWT verified via JWKS on the backend)                     |
| Package managers | `uv` (backend), `pnpm` (frontend)                                      |
| Deployment       | Vercel (frontend), Render (backend), Neon (database)                   |

---

## Technical highlights

- **JWKS verification with rotation handling.** Clerk's JWKS is cached with a 1-hour TTL and a force-refresh path triggered when a token's `kid` isn't in the cached set. `AUTH_DEV_MODE` is an explicit opt-in; missing config in production is fail-closed (401 `"Auth not configured"`), never a silent bypass. JWT decode errors return a generic `"Invalid token"` to clients while the detailed reason is logged server-side. **Verified by 6 production-path integration tests** covering valid tokens, wrong issuer, expired tokens, missing `sub`, `kid` rotation triggering a refresh, and fail-closed misconfiguration.
- **Tenant isolation at the data layer.** Every `utility_reading` carries a `contract_id`. The "previous month" lookup that auto-fills `elec_prev` only matches readings from the **same contract**, so a new tenant's first invoice can never pick up the previous tenant's final meter reading. The month-skip continuity guard is scoped the same way. Covered by integration tests in `test_billing.py` and `test_utilities.py` that simulate a room turning over mid-period.
- **Targeted raw SQL for list endpoints.** Dashboard and billing list views need data joined across 4–5 tables. Those specific endpoints use `sqlalchemy.text()` returning `list[dict]`, replacing per-row ORM lookups (N+1) with a single aggregation query; mutating paths and CRUD endpoints stay in SQLModel. The exception is scoped to **8 read-only files** (`dashboard_service.py`, `billing_repo.py`, `utility_repo.py`, etc.) and documented as a layering rule rather than a free-for-all.
- **Transaction discipline.** Services own commits; repositories only `flush()` to surface generated IDs. No `async with session.begin()` (it conflicts with asyncpg's autobegin) and no commits in repositories.
- **Migration risk classification.** Every migration is classified before running — safe (add nullable column), check-data-first (add UNIQUE, add NOT NULL without default), or dangerous (drop/rename column). UNIQUE-constraint migrations always run a duplicate-check query against the production data first.

The full backend test suite is **125 tests** (unit + integration) running against a real PostgreSQL database (no mocks) on every change.

---

## Local development

**Prerequisites:** Docker, [uv](https://github.com/astral-sh/uv), [pnpm](https://pnpm.io/), Node ≥ 20.

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Install dependencies
make install

# 3. Run backend (:8000) + frontend (:3000) together
make dev
```

Run `make help` for the full target list (migrations, tests, lint, db-reset). Environment variables are documented in `backend/.env.example` (backend) and `frontend/.env.local.example` (frontend) — the key one is `AUTH_DEV_MODE=true` for local, which skips JWT signature verification.

Tests hit a real PostgreSQL database (no mocks). One-time setup:

```bash
docker exec rental-system-postgres-1 psql -U postgres -c "CREATE DATABASE rental_test_db;"
DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/rental_test_db" \
  uv run --project backend alembic upgrade head
```

---

## Project structure

```
.
├── backend/
│   ├── app/
│   │   ├── core/           # config, dependencies, auth (Clerk JWKS verify)
│   │   ├── models/         # SQLModel tables
│   │   ├── schemas/        # Pydantic request/response types
│   │   ├── repositories/   # DB operations (no business logic, no commits)
│   │   ├── services/       # business logic + transaction boundary
│   │   └── routers/        # FastAPI endpoints
│   ├── alembic/            # migrations
│   └── tests/              # pytest, autouse DB-truncate fixture
├── frontend/
│   ├── app/                # Next.js App Router (auth + dashboard route groups)
│   ├── components/         # shadcn/ui + feature components
│   └── lib/                # api client, formatting helpers
├── docs/                   # SPEC, DESIGN, deployment notes
├── image/                  # README screenshots
└── docker-compose.yml      # PostgreSQL only
```

---

## Deployment

| Component | Host             | Notes                                                          |
| --------- | ---------------- | -------------------------------------------------------------- |
| Frontend  | Vercel           | Auto-deploy from `main`; Clerk keys via project env vars       |
| Backend   | Render           | `uv run uvicorn app.main:app`; `CLERK_JWKS_URL` set explicitly |
| Database  | Neon             | Serverless Postgres; connection string in `DATABASE_URL`       |
| Auth      | Clerk (test env) | Production keys swap with no code change                       |

**Deploy flow.** A push to `main` triggers two independent pipelines. Vercel detects the change in `frontend/` and ships a new build with the Clerk publishable key and `NEXT_PUBLIC_API_URL` baked in. Render rebuilds the backend image, installs Python deps via `uv sync`, runs `alembic upgrade head` against the Neon database as a release command, and rolls the new revision in once the health check passes. Neon itself sits behind both: it stores no application code, scales the compute to zero when idle, and exposes a pooled connection string that `asyncpg` opens on demand. Auth is fully delegated — Clerk hosts sign-in, issues the JWT, and the backend only verifies it against the cached JWKS, so no auth state lives in our infrastructure. Rolling back means redeploying the previous Render revision and (if needed) reverting the Vercel deployment from the dashboard; the database migration story is forward-only and reviewed per change.

**Migration workflow.** Schema changes are written and applied against the local Docker Postgres first (`make be-migration MSG="..."`), reviewed in the generated Alembic file, then committed. Render runs `alembic upgrade head` against Neon on the next deploy. Production migrations are forward-only and pre-classified as safe / check-data-first / dangerous; UNIQUE-constraint changes are gated on a duplicate-check query against the production data before they roll out.

---

## Roadmap

- ✅ MVP: properties, rooms, tenants, contracts, invoices, public link, dashboard
- ✅ Backend module hardening (property, room, tenant, contract, surcharge, utility, auth)
- 🚧 Continued backend refactor pass (billing, invoice, shared-meter, dashboard)
- 🔜 Zalo OA notifications when a new invoice is issued
- 🔜 Mobile-responsive polish for the landlord console

---

## Lessons learned

**JWKS caching and silent key rotation.** The first version of Clerk auth cached the JWKS forever — fast, but every authenticated request would 401 the moment Clerk rotated its signing keys. I added a 1-hour TTL plus a force-refresh path that fires when a token's `kid` isn't in the cached set, and turned `AUTH_DEV_MODE` into an explicit opt-in so a missing `CLERK_JWKS_URL` in production fails closed instead of silently disabling signature verification. The lesson: cache invalidation strategy is part of the auth contract, not a "we can optimise this later" concern.

**Raw SQL as a deliberate exception, not a slippery slope.** Dashboard and billing list endpoints needed to join 4–5 tables per row; through the ORM, latency grew linearly with the number of rooms. I carved out a narrow exception — list endpoints that need joined read-only data use `sqlalchemy.text()` returning `list[dict]`, while every mutating path stays in SQLModel. Writing that down as a layering rule kept the rest of the codebase consistent and stopped raw SQL from leaking everywhere as a "this is faster" reflex.

**Application validators do not retroactively clean historical data.** A late migration added a UNIQUE constraint on property name — normalised for whitespace so `"Nhà A "` and `"Nhà A"` would collide. The Pydantic validator that enforced this on writes had been live for weeks, but it never touched rows already in the database; the migration failed first on local Postgres, then on Neon, with a duplicate-key error. The deploy pipeline contained the blast radius on its own: because `alembic upgrade head` runs inside the container's `CMD` and is idempotent, the failed migration meant the new container never started and Render kept serving the previous revision — no downtime, no half-migrated state. "Delete the duplicates" was an acceptable short-term fix for an MVP whose duplicates were all my own seed data, but it would have been the wrong reflex with real user data; the answer there is an **expand-contract migration** — add a normalised column, backfill it, dedupe by *merging* rows and reassigning FK references rather than dropping data, then enforce the constraint — so destructive cleanup never reaches the user. I formalised the takeaway as a per-migration risk classification (`safe` / `check-data-first` / `dangerous`) and a mandatory pre-flight `GROUP BY … HAVING COUNT(*) > 1` for any UNIQUE addition, documented in `CLAUDE.md` so the rule survives across sessions.

---

## Author

[baopd](https://github.com/baopd79)
