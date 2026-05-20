"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, Save, FileText, Copy, Check, AlertTriangle, Zap, Droplets, ChevronRight } from "lucide-react";
import { apiJson } from "@/lib/api";
import type { Property } from "@/types/property";
import type { RoomBillingStatus, InvoicePreviewRow, BatchInvoiceResult } from "@/types/billing";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from "@/types/invoice";
import type { InvoiceStatus } from "@/types/invoice";
import { InvoiceDrawer } from "@/components/app/invoice-drawer";

// ── helpers ───────────────────────────────────────────────────────
function prevPeriod(p: string) {
  const [y, m] = p.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const fmtN = (n: string | null) => n ? Number(n).toLocaleString("vi-VN") : "—";
const fmtM = (n: string | null | number) => n != null ? Number(n).toLocaleString("vi-VN") + "₫" : "—";
const BD = "1px solid var(--vn-border)";

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const c = INVOICE_STATUS_COLORS[status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 20, padding: "0 8px", borderRadius: 999, fontSize: 11, fontWeight: 500, background: c.bg, color: c.fg }}>
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: c.dot }} />
      {INVOICE_STATUS_LABELS[status]}
    </span>
  );
}

const TH = (label: string) => (
  <th key={label} style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "var(--vn-text-3)", letterSpacing: "0.04em", textTransform: "uppercase" as const, background: "var(--slate-50)", borderBottom: BD, whiteSpace: "nowrap" as const }}>
    {label}
  </th>
);

// ── Reading Tab ───────────────────────────────────────────────────
type RowInput = { elec_curr: string; water_curr: string };

