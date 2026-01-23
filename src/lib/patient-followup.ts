/**
 * Patient Follow-up Management Service
 * Quản lý theo dõi bệnh nhân, nhắc tái khám, tracking điều trị
 */

export interface FollowUpReminder {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  appointmentId?: string; // ID của lịch khám gốc
  reminderDate: string; // ISO date string - Ngày cần nhắc
  followUpDate: string; // ISO date string - Ngày tái khám dự kiến
  reason: string; // Lý do tái khám
  status: "pending" | "scheduled" | "completed" | "cancelled";
  priority: "low" | "medium" | "high";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TreatmentProgress {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  treatmentPlan: string; // Kế hoạch điều trị
  startDate: string; // ISO date string
  endDate?: string; // ISO date string
  currentStatus: "ongoing" | "improving" | "stable" | "worsening" | "completed";
  progressNotes: Array<{
    date: string; // ISO date string
    note: string;
    metrics?: Record<string, any>; // Các chỉ số theo dõi
  }>;
  medications?: Array<{
    name: string;
    dosage: string;
    status: "active" | "completed" | "stopped";
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface PatientNote {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  note: string;
  category?: "general" | "allergy" | "preference" | "important" | "reminder";
  isPrivate?: boolean; // Ghi chú riêng tư, chỉ bác sĩ này thấy
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PatientInteraction {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  type: "appointment" | "prescription" | "ehr" | "note" | "call" | "message" | "followup";
  title: string;
  description?: string;
  date: string; // ISO date string
  metadata?: Record<string, any>; // Dữ liệu bổ sung (appointment ID, prescription ID, etc.)
  createdAt: string;
}

const FOLLOWUP_REMINDERS_KEY = "cliniccare:followup-reminders";
const TREATMENT_PROGRESS_KEY = "cliniccare:treatment-progress";
const PATIENT_NOTES_KEY = "cliniccare:patient-notes";
const PATIENT_INTERACTIONS_KEY = "cliniccare:patient-interactions";

/**
 * Get follow-up reminders for a doctor
 */
export function getFollowUpReminders(doctorId: string, status?: FollowUpReminder["status"]): FollowUpReminder[] {
  try {
    const stored = localStorage.getItem(FOLLOWUP_REMINDERS_KEY);
    if (stored) {
      const allReminders: FollowUpReminder[] = JSON.parse(stored);
      let filtered = allReminders.filter((r) => r.doctorId === doctorId);
      if (status) {
        filtered = filtered.filter((r) => r.status === status);
      }
      return filtered.sort((a, b) => new Date(a.reminderDate).getTime() - new Date(b.reminderDate).getTime());
    }
  } catch (error) {
    console.error("Error loading follow-up reminders:", error);
  }
  return [];
}

/**
 * Save follow-up reminder
 */
export function saveFollowUpReminder(reminder: FollowUpReminder): void {
  try {
    const allReminders = getAllFollowUpReminders();
    const existingIndex = allReminders.findIndex((r) => r.id === reminder.id);
    
    if (existingIndex >= 0) {
      allReminders[existingIndex] = {
        ...reminder,
        updatedAt: new Date().toISOString(),
      };
    } else {
      allReminders.push({
        ...reminder,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    
    localStorage.setItem(FOLLOWUP_REMINDERS_KEY, JSON.stringify(allReminders));
    window.dispatchEvent(new Event("followUpRemindersUpdated"));
  } catch (error) {
    console.error("Error saving follow-up reminder:", error);
    throw error;
  }
}

/**
 * Delete follow-up reminder
 */
export function deleteFollowUpReminder(reminderId: string, doctorId: string): void {
  try {
    const allReminders = getAllFollowUpReminders();
    const filtered = allReminders.filter((r) => !(r.id === reminderId && r.doctorId === doctorId));
    localStorage.setItem(FOLLOWUP_REMINDERS_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event("followUpRemindersUpdated"));
  } catch (error) {
    console.error("Error deleting follow-up reminder:", error);
    throw error;
  }
}

function getAllFollowUpReminders(): FollowUpReminder[] {
  try {
    const stored = localStorage.getItem(FOLLOWUP_REMINDERS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Error loading all follow-up reminders:", error);
  }
  return [];
}

/**
 * Get treatment progress for a patient
 */
export function getTreatmentProgress(patientId: string, doctorId: string): TreatmentProgress[] {
  try {
    const stored = localStorage.getItem(TREATMENT_PROGRESS_KEY);
    if (stored) {
      const allProgress: TreatmentProgress[] = JSON.parse(stored);
      return allProgress.filter(
        (p) => p.patientId === patientId && p.doctorId === doctorId
      );
    }
  } catch (error) {
    console.error("Error loading treatment progress:", error);
  }
  return [];
}

/**
 * Save treatment progress
 */
export function saveTreatmentProgress(progress: TreatmentProgress): void {
  try {
    const allProgress = getAllTreatmentProgress();
    const existingIndex = allProgress.findIndex((p) => p.id === progress.id);
    
    if (existingIndex >= 0) {
      allProgress[existingIndex] = {
        ...progress,
        updatedAt: new Date().toISOString(),
      };
    } else {
      allProgress.push({
        ...progress,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    
    localStorage.setItem(TREATMENT_PROGRESS_KEY, JSON.stringify(allProgress));
    window.dispatchEvent(new Event("treatmentProgressUpdated"));
  } catch (error) {
    console.error("Error saving treatment progress:", error);
    throw error;
  }
}

/**
 * Add progress note to treatment
 */
export function addProgressNote(
  progressId: string,
  note: string,
  metrics?: Record<string, any>
): void {
  try {
    const allProgress = getAllTreatmentProgress();
    const progress = allProgress.find((p) => p.id === progressId);
    
    if (progress) {
      progress.progressNotes.push({
        date: new Date().toISOString(),
        note,
        metrics,
      });
      progress.updatedAt = new Date().toISOString();
      localStorage.setItem(TREATMENT_PROGRESS_KEY, JSON.stringify(allProgress));
      window.dispatchEvent(new Event("treatmentProgressUpdated"));
    }
  } catch (error) {
    console.error("Error adding progress note:", error);
    throw error;
  }
}

function getAllTreatmentProgress(): TreatmentProgress[] {
  try {
    const stored = localStorage.getItem(TREATMENT_PROGRESS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Error loading all treatment progress:", error);
  }
  return [];
}

/**
 * Get patient notes for a doctor
 */
export function getPatientNotes(patientId: string, doctorId: string): PatientNote[] {
  try {
    const stored = localStorage.getItem(PATIENT_NOTES_KEY);
    if (stored) {
      const allNotes: PatientNote[] = JSON.parse(stored);
      return allNotes
        .filter((n) => n.patientId === patientId && (n.doctorId === doctorId || !n.isPrivate))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  } catch (error) {
    console.error("Error loading patient notes:", error);
  }
  return [];
}

/**
 * Save patient note
 */
export function savePatientNote(note: PatientNote): void {
  try {
    const allNotes = getAllPatientNotes();
    const existingIndex = allNotes.findIndex((n) => n.id === note.id);
    
    if (existingIndex >= 0) {
      allNotes[existingIndex] = {
        ...note,
        updatedAt: new Date().toISOString(),
      };
    } else {
      allNotes.push({
        ...note,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    
    localStorage.setItem(PATIENT_NOTES_KEY, JSON.stringify(allNotes));
    
    // Also create interaction
    createInteraction({
      patientId: note.patientId,
      patientName: note.patientName,
      doctorId: note.doctorId,
      type: "note",
      title: "Ghi chú bệnh nhân",
      description: note.note.substring(0, 100),
      date: new Date().toISOString(),
      metadata: { noteId: note.id, category: note.category },
    });
    
    window.dispatchEvent(new Event("patientNotesUpdated"));
  } catch (error) {
    console.error("Error saving patient note:", error);
    throw error;
  }
}

/**
 * Delete patient note
 */
export function deletePatientNote(noteId: string, doctorId: string): void {
  try {
    const allNotes = getAllPatientNotes();
    const filtered = allNotes.filter((n) => !(n.id === noteId && n.doctorId === doctorId));
    localStorage.setItem(PATIENT_NOTES_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event("patientNotesUpdated"));
  } catch (error) {
    console.error("Error deleting patient note:", error);
    throw error;
  }
}

function getAllPatientNotes(): PatientNote[] {
  try {
    const stored = localStorage.getItem(PATIENT_NOTES_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Error loading all patient notes:", error);
  }
  return [];
}

/**
 * Get patient interactions
 */
export function getPatientInteractions(patientId: string, doctorId?: string): PatientInteraction[] {
  try {
    const stored = localStorage.getItem(PATIENT_INTERACTIONS_KEY);
    if (stored) {
      const allInteractions: PatientInteraction[] = JSON.parse(stored);
      let filtered = allInteractions.filter((i) => i.patientId === patientId);
      if (doctorId) {
        filtered = filtered.filter((i) => i.doctorId === doctorId);
      }
      return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
  } catch (error) {
    console.error("Error loading patient interactions:", error);
  }
  return [];
}

/**
 * Create interaction (called automatically when creating appointments, prescriptions, etc.)
 */
export function createInteraction(interaction: Omit<PatientInteraction, "id" | "createdAt">): void {
  try {
    const allInteractions = getAllPatientInteractions();
    const newInteraction: PatientInteraction = {
      ...interaction,
      id: `INTERACTION_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    allInteractions.push(newInteraction);
    localStorage.setItem(PATIENT_INTERACTIONS_KEY, JSON.stringify(allInteractions));
    window.dispatchEvent(new Event("patientInteractionsUpdated"));
  } catch (error) {
    console.error("Error creating interaction:", error);
  }
}

function getAllPatientInteractions(): PatientInteraction[] {
  try {
    const stored = localStorage.getItem(PATIENT_INTERACTIONS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Error loading all patient interactions:", error);
  }
  return [];
}

/**
 * Get upcoming reminders (for notifications)
 */
export function getUpcomingReminders(doctorId: string, daysAhead: number = 7): FollowUpReminder[] {
  const reminders = getFollowUpReminders(doctorId, "pending");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + daysAhead);
  
  return reminders.filter((r) => {
    const reminderDate = new Date(r.reminderDate);
    reminderDate.setHours(0, 0, 0, 0);
    return reminderDate >= today && reminderDate <= futureDate;
  });
}

/**
 * Auto-create follow-up reminder from appointment
 */
export function createFollowUpFromAppointment(
  appointmentId: string,
  patientId: string,
  patientName: string,
  doctorId: string,
  followUpDays: number,
  reason: string
): FollowUpReminder {
  const today = new Date();
  const followUpDate = new Date(today);
  followUpDate.setDate(today.getDate() + followUpDays);
  
  const reminderDate = new Date(followUpDate);
  reminderDate.setDate(followUpDate.getDate() - 3); // Nhắc trước 3 ngày
  
  const reminder: FollowUpReminder = {
    id: `FOLLOWUP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    patientId,
    patientName,
    doctorId,
    appointmentId,
    reminderDate: reminderDate.toISOString().split("T")[0],
    followUpDate: followUpDate.toISOString().split("T")[0],
    reason,
    status: "pending",
    priority: "medium",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  saveFollowUpReminder(reminder);
  return reminder;
}

