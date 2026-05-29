# Frontend Architecture

Tài liệu này giải thích cách frontend hoạt động — dành cho người đã quen với backend FastAPI và muốn hiểu cấu trúc Next.js.

---

## 1. Stack và công cụ

| Thành phần | Công nghệ |
|---|---|
| Framework | Next.js 15 (App Router) |
| Ngôn ngữ | TypeScript |
| Auth | Clerk (`@clerk/nextjs`) |
| UI components | shadcn/ui (Radix UI primitives + Tailwind) |
| CSS | Tailwind v4 + inline styles + CSS variables |
| Package manager | pnpm |
| API client | custom `apiFetch`/`apiJson` trong `lib/api.ts` |

---

## 2. Cấu trúc thư mục

```
frontend/
├── app/                        ← Next.js App Router
│   ├── layout.tsx              ← Root layout: ClerkProvider + font
│   ├── page.tsx                ← Landing page (public)
│   ├── (auth)/                 ← Route group: trang đăng nhập/ký
│   │   ├── layout.tsx          ← Layout 2 panel (brand trái + form phải)
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   ├── (dashboard)/            ← Route group: app chính (cần auth)
│   │   ├── layout.tsx          ← Sidebar + Topbar wrapper
│   │   ├── dashboard/page.tsx  ← Trang tổng quan
│   │   ├── properties/         ← Nhà trọ
│   │   │   ├── page.tsx        ← Danh sách properties
│   │   │   └── [id]/page.tsx   ← Chi tiết 1 property (rooms)
│   │   ├── rooms/[id]/
│   │   │   ├── page.tsx        ← Chi tiết phòng
│   │   │   └── utility/page.tsx ← Lịch sử ghi chỉ số
│   │   ├── tenants/page.tsx
│   │   ├── contracts/page.tsx
│   │   ├── invoices/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx   ← Chi tiết hóa đơn
│   │   ├── utilities/page.tsx  ← Ghi chỉ số tháng
│   │   └── settings/page.tsx
│   └── invoice/public/[token]/page.tsx  ← Public, không cần auth
│
├── components/
│   ├── app/                    ← Components nghiệp vụ
│   │   ├── sidebar.tsx         ← Sidebar navigation
│   │   ├── topbar.tsx          ← Topbar (user menu, mobile hamburger)
│   │   ├── *-form.tsx          ← Form tạo/sửa (tenant, property, room...)
│   │   └── *-drawer.tsx        ← Drawer panel từ phải
│   └── ui/                     ← UI primitives tái sử dụng
│       ├── dialog.tsx          ← Modal dialog
│       ├── alert-dialog.tsx    ← Confirm dialog
│       ├── dropdown-menu.tsx   ← Dropdown menu
│       ├── kpi-card.tsx        ← Card số liệu tổng quan
│       ├── page-header.tsx     ← Tiêu đề trang
│       ├── empty-state.tsx     ← Trạng thái danh sách trống
│       └── status-badge.tsx    ← Badge trạng thái
│
├── lib/
│   ├── api.ts                  ← apiFetch / apiJson
│   ├── format.ts               ← fmtMoney, fmtDate, fmtPeriod
│   └── utils.ts                ← cn() (classname merge)
│
├── types/                      ← TypeScript types (mirror backend schemas)
│   ├── property.ts
│   ├── room.ts
│   ├── tenant.ts
│   ├── contract.ts
│   ├── invoice.ts
│   ├── billing.ts
│   ├── utility.ts
│   ├── surcharge.ts
│   ├── shared-meter.ts
│   └── dashboard.ts
│
├── hooks/
│   └── use-is-mobile.ts        ← useIsMobile() hook
│
└── middleware.ts               ← Clerk auth guard
```

---

## 3. Cách Next.js App Router hoạt động

### So sánh với backend

Backend FastAPI dùng:
```
Router → request vào → handler → response ra
```

Next.js App Router dùng:
```
URL → file system → page component → render HTML/JSON
```

Mỗi folder trong `app/` tương ứng với một URL segment. File `page.tsx` trong folder đó là component được render.

### Route Groups — dấu ngoặc `(tên)`

