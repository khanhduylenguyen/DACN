import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DoctorLayout from "@/components/layout/DoctorLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pill,
  Calendar,
  User,
  Search,
  Plus,
  Trash2,
  Eye,
  Edit,
  Printer,
  Download,
  FileText,
  X,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createSchedulesFromPrescription } from "@/lib/medication-schedule";
import { createInteraction } from "@/lib/patient-followup";
import { createPrescriptionNotification as createPatientPrescriptionNotification } from "@/lib/patient-notifications";
import { createPrescription, listPrescriptions, updatePrescription, deletePrescription, type Prescription, type PrescriptionDrug } from "@/lib/api";
import { toast } from "sonner";

const PATIENTS_STORAGE_KEY = "cliniccare:patients";
const APPOINTMENTS_STORAGE_KEY = "cliniccare:appointments";

interface Patient {
  id: string;
  fullName: string;
  phone: string;
}

interface Appointment {
  id: string;
  patientName: string;
  patientPhone: string;
  patientId?: string;
}

// Load patients
const loadPatients = (): Patient[] => {
  try {
    const stored = localStorage.getItem(PATIENTS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  return [];
};

// Load appointments
const loadAppointments = (): Appointment[] => {
  try {
    const stored = localStorage.getItem(APPOINTMENTS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  return [];
};

// Find patient ID by name or phone
const findPatientId = (patientName: string, patientPhone?: string): string | null => {
  const patients = loadPatients();
  const patient = patients.find(
    (p) => p.fullName === patientName || (patientPhone && p.phone === patientPhone)
  );
  if (patient) return patient.id;

  // Try to find in appointments
  const appointments = loadAppointments();
  const appointment = appointments.find(
    (apt) => apt.patientName === patientName || (patientPhone && apt.patientPhone === patientPhone)
  );
  if (appointment?.patientId) return appointment.patientId;

  // Generate a patient ID if not found
  return `PATIENT_${patientName.replace(/\s+/g, "_")}_${patientPhone || Date.now()}`;
};

// Form schema
const prescriptionSchema = z.object({
  patientName: z.string().min(1, "Vui lòng chọn hoặc nhập tên bệnh nhân"),
  diagnosis: z.string().optional(),
  notes: z.string().optional(),
});

type PrescriptionFormValues = z.infer<typeof prescriptionSchema>;

const Prescriptions = () => {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "completed" | "cancelled">("all");
  const [drugs, setDrugs] = useState<PrescriptionDrug[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const isLoadingRef = useRef(false);

  const form = useForm<PrescriptionFormValues>({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: {
      patientName: "",
      diagnosis: "",
      notes: "",
    },
  });

  // Load initial data
  useEffect(() => {
    if (!user) {
      setPrescriptions([]);
      setIsLoading(false);
      return;
    }

    setPatients(loadPatients());
    setAppointments(loadAppointments());

    // Check if coming from appointment
    const state = location.state as { appointment?: Appointment } | null;
    if (state?.appointment) {
      form.setValue("patientName", state.appointment.patientName);
      setIsCreateDialogOpen(true);
    }
  }, [user, location, form]);

  // Load prescriptions
  useEffect(() => {
    if (!user) {
      setPrescriptions([]);
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      if (isLoadingRef.current) return;

      isLoadingRef.current = true;
      setIsLoading(true);

      try {
        const doctorPrescriptions = await listPrescriptions({ doctorId: user.id });
        setPrescriptions(doctorPrescriptions);
      } catch (error) {
        console.error("Error loading prescriptions:", error);
        setPrescriptions([]);
        toast.error("Không thể tải danh sách toa thuốc");
      } finally {
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    };

    loadData();
  }, [user?.id]);

  // Filter prescriptions
  const filteredPrescriptions = prescriptions.filter((p) => {
    const matchesSearch =
      p.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.diagnosis?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.drugs.some((drug) => drug.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = filterStatus === "all" || p.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleCreate = () => {
    setDrugs([]);
    form.reset();
    setIsCreateDialogOpen(true);
  };

  const handleEdit = (prescription: Prescription) => {
    setSelectedPrescription(prescription);
    form.setValue("patientName", prescription.patientName);
    form.setValue("diagnosis", prescription.diagnosis || "");
    form.setValue("notes", prescription.notes || "");
    setDrugs([...prescription.drugs]);
    setIsEditDialogOpen(true);
  };

  const handleView = (prescription: Prescription) => {
    setSelectedPrescription(prescription);
    setIsViewDialogOpen(true);
  };

  const handleDelete = async (prescription: Prescription) => {
    if (confirm("Bạn có chắc chắn muốn xóa toa thuốc này?")) {
      try {
        await deletePrescription(prescription._id!);
        setPrescriptions(prev => prev.filter(p => p._id !== prescription._id));
        toast.success("Đã xóa toa thuốc");
      } catch (error) {
        console.error("Error deleting prescription:", error);
        toast.error("Không thể xóa toa thuốc");
      }
    }
  };

  const handleAddDrug = () => {
    setDrugs([
      ...drugs,
      {
        name: "",
        dose: "",
        quantity: "",
        instructions: "",
      },
    ]);
  };

  const handleRemoveDrug = (index: number) => {
    setDrugs(drugs.filter((_, i) => i !== index));
  };

  const handleDrugChange = (index: number, field: keyof PrescriptionDrug, value: string) => {
    const updated = [...drugs];
    updated[index] = { ...updated[index], [field]: value };
    setDrugs(updated);
  };

  const onSubmit = async (data: PrescriptionFormValues) => {
    if (!user) return;

    if (drugs.length === 0) {
      alert("Vui lòng thêm ít nhất một loại thuốc");
      return;
    }

    // Validate drugs
    const invalidDrug = drugs.find((drug) => !drug.name || !drug.dose);
    if (invalidDrug) {
      alert("Vui lòng điền đầy đủ tên thuốc và liều dùng cho tất cả các thuốc");
      return;
    }

    const patientId = findPatientId(data.patientName);

    try {
      if (isEditDialogOpen && selectedPrescription) {
        // Update existing prescription
        const updatedPrescription = await updatePrescription(selectedPrescription._id!, {
          patientName: data.patientName,
          patientId: patientId || selectedPrescription.patientId,
          drugs: drugs,
          diagnosis: data.diagnosis,
          notes: data.notes,
          date: new Date().toISOString(),
        });

        setPrescriptions(prev => prev.map(p => p._id === selectedPrescription._id ? updatedPrescription : p));
        setIsEditDialogOpen(false);
        setSelectedPrescription(null);
        toast.success("Đã cập nhật toa thuốc");
      } else {
        // Create new prescription
        const newPrescription = await createPrescription({
          patientId: patientId || "",
          patientName: data.patientName,
          doctorId: user.id,
          doctorName: user.name || "Bác sĩ",
          date: new Date().toISOString(),
          drugs: drugs,
          diagnosis: data.diagnosis,
          notes: data.notes,
          status: "active",
        });

        setPrescriptions(prev => [newPrescription, ...prev]);

        // Create interaction
        createInteraction({
          patientId: patientId || "UNKNOWN",
          patientName: data.patientName,
          doctorId: user.id,
          type: "prescription",
          title: `Đơn thuốc - ${data.diagnosis || "Không có chẩn đoán"}`,
          description: `${drugs.length} loại thuốc: ${drugs.map((d) => d.name).join(", ")}`,
          date: new Date().toISOString(),
          metadata: { prescriptionId: newPrescription._id, diagnosis: data.diagnosis },
        });

        // Create notification for patient
        if (patientId) {
          try {
            createPatientPrescriptionNotification(patientId, {
              id: newPrescription._id!,
              doctorName: user.name || "Bác sĩ",
              diagnosis: data.diagnosis,
            });
          } catch (error) {
            console.error("Error creating prescription notification:", error);
          }
        }

        // Tự động tạo lịch uống thuốc
        if (patientId) {
          try {
            const schedules = createSchedulesFromPrescription(
              newPrescription._id!,
              patientId,
              drugs,
              new Date().toISOString().split("T")[0]
            );
            toast.success(`Đã tạo đơn thuốc và ${schedules.length} lịch uống thuốc`);
          } catch (error) {
            console.error("Error creating medication schedules:", error);
            toast.success("Đã tạo đơn thuốc");
          }
        } else {
          toast.success("Đã tạo đơn thuốc");
        }

        setIsCreateDialogOpen(false);
      }
    } catch (error) {
      console.error("Error saving prescription:", error);
      toast.error("Không thể lưu toa thuốc");
    }

    setDrugs([]);
    form.reset();
  };

  const printPrescription = (prescription: Prescription) => {
    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Toa thuốc - ${formatDate(prescription.date)}</title>
          <style>
            @media print {
              body { margin: 0; }
            }
            body { 
              font-family: Arial, sans-serif; 
              padding: 40px; 
              max-width: 800px; 
              margin: 0 auto;
              line-height: 1.6;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #007BFF;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: bold;
              color: #007BFF;
            }
            .clinic-name {
              font-size: 18px;
              margin: 10px 0;
              color: #111827;
            }
            .prescription-info {
              margin: 20px 0;
              padding: 15px;
              background-color: #F9FAFB;
              border-radius: 8px;
            }
            .prescription-info p {
              margin: 8px 0;
            }
            .drug-list {
              margin: 30px 0;
            }
            .drug-item {
              margin: 15px 0;
              padding: 15px;
              border-left: 3px solid #007BFF;
              background-color: #F9FAFB;
              border-radius: 4px;
            }
            .drug-name {
              font-weight: bold;
              font-size: 16px;
              color: #111827;
            }
            .drug-dose {
              margin-top: 8px;
              color: #687280;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #E5E7EB;
            }
            .signature {
              margin-top: 60px;
              text-align: right;
            }
            .doctor-name {
              font-weight: bold;
              margin-top: 40px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="clinic-name">PHÒNG KHÁM CLINICCARE</div>
            <h1>TOA THUỐC</h1>
          </div>
          
          <div class="prescription-info">
            <p><strong>Bệnh nhân:</strong> ${prescription.patientName}</p>
            <p><strong>Ngày kê đơn:</strong> ${formatDate(prescription.date)}</p>
            ${prescription.doctorName ? `<p><strong>Bác sĩ kê đơn:</strong> ${prescription.doctorName}</p>` : ""}
            ${prescription.diagnosis ? `<p><strong>Chẩn đoán:</strong> ${prescription.diagnosis}</p>` : ""}
          </div>
          
          <div class="drug-list">
            <h3 style="margin-bottom: 20px;">Danh sách thuốc:</h3>
            ${prescription.drugs.map((drug, index) => `
              <div class="drug-item">
                <div class="drug-name">${index + 1}. ${drug.name}</div>
                <div class="drug-dose">
                  <strong>Liều dùng:</strong> ${drug.dose}
                  ${drug.quantity ? `<br><strong>Số lượng:</strong> ${drug.quantity}` : ""}
                  ${drug.instructions ? `<br><strong>Hướng dẫn:</strong> ${drug.instructions}` : ""}
                </div>
              </div>
            `).join("")}
          </div>
          
          ${prescription.notes ? `
          <div class="footer">
            <p><strong>Ghi chú:</strong> ${prescription.notes}</p>
          </div>
          ` : ""}
          
          <div class="signature">
            <div class="doctor-name">${prescription.doctorName}</div>
            <p style="margin-top: 10px;">Bác sĩ kê đơn</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  // Get unique patient names from prescriptions and appointments
  const getPatientOptions = () => {
    const prescriptionPatients = prescriptions.map((p) => p.patientName);
    const appointmentPatients = appointments.map((apt) => apt.patientName);
    const patientListPatients = patients.map((p) => p.fullName);
    const allPatients = [...new Set([...prescriptionPatients, ...appointmentPatients, ...patientListPatients])];
    return allPatients.sort();
  };

  return (
    <DoctorLayout>
      <div className="space-y-6">
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Pill className="h-5 w-5 text-[#007BFF]" />
                  Quản lý toa thuốc
                </CardTitle>
                <CardDescription className="mt-2">
                  Kê toa thuốc, xem danh sách và in toa thuốc cho bệnh nhân.
                </CardDescription>
              </div>
              <Button
                onClick={handleCreate}
                className="bg-[#007BFF] hover:bg-[#0056B3]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Tạo toa mới
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search and Filter */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#687280]" />
                <Input
                  placeholder="Tìm kiếm theo tên bệnh nhân, chẩn đoán, thuốc..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-[#E5E7EB]"
                />
              </div>
              <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                <SelectTrigger className="w-full sm:w-[180px] border-[#E5E7EB]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="active">Đang dùng</SelectItem>
                  <SelectItem value="completed">Đã hoàn thành</SelectItem>
                  <SelectItem value="cancelled">Đã hủy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <div className="inline-block h-8 w-8 border-4 border-[#007BFF] border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-[#687280]">Đang tải dữ liệu...</p>
              </div>
            ) : filteredPrescriptions.length === 0 ? (
              <div className="text-center py-12">
                <Pill className="h-16 w-16 text-[#687280] mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium text-gray-900 mb-2">Chưa có toa thuốc nào</p>
                <p className="text-sm text-[#687280]">
                  {searchQuery || filterStatus !== "all"
                    ? "Không tìm thấy toa thuốc nào phù hợp"
                    : "Bắt đầu bằng cách tạo toa thuốc mới cho bệnh nhân."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPrescriptions.map((prescription) => (
                  <div
                    key={prescription.id}
                    className="p-4 rounded-lg border border-[#E5E7EB] bg-white hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <Calendar className="h-4 w-4 text-[#007BFF]" />
                          <span className="font-semibold text-gray-900">
                            {formatDate(prescription.date)}
                          </span>
                          {prescription.status && (
                            <Badge
                              variant="outline"
                              className={
                                prescription.status === "active"
                                  ? "bg-blue-50 text-blue-600 border-blue-200"
                                  : prescription.status === "completed"
                                  ? "bg-green-50 text-green-600 border-green-200"
                                  : "bg-red-50 text-red-600 border-red-200"
                              }
                            >
                              {prescription.status === "active"
                                ? "Đang dùng"
                                : prescription.status === "completed"
                                ? "Đã hoàn thành"
                                : "Đã hủy"}
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-[#687280]" />
                            <span className="text-sm font-medium text-gray-900">
                              {prescription.patientName}
                            </span>
                          </div>
                          {prescription.diagnosis && (
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-[#687280]" />
                              <span className="text-sm text-[#687280]">{prescription.diagnosis}</span>
                            </div>
                          )}
                          <div className="mt-3">
                            <p className="text-sm font-medium text-gray-900 mb-2">Danh sách thuốc:</p>
                            <ul className="list-disc pl-5 space-y-1">
                              {prescription.drugs.slice(0, 3).map((drug, index) => (
                                <li key={index} className="text-sm text-[#687280]">
                                  {drug.name} — {drug.dose}
                                </li>
                              ))}
                              {prescription.drugs.length > 3 && (
                                <li className="text-sm text-[#007BFF] font-medium">
                                  và {prescription.drugs.length - 3} thuốc khác...
                                </li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleView(prescription)}
                          className="border-[#E5E7EB]"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(prescription)}
                          className="border-[#E5E7EB]"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => printPrescription(prescription)}
                          className="border-[#E5E7EB]"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(prescription)}
                          className="border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isCreateDialogOpen || isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setIsEditDialogOpen(false);
            setDrugs([]);
            form.reset();
            setSelectedPrescription(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditDialogOpen ? "Chỉnh sửa toa thuốc" : "Tạo toa thuốc mới"}
            </DialogTitle>
            <DialogDescription>
              {isEditDialogOpen
                ? "Cập nhật thông tin toa thuốc cho bệnh nhân."
                : "Nhập thông tin để tạo toa thuốc mới cho bệnh nhân."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="patientName">Tên bệnh nhân *</Label>
                <Select
                  value={form.watch("patientName")}
                  onValueChange={(value) => form.setValue("patientName", value)}
                >
                  <SelectTrigger className="border-[#E5E7EB]">
                    <SelectValue placeholder="Chọn hoặc nhập tên bệnh nhân" />
                  </SelectTrigger>
                  <SelectContent>
                    {getPatientOptions().map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.patientName && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.patientName.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="diagnosis">Chẩn đoán</Label>
                <Input
                  id="diagnosis"
                  {...form.register("diagnosis")}
                  placeholder="Nhập chẩn đoán"
                  className="border-[#E5E7EB]"
                />
              </div>

              <div>
                <Label htmlFor="notes">Ghi chú</Label>
                <Textarea
                  id="notes"
                  {...form.register("notes")}
                  placeholder="Nhập ghi chú (nếu có)"
                  className="border-[#E5E7EB]"
                  rows={3}
                />
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <Label>Danh sách thuốc *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddDrug}
                    className="border-[#E5E7EB]"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Thêm thuốc
                  </Button>
                </div>

                {drugs.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-[#E5E7EB] rounded-md">
                    <Pill className="h-8 w-8 text-[#687280] mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-[#687280]">Chưa có thuốc nào. Nhấn "Thêm thuốc" để bắt đầu.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {drugs.map((drug, index) => (
                      <Card key={index} className="border-[#E5E7EB] p-4">
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-sm font-medium text-gray-900">
                            Thuốc {index + 1}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveDrug(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Tên thuốc *</Label>
                            <Input
                              value={drug.name}
                              onChange={(e) => handleDrugChange(index, "name", e.target.value)}
                              placeholder="Nhập tên thuốc"
                              className="border-[#E5E7EB]"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Liều dùng *</Label>
                            <Input
                              value={drug.dose}
                              onChange={(e) => handleDrugChange(index, "dose", e.target.value)}
                              placeholder="Ví dụ: 1 viên/lần, 2 lần/ngày"
                              className="border-[#E5E7EB]"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Số lượng</Label>
                            <Input
                              value={drug.quantity}
                              onChange={(e) => handleDrugChange(index, "quantity", e.target.value)}
                              placeholder="Ví dụ: 30 viên"
                              className="border-[#E5E7EB]"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Hướng dẫn</Label>
                            <Input
                              value={drug.instructions}
                              onChange={(e) => handleDrugChange(index, "instructions", e.target.value)}
                              placeholder="Ví dụ: Uống sau khi ăn"
                              className="border-[#E5E7EB]"
                            />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  setIsEditDialogOpen(false);
                  setDrugs([]);
                  form.reset();
                  setSelectedPrescription(null);
                }}
                className="border-[#E5E7EB]"
              >
                Hủy
              </Button>
              <Button type="submit" className="bg-[#007BFF] hover:bg-[#0056B3]">
                {isEditDialogOpen ? "Cập nhật" : "Tạo toa thuốc"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết toa thuốc</DialogTitle>
            <DialogDescription>Thông tin chi tiết về toa thuốc</DialogDescription>
          </DialogHeader>
          {selectedPrescription && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-[#687280]">Bệnh nhân</Label>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedPrescription.patientName}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-[#687280]">Ngày kê đơn</Label>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDate(selectedPrescription.date)}
                  </p>
                </div>
                {selectedPrescription.diagnosis && (
                  <div className="col-span-2">
                    <Label className="text-xs text-[#687280]">Chẩn đoán</Label>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedPrescription.diagnosis}
                    </p>
                  </div>
                )}
                {selectedPrescription.notes && (
                  <div className="col-span-2">
                    <Label className="text-xs text-[#687280]">Ghi chú</Label>
                    <p className="text-sm text-gray-900">{selectedPrescription.notes}</p>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <Label className="text-sm font-medium text-gray-900 mb-3 block">
                  Danh sách thuốc
                </Label>
                <div className="space-y-3">
                  {selectedPrescription.drugs.map((drug, index) => (
                    <Card key={index} className="border-[#E5E7EB] p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#007BFF] text-white flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 mb-2">{drug.name}</p>
                          <div className="space-y-1 text-sm text-[#687280]">
                            <p>
                              <strong>Liều dùng:</strong> {drug.dose}
                            </p>
                            {drug.quantity && (
                              <p>
                                <strong>Số lượng:</strong> {drug.quantity}
                              </p>
                            )}
                            {drug.instructions && (
                              <p>
                                <strong>Hướng dẫn:</strong> {drug.instructions}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsViewDialogOpen(false)}
              className="border-[#E5E7EB]"
            >
              Đóng
            </Button>
            {selectedPrescription && (
              <Button
                onClick={() => printPrescription(selectedPrescription)}
                className="bg-[#007BFF] hover:bg-[#0056B3]"
              >
                <Printer className="h-4 w-4 mr-2" />
                In toa thuốc
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DoctorLayout>
  );
};

export default Prescriptions;
