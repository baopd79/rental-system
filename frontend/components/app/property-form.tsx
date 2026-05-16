"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiJson } from "@/lib/api";
import type { Property, PropertyCreate, PropertyUpdate } from "@/types/property";

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
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
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
          <Label htmlFor="water">Giá nước (đ/m³)</Label>
          <Input id="water" type="number" value={form.default_water_rate} onChange={set("default_water_rate")} />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Hủy</Button>
        <Button type="submit" disabled={loading}>{loading ? "Đang lưu..." : property ? "Cập nhật" : "Tạo nhà"}</Button>
      </div>
    </form>
  );
}
