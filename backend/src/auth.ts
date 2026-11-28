/**
 * Gatekeeper for everything under /api/admin.
 *
 * TODO(auth): there is NO staff login yet. Until there is, only requests from
 * this machine itself are allowed (the shop laptop, or the Vite dev proxy).
 * Adding login = replacing the check below with a staff-session check (plus a
 * login route and page); no admin route needs to change.
 */
import type { RequestHandler } from 'express';
import { UserFacingError } from './errors.ts';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export const requireStaff: RequestHandler = (req, _res, next) => {
  // The raw socket address, not req.ip: a proxy could fake X-Forwarded-For.
  if (!LOOPBACK.has(req.socket.remoteAddress ?? '')) {
    throw new UserFacingError(403, 'The admin page is only available on the shop computer.');
  }
  next();
};
