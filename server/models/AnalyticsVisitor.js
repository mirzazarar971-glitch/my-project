import mongoose from 'mongoose'

const analyticsVisitorSchema = new mongoose.Schema({
  visitorHash: { type: String, required: true, unique: true, maxlength: 64 },
  firstSeenAt: { type: Date, required: true },
  lastSeenAt: { type: Date, required: true },
  totalSessions: { type: Number, default: 0, min: 0 },
  country: { type: String, maxlength: 2 },
  deviceCategory: { type: String, enum: ['desktop', 'mobile', 'tablet', 'unknown'] },
  browser: { type: String, maxlength: 40 },
  operatingSystem: { type: String, maxlength: 40 },
  expiresAt: { type: Date, required: true },
}, { versionKey: false })

analyticsVisitorSchema.index({ firstSeenAt: 1 })
analyticsVisitorSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.model('AnalyticsVisitor', analyticsVisitorSchema)
