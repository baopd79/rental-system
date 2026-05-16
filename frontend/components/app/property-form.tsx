"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiJson } from "@/lib/api";
import type { Property, PropertyCreate, PropertyUpdate, WaterCalcType } from "@/types/property";
import { WATER_CALC_LABELS } from "@/types/property";

interface Props {
  property?: Property;
  onSuccess: (p: Property) => void;
  onCancel: () => void;
}

export function PropertyForm({ property, onSuccess, onCancel }: Props) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: property?.name ?? "",
    address: property?.address ?? "",
    description: property?.description ?? "",
    default_elec_rate: property?.default_elec_rate ?? "3500",
    default_water_rate: property?.default_water_rate ?? "15000",
    water_calc_type: (property?.water_calc_type ?? "per_meter") as WaterCalcType,
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await apiJson<Property>(
        property ? `/properties/${property.id}` : "/properties",
        getToken,
        { method: property ? "PUT" : "POST", body: form as PropertyCreate | PropertyUpdate }
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
      <div className="space-y-1">
        <Label htmlFor="name">Tên nhà *</Label>
        <Input id="name" value={form.name} onChange={set("name")} required placeholder="VD: Nhà trọ Quận 1" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="address">Địa chỉ *</Label>
        <Input id="address" value={form.address} onChange={set("address")} required placeholder="Số nhà, đường, quận..." />
      </div>
      <div className="space-y-1">
        <Label htmlFor="description">Mô tả</Label>
        <Textarea id="description" value={form.description} onChange={set("description")} rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="elec">Giá điện (đ/kWh)</Label>
          <Input id="elec" type="number" value={form.default_elec_rate} onChange={set("default_elec_rate")} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="water">Giá nước (đ/đơn vị)</Label>
          <Input id="water" type="number" value={form.default_water_rate} onChange={set("default_water_rate")} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="water_calc_type">Cách tính nước</Label>
        <select
          id="water_calc_type"
          value={form.water_calc_type}
          onChange={set("water_calc_type")}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {(Object.keys(WATER_CALC_LABELS) as WaterCalcType[]).map((key) => (
            <option key={key} value={key}>{WATER_CALC_LABELS[key]}</option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Hủy</Button>
        <Button type="submit" disabled={loading}>{loading ? "Đang lưu..." : property ? "Cập nhật" : "Tạo nhà"}</Button>
      </div>
    </form>
  );
}
