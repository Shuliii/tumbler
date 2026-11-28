import type { OrderStatus, PaymentMethod } from '../../../shared/orders.ts';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'New',
  paid: 'Paid',
  printed: 'Printed',
  done: 'Done',
  cancelled: 'Cancelled',
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  transfer: 'Bank transfer',
  qris: 'QRIS',
  cash: 'Cash',
  other: 'Other',
};

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
