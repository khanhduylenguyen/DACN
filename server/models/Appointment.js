/**
 * Appointment Model
 */

import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    patientName: { type: String, required: true },
    patientPhone: { type: String, required: true },
    patientEmail: { type: String },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    doctorName: { type: String, required: true },
    specialty: { type: String, required: true },
    date: { type: String, required: true }, // ISO date string
    time: { type: String, required: true },
    notes: { type: String },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed"],
      default: "pending",
    },
    reminders: {
      sent24h: { type: Boolean, default: false },
      sent24hAt: { type: Date },
      sent2h: { type: Boolean, default: false },
      sent2hAt: { type: Date },
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes
appointmentSchema.index({ patientId: 1 });
appointmentSchema.index({ doctorId: 1 });
appointmentSchema.index({ date: 1, time: 1 });
appointmentSchema.index({ status: 1 });

export default mongoose.model("Appointment", appointmentSchema);

