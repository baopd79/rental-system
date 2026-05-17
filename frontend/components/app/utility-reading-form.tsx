"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiJson } from "@/lib/api";
import type { UtilityReading } from "@/types/utility";

type Props = {
  roomId: number;
  isPerMeter: boolean;
  defaultPeriod: string;
  editing?: UtilityReading;
  onSuccess: (r: UtilityReading) => void;
  onCancel: () => void;
};

const FIELD_STYLE: React.CSSProperties = {
  width: "100%", height: 36, padding: "0 10px",
  border: "1px solid var(--vn-border)", borderRadius: 8,
  fontSize: 13.5, color: "var(--vn-text)",
  background: "var(--vn-surface)", outline: "none",
  boxSizing: "border-box",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 500, color: "var(--vn-text-2)", marginBottom: 5, display: "block",
};

export function UtilityReadingForm({ roomId, isPerMeter, defaultPeriod, editing, onSuccess, onCancel }: Props) {
  const { getToken } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    period: editing?.period ?? defaultPeriod,
    elec_curr: editing ? String(editing.elec_curr) : "",
    water_curr: editing ? String(editing.water_curr ?? "") : "",
  });

  function set(k: keyof typeof form, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      let result: UtilityReading;
      if (editing) {
        result = await apiJson<UtilityReading>(`/utility-readings/${editing.id}`, getToken, {
          method: "PUT",
          body: {
            elec_curr: Number(form.elec_curr),
            ...(isPerMeter && form.water_curr ? { water_curr: Number(form.water_curr) } : {}),
          },
        });
      } else {
        result = await apiJson<UtilityReading>("/utility-readings", getToken, {
          method: "POST",
          body: {
            room_id: roomId,
            period: form.period,
            elec_curr: Number(form.elec_curr),
            ...(isPerMeter && form.water_curr ? { water_curr: Number(form.water_curr) } : {}),
          },
        });
      }
      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Period */}
      {!editing && (
        <div>
          <label style={LABEL_STYLE}>Kỳ (tháng) *</label>
          <input
            type="month"
            required
            value={form.period}
            onChange={(e) => set("period", e.target.value)}
            style={FIELD_STYLE}
          />
        </div>
      )}

      {/* Electricity */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--vn-text-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
          ⚡ Điện
        </div>
        <div>
          <label style={LABEL_STYLE}>Chỉ số cuối kỳ (kWh) *</label>
          <input
            type="number"
            required
            min={0}
            step="0.01"
            value={form.elec_curr}
            onChange={(e) => set("elec_curr", e.target.value)}
            placeholder="Ví dụ: 1250.50"
            style={FIELD_STYLE}
          />
          {!editing && (
            <p style={{ fontSize: 12, color: "var(--vn-text-3)", marginTop: 5 }}>
              Số đầu kỳ sẽ tự điền từ kỳ trước. Nếu là kỳ đầu tiên, số đầu kỳ = trống.
            </p>
          )}
        </div>
      </div>

      {/* Water — only for per_meter */}
      {isPerMeter && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--vn-text-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
            💧 Nước
          </div>
          <div>
            <label style={LABEL_STYLE}>Chỉ số cuối kỳ (m³)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.water_curr}
              onChange={(e) => set("water_curr", e.target.value)}
              placeholder="Ví dụ: 45.00"
              style={FIELD_STYLE}
            />
          </div>
        </div>
      )}

      {error && <p style={{ fontSize: 13, color: "var(--red-600)", margin: 0 }}>{error}</p>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
        <button type="button" onClick={onCancel} style={{
          height: 36, padding: "0 16px", borderRadius: 8,
          border: "1px solid var(--vn-border)", background: "var(--vn-surface)",
          fontSize: 13.5, cursor: "pointer", color: "var(--vn-text-2)",
        }}>
          Hủy
        </button>
        <button type="submit" disabled={saving} style={{
          height: 36, padding: "0 18px", borderRadius: 8,
          background: "var(--blue-600)", color: "#fff",
          fontSize: 13.5, fontWeight: 500, border: "none", cursor: "pointer",
          opacity: saving ? 0.7 : 1,
        }}>
          {saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Nhập chỉ số"}
        </button>
      </div>
    </form>
  );
}
