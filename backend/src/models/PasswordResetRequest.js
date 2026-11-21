import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  note: { type: String, default: '', maxlength: 500 },
  status: { type: String, enum: ['Pending', 'Completed', 'Rejected'], default: 'Pending' },
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolutionNote: { type: String, default: '', maxlength: 300 },
}, { collection: 'passwordresetrequests', autoCreate: false, autoIndex: false });
schema.index({ email: 1 }, { unique: true, partialFilterExpression: { status: 'Pending' }, name: 'one_pending_reset_per_email' });
schema.index({ status: 1, submittedAt: -1 }, { name: 'reset_queue' });
export default mongoose.model('PasswordResetRequest', schema);
