# Rental System — Project Spec

## 1. Objective

Xây dựng SaaS web app quản lý nhà trọ cho thuê, phục vụ nhiều chủ nhà độc lập. Mỗi chủ nhà có tài khoản riêng, quản lý nhiều nhà, nhiều phòng, nhiều khách thuê, hóa đơn hàng tháng và chỉ số điện/nước.

**Target users**: Chủ nhà có từ 1–50+ nhà trọ, muốn số hóa việc quản lý thay vì dùng giấy tờ/Excel.

**Success criteria**:
- Chủ nhà có thể đăng ký, tạo nhà + phòng, thêm khách thuê và xuất hóa đơn trong vòng 10 phút
- Hóa đơn có link public gửi được qua Zalo/SMS mà không cần khách đăng nhập
- Dashboard hiển thị doanh thu, chi phí, lợi nhuận theo tháng/năm

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui |
| Backend | FastAPI (Python 3.12+), SQLModel |
| Database | PostgreSQL 16 |
| Migrations | Alembic |
| Auth | Clerk (frontend SDK + backend JWT verification) |
| PDF | Jinja2 + WeasyPrint (HTML→PDF server-side) |
| Package manager | uv (backend), pnpm (frontend) |
| Deploy | Frontend: Vercel · Backend: Railway / Render |

**Auth flow với Clerk**:
- Frontend: `@clerk/nextjs` — `ClerkProvider`, `useAuth`, middleware bảo vệ routes
- Backend: verify Clerk JWT token qua `clerk-backend` SDK hoặc JWKS endpoint
- `clerk_user_id` (string) thay `owner_id` (int) để liên kết dữ liệu với user Clerk
- Không lưu password trong DB — Clerk quản lý hoàn toàn

**Lý do chọn SQLModel**: Kết hợp SQLAlchemy core + Pydantic v2 — type-safe, ít boilerplate, tương thích hoàn toàn với FastAPI.

---

## 3. Core Features (MVP)

### 3.1 Auth & Multi-tenant
- Đăng ký / đăng nhập / quản lý session do **Clerk** xử lý hoàn toàn
- Backend nhận `clerk_user_id` từ JWT, dùng làm khóa phân tách dữ liệu
- Mỗi chủ nhà chỉ thấy dữ liệu của mình (row-level isolation qua `clerk_user_id`)

### 3.2 Quản lý Nhà (`Property`)
- CRUD nhà trọ: tên, địa chỉ, mô tả
- Một chủ nhà có nhiều nhà

### 3.3 Quản lý Phòng (`Room`)
- CRUD phòng: số phòng, tầng, diện tích, giá thuê, tiền cọc
- Đơn giá điện/nước riêng theo phòng (kế thừa từ nhà nếu không cấu hình riêng)
- Trạng thái: `vacant` | `occupied` | `maintenance`

### 3.4 Quản lý Khách thuê (`Tenant`) & Hợp đồng (`Contract`)
- Thông tin khách: họ tên, CCCD, SĐT, email, ngày sinh
- Hợp đồng: ngày bắt đầu/kết thúc, giá thuê thỏa thuận, tiền cọc, số người ở
- Một phòng có tối đa một contract đang `active`

### 3.5 Chỉ số Điện/Nước (`UtilityReading`)
- Nhập chỉ số cuối kỳ theo phòng + tháng
- **Tự động điền số đầu kỳ**: số cuối kỳ trước (`elec_curr` tháng N-1) tự động trở thành số đầu kỳ (`elec_prev` tháng N) khi tạo reading mới
- Nếu chưa có reading kỳ trước (phòng mới), cho phép nhập thủ công
- Tính tiền điện/nước tự động khi tạo hóa đơn: `(curr - prev) × rate`

