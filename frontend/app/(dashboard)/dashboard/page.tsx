"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { DoorOpen, Receipt, AlertTriangle, FileText, TrendingUp } from "lucide-react";
import { apiJson } from "@/lib/api";
import { fmtMoney, fmtDate } from "@/lib/format";
import type { DashboardSummary, DashboardRevenue, ExpiringContract, UnpaidInvoiceSummary } from "@/types/dashboard";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from "@/types/invoice";
import { InvoiceDrawer } from "@/components/app/invoice-drawer";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";

// ── Revenue chart ─────────────────────────────────────────────────
const MONTH_LABELS = ["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"];

function RevenueChart({ revenue, loading }: { revenue: DashboardRevenue | null; loading: boolean }) {
  const maxVal = revenue ? Math.max(...revenue.months.map(m => m.total), 1) : 1;
  const currentMonth = new Date().getMonth();

  return (
    <div style={{
      background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
      borderRadius: "var(--r-lg)", padding: "18px 20px", boxShadow: "var(--sh-xs)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "var(--sp-5)" }}>
        <div>
          <div style={{ fontSize: "var(--text-heading)", fontWeight: 700, color: "var(--vn-text)", letterSpacing: "-0.01em" }}>
            Doanh thu theo tháng
          </div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--vn-text-3)", marginTop: "var(--sp-1)" }}>
            {revenue ? `${revenue.year} · Tổng: ${fmtMoney(revenue.total_year)}` : "…"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-1)", fontSize: "var(--text-sm)", color: "var(--vn-text-3)" }}>
          <TrendingUp size={13} />
          {revenue?.year ?? new Date().getFullYear()}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
        {MONTH_LABELS.map((label, i) => {
          const val = revenue?.months[i]?.total ?? 0;
          const heightPct = loading ? 0 : (val / maxVal) * 100;
          const isCurrent = i === currentMonth;
          const hasData = val > 0;
          return (
            <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sp-1)", height: "100%", justifyContent: "flex-end" }}>
              <div
                title={hasData ? fmtMoney(val) : ""}
                style={{
                  width: "100%", borderRadius: "var(--r-sm) var(--r-sm) 0 0",
                  background: isCurrent ? "var(--blue-600)" : hasData ? "var(--blue-200)" : "var(--slate-100)",
                  height: loading ? 4 : `${Math.max(heightPct, hasData ? 4 : 2)}%`,
                  transition: "height 0.4s ease",
                  cursor: hasData ? "pointer" : "default",
                  minHeight: 2,
                }}
              />
              <div style={{ fontSize: "var(--text-xs)", color: isCurrent ? "var(--blue-600)" : "var(--vn-text-3)", fontWeight: isCurrent ? 700 : 400 }}>
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── List card shell ───────────────────────────────────────────────
function ListCard({ title, badge, badgeBg, badgeFg, loading, children }: {
  title: string;
  badge?: string;
  badgeBg?: string;
  badgeFg?: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
      borderRadius: "var(--r-lg)", overflow: "hidden", boxShadow: "var(--sh-xs)",
    }}>
      <div style={{
        padding: "var(--sp-3) 18px",
        borderBottom: "1px solid var(--vn-border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontSize: "var(--text-label)", fontWeight: 700, color: "var(--vn-text)" }}>
          {title}
        </div>
        {badge && (
          <span style={{
            fontSize: "var(--text-xs)", fontWeight: 600,
            background: badgeBg, color: badgeFg,
            padding: "2px var(--sp-2)", borderRadius: 999,
          }}>
            {loading ? "…" : badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Expiring contracts ────────────────────────────────────────────
function ExpiringList({ items, loading }: { items: ExpiringContract[]; loading: boolean }) {
  const router = useRouter();
  return (
    <ListCard
      title="Hợp đồng sắp hết hạn"
      badge={`${items.length} hợp đồng`}
      badgeBg="var(--amber-50)" badgeFg="var(--amber-700)"
      loading={loading}
    >
      {loading ? (
        <EmptyState message="Đang tải..." />
      ) : items.length === 0 ? (
        <EmptyState message="Không có hợp đồng sắp hết hạn" />
      ) : items.map((item, i) => (
        <div
          key={item.contract_id}
          onClick={() => router.push("/contracts")}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "11px 18px", cursor: "pointer", gap: "var(--sp-3)",
            borderBottom: i < items.length - 1 ? "1px solid var(--vn-border)" : "none",
          }}
          className="hover:bg-(--slate-50)"
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "var(--text-label)", fontWeight: 600, color: "var(--vn-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.tenant_name}
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--vn-text-3)", marginTop: 2 }}>
              {item.property_name} · Phòng {item.room_number}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{
              fontSize: "var(--text-sm)", fontWeight: 600,
              padding: "2px var(--sp-2)", borderRadius: 999,
              background: item.days_left <= 7 ? "var(--red-50)" : "var(--amber-50)",
              color: item.days_left <= 7 ? "var(--red-600)" : "var(--amber-700)",
            }}>
              {item.days_left === 0 ? "Hôm nay" : `${item.days_left} ngày`}
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--vn-text-3)", marginTop: 3 }}>
              {fmtDate(item.end_date)}
            </div>
          </div>
        </div>
      ))}
    </ListCard>
  );
}

// ── Unpaid invoices ───────────────────────────────────────────────
function UnpaidList({ items, loading, onOpen }: {
  items: UnpaidInvoiceSummary[]; loading: boolean; onOpen: (id: number) => void;
}) {
  return (
    <ListCard
      title="Hóa đơn chưa thanh toán"
      badge={`${items.length} hóa đơn`}
      badgeBg="var(--red-50)" badgeFg="var(--red-600)"
      loading={loading}
    >
      {loading ? (
        <EmptyState message="Đang tải..." />
      ) : items.length === 0 ? (
        <EmptyState message="Tất cả hóa đơn đã thanh toán" />
      ) : items.map((item, i) => {
        const sc = INVOICE_STATUS_COLORS[item.status];
        return (
          <div
            key={item.invoice_id}
            onClick={() => onOpen(item.invoice_id)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "11px 18px", cursor: "pointer", gap: "var(--sp-3)",
              borderBottom: i < items.length - 1 ? "1px solid var(--vn-border)" : "none",
            }}
            className="hover:bg-(--slate-50)"
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "var(--text-label)", fontWeight: 600, color: "var(--vn-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.tenant_name}
              </div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--vn-text-3)", marginTop: 2 }}>
                {item.property_name} · Phòng {item.room_number} · {item.period}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: "var(--text-label)", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--vn-text)" }}>
                {fmtMoney(item.total)}
              </div>
              <div style={{ marginTop: 3 }}>
                <StatusBadge bg={sc.bg} fg={sc.fg} dot={sc.dot} label={INVOICE_STATUS_LABELS[item.status]} />
              </div>
            </div>
          </div>
        );
      })}
    </ListCard>
  );
}

// ── Page ──────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { getToken } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [revenue, setRevenue] = useState<DashboardRevenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerInvoiceId, setDrawerInvoiceId] = useState<number | null>(null);

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

  const occupancyRate = summary?.rooms.total
    ? Math.round((summary.rooms.occupied / summary.rooms.total) * 100)
    : null;

  return (
    <div className="page-pad" style={{ maxWidth: 1600 }}>
      <PageHeader title="Dashboard" description="Tổng quan hệ thống quản lý nhà trọ." />

      <div className="grid-kpi" style={{ marginBottom: "var(--sp-5)" }}>
        <KpiCard
          label="Phòng đang cho thuê"
          value={summary ? `${summary.rooms.occupied} / ${summary.rooms.total}` : "—"}
          sub={occupancyRate != null ? `${occupancyRate}% lấp đầy · ${summary!.rooms.vacant} trống` : "Chưa có dữ liệu"}
          icon={DoorOpen}
          accentBg="var(--violet-50)" accentFg="var(--violet-600)"
          loading={loading}
        />
        <KpiCard
          label="Doanh thu tháng này"
          value={revenue ? fmtMoney(revenue.months[new Date().getMonth()].total) : "—"}
          sub={revenue ? `Cả năm: ${fmtMoney(revenue.total_year)}` : "Cần tạo hóa đơn"}
          icon={Receipt}
          accentBg="var(--blue-50)" accentFg="var(--blue-600)"
          loading={loading}
        />
        <KpiCard
          label="Hóa đơn chưa thanh toán"
          value={summary ? String(summary.unpaid_invoices) : "—"}
          sub={summary ? (summary.unpaid_invoices > 0 ? `Tổng: ${fmtMoney(summary.unpaid_total)}` : "Tất cả đã thanh toán") : "Chưa có hóa đơn"}
          icon={AlertTriangle}
          accentBg="var(--amber-50)" accentFg="var(--amber-600)"
          loading={loading}
        />
        <KpiCard
          label="Hợp đồng sắp hết hạn"
          value={summary ? String(summary.expiring_soon) : "—"}
          sub="Trong 30 ngày tới"
          icon={FileText}
          accentBg="var(--slate-100)" accentFg="var(--slate-500)"
          loading={loading}
        />
      </div>

      <div style={{ marginBottom: "var(--sp-4)" }}>
        <RevenueChart revenue={revenue} loading={loading} />
      </div>

      <div className="grid-2col">
        <ExpiringList items={summary?.expiring_contracts ?? []} loading={loading} />
        <UnpaidList items={summary?.unpaid_invoice_list ?? []} loading={loading} onOpen={setDrawerInvoiceId} />
      </div>

      <InvoiceDrawer invoiceId={drawerInvoiceId} onClose={() => setDrawerInvoiceId(null)} />
    </div>
  );
}
