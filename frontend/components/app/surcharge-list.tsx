"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiJson, apiFetch } from "@/lib/api";
import type { Surcharge, SurchargeCalcType } from "@/types/surcharge";
import { SURCHARGE_CALC_LABELS } from "@/types/surcharge";

type Props = { propertyId: number; compact?: boolean; inline?: boolean };

const FIELD: React.CSSProperties = {
  height: 34, padding: "0 10px",
  border: "1px solid var(--vn-border)", borderRadius: 7,
  fontSize: 13, color: "var(--vn-text)",
  background: "var(--vn-surface)", outline: "none",
  boxSizing: "border-box",
};

const BD = "1px solid var(--vn-border)";

// ── inline form (add / edit inside drawer) ─────────────────────────
function InlineForm({
  propertyId, editing, onSuccess, onCancel,
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
    name:      editing?.name ?? "",
    calc_type: (editing?.calc_type ?? "per_room") as SurchargeCalcType,
    amount:    editing ? String(editing.amount) : "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const body = { name: form.name, calc_type: form.calc_type, amount: Number(form.amount) };
      const result = editing
        ? await apiJson<Surcharge>(`/surcharges/${editing.id}`, getToken, { method: "PUT", body })
        : await apiJson<Surcharge>(`/properties/${propertyId}/surcharges`, getToken, { method: "POST", body });
      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} style={{
      background: "var(--slate-50)", border: BD, borderRadius: 8,
      padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          required autoFocus value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder="Tên phụ phí"
          style={{ ...FIELD, flex: 1 }}
        />
        <select
          value={form.calc_type}
          onChange={e => setForm(p => ({ ...p, calc_type: e.target.value as SurchargeCalcType }))}
          style={{ ...FIELD, width: 120, cursor: "pointer" }}
        >
          <option value="per_room">Theo phòng</option>
          <option value="per_person">Theo người</option>
        </select>
        <input
          required type="number" min={0} value={form.amount}
          onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
          placeholder="Số tiền ₫"
          style={{ ...FIELD, width: 110, fontVariantNumeric: "tabular-nums" }}
        />
      </div>
      {error && <p style={{ fontSize: 12, color: "var(--red-600)", margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={{ height: 30, padding: "0 12px", borderRadius: 6, border: BD, background: "transparent", fontSize: 12.5, cursor: "pointer", color: "var(--vn-text-2)", display: "flex", alignItems: "center", gap: 4 }}>
          <X size={12} /> Hủy
        </button>
        <button type="submit" disabled={saving} style={{ height: 30, padding: "0 14px", borderRadius: 6, background: "var(--blue-600)", color: "#fff", fontSize: 12.5, fontWeight: 600, border: "none", cursor: "pointer", opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", gap: 4 }}>
          <Check size={12} /> {saving ? "…" : editing ? "Lưu" : "Thêm"}
        </button>
      </div>
    </form>
  );
}

// ── dialog form (legacy, used outside drawer) ──────────────────────
function DialogForm({
  propertyId, editing, onSuccess, onCancel,
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
    name:      editing?.name ?? "",
    calc_type: (editing?.calc_type ?? "per_room") as SurchargeCalcType,
    amount:    editing ? String(editing.amount) : "",
  });

  const FIELD_LG: React.CSSProperties = { width: "100%", height: 36, padding: "0 10px", border: BD, borderRadius: 8, fontSize: 13.5, color: "var(--vn-text)", background: "var(--vn-surface)", outline: "none", boxSizing: "border-box" };
  const LBL: React.CSSProperties = { fontSize: 12.5, fontWeight: 500, color: "var(--vn-text-2)", marginBottom: 5, display: "block" };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      const body = { name: form.name, calc_type: form.calc_type, amount: Number(form.amount) };
      const result = editing
        ? await apiJson<Surcharge>(`/surcharges/${editing.id}`, getToken, { method: "PUT", body })
        : await apiJson<Surcharge>(`/properties/${propertyId}/surcharges`, getToken, { method: "POST", body });
      onSuccess(result);
    } catch (err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div><label style={LBL}>Tên phụ phí *</label><input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={FIELD_LG} placeholder="VD: Phí wifi, Phí rác" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label style={LBL}>Cách tính *</label><select value={form.calc_type} onChange={e => setForm(p => ({ ...p, calc_type: e.target.value as SurchargeCalcType }))} style={{ ...FIELD_LG, cursor: "pointer" }}><option value="per_room">Theo phòng</option><option value="per_person">Theo người</option></select></div>
        <div><label style={LBL}>Số tiền (₫) *</label><input required type="number" min={0} value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} style={FIELD_LG} placeholder="100000" /></div>
      </div>
      {error && <p style={{ fontSize: 13, color: "var(--red-600)", margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
        <button type="button" onClick={onCancel} style={{ height: 36, padding: "0 16px", borderRadius: 8, border: BD, background: "var(--vn-surface)", fontSize: 13.5, cursor: "pointer", color: "var(--vn-text-2)" }}>Hủy</button>
        <button type="submit" disabled={saving} style={{ height: 36, padding: "0 18px", borderRadius: 8, background: "var(--blue-600)", color: "#fff", fontSize: 13.5, fontWeight: 500, border: "none", cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Thêm phụ phí"}
        </button>
      </div>
    </form>
  );
}

// ── main component ─────────────────────────────────────────────────
export function SurchargeList({ propertyId, compact = false, inline = false }: Props) {
  const { getToken } = useAuth();
  const [surcharges, setSurcharges] = useState<Surcharge[]>([]);
  const [loading,    setLoading]    = useState(true);

  // dialog-mode state
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState<Surcharge | null>(null);
  const [deleting,   setDeleting]   = useState<Surcharge | null>(null);
  const [deleteError,setDeleteError]= useState<string | null>(null);

  // inline-mode state
  const [inlineMode, setInlineMode] = useState<"add" | "edit" | null>(null);
  const [inlineEdit, setInlineEdit] = useState<Surcharge | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [deleting2,  setDeleting2]  = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiJson<Surcharge[]>(`/properties/${propertyId}/surcharges`, getToken);
      setSurcharges(data);
    } finally { setLoading(false); }
  }, [propertyId, getToken]);

  useEffect(() => { load(); }, [load]);

  function handleSaved(s: Surcharge) {
    setSurcharges(prev => editing || inlineEdit ? prev.map(x => x.id === s.id ? s : x) : [...prev, s]);
    setShowForm(false); setEditing(null);
    setInlineMode(null); setInlineEdit(null);
  }

  async function handleDelete() {
    if (!deleting) return;
    const res = await apiFetch(`/surcharges/${deleting.id}`, getToken, { method: "DELETE" });
    if (!res.ok) { const err = await res.json().catch(() => ({ detail: res.statusText })); setDeleteError(err.detail ?? "Xóa thất bại"); return; }
    setSurcharges(prev => prev.filter(x => x.id !== deleting.id));
    setDeleting(null); setDeleteError(null);
  }

  async function handleInlineDelete(id: number) {
    setDeleting2(true);
    const res = await apiFetch(`/surcharges/${id}`, getToken, { method: "DELETE" });
    setDeleting2(false);
    if (res.ok) { setSurcharges(prev => prev.filter(x => x.id !== id)); setConfirmDel(null); }
  }

  if (loading) return <div style={{ fontSize: 13, color: "var(--vn-text-3)" }}>Đang tải…</div>;

  // ── compact mode ──────────────────────────────────────────────────
  if (compact) {
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
          {surcharges.map(s => (
            <div key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 10px", borderRadius: 7, background: "var(--slate-100)", border: BD, fontSize: 12.5, color: "var(--vn-text-2)" }}>
              <span style={{ fontWeight: 500, color: "var(--vn-text)" }}>{s.name}</span>
              <span style={{ color: "var(--vn-text-3)" }}>·</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{Number(s.amount).toLocaleString("vi-VN")}₫</span>
              <span style={{ fontSize: 11, color: "var(--vn-text-3)" }}>/{s.calc_type === "per_person" ? "người" : "phòng"}</span>
              <div style={{ display: "flex", gap: 2, marginLeft: 2 }}>
                <button onClick={() => { setEditing(s); setShowForm(true); }} style={{ width: 18, height: 18, borderRadius: 4, border: "none", padding: 0, background: "transparent", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--vn-text-3)" }}><Pencil size={11} /></button>
                <button onClick={() => { setDeleting(s); setDeleteError(null); }} style={{ width: 18, height: 18, borderRadius: 4, border: "none", padding: 0, background: "transparent", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--red-400)" }}><Trash2 size={11} /></button>
              </div>
            </div>
          ))}
          <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 28, padding: "0 10px", borderRadius: 7, background: "transparent", border: "1px dashed var(--vn-border)", fontSize: 12.5, color: "var(--vn-text-3)", cursor: "pointer" }}>
            <Plus size={12} /> Thêm
          </button>
          {surcharges.length === 0 && <span style={{ fontSize: 12.5, color: "var(--vn-text-3)" }}>Chưa có phụ phí</span>}
        </div>
        {/* compact still uses dialogs since it's not inside a drawer */}
        <Dialog open={showForm} onOpenChange={o => { if (!o) { setShowForm(false); setEditing(null); } }}>
          <DialogContent style={{ maxWidth: 420 }}>
            <DialogHeader><DialogTitle>{editing ? "Chỉnh sửa phụ phí" : "Thêm phụ phí"}</DialogTitle></DialogHeader>
            <DialogForm propertyId={propertyId} editing={editing ?? undefined} onSuccess={handleSaved} onCancel={() => { setShowForm(false); setEditing(null); }} />
          </DialogContent>
        </Dialog>
        <AlertDialog open={!!deleting} onOpenChange={o => { if (!o) { setDeleting(null); setDeleteError(null); } }}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Xóa phụ phí &ldquo;{deleting?.name}&rdquo;?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader>
            {deleteError && <p style={{ fontSize: 13, color: "var(--red-600)", padding: "0 4px" }}>{deleteError}</p>}
            <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Xóa</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // ── inline mode (inside drawer — no popup) ─────────────────────────
  if (inline) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {surcharges.length === 0 && inlineMode !== "add" && (
          <div style={{ padding: "12px 14px", border: "1px dashed var(--vn-border)", borderRadius: 8, textAlign: "center", fontSize: 13, color: "var(--vn-text-3)" }}>
            Chưa có phụ phí nào
          </div>
        )}

        {surcharges.map(s => {
          // Edit mode for this row
          if (inlineMode === "edit" && inlineEdit?.id === s.id) {
            return (
              <InlineForm key={s.id} propertyId={propertyId} editing={s}
                onSuccess={handleSaved}
                onCancel={() => { setInlineMode(null); setInlineEdit(null); }}
              />
            );
          }
          // Delete confirm for this row
          if (confirmDel === s.id) {
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--red-50)", border: "1px solid var(--red-200)", borderRadius: 8, gap: 10 }}>
                <span style={{ fontSize: 13, color: "var(--red-700)" }}>Xóa &ldquo;{s.name}&rdquo;?</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setConfirmDel(null)} style={{ height: 28, padding: "0 10px", borderRadius: 6, border: BD, background: "var(--vn-surface)", fontSize: 12.5, cursor: "pointer", color: "var(--vn-text-2)" }}>Hủy</button>
                  <button onClick={() => handleInlineDelete(s.id)} disabled={deleting2} style={{ height: 28, padding: "0 12px", borderRadius: 6, background: "var(--red-600)", color: "#fff", fontSize: 12.5, fontWeight: 600, border: "none", cursor: "pointer" }}>
                    {deleting2 ? "…" : "Xóa"}
                  </button>
                </div>
              </div>
            );
          }
          // Normal row
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", background: "var(--vn-surface)", border: BD, borderRadius: 8 }}>
              <div>
                <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--vn-text)" }}>{s.name}</span>
                <span style={{ marginLeft: 8, fontSize: 11.5, color: "var(--vn-text-3)", background: "var(--slate-100)", padding: "1px 7px", borderRadius: 999 }}>
                  {SURCHARGE_CALC_LABELS[s.calc_type]}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 13.5, fontVariantNumeric: "tabular-nums", color: "var(--vn-text)" }}>
                  {Number(s.amount).toLocaleString("vi-VN")}₫
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => { setInlineEdit(s); setInlineMode("edit"); setConfirmDel(null); }} style={{ width: 28, height: 28, borderRadius: 6, border: BD, background: "transparent", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--vn-text-3)" }}><Pencil size={13} /></button>
                  <button onClick={() => { setConfirmDel(s.id); setInlineMode(null); setInlineEdit(null); }} style={{ width: 28, height: 28, borderRadius: 6, border: BD, background: "transparent", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--red-500)" }}><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add form */}
        {inlineMode === "add" ? (
          <InlineForm propertyId={propertyId}
            onSuccess={handleSaved}
            onCancel={() => setInlineMode(null)}
          />
        ) : (
          <button
            onClick={() => { setInlineMode("add"); setInlineEdit(null); setConfirmDel(null); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 32, padding: "0 12px", borderRadius: 7, border: "1px dashed var(--vn-border)", background: "transparent", fontSize: 13, color: "var(--vn-text-3)", cursor: "pointer", fontWeight: 500 }}
          >
            <Plus size={13} /> Thêm phụ phí
          </button>
        )}
      </div>
    );
  }

  // ── default full mode (dialog) ─────────────────────────────────────
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--vn-text)", margin: 0 }}>Phụ phí</h2>
        <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 32, padding: "0 12px", borderRadius: 7, background: "var(--blue-600)", color: "#fff", fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer" }}>
          <Plus size={13} color="#fff" /> Thêm phụ phí
        </button>
      </div>

      {surcharges.length === 0 ? (
        <div style={{ background: "var(--vn-surface)", border: "1px dashed var(--vn-border)", borderRadius: 10, padding: "24px", textAlign: "center", fontSize: 13.5, color: "var(--vn-text-3)" }}>
          Chưa có phụ phí nào. Thêm phụ phí để tự động đưa vào hóa đơn.
        </div>
      ) : (
        <div style={{ background: "var(--vn-surface)", border: BD, borderRadius: 12, overflow: "hidden", boxShadow: "var(--sh-xs)" }}>
          {surcharges.map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: i < surcharges.length - 1 ? BD : "none" }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 13.5, color: "var(--vn-text)" }}>{s.name}</div>
                <div style={{ fontSize: 12, color: "var(--vn-text-3)", marginTop: 2 }}>{SURCHARGE_CALC_LABELS[s.calc_type]}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--vn-text)" }}>{Number(s.amount).toLocaleString("vi-VN")}₫</span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => { setEditing(s); setShowForm(true); }} style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "var(--slate-100)", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--vn-text-2)" }}><Pencil size={13} /></button>
                  <button onClick={() => { setDeleting(s); setDeleteError(null); }} style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "var(--slate-100)", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--red-500)" }}><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={o => { if (!o) { setShowForm(false); setEditing(null); } }}>
        <DialogContent style={{ maxWidth: 420 }}>
          <DialogHeader><DialogTitle>{editing ? "Chỉnh sửa phụ phí" : "Thêm phụ phí"}</DialogTitle></DialogHeader>
          <DialogForm propertyId={propertyId} editing={editing ?? undefined} onSuccess={handleSaved} onCancel={() => { setShowForm(false); setEditing(null); }} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={o => { if (!o) { setDeleting(null); setDeleteError(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Xóa phụ phí &ldquo;{deleting?.name}&rdquo;?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader>
          {deleteError && <p style={{ fontSize: 13, color: "var(--red-600)", padding: "0 4px" }}>{deleteError}</p>}
          <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Xóa</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