function ReadingTab({ propertyId, period, property }: { propertyId: string; period: string; property: Property | null }) {
  const { getToken } = useAuth();
  const [rows, setRows] = useState<RoomBillingStatus[]>([]);
  const [inputs, setInputs] = useState<Record<number, RowInput>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<RoomBillingStatus[]>(`/properties/${propertyId}/billing/status?period=${period}`, getToken);
      setRows(data);
      const init: Record<number, RowInput> = {};
      for (const r of data) init[r.room_id] = { elec_curr: r.elec_curr ?? "", water_curr: r.water_curr ?? "" };
      setInputs(init);
    } catch { setRows([]); }
    finally { setLoading(false); }
  }, [propertyId, period, getToken]);

  useEffect(() => { load(); }, [load]);

  function setInp(room_id: number, field: keyof RowInput, val: string) {
    setInputs(p => ({ ...p, [room_id]: { ...p[room_id], [field]: val } }));
  }

  const isPerMeter = property?.water_calc_type === "per_meter";

  const changed = rows.filter(r => {
    const inp = inputs[r.room_id];
    if (!inp?.elec_curr) return false;
    return Number(r.elec_curr ?? -1) !== Number(inp.elec_curr);
  });

  async function handleSave() {
    setSaving(true); setError(null); setSaved(false);
    try {
      const readings = changed.map(r => {
        const inp = inputs[r.room_id];
        return { room_id: r.room_id, elec_curr: Number(inp.elec_curr), ...(isPerMeter && inp.water_curr ? { water_curr: Number(inp.water_curr) } : {}) };
      });
      const updated = await apiJson<RoomBillingStatus[]>(`/properties/${propertyId}/billing/readings`, getToken, { method: "POST", body: { period, readings } });
      setRows(updated);
      const init: Record<number, RowInput> = {};
      for (const r of updated) init[r.room_id] = { elec_curr: r.elec_curr ?? "", water_curr: r.water_curr ?? "" };
      setInputs(init);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError(e instanceof Error ? e.message : "Lỗi lưu"); }
    finally { setSaving(false); }
  }

  if (loading) return <div style={{ padding: 24, color: "var(--vn-text-3)", fontSize: 13 }}>Đang tải...</div>;

  return (
    <div>
      {/* Info banner */}
      <div style={{ padding: "9px 14px", borderRadius: 9, marginBottom: 14, background: "var(--blue-50)", border: "1px solid var(--blue-100)", fontSize: 12.5, color: "var(--blue-700)", display: "flex", alignItems: "center", gap: 8 }}>
        <Zap size={13} />
        Chỉ số nhập cho tháng <strong>{period}</strong> sẽ dùng để tính điện/nước cho hoá đơn tháng <strong>{period.replace(/(\d{4})-(\d{2})/, (_, y, m) => { const nm = parseInt(m) === 12 ? 1 : parseInt(m)+1; const ny = parseInt(m) === 12 ? parseInt(y)+1 : parseInt(y); return `${ny}-${String(nm).padStart(2,"0")}`; })}</strong>.
      </div>

      {error && <div style={{ padding: "9px 14px", borderRadius: 8, marginBottom: 12, background: "var(--red-50)", border: "1px solid var(--red-200)", fontSize: 13, color: "var(--red-700)" }}>{error}</div>}
      {saved && <div style={{ padding: "9px 14px", borderRadius: 8, marginBottom: 12, background: "var(--green-50)", border: "1px solid var(--green-200)", fontSize: 13, color: "var(--green-700)", display: "flex", alignItems: "center", gap: 6 }}><Check size={14}/>Đã lưu chỉ số thành công.</div>}

      {rows.length === 0 ? (
        <div style={{ padding: "48px 24px", textAlign: "center", background: "var(--vn-surface)", border: BD, borderRadius: 12, color: "var(--vn-text-3)", fontSize: 13.5 }}>Không có phòng nào có hợp đồng trong tháng này.</div>
      ) : (
        <>
          <div style={{ background: "var(--vn-surface)", border: BD, borderRadius: 12, overflow: "hidden", boxShadow: "var(--sh-xs)" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13.5 }}>
              <thead>
                <tr>{[
                  "Phòng", "Khách thuê",
                  `Điện tháng trước (${prevPeriod(period)})`,
                  `Nhập chỉ số điện (${period})`,
                  ...(isPerMeter ? [`Nước tháng trước`, `Nhập chỉ số nước`] : []),
                  "Trạng thái HĐ",
                ].map(TH)}</tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const inp = inputs[row.room_id] ?? { elec_curr: "", water_curr: "" };
                  const bd = i < rows.length - 1 ? BD : "none";
                  const hasInvoice = !!row.invoice_id;
                  const isNew = !row.prev_elec_curr && !row.reading_id;

                  return (
                    <tr key={row.room_id} style={{ background: hasInvoice ? "var(--green-50)" : row.reading_id ? "var(--blue-50)" : "transparent" }}>
                      <td style={{ padding: "11px 14px", borderBottom: bd }}><span style={{ fontWeight: 700, fontFamily: "var(--font-geist-mono)", fontSize: 13 }}>P.{row.room_number}</span></td>
                      <td style={{ padding: "11px 14px", borderBottom: bd }}>
                        <div style={{ fontWeight: 500 }}>{row.tenant_name}</div>
                        {row.tenant_phone && <div style={{ fontSize: 11.5, color: "var(--vn-text-3)" }}>{row.tenant_phone}</div>}
                      </td>
                      {/* Prev elec reference */}
                      <td style={{ padding: "11px 14px", borderBottom: bd, fontVariantNumeric: "tabular-nums" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <Zap size={11} color="var(--amber-400)" />
                          {row.prev_elec_curr
                            ? <span style={{ color: "var(--vn-text-2)" }}>{fmtN(row.prev_elec_curr)}</span>
                            : isNew
                              ? <span style={{ fontSize: 11, background: "var(--amber-50)", color: "var(--amber-700)", padding: "1px 7px", borderRadius: 999 }}>Mới</span>
                              : <span style={{ color: "var(--vn-text-3)" }}>—</span>
                          }
                        </div>
                      </td>
                      {/* Elec input */}
                      <td style={{ padding: "8px 14px", borderBottom: bd }}>
                        {hasInvoice
                          ? <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtN(row.elec_curr)}</span>
                          : <input type="number" min={0} step="0.01" value={inp.elec_curr}
                              onChange={e => setInp(row.room_id, "elec_curr", e.target.value)}
                              placeholder={row.prev_elec_curr ? `> ${fmtN(row.prev_elec_curr)}` : "Nhập..."}
                              style={{ width: 110, height: 32, padding: "0 8px", border: BD, borderRadius: 7, fontSize: 13, background: "#fff", outline: "none", fontVariantNumeric: "tabular-nums" }} />
                        }
                      </td>
                      {isPerMeter && (
                        <>
                          <td style={{ padding: "11px 14px", borderBottom: bd, fontVariantNumeric: "tabular-nums" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <Droplets size={11} color="var(--blue-400)" />
                              {row.prev_water_curr ? <span style={{ color: "var(--vn-text-2)" }}>{fmtN(row.prev_water_curr)}</span> : <span style={{ color: "var(--vn-text-3)" }}>—</span>}
                            </div>
                          </td>
                          <td style={{ padding: "8px 14px", borderBottom: bd }}>
                            {hasInvoice
                              ? <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtN(row.water_curr)}</span>
                              : <input type="number" min={0} step="0.01" value={inp.water_curr}
                                  onChange={e => setInp(row.room_id, "water_curr", e.target.value)}
                                  placeholder="Nhập..."
                                  style={{ width: 90, height: 32, padding: "0 8px", border: BD, borderRadius: 7, fontSize: 13, background: "#fff", outline: "none", fontVariantNumeric: "tabular-nums" }} />
                            }
                          </td>
                        </>
                      )}
                      <td style={{ padding: "11px 14px", borderBottom: bd }}>
                        {row.invoice_status ? <StatusBadge status={row.invoice_status} /> : row.reading_id ? <span style={{ fontSize: 11.5, color: "var(--blue-600)" }}>Có chỉ số</span> : <span style={{ fontSize: 11.5, color: "var(--vn-text-3)" }}>Chưa nhập</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={handleSave} disabled={saving || changed.length === 0} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 36, padding: "0 18px", borderRadius: 8,
              background: changed.length > 0 ? "var(--blue-600)" : "var(--slate-100)",
              color: changed.length > 0 ? "#fff" : "var(--vn-text-3)",
              fontSize: 13.5, fontWeight: 500, border: "none", cursor: changed.length > 0 ? "pointer" : "default",
              opacity: saving ? 0.7 : 1,
            }}>
              <Save size={14} />{saving ? "Đang lưu…" : `Lưu chỉ số${changed.length > 0 ? ` (${changed.length} phòng)` : ""}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Invoice Tab ───────────────────────────────────────────────────
function InvoiceTab({ propertyId, period, property }: { propertyId: string; period: string; property: Property | null }) {
  const { getToken } = useAuth();
  const [rows, setRows] = useState<InvoicePreviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<BatchInvoiceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawerInvoiceId, setDrawerInvoiceId] = useState<number | null>(null);
  const [copied, setCopied] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<InvoicePreviewRow[]>(`/properties/${propertyId}/billing/invoice-preview?period=${period}`, getToken);
      setRows(data);
      // Auto-select all eligible (no invoice yet)
      setSelected(new Set(data.filter(r => !r.invoice_id).map(r => r.contract_id)));
    } catch { setRows([]); }
    finally { setLoading(false); }
  }, [propertyId, period, getToken]);

  useEffect(() => { load(); }, [load]);

  const eligible = useMemo(() => rows.filter(r => !r.invoice_id), [rows]);
  const allSelected = eligible.length > 0 && eligible.every(r => selected.has(r.contract_id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(eligible.map(r => r.contract_id)));
  }
  function toggleRow(contract_id: number, has_invoice: boolean) {
    if (has_invoice) return;
    setSelected(prev => { const s = new Set(prev); s.has(contract_id) ? s.delete(contract_id) : s.add(contract_id); return s; });
  }

  const selectedRows = rows.filter(r => selected.has(r.contract_id));
  const selectedTotal = selectedRows.reduce((s, r) => s + Number(r.total), 0);

  async function handleGenerate() {
    if (selected.size === 0) return;
    setGenerating(true); setResult(null); setError(null);
    try {
      const res = await apiJson<BatchInvoiceResult>(`/properties/${propertyId}/billing/invoices`, getToken, {
        method: "POST", body: { period, contract_ids: Array.from(selected) },
      });
      setResult(res);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Lỗi tạo hoá đơn"); }
    finally { setGenerating(false); }
  }

  function handleCopy(row: InvoicePreviewRow) {
    const url = `${window.location.origin}/invoice/public/${row.invoice_public_token}`;
    navigator.clipboard.writeText(url);
    setCopied(prev => ({ ...prev, [row.contract_id]: true }));
    setTimeout(() => setCopied(prev => ({ ...prev, [row.contract_id]: false })), 2000);
  }

  if (loading) return <div style={{ padding: 24, color: "var(--vn-text-3)", fontSize: 13 }}>Đang tải...</div>;

  return (
    <div>
      {/* Info banner */}
      <div style={{ padding: "9px 14px", borderRadius: 9, marginBottom: 14, background: "var(--blue-50)", border: "1px solid var(--blue-100)", fontSize: 12.5, color: "var(--blue-700)", display: "flex", alignItems: "center", gap: 8 }}>
        <FileText size={13} />
        Hoá đơn tháng <strong>{period}</strong> · Điện/nước tính từ chỉ số tháng <strong>{prevPeriod(period)}</strong>
      </div>

      {error && <div style={{ padding: "9px 14px", borderRadius: 8, marginBottom: 12, background: "var(--red-50)", border: "1px solid var(--red-200)", fontSize: 13, color: "var(--red-700)" }}>{error}</div>}
      {result && (
        <div style={{ padding: "9px 14px", borderRadius: 8, marginBottom: 12, background: result.errors.length ? "var(--amber-50)" : "var(--green-50)", border: `1px solid ${result.errors.length ? "var(--amber-200)" : "var(--green-200)"}`, fontSize: 13, color: result.errors.length ? "var(--amber-700)" : "var(--green-700)" }}>
          Đã tạo <strong>{result.created}</strong> hoá đơn · Bỏ qua <strong>{result.skipped}</strong> (đã có)
          {result.errors.length > 0 && <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        </div>
      )}

      {rows.length === 0 ? (
        <div style={{ padding: "48px 24px", textAlign: "center", background: "var(--vn-surface)", border: BD, borderRadius: 12, color: "var(--vn-text-3)", fontSize: 13.5 }}>Không có phòng nào có hợp đồng trong tháng này.</div>
      ) : (
        <>
          <div style={{ background: "var(--vn-surface)", border: BD, borderRadius: 12, overflow: "hidden", boxShadow: "var(--sh-xs)" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ padding: "10px 14px", background: "var(--slate-50)", borderBottom: BD, width: 32 }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} title="Chọn tất cả" style={{ cursor: "pointer" }} />
                  </th>
                  {["Phòng / Khách", "Tiền nhà", "Điện", "Nước", "Phụ phí", "Tổng", "Trạng thái", ""].map(TH)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const bd = i < rows.length - 1 ? BD : "none";
                  const hasInvoice = !!row.invoice_id;
                  const isChecked = selected.has(row.contract_id);
                  const isLocked = hasInvoice && (row.invoice_status === "sent" || row.invoice_status === "paid");

                  let rowBg = "transparent";
                  if (isLocked) rowBg = "var(--slate-50)";
                  else if (hasInvoice) rowBg = "var(--green-50)";
                  else if (isChecked) rowBg = "var(--blue-50)";

                  return (
                    <tr key={row.contract_id} style={{ background: rowBg, opacity: isLocked ? 0.75 : 1, cursor: isLocked ? "default" : "pointer" }}
                      onClick={() => !isLocked && toggleRow(row.contract_id, hasInvoice)}>
                      {/* Checkbox */}
                      <td style={{ padding: "11px 14px", borderBottom: bd, verticalAlign: "middle" }}>
                        <input type="checkbox" checked={isChecked && !hasInvoice} disabled={hasInvoice} onChange={() => toggleRow(row.contract_id, hasInvoice)} onClick={e => e.stopPropagation()} style={{ cursor: hasInvoice ? "default" : "pointer" }} />
                      </td>
                      {/* Room + Tenant */}
                      <td style={{ padding: "11px 14px", borderBottom: bd, verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 700, fontFamily: "var(--font-geist-mono)", fontSize: 12.5, color: "var(--vn-text)" }}>P.{row.room_number}</span>
                          <span style={{ color: "var(--vn-text-2)", fontSize: 12.5 }}>{row.tenant_name}</span>
                        </div>
                        {row.is_prorated && <div style={{ fontSize: 11, color: "var(--amber-600)", marginTop: 2 }}>Tháng đầu · {row.prorate_label}</div>}
                      </td>
                      {/* Rent */}
                      <td style={{ padding: "11px 14px", borderBottom: bd, verticalAlign: "middle", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
                        {fmtM(row.rent_amount)}
                      </td>
                      {/* Electricity */}
                      <td style={{ padding: "11px 14px", borderBottom: bd, verticalAlign: "middle", fontVariantNumeric: "tabular-nums" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {!row.has_reading && Number(row.elec_amount) === 0 && (
                            <AlertTriangle size={12} color="var(--amber-500)" />
                          )}
                          <span style={{ color: !row.has_reading ? "var(--vn-text-3)" : "var(--vn-text)" }}>
                            {fmtM(row.elec_amount)}
                          </span>
                        </div>
                      </td>
                      {/* Water */}
                      <td style={{ padding: "11px 14px", borderBottom: bd, verticalAlign: "middle", fontVariantNumeric: "tabular-nums", color: "var(--vn-text-2)" }}>
                        {fmtM(row.water_amount)}
                      </td>
                      {/* Surcharges */}
                      <td style={{ padding: "11px 14px", borderBottom: bd, verticalAlign: "middle", fontVariantNumeric: "tabular-nums", color: "var(--vn-text-2)" }}>
                        {Number(row.surcharge_total) > 0 ? (
                          <div>
                            <div>{fmtM(row.surcharge_total)}</div>
                            {row.surcharges.map(s => (
                              <div key={s.name} style={{ fontSize: 11, color: "var(--vn-text-3)" }}>{s.name}: {fmtM(s.amount)}</div>
                            ))}
                          </div>
                        ) : <span style={{ color: "var(--vn-text-3)" }}>—</span>}
                      </td>
                      {/* Total */}
                      <td style={{ padding: "11px 14px", borderBottom: bd, verticalAlign: "middle", fontWeight: 700, fontVariantNumeric: "tabular-nums", fontSize: 14, color: "var(--blue-700)" }}>
                        {fmtM(row.total)}
                      </td>
                      {/* Status */}
                      <td style={{ padding: "11px 14px", borderBottom: bd, verticalAlign: "middle" }}>
                        {row.invoice_status
                          ? <StatusBadge status={row.invoice_status} />
                          : <span style={{ fontSize: 11, color: "var(--vn-text-3)", background: "var(--slate-100)", padding: "2px 8px", borderRadius: 999 }}>Chưa có HĐ</span>}
                      </td>
                      {/* Actions */}
                      <td style={{ padding: "11px 14px", borderBottom: bd, verticalAlign: "middle" }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 5 }}>
                          {row.invoice_public_token && (
                            <button onClick={() => handleCopy(row)} style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 26, padding: "0 8px", borderRadius: 6, border: BD, background: copied[row.contract_id] ? "var(--green-50)" : "var(--vn-surface)", color: copied[row.contract_id] ? "var(--green-700)" : "var(--vn-text-3)", fontSize: 11.5, cursor: "pointer" }}>
                              {copied[row.contract_id] ? <Check size={11}/> : <Copy size={11}/>}
                            </button>
                          )}
                          {row.invoice_id && (
                            <button onClick={() => setDrawerInvoiceId(row.invoice_id!)} style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 26, padding: "0 8px", borderRadius: 6, border: BD, background: "var(--vn-surface)", color: "var(--blue-600)", fontSize: 11.5, cursor: "pointer", fontWeight: 500 }}>
                              Xem <ChevronRight size={11}/>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, padding: "12px 16px", background: "var(--vn-surface)", border: BD, borderRadius: 10 }}>
            <div style={{ fontSize: 13, color: "var(--vn-text-2)" }}>
              {selected.size > 0
                ? <><strong style={{ color: "var(--vn-text)" }}>{selected.size} phòng</strong> được chọn · Tổng dự kiến: <strong style={{ color: "var(--blue-700)" }}>{fmtM(selectedTotal)}</strong></>
                : <span style={{ color: "var(--vn-text-3)" }}>Chọn phòng để tạo hoá đơn</span>
              }
            </div>
            <button onClick={handleGenerate} disabled={generating || selected.size === 0} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 36, padding: "0 18px", borderRadius: 8,
              background: selected.size > 0 ? "var(--blue-600)" : "var(--slate-100)",
              color: selected.size > 0 ? "#fff" : "var(--vn-text-3)",
              fontSize: 13.5, fontWeight: 600, border: "none", cursor: selected.size > 0 ? "pointer" : "default",
              opacity: generating ? 0.7 : 1,
            }}>
              <FileText size={14}/>{generating ? "Đang tạo…" : `Tạo hoá đơn${selected.size > 0 ? ` (${selected.size})` : ""}`}
            </button>
          </div>
        </>
      )}

      <InvoiceDrawer
        invoiceId={drawerInvoiceId}
        onClose={() => setDrawerInvoiceId(null)}
        onUpdate={updated => setRows(prev => prev.map(r => r.invoice_id === updated.id ? { ...r, invoice_status: updated.status as InvoiceStatus } : r))}
      />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
type BillingTab = "readings" | "invoices";

export default function BillingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();
  const [property, setProperty] = useState<Property | null>(null);
  const [period, setPeriod] = useState(currentPeriod());
  const [tab, setTab] = useState<BillingTab>("readings");

  useEffect(() => {
    apiJson<Property>(`/properties/${id}`, getToken).then(setProperty).catch(() => {});
  }, [id, getToken]);

  const TABS: { key: BillingTab; label: string }[] = [
    { key: "readings", label: "Nhập chỉ số công tơ" },
    { key: "invoices", label: "Tạo hoá đơn" },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <button onClick={() => router.push(`/properties/${id}`)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--vn-text-3)", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 10 }}>
        <ArrowLeft size={14}/> {property?.name ?? "Nhà trọ"}
      </button>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--vn-text)", margin: 0 }}>Tính tiền</h1>
          <p style={{ fontSize: 13, color: "var(--vn-text-3)", marginTop: 2 }}>{property?.name}</p>
        </div>
        <input type="month" value={period} onChange={e => setPeriod(e.target.value)} style={{ height: 36, padding: "0 12px", borderRadius: 8, border: BD, background: "var(--vn-surface)", fontSize: 13.5, color: "var(--vn-text)", outline: "none", fontFamily: "var(--font-geist-mono)" }} />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: BD, marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ height: 38, padding: "0 18px", border: "none", background: "none", cursor: "pointer", fontSize: 13.5, fontWeight: tab === t.key ? 600 : 400, color: tab === t.key ? "var(--blue-600)" : "var(--vn-text-2)", borderBottom: tab === t.key ? "2px solid var(--blue-600)" : "2px solid transparent", marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "readings" && <ReadingTab propertyId={id} period={period} property={property} />}
      {tab === "invoices" && <InvoiceTab propertyId={id} period={period} property={property} />}
    </div>
  );
}
