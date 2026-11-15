import mongoose from 'mongoose'

const toolSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, unique: true, lowercase: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  category: { type: String, required: true, trim: true, maxlength: 60 },
  description: { type: String, required: true, trim: true, maxlength: 500 },
  icon: { type: String, default: 'Wrench', maxlength: 80 },
  isActive: { type: Boolean, default: true, index: true },
  usageCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true })

toolSchema.index({ category: 1, isActive: 1 })

export default mongoose.model('Tool', toolSchema)
