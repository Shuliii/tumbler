/**
 * Tiny in-memory rate limiter: each visitor (IP) gets `max` requests per
 * window, so nobody can burn through the API credits. In-memory is fine for
 * one server; with several servers this would move to Redis or similar.
 */
import type { RequestHandler } from 'express';

export function rateLimit({ max, windowMs }: { max: number; windowMs: number }): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Forget old visitors now and then so the map doesn't grow forever.
  setInterval(() => {
    const now = Date.now();
    for (const [ip, h] of hits) if (h.resetAt <= now) hits.delete(ip);
  }, windowMs).unref();

  return (req, res, next) => {
    const ip = req.ip ?? 'unknown';
    const now = Date.now();
    let h = hits.get(ip);
    if (!h || h.resetAt <= now) {
      h = { count: 0, resetAt: now + windowMs };
      hits.set(ip, h);
    }
    h.count++;
    if (h.count > max) {
      res.setHeader('Retry-After', Math.ceil((h.resetAt - now) / 1000));
      res.status(429).json({ error: 'You’re designing very fast! Please wait a few minutes and try again.' });
      return;
    }
    next();
  };
}
