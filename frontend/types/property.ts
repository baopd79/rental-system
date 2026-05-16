export interface Property {
  id: number;
  clerk_user_id: string;
  name: string;
  address: string;
  description: string | null;
  default_elec_rate: string;
  default_water_rate: string;
  created_at: string;
}

export interface PropertyCreate {
  name: string;
  address: string;
  description?: string;
  default_elec_rate?: string;
  default_water_rate?: string;
}

export interface PropertyUpdate {
  name?: string;
  address?: string;
  description?: string;
  default_elec_rate?: string;
  default_water_rate?: string;
}