Dấu ngoặc đơn trong tên folder **không ảnh hưởng đến URL**, chỉ dùng để nhóm các trang có cùng layout.

```
app/(dashboard)/properties/page.tsx  →  URL: /properties
app/(auth)/sign-in/page.tsx          →  URL: /sign-in
```

- `(dashboard)/layout.tsx` bọc tất cả trang trong dashboard bằng Sidebar + Topbar.
- `(auth)/layout.tsx` bọc trang sign-in/sign-up bằng layout 2 panel đặc biệt.

### Dynamic routes — dấu ngoặc vuông `[id]`

```
app/(dashboard)/properties/[id]/page.tsx  →  URL: /properties/123
```

Tương tự `@router.get("/properties/{id}")` trong FastAPI. Giá trị `id` được truyền vào component qua `params`.

### Catch-all routes — `[[...slug]]`

```
app/(auth)/sign-in/[[...sign-in]]/page.tsx
```

Clerk cần route này để xử lý nhiều bước auth (OTP, OAuth callback). `[[...]]` là optional catch-all — match cả `/sign-in` lẫn `/sign-in/factor-one` v.v.

---

## 4. Authentication với Clerk

### Luồng hoạt động

```
Request từ user
       │
       ▼
middleware.ts (Clerk middleware)
       │ route công khai? (/, /sign-in, /invoice/public/*)
       ├── Có  →  pass through
       └── Không → kiểm tra Clerk session cookie
                       │ Có session hợp lệ?
                       ├── Có  → pass through
                       └── Không → redirect về /sign-in
```

### `middleware.ts`

```typescript
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/invoice/public/(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();  // redirect về /sign-in nếu chưa đăng nhập
  }
});
```

Tương tự `CurrentUserDep` trong FastAPI — mọi route không public đều phải đăng nhập.

### Lấy JWT trong component

```typescript
// Trong "use client" component
const { getToken } = useAuth();  // hook từ Clerk

// Gọi API
const data = await apiJson<Property[]>("/properties", getToken);
```

`getToken()` trả về JWT ngắn hạn (~1 giờ). Clerk tự động làm mới từ session cookie. JWT này được đính vào mọi request tới backend qua `Authorization: Bearer <token>`.

### Clerk session vs JWT

| | Session cookie (`__session`) | JWT |
|---|---|---|
| Loại | HttpOnly cookie | In-memory (JS) |
| Thời hạn | ~1 tháng | ~1 giờ |
| Backend dùng? | Không | Có |
| Xem được từ JS? | Không | Có (`getToken()`) |

---

## 5. API Layer — `lib/api.ts`

Đây là lớp trung gian giữa component và backend, tương tự `httpx.AsyncClient` trong Python tests.

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

// apiFetch: gọi API, trả về raw Response
export async function apiFetch(
  path: string,
  getToken: () => Promise<string | null>,
  options = {}
): Promise<Response>

// apiJson: gọi API, parse JSON, ném Error nếu !res.ok
export async function apiJson<T>(
  path: string,
  getToken: () => Promise<string | null>,
  options = {}
): Promise<T>
```

### Cách dùng

```typescript
// GET
const properties = await apiJson<Property[]>("/properties", getToken);

// POST
const tenant = await apiJson<Tenant>("/tenants", getToken, {
  method: "POST",
  body: { full_name: "Nguyễn Văn A", phone: "0901234567" },
});

// PATCH
const updated = await apiJson<Tenant>(`/tenants/${id}`, getToken, {
  method: "PATCH",
  body: { phone: "0999999999" },
});

