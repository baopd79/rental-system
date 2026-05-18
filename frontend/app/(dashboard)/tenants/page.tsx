"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Plus, User, Phone, CreditCard, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiJson } from "@/lib/api";
import type { Tenant } from "@/types/tenant";
import { TenantForm } from "@/components/app/tenant-form";

export default function TenantsPage() {
  const { getToken } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiJson<Tenant[]>("/tenants", getToken);
      setTenants(data);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  function handleSaved(t: Tenant) {
    setTenants((prev) =>
      editing ? prev.map((x) => (x.id === t.id ? t : x)) : [t, ...prev]
    );
    setShowForm(false);
    setEditing(null);
  }

  const filtered = tenants.filter((t) => {
    const q = search.toLowerCase();
    return (
      t.full_name.toLowerCase().includes(q) ||
      (t.phone ?? "").includes(q) ||
      (t.cccd ?? "").includes(q)
    );
  });

  if (loading) return (
    <div style={{ padding: 24, color: "var(--vn-text-3)", fontSize: 13.5 }}>Đang tải...</div>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.022em", color: "var(--vn-text)", margin: 0 }}>
            Khách thuê
          </h1>
          <p style={{ fontSize: 13, color: "var(--vn-text-3)", marginTop: 3 }}>
            {tenants.length} khách thuê
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 36, padding: "0 14px", borderRadius: 8,
            background: "var(--blue-600)", color: "#fff",
            fontSize: 13.5, fontWeight: 500, border: "none", cursor: "pointer",
            boxShadow: "0 1px 0 rgba(255,255,255,.18) inset, var(--sh-sm)",
          }}
        >
          <Plus size={15} color="#fff" />
          Thêm khách thuê
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{
          display: "flex", alignItems: "center",
          height: 36, background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: 8, padding: "0 12px", width: 300, gap: 8, boxShadow: "var(--sh-xs)",
        }}>
          <Search size={14} color="var(--vn-text-3)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, SĐT, CCCD…"
            style={{
              flex: 1, border: "none", outline: "none",
              fontSize: 13, color: "var(--vn-text)", background: "transparent",
            }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{
          background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: 14, padding: "64px 32px", textAlign: "center", boxShadow: "var(--sh-xs)",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "var(--blue-50)", display: "grid",
            placeItems: "center", margin: "0 auto 16px",
          }}>
            <User size={22} color="var(--blue-600)" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--vn-text-2)", marginBottom: 6 }}>
            {search ? "Không tìm thấy khách thuê" : "Chưa có khách thuê nào"}
          </div>
          <div style={{ fontSize: 13.5, color: "var(--vn-text-3)" }}>
            {search ? "Thử từ khóa khác." : "Thêm khách thuê để tạo hợp đồng."}
          </div>
        </div>
      ) : (
        <div style={{
          background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: 14, overflow: "hidden", boxShadow: "var(--sh-xs)",
        }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13.5 }}>
            <thead>
              <tr>
                {["Họ tên", "SĐT", "CCCD", "Email", "Ngày sinh", ""].map((h) => (
                  <th key={h} style={{
                    textAlign: "left", padding: "11px 16px",
                    font: "600 11px var(--font-geist-sans)",
                    color: "var(--vn-text-3)", letterSpacing: "0.04em",
                    textTransform: "uppercase", background: "var(--slate-50)",
                    borderBottom: "1px solid var(--vn-border)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr key={t.id}>
                  <td style={{ padding: "13px 16px", borderBottom: i < filtered.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: "var(--blue-100)", color: "var(--blue-700)",
                        display: "grid", placeItems: "center", flexShrink: 0,
                        fontSize: 13, fontWeight: 600,
                      }}>
                        {t.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500, color: "var(--vn-text)" }}>{t.full_name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "13px 16px", borderBottom: i < filtered.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", color: "var(--vn-text-2)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {t.phone ? <><Phone size={13} />{t.phone}</> : <span style={{ color: "var(--vn-text-3)" }}>—</span>}
                    </div>
                  </td>
                  <td style={{ padding: "13px 16px", borderBottom: i < filtered.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", color: "var(--vn-text-2)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {t.cccd ? <><CreditCard size={13} />{t.cccd}</> : <span style={{ color: "var(--vn-text-3)" }}>—</span>}
                    </div>
                  </td>
                  <td style={{ padding: "13px 16px", borderBottom: i < filtered.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", color: "var(--vn-text-2)" }}>
                    {t.email ?? <span style={{ color: "var(--vn-text-3)" }}>—</span>}
                  </td>
                  <td style={{ padding: "13px 16px", borderBottom: i < filtered.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", color: "var(--vn-text-2)" }}>
                    {t.date_of_birth ?? <span style={{ color: "var(--vn-text-3)" }}>—</span>}
                  </td>
                  <td style={{ padding: "13px 16px", borderBottom: i < filtered.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                    <button
                      onClick={() => { setEditing(t); setShowForm(true); }}
                      style={{
                        height: 28, padding: "0 12px", borderRadius: 6,
                        background: "var(--slate-100)", border: "none",
                        fontSize: 12.5, cursor: "pointer", color: "var(--vn-text-2)",
                        fontWeight: 500,
                      }}
                    >
                      Chỉnh sửa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditing(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Chỉnh sửa khách thuê" : "Thêm khách thuê mới"}</DialogTitle>
          </DialogHeader>
          <TenantForm tenant={editing ?? undefined} onSuccess={handleSaved} onCancel={() => { setShowForm(false); setEditing(null); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
