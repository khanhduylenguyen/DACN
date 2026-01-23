import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  Clock,
  Bell,
  FileText,
  Plus,
  Edit,
  Trash2,
  Search,
  Activity,
  StickyNote,
  History,
  AlertCircle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import {
  getFollowUpReminders,
  saveFollowUpReminder,
  deleteFollowUpReminder,
  getTreatmentProgress,
  saveTreatmentProgress,
  addProgressNote,
  getPatientNotes,
  savePatientNote,
  deletePatientNote,
  getPatientInteractions,
  getUpcomingReminders,
  createInteraction,
  type FollowUpReminder,
  type TreatmentProgress,
  type PatientNote,
  type PatientInteraction,
} from "@/lib/patient-followup";
import { toast } from "sonner";

const APPOINTMENTS_STORAGE_KEY = "cliniccare:appointments";
const PRESCRIPTIONS_STORAGE_KEY = "cliniccare:prescriptions";

interface Appointment {
  id: string;
  patientName: string;
  patientPhone: string;
  date: string;
  time: string;
  status: string;
}

interface Prescription {
  id: string;
  patientName: string;
  drugs: Array<{ name: string; dose: string }>;
}

const PatientFollowUp = () => {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [reminders, setReminders] = useState<FollowUpReminder[]>([]);
  const [treatmentProgress, setTreatmentProgress] = useState<TreatmentProgress[]>([]);
  const [patientNotes, setPatientNotes] = useState<PatientNote[]>([]);
  const [interactions, setInteractions] = useState<PatientInteraction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string>("");

  // Dialog states
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showInteractionsDialog, setShowInteractionsDialog] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<FollowUpReminder | null>(null);
  const [selectedProgress, setSelectedProgress] = useState<TreatmentProgress | null>(null);
  const [selectedNote, setSelectedNote] = useState<PatientNote | null>(null);

  // Form states
  const [reminderForm, setReminderForm] = useState<Partial<FollowUpReminder>>({
    patientName: "",
    reminderDate: "",
    followUpDate: "",
    reason: "",
    priority: "medium",
    notes: "",
  });
  const [progressForm, setProgressForm] = useState<Partial<TreatmentProgress>>({
    patientName: "",
    treatmentPlan: "",
    startDate: "",
    endDate: "",
    currentStatus: "ongoing",
  });
  const [noteForm, setNoteForm] = useState<Partial<PatientNote>>({
    patientName: "",
    note: "",
    category: "general",
    isPrivate: true,
    tags: [],
  });
  const [progressNoteText, setProgressNoteText] = useState("");

  // Get unique patients from appointments and prescriptions
  const [patientList, setPatientList] = useState<string[]>([]);

  const loadPatientList = useCallback(() => {
    try {
      const appointments: Appointment[] = JSON.parse(
        localStorage.getItem(APPOINTMENTS_STORAGE_KEY) || "[]"
      );
      const prescriptions: Prescription[] = JSON.parse(
        localStorage.getItem(PRESCRIPTIONS_STORAGE_KEY) || "[]"
      );

      const patients = new Set<string>();
      appointments.forEach((apt) => {
        if (apt.patientName) patients.add(apt.patientName);
      });
      prescriptions.forEach((pres) => {
        if (pres.patientName) patients.add(pres.patientName);
      });

      setPatientList(Array.from(patients).sort());
    } catch (error) {
      console.error("Error loading patient list:", error);
      setPatientList([]);
    }
  }, []);

  // Load data
  const loadData = useCallback(() => {
    if (!currentUser?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const allReminders = getFollowUpReminders(currentUser.id);
      setReminders(allReminders);

      if (selectedPatientId) {
        const progress = getTreatmentProgress(selectedPatientId, currentUser.id);
        setTreatmentProgress(progress);

        const notes = getPatientNotes(selectedPatientId, currentUser.id);
        setPatientNotes(notes);

        const interactions = getPatientInteractions(selectedPatientId, currentUser.id);
        setInteractions(interactions);
      } else {
        setTreatmentProgress([]);
        setPatientNotes([]);
        setInteractions([]);
      }
    } catch (error) {
      console.error("Error loading follow-up data:", error);
      toast.error("Có lỗi xảy ra khi tải dữ liệu");
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id, selectedPatientId]);

  // Load patient list
  useEffect(() => {
    loadPatientList();
  }, [loadPatientList]);

  // Load patient list
  useEffect(() => {
    loadPatientList();
  }, [loadPatientList]);

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };

    window.addEventListener("followUpRemindersUpdated", handleUpdate);
    window.addEventListener("treatmentProgressUpdated", handleUpdate);
    window.addEventListener("patientNotesUpdated", handleUpdate);
    window.addEventListener("patientInteractionsUpdated", handleUpdate);

    return () => {
      window.removeEventListener("followUpRemindersUpdated", handleUpdate);
      window.removeEventListener("treatmentProgressUpdated", handleUpdate);
      window.removeEventListener("patientNotesUpdated", handleUpdate);
      window.removeEventListener("patientInteractionsUpdated", handleUpdate);
    };
  }, [loadData]);

  // Filter reminders
  const filteredReminders = reminders.filter((r) => {
    if (!r.patientName || !r.reason) return false;
    return (
      r.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.reason.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Get upcoming reminders
  const upcomingReminders = currentUser?.id ? getUpcomingReminders(currentUser.id, 7) : [];

  // Handle create reminder
  const handleCreateReminder = () => {
    setSelectedReminder(null);
    setReminderForm({
      patientName: selectedPatientName || "",
      reminderDate: "",
      followUpDate: "",
      reason: "",
      priority: "medium",
      notes: "",
    });
    setShowReminderDialog(true);
  };

  // Handle save reminder
  const handleSaveReminder = () => {
    if (!currentUser?.id) return;

    if (!reminderForm.patientName || !reminderForm.followUpDate || !reminderForm.reason) {
      toast.error("Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }

    try {
      const reminder: FollowUpReminder = {
        id: selectedReminder?.id || `FOLLOWUP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        patientId: selectedPatientId || `PATIENT_${reminderForm.patientName}`,
        patientName: reminderForm.patientName,
        doctorId: currentUser.id,
        reminderDate: reminderForm.reminderDate || reminderForm.followUpDate,
        followUpDate: reminderForm.followUpDate,
        reason: reminderForm.reason,
        status: selectedReminder?.status || "pending",
        priority: reminderForm.priority || "medium",
        notes: reminderForm.notes,
        createdAt: selectedReminder?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      saveFollowUpReminder(reminder);
      
      // Create interaction if new reminder
      if (!selectedReminder) {
        createInteraction({
          patientId: reminder.patientId,
          patientName: reminder.patientName,
          doctorId: currentUser.id,
          type: "followup",
          title: `Nhắc tái khám - ${reminder.reason}`,
          description: `Tái khám ngày ${reminder.followUpDate}`,
          date: reminder.followUpDate,
          metadata: { reminderId: reminder.id, appointmentId: reminder.appointmentId },
        });
      }
      
      toast.success(selectedReminder ? "Cập nhật thành công" : "Tạo nhắc tái khám thành công");
      setShowReminderDialog(false);
      loadData();
    } catch (error) {
      console.error("Error saving reminder:", error);
      toast.error("Có lỗi xảy ra");
    }
  };

  // Handle delete reminder
  const handleDeleteReminder = (reminder: FollowUpReminder) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa nhắc tái khám này?`)) {
      return;
    }

    if (!currentUser?.id) return;

    try {
      deleteFollowUpReminder(reminder.id, currentUser.id);
      toast.success("Xóa thành công");
      loadData();
    } catch (error) {
      console.error("Error deleting reminder:", error);
      toast.error("Có lỗi xảy ra");
    }
  };

  // Handle create progress
  const handleCreateProgress = () => {
    setSelectedProgress(null);
    setProgressForm({
      patientName: selectedPatientName || "",
      treatmentPlan: "",
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
      currentStatus: "ongoing",
    });
    setShowProgressDialog(true);
  };

  // Handle save progress
  const handleSaveProgress = () => {
    if (!currentUser?.id) return;

    if (!progressForm.patientName || !progressForm.treatmentPlan || !progressForm.startDate) {
      toast.error("Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }

    try {
      const progress: TreatmentProgress = {
        id: selectedProgress?.id || `PROGRESS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        patientId: selectedPatientId || `PATIENT_${progressForm.patientName}`,
        patientName: progressForm.patientName,
        doctorId: currentUser.id,
        treatmentPlan: progressForm.treatmentPlan,
        startDate: progressForm.startDate,
        endDate: progressForm.endDate,
        currentStatus: progressForm.currentStatus || "ongoing",
        progressNotes: selectedProgress?.progressNotes || [],
        medications: selectedProgress?.medications || [],
        createdAt: selectedProgress?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      saveTreatmentProgress(progress);
      
      // Create interaction if new progress
      if (!selectedProgress) {
        createInteraction({
          patientId: progress.patientId,
          patientName: progress.patientName,
          doctorId: currentUser.id,
          type: "ehr",
          title: `Tracking điều trị - ${progress.treatmentPlan.substring(0, 50)}${progress.treatmentPlan.length > 50 ? "..." : ""}`,
          description: `Bắt đầu điều trị ngày ${progress.startDate}`,
          date: progress.startDate,
          metadata: { progressId: progress.id },
        });
      }
      
      toast.success(selectedProgress ? "Cập nhật thành công" : "Tạo tracking điều trị thành công");
      setShowProgressDialog(false);
      loadData();
    } catch (error) {
      console.error("Error saving progress:", error);
      toast.error("Có lỗi xảy ra");
    }
  };

  // Handle add progress note
  const handleAddProgressNote = (progressId: string) => {
    if (!progressNoteText.trim()) {
      toast.error("Vui lòng nhập ghi chú");
      return;
    }

    try {
      addProgressNote(progressId, progressNoteText);
      toast.success("Đã thêm ghi chú tiến độ");
      setProgressNoteText("");
      loadData();
    } catch (error) {
      console.error("Error adding progress note:", error);
      toast.error("Có lỗi xảy ra");
    }
  };

  // Handle create note
  const handleCreateNote = () => {
    setSelectedNote(null);
    setNoteForm({
      patientName: selectedPatientName || "",
      note: "",
      category: "general",
      isPrivate: true,
      tags: [],
    });
    setShowNoteDialog(true);
  };

  // Handle save note
  const handleSaveNote = () => {
    if (!currentUser?.id) return;

    if (!noteForm.patientName || !noteForm.note) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    try {
      const note: PatientNote = {
        id: selectedNote?.id || `NOTE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        patientId: selectedPatientId || `PATIENT_${noteForm.patientName}`,
        patientName: noteForm.patientName,
        doctorId: currentUser.id,
        note: noteForm.note,
        category: noteForm.category || "general",
        isPrivate: noteForm.isPrivate !== false,
        tags: noteForm.tags || [],
        createdAt: selectedNote?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      savePatientNote(note);
      toast.success(selectedNote ? "Cập nhật thành công" : "Tạo ghi chú thành công");
      setShowNoteDialog(false);
      loadData();
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Có lỗi xảy ra");
    }
  };

  // Handle delete note
  const handleDeleteNote = (note: PatientNote) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa ghi chú này?`)) {
      return;
    }

    if (!currentUser?.id) return;

    try {
      deletePatientNote(note.id, currentUser.id);
      toast.success("Xóa thành công");
      loadData();
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error("Có lỗi xảy ra");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusIcon = (status: TreatmentProgress["currentStatus"]) => {
    switch (status) {
      case "improving":
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case "worsening":
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case "stable":
        return <Minus className="h-4 w-4 text-blue-600" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <Activity className="h-4 w-4 text-orange-600" />;
    }
  };

  const getStatusBadge = (status: TreatmentProgress["currentStatus"]) => {
    const labels: Record<TreatmentProgress["currentStatus"], string> = {
      ongoing: "Đang điều trị",
      improving: "Cải thiện",
      stable: "Ổn định",
      worsening: "Xấu đi",
      completed: "Hoàn thành",
    };

    const variants: Record<TreatmentProgress["currentStatus"], "default" | "secondary" | "destructive" | "outline"> = {
      ongoing: "default",
      improving: "default",
      stable: "secondary",
      worsening: "destructive",
      completed: "outline",
    };

    return (
      <Badge variant={variants[status]}>
        {getStatusIcon(status)}
        <span className="ml-1">{labels[status]}</span>
      </Badge>
    );
  };

  if (!currentUser) {
    return (
      <DoctorLayout>
        <div className="space-y-6">
          <Card className="border-[#E5E7EB]">
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-16 w-16 text-[#687280] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Chưa đăng nhập</h3>
              <p className="text-[#687280]">Vui lòng đăng nhập để sử dụng tính năng này</p>
            </CardContent>
          </Card>
        </div>
      </DoctorLayout>
    );
  }

  if (isLoading) {
    return (
      <DoctorLayout>
        <div className="space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64 animate-pulse" />
          <div className="h-64 bg-gray-200 rounded animate-pulse" />
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
            <h1 className="text-3xl font-bold text-gray-900">Theo dõi Bệnh nhân</h1>
            <p className="text-[#687280] mt-1">
              Quản lý nhắc tái khám, theo dõi tiến độ điều trị và ghi chú bệnh nhân
            </p>
          </div>
        </div>

        {/* Patient Selector */}
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Label>Chọn bệnh nhân (tùy chọn)</Label>
                <Select
                  value={selectedPatientId || "all"}
                  onValueChange={(value) => {
                    if (value === "all") {
                      setSelectedPatientId(null);
                      setSelectedPatientName("");
                    } else {
                      setSelectedPatientId(value);
                      setSelectedPatientName(patientList.find((p) => p === value) || "");
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tất cả bệnh nhân" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả bệnh nhân</SelectItem>
                    {patientList.map((patient) => (
                      <SelectItem key={patient} value={patient}>
                        {patient}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedPatientId && (
                <div className="flex items-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedPatientId(null);
                      setSelectedPatientName("");
                    }}
                  >
                    Xóa lọc
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Reminders Alert */}
        {upcomingReminders.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-orange-900">
                <Bell className="h-5 w-5" />
                Nhắc tái khám sắp tới ({upcomingReminders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {upcomingReminders.slice(0, 5).map((reminder) => (
                  <div key={reminder.id} className="flex items-center justify-between p-2 bg-white rounded">
                    <div>
                      <span className="font-medium">{reminder.patientName}</span>
                      <span className="text-sm text-[#687280] ml-2">- {reminder.reason}</span>
                    </div>
                    <Badge variant="outline">
                      {formatDate(reminder.followUpDate)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="reminders" className="space-y-4">
          <TabsList>
            <TabsTrigger value="reminders">
              <Bell className="h-4 w-4 mr-2" />
              Nhắc tái khám
            </TabsTrigger>
            <TabsTrigger value="progress">
              <Activity className="h-4 w-4 mr-2" />
              Tiến độ điều trị
            </TabsTrigger>
            <TabsTrigger value="notes">
              <StickyNote className="h-4 w-4 mr-2" />
              Ghi chú
            </TabsTrigger>
            <TabsTrigger value="interactions">
              <History className="h-4 w-4 mr-2" />
              Lịch sử tương tác
            </TabsTrigger>
          </TabsList>

          {/* Reminders Tab */}
          <TabsContent value="reminders" className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#687280]" />
                  <Input
                    placeholder="Tìm kiếm nhắc tái khám..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Button onClick={handleCreateReminder} className="bg-[#007BFF] hover:bg-[#0056B3]">
                <Plus className="h-4 w-4 mr-2" />
                Tạo nhắc tái khám
              </Button>
            </div>

            {filteredReminders.length === 0 ? (
              <Card className="border-[#E5E7EB]">
                <CardContent className="p-12 text-center">
                  <Bell className="h-16 w-16 text-[#687280] mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {searchQuery ? "Không tìm thấy" : "Chưa có nhắc tái khám"}
                  </h3>
                  <p className="text-[#687280]">
                    {searchQuery ? "Thử tìm kiếm với từ khóa khác" : "Tạo nhắc tái khám để theo dõi bệnh nhân"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredReminders.map((reminder) => (
                  <Card key={reminder.id} className="border-[#E5E7EB]">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{reminder.patientName}</CardTitle>
                          <CardDescription>{reminder.reason}</CardDescription>
                        </div>
                        <Badge
                          variant={
                            reminder.priority === "high"
                              ? "destructive"
                              : reminder.priority === "medium"
                              ? "default"
                              : "outline"
                          }
                        >
                          {reminder.priority === "high" ? "Cao" : reminder.priority === "medium" ? "Trung bình" : "Thấp"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-[#687280]" />
                          <span>Tái khám: {formatDate(reminder.followUpDate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4 text-[#687280]" />
                          <span>Nhắc: {formatDate(reminder.reminderDate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={reminder.status === "completed" ? "default" : "outline"}>
                            {reminder.status === "pending" ? "Chờ xử lý" : reminder.status === "scheduled" ? "Đã đặt lịch" : reminder.status === "completed" ? "Hoàn thành" : "Đã hủy"}
                          </Badge>
                        </div>
                      </div>
                      {reminder.notes && (
                        <p className="text-sm text-[#687280]">{reminder.notes}</p>
                      )}
                      <div className="flex gap-2 pt-2 border-t flex-wrap">
                        {reminder.status === "pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const updatedReminder = { ...reminder, status: "scheduled" as const };
                              saveFollowUpReminder(updatedReminder);
                              toast.success("Đã đánh dấu là đã đặt lịch");
                              loadData();
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Đã đặt lịch
                          </Button>
                        )}
                        {reminder.status !== "completed" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                navigate("/doctor/appointments", {
                                  state: {
                                    createFromReminder: true,
                                    patientName: reminder.patientName,
                                    followUpDate: reminder.followUpDate,
                                    reason: reminder.reason,
                                  },
                                });
                              }}
                            >
                              <Calendar className="h-4 w-4 mr-1" />
                              Đặt lịch
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const updatedReminder = { ...reminder, status: "completed" as const };
                                saveFollowUpReminder(updatedReminder);
                                toast.success("Đã đánh dấu hoàn thành");
                                loadData();
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Hoàn thành
                            </Button>
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedReminder(reminder);
                            setReminderForm({
                              patientName: reminder.patientName,
                              reminderDate: reminder.reminderDate,
                              followUpDate: reminder.followUpDate,
                              reason: reminder.reason,
                              priority: reminder.priority,
                              notes: reminder.notes,
                            });
                            setShowReminderDialog(true);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Sửa
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteReminder(reminder)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Xóa
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Progress Tab */}
          <TabsContent value="progress" className="space-y-4">
            {!selectedPatientId ? (
              <Card className="border-[#E5E7EB]">
                <CardContent className="p-12 text-center">
                  <Activity className="h-16 w-16 text-[#687280] mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Chọn bệnh nhân</h3>
                  <p className="text-[#687280]">Vui lòng chọn bệnh nhân để xem tiến độ điều trị</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex justify-end">
                  <Button onClick={handleCreateProgress} className="bg-[#007BFF] hover:bg-[#0056B3]">
                    <Plus className="h-4 w-4 mr-2" />
                    Tạo tracking điều trị
                  </Button>
                </div>

                {treatmentProgress.length === 0 ? (
                  <Card className="border-[#E5E7EB]">
                    <CardContent className="p-12 text-center">
                      <Activity className="h-16 w-16 text-[#687280] mx-auto mb-4 opacity-30" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Chưa có tracking điều trị</h3>
                      <p className="text-[#687280]">Tạo tracking để theo dõi tiến độ điều trị của bệnh nhân</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {treatmentProgress.map((progress) => (
                      <Card key={progress.id} className="border-[#E5E7EB]">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base">{progress.patientName}</CardTitle>
                              <CardDescription>{progress.treatmentPlan}</CardDescription>
                            </div>
                            {getStatusBadge(progress.currentStatus)}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-[#687280]">Bắt đầu: </span>
                              <span className="font-medium">{formatDate(progress.startDate)}</span>
                            </div>
                            {progress.endDate && (
                              <div>
                                <span className="text-[#687280]">Kết thúc: </span>
                                <span className="font-medium">{formatDate(progress.endDate)}</span>
                              </div>
                            )}
                          </div>

                          {progress.progressNotes.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2">Ghi chú tiến độ:</h4>
                              <div className="space-y-2">
                                {progress.progressNotes.map((note, idx) => (
                                  <div key={idx} className="p-3 bg-gray-50 rounded text-sm">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-medium">{formatDate(note.date)}</span>
                                    </div>
                                    <p className="text-[#687280]">{note.note}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="pt-2 border-t">
                            <div className="flex gap-2">
                              <Input
                                placeholder="Thêm ghi chú tiến độ..."
                                value={progressNoteText}
                                onChange={(e) => setProgressNoteText(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === "Enter") {
                                    handleAddProgressNote(progress.id);
                                  }
                                }}
                              />
                              <Button
                                onClick={() => handleAddProgressNote(progress.id)}
                                variant="outline"
                              >
                                Thêm
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="space-y-4">
            {!selectedPatientId ? (
              <Card className="border-[#E5E7EB]">
                <CardContent className="p-12 text-center">
                  <StickyNote className="h-16 w-16 text-[#687280] mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Chọn bệnh nhân</h3>
                  <p className="text-[#687280]">Vui lòng chọn bệnh nhân để xem ghi chú</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex justify-end">
                  <Button onClick={handleCreateNote} className="bg-[#007BFF] hover:bg-[#0056B3]">
                    <Plus className="h-4 w-4 mr-2" />
                    Tạo ghi chú
                  </Button>
                </div>

                {patientNotes.length === 0 ? (
                  <Card className="border-[#E5E7EB]">
                    <CardContent className="p-12 text-center">
                      <StickyNote className="h-16 w-16 text-[#687280] mx-auto mb-4 opacity-30" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Chưa có ghi chú</h3>
                      <p className="text-[#687280]">Tạo ghi chú để lưu thông tin quan trọng về bệnh nhân</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {patientNotes.map((note) => (
                      <Card key={note.id} className="border-[#E5E7EB]">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base">{note.patientName}</CardTitle>
                              <div className="flex gap-2 mt-2">
                                {note.category && (
                                  <Badge variant="outline">{note.category}</Badge>
                                )}
                                {note.isPrivate && (
                                  <Badge variant="secondary">Riêng tư</Badge>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-[#687280]">{formatDate(note.createdAt)}</span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-gray-900 whitespace-pre-wrap">{note.note}</p>
                          <div className="flex gap-2 mt-4 pt-4 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedNote(note);
                                setNoteForm({
                                  patientName: note.patientName,
                                  note: note.note,
                                  category: note.category,
                                  isPrivate: note.isPrivate,
                                  tags: note.tags,
                                });
                                setShowNoteDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Sửa
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteNote(note)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Xóa
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Interactions Tab */}
          <TabsContent value="interactions" className="space-y-4">
            {!selectedPatientId ? (
              <Card className="border-[#E5E7EB]">
                <CardContent className="p-12 text-center">
                  <History className="h-16 w-16 text-[#687280] mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Chọn bệnh nhân</h3>
                  <p className="text-[#687280]">Vui lòng chọn bệnh nhân để xem lịch sử tương tác</p>
                </CardContent>
              </Card>
            ) : interactions.length === 0 ? (
              <Card className="border-[#E5E7EB]">
                <CardContent className="p-12 text-center">
                  <History className="h-16 w-16 text-[#687280] mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Chưa có tương tác</h3>
                  <p className="text-[#687280]">Lịch sử tương tác sẽ hiển thị ở đây</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {interactions.map((interaction) => {
                  const getTypeIcon = () => {
                    switch (interaction.type) {
                      case "appointment":
                        return <Calendar className="h-4 w-4 text-blue-600" />;
                      case "prescription":
                        return <FileText className="h-4 w-4 text-green-600" />;
                      case "ehr":
                        return <FileText className="h-4 w-4 text-purple-600" />;
                      case "note":
                        return <StickyNote className="h-4 w-4 text-orange-600" />;
                      case "followup":
                        return <Bell className="h-4 w-4 text-red-600" />;
                      default:
                        return <History className="h-4 w-4 text-gray-600" />;
                    }
                  };

                  const getTypeLabel = () => {
                    switch (interaction.type) {
                      case "appointment":
                        return "Lịch khám";
                      case "prescription":
                        return "Đơn thuốc";
                      case "ehr":
                        return "Hồ sơ y tế";
                      case "note":
                        return "Ghi chú";
                      case "followup":
                        return "Tái khám";
                      default:
                        return interaction.type;
                    }
                  };

                  return (
                    <Card key={interaction.id} className="border-[#E5E7EB]">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-1">{getTypeIcon()}</div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{interaction.title}</span>
                                <Badge variant="outline">{getTypeLabel()}</Badge>
                              </div>
                              <span className="text-xs text-[#687280]">{formatDate(interaction.date)}</span>
                            </div>
                            {interaction.description && (
                              <p className="text-sm text-[#687280]">{interaction.description}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Reminder Dialog */}
        <Dialog open={showReminderDialog} onOpenChange={setShowReminderDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedReminder ? "Chỉnh sửa nhắc tái khám" : "Tạo nhắc tái khám mới"}
              </DialogTitle>
              <DialogDescription>
                Tạo nhắc tái khám để tự động nhắc bệnh nhân
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="reminderPatient">Tên bệnh nhân *</Label>
                <Select
                  value={reminderForm.patientName}
                  onValueChange={(value) => setReminderForm({ ...reminderForm, patientName: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn bệnh nhân" />
                  </SelectTrigger>
                  <SelectContent>
                    {patientList.map((patient) => (
                      <SelectItem key={patient} value={patient}>
                        {patient}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="reminderReason">Lý do tái khám *</Label>
                <Input
                  id="reminderReason"
                  value={reminderForm.reason}
                  onChange={(e) => setReminderForm({ ...reminderForm, reason: e.target.value })}
                  placeholder="Ví dụ: Kiểm tra sau điều trị, Tái khám định kỳ..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="followUpDate">Ngày tái khám *</Label>
                  <Input
                    id="followUpDate"
                    type="date"
                    value={reminderForm.followUpDate}
                    onChange={(e) => {
                      setReminderForm({
                        ...reminderForm,
                        followUpDate: e.target.value,
                        reminderDate: reminderForm.reminderDate || e.target.value,
                      });
                    }}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div>
                  <Label htmlFor="reminderDate">Ngày nhắc</Label>
                  <Input
                    id="reminderDate"
                    type="date"
                    value={reminderForm.reminderDate}
                    onChange={(e) => setReminderForm({ ...reminderForm, reminderDate: e.target.value })}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="reminderPriority">Mức độ ưu tiên</Label>
                <Select
                  value={reminderForm.priority}
                  onValueChange={(value: any) => setReminderForm({ ...reminderForm, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Thấp</SelectItem>
                    <SelectItem value="medium">Trung bình</SelectItem>
                    <SelectItem value="high">Cao</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="reminderNotes">Ghi chú</Label>
                <Textarea
                  id="reminderNotes"
                  value={reminderForm.notes}
                  onChange={(e) => setReminderForm({ ...reminderForm, notes: e.target.value })}
                  placeholder="Ghi chú bổ sung..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReminderDialog(false)}>
                Hủy
              </Button>
              <Button onClick={handleSaveReminder} className="bg-[#007BFF] hover:bg-[#0056B3]">
                {selectedReminder ? "Cập nhật" : "Tạo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Progress Dialog */}
        <Dialog open={showProgressDialog} onOpenChange={setShowProgressDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedProgress ? "Chỉnh sửa tracking điều trị" : "Tạo tracking điều trị mới"}
              </DialogTitle>
              <DialogDescription>
                Theo dõi tiến độ điều trị của bệnh nhân
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="progressPatient">Tên bệnh nhân *</Label>
                <Select
                  value={progressForm.patientName}
                  onValueChange={(value) => setProgressForm({ ...progressForm, patientName: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn bệnh nhân" />
                  </SelectTrigger>
                  <SelectContent>
                    {patientList.map((patient) => (
                      <SelectItem key={patient} value={patient}>
                        {patient}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="treatmentPlan">Kế hoạch điều trị *</Label>
                <Textarea
                  id="treatmentPlan"
                  value={progressForm.treatmentPlan}
                  onChange={(e) => setProgressForm({ ...progressForm, treatmentPlan: e.target.value })}
                  placeholder="Mô tả kế hoạch điều trị..."
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Ngày bắt đầu *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={progressForm.startDate}
                    onChange={(e) => setProgressForm({ ...progressForm, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">Ngày kết thúc (tùy chọn)</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={progressForm.endDate}
                    onChange={(e) => setProgressForm({ ...progressForm, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="currentStatus">Trạng thái hiện tại</Label>
                <Select
                  value={progressForm.currentStatus}
                  onValueChange={(value: any) => setProgressForm({ ...progressForm, currentStatus: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ongoing">Đang điều trị</SelectItem>
                    <SelectItem value="improving">Cải thiện</SelectItem>
                    <SelectItem value="stable">Ổn định</SelectItem>
                    <SelectItem value="worsening">Xấu đi</SelectItem>
                    <SelectItem value="completed">Hoàn thành</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowProgressDialog(false)}>
                Hủy
              </Button>
              <Button onClick={handleSaveProgress} className="bg-[#007BFF] hover:bg-[#0056B3]">
                {selectedProgress ? "Cập nhật" : "Tạo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Note Dialog */}
        <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedNote ? "Chỉnh sửa ghi chú" : "Tạo ghi chú mới"}
              </DialogTitle>
              <DialogDescription>
                Ghi chú riêng về bệnh nhân
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="notePatient">Tên bệnh nhân *</Label>
                <Select
                  value={noteForm.patientName}
                  onValueChange={(value) => setNoteForm({ ...noteForm, patientName: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn bệnh nhân" />
                  </SelectTrigger>
                  <SelectContent>
                    {patientList.map((patient) => (
                      <SelectItem key={patient} value={patient}>
                        {patient}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="noteCategory">Danh mục</Label>
                <Select
                  value={noteForm.category}
                  onValueChange={(value: any) => setNoteForm({ ...noteForm, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Chung</SelectItem>
                    <SelectItem value="allergy">Dị ứng</SelectItem>
                    <SelectItem value="preference">Sở thích</SelectItem>
                    <SelectItem value="important">Quan trọng</SelectItem>
                    <SelectItem value="reminder">Nhắc nhở</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="noteText">Nội dung ghi chú *</Label>
                <Textarea
                  id="noteText"
                  value={noteForm.note}
                  onChange={(e) => setNoteForm({ ...noteForm, note: e.target.value })}
                  placeholder="Nhập ghi chú..."
                  rows={6}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPrivate"
                  checked={noteForm.isPrivate}
                  onChange={(e) => setNoteForm({ ...noteForm, isPrivate: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="isPrivate">Ghi chú riêng tư (chỉ bác sĩ này thấy)</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNoteDialog(false)}>
                Hủy
              </Button>
              <Button onClick={handleSaveNote} className="bg-[#007BFF] hover:bg-[#0056B3]">
                {selectedNote ? "Cập nhật" : "Tạo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DoctorLayout>
  );
};

export default PatientFollowUp;

