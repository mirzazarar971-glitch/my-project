import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 70 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
  favorites: [{ type: String, trim: true, maxlength: 100 }],
  recentlyUsed: [{ type: String, trim: true, maxlength: 100 }],
}, { timestamps: true })

export default mongoose.model('User', userSchema)
