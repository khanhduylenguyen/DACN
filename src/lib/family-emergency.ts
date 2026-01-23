/**
 * Family Emergency Management Service
 * Quản lý thông tin cấp cứu và Emergency Card QR code
 */

import { FamilyMember } from "./family";

export interface EmergencyCard {
  familyMemberId: string;
  qrCodeData: string; // JSON string chứa thông tin cấp cứu
  createdAt: string;
  updatedAt: string;
}

const EMERGENCY_CARDS_KEY = "cliniccare:family-emergency-cards";

/**
 * Generate emergency card data for a family member
 */
export function generateEmergencyCardData(member: FamilyMember): string {
  const emergencyData = {
    name: member.name,
    dateOfBirth: member.dateOfBirth,
    bloodType: member.bloodType || "Chưa xác định",
    allergies: member.allergies || [],
    chronicConditions: member.chronicConditions || [],
    emergencyContactName: member.emergencyContactName || "Chưa có",
    emergencyContactPhone: member.emergencyContactPhone || "Chưa có",
    phone: member.phone || "Chưa có",
    lastUpdated: new Date().toISOString(),
  };

  return JSON.stringify(emergencyData);
}

/**
 * Get emergency card for a family member
 */
export function getEmergencyCard(familyMemberId: string): EmergencyCard | null {
  try {
    const data = localStorage.getItem(EMERGENCY_CARDS_KEY);
    if (!data) return null;

    const allCards: EmergencyCard[] = JSON.parse(data);
    return allCards.find((c) => c.familyMemberId === familyMemberId) || null;
  } catch (error) {
    console.error("Error loading emergency card:", error);
    return null;
  }
}

/**
 * Save or update emergency card
 */
export function saveEmergencyCard(familyMemberId: string, member: FamilyMember): EmergencyCard {
  try {
    const data = localStorage.getItem(EMERGENCY_CARDS_KEY);
    const allCards: EmergencyCard[] = data ? JSON.parse(data) : [];

    const qrCodeData = generateEmergencyCardData(member);
    const existingIndex = allCards.findIndex((c) => c.familyMemberId === familyMemberId);

    const card: EmergencyCard = {
      familyMemberId,
      qrCodeData,
      createdAt: existingIndex !== -1 ? allCards[existingIndex].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex !== -1) {
      allCards[existingIndex] = card;
    } else {
      allCards.push(card);
    }

    localStorage.setItem(EMERGENCY_CARDS_KEY, JSON.stringify(allCards));
    return card;
  } catch (error) {
    console.error("Error saving emergency card:", error);
    throw error;
  }
}

/**
 * Parse emergency card data from QR code
 */
export function parseEmergencyCardData(qrData: string): any {
  try {
    return JSON.parse(qrData);
  } catch (error) {
    console.error("Error parsing emergency card data:", error);
    return null;
  }
}

