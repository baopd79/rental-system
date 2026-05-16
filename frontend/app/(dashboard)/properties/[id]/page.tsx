"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, Plus, BedDouble, Zap, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RoomStatusBadge } from "@/components/app/room-status-badge";
import { RoomForm } from "@/components/app/room-form";
import { apiJson, apiFetch } from "@/lib/api";
import type { Property } from "@/types/property";
import { WATER_CALC_LABELS } from "@/types/property";
import type { Room } from "@/types/room";

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
    await apiFetch(`/rooms/${deleting.id}`, getToken, { method: "DELETE" });
    setRooms((prev) => prev.filter((r) => r.id !== deleting.id));
    setDeleting(null);
  }

  const stats = {
    total: rooms.length,
    vacant: rooms.filter((r) => r.status === "vacant").length,
    occupied: rooms.filter((r) => r.status === "occupied").length,
    maintenance: rooms.filter((r) => r.status === "maintenance").length,
  };

  if (loading) return <div className="p-8 text-gray-500">Đang tải...</div>;
  if (!property) return <div className="p-8 text-gray-500">Không tìm thấy nhà trọ.</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/properties")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Quay lại
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{property.name}</h1>
          <p className="text-sm text-gray-500">{property.address}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Tổng phòng", value: stats.total, color: "text-gray-700" },
          { label: "Đang trống", value: stats.vacant, color: "text-green-600" },
          { label: "Đang thuê", value: stats.occupied, color: "text-blue-600" },
          { label: "Bảo trì", value: stats.maintenance, color: "text-red-500" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Danh sách phòng</h2>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Thêm phòng
        </Button>
      </div>

      {rooms.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <BedDouble className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>Chưa có phòng nào. Thêm phòng đầu tiên!</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((r) => (
            <Card key={r.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Phòng {r.room_number}</CardTitle>
                  <RoomStatusBadge status={r.status} />
                </div>
                {r.floor && <p className="text-xs text-gray-400">Tầng {r.floor}{r.area_m2 ? ` · ${r.area_m2} m²` : ""}</p>}
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium mb-2">
                  {Number(r.rent_price).toLocaleString("vi-VN")}đ/tháng
                </p>
                <div className="flex gap-3 text-xs text-gray-500 mb-3">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    {Number(r.effective_elec_rate).toLocaleString()}đ/kWh
                    {!r.elec_rate && <span className="text-gray-400">(mặc định)</span>}
                  </span>
                  <span className="flex items-center gap-1">
                    <Droplets className="w-3 h-3" />
                    {Number(r.effective_water_rate).toLocaleString()}đ · {property && WATER_CALC_LABELS[property.water_calc_type]}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(r); setShowForm(true); }}>Sửa</Button>
                  <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setDeleting(r)}>Xóa</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa phòng {deleting?.room_number}?</AlertDialogTitle>
            <AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
