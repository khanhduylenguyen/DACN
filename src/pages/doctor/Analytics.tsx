import { useEffect, useState, useCallback } from "react";
import DoctorLayout from "@/components/layout/DoctorLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  DollarSign,
  Activity,
  FileText,
  Download,
  Filter,
  Stethoscope,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import {
  getDiagnosisStatistics,
  getPerformanceStatistics,
  getTrendData,
  getTopDiagnoses,
  formatCurrency,
  formatPeriodLabel,
  type DiagnosisStats,
  type PerformanceStats,
  type TrendData,
} from "@/lib/doctor-analytics";
import { toast } from "sonner";

const COLORS = ["#007BFF", "#28A745", "#FFC107", "#DC3545", "#17A2B8", "#6F42C1", "#E91E63", "#9C27B0"];

const Analytics = () => {
  const currentUser = getCurrentUser();
  const [dateRange, setDateRange] = useState<"week" | "month" | "year">("month");
  const [periodType, setPeriodType] = useState<"week" | "month" | "year">("month");
  const [isLoading, setIsLoading] = useState(true);
  
  const [diagnosisStats, setDiagnosisStats] = useState<DiagnosisStats[]>([]);
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats | null>(null);
  const [trendData, setTrendData] = useState<TrendData[]>([]);

  // Calculate date range
  const getDateRange = useCallback(() => {
    const end = new Date();
    const start = new Date();
    
    if (dateRange === "week") {
      start.setDate(end.getDate() - 7);
    } else if (dateRange === "month") {
      start.setMonth(end.getMonth() - 1);
    } else {
      start.setFullYear(end.getFullYear() - 1);
    }
    
    return { start, end };
  }, [dateRange]);

  // Load analytics data
  const loadAnalytics = useCallback(() => {
    if (!currentUser?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const { start, end } = getDateRange();
      
      const diagnoses = getDiagnosisStatistics(currentUser.id, start, end);
      setDiagnosisStats(diagnoses);

      const performance = getPerformanceStatistics(currentUser.id, start, end);
      setPerformanceStats(performance);

      const trends = getTrendData(currentUser.id, periodType, start, end);
      setTrendData(trends);
    } catch (error) {
      console.error("Error loading analytics:", error);
      toast.error("Có lỗi xảy ra khi tải dữ liệu phân tích");
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id, dateRange, periodType, getDateRange]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Prepare chart data
  const topDiagnosesData = diagnosisStats.slice(0, 10).map((stat) => ({
    name: stat.diagnosis.length > 20 ? stat.diagnosis.substring(0, 20) + "..." : stat.diagnosis,
    count: stat.count,
    percentage: stat.percentage,
  }));

  const diagnosisPieData = diagnosisStats.slice(0, 6).map((stat) => ({
    name: stat.diagnosis.length > 15 ? stat.diagnosis.substring(0, 15) + "..." : stat.diagnosis,
    value: stat.count,
  }));

  const trendChartData = trendData.map((trend) => ({
    period: formatPeriodLabel(trend.period, periodType),
    appointments: trend.appointments,
    completed: trend.completed,
    revenue: trend.revenue / 1000000, // Convert to millions
  }));

  // Get top diagnoses from trend data
  const getTopDiagnosesFromTrend = () => {
    const diagnosisCount: Record<string, number> = {};
    
    trendData.forEach((trend) => {
      Object.entries(trend.diagnoses).forEach(([diagnosis, count]) => {
        diagnosisCount[diagnosis] = (diagnosisCount[diagnosis] || 0) + count;
      });
    });

    return Object.entries(diagnosisCount)
      .map(([diagnosis, count]) => ({ diagnosis, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const topDiagnosesTrend = getTopDiagnosesFromTrend();

  // Export PDF
  const handleExportPDF = () => {
    try {
      const { start, end } = getDateRange();
      const reportContent = generateReportContent(start, end);
      
      // Create a new window with report content
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(reportContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 250);
      }
      
      toast.success("Đang mở báo cáo để in/export PDF");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Có lỗi xảy ra khi export báo cáo");
    }
  };

  const generateReportContent = (startDate: Date, endDate: Date): string => {
    const doctorName = currentUser?.name || "Bác sĩ";
    const dateRangeStr = `${startDate.toLocaleDateString("vi-VN")} - ${endDate.toLocaleDateString("vi-VN")}`;
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Báo cáo Phân tích - ${doctorName}</title>
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
            .section {
              margin: 30px 0;
            }
            .section-title {
              font-size: 18px;
              font-weight: bold;
              color: #111827;
              margin-bottom: 15px;
              border-left: 4px solid #007BFF;
              padding-left: 10px;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
              margin: 20px 0;
            }
            .stat-item {
              padding: 15px;
              background-color: #F9FAFB;
              border-radius: 8px;
            }
            .stat-label {
              font-size: 12px;
              color: #687280;
              margin-bottom: 5px;
            }
            .stat-value {
              font-size: 20px;
              font-weight: bold;
              color: #111827;
            }
            .diagnosis-list {
              margin: 20px 0;
            }
            .diagnosis-item {
              padding: 10px;
              border-bottom: 1px solid #E5E7EB;
              display: flex;
              justify-between;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #E5E7EB;
              text-align: center;
              color: #687280;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="font-size: 18px; margin: 10px 0; color: #111827;">PHÒNG KHÁM CLINICCARE</div>
            <h1>BÁO CÁO PHÂN TÍCH</h1>
            <p style="margin: 10px 0; color: #687280;">Bác sĩ: ${doctorName}</p>
            <p style="margin: 5px 0; color: #687280;">Thời gian: ${dateRangeStr}</p>
          </div>
          
          <div class="section">
            <div class="section-title">Hiệu suất làm việc</div>
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-label">Tổng bệnh nhân</div>
                <div class="stat-value">${performanceStats?.totalPatients || 0}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Tổng lịch khám</div>
                <div class="stat-value">${performanceStats?.totalAppointments || 0}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Đã hoàn thành</div>
                <div class="stat-value">${performanceStats?.completedAppointments || 0}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Tổng doanh thu</div>
                <div class="stat-value">${formatCurrency(performanceStats?.totalRevenue || 0)}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Tỷ lệ hoàn thành</div>
                <div class="stat-value">${performanceStats?.completionRate || 0}%</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Bệnh nhân/ngày (TB)</div>
                <div class="stat-value">${performanceStats?.averagePatientsPerDay || 0}</div>
              </div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Thống kê bệnh lý</div>
            <div class="diagnosis-list">
              ${diagnosisStats.slice(0, 10).map((stat, idx) => `
                <div class="diagnosis-item">
                  <div>
                    <strong>${idx + 1}. ${stat.diagnosis}</strong>
                  </div>
                  <div>
                    ${stat.count} ca (${stat.percentage}%)
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
          
          <div class="footer">
            <p>Báo cáo được tạo tự động bởi hệ thống ClinicCare</p>
            <p>Ngày tạo: ${new Date().toLocaleDateString("vi-VN", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}</p>
          </div>
        </body>
      </html>
    `;
  };

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

  if (!currentUser) {
    return (
      <DoctorLayout>
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-12 text-center">
            <p className="text-[#687280]">Vui lòng đăng nhập để xem phân tích</p>
          </CardContent>
        </Card>
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Phân tích & Báo cáo</h1>
            <p className="text-[#687280] mt-1">
              Thống kê bệnh lý, hiệu suất làm việc và xu hướng
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">7 ngày qua</SelectItem>
                <SelectItem value="month">30 ngày qua</SelectItem>
                <SelectItem value="year">1 năm qua</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleExportPDF} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Performance Stats Cards */}
        {performanceStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-[#E5E7EB]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#687280]">Tổng bệnh nhân</p>
                    <p className="text-2xl font-bold">{performanceStats.totalPatients}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-[#E5E7EB]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#687280]">Tổng lịch khám</p>
                    <p className="text-2xl font-bold">{performanceStats.totalAppointments}</p>
                  </div>
                  <Calendar className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-[#E5E7EB]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#687280]">Tổng doanh thu</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(performanceStats.totalRevenue)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-[#E5E7EB]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#687280]">Tỷ lệ hoàn thành</p>
                    <p className="text-2xl font-bold">{performanceStats.completionRate}%</p>
                  </div>
                  <Activity className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="diagnosis" className="space-y-4">
          <TabsList>
            <TabsTrigger value="diagnosis">
              <Stethoscope className="h-4 w-4 mr-2" />
              Thống kê bệnh lý
            </TabsTrigger>
            <TabsTrigger value="performance">
              <Activity className="h-4 w-4 mr-2" />
              Hiệu suất làm việc
            </TabsTrigger>
            <TabsTrigger value="trends">
              <TrendingUp className="h-4 w-4 mr-2" />
              Xu hướng
            </TabsTrigger>
          </TabsList>

          {/* Diagnosis Statistics Tab */}
          <TabsContent value="diagnosis" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top Diagnoses Bar Chart */}
              <Card className="border-[#E5E7EB]">
                <CardHeader>
                  <CardTitle>Top 10 Bệnh thường gặp</CardTitle>
                  <CardDescription>
                    Các chẩn đoán phổ biến nhất trong khoảng thời gian đã chọn
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {topDiagnosesData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={topDiagnosesData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis type="number" stroke="#687280" />
                        <YAxis dataKey="name" type="category" width={120} stroke="#687280" />
                        <Tooltip />
                        <Bar dataKey="count" fill="#007BFF" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[400px] flex items-center justify-center text-[#687280]">
                      Chưa có dữ liệu
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Diagnosis Distribution Pie Chart */}
              <Card className="border-[#E5E7EB]">
                <CardHeader>
                  <CardTitle>Phân bố bệnh lý</CardTitle>
                  <CardDescription>
                    Tỷ lệ các bệnh lý phổ biến nhất
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {diagnosisPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <PieChart>
                        <Pie
                          data={diagnosisPieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={120}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {diagnosisPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[400px] flex items-center justify-center text-[#687280]">
                      Chưa có dữ liệu
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Diagnosis List */}
            <Card className="border-[#E5E7EB]">
              <CardHeader>
                <CardTitle>Danh sách bệnh lý</CardTitle>
                <CardDescription>
                  Chi tiết các chẩn đoán và số lượng ca bệnh
                </CardDescription>
              </CardHeader>
              <CardContent>
                {diagnosisStats.length > 0 ? (
                  <div className="space-y-2">
                    {diagnosisStats.map((stat, idx) => (
                      <div
                        key={stat.diagnosis}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="w-8 text-center">
                            {idx + 1}
                          </Badge>
                          <div>
                            <p className="font-medium">{stat.diagnosis}</p>
                            <p className="text-sm text-[#687280]">
                              {stat.count} ca bệnh
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-semibold">{stat.percentage}%</p>
                            <p className="text-xs text-[#687280]">Tỷ lệ</p>
                          </div>
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-[#007BFF] h-2 rounded-full"
                              style={{ width: `${stat.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-[#687280]">
                    Chưa có dữ liệu bệnh lý
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Appointments Status */}
              <Card className="border-[#E5E7EB]">
                <CardHeader>
                  <CardTitle>Trạng thái lịch khám</CardTitle>
                </CardHeader>
                <CardContent>
                  {performanceStats ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            {
                              name: "Hoàn thành",
                              value: performanceStats.completedAppointments,
                              color: "#28A745",
                            },
                            {
                              name: "Đã hủy",
                              value: performanceStats.cancelledAppointments,
                              color: "#DC3545",
                            },
                            {
                              name: "Chờ xử lý",
                              value:
                                performanceStats.totalAppointments -
                                performanceStats.completedAppointments -
                                performanceStats.cancelledAppointments,
                              color: "#FFC107",
                            },
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          <Cell fill="#28A745" />
                          <Cell fill="#DC3545" />
                          <Cell fill="#FFC107" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-[#687280]">
                      Chưa có dữ liệu
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Performance Metrics */}
              <Card className="border-[#E5E7EB]">
                <CardHeader>
                  <CardTitle>Chỉ số hiệu suất</CardTitle>
                </CardHeader>
                <CardContent>
                  {performanceStats ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-blue-600" />
                          <span className="font-medium">Bệnh nhân/ngày (TB)</span>
                        </div>
                        <span className="text-xl font-bold">
                          {performanceStats.averagePatientsPerDay}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-5 w-5 text-orange-600" />
                          <span className="font-medium">Doanh thu/ngày (TB)</span>
                        </div>
                        <span className="text-xl font-bold">
                          {formatCurrency(performanceStats.averageRevenuePerDay)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span className="font-medium">Tỷ lệ hoàn thành</span>
                        </div>
                        <span className="text-xl font-bold">
                          {performanceStats.completionRate}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-5 w-5 text-red-600" />
                          <span className="font-medium">Đã hủy</span>
                        </div>
                        <span className="text-xl font-bold">
                          {performanceStats.cancelledAppointments}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-[#687280]">
                      Chưa có dữ liệu
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-4">
            <div className="flex justify-between items-center">
              <CardDescription>Chọn khoảng thời gian để xem xu hướng</CardDescription>
              <Select value={periodType} onValueChange={(value: any) => setPeriodType(value)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Theo tuần</SelectItem>
                  <SelectItem value="month">Theo tháng</SelectItem>
                  <SelectItem value="year">Theo quý</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Trend Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Appointments Trend */}
              <Card className="border-[#E5E7EB]">
                <CardHeader>
                  <CardTitle>Xu hướng lịch khám</CardTitle>
                  <CardDescription>
                    Số lượng lịch khám và hoàn thành theo thời gian
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {trendChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={trendChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="period" stroke="#687280" />
                        <YAxis stroke="#687280" />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="appointments"
                          stackId="1"
                          stroke="#007BFF"
                          fill="#007BFF"
                          fillOpacity={0.6}
                          name="Tổng lịch"
                        />
                        <Area
                          type="monotone"
                          dataKey="completed"
                          stackId="2"
                          stroke="#28A745"
                          fill="#28A745"
                          fillOpacity={0.6}
                          name="Hoàn thành"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-[#687280]">
                      Chưa có dữ liệu
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Revenue Trend */}
              <Card className="border-[#E5E7EB]">
                <CardHeader>
                  <CardTitle>Xu hướng doanh thu</CardTitle>
                  <CardDescription>
                    Doanh thu theo thời gian (triệu VNĐ)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {trendChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={trendChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="period" stroke="#687280" />
                        <YAxis stroke="#687280" />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          stroke="#FFC107"
                          strokeWidth={3}
                          name="Doanh thu (triệu)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-[#687280]">
                      Chưa có dữ liệu
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Top Diagnoses Trend */}
            {topDiagnosesTrend.length > 0 && (
              <Card className="border-[#E5E7EB]">
                <CardHeader>
                  <CardTitle>Top 5 bệnh lý theo xu hướng</CardTitle>
                  <CardDescription>
                    Các bệnh lý phổ biến nhất trong khoảng thời gian đã chọn
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topDiagnosesTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis
                        dataKey="diagnosis"
                        stroke="#687280"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis stroke="#687280" />
                      <Tooltip />
                      <Bar dataKey="count" fill="#007BFF" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DoctorLayout>
  );
};

export default Analytics;

