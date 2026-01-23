/**
 * Doctor Schedule Management Service
 * Quản lý lịch làm việc thông minh cho bác sĩ
 */

export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export interface WorkingHours {
  dayOfWeek: DayOfWeek;
  enabled: boolean;
  startTime: string; // "08:00"
  endTime: string; // "17:00"
  breakStart?: string; // "12:00"
  breakEnd?: string; // "13:00"
  slotDuration?: number; // Phút mỗi slot, mặc định 30
}

export interface BlockedTime {
  id: string;
  doctorId: string;
  date: string; // ISO date string
  startTime: string; // "10:00"
  endTime: string; // "12:00"
  reason?: string; // Lý do chặn
  isRecurring?: boolean; // Có lặp lại không
  recurringPattern?: RecurringPattern;
  createdAt: string;
}

export interface RecurringPattern {
  type: "daily" | "weekly" | "monthly";
  interval: number; // Mỗi N ngày/tuần/tháng
  endDate?: string; // ISO date string, null = không giới hạn
  daysOfWeek?: DayOfWeek[]; // Cho weekly pattern
}

export interface RecurringSchedule {
  id: string;
  doctorId: string;
  name: string;
  description?: string;
  workingHours: WorkingHours[];
  startDate: string; // ISO date string
  endDate?: string; // ISO date string, null = không giới hạn
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleSettings {
  doctorId: string;
  workingHours: WorkingHours[];
  defaultSlotDuration: number; // Phút, mặc định 30
  maxAppointmentsPerDay?: number; // Giới hạn số lịch hẹn mỗi ngày
  warningThreshold?: number; // % lịch đầy để cảnh báo, mặc định 80
  autoConfirm?: boolean; // Tự động xác nhận lịch hẹn
  bufferTime?: number; // Phút nghỉ giữa các lịch, mặc định 0
}

const WORKING_HOURS_KEY = "cliniccare:doctor-working-hours";
const BLOCKED_TIMES_KEY = "cliniccare:doctor-blocked-times";
const RECURRING_SCHEDULES_KEY = "cliniccare:doctor-recurring-schedules";
const SCHEDULE_SETTINGS_KEY = "cliniccare:doctor-schedule-settings";

/**
 * Get default working hours
 */
export function getDefaultWorkingHours(): WorkingHours[] {
  return [
    { dayOfWeek: "monday", enabled: true, startTime: "08:00", endTime: "17:00", breakStart: "12:00", breakEnd: "13:00", slotDuration: 30 },
    { dayOfWeek: "tuesday", enabled: true, startTime: "08:00", endTime: "17:00", breakStart: "12:00", breakEnd: "13:00", slotDuration: 30 },
    { dayOfWeek: "wednesday", enabled: true, startTime: "08:00", endTime: "17:00", breakStart: "12:00", breakEnd: "13:00", slotDuration: 30 },
    { dayOfWeek: "thursday", enabled: true, startTime: "08:00", endTime: "17:00", breakStart: "12:00", breakEnd: "13:00", slotDuration: 30 },
    { dayOfWeek: "friday", enabled: true, startTime: "08:00", endTime: "17:00", breakStart: "12:00", breakEnd: "13:00", slotDuration: 30 },
    { dayOfWeek: "saturday", enabled: false, startTime: "08:00", endTime: "12:00", slotDuration: 30 },
    { dayOfWeek: "sunday", enabled: false, startTime: "08:00", endTime: "12:00", slotDuration: 30 },
  ];
}

/**
 * Get schedule settings for a doctor
 */
export function getScheduleSettings(doctorId: string): ScheduleSettings {
  try {
    const stored = localStorage.getItem(SCHEDULE_SETTINGS_KEY);
    if (stored) {
      const allSettings: ScheduleSettings[] = JSON.parse(stored);
      const settings = allSettings.find((s) => s.doctorId === doctorId);
      if (settings) return settings;
    }
  } catch (error) {
    console.error("Error loading schedule settings:", error);
  }

  // Return default settings
  return {
    doctorId,
    workingHours: getDefaultWorkingHours(),
    defaultSlotDuration: 30,
    maxAppointmentsPerDay: undefined,
    warningThreshold: 80,
    autoConfirm: false,
    bufferTime: 0,
  };
}

/**
 * Save schedule settings
 */
export function saveScheduleSettings(settings: ScheduleSettings): void {
  try {
    const allSettings = getAllScheduleSettings();
    const existingIndex = allSettings.findIndex((s) => s.doctorId === settings.doctorId);
    
    if (existingIndex >= 0) {
      allSettings[existingIndex] = settings;
    } else {
      allSettings.push(settings);
    }
    
    localStorage.setItem(SCHEDULE_SETTINGS_KEY, JSON.stringify(allSettings));
    window.dispatchEvent(new Event("scheduleSettingsUpdated"));
  } catch (error) {
    console.error("Error saving schedule settings:", error);
    throw error;
  }
}

function getAllScheduleSettings(): ScheduleSettings[] {
  try {
    const stored = localStorage.getItem(SCHEDULE_SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Error loading all schedule settings:", error);
  }
  return [];
}

/**
 * Get blocked times for a doctor
 */
export function getBlockedTimes(doctorId: string, startDate?: string, endDate?: string): BlockedTime[] {
  try {
    const stored = localStorage.getItem(BLOCKED_TIMES_KEY);
    if (stored) {
      const allBlocked: BlockedTime[] = JSON.parse(stored);
      let filtered = allBlocked.filter((b) => b.doctorId === doctorId);
      
      if (startDate || endDate) {
        filtered = filtered.filter((b) => {
          const blockDate = new Date(b.date);
          if (startDate && blockDate < new Date(startDate)) return false;
          if (endDate && blockDate > new Date(endDate)) return false;
          return true;
        });
      }
      
      return filtered;
    }
  } catch (error) {
    console.error("Error loading blocked times:", error);
  }
  return [];
}

/**
 * Save blocked time
 */
export function saveBlockedTime(blockedTime: BlockedTime): void {
  try {
    const allBlocked = getAllBlockedTimes();
    const existingIndex = allBlocked.findIndex((b) => b.id === blockedTime.id);
    
    if (existingIndex >= 0) {
      allBlocked[existingIndex] = blockedTime;
    } else {
      allBlocked.push({
        ...blockedTime,
        createdAt: new Date().toISOString(),
      });
    }
    
    localStorage.setItem(BLOCKED_TIMES_KEY, JSON.stringify(allBlocked));
    window.dispatchEvent(new Event("blockedTimesUpdated"));
  } catch (error) {
    console.error("Error saving blocked time:", error);
    throw error;
  }
}

/**
 * Delete blocked time
 */
export function deleteBlockedTime(blockedTimeId: string, doctorId: string): void {
  try {
    const allBlocked = getAllBlockedTimes();
    const filtered = allBlocked.filter((b) => !(b.id === blockedTimeId && b.doctorId === doctorId));
    localStorage.setItem(BLOCKED_TIMES_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event("blockedTimesUpdated"));
  } catch (error) {
    console.error("Error deleting blocked time:", error);
    throw error;
  }
}

function getAllBlockedTimes(): BlockedTime[] {
  try {
    const stored = localStorage.getItem(BLOCKED_TIMES_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Error loading all blocked times:", error);
  }
  return [];
}

/**
 * Get recurring schedules for a doctor
 */
export function getRecurringSchedules(doctorId: string): RecurringSchedule[] {
  try {
    const stored = localStorage.getItem(RECURRING_SCHEDULES_KEY);
    if (stored) {
      const allSchedules: RecurringSchedule[] = JSON.parse(stored);
      return allSchedules.filter((s) => s.doctorId === doctorId && s.isActive);
    }
  } catch (error) {
    console.error("Error loading recurring schedules:", error);
  }
  return [];
}

/**
 * Save recurring schedule
 */
export function saveRecurringSchedule(schedule: RecurringSchedule): void {
  try {
    const allSchedules = getAllRecurringSchedules();
    const existingIndex = allSchedules.findIndex((s) => s.id === schedule.id);
    
    if (existingIndex >= 0) {
      allSchedules[existingIndex] = {
        ...schedule,
        updatedAt: new Date().toISOString(),
      };
    } else {
      allSchedules.push({
        ...schedule,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    
    localStorage.setItem(RECURRING_SCHEDULES_KEY, JSON.stringify(allSchedules));
    window.dispatchEvent(new Event("recurringSchedulesUpdated"));
  } catch (error) {
    console.error("Error saving recurring schedule:", error);
    throw error;
  }
}

/**
 * Delete recurring schedule
 */
export function deleteRecurringSchedule(scheduleId: string, doctorId: string): void {
  try {
    const allSchedules = getAllRecurringSchedules();
    const filtered = allSchedules.filter((s) => !(s.id === scheduleId && s.doctorId === doctorId));
    localStorage.setItem(RECURRING_SCHEDULES_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event("recurringSchedulesUpdated"));
  } catch (error) {
    console.error("Error deleting recurring schedule:", error);
    throw error;
  }
}

function getAllRecurringSchedules(): RecurringSchedule[] {
  try {
    const stored = localStorage.getItem(RECURRING_SCHEDULES_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Error loading all recurring schedules:", error);
  }
  return [];
}

/**
 * Check if a time slot is available
 */
export function isTimeSlotAvailable(
  doctorId: string,
  date: string,
  time: string,
  appointments: Array<{ date: string; time: string; status: string }>,
  slotDuration: number = 30
): boolean {
  const settings = getScheduleSettings(doctorId);
  const blockedTimes = getBlockedTimes(doctorId, date, date);
  
  // Check if day is enabled
  const dateObj = new Date(date);
  const dayOfWeek = getDayOfWeek(dateObj);
  const workingHours = settings.workingHours.find((wh) => wh.dayOfWeek === dayOfWeek);
  
  if (!workingHours || !workingHours.enabled) {
    return false;
  }
  
  // Check if time is within working hours
  if (time < workingHours.startTime || time >= workingHours.endTime) {
    return false;
  }
  
  // Check break time
  if (workingHours.breakStart && workingHours.breakEnd) {
    if (time >= workingHours.breakStart && time < workingHours.breakEnd) {
      return false;
    }
  }
  
  // Check blocked times
  const timeMinutes = timeToMinutes(time);
  for (const blocked of blockedTimes) {
    if (blocked.date === date) {
      const blockStart = timeToMinutes(blocked.startTime);
      const blockEnd = timeToMinutes(blocked.endTime);
      const slotEnd = timeMinutes + slotDuration;
      
      if (timeMinutes < blockEnd && slotEnd > blockStart) {
        return false;
      }
    }
  }
  
  // Check existing appointments
  const slotEnd = addMinutes(time, slotDuration);
  for (const apt of appointments) {
    if (apt.date === date && apt.status !== "cancelled") {
      const aptTime = timeToMinutes(apt.time);
      const aptEnd = aptTime + slotDuration;
      
      if (timeMinutes < aptEnd && slotEnd > aptTime) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Get available time slots for a date
 */
export function getAvailableTimeSlots(
  doctorId: string,
  date: string,
  appointments: Array<{ date: string; time: string; status: string }>
): string[] {
  const settings = getScheduleSettings(doctorId);
  const dateObj = new Date(date);
  const dayOfWeek = getDayOfWeek(dateObj);
  const workingHours = settings.workingHours.find((wh) => wh.dayOfWeek === dayOfWeek);
  
  if (!workingHours || !workingHours.enabled) {
    return [];
  }
  
  const slotDuration = workingHours.slotDuration || settings.defaultSlotDuration || 30;
  const slots: string[] = [];
  let currentTime = workingHours.startTime;
  
  while (currentTime < workingHours.endTime) {
    // Skip break time
    if (workingHours.breakStart && workingHours.breakEnd) {
      if (currentTime >= workingHours.breakStart && currentTime < workingHours.breakEnd) {
        currentTime = workingHours.breakEnd;
        continue;
      }
    }
    
    // Check if slot is available
    if (isTimeSlotAvailable(doctorId, date, currentTime, appointments, slotDuration)) {
      slots.push(currentTime);
    }
    
    // Move to next slot
    currentTime = addMinutes(currentTime, slotDuration);
  }
  
  return slots;
}

/**
 * Get suggested time slots (next available slots)
 */
export function getSuggestedTimeSlots(
  doctorId: string,
  preferredDate?: string,
  preferredTime?: string,
  appointments: Array<{ date: string; time: string; status: string }> = [],
  count: number = 5
): Array<{ date: string; time: string }> {
  const suggestions: Array<{ date: string; time: string }> = [];
  const startDate = preferredDate ? new Date(preferredDate) : new Date();
  startDate.setHours(0, 0, 0, 0);
  
  // If preferred time is provided, try to find slots around that time first
  if (preferredDate && preferredTime) {
    const slots = getAvailableTimeSlots(doctorId, preferredDate, appointments);
    const preferredIndex = slots.findIndex((s) => s >= preferredTime);
    
    if (preferredIndex >= 0) {
      for (let i = preferredIndex; i < Math.min(preferredIndex + count, slots.length); i++) {
        suggestions.push({ date: preferredDate, time: slots[i] });
      }
    }
  }
  
  // Fill remaining slots from upcoming days
  let currentDate = new Date(startDate);
  const maxDays = 30; // Look ahead 30 days
  let daysChecked = 0;
  
  while (suggestions.length < count && daysChecked < maxDays) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const slots = getAvailableTimeSlots(doctorId, dateStr, appointments);
    
    for (const slot of slots) {
      if (suggestions.length >= count) break;
      
      // Skip if already added (from preferred time)
      if (dateStr === preferredDate && preferredTime && slot < preferredTime) {
        continue;
      }
      
      suggestions.push({ date: dateStr, time: slot });
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
    daysChecked++;
  }
  
  return suggestions.slice(0, count);
}

/**
 * Get schedule utilization for a date
 */
export function getScheduleUtilization(
  doctorId: string,
  date: string,
  appointments: Array<{ date: string; time: string; status: string }>
): { used: number; total: number; percentage: number } {
  const availableSlots = getAvailableTimeSlots(doctorId, date, []);
  const bookedAppointments = appointments.filter(
    (apt) => apt.date === date && (apt.status === "confirmed" || apt.status === "pending")
  );
  
  const total = availableSlots.length;
  const used = bookedAppointments.length;
  const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
  
  return { used, total, percentage };
}

/**
 * Check if schedule is nearly full (for warning)
 */
export function isScheduleNearlyFull(
  doctorId: string,
  date: string,
  appointments: Array<{ date: string; time: string; status: string }>
): boolean {
  const settings = getScheduleSettings(doctorId);
  const threshold = settings.warningThreshold || 80;
  const utilization = getScheduleUtilization(doctorId, date, appointments);
  
  return utilization.percentage >= threshold;
}

// Helper functions
function getDayOfWeek(date: Date): DayOfWeek {
  const days: DayOfWeek[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[date.getDay()];
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function addMinutes(time: string, minutes: number): string {
  return minutesToTime(timeToMinutes(time) + minutes);
}

