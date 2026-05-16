"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Plus, Building2, MapPin, Zap, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PropertyForm } from "@/components/app/property-form";
import { apiJson, apiFetch } from "@/lib/api";
import type { Property } from "@/types/property";

export default function PropertiesPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [deleting, setDeleting] = useState<Property | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiJson<Property[]>("/properties", getToken);
      setProperties(data);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  function handleSaved(p: Property) {
    setProperties((prev) =>
      editing ? prev.map((x) => (x.id === p.id ? p : x)) : [p, ...prev]
    );
    setShowForm(false);
    setEditing(null);
  }

  async function handleDelete() {
    if (!deleting) return;
    const res = await apiFetch(`/properties/${deleting.id}`, getToken, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      setDeleteError(err.detail ?? "Xóa thất bại");
      return;
    }
    setProperties((prev) => prev.filter((p) => p.id !== deleting.id));
    setDeleting(null);
    setDeleteError(null);
  }

  if (loading) return <div className="p-8 text-gray-500">Đang tải...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Quản lý nhà trọ</h1>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Thêm nhà
        </Button>
      </div>

      {properties.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>Chưa có nhà trọ nào. Thêm nhà đầu tiên!</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{p.name}</CardTitle>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <MapPin className="w-3 h-3" /> {p.address}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-xs text-gray-500 mb-3">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3" /> {Number(p.default_elec_rate).toLocaleString()}đ/kWh
                  </span>
                  <span className="flex items-center gap-1">
                    <Droplets className="w-3 h-3" /> {Number(p.default_water_rate).toLocaleString()}đ/m³
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => router.push(`/properties/${p.id}`)}>
                    Xem phòng
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditing(p); setShowForm(true); }}>
                    Sửa
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setDeleting(p)}>
                    Xóa
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditing(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Chỉnh sửa nhà trọ" : "Thêm nhà trọ mới"}</DialogTitle>
          </DialogHeader>
          <PropertyForm property={editing ?? undefined} onSuccess={handleSaved} onCancel={() => { setShowForm(false); setEditing(null); }} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) { setDeleting(null); setDeleteError(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa nhà trọ?</AlertDialogTitle>
            <AlertDialogDescription>
              Xóa &ldquo;{deleting?.name}&rdquo;. Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-sm text-red-600 px-1">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
