"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiJson, apiFetch } from "@/lib/api";
import type { Surcharge, SurchargeCalcType } from "@/types/surcharge";
import { SURCHARGE_CALC_LABELS } from "@/types/surcharge";

type Props = { propertyId: number };

const FIELD_STYLE: React.CSSProperties = {
  width: "100%", height: 36, padding: "0 10px",
  border: "1px solid var(--vn-border)", borderRadius: 8,
  fontSize: 13.5, color: "var(--vn-text)",
  background: "var(--vn-surface)", outline: "none",
  boxSizing: "border-box",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 500, color: "var(--vn-text-2)", marginBottom: 5, display: "block",
};

function SurchargeForm({
  propertyId,
  editing,
  onSuccess,
  onCancel,
}: {
  propertyId: number;
  editing?: Surcharge;
  onSuccess: (s: Surcharge) => void;
  onCancel: () => void;
}) {
  const { getToken } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: editing?.name ?? "",
    calc_type: (editing?.calc_type ?? "per_room") as SurchargeCalcType,
    amount: editing ? String(editing.amount) : "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = { name: form.name, calc_type: form.calc_type, amount: Number(form.amount) };
      const result = editing
        ? await apiJson<Surcharge>(`/surcharges/${editing.id}`, getToken, { method: "PUT", body })
        : await apiJson<Surcharge>(`/properties/${propertyId}/surcharges`, getToken, { method: "POST", body });
      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={LABEL_STYLE}>Tên phụ phí *</label>
        <input required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          style={FIELD_STYLE} placeholder="VD: Phí wifi, Phí rác" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={LABEL_STYLE}>Cách tính *</label>
          <select value={form.calc_type} onChange={(e) => setForm((p) => ({ ...p, calc_type: e.target.value as SurchargeCalcType }))}
            style={{ ...FIELD_STYLE, cursor: "pointer" }}>
            <option value="per_room">Theo phòng</option>
            <option value="per_person">Theo người</option>
          </select>
        </div>
        <div>
          <label style={LABEL_STYLE}>Số tiền (₫) *</label>
          <input required type="number" min={0} value={form.amount}
            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            style={FIELD_STYLE} placeholder="100000" />
        </div>
      </div>
      {error && <p style={{ fontSize: 13, color: "var(--red-600)", margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
        <button type="button" onClick={onCancel} style={{
          height: 36, padding: "0 16px", borderRadius: 8,
          border: "1px solid var(--vn-border)", background: "var(--vn-surface)",
          fontSize: 13.5, cursor: "pointer", color: "var(--vn-text-2)",
        }}>Hủy</button>
        <button type="submit" disabled={saving} style={{
          height: 36, padding: "0 18px", borderRadius: 8,
          background: "var(--blue-600)", color: "#fff",
          fontSize: 13.5, fontWeight: 500, border: "none", cursor: "pointer",
          opacity: saving ? 0.7 : 1,
        }}>
          {saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Thêm phụ phí"}
        </button>
      </div>
    </form>
  );
}

export function SurchargeList({ propertyId }: Props) {
  const { getToken } = useAuth();
  const [surcharges, setSurcharges] = useState<Surcharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Surcharge | null>(null);
  const [deleting, setDeleting] = useState<Surcharge | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiJson<Surcharge[]>(`/properties/${propertyId}/surcharges`, getToken);
      setSurcharges(data);
    } finally {
      setLoading(false);
    }
  }, [propertyId, getToken]);

  useEffect(() => { load(); }, [load]);

  function handleSaved(s: Surcharge) {
    setSurcharges((prev) =>
      editing ? prev.map((x) => (x.id === s.id ? s : x)) : [...prev, s]
    );
    setShowForm(false);
    setEditing(null);
  }

  async function handleDelete() {
    if (!deleting) return;
    const res = await apiFetch(`/surcharges/${deleting.id}`, getToken, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      setDeleteError(err.detail ?? "Xóa thất bại");
      return;
    }
    setSurcharges((prev) => prev.filter((x) => x.id !== deleting.id));
    setDeleting(null);
    setDeleteError(null);
  }

  if (loading) return <div style={{ fontSize: 13, color: "var(--vn-text-3)" }}>Đang tải…</div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--vn-text)", margin: 0 }}>Phụ phí</h2>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            height: 32, padding: "0 12px", borderRadius: 7,
            background: "var(--blue-600)", color: "#fff",
            fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer",
          }}
        >
          <Plus size={13} color="#fff" /> Thêm phụ phí
        </button>
      </div>

      {surcharges.length === 0 ? (
        <div style={{
          background: "var(--vn-surface)", border: "1px dashed var(--vn-border)",
          borderRadius: 10, padding: "24px", textAlign: "center",
          fontSize: 13.5, color: "var(--vn-text-3)",
        }}>
          Chưa có phụ phí nào. Thêm phụ phí để tự động đưa vào hóa đơn.
        </div>
      ) : (
        <div style={{
          background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: 12, overflow: "hidden", boxShadow: "var(--sh-xs)",
        }}>
          {surcharges.map((s, i) => (
            <div key={s.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: i < surcharges.length - 1 ? "1px solid var(--vn-border)" : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13.5, color: "var(--vn-text)" }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: "var(--vn-text-3)", marginTop: 2 }}>
                    {SURCHARGE_CALC_LABELS[s.calc_type]}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--vn-text)" }}>
                  {Number(s.amount).toLocaleString("vi-VN")}₫
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => { setEditing(s); setShowForm(true); }} style={{
                    width: 28, height: 28, borderRadius: 6, border: "none",
                    background: "var(--slate-100)", display: "grid",
                    placeItems: "center", cursor: "pointer", color: "var(--vn-text-2)",
                  }}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => { setDeleting(s); setDeleteError(null); }} style={{
                    width: 28, height: 28, borderRadius: 6, border: "none",
                    background: "var(--slate-100)", display: "grid",
                    placeItems: "center", cursor: "pointer", color: "var(--red-500)",
                  }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditing(null); } }}>
        <DialogContent style={{ maxWidth: 420 }}>
          <DialogHeader>
            <DialogTitle>{editing ? "Chỉnh sửa phụ phí" : "Thêm phụ phí"}</DialogTitle>
          </DialogHeader>
          <SurchargeForm
            propertyId={propertyId}
            editing={editing ?? undefined}
            onSuccess={handleSaved}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) { setDeleting(null); setDeleteError(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa phụ phí &ldquo;{deleting?.name}&rdquo;?</AlertDialogTitle>
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
