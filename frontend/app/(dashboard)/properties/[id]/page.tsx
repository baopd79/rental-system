"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft, Plus, BedDouble, MoreVertical, Search,
  Calculator, Settings2, Zap, Droplets, Tag, Receipt,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RoomStatusBadge } from "@/components/app/room-status-badge";
import { RoomForm } from "@/components/app/room-form";
import { BillingModal } from "@/components/app/billing-modal";
import { PropertyConfigDrawer } from "@/components/app/property-config-drawer";
import { PropertyForm } from "@/components/app/property-form";
import { apiJson, apiFetch } from "@/lib/api";
import type { Property } from "@/types/property";
import { WATER_CALC_LABELS } from "@/types/property";
import type { Room } from "@/types/room";
import type { Surcharge } from "@/types/surcharge";
import type { SharedMeter } from "@/types/shared-meter";

type StatusFilter = "all" | "occupied" | "vacant" | "maintenance";

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all:         "Tất cả",
  occupied:    "Đang thuê",
  vacant:      "Trống",
  maintenance: "Bảo trì",
};

function TimeLeft({ endDate }: { endDate: string }) {
  const end = new Date(endDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return <span style={{ fontSize: 12, color: "var(--red-600)", fontWeight: 600 }}>Hết hạn</span>;
  const totalDays = Math.floor(diffMs / 86400000);
  const parts: string[] = [];
  const y = Math.floor(totalDays / 365), m = Math.floor((totalDays % 365) / 30), d = totalDays % 30;
  if (y > 0) parts.push(`${y}n`);
  if (m > 0) parts.push(`${m}th`);
  if (y === 0 && d > 0) parts.push(`${d}ng`);
  const color = totalDays <= 30 ? "var(--red-600)" : totalDays <= 90 ? "var(--amber-600)" : "var(--vn-text-3)";
  return <span style={{ fontSize: 12.5, color }}>{parts.join(" ")}</span>;
}

const BD = "1px solid var(--vn-border)";
const fmtMoney = (n: number | string) => Number(n).toLocaleString("vi-VN") + "₫";
const fmtRate  = (n: number | string) => {
  const v = Number(n);
  return v >= 1000 ? (v / 1000).toLocaleString("vi-VN") + "k" : v.toLocaleString("vi-VN");
};

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const { getToken } = useAuth();

  const [property,     setProperty]     = useState<Property | null>(null);
  const [rooms,        setRooms]        = useState<Room[]>([]);
  const [surcharges,   setSurcharges]   = useState<Surcharge[]>([]);
  const [sharedMeters, setSharedMeters] = useState<SharedMeter[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState<string | null>(null);

  const [statusFilter,      setStatusFilter]      = useState<StatusFilter>("all");
  const [showRoomForm,      setShowRoomForm]      = useState(false);
  const [editingRoom,       setEditingRoom]       = useState<Room | null>(null);
  const [deletingRoom,      setDeletingRoom]      = useState<Room | null>(null);
  const [deleteError,       setDeleteError]       = useState<string | null>(null);
  const [openMenu,          setOpenMenu]          = useState<number | null>(null);
  const [showBilling,       setShowBilling]       = useState(false);
  const [billingTab,        setBillingTab]        = useState<"readings" | "invoices">("readings");
  const [showConfig,        setShowConfig]        = useState(false);
  const [showEditProperty,  setShowEditProperty]  = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [prop, roomList, scList, smList] = await Promise.all([
        apiJson<Property>(`/properties/${id}`, getToken),
        apiJson<Room[]>(`/properties/${id}/rooms`, getToken),
        apiJson<Surcharge[]>(`/properties/${id}/surcharges`, getToken),
        apiJson<SharedMeter[]>(`/properties/${id}/shared-meters`, getToken),
      ]);
      setProperty(prop);
      setRooms(roomList);
      setSurcharges(scList);
      setSharedMeters(smList);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [id, getToken]);

  useEffect(() => { load(); }, [load]);

  function handleRoomSaved(r: Room) {
    setRooms(prev => editingRoom ? prev.map(x => x.id === r.id ? r : x) : [r, ...prev]);
    setShowRoomForm(false); setEditingRoom(null);
  }

  async function handleRoomDelete() {
    if (!deletingRoom) return;
    const res = await apiFetch(`/rooms/${deletingRoom.id}`, getToken, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      setDeleteError(err.detail ?? "Xóa thất bại"); return;
    }
    setRooms(prev => prev.filter(r => r.id !== deletingRoom.id));
    setDeletingRoom(null); setDeleteError(null);
  }

  if (loading) return <div style={{ padding: 24, color: "var(--vn-text-3)", fontSize: 13 }}>Đang tải...</div>;
  if (loadError) return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--red-700)" }}>Không thể tải dữ liệu</div>
      <div style={{ fontSize: 13, color: "var(--vn-text-3)" }}>{loadError}</div>
      <button onClick={load} style={{ height: 32, padding: "0 16px", borderRadius: 7, border: "1px solid var(--vn-border)", background: "var(--vn-surface)", fontSize: 13, cursor: "pointer", color: "var(--vn-text-2)" }}>
        Thử lại
      </button>
    </div>
  );
  if (!property) return <div style={{ padding: 24, color: "var(--vn-text-3)", fontSize: 13 }}>Không tìm thấy nhà trọ.</div>;

  // ── derived ──────────────────────────────────────────────────────
  const sharedRoomIds = new Set(sharedMeters.flatMap(m => m.room_ids));

  const counts = {
    all:         rooms.length,
    occupied:    rooms.filter(r => r.status === "occupied").length,
    vacant:      rooms.filter(r => r.status === "vacant").length,
    maintenance: rooms.filter(r => r.status === "maintenance").length,
  };

  const filtered = statusFilter === "all" ? rooms : rooms.filter(r => r.status === statusFilter);

  return (
    <div style={{ padding: "20px 24px" }}>

      {/* Breadcrumb */}
      <button onClick={() => router.push("/properties")} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--vn-text-3)", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 12 }}>
        <ArrowLeft size={13} /> Nhà trọ
      </button>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.022em", color: "var(--vn-text)", margin: 0 }}>
            {property.name}
          </h1>
          <p style={{ fontSize: 13, color: "var(--vn-text-3)", marginTop: 3 }}>{property.address}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowConfig(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", borderRadius: 8, background: "var(--vn-surface)", color: "var(--vn-text-2)", fontSize: 13, fontWeight: 500, border: BD, cursor: "pointer" }}>
            <Settings2 size={14} /> Cấu hình
          </button>
          <button onClick={() => { setBillingTab("readings"); setShowBilling(true); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", borderRadius: 8, background: "var(--vn-surface)", color: "var(--vn-text-2)", fontSize: 13, fontWeight: 500, border: BD, cursor: "pointer" }}>
            <Zap size={14} /> Ghi chỉ số
          </button>
          <button onClick={() => { setBillingTab("invoices"); setShowBilling(true); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", borderRadius: 8, background: "var(--vn-surface)", color: "var(--vn-text-2)", fontSize: 13, fontWeight: 500, border: BD, cursor: "pointer" }}>
            <Calculator size={14} /> Tạo hoá đơn
          </button>
          <button onClick={() => { setEditingRoom(null); setShowRoomForm(true); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", borderRadius: 8, background: "var(--blue-600)", color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", boxShadow: "0 1px 0 rgba(255,255,255,.18) inset, var(--sh-sm)" }}>
            <Plus size={14} color="#fff" /> Thêm phòng
          </button>
        </div>
      </div>

      {/* ── Compact stat strip ──────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center",
        background: "var(--vn-surface)", border: BD, borderRadius: 10,
        marginBottom: 10, overflow: "hidden", boxShadow: "var(--sh-xs)",
      }}>
        {([
          { label: "Tổng",      value: counts.all,         color: "var(--vn-text)",   bg: "transparent" },
          { label: "Đang thuê", value: counts.occupied,    color: "var(--blue-600)",  bg: "var(--blue-50)" },
          { label: "Trống",     value: counts.vacant,      color: "var(--green-600)", bg: "var(--green-50)" },
          { label: "Bảo trì",   value: counts.maintenance, color: "var(--amber-600)", bg: "var(--amber-50)" },
        ] as const).map(({ label, value, color, bg }, i, arr) => (
          <div key={label} style={{
            flex: 1, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10,
            borderRight: i < arr.length - 1 ? BD : "none",
            background: bg,
          }}>
            <span style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{value}</span>
            <span style={{ fontSize: 12, color: "var(--vn-text-3)", lineHeight: 1.3 }}>{label}<br/>phòng</span>
          </div>
        ))}
      </div>

      {/* ── Info bar (rates + surcharges) ───────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6,
        padding: "8px 14px", background: "var(--slate-50)", border: BD, borderRadius: 8,
        marginBottom: 14, fontSize: 12.5,
      }}>
        {/* Rates */}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--vn-text-2)", background: "var(--vn-surface)", border: BD, padding: "3px 9px", borderRadius: 999 }}>
          <Zap size={11} color="var(--amber-500)" />
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtRate(property.default_elec_rate)}₫/kWh</span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--vn-text-2)", background: "var(--vn-surface)", border: BD, padding: "3px 9px", borderRadius: 999 }}>
          <Droplets size={11} color="var(--blue-400)" />
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {fmtRate(property.default_water_rate)}₫/{property.water_calc_type === "per_meter" ? "m³" : property.water_calc_type === "per_person" ? "người" : "phòng"}
          </span>
          <span style={{ fontSize: 11, color: "var(--vn-text-3)" }}>({WATER_CALC_LABELS[property.water_calc_type]})</span>
        </span>

        {surcharges.length > 0 && (
          <span style={{ width: 1, height: 16, background: "var(--vn-border)", display: "inline-block", margin: "0 2px" }} />
        )}

        {/* Surcharges */}
        {surcharges.map(sc => (
          <span key={sc.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--violet-600)", background: "var(--violet-50)", border: "1px solid #ede9fe", padding: "3px 9px", borderRadius: 999 }}>
            <Tag size={10} />
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{sc.name}: {fmtMoney(sc.amount)}</span>
            <span style={{ fontSize: 11, color: "var(--violet-600)", opacity: 0.7 }}>
              /{sc.calc_type === "per_room" ? "phòng" : "người"}
            </span>
          </span>
        ))}

        {surcharges.length === 0 && (
          <span style={{ color: "var(--vn-text-3)", fontSize: 12 }}>Chưa có phụ phí</span>
        )}
      </div>

      {/* ── Filter bar ──────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 1 }}>
          {(Object.keys(STATUS_FILTER_LABELS) as StatusFilter[]).map((s, i, arr) => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              height: 32, padding: "0 12px", border: BD, cursor: "pointer",
              borderRadius: i === 0 ? "7px 0 0 7px" : i === arr.length - 1 ? "0 7px 7px 0" : "0",
              borderLeft: i > 0 ? "none" : BD,
              background: statusFilter === s ? "var(--blue-600)" : "var(--vn-surface)",
              color: statusFilter === s ? "#fff" : "var(--vn-text-2)",
              fontSize: 12.5, fontWeight: statusFilter === s ? 600 : 400,
              transition: "background .12s, color .12s",
            }}>
              {STATUS_FILTER_LABELS[s]}
              <span style={{
                marginLeft: 5, fontSize: 11, fontWeight: 600,
                background: statusFilter === s ? "rgba(255,255,255,.25)" : "var(--slate-100)",
                color: statusFilter === s ? "#fff" : "var(--vn-text-3)",
                padding: "1px 5px", borderRadius: 999,
              }}>
                {counts[s]}
              </span>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", height: 32, background: "var(--vn-surface)", border: BD, borderRadius: 7, padding: "0 10px", gap: 6, boxShadow: "var(--sh-xs)" }}>
          <Search size={12} color="var(--vn-text-3)" />
          <span style={{ fontSize: 12.5, color: "var(--vn-text-3)" }}>Tìm phòng…</span>
        </div>

        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--vn-text-3)" }}>
          {filtered.length} phòng
        </span>
      </div>

      {/* ── Rooms table ─────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={{ background: "var(--vn-surface)", border: BD, borderRadius: 12, padding: "40px 32px", textAlign: "center", boxShadow: "var(--sh-xs)" }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--blue-50)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
            <BedDouble size={20} color="var(--blue-600)" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--vn-text-2)", marginBottom: 5 }}>
            {statusFilter === "all" ? "Chưa có phòng nào" : `Không có phòng ${STATUS_FILTER_LABELS[statusFilter].toLowerCase()}`}
          </div>
          {statusFilter === "all" && <div style={{ fontSize: 13, color: "var(--vn-text-3)" }}>Thêm phòng đầu tiên.</div>}
        </div>
      ) : (
        <div style={{ background: "var(--vn-surface)", border: BD, borderRadius: 12, overflow: "hidden", boxShadow: "var(--sh-xs)" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13.5 }}>
            <thead>
              <tr>
                {["Phòng", "Loại", "Giá thuê", "Người thuê", "HĐ còn lại", "Số người", "Trạng thái", ""].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 14px", font: "600 11px var(--font-geist-sans)", color: "var(--vn-text-3)", letterSpacing: "0.04em", textTransform: "uppercase" as const, background: "var(--slate-50)", borderBottom: BD, whiteSpace: "nowrap" as const }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const c = r.active_contract;
                const isShared = sharedRoomIds.has(r.id);
                const bd = i < filtered.length - 1 ? BD : "none";
                const TD = (extra?: React.CSSProperties): React.CSSProperties => ({ padding: "11px 14px", borderBottom: bd, verticalAlign: "middle", ...extra });
                return (
                  <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/rooms/${r.id}`)} className="hover:bg-(--slate-50)">

                    {/* Phòng */}
                    <td style={TD()}>
                      <div style={{ fontWeight: 700, fontFamily: "var(--font-geist-mono)", fontSize: 13 }}>{r.room_number}</div>
                      {(r.floor || r.area_m2) && (
                        <div style={{ fontSize: 11, color: "var(--vn-text-3)", marginTop: 1 }}>
                          {[r.floor ? `T${r.floor}` : null, r.area_m2 ? `${r.area_m2}m²` : null].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </td>

                    {/* Loại phòng */}
                    <td style={TD()}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        height: 20, padding: "0 8px", borderRadius: 999,
                        fontSize: 11, fontWeight: 500,
                        background: isShared ? "var(--amber-50)"  : "var(--slate-100)",
                        color:      isShared ? "var(--amber-700)" : "var(--slate-600)",
                        border:     isShared ? "1px solid var(--amber-200)" : BD,
                        whiteSpace: "nowrap" as const,
                      }}>
                        {isShared ? "Vệ sinh chung" : "Khép kín"}
                      </span>
                    </td>

                    {/* Giá thuê */}
                    <td style={TD({ fontVariantNumeric: "tabular-nums" })}>
                      {c ? (
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--vn-text)" }}>{Number(c.agreed_rent).toLocaleString("vi-VN")}₫</div>
                          {c.agreed_rent !== r.rent_price && (
                            <div style={{ fontSize: 11, color: "var(--vn-text-3)", textDecoration: "line-through" }}>{Number(r.rent_price).toLocaleString("vi-VN")}₫</div>
                          )}
                        </div>
                      ) : <span style={{ color: "var(--vn-text-2)" }}>{Number(r.rent_price).toLocaleString("vi-VN")}₫</span>}
                    </td>

                    {/* Người thuê */}
                    <td style={TD()}>
                      {c ? <span style={{ color: "var(--vn-text)", fontSize: 13 }}>{c.tenant_name}</span>
                         : <span style={{ color: "var(--vn-text-3)" }}>—</span>}
                    </td>

                    {/* HĐ còn lại */}
                    <td style={TD()}>
                      {c ? <TimeLeft endDate={c.end_date} /> : <span style={{ color: "var(--vn-text-3)" }}>—</span>}
                    </td>

                    {/* Số người */}
                    <td style={TD({ color: "var(--vn-text-2)", textAlign: "center" })}>
                      {c ? c.num_people : <span style={{ color: "var(--vn-text-3)" }}>—</span>}
                    </td>

                    {/* Trạng thái */}
                    <td style={TD()}><RoomStatusBadge status={r.status} /></td>

                    {/* Actions */}
                    <td style={{ ...TD(), width: 40 }} onClick={e => e.stopPropagation()}>
                      <div style={{ position: "relative" }}>
                        <button onClick={() => setOpenMenu(openMenu === r.id ? null : r.id)} style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--vn-text-3)" }}>
                          <MoreVertical size={14} />
                        </button>
                        {openMenu === r.id && (
                          <div style={{ position: "absolute", right: 0, top: 32, zIndex: 10, background: "var(--vn-surface)", border: BD, borderRadius: 8, boxShadow: "var(--sh-md)", minWidth: 130, overflow: "hidden" }}>
                            {[
                              { label: "Chỉnh sửa", action: () => { setEditingRoom(r); setShowRoomForm(true); setOpenMenu(null); } },
                              { label: "Xóa", action: () => { setDeletingRoom(r); setOpenMenu(null); }, danger: true },
                            ].map(({ label, action, danger }) => (
                              <button key={label} onClick={action} style={{ display: "flex", alignItems: "center", width: "100%", padding: "9px 14px", background: "none", border: "none", fontSize: 13, cursor: "pointer", color: danger ? "var(--red-600)" : "var(--vn-text)", textAlign: "left" }}>{label}</button>
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
        </div>
      )}

      {/* ── Drawers & dialogs ───────────────────────────────────── */}
      <PropertyConfigDrawer
        open={showConfig}
        property={property}
        rooms={rooms}
        onClose={() => { setShowConfig(false); load(); }}
        onEditProperty={() => { setShowConfig(false); setShowEditProperty(true); }}
        onPropertyUpdated={p => setProperty(p)}
      />

      <Dialog open={showEditProperty} onOpenChange={o => { if (!o) setShowEditProperty(false); }}>
        <DialogContent className="sm:max-w-3xl" style={{ maxHeight: "90vh", overflowY: "auto" }}>
          <DialogHeader><DialogTitle>Chỉnh sửa nhà trọ</DialogTitle></DialogHeader>
          <PropertyForm property={property} onSuccess={p => { setProperty(p); setShowEditProperty(false); }} onCancel={() => setShowEditProperty(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={showRoomForm} onOpenChange={o => { if (!o) { setShowRoomForm(false); setEditingRoom(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingRoom ? "Chỉnh sửa phòng" : "Thêm phòng mới"}</DialogTitle></DialogHeader>
          <RoomForm propertyId={property.id} room={editingRoom ?? undefined} onSuccess={handleRoomSaved} onCancel={() => { setShowRoomForm(false); setEditingRoom(null); }} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingRoom} onOpenChange={o => { if (!o) { setDeletingRoom(null); setDeleteError(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa phòng {deletingRoom?.room_number}?</AlertDialogTitle>
            <AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p style={{ fontSize: 13, color: "var(--red-600)", padding: "0 4px" }}>{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleRoomDelete} className="bg-red-600 hover:bg-red-700">Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BillingModal propertyId={id} property={property} open={showBilling} onClose={() => setShowBilling(false)} initialTab={billingTab} />
    </div>
  );
}
