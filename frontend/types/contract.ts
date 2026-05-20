import type { Tenant } from "./tenant";

export type ContractStatus = "active" | "ended";

export type Contract = {
  id: number;
  room_id: number;
  tenant_id: number;
  start_date: string;
  end_date: string;
  agreed_rent: number;
  deposit: number;
  num_people: number;
  status: ContractStatus;
  tenant: Tenant;
};

export type ContractWithRoom = Contract & {
  room_number: string;
  property_name: string;
  property_id: number;
};

export type ContractListItem = {
  id: number;
  status: ContractStatus;
  start_date: string;
  end_date: string;
  agreed_rent: number;
  deposit: number;
  num_people: number;
  tenant_id: number;
  tenant_name: string;
  tenant_phone: string | null;
  room_id: number;
  room_number: string;
  property_id: number;
  property_name: string;
};

export type ContractEvent = {
  id: number;
  contract_id: number;
  event_type: "created" | "rent_changed" | "people_changed" | "ended";
  old_value: string | null;
  new_value: string | null;
  occurred_at: string;
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  active: "Đang thuê",
  ended: "Đã kết thúc",
};

export const CONTRACT_STATUS_COLORS: Record<ContractStatus, { bg: string; fg: string }> = {
  active: { bg: "var(--green-50)", fg: "var(--green-700)" },
  ended: { bg: "var(--slate-100)", fg: "var(--slate-500)" },
};

export const CONTRACT_EVENT_LABELS: Record<ContractEvent["event_type"], string> = {
  created: "Tạo hợp đồng",
  rent_changed: "Thay đổi tiền thuê",
  people_changed: "Thay đổi số người",
  ended: "Kết thúc hợp đồng",
};
