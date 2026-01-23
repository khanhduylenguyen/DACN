/**
 * Personal Health Record (PHR) Service
 * Quản lý hồ sơ sức khỏe chi tiết cho từng thành viên gia đình
 */

import { PersonalHealthRecord, VaccinationRecord, MedicationRecord } from "./family";

const PHR_STORAGE_KEY = "cliniccare:family-phr";
const VACCINATION_STORAGE_KEY = "cliniccare:family-vaccinations";
const MEDICATION_STORAGE_KEY = "cliniccare:family-medications";

// Personal Health Records
export function getHealthRecords(familyMemberId: string): PersonalHealthRecord[] {
  try {
    const data = localStorage.getItem(PHR_STORAGE_KEY);
    if (!data) return [];

    const allRecords: PersonalHealthRecord[] = JSON.parse(data);
    return allRecords
      .filter((r) => r.familyMemberId === familyMemberId)
      .sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime());
  } catch (error) {
    console.error("Error loading health records:", error);
    return [];
  }
}

export function saveHealthRecord(
  record: Omit<PersonalHealthRecord, "id" | "createdAt">
): PersonalHealthRecord {
  try {
    const data = localStorage.getItem(PHR_STORAGE_KEY);
    const allRecords: PersonalHealthRecord[] = data ? JSON.parse(data) : [];

    const newRecord: PersonalHealthRecord = {
      ...record,
      id: `phr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    allRecords.push(newRecord);
    localStorage.setItem(PHR_STORAGE_KEY, JSON.stringify(allRecords));

    return newRecord;
  } catch (error) {
    console.error("Error saving health record:", error);
    throw error;
  }
}

export function deleteHealthRecord(id: string): boolean {
  try {
    const data = localStorage.getItem(PHR_STORAGE_KEY);
    if (!data) return false;

    const allRecords: PersonalHealthRecord[] = JSON.parse(data);
    const filtered = allRecords.filter((r) => r.id !== id);

    if (filtered.length === allRecords.length) return false;

    localStorage.setItem(PHR_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error("Error deleting health record:", error);
    return false;
  }
}

// Vaccination Records
export function getVaccinationRecords(familyMemberId: string): VaccinationRecord[] {
  try {
    const data = localStorage.getItem(VACCINATION_STORAGE_KEY);
    if (!data) return [];

    const allRecords: VaccinationRecord[] = JSON.parse(data);
    return allRecords
      .filter((r) => r.familyMemberId === familyMemberId)
      .sort((a, b) => new Date(b.vaccinationDate).getTime() - new Date(a.vaccinationDate).getTime());
  } catch (error) {
    console.error("Error loading vaccination records:", error);
    return [];
  }
}

export function saveVaccinationRecord(
  record: Omit<VaccinationRecord, "id" | "createdAt">
): VaccinationRecord {
  try {
    const data = localStorage.getItem(VACCINATION_STORAGE_KEY);
    const allRecords: VaccinationRecord[] = data ? JSON.parse(data) : [];

    const newRecord: VaccinationRecord = {
      ...record,
      id: `vac_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    allRecords.push(newRecord);
    localStorage.setItem(VACCINATION_STORAGE_KEY, JSON.stringify(allRecords));

    return newRecord;
  } catch (error) {
    console.error("Error saving vaccination record:", error);
    throw error;
  }
}

export function getUpcomingVaccinations(familyMemberId: string): VaccinationRecord[] {
  const records = getVaccinationRecords(familyMemberId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return records.filter((record) => {
    if (!record.nextDoseDate) return false;
    const nextDate = new Date(record.nextDoseDate);
    nextDate.setHours(0, 0, 0, 0);
    return nextDate >= today && record.doseNumber < record.totalDoses;
  });
}

// Medication Records
export function getMedicationRecords(familyMemberId: string): MedicationRecord[] {
  try {
    const data = localStorage.getItem(MEDICATION_STORAGE_KEY);
    if (!data) return [];

    const allRecords: MedicationRecord[] = JSON.parse(data);
    return allRecords
      .filter((r) => r.familyMemberId === familyMemberId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error("Error loading medication records:", error);
    return [];
  }
}

export function getActiveMedications(familyMemberId: string): MedicationRecord[] {
  const records = getMedicationRecords(familyMemberId);
  const today = new Date().toISOString().split("T")[0];

  return records.filter((record) => {
    if (!record.isActive) return false;
    if (record.endDate && record.endDate < today) return false;
    return true;
  });
}

export function saveMedicationRecord(
  record: Omit<MedicationRecord, "id" | "createdAt" | "updatedAt">
): MedicationRecord {
  try {
    const data = localStorage.getItem(MEDICATION_STORAGE_KEY);
    const allRecords: MedicationRecord[] = data ? JSON.parse(data) : [];

    const newRecord: MedicationRecord = {
      ...record,
      id: `med_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    allRecords.push(newRecord);
    localStorage.setItem(MEDICATION_STORAGE_KEY, JSON.stringify(allRecords));

    return newRecord;
  } catch (error) {
    console.error("Error saving medication record:", error);
    throw error;
  }
}

export function updateMedicationRecord(
  id: string,
  updates: Partial<MedicationRecord>
): MedicationRecord | null {
  try {
    const data = localStorage.getItem(MEDICATION_STORAGE_KEY);
    if (!data) return null;

    const allRecords: MedicationRecord[] = JSON.parse(data);
    const index = allRecords.findIndex((r) => r.id === id);

    if (index === -1) return null;

    allRecords[index] = {
      ...allRecords[index],
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(MEDICATION_STORAGE_KEY, JSON.stringify(allRecords));
    return allRecords[index];
  } catch (error) {
    console.error("Error updating medication record:", error);
    return null;
  }
}

export function deleteMedicationRecord(id: string): boolean {
  try {
    const data = localStorage.getItem(MEDICATION_STORAGE_KEY);
    if (!data) return false;

    const allRecords: MedicationRecord[] = JSON.parse(data);
    const filtered = allRecords.filter((r) => r.id !== id);

    if (filtered.length === allRecords.length) return false;

    localStorage.setItem(MEDICATION_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error("Error deleting medication record:", error);
    return false;
  }
}

// Vaccine recommendations based on age
export function getRecommendedVaccines(age: number): Array<{
  name: string;
  type: "routine" | "optional" | "travel" | "seasonal";
  recommendedAge: string;
  description: string;
}> {
  const recommendations: Array<{
    name: string;
    type: "routine" | "optional" | "travel" | "seasonal";
    recommendedAge: string;
    description: string;
  }> = [];

  if (age < 1) {
    recommendations.push(
      {
        name: "BCG",
        type: "routine",
        recommendedAge: "Sơ sinh",
        description: "Phòng lao",
      },
      {
        name: "Hepatitis B",
        type: "routine",
        recommendedAge: "Sơ sinh",
        description: "Viêm gan B",
      },
      {
        name: "DPT",
        type: "routine",
        recommendedAge: "2, 3, 4 tháng",
        description: "Bạch hầu - Ho gà - Uốn ván",
      },
      {
        name: "Polio",
        type: "routine",
        recommendedAge: "2, 3, 4 tháng",
        description: "Bại liệt",
      },
      {
        name: "Hib",
        type: "routine",
        recommendedAge: "2, 3, 4 tháng",
        description: "Viêm màng não mủ",
      }
    );
  } else if (age < 2) {
    recommendations.push(
      {
        name: "MMR",
        type: "routine",
        recommendedAge: "12-15 tháng",
        description: "Sởi - Quai bị - Rubella",
      },
      {
        name: "Varicella",
        type: "routine",
        recommendedAge: "12-15 tháng",
        description: "Thủy đậu",
      }
    );
  } else if (age < 6) {
    recommendations.push(
      {
        name: "DPT nhắc lại",
        type: "routine",
        recommendedAge: "18 tháng",
        description: "Bạch hầu - Ho gà - Uốn ván",
      },
      {
        name: "Polio nhắc lại",
        type: "routine",
        recommendedAge: "18 tháng",
        description: "Bại liệt",
      }
    );
  } else if (age < 12) {
    recommendations.push(
      {
        name: "DPT nhắc lại",
        type: "routine",
        recommendedAge: "4-6 tuổi",
        description: "Bạch hầu - Ho gà - Uốn ván",
      },
      {
        name: "MMR nhắc lại",
        type: "routine",
        recommendedAge: "4-6 tuổi",
        description: "Sởi - Quai bị - Rubella",
      }
    );
  } else if (age >= 12) {
    recommendations.push(
      {
        name: "Tdap",
        type: "routine",
        recommendedAge: "11-12 tuổi",
        description: "Uốn ván - Bạch hầu - Ho gà",
      },
      {
        name: "HPV",
        type: "routine",
        recommendedAge: "11-12 tuổi",
        description: "Ung thư cổ tử cung",
      },
      {
        name: "Meningococcal",
        type: "routine",
        recommendedAge: "11-12 tuổi",
        description: "Viêm màng não",
      }
    );
  }

  // Seasonal vaccines for all ages
  recommendations.push({
    name: "Cúm",
    type: "seasonal",
    recommendedAge: "Hàng năm",
    description: "Vắc xin cúm mùa",
  });

  return recommendations;
}

