/**
 * Patients Routes
 */

import express from "express";
import User from "../models/User.js";

const router = express.Router();

// Get all patients
router.get("/", async (req, res) => {
  try {
    const patients = await User.find({ role: "patient" }).select("-password").lean();

    res.json({ success: true, data: patients });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get patient by ID
router.get("/:id", async (req, res) => {
  try {
    const patient = await User.findById(req.params.id).select("-password").lean();
    if (!patient || patient.role !== "patient") {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }
    res.json({ success: true, data: patient });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

