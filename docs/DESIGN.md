# VnRental — Design System & Screen Spec

> Hệ thống quản lý nhà trọ cho chủ trọ Việt Nam.
> File này mô tả design tokens, components và toàn bộ màn hình đã thiết kế.

---

## 1. Triết lý thiết kế

| Nguyên tắc | Diễn giải |
|---|---|
| **Trust-first** | Đây là sản phẩm tài chính — chủ trọ giao tiền vào hệ thống. Dùng palette xanh dương trầm (#2563EB), nền trắng, viền nhẹ. Không gradient lòe loẹt. |
| **Density có kiểm soát** | Chủ trọ nhìn hàng chục phòng & hóa đơn / ngày — type 13–14px là baseline, KPI 26px, không nhỏ hơn 11px. |
| **Tabular numbers everywhere** | Mọi con số tiền/chỉ số dùng `font-variant-numeric: tabular-nums`. Đơn giá hiển thị `3.500 ₫` (dấu chấm phân cách hàng nghìn, kiểu VN). |
| **Status qua màu thanh dọc 4px** | Card phòng / hàng table dùng bar trái 4px màu trạng thái thay vì tô nền — đỡ ồn mắt. |
| **Drawer thay vì page jump** | Click vào item mở drawer phải 520px — giữ context list, edit nhanh. |
| **Vietnamese-first copy** | Toàn bộ UI tiếng Việt. Số tiền theo locale `vi-VN`. Không dùng emoji trừ greeting. |

---

## 2. Design tokens

### Typography

```
Sans: "Geist" 300/400/450/500/600/700
Mono: "Geist Mono" 400/500/600
Feature settings: "ss01", "cv11", "tnum"
Letter spacing baseline: -0.005em (body), -0.018em (headings)
```

| Token | Size | Use |
|---|---|---|
| Display | 30–34px / 600 | Số tiền hero trong drawer |
| Heading 1 | 18–19px / 600 | Page title, modal title |
| Heading 2 | 14.5px / 600 | Section header |
| Body | 13.5–14px / 450 | Default |
| Small | 12–12.5px / 450 | Meta, hint |
| Caption | 11–11.5px / 500 uppercase letterspacing 0.06em | Section eyebrow |
| Mono | 12–14px / 500–600 | Mã phòng, mã hóa đơn, số chỉ số |

### Color palette

**Brand**
```
--blue-50    #EFF6FF    bg muted
--blue-100   #DBEAFE    bg accent / badge
--blue-200   #BFDBFE    border accent
--blue-500   #3B82F6    chart fill light
--blue-600   #2563EB    primary action ★
--blue-700   #1D4ED8    primary hover / text emphasis
--blue-900   #1E3A8A    text on light tint
```

**Neutrals (cool slate)**
```
--slate-50   #F8FAFC    canvas / footer
--slate-100  #F1F5F9    chip bg / hover
--slate-150  #E9EEF4    progress track
--slate-200  #E2E8F0    divider on tint
--slate-300  #CBD5E1    placeholder dot
--slate-400  #94A3B8    icon muted
--slate-500  #64748B    icon default
--slate-600  #475569    text secondary
--slate-700  #334155    text strong
--slate-800  #1E293B    rare
--slate-900  #0F172A    text primary ★
```

**Status**
```
Success  green-600 #059669 / green-50 #ECFDF5    Hoạt động, Đã thanh toán
Warning  amber-600 #D97706 / amber-50 #FFFBEB    HĐ sắp hết, Bảo trì
Danger   red-600   #DC2626 / red-50   #FEF2F2    Quá hạn
Accent   violet-600 #7C3AED / violet-50 #F5F3FF  HĐ sắp hết hạn
```

### Surfaces & borders

```
--bg          #F7F8FA   app canvas
--surface     #FFFFFF   cards, drawer, inputs
--border      #E5E9F0   default
--border-strong #D5DBE5 input dashed / emphasis
```

### Radius

```
--r-xs  4px    badge dot
--r-sm  6px    btn-sm, btn-xs
--r-md  8px    button, input, chip
--r-lg  10px   card thường (room card, summary)
--r-xl  14px   card lớn (KPI, chart)
--r-2xl 18px   modal
--r-full 999px badge, pill, filter chip
```

### Shadow

```
--sh-xs   1px subtle           card resting
--sh-sm   1+2px                input focus ring base
--sh-md   4+2px                hover card / nested
--sh-lg   18+8px                drawer
--sh-pop  24+8px                modal
```

### Spacing rhythm

Layout grids dùng 8–14–18–24px. Card padding 16–20px. Form field gap 14px. Section gap 32px.

---

## 3. Components

### Buttons

| Variant | Use |
|---|---|
| `btn-primary` | Action chính, bg `--blue-600`, text trắng. 1 cái / màn hình. |
| `btn-secondary` | Action phụ, viền `--border`, bg trắng |
| `btn-ghost` | Tertiary, transparent, hover slate-100 |
| `btn-sm` (h 30) | Toolbar, modal footer |
| `btn-xs` (h 26) | Inline trong table / card |
| `btn-icon` | Square 32×32 hoặc 26/30, icon-only |

Default height 36px. Border-radius `--r-md`.

### Form inputs (custom — không dùng `<input>` thật)

- **TxtInput** — h 40, có thể có prefix/suffix/mono. Trạng thái focus: border 1.5px `--blue-600` + ring `rgba(37,99,235,.14)`.
- **Select** — như TxtInput + chevron-d cuối.
- **RadioCard** — option lớn có icon + title + sub + dot tròn bên phải. Active: bg `--blue-50`, viền `--blue-600`, ring.
- **Toggle** — switch 34×20, on = `--blue-600`.
- **Segmented control** — div bg `--slate-100` padding 3, button active có bg `--surface` + `--sh-xs`. Dùng cho 2–3 lựa chọn ngắn.

### Status & badges

```jsx
<span className="badge b-{green|amber|red|blue|violet|slate}">
  <span className="badge-dot"/> Đang hoạt động
</span>
```
H 22, padding 8, radius pill, fontSize 11.5, fontWeight 500. Dot 6px màu = currentColor.

### Cards

```css
.card     border 1px var(--border), radius 14, bg surface
.card-hd  padding 16 20, border-bottom
.card-bd  padding 20
```

### Table

```css
.tbl
  thead th  bg slate-50, text 11.5px uppercase letter 0.04em color text-3
  tbody td  padding 14 16, border-bottom, hover bg slate-50
  selected  bg blue-50
```

### Avatar (deterministic)

6 cặp màu (blue/green/amber/violet/sky/pink), seed = index of tenant name. Size 26 / 32 / 42 (drawer).

---

## 4. App shell

```
┌─────────┬──────────────────────────────────┐
│         │ Topbar 60px ───────── search · btn│
│ Sidebar │──────────────────────────────────┤
│  240px  │                                  │
│         │  Main · padding 24 · overflow    │
│         │                                  │
│         │                                  │
└─────────┴──────────────────────────────────┘
                  ┌──── Drawer 520px ─────┐
                  │ Overlay rgba 25% blur │
                  └────────────────────────┘
```

### Sidebar groups

```
Tổng quan
  · Dashboard
Quản lý
  · Nhà trọ (6)
  · Phòng (48)
  · Khách thuê
  · Hợp đồng
Tài chính
  · Chỉ số Điện/Nước
  · Hóa đơn (3)
[bottom] Cài đặt · user card
```

### Topbar

Breadcrumb + H1 trái · search box `--slate-100` 280px (⌘K shortcut) · bell + primary action phải.

### Drawer

Position absolute, top 0 right 0 bottom 0, width 520, backdrop `rgba(15,23,42,.25)` + blur 2px. Cấu trúc: header (X icon top-right) → scrollable body → footer actions.

---

## 5. Inventory màn hình

Tổ chức trên **DesignCanvas** chia 3 section:

### Section 1 — Authentication
| Artboard | Notes |
|---|---|
| **Login · Email + Social** (1280×820) | Split-screen brand panel + form, Google/Facebook |

### Section 2 — Dashboard
| Artboard | Notes |
|---|---|
| **Dashboard · Tháng 5/2026** (1440×900) | 4 KPI · revenue 12-bar chart · room donut · overdue table · expiring contracts table |

### Section 3 — Quản lý (Properties / Rooms / Utility / Invoices)

| Artboard | W×H | Pattern | Mục đích |
|---|---|---|---|
| **Properties · List + Detail Drawer** | 1440×900 | Table + drawer phải | Quản lý nhà trọ — chọn nhà mở drawer xem cấu hình mặc định, phụ phí, công tơ chung |
| **Properties · List** | 1440×900 | Table, không drawer | Bản clean — cho preview/print/screenshot |
| **Add Property · Form Modal** | 1440×980 | Modal 2-col over list | Wizard tạo nhà mới — form trái 4 sections + summary card phải |
| **Rooms · Floor-plan Grid + Detail Drawer** | 1440×980 | Floor-plan card grid + drawer | Visual sơ đồ nhà — group theo tầng, 5 trạng thái màu, click phòng mở drawer |
| **Rooms · Floor-plan Grid** | 1440×980 | Floor-plan, không drawer | Bản clean |
| **Utility Readings · Nhập chỉ số kỳ 05/2026** | 1440×900 | Two-tone table | Bảng điền chỉ số điện/nước — auto-fill đầu kỳ, hàng đang nhập có ring blue + caret |
| **Invoices · List + Detail Drawer** | 1440×900 | Table + drawer | Hóa đơn — drawer hiện line items, public link, action gửi |
| **Generate Invoice · Bulk Modal** | 1440×900 | Modal 980px over list | Tạo hóa đơn hàng loạt — stepper 3 bước, preview table, tổng tiền footer |

---

## 6. Pattern dùng chung

### "List + Drawer" (Properties, Rooms[card], Invoices)
Toolbar trên cùng (filter chip / search / sort) → list/grid → click row mở drawer phải 520px → drawer có header với title + close X, body cuộn, footer actions phải.

### "Modal lớn" (Add Property, Generate Invoice)
Backdrop dim + blur → modal centered top 16–24px, max-w 980–1080px → header icon + title + close → body có thể là 2 cột (form + summary) hoặc full-width → footer fixed có meta trái + buttons phải.

### "Page-level data entry" (Utility Readings)
Không modal — full page có period bar trên + info banner + bảng nhập với ô input nổi bật.

### Status colors → semantic

| Trạng thái phòng | Màu bar | Badge |
|---|---|---|
| Đang ở | blue-600 | b-blue |
| Trống | slate-300 | b-slate |
| Bảo trì | amber-600 | b-amber |
| HĐ sắp hết hạn | violet-600 | b-violet |
| Quá hạn thanh toán | red-600 | b-red |

| Trạng thái hóa đơn | Badge |
|---|---|
| Nháp | b-slate |
| Đã gửi | b-blue |
| Đã thanh toán | b-green |
| Quá hạn | b-red |

---

## 7. Mock data conventions

- **Tên nhà:** "Tòa nhà Lê Văn Lương", "Nhà 42 Cầu Giấy", "Trần Duy Hưng Apartment", v.v.
- **Mã phòng:** `A-101 → A-306`, `B-101 → B-204` (3 chữ số: tầng + thứ tự)
- **Mã hóa đơn:** `HD-2026-05-0142` (HD-yyyy-mm-####)
- **Tiền:** triệu hiển thị `38,4M ₫`, đủ là `4.250.000 ₫` (locale vi-VN)
- **Kỳ:** "Tháng 5 / 2026", "T5/2026" rút gọn
- **Đơn giá điện:** 3.500 ₫/kWh — **nước:** 25.000 ₫/m³ (dùng xuyên suốt)
- **Khách thuê:** tên Việt thật (Nguyễn Thu Hà, Phạm Quốc Hùng, …), 2 chữ initials
- **SĐT:** `0912 384 992` · **CCCD:** `001098xxx453` (3 chữ ẩn)

---

## 8. File structure

```
VnRental.html              ← Entry, DesignCanvas + script imports
styles.css                 ← Tokens + base components (.btn .input .card .badge .tbl)
design-canvas.jsx          ← Canvas grid (DCSection, DCArtboard)
shell.jsx                  ← I (icon set), Logo, Sidebar, Topbar, Shell, NavItem
screens-auth.jsx           ← Login
screens-dashboard.jsx      ← Dashboard + StatusBadge + fmtVND export
screens-properties.jsx     ← Properties list + PropertyDrawer
screens-add-property.jsx   ← AddProperty modal + FormField/TxtInput/Select/RadioCard/Toggle/Section
screens-rooms.jsx          ← Rooms floor-plan + RoomCard + RoomDrawer + FilterChip + Avatar
screens-utility.jsx        ← Utility readings table
screens-invoices.jsx       ← Invoices list + InvoiceDrawer
screens-generate.jsx       ← GenerateInvoice modal
```

Mọi component được expose qua `Object.assign(window, {...})` để các file Babel khác dùng được.

### Icon set

Custom inline SVG component `<I name=... size=... color=... stroke=... />` trong `shell.jsx`. Hiện có: `grid · building · door · users · file-text · zap · receipt · settings · search · bell · plus · chevron-r · chevron-d · x · mail · lock · eye · arrow-up · arrow-dn · more · calendar · download · send · link · check · alert · filter · logout · google · facebook`.

Stroke-width default 1.6. Color = currentColor by default.

---

## 9. Việc tiếp theo gợi ý

- [ ] **Tenants screen** — khách thuê: list + drawer với CCCD/hồ sơ, lịch sử thuê, hợp đồng
- [ ] **Contracts screen** — hợp đồng: list timeline, tạo HĐ wizard, gia hạn flow
- [ ] **Settings** — nhánh User / Branding / Đơn giá toàn hệ thống / Phương thức thanh toán
- [ ] **Empty states** — 0 nhà, 0 phòng, 0 hóa đơn lần đầu mở
- [ ] **Mobile view** — chủ trọ check trên điện thoại
- [ ] **Public invoice page** — link gửi khách thuê xem hóa đơn
- [ ] **Light/Dark mode** — token đã sẵn sàng để swap qua `[data-theme]`
