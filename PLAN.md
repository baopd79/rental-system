# Implementation Plan: Rental System

## Overview

Full-stack SaaS quản lý nhà trọ. Backend FastAPI + SQLModel (layered: Router→Service→Repository→Model), frontend Next.js 15 + Clerk auth. Chia thành 10 phase theo vertical slices — mỗi phase cho ra một tính năng hoàn chỉnh có thể test ngay.

## Architecture Decisions

- **Vertical slices**: mỗi phase giao được tính năng từ DB đến UI, không build tất cả backend trước
- **Backend-first trong mỗi slice**: model → schema → repo → service → router → frontend
- **Alembic migration** sau mỗi model mới — không dồn migration
- **Clerk JWT** verify ở backend qua JWKS, không lưu user trong DB riêng
- **Async everywhere**: `AsyncSession`, `async def` cho toàn bộ backend
- **Class-based Repositories** *(refactored 2026-05-17)*: repo nhận `session` qua `__init__`, không pass per-call; `flush()` sau mỗi write để ID available trước commit; service giữ `self.session` cho commit/refresh
- **PostgreSQL ENUM trong migration**: dùng `PgEnum(..., create_type=False)` trong `create_table` khi đã explicit `.create()` trước đó để tránh duplicate CREATE TYPE

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

### Task 3.1: Tenant + Contract models + schemas + migration ✅

**Description:** `Tenant` (gắn với `clerk_user_id`), `Contract` (FK room + tenant, `num_people`, `status`), Alembic migration.

**Acceptance criteria:**
- [x] Table `tenant` và `contract` được tạo với đúng constraints
- [x] `ContractRead` include thông tin tenant (joined)

**Verification:**
- [x] `alembic upgrade head` không lỗi

**Dependencies:** T2.1

**Files:**
- `backend/app/models/tenant.py`
- `backend/app/models/contract.py`
- `backend/app/schemas/tenant.py`
- `backend/app/schemas/contract.py`
- `backend/alembic/versions/003_create_tenant_contract.py`

**Scope:** S

---

### Task 3.2: Tenant + Contract repositories + services + routers ✅

**Description:** `TenantService` (CRUD), `ContractService` (tạo contract: validate chỉ 1 active per room, kết thúc contract: set status=ended + room status=vacant). Bổ sung room deletion guard và endpoint lịch sử hợp đồng theo phòng.

**Acceptance criteria:**
- [x] Tạo contract: `room.status` phải là `vacant` → 400 nếu không phải
- [x] Tạo contract cho phòng đang có active contract → 400
- [x] `end_date > start_date` validation → 400 nếu sai; backdating cho phép
- [x] `num_people >= 1` validation → 400 nếu sai
- [x] Tạo contract → `room.status = occupied`
- [x] Kết thúc contract (`PUT /contracts/{id}/end`) → `room.status = vacant`
- [x] `ContractRead` embed `TenantRead` inline
- [x] `GET /rooms/{id}/contracts` trả lịch sử hợp đồng (active + ended)
- [x] `DELETE /rooms/{id}`: block nếu tồn tại bất kỳ contract nào (kể cả ended) → 409
- [x] User không sở hữu room → 403
- [x] `start_date` = ngày bắt đầu tính tiền; không có `billing_start_date`, không pro-rata
- [x] Không có `DELETE /tenants`; deposit settlement defer post-MVP

**Verification:**
- [ ] `pytest tests/integration/test_contracts.py` pass (chưa viết test)

**Dependencies:** T3.1, T2.2

**Files:**
- `backend/app/repositories/tenant_repo.py`
- `backend/app/repositories/contract_repo.py`
- `backend/app/services/tenant_service.py`
- `backend/app/services/contract_service.py`
- `backend/app/routers/tenants.py`
- `backend/app/routers/contracts.py`

**Scope:** L

---

### Task 3.3: Frontend — Tenants + Contracts pages ✅

**Description:** Danh sách khách thuê, form tạo khách, form tạo hợp đồng (gắn khách vào phòng), action kết thúc hợp đồng.

**Acceptance criteria:**
- [x] `/dashboard/tenants` list khách thuê, search theo tên/SĐT/CCCD
- [x] Tạo contract từ `/rooms/[id]` (chọn khách từ danh sách)
- [x] Kết thúc contract có confirmation dialog
- [x] Room status cập nhật ngay sau khi tạo/kết thúc contract
- [x] Active contract hiển thị banner trên room detail

