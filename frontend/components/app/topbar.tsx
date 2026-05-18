"use client";

import { Search, Bell } from "lucide-react";

export function Topbar() {
  return (
    <header style={{
      height: 56,
      paddingInline: 24,
      borderBottom: "1px solid var(--vn-border)",
      background: "var(--vn-surface)",
      display: "flex", alignItems: "center", gap: 12,
      flexShrink: 0, position: "sticky", top: 0, zIndex: 10,
      boxShadow: "0 1px 0 var(--vn-border)",
    }}>
      {/* Global search */}
      <div style={{
        display: "flex", alignItems: "center",
        height: 34, background: "var(--slate-100)",
        border: "1px solid var(--vn-border)",
        borderRadius: 8, padding: "0 12px", width: 280, gap: 8, cursor: "text",
      }}>
        <Search size={13} color="var(--vn-text-3)" />
        <span style={{ flex: 1, color: "var(--vn-text-3)", fontSize: 13 }}>
          Tìm phòng, khách, hóa đơn…
        </span>
        <kbd style={{
          fontSize: 10.5, color: "var(--vn-text-3)",
          fontFamily: "var(--font-geist-mono)",
          background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          padding: "1px 5px", borderRadius: 4, lineHeight: 1.6,
        }}>⌘K</kbd>
      </div>

      <div style={{ flex: 1 }} />

      {/* Bell */}
      <button style={{
        width: 34, height: 34, borderRadius: 8,
        background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
        display: "grid", placeItems: "center", cursor: "pointer",
        position: "relative", color: "var(--vn-text-2)",
        boxShadow: "var(--sh-xs)",
      }}>
        <Bell size={15} />
      </button>
    </header>
  );
}
