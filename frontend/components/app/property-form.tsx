"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Plus, Trash2, Info, Building2, Zap, DoorOpen } from "lucide-react";
import { apiJson } from "@/lib/api";
import type { Property, PropertyCreate, PropertyUpdate, WaterCalcType } from "@/types/property";

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

// ── shared styles ─────────────────────────────────────────────────
const BD = "1px solid var(--vn-border)";

const INPUT: React.CSSProperties = {
  width: "100%", height: 36, padding: "0 11px",
  border: BD, borderRadius: 8,
  fontSize: 13.5, color: "var(--vn-text)", background: "var(--vn-surface)",
  outline: "none", boxSizing: "border-box",
  fontFamily: "inherit",
  transition: "border-color .15s, box-shadow .15s",
};
const LABEL: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 600, color: "var(--vn-text-2)",
  marginBottom: 5, display: "block",
};
const SECTION: React.CSSProperties = {
  background: "var(--slate-50)", border: BD,
  borderRadius: 10, padding: "14px 16px",
};
const SECTION_HEAD: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 7,
  marginBottom: 14,
};
const SECTION_TITLE: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: "var(--vn-text)",
  letterSpacing: "-0.01em",
};

// ── suffix input ──────────────────────────────────────────────────
function SuffixInput({ value, onChange, placeholder, suffix, inputMode }: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  suffix: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{
      display: "flex", alignItems: "stretch",
      border: focused ? "1px solid var(--blue-600)" : BD,
      borderRadius: 8, overflow: "hidden",
      boxShadow: focused ? "0 0 0 3px rgba(59,166,241,.13)" : "none",
      transition: "border-color .15s, box-shadow .15s",
      background: "var(--vn-surface)",
    }}>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        inputMode={inputMode}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: 1, height: 36, padding: "0 8px", border: "none",
          fontSize: 13, color: "var(--vn-text)", background: "transparent",
          outline: "none", minWidth: 0, width: 0,
          fontFamily: "inherit",
        }}
      />
      <span style={{
        display: "flex", alignItems: "center", padding: "0 10px",
        fontSize: 12, fontWeight: 500,
        color: focused ? "var(--blue-700)" : "var(--vn-text-3)",
        background: "var(--slate-100)",
        borderLeft: BD,
        whiteSpace: "nowrap",
        transition: "color .15s",
      }}>
        {suffix}
      </span>
    </div>
  );
}

// ── focused input wrapper ─────────────────────────────────────────
function FocusInput({ style, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { style?: React.CSSProperties }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e); }}
      onBlur={e => { setFocused(false); props.onBlur?.(e); }}
      style={{
        ...INPUT,
        ...(focused ? {
          borderColor: "var(--blue-600)",
          boxShadow: "0 0 0 3px rgba(59,166,241,.13)",
        } : {}),
        ...style,
      }}
    />
  );
}

function FocusTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e); }}
      onBlur={e => { setFocused(false); props.onBlur?.(e); }}
      style={{
        ...INPUT, height: "auto", padding: "8px 11px", resize: "vertical",
        ...(focused ? {
          borderColor: "var(--blue-600)",
          boxShadow: "0 0 0 3px rgba(59,166,241,.13)",
        } : {}),
      }}
    />
  );
}

// ── segmented control ─────────────────────────────────────────────
const WATER_SEGMENTS: { value: WaterCalcType; label: string; suffix: string }[] = [
  { value: "per_meter",  label: "Chỉ số m³",   suffix: "₫/m³" },
  { value: "per_person", label: "Theo người",   suffix: "₫/người" },
  { value: "per_room",   label: "Theo phòng",  suffix: "₫/phòng" },
];

// ── room card ─────────────────────────────────────────────────────
type RoomRow = { room_number: string; floor: string; area_m2: string; rent_price: string; deposit: string };
function emptyRow(): RoomRow { return { room_number: "", floor: "", area_m2: "", rent_price: "", deposit: "" }; }

