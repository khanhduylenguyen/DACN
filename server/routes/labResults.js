/**
 * Lab Results Routes
 */
import express from "express";
import LabResult from "../models/LabResult.js";
import Notification from "../models/Notification.js";

const router = express.Router();

// Get lab results (supports ?patientId=)
router.get("/", async (req, res) => {
  try {
    const { patientId } = req.query;
    const filter = {};
    if (patientId) filter.patientId = patientId;

    const results = await LabResult.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get by id
router.get("/:id", async (req, res) => {
  try {
    const result = await LabResult.findById(req.params.id).lean();
    if (!result) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create lab result
router.post("/", async (req, res) => {
  try {
    const payload = req.body;
    const result = await LabResult.create(payload);

    // If uploaded by lab/doctor, create notification for patient
    if (result.patientId && result.uploadedBy && result.uploadedBy !== "patient") {
      try {
        await Notification.create({
          userId: result.patientId,
          userRole: "patient",
          type: "lab_result",
          title: "Kết quả xét nghiệm mới",
          message: `Bạn có kết quả xét nghiệm mới: ${result.testName}`,
          link: "/patient/test-results",
          relatedId: result._id.toString(),
        });
      } catch (nErr) {
        console.error("Failed to create notification:", nErr);
      }
    }

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update
router.put("/:id", async (req, res) => {
  try {
    const updated = await LabResult.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await LabResult.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;


