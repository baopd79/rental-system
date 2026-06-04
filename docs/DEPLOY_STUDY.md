# Ôn tập: Deploy Web App lên Production

> Tổng hợp kiến thức từ quá trình deploy rental-system lên Vercel + Render + Neon.

---

## 1. Tổng quan kiến trúc

```
Người dùng (browser)
       │
       ▼
  Vercel (Frontend)          ← Next.js, static + SSR
  rental-system.vercel.app
       │  gọi API
       ▼
  Render (Backend)           ← FastAPI chạy trong Docker container
  rental-system.onrender.com
       │  query DB
       ▼
  Neon (Database)            ← PostgreSQL serverless
  ep-xxx.neon.tech
       │
  Clerk (Auth)               ← JWT verify, hosted sign-in/sign-up
```

**Mỗi service có nhiệm vụ riêng biệt** — frontend không chạy cùng server với backend, database lại là service thứ ba hoàn toàn tách biệt.

---

## 2. Docker

### Docker là gì?

Docker đóng gói app và toàn bộ môi trường cần thiết (Python version, thư viện, cấu hình) vào một **image** — bản snapshot hoàn chỉnh. Từ image đó tạo ra **container** để chạy.

```
Source code + Dockerfile
        │
        ▼ docker build
      Image  (snapshot tĩnh)
        │
        ▼ docker run
    Container (đang chạy)
```

### Dockerfile

Bản hướng dẫn từng bước để build image:

```dockerfile
FROM python:3.12-slim         # Base image — OS + Python sẵn
COPY --from=...uv... /uv ...  # Lấy tool từ image khác
WORKDIR /app                  # Thư mục làm việc trong container
COPY pyproject.toml uv.lock . # Copy deps TRƯỚC (để cache layer)
RUN uv sync --frozen --no-dev # Cài thư viện
COPY . .                      # Copy code SAU
CMD ["sh", "-c", "uvicorn ... --port ${PORT:-8000}"]  # Lệnh khởi động
```

**Tại sao COPY deps trước, COPY code sau?**
Docker build từng dòng thành **layer** và cache lại. Nếu `pyproject.toml` không đổi thì layer `uv sync` không cần build lại → tiết kiệm thời gian.

### .dockerignore

Giống `.gitignore` nhưng cho Docker — loại trừ file không cần thiết vào image:

```
.venv          ← môi trường local, container tự tạo riêng
__pycache__    ← compiled Python bytecode
tests/         ← không cần test trong production image
.env           ← tuyệt đối không đưa secrets vào image
```

### Lợi ích chính

> **"Viết một lần, chạy ở đâu cũng được"** — Dockerfile dùng được trên Render, VPS, hay máy của đồng nghiệp đều cho kết quả giống nhau.

---

## 3. Environment Variables

### Là gì?

Biến cấu hình được truyền từ bên ngoài vào app lúc runtime — không hardcode trong code.

```bash
# Sai — hardcode trong code
DATABASE_URL = "postgresql://admin:secret123@prod.db.com/rental"

# Đúng — đọc từ environment
DATABASE_URL = os.environ["DATABASE_URL"]
```

### Tại sao không commit vào Git?

- Secrets (password, API key) trong Git = **lộ vĩnh viễn** dù đã xóa sau
- Mỗi môi trường (dev/staging/prod) cần giá trị khác nhau

### Cách inject theo môi trường

| Môi trường | Cách truyền env vars |
|------------|---------------------|
| Local dev | File `.env` (không commit) |
| Render | Dashboard → Environment tab |
| Vercel | Dashboard → Settings → Environment Variables |
| VPS | File `.env` trên server hoặc `export VAR=value` |

### Phân biệt NEXT_PUBLIC_ và không có prefix

| Loại | Ví dụ | Truy cập từ |
|------|-------|-------------|
| `NEXT_PUBLIC_*` | `NEXT_PUBLIC_API_URL` | Browser + Server |
| Không có prefix | `CLERK_SECRET_KEY` | Server only (an toàn hơn) |

> **Nguyên tắc:** Secret key không bao giờ có prefix `NEXT_PUBLIC_` — nếu có, browser đọc được = lộ key.

---

## 4. CORS (Cross-Origin Resource Sharing)

### Vấn đề

Browser có cơ chế bảo vệ: mặc định **chặn** request từ domain A gọi sang domain B.

```
rental-system.vercel.app  →  rental-system.onrender.com
       (domain A)                   (domain B)
                  ← Browser chặn nếu backend không cho phép
```

