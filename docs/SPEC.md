# Rental System — Project Spec

> Cập nhật theo triển khai thực tế — 2026-05-21

## 1. Objective

Xây dựng SaaS web app quản lý nhà trọ cho thuê, phục vụ nhiều chủ nhà độc lập. Mỗi chủ nhà có tài khoản riêng, quản lý nhiều nhà, nhiều phòng, nhiều khách thuê, hóa đơn hàng tháng và chỉ số điện/nước.

**Target users**: Chủ nhà có từ 1–50+ nhà trọ, muốn số hóa việc quản lý thay vì dùng giấy tờ/Excel.

**Success criteria**:
- Chủ nhà có thể đăng ký, tạo nhà + phòng, thêm khách thuê và xuất hóa đơn trong vòng 10 phút
- Hóa đơn có link public gửi được qua Zalo/SMS mà không cần khách đăng nhập
- Dashboard hiển thị doanh thu, phòng trống, hợp đồng sắp hết hạn

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui |
| Backend | FastAPI (Python 3.12+), SQLModel (async) |
| Database | PostgreSQL 16 |
| Migrations | Alembic |
| Auth | Clerk (frontend SDK + backend JWKS RS256 verify) |
| PDF | CSS `@media print` + `window.print()` — client-side browser PDF |
| Package manager | uv (backend), pnpm (frontend) |
| Deploy | Frontend: Vercel · Backend: Railway / Render |

**Auth flow với Clerk**:
- Frontend: `@clerk/nextjs` — `ClerkProvider`, `useAuth`, middleware bảo vệ routes
- Backend: verify Clerk JWT qua JWKS RS256, in-memory JWKS cache (`_jwks_cache`)
- Dev mode: `CLERK_JWKS_URL=` (trống) → skip signature verify, chỉ decode `sub`
- `clerk_user_id` (string) làm khóa phân tách dữ liệu; không lưu password trong DB

**Frontend patterns thực tế**:
- Tất cả pages dùng `"use client"` + `useState`/`useEffect` — không dùng Server Components
- Không dùng TanStack Query, không dùng zod/react-hook-form
- Inline styles với CSS variables từ `globals.css` — không dùng Tailwind utility classes trong code
- API calls qua `apiJson<T>(path, getToken)` hoặc `apiFetch(path, getToken, options)` trong `lib/api.ts`

---

## 3. Core Features (MVP)

### 3.1 Auth & Multi-tenant
- Đăng ký / đăng nhập / quản lý session do **Clerk** xử lý hoàn toàn
- Backend nhận `clerk_user_id` từ JWT, dùng làm khóa phân tách dữ liệu
- Mỗi chủ nhà chỉ thấy dữ liệu của mình (row-level isolation via `clerk_user_id` on `property`)
- Tất cả downstream queries cách ly qua FK chain: `property → room → contract → ...`

### 3.2 Quản lý Nhà (`Property`)
- CRUD nhà trọ: tên, địa chỉ, mô tả
- Cấu hình tại property:
  - Đơn giá điện mặc định (`default_elec_rate`, đ/kWh)
  - Đơn giá nước mặc định + **kiểu tính nước** (`water_calc_type`): `per_meter` | `per_person` | `per_room`
  - Thông tin ngân hàng: `bank_account_no`, `bank_name`, `bank_holder` (hiển thị trên hóa đơn public)
  - Danh sách phụ phí (`SurchargeTemplate`) áp dụng cho tất cả phòng trong nhà
  - Danh sách công tơ điện chung (`SharedMeter`) nếu có khu vực dùng chung

### 3.3 Quản lý Phòng (`Room`)
- CRUD phòng: số phòng, tầng, diện tích, giá thuê, tiền cọc
- Đơn giá điện riêng theo phòng (`elec_rate`); nếu NULL → kế thừa từ `property.default_elec_rate`
- Nước: không cài riêng theo phòng — dùng `water_calc_type` của nhà
- Trạng thái: `vacant` | `occupied` | `maintenance`

