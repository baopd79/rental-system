import { DoorOpen, Receipt, AlertTriangle, FileText } from "lucide-react";

const KpiCard = ({
  label, value, sub, icon: Icon, accentBg, accentFg,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; accentBg: string; accentFg: string;
}) => (
  <div style={{
    background: "var(--vn-surface)",
    border: "1px solid var(--vn-border)",
    borderRadius: 14,
    padding: "18px 20px",
    display: "flex", flexDirection: "column", gap: 12,
    boxShadow: "var(--sh-xs)",
    minHeight: 128,
  }}>
    <div style={{
      width: 34, height: 34, borderRadius: 9,
      background: accentBg, color: accentFg,
      display: "grid", placeItems: "center",
    }}>
      <Icon size={17} color={accentFg} />
    </div>
    <div>
      <div style={{ fontSize: 12.5, color: "var(--vn-text-2)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--vn-text-3)", marginTop: 6 }}>{sub}</div>}
    </div>
  </div>
);

export default function DashboardPage() {
  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.018em", color: "var(--vn-text)", margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ fontSize: 13.5, color: "var(--vn-text-2)", marginTop: 4 }}>
          Tổng quan hệ thống quản lý nhà trọ.
        </p>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <KpiCard
          label="Phòng đang cho thuê"
          value="— / —"
          sub="Chưa có dữ liệu"
          icon={DoorOpen}
          accentBg="var(--violet-50)"
          accentFg="var(--violet-600)"
        />
        <KpiCard
          label="Doanh thu tháng này"
          value="— ₫"
          sub="Cần tạo hóa đơn"
          icon={Receipt}
          accentBg="var(--blue-50)"
          accentFg="var(--blue-600)"
        />
        <KpiCard
          label="Hóa đơn chưa thanh toán"
          value="—"
          sub="Chưa có hóa đơn"
          icon={AlertTriangle}
          accentBg="var(--amber-50)"
          accentFg="var(--amber-600)"
        />
        <KpiCard
          label="Hợp đồng sắp hết hạn"
          value="—"
          sub="Trong 30 ngày tới"
          icon={FileText}
          accentBg="var(--slate-100)"
          accentFg="var(--slate-600)"
        />
      </div>

      {/* Empty state */}
      <div style={{
        background: "var(--vn-surface)",
        border: "1px solid var(--vn-border)",
        borderRadius: 14,
        padding: "48px 32px",
        textAlign: "center",
        color: "var(--vn-text-3)",
        boxShadow: "var(--sh-xs)",
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: "var(--vn-text-2)", marginBottom: 6 }}>
          Dashboard đang được xây dựng
        </div>
        <div style={{ fontSize: 13.5 }}>
          Biểu đồ doanh thu, phân bổ phòng và bảng hóa đơn quá hạn sẽ hiển thị ở đây sau khi có dữ liệu.
        </div>
      </div>
    </div>
  );
}
