"use client";

import { useEffect, useState } from "react";
import { X, Zap, Droplets, Pencil, CreditCard, Check, Loader } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { SurchargeList } from "@/components/app/surcharge-list";
import type { Property } from "@/types/property";
import { WATER_CALC_LABELS } from "@/types/property";
import { SharedMeterSection } from "@/components/app/shared-meter-section";
import { apiJson } from "@/lib/api";
import type { Room } from "@/types/room";

interface Props {
  open: boolean;
  property: Property;
  rooms: Room[];
  onClose: () => void;
  onEditProperty: () => void;
  onPropertyUpdated?: (p: Property) => void;
}

const BD = "1px solid var(--vn-border)";
const fmtMoney = (n: number | string) => Number(n).toLocaleString("vi-VN") + "₫";

// VietQR bank codes — https://img.vietqr.io/image/{code}-{account}-compact2.png
const BANKS: { code: string; name: string }[] = [
  { code: "VCB",      name: "Vietcombank" },
  { code: "VTB",      name: "VietinBank" },
  { code: "BIDV",     name: "BIDV" },
  { code: "MB",       name: "MB Bank" },
  { code: "TCB",      name: "Techcombank" },
  { code: "VPB",      name: "VPBank" },
  { code: "ACB",      name: "ACB" },
  { code: "TPB",      name: "TPBank" },
  { code: "STB",      name: "Sacombank" },
  { code: "HDB",      name: "HDBank" },
  { code: "VIB",      name: "VIB" },
  { code: "MSB",      name: "MSB" },
  { code: "OCB",      name: "OCB" },
  { code: "SHB",      name: "SHB" },
  { code: "SEAB",     name: "SeABank" },
  { code: "EXIMBANK", name: "Eximbank" },
  { code: "NAB",      name: "Nam A Bank" },
  { code: "BAB",      name: "Bac A Bank" },
  { code: "PGB",      name: "PGBank" },
  { code: "CAKE",     name: "CAKE by VPBank" },
  { code: "UBANK",    name: "Ubank by VPBank" },
  { code: "TIMO",     name: "Timo" },
];

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

