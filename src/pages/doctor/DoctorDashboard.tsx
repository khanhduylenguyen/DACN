import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DoctorLayout from "@/components/layout/DoctorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Stethoscope,
  FileText,
  Activity,
  Pill,
  ArrowRight,
  Clock,
  Users,
  TrendingUp,
  Bell,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from "recharts";
import { getCurrentUser } from "@/lib/auth";
import { getUnreadCount, getDoctorNotifications } from "@/lib/doctor-notifications";
import { toast } from "sonner";

const APPOINTMENTS_STORAGE_KEY = "cliniccare:appointments";
const PRESCRIPTIONS_STORAGE_KEY = "cliniccare:prescriptions";

interface Appointment {
  id: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  notes?: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  createdAt: string;
}

interface PrescriptionDrug {
  name: string;
  dose: string;
  quantity?: string;
  instructions?: string;
}

interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  date: string; // ISO date string
  drugs: PrescriptionDrug[];
  diagnosis?: string;
  notes?: string;
  status?: "active" | "completed" | "cancelled";
  createdAt: string;
  // Legacy support for old format
  medications?: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
  }>;
}

interface EHRRecord {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  visitDate: string;
  diagnosis: string;
  notes?: string;
  createdAt: string;
}

// Load appointments from localStorage
const loadAppointments = (): Appointment[] => {
  try {
    const stored = localStorage.getItem(APPOINTMENTS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  return [];
};

// Load prescriptions from localStorage
const loadPrescriptions = (): Prescription[] => {
  try {
    const stored = localStorage.getItem(PRESCRIPTIONS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  return [];
};

// Load EHR records from localStorage
const loadEHRRecords = (): EHRRecord[] => {
  try {
    // EHR records are stored per patient: cliniccare:ehr:{patientId}
    // We need to get all patient IDs and load their records
    const allRecords: EHRRecord[] = [];
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith("cliniccare:ehr:")) {
        try {
          const records = JSON.parse(localStorage.getItem(key) || "[]");
          allRecords.push(...records);
        } catch {}
      }
    }
    return allRecords;
  } catch {}
  return [];
};

// Get day name in Vietnamese
const getDayName = (date: Date): string => {
  const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  return days[date.getDay()];
};

// Get month name in Vietnamese
const getMonthName = (month: number): string => {
  return `T${month + 1}`;
};

const DoctorDashboard = () => {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [ehrRecords, setEhrRecords] = useState<EHRRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    const loadData = () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const allAppointments = loadAppointments();
        const allPrescriptions = loadPrescriptions();
        const allEHRRecords = loadEHRRecords();

        // Filter by current doctor
        const doctorAppointments = allAppointments.filter(
          (apt) => apt.doctorId === user.id || apt.doctorName === user.name
        );
        const doctorPrescriptions = allPrescriptions.filter(
          (pres) => pres.doctorId === user.id || pres.doctorName === user.name
        );
        const doctorEHRRecords = allEHRRecords.filter(
          (ehr) => ehr.doctorId === user.id || ehr.doctorName === user.name
        );

        setAppointments(doctorAppointments);
        setPrescriptions(doctorPrescriptions);
        setEhrRecords(doctorEHRRecords);

        // Load unread notifications
        try {
          const unread = getUnreadCount(user.id);
          setUnreadNotifications(unread);
        } catch (error) {
          console.error("Error loading notifications:", error);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Listen for updates
    const handleUpdate = () => loadData();
    const handleNotificationUpdate = () => {
      if (user?.id) {
        try {
          const unread = getUnreadCount(user.id);
          setUnreadNotifications(unread);
        } catch (error) {
          console.error("Error loading notifications:", error);
        }
      }
    };
    window.addEventListener("appointmentsUpdated", handleUpdate);
    window.addEventListener("doctorNotificationsUpdated", handleNotificationUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("appointmentsUpdated", handleUpdate);
      window.removeEventListener("doctorNotificationsUpdated", handleNotificationUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [user?.id]);

  // Calculate KPIs
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayAppointments = appointments.filter((apt) => {
    const aptDate = new Date(apt.date);
    aptDate.setHours(0, 0, 0, 0);
    return aptDate.getTime() === today.getTime() && apt.status !== "cancelled";
  });

  const activeRecords = ehrRecords.filter((ehr) => {
    const visitDate = new Date(ehr.visitDate);
    const daysSinceVisit = (today.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceVisit <= 30; // Active if within 30 days
  });

  // Calculate average rating (mock data for now)
  const averageRating = 4.7;

  // Prepare weekly schedule data
  const weeklySchedule = (() => {
    const weekData: { day: string; booked: number; completed: number }[] = [];
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday

    for (let i = 0; i < 6; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dayName = getDayName(date);
      date.setHours(0, 0, 0, 0);

      const dayAppointments = appointments.filter((apt) => {
        const aptDate = new Date(apt.date);
        aptDate.setHours(0, 0, 0, 0);
        return aptDate.getTime() === date.getTime();
      });

      const booked = dayAppointments.length;
      const completed = dayAppointments.filter((apt) => apt.status === "completed").length;

      weekData.push({ day: dayName, booked, completed });
    }

    return weekData;
  })();

  // Prepare monthly cases data
  const monthlyCases = (() => {
    const monthData: { month: string; cases: number }[] = [];
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    for (let i = 5; i >= 0; i--) {
      const month = currentMonth - i;
      const year = month < 0 ? currentYear - 1 : currentYear;
      const monthIndex = month < 0 ? month + 12 : month;

      const monthAppointments = appointments.filter((apt) => {
        const aptDate = new Date(apt.date);
        return aptDate.getMonth() === monthIndex && aptDate.getFullYear() === year;
      });

      monthData.push({
        month: getMonthName(monthIndex),
        cases: monthAppointments.filter((apt) => apt.status === "completed").length,
      });
    }

    return monthData;
  })();

  // Get next appointment
  const nextAppointment = appointments
    .filter((apt) => {
      const aptDate = new Date(`${apt.date}T${apt.time}`);
      return aptDate > new Date() && apt.status !== "cancelled";
    })
    .sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`).getTime();
      const dateB = new Date(`${b.date}T${b.time}`).getTime();
      return dateA - dateB;
    })[0];

  return (
    <DoctorLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bảng điều khiển Bác sĩ</h1>
          <p className="text-sm text-[#687280] mt-1">
            Lịch làm việc, bệnh án và thống kê cá nhân
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <Button
            className="bg-[#007BFF] hover:bg-[#0056B3]"
            onClick={() => navigate("/doctor/appointments")}
          >
            <Stethoscope className="h-4 w-4 mr-2" />
            Khám ngay
          </Button>
          <Button
            variant="outline"
            className="border-[#E5E7EB]"
            onClick={() => navigate("/doctor/records")}
          >
            <FileText className="h-4 w-4 mr-2" />
            Tạo hồ sơ bệnh án
          </Button>
          <Button
            variant="outline"
            className="border-[#E5E7EB]"
            onClick={() => navigate("/doctor/prescriptions")}
          >
            <Pill className="h-4 w-4 mr-2" />
            Kê toa
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-[#E5E7EB]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#687280]">Ca khám hôm nay</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {loading ? "..." : todayAppointments.length}
                  </p>
                  {nextAppointment && (
                    <p className="text-xs text-[#687280] mt-1">
                      Ca tiếp theo: {nextAppointment.time}
                    </p>
                  )}
                </div>
                <Stethoscope className="h-6 w-6 text-[#007BFF]" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E5E7EB]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#687280]">Hồ sơ đang điều trị</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {loading ? "..." : activeRecords.length}
                  </p>
                  <p className="text-xs text-[#687280] mt-1">
                    Tổng hồ sơ: {ehrRecords.length}
                  </p>
                </div>
                <FileText className="h-6 w-6 text-[#16a34a]" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E5E7EB]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#687280]">Đánh giá trung bình</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {loading ? "..." : averageRating.toFixed(1)}
                  </p>
                  <p className="text-xs text-[#687280] mt-1">
                    Toa thuốc: {prescriptions.length}
                  </p>
                </div>
                <Activity className="h-6 w-6 text-[#f59e0b]" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notifications Card */}
        {unreadNotifications > 0 && (
          <Card className="border-[#E5E7EB] bg-orange-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500">
                    <Bell className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-[#687280]">Thông báo mới</p>
                    <p className="text-lg font-semibold text-gray-900">
                      Bạn có {unreadNotifications} thông báo chưa đọc
                    </p>
                    <p className="text-sm text-[#687280]">
                      Nhắc lịch khám, đơn thuốc mới và nhắc tái khám
                    </p>
                  </div>
                </div>
                <Button
                  className="bg-orange-500 hover:bg-orange-600"
                  onClick={() => navigate("/doctor/notifications")}
                >
                  Xem thông báo
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Appointment Card */}
        {nextAppointment && (
          <Card className="border-[#E5E7EB] bg-blue-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#007BFF]">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-[#687280]">Ca khám tiếp theo</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {nextAppointment.patientName}
                    </p>
                    <p className="text-sm text-[#687280]">
                      {new Date(nextAppointment.date).toLocaleDateString("vi-VN")} lúc {nextAppointment.time}
                    </p>
                  </div>
                </div>
                <Button
                  className="bg-[#007BFF] hover:bg-[#0056B3]"
                  onClick={() => navigate("/doctor/appointments")}
                >
                  Xem chi tiết
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Lịch làm việc tuần
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weeklySchedule.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={weeklySchedule}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="day" stroke="#687280" />
                    <YAxis stroke="#687280" />
                    <Tooltip />
                    <Bar dataKey="booked" name="Đặt lịch" fill="#3b82f6" />
                    <Bar dataKey="completed" name="Đã khám" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-[#687280]">
                  <div className="text-center">
                    <Calendar className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>Chưa có dữ liệu lịch làm việc</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Ca khám theo tháng
              </CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyCases.length > 0 && monthlyCases.some((m) => m.cases > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyCases}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="month" stroke="#687280" />
                    <YAxis stroke="#687280" />
                    <Tooltip />
                    <Line
                      dataKey="cases"
                      type="monotone"
                      stroke="#007BFF"
                      strokeWidth={3}
                      dot={{ fill: "#007BFF", r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-[#687280]">
                  <div className="text-center">
                    <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>Chưa có dữ liệu ca khám</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Lịch hẹn gần đây
              </CardTitle>
            </CardHeader>
            <CardContent>
              {appointments.length > 0 ? (
                <div className="space-y-3">
                  {appointments
                    .sort((a, b) => {
                      const dateA = new Date(`${a.date}T${a.time}`).getTime();
                      const dateB = new Date(`${b.date}T${b.time}`).getTime();
                      return dateB - dateA;
                    })
                    .slice(0, 5)
                    .map((apt) => (
                      <div
                        key={apt.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-[#E5E7EB] hover:bg-gray-50 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{apt.patientName}</p>
                          <p className="text-sm text-[#687280]">
                            {new Date(apt.date).toLocaleDateString("vi-VN")} lúc {apt.time}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate("/doctor/appointments")}
                        >
                          Xem
                        </Button>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-[#687280]">
                  <Calendar className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>Chưa có lịch hẹn</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Hồ sơ gần đây
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ehrRecords.length > 0 ? (
                <div className="space-y-3">
                  {ehrRecords
                    .sort((a, b) => {
                      const dateA = new Date(a.visitDate).getTime();
                      const dateB = new Date(b.visitDate).getTime();
                      return dateB - dateA;
                    })
                    .slice(0, 5)
                    .map((ehr) => (
                      <div
                        key={ehr.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-[#E5E7EB] hover:bg-gray-50 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{ehr.patientName}</p>
                          <p className="text-sm text-[#687280]">{ehr.diagnosis}</p>
                          <p className="text-xs text-[#687280]">
                            {new Date(ehr.visitDate).toLocaleDateString("vi-VN")}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate("/doctor/records")}
                        >
                          Xem
                        </Button>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-[#687280]">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>Chưa có hồ sơ</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DoctorLayout>
  );
};

export default DoctorDashboard;
