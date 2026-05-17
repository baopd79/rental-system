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
