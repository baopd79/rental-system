"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Search, Zap, Droplets } from "lucide-react";
import { apiJson } from "@/lib/api";
import { RoomStatusBadge } from "@/components/app/room-status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { fmtMoney } from "@/lib/format";
import type { Property } from "@/types/property";
import type { Room } from "@/types/room";

interface PropertyWithRooms extends Property {
  rooms: Room[];
}

const fmtRate = (n: number | string) => {
  const v = Number(n);
  return v >= 1000 ? (v / 1000).toLocaleString("vi-VN") + "k" : v.toLocaleString("vi-VN");
};

const BD = "1px solid var(--vn-border)";
const TH: React.CSSProperties = {
  textAlign: "left", padding: "10px 16px",
  font: "600 11px var(--font-geist-sans)",
  color: "var(--vn-text-3)", letterSpacing: "0.05em",
  textTransform: "uppercase", background: "var(--slate-50)", borderBottom: BD,
  whiteSpace: "nowrap",
};

export default function RoomsPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<PropertyWithRooms[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "occupied" | "vacant" | "maintenance">("all");

  const load = useCallback(async () => {
    try {
      const props = await apiJson<Property[]>("/properties", getToken);
      const result = await Promise.all(
        props.map(async p => {
          const rooms = await apiJson<Room[]>(`/properties/${p.id}/rooms`, getToken);
          return { ...p, rooms };
        })
      );
      setData(result);
    } catch { setData([]); }
    finally { setLoading(false); }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  const allRooms = data.flatMap(p => p.rooms.map(r => ({ ...r, _prop: p })));

  const filtered = allRooms.filter(r => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.room_number.toLowerCase().includes(q)
        || r._prop.name.toLowerCase().includes(q)
        || (r.active_contract?.tenant_name ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  const totalOccupied = allRooms.filter(r => r.status === "occupied").length;
  const totalVacant   = allRooms.filter(r => r.status === "vacant").length;

  if (loading) return <div style={{ padding: "var(--sp-6)", color: "var(--vn-text-3)", fontSize: "var(--text-body)" }}>Đang tải...</div>;

  return (
    <div className="page-pad">

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "var(--sp-5)" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-display)", fontWeight: 700, letterSpacing: "-0.022em", color: "var(--vn-text)", margin: 0 }}>
            Tổng quan phòng
          </h1>
          <div style={{ display: "flex", gap: "var(--sp-3)", fontSize: "var(--text-sm)", color: "var(--vn-text-3)", marginTop: "var(--sp-1)" }}>
            <span>Tổng <strong style={{ color: "var(--vn-text-2)" }}>{allRooms.length}</strong></span>
            <span style={{ color: "var(--blue-600)", fontWeight: 500 }}>{totalOccupied} đang thuê</span>
            <span style={{ color: "var(--green-600)", fontWeight: 500 }}>{totalVacant} trống</span>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", height: 34, background: "var(--vn-surface)", border: BD, borderRadius: 7, padding: "0 11px", width: 260, gap: 7, boxShadow: "var(--sh-xs)" }}>
          <Search size={13} color="var(--vn-text-3)" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm số phòng, khách, nhà trọ…"
            style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: "var(--vn-text)", background: "transparent" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
          {(["all", "occupied", "vacant", "maintenance"] as const).map((s, i, arr) => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              height: 34, padding: "0 12px", border: BD, cursor: "pointer",
              borderRadius: i === 0 ? "7px 0 0 7px" : i === arr.length - 1 ? "0 7px 7px 0" : "0",
              borderLeft: i > 0 ? "none" : BD,
              background: statusFilter === s ? "var(--blue-50)" : "var(--vn-surface)",
              color: statusFilter === s ? "var(--blue-700)" : "var(--vn-text-2)",
              fontSize: 12.5, fontWeight: statusFilter === s ? 600 : 400,
              boxShadow: "var(--sh-xs)",
            }}>
              {{ all: "Tất cả", occupied: "Đang thuê", vacant: "Trống", maintenance: "Bảo trì" }[s]}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--vn-text-3)" }}>
          {filtered.length} phòng
        </div>
      </div>

      {/* Table */}
      {data.length === 0 ? (
        <div style={{ background: "var(--vn-surface)", border: BD, borderRadius: "var(--r-lg)" }}>
          <EmptyState message="Chưa có nhà trọ nào. Thêm nhà trọ và tạo phòng trong mục Nhà trọ." />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "var(--vn-surface)", border: BD, borderRadius: "var(--r-lg)" }}>
          <EmptyState message="Không tìm thấy phòng phù hợp." />
        </div>
      ) : (
        <div style={{ background: "var(--vn-surface)", border: BD, borderRadius: "var(--r-lg)", overflow: "hidden", boxShadow: "var(--sh-xs)" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13.5 }}>
            <thead>
              <tr>
                {["Phòng", "Nhà trọ", "Cấu hình giá", "Giá thuê", "Khách thuê", "Trạng thái"].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const p = r._prop;
                const c = r.active_contract;
                const bd = i < filtered.length - 1 ? BD : "none";
                const TD = (extra?: React.CSSProperties): React.CSSProperties => ({
                  padding: "12px 16px", borderBottom: bd, verticalAlign: "middle", ...extra,
                });
                return (
                  <tr key={r.id} onClick={() => router.push(`/rooms/${r.id}`)} style={{ cursor: "pointer" }}
                    className="hover:bg-(--slate-50) tr-row">

                    {/* Phòng */}
                    <td style={TD()}>
                      <span style={{ fontWeight: 700, fontFamily: "var(--font-geist-mono)", fontSize: 13 }}>{r.room_number}</span>
                      {r.floor && <div style={{ fontSize: 11, color: "var(--vn-text-3)", marginTop: 1 }}>Tầng {r.floor}{r.area_m2 ? ` · ${r.area_m2}m²` : ""}</div>}
                    </td>

                    {/* Nhà trọ */}
                    <td style={TD({ maxWidth: 180 })}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--vn-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                    </td>

                    {/* Cấu hình giá từ property config */}
                    <td style={TD()}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--vn-text-3)" }}>
                          <Zap size={10} color="var(--amber-500)" />
                          <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtRate(p.default_elec_rate)}₫/kWh</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--vn-text-3)" }}>
                          <Droplets size={10} color="var(--blue-400)" />
                          <span style={{ fontVariantNumeric: "tabular-nums" }}>
                            {fmtRate(p.default_water_rate)}₫{p.water_calc_type === "per_meter" ? "/m³" : p.water_calc_type === "per_person" ? "/người" : "/phòng"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Giá thuê */}
                    <td style={TD({ fontVariantNumeric: "tabular-nums" })}>
                      {c ? (
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--vn-text)" }}>{fmtMoney(c.agreed_rent)}</div>
                          {c.agreed_rent !== r.rent_price && (
                            <div style={{ fontSize: 11, color: "var(--vn-text-3)", textDecoration: "line-through" }}>{fmtMoney(r.rent_price)}</div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "var(--vn-text-2)" }}>{fmtMoney(r.rent_price)}</span>
                      )}
                    </td>

                    {/* Khách thuê */}
                    <td style={TD()}>
                      {c ? (
                        <div>
                          <div style={{ fontSize: 13, color: "var(--vn-text)", fontWeight: 500 }}>{c.tenant_name}</div>
                          <div style={{ fontSize: 11, color: "var(--vn-text-3)", marginTop: 1 }}>{c.num_people} người</div>
                        </div>
                      ) : <span style={{ color: "var(--vn-text-3)", fontSize: 13 }}>—</span>}
                    </td>

                    {/* Trạng thái */}
                    <td style={TD()}><RoomStatusBadge status={r.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer */}
          <div style={{ padding: "10px 18px", borderTop: BD, fontSize: 12, color: "var(--vn-text-3)" }}>
            Hiển thị {filtered.length} / {allRooms.length} phòng
          </div>
        </div>
      )}
    </div>
  );
}
