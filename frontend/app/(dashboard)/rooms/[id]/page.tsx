"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, Plus, FileText, User, Calendar, DollarSign, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RoomStatusBadge } from "@/components/app/room-status-badge";
import { ContractForm } from "@/components/app/contract-form";
import { apiJson, apiFetch } from "@/lib/api";
import type { Room } from "@/types/room";
import type { Contract } from "@/types/contract";

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtMoney(n: number) {
  return Number(n).toLocaleString("vi-VN") + "₫";
}

export default function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [endingContract, setEndingContract] = useState<Contract | null>(null);
  const [endError, setEndError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, cs] = await Promise.all([
        apiJson<Room>(`/rooms/${id}`, getToken),
        apiJson<Contract[]>(`/rooms/${id}/contracts`, getToken),
      ]);
      setRoom(r);
      setContracts(cs);
    } finally {
      setLoading(false);
    }
  }, [id, getToken]);

  useEffect(() => { load(); }, [load]);

  function handleContractCreated(c: Contract) {
    setContracts((prev) => [c, ...prev]);
    setRoom((prev) => prev ? { ...prev, status: "occupied" } : prev);
    setShowForm(false);
  }

  async function handleEndContract() {
    if (!endingContract) return;
    const res = await apiFetch(`/contracts/${endingContract.id}/end`, getToken, { method: "PUT" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      setEndError(err.detail ?? "Kết thúc hợp đồng thất bại");
      return;
    }
    const updated: Contract = await res.json();
    setContracts((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    setRoom((prev) => prev ? { ...prev, status: "vacant" } : prev);
    setEndingContract(null);
    setEndError(null);
  }

  const activeContract = contracts.find((c) => c.status === "active");

  if (loading) return (
    <div style={{ padding: 24, color: "var(--vn-text-3)", fontSize: 13.5 }}>Đang tải...</div>
  );
  if (!room) return (
    <div style={{ padding: 24, color: "var(--vn-text-3)", fontSize: 13.5 }}>Không tìm thấy phòng.</div>
  );

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => router.back()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 13, color: "var(--vn-text-3)", background: "none",
            border: "none", cursor: "pointer", padding: 0, marginBottom: 10,
          }}
        >
          <ArrowLeft size={14} /> Quay lại
        </button>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.018em", color: "var(--vn-text)", margin: 0 }}>
              Phòng {room.room_number}
            </h1>
            <RoomStatusBadge status={room.status} />
          </div>
          {room.status === "vacant" && (
            <button
              onClick={() => setShowForm(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 36, padding: "0 14px", borderRadius: 8,
                background: "var(--blue-600)", color: "#fff",
                fontSize: 13.5, fontWeight: 500, border: "none", cursor: "pointer",
                boxShadow: "0 1px 0 rgba(255,255,255,.18) inset, var(--sh-sm)",
              }}
            >
              <Plus size={15} color="#fff" /> Tạo hợp đồng
            </button>
          )}
        </div>
      </div>

      {/* Room info */}
      <div style={{
        background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
        borderRadius: 12, padding: "14px 20px", marginBottom: 20,
        display: "flex", alignItems: "center", gap: 28, boxShadow: "var(--sh-xs)", fontSize: 13.5,
      }}>
        {room.floor && (
          <span style={{ color: "var(--vn-text-2)" }}>Tầng <strong>{room.floor}</strong></span>
        )}
        {room.area_m2 && (
          <span style={{ color: "var(--vn-text-2)" }}><strong>{room.area_m2}</strong> m²</span>
        )}
        <span style={{ color: "var(--vn-text-2)" }}>
          Giá thuê <strong style={{ color: "var(--vn-text)" }}>{fmtMoney(Number(room.rent_price))}</strong>
        </span>
        <span style={{ color: "var(--vn-text-2)" }}>
          Tiền cọc <strong style={{ color: "var(--vn-text)" }}>{fmtMoney(Number(room.deposit))}</strong>
        </span>
      </div>

      {/* Active contract banner */}
      {activeContract && (
        <div style={{
          background: "var(--blue-50)", border: "1px solid var(--blue-200)",
          borderRadius: 12, padding: "16px 20px", marginBottom: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          boxShadow: "var(--sh-xs)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 13.5 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "var(--blue-100)", display: "grid",
              placeItems: "center", color: "var(--blue-700)",
            }}>
              <User size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: "var(--blue-900)", fontSize: 14 }}>
                {activeContract.tenant.full_name}
              </div>
              <div style={{ color: "var(--blue-700)", marginTop: 2, fontSize: 13 }}>
                {activeContract.tenant.phone && <span style={{ marginRight: 12 }}>{activeContract.tenant.phone}</span>}
                <span>{fmtDate(activeContract.start_date)} → {fmtDate(activeContract.end_date)}</span>
                <span style={{ marginLeft: 12 }}>{activeContract.num_people} người</span>
                <span style={{ marginLeft: 12, fontWeight: 600, color: "var(--blue-800)" }}>
                  {fmtMoney(activeContract.agreed_rent)}/tháng
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setEndingContract(activeContract)}
            style={{
              height: 32, padding: "0 14px", borderRadius: 7,
              background: "#fff", border: "1px solid var(--blue-300)",
              fontSize: 13, cursor: "pointer", color: "var(--blue-700)", fontWeight: 500,
            }}
          >
            Kết thúc HĐ
          </button>
        </div>
      )}

      {/* Contracts history */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--vn-text)", margin: 0 }}>
          Lịch sử hợp đồng
        </h2>
      </div>

      {contracts.length === 0 ? (
        <div style={{
          background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: 14, padding: "48px 32px", textAlign: "center", boxShadow: "var(--sh-xs)",
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: "var(--slate-100)", display: "grid",
            placeItems: "center", margin: "0 auto 14px",
          }}>
            <FileText size={20} color="var(--vn-text-3)" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--vn-text-2)", marginBottom: 6 }}>
            Chưa có hợp đồng nào
          </div>
          <div style={{ fontSize: 13.5, color: "var(--vn-text-3)" }}>
            Tạo hợp đồng khi phòng có khách thuê.
          </div>
        </div>
      ) : (
        <div style={{
          background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: 14, overflow: "hidden", boxShadow: "var(--sh-xs)",
        }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13.5 }}>
            <thead>
              <tr>
                {["Khách thuê", "Thời hạn", "Giá thuê", "Tiền cọc", "Số người", "Trạng thái"].map((h) => (
                  <th key={h} style={{
                    textAlign: "left", padding: "11px 16px",
                    font: "500 11.5px var(--font-geist-sans)",
                    color: "var(--vn-text-3)", letterSpacing: "0.04em",
                    textTransform: "uppercase", background: "var(--slate-50)",
                    borderBottom: "1px solid var(--vn-border)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contracts.map((c, i) => (
                <tr key={c.id}>
                  <td style={{ padding: "13px 16px", borderBottom: i < contracts.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: c.status === "active" ? "var(--blue-100)" : "var(--slate-100)",
                        color: c.status === "active" ? "var(--blue-700)" : "var(--vn-text-3)",
                        display: "grid", placeItems: "center", flexShrink: 0,
                        fontSize: 11, fontWeight: 600,
                      }}>
                        {c.tenant.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, color: "var(--vn-text)" }}>{c.tenant.full_name}</div>
                        {c.tenant.phone && <div style={{ fontSize: 12, color: "var(--vn-text-3)" }}>{c.tenant.phone}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "13px 16px", borderBottom: i < contracts.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", color: "var(--vn-text-2)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Calendar size={13} />
                      <span>{fmtDate(c.start_date)}</span>
                      <span style={{ color: "var(--vn-text-3)" }}>→</span>
                      <span>{fmtDate(c.end_date)}</span>
                    </div>
                  </td>
                  <td style={{ padding: "13px 16px", borderBottom: i < contracts.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", fontVariantNumeric: "tabular-nums", fontWeight: 500, color: "var(--vn-text)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <DollarSign size={13} color="var(--vn-text-3)" />
                      {fmtMoney(c.agreed_rent)}
                    </div>
                  </td>
                  <td style={{ padding: "13px 16px", borderBottom: i < contracts.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", color: "var(--vn-text-2)", fontVariantNumeric: "tabular-nums" }}>
                    {fmtMoney(c.deposit)}
                  </td>
                  <td style={{ padding: "13px 16px", borderBottom: i < contracts.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", color: "var(--vn-text-2)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Users size={13} />
                      {c.num_people}
                    </div>
                  </td>
                  <td style={{ padding: "13px 16px", borderBottom: i < contracts.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                    {c.status === "active" ? (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        height: 22, padding: "0 10px", borderRadius: 999,
                        fontSize: 11.5, fontWeight: 500,
                        background: "var(--blue-50)", color: "var(--blue-700)",
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
                        Đang thuê
                      </span>
                    ) : (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        height: 22, padding: "0 10px", borderRadius: 999,
                        fontSize: 11.5, fontWeight: 500,
                        background: "var(--slate-100)", color: "var(--vn-text-3)",
                      }}>
                        Đã kết thúc
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create contract dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) setShowForm(false); }}>
        <DialogContent style={{ maxWidth: 520 }}>
          <DialogHeader>
            <DialogTitle>Tạo hợp đồng — Phòng {room.room_number}</DialogTitle>
          </DialogHeader>
          <ContractForm
            roomId={room.id}
            defaultRent={Number(room.rent_price)}
            defaultDeposit={Number(room.deposit)}
            onSuccess={handleContractCreated}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* End contract confirmation */}
      <AlertDialog open={!!endingContract} onOpenChange={(o) => { if (!o) { setEndingContract(null); setEndError(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kết thúc hợp đồng?</AlertDialogTitle>
            <AlertDialogDescription>
              Kết thúc hợp đồng của <strong>{endingContract?.tenant.full_name}</strong>.
              Phòng sẽ chuyển sang trạng thái trống.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {endError && <p style={{ fontSize: 13, color: "var(--red-600)", padding: "0 4px" }}>{endError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleEndContract} className="bg-red-600 hover:bg-red-700">
              Kết thúc hợp đồng
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
