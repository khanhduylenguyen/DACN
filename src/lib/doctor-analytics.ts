/**
 * Doctor Analytics Service
 * Phân tích và báo cáo nâng cao cho bác sĩ
 */

export interface EHRRecord {
  id: string;
  patientId: string;
  visitDate: string;
  doctor: string;
  doctorId?: string;
  diagnosis: string;
  conclusion?: string;
}

const APPOINTMENTS_STORAGE_KEY = "cliniccare:appointments";
const PRESCRIPTIONS_STORAGE_KEY = "cliniccare:prescriptions";

export interface Appointment {
  id: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  createdAt: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  date: string;
  drugs: Array<{ name: string; dose: string }>;
  diagnosis?: string;
  status?: "active" | "completed" | "cancelled";
  createdAt: string;
}

export interface DiagnosisStats {
  diagnosis: string;
  count: number;
  percentage: number;
  trend: "up" | "down" | "stable";
}

export interface PerformanceStats {
  totalPatients: number;
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  totalRevenue: number;
  averagePatientsPerDay: number;
  averageRevenuePerDay: number;
  completionRate: number;
}

export interface TrendData {
  period: string; // "2024-01", "2024-02", etc.
  appointments: number;
  completed: number;
  revenue: number;
  diagnoses: Record<string, number>;
}

/**
 * Get diagnosis statistics
 */
export function getDiagnosisStatistics(
  doctorId: string,
  startDate?: Date,
  endDate?: Date
): DiagnosisStats[] {
  try {
    const allEHRRecords: Array<{ id: string } & EHRRecord> = [];
    const keys = Object.keys(localStorage);
    
    for (const key of keys) {
      if (key.startsWith("cliniccare:ehr:")) {
        try {
          const records = JSON.parse(localStorage.getItem(key) || "[]");
          allEHRRecords.push(...records);
        } catch {}
      }
    }

    // Filter by doctor and date range
    let filteredRecords = allEHRRecords.filter((record) => {
      if (record.doctor !== doctorId && record.doctorId !== doctorId) return false;
      
      if (startDate || endDate) {
        const visitDate = new Date(record.visitDate);
        if (startDate && visitDate < startDate) return false;
        if (endDate && visitDate > endDate) return false;
      }
      
      return true;
    });

    // Also check prescriptions for diagnosis
    const prescriptions: Prescription[] = JSON.parse(
      localStorage.getItem(PRESCRIPTIONS_STORAGE_KEY) || "[]"
    );
    
    const doctorPrescriptions = prescriptions.filter((p) => {
      if (p.doctorId !== doctorId) return false;
      if (startDate || endDate) {
        const presDate = new Date(p.date);
        if (startDate && presDate < startDate) return false;
        if (endDate && presDate > endDate) return false;
      }
      return true;
    });

    // Count diagnoses
    const diagnosisCount: Record<string, number> = {};
    
    filteredRecords.forEach((record) => {
      if (record.diagnosis) {
        diagnosisCount[record.diagnosis] = (diagnosisCount[record.diagnosis] || 0) + 1;
      }
    });

    doctorPrescriptions.forEach((pres) => {
      if (pres.diagnosis) {
        diagnosisCount[pres.diagnosis] = (diagnosisCount[pres.diagnosis] || 0) + 1;
      }
    });

    const total = Object.values(diagnosisCount).reduce((sum, count) => sum + count, 0);
    
    // Convert to array and sort
    const stats: DiagnosisStats[] = Object.entries(diagnosisCount)
      .map(([diagnosis, count]) => ({
        diagnosis,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        trend: "stable" as const, // Could be enhanced with historical comparison
      }))
      .sort((a, b) => b.count - a.count);

    return stats;
  } catch (error) {
    console.error("Error getting diagnosis statistics:", error);
    return [];
  }
}

/**
 * Get performance statistics
 */
export function getPerformanceStatistics(
  doctorId: string,
  startDate?: Date,
  endDate?: Date
): PerformanceStats {
  try {
    const appointments: Appointment[] = JSON.parse(
      localStorage.getItem(APPOINTMENTS_STORAGE_KEY) || "[]"
    );

    // Filter by doctor and date range
    let filteredAppointments = appointments.filter((apt) => {
      if (apt.doctorId !== doctorId) return false;
      
      if (startDate || endDate) {
        const aptDate = new Date(apt.date);
        if (startDate && aptDate < startDate) return false;
        if (endDate && aptDate > endDate) return false;
      }
      
      return true;
    });

    // Calculate unique patients
    const uniquePatients = new Set(filteredAppointments.map((apt) => apt.patientName));
    
    const totalAppointments = filteredAppointments.length;
    const completedAppointments = filteredAppointments.filter(
      (apt) => apt.status === "completed"
    ).length;
    const cancelledAppointments = filteredAppointments.filter(
      (apt) => apt.status === "cancelled"
    ).length;

    // Calculate revenue (mock: 200k per appointment)
    const totalRevenue = completedAppointments * 200000;

    // Calculate days in range
    const days = startDate && endDate
      ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
      : 30; // Default to 30 days

    const averagePatientsPerDay = days > 0 ? Number((uniquePatients.size / days).toFixed(2)) : 0;
    const averageRevenuePerDay = days > 0 ? Math.round(totalRevenue / days) : 0;
    const completionRate = totalAppointments > 0
      ? Math.round((completedAppointments / totalAppointments) * 100)
      : 0;

    return {
      totalPatients: uniquePatients.size,
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      totalRevenue,
      averagePatientsPerDay,
      averageRevenuePerDay,
      completionRate,
    };
  } catch (error) {
    console.error("Error getting performance statistics:", error);
    return {
      totalPatients: 0,
      totalAppointments: 0,
      completedAppointments: 0,
      cancelledAppointments: 0,
      totalRevenue: 0,
      averagePatientsPerDay: 0,
      averageRevenuePerDay: 0,
      completionRate: 0,
    };
  }
}

