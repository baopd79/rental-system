"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Plus, Trash2, Info } from "lucide-react";
import { apiJson } from "@/lib/api";
import type { Property, PropertyCreate, PropertyUpdate, WaterCalcType } from "@/types/property";
import { WATER_CALC_LABELS } from "@/types/property";

interface Props {
  property?: Property;
  onSuccess: (p: Property, roomCount?: number) => void;
  onCancel: () => void;
}

// ── number helpers ────────────────────────────────────────────────
function fmtNum(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("vi-VN");
}

function useNumField(initial: string) {
  const [display, setDisplay] = useState(fmtNum(initial));
  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDisplay(fmtNum(e.target.value));
  }
  const raw = display.replace(/\D/g, "") || "0";
  return { display, onChange, raw };
}

// ── styles ────────────────────────────────────────────────────────
const FIELD: React.CSSProperties = {
  width: "100%", height: 34, padding: "0 10px",
  border: "1px solid var(--vn-border)", borderRadius: 7,
  fontSize: 13, color: "var(--vn-text)", background: "var(--vn-surface)",
  outline: "none", boxSizing: "border-box",
};
const LABEL: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 500, color: "var(--vn-text-2)", marginBottom: 4, display: "block",
};

type RoomRow = { room_number: string; floor: string; area_m2: string; rent_price: string; deposit: string };
function emptyRow(): RoomRow { return { room_number: "", floor: "", area_m2: "", rent_price: "", deposit: "" }; }

