/**
 * Prescriptions Routes
 */

import express from "express";
import Prescription from "../models/Prescription.js";
import Notification from "../models/Notification.js";

const router = express.Router();

// Get all prescriptions
router.get("/", async (req, res) => {
  try {
    const { patientId, doctorId, status } = req.query;
    const filter = {};

    if (patientId) filter.patientId = patientId;
    if (doctorId) filter.doctorId = doctorId;
    if (status) filter.status = status;

    const prescriptions = await Prescription.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: prescriptions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get prescription by ID
router.get("/:id", async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id).lean();
    if (!prescription) {
      return res.status(404).json({ success: false, message: "Prescription not found" });
    }
    res.json({ success: true, data: prescription });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create prescription
router.post("/", async (req, res) => {
  try {
    const prescription = new Prescription(req.body);
    await prescription.save();

    // Create notification for patient
    if (prescription.patientId) {
      await Notification.create({
        userId: prescription.patientId,
        userRole: "patient",
        type: "prescription",
        title: "Đơn thuốc mới",
        message: `Bác sĩ ${prescription.doctorName} đã kê đơn thuốc cho bạn${prescription.diagnosis ? ` - Chẩn đoán: ${prescription.diagnosis}` : ""}.`,
        link: "/patient/prescriptions",
        relatedId: prescription._id.toString(),
      });
    }

    res.status(201).json({ success: true, data: prescription });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update prescription
router.put("/:id", async (req, res) => {
  try {
    const prescription = await Prescription.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!prescription) {
      return res.status(404).json({ success: false, message: "Prescription not found" });
    }

    res.json({ success: true, data: prescription });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete prescription
router.delete("/:id", async (req, res) => {
  try {
    const prescription = await Prescription.findByIdAndDelete(req.params.id);
    if (!prescription) {
      return res.status(404).json({ success: false, message: "Prescription not found" });
    }
    res.json({ success: true, message: "Prescription deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