**Verification:**
- [x] Tạo contract → room badge chuyển sang `occupied`
- [x] Kết thúc contract → room badge chuyển sang `vacant`

**Dependencies:** T3.2, T2.3

**Files:**
- `frontend/app/(dashboard)/tenants/page.tsx`
- `frontend/components/app/tenant-form.tsx`
- `frontend/components/app/contract-form.tsx`
- `frontend/types/tenant.ts`
- `frontend/types/contract.ts`

**Scope:** L

---

### Checkpoint: Phase 3 ✅

- [x] Toàn bộ flow: tạo nhà → phòng → khách → hợp đồng hoạt động
- [x] Room status tự động cập nhật
- [x] Một phòng không thể có 2 active contracts

---

## Phase 4: Utility Readings

### Task 4.1: UtilityReading model + schema + migration ✅

**Description:** Model `UtilityReading` với `period` (YYYY-MM), `elec_prev/curr`, `water_prev/curr`, `is_prev_auto`.

**Acceptance criteria:**
- [x] Unique constraint `(room_id, period)` — mỗi phòng chỉ có 1 reading per kỳ
- [x] `is_prev_auto` default `true`; `elec_prev` nullable (first reading)

**Verification:**
- [x] `alembic upgrade head` không lỗi

**Dependencies:** T2.1

**Files:**
- `backend/app/models/utility.py`
- `backend/app/schemas/utility.py`
- `backend/alembic/versions/004_create_utility_reading.py`

**Scope:** S

---

### Task 4.2: UtilityService — auto-fill logic + router ✅

**Description:** `UtilityService.create_reading()`: trước khi insert, query reading của kỳ trước (`period - 1 month`), lấy `elec_curr/water_curr` làm `elec_prev/water_prev` của kỳ mới. Nếu không có kỳ trước → `prev = NULL`, `is_prev_auto=false`.

**Acceptance criteria:**
- [x] Tạo reading tháng 2026-06 → `elec_prev` tự điền từ `elec_curr` của 2026-05
- [x] Phòng mới (first reading): chỉ cần `curr`; `prev = NULL`, `is_prev_auto=false`
- [x] Duplicate period cho cùng phòng → 409
- [x] `curr >= prev` validate mọi trường hợp, trừ khi `prev IS NULL`
- [x] `water_prev/curr = NULL` nếu `water_calc_type != per_meter` (service tự set)
- [x] Update/Delete: chỉ reading mới nhất, chưa có invoice → 409 nếu vi phạm
- [x] Cho phép nhập reading dù phòng không có active contract

**Verification:**
- [ ] `pytest tests/unit/test_utility_service.py` pass (chưa viết test)

**Dependencies:** T4.1, T0.4

**Files:**
- `backend/app/repositories/utility_repo.py`
- `backend/app/services/utility_service.py`
- `backend/app/routers/utilities.py`

**Scope:** M

---

### Task 4.3: Frontend — Utility Reading input ✅

**Description:** Form nhập chỉ số điện/nước theo phòng + tháng. Số đầu kỳ tự điền từ API. Chỉ cần nhập số cuối kỳ.

**Acceptance criteria:**
- [x] `/rooms/[id]/utility` hiển thị lịch sử readings + cột tiêu thụ
- [x] Badge "Thủ công" cho first reading (`is_prev_auto=false`)
- [x] Edit/Delete chỉ hiển thị trên dòng mới nhất
- [x] Water fields ẩn nếu `water_calc_type != per_meter`
- [x] Button "Chỉ số điện/nước" trên room detail page

**Verification:**
- [x] Nhập reading tháng 2 → reading tháng 3 tự fill số đầu kỳ

**Dependencies:** T4.2, T2.3

**Files:**
- `frontend/app/(dashboard)/rooms/[id]/utility/page.tsx`
- `frontend/components/app/utility-reading-form.tsx`
- `frontend/types/utility.ts`

**Scope:** M

---

### Checkpoint: Phase 4 ✅

- [x] Auto-fill `elec_prev` ← `elec_curr` kỳ trước hoạt động đúng
- [ ] Unit test `test_utility_service.py` pass (Phase 9)