### 3.4 Quản lý Khách thuê (`Tenant`) & Hợp đồng (`Contract`)
- Thông tin khách: họ tên, CCCD, SĐT, email, ngày sinh
- Hợp đồng: ngày bắt đầu, ngày kết thúc, giá thuê thỏa thuận, tiền cọc, số người ở
- Một phòng có tối đa một contract đang `active`
- **`num_people` >= 1** — bắt buộc
- **Tạo contract**: chỉ khi `room.status = vacant` → sau khi tạo, room chuyển `occupied`
- **Validation**: `end_date > start_date`; backdating cho phép
- **Chỉ số đầu vào khi tạo contract** (`initial_elec_curr`): lưu dạng `elec_prev = elec_curr = initial_value` cho tháng vào. Chủ nhà nhập `elec_curr` thực tế sau đó. `curr == prev` → 0 tiêu thụ; `curr > prev` → có dùng điện trước khi kết billing
- **Proration**: `_prorate_factor(start_date, end_date, period)` = `days_occupied / days_in_month` áp dụng cho tiền thuê và phụ phí cố định ở tháng đầu/cuối. Meter-based utilities (điện, nước per_meter) không prorate
- **Kết thúc contract**: chỉ khi không còn hóa đơn unpaid (`draft`/`sent`). `contract.status = ended`, `contract.end_date = date.today()`, `room.status = vacant`
- **Xóa phòng**: block nếu tồn tại bất kỳ contract nào (kể cả ended) — bảo toàn lịch sử
- Invoice dùng `contract.agreed_rent`, không dùng `room.rent_price`
- Không có `DELETE /tenants`

**Contract event log**: Mọi thay đổi quan trọng ghi vào `ContractEvent`:
- `created` — khi tạo contract
- `rent_changed` — khi đổi giá thuê
- `people_changed` — khi đổi số người
- `ended` — khi kết thúc contract

### 3.5 Chỉ số Điện/Nước (`UtilityReading`)

**Reading chain**: Mỗi reading gắn với `contract_id` để cách ly tenant.

- `elec_prev` tự điền từ `elec_curr` của kỳ trước **chỉ khi cùng `contract_id`** — reading của tenant cũ không bao giờ contaminate tenant mới
- Month-skip guard: chỉ enforce continuity trong cùng contract; gap từ tenant cũ không block tenant mới
- **Edit lock**: không thể sửa reading kỳ N nếu kỳ N+1 đã có reading (sẽ corrupt auto-filled prev) hoặc nếu đã có invoice kỳ đó
- **Phòng mới / first reading**: chỉ nhập `curr`; `prev = NULL` nếu chưa có initial reading từ contract creation
- **Validation `curr >= prev`**: áp dụng mọi trường hợp, trừ `prev IS NULL`
- Nhập nước chỉ khi `water_calc_type = per_meter`; các mode khác `water_prev/curr = NULL`

**Legacy data**: Reading cũ có `elec_prev = NULL` vẫn tồn tại. Frontend detect via `isInitialReading = reading_id !== null && elec_prev === null`. Backend shift khi update: `elec_prev ← old_curr, elec_curr ← new_value`.

**Công tơ điện chung (`SharedMeter`)**:
- Công tơ gắn với property, áp dụng cho danh sách phòng (`SharedMeterRoom` junction)
- Reading tháng theo từng `SharedMeter`, auto-fill `prev` ← `curr` kỳ trước
- Chi phí chia theo tỷ lệ `num_people_phòng / tổng_người_có_hợp_đồng_active`; phòng trống không tham gia

### 3.5b Phụ phí (`SurchargeTemplate`)
- Thuộc `property_id`, áp dụng tất cả phòng trong nhà
- `calc_type`: `per_room` (cố định) | `per_person` (`amount × num_people`)
- Invoice snapshot giá trị lúc generate; sửa/xóa sau không ảnh hưởng invoice cũ
- Proration áp dụng cho phụ phí ở tháng đầu/cuối contract (cùng cơ chế với tiền thuê)

### 3.6 Hóa đơn (`Invoice`)

**Tạo hóa đơn** (`InvoiceService.generate()`):
- Yêu cầu có `UtilityReading` trước khi generate (không cho tạo hóa đơn nếu chưa nhập chỉ số)
- Mỗi khoản lưu thành 1 `InvoiceItem` (name, unit_price, quantity, amount, item_type)

