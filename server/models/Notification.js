/**
 * Notification Model
 */

import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userRole: { type: String, enum: ["patient", "doctor", "admin"], required: true },
    type: {
      type: String,
      enum: [
        "appointment",
        "appointment_reminder",
        "appointment_confirmed",
        "appointment_cancelled",
        "ehr",
        "prescription",
        "prescription_new",
        "followup_reminder",
        "system",
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String },
    read: { type: Boolean, default: false },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    relatedId: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
    readAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });

export default mongoose.model("Notification", notificationSchema);

