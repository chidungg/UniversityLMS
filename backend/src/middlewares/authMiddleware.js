import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import AuthSession from '../models/AuthSession.js';
import { COOKIE_NAME, cookieOptions, jwtSecret, credentialDigest, authError } from '../config/auth.js';
export async function authenticate(req, res, next) {
  const cookie = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  const token = cookie?.slice(COOKIE_NAME.length + 1) || req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  let decoded;
  try {
    decoded = jwt.verify(token || '', jwtSecret(), { algorithms: ['HS256'], issuer: 'university-lms', audience: 'university-lms' });
  } catch (error) {
    if (!['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) return next(error);
    res.clearCookie(COOKIE_NAME, cookieOptions());
    return next(authError(401, 'SESSION_EXPIRED', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'));
  }
  if (!mongoose.isObjectIdOrHexString(decoded.sid) || !mongoose.isObjectIdOrHexString(decoded.sub)) return next(authError(401, 'SESSION_EXPIRED', 'Phiên đăng nhập không hợp lệ.'));
  const [session, user] = await Promise.all([
    AuthSession.findOne({ _id: decoded.sid, userId: decoded.sub, expiresAt: { $gt: new Date() } }).select('+credentialDigest'),
    User.findById(decoded.sub).select('+passwordHash'),
  ]);
  if (!session || !user || session.credentialDigest !== credentialDigest(user.passwordHash)) {
    res.clearCookie(COOKIE_NAME, cookieOptions());
    return next(authError(401, 'SESSION_EXPIRED', 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.'));
  }
  if (!user.isActive) {
    await AuthSession.deleteMany({ userId: user._id });
    res.clearCookie(COOKIE_NAME, cookieOptions());
    return next(authError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị vô hiệu hóa.'));
  }
  req.user = user;
  req.authSession = session;
  next();
}
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(authError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập.'));
  if (!roles.includes(req.user.role)) return next(authError(403, 'FORBIDDEN', 'Bạn không có quyền truy cập nội dung này.'));
  if (req.user.mustChangePassword) return next(authError(403, 'PASSWORD_CHANGE_REQUIRED', 'Vui lòng đổi mật khẩu tạm trước khi tiếp tục.'));
  next();
};
