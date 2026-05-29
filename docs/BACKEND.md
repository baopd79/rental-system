# Backend Architecture

Tài liệu này giải thích cách backend hoạt động — convention, pattern, và rule được áp dụng nhất quán trong codebase. Đọc cùng `CLAUDE.md` (rules cho AI) và `backend/README.md` (setup).

---

## 1. Stack và công cụ

| Thành phần | Công nghệ |
|---|---|
| Framework | FastAPI |
| ORM | SQLModel (kế thừa SQLAlchemy + Pydantic) |
| DB | PostgreSQL 16 (async driver: asyncpg) |
| Migrations | Alembic (manual + autogenerate) |
| Auth | Clerk JWT (RS256 verify qua JWKS) |
| Validation | Pydantic v2 |
| Package manager | uv |
| Tests | pytest + pytest-asyncio + httpx |

---

## 2. Cấu trúc thư mục

```
backend/
├── app/
│   ├── main.py                ← FastAPI app, middleware, router include
│   ├── core/
│   │   ├── config.py          ← Settings (env vars)
│   │   ├── database.py        ← Async engine + session factory
│   │   ├── dependencies.py    ← DI wiring (SessionDep, *ServiceDep)
│   │   ├── clerk.py           ← JWT verify (JWKS + dev bypass)
│   │   └── exceptions.py      ← AppException + subclasses
│   ├── models/                ← SQLModel table=True (DB schema)
│   ├── schemas/               ← Pydantic request/response types
│   │   └── _validators.py     ← Shared field validators
│   ├── repositories/          ← DB ops (single-purpose methods)
│   ├── services/              ← Business logic + transaction owner
│   └── routers/               ← HTTP endpoints (parse → service call → return)
│
├── alembic/                   ← Migrations
│   ├── env.py                 ← include_object guard
│   └── versions/              ← Generated migration files
│
├── tests/
│   ├── conftest.py            ← Truncate DB between tests, JWKS bypass
│   ├── integration/           ← Test qua HTTP (ASGITransport + httpx)
│   └── unit/                  ← Test logic thuần (no DB, no HTTP)
│
├── alembic.ini
├── pyproject.toml             ← uv deps + pytest config
└── README.md
```

---

## 3. Layer hierarchy

```
Router → Service → Repository → Model
```

Mỗi layer có trách nhiệm tách biệt. **Không bao giờ skip layer** (router không gọi repo trực tiếp, service không return SQLModel raw).

| Layer | Trách nhiệm | Không được làm |
|---|---|---|
| Router | Parse request, gọi 1 service method, return schema | Business logic, DB access |
| Service | Business logic + transaction (`session.commit`) | Throw `HTTPException` |
| Repository | DB operations (single purpose) | Commit, business rules |
| Model | SQLModel `table=True` (schema + constraints) | Logic, side-effects |

---

## 4. Router — HTTP boundary

Router là layer mỏng nhất. Chỉ làm 3 việc: declare endpoint, inject deps, gọi service.

```python
@router.post("/properties", response_model=PropertyRead, status_code=201)
async def create_property(
    body: PropertyCreate,
    clerk_user_id: CurrentUserDep,
    service: PropertyServiceDep,
):
    return await service.create_property(body, clerk_user_id)
```

**Convention:**
- `response_model=...` để filter response qua Pydantic
- `status_code=201` cho create, `204` cho delete, mặc định 200 cho rest
- `POST` create / `GET` read / `PATCH` partial update / `DELETE` remove
- Dùng **`PATCH`** khi schema có all-optional fields (`XxxUpdate`). `PUT` chỉ dùng khi thay thế toàn bộ resource (hiếm khi)
- Tag router: `APIRouter(tags=["properties"])` để FastAPI gom theo nhóm

---

## 5. Service — business logic + transaction owner

Service là **transaction boundary**. Mọi `session.commit()` xảy ra ở đây, không bao giờ ở repo.

```python
class PropertyService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.property_repo = PropertyRepo(session)
        self.room_repo = RoomRepo(session)

    async def create_property(self, data: PropertyCreate, clerk_user_id: str) -> PropertyRead:
        if await self.property_repo.get_by_name(clerk_user_id, data.name):
            raise ConflictException("Tên nhà trọ đã tồn tại")

        prop = Property(**data.model_dump(), clerk_user_id=clerk_user_id)
        created = await self.property_repo.create(prop)
        await self.session.commit()
        await self.session.refresh(created)
        return PropertyRead.model_validate(created)
```

