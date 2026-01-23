import { useEffect, useState, useRef, useCallback } from "react";
import DoctorLayout from "@/components/layout/DoctorLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  Calendar,
  Pill,
  AlertCircle,
  CheckCircle2,
  X,
  Trash2,
  Filter,
  CheckCheck,
  Clock,
  User,
  FileText,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import {
  getDoctorNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getUnreadCount,
  checkAndCreateAppointmentReminders,
  checkAndCreateFollowUpReminders,
  type DoctorNotification,
  type DoctorNotificationType,
} from "@/lib/doctor-notifications";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const Notifications = () => {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<DoctorNotification[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "appointments" | "prescriptions" | "followup">("all");
  const [filterPriority, setFilterPriority] = useState<"all" | "high" | "medium" | "low">("all");
  const [filterRead, setFilterRead] = useState<"all" | "read" | "unread">("all");
  const isLoadingRef = useRef(false);

  // Load notifications
  const loadNotifications = useCallback(() => {
    if (!user?.id || isLoadingRef.current) return;

    isLoadingRef.current = true;
    try {
      let typeFilter: DoctorNotificationType | undefined;
      if (activeTab === "appointments") {
        typeFilter = "appointment_reminder";
      } else if (activeTab === "prescriptions") {
        typeFilter = "prescription_new";
      } else if (activeTab === "followup") {
        typeFilter = "followup_reminder";
      }

      const filters: any = {};
      if (typeFilter) {
        // For appointments tab, include both reminder and upcoming
        if (activeTab === "appointments") {
          const all = getDoctorNotifications(user.id, { read: filterRead === "unread" ? false : filterRead === "read" ? true : undefined });
          const filtered = all.filter(n => n.type === "appointment_reminder" || n.type === "appointment_upcoming");
          setNotifications(filtered);
          isLoadingRef.current = false;
          return;
        }
        filters.type = typeFilter;
      }

      if (filterRead === "unread") {
        filters.read = false;
      } else if (filterRead === "read") {
        filters.read = true;
      }

      if (filterPriority !== "all") {
        filters.priority = filterPriority;
      }

      const loaded = getDoctorNotifications(user.id, filters);
      setNotifications(loaded);
    } catch (error) {
      console.error("Error loading notifications:", error);
      setNotifications([]);
    } finally {
      isLoadingRef.current = false;
    }
  }, [user?.id, activeTab, filterRead, filterPriority]);

  // Check for new reminders periodically
  useEffect(() => {
    if (!user?.id) return;

    // Check immediately
    checkAndCreateAppointmentReminders(user.id);
    checkAndCreateFollowUpReminders(user.id);

    // Check every 5 minutes
    const interval = setInterval(() => {
      checkAndCreateAppointmentReminders(user.id);
      checkAndCreateFollowUpReminders(user.id);
      loadNotifications();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user?.id, loadNotifications]);

  // Load notifications
  useEffect(() => {
    loadNotifications();

    const handleUpdate = () => {
      if (!isLoadingRef.current) {
        loadNotifications();
      }
    };

    window.addEventListener("doctorNotificationsUpdated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("doctorNotificationsUpdated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [loadNotifications]);

  const unreadCount = getUnreadCount(user?.id || "");

  // Get notification icon
  const getNotificationIcon = (type: DoctorNotificationType) => {
    switch (type) {
      case "appointment_reminder":
      case "appointment_upcoming":
        return Calendar;
      case "prescription_new":
        return Pill;
      case "followup_reminder":
        return Clock;
      case "system":
        return AlertCircle;
    }
  };

  // Get notification color
  const getNotificationColor = (type: DoctorNotificationType, priority: DoctorNotification["priority"]) => {
    if (priority === "high") {
      return "text-red-600 bg-red-50 border-red-200";
    }
    switch (type) {
      case "appointment_reminder":
      case "appointment_upcoming":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "prescription_new":
        return "text-purple-600 bg-purple-50 border-purple-200";
      case "followup_reminder":
        return "text-orange-600 bg-orange-50 border-orange-200";
      case "system":
        return "text-amber-600 bg-amber-50 border-amber-200";
    }
  };

  // Get notification type label
  const getNotificationTypeLabel = (type: DoctorNotificationType) => {
    switch (type) {
      case "appointment_reminder":
        return "Nhắc lịch khám";
      case "appointment_upcoming":
        return "Lịch khám sắp bắt đầu";
      case "prescription_new":
        return "Đơn thuốc mới";
      case "followup_reminder":
        return "Nhắc tái khám";
      case "system":
        return "Hệ thống";
    }
  };

  // Mark as read
  const handleMarkAsRead = (notificationId: string) => {
    if (!user?.id) return;
    markNotificationAsRead(notificationId, user.id);
    loadNotifications();
  };

  // Mark all as read
  const handleMarkAllAsRead = () => {
    if (!user?.id) return;
    markAllNotificationsAsRead(user.id);
    loadNotifications();
    toast.success("Đã đánh dấu tất cả là đã đọc");
  };

  // Delete notification
  const handleDelete = (notificationId: string) => {
    if (!user?.id) return;
    deleteNotification(notificationId, user.id);
    loadNotifications();
    toast.success("Đã xóa thông báo");
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Vừa xong";
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    if (days < 7) return `${days} ngày trước`;
    return date.toLocaleDateString("vi-VN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Handle notification click
  const handleNotificationClick = (notification: DoctorNotification) => {
    handleMarkAsRead(notification.id);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  if (!user) {
    return (
      <DoctorLayout>
        <div className="p-6">
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-lg text-gray-900">Vui lòng đăng nhập</p>
            </CardContent>
          </Card>
        </div>
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout>
      <div className="space-y-6">
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-[#007BFF]" />
                  Thông báo & Nhắc nhở
                  {unreadCount > 0 && (
                    <Badge className="bg-red-500 text-white ml-2">
                      {unreadCount} mới
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-2">
                  Nhắc lịch khám, đơn thuốc mới, nhắc tái khám và thông báo hệ thống.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMarkAllAsRead}
                    className="flex items-center gap-2"
                  >
                    <CheckCheck className="h-4 w-4" />
                    Đánh dấu tất cả đã đọc
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">Tất cả</TabsTrigger>
                <TabsTrigger value="appointments">
                  Lịch khám
                  {notifications.filter(n => (n.type === "appointment_reminder" || n.type === "appointment_upcoming") && !n.read).length > 0 && (
                    <Badge className="ml-2 bg-red-500 text-white text-xs">
                      {notifications.filter(n => (n.type === "appointment_reminder" || n.type === "appointment_upcoming") && !n.read).length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="prescriptions">
                  Đơn thuốc
                  {notifications.filter(n => n.type === "prescription_new" && !n.read).length > 0 && (
                    <Badge className="ml-2 bg-red-500 text-white text-xs">
                      {notifications.filter(n => n.type === "prescription_new" && !n.read).length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="followup">
                  Tái khám
                  {notifications.filter(n => n.type === "followup_reminder" && !n.read).length > 0 && (
                    <Badge className="ml-2 bg-red-500 text-white text-xs">
                      {notifications.filter(n => n.type === "followup_reminder" && !n.read).length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-6">
                {/* Filters */}
                <div className="mb-6 flex items-center gap-4 flex-wrap">
                  <Filter className="h-4 w-4 text-[#687280]" />
                  <Select
                    value={filterPriority}
                    onValueChange={(value) => setFilterPriority(value as any)}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Mức độ ưu tiên" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả mức độ</SelectItem>
                      <SelectItem value="high">Cao</SelectItem>
                      <SelectItem value="medium">Trung bình</SelectItem>
                      <SelectItem value="low">Thấp</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={filterRead}
                    onValueChange={(value) => setFilterRead(value as any)}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Trạng thái" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      <SelectItem value="unread">Chưa đọc</SelectItem>
                      <SelectItem value="read">Đã đọc</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Notifications List */}
                {notifications.length === 0 ? (
                  <div className="text-center py-12">
                    <Bell className="h-16 w-16 text-[#687280] mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium text-gray-900 mb-2">
                      Chưa có thông báo nào
                    </p>
                    <p className="text-sm text-[#687280]">
                      Các thông báo về lịch khám, đơn thuốc và nhắc tái khám sẽ xuất hiện tại đây.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((notification) => {
                      const Icon = getNotificationIcon(notification.type);
                      const colorClass = getNotificationColor(notification.type, notification.priority);

                      return (
                        <div
                          key={notification.id}
                          className={`p-4 rounded-lg border transition-all cursor-pointer ${
                            notification.read
                              ? "bg-white border-[#E5E7EB] opacity-75"
                              : "bg-blue-50/50 border-blue-200 shadow-sm"
                          } hover:shadow-md`}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="flex items-start gap-4">
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 ${colorClass}`}
                            >
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${colorClass}`}
                                    >
                                      {getNotificationTypeLabel(notification.type)}
                                    </Badge>
                                    {notification.priority === "high" && (
                                      <Badge className="bg-red-500 text-white text-xs">
                                        Ưu tiên cao
                                      </Badge>
                                    )}
                                    {!notification.read && (
                                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                                    )}
                                  </div>
                                  <h4
                                    className={`font-semibold mb-1 ${
                                      notification.read ? "text-gray-700" : "text-gray-900"
                                    }`}
                                  >
                                    {notification.title}
                                  </h4>
                                  <p
                                    className={`text-sm ${
                                      notification.read ? "text-[#687280]" : "text-gray-700"
                                    }`}
                                  >
                                    {notification.message}
                                  </p>
                                  {notification.metadata?.patientName && (
                                    <div className="flex items-center gap-2 mt-2 text-xs text-[#687280]">
                                      <User className="h-3 w-3" />
                                      <span>{notification.metadata.patientName}</span>
                                    </div>
                                  )}
                                  <p className="text-xs text-[#687280] mt-2">
                                    {formatDate(notification.createdAt)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1">
                                  {!notification.read && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMarkAsRead(notification.id);
                                      }}
                                      className="h-8 w-8 p-0"
                                      title="Đánh dấu đã đọc"
                                    >
                                      <CheckCircle2 className="h-4 w-4 text-blue-600" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(notification.id);
                                    }}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                    title="Xóa thông báo"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DoctorLayout>
  );
};

export default Notifications;

