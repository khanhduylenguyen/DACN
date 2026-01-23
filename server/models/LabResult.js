/**
 * LabResult Model
 */
import mongoose from "mongoose";

const labFileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["pdf", "image"], required: true },
    url: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const labResultSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    testName: { type: String, required: true },
    testDate: { type: Date, required: true },
    facility: { type: String },
    doctor: { type: String },
    files: { type: [labFileSchema], default: [] },
    notes: { type: String },
    uploadedBy: { type: String, enum: ["patient", "lab", "doctor"], default: "patient" },
    uploaderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

labResultSchema.index({ patientId: 1 });
labResultSchema.index({ testDate: -1 });

export default mongoose.model("LabResult", labResultSchema);


