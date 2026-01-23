/**
 * EHR Routes
 */

import express from "express";
import EHR from "../models/EHR.js";
import Notification from "../models/Notification.js";

const router = express.Router();

// Get all EHR records
router.get("/", async (req, res) => {
  try {
    const { patientId, doctorId } = req.query;
    const filter = {};

    if (patientId) filter.patientId = patientId;
    if (doctorId) filter.doctorId = doctorId;

    const ehrRecords = await EHR.find(filter)
      .sort({ visitDate: -1 })
      .lean();

    res.json({ success: true, data: ehrRecords });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get EHR by patient ID
router.get("/patient/:patientId", async (req, res) => {
  try {
    const ehrRecords = await EHR.find({ patientId: req.params.patientId })
      .sort({ visitDate: -1 })
      .lean();

    res.json({ success: true, data: ehrRecords });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get EHR by ID
router.get("/:id", async (req, res) => {
  try {
    const ehr = await EHR.findById(req.params.id).lean();
    if (!ehr) {
      return res.status(404).json({ success: false, message: "EHR not found" });
    }
    res.json({ success: true, data: ehr });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create EHR
router.post("/", async (req, res) => {
  try {
    const ehr = new EHR(req.body);
    await ehr.save();

    // Create notification for patient
    if (ehr.patientId) {
      await Notification.create({
        userId: ehr.patientId,
        userRole: "patient",
        type: "ehr",
        title: "Hồ sơ bệnh án mới",
        message: `Bác sĩ ${ehr.doctorName} đã tạo hồ sơ bệnh án cho bạn - Chẩn đoán: ${ehr.diagnosis}`,
        link: "/patient/records",
        relatedId: ehr._id.toString(),
      });
    }

    res.status(201).json({ success: true, data: ehr });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update EHR
router.put("/:id", async (req, res) => {
  try {
    const ehr = await EHR.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!ehr) {
      return res.status(404).json({ success: false, message: "EHR not found" });
    }

    res.json({ success: true, data: ehr });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete EHR
router.delete("/:id", async (req, res) => {
  try {
    const ehr = await EHR.findByIdAndDelete(req.params.id);
    if (!ehr) {
      return res.status(404).json({ success: false, message: "EHR not found" });
    }
    res.json({ success: true, message: "EHR deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

