export type RoomStatus = "vacant" | "occupied" | "maintenance";

export interface ActiveContractInfo {
  id: number;
  tenant_name: string;
  agreed_rent: string;
  start_date: string;
  end_date: string;
  num_people: number;
}

export interface Room {
  id: number;
  property_id: number;
  room_number: string;
  floor: number | null;
  area_m2: string | null;
  rent_price: string;
  deposit: string;
  status: RoomStatus;
  active_contract: ActiveContractInfo | null;
}

export interface RoomCreate {
  room_number: string;
  floor?: number;
  area_m2?: string;
  rent_price: string;
  deposit?: string;
}

export interface RoomUpdate {
  room_number?: string;
  floor?: number;
  area_m2?: string;
  rent_price?: string;
  deposit?: string;
  status?: RoomStatus;
}
