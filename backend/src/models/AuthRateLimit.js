import mongoose from 'mongoose';
const schema = new mongoose.Schema({ _id: String, count: { type: Number, default: 0 }, expiresAt: { type: Date, required: true } }, { collection: 'authratelimits', autoCreate: false, autoIndex: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'auth_rate_expiry' });
export default mongoose.model('AuthRateLimit', schema);
