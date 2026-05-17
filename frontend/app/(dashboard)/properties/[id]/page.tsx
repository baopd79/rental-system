"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, Plus, BedDouble, Zap, Droplets, MoreVertical, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RoomStatusBadge } from "@/components/app/room-status-badge";
import { RoomForm } from "@/components/app/room-form";
import { apiJson, apiFetch } from "@/lib/api";
import type { Property } from "@/types/property";
import { WATER_CALC_LABELS } from "@/types/property";
import type { Room } from "@/types/room";

const STATUS_LABEL: Record<string, string> = {
  vacant: "Đang trống",
  occupied: "Đang thuê",
  maintenance: "Bảo trì",
};

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();

  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [deleting, setDeleting] = useState<Room | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [prop, roomList] = await Promise.all([
        apiJson<Property>(`/properties/${id}`, getToken),
        apiJson<Room[]>(`/properties/${id}/rooms`, getToken),
      ]);
      setProperty(prop);
      setRooms(roomList);
    } finally {
      setLoading(false);
    }
  }, [id, getToken]);

  useEffect(() => { load(); }, [load]);

  function handleSaved(r: Room) {
    setRooms((prev) => editing ? prev.map((x) => (x.id === r.id ? r : x)) : [r, ...prev]);
    setShowForm(false);
    setEditing(null);
  }

  async function handleDelete() {
    if (!deleting) return;
    const res = await apiFetch(`/rooms/${deleting.id}`, getToken, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      setDeleteError(err.detail ?? "Xóa thất bại");
      return;
    }
    setRooms((prev) => prev.filter((r) => r.id !== deleting.id));
    setDeleting(null);
    setDeleteError(null);
  }

  const stats = {
    total: rooms.length,
    vacant: rooms.filter((r) => r.status === "vacant").length,
    occupied: rooms.filter((r) => r.status === "occupied").length,
    maintenance: rooms.filter((r) => r.status === "maintenance").length,
  };

  if (loading) return (
    <div style={{ padding: 24, color: "var(--vn-text-3)", fontSize: 13.5 }}>Đang tải...</div>
  );
  if (!property) return (
    <div style={{ padding: 24, color: "var(--vn-text-3)", fontSize: 13.5 }}>Không tìm thấy nhà trọ.</div>
  );

  return (
    <div style={{ padding: 24 }}>
      {/* Breadcrumb + header */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => router.push("/properties")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 13, color: "var(--vn-text-3)", background: "none",
            border: "none", cursor: "pointer", padding: 0, marginBottom: 10,
          }}
        >
          <ArrowLeft size={14} /> Nhà trọ
        </button>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.018em", color: "var(--vn-text)", margin: 0 }}>
              {property.name}
            </h1>
            <p style={{ fontSize: 13, color: "var(--vn-text-3)", marginTop: 3 }}>{property.address}</p>
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
            <Plus size={15} color="#fff" /> Thêm phòng
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Tổng phòng",  value: stats.total,       color: "var(--vn-text)" },
          { label: "Đang trống",  value: stats.vacant,      color: "var(--green-600)" },
          { label: "Đang thuê",   value: stats.occupied,    color: "var(--blue-600)" },
          { label: "Bảo trì",     value: stats.maintenance, color: "var(--amber-600)" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
            borderRadius: 12, padding: "14px 18px", boxShadow: "var(--sh-xs)",
          }}>
            <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.025em", color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
            <div style={{ fontSize: 12.5, color: "var(--vn-text-3)", marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Config row */}
      <div style={{
        background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
        borderRadius: 12, padding: "14px 20px", marginBottom: 20,
        display: "flex", alignItems: "center", gap: 24, boxShadow: "var(--sh-xs)",
        fontSize: 13.5,
      }}>
        <span style={{ color: "var(--vn-text-3)", fontSize: 12.5, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>Cấu hình</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--vn-text-2)" }}>
          <Zap size={14} color="var(--blue-600)" />
          <span style={{ fontWeight: 500 }}>{Number(property.default_elec_rate).toLocaleString("vi-VN")}₫</span>
          <span style={{ color: "var(--vn-text-3)" }}>/kWh</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--vn-text-2)" }}>
          <Droplets size={14} color="var(--blue-500)" />
          <span style={{ fontWeight: 500 }}>{Number(property.default_water_rate).toLocaleString("vi-VN")}₫</span>
          <span style={{ color: "var(--vn-text-3)" }}>· {WATER_CALC_LABELS[property.water_calc_type]}</span>
        </span>
      </div>

      {/* Rooms table */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--vn-text)", margin: 0 }}>Danh sách phòng</h2>
        <div style={{
          display: "flex", alignItems: "center",
          height: 32, background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: 7, padding: "0 10px", gap: 7, boxShadow: "var(--sh-xs)",
        }}>
          <Search size={13} color="var(--vn-text-3)" />
          <span style={{ fontSize: 12.5, color: "var(--vn-text-3)" }}>Tìm phòng…</span>
        </div>
      </div>

      {rooms.length === 0 ? (
        <div style={{
          background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: 14, padding: "48px 32px", textAlign: "center", boxShadow: "var(--sh-xs)",
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: "var(--blue-50)", display: "grid",
            placeItems: "center", margin: "0 auto 14px",
          }}>
            <BedDouble size={20} color="var(--blue-600)" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--vn-text-2)", marginBottom: 6 }}>Chưa có phòng nào</div>
          <div style={{ fontSize: 13.5, color: "var(--vn-text-3)" }}>Thêm phòng đầu tiên.</div>
        </div>
      ) : (
        <div style={{
          background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: 14, overflow: "hidden", boxShadow: "var(--sh-xs)",
        }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13.5 }}>
            <thead>
              <tr>
                {["Phòng", "Tầng", "Diện tích", "Giá thuê", "Điện (riêng)", "Trạng thái", ""].map((h) => (
                  <th key={h} style={{
                    textAlign: "left", padding: "11px 16px",
                    font: "500 11.5px var(--font-geist-sans)",
                    color: "var(--vn-text-3)", letterSpacing: "0.04em",
                    textTransform: "uppercase", background: "var(--slate-50)",
                    borderBottom: "1px solid var(--vn-border)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map((r, i) => (
                <tr key={r.id}>
                  <td style={{ padding: "13px 16px", borderBottom: i < rooms.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                    <span style={{ fontWeight: 500, fontFamily: "var(--font-geist-mono)", fontSize: 13 }}>{r.room_number}</span>
                  </td>
                  <td style={{ padding: "13px 16px", borderBottom: i < rooms.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", color: "var(--vn-text-2)" }}>
                    {r.floor ? `Tầng ${r.floor}` : "—"}
                  </td>
                  <td style={{ padding: "13px 16px", borderBottom: i < rooms.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", color: "var(--vn-text-2)", fontVariantNumeric: "tabular-nums" }}>
                    {r.area_m2 ? `${r.area_m2} m²` : "—"}
                  </td>
                  <td style={{ padding: "13px 16px", borderBottom: i < rooms.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
                    {Number(r.rent_price).toLocaleString("vi-VN")}₫
                  </td>
                  <td style={{ padding: "13px 16px", borderBottom: i < rooms.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", color: "var(--vn-text-2)", fontVariantNumeric: "tabular-nums" }}>
                    {r.elec_rate
                      ? <span style={{ fontWeight: 500, color: "var(--vn-text)" }}>{Number(r.elec_rate).toLocaleString("vi-VN")}₫</span>
                      : <span style={{ color: "var(--vn-text-3)", fontSize: 12.5 }}>Theo nhà</span>
                    }
                  </td>
                  <td style={{ padding: "13px 16px", borderBottom: i < rooms.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                    <RoomStatusBadge status={r.status} />
                  </td>
                  <td style={{ padding: "13px 16px", borderBottom: i < rooms.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", width: 40 }}>
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={() => setOpenMenu(openMenu === r.id ? null : r.id)}
                        style={{
                          width: 30, height: 30, borderRadius: 6, border: "none",
                          background: "transparent", display: "grid",
                          placeItems: "center", cursor: "pointer", color: "var(--vn-text-3)",
                        }}
                      >
                        <MoreVertical size={15} />
                      </button>
                      {openMenu === r.id && (
                        <div style={{
                          position: "absolute", right: 0, top: 34, zIndex: 10,
                          background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
                          borderRadius: 8, boxShadow: "var(--sh-md)", minWidth: 130,
                          overflow: "hidden",
                        }}>
                          {[
                            { label: "Chỉnh sửa", action: () => { setEditing(r); setShowForm(true); setOpenMenu(null); } },
                            { label: "Xóa", action: () => { setDeleting(r); setOpenMenu(null); }, danger: true },
                          ].map(({ label, action, danger }) => (
                            <button key={label} onClick={action} style={{
                              display: "flex", alignItems: "center",
                              width: "100%", padding: "9px 14px",
                              background: "none", border: "none",
                              fontSize: 13.5, cursor: "pointer",
                              color: danger ? "var(--red-600)" : "var(--vn-text)", textAlign: "left",
                            }}>
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialogs */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditing(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Chỉnh sửa phòng" : "Thêm phòng mới"}</DialogTitle>
          </DialogHeader>
          <RoomForm
            propertyId={property.id}
            room={editing ?? undefined}
            defaultElecRate={property.default_elec_rate}
            onSuccess={handleSaved}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) { setDeleting(null); setDeleteError(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa phòng {deleting?.room_number}?</AlertDialogTitle>
            <AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription>
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