**Convention:**
- Constructor chỉ nhận `session: AsyncSession`, các repo tạo trực tiếp bên trong (không inject)
- `clerk_user_id` truyền explicit qua từng method — không đọc từ global state
- Raise `AppException` subclass (`NotFoundException`, `ForbiddenException`, `ConflictException`, `BadRequestException`) — **không bao giờ `HTTPException`**
- Ownership guard riêng (`_get_property_owned`, `_get_room_owned`...) trả về entity sau khi check NotFound + Forbidden
- Khi update, dùng `data.model_dump(exclude_unset=True)` để chỉ apply fields client gửi
- Sau commit: `await session.refresh(entity)` để load lại các default từ DB (timestamps, generated IDs)
- Check duplicate trước insert/update để raise `ConflictException(409)` thay vì để DB raise `IntegrityError` → 500

**Cấm:**
- `async with session.begin()` — conflict với asyncpg autobegin
- Commit trong vòng for loop — gom thành 1 commit cuối method

---

## 6. Repository — DB ops only

Mỗi method = 1 thao tác DB. Không có rule nghiệp vụ, không commit.

```python
class SurchargeRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_all_by_property(self, property_id: int) -> list[SurchargeTemplate]:
        result = await self.session.exec(
            select(SurchargeTemplate)
            .where(SurchargeTemplate.property_id == property_id)
            .order_by(SurchargeTemplate.name)
        )
        return list(result.all())

    async def get_by_name(self, property_id: int, name: str) -> SurchargeTemplate | None:
        result = await self.session.exec(
            select(SurchargeTemplate).where(
                SurchargeTemplate.property_id == property_id,
                SurchargeTemplate.name == name,
            )
        )
        return result.first()

    async def create(self, surcharge: SurchargeTemplate) -> SurchargeTemplate:
        self.session.add(surcharge)
        await self.session.flush()
        return surcharge

    async def update(self, surcharge: SurchargeTemplate) -> SurchargeTemplate:
        await self.session.flush()
        return surcharge
```

**Convention:**
- `create`: `session.add()` rồi `session.flush()` để có ID
- `update`: chỉ `session.flush()` — entity đã được track, không cần `add()` lại
- `get_*`: dùng `session.get(Model, id)` cho PK lookup; `select().where(...)` cho query khác
- `get_all_*`: luôn có `ORDER BY` để kết quả deterministic
- Query phức tạp (JOIN) trả về `list[dict]` qua `result.mappings().all()` thay vì SQLModel object để tránh N+1
- Raw SQL (cho dashboard, billing): dùng `sqlalchemy.text()` với named params; date so sánh truyền `datetime.date` (không phải string — asyncpg không auto-cast)

**Cấm:**
- `session.commit()` — transaction là của service
- Business rule (check duplicate, validate, etc.) — đó là việc của service

---

## 7. Model — SQLModel table

Model chỉ định nghĩa schema DB. Không có method nghiệp vụ.

```python
class SurchargeTemplate(SQLModel, table=True):
    __tablename__ = "surcharge_template"
    __table_args__ = (
        UniqueConstraint("property_id", "name", name="uq_surcharge_property_name"),
    )

    id: int | None = Field(default=None, primary_key=True)
    property_id: int = Field(foreign_key="property.id", index=True)
    name: str = Field(min_length=1, max_length=150)
    calc_type: SurchargeCalcType
    amount: Decimal = Field(decimal_places=0, max_digits=12)
```

**Convention:**
- `__tablename__` snake_case singular: `property`, `room`, `surcharge_template`
- PK: `id: int | None = Field(default=None, primary_key=True)`
- FK: `Field(foreign_key="<table>.<col>", index=True)` — luôn index FK để JOIN nhanh
- String: luôn set `max_length`. Required: thêm `min_length=1`. Optional: dùng `str | None`
- `UniqueConstraint` đặt tên rõ ràng: `uq_<table>_<cols>`
- Enums: dùng `class Foo(str, Enum)` để serialize ra string

**Enum-as-string trick** (cho enum nhỏ, ít rotate):

