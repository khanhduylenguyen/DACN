/**
 * Doctor Notifications Service
 * Quản lý thông báo và nhắc nhở cho bác sĩ
 */

export type DoctorNotificationType =
  | "appointment_reminder" // Nhắc lịch khám sắp tới
  | "appointment_upcoming" // Lịch khám sắp bắt đầu
  | "prescription_new" // Đơn thuốc mới cần xử lý
  | "followup_reminder" // Nhắc tái khám bệnh nhân
  | "system"; // Thông báo hệ thống

export interface DoctorNotification {
  id: string;
  doctorId: string;
  type: DoctorNotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  priority: "low" | "medium" | "high";
  createdAt: string;
  relatedId?: string; // ID của appointment, prescription, etc.
  metadata?: {
    appointmentId?: string;
    patientId?: string;
    patientName?: string;
    prescriptionId?: string;
    reminderDate?: string;
  };
}

// Import follow-up helper (avoid CommonJS require in browser)
import { getFollowUpReminders } from "./patient-followup";

const DOCTOR_NOTIFICATIONS_KEY = "cliniccare:doctor-notifications";

/**
 * Get all notifications for a doctor
 */
export function getDoctorNotifications(
  doctorId: string,
  filters?: {
    type?: DoctorNotificationType;
    read?: boolean;
    priority?: DoctorNotification["priority"];
  }
): DoctorNotification[] {
  try {
    const stored = localStorage.getItem(DOCTOR_NOTIFICATIONS_KEY);
    if (!stored) return [];

    const allNotifications: DoctorNotification[] = JSON.parse(stored);
    let filtered = allNotifications.filter((n) => n.doctorId === doctorId);

    if (filters) {
      if (filters.type) {
        filtered = filtered.filter((n) => n.type === filters.type);
      }
      if (filters.read !== undefined) {
        filtered = filtered.filter((n) => n.read === filters.read);
      }
      if (filters.priority) {
        filtered = filtered.filter((n) => n.priority === filters.priority);
      }
    }

    return filtered.sort((a, b) => {
      // Sort by priority first (high > medium > low)
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by read status (unread first)
      if (a.read !== b.read) return a.read ? 1 : -1;

      // Finally by date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  } catch (error) {
    console.error("Error loading doctor notifications:", error);
    return [];
  }
}

/**
 * Create a notification
 */
export function createDoctorNotification(
  notification: Omit<DoctorNotification, "id" | "createdAt" | "read">
): DoctorNotification {
  try {
    const stored = localStorage.getItem(DOCTOR_NOTIFICATIONS_KEY);
    const allNotifications: DoctorNotification[] = stored ? JSON.parse(stored) : [];

    const newNotification: DoctorNotification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      read: false,
      createdAt: new Date().toISOString(),
    };

    allNotifications.push(newNotification);
    localStorage.setItem(DOCTOR_NOTIFICATIONS_KEY, JSON.stringify(allNotifications));
    window.dispatchEvent(new CustomEvent("doctorNotificationsUpdated"));

    return newNotification;
  } catch (error) {
    console.error("Error creating doctor notification:", error);
    throw error;
  }
}

/**
 * Mark notification as read
 */
export function markNotificationAsRead(notificationId: string, doctorId: string): void {
  try {
    const stored = localStorage.getItem(DOCTOR_NOTIFICATIONS_KEY);
    if (!stored) return;

    const allNotifications: DoctorNotification[] = JSON.parse(stored);
    const updated = allNotifications.map((n) =>
      n.id === notificationId && n.doctorId === doctorId ? { ...n, read: true } : n
    );

    localStorage.setItem(DOCTOR_NOTIFICATIONS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("doctorNotificationsUpdated"));
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
}

/**
 * Mark all notifications as read
 */
export function markAllNotificationsAsRead(doctorId: string): void {
  try {
    const stored = localStorage.getItem(DOCTOR_NOTIFICATIONS_KEY);
    if (!stored) return;

    const allNotifications: DoctorNotification[] = JSON.parse(stored);
    const updated = allNotifications.map((n) =>
      n.doctorId === doctorId ? { ...n, read: true } : n
    );

    localStorage.setItem(DOCTOR_NOTIFICATIONS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("doctorNotificationsUpdated"));
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
  }
}

/**
 * Delete notification
 */
export function deleteNotification(notificationId: string, doctorId: string): void {
  try {
    const stored = localStorage.getItem(DOCTOR_NOTIFICATIONS_KEY);
    if (!stored) return;

    const allNotifications: DoctorNotification[] = JSON.parse(stored);
    const updated = allNotifications.filter(
      (n) => !(n.id === notificationId && n.doctorId === doctorId)
    );

    localStorage.setItem(DOCTOR_NOTIFICATIONS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("doctorNotificationsUpdated"));
  } catch (error) {
    console.error("Error deleting notification:", error);
  }
}

/**
 * Get unread count
 */
export function getUnreadCount(doctorId: string): number {
  const notifications = getDoctorNotifications(doctorId, { read: false });
  return notifications.length;
}

/**
 * Create appointment reminder notification for doctor
 */
export function createAppointmentReminderNotification(
  doctorId: string,
  appointment: {
    id: string;
    patientName: string;
    patientId?: string;
    date: string;
    time: string;
    specialty: string;
  },
  hoursUntil: number
): DoctorNotification {
  const appointmentDateTime = new Date(`${appointment.date}T${appointment.time}:00`);
  const timeText = hoursUntil >= 1 ? `${Math.floor(hoursUntil)} giờ` : `${Math.floor(hoursUntil * 60)} phút`;

  return createDoctorNotification({
    doctorId,
    type: hoursUntil <= 0.5 ? "appointment_upcoming" : "appointment_reminder",
    title: hoursUntil <= 0.5
      ? `Lịch khám sắp bắt đầu - ${appointment.patientName}`
      : `Nhắc lịch khám - ${appointment.patientName}`,
    message: hoursUntil <= 0.5
      ? `Lịch khám với ${appointment.patientName} (${appointment.specialty}) sẽ bắt đầu trong ${timeText} (${appointment.time})`
      : `Bạn có lịch khám với ${appointment.patientName} (${appointment.specialty}) trong ${timeText} (${appointment.date} lúc ${appointment.time})`,
    link: `/doctor/appointments`,
    priority: hoursUntil <= 0.5 ? "high" : hoursUntil <= 2 ? "medium" : "low",
    relatedId: appointment.id,
    metadata: {
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      patientName: appointment.patientName,
    },
  });
}

/**
 * Create prescription notification
 */
export function createPrescriptionNotification(
  doctorId: string,
  prescription: {
    id: string;
    patientName: string;
    patientId?: string;
    createdAt: string;
  }
): DoctorNotification {
  return createDoctorNotification({
    doctorId,
    type: "prescription_new",
    title: `Đơn thuốc mới - ${prescription.patientName}`,
    message: `Bạn có đơn thuốc mới cần xử lý cho ${prescription.patientName}`,
    link: `/doctor/prescriptions`,
    priority: "medium",
    relatedId: prescription.id,
    metadata: {
      prescriptionId: prescription.id,
      patientId: prescription.patientId,
      patientName: prescription.patientName,
    },
  });
}

/**
 * Create follow-up reminder notification
 */
export function createFollowUpReminderNotification(
  doctorId: string,
  reminder: {
    id: string;
    patientName: string;
    patientId: string;
    reminderDate: string;
    reason?: string;
  }
): DoctorNotification {
  const reminderDate = new Date(reminder.reminderDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  reminderDate.setHours(0, 0, 0, 0);
  const daysUntil = Math.ceil((reminderDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return createDoctorNotification({
    doctorId,
    type: "followup_reminder",
    title: `Nhắc tái khám - ${reminder.patientName}`,
    message: daysUntil === 0
      ? `Hôm nay là ngày tái khám của ${reminder.patientName}${reminder.reason ? ` - ${reminder.reason}` : ""}`
      : `Bệnh nhân ${reminder.patientName} cần tái khám sau ${daysUntil} ngày${reminder.reason ? ` - ${reminder.reason}` : ""}`,
    link: `/doctor/followup`,
    priority: daysUntil <= 1 ? "high" : daysUntil <= 3 ? "medium" : "low",
    relatedId: reminder.id,
    metadata: {
      patientId: reminder.patientId,
      patientName: reminder.patientName,
      reminderDate: reminder.reminderDate,
    },
  });
}

/**
 * Check and create appointment reminders for doctor
 */
export function checkAndCreateAppointmentReminders(doctorId: string): void {
  try {
    const appointments = JSON.parse(
      localStorage.getItem("cliniccare:appointments") || "[]"
    );

    const now = new Date();
    const doctorAppointments = appointments.filter(
      (apt: any) =>
        (apt.doctorId === doctorId || apt.doctorName === doctorId) &&
        apt.status === "confirmed"
    );

    doctorAppointments.forEach((apt: any) => {
      const appointmentDateTime = new Date(`${apt.date}T${apt.time}:00`);
      if (appointmentDateTime < now) return; // Past appointment

      const diffMs = appointmentDateTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      const diffMinutes = diffMs / (1000 * 60);

      // Check if notification already exists
      const existingNotifications = getDoctorNotifications(doctorId, {
        type: diffHours <= 0.5 ? "appointment_upcoming" : "appointment_reminder",
      });
      const alreadyNotified = existingNotifications.some(
        (n) => n.metadata?.appointmentId === apt.id && !n.read
      );

      if (alreadyNotified) return;

      // Create reminder if within time window
      if (diffHours <= 24 && diffHours >= 0) {
        // Remind if within 24 hours
        if (diffHours <= 0.5 || diffHours >= 23.5) {
          // Within 30 minutes or 24 hours
          createAppointmentReminderNotification(doctorId, apt, diffHours);
        } else if (diffHours <= 2 && diffHours >= 1.5) {
          // 2 hours before
          createAppointmentReminderNotification(doctorId, apt, diffHours);
        } else if (diffMinutes <= 30 && diffMinutes >= 0) {
          // 30 minutes before
          createAppointmentReminderNotification(doctorId, apt, diffHours);
        }
      }
    });
  } catch (error) {
    console.error("Error checking appointment reminders:", error);
  }
}

/**
 * Check and create follow-up reminders
 */
export function checkAndCreateFollowUpReminders(doctorId: string): void {
  try {
    // Use ES module import at top of file (avoid CommonJS `require` in browser)
    const reminders = getFollowUpReminders(doctorId, "pending");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    reminders.forEach((reminder: any) => {
      const reminderDate = new Date(reminder.reminderDate);
      reminderDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((reminderDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Check if notification already exists
      const existingNotifications = getDoctorNotifications(doctorId, {
        type: "followup_reminder",
      });
      const alreadyNotified = existingNotifications.some(
        (n) => n.metadata?.reminderDate === reminder.reminderDate && !n.read
      );

      if (alreadyNotified) return;

      // Create reminder if within 7 days
      if (daysUntil >= 0 && daysUntil <= 7) {
        createFollowUpReminderNotification(doctorId, reminder);
      }
    });
  } catch (error) {
    console.error("Error checking follow-up reminders:", error);
  }
}

/**
 * Start automatic reminder checking (call this periodically)
 */
export function startDoctorReminderService(doctorId: string): () => void {
  // Check immediately
  checkAndCreateAppointmentReminders(doctorId);
  checkAndCreateFollowUpReminders(doctorId);

  // Check every 15 minutes
  const interval = setInterval(() => {
    checkAndCreateAppointmentReminders(doctorId);
    checkAndCreateFollowUpReminders(doctorId);
  }, 15 * 60 * 1000);

  return () => clearInterval(interval);
}