function RoomCard({ room, index, total, onChange, onRemove }: {
  room: RoomRow;
  index: number;
  total: number;
  onChange: (field: keyof RoomRow, value: string) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{
      background: "var(--vn-surface)", border: BD, borderRadius: 9,
      padding: "12px 14px", minWidth: 0, overflow: "hidden",
    }}>
      {/* Card header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 5, background: "var(--blue-50)",
            display: "grid", placeItems: "center",
          }}>
            <DoorOpen size={12} color="var(--blue-600)" />
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--vn-text)" }}>
            {room.room_number ? `Phòng ${room.room_number}` : `Phòng ${index + 1}`}
          </span>
        </div>
        <button
          type="button" onClick={onRemove} disabled={total === 1}
          style={{
            width: 26, height: 26, borderRadius: 6, border: "none",
            background: total === 1 ? "transparent" : "var(--red-50)",
            color: total === 1 ? "var(--vn-border)" : "var(--red-600)",
            cursor: total === 1 ? "default" : "pointer",
            display: "grid", placeItems: "center",
          }}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Row 1: số phòng, tầng, diện tích */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
        <div>
          <label style={{ ...LABEL, fontSize: 11.5 }}>Số phòng *</label>
          <FocusInput
            value={room.room_number}
            onChange={e => onChange("room_number", e.target.value)}
            placeholder="101"
          />
        </div>
        <div>
          <label style={{ ...LABEL, fontSize: 11.5 }}>Tầng</label>
          <FocusInput
            type="number"
            value={room.floor}
            onChange={e => onChange("floor", e.target.value)}
            placeholder="1"
          />
        </div>
        <div>
          <label style={{ ...LABEL, fontSize: 11.5 }}>DT (m²)</label>
          <FocusInput
            type="number"
            value={room.area_m2}
            onChange={e => onChange("area_m2", e.target.value)}
            placeholder="25"
          />
        </div>
      </div>

      {/* Row 2: giá thuê, tiền cọc */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={{ ...LABEL, fontSize: 11.5 }}>Giá thuê <span style={{ color: "var(--vn-text-3)", fontWeight: 400 }}>(₫/tháng)</span></label>
          <FocusInput
            value={room.rent_price}
            onChange={e => onChange("rent_price", e.target.value)}
            placeholder="3.500.000"
            inputMode="numeric"
          />
        </div>
        <div>
          <label style={{ ...LABEL, fontSize: 11.5 }}>Tiền cọc <span style={{ color: "var(--vn-text-3)", fontWeight: 400 }}>(₫)</span></label>
          <FocusInput
            value={room.deposit}
            onChange={e => onChange("deposit", e.target.value)}
            placeholder="7.000.000"
            inputMode="numeric"
          />
        </div>
      </div>
    </div>
  );
}

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
      if (field === "rent_price" || field === "deposit") return { ...r, [field]: fmtNum(value) };
      return { ...r, [field]: value };
    }));
  }

  function addRow() { setRooms(prev => [...prev, emptyRow()]); }
  function removeRow(i: number) { if (rooms.length > 1) setRooms(prev => prev.filter((_, idx) => idx !== i)); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const validRooms = rooms.filter(r => r.room_number.trim());
      const body: PropertyCreate | PropertyUpdate = isEdit
        ? { name, address, description: description || undefined, default_elec_rate: elecRate.raw, default_water_rate: waterRate.raw, water_calc_type: waterCalcType }
        : {
            name, address, description: description || undefined,
            default_elec_rate: elecRate.raw, default_water_rate: waterRate.raw, water_calc_type: waterCalcType,
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

  const waterSuffix = WATER_SEGMENTS.find(s => s.value === waterCalcType)?.suffix ?? "₫";

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ── Section 1: Thông tin nhà trọ ── */}
      <div style={SECTION}>
        <div style={SECTION_HEAD}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--blue-50)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Building2 size={14} color="var(--blue-600)" />
          </div>
          <span style={SECTION_TITLE}>Thông tin nhà trọ</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={LABEL}>Tên nhà <span style={{ color: "var(--red-600)" }}>*</span></label>
              <FocusInput value={name} onChange={e => setName(e.target.value)} required placeholder="VD: Nhà trọ Quận 1" />
            </div>
            <div>
              <label style={LABEL}>Địa chỉ <span style={{ color: "var(--red-600)" }}>*</span></label>
              <FocusInput value={address} onChange={e => setAddress(e.target.value)} required placeholder="Số nhà, đường, quận..." />
            </div>
          </div>
          <div>
            <label style={LABEL}>Mô tả</label>
            <FocusTextarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Ghi chú thêm về nhà trọ..." />
          </div>
        </div>
      </div>

      {/* ── Section 2: Cấu hình điện nước ── */}
      <div style={SECTION}>
        <div style={SECTION_HEAD}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--amber-50)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Zap size={14} color="var(--amber-600)" />
          </div>
          <span style={SECTION_TITLE}>Cấu hình điện nước</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={LABEL}>Giá điện</label>
              <SuffixInput value={elecRate.display} onChange={elecRate.onChange} placeholder="3.500" suffix="₫/kWh" inputMode="numeric" />
            </div>
            <div>
              <label style={LABEL}>Giá nước</label>
              <SuffixInput value={waterRate.display} onChange={waterRate.onChange} placeholder="15.000" suffix={waterSuffix} inputMode="numeric" />
            </div>
          </div>
          <div>
            <label style={LABEL}>Cách tính nước</label>
            <div style={{ display: "flex", border: BD, borderRadius: 8, overflow: "hidden" }}>
              {WATER_SEGMENTS.map((seg, i) => (
                <button
                  key={seg.value}
                  type="button"
                  onClick={() => setWaterCalcType(seg.value)}
                  style={{
                    flex: 1, height: 34, border: "none", cursor: "pointer",
                    borderLeft: i > 0 ? BD : "none",
                    background: waterCalcType === seg.value ? "var(--blue-600)" : "var(--vn-surface)",
                    color: waterCalcType === seg.value ? "#fff" : "var(--vn-text-2)",
                    fontSize: 12.5, fontWeight: waterCalcType === seg.value ? 600 : 400,
                    transition: "background .12s, color .12s",
                  }}
                >
                  {seg.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 3: Danh sách phòng (create only) ── */}
      {!isEdit && (
        <div style={SECTION}>
          <div style={{ ...SECTION_HEAD, marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--slate-100)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <DoorOpen size={14} color="var(--slate-600)" />
            </div>
            <span style={SECTION_TITLE}>Danh sách phòng ban đầu</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, minWidth: 0, overflow: "hidden" }}
            className="room-grid">
            {rooms.map((r, i) => (
              <RoomCard
                key={i}
                room={r}
                index={i}
                total={rooms.length}
                onChange={(field, value) => setRoom(i, field, value)}
                onRemove={() => removeRow(i)}
              />
            ))}
          </div>

          <button type="button" onClick={addRow} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            width: "100%", height: 34, marginTop: 8, borderRadius: 8,
            background: "var(--vn-surface)", color: "var(--vn-text-2)",
            border: "1px dashed var(--vn-border)", fontSize: 13, cursor: "pointer",
            transition: "background .12s, color .12s, border-color .12s",
          }}
            className="add-room-btn"
          >
            <Plus size={13} /> Thêm phòng
          </button>

          <div style={{
            display: "flex", alignItems: "flex-start", gap: 7, marginTop: 8,
            padding: "8px 12px", borderRadius: 8,
            background: "var(--blue-50)", border: "1px solid var(--blue-100)",
          }}>
            <Info size={13} color="var(--blue-500)" style={{ marginTop: 1, flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: "var(--blue-700)", margin: 0, lineHeight: 1.5 }}>
              Phụ phí (wifi, vệ sinh…) tạo sau trong trang chi tiết nhà. Bỏ trống "Số phòng" để bỏ qua.
            </p>
          </div>
        </div>
      )}

      {error && <p style={{ fontSize: 13, color: "var(--red-600)", margin: 0 }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 2 }}>
        <button type="button" onClick={onCancel} disabled={loading} style={{
          height: 36, padding: "0 16px", borderRadius: 8,
          border: BD, background: "var(--vn-surface)",
          fontSize: 13.5, cursor: "pointer", color: "var(--vn-text-2)",
        }}>Hủy</button>
        <button type="submit" disabled={loading} className="btn-primary" style={{
          height: 36, padding: "0 20px", borderRadius: 8,
          background: "var(--blue-600)", color: "#fff",
          fontSize: 13.5, fontWeight: 600, border: "none", cursor: "pointer",
          opacity: loading ? 0.7 : 1,
          boxShadow: "0 1px 0 rgba(255,255,255,.18) inset, var(--sh-sm)",
        }}>
          {loading ? "Đang lưu..." : isEdit ? "Cập nhật" : "Tạo nhà"}
        </button>
      </div>
    </form>
  );
}
