"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Plus, User, Phone, CreditCard, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiJson } from "@/lib/api";
import type { Tenant } from "@/types/tenant";
import { TenantForm } from "@/components/app/tenant-form";
import { TenantDrawer } from "@/components/app/tenant-drawer";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function TenantsPage() {
  const { getToken } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [drawerTenant, setDrawerTenant] = useState<Tenant | null>(null);

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
    // If the drawer is open for the same tenant, refresh it
    if (drawerTenant?.id === t.id) setDrawerTenant(t);
    setShowForm(false);
    setEditing(null);
  }

  function openEdit(t: Tenant) {
    setEditing(t);
    setShowForm(true);
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
    <div style={{ padding: "var(--sp-6)", color: "var(--vn-text-3)", fontSize: "var(--text-body)" }}>Đang tải...</div>
  );

  const addBtn = (
    <button
      onClick={() => { setEditing(null); setShowForm(true); }}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        height: 36, padding: "0 var(--sp-3)", borderRadius: "var(--r-md)",
        background: "var(--blue-600)", color: "#fff",
        fontSize: "var(--text-label)", fontWeight: 600, border: "none", cursor: "pointer",
        boxShadow: "0 1px 0 rgba(255,255,255,.18) inset, var(--sh-sm)",
      }}
      className="btn-primary"
    >
      <Plus size={14} color="#fff" />
      Thêm khách thuê
    </button>
  );

  return (
    <div className="page-pad">
      <PageHeader title="Khách thuê" description={`${tenants.length} khách thuê`} action={addBtn} />

      <div style={{ marginBottom: "var(--sp-4)" }}>
        <div style={{
          display: "flex", alignItems: "center",
          height: 36, background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: "var(--r-md)", padding: "0 var(--sp-3)", width: 300, gap: "var(--sp-2)", boxShadow: "var(--sh-xs)",
        }}>
          <Search size={13} color="var(--vn-text-3)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, SĐT, CCCD…"
            style={{
              flex: 1, border: "none", outline: "none",
              fontSize: "var(--text-label)", color: "var(--vn-text)", background: "transparent",
            }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{
          background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: "var(--r-lg)", boxShadow: "var(--sh-xs)",
        }}>
          <EmptyState
            message={search ? "Không tìm thấy khách thuê" : "Chưa có khách thuê nào"}
            icon={User}
          />
        </div>
      ) : (
        <div style={{
          background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: "var(--r-lg)", overflow: "hidden", boxShadow: "var(--sh-xs)",
        }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: "var(--text-body)" }}>
            <thead>
              <tr>
                {["Họ tên", "SĐT", "CCCD", "Email", "Ngày sinh"].map((h) => (
                  <th key={h} style={{
                    textAlign: "left", padding: "11px var(--sp-4)",
                    fontSize: "var(--text-xs)", fontWeight: 600,
                    color: "var(--vn-text-3)", letterSpacing: "0.05em",
                    textTransform: "uppercase", background: "var(--slate-50)",
                    borderBottom: "1px solid var(--vn-border)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr
                  key={t.id}
                  onClick={() => setDrawerTenant(t)}
                  className="hover:bg-(--slate-50) tr-row"
                  style={{ cursor: "pointer" }}
                >
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tenant detail drawer */}
      <TenantDrawer
        tenant={drawerTenant}
        onClose={() => setDrawerTenant(null)}
        onEdit={openEdit}
      />

      {/* Edit form dialog */}
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