### 3.6 Hóa đơn (`Invoice`)
- Tạo hóa đơn hàng tháng gồm:
  - Tiền thuê (từ contract)
  - Tiền điện + nước (từ UtilityReading)
  - **Phụ phí linh hoạt** (`SurchargeTemplate`): chủ nhà định nghĩa các loại phụ phí với cách tính:
    - `per_room` — phí cố định mỗi phòng (VD: phí dịch vụ, wifi, rác)
    - `per_person` — phí tính theo số người trong hợp đồng (VD: phí giữ xe, phí vệ sinh)
  - Phụ phí được áp dụng tự động khi generate hóa đơn, có thể chỉnh sửa trước khi gửi
- Trạng thái: `draft` | `sent` | `paid` | `overdue`
- Xuất PDF (Jinja2 template → WeasyPrint)
- Sinh link public không cần đăng nhập: `/invoice/public/{token}`
- Copy link gửi qua Zalo/SMS

### 3.7 Dashboard & Báo cáo
- Tổng quan: phòng trống/có người, hóa đơn chưa thanh toán, hợp đồng sắp hết hạn
- Biểu đồ doanh thu theo tháng/năm
- Thống kê chi phí, lợi nhuận ước tính

---

## 4. Data Model (PostgreSQL + SQLModel)

```
Property          — id, clerk_user_id, name, address, description,
                    default_elec_rate, default_water_rate

Room              — id, property_id→Property, room_number, floor, area_m2,
                    rent_price, deposit, status, elec_rate, water_rate
                    # elec_rate/water_rate NULL = kế thừa từ Property

Tenant            — id, clerk_user_id, full_name, id_number, phone, email, dob

Contract          — id, room_id→Room, tenant_id→Tenant, start_date, end_date,
                    agreed_rent, deposit_paid, num_people, status(active|ended)

UtilityReading    — id, room_id→Room, period(YYYY-MM),
                    elec_prev, elec_curr,     # elec_prev auto-filled từ kỳ trước
                    water_prev, water_curr,
                    is_prev_auto(bool)        # flag: số đầu kỳ được tự động điền

SurchargeTemplate — id, clerk_user_id, name, amount, calc_type(per_room|per_person),
                    is_active

Invoice           — id, contract_id→Contract, period(YYYY-MM),
                    rent_amount, elec_amount, water_amount, total,
                    status, public_token(uuid), due_date, paid_at

InvoiceItem       — id, invoice_id→Invoice, description, amount, unit_price,
                    quantity, item_type(rent|elec|water|surcharge)
```

---

## 5. Project Structure

```
rental-system/
├── frontend/                           # Next.js 15
│   ├── app/
│   │   ├── (auth)/                     # Clerk sign-in/sign-up pages
│   │   ├── (dashboard)/                # protected routes (Clerk middleware)
│   │   │   ├── page.tsx                # dashboard overview
│   │   │   ├── properties/
│   │   │   ├── rooms/
│   │   │   ├── tenants/
│   │   │   ├── invoices/
│   │   │   └── settings/
│   │   └── invoice/public/[token]/     # public invoice (no auth)
│   ├── components/
│   │   ├── ui/                         # shadcn/ui
│   │   └── app/                        # domain components
│   ├── lib/
│   │   ├── api.ts                      # fetch wrapper với Clerk token
│   │   └── utils.ts
│   ├── middleware.ts                    # Clerk route protection
│   └── types/                          # TypeScript interfaces
│
├── backend/                            # FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py                 # SQLModel engine + AsyncSession
│   │   ├── models/                     # SQLModel table=True models
│   │   │   ├── property.py
│   │   │   ├── room.py
│   │   │   ├── tenant.py
│   │   │   ├── contract.py
│   │   │   ├── utility.py
│   │   │   ├── invoice.py
│   │   │   └── surcharge.py
│   │   ├── schemas/                    # Pydantic request/response schemas (tách riêng)
│   │   │   ├── property.py             # PropertyCreate, PropertyRead, PropertyUpdate
│   │   │   ├── room.py
│   │   │   ├── tenant.py
│   │   │   ├── contract.py
│   │   │   ├── utility.py
│   │   │   ├── invoice.py
│   │   │   └── surcharge.py
│   │   ├── repositories/               # DB access only, no business logic
│   │   │   ├── property_repo.py
│   │   │   ├── room_repo.py
│   │   │   ├── tenant_repo.py
│   │   │   ├── contract_repo.py
│   │   │   ├── utility_repo.py
│   │   │   ├── invoice_repo.py
│   │   │   └── surcharge_repo.py
│   │   ├── services/                   # Business logic + transaction boundary
│   │   │   ├── property_service.py
│   │   │   ├── invoice_service.py      # tính tiền, auto-fill utility, generate PDF
│   │   │   ├── utility_service.py      # auto prev←curr logic
│   │   │   └── dashboard_service.py
│   │   ├── routers/                    # HTTP layer only: parse request, call service, return response
│   │   │   ├── properties.py
│   │   │   ├── rooms.py
│   │   │   ├── tenants.py
│   │   │   ├── contracts.py
│   │   │   ├── utilities.py
│   │   │   ├── invoices.py
│   │   │   ├── surcharges.py
│   │   │   └── dashboard.py
│   │   ├── dependencies.py             # Annotated dependency aliases
│   │   ├── templates/                  # Jinja2 HTML invoice template
│   │   └── core/
│   │       ├── config.py               # pydantic-settings
│   │       └── clerk.py                # Clerk JWT verification
│   ├── alembic/
│   ├── tests/
│   │   ├── unit/                       # test services
│   │   └── integration/                # test routers với test DB
│   ├── pyproject.toml
│   └── .env.example
│
└── SPEC.md
```

