# Implementation Plan: Rental System

## Overview

Full-stack SaaS quản lý nhà trọ. Backend FastAPI + SQLModel (layered: Router→Service→Repository→Model), frontend Next.js 15 + Clerk auth. Chia thành 10 phase theo vertical slices — mỗi phase cho ra một tính năng hoàn chỉnh có thể test ngay.

## Architecture Decisions

- **Vertical slices**: mỗi phase giao được tính năng từ DB đến UI, không build tất cả backend trước
- **Backend-first trong mỗi slice**: model → schema → repo → service → router → frontend
- **Alembic migration** sau mỗi model mới — không dồn migration
- **Clerk JWT** verify ở backend qua JWKS, không lưu user trong DB riêng
- **Async everywhere**: `AsyncSession`, `async def` cho toàn bộ backend

---

## Dependency Graph

```
PostgreSQL
    └── SQLModel models + Alembic migrations
            └── Repositories (raw DB ops)
                    └── Services (business logic + transactions)
                            └── Routers (HTTP parse + response)
                                    └── Frontend types/ (từ OpenAPI)
                                            └── lib/api.ts
                                                    └── UI pages + components
```

---

## Phase 0: Project Scaffold

### Task 0.1: Backend scaffold

**Description:** Khởi tạo backend project với uv, cấu hình FastAPI, SQLModel async engine, Alembic, pydantic-settings.

**Acceptance criteria:**
- [ ] `uv run uvicorn app.main:app` chạy được, trả 200 tại `GET /health`
- [ ] `alembic init` hoàn tất, `alembic.ini` trỏ đúng DB URL từ `.env`
- [ ] `database.py` export `get_session` async generator

**Verification:**
- [ ] `uv run uvicorn app.main:app --reload` không lỗi
- [ ] `uv run alembic current` chạy được

**Dependencies:** None

**Files:**
- `backend/pyproject.toml`
- `backend/app/main.py`
- `backend/app/database.py`
- `backend/app/core/config.py`
- `backend/alembic/env.py`
- `backend/.env.example`

**Scope:** M

---

### Task 0.2: Frontend scaffold

**Description:** Khởi tạo Next.js 15 với TypeScript, Tailwind CSS v4, shadcn/ui, cấu hình Clerk provider và middleware bảo vệ routes.

**Acceptance criteria:**
- [ ] `pnpm dev` chạy được tại `localhost:3000`
- [ ] Route `/dashboard` redirect về sign-in nếu chưa đăng nhập (Clerk middleware)
- [ ] shadcn/ui component `Button` render được

**Verification:**
- [ ] `pnpm build` pass không lỗi TypeScript
- [ ] Truy cập `/dashboard` khi chưa login → redirect `/sign-in`

**Dependencies:** None

**Files:**
- `frontend/package.json`
- `frontend/app/layout.tsx`
- `frontend/middleware.ts`
- `frontend/app/(auth)/sign-in/[[...sign-in]]/page.tsx`
- `frontend/lib/api.ts`

**Scope:** M

---

### Task 0.3: Docker Compose + dev environment

**Description:** Docker Compose chạy PostgreSQL local, `.env.example` đầy đủ cho cả frontend và backend.

**Acceptance criteria:**
- [ ] `docker compose up -d` khởi chạy PostgreSQL 16
- [ ] Backend connect được DB (`alembic current` không lỗi connection)

**Verification:**
- [ ] `docker compose ps` hiện postgres healthy

**Dependencies:** T0.1

**Files:**
- `docker-compose.yml`
- `backend/.env.example`
- `frontend/.env.example`

**Scope:** S

---

### Task 0.4: Backend auth infrastructure (Clerk)

**Description:** Implement Clerk JWT verification, `dependencies.py` với base aliases `SessionDep` và `CurrentUserDep`. Router `GET /api/v1/auth/me` verify token và trả `clerk_user_id`.

**Acceptance criteria:**
- [ ] Request với Clerk JWT hợp lệ → trả `{ clerk_user_id }`
- [ ] Request không có token → 401
- [ ] Request token giả mạo → 401
- [ ] `CurrentUserDep` dùng được trong bất kỳ router nào

**Verification:**
- [ ] `pytest tests/integration/test_auth.py` pass

