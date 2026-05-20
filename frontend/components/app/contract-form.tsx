"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Search, Check, UserPlus, Users } from "lucide-react";
import { apiJson } from "@/lib/api";
import type { Tenant } from "@/types/tenant";
import type { Contract } from "@/types/contract";

type Props = {
  roomId: number;
  propertyId: number;
  defaultRent: number;
  defaultDeposit: number;
  waterCalcType?: "per_meter" | "per_person" | "per_room";
  onSuccess: (c: Contract) => void;
  onCancel: () => void;
};

const FIELD: React.CSSProperties = {
  width: "100%", height: 36, padding: "0 10px",
  border: "1px solid var(--vn-border)", borderRadius: 8,
  fontSize: 13.5, color: "var(--vn-text)",
  background: "var(--vn-surface)", outline: "none", boxSizing: "border-box",
};

const LABEL: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 500, color: "var(--vn-text-2)", marginBottom: 5, display: "block",
};

type TenantMode = "existing" | "new";
type TenantFilter = "property" | "all";

export function ContractForm({ roomId, propertyId, defaultRent, defaultDeposit, waterCalcType, onSuccess, onCancel }: Props) {
  const { getToken } = useAuth();
  const [tenantMode, setTenantMode] = useState<TenantMode>("existing");
  const [tenantFilter, setTenantFilter] = useState<TenantFilter>("property");
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [propertyTenants, setPropertyTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const nextYear = new Date(Date.now() + 365 * 864e5).toISOString().split("T")[0];

  const [contract, setContract] = useState({
    start_date: today, end_date: nextYear,
    agreed_rent: String(defaultRent), deposit: String(defaultDeposit), num_people: "1",
  });
  const [newTenant, setNewTenant] = useState({
    full_name: "", phone: "", cccd: "", email: "", date_of_birth: "",
  });
  const [initialElec, setInitialElec] = useState("");
  const [initialWater, setInitialWater] = useState("");

  useEffect(() => {
    Promise.all([
      apiJson<Tenant[]>("/tenants", getToken),
      apiJson<Tenant[]>(`/tenants?property_id=${propertyId}`, getToken),
    ]).then(([all, prop]) => {
      setAllTenants(all);
      setPropertyTenants(prop);
    }).catch(() => {});
  }, [getToken, propertyId]);

  const displayTenants = (tenantFilter === "property" ? propertyTenants : allTenants)
    .filter(t => {
      const q = search.toLowerCase();
      return !q || t.full_name.toLowerCase().includes(q) || (t.phone ?? "").includes(q);
    });

  function setC(k: keyof typeof contract, v: string) {
    setContract(p => ({ ...p, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (tenantMode === "existing" && !selectedTenant) {
      setError("Vui lòng chọn khách thuê");
      return;
    }
    if (tenantMode === "new" && !newTenant.full_name.trim()) {
      setError("Vui lòng nhập họ tên khách thuê");
      return;
    }
    if (initialElec === "") {
      setError("Vui lòng nhập chỉ số điện đầu kỳ");
      return;
    }
    if (waterCalcType === "per_meter" && initialWater === "") {
      setError("Vui lòng nhập chỉ số nước đầu kỳ");
      return;
    }

    setSaving(true);
    try {
      let tenantId: number;

      if (tenantMode === "new") {
        const created = await apiJson<Tenant>("/tenants", getToken, {
          method: "POST",
          body: {
            full_name: newTenant.full_name.trim(),
            phone: newTenant.phone || null,
            cccd: newTenant.cccd || null,
            email: newTenant.email || null,
            date_of_birth: newTenant.date_of_birth || null,
          },
        });
        tenantId = created.id;
      } else {
        tenantId = selectedTenant!.id;
      }

      const result = await apiJson<Contract>("/contracts", getToken, {
        method: "POST",
        body: {
          room_id: roomId,
          tenant_id: tenantId,
          start_date: contract.start_date,
          end_date: contract.end_date,
          agreed_rent: Number(contract.agreed_rent),
          deposit: Number(contract.deposit),
          num_people: Number(contract.num_people),
          initial_elec_curr: initialElec !== "" ? Number(initialElec) : null,
          initial_water_curr: (waterCalcType === "per_meter" && initialWater !== "") ? Number(initialWater) : null,
        },
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

      {/* Tenant section */}
      <div>
        {/* Mode tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 12, borderRadius: 8, overflow: "hidden", border: "1px solid var(--vn-border)" }}>
          {([
            { mode: "existing" as TenantMode, label: "Chọn khách có sẵn", icon: Users },
            { mode: "new" as TenantMode, label: "Thêm khách mới", icon: UserPlus },
          ]).map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              type="button"
              onClick={() => { setTenantMode(mode); setError(null); }}
              style={{
                flex: 1, height: 36, border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                fontSize: 13, fontWeight: tenantMode === mode ? 600 : 400,
                background: tenantMode === mode ? "var(--blue-600)" : "var(--vn-surface)",
                color: tenantMode === mode ? "#fff" : "var(--vn-text-2)",
              }}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {tenantMode === "existing" ? (
          <div>
            {/* Filter + Search row */}
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ display: "flex", borderRadius: 7, overflow: "hidden", border: "1px solid var(--vn-border)", flexShrink: 0 }}>
                {([
                  { f: "property" as TenantFilter, label: "Nhà này" },
                  { f: "all" as TenantFilter, label: "Tất cả" },
                ]).map(({ f, label }) => (
                  <button key={f} type="button" onClick={() => setTenantFilter(f)} style={{
                    height: 32, padding: "0 12px", border: "none", cursor: "pointer",
                    fontSize: 12.5, fontWeight: tenantFilter === f ? 600 : 400,
                    background: tenantFilter === f ? "var(--blue-50)" : "var(--vn-surface)",
                    color: tenantFilter === f ? "var(--blue-700)" : "var(--vn-text-3)",
                    borderRight: f === "property" ? "1px solid var(--vn-border)" : "none",
                  }}>
                    {label}
                  </button>
                ))}
              </div>
              <div style={{
                flex: 1, display: "flex", alignItems: "center", gap: 7,
                height: 32, background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
                borderRadius: 7, padding: "0 10px",
              }}>
                <Search size={13} color="var(--vn-text-3)" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm tên, SĐT…"
                  style={{ flex: 1, border: "none", outline: "none", fontSize: 13, background: "transparent", color: "var(--vn-text)" }}
                />
              </div>
            </div>

            {/* Tenant list */}
            <div style={{
              border: "1px solid var(--vn-border)", borderRadius: 8,
              maxHeight: 180, overflowY: "auto",
            }}>
              {displayTenants.length === 0 ? (
                <div style={{ padding: "14px 12px", fontSize: 13, color: "var(--vn-text-3)", textAlign: "center" }}>
                  {tenantFilter === "property"
                    ? "Chưa có khách nào thuộc nhà này. Chuyển sang \"Tất cả\" hoặc thêm mới."
                    : "Không tìm thấy khách thuê."}
                </div>
              ) : displayTenants.map((t, i) => {
                const isSelected = selectedTenant?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTenant(t)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "9px 12px", cursor: "pointer",
                      borderBottom: i < displayTenants.length - 1 ? "1px solid var(--vn-border)" : "none",
                      background: isSelected ? "var(--blue-50)" : "var(--vn-surface)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                        background: isSelected ? "var(--blue-200)" : "var(--slate-100)",
                        color: isSelected ? "var(--blue-700)" : "var(--vn-text-3)",
                        display: "grid", placeItems: "center",
                        fontSize: 11, fontWeight: 700,
                      }}>
                        {t.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: isSelected ? 600 : 400, color: isSelected ? "var(--blue-800)" : "var(--vn-text)" }}>
                          {t.full_name}
                        </div>
                        {t.phone && <div style={{ fontSize: 12, color: "var(--vn-text-3)" }}>{t.phone}</div>}
                      </div>
                    </div>
                    {isSelected && <Check size={15} color="var(--blue-600)" />}
                  </div>
                );
              })}
            </div>
            {!selectedTenant && (
              <p style={{ fontSize: 12, color: "var(--vn-text-3)", margin: "5px 0 0" }}>Chưa chọn khách thuê</p>
            )}
            {selectedTenant && (
              <p style={{ fontSize: 12, color: "var(--blue-600)", margin: "5px 0 0", fontWeight: 500 }}>
                ✓ Đã chọn: {selectedTenant.full_name}
              </p>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={LABEL}>Họ và tên *</label>
              <input required value={newTenant.full_name}
                onChange={e => setNewTenant(p => ({ ...p, full_name: e.target.value }))}
                style={FIELD} placeholder="Nguyễn Văn A" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={LABEL}>SĐT</label>
                <input value={newTenant.phone}
                  onChange={e => setNewTenant(p => ({ ...p, phone: e.target.value }))}
                  style={FIELD} placeholder="0901234567" />
              </div>
              <div>
                <label style={LABEL}>CCCD</label>
                <input value={newTenant.cccd}
                  onChange={e => setNewTenant(p => ({ ...p, cccd: e.target.value }))}
                  style={FIELD} placeholder="012345678901" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid var(--vn-border)" }} />

      {/* Contract fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={LABEL}>Ngày bắt đầu *</label>
          <input type="date" required value={contract.start_date}
            onChange={e => setC("start_date", e.target.value)} style={FIELD} />
        </div>
        <div>
          <label style={LABEL}>Ngày kết thúc *</label>
          <input type="date" required value={contract.end_date}
            onChange={e => setC("end_date", e.target.value)} style={FIELD} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <label style={LABEL}>Giá thuê (₫) *</label>
          <input type="number" required min={0} value={contract.agreed_rent}
            onChange={e => setC("agreed_rent", e.target.value)} style={FIELD} />
        </div>
        <div>
          <label style={LABEL}>Tiền cọc (₫)</label>
          <input type="number" min={0} value={contract.deposit}
            onChange={e => setC("deposit", e.target.value)} style={FIELD} />
        </div>
        <div>
          <label style={LABEL}>Số người *</label>
          <input type="number" required min={1} value={contract.num_people}
            onChange={e => setC("num_people", e.target.value)} style={FIELD} />
        </div>
      </div>

      {/* Initial meter readings */}
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--vn-text-2)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Chỉ số đầu kỳ <span style={{ color: "var(--red-500)" }}>*</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: waterCalcType === "per_meter" ? "1fr 1fr" : "1fr", gap: 12 }}>
          <div>
            <label style={LABEL}>Điện (kWh) *</label>
            <input
              type="number" min={0} required value={initialElec}
              onChange={e => setInitialElec(e.target.value)}
              style={FIELD} placeholder="VD: 1250"
            />
          </div>
          {waterCalcType === "per_meter" && (
            <div>
              <label style={LABEL}>Nước (m³) *</label>
              <input
                type="number" min={0} required value={initialWater}
                onChange={e => setInitialWater(e.target.value)}
                style={FIELD} placeholder="VD: 45"
              />
            </div>
          )}
        </div>
        <p style={{ fontSize: 12, color: "var(--vn-text-3)", margin: "5px 0 0" }}>
          Chỉ số đồng hồ lúc bàn giao phòng. Tháng đầu nhập chỉ số cuối bằng đầu = 0 tiêu thụ, hoặc lớn hơn nếu khách đã dùng.
        </p>
      </div>

      {error && <p style={{ fontSize: 13, color: "var(--red-600)", margin: 0 }}>{error}</p>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
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
          {saving ? "Đang tạo…" : "Tạo hợp đồng"}
        </button>
      </div>
    </form>
  );
}
