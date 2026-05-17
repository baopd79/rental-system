"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Plus, Building2, MapPin, Zap, Droplets, Search, MoreVertical, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PropertyForm } from "@/components/app/property-form";
import { apiJson, apiFetch } from "@/lib/api";
import type { Property } from "@/types/property";
import { WATER_CALC_LABELS } from "@/types/property";

const ACCENT = [
  { bg: "#DBEAFE", fg: "#1D4ED8" },
  { bg: "#FEF3C7", fg: "#B45309" },
  { bg: "#D1FAE5", fg: "#047857" },
  { bg: "#EDE9FE", fg: "#7C3AED" },
  { bg: "#FEE2E2", fg: "#B91C1C" },
  { bg: "#E0F2FE", fg: "#0369A1" },
];

export default function PropertiesPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [deleting, setDeleting] = useState<Property | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiJson<Property[]>("/properties", getToken);
      setProperties(data);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  function handleSaved(p: Property) {
    setProperties((prev) =>
      editing ? prev.map((x) => (x.id === p.id ? p : x)) : [p, ...prev]
    );
    setShowForm(false);
    setEditing(null);
  }

  async function handleDelete() {
    if (!deleting) return;
    const res = await apiFetch(`/properties/${deleting.id}`, getToken, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      setDeleteError(err.detail ?? "Xóa thất bại");
      return;
    }
    setProperties((prev) => prev.filter((p) => p.id !== deleting.id));
    setDeleting(null);
    setDeleteError(null);
  }

  if (loading) return (
    <div style={{ padding: 24, color: "var(--vn-text-3)", fontSize: 13.5 }}>Đang tải...</div>
  );

  return (
    <div style={{ padding: 24 }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.018em", color: "var(--vn-text)", margin: 0 }}>
            Nhà trọ
          </h1>
          <p style={{ fontSize: 13, color: "var(--vn-text-3)", marginTop: 3 }}>
            {properties.length} nhà · {properties.reduce((s, _) => s, 0)} phòng
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
          Thêm nhà mới
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{
          display: "flex", alignItems: "center",
          height: 36, background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: 8, padding: "0 12px", width: 280, gap: 8,
          boxShadow: "var(--sh-xs)",
        }}>
          <Search size={14} color="var(--vn-text-3)" />
          <span style={{ flex: 1, color: "var(--vn-text-3)", fontSize: 13 }}>Tìm theo tên hoặc địa chỉ…</span>
        </div>
      </div>

      {properties.length === 0 ? (
        <div style={{
          background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: 14, padding: "64px 32px", textAlign: "center",
          boxShadow: "var(--sh-xs)",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "var(--blue-50)", display: "grid",
            placeItems: "center", margin: "0 auto 16px",
          }}>
            <Building2 size={22} color="var(--blue-600)" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--vn-text-2)", marginBottom: 6 }}>
            Chưa có nhà trọ nào
          </div>
          <div style={{ fontSize: 13.5, color: "var(--vn-text-3)" }}>
            Thêm nhà đầu tiên để bắt đầu quản lý.
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
                {["Tên nhà", "Cấu hình nước", "Giá điện / Giá nước", "Trạng thái", ""].map((h, i) => (
                  <th key={i} style={{
                    textAlign: "left", padding: "12px 16px",
                    font: "500 11.5px var(--font-geist-sans)",
                    color: "var(--vn-text-3)", letterSpacing: "0.04em",
                    textTransform: "uppercase", background: "var(--slate-50)",
                    borderBottom: "1px solid var(--vn-border)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {properties.map((p, i) => {
                const acc = ACCENT[i % ACCENT.length];
                return (
                  <tr
                    key={p.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => router.push(`/properties/${p.id}`)}
                    className="group"
                  >
                    <td style={{ padding: "14px 16px", borderBottom: i < properties.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 8,
                          background: acc.bg, color: acc.fg,
                          display: "grid", placeItems: "center", flexShrink: 0,
                        }}>
                          <Building2 size={17} color={acc.fg} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 500, color: "var(--vn-text)" }}>{p.name}</div>
                          <div style={{ fontSize: 12, color: "var(--vn-text-3)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                            <MapPin size={11} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>{p.address}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", borderBottom: i < properties.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", color: "var(--vn-text-2)" }}>
                      {WATER_CALC_LABELS[p.water_calc_type]}
                    </td>
                    <td style={{ padding: "14px 16px", borderBottom: i < properties.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          height: 22, padding: "0 8px", borderRadius: 999,
                          fontSize: 11.5, fontWeight: 500,
                          background: "var(--slate-100)", color: "var(--slate-700)",
                        }}>
                          <Zap size={11} />{Number(p.default_elec_rate).toLocaleString("vi-VN")}₫/kWh
                        </span>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          height: 22, padding: "0 8px", borderRadius: 999,
                          fontSize: 11.5, fontWeight: 500,
                          background: "var(--slate-100)", color: "var(--slate-700)",
                        }}>
                          <Droplets size={11} />{Number(p.default_water_rate).toLocaleString("vi-VN")}₫
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", borderBottom: i < properties.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        height: 22, padding: "0 8px", borderRadius: 999,
                        fontSize: 11.5, fontWeight: 500,
                        background: "var(--green-50)", color: "var(--green-700)",
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
                        Hoạt động
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", borderBottom: i < properties.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", width: 40 }}
                      onClick={(e) => e.stopPropagation()}>
                      <div style={{ position: "relative" }}>
                        <button
                          onClick={() => setOpenMenu(openMenu === p.id ? null : p.id)}
                          style={{
                            width: 30, height: 30, borderRadius: 6, border: "none",
                            background: "transparent", display: "grid",
                            placeItems: "center", cursor: "pointer",
                            color: "var(--vn-text-3)",
                          }}
                        >
                          <MoreVertical size={15} />
                        </button>
                        {openMenu === p.id && (
                          <div style={{
                            position: "absolute", right: 0, top: 34, zIndex: 10,
                            background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
                            borderRadius: 8, boxShadow: "var(--sh-md)", minWidth: 140,
                            overflow: "hidden",
                          }}>
                            {[
                              { label: "Xem chi tiết", action: () => { router.push(`/properties/${p.id}`); setOpenMenu(null); } },
                              { label: "Chỉnh sửa", action: () => { setEditing(p); setShowForm(true); setOpenMenu(null); } },
                              { label: "Xóa", action: () => { setDeleting(p); setOpenMenu(null); }, danger: true },
                            ].map(({ label, action, danger }) => (
                              <button
                                key={label}
                                onClick={action}
                                style={{
                                  display: "flex", alignItems: "center",
                                  width: "100%", padding: "9px 14px",
                                  background: "none", border: "none",
                                  fontSize: 13.5, cursor: "pointer",
                                  color: danger ? "var(--red-600)" : "var(--vn-text)",
                                  textAlign: "left",
                                }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 20px", borderTop: "1px solid var(--vn-border)",
            fontSize: 12.5, color: "var(--vn-text-3)",
          }}>
            <div>Hiển thị {properties.length} nhà</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} />
              <span style={{
                width: 26, height: 26, borderRadius: 6, display: "grid", placeItems: "center",
                background: "var(--blue-50)", border: "1px solid var(--blue-200)",
                color: "var(--blue-700)", fontSize: 12, fontWeight: 500,
              }}>1</span>
              <ChevronRight size={14} />
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditing(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Chỉnh sửa nhà trọ" : "Thêm nhà trọ mới"}</DialogTitle>
          </DialogHeader>
          <PropertyForm property={editing ?? undefined} onSuccess={handleSaved} onCancel={() => { setShowForm(false); setEditing(null); }} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) { setDeleting(null); setDeleteError(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa nhà trọ?</AlertDialogTitle>
            <AlertDialogDescription>
              Xóa &ldquo;{deleting?.name}&rdquo;. Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p style={{ fontSize: 13, color: "var(--red-600)", padding: "0 4px" }}>{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
