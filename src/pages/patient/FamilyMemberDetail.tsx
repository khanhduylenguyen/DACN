import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PatientLayout from "@/components/layout/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Calendar,
  Heart,
  Activity,
  Pill,
  FileText,
  Syringe,
  AlertCircle,
  QrCode,
  Edit,
  Plus,
} from "lucide-react";
import { getFamilyMemberById, type FamilyMember } from "@/lib/family";
import {
  getHealthRecords,
  getVaccinationRecords,
  getUpcomingVaccinations,
  getMedicationRecords,
  getActiveMedications,
  getRecommendedVaccines,
  type PersonalHealthRecord,
  type VaccinationRecord,
  type MedicationRecord,
} from "@/lib/family-health";
import { getAge } from "@/lib/family";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  saveHealthRecord,
  saveVaccinationRecord,
  saveMedicationRecord,
} from "@/lib/family-health";

const FamilyMemberDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [member, setMember] = useState<FamilyMember | null>(null);
  const [healthRecords, setHealthRecords] = useState<PersonalHealthRecord[]>([]);
  const [vaccinations, setVaccinations] = useState<VaccinationRecord[]>([]);
  const [upcomingVaccinations, setUpcomingVaccinations] = useState<VaccinationRecord[]>([]);
  const [medications, setMedications] = useState<MedicationRecord[]>([]);
  const [activeMedications, setActiveMedications] = useState<MedicationRecord[]>([]);
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dialog states
  const [showAddRecordDialog, setShowAddRecordDialog] = useState(false);
  const [showAddVaccinationDialog, setShowAddVaccinationDialog] = useState(false);
  const [showAddMedicationDialog, setShowAddMedicationDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [recordForm, setRecordForm] = useState({
    type: "appointment" as PersonalHealthRecord["type"],
    title: "",
    description: "",
    recordDate: new Date().toISOString().split("T")[0],
    doctorName: "",
    hospitalName: "",
  });

  const [vaccinationForm, setVaccinationForm] = useState({
    vaccineName: "",
    vaccineType: "routine" as "routine" | "optional" | "travel" | "seasonal",
    doseNumber: 1,
    totalDoses: 1,
    vaccinationDate: new Date().toISOString().split("T")[0],
    nextDoseDate: "",
    hospitalName: "",
    doctorName: "",
    batchNumber: "",
    notes: "",
  });

  const [medicationForm, setMedicationForm] = useState({
    medicationName: "",
    dosage: "",
    frequency: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    prescribedBy: "",
    prescriptionDate: new Date().toISOString().split("T")[0],
    reminderTimes: [] as string[],
    notes: "",
  });

  useEffect(() => {
    if (!id) {
      navigate("/patient/family");
      return;
    }

    const loadData = () => {
      setIsLoading(true);
      const foundMember = getFamilyMemberById(id);
      
      if (!foundMember) {
        toast.error("Không tìm thấy thành viên gia đình");
        navigate("/patient/family");
        return;
      }

      setMember(foundMember);
      setHealthRecords(getHealthRecords(id));
      const vacRecords = getVaccinationRecords(id);
      setVaccinations(vacRecords);
      setUpcomingVaccinations(getUpcomingVaccinations(id));
      const medRecords = getMedicationRecords(id);
      setMedications(medRecords);
      setActiveMedications(getActiveMedications(id));
      setIsLoading(false);
    };

    loadData();
    
    // Listen for updates
    const handleUpdate = () => {
      if (id) {
        setHealthRecords(getHealthRecords(id));
        const vacRecords = getVaccinationRecords(id);
        setVaccinations(vacRecords);
        setUpcomingVaccinations(getUpcomingVaccinations(id));
        const medRecords = getMedicationRecords(id);
        setMedications(medRecords);
        setActiveMedications(getActiveMedications(id));
      }
    };
    
    window.addEventListener("familyMembersUpdated", handleUpdate);
    return () => {
      window.removeEventListener("familyMembersUpdated", handleUpdate);
    };
  }, [id, navigate]);

  // Reload data function
  const reloadData = () => {
    if (!id) return;
    setHealthRecords(getHealthRecords(id));
    const vacRecords = getVaccinationRecords(id);
    setVaccinations(vacRecords);
    setUpcomingVaccinations(getUpcomingVaccinations(id));
    const medRecords = getMedicationRecords(id);
    setMedications(medRecords);
    setActiveMedications(getActiveMedications(id));
  };

  if (isLoading) {
    return (
      <PatientLayout>
        <div className="space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64 animate-pulse" />
          <div className="h-64 bg-gray-200 rounded animate-pulse" />
        </div>
      </PatientLayout>
    );
  }

  if (!member) {
    return null;
  }

  const age = getAge(member.dateOfBirth);
  const recommendedVaccines = getRecommendedVaccines(age);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Handle add health record
  const handleAddRecord = () => {
    if (!id || !recordForm.title.trim() || !recordForm.recordDate) {
      toast.error("Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }

    setIsSubmitting(true);
    try {
      saveHealthRecord({
        familyMemberId: id,
        type: recordForm.type,
        title: recordForm.title.trim(),
        description: recordForm.description.trim() || undefined,
        recordDate: recordForm.recordDate,
        doctorName: recordForm.doctorName.trim() || undefined,
        hospitalName: recordForm.hospitalName.trim() || undefined,
      });
      
      toast.success("Đã thêm hồ sơ y tế");
      setShowAddRecordDialog(false);
      setRecordForm({
        type: "appointment",
        title: "",
        description: "",
        recordDate: new Date().toISOString().split("T")[0],
        doctorName: "",
        hospitalName: "",
      });
      reloadData();
    } catch (error) {
      console.error("Error adding health record:", error);
      toast.error("Có lỗi xảy ra khi thêm hồ sơ");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle add vaccination
  const handleAddVaccination = () => {
    if (!id || !vaccinationForm.vaccineName.trim() || !vaccinationForm.vaccinationDate) {
      toast.error("Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }

    if (vaccinationForm.doseNumber > vaccinationForm.totalDoses) {
      toast.error("Số mũi tiêm không được lớn hơn tổng số mũi");
      return;
    }

    setIsSubmitting(true);
    try {
      saveVaccinationRecord({
        familyMemberId: id,
        vaccineName: vaccinationForm.vaccineName.trim(),
        vaccineType: vaccinationForm.vaccineType,
        doseNumber: vaccinationForm.doseNumber,
        totalDoses: vaccinationForm.totalDoses,
        vaccinationDate: vaccinationForm.vaccinationDate,
        nextDoseDate: vaccinationForm.nextDoseDate || undefined,
        hospitalName: vaccinationForm.hospitalName.trim() || undefined,
        doctorName: vaccinationForm.doctorName.trim() || undefined,
        batchNumber: vaccinationForm.batchNumber.trim() || undefined,
        notes: vaccinationForm.notes.trim() || undefined,
      });
      
      toast.success("Đã thêm mũi tiêm");
      setShowAddVaccinationDialog(false);
      setVaccinationForm({
        vaccineName: "",
        vaccineType: "routine",
        doseNumber: 1,
        totalDoses: 1,
        vaccinationDate: new Date().toISOString().split("T")[0],
        nextDoseDate: "",
        hospitalName: "",
        doctorName: "",
        batchNumber: "",
        notes: "",
      });
      reloadData();
    } catch (error) {
      console.error("Error adding vaccination:", error);
      toast.error("Có lỗi xảy ra khi thêm mũi tiêm");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle add medication
  const handleAddMedication = () => {
    if (!id || !medicationForm.medicationName.trim() || !medicationForm.dosage.trim() || !medicationForm.frequency.trim() || !medicationForm.startDate) {
      toast.error("Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }

    if (medicationForm.endDate && medicationForm.endDate < medicationForm.startDate) {
      toast.error("Ngày kết thúc không được sớm hơn ngày bắt đầu");
      return;
    }

    setIsSubmitting(true);
    try {
      saveMedicationRecord({
        familyMemberId: id,
        medicationName: medicationForm.medicationName.trim(),
        dosage: medicationForm.dosage.trim(),
        frequency: medicationForm.frequency.trim(),
        startDate: medicationForm.startDate,
        endDate: medicationForm.endDate || undefined,
        prescribedBy: medicationForm.prescribedBy.trim() || undefined,
        prescriptionDate: medicationForm.prescriptionDate || undefined,
        reminderTimes: medicationForm.reminderTimes,
        isActive: !medicationForm.endDate || medicationForm.endDate >= new Date().toISOString().split("T")[0],
        notes: medicationForm.notes.trim() || undefined,
      });
      
      toast.success("Đã thêm đơn thuốc");
      setShowAddMedicationDialog(false);
      setMedicationForm({
        medicationName: "",
        dosage: "",
        frequency: "",
        startDate: new Date().toISOString().split("T")[0],
        endDate: "",
        prescribedBy: "",
        prescriptionDate: new Date().toISOString().split("T")[0],
        reminderTimes: [],
        notes: "",
      });
      reloadData();
    } catch (error) {
      console.error("Error adding medication:", error);
      toast.error("Có lỗi xảy ra khi thêm đơn thuốc");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PatientLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/patient/family")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Quay lại
            </Button>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={member.avatar} />
                <AvatarFallback>{member.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{member.name}</h1>
                <p className="text-[#687280]">
                  {member.relationship} • {age} tuổi
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowQrDialog(true)}
            >
              <QrCode className="h-4 w-4 mr-2" />
              Emergency Card
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/patient/family/${id}/edit`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Chỉnh sửa
            </Button>
          </div>
        </div>

        {/* Quick Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-[#E5E7EB]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Heart className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-[#687280]">Nhóm máu</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {member.bloodType || "Chưa có"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#E5E7EB]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-[#687280]">Dị ứng</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {member.allergies?.length || 0} mục
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#E5E7EB]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Activity className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-[#687280]">Bệnh nền</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {member.chronicConditions?.length || 0} mục
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#E5E7EB]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Pill className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-[#687280]">Thuốc đang dùng</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {activeMedications.length} loại
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            <TabsTrigger value="records">Hồ sơ y tế</TabsTrigger>
            <TabsTrigger value="vaccinations">Tiêm chủng</TabsTrigger>
            <TabsTrigger value="medications">Thuốc</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Personal Information */}
            <Card className="border-[#E5E7EB]">
              <CardHeader>
                <CardTitle>Thông tin cá nhân</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-[#687280]">Ngày sinh</p>
                    <p className="text-base font-medium">{formatDate(member.dateOfBirth)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-[#687280]">Giới tính</p>
                    <p className="text-base font-medium">
                      {member.gender === "male" ? "Nam" : member.gender === "female" ? "Nữ" : "Khác"}
                    </p>
                  </div>
                  {member.phone && (
                    <div>
                      <p className="text-sm text-[#687280]">Số điện thoại</p>
                      <p className="text-base font-medium">{member.phone}</p>
                    </div>
                  )}
                  {member.email && (
                    <div>
                      <p className="text-sm text-[#687280]">Email</p>
                      <p className="text-base font-medium">{member.email}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Allergies */}
            {member.allergies && member.allergies.length > 0 && (
              <Card className="border-[#E5E7EB]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    Dị ứng
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {member.allergies.map((allergy, index) => (
                      <Badge key={index} variant="destructive">
                        {allergy}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Chronic Conditions */}
            {member.chronicConditions && member.chronicConditions.length > 0 && (
              <Card className="border-[#E5E7EB]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-orange-600" />
                    Bệnh nền
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {member.chronicConditions.map((condition, index) => (
                      <Badge key={index} variant="outline" className="text-orange-700 border-orange-300">
                        {condition}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Emergency Contact */}
            {(member.emergencyContactName || member.emergencyContactPhone) && (
              <Card className="border-[#E5E7EB]">
                <CardHeader>
                  <CardTitle>Liên hệ khẩn cấp</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {member.emergencyContactName && (
                      <p className="text-base font-medium">{member.emergencyContactName}</p>
                    )}
                    {member.emergencyContactPhone && (
                      <p className="text-[#687280]">{member.emergencyContactPhone}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Health Records Tab */}
          <TabsContent value="records" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Hồ sơ y tế</h3>
              <Button size="sm" onClick={() => setShowAddRecordDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Thêm hồ sơ
              </Button>
            </div>
            {healthRecords.length === 0 ? (
              <Card className="border-[#E5E7EB]">
                <CardContent className="p-12 text-center">
                  <FileText className="h-16 w-16 text-[#687280] mx-auto mb-4" />
                  <p className="text-[#687280]">Chưa có hồ sơ y tế</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {healthRecords.map((record) => (
                  <Card key={record.id} className="border-[#E5E7EB]">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{record.title}</CardTitle>
                          <CardDescription>
                            {formatDate(record.recordDate)} • {record.type}
                          </CardDescription>
                        </div>
                        <Badge variant="outline">{record.type}</Badge>
                      </div>
                    </CardHeader>
                    {record.description && (
                      <CardContent>
                        <p className="text-sm text-[#687280]">{record.description}</p>
                        {record.doctorName && (
                          <p className="text-sm mt-2">
                            <span className="font-medium">Bác sĩ:</span> {record.doctorName}
                          </p>
                        )}
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Vaccinations Tab */}
          <TabsContent value="vaccinations" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Lịch sử tiêm chủng</h3>
              <Button size="sm" onClick={() => setShowAddVaccinationDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Thêm mũi tiêm
              </Button>
            </div>

            {/* Upcoming Vaccinations */}
            {upcomingVaccinations.length > 0 && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    Mũi tiêm sắp tới
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {upcomingVaccinations.map((vac) => (
                      <div key={vac.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <div>
                          <p className="font-medium">{vac.vaccineName}</p>
                          <p className="text-sm text-[#687280]">
                            Mũi {vac.doseNumber + 1}/{vac.totalDoses}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-blue-700 border-blue-300">
                          {formatDate(vac.nextDoseDate!)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Vaccination History */}
            {vaccinations.length === 0 ? (
              <Card className="border-[#E5E7EB]">
                <CardContent className="p-12 text-center">
                  <Syringe className="h-16 w-16 text-[#687280] mx-auto mb-4" />
                  <p className="text-[#687280]">Chưa có lịch sử tiêm chủng</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {vaccinations.map((vac) => (
                  <Card key={vac.id} className="border-[#E5E7EB]">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{vac.vaccineName}</CardTitle>
                          <CardDescription>
                            {formatDate(vac.vaccinationDate)} • Mũi {vac.doseNumber}/{vac.totalDoses}
                          </CardDescription>
                        </div>
                        <Badge variant="outline">{vac.vaccineType}</Badge>
                      </div>
                    </CardHeader>
                    {vac.hospitalName && (
                      <CardContent>
                        <p className="text-sm text-[#687280]">
                          <span className="font-medium">Nơi tiêm:</span> {vac.hospitalName}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {/* Recommended Vaccines */}
            {recommendedVaccines.length > 0 && (
              <Card className="border-[#E5E7EB]">
                <CardHeader>
                  <CardTitle className="text-base">Vắc xin được khuyến nghị</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recommendedVaccines.map((vac, index) => (
                      <div key={index} className="flex items-start justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{vac.name}</p>
                          <p className="text-sm text-[#687280]">{vac.description}</p>
                          <p className="text-xs text-[#687280] mt-1">Độ tuổi: {vac.recommendedAge}</p>
                        </div>
                        <Badge variant="outline">{vac.type}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Medications Tab */}
          <TabsContent value="medications" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Đơn thuốc</h3>
              <Button size="sm" onClick={() => setShowAddMedicationDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Thêm thuốc
              </Button>
            </div>

            {/* Active Medications */}
            {activeMedications.length > 0 && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Pill className="h-5 w-5 text-green-600" />
                    Thuốc đang dùng
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {activeMedications.map((med) => (
                      <div key={med.id} className="p-3 bg-white rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{med.medicationName}</p>
                            <p className="text-sm text-[#687280]">
                              {med.dosage} • {med.frequency}
                            </p>
                            {med.reminderTimes && med.reminderTimes.length > 0 && (
                              <p className="text-xs text-[#687280] mt-1">
                                Nhắc nhở: {med.reminderTimes.join(", ")}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-green-700 border-green-300">
                            Đang dùng
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All Medications */}
            {medications.length === 0 ? (
              <Card className="border-[#E5E7EB]">
                <CardContent className="p-12 text-center">
                  <Pill className="h-16 w-16 text-[#687280] mx-auto mb-4" />
                  <p className="text-[#687280]">Chưa có đơn thuốc</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {medications.map((med) => (
                  <Card key={med.id} className="border-[#E5E7EB]">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{med.medicationName}</CardTitle>
                          <CardDescription>
                            {formatDate(med.startDate)} • {med.dosage} • {med.frequency}
                          </CardDescription>
                        </div>
                        <Badge variant={med.isActive ? "default" : "outline"}>
                          {med.isActive ? "Đang dùng" : "Đã kết thúc"}
                        </Badge>
                      </div>
                    </CardHeader>
                    {med.prescribedBy && (
                      <CardContent>
                        <p className="text-sm text-[#687280]">
                          <span className="font-medium">Kê bởi:</span> {med.prescribedBy}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Add Health Record Dialog */}
        <Dialog open={showAddRecordDialog} onOpenChange={setShowAddRecordDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Thêm hồ sơ y tế</DialogTitle>
              <DialogDescription>
                Thêm thông tin hồ sơ y tế cho {member.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="recordType">Loại hồ sơ *</Label>
                <Select
                  value={recordForm.type}
                  onValueChange={(value: PersonalHealthRecord["type"]) =>
                    setRecordForm({ ...recordForm, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="appointment">Lịch khám</SelectItem>
                    <SelectItem value="prescription">Đơn thuốc</SelectItem>
                    <SelectItem value="lab_result">Kết quả xét nghiệm</SelectItem>
                    <SelectItem value="diagnosis">Chẩn đoán</SelectItem>
                    <SelectItem value="vaccination">Tiêm chủng</SelectItem>
                    <SelectItem value="health_metric">Chỉ số sức khỏe</SelectItem>
                    <SelectItem value="other">Khác</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="recordTitle">Tiêu đề *</Label>
                <Input
                  id="recordTitle"
                  value={recordForm.title}
                  onChange={(e) => setRecordForm({ ...recordForm, title: e.target.value })}
                  placeholder="Nhập tiêu đề hồ sơ"
                />
              </div>
              <div>
                <Label htmlFor="recordDate">Ngày *</Label>
                <Input
                  id="recordDate"
                  type="date"
                  value={recordForm.recordDate}
                  onChange={(e) => setRecordForm({ ...recordForm, recordDate: e.target.value })}
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div>
                <Label htmlFor="recordDescription">Mô tả</Label>
                <Textarea
                  id="recordDescription"
                  value={recordForm.description}
                  onChange={(e) => setRecordForm({ ...recordForm, description: e.target.value })}
                  placeholder="Nhập mô tả chi tiết..."
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="doctorName">Bác sĩ</Label>
                  <Input
                    id="doctorName"
                    value={recordForm.doctorName}
                    onChange={(e) => setRecordForm({ ...recordForm, doctorName: e.target.value })}
                    placeholder="Tên bác sĩ"
                  />
                </div>
                <div>
                  <Label htmlFor="hospitalName">Bệnh viện/Phòng khám</Label>
                  <Input
                    id="hospitalName"
                    value={recordForm.hospitalName}
                    onChange={(e) => setRecordForm({ ...recordForm, hospitalName: e.target.value })}
                    placeholder="Tên bệnh viện/phòng khám"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddRecordDialog(false)}>
                Hủy
              </Button>
              <Button onClick={handleAddRecord} disabled={isSubmitting} className="bg-[#007BFF] hover:bg-[#0056B3]">
                {isSubmitting ? "Đang lưu..." : "Thêm hồ sơ"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Vaccination Dialog */}
        <Dialog open={showAddVaccinationDialog} onOpenChange={setShowAddVaccinationDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Thêm mũi tiêm</DialogTitle>
              <DialogDescription>
                Thêm thông tin mũi tiêm cho {member.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vaccineName">Tên vắc xin *</Label>
                  <Input
                    id="vaccineName"
                    value={vaccinationForm.vaccineName}
                    onChange={(e) => setVaccinationForm({ ...vaccinationForm, vaccineName: e.target.value })}
                    placeholder="VD: BCG, DPT, MMR..."
                  />
                </div>
                <div>
                  <Label htmlFor="vaccineType">Loại vắc xin *</Label>
                  <Select
                    value={vaccinationForm.vaccineType}
                    onValueChange={(value: "routine" | "optional" | "travel" | "seasonal") =>
                      setVaccinationForm({ ...vaccinationForm, vaccineType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="routine">Bắt buộc</SelectItem>
                      <SelectItem value="optional">Tùy chọn</SelectItem>
                      <SelectItem value="travel">Du lịch</SelectItem>
                      <SelectItem value="seasonal">Theo mùa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="doseNumber">Mũi thứ *</Label>
                  <Input
                    id="doseNumber"
                    type="number"
                    min="1"
                    value={vaccinationForm.doseNumber}
                    onChange={(e) => setVaccinationForm({ ...vaccinationForm, doseNumber: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <Label htmlFor="totalDoses">Tổng số mũi *</Label>
                  <Input
                    id="totalDoses"
                    type="number"
                    min="1"
                    value={vaccinationForm.totalDoses}
                    onChange={(e) => setVaccinationForm({ ...vaccinationForm, totalDoses: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <Label htmlFor="vaccinationDate">Ngày tiêm *</Label>
                  <Input
                    id="vaccinationDate"
                    type="date"
                    value={vaccinationForm.vaccinationDate}
                    onChange={(e) => setVaccinationForm({ ...vaccinationForm, vaccinationDate: e.target.value })}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="nextDoseDate">Ngày tiêm mũi tiếp theo</Label>
                <Input
                  id="nextDoseDate"
                  type="date"
                  value={vaccinationForm.nextDoseDate}
                  onChange={(e) => setVaccinationForm({ ...vaccinationForm, nextDoseDate: e.target.value })}
                  min={vaccinationForm.vaccinationDate}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vacHospitalName">Nơi tiêm</Label>
                  <Input
                    id="vacHospitalName"
                    value={vaccinationForm.hospitalName}
                    onChange={(e) => setVaccinationForm({ ...vaccinationForm, hospitalName: e.target.value })}
                    placeholder="Tên bệnh viện/phòng khám"
                  />
                </div>
                <div>
                  <Label htmlFor="vacDoctorName">Bác sĩ tiêm</Label>
                  <Input
                    id="vacDoctorName"
                    value={vaccinationForm.doctorName}
                    onChange={(e) => setVaccinationForm({ ...vaccinationForm, doctorName: e.target.value })}
                    placeholder="Tên bác sĩ"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="batchNumber">Số lô</Label>
                <Input
                  id="batchNumber"
                  value={vaccinationForm.batchNumber}
                  onChange={(e) => setVaccinationForm({ ...vaccinationForm, batchNumber: e.target.value })}
                  placeholder="Số lô vắc xin"
                />
              </div>
              <div>
                <Label htmlFor="vaccinationNotes">Ghi chú</Label>
                <Textarea
                  id="vaccinationNotes"
                  value={vaccinationForm.notes}
                  onChange={(e) => setVaccinationForm({ ...vaccinationForm, notes: e.target.value })}
                  placeholder="Ghi chú thêm..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddVaccinationDialog(false)}>
                Hủy
              </Button>
              <Button onClick={handleAddVaccination} disabled={isSubmitting} className="bg-[#007BFF] hover:bg-[#0056B3]">
                {isSubmitting ? "Đang lưu..." : "Thêm mũi tiêm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Medication Dialog */}
        <Dialog open={showAddMedicationDialog} onOpenChange={setShowAddMedicationDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Thêm đơn thuốc</DialogTitle>
              <DialogDescription>
                Thêm thông tin đơn thuốc cho {member.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="medicationName">Tên thuốc *</Label>
                <Input
                  id="medicationName"
                  value={medicationForm.medicationName}
                  onChange={(e) => setMedicationForm({ ...medicationForm, medicationName: e.target.value })}
                  placeholder="Tên thuốc"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dosage">Liều lượng *</Label>
                  <Input
                    id="dosage"
                    value={medicationForm.dosage}
                    onChange={(e) => setMedicationForm({ ...medicationForm, dosage: e.target.value })}
                    placeholder="VD: 500mg, 1 viên..."
                  />
                </div>
                <div>
                  <Label htmlFor="frequency">Tần suất *</Label>
                  <Input
                    id="frequency"
                    value={medicationForm.frequency}
                    onChange={(e) => setMedicationForm({ ...medicationForm, frequency: e.target.value })}
                    placeholder="VD: 2 lần/ngày, sau ăn..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Ngày bắt đầu *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={medicationForm.startDate}
                    onChange={(e) => setMedicationForm({ ...medicationForm, startDate: e.target.value })}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">Ngày kết thúc</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={medicationForm.endDate}
                    onChange={(e) => setMedicationForm({ ...medicationForm, endDate: e.target.value })}
                    min={medicationForm.startDate}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="prescribedBy">Kê bởi</Label>
                  <Input
                    id="prescribedBy"
                    value={medicationForm.prescribedBy}
                    onChange={(e) => setMedicationForm({ ...medicationForm, prescribedBy: e.target.value })}
                    placeholder="Tên bác sĩ"
                  />
                </div>
                <div>
                  <Label htmlFor="prescriptionDate">Ngày kê đơn</Label>
                  <Input
                    id="prescriptionDate"
                    type="date"
                    value={medicationForm.prescriptionDate}
                    onChange={(e) => setMedicationForm({ ...medicationForm, prescriptionDate: e.target.value })}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="reminderTimes">Giờ nhắc nhở (VD: 08:00, 20:00)</Label>
                <Input
                  id="reminderTimes"
                  value={medicationForm.reminderTimes.join(", ")}
                  onChange={(e) => {
                    const times = e.target.value.split(",").map(t => t.trim()).filter(t => t);
                    setMedicationForm({ ...medicationForm, reminderTimes: times });
                  }}
                  placeholder="08:00, 20:00"
                />
                <p className="text-xs text-[#687280] mt-1">Nhập các giờ cách nhau bởi dấu phẩy</p>
              </div>
              <div>
                <Label htmlFor="medicationNotes">Ghi chú</Label>
                <Textarea
                  id="medicationNotes"
                  value={medicationForm.notes}
                  onChange={(e) => setMedicationForm({ ...medicationForm, notes: e.target.value })}
                  placeholder="Ghi chú thêm về đơn thuốc..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddMedicationDialog(false)}>
                Hủy
              </Button>
              <Button onClick={handleAddMedication} disabled={isSubmitting} className="bg-[#007BFF] hover:bg-[#0056B3]">
                {isSubmitting ? "Đang lưu..." : "Thêm thuốc"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Emergency Card QR Dialog */}
        <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Emergency Card - {member.name}</DialogTitle>
              <DialogDescription>
                Quét mã QR này để xem thông tin cấp cứu
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 p-6">
              <div className="p-4 bg-white rounded-lg border-2 border-gray-200">
                <QRCodeSVG
                  value={JSON.stringify({
                    name: member.name,
                    bloodType: member.bloodType || "Chưa xác định",
                    allergies: member.allergies || [],
                    chronicConditions: member.chronicConditions || [],
                    emergencyContact: {
                      name: member.emergencyContactName || "Chưa có",
                      phone: member.emergencyContactPhone || "Chưa có",
                    },
                  })}
                  size={200}
                  level="H"
                />
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm font-medium">Thông tin trong QR code:</p>
                <ul className="text-xs text-[#687280] space-y-1 text-left">
                  <li>• Họ tên</li>
                  <li>• Nhóm máu</li>
                  <li>• Dị ứng</li>
                  <li>• Bệnh nền</li>
                  <li>• Liên hệ khẩn cấp</li>
                </ul>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PatientLayout>
  );
};

export default FamilyMemberDetail;

