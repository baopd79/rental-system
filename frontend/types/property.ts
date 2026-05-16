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
  created_at: string;
}

export interface PropertyCreate {
  name: string;
  address: string;
  description?: string;
  default_elec_rate?: string;
  default_water_rate?: string;
  water_calc_type?: WaterCalcType;
}

export interface PropertyUpdate {
  name?: string;
  address?: string;
  description?: string;
  default_elec_rate?: string;
  default_water_rate?: string;
  water_calc_type?: WaterCalcType;
}
