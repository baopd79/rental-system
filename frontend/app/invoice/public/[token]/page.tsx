"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Zap, Droplets, Home, Tag, Copy, Check } from "lucide-react";
import type { Invoice, InvoiceItem } from "@/types/invoice";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, INVOICE_ITEM_LABELS } from "@/types/invoice";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

function fmtMoney(n: string | number) {
  return Number(n).toLocaleString("vi-VN") + "₫";
}

function ItemIcon({ type }: { type: string }) {
  if (type === "electricity") return <Zap size={14} color="var(--amber-500)" />;
  if (type === "water")       return <Droplets size={14} color="var(--blue-400)" />;
  if (type === "rent")        return <Home size={14} color="var(--slate-400)" />;
  return <Tag size={14} color="var(--purple-400)" />;
}

export default function PublicInvoicePage() {
  const { token } = useParams<{ token: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/invoices/public/${token}`)
      .then(async res => {
        if (res.status === 404) { setNotFound(true); return; }
        if (!res.ok) throw new Error("Lỗi tải hóa đơn");
        setInvoice(await res.json());
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  function handleCopy() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#64748B", fontSize: 14 }}>
      Đang tải…
    </div>
  );

  if (notFound || !invoice) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 12 }}>
      <div style={{ fontSize: 40 }}>🔍</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "#0F172A" }}>Không tìm thấy hóa đơn</div>
      <div style={{ fontSize: 14, color: "#64748B" }}>Link không hợp lệ hoặc đã hết hạn.</div>
    </div>
  );

  const statusColor = INVOICE_STATUS_COLORS[invoice.status];

  return (
    <div style={{
      minHeight: "100vh", background: "#F8FAFC",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {/* Top bar */}
      <div style={{
        background: "#2563EB", color: "#fff",
        padding: "12px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 13.5,
      }}>
        <div style={{ fontWeight: 700, letterSpacing: "-0.01em" }}>VnRental</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            background: "rgba(255,255,255,.2)", padding: "3px 10px",
            borderRadius: 999, fontSize: 12, fontWeight: 500,
          }}>
            {INVOICE_STATUS_LABELS[invoice.status]}
          </span>
          <button onClick={handleCopy} style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            height: 30, padding: "0 12px", borderRadius: 6,
            background: "rgba(255,255,255,.15)", border: "none",
            color: "#fff", fontSize: 12.5, cursor: "pointer",
          }}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Đã copy" : "Copy link"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 24px" }}>
        {/* Header */}
        <div style={{
          background: "#fff", borderRadius: 16,
          border: "1px solid #E2E8F0",
          padding: "24px 28px", marginBottom: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,.06)",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 13, color: "#64748B", marginBottom: 4 }}>Hóa đơn tiền nhà</div>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", color: "#0F172A" }}>
                Kỳ {invoice.period}
              </div>
              <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 4 }}>
                Mã hóa đơn #{invoice.id}
              </div>
            </div>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              height: 26, padding: "0 12px", borderRadius: 999,
              fontSize: 12.5, fontWeight: 600,
              background: statusColor.bg, color: statusColor.fg,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor.dot }} />
              {INVOICE_STATUS_LABELS[invoice.status]}
            </span>
          </div>
        </div>

        {/* Items */}
        <div style={{
          background: "#fff", borderRadius: 16,
          border: "1px solid #E2E8F0",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,.06)",
          marginBottom: 16,
        }}>
          <div style={{
            padding: "12px 20px", background: "#F8FAFC",
            borderBottom: "1px solid #E2E8F0",
            display: "grid", gridTemplateColumns: "1fr auto",
            fontSize: 11.5, fontWeight: 600, color: "#94A3B8",
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            <span>Khoản mục</span>
            <span>Thành tiền</span>
          </div>

          {invoice.items.map((item: InvoiceItem) => (
            <div key={item.id} style={{
              display: "grid", gridTemplateColumns: "1fr auto",
              padding: "14px 20px",
              borderBottom: "1px solid #F1F5F9",
              alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: "#F8FAFC", display: "grid", placeItems: "center", flexShrink: 0,
                }}>
                  <ItemIcon type={item.item_type} />
                </div>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13.5, color: "#1E293B" }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 1 }}>
                    {INVOICE_ITEM_LABELS[item.item_type]}
                    {Number(item.quantity) !== 1 && ` × ${Number(item.quantity).toLocaleString("vi-VN")}`}
                  </div>
                </div>
              </div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#1E293B", textAlign: "right" }}>
                {fmtMoney(item.amount)}
              </div>
            </div>
          ))}

          {/* Total */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr auto",
            padding: "16px 20px",
            background: "#EFF6FF",
            borderTop: "2px solid #DBEAFE",
          }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1E40AF" }}>Tổng cộng</div>
            <div style={{ fontWeight: 800, fontSize: 22, color: "#2563EB", letterSpacing: "-0.025em" }}>
              {fmtMoney(invoice.total)}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: 12.5, color: "#94A3B8", marginTop: 24 }}>
          Hóa đơn được tạo tự động bởi{" "}
          <span style={{ color: "#2563EB", fontWeight: 600 }}>VnRental</span>
        </div>
      </div>
    </div>
  );
}
