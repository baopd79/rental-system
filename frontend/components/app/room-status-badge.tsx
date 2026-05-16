import { Badge } from "@/components/ui/badge";
import type { RoomStatus } from "@/types/room";

const config: Record<RoomStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  vacant:      { label: "Trống",       variant: "secondary" },
  occupied:    { label: "Đang thuê",   variant: "default" },
  maintenance: { label: "Bảo trì",     variant: "destructive" },
};

export function RoomStatusBadge({ status }: { status: RoomStatus }) {
  const { label, variant } = config[status];
  return <Badge variant={variant}>{label}</Badge>;
}
