"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { AlertTriangle, CheckCircle, FileText, Zap, Droplets } from "lucide-react";
import { apiJson } from "@/lib/api";
import type { Invoice } from "@/types/invoice";
import { INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS } from "@/types/invoice";
import type { Property } from "@/types/property";
import type { Room } from "@/types/room";
import type { RoomBillingStatus } from "@/types/billing";

type Props = {
  onSuccess: (inv: Invoice) => void;
  onCancel: () => void;
  onViewInvoice?: (id: number) => void;
  refreshSignal?: number;   // increment to force re-fetch billing status
};

const F: React.CSSProperties = {
  width: "100%", height: 36, padding: "0 10px",
  border: "1px solid var(--vn-border)", borderRadius: 8,
  fontSize: 13.5, color: "var(--vn-text)",
  background: "var(--vn-surface)", outline: "none", boxSizing: "border-box",
};
const LABEL: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 500, color: "var(--vn-text-2)", marginBottom: 5, display: "block",
};

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const fmtN = (n: string | null) => n ? Number(n).toLocaleString("vi-VN") : "—";
const fmtM = (n: string | null) => n ? Number(n).toLocaleString("vi-VN") + "₫" : "—";

export function InvoiceGenerateForm({ onSuccess, onCancel, onViewInvoice, refreshSignal }: Props) {
  const { getToken } = useAuth();

  // Step selections
  const [propertyId, setPropertyId] = useState("");
  const [roomId,     setRoomId]     = useState("");
  const [period,     setPeriod]     = useState(currentPeriod());

  // Data
  const [properties,    setProperties]    = useState<Property[]>([]);
  const [rooms,         setRooms]         = useState<Room[]>([]);
  const [status,        setStatus]        = useState<RoomBillingStatus | null>(null);

  // Loading / error / saving
  const [loadingProps,  setLoadingProps]  = useState(true);
  const [loadingRooms,  setLoadingRooms]  = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [savingReading, setSavingReading] = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  // Reading inputs (only needed when no reading exists)
  const [elecInput,  setElecInput]  = useState("");
  const [waterInput, setWaterInput] = useState("");

  // Load properties on mount
  useEffect(() => {
    apiJson<Property[]>("/properties", getToken)
      .then(setProperties)
      .catch(() => {})
      .finally(() => setLoadingProps(false));
  }, [getToken]);

  // Load occupied rooms when property changes
  useEffect(() => {
    if (!propertyId) { setRooms([]); setRoomId(""); setStatus(null); return; }
    setLoadingRooms(true);
    setRoomId(""); setStatus(null);
    apiJson<Room[]>(`/properties/${propertyId}/rooms`, getToken)
      .then(r => setRooms(r.filter(x => x.status === "occupied")))
      .catch(() => setRooms([]))
      .finally(() => setLoadingRooms(false));
  }, [propertyId, getToken]);

  // Load billing status when room + period complete
  const loadStatus = useCallback(async () => {
    if (!propertyId || !roomId || !period) { setStatus(null); return; }
    setLoadingStatus(true); setStatus(null); setError(null);
    setElecInput(""); setWaterInput("");
    try {
      const rows = await apiJson<RoomBillingStatus[]>(
        `/properties/${propertyId}/billing/status?period=${period}`, getToken
      );
      const row = rows.find(r => r.room_id === Number(roomId)) ?? null;
      setStatus(row);
    } catch {
      setStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }, [propertyId, roomId, period, getToken, refreshSignal]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const selectedProperty = properties.find(p => String(p.id) === propertyId);
  const isPerMeter = selectedProperty?.water_calc_type === "per_meter";

  // Derived state
  const hasInvoice   = !!status?.invoice_id;
  const hasReading   = !!status?.reading_id;
  const isInitial    = status?.reading_id !== null && status?.elec_prev === null;
  const isLocked     = !!status?.next_reading_locked;

  // "Đầu kỳ" display
  const elecStart = isInitial ? status?.elec_curr : (status?.elec_prev ?? status?.prev_elec_curr);
  const waterStart = isInitial ? status?.water_curr : (status?.water_prev ?? status?.prev_water_curr);

  async function handleSaveReadingAndGenerate() {
    if (!status || !propertyId) return;
    setError(null); setSavingReading(true);
    try {
      // Save reading first
      await apiJson<RoomBillingStatus[]>(`/properties/${propertyId}/billing/readings`, getToken, {
        method: "POST",
        body: {
          period,
          readings: [{
            room_id: Number(roomId),
            elec_curr: Number(elecInput),
            ...(isPerMeter && waterInput ? { water_curr: Number(waterInput) } : {}),
          }],
        },
      });
      // Then generate invoice
      await handleGenerate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi lưu chỉ số");
      setSavingReading(false);
    }
  }

  async function handleGenerate() {
    if (!status?.contract_id) return;
    setSaving(true); setError(null);
    try {
      const result = await apiJson<Invoice>("/invoices/generate", getToken, {
        method: "POST",
        body: { contract_id: status.contract_id, period },
      });
      onSuccess(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tạo hoá đơn");
    } finally {
      setSaving(false); setSavingReading(false);
    }
  }

  const isBusy = saving || savingReading;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── Step 1: Property ───────────────────────── */}
      <div>
        <label style={LABEL}>Nhà trọ *</label>
        <select value={propertyId} onChange={e => setPropertyId(e.target.value)}
          style={{ ...F, cursor: "pointer" }} disabled={loadingProps}>
          <option value="">— Chọn nhà trọ —</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* ── Step 2: Room ───────────────────────────── */}
      <div>
        <label style={LABEL}>Phòng *</label>
        <select value={roomId} onChange={e => setRoomId(e.target.value)}
          style={{ ...F, cursor: "pointer" }}
          disabled={!propertyId || loadingRooms}>
          <option value="">
            {loadingRooms ? "Đang tải…" : !propertyId ? "Chọn nhà trọ trước" : rooms.length === 0 ? "Không có phòng đang thuê" : "— Chọn phòng —"}
          </option>
          {rooms.map(r => <option key={r.id} value={r.id}>P.{r.room_number}</option>)}
        </select>
      </div>

      {/* ── Step 3: Period ─────────────────────────── */}
      <div>
        <label style={LABEL}>Kỳ hoá đơn *</label>
        <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
          style={F} disabled={!roomId} />
      </div>

      {/* ── Status section ─────────────────────────── */}
      {roomId && period && (
        <div style={{ borderTop: "1px solid var(--vn-border)", paddingTop: 14 }}>
          {loadingStatus ? (
            <div style={{ fontSize: 13, color: "var(--vn-text-3)", padding: "8px 0" }}>Đang kiểm tra…</div>
          ) : !status ? (
            <div style={{ fontSize: 13, color: "var(--amber-600)" }}>Không tìm thấy hợp đồng active cho phòng này trong kỳ đã chọn.</div>

          ) : hasInvoice ? (
            /* ── Case 1: Invoice already exists ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 14px", borderRadius: 10,
                background: "var(--green-50)", border: "1px solid var(--green-200)",
              }}>
                <CheckCircle size={16} color="var(--green-600)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--green-800)" }}>
                    Đã có hoá đơn kỳ này
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      height: 20, padding: "0 8px", borderRadius: 999,
                      fontSize: 11, fontWeight: 600,
                      background: INVOICE_STATUS_COLORS[status.invoice_status!].bg,
                      color: INVOICE_STATUS_COLORS[status.invoice_status!].fg,
                    }}>
                      {INVOICE_STATUS_LABELS[status.invoice_status!]}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--vn-text)", fontVariantNumeric: "tabular-nums" }}>
                      {fmtM(status.invoice_total)}
                    </span>
                  </div>
                </div>
                {onViewInvoice && (
                  <button onClick={() => onViewInvoice(status.invoice_id!)}
                    style={{ height: 30, padding: "0 12px", borderRadius: 7, border: "1px solid var(--green-300)", background: "#fff", color: "var(--green-700)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                    Xem HĐ →
                  </button>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--vn-text-3)", textAlign: "center" }}>
                Không thể tạo thêm hoá đơn cho cùng kỳ.
              </div>
            </div>

          ) : !hasReading || isInitial ? (
            /* ── Case 2: No reading (or initial only) ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                padding: "10px 12px", borderRadius: 8,
                background: "var(--amber-50)", border: "1px solid var(--amber-200)",
              }}>
                <AlertTriangle size={14} color="var(--amber-600)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13, color: "var(--amber-800)" }}>
                  {isInitial
                    ? "Phòng mới vào, cần nhập chỉ số cuối tháng đầu tiên."
                    : "Chưa có chỉ số điện cho kỳ này. Nhập để tạo hoá đơn."}
                </div>
              </div>

              {/* Reading inputs */}
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ ...LABEL, display: "flex", alignItems: "center", gap: 4 }}>
                    <Zap size={11} color="var(--amber-500)" /> Chỉ số đầu
                  </label>
                  <input readOnly value={elecStart ? fmtN(elecStart) : "—"}
                    style={{ ...F, background: "var(--slate-50)", color: "var(--vn-text-3)" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ ...LABEL, display: "flex", alignItems: "center", gap: 4 }}>
                    <Zap size={11} color="var(--amber-500)" /> Chỉ số cuối *
                  </label>
                  <input type="number" min={0} value={elecInput}
                    onChange={e => setElecInput(e.target.value)}
                    placeholder={elecStart ? `> ${fmtN(elecStart)}` : "Nhập…"}
                    style={{ ...F, borderColor: elecInput ? "var(--blue-400)" : "var(--amber-300)" }} />
                </div>
              </div>

              {isPerMeter && (
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...LABEL, display: "flex", alignItems: "center", gap: 4 }}>
                      <Droplets size={11} color="var(--blue-400)" /> Nước đầu
                    </label>
                    <input readOnly value={waterStart ? fmtN(waterStart) : "—"}
                      style={{ ...F, background: "var(--slate-50)", color: "var(--vn-text-3)" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...LABEL, display: "flex", alignItems: "center", gap: 4 }}>
                      <Droplets size={11} color="var(--blue-400)" /> Nước cuối *
                    </label>
                    <input type="number" min={0} value={waterInput}
                      onChange={e => setWaterInput(e.target.value)}
                      placeholder={waterStart ? `> ${fmtN(waterStart)}` : "Nhập…"}
                      style={{ ...F, borderColor: waterInput ? "var(--blue-400)" : "var(--vn-border)" }} />
                  </div>
                </div>
              )}
            </div>

          ) : (
            /* ── Case 3: Has reading, no invoice ── */
            <div style={{
              padding: "12px 14px", borderRadius: 10,
              background: "var(--blue-50)", border: "1px solid var(--blue-100)",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <FileText size={15} color="var(--blue-600)" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: "var(--blue-800)" }}>Đã có chỉ số điện. </span>
                <span style={{ color: "var(--blue-700)" }}>
                  {fmtN(isInitial ? status.elec_curr : status.elec_prev)} → {fmtN(status.elec_curr)}
                  {" · "}
                  <span style={{ fontWeight: 600 }}>
                    {status.elec_prev !== null && status.elec_curr !== null
                      ? `${(Number(status.elec_curr) - Number(status.elec_prev)).toLocaleString("vi-VN")} kWh`
                      : "—"}
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Error ──────────────────────────────────── */}
      {error && (
        <div style={{ fontSize: 13, color: "var(--red-600)", padding: "8px 12px", background: "var(--red-50)", borderRadius: 8, border: "1px solid var(--red-200)" }}>
          {error}
        </div>
      )}

      {/* ── Actions ────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
        <button type="button" onClick={onCancel} style={{
          height: 36, padding: "0 16px", borderRadius: 8,
          border: "1px solid var(--vn-border)", background: "var(--vn-surface)",
          fontSize: 13.5, cursor: "pointer", color: "var(--vn-text-2)",
        }}>Hủy</button>

        {/* Show action button only when appropriate */}
        {status && !hasInvoice && !loadingStatus && (
          !hasReading || isInitial ? (
            /* Need reading first */
            <button
              onClick={handleSaveReadingAndGenerate}
              disabled={isBusy || !elecInput || (isPerMeter && !waterInput)}
              style={{
                height: 36, padding: "0 18px", borderRadius: 8,
                background: elecInput ? "var(--blue-600)" : "var(--slate-200)",
                color: elecInput ? "#fff" : "var(--vn-text-3)",
                fontSize: 13.5, fontWeight: 500, border: "none",
                cursor: elecInput ? "pointer" : "default",
                opacity: isBusy ? 0.7 : 1,
              }}
            >
              {savingReading ? "Đang lưu chỉ số…" : isBusy ? "Đang tạo…" : "Lưu chỉ số & Tạo HĐ"}
            </button>
          ) : (
            /* Has reading, just generate */
            <button
              onClick={handleGenerate}
              disabled={isBusy || isLocked}
              style={{
                height: 36, padding: "0 18px", borderRadius: 8,
                background: "var(--blue-600)", color: "#fff",
                fontSize: 13.5, fontWeight: 500, border: "none",
                cursor: "pointer", opacity: isBusy ? 0.7 : 1,
              }}
            >
              {isBusy ? "Đang tạo…" : "Tạo hoá đơn"}
            </button>
          )
        )}
      </div>
    </div>
  );
}
