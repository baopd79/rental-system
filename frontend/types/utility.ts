export type UtilityReading = {
  id: number;
  room_id: number;
  period: string;       // "YYYY-MM"
  elec_prev: number | null;
  elec_curr: number;
  water_prev: number | null;
  water_curr: number | null;
  is_prev_auto: boolean;
};
