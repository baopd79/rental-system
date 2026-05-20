export type SurchargeCalcType = "per_room" | "per_person";

export const SURCHARGE_CALC_LABELS: Record<SurchargeCalcType, string> = {
  per_room: "Theo phòng",
  per_person: "Theo người",
};

export type Surcharge = {
  id: number;
  property_id: number;
  name: string;
  calc_type: SurchargeCalcType;
  amount: number;
};
