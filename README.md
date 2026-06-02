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
- Proration for partial first/last months on rent and fixed surcharges (`days_occupied / days_in_month`); meter-based items are never prorated.
- Shared meters (e.g. a corridor light) split across multiple rooms.
- Invoice status flow `draft → sent → paid`; ending a contract is blocked while unpaid invoices exist.

**Public invoice link**
- Tenants open a tokenised URL with no auth, view the invoice, and print to PDF via `window.print()`.
- Sensitive fields (CCCD, phone) are stripped from the public endpoint.

**Dashboard**
- Monthly revenue, vacancy rate, contracts expiring soon — computed with a single raw-SQL aggregation per metric.

---

## Architecture

```
┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│  Next.js 15 (Vercel) │ ──▶ │  FastAPI (Render)    │ ──▶ │  PostgreSQL 16   │
│  App Router · TS     │     │  async SQLModel      │     │  managed         │
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
| Database         | PostgreSQL 16                                                          |
| Migrations       | Alembic (manual review of every autogenerated file)                    |
| Auth             | Clerk (RS256 JWT verified via JWKS on the backend)                     |
| PDF              | Client-side `@media print` + `window.print()` — no PDF service needed  |
| Package managers | `uv` (backend), `pnpm` (frontend)                                      |
| Deployment       | Vercel (frontend), Render (backend), managed Postgres                  |

---

## Technical highlights

A few decisions worth calling out — the parts that make the system production-shaped rather than a tutorial clone.

- **JWKS verification with rotation handling.** Clerk's JWKS is cached with a 1-hour TTL and a force-refresh path triggered when a token's `kid` isn't in the cached set. `AUTH_DEV_MODE` is an explicit opt-in; missing config in production is fail-closed (401 `"Auth not configured"`), never a silent bypass. JWT decode errors return a generic `"Invalid token"` to clients while the detailed reason is logged server-side.
- **Tenant isolation at the data layer.** Every `utility_reading` carries a `contract_id`. The "previous month" lookup that auto-fills `elec_prev` only matches readings from the **same contract**, so a new tenant's first invoice can never pick up the previous tenant's final meter reading. The month-skip continuity guard is scoped the same way.
- **Targeted raw SQL for list endpoints.** Dashboard and billing list views need data joined across 4–5 tables. Instead of fighting the ORM, those specific endpoints use `sqlalchemy.text()` returning `list[dict]`; mutating paths and CRUD endpoints stay in SQLModel. The exception is documented as a layering rule rather than a free-for-all.
- **Transaction discipline.** Services own commits; repositories only `flush()` to surface generated IDs. No `async with session.begin()` (it conflicts with asyncpg's autobegin) and no commits in repositories.
- **Migration risk classification.** Every migration is classified before running — safe (add nullable column), check-data-first (add UNIQUE, add NOT NULL without default), or dangerous (drop/rename column). UNIQUE-constraint migrations always run a duplicate check on the existing data first.

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

Useful targets (see `make help`):

```bash
make be              # backend dev server only
make fe              # frontend dev server only
make be-migrate      # apply migrations
make be-migration MSG="describe change"   # create + apply new migration
make be-test         # run pytest
make db-reset        # truncate all tables (keep schema)
```

**Environment variables** (backend `.env`):

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/rental_db
AUTH_DEV_MODE=true                # skip JWT signature verification (local only)
CLERK_JWKS_URL=                   # set in production
CLERK_ISSUER=                     # optional; when set, iss claim is pinned
CLERK_AUDIENCE=                   # optional; when set, aud claim is pinned
CORS_ORIGINS=["http://localhost:3000"]
```

Frontend (`.env.local`) needs the standard Clerk publishable/secret keys plus `NEXT_PUBLIC_API_URL`.

**Tests** hit a real PostgreSQL database (no mocks); set up the test DB once:

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
| Database  | Managed Postgres | Migrations applied via Render shell or one-shot job            |
| Auth      | Clerk (test env) | Production keys swap with no code change                       |

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

**Tenant isolation belongs in the schema, not in the service layer.** When a room turned over, the new tenant's first invoice could pull `elec_prev` from the previous tenant's last reading — wrong reading, wrong bill, real money. I added a `contract_id` FK to every `utility_reading` and constrained the previous-month lookup (and the month-skip continuity guard) to readings from the same contract. The invariant is now enforced by the data shape, not by every service method remembering to filter — the kind of bug that only happens once if you fix it in the right layer.

---

## Author

Built by [baopd](https://github.com/baopd79). Open to feedback and questions — issues welcome.