---

## Phase 5: Surcharges *(SharedMeter deferred → Phase 7)*

### Task 5.1: SurchargeTemplate model + schema + migration + CRUD ✅

**Description:** `SurchargeTemplate` thuộc `property_id`, `calc_type: per_room | per_person`, `name`, `amount`. Full CRUD backend + frontend trong property detail.

**Acceptance criteria:**
- [x] `GET /properties/{id}/surcharges` chỉ trả surcharges của property đó
- [x] User không sở hữu property → 403
- [x] `calc_type` chỉ nhận `per_room` hoặc `per_person`
- [x] Delete/edit tự do — invoice snapshot giá trị lúc generate, không ảnh hưởng invoice cũ
- [x] Frontend: section "Phụ phí" trong property detail với inline edit/delete

**Verification:**
- [x] Tạo surcharge `per_person` 50k cho property → xác nhận `property_id` đúng trong DB

**Dependencies:** T1.2

**Files:**
- `backend/app/models/surcharge.py`
- `backend/app/schemas/surcharge.py`
- `backend/app/repositories/surcharge_repo.py`
- `backend/app/services/surcharge_service.py`
- `backend/app/routers/surcharges.py`
- `backend/alembic/versions/c3d4e5f6a7b8_create_surcharge_template.py`
- `frontend/components/app/surcharge-list.tsx`
- `frontend/types/surcharge.ts`

**Scope:** M

---

### Task 5.2: SharedMeter *(DEFERRED → Phase 7)*

Defer sang sau Phase 6 Invoice. Invoice MVP không tính điện chung. Sẽ implement sau khi Invoice hoạt động ổn.

---

### Checkpoint: Phase 5 ✅

- [x] Surcharges quản lý được theo từng property
- [ ] SharedMeter — deferred

---

## Phase 6: Invoice Generation

### Task 6.1: Invoice + InvoiceItem models + schemas + migration

**Description:** `Invoice` (FK contract, period, total, status, `public_token` uuid), `InvoiceItem` (item_type, name, amount, quantity), Alembic migration.

**Acceptance criteria:**
- [ ] `public_token` UUID sinh tự động khi tạo invoice
- [ ] Unique constraint `(contract_id, period)`
- [ ] `InvoiceStatus` enum: `draft | sent | paid`
- [ ] `InvoiceItemType` enum: `rent | electricity | water | surcharge`

**Verification:**
- [ ] `alembic upgrade head` không lỗi

**Dependencies:** T3.1

**Files:**
- `backend/app/models/invoice.py`
- `backend/app/schemas/invoice.py`
- `backend/alembic/versions/d4e5f6a7b8c9_create_invoice.py`

**Scope:** S

---

### Task 6.2: InvoiceService — calculation + generate + CRUD + router

**Description:** Pure function `_build_items(contract, reading, surcharges, property)` tính từng khoản → list `InvoiceItem`. `generate()` orchestrate: validate → tính → persist. CRUD endpoints + status transitions.

**Accepted rules:**
- Không bắt buộc có UtilityReading — điện/nước = 0 nếu thiếu
- `elec_prev IS NULL` → electricity = 0
- Surcharge snapshot name + amount vào InvoiceItem
- Edit/delete chỉ khi `draft`
- Transitions: `draft→sent`, `draft→paid`, `sent→paid`
- PDF defer sang Phase 7

**Acceptance criteria:**
- [ ] `POST /invoices/generate` tạo invoice `draft` với đúng InvoiceItems
- [ ] Duplicate `(contract_id, period)` → 409
- [ ] `PUT /invoices/{id}/status`: chỉ các transition hợp lệ → 400 nếu sai
- [ ] `PUT /invoices/{id}` (edit items): chỉ khi `draft` → 400 nếu đã sent/paid
- [ ] `DELETE /invoices/{id}`: chỉ khi `draft`
- [ ] `GET /invoices/{id}` trả đầy đủ invoice + items
- [ ] Tiền điện: `(curr - prev) × rate`; 0 nếu no reading hoặc prev=NULL
- [ ] Tiền nước: per_meter/per_person/per_room đúng công thức
- [ ] Surcharge: mỗi template → 1 item, per_person × num_people

**Verification:**
- [ ] `pytest tests/unit/test_invoice_calculation.py` pass
- [ ] `pytest tests/integration/test_invoices.py` pass