**Dependencies:** T0.1, T0.3

**Files:**
- `backend/app/core/clerk.py`
- `backend/app/dependencies.py`
- `backend/app/routers/auth.py`
- `backend/tests/integration/test_auth.py`

**Scope:** M

---

### Checkpoint: Phase 0

- [ ] Backend chạy, health check OK
- [ ] Frontend chạy, Clerk auth hoạt động
- [ ] DB connect được từ backend
- [ ] `GET /api/v1/auth/me` với Clerk token trả đúng

---

## Phase 1: Properties

### Task 1.1: Property model + schema + migration

**Description:** SQLModel `Property` table, Pydantic schemas `PropertyCreate/Read/Update`, Alembic migration.

**Acceptance criteria:**
- [ ] `alembic upgrade head` tạo table `property` với đúng columns
- [ ] `PropertyRead` có tất cả fields cần thiết để hiển thị trên UI

**Verification:**
- [ ] `alembic upgrade head && alembic downgrade -1 && alembic upgrade head` không lỗi

**Dependencies:** T0.1, T0.3

**Files:**
- `backend/app/models/property.py`
- `backend/app/schemas/property.py`
- `backend/alembic/versions/001_create_property.py`

**Scope:** S

---

### Task 1.2: Property repository + service + router

**Description:** `PropertyRepo` (CRUD queries), `PropertyService` (owner isolation, business rules), router với full CRUD endpoints. Thêm `PropertyServiceDep` vào `dependencies.py`.

**Acceptance criteria:**
- [ ] `POST /api/v1/properties` tạo property gắn với `clerk_user_id`
- [ ] `GET /api/v1/properties` chỉ trả properties của user đang đăng nhập
- [ ] `PUT /api/v1/properties/{id}` trả 403 nếu không phải owner
- [ ] `DELETE /api/v1/properties/{id}` trả 403 nếu không phải owner

**Verification:**
- [ ] `pytest tests/integration/test_properties.py` pass (bao gồm isolation test)

**Dependencies:** T1.1, T0.4

**Files:**
- `backend/app/repositories/property_repo.py`
- `backend/app/services/property_service.py`
- `backend/app/routers/properties.py`
- `backend/app/dependencies.py` (thêm `PropertyServiceDep`)
- `backend/tests/integration/test_properties.py`

**Scope:** M

---

### Task 1.3: Frontend — Properties pages

**Description:** Trang list properties (server component), form tạo/sửa property (client component), xóa property.

**Acceptance criteria:**
- [ ] `/dashboard/properties` hiển thị danh sách, có nút tạo mới
- [ ] Form tạo/sửa có validation (zod), submit gọi API
- [ ] Xóa property có confirmation dialog
- [ ] Loading + error states được xử lý

**Verification:**
- [ ] Tạo property mới → xuất hiện trong list ngay
- [ ] User khác không thấy property (cần 2 tài khoản test)

**Dependencies:** T1.2, T0.2

**Files:**
- `frontend/app/(dashboard)/properties/page.tsx`
- `frontend/app/(dashboard)/properties/[id]/page.tsx`
- `frontend/components/app/property-form.tsx`
- `frontend/types/property.ts`

**Scope:** M

---

### Checkpoint: Phase 1

- [ ] CRUD Properties hoạt động E2E
- [ ] Owner isolation verified

---

## Phase 2: Rooms

### Task 2.1: Room model + schema + migration

**Description:** SQLModel `Room` table với `property_id` FK, fields `elec_rate/water_rate` nullable (kế thừa từ Property), Alembic migration.

**Acceptance criteria:**
- [ ] Table `room` có FK constraint đến `property`
- [ ] `RoomRead` bao gồm `effective_elec_rate` (resolved từ property nếu null)

**Verification:**
- [ ] `alembic upgrade head` không lỗi

**Dependencies:** T1.1

**Files:**
- `backend/app/models/room.py`
- `backend/app/schemas/room.py`
- `backend/alembic/versions/002_create_room.py`

**Scope:** S

---

### Task 2.2: Room repository + service + router

**Description:** `RoomRepo`, `RoomService` (rate inheritance: nếu `room.elec_rate` null thì lấy `property.elec_rate`), router. Validate chủ nhà sở hữu property trước khi tạo room.

