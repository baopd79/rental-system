"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Zap, Droplets, Home, Tag, Copy, Check,
  Building2, BedDouble, CircleCheck, Clock, AlertCircle,
  ChevronDown, ChevronUp, Share2, Printer,
} from "lucide-react";
import type { InvoiceItem } from "@/types/invoice";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

interface PublicInvoice {
  id: number;
  contract_id: number;
  period: string;
  total: string;
  status: "draft" | "sent" | "paid";
  public_token: string;
  payment_reported_at: string | null;
  room_number: string;
  property_name: string;
  tenant_name: string;
  bank_account_no: string | null;
  bank_name: string | null;
  bank_holder: string | null;
  items: InvoiceItem[];
}

const fmtMoney = (n: string | number) => Number(n).toLocaleString("vi-VN") + "₫";
const fmtPeriod = (p: string) => {
  const [y, m] = p.split("-");
  return `Tháng ${Number(m)}/${y}`;
};

const STATUS_CONFIG = {
  draft:  { label: "Chưa gửi",       icon: Clock,         bg: "#F1F5F9", fg: "#475569", dot: "#94A3B8",  badge: "Nháp" },
  sent:   { label: "Chờ thanh toán", icon: AlertCircle,   bg: "#EFF6FF", fg: "#1D4ED8", dot: "#3B82F6",  badge: "Chưa thanh toán" },
  paid:   { label: "Đã thanh toán",  icon: CircleCheck,   bg: "#F0FDF4", fg: "#15803D", dot: "#22C55E",  badge: "Đã thanh toán" },
};

const ITEM_ICONS: Record<string, React.ReactNode> = {
  electricity: <Zap size={15} color="#F59E0B" />,
  water:       <Droplets size={15} color="#60A5FA" />,
  rent:        <Home size={15} color="#94A3B8" />,
  shared_elec: <Share2 size={15} color="#F59E0B" />,
};

const ITEM_LABELS: Record<string, string> = {
  rent:        "Tiền thuê",
  electricity: "Tiền điện",
  water:       "Tiền nước",
  surcharge:   "Phụ phí",
  shared_elec: "Điện chung",
};

// VietQR img URL — free, no auth needed
function qrUrl(accountNo: string, bankName: string, holder: string, amount: number, desc: string) {
  const bankCode = bankName.toUpperCase().replace(/\s/g, "");
  const params = new URLSearchParams({
    amount: String(amount),
    addInfo: desc,
    accountName: holder,
  });
  return `https://img.vietqr.io/image/${bankCode}-${accountNo}-compact2.png?${params}`;
}

