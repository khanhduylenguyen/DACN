/**
 * EHR (Electronic Health Record) Model
 */

import mongoose from "mongoose";

const ehrSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    patientName: { type: String, required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    doctorName: { type: String, required: true },
    visitDate: { type: Date, required: true },
    diagnosis: { type: String, required: true },
    conclusion: { type: String },
    vitals: {
      bpSys: { type: Number },
      bpDia: { type: Number },
      hr: { type: Number },
      weight: { type: Number },
      height: { type: Number },
      bmi: { type: Number },
    },
    labs: [
      {
        name: { type: String },
        result: { type: mongoose.Schema.Types.Mixed },
        unit: { type: String },
        ref: { type: String },
        status: { type: String },
      },
    ],
    images: [{ type: String }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes
ehrSchema.index({ patientId: 1 });
ehrSchema.index({ doctorId: 1 });
ehrSchema.index({ visitDate: -1 });

export default mongoose.model("EHR", ehrSchema);