**Acceptance criteria:**
- [ ] `POST /api/v1/rooms` chỉ được nếu user sở hữu property
- [ ] `GET /api/v1/properties/{id}/rooms` trả rooms của property đó
- [ ] Room với `elec_rate=null` → `effective_elec_rate` lấy từ property
- [ ] Xóa room có active contract → 400

**Verification:**
- [ ] `pytest tests/integration/test_rooms.py` pass

**Dependencies:** T2.1, T1.2

**Files:**
- `backend/app/repositories/room_repo.py`
- `backend/app/services/room_service.py`
- `backend/app/routers/rooms.py`
- `backend/tests/integration/test_rooms.py`

**Scope:** M

---

### Task 2.3: Frontend — Rooms pages

**Description:** Danh sách phòng trong property detail, form tạo/sửa phòng, hiển thị trạng thái (badge vacant/occupied/maintenance).

**Acceptance criteria:**
- [ ] `/dashboard/properties/[id]` hiển thị rooms với status badge
- [ ] Form phòng có field giá điện/nước (optional, placeholder "kế thừa từ nhà")
- [ ] Thay đổi status phòng hoạt động

**Verification:**
- [ ] Tạo phòng mới → xuất hiện trong list với status `vacant`

**Dependencies:** T2.2, T1.3

**Files:**
- `frontend/app/(dashboard)/properties/[id]/page.tsx` (cập nhật)
- `frontend/components/app/room-form.tsx`
- `frontend/components/app/room-status-badge.tsx`
- `frontend/types/room.ts`

**Scope:** M

---

### Checkpoint: Phase 2

- [ ] Tạo nhà → thêm phòng → thấy trên UI
- [ ] Rate inheritance hoạt động đúng

---

## Phase 3: Tenants & Contracts

### Task 3.1: Tenant + Contract models + schemas + migration

**Description:** `Tenant` (gắn với `clerk_user_id`), `Contract` (FK room + tenant, `num_people`, `status`), Alembic migration.

**Acceptance criteria:**
- [ ] Table `tenant` và `contract` được tạo với đúng constraints
- [ ] `ContractRead` include thông tin tenant (joined)

**Verification:**
- [ ] `alembic upgrade head` không lỗi

**Dependencies:** T2.1

**Files:**
- `backend/app/models/tenant.py`
- `backend/app/models/contract.py`
- `backend/app/schemas/tenant.py`
- `backend/app/schemas/contract.py`
- `backend/alembic/versions/003_create_tenant_contract.py`

**Scope:** S

---

### Task 3.2: Tenant + Contract repositories + services + routers

**Description:** `TenantService` (CRUD), `ContractService` (tạo contract: validate chỉ 1 active per room, kết thúc contract: set status=ended + room status=vacant).

**Acceptance criteria:**
- [ ] Tạo contract cho phòng đang có active contract → 400
- [ ] Kết thúc contract (`PUT /contracts/{id}/end`) → room status = `vacant`
- [ ] Tạo contract → room status = `occupied`
- [ ] User không sở hữu room → 403

**Verification:**
- [ ] `pytest tests/integration/test_contracts.py` pass

**Dependencies:** T3.1, T2.2

**Files:**
- `backend/app/repositories/tenant_repo.py`
- `backend/app/repositories/contract_repo.py`
- `backend/app/services/tenant_service.py`
- `backend/app/services/contract_service.py`
- `backend/app/routers/tenants.py`
- `backend/app/routers/contracts.py`
- `backend/tests/integration/test_contracts.py`

**Scope:** L → chia thành 2 nếu cần, nhưng Tenant + Contract liên quan chặt nên giữ chung

---

### Task 3.3: Frontend — Tenants + Contracts pages

**Description:** Danh sách khách thuê, form tạo khách, form tạo hợp đồng (gắn khách vào phòng), action kết thúc hợp đồng.

**Acceptance criteria:**
- [ ] `/dashboard/tenants` list khách thuê, filter theo trạng thái
- [ ] Tạo contract từ room detail (chọn khách hoặc tạo mới)
- [ ] Kết thúc contract có confirmation
- [ ] Room status cập nhật ngay sau khi tạo/kết thúc contract

