import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PatientLayout from "@/components/layout/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { CalendarPlus, Calendar, Clock, User, Stethoscope, FileText, CheckCircle2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { toast } from "sonner";
import PaymentDialog from "@/components/payment/PaymentDialog";
import { getPriceBySpecialty } from "@/lib/pricing";

const STAFF_STORAGE_KEY = "cliniccare:staff";
const APPOINTMENTS_STORAGE_KEY = "cliniccare:appointments";

// Specialty options matching Services component
const specialties = [
  { value: "Nội tổng quát", label: "Nội tổng quát" },
  { value: "Nhi", label: "Nhi khoa" },
  { value: "Tim mạch", label: "Tim mạch" },
  { value: "Tai Mũi Họng", label: "Tai Mũi Họng" },
  { value: "Chấn thương chỉnh hình", label: "Chấn thương chỉnh hình" },
  { value: "Xét nghiệm", label: "Xét nghiệm" },
  { value: "Da liễu", label: "Da liễu" },
  { value: "Dinh dưỡng", label: "Tư vấn dinh dưỡng" },
];

// Time slots
const timeSlots = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
];

interface Staff {
  id: string;
  fullName: string;
  role: "doctor" | "receptionist" | "nurse" | "manager";
  specialty?: string;
  status: "active" | "leave" | "suspended";
}

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

// Load doctors from localStorage
const loadDoctors = (specialty?: string): Array<{ id: string; name: string; specialty: string }> => {
  try {
    const stored = localStorage.getItem(STAFF_STORAGE_KEY);
    if (stored) {
      const staff: Staff[] = JSON.parse(stored);
      const doctors = staff
        .filter(
          (s) =>
            s.role === "doctor" &&
            s.status === "active" &&
            (!specialty || s.specialty === specialty || s.specialty?.includes(specialty))
        )
        .map((s) => ({
          id: s.id,
          name: s.fullName,
          specialty: s.specialty || "Nội tổng quát",
        }));
      return doctors;
    }
  } catch {}
  return [];
};