**Các khoản `item_type`:**
- `rent` — `agreed_rent × prorate_factor` (snapshot lúc generate)
- `electricity` — `(elec_curr - elec_prev) × effective_elec_rate`; = 0 nếu `elec_prev IS NULL`
- `water` — theo `water_calc_type`:
  - `per_meter` → `(water_curr - water_prev) × default_water_rate`
  - `per_person` → `default_water_rate × num_people × prorate_factor`
  - `per_room` → `default_water_rate × prorate_factor`
- `surcharge` — mỗi template thành 1 item; `per_person` × `num_people`; prorate áp dụng
- `shared_elec` — điện chung, chia theo đầu người như mô tả phần 3.5

**Snapshot**: Tất cả giá trị (giá điện, nước, phụ phí, tiền thuê) copy vào `InvoiceItem` lúc generate; thay đổi rates/surcharge sau không ảnh hưởng invoice cũ. Preview hiển thị stored amounts nếu invoice đã tồn tại.

**Trạng thái (`VALID_TRANSITIONS`):**
```
draft → sent
draft → paid
sent  → paid
```

**Payment reporting (2-phase)**:
- Khách xem hóa đơn public, bấm "Đã chuyển khoản" → `payment_reported_at` được set (timestamp)
- `payment_reported_at` không tự chuyển status — chủ nhà phải verify và `PUT /invoices/{id}/status` thủ công
- Idempotent: báo lại không có tác dụng nếu đã có `payment_reported_at`

**PDF**: Dùng CSS `@media print` + `window.print()` — không cần thư viện phía server. Trang `/invoice/public/[token]` responsive cho print.

**Batch operations** (qua `BillingService`):
- `POST /billing/{property_id}/readings` — nhập nhiều phòng cùng lúc
- `GET /billing/{property_id}/status?period=` — xem trạng thái điện/nước + hóa đơn cả property
- `GET /billing/{property_id}/invoice-preview?period=` — preview hóa đơn tất cả phòng trước khi generate
- `POST /billing/{property_id}/invoices` — generate hóa đơn cho nhiều phòng cùng lúc

### 3.7 Dashboard & Báo cáo
- KPI cards: phòng trống/có người, doanh thu tháng hiện tại, hóa đơn chưa thanh toán, hợp đồng sắp hết hạn
- Biểu đồ doanh thu theo tháng trong năm (bar chart, built-in không dùng Recharts)
- Danh sách hợp đồng sắp hết hạn (30 ngày tới)
- Danh sách hóa đơn chưa thanh toán — click mở `InvoiceDrawer`

---

## 4. Data Model

```
Property          — id, clerk_user_id, name, address, description,
                    default_elec_rate, default_water_rate,
                    water_calc_type (per_meter|per_person|per_room),
                    bank_account_no, bank_name, bank_holder

Room              — id, property_id→Property, room_number, floor, area_m2,
                    rent_price, deposit, status (vacant|occupied|maintenance),
                    elec_rate (NULL = kế thừa từ property)

Tenant            — id, clerk_user_id, full_name, id_number, phone, email, dob

Contract          — id, room_id→Room, tenant_id→Tenant,
                    start_date, end_date, agreed_rent, deposit,
                    num_people, status (active|ended)

ContractEvent     — id, contract_id→Contract, event_type, old_value, new_value,
                    created_at
                    # event_type: created | rent_changed | people_changed | ended

UtilityReading    — id, room_id→Room, contract_id→Contract,
                    period (YYYY-MM),
                    elec_prev, elec_curr,         # elec_prev auto-fill từ kỳ trước (same contract)
                    water_prev, water_curr,        # NULL nếu water_calc_type ≠ per_meter
                    is_prev_auto (bool)
                    # UNIQUE (room_id, period)

SurchargeTemplate — id, property_id→Property,
                    name, amount, calc_type (per_room|per_person)

SharedMeter       — id, property_id→Property, name

SharedMeterRoom   — shared_meter_id→SharedMeter, room_id→Room
                    # composite PK (shared_meter_id, room_id)

SharedMeterReading — id, shared_meter_id→SharedMeter, period (YYYY-MM),
                     prev_reading, curr_reading, is_prev_auto (bool)

Invoice           — id, contract_id→Contract, period (YYYY-MM),
                    total, status (draft|sent|paid),
                    public_token (uuid, auto-generated),
                    payment_reported_at (nullable timestamp)
                    # UNIQUE (contract_id, period)

InvoiceItem       — id, invoice_id→Invoice,
                    item_type (rent|electricity|water|surcharge|shared_elec),
                    name, unit_price, quantity, amount
```