// ── component ─────────────────────────────────────────────────────
export function PropertyForm({ property, onSuccess, onCancel }: Props) {
  const { getToken } = useAuth();
  const isEdit = !!property;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(property?.name ?? "");
  const [address, setAddress] = useState(property?.address ?? "");
  const [description, setDescription] = useState(property?.description ?? "");
  const [waterCalcType, setWaterCalcType] = useState<WaterCalcType>(property?.water_calc_type ?? "per_meter");

  const elecRate = useNumField(property?.default_elec_rate ?? "3500");
  const waterRate = useNumField(property?.default_water_rate ?? "15000");

  const [rooms, setRooms] = useState<RoomRow[]>([emptyRow()]);

  function setRoom(i: number, field: keyof RoomRow, value: string) {
    setRooms(prev => prev.map((r, idx) => {
      if (idx !== i) return r;
      // format money fields live
      if (field === "rent_price" || field === "deposit") {
        return { ...r, [field]: fmtNum(value) };
      }
      return { ...r, [field]: value };
    }));
  }

  function addRow() { setRooms(prev => [...prev, emptyRow()]); }
  function removeRow(i: number) { if (rooms.length > 1) setRooms(prev => prev.filter((_, idx) => idx !== i)); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const validRooms = rooms.filter(r => r.room_number.trim());
      const body: PropertyCreate | PropertyUpdate = isEdit
        ? {
            name, address, description: description || undefined,
            default_elec_rate: elecRate.raw,
            default_water_rate: waterRate.raw,
            water_calc_type: waterCalcType,
          }
        : {
            name, address, description: description || undefined,
            default_elec_rate: elecRate.raw,
            default_water_rate: waterRate.raw,
            water_calc_type: waterCalcType,
            rooms: validRooms.map(r => ({
              room_number: r.room_number.trim(),
              ...(r.floor ? { floor: parseInt(r.floor) } : {}),
              ...(r.area_m2 ? { area_m2: r.area_m2 } : {}),
              rent_price: r.rent_price.replace(/\D/g, "") || "0",
              deposit: r.deposit.replace(/\D/g, "") || "0",
            })),
          };

      const result = await apiJson<Property>(
        isEdit ? `/properties/${property.id}` : "/properties",
        getToken,
        { method: isEdit ? "PUT" : "POST", body }
      );
      onSuccess(result, isEdit ? undefined : validRooms.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Property info */}
      <div>
        <label style={LABEL}>Tên nhà *</label>
        <input value={name} onChange={e => setName(e.target.value)} required placeholder="VD: Nhà trọ Quận 1" style={FIELD} />
      </div>
      <div>
        <label style={LABEL}>Địa chỉ *</label>
        <input value={address} onChange={e => setAddress(e.target.value)} required placeholder="Số nhà, đường, quận..." style={FIELD} />
      </div>
      <div>
        <label style={LABEL}>Mô tả</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
          style={{ ...FIELD, height: "auto", padding: "8px 10px", resize: "vertical" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={LABEL}>Giá điện (đ/kWh)</label>
          <input value={elecRate.display} onChange={elecRate.onChange} style={FIELD} placeholder="3.500" inputMode="numeric" />
        </div>
        <div>
          <label style={LABEL}>Giá nước (đ/đơn vị)</label>
          <input value={waterRate.display} onChange={waterRate.onChange} style={FIELD} placeholder="15.000" inputMode="numeric" />
        </div>
      </div>
      <div>
        <label style={LABEL}>Cách tính nước</label>
        <select value={waterCalcType} onChange={e => setWaterCalcType(e.target.value as WaterCalcType)} style={FIELD}>
          {(Object.keys(WATER_CALC_LABELS) as WaterCalcType[]).map(k => (
            <option key={k} value={k}>{WATER_CALC_LABELS[k]}</option>
          ))}
        </select>
      </div>

      {/* Rooms — create mode only */}
      {!isEdit && (
        <div style={{ borderTop: "1px solid var(--vn-border)", paddingTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--vn-text)" }}>Danh sách phòng</span>
            <button type="button" onClick={addRow} style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              height: 30, padding: "0 12px", borderRadius: 7,
              background: "var(--blue-50)", color: "var(--blue-700)",
              border: "1px solid var(--blue-200)", fontSize: 12.5, cursor: "pointer", fontWeight: 500,
            }}>
              <Plus size={13} /> Thêm phòng
            </button>
          </div>

          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "1.8fr 56px 72px 2fr 2fr 32px", gap: 6, marginBottom: 4 }}>
            {["Số phòng *", "Tầng", "DT (m²)", "Giá thuê (đ) *", "Tiền cọc (đ)", ""].map(h => (
              <span key={h} style={{ fontSize: 11, color: "var(--vn-text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{h}</span>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {rooms.map((r, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1.8fr 56px 72px 2fr 2fr 32px", gap: 6, alignItems: "center" }}>
                <input value={r.room_number} onChange={e => setRoom(i, "room_number", e.target.value)}
                  placeholder="101" style={FIELD} />
                <input type="number" value={r.floor} onChange={e => setRoom(i, "floor", e.target.value)}
                  placeholder="1" style={FIELD} />
                <input type="number" value={r.area_m2} onChange={e => setRoom(i, "area_m2", e.target.value)}
                  placeholder="25" style={FIELD} />
                <input value={r.rent_price} onChange={e => setRoom(i, "rent_price", e.target.value)}
                  placeholder="3.500.000" style={FIELD} inputMode="numeric" />
                <input value={r.deposit} onChange={e => setRoom(i, "deposit", e.target.value)}
                  placeholder="7.000.000" style={FIELD} inputMode="numeric" />
                <button type="button" onClick={() => removeRow(i)} disabled={rooms.length === 1} style={{
                  width: 30, height: 30, borderRadius: 7, border: "none",
                  background: rooms.length === 1 ? "transparent" : "var(--red-50)",
                  color: rooms.length === 1 ? "var(--vn-border)" : "var(--red-500)",
                  cursor: rooms.length === 1 ? "default" : "pointer",
                  display: "grid", placeItems: "center",
                }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Note */}
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 7, marginTop: 10,
            padding: "8px 12px", borderRadius: 8,
            background: "var(--blue-50)", border: "1px solid var(--blue-100)",
          }}>
            <Info size={14} color="var(--blue-500)" style={{ marginTop: 1, flexShrink: 0 }} />
            <p style={{ fontSize: 12.5, color: "var(--blue-700)", margin: 0, lineHeight: 1.5 }}>
              Các phụ phí khác (wifi, vệ sinh…) sẽ tạo sau trong trang chi tiết nhà.
              Bỏ trống "Số phòng" để bỏ qua hàng đó.
            </p>
          </div>
        </div>
      )}

      {error && <p style={{ fontSize: 13, color: "var(--red-600)", margin: 0 }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} disabled={loading} style={{
          height: 36, padding: "0 16px", borderRadius: 8,
          border: "1px solid var(--vn-border)", background: "var(--vn-surface)",
          fontSize: 13.5, cursor: "pointer", color: "var(--vn-text-2)",
        }}>Hủy</button>
        <button type="submit" disabled={loading} style={{
          height: 36, padding: "0 18px", borderRadius: 8,
          background: "var(--blue-600)", color: "#fff",
          fontSize: 13.5, fontWeight: 500, border: "none", cursor: "pointer",
          opacity: loading ? 0.7 : 1,
        }}>
          {loading ? "Đang lưu..." : isEdit ? "Cập nhật" : "Tạo nhà"}
        </button>
      </div>
    </form>
  );
}