export default function PublicInvoicePage() {
  const { token } = useParams<{ token: string }>();
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied]         = useState(false);
  const [reporting, setReporting]   = useState(false);
  const [reportErr, setReportErr]   = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(() => {
    fetch(`${API_BASE}/invoices/public/${token}`)
      .then(async res => {
        if (res.status === 404) { setNotFound(true); return; }
        if (!res.ok) throw new Error();
        setInvoice(await res.json());
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleReportPayment() {
    setReporting(true); setReportErr(null);
    try {
      const res = await fetch(`${API_BASE}/invoices/public/${token}/report-payment`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail ?? "Lỗi gửi thông báo");
      }
      setInvoice(await res.json());
    } catch (e) {
      setReportErr(e instanceof Error ? e.message : "Lỗi gửi thông báo");
    } finally {
      setReporting(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePrint() {
    if (!detailOpen) {
      setDetailOpen(true);
      setTimeout(() => window.print(), 100);
    } else {
      window.print();
    }
  }

  // ── Loading ───────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#F8FAFC" }}>
      <div style={{ fontSize: 14, color: "#94A3B8" }}>Đang tải hoá đơn…</div>
    </div>
  );

  if (notFound || !invoice) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#F8FAFC", gap: 12 }}>
      <div style={{ fontSize: 40 }}>🔍</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>Không tìm thấy hoá đơn</div>
      <div style={{ fontSize: 14, color: "#64748B" }}>Link không hợp lệ hoặc đã hết hạn.</div>
    </div>
  );

  const st = STATUS_CONFIG[invoice.status];
  const StatusIcon = st.icon;
  const isPaid     = invoice.status === "paid";
  const isSent     = invoice.status === "sent";
  const isReported = !!invoice.payment_reported_at;
  const hasBankInfo = !!(invoice.bank_account_no && invoice.bank_name && invoice.bank_holder);

  const [y, m] = invoice.period.split("-");
  const periodLabel = fmtPeriod(invoice.period);
  // Due date = last day of invoice month
  const lastDay = new Date(Number(y), Number(m), 0).getDate();
  const dueDate = `${lastDay}/${m}/${y}`;

  // Group items for display
  const rentItems   = invoice.items.filter(i => i.item_type === "rent");
  const utilItems   = invoice.items.filter(i => ["electricity", "water", "shared_elec"].includes(i.item_type));
  const otherItems  = invoice.items.filter(i => i.item_type === "surcharge");

  return (
    <>
    <style>{`
      @media print {
        .no-print { display: none !important; }
        .print-only { display: block !important; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        header { position: static !important; box-shadow: none !important; }
        @page { margin: 0.8cm 1cm; size: A4 portrait; }
      }
    `}</style>
    <div style={{ minHeight: "100vh", background: "#F0F4F8", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* ── App Header ────────────────────────────────────────────── */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #E2E8F0",
        padding: "0 24px", height: 56,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 10,
        boxShadow: "0 1px 3px rgba(0,0,0,.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "#2563EB", display: "grid", placeItems: "center" }}>
            <BedDouble size={16} color="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 15, color: "#0F172A", letterSpacing: "-0.02em" }}>VnRental</span>
        </div>
        <div className="no-print" style={{ display: "flex", gap: 8 }}>
          <button onClick={handlePrint} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 34, padding: "0 14px", borderRadius: 8,
            background: "#F1F5F9", border: "1px solid #E2E8F0",
            color: "#475569", fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}>
            <Printer size={13} /> In / Lưu PDF
          </button>
          <button onClick={handleCopy} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 34, padding: "0 14px", borderRadius: 8,
            background: copied ? "#F0FDF4" : "#F1F5F9",
            border: `1px solid ${copied ? "#BBF7D0" : "#E2E8F0"}`,
            color: copied ? "#15803D" : "#475569",
            fontSize: 13, fontWeight: 500, cursor: "pointer",
            transition: "all .15s",
          }}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Đã sao chép!" : "Sao chép link"}
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "28px 16px 48px" }}>

        {/* ── Invoice Hero ──────────────────────────────────────────── */}
        <div style={{
          background: "#fff", borderRadius: 20,
          border: "1px solid #E2E8F0",
          padding: "28px 28px 24px",
          marginBottom: 16,
          boxShadow: "0 1px 4px rgba(0,0,0,.06)",
        }}>
          {/* Property context */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "#EFF6FF", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Building2 size={16} color="#2563EB" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{invoice.property_name}</div>
              <div style={{ fontSize: 12, color: "#94A3B8" }}>Phòng {invoice.room_number}</div>
            </div>
          </div>

          {/* Greeting */}
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.025em", marginBottom: 10 }}>
            Xin chào {invoice.tenant_name.split(" ").at(-1)} 👋
          </div>

          {/* Intro */}
          <div style={{
            fontSize: 14, lineHeight: 1.6, color: "#475569",
            background: "#F8FAFC", borderRadius: 10, padding: "12px 14px",
          }}>
            Đây là hoá đơn tiền thuê <strong style={{ color: "#0F172A" }}>{periodLabel}</strong> của bạn.
            {isSent && (
              <> Vui lòng kiểm tra chi tiết và thanh toán trước ngày <strong style={{ color: "#DC2626" }}>{dueDate}</strong>.</>
            )}
            {isPaid && <> Cảm ơn bạn đã thanh toán đúng hạn! 🎉</>}
          </div>
        </div>

        {/* ── Payment Summary Card ──────────────────────────────────── */}
        <div style={{
          background: "#fff", borderRadius: 20,
          border: "1px solid #E2E8F0",
          overflow: "hidden",
          marginBottom: 16,
          boxShadow: "0 1px 4px rgba(0,0,0,.06)",
        }}>
          {/* Status bar */}
          <div style={{ padding: "14px 22px", background: st.bg, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatusIcon size={16} color={st.fg} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: st.fg }}>{st.label}</span>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 600,
              background: st.fg, color: "#fff",
              padding: "2px 10px", borderRadius: 999,
            }}>
              {st.badge}
            </span>
          </div>

          <div style={{ padding: "22px 22px 20px" }}>
            {/* Meta row */}
            <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Mã hoá đơn</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1E293B", fontFamily: "monospace" }}>#{invoice.id}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Kỳ thanh toán</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1E293B" }}>{periodLabel}</div>
              </div>
              {isSent && (
                <div>
                  <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Hạn thanh toán</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#DC2626" }}>{dueDate}</div>
                </div>
              )}
            </div>

            {/* Total */}
            <div style={{
              background: isPaid ? "#F0FDF4" : "#EFF6FF",
              borderRadius: 14, padding: "18px 20px",
              marginBottom: hasBankInfo && isSent ? 20 : 0,
            }}>
              <div style={{ fontSize: 12, color: isPaid ? "#15803D" : "#2563EB", fontWeight: 600, marginBottom: 4 }}>TỔNG THANH TOÁN</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: isPaid ? "#15803D" : "#1D4ED8", letterSpacing: "-0.03em", lineHeight: 1 }}>
                {fmtMoney(invoice.total)}
              </div>
            </div>

            {/* QR + bank info — only when sent and bank info configured */}
            {isSent && hasBankInfo && (
              <div>
                <div style={{ height: 1, background: "#F1F5F9", margin: "20px 0" }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", marginBottom: 14 }}>Chuyển khoản ngân hàng</div>
                <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                  {/* QR */}
                  <div style={{ flexShrink: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrUrl(invoice.bank_account_no!, invoice.bank_name!, invoice.bank_holder!, Number(invoice.total), `P${invoice.room_number} ${periodLabel}`)}
                      alt="QR chuyển khoản"
                      width={130} height={130}
                      style={{ borderRadius: 10, border: "1px solid #E2E8F0", display: "block" }}
                    />
                  </div>
                  {/* Bank details */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { label: "Ngân hàng",    value: invoice.bank_name! },
                      { label: "Số tài khoản", value: invoice.bank_account_no! },
                      { label: "Chủ tài khoản", value: invoice.bank_holder! },
                      { label: "Số tiền",       value: fmtMoney(invoice.total) },
                      { label: "Nội dung CK",   value: `P${invoice.room_number} ${periodLabel}` },
                    ].map(row => (
                      <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span style={{ color: "#94A3B8" }}>{row.label}</span>
                        <span style={{ fontWeight: 600, color: "#1E293B", textAlign: "right", maxWidth: 180 }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Report payment button / pending state */}
                {isReported ? (
                  <div style={{
                    marginTop: 16, padding: "14px 16px", borderRadius: 12,
                    background: "#FFFBEB", border: "1px solid #FDE68A",
                    display: "flex", alignItems: "flex-start", gap: 10,
                  }}>
                    <Clock size={18} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#92400E" }}>
                        Đã gửi thông báo tới chủ nhà
                      </div>
                      <div style={{ fontSize: 12.5, color: "#B45309", marginTop: 3 }}>
                        Chủ nhà sẽ xác nhận sau khi kiểm tra tài khoản ngân hàng.
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {reportErr && (
                      <div style={{ marginTop: 14, padding: "8px 12px", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FECACA", fontSize: 13, color: "#DC2626" }}>
                        {reportErr}
                      </div>
                    )}
                    <div className="no-print">
                    <button
                      onClick={handleReportPayment}
                      disabled={reporting}
                      style={{
                        marginTop: 16, width: "100%", height: 48,
                        borderRadius: 12, border: "none", cursor: reporting ? "default" : "pointer",
                        background: reporting ? "#E2E8F0" : "#16A34A",
                        color: reporting ? "#94A3B8" : "#fff",
                        fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        boxShadow: reporting ? "none" : "0 2px 8px rgba(22,163,74,.35)",
                        transition: "all .15s",
                      }}
                    >
                      <Check size={18} />
                      {reporting ? "Đang gửi…" : "Tôi đã chuyển khoản"}
                    </button>
                    <div style={{ marginTop: 8, fontSize: 11.5, color: "#94A3B8", textAlign: "center" }}>
                      Chủ nhà sẽ xác nhận sau khi kiểm tra tài khoản
                    </div>
                  </div>
                  </>
                )}
              </div>
            )}

            {/* Already paid confirmation */}
            {isPaid && (
              <div style={{
                marginTop: 16, padding: "12px 16px", borderRadius: 12,
                background: "#F0FDF4", border: "1px solid #BBF7D0",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <CircleCheck size={20} color="#16A34A" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "#15803D" }}>
                  Hoá đơn này đã được thanh toán. Cảm ơn!
                </span>
              </div>
            )}

            {/* No bank info notice */}
            {isSent && !hasBankInfo && (
              <div style={{
                marginTop: 16, padding: "12px 16px", borderRadius: 10,
                background: "#FFFBEB", border: "1px solid #FDE68A",
                fontSize: 13, color: "#92400E",
              }}>
                Vui lòng liên hệ chủ nhà để biết thông tin thanh toán.
              </div>
            )}
          </div>
        </div>

        {/* ── Chi tiết hoá đơn ─────────────────────────────────────── */}
        <div style={{
          background: "#fff", borderRadius: 20,
          border: "1px solid #E2E8F0",
          overflow: "hidden",
          boxShadow: "0 1px 4px rgba(0,0,0,.06)",
        }}>
          {/* Collapsible header */}
          <button
            className="no-print"
            onClick={() => setDetailOpen(o => !o)}
            style={{
              width: "100%", padding: "16px 22px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "none", border: "none", cursor: "pointer",
              borderBottom: detailOpen ? "1px solid #F1F5F9" : "none",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>Chi tiết hoá đơn</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12.5, color: "#94A3B8" }}>{invoice.items.length} khoản</span>
              {detailOpen ? <ChevronUp size={16} color="#94A3B8" /> : <ChevronDown size={16} color="#94A3B8" />}
            </div>
          </button>
          {/* Always-visible header for print */}
          <div className="print-only" style={{ display: "none", padding: "16px 22px", borderBottom: "1px solid #F1F5F9" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>Chi tiết hoá đơn</span>
          </div>

          {detailOpen && (
            <div>
              {/* Render grouped sections */}
              {[
                { title: "Tiền thuê", items: rentItems },
                { title: "Điện / Nước", items: utilItems },
                { title: "Phụ phí", items: otherItems },
              ].filter(g => g.items.length > 0).map((group, gi) => (
                <div key={gi}>
                  <div style={{ padding: "10px 22px 6px", fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", background: "#F8FAFC", borderTop: gi > 0 ? "1px solid #F1F5F9" : undefined }}>
                    {group.title}
                  </div>
                  {group.items.map((item: InvoiceItem, idx) => (
                    <div key={item.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 22px",
                      borderBottom: idx < group.items.length - 1 ? "1px solid #F8FAFC" : "none",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#F8FAFC", display: "grid", placeItems: "center", flexShrink: 0 }}>
                          {ITEM_ICONS[item.item_type] ?? <Tag size={15} color="#A78BFA" />}
                        </div>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 500, color: "#1E293B" }}>{item.name}</div>
                          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 1 }}>
                            {ITEM_LABELS[item.item_type] ?? item.item_type}
                            {Number(item.quantity) !== 1 && ` · ${Number(item.quantity).toLocaleString("vi-VN")}`}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#1E293B" }}>{fmtMoney(item.amount)}</div>
                    </div>
                  ))}
                </div>
              ))}

              {/* Total row */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 22px",
                borderTop: "2px solid #E2E8F0",
                background: "#F8FAFC",
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>Tổng cộng</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: "#2563EB", letterSpacing: "-0.025em" }}>{fmtMoney(invoice.total)}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", marginTop: 28, fontSize: 12.5, color: "#94A3B8" }}>
          Hoá đơn được tạo tự động bởi{" "}
          <span style={{ color: "#2563EB", fontWeight: 600 }}>VnRental</span>
        </div>
      </div>
    </div>
    </>
  );
}
