"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiJson } from "@/lib/api";
import type { Contract } from "@/types/contract";
import type { Invoice } from "@/types/invoice";
import type { Room } from "@/types/room";
import type { Property } from "@/types/property";

type Props = {
  onSuccess: (inv: Invoice) => void;
  onCancel: () => void;
  defaultContractId?: number;
};

const FIELD_STYLE: React.CSSProperties = {
  width: "100%", height: 36, padding: "0 10px",
  border: "1px solid var(--vn-border)", borderRadius: 8,
  fontSize: 13.5, color: "var(--vn-text)",
  background: "var(--vn-surface)", outline: "none", boxSizing: "border-box",
};
const LABEL_STYLE: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 500, color: "var(--vn-text-2)", marginBottom: 5, display: "block",
};

type ContractOption = { contract: Contract; room: Room; property: Property };

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function InvoiceGenerateForm({ onSuccess, onCancel, defaultContractId }: Props) {
  const { getToken } = useAuth();
  const [options, setOptions] = useState<ContractOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contractId, setContractId] = useState(defaultContractId ? String(defaultContractId) : "");
  const [period, setPeriod] = useState(currentPeriod());

  useEffect(() => {
    (async () => {
      try {
        const properties = await apiJson<Property[]>("/properties", getToken);
        const opts: ContractOption[] = [];
        for (const prop of properties) {
          const rooms = await apiJson<Room[]>(`/properties/${prop.id}/rooms`, getToken);
          for (const room of rooms.filter(r => r.status === "occupied")) {
            const contracts = await apiJson<Contract[]>(`/rooms/${room.id}/contracts`, getToken);
            const active = contracts.find(c => c.status === "active");
            if (active) opts.push({ contract: active, room, property: prop });
          }
        }
        setOptions(opts);
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contractId) { setError("Vui lòng chọn hợp đồng"); return; }
    setError(null);
    setSaving(true);
    try {
      const result = await apiJson<Invoice>("/invoices/generate", getToken, {
        method: "POST",
        body: { contract_id: Number(contractId), period },
      });
      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label style={LABEL_STYLE}>Hợp đồng *</label>
        {loading ? (
          <div style={{ fontSize: 13, color: "var(--vn-text-3)" }}>Đang tải…</div>
        ) : options.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--amber-600)", padding: "8px 0" }}>
            Không có phòng nào đang có hợp đồng active.
          </div>
        ) : (
          <select value={contractId} onChange={e => setContractId(e.target.value)}
            style={{ ...FIELD_STYLE, cursor: "pointer" }}>
            <option value="">— Chọn phòng / hợp đồng —</option>
            {options.map(({ contract, room, property }) => (
              <option key={contract.id} value={contract.id}>
                {property.name} · P.{room.room_number} · {contract.tenant.full_name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label style={LABEL_STYLE}>Kỳ thanh toán *</label>
        <input type="month" required value={period} onChange={e => setPeriod(e.target.value)} style={FIELD_STYLE} />
      </div>

      {error && <p style={{ fontSize: 13, color: "var(--red-600)", margin: 0 }}>{error}</p>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
        <button type="button" onClick={onCancel} style={{
          height: 36, padding: "0 16px", borderRadius: 8,
          border: "1px solid var(--vn-border)", background: "var(--vn-surface)",
          fontSize: 13.5, cursor: "pointer", color: "var(--vn-text-2)",
        }}>Hủy</button>
        <button type="submit" disabled={saving || loading} style={{
          height: 36, padding: "0 18px", borderRadius: 8,
          background: "var(--blue-600)", color: "#fff",
          fontSize: 13.5, fontWeight: 500, border: "none", cursor: "pointer",
          opacity: saving ? 0.7 : 1,
        }}>
          {saving ? "Đang tạo…" : "Tạo hóa đơn"}
        </button>
      </div>
    </form>
  );
}
