"use client";

import { FileText } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ContractsPage() {
  const router = useRouter();
  return (
    <div style={{ padding: "20px 24px" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "var(--vn-text-3)", marginBottom: 4 }}>Quản lý › Hợp đồng</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.022em", color: "var(--vn-text)", margin: 0 }}>Hợp đồng</h1>
      </div>
      <div style={{
        background: "var(--vn-surface)", border: "1px solid var(--vn-border)",
        borderRadius: 12, padding: "56px 32px", textAlign: "center",
        boxShadow: "var(--sh-xs)",
      }}>
        <FileText size={28} color="var(--vn-text-3)" style={{ margin: "0 auto 12px", display: "block" }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--vn-text-2)", marginBottom: 6 }}>
          Danh sách hợp đồng
        </div>
        <div style={{ fontSize: 13, color: "var(--vn-text-3)", marginBottom: 16, maxWidth: 360, margin: "0 auto 16px" }}>
          Xem và quản lý hợp đồng từ trang chi tiết phòng. Trang tổng hợp đang được phát triển.
        </div>
        <button
          onClick={() => router.push("/properties")}
          style={{
            height: 34, padding: "0 16px", borderRadius: 8,
            background: "var(--blue-600)", color: "#fff",
            fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
          }}
        >
          Đến Nhà trọ
        </button>
      </div>
    </div>
  );
}
