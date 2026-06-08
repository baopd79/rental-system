# VnRental — Interview Preparation

**VnRental — Multi-tenant Rental Management SaaS** · [github.com/baopd79/rental-system](https://github.com/baopd79/rental-system) · [Live demo](https://vnrental.vercel.app)

A multi-tenant SaaS to manage properties, rooms, tenants, contracts, utility readings, invoices, and public invoice links.

Tech: FastAPI, SQLModel, PostgreSQL, Next.js, TypeScript, Clerk, Alembic, Vercel, Render

---

Câu hỏi phỏng vấn dự kiến cho 4 bullets trong CV, cùng câu trả lời dựa trên decision/incident thực tế từ project. Mỗi câu trả lời được neo vào file/dòng cụ thể trong codebase để bạn defend được khi bị hỏi sâu.

---

## CV bullets being defended

1. Implemented Clerk JWT auth with JWKS caching + key-rotation refresh, issuer/audience validation, and fail-closed production config, propagating row-level multi-tenant isolation through FK chains rooted at the property table
2. Designed monthly billing engine with contract-scoped previous readings, partial-month proration, configurable surcharges, and shared-meter electricity splitting across multi-occupant rooms
3. Built immutable invoice snapshots preserving rent/utility/surcharge values across later config changes, paired with token-based public invoice links that expose tenant-safe data without authentication
4. Enforced service-owned transactions and domain-exception boundaries within a strict Router → Service → Repository architecture; broke into raw SQL only on billing/dashboard reads to avoid N+1, verified by 125 integration tests against a real PostgreSQL instance

---

## Section A — Tech stack

### Q1. Tại sao chọn FastAPI thay vì Django / Flask?

**A.** Async-native cho IO-bound workload (JWKS fetch, Postgres async via asyncpg), Pydantic-based schema validation tích hợp sẵn, OpenAPI schema auto-generated cho frontend. Đã quen với type hint nên SQLModel (Pydantic + SQLAlchemy) phù hợp hơn DRF.

**Follow-up "Tại sao không Django?":** Django ORM sync, async hỗ trợ hạn chế (phải dùng `sync_to_async`); admin của Django không cần thiết vì frontend là Next.js riêng; ORM của Django thiếu typed model — Pydantic + SQLModel cho typed schema end-to-end.

---

### Q2. Tại sao SQLModel chứ không phải SQLAlchemy thuần?

**A.** SQLModel = SQLAlchemy + Pydantic trong một class. Model dùng để DB ORM (`table=True`) và schema dùng để I/O (Pydantic-only) chia sẻ cùng type definitions. Giảm boilerplate. Nhưng khi cần raw SQL phức tạp (billing aggregation), vẫn dùng `sqlalchemy.text()` trực tiếp — SQLModel không cản trở.

**Follow-up "Hạn chế của SQLModel?":** Migration autogenerate đôi khi thiếu detect index/constraint changes, phải review file migration tay. Quan hệ many-to-many giữa các SQLModel còn hơi awkward — đã giải quyết bằng cách tạo association table thủ công (`shared_meter_room`).

---

### Q3. Tại sao PostgreSQL thay vì MySQL / MongoDB?

**A.** Dữ liệu có quan hệ chặt (contract → tenant → room → property), cần FK constraint thật, transaction ACID, enum type ở DB level (`invoicestatus`, `contractstatus`). Postgres có `text()` aggregation mạnh cho dashboard reads. Neon serverless Postgres ở production = scale-to-zero + branching.

**Follow-up "MongoDB cho meter reading thì sao?":** Reading là time-series có cấu trúc cứng (period + room_id + values) — schema không cần linh hoạt. UNIQUE constraint `(room_id, period)` ở DB level chống duplicate đáng tin cậy hơn application-level check.

---

### Q4. Tại sao Clerk thay vì tự build auth?

**A.** Tự build secure auth tốn thời gian không tỉ lệ với value cho landlord SaaS: cần email verification, password reset, OAuth providers, session management. Clerk lo hết, mình chỉ verify JWT phía backend. Trade-off: vendor lock-in về user data — chấp nhận được cho MVP.

**Follow-up "Migrate khỏi Clerk thì sao?":** User identity chỉ là `clerk_user_id` string ở `property.clerk_user_id`. Migrate = export user → import sang IdP mới → map ID. Không có user data nhạy cảm bị khóa trong Clerk.

---

## Section B — Bullet 1: Auth & Multi-tenant Isolation

### Q5. Giải thích JWKS caching + key-rotation refresh

**A.** Clerk ký JWT bằng RS256 với private key, expose public key qua JWKS endpoint. Mỗi key có `kid` (key ID) trong JWT header. Clerk rotate key định kỳ → JWKS thay đổi.

Implementation (`app/core/clerk.py`):

- Cache JWKS toàn bộ với TTL 1h (`_JWKS_TTL_SECONDS = 3600`).
- Khi decode JWT, đọc `kid` từ header → check có trong cache không.
- Nếu `kid` không có → **force refresh JWKS một lần**, thử lại với set mới.
- Nếu vẫn không có → fail.

**Vì sao cần force refresh on kid-miss?** Nếu chỉ cache theo TTL, Clerk rotate key giữa chừng → token mới có kid mới mà cache cũ chưa có → reject token hợp lệ trong cả 1 tiếng. Với refresh on miss, downtime = 0.

**Follow-up "Tại sao TTL = 1h?":** Trade-off giữa freshness và load lên JWKS endpoint. Quá ngắn → fetch nhiều. Quá dài → revocation/rotation lag. 1h là default an toàn — kết hợp với refresh-on-miss đã handle rotation rồi, TTL chỉ là safety floor.

**Follow-up "Race condition khi nhiều request cùng refresh?":** Có `_jwks_lock` (asyncio.Lock) + double-check pattern: lấy lock → check lại có fresh chưa → mới fetch. Tránh thundering herd.

---

### Q6. "Fail-closed production config" nghĩa là gì?

**A.** Nếu `CLERK_JWKS_URL` không được set và `AUTH_DEV_MODE` không bật → server **không** cho phép request nào đi qua. Response 401 `"Auth not configured"`.

Điều này quan trọng vì failure mode mặc định trong nhiều framework là fail-open: thiếu config → skip verification → cho qua. Đây là footgun nguy hiểm: deploy sai env var = mở toang API.

**Follow-up "AUTH_DEV_MODE là gì?":** Boolean env var, khi `true` thì skip signature verification (decode JWT mà không verify). Chỉ dùng local. Log WARNING ở startup để dev không quên. **Không bao giờ derive dev-mode từ "missing config"** — phải opt-in explicit.

---

### Q7. JWT decode lỗi, response trả về gì?

**A.** Tất cả decode error (expired, invalid signature, malformed header, missing sub claim) đều return generic `"Invalid token"` cho client. Chi tiết log server-side ở WARNING level.

**Vì sao?** Tránh leak thông tin cho attacker: "signature invalid" vs "token expired" vs "kid not found" tiết lộ trạng thái server. Generic message → attacker không biết token sai ở đâu. Còn bản thân mình debug được qua server log.

---

### Q8. Multi-tenant isolation ở DB schema như thế nào?

**A.** Chỉ duy nhất bảng `property` có cột `clerk_user_id`. Tất cả bảng khác (`room`, `contract`, `tenant`, `invoice`, `utility_reading`, ...) **không** có cột này — chúng inherit ownership thông qua FK chain:

```
property (clerk_user_id) ← room ← contract ← invoice
                       ← shared_meter
                       ← surcharge_template
```

Mọi service method nhận `clerk_user_id` explicit, repository join về `property` để filter.

**Follow-up "Tại sao không denormalize clerk_user_id vào tất cả bảng?":**

- Single source of truth — đổi owner của property chỉ phải update 1 chỗ.
- FK chain tự enforce: không thể tạo `room` mà không có `property` hợp lệ.
- Trade-off: query phải JOIN qua property. Đã verify Postgres index `property.clerk_user_id` đủ nhanh, không cần denorm sớm.

**Follow-up "Lỡ tay quên filter clerk_user_id ở 1 endpoint thì sao?":** Đây là risk thực tế. Mitigation: code review + integration test `test_auth.py` test cross-user data leak (user A query không thấy data user B). Đã viết test này.

---

### Q9. Lỡ có endpoint không cần auth thì sao?

**A.** Chỉ duy nhất `/invoices/public/{token}` là unauthenticated — cho tenant xem hóa đơn không cần login. Endpoint này:

- Match invoice theo `public_token` (uuid4).
- Response **không include** CCCD, số điện thoại tenant.
- Vẫn return rent, utility breakdown, total — đủ để tenant verify số tiền.

Tất cả endpoint khác đòi `CurrentUserDep` (FastAPI dependency). Nếu thiếu = endpoint không tồn tại với FastAPI router design.

---

## Section C — Bullet 2: Billing Engine

### Q10. Period-keyed reading là gì?

**A.** `utility_reading.period = "YYYY-MM"` = **tháng hóa đơn**, không phải tháng đọc số. Nghĩa là reading của period "2026-05" được dùng để tính hóa đơn tháng 5.

Công thức tính tiền điện cho period M:

```
electricity = elec_curr(M) - elec_prev(M)
elec_prev(M) tự fill từ elec_curr(M-1) khi tạo reading mới
```

**Tại sao lưu cả prev và curr trong cùng 1 row (thay vì chỉ lưu curr, derive prev = curr(M-1))?**

1. **Self-contained calculation.** Bill cho period M = `curr - prev` ngay trong 1 row, không phải JOIN/lookup row tháng khác. Quan trọng cho list endpoint — không sinh N+1 khi render bảng readings.

2. **`prev` là frozen historical fact, không phải derived value.** Đây là số công tơ thật landlord đọc tại thời điểm bắt đầu kỳ M. Nếu derive từ `curr(M-1)`, mình đang **giả định chuỗi reading liên tục** — sai khi có gap (tenant cũ chuyển đi tháng 4, tenant mới vào tháng 6: `prev(6)` của tenant mới không phải `curr(4)` của tenant cũ).

3. **Naturally handles tenant turnover.** Tenant mới chuyển vào → reading move-in có `prev = curr = số_công_tơ_lúc_dọn_vào`. Row tự đủ, không cần đi tìm "previous reading của room này" rồi check "có thuộc contract mới không".

4. **Legal record bất biến.** Row của period M là bằng chứng "tenant này đã được bill từ chỉ số X tới chỉ số Y". Kết hợp với invoice_item snapshot (bullet 3) để hóa đơn lịch sử không bao giờ bị recompute.

**Follow-up "Có rule chặn edit reading tháng cũ rồi, sao còn cần lưu prev?":** Rule no-edit-past-month (`billing_service.py:222-246` — block edit period M nếu period M+1 đã có reading, hoặc invoice của M đã tạo) là **guard bảo vệ design** này, không phải lý do design tồn tại. Cả khi không có rule đó, 4 lý do trên vẫn đứng vững — đặc biệt là tenant turnover (cần `prev` explicit, không derive được).

**Follow-up "Trade-off?":** Redundancy: `curr` của period N = `prev` của period N+1 trong cùng contract (lưu trùng giá trị ở 2 row). Đánh đổi này chấp nhận được vì 4 benefit ở trên, và rule no-edit-past + auto-fill khi tạo reading mới đảm bảo data luôn consistent.

---

### Q11. "Contract-scoped previous readings" — chuyện gì ở đây?

**A. Đây là incident thật.**

Ban đầu thiết kế: tháng mới, `elec_prev` auto-fill từ tháng trước của cùng room. Logic: room → reading. Vấn đề: nếu tenant cũ vừa chuyển đi, tenant mới chuyển vào — tháng đầu của tenant mới sẽ lấy `elec_prev` = `elec_curr` của tenant cũ. **Tenant mới bị tính tiền điện cho cả phần tenant cũ chưa thanh toán.**

Fix: thêm `contract_id` vào `utility_reading`. Logic auto-fill mới:

```python
# billing_service.py:288-296
prev_reading = await utility_repo.get_previous(room_id, period)
same_contract_prev = (
    prev_reading
    if prev_reading is not None
    and prev_reading.contract_id == contract_id
    else None
)
elec_prev = same_contract_prev.elec_curr if same_contract_prev else None
```

Nếu reading tháng trước thuộc contract khác → coi như không có prev, landlord tự nhập tay reading đầu khi tenant mới chuyển đến.

**Follow-up "Sao không xóa reading của contract cũ?":** Reading cũ là historical record để audit (tenant cũ đã trả tiền điện chưa, dispute sau này). Không xóa — chỉ scope filter.

---

### Q12. Move-in reading hoạt động thế nào?

**A.** Khi tạo contract mới, có field `initial_elec_curr` — số công tơ điện tại thời điểm dọn vào. Backend store:

```
elec_prev = initial_elec_curr
elec_curr = initial_elec_curr  (cùng giá trị)
period = tháng dọn vào
```

Tháng đó: `electricity = curr - prev = 0`. Tenant không bị tính điện cho tháng dọn vào (vì chưa dùng).

Khi landlord ghi số điện tháng kế tiếp:

- `elec_prev` của reading mới = `elec_curr` của reading move-in = `initial_elec_curr`.
- `elec_curr` = số mới landlord đọc.
- Tiền điện = `new - initial`.

**Edge case "Tenant dùng điện trước khi tháng kết thúc?":** Landlord có thể update reading move-in: `elec_curr` mới (> `elec_prev` = initial). Khi đó `electricity = elec_curr - elec_prev > 0`. Hợp lệ.

---

### Q13. Legacy reading data — backward compatibility

**A.** Khi mới thiết kế chưa có khái niệm `elec_prev`, reading chỉ có 1 cột `value`. Sau khi refactor sang prev/curr, dữ liệu cũ có `elec_prev = NULL`.

Approach:

- **Không backfill destructively** — giữ NULL.
- Frontend detect `isInitialReading = reading_id !== null && elec_prev === null` → render với border màu hổ phách (amber) để landlord biết reading này là legacy.
- Backend khi update reading legacy: shift `elec_prev ← old_curr`, `elec_curr ← new_value`. Sau lần update đầu tiên, reading đó chuyển sang format mới.

**Tại sao chọn cách này thay vì migration backfill?** Không biết historical context của reading cũ — tenant đó còn ở không, contract nào, prev là bao nhiêu. Backfill có thể tạo data sai. Để landlord verify thủ công an toàn hơn.

---

### Q14. Proration logic

**A.** Hàm `_prorate_factor(start, end, period)` trong `invoice_service.py`. Tính tỷ lệ ngày thực tế trong tháng:

```
period = "2026-05" → tháng 5 có 31 ngày
nếu contract start = 2026-05-10, end = none → factor = (31 - 9) / 31
nếu contract end = 2026-05-20 → factor = 20 / 31
```

Áp dụng cho: **rent** (tiền nhà) và **fixed surcharges** (phí cố định: rác, gửi xe...).

**Không áp dụng cho meter-based utilities (điện, nước theo m³)** — vì đã đo bằng công tơ, đúng theo lượng dùng thực tế, không cần prorate.

**Follow-up "Tại sao surcharge cố định prorate, surcharge variable không?":** Surcharge cố định = phí theo tháng (gửi xe 100k/tháng). Tenant ở nửa tháng → trả nửa. Surcharge variable = phí theo đầu người hoặc theo đơn vị — đã tính theo số lượng thực tế rồi, không cần prorate.

---

### Q15. Shared-meter electricity splitting

**A.** Use case: căn nhà có 1 đồng hồ điện chung cho hành lang + đèn ngoài + khu vực dùng chung. Phí này chia đều cho các phòng dùng chung.

Schema:

- `shared_meter`: thông tin meter (property_id, name, unit_price).
- `shared_meter_room`: composite PK (shared_meter_id, room_id) — phòng nào dùng meter này.
- `shared_meter_reading`: reading theo period (prev/curr giống reading thường).

Trong invoice service:

```
total_consumption = curr - prev của shared_meter_reading
num_rooms_sharing = count(shared_meter_room WHERE shared_meter_id = X)
per_room_amount = total_consumption * unit_price / num_rooms_sharing
```

Mỗi invoice của phòng dùng shared meter có thêm `invoice_item` type `shared_elec` với amount đã chia.

**Follow-up "Sao không chia theo đầu người?":** Đã thử — phức tạp và dễ tranh chấp. Chia đều theo phòng đơn giản, transparent. Landlord nào muốn chia khác có thể không dùng shared meter, ghi riêng cho từng phòng.

---

## Section D — Bullet 3: Invoice Snapshot & Public Link

### Q16. "Immutable snapshot" cụ thể là gì?

**A.** Khi tạo invoice, backend tính ra các line item (rent, electricity, water, surcharges, shared_elec) và lưu **giá trị Decimal cụ thể** vào bảng `invoice_item`. **Không** lưu reference đến surcharge_template, không re-calculate lúc display.

```
invoice_item:
  id, invoice_id, item_type (rent/electricity/water/surcharge/shared_elec)
  amount: Decimal
  description: string
```

Sau này landlord đổi `room.monthly_rent` từ 3 triệu lên 4 triệu → invoice cũ vẫn hiển thị 3 triệu. Đổi `surcharge_template.amount` → invoice cũ không bị thay đổi.

**Follow-up "Tại sao quan trọng?":** Hóa đơn là legal record. Tenant đã thanh toán theo số tiền nào thì invoice phải giữ đúng số đó. Recalculate-on-display = bug nghiêm trọng — tenant sẽ thấy số khác sau khi đã thanh toán.

**Follow-up "Edit invoice draft thì sao?":** Chỉ invoice status `draft` mới sửa được. Sửa → tạo lại invoice_item từ đầu. Invoice `sent` hoặc `paid` → immutable hoàn toàn, muốn sửa phải tạo invoice mới.

---

### Q17. Token-based public invoice link — thiết kế

**A.** Mỗi `invoice` có field `public_token = str(uuid.uuid4())` tự sinh khi tạo. Endpoint `/invoices/public/{token}`:

- Lookup invoice theo token (có index trên cột `public_token`).
- Response chứa: room number, property name, period, line items, total.
- **Không** chứa: tenant CCCD, số điện thoại, thông tin landlord cá nhân.

**Follow-up "Token bị leak thì sao?":**

- UUID4 = 122 bits entropy, không brute-forceable.
- Worst case: attacker xem được invoice cụ thể đó (chỉ số tiền, room, period). Không lateral movement sang invoice/user khác — mỗi token chỉ unlock chính nó.
- Không có CCCD/SĐT → không phishing được tenant.
- Mitigation thêm có thể: TTL token (expire sau X ngày), regenerate token. Hiện chưa cần.

**Follow-up "Sao không gửi qua email với short link?":** MVP — landlord copy link gửi qua Zalo cho tenant. Tenant không có account trên hệ thống. Không cần email infra.

---

### Q18. "Tenant-safe data" — cụ thể là gì?

**A.** Schema response của `/invoices/public/{token}` là `InvoicePublicRead` khác với `InvoiceDetailRead`. Trong `InvoicePublicRead`:

- Có: room_number, property_name, period, items, total, due_date, status.
- Không có: `tenant_phone`, `tenant_id_card` (CCCD), landlord info, internal IDs (room_id, contract_id).

**Tại sao tách 2 schema thay vì conditionally filter?** Compile-time guarantee: nếu return `InvoicePublicRead` thì impossible serialize PII (field không tồn tại trên type). An toàn hơn `if not public: exclude fields`.

---

## Section E — Bullet 4: Architecture Discipline

### Q18.5. Project đang đi theo architecture pattern nào?

**A. Honest label: Pragmatic Layered Architecture với Transaction Script services và anemic models** — borrow một số nguyên tắc từ Clean Architecture (layer naming, framework-agnostic service, domain exception) nhưng **không phải Clean Architecture thật**.

**Tên gọi chính xác từng phần:**

| Phần            | Pattern                                                                     |
| --------------- | --------------------------------------------------------------------------- |
| Macro structure | Layered (N-tier) architecture                                               |
| Service shape   | Transaction Script (Fowler PoEAA) — mỗi business request = 1 procedure      |
| Domain model    | Anemic Domain Model — SQLModel table chỉ có field, không có method/behavior |
| Data access     | Repository pattern (light — concrete class, không có port/interface)        |
| I/O typing      | DTO pattern — Pydantic schema tách khỏi SQLModel table                      |
| Transaction     | Unit of Work informal — service làm transaction owner (xem Q21.5)           |
| Cross-cutting   | Centralized DI (`dependencies.py`) + centralized exception handler          |

**Project KHÔNG phải:**

1. **Clean Architecture (Uncle Bob).** Clean yêu cầu entity ở trung tâm là pure domain, không biết DB/framework. Project: `model` = SQLModel (đã biết DB từ định nghĩa). Service import concrete `BillingRepo` (transitively biết SQLModel). **Dependency arrow đi sai chiều.**

2. **Hexagonal / Ports-and-Adapters.** Hexagonal cần port (interface) định nghĩa cái domain cần, adapter implement port theo từng tech. Project: không có abstract `BillingRepository` interface; service depend on concrete class — không swap adapter được (xem Q21).

3. **DDD.** DDD cần aggregate root với invariant, rich domain model. Project: model anemic, logic ở service. `Contract` / `Invoice` / `Reading` là entity riêng lẻ, không có aggregate boundary.

4. **CQRS.** Read/write đi cùng service+repo. Có hint tách (raw SQL cho read aggregation — Q22) nhưng không formalize thành read model riêng.

5. **Event-Driven.** Bảng `contract_event` là **audit log**, không phải event với subscriber. Không có event bus.

**Tại sao chọn pattern này:**

- **Phù hợp scope.** CRUD-heavy SaaS với mapping 1 use case = 1 endpoint rõ ràng → Transaction Script tự nhiên nhất, ít overhead nhất.
- **Readable.** Đọc 1 service method = đọc full flow của 1 use case top-down. Không phải bounce qua 5 file như DDD aggregate.
- **Pragmatic discipline.** Vẫn có layer separation, exception abstraction, schema vs model tách — đủ để code review-able, không spaghetti.

**Khi nào sẽ đổi pattern:**

| Tình huống                                               | Pattern phù hợp hơn                            |
| -------------------------------------------------------- | ---------------------------------------------- |
| Domain logic phức tạp, nhiều invariant cross-entity      | DDD với aggregate root                         |
| Cần test domain logic pure (không boot DB)               | Hexagonal với port/adapter (giải quyết cả Q21) |
| Read scale rất cao + write phức tạp                      | CQRS với read model riêng                      |
| Multiple bounded context (rental + payment + accounting) | Microservice + DDD                             |
| Event-driven workflow (notification, async processing)   | Event bus + handler                            |

**One-liner để defend khi phỏng vấn:**

> "Layered architecture with Transaction Script services and anemic models — not Clean Architecture despite surface resemblance. Chọn vì scope CRUD-heavy SaaS, domain chưa đủ phức tạp để cần DDD. Trade-off: dễ đọc, dễ onboard; sẽ scale hạn chế khi business rule cross-entity nhiều lên."

Câu này lập tức loại junior (gọi đại "Clean Architecture" cho cái không phải Clean) và ngang ngửa senior (biết tên pattern + biết khi nào nên đổi cái khác).

---

### Q19. Tại sao strict layering Router → Service → Repository?

**A.**

- **Router**: parse HTTP, gọi 1 service method, return schema. Không business logic.
- **Service**: business rules + transaction owner. Không trực tiếp access DB session ngoài việc commit/flush.
- **Repository**: 1 DB operation/method. Không commit, không business rules.

**Lý do tách Service và Repository:**

- Transaction boundary rõ ràng — chỉ service mới commit. Không có nguy cơ "repo commit nửa chừng làm dirty state".
- Service mô tả use case ngôn ngữ business; repository mô tả DB operation. Đọc service file = đọc flow nghiệp vụ, không bị noise SQL.
- Repository có thể swap implementation (asyncpg → backend khác) mà không touch business logic — _với điều kiện_ DI được làm đúng (xem Q21).

**Follow-up "Tại sao service commit chứ không phải router?":** Router không biết logic — một use case có thể là 1 commit hoặc 3 commits liên tiếp tùy business rule. Service mới biết "đơn vị atomic" là gì.

**Follow-up "Sao không dùng async with session.begin() ở service?":** `asyncpg` có **autobegin** — connection tự `BEGIN` ở câu query đầu. `async with session.begin()` lồng vào sẽ conflict (nested transaction không được hỗ trợ). Service gọi `await session.commit()` explicit ở cuối — đủ và đúng.

**Follow-up "Layering này có cho phép unit test service không đụng DB không?":** _Hiện tại không hoàn toàn_ — vì service tự instantiate repo trong constructor (xem Q21). Project compensate bằng 125 integration test với Postgres thật. Refactor đúng là inject repo qua DI — đã ghi nhận là technical debt có chủ ý.

---

### Q20. "Domain-exception boundaries" — explain

**A.** Service **không bao giờ** raise `HTTPException`. Service raise các exception domain-level:

- `NotFoundException`
- `ForbiddenException`
- `ConflictException`
- `BadRequestException`

Định nghĩa ở `app/core/exceptions.py`. Một exception handler ở `main.py`:

```python
@app.exception_handler(AppException)
async def app_exception_handler(request, exc):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
```

**Tại sao?**

- Service không phụ thuộc framework — có thể swap FastAPI → Litestar không cần đụng business logic.
- Test service không cần TestClient — chỉ assert exception type.
- Một loại lỗi business chỉ map sang HTTP status ở 1 chỗ (handler) — đổi mapping toàn cục tại 1 file.

---

### Q21. DI centralization — vì sao?

**A.** Tất cả wiring DI nằm trong `app/core/dependencies.py`:

```python
def _billing_service(session: SessionDep) -> BillingService:
    return BillingService(session)

BillingServiceDep = Annotated[BillingService, Depends(_billing_service)]
```

Service **không** có `Depends()` trong constructor — chúng là plain Python class.

**Lý do:**

- Service không phụ thuộc FastAPI → swap framework không phải đụng business logic.
- Đổi cấu trúc DI = đổi 1 file, không phải hunt qua mọi service.
- Tránh circular dependency: nếu service A `Depends(ServiceB)` qua constructor, refactor sẽ rối — qua dependencies.py thì wiring là linear.

**Follow-up "Service tự instantiate repo trong constructor — đây có phải DI thật không?":**

_Honest answer: không, đây là technical debt có chủ ý._ Hiện tại service nhận `session` rồi tự tạo repo:

```python
# app/services/billing_service.py
class BillingService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.billing_repo = BillingRepo(session)
        self.invoice_repo = InvoiceRepo(session)
        self.utility_repo = UtilityRepo(session)
        # ... 5 more repos
```

**Vấn đề:**

1. Hard coupling service ↔ concrete repo class — không swap impl được (mock, instrumented, alternative backend).
2. Unit test pure không khả thi — phải mock `AsyncSession` rồi patch từng query, brittle. Compensate bằng integration test với Postgres thật.
3. Dependency ngầm — đọc `BillingService(session)` không biết service cần 8 repo, phải mở body constructor.

**Pattern đúng hơn (chưa làm):**

```python
class BillingService:
    def __init__(
        self,
        billing_repo: BillingRepo,
        invoice_repo: InvoiceRepo,
        ...
    ):
        self.billing_repo = billing_repo
        ...

# dependencies.py wires repo → service
def _billing_service(
    billing_repo: BillingRepoDep,
    invoice_repo: InvoiceRepoDep,
    ...
) -> BillingService:
    return BillingService(billing_repo, invoice_repo, ...)
```

Vẫn giữ service plain Python (constructor không có `Depends()`), nhưng repo wire qua DI thay vì instantiate trong service. Test thì inject `mock_repo` thẳng.

**Tại sao chưa refactor:** Chưa có use case force (unit test offline hoàn toàn / swap repo backend). 125 integration test với Postgres thật đang cover correctness. Khi nào cần test logic phức tạp không đụng DB (vd Monte Carlo billing simulation) thì refactor.

**Nhận xét chung:** Project tuân thủ rule "no `Depends()` in service constructor" → giữ service framework-agnostic. Nhưng đổi lại service phụ thuộc concrete repo class — clean về 1 trục, leaky về trục khác. Đây là half-step về clean architecture, không phải full.

---

### Q21.5. Service tự gọi `session.commit()` — đây có phải pattern tốt không?

**A.** _Honest answer: không hoàn toàn, đây là technical debt thứ 2 song song với Q21._

**Thực tế trong code:** 11 service file, ~32 chỗ `session.commit()` rải rác ở cuối mỗi write method. Một số method có thêm try/except IntegrityError → rollback (vd `room_service.py:85-92` cho UNIQUE constraint trên room_number).

**Vấn đề:**

1. **Không compose được cross-service.** Nếu cần "tạo room VÀ tạo surcharge default trong cùng transaction":

   ```python
   await room_service.create_room(...)       # commit 1
   await surcharge_service.create_default(...)  # commit 2 — nếu fail, không rollback được room
   ```

   Mỗi service method = 1 transaction độc lập. Cross-service atomic phải workaround (gộp logic vào 1 service hoặc viết orchestrator method).

2. **Mixed concern: service vừa business logic vừa transaction lifecycle.**

   ```python
   try:
       created = await self.room_repo.create(room)
       await self.session.commit()        # ← transaction lifecycle (không phải business)
   except IntegrityError:
       await self.session.rollback()       # ← transaction lifecycle
       raise ConflictException(...)        # ← business logic
   ```

   Service biết quá nhiều về DB session. Lý do tách service khỏi repo là để tách business logic khỏi DB concern — pattern này leak ngược lại.

3. **IntegrityError handling lặp đi lặp lại.** Mỗi service xử lý UNIQUE conflict riêng. Thêm field UNIQUE mới = copy-paste try/except.

4. **Repo flush + service commit = 2 layer cùng manage DB I/O ordering.** Concept không clean — repo flush để có ID trả về, service commit để persist. Cả 2 layer cùng biết về session lifecycle.

**Pattern tốt hơn — commit/rollback ở dependency middleware:**

```python
# app/core/dependencies.py
async def get_session():
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()       # 1 commit khi request clean
        except AppException:
            await session.rollback()
            raise
        except IntegrityError as e:
            await session.rollback()
            raise translate_integrity_error(e)  # central mapping table
```

Service chỉ gọi `flush()` khi cần ID, không bao giờ commit:

```python
async def create_room(self, ...):
    room = Room(...)
    created = await self.room_repo.create(room)  # repo flush internally
    await self.session.refresh(created)
    return RoomRead.model_validate(created)
    # KHÔNG commit. Dependency commit khi request kết thúc.
```

**Lợi ích:**

- **Composable**: gọi nhiều service method trong 1 request → 1 transaction tự động.
- **Service framework-agnostic hơn**: chỉ biết `flush()`, không biết `commit/rollback`.
- **IntegrityError handling 1 chỗ**: dependency dịch sang `ConflictException` theo mapping table tập trung.
- **Test pure dễ hơn**: mock session không phải simulate commit/rollback state machine.

**Phản biện (lý do bảo vệ pattern hiện tại):**

1. **Explicit > implicit.** Commit ở service = boundary visible khi đọc code. Commit ở middleware = invisible.
2. **MVP simplicity.** 1 request = 1 service call = 1 transaction. Predictable.
3. **YAGNI cross-service transaction.** Chưa có use case force.

**Khi nào sẽ break:**

- Cross-service atomic operation (vd: "tạo invoice + đánh dấu reading là billed" cần atomic).
- Bulk operation với partial rollback (vd: tạo 10 invoice batch, 3 fail → rollback đúng 3 cái, giữ 7 cái).
- Saga pattern cho long-running workflow.

**Honest verdict:** Half-step về clean architecture, giống Q21. **Clean ở 1 trục** (service là transaction owner, explicit boundary), **leaky ở 1 trục** (service biết `session.commit/rollback`). Pattern này OK cho project scope hiện tại nhưng sẽ refactor khi gặp use case cross-service đầu tiên.

---

### Q22. Raw SQL — khi nào dùng, khi nào không?

**A.** Default = SQLModel/ORM. Raw SQL chỉ dùng cho **read aggregation endpoints** có pattern N+1.

Ví dụ: list utility readings. Mỗi reading có `tenant_name` (qua contract → tenant). Nếu dùng ORM:

- 1 query lấy danh sách reading.
- Mỗi reading → 1 query lấy contract → 1 query lấy tenant.
- 1 + 2N queries cho N readings.

Solution: raw SQL JOIN trong `utility_repo.get_all_by_room_with_tenant`:

```sql
SELECT r.*, c.id as contract_id, t.full_name as tenant_name
FROM utility_reading r
LEFT JOIN contract c ON r.contract_id = c.id
LEFT JOIN tenant t ON c.tenant_id = t.id
WHERE r.room_id = :room_id
ORDER BY r.period DESC
```

Trả về `list[dict]`, repo map thành Pydantic schema. 1 query total.

**Quy tắc đặt ra cho bản thân:**

- Mutating logic (create/update/delete) → ORM. Service vẫn commit qua ORM session.
- Read endpoint with multiple joins + filters → raw SQL OK.
- Tránh raw SQL cho logic đơn giản — overkill, mất type safety.

**Follow-up "SQL injection?":** Dùng named parameters của SQLAlchemy:

```python
text("SELECT ... WHERE room_id = :room_id").bindparams(room_id=room_id)
```

Không string concat. Asyncpg + SQLAlchemy escape tự động.

---

### Q23. 125 tests covered những gì?

**A.** Phân bổ:

- **Unit tests** (`tests/unit/`): pure function — invoice calculation, proration, utility math.
- **Integration tests** (`tests/integration/`): chạy với Postgres thật.
  - `test_auth.py`: JWKS rotation, fail-closed, multi-tenant data leak (user A không thấy data user B).
  - `test_billing.py`: contract-scoped prev reading, move-in, legacy data.
  - `test_contracts.py`: lifecycle events (created, rent_changed, ended).
  - `test_invoice_*.py`: status transitions, public link access, PII redaction.

**Fixture pattern (`tests/conftest.py`):**

- Autouse fixture: TRUNCATE tất cả bảng trước mỗi test → mỗi test isolated.
- Reset JWKS cache + `AUTH_DEV_MODE` state → không leak config giữa tests.

**Tại sao test với Postgres thật, không mock?**

- Bug từng gặp với mock: ORM behavior khác Postgres thật (date casting, async transaction). Mock pass nhưng prod fail.
- Postgres docker container chạy local — overhead chấp nhận được (~30s suite).
- Test catch được edge case schema: FK violation, UNIQUE constraint, enum invalid.

---

## Section F — Deployment & migrations

### Q24. Deploy flow Render + Neon

**A.**

- Backend code → Docker image → Render (web service).
- Database → Neon (serverless Postgres, scale-to-zero).
- Container CMD: `alembic upgrade head && uvicorn app.main:app`.

**Container-CMD migration là safety net:**

- Migration fail (vd UNIQUE constraint conflict) → container exit non-zero → Render không switch traffic → revision cũ vẫn live.
- Zero downtime cho user.
- Trade-off: container start hơi chậm (5-10s do alembic check). Acceptable cho landlord SaaS không spike traffic.

**Follow-up "Sao không chạy migration trong CI trước khi deploy?":** Cũng làm — nhưng CI dùng test DB sạch, không có production data conflict. Container-CMD là layer phòng thủ thứ 2 catch được data-conflict bug mà CI miss.

---

### Q25. UNIQUE constraint incident — kể chi tiết

**A. Incident thật.**

Tình huống: Thêm UNIQUE constraint `(clerk_user_id, name)` lên bảng `property` để chặn user tạo trùng tên nhà. Đã thêm Pydantic validator strip whitespace trước khi đó.

Migration fail trên Neon vì:

- Có 2 row `name = "Nhà A "` (trailing space) và `name = "Nhà A"` — Pydantic validator chỉ áp dụng cho input mới, **không** retroactively clean historical data.
- UNIQUE constraint coi 2 string đó là khác nhau, nhưng sau khi normalize sẽ trùng.

Fix tại thời điểm đó: xóa duplicate thủ công, chạy lại migration. **OK cho MVP với data seed của chính mình.**

**Bài học rút ra:**

1. **Deploy safety ≠ Data safety.** Pydantic validator "không touch DB" → an toàn deploy, nhưng không an toàn data lịch sử.
2. **Trước migration UNIQUE/NOT NULL, query check duplicate/null TRƯỚC:**
   ```sql
   SELECT clerk_user_id, name, COUNT(*) FROM property
   GROUP BY clerk_user_id, name HAVING COUNT(*) > 1;
   ```
3. **Nếu có user thật:** không xóa data — dùng **expand-contract pattern**:
   - EXPAND: thêm cột mới nullable + dual-write.
   - BACKFILL: script normalize toàn bộ row cũ.
   - DEDUPE: tìm duplicate, merge logic (giữ row nào, link FK sang đâu).
   - CONTRACT: thêm constraint sau khi data đã sạch.
   - CLEANUP: xóa code dual-write.

**Follow-up "Sao không dùng Postgres CITEXT?":** Hợp lý cho case-insensitive. Nhưng vấn đề chính là whitespace, không phải case → CITEXT chưa đủ. Phải normalize ở app layer + DB.

---

### Q26. Migration risk classification — quy trình của bạn?

**A.** Trước mỗi migration, phân loại:

| Loại               | Hành động                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Safe**           | Add nullable column, add index, add default-value column. Chạy trực tiếp.                                        |
| **Cần check data** | Add UNIQUE, NOT NULL without default, CHECK constraint, optional→required field. Phải query data conflict trước. |
| **Destructive**    | Drop column, rename column. Cần expand-contract — old code phải còn hoạt động trong window deploy.               |

Note quan trọng: **Pydantic validator stricter** (regex, min_length, normalize) cũng vào loại "cần check data" — vì sẽ silently fail validation cho row cũ lúc runtime. Validator looser (bỏ check) thì safe.

---

## Section G — Testing & Observability

### Q27. Test isolation — fixture pattern

**A.** `tests/conftest.py`:

```python
@pytest.fixture(autouse=True)
async def reset_db(session):
    yield
    await session.execute(text("TRUNCATE ... CASCADE"))
```

Mỗi test:

1. Chạy với DB sạch (TRUNCATE từ test trước).
2. Tạo data cần thiết.
3. Assert.
4. (Implicit) cleanup ở fixture next.

Test không phụ thuộc thứ tự — chạy `pytest -p no:randomly` hay `pytest --randomly` đều OK.

**Follow-up "Sao không dùng savepoint/rollback?":** Đã thử — async transaction state phức tạp với asyncpg. TRUNCATE đơn giản, deterministic, đủ nhanh.

---

### Q28. Test JWKS rotation — viết thế nào?

**A.** Mock `httpx.AsyncClient.get` trả 2 JWKS khác nhau:

1. Lần đầu: trả JWKS với `kid="key-1"`.
2. Lần thứ 2 (force refresh): trả JWKS với `kid="key-2"`.

Test flow:

- Token A signed by key-1 → decode pass với JWKS lần đầu.
- Token B signed by key-2 → decode bằng JWKS cũ fail (kid không có) → trigger force refresh → JWKS mới có key-2 → decode pass.

Verify: chỉ 2 HTTP call total (cache hit cho subsequent requests).

---

## Section H — Behavioral / Decision-making

### Q29. Quyết định nào trong project khó nhất?

**A.** Thêm `contract_id` vào `utility_reading`.

Lý do khó:

- Phá nguyên tắc "1 thing belongs to 1 thing" — reading đã thuộc room, giờ thuộc cả contract.
- Migration phức tạp — phải backfill `contract_id` cho reading lịch sử (lookup contract active tại thời điểm reading được tạo).
- Logic auto-fill `elec_prev` phải rewrite — không chỉ là "previous month", giờ là "previous month trong cùng contract".

Vì sao quyết định làm: thấy được attack vector tenant-mới-bị-tính-tiền-tenant-cũ. Không có cách nào fix mà giữ schema cũ. Trade-off: 1 cột thêm + 1 ngày refactor < bug pháp lý/UX cho user.

---

### Q30. Trade-off khó nhất giữa "đúng kỹ thuật" và "đủ cho MVP"?

**A.** Quyết định **không** dùng expand-contract khi xử lý UNIQUE incident.

"Đúng kỹ thuật" = expand-contract pattern, mất 2-3 ngày.
"Đủ cho MVP" = xóa duplicate (do mình tự seed data, không phải user thật), chạy migration, done trong 30 phút.

Chọn cái thứ 2. **Đánh đổi:** không học được pattern qua thực hành. Bù lại: ghi vào `DEPLOY_STUDY.md` để lần sau có user thật thì áp dụng. Đến giờ chưa lặp lại nên chưa rebuild kinh nghiệm — đó là rủi ro nhận thức.

**Follow-up "Nếu giờ làm lại?":** User vẫn ít, làm expand-contract để có experience thật. Lúc đó hấp tấp.

---

### Q31. Nếu thiết kế lại, sẽ làm khác gì?

**A.** Mấy điểm:

1. **Bắt đầu với `contract_id` ở `utility_reading` ngay từ đầu** — đã biết domain thuê nhà phức tạp, nhưng vẫn nghĩ "room → reading" là đủ. Refactor sau đắt hơn.

2. **Không tự build invoice line-item type** — dùng polymorphic kế thừa (SQLAlchemy single-table inheritance) thay vì enum + cột `amount` chung. Hiện tại làm extension (vd discount, tax) phải nhét vào enum, schema cồng kềnh.

3. **Async pattern consistent hơn** — có 1-2 chỗ mixed sync/async (legacy code), nên thống nhất sớm.

4. **Document architectural decisions sớm hơn** — `CLAUDE.md` viết khi đã có nhiều code, viết ADR ngay từ đầu sẽ giúp giữ discipline khi code rộng ra.

---

### Q32. Nếu giờ scale lên 1000 landlord — gì sẽ break trước?

**A.** Theo thứ tự:

1. **Neon free tier limit** (compute hours/data transfer). Cần upgrade plan.
2. **JWKS endpoint Clerk** — không phải bottleneck thực sự (Clerk có CDN), nhưng nếu deploy multi-region, mỗi region cache riêng → load lên Clerk vẫn OK với 1000 users.
3. **Dashboard query** — đã dùng raw SQL nhưng vẫn aggregate over toàn bộ property của user. Với landlord có 50+ properties × 30 rooms = 1500 rows, query có thể chậm. Cần materialized view hoặc cache.
4. **Migration window** — 1000 users đồng nghĩa migration có data conflict cao hơn. Phải nghiêm túc dùng expand-contract.

Cái **không** sẽ break: multi-tenant isolation, auth, billing logic — đã test và thiết kế đúng từ đầu.

---

## Section I — "Trap" questions (recruiter có thể test sâu)

### Q33. "Bạn viết thật hay AI viết?"

**A.** Thẳng thắn: dùng Claude Code làm pair programming, đặc biệt cho boilerplate, refactor đa file, và rà soát edge case. Quyết định kiến trúc (4-layer, contract_id, invoice snapshot) là của tôi — discuss với AI nhưng tôi chọn và defend được. Migration incident và bài học expand-contract là kinh nghiệm thật.

**Test này thường là:** "Giải thích 1 file/dòng code bất kỳ trong repo". Mình phải defend được tại sao viết như vậy, không chỉ "Claude gợi ý".

---

### Q34. "Code này simple — sao gọi là kỹ thuật?"

**A.** Đồng ý là code không phải distributed systems hay high-frequency trading. Cái khó là **domain modeling đúng** với constraint thực tế của tenant turnover, billing dispute, legacy data. Một junior dev viết được CRUD; một engineer viết được CRUD mà tenant mới không bị tính tiền tenant cũ và hóa đơn cũ không bị recompute khi đổi giá thuê — đó là điểm khác biệt.

---

### Q35. "Sao không dùng X framework/tool?"

**A.** Trả lời theo pattern:

- Hiểu X làm gì.
- Vấn đề mình giải đã có solution với tool đang dùng, X không cải thiện đáng kể.
- Trade-off thêm dependency vs benefit không xứng cho project scope hiện tại.
- Nếu scale lên thì cân nhắc lại.

Ví dụ "Sao không dùng Celery/RQ cho background jobs?": Hiện tại chưa có background job thực sự (gửi email, generate PDF báo cáo nặng). Lúc cần sẽ thêm. Premature optimization.

---

## Appendix — File reference map

Khi bị hỏi sâu, có thể chỉ vào file cụ thể để chứng minh:

| Topic                   | File                                                                            |
| ----------------------- | ------------------------------------------------------------------------------- |
| JWKS caching + rotation | `app/core/clerk.py`                                                             |
| Contract-scoped reading | `app/services/billing_service.py:288-296`                                       |
| Invoice snapshot        | `app/models/invoice.py` (invoice_item table), `app/services/invoice_service.py` |
| Public token            | `app/models/invoice.py:30` (`public_token = uuid.uuid4()`)                      |
| Raw SQL example         | `app/repositories/utility_repo.py:get_all_by_room_with_tenant`                  |
| DI wiring               | `app/core/dependencies.py`                                                      |
| Exception classes       | `app/core/exceptions.py`                                                        |
| Test isolation          | `tests/conftest.py`                                                             |
| Migration risk doc      | `docs/DEPLOY_STUDY.md`                                                          |
| Architecture rules      | `CLAUDE.md`                                                                     |

---

## Tips for the interview

1. **Mở đầu mỗi câu trả lời bằng concrete fact** (file, dòng, số liệu) — chứng minh đã thật sự code, không học vẹt.
2. **Khi không nhớ chi tiết, nói "tôi không nhớ con số chính xác, nhưng pattern là X"** — honest > bịa.
3. **Nếu interviewer hỏi câu chưa nghĩ tới** — "Câu hỏi hay, tôi chưa nghĩ tới — đoán đầu tiên là X vì Y, nhưng cần verify". Bình tĩnh hơn là cố trả lời chắc nịch một thứ sai.
4. **Khi defending decision, luôn nêu cả trade-off bạn từ chối** — "Tôi chọn raw SQL ở đây, đã cân nhắc eager loading nhưng [lý do]".
5. **Có 1 incident story (UNIQUE constraint) — kể với cấu trúc: tình huống → quyết định lúc đó → kết quả → bài học → áp dụng sau.**
