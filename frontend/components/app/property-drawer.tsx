"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  X, MapPin, Zap, Droplets, Users, DoorOpen,
  ArrowRight, Share2, Tag,
} from "lucide-react";
import { apiJson } from "@/lib/api";
import type { Property } from "@/types/property";
import { WATER_CALC_LABELS } from "@/types/property";
import type { Surcharge } from "@/types/surcharge";
import { SURCHARGE_CALC_LABELS } from "@/types/surcharge";
import type { SharedMeter } from "@/types/shared-meter";

interface PropertyStats {
  total_rooms: number;
  occupied_rooms: number;
  monthly_revenue: number;
}

interface Props {
  property: Property | null;
  stats?: PropertyStats;
  onClose: () => void;
}

const BD = "1px solid var(--vn-border)";
const fmtMoney = (n: number | string) => Number(n).toLocaleString("vi-VN") + "₫";
const fmtRate = (n: number | string) => {
  const v = Number(n);
  return v >= 1000 ? (v / 1000).toLocaleString("vi-VN") + "k" : v.toLocaleString("vi-VN");
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 650, color: "var(--slate-400)",
      textTransform: "uppercase", letterSpacing: "0.07em",
      marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

export function PropertyDrawer({ property, stats, onClose }: Props) {
  const { getToken } = useAuth();
  const router = useRouter();
  const open = property !== null;

  const [surcharges, setSurcharges] = useState<Surcharge[]>([]);
  const [sharedMeters, setSharedMeters] = useState<SharedMeter[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(false);

  const load = useCallback(async (id: number) => {
    setLoadingExtra(true);
    try {
      const [sc, sm] = await Promise.all([
        apiJson<Surcharge[]>(`/properties/${id}/surcharges`, getToken),
        apiJson<SharedMeter[]>(`/properties/${id}/shared-meters`, getToken),
      ]);
      setSurcharges(sc);
      setSharedMeters(sm);
    } catch {
      setSurcharges([]); setSharedMeters([]);
    } finally {
      setLoadingExtra(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (property) load(property.id);
    else { setSurcharges([]); setSharedMeters([]); }
  }, [property, load]);

  // ESC key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handler); document.body.style.overflow = ""; };
  }, [open, onClose]);

  const pct = stats && stats.total_rooms > 0
    ? Math.round((stats.occupied_rooms / stats.total_rooms) * 100)
    : 0;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 400,
          background: "rgba(15,23,42,.20)",
          backdropFilter: "blur(2px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity .22s ease",
        }}
      />

      {/* Drawer */}
      <div className="vn-drawer" style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 520,
        zIndex: 401,
        background: "var(--vn-surface)",
        boxShadow: "var(--sh-pop)",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform .26s cubic-bezier(.4,0,.2,1)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>

        {/* ── Header ────────────────────────────────────────────── */}
        {property && (
          <div style={{ padding: "18px 22px 16px", borderBottom: BD, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: "var(--vn-text)", letterSpacing: "-0.018em", marginBottom: 4 }}>
                  {property.name}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--vn-text-3)" }}>
                  <MapPin size={12} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {property.address}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 30, height: 30, borderRadius: 7, border: BD,
                  background: "var(--vn-surface)", display: "grid", placeItems: "center",
                  cursor: "pointer", color: "var(--vn-text-2)", flexShrink: 0,
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── Body ──────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
          {property && (
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

              {/* Phòng / Tỷ lệ lấp đầy */}
              {stats && (
                <div>
                  <SectionLabel>Phòng</SectionLabel>
                  <div style={{
                    background: "var(--slate-50)", border: BD, borderRadius: 10,
                    padding: "14px 16px", display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr", gap: 12,
                  }}>
                    {[
                      { label: "Tổng",     value: stats.total_rooms,                           color: "var(--vn-text)" },
                      { label: "Đang thuê", value: stats.occupied_rooms,                        color: "var(--blue-600)" },
                      { label: "Trống",    value: stats.total_rooms - stats.occupied_rooms,    color: "var(--green-600)" },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{value}</div>
                        <div style={{ fontSize: 11.5, color: "var(--vn-text-3)", marginTop: 2 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Occupancy bar */}
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--vn-text-3)", marginBottom: 5 }}>
                      <span>Tỷ lệ lấp đầy</span>
                      <span style={{ fontWeight: 600, color: pct >= 80 ? "var(--green-600)" : "var(--blue-600)" }}>{pct}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: "var(--slate-150)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 99,
                        width: `${pct}%`,
                        background: pct >= 80 ? "var(--green-600)" : "var(--blue-600)",
                        transition: "width .4s ease",
                      }} />
                    </div>
                  </div>
                  {stats.monthly_revenue > 0 && (
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5 }}>
                      <span style={{ color: "var(--vn-text-3)" }}>Doanh thu tháng này</span>
                      <span style={{ fontWeight: 700, color: "var(--vn-text)", fontVariantNumeric: "tabular-nums" }}>
                        {fmtMoney(stats.monthly_revenue)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Cấu hình đơn giá */}
              <div>
                <SectionLabel>Cấu hình đơn giá</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", background: "var(--slate-50)", border: BD,
                    borderRadius: 8, fontSize: 13.5,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--vn-text-2)" }}>
                      <Zap size={14} color="var(--amber-500)" />
                      <span>Giá điện</span>
                    </div>
                    <span style={{ fontWeight: 600, color: "var(--vn-text)", fontVariantNumeric: "tabular-nums" }}>
                      {fmtMoney(property.default_elec_rate)}<span style={{ fontSize: 12, color: "var(--vn-text-3)", fontWeight: 400 }}>/kWh</span>
                    </span>
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", background: "var(--slate-50)", border: BD,
                    borderRadius: 8, fontSize: 13.5,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--vn-text-2)" }}>
                      <Droplets size={14} color="var(--blue-400)" />
                      <span>Giá nước</span>
                      <span style={{ fontSize: 11.5, color: "var(--vn-text-3)", background: "var(--slate-200)", padding: "1px 7px", borderRadius: 999 }}>
                        {WATER_CALC_LABELS[property.water_calc_type]}
                      </span>
                    </div>
                    <span style={{ fontWeight: 600, color: "var(--vn-text)", fontVariantNumeric: "tabular-nums" }}>
                      {fmtMoney(property.default_water_rate)}
                      <span style={{ fontSize: 12, color: "var(--vn-text-3)", fontWeight: 400 }}>
                        {property.water_calc_type === "per_meter" ? "/m³" : property.water_calc_type === "per_person" ? "/người" : "/phòng"}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Phụ phí */}
              <div>
                <SectionLabel>Phụ phí áp dụng</SectionLabel>
                {loadingExtra ? (
                  <div style={{ fontSize: 13, color: "var(--vn-text-3)" }}>Đang tải...</div>
                ) : surcharges.length === 0 ? (
                  <div style={{
                    padding: "14px 16px", border: BD, borderRadius: 8, textAlign: "center",
                    fontSize: 13, color: "var(--vn-text-3)", background: "var(--slate-50)",
                  }}>
                    Chưa có phụ phí nào
                  </div>
                ) : (
                  <div style={{ border: BD, borderRadius: 8, overflow: "hidden" }}>
                    {surcharges.map((sc, i) => (
                      <div key={sc.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 14px", fontSize: 13.5,
                        borderBottom: i < surcharges.length - 1 ? BD : "none",
                        background: "var(--vn-surface)",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Tag size={13} color="var(--violet-600)" />
                          <span style={{ color: "var(--vn-text)", fontWeight: 500 }}>{sc.name}</span>
                          <span style={{ fontSize: 11.5, color: "var(--vn-text-3)", background: "var(--slate-100)", padding: "1px 7px", borderRadius: 999 }}>
                            {SURCHARGE_CALC_LABELS[sc.calc_type]}
                          </span>
                        </div>
                        <span style={{ fontWeight: 600, color: "var(--vn-text)", fontVariantNumeric: "tabular-nums" }}>
                          {fmtMoney(sc.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Công tơ điện chung */}
              <div>
                <SectionLabel>Công tơ điện chung</SectionLabel>
                {loadingExtra ? (
                  <div style={{ fontSize: 13, color: "var(--vn-text-3)" }}>Đang tải...</div>
                ) : sharedMeters.length === 0 ? (
                  <div style={{
                    padding: "14px 16px", border: BD, borderRadius: 8, textAlign: "center",
                    fontSize: 13, color: "var(--vn-text-3)", background: "var(--slate-50)",
                  }}>
                    Chưa có công tơ chung nào
                  </div>
                ) : (
                  <div style={{ border: BD, borderRadius: 8, overflow: "hidden" }}>
                    {sharedMeters.map((m, i) => (
                      <div key={m.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 14px", fontSize: 13.5,
                        borderBottom: i < sharedMeters.length - 1 ? BD : "none",
                        background: "var(--vn-surface)",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Share2 size={13} color="var(--amber-600)" />
                          <span style={{ color: "var(--vn-text)", fontWeight: 500 }}>{m.name}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--vn-text-3)" }}>
                          <DoorOpen size={11} />
                          <span>{m.room_ids.length} phòng</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────── */}
        {property && (
          <div style={{
            padding: "14px 22px", borderTop: BD, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "var(--vn-surface)",
          }}>
            <button
              onClick={onClose}
              style={{
                height: 36, padding: "0 16px", borderRadius: 8,
                border: BD, background: "var(--vn-surface)",
                fontSize: 13.5, cursor: "pointer", color: "var(--vn-text-2)", fontWeight: 500,
              }}
            >
              Đóng
            </button>
            <button
              onClick={() => { onClose(); router.push(`/properties/${property.id}`); }}
              style={{
                height: 36, padding: "0 18px", borderRadius: 8,
                background: "var(--blue-600)", color: "#fff",
                fontSize: 13.5, fontWeight: 600, border: "none", cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 7,
                boxShadow: "0 1px 0 rgba(255,255,255,.18) inset, var(--sh-sm)",
              }}
            >
              Xem chi tiết
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
