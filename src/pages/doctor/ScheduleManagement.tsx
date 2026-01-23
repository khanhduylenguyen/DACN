import { useEffect, useState, useCallback } from "react";
import DoctorLayout from "@/components/layout/DoctorLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  AlertCircle,
  Plus,
  Edit,
  Trash2,
  Save,
  Bell,
  X,
  Repeat,
  Ban,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import {
  getScheduleSettings,
  saveScheduleSettings,
  getBlockedTimes,
  saveBlockedTime,
  deleteBlockedTime,
  getRecurringSchedules,
  saveRecurringSchedule,
  deleteRecurringSchedule,
  getScheduleUtilization,
  isScheduleNearlyFull,
  type WorkingHours,
  type BlockedTime,
  type RecurringSchedule,
  type ScheduleSettings,
  type DayOfWeek,
} from "@/lib/doctor-schedule";
import { toast } from "sonner";

const APPOINTMENTS_STORAGE_KEY = "cliniccare:appointments";

interface Appointment {
  date: string;
  time: string;
  status: string;
}

const dayLabels: Record<DayOfWeek, string> = {
  monday: "Thứ 2",
  tuesday: "Thứ 3",
  wednesday: "Thứ 4",
  thursday: "Thứ 5",
  friday: "Thứ 6",
  saturday: "Thứ 7",
  sunday: "Chủ nhật",
};

