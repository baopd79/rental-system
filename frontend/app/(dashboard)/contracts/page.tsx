"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { Search, FileText } from "lucide-react";
import { apiJson } from "@/lib/api";
import type { ContractListItem, ContractStatus } from "@/types/contract";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS } from "@/types/contract";
import { ContractDrawer } from "@/components/app/contract-drawer";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { fmtMoney, fmtDate } from "@/lib/format";

type Tab = "all" | ContractStatus;
const TABS: { key: Tab; label: string }[] = [
  { key: "all",    label: "Tất cả"       },
  { key: "active", label: "Đang thuê"    },
  { key: "ended",  label: "Đã kết thúc"  },
];

export default function ContractsPage() {
  const { getToken } = useAuth();
  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<Tab>("all");
  const [search, setSearch]       = useState("");
  const [selected, setSelected]   = useState<ContractListItem | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiJson<ContractListItem[]>("/contracts", getToken);
      setContracts(data);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contracts.filter((c) => {
      if (tab !== "all" && c.status !== tab) return false;
      if (q) {
        return (
          c.tenant_name.toLowerCase().includes(q) ||
          c.room_number.toLowerCase().includes(q) ||
          c.property_name.toLowerCase().includes(q) ||
          (c.tenant_phone ?? "").includes(q)
        );
      }
      return true;
    });
  }, [contracts, tab, search]);

  const activeCount = contracts.filter((c) => c.status === "active").length;
  const endedCount  = contracts.filter((c) => c.status === "ended").length;

  return (
    <div style={{ padding: "var(--sp-5) var(--sp-6)" }}>
      <PageHeader
        title="Hợp đồng"
        description={loading ? "Đang tải..." : `${activeCount} đang thuê · ${endedCount} đã kết thúc`}
      />

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", marginBottom: "var(--sp-4)", flexWrap: "wrap" }}>
        {/* Status tabs */}
        <div style={{ display: "flex", background: "var(--vn-surface)", border: "1px solid var(--vn-border)", borderRadius: 8, padding: 3, gap: 2, boxShadow: "var(--sh-xs)" }}>
          {TABS.map(({ key, label }) => {
            const count = key === "all" ? contracts.length : contracts.filter((c) => c.status === key).length;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  height: 28, padding: "0 12px", borderRadius: 6, border: "none",
                  cursor: "pointer", fontSize: 13, fontWeight: 500,
                  background: tab === key ? "var(--blue-600)" : "transparent",
                  color: tab === key ? "#fff" : "var(--vn-text-2)",
                  transition: "all .15s",
                }}
              >
                {label}
                {!loading && (
                  <span style={{
                    marginLeft: 6, fontSize: 11, fontWeight: 600,
                    background: tab === key ? "rgba(255,255,255,0.2)" : "var(--slate-100)",
                    color: tab === key ? "#fff" : "var(--vn-text-3)",
                    padding: "1px 6px", borderRadius: 999,
                  }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          height: 36, background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: 8, padding: "0 12px", width: 260, boxShadow: "var(--sh-xs)",
        }}>
          <Search size={13} color="var(--vn-text-3)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tên, phòng, nhà trọ, SĐT..."
            style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: "var(--vn-text)", background: "transparent" }}
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: "var(--sp-8) 0", textAlign: "center", color: "var(--vn-text-3)", fontSize: "var(--text-label)" }}>Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: "var(--r-lg)", boxShadow: "var(--sh-xs)",
        }}>
          <EmptyState
            message={search ? "Không tìm thấy hợp đồng" : "Chưa có hợp đồng nào"}
            icon={FileText}
          />
        </div>
      ) : (
        <div style={{
          background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          borderRadius: "var(--r-lg)", overflow: "hidden", boxShadow: "var(--sh-xs)",
        }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: "var(--text-body)" }}>
            <thead>
              <tr>
                {["Khách thuê", "Nhà trọ · Phòng", "Ngày vào", "Ngày ra", "Tiền thuê", "Trạng thái"].map((h) => (
                  <th key={h} style={{
                    textAlign: "left", padding: "11px var(--sp-4)",
                    fontSize: "var(--text-xs)", fontWeight: 600,
                    color: "var(--vn-text-3)", letterSpacing: "0.05em",
                    textTransform: "uppercase", background: "var(--slate-50)",
                    borderBottom: "1px solid var(--vn-border)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const sc = CONTRACT_STATUS_COLORS[c.status];
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className="hover:bg-(--slate-50)"
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ padding: "12px var(--sp-4)", borderBottom: i < filtered.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                      <div style={{ fontWeight: 600, color: "var(--vn-text)" }}>{c.tenant_name}</div>
                      {c.tenant_phone && (
                        <div style={{ fontSize: "var(--text-sm)", color: "var(--vn-text-3)", marginTop: 2 }}>{c.tenant_phone}</div>
                      )}
                    </td>
                    <td style={{ padding: "12px var(--sp-4)", borderBottom: i < filtered.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                      <div style={{ color: "var(--vn-text-2)" }}>{c.property_name}</div>
                      <div style={{ fontSize: "var(--text-sm)", color: "var(--vn-text-3)", marginTop: 2 }}>Phòng {c.room_number}</div>
                    </td>
                    <td style={{ padding: "12px var(--sp-4)", borderBottom: i < filtered.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", color: "var(--vn-text-2)" }}>
                      {fmtDate(c.start_date)}
                    </td>
                    <td style={{ padding: "12px var(--sp-4)", borderBottom: i < filtered.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle", color: "var(--vn-text-2)" }}>
                      {fmtDate(c.end_date)}
                    </td>
                    <td style={{ padding: "12px var(--sp-4)", borderBottom: i < filtered.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                      <span style={{ fontWeight: 600, color: "var(--vn-text)", fontVariantNumeric: "tabular-nums" }}>
                        {fmtMoney(c.agreed_rent)}
                      </span>
                    </td>
                    <td style={{ padding: "12px var(--sp-4)", borderBottom: i < filtered.length - 1 ? "1px solid var(--vn-border)" : "none", verticalAlign: "middle" }}>
                      <StatusBadge bg={sc.bg} fg={sc.fg} label={CONTRACT_STATUS_LABELS[c.status]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      )}

      <ContractDrawer contract={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
