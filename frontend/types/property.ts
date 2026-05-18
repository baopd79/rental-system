export type WaterCalcType = "per_meter" | "per_person" | "per_room";

export const WATER_CALC_LABELS: Record<WaterCalcType, string> = {
  per_meter: "Theo chỉ số (m³)",
  per_person: "Theo người",
  per_room: "Theo phòng",
};

export interface Property {
  id: number;
  clerk_user_id: string;
  name: string;
  address: string;
  description: string | null;
  default_elec_rate: string;
  default_water_rate: string;
  water_calc_type: WaterCalcType;
  bank_account_no: string | null;
  bank_name: string | null;
  bank_holder: string | null;
  created_at: string;
}

export interface RoomInPropertyCreate {
  room_number: string;
  floor?: number;
  area_m2?: string;
  rent_price: string;
  deposit?: string;
}

export interface PropertyCreate {
  name: string;
  address: string;
  description?: string;
  default_elec_rate?: string;
  default_water_rate?: string;
  water_calc_type?: WaterCalcType;
  rooms?: RoomInPropertyCreate[];
}

export interface PropertyUpdate {
  name?: string;
  address?: string;
  description?: string;
  default_elec_rate?: string;
  default_water_rate?: string;
  water_calc_type?: WaterCalcType;
  bank_account_no?: string | null;
  bank_name?: string | null;
  bank_holder?: string | null;
}