---

## 6. API Design

Prefix: `/api/v1`

```
# Auth — chỉ verify Clerk token, không có register/login endpoint riêng
GET    /auth/me                         # trả profile từ Clerk JWT

GET    /properties
POST   /properties
GET    /properties/{id}
PUT    /properties/{id}
DELETE /properties/{id}
GET    /properties/{id}/rooms

POST   /rooms
GET    /rooms/{id}
PUT    /rooms/{id}
DELETE /rooms/{id}

GET    /tenants
POST   /tenants
GET    /tenants/{id}
PUT    /tenants/{id}

POST   /contracts
GET    /contracts/{id}
PUT    /contracts/{id}/end

POST   /utility-readings               # auto-fill elec_prev/water_prev từ kỳ trước
GET    /rooms/{id}/utility-readings

GET    /surcharges                     # list SurchargeTemplate của user
POST   /surcharges
PUT    /surcharges/{id}
DELETE /surcharges/{id}

GET    /invoices
POST   /invoices/generate              # tính toán từ contract + utility + surcharges
GET    /invoices/{id}
PUT    /invoices/{id}                  # chỉnh sửa draft
PUT    /invoices/{id}/status
GET    /invoices/{id}/pdf
GET    /invoices/public/{token}        # no auth

GET    /dashboard/summary
GET    /dashboard/revenue?year=&month=
```

---

## 7. Code Style & Architecture

### Backend — Layered Architecture

```
Router → Service → Repository → Model
```

**Nguyên tắc từng layer:**

**Router** (`routers/`)
- Chỉ làm: parse request body/params, gọi service, trả response schema
- Không chứa business logic, không gọi repository trực tiếp
- Không tự mở transaction

**Service** (`services/`)
- Chứa toàn bộ business logic
- **Quyết định transaction boundary** — gọi `await self.session.commit()` sau mỗi write operation
- **Không dùng `async with session.begin()`** — conflict với asyncpg khi autobegin đã active
- `get_session` tự rollback khi exception — service không cần tự rollback
- Gọi một hoặc nhiều repository rồi commit một lần ở cuối để atomic
- **Raise domain exceptions** từ `app.core.exceptions` — không import `HTTPException` vào service

**Repository** (`repositories/`)
- Chỉ làm việc với database: query, insert, update, delete
- **Không chứa business rule** — không validate, không tính toán
- Nhận `session` từ service (service kiểm soát transaction)
- Mỗi method là một DB operation rõ ràng

**Model** (`models/`)
- SQLModel `table=True` — định nghĩa schema DB
- Không chứa logic

