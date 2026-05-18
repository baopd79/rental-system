"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Plus, Building2, MapPin, Zap, Droplets, MoreVertical, Search, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PropertyForm } from "@/components/app/property-form";
import { PropertyDrawer } from "@/components/app/property-drawer";
import { apiJson, apiFetch } from "@/lib/api";
import type { Property } from "@/types/property";
import { WATER_CALC_LABELS } from "@/types/property";

interface PropertyStats {
  id: number;
  total_rooms: number;
  occupied_rooms: number;
  monthly_revenue: number;
  period: string;
}

const ACCENT = [
  { bg: "#DBEAFE", fg: "#1D4ED8" },
  { bg: "#D1FAE5", fg: "#047857" },
  { bg: "#FEF3C7", fg: "#B45309" },
  { bg: "#EDE9FE", fg: "#7C3AED" },
  { bg: "#FEE2E2", fg: "#B91C1C" },
  { bg: "#E0F2FE", fg: "#0369A1" },
];

const fmtMoney = (n: number) => {
  if (n === 0) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + "tr₫";
  return n.toLocaleString("vi-VN") + "₫";
};
const fmtRate = (n: number | string) => {
  const v = Number(n);
  if (v >= 1000) return (v / 1000).toLocaleString("vi-VN") + "k";
  return v.toLocaleString("vi-VN");
};

const BD = "1px solid var(--vn-border)";
const TH_STYLE: React.CSSProperties = {
  textAlign: "left", padding: "10px 16px",
  font: "600 11px var(--font-geist-sans)",
  color: "var(--vn-text-3)", letterSpacing: "0.05em",
  textTransform: "uppercase", background: "var(--slate-50)",
  borderBottom: BD, whiteSpace: "nowrap",
};

// ── Occupancy bar ─────────────────────────────────────────────────
function OccupancyCell({ occupied, total }: { occupied: number; total: number }) {
  const pct = total > 0 ? (occupied / total) * 100 : 0;
  const color = pct >= 80 ? "var(--green-600)" : pct >= 50 ? "var(--blue-600)" : "var(--amber-600)";
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 5 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--vn-text)", fontVariantNumeric: "tabular-nums" }}>{occupied}</span>
        <span style={{ fontSize: 12, color: "var(--vn-text-3)" }}>/ {total} phòng</span>
      </div>
      <div style={{ height: 5, borderRadius: 99, background: "var(--slate-100)", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 99, width: `${pct}%`, background: color, transition: "width .4s ease" }} />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────
const PAGE_SIZE = 10;
type SortKey = "name" | "revenue" | "occupancy";

