import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DoctorLayout from "@/components/layout/DoctorLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Users,
  Search,
  Calendar,
  Heart,
  Activity,
  Pill,
  FileText,
  Syringe,
  AlertCircle,
  ArrowRight,
  Plus,
  User,
  Clock,
  Stethoscope,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getFamilyMembers, getAge, type FamilyMember } from "@/lib/family";
import {
  getHealthRecords,
  getVaccinationRecords,
  getMedicationRecords,
  getActiveMedications,
  type PersonalHealthRecord,
  type VaccinationRecord,
  type MedicationRecord,
} from "@/lib/family-health";
import { getAppointmentsForFamilyMember } from "@/lib/family";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const APPOINTMENTS_STORAGE_KEY = "cliniccare:appointments";

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

interface PatientWithFamily {
  patientId: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  familyMembers: FamilyMember[];
}

const FamilyPatients = () => {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [patients, setPatients] = useState<PatientWithFamily[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<PatientWithFamily[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientWithFamily | null>(null);
  const [selectedFamilyMember, setSelectedFamilyMember] = useState<FamilyMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dialog states
  const [showFamilyDetailDialog, setShowFamilyDetailDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showBulkAppointmentDialog, setShowBulkAppointmentDialog] = useState(false);
  const [showHealthDashboardDialog, setShowHealthDashboardDialog] = useState(false);
  
  // Bulk appointment form
  const [bulkAppointmentForm, setBulkAppointmentForm] = useState({
    date: "",
    time: "",
    specialty: "",
    notes: "",
    selectedMembers: [] as string[],
  });

  // Load patients with their families
  const loadPatients = useCallback(() => {
    try {
      // Get all appointments to find unique patients
      const appointments: Appointment[] = JSON.parse(
        localStorage.getItem(APPOINTMENTS_STORAGE_KEY) || "[]"
      );
      
      // Get unique patients (by name + phone)
      const uniquePatients = new Map<string, { name: string; phone: string; email?: string }>();
      
      appointments.forEach((apt) => {
        if (apt.doctorId === currentUser?.id) {
          const key = `${apt.patientName}_${apt.patientPhone}`;
          if (!uniquePatients.has(key)) {
            uniquePatients.set(key, {
              name: apt.patientName,
              phone: apt.patientPhone,
              email: apt.patientEmail,
            });
          }
        }
      });

      // Get all family members
      const allFamilyMembers: FamilyMember[] = JSON.parse(
        localStorage.getItem("cliniccare:family-members") || "[]"
      );

      // Match patients with their family members
      const patientsWithFamily: PatientWithFamily[] = Array.from(uniquePatients.values()).map(
        (patient) => {
          // Find family members by matching name or phone
          const familyMembers = allFamilyMembers.filter(
            (member) =>
              member.name === patient.name ||
              member.phone === patient.phone ||
              member.parentId === patient.phone // Using phone as parentId reference
          );

          // Also find by parentId if patient has a user account
          const patientId = `patient_${patient.name}_${patient.phone}`;
          
          return {
            patientId,
            patientName: patient.name,
            patientPhone: patient.phone,
            patientEmail: patient.email,
            familyMembers: familyMembers,
          };
        }
      );

      setPatients(patientsWithFamily);
      setFilteredPatients(patientsWithFamily);
    } catch (error) {
      console.error("Error loading patients:", error);
      toast.error("Có lỗi xảy ra khi tải danh sách bệnh nhân");
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser?.id) {
      loadPatients();
      
      // Listen for updates
      window.addEventListener("familyMembersUpdated", loadPatients);
      return () => {
        window.removeEventListener("familyMembersUpdated", loadPatients);
      };
    }
  }, [currentUser?.id, loadPatients]);

  // Filter patients
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredPatients(patients);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = patients.filter(
      (p) =>
        p.patientName.toLowerCase().includes(query) ||
        p.patientPhone.includes(query) ||
        p.familyMembers.some((m) => m.name.toLowerCase().includes(query))
    );
    setFilteredPatients(filtered);
  }, [searchQuery, patients]);

  // Get family health history
  const getFamilyHealthHistory = (familyMembers: FamilyMember[]) => {
    const history: {
      member: FamilyMember;
      records: PersonalHealthRecord[];
      vaccinations: VaccinationRecord[];
      medications: MedicationRecord[];
      appointments: Appointment[];
    }[] = [];

    familyMembers.forEach((member) => {
      const records = getHealthRecords(member.id);
      const vaccinations = getVaccinationRecords(member.id);
      const medications = getMedicationRecords(member.id);
      const appointments = getAppointmentsForFamilyMember(member.name, member.phone);

      history.push({
        member,
        records,
        vaccinations,
        medications,
        appointments,
      });
    });

    return history;
  };

  // Handle bulk appointment booking
  const handleBulkAppointment = () => {
    if (!currentUser || !selectedPatient) return;

    if (!bulkAppointmentForm.date || !bulkAppointmentForm.time || !bulkAppointmentForm.specialty) {
      toast.error("Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }

    if (bulkAppointmentForm.selectedMembers.length === 0) {
      toast.error("Vui lòng chọn ít nhất một thành viên");
      return;
    }

    try {
      const appointments: Appointment[] = JSON.parse(
        localStorage.getItem(APPOINTMENTS_STORAGE_KEY) || "[]"
      );
      const newAppointments: Appointment[] = [];

      bulkAppointmentForm.selectedMembers.forEach((memberId) => {
        const member = selectedPatient.familyMembers.find((m) => m.id === memberId);
        if (!member) return;

        const nextId = `A${String(appointments.length + newAppointments.length + 1).padStart(3, "0")}`;
        const newAppointment: Appointment = {
          id: nextId,
          patientName: member.name,
          patientPhone: member.phone || selectedPatient.patientPhone,
          patientEmail: member.email || selectedPatient.patientEmail,
          doctorId: currentUser.id,
          doctorName: currentUser.name || "Bác sĩ",
          specialty: bulkAppointmentForm.specialty,
          date: bulkAppointmentForm.date,
          time: bulkAppointmentForm.time,
          notes: bulkAppointmentForm.notes || undefined,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        newAppointments.push(newAppointment);
      });

      const updatedAppointments = [...appointments, ...newAppointments];
      localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify(updatedAppointments));

      toast.success(`Đã đặt lịch cho ${newAppointments.length} thành viên`);
      setShowBulkAppointmentDialog(false);
      setBulkAppointmentForm({
        date: "",
        time: "",
        specialty: "",
        notes: "",
        selectedMembers: [],
      });
      loadPatients();
    } catch (error) {
      console.error("Error creating bulk appointments:", error);
      toast.error("Có lỗi xảy ra khi đặt lịch");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <DoctorLayout>
        <div className="space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-[#E5E7EB]">
                <CardContent className="p-6">
                  <div className="h-32 bg-gray-200 rounded animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Quản lý Bệnh nhân Gia đình</h1>
            <p className="text-[#687280] mt-1">
              Xem và quản lý hồ sơ sức khỏe của bệnh nhân và gia đình
            </p>
          </div>
        </div>

        {/* Search */}
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#687280]" />
              <Input
                placeholder="Tìm kiếm bệnh nhân hoặc thành viên gia đình..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Patients List */}
        {filteredPatients.length === 0 ? (
          <Card className="border-[#E5E7EB]">
            <CardContent className="p-12 text-center">
              <Users className="h-16 w-16 text-[#687280] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery ? "Không tìm thấy bệnh nhân" : "Chưa có bệnh nhân"}
              </h3>
              <p className="text-[#687280]">
                {searchQuery
                  ? "Thử tìm kiếm với từ khóa khác"
                  : "Bệnh nhân sẽ xuất hiện sau khi có lịch hẹn"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPatients.map((patient) => {
              const totalMembers = patient.familyMembers.length + 1; // +1 for the patient themselves
              const healthHistory = getFamilyHealthHistory(patient.familyMembers);

              return (
                <Card
                  key={patient.patientId}
                  className="border-[#E5E7EB] hover:shadow-lg transition-shadow"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-[#007BFF] text-white">
                            {patient.patientName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-lg">{patient.patientName}</CardTitle>
                          <CardDescription className="mt-1">
                            {patient.patientPhone}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline">{totalMembers} thành viên</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Family Members Preview */}
                    {patient.familyMembers.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold text-[#687280] mb-2 uppercase">
                          Thành viên gia đình
                        </p>
                        <div className="space-y-2">
                          {patient.familyMembers.slice(0, 3).map((member) => {
                            const age = getAge(member.dateOfBirth);
                            return (
                              <div
                                key={member.id}
                                className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded"
                              >
                                <User className="h-4 w-4 text-[#687280]" />
                                <span className="text-gray-900">{member.name}</span>
                                <span className="text-[#687280]">
                                  ({member.relationship} • {age} tuổi)
                                </span>
                              </div>
                            );
                          })}
                          {patient.familyMembers.length > 3 && (
                            <p className="text-xs text-[#687280] text-center">
                              +{patient.familyMembers.length - 3} thành viên khác
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-[#687280]">
                        Chưa có thông tin gia đình
                      </div>
                    )}

                    {/* Quick Stats */}
                    <div className="pt-3 border-t border-[#E5E7EB]">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-[#687280]">Hồ sơ y tế</p>
                          <p className="font-semibold text-gray-900">
                            {healthHistory.reduce((sum, h) => sum + h.records.length, 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[#687280]">Đơn thuốc</p>
                          <p className="font-semibold text-gray-900">
                            {healthHistory.reduce((sum, h) => sum + h.medications.length, 0)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-[#E5E7EB] space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setSelectedPatient(patient);
                          setShowFamilyDetailDialog(true);
                        }}
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Xem hồ sơ gia đình
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setSelectedPatient(patient);
                          setShowHistoryDialog(true);
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Lịch sử bệnh lý
                      </Button>
                      {patient.familyMembers.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setSelectedPatient(patient);
                            setBulkAppointmentForm({
                              ...bulkAppointmentForm,
                              selectedMembers: [],
                            });
                            setShowBulkAppointmentDialog(true);
                          }}
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          Đặt lịch cho gia đình
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setSelectedPatient(patient);
                          setShowHealthDashboardDialog(true);
                        }}
                      >
                        <Activity className="h-4 w-4 mr-2" />
                        Dashboard sức khỏe
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Family Detail Dialog */}
        <Dialog open={showFamilyDetailDialog} onOpenChange={setShowFamilyDetailDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Hồ sơ gia đình - {selectedPatient?.patientName}</DialogTitle>
              <DialogDescription>
                Xem thông tin chi tiết của tất cả thành viên trong gia đình
              </DialogDescription>
            </DialogHeader>
            {selectedPatient && (
              <div className="space-y-4">
                {/* Patient Info */}
                <Card className="border-[#E5E7EB]">
                  <CardHeader>
                    <CardTitle className="text-base">Bệnh nhân chính</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-[#687280]">Họ tên</p>
                        <p className="font-medium">{selectedPatient.patientName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-[#687280]">Số điện thoại</p>
                        <p className="font-medium">{selectedPatient.patientPhone}</p>
                      </div>
                      {selectedPatient.patientEmail && (
                        <div>
                          <p className="text-sm text-[#687280]">Email</p>
                          <p className="font-medium">{selectedPatient.patientEmail}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Family Members */}
                {selectedPatient.familyMembers.length > 0 ? (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Thành viên gia đình</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedPatient.familyMembers.map((member) => {
                        const age = getAge(member.dateOfBirth);
                        const records = getHealthRecords(member.id);
                        const activeMeds = getActiveMedications(member.id);
                        const upcomingVacs = getVaccinationRecords(member.id).filter(
                          (v) => v.doseNumber < v.totalDoses
                        );

                        return (
                          <Card key={member.id} className="border-[#E5E7EB]">
                            <CardHeader>
                              <CardTitle className="text-base">{member.name}</CardTitle>
                              <CardDescription>
                                {member.relationship} • {age} tuổi
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {member.bloodType && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Heart className="h-4 w-4 text-red-600" />
                                  <span>Nhóm máu: {member.bloodType}</span>
                                </div>
                              )}
                              {member.allergies && member.allergies.length > 0 && (
                                <div>
                                  <p className="text-xs text-[#687280] mb-1">Dị ứng:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {member.allergies.map((allergy, idx) => (
                                      <Badge key={idx} variant="destructive" className="text-xs">
                                        {allergy}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {member.chronicConditions && member.chronicConditions.length > 0 && (
                                <div>
                                  <p className="text-xs text-[#687280] mb-1">Bệnh nền:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {member.chronicConditions.map((condition, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        {condition}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="pt-2 border-t text-xs space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-[#687280]">Hồ sơ:</span>
                                  <span className="font-medium">{records.length}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-[#687280]">Thuốc đang dùng:</span>
                                  <span className="font-medium">{activeMeds.length}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-[#687280]">Mũi tiêm sắp tới:</span>
                                  <span className="font-medium">{upcomingVacs.length}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <Card className="border-[#E5E7EB]">
                    <CardContent className="p-8 text-center">
                      <Users className="h-12 w-12 text-[#687280] mx-auto mb-2" />
                      <p className="text-[#687280]">Chưa có thông tin thành viên gia đình</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowFamilyDetailDialog(false)}>
                Đóng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Family History Dialog */}
        <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Lịch sử bệnh lý gia đình - {selectedPatient?.patientName}</DialogTitle>
              <DialogDescription>
                Xem tiền sử bệnh lý của tất cả thành viên trong gia đình
              </DialogDescription>
            </DialogHeader>
            {selectedPatient && (
              <Tabs defaultValue="records" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="records">Hồ sơ y tế</TabsTrigger>
                  <TabsTrigger value="medications">Đơn thuốc</TabsTrigger>
                  <TabsTrigger value="vaccinations">Tiêm chủng</TabsTrigger>
                  <TabsTrigger value="appointments">Lịch khám</TabsTrigger>
                </TabsList>

                <TabsContent value="records" className="space-y-4">
                  {selectedPatient.familyMembers.map((member) => {
                    const records = getHealthRecords(member.id);
                    if (records.length === 0) return null;

                    return (
                      <Card key={member.id} className="border-[#E5E7EB]">
                        <CardHeader>
                          <CardTitle className="text-base">{member.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {records.map((record) => (
                              <div key={record.id} className="p-3 border rounded-lg">
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <p className="font-medium">{record.title}</p>
                                    <p className="text-sm text-[#687280]">
                                      {formatDate(record.recordDate)} • {record.type}
                                    </p>
                                  </div>
                                  <Badge variant="outline">{record.type}</Badge>
                                </div>
                                {record.description && (
                                  <p className="text-sm text-[#687280]">{record.description}</p>
                                )}
                                {record.doctorName && (
                                  <p className="text-sm mt-2">
                                    <span className="font-medium">Bác sĩ:</span> {record.doctorName}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </TabsContent>

                <TabsContent value="medications" className="space-y-4">
                  {selectedPatient.familyMembers.map((member) => {
                    const medications = getMedicationRecords(member.id);
                    if (medications.length === 0) return null;

                    return (
                      <Card key={member.id} className="border-[#E5E7EB]">
                        <CardHeader>
                          <CardTitle className="text-base">{member.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {medications.map((med) => (
                              <div key={med.id} className="p-3 border rounded-lg">
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <p className="font-medium">{med.medicationName}</p>
                                    <p className="text-sm text-[#687280]">
                                      {formatDate(med.startDate)} • {med.dosage} • {med.frequency}
                                    </p>
                                  </div>
                                  <Badge variant={med.isActive ? "default" : "outline"}>
                                    {med.isActive ? "Đang dùng" : "Đã kết thúc"}
                                  </Badge>
                                </div>
                                {med.prescribedBy && (
                                  <p className="text-sm text-[#687280]">
                                    <span className="font-medium">Kê bởi:</span> {med.prescribedBy}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </TabsContent>

                <TabsContent value="vaccinations" className="space-y-4">
                  {selectedPatient.familyMembers.map((member) => {
                    const vaccinations = getVaccinationRecords(member.id);
                    if (vaccinations.length === 0) return null;

                    return (
                      <Card key={member.id} className="border-[#E5E7EB]">
                        <CardHeader>
                          <CardTitle className="text-base">{member.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {vaccinations.map((vac) => (
                              <div key={vac.id} className="p-3 border rounded-lg">
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <p className="font-medium">{vac.vaccineName}</p>
                                    <p className="text-sm text-[#687280]">
                                      {formatDate(vac.vaccinationDate)} • Mũi {vac.doseNumber}/{vac.totalDoses}
                                    </p>
                                  </div>
                                  <Badge variant="outline">{vac.vaccineType}</Badge>
                                </div>
                                {vac.hospitalName && (
                                  <p className="text-sm text-[#687280]">
                                    <span className="font-medium">Nơi tiêm:</span> {vac.hospitalName}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </TabsContent>

                <TabsContent value="appointments" className="space-y-4">
                  {selectedPatient.familyMembers.map((member) => {
                    const appointments = getAppointmentsForFamilyMember(member.name, member.phone);
                    if (appointments.length === 0) return null;

                    return (
                      <Card key={member.id} className="border-[#E5E7EB]">
                        <CardHeader>
                          <CardTitle className="text-base">{member.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {appointments.map((apt) => (
                              <div key={apt.id} className="p-3 border rounded-lg">
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <p className="font-medium">{apt.specialty || "Khám tổng quát"}</p>
                                    <p className="text-sm text-[#687280]">
                                      {formatDate(apt.date)} lúc {apt.time}
                                    </p>
                                  </div>
                                  <Badge
                                    variant={
                                      apt.status === "completed"
                                        ? "default"
                                        : apt.status === "confirmed"
                                        ? "outline"
                                        : "secondary"
                                    }
                                  >
                                    {apt.status === "completed"
                                      ? "Hoàn thành"
                                      : apt.status === "confirmed"
                                      ? "Đã xác nhận"
                                      : apt.status === "pending"
                                      ? "Chờ xác nhận"
                                      : "Đã hủy"}
                                  </Badge>
                                </div>
                                {apt.doctorName && (
                                  <p className="text-sm text-[#687280]">
                                    <span className="font-medium">Bác sĩ:</span> {apt.doctorName}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </TabsContent>
              </Tabs>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowHistoryDialog(false)}>
                Đóng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Appointment Dialog */}
        <Dialog open={showBulkAppointmentDialog} onOpenChange={setShowBulkAppointmentDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Đặt lịch cho nhiều thành viên</DialogTitle>
              <DialogDescription>
                Đặt lịch khám cho nhiều thành viên trong gia đình {selectedPatient?.patientName} cùng một lúc
              </DialogDescription>
            </DialogHeader>
            {selectedPatient && (
              <div className="space-y-4">
                <div>
                  <Label>Chọn thành viên *</Label>
                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                    {selectedPatient.familyMembers.map((member) => {
                      const age = getAge(member.dateOfBirth);
                      return (
                        <div key={member.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={member.id}
                            checked={bulkAppointmentForm.selectedMembers.includes(member.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setBulkAppointmentForm({
                                  ...bulkAppointmentForm,
                                  selectedMembers: [...bulkAppointmentForm.selectedMembers, member.id],
                                });
                              } else {
                                setBulkAppointmentForm({
                                  ...bulkAppointmentForm,
                                  selectedMembers: bulkAppointmentForm.selectedMembers.filter(
                                    (id) => id !== member.id
                                  ),
                                });
                              }
                            }}
                          />
                          <Label
                            htmlFor={member.id}
                            className="flex-1 cursor-pointer"
                          >
                            {member.name} ({member.relationship} • {age} tuổi)
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="bulkDate">Ngày khám *</Label>
                    <Input
                      id="bulkDate"
                      type="date"
                      value={bulkAppointmentForm.date}
                      onChange={(e) =>
                        setBulkAppointmentForm({ ...bulkAppointmentForm, date: e.target.value })
                      }
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bulkTime">Giờ khám *</Label>
                    <Input
                      id="bulkTime"
                      type="time"
                      value={bulkAppointmentForm.time}
                      onChange={(e) =>
                        setBulkAppointmentForm({ ...bulkAppointmentForm, time: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="bulkSpecialty">Chuyên khoa *</Label>
                  <Select
                    value={bulkAppointmentForm.specialty}
                    onValueChange={(value) =>
                      setBulkAppointmentForm({ ...bulkAppointmentForm, specialty: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn chuyên khoa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Nội khoa">Nội khoa</SelectItem>
                      <SelectItem value="Ngoại khoa">Ngoại khoa</SelectItem>
                      <SelectItem value="Nhi khoa">Nhi khoa</SelectItem>
                      <SelectItem value="Sản phụ khoa">Sản phụ khoa</SelectItem>
                      <SelectItem value="Tim mạch">Tim mạch</SelectItem>
                      <SelectItem value="Thần kinh">Thần kinh</SelectItem>
                      <SelectItem value="Da liễu">Da liễu</SelectItem>
                      <SelectItem value="Mắt">Mắt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="bulkNotes">Ghi chú</Label>
                  <Textarea
                    id="bulkNotes"
                    value={bulkAppointmentForm.notes}
                    onChange={(e) =>
                      setBulkAppointmentForm({ ...bulkAppointmentForm, notes: e.target.value })
                    }
                    placeholder="Ghi chú cho lịch hẹn..."
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkAppointmentDialog(false)}>
                Hủy
              </Button>
              <Button onClick={handleBulkAppointment} className="bg-[#007BFF] hover:bg-[#0056B3]">
                Đặt lịch ({bulkAppointmentForm.selectedMembers.length} thành viên)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Health Dashboard Dialog */}
        <Dialog open={showHealthDashboardDialog} onOpenChange={setShowHealthDashboardDialog}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Dashboard Sức khỏe Gia đình - {selectedPatient?.patientName}</DialogTitle>
              <DialogDescription>
                Tổng quan tình trạng sức khỏe của tất cả thành viên
              </DialogDescription>
            </DialogHeader>
            {selectedPatient && (
              <div className="space-y-6">
                {/* Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="border-[#E5E7EB]">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-[#687280]">Tổng thành viên</p>
                          <p className="text-2xl font-bold">
                            {selectedPatient.familyMembers.length + 1}
                          </p>
                        </div>
                        <Users className="h-8 w-8 text-blue-600" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-[#E5E7EB]">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-[#687280]">Hồ sơ y tế</p>
                          <p className="text-2xl font-bold">
                            {selectedPatient.familyMembers.reduce(
                              (sum, m) => sum + getHealthRecords(m.id).length,
                              0
                            )}
                          </p>
                        </div>
                        <FileText className="h-8 w-8 text-green-600" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-[#E5E7EB]">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-[#687280]">Thuốc đang dùng</p>
                          <p className="text-2xl font-bold">
                            {selectedPatient.familyMembers.reduce(
                              (sum, m) => sum + getActiveMedications(m.id).length,
                              0
                            )}
                          </p>
                        </div>
                        <Pill className="h-8 w-8 text-orange-600" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-[#E5E7EB]">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-[#687280]">Mũi tiêm sắp tới</p>
                          <p className="text-2xl font-bold">
                            {selectedPatient.familyMembers.reduce(
                              (sum, m) =>
                                sum +
                                getVaccinationRecords(m.id).filter(
                                  (v) => v.doseNumber < v.totalDoses
                                ).length,
                              0
                            )}
                          </p>
                        </div>
                        <Syringe className="h-8 w-8 text-purple-600" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Health Status by Member */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Tình trạng sức khỏe từng thành viên</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedPatient.familyMembers.map((member) => {
                      const age = getAge(member.dateOfBirth);
                      const records = getHealthRecords(member.id);
                      const activeMeds = getActiveMedications(member.id);
                      const vaccinations = getVaccinationRecords(member.id);
                      const appointments = getAppointmentsForFamilyMember(member.name, member.phone);

                      let status = "healthy";
                      let statusText = "Khỏe mạnh";
                      if (member.chronicConditions && member.chronicConditions.length > 0) {
                        status = "monitoring";
                        statusText = "Cần theo dõi";
                      }
                      if (activeMeds.length > 0) {
                        status = "active";
                        statusText = "Đang điều trị";
                      }

                      return (
                        <Card key={member.id} className="border-[#E5E7EB]">
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="text-base">{member.name}</CardTitle>
                                <CardDescription>
                                  {member.relationship} • {age} tuổi
                                </CardDescription>
                              </div>
                              <Badge
                                variant={
                                  status === "healthy"
                                    ? "default"
                                    : status === "monitoring"
                                    ? "destructive"
                                    : "outline"
                                }
                              >
                                {statusText}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-[#687280]">Hồ sơ</p>
                                <p className="font-medium">{records.length}</p>
                              </div>
                              <div>
                                <p className="text-[#687280]">Lịch khám</p>
                                <p className="font-medium">{appointments.length}</p>
                              </div>
                              <div>
                                <p className="text-[#687280]">Thuốc</p>
                                <p className="font-medium">{activeMeds.length}</p>
                              </div>
                              <div>
                                <p className="text-[#687280]">Tiêm chủng</p>
                                <p className="font-medium">{vaccinations.length}</p>
                              </div>
                            </div>
                            {member.allergies && member.allergies.length > 0 && (
                              <div className="pt-2 border-t">
                                <p className="text-xs text-[#687280] mb-1">Dị ứng:</p>
                                <div className="flex flex-wrap gap-1">
                                  {member.allergies.slice(0, 3).map((allergy, idx) => (
                                    <Badge key={idx} variant="destructive" className="text-xs">
                                      {allergy}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {member.chronicConditions && member.chronicConditions.length > 0 && (
                              <div className="pt-2 border-t">
                                <p className="text-xs text-[#687280] mb-1">Bệnh nền:</p>
                                <div className="flex flex-wrap gap-1">
                                  {member.chronicConditions.slice(0, 3).map((condition, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {condition}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowHealthDashboardDialog(false)}>
                Đóng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DoctorLayout>
  );
};

export default FamilyPatients;

