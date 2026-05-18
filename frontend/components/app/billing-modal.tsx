"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { X, Save, FileText, Copy, Check, AlertTriangle, Zap, Droplets, ChevronRight, ChevronLeft, ChevronDown, Share2 } from "lucide-react";
import { InvoiceDrawer } from "@/components/app/invoice-drawer";
import { apiJson } from "@/lib/api";
import type { Property } from "@/types/property";
import type { SharedMeter, SharedMeterReading } from "@/types/shared-meter";
import type { RoomBillingStatus, InvoicePreviewRow, BatchInvoiceResult } from "@/types/billing";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from "@/types/invoice";
import type { InvoiceStatus, Invoice } from "@/types/invoice";

// ── helpers ───────────────────────────────────────────────────────
function prevPeriod(p: string) {
  const [y, m] = p.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
function nextPeriod(p: string) {
  const [y, m] = p.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
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
  <th key={label} style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "var(--vn-text-3)", letterSpacing: "0.04em", textTransform: "uppercase" as const, background: "var(--slate-50)", borderBottom: BD, whiteSpace: "nowrap" as const }}>
    {label}
  </th>
);

// ── Reading Tab ───────────────────────────────────────────────────
type RowInput = { elec_curr: string; water_curr: string };

function fmtConsumption(curr: string, prev: string | null | undefined): { value: number | null; label: string } {
  if (!prev || !curr) return { value: null, label: "—" };
  const v = Number(curr) - Number(prev);
  if (isNaN(v)) return { value: null, label: "—" };
  return { value: v, label: v.toLocaleString("vi-VN") };
}