```python
class ContractEventType(str, Enum):
    created = "created"
    rent_changed = "rent_changed"

class ContractEvent(SQLModel, table=True):
    event_type: str = Field(max_length=30)  # store as str, không tạo PG enum type
```

Service/schema dùng `ContractEventType` cho type-safety nhưng DB column là plain VARCHAR — tránh phải migration `ALTER TYPE` khi thêm value mới.

**Cấm:**
- Validation logic trong model — đó là việc của schema
- Computed properties phức tạp — tính ở service rồi pass vào schema

---

## 8. Schema — Pydantic + shared validators

Schemas tách biệt khỏi model. Mỗi entity có 3 dạng: `XxxCreate`, `XxxUpdate`, `XxxRead`.

```python
class SurchargeCreate(BaseModel):
    name: str
    calc_type: SurchargeCalcType
    amount: Decimal

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v: object) -> object:
        return strip_required(v) if isinstance(v, str) else v

    @field_validator("amount", mode="before")
    @classmethod
    def validate_amount(cls, v: object) -> object:
        return non_negative(v)

class SurchargeUpdate(BaseModel):
    name: str | None = None
    calc_type: SurchargeCalcType | None = None
    amount: Decimal | None = None
    # Update dùng strip_optional thay vì strip_required

class SurchargeRead(BaseModel):
    id: int
    property_id: int
    name: str
    calc_type: SurchargeCalcType
    amount: Decimal
    model_config = {"from_attributes": True}
```

**Shared validators** trong `schemas/_validators.py`:

| Helper | Mục đích |
|---|---|
| `strip_required(v)` | Strip whitespace; raise nếu blank → cho Create |
| `strip_optional(v)` | Strip; raise nếu blank string được gửi → cho Update (None thì OK, blank thì không) |
| `strip_to_none(v)` | Strip; chuyển blank thành None → cho truly optional field |
| `non_negative(v)` | Reject `< 0` → cho tiền tệ (rent, deposit, rate, amount) |
| `positive(v)` | Reject `<= 0` → cho đại lượng phải dương (area, num_people) |

**Convention:**
- `XxxCreate`: required fields không default, optional có `| None = None`
- `XxxUpdate`: tất cả `| None = None` để hỗ trợ partial update (`exclude_unset=True` ở service)
- `XxxRead`: bao gồm field DB-generated (id, created_at), set `model_config = {"from_attributes": True}` để load từ SQLModel
- Validator `mode="before"` để chạy trước khi Pydantic coerce type
- Cross-field invariant (vd `end_date > start_date`): dùng `@model_validator(mode="after")`

---

## 9. Dependency Injection

DI wiring tập trung 1 chỗ: `app/core/dependencies.py`.

```python
SessionDep = Annotated[AsyncSession, Depends(get_session)]
CurrentUserDep = Annotated[str, Depends(verify_clerk_token)]

def _surcharge_service(session: SessionDep) -> SurchargeService:
    return SurchargeService(session)

SurchargeServiceDep = Annotated[SurchargeService, Depends(_surcharge_service)]
```

Router consume bằng type alias:

```python
async def list_surcharges(
    property_id: int,
    clerk_user_id: CurrentUserDep,
    service: SurchargeServiceDep,
):
    ...
```

**Tại sao service tự tạo repo (không inject)?**
- Repo chỉ là thin wrapper quanh `session`, không có state riêng
- Inject từng repo sẽ phình `dependencies.py` lên N×M dòng
- Trade-off: khó mock repo cho unit test thuần — nhưng codebase này dùng integration test (real DB) nên không cần

**Cấm:**
- `Depends()` trong service constructor — DI chỉ ở `dependencies.py`
- Global state cho user — `clerk_user_id` luôn truyền explicit qua method param

---

## 10. Auth — Clerk JWT

```python
async def verify_clerk_token(credentials: HTTPAuthorizationCredentials = Security(_bearer)) -> str:
    if credentials is None:
        raise UnauthorizedException("Missing authorization header")
    token = credentials.credentials

    if not settings.CLERK_JWKS_URL:  # dev mode: skip signature verify
        payload = jwt.decode(token, key="", algorithms=["HS256", "RS256"],
                             options={"verify_signature": False})
        return payload["sub"]

    jwks = await _get_jwks()  # cached module-level
    payload = jwt.decode(token, jwks, algorithms=["RS256"],
                         audience=settings.CLERK_AUDIENCE or None,
                         options={"verify_aud": bool(settings.CLERK_AUDIENCE)})
    return payload["sub"]
```

