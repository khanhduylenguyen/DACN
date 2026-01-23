import { useEffect, useState, useCallback } from "react";
import PatientLayout from "@/components/layout/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Users,
  Plus,
  Edit,
  Trash2,
  Calendar,
  Heart,
  Activity,
  Pill,
  User,
  Phone,
  Mail,
  Baby,
  UserCircle,
  ArrowRight,
  QrCode,
  Syringe,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, AUTH_EVENT } from "@/lib/auth";
import {
  getFamilyMembers,
  saveFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  getAge,
  getAppointmentsForFamilyMember,
  type FamilyMember,
} from "@/lib/family";
import { getLatestHealthMetric, getHealthMetrics } from "@/lib/health";
import { getUpcomingVaccinations, getActiveMedications } from "@/lib/family-health";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const Family = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getCurrentUser>>(getCurrentUser());
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    relationship: "",
    dateOfBirth: "",
    gender: "male" as "male" | "female" | "other",
    phone: "",
    email: "",
    notes: "",
  });

  // Load members
  const loadMembers = useCallback(() => {
    if (!currentUser?.id) {
      setMembers([]);
      return;
    }
    const allMembers = getFamilyMembers(currentUser.id);
    setMembers(allMembers);
  }, [currentUser?.id]);

  // Listen for auth changes
  useEffect(() => {
    const handleAuthChange = () => {
      setCurrentUser(getCurrentUser());
    };
    window.addEventListener(AUTH_EVENT, handleAuthChange);
    return () => {
      window.removeEventListener(AUTH_EVENT, handleAuthChange);
    };
  }, []);

  useEffect(() => {
    if (currentUser?.id) {
      setIsLoading(true);
      const timer = setTimeout(() => {
        loadMembers();
        setIsLoading(false);
      }, 300);

      // Listen for updates
      const handleUpdate = () => loadMembers();
      window.addEventListener("familyMembersUpdated", handleUpdate);

      return () => {
        clearTimeout(timer);
        window.removeEventListener("familyMembersUpdated", handleUpdate);
      };
    } else {
      setIsLoading(false);
    }
  }, [currentUser?.id, loadMembers]);

  // Get latest health metric for a member (by name matching)
  const getLatestHealthMetricForMember = (memberName: string) => {
    // Since health metrics are stored by patientId, we'll check if the current user
    // has any metrics that might be for this family member
    // In a real app, you'd link family members to user accounts or store metrics with familyMemberId
    if (!currentUser?.id) return null;
    
    // For now, return null - in production, you'd need a better linking mechanism
    return null;
  };

  // Get upcoming vaccinations for a member
  const getUpcomingVaccinationsForMember = (memberId: string) => {
    return getUpcomingVaccinations(memberId);
  };

  // Get active medications for a member
  const getActiveMedicationsForMember = (memberId: string) => {
    return getActiveMedications(memberId);
  };

  // Get next appointment for a member
  const getNextAppointment = (member: FamilyMember) => {
    const appointments = getAppointmentsForFamilyMember(member.name, member.phone);
    const upcoming = appointments
      .filter((apt) => {
        const aptDate = new Date(`${apt.date}T${apt.time}`);
        return aptDate > new Date() && apt.status !== "cancelled";
      })
      .sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`).getTime();
        const dateB = new Date(`${b.date}T${b.time}`).getTime();
        return dateA - dateB;
      });
    return upcoming[0] || null;
  };

  // Handle form submit
  const handleSubmit = async () => {
    if (!currentUser?.id) return;

    if (!formData.name.trim() || !formData.relationship || !formData.dateOfBirth) {
      toast.error("Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }

    setIsSubmitting(true);

    try {
      const memberData: Omit<FamilyMember, "id" | "createdAt" | "updatedAt"> = {
        parentId: currentUser.id,
        name: formData.name.trim(),
        relationship: formData.relationship,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      };

      if (editingMember) {
        updateFamilyMember(editingMember.id, memberData);
        toast.success("Đã cập nhật thông tin thành viên");
      } else {
        saveFamilyMember(memberData);
        toast.success("Đã thêm thành viên gia đình");
      }

      // Reset form
      setFormData({
        name: "",
        relationship: "",
        dateOfBirth: "",
        gender: "male",
        phone: "",
        email: "",
        notes: "",
      });
      setEditingMember(null);
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error saving family member:", error);
      toast.error("Có lỗi xảy ra khi lưu thông tin");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit
  const handleEdit = (member: FamilyMember) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      relationship: member.relationship,
      dateOfBirth: member.dateOfBirth.split("T")[0],
      gender: member.gender,
      phone: member.phone || "",
      email: member.email || "",
      notes: member.notes || "",
    });
    setIsDialogOpen(true);
  };

  // Handle delete
  const handleDelete = (id: string) => {
    if (deleteFamilyMember(id)) {
      toast.success("Đã xóa thành viên gia đình");
    } else {
      toast.error("Không thể xóa thành viên");
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Get relationship icon
  const getRelationshipIcon = (relationship: string) => {
    if (relationship.includes("Con")) return Baby;
    return UserCircle;
  };

  if (isLoading) {
    return (
      <PatientLayout>
        <div className="space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-[#E5E7EB]">
                <CardContent className="p-6">
                  <div className="h-32 bg-gray-200 rounded animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </PatientLayout>
    );
  }

  if (!currentUser) {
    return (
      <PatientLayout>
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-12 text-center">
            <Users className="h-16 w-16 text-[#687280] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Vui lòng đăng nhập
            </h3>
            <p className="text-[#687280]">
              Bạn cần đăng nhập để quản lý thành viên gia đình
            </p>
          </CardContent>
        </Card>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Quản lý Gia đình</h1>
            <p className="text-[#687280] mt-1">
              Quản lý hồ sơ sức khỏe của cả gia đình trong một tài khoản
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingMember(null);
              setFormData({
                name: "",
                relationship: "",
                dateOfBirth: "",
                gender: "male",
                phone: "",
                email: "",
                notes: "",
              });
              setIsDialogOpen(true);
            }}
            className="bg-[#007BFF] hover:bg-[#0056B3]"
          >
            <Plus className="h-4 w-4 mr-2" />
            Thêm thành viên
          </Button>
        </div>

        {/* Family Members Grid */}
        {members.length === 0 ? (
          <Card className="border-[#E5E7EB]">
            <CardContent className="p-12 text-center">
              <Users className="h-16 w-16 text-[#687280] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Chưa có thành viên gia đình
              </h3>
              <p className="text-[#687280] mb-4">
                Bắt đầu bằng cách thêm thành viên đầu tiên của gia đình
              </p>
              <Button
                onClick={() => setIsDialogOpen(true)}
                className="bg-[#007BFF] hover:bg-[#0056B3]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Thêm thành viên
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {members.map((member) => {
              const age = getAge(member.dateOfBirth);
              const nextAppointment = getNextAppointment(member);
              const RelationshipIcon = getRelationshipIcon(member.relationship);
              const upcomingVaccinations = getUpcomingVaccinationsForMember(member.id);
              const activeMedications = getActiveMedicationsForMember(member.id);

              return (
                <Card 
                  key={member.id} 
                  className="border-[#E5E7EB] hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(`/patient/family/${member.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback>
                            <RelationshipIcon className="h-6 w-6" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-lg">{member.name}</CardTitle>
                          <CardDescription className="mt-1">
                            {member.relationship} • {age} tuổi
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(member)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(member.id)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Contact Info */}
                    {(member.phone || member.email) && (
                      <div className="space-y-2 text-sm">
                        {member.phone && (
                          <div className="flex items-center gap-2 text-[#687280]">
                            <Phone className="h-4 w-4" />
                            <span>{member.phone}</span>
                          </div>
                        )}
                        {member.email && (
                          <div className="flex items-center gap-2 text-[#687280]">
                            <Mail className="h-4 w-4" />
                            <span>{member.email}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Health Status */}
                    <div className="pt-3 border-t border-[#E5E7EB]">
                      <p className="text-xs font-semibold text-[#687280] mb-2 uppercase">
                        Tình trạng sức khỏe
                      </p>
                      <div className="space-y-2">
                        {member.bloodType && (
                          <div className="flex items-center gap-2 text-sm">
                            <Heart className="h-4 w-4 text-red-600" />
                            <span className="text-gray-900">Nhóm máu: {member.bloodType}</span>
                          </div>
                        )}
                        {member.allergies && member.allergies.length > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <AlertCircle className="h-4 w-4 text-orange-600" />
                            <span className="text-gray-900">{member.allergies.length} dị ứng</span>
                          </div>
                        )}
                        {member.chronicConditions && member.chronicConditions.length > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <Activity className="h-4 w-4 text-orange-600" />
                            <span className="text-gray-900">{member.chronicConditions.length} bệnh nền</span>
                          </div>
                        )}
                        {!member.bloodType && (!member.allergies || member.allergies.length === 0) && (!member.chronicConditions || member.chronicConditions.length === 0) && (
                          <div className="flex items-center gap-2 text-sm text-[#687280]">
                            <Activity className="h-4 w-4" />
                            <span>Chưa có dữ liệu</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Next Appointment */}
                    {nextAppointment ? (
                      <div className="pt-3 border-t border-[#E5E7EB]">
                        <p className="text-xs font-semibold text-[#687280] mb-2 uppercase">
                          Lịch khám tiếp theo
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-[#007BFF]" />
                          <span className="text-gray-900">
                            {formatDate(nextAppointment.date)} lúc {nextAppointment.time}
                          </span>
                        </div>
                        <Badge variant="outline" className="mt-2 text-xs">
                          {nextAppointment.doctorName || "Bác sĩ"}
                        </Badge>
                      </div>
                    ) : (
                      <div className="pt-3 border-t border-[#E5E7EB]">
                        <p className="text-xs font-semibold text-[#687280] mb-2 uppercase">
                          Lịch khám tiếp theo
                        </p>
                        <div className="flex items-center gap-2 text-sm text-[#687280]">
                          <Calendar className="h-4 w-4" />
                          <span>Chưa có lịch hẹn</span>
                        </div>
                      </div>
                    )}

                    {/* Medication Reminders */}
                    <div className="pt-3 border-t border-[#E5E7EB]">
                      <p className="text-xs font-semibold text-[#687280] mb-2 uppercase">
                        Nhắc nhở
                      </p>
                      <div className="space-y-2">
                        {activeMedications.length > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <Pill className="h-4 w-4 text-green-600" />
                            <span className="text-gray-900">{activeMedications.length} thuốc đang dùng</span>
                          </div>
                        )}
                        {upcomingVaccinations.length > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <Syringe className="h-4 w-4 text-blue-600" />
                            <span className="text-gray-900">{upcomingVaccinations.length} mũi tiêm sắp tới</span>
                          </div>
                        )}
                        {activeMedications.length === 0 && upcomingVaccinations.length === 0 && (
                          <div className="flex items-center gap-2 text-sm text-[#687280]">
                            <Pill className="h-4 w-4" />
                            <span>Chưa có nhắc nhở</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* View Details Button */}
                    <div className="pt-3 border-t border-[#E5E7EB]">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/patient/family/${member.id}`);
                        }}
                      >
                        Xem chi tiết
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingMember ? "Chỉnh sửa thành viên" : "Thêm thành viên gia đình"}
              </DialogTitle>
              <DialogDescription>
                Thêm thông tin thành viên gia đình để quản lý hồ sơ sức khỏe
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Họ và tên *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nhập họ và tên"
                  />
                </div>
                <div>
                  <Label htmlFor="relationship">Mối quan hệ *</Label>
                  <Select
                    value={formData.relationship}
                    onValueChange={(value) =>
                      setFormData({ ...formData, relationship: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn mối quan hệ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bố">Bố</SelectItem>
                      <SelectItem value="Mẹ">Mẹ</SelectItem>
                      <SelectItem value="Con trai">Con trai</SelectItem>
                      <SelectItem value="Con gái">Con gái</SelectItem>
                      <SelectItem value="Ông">Ông</SelectItem>
                      <SelectItem value="Bà">Bà</SelectItem>
                      <SelectItem value="Khác">Khác</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dateOfBirth">Ngày sinh *</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) =>
                      setFormData({ ...formData, dateOfBirth: e.target.value })
                    }
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div>
                  <Label htmlFor="gender">Giới tính *</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value: "male" | "female" | "other") =>
                      setFormData({ ...formData, gender: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Nam</SelectItem>
                      <SelectItem value="female">Nữ</SelectItem>
                      <SelectItem value="other">Khác</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Số điện thoại</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Nhập số điện thoại"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Nhập email"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Ghi chú</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ghi chú thêm về thành viên..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Hủy
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-[#007BFF] hover:bg-[#0056B3]"
              >
                {isSubmitting
                  ? "Đang lưu..."
                  : editingMember
                  ? "Cập nhật"
                  : "Thêm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PatientLayout>
  );
};

export default Family;

