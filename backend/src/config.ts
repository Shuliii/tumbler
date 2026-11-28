/** Settings from environment variables (.env in development). */

const EFFORTS = ['low', 'medium', 'high'] as const;
type Effort = (typeof EFFORTS)[number];

// Named DESIGN_* (not CLAUDE_*) so they can't clash with other tools' variables.
const effort = process.env.DESIGN_EFFORT as Effort | undefined;

/** Express "trust proxy": a hop count ("1"), "true"/"false", or names/IPs ("loopback", "10.0.0.0/8"). */
function trustProxy(v: string | undefined): boolean | number | string {
  if (!v) return 'loopback';
  if (/^\d+$/.test(v)) return Number(v);
  if (v === 'true' || v === 'false') return v === 'true';
  return v;
}

export const config = {
  port: Number(process.env.PORT) || 8787,
  /**
   * Network address to listen on. Default: this machine only, because the
   * admin API has no login yet. Set HOST=0.0.0.0 (e.g. in a container) only
   * once staff login exists.
   */
  host: process.env.HOST || '127.0.0.1',
  /** Behind a reverse proxy / ingress, tell Express which proxies to trust so req.ip is the real visitor. */
  trustProxy: trustProxy(process.env.TRUST_PROXY),
  model: process.env.DESIGN_MODEL || 'claude-opus-5-5',
  effort: effort && EFFORTS.includes(effort) ? effort : ('low' as Effort),
  hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
  /** Where orders.json and photos/ are kept (development storage). */
  dataDir: process.env.DATA_DIR || 'data',
  /** The shop's WhatsApp number in international digits (e.g. 628123456789), for the "send order" link. */
  shopWhatsapp: (process.env.SHOP_WHATSAPP || '').replace(/\D/g, '') || null,
  /** Customer photos are personal data: delete them after this many days. */
  photoRetentionDays: Number(process.env.PHOTO_RETENTION_DAYS) || 30,
  /** Per visitor (IP): at most this many design requests per window. */
  rateLimit: { max: 30, windowMs: 10 * 60_000 },
};
