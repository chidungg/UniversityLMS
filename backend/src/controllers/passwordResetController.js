import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import AuthSession from '../models/AuthSession.js';
import PasswordResetRequest from '../models/PasswordResetRequest.js';
import { authError, validateEmail, validateNewPassword } from '../config/auth.js';
import { escapeRegex } from '../utils/helpers.js';

const requestDto = (record) => ({
  id: record._id.toString(), email: record.email, note: record.note, status: record.status,
  submittedAt: record.submittedAt, reviewedAt: record.reviewedAt,
  reviewedBy: record.reviewedBy?.toString() || null, resolutionNote: record.resolutionNote,
});
const accountDto = (user) => user ? ({ id: user._id.toString(), name: user.fullName, email: user.email, role: user.role, status: user.isActive ? 'Active' : 'Inactive' }) : null;

export async function createRecoveryRequest(req, res) {
  const { email, note = '' } = req.body || {};
  if (!validateEmail(email) || typeof note !== 'string' || note.length > 500) throw authError(400, 'VALIDATION', 'Email không hợp lệ hoặc ghi chú vượt quá 500 ký tự.');
  // Same response for unknown, inactive and duplicate accounts. Only Admin can resolve identity.
  try { await PasswordResetRequest.create({ email: email.trim().toLowerCase(), note: note.trim() }); }
  catch (error) { if (error.code !== 11000) throw error; }
  res.status(202).json({ status: 'success', message: 'Đã tiếp nhận yêu cầu. Quản trị viên sẽ xác minh thông tin trước khi đặt lại mật khẩu.' });
}

export async function listRecoveryRequests(req, res) {
  const { status, q = '', page = '1', limit = '20' } = req.query;
  if (typeof q !== 'string' || q.length > 254 || !/^\d+$/.test(String(page)) || !/^\d+$/.test(String(limit)) || Number(page) < 1 || Number(page) > 100000 || Number(limit) < 1 || Number(limit) > 100 || (status && !['Pending', 'Completed', 'Rejected'].includes(status))) throw authError(400, 'VALIDATION', 'Bộ lọc không hợp lệ.');
  const filter = { ...(status ? { status } : {}), ...(q.trim() ? { email: { $regex: escapeRegex(q.trim()), $options: 'i' } } : {}) };
  const [records, total] = await Promise.all([
    PasswordResetRequest.find(filter).sort({ submittedAt: -1, _id: -1 }).skip((Number(page) - 1) * Number(limit)).limit(Number(limit)).lean(),
    PasswordResetRequest.countDocuments(filter),
  ]);
  const users = await User.find({ email: { $in: records.map((item) => item.email) } }).select('fullName email role isActive').lean();
  res.json({ status: 'success', requests: records.map(requestDto), users: users.map(accountDto), pagination: { page: Number(page), limit: Number(limit), total } });
}

export async function resolveRecoveryRequest(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) throw authError(400, 'VALIDATION', 'Mã yêu cầu không hợp lệ.');
  const { action, password, confirmPassword, verified, resolutionNote = '' } = req.body || {};
  if (!['complete', 'reject'].includes(action) || typeof resolutionNote !== 'string' || resolutionNote.length > 300 || (action === 'reject' && !resolutionNote.trim())) throw authError(400, 'VALIDATION', 'Vui lòng nhập kết quả xử lý và lý do hợp lệ.');
  if (action === 'complete' && (verified !== true || !validateNewPassword(password) || password !== confirmPassword)) throw authError(400, 'VALIDATION', 'Cần xác minh danh tính và mật khẩu khớp, ít nhất 8 ký tự, tối đa 72 byte UTF-8.');
  const hash = action === 'complete' ? await bcrypt.hash(password, 12) : null;
  let result;
  await mongoose.connection.transaction(async (session) => {
    const record = await PasswordResetRequest.findById(req.params.id).session(session);
    if (!record) throw authError(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu.');
    if (record.status !== 'Pending') throw authError(409, 'ALREADY_PROCESSED', 'Yêu cầu đã được xử lý. Vui lòng tải lại danh sách.');
    const user = await User.findOne({ email: record.email }).select('+passwordHash').session(session);
    if (action === 'complete') {
      if (!user) throw authError(409, 'UNMATCHED_ACCOUNT', 'Không tìm thấy tài khoản khớp với email.');
      if (!user.isActive) throw authError(409, 'ACCOUNT_DISABLED', 'Tài khoản đang bị vô hiệu hóa.');
      if (user._id.equals(req.user._id)) throw authError(409, 'SELF_RESET', 'Hãy dùng chức năng đổi mật khẩu hoặc nhờ quản trị viên khác xác minh yêu cầu của bạn.');
      if (await bcrypt.compare(password, user.passwordHash)) throw authError(400, 'PASSWORD_REUSED', 'Mật khẩu mới phải khác mật khẩu hiện tại.');
      user.passwordHash = hash;
      user.mustChangePassword = true;
      await user.save({ session });
      await AuthSession.deleteMany({ userId: user._id }).session(session);
    }
    record.status = action === 'complete' ? 'Completed' : 'Rejected';
    record.reviewedAt = new Date();
    record.reviewedBy = req.user._id;
    record.accountId = user?._id || null;
    record.resolutionNote = resolutionNote.trim();
    await record.save({ session });
    result = { record: requestDto(record), account: accountDto(user) };
  });
  res.json({ status: 'success', ...result });
}