**Production flow:**
1. Frontend gửi `Authorization: Bearer <jwt>` cho mọi request
2. Backend fetch JWKS từ Clerk (cache module-level, không có TTL hiện tại)
3. Verify RS256 signature → extract `sub` → đó là `clerk_user_id`

**Dev/test:** khi `CLERK_JWKS_URL=""`, skip verify hoàn toàn — tests dùng `jwt.encode({"sub": user_id}, key="test", algorithm="HS256")` thoải mái.

**Lưu ý:**
- Public endpoint `/invoices/public/{token}` không yêu cầu auth — token là `public_token` riêng của invoice, không phải JWT
- Tất cả endpoint khác bắt buộc `CurrentUserDep`
- Không expose PII (CCCD, phone) trên public endpoint

---

## 11. Exception handling

Tất cả lỗi nghiệp vụ raise qua `AppException` subclass. `main.py` có 1 handler chung convert ra JSON:

```python
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
```

| Exception | HTTP | Khi nào dùng |
|---|---|---|
| `NotFoundException` | 404 | Resource không tồn tại |
| `ForbiddenException` | 403 | User không sở hữu resource |
| `ConflictException` | 409 | Duplicate (UNIQUE), state conflict |
| `BadRequestException` | 400 | Business rule violated (vd: contract đã end, chỉ số âm) |
| `UnauthorizedException` | 401 | Token thiếu/sai |

**Pydantic validation lỗi** → FastAPI auto trả 422 (không cần custom handler).

**Convention:**
- Schema-level (định dạng dữ liệu) → 422
- Service-level (rule nghiệp vụ) → 400
- Ownership/duplicate → 403/409
- **Không** `raise HTTPException` trong service

---

## 12. Database & Migrations

**Setup:** `docker compose up -d` chạy PostgreSQL 16 trên `:5432`. Connection string trong `app/core/config.py`.

**Session lifecycle** (`get_session`):
- Mỗi request mở 1 session từ `AsyncSessionFactory`
- Auto rollback nếu exception, commit là việc của service
- `expire_on_commit=False` để object sau commit vẫn dùng được

### Workflow migration

```bash
# 1. Sửa model
# 2. Đăng ký model mới trong app/models/__init__.py (cho Alembic detect)
uv run alembic revision --autogenerate -m "describe change"
# 3. Review file generated, sửa nếu cần
uv run alembic upgrade head
```

**`include_object` guard** (`alembic/env.py`): bỏ qua tables không có trong `SQLModel.metadata` — tránh autogenerate sinh ra `op.drop_table(...)` cho bảng "lạ" (vd legacy table).

### Migration safety checklist

Trước khi `upgrade head`, phân loại migration:

| Mức | Ví dụ | Action |
|---|---|---|
| **Safe** | Add nullable column, add column với default, add index, validator-only | Apply trực tiếp |
| **Check data** | Add UNIQUE, add NOT NULL không default, add CHECK | Query DB check conflicts trước |
| **Dangerous** | Drop/rename column (code cũ còn ref) | Cần migration 2 bước (deprecate → release → remove) |

**Check UNIQUE conflict trước upgrade:**

```sql
SELECT <col1>, <col2>, COUNT(*) FROM <table>
GROUP BY <col1>, <col2> HAVING COUNT(*) > 1;
```

**Check NOT NULL với existing data:**

```sql
SELECT COUNT(*) FROM <table> WHERE <col> IS NULL;
```

**VARCHAR length** không được Alembic autogenerate detect (VARCHAR ↔ VARCHAR(N) cùng type) → phải thêm `op.alter_column` tay:

```python
op.alter_column('surcharge_template', 'name',
    existing_type=sa.String(), type_=sa.String(length=150),
    existing_nullable=False)
```

**Enum value mới:** `op.execute("ALTER TYPE enumname ADD VALUE IF NOT EXISTS 'value'")` — không có downgrade.

### DB reset (dev only)

