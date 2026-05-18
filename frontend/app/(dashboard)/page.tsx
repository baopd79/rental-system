"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  DoorOpen, Receipt, AlertTriangle, FileText,
  Building2, TrendingUp, ChevronRight,
} from "lucide-react";
import { apiJson } from "@/lib/api";
import type { DashboardSummary, DashboardRevenue, ExpiringContract, UnpaidInvoiceSummary } from "@/types/dashboard";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from "@/types/invoice";

const fmtMoney = (n: number) => n.toLocaleString("vi-VN") + "₫";
const fmtDate = (d: string) => { const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };

// ── KPI card ──────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, accentBg, accentFg, loading,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; accentBg: string; accentFg: string;
  loading?: boolean;
}) {
  return (
    <div style={{
      background: "var(--vn-surface)",
      border: "1px solid var(--vn-border)",
      borderRadius: 12,
      padding: "16px 18px",
      display: "flex", flexDirection: "column", gap: 14,
      boxShadow: "var(--sh-xs)",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9,
        background: accentBg, display: "grid", placeItems: "center", flexShrink: 0,
      }}>
        <Icon size={17} color={accentFg} />
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--vn-text-3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
          {label}
        </div>
        <div style={{
          fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1,
          fontVariantNumeric: "tabular-nums", color: loading ? "var(--vn-border)" : "var(--vn-text)",
        }}>
          {loading ? "—" : value}
        </div>
        {sub && (
          <div style={{ fontSize: 12, color: "var(--vn-text-3)", marginTop: 5 }}>{loading ? "…" : sub}</div>
        )}
      </div>
    </div>
  );
}

// ── Revenue bar chart ─────────────────────────────────────────────
const MONTH_LABELS = ["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"];

