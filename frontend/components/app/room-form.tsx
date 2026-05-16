"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiJson } from "@/lib/api";
import type { Room, RoomCreate, RoomUpdate } from "@/types/room";

interface Props {
  propertyId: number;
  room?: Room;
  defaultElecRate?: string;
  defaultWaterRate?: string;
  onSuccess: (r: Room) => void;
  onCancel: () => void;
}

export function RoomForm({ propertyId, room, defaultElecRate, defaultWaterRate, onSuccess, onCancel }: Props) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    room_number: room?.room_number ?? "",
    floor: room?.floor?.toString() ?? "",
    area_m2: room?.area_m2 ?? "",
    rent_price: room?.rent_price ?? "",
    deposit: room?.deposit ?? "0",
    elec_rate: room?.elec_rate ?? "",
    water_rate: room?.water_rate ?? "",
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload: RoomCreate | RoomUpdate = {
        room_number: form.room_number,
        ...(form.floor ? { floor: parseInt(form.floor) } : {}),
        ...(form.area_m2 ? { area_m2: form.area_m2 } : {}),
        rent_price: form.rent_price,
        deposit: form.deposit,
        ...(form.elec_rate ? { elec_rate: form.elec_rate } : {}),
        ...(form.water_rate ? { water_rate: form.water_rate } : {}),
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="room_number">Số phòng *</Label>
          <Input id="room_number" value={form.room_number} onChange={set("room_number")} required placeholder="101" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="floor">Tầng</Label>
          <Input id="floor" type="number" value={form.floor} onChange={set("floor")} placeholder="1" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="area">Diện tích (m²)</Label>
          <Input id="area" type="number" value={form.area_m2} onChange={set("area_m2")} placeholder="25" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="deposit">Tiền cọc (đ)</Label>
          <Input id="deposit" type="number" value={form.deposit} onChange={set("deposit")} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="rent_price">Giá thuê/tháng (đ) *</Label>
        <Input id="rent_price" type="number" value={form.rent_price} onChange={set("rent_price")} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="elec_rate">Giá điện (đ/kWh)</Label>
          <Input id="elec_rate" type="number" value={form.elec_rate} onChange={set("elec_rate")}
            placeholder={`mặc định: ${defaultElecRate ?? "theo nhà"}`} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="water_rate">Giá nước (đ/m³)</Label>
          <Input id="water_rate" type="number" value={form.water_rate} onChange={set("water_rate")}
            placeholder={`mặc định: ${defaultWaterRate ?? "theo nhà"}`} />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Hủy</Button>
        <Button type="submit" disabled={loading}>{loading ? "Đang lưu..." : room ? "Cập nhật" : "Tạo phòng"}</Button>
      </div>
    </form>
  );
}
