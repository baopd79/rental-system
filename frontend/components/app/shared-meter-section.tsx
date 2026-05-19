"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Plus, Trash2, ChevronDown, Share2 } from "lucide-react";
import { apiJson, apiFetch } from "@/lib/api";
import type { SharedMeter } from "@/types/shared-meter";
import type { Room } from "@/types/room";

interface Props {
  propertyId: number;
  rooms: Room[];
}

const BD = "1px solid var(--vn-border)";

export function SharedMeterSection({ propertyId, rooms }: Props) {
  const { getToken } = useAuth();
  const [meters, setMeters] = useState<SharedMeter[]>([]);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openRooms, setOpenRooms] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    apiJson<SharedMeter[]>(`/properties/${propertyId}/shared-meters`, getToken)
      .then(setMeters).catch(() => {});
  }, [propertyId, getToken]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const m = await apiJson<SharedMeter>(`/properties/${propertyId}/shared-meters`, getToken, {
        method: "POST", body: { name: newName.trim() },
      });
      setMeters(prev => [...prev, m]);
      setNewName(""); setAdding(false);
    } finally { setSaving(false); }
  }

  async function handleDelete(meterId: number) {
    setDeleteError(null);
    const res = await apiFetch(`/shared-meters/${meterId}`, getToken, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      setDeleteError(err.detail ?? "Xoá thất bại");
      return;
    }
    setMeters(prev => prev.filter(m => m.id !== meterId));
  }

  async function toggleRoom(meter: SharedMeter, roomId: number) {
    const isAssigned = meter.room_ids.includes(roomId);
    const updated = await apiJson<SharedMeter>(
      `/shared-meters/${meter.id}/rooms${isAssigned ? `/${roomId}` : ""}`,
      getToken,
      {
        method: isAssigned ? "DELETE" : "POST",
        ...(!isAssigned ? { body: { room_id: roomId } } : {}),
      },
    ).catch(() => null);
    if (updated) setMeters(prev => prev.map(m => m.id === meter.id ? updated : m));
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Share2 size={12} color="var(--amber-500)" />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--vn-text-3)", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
            Công tơ điện chung
          </span>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            height: 26, padding: "0 10px", borderRadius: 6,
            background: "transparent", border: BD, cursor: "pointer",
            fontSize: 12, color: "var(--vn-text-2)", fontWeight: 500,
          }}>
            <Plus size={12} /> Thêm
          </button>
        )}
      </div>

      {meters.length === 0 && !adding && (
        <p style={{ fontSize: 12.5, color: "var(--vn-text-3)", margin: 0 }}>Chưa có công tơ chung nào.</p>
      )}

      {meters.map(meter => (
        <div key={meter.id} style={{ marginBottom: 6, border: BD, borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px" }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--vn-text)" }}>{meter.name}</span>
            <span style={{ fontSize: 12, color: "var(--vn-text-3)" }}>
              {meter.room_ids.length > 0
                ? rooms.filter(r => meter.room_ids.includes(r.id)).map(r => `P.${r.room_number}`).join(", ")
                : "Chưa gán phòng"}
            </span>
            <button
              onClick={() => setOpenRooms(openRooms === meter.id ? null : meter.id)}
              style={{ height: 26, padding: "0 8px", borderRadius: 6, border: BD, background: "var(--vn-surface)", cursor: "pointer", fontSize: 12, color: "var(--vn-text-2)", display: "flex", alignItems: "center", gap: 3 }}
            >
              Phòng <ChevronDown size={11} style={{ transform: openRooms === meter.id ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
            </button>
            <button onClick={() => handleDelete(meter.id)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--red-200)", background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--red-600)" }}>
              <Trash2 size={12} />
            </button>
          </div>
          {openRooms === meter.id && (
            <div style={{ borderTop: BD, padding: "8px 12px", display: "flex", flexWrap: "wrap", gap: 6, background: "var(--slate-50)" }}>
              {rooms.map(room => {
                const checked = meter.room_ids.includes(room.id);
                return (
                  <button key={room.id} onClick={() => toggleRoom(meter, room.id)} style={{
                    height: 26, padding: "0 10px", borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: 500,
                    border: checked ? "1px solid var(--blue-300)" : BD,
                    background: checked ? "var(--blue-50)" : "var(--vn-surface)",
                    color: checked ? "var(--blue-700)" : "var(--vn-text-2)",
                  }}>
                    P.{room.room_number}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {adding && (
        <form onSubmit={handleCreate} style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <input
            autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="VD: Điện NVS tầng 1"
            style={{ flex: 1, height: 32, padding: "0 10px", border: BD, borderRadius: 7, fontSize: 13, color: "var(--vn-text)", background: "var(--vn-surface)", outline: "none" }}
          />
          <button type="submit" disabled={saving} style={{ height: 32, padding: "0 12px", borderRadius: 7, background: "var(--blue-600)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
            {saving ? "…" : "Lưu"}
          </button>
          <button type="button" onClick={() => { setAdding(false); setNewName(""); }} style={{ height: 32, padding: "0 10px", borderRadius: 7, background: "transparent", border: BD, cursor: "pointer", fontSize: 13, color: "var(--vn-text-2)" }}>
            Hủy
          </button>
        </form>
      )}
      {deleteError && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--red-600)", padding: "6px 10px", background: "var(--red-50)", borderRadius: 6, border: "1px solid var(--red-200)" }}>
          {deleteError}
        </div>
      )}
    </div>
  );
}
