"use client";

import { Search, Bell, Plus } from "lucide-react";
import Link from "next/link";

export function Topbar() {
  return (
    <header style={{
      height: 60,
      paddingInline: 24,
      borderBottom: "1px solid var(--vn-border)",
      background: "var(--vn-surface)",
      display: "flex",
      alignItems: "center",
      gap: 16,
      flexShrink: 0,
    }}>
      {/* Search */}
      <div style={{
        display: "flex", alignItems: "center",
        height: 36, background: "var(--slate-100)", borderRadius: 8,
        padding: "0 12px", width: 280, gap: 8, cursor: "text",
      }}>
        <Search size={15} color="var(--vn-text-3)" />
        <span style={{ flex: 1, color: "var(--vn-text-3)", fontSize: 13.5 }}>
          Tìm phòng, khách, hóa đơn…
        </span>
        <span style={{
          fontSize: 11, color: "var(--vn-text-3)",
          fontFamily: "var(--font-geist-mono)",
          background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
          padding: "2px 6px", borderRadius: 4,
        }}>⌘K</span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Bell */}
      <button style={{
        width: 36, height: 36, borderRadius: 8,
        background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
        display: "grid", placeItems: "center", cursor: "pointer",
        position: "relative", boxShadow: "var(--sh-xs)",
      }}>
        <Bell size={16} color="var(--vn-text-2)" />
        <span style={{
          position: "absolute", top: 7, right: 7,
          width: 7, height: 7, borderRadius: "50%",
          background: "var(--red-600)", border: "1.5px solid #fff",
        }} />
      </button>

      {/* CTA */}
      <Link
        href="/invoices/new"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          height: 36, padding: "0 14px", borderRadius: 8,
          background: "var(--blue-600)", color: "#fff",
          fontSize: 13.5, fontWeight: 500, letterSpacing: "-0.005em",
          textDecoration: "none",
          boxShadow: "0 1px 0 rgba(255,255,255,.18) inset, var(--sh-sm)",
          transition: "background .12s",
        }}
      >
        <Plus size={15} color="#fff" />
        Tạo hóa đơn
      </Link>
    </header>
  );
}
