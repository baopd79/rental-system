export interface SharedMeter {
  id: number;
  property_id: number;
  name: string;
  room_ids: number[];
}

export interface SharedMeterReadingCreate {
  shared_meter_id: number;
  period: string;
  curr_reading: number;
  prev_reading?: number | null;
}

export interface SharedMeterInvoiceDetail {
  meter_id: number;
  meter_name: string;
  prev_reading: number | null;
  curr_reading: number;
  total_usage: number;
}

export interface SharedMeterReading {
  id: number;
  shared_meter_id: number;
  period: string;
  prev_reading: number | null;
  curr_reading: number;
  is_prev_auto: boolean;
}
