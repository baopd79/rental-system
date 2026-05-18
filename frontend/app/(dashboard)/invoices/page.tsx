"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Plus, Receipt, Building2, User, Calendar, Layers } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiJson } from "@/lib/api";
import type { InvoiceListItem, InvoiceStatus, Invoice } from "@/types/invoice";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from "@/types/invoice";
import { InvoiceGenerateForm } from "@/components/app/invoice-generate-form";
import { InvoiceDrawer } from "@/components/app/invoice-drawer";
import { BillingModal } from "@/components/app/billing-modal";
import type { Property } from "@/types/property";

const STATUS_FILTERS: { label: string; value: InvoiceStatus | "all" }[] = [
  { label: "Tất cả", value: "all" },
  { label: "Nháp",   value: "draft" },
  { label: "Đã gửi", value: "sent" },
  { label: "Đã TT",  value: "paid" },
];

function fmtMoney(n: string) {
  return Number(n).toLocaleString("vi-VN") + "₫";
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const c = INVOICE_STATUS_COLORS[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      height: 22, padding: "0 10px", borderRadius: 999,
      fontSize: 11.5, fontWeight: 500,
      background: c.bg, color: c.fg,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.dot }} />
      {INVOICE_STATUS_LABELS[status]}
    </span>
  );
}