function ReadingTab({ propertyId, period, property }: { propertyId: string; period: string; property: Property | null }) {
  const { getToken } = useAuth();
  const [rows, setRows] = useState<RoomBillingStatus[]>([]);
  const [inputs, setInputs] = useState<Record<number, RowInput>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const isPerMeter = property?.water_calc_type === "per_meter";

  // Cách B: display period = reading month, apiPeriod = invoice month (next)
  const apiPeriod = nextPeriod(period);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<RoomBillingStatus[]>(`/properties/${propertyId}/billing/status?period=${apiPeriod}`, getToken);
      setRows(data);
      const init: Record<number, RowInput> = {};
      for (const r of data) {
        const isInitial = r.reading_id !== null && r.elec_prev === null;
        init[r.room_id] = {
          elec_curr:  isInitial ? "" : (r.elec_curr  ?? ""),
          water_curr: isInitial ? "" : (r.water_curr ?? ""),
        };
      }
      setInputs(init);
    } catch { setRows([]); }
    finally { setLoading(false); }
  }, [propertyId, apiPeriod, getToken]);

  useEffect(() => { load(); }, [load]);

  function setInp(room_id: number, field: keyof RowInput, val: string) {
    setInputs(p => ({ ...p, [room_id]: { ...p[room_id], [field]: val } }));
  }

  const changed = rows.filter(r => {
    if (r.next_reading_locked) return false;
    const inp = inputs[r.room_id];
    if (!inp?.elec_curr) return false;
    return Number(r.elec_curr ?? -1) !== Number(inp.elec_curr);
  });

  // Progress: rows that already have a saved reading
  const savedCount  = rows.filter(r => r.reading_id).length;
  const totalCount  = rows.length;
  const progressPct = totalCount > 0 ? Math.round((savedCount / totalCount) * 100) : 0;

  async function handleSave() {
    if (changed.length === 0) return;
    setSaving(true); setError(null); setSaved(false);
    try {
      const readings = changed.map(r => {
        const inp = inputs[r.room_id];
        return { room_id: r.room_id, elec_curr: Number(inp.elec_curr), ...(isPerMeter && inp.water_curr ? { water_curr: Number(inp.water_curr) } : {}) };
      });
      const updated = await apiJson<RoomBillingStatus[]>(`/properties/${propertyId}/billing/readings`, getToken, { method: "POST", body: { period: apiPeriod, readings } });
      setRows(updated);
      const init: Record<number, RowInput> = {};
      for (const r of updated) init[r.room_id] = { elec_curr: r.elec_curr ?? "", water_curr: r.water_curr ?? "" };
      setInputs(init);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError(e instanceof Error ? e.message : "Lỗi lưu"); }
    finally { setSaving(false); }
  }

  if (loading) return <div style={{ padding: "32px 0", textAlign: "center", color: "var(--vn-text-3)", fontSize: 13 }}>Đang tải...</div>;

  // Column headers — no month label (Cách B: period = reading month, clear without ambiguity)
  const COL_ELEC = isPerMeter
    ? ["Phòng", "Khách thuê", "⚡ Chỉ số đầu", "⚡ Chỉ số cuối", "⚡ Tiêu thụ", "💧 Chỉ số đầu", "💧 Chỉ số cuối", "💧 Tiêu thụ", "Trạng thái"]
    : ["Phòng", "Khách thuê", "⚡ Chỉ số đầu", "⚡ Chỉ số cuối", "⚡ Tiêu thụ", "Trạng thái"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Progress toolbar */}
      {rows.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 14px", background: "var(--slate-50)", border: BD, borderRadius: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--vn-text-2)" }}>Tiến độ nhập liệu</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: progressPct === 100 ? "var(--green-600)" : "var(--blue-600)", fontVariantNumeric: "tabular-nums" }}>
                {savedCount}/{totalCount} phòng đã nhập ({progressPct}%)
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: "var(--slate-200)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 99,
                width: `${progressPct}%`,
                background: progressPct === 100 ? "var(--green-600)" : "var(--blue-600)",
                transition: "width .3s ease",
              }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, fontSize: 12, color: "var(--vn-text-3)", flexShrink: 0 }}>
            <span style={{ color: "var(--green-600)", fontWeight: 500 }}>{savedCount} đã nhập</span>
            <span>·</span>
            <span>{totalCount - savedCount} còn lại</span>
          </div>
        </div>
      )}

      {error && <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--red-50)", border: "1px solid var(--red-200)", fontSize: 13, color: "var(--red-700)" }}>{error}</div>}
      {saved && <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--green-50)", border: "1px solid var(--green-200)", fontSize: 13, color: "var(--green-700)", display: "flex", alignItems: "center", gap: 6 }}><Check size={13}/>Đã lưu thành công.</div>}

      {rows.length === 0
        ? <div style={{ padding: "40px 24px", textAlign: "center", background: "var(--vn-surface)", border: BD, borderRadius: 10, color: "var(--vn-text-3)", fontSize: 13 }}>Không có phòng nào có hợp đồng trong tháng này.</div>
        : (
          <>
            <div style={{ background: "var(--vn-surface)", border: BD, borderRadius: 10, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13 }}>
                <thead>
                  <tr>{COL_ELEC.map(TH)}</tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const inp = inputs[row.room_id] ?? { elec_curr: "", water_curr: "" };
                    const bd = i < rows.length - 1 ? BD : "none";
                    const hasInvoice = !!row.invoice_id;
                    const hasSaved   = !!row.reading_id;
                    // isInitialReading: move-in baseline — elec_prev=null means prev not yet known.
                    // User must enter end-of-month reading; backend shifts prev←curr, curr←new.
                    const isInitialReading = row.reading_id !== null && row.elec_prev === null;
                    // next_reading_locked: next period already has a reading → editing this period
                    // would corrupt next period's auto-filled prev_reading and any derived invoices.
                    const isLocked = row.next_reading_locked;

                    // "Đầu kỳ": prefer saved elec_prev, then prev period's curr, then move-in curr
                    const elecStart  = isInitialReading ? row.elec_curr  : (row.elec_prev  ?? row.prev_elec_curr);
                    const waterStart = isInitialReading ? row.water_curr : (row.water_prev ?? row.prev_water_curr);

                    // Live consumption — works for both normal and initial readings
                    const elecCurr  = hasInvoice ? (row.elec_curr  ?? "") : inp.elec_curr;
                    const waterCurr = hasInvoice ? (row.water_curr ?? "") : inp.water_curr;
                    const elecUsage  = fmtConsumption(elecCurr,  elecStart);
                    const waterUsage = isPerMeter ? fmtConsumption(waterCurr, waterStart) : null;

                    const rowBg = isLocked ? "var(--slate-50)" : hasInvoice ? "var(--green-50)" : hasSaved ? "var(--blue-50)" : "transparent";

                    return (
                      <tr key={row.room_id} style={{ background: rowBg }}>
                        {/* Phòng */}
                        <td style={{ padding: "10px 12px", borderBottom: bd, whiteSpace: "nowrap" }}>
                          <span style={{ fontWeight: 700, fontFamily: "var(--font-geist-mono)", fontSize: 13 }}>P.{row.room_number}</span>
                        </td>

                        {/* Khách thuê */}
                        <td style={{ padding: "10px 12px", borderBottom: bd }}>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{row.tenant_name}</div>
                          {row.tenant_phone && <div style={{ fontSize: 11, color: "var(--vn-text-3)" }}>{row.tenant_phone}</div>}
                        </td>

                        {/* ⚡ Đầu kỳ */}
                        <td style={{ padding: "10px 12px", borderBottom: bd, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                          {elecStart
                            ? <div>
                                <span style={{ color: "var(--vn-text-2)", fontWeight: 500 }}>{fmtN(elecStart)}</span>
                                {isInitialReading && (
                                  <div style={{ fontSize: 10, color: "var(--amber-600)", marginTop: 1 }}>Lúc vào</div>
                                )}
                              </div>
                            : <span style={{ color: "var(--vn-text-3)" }}>—</span>}
                        </td>

                        {/* ⚡ Cuối kỳ */}
                        <td style={{ padding: "7px 12px", borderBottom: bd }}>
                          {hasInvoice ? (
                            <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtN(row.elec_curr)}</span>
                          ) : isLocked ? (
                            <div>
                              <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--vn-text-2)" }}>{fmtN(row.elec_curr)}</span>
                              <div style={{ fontSize: 10, color: "var(--slate-400)", marginTop: 1 }}>Đã khoá (T sau đã nhập)</div>
                            </div>
                          ) : (
                            <div>
                              <input
                                type="number" min={0} step="0.01" value={inp.elec_curr}
                                onChange={e => setInp(row.room_id, "elec_curr", e.target.value)}
                                placeholder={elecStart ? `> ${fmtN(elecStart)}` : "Nhập..."}
                                style={{ width: 110, height: 32, padding: "0 9px", border: `1.5px solid ${inp.elec_curr ? "var(--blue-400)" : isInitialReading ? "var(--amber-300)" : "var(--vn-border)"}`, borderRadius: 7, fontSize: 13, background: "#fff", outline: "none", fontVariantNumeric: "tabular-nums", transition: "border-color .12s" }}
                              />
                              {isInitialReading && !inp.elec_curr && (
                                <div style={{ fontSize: 10, color: "var(--amber-600)", marginTop: 2 }}>Nhập chỉ số cuối T1</div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* ⚡ Tiêu thụ */}
                        <td style={{ padding: "10px 12px", borderBottom: bd, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                          {elecUsage.value !== null ? (
                            <span style={{ fontWeight: 600, color: elecUsage.value > 0 ? "var(--amber-700)" : "var(--vn-text-3)" }}>
                              {elecUsage.label} kWh
                            </span>
                          ) : (
                            <span style={{ color: "var(--vn-text-3)" }}>—</span>
                          )}
                        </td>

                        {/* Water columns */}
                        {isPerMeter && (
                          <>
                            {/* 💧 Đầu kỳ */}
                            <td style={{ padding: "10px 12px", borderBottom: bd, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                              {waterStart
                                ? <div>
                                    <span style={{ color: "var(--vn-text-2)", fontWeight: 500 }}>{fmtN(waterStart)}</span>
                                    {isInitialReading && (
                                      <div style={{ fontSize: 10, color: "var(--blue-600)", marginTop: 1 }}>Lúc vào</div>
                                    )}
                                  </div>
                                : <span style={{ color: "var(--vn-text-3)" }}>—</span>}
                            </td>

                            {/* 💧 Cuối kỳ */}
                            <td style={{ padding: "7px 12px", borderBottom: bd }}>
                              {hasInvoice ? (
                                <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtN(row.water_curr)}</span>
                              ) : isLocked ? (
                                <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--vn-text-2)" }}>{fmtN(row.water_curr)}</span>
                              ) : (
                                <div>
                                  <input
                                    type="number" min={0} step="0.01" value={inp.water_curr}
                                    onChange={e => setInp(row.room_id, "water_curr", e.target.value)}
                                    placeholder={waterStart ? `> ${fmtN(waterStart)}` : "Nhập..."}
                                    style={{ width: 90, height: 32, padding: "0 9px", border: `1.5px solid ${inp.water_curr ? "var(--blue-400)" : isInitialReading ? "var(--amber-300)" : "var(--vn-border)"}`, borderRadius: 7, fontSize: 13, background: "#fff", outline: "none", fontVariantNumeric: "tabular-nums", transition: "border-color .12s" }}
                                  />
                                  {isInitialReading && !inp.water_curr && (
                                    <div style={{ fontSize: 10, color: "var(--amber-600)", marginTop: 2 }}>Nhập chỉ số cuối T1</div>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* 💧 Tiêu thụ */}
                            <td style={{ padding: "10px 12px", borderBottom: bd, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                              {waterUsage && waterUsage.value !== null ? (
                                <span style={{ fontWeight: 600, color: waterUsage.value > 0 ? "var(--blue-600)" : "var(--vn-text-3)" }}>
                                  {waterUsage.label} m³
                                </span>
                              ) : (
                                <span style={{ color: "var(--vn-text-3)" }}>—</span>
                              )}
                            </td>
                          </>
                        )}

                        {/* Trạng thái */}
                        <td style={{ padding: "10px 12px", borderBottom: bd, whiteSpace: "nowrap" }}>
                          {row.invoice_status ? (
                            <StatusBadge status={row.invoice_status} />
                          ) : hasSaved ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: "var(--green-700)", background: "var(--green-50)", border: "1px solid var(--green-200)", padding: "2px 8px", borderRadius: 999 }}>
                              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green-600)" }} />
                              Đã nhập
                            </span>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--vn-text-3)", background: "var(--slate-100)", border: BD, padding: "2px 8px", borderRadius: 999 }}>
                              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--slate-300)" }} />
                              Chưa nhập
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12.5, color: "var(--vn-text-3)" }}>
                {changed.length > 0 && `${changed.length} phòng có thay đổi chưa lưu`}
              </span>
              <button
                onClick={handleSave}
                disabled={saving || changed.length === 0}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 18px", borderRadius: 8, background: changed.length > 0 ? "var(--blue-600)" : "var(--slate-100)", color: changed.length > 0 ? "#fff" : "var(--vn-text-3)", fontSize: 13, fontWeight: 600, border: "none", cursor: changed.length > 0 ? "pointer" : "default", opacity: saving ? 0.7 : 1 }}
              >
                <Save size={13} />{saving ? "Đang lưu…" : `Lưu chỉ số${changed.length > 0 ? ` (${changed.length})` : ""}`}
              </button>
            </div>
          </>
        )
      }

      <SharedMeterReadingSection propertyId={propertyId} period={apiPeriod} />
    </div>
  );
}

// ── Shared Meter Reading Section ──────────────────────────────────
function SharedMeterReadingSection({ propertyId, period }: { propertyId: string; period: string }) {
  const { getToken } = useAuth();
  const [meters, setMeters] = useState<SharedMeter[]>([]);
  // current period reading (null = not yet saved)
  const [readings, setReadings] = useState<Record<number, SharedMeterReading | null>>({});
  // prev period reading — used to autofill "Chỉ số đầu" display
  const [prevReadings, setPrevReadings] = useState<Record<number, SharedMeterReading | null>>({});
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});

  const prevP = prevPeriod(period);

  useEffect(() => {
    apiJson<SharedMeter[]>(`/properties/${propertyId}/shared-meters`, getToken)
      .then(async ms => {
        setMeters(ms);
        const rdMap: Record<number, SharedMeterReading | null> = {};
        const prevMap: Record<number, SharedMeterReading | null> = {};
        const inpMap: Record<number, string> = {};
        for (const m of ms) {
          const rds = await apiJson<SharedMeterReading[]>(`/shared-meters/${m.id}/readings`, getToken).catch(() => []);
          const cur  = rds.find(r => r.period === period) ?? null;
          const prev = rds.find(r => r.period === prevP)  ?? null;
          rdMap[m.id]   = cur;
          prevMap[m.id] = prev;
          inpMap[m.id]  = cur ? String(cur.curr_reading) : "";
        }
        setReadings(rdMap);
        setPrevReadings(prevMap);
        setInputs(inpMap);
      }).catch(() => {});
  }, [propertyId, period, prevP, getToken]);

  if (meters.length === 0) return null;

  async function saveMeterReading(meter: SharedMeter) {
    const val = inputs[meter.id];
    if (!val) return;
    setSaving(p => ({ ...p, [meter.id]: true }));
    setErrors(p => ({ ...p, [meter.id]: "" }));
    try {
      const rd = await apiJson<SharedMeterReading>("/shared-meter-readings", getToken, {
        method: "POST",
        body: { shared_meter_id: meter.id, period, curr_reading: Number(val) },
      });
      setReadings(p => ({ ...p, [meter.id]: rd }));
      // After save, prev_reading is now canonical from response
    } catch (e) {
      setErrors(p => ({ ...p, [meter.id]: e instanceof Error ? e.message : "Lỗi" }));
    } finally {
      setSaving(p => ({ ...p, [meter.id]: false }));
    }
  }

  const [py, pm] = period.split("-");

  return (
    <div style={{ background: "var(--vn-surface)", border: BD, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "9px 12px", background: "var(--slate-50)", borderBottom: BD, display: "flex", alignItems: "center", gap: 6 }}>
        <Share2 size={12} color="var(--amber-500)" />
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--vn-text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Công tơ điện chung
        </span>
      </div>
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13 }}>
        <thead>
          <tr>{["Tên công tơ", "⚡ Chỉ số đầu", `⚡ Chỉ số cuối (T${Number(pm)}/${py})`, "⚡ Tiêu thụ", ""].map(h => (
            <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontSize: 11, fontWeight: 600, color: "var(--vn-text-3)", letterSpacing: "0.04em", textTransform: "uppercase" as const, background: "var(--slate-50)", borderBottom: BD }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {meters.map((meter, i) => {
            const rd   = readings[meter.id];
            const prev = prevReadings[meter.id];
            const bd   = i < meters.length - 1 ? BD : "none";

            // "Chỉ số đầu": from saved reading's prev_reading, or fallback to prev period's curr_reading
            const startVal = rd?.prev_reading ?? prev?.curr_reading ?? null;
            const currVal  = rd ? rd.curr_reading : null;
            const usage    = startVal != null && currVal != null ? Number(currVal) - Number(startVal) : null;

            const inputVal = inputs[meter.id] ?? "";
            const liveUsage = startVal != null && inputVal
              ? Number(inputVal) - Number(startVal)
              : null;

            return (
              <tr key={meter.id} style={{ background: rd ? "var(--green-50)" : "transparent" }}>
                <td style={{ padding: "9px 12px", borderBottom: bd, fontWeight: 500 }}>{meter.name}</td>

                {/* Chỉ số đầu */}
                <td style={{ padding: "9px 12px", borderBottom: bd, fontVariantNumeric: "tabular-nums" }}>
                  {startVal != null
                    ? <div>
                        <span style={{ color: "var(--vn-text-2)", fontWeight: 500 }}>{Number(startVal).toLocaleString("vi-VN")}</span>
                        {rd == null && prev != null && (
                          <div style={{ fontSize: 10, color: "var(--vn-text-3)", marginTop: 1 }}>Kỳ {prevP}</div>
                        )}
                      </div>
                    : <span style={{ color: "var(--vn-text-3)" }}>—</span>}
                </td>

                {/* Chỉ số cuối */}
                <td style={{ padding: "7px 12px", borderBottom: bd }}>
                  <input
                    type="number" min={0} step="0.01"
                    value={inputVal}
                    onChange={e => setInputs(p => ({ ...p, [meter.id]: e.target.value }))}
                    placeholder={startVal != null ? `> ${Number(startVal).toLocaleString("vi-VN")}` : "Nhập chỉ số..."}
                    style={{
                      width: 120, height: 30, padding: "0 8px",
                      border: `1.5px solid ${inputVal ? (rd ? "var(--green-400)" : "var(--blue-400)") : "var(--vn-border)"}`,
                      borderRadius: 6, fontSize: 13, background: "#fff", outline: "none",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  />
                  {errors[meter.id] && <div style={{ fontSize: 11, color: "var(--red-600)", marginTop: 2 }}>{errors[meter.id]}</div>}
                </td>

                {/* Tiêu thụ */}
                <td style={{ padding: "9px 12px", borderBottom: bd, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                  {(usage != null || liveUsage != null) ? (
                    <span style={{ fontWeight: 600, color: "var(--amber-700)" }}>
                      {(usage ?? liveUsage)!.toLocaleString("vi-VN")} kWh
                    </span>
                  ) : <span style={{ color: "var(--vn-text-3)" }}>—</span>}
                </td>

                {/* Action */}
                <td style={{ padding: "7px 12px", borderBottom: bd }}>
                  <button
                    onClick={() => saveMeterReading(meter)}
                    disabled={saving[meter.id] || !inputVal}
                    style={{
                      height: 28, padding: "0 12px", borderRadius: 6,
                      background: inputVal ? (rd ? "var(--green-600)" : "var(--blue-600)") : "var(--slate-100)",
                      color: inputVal ? "#fff" : "var(--vn-text-3)",
                      border: "none", cursor: inputVal ? "pointer" : "default",
                      fontSize: 12, fontWeight: 500,
                    }}
                  >
                    {saving[meter.id] ? "…" : rd ? "Cập nhật" : "Lưu"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Invoice Tab ───────────────────────────────────────────────────
function InvoiceTab({ propertyId, period, onViewInvoice }: { propertyId: string; period: string; onViewInvoice: (id: number) => void }) {
  const { getToken } = useAuth();
  const [rows, setRows] = useState<InvoicePreviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<BatchInvoiceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<InvoicePreviewRow[]>(`/properties/${propertyId}/billing/invoice-preview?period=${period}`, getToken);
      setRows(data);
      setSelected(new Set(data.filter(r => !r.invoice_id).map(r => r.contract_id)));
    } catch { setRows([]); }
    finally { setLoading(false); }
  }, [propertyId, period, getToken]);

  useEffect(() => { load(); }, [load]);

  const eligible = useMemo(() => rows.filter(r => !r.invoice_id), [rows]);
  const allSelected = eligible.length > 0 && eligible.every(r => selected.has(r.contract_id));

  function toggleAll() { allSelected ? setSelected(new Set()) : setSelected(new Set(eligible.map(r => r.contract_id))); }
  function toggleRow(cid: number, locked: boolean) {
    if (locked) return;
    setSelected(prev => { const s = new Set(prev); s.has(cid) ? s.delete(cid) : s.add(cid); return s; });
  }

  const selRows = rows.filter(r => selected.has(r.contract_id));
  const selTotal = selRows.reduce((s, r) => s + Number(r.total), 0);

  async function handleGenerate() {
    if (selected.size === 0) return;
    setGenerating(true); setResult(null); setError(null);
    try {
      const res = await apiJson<BatchInvoiceResult>(`/properties/${propertyId}/billing/invoices`, getToken, { method: "POST", body: { period, contract_ids: Array.from(selected) } });
      setResult(res);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Lỗi tạo hoá đơn"); }
    finally { setGenerating(false); }
  }

  function handleCopy(row: InvoicePreviewRow) {
    navigator.clipboard.writeText(`${window.location.origin}/invoice/public/${row.invoice_public_token}`);
    setCopied(prev => ({ ...prev, [row.contract_id]: true }));
    setTimeout(() => setCopied(prev => ({ ...prev, [row.contract_id]: false })), 2000);
  }

  if (loading) return <div style={{ padding: "32px 0", textAlign: "center", color: "var(--vn-text-3)", fontSize: 13 }}>Đang tải...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--blue-50)", border: "1px solid var(--blue-100)", fontSize: 12.5, color: "var(--blue-700)", display: "flex", alignItems: "center", gap: 7 }}>
        <FileText size={13} style={{ flexShrink: 0 }} />
        Hoá đơn tháng <strong>{period}</strong> · Điện/nước lấy từ chỉ số kỳ <strong>{prevPeriod(period)}</strong> (ghi chỉ số tháng trước)
      </div>

      {error && <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--red-50)", border: "1px solid var(--red-200)", fontSize: 13, color: "var(--red-700)" }}>{error}</div>}
      {result && (
        <div style={{ padding: "8px 12px", borderRadius: 8, background: result.errors.length ? "var(--amber-50)" : "var(--green-50)", border: `1px solid ${result.errors.length ? "var(--amber-200)" : "var(--green-200)"}`, fontSize: 13, color: result.errors.length ? "var(--amber-700)" : "var(--green-700)" }}>
          Đã tạo <strong>{result.created}</strong> hoá đơn · Bỏ qua <strong>{result.skipped}</strong> (đã có)
          {result.errors.length > 0 && <ul style={{ margin: "5px 0 0", paddingLeft: 16 }}>{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        </div>
      )}

      {rows.length === 0
        ? <div style={{ padding: "40px 24px", textAlign: "center", background: "var(--vn-surface)", border: BD, borderRadius: 10, color: "var(--vn-text-3)", fontSize: 13 }}>Không có phòng nào có hợp đồng trong tháng này.</div>
        : (
          <>
            <div style={{ background: "var(--vn-surface)", border: BD, borderRadius: 10, overflow: "auto" }}>
              <table style={{ width: "100%", minWidth: 760, borderCollapse: "separate", borderSpacing: 0, fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ padding: "10px 12px", background: "var(--slate-50)", borderBottom: BD, width: 28 }}>
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor: "pointer" }} />
                    </th>
                    {["Phòng / Khách", "Tiền nhà", "Điện", "Điện chung", "Nước", "Phụ phí", "Tổng", "Trạng thái", ""].map(TH)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const bd = i < rows.length - 1 ? BD : "none";
                    const hasInvoice = !!row.invoice_id;
                    const isLocked = hasInvoice && (row.invoice_status === "sent" || row.invoice_status === "paid");
                    const isChecked = selected.has(row.contract_id);
                    let rowBg = "transparent";
                    if (isLocked) rowBg = "var(--slate-50)";
                    else if (hasInvoice) rowBg = "var(--green-50)";
                    else if (isChecked) rowBg = "var(--blue-50)";
                    return (
                      <tr key={row.contract_id} style={{ background: rowBg, opacity: isLocked ? 0.7 : 1, cursor: isLocked ? "default" : "pointer" }}
                        onClick={() => !isLocked && toggleRow(row.contract_id, hasInvoice)}>
                        <td style={{ padding: "10px 12px", borderBottom: bd, verticalAlign: "middle" }}>
                          <input type="checkbox" checked={isChecked && !hasInvoice} disabled={hasInvoice} onChange={() => toggleRow(row.contract_id, hasInvoice)} onClick={e => e.stopPropagation()} style={{ cursor: hasInvoice ? "default" : "pointer" }} />
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: bd, verticalAlign: "middle" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ fontWeight: 700, fontFamily: "var(--font-geist-mono)", fontSize: 12 }}>P.{row.room_number}</span>
                            <span style={{ color: "var(--vn-text-2)", fontSize: 12 }}>{row.tenant_name}</span>
                          </div>
                          {row.is_prorated && <div style={{ fontSize: 10.5, color: "var(--amber-600)", marginTop: 1 }}>Tháng đầu · {row.prorate_label}</div>}
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: bd, verticalAlign: "middle", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{fmtM(row.rent_amount)}</td>
                        <td style={{ padding: "10px 12px", borderBottom: bd, verticalAlign: "middle", fontVariantNumeric: "tabular-nums" }}>
                          {!row.has_reading ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <AlertTriangle size={11} color="var(--amber-500)" />
                              <span style={{ color: "var(--vn-text-3)" }}>{fmtM(row.elec_amount)}</span>
                            </div>
                          ) : (
                            <div>
                              <span style={{ color: "var(--vn-text)", fontWeight: 500 }}>{fmtM(row.elec_amount)}</span>
                              {row.elec_prev != null && row.elec_curr != null && (
                                <div style={{ fontSize: 10.5, color: "var(--vn-text-3)", marginTop: 2, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                                  {fmtN(row.elec_prev)} → {fmtN(row.elec_curr)}
                                  <span style={{ color: "var(--amber-600)", fontWeight: 500, marginLeft: 4 }}>
                                    · {(Number(row.elec_curr) - Number(row.elec_prev)).toLocaleString("vi-VN")} kWh
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: bd, verticalAlign: "middle", fontVariantNumeric: "tabular-nums", color: "var(--vn-text-2)" }}>
                          {Number(row.shared_elec_amount) > 0
                            ? <span style={{ color: "var(--amber-700)" }}>{fmtM(row.shared_elec_amount)}</span>
                            : <span style={{ color: "var(--vn-text-3)" }}>—</span>}
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: bd, verticalAlign: "middle", fontVariantNumeric: "tabular-nums", color: "var(--vn-text-2)" }}>
                          <div>
                            <span>{fmtM(row.water_amount)}</span>
                            {row.water_prev != null && row.water_curr != null && (
                              <div style={{ fontSize: 10.5, color: "var(--vn-text-3)", marginTop: 2, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                                {fmtN(row.water_prev)} → {fmtN(row.water_curr)}
                                <span style={{ color: "var(--blue-600)", fontWeight: 500, marginLeft: 4 }}>
                                  · {(Number(row.water_curr) - Number(row.water_prev)).toLocaleString("vi-VN")} m³
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: bd, verticalAlign: "middle", fontVariantNumeric: "tabular-nums", color: "var(--vn-text-2)" }}>
                          {Number(row.surcharge_total) > 0
                            ? <div><div>{fmtM(row.surcharge_total)}</div>{row.surcharges.map(s => <div key={s.name} style={{ fontSize: 10.5, color: "var(--vn-text-3)" }}>{s.name}: {fmtM(s.amount)}</div>)}</div>
                            : <span style={{ color: "var(--vn-text-3)" }}>—</span>}
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: bd, verticalAlign: "middle", fontWeight: 700, fontVariantNumeric: "tabular-nums", fontSize: 13.5, color: "var(--blue-700)" }}>{fmtM(row.total)}</td>
                        <td style={{ padding: "10px 12px", borderBottom: bd, verticalAlign: "middle" }}>
                          {row.invoice_status ? <StatusBadge status={row.invoice_status} />
                            : <span style={{ fontSize: 10.5, color: "var(--vn-text-3)", background: "var(--slate-100)", padding: "2px 7px", borderRadius: 999 }}>Chưa có</span>}
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: bd, verticalAlign: "middle" }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: "flex", gap: 4 }}>
                            {row.invoice_public_token && (
                              <button onClick={() => handleCopy(row)} style={{ display: "inline-flex", alignItems: "center", height: 24, padding: "0 7px", borderRadius: 5, border: BD, background: copied[row.contract_id] ? "var(--green-50)" : "var(--vn-surface)", color: copied[row.contract_id] ? "var(--green-700)" : "var(--vn-text-3)", fontSize: 11, cursor: "pointer" }}>
                                {copied[row.contract_id] ? <Check size={10}/> : <Copy size={10}/>}
                              </button>
                            )}
                            {row.invoice_id && (
                              <button onClick={() => onViewInvoice(row.invoice_id!)} style={{ display: "inline-flex", alignItems: "center", gap: 3, height: 24, padding: "0 7px", borderRadius: 5, border: BD, background: "var(--vn-surface)", color: "var(--blue-600)", fontSize: 11, cursor: "pointer", fontWeight: 500 }}>
                                Xem<ChevronRight size={10}/>
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

            {/* Footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", background: "var(--vn-surface)", border: BD, borderRadius: 9 }}>
              <div style={{ fontSize: 13, color: "var(--vn-text-2)" }}>
                {selected.size > 0
                  ? <><strong style={{ color: "var(--vn-text)" }}>{selected.size} phòng</strong> · Tổng: <strong style={{ color: "var(--blue-700)" }}>{fmtM(selTotal)}</strong></>
                  : <span style={{ color: "var(--vn-text-3)" }}>Chọn phòng để tạo hoá đơn</span>}
              </div>
              <button onClick={handleGenerate} disabled={generating || selected.size === 0} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 16px", borderRadius: 8, background: selected.size > 0 ? "var(--blue-600)" : "var(--slate-100)", color: selected.size > 0 ? "#fff" : "var(--vn-text-3)", fontSize: 13, fontWeight: 600, border: "none", cursor: selected.size > 0 ? "pointer" : "default", opacity: generating ? 0.7 : 1 }}>
                <FileText size={13}/>{generating ? "Đang tạo…" : `Tạo hoá đơn${selected.size > 0 ? ` (${selected.size})` : ""}`}
              </button>
            </div>
          </>
        )
      }

    </div>
  );
}

// ── BillingModal ──────────────────────────────────────────────────
interface BillingModalProps {
  propertyId: string;
  property: Property | null;
  open: boolean;
  onClose: () => void;
  initialTab?: BillingTab;
}

type BillingTab = "readings" | "invoices";

export function BillingModal({ propertyId, property, open, onClose, initialTab = "readings" }: BillingModalProps) {
  const [period,         setPeriod]         = useState(currentPeriod());
  const [pickerOpen,     setPickerOpen]     = useState(false);
  const [pickerYear,     setPickerYear]     = useState(() => Number(currentPeriod().split("-")[0]));
  const [drawerInvoiceId, setDrawerInvoiceId] = useState<number | null>(null);

  // reset period when modal opens
  useEffect(() => {
    if (open) setPeriod(initialTab === "readings" ? prevPeriod(currentPeriod()) : currentPeriod());
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pickerOpen) { setPickerOpen(false); return; }
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose, pickerOpen]);

  const title    = initialTab === "readings" ? "Ghi chỉ số công tơ" : "Tạo hoá đơn hàng loạt";
  const subtitle = property?.name ?? "";
  const maxWidth = initialTab === "invoices" ? 1040 : 960;

  // period navigation helpers
  const [py, pm] = period.split("-");
  const periodDisplay = `Tháng ${Number(pm)} / ${py}`;
  const invoicePeriod = initialTab === "readings" ? nextPeriod(period) : period;
  const [ipy, ipm] = invoicePeriod.split("-");

  // sync picker year when period changes externally (prev/next buttons)
  useEffect(() => { setPickerYear(Number(py)); }, [py]);

  function movePeriod(dir: 1 | -1) {
    const y = Number(py), m = Number(pm);
    const next = dir === 1
      ? (m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`)
      : (m === 1  ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`);
    setPeriod(next);
  }

  function selectMonth(month: number) {
    setPeriod(`${pickerYear}-${String(month).padStart(2, "0")}`);
    setPickerOpen(false);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => { if (pickerOpen) { setPickerOpen(false); return; } onClose(); }}
        style={{
          position: "fixed", inset: 0, zIndex: 500,
          background: "rgba(15,23,42,.30)",
          backdropFilter: "blur(2px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity .2s ease",
        }}
      />

      {/* Centered dialog */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 501,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px 16px",
        pointerEvents: open ? "auto" : "none",
      }}>
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: maxWidth,
            maxHeight: "calc(100vh - 48px)",
            background: "var(--vn-surface)",
            borderRadius: 14,
            boxShadow: "var(--sh-pop)",
            display: "flex", flexDirection: "column",
            opacity: open ? 1 : 0,
            transform: open ? "scale(1) translateY(0)" : "scale(.97) translateY(8px)",
            transition: "opacity .22s ease, transform .22s cubic-bezier(.4,0,.2,1)",
          }}
        >
          {/* Header */}
          <div style={{ padding: "16px 20px", borderBottom: BD, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--vn-text)", letterSpacing: "-0.015em" }}>
                {title}
              </div>
              {subtitle && (
                <div style={{ fontSize: 12.5, color: "var(--vn-text-3)", marginTop: 2 }}>{subtitle}</div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Period navigator */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {initialTab === "readings" && (
                    <span style={{ fontSize: 12, color: "var(--vn-text-3)", whiteSpace: "nowrap" }}>Kỳ ghi chỉ số:</span>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 0, border: BD, borderRadius: 8, overflow: "visible", position: "relative" }}>
                    <button onClick={() => movePeriod(-1)} style={{ width: 30, height: 32, border: "none", borderRight: BD, background: "var(--vn-surface)", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--vn-text-2)", borderRadius: "8px 0 0 8px" }}>
                      <ChevronLeft size={13} />
                    </button>

                    {/* Clickable period label */}
                    <button
                      onClick={() => { setPickerOpen(o => !o); setPickerYear(Number(py)); }}
                      style={{ padding: "0 14px", height: 32, display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, color: "var(--vn-text)", background: pickerOpen ? "var(--blue-50)" : "var(--vn-surface)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em", border: "none", cursor: "pointer", transition: "background .12s" }}
                    >
                      {periodDisplay}
                      <ChevronDown size={11} color="var(--vn-text-3)" style={{ transform: pickerOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                    </button>

                    {/* Month picker dropdown */}
                    {pickerOpen && (
                      <div style={{ position: "absolute", top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", zIndex: 600, background: "var(--vn-surface)", border: BD, borderRadius: 10, boxShadow: "var(--sh-md)", padding: "12px", width: 224 }}
                        onClick={e => e.stopPropagation()}>
                        {/* Year row */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <button onClick={() => setPickerYear(y => y - 1)} style={{ width: 26, height: 26, borderRadius: 6, border: BD, background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--vn-text-2)" }}>
                            <ChevronLeft size={12} />
                          </button>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--vn-text)", fontVariantNumeric: "tabular-nums" }}>{pickerYear}</span>
                          <button onClick={() => setPickerYear(y => y + 1)} style={{ width: 26, height: 26, borderRadius: 6, border: BD, background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--vn-text-2)" }}>
                            <ChevronRight size={12} />
                          </button>
                        </div>
                        {/* Month grid 4×3 */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                            const isSelected = m === Number(pm) && pickerYear === Number(py);
                            return (
                              <button key={m} onClick={() => selectMonth(m)} style={{
                                height: 32, borderRadius: 7, border: isSelected ? "1.5px solid var(--blue-600)" : BD,
                                background: isSelected ? "var(--blue-600)" : "transparent",
                                color: isSelected ? "#fff" : "var(--vn-text-2)",
                                fontSize: 12.5, fontWeight: isSelected ? 700 : 400,
                                cursor: "pointer", transition: "background .1s",
                              }}>
                                T{m}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <button onClick={() => movePeriod(1)} style={{ width: 30, height: 32, border: "none", borderLeft: BD, background: "var(--vn-surface)", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--vn-text-2)", borderRadius: "0 8px 8px 0" }}>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
                {initialTab === "readings" && (
                  <span style={{ fontSize: 11.5, color: "var(--vn-text-3)", whiteSpace: "nowrap" }}>
                    Điện tiêu thụ tháng {Number(pm)}, tính vào hoá đơn tháng {Number(ipm)}
                  </span>
                )}
              </div>
              <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, border: BD, background: "var(--vn-surface)", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--vn-text-2)" }}>
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 20px" }}>
            {open && initialTab === "readings" && <ReadingTab propertyId={propertyId} period={period} property={property} />}
            {open && initialTab === "invoices" && <InvoiceTab propertyId={propertyId} period={period} onViewInvoice={setDrawerInvoiceId} />}
          </div>
        </div>
      </div>
      {/* Invoice drawer — rendered outside modal to avoid z-index conflict */}
      <InvoiceDrawer
        invoiceId={drawerInvoiceId}
        onClose={() => setDrawerInvoiceId(null)}
        zIndexBase={600}
      />
    </>
  );
}
