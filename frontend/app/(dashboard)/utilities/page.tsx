"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Zap, Droplets, ChevronRight } from "lucide-react";
import { apiJson } from "@/lib/api";
import { BillingModal } from "@/components/app/billing-modal";
import type { Property } from "@/types/property";

interface PropertyStats {
  id: number;
  total_rooms: number;
  occupied_rooms: number;
  monthly_revenue: number;
}

const fmtRate = (n: number | string) => {
  const v = Number(n);
  return v >= 1000 ? (v / 1000).toLocaleString("vi-VN") + "k" : v.toLocaleString("vi-VN");
};

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function UtilitiesPage() {
  const { getToken } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [stats, setStats]           = useState<Map<number, PropertyStats>>(new Map());
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<Property | null>(null);

  const load = useCallback(async () => {
    try {
      const [props, statsArr] = await Promise.all([
        apiJson<Property[]>("/properties", getToken),
        apiJson<PropertyStats[]>("/properties/stats", getToken),
      ]);
      setProperties(props);
      setStats(new Map(statsArr.map(s => [s.id, s])));
    } finally { setLoading(false); }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  const period = currentPeriod();
  const [y, m] = period.split("-");
  const periodLabel = `Tháng ${Number(m)}/${y}`;

  if (loading) return <div style={{ padding: 24, color: "var(--vn-text-3)", fontSize: 13 }}>Đang tải...</div>;

  return (
    <div style={{ padding: "20px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "var(--vn-text-3)", marginBottom: 4 }}>Tài chính › Chỉ số Điện/Nước</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.022em", color: "var(--vn-text)", margin: 0 }}>
          Ghi chỉ số Điện/Nước
        </h1>
        <p style={{ fontSize: 13, color: "var(--vn-text-3)", marginTop: 3 }}>
          Nhập chỉ số công tơ cuối {periodLabel} để tính tiền cho tháng sau.
        </p>
      </div>

      {/* Info note */}
      <div style={{
        padding: "10px 14px", borderRadius: 8, marginBottom: 16,
        background: "var(--blue-50)", border: "1px solid var(--blue-200)",
        fontSize: 13, color: "var(--blue-700)",
        display: "flex", alignItems: "flex-start", gap: 8,
      }}>
        <Zap size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Chỉ số nhập cho kỳ <strong>{periodLabel}</strong> sẽ dùng để tính điện/nước trực tiếp trong
          hoá đơn <strong>{periodLabel}</strong>. Số đầu kỳ tự động lấy từ kỳ trước.
        </span>
      </div>

      {/* Property list */}
      {properties.length === 0 ? (
        <div style={{ background: "var(--vn-surface)", border: "1px solid var(--vn-border)", borderRadius: 12, padding: "48px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "var(--vn-text-3)" }}>Chưa có nhà trọ nào.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {properties.map(p => {
            const s = stats.get(p.id);
            return (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 18px",
                background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
                borderRadius: 10, boxShadow: "var(--sh-xs)",
              }}>
                {/* Icon */}
                <div style={{ width: 38, height: 38, borderRadius: 9, background: "var(--amber-50)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Zap size={18} color="var(--amber-600)" />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--vn-text)", marginBottom: 3 }}>{p.name}</div>
                  <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--vn-text-3)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Zap size={10} color="var(--amber-500)" />
                      {fmtRate(p.default_elec_rate)}₫/kWh
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Droplets size={10} color="var(--blue-400)" />
                      {fmtRate(p.default_water_rate)}₫/{p.water_calc_type === "per_meter" ? "m³" : p.water_calc_type === "per_person" ? "người" : "phòng"}
                    </span>
                    {s && (
                      <span style={{ color: "var(--vn-text-3)" }}>
                        {s.occupied_rooms}/{s.total_rooms} phòng đang thuê
                      </span>
                    )}
                  </div>
                </div>

                {/* Action */}
                <button
                  onClick={() => setSelected(p)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    height: 34, padding: "0 14px", borderRadius: 8,
                    background: "var(--blue-600)", color: "#fff",
                    fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
                    boxShadow: "0 1px 0 rgba(255,255,255,.15) inset",
                    flexShrink: 0,
                  }}
                >
                  Ghi chỉ số <ChevronRight size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Billing modal — reading mode */}
      <BillingModal
        propertyId={selected ? String(selected.id) : ""}
        property={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
        initialTab="readings"
      />
    </div>
  );
}
