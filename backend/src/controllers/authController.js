import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import AuthSession from '../models/AuthSession.js';
import { COOKIE_NAME, SESSION_MS, jwtSecret, credentialDigest, cookieOptions, publicUser, authError, validateEmail, validateNewPassword } from '../config/auth.js';
const dummyHash = bcrypt.hashSync('not-a-real-account-password', 12);

export async function login(req, res) {
  const { email, password } = req.body || {};
  if (!validateEmail(email) || typeof password !== 'string' || !password || Buffer.byteLength(password) > 1024) throw authError(400, 'VALIDATION', 'Vui lòng nhập email và mật khẩu hợp lệ.');
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
  const matches = await bcrypt.compare(password, user?.passwordHash || dummyHash);
  if (!user || !matches) throw authError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
  if (!user.isActive) throw authError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.');
  const session = await AuthSession.create({ userId: user._id, credentialDigest: credentialDigest(user.passwordHash), expiresAt: new Date(Date.now() + SESSION_MS) });
  const token = jwt.sign({ sub: user._id.toString(), sid: session._id.toString() }, jwtSecret(), { algorithm: 'HS256', expiresIn: SESSION_MS / 1000, issuer: 'university-lms', audience: 'university-lms' });
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: SESSION_MS });
  res.status(200).json({ status: 'success', user: publicUser(user) });
}
export async function getMe(req, res) {
  res.json({ status: 'success', user: publicUser(req.user) });
}
export async function logout(req, res) {
  await AuthSession.deleteOne({ _id: req.authSession._id });
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.status(204).end();
}
export async function changePassword(req, res) {
  const { currentPassword, password, confirmPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || Buffer.byteLength(currentPassword) > 1024 || !validateNewPassword(password) || password !== confirmPassword) throw authError(400, 'VALIDATION', 'Mật khẩu mới cần ít nhất 8 ký tự, tối đa 72 byte UTF-8 và xác nhận khớp.');
  if (!await bcrypt.compare(currentPassword, req.user.passwordHash)) throw authError(400, 'INVALID_CURRENT_PASSWORD', 'Mật khẩu hiện tại không đúng.');
  if (await bcrypt.compare(password, req.user.passwordHash)) throw authError(400, 'PASSWORD_REUSED', 'Mật khẩu mới phải khác mật khẩu hiện tại.');
  const passwordHash = await bcrypt.hash(password, 12);
  await mongoose.connection.transaction(async (session) => {
    const updated = await User.updateOne({ _id: req.user._id, passwordHash: req.user.passwordHash, isActive: true }, { $set: { passwordHash, mustChangePassword: false } }, { session });
    if (!updated.modifiedCount) throw authError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã thay đổi. Vui lòng đăng nhập lại.');
    await AuthSession.deleteMany({ userId: req.user._id }).session(session);
  });
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.json({ status: 'success', message: 'Đã đổi mật khẩu. Vui lòng đăng nhập lại.' });
}