---

## 5. Project Structure

```
rental-system/
├── frontend/
│   ├── app/
│   │   ├── page.tsx                        # Landing page (public, redirect nếu đã login)
│   │   ├── (auth)/                         # Clerk sign-in/sign-up — không có sidebar
│   │   ├── (dashboard)/                    # Protected routes — có sidebar + topbar
│   │   │   ├── dashboard/page.tsx          # Dashboard overview (URL: /dashboard)
│   │   │   ├── properties/
│   │   │   ├── rooms/
│   │   │   ├── tenants/
│   │   │   ├── contracts/
│   │   │   ├── utilities/                  # Ghi chỉ số điện/nước (chọn property)
│   │   │   ├── invoices/
│   │   │   └── settings/
│   │   └── invoice/public/[token]/         # Public invoice (no auth, print-ready)
│   ├── components/
│   │   ├── ui/                             # shadcn/ui primitives
│   │   └── app/                            # Domain drawers + modals:
│   │       ├── billing-modal.tsx           # Ghi chỉ số + tạo hóa đơn batch
│   │       ├── invoice-drawer.tsx          # Invoice detail + status actions
│   │       ├── invoice-generate-drawer.tsx # Two-panel: form → preview (slide)
│   │       ├── contract-drawer.tsx         # Contract detail + event timeline
│   │       ├── tenant-drawer.tsx           # Tenant info + contract history
│   │       ├── property-drawer.tsx         # Property settings
│   │       └── sidebar.tsx                 # Sticky sidebar (nav + user card)
│   ├── lib/
│   │   ├── api.ts                          # apiJson<T> / apiFetch wrappers
│   │   └── format.ts                       # fmtMoney, fmtDate
│   ├── types/                              # TypeScript interfaces
│   └── middleware.ts                       # Clerk route protection
│
├── backend/
│   └── app/
│       ├── core/
│       │   ├── clerk.py                    # RS256 JWT verify + JWKS cache
│       │   ├── config.py                   # pydantic-settings
│       │   ├── database.py                 # AsyncSession factory
│       │   ├── dependencies.py             # SessionDep, CurrentUserDep, XxxServiceDep
│       │   └── exceptions.py              # AppException hierarchy
│       ├── models/                         # SQLModel table=True
│       ├── schemas/                        # Pydantic XxxCreate/Read/Update
│       ├── repositories/                   # DB ops only, no flush/commit logic
│       ├── services/                       # Business logic + transaction owner
│       │   ├── billing_service.py          # Batch readings + invoice generation
│       │   ├── invoice_service.py          # _build_items, _prorate_factor, generate
│       │   └── ...
│       └── routers/
│           ├── billing.py                  # /billing/{property_id}/...
│           └── ...
│
├── CLAUDE.md                               # Architecture + dev commands
├── SPEC.md                                 # This file
├── PLAN.md                                 # Phase plan + task breakdown
└── TODO.md                                 # Current status + progress
```

---

## 6. API Design

Prefix: `/api/v1`

