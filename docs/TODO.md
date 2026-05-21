# TODO — Rental System

> Cập nhật: 2026-05-21 — Phase 0–9 hoàn thành. Tất cả 106 tests pass.

---

## Trạng thái tổng quan

| Phase | Mô tả | Status |
|-------|-------|--------|
| 0 | Project scaffold | ✅ Done |
| 1 | Properties CRUD | ✅ Done |
| 2 | Rooms CRUD | ✅ Done |
| 3 | Tenants & Contracts | ✅ Done |
| 4 | Utility Readings | ✅ Done |
| 5 | Surcharge + SharedMeter | ✅ Done |
| 6 | Invoice Generation | ✅ Done |
| 7 | Public Invoice + Billing batch | ✅ Done |
| 8 | Dashboard | ✅ Done |
| 9 | Tests & Hardening | ✅ Done |
| — | Landing page | ✅ Done |

---

## ✅ Phase 0 — Project Scaffold

- [x] **T0.1** Backend scaffold: uv, FastAPI, SQLModel async, Alembic, pydantic-settings
- [x] **T0.2** Frontend scaffold: Next.js 15, Tailwind v4, shadcn/ui, Clerk provider + middleware
- [x] **T0.3** Docker Compose PostgreSQL 16 + `.env.example`
- [x] **T0.4** Clerk JWT verification backend (`core/clerk.py`, `dependencies.py`, `GET /auth/me`)

**Ghi chú:**
- Dev mode: `CLERK_JWKS_URL=` (trống) → skip signature verify, chỉ decode `sub`
- JWKS cache in-memory (`_jwks_cache` global) — không expire (acceptable cho dev/single-instance)
- pytest config: `asyncio_default_test_loop_scope = "session"` — tránh asyncpg cross-loop error

---

## ✅ Phase 1 — Properties

- [x] **T1.1** `Property` model + schemas + migration
- [x] **T1.2** `property_repo` + `PropertyService` + router CRUD + owner isolation
- [x] **T1.3** Frontend `/properties` page: drawer + form tạo/sửa/xóa

**Ghi chú:**
- `Property` có thêm `bank_account_no`, `bank_name`, `bank_holder` (không có trong spec gốc) — dùng cho QR payment trên public invoice
- `GET /properties/stats` bổ sung để sidebar badges load counts

---

## ✅ Phase 2 — Rooms

- [x] **T2.1** `Room` model + schemas + migration (`elec_rate` nullable)
- [x] **T2.2** `room_repo` + `RoomService` (rate inheritance) + router
- [x] **T2.3** Frontend: rooms list, `PropertyDrawer` + `PropertyConfigDrawer`, room status badge

**Ghi chú:**
- `effective_elec_rate` resolved trong service: `room.elec_rate ?? property.default_elec_rate`
- `water_rate` không có field riêng theo phòng — chỉ dùng `property.water_calc_type`

---

## ✅ Phase 3 — Tenants & Contracts

- [x] **T3.1** `Tenant` + `Contract` + `ContractEvent` models + schemas + migration
- [x] **T3.2** Services: `TenantService`, `ContractService` (validation, event log, unpaid guard khi end)
- [x] **T3.3** Frontend: `TenantDrawer`, `ContractDrawer` với event timeline

**Thêm so với spec gốc:**
- `ContractEvent` table: log `created | rent_changed | people_changed | ended`
- `ContractCreate.initial_elec_curr` / `initial_water_curr`: tạo `UtilityReading` move-in ngay khi tạo contract (`elec_prev = elec_curr = initial_value`)
- Block `end_contract` nếu có hóa đơn `draft`/`sent` chưa thanh toán
- `GET /contracts/{id}/events` endpoint
- `GET /tenants/{id}/contracts` endpoint

---

## ✅ Phase 4 — Utility Readings

- [x] **T4.1** `UtilityReading` model + schemas + migration (UNIQUE `room_id + period`, `contract_id` FK)
- [x] **T4.2** `UtilityService` + auto-fill logic + router
- [x] **T4.3** Frontend: readings trong `BillingModal`, amber border cho legacy readings

**Thêm so với spec gốc:**
- `contract_id` FK trên `UtilityReading` — cốt lõi để cách ly tenant
- Auto-fill `elec_prev` chỉ khi `prev_reading.contract_id == current_contract_id`
- Month-skip guard chỉ áp dụng trong cùng contract
- Edit-lock khi kỳ N+1 đã có reading hoặc kỳ N đã có invoice
- Legacy data (`elec_prev = NULL`): frontend detect + amber border

---

## ✅ Phase 5 — Surcharges + SharedMeter

- [x] **T5.1** `SurchargeTemplate` model + schemas + CRUD
- [x] **T5.2** `SharedMeter` + `SharedMeterRoom` + `SharedMeterReading` + migration
- [x] Frontend: shared meter config trong `PropertyConfigDrawer`

**Ghi chú:**
- SharedMeter được gộp vào Phase 5 thay vì defer sang Phase 7 như spec gốc
- Điện chung: phân bổ theo `num_people` — phòng không có active contract không tham gia

---

## ✅ Phase 6 — Invoice Generation

