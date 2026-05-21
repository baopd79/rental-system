# Deploy Spec: Rental System — Production

## Objective

Deploy rental-system lên production sử dụng managed PaaS miễn phí:

- **Neon** → PostgreSQL database (serverless, free tier)
- **Render** → FastAPI backend (Web Service)
- **Vercel** → Next.js frontend

**Người dùng cuối:** Chủ nhà đăng nhập qua Clerk, quản lý nhà trọ.
**Thành công:** App chạy được tại `*.vercel.app` + `*.onrender.com`, đăng nhập Clerk hoạt động, tạo được hóa đơn.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js | 16.x |
| Backend | FastAPI + SQLModel | Python 3.12 |
| Database | PostgreSQL | 16 |
| Auth | Clerk | — |
| Container | Docker | — |

---

## Các tài khoản cần tạo trước

- [ ] [github.com](https://github.com) — lưu code (cần push project lên đây trước)
- [ ] [neon.tech](https://neon.tech) — database (free, không cần credit card)
- [ ] [render.com](https://render.com) — backend (free tier)
- [ ] [vercel.com](https://vercel.com) — frontend (free tier)
- [ ] Clerk production instance — tạo trong Clerk Dashboard

---

## Cấu trúc thay đổi cần làm

```
rental-system/
├── backend/
│   └── Dockerfile          ← TẠO MỚI (Render cần file này)
├── frontend/
│   └── (không thay đổi)    ← Vercel tự detect Next.js
└── DEPLOY.md               ← File này
```

---

## Biến môi trường

### Backend (Render)

| Biến | Giá trị | Lấy ở đâu |
|------|---------|-----------|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@host/db` | Neon dashboard |
| `CLERK_JWKS_URL` | `https://<clerk-domain>/.well-known/jwks.json` | Clerk Dashboard → API Keys |
| `CLERK_AUDIENCE` | (để trống hoặc domain của bạn) | Clerk Dashboard |
| `CORS_ORIGINS` | `["https://your-app.vercel.app"]` | Vercel deployment URL |

### Frontend (Vercel)

| Biến | Giá trị | Lấy ở đâu |
|------|---------|-----------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | Clerk Dashboard → API Keys |
| `CLERK_SECRET_KEY` | `sk_live_...` | Clerk Dashboard → API Keys |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` | Cố định |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` | Cố định |
| `NEXT_PUBLIC_API_URL` | `https://your-backend.onrender.com/api/v1` | Render deployment URL |

---

## Tasks

### Phase 1: Chuẩn bị codebase

- [ ] **T1** Tạo `backend/Dockerfile`
  - Accept: `docker build` không lỗi; container start được
  - Files: `backend/Dockerfile`

- [ ] **T2** Push code lên GitHub repository
  - Accept: repo public/private tồn tại, branch `main` có code mới nhất
  - Verify: `git push origin main` thành công

---

### Phase 2: Database — Neon

- [ ] **T3** Tạo Neon project + database
  - Accept: Connection string dạng `postgresql+asyncpg://...` copy được
  - Verify: `psql <connection_string>` connect được

- [ ] **T4** Chạy migrations trên Neon
  - Accept: 13 tables tồn tại trong Neon DB
  - Command: `DATABASE_URL=<neon_url> uv run alembic upgrade head`
  - Verify: `psql <url> -c "\dt"` liệt kê đủ tables

---

### Phase 3: Backend — Render

- [ ] **T5** Tạo Render Web Service từ GitHub repo
  - Accept: Service tạo thành công, config trỏ đúng `backend/` folder
  - Setting: Root Directory = `backend`, Docker runtime

- [ ] **T6** Thêm environment variables trên Render
  - Accept: Tất cả biến trong bảng Backend ở trên được set
  - Verify: Render "Environment" tab không còn biến nào trống

- [ ] **T7** Deploy backend lần đầu
  - Accept: `GET https://your-backend.onrender.com/health` trả `{"status":"ok"}`
  - Verify: Render deploy log không có ERROR

---

### Phase 4: Frontend — Vercel

- [ ] **T8** Import GitHub repo vào Vercel
  - Accept: Project tạo thành công, Vercel detect được Next.js
  - Setting: Root Directory = `frontend`

- [ ] **T9** Thêm environment variables trên Vercel
  - Accept: Tất cả biến trong bảng Frontend ở trên được set
  - Verify: Vercel "Environment Variables" tab đủ 5 biến

- [ ] **T10** Deploy frontend lần đầu
  - Accept: `https://your-app.vercel.app` load được trang landing page
  - Verify: Không có build error trong Vercel deployment log

---

### Phase 5: Clerk Production

- [ ] **T11** Tạo Clerk production instance
  - Accept: Có `pk_live_...` và `sk_live_...` keys
  - Note: Clerk free tier cho phép production

- [ ] **T12** Thêm production URL vào Clerk allowed origins
  - Accept: `https://your-app.vercel.app` trong Clerk → Settings → Domains
  - Verify: Sign-in flow hoạt động trên production URL

- [ ] **T13** Cập nhật env vars trên Vercel + Render với Clerk production keys
  - Accept: Redeploy cả hai services với live keys
  - Verify: Đăng nhập thành công trên production app

---

### Phase 6: Smoke Test

- [ ] **T14** Happy path E2E trên production
  - [ ] Đăng nhập thành công
  - [ ] Tạo property mới
  - [ ] Tạo room
  - [ ] Tạo tenant + contract
  - [ ] Nhập chỉ số điện
  - [ ] Generate hóa đơn
  - [ ] Xem public invoice link

---

## Kiến thức cần nắm

| Khái niệm | Giải thích ngắn |
|-----------|----------------|
| **Dockerfile** | File mô tả cách đóng gói app vào container. Render dùng file này để build và chạy backend. |
| **Environment variables** | Cấu hình nhạy cảm (password, API keys) không được commit vào code — truyền qua env vars. |
| **CORS** | Cơ chế browser bảo vệ: backend phải khai báo domain nào được phép gọi API. |
| **Migration on deploy** | Khi schema thay đổi, phải chạy `alembic upgrade head` để cập nhật database production. |
| **Free tier cold start** | Render free tier "ngủ" sau 15 phút không dùng → request đầu tiên chậm ~30s. Bình thường. |

---

## Boundaries

- **Always:** Set env vars qua Render/Vercel dashboard — không commit `.env` lên GitHub
- **Ask first:** Thêm domain tùy chỉnh, setup custom subdomain, cấu hình auto-scaling
- **Never:** Commit `CLERK_SECRET_KEY` hay `DATABASE_URL` vào source code

---

## Success Criteria

1. Frontend accessible tại `https://[app].vercel.app`
2. Backend accessible tại `https://[app].onrender.com/health`
3. Đăng nhập Clerk hoạt động trên production
4. Tạo + xem hóa đơn thành công
5. Public invoice link mở được không cần đăng nhập
