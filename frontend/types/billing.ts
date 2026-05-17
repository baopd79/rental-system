import type { InvoiceStatus } from "./invoice";

export type RoomBillingStatus = {
  room_id: number;
  room_number: string;
  tenant_id: number;
  tenant_name: string;
  tenant_phone: string | null;
  num_people: number;
  contract_id: number;
  agreed_rent: string;
  reading_id: number | null;
  elec_prev: string | null;
  elec_curr: string | null;
  water_prev: string | null;
  water_curr: string | null;
  prev_elec_curr: string | null;
  prev_water_curr: string | null;
  invoice_id: number | null;
  invoice_status: InvoiceStatus | null;
  invoice_total: string | null;
  public_token: string | null;
};

export type BatchInvoiceResult = {
  created: number;
  skipped: number;
  errors: string[];
};