- [x] **T6.1** `Invoice` + `InvoiceItem` models + schemas + migration
- [x] **T6.2** `InvoiceService`: `_build_items`, `_prorate_factor`, `_build_shared_elec_items`, generate
- [x] **T6.3** CRUD endpoints + `VALID_TRANSITIONS` state machine
- [x] **T6.4** ~~PDF WeasyPrint~~ → CSS `@media print` + `window.print()` trên public page
- [x] **T6.5** Frontend: `InvoiceDrawer`, `InvoiceGenerateDrawer` (two-panel slide)

**Thay đổi so với spec gốc:**
- **Proration ĐƯỢC triển khai** (spec gốc ghi "không tính pro-rata") — `_prorate_factor` áp dụng cho rent, water per_person/per_room, surcharges
- `InvoiceItemType` thực tế: `rent | electricity | water | surcharge | shared_elec` (spec ghi `elec` không có `shared_elec`)
- **Yêu cầu có reading** trước khi generate (spec gốc cho phép generate không cần reading)
- `Invoice` không có `due_date`, `paid_at` — thay bằng `payment_reported_at`
- PDF: browser print thay server-side WeasyPrint (không cần dependency WeasyPrint)

---

## ✅ Phase 7 — Public Invoice + Billing Batch

- [x] **T7.1** `GET /invoices/public/{token}` (no auth) + frontend `/invoice/public/[token]`
- [x] **T7.2** `POST /invoices/public/{token}/report-payment` — tenant tự báo chuyển khoản
- [x] **T7.3** `BillingService`: batch readings, invoice preview, batch generate
- [x] Frontend: `BillingModal` (readings tab + invoices tab), In PDF button trên InvoiceDrawer

**Thêm so với spec gốc:**
- Billing batch endpoints (`/billing/{id}/...`) — không có trong spec gốc
- Two-phase payment: `payment_reported_at` timestamp, không auto-set status
- VietQR image API trên public invoice page
- Public page: compact one-page layout, print CSS, luôn mở invoice detail (không dropdown)

---

## ✅ Phase 8 — Dashboard

- [x] **T8.1** `DashboardService` (summary + revenue) + raw SQL queries
- [x] **T8.2** Frontend: KPI cards, bar chart doanh thu (inline SVG bars), expiring + unpaid lists

**Ghi chú:**
- Dashboard dùng `sqlalchemy.text()` raw SQL — không dùng Recharts như spec gốc (built-in divs)
- `GET /dashboard/summary` trả cả `expiring_contracts` list + `unpaid_invoice_list`

---

## ✅ Landing Page

- [x] `app/page.tsx` — server component, redirect `/dashboard` nếu đã login
- [x] Dashboard di chuyển từ `/` → `/dashboard` (`(dashboard)/dashboard/page.tsx`)
- [x] Sidebar href cập nhật
- [x] Middleware: `/` thêm vào public routes
- [x] Seline design system: Canvas Fog, Chartwell Blue, Stone Border

---

## ✅ Phase 9 — Tests & Hardening

- [x] **T9.1** Unit tests `_build_items` + `_prorate_factor` — 3 water modes, partial month proration (23 cases)
- [x] **T9.2** Integration tests `billing_service` — contract_id isolation, month-skip, edit-lock (6 cases in test_billing.py)
- [x] **T9.3** Integration tests owner isolation — cross-user 403/404: utilities + surcharges + all other resources
- [x] **T9.4** Integration test public invoice — valid token, invalid token, report-payment idempotency, PII exclusion

**Ghi chú:**
- 106 tests total: 28 unit + 78 integration, tất cả pass
- `test_billing.py` tạo mới cho billing batch contract-id isolation, month-skip guard, edit-lock
- `conftest.py` cập nhật truncate list đầy đủ (contract_event, shared_meter*)
- Unit tests `_prev_period` trong test_utility_service.py (5 cases)

---

## Patterns đã xác lập

```
Backend:
  Router  → gọi service, trả schema
  Service → business logic + await session.commit()
  Repo    → DB ops + flush() sau write, không commit
  Model   → SQLModel table=True
  Schema  → Pydantic (XxxCreate / XxxRead / XxxUpdate)
  DI      → dependencies.py — Annotated[XxxService, Depends(_xxx_service)]
  Auth    → CurrentUserDep = Annotated[str, Depends(verify_clerk_token)]
  Errors  → raise NotFoundException/ForbiddenException/ConflictException/BadRequestException

Billing logic:
  Điện:        (curr - prev) × effective_elec_rate; 0 nếu prev IS NULL
  Nước:        per_meter | per_person | per_room
  Phụ phí:     per_room (×1) | per_person (×num_people)
  Điện chung:  (num_people_phòng / Σ active people) × total_usage × elec_rate
  Proration:   days_occupied / days_in_month; áp cho rent, water flat, surcharge; không áp cho meter utilities
  Reading:     contract_id-scoped prev-carry; edit-lock khi downstream exists

Frontend:
  "use client" + useState/useEffect — không dùng Server Components
  apiJson<T>(path, getToken) — attach Clerk JWT, throws on error
  Drawer pattern — không routing on row-click
  Inline styles với var(--vn-*) tokens từ globals.css
  Print PDF: window.print() + @media print CSS
```