**Dependencies:** T6.1, T5.1, T4.1, T3.2

**Files:**
- `backend/app/repositories/invoice_repo.py`
- `backend/app/services/invoice_service.py`
- `backend/app/routers/invoices.py`
- `backend/tests/unit/test_invoice_calculation.py`
- `backend/tests/integration/test_invoices.py`

**Scope:** L

---

### Task 6.3: Frontend — Invoice list + generate flow

**Description:** Trang danh sách hóa đơn, form generate (chọn contract + tháng), invoice detail với breakdown items, action đổi status, copy public link.

**Acceptance criteria:**
- [ ] `/dashboard/invoices` list với filter theo status
- [ ] Generate từ room detail hoặc invoice list: chọn contract + tháng
- [ ] Invoice detail hiển thị từng InvoiceItem (tên, số tiền)
- [ ] Status badge + nút transition (Gửi / Đánh dấu đã thanh toán)
- [ ] Nút "Copy link" copy public URL vào clipboard

**Verification:**
- [ ] Generate invoice → hiển thị đúng từng khoản
- [ ] Copy link → URL có dạng `/invoice/public/{token}`

**Dependencies:** T6.2, T0.2

**Files:**
- `frontend/app/(dashboard)/invoices/page.tsx`
- `frontend/app/(dashboard)/invoices/[id]/page.tsx`

**Files:**
- `frontend/app/(dashboard)/invoices/page.tsx`
- `frontend/app/(dashboard)/invoices/[id]/page.tsx`
- `frontend/components/app/invoice-generate-form.tsx`
- `frontend/types/invoice.ts`

**Scope:** M

---

### Checkpoint: Phase 6

- [ ] Generate invoice E2E: từ contract → hiển thị breakdown items
- [ ] Calculation unit tests pass
- [ ] Copy public link hoạt động (PDF defer Phase 7)

---

## Phase 7: Public Invoice + PDF + SharedMeter

### Task 7.1: Public invoice endpoint + frontend page

**Description:** Backend `GET /invoices/public/{token}` trả invoice data (không có thông tin nhạy cảm: che CCCD, SĐT). Frontend `/invoice/public/[token]` là trang static không cần auth.

**Acceptance criteria:**
- [ ] Token hợp lệ → trả invoice data (CCCD và SĐT bị che bớt)
- [ ] Token không tồn tại → 404
- [ ] Trang public không có Clerk middleware

**Dependencies:** T6.2

**Files:**
- `backend/app/routers/invoices.py` (public endpoint)
- `backend/app/schemas/invoice.py` (`InvoicePublicRead`)
- `frontend/app/invoice/public/[token]/page.tsx`

**Scope:** M

---

### Task 7.2: PDF generation *(deferred từ Phase 6)*

**Description:** Jinja2 template → WeasyPrint PDF. Endpoint `GET /invoices/{id}/pdf`.

**Dependencies:** T7.1

**Scope:** M

---

### Task 7.3: SharedMeter *(deferred từ Phase 5)*

**Description:** `SharedMeter`, `SharedMeterRoom` (junction), `SharedMeterReading`. Tích hợp vào invoice calculation.

**Dependencies:** T6.2

**Scope:** L

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

| Phase | Tasks | Scope | Status |
|-------|-------|-------|--------|
| 0. Scaffold | T0.1–T0.4 | Setup | ✅ Done |
| 1. Properties | T1.1–T1.3 | M×3 | ✅ Done |
| 2. Rooms | T2.1–T2.3 | S+M+M | ✅ Done |
| 3. Tenants & Contracts | T3.1–T3.3 | S+L+L | ✅ Done |
| 4. Utility Readings | T4.1–T4.3 | S+M+M | ✅ Done |
| 5. Surcharges | T5.1 | M | ✅ Done |
| 6. Invoices | T6.1–T6.5 | S+M+M+M+L | 🔜 Next |
| 7. Public Invoice + SharedMeter | T7.1–T7.2 | M+M | — |
| 8. Dashboard | T8.1–T8.2 | M+M | — |
| 9. Tests | T9.1–T9.3 | S+S+M | — |

**Tiến độ: Phase 0–5 hoàn thành. Phase 6 (Invoice) là next.**

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