export default function PropertiesPage() {
  const { getToken } = useAuth();
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [stats, setStats] = useState<Map<number, PropertyStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [drawerProperty, setDrawerProperty] = useState<Property | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [deleting, setDeleting] = useState<Property | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [props, statsArr] = await Promise.all([
        apiJson<Property[]>("/properties", getToken),
        apiJson<PropertyStats[]>("/properties/stats", getToken),
      ]);
      setProperties(props);
      setStats(new Map(statsArr.map(s => [s.id, s])));
    } catch {
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  // ── derived state ────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = properties.filter(p =>
      !q || p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)
    );
    if (sort === "revenue") {
      list = [...list].sort((a, b) => (stats.get(b.id)?.monthly_revenue ?? 0) - (stats.get(a.id)?.monthly_revenue ?? 0));
    } else if (sort === "occupancy") {
      list = [...list].sort((a, b) => {
        const sa = stats.get(a.id); const sb = stats.get(b.id);
        const ra = sa ? sa.occupied_rooms / (sa.total_rooms || 1) : 0;
        const rb = sb ? sb.occupied_rooms / (sb.total_rooms || 1) : 0;
        return rb - ra;
      });
    }
    return list;
  }, [properties, stats, search, sort]);

  const totalRooms = useMemo(() => Array.from(stats.values()).reduce((s, v) => s + v.total_rooms, 0), [stats]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── actions ──────────────────────────────────────────────────
  function handleSaved(p: Property, roomCount?: number) {
    setProperties(prev => editing ? prev.map(x => x.id === p.id ? p : x) : [p, ...prev]);
    setShowForm(false); setEditing(null);
    if (!editing) {
      setToast(roomCount ? `Đã tạo "${p.name}" với ${roomCount} phòng` : `Đã tạo "${p.name}"`);
      setTimeout(() => setToast(null), 4000);
      load(); // refresh stats
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    const res = await apiFetch(`/properties/${deleting.id}`, getToken, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      setDeleteError(err.detail ?? "Xóa thất bại"); return;
    }
    setProperties(prev => prev.filter(p => p.id !== deleting.id));
    setDeleting(null); setDeleteError(null);
  }

  function toggleSelect(id: number) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelected(prev => prev.size === paged.length ? new Set() : new Set(paged.map(p => p.id)));
  }

  if (loading) return (
    <div style={{ padding: 24, color: "var(--vn-text-3)", fontSize: 13 }}>Đang tải...</div>
  );

  const allSelected = paged.length > 0 && selected.size === paged.length;

  return (
    <div style={{ padding: "20px 24px" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, display: "flex", alignItems: "center", gap: 10,
          background: "#111827", color: "#f9fafb", borderRadius: 10,
          padding: "10px 18px", fontSize: 13, fontWeight: 500,
          boxShadow: "0 8px 24px rgba(0,0,0,.25)",
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green-600)", flexShrink: 0 }} />
          {toast}
        </div>
      )}

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--vn-text-3)", marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
            <span>Quản lý</span>
            <ChevronRight size={11} />
            <span>Nhà trọ</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.022em", color: "var(--vn-text)", margin: 0 }}>
            Nhà trọ
          </h1>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 36, padding: "0 14px", borderRadius: 8,
            background: "var(--blue-600)", color: "#fff",
            fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
            boxShadow: "0 1px 0 rgba(255,255,255,.18) inset, var(--sh-sm)",
          }}
        >
          <Plus size={14} color="#fff" />
          Thêm nhà mới
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        {/* Search */}
        <div style={{
          display: "flex", alignItems: "center", height: 34,
          background: "var(--vn-surface)", border: BD,
          borderRadius: 7, padding: "0 11px", width: 260, gap: 7,
          boxShadow: "var(--sh-xs)",
        }}>
          <Search size={13} color="var(--vn-text-3)" />
          <input
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Tìm theo tên hoặc địa chỉ…"
            style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: "var(--vn-text)", background: "transparent" }}
          />
        </div>

        {/* Sort */}
        <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
          {([ ["name", "Tên A-Z"], ["revenue", "Doanh thu cao nhất"], ["occupancy", "Lấp đầy cao nhất"] ] as [SortKey, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setSort(key)} style={{
              height: 34, padding: "0 12px", border: BD, cursor: "pointer",
              borderRadius: key === "name" ? "7px 0 0 7px" : key === "occupancy" ? "0 7px 7px 0" : "0",
              borderLeft: key !== "name" ? "none" : BD,
              background: sort === key ? "var(--blue-50)" : "var(--vn-surface)",
              color: sort === key ? "var(--blue-700)" : "var(--vn-text-2)",
              fontSize: 12.5, fontWeight: sort === key ? 600 : 400,
              boxShadow: "var(--sh-xs)",
            }}>
              {key === "name" && <SlidersHorizontal size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />}
              {label}
            </button>
          ))}
        </div>

        {/* Total count */}
        <div style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--vn-text-3)", fontVariantNumeric: "tabular-nums" }}>
          Tổng <strong style={{ color: "var(--vn-text-2)" }}>{filtered.length} nhà</strong>
          {totalRooms > 0 && <> · <strong style={{ color: "var(--vn-text-2)" }}>{totalRooms} phòng</strong></>}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{
          background: "var(--vn-surface)", border: BD, borderRadius: 12,
          padding: "56px 32px", textAlign: "center", boxShadow: "var(--sh-xs)",
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--blue-50)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
            <Building2 size={20} color="var(--blue-600)" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--vn-text-2)", marginBottom: 5 }}>
            {search ? "Không tìm thấy nhà trọ phù hợp" : "Chưa có nhà trọ nào"}
          </div>
          <div style={{ fontSize: 13, color: "var(--vn-text-3)" }}>
            {search ? "Thử tìm với từ khóa khác." : "Thêm nhà đầu tiên để bắt đầu quản lý."}
          </div>
        </div>
      ) : (
        <div style={{ background: "var(--vn-surface)", border: BD, borderRadius: 12, overflow: "hidden", boxShadow: "var(--sh-xs)" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13.5 }}>
            <thead>
              <tr>
                {/* Checkbox */}
                <th style={{ ...TH_STYLE, width: 44, textAlign: "center", padding: "10px 0 10px 16px" }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    style={{ width: 14, height: 14, cursor: "pointer", accentColor: "var(--blue-600)" }} />
                </th>
                <th style={{ ...TH_STYLE }}>Tên nhà</th>
                <th style={{ ...TH_STYLE }}>Phòng / Lấp đầy</th>
                <th style={{ ...TH_STYLE }}>Cấu hình</th>
                <th style={{ ...TH_STYLE, textAlign: "right" }}>Doanh thu tháng</th>
                <th style={{ ...TH_STYLE }}>Trạng thái</th>
                <th style={{ ...TH_STYLE, width: 48 }} />
              </tr>
            </thead>
            <tbody>
              {paged.map((p, i) => {
                const acc = ACCENT[properties.indexOf(p) % ACCENT.length];
                const s = stats.get(p.id);
                const bd = i < paged.length - 1 ? BD : "none";
                const isSelected = selected.has(p.id);
                const TD = (extra?: React.CSSProperties): React.CSSProperties => ({
                  padding: "13px 16px", borderBottom: bd, verticalAlign: "middle",
                  background: isSelected ? "var(--blue-50)" : "transparent",
                  ...extra,
                });
                return (
                  <tr
                    key={p.id}
                    onClick={() => setDrawerProperty(p)}
                    style={{ cursor: "pointer" }}
                    className="hover:bg-(--slate-50)"
                  >
                    {/* Checkbox */}
                    <td style={{ ...TD(), width: 44, textAlign: "center", padding: "13px 0 13px 16px" }}
                      onClick={e => { e.stopPropagation(); toggleSelect(p.id); }}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(p.id)}
                        style={{ width: 14, height: 14, cursor: "pointer", accentColor: "var(--blue-600)" }} />
                    </td>

                    {/* Name */}
                    <td style={TD()}>
                      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                          background: acc.bg, display: "grid", placeItems: "center",
                        }}>
                          <Building2 size={18} color={acc.fg} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--vn-text)", marginBottom: 2 }}>{p.name}</div>
                          <div style={{ fontSize: 12, color: "var(--vn-text-3)", display: "flex", alignItems: "center", gap: 3, overflow: "hidden" }}>
                            <MapPin size={10} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>{p.address}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Occupancy */}
                    <td style={TD()}>
                      {s ? <OccupancyCell occupied={s.occupied_rooms} total={s.total_rooms} /> : (
                        <span style={{ color: "var(--vn-text-3)", fontSize: 13 }}>—</span>
                      )}
                    </td>

                    {/* Config */}
                    <td style={TD()}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--vn-text-2)" }}>
                          <Zap size={11} color="var(--amber-500)" />
                          <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtRate(p.default_elec_rate)}₫/kWh</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--vn-text-2)" }}>
                          <Droplets size={11} color="var(--blue-400)" />
                          <span style={{ fontVariantNumeric: "tabular-nums" }}>
                            {fmtRate(p.default_water_rate)}₫
                            {p.water_calc_type === "per_meter" ? "/m³" : p.water_calc_type === "per_person" ? "/người" : "/phòng"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Revenue */}
                    <td style={{ ...TD(), textAlign: "right" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: s?.monthly_revenue ? "var(--vn-text)" : "var(--vn-text-3)" }}>
                        {s ? fmtMoney(s.monthly_revenue) : "—"}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={TD()}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        fontSize: 12.5, fontWeight: 500, color: "var(--green-700)",
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green-600)", flexShrink: 0 }} />
                        Hoạt động
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ ...TD(), padding: "13px 12px" }} onClick={e => e.stopPropagation()}>
                      <div style={{ position: "relative" }}>
                        <button
                          onClick={() => setOpenMenu(openMenu === p.id ? null : p.id)}
                          style={{ width: 28, height: 28, borderRadius: 6, border: BD, background: "var(--vn-surface)", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--vn-text-3)" }}
                        >
                          <MoreVertical size={14} />
                        </button>
                        {openMenu === p.id && (
                          <div style={{
                            position: "absolute", right: 0, top: 32, zIndex: 20,
                            background: "var(--vn-surface)", border: BD,
                            borderRadius: 8, boxShadow: "var(--sh-md)", minWidth: 148, overflow: "hidden",
                          }}>
                            {[
                              { label: "Xem chi tiết", action: () => { setDrawerProperty(p); setOpenMenu(null); } },
                              { label: "Chỉnh sửa",    action: () => { setEditing(p); setShowForm(true); setOpenMenu(null); } },
                              { label: "Xóa",           action: () => { setDeleting(p); setOpenMenu(null); }, danger: true },
                            ].map(({ label, action, danger }) => (
                              <button key={label} onClick={action} style={{
                                display: "flex", alignItems: "center", width: "100%",
                                padding: "9px 14px", background: "none", border: "none",
                                fontSize: 13, cursor: "pointer", textAlign: "left",
                                color: danger ? "var(--red-600)" : "var(--vn-text)",
                              }}>
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

          {/* Footer */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "11px 18px", borderTop: BD, fontSize: 12.5, color: "var(--vn-text-3)",
          }}>
            <span>
              Hiện thị {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} trên {filtered.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ width: 28, height: 28, borderRadius: 6, border: BD, background: "var(--vn-surface)", display: "grid", placeItems: "center", cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.4 : 1 }}
              >
                <ChevronLeft size={13} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setPage(n)} style={{
                  width: 28, height: 28, borderRadius: 6, border: BD,
                  background: n === page ? "var(--blue-600)" : "var(--vn-surface)",
                  color: n === page ? "#fff" : "var(--vn-text-2)",
                  fontSize: 12, fontWeight: n === page ? 600 : 400,
                  cursor: "pointer", display: "grid", placeItems: "center",
                }}>
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ width: 28, height: 28, borderRadius: 6, border: BD, background: "var(--vn-surface)", display: "grid", placeItems: "center", cursor: page === totalPages ? "default" : "pointer", opacity: page === totalPages ? 0.4 : 1 }}
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <Dialog open={showForm} onOpenChange={o => { if (!o) { setShowForm(false); setEditing(null); } }}>
        <DialogContent className="sm:max-w-3xl" style={{ maxHeight: "90vh", overflowY: "auto" }}>
          <DialogHeader>
            <DialogTitle>{editing ? "Chỉnh sửa nhà trọ" : "Thêm nhà trọ mới"}</DialogTitle>
          </DialogHeader>
          <PropertyForm property={editing ?? undefined} onSuccess={handleSaved} onCancel={() => { setShowForm(false); setEditing(null); }} />
        </DialogContent>
      </Dialog>

      <PropertyDrawer
        property={drawerProperty}
        stats={drawerProperty ? stats.get(drawerProperty.id) : undefined}
        onClose={() => setDrawerProperty(null)}
      />

      <AlertDialog open={!!deleting} onOpenChange={o => { if (!o) { setDeleting(null); setDeleteError(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa nhà trọ?</AlertDialogTitle>
            <AlertDialogDescription>Xóa &ldquo;{deleting?.name}&rdquo;. Hành động này không thể hoàn tác.</AlertDialogDescription>
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
