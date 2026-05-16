# TODO — Rental System

> Cập nhật lần cuối: Phase 1 hoàn tất.
> Chi tiết từng task xem ở [PLAN.md](./PLAN.md).

---

## Trạng thái tổng quan

| Phase | Mô tả | Status |
|-------|-------|--------|
| 0 | Project scaffold | ✅ Done |
| 1 | Properties CRUD | ✅ Done |
| 2 | Rooms CRUD | 🔲 Next |
| 3 | Tenants & Contracts | 🔲 Todo |
| 4 | Utility Readings | 🔲 Todo |
| 5 | Surcharge Templates | 🔲 Todo |
| 6 | Invoice Generation | 🔲 Todo |
| 7 | Public Invoice Page | 🔲 Todo |
| 8 | Dashboard | 🔲 Todo |
| 9 | Tests & Hardening | 🔲 Todo |

---

## ✅ Phase 0 — Project Scaffold

- [x] **T0.1** Backend scaffold: uv, FastAPI, SQLModel async, Alembic, pydantic-settings
- [x] **T0.2** Frontend scaffold: Next.js 15, Tailwind v4, shadcn/ui, Clerk provider + middleware
- [x] **T0.3** Docker Compose PostgreSQL 16 + `.env.example`
- [x] **T0.4** Clerk JWT verification backend (`core/clerk.py`, `dependencies.py`, `GET /auth/me`)

**Ghi chú:**
- Dev mode: `CLERK_JWKS_URL=` (trống) → skip signature verify, chỉ decode `sub`
- pytest config: `asyncio_default_test_loop_scope = "session"` (tránh asyncpg cross-loop lỗi)
- datetime: dùng `datetime.now(timezone.utc).replace(tzinfo=None)` cho `TIMESTAMP WITHOUT TIME ZONE`

---

## ✅ Phase 1 — Properties

- [x] **T1.1** `Property` model + `PropertyCreate/Read/Update` schemas + Alembic migration `001`
- [x] **T1.2** `property_repo` + `PropertyService` + router `/api/v1/properties` (CRUD + owner isolation)
- [x] **T1.3** Frontend `/properties` page: list cards, dialog tạo/sửa, confirm xóa

**Ghi chú:**
- Service dùng `await self.session.commit()` (không dùng `session.begin()` — conflict asyncpg)
- `conftest.py`: `clean_db` fixture autouse truncate sau mỗi test
- `script.py.mako`: thêm `import sqlmodel` để migration autogenerate không lỗi

---

## 🔲 Phase 2 — Rooms ← NEXT

- [ ] **T2.1** `Room` model + schemas + migration `002` (FK → Property, `elec_rate`/`water_rate` nullable)
- [ ] **T2.2** `room_repo` + `RoomService` (rate inheritance từ Property) + router `/api/v1/rooms`
- [ ] **T2.3** Frontend: rooms list trong property detail, form tạo/sửa, status badge

**Acceptance criteria chính:**
- [ ] `POST /rooms` chỉ được nếu user sở hữu property
- [ ] Room `elec_rate=null` → API trả `effective_elec_rate` lấy từ property
- [ ] Status badge: `vacant` / `occupied` / `maintenance`

---

## 🔲 Phase 3 — Tenants & Contracts

- [ ] **T3.1** `Tenant` + `Contract` models + schemas + migration `003`
- [ ] **T3.2** `tenant_repo` + `contract_repo` + services (1 active contract per room) + routers
- [ ] **T3.3** Frontend: tenant list, contract create/end, room status tự cập nhật

**Acceptance criteria chính:**
- [ ] Tạo contract khi phòng đang có active contract → 400
- [ ] Kết thúc contract → room status = `vacant`
- [ ] Tạo contract → room status = `occupied`

---

## 🔲 Phase 4 — Utility Readings