export default function InvoicesPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [invoices,     setInvoices]     = useState<InvoiceListItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState<InvoiceStatus | "all">("all");
  const [showForm,     setShowForm]     = useState(false);
  const [drawerInvoiceId, setDrawerInvoiceId] = useState<number | null>(null);

  // batch invoice state
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

  function handleCreated(inv: { id: number }) {
    setShowForm(false);
    setDrawerInvoiceId(inv.id);
  }

  const filtered = filter === "all" ? invoices : invoices.filter(i => i.status === filter);

  if (loading) return <div style={{ padding: 24, color: "var(--vn-text-3)", fontSize: 13.5 }}>Đang tải...</div>;

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.022em", color: "var(--vn-text)", margin: 0 }}>
            Hóa đơn
          </h1>
          <p style={{ fontSize: 13, color: "var(--vn-text-3)", marginTop: 3 }}>
            {invoices.length} hóa đơn
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowBatchPicker(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 36, padding: "0 14px", borderRadius: 8,
              background: "var(--vn-surface)", color: "var(--vn-text-2)",
              fontSize: 13, fontWeight: 500, border: "1px solid var(--vn-border)", cursor: "pointer",
            }}
          >
            <Layers size={14} /> Tạo hàng loạt
          </button>
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 36, padding: "0 14px", borderRadius: 8,
              background: "var(--blue-600)", color: "#fff",
              fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
              boxShadow: "0 1px 0 rgba(255,255,255,.18) inset, var(--sh-sm)",
            }}
          >
            <Plus size={14} color="#fff" /> Tạo đơn lẻ
          </button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {STATUS_FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)} style={{
            height: 32, padding: "0 14px", borderRadius: 7,
            fontSize: 13, fontWeight: 500, cursor: "pointer",
            border: "1px solid",
            borderColor: filter === f.value ? "var(--blue-300)" : "var(--vn-border)",
            background: filter === f.value ? "var(--blue-50)" : "var(--vn-surface)",
            color: filter === f.value ? "var(--blue-700)" : "var(--vn-text-2)",
          }}>
            {f.label}
            {f.value !== "all" && (
              <span style={{
                marginLeft: 6, fontSize: 11, fontWeight: 600,
                background: filter === f.value ? "var(--blue-100)" : "var(--slate-100)",
                color: filter === f.value ? "var(--blue-700)" : "var(--slate-500)",
                padding: "1px 6px", borderRadius: 999,
              }}>
                {invoices.filter(i => i.status === f.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{
          background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: 14, padding: "56px 32px", textAlign: "center", boxShadow: "var(--sh-xs)",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: "var(--blue-50)",
            display: "grid", placeItems: "center", margin: "0 auto 16px",
          }}>
            <Receipt size={22} color="var(--blue-600)" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--vn-text-2)", marginBottom: 6 }}>
            {filter === "all" ? "Chưa có hóa đơn nào" : `Không có hóa đơn ${INVOICE_STATUS_LABELS[filter as InvoiceStatus]}`}
          </div>
          <div style={{ fontSize: 13.5, color: "var(--vn-text-3)" }}>
            Tạo hóa đơn từ hợp đồng đang hoạt động.
          </div>
        </div>
      ) : (
        <div style={{
          background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: 14, overflow: "hidden", boxShadow: "var(--sh-xs)",
        }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13.5 }}>
            <thead>
              <tr>
                {["Kỳ", "Phòng / Khách thuê", "Tổng tiền", "Trạng thái", ""].map(h => (
                  <th key={h} style={{
                    textAlign: "left", padding: "11px 16px",
                    font: "600 11px var(--font-geist-sans)",
                    color: "var(--vn-text-3)", letterSpacing: "0.04em",
                    textTransform: "uppercase", background: "var(--slate-50)",
                    borderBottom: "1px solid var(--vn-border)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv, i) => (
                <tr key={inv.id} style={{ cursor: "pointer" }}
                  onClick={() => setDrawerInvoiceId(inv.id)}>
                  <td style={{ padding: "13px 16px", borderBottom: i < filtered.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Calendar size={13} color="var(--vn-text-3)" />
                      <span style={{ fontWeight: 600, fontFamily: "var(--font-geist-mono)", color: "var(--vn-text)" }}>
                        {inv.period}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "13px 16px", borderBottom: i < filtered.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--vn-text)" }}>
                          <Building2 size={12} color="var(--vn-text-3)" />
                          <span style={{ fontWeight: 500 }}>{inv.property_name}</span>
                          <span style={{ color: "var(--vn-text-3)" }}>·</span>
                          <span>P.{inv.room_number}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--vn-text-3)", marginTop: 2 }}>
                          <User size={11} />
                          {inv.tenant_name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "13px 16px", borderBottom: i < filtered.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "var(--vn-text)" }}>
                    {fmtMoney(inv.total)}
                  </td>
                  <td style={{ padding: "13px 16px", borderBottom: i < filtered.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <StatusBadge status={inv.status} />
                      {inv.payment_reported_at && inv.status === "sent" && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          fontSize: 11, fontWeight: 600, color: "#92400E",
                          background: "#FFFBEB", border: "1px solid #FDE68A",
                          padding: "1px 7px", borderRadius: 999,
                        }}>
                          ⏳ Khách báo đã TT
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "13px 16px", borderBottom: i < filtered.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", width: 60, textAlign: "right" }}
                    onClick={e => e.stopPropagation()}>
                    <span style={{ fontSize: 12.5, color: "var(--blue-600)", cursor: "pointer" }}
                      onClick={() => setDrawerInvoiceId(inv.id)}>
                      Xem →
                    </span>
                  </td>
                </tr>
              ))}
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

      <Dialog open={showForm} onOpenChange={o => { if (!o) setShowForm(false); }}>
        <DialogContent style={{ maxWidth: 460 }}>
          <DialogHeader><DialogTitle>Tạo hóa đơn đơn lẻ</DialogTitle></DialogHeader>
          <InvoiceGenerateForm onSuccess={handleCreated} onCancel={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>

      {/* Property picker — batch invoice */}
      <Dialog open={showBatchPicker && !batchProperty} onOpenChange={o => { if (!o) setShowBatchPicker(false); }}>
        <DialogContent style={{ maxWidth: 420 }}>
          <DialogHeader><DialogTitle>Chọn nhà để tạo hoá đơn hàng loạt</DialogTitle></DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
            {properties.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--vn-text-3)", textAlign: "center", padding: "16px 0" }}>
                Chưa có nhà trọ nào.
              </p>
            )}
            {properties.map(p => (
              <button key={p.id} onClick={() => { setBatchProperty(p); setShowBatchPicker(false); }} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
                background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
                borderRadius: 9, cursor: "pointer", textAlign: "left",
                transition: "border-color .12s",
              }} className="hover:border-(--blue-300)">
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--blue-50)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Building2 size={16} color="var(--blue-600)" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--vn-text)" }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "var(--vn-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.address}</div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch billing modal — invoice mode */}
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
