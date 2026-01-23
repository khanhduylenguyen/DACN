import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DoctorLayout from "@/components/layout/DoctorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  CalendarCheck,
  Search,
  Clock,
  User,
  Phone,
  Mail,
  FileText,
  Pill,
  Eye,
  CheckCircle,
  XCircle,
  Calendar,
  Stethoscope,
  Video,
  AlertCircle,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { createEHR, type EHRRecord } from "@/lib/api";
import {
  getScheduleUtilization,
  isScheduleNearlyFull,
  getSuggestedTimeSlots,
} from "@/lib/doctor-schedule";
import { createInteraction, createFollowUpFromAppointment } from "@/lib/patient-followup";
import {
  createAppointmentConfirmedNotification,
  createAppointmentCancelledNotification,
  createEHRNotification,
  createPrescriptionNotification,
} from "@/lib/patient-notifications";
import { createDoctorNotification } from "@/lib/doctor-notifications";

const APPOINTMENTS_STORAGE_KEY = "cliniccare:appointments";
const PATIENTS_STORAGE_KEY = "cliniccare:patients";

type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed";

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
  status: AppointmentStatus;
  createdAt: string;
}

interface Patient {
  id: string;
  fullName: string;
  phone: string;
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

// Save appointments to localStorage
const saveAppointments = (appointments: Appointment[]) => {
  try {
    localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify(appointments));
    window.dispatchEvent(new Event("appointmentsUpdated"));
  } catch {}
};

