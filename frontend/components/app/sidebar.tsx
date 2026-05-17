"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard, Building2, DoorOpen, Users, FileText,
  Zap, Receipt, Settings,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
}

const NAV_GROUPS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Tổng quan",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    heading: "Quản lý",
    items: [
      { href: "/properties", label: "Nhà trọ", icon: Building2 },
      { href: "/rooms", label: "Phòng", icon: DoorOpen },
      { href: "/tenants", label: "Khách thuê", icon: Users },
      { href: "/contracts", label: "Hợp đồng", icon: FileText },
    ],
  },
  {
    heading: "Tài chính",
    items: [
      { href: "/utility", label: "Chỉ số Điện/Nước", icon: Zap },
      { href: "/invoices", label: "Hóa đơn", icon: Receipt },
    ],
  },
];

const BOTTOM_ITEMS: NavItem[] = [
  { href: "/settings", label: "Cài đặt", icon: Settings },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        height: 36,
        padding: "0 10px",
        borderRadius: 8,
        color: active ? "var(--blue-700)" : "var(--vn-text-2)",
        background: active ? "var(--blue-50)" : "transparent",
        fontSize: 13.5,
        fontWeight: active ? 500 : 400,
        textDecoration: "none",
        transition: "background .1s, color .1s",
      }}
      className="group hover:bg-[var(--slate-100)] hover:text-[var(--vn-text)]"
    >
      <Icon
        size={16}
        style={{ color: active ? "var(--blue-600)" : "var(--slate-500)", flexShrink: 0 }}
      />
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.badge != null && (
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          background: active ? "var(--blue-100)" : "var(--slate-150)",
          color: active ? "var(--blue-700)" : "var(--slate-600)",
          padding: "2px 7px",
          borderRadius: 999,
        }}>
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside style={{
      width: 240,
      background: "var(--vn-surface)",
      borderRight: "1px solid var(--vn-border)",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      height: "100vh",
      position: "sticky",
      top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: "18px 18px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)",
            display: "grid", placeItems: "center",
            boxShadow: "0 4px 12px rgba(37,99,235,.25), inset 0 1px 0 rgba(255,255,255,.18)",
            flexShrink: 0,
          }}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none">
              <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-8.5z" fill="#fff" opacity=".95" />
            </svg>
          </div>
          <span style={{ font: "600 16px var(--font-geist-sans)", letterSpacing: "-0.02em", color: "var(--vn-text)" }}>
            Vn<span style={{ color: "var(--blue-600)" }}>Rental</span>
          </span>
        </div>
      </div>

      {/* Nav groups */}
      <nav style={{ flex: 1, padding: "4px 12px", overflowY: "auto" }}>
        {NAV_GROUPS.map((group) => (
          <div key={group.heading} style={{ marginBottom: 4 }}>
            <div style={{
              font: "500 10.5px var(--font-geist-sans)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--vn-text-3)",
              padding: "10px 10px 6px",
            }}>
              {group.heading}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} active={isActive(item.href)} />
              ))}
            </div>
          </div>
        ))}

        <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 1 }}>
          {BOTTOM_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>
      </nav>

      {/* User profile */}
      <div style={{
        padding: 12,
        borderTop: "1px solid var(--vn-border)",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <UserButton />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--vn-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Tài khoản
          </div>
        </div>
      </div>
    </aside>
  );
}