// Load existing appointments
const loadAppointments = (): Appointment[] => {
  try {
    const stored = localStorage.getItem(APPOINTMENTS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  return [];
};

// Save appointments
const saveAppointments = (appointments: Appointment[]) => {
  try {
    localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify(appointments));
  } catch {}
};

const bookingSchema = z.object({
  specialty: z.string().min(1, "Vui lòng chọn chuyên khoa"),
  doctorId: z.string().min(1, "Vui lòng chọn bác sĩ"),
  date: z.string().min(1, "Vui lòng chọn ngày"),
  time: z.string().min(1, "Vui lòng chọn giờ"),
  notes: z.string().optional(),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

const Book = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getCurrentUser();
  
  // Get pre-selected specialty from location state
  const preselectedSpecialty = (location.state as any)?.specialty;
  const serviceName = (location.state as any)?.serviceName;

  const [doctors, setDoctors] = useState<Array<{ id: string; name: string; specialty: string }>>([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>(preselectedSpecialty || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [createdAppointmentId, setCreatedAppointmentId] = useState<string | null>(null);
  const [appointmentData, setAppointmentData] = useState<{
    doctorName: string;
    specialty: string;
    date: string;
    time: string;
  } | null>(null);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      specialty: preselectedSpecialty || "",
      doctorId: "",
      date: "",
      time: "",
      notes: "",
    },
  });

  const specialtyValue = form.watch("specialty");
  const selectedDate = form.watch("date");
  const selectedDoctorId = form.watch("doctorId");
  const selectedTime = form.watch("time");

  // Load doctors when specialty changes
  useEffect(() => {
    if (specialtyValue) {
      const filteredDoctors = loadDoctors(specialtyValue);
      setDoctors(filteredDoctors);
      setSelectedSpecialty(specialtyValue);
      // Reset doctor selection when specialty changes
      if (filteredDoctors.length > 0) {
        form.setValue("doctorId", "");
        form.setValue("time", "");
      }
    }
  }, [specialtyValue]);

  // Reset time when date or doctor changes
  useEffect(() => {
    if (selectedTime && selectedDate && selectedDoctorId) {
      const isStillAvailable = isSlotAvailable(selectedDate, selectedTime, selectedDoctorId);
      if (!isStillAvailable) {
        form.setValue("time", "");
      }
    }
  }, [selectedDate, selectedDoctorId]);

  // Set minimum date to today
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  // Check if date/time slot is available
  const isSlotAvailable = (date: string, time: string, doctorId: string): boolean => {
    const appointments = loadAppointments();
    return !appointments.some(
      (apt) =>
        apt.date === date &&
        apt.time === time &&
        apt.doctorId === doctorId &&
        (apt.status === "confirmed" || apt.status === "pending")
    );
  };

  const onSubmit = async (data: BookingFormValues) => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để đặt lịch");
      navigate("/login");
      return;
    }

    // Check if slot is available
    if (!isSlotAvailable(data.date, data.time, data.doctorId)) {
      toast.error("Khung giờ này đã được đặt. Vui lòng chọn khung giờ khác.");
      return;
    }

    setIsSubmitting(true);

    // Find selected doctor
    const doctor = doctors.find((d) => d.id === data.doctorId);
    if (!doctor) {
      toast.error("Không tìm thấy thông tin bác sĩ");
      setIsSubmitting(false);
      return;
    }

    // Get patient info from user
    const patientName = user.name || "Bệnh nhân";
    const patientEmail = user.email || "";
    
    // Try to get phone from user storage
    let patientPhone = "";
    try {
      const users = JSON.parse(localStorage.getItem("cliniccare:users") || "[]");
      const userData = users.find((u: any) => u.id === user.id);
      patientPhone = userData?.phone || "";
    } catch {}

    // Generate appointment ID
    const appointments = loadAppointments();
    const nextId = `A${String(appointments.length + 1).padStart(3, "0")}`;

    const newAppointment: Appointment = {
      id: nextId,
      patientName,
      patientPhone,
      patientEmail: patientEmail || undefined,
      doctorId: data.doctorId,
      doctorName: doctor.name,
      specialty: data.specialty,
      date: data.date,
      time: data.time,
      notes: data.notes || undefined,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    // Save to localStorage
    const updatedAppointments = [...appointments, newAppointment];
    saveAppointments(updatedAppointments);

    // Create notification for patient
    try {
      const NOTIFICATIONS_KEY = "cliniccare:notifications";
      const existing = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || "[]");
      const notification = {
        id: crypto.randomUUID(),
        patientId: user.id,
        type: "appointment" as const,
        title: "Đặt lịch hẹn thành công",
        message: `Lịch hẹn với ${doctor.name} vào ${new Date(data.date).toLocaleDateString("vi-VN")} lúc ${data.time} đã được tạo. Vui lòng chờ xác nhận từ phòng khám.`,
        link: "/patient/appointments",
        relatedId: nextId,
        read: false,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify([...existing, notification]));
      window.dispatchEvent(new CustomEvent("notificationsUpdated"));
    } catch {}

    // Create notification for doctor
    try {
      const { createDoctorNotification } = require("@/lib/doctor-notifications");
      createDoctorNotification({
        doctorId: data.doctorId,
        type: "appointment_reminder",
        title: `Lịch hẹn mới - ${patientName}`,
        message: `Bệnh nhân ${patientName} đã đặt lịch hẹn với bạn vào ${new Date(data.date).toLocaleDateString("vi-VN")} lúc ${data.time} (${data.specialty}). Vui lòng xác nhận lịch hẹn.`,
        link: "/doctor/appointments",
        priority: "medium",
        relatedId: nextId,
        metadata: {
          appointmentId: nextId,
          patientId: user.id,
          patientName: patientName,
        },
      });
    } catch (error) {
      console.error("Error creating doctor notification:", error);
    }

    // Trigger storage event for cross-tab sync
    window.dispatchEvent(new Event("storage"));
    // Trigger custom event for same-tab updates
    window.dispatchEvent(new CustomEvent("appointmentsUpdated"));

    setIsSubmitting(false);
    
    // Store appointment data for payment dialog
    setCreatedAppointmentId(nextId);
    setAppointmentData({
      doctorName: doctor.name,
      specialty: data.specialty,
      date: data.date,
      time: data.time,
    });
    
    // Show payment dialog
    setShowPaymentDialog(true);
  };

  // Load doctors on mount if specialty is pre-selected
  useEffect(() => {
    if (preselectedSpecialty) {
      const filteredDoctors = loadDoctors(preselectedSpecialty);
      setDoctors(filteredDoctors);
      setSelectedSpecialty(preselectedSpecialty);
    }
  }, []);

  // Listen for staff updates
  useEffect(() => {
    const handleUpdate = () => {
      const specialtyValue = form.watch("specialty");
      if (specialtyValue) {
        setDoctors(loadDoctors(specialtyValue));
      }
    };
    window.addEventListener("staffUpdated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("staffUpdated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [form.watch("specialty")]);

  return (
    <PatientLayout>
      <div className="space-y-6">
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-[#007BFF]" />
              Đặt lịch khám
            </CardTitle>
            <CardDescription>
              {serviceName
                ? `Bạn đang đặt lịch cho dịch vụ: ${serviceName}`
                : "Chọn chuyên khoa, bác sĩ và thời gian phù hợp với bạn"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSuccess ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Đặt lịch thành công!</h3>
                <p className="text-sm text-gray-600 text-center max-w-md">
                  Lịch hẹn của bạn đã được gửi và đang chờ xác nhận. Bạn sẽ nhận được thông báo khi lịch hẹn được xác nhận.
                </p>
                <Button
                  variant="outline"
                  onClick={() => navigate("/patient/appointments")}
                  className="mt-4"
                >
                  Xem lịch hẹn của tôi
                </Button>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="specialty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Stethoscope className="h-4 w-4 text-[#007BFF]" />
                          Chuyên khoa <span className="text-red-500">*</span>
                        </FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            setSelectedSpecialty(value);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Chọn chuyên khoa" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {specialties.map((spec) => (
                              <SelectItem key={spec.value} value={spec.value}>
                                {spec.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="doctorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <User className="h-4 w-4 text-[#007BFF]" />
                          Bác sĩ <span className="text-red-500">*</span>
                        </FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={!selectedSpecialty || doctors.length === 0}
                        >
                          <FormControl>
                            <SelectTrigger className="h-11">
                              <SelectValue
                                placeholder={
                                  !selectedSpecialty
                                    ? "Vui lòng chọn chuyên khoa trước"
                                    : doctors.length === 0
                                    ? "Không có bác sĩ nào"
                                    : "Chọn bác sĩ"
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {doctors.length > 0 ? (
                              doctors.map((doc) => (
                                <SelectItem key={doc.id} value={doc.id}>
                                  {doc.name} - {doc.specialty}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="none" disabled>
                                Không có bác sĩ nào trong chuyên khoa này
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                        {selectedSpecialty && doctors.length === 0 && (
                          <p className="text-sm text-amber-600">
                            Hiện không có bác sĩ nào trong chuyên khoa này. Vui lòng chọn chuyên khoa khác.
                          </p>
                        )}
                      </FormItem>
                    )}
                  />

                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-[#007BFF]" />
                            Ngày khám <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <input
                              type="date"
                              min={getMinDate()}
                              value={field.value}
                              onChange={field.onChange}
                              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-[#007BFF]" />
                            Giờ khám <span className="text-red-500">*</span>
                          </FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={!selectedDate || !selectedDoctorId}
                          >
                            <FormControl>
                              <SelectTrigger className="h-11">
                                <SelectValue
                                  placeholder={
                                    !selectedDate || !selectedDoctorId
                                      ? "Chọn ngày và bác sĩ trước"
                                      : "Chọn giờ khám"
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {timeSlots.map((time) => {
                                const isAvailable = selectedDate && selectedDoctorId
                                  ? isSlotAvailable(selectedDate, time, selectedDoctorId)
                                  : true;
                                return (
                                  <SelectItem
                                    key={time}
                                    value={time}
                                    disabled={!isAvailable}
                                    className={!isAvailable ? "opacity-50" : ""}
                                  >
                                    {time} {!isAvailable && "(Đã đặt)"}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-[#007BFF]" />
                          Ghi chú (tùy chọn)
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Nhập thông tin bổ sung, triệu chứng, hoặc yêu cầu đặc biệt..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-4 pt-4">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 bg-[#007BFF] hover:bg-[#0056B3] h-11"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Đang xử lý...
                        </span>
                      ) : (
                        <>
                          <CalendarPlus className="h-4 w-4 mr-2" />
                          Xác nhận đặt lịch
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate("/patient/appointments")}
                      className="h-11"
                    >
                      Xem lịch hẹn
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Dialog */}
      {showPaymentDialog && createdAppointmentId && appointmentData && (
        <PaymentDialog
          open={showPaymentDialog}
          onOpenChange={(open) => {
            setShowPaymentDialog(open);
            if (!open) {
              // Reset form and show success message
              setIsSuccess(true);
              toast.success("Đặt lịch thành công! Vui lòng chờ xác nhận từ phòng khám.");
              setTimeout(() => {
                form.reset({
                  specialty: appointmentData.specialty,
                  doctorId: "",
                  date: "",
                  time: "",
                  notes: "",
                });
                setIsSuccess(false);
                setCreatedAppointmentId(null);
                setAppointmentData(null);
              }, 3000);
            }
          }}
          appointmentId={createdAppointmentId}
          amount={getPriceBySpecialty(appointmentData.specialty)}
          doctorName={appointmentData.doctorName}
          specialty={appointmentData.specialty}
          date={appointmentData.date}
          time={appointmentData.time}
          onPaymentSuccess={(paymentId, transactionId) => {
            toast.success("Thanh toán thành công! Lịch hẹn đã được xác nhận.");
            // Navigate to appointments page after successful payment
            setTimeout(() => {
              navigate("/patient/appointments");
            }, 2000);
          }}
        />
      )}
    </PatientLayout>
  );
};

export default Book;
