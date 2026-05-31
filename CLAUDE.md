# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Dev Commands

```bash
# Infrastructure
docker compose up -d          # Start PostgreSQL 16 on :5432

# Backend (run from /backend)
uv run uvicorn app.main:app --reload          # Start API on :8000
uv run alembic upgrade head                    # Apply migrations
uv run alembic revision --autogenerate -m "description" && uv run alembic upgrade head
uv run pytest -v                               # Run all tests
uv run pytest tests/unit/test_foo.py::test_bar # Run single test

# Frontend (run from /frontend)
pnpm dev        # Start Next.js on :3000
pnpm build      # Type-check + build

# DB reset (wipe all data, keep schema)
docker exec rental-system-postgres-1 psql -U postgres -d rental_db -c "
TRUNCATE TABLE contract_event, shared_meter_reading, shared_meter_room, shared_meter,
  invoice_item, invoice, surcharge_template, utility_reading, contract, tenant, room,
  property RESTART IDENTITY CASCADE;"
```

---

## Architecture

### Stack
- **Backend**: FastAPI + SQLModel (async) + PostgreSQL 16, Alembic migrations, Clerk JWT auth
- **Frontend**: Next.js 15 App Router, TypeScript, Tailwind v4, shadcn/ui, Clerk

### Backend layers — strict hierarchy

```
Router → Service → Repository → Model
```

- **Router** (`routers/`): parse request, call one service method, return schema. No business logic, no direct DB access.
- **Service** (`services/`): all business logic + transaction owner. Calls `await self.session.commit()` after writes. Never `async with session.begin()` — conflicts with asyncpg autobegin. Raises `AppException` subclasses from `core/exceptions.py` (never `HTTPException`).
- **Repository** (`repositories/`): DB ops only, no business rules. No commits — service controls transactions. Each method is a single DB operation; calls `await self.session.flush()` after writes to make IDs available.
- **Model** (`models/`): SQLModel `table=True` only, no logic.
- **Schema** (`schemas/`): Pydantic request/response types separate from models. Named `XxxCreate`, `XxxRead`, `XxxUpdate`.

**Dependency injection**: services are plain Python classes (no FastAPI `Depends` in constructors). DI wiring lives exclusively in `app/core/dependencies.py`:
```python
def _billing_service(session: SessionDep) -> BillingService:
    return BillingService(session)
BillingServiceDep = Annotated[BillingService, Depends(_billing_service)]
```

**Auth**: All endpoints require `CurrentUserDep`. `clerk_user_id` is passed explicitly to every service method for row-level isolation — never read from global state.

**Exception handling**: `app.exception_handler(AppException)` in `main.py` converts to JSON response. Use `NotFoundException`, `ForbiddenException`, `ConflictException`, `BadRequestException`.

**Raw SQL**: `billing_repo.py` and `dashboard_service.py` use `sqlalchemy.text()` with named params. Pass `datetime.date` objects directly for date comparisons — asyncpg won't auto-cast strings.

### Frontend patterns

**API calls**: use `apiJson<T>(path, getToken)` for JSON (throws on error) or `apiFetch(path, getToken, options)` for raw `Response`. Both in `lib/api.ts`, auto-attach Clerk JWT.

**Auth**: `"use client"` components use `useAuth()` for `getToken`. Route protection via `middleware.ts`.

**Styling**: all inline styles using CSS variables from `globals.css`. Key tokens: `--vn-bg`, `--vn-surface`, `--vn-border`, `--vn-text`, `--vn-text-2`, `--vn-text-3`, `--blue-600` (primary), shadow tokens `--sh-xs/sm/md/pop`.

**No routing on row-click** — drawers open from the right for detail/context views:
- `InvoiceDrawer` — invoice detail + status actions
- `InvoiceGenerateDrawer` — two-panel: form → invoice view (slide transition, `refreshSignal` prop to force re-fetch on back)
- `ContractDrawer` — contract detail + event timeline
- `TenantDrawer` — tenant info + contract history
- `PropertyDrawer`, `PropertyConfigDrawer` — property settings

### Key domain concepts

