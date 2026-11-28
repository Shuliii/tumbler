/**
 * Orders: what the customer submits, and what the shop's admin page works with.
 *
 *   POST  /api/photos                 raw image body        → { photoId }
 *   POST  /api/orders                 CreateOrderRequest    → CreateOrderResponse
 *   GET   /api/admin/orders?status&q                        → { orders: OrderSummary[] }
 *   GET   /api/admin/orders/:id                             → Order
 *   PATCH /api/admin/orders/:id       UpdateOrderRequest    → Order
 *   GET   /api/admin/photos/:id                             → the image
 */
import type { DesignRecipe } from './recipe.ts';

/** new → paid → printed → done. Cancelled can happen from any step. */
export const ORDER_STATUSES = ['new', 'paid', 'printed', 'done', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_METHODS = ['transfer', 'qris', 'cash', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Only one product for now; later this comes from the shop's settings. */
export const DEFAULT_PRODUCT = '20oz-skinny';

export interface Order {
  id: string;
  /** Short code the customer and shop talk about, e.g. "TB-0042". */
  code: string;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  product: string;
  customer: { name: string; whatsapp: string };
  recipe: DesignRecipe;
  /** The customer's ORIGINAL photo, or null for a colours/text-only design. */
  photoId: string | null;
  payment: { amount: number | null; method: PaymentMethod | null; paidAt: string | null };
  /** Staff notes, e.g. "picks up Saturday". */
  note: string;
}

export type OrderSummary = Pick<Order, 'id' | 'code' | 'createdAt' | 'status' | 'product' | 'customer'> & {
  title: string;
};

export interface CreateOrderRequest {
  name: string;
  whatsapp: string;
  recipe: DesignRecipe;
  photoId: string | null;
}

export interface CreateOrderResponse {
  code: string;
  /** wa.me link to the shop with the order code pre-typed, if the shop's number is configured. */
  whatsappUrl: string | null;
}

export interface UpdateOrderRequest {
  status?: OrderStatus;
  payment?: { amount: number | null; method: PaymentMethod | null };
  note?: string;
}

/**
 * Normalise a WhatsApp number to international digits, Indonesian style:
 * "0812-3456-789" → "628123456789", "812 3456 789" → "628123456789",
 * "+62 812…" → "62812…", "+65 9123 4567" → "6591234567".
 * Returns null if it doesn't look like a phone number.
 */
export function normalizeWhatsapp(input: string): string | null {
  let d = input.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('0')) d = '62' + d.slice(1);
  // Indonesian mobile numbers typed without the leading 0 (8xx…), as people often do.
  else if (d.startsWith('8')) d = '62' + d;
  d = d.replace(/\D/g, '');
  return /^\d{8,15}$/.test(d) ? d : null;
}
