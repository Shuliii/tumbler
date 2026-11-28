/**
 * Tumbler Studio API server.
 *
 *   GET  /api/health   → { ok, model }
 *   POST /api/design   → { reply, recipe }   (see shared/api.ts)
 *
 * The Anthropic API key is read from the environment (.env) and never leaves
 * this process.
 */
import express, { type ErrorRequestHandler } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import type { ApiError } from '../../shared/api.ts';
import { config } from './config.ts';
import { designWithClaude, parseDesignRequest } from './design.ts';
import { UserFacingError } from './errors.ts';
import { rateLimit } from './rateLimit.ts';
import { adminRoutes, customerRoutes } from './orders.ts';
import { JsonFileOrderStore } from './storage/orderStore.ts';
import { LocalPhotoStore } from './storage/photoStore.ts';

const orders = new JsonFileOrderStore(config.dataDir);
const photos = new LocalPhotoStore(config.dataDir);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);
app.use(express.json({ limit: '8mb' }));
app.use('/api', customerRoutes(orders, photos));
app.use('/api/admin', adminRoutes(orders, photos));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, model: config.model, apiKeyConfigured: config.hasApiKey });
});

app.post('/api/design', rateLimit(config.rateLimit), async (req, res) => {
  const designRequest = parseDesignRequest(req.body);
  res.json(await designWithClaude(designRequest));
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found.' } satisfies ApiError);
});

// Turn any error into a safe JSON message. Details go to the server log only.
const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  let status = 500;
  let message = 'Something went wrong on our side. Please try again.';

  if (err instanceof UserFacingError) {
    status = err.status;
    message = err.message;
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    message = 'That image is too large. Please try a smaller one.';
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid request.';
  } else if (err instanceof Anthropic.AuthenticationError) {
    console.error('[design] Anthropic API key missing or invalid. Check backend/.env');
    message = 'The AI designer isn’t set up yet. Please tell the shop.';
  } else if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError) {
    console.error('[design] Anthropic busy:', err.status, err.message);
    status = 503;
    message = 'The AI designer is busy right now. Please try again in a moment.';
  } else if (err instanceof Anthropic.APIError) {
    console.error('[design] Anthropic API error:', err.status, err.message);
    status = 502;
    message = 'The AI designer had a problem. Please try again.';
  } else {
    console.error('[design] Unexpected error:', err);
  }
  res.status(status).json({ error: message } satisfies ApiError);
};
app.use(onError);

// Delete customer photos older than the retention period: now, then once a day.
async function cleanupPhotos() {
  try {
    const n = await photos.deleteOlderThan(config.photoRetentionDays * 86_400_000);
    if (n) console.log(`[photos] deleted ${n} photo(s) older than ${config.photoRetentionDays} days`);
  } catch (err) {
    console.error('[photos] cleanup failed:', err);
  }
}
cleanupPhotos();
setInterval(cleanupPhotos, 86_400_000).unref();

app.listen(config.port, config.host, () => {
  console.log(`API listening on http://${config.host}:${config.port}  (model: ${config.model}, effort: ${config.effort})`);
  if (!config.hasApiKey) {
    console.warn('ANTHROPIC_API_KEY is not set: copy backend/.env.example to backend/.env and add your key.');
  }
});
