/**
 * Staff Routes
 */

import express from "express";
import Staff from "../models/Staff.js";

const router = express.Router();

// Get all staff
router.get("/", async (req, res) => {
  try {
    const { role, status, specialty } = req.query;
    const filter = {};

    if (role) filter.role = role;
    if (status) filter.status = status;
    if (specialty) filter.specialty = specialty;

    const staff = await Staff.find(filter).lean();

    res.json({ success: true, data: staff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get staff by ID
router.get("/:id", async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id).lean();
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }
    res.json({ success: true, data: staff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create staff
router.post("/", async (req, res) => {
  try {
    const staff = new Staff(req.body);
    await staff.save();

    res.status(201).json({ success: true, data: staff });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update staff
router.put("/:id", async (req, res) => {
  try {
    const staff = await Staff.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }

    res.json({ success: true, data: staff });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete staff
router.delete("/:id", async (req, res) => {
  try {
    const staff = await Staff.findByIdAndDelete(req.params.id);
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }
    res.json({ success: true, message: "Staff deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

