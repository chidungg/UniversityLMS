import { createHash } from 'node:crypto';
import AuthRateLimit from '../models/AuthRateLimit.js';
import { authError } from '../config/auth.js';
export function allowedOrigins() {
  return (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((value) => value.trim());
}
export function protectMutation(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if ((req.headers.origin && !allowedOrigins().includes(req.headers.origin)) || req.get('X-LMS-Request') !== '1') {
    return next(authError(403, 'UNTRUSTED_REQUEST', 'Yêu cầu không hợp lệ. Vui lòng tải lại trang.'));
  }
  next();
}
export function rateLimit(scope, limit, windowMs = 15 * 60 * 1000, byEmail = false) {
  return async (req, res, next) => {
    const key = byEmail ? String(req.body?.email || '').trim().toLowerCase() : req.ip;
    const bucket = Math.floor(Date.now() / windowMs);
    const _id = createHash('sha256').update(`${scope}:${key}:${bucket}`).digest('hex');
    const expiresAt = new Date((bucket + 1) * windowMs);
    let entry;
    try {
      entry = await AuthRateLimit.findOneAndUpdate({ _id }, { $inc: { count: 1 }, $setOnInsert: { expiresAt } }, { upsert: true, returnDocument: 'after' });
    } catch (error) {
      if (error.code !== 11000) throw error;
      entry = await AuthRateLimit.findOneAndUpdate({ _id }, { $inc: { count: 1 } }, { returnDocument: 'after' });
    }
    if (entry.count > limit) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000))));
      return next(authError(429, 'RATE_LIMITED', 'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau.'));
    }
    next();
  };
}
