import mongoose from 'mongoose'

const campaignSchema = new mongoose.Schema({
  source: { type: String, maxlength: 80 },
  medium: { type: String, maxlength: 80 },
  name: { type: String, maxlength: 120 },
}, { _id: false })

const analyticsEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, maxlength: 36 },
  type: {
    type: String,
    required: true,
    enum: ['page_view', 'page_engagement', 'tool_click', 'tool_execution', 'search'],
  },
  visitorHash: { type: String, required: true, maxlength: 64 },
  sessionHash: { type: String, required: true, maxlength: 64 },
  timestamp: { type: Date, required: true, default: Date.now },
  path: { type: String, maxlength: 240 },
  toolSlug: { type: String, maxlength: 100 },
  success: { type: Boolean },
  durationMs: { type: Number, min: 0, max: 1_800_000 },
  queryLength: { type: Number, min: 0, max: 200 },
  resultCount: { type: Number, min: 0, max: 100 },
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
  expiresAt: { type: Date, required: true },
}, { versionKey: false })

analyticsEventSchema.index({ type: 1, timestamp: -1 })
analyticsEventSchema.index({ path: 1, type: 1, timestamp: -1 })
analyticsEventSchema.index({ toolSlug: 1, type: 1, timestamp: -1 })
analyticsEventSchema.index({ sessionHash: 1, type: 1 })
analyticsEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.model('AnalyticsEvent', analyticsEventSchema)