### Giải pháp

Backend khai báo danh sách domain được phép:

```python
# backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,  # ["https://rental-system.vercel.app"]
)
```

### Lỗi thường gặp

- **Quên update CORS** khi đổi domain → frontend gọi API bị chặn im lặng
- **Dùng `*` (allow all)** → tiện nhưng không an toàn cho production

---

## 5. SSL / HTTPS

### Tại sao cần SSL?

- Mã hóa traffic giữa browser và server
- Clerk, browser API (geolocation, camera) yêu cầu HTTPS
- Google ưu tiên HTTPS trong SEO

### asyncpg vs libpq (psycopg2)

Hai driver PostgreSQL dùng cú pháp SSL khác nhau:

| Driver | Cú pháp SSL trong URL |
|--------|----------------------|
| psycopg2 (libpq) | `?sslmode=require` |
| asyncpg | `?ssl=require` |

Neon cấp connection string dạng psycopg2 → phải **đổi thủ công** khi dùng asyncpg.

### Neon connection string

```
# Neon cấp (dành cho psycopg2):
postgresql://user:pass@host/db?sslmode=require&channel_binding=require

# Phải đổi thành (cho asyncpg):
postgresql+asyncpg://user:pass@host/db?ssl=require
```

---

## 6. Database Migration trên Production

### Khác gì với local?

Local: chạy `alembic upgrade head` với `DATABASE_URL` trỏ về localhost.
Production: chạy cùng lệnh nhưng `DATABASE_URL` trỏ về Neon.

```bash
# Chạy migration lên Neon (một lần khi deploy lần đầu)
DATABASE_URL="postgresql+asyncpg://...neon.tech/db?ssl=require" \
  uv run alembic upgrade head
```

### Khi nào cần chạy lại?

Mỗi lần có **migration mới** (thêm bảng, thêm cột) → phải chạy `upgrade head` trên production DB trước khi deploy code mới.

### Tự động chạy migration khi deploy (Render free tier)

Render free tier không có **Pre-Deploy Command** (tính năng trả phí). Thay vào đó, thêm migration vào `CMD` trong Dockerfile:

```dockerfile
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

- Migration chạy trước, xong mới khởi động server
- `alembic upgrade head` là **idempotent** — không có migration mới thì exit ngay, không tốn thời gian
- Nếu migration fail → container không start → Render giữ nguyên version cũ đang chạy

### Zero downtime khi deploy

Render giữ version cũ đang chạy cho đến khi version mới deploy thành công mới switch traffic. Nếu deploy fail → version cũ vẫn phục vụ user bình thường, không có downtime.

### Kiểm tra data trước khi chạy migration có constraint mới

**Không phải migration nào cũng an toàn.** Phân loại theo mức độ rủi ro:

| Thay đổi | Rủi ro | Lý do |
|---------|--------|-------|
| Thêm column nullable | An toàn | Row cũ tự get NULL |
| Thêm column NOT NULL có default | An toàn | DB tự fill default |
| Thêm index | An toàn | Không ảnh hưởng data |
| Pydantic validator **looser** (bỏ check, nới min/max) | An toàn | Data cũ vẫn pass |
| Thêm UNIQUE constraint | **Cần kiểm tra data** | Migration fail nếu data cũ có duplicate → container không start, Render giữ version cũ |
| Pydantic validator **stricter** (min_length, regex, normalize, transform) | **Cần kiểm tra data** | Migration không fail, server start OK, nhưng từng user lẻ sẽ bị 400 khi update data cũ — bug im lặng |
| Đổi field từ optional → required | **Cần kiểm tra data** | Row cũ thiếu field → mọi update fail validation |
| Thêm NOT NULL không có default | **Fail ngay** | Migration fail vì row cũ vi phạm |
| Xóa / rename column | **Nguy hiểm** | Code cũ còn reference |

> **Lưu ý conceptual — Deploy safety ≠ Data safety.**
> Pydantic validator dễ bị nhầm là "an toàn" vì nó không touch DB nên không thể làm migration fail. Nhưng "deploy thành công" không bằng "không có bug". Validator strict hơn data cũ vẫn deploy được, vẫn pass health check, nhưng sẽ làm user không sửa được record của chính họ — kiểu bug chỉ phát hiện khi user complain. Cùng class rủi ro với UNIQUE constraint về **data**, chỉ khác về **thời điểm và cách fail**.

**Với UNIQUE constraint, luôn kiểm tra trước:**

```sql
SELECT <col1>, <col2>, COUNT(*)
FROM <table>
GROUP BY <col1>, <col2>
HAVING COUNT(*) > 1;
```

**Với validator stricter, audit data cũ trước khi merge:**

```sql
-- Vd: tìm rows mà validator whitespace-normalize mới sẽ reject
SELECT id, name FROM property
WHERE name != trim(regexp_replace(name, '\s+', ' ', 'g'));

