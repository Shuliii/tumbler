/**
 * One order: the design (3D / flat), the customer, payment, status buttons
 * and the Print button. "Print" redraws the print file from the recipe and
 * the ORIGINAL photo, the same way the customer saw it, and downloads it
 * (later: into the print software's hot folder).
 */
import { useEffect, useMemo, useState } from 'react';
import { PAYMENT_METHODS, type Order, type OrderStatus, type PaymentMethod, type UpdateOrderRequest } from '../../../shared/orders.ts';
import { WRAP } from '../recipe';
import { adminPhotoUrl, getOrder, updateOrder } from '../api';
import { drawWrap, prepareFonts, type RenderStats } from '../render/renderWrap';
import { downloadPng } from '../render/exportPng';
import { Tumbler3D } from '../components/Tumbler3D';
import { FlatView } from '../components/FlatView';
import { METHOD_LABEL, STATUS_LABEL, formatDate, formatRupiah } from './format';

interface Props {
  id: string;
  onChanged(): void;
}

const PRINTABLE: OrderStatus[] = ['paid', 'printed', 'done'];

async function loadPhoto(photoId: string) {
  const img = new Image();
  img.src = adminPhotoUrl(photoId);
  try {
    await img.decode();
  } catch {
    throw new Error('The customer’s photo is no longer available (photos are deleted after 30 days).');
  }
  return img;
}

export function OrderDetail({ id, onChanged }: Props) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'3d' | 'flat'>('3d');
  const [version, setVersion] = useState(0);
  const [stats, setStats] = useState<RenderStats>({ photoPpi: null });
  const [ready, setReady] = useState(false);

  // Form fields
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('transfer');
  const [note, setNote] = useState('');

  const canvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = WRAP.widthPx;
    c.height = WRAP.heightPx;
    return c;
  }, []);

  // Load the order, then its photo, then draw the print file.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const o = await getOrder(id);
        if (cancelled) return;
        setOrder(o);
        setAmount(o.payment.amount != null ? String(o.payment.amount) : '');
        setMethod(o.payment.method ?? 'transfer');
        setNote(o.note);
        const photo = o.photoId ? await loadPhoto(o.photoId) : null;
        await prepareFonts(o.recipe).catch(() => undefined);
        if (cancelled) return;
        setStats(drawWrap(canvas, o.recipe, photo));
        setVersion((v) => v + 1);
        setReady(true);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this order.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, canvas]);

  async function save(patch: UpdateOrderRequest) {
    if (!order) return;
    setSaving(true);
    setError('');
    try {
      setOrder(await updateOrder(order.id, patch));
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function markPaid() {
    // Indonesian format: "150.000" or "Rp 150.000,00" → 150000. Anything after a comma is cents (ignored).
    const digits = amount.split(',')[0].replace(/\D/g, '');
    if (amount.trim() && !digits) {
      setError('Amount should be a number, e.g. 150000 (or leave it empty).');
      return;
    }
    save({ status: 'paid', payment: { amount: digits ? Number(digits) : null, method } });
  }

  async function print() {
    if (!order) return;
    try {
      await downloadPng(canvas, `${order.code}.png`, WRAP.dpi);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!order) return <p className={error ? 'form-error pad' : 'muted pad'}>{error || 'Loading…'}</p>;

  const s = order.status;
  const waLink = `https://wa.me/${order.customer.whatsapp}?text=${encodeURIComponent(`Halo ${order.customer.name}, ini dari toko tumbler soal pesanan ${order.code}.`)}`;
  const ppi = stats.photoPpi;

  return (
    <div className="order-detail">
      <div className="order-detail-head">
        <div>
          <h2>
            {order.code} <span className={`status status-${s}`}>{STATUS_LABEL[s]}</span>
          </h2>
          <p className="muted small">
            {order.recipe.title} · {order.product} · ordered {formatDate(order.createdAt)}
          </p>
        </div>
        <div className="tabs">
          <button className={view === '3d' ? 'active' : ''} onClick={() => setView('3d')}>
            3D
          </button>
          <button className={view === 'flat' ? 'active' : ''} onClick={() => setView('flat')}>
            Flat print
          </button>
        </div>
      </div>

      <div className="stage admin-stage">
        {view === '3d' ? (
          <Tumbler3D source={canvas} version={version} autoRotate={false} />
        ) : (
          <FlatView source={canvas} version={version} seamCheck={false} />
        )}
        {!ready && <div className="stage-empty">Drawing design…</div>}
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="admin-cards">
        <div className="card">
          <h3>Customer</h3>
          <p>
            <strong>{order.customer.name}</strong>
          </p>
          <p>
            <a href={waLink} target="_blank" rel="noreferrer">
              WhatsApp +{order.customer.whatsapp}
            </a>
          </p>
        </div>

        <div className="card">
          <h3>Payment</h3>
          {order.payment.paidAt ? (
            <p>
              Paid {order.payment.amount != null ? formatRupiah(order.payment.amount) : ''}
              {order.payment.method ? ` · ${METHOD_LABEL[order.payment.method]}` : ''}
              <br />
              <span className="muted small">{formatDate(order.payment.paidAt)}</span>
            </p>
          ) : (
            <>
              <div className="pay-row">
                <input
                  className="amount"
                  inputMode="numeric"
                  placeholder="Amount (Rp)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {METHOD_LABEL[m]}
                    </option>
                  ))}
                </select>
              </div>
              <button className="primary-btn" disabled={saving || s === 'cancelled'} onClick={markPaid}>
                Mark paid
              </button>
            </>
          )}
        </div>

        <div className="card">
          <h3>Production</h3>
          <button
            className="primary-btn"
            disabled={!ready || !PRINTABLE.includes(s)}
            title={PRINTABLE.includes(s) ? '' : 'Mark the order as paid first'}
            onClick={print}
          >
            Print (download PNG)
          </button>
          {ppi !== null && (
            <p className={`small quality ${ppi >= 200 ? 'quality-good' : ppi >= 130 ? 'quality-ok' : 'quality-low'}`}>
              Photo prints at {Math.round(ppi)} ppi
            </p>
          )}
          <div className="status-actions">
            {s === 'paid' && (
              <button className="secondary-btn" disabled={saving} onClick={() => save({ status: 'printed' })}>
                Mark printed
              </button>
            )}
            {s === 'printed' && (
              <button className="secondary-btn" disabled={saving} onClick={() => save({ status: 'done' })}>
                Mark done (picked up)
              </button>
            )}
            {s !== 'cancelled' && s !== 'done' && (
              <button
                className="link-btn danger"
                disabled={saving}
                onClick={() => confirm(`Cancel order ${order.code}?`) && save({ status: 'cancelled' })}
              >
                Cancel order
              </button>
            )}
            {s === 'cancelled' && (
              <button
                className="secondary-btn"
                disabled={saving}
                onClick={() => save({ status: order.payment.paidAt ? 'paid' : 'new' })}
              >
                Reopen
              </button>
            )}
          </div>
        </div>

        <div className="card card-wide">
          <h3>Notes</h3>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. picks up Saturday" rows={2} />
          <button className="secondary-btn" disabled={saving || note === order.note} onClick={() => save({ note })}>
            Save note
          </button>
        </div>
      </div>
    </div>
  );
}
