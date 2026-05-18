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
  contract_start: string;
  contract_end: string;
  reading_id: number | null;
  elec_prev: string | null;
  elec_curr: string | null;
  water_prev: string | null;
  water_curr: string | null;
  prev_elec_prev: string | null;
  prev_elec_curr: string | null;
  prev_water_prev: string | null;
  prev_water_curr: string | null;
  next_reading_locked: boolean;
  invoice_id: number | null;
  invoice_status: InvoiceStatus | null;
  invoice_total: string | null;
  public_token: string | null;
};

export type InvoicePreviewSurcharge = {
  name: string;
  amount: string;
};

export type InvoicePreviewRow = {
  room_id: number;
  room_number: string;
  contract_id: number;
  tenant_name: string;
  contract_start: string;
  contract_end: string;
  is_prorated: boolean;
  prorate_label: string | null;
  has_reading: boolean;
  elec_prev: string | null;
  elec_curr: string | null;
  water_prev: string | null;
  water_curr: string | null;
  rent_amount: string;
  elec_amount: string;
  water_amount: string;
  shared_elec_amount: string;
  surcharges: InvoicePreviewSurcharge[];
  surcharge_total: string;
  total: string;
  invoice_id: number | null;
  invoice_status: InvoiceStatus | null;
  invoice_public_token: string | null;
};

export type BatchInvoiceResult = {
  created: number;
  skipped: number;
  errors: string[];
};
