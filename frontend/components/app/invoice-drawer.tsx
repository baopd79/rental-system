"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { X, Copy, Check, Zap, Droplets, Home, Tag, ExternalLink, AlertTriangle, Share2 } from "lucide-react";
import { apiJson, apiFetch } from "@/lib/api";
import type { Invoice, InvoiceItem, InvoiceStatus } from "@/types/invoice";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, INVOICE_ITEM_LABELS } from "@/types/invoice";

// ── helpers ───────────────────────────────────────────────────────
const fmtMoney = (n: string | number) => Number(n).toLocaleString("vi-VN") + "₫";
const BD = "1px solid var(--vn-border)";

const TRANSITIONS: Record<InvoiceStatus, { label: string; next: InvoiceStatus; color: string }[]> = {
  draft: [
    { label: "Gửi hoá đơn",              next: "sent", color: "var(--blue-600)" },
    { label: "Đánh dấu đã thanh toán",   next: "paid", color: "var(--green-600)" },
  ],
  sent:  [{ label: "Đánh dấu đã thanh toán", next: "paid", color: "var(--green-600)" }],
  paid:  [],
};

function ItemIcon({ type }: { type: string }) {
  if (type === "electricity") return <Zap size={13} color="var(--amber-500)" />;
  if (type === "water")       return <Droplets size={13} color="var(--blue-400)" />;
  if (type === "rent")        return <Home size={13} color="var(--slate-400)" />;
  if (type === "shared_elec") return <Share2 size={13} color="var(--amber-600)" />;
  return                             <Tag size={13} color="var(--violet-600)" />;
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const c = INVOICE_STATUS_COLORS[status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 22, padding: "0 10px", borderRadius: 999, fontSize: 12, fontWeight: 500, background: c.bg, color: c.fg }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.dot }} />
      {INVOICE_STATUS_LABELS[status]}
    </span>
  );
}

// ── confirm state type ────────────────────────────────────────────
type Confirming =
  | { type: "delete" }
  | { type: "transition"; label: string; next: InvoiceStatus; color: string };

// ── props ─────────────────────────────────────────────────────────
interface Props {
  invoiceId: number | null;
  onClose: () => void;
  onUpdate?: (inv: Invoice) => void;
  onDelete?: (id: number) => void;
  zIndexBase?: number;
}