**Verification:**
- [ ] Tạo contract → room badge chuyển sang `occupied`
- [ ] Kết thúc contract → room badge chuyển sang `vacant`

**Dependencies:** T3.2, T2.3

**Files:**
- `frontend/app/(dashboard)/tenants/page.tsx`
- `frontend/components/app/tenant-form.tsx`
- `frontend/components/app/contract-form.tsx`
- `frontend/types/tenant.ts`
- `frontend/types/contract.ts`

**Scope:** L

---

### Checkpoint: Phase 3

- [ ] Toàn bộ flow: tạo nhà → phòng → khách → hợp đồng hoạt động
- [ ] Room status tự động cập nhật
- [ ] Một phòng không thể có 2 active contracts

---

## Phase 4: Utility Readings

### Task 4.1: UtilityReading model + schema + migration

**Description:** Model `UtilityReading` với `period` (YYYY-MM), `elec_prev/curr`, `water_prev/curr`, `is_prev_auto`.

**Acceptance criteria:**
- [ ] Unique constraint `(room_id, period)` — mỗi phòng chỉ có 1 reading per kỳ
- [ ] `is_prev_auto` default `true`

**Verification:**
- [ ] `alembic upgrade head` không lỗi

**Dependencies:** T2.1

**Files:**
- `backend/app/models/utility.py`
- `backend/app/schemas/utility.py`
- `backend/alembic/versions/004_create_utility_reading.py`

**Scope:** S

---

### Task 4.2: UtilityService — auto-fill logic + router

**Description:** `UtilityService.create_reading()`: trước khi insert, query reading của kỳ trước (`period - 1 month`), lấy `elec_curr/water_curr` làm `elec_prev/water_prev` của kỳ mới. Nếu không có kỳ trước → dùng giá trị từ request (nhập tay), set `is_prev_auto=false`.

**Acceptance criteria:**
- [ ] Tạo reading tháng 2026-06 → `elec_prev` tự điền từ `elec_curr` của 2026-05
- [ ] Phòng mới (chưa có reading) → nhận `elec_prev` từ request, `is_prev_auto=false`
- [ ] Duplicate period cho cùng phòng → 409

**Verification:**
- [ ] `pytest tests/unit/test_utility_service.py` pass (test auto-fill logic)
- [ ] `pytest tests/integration/test_utilities.py` pass

**Dependencies:** T4.1, T0.4

**Files:**
- `backend/app/repositories/utility_repo.py`
- `backend/app/services/utility_service.py`
- `backend/app/routers/utilities.py`
- `backend/tests/unit/test_utility_service.py`
- `backend/tests/integration/test_utilities.py`

**Scope:** M

---

### Task 4.3: Frontend — Utility Reading input

**Description:** Form nhập chỉ số điện/nước theo phòng + tháng. Số đầu kỳ được pre-fill từ API (hiển thị readonly nếu `is_prev_auto=true`). Chỉ cần nhập số cuối kỳ.

**Acceptance criteria:**
- [ ] Chọn phòng + tháng → `elec_prev` và `water_prev` được fetch và hiển thị
- [ ] Nếu phòng mới: field `prev` enabled để nhập thủ công
- [ ] Submit → gọi `POST /utility-readings`

**Verification:**
- [ ] Nhập reading tháng 2 → reading tháng 3 tự fill số đầu kỳ

**Dependencies:** T4.2, T2.3

**Files:**
- `frontend/app/(dashboard)/rooms/[id]/utility/page.tsx`
- `frontend/components/app/utility-reading-form.tsx`
- `frontend/types/utility.ts`

**Scope:** M

---

### Checkpoint: Phase 4

- [ ] Auto-fill `elec_prev` ← `elec_curr` kỳ trước hoạt động đúng
- [ ] Unit test `test_utility_service.py` pass

---

## Phase 5: Surcharge Templates

### Task 5.1: SurchargeTemplate model + schema + migration + CRUD

**Description:** `SurchargeTemplate` (per_room | per_person), full CRUD backend + frontend settings page.

**Acceptance criteria:**
- [ ] CRUD `GET/POST/PUT/DELETE /api/v1/surcharges` hoạt động
- [ ] User chỉ thấy surcharges của mình
- [ ] Frontend `/dashboard/settings/surcharges` quản lý danh sách phụ phí

