/**
 * "Order this design": the customer leaves a name + WhatsApp number and gets
 * an order code. Payment is arranged with the shop (transfer / QRIS / cash).
 */
import { useState } from 'react';
import type { CreateOrderResponse } from '../../../shared/orders.ts';

interface Props {
  onSubmit(name: string, whatsapp: string): Promise<CreateOrderResponse>;
  onClose(): void;
}

export function OrderDialog({ onSubmit, onClose }: Props) {
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<CreateOrderResponse | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setDone(await onSubmit(name, whatsapp));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  // Don't let the dialog close mid-upload, or the customer never sees their order code.
  const close = () => !busy && onClose();

  return (
    <div className="dialog-backdrop" onClick={close}>
      <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <>
            <h2>Order received!</h2>
            <p>
              Your order code is <strong className="order-code">{done.code}</strong>
            </p>
            <p className="muted">The shop will contact you on WhatsApp about payment and pickup.</p>
            <div className="dialog-actions">
              {done.whatsappUrl && (
                <a className="primary-btn" href={done.whatsappUrl} target="_blank" rel="noreferrer">
                  Send order on WhatsApp
                </a>
              )}
              <button className="secondary-btn" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <h2>Order this design</h2>
            <p className="muted">Leave your name and WhatsApp number. You pay the shop directly (transfer, QRIS or cash).</p>
            <label className="field">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required autoFocus />
            </label>
            <label className="field">
              WhatsApp number
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                inputMode="tel"
                placeholder="0812 3456 7890"
                required
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <div className="dialog-actions">
              <button type="submit" className="primary-btn" disabled={busy}>
                {busy ? 'Sending…' : 'Place order'}
              </button>
              <button type="button" className="secondary-btn" disabled={busy} onClick={close}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
