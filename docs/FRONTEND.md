# Frontend Structure

## Cấu trúc thư mục

```
frontend/
├── app/
│   ├── (dashboard)/          ← Layout có Sidebar (auth required)
│   │   ├── layout.tsx        ← Sidebar + Topbar wrapper
│   │   ├── dashboard/        ← Trang tổng quan
│   │   ├── properties/       ← Danh sách + chi tiết nhà trọ
│   │   ├── rooms/            ← Danh sách phòng
│   │   ├── tenants/          ← Khách thuê
│   │   ├── contracts/        ← Hợp đồng
│   │   ├── invoices/         ← Hóa đơn
│   │   ├── utilities/        ← Ghi chỉ số điện nước
│   │   └── settings/         ← Cài đặt
│   ├── (auth)/               ← Sign-in / Sign-up (Clerk)
│   ├── invoices/public/      ← Public invoice (không cần đăng nhập)
│   └── page.tsx              ← Landing page
├── components/
│   ├── app/                  ← Components nghiệp vụ
│   └── ui/                   ← Components tái sử dụng (shadcn + custom)
└── lib/
    ├── api.ts                ← apiJson / apiFetch helpers
    └── utils.ts
```

---

## Layout trang Dashboard

```
┌─────────────────────────────────────────────────────────┐
│ Sidebar (trái)  │  Topbar (trên)                        │
│                 ├───────────────────────────────────────┤
│                 │  PageHeader                           │
│                 │  (title + description + actions)      │
│                 ├───────────────────────────────────────┤
│                 │  Nội dung trang                       │
│                 │                                       │
└─────────────────┴───────────────────────────────────────┘
```

---

## Trang Dashboard (`/dashboard`)

```
PageHeader
KPI Section (grid-kpi — 4 cột)
  ├── KpiCard: Phòng đang cho thuê
  ├── KpiCard: Doanh thu tháng này
  ├── KpiCard: Hóa đơn chưa thanh toán
  └── KpiCard: Hợp đồng sắp hết hạn
RevenueChart (biểu đồ cột doanh thu 12 tháng)
Bottom Grid (grid-2col — 2 cột)
  ├── ExpiringList (hợp đồng sắp hết hạn)
  └── UnpaidList (hóa đơn chưa thanh toán)
```

---

## Trang Property Detail (`/properties/[id]`)

```
PageHeader (tên nhà + nút Cài đặt / Thêm phòng)
Stat Strip (stat-strip — 4 ô ngang)
  ├── Tổng phòng
  ├── Đang thuê
  ├── Trống
  └── Bảo trì
Info Bar (giá điện, giá nước, phụ phí)
Room Grid (danh sách phòng dạng card)
```

---

## Drawers (panel trượt từ phải)

| Drawer | Mở khi |
|--------|--------|
| `PropertyDrawer` | Click vào property trong danh sách |
| `PropertyConfigDrawer` | Nút "Cài đặt" trên property detail |
| `ContractDrawer` | Click vào hợp đồng |
| `TenantDrawer` | Click vào khách thuê |
| `InvoiceDrawer` | Click vào hóa đơn |
| `InvoiceGenerateDrawer` | Nút "Tạo hóa đơn" (2 panel: form → preview) |

---

## UI Components (`components/ui/`)

| Component | Dùng cho |
|-----------|----------|
| `KpiCard` | Số liệu tổng quan (dashboard) |
| `PageHeader` | Tiêu đề + mô tả + action buttons của mỗi trang |
| `EmptyState` | Khi danh sách trống |
| `StatusBadge` | Trạng thái hóa đơn (draft/sent/paid) |
| `RoomStatusBadge` | Trạng thái phòng (vacant/occupied/maintenance) |

---

## CSS Layout Helpers (`globals.css`)

| Class | Dùng cho |
|-------|----------|
| `page-pad` | Padding chuẩn cho nội dung trang |
| `grid-kpi` | 4 cột đều nhau (2 cột trên mobile) |
| `grid-2col` | 2 cột đều nhau (1 cột trên mobile) |
| `stat-strip` | Thanh 4 ô ngang trong property detail (2×2 trên mobile) |
| `vn-drawer` | Panel drawer từ phải |
| `glass-panel` | Glassmorphism cho dialog/popover |
| `filter-bar` | Thanh tìm kiếm + filter |
| `page-header-row` | Row title + actions (stack dọc trên mobile) |
| `table-scroll` | Bảng có scroll ngang trên mobile |
