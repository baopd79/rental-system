"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, Save, FileText, Copy, Check, AlertCircle, Zap, Droplets } from "lucide-react";
import { apiJson, apiFetch } from "@/lib/api";
import type { Property } from "@/types/property";
import type { RoomBillingStatus, BatchInvoiceResult } from "@/types/billing";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from "@/types/invoice";
import type { InvoiceStatus } from "@/types/invoice";

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtNum(n: string | null) {
  return n ? Number(n).toLocaleString("vi-VN") : "—";
}

function fmtMoney(n: string | null) {
  return n ? Number(n).toLocaleString("vi-VN") + "₫" : "—";
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const c = INVOICE_STATUS_COLORS[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      height: 20, padding: "0 8px", borderRadius: 999,
      fontSize: 11, fontWeight: 500, background: c.bg, color: c.fg,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.dot }} />
      {INVOICE_STATUS_LABELS[status]}
    </span>
  );
}

type RowInput = { elec_curr: string; water_curr: string };
type CopiedMap = Record<number, boolean>;

export default function BillingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();

  const [property, setProperty] = useState<Property | null>(null);
  const [period, setPeriod] = useState(currentPeriod());
  const [rows, setRows] = useState<RoomBillingStatus[]>([]);
  const [inputs, setInputs] = useState<Record<number, RowInput>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<BatchInvoiceResult | null>(null);
  const [copied, setCopied] = useState<CopiedMap>({});

  const loadStatus = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const [prop, status] = await Promise.all([
        apiJson<Property>(`/properties/${id}`, getToken),
        apiJson<RoomBillingStatus[]>(`/properties/${id}/billing/status?period=${p}`, getToken),
      ]);
      setProperty(prop);
      setRows(status);
      // Pre-fill inputs from existing readings
      const init: Record<number, RowInput> = {};
      for (const row of status) {
        init[row.room_id] = {
          elec_curr: row.elec_curr ?? "",
          water_curr: row.water_curr ?? "",
        };
      }
      setInputs(init);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [id, getToken]);

  useEffect(() => { loadStatus(period); }, [loadStatus, period]);

  function setInput(room_id: number, field: keyof RowInput, value: string) {
    setInputs(prev => ({ ...prev, [room_id]: { ...prev[room_id], [field]: value } }));
  }

  async function handleSaveReadings() {
    setSaving(true);
    setSaveError(null);
    const isPerMeter = property?.water_calc_type === "per_meter";

    const readings = rows
      .filter(row => {
        if (row.invoice_id) return false;                    // Bug 2: skip invoiced rooms
        const inp = inputs[row.room_id];
        if (!inp?.elec_curr) return false;
        // Bug 3: only send changed rows (compare as numbers to avoid "1150" vs "1150.00")
        const savedVal = row.elec_curr ? Number(row.elec_curr) : null;
        const inputVal = Number(inp.elec_curr);
        return savedVal !== inputVal;
      })
      .map(row => {
        const inp = inputs[row.room_id];
        return {
          room_id: row.room_id,
          elec_curr: Number(inp.elec_curr),
          ...(isPerMeter && inp.water_curr ? { water_curr: Number(inp.water_curr) } : {}),
        };
      });

    if (readings.length === 0) {
      setSaveError("Chưa nhập chỉ số nào.");
      setSaving(false);
      return;
    }

    try {
      const updated = await apiJson<RoomBillingStatus[]>(
        `/properties/${id}/billing/readings`,
        getToken,
        { method: "POST", body: { period, readings } },
      );
      setRows(updated);
      const init: Record<number, RowInput> = {};
      for (const row of updated) {
        init[row.room_id] = { elec_curr: row.elec_curr ?? "", water_curr: row.water_curr ?? "" };
      }
      setInputs(init);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Lỗi lưu chỉ số");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateInvoices() {
    setGenerating(true);
    setGenResult(null);
    try {
      const result = await apiJson<BatchInvoiceResult>(
        `/properties/${id}/billing/invoices`,
        getToken,
        { method: "POST", body: { period } },
      );
      setGenResult(result);
      await loadStatus(period);
    } catch (e) {
      setGenResult({ created: 0, skipped: 0, errors: [e instanceof Error ? e.message : "Lỗi tạo hóa đơn"] });
    } finally {
      setGenerating(false);
    }
  }

  function handleCopyLink(row: RoomBillingStatus) {
    const url = `${window.location.origin}/invoice/public/${row.public_token}`;
    navigator.clipboard.writeText(url);
    setCopied(prev => ({ ...prev, [row.room_id]: true }));
    setTimeout(() => setCopied(prev => ({ ...prev, [row.room_id]: false })), 2000);
  }

  const isPerMeter = property?.water_calc_type === "per_meter";
  const hasReadingsToSave = rows.some(r => {
    if (r.invoice_id) return false;
    const inp = inputs[r.room_id];
    if (!inp?.elec_curr) return false;
    // Compare as numbers to avoid "1150" vs "1150.00" false-positive
    const savedVal = r.elec_curr ? Number(r.elec_curr) : null;
    return savedVal !== Number(inp.elec_curr);
  });
  const readyToGenerate = rows.some(r => r.reading_id && !r.invoice_id);
  const allDone = rows.length > 0 && rows.every(r => r.invoice_id);

  if (loading) return <div style={{ padding: 24, color: "var(--vn-text-3)", fontSize: 13.5 }}>Đang tải...</div>;

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => router.push(`/properties/${id}`)} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, color: "var(--vn-text-3)", background: "none",
          border: "none", cursor: "pointer", padding: 0, marginBottom: 10,
        }}>
          <ArrowLeft size={14} /> {property?.name ?? "Nhà trọ"}
        </button>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.018em", color: "var(--vn-text)", margin: 0 }}>
              Tính tiền
            </h1>
            <p style={{ fontSize: 13, color: "var(--vn-text-3)", marginTop: 3 }}>
              {property?.name} · {rows.length} phòng đang thuê
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Period selector */}
            <input
              type="month"
              value={period}
              onChange={e => setPeriod(e.target.value)}
              style={{
                height: 36, padding: "0 12px", borderRadius: 8,
                border: "1px solid var(--vn-border)", background: "var(--vn-surface)",
                fontSize: 13.5, color: "var(--vn-text)", outline: "none",
                fontFamily: "var(--font-geist-mono)",
              }}
            />

            <button
              onClick={handleSaveReadings}
              disabled={saving || !hasReadingsToSave}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 36, padding: "0 16px", borderRadius: 8,
                background: hasReadingsToSave ? "var(--vn-surface)" : "var(--slate-50)",
                color: hasReadingsToSave ? "var(--vn-text-2)" : "var(--vn-text-3)",
                fontSize: 13.5, fontWeight: 500,
                border: "1px solid var(--vn-border)", cursor: hasReadingsToSave ? "pointer" : "default",
                opacity: saving ? 0.7 : 1,
              }}
            >
              <Save size={14} /> {saving ? "Đang lưu…" : "Lưu chỉ số"}
            </button>

            <button
              onClick={handleGenerateInvoices}
              disabled={generating || !readyToGenerate}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 36, padding: "0 16px", borderRadius: 8,
                background: readyToGenerate ? "var(--blue-600)" : "var(--slate-100)",
                color: readyToGenerate ? "#fff" : "var(--vn-text-3)",
                fontSize: 13.5, fontWeight: 500, border: "none",
                cursor: readyToGenerate ? "pointer" : "default",
                opacity: generating ? 0.7 : 1,
                boxShadow: readyToGenerate ? "0 1px 0 rgba(255,255,255,.18) inset, var(--sh-sm)" : "none",
              }}
            >
              <FileText size={14} /> {generating ? "Đang tạo…" : "Tạo hóa đơn"}
            </button>
          </div>
        </div>
      </div>

      {/* Feedback banners */}
      {saveError && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, marginBottom: 12,
          background: "var(--red-50)", border: "1px solid var(--red-200)",
          fontSize: 13, color: "var(--red-700)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertCircle size={14} /> {saveError}
        </div>
      )}

      {genResult && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, marginBottom: 12,
          background: genResult.errors.length ? "var(--amber-50)" : "var(--green-50)",
          border: `1px solid ${genResult.errors.length ? "var(--amber-200)" : "var(--green-200)"}`,
          fontSize: 13,
          color: genResult.errors.length ? "var(--amber-700)" : "var(--green-700)",
        }}>
          Tạo mới: <strong>{genResult.created}</strong> · Bỏ qua (đã có): <strong>{genResult.skipped}</strong>
          {genResult.errors.length > 0 && (
            <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
              {genResult.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      {allDone && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, marginBottom: 12,
          background: "var(--green-50)", border: "1px solid var(--green-200)",
          fontSize: 13, color: "var(--green-700)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <Check size={14} /> Tất cả phòng đã có hóa đơn kỳ {period}.
        </div>
      )}

      {/* Table */}
      {rows.length === 0 ? (
        <div style={{
          background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: 14, padding: "56px 32px", textAlign: "center", boxShadow: "var(--sh-xs)",
          fontSize: 14, color: "var(--vn-text-3)",
        }}>
          Không có phòng nào đang có hợp đồng active trong nhà này.
        </div>
      ) : (
        <div style={{
          background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: 14, overflow: "hidden", boxShadow: "var(--sh-xs)",
        }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13.5 }}>
            <thead>
              <tr>
                {[
                  "Phòng", "Khách thuê",
                  "Điện trước (kWh)", "Điện sau (kWh)",
                  ...(isPerMeter ? ["Nước trước (m³)", "Nước sau (m³)"] : []),
                  "Hóa đơn", "Actions",
                ].map(h => (
                  <th key={h} style={{
                    textAlign: "left", padding: "11px 14px",
                    font: "500 11.5px var(--font-geist-sans)",
                    color: "var(--vn-text-3)", letterSpacing: "0.04em",
                    textTransform: "uppercase", background: "var(--slate-50)",
                    borderBottom: "1px solid var(--vn-border)", whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const inp = inputs[row.room_id] ?? { elec_curr: "", water_curr: "" };
                const hasInvoice = !!row.invoice_id;
                const hasReading = !!row.reading_id;
                const isNew = !hasReading;

                // Row background hint
                let rowBg = "transparent";
                if (hasInvoice) rowBg = "var(--green-50)";
                else if (hasReading) rowBg = "var(--blue-50)";

                return (
                  <tr key={row.room_id} style={{ background: rowBg }}>
                    {/* Room */}
                    <td style={{ padding: "12px 14px", borderBottom: i < rows.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                      <span style={{ fontWeight: 600, fontFamily: "var(--font-geist-mono)", fontSize: 13 }}>
                        P.{row.room_number}
                      </span>
                    </td>

                    {/* Tenant */}
                    <td style={{ padding: "12px 14px", borderBottom: i < rows.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                      <div style={{ fontWeight: 500, color: "var(--vn-text)" }}>{row.tenant_name}</div>
                      {row.tenant_phone && <div style={{ fontSize: 12, color: "var(--vn-text-3)" }}>{row.tenant_phone}</div>}
                    </td>

                    {/* Elec prev */}
                    <td style={{ padding: "12px 14px", borderBottom: i < rows.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", fontVariantNumeric: "tabular-nums" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Zap size={12} color="var(--amber-400)" />
                        {row.reading_id ? (
                          // Reading exists — show elec_prev from saved reading
                          <span style={{ color: "var(--vn-text-2)" }}>{fmtNum(row.elec_prev)}</span>
                        ) : row.prev_elec_curr ? (
                          // No reading yet — show prev month's curr as reference
                          <span style={{ color: "var(--vn-text-3)" }} title="Chỉ số tháng trước (sẽ tự điền khi lưu)">
                            {fmtNum(row.prev_elec_curr)}
                            <span style={{ fontSize: 10, marginLeft: 4, color: "var(--vn-text-3)" }}>↑ t.trước</span>
                          </span>
                        ) : (
                          // No prev reading at all — first reading ever
                          <span style={{ fontSize: 11.5, color: "var(--amber-600)", background: "var(--amber-50)", padding: "1px 7px", borderRadius: 999 }}>
                            Phòng mới
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Elec curr input */}
                    <td style={{ padding: "8px 14px", borderBottom: i < rows.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                      {hasInvoice ? (
                        <span style={{ fontWeight: 600, color: "var(--vn-text)", fontVariantNumeric: "tabular-nums" }}>
                          {fmtNum(row.elec_curr)}
                        </span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={inp.elec_curr}
                          onChange={e => setInput(row.room_id, "elec_curr", e.target.value)}
                          placeholder={
                            row.elec_prev ? `> ${fmtNum(row.elec_prev)}`
                            : row.prev_elec_curr ? `> ${fmtNum(row.prev_elec_curr)}`
                            : "Nhập..."
                          }
                          style={{
                            width: 110, height: 32, padding: "0 8px",
                            border: "1px solid var(--vn-border)", borderRadius: 7,
                            fontSize: 13, color: "var(--vn-text)", background: "#fff",
                            outline: "none", fontVariantNumeric: "tabular-nums",
                          }}
                        />
                      )}
                    </td>

                    {/* Water fields (per_meter only) */}
                    {isPerMeter && (
                      <>
                        <td style={{ padding: "12px 14px", borderBottom: i < rows.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", fontVariantNumeric: "tabular-nums" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <Droplets size={12} color="var(--blue-400)" />
                            {row.reading_id ? (
                              <span style={{ color: "var(--vn-text-2)" }}>{fmtNum(row.water_prev)}</span>
                            ) : row.prev_water_curr ? (
                              <span style={{ color: "var(--vn-text-3)" }} title="Chỉ số nước tháng trước">
                                {fmtNum(row.prev_water_curr)}
                                <span style={{ fontSize: 10, marginLeft: 4 }}>↑ t.trước</span>
                              </span>
                            ) : (
                              <span style={{ color: "var(--vn-text-3)" }}>—</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "8px 14px", borderBottom: i < rows.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                          {hasInvoice ? (
                            <span style={{ fontWeight: 600, color: "var(--vn-text)", fontVariantNumeric: "tabular-nums" }}>
                              {fmtNum(row.water_curr)}
                            </span>
                          ) : (
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={inp.water_curr}
                              onChange={e => setInput(row.room_id, "water_curr", e.target.value)}
                              placeholder="Nhập..."
                              style={{
                                width: 90, height: 32, padding: "0 8px",
                                border: "1px solid var(--vn-border)", borderRadius: 7,
                                fontSize: 13, color: "var(--vn-text)", background: "#fff",
                                outline: "none", fontVariantNumeric: "tabular-nums",
                              }}
                            />
                          )}
                        </td>
                      </>
                    )}

                    {/* Invoice status */}
                    <td style={{ padding: "12px 14px", borderBottom: i < rows.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                      {row.invoice_status ? (
                        <div>
                          <StatusBadge status={row.invoice_status} />
                          <div style={{ fontSize: 12, color: "var(--vn-text-3)", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>
                            {fmtMoney(row.invoice_total)}
                          </div>
                        </div>
                      ) : hasReading ? (
                        <span style={{ fontSize: 12, color: "var(--blue-600)" }}>Sẵn sàng tạo HĐ</span>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--vn-text-3)" }}>Chưa nhập chỉ số</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "12px 14px", borderBottom: i < rows.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                      {row.public_token && (
                        <button
                          onClick={() => handleCopyLink(row)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            height: 28, padding: "0 10px", borderRadius: 6,
                            background: copied[row.room_id] ? "var(--green-50)" : "var(--vn-surface)",
                            border: `1px solid ${copied[row.room_id] ? "var(--green-300)" : "var(--vn-border)"}`,
                            color: copied[row.room_id] ? "var(--green-700)" : "var(--vn-text-2)",
                            fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap",
                          }}
                        >
                          {copied[row.room_id] ? <Check size={12} /> : <Copy size={12} />}
                          {copied[row.room_id] ? "Đã copy" : "Copy link"}
                        </button>
                      )}
                      {row.invoice_id && (
                        <button
                          onClick={() => router.push(`/invoices/${row.invoice_id}`)}
                          style={{
                            display: "inline-flex", alignItems: "center",
                            height: 28, padding: "0 10px", borderRadius: 6,
                            background: "transparent", border: "none",
                            color: "var(--blue-600)", fontSize: 12.5, cursor: "pointer",
                            marginLeft: row.public_token ? 6 : 0,
                          }}
                        >
                          Xem →
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Legend */}
          <div style={{
            padding: "10px 16px", borderTop: "1px solid var(--vn-border)",
            background: "var(--slate-50)", display: "flex", gap: 20, fontSize: 12, color: "var(--vn-text-3)",
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "transparent", border: "1px solid var(--vn-border)" }} /> Chưa nhập
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--blue-50)", border: "1px solid var(--blue-200)" }} /> Đã có chỉ số
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--green-50)", border: "1px solid var(--green-200)" }} /> Đã có hóa đơn
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
