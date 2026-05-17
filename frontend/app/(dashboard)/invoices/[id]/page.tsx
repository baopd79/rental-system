"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, Copy, Check, Zap, Droplets, Home, Tag } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiJson, apiFetch } from "@/lib/api";
import type { Invoice, InvoiceItem, InvoiceStatus } from "@/types/invoice";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, INVOICE_ITEM_LABELS } from "@/types/invoice";

function fmtMoney(n: string | number) {
  return Number(n).toLocaleString("vi-VN") + "₫";
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const c = INVOICE_STATUS_COLORS[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      height: 24, padding: "0 12px", borderRadius: 999,
      fontSize: 12.5, fontWeight: 500,
      background: c.bg, color: c.fg,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot }} />
      {INVOICE_STATUS_LABELS[status]}
    </span>
  );
}

function ItemIcon({ type }: { type: string }) {
  if (type === "electricity") return <Zap size={14} color="var(--amber-500)" />;
  if (type === "water")       return <Droplets size={14} color="var(--blue-400)" />;
  if (type === "rent")        return <Home size={14} color="var(--slate-400)" />;
  return <Tag size={14} color="var(--purple-400)" />;
}

const TRANSITIONS: Record<InvoiceStatus, { label: string; next: InvoiceStatus }[]> = {
  draft: [
    { label: "Gửi hóa đơn", next: "sent" },
    { label: "Đánh dấu đã thanh toán", next: "paid" },
  ],
  sent: [{ label: "Đánh dấu đã thanh toán", next: "paid" }],
  paid: [],
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [confirmTransition, setConfirmTransition] = useState<{ label: string; next: InvoiceStatus } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiJson<Invoice>(`/invoices/${id}`, getToken);
      setInvoice(data);
    } finally {
      setLoading(false);
    }
  }, [id, getToken]);

  useEffect(() => { load(); }, [load]);

  async function handleTransition(next: InvoiceStatus) {
    const res = await apiFetch(`/invoices/${id}/status`, getToken, {
      method: "PUT",
      body: { status: next },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      setActionError(err.detail ?? "Lỗi cập nhật trạng thái");
      return;
    }
    setInvoice(await res.json());
    setConfirmTransition(null);
  }

  async function handleDelete() {
    const res = await apiFetch(`/invoices/${id}`, getToken, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      setActionError(err.detail ?? "Lỗi xóa hóa đơn");
      return;
    }
    router.push("/invoices");
  }

  function handleCopyLink() {
    if (!invoice) return;
    const url = `${window.location.origin}/invoice/public/${invoice.public_token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const itemGroups: Record<string, InvoiceItem[]> = {
    rent:        (invoice?.items ?? []).filter(i => i.item_type === "rent"),
    electricity: (invoice?.items ?? []).filter(i => i.item_type === "electricity"),
    water:       (invoice?.items ?? []).filter(i => i.item_type === "water"),
    surcharge:   (invoice?.items ?? []).filter(i => i.item_type === "surcharge"),
  };

  if (loading) return <div style={{ padding: 24, color: "var(--vn-text-3)", fontSize: 13.5 }}>Đang tải...</div>;
  if (!invoice) return <div style={{ padding: 24, color: "var(--vn-text-3)", fontSize: 13.5 }}>Không tìm thấy hóa đơn.</div>;

  const transitions = TRANSITIONS[invoice.status] ?? [];

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => router.push("/invoices")} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, color: "var(--vn-text-3)", background: "none",
          border: "none", cursor: "pointer", padding: 0, marginBottom: 10,
        }}>
          <ArrowLeft size={14} /> Hóa đơn
        </button>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.018em", color: "var(--vn-text)", margin: 0 }}>
                Hóa đơn {invoice.period}
              </h1>
              <StatusBadge status={invoice.status} />
            </div>
            <p style={{ fontSize: 13, color: "var(--vn-text-3)", marginTop: 3 }}>
              #{invoice.id} · Hợp đồng #{invoice.contract_id}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {/* Copy link */}
            <button onClick={handleCopyLink} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 36, padding: "0 14px", borderRadius: 8,
              background: "var(--vn-surface)", color: copied ? "var(--green-600)" : "var(--vn-text-2)",
              fontSize: 13.5, fontWeight: 500,
              border: `1px solid ${copied ? "var(--green-300)" : "var(--vn-border)"}`,
              cursor: "pointer", transition: "all .15s",
            }}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Đã copy" : "Copy link"}
            </button>

            {/* Status transitions */}
            {transitions.map(t => (
              <button key={t.next} onClick={() => setConfirmTransition(t)} style={{
                height: 36, padding: "0 14px", borderRadius: 8,
                background: t.next === "paid" ? "var(--green-600)" : "var(--blue-600)",
                color: "#fff", fontSize: 13.5, fontWeight: 500,
                border: "none", cursor: "pointer",
                boxShadow: "0 1px 0 rgba(255,255,255,.18) inset",
              }}>
                {t.label}
              </button>
            ))}

            {/* Delete draft */}
            {invoice.status === "draft" && (
              <button onClick={() => setConfirmDelete(true)} style={{
                height: 36, padding: "0 14px", borderRadius: 8,
                background: "var(--vn-surface)", color: "var(--red-600)",
                fontSize: 13.5, fontWeight: 500,
                border: "1px solid var(--red-200)", cursor: "pointer",
              }}>
                Xóa
              </button>
            )}
          </div>
        </div>
      </div>

      {actionError && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, marginBottom: 16,
          background: "var(--red-50)", border: "1px solid var(--red-200)",
          fontSize: 13, color: "var(--red-700)",
        }}>
          {actionError}
        </div>
      )}

      {/* Invoice breakdown */}
      <div style={{
        background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
        borderRadius: 14, overflow: "hidden", boxShadow: "var(--sh-xs)",
        marginBottom: 16,
      }}>
        <div style={{
          padding: "12px 20px", background: "var(--slate-50)",
          borderBottom: "1px solid var(--vn-border)",
          font: "500 11.5px var(--font-geist-sans)",
          color: "var(--vn-text-3)", letterSpacing: "0.04em", textTransform: "uppercase",
          display: "grid", gridTemplateColumns: "1fr auto auto",
        }}>
          <span>Khoản mục</span>
          <span style={{ textAlign: "right", paddingRight: 80 }}>Đơn giá × SL</span>
          <span style={{ textAlign: "right", minWidth: 120 }}>Thành tiền</span>
        </div>

        {(["rent", "electricity", "water", "surcharge"] as const).map(type => {
          const group = itemGroups[type];
          if (group.length === 0) return null;
          return group.map((item, i) => (
            <div key={item.id} style={{
              display: "grid", gridTemplateColumns: "1fr auto auto",
              padding: "13px 20px",
              borderBottom: "1px solid var(--vn-border)",
              alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ItemIcon type={item.item_type} />
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13.5, color: "var(--vn-text)" }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--vn-text-3)", marginTop: 1 }}>
                    {INVOICE_ITEM_LABELS[item.item_type]}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right", fontSize: 13, color: "var(--vn-text-2)", paddingRight: 80, fontVariantNumeric: "tabular-nums" }}>
                {fmtMoney(item.unit_price)} × {Number(item.quantity).toLocaleString("vi-VN")}
              </div>
              <div style={{ textAlign: "right", minWidth: 120, fontWeight: 600, fontSize: 14, color: "var(--vn-text)", fontVariantNumeric: "tabular-nums" }}>
                {fmtMoney(item.amount)}
              </div>
            </div>
          ));
        })}

        {/* Total */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr auto",
          padding: "16px 20px",
          background: "var(--slate-50)",
        }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--vn-text)" }}>Tổng cộng</div>
          <div style={{
            fontWeight: 700, fontSize: 18, color: "var(--blue-700)",
            fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em",
          }}>
            {fmtMoney(invoice.total)}
          </div>
        </div>
      </div>

      {/* Public link hint */}
      <div style={{
        padding: "12px 16px", borderRadius: 10,
        background: "var(--blue-50)", border: "1px solid var(--blue-200)",
        fontSize: 13, color: "var(--blue-700)", display: "flex", alignItems: "center", gap: 8,
      }}>
        <Copy size={14} />
        <span>
          Link public:{" "}
          <code style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12 }}>
            /invoice/public/{invoice.public_token.slice(0, 8)}…
          </code>
          {" "}— gửi qua Zalo/SMS, không cần đăng nhập.
        </span>
      </div>

      {/* Confirm transition */}
      <AlertDialog open={!!confirmTransition} onOpenChange={o => { if (!o) setConfirmTransition(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTransition?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Hóa đơn sẽ chuyển sang trạng thái{" "}
              <strong>{confirmTransition ? INVOICE_STATUS_LABELS[confirmTransition.next] : ""}</strong>.
              {confirmTransition?.next !== "draft" && " Không thể hoàn tác."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmTransition && handleTransition(confirmTransition.next)}
              className={confirmTransition?.next === "paid" ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {confirmTransition?.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete */}
      <AlertDialog open={confirmDelete} onOpenChange={o => { if (!o) setConfirmDelete(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa hóa đơn nháp?</AlertDialogTitle>
            <AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
