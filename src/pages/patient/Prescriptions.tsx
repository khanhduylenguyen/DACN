import { useEffect, useState, useRef } from "react";
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
import {
  Pill,
  Calendar,
  User,
  Download,
  Eye,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { listPrescriptions, type Prescription, type PrescriptionDrug } from "@/lib/api";
import { toast } from "sonner";


const Prescriptions = () => {
  const user = getCurrentUser();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "completed" | "cancelled">("all");

  const isLoadingRef = useRef(false);

  // Load prescriptions
  useEffect(() => {
    if (!user) {
      setPrescriptions([]);
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      // Prevent multiple simultaneous loads
      if (isLoadingRef.current) return;

      isLoadingRef.current = true;
      setIsLoading(true);

      try {
        const patientPrescriptions = await listPrescriptions({ patientId: user.id });
        setPrescriptions(patientPrescriptions);
      } catch (error) {
        console.error("Error loading prescriptions:", error);
        setPrescriptions([]);
        toast.error("Không thể tải danh sách toa thuốc");
      } finally {
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    };

    // Load immediately on mount or user change
    loadData();
  }, [user?.id]); // Only depend on user.id, not the whole user object

  // Filter prescriptions
  const filteredPrescriptions = prescriptions.filter((p) => {
    if (filterStatus === "all") return true;
    return p.status === filterStatus;
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

  const handleView = (prescription: Prescription) => {
    setSelectedPrescription(prescription);
    setIsViewDialogOpen(true);
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
              .no-print { display: none; }
            }
            body { 
              font-family: 'Times New Roman', serif; 
              padding: 40px; 
              max-width: 800px; 
              margin: 0 auto;
              line-height: 1.6;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: bold;
            }
            .clinic-name {
              font-size: 18px;
              margin: 10px 0;
            }
            .prescription-info {
              margin: 20px 0;
            }
            .prescription-info p {
              margin: 8px 0;
            }
            .drug-list {
              margin: 30px 0;
            }
            .drug-item {
              margin: 15px 0;
              padding: 10px;
              border-left: 3px solid #007BFF;
              background-color: #F9FAFB;
            }
            .drug-name {
              font-weight: bold;
              font-size: 16px;
              color: #111827;
            }
            .drug-dose {
              margin-top: 5px;
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

  const downloadPrescription = (prescription: Prescription) => {
    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Toa thuốc - ${formatDate(prescription.date)}</title>
          <style>
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

    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `toa-thuoc-${prescription.date.split("T")[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <PatientLayout>
      <div className="space-y-6">
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Pill className="h-5 w-5 text-[#007BFF]" />
                  Toa thuốc
                </CardTitle>
                <CardDescription className="mt-2">
                  Danh sách toa thuốc đã kê, tải file PDF nếu có.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filter */}
            <div className="mb-6 flex items-center gap-4">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 border border-[#E5E7EB] rounded-md text-sm"
              >
                <option value="all">Tất cả</option>
                <option value="active">Đang dùng</option>
                <option value="completed">Đã hoàn thành</option>
                <option value="cancelled">Đã hủy</option>
              </select>
              <div className="text-sm text-[#687280]">
                Tổng cộng: <span className="font-medium text-gray-900">{filteredPrescriptions.length}</span> toa thuốc
              </div>
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
                  {filterStatus !== "all"
                    ? "Không có toa thuốc nào với trạng thái này"
                    : "Toa thuốc sẽ được hiển thị sau khi bác sĩ kê đơn cho bạn."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPrescriptions.map((prescription) => (
                  <div
                    key={prescription._id}
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
                          {prescription.doctorName && (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-[#687280]" />
                              <span className="text-sm text-gray-700">{prescription.doctorName}</span>
                            </div>
                          )}
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
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Xem chi tiết
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => printPrescription(prescription)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          In/Tải
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

      {/* View Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-[#007BFF]" />
              Chi tiết toa thuốc
            </DialogTitle>
            <DialogDescription>
              Thông tin chi tiết về toa thuốc
            </DialogDescription>
          </DialogHeader>
          {selectedPrescription && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-[#687280] mb-1">Ngày kê đơn</p>
                  <p className="text-base font-semibold text-gray-900">
                    {formatDate(selectedPrescription.date)}
                  </p>
                </div>
                {selectedPrescription.doctorName && (
                  <div>
                    <p className="text-sm font-medium text-[#687280] mb-1">Bác sĩ kê đơn</p>
                    <p className="text-base font-semibold text-gray-900">
                      {selectedPrescription.doctorName}
                    </p>
                  </div>
                )}
                {selectedPrescription.diagnosis && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-[#687280] mb-1">Chẩn đoán</p>
                    <p className="text-base text-gray-900">{selectedPrescription.diagnosis}</p>
                  </div>
                )}
                {selectedPrescription.status && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-[#687280] mb-1">Trạng thái</p>
                    <Badge
                      variant="outline"
                      className={
                        selectedPrescription.status === "active"
                          ? "bg-blue-50 text-blue-600 border-blue-200"
                          : selectedPrescription.status === "completed"
                          ? "bg-green-50 text-green-600 border-green-200"
                          : "bg-red-50 text-red-600 border-red-200"
                      }
                    >
                      {selectedPrescription.status === "active"
                        ? "Đang dùng"
                        : selectedPrescription.status === "completed"
                        ? "Đã hoàn thành"
                        : "Đã hủy"}
                    </Badge>
                  </div>
                )}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Danh sách thuốc</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedPrescription.drugs.map((drug, index) => (
                      <div
                        key={index}
                        className="p-4 border border-[#E5E7EB] rounded-lg bg-white"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle2 className="h-4 w-4 text-[#007BFF]" />
                              <span className="font-semibold text-gray-900 text-lg">
                                {drug.name}
                              </span>
                            </div>
                            <div className="space-y-1 ml-6">
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Liều dùng:</span> {drug.dose}
                              </p>
                              {drug.quantity && (
                                <p className="text-sm text-gray-700">
                                  <span className="font-medium">Số lượng:</span> {drug.quantity}
                                </p>
                              )}
                              {drug.instructions && (
                                <p className="text-sm text-[#687280]">
                                  <span className="font-medium">Hướng dẫn:</span> {drug.instructions}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {selectedPrescription.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Ghi chú</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-700">{selectedPrescription.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Đóng
            </Button>
            {selectedPrescription && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedPrescription) printPrescription(selectedPrescription);
                  }}
                >
                  In
                </Button>
                <Button
                  onClick={() => {
                    if (selectedPrescription) downloadPrescription(selectedPrescription);
                  }}
                  className="bg-[#007BFF] hover:bg-[#0056B3]"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Tải về
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PatientLayout>
  );
};

export default Prescriptions;
