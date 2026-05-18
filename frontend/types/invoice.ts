export type InvoiceStatus = "draft" | "sent" | "paid";
export type InvoiceItemType = "rent" | "electricity" | "water" | "surcharge" | "shared_elec";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Nháp",
  sent: "Đã gửi",
  paid: "Đã thanh toán",
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, { bg: string; fg: string; dot: string }> = {
  draft:  { bg: "var(--slate-100)", fg: "var(--slate-600)",  dot: "var(--slate-400)" },
  sent:   { bg: "var(--blue-50)",   fg: "var(--blue-700)",   dot: "var(--blue-500)" },
  paid:   { bg: "var(--green-50)",  fg: "var(--green-700)",  dot: "var(--green-500)" },
};

export const INVOICE_ITEM_LABELS: Record<InvoiceItemType, string> = {
  rent:        "Tiền thuê",
  electricity: "Tiền điện",
  water:       "Tiền nước",
  surcharge:   "Phụ phí",
  shared_elec: "Điện chung",
};

export type InvoiceItem = {
  id: number;
  item_type: InvoiceItemType;
  name: string;
  unit_price: string;
  quantity: string;
  amount: string;
};

export type Invoice = {
  id: number;
  contract_id: number;
  period: string;
  total: string;
  status: InvoiceStatus;
  public_token: string;
  payment_reported_at: string | null;
  items: InvoiceItem[];
};

export type InvoiceListItem = Invoice & {
  room_id: number;
  room_number: string;
  property_name: string;
  tenant_name: string;
};