// Load patients to find patientId
const loadPatients = (): Patient[] => {
  try {
    const stored = localStorage.getItem(PATIENTS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  return [];
};

// Find patient ID by name or phone
const findPatientId = (patientName: string, patientPhone: string): string | null => {
  const patients = loadPatients();
  const patient = patients.find(
    (p) => p.fullName === patientName || p.phone === patientPhone
  );
  if (patient) return patient.id;

  // Try to find in users
  try {
    const users = JSON.parse(localStorage.getItem("cliniccare:users") || "[]");
    const user = users.find(
      (u: any) => u.name === patientName || u.phone === patientPhone
    );
    if (user) return user.id;
  } catch {}

  // Generate a patient ID if not found
  return `PATIENT_${patientName.replace(/\s+/g, "_")}_${patientPhone}`;
};

// Get status badge
const getStatusBadge = (status: AppointmentStatus) => {
  switch (status) {
    case "pending":
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Đang chờ</Badge>;
    case "confirmed":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Đã xác nhận</Badge>;
    case "completed":
      return <Badge className="bg-green-100 text-green-800 border-green-200">Hoàn thành</Badge>;
    case "cancelled":
      return <Badge className="bg-red-100 text-red-800 border-red-200">Đã hủy</Badge>;
  }
};

// EHR form schema
const ehrSchema = z.object({
  diagnosis: z.string().min(1, "Vui lòng nhập chẩn đoán"),
  conclusion: z.string().optional(),
  visitDate: z.string().min(1, "Vui lòng chọn ngày khám"),
});

type EHRFormValues = z.infer<typeof ehrSchema>;

const Appointments = () => {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filterStatus, setFilterStatus] = useState<AppointmentStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"today" | "all">("today");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEHRDialogOpen, setIsEHRDialogOpen] = useState(false);
  const [isPrescriptionDialogOpen, setIsPrescriptionDialogOpen] = useState(false);
  const [isFollowUpDialogOpen, setIsFollowUpDialogOpen] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({
    followUpDays: "7",
    reason: "",
  });

  const ehrForm = useForm<EHRFormValues>({
    resolver: zodResolver(ehrSchema),
    defaultValues: {
      diagnosis: "",
      conclusion: "",
      visitDate: new Date().toISOString().split("T")[0],
    },
  });

  // Load appointments
  useEffect(() => {
    const loadData = () => {
      if (!user) {
        setAppointments([]);
        return;
      }

      const allAppointments = loadAppointments();
      const doctorAppointments = allAppointments.filter(
        (apt) => apt.doctorId === user.id || apt.doctorName === user.name
      );

      // Sort by date (upcoming first)
      const sorted = doctorAppointments.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`).getTime();
        const dateB = new Date(`${b.date}T${b.time}`).getTime();
        return dateA - dateB;
      });

      setAppointments(sorted);
    };

    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener("appointmentsUpdated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("appointmentsUpdated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [user?.id]);

  // Filter appointments
  const filteredAppointments = appointments.filter((apt) => {
    // Tab filter
    if (activeTab === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const aptDate = new Date(apt.date);
      aptDate.setHours(0, 0, 0, 0);
      if (aptDate.getTime() !== today.getTime()) return false;
    }

    // Status filter
    if (filterStatus !== "all" && apt.status !== filterStatus) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        apt.patientName.toLowerCase().includes(query) ||
        apt.patientPhone.includes(query) ||
        apt.id.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Update appointment status
  const updateStatus = (id: string, newStatus: AppointmentStatus) => {
    const appointment = appointments.find((apt) => apt.id === id);
    if (!appointment) return;

    const updated = appointments.map((apt) =>
      apt.id === id ? { ...apt, status: newStatus } : apt
    );
    setAppointments(updated);
    saveAppointments(updated);

    // Create notification for patient
    try {
      // Find patient ID
      const patientId = findPatientId(appointment.patientName, appointment.patientPhone);
      
      if (patientId) {
        if (newStatus === "confirmed") {
          createAppointmentConfirmedNotification(patientId, {
            id: appointment.id,
            doctorName: appointment.doctorName,
            date: appointment.date,
            time: appointment.time,
            specialty: appointment.specialty,
          });
        } else if (newStatus === "cancelled") {
          createAppointmentCancelledNotification(patientId, {
            id: appointment.id,
            doctorName: appointment.doctorName,
            date: appointment.date,
            time: appointment.time,
          });
        }
      }
    } catch (error) {
      console.error("Error creating patient notification:", error);
    }

    toast.success("Cập nhật trạng thái thành công");
  };

  // Handle view appointment
  const handleView = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setIsViewDialogOpen(true);
  };

  // Handle create EHR
  const handleCreateEHR = (apt: Appointment) => {
    setSelectedAppointment(apt);
    ehrForm.reset({
      diagnosis: "",
      conclusion: "",
      visitDate: apt.date,
    });
    setIsEHRDialogOpen(true);
  };

  // Submit EHR
  const onSubmitEHR = async (values: EHRFormValues) => {
    if (!selectedAppointment || !user) return;

    try {
      const patientId = findPatientId(
        selectedAppointment.patientName,
        selectedAppointment.patientPhone
      );

      const ehrRecord: EHRRecord = {
        patientId: patientId || "UNKNOWN",
        visitDate: new Date(values.visitDate).toISOString(),
        doctor: user.name,
        diagnosis: values.diagnosis,
        conclusion: values.conclusion || "",
      };

      const createdEHR = await createEHR(ehrRecord);
      
      // Create interaction
      createInteraction({
        patientId: patientId || "UNKNOWN",
        patientName: selectedAppointment.patientName,
        doctorId: user.id,
        type: "ehr",
        title: `Hồ sơ y tế - ${values.diagnosis}`,
        description: values.conclusion || "",
        date: new Date(values.visitDate).toISOString(),
        metadata: { appointmentId: selectedAppointment.id, diagnosis: values.diagnosis },
      });

      // Create notification for patient
      if (patientId) {
        try {
          createEHRNotification(patientId, {
            id: createdEHR.id || `ehr-${Date.now()}`,
            doctorName: user.name || "Bác sĩ",
            diagnosis: values.diagnosis,
            visitDate: values.visitDate,
          });
        } catch (error) {
          console.error("Error creating EHR notification:", error);
        }
      }
      
      toast.success("Tạo hồ sơ bệnh án thành công");
      setIsEHRDialogOpen(false);
      setSelectedAppointment(null);
      ehrForm.reset();

      // Update appointment status to completed
      updateStatus(selectedAppointment.id, "completed");
      
      // Create interaction for appointment
      createInteraction({
        patientId: patientId || "UNKNOWN",
        patientName: selectedAppointment.patientName,
        doctorId: user.id,
        type: "appointment",
        title: `Lịch khám - ${selectedAppointment.specialty}`,
        description: `Lịch khám ngày ${selectedAppointment.date} lúc ${selectedAppointment.time}`,
        date: selectedAppointment.date,
        metadata: { appointmentId: selectedAppointment.id, status: "completed" },
      });
    } catch (error) {
      console.error("Error creating EHR:", error);
      toast.error("Có lỗi xảy ra khi tạo hồ sơ bệnh án");
    }
  };

  // Handle create prescription
  const handleCreatePrescription = (apt: Appointment) => {
    // Navigate to prescriptions page with appointment data
    const patientId = findPatientId(apt.patientName, apt.patientPhone);
    navigate("/doctor/prescriptions", {
      state: { appointment: apt, patientId },
    });
  };

  const today = new Date();
  const todayAppointments = filteredAppointments.filter((apt) => {
    const aptDate = new Date(apt.date);
    aptDate.setHours(0, 0, 0, 0);
    const todayDate = new Date(today);
    todayDate.setHours(0, 0, 0, 0);
    return aptDate.getTime() === todayDate.getTime();
  });

  // Get schedule warnings
  const getScheduleWarnings = () => {
    if (!user?.id) return [];

    const warnings: Array<{ date: string; percentage: number }> = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      
      if (isScheduleNearlyFull(user.id, dateStr, appointments)) {
        const utilization = getScheduleUtilization(user.id, dateStr, appointments);
        warnings.push({ date: dateStr, percentage: utilization.percentage });
      }
    }

    return warnings;
  };

  const scheduleWarnings = getScheduleWarnings();

  return (
    <DoctorLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lịch khám</h1>
          <p className="text-sm text-[#687280] mt-1">
            Quản lý và xem lịch hẹn khám của bệnh nhân
          </p>
        </div>

        {/* Schedule Warnings */}
        {scheduleWarnings.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-orange-900">
                <AlertCircle className="h-5 w-5" />
                Cảnh báo: Lịch sắp đầy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {scheduleWarnings.map((warning) => {
                  const date = new Date(warning.date);
                  const dateStr = date.toLocaleDateString("vi-VN", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  });
                  return (
                    <div key={warning.date} className="flex items-center justify-between p-2 bg-white rounded">
                      <span className="text-sm font-medium">{dateStr}</span>
                      <Badge variant="destructive">{warning.percentage}% đã đặt</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#687280]" />
                  <Input
                    placeholder="Tìm kiếm theo tên, số điện thoại, mã lịch hẹn..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 border-[#E5E7EB]"
                  />
                </div>
              </div>
              <Select
                value={filterStatus}
                onValueChange={(value) => setFilterStatus(value as AppointmentStatus | "all")}
              >
                <SelectTrigger className="w-full md:w-[200px] border-[#E5E7EB]">
                  <SelectValue placeholder="Lọc theo trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả trạng thái</SelectItem>
                  <SelectItem value="pending">Đang chờ</SelectItem>
                  <SelectItem value="confirmed">Đã xác nhận</SelectItem>
                  <SelectItem value="completed">Hoàn thành</SelectItem>
                  <SelectItem value="cancelled">Đã hủy</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "today" | "all")}>
          <TabsList className="border-[#E5E7EB]">
            <TabsTrigger value="today">Hôm nay ({todayAppointments.length})</TabsTrigger>
            <TabsTrigger value="all">Tất cả ({appointments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="mt-6">
            <Card className="border-[#E5E7EB]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Lịch khám hôm nay
                </CardTitle>
              </CardHeader>
              <CardContent>
                {todayAppointments.length > 0 ? (
                  <div className="space-y-3">
                    {todayAppointments.map((apt) => (
                      <div
                        key={apt.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-[#E5E7EB] hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-900">{apt.patientName}</h3>
                            {getStatusBadge(apt.status)}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-[#687280]">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span>{apt.time}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              <span>{apt.patientPhone}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span>#{apt.id}</span>
                            </div>
                          </div>
                          {apt.notes && (
                            <p className="text-sm text-[#687280] mt-2">{apt.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {apt.status === "confirmed" && (
                            <>
                              <Button
                                size="sm"
                                className="bg-[#16a34a] hover:bg-[#15803d]"
                                onClick={() => navigate(`/telemedicine/${apt.id}`)}
                              >
                                <Video className="h-4 w-4 mr-2" />
                                Gọi video
                              </Button>
                              <Button
                                size="sm"
                                className="bg-[#007BFF] hover:bg-[#0056B3]"
                                onClick={() => handleView(apt)}
                              >
                                <Stethoscope className="h-4 w-4 mr-2" />
                                Khám ngay
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCreateEHR(apt)}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Tạo hồ sơ
                              </Button>
                            </>
                          )}
                          {apt.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(apt.id, "confirmed")}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Xác nhận
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleView(apt)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-[#687280]">
                    <CalendarCheck className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>Không có lịch khám nào hôm nay</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all" className="mt-6">
            <Card className="border-[#E5E7EB]">
              <CardHeader>
                <CardTitle>Tất cả lịch hẹn</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredAppointments.length > 0 ? (
                  <div className="space-y-3">
                    {filteredAppointments.map((apt) => {
                      const aptDate = new Date(`${apt.date}T${apt.time}`);
                      const isPast = aptDate < new Date();
                      const isToday = (() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const aptDateOnly = new Date(apt.date);
                        aptDateOnly.setHours(0, 0, 0, 0);
                        return aptDateOnly.getTime() === today.getTime();
                      })();

                      return (
                        <div
                          key={apt.id}
                          className={`flex items-center justify-between p-4 rounded-lg border ${
                            isPast && apt.status !== "completed"
                              ? "border-red-200 bg-red-50"
                              : isToday
                              ? "border-blue-200 bg-blue-50"
                              : "border-[#E5E7EB]"
                          } hover:bg-gray-50 transition-colors`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-gray-900">{apt.patientName}</h3>
                              {getStatusBadge(apt.status)}
                              {isToday && (
                                <Badge className="bg-blue-100 text-blue-800">Hôm nay</Badge>
                              )}
                              {isPast && apt.status !== "completed" && (
                                <Badge className="bg-red-100 text-red-800">Quá hạn</Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm text-[#687280]">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                <span>
                                  {new Date(apt.date).toLocaleDateString("vi-VN")} lúc {apt.time}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4" />
                                <span>{apt.patientPhone}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span>BS. {apt.doctorName}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span>#{apt.id}</span>
                              </div>
                            </div>
                            {apt.notes && (
                              <p className="text-sm text-[#687280] mt-2">{apt.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {apt.status === "confirmed" && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-[#16a34a] hover:bg-[#15803d]"
                                  onClick={() => navigate(`/telemedicine/${apt.id}`)}
                                >
                                  <Video className="h-4 w-4 mr-2" />
                                  Gọi video
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-[#007BFF] hover:bg-[#0056B3]"
                                  onClick={() => handleView(apt)}
                                >
                                  <Stethoscope className="h-4 w-4 mr-2" />
                                  Khám
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCreateEHR(apt)}
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  Hồ sơ
                                </Button>
                              </>
                            )}
                            {apt.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatus(apt.id, "confirmed")}
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Xác nhận
                              </Button>
                            )}
                            {apt.status !== "cancelled" && apt.status !== "completed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatus(apt.id, "cancelled")}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Hủy
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleView(apt)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-[#687280]">
                    <CalendarCheck className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>Không có lịch hẹn nào</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* View Appointment Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Chi tiết lịch hẹn</DialogTitle>
              <DialogDescription>Thông tin chi tiết về lịch hẹn khám</DialogDescription>
            </DialogHeader>
            {selectedAppointment && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[#687280]">Mã lịch hẹn</label>
                    <p className="text-gray-900 font-medium">#{selectedAppointment.id}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#687280]">Trạng thái</label>
                    <div className="mt-1">{getStatusBadge(selectedAppointment.status)}</div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#687280]">Bệnh nhân</label>
                  <p className="text-gray-900 font-medium">{selectedAppointment.patientName}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[#687280]">Số điện thoại</label>
                    <p className="text-gray-900">{selectedAppointment.patientPhone}</p>
                  </div>
                  {selectedAppointment.patientEmail && (
                    <div>
                      <label className="text-sm font-medium text-[#687280]">Email</label>
                      <p className="text-gray-900">{selectedAppointment.patientEmail}</p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[#687280]">Ngày khám</label>
                    <p className="text-gray-900">
                      {new Date(selectedAppointment.date).toLocaleDateString("vi-VN", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#687280]">Giờ khám</label>
                    <p className="text-gray-900">{selectedAppointment.time}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#687280]">Bác sĩ</label>
                  <p className="text-gray-900">
                    {selectedAppointment.doctorName} - {selectedAppointment.specialty}
                  </p>
                </div>
                {selectedAppointment.notes && (
                  <div>
                    <label className="text-sm font-medium text-[#687280]">Ghi chú</label>
                    <p className="text-gray-900">{selectedAppointment.notes}</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              {selectedAppointment && selectedAppointment.status === "confirmed" && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsViewDialogOpen(false);
                      handleCreateEHR(selectedAppointment);
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Tạo hồ sơ bệnh án
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsViewDialogOpen(false);
                      handleCreatePrescription(selectedAppointment);
                    }}
                  >
                    <Pill className="h-4 w-4 mr-2" />
                    Kê toa
                  </Button>
                  <Button
                    className="bg-[#007BFF] hover:bg-[#0056B3]"
                    onClick={() => {
                      setIsFollowUpDialogOpen(true);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Hoàn thành
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                Đóng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create EHR Dialog */}
        <Dialog open={isEHRDialogOpen} onOpenChange={setIsEHRDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tạo hồ sơ bệnh án</DialogTitle>
              <DialogDescription>
                Tạo hồ sơ bệnh án cho {selectedAppointment?.patientName}
              </DialogDescription>
            </DialogHeader>
            <Form {...ehrForm}>
              <form onSubmit={ehrForm.handleSubmit(onSubmitEHR)} className="space-y-4">
                <FormField
                  control={ehrForm.control}
                  name="visitDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ngày khám *</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          className="border-[#E5E7EB]"
                          max={new Date().toISOString().split("T")[0]}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={ehrForm.control}
                  name="diagnosis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chẩn đoán *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Nhập chẩn đoán"
                          {...field}
                          className="border-[#E5E7EB]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={ehrForm.control}
                  name="conclusion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kết luận</FormLabel>
                      <FormControl>
                        <textarea
                          placeholder="Nhập kết luận (tùy chọn)"
                          {...field}
                          rows={3}
                          className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEHRDialogOpen(false)}
                  >
                    Hủy
                  </Button>
                  <Button type="submit" className="bg-[#007BFF] hover:bg-[#0056B3]">
                    Tạo hồ sơ
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Follow-up Reminder Dialog */}
        <Dialog open={isFollowUpDialogOpen} onOpenChange={setIsFollowUpDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tạo nhắc tái khám</DialogTitle>
              <DialogDescription>
                Tạo nhắc tái khám cho {selectedAppointment?.patientName} sau khi hoàn thành lịch hẹn
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="followUpDays">Số ngày tái khám</Label>
                <Input
                  id="followUpDays"
                  type="number"
                  value={followUpForm.followUpDays}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, followUpDays: e.target.value })}
                  min="1"
                  placeholder="7"
                />
                <p className="text-xs text-[#687280] mt-1">
                  Bệnh nhân sẽ được nhắc tái khám sau {followUpForm.followUpDays || 7} ngày
                </p>
              </div>
              <div>
                <Label htmlFor="followUpReason">Lý do tái khám *</Label>
                <Input
                  id="followUpReason"
                  value={followUpForm.reason}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, reason: e.target.value })}
                  placeholder="Ví dụ: Kiểm tra sau điều trị, Tái khám định kỳ..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsFollowUpDialogOpen(false);
                  setFollowUpForm({ followUpDays: "7", reason: "" });
                }}
              >
                Bỏ qua
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (!selectedAppointment || !user) return;
                  updateStatus(selectedAppointment.id, "completed");
                  setIsFollowUpDialogOpen(false);
                  setIsViewDialogOpen(false);
                  setFollowUpForm({ followUpDays: "7", reason: "" });
                }}
              >
                Hoàn thành (không tạo nhắc)
              </Button>
              <Button
                className="bg-[#007BFF] hover:bg-[#0056B3]"
                onClick={() => {
                  if (!selectedAppointment || !user) return;
                  
                  if (!followUpForm.reason.trim()) {
                    toast.error("Vui lòng nhập lý do tái khám");
                    return;
                  }

                  const patientId = findPatientId(
                    selectedAppointment.patientName,
                    selectedAppointment.patientPhone
                  );

                  try {
                    createFollowUpFromAppointment(
                      selectedAppointment.id,
                      patientId || "UNKNOWN",
                      selectedAppointment.patientName,
                      user.id,
                      parseInt(followUpForm.followUpDays) || 7,
                      followUpForm.reason
                    );

                    // Create interaction
                    createInteraction({
                      patientId: patientId || "UNKNOWN",
                      patientName: selectedAppointment.patientName,
                      doctorId: user.id,
                      type: "followup",
                      title: `Nhắc tái khám - ${followUpForm.reason}`,
                      description: `Tái khám sau ${followUpForm.followUpDays} ngày`,
                      date: new Date().toISOString(),
                      metadata: { appointmentId: selectedAppointment.id },
                    });

                    updateStatus(selectedAppointment.id, "completed");
                    toast.success("Đã hoàn thành lịch hẹn và tạo nhắc tái khám");
                    setIsFollowUpDialogOpen(false);
                    setIsViewDialogOpen(false);
                    setFollowUpForm({ followUpDays: "7", reason: "" });
                  } catch (error) {
                    console.error("Error creating follow-up:", error);
                    toast.error("Có lỗi xảy ra khi tạo nhắc tái khám");
                  }
                }}
              >
                Hoàn thành & Tạo nhắc
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DoctorLayout>
  );
};

export default Appointments;