-- Vd: rows có name ngắn hơn min_length mới
SELECT id, name FROM property WHERE char_length(name) < 3;
```

Nếu có kết quả → backfill/clean data trước, validator hoặc constraint sau (pattern expand-contract).

**Sửa data trên Neon**: vào Neon dashboard → **SQL Editor** → chạy query xóa/sửa trực tiếp. Nhanh hơn dùng `psql`.

### Direct vs Pooled connection

| Loại | Dùng cho | Ghi chú |
|------|---------|---------|
| **Direct** | App backend (asyncpg tự pool) | Phù hợp cho FastAPI |
| **Pooled (pgbouncer)** | Serverless/Edge functions | Thêm params lạ như `channel_binding` |

> **Rule:** asyncpg tự quản lý connection pool → luôn dùng **direct connection**.

---

## 7. Workflow Deploy đầy đủ

```
1. Chuẩn bị code
   └── Viết Dockerfile
   └── Push lên GitHub

2. Database (Neon)
   └── Tạo project + lấy connection string
   └── Chạy: DATABASE_URL=<neon_url> alembic upgrade head

3. Backend (Render)
   └── Tạo Web Service từ GitHub repo
   └── Runtime: Docker, Root Dir: backend/
   └── Set env vars: DATABASE_URL, CLERK_JWKS_URL, CORS_ORIGINS
   └── Deploy → verify GET /health trả {"status":"ok"}

4. Frontend (Vercel)
   └── Import repo từ GitHub
   └── Root Dir: frontend/
   └── Set env vars: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY,
                     NEXT_PUBLIC_API_URL (phải có /api/v1 ở cuối)
   └── Deploy → verify app load được

5. Verify
   └── CORS_ORIGINS trên Render = Vercel domain thật
   └── Smoke test: login → tạo nhà → hóa đơn → public link
```

---

## 8. Các khái niệm khác

### PaaS vs VPS

| | PaaS (Render/Vercel) | VPS (Ubuntu server) |
|--|---------------------|---------------------|
| Setup | Vài click | Nhiều bước thủ công |
| Quản lý | Platform lo | Tự lo (Nginx, SSL, firewall) |
| Chi phí | Free tier → scale theo dùng | Cố định theo tháng |
| Học được | Concepts cơ bản | Thêm: Linux, Nginx, systemd |
| Dockerfile | Dùng luôn | Dùng luôn (reuse) |

### Cold start (Render free tier)

Render free tier tắt container sau 15 phút idle → request đầu tiên mất ~30 giây để "thức dậy". Request tiếp theo bình thường.

**Fix:** Upgrade lên $7/tháng hoặc dùng cronjob ping `/health` mỗi 10 phút.

### Domain và tại sao cần

| Không có domain | Có domain |
|----------------|-----------|
| Dùng IP hoặc `*.vercel.app` | URL đẹp, chuyên nghiệp |
| Không có HTTPS tự quản | HTTPS qua Let's Encrypt |
| Không tạo được Clerk production | Clerk production hoạt động |

---

## 9. Lỗi đã gặp và cách fix

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `unexpected keyword argument 'sslmode'` | asyncpg không hiểu cú pháp libpq | Đổi `sslmode=require` → `ssl=require` |
| `unexpected keyword argument 'channel_binding'` | Neon pooled connection có param lạ | Tắt connection pooling, dùng direct connection |
| API trả `404 Not Found` khi tạo nhà | `NEXT_PUBLIC_API_URL` thiếu `/api/v1` | Thêm `/api/v1` vào cuối URL |
| Clerk production lỗi domain | `*.vercel.app` không được chấp nhận | Cần custom domain thật |
| `could not create unique index` khi deploy | Production có data vi phạm constraint mới | Xóa/sửa data trùng trên Neon SQL Editor trước, rồi redeploy |

---

## 10. CI/CD với GitHub Actions

### CI vs CD

| | CI (Continuous Integration) | CD (Continuous Deployment) |
|--|----------------------------|---------------------------|
| **Là gì** | Tự động chạy test khi có code mới | Tự động deploy khi code merge vào main |
| **Chạy khi nào** | Mỗi push / mỗi PR | Sau khi merge vào main |
| **Mục đích** | Phát hiện lỗi sớm | Đưa code lên production nhanh |
| **Setup ở đâu** | `.github/workflows/ci.yml` | Vercel + Render tự làm |

**Hiểu đúng thứ tự:**

```
Developer push lên feature-branch
           │
           ▼
    GitHub nhận code
    ┌──────┴──────────────────┐
    │                         │
    ▼                         ▼