const ScheduleManagement = () => {
  const currentUser = getCurrentUser();
  const [settings, setSettings] = useState<ScheduleSettings | null>(null);
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [recurringSchedules, setRecurringSchedules] = useState<RecurringSchedule[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog states
  const [showBlockedTimeDialog, setShowBlockedTimeDialog] = useState(false);
  const [showRecurringDialog, setShowRecurringDialog] = useState(false);
  const [selectedBlockedTime, setSelectedBlockedTime] = useState<BlockedTime | null>(null);
  const [selectedRecurringSchedule, setSelectedRecurringSchedule] = useState<RecurringSchedule | null>(null);

  // Form states
  const [blockedTimeForm, setBlockedTimeForm] = useState<Partial<BlockedTime>>({
    date: "",
    startTime: "",
    endTime: "",
    reason: "",
    isRecurring: false,
  });
  const [recurringForm, setRecurringForm] = useState<Partial<RecurringSchedule>>({
    name: "",
    description: "",
    workingHours: [],
    startDate: "",
    endDate: "",
    isActive: true,
  });

  // Load data
  const loadData = useCallback(() => {
    if (!currentUser?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const scheduleSettings = getScheduleSettings(currentUser.id);
      setSettings(scheduleSettings);

      const blocked = getBlockedTimes(currentUser.id);
      setBlockedTimes(blocked);

      const recurring = getRecurringSchedules(currentUser.id);
      setRecurringSchedules(recurring);

      // Load appointments
      const stored = localStorage.getItem(APPOINTMENTS_STORAGE_KEY);
      if (stored) {
        const allAppointments: Array<{ date: string; time: string; status: string; doctorId: string }> = JSON.parse(stored);
        const doctorAppointments = allAppointments
          .filter((apt) => apt.doctorId === currentUser.id)
          .map((apt) => ({ date: apt.date, time: apt.time, status: apt.status }));
        setAppointments(doctorAppointments);
      }
    } catch (error) {
      console.error("Error loading schedule data:", error);
      toast.error("Có lỗi xảy ra khi tải dữ liệu");
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };

    window.addEventListener("scheduleSettingsUpdated", handleUpdate);
    window.addEventListener("blockedTimesUpdated", handleUpdate);
    window.addEventListener("recurringSchedulesUpdated", handleUpdate);
    window.addEventListener("appointmentsUpdated", handleUpdate);

    return () => {
      window.removeEventListener("scheduleSettingsUpdated", handleUpdate);
      window.removeEventListener("blockedTimesUpdated", handleUpdate);
      window.removeEventListener("recurringSchedulesUpdated", handleUpdate);
      window.removeEventListener("appointmentsUpdated", handleUpdate);
    };
  }, [loadData]);

  // Handle save settings
  const handleSaveSettings = () => {
    if (!currentUser?.id || !settings) return;

    try {
      saveScheduleSettings(settings);
      toast.success("Đã lưu cài đặt lịch làm việc");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Có lỗi xảy ra khi lưu cài đặt");
    }
  };

  // Handle update working hours
  const handleUpdateWorkingHours = (dayOfWeek: DayOfWeek, updates: Partial<WorkingHours>) => {
    if (!settings) return;

    const updated = settings.workingHours.map((wh) =>
      wh.dayOfWeek === dayOfWeek ? { ...wh, ...updates } : wh
    );

    setSettings({ ...settings, workingHours: updated });
  };

  // Handle create blocked time
  const handleCreateBlockedTime = () => {
    setSelectedBlockedTime(null);
    setBlockedTimeForm({
      date: "",
      startTime: "",
      endTime: "",
      reason: "",
      isRecurring: false,
    });
    setShowBlockedTimeDialog(true);
  };

  // Handle save blocked time
  const handleSaveBlockedTime = () => {
    if (!currentUser?.id) return;

    if (!blockedTimeForm.date || !blockedTimeForm.startTime || !blockedTimeForm.endTime) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    try {
      const blockedTime: BlockedTime = {
        id: selectedBlockedTime?.id || `BLOCK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        doctorId: currentUser.id,
        date: blockedTimeForm.date,
        startTime: blockedTimeForm.startTime,
        endTime: blockedTimeForm.endTime,
        reason: blockedTimeForm.reason,
        isRecurring: blockedTimeForm.isRecurring || false,
        createdAt: selectedBlockedTime?.createdAt || new Date().toISOString(),
      };

      saveBlockedTime(blockedTime);
      toast.success(selectedBlockedTime ? "Cập nhật thành công" : "Tạo chặn thời gian thành công");
      setShowBlockedTimeDialog(false);
      loadData();
    } catch (error) {
      console.error("Error saving blocked time:", error);
      toast.error("Có lỗi xảy ra");
    }
  };

  // Handle delete blocked time
  const handleDeleteBlockedTime = (blockedTime: BlockedTime) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa chặn thời gian này?`)) {
      return;
    }

    if (!currentUser?.id) return;

    try {
      deleteBlockedTime(blockedTime.id, currentUser.id);
      toast.success("Xóa thành công");
      loadData();
    } catch (error) {
      console.error("Error deleting blocked time:", error);
      toast.error("Có lỗi xảy ra");
    }
  };

  // Get schedule warnings
  const getScheduleWarnings = () => {
    if (!currentUser?.id || !settings) return [];

    const warnings: Array<{ date: string; percentage: number }> = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      
      if (isScheduleNearlyFull(currentUser.id, dateStr, appointments)) {
        const utilization = getScheduleUtilization(currentUser.id, dateStr, appointments);
        warnings.push({ date: dateStr, percentage: utilization.percentage });
      }
    }

    return warnings;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading || !settings) {
    return (
      <DoctorLayout>
        <div className="space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64 animate-pulse" />
          <div className="h-64 bg-gray-200 rounded animate-pulse" />
        </div>
      </DoctorLayout>
    );
  }

  const warnings = getScheduleWarnings();

  return (
    <DoctorLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Quản lý Lịch làm việc</h1>
            <p className="text-[#687280] mt-1">
              Thiết lập lịch làm việc, chặn thời gian và lịch lặp lại
            </p>
          </div>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-orange-900">
                <AlertCircle className="h-5 w-5" />
                Cảnh báo: Lịch sắp đầy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {warnings.map((warning) => (
                  <div key={warning.date} className="flex items-center justify-between p-2 bg-white rounded">
                    <span className="text-sm font-medium">{formatDate(warning.date)}</span>
                    <Badge variant="destructive">{warning.percentage}% đã đặt</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="working-hours" className="space-y-4">
          <TabsList>
            <TabsTrigger value="working-hours">
              <Clock className="h-4 w-4 mr-2" />
              Giờ làm việc
            </TabsTrigger>
            <TabsTrigger value="blocked-times">
              <Ban className="h-4 w-4 mr-2" />
              Chặn thời gian
            </TabsTrigger>
            <TabsTrigger value="recurring">
              <Repeat className="h-4 w-4 mr-2" />
              Lịch lặp lại
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Calendar className="h-4 w-4 mr-2" />
              Cài đặt
            </TabsTrigger>
          </TabsList>

          {/* Working Hours Tab */}
          <TabsContent value="working-hours" className="space-y-4">
            <Card className="border-[#E5E7EB]">
              <CardHeader>
                <CardTitle>Giờ làm việc theo ngày</CardTitle>
                <CardDescription>
                  Thiết lập giờ làm việc cho từng ngày trong tuần
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {settings.workingHours.map((wh) => (
                  <Card key={wh.dayOfWeek} className="border-[#E5E7EB]">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex items-center space-x-2 min-w-[120px]">
                          <Checkbox
                            id={wh.dayOfWeek}
                            checked={wh.enabled}
                            onCheckedChange={(checked) =>
                              handleUpdateWorkingHours(wh.dayOfWeek, { enabled: checked as boolean })
                            }
                          />
                          <Label htmlFor={wh.dayOfWeek} className="font-medium">
                            {dayLabels[wh.dayOfWeek]}
                          </Label>
                        </div>
                        {wh.enabled && (
                          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <Label className="text-xs">Giờ bắt đầu</Label>
                              <Input
                                type="time"
                                value={wh.startTime}
                                onChange={(e) =>
                                  handleUpdateWorkingHours(wh.dayOfWeek, { startTime: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Giờ kết thúc</Label>
                              <Input
                                type="time"
                                value={wh.endTime}
                                onChange={(e) =>
                                  handleUpdateWorkingHours(wh.dayOfWeek, { endTime: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Nghỉ trưa từ</Label>
                              <Input
                                type="time"
                                value={wh.breakStart || ""}
                                onChange={(e) =>
                                  handleUpdateWorkingHours(wh.dayOfWeek, { breakStart: e.target.value || undefined })
                                }
                                placeholder="12:00"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Nghỉ trưa đến</Label>
                              <Input
                                type="time"
                                value={wh.breakEnd || ""}
                                onChange={(e) =>
                                  handleUpdateWorkingHours(wh.dayOfWeek, { breakEnd: e.target.value || undefined })
                                }
                                placeholder="13:00"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button onClick={handleSaveSettings} className="bg-[#007BFF] hover:bg-[#0056B3]">
                  <Save className="h-4 w-4 mr-2" />
                  Lưu giờ làm việc
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Blocked Times Tab */}
          <TabsContent value="blocked-times" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={handleCreateBlockedTime} className="bg-[#007BFF] hover:bg-[#0056B3]">
                <Plus className="h-4 w-4 mr-2" />
                Chặn thời gian
              </Button>
            </div>

            {blockedTimes.length === 0 ? (
              <Card className="border-[#E5E7EB]">
                <CardContent className="p-12 text-center">
                  <Ban className="h-16 w-16 text-[#687280] mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Chưa có thời gian bị chặn</h3>
                  <p className="text-[#687280]">Thêm thời gian bị chặn để không nhận lịch hẹn</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {blockedTimes.map((blocked) => (
                  <Card key={blocked.id} className="border-[#E5E7EB]">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{formatDate(blocked.date)}</CardTitle>
                          <CardDescription>
                            {blocked.startTime} - {blocked.endTime}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedBlockedTime(blocked);
                              setBlockedTimeForm({
                                date: blocked.date,
                                startTime: blocked.startTime,
                                endTime: blocked.endTime,
                                reason: blocked.reason,
                                isRecurring: blocked.isRecurring,
                              });
                              setShowBlockedTimeDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteBlockedTime(blocked)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {blocked.reason && (
                        <p className="text-sm text-[#687280]">{blocked.reason}</p>
                      )}
                      {blocked.isRecurring && (
                        <Badge variant="outline" className="mt-2">
                          <Repeat className="h-3 w-3 mr-1" />
                          Lặp lại
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Recurring Schedules Tab */}
          <TabsContent value="recurring" className="space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setSelectedRecurringSchedule(null);
                  setRecurringForm({
                    name: "",
                    description: "",
                    workingHours: [],
                    startDate: "",
                    endDate: "",
                    isActive: true,
                  });
                  setShowRecurringDialog(true);
                }}
                className="bg-[#007BFF] hover:bg-[#0056B3]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Tạo lịch lặp lại
              </Button>
            </div>

            {recurringSchedules.length === 0 ? (
              <Card className="border-[#E5E7EB]">
                <CardContent className="p-12 text-center">
                  <Repeat className="h-16 w-16 text-[#687280] mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Chưa có lịch lặp lại</h3>
                  <p className="text-[#687280]">Tạo lịch lặp lại để tự động áp dụng giờ làm việc</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recurringSchedules.map((schedule) => (
                  <Card key={schedule.id} className="border-[#E5E7EB]">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{schedule.name}</CardTitle>
                          {schedule.description && (
                            <CardDescription>{schedule.description}</CardDescription>
                          )}
                        </div>
                        <Badge variant={schedule.isActive ? "default" : "outline"}>
                          {schedule.isActive ? "Đang hoạt động" : "Tạm dừng"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-[#687280]">Bắt đầu: </span>
                          <span className="font-medium">{formatDate(schedule.startDate)}</span>
                        </div>
                        {schedule.endDate && (
                          <div>
                            <span className="text-[#687280]">Kết thúc: </span>
                            <span className="font-medium">{formatDate(schedule.endDate)}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-[#687280]">Số ngày: </span>
                          <span className="font-medium">{schedule.workingHours.length}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteBlockedTime(schedule as any)}
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

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card className="border-[#E5E7EB]">
              <CardHeader>
                <CardTitle>Cài đặt lịch làm việc</CardTitle>
                <CardDescription>
                  Cấu hình các thông số cho lịch làm việc
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="slotDuration">Thời gian mỗi slot (phút)</Label>
                  <Input
                    id="slotDuration"
                    type="number"
                    value={settings.defaultSlotDuration}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultSlotDuration: parseInt(e.target.value) || 30 })
                    }
                    min={15}
                    max={120}
                    step={15}
                  />
                </div>
                <div>
                  <Label htmlFor="maxAppointments">Giới hạn số lịch hẹn mỗi ngày (tùy chọn)</Label>
                  <Input
                    id="maxAppointments"
                    type="number"
                    value={settings.maxAppointmentsPerDay || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        maxAppointmentsPerDay: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                    min={1}
                    placeholder="Không giới hạn"
                  />
                </div>
                <div>
                  <Label htmlFor="warningThreshold">Ngưỡng cảnh báo lịch đầy (%)</Label>
                  <Input
                    id="warningThreshold"
                    type="number"
                    value={settings.warningThreshold}
                    onChange={(e) =>
                      setSettings({ ...settings, warningThreshold: parseInt(e.target.value) || 80 })
                    }
                    min={0}
                    max={100}
                  />
                  <p className="text-xs text-[#687280] mt-1">
                    Cảnh báo khi lịch đạt {settings.warningThreshold}% công suất
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="autoConfirm"
                    checked={settings.autoConfirm}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, autoConfirm: checked as boolean })
                    }
                  />
                  <Label htmlFor="autoConfirm">Tự động xác nhận lịch hẹn</Label>
                </div>
                <div>
                  <Label htmlFor="bufferTime">Thời gian nghỉ giữa các lịch (phút)</Label>
                  <Input
                    id="bufferTime"
                    type="number"
                    value={settings.bufferTime}
                    onChange={(e) =>
                      setSettings({ ...settings, bufferTime: parseInt(e.target.value) || 0 })
                    }
                    min={0}
                    max={60}
                  />
                </div>
                <Button onClick={handleSaveSettings} className="bg-[#007BFF] hover:bg-[#0056B3]">
                  <Save className="h-4 w-4 mr-2" />
                  Lưu cài đặt
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Blocked Time Dialog */}
        <Dialog open={showBlockedTimeDialog} onOpenChange={setShowBlockedTimeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedBlockedTime ? "Chỉnh sửa chặn thời gian" : "Chặn thời gian mới"}
              </DialogTitle>
              <DialogDescription>
                Chặn thời gian để không nhận lịch hẹn trong khoảng thời gian này
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="blockDate">Ngày *</Label>
                <Input
                  id="blockDate"
                  type="date"
                  value={blockedTimeForm.date}
                  onChange={(e) => setBlockedTimeForm({ ...blockedTimeForm, date: e.target.value })}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="blockStartTime">Giờ bắt đầu *</Label>
                  <Input
                    id="blockStartTime"
                    type="time"
                    value={blockedTimeForm.startTime}
                    onChange={(e) =>
                      setBlockedTimeForm({ ...blockedTimeForm, startTime: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="blockEndTime">Giờ kết thúc *</Label>
                  <Input
                    id="blockEndTime"
                    type="time"
                    value={blockedTimeForm.endTime}
                    onChange={(e) =>
                      setBlockedTimeForm({ ...blockedTimeForm, endTime: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="blockReason">Lý do (tùy chọn)</Label>
                <Textarea
                  id="blockReason"
                  value={blockedTimeForm.reason}
                  onChange={(e) => setBlockedTimeForm({ ...blockedTimeForm, reason: e.target.value })}
                  placeholder="Ví dụ: Nghỉ phép, Họp, Khám ngoài..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBlockedTimeDialog(false)}>
                Hủy
              </Button>
              <Button onClick={handleSaveBlockedTime} className="bg-[#007BFF] hover:bg-[#0056B3]">
                {selectedBlockedTime ? "Cập nhật" : "Tạo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DoctorLayout>
  );
};

export default ScheduleManagement;