- [ ] **T4.1** `UtilityReading` model + schemas + migration `004` (unique: `room_id + period`)
- [ ] **T4.2** `UtilityService` auto-fill `elec_prev` ← `elec_curr` kỳ trước + router
- [ ] **T4.3** Frontend: form nhập chỉ số, số đầu kỳ pre-fill readonly nếu auto

**Acceptance criteria chính:**
- [ ] Reading tháng N → `elec_prev` tự điền từ `elec_curr` tháng N-1
- [ ] Phòng mới (chưa có reading) → cho nhập thủ công, `is_prev_auto=false`
- [ ] Duplicate period cho cùng phòng → 409

---

## 🔲 Phase 5 — Surcharge Templates

- [ ] **T5.1** `SurchargeTemplate` model + schemas + migration `005` + CRUD backend + frontend settings page

**Acceptance criteria chính:**
- [ ] `calc_type`: `per_room` | `per_person`
- [ ] User chỉ thấy surcharges của mình

---

## 🔲 Phase 6 — Invoice Generation

- [ ] **T6.1** `Invoice` + `InvoiceItem` models + schemas + migration `006` (`public_token` uuid)
- [ ] **T6.2** `InvoiceService._calculate()` pure function: rent + elec + water + surcharges
- [ ] **T6.3** `InvoiceService.generate()` orchestration + CRUD endpoints
- [ ] **T6.4** PDF generation: Jinja2 template + WeasyPrint → `GET /invoices/{id}/pdf`
- [ ] **T6.5** Frontend: invoice list, generate modal, detail view, copy link, download PDF

**Acceptance criteria chính:**
- [ ] Surcharge `per_person`: `amount × contract.num_people`
- [ ] Duplicate period cho cùng contract → 409
- [ ] `PUT /invoices/{id}` chỉ cho phép khi `status=draft`

---

## 🔲 Phase 7 — Public Invoice

- [ ] **T7.1** `GET /invoices/public/{token}` (no auth, che CCCD/SĐT) + frontend `/invoice/public/[token]`

**Acceptance criteria chính:**
- [ ] Token không tồn tại → 404
- [ ] CCCD và SĐT bị mask trên public response

---

## 🔲 Phase 8 — Dashboard

- [ ] **T8.1** `DashboardService` (summary stats + revenue by month) + router
- [ ] **T8.2** Frontend: stat cards + bar chart doanh thu (Recharts)

---

## 🔲 Phase 9 — Tests & Hardening

- [ ] **T9.1** Unit tests `InvoiceService._calculate()` ≥ 8 cases
- [ ] **T9.2** Unit tests `UtilityService` auto-fill ≥ 5 cases
- [ ] **T9.3** Integration tests owner isolation (cross-user 403/404 cho tất cả resources)

---

## Patterns đã xác lập

```
Backend:
  Router  → gọi service, trả schema
  Service → business logic + await session.commit()
  Repo    → chỉ DB ops (add/get/delete), không commit
  Model   → SQLModel table=True
  Schema  → Pydantic tách riêng (XxxCreate / XxxRead / XxxUpdate)

  Dep aliases: SessionDep, CurrentUserDep, XxxServiceDep (trong dependencies.py)
  datetime: datetime.now(timezone.utc).replace(tzinfo=None)
  Migration: alembic revision --autogenerate → upgrade head

Frontend:
  apiJson<T>() trong lib/api.ts — tự attach Clerk token
  "use client" chỉ khi cần useState/useEffect
  shadcn/ui Dialog cho forms, AlertDialog cho confirm xóa
```

## Lệnh hay dùng

```bash
# Backend
cd backend
uv run uvicorn app.main:app --reload          # start server
uv run alembic revision --autogenerate -m "xxx" && uv run alembic upgrade head
uv run pytest -v                              # chạy tất cả tests

# Frontend
cd frontend
pnpm dev                                      # start dev server
pnpm build                                    # verify TypeScript + build

# DB
docker compose up -d                          # start PostgreSQL
docker compose ps                             # check status
```