export function PropertyConfigDrawer({ open, property, rooms, onClose, onEditProperty, onPropertyUpdated }: Props) {
  const { getToken } = useAuth();
  const [bankForm, setBankForm] = useState({
    bank_account_no: property.bank_account_no ?? "",
    bank_name:       property.bank_name       ?? "",
    bank_holder:     property.bank_holder      ?? "",
  });
  const [bankSaving, setBankSaving]   = useState(false);
  const [bankSaved,  setBankSaved]    = useState(false);
  const [bankError,  setBankError]    = useState<string | null>(null);

  // Sync when property prop changes (e.g. parent reloads)
  useEffect(() => {
    setBankForm({
      bank_account_no: property.bank_account_no ?? "",
      bank_name:       property.bank_name       ?? "",
      bank_holder:     property.bank_holder      ?? "",
    });
  }, [property.id, property.bank_account_no, property.bank_name, property.bank_holder]);

  async function saveBankInfo() {
    setBankSaving(true); setBankError(null); setBankSaved(false);
    try {
      const updated = await apiJson<Property>(`/properties/${property.id}`, getToken, {
        method: "PATCH",
        body: {
          bank_account_no: bankForm.bank_account_no || null,
          bank_name:       bankForm.bank_name       || null,
          bank_holder:     bankForm.bank_holder      || null,
        },
      });
      setBankSaved(true);
      onPropertyUpdated?.(updated);
      setTimeout(() => setBankSaved(false), 2500);
    } catch (e) {
      setBankError(e instanceof Error ? e.message : "Lỗi lưu");
    } finally {
      setBankSaving(false);
    }
  }

  const bankDirty =
    (bankForm.bank_account_no || "") !== (property.bank_account_no ?? "") ||
    (bankForm.bank_name       || "") !== (property.bank_name       ?? "") ||
    (bankForm.bank_holder     || "") !== (property.bank_holder     ?? "");

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
      <div className="vn-drawer" style={{
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

          {/* Thông tin thanh toán */}
          <Section label="Thông tin thanh toán">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              {/* Ngân hàng — dropdown */}
              <div>
                <div style={{ fontSize: 12, color: "var(--vn-text-3)", marginBottom: 4 }}>Ngân hàng</div>
                <select
                  value={bankForm.bank_name}
                  onChange={e => setBankForm(p => ({ ...p, bank_name: e.target.value }))}
                  style={{
                    width: "100%", height: 36, padding: "0 10px",
                    border: `1px solid var(--vn-border)`, borderRadius: 7,
                    fontSize: 13, background: "#fff", outline: "none",
                    boxSizing: "border-box", cursor: "pointer",
                  }}
                >
                  <option value="">— Chọn ngân hàng —</option>
                  {BANKS.map(b => (
                    <option key={b.code} value={b.code}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>

              {/* Số tài khoản */}
              <div>
                <div style={{ fontSize: 12, color: "var(--vn-text-3)", marginBottom: 4 }}>Số tài khoản</div>
                <input
                  value={bankForm.bank_account_no}
                  onChange={e => setBankForm(p => ({ ...p, bank_account_no: e.target.value }))}
                  placeholder="0123456789"
                  inputMode="numeric"
                  style={{ width: "100%", height: 36, padding: "0 10px", border: `1px solid var(--vn-border)`, borderRadius: 7, fontSize: 13, background: "#fff", outline: "none", boxSizing: "border-box" }}
                />
              </div>

              {/* Chủ tài khoản */}
              <div>
                <div style={{ fontSize: 12, color: "var(--vn-text-3)", marginBottom: 4 }}>
                  Chủ tài khoản <span style={{ color: "var(--vn-text-3)", fontWeight: 400 }}>(IN HOA, không dấu)</span>
                </div>
                <input
                  value={bankForm.bank_holder}
                  onChange={e => setBankForm(p => ({ ...p, bank_holder: e.target.value.toUpperCase() }))}
                  placeholder="NGUYEN VAN A"
                  style={{ width: "100%", height: 36, padding: "0 10px", border: `1px solid var(--vn-border)`, borderRadius: 7, fontSize: 13, background: "#fff", outline: "none", boxSizing: "border-box" }}
                />
              </div>

              {/* QR preview */}
              {bankForm.bank_name && bankForm.bank_account_no && bankForm.bank_holder && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--slate-50)", border: BD, borderRadius: 8 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://img.vietqr.io/image/${bankForm.bank_name}-${bankForm.bank_account_no}-compact2.png?accountName=${encodeURIComponent(bankForm.bank_holder)}`}
                    alt="QR preview"
                    width={72} height={72}
                    style={{ borderRadius: 6, border: BD, flexShrink: 0 }}
                  />
                  <div style={{ fontSize: 12, color: "var(--vn-text-3)", lineHeight: 1.6 }}>
                    <div style={{ fontWeight: 600, color: "var(--vn-text-2)", marginBottom: 2 }}>Preview QR</div>
                    <div>{BANKS.find(b => b.code === bankForm.bank_name)?.name ?? bankForm.bank_name}</div>
                    <div style={{ fontFamily: "monospace" }}>{bankForm.bank_account_no}</div>
                    <div>{bankForm.bank_holder}</div>
                  </div>
                </div>
              )}

              {bankError && (
                <div style={{ fontSize: 12, color: "var(--red-600)", padding: "6px 10px", background: "var(--red-50)", borderRadius: 6, border: "1px solid var(--red-200)" }}>
                  {bankError}
                </div>
              )}

              <button
                onClick={saveBankInfo}
                disabled={bankSaving || (!bankDirty && !bankSaved)}
                style={{
                  height: 34, borderRadius: 7, border: "none",
                  cursor: (bankDirty && !bankSaving) ? "pointer" : "default",
                  background: bankSaved ? "var(--green-600)" : bankDirty ? "var(--blue-600)" : "var(--slate-100)",
                  color: (bankSaved || bankDirty) ? "#fff" : "var(--vn-text-3)",
                  fontSize: 13, fontWeight: 600,
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "background .15s",
                }}
              >
                {bankSaving ? <Loader size={13} /> : bankSaved ? <Check size={13} /> : <CreditCard size={13} />}
                {bankSaving ? "Đang lưu…" : bankSaved ? "Đã lưu!" : "Lưu thông tin thanh toán"}
              </button>
            </div>
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
