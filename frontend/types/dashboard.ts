export interface RoomStats {
  total: number;
  vacant: number;
  occupied: number;
  maintenance: number;
}

export interface ExpiringContract {
  contract_id: number;
  room_number: string;
  property_name: string;
  tenant_name: string;
  end_date: string;
  days_left: number;
}

export interface UnpaidInvoiceSummary {
  invoice_id: number;
  room_number: string;
  property_name: string;
  tenant_name: string;
  period: string;
  total: number;
  status: "draft" | "sent";
}

export interface DashboardSummary {
  properties: number;
  rooms: RoomStats;
  active_contracts: number;
  unpaid_invoices: number;
  unpaid_total: number;
  expiring_soon: number;
  expiring_contracts: ExpiringContract[];
  unpaid_invoice_list: UnpaidInvoiceSummary[];
}

export interface RevenueMonth {
  month: string;
  total: number;
}

export interface DashboardRevenue {
  year: number;
  months: RevenueMonth[];
  total_year: number;
}
