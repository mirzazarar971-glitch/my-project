import mongoose from 'mongoose'

const campaignSchema = new mongoose.Schema({
  source: { type: String, maxlength: 80 },
  medium: { type: String, maxlength: 80 },
  name: { type: String, maxlength: 120 },
}, { _id: false })

const analyticsSessionSchema = new mongoose.Schema({
  visitorHash: { type: String, required: true, maxlength: 64 },
  sessionHash: { type: String, required: true, maxlength: 64 },
  startedAt: { type: Date, required: true },
  lastSeenAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  firstPath: { type: String, maxlength: 240 },
  lastPath: { type: String, maxlength: 240 },
  trafficSource: {
    type: String,
    enum: ['direct', 'organic', 'social', 'referral', 'campaign'],
  },
  referrerHost: { type: String, maxlength: 253 },
  campaign: { type: campaignSchema, default: undefined },
  country: { type: String, maxlength: 2 },
  deviceCategory: { type: String, enum: ['desktop', 'mobile', 'tablet', 'unknown'] },
  browser: { type: String, maxlength: 40 },
  operatingSystem: { type: String, maxlength: 40 },
}, { versionKey: false })

analyticsSessionSchema.index({ visitorHash: 1, sessionHash: 1 }, { unique: true })
analyticsSessionSchema.index({ startedAt: -1 })
analyticsSessionSchema.index({ lastSeenAt: -1 })
analyticsSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.model('AnalyticsSession', analyticsSessionSchema)
