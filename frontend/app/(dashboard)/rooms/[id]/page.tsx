"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, Plus, FileText, Edit2, ExternalLink, Zap, Droplets } from "lucide-react";
import { InvoiceDrawer } from "@/components/app/invoice-drawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RoomStatusBadge } from "@/components/app/room-status-badge";
import { ContractForm } from "@/components/app/contract-form";
import { apiJson, apiFetch } from "@/lib/api";
import type { Room } from "@/types/room";
import type { Contract } from "@/types/contract";
import type { Property } from "@/types/property";
import type { InvoiceListItem } from "@/types/invoice";
import type { UtilityReading } from "@/types/utility";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from "@/types/invoice";

// ── helpers ───────────────────────────────────────────────────────
const fmtDate = (d: string) => { const [y,m,day] = d.split("-"); return `${day}/${m}/${y}`; };
const fmtMoney = (n: number | string) => Number(n).toLocaleString("vi-VN") + "₫";
const fmtNum = (raw: string) => { const d = raw.replace(/\D/g,""); return d ? Number(d).toLocaleString("vi-VN") : ""; };
const BD = "1px solid var(--vn-border)";

function timeLeft(endDate: string) {
  const end = new Date(endDate); const now = new Date(); now.setHours(0,0,0,0);
  const diff = Math.floor((end.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return { text: "Đã hết hạn", urgent: true };
  const y = Math.floor(diff/365), m = Math.floor((diff%365)/30), d = diff%30;
  const parts = [...(y?[`${y} năm`]:[]),...(m?[`${m} tháng`]:[]),...(y===0&&d?[`${d} ngày`]:[])];
  return { text: parts.join(" ") || "Hôm nay", urgent: diff <= 30 };
}

const STAT = (label: string, value: string, muted?: boolean): React.ReactNode => (
  <div key={label}>
    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--vn-text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 13.5, fontWeight: 600, color: muted ? "var(--vn-text-2)" : "var(--vn-text)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
  </div>
);

// ── styles ────────────────────────────────────────────────────────
const FIELD: React.CSSProperties = {
  width:"100%", height:34, padding:"0 10px",
  border: BD, borderRadius:7,
  fontSize:13, color:"var(--vn-text)", background:"var(--vn-surface)",
  outline:"none", boxSizing:"border-box",
};
const LBL: React.CSSProperties = { fontSize:12, fontWeight:500, color:"var(--vn-text-2)", marginBottom:3, display:"block" };

// ── edit contract ─────────────────────────────────────────────────
function EditContractForm({ contract, onSuccess, onCancel }: {
  contract: Contract; onSuccess: (c: Contract) => void; onCancel: () => void;
}) {
  const { getToken } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [endDate, setEndDate] = useState(contract.end_date);
  const [rent, setRent] = useState(fmtNum(String(contract.agreed_rent)));
  const [deposit, setDeposit] = useState(fmtNum(String(contract.deposit)));
  const [numPeople, setNumPeople] = useState(String(contract.num_people));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      const result = await apiJson<Contract>(`/contracts/${contract.id}`, getToken, {
        method: "PUT",
        body: { end_date: endDate, agreed_rent: Number(rent.replace(/\D/g,"")), deposit: Number(deposit.replace(/\D/g,"")), num_people: Number(numPeople) },
      });
      onSuccess(result);
    } catch(err) { setError(err instanceof Error ? err.message : "Lỗi"); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div><label style={LBL}>Ngày kết thúc *</label><input type="date" required value={endDate} onChange={e=>setEndDate(e.target.value)} style={FIELD}/></div>
        <div><label style={LBL}>Số người</label><input type="number" min={1} value={numPeople} onChange={e=>setNumPeople(e.target.value)} style={FIELD}/></div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div><label style={LBL}>Giá thuê (₫)</label><input value={rent} onChange={e=>setRent(fmtNum(e.target.value))} style={FIELD} inputMode="numeric" placeholder="3.500.000"/></div>
        <div><label style={LBL}>Tiền cọc (₫)</label><input value={deposit} onChange={e=>setDeposit(fmtNum(e.target.value))} style={FIELD} inputMode="numeric" placeholder="7.000.000"/></div>
      </div>
      {error && <p style={{ fontSize:12.5, color:"var(--red-600)", margin:0 }}>{error}</p>}
      <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
        <button type="button" onClick={onCancel} style={{ height:34, padding:"0 14px", borderRadius:7, border:BD, background:"var(--vn-surface)", fontSize:13, cursor:"pointer", color:"var(--vn-text-2)" }}>Hủy</button>
        <button type="submit" disabled={saving} style={{ height:34, padding:"0 16px", borderRadius:7, background:"var(--blue-600)", color:"#fff", fontSize:13, fontWeight:500, border:"none", cursor:"pointer", opacity:saving?0.7:1 }}>{saving?"Đang lưu…":"Lưu thay đổi"}</button>
      </div>
    </form>
  );
}

// ── active contract card ──────────────────────────────────────────
function ActiveContractCard({ contract, onEdit, onEnd }: {
  contract: Contract; onEdit: () => void; onEnd: () => void;
}) {
  const t = contract.tenant;
  const initials = t.full_name.split(" ").slice(-2).map(w=>w[0]).join("").toUpperCase();
  const tl = timeLeft(contract.end_date);

  return (
    <div style={{ background:"var(--vn-surface)", border:BD, borderRadius:16, overflow:"hidden", boxShadow:"var(--sh-sm)", marginBottom:20 }}>

      {/* Tenant section */}
      <div style={{ padding:"20px 24px", display:"flex", alignItems:"center", gap:16 }}>
        <div style={{
          width:52, height:52, borderRadius:14, flexShrink:0,
          background:"var(--blue-600)", color:"#fff",
          display:"grid", placeItems:"center",
          fontSize:17, fontWeight:700, letterSpacing:"0.03em",
        }}>
          {initials}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:16, fontWeight:700, color:"var(--vn-text)", marginBottom:2 }}>{t.full_name}</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"2px 14px", fontSize:13, color:"var(--vn-text-3)" }}>
            {t.phone && <span>{t.phone}</span>}
            {t.email && <span>{t.email}</span>}
            {t.cccd && <span>CCCD: {t.cccd}</span>}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height:1, background:"var(--vn-border)", margin:"0 24px" }}/>

      {/* Contract details */}
      <div style={{ padding:"16px 24px" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"var(--vn-text-3)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>Hợp đồng</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"12px 0", marginBottom:14 }}>
          {STAT("Bắt đầu", fmtDate(contract.start_date), true)}
          {STAT("Kết thúc", fmtDate(contract.end_date), true)}
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:"var(--vn-text-3)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:3 }}>Còn lại</div>
            <div style={{ fontSize:13.5, fontWeight:700, color: tl.urgent ? "var(--red-500)" : "var(--green-600)" }}>{tl.text}</div>
          </div>
          {STAT("Giá thuê", fmtMoney(contract.agreed_rent))}
          {STAT("Tiền cọc", fmtMoney(contract.deposit), true)}
          {STAT("Số người", `${contract.num_people} người`, true)}
        </div>

        {/* Actions */}
        <div style={{ display:"flex", justifyContent:"flex-end", gap:8, paddingTop:12, borderTop:BD }}>
          <button onClick={onEdit} style={{
            display:"inline-flex", alignItems:"center", gap:5,
            height:32, padding:"0 14px", borderRadius:8, border:BD,
            background:"var(--vn-surface)", fontSize:13, cursor:"pointer", color:"var(--vn-text-2)", fontWeight:500,
          }}><Edit2 size={13}/> Sửa hợp đồng</button>
          <button onClick={onEnd} style={{
            height:32, padding:"0 14px", borderRadius:8,
            background:"var(--red-50)", border:"1px solid var(--red-200)",
            fontSize:13, cursor:"pointer", color:"var(--red-600)", fontWeight:500,
          }}>Kết thúc hợp đồng</button>
        </div>
      </div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────
type Tab = "readings" | "history" | "invoices";

export default function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [readings, setReadings] = useState<UtilityReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("readings");

  const [showCreate, setShowCreate] = useState(false);
  const [drawerInvoiceId, setDrawerInvoiceId] = useState<number | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [endingContract, setEndingContract] = useState<Contract | null>(null);
  const [endError, setEndError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await apiJson<Room>(`/rooms/${id}`, getToken);
      const [prop, cs, inv, rds] = await Promise.all([
        apiJson<Property>(`/properties/${r.property_id}`, getToken),
        apiJson<Contract[]>(`/rooms/${id}/contracts`, getToken),
        apiJson<InvoiceListItem[]>(`/rooms/${id}/invoices`, getToken),
        apiJson<UtilityReading[]>(`/rooms/${id}/utility-readings`, getToken),
      ]);
      setRoom(r); setProperty(prop); setContracts(cs); setInvoices(inv); setReadings(rds);
    } finally { setLoading(false); }
  }, [id, getToken]);

  useEffect(() => { load(); }, [load]);

  function handleContractCreated(c: Contract) {
    setContracts(prev => [c, ...prev]);
    setRoom(prev => prev ? { ...prev, status: "occupied" } : prev);
    setShowCreate(false);
  }
  function handleContractUpdated(c: Contract) {
    setContracts(prev => prev.map(x => x.id === c.id ? c : x));
    setRoom(prev => prev ? { ...prev, rent_price: String(c.agreed_rent), deposit: String(c.deposit) } : prev);
    setEditingContract(null);
  }
  async function handleEndContract() {
    if (!endingContract) return;
    const res = await apiFetch(`/contracts/${endingContract.id}/end`, getToken, { method:"PUT" });
    if (!res.ok) { const err = await res.json().catch(()=>({detail:res.statusText})); setEndError(err.detail??"Thất bại"); return; }
    const updated: Contract = await res.json();
    setContracts(prev => prev.map(c => c.id===updated.id ? updated : c));
    setRoom(prev => prev ? { ...prev, status:"vacant" } : prev);
    setEndingContract(null); setEndError(null);
  }

  const activeContract = contracts.find(c => c.status === "active");
  const showWater = property?.water_calc_type === "per_meter";

  if (loading) return <div style={{ padding:24, color:"var(--vn-text-3)", fontSize:13.5 }}>Đang tải...</div>;
  if (!room) return <div style={{ padding:24, color:"var(--vn-text-3)", fontSize:13.5 }}>Không tìm thấy phòng.</div>;

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key:"readings", label:"Chỉ số điện/nước", count: readings.length },
    { key:"history",  label:"Lịch sử thuê",     count: contracts.filter(c=>c.status==="ended").length },
    { key:"invoices", label:"Hoá đơn",           count: invoices.length },
  ];

  return (
    <div style={{ padding:24 }}>

      {/* Back */}
      <button onClick={() => router.push(`/properties/${room.property_id}`)} style={{
        display:"inline-flex", alignItems:"center", gap:6, fontSize:13,
        color:"var(--vn-text-3)", background:"none", border:"none", cursor:"pointer", padding:0, marginBottom:10,
      }}>
        <ArrowLeft size={14}/> {property?.name ?? "Nhà trọ"}
      </button>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:"-0.02em", color:"var(--vn-text)", margin:0 }}>
            Phòng {room.room_number}
          </h1>
          <RoomStatusBadge status={room.status}/>
        </div>
        {room.status === "vacant" && (
          <button onClick={() => setShowCreate(true)} style={{
            display:"inline-flex", alignItems:"center", gap:6,
            height:36, padding:"0 14px", borderRadius:8,
            background:"var(--blue-600)", color:"#fff",
            fontSize:13.5, fontWeight:500, border:"none", cursor:"pointer",
          }}><Plus size={15}/> Tạo hợp đồng</button>
        )}
      </div>

      {/* Room info strip */}
      <div style={{
        background:"var(--vn-surface)", border:BD, borderRadius:12,
        padding:"12px 0", marginBottom:20, boxShadow:"var(--sh-xs)",
        display:"flex",
      }}>
        {[
          { label:"Giá thuê",  value: fmtMoney(room.rent_price) },
          { label:"Tiền cọc",  value: fmtMoney(room.deposit) },
          ...(room.area_m2 ? [{ label:"Diện tích", value:`${room.area_m2} m²` }] : []),
          ...(room.floor   ? [{ label:"Tầng",       value:String(room.floor)   }] : []),
        ].map((item, i, arr) => (
          <div key={item.label} style={{ flex:1, padding:"0 20px", borderRight: i<arr.length-1 ? BD : "none" }}>
            <div style={{ fontSize:11, fontWeight:600, color:"var(--vn-text-3)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:3 }}>{item.label}</div>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--vn-text)", fontVariantNumeric:"tabular-nums" }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Active contract / vacant state */}
      {activeContract
        ? <ActiveContractCard contract={activeContract} onEdit={() => setEditingContract(activeContract)} onEnd={() => setEndingContract(activeContract)}/>
        : (
          <div style={{
            background:"var(--vn-surface)", border:"1.5px dashed var(--vn-border)", borderRadius:14,
            padding:"22px 24px", marginBottom:20, display:"flex", alignItems:"center", justifyContent:"space-between",
          }}>
            <div style={{ fontSize:13.5, color:"var(--vn-text-3)" }}>Phòng đang trống</div>
            <button onClick={() => setShowCreate(true)} style={{
              display:"inline-flex", alignItems:"center", gap:6,
              height:34, padding:"0 14px", borderRadius:8,
              background:"var(--blue-600)", color:"#fff", fontSize:13, fontWeight:500, border:"none", cursor:"pointer",
            }}><Plus size={14}/> Tạo hợp đồng</button>
          </div>
        )
      }

      {/* Tabs */}
      <div style={{ display:"flex", gap:0, borderBottom:BD, marginBottom:16 }}>
        {TABS.map(({ key, label, count }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            height:38, padding:"0 16px", border:"none", background:"none", cursor:"pointer",
            fontSize:13.5, fontWeight: tab===key ? 600 : 400,
            color: tab===key ? "var(--blue-600)" : "var(--vn-text-2)",
            borderBottom: tab===key ? "2px solid var(--blue-600)" : "2px solid transparent",
            marginBottom:-1, display:"flex", alignItems:"center", gap:6,
          }}>
            {label}
            {!!count && (
              <span style={{
                fontSize:11, fontWeight:600, height:18, minWidth:18, padding:"0 5px", borderRadius:9,
                display:"inline-flex", alignItems:"center", justifyContent:"center",
                background: tab===key ? "var(--blue-100)" : "var(--slate-100)",
                color: tab===key ? "var(--blue-700)" : "var(--vn-text-3)",
              }}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Chỉ số điện/nước */}
      {tab === "readings" && (
        readings.length === 0 ? (
          <Empty icon={<Zap size={26}/>} text="Chưa có chỉ số nào" sub="Chỉ số được thêm qua trang Billing của nhà."/>
        ) : (
          <div style={{ background:"var(--vn-surface)", border:BD, borderRadius:12, overflow:"hidden", boxShadow:"var(--sh-xs)" }}>
            <table style={{ width:"100%", borderCollapse:"separate", borderSpacing:0, fontSize:13.5 }}>
              <thead>
                <tr>
                  {["Kỳ", "Khách thuê", "Điện đầu", "Điện cuối", "Tiêu thụ (kWh)", ...(showWater ? ["Nước đầu","Nước cuối","Tiêu thụ (m³)"] : [])].map(h => (
                    <th key={h} style={{ textAlign:"left", padding:"10px 16px", fontSize:11, fontWeight:600, color:"var(--vn-text-3)", letterSpacing:"0.04em", textTransform:"uppercase", background:"var(--slate-50)", borderBottom:BD }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {readings.map((r, i) => {
                  const elecUsage = r.elec_prev != null ? (r.elec_curr - r.elec_prev) : null;
                  const waterUsage = (showWater && r.water_prev != null && r.water_curr != null) ? (r.water_curr - r.water_prev) : null;
                  const prevR = i > 0 ? readings[i - 1] : null;
                  const tenantChanged = prevR && prevR.contract_id !== r.contract_id;
                  const isInitial = r.elec_prev === null;
                  const bd = i < readings.length - 1 ? BD : "none";
                  const TD = (extra?: React.CSSProperties) => ({ padding:"11px 16px", borderBottom:bd, verticalAlign:"middle" as const, ...extra });
                  return (
                    <React.Fragment key={r.id}>
                      {tenantChanged && (
                        <tr>
                          <td colSpan={showWater ? 8 : 5} style={{ padding:"0 16px", height:1, background:"var(--vn-border)", borderBottom: BD }} />
                        </tr>
                      )}
                      <tr style={{ background: isInitial ? "var(--amber-50)" : undefined }}>
                        <td style={TD({ fontFamily:"var(--font-geist-mono)", fontSize:13, fontWeight:600 })}>{r.period}</td>
                        <td style={TD({ fontSize:12.5 })}>
                          {r.tenant_name
                            ? <span style={{ color: isInitial ? "var(--amber-700)" : "var(--vn-text-2)", fontWeight: isInitial ? 600 : 400 }}>
                                {r.tenant_name}
                                {isInitial && <span style={{ marginLeft:5, fontSize:10.5, background:"var(--amber-100)", color:"var(--amber-700)", padding:"1px 6px", borderRadius:4, fontWeight:600 }}>Đầu vào</span>}
                              </span>
                            : <span style={{ color:"var(--vn-text-3)" }}>—</span>}
                        </td>
                        <td style={TD({ color:"var(--vn-text-3)", fontVariantNumeric:"tabular-nums" })}>
                          {r.elec_prev != null ? r.elec_prev : <span style={{color:"var(--vn-border)"}}>—</span>}
                        </td>
                        <td style={TD({ fontVariantNumeric:"tabular-nums", fontWeight:500 })}>{r.elec_curr}</td>
                        <td style={TD({ fontVariantNumeric:"tabular-nums" })}>
                          {elecUsage != null
                            ? <span style={{ display:"inline-flex", alignItems:"center", gap:4, color: elecUsage > 0 ? "var(--blue-700)" : "var(--vn-text-3)", fontWeight:600 }}><Zap size={12}/>{elecUsage}</span>
                            : <span style={{color:"var(--vn-border)"}}>—</span>}
                        </td>
                        {showWater && <>
                          <td style={TD({ color:"var(--vn-text-3)", fontVariantNumeric:"tabular-nums" })}>{r.water_prev != null ? r.water_prev : <span style={{color:"var(--vn-border)"}}>—</span>}</td>
                          <td style={TD({ fontVariantNumeric:"tabular-nums", fontWeight:500 })}>{r.water_curr ?? <span style={{color:"var(--vn-border)"}}>—</span>}</td>
                          <td style={TD({ fontVariantNumeric:"tabular-nums" })}>
                            {waterUsage != null
                              ? <span style={{ display:"inline-flex", alignItems:"center", gap:4, color:"var(--blue-500)", fontWeight:600 }}><Droplets size={12}/>{waterUsage}</span>
                              : <span style={{color:"var(--vn-border)"}}>—</span>}
                          </td>
                        </>}
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Tab: Lịch sử thuê */}
      {tab === "history" && (
        contracts.filter(c=>c.status==="ended").length === 0 ? (
          <Empty icon={<FileText size={26}/>} text="Chưa có lịch sử thuê"/>
        ) : (
          <div style={{ background:"var(--vn-surface)", border:BD, borderRadius:12, overflow:"hidden", boxShadow:"var(--sh-xs)" }}>
            <table style={{ width:"100%", borderCollapse:"separate", borderSpacing:0, fontSize:13.5 }}>
              <thead>
                <tr>
                  {["Khách thuê","Thời gian","Giá thuê","Tiền cọc","Số người"].map(h=>(
                    <th key={h} style={{ textAlign:"left", padding:"10px 16px", fontSize:11, fontWeight:600, color:"var(--vn-text-3)", letterSpacing:"0.04em", textTransform:"uppercase", background:"var(--slate-50)", borderBottom:BD }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contracts.filter(c=>c.status==="ended").map((c,i,arr)=>(
                  <tr key={c.id}>
                    <td style={{ padding:"12px 16px", borderBottom:i<arr.length-1?BD:"none" }}>
                      <div style={{ fontWeight:500 }}>{c.tenant.full_name}</div>
                      {c.tenant.phone && <div style={{ fontSize:12, color:"var(--vn-text-3)" }}>{c.tenant.phone}</div>}
                    </td>
                    <td style={{ padding:"12px 16px", borderBottom:i<arr.length-1?BD:"none", color:"var(--vn-text-2)", fontSize:13 }}>{fmtDate(c.start_date)} → {fmtDate(c.end_date)}</td>
                    <td style={{ padding:"12px 16px", borderBottom:i<arr.length-1?BD:"none", fontWeight:500, fontVariantNumeric:"tabular-nums" }}>{fmtMoney(c.agreed_rent)}</td>
                    <td style={{ padding:"12px 16px", borderBottom:i<arr.length-1?BD:"none", color:"var(--vn-text-2)", fontVariantNumeric:"tabular-nums" }}>{fmtMoney(c.deposit)}</td>
                    <td style={{ padding:"12px 16px", borderBottom:i<arr.length-1?BD:"none", color:"var(--vn-text-2)" }}>{c.num_people} người</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Tab: Hoá đơn */}
      {tab === "invoices" && (
        invoices.length === 0 ? (
          <Empty icon={<FileText size={26}/>} text="Chưa có hoá đơn"/>
        ) : (
          <div style={{ background:"var(--vn-surface)", border:BD, borderRadius:12, overflow:"hidden", boxShadow:"var(--sh-xs)" }}>
            <table style={{ width:"100%", borderCollapse:"separate", borderSpacing:0, fontSize:13.5 }}>
              <thead>
                <tr>
                  {["Kỳ","Khách thuê","Tổng tiền","Trạng thái",""].map(h=>(
                    <th key={h} style={{ textAlign:"left", padding:"10px 16px", fontSize:11, fontWeight:600, color:"var(--vn-text-3)", letterSpacing:"0.04em", textTransform:"uppercase", background:"var(--slate-50)", borderBottom:BD }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv,i)=>{
                  const sc = INVOICE_STATUS_COLORS[inv.status];
                  return (
                    <tr key={inv.id}>
                      <td style={{ padding:"12px 16px", borderBottom:i<invoices.length-1?BD:"none", fontWeight:600, fontFamily:"var(--font-geist-mono)", fontSize:13 }}>{inv.period}</td>
                      <td style={{ padding:"12px 16px", borderBottom:i<invoices.length-1?BD:"none", color:"var(--vn-text-2)", fontSize:13 }}>{inv.tenant_name}</td>
                      <td style={{ padding:"12px 16px", borderBottom:i<invoices.length-1?BD:"none", fontWeight:600, fontVariantNumeric:"tabular-nums" }}>{fmtMoney(inv.total)}</td>
                      <td style={{ padding:"12px 16px", borderBottom:i<invoices.length-1?BD:"none" }}>
                        <span style={{ display:"inline-flex", alignItems:"center", gap:5, height:22, padding:"0 9px", borderRadius:999, fontSize:11.5, fontWeight:500, background:sc.bg, color:sc.fg }}>
                          <span style={{ width:5, height:5, borderRadius:"50%", background:sc.dot }}/>
                          {INVOICE_STATUS_LABELS[inv.status]}
                        </span>
                      </td>
                      <td style={{ padding:"12px 16px", borderBottom:i<invoices.length-1?BD:"none" }}>
                        <button onClick={()=>setDrawerInvoiceId(inv.id)} style={{ display:"inline-flex", alignItems:"center", gap:4, height:28, padding:"0 10px", borderRadius:6, border:BD, background:"var(--vn-surface)", fontSize:12.5, cursor:"pointer", color:"var(--vn-text-2)" }}>
                          <ExternalLink size={12}/> Xem
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Dialogs */}
      <Dialog open={showCreate} onOpenChange={o=>{if(!o)setShowCreate(false);}}>
        <DialogContent className="sm:max-w-lg" style={{ maxHeight:"90vh", overflowY:"auto" }}>
          <DialogHeader><DialogTitle>Tạo hợp đồng — Phòng {room.room_number}</DialogTitle></DialogHeader>
          <ContractForm roomId={room.id} propertyId={room.property_id} defaultRent={Number(room.rent_price)} defaultDeposit={Number(room.deposit)} waterCalcType={property?.water_calc_type} onSuccess={handleContractCreated} onCancel={()=>setShowCreate(false)}/>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingContract} onOpenChange={o=>{if(!o)setEditingContract(null);}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Sửa hợp đồng</DialogTitle></DialogHeader>
          {editingContract && <EditContractForm contract={editingContract} onSuccess={handleContractUpdated} onCancel={()=>setEditingContract(null)}/>}
        </DialogContent>
      </Dialog>

      <InvoiceDrawer
        invoiceId={drawerInvoiceId}
        onClose={() => setDrawerInvoiceId(null)}
        onDelete={() => setInvoices(prev => prev.filter(i => i.id !== drawerInvoiceId))}
        onUpdate={updated => setInvoices(prev => prev.map(i => i.id === updated.id ? { ...i, status: updated.status } : i))}
      />

      <AlertDialog open={!!endingContract} onOpenChange={o=>{if(!o){setEndingContract(null);setEndError(null);}}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kết thúc hợp đồng?</AlertDialogTitle>
            <AlertDialogDescription>Kết thúc hợp đồng của <strong>{endingContract?.tenant.full_name}</strong>. Phòng sẽ chuyển sang trạng thái trống.</AlertDialogDescription>
          </AlertDialogHeader>
          {endError && <p style={{ fontSize:13, color:"var(--red-600)", padding:"0 4px" }}>{endError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleEndContract} className="bg-red-600 hover:bg-red-700">Kết thúc</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Empty({ icon, text, sub }: { icon: React.ReactNode; text: string; sub?: string }) {
  return (
    <div style={{ background:"var(--vn-surface)", border:BD, borderRadius:12, padding:"40px 24px", textAlign:"center", boxShadow:"var(--sh-xs)" }}>
      <div style={{ display:"flex", justifyContent:"center", marginBottom:10, color:"var(--vn-border)" }}>{icon}</div>
      <div style={{ fontSize:14, fontWeight:500, color:"var(--vn-text-2)", marginBottom: sub?4:0 }}>{text}</div>
      {sub && <div style={{ fontSize:13, color:"var(--vn-text-3)" }}>{sub}</div>}
    </div>
  );
}
