/**
 * Family Health Management Service
 * Quản lý thành viên gia đình và hồ sơ sức khỏe của họ
 */

export type FamilyRole = "owner" | "member" | "guardian";

export interface FamilyMember {
  id: string;
  parentId: string; // ID của tài khoản chính (người quản lý)
  name: string;
  relationship: string; // "Bố", "Mẹ", "Con trai", "Con gái", "Ông", "Bà", "Khác"
  dateOfBirth: string; // ISO format
  gender: "male" | "female" | "other";
  phone?: string;
  email?: string;
  avatar?: string;
  notes?: string;
  role?: FamilyRole; // Phân quyền trong gia đình
  // Personal Health Record (PHR)
  bloodType?: string; // "A", "B", "AB", "O" với Rh+/Rh-
  allergies?: string[]; // Danh sách dị ứng
  chronicConditions?: string[]; // Bệnh nền
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  // Health metrics (latest)
  latestHeight?: number; // cm
  latestWeight?: number; // kg
  latestBloodPressure?: { systolic: number; diastolic: number };
  latestBloodSugar?: number; // mg/dL
  latestHeartRate?: number; // bpm
  createdAt: string;
  updatedAt: string;
}

export interface PersonalHealthRecord {
  id: string;
  familyMemberId: string;
  recordDate: string; // ISO format
  type: "appointment" | "prescription" | "lab_result" | "diagnosis" | "vaccination" | "health_metric" | "other";
  title: string;
  description?: string;
  doctorName?: string;
  hospitalName?: string;
  attachments?: string[]; // URLs hoặc base64 của ảnh/PDF
  metadata?: Record<string, any>; // Dữ liệu bổ sung
  createdAt: string;
}

export interface VaccinationRecord {
  id: string;
  familyMemberId: string;
  vaccineName: string;
  vaccineType: "routine" | "optional" | "travel" | "seasonal";
  doseNumber: number; // Mũi thứ mấy
  totalDoses: number; // Tổng số mũi cần tiêm
  vaccinationDate: string; // ISO format
  nextDoseDate?: string; // ISO format - ngày tiêm mũi tiếp theo
  hospitalName?: string;
  doctorName?: string;
  batchNumber?: string;
  notes?: string;
  createdAt: string;
}

export interface MedicationRecord {
  id: string;
  familyMemberId: string;
  medicationName: string;
  dosage: string; // "500mg", "1 viên", etc.
  frequency: string; // "2 lần/ngày", "sau ăn", etc.
  startDate: string; // ISO format
  endDate?: string; // ISO format
  prescribedBy?: string; // Tên bác sĩ
  prescriptionDate?: string; // ISO format
  reminderTimes?: string[]; // ["08:00", "20:00"]
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "cliniccare:family-members";

/**
 * Get all family members for a parent account
 */
export function getFamilyMembers(parentId: string): FamilyMember[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];

    const allMembers: FamilyMember[] = JSON.parse(data);
    return allMembers
      .filter((m) => m.parentId === parentId)
      .sort((a, b) => {
        // Sort by relationship priority, then by name
        const relationshipOrder: Record<string, number> = {
          "Bố": 1,
          "Mẹ": 2,
          "Con trai": 3,
          "Con gái": 4,
          "Ông": 5,
          "Bà": 6,
          "Khác": 7,
        };
        const orderA = relationshipOrder[a.relationship] || 99;
        const orderB = relationshipOrder[b.relationship] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
  } catch (error) {
    console.error("Error loading family members:", error);
    return [];
  }
}

/**
 * Get family member by ID
 */
export function getFamilyMemberById(id: string): FamilyMember | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;

    const allMembers: FamilyMember[] = JSON.parse(data);
    return allMembers.find((m) => m.id === id) || null;
  } catch (error) {
    console.error("Error loading family member:", error);
    return null;
  }
}

/**
 * Save new family member
 */
export function saveFamilyMember(
  member: Omit<FamilyMember, "id" | "createdAt" | "updatedAt">
): FamilyMember {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const allMembers: FamilyMember[] = data ? JSON.parse(data) : [];

    const newMember: FamilyMember = {
      ...member,
      id: `family_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    allMembers.push(newMember);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allMembers));

    // Dispatch event
    window.dispatchEvent(new CustomEvent("familyMembersUpdated"));

    return newMember;
  } catch (error) {
    console.error("Error saving family member:", error);
    throw error;
  }
}

/**
 * Update family member
 */
export function updateFamilyMember(
  id: string,
  updates: Partial<FamilyMember>
): FamilyMember | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;

    const allMembers: FamilyMember[] = JSON.parse(data);
    const index = allMembers.findIndex((m) => m.id === id);

    if (index === -1) return null;

    allMembers[index] = {
      ...allMembers[index],
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(allMembers));

    // Dispatch event
    window.dispatchEvent(new CustomEvent("familyMembersUpdated"));

    return allMembers[index];
  } catch (error) {
    console.error("Error updating family member:", error);
    throw error;
  }
}

/**
 * Delete family member
 */
export function deleteFamilyMember(id: string): boolean {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return false;

    const allMembers: FamilyMember[] = JSON.parse(data);
    const filtered = allMembers.filter((m) => m.id !== id);

    if (filtered.length === allMembers.length) return false; // Not found

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

    // Dispatch event
    window.dispatchEvent(new CustomEvent("familyMembersUpdated"));

    return true;
  } catch (error) {
    console.error("Error deleting family member:", error);
    return false;
  }
}

/**
 * Calculate age from date of birth
 */
export function getAge(dateOfBirth: string): number {
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Get appointments for a family member (by name matching)
 */
export function getAppointmentsForFamilyMember(
  memberName: string,
  memberPhone?: string
): any[] {
  try {
    const APPOINTMENTS_STORAGE_KEY = "cliniccare:appointments";
    const stored = localStorage.getItem(APPOINTMENTS_STORAGE_KEY);
    if (!stored) return [];

    const appointments: any[] = JSON.parse(stored);
    return appointments.filter((apt) => {
      const nameMatch = apt.patientName === memberName;
      const phoneMatch = memberPhone && apt.patientPhone === memberPhone;
      return nameMatch || phoneMatch;
    });
  } catch (error) {
    console.error("Error loading appointments for family member:", error);
    return [];
  }
}

/**
 * Get health metrics for a family member (by name matching with patientId)
 * Note: Health metrics are stored with patientId, so we need to match by name
 * For now, we'll return empty array as health metrics are tied to user ID
 * In a real app, you'd need to link family members to user accounts or use a different approach
 */
export function getHealthMetricsForFamilyMember(memberName: string): any[] {
  // This is a placeholder - in a real implementation, you'd need to
  // either link family members to user accounts or store health metrics
  // with a familyMemberId field
  return [];
}

