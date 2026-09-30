export type ErrandType = 
  | 'grocery'
  | 'market_run'
  | 'pharmacy'
  | 'quotations'
  | 'elderly_assistance'
  | 'intercity_bus_handoff'
  | 'messenger_delivery'
  | 'order_collection'
  | 'shop_delivery';

export type TransportMode = 
  | 'foot'
  | 'bicycle'
  | 'motorbike'
  | 'car'
  | 'public/kombi';

export type OrderStatus = 
  | 'pending'
  | 'negotiating'
  | 'accepted'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface Messenger {
  id: string;
  name: string;
  photo_url: string;
  whatsapp_number: string;
  transport_mode: TransportMode;
  transport_photo_urls: string[];
  area_name: string;
  centre_lat: number;
  centre_lng: number;
  radius_km: number;
  rating_avg: number;
  rating_count: number;
  errands_completed: number;
  errands_accepted: number;
  is_active: boolean;
  owner_email?: string | null;
  owner_id?: string | null;
  national_id_front?: string | null;
  national_id_back?: string | null;
  driver_licence_front?: string | null;
  driver_licence_back?: string | null;
  is_verified: boolean;
  kyc_status: 'pending' | 'verified' | 'rejected';
  kyc_notes?: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  errand_type: ErrandType;
  orderer_name: string;
  orderer_whatsapp: string;
  shop_name: string | null;
  item_list: string[];
  budget: number | null;
  product_image_url: string | null;
  parcel_description?: string | null;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_contact_person?: string | null;
  delivery_address: string;
  delivery_lat: number;
  delivery_lng: number;
  delivery_contact_person?: string | null;
  scheduled_datetime: string;
  proposed_charge: number;
  counter_charge: number | null;
  agreed_charge: number | null;
  notes: string | null;
  status: OrderStatus;
  messenger_id: string | null;
  messenger_name?: string;
  messenger_whatsapp?: string;
  messenger_photo?: string;
  created_at: string;
  updated_at: string;
}


export interface Rating {
  id: string;
  order_id: string;
  messenger_id: string;
  stars: number;
  comment: string | null;
  created_at: string;
}

export interface MessengerStats {
  errands_completed: number;
  errands_accepted: number;
  acceptance_rate: number;
  rating_avg: number;
  rating_count: number;
  total_earnings_usd: number;
  active_orders_count: number;
}

export interface AdminStats {
  total_messengers: number;
  active_messengers: number;
  inactive_messengers: number;
  total_orders: number;
  orders_by_status: Record<OrderStatus, number>;
  total_completed_value_usd: number;
}