GitHub Actions (CI)      Chờ merge
chạy test
    │
✅ pass → cho phép merge
❌ fail → block merge
           │
           ▼ (sau khi merge vào main)
    Vercel + Render auto-deploy (CD)
```

> CI không chạy trước push — CI chạy sau push, trên server của GitHub.

### File ci.yml

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend:                        # Job 1: chạy pytest
    services:
      postgres:                   # Tạo DB tạm thời cho test
        image: postgres:16
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: uv sync --frozen
      - run: uv run alembic upgrade head   # migrate test DB
      - run: uv run pytest -v

  frontend:                       # Job 2: build TypeScript
    steps:
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: pnpm build
```

**2 jobs chạy song song** → tổng thời gian = job nào chậm hơn (không cộng lại).

### GitHub Secrets

Secrets là env vars nhạy cảm lưu trên GitHub, inject vào CI lúc chạy — không lộ trong code:

```yaml
env:
  CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}  # lấy từ GitHub Secrets
```

Thêm tại: **Repo → Settings → Secrets and variables → Actions**.

---

## 11. GitHub Flow — PR Workflow

### Tại sao không push thẳng vào main?

Push thẳng vào `main` → Vercel + Render deploy ngay → nếu code lỗi thì production bị vỡ.

### Branch Protection

Bật tại **Repo → Settings → Branches → Add ruleset**:
- ✅ Require a pull request before merging
- ✅ Require status checks to pass → thêm `Backend Tests`, `Frontend Build`

Kết quả: GitHub **chặn merge** vào `main` nếu CI chưa pass.

### Workflow hàng ngày

```bash
# 1. Tạo branch mới từ main
git checkout -b feat/ten-tinh-nang

# 2. Code, commit
git add .
git commit -m "feat: mô tả thay đổi"

# 3. Push branch lên GitHub
git push origin feat/ten-tinh-nang

# 4. Mở Pull Request trên GitHub
#    → CI tự chạy → pass → merge → Vercel/Render deploy

# 5. Sync local sau khi merge
git checkout main
git pull origin main
git branch -d feat/ten-tinh-nang   # xóa branch local
```

### 3 kiểu merge PR

| Option | Kết quả | Dùng khi |
|--------|---------|---------|
| **Create a merge commit** | Giữ tất cả commits + thêm merge commit | Team lớn, cần traceability |
| **Squash and merge** ← khuyên dùng | Gộp tất cả thành 1 commit | Branch có commit lộn xộn, muốn history gọn |
| **Rebase and merge** | Đặt commits lên đầu main, không merge commit | Muốn history thẳng tắp |

---

## 12. Git — Divergent Branches

### Khi nào xảy ra?

Khi local `main` và remote `main` có commits khác nhau — thường xảy ra sau khi squash merge PR (squash tạo commit mới với hash khác).

```
Local main:  A → B → C
Remote main: A → B → D   (D là squash commit của C)
→ Diverged!
```

### Cách fix

```bash
# Khi thay đổi đã có trên remote (qua PR) → reset local về remote
git reset --hard origin/main

# Khi muốn giữ local commits, đặt lên trên remote
git pull --rebase origin main
```

**`git reset --hard`** — hủy toàn bộ local changes, khớp hoàn toàn với remote. Dùng khi chắc chắn không mất gì quan trọng.

---

## 13. Lỗi đã gặp (bổ sung)

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `ERROR packages field missing or empty` (pnpm CI) | `pnpm-workspace.yaml` tồn tại nhưng không có field `packages` → pnpm hiểu nhầm là workspace mode | Thêm `packages: ['.']` vào `pnpm-workspace.yaml` |
| `fatal: Need to specify how to reconcile divergent branches` | Local và remote `main` có commit history khác nhau | `git reset --hard origin/main` |

---

## 14. Câu hỏi ôn tập

