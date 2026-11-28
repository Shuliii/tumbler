/**
 * Where orders are kept. The rest of the backend only uses the OrderStore
 * interface, so swapping the JSON file for MySQL later touches only this
 * folder.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Order, OrderStatus } from '../../../shared/orders.ts';

export type NewOrder = Pick<Order, 'product' | 'customer' | 'recipe' | 'photoId'>;
export type OrderPatch = Partial<Pick<Order, 'status' | 'payment' | 'note'>>;

export interface OrderStore {
  create(order: NewOrder): Promise<Order>;
  /** Newest first. */
  list(filter: { status?: OrderStatus; q?: string }): Promise<Order[]>;
  get(id: string): Promise<Order | null>;
  update(id: string, patch: OrderPatch): Promise<Order | null>;
}

/**
 * Development store: one JSON file. Fine for a single server and a few
 * thousand orders; MySQL replaces it before going live.
 */
export class JsonFileOrderStore implements OrderStore {
  private readonly file: string;
  /** Read from disk once; every caller shares the same in-memory copy. */
  private loading: Promise<{ nextNumber: number; orders: Order[] }> | null = null;
  private data: { nextNumber: number; orders: Order[] } | null = null;
  /** Writes are queued so two requests can't overwrite each other. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(dir: string) {
    this.file = path.join(dir, 'orders.json');
  }

  private load() {
    this.loading ??= (async () => {
      try {
        this.data = JSON.parse(await readFile(this.file, 'utf8'));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          this.loading = null; // allow a retry next time
          throw err;
        }
        this.data = { nextNumber: 1, orders: [] };
      }
      return this.data!;
    })();
    return this.loading;
  }

  private async save() {
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    await writeFile(tmp, JSON.stringify(this.data, null, 2));
    await rename(tmp, this.file); // atomic replace: never leaves a half-written file
  }

  private locked<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  create(input: NewOrder) {
    return this.locked(async () => {
      const data = await this.load();
      const now = new Date().toISOString();
      const order: Order = {
        id: randomUUID(),
        code: `TB-${String(data.nextNumber++).padStart(4, '0')}`,
        createdAt: now,
        updatedAt: now,
        status: 'new',
        payment: { amount: null, method: null, paidAt: null },
        note: '',
        ...input,
      };
      data.orders.push(order);
      await this.save();
      return order;
    });
  }

  async list({ status, q }: { status?: OrderStatus; q?: string }) {
    const data = await this.load();
    const needle = q?.trim().toLowerCase();
    // Phone search: numbers are stored as 628…, but staff type 0812… or +62 812….
    let digits = needle?.replace(/\D/g, '') ?? '';
    if (digits.startsWith('0')) digits = '62' + digits.slice(1);
    return data.orders
      .filter((o) => !status || o.status === status)
      .filter(
        (o) =>
          !needle ||
          o.code.toLowerCase().includes(needle) ||
          o.customer.name.toLowerCase().includes(needle) ||
          (digits.length >= 3 && o.customer.whatsapp.includes(digits)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(id: string) {
    const data = await this.load();
    return data.orders.find((o) => o.id === id) ?? null;
  }

  update(id: string, patch: OrderPatch) {
    return this.locked(async () => {
      const data = await this.load();
      const order = data.orders.find((o) => o.id === id);
      if (!order) return null;
      Object.assign(order, patch, { updatedAt: new Date().toISOString() });
      await this.save();
      return order;
    });
  }
}
