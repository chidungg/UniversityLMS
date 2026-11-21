import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  credentialDigest: { type: String, required: true, select: false },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
}, { collection: 'authsessions', autoCreate: false, autoIndex: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'auth_session_expiry' });
schema.index({ userId: 1 }, { name: 'auth_sessions_by_user' });
export default mongoose.model('AuthSession', schema);
