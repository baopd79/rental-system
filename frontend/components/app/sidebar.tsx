"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import {
  LayoutDashboard, Building2, DoorOpen, Users, FileText,
  Zap, Receipt, Settings, MoreHorizontal,
} from "lucide-react";
import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import type { DashboardSummary } from "@/types/dashboard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// ── types ─────────────────────────────────────────────────────────
interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number | null;
}

// ── nav structure (DESIGN.md §4 Sidebar groups) ───────────────────
const buildNav = (counts: { properties: number; rooms: number; unpaid: number }): { heading: string; items: NavItem[] }[] => [
  {
    heading: "Tổng quan",
    items: [
      { href: "/dashboard",  label: "Dashboard",         icon: LayoutDashboard },
    ],
  },
  {
    heading: "Quản lý",
    items: [
      { href: "/properties", label: "Nhà trọ",           icon: Building2, badge: counts.properties || null },
      { href: "/rooms",      label: "Phòng",             icon: DoorOpen,  badge: counts.rooms || null },
      { href: "/tenants",    label: "Khách thuê",         icon: Users },
      { href: "/contracts",  label: "Hợp đồng",          icon: FileText },
    ],
  },
  {
    heading: "Tài chính",
    items: [
      { href: "/utilities",  label: "Chỉ số Điện/Nước", icon: Zap },
      { href: "/invoices",   label: "Hóa đơn",           icon: Receipt, badge: counts.unpaid || null },
    ],
  },
];

// ── NavLink ────────────────────────────────────────────────────────
function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        height: 32, padding: "0 9px 0 8px",
        borderRadius: 6,
        borderLeft: `2px solid ${active ? "var(--blue-600)" : "transparent"}`,
        color: active ? "var(--blue-700)" : "var(--slate-600)",
        background: active ? "var(--blue-50)" : "transparent",
        fontSize: 13.5, fontWeight: active ? 600 : 400,
        textDecoration: "none",
        transition: "background .15s ease, color .15s ease, border-color .15s ease",
      }}
      className="hover:bg-(--slate-100) hover:text-(--slate-900)"
    >
      <Icon size={14} style={{ color: active ? "var(--blue-600)" : "var(--slate-400)", flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span style={{
          fontSize: 10.5, fontWeight: 600, minWidth: 18, height: 18,
          padding: "0 5px", borderRadius: 999, display: "inline-flex",
          alignItems: "center", justifyContent: "center",
          background: active ? "var(--blue-100)" : "var(--slate-100)",
          color: active ? "var(--blue-700)" : "var(--slate-500)",
          fontVariantNumeric: "tabular-nums",
        }}>
          {item.badge}
        </span>
      )}
    </Link>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────
export function Sidebar() {
  const pathname = usePathname();
  const { getToken } = useAuth();
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();

  const [counts, setCounts] = useState({ properties: 0, rooms: 0, unpaid: 0 });

  useEffect(() => {
    apiJson<DashboardSummary>("/dashboard/summary", getToken)
      .then(s => setCounts({
        properties: s.properties,
        rooms: s.rooms.total,
        unpaid: s.unpaid_invoices,
      }))
      .catch(() => {});
  }, [getToken]);

  const groups = buildNav(counts);
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  const displayName = user?.fullName || user?.firstName || "Tài khoản";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const initials = displayName.split(" ").slice(-2).map((w: string) => w[0]).join("").toUpperCase();

  return (
    <aside style={{
      width: 240,
      background: "var(--vn-surface)",
      borderRight: "1px solid var(--vn-border)",
      display: "flex", flexDirection: "column", flexShrink: 0,
      height: "100vh", position: "sticky", top: 0,
    }}>

      {/* Logo */}
      <div style={{ padding: "16px 16px 10px", display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
          background: "linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)",
          display: "grid", placeItems: "center",
          boxShadow: "0 3px 8px rgba(37,99,235,.40)",
        }}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none">
            <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-8.5z" fill="#fff" opacity=".95" />
          </svg>
        </div>
        <span style={{ font: "600 15px var(--font-geist-sans)", letterSpacing: "-0.02em", color: "var(--slate-900)" }}>
          Vn<span style={{ color: "var(--blue-600)" }}>Rental</span>
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "4px 10px 8px", overflowY: "auto" }}>
        {groups.map((group) => (
          <div key={group.heading} style={{ marginBottom: 2 }}>
            <div style={{
              font: "600 10px var(--font-geist-sans)",
              textTransform: "uppercase", letterSpacing: "0.08em",
              color: "var(--slate-400)",
              padding: "10px 9px 4px",
            }}>
              {group.heading}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {group.items.map(item => (
                <NavLink key={item.href} item={item} active={isActive(item.href)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Settings */}
      <div style={{ padding: "0 10px 6px" }}>
        <NavLink
          item={{ href: "/settings", label: "Cài đặt", icon: Settings }}
          active={isActive("/settings")}
        />
      </div>

      {/* User card */}
      <div style={{ borderTop: "1px solid var(--vn-border)" }}>
        <DropdownMenu>
          <DropdownMenuTrigger
              style={{
                width: "100%", padding: "10px 14px",
                background: "transparent", border: "none",
                display: "flex", alignItems: "center", gap: 9,
                cursor: "pointer", textAlign: "left",
                transition: "background .12s ease",
              }}
              className="hover:bg-(--slate-50)"
            >
              <div style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                background: "linear-gradient(135deg, var(--blue-600), var(--violet-600))",
                display: "grid", placeItems: "center",
                fontSize: 10.5, fontWeight: 700, color: "#fff", letterSpacing: "0.03em",
              }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 550, color: "var(--slate-800)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {displayName}
                </div>
                {email && (
                  <div style={{ fontSize: 11, color: "var(--slate-400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                    {email}
                  </div>
                )}
              </div>
              <MoreHorizontal size={13} style={{ color: "var(--slate-400)", flexShrink: 0 }} />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" sideOffset={6}>
            <DropdownMenuItem onClick={() => openUserProfile()}>
              <Settings size={13} />
              Cài đặt tài khoản
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => signOut({ redirectUrl: "/sign-in" })}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
