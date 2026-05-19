"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  X, Receipt, ArrowLeft, Copy, Check,
  Zap, Droplets, Home, Tag, ExternalLink, AlertTriangle, Share2,
} from "lucide-react";
import { apiJson, apiFetch } from "@/lib/api";
import { InvoiceGenerateForm } from "@/components/app/invoice-generate-form";
import type { Invoice, InvoiceItem, InvoiceStatus } from "@/types/invoice";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, INVOICE_ITEM_LABELS } from "@/types/invoice";

interface Props {
  open: boolean;
  onClose: () => void;
  onInvoiceCreated?: (inv: Invoice) => void;
}

const BD = "1px solid var(--vn-border)";
const fmtMoney = (n: string | number) => Number(n).toLocaleString("vi-VN") + "₫";

const TRANSITIONS: Record<InvoiceStatus, { label: string; next: InvoiceStatus; color: string }[]> = {
  draft: [
    { label: "Gửi hoá đơn",            next: "sent", color: "var(--blue-600)" },
    { label: "Đánh dấu đã thanh toán", next: "paid", color: "var(--green-600)" },
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

type Confirming =
  | { type: "delete" }
  | { type: "transition"; label: string; next: InvoiceStatus; color: string };

export function InvoiceGenerateDrawer({ open, onClose, onInvoiceCreated }: Props) {
  const { getToken } = useAuth();

  // "create" = show form | "view" = show created invoice
  const [mode,          setMode]          = useState<"create" | "view">("create");
  const [invoice,       setInvoice]       = useState<Invoice | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);

  // Invoice view state
  const [copied,      setCopied]      = useState(false);
  const [confirming,  setConfirming]  = useState<Confirming | null>(null);
  const [acting,      setActing]      = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Reset when drawer closes
  useEffect(() => {
    if (!open) {
      setMode("create");
      setInvoice(null);
      setConfirming(null);
      setActionError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirming) { setConfirming(null); return; }
        if (mode === "view") { setMode("create"); setInvoice(null); setRefreshSignal(s => s + 1); return; }
        onClose();
      }
    };
    document.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [open, mode, confirming, onClose]);

  const loadInvoice = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const data = await apiJson<Invoice>(`/invoices/${id}`, getToken);
      setInvoice(data);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  function handleCreated(inv: Invoice) {
    onInvoiceCreated?.(inv);
    loadInvoice(inv.id);
    setMode("view");
  }

  function handleViewExisting(id: number) {
    loadInvoice(id);
    setMode("view");
  }

  async function handleTransition(next: InvoiceStatus) {
    if (!invoice) return;
    setActing(true); setActionError(null);
    const res = await apiFetch(`/invoices/${invoice.id}/status`, getToken, { method: "PUT", body: { status: next } });
    setActing(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      setActionError(err.detail ?? "Lỗi cập nhật"); setConfirming(null); return;
    }
    setInvoice(await res.json());
    setConfirming(null);
  }

  async function handleDelete() {
    if (!invoice) return;
    setActing(true); setActionError(null);
    const res = await apiFetch(`/invoices/${invoice.id}`, getToken, { method: "DELETE" });
    setActing(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      setActionError(err.detail ?? "Lỗi xóa"); setConfirming(null); return;
    }
    onClose();
  }

  function handleCopyLink() {
    if (!invoice) return;
    navigator.clipboard.writeText(`${window.location.origin}/invoice/public/${invoice.public_token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const transitions = invoice ? (TRANSITIONS[invoice.status] ?? []) : [];

  // ── Header ────────────────────────────────────────────────────────
  function renderHeader() {
    if (mode === "create") {
      return (
        <div style={{ padding: "16px 20px", borderBottom: BD, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--blue-50)", display: "grid", placeItems: "center" }}>
              <Receipt size={15} color="var(--blue-600)" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--vn-text)", letterSpacing: "-0.015em" }}>Tạo hoá đơn đơn lẻ</div>
              <div style={{ fontSize: 12, color: "var(--vn-text-3)", marginTop: 1 }}>Chọn phòng và kỳ thanh toán</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, border: BD, background: "var(--vn-surface)", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--vn-text-2)" }}>
            <X size={14} />
          </button>
        </div>
      );
    }

    return (
      <div style={{ padding: "16px 20px", borderBottom: BD, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => { setMode("create"); setInvoice(null); setConfirming(null); setRefreshSignal(s => s + 1); }}
            title="Tạo hoá đơn khác"
            style={{ width: 30, height: 30, borderRadius: 7, border: BD, background: "var(--vn-surface)", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--vn-text-2)", flexShrink: 0 }}
          >
            <ArrowLeft size={14} />
          </button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--vn-text)", letterSpacing: "-0.01em" }}>
              {invoice ? `Hoá đơn ${invoice.period}` : "Hoá đơn"}
            </div>
            {invoice && <div style={{ fontSize: 12, color: "var(--vn-text-3)", marginTop: 1 }}>#{invoice.id}</div>}
          </div>
          {invoice && <StatusBadge status={invoice.status} />}
        </div>
        <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, border: BD, background: "var(--vn-surface)", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--vn-text-2)" }}>
          <X size={14} />
        </button>
      </div>
    );
  }

  // ── Footer (invoice view only) ────────────────────────────────────
  function renderFooter() {
    if (mode !== "view" || !invoice) return null;

    if (confirming) {
      const isDelete = confirming.type === "delete";
      const color    = isDelete ? "var(--red-600)" : (confirming as { color: string }).color;
      const label    = isDelete ? "Xóa hoá đơn"   : (confirming as { label: string }).label;
      const msg      = isDelete
        ? "Xóa hoá đơn nháp này? Không thể hoàn tác."
        : `${label}? Trạng thái sẽ chuyển sang "${INVOICE_STATUS_LABELS[(confirming as { next: InvoiceStatus }).next]}".`;
      return (
        <div style={{ padding: "12px 20px", borderTop: BD, flexShrink: 0, background: isDelete ? "var(--red-50)" : "var(--blue-50)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <AlertTriangle size={14} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: "var(--vn-text-2)", lineHeight: 1.5 }}>{msg}</span>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setConfirming(null)} disabled={acting} style={{ height: 32, padding: "0 14px", borderRadius: 7, border: BD, background: "var(--vn-surface)", fontSize: 13, cursor: "pointer", color: "var(--vn-text-2)", fontWeight: 500 }}>
              Hủy
            </button>
            <button
              onClick={() => isDelete ? handleDelete() : handleTransition((confirming as { next: InvoiceStatus }).next)}
              disabled={acting}
              style={{ height: 32, padding: "0 16px", borderRadius: 7, border: "none", background: color, color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600, opacity: acting ? 0.7 : 1 }}
            >
              {acting ? "Đang xử lý…" : label}
            </button>
          </div>
          {actionError && <p style={{ fontSize: 12.5, color: "var(--red-600)", margin: 0 }}>{actionError}</p>}
        </div>
      );
    }

    return (
      <div style={{ padding: "12px 20px", borderTop: BD, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "var(--vn-surface)" }}>
        <div>
          {invoice.status === "draft" && (
            <button onClick={() => setConfirming({ type: "delete" })} style={{ height: 34, padding: "0 14px", borderRadius: 8, background: "transparent", border: "1px solid var(--red-200)", fontSize: 13, cursor: "pointer", color: "var(--red-600)", fontWeight: 500 }}>
              Xóa nháp
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {transitions.map(t => (
            <button key={t.next} onClick={() => setConfirming({ type: "transition", label: t.label, next: t.next, color: t.color })}
              style={{ height: 34, padding: "0 16px", borderRadius: 8, background: t.color, color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>
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
        onClick={() => { if (confirming) { setConfirming(null); return; } onClose(); }}
        style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(15,23,42,.18)", backdropFilter: "blur(2px)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity .2s ease" }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 480,
        zIndex: 401,
        background: "var(--vn-surface)",
        boxShadow: "var(--sh-pop)",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform .25s cubic-bezier(.4,0,.2,1)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {renderHeader()}

        {/* Body — two panels that slide horizontally */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          {/* ── Panel: Create Form ─────────────────────────────── */}
          <div style={{
            position: "absolute", inset: 0, overflowY: "auto", padding: "20px",
            transform: mode === "view" ? "translateX(-100%)" : "translateX(0)",
            opacity: mode === "view" ? 0 : 1,
            transition: "transform .28s cubic-bezier(.4,0,.2,1), opacity .2s ease",
            pointerEvents: mode === "view" ? "none" : "auto",
          }}>
            {open && (
              <InvoiceGenerateForm
                onSuccess={handleCreated}
                onCancel={onClose}
                onViewInvoice={handleViewExisting}
                refreshSignal={refreshSignal}
              />
            )}
          </div>

          {/* ── Panel: Invoice View ────────────────────────────── */}
          <div style={{
            position: "absolute", inset: 0, overflowY: "auto", padding: "20px",
            transform: mode === "create" ? "translateX(100%)" : "translateX(0)",
            opacity: mode === "create" ? 0 : 1,
            transition: "transform .28s cubic-bezier(.4,0,.2,1), opacity .2s ease",
            pointerEvents: mode === "create" ? "none" : "auto",
          }}>
          {mode === "view" && (
            loading ? (
              <div style={{ textAlign: "center", paddingTop: 48, color: "var(--vn-text-3)", fontSize: 13 }}>Đang tải…</div>
            ) : invoice ? (
              <>
                {/* Success banner — only show when invoice was just created (not viewing existing) */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "var(--green-50)", border: "1px solid var(--green-200)", marginBottom: 16 }}>
                  <Check size={15} color="var(--green-600)" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--green-800)" }}>
                    Hoá đơn #{invoice.id}
                  </span>
                  <button
                    onClick={() => { setMode("create"); setConfirming(null); setRefreshSignal(s => s + 1); }}
                    style={{ marginLeft: "auto", fontSize: 12, color: "var(--green-700)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}
                  >
                    ← Quay lại
                  </button>
                </div>

                {/* Items */}
                <div style={{ background: "var(--vn-surface)", border: BD, borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", padding: "9px 16px", background: "var(--slate-50)", borderBottom: BD, fontSize: 11, fontWeight: 600, color: "var(--vn-text-3)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    <span>Khoản mục</span>
                    <span style={{ textAlign: "right", paddingRight: 60 }}>Đơn giá × SL</span>
                    <span style={{ textAlign: "right", minWidth: 90 }}>Thành tiền</span>
                  </div>
                  {invoice.items.map((item: InvoiceItem) => (
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
                      <div style={{ textAlign: "right", minWidth: 90, fontWeight: 600, fontSize: 13.5, color: "var(--vn-text)", fontVariantNumeric: "tabular-nums" }}>
                        {fmtMoney(item.amount)}
                      </div>
                    </div>
                  ))}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", padding: "14px 16px", background: "var(--slate-50)" }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5, color: "var(--vn-text)" }}>Tổng cộng</span>
                    <span style={{ fontWeight: 700, fontSize: 20, color: "var(--blue-700)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                      {fmtMoney(invoice.total)}
                    </span>
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
            ) : null
          )}
          </div>{/* end panel: invoice view */}
        </div>{/* end body container */}

        {renderFooter()}
      </div>
    </>
  );
}