### Docker
1. Dockerfile là gì? Tại sao Render cần file này?
2. Tại sao lại COPY `pyproject.toml` trước rồi mới COPY toàn bộ code?
3. `.dockerignore` có tác dụng gì? Kể 3 thứ nên đưa vào file đó.
4. Sự khác nhau giữa `docker build` và `docker run` là gì?
5. Tại sao không được đưa file `.env` vào Docker image?

### Environment Variables
6. Tại sao không hardcode `DATABASE_URL` trực tiếp trong code?
7. Biến `NEXT_PUBLIC_API_URL` và `CLERK_SECRET_KEY` — cái nào có thể đọc từ browser? Tại sao?
8. Khi thêm env var mới trên Vercel, cần làm thêm bước gì để app nhận giá trị mới?
phải deploy lại frontend để build-time env vars được cập nhật.

### CORS
9. CORS là gì? Khi nào browser kích hoạt cơ chế này?
?
CORS (Cross-Origin Resource Sharing) là cơ chế bảo mật của browser, chặn request từ domain A gọi sang domain B nếu backend không cho phép. CORS được kích hoạt khi frontend và backend ở domain khác nhau (cross-origin).

10. Nếu quên update `CORS_ORIGINS` sau khi đổi domain Vercel, điều gì xảy ra?
?
Nếu quên update `CORS_ORIGINS` trên backend Render sau khi đổi domain Vercel, frontend sẽ bị browser chặn khi gọi API → app không hoạt động được, thường thấy lỗi CORS trong console.

11. Tại sao không nên dùng `allow_origins=["*"]` trong production?

### Database & SSL
12. Tại sao asyncpg dùng `?ssl=require` thay vì `?sslmode=require`?
13. Sự khác nhau giữa direct connection và pooled connection của Neon?
14. Khi nào cần chạy `alembic upgrade head` trên production?

### Workflow
15. Liệt kê 5 bước chính để deploy một app FastAPI + Next.js lên production.
16. Tại sao phải set `CORS_ORIGINS` trên Render **trước** khi test frontend?
17. Nếu deploy backend mới có breaking change trong API, cần làm gì trước khi push code?

### Tổng hợp
18. Giải thích tại sao Dockerfile viết cho Render có thể dùng lại trên VPS mà không cần sửa.
19. App đang dùng Clerk test keys. Để chuyển sang production keys cần làm những bước nào?
20. Cold start là gì? Nó ảnh hưởng như thế nào đến trải nghiệm người dùng trên Render free tier?

### Migration & Production data
34. Tại sao thêm UNIQUE constraint có thể làm fail deploy trên production?
35. Trước khi thêm UNIQUE constraint, cần kiểm tra gì trên DB?
36. Tại sao dùng Dockerfile CMD để chạy migration thay vì Pre-Deploy Command trên Render free tier?
37. `alembic upgrade head` là idempotent nghĩa là gì? Tại sao điều đó quan trọng khi đặt trong CMD?
38. Nếu migration fail trong CMD, điều gì xảy ra với version đang chạy trên Render?

### CI/CD
21. CI chạy trước hay sau khi push code lên GitHub? Tại sao?
22. Sự khác nhau giữa CI và CD là gì? Trong project này cái nào tự setup sẵn, cái nào phải tự làm?
23. GitHub Secrets là gì? Tại sao không đặt `CLERK_SECRET_KEY` trực tiếp trong file `ci.yml`?
24. Tại sao cần PostgreSQL service container trong CI job backend? Không dùng Neon production DB được không?
25. 2 jobs `backend` và `frontend` trong CI chạy tuần tự hay song song? Điều đó ảnh hưởng gì đến tốc độ?

### GitHub Flow & PR
26. Tại sao không nên push thẳng vào `main` sau khi bật Branch Protection?
27. Branch Protection "Require status checks to pass" có tác dụng gì?
28. Giải thích sự khác nhau giữa 3 kiểu merge: merge commit, squash, rebase.
29. Khi nào nên dùng `Squash and merge`? Lợi ích so với merge commit thông thường?
30. Sau khi merge PR và xóa branch trên GitHub, cần làm gì ở local để đồng bộ?

### Git
31. "Divergent branches" nghĩa là gì? Trong project này nó xảy ra do đâu?
32. `git reset --hard origin/main` làm gì? Khi nào nên dùng lệnh này?
33. Sự khác nhau giữa `git pull --rebase` và `git pull --no-rebase` (merge)?
