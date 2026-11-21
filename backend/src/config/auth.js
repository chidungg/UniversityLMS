import { createHmac } from 'node:crypto';
export const COOKIE_NAME = 'lms_session';
export const SESSION_MS = 8 * 60 * 60 * 1000;
export function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('JWT_SECRET must contain at least 32 bytes.');
  return secret;
}
export const credentialDigest = (passwordHash) => createHmac('sha256', jwtSecret()).update(passwordHash).digest('hex');
export const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
export function publicUser(user) {
  return { _id: user._id.toString(), email: user.email, fullName: user.fullName, role: user.role, isActive: user.isActive, mustChangePassword: Boolean(user.mustChangePassword) };
}
export function authError(statusCode, code, message, fields) {
  return Object.assign(new Error(message), { statusCode, code, fields });
}
export function validateEmail(email) {
  return typeof email === 'string' && email.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
export function validateNewPassword(password) {
  // bcrypt uses at most 72 UTF-8 bytes; never silently truncate a password.
  return typeof password === 'string' && password.trim().length > 0 && password.length >= 8 && Buffer.byteLength(password, 'utf8') <= 72;
}
