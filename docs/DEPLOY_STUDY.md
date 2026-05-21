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

---

## 10. Câu hỏi ôn tập

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

### CORS
9. CORS là gì? Khi nào browser kích hoạt cơ chế này?
10. Nếu quên update `CORS_ORIGINS` sau khi đổi domain Vercel, điều gì xảy ra?
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