export function InvoiceDrawer({ invoiceId, onClose, onUpdate, onDelete, zIndexBase = 400 }: Props) {
  const { getToken } = useAuth();
  const open = invoiceId !== null;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    setActionError(null);
    setConfirming(null);
    setInvoice(null);
    try {
      const data = await apiJson<Invoice>(`/invoices/${id}`, getToken);
      setInvoice(data);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (invoiceId !== null) load(invoiceId);
  }, [invoiceId, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirming) setConfirming(null);
        else onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, confirming, onClose]);

  async function handleTransition(next: InvoiceStatus) {
    if (!invoice) return;
    setActing(true); setActionError(null);
    const res = await apiFetch(`/invoices/${invoice.id}/status`, getToken, { method: "PUT", body: { status: next } });
    setActing(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      setActionError(err.detail ?? "Lỗi cập nhật trạng thái");
      setConfirming(null);
      return;
    }
    const updated: Invoice = await res.json();
    setInvoice(updated);
    setConfirming(null);
    onUpdate?.(updated);
  }

  async function handleDelete() {
    if (!invoice) return;
    setActing(true); setActionError(null);
    const res = await apiFetch(`/invoices/${invoice.id}`, getToken, { method: "DELETE" });
    setActing(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      setActionError(err.detail ?? "Lỗi xóa hoá đơn");
      setConfirming(null);
      return;
    }
    onDelete?.(invoice.id);
    onClose();
  }

  function handleCopyLink() {
    if (!invoice) return;
    const url = `${window.location.origin}/invoice/public/${invoice.public_token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const transitions = invoice ? (TRANSITIONS[invoice.status] ?? []) : [];
  const itemGroups = {
    rent:        (invoice?.items ?? []).filter(i => i.item_type === "rent"),
    electricity: (invoice?.items ?? []).filter(i => i.item_type === "electricity"),
    water:       (invoice?.items ?? []).filter(i => i.item_type === "water"),
    surcharge:   (invoice?.items ?? []).filter(i => i.item_type === "surcharge"),
  };

  // ── footer content ──────────────────────────────────────────────
  function renderFooter() {
    if (!invoice) return null;

    // Inline confirmation state
    if (confirming) {
      const isDelete = confirming.type === "delete";
      const confirmColor = isDelete ? "var(--red-600)" : (confirming as { color: string }).color;
      const confirmLabel = isDelete ? "Xóa hoá đơn" : (confirming as { label: string }).label;
      const confirmMsg = isDelete
        ? "Xóa hoá đơn nháp này? Hành động không thể hoàn tác."
        : `${confirmLabel}? Trạng thái sẽ chuyển sang "${INVOICE_STATUS_LABELS[(confirming as { next: InvoiceStatus }).next]}" và không thể hoàn tác.`;

      return (
        <div style={{
          padding: "12px 20px", borderTop: BD, flexShrink: 0,
          background: isDelete ? "var(--red-50)" : "var(--blue-50)",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <AlertTriangle size={14} color={confirmColor} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: "var(--vn-text-2)", lineHeight: 1.5 }}>{confirmMsg}</span>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={() => setConfirming(null)}
              disabled={acting}
              style={{ height: 32, padding: "0 14px", borderRadius: 7, border: BD, background: "var(--vn-surface)", fontSize: 13, cursor: "pointer", color: "var(--vn-text-2)", fontWeight: 500 }}
            >
              Hủy
            </button>
            <button
              onClick={() => isDelete ? handleDelete() : handleTransition((confirming as { next: InvoiceStatus }).next)}
              disabled={acting}
              style={{ height: 32, padding: "0 16px", borderRadius: 7, border: "none", background: confirmColor, color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600, opacity: acting ? 0.7 : 1 }}
            >
              {acting ? "Đang xử lý…" : confirmLabel}
            </button>
          </div>
          {actionError && <p style={{ fontSize: 12.5, color: "var(--red-600)", margin: 0 }}>{actionError}</p>}
        </div>
      );
    }

    // Normal action buttons
    return (
      <div style={{ padding: "12px 20px", borderTop: BD, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "var(--vn-surface)" }}>
        <div>
          {invoice.status === "draft" && (
            <button
              onClick={() => setConfirming({ type: "delete" })}
              style={{ height: 34, padding: "0 14px", borderRadius: 8, background: "transparent", border: "1px solid var(--red-200)", fontSize: 13, cursor: "pointer", color: "var(--red-600)", fontWeight: 500 }}
            >
              Xóa nháp
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {transitions.map(t => (
            <button
              key={t.next}
              onClick={() => setConfirming({ type: "transition", label: t.label, next: t.next, color: t.color })}
              style={{ height: 34, padding: "0 16px", borderRadius: 8, background: t.color, color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => { if (confirming) setConfirming(null); else onClose(); }}
        style={{ position: "fixed", inset: 0, zIndex: zIndexBase, background: "rgba(0,0,0,0.25)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.22s ease" }}
      />

      {/* Drawer panel */}
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 520, zIndex: zIndexBase + 1, background: "var(--vn-bg, #fff)", boxShadow: "-8px 0 40px rgba(0,0,0,0.12)", transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: BD, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--vn-text)", letterSpacing: "-0.01em" }}>
                {invoice ? `Hóa đơn ${invoice.period}` : "Hóa đơn"}
              </div>
              {invoice && <div style={{ fontSize: 12, color: "var(--vn-text-3)", marginTop: 1 }}>#{invoice.id} · HĐ #{invoice.contract_id}</div>}
            </div>
            {invoice && <StatusBadge status={invoice.status} />}
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: BD, background: "var(--vn-surface)", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--vn-text-2)", flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {loading && <div style={{ color: "var(--vn-text-3)", fontSize: 13.5, paddingTop: 40, textAlign: "center" }}>Đang tải...</div>}
          {!loading && !invoice && <div style={{ color: "var(--vn-text-3)", fontSize: 13.5, paddingTop: 40, textAlign: "center" }}>Không tìm thấy hóa đơn.</div>}

          {invoice && (
            <>
              {/* Items breakdown */}
              <div style={{ background: "var(--vn-surface)", border: BD, borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", padding: "9px 16px", background: "var(--slate-50)", borderBottom: BD, fontSize: 11, fontWeight: 600, color: "var(--vn-text-3)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  <span>Khoản mục</span>
                  <span style={{ textAlign: "right", paddingRight: 60 }}>Đơn giá × SL</span>
                  <span style={{ textAlign: "right", minWidth: 100 }}>Thành tiền</span>
                </div>

                {(["rent","electricity","water","surcharge"] as const).flatMap(type =>
                  itemGroups[type].map((item: InvoiceItem) => (
                    <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", padding: "11px 16px", borderBottom: BD, alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <ItemIcon type={item.item_type} />
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 13, color: "var(--vn-text)" }}>{item.name}</div>
                          <div style={{ fontSize: 11.5, color: "var(--vn-text-3)", marginTop: 1 }}>{INVOICE_ITEM_LABELS[item.item_type]}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", fontSize: 12.5, color: "var(--vn-text-2)", paddingRight: 60, fontVariantNumeric: "tabular-nums" }}>
                        {fmtMoney(item.unit_price)} × {Number(item.quantity).toLocaleString("vi-VN")}
                      </div>
                      <div style={{ textAlign: "right", minWidth: 100, fontWeight: 600, fontSize: 13.5, color: "var(--vn-text)", fontVariantNumeric: "tabular-nums" }}>
                        {fmtMoney(item.amount)}
                      </div>
                    </div>
                  ))
                )}

                {/* Total */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", padding: "14px 16px", background: "var(--slate-50)" }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--vn-text)" }}>Tổng cộng</div>
                  <div style={{ fontWeight: 700, fontSize: 20, color: "var(--blue-700)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                    {fmtMoney(invoice.total)}
                  </div>
                </div>
              </div>

              {/* Public link */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 14px", borderRadius: 10, background: "var(--blue-50)", border: "1px solid var(--blue-200)", fontSize: 13, color: "var(--blue-700)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  <ExternalLink size={13} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontFamily: "var(--font-geist-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    /invoice/public/{invoice.public_token.slice(0, 8)}…
                  </span>
                </div>
                <button onClick={handleCopyLink} style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, height: 28, padding: "0 12px", borderRadius: 6, background: copied ? "var(--green-600)" : "#fff", color: copied ? "#fff" : "var(--blue-700)", border: `1px solid ${copied ? "var(--green-600)" : "var(--blue-300)"}`, fontSize: 12.5, cursor: "pointer", fontWeight: 500, transition: "all .15s" }}>
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Đã copy" : "Copy link"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer — inline confirm or action buttons */}
        {renderFooter()}
      </div>
    </>
  );
}
