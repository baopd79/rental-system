"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { X, Phone, CreditCard, Mail, Calendar, Building2, DoorOpen } from "lucide-react";
import { apiJson } from "@/lib/api";
import type { Tenant } from "@/types/tenant";
import type { ContractWithRoom } from "@/types/contract";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS } from "@/types/contract";

const fmtMoney = (n: number) => n.toLocaleString("vi-VN") + "₫";
const fmtDate  = (d: string) => { const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
const BD = "1px solid var(--vn-border)";

interface Props {
  tenant: Tenant | null;
  onClose: () => void;
  onEdit: (t: Tenant) => void;
  zIndexBase?: number;
}

export function TenantDrawer({ tenant, onClose, onEdit, zIndexBase = 400 }: Props) {
  const { getToken } = useAuth();
  const open = tenant !== null;
  const [contracts, setContracts] = useState<ContractWithRoom[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);

  const loadContracts = useCallback(async (id: number) => {
    setLoadingContracts(true);
    try {
      const data = await apiJson<ContractWithRoom[]>(`/tenants/${id}/contracts`, getToken);
      setContracts(data);
    } finally {
      setLoadingContracts(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (tenant) loadContracts(tenant.id);
    else setContracts([]);
  }, [tenant, loadContracts]);

  const activeContract = contracts.find((c) => c.status === "active");

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.25)",
          zIndex: zIndexBase,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity .2s ease",
        }}
      />
      <div className="vn-drawer" style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 420,
        background: "var(--vn-surface)", borderLeft: BD,
        zIndex: zIndexBase + 1,
        display: "flex", flexDirection: "column",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform .28s cubic-bezier(.4,0,.2,1)",
        boxShadow: "var(--sh-pop)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: BD, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "var(--blue-100)", color: "var(--blue-700)",
              display: "grid", placeItems: "center", fontSize: 16, fontWeight: 700, flexShrink: 0,
            }}>
              {tenant?.full_name.charAt(0).toUpperCase() ?? "?"}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--vn-text)" }}>
                {tenant?.full_name ?? "—"}
              </div>
              {activeContract && (
                <div style={{ fontSize: 12, color: "var(--vn-text-3)", marginTop: 1 }}>
                  {activeContract.property_name} · Phòng {activeContract.room_number}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => tenant && onEdit(tenant)}
              style={{
                height: 30, padding: "0 12px", borderRadius: 7, border: BD,
                background: "transparent", fontSize: 12.5, fontWeight: 500,
                color: "var(--vn-text-2)", cursor: "pointer",
              }}
            >
              Chỉnh sửa
            </button>
            <button
              onClick={onClose}
              style={{ width: 30, height: 30, borderRadius: 8, border: BD, background: "transparent", cursor: "pointer", display: "grid", placeItems: "center" }}
            >
              <X size={14} color="var(--vn-text-2)" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {tenant && (
            <>
              {/* Contact info */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--vn-text-3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
                  Thông tin liên hệ
                </div>
                <div style={{
                  background: "var(--vn-bg)", border: BD, borderRadius: 10,
                  overflow: "hidden",
                }}>
                  {[
                    { icon: Phone,    label: "Số điện thoại", value: tenant.phone },
                    { icon: CreditCard, label: "CCCD/CMND",   value: tenant.cccd },
                    { icon: Mail,     label: "Email",          value: tenant.email },
                    { icon: Calendar, label: "Ngày sinh",      value: tenant.date_of_birth ? fmtDate(tenant.date_of_birth) : null },
                  ].map(({ icon: Icon, label, value }, i, arr) => (
                    <div key={label} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "11px 14px",
                      borderBottom: i < arr.length - 1 ? BD : "none",
                    }}>
                      <Icon size={13} color="var(--vn-text-3)" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "var(--vn-text-3)", width: 110, flexShrink: 0 }}>{label}</span>
                      <span style={{ fontSize: 13, color: value ? "var(--vn-text)" : "var(--vn-text-3)", fontWeight: value ? 500 : 400 }}>
                        {value ?? "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contract history */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--vn-text-3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
                  Lịch sử thuê phòng
                </div>
                {loadingContracts ? (
                  <div style={{ fontSize: 13, color: "var(--vn-text-3)" }}>Đang tải...</div>
                ) : contracts.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--vn-text-3)" }}>Chưa có hợp đồng nào.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {contracts.map((c) => {
                      const sc = CONTRACT_STATUS_COLORS[c.status];
                      return (
                        <div key={c.id} style={{
                          background: "var(--vn-bg)", border: BD,
                          borderRadius: 10, padding: "12px 14px",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--vn-text)" }}>
                                Phòng {c.room_number}
                              </span>
                            </div>
                            <span style={{ fontSize: 11.5, fontWeight: 600, padding: "2px 9px", borderRadius: 999, background: sc.bg, color: sc.fg }}>
                              {CONTRACT_STATUS_LABELS[c.status]}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--vn-text-3)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <Building2 size={11} />
                              {c.property_name}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <DoorOpen size={11} />
                              {fmtMoney(c.agreed_rent)}/tháng
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: "var(--vn-text-3)", marginTop: 5 }}>
                            {fmtDate(c.start_date)} → {fmtDate(c.end_date)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
