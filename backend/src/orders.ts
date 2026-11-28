/**
 * Order routes: customers submit orders, staff manage them in the admin page.
 * See shared/orders.ts for the endpoint list and shapes.
 */
import express, { Router } from 'express';
import { normalizeRecipe } from '../../shared/recipe.ts';
import {
  DEFAULT_PRODUCT,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  normalizeWhatsapp,
  type CreateOrderResponse,
  type Order,
  type OrderStatus,
  type OrderSummary,
  type PaymentMethod,
} from '../../shared/orders.ts';
import { requireStaff } from './auth.ts';
import { config } from './config.ts';
import { UserFacingError } from './errors.ts';
import { rateLimit } from './rateLimit.ts';
import type { OrderPatch, OrderStore } from './storage/orderStore.ts';
import { PHOTO_TYPES, sniffPhotoType, type PhotoStore } from './storage/photoStore.ts';

const bad = (msg: string) => new UserFacingError(400, msg);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function whatsappUrl(code: string, name: string): string | null {
  if (!config.shopWhatsapp) return null;
  const text = `Halo, saya mau pesan tumbler dengan kode ${code} (atas nama ${name}).`;
  return `https://wa.me/${config.shopWhatsapp}?text=${encodeURIComponent(text)}`;
}

const summary = (o: Order): OrderSummary => ({
  id: o.id,
  code: o.code,
  createdAt: o.createdAt,
  status: o.status,
  product: o.product,
  customer: o.customer,
  title: o.recipe.title,
});

// ---------------------------------------------------------------------------
// Customer side
// ---------------------------------------------------------------------------

export function customerRoutes(orders: OrderStore, photos: PhotoStore): Router {
  const r = Router();
  const limit = rateLimit({ max: 20, windowMs: 10 * 60_000 });

  // The original photo, sent as the raw request body (not JSON) because it can be large.
  r.post(
    '/photos',
    limit,
    express.raw({ type: Object.keys(PHOTO_TYPES), limit: '25mb' }),
    async (req, res) => {
      const bytes = req.body;
      if (!Buffer.isBuffer(bytes) || !bytes.length) throw bad('Please send a JPG, PNG or WebP image.');
      const type = sniffPhotoType(bytes);
      if (!type) throw bad('That file is not a JPG, PNG or WebP image.');
      res.status(201).json({ photoId: await photos.save(bytes, type) });
    },
  );

  r.post('/orders', limit, async (req, res) => {
    const body = req.body;
    if (!isObj(body)) throw bad('Invalid order.');
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 60) : '';
    if (!name) throw bad('Please enter your name.');
    const whatsapp = typeof body.whatsapp === 'string' ? normalizeWhatsapp(body.whatsapp) : null;
    if (!whatsapp) throw bad('Please enter a valid WhatsApp number, e.g. 0812 3456 7890.');
    if (!isObj(body.recipe)) throw bad('There is no design to order yet.');

    let photoId: string | null = null;
    if (body.photoId != null) {
      if (typeof body.photoId !== 'string' || !(await photos.get(body.photoId))) throw bad('The photo was not uploaded. Please try again.');
      photoId = body.photoId;
    }

    const order = await orders.create({
      product: DEFAULT_PRODUCT,
      customer: { name, whatsapp },
      recipe: normalizeRecipe(body.recipe),
      photoId,
    });
    console.log(`[orders] new order ${order.code}`);
    res.status(201).json({ code: order.code, whatsappUrl: whatsappUrl(order.code, name) } satisfies CreateOrderResponse);
  });

  return r;
}

// ---------------------------------------------------------------------------
// Admin side (shop staff)
// ---------------------------------------------------------------------------

function parsePatch(body: unknown, current: Order): OrderPatch {
  if (!isObj(body)) throw bad('Invalid update.');
  const patch: OrderPatch = {};

  if (body.status !== undefined) {
    if (!ORDER_STATUSES.includes(body.status as OrderStatus)) throw bad('Unknown status.');
    patch.status = body.status as OrderStatus;
  }
  if (body.payment !== undefined) {
    if (!isObj(body.payment)) throw bad('Invalid payment.');
    const { amount, method } = body.payment;
    if (amount !== null && (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0)) throw bad('Invalid amount.');
    if (method !== null && !PAYMENT_METHODS.includes(method as PaymentMethod)) throw bad('Unknown payment method.');
    patch.payment = { ...current.payment, amount: amount as number | null, method: method as PaymentMethod | null };
  }
  if (body.note !== undefined) {
    if (typeof body.note !== 'string') throw bad('Invalid note.');
    patch.note = body.note.slice(0, 1000);
  }

  // Record when it was paid the first time it moves to "paid".
  if (patch.status === 'paid' && !current.payment.paidAt) {
    patch.payment = { ...(patch.payment ?? current.payment), paidAt: new Date().toISOString() };
  }
  return patch;
}

export function adminRoutes(orders: OrderStore, photos: PhotoStore): Router {
  const r = Router();
  r.use(requireStaff);

  r.get('/orders', async (req, res) => {
    const status = ORDER_STATUSES.includes(req.query.status as OrderStatus) ? (req.query.status as OrderStatus) : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 60) : undefined;
    res.json({ orders: (await orders.list({ status, q })).map(summary) });
  });

  r.get('/orders/:id', async (req, res) => {
    const order = await orders.get(req.params.id);
    if (!order) throw new UserFacingError(404, 'Order not found.');
    res.json(order);
  });

  r.patch('/orders/:id', async (req, res) => {
    const current = await orders.get(req.params.id);
    if (!current) throw new UserFacingError(404, 'Order not found.');
    const updated = await orders.update(current.id, parsePatch(req.body, current));
    res.json(updated);
  });

  r.get('/photos/:id', async (req, res) => {
    const photo = await photos.get(req.params.id);
    if (!photo) throw new UserFacingError(404, 'Photo not found.');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.type(photo.type).send(photo.bytes);
  });

  return r;
}
