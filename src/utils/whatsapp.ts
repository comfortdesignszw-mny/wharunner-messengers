import type { ErrandType, Order } from '../types';

export const ERRAND_TYPE_LABELS: Record<ErrandType, { label: string; icon: string; desc: string }> = {
  pharmacy: {
    label: 'Pharmacy & Hospital Visits',
    icon: '🏥',
    desc: 'Medix, Greenwood Park, urgent medications, hospital drops & clinic visits',
  },
  quotations: {
    label: 'Quotations',
    icon: '📋',
    desc: 'Hardware prices, building supplies, wholesale rate inquiries & comparisons',
  },
  elderly_assistance: {
    label: 'Elderly Assistance',
    icon: '🤝',
    desc: 'Care runs, pension/bill errands, wellness visits & home companion deliveries',
  },
  intercity_bus_handoff: {
    label: 'Intercity Bus Parcel Handoffs',
    icon: '🚌',
    desc: 'Roadport, Mbare Musika, Renkini: bus parcel drop-offs & collections',
  },
  grocery: {
    label: 'Grocery Shopping',
    icon: '🛒',
    desc: 'OK Zimbabwe, TM Pick n Pay, Bon Marché, Spar',
  },
  market_run: {
    label: 'Fresh Produce / Market Run',
    icon: '🥬',
    desc: 'Mbare Musika, Lusaka Market, Renkini fresh fruits & veggies',
  },
  messenger_delivery: {
    label: 'Parcel / Document Delivery',
    icon: '📦',
    desc: 'Legal documents, urgent parcels, gifts across town',
  },
  order_collection: {
    label: 'Online / Food Order Collection',
    icon: '🍔',
    desc: 'Chicken Slice, Simbisa, Innbucks, online packages',
  },
  shop_delivery: {
    label: 'Shop / Boutique Delivery',
    icon: '🛍️',
    desc: 'Retail shopping, boutique pickups, spare parts',
  },
};

export const TRANSPORT_MODE_LABELS: Record<string, { label: string; icon: string; tag: string }> = {
  foot: { label: 'Runner (Foot)', icon: '🏃‍♂️', tag: 'Fast local runner' },
  bicycle: { label: 'Bicycle', icon: '🚲', tag: 'Eco-friendly courier' },
  motorbike: { label: 'Motorbike', icon: '🛵', tag: 'Speedy city courier' },
  car: { label: 'Car / Van', icon: '🚗', tag: 'Large parcels & groceries' },
  'public/kombi': { label: 'Kombi / Public', icon: '🚐', tag: 'High-capacity runs' },
};

/**
 * Format the exact WhatsApp message required by WhaRunner spec
 */
export function formatWhatsAppMessage(order: {
  errand_type: ErrandType;
  orderer_name: string;
  orderer_whatsapp: string;
  parcel_description?: string | null;
  shop_name?: string | null;
  item_list?: string[] | null;
  budget?: number | null;
  pickup_address: string;
  pickup_contact_person?: string | null;
  delivery_address: string;
  delivery_contact_person?: string | null;
  scheduled_datetime: string;
  proposed_charge: number;
  notes?: string | null;
  messenger_name: string;
}): string {
  const typeLabel = ERRAND_TYPE_LABELS[order.errand_type]?.label || order.errand_type;
  const itemsText = order.item_list && order.item_list.length > 0 
    ? order.item_list.filter(Boolean).join(', ') 
    : 'N/A';
  const shopText = order.shop_name ? order.shop_name : 'N/A';
  const budgetText = order.budget ? order.budget.toFixed(2) : 'N/A';
  const notesText = order.notes ? order.notes : 'None';
  const parcelText = order.parcel_description ? order.parcel_description : 'N/A';
  const pickupAssisted = order.pickup_contact_person ? order.pickup_contact_person : 'Self / Specified at location';
  const dropoffAssisted = order.delivery_contact_person ? order.delivery_contact_person : 'Self / Specified at location';

  return `*New Errand Request*

*Type:* ${typeLabel}
*Name:* ${order.orderer_name}
*WhatsApp:* ${order.orderer_whatsapp}

*Parcel / Items to Pick Up:* ${parcelText}
*Shop/Store:* ${shopText}
*List:* ${itemsText}
*Budget:* $${budgetText}

*Pickup Location:* ${order.pickup_address}
*Assisted By (at Pickup):* ${pickupAssisted}

*Drop-off Location:* ${order.delivery_address}
*Assisted By (at Drop-off):* ${dropoffAssisted}

*Date/Time:* ${order.scheduled_datetime}
*Proposed Charge:* $${order.proposed_charge.toFixed(2)}
*Notes:* ${notesText}

_Hi there ${order.messenger_name}, I need an Errand service for the above run; please confirm you can do it_`;
}


/**
 * Formats a clean wa.me deep link
 */
export function buildWhatsAppDeepLink(whatsappNumber: string, message: string): string {
  // Strip all non-digits: +263 77 123 4567 -> 263771234567
  const cleaned = whatsappNumber.replace(/[^0-9]/g, '');
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}
