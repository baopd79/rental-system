"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { X, Building2, DoorOpen, Users, Calendar, Banknote, Clock } from "lucide-react";
import { apiJson } from "@/lib/api";
import type { ContractListItem, ContractEvent } from "@/types/contract";
import {
  CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS,
  CONTRACT_EVENT_LABELS,
} from "@/types/contract";

const fmtMoney = (n: string | number) => Number(n).toLocaleString("vi-VN") + "₫";
const fmtDate = (d: string) => { const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
const BD = "1px solid var(--vn-border)";

function EventDot({ type }: { type: ContractEvent["event_type"] }) {
  const colors: Record<ContractEvent["event_type"], string> = {
    created: "var(--green-500)",
    rent_changed: "var(--amber-500)",
    people_changed: "var(--blue-500)",
    ended: "var(--slate-400)",
  };
  return (
    <div style={{
      width: 8, height: 8, borderRadius: "50%",
      background: colors[type], flexShrink: 0, marginTop: 5,
    }} />
  );
}

function EventLine({ event, last }: { event: ContractEvent; last: boolean }) {
  const d = new Date(event.occurred_at);
  const label = CONTRACT_EVENT_LABELS[event.event_type];

  let detail: string | null = null;
  if (event.event_type === "rent_changed" && event.old_value && event.new_value) {
    detail = `${fmtMoney(event.old_value)} → ${fmtMoney(event.new_value)}`;
  } else if (event.event_type === "people_changed" && event.old_value && event.new_value) {
    detail = `${event.old_value} → ${event.new_value} người`;
  } else if (event.event_type === "created" && event.new_value) {
    detail = `Tiền thuê: ${fmtMoney(event.new_value)}`;
  }

  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 8 }}>
        <EventDot type={event.event_type} />
        {!last && <div style={{ width: 1, flex: 1, background: "var(--vn-border)", marginTop: 4 }} />}
      </div>
      <div style={{ paddingBottom: last ? 0 : 16, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--vn-text)" }}>{label}</span>
          <span style={{ fontSize: 11.5, color: "var(--vn-text-3)" }}>
            {d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
          </span>
        </div>
        {detail && (
          <div style={{ fontSize: 12.5, color: "var(--vn-text-2)", marginTop: 2 }}>{detail}</div>
        )}
      </div>
    </div>
  );
}

interface Props {
  contract: ContractListItem | null;
  onClose: () => void;
  zIndexBase?: number;
}

export function ContractDrawer({ contract, onClose, zIndexBase = 400 }: Props) {
  const { getToken } = useAuth();
  const open = contract !== null;
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const loadEvents = useCallback(async (id: number) => {
    setLoadingEvents(true);
    try {
      const data = await apiJson<ContractEvent[]>(`/contracts/${id}/events`, getToken);
      setEvents(data);
    } finally {
      setLoadingEvents(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (contract) loadEvents(contract.id);
    else setEvents([]);
  }, [contract, loadEvents]);

  const sc = contract ? CONTRACT_STATUS_COLORS[contract.status] : null;

  return (
    <>
      {/* Backdrop */}
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

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 420,
        background: "var(--vn-surface)",
        borderLeft: BD,
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
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--vn-text)" }}>
              {contract?.tenant_name ?? "—"}
            </div>
            <div style={{ fontSize: 12, color: "var(--vn-text-3)", marginTop: 2 }}>
              {contract ? `${contract.property_name} · Phòng ${contract.room_number}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {sc && (
              <span style={{
                fontSize: 11.5, fontWeight: 600, padding: "2px 10px", borderRadius: 999,
                background: sc.bg, color: sc.fg,
              }}>
                {CONTRACT_STATUS_LABELS[contract!.status]}
              </span>
            )}
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
          {contract && (
            <>
              {/* Info grid */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: 1, background: "var(--vn-border)",
                border: BD, borderRadius: 10, overflow: "hidden",
                marginBottom: 20,
              }}>
                {[
                  { icon: Building2, label: "Nhà trọ", value: contract.property_name },
                  { icon: DoorOpen,  label: "Phòng",   value: contract.room_number },
                  { icon: Calendar,  label: "Ngày vào", value: fmtDate(contract.start_date) },
                  { icon: Calendar,  label: "Ngày ra",  value: fmtDate(contract.end_date) },
                  { icon: Banknote,  label: "Tiền thuê", value: fmtMoney(contract.agreed_rent) },
                  { icon: Banknote,  label: "Đặt cọc",   value: fmtMoney(contract.deposit) },
                  { icon: Users,     label: "Số người",  value: `${contract.num_people} người` },
                  { icon: Clock,     label: "Thời hạn",  value: (() => {
                      const start = new Date(contract.start_date);
                      const end   = new Date(contract.end_date);
                      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
                      return months > 0 ? `${months} tháng` : "< 1 tháng";
                    })(),
                  },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} style={{ background: "var(--vn-surface)", padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <Icon size={12} color="var(--vn-text-3)" />
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--vn-text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--vn-text)" }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Events timeline */}
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--vn-text-3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 14 }}>
                  Lịch sử thay đổi
                </div>
                {loadingEvents ? (
                  <div style={{ fontSize: 13, color: "var(--vn-text-3)" }}>Đang tải...</div>
                ) : events.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--vn-text-3)" }}>Không có lịch sử.</div>
                ) : (
                  <div>
                    {events.map((e, i) => (
                      <EventLine key={e.id} event={e} last={i === events.length - 1} />
                    ))}
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
