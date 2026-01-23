/**
 * Patient Notifications Service
 * Helper functions to create notifications for patients
 */

export type PatientNotificationType =
  | "appointment"
  | "appointment_reminder"
  | "appointment_confirmed"
  | "appointment_cancelled"
  | "ehr"
  | "prescription"
  | "system";

export interface PatientNotification {
  id: string;
  patientId: string;
  type: PatientNotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
  relatedId?: string; // ID của appointment, prescription, etc.
}

const PATIENT_NOTIFICATIONS_KEY = "cliniccare:notifications";

/**
 * Create a notification for patient
 */
export function createPatientNotification(
  notification: Omit<PatientNotification, "id" | "createdAt" | "read">
): PatientNotification {
  try {
    const stored = localStorage.getItem(PATIENT_NOTIFICATIONS_KEY);
    const allNotifications: PatientNotification[] = stored ? JSON.parse(stored) : [];

    const newNotification: PatientNotification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      read: false,
      createdAt: new Date().toISOString(),
    };

    allNotifications.push(newNotification);
    localStorage.setItem(PATIENT_NOTIFICATIONS_KEY, JSON.stringify(allNotifications));
    window.dispatchEvent(new CustomEvent("notificationsUpdated"));

    return newNotification;
  } catch (error) {
    console.error("Error creating patient notification:", error);
    throw error;
  }
}

/**
 * Create appointment confirmed notification
 */
export function createAppointmentConfirmedNotification(
  patientId: string,
  appointment: {
    id: string;
    doctorName: string;
    date: string;
    time: string;
    specialty: string;
  }
): PatientNotification {
  return createPatientNotification({
    patientId,
    type: "appointment_confirmed",
    title: "Lịch hẹn đã được xác nhận",
    message: `Lịch hẹn với ${appointment.doctorName} (${appointment.specialty}) vào ${new Date(appointment.date).toLocaleDateString("vi-VN")} lúc ${appointment.time} đã được xác nhận.`,
    link: "/patient/appointments",
    relatedId: appointment.id,
  });
}

/**
 * Create appointment cancelled notification
 */
export function createAppointmentCancelledNotification(
  patientId: string,
  appointment: {
    id: string;
    doctorName: string;
    date: string;
    time: string;
    reason?: string;
  }
): PatientNotification {
  return createPatientNotification({
    patientId,
    type: "appointment_cancelled",
    title: "Lịch hẹn đã bị hủy",
    message: `Lịch hẹn với ${appointment.doctorName} vào ${new Date(appointment.date).toLocaleDateString("vi-VN")} lúc ${appointment.time} đã bị hủy.${appointment.reason ? ` Lý do: ${appointment.reason}` : ""}`,
    link: "/patient/appointments",
    relatedId: appointment.id,
  });
}

/**
 * Create prescription notification
 */
export function createPrescriptionNotification(
  patientId: string,
  prescription: {
    id: string;
    doctorName: string;
    diagnosis?: string;
  }
): PatientNotification {
  return createPatientNotification({
    patientId,
    type: "prescription",
    title: "Đơn thuốc mới",
    message: `Bác sĩ ${prescription.doctorName} đã kê đơn thuốc cho bạn${prescription.diagnosis ? ` - Chẩn đoán: ${prescription.diagnosis}` : ""}.`,
    link: "/patient/prescriptions",
    relatedId: prescription.id,
  });
}

/**
 * Create EHR notification
 */
export function createEHRNotification(
  patientId: string,
  ehr: {
    id: string;
    doctorName: string;
    diagnosis: string;
    visitDate: string;
  }
): PatientNotification {
  return createPatientNotification({
    patientId,
    type: "ehr",
    title: "Hồ sơ bệnh án mới",
    message: `Bác sĩ ${ehr.doctorName} đã tạo hồ sơ bệnh án cho bạn - Chẩn đoán: ${ehr.diagnosis}`,
    link: "/patient/records",
    relatedId: ehr.id,
  });
}

