"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, Plus, Zap, Droplets, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiJson, apiFetch } from "@/lib/api";
import type { Room } from "@/types/room";
import type { UtilityReading } from "@/types/utility";
import type { Property } from "@/types/property";
import { UtilityReadingForm } from "@/components/app/utility-reading-form";

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function UtilityPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [readings, setReadings] = useState<UtilityReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UtilityReading | null>(null);
  const [deleting, setDeleting] = useState<UtilityReading | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await apiJson<Room>(`/rooms/${id}`, getToken);
      const [p, rs] = await Promise.all([
        apiJson<Property>(`/properties/${r.property_id}`, getToken),
        apiJson<UtilityReading[]>(`/rooms/${id}/utility-readings`, getToken),
      ]);
      setRoom(r);
      setProperty(p);
      setReadings(rs);
    } finally {
      setLoading(false);
    }
  }, [id, getToken]);

  useEffect(() => { load(); }, [load]);

  function handleSaved(r: UtilityReading) {
    setReadings((prev) =>
      editing ? prev.map((x) => (x.id === r.id ? r : x)) : [r, ...prev]
    );
    setShowForm(false);
    setEditing(null);
  }

  async function handleDelete() {
    if (!deleting) return;
    const res = await apiFetch(`/utility-readings/${deleting.id}`, getToken, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      setDeleteError(err.detail ?? "Xóa thất bại");
      return;
    }
    setReadings((prev) => prev.filter((r) => r.id !== deleting.id));
    setDeleting(null);
    setDeleteError(null);
  }

  const latestId = readings[0]?.id;
  const isPerMeter = property?.water_calc_type === "per_meter";

  if (loading) return (
    <div style={{ padding: 24, color: "var(--vn-text-3)", fontSize: 13.5 }}>Đang tải...</div>
  );
  if (!room) return (
    <div style={{ padding: 24, color: "var(--vn-text-3)", fontSize: 13.5 }}>Không tìm thấy phòng.</div>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => router.push(`/rooms/${id}`)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 13, color: "var(--vn-text-3)", background: "none",
            border: "none", cursor: "pointer", padding: 0, marginBottom: 10,
          }}
        >
          <ArrowLeft size={14} /> Phòng {room.room_number}
        </button>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.018em", color: "var(--vn-text)", margin: 0 }}>
              Chỉ số Điện/Nước — Phòng {room.room_number}
            </h1>
            <p style={{ fontSize: 13, color: "var(--vn-text-3)", marginTop: 3 }}>
              {readings.length} kỳ đã nhập
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
            <Plus size={15} color="#fff" /> Nhập chỉ số
          </button>
        </div>
      </div>

      {readings.length === 0 ? (
        <div style={{
          background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: 14, padding: "56px 32px", textAlign: "center", boxShadow: "var(--sh-xs)",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "var(--blue-50)", display: "grid",
            placeItems: "center", margin: "0 auto 16px",
          }}>
            <Zap size={22} color="var(--blue-600)" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--vn-text-2)", marginBottom: 6 }}>
            Chưa có chỉ số nào
          </div>
          <div style={{ fontSize: 13.5, color: "var(--vn-text-3)" }}>
            Nhập chỉ số đầu tiên để bắt đầu theo dõi.
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
                {[
                  "Kỳ",
                  "Điện đầu (kWh)", "Điện cuối (kWh)", "Tiêu thụ",
                  ...(isPerMeter ? ["Nước đầu (m³)", "Nước cuối (m³)", "Tiêu thụ nước"] : []),
                  "",
                ].map((h) => (
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
              {readings.map((r, i) => {
                const elecUsage = r.elec_prev != null ? Number(r.elec_curr) - Number(r.elec_prev) : null;
                const waterUsage = r.water_prev != null && r.water_curr != null
                  ? Number(r.water_curr) - Number(r.water_prev) : null;
                const isLatest = r.id === latestId;

                return (
                  <tr key={r.id}>
                    <td style={{ padding: "13px 16px", borderBottom: i < readings.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 600, fontFamily: "var(--font-geist-mono)", color: "var(--vn-text)" }}>{r.period}</span>
                        {!r.is_prev_auto && (
                          <span style={{
                            fontSize: 11, padding: "1px 7px", borderRadius: 999,
                            background: "var(--amber-50)", color: "var(--amber-700)",
                            border: "1px solid var(--amber-200)", fontWeight: 500,
                          }}>Thủ công</span>
                        )}
                      </div>
                    </td>

                    {/* Elec prev */}
                    <td style={{ padding: "13px 16px", borderBottom: i < readings.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", color: "var(--vn-text-2)", fontVariantNumeric: "tabular-nums" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Zap size={12} color="var(--vn-text-3)" />
                        {r.elec_prev != null ? Number(r.elec_prev).toLocaleString("vi-VN") : <span style={{ color: "var(--vn-text-3)" }}>—</span>}
                      </div>
                    </td>
                    {/* Elec curr */}
                    <td style={{ padding: "13px 16px", borderBottom: i < readings.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", fontVariantNumeric: "tabular-nums", fontWeight: 500, color: "var(--vn-text)" }}>
                      {Number(r.elec_curr).toLocaleString("vi-VN")}
                    </td>
                    {/* Elec usage */}
                    <td style={{ padding: "13px 16px", borderBottom: i < readings.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", fontVariantNumeric: "tabular-nums" }}>
                      {elecUsage != null ? (
                        <span style={{ color: "var(--blue-700)", fontWeight: 500 }}>+{elecUsage.toLocaleString("vi-VN")}</span>
                      ) : <span style={{ color: "var(--vn-text-3)" }}>—</span>}
                    </td>

                    {isPerMeter && (
                      <>
                        <td style={{ padding: "13px 16px", borderBottom: i < readings.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", color: "var(--vn-text-2)", fontVariantNumeric: "tabular-nums" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <Droplets size={12} color="var(--vn-text-3)" />
                            {r.water_prev != null ? Number(r.water_prev).toLocaleString("vi-VN") : <span style={{ color: "var(--vn-text-3)" }}>—</span>}
                          </div>
                        </td>
                        <td style={{ padding: "13px 16px", borderBottom: i < readings.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", fontVariantNumeric: "tabular-nums", fontWeight: 500, color: "var(--vn-text)" }}>
                          {r.water_curr != null ? Number(r.water_curr).toLocaleString("vi-VN") : <span style={{ color: "var(--vn-text-3)" }}>—</span>}
                        </td>
                        <td style={{ padding: "13px 16px", borderBottom: i < readings.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", fontVariantNumeric: "tabular-nums" }}>
                          {waterUsage != null ? (
                            <span style={{ color: "var(--blue-700)", fontWeight: 500 }}>+{waterUsage.toLocaleString("vi-VN")}</span>
                          ) : <span style={{ color: "var(--vn-text-3)" }}>—</span>}
                        </td>
                      </>
                    )}

                    <td style={{ padding: "13px 16px", borderBottom: i < readings.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", width: 80 }}>
                      {isLatest && (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            onClick={() => { setEditing(r); setShowForm(true); }}
                            style={{
                              width: 28, height: 28, borderRadius: 6, border: "none",
                              background: "var(--slate-100)", display: "grid",
                              placeItems: "center", cursor: "pointer", color: "var(--vn-text-2)",
                            }}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleting(r)}
                            style={{
                              width: 28, height: 28, borderRadius: 6, border: "none",
                              background: "var(--slate-100)", display: "grid",
                              placeItems: "center", cursor: "pointer", color: "var(--red-500)",
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditing(null); } }}>
        <DialogContent style={{ maxWidth: 460 }}>
          <DialogHeader>
            <DialogTitle>
              {editing ? `Chỉnh sửa kỳ ${editing.period}` : "Nhập chỉ số mới"}
            </DialogTitle>
          </DialogHeader>
          <UtilityReadingForm
            roomId={Number(id)}
            isPerMeter={isPerMeter}
            defaultPeriod={currentPeriod()}
            editing={editing ?? undefined}
            onSuccess={handleSaved}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) { setDeleting(null); setDeleteError(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa chỉ số kỳ {deleting?.period}?</AlertDialogTitle>
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