/**
 * Get trend data over time
 */
export function getTrendData(
  doctorId: string,
  period: "week" | "month" | "year" = "month",
  startDate?: Date,
  endDate?: Date
): TrendData[] {
  try {
    const appointments: Appointment[] = JSON.parse(
      localStorage.getItem(APPOINTMENTS_STORAGE_KEY) || "[]"
    );

    const prescriptions: Prescription[] = JSON.parse(
      localStorage.getItem(PRESCRIPTIONS_STORAGE_KEY) || "[]"
    );

    // Get all EHR records
    const allEHRRecords: Array<{ id: string } & EHRRecord> = [];
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith("cliniccare:ehr:")) {
        try {
          const records = JSON.parse(localStorage.getItem(key) || "[]");
          allEHRRecords.push(...records);
        } catch {}
      }
    }

    // Filter by doctor
    const doctorAppointments = appointments.filter((apt) => apt.doctorId === doctorId);
    const doctorPrescriptions = prescriptions.filter((pres) => pres.doctorId === doctorId);
    const doctorEHRRecords = allEHRRecords.filter(
      (record) => record.doctor === doctorId || record.doctorId === doctorId
    );

    // Determine date range
    const now = endDate || new Date();
    const start = startDate || (() => {
      const date = new Date(now);
      if (period === "week") date.setDate(date.getDate() - 7);
      else if (period === "month") date.setMonth(date.getMonth() - 6);
      else date.setFullYear(date.getFullYear() - 1);
      return date;
    })();

    // Group by period
    const trendMap = new Map<string, TrendData>();

    // Process appointments
    doctorAppointments.forEach((apt) => {
      const aptDate = new Date(apt.date);
      if (aptDate < start || aptDate > now) return;

      let periodKey: string;
      if (period === "week") {
        const weekStart = new Date(aptDate);
        weekStart.setDate(aptDate.getDate() - aptDate.getDay());
        periodKey = weekStart.toISOString().split("T")[0].substring(0, 10);
      } else if (period === "month") {
        periodKey = `${aptDate.getFullYear()}-${String(aptDate.getMonth() + 1).padStart(2, "0")}`;
      } else {
        periodKey = `${aptDate.getFullYear()}-Q${Math.floor(aptDate.getMonth() / 3) + 1}`;
      }

      if (!trendMap.has(periodKey)) {
        trendMap.set(periodKey, {
          period: periodKey,
          appointments: 0,
          completed: 0,
          revenue: 0,
          diagnoses: {},
        });
      }

      const trend = trendMap.get(periodKey)!;
      trend.appointments++;
      if (apt.status === "completed") {
        trend.completed++;
        trend.revenue += 200000; // Mock revenue
      }
    });

    // Process diagnoses from prescriptions and EHR
    [...doctorPrescriptions, ...doctorEHRRecords].forEach((item) => {
      const itemDate = new Date((item as Prescription).date || (item as EHRRecord).visitDate);
      if (itemDate < start || itemDate > now) return;

      let periodKey: string;
      if (period === "week") {
        const weekStart = new Date(itemDate);
        weekStart.setDate(itemDate.getDate() - itemDate.getDay());
        periodKey = weekStart.toISOString().split("T")[0].substring(0, 10);
      } else if (period === "month") {
        periodKey = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, "0")}`;
      } else {
        periodKey = `${itemDate.getFullYear()}-Q${Math.floor(itemDate.getMonth() / 3) + 1}`;
      }

      const diagnosis = (item as any).diagnosis || (item as EHRRecord).diagnosis;
      if (diagnosis) {
        if (!trendMap.has(periodKey)) {
          trendMap.set(periodKey, {
            period: periodKey,
            appointments: 0,
            completed: 0,
            revenue: 0,
            diagnoses: {},
          });
        }

        const trend = trendMap.get(periodKey)!;
        trend.diagnoses[diagnosis] = (trend.diagnoses[diagnosis] || 0) + 1;
      }
    });

    // Convert to array and sort
    const trends = Array.from(trendMap.values()).sort((a, b) => {
      return a.period.localeCompare(b.period);
    });

    return trends;
  } catch (error) {
    console.error("Error getting trend data:", error);
    return [];
  }
}

/**
 * Get top diagnoses
 */
export function getTopDiagnoses(doctorId: string, limit: number = 10): DiagnosisStats[] {
  const stats = getDiagnosisStatistics(doctorId);
  return stats.slice(0, limit);
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

/**
 * Format period label
 */
export function formatPeriodLabel(period: string, periodType: "week" | "month" | "year"): string {
  if (periodType === "week") {
    const date = new Date(period);
    return date.toLocaleDateString("vi-VN", { day: "numeric", month: "short" });
  } else if (periodType === "month") {
    const [year, month] = period.split("-");
    return `T${month}/${year}`;
  } else {
    return period;
  }
}