// DELETE (dùng apiFetch để kiểm tra status code)
const res = await apiFetch(`/properties/${id}`, getToken, { method: "DELETE" });
if (!res.ok) { /* handle error */ }
```

`body` được tự động `JSON.stringify()` và gán `Content-Type: application/json`.

---

## 6. State Management

Không dùng Redux, Zustand, hay bất kỳ thư viện state nào. Chỉ dùng React built-ins:

- **`useState`** — state local trong component
- **`useEffect`** — fetch data khi component mount
- **`useCallback`** — memoize hàm `load()` để tránh infinite loop
- **`useMemo`** — tính toán derived state (filter, sort, page)

### Pattern điển hình cho một trang (ví dụ PropertiesPage)

```typescript
export default function PropertiesPage() {
  const { getToken } = useAuth();

  // 1. State chính
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  // 2. UI state
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [drawerProperty, setDrawerProperty] = useState<Property | null>(null);

  // 3. Fetch data
  const load = useCallback(async () => {
    const data = await apiJson<Property[]>("/properties", getToken);
    setProperties(data);
    setLoading(false);
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  // 4. Derived state (useMemo để tránh recalculate mỗi render)
  const filtered = useMemo(() =>
    properties.filter(p => p.name.includes(search)),
    [properties, search]
  );

  // 5. Action handlers
  function handleSaved(p: Property) {
    setProperties(prev => editing
      ? prev.map(x => x.id === p.id ? p : x)  // update
      : [p, ...prev]                            // insert
    );
    setShowForm(false);
  }

  // 6. Render
  return (
    <div>
      {/* Filter bar, table, dialogs... */}
      {drawerProperty && <PropertyDrawer property={drawerProperty} onClose={() => setDrawerProperty(null)} />}
      <Dialog open={showForm}>
        <PropertyForm onSuccess={handleSaved} onCancel={() => setShowForm(false)} />
      </Dialog>
    </div>
  );
}
```

**Không có global state** — mỗi trang quản lý state của mình. Khi drawer thay đổi data, nó gọi callback (`onSuccess`) để trang cha cập nhật state.

---

## 7. Pattern: Drawer

Thay vì navigate sang trang mới khi click vào một item, app dùng **drawer** (panel trượt từ phải). Lý do: không mất context của danh sách đang xem.

```
Trang danh sách
┌──────────────────────────────────────────────────────┐
│  Properties               [Thêm nhà mới]             │
│  ┌─────────────────────────────────────┐             │
│  │ Nhà A  │ 5/8 phòng │ 15tr/tháng    │◀── click    │
│  │ Nhà B  │ 3/6 phòng │  9tr/tháng    │             │
│  └─────────────────────────────────────┘             │
└───────────────────────────────────┬─────────────────┘
                          Drawer mở ra từ phải ▼
                          ┌──────────────────────────┐
                          │ Nhà A                 ✕  │
                          │ 123 Đường ABC, Q.1       │
                          │ ─────────────────────    │
                          │ Phòng 101 · Đang thuê    │
                          │ Phòng 102 · Trống        │
                          └──────────────────────────┘
```

Cách implement:
```typescript
// Trong trang cha
const [drawerItem, setDrawerItem] = useState<Property | null>(null);

// Row click → mở drawer
<tr onClick={() => setDrawerItem(property)}>

// Drawer render (null = đóng)
<PropertyDrawer
  property={drawerItem}
  onClose={() => setDrawerItem(null)}
  onEdit={(p) => { /* cập nhật list */ }}
/>
```

---

## 8. Pattern: Form → callback

Form không tự navigate hay fetch lại data. Nó gọi `onSuccess(result)` khi lưu thành công.

```typescript
// PropertyForm nhận props
type Props = {
  property?: Property;   // undefined = tạo mới, có giá trị = sửa
  onSuccess: (p: Property) => void;
  onCancel: () => void;
};

// Bên trong form
async function handleSubmit(e) {
  const result = property
    ? await apiJson<Property>(`/properties/${property.id}`, getToken, { method: "PATCH", body })
    : await apiJson<Property>("/properties", getToken, { method: "POST", body });
  onSuccess(result);  // trả kết quả cho trang cha xử lý
}
```

Trang cha quyết định làm gì với kết quả: cập nhật list, đóng dialog, show toast...

---

## 9. Hệ thống CSS

### CSS Variables (trong `globals.css`)

Thay vì hardcode màu, dùng CSS variables để hỗ trợ dark/light mode và nhất quán:

```css
--vn-bg       /* nền trang */
--vn-surface  /* nền card, bảng */
--vn-border   /* màu border */
--vn-text     /* text chính */
--vn-text-2   /* text phụ */
--vn-text-3   /* text mờ nhất */

--blue-600    /* màu primary (actions, links) */
--green-600   /* trạng thái active/paid */
--amber-600   /* cảnh báo */
--red-600     /* lỗi, xóa */

--sh-xs       /* shadow nhỏ */
--sh-sm       /* shadow vừa */
--sh-md       /* shadow lớn hơn */
--sh-pop      /* shadow nổi bật */
```

### Cách dùng inline styles

Đa số styling dùng inline styles với CSS variables:
```tsx
<div style={{
  background: "var(--vn-surface)",
  border: "1px solid var(--vn-border)",
  borderRadius: 12,
  boxShadow: "var(--sh-xs)",
}}>
```

Lý do dùng inline styles thay vì Tailwind: dễ đọc hơn với values phức tạp, và không cần nhớ Tailwind class names cho custom values.

### CSS utility classes

Một số class dùng trong `globals.css`:

| Class | Tác dụng |
|---|---|
| `page-pad` | Padding chuẩn cho nội dung trang |
| `grid-kpi` | 4 cột (2 cột trên mobile) |
| `grid-2col` | 2 cột đều nhau |
| `stat-strip` | 4 ô ngang (2×2 trên mobile) |
| `vn-drawer` | Panel drawer |
| `table-scroll` | Scroll ngang trên mobile |
| `filter-bar` | Thanh search + filter |

---

## 10. Types — mirror backend schemas

Mỗi Pydantic schema phía backend có type tương ứng ở frontend trong `types/`:

| Backend | Frontend |
|---|---|
| `PropertyRead` | `types/property.ts → Property` |
| `TenantRead` | `types/tenant.ts → Tenant` |
| `ContractRead` | `types/contract.ts → Contract` |
| `InvoiceListRead` | `types/invoice.ts → InvoiceListItem` |

Ngoài types còn có helper constants:
```typescript
// contract.ts
export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  active: "Đang thuê",
  ended: "Đã kết thúc",
};

// property.ts
export const WATER_CALC_LABELS: Record<WaterCalcType, string> = { ... };
```

---

## 11. Server Components vs Client Components

Next.js App Router có 2 loại component:

| | Server Component (mặc định) | Client Component (`"use client"`) |
|---|---|---|
| Render ở | Server | Browser |
| Dùng useState? | Không | Có |
| Dùng useEffect? | Không | Có |
| Dùng Clerk hooks? | Không | Có |
| Fetch data | Trực tiếp (async/await) | Qua API calls |

**Trong project này**, hầu hết pages và components dùng `"use client"` vì:
- Cần `useAuth()` để lấy JWT
- Cần `useState`/`useEffect` cho interactive UI
- Data phụ thuộc vào user đang đăng nhập

Một số components không có `"use client"` (Server Components): `app/layout.tsx`, `(auth)/layout.tsx` — vì chúng chỉ render layout tĩnh.

---

## 12. Vòng đời request hoàn chỉnh

Khi user mở trang `/properties`:

```
1. Browser request → Next.js server
2. middleware.ts kiểm tra Clerk session cookie
   → Có session → tiếp tục
   → Không có → redirect /sign-in
3. Server render (dashboard)/layout.tsx + properties/page.tsx
   → Trả về HTML tĩnh ban đầu (loading state)
4. HTML load vào browser, JavaScript hydrate
5. useEffect trong PropertiesPage chạy
6. getToken() gọi tới Clerk SDK → lấy JWT
7. apiJson<Property[]>("/properties", getToken) gọi:
   fetch("http://localhost:8000/api/v1/properties", {
     headers: { Authorization: "Bearer eyJhbGc..." }
   })
8. Backend FastAPI nhận request:
   → verify_clerk_token() decode JWT → clerk_user_id
   → PropertyService.list_properties(clerk_user_id)
   → query DB WHERE property.clerk_user_id = ?
   → trả JSON
9. Frontend nhận JSON → setProperties(data) → re-render
```

---

## 13. Public Invoice

Trang `/invoice/public/[token]` không cần đăng nhập. Backend có endpoint `/invoices/public/{token}` trả dữ liệu hóa đơn (không có CCCD/SĐT vì public).

Frontend page này không dùng `useAuth()`, chỉ fetch trực tiếp với token từ URL.

---

## 14. Các helper functions

### `lib/format.ts`
```typescript
fmtMoney(1500000)    // "1.500.000₫"
fmtDate("2026-01-15")  // "15/01/2026"
fmtPeriod("2026-01")   // "T1/2026"
currentPeriod()         // "2026-05" (tháng hiện tại)
```

### `hooks/use-is-mobile.ts`
```typescript
const isMobile = useIsMobile();  // true nếu màn hình < 768px
```

Dùng để quyết định hiển thị khác nhau trên mobile (ví dụ: ẩn cột bảng, đổi layout).

---

## 15. Env variables

```bash
# .env.local (frontend)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...   # public, đọc được từ browser
CLERK_SECRET_KEY=sk_test_...                    # private, chỉ server đọc
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1 # URL backend
```

Prefix `NEXT_PUBLIC_` = biến đó được bundle vào JavaScript client (browser có thể đọc). Biến không có prefix chỉ server đọc được.

---

## 16. Layout từng trang — tên component/class

### Dashboard layout tổng thể

```
┌─────────────────────────────────────────────────────────┐
│ Sidebar (trái)  │  Topbar (trên)                        │
│                 ├───────────────────────────────────────┤
│                 │  PageHeader                           │
│                 ├───────────────────────────────────────┤
│                 │  Nội dung trang (children)            │
└─────────────────┴───────────────────────────────────────┘
```

### Trang Dashboard (`/dashboard`)

```
PageHeader
KPI Section (class: grid-kpi — 4 cột, 2 cột trên mobile)
  ├── KpiCard: Phòng đang cho thuê
  ├── KpiCard: Doanh thu tháng này
  ├── KpiCard: Hóa đơn chưa thanh toán
  └── KpiCard: Hợp đồng sắp hết hạn
RevenueChart (biểu đồ cột doanh thu 12 tháng)
Bottom Grid (class: grid-2col — 2 cột, 1 cột trên mobile)
  ├── ExpiringList (hợp đồng sắp hết hạn)
  └── UnpaidList (hóa đơn chưa thanh toán)
```

### Trang Property Detail (`/properties/[id]`)

```
PageHeader (tên nhà + nút Cài đặt / Thêm phòng)
Stat Strip (class: stat-strip — 4 ô ngang, 2×2 trên mobile)
  ├── Tổng phòng
  ├── Đang thuê
  ├── Trống
  └── Bảo trì
Info Bar (giá điện, giá nước, phụ phí)
Room Grid (danh sách phòng dạng card)
```

### Drawers (panel trượt từ phải)

| Drawer | Mở khi |
|---|---|
| `PropertyDrawer` | Click vào row trong danh sách properties |
| `PropertyConfigDrawer` | Nút "Cài đặt" trên property detail |
| `ContractDrawer` | Click vào hợp đồng |
| `TenantDrawer` | Click vào khách thuê |
| `InvoiceDrawer` | Click vào hóa đơn |
| `InvoiceGenerateDrawer` | Nút "Tạo hóa đơn" (2 panel: form → preview, slide transition) |

### UI Components (`components/ui/`)

| Component | Dùng cho |
|---|---|
| `KpiCard` | Số liệu tổng quan (dashboard) |
| `PageHeader` | Tiêu đề + mô tả + action buttons của mỗi trang |
| `EmptyState` | Khi danh sách trống |
| `StatusBadge` | Trạng thái hóa đơn (`draft`/`sent`/`paid`) |
| `RoomStatusBadge` | Trạng thái phòng (`vacant`/`occupied`/`maintenance`) |

### CSS Layout Helpers (`globals.css`)

| Class | Dùng cho |
|---|---|
| `page-pad` | Padding chuẩn cho nội dung trang |
| `grid-kpi` | 4 cột đều nhau (2 cột trên mobile) |
| `grid-2col` | 2 cột đều nhau (1 cột trên mobile) |
| `stat-strip` | Thanh 4 ô ngang trong property detail (2×2 trên mobile) |
| `vn-drawer` | Panel drawer từ phải |
| `glass-panel` | Glassmorphism cho dialog/popover |
| `filter-bar` | Thanh tìm kiếm + filter |
| `page-header-row` | Row title + actions (stack dọc trên mobile) |
| `table-scroll` | Bảng có scroll ngang trên mobile |