**Billing logic** (do not change):
- `UtilityReading.period = "YYYY-MM"` = the **invoice month** (not the reading-taken month).
- Frontend "Ghi chỉ số" UI uses display period = reading month; internally calls API with `nextPeriod(displayPeriod)`.
- Invoice for period M uses reading for period M: `electricity = elec_curr(M) - elec_prev(M)`, where `elec_prev(M)` is auto-filled from `elec_curr(M-1)`.
- **Move-in reading** (`ContractCreate.initial_elec_curr`): stored as `elec_prev = elec_curr = initial_value` for the move-in month. The landlord then enters the actual `elec_curr` via billing modal. `curr == prev` → 0 consumption (tenant didn't use); `curr > prev` → tenant used electricity before billing period ended. Both are valid.
- **Legacy data**: old readings where `elec_prev = NULL` still exist. Frontend detects these via `isInitialReading = reading_id !== null && elec_prev === null` and shows amber border. Backend shifts on update: `elec_prev ← old_curr, elec_curr ← new_value`. This is backward-compatible but won't appear for contracts created under the new logic.
- `Contract.end_date` is set to `date.today()` when ended (not the original contract end date).

**Tenant isolation in readings**: `utility_reading.contract_id` links each reading to the contract that created it. In `billing_service.batch_save_readings`, `elec_prev` is only auto-filled from a previous month's reading **if it belongs to the same contract**. The month-skip guard also only enforces continuity within the same contract — readings from a previous tenant never block or contaminate the new tenant's billing.

**Proration**: `_prorate_factor(start_date, end_date, period)` in `invoice_service.py` — applied to rent and fixed surcharges for first/last partial month. Meter-based utilities are never prorated.

**Room type** (frontend-derived, no DB field): room is "Vệ sinh chung" if its ID appears in any `SharedMeter.room_ids` for that property; otherwise "Khép kín".

**Water calc types** (`property.water_calc_type`): `per_meter` (measured, per m³), `per_person` (flat × num_people), `per_room` (flat per room).

**Invoice status flow**: `draft → sent → paid`. Only `draft` can be deleted or edited. Cannot end a contract with unpaid (`draft`/`sent`) invoices.

**Contract events**: `ContractService` logs to `contract_event` table on `created`, `rent_changed`, `people_changed`, `ended`. Surfaced via `GET /contracts/{id}/events`.

**Invoice detail** (`GET /invoices/{id}`): returns `InvoiceDetailRead` — extends `InvoiceListRead` with `tenant_phone`, `elec_prev`, `elec_curr`, `water_prev`, `water_curr` sourced from the corresponding `utility_reading`.

### DB schema summary

Tables: `property`, `room`, `tenant`, `contract`, `contract_event`, `utility_reading`, `surcharge_template`, `shared_meter`, `shared_meter_room`, `shared_meter_reading`, `invoice`, `invoice_item`.

Key constraints:
- `room`: unique `(property_id, room_number)`
- `utility_reading`: unique `(room_id, period)`, FK `contract_id → contract.id`
- `shared_meter_room`: composite PK `(shared_meter_id, room_id)`

All data is isolated by `clerk_user_id` on `property` — downstream joins reach user data via property FK chain.

Enums in PostgreSQL: `invoicestatus` (`draft/sent/paid`), `invoiceitemtype` (`rent/electricity/water/surcharge/shared_elec`), `contractstatus` (`active/ended`), `roomstatus` (`vacant/occupied/maintenance`).

### Migrations

Always use manual migration files. After adding/changing a model, register new models in `app/models/__init__.py` so Alembic detects them. The `include_object` guard in `alembic/env.py` prevents autogenerate from dropping tables not in `SQLModel.metadata` (protects against `alembic stamp` edge cases).

```bash
uv run alembic revision --autogenerate -m "describe change"
# Review the generated file, then:
uv run alembic upgrade head
```

For adding PostgreSQL enum values use `op.execute("ALTER TYPE enumname ADD VALUE IF NOT EXISTS 'value'")` — not supported by `downgrade`.

**Before running any migration (local or production), classify the risk:**
- Safe: add nullable column, add column with default, add index, Pydantic-only validators
- Check data first: add UNIQUE constraint, add NOT NULL without default, add CHECK constraint
- Dangerous: drop/rename column (old code still references it)

For UNIQUE constraints, always verify no duplicates exist before upgrading:
```sql
SELECT <col1>, <col2>, COUNT(*) FROM <table>
GROUP BY <col1>, <col2> HAVING COUNT(*) > 1;
```

### Never do
- Import `HTTPException` in services — use `AppException` subclasses.
- Use `async with session.begin()` in services — conflicts with asyncpg.
- Commit in repositories — transaction boundary belongs to services.
- Add `Depends()` inside service constructors — DI belongs in `core/dependencies.py` only.
- Expose CCCD/SĐT on public invoice endpoint (`/invoices/public/*`).
- Allow unauthenticated access outside `/invoices/public/*`.
- Use previous tenant's `utility_reading` as `elec_prev` for a new tenant — always check `contract_id` matches.

---

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`github.com/baopd79/rental-system`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
