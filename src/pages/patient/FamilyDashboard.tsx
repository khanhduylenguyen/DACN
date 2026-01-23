import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import PatientLayout from "@/components/layout/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Calendar,
  Heart,
  Activity,
  Pill,
  Syringe,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  FileText,
  Clock,
} from "lucide-react";
import { getCurrentUser, AUTH_EVENT } from "@/lib/auth";
import { getFamilyMembers, getAge, type FamilyMember } from "@/lib/family";
import {
  getHealthRecords,
  getVaccinationRecords,
  getUpcomingVaccinations,
  getMedicationRecords,
  getActiveMedications,
  type PersonalHealthRecord,
  type VaccinationRecord,
  type MedicationRecord,
} from "@/lib/family-health";
import { getAppointmentsForFamilyMember } from "@/lib/family";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const COLORS = ['#007BFF', '#28A745', '#FFC107', '#DC3545', '#17A2B8', '#6F42C1'];

const FamilyDashboard = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getCurrentUser>>(getCurrentUser());
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"week" | "month" | "year">("month");

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

      window.addEventListener("familyMembersUpdated", loadMembers);

      return () => {
        clearTimeout(timer);
        window.removeEventListener("familyMembersUpdated", loadMembers);
      };
    } else {
      setIsLoading(false);
    }
  }, [currentUser?.id, loadMembers]);

  // Calculate statistics
  const getStatistics = () => {
    let totalAppointments = 0;
    let upcomingAppointments = 0;
    let totalVaccinations = 0;
    let upcomingVaccinations = 0;
    let totalMedications = 0;
    let activeMedications = 0;
    let totalHealthRecords = 0;
    let membersWithAllergies = 0;
    let membersWithChronicConditions = 0;

    members.forEach((member) => {
      // Appointments
      const appointments = getAppointmentsForFamilyMember(member.name, member.phone);
      totalAppointments += appointments.length;
      const upcoming = appointments.filter((apt) => {
        const aptDate = new Date(`${apt.date}T${apt.time}`);
        return aptDate > new Date() && apt.status !== "cancelled";
      });
      upcomingAppointments += upcoming.length;

      // Vaccinations
      const vaccinations = getVaccinationRecords(member.id);
      totalVaccinations += vaccinations.length;
      upcomingVaccinations += getUpcomingVaccinations(member.id).length;

      // Medications
      const medications = getMedicationRecords(member.id);
      totalMedications += medications.length;
      activeMedications += getActiveMedications(member.id).length;

      // Health Records
      totalHealthRecords += getHealthRecords(member.id).length;

      // Health conditions
      if (member.allergies && member.allergies.length > 0) {
        membersWithAllergies++;
      }
      if (member.chronicConditions && member.chronicConditions.length > 0) {
        membersWithChronicConditions++;
      }
    });

    return {
      totalMembers: members.length,
      totalAppointments,
      upcomingAppointments,
      totalVaccinations,
      upcomingVaccinations,
      totalMedications,
      activeMedications,
      totalHealthRecords,
      membersWithAllergies,
      membersWithChronicConditions,
    };
  };

  // Get appointments chart data
  const getAppointmentsChartData = () => {
    const data: Record<string, number> = {};
    const today = new Date();
    let startDate: Date;

    if (timeRange === "week") {
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
    } else if (timeRange === "month") {
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 1);
    } else {
      startDate = new Date(today);
      startDate.setFullYear(today.getFullYear() - 1);
    }

    members.forEach((member) => {
      const appointments = getAppointmentsForFamilyMember(member.name, member.phone);
      appointments.forEach((apt) => {
        const aptDate = new Date(`${apt.date}T${apt.time}`);
        if (aptDate >= startDate) {
          const key = aptDate.toLocaleDateString("vi-VN", {
            year: "numeric",
            month: timeRange === "year" ? "short" : "numeric",
            day: timeRange === "week" ? "numeric" : undefined,
          });
          data[key] = (data[key] || 0) + 1;
        }
      });
    });

    return Object.entries(data)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // Get medications chart data
  const getMedicationsChartData = () => {
    const data: Record<string, number> = {};

    members.forEach((member) => {
      const medications = getMedicationRecords(member.id);
      medications.forEach((med) => {
        const medDate = new Date(med.startDate);
        const key = medDate.toLocaleDateString("vi-VN", {
          year: "numeric",
          month: timeRange === "year" ? "short" : "numeric",
          day: timeRange === "week" ? "numeric" : undefined,
        });
        data[key] = (data[key] || 0) + 1;
      });
    });

    return Object.entries(data)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // Get vaccinations chart data
  const getVaccinationsChartData = () => {
    const data: Record<string, number> = {};

    members.forEach((member) => {
      const vaccinations = getVaccinationRecords(member.id);
      vaccinations.forEach((vac) => {
        const vacDate = new Date(vac.vaccinationDate);
        const key = vacDate.toLocaleDateString("vi-VN", {
          year: "numeric",
          month: timeRange === "year" ? "short" : "numeric",
          day: timeRange === "week" ? "numeric" : undefined,
        });
        data[key] = (data[key] || 0) + 1;
      });
    });

    return Object.entries(data)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // Get health status by member
  const getHealthStatusByMember = () => {
    return members.map((member) => {
      const age = getAge(member.dateOfBirth);
      const appointments = getAppointmentsForFamilyMember(member.name, member.phone);
      const upcomingAppointments = appointments.filter((apt) => {
        const aptDate = new Date(`${apt.date}T${apt.time}`);
        return aptDate > new Date() && apt.status !== "cancelled";
      });
      const activeMeds = getActiveMedications(member.id);
      const upcomingVacs = getUpcomingVaccinations(member.id);

      let status = "healthy";
      let statusText = "Khỏe mạnh";
      if (member.chronicConditions && member.chronicConditions.length > 0) {
        status = "monitoring";
        statusText = "Cần theo dõi";
      }
      if (upcomingVacs.length > 0 || activeMeds.length > 0) {
        status = "active";
        statusText = "Đang điều trị";
      }

      return {
        id: member.id,
        name: member.name,
        age,
        relationship: member.relationship,
        status,
        statusText,
        appointments: appointments.length,
        upcomingAppointments: upcomingAppointments.length,
        activeMedications: activeMeds.length,
        upcomingVaccinations: upcomingVacs.length,
        allergies: member.allergies?.length || 0,
        chronicConditions: member.chronicConditions?.length || 0,
      };
    });
  };

  // Get age distribution
  const getAgeDistribution = () => {
    const distribution: Record<string, number> = {
      "0-5": 0,
      "6-12": 0,
      "13-18": 0,
      "19-35": 0,
      "36-50": 0,
      "51-65": 0,
      "65+": 0,
    };

    members.forEach((member) => {
      const age = getAge(member.dateOfBirth);
      if (age <= 5) distribution["0-5"]++;
      else if (age <= 12) distribution["6-12"]++;
      else if (age <= 18) distribution["13-18"]++;
      else if (age <= 35) distribution["19-35"]++;
      else if (age <= 50) distribution["36-50"]++;
      else if (age <= 65) distribution["51-65"]++;
      else distribution["65+"]++;
    });

    return Object.entries(distribution)
      .filter(([_, count]) => count > 0)
      .map(([ageRange, count]) => ({ ageRange, count }));
  };

  if (isLoading) {
    return (
      <PatientLayout>
        <div className="space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="border-[#E5E7EB]">
                <CardContent className="p-6">
                  <div className="h-20 bg-gray-200 rounded animate-pulse" />
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Vui lòng đăng nhập</h3>
            <p className="text-[#687280]">Bạn cần đăng nhập để xem dashboard gia đình</p>
          </CardContent>
        </Card>
      </PatientLayout>
    );
  }

  const stats = getStatistics();
  const appointmentsData = getAppointmentsChartData();
  const medicationsData = getMedicationsChartData();
  const vaccinationsData = getVaccinationsChartData();
  const healthStatusData = getHealthStatusByMember();
  const ageDistribution = getAgeDistribution();

  return (
    <PatientLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard Sức khỏe Gia đình</h1>
            <p className="text-[#687280] mt-1">Tổng quan tình trạng sức khỏe của cả gia đình</p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/patient/family")}
          >
            <Users className="h-4 w-4 mr-2" />
            Quản lý thành viên
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-[#E5E7EB]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#687280] mb-1">Tổng thành viên</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalMembers}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E5E7EB]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#687280] mb-1">Lịch khám sắp tới</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.upcomingAppointments}</p>
                  <p className="text-xs text-[#687280] mt-1">Tổng: {stats.totalAppointments}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <Calendar className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E5E7EB]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#687280] mb-1">Mũi tiêm sắp tới</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.upcomingVaccinations}</p>
                  <p className="text-xs text-[#687280] mt-1">Tổng: {stats.totalVaccinations}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Syringe className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E5E7EB]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#687280] mb-1">Thuốc đang dùng</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.activeMedications}</p>
                  <p className="text-xs text-[#687280] mt-1">Tổng: {stats.totalMedications}</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-lg">
                  <Pill className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            <TabsTrigger value="charts">Biểu đồ</TabsTrigger>
            <TabsTrigger value="members">Thành viên</TabsTrigger>
            <TabsTrigger value="reports">Báo cáo</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Health Status Overview */}
            <Card className="border-[#E5E7EB]">
              <CardHeader>
                <CardTitle>Tình trạng sức khỏe thành viên</CardTitle>
                <CardDescription>Xem chi tiết từng thành viên</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {healthStatusData.map((member) => (
                    <Card
                      key={member.id}
                      className="border-[#E5E7EB] hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => navigate(`/patient/family/${member.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-gray-900">{member.name}</p>
                            <p className="text-sm text-[#687280]">
                              {member.relationship} • {member.age} tuổi
                            </p>
                          </div>
                          <Badge
                            variant={
                              member.status === "healthy"
                                ? "default"
                                : member.status === "monitoring"
                                ? "destructive"
                                : "outline"
                            }
                          >
                            {member.statusText}
                          </Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-[#687280]">Lịch khám:</span>
                            <span className="font-medium">{member.upcomingAppointments} sắp tới</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#687280]">Thuốc:</span>
                            <span className="font-medium">{member.activeMedications} loại</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#687280]">Tiêm chủng:</span>
                            <span className="font-medium">{member.upcomingVaccinations} mũi</span>
                          </div>
                          {(member.allergies > 0 || member.chronicConditions > 0) && (
                            <div className="pt-2 border-t">
                              {member.allergies > 0 && (
                                <div className="flex items-center gap-1 text-xs text-orange-600">
                                  <AlertCircle className="h-3 w-3" />
                                  <span>{member.allergies} dị ứng</span>
                                </div>
                              )}
                              {member.chronicConditions > 0 && (
                                <div className="flex items-center gap-1 text-xs text-red-600">
                                  <Activity className="h-3 w-3" />
                                  <span>{member.chronicConditions} bệnh nền</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-[#E5E7EB]">
                <CardHeader>
                  <CardTitle className="text-base">Hồ sơ y tế</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalHealthRecords}</p>
                  <p className="text-sm text-[#687280] mt-1">Tổng số hồ sơ</p>
                </CardContent>
              </Card>

              <Card className="border-[#E5E7EB]">
                <CardHeader>
                  <CardTitle className="text-base">Thành viên có dị ứng</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-gray-900">{stats.membersWithAllergies}</p>
                  <p className="text-sm text-[#687280] mt-1">/{stats.totalMembers} thành viên</p>
                </CardContent>
              </Card>

              <Card className="border-[#E5E7EB]">
                <CardHeader>
                  <CardTitle className="text-base">Thành viên có bệnh nền</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-gray-900">{stats.membersWithChronicConditions}</p>
                  <p className="text-sm text-[#687280] mt-1">/{stats.totalMembers} thành viên</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Charts Tab */}
          <TabsContent value="charts" className="space-y-6">
            {/* Time Range Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#687280]">Khoảng thời gian:</span>
              <Button
                variant={timeRange === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeRange("week")}
              >
                Tuần
              </Button>
              <Button
                variant={timeRange === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeRange("month")}
              >
                Tháng
              </Button>
              <Button
                variant={timeRange === "year" ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeRange("year")}
              >
                Năm
              </Button>
            </div>

            {/* Appointments Chart */}
            <Card className="border-[#E5E7EB]">
              <CardHeader>
                <CardTitle>Lịch khám theo thời gian</CardTitle>
                <CardDescription>Xu hướng đặt lịch khám của gia đình</CardDescription>
              </CardHeader>
              <CardContent>
                {appointmentsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={appointmentsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="count" stroke="#007BFF" strokeWidth={2} name="Số lịch khám" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-300 flex items-center justify-center text-[#687280]">
                    Chưa có dữ liệu lịch khám
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Medications Chart */}
            <Card className="border-[#E5E7EB]">
              <CardHeader>
                <CardTitle>Đơn thuốc theo thời gian</CardTitle>
                <CardDescription>Xu hướng sử dụng thuốc của gia đình</CardDescription>
              </CardHeader>
              <CardContent>
                {medicationsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={medicationsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#28A745" name="Số đơn thuốc" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-300 flex items-center justify-center text-[#687280]">
                    Chưa có dữ liệu đơn thuốc
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Vaccinations Chart */}
            <Card className="border-[#E5E7EB]">
              <CardHeader>
                <CardTitle>Tiêm chủng theo thời gian</CardTitle>
                <CardDescription>Lịch sử tiêm chủng của gia đình</CardDescription>
              </CardHeader>
              <CardContent>
                {vaccinationsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={vaccinationsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#6F42C1" name="Số mũi tiêm" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-300 flex items-center justify-center text-[#687280]">
                    Chưa có dữ liệu tiêm chủng
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Age Distribution */}
            {ageDistribution.length > 0 && (
              <Card className="border-[#E5E7EB]">
                <CardHeader>
                  <CardTitle>Phân bố độ tuổi</CardTitle>
                  <CardDescription>Thành viên theo nhóm tuổi</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={ageDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ ageRange, percent }) => `${ageRange}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {ageDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map((member) => {
                const age = getAge(member.dateOfBirth);
                const appointments = getAppointmentsForFamilyMember(member.name, member.phone);
                const upcomingAppointments = appointments.filter((apt) => {
                  const aptDate = new Date(`${apt.date}T${apt.time}`);
                  return aptDate > new Date() && apt.status !== "cancelled";
                });
                const activeMeds = getActiveMedications(member.id);
                const upcomingVacs = getUpcomingVaccinations(member.id);
                const healthRecords = getHealthRecords(member.id);

                return (
                  <Card
                    key={member.id}
                    className="border-[#E5E7EB] hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => navigate(`/patient/family/${member.id}`)}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback>{member.name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <CardTitle className="text-lg">{member.name}</CardTitle>
                          <CardDescription>
                            {member.relationship} • {age} tuổi
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-[#687280]">Lịch khám</p>
                          <p className="font-semibold">{upcomingAppointments.length} sắp tới</p>
                        </div>
                        <div>
                          <p className="text-[#687280]">Thuốc</p>
                          <p className="font-semibold">{activeMeds.length} loại</p>
                        </div>
                        <div>
                          <p className="text-[#687280]">Tiêm chủng</p>
                          <p className="font-semibold">{upcomingVacs.length} mũi</p>
                        </div>
                        <div>
                          <p className="text-[#687280]">Hồ sơ</p>
                          <p className="font-semibold">{healthRecords.length} bản</p>
                        </div>
                      </div>
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
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <Card className="border-[#E5E7EB]">
              <CardHeader>
                <CardTitle>Báo cáo tổng hợp</CardTitle>
                <CardDescription>Thống kê chi tiết về sức khỏe gia đình</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Tổng quan</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-[#687280]">Tổng thành viên</p>
                      <p className="text-2xl font-bold">{stats.totalMembers}</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-[#687280]">Tổng lịch khám</p>
                      <p className="text-2xl font-bold">{stats.totalAppointments}</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-[#687280]">Tổng mũi tiêm</p>
                      <p className="text-2xl font-bold">{stats.totalVaccinations}</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-[#687280]">Tổng đơn thuốc</p>
                      <p className="text-2xl font-bold">{stats.totalMedications}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Cần chú ý</h3>
                  <div className="space-y-2">
                    {stats.upcomingAppointments > 0 && (
                      <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <Calendar className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-medium text-gray-900">{stats.upcomingAppointments} lịch khám sắp tới</p>
                          <p className="text-sm text-[#687280]">Cần chuẩn bị và nhắc nhở</p>
                        </div>
                      </div>
                    )}
                    {stats.upcomingVaccinations > 0 && (
                      <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <Syringe className="h-5 w-5 text-purple-600" />
                        <div>
                          <p className="font-medium text-gray-900">{stats.upcomingVaccinations} mũi tiêm sắp tới</p>
                          <p className="text-sm text-[#687280]">Cần đặt lịch tiêm chủng</p>
                        </div>
                      </div>
                    )}
                    {stats.activeMedications > 0 && (
                      <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <Pill className="h-5 w-5 text-orange-600" />
                        <div>
                          <p className="font-medium text-gray-900">{stats.activeMedications} loại thuốc đang dùng</p>
                          <p className="text-sm text-[#687280]">Cần nhắc nhở uống thuốc đúng giờ</p>
                        </div>
                      </div>
                    )}
                    {stats.membersWithAllergies > 0 && (
                      <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        <div>
                          <p className="font-medium text-gray-900">{stats.membersWithAllergies} thành viên có dị ứng</p>
                          <p className="text-sm text-[#687280]">Cần cẩn thận khi sử dụng thuốc và thực phẩm</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PatientLayout>
  );
};

export default FamilyDashboard;

