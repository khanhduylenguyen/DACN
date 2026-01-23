/**
 * Prescription Model
 */

import mongoose from "mongoose";

const prescriptionSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    patientName: { type: String, required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    doctorName: { type: String, required: true },
    date: { type: Date, default: Date.now },
    drugs: [
      {
        name: { type: String, required: true },
        dose: { type: String, required: true },
        quantity: { type: String },
        instructions: { type: String },
      },
    ],
    diagnosis: { type: String },
    notes: { type: String },
    status: { type: String, enum: ["active", "completed", "cancelled"], default: "active" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes
prescriptionSchema.index({ patientId: 1 });
prescriptionSchema.index({ doctorId: 1 });
prescriptionSchema.index({ status: 1 });

export default mongoose.model("Prescription", prescriptionSchema);

