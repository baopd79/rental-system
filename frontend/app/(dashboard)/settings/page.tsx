"use client";

import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div style={{ padding: "20px 24px" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "var(--vn-text-3)", marginBottom: 4 }}>Cài đặt</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.022em", color: "var(--vn-text)", margin: 0 }}>Cài đặt</h1>
      </div>
      <div style={{
        background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
        borderRadius: 12, padding: "56px 32px", textAlign: "center", boxShadow: "var(--sh-xs)",
      }}>
        <Settings size={28} color="var(--vn-text-3)" style={{ margin: "0 auto 12px", display: "block" }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--vn-text-2)", marginBottom: 6 }}>Cài đặt hệ thống</div>
        <div style={{ fontSize: 13, color: "var(--vn-text-3)", maxWidth: 360, margin: "0 auto" }}>
          Quản lý tài khoản, branding và cấu hình hệ thống. Đang được phát triển.
        </div>
      </div>
    </div>
  );
}