**Verification:**
- [ ] Tạo surcharge `per_person` 50k → xác nhận `calc_type=per_person` trong DB

**Dependencies:** T0.4

**Files:**
- `backend/app/models/surcharge.py`
- `backend/app/schemas/surcharge.py`
- `backend/app/repositories/surcharge_repo.py`
- `backend/app/services/surcharge_service.py`
- `backend/app/routers/surcharges.py`
- `backend/alembic/versions/005_create_surcharge.py`
- `frontend/app/(dashboard)/settings/surcharges/page.tsx`
- `frontend/types/surcharge.ts`

**Scope:** M

---

### Checkpoint: Phase 5

- [ ] Surcharge templates quản lý được từ UI

---

## Phase 6: Invoice Generation

### Task 6.1: Invoice + InvoiceItem models + schemas + migration

**Description:** `Invoice` (FK contract, period, totals, status, `public_token` uuid), `InvoiceItem` (với `item_type`), Alembic migration.

**Acceptance criteria:**
- [ ] `public_token` tự sinh UUID khi tạo invoice
- [ ] Unique constraint `(contract_id, period)`

**Verification:**
- [ ] `alembic upgrade head` không lỗi

**Dependencies:** T3.1

**Files:**
- `backend/app/models/invoice.py`
- `backend/app/schemas/invoice.py`
- `backend/alembic/versions/006_create_invoice.py`

**Scope:** S

---

### Task 6.2: InvoiceService — calculation logic

**Description:** Pure function `_calculate(contract, reading, surcharges) -> InvoiceData` tính: tiền thuê + tiền điện `(curr-prev)*rate` + tiền nước + phụ phí (per_room × 1, per_person × `num_people`). Tạo đầy đủ `InvoiceItem` cho từng dòng.

**Acceptance criteria:**
- [ ] Tiền điện = `(elec_curr - elec_prev) × elec_rate` (dùng effective rate)
- [ ] Surcharge `per_room`: amount cố định
- [ ] Surcharge `per_person`: `amount × contract.num_people`
- [ ] `total` = sum tất cả items
- [ ] Reading `null` (chưa nhập điện/nước) → elec/water amount = 0, không lỗi

**Verification:**
- [ ] `pytest tests/unit/test_invoice_calculation.py` pass với nhiều case edge

**Dependencies:** T6.1, T5.1, T4.1

**Files:**
- `backend/app/services/invoice_service.py` (calculation logic)
- `backend/tests/unit/test_invoice_calculation.py`

**Scope:** M

---

### Task 6.3: InvoiceService — generate + CRUD + router

**Description:** `InvoiceService.generate()` orchestrate: validate ownership → lấy contract/reading/surcharges → tính → persist trong transaction. Endpoints: generate, list, get, update draft items, update status.

**Acceptance criteria:**
- [ ] `POST /invoices/generate` tạo invoice `draft` với đúng amounts
- [ ] Duplicate period cho cùng contract → 409
- [ ] `PUT /invoices/{id}` chỉ cho phép khi status = `draft`
- [ ] `PUT /invoices/{id}/status` chuyển `draft→sent`, `sent→paid`, `sent→overdue`

**Verification:**
- [ ] `pytest tests/integration/test_invoices.py` pass

**Dependencies:** T6.2, T3.2

**Files:**
- `backend/app/repositories/invoice_repo.py`
- `backend/app/services/invoice_service.py` (generate + orchestration)
- `backend/app/routers/invoices.py`
- `backend/tests/integration/test_invoices.py`

**Scope:** M

---

### Task 6.4: PDF generation

**Description:** Jinja2 HTML template cho invoice, WeasyPrint render thành PDF. Endpoint `GET /invoices/{id}/pdf` trả file PDF.

**Acceptance criteria:**
- [ ] PDF có đầy đủ: thông tin nhà/phòng/khách, bảng chi tiết các khoản, tổng tiền, kỳ thanh toán
- [ ] PDF download được từ browser

**Verification:**
- [ ] Download PDF từ Postman/browser, mở file xem đúng nội dung

**Dependencies:** T6.3

