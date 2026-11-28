/**
 * The shop's order page (/admin): list of orders on the left, the selected
 * order on the right. Rough first version, no login yet (see backend/src/auth.ts).
 */
import { useCallback, useEffect, useState } from 'react';
import { ORDER_STATUSES, type OrderStatus, type OrderSummary } from '../../../shared/orders.ts';
import { listOrders } from '../api';
import { OrderDetail } from './OrderDetail';
import { formatDate, STATUS_LABEL } from './format';

type Filter = OrderStatus | 'all';
const FILTERS: Filter[] = ['all', ...ORDER_STATUSES];

export function AdminApp() {
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setOrders((await listOrders(filter, q)).orders);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [filter, q]);

  // Load now, and check for new orders every 15 seconds.
  useEffect(() => {
    const t = setTimeout(refresh, 250); // small delay so typing in search doesn't fire a request per key
    const poll = setInterval(refresh, 15_000);
    return () => {
      clearTimeout(t);
      clearInterval(poll);
    };
  }, [refresh]);

  return (
    <div className="app admin">
      <header className="topbar">
        <div className="brand">
          <img src="/favicon.svg" alt="" width={22} height={22} />
          Tumbler Studio · Orders
        </div>
        <span className="badge badge-warn">No login yet: local use only</span>
      </header>

      <main className="admin-main">
        <section className="order-list">
          <div className="order-list-head">
            <input className="search" placeholder="Search code, name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="filter-row">
              {FILTERS.map((f) => (
                <button key={f} className={`filter ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'All' : STATUS_LABEL[f]}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="form-error pad">{error}</p>}
          {!error && orders.length === 0 && <p className="muted pad">No orders yet.</p>}
          <ul>
            {orders.map((o) => (
              <li key={o.id}>
                <button className={`order-row ${selected === o.id ? 'active' : ''}`} onClick={() => setSelected(o.id)}>
                  <span className="order-row-top">
                    <strong>{o.code}</strong>
                    <span className={`status status-${o.status}`}>{STATUS_LABEL[o.status]}</span>
                  </span>
                  <span className="order-row-name">{o.customer.name}</span>
                  <span className="muted small">
                    {o.title} · {formatDate(o.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="order-detail-wrap">
          {selected ? (
            <OrderDetail key={selected} id={selected} onChanged={refresh} />
          ) : (
            <p className="muted pad">Select an order to see the design and print it.</p>
          )}
        </section>
      </main>
    </div>
  );
}