```bash
docker exec rental-system-postgres-1 psql -U postgres -d rental_db -c "
TRUNCATE TABLE contract_event, shared_meter_reading, shared_meter_room, shared_meter,
  invoice_item, invoice, surcharge_template, utility_reading, contract, tenant, room,
  property RESTART IDENTITY CASCADE;"
```

---

## 13. Domain logic — billing

### Utility reading periods

- `UtilityReading.period = "YYYY-MM"` = **invoice month** (không phải reading-taken month)
- Frontend UI "Ghi chỉ số" hiển thị reading-month; gọi API với `nextPeriod(displayPeriod)`
- Invoice cho period M dùng reading period M: `electricity = elec_curr(M) - elec_prev(M)`, với `elec_prev(M)` auto-fill từ `elec_curr(M-1)` **cùng contract**

### Move-in reading

`ContractCreate.initial_elec_curr` (required) → tạo reading cho start month với `elec_prev = elec_curr = initial`. Landlord sau đó nhập `elec_curr` thật qua billing UI.

- `curr == prev` → 0 consumption (tenant chưa dùng)
- `curr > prev` → tenant đã dùng điện trước khi hết period
- Cả 2 đều hợp lệ

### Tenant isolation trong readings

`UtilityReading.contract_id` link reading với contract đã tạo nó. Billing service:
- `elec_prev` chỉ auto-fill từ tháng trước **nếu cùng contract**
- Month-skip guard cũng chỉ enforce trong cùng contract — tenant cũ có gap không block tenant mới

**Cấm:**
- Dùng `utility_reading` của tenant cũ làm `elec_prev` cho tenant mới — luôn check `contract_id` khớp

### Proration

`_prorate_factor(start_date, end_date, period)` trong `invoice_service.py` áp dụng cho:
- Rent
- Fixed surcharges (per_room, per_person)

**Không prorate:**
- Meter-based utilities (điện, nước per_meter) — đo theo chỉ số thực

### Water calc types

| `property.water_calc_type` | Tính tiền nước |
|---|---|
| `per_meter` | Theo m³ đo được (`water_curr - water_prev`) |
| `per_person` | Flat × `contract.num_people` |
| `per_room` | Flat / phòng |

### Invoice status flow

```
draft → sent → paid
```

- Chỉ `draft` mới được delete/edit
- Không end contract khi còn invoice unpaid (`draft`/`sent`)
- `paid` không quay lại được

### Contract events

`ContractService` log events vào `contract_event`: `created`, `rent_changed`, `people_changed`, `ended`. Surface qua `GET /contracts/{id}/events`.

### Invoice detail

`GET /invoices/{id}` trả `InvoiceDetailRead` — extend `InvoiceListRead` với `tenant_phone`, `elec_prev`, `elec_curr`, `water_prev`, `water_curr` từ `utility_reading` tương ứng.

---

## 14. Testing

### Setup

```python
# tests/conftest.py
os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres:postgres@localhost:5432/rental_test_db"

@pytest.fixture(autouse=True)
async def truncate():
    await truncate_db()  # before mỗi test
```

- Test DB riêng (`rental_test_db`)
- Truncate tất cả bảng giữa các tests (không có rollback transaction trick)
- JWKS bypass: `CLERK_JWKS_URL=""` → tests gen JWT bằng `jwt.encode({"sub": user_id}, key="test", algorithm="HS256")`

### Cấu trúc test

| Loại | Vị trí | Cách test |
|---|---|---|
| Unit | `tests/unit/` | Test hàm pure (invoice calculation, period helpers) |
| Integration | `tests/integration/` | Gọi qua HTTP với `httpx.AsyncClient(transport=ASGITransport(app=app))` |

### Pattern helper

```python
USER_A = "user_property_a"
USER_B = "user_property_b"

def auth_headers(user_id: str) -> dict:
    token = jwt.encode({"sub": user_id}, key="test", algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}

async def create_property(client, user_id):
    r = await client.post("/api/v1/properties", json={...}, headers=auth_headers(user_id))
    return r.json()
```

Mỗi test module tự define helpers cho entity của nó. Pattern thường gặp:
- `create_property` → trả `prop` dict
- `create_room(client, user_id, property_id)` → trả `room`
- `setup_property_room_contract(client, user_id)` → end-to-end setup