**Schema** (`schemas/`)
- Pydantic models tách riêng cho request/response
- Đặt tên rõ: `PropertyCreate`, `PropertyRead`, `PropertyUpdate`, `PropertyListRead`

---

**Dependency Injection với `Annotated`:**

```python
# dependencies.py
from typing import Annotated
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from app.database import get_session
from app.core.clerk import verify_clerk_token
from app.services.property_service import PropertyService

SessionDep = Annotated[AsyncSession, Depends(get_session)]
CurrentUserDep = Annotated[str, Depends(verify_clerk_token)]  # returns clerk_user_id
PropertyServiceDep = Annotated[PropertyService, Depends()]
# ... một alias cho mỗi service

# Dùng trong router:
@router.get("/properties")
async def list_properties(
    clerk_user_id: CurrentUserDep,
    service: PropertyServiceDep,
) -> list[PropertyRead]:
    ...
```

---

**Ví dụ flow tạo hóa đơn (Service quyết định transaction):**

```python
# services/invoice_service.py
async def generate_invoice(self, contract_id: int, period: str, clerk_user_id: str) -> Invoice:
    contract = await contract_repo.get_by_id(self.session, contract_id)
    _assert_owner(contract, clerk_user_id)  # raises 403 nếu không phải owner

    reading = await utility_repo.get_by_room_period(self.session, contract.room_id, period)
    surcharges = await surcharge_repo.list_active(self.session, clerk_user_id)

    invoice = _calculate(contract, reading, surcharges)  # pure function, không có side effects
    created = await invoice_repo.create(self.session, invoice)
    await self.session.commit()  # commit một lần sau tất cả repo ops
    await self.session.refresh(created)
    return created
```

**Cấu hình `get_session` để auto-rollback:**

```python
# database.py
async def get_session():
    async with AsyncSessionFactory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
```

---

### Frontend
- Server Components mặc định, `"use client"` chỉ khi cần interactivity/hooks
- Không dùng `any` — type đầy đủ
- Form: `zod` + `react-hook-form`
- Data fetching client-side: TanStack Query
- Tên file: `kebab-case.tsx`, component: `PascalCase`
- Clerk token đính kèm mọi API call qua `getToken()` trong `lib/api.ts`

---

## 8. Testing Strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Service unit | pytest | Business logic, tính tiền, auto-fill utility |
| Repository | pytest + test DB | Query correctness |
| Router integration | pytest + httpx + test DB | Full request/response |
| Frontend | Vitest + RTL | Components, hooks |
| E2E (sau MVP) | Playwright | Happy path flows |

**Bắt buộc test trước khi ship**:
- `invoice_service._calculate()` — tiền thuê + điện + nước + phụ phí per_room/per_person
- `utility_service` — auto-fill `elec_prev` = `elec_curr` kỳ trước
- Owner isolation — user A không đọc được dữ liệu user B
- Public invoice endpoint — đúng dữ liệu với valid token, 404 với invalid token

---

## 9. Boundaries

### Always do
- Validate `clerk_user_id` trên **mọi** service method — không để router tự kiểm tra ownership
- Dùng parameterized queries qua SQLModel — không ghép string SQL tay
- Schemas tách riêng khỏi models — không trả ORM object trực tiếp ra router
- Service luôn nhận `clerk_user_id` như tham số tường minh, không đọc từ global state

### Ask first
- Tích hợp bên ngoài mới (Zalo OA, payment gateway, SMS provider)
- Thay đổi data model ảnh hưởng migration phức tạp
- Thêm role mới (admin, nhân viên quản lý)

### Never do
- Import `HTTPException` trong service — dùng `AppException` subclasses thay thế
- Expose thông tin nhạy cảm (CCCD, SĐT đầy đủ) trên public invoice endpoint
- Cho phép unauthenticated access ngoài `/invoices/public/*`
- Gọi repository trực tiếp từ router
- Dùng `async with session.begin()` trong service — conflict với asyncpg autobegin, dùng `await session.commit()` thay thế
- Mở transaction trong repository — transaction là trách nhiệm của service
- Commit `.env` hoặc secrets vào git
