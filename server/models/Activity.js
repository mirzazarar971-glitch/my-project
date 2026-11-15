import mongoose from 'mongoose'

const activitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  toolId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tool', required: true, index: true },
  action: { type: String, enum: ['used'], required: true, default: 'used' },
  timestamp: { type: Date, default: Date.now, index: true },
}, { versionKey: false })

activitySchema.index({ timestamp: -1 })

export default mongoose.model('Activity', activitySchema)
