import mongoose from 'mongoose'

const searchConsoleOAuthStateSchema = new mongoose.Schema({
  stateHash: { type: String, required: true, unique: true, maxlength: 64 },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
}, { versionKey: false })

searchConsoleOAuthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.model('SearchConsoleOAuthState', searchConsoleOAuthStateSchema)
