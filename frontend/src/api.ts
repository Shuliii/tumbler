/** Small helpers for calling our backend. Errors carry the server's customer-safe message. */
import type { ApiError } from '../../shared/api.ts';
import type {
  CreateOrderRequest,
  CreateOrderResponse,
  Order,
  OrderStatus,
  OrderSummary,
  UpdateOrderRequest,
} from '../../shared/orders.ts';

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error('Can’t reach the server. Check your internet connection and try again.');
  }
  const data = (await res.json().catch(() => null)) as T | ApiError | null;
  if (!res.ok || data === null) {
    const msg = data && typeof data === 'object' && 'error' in data ? data.error : `Server problem (${res.status}).`;
    throw new Error(msg);
  }
  return data as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// ---- customer

const UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Upload the ORIGINAL photo (converted to PNG only if it's an unusual format). */
export async function uploadPhoto(file: File, el: HTMLImageElement): Promise<string> {
  let blob: Blob = file;
  if (!UPLOAD_TYPES.includes(file.type)) {
    const c = document.createElement('canvas');
    c.width = el.naturalWidth;
    c.height = el.naturalHeight;
    c.getContext('2d')!.drawImage(el, 0, 0);
    blob = await new Promise<Blob>((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error('Couldn’t prepare the photo.'))), 'image/png'));
  }
  const { photoId } = await apiFetch<{ photoId: string }>('/api/photos', {
    method: 'POST',
    headers: { 'Content-Type': blob.type },
    body: blob,
  });
  return photoId;
}

export const createOrder = (req: CreateOrderRequest) => apiFetch<CreateOrderResponse>('/api/orders', json('POST', req));

// ---- admin

export function listOrders(status: OrderStatus | 'all', q: string) {
  const params = new URLSearchParams();
  if (status !== 'all') params.set('status', status);
  if (q.trim()) params.set('q', q.trim());
  return apiFetch<{ orders: OrderSummary[] }>(`/api/admin/orders?${params}`);
}

export const getOrder = (id: string) => apiFetch<Order>(`/api/admin/orders/${encodeURIComponent(id)}`);

export const updateOrder = (id: string, patch: UpdateOrderRequest) =>
  apiFetch<Order>(`/api/admin/orders/${encodeURIComponent(id)}`, json('PATCH', patch));

export const adminPhotoUrl = (photoId: string) => `/api/admin/photos/${encodeURIComponent(photoId)}`;
