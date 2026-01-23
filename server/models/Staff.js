/**
 * Staff Model (Doctors, Nurses, etc.)
 */

import mongoose from "mongoose";

const staffSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    role: { type: String, enum: ["doctor", "nurse", "receptionist"], required: true },
    specialty: { type: String },
    department: { type: String },
    experience: { type: Number }, // years
    education: [{ type: String }],
    certifications: [{ type: String }],
    bio: { type: String },
    avatar: { type: String },
    status: { type: String, enum: ["active", "leave", "suspended"], default: "active" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes
staffSchema.index({ email: 1 });
staffSchema.index({ role: 1, status: 1 });
staffSchema.index({ specialty: 1 });

export default mongoose.model("Staff", staffSchema);

