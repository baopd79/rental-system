export type RoomStatus = "vacant" | "occupied" | "maintenance";

export interface Room {
  id: number;
  property_id: number;
  room_number: string;
  floor: number | null;
  area_m2: string | null;
  rent_price: string;
  deposit: string;
  status: RoomStatus;
  elec_rate: string | null;
  effective_elec_rate: string;
  effective_water_rate: string;
}

export interface RoomCreate {
  room_number: string;
  floor?: number;
  area_m2?: string;
  rent_price: string;
  deposit?: string;
  elec_rate?: string;
}

export interface RoomUpdate {
  room_number?: string;
  floor?: number;
  area_m2?: string;
  rent_price?: string;
  deposit?: string;
  status?: RoomStatus;
  elec_rate?: string;
}