### Run

```bash
uv run pytest -v                                # all
uv run pytest tests/unit/test_foo.py::test_bar  # single test
uv run pytest -v -k surcharge                   # by keyword
```

### Test isolation

- 2 users (`USER_A`, `USER_B`) per module để test ownership/forbidden
- Naming convention `test_<action>_<expected>`: `test_create_room_other_user_returns_403`

---

## 15. Common patterns

### 15.1. Ownership guard

Mỗi entity có method `_get_<entity>_owned(id, clerk_user_id)` riêng:

```python
async def _get_property_owned(self, property_id: int, clerk_user_id: str) -> Property:
    prop = await self.property_repo.get_by_id(property_id)
    if not prop:
        raise NotFoundException("Property not found")
    if prop.clerk_user_id != clerk_user_id:
        raise ForbiddenException()
    return prop
```

Gọi đầu mỗi service method cần đọc/sửa entity đó.

### 15.2. Duplicate-name check

Khi có `UniqueConstraint`, service check trước insert/update:

```python
# Create
if await self.surcharge_repo.get_by_name(property_id, data.name):
    raise ConflictException("Tên phụ phí đã tồn tại")

# Update — chỉ check khi name thực sự đổi
if data.name is not None and data.name != surcharge.name:
    if await self.surcharge_repo.get_by_name(surcharge.property_id, data.name):
        raise ConflictException("Tên phụ phí đã tồn tại")
```

Mục đích: trả `409 Conflict` thay vì để DB `IntegrityError` lan ra → 500.

### 15.3. JOIN tránh N+1

Khi list cần dữ liệu từ 2 bảng, query JOIN trả về `list[dict]` thay vì loop `get_by_id`:

```python
async def get_all_by_room_with_tenant(self, room_id: int) -> list[dict]:
    result = await self.session.exec(text("""
        SELECT c.id, c.room_id, ..., t.id AS t_id, t.full_name, t.phone
        FROM contract c JOIN tenant t ON t.id = c.tenant_id
        WHERE c.room_id = :room_id ORDER BY c.start_date DESC
    """), params={"room_id": room_id})
    return [dict(row) for row in result.mappings().all()]
```

Service rebuild model object từ dict khi cần serialize.

### 15.4. Partial update với `exclude_unset`

```python
for field, value in data.model_dump(exclude_unset=True).items():
    setattr(entity, field, value)
```

Chỉ áp dụng fields client gửi — field không gửi không bị wipe về None.

### 15.5. Refresh sau commit

```python
await self.session.commit()
await self.session.refresh(created)
```

Refresh để load DB-generated values (timestamps, defaults) trước khi serialize.

---

## 16. Anti-patterns — Never do

| ❌ | ✅ |
|---|---|
| `raise HTTPException(...)` trong service | `raise BadRequestException(...)` |
| `async with session.begin():` trong service | Để asyncpg autobegin + `await session.commit()` cuối method |
| `await session.commit()` trong repo | Repo chỉ `flush()`, commit là việc của service |
| `Depends()` trong service `__init__` | DI ở `core/dependencies.py` |
| Đọc user từ global state (`request.state.user_id`) | Truyền `clerk_user_id: str` explicit qua mỗi method |
| Lấy `utility_reading` cũ của tenant trước làm `elec_prev` cho tenant mới | Check `contract_id` khớp |
| Trả CCCD/SĐT trên `/invoices/public/*` | Schema `InvoicePublicRead` filter PII out |
| `PUT` cho schema all-optional | `PATCH` |
| Skip migration safety check khi thêm UNIQUE/NOT NULL | Query check duplicates/nulls trước upgrade |
| Loop `get_by_id` trong list method | JOIN qua raw SQL trả `list[dict]` |
| `session.add(entity)` trong `update()` | Entity đã được track sau `get_by_id`, chỉ cần `flush()` |
| `select(func.count())` không có column | `select(func.count(Entity.id))` |

---

## Liên kết

- `CLAUDE.md` — rules ngắn cho AI assistant
- `docs/FRONTEND.md` — kiến trúc Next.js phía client
- `docs/SPEC.md` / `docs/PLAN.md` / `docs/TODO.md` — yêu cầu nghiệp vụ + roadmap
- `backend/README.md` — setup môi trường local
