"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiJson } from "@/lib/api";
import type { Tenant } from "@/types/tenant";
import type { Contract } from "@/types/contract";

type Props = {
  roomId: number;
  defaultRent: number;
  defaultDeposit: number;
  onSuccess: (c: Contract) => void;
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

export function ContractForm({ roomId, defaultRent, defaultDeposit, onSuccess, onCancel }: Props) {
  const { getToken } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const nextYear = new Date(Date.now() + 365 * 864e5).toISOString().split("T")[0];

  const [form, setForm] = useState({
    tenant_id: "",
    start_date: today,
    end_date: nextYear,
    agreed_rent: String(defaultRent),
    deposit: String(defaultDeposit),
    num_people: "1",
  });

  useEffect(() => {
    apiJson<Tenant[]>("/tenants", getToken).then(setTenants).catch(() => {});
  }, [getToken]);

  function set(k: keyof typeof form, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.tenant_id) { setError("Vui lòng chọn khách thuê"); return; }
    setSaving(true);
    try {
      const result = await apiJson<Contract>("/contracts", getToken, {
        method: "POST",
        body: {
          room_id: roomId,
          tenant_id: Number(form.tenant_id),
          start_date: form.start_date,
          end_date: form.end_date,
          agreed_rent: Number(form.agreed_rent),
          deposit: Number(form.deposit),
          num_people: Number(form.num_people),
        },
      });
      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={LABEL_STYLE}>Khách thuê *</label>
        <select
          required
          value={form.tenant_id}
          onChange={(e) => set("tenant_id", e.target.value)}
          style={{ ...FIELD_STYLE, cursor: "pointer" }}
        >
          <option value="">— Chọn khách thuê —</option>
          {tenants.map((t) => (
            <option key={t.id} value={String(t.id)}>
              {t.full_name}{t.phone ? ` · ${t.phone}` : ""}
            </option>
          ))}
        </select>
        {tenants.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--amber-600)", marginTop: 4 }}>
            Chưa có khách thuê. Thêm khách thuê trước tại trang Khách thuê.
          </p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={LABEL_STYLE}>Ngày bắt đầu *</label>
          <input type="date" required value={form.start_date} onChange={(e) => set("start_date", e.target.value)} style={FIELD_STYLE} />
        </div>
        <div>
          <label style={LABEL_STYLE}>Ngày kết thúc *</label>
          <input type="date" required value={form.end_date} onChange={(e) => set("end_date", e.target.value)} style={FIELD_STYLE} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <label style={LABEL_STYLE}>Giá thuê (₫) *</label>
          <input
            type="number" required min={0}
            value={form.agreed_rent}
            onChange={(e) => set("agreed_rent", e.target.value)}
            style={FIELD_STYLE}
          />
        </div>
        <div>
          <label style={LABEL_STYLE}>Tiền cọc (₫)</label>
          <input
            type="number" min={0}
            value={form.deposit}
            onChange={(e) => set("deposit", e.target.value)}
            style={FIELD_STYLE}
          />
        </div>
        <div>
          <label style={LABEL_STYLE}>Số người *</label>
          <input
            type="number" required min={1}
            value={form.num_people}
            onChange={(e) => set("num_people", e.target.value)}
            style={FIELD_STYLE}
          />
        </div>
      </div>

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
          {saving ? "Đang tạo…" : "Tạo hợp đồng"}
        </button>
      </div>
    </form>
  );
}