**Files:**
- `backend/app/templates/invoice.html`
- `backend/app/services/pdf_service.py`
- `backend/app/routers/invoices.py` (thêm `/pdf` endpoint)

**Scope:** M

---

### Task 6.5: Frontend — Invoice list + generate flow

**Description:** Trang danh sách hóa đơn, modal/wizard generate hóa đơn (chọn contract + tháng), hiển thị chi tiết invoice với từng dòng item, action đổi status.

**Acceptance criteria:**
- [ ] `/dashboard/invoices` list với filter theo status, tháng
- [ ] Generate flow: chọn phòng có active contract → chọn tháng → preview amounts → confirm
- [ ] Invoice detail hiển thị đủ items (rent, elec, water, surcharges)
- [ ] Nút "Copy link" copy public URL vào clipboard
- [ ] Nút "Download PDF" gọi `/invoices/{id}/pdf`

**Verification:**
- [ ] Generate invoice → thấy đúng số tiền
- [ ] Copy link → paste vào browser incognito → thấy invoice

**Dependencies:** T6.3, T6.4, T0.2

**Files:**
- `frontend/app/(dashboard)/invoices/page.tsx`
- `frontend/app/(dashboard)/invoices/[id]/page.tsx`
- `frontend/components/app/invoice-generate-modal.tsx`
- `frontend/components/app/invoice-detail.tsx`
- `frontend/types/invoice.ts`

**Scope:** L

---

### Checkpoint: Phase 6

- [ ] Generate invoice E2E: từ contract → PDF
- [ ] Calculation unit tests pass
- [ ] Copy link hoạt động

---

## Phase 7: Public Invoice Page

### Task 7.1: Public invoice endpoint + frontend page

**Description:** Backend `GET /invoices/public/{token}` trả invoice data (không có thông tin nhạy cảm: che CCCD, SĐT). Frontend `/invoice/public/[token]` là trang static không cần auth, hiển thị hóa đơn đẹp + nút download PDF.

**Acceptance criteria:**
- [ ] Token hợp lệ → trả invoice data (CCCD và SĐT bị che bớt)
- [ ] Token không tồn tại → 404
- [ ] Trang public không có Clerk middleware
- [ ] Có nút "Tải PDF" gọi endpoint PDF

**Verification:**
- [ ] Mở link trong browser incognito → xem được invoice, không cần đăng nhập
- [ ] Link giả → trang 404

**Dependencies:** T6.3, T6.4

**Files:**
- `backend/app/routers/invoices.py` (thêm public endpoint)
- `backend/app/schemas/invoice.py` (thêm `InvoicePublicRead` che field nhạy cảm)
- `frontend/app/invoice/public/[token]/page.tsx`
- `frontend/components/app/public-invoice-view.tsx`

**Scope:** M

---

### Checkpoint: Phase 7

- [ ] Public invoice flow hoàn chỉnh
- [ ] Sensitive data được che trên public endpoint

---

## Phase 8: Dashboard

### Task 8.1: Dashboard service + router

**Description:** `DashboardService.get_summary()`: đếm properties, rooms by status, active contracts, unpaid invoices, contracts expiring soon (trong 30 ngày). `DashboardService.get_revenue()`: group invoices paid by month.

**Acceptance criteria:**
- [ ] `GET /dashboard/summary` trả đúng counts
- [ ] `GET /dashboard/revenue?year=2026` trả array 12 tháng với total
- [ ] Chỉ tính dữ liệu của user đang đăng nhập

**Verification:**
- [ ] `pytest tests/integration/test_dashboard.py` pass với seed data

**Dependencies:** T6.3, T3.2

**Files:**
- `backend/app/services/dashboard_service.py`
- `backend/app/routers/dashboard.py`
- `backend/app/schemas/dashboard.py`
- `backend/tests/integration/test_dashboard.py`

**Scope:** M

---

### Task 8.2: Frontend — Dashboard page

**Description:** Dashboard overview với stat cards (phòng trống, doanh thu tháng này, hóa đơn chưa thanh toán, hợp đồng sắp hết hạn) + biểu đồ doanh thu theo tháng (Recharts).

