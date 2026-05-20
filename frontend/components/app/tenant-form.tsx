"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiJson } from "@/lib/api";
import type { Tenant } from "@/types/tenant";

type Props = {
  tenant?: Tenant;
  onSuccess: (t: Tenant) => void;
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

export function TenantForm({ tenant, onSuccess, onCancel }: Props) {
  const { getToken } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: tenant?.full_name ?? "",
    cccd: tenant?.cccd ?? "",
    phone: tenant?.phone ?? "",
    email: tenant?.email ?? "",
    date_of_birth: tenant?.date_of_birth ?? "",
  });

  function set(k: keyof typeof form, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = {
        full_name: form.full_name,
        cccd: form.cccd || null,
        phone: form.phone || null,
        email: form.email || null,
        date_of_birth: form.date_of_birth || null,
      };
      const result = tenant
        ? await apiJson<Tenant>(`/tenants/${tenant.id}`, getToken, { method: "PUT", body })
        : await apiJson<Tenant>("/tenants", getToken, { method: "POST", body });
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
        <label style={LABEL_STYLE}>Họ và tên *</label>
        <input required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} style={FIELD_STYLE} placeholder="Nguyễn Văn A" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={LABEL_STYLE}>SĐT</label>
          <input value={form.phone} onChange={(e) => set("phone", e.target.value)} style={FIELD_STYLE} placeholder="0901234567" />
        </div>
        <div>
          <label style={LABEL_STYLE}>CCCD</label>
          <input value={form.cccd} onChange={(e) => set("cccd", e.target.value)} style={FIELD_STYLE} placeholder="012345678901" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={LABEL_STYLE}>Email</label>
          <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} style={FIELD_STYLE} placeholder="email@example.com" />
        </div>
        <div>
          <label style={LABEL_STYLE}>Ngày sinh</label>
          <input type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} style={FIELD_STYLE} />
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
          {saving ? "Đang lưu…" : tenant ? "Lưu thay đổi" : "Thêm khách thuê"}
        </button>
      </div>
    </form>
  );
}
