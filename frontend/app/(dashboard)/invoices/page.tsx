"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { Plus, Receipt, Building2, User, Calendar, Layers, Search, ChevronDown, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiJson } from "@/lib/api";
import { fmtMoney, fmtPeriod, currentPeriod } from "@/lib/format";
import type { InvoiceListItem, InvoiceStatus, Invoice } from "@/types/invoice";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from "@/types/invoice";
import { InvoiceGenerateDrawer } from "@/components/app/invoice-generate-drawer";
import { InvoiceDrawer } from "@/components/app/invoice-drawer";
import { BillingModal } from "@/components/app/billing-modal";
import type { Property } from "@/types/property";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_FILTERS: { label: string; value: InvoiceStatus | "all" }[] = [
  { label: "Tất cả", value: "all" },
  { label: "Nháp",   value: "draft" },
  { label: "Đã gửi", value: "sent" },
  { label: "Đã TT",  value: "paid" },
];

export default function InvoicesPage() {
  const { getToken } = useAuth();
  const [invoices,     setInvoices]     = useState<InvoiceListItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState<InvoiceStatus | "all">("all");
  const [monthFilter,  setMonthFilter]  = useState<string>("all");
  const [search,       setSearch]       = useState("");
  const [showForm,     setShowForm]     = useState(false);
  const [drawerInvoiceId, setDrawerInvoiceId] = useState<number | null>(null);
  const [showBatchPicker, setShowBatchPicker] = useState(false);
  const [batchProperty,   setBatchProperty]   = useState<Property | null>(null);
  const [properties,      setProperties]      = useState<Property[]>([]);

  const load = useCallback(async () => {
    try {
      const [data, props] = await Promise.all([
        apiJson<InvoiceListItem[]>("/invoices", getToken),
        apiJson<Property[]>("/properties", getToken),
      ]);
      setInvoices(data);
      setProperties(props);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  const periods = useMemo(() => {
    const set = new Set(invoices.map(i => i.period));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [invoices]);

  const filtered = useMemo(() => {
    let list = invoices;
    if (filter !== "all")      list = list.filter(i => i.status === filter);
    if (monthFilter !== "all") list = list.filter(i => i.period === monthFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(i =>
        i.tenant_name.toLowerCase().includes(q) ||
        i.room_number.toLowerCase().includes(q) ||
        i.property_name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [invoices, filter, monthFilter, search]);

  const kpiScope = useMemo(() => {
    return monthFilter !== "all"
      ? invoices.filter(i => i.period === monthFilter)
      : invoices.filter(i => i.period === currentPeriod());
  }, [invoices, monthFilter]);

  const kpi = useMemo(() => {
    const paid    = kpiScope.filter(i => i.status === "paid");
    const unpaid  = kpiScope.filter(i => i.status === "sent" || i.status === "draft");
    const reported = kpiScope.filter(i => i.payment_reported_at && i.status === "sent").length;
    return {
      total:     kpiScope.length,
      totalAmt:  kpiScope.reduce((s, i) => s + Number(i.total), 0),
      paid:      paid.length,
      paidAmt:   paid.reduce((s, i) => s + Number(i.total), 0),
      unpaid:    unpaid.length,
      unpaidAmt: unpaid.reduce((s, i) => s + Number(i.total), 0),
      reported,
      draft:     kpiScope.filter(i => i.status === "draft").length,
    };
  }, [kpiScope]);

  const kpiLabel = monthFilter !== "all"
    ? fmtPeriod(monthFilter)
    : `T${Number(currentPeriod().split("-")[1])} (kỳ này)`;

  const actions = (
    <div style={{ display: "flex", gap: "var(--sp-2)" }}>
      <button onClick={() => setShowBatchPicker(true)} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        height: 36, padding: "0 var(--sp-3)", borderRadius: "var(--r-md)",
        background: "var(--vn-surface)", color: "var(--vn-text-2)",
        fontSize: "var(--text-label)", fontWeight: 500,
        border: "1px solid var(--vn-border)", cursor: "pointer",
      }}>
        <Layers size={14} /> Tạo hàng loạt
      </button>
      <button onClick={() => setShowForm(true)} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        height: 36, padding: "0 var(--sp-3)", borderRadius: "var(--r-md)",
        background: "var(--blue-600)", color: "#fff",
        fontSize: "var(--text-label)", fontWeight: 600,
        border: "none", cursor: "pointer",
        boxShadow: "0 1px 0 rgba(255,255,255,.18) inset, var(--sh-sm)",
      }}>
        <Plus size={14} color="#fff" /> Tạo đơn lẻ
      </button>
    </div>
  );

  if (loading) return (
    <div style={{ padding: "var(--sp-6)", color: "var(--vn-text-3)", fontSize: "var(--text-body)" }}>
      Đang tải...
    </div>
  );

  return (
    <div style={{ padding: "var(--sp-5) var(--sp-6)" }}>
      <PageHeader title="Hóa đơn" description={`${invoices.length} hóa đơn`} action={actions} />

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--sp-3)", marginBottom: "var(--sp-4)" }}>
        <KpiCard label={`Tổng HĐ · ${kpiLabel}`} value={String(kpi.total)}   sub={fmtMoney(kpi.totalAmt)}  />
        <KpiCard label="Đã thanh toán"            value={String(kpi.paid)}    sub={fmtMoney(kpi.paidAmt)}   valueColor="var(--green-600)" />
        <KpiCard label="Chưa thanh toán"           value={String(kpi.unpaid)}  sub={fmtMoney(kpi.unpaidAmt)} valueColor="var(--blue-600)" />
        {kpi.reported > 0 ? (
          <KpiCard label="Khách báo đã TT" value={String(kpi.reported)} sub="Chờ xác nhận" valueColor="var(--amber-600)" />
        ) : (
          <KpiCard label="Nháp" value={String(kpi.draft)} sub="Chưa gửi" valueColor="var(--vn-text-3)" />
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", marginBottom: "var(--sp-3)", flexWrap: "wrap" }}>
        {/* Status tabs */}
        <div style={{ display: "flex", gap: 3 }}>
          {STATUS_FILTERS.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)} style={{
              height: 32, padding: "0 var(--sp-3)", borderRadius: "var(--r-md)",
              fontSize: "var(--text-sm)", fontWeight: 500, cursor: "pointer",
              border: "1px solid",
              borderColor: filter === f.value ? "var(--blue-300)" : "var(--vn-border)",
              background: filter === f.value ? "var(--blue-50)" : "var(--vn-surface)",
              color: filter === f.value ? "var(--blue-700)" : "var(--vn-text-2)",
              whiteSpace: "nowrap",
            }}>
              {f.label}
              {f.value !== "all" && (
                <span style={{
                  marginLeft: "var(--sp-1)", fontSize: "var(--text-xs)", fontWeight: 600,
                  background: filter === f.value ? "var(--blue-100)" : "var(--slate-100)",
                  color: filter === f.value ? "var(--blue-700)" : "var(--slate-500)",
                  padding: "1px 5px", borderRadius: 999,
                }}>
                  {invoices.filter(i => i.status === f.value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: "var(--vn-border)", flexShrink: 0 }} />

        {/* Month filter */}
        <div style={{ position: "relative" }}>
          <select
            value={monthFilter}
            onChange={e => setMonthFilter(e.target.value)}
            style={{
              height: 32, padding: "0 28px 0 var(--sp-2)",
              border: `1px solid ${monthFilter !== "all" ? "var(--blue-300)" : "var(--vn-border)"}`,
              borderRadius: "var(--r-md)", fontSize: "var(--text-sm)", fontWeight: 500,
              cursor: "pointer",
              background: monthFilter !== "all" ? "var(--blue-50)" : "var(--vn-surface)",
              color: monthFilter !== "all" ? "var(--blue-700)" : "var(--vn-text-2)",
              outline: "none", appearance: "none",
            }}
          >
            <option value="all">Tất cả tháng</option>
            {periods.map(p => <option key={p} value={p}>{fmtPeriod(p)}</option>)}
          </select>
          <ChevronDown size={12} style={{ position: "absolute", right: "var(--sp-2)", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--vn-text-3)" }} />
        </div>

        {/* Search */}
        <div style={{ position: "relative", flex: 1, minWidth: 160, maxWidth: 280 }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--vn-text-3)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm tên khách, phòng, nhà trọ…"
            style={{
              width: "100%", height: 32, padding: "0 var(--sp-2) 0 28px",
              border: "1px solid var(--vn-border)", borderRadius: "var(--r-md)",
              fontSize: "var(--text-sm)", background: "var(--vn-surface)",
              outline: "none", color: "var(--vn-text)", boxSizing: "border-box",
            }}
          />
        </div>

        {(filter !== "all" || monthFilter !== "all" || search) && (
          <span style={{ fontSize: "var(--text-sm)", color: "var(--vn-text-3)", marginLeft: "auto" }}>
            {filtered.length} kết quả
          </span>
        )}
      </div>

      {/* Table / Empty */}
      {filtered.length === 0 ? (
        <div style={{
          background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: "var(--r-lg)", boxShadow: "var(--sh-xs)",
        }}>
          <EmptyState
            message={search ? `Không tìm thấy "${search}"` : filter === "all" ? "Chưa có hóa đơn nào" : `Không có hóa đơn ${INVOICE_STATUS_LABELS[filter as InvoiceStatus]}`}
            icon={Receipt}
          />
        </div>
      ) : (
        <div style={{
          background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: "var(--r-lg)", overflow: "hidden", boxShadow: "var(--sh-xs)",
        }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: "var(--text-body)" }}>
            <thead>
              <tr>
                {["Kỳ", "Phòng / Khách thuê", "Tổng tiền", "Trạng thái", ""].map(h => (
                  <th key={h} style={{
                    textAlign: "left", padding: "11px var(--sp-4)",
                    fontSize: "var(--text-xs)", fontWeight: 600,
                    color: "var(--vn-text-3)", letterSpacing: "0.05em",
                    textTransform: "uppercase", background: "var(--slate-50)",
                    borderBottom: "1px solid var(--vn-border)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv, i) => {
                const sc = INVOICE_STATUS_COLORS[inv.status];
                return (
                  <tr key={inv.id} style={{ cursor: "pointer" }} onClick={() => setDrawerInvoiceId(inv.id)}>
                    <td style={{ padding: "13px var(--sp-4)", borderBottom: i < filtered.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Calendar size={13} color="var(--vn-text-3)" />
                        <span style={{ fontWeight: 600, fontFamily: "var(--font-geist-mono)", color: "var(--vn-text)" }}>
                          {fmtPeriod(inv.period)}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "13px var(--sp-4)", borderBottom: i < filtered.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--vn-text)" }}>
                        <Building2 size={12} color="var(--vn-text-3)" />
                        <span style={{ fontWeight: 500 }}>{inv.property_name}</span>
                        <span style={{ color: "var(--vn-text-3)" }}>·</span>
                        <span>P.{inv.room_number}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "var(--text-sm)", color: "var(--vn-text-3)", marginTop: 2 }}>
                        <User size={11} />
                        {inv.tenant_name}
                      </div>
                    </td>
                    <td style={{ padding: "13px var(--sp-4)", borderBottom: i < filtered.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "var(--vn-text)" }}>
                      {fmtMoney(inv.total)}
                    </td>
                    <td style={{ padding: "13px var(--sp-4)", borderBottom: i < filtered.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-1)" }}>
                        <StatusBadge bg={sc.bg} fg={sc.fg} dot={sc.dot} label={INVOICE_STATUS_LABELS[inv.status]} />
                        {inv.payment_reported_at && inv.status === "sent" && (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: "var(--sp-1)",
                            fontSize: "var(--text-xs)", fontWeight: 600, color: "#92400E",
                            background: "var(--amber-50)", border: "1px solid var(--amber-200)",
                            padding: "1px 7px", borderRadius: 999,
                          }}>
                            <AlertTriangle size={9} /> Khách báo đã TT
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "13px var(--sp-4)", borderBottom: i < filtered.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", width: 60, textAlign: "right" }}
                      onClick={e => e.stopPropagation()}>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--blue-600)", cursor: "pointer" }}
                        onClick={() => setDrawerInvoiceId(inv.id)}>
                        Xem →
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <InvoiceDrawer
        invoiceId={drawerInvoiceId}
        onClose={() => setDrawerInvoiceId(null)}
        onDelete={id => setInvoices(prev => prev.filter(i => i.id !== id))}
        onUpdate={(updated: Invoice) => setInvoices(prev => prev.map(i => i.id === updated.id ? { ...i, status: updated.status } : i))}
      />

      <InvoiceGenerateDrawer
        open={showForm}
        onClose={() => setShowForm(false)}
        onInvoiceCreated={inv => {
          setInvoices(prev => [{ ...inv, room_id: 0, room_number: "", property_name: "", tenant_name: "" }, ...prev]);
          load();
        }}
      />

      <Dialog open={showBatchPicker && !batchProperty} onOpenChange={o => { if (!o) setShowBatchPicker(false); }}>
        <DialogContent style={{ maxWidth: 420 }}>
          <DialogHeader><DialogTitle>Chọn nhà để tạo hoá đơn hàng loạt</DialogTitle></DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: "var(--sp-1)" }}>
            {properties.length === 0 && (
              <p style={{ fontSize: "var(--text-label)", color: "var(--vn-text-3)", textAlign: "center", padding: "var(--sp-4) 0" }}>
                Chưa có nhà trọ nào.
              </p>
            )}
            {properties.map(p => (
              <button key={p.id} onClick={() => { setBatchProperty(p); setShowBatchPicker(false); }} style={{
                display: "flex", alignItems: "center", gap: "var(--sp-3)", padding: "11px var(--sp-3)",
                background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
                borderRadius: "var(--r-md)", cursor: "pointer", textAlign: "left",
              }}>
                <div style={{ width: 34, height: 34, borderRadius: "var(--r-md)", background: "var(--blue-50)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Building2 size={16} color="var(--blue-600)" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "var(--text-label)", fontWeight: 600, color: "var(--vn-text)" }}>{p.name}</div>
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--vn-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.address}</div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <BillingModal
        propertyId={batchProperty ? String(batchProperty.id) : ""}
        property={batchProperty}
        open={batchProperty !== null}
        onClose={() => { setBatchProperty(null); load(); }}
        initialTab="invoices"
      />
    </div>
  );
}
