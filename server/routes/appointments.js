/**
 * Appointments Routes
 */

import express from "express";
import Appointment from "../models/Appointment.js";
import Notification from "../models/Notification.js";

const router = express.Router();

// Get all appointments
router.get("/", async (req, res) => {
  try {
    const { patientId, doctorId, status, date } = req.query;
    const filter = {};

    if (patientId) filter.patientId = patientId;
    if (doctorId) filter.doctorId = doctorId;
    if (status) filter.status = status;
    if (date) filter.date = date;

    const appointments = await Appointment.find(filter)
      .sort({ date: 1, time: 1 })
      .lean();

    res.json({ success: true, data: appointments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get appointment by ID
router.get("/:id", async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id).lean();
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }
    res.json({ success: true, data: appointment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create appointment
router.post("/", async (req, res) => {
  try {
    const appointment = new Appointment(req.body);
    await appointment.save();

    // Create notification for doctor
    if (appointment.doctorId) {
      await Notification.create({
        userId: appointment.doctorId,
        userRole: "doctor",
        type: "appointment_reminder",
        title: `Lịch hẹn mới - ${appointment.patientName}`,
        message: `Bệnh nhân ${appointment.patientName} đã đặt lịch hẹn với bạn vào ${appointment.date} lúc ${appointment.time} (${appointment.specialty}). Vui lòng xác nhận lịch hẹn.`,
        link: "/doctor/appointments",
        priority: "medium",
        relatedId: appointment._id.toString(),
        metadata: {
          appointmentId: appointment._id.toString(),
          patientId: appointment.patientId.toString(),
          patientName: appointment.patientName,
        },
      });
    }

    // Create notification for patient
    if (appointment.patientId) {
      await Notification.create({
        userId: appointment.patientId,
        userRole: "patient",
        type: "appointment",
        title: "Đặt lịch hẹn thành công",
        message: `Lịch hẹn với ${appointment.doctorName} vào ${appointment.date} lúc ${appointment.time} đã được tạo. Vui lòng chờ xác nhận từ phòng khám.`,
        link: "/patient/appointments",
        relatedId: appointment._id.toString(),
      });
    }

    res.status(201).json({ success: true, data: appointment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update appointment
router.put("/:id", async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    // Create notification if status changed
    if (req.body.status) {
      if (req.body.status === "confirmed" && appointment.patientId) {
        await Notification.create({
          userId: appointment.patientId,
          userRole: "patient",
          type: "appointment_confirmed",
          title: "Lịch hẹn đã được xác nhận",
          message: `Lịch hẹn với ${appointment.doctorName} (${appointment.specialty}) vào ${appointment.date} lúc ${appointment.time} đã được xác nhận.`,
          link: "/patient/appointments",
          relatedId: appointment._id.toString(),
        });
      } else if (req.body.status === "cancelled" && appointment.patientId) {
        await Notification.create({
          userId: appointment.patientId,
          userRole: "patient",
          type: "appointment_cancelled",
          title: "Lịch hẹn đã bị hủy",
          message: `Lịch hẹn với ${appointment.doctorName} vào ${appointment.date} lúc ${appointment.time} đã bị hủy.`,
          link: "/patient/appointments",
          relatedId: appointment._id.toString(),
        });
      }
    }

    res.json({ success: true, data: appointment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete appointment
router.delete("/:id", async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndDelete(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }
    res.json({ success: true, message: "Appointment deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