```
# Auth
GET    /auth/me

# Properties
GET    /properties
POST   /properties
GET    /properties/{id}
PUT    /properties/{id}
DELETE /properties/{id}
GET    /properties/stats                    # summary stats cho sidebar badges

# Rooms
GET    /properties/{id}/rooms
POST   /rooms
GET    /rooms/{id}
PUT    /rooms/{id}
DELETE /rooms/{id}
GET    /rooms/{id}/contracts

# Tenants
GET    /tenants
POST   /tenants
GET    /tenants/{id}
PUT    /tenants/{id}
GET    /tenants/{id}/contracts
                                            # không có DELETE /tenants

# Contracts
GET    /contracts
POST   /contracts
GET    /contracts/{id}
PUT    /contracts/{id}
POST   /contracts/{id}/end
GET    /contracts/{id}/events              # ContractEvent log

# Surcharges
GET    /properties/{id}/surcharges
POST   /properties/{id}/surcharges
PUT    /surcharges/{id}
DELETE /surcharges/{id}

# Shared Meters
GET    /properties/{id}/shared-meters
POST   /properties/{id}/shared-meters
PUT    /shared-meters/{id}
DELETE /shared-meters/{id}
GET    /shared-meters/{id}/rooms
POST   /shared-meters/{id}/rooms
DELETE /shared-meters/{id}/rooms/{room_id}
POST   /shared-meters/{id}/readings        # nhập chỉ số công tơ chung
GET    /shared-meters/{id}/readings

# Utility Readings
GET    /utilities/{room_id}                # lịch sử readings theo phòng
POST   /utilities/{room_id}                # nhập reading đơn lẻ

# Billing (batch operations)
GET    /billing/{property_id}/status       # trạng thái điện/nước + invoice cả property
GET    /billing/{property_id}/invoice-preview  # preview hóa đơn trước khi generate
POST   /billing/{property_id}/readings     # batch save readings
POST   /billing/{property_id}/invoices     # batch generate invoices

# Invoices
GET    /invoices
POST   /invoices/generate                  # single invoice generate
GET    /invoices/{id}                      # InvoiceDetailRead (bao gồm meter readings)
PUT    /invoices/{id}/status               # state machine transition
DELETE /invoices/{id}                      # chỉ draft
GET    /invoices/public/{token}            # no auth — InvoicePublicRead (không có CCCD/SĐT)
POST   /invoices/public/{token}/report-payment  # tenant tự báo đã chuyển khoản

# Dashboard
GET    /dashboard/summary                  # KPI counts + lists
GET    /dashboard/revenue?year=            # doanh thu 12 tháng
```

---

## 7. Architecture

### Backend — Layered (Router → Service → Repository → Model)

Xem chi tiết trong `CLAUDE.md`. Tóm tắt:

- **Router**: parse request, gọi service, trả schema — không có logic
- **Service**: business logic + `await session.commit()` — transaction owner. Raise `AppException` subclasses, không raise `HTTPException`
- **Repository**: DB ops + `await session.flush()` sau write — không commit
- **Model**: SQLModel `table=True`, không có logic
- **Schema**: Pydantic tách riêng (`XxxCreate`, `XxxRead`, `XxxUpdate`)
- **DI**: services là plain Python classes, wiring trong `core/dependencies.py`

### Frontend — Client components

- Tất cả pages dùng `"use client"` + `useState`/`useEffect`
- Drawer pattern (không routing on row-click): `InvoiceDrawer`, `ContractDrawer`, `TenantDrawer`, `PropertyDrawer`
- Styles: inline style với CSS variables từ `globals.css` (design tokens Seline)
- `apiJson<T>(path, getToken)` — tự attach Clerk JWT, throws on error

---

## 8. Testing Strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Service unit | pytest | Billing logic, proration, auto-fill utility |
| Repository | pytest + test DB | Query correctness |
| Router integration | pytest + httpx + test DB | Full request/response |
| Frontend | — | Chưa có test |

**Pending tests**:
- `invoice_service._build_items()` — prorate, 3 water modes, shared meter split
- `billing_service.batch_save_readings()` — contract_id isolation, month-skip guard, edit-lock
- Owner isolation — user A không đọc được dữ liệu user B
- Public invoice endpoint — đúng dữ liệu, 404 với invalid token

---

## 9. Boundaries

### Always do
- Validate `clerk_user_id` trên mọi service method qua FK chain ownership check
- Pass `datetime.date` objects trực tiếp cho date comparisons với asyncpg (không cast string)
- Service nhận `clerk_user_id` như tham số tường minh, không đọc từ global state

### Never do
- Import `HTTPException` trong service — dùng `AppException` subclasses
- Expose CCCD/SĐT trên public invoice endpoint (`/invoices/public/*`)
- Cho phép unauthenticated access ngoài `/`, `/sign-in`, `/sign-up`, `/invoice/public/*`
- Dùng `async with session.begin()` trong service — conflicts với asyncpg autobegin
- Dùng `utility_reading` của tenant cũ làm `elec_prev` cho tenant mới — luôn check `contract_id` match
