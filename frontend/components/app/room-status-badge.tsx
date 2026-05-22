import type { RoomStatus } from "@/types/room";

const CONFIG: Record<RoomStatus, { label: string; bg: string; color: string }> = {
  vacant:      { label: "Đang trống",  bg: "var(--amber-50)",  color: "var(--amber-700)" },
  occupied:    { label: "Đang thuê",   bg: "var(--blue-50)",   color: "var(--blue-700)" },
  maintenance: { label: "Bảo trì",     bg: "var(--amber-200)", color: "var(--amber-700)" },
};

export function RoomStatusBadge({ status }: { status: RoomStatus }) {
  const { label, bg, color } = CONFIG[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      height: 22, padding: "0 8px", borderRadius: 999,
      fontSize: 11.5, fontWeight: 500, background: bg, color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
      {label}
    </span>
  );
}