**Acceptance criteria:**
- [ ] Stat cards load đúng số liệu từ API
- [ ] Biểu đồ bar chart doanh thu 12 tháng
- [ ] Danh sách hóa đơn chưa thanh toán (top 5)
- [ ] Danh sách hợp đồng sắp hết hạn (top 5)

**Verification:**
- [ ] Tạo vài invoice paid → dashboard revenue chart cập nhật

**Dependencies:** T8.1, T0.2

**Files:**
- `frontend/app/(dashboard)/page.tsx`
- `frontend/components/app/stat-card.tsx`
- `frontend/components/app/revenue-chart.tsx`
- `frontend/components/app/expiring-contracts-list.tsx`

**Scope:** M

---

### Checkpoint: Phase 8

- [ ] Dashboard hiển thị đúng số liệu real-time

---

## Phase 9: Tests & Hardening

### Task 9.1: Unit tests — Invoice calculation

**Description:** Test đầy đủ các cases: surcharge per_room, per_person với num_people khác nhau, reading null, effective rate inheritance.

**Acceptance criteria:**
- [ ] ≥ 8 test cases bao gồm edge cases
- [ ] 100% branch coverage cho `_calculate()`

**Verification:**
- [ ] `pytest tests/unit/test_invoice_calculation.py -v` tất cả pass

**Dependencies:** T6.2

**Files:**
- `backend/tests/unit/test_invoice_calculation.py`

**Scope:** S

---

### Task 9.2: Unit tests — Utility auto-fill

**Description:** Test auto-fill: có kỳ trước, không có kỳ trước, nhiều phòng độc lập nhau.

**Acceptance criteria:**
- [ ] ≥ 5 test cases
- [ ] `is_prev_auto` flag đúng trong mọi case

**Verification:**
- [ ] `pytest tests/unit/test_utility_service.py -v` tất cả pass

**Dependencies:** T4.2

**Files:**
- `backend/tests/unit/test_utility_service.py`

**Scope:** S

---

### Task 9.3: Integration tests — Owner isolation

**Description:** Test cross-user access: user A thử GET/PUT/DELETE resource của user B → 403/404.

**Acceptance criteria:**
- [ ] Properties, Rooms, Tenants, Contracts, Invoices đều reject cross-user access
- [ ] Public invoice endpoint không bị ảnh hưởng (no auth)

**Verification:**
- [ ] `pytest tests/integration/test_isolation.py -v` tất cả pass

**Dependencies:** T6.3

**Files:**
- `backend/tests/integration/test_isolation.py`

**Scope:** M

---

### Checkpoint: Final

- [ ] `pytest` toàn bộ backend pass
- [ ] `pnpm build` frontend pass không TypeScript error
- [ ] Happy path E2E: đăng nhập → tạo nhà → phòng → khách → hợp đồng → utility → hóa đơn → link public → dashboard

---

## Task Summary

| Phase | Tasks | Scope |
|-------|-------|-------|
| 0. Scaffold | T0.1–T0.4 | Setup |
| 1. Properties | T1.1–T1.3 | M×3 |
| 2. Rooms | T2.1–T2.3 | S+M+M |
| 3. Tenants & Contracts | T3.1–T3.3 | S+L+L |
| 4. Utility Readings | T4.1–T4.3 | S+M+M |
| 5. Surcharges | T5.1 | M |
| 6. Invoices | T6.1–T6.5 | S+M+M+M+L |
| 7. Public Invoice | T7.1 | M |
| 8. Dashboard | T8.1–T8.2 | M+M |
| 9. Tests | T9.1–T9.3 | S+S+M |

**Tổng: ~25 tasks** — mỗi task từ 1-2 sessions

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Clerk JWKS verify phức tạp | High | Test ngay ở T0.4, unblock sớm |
| WeasyPrint system deps (libcairo) | Med | Test PDF gen trên môi trường deploy sớm ở T6.4 |
| SQLModel async + Alembic autogenerate | Med | Cấu hình Alembic đúng từ T0.1 |
| Rate inheritance logic phức tạp | Low | Unit test riêng cho `effective_rate` |

## Open Questions

- Zalo OA API có cần tích hợp trong MVP hay chỉ copy link?
- Invoice overdue: tự động set status hay chủ nhà thủ công?
- Cần upload ảnh CCCD trong MVP không?