function RevenueChart({ revenue, loading }: { revenue: DashboardRevenue | null; loading: boolean }) {
  const maxVal = revenue ? Math.max(...revenue.months.map(m => m.total), 1) : 1;
  const currentMonth = new Date().getMonth(); // 0-indexed

  return (
    <div style={{ background: "var(--vn-surface)", border: "1px solid var(--vn-border)", borderRadius: 12, padding: "18px 20px", boxShadow: "var(--sh-xs)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--vn-text)", letterSpacing: "-0.01em" }}>Doanh thu theo tháng</div>
          <div style={{ fontSize: 12, color: "var(--vn-text-3)", marginTop: 2 }}>
            {revenue ? `${revenue.year} · Tổng: ${fmtMoney(revenue.total_year)}` : "…"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--vn-text-3)" }}>
          <TrendingUp size={13} />
          {revenue?.year ?? new Date().getFullYear()}
        </div>
      </div>

      {/* Bars */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
        {MONTH_LABELS.map((label, i) => {
          const val = revenue?.months[i]?.total ?? 0;
          const heightPct = loading ? 0 : (val / maxVal) * 100;
          const isCurrent = i === currentMonth;
          const hasData = val > 0;
          return (
            <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, height: "100%", justifyContent: "flex-end" }}>
              <div
                title={hasData ? fmtMoney(val) : ""}
                style={{
                  width: "100%", borderRadius: "3px 3px 0 0",
                  background: isCurrent
                    ? "var(--blue-600)"
                    : hasData ? "var(--blue-200)" : "var(--slate-100)",
                  height: loading ? 4 : `${Math.max(heightPct, hasData ? 4 : 2)}%`,
                  transition: "height 0.4s ease",
                  cursor: hasData ? "pointer" : "default",
                  minHeight: 2,
                }}
              />
              <div style={{ fontSize: 10, color: isCurrent ? "var(--blue-600)" : "var(--vn-text-3)", fontWeight: isCurrent ? 700 : 400 }}>
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Expiring contracts list ───────────────────────────────────────
function ExpiringList({ items, loading, onNavigate }: {
  items: ExpiringContract[]; loading: boolean; onNavigate: (contractId: number) => void;
}) {
  return (
    <div style={{ background: "var(--vn-surface)", border: "1px solid var(--vn-border)", borderRadius: 12, overflow: "hidden", boxShadow: "var(--sh-xs)" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--vn-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--vn-text)" }}>Hợp đồng sắp hết hạn</div>
        <span style={{ fontSize: 11, fontWeight: 600, background: "var(--amber-50)", color: "var(--amber-700)", padding: "2px 8px", borderRadius: 999 }}>
          {loading ? "…" : `${items.length} hợp đồng`}
        </span>
      </div>
      {loading ? (
        <div style={{ padding: "20px 18px", color: "var(--vn-text-3)", fontSize: 13 }}>Đang tải...</div>
      ) : items.length === 0 ? (
        <div style={{ padding: "24px 18px", textAlign: "center", color: "var(--vn-text-3)", fontSize: 13 }}>
          Không có hợp đồng sắp hết hạn
        </div>
      ) : items.map((item, i) => (
        <div
          key={item.contract_id}
          onClick={() => onNavigate(item.contract_id)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "11px 18px", cursor: "pointer",
            borderBottom: i < items.length - 1 ? "1px solid var(--vn-border)" : "none",
            gap: 12,
          }}
          className="hover:bg-(--vn-surface-2)"
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--vn-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {item.tenant_name}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--vn-text-3)", marginTop: 1 }}>
              {item.property_name} · Phòng {item.room_number}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{
              fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
              background: item.days_left <= 7 ? "var(--red-50)" : "var(--amber-50)",
              color: item.days_left <= 7 ? "var(--red-600)" : "var(--amber-700)",
            }}>
              {item.days_left === 0 ? "Hôm nay" : `${item.days_left} ngày`}
            </div>
            <div style={{ fontSize: 11, color: "var(--vn-text-3)", marginTop: 3 }}>{fmtDate(item.end_date)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Unpaid invoices list ──────────────────────────────────────────
function UnpaidList({ items, loading, onOpen }: {
  items: UnpaidInvoiceSummary[]; loading: boolean; onOpen: (id: number) => void;
}) {
  return (
    <div style={{ background: "var(--vn-surface)", border: "1px solid var(--vn-border)", borderRadius: 12, overflow: "hidden", boxShadow: "var(--sh-xs)" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--vn-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--vn-text)" }}>Hóa đơn chưa thanh toán</div>
        <span style={{ fontSize: 11, fontWeight: 600, background: "var(--red-50)", color: "var(--red-600)", padding: "2px 8px", borderRadius: 999 }}>
          {loading ? "…" : `${items.length} hóa đơn`}
        </span>
      </div>
      {loading ? (
        <div style={{ padding: "20px 18px", color: "var(--vn-text-3)", fontSize: 13 }}>Đang tải...</div>
      ) : items.length === 0 ? (
        <div style={{ padding: "24px 18px", textAlign: "center", color: "var(--vn-text-3)", fontSize: 13 }}>
          Tất cả hóa đơn đã thanh toán
        </div>
      ) : items.map((item, i) => {
        const sc = INVOICE_STATUS_COLORS[item.status];
        return (
          <div
            key={item.invoice_id}
            onClick={() => onOpen(item.invoice_id)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "11px 18px", cursor: "pointer",
              borderBottom: i < items.length - 1 ? "1px solid var(--vn-border)" : "none",
              gap: 12,
            }}
            className="hover:bg-(--vn-surface-2)"
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--vn-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {item.tenant_name}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--vn-text-3)", marginTop: 1 }}>
                {item.property_name} · Phòng {item.room_number} · {item.period}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--vn-text)" }}>
                {fmtMoney(item.total)}
              </div>
              <span style={{
                fontSize: 10.5, fontWeight: 600, padding: "1px 7px", borderRadius: 999,
                background: sc.bg, color: sc.fg, display: "inline-block", marginTop: 3,
              }}>
                {INVOICE_STATUS_LABELS[item.status]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [revenue, setRevenue] = useState<DashboardRevenue | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const year = new Date().getFullYear();
      const [s, r] = await Promise.all([
        apiJson<DashboardSummary>("/dashboard/summary", getToken),
        apiJson<DashboardRevenue>(`/dashboard/revenue?year=${year}`, getToken),
      ]);
      setSummary(s);
      setRevenue(r);
    } catch {
      // leave null — UI shows "—"
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  const occupancyRate = summary
    ? summary.rooms.total > 0
      ? Math.round((summary.rooms.occupied / summary.rooms.total) * 100)
      : 0
    : null;

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.022em", color: "var(--vn-text)", margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ fontSize: 13, color: "var(--vn-text-3)", marginTop: 3 }}>
          Tổng quan hệ thống quản lý nhà trọ.
        </p>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <KpiCard
          label="Phòng đang cho thuê"
          value={summary ? `${summary.rooms.occupied} / ${summary.rooms.total}` : "—"}
          sub={occupancyRate != null ? `${occupancyRate}% lấp đầy · ${summary!.rooms.vacant} trống` : "Chưa có dữ liệu"}
          icon={DoorOpen}
          accentBg="var(--violet-50)"
          accentFg="var(--violet-600)"
          loading={loading}
        />
        <KpiCard
          label="Doanh thu tháng này"
          value={revenue ? fmtMoney(revenue.months[new Date().getMonth()].total) : "—"}
          sub={revenue ? `Cả năm: ${fmtMoney(revenue.total_year)}` : "Cần tạo hóa đơn"}
          icon={Receipt}
          accentBg="var(--blue-50)"
          accentFg="var(--blue-600)"
          loading={loading}
        />
        <KpiCard
          label="Hóa đơn chưa thanh toán"
          value={summary ? String(summary.unpaid_invoices) : "—"}
          sub={summary ? (summary.unpaid_invoices > 0 ? `Tổng: ${fmtMoney(summary.unpaid_total)}` : "Tất cả đã thanh toán") : "Chưa có hóa đơn"}
          icon={AlertTriangle}
          accentBg="var(--amber-50)"
          accentFg="var(--amber-600)"
          loading={loading}
        />
        <KpiCard
          label="Hợp đồng sắp hết hạn"
          value={summary ? String(summary.expiring_soon) : "—"}
          sub="Trong 30 ngày tới"
          icon={FileText}
          accentBg="var(--slate-100)"
          accentFg="var(--slate-500)"
          loading={loading}
        />
      </div>

      {/* Revenue chart */}
      <div style={{ marginBottom: 16 }}>
        <RevenueChart revenue={revenue} loading={loading} />
      </div>

      {/* Bottom two-col lists */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <ExpiringList
          items={summary?.expiring_contracts ?? []}
          loading={loading}
          onNavigate={(contractId) => router.push(`/invoices`)}
        />
        <UnpaidList
          items={summary?.unpaid_invoice_list ?? []}
          loading={loading}
          onOpen={(id) => router.push(`/invoices`)}
        />
      </div>
    </div>
  );
}
