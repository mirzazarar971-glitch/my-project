import mongoose from 'mongoose'

const encryptedTokenSchema = new mongoose.Schema({
  ciphertext: { type: String, required: true },
  iv: { type: String, required: true },
  authTag: { type: String, required: true },
}, { _id: false })

const searchConsoleCredentialSchema = new mongoose.Schema({
  _id: { type: String, default: 'primary' },
  propertyUrl: { type: String, required: true, maxlength: 500 },
  encryptedRefreshToken: { type: encryptedTokenSchema, required: true },
  connectedAt: { type: Date, required: true },
  connectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { versionKey: false })

export default mongoose.model('SearchConsoleCredential', searchConsoleCredentialSchema)
