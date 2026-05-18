"use client";

import { useEffect } from "react";
import { X, Zap, Droplets, Pencil } from "lucide-react";
import { SurchargeList } from "@/components/app/surcharge-list";
import type { Property } from "@/types/property";
import { WATER_CALC_LABELS } from "@/types/property";
import { SharedMeterSection } from "@/components/app/shared-meter-section";
import type { Room } from "@/types/room";

interface Props {
  open: boolean;
  property: Property;
  rooms: Room[];
  onClose: () => void;
  onEditProperty: () => void;
}

const BD = "1px solid var(--vn-border)";
const fmtMoney = (n: number | string) => Number(n).toLocaleString("vi-VN") + "₫";

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 10.5, fontWeight: 650, color: "var(--slate-400)",
        textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

export function PropertyConfigDrawer({ open, property, rooms, onClose, onEditProperty }: Props) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 400,
          background: "rgba(15,23,42,.18)",
          backdropFilter: "blur(2px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity .2s ease",
        }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 480,
        zIndex: 401,
        background: "var(--vn-surface)",
        boxShadow: "var(--sh-pop)",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform .25s cubic-bezier(.4,0,.2,1)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: BD, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--vn-text)", letterSpacing: "-0.015em" }}>Cấu hình</div>
            <div style={{ fontSize: 12, color: "var(--vn-text-3)", marginTop: 2 }}>{property.name}</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, border: BD, background: "var(--vn-surface)", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--vn-text-2)" }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Đơn giá */}
          <Section label="Đơn giá">
            <div style={{ border: BD, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderBottom: BD, background: "var(--vn-surface)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                  <Zap size={14} color="var(--amber-500)" />
                  <span style={{ color: "var(--vn-text-2)" }}>Giá điện</span>
                </div>
                <span style={{ fontWeight: 600, fontSize: 13.5, color: "var(--vn-text)", fontVariantNumeric: "tabular-nums" }}>
                  {fmtMoney(property.default_elec_rate)}<span style={{ fontSize: 12, color: "var(--vn-text-3)", fontWeight: 400 }}>/kWh</span>
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", background: "var(--vn-surface)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                  <Droplets size={14} color="var(--blue-400)" />
                  <span style={{ color: "var(--vn-text-2)" }}>Giá nước</span>
                  <span style={{ fontSize: 11, background: "var(--slate-100)", color: "var(--slate-600)", padding: "1px 7px", borderRadius: 999 }}>
                    {WATER_CALC_LABELS[property.water_calc_type]}
                  </span>
                </div>
                <span style={{ fontWeight: 600, fontSize: 13.5, color: "var(--vn-text)", fontVariantNumeric: "tabular-nums" }}>
                  {fmtMoney(property.default_water_rate)}
                  <span style={{ fontSize: 12, color: "var(--vn-text-3)", fontWeight: 400 }}>
                    {property.water_calc_type === "per_meter" ? "/m³" : property.water_calc_type === "per_person" ? "/người" : "/phòng"}
                  </span>
                </span>
              </div>
            </div>
            <button
              onClick={onEditProperty}
              style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, height: 28, padding: "0 12px", borderRadius: 6, border: BD, background: "transparent", cursor: "pointer", fontSize: 12.5, color: "var(--vn-text-2)", fontWeight: 500 }}
            >
              <Pencil size={11} /> Chỉnh sửa đơn giá
            </button>
          </Section>

          {/* Phụ phí */}
          <Section label="Phụ phí áp dụng">
            <SurchargeList propertyId={property.id} inline />
          </Section>

          {/* Công tơ điện chung */}
          <Section label="Công tơ điện chung">
            <SharedMeterSection propertyId={property.id} rooms={rooms} />
          </Section>

        </div>
      </div>
    </>
  );
}
