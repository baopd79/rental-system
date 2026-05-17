import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "var(--vn-bg)",
      fontFamily: "var(--font-geist-sans)",
      WebkitFontSmoothing: "antialiased",
    }}>
      <Sidebar />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar />
        <div style={{ flex: 1, overflow: "auto" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
