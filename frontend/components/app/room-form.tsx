"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiJson } from "@/lib/api";
import type { Room, RoomCreate, RoomUpdate } from "@/types/room";

interface Props {
  propertyId: number;
  room?: Room;
  onSuccess: (r: Room) => void;
  onCancel: () => void;
}

function fmtNum(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("vi-VN");
}

export function RoomForm({ propertyId, room, onSuccess, onCancel }: Props) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    room_number: room?.room_number ?? "",
    floor: room?.floor?.toString() ?? "",
    area_m2: room?.area_m2 ?? "",
    rent_price: fmtNum(room?.rent_price ?? ""),
    deposit: fmtNum(room?.deposit ?? ""),
  });

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = (field === "rent_price" || field === "deposit")
        ? fmtNum(e.target.value)
        : e.target.value;
      setForm(f => ({ ...f, [field]: val }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload: RoomCreate | RoomUpdate = {
        room_number: form.room_number,
        ...(form.floor ? { floor: parseInt(form.floor) } : {}),
        ...(form.area_m2 ? { area_m2: form.area_m2 } : {}),
        rent_price: form.rent_price.replace(/\D/g, "") || "0",
        deposit: form.deposit.replace(/\D/g, "") || "0",
      };
      const result = await apiJson<Room>(
        room ? `/rooms/${room.id}` : `/properties/${propertyId}/rooms`,
        getToken,
        { method: room ? "PUT" : "POST", body: payload }
      );
      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  const FIELD = "w-full h-[34px] px-[10px] border border-[var(--vn-border)] rounded-[7px] text-[13px] text-[var(--vn-text)] bg-[var(--vn-surface)] outline-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="room_number">Số phòng *</Label>
          <input id="room_number" className={FIELD} value={form.room_number} onChange={set("room_number")} required placeholder="101" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="floor">Tầng</Label>
          <input id="floor" type="number" className={FIELD} value={form.floor} onChange={set("floor")} placeholder="1" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="area">Diện tích (m²)</Label>
          <input id="area" type="number" className={FIELD} value={form.area_m2} onChange={set("area_m2")} placeholder="25" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="deposit">Tiền cọc (đ)</Label>
          <input id="deposit" className={FIELD} value={form.deposit} onChange={set("deposit")} placeholder="7.000.000" inputMode="numeric" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="rent_price">Giá thuê/tháng (đ) *</Label>
        <input id="rent_price" className={FIELD} value={form.rent_price} onChange={set("rent_price")} required placeholder="3.500.000" inputMode="numeric" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Hủy</Button>
        <Button type="submit" disabled={loading}>{loading ? "Đang lưu..." : room ? "Cập nhật" : "Tạo phòng"}</Button>
      </div>
    </form>
  );
}
